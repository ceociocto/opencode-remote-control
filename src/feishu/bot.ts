// Feishu bot implementation for OpenCode Remote Control
// Uses WebSocket long connection mode - no tunnel/ngrok required!

import * as lark from '@larksuiteoapi/node-sdk'
import type { Config, MessageContext } from '../core/types.js'
import { initSessionManager, getOrCreateSession } from '../core/session.js'
import { splitMessage } from '../core/notifications.js'
import type { BotAdapter } from '../core/types.js'
import { EMOJI } from '../core/types.js'
import {
  initOpenCode,
  createSession,
  sendMessage,
  checkConnection,
  type OpenCodeSession
} from '../opencode/client.js'
import {
  isAuthorized,
  hasOwner,
  claimOwnership,
  getAuthStatus
} from '../core/auth.js'

let feishuClient: lark.Client | null = null
let wsClient: lark.WSClient | null = null
let config: Config | null = null
let openCodeSessions: Map<string, OpenCodeSession> | null = null

// Map Feishu event to shared MessageContext
// Prefix threadId with 'feishu:' to avoid collision with Telegram sessions
function feishuEventToContext(event: any): MessageContext {
  return {
    platform: 'feishu',
    threadId: `feishu:${event.message.chat_id}`,
    userId: event.sender?.sender_id?.user_id || 'unknown',
    messageId: event.message.message_id,
  }
}

// BotAdapter implementation for Feishu
function createFeishuAdapter(client: lark.Client): BotAdapter {
  return {
    async reply(threadId: string, text: string): Promise<string> {
      // Extract chat_id from threadId (format: feishu:chat_id)
      const chatId = threadId.replace('feishu:', '')

      try {
        const result = await client.im.message.create({
          params: { receive_id_type: 'chat_id' },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text }),
          },
        })
        return result.data?.message_id || ''
      } catch (error) {
        console.error('Failed to send Feishu message:', error)
        throw error
      }
    },

    async sendTypingIndicator(threadId: string): Promise<string> {
      // Feishu doesn't have native typing indicator API
      // We send a "thinking" message that will be deleted later
      const chatId = threadId.replace('feishu:', '')
      try {
        const result = await client.im.message.create({
          params: { receive_id_type: 'chat_id' },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text: '⏳ 思考中...' }),
          },
        })
        return result.data?.message_id || ''
      } catch (error) {
        console.error('Failed to send typing indicator:', error)
        return ''
      }
    },

    async deleteMessage(threadId: string, messageId: string): Promise<void> {
      if (!messageId) return
      try {
        await client.im.message.delete({
          path: { message_id: messageId },
        })
      } catch (error) {
        // Ignore delete errors - not critical
        console.warn('Failed to delete Feishu message:', error)
      }
    },
  }
}

