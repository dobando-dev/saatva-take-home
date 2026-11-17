import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { UpstreamClient } from '../upstream/upstream.client'
import { mapCatalog } from './catalog.mapper'
import { mapContent } from './content.mapper'
import { mergeProducts } from './merge-products'
import {
  CatalogUnavailableError,
  type Catalog,
  type ProductContent,
  type ProductsResponse,
} from './product.types'

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name)

  constructor(private readonly upstream: UpstreamClient) {}

  /**
   * Active, validated catalog items. Logs and throws `CatalogUnavailableError` if the catalog
   * can't be had, so callers don't need to log it again.
   */
  getCatalog(): Promise<Catalog> {
    return this.loadCatalog(this.upstream.getCatalogProducts())
  }

  async getProducts(): Promise<ProductsResponse> {
    // Both fetches start together; loadContent never rejects, so a catalog failure leaves nothing
    // unhandled.
    const catalogPromise = this.loadCatalog(this.upstream.getCatalogProducts())
    const contentPromise = this.loadContent(this.upstream.getContentProducts())

    let catalog: Catalog
    try {
      catalog = await catalogPromise
    } catch (error) {
      if (error instanceof CatalogUnavailableError) {
        throw new ServiceUnavailableException('Product catalog is temporarily unavailable')
      }
      throw error
    }

    return { products: mergeProducts(catalog, await contentPromise) }
  }

  private async loadCatalog(raw: Promise<unknown>): Promise<Catalog> {
    try {
      return mapCatalog(await raw, (message) => this.logger.warn(message))
    } catch (error) {
      this.logger.error(`Catalog unavailable: ${errorMessage(error)}`)
      throw new CatalogUnavailableError(errorMessage(error))
    }
  }

  private async loadContent(raw: Promise<unknown>): Promise<Map<string, ProductContent> | null> {
    try {
      return mapContent(await raw, (message) => this.logger.warn(message))
    } catch (error) {
      this.logger.warn(
        `Content unavailable, serving products without content: ${errorMessage(error)}`,
      )
      return null
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
