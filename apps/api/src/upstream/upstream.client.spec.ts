import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpstreamClient } from './upstream.client'

let server: Server | undefined

async function startServer(handler: Parameters<typeof createServer>[1]): Promise<number> {
  server = createServer(handler)
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  return (server.address() as AddressInfo).port
}

function clientFor(port: number, timeoutMs = 2000): UpstreamClient {
  vi.stubEnv('UPSTREAM_URL', `http://127.0.0.1:${port}`)
  vi.stubEnv('UPSTREAM_TIMEOUT_MS', String(timeoutMs))
  return new UpstreamClient()
}

afterEach(async () => {
  vi.unstubAllEnvs()
  if (server) {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = undefined
  }
})

describe('UpstreamClient', () => {
  it('rejects when the upstream does not answer within UPSTREAM_TIMEOUT_MS', async () => {
    const port = await startServer(() => {
      // never respond
    })
    const client = clientFor(port, 50)

    const started = Date.now()
    await expect(client.getCatalogProducts()).rejects.toThrow()
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('rejects on a non-2xx response', async () => {
    const port = await startServer((_req, res) => {
      res.statusCode = 503
      res.end()
    })
    const client = clientFor(port)
    vi.spyOn(client['logger'], 'warn').mockImplementation(() => undefined)

    await expect(client.getCatalogProducts()).rejects.toThrow()
  })

  it('returns the parsed JSON body', async () => {
    const port = await startServer((_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end('{"ok":true}')
    })
    const client = clientFor(port)

    await expect(client.getContentProducts()).resolves.toEqual({ ok: true })
  })
})
