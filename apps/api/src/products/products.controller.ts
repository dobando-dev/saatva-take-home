import { Controller, Get } from '@nestjs/common'
import type { ProductsResponse } from './product.types'
import { ProductsService } from './products.service'

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  getProducts(): Promise<ProductsResponse> {
    return this.productsService.getProducts()
  }
}
