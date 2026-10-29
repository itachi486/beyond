# BEYOND Cloudflare Workers + D1 migration

This branch adds the Cloudflare deployment foundation while preserving the existing Node/SQLite application on `main`.

## Current migration scope

- The existing Vite/React/Three.js frontend remains unchanged.
- `worker/index.ts` serves static assets and implements the public `GET /api/public/universe` response against D1.
- Admin password migration, login, session creation/expiry, logout, password changes, CSRF checks, login throttling, and protected `/admin/*` pages now have a Workers-compatible implementation.
- Existing administrator email is retained. The first successful password migration replaces the imported Node `scrypt` hash with a Workers Web Crypto PBKDF2-HMAC-SHA256 hash (600,000 iterations), then revokes all existing sessions.
- `migrations/0001_initial.sql` creates the existing SQLite-compatible tables in D1.
- `scripts/export-sqlite-to-d1.mjs` exports existing records for a private D1 import.

**The admin API port is implemented but not yet verified in a Cloudflare staging environment.** Dashboard, catalog, world/discovery listing and CRUD, connection create/update/delete, settings, and revision/history reads are implemented. Record updates use optimistic version checks and D1 batches to keep revisions and mutations together. Do not route the production admin UI to this Worker until build, integration, and staging tests pass.

## Prepare local configuration

1. Install dependencies with `npm ci`.
2. Create a D1 database: `npx wrangler d1 create beyond-production`.
3. Copy the returned database ID into `wrangler.toml`.
4. Set the real production origin in `APP_ORIGIN`.
5. Apply schema: `npx wrangler d1 migrations apply beyond-production --remote`.

Never commit Cloudflare API tokens, account IDs, real admin passwords, session cookies, setup tokens, or exported SQL data.

## Export existing SQLite data

Stop the local server before copying the database. If WAL mode is active, make a consistent SQLite backup first, then export from that backup:

```sh
node scripts/export-sqlite-to-d1.mjs .local/beyond-backup.sqlite beyond-data-export.sql
npx wrangler d1 execute beyond-production --remote --file=./beyond-data-export.sql
```

The SQL export includes administrator password hashes and active session hashes. Treat it as a secret. Store it locally only, never commit it, and securely delete it after a verified import. The first password migration revokes all imported sessions.

## One-time administrator password migration

Do this only after importing the existing administrator row into the target D1 database and configuring the correct `APP_ORIGIN`.

1. Generate a long, random, one-time token locally. Do not put it in source code or commit it.
2. Store it as a Worker secret:

   ```sh
   npx wrangler secret put ADMIN_SETUP_TOKEN
   ```

3. Send one HTTPS POST to `/api/admin/bootstrap-password` with JSON containing `setupToken` and `newPassword`. The request must include the exact configured site `Origin` header. Example (replace the placeholders; avoid saving the real token/password in shell history):

   ```sh
   curl -X POST "https://YOUR_DOMAIN/api/admin/bootstrap-password" \
     -H "Origin: https://YOUR_DOMAIN" \
     -H "Content-Type: application/json" \
     --data-binary @admin-bootstrap.json
   ```

   The local `admin-bootstrap.json` file should contain the token and new password. Keep it outside the repository and delete it securely after use.

4. Confirm the response reports the existing administrator email and `passwordUpdated: true`. The email is not changed. The endpoint only accepts an existing `scrypt` hash, so it cannot be used a second time after successful migration.
5. Immediately remove the setup secret:

   ```sh
   npx wrangler secret delete ADMIN_SETUP_TOKEN
   ```

6. Sign in through the admin login UI using the existing email and newly chosen password.

The setup endpoint rejects requests from a different origin, requires the secret, updates only the imported administrator whose hash is still in the legacy `scrypt` format, and invalidates all sessions. Never expose the setup token in a browser bundle, URL, query string, logs, or chat.

## Build and deploy

The Vite frontend build remains `npm run build`. After D1 configuration and migration, use `npx wrangler deploy` to publish the Worker and static assets. This is a deployment instruction, not evidence that production has been deployed.

## Rollback

The original Node/SQLite server and main branch are unchanged. Do not merge this branch or change the production Cloudflare project until the Worker public endpoint, authentication flow, and complete editorial API have passed staging tests. Keep a verified SQLite backup before importing or switching traffic.
