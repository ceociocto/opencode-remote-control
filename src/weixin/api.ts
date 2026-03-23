/**
 * Weixin API client (based on @tencent-weixin/openclaw-weixin)
 * Simplified version without OpenClaw framework dependency.
 */

import { randomBytes } from 'node:crypto'
import { DEFAULT_BASE_URL } from './types.js'
import type {
  GetUpdatesResp,
  SendMessageReq,
  SendTypingReq,
  WeixinMessage
} from './types.js'

import type { StatusResponse } from './types.js'

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

export interface WeixinApiClient {
  baseUrl: string
  token?: string
  timeoutMs?: number
  longPollTimeoutMs?: number
}

// Build headers
function buildHeaders(body: string, token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'AuthorizationType': 'ilink_bot_token',
    'Content-Length': String(Buffer.byteLength(body, 'utf-8')),
    'X-WECHAT-UIN': randomWechatUin(),
  }

  if (token?.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`
  }

  return headers
}

// Random X-WECHAT-UIN header
function randomWechatUin(): string {
  const uint32 = randomBytes(4).readUInt32BE(0)
  return Buffer.from(String(uint32), 'utf-8').toString('base64')
}

// Ensure URL has trailing slash
function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

// Generic fetch wrapper
async function apiFetch(params: {
  baseUrl: string
  endpoint: string
  body: string
  token?: string
  timeoutMs: number
  label: string
}): Promise<string> {
  const base = ensureTrailingSlash(params.baseUrl)
  const url = new URL(params.endpoint, base)
  const headers = buildHeaders(params.body, params.token)

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), params.timeoutMs)

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: params.body,
      signal: controller.signal,
    })
    clearTimeout(t)

    const rawText = await res.text()

    if (!res.ok) {
    throw new Error(`${params.label} ${res.status}: ${rawText}`)
    }

    return rawText
  } catch (err) {
    clearTimeout(t)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Login APIs
// ---------------------------------------------------------------------------

/**
 * Fetch QR code for login
 */
export async function fetchQRCode(
  baseUrl: string = DEFAULT_BASE_URL,
  botType: string = '3'
): Promise<{ qrcode: string; qrcode_img_content: string }> {
  const base = ensureTrailingSlash(baseUrl)
  const url = new URL(`ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(botType)}`, base)

  const res = await fetch(url.toString())

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)')
    throw new Error(`Failed to fetch QR code: ${res.status} ${res.statusText}`)
  }

  return await res.json()
}

/**
 * Poll QR code status
 */
export async function pollQRStatus(
  baseUrl: string = DEFAULT_BASE_URL,
  qrcode: string
): Promise<StatusResponse> {
  const base = ensureTrailingSlash(baseUrl)
  const url = new URL(`ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`, base)

  const headers: Record<string, string> = {
    'iLink-App-ClientVersion': '1',
  }

  const res = await fetch(url.toString(), { headers })

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)')
    throw new Error(`Failed to poll QR status: ${res.status} ${res.statusText}`)
  }

  return await res.json()
}

// ---------------------------------------------------------------------------
// Message APIs
// ---------------------------------------------------------------------------

const DEFAULT_LONG_POLL_TIMEOUT_MS = 35_000
const DEFAULT_API_TIMEOUT_MS = 15_000

/**
 * Long-poll for new messages
 */
export async function getUpdates(
  params: WeixinApiClient & { get_updates_buf?: string }
): Promise<GetUpdatesResp> {
  const timeout = params.longPollTimeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS

  try {
    const rawText = await apiFetch({
      baseUrl: params.baseUrl,
      endpoint: 'ilink/bot/getupdates',
      body: JSON.stringify({
        get_updates_buf: params.get_updates_buf ?? '',
        base_info: { channel_version: '1.0.0' },
      }),
      token: params.token,
      timeoutMs: timeout,
      label: 'getUpdates',
    })

    return JSON.parse(rawText)
  } catch (err) {
    // Long-poll timeout is normal; return empty response
    if (err instanceof Error && err.name === 'AbortError') {
    return { ret: 0, msgs: [], get_updates_buf: params.get_updates_buf }
    }
    throw err
  }
}

/**
 * Send a message
 */
export async function sendMessage(
  params: WeixinApiClient & { body: { msg: WeixinMessage } }
): Promise<{ ret?: number; errmsg?: string }> {
  const rawText = await apiFetch({
    baseUrl: params.baseUrl,
    endpoint: 'ilink/bot/sendmessage',
    body: JSON.stringify({
    ...params.body,
    base_info: { channel_version: '1.0.0' },
    }),
    token: params.token,
    timeoutMs: params.timeoutMs ?? DEFAULT_API_TIMEOUT_MS,
    label: 'sendMessage',
  })

  // Parse and return response for debugging
  try {
    const response = JSON.parse(rawText)
    console.log('[sendMessage API response]:', JSON.stringify(response))
    return response
  } catch {
    // If response is not JSON, return empty object
    console.log('[sendMessage API raw response]:', rawText)
    return {}
  }
}

/**
 * Get bot config (includes typing_ticket)
 */
export async function getConfig(
  params: WeixinApiClient & { ilinkUserId: string; contextToken?: string }
): Promise<{ ret?: number; errmsg?: string; typing_ticket?: string }> {
  const rawText = await apiFetch({
    baseUrl: params.baseUrl,
    endpoint: 'ilink/bot/getconfig',
    body: JSON.stringify({
    ilink_user_id: params.ilinkUserId,
    context_token: params.contextToken,
    base_info: { channel_version: '1.0.0' },
    }),
    token: params.token,
    timeoutMs: params.timeoutMs ?? 10_000,
    label: 'getConfig',
  })

  return JSON.parse(rawText)
}

/**
 * Send typing indicator
 */
export async function sendTyping(
  params: WeixinApiClient & { body: { ilink_user_id: string; typing_ticket: string; status: number } }
): Promise<void> {
  await apiFetch({
    baseUrl: params.baseUrl,
    endpoint: 'ilink/bot/sendtyping',
    body: JSON.stringify({
    ...params.body,
    base_info: { channel_version: '1.0.0' },
    }),
    token: params.token,
    timeoutMs: params.timeoutMs ?? 10_000,
    label: 'sendTyping',
  })
}
