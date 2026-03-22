// Telegram bot implementation for OpenCode Remote Control

import { Bot } from 'grammy'
import { loadConfig, type Config } from '../core/types.js'
import { initSessionManager, getOrCreateSession } from '../core/session.js'
import { splitMessage } from '../core/notifications.js'
import {
  initOpenCode,
  createSession,
  sendMessage,
  checkConnection,
  type OpenCodeSession,
  type StreamCallbacks
} from '../opencode/client.js'
import {
  isAuthorized,
  hasOwner,
  claimOwnership,
  getAuthStatus
} from '../core/auth.js'

// Lazy initialization - bot is only created when startBot() is called
let config: Config | null = null
let bot: Bot | null = null
let openCodeSessions: Map<string, OpenCodeSession> | null = null

// Helper to get thread ID
function getThreadId(ctx: any): string {
  const chatId = ctx.chat?.id
  const threadId = ctx.message?.message_thread_id || ctx.message?.message_id
  return `${chatId}:${threadId}`
}

// Setup bot commands
function setupBotCommands(bot: Bot, openCodeSessions: Map<string, OpenCodeSession>) {
// Start command
bot.command('start', async (ctx) => {
  const userId = String(ctx.from?.id)
  const result = claimOwnership('telegram', userId)

  if (result.success) {
    if (result.message === 'claimed') {
      await ctx.reply(`🔐 **Security Setup Complete!**

✅ You are now the authorized owner of this bot.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  **IMPORTANT SECURITY NOTICE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Only YOU can control OpenCode through this bot.
Other users will be blocked automatically.

Your Telegram ID: \`${userId}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 **Ready to use!**
💬 Send me a prompt to start coding
/help — see all commands
/status — check OpenCode connection`, { parse_mode: 'Markdown' })
    } else {
      // Already owner
      await ctx.reply(`🚀 OpenCode Remote Control ready

💬 Send me a prompt to start coding
/help — see all commands
/status — check OpenCode connection`)
    }
  } else {
    // Already claimed by someone else
    await ctx.reply(`🚫 **Access Denied**

This bot is already secured by another user.

If you are the owner, check your configuration.`, { parse_mode: 'Markdown' })
  }
})

// Help command
bot.command('help', async (ctx) => {
  await ctx.reply(`📖 Commands

/start — Start bot
/status — Check connection
/reset — Reset session
/approve — Approve pending changes
/reject — Reject pending changes
/diff — See full diff
/files — List changed files

💬 Anything else is treated as a prompt for OpenCode!`)
})

// Status command
bot.command('status', async (ctx) => {
  const threadId = getThreadId(ctx)
  const session = getOrCreateSession(threadId, 'telegram')
  const openCodeSession = openCodeSessions.get(threadId)

  // Check OpenCode connection
  const connected = await checkConnection()

  if (!connected) {
    await ctx.reply(`❌ OpenCode is offline

Cannot connect to OpenCode server.

🔄 /retry — check again`)
    return
  }

  const idleSeconds = Math.round((Date.now() - session.lastActivity) / 1000)
  const pendingCount = session.pendingApprovals.length

  await ctx.reply(`✅ Connected

💬 Session: ${openCodeSession?.sessionId?.slice(0, 8) || 'none'}
⏰ Idle: ${idleSeconds}s
📝 Pending approvals: ${pendingCount}`)
})

// Approve command
bot.command('approve', async (ctx) => {
  const threadId = getThreadId(ctx)
  const session = getOrCreateSession(threadId, 'telegram')

  if (session.pendingApprovals.length === 0) {
    await ctx.reply('🤷 Nothing to approve right now')
    return
  }

  // Remove first pending approval
  session.pendingApprovals.shift()
  await ctx.reply('✅ Approved — changes applied')
})

// Reject command
bot.command('reject', async (ctx) => {
  const threadId = getThreadId(ctx)
  const session = getOrCreateSession(threadId, 'telegram')

  if (session.pendingApprovals.length === 0) {
    await ctx.reply('🤷 Nothing to reject right now')
    return
  }

  session.pendingApprovals.shift()
  await ctx.reply('❌ Rejected — changes discarded')
})

// Reset command
bot.command('reset', async (ctx) => {
  const threadId = getThreadId(ctx)
  const session = getOrCreateSession(threadId, 'telegram')

  session.pendingApprovals = []
  session.opencodeSessionId = undefined

  // Clear OpenCode session
  openCodeSessions.delete(threadId)

  await ctx.reply('🔄 Session reset. Start fresh!')
})

// Diff command
bot.command('diff', async (ctx) => {
  const threadId = getThreadId(ctx)
  const session = getOrCreateSession(threadId, 'telegram')

  const pending = session.pendingApprovals[0]
  if (!pending?.files?.length) {
    await ctx.reply('📄 No pending changes to show')
    return
  }

  // Show file list with changes
  const fileList = pending.files.map(f =>
    `• ${f.path} (+${f.additions}, -${f.deletions})`
  ).join('\n')

  await ctx.reply(`📄 Pending changes:\n\n${fileList}\n\n💬 /approve or /reject`)
})

// Files command
bot.command('files', async (ctx) => {
  const threadId = getThreadId(ctx)
  const session = getOrCreateSession(threadId, 'telegram')

  const pending = session.pendingApprovals[0]
  if (!pending?.files?.length) {
    await ctx.reply('📄 No files changed in this session')
    return
  }

  const fileList = pending.files.map(f =>
    `• ${f.path} (+${f.additions}, -${f.deletions})`
  ).join('\n')

  await ctx.reply(`📄 Changed files:\n\n${fileList}`)
})

// Retry command
bot.command('retry', async (ctx) => {
  const connected = await checkConnection()

  if (connected) {
    await ctx.reply('✅ OpenCode is now online!')
  } else {
    await ctx.reply('❌ Still offline. Is OpenCode running?')
  }
})

// Handle all other messages as prompts
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text
  const userId = String(ctx.from?.id)

  // Skip if it's a command (already handled)
  if (text.startsWith('/')) return

  // Authorization check
  if (!isAuthorized('telegram', userId)) {
    if (!hasOwner('telegram')) {
      await ctx.reply(`🔐 **Authorization Required**

This bot is not yet secured.

Please send /start to claim ownership first.`, { parse_mode: 'Markdown' })
    } else {
      await ctx.reply(`🚫 **Access Denied**

You are not authorized to use this bot.` , { parse_mode: 'Markdown' })
    }
    return
  }

  const threadId = getThreadId(ctx)

  // Send typing indicator
  await ctx.api.sendChatAction(ctx.chat!.id, 'typing')

  // Get or create session
  const session = getOrCreateSession(threadId, 'telegram')

  // Check OpenCode connection
  const connected = await checkConnection()
  if (!connected) {
    await ctx.reply(`❌ OpenCode is offline

Cannot connect to OpenCode server.

🔄 /retry — check again`)
    return
  }

  // Get or create OpenCode session
  let openCodeSession = openCodeSessions.get(threadId)
  if (!openCodeSession) {
    // Keep typing indicator while creating session
    const newSession = await createSession(threadId, `Telegram thread ${threadId}`)
    if (!newSession) {
      await ctx.reply('❌ Failed to create OpenCode session')
      return
    }
    openCodeSession = newSession

    openCodeSessions.set(threadId, openCodeSession)
    session.opencodeSessionId = openCodeSession.sessionId

    // Share the session URL (only if sharing is enabled)
    if (openCodeSession.shareUrl) {
      await ctx.reply(`🔗 Session: ${openCodeSession.shareUrl}`)
    }
  }

  // Setup continuous typing indicator
  // Telegram's typing status only lasts ~5 seconds, so we need to keep sending it
  let typingInterval: NodeJS.Timeout | null = null
  let isComplete = false

  const startTypingIndicator = () => {
    // Send initial typing action
    ctx.api.sendChatAction(ctx.chat!.id, 'typing').catch(() => {})

    // Keep sending typing action every 4 seconds
    typingInterval = setInterval(() => {
      if (!isComplete) {
        ctx.api.sendChatAction(ctx.chat!.id, 'typing').catch(() => {})
      }
    }, 4000)
  }

  const stopTypingIndicator = () => {
    isComplete = true
    if (typingInterval) {
      clearInterval(typingInterval)
      typingInterval = null
    }
  }

  // Start typing indicator
  startTypingIndicator()

  try {
    const response = await sendMessage(openCodeSession, text, {
      onStatusChange: (status) => {
        // Stop typing when session becomes idle
        if (status.type === 'idle') {
          stopTypingIndicator()
        }
      }
    })

    // Make sure typing is stopped
    stopTypingIndicator()

    // Split long messages
    const messages = splitMessage(response)
    for (const msg of messages) {
      await ctx.reply(msg)
    }
  } catch (error) {
    // Make sure typing is stopped on error
    stopTypingIndicator()
    console.error('Error sending message:', error)
    await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

// Error handling
bot.catch((err) => {
  console.error('Bot error:', err)
})

} // End of setupBotCommands

// Start bot function - initializes everything lazily
export async function startBot() {
  // Load config
  config = loadConfig()

  if (!config.telegramBotToken || config.telegramBotToken === 'your_bot_token_here') {
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  ❌ Telegram Bot Token not configured')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('  To get your bot token:')
    console.log('')
    console.log('  1. Open Telegram app')
    console.log('  2. Search for @BotFather')
    console.log('  3. Send: /newbot')
    console.log('  4. Follow the instructions to create your bot')
    console.log('  5. Copy the token (looks like: 123456789:ABCdef...)')
    console.log('')
    console.log('  Then run: opencode-remote config')
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    process.exit(1)
  }

  // Show banner
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  OpenCode Remote Control')
  console.log('  Control OpenCode from Telegram')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // Create bot instance
  bot = new Bot(config.telegramBotToken)

  // Initialize session manager
  initSessionManager(config)

  // Initialize OpenCode sessions map
  openCodeSessions = new Map<string, OpenCodeSession>()

  // Setup bot commands
  setupBotCommands(bot, openCodeSessions)

  // Initialize OpenCode
  console.log('🔧 Initializing OpenCode...')
  try {
    await initOpenCode()
    console.log('✅ OpenCode ready')
  } catch (error) {
    console.error('❌ Failed to initialize OpenCode:', error)
    console.log('Make sure OpenCode is running')
  }

  console.log('🚀 Starting Telegram bot...')

  // Show security status
  const authStatus = getAuthStatus()
  if (!authStatus.telegram) {
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  🔐 SECURITY NOTICE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('  Bot is NOT yet secured!')
    console.log('  The FIRST user to send /start will become the owner.')
    console.log('')
    console.log('  👉 Open Telegram and send /start to YOUR bot NOW!')
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } else {
    console.log('🔒 Bot is secured (owner authorized)')
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down Telegram bot...')
    if (bot) {
      await bot.stop()
    }
    console.log('Telegram bot stopped')
  }

  process.once('SIGINT', async () => {
    await shutdown()
  })

  process.once('SIGTERM', async () => {
    await shutdown()
  })

  await bot.start()
}
