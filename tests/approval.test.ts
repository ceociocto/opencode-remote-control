// Tests for approval workflow

import { describe, test, expect, beforeEach } from 'bun:test'
import { getOrCreateSession, _getSessionsMap } from '../src/core/session.ts'
import {
  createApprovalRequest,
  getPendingApproval,
  resolveApproval,
  formatApprovalMessage
} from '../src/core/approval.ts'

describe('Approval Workflow', () => {
  beforeEach(() => {
    _getSessionsMap().clear()
  })

  test('creates file edit approval request', () => {
    const session = getOrCreateSession('thread-123', 'telegram')
    const request = createApprovalRequest(session, 'file_edit', {
      description: 'Edit config file',
      files: [
        { path: 'config.json', additions: 5, deletions: 2 }
      ]
    })

    expect(request.id).toBeDefined()
    expect(request.type).toBe('file_edit')
    expect(request.files).toHaveLength(1)
    expect(session.pendingApprovals).toHaveLength(1)
  })

  test('creates shell command approval request', () => {
    const session = getOrCreateSession('thread-123', 'telegram')
    const request = createApprovalRequest(session, 'shell_command', {
      description: 'Install dependencies',
      command: 'npm install'
    })

    expect(request.type).toBe('shell_command')
    expect(request.command).toBe('npm install')
  })

  test('getPendingApproval returns first pending request', () => {
    const session = getOrCreateSession('thread-123', 'telegram')
    const request1 = createApprovalRequest(session, 'file_edit', {
      description: 'First edit',
      files: [{ path: 'a.ts', additions: 1, deletions: 0 }]
    })
    createApprovalRequest(session, 'file_edit', {
      description: 'Second edit',
      files: [{ path: 'b.ts', additions: 1, deletions: 0 }]
    })

    const pending = getPendingApproval(session)
    expect(pending?.id).toBe(request1.id)
  })

  test('resolveApproval removes approved request', () => {
    const session = getOrCreateSession('thread-123', 'telegram')
    const request = createApprovalRequest(session, 'file_edit', {
      description: 'Edit',
      files: [{ path: 'x.ts', additions: 1, deletions: 0 }]
    })

    const result = resolveApproval(session, request.id, true)

    expect(result.success).toBe(true)
    expect(session.pendingApprovals).toHaveLength(0)
  })

  test('resolveApproval fails for expired request', () => {
    const session = getOrCreateSession('thread-123', 'telegram')
    const request = createApprovalRequest(session, 'file_edit', {
      description: 'Edit',
      files: [{ path: 'x.ts', additions: 1, deletions: 0 }]
    })

    // Manually expire the request
    request.expiresAt = Date.now() - 1000

    const result = resolveApproval(session, request.id, true)

    expect(result.success).toBe(false)
    expect(result.error).toContain('expired')
  })

  test('formatApprovalMessage includes all commands', () => {
    const session = getOrCreateSession('thread-123', 'telegram')
    const request = createApprovalRequest(session, 'file_edit', {
      description: 'Edit',
      files: [
        { path: 'src/auth.ts', additions: 10, deletions: 3 }
      ]
    })

    const message = formatApprovalMessage(request)

    expect(message).toContain('/approve')
    expect(message).toContain('/reject')
    expect(message).toContain('/diff')
    expect(message).toContain('src/auth.ts')
  })
})
