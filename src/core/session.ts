// Session management for OpenCode Remote Control

import type { Session, Config } from './types.js'
import { loadConfig } from './types.js'

const sessions = new Map<string, Session>()

let cleanupTimer: ReturnType<typeof setInterval> | null = null

export function initSessionManager(config: Config = loadConfig()) {
  // Start cleanup timer
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
  }

  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [threadId, session] of sessions.entries()) {
      if (now - session.lastActivity > config.sessionIdleTimeoutMs) {
        sessions.delete(threadId)
        console.log(`Session expired: ${threadId}`)
      }
    }
  }, config.cleanupIntervalMs)

  console.log(`Session manager initialized (cleanup every ${config.cleanupIntervalMs / 1000}s)`)
}

export function getOrCreateSession(
  threadId: string,
  platform: 'telegram' | 'feishu' | 'weixin'
): Session {
  const existing = sessions.get(threadId)
  if (existing) {
    existing.lastActivity = Date.now()
    return existing
  }

  const newSession: Session = {
    id: crypto.randomUUID(),
    threadId,
    platform,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    pendingApprovals: [],
  }

  sessions.set(threadId, newSession)
  console.log(`Session created: ${threadId}`)
  return newSession
}

export function getSession(threadId: string): Session | undefined {
  return sessions.get(threadId)
}

export function updateSession(threadId: string, updates: Partial<Session>): Session | undefined {
  const session = sessions.get(threadId)
  if (!session) return undefined

  Object.assign(session, updates, { lastActivity: Date.now() })
  return session
}

export function deleteSession(threadId: string): boolean {
  return sessions.delete(threadId)
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values())
}

export function getSessionCount(): number {
  return sessions.size
}

// Export sessions map for testing
export function _getSessionsMap(): Map<string, Session> {
  return sessions
}
