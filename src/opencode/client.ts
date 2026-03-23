// OpenCode SDK client for remote control

import '../patch_spawn.js'
import { createRequire } from 'node:module'
import { platform } from 'node:os'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const require = createRequire(import.meta.url)
const childProcess = require('node:child_process')

type OpenCodeInstance = Awaited<ReturnType<typeof import('@opencode-ai/sdk').createOpencode>>

// Config file path (same as cli.ts)
const CONFIG_DIR = join(homedir(), '.opencode-remote')
const CONFIG_FILE = join(CONFIG_DIR, '.env')

// Global proxy URL - set via CLI --proxy or environment variables
let globalProxyUrl: string | null = null

/**
 * Set the global proxy URL for all HTTP/HTTPS requests.
 * Supports HTTP and HTTPS proxy protocols.
 */
export function setGlobalProxy(proxyUrl: string): void {
  globalProxyUrl = proxyUrl
  console.log(`🌐 Proxy configured: ${proxyUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`)
}

/**
 * Get the current proxy URL.
 * Priority: explicitly set > HTTPS_PROXY > HTTP_PROXY > ALL_PROXY
 */
export function getProxyUrl(): string | null {
  if (globalProxyUrl) return globalProxyUrl

  // Check environment variables in order of priority
  // For HTTPS requests, HTTPS_PROXY takes precedence
  // For HTTP requests, HTTP_PROXY takes precedence
  // ALL_PROXY is a fallback for both
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    null
  )
}

// Timeout configuration - can be customized via config file or environment variables
// Default: 30 minutes for request timeout, 1 minute for keep-alive
const DEFAULT_REQUEST_TIMEOUT_MINUTES = 30
const DEFAULT_KEEP_ALIVE_SECONDS = 60

/**
 * Read timeout setting from config file
 */
function readTimeoutFromConfig(): number | null {
  if (!existsSync(CONFIG_FILE)) return null

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8')
    const match = content.match(/OPENCODE_REQUEST_TIMEOUT_MINUTES=(\d+)/)
    if (match) {
      return parseInt(match[1], 10)
    }
  } catch {
    // Ignore read errors
  }
  return null
}

/**
 * Get request timeout in milliseconds.
 * Priority: environment variable > config file > default
 * Default: 30 minutes
 */
function getRequestTimeoutMs(): number {
  // First check environment variable
  if (process.env.OPENCODE_REQUEST_TIMEOUT_MINUTES) {
    const minutes = parseInt(process.env.OPENCODE_REQUEST_TIMEOUT_MINUTES, 10)
    if (!isNaN(minutes) && minutes > 0) {
      return minutes * 60 * 1000
    }
  }

  // Then check config file
  const configValue = readTimeoutFromConfig()
  if (configValue !== null && configValue > 0) {
    return configValue * 60 * 1000
  }

  // Fall back to default
  return DEFAULT_REQUEST_TIMEOUT_MINUTES * 60 * 1000
}

/**
 * Get keep-alive timeout in milliseconds.
 * Set via OPENCODE_KEEP_ALIVE_SECONDS environment variable.
 * Default: 60 seconds
 */
function getKeepAliveMs(): number {
  const seconds = parseInt(
    process.env.OPENCODE_KEEP_ALIVE_SECONDS || String(DEFAULT_KEEP_ALIVE_SECONDS),
    10
  )
  return seconds * 1000
}

/**
 * Configure undici global dispatcher with proper timeouts.
 * This fixes the default 5-minute timeout issue.
 * Must be called before any fetch requests are made.
 */
async function configureGlobalDispatcher(): Promise<void> {
  const { setGlobalDispatcher, Agent, ProxyAgent } = await import('undici')

  const proxyUrl = getProxyUrl()
  const requestTimeoutMs = getRequestTimeoutMs()
  const keepAliveMs = getKeepAliveMs()

  if (proxyUrl) {
    // Use ProxyAgent for proxy connections
    const proxyAgent = new ProxyAgent({
      uri: proxyUrl,
      requestTls: {
        timeout: requestTimeoutMs,
      },
    })
    setGlobalDispatcher(proxyAgent)
    console.log(`✅ Proxy agent initialized (timeout: ${requestTimeoutMs / 60000}min)`)
  } else {
    // Use regular Agent with extended timeouts
    const agent = new Agent({
      headersTimeout: requestTimeoutMs,
      bodyTimeout: requestTimeoutMs,
      keepAliveTimeout: keepAliveMs,
      keepAliveMaxTimeout: requestTimeoutMs,
    })
    setGlobalDispatcher(agent)
    console.log(`✅ HTTP agent initialized (timeout: ${requestTimeoutMs / 60000}min)`)
  }
}

