import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const functionsEnv = 'supabase/functions/.env'
const notifySecret = existsSync(functionsEnv)
  ? (/NOTIFY_SECRET=(.+)/.exec(readFileSync(functionsEnv, 'utf8'))?.[1]?.trim() ?? '')
  : ''

// Runs against the LOCAL Supabase stack (`supabase start`). Not part of `npm test`.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
    testTimeout: 30_000,
    env: { VITE_NOTIFY_SECRET: notifySecret },
  },
})
