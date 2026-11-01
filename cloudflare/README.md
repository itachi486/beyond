# BEYOND — Workers + D1 + Tigris isolated migration

Current architecture (2026-10-30): Workers Assets + Workers API, native D1 relational
records, private Tigris S3 media. Supabase is NOT used by this entrypoint. Existing
production `beyond` and its legacy runtime/configuration remain untouched until a
separate cutover authorization. R2 activation and billing are no longer part of
this migration. `cloudflare/worker.mjs` is the new entrypoint.

## Confirmed resources and preservation

- Isolated Worker: `beyond-cloudflare-preview`.
- Preview URL: https://beyond-cloudflare-preview.itach9279.workers.dev/
- Final preview version: `c4e9a45f-92c6-4dd3-8ad2-176612128e19`.
- D1: `beyond-migration-preview`, ID `5b21c5ee-c783-40a4-b5ec-6e086b1aa6ed`.
- Private Tigris bucket: `beyond-preview`, endpoint `https://t3.storage.dev`.
- Secrets: ADMIN_ALLOWED_EMAIL, TIGRIS_ACCESS_KEY_ID, TIGRIS_SECRET_ACCESS_KEY.
  These are server-only Worker secrets. The IAM endpoint is not needed for S3
  requests; this code does not create keys or change IAM policies.
- Original backup: `/home/administrator/beyond-backups/20261029T194726Z`.
- Preserved import input: `/home/administrator/beyond-backups/migration-prep-20261029T214455Z`.
- Private migration/runtime reports and screenshots:
  `/home/administrator/beyond-backups/cloudflare-preview`.

Baseline exact record counts before preview QA:

| Original collection | Records | D1 destination |
|---|---:|---|
| admins | 1 | admins (same ID and scrypt hash) |
| central_activity | 35 | central_activity |
| central_characters | 23 | central_characters |
| connections | 16 | connections |
| discoveries | 9 | discoveries |
| login_limits | 2 | legacy_login_limits (inactive archive) |
| permanent_deletion_jobs | 0 | permanent_deletion_jobs |
| revisions | 1 | revisions |
| schema_versions | 2 | schema_versions |
| sessions | 1 | legacy_sessions (inactive archive) |
| settings | 1 | settings |
| worlds | 11 | worlds |

Total **102 original rows**, matched by primary keys, all cell values and foreign
keys. Live sessions/rate limits were initially empty; old records were never
reactivated. Preview QA subsequently creates clearly labelled PRIVATE test drafts,
new audit rows and new preview-only session/rate-limit records. Do not confuse
these legitimate test additions with loss/modification of the 102 source rows.

**46 original/preview files, 57,309,280 bytes** copied to Tigris with identical keys
and SHA-256. Originals/local backups were not changed. Tigris ListBucket, PutObject,
GetObject, DeleteObject were actually tested; the temporary probe was removed.
Bucket ACL denied public groups. Successful signed operations validate the key
pair; the console's human-friendly key label is not independently returned by S3.
Never publish private objects or expose a presigned storage credential in UI.

## Implementation and security

`generate-api.mjs` derives compatibility modules from the CURRENT original server
API and validators, without changing the Node/SQLite service. Generated modules
must be regenerated after source contracts change; do not edit them by hand.

`d1-store.mjs` loads a consistent D1 batch snapshot into an in-memory SQLite WASM
compatibility view. D1 remains authoritative. Captured parameterized writes are
replayed through one atomic D1 batch with a compare-and-swap revision guard and
server authorization/expiry guard. Success/cookies are returned only AFTER the
batch commits. Stale concurrent requests fail closed with 409; callers refresh
and retry rather than silently overwriting. Login/password rate-limit checkpoints
commit BEFORE expensive password derivation. This preserves the synchronous
legacy SQL/transaction contracts, including rollback/audit/version semantics.

This is deliberately bounded to 20,000 loaded rows and appropriate to the tested
102-row catalog. It scans the application snapshot per request: high-volume or
large-dataset performance is NOT established. A direct asynchronous query adapter
is the next scaling step, not an excuse to bypass authorization. D1/table writes
outside this adapter must coordinate cf_state.revision; normal application writes
already do so.

