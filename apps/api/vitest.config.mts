import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
  // SWC emits decorator metadata, which esbuild (Vitest's default) does not; Nest DI needs it.
  plugins: [swc.vite({ module: { type: 'es6' } })],
})
