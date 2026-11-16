import { readFileSync } from 'node:fs'
import path from 'node:path'

export function loadUpstreamData(file: 'catalog-products.json' | 'content-products.json'): unknown {
  const filePath = path.resolve(__dirname, '../../../../services/upstream/data', file)
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

export function failing(): Promise<never> {
  return Promise.reject(new Error('Upstream request failed (503)'))
}