// Track if dispatcher has been configured
let dispatcherConfigured = false

/**
 * Initialize fetch with proper timeouts and proxy configuration.
 * This is now async and must be awaited.
 * Call this before making any fetch requests if you need proxy support.
 */
export async function initFetchConfig(): Promise<void> {
  if (dispatcherConfigured) return

  try {
    await configureGlobalDispatcher()
    dispatcherConfigured = true
  } catch (err) {
    console.warn('⚠️ Failed to configure HTTP dispatcher:', err)
    // Continue anyway - default timeouts will be used
  }
}

if (platform() === 'win32') {
  const originalSpawn = childProcess.spawn
  // @ts-ignore - monkey patching for Windows compatibility
  childProcess.spawn = function(command: string, args: string[], options: any = {}) {
    if (command === 'opencode' && !options.shell) {
      options.shell = true
    }
    return originalSpawn(command, args, options)
  }
}

export async function verifyOpenCodeInstalled(): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const isWindows = platform() === 'win32'
    const command = isWindows ? 'where' : 'which'
    const proc = childProcess.spawn(command, ['opencode'], { shell: isWindows })

    let output = ''
    let errorOutput = ''

    proc.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      errorOutput += chunk.toString()
    })

    proc.on('close', (code: number | null) => {
      if (code === 0 && output.trim()) {
        resolve({ ok: true })
      } else {
        resolve({
          ok: false,
          error: `OpenCode not found in PATH. Please install it first:\n  npm install -g @opencode-ai/opencode\n\nThen verify with:\n  opencode --version`
        })
      }
    })

    proc.on('error', (err: Error) => {
      resolve({
        ok: false,
        error: `Failed to check OpenCode installation: ${err.message}\n\nPlease ensure OpenCode is installed:\n  npm install -g @opencode-ai/opencode`
      })
    })
  })
}

export interface OpenCodeSession {
  sessionId: string
  client: OpenCodeInstance['client']
  server: OpenCodeInstance['server']
  shareUrl?: string
}

let opencodeInstance: OpenCodeInstance | null = null
let verificationDone = false

export async function initOpenCode(): Promise<OpenCodeInstance> {
  await initFetchConfig()
  if (opencodeInstance) {
    return opencodeInstance
  }

  if (!verificationDone) {
    verificationDone = true
    console.log('🔧 Verifying OpenCode installation...')
    const verification = await verifyOpenCodeInstalled()
    if (!verification.ok) {
      console.error('\n❌ ' + verification.error)
      throw new Error('OpenCode not found. Please install it first: npm install -g @opencode-ai/opencode')
    }
    console.log('✅ OpenCode found')
  }

  console.log('🚀 Starting OpenCode server...')
  try {
    const { createOpencode } = await import('@opencode-ai/sdk')
    opencodeInstance = await createOpencode({
      port: 0,
    })
    console.log('✅ OpenCode server ready')
  } catch (error) {
    const isWindows = platform() === 'win32'
    if (isWindows) {
      console.error('\n❌ Failed to start OpenCode server.')
      console.error('This may be a Windows compatibility issue.')
      console.error('Please ensure OpenCode is installed correctly:')
      console.error('  1. Run: npm install -g @opencode-ai/opencode')
      console.error('  2. Verify: opencode --version')
    }
    throw error
  }

  return opencodeInstance
}

