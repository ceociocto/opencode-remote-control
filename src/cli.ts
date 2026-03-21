#!/usr/bin/env bun
// OpenCode Remote Control - CLI entry point

import { existsSync, writeFileSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { startBot } from './telegram/bot.ts'

const CONFIG_DIR = join(homedir(), '.opencode-remote')
const CONFIG_FILE = join(CONFIG_DIR, '.env')

function printBanner() {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OpenCode Remote Control
  Control OpenCode from Telegram
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

function printHelp() {
  console.log(`
Usage: opencode-remote [command]

Commands:
  start     Start the bot (default)
  config    Configure Telegram bot token
  help      Show this help message

Examples:
  opencode-remote           # Start the bot
  opencode-remote start     # Start the bot
  opencode-remote config    # Configure token
`)
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
    let input = ''
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', (chunk) => {
      resolve(chunk.trim())
    })
  })

  return token
}

async function getConfig(): Promise<string | null> {
  // Check environment variable first
  if (process.env.TELEGRAM_BOT_TOKEN) {
    return process.env.TELEGRAM_BOT_TOKEN
  }

  // Check config file
  if (existsSync(CONFIG_FILE)) {
    const content = readFileSync(CONFIG_FILE, 'utf-8')
    const match = content.match(/TELEGRAM_BOT_TOKEN=(.+)/)
    if (match) {
      return match[1].trim()
    }
  }

  // Check local .env
  const localEnv = join(process.cwd(), '.env')
  if (existsSync(localEnv)) {
    const content = readFileSync(localEnv, 'utf-8')
    const match = content.match(/TELEGRAM_BOT_TOKEN=(.+)/)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

async function saveConfig(token: string) {
  // Create config directory if needed
  if (!existsSync(CONFIG_DIR)) {
    const { mkdirSync } = await import('fs')
    mkdirSync(CONFIG_DIR, { recursive: true })
  }

  writeFileSync(CONFIG_FILE, `TELEGRAM_BOT_TOKEN=${token}\n`)
  console.log(`\n✅ Token saved to ${CONFIG_FILE}`)
}

async function runConfig() {
  printBanner()
  const token = await promptToken()

  if (!token || token === 'your_bot_token_here') {
    console.log('\n❌ Invalid token. Please try again.')
    process.exit(1)
  }

  await saveConfig(token)
  console.log('\n🚀 Ready! Run `opencode-remote` to start the bot.')
}

async function runStart() {
  printBanner()

  const token = await getConfig()

  if (!token) {
    console.log('⚠️  No bot token configured.\n')
    await runConfig()
    return
  }

  // Set token in environment
  process.env.TELEGRAM_BOT_TOKEN = token

  console.log('🚀 Starting bot...\n')

  try {
    await startBot()
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
