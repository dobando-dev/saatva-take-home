import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { UpstreamModule } from './upstream/upstream.module'
import { ProductsModule } from './products/products.module'
import { CartModule } from './cart/cart.module'

@Module({
  imports: [UpstreamModule, ProductsModule, CartModule],
  controllers: [HealthController],
})
export class AppModule {}
