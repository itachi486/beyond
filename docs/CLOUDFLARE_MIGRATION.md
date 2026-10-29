# BEYOND Cloudflare Workers + D1 migration

## Status: foundation only — not production-ready

This branch is an isolated migration branch. The existing `main` branch and Node/SQLite application remain unchanged.

### Added in this phase

- `migrations/0001_initial_schema.sql`: D1 schema corresponding to `server/schema.sql`.
- `workers/index.mjs`: Cloudflare Worker entry point for the public universe endpoint.
- `wrangler.jsonc`: static assets + Worker + D1 bindings.
- Public response mapping preserves the current `/api/public/universe` response contract and legacy discovery ordering.

### Not yet migrated

The complete administrator API, password hashing/login/session handling, CSRF/origin validation, rate limits, editorial validation, revision history, and SQLite-to-D1 data transfer are not yet implemented. The Worker deliberately returns HTTP 503 for `/api/admin/*` rather than silently serving a broken or insecure admin interface.

**Do not deploy this branch to production yet.** The frontend admin UI currently depends on those endpoints. Do not point the live site at this Worker until the full admin API is ported and tested.

### Next steps

1. Port all admin routes to D1 using asynchronous prepared statements and D1 batch/transaction-safe patterns.
2. Replace Node-only `scrypt`/crypto dependencies with Web Crypto-compatible password hashing and preserve a verified migration path for existing password hashes (or require a controlled password reset if equivalence cannot be proven).
3. Add a local-only SQLite export/import tool. Never commit the database, export, password hashes, sessions, or secrets.
4. Add Worker/API tests for public visibility rules, login/session/CSRF, rate limiting, editorial validation, revisions, and concurrent edits.
5. Add Wrangler as a dev dependency and verify build, local D1 migrations, tests, and preview.
6. Create the D1 database, set its real ID in deployment configuration, import a verified backup, and deploy only after staging verification.

### D1 setup (after implementation is complete)

Create a D1 database named `beyond`, apply migrations, and configure the real database ID in `wrangler.jsonc`. Keep production data separate from local development data. Take and verify a backup before any import or schema change.

The existing SQLite database is the source of truth until a tested migration and cutover are explicitly approved.
