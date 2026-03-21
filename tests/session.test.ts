// Tests for session management

import { describe, test, expect, beforeEach } from 'bun:test'
import { getOrCreateSession, getSession, deleteSession, _getSessionsMap } from '../src/core/session.ts'

describe('Session Manager', () => {
  beforeEach(() => {
    // Clear all sessions before each test
    const sessions = _getSessionsMap()
    sessions.clear()
  })

  test('creates new session for new thread', () => {
    const session = getOrCreateSession('thread-123', 'telegram')

    expect(session.threadId).toBe('thread-123')
    expect(session.platform).toBe('telegram')
    expect(session.id).toBeDefined()
    expect(session.pendingApprovals).toEqual([])
  })

  test('returns existing session for same thread', () => {
    const session1 = getOrCreateSession('thread-123', 'telegram')
    const session2 = getOrCreateSession('thread-123', 'telegram')

    expect(session1.id).toBe(session2.id)
    expect(session2.lastActivity).toBeGreaterThanOrEqual(session1.lastActivity)
  })

  test('creates separate sessions for different threads', () => {
    const session1 = getOrCreateSession('thread-123', 'telegram')
    const session2 = getOrCreateSession('thread-456', 'telegram')

    expect(session1.id).not.toBe(session2.id)
    expect(session1.threadId).toBe('thread-123')
    expect(session2.threadId).toBe('thread-456')
  })

  test('getSession returns undefined for non-existent thread', () => {
    const session = getSession('non-existent')
    expect(session).toBeUndefined()
  })

  test('deleteSession removes session', () => {
    getOrCreateSession('thread-123', 'telegram')

    const deleted = deleteSession('thread-123')
    expect(deleted).toBe(true)

    const session = getSession('thread-123')
    expect(session).toBeUndefined()
  })

  test('deleteSession returns false for non-existent thread', () => {
    const deleted = deleteSession('non-existent')
    expect(deleted).toBe(false)
  })
})
