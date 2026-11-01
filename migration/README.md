# Batch preparation status — 2026-10-30

Supabase schema application was reported by the operator and confirmed read-only:
all six BEYOND tables exist and contain zero rows. Private bucket remains
public=false, 25MiB per file. No batch, row, file or activation was written remotely
in this phase. Never run the initial SQL Editor script again over existing names.

## Actual inventory and preservation evidence

Original backup: `/home/administrator/beyond-backups/20261029T194726Z`. Its existing
checksum manifests still match. Fresh, independent preparation snapshot and files:
`/home/administrator/beyond-backups/migration-prep-20261029T214455Z`. Contains
`snapshot.sqlite`, `preservation-export.json`, copied `character-assets/`,
`inventory.json`, `backup-comparison.json`, `SHA256SUMS`. Treat this directory as
private credential/personal-data material. It is not encrypted or off-device.

| SQLite collection | Actual rows |
|---|---:|
| admins | 1 |
| central_activity | 35 |
| central_characters | 23 |
| connections | 16 |
| discoveries | 9 |
| login_limits | 2 |
| permanent_deletion_jobs | 0 |
| revisions | 1 |
| schema_versions | 2 |
| sessions | 1 |
| settings | 1 |
| worlds | 11 |

Total 102 rows. 46 original/preview files, 57,309,280 bytes; zero missing references.
SQLite Backup API integrity/foreign-key checks passed; files before/after copying
and copied hashes agree. Every row (not merely counts), including the administrator
credential, is unchanged against the original backup; no secret row values or
hashes were printed. All original files are unchanged too. This online snapshot
is not a write-quiesced final cutover snapshot; stop writers for final transfer.

## Idempotent, inactive staging preparation

`migration/batch.mjs` computes a deterministic batch ID from the exact snapshot,
records, ordering, file sizes and SHA-256. Re-running the SAME preservation export
and copied assets uses the same batch. A changed source snapshot creates a new
batch; it does not merge into or overwrite a previous snapshot. Preserve this
prepared input if retrying; do not silently replace it with a newer snapshot.

`migration/import-preservation.mjs` modes:

```sh
# Offline validation (executed)
node migration/import-preservation.mjs /home/administrator/beyond-backups/migration-prep-20261029T214455Z/preservation-export.json /home/administrator/beyond-backups/migration-prep-20261029T214455Z/character-assets --plan

# Remote GET-only conflict/count check (executed)
node --env-file=.env.local migration/import-preservation.mjs /home/administrator/beyond-backups/migration-prep-20261029T214455Z/preservation-export.json /home/administrator/beyond-backups/migration-prep-20261029T214455Z/character-assets --check

# Future only: NOT executed or authorized by this preparation phase
# same command with --apply stages an inactive batch; it never activates it
```

Primary keys, world/character IDs, connections, creator references and original
credential bytes remain unchanged. Only file storage paths receive a batch prefix.
Unknown tables, duplicate keys, broken references, missing files, path traversal,
symlink escapes, active/verified targets and conflicting existing content stop
execution. Public or undersized buckets are rejected. Read-back compares complete
row contents and file SHA-256, not just counts. Row inserts use DO NOTHING on
existing keys; there is no update/delete/upsert-to-merge/activation method.
Partial batches remain inactive; retries insert only missing equal-content items.
No automatic rollback deletes another run's data. A failed batch is retained for
review. Concurrent activation must not occur during staging; final state checks
detect it, but no operator-controlled activation lock exists yet.

Actual Storage returns HTTP400 + NoSuchKey/statusCode404 for missing files; only
that precise combination or HTTP404 is treated as absent, not access failures.
Legacy SQLite session/rate-limit rows are private historical preservation records;
they do NOT populate fresh edge sessions or confer authentication. Nothing resets
the administrator account.

## Browser data is separate

Keep the existing full browser export procedure and helper. Run it in every
actual origin/profile after stopping edits: localhost:5173/:5174/:5175, any
127.0.0.1 variants and the Cloudflare origin. Export all beyond: localStorage keys
and every IndexedDB asset, not just world ZIPs. Do not delete originals, change
IDs or overwrite browser stores. Actual user's browser inventory, export and
restore remain unverified and are not included in the 102 server rows. This phase
did not change `/discover`, My World, discovery/progress/chat or any browser store.

## Workers readiness matrix

