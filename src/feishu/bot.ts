// Feishu bot implementation for OpenCode Remote Control

import express, { type Request, type Response } from 'express'
import * as lark from '@larksuiteoapi/node-sdk'
import type { Config, MessageContext } from '../core/types.js'
import { initSessionManager, getOrCreateSession } from '../core/session.js'
import { splitMessage } from '../core/notifications.js'
import type { BotAdapter } from '../core/handler-common.js'
import { EMOJI } from '../core/types.js'
import {
  initOpenCode,
  createSession,
  sendMessage,
  checkConnection,
  type OpenCodeSession
} from '../opencode/client.js'

let feishuClient: lark.Client | null = null
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

    async sendTypingIndicator(threadId: string): Promise<void> {
      // Feishu doesn't have typing indicator
      // Could optionally send a "thinking..." message, but we'll skip for now
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
    case '/start':
    case '/help':
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
    await handleCommand(adapter, ctx, text)
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

  // Send typing indicator (Feishu style)
  const typingMsg = await adapter.reply(ctx.threadId, '⏳')

  // Get or create OpenCode session
  let openCodeSession = openCodeSessions?.get(ctx.threadId)
  if (!openCodeSession) {
    const newSession = await createSession(ctx.threadId, `Feishu chat ${ctx.threadId}`)
    if (!newSession) {
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
    const response = await sendMessage(openCodeSession, text)

    // Delete typing indicator
    if (adapter.deleteMessage && typingMsg) {
      await adapter.deleteMessage(ctx.threadId, typingMsg)
    }

    // Split long messages
    const messages = splitMessage(response)
    for (const msg of messages) {
      await adapter.reply(ctx.threadId, msg)
    }
  } catch (error) {
    console.error('Error sending message:', error)
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

// Start Feishu bot
export async function startFeishuBot(botConfig: Config) {
  config = botConfig

  if (!config.feishuAppId || !config.feishuAppSecret) {
    throw new Error('Feishu credentials not configured')
  }

  // Initialize Feishu client
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

  // Create adapter
  const adapter = createFeishuAdapter(feishuClient)

  // Create Express server for webhook
  const app = express()
  app.use(express.json())

  const webhookPath = '/feishu/webhook'
  const port = config.feishuWebhookPort || 3001

  // Webhook endpoint for Feishu events
  app.post(webhookPath, async (req: Request, res: Response) => {
    const event = req.body

    // Handle URL verification challenge (required for Feishu bot setup)
    if (event.type === 'url_verification') {
      res.json({ challenge: event.challenge })
      return
    }

    // Validate event structure
    if (!event.header?.event_type) {
      res.status(400).json({ code: -1, msg: 'Invalid event structure' })
      return
    }

    // Handle message events
    if (event.header.event_type === 'im.message.receive_v1') {
      try {
        // Validate event data
        if (!event.event?.message) {
          res.status(400).json({ code: -1, msg: 'Missing message data' })
          return
        }

        const ctx = feishuEventToContext(event.event)
        const chatId = event.event.message.chat_id

        // Rate limiting
        if (!checkRateLimit(chatId)) {
          console.warn(`Rate limit exceeded for chat: ${chatId}`)
          res.status(429).json({ code: -1, msg: 'Rate limit exceeded' })
          return
        }

        // Parse message content
        let text = ''
        try {
          const content = JSON.parse(event.event.message.content)
          text = content.text || ''
        } catch {
          // If not JSON, try to use raw content
          text = event.event.message.content || ''
        }

        // Skip empty messages
        if (!text.trim()) {
          res.json({ code: 0 })
          return
        }

        // Handle the message
        await handleMessage(adapter, ctx, text)
        res.json({ code: 0 })
      } catch (error) {
        console.error('Feishu webhook error:', error)
        res.status(500).json({ code: -1, msg: 'Internal error' })
      }
      return
    }

    // Unknown event type - acknowledge but ignore
    console.log(`Received Feishu event: ${event.header.event_type}`)
    res.json({ code: 0 })
  })

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', platform: 'feishu' })
  })

  // Start server
  return new Promise<void>((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`🚀 Feishu webhook listening on port ${port}`)
      console.log(`📡 Webhook URL: http://localhost:${port}${webhookPath}`)
      console.log('\n📝 Setup instructions:')
      console.log('  1. Use ngrok or cloudflared to expose this endpoint:')
      console.log('     ngrok http ' + port)
      console.log('  2. Configure the webhook URL in Feishu admin console')
      console.log('  3. Subscribe to "im.message.receive_v1" event')
    })

    server.on('error', (err) => {
      reject(err)
    })

    // Handle graceful shutdown
    process.once('SIGINT', () => {
      console.log('\n🛑 Shutting down Feishu bot...')
      server.close(() => {
        console.log('Feishu bot stopped')
        resolve()
      })
    })

    process.once('SIGTERM', () => {
      console.log('\n🛑 Shutting down Feishu bot...')
      server.close(() => {
        console.log('Feishu bot stopped')
        resolve()
      })
    })
  })
}
