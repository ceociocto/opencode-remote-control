// OpenCode SDK client for remote control

import { createOpencode } from '@opencode-ai/sdk'

export interface OpenCodeSession {
  sessionId: string
  client: Awaited<ReturnType<typeof createOpencode>>['client']
  server: Awaited<ReturnType<typeof createOpencode>>['server']
  shareUrl?: string
}

let opencodeInstance: Awaited<ReturnType<typeof createOpencode>> | null = null

export async function initOpenCode(): Promise<Awaited<ReturnType<typeof createOpencode>>> {
  if (opencodeInstance) {
    return opencodeInstance
  }

  console.log('🚀 Starting OpenCode server...')
  opencodeInstance = await createOpencode({
    port: 0, // Don't start HTTP server
  })
  console.log('✅ OpenCode server ready')

  return opencodeInstance
}

export async function createSession(
  threadId: string,
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

    // Share the session to get a URL
    let shareUrl: string | undefined
    const shareResult = await opencode.client.session.share({
      path: { id: sessionId }
    })

    if (!shareResult.error && shareResult.data?.share?.url) {
      shareUrl = shareResult.data.share.url
      console.log(`🔗 Session shared: ${shareUrl}`)
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

    // Build response text from parts
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

// Get the global opencode instance
export function getOpenCode(): Awaited<ReturnType<typeof createOpencode>> | null {
  return opencodeInstance
}

// Check if OpenCode is connected
export async function checkConnection(): Promise<boolean> {
  try {
    const opencode = await initOpenCode()
    return !!opencode.client
  } catch {
    return false
  }
}