| API area | Current implementation | Required before cutover |
|---|---|---|
| Public universe / public character list and private file proxy | Implemented, fixture tested | Verified inactive import + activation review + actual Workers check |
| Admin login/session/logout/setup status | Implemented preserving scrypt, allowlist, Origin, CSRF, DB rate limits | Actual edge/runtime/CPU and migrated-account tests |
| Admin catalog + worlds/discoveries GET/POST/PUT | Implemented; server validators, DB version CAS + audit | Actual remote transaction/concurrency tests |
| Dashboard, activity, inventory, settings | Not fully ported | Preserve existing response contracts |
| Password change / connections writes | Not ported | Credential/session revocation and graph/audit transactions |
| Central admin uploads, edit/archive, previews | Not ported | Private Storage, validation/image processing, CAS/audit |
| Permanent deletion + recovery journal | Not ported | Safe reference-aware deletion; no live destructive tests |
| AI image service | Not ported | Optional service configuration; never paid fallback |
| Personal worlds/discovery progress/chat | Existing browser storage preserved | Browser export/restore; define ownership before cloud sync |

Unsupported endpoints still fail closed; do NOT deploy over beyond. Administrator
API completeness, verified restore, Workers runtime and browser validation are
separate from this batch-readiness result. No new schema is required for the
preparation tooling in this phase. No further keys or configuration are requested.

## This phase's checks

New batch tests 13/13: deterministic IDs, repeated runs, partial resume, content
conflicts, active/verified guards, relationships, paths, source changes, remote
pagination, private bucket and precise missing-file errors. Existing cloud + edge
auth tests passed (9 each). Focused browser-storage model/backup/progress tests
23/23 passed. npm run build passed (includes TypeScript), existing large bundle
warning remains. No actual browser or remote write/import test was performed.

Earlier handoff follows; current status above supersedes older configuration,
non-idempotence and SQL-application notes below.

# Current SQL Editor handoff (2026-10-30)

The Supabase server key and Cloudflare token are now validated (no values logged).
Private bucket `beyond-character-assets` was created and verified public=false,
25MiB limit. Remote DB schema/import remain untouched; user selected SQL Editor
and prohibited DB changes until they apply the script.

Apply **only** `supabase/SQL_EDITOR_MIGRATION.sql` as one whole script, not the
individual source migrations too. It wraps all definitions in one transaction,
aborts on existing names, adds only BEYOND-namespaced structures, enables RLS and
revokes PUBLIC/anon/authenticated access. It does not seed/replace/reset any
admin or content row or activate an imported batch. DELETE/UPDATE inside the
function bodies run only on later explicit API operations (session logout,
versioned content updates); creating the functions does not execute them.

Edge login/logout/session + allowlist, original scrypt, Origin/CSRF and persisted
rate limiting are implemented along with world/discovery/catalog reads and
versioned writes/audit RPCs. New mocked edge tests 9/9 pass and existing cloud
tests pass. The SQL was executed in disposable PostgreSQL 18 and auth/CSRF/CAS/
audit/access tests passed. This is not actual Workers/Supabase runtime verification.

Remaining before cutover: other admin dashboard/inventory/password/connection/
library-upload/permanent-delete APIs, browser ownership/sync, complete restore
and actual Worker runtime/CPU checks. Existing local service remains intact.
Do not deploy this preview over beyond yet. APP_ORIGIN and ADMIN_ALLOWED_EMAIL
will be required server-side when deployment is ready; do not invent accounts.

Earlier preservation work follows; current status above supersedes historical
configuration/readiness notes below.

# Supabase / Workers migration: preservation-first, NOT ready for cutover

The existing Node/SQLite service and browser data remain authoritative. No remote
schema, data, settings, account, deployment or Git history was changed by this work.

## Backup actually made

`/home/administrator/beyond-backups/20261029T194726Z` is private (directory 0700;
initial backup files 0600). It contains reachable Git history, the tracked and
untracked source snapshot, SQLite Backup API snapshot, character originals,
private environment archives, manifests and a private row-preservation export.
These archives contain credentials and personal data: never upload to GitHub or
share publicly. They are NOT encrypted or off-device; arrange encrypted offline
storage before treating this as disaster recovery.

SQLite integrity and foreign keys passed, 46 character files were stable during
copy, and no central file reference was missing. Checksums and a temporary isolated
SQLite restore were checked. One existing administrator was preserved without
reading/outputting a password/hash or changing it. This was an online snapshot,
not a global write-quiesced final cutover. Stop edits and all asset writers for
the final migration snapshot. Browser backup and full application restore are
NOT verified.

## Server-only configuration

In Git-ignored `.env.local` for local migration tools:

```
SUPABASE_URL=https://<confirmed-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-secret-or-legacy-service-role-key>
SUPABASE_CHARACTER_BUCKET=beyond-character-assets
```

No `VITE_` prefix. Do not paste keys into chat or command arguments. A publishable
`sb_publishable_` key is insufficient and explicitly rejected. The current local
value was detected as publishable (value never printed or modified). Read-only
target check found the migration table absent, `PGRST205`. No privileged access
has been verified. Cloudflare will need these as server bindings/secrets later;
local `.env.local` does not configure a deployed Worker.