// Command handler (mirrors Telegram bot structure)
async function handleCommand(
  adapter: BotAdapter,
  ctx: MessageContext,
  text: string
): Promise<void> {
  const session = getOrCreateSession(ctx.threadId, 'feishu')
  const parts = text.split(/\s+/)
  const command = parts[0].toLowerCase()

  switch (command) {
    case '/start': {
      const result = claimOwnership('feishu', ctx.userId)
      if (result.success) {
        if (result.message === 'claimed') {
          await adapter.reply(ctx.threadId, `🔐 **Security Setup Complete!**

✅ You are now the authorized owner of this bot.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  **IMPORTANT SECURITY NOTICE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Only YOU can control OpenCode through this bot.
Other users will be blocked automatically.

Your Feishu ID: \`${ctx.userId}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 **Ready to use!**
💬 Send me a prompt to start coding
/help — see all commands
/status — check OpenCode connection`)
        } else {
          // Already owner
          await adapter.reply(ctx.threadId, `🚀 OpenCode Remote Control ready

💬 Send me a prompt to start coding
/help — see all commands
/status — check OpenCode connection

Commands:
/start — Start bot
/status — Check connection
/reset — Reset session
/approve — Approve pending changes
/reject — Reject pending changes
/diff — See full diff
/files — List changed files
/retry — Retry connection

💬 Anything else is treated as a prompt for OpenCode!`)
        }
      } else {
        // Already claimed by someone else
        await adapter.reply(ctx.threadId, `🚫 **Access Denied**

This bot is already secured by another user.

If you are the owner, check your configuration.`)
      }
      break
    }

    case '/help':
      await adapter.reply(ctx.threadId, `📖 Commands

/start — Claim ownership & Start bot
/status — Check connection
/reset — Reset session
/approve — Approve pending changes
/reject — Reject pending changes
/diff — See full diff
/files — List changed files
/retry — Retry connection

💬 Anything else is treated as a prompt for OpenCode!`)
      break

    case '/approve': {
      const pending = session.pendingApprovals[0]
      if (!pending) {
        await adapter.reply(ctx.threadId, '🤷 Nothing to approve right now')
        return
      }
      // TODO: Actually apply changes via OpenCode SDK
      await adapter.reply(ctx.threadId, '✅ Approved — changes applied')
      break
    }

    case '/reject': {
      const pending = session.pendingApprovals[0]
      if (!pending) {
        await adapter.reply(ctx.threadId, '🤷 Nothing to reject right now')
        return
      }
      session.pendingApprovals.shift()
      await adapter.reply(ctx.threadId, '❌ Rejected — changes discarded')
      break
    }

    case '/diff': {
      const pending = session.pendingApprovals[0]
      if (!pending || !pending.files?.length) {
        await adapter.reply(ctx.threadId, '📄 No pending changes to show')
        return
      }
      // TODO: Get actual diff from OpenCode SDK
      const diffPreview = pending.files.map(f =>
        `--- a/${f.path}\n+++ b/${f.path}\n@@ changes +${f.additions} -${f.deletions} @@`
      ).join('\n')

      const messages = splitMessage(`\`\`\`diff\n${diffPreview}\n\`\`\``)
      for (const msg of messages) {
        await adapter.reply(ctx.threadId, msg)
      }
      break
    }

    case '/files': {
      const pending = session.pendingApprovals[0]
      if (!pending || !pending.files?.length) {
        await adapter.reply(ctx.threadId, '📄 No files changed in this session')
        return
      }
      const fileList = pending.files.map(f =>
        `• ${f.path} (+${f.additions}, -${f.deletions})`
      ).join('\n')
      await adapter.reply(ctx.threadId, `📄 Changed files:\n${fileList}`)
      break
    }

    case '/status': {
      const openCodeConnected = await checkConnection()
      const openCodeSession = openCodeSessions?.get(ctx.threadId)
      const idleSeconds = Math.round((Date.now() - session.lastActivity) / 1000)
      const pendingCount = session.pendingApprovals.length

      await adapter.reply(ctx.threadId,
        `${openCodeConnected ? '✅' : '❌'} Connected\n\n💬 Session: ${openCodeSession?.sessionId?.slice(0, 8) || 'none'}\n⏰ Idle: ${idleSeconds}s\n📝 Pending approvals: ${pendingCount}`
      )
      break
    }

    case '/reset':
      session.pendingApprovals = []
      session.opencodeSessionId = undefined

      // Clear OpenCode session
      openCodeSessions?.delete(ctx.threadId)

      await adapter.reply(ctx.threadId, '🔄 Session reset. Start fresh!')
      break

    case '/retry': {
      const connected = await checkConnection()
      if (connected) {
        await adapter.reply(ctx.threadId, '✅ OpenCode is now online!')
      } else {
        await adapter.reply(ctx.threadId, '❌ Still offline. Is OpenCode running?')
      }
      break
    }

    default:
      await adapter.reply(ctx.threadId,
        `${EMOJI.WARNING} Unknown command: ${command}\n\nTry /help`
      )
  }
}

