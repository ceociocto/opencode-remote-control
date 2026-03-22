// Shared handler logic for OpenCode Remote Control

import type { Session, MessageContext, ApprovalRequest, FileChange } from './types.js'
import { getOrCreateSession } from './session.js'
import { createApprovalRequest, waitForApproval, formatApprovalMessage } from './approval.js'
import { TEMPLATES, splitMessage } from './notifications.js'

export interface BotAdapter {
  reply(threadId: string, text: string): Promise<void>
  sendTypingIndicator(threadId: string): Promise<void>
  onApprovalNeeded?: (threadId: string, message: string) => Promise<void>
}

export function createHandler(deps: BotAdapter) {
  return {
    // Handle incoming message from user
    async handleMessage(
      ctx: MessageContext,
      text: string
    ): Promise<void> {
        const session = getOrCreateSession(ctx.threadId, ctx.platform)

        // Check if it's a command
        if (text.startsWith('/')) {
          await this.handleCommand(ctx, text, session)
          return
        }

        // It's a prompt - send to OpenCode
        await deps.sendTypingIndicator(ctx.threadId)

        // TODO: Actually send to OpenCode SDK
        // For now, echo back
        await deps.reply(ctx.threadId, TEMPLATES.thinking())

        // Simulate response
        setTimeout(async () => {
          await deps.reply(ctx.threadId, TEMPLATES.taskCompleted([
            { path: 'src/example.ts', additions: 10, deletions: 2 }
          ]))
        }, 1000)
      },

      // Handle commands
      async handleCommand(
        ctx: MessageContext,
        text: string,
        session: Session
      ): Promise<void> {
        const parts = text.split(/\s+/)
        const command = parts[0].toLowerCase()

        switch (command) {
          case '/start':
          case '/help':
            await deps.reply(ctx.threadId, TEMPLATES.botStarted())
            break

          case '/approve':
            await this.handleApprove(ctx, session)
            break

          case '/reject':
            await this.handleReject(ctx, session)
            break

          case '/diff':
            await this.handleDiff(ctx, session)
            break

          case '/files':
            await this.handleFiles(ctx, session)
            break

          case '/status':
            await deps.reply(ctx.threadId,
              `✅ Connected\n\n💬 Session: ${session.id.slice(0, 8)}\n⏰ Idle: ${Math.round((Date.now() - session.lastActivity) / 1000)}s`
            )
            break

          case '/reset':
            session.pendingApprovals = []
            session.opencodeSessionId = undefined
            await deps.reply(ctx.threadId, '🔄 Session reset. Start fresh!')
            break

          default:
            await deps.reply(ctx.threadId,
              `${EMOJI.WARNING} Unknown command: ${command}\n\nTry /help`
            )
        }
      },

      // Handle /approve
      async handleApprove(ctx: MessageContext, session: Session): Promise<void> {
        const pending = session.pendingApprovals[0]
        if (!pending) {
          await deps.reply(ctx.threadId, '🤷 Nothing to approve right now')
          return
        }

        // Resolve the approval
        // TODO: Actually apply changes via OpenCode SDK
        await deps.reply(ctx.threadId, TEMPLATES.approved())
      },

      // Handle /reject
      async handleReject(ctx: MessageContext, session: Session): Promise<void> {
        const pending = session.pendingApprovals[0]
        if (!pending) {
          await deps.reply(ctx.threadId, '🤷 Nothing to reject right now')
          return
        }

        session.pendingApprovals.shift()
        await deps.reply(ctx.threadId, TEMPLATES.rejected())
      },

      // Handle /diff
      async handleDiff(ctx: MessageContext, session: Session): Promise<void> {
        const pending = session.pendingApprovals[0]
        if (!pending || !pending.files?.length) {
          await deps.reply(ctx.threadId, '📄 No pending changes to show')
          return
        }

        // TODO: Get actual diff from OpenCode SDK
        const diffPreview = pending.files.map(f =>
          `--- a/${f.path}\n+++ b/${f.path}\n@@ changes +${f.additions} +${f.deletions} @@`
        ).join('\n')

        const messages = splitMessage(`\`\`\`diff\n${diffPreview}\n\`\`\``)
        for (const msg of messages) {
          await deps.reply(ctx.threadId, msg)
        }
      },

      // Handle /files
      async handleFiles(ctx: MessageContext, session: Session): Promise<void> {
        const pending = session.pendingApprovals[0]
        if (!pending || !pending.files?.length) {
          await deps.reply(ctx.threadId, '📄 No files changed in this session')
          return
        }

        const fileList = pending.files.map(f =>
          `• ${f.path} (+${f.additions}, -${f.deletions})`
        ).join('\n')

        await deps.reply(ctx.threadId, `📄 Changed files:\n${fileList}`)
      },

      // Request approval from user
      async requestApproval(
        ctx: MessageContext,
        session: Session,
        type: 'file_edit' | 'shell_command',
        data: { files?: FileChange[]; command?: string; description: string }
      ): Promise<boolean> {
        const request = createApprovalRequest(session, type, data)
        const message = formatApprovalMessage(request)

        await deps.reply(ctx.threadId, message)

        // Wait for user response
        return waitForApproval(request)
      }
    }
}

// Re-export emoji for use in handlers
import { EMOJI } from './types.js'
