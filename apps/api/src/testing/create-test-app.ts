import type { INestApplication } from '@nestjs/common'
import { ExpressAdapter } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { AppModule } from '../app.module'
import { configureApp } from '../app.setup'
import { UpstreamClient } from '../upstream/upstream.client'

export type UpstreamStub = {
  getCatalogProducts(): Promise<unknown>
  getContentProducts(): Promise<unknown>
}

export async function createTestApp(upstream: UpstreamStub): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(UpstreamClient)
    .useValue(upstream)
    .compile()
  // Pass the adapter explicitly: platform-express is installed under apps/api/node_modules, so
  // @nestjs/testing (hoisted to the root) cannot resolve it on its own.
  const app = configureApp(moduleRef.createNestApplication(new ExpressAdapter()))
  await app.init()
  return app
}