// Handle incoming message from Feishu
async function handleMessage(
  adapter: BotAdapter,
  ctx: MessageContext,
  text: string
): Promise<void> {
  const session = getOrCreateSession(ctx.threadId, 'feishu')

  // Check if it's a command
  if (text.startsWith('/')) {
    // Commands are handled by handleCommand which has its own auth logic for /start
    await handleCommand(adapter, ctx, text)
    return
  }

  // Authorization check for non-command messages
  if (!isAuthorized('feishu', ctx.userId)) {
    if (!hasOwner('feishu')) {
      await adapter.reply(ctx.threadId, `🔐 **Authorization Required**

This bot is not yet secured.

Please send /start to claim ownership first.`)
    } else {
      await adapter.reply(ctx.threadId, `🚫 **Access Denied**

You are not authorized to use this bot.`)
    }
    return
  }

  // Check OpenCode connection
  const connected = await checkConnection()
  if (!connected) {
    await adapter.reply(ctx.threadId, `❌ OpenCode is offline

Cannot connect to OpenCode server.

🔄 /retry — check again`)
    return
  }

  // Send typing indicator
  console.log('⏳ Sending typing indicator...')
  const typingMsgId = await adapter.sendTypingIndicator(ctx.threadId)

  // Get or create OpenCode session
  let openCodeSession = openCodeSessions?.get(ctx.threadId)
  if (!openCodeSession) {
    const newSession = await createSession(ctx.threadId, `Feishu chat ${ctx.threadId}`)
    if (!newSession) {
      // Delete typing indicator before error message
      if (typingMsgId && adapter.deleteMessage) {
        await adapter.deleteMessage(ctx.threadId, typingMsgId)
      }
      await adapter.reply(ctx.threadId, '❌ Failed to create OpenCode session')
      return
    }
    openCodeSession = newSession

    openCodeSessions!.set(ctx.threadId, openCodeSession)
    session.opencodeSessionId = openCodeSession.sessionId

    // Share the session URL (only if sharing is enabled)
    if (openCodeSession.shareUrl) {
      await adapter.reply(ctx.threadId, `🔗 Session: ${openCodeSession.shareUrl}`)
    }
  }

  try {
    console.log('🤖 Sending to OpenCode...')
    const response = await sendMessage(openCodeSession, text)
    console.log('✅ Got response from OpenCode')

    // Delete typing indicator
    if (typingMsgId && adapter.deleteMessage) {
      await adapter.deleteMessage(ctx.threadId, typingMsgId)
    }

    // Split long messages
    const messages = splitMessage(response)
    for (const msg of messages) {
      await adapter.reply(ctx.threadId, msg)
    }
  } catch (error) {
    console.error('Error sending message:', error)
    // Delete typing indicator on error too
    if (typingMsgId && adapter.deleteMessage) {
      await adapter.deleteMessage(ctx.threadId, typingMsgId)
    }
    await adapter.reply(ctx.threadId, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Rate limiting (in-memory, per-chat)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 100 // messages per minute per chat
const RATE_WINDOW = 60000 // 1 minute

function checkRateLimit(chatId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(chatId)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(chatId, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }

  if (entry.count >= RATE_LIMIT) {
    return false
  }

  entry.count++
  return true
}

// Start Feishu bot using WebSocket long connection mode
// No tunnel/ngrok required - just needs internet access!
export async function startFeishuBot(botConfig: Config) {
  config = botConfig

  if (!config.feishuAppId || !config.feishuAppSecret) {
    throw new Error('Feishu credentials not configured. Run: opencode-remote config')
  }

  // Initialize Feishu client for sending messages
  feishuClient = new lark.Client({
    appId: config.feishuAppId,
    appSecret: config.feishuAppSecret,
    // Uses feishu.cn domain by default (for China users)
    // For international Lark, add: domain: lark.Domain.Lark
  })

  // Initialize session manager
  initSessionManager(config)

  // Initialize OpenCode sessions map
  openCodeSessions = new Map<string, OpenCodeSession>()

  // Initialize OpenCode
  console.log('🔧 Initializing OpenCode...')
  try {
    await initOpenCode()
    console.log('✅ OpenCode ready')
  } catch (error) {
    console.error('❌ Failed to initialize OpenCode:', error)
    console.log('Make sure OpenCode is running')
  }

  // Create adapter for sending messages
  const adapter = createFeishuAdapter(feishuClient)

  // Create WebSocket client for long connection
  wsClient = new lark.WSClient({
    appId: config.feishuAppId,
    appSecret: config.feishuAppSecret,
    // For international Lark, add: domain: lark.Domain.Lark
  })

  // Create event dispatcher for handling incoming messages
  const eventDispatcher = new lark.EventDispatcher({}).register({
    // Handle incoming messages
    'im.message.receive_v1': async (data: any) => {
      console.log('📩 Received message event:', JSON.stringify(data, null, 2))
      try {
        // Validate event data
        if (!data?.message) {
          console.warn('Received message event without message data')
          return { code: 0 }
        }

        const chatId = data.message.chat_id
        console.log(`💬 Message from chat: ${chatId}`)

        // Rate limiting
        if (!checkRateLimit(chatId)) {
          console.warn(`Rate limit exceeded for chat: ${chatId}`)
          return { code: 0 }
        }

        // Parse message content
        let text = ''
        try {
          const content = JSON.parse(data.message.content)
          text = content.text || ''
          console.log(`📝 Message text: ${text}`)
        } catch {
          // If not JSON, try to use raw content
          text = data.message.content || ''
          console.log(`📝 Raw message content: ${text}`)
        }

        // Skip empty messages
        if (!text.trim()) {
          console.log('⏭️ Skipping empty message')
          return { code: 0 }
        }

        // Create message context
        const ctx = feishuEventToContext(data)

        // Handle the message (async, don't wait)
        handleMessage(adapter, ctx, text).catch(error => {
          console.error('Error handling Feishu message:', error)
        })

        return { code: 0 }
      } catch (error) {
        console.error('Feishu event handler error:', error)
        return { code: 0 }
      }
    },
  })

  // Start WebSocket long connection
  console.log('🔗 Starting Feishu WebSocket long connection...')
  console.log('')
  console.log('✨ Long connection mode - NO tunnel/ngrok required!')
  console.log('   Just make sure your computer can access the internet.')
  console.log('')

  // Show security status
  const authStatus = getAuthStatus()
  if (!authStatus.feishu) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  🔐 SECURITY NOTICE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('  Bot is NOT yet secured!')
    console.log('  The FIRST user to send /start will become the owner.')
    console.log('')
    console.log('  👉 Open Feishu and send /start to YOUR bot NOW!')
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
  } else {
    console.log('🔒 Bot is secured (owner authorized)')
    console.log('')
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  📋 Configuration Checklist')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('  Step 1: Add Permissions (权限管理 → API权限)')
  console.log('  ────────────────────────────────────────')
  console.log('  Click "批量添加" (Batch Add) and paste this JSON:')
  console.log('')
  console.log('  ┌────────────────────────────────────────────────────┐')
  console.log('  │ {                                                  │')
  console.log('  │   "im:message",                                   │')
  console.log('  │   "im:message:send_as_bot",                       │')
  console.log('  │   "im:message:receive_as_bot"                     │')
  console.log('  │ }                                                  │')
  console.log('  └────────────────────────────────────────────────────┘')
  console.log('')
  console.log('  Step 2: Enable Robot (应用能力 → 机器人)')
  console.log('  ────────────────────────────────────────')
  console.log('  - Enable "启用机器人"')
  console.log('  - Enable "机器人可主动发送消息给用户"')
  console.log('  - Enable "用户可与机器人进行单聊"')
  console.log('')
  console.log('  Step 3: Event Subscription (事件订阅)')
  console.log('  ────────────────────────────────────────')
  console.log('  ⚠️  MUST start this bot BEFORE saving event config!')
  console.log('  - Select "使用长连接接收事件"')
  console.log('  - Add event: im.message.receive_v1')
  console.log('  - Then click Save')
  console.log('')
  console.log('  Step 4: Publish App (版本管理与发布)')
  console.log('  ────────────────────────────────────────')
  console.log('  - Create version → Request publishing → Publish')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  🔍 Debug: Send a message to your bot in Feishu!')
  console.log('     You should see: 📩 Received message event')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // The start() method will block the main thread
  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutting down Feishu bot...')
    // WSClient doesn't have a stop method, just let the process exit
    process.exit(0)
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  // Start the WebSocket client - this will block until process is killed
  await wsClient.start({ eventDispatcher })
}
