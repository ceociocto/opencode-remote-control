#!/usr/bin/env node
// OpenCode Remote Control - CLI entry point

import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { startBot } from './telegram/bot.js'
import { startFeishuBot } from './feishu/bot.js'
import type { Config } from './core/types.js'

const CONFIG_DIR = join(homedir(), '.opencode-remote')
const CONFIG_FILE = join(CONFIG_DIR, '.env')

function printBanner() {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OpenCode Remote Control
  Control OpenCode from Telegram or Feishu
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

function printHelp() {
  console.log(`
Usage: opencode-remote [command]

Commands:
  start              Start all configured bots (default)
  telegram           Start Telegram bot only
  feishu             Start Feishu bot only
  config             Configure a channel (interactive selection)
  help               Show this help message

Examples:
  opencode-remote              # Start all bots
  opencode-remote start        # Start all bots
  opencode-remote telegram     # Start Telegram only
  opencode-remote feishu       # Start Feishu only
  opencode-remote config       # Interactive channel selection
`)
}

async function promptChannel(): Promise<'telegram' | 'feishu'> {
  console.log('\n📝 Select a channel to configure:')
  console.log('')
  console.log('  1. Telegram')
  console.log('  2. Feishu (飞书)')
  console.log('')

  process.stdout.write('Enter your choice (1 or 2): ')

  const choice = await new Promise<string>((resolve) => {
    process.stdin.setEncoding('utf8')

    const cleanup = () => {
      process.stdin.pause()
      process.removeListener('SIGINT', onSigint)
    }

    const onSigint = () => {
      cleanup()
      console.log('\nCancelled')
      process.exit(0)
    }

    process.once('SIGINT', onSigint)

    process.stdin.once('data', (chunk) => {
      cleanup()
      resolve(chunk.toString().trim())
    })
  })

  if (choice === '1' || choice.toLowerCase() === 'telegram') {
    return 'telegram'
  } else if (choice === '2' || choice.toLowerCase() === 'feishu') {
    return 'feishu'
  }

  // Default to telegram if invalid input
  console.log('Invalid choice, defaulting to Telegram')
  return 'telegram'
}

async function promptToken(): Promise<string> {
  console.log('\n📝 Setup required: Telegram Bot Token')
  console.log('\nHow to get a token:')
  console.log('  1. Open Telegram')
  console.log('  2. Search @BotFather')
  console.log('  3. Send /newbot and follow instructions')
  console.log('  4. Copy the token you receive')
  console.log('')

  process.stdout.write('Enter your bot token: ')

  // Read from stdin
  const token = await new Promise<string>((resolve) => {
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const cleanup = () => {
      process.stdin.pause()
      process.removeListener('SIGINT', onSigint)
    }

    const onSigint = () => {
      cleanup()
      console.log('\nCancelled')
      process.exit(0)
    }

    process.once('SIGINT', onSigint)

    process.stdin.once('data', (chunk) => {
      cleanup()
      resolve(chunk.toString().trim())
    })
  })

  if (!token) {
    console.log('\nCancelled')
    process.exit(0)
  }

  return token
}

async function promptFeishuConfig(): Promise<{ appId: string; appSecret: string }> {
  console.log('\n📝 Step 1: Create Feishu App')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('  1. Go to https://open.feishu.cn/app')
  console.log('  2. Click "创建企业自建应用" (Create enterprise app)')
  console.log('  3. Fill in app name and description')
  console.log('  4. Go to "凭证与基础信息" (Credentials) page')
  console.log('')

  const promptInput = async (promptText: string): Promise<string> => {
    process.stdout.write(promptText)

    return new Promise<string>((resolve) => {
      process.stdin.resume()
      process.stdin.setEncoding('utf8')

      const cleanup = () => {
        process.stdin.pause()
        process.removeListener('SIGINT', onSigint)
      }

      const onSigint = () => {
        cleanup()
        console.log('\nCancelled')
        process.exit(0)
      }

      process.once('SIGINT', onSigint)

      process.stdin.once('data', (chunk) => {
        cleanup()
        resolve(chunk.toString().trim())
      })
    })
  }

  const appId = await promptInput('Enter your App ID: ')

  if (!appId) {
    console.log('\nCancelled')
    process.exit(0)
  }

  const appSecret = await promptInput('Enter your App Secret: ')

  if (!appSecret) {
    console.log('\nCancelled')
    process.exit(0)
  }

  return { appId, appSecret }
}

function showFeishuSetupGuide(): void {
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  📋 Step 2: Configure App Permissions')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('  Go to "权限管理" (Permission Management) page')
  console.log('  Search and enable these permissions:')
  console.log('')
  console.log('  ┌────────────────────────────────────────────────────┐')
  console.log('  │ Permission                              │ Scope    │')
  console.log('  ├────────────────────────────────────────────────────┤')
  console.log('  │ im:message                      获取与发送消息  │')
  console.log('  │ im:message:send_as_bot          以应用身份发消息 │')
  console.log('  │ im:message:receive_as_bot       接收机器人消息   │')
  console.log('  └────────────────────────────────────────────────────┘')
  console.log('')
  console.log('  💡 TIP: Copy the JSON below and use "批量添加" feature:')
  console.log('')
  console.log('  ┌────────────────────────────────────────────────────┐')
  console.log('  │ [')
  console.log('  │   "im:message",')
  console.log('  │   "im:message:send_as_bot",')
  console.log('  │   "im:message:receive_as_bot"')
  console.log('  │ ]')
  console.log('  └────────────────────────────────────────────────────┘')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  🤖 Step 3: Enable Robot Capability')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('  1. Go to "应用能力" (App Capabilities) → "机器人" (Robot)')
  console.log('  2. Click "启用机器人" (Enable Robot)')
  console.log('  3. Set robot name and description')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  🔗 Step 4: Configure Event Subscription')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('  1. Start the bot locally:')
  console.log('     $ opencode-remote feishu')
  console.log('')
  console.log('  2. Expose webhook with ngrok/cloudflared:')
  console.log('     $ ngrok http 3001')
  console.log('')
  console.log('  3. Go to "事件订阅" (Event Subscription) page')
  console.log('  4. Set Request URL: https://your-ngrok-url/feishu/webhook')
  console.log('  5. Add event: im.message.receive_v1')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  📤 Step 5: Publish App')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('  1. Go to "版本管理与发布" (Version & Publish)')
  console.log('  2. Click "创建版本" (Create Version)')
  console.log('  3. Fill in version info and submit for review')
  console.log('  4. After approval, click "发布" (Publish)')
  console.log('  5. Search your bot in Feishu and start chatting!')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

async function getConfig(): Promise<Config> {
  const config: Config = {
    opencodeServerUrl: process.env.OPENCODE_SERVER_URL || 'http://localhost:3000',
    tunnelUrl: process.env.TUNNEL_URL || '',
    sessionIdleTimeoutMs: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || '1800000', 10),
    cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '300000', 10),
    approvalTimeoutMs: parseInt(process.env.APPROVAL_TIMEOUT_MS || '300000', 10),
  }

  // Check config file
  if (existsSync(CONFIG_FILE)) {
    const content = readFileSync(CONFIG_FILE, 'utf-8')

    // Parse Telegram token
    const telegramMatch = content.match(/TELEGRAM_BOT_TOKEN=(.+)/)
    if (telegramMatch) {
      const token = telegramMatch[1].trim()
      if (token && token !== 'your_bot_token_here') {
        config.telegramBotToken = token
      }
    }

    // Parse Feishu config
    const feishuAppIdMatch = content.match(/FEISHU_APP_ID=(.+)/)
    if (feishuAppIdMatch) {
      config.feishuAppId = feishuAppIdMatch[1].trim()
    }
    const feishuSecretMatch = content.match(/FEISHU_APP_SECRET=(.+)/)
    if (feishuSecretMatch) {
      config.feishuAppSecret = feishuSecretMatch[1].trim()
    }
  }

  // Check environment variables
  if (process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    config.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN.trim()
  }
  if (process.env.FEISHU_APP_ID?.trim()) {
    config.feishuAppId = process.env.FEISHU_APP_ID.trim()
  }
  if (process.env.FEISHU_APP_SECRET?.trim()) {
    config.feishuAppSecret = process.env.FEISHU_APP_SECRET.trim()
  }

  // Check local .env
  const localEnv = join(process.cwd(), '.env')
  if (existsSync(localEnv)) {
    const content = readFileSync(localEnv, 'utf-8')

    const telegramMatch = content.match(/TELEGRAM_BOT_TOKEN=(.+)/)
    if (telegramMatch) {
      const token = telegramMatch[1].trim()
      if (token && token !== 'your_bot_token_here' && !config.telegramBotToken) {
        config.telegramBotToken = token
      }
    }

    const feishuAppIdMatch = content.match(/FEISHU_APP_ID=(.+)/)
    if (feishuAppIdMatch) {
      config.feishuAppId = feishuAppIdMatch[1].trim()
    }

    const feishuSecretMatch = content.match(/FEISHU_APP_SECRET=(.+)/)
    if (feishuSecretMatch) {
      config.feishuAppSecret = feishuSecretMatch[1].trim()
    }
  }

  return config
}