Server-only Tigris adapter uses AWS Signature V4 (aws4fetch), manual redirects,
strict endpoint/key paths, conditional creates and no anonymous writes. All media
is proxied through existing authorized API contracts. Private/unpublished/archived
catalog objects stay inaccessible through public APIs. Metadata and originals are
separate from browser-local assets. WASM codecs actually decode PNG/JPEG/WebP,
retain original bytes and alpha, produce bounded WebP previews and retain the
original GLB/glTF complexity/embedded-resource validation. No native filesystem or
node:sqlite is needed by the Worker; Node crypto/path helpers use nodejs_compat.

Permanent deletion uses version/confirmation checks and server auth. Metadata
removal and a durable cleanup receipt commit BEFORE media deletion. Cleanup
failure returns an error and retains a retryable receipt. Shared files and linked
server content are protected. Only newly created request-owned unregistered
objects can be cleaned after failed uploads. All destructive tests used disposable
fixtures or NEW preview-only probe records, never source/production media.

## Preserved API areas

Public universe, central catalog/file/preview; original admin login/session/logout,
allowlist and password rotation; worlds/discoveries create/edit/publish/archive,
connections, aliases, revisions, source/verification validation, dashboards,
users/inventory, settings, activity pagination, central image/model upload/edit/
archive, explicit permanent deletion with retry journal. Ordinary users can only
acquire administrator-published characters. Existing routes/UI/design are reused.

AI status/generation/quota/idempotency/private asset contracts are retained with
reservation committed before a provider call. Images now go to Tigris with D1
metadata. A mock success flow was tested; **no paid API call or live provider
success was claimed**. No AI key/model is configured on preview. Actual provider
permissions/credits/model validation remain separate work. Dialogue retains its
existing honest local fallback.

## Repeatable isolated commands

```sh
npm run generate:cloudflare
npm run typecheck
npm run build
npm run test
npm run test:server
npm run test:cloudflare
```

Migration CLI uses the private preserved input paths above and refuses production
resource overrides. `--d1` stages native records, preserving existing equal rows
and refusing mismatches. `--preview` copies/verifies Tigris media and activates
ONLY the isolated dataset after all counts and hashes match. `--verify` reads and
compares; after QA adds/edits preview fixture records, strict baseline comparison
can correctly report a difference. Do not use migration flags to erase QA data.

```sh
node --env-file=.env.local cloudflare/migrate.mjs --inspect
# Already executed; do not blindly repeat on a live/QA-modified preview:
# node --env-file=.env.local cloudflare/migrate.mjs --d1
# node --env-file=.env.local cloudflare/migrate.mjs --preview
```

`node cloudflare/deploy-preview.mjs` has hard guards for the exact isolated Worker,
D1 ID/name and Tigris bucket. It cannot deploy `beyond`. It uses a private temporary
secret file and removes that copy after setting secrets. Configuration contains
no key values. Actual deployment requires Account Workers Scripts Edit and D1
Edit on the intended account. Do not ask for secrets in chat.

Local HTTPS workerd uses `.local/cloudflare-runtime` and isolated persisted D1:

```sh
node cloudflare/setup-local.mjs
npx wrangler dev --config .local/cloudflare-runtime/wrangler.jsonc \
  --persist-to .local/cloudflare-preview-state \
  --local-protocol https --port 5190 --ip 127.0.0.1
```

The local D1 restore was actually verified; it contains the source snapshot plus
local-only QA additions. This local configuration talks to the SAME isolated
Tigris bucket, not an imaginary S3 mock. Development's local explorer is loopback
only and is never part of the deployed Worker. `.env.local` and `.local` data and
private `.dev.vars` are ignored. Protect and do not commit these files.

## Executed verification

- npm run typecheck: PASS.
- npm run build: PASS; existing large Three.js chunk warning.
- npm run test: 36/36 PASS.
- npm run test:server: 81/81 PASS, disposable databases.
- Cloudflare/D1/media tests: 18 scenarios PASS in two Node test files, including
  actual image codecs, GLB, CAS, session/CSRF, password rotation, connection CRUD,
  quota/idempotency mock, deletion journal and S3 signing/conditional storage.
- Existing Playwright regression: 35/35 PASS across admin workspace, CREATE,
  uploads, backups/restoration, 375/768/1440 layouts and data compatibility.
- ACTUAL local workerd+D1+Tigris browser: login, world create/save/reopen, cookie
  persistence/revocation, image retrieval, 375px no overflow, zero page exceptions.
