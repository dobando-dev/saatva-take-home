import type { INestApplication } from '@nestjs/common'

/** Shared app configuration, used by both `main.ts` and the test harness. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api')
  return app
}