In the confirmed Supabase project's SQL Editor, review and eventually execute
`supabase/migrations/20261029_beyond_preservation.sql`. It is NOT applied yet.
Create the configured Storage bucket as **private**, never public. There are no
anonymous/authenticated grants or RLS policies on the preservation tables. The
server service role alone accesses them. Do not disable RLS on existing tables.

## Inactive import, never automatic activation

The current preservation schema stores original typed rows in JSONB with
collection, primary key, stable ordering, source checksum and batch ID. This
avoids silently dropping optional tables, scrypt hashes, audit history or AI BLOBs.
Binary columns have an explicit base64 encoding marker. Central file paths are
remapped under a fresh batch prefix; original character/world IDs are preserved.
This is a **migration staging model**, not a completed transactional replacement
for the existing editorial database.

```
node migration/export-sqlite.mjs <BACKUP.sqlite> <NEW_PRIVATE_EXPORT.json>
node migration/import-preservation.mjs <PRIVATE_EXPORT.json> <COPIED_CHARACTER_DIRECTORY>
```

The second command defaults to offline validation. It checked 102 rows and 46
referenced files in this task. It was not run with `--apply`. After valid server
credentials/schema/private bucket are ready, `--apply` uploads into a new,
inactive batch without overwriting/deleting existing records or files. Each
uploaded file is downloaded and SHA-256 compared. Failure leaves an INACTIVE
partial batch for inspection; no automatic cleanup/deletion. Re-running creates
a separate inactive batch; it is not an idempotent retry mechanism. Source tables
remain unchanged. Row/count checks, full restore, RLS and auth tests must precede
marking verified or setting the active batch. No activation tool is supplied yet.

## Worker preview

`wrangler.migration.jsonc` is a separate, un-deployed preview configuration.
The Fetch API handler uses HTTPS Supabase REST/Storage, no SQLite, Node runtime
or local filesystem. `/api/*` always goes to the Worker, avoiding SPA HTML API
responses. Public universe uses the original eligibility and response projection;
public central characters retain pagination, publish checks, version checks and
private file proxying. Backend diagnostics and keys are never forwarded.

**Do not deploy this over `beyond`.** Admin/AI endpoints return an explicit 503
because they have not been migrated. In particular: scrypt verification,
allowlisted sole-admin sessions, CSRF, atomic rate limits, versioned editorial
writes, revision transactions, uploads/image processing and permanent deletion
journals still need an edge-compatible implementation. Do not import old sessions
as active sessions or reset the admin account to bypass this work.

The projection is copied from the current SQLite implementation and tested for
JSON parity. Future changes must update both until the migration is completed.

## Full browser preservation (user Chrome required)

`scripts/export-browser-preservation.js` is a read-only DevTools exporter. Open
each actual profile/origin, stop all editing tabs, inspect and paste the script
into DevTools. It downloads all `beyond:` localStorage values plus every record
and original Blob/File from `beyond-character-assets` IndexedDB, including unused
assets. This covers world/discovery/progress/chat sidecars and backup receipts,
not just the existing single-world ZIP. Metadata/IDs and original file bytes are
preserved; Blob hashes are included. Unknown databases/stores, changed localStorage
or unsupported values abort instead of silently omitting them. No cookies or
session tokens are exported. Keep writes stopped: IndexedDB and localStorage do
not share an atomic snapshot. This exporter has not been exercised on the user's
actual Chrome profile and is not a verified restore implementation.

Check each separately: localhost:5173, :5174, :5175, 127.0.0.1 variants and
https://beyond.itach9279.workers.dev. Browser profiles and origins are isolated;
new production storage being empty does not mean old data was deleted. Preserve
IDs when restoring into a fresh isolated profile; current world ZIP restoration
rekeys IDs and therefore does not restore progress/chat sidecars automatically.

There is no visitor account/ownership model today. Do not expose an unauthenticated
cloud world/progress/chat upload API or pretend local data is cross-device synced.
Choose ownership and explicit user import/consent before enabling cloud sync.
Character acquisition remains admin-published-only; the migration does not add a
public upload API. Dialogue remains the existing local fallback, not a live AI.

## Verification performed

- `npm run build`: passed, includes TypeScript. Existing large Three.js chunk warning.
- `node server/tests/cloud-migration.test.mjs`: 9/9 passed.
- Browser-target esbuild bundle of `worker/index.mjs`: passed without Node imports.
- Full isolated server suite: 57/57 passed after granting local loopback access.
- SQL execution/RLS on Supabase, actual Worker runtime/deployment, browser export
  and restore are unverified. No paid API calls, commit, push or deploy.

Official references: [Workers API/static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
[Supabase Storage access controls](https://supabase.com/docs/guides/storage/security/access-control).
