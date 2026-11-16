import { Injectable, Logger } from '@nestjs/common'

/**
 * Thin client for the upstream catalog and content services.
 * Returns `unknown` on purpose: `upstream.types.ts` documents what the provider claims,
 * and the mappers validate what actually arrives.
 */
@Injectable()
export class UpstreamClient {
  private readonly logger = new Logger(UpstreamClient.name)
  private readonly baseUrl = process.env.UPSTREAM_URL ?? 'http://localhost:4100'
  private readonly timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 2000)

  async getCatalogProducts(): Promise<unknown> {
    return this.get('/catalog/v1/products')
  }

  async getContentProducts(): Promise<unknown> {
    return this.get('/content/v1/products')
  }

  private async get(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!res.ok) {
      this.logger.warn(`GET ${path} -> ${res.status}`)
      throw new Error(`Upstream request failed: ${path} (${res.status})`)
    }

    return res.json()
  }
}
