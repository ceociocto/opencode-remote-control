// Core types for OpenCode Remote Control

export interface Session {
  id: string
  threadId: string
  platform: 'telegram' | 'feishu'
  createdAt: number
  lastActivity: number
  opencodeSessionId?: string
  pendingApprovals: ApprovalRequest[]
}

export interface ApprovalRequest {
  id: string
  type: 'file_edit' | 'shell_command'
  description: string
  files?: FileChange[]
  command?: string
  createdAt: number
  expiresAt: number
}

export interface FileChange {
  path: string
  additions: number
  deletions: number
}

export interface MessageContext {
  platform: 'telegram' | 'feishu'
  threadId: string
  userId: string
  messageId?: string
}

// Message templates - emoji vocabulary
export const EMOJI = {
  SUCCESS: '✅',
  ERROR: '❌',
  LOADING: '⏳',
  THINKING: '🤔',
  APPROVAL: '📝',
  FILES: '📄',
  CODE: '🔧',
  START: '🚀',
  EXPIRED: '💤',
  WARNING: '⚠️',
  QUESTION: '💬',
} as const

// Configuration
export interface Config {
  // Telegram config (optional)
  telegramBotToken?: string
  // Feishu config (optional)
  feishuAppId?: string
  feishuAppSecret?: string
  feishuEncryptKey?: string
  feishuVerificationToken?: string
  feishuWebhookPort?: number
  // OpenCode config
  opencodeServerUrl: string
  tunnelUrl: string
  sessionIdleTimeoutMs: number
  cleanupIntervalMs: number
  approvalTimeoutMs: number
}

export function loadConfig(): Config {
  return {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
    feishuAppId: process.env.FEISHU_APP_ID || undefined,
    feishuAppSecret: process.env.FEISHU_APP_SECRET || undefined,
    feishuEncryptKey: process.env.FEISHU_ENCRYPT_KEY,
    feishuVerificationToken: process.env.FEISHU_VERIFICATION_TOKEN,
    feishuWebhookPort: parseInt(process.env.FEISHU_WEBHOOK_PORT || '3001', 10),
    opencodeServerUrl: process.env.OPENCODE_SERVER_URL || 'http://localhost:3000',
    tunnelUrl: process.env.TUNNEL_URL || '',
    sessionIdleTimeoutMs: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || '1800000', 10),
    cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '300000', 10),
    approvalTimeoutMs: parseInt(process.env.APPROVAL_TIMEOUT_MS || '300000', 10),
  }
}

// Bot adapter interface for shared command handlers
export interface BotAdapter {
  reply(threadId: string, text: string): Promise<void>
  sendTypingIndicator(threadId: string): Promise<void>
}
