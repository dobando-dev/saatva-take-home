import type { INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'

/** Shared app configuration, used by both `main.ts` and the test harness. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api')
  app.use(cookieParser())
  return app
}
