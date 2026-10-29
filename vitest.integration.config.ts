import { defineConfig } from 'vitest/config'

// Runs against the LOCAL Supabase stack (`supabase start`). Not part of `npm test`.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
    testTimeout: 30_000,
  },
})
