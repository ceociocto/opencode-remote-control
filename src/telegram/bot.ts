// Telegram bot implementation for OpenCode Remote Control

import { Bot, Context, GrammyError } from 'grammy'
import { ParseMode } from 'grammy/parse-mode'
import type { Update } from 'grammy/types'
import { loadConfig, EMOJI } from '../core/types.ts'
import { initSessionManager, getOrCreateSession } from '../core/session.ts'
import { createHandler } from '../core/handler-common.ts'

const config = loadConfig()

// Create bot instance
const bot = new Bot(config.telegramBotToken)

// Initialize session manager
initSessionManager(config)

// Create shared handler
const handler = createHandler({
  sendMessage: async (threadId: string, text: string) => {
    const [chatId, messageId] = threadId.split(':')
    await bot.api.sendMessage(Number(chatId), text, {
      parse_mode: 'HTML',
      reply_parameters: messageId ? { message_id: Number(messageId) } : undefined
    })
  },

  sendTyping: async (threadId: string) => {
    const [chatId] = threadId.split(':')
    await bot.api.sendChatAction(Number(chatId), 'typing')
  }
})

// Start command
bot.command('start', async (ctx) => {
  const threadId = `${ctx.chat!.id}:${ctx.message?.message_thread_id || ctx.message?.message_id}`
  await ctx.reply(`🚀 OpenCode Remote Control ready

💬 Send me a prompt to start coding
/help — see all commands
/status — check OpenCode connection`)
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
  const threadId = `${ctx.chat!.id}:${ctx.message?.message_thread_id || ctx.message?.message_id}`
  const session = getOrCreateSession(threadId, 'telegram')

  await ctx.reply(`✅ Connected

💬 Session: ${session.id.slice(0, 8)}
⏰ Idle: ${Math.round((Date.now() - session.lastActivity) / 1000)}s
📝 Pending approvals: ${session.pendingApprovals.length}`)
})

// Approve command
bot.command('approve', async (ctx) => {
  const threadId = `${ctx.chat!.id}:${ctx.message?.message_thread_id || ctx.message?.message_id}`
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
  const threadId = `${ctx.chat!.id}:${ctx.message?.message_thread_id || ctx.message?.message_id}`
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
  const threadId = `${ctx.chat!.id}:${ctx.message?.message_thread_id || ctx.message?.message_id}`
  const session = getOrCreateSession(threadId, 'telegram')

  session.pendingApprovals = []
  session.opencodeSessionId = undefined

  await ctx.reply('🔄 Session reset. Start fresh!')
})

// Diff command
bot.command('diff', async (ctx) => {
  const threadId = `${ctx.chat!.id}:${ctx.message?.message_thread_id || ctx.message?.message_id}`
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
  const threadId = `${ctx.chat!.id}:${ctx.message?.message_thread_id || ctx.message?.message_id}`
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

// Handle all other messages as prompts
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text

  // Skip if it's a command (already handled)
  if (text.startsWith('/')) return

  const threadId = `${ctx.chat!.id}:${ctx.message.message_thread_id || ctx.message.message_id}`
  const context = {
    platform: 'telegram' as const,
    threadId,
    userId: String(ctx.from?.id),
    messageId: String(ctx.message.message_id)
  }

  // Send typing indicator
  await ctx.api.sendChatAction(ctx.chat!.id, 'typing')

  // Get or create session
  const session = getOrCreateSession(threadId, 'telegram')

  // TODO: Send prompt to OpenCode SDK
  // For now, simulate a response
  await ctx.reply(`⏳ Thinking...`)

  // Simulate work
  setTimeout(async () => {
    await ctx.reply(`✅ Done

📄 1 file changed:
• src/example.ts (+10, -3)

💬 Reply to continue, or /files for details`)
  }, 2000)
})

// Error handling
bot.catch((err) => {
  console.error('Bot error:', err)
})

export { bot }

// Start bot function
export async function startBot() {
  if (!config.telegramBotToken) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN not set')
    console.log('Get a token from @BotFather on Telegram')
    process.exit(1)
  }

  console.log('🚀 Starting OpenCode Remote Control bot...')
  await bot.start()
}
