import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestApp } from './testing/create-test-app'
import { failing } from './testing/upstream-data'

describe('app', () => {
  it('boots the app with DI and serves GET /api/health', async () => {
    const app = await createTestApp({ getCatalogProducts: failing, getContentProducts: failing })
    const res = await request(app.getHttpServer()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
    await app.close()
  })
})