export async function createSession(
  _threadId: string,
  title: string = `Remote control session`
): Promise<OpenCodeSession | null> {
  const opencode = await initOpenCode()

  try {
    const createResult = await opencode.client.session.create({
      body: { title },
    })

    if (createResult.error) {
      console.error('Failed to create session:', createResult.error)
      return null
    }

    const sessionId = createResult.data.id
    console.log(`✅ Created OpenCode session: ${sessionId}`)

    let shareUrl: string | undefined
    if (process.env.SHARE_SESSIONS === 'true') {
      const shareResult = await opencode.client.session.share({
        path: { id: sessionId }
      })

      if (!shareResult.error && shareResult.data?.share?.url) {
        shareUrl = shareResult.data.share.url
        console.log(`🔗 Session shared: ${shareUrl}`)
      }
    }

    return {
      sessionId,
      client: opencode.client,
      server: opencode.server,
      shareUrl,
    }
  } catch (error) {
    console.error('Error creating session:', error)
    return null
  }
}

// Callback types for streaming responses
export interface StreamCallbacks {
  // Called when a text delta is received (streaming text)
  onTextDelta?: (delta: string) => void
  // Called when session status changes (e.g., 'busy' -> 'idle')
  onStatusChange?: (status: { type: 'idle' } | { type: 'busy' } | { type: 'retry'; attempt: number; message: string; next: number }) => void
  // Called when any event is received
  onEvent?: (event: unknown) => void
}

// Send message with streaming support
// Returns the final response text, but calls callbacks during streaming
export async function sendMessage(
  session: OpenCodeSession,
  message: string,
  callbacks?: StreamCallbacks
): Promise<string> {
  try {
    console.log(`📝 Sending to OpenCode: ${message.slice(0, 50)}...`)

    // Subscribe to events before sending the prompt
    let eventSubscription: Awaited<ReturnType<typeof session.client.event.subscribe>> | null = null
    let fullResponseText = ''
    let isComplete = false

    // Start event subscription if callbacks are provided
    if (callbacks) {
      try {
        eventSubscription = await session.client.event.subscribe({})

        // Process events in background
        ;(async () => {
          try {
            for await (const event of eventSubscription!.stream) {
              if (isComplete) break

              // Call generic event callback
              callbacks.onEvent?.(event)

              // Handle specific event types
              const eventType = (event as any).type

              if (eventType === 'message.part.delta') {
                // Streaming text delta
                const delta = (event as any).properties?.delta || ''
                if (delta) {
                  fullResponseText += delta
                  callbacks.onTextDelta?.(delta)
                }
              } else if (eventType === 'session.status') {
                // Session status change
                const status = (event as any).properties?.status
                if (status) {
                  callbacks.onStatusChange?.(status)
                  // If session becomes idle, we're done
                  if (status.type === 'idle') {
                    isComplete = true
                  }
                }
              } else if (eventType === 'session.idle') {
                // Session is idle - processing complete
                isComplete = true
              }
            }
          } catch (err) {
            console.error('Event stream error:', err)
          }
        })()
      } catch (err) {
        console.error('Failed to subscribe to events:', err)
      }
    }

    // Send the prompt
    const result = await session.client.session.prompt({
      path: { id: session.sessionId },
      body: {
        parts: [{ type: 'text', text: message }]
      },
    })

    if (result.error) {
      console.error('Failed to send message:', result.error)
      // Clean up event subscription
      isComplete = true
      return `❌ Error: ${(result.error as any).message || 'Failed to send message'}`
    }

    const response = result.data

    const responseText =
      (response as any).info?.content ||
      (response as any).parts
        ?.filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('\n') ||
      fullResponseText || // Fall back to streamed text if available
      'I received your message but didn\'t have a response.'

    // Mark complete and clean up
    isComplete = true

    console.log(`💬 Response: ${responseText.slice(0, 100)}...`)
    return responseText
  } catch (error) {
    console.error('Error sending message:', error)
    return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function getSession(
  session: OpenCodeSession
): Promise<any> {
  try {
    const result = await session.client.session.get({
      path: { id: session.sessionId }
    })

    if (result.error) {
      return null
    }

    return result.data
  } catch {
    return null
  }
}

export async function shareSession(
  session: OpenCodeSession
): Promise<string | null> {
  try {
    const result = await session.client.session.share({
      path: { id: session.sessionId }
    })

    if (result.error || !result.data?.share?.url) {
      return null
    }

    return result.data.share.url
  } catch {
    return null
  }
}

export function getOpenCode(): OpenCodeInstance | null {
  return opencodeInstance
}

export async function checkConnection(): Promise<boolean> {
  try {
    const opencode = await initOpenCode()
    return !!opencode.client
  } catch {
    return false
  }
}