- ACTUAL local upload roundtrip: PNG upload201, original GET200 with byte equality,
  WebP preview200, inactive public denial404, explicit deletion200 and subsequent
  file denial404. Only the newly created temporary fixture was deleted.
- ACTUAL remote preview Chromium: home200; universe200 (10 published worlds,
  8 discoveries); unauth admin401; login/session/dashboard/catalog200; private
  draft create201/update200/reopen200/version2; draft absent from public data;
  23 public characters, file200; admin page renders; refresh retains session;
  logout200/revoked401; no mobile horizontal overflow; zero page exceptions.

Original backup SHA-256 manifests still match. Git HEAD/branch/history were not
changed or pushed. Production beyond remained at version
`1e8ba537-1251-43e4-af3b-6829d0513c0c` at read-only comparison. The earlier
Supabase/public-release notes are historical; they are not new production actions
in this isolated migration task.

## Browser data and remaining limits

Actual operator Chrome localStorage/IndexedDB are NOT accessible to this agent and
were not exported, migrated or deleted. Keep the existing full exporter procedure
(`scripts/export-browser-preservation.js`) per origin/profile. World ZIPs alone
omit discovery/progress/chat sidecars. Preserve IDs and restore only into a fresh
isolated profile first. Personal My World remains browser-local; cross-device
cloud synchronization/public visitor accounts were not invented. Existing graph,
placements/rotation, discoveries, progress and chat behavior are preserved.

High-load/maximum-size performance, actual paid AI provider generation and the
operator's complete browser restore are not verified. No pixel-perfect redesign
is claimed; frontend assets/features were preserved.

## Production cutover — REQUIRES NEW FINAL AUTHORIZATION

1. Record the current live production version and stop editorial writes for a
   consistent final export. Compare current Supabase runtime records/media with
   the frozen SQLite baseline: incorporate legitimate live deltas, do not discard
   or assume there have been none.
2. Make verified encrypted/off-device backups and complete per-origin browser
   exports. Validate restoration into isolated storage with matching IDs/graphs.
3. Select NEW production D1 and private production Tigris resources; do not reuse
   QA-mutated preview datasets. Import idempotently, archive old sessions/limits,
   verify all values/FKs/file hashes and active access-control policy.
4. Populate `wrangler.cloudflare.production.review.jsonc` only AFTER authorization;
   its placeholder IDs/bucket intentionally make it non-deployable today. Set
   production server-only secrets and the exact canonical HTTPS origin. No auth
   provider/account/password reset is required or permitted as a shortcut.
5. Deploy the approved build to beyond; verify full critical flows, keep previous
   Worker version and old provider backups for rollback. Rollback must reconcile
   any writes after cutover, not silently restore a stale snapshot.
6. Only after explicit retention approval retire old Supabase resources. Nothing
   in this task deletes or disables the existing production provider.

## Latest verified Workers AI result — 2026-10-30

Preview release `6f23bfe5-1bbd-47e8-9f3a-7836e2ee94ce` is100% active.
Actual deployed AI binding inference succeeded: understand/plan/chat text3 requests,
Schnell images3 requests. The image modal loaded actual PNG previews. Added the
last generated asset to a disposable browser world, saved and reopened:2 characters,
original Anchor unchanged, description/connections retained, generated reference
retained; public universe unchanged; browser exceptions0; logout200. This is an
actual provider/browser test, not the mocked regression suite. Captures and output
are private in beyond-backups/cloudflare-preview/workers-ai. Local browser world
persistence remains browser-only; private generated asset URLs require admin login.

Earlier direct REST diagnostic requests still returned401/code10000. The Worker
AI binding needs no external API secret and works independently of those token
permissions; no token change is required for the verified binding workflow. Early
DNS/TLS and browser synchronization failures were resolved for the successful run.
No production transition performed. Original server worlds/characters/connections/
admin/settings compare equal; only test sessions/rate counters, AI rows and the
revision counter changed. Existing secrets were preserved on final deployment.

## Workers AI Preview default — 2026-10-30

The latest user instruction skips browser preservation: there is no user browser
content to retain. Do not keep requesting an export or run a browser restore.
Only `wrangler.cloudflare.preview.jsonc` now binds `AI`. The Preview generated
image module no longer imports the OpenAI SDK and has no external OpenAI execution
path; the existing local Node provider is retained for compatibility, not used by
Preview. No paid account upgrade or new service was created.

