// OpenCode SDK client for remote control

import '../patch_spawn.js'
import { createRequire } from 'node:module'
import { platform } from 'node:os'

const require = createRequire(import.meta.url)
const childProcess = require('node:child_process')

type OpenCodeInstance = Awaited<ReturnType<typeof import('@opencode-ai/sdk').createOpencode>>

function patchFetchForUnlimitedTimeout() {
  if (typeof globalThis.fetch !== 'function') return
  const originalFetch = globalThis.fetch
  // @ts-ignore - internal API
  const originalDispatcher = originalFetch[Symbol.for('undici.globalDispatcher.1')]
  if (originalDispatcher) {
    // @ts-ignore
    originalDispatcher.headersTimeout = 30 * 60 * 1000
    // @ts-ignore
    originalDispatcher.bodyTimeout = 30 * 60 * 1000
  }
  globalThis.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (init?.signal) {
      const { signal: _signal, ...rest } = init
      return originalFetch(input, rest)
    }
    return originalFetch(input, init)
  } as typeof globalThis.fetch
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
  patchFetchForUnlimitedTimeout()
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

export async function sendMessage(
  session: OpenCodeSession,
  message: string
): Promise<string> {
  try {
    console.log(`📝 Sending to OpenCode: ${message.slice(0, 50)}...`)

    const result = await session.client.session.prompt({
      path: { id: session.sessionId },
      body: {
        parts: [{ type: 'text', text: message }]
      },
    })

    if (result.error) {
      console.error('Failed to send message:', result.error)
      return `❌ Error: ${(result.error as any).message || 'Failed to send message'}`
    }

    const response = result.data

    const responseText =
      (response as any).info?.content ||
      (response as any).parts
        ?.filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('\n') ||
      'I received your message but didn\'t have a response.'

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
