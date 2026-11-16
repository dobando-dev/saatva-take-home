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

  /** Active, validated catalog items. Throws `CatalogUnavailableError` if the catalog can't be had. */
  async getCatalog(): Promise<Catalog> {
    const [result] = await Promise.allSettled([this.upstream.getCatalogProducts()])
    return this.toCatalog(result)
  }

  async getProducts(): Promise<ProductsResponse> {
    const [catalogResult, contentResult] = await Promise.allSettled([
      this.upstream.getCatalogProducts(),
      this.upstream.getContentProducts(),
    ])

    let catalog: Catalog
    try {
      catalog = this.toCatalog(catalogResult)
    } catch (error) {
      this.logger.error(`Catalog unavailable: ${describe(error)}`)
      throw new ServiceUnavailableException('Product catalog is temporarily unavailable')
    }

    return { products: mergeProducts(catalog, this.loadContent(contentResult)) }
  }

  private toCatalog(result: PromiseSettledResult<unknown>): Catalog {
    try {
      if (result.status === 'rejected') throw result.reason
      return mapCatalog(result.value, (message) => this.logger.warn(message))
    } catch (error) {
      throw new CatalogUnavailableError(describe(error))
    }
  }

  private loadContent(result: PromiseSettledResult<unknown>): Map<string, ProductContent> | null {
    try {
      if (result.status === 'rejected') throw result.reason
      return mapContent(result.value, (message) => this.logger.warn(message))
    } catch (error) {
      this.logger.warn(`Content unavailable, serving products without content: ${describe(error)}`)
      return null
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
