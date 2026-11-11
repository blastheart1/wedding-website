import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Lazy singleton — throws only at call time, not at module import.
// This prevents `next build` from failing when DATABASE_URL is absent.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL environment variable is not set')
  // The Neon driver sends each query as a fetch, and Next.js caches identical fetches.
  // Without no-store a repeated query can return an old answer (found by the invitations
  // end-to-end test: a revoked link kept working). Every query must reach the database.
  _db = drizzle(neon(url, { fetchOptions: { cache: 'no-store' } }), { schema })
  return _db
}

export { schema }
