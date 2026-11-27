import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@phosphor-icons/react': path.resolve(process.cwd(), 'components/ui/line-icons/phosphor'),
      '@': path.resolve(process.cwd()),
    },
  },
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'app/api/**/*.test.ts',
    ],
    globals: false,
  },
})
