// OpenCode Remote Control - Main entry point

import { startBot } from './telegram/bot.ts'

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  OpenCode Remote Control')
console.log('  Control OpenCode from Telegram or Feishu')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

// Start the bot
startBot().catch((err) => {
  console.error('Failed to start bot:', err)
  process.exit(1)
})
