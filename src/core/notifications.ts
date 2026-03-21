// Notification formatting for OpenCode Remote Control

import { EMOJI } from './types.ts'

export interface NotificationOptions {
  type: 'success' | 'error' | 'loading' | 'input_needed' | 'expired' | 'started'
  title?: string
  details?: string
  files?: Array<{ path: string; additions: number; deletions: number }>
  actions?: string[]
}

export function formatNotification(options: NotificationOptions): string {
  const lines: string[] = []

  // Status indicator
  switch (options.type) {
    case 'success':
      lines.push(`${EMOJI.SUCCESS} ${options.title || 'Done'}`)
      break
    case 'error':
      lines.push(`${EMOJI.ERROR} ${options.title || 'Error'}`)
      break
    case 'loading':
      lines.push(`${EMOJI.LOADING} ${options.title || 'Thinking...'}`)
      break
    case 'input_needed':
      lines.push(`${EMOJI.QUESTION} ${options.title || 'Question'}`)
      break
    case 'expired':
      lines.push(`${EMOJI.EXPIRED} ${options.title || 'Session expired'}`)
      break
    case 'started':
      lines.push(`${EMOJI.START} ${options.title || 'Ready'}`)
      break
  }

  // Add blank line if we have more content
  if (options.details || options.files || options.actions) {
    lines.push('')
  }

  // Files changed
  if (options.files && options.files.length > 0) {
    lines.push(`📄 ${options.files.length} files changed:`)
    for (const file of options.files.slice(0, 5)) {
      lines.push(`• ${file.path} (+${file.additions}, -${file.deletions})`)
    }
    if (options.files.length > 5) {
      lines.push(`• ... and ${options.files.length - 5} more`)
    }
  }

  // Details
  if (options.details) {
    lines.push(options.details)
  }

  // Actions
  if (options.actions && options.actions.length > 0) {
    lines.push('')
    lines.push(options.actions.join(' • '))
  }

  return lines.join('\n')
}

// Pre-built message templates
export const TEMPLATES = {
  botStarted: () => formatNotification({
    type: 'started',
    title: 'OpenCode Remote Control ready',
    actions: ['💬 Send a prompt to start', '/help — commands', '/status — connection']
  }),

  sessionExpired: () => formatNotification({
    type: 'expired',
    title: 'Session expired (30 min idle)',
    actions: ['💬 Send new message to start fresh']
  }),

  taskCompleted: (files: Array<{ path: string; additions: number; deletions: number }>) =>
    formatNotification({
      type: 'success',
      files,
      actions: ['💬 Reply to continue', '/files — details']
    }),

  taskFailed: (error: string) =>
    formatNotification({
      type: 'error',
      title: error.slice(0, 50),
      details: 'The task failed. OpenCode is still running.',
      actions: ['💬 Try rephrasing', '/reset — start fresh']
    }),

  needsInput: (question: string, options?: string[]) =>
    formatNotification({
      type: 'input_needed',
      title: question,
      details: options ? options.map((o, i) => `${i + 1}. ${o}`).join('\n') : undefined,
      actions: options ? ['Reply with number'] : undefined
    }),

  openCodeOffline: () =>
    formatNotification({
      type: 'error',
      title: 'OpenCode is offline',
      details: 'Cannot connect to OpenCode server.',
      actions: ['🔄 /retry — check again', '/status — diagnostics']
    }),

  thinking: () =>
    formatNotification({
      type: 'loading',
        title: 'Thinking...'
    }),

  approved: () => formatNotification({
    type: 'success',
    title: 'Approved — changes applied'
  }),

  rejected: () => formatNotification({
    type: 'success',
    title: 'Rejected — changes discarded'
  }),

  approvalTimeout: () => formatNotification({
    type: 'error',
    title: 'Approval timed out (5 min)',
    details: 'Changes were automatically rejected.',
  }),
}

// Split message for Telegram's 4096 char limit
export function splitMessage(text: string, maxLength = 4000): string[] {
  if (text.length <= maxLength) {
    return [text]
  }

  const messages: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      messages.push(remaining)
      break
    }

    // Find a good break point
    let breakPoint = remaining.lastIndexOf('\n', maxLength)
    if (breakPoint < maxLength * 0.5) {
      breakPoint = remaining.lastIndexOf(' ', maxLength)
    }
    if (breakPoint < maxLength * 0.5) {
      breakPoint = maxLength
    }

    messages.push(remaining.slice(0, breakPoint))
    remaining = remaining.slice(breakPoint).trim()
  }

  // Add continuation indicator
  if (messages.length > 1) {
    for (let i = 0; i < messages.length - 1; i++) {
      messages[i] += '\n\n... (continued)'
    }
  }

  return messages
}
