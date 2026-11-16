import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { configureApp } from './app.setup'

async function bootstrap() {
  // Pass the adapter explicitly: @nestjs/core is hoisted to the root while platform-express lives
  // under apps/api/node_modules, so Nest's own lookup for the default driver fails.
  const app = configureApp(await NestFactory.create(AppModule, new ExpressAdapter()))

  const port = Number(process.env.API_PORT ?? 4000)
  await app.listen(port)
  console.log(`[api] listening on http://localhost:${port}/api`)
}

bootstrap()
