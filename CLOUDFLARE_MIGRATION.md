# BEYOND Cloudflare Workers + D1 migration

This branch adds the Cloudflare deployment foundation without replacing the existing Node/SQLite application.

## Current migration scope

- The existing Vite/React/Three.js frontend remains unchanged.
- `worker/index.ts` serves static assets and implements the public `GET /api/public/universe` response against D1.
- `migrations/0001_initial.sql` creates the existing SQLite-compatible tables in D1.
- `scripts/export-sqlite-to-d1.mjs` exports existing records for a private D1 import.
- Existing Node server and admin UI remain on the original code path.

**Admin APIs are not yet migrated.** Do not point the production admin UI at this Worker until login, sessions, CSRF, rate limiting, password change, revisions, and all editorial mutations are ported and tested. The Worker returns 404 for unimplemented API routes rather than pretending they work.

## Prepare local configuration

1. Install dependencies with `npm ci`.
2. Create a D1 database: `npx wrangler d1 create beyond-production`.
3. Copy the returned database ID into `wrangler.toml`.
4. Set the real production origin in `APP_ORIGIN`.
5. Apply schema: `npx wrangler d1 migrations apply beyond-production --remote`.

Never commit Cloudflare API tokens, account IDs, real admin passwords, session cookies, or exported SQL data.

## Export existing SQLite data

Stop the local server before copying the database. If WAL mode is active, make a consistent SQLite backup first, then export from that backup:

```sh
node scripts/export-sqlite-to-d1.mjs .local/beyond-backup.sqlite beyond-data-export.sql
npx wrangler d1 execute beyond-production --remote --file=./beyond-data-export.sql
```

The SQL export includes editor password hashes and active session hashes to preserve the existing admin account/session state. Treat it as a secret. Store it locally only, never commit it, and securely delete it after a verified import. If you prefer to revoke all existing sessions, remove the session rows from the export before import.

## Build and deploy

The Vite frontend build remains `npm run build`. After D1 configuration and migration, use `npx wrangler deploy` to publish the Worker and static assets. This is a deployment instruction, not evidence that production has been deployed.

## Rollback

The original Node/SQLite server and main branch are unchanged. Do not merge this branch or change the production Cloudflare project until the Worker public endpoint and the complete admin API have passed staging tests. Keep a verified SQLite backup before importing or switching traffic.
