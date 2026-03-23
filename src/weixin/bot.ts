// Weixin bot implementation for OpenCode Remote Control
// Based on @tencent-weixin/openclaw-weixin

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'
import type { Config, MessageContext } from '../core/types.js'
import { initSessionManager, getOrCreateSession } from '../core/session.js'
import { splitMessage } from '../core/notifications.js'
import type { BotAdapter } from '../core/types.js'
import { EMOJI } from '../core/types.js'
import {
  initOpenCode,
  initFetchConfig,
  createSession,
  sendMessage as sendToOpenCode,
  checkConnection,
  type OpenCodeSession
} from '../opencode/client.js'
import {
  isAuthorized,
  hasOwner,
  claimOwnership,
  getAuthStatus
} from '../core/auth.js'
import {
  fetchQRCode,
  pollQRStatus,
  getUpdates,
  sendMessage as sendWeixinMessage,
  getConfig,
  sendTyping,
} from './api.js'
import type { WeixinCredentials } from './types.js'
import { DEFAULT_BASE_URL } from './types.js'

// Storage paths
const CONFIG_DIR = join(homedir(), '.opencode-remote')
const WEIXIN_DIR = join(CONFIG_DIR, 'weixin')
const CREDENTIALS_FILE = join(WEIXIN_DIR, 'credentials.json')

// Ensure directories exist
function ensureDirs(): void {
  if (!existsSync(WEIXIN_DIR)) {
    mkdirSync(WEIXIN_DIR, { recursive: true })
  }
}

// Load credentials
export function loadWeixinCredentials(): WeixinCredentials | null {
  ensureDirs()
  if (!existsSync(CREDENTIALS_FILE)) {
    return null
  }
  try {
    const raw = readFileSync(CREDENTIALS_FILE, 'utf-8')
    return JSON.parse(raw) as WeixinCredentials
  } catch {
    return null
  }
}

// Save credentials
export function saveWeixinCredentials(creds: WeixinCredentials): void {
  ensureDirs()
  const data: WeixinCredentials = {
    ...creds,
    savedAt: new Date().toISOString()
  }
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2), 'utf-8')
  try {
    const stat = require('fs').statSync(CREDENTIALS_FILE)
    const mode = stat.mode & 0o777
    require('fs').chmodSync(CREDENTIALS_FILE, mode | 0o600)
  } catch {
    // Ignore chmod errors
  }
}

// Map Weixin event to shared MessageContext
function weixinEventToContext(msg: any): MessageContext {
  return {
    platform: 'weixin',
    threadId: msg.from_user_id || 'unknown',
    userId: msg.from_user_id || 'unknown',
    messageId: msg.msg_id || msg.message_id?.toString(),
  }
}