- Text: `@cf/meta/llama-3.1-8b-instruct-fp8-fast`, max256 output tokens.
- Image: `@cf/black-forest-labs/flux-1-schnell`, steps4, JPEG response validated
  and converted losslessly to a PNG container. Conversion does NOT remove the
  backdrop or invent alpha transparency. Original generation creates a new
  private Tigris object; existing media are never replaced.
- `/api/ai/capabilities` reports the binding and limitations.
- `POST /api/ai/text` supports chat/understand/plan. Chat resolves only active,
  published central character metadata server-side. Planning/understanding require
  the existing admin session; authenticated requests require its CSRF. Origin and
  JSON checks apply to anonymous published-character chat too. No model output is
  executed or automatically applied to a world. AIWorldPlan displays proposals in
  the existing creation sidebar. WorldAdventure uses Workers AI when available;
  the original explicit local fallback remains on environments without the service.
- Existing authenticated `/api/ai/generations` and private image URLs remain
  compatible with character preview/add/edit/save. The new provider does not
  guarantee PNG alpha or accept reference editing; a reference is rejected instead
  of silently regenerating the full original image.

### Limits and pricing

Official pricing checked on 2026-10-30:
https://developers.cloudflare.com/workers-ai/platform/pricing/
Free allocation10,000 Neurons per account/day, reset00:00UTC. Paid overage is
$0.011/1,000 Neurons. Text model:4119 input and34868 output Neurons per million
 tokens ($0.045/$0.384). Schnell:4.8 Neurons per512px tile +9.6 per step
($0.0000528/tile +$0.0001056/step); a1024px four-step image is57.6 Neurons.

`0002_workers_ai.sql` adds a separate durable request/budget ledger. It is
installed only by the guarded `node cloudflare/setup-workers-ai-preview.mjs`,
which first privately backs up existing Preview tables and records the production
version read-only. Original data/schema remain unchanged. Compare-and-swap D1
flush reserves allowance BEFORE provider inference. Duplicate request IDs do not
charge twice; changed requests conflict. Failed/timeout/pending requests retain
reservations (no automatic retries), avoiding unbounded retry cost.

Configurable defaults: AI_SERVICE_DAILY_NEURONS=9000 (hard maximum10000),
AI_USER_DAILY_TEXT=30, AI_USER_DAILY_IMAGES=3. Text reserves100 Neurons and image
400, conservatively covering current bounded inputs/output dimensions. These are
application safety estimates, NOT billing telemetry or an account-wide spending
cap. Other Workers can consume the shared account allocation. Anonymous chat has
no user accounts, so its identity limit is per Cloudflare-provided IP/day hash;
existing authenticated admin requests use the actual admin ID. Shared IP users
share the anonymous allowance; it is not tamper-proof per-person identity.
The ledger is append-only; the existing20,000-row compatibility safety ceiling
will eventually require archival or a direct-D1 budget service before scale-up.

### Editing assessment

https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/
Documents generation+editing, but its current schema uses a multipart envelope.
It is NOT integrated or verified here. Pricing is5.37 input/26.05 output Neurons
per512px tile; runtime access and quality are unverified. Do not promise exact
retention of unmasked pixels from generative editing. Safest near-term approach:
keep immutable original media, generate a separate object/overlay, then explicitly
place it as a new world object. A future mask editor should preserve unmasked
pixels by deterministic composition, retain an original/version pointer, and
require user confirmation. No whole-world automatic image replacement is enabled.

### Actual verification and external blockers

Typecheck/build passed; existing Three.js chunk-size warning remains. Cloudflare
unit tests use disposable D1/media and mocked inference, never real AI success.
Existing AI modal browser suite6/6 passed (mocked provider). Actual separate
Cloudflare REST text AND image attempts each returned401 / code10000: no generated
output and no fake success. The configured token can deploy the Preview and read
its actual AI binding but cannot run the tested AI REST operations. Review its
Workers AI permissions per official REST setup:
https://developers.cloudflare.com/workers-ai/get-started/rest-api/
Do not request tokens in chat; update .env.local safely. Binding inference may
have different authorization from token-based REST inference; it is not proven
failed simply by the REST401. Initially actual deployed UI inference was unverified:
Preview workers.dev DNS/TLS requests failed in this execution environment despite
successful api.cloudflare.com control-plane requests. The initial failures created no successful report. Later actual generation,
confirmation, saving and reopening succeeded as recorded above.