async function saveConfig(token: string) {
  // Create config directory if needed
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }

  // Read existing config
  let existing = ''
  if (existsSync(CONFIG_FILE)) {
    existing = readFileSync(CONFIG_FILE, 'utf-8')
  }

  // Add or update Telegram token
  const lines = existing.split('\n').filter(line => !line.startsWith('TELEGRAM_BOT_TOKEN='))
  lines.push(`TELEGRAM_BOT_TOKEN=${token}`)

  writeFileSync(CONFIG_FILE, lines.join('\n'))
  console.log(`\n✅ Token saved to ${CONFIG_FILE}`)
}

async function saveFeishuConfig(appId: string, appSecret: string) {
  // Create config directory if needed
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }

  // Read existing config
  let existing = ''
  if (existsSync(CONFIG_FILE)) {
    existing = readFileSync(CONFIG_FILE, 'utf-8')
  }

  // Filter out old Feishu config
  const lines = existing.split('\n').filter(line =>
    !line.startsWith('FEISHU_APP_ID=') &&
    !line.startsWith('FEISHU_APP_SECRET=')
  )

  // Add new Feishu config
  lines.push(`FEISHU_APP_ID=${appId}`)
  lines.push(`FEISHU_APP_SECRET=${appSecret}`)

  writeFileSync(CONFIG_FILE, lines.join('\n'))
  console.log(`\n✅ Feishu config saved to ${CONFIG_FILE}`)

  // Show setup guide
  showFeishuSetupGuide()
}