// BotAdapter implementation for Weixin
function createWeixinAdapter(
  baseUrl: string,
  token: string,
  botId: string
): BotAdapter & {
  updateMessage: (threadId: string, messageId: string, text: string) => Promise<void>
  deleteMessage: (threadId: string, messageId: string) => Promise<void>
  contextTokens: Map<string, string>
  typingTickets: Map<string, string>
} {
  // Cache context tokens and typing tickets per user
  const contextTokens: Map<string, string> = new Map()
  const typingTickets: Map<string, string> = new Map()

  return {
    contextTokens,
    typingTickets,

    async reply(threadId: string, text: string): Promise<string> {
      const contextToken = contextTokens.get(threadId)
      console.log(`[WeixinAdapter] reply() called - threadId: ${threadId}, text length: ${text?.length ?? 0}`)
      console.log(`[WeixinAdapter] contextToken: ${contextToken ? 'present' : 'MISSING!'}`)

      if (!contextToken) {
        console.error('[WeixinAdapter] No context_token - cannot send message!')
        throw new Error('Missing context_token for Weixin reply')
      }

      try {
        // Generate client_id (unique message ID)
        const clientId = `${Date.now()}-${randomBytes(8).toString('hex')}`

        const result = await sendWeixinMessage({
          baseUrl,
          token,
          body: {
            msg: {
              from_user_id: botId,
              to_user_id: threadId,
              client_id: clientId,
              message_type: 2, // BOT
              message_state: 2, // FINISH
              context_token: contextToken,
              item_list: [{ type: 1, text_item: { text } }],
            },
          },
        })
        console.log(`[WeixinAdapter] sendMessage result:`, JSON.stringify(result))
        console.log(`[WeixinAdapter] reply() success`)
        return ''
      } catch (error) {
        console.error('[WeixinAdapter] reply() failed:', error)
        throw error
      }
    },

    async sendTypingIndicator(threadId: string): Promise<string> {
      try {
        // Get typing ticket if not cached
        let typingTicket = typingTickets.get(threadId)
        if (!typingTicket) {
          const configResp = await getConfig({
            baseUrl,
            token,
            ilinkUserId: threadId,
            contextToken: contextTokens.get(threadId),
          })
          typingTicket = configResp.typing_ticket
          if (typingTicket) {
            typingTickets.set(threadId, typingTicket)
          }
        }

        if (typingTicket) {
          await sendTyping({
            baseUrl,
            token,
            body: {
              ilink_user_id: threadId,
              typing_ticket: typingTicket,
            status: 1, // TYPING
            },
          })
        }
        return ''
      } catch (error) {
        console.error('Failed to send typing indicator:', error)
        return ''
      }
    },

    async updateMessage(threadId: string, messageId: string, text: string): Promise<void> {
      // Weixin doesn't support message updates, so We send a new message instead
      await this.reply(threadId, text)
    },

    async deleteMessage(threadId: string, messageId: string): Promise<void> {
      // Weixin doesn't support message deletion
    },
  }
}

