import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd()),
    },
  },
  test: {
    environment: 'node',
    include: [
      'lib/creator-content.test.ts',
      'lib/products/**/__tests__/**/*.test.ts',
      'lib/semantic/__tests__/**/*.test.ts',
      'lib/storefront/**/*.test.ts',
      'lib/consumer-advisor/**/*.test.ts',
      'lib/product/**/*.test.ts',
      'lib/imports/**/__tests__/**/*.test.ts',
    ],
    globals: false,
  },
})
