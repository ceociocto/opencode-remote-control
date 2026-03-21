// Mock OpenCode SDK for testing

import type { Session, ApprovalRequest, FileChange } from '../../src/core/types.ts'

export interface MockOpenCodeClient {
  createSession(options: { threadId: string }): Promise<{ id: string }>
  getSession(id: string): Promise<{ id: string; lastActivity: number } | null>
  sendMessage(sessionId: string, message: string): AsyncGenerator<string>
  onPermissionRequested(callback: (request: ApprovalRequest) => void): void
  respondToPermission(requestId: string, approved: boolean): Promise<void>
}

// Mock scenarios
export function mockSuccessSession(): MockOpenCodeClient {
  return {
    async createSession(options) {
      return { id: `session-${options.threadId}` }
    },

    async getSession(id) {
      return { id, lastActivity: Date.now() }
    },

    async *sendMessage(sessionId, message) {
      // Simulate streaming response
      const response = `I understand you want to: ${message}\n\nLet me help you with that.`
      for (let i = 0; i < response.length; i += 10) {
        yield response.slice(i, i + 10)
        await new Promise(r => setTimeout(r, 50))
      }
    },

    onPermissionRequested() {
      // No permissions needed in success scenario
    },

    async respondToPermission() {
      // No-op
    }
  }
}

export function mockPermissionRequired(): MockOpenCodeClient {
  const pendingRequests: Map<string, ApprovalRequest> = new Map()
  let permissionCallback: ((request: ApprovalRequest) => void) | null = null

  return {
    async createSession(options) {
      return { id: `session-${options.threadId}` }
    },

    async getSession(id) {
      return { id, lastActivity: Date.now() }
    },

    async *sendMessage(sessionId, message) {
      yield `Processing: ${message}...\n\n`

      // Trigger permission request
      const request: ApprovalRequest = {
        id: crypto.randomUUID(),
        type: 'file_edit',
        description: 'Edit files as requested',
        files: [
          { path: 'src/example.ts', additions: 10, deletions: 3 }
        ],
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
      }

      pendingRequests.set(request.id, request)

      if (permissionCallback) {
        permissionCallback(request)
      }

      yield '📝 Waiting for approval...'
    },

    onPermissionRequested(callback) {
      permissionCallback = callback
    },

    async respondToPermission(requestId, approved) {
      const request = pendingRequests.get(requestId)
      if (!request) {
        throw new Error('Request not found')
      }
      pendingRequests.delete(requestId)
      // In real implementation, this would apply or reject the changes
    }
  }
}

export function mockError(): MockOpenCodeClient {
  return {
    async createSession() {
      throw new Error('Connection refused')
    },

    async getSession() {
      return null
    },

    async *sendMessage() {
      throw new Error('Session not found')
    },

    onPermissionRequested() {},

    async respondToPermission() {
      throw new Error('SDK offline')
    }
  }
}

export function mockTimeout(): MockOpenCodeClient {
  return {
    async createSession() {
      // Never resolves
      return new Promise(() => {})
    },

    async getSession() {
      return null
    },

    async *sendMessage() {
      // Never yields
      await new Promise(() => {})
    },

    onPermissionRequested() {},

    async respondToPermission() {
      await new Promise(() => {})
    }
  }
}