async function runConfig() {
  printBanner()

  // Let user select channel
  const channel = await promptChannel()

  if (channel === 'telegram') {
    const token = await promptToken()

    if (!token || token === 'your_bot_token_here') {
      console.log('\n❌ Invalid token. Please try again.')
      process.exit(1)
    }

    await saveConfig(token)
    console.log('\n🚀 Ready! Run `opencode-remote` to start the bot.')
  } else {
    const { appId, appSecret } = await promptFeishuConfig()

    if (!appId || !appSecret) {
      console.log('\n❌ Invalid credentials. Please try again.')
      process.exit(1)
    }

    await saveFeishuConfig(appId, appSecret)
    console.log('\n🚀 Ready! Run `opencode-remote feishu` to start the Feishu bot.')
  }

  process.exit(0)
}

function hasTelegramConfig(config: Config): boolean {
  return !!(config.telegramBotToken?.trim())
}

function hasFeishuConfig(config: Config): boolean {
  return !!(
    config.feishuAppId?.trim() &&
    config.feishuAppSecret?.trim()
  )
}

async function runStart() {
  const config = await getConfig()

  printBanner()

  // Check what's configured
  const hasTelegram = hasTelegramConfig(config)
  const hasFeishu = hasFeishuConfig(config)

  if (!hasTelegram && !hasFeishu) {
    console.log('❌ No bots configured!')
    console.log('\nRun: opencode-remote config')
    process.exit(1)
  }

  // Track shutdown state
  let isShuttingDown = false

  // Handle graceful shutdown at CLI level
  const handleShutdown = () => {
    if (isShuttingDown) return
    isShuttingDown = true
    console.log('\n🛑 Shutting down...')
    // The individual bots will handle their own cleanup via their SIGINT handlers
    // We just need to ensure the process exits
    setTimeout(() => {
      console.log('Goodbye!')
      process.exit(0)
    }, 1000)
  }

  process.once('SIGINT', handleShutdown)
  process.once('SIGTERM', handleShutdown)

  // Start bots
  const promises = []

  if (hasTelegram) {
    console.log('🤖 Starting Telegram bot...')
    process.env.TELEGRAM_BOT_TOKEN = config.telegramBotToken
    promises.push(
      startBot().catch((err) => {
        console.error('Telegram bot failed:', err)
        return { status: 'rejected', reason: err }
      })
    )
  }

  if (hasFeishu) {
    console.log('🤖 Starting Feishu bot...')
    promises.push(
      startFeishuBot(config).catch((err) => {
        console.error('Feishu bot failed:', err)
        return { status: 'rejected', reason: err }
      })
    )
  }

  // Wait for all bots
  const results = await Promise.allSettled(promises)

  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length > 0) {
    console.log(`\n⚠️ ${failed.length} bot(s) failed to start`)
    process.exit(1)
  }

  console.log('\n✅ All bots started!')
}

async function runTelegramOnly() {
  const config = await getConfig()

  if (!hasTelegramConfig(config)) {
    console.log('❌ Telegram bot not configured!')
    console.log('\nRun: opencode-remote config')
    process.exit(1)
  }

  printBanner()
  console.log('🤖 Starting Telegram bot...')

  process.env.TELEGRAM_BOT_TOKEN = config.telegramBotToken!

  try {
    await startBot()
  } catch (error) {
    console.error('Failed to start:', error)
    process.exit(1)
  }
}

async function runFeishuOnly() {
  const config = await getConfig()

  if (!hasFeishuConfig(config)) {
    console.log('❌ Feishu bot not configured!')
    console.log('\nRun: opencode-remote config')
    process.exit(1)
  }

  printBanner()
  console.log('🤖 Starting Feishu bot...')

  try {
    await startFeishuBot(config)
  } catch (error) {
    console.error('Failed to start:', error)
    process.exit(1)
  }
}

// Main CLI
const args = process.argv.slice(2)
const command = args[0] || 'start'

switch (command) {
  case 'start':
    runStart()
    break
  case 'telegram':
    runTelegramOnly()
    break
  case 'feishu':
    runFeishuOnly()
    break
  case 'config':
    runConfig()
    break
  case 'help':
  case '--help':
  case '-h':
    printBanner()
    printHelp()
    break
  default:
    console.log(`Unknown command: ${command}`)
    printHelp()
    process.exit(1)
}