// Command handler (mirrors Telegram/Feishu bot structure)
async function handleCommand(
  adapter: BotAdapter,
  ctx: MessageContext,
  text: string,
  openCodeSessions: Map<string, OpenCodeSession>
): Promise<void> {
  const session = getOrCreateSession(ctx.threadId, 'weixin')
  const parts = text.split(/\s+/)
  const command = parts[0].toLowerCase()

  switch (command) {
    case '/start': {
      const result = claimOwnership('weixin', ctx.userId)
      if (result.success) {
        if (result.message === 'claimed') {
          await adapter.reply(ctx.threadId, `🔐 **Security Setup Complete!**

✅ You are now the authorized owner of this bot.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  **IMPORTANT SECURITY NOTICE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Only YOU can control OpenCode through this bot.
Other users will be blocked automatically.

Your Weixin ID: \`${ctx.userId}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 **Ready to use!**
💬 Send me a prompt to start coding
/help — see all commands
/status — check OpenCode connection`)
        } else {
          await adapter.reply(ctx.threadId, `🚀 OpenCode Remote Control ready

💬 Send me a prompt to start coding
/help — see all commands
/status — check OpenCode connection`)
        }
      } else {
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
        break
      }
      session.pendingApprovals.shift()
      await adapter.reply(ctx.threadId, '✅ Approved — changes applied')
      break
    }

    case '/reject': {
      const pending = session.pendingApprovals[0]
      if (!pending) {
        await adapter.reply(ctx.threadId, '🤷 Nothing to reject right now')
        break
      }
      session.pendingApprovals.shift()
      await adapter.reply(ctx.threadId, '❌ Rejected — changes discarded')
      break
    }

    case '/diff': {
      const pending = session.pendingApprovals[0]
      if (!pending?.files?.length) {
        await adapter.reply(ctx.threadId, '📄 No pending changes to show')
        break
      }
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
      if (!pending?.files?.length) {
        await adapter.reply(ctx.threadId, '📄 No files changed in this session')
        break
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
        `${openCodeConnected ? '✅' : '❌'} Connected

💬 Session: ${openCodeSession?.sessionId?.slice(0, 8) || 'none'}
⏰ Idle: ${idleSeconds}s
📝 Pending approvals: ${pendingCount}`
      )
      break
    }

    case '/reset': {
      session.pendingApprovals = []
      session.opencodeSessionId = undefined
      openCodeSessions?.delete(ctx.threadId)
      await adapter.reply(ctx.threadId, '🔄 Session reset. Start fresh!')
      break
    }

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

// Handle incoming message from Weixin
async function handleMessage(
  adapter: BotAdapter,
  ctx: MessageContext,
  text: string,
  openCodeSessions: Map<string, OpenCodeSession>
): Promise<void> {
  const session = getOrCreateSession(ctx.threadId, 'weixin')

  // Check if it's a command
  if (text.startsWith('/')) {
    await handleCommand(adapter, ctx, text, openCodeSessions)
    return
  }

  // Authorization check for non-command messages
  if (!isAuthorized('weixin', ctx.userId)) {
    if (!hasOwner('weixin')) {
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
  await adapter.sendTypingIndicator(ctx.threadId)

  // Get or create OpenCode session
  let openCodeSession = openCodeSessions.get(ctx.threadId)
  if (!openCodeSession) {
    const newSession = await createSession(ctx.threadId, `Weixin chat ${ctx.threadId}`)
    if (!newSession) {
      await adapter.reply(ctx.threadId, '❌ Failed to create OpenCode session')
      return
    }
    openCodeSession = newSession
    openCodeSessions.set(ctx.threadId, openCodeSession)
    session.opencodeSessionId = openCodeSession.sessionId

    // Share the session URL (only if sharing is enabled)
    if (openCodeSession.shareUrl) {
      await adapter.reply(ctx.threadId, `🔗 Session: ${openCodeSession.shareUrl}`)
    }
  }

  try {
    console.log('🤖 Sending to OpenCode...')
    const response = await sendToOpenCode(openCodeSession, text, {
      onTextDelta: () => {}, // Weixin doesn't support streaming updates well
      onStatusChange: (status) => {
        if (status.type === 'idle') {
          console.log('✅ OpenCode idle')
        }
      },
    })
    console.log('✅ Got response from OpenCode, length:', response?.length ?? 0)

    if (!response) {
      console.log('⚠️ Empty response from OpenCode')
      await adapter.reply(ctx.threadId, '⚠️ OpenCode returned empty response')
      return
    }

    // Split long messages
    const messages = splitMessage(response)
    console.log(`📤 Sending ${messages.length} message(s) to Weixin...`)
    for (let i = 0; i < messages.length; i++) {
      console.log(`📤 Sending message ${i + 1}/${messages.length} (${messages[i].length} chars)`)
      await adapter.reply(ctx.threadId, messages[i])
      console.log(`✅ Message ${i + 1} sent`)
    }
  } catch (error) {
    console.error('❌ Error in message flow:', error)
    await adapter.reply(ctx.threadId, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Login with QR code
export async function loginWithQR(
  baseUrl: string = DEFAULT_BASE_URL,
  onQRCode?: (qrUrl: string) => void
): Promise<WeixinCredentials | null> {
  console.log('Starting Weixin login with QR code...')

  try {
    // Fetch QR code
    const qrResp = await fetchQRCode(baseUrl)

    if (!qrResp.qrcode_img_content) {
      console.error('Failed to get QR code URL')
      return null
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  📱 Weixin Login')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('  Scan the QR code with your WeChat app to login.')
    console.log('')

    // Show QR code URL
    console.log(`  QR Code URL: ${qrResp.qrcode_img_content}`)
    console.log('')

    // Callback for QR code
    if (onQRCode) {
      onQRCode(qrResp.qrcode_img_content)
    }

    // Poll for status
    const startTime = Date.now()
    const timeout = 8 * 60 * 1000 // 8 minutes

    while (Date.now() - startTime < timeout) {
      const status = await pollQRStatus(baseUrl, qrResp.qrcode)

      switch (status.status) {
        case 'wait':
          process.stdout.write('.')
          break

        case 'scaned':
          console.log('\n👀 QR code scanned! Please confirm on your phone...')
          break

        case 'expired':
          console.log('\n⏳ QR code expired. Please try again.')
          return null

        case 'confirmed':
          if (!status.bot_token || !status.ilink_bot_id) {
            console.error('\n❌ Login confirmed but missing credentials')
            return null
          }

          console.log('\n✅ Login successful!')

          const credentials: WeixinCredentials = {
            token: status.bot_token,
            baseUrl: status.baseurl || baseUrl,
            accountId: status.ilink_bot_id,
            userId: status.ilink_user_id,
          }

          // Save credentials
          saveWeixinCredentials(credentials)

          return credentials
      }

      // Wait 1 second before next poll
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log('\n⏰ Login timed out. Please try again.')
    return null
  } catch (error) {
    console.error('Login error:', error)
    return null
  }
}

// Start Weixin bot
export async function startWeixinBot(botConfig: Config): Promise<void> {
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  OpenCode Remote Control - Weixin')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // Initialize fetch config (proxy, timeouts) before any network requests
  try {
    await initFetchConfig()
  } catch (err) {
    console.warn('⚠️ Failed to configure fetch:', err)
  }

  // Load credentials
  let credentials = loadWeixinCredentials()

  if (!credentials) {
    console.log('📝 No saved credentials. Starting login flow...')
    console.log('')

    // Use Weixin API base URL, not OpenCode server URL
    const weixinBaseUrl = botConfig.weixinBaseUrl || DEFAULT_BASE_URL
    credentials = await loginWithQR(weixinBaseUrl)

    if (!credentials) {
      console.error('❌ Login failed')
      process.exit(1)
    }
  }

  console.log(`✅ Using account: ${credentials.accountId}`)

  const baseUrl = credentials.baseUrl || DEFAULT_BASE_URL
  const token = credentials.token
  const botId = credentials.accountId  // Bot's ilink_bot_id

  // Initialize session manager
  initSessionManager(botConfig)

  // Initialize OpenCode sessions map
  const openCodeSessions = new Map<string, OpenCodeSession>()

  // Create adapter
  const adapter = createWeixinAdapter(baseUrl, token, botId)

  // Initialize OpenCode
  console.log('🔧 Initializing OpenCode...')
  try {
    await initOpenCode()
    console.log('✅ OpenCode ready')
  } catch (error) {
    console.error('❌ Failed to initialize OpenCode:', error)
    console.log('Make sure OpenCode is running')
  }

  console.log('🚀 Starting Weixin message polling...')

  // Show security status
  const authStatus = getAuthStatus()
  if (!authStatus.weixin) {
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  🔐 SECURITY NOTICE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('  Bot is NOT yet secured!')
    console.log('  The FIRST user to send /start will become the owner.')
    console.log('')
    console.log('  👉 Send /start to YOUR bot in WeChat NOW!')
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } else {
    console.log('🔒 Bot is secured (owner authorized)')
  }

  console.log('')

  // Track running state
  let running = true

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutting down Weixin bot...')
    running = false
    console.log('Weixin bot stopped')
    process.exit(0)
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  // Start message polling loop
  let getUpdatesBuf = ''

  console.log('🔄 Polling for messages...')

  while (running) {
    try {
    const resp = await getUpdates({
      baseUrl,
      token,
      get_updates_buf: getUpdatesBuf,
      longPollTimeoutMs: 35_000,
    })

    if (resp.get_updates_buf) {
      getUpdatesBuf = resp.get_updates_buf
    }

    const msgs = resp.msgs || []

    for (const msg of msgs) {
      // Only process USER messages (type 1)
      if (msg.message_type !== 1) continue

      // Skip messages without text
      const textItem = msg.item_list?.find((item: any) => item.type === 1)
      if (!textItem?.text_item?.text) continue

      const text = textItem.text_item.text
      const fromUserId = msg.from_user_id

      if (!fromUserId || !text) continue

      console.log(`📩 Message from ${fromUserId}: ${text.substring(0, 50)}...`)

      // Update context token if provided
      if (msg.context_token) {
        adapter.contextTokens.set(fromUserId, msg.context_token)
      }

      // Create message context
      const ctx: MessageContext = {
        platform: 'weixin',
        threadId: fromUserId,
        userId: fromUserId,
        messageId: msg.message_id?.toString(),
      }

      // Handle the message
      handleMessage(adapter, ctx, text, openCodeSessions).catch(error => {
        console.error('Error handling Weixin message:', error)
      })
    }
    } catch (error) {
    console.error('Polling error:', error)
    // Wait a bit before retrying
    await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}
