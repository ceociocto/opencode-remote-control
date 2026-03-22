// Authorization management for OpenCode Remote Control
// First user to send /start becomes the owner automatically

interface AuthState {
  telegramOwner: string | null
  feishuOwner: string | null
}

const authState: AuthState = {
  telegramOwner: null,
  feishuOwner: null,
}

// Auth file path for persistence
import { homedir } from 'os'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

const AUTH_DIR = join(homedir(), '.opencode-remote')
const AUTH_FILE = join(AUTH_DIR, 'auth.json')

function ensureAuthDir() {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true })
  }
}

function loadAuth(): void {
  try {
    if (existsSync(AUTH_FILE)) {
      const data = JSON.parse(readFileSync(AUTH_FILE, 'utf-8'))
      authState.telegramOwner = data.telegramOwner || null
      authState.feishuOwner = data.feishuOwner || null
    }
  } catch (error) {
    console.warn('Failed to load auth state, starting fresh:', error)
  }
}

function saveAuth(): void {
  try {
    ensureAuthDir()
    writeFileSync(AUTH_FILE, JSON.stringify(authState, null, 2))
  } catch (error) {
    console.error('Failed to save auth state:', error)
  }
}

// Initialize on module load
loadAuth()

export function isAuthorized(platform: 'telegram' | 'feishu', userId: string): boolean {
  if (platform === 'telegram') {
    return authState.telegramOwner === userId
  } else {
    return authState.feishuOwner === userId
  }
}

export function hasOwner(platform: 'telegram' | 'feishu'): boolean {
  if (platform === 'telegram') {
    return authState.telegramOwner !== null
  } else {
    return authState.feishuOwner !== null
  }
}

export function claimOwnership(platform: 'telegram' | 'feishu', userId: string): { success: boolean; message: string } {
  if (platform === 'telegram') {
    if (authState.telegramOwner) {
      if (authState.telegramOwner === userId) {
        return { success: true, message: 'already_owner' }
      }
      return { success: false, message: 'already_claimed' }
    }
    authState.telegramOwner = userId
    saveAuth()
    return { success: true, message: 'claimed' }
  } else {
    if (authState.feishuOwner) {
      if (authState.feishuOwner === userId) {
        return { success: true, message: 'already_owner' }
      }
      return { success: false, message: 'already_claimed' }
    }
    authState.feishuOwner = userId
    saveAuth()
    return { success: true, message: 'claimed' }
  }
}

export function getOwner(platform: 'telegram' | 'feishu'): string | null {
  if (platform === 'telegram') {
    return authState.telegramOwner
  } else {
    return authState.feishuOwner
  }
}

// For debugging/display
export function getAuthStatus(): { telegram: boolean; feishu: boolean } {
  return {
    telegram: authState.telegramOwner !== null,
    feishu: authState.feishuOwner !== null,
  }
}
