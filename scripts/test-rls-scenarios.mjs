import { spawnSync } from 'node:child_process'

// All identities, roles and rows live in disposable PostgreSQL, without .env.local.
const result = spawnSync(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run', 'lib/security/stage01-database.test.ts', 'lib/security/stage23-database.test.ts','lib/security/stage45-database.test.ts',
], { stdio: 'inherit' })
process.exit(result.status ?? 1)
