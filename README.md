# Hybrid Explore Mode and published-only acquisition

Start with `npm run dev` at5173. ENTER THE UNKNOWN → HIDDEN WORLDS → CREATE/open personal world. Ordinary visitors choose **Central Library**, which lists only administrator-published active originals. Place a character, edit placement/metadata, connect actual targets, save, then choose Explore Mode. Existing saved personal characters are preserved. Administrator local upload/manual/AI tools and external ZIP imports require signing in through the existing `/admin` flow; no new credentials/provider or public registration was added.

Explore Mode combines the existing celestial artwork in depth-separated planes with live stars/nebula/energy and actual PNG/GLB characters. Drag/pinch/wheel, select/follow/back/Escape/Reset work as before. No world model or persistence migration. Painted architecture is scenery, not fictitious selectable content. Original alpha images are preserved; previews use a neutral surface rather than a checkerboard. A missing scenery asset falls back to native exploration with an explanation.

Browser tests now launch their own disposable SQLite/file-root backend via `tests/local-author-server.mjs`. Authoring scenarios log in through the real API using private temporary fixture credentials, not the operator's account. `npm run test:browser` must not reuse an unrelated5178 server; it fails rather than attaching to actual user data. Test credentials stay outside the repo and are removed with the disposable fixture on shutdown. Existing security/rate-limit tests remain; test-only author fixture resets rate counters only in its guarded temporary DB between authoring cases.

---

# Character exploration — local usage

Run `npm run dev` and open `http://localhost:5173/`. Enter the universe, select HIDDEN WORLDS, CREATE or reopen a personal world, then choose **Explore Mode**. Saved characters and actual graph links are reused. Pan by mouse/touch drag; wheel or pinch zooms; character selection focuses the view; follow a Connected pathway then use Back to previous discovery. Escape/Close clears selection; Reset view restores the overview. The pencil icon returns to editing, diamond saves, return icon opens MY WORLDS; each keeps its accessible name/title. The exact-image hub is unchanged, and this is a bounded local character space, not multiplayer, public world synchronization or an unlimited 3D universe. No new download/export feature or language policy is introduced.

# Latest — light fantasy administration and explicit permanent deletion

The authenticated workspace now uses ivory/sage, a horizontal brand/account header, collapsible mobile navigation, real four-card metrics, recorded seven-day activity, recent central-character/editorial-world tables, system availability and working quick links. It reuses existing local artwork as decoration; no reference screenshot UI or mock metrics are rendered. Login remains the existing dark cosmic experience.

Administrator UI uses a separate English catalog (`src/admin/i18n.ts`, `messages.en.ts`) and deterministic en-US/UTC number/date utilities. This follows the existing public dictionary pattern while intentionally leaving public language selection/storage alone. Only English is enabled; additional catalogs/selector are future work. User content is not translated.

`GET /api/admin/fantasy-overview` reports server administrator accounts, nonarchived central characters and all server editorial worlds. It does NOT count private browser worlds/assets or public visitor identities. Storage metering/quota, visitor analytics, reports/inquiries and recorded backups are unavailable, explicitly labeled. Charts aggregate actual revisions/central activity; recent queries are bounded. Old dashboard/overview API contracts remain available.

Permanent deletion is opt-in and separate from archive:

- `POST /api/admin/worlds/:id/permanent-delete`: `{version, confirm:"DELETE PERMANENTLY"}` deletes the world, its discoveries and connections with either endpoint in those discoveries, in one SQLite transaction. Other worlds/discoveries, central originals, accounts and browser stores stay intact. Media are external references, not world-owned server files; they are not deleted.
- `POST /api/admin/library/characters/:id/permanent-delete`: same body; removes central metadata and this original's dedicated revision/preview files. Other character records' file/preview keys protect shared files. Unsafe paths/symlinks and server editorial content still linking to the source block deletion. Browser placements cannot be enumerated. Existing local snapshots still render; fetching the removed central source returns404.
- Existing `DELETE /api/admin/library/characters/:id` with `confirm:ARCHIVE` retains its previous soft-archive contract and files.

File consistency: bounded synchronous quarantine moves do not yield while a SQLite transaction is open. Exceptions before commit restore files and roll back. A private precommit journal supports recovery on retry after an interrupted move. After commit, a durable `permanent_deletion_jobs` receipt tracks cleanup until physical purge succeeds; a cleanup error returns503, never success. Retry the same target/version; pending receipts are visible under System Settings via authenticated `GET /api/admin/deletion-jobs`. Lazy additive job schema is created only by an authorized confirmed delete; original schema/seeding/auth files are unchanged. Audit revisions and existing backups are deliberately retained; deletion is not erasure of external backups or browser copies.

Keep the database and entire private file root together in backups. Do not manually remove `.deletions` journals while recovery is pending. Filesystem/SQLite do not offer distributed ACID; interrupted cleanup requires retry/operator review, not a fake success. No real user account/content was deleted for verification. No new world export/download flow or paid AI call.

---

# Cosmic administration and the central character library

`/admin/login` now uses the supplied cosmic artwork with a real glass sign-in form; onboarding and the single-email policy remain. `/admin` uses real server metrics, an editorial world/relationship SVG overview, recorded activity, central-type distribution and working navigation/actions. Analytics explicitly excludes untracked public visitors and browser-only worlds. Source artwork is decorative, never a fake form, chart or content record.

**Administrator flow:** Characters → Upload Character → choose/drop file → inspect actual image/3D preview → enter name/description/type/tags/source → optionally upload a preview image → choose public active state → Save. Edit metadata, replace files/preview or uncheck publication. Archive requires confirmation and hides the original from new public reads. Source files remain retained; physical purge is deliberately unavailable because anonymous browser-world references cannot be enumerated.

**Public flow:** HIDDEN WORLDS → CREATE → Central Library → choose an active original → actual preview → Add to world → edit placement/scale/content/relationships → Save. No admin session is needed to browse or use published originals. Personal Upload Character remains separate. A verified IndexedDB copy is stored before placement, with central ID/version in the V2 character graph. Existing instances keep their saved name/appearance/file snapshot when the original changes, is deactivated or archived. New selections receive the current published version. This is snapshot reuse, not automatic remote replacement or cloud world synchronization. Older V1 worlds keep their original editor; no forced conversion.

Storage uses the existing SQLite DB for lazily/additively created `central_characters` and `central_activity` tables. Original PNG/WebP/JPEG/GLB/glTF files and generated/selected WebP thumbnails are private filesystem files, **not SQLite BLOBs**. Default directory is `character-assets` alongside BEYOND_DB_PATH (normally `.local/character-assets`). Optional server-only `BEYOND_ASSET_DIR` may select protected `.local` or a persistent directory outside the project. Public/dist/other served project-source paths and public symlink targets are rejected. Vite denies direct filesystem access; originals are served through validated public-active or admin-authorized API routes. Back up **both the DB and complete character-assets directory**, including retained revisions. Do not change paths without moving the files. No new environment value is required for the standard local DB path; existing ADMIN_ALLOWED_EMAIL remains mandatory for admin access.

Limits: images8 MiB/4096px/16MP, model16 MiB and existing150k vertices/100k triangles/250nodes/12textures limits, optional preview2 MiB. Server verifies file signatures, actual image decode, embedded texture decode and model resource/index/buffer bounds. Central models must be regular self-contained glTF2.0/GLB with embedded resources, without Draco/Meshopt/KTX/DDS, sparse accessors or unsupported required extensions. No automatic 3D/rig conversion or animation playback is added. Sharp0.35.5 is a server-only dependency for safe decode/thumbnails.

Caught upload/commit failures clean newly written files and roll back rows; simultaneous server validation is bounded. Filesystem and SQLite cannot form one crash-atomic transaction: abrupt process/power loss can leave an unregistered revision directory. No automatic destructive cleanup is run; operator reconciliation/backups are future work. Retained historical originals consume disk until an explicitly designed safe purge is available. Existing local backup/export policy is unchanged; no new whole-world download UI is added.

API contract and test evidence are in VERIFICATION.md. No actual user account or personal library was migrated, no paid image request, commit, push or deployment was performed.

---

# First administrator password — local setup

If `/admin` says **Set your first administrator password**, there is no registered administrator/password. The configured email alone does not create an account. No default password exists.

In a terminal, run:

```sh
cd /home/administrator/internet_project/beyond
npm run admin:setup
```

The command reads the already configured `ADMIN_ALLOWED_EMAIL` from the server environment/ignored `.env.local`; no email argument is required. Type your chosen password twice at the hidden prompts (12+ characters, at most256 bytes). Do not paste it into chat, put it in a command, env file or password file. Only scrypt is stored. Refresh `/admin` or click **Check setup again**, then sign in with the configured email and chosen password. Registration does not itself create an authenticated browser session.

The command refuses missing/invalid config, another email, mismatched/invalid passwords and existing administrators. It cannot overwrite or reset an account. An optional explicit email argument remains supported but must match the configured email. Scripted isolated tests provide two matching stdin lines; human operators should use the interactive hidden prompt. No web signup/setup write endpoint is introduced: knowing the configured email does not let an unauthenticated visitor claim the first account.

`GET /api/admin/setup-status` exposes only coarse onboarding state/method (configuration_required, initial_setup_required, ready, operator_review_required), never email, password/hash, account IDs or an authorization token. Login without an enrolled account returns409 and setup guidance. Missing config still returns503 for login and blocks protected APIs. Existing/mismatched accounts show review guidance rather than signup. If environment values change, restart the server; creating the account in the same DB only requires refreshing the browser.

**Password recovery:** if the current password is known, use the existing authenticated System Settings password change. If it is lost, email reset is not implemented; arrange a separately authorized server-operator recovery procedure. Do not delete/replace the database or an account to bypass authentication. No recovery/reset operation was needed or performed here.

Actual diagnosis for this task: configured email valid, configured SQLite has0 admins/0 password records; real localhost reports initial_setup_required. No actual account/password was created by the agent. Previous configuration-missing notes below are historical. Tests and screenshots: VERIFICATION.md.

---

# Private administration — single allowed email

The existing `/admin` now provides Dashboard, Users, Characters, Worlds, Content and System Settings. Existing Discoveries/Connections editors and their URLs remain available. Cream/sage/terracotta styling is scoped to administration; the public universe and local character editor are unchanged.

**Required operator decision:** set `ADMIN_ALLOWED_EMAIL` to exactly the intended administrator's email in ignored `.env.local` (no `VITE_` prefix), then restart the server. No actual email was selected or configuration file edited by this task. Missing/invalid/multiple-email configuration denies administrator access, including existing sessions. Login returns503 with a configuration message; private APIs return401. Existing SQLite accounts are not renamed or deleted. If an account exists, configure its intended email; do not attempt bootstrap to overwrite it. Multiple unexpected admin rows also fail closed and require operator investigation.

For a new empty installation only, configure the email first, then run `npm run admin:setup -- <the-configured-email>` interactively with a hidden password prompt. Both setup and `npm start` read `.env` then `.env.local`; Vite privately loads the same server-only setting. Setup rejects other emails and additional accounts, including concurrent bootstrap. There is no public administrator signup, invitation, password email reset or visitor-account system. Existing scrypt, session expiry, HttpOnly/SameSite/Secure production cookies, persisted login limits, exact-Origin and CSRF protections remain. Sessions and all protected admin/AI requests recheck the allowlist. The UI also clears an expired session.

Data scope is explicit:
- Users lists only actual server administrator accounts, with search/status/details and active session count. It does not invent visitor profiles or provide enrollment/status mutation.
- Characters lists only stored SQLite AI image assets, with owner, format, size, creation time and an authorized preview. Missing character names/placements/usage remain unavailable. No paid image request is made by the dashboard. Deletion is unavailable because references in local worlds cannot be checked centrally.
- Worlds lists/edits real editorial worlds and creation/update dates. Owner is Not recorded and local character counts are Not centrally stored because the server has no such fields.
- Content and the retained Discoveries/Connections editors manage the actual SQLite records with existing revision/confirmation rules.
- System Settings shows server configuration presence (no secret values), storage scope/session state, existing password change and default-language configuration. It cannot change the allowed email or secrets.

The existing ten user characters, uploaded files, graph relationships, backups and local worlds are not uploaded or enumerated by administration. Browser IndexedDB/localStorage remain local. Central asset/world management would need an explicit authenticated ownership, upload/storage, reference/backup and migration design; no such large migration was performed. See VERIFICATION for fixture-only runtime evidence and limitations.

---

# Character export and world backup

Use **Export Character** on a selected uploaded character or in Upload Character → library. Use **Import Character** in that library to validate/preview and confirm a portable character package. Use **Export World Backup** in the editor (includes current unsaved graph) or MY WORLDS (last saved version). **Restore World** in MY WORLDS validates a package and opens a new local world. EN/ES labels follow the existing locale.

Packages are version1 BEYOND ZIP files with uncompressed entries: `manifest.json`, `world.json`, `assets/<UUID>.<format>`. Keep the downloaded ZIP unchanged; do not recompress it. Maximum80 MiB,42 entries; original image/model upload limits still apply. Manifest records asset metadata, sizes and SHA-256 hashes. CRC32 checks archive integrity. Neither checksum proves publisher identity. Originals, notes and source URLs can be personal: store backups privately. No encryption is implemented.

Restore makes new UUIDs and remaps graph/content/asset references. It copies only assets actually used by that world. Same exact package is deduplicated to its previous import, without overwriting edits. Original worlds/assets remain. Binary inserts use one IndexedDB transaction; if localStorage world commit fails, newly added binaries are rolled back. A sudden browser/process termination between these separate stores can leave unreferenced new assets; this is not a cross-store atomic transaction. Export is a prepared browser download, not confirmation that a user saved it to disk.

Portable uploads support PNG/WebP/JPEG, GLB and embedded-resource glTF. Private server AI image assets are deliberately refused instead of silently omitted. Character-only packages containing references to other characters require a full world backup. Portals to other worlds outside the package retain their original IDs; those external worlds are not included. No cloud sync/auth/SQLite migration or paid request is introduced. Test evidence and remaining limits: VERIFICATION.md.

---

# External character import (local)

Open HIDDEN WORLDS → CREATE → **Upload Character**. Pick/drop PNG, WebP or JPEG (up to8 MiB), or GLB/self-contained glTF (up to16 MiB). GLB is recommended; separate glTF texture/bin files and compressed geometry/texture formats are not supported. Preview must load before registration. Edit metadata, save to library, place into the current world, connect and save using the existing editor. Open another world to reuse the same library asset.

Original files and metadata persist in browser IndexedDB `beyond-character-assets`, store `assets`; localStorage world graphs reference their UUIDs. This is local to the browser/origin, with no server synchronization or backup/export. Clearing browser storage removes imports. Existing SQLite private AI storage remains separate and protected. Removing an instance does not delete its original; deleting originals is blocked while current/saved worlds reference them.

No OpenAI configuration or paid call is required for uploads. Existing optional AI remains available under its original server authentication. See VERIFICATION for actual tests and format/rendering limits.

---

# BEYOND — The Internet Within the Internet

A public discovery universe and private editorial workspace in one React/TypeScript/Vite/Three.js project. Node and SQLite provide real shared persistence; no paid service or visitor account is required. The neighboring Jalisco/NopaHua project is not used.

Read [AGENTS.md](AGENTS.md), [STATUS.md](STATUS.md), [NEXT_SESSION.md](NEXT_SESSION.md), [DESIGN.md](DESIGN.md), [DECISIONS.md](DECISIONS.md) and [VERIFICATION.md](VERIFICATION.md) for current decisions and evidence. Older entries are explicitly historical.

## Current exploration entry

ENTER THE UNKNOWN opens `/explore`: the exact supplied reference artwork with six interactive landmark regions and animated localized titles. Selecting one opens its existing 3D destination. The preserved walking hub remains at `/explore?view=walk`. Portrait supports a swipeable panorama and full-artwork overview. See DESIGN and VERIFICATION for accessibility, evidence and visual limitations.

## Local world creation

From `/explore`, choose HIDDEN WORLDS, then its crystal CREATE region. Enter a name and description before entering the visual editor. New worlds open a real3D spirit composer: add characters, connect their pathways, attach content, Save and reopen through MY WORLDS. Existing version1 vector-object worlds retain their original editor. Saved-world URLs retain a `creation=UUID` query and work only in the browser/origin containing that world. Refresh restores the last explicit save. Existing old draft and bookmark data remain separate. No server synchronization, public publishing or shared-world authorization is implied. See DESIGN/VERIFICATION for controls, evidence and limitations.

## AI character images (optional server feature)

Set `OPENAI_API_KEY` in ignored `.env.local` (never `VITE_*`); do not commit or print it. Restart development server after setup. The official OpenAI SDK uses `gpt-image-2.5-sunburst` by default; optional `AI_IMAGE_MODEL` overrides it. [Official generation reference](https://developers.openai.com/api/reference/resources/images/methods/generate). Keys and usable billing/model access are required; trial$0 does not prove access. This implementation has not been live-generated against the user's account.

CREATE A CHARACTER in the spirit editor requests the server, previews a returned image and only adds it after confirmation. Manual templates work without AI. Existing authenticated server session is required for generation and private image reads; anonymous visitor auth/subscriptions are not implemented. Operator policy defaults3/20 reserved-or-completed images perUTCday, configured by AI_IMAGE_FREE_DAILY_LIMIT / AI_IMAGE_PREMIUM_DAILY_LIMIT and trusted AI_IMAGE_PREMIUM_CREATOR_IDS. No payment collection. Provider charges are independent of these application quotas.

Images are stored privately in the persistent SQLite DB selected by BEYOND_DB_PATH; world metadata remains browser-local. Keep the DB and same-origin server to reopen images, and sign in again if the session expires. No ephemeral provider URL dependency, automatic regeneration, full3D rigging or server-synced worlds. A persistent production volume/backup and HTTPS APP_ORIGIN remain deployment prerequisites; no deployment performed. `npm start` loads `.env` and `.env.local` server-side. See VERIFICATION for exact mock-only test evidence and current missing-key/credit blockers.

## Local setup

Requires **Node 22.23+** (tested 22.23.2) with `node:sqlite`, currently experimental in Node 22, and npm. Use the lockfile on a fresh checkout:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Vite dev and preview mount the same local API. On first API access SQLite creates schema/seed version 1 and six-world migration version 2 idempotently. Default storage is `.local/beyond.sqlite` (ignored), with restrictive directory/file permissions. Back up the database and its WAL consistently before future migrations. Never commit local DBs, credentials or `.env`.

Create the first editor manually in a separate terminal:

```sh
npm run admin:setup -- your-email@example.com
```

Enter a unique password at the hidden terminal prompt (minimum 12 characters). No default credential or public admin signup exists. The command refuses to create another initial admin once one exists. It does not print the password. Visit `/admin/login`; protected `/admin` redirects there when unauthenticated. Password changes require the current password and revoke existing sessions. There is no email reset/multi-admin invitation implementation yet. No real operator account was created by this task.

Optional `.env` configuration is described by `.env.example`: `BEYOND_DB_PATH` selects persistent storage, `APP_ORIGIN` selects the exact allowed origin. Neither uses a `VITE_` client prefix. With no explicit origin, development accepts the current localhost/127.0.0.1 port. Restart after changing environment configuration. A different database path starts a distinct store; configure the same path for setup and serving.

## Build and serve

```sh
npm run typecheck
npm test
npm run test:server
npm run build
npm run preview
```

`npm start` serves `dist` and APIs through the Node server on loopback port 4173. For a future production host, place it behind a TLS reverse proxy, supply a persistent backed-up volume and set the exact HTTPS origin:

```sh
NODE_ENV=production APP_ORIGIN=https://your-real-domain.example PORT=4173 npm start
```

This is an illustrative operator command, **not a deployment performed by this task**. Production uses Secure `__Host-` cookies; HTTPS is mandatory. The old `.openai/hosting.json` static Sites manifest is preserved but cannot host this new SQLite backend on its own. No hosting/authentication settings were changed or deployment performed.

## Public exploration

The animated landing retains one **ENTER THE UNKNOWN** action, now entering `/explore`. The second screen is one continuous procedural Three.js scene: six persisted destinations around a compass terrace with actual connecting walkways. Golden branching arches, a crystal sphere, moonlit ruins, a garden/waterfall, a luminous future city and a library/orb interpret the reference composition. This is **stylized procedural geometry, not a photorealistic replica or a flattened reference image**.

WASD/arrows and touch controls move; drag looks; clicking/tapping destinations or keyboard-accessible destination buttons moves along paths. Manual movement interrupts automatic travel without forced rotation. Near a destination, contextual hints and a discovery list appear. Published discovery markers use local coordinates and open the same content panel as the accessible list. Closing a panel preserves the scene/camera position. Reduced motion removes ambient movement and uses immediate deliberate destination changes. WebGL failure leaves accessible destination/content controls.

The original four worlds, eight discoveries, direct world/discovery routes, portals, bookmarks, history, sharing and EN/ES remain. Only six `hubKey` destinations inhabit the new hub; legacy worlds remain separate accessible routes. Personal collections remain browser-local `beyond:v1:*` data. Public/admin content comes from `/api/public/universe` and the same SQLite records; no disconnected admin array or silent bundled fallback is used. Focus refresh updates content after edits; world switching does not refetch per click.

## Editorial model and security

Worlds support stable IDs, slug aliases, publication states, theme/color/order and bounded hub placement for the six supported scene motifs. This is not a general 3D scene editor. Discoveries support EN/optional ES content, structured paragraphs, evidence/interpretation/questions, described HTTPS sources, source review, factual/hypothesis/fictional classification, uncertainty, publication states, coordinates and revisions. Hub discoveries use local X/Z ±4 and Y 0–6; the visible marker is elevated above the island surface. The scene caps markers at 24 per destination; the accessible list still exposes all eligible records.

Only authorized editorial actions can verify. New factual publication requires verification and sources; hypothetical/fictional content requires explicit hypothetical status and uncertainty. Rejected/draft/archived content is excluded publicly. The eight originally public discoveries remain visible **labelled Requires review**, not falsely verified; changing their claims/sources or unpublishing removes this grandfathered visibility. Six new hub destinations contain no fabricated published discoveries, so initially show honest empty states. Initial admin totals are 11 worlds (6 hub + 4 legacy + 1 draft Signal) and 9 discoveries (8 legacy published + 1 editorial draft); public totals are 10 worlds/8 discoveries. Counts change with real edits.

Relationships reference real stable IDs, reject duplicates/self-links, preserve editorial explanation and revisions. Archive/unpublish substitutes for destructive content deletion. Slug aliases preserve old links. Optimistic versions reject concurrent stale updates. Lists search/filter/paginate by 10.

Passwords use native scrypt; sessions are random, server-stored as hashes, expire after 8 hours, and use HttpOnly/SameSite Strict cookies. All admin endpoints recheck authorization. Mutations require exact origin, JSON and a session CSRF token. Login has persisted account/IP rate limits. Body limits, safe URLs and escaped text are enforced. No AI question engine, biometric authentication, external identity provider or fake verification is implemented.

## Browser verification

```sh
npm run test:browser
```

Use an installed Playwright Chromium. This particular host requires:

```sh
LD_LIBRARY_PATH=/tmp/jalisco-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run test:browser
```

Server/admin tests create disposable databases and generated fixture credentials, never real accounts. See VERIFICATION.md for actual results, screenshot evidence and limitations. Physical devices, the user's Google Chrome profile, production TLS proxy and live deployment are not verified by these local tests.

## Current local development / Git state

The current task is local development only. No deployment, hosting/domain/paid service setup, commit or push is performed. Existing code commits remain intact. `origin` is now configured to https://github.com/itachi486/beyond.git and the local main/origin-main refs match at the start of this review; this is local metadata, not a fresh remote permission check. Earlier push403 records are historical and current GitHub write access was not tested. Do not retry push or change authentication as part of local quality work.

Current quality fixes and actual new checks are recorded at the top of STATUS.md, NEXT_SESSION.md and VERIFICATION.md. Launch locally with `npm run dev` and use http://localhost:5173 (an existing server was already running during this task).


## 2026-10-30 — Preview world image partial edits

Added Preview-only location selection/zoom, normalized coordinate and published-character context forwarding, visual analysis, 512px neighborhood mask inpainting, full-resolution outside-mask pixel preservation, immutable private original/candidate versions, explicit approval and version conflict checks. Existing admin authentication/CSRF and AI budgets remain authoritative. Original personal-world/character graph records are preserved; containing worlds remain browser-local, while successful edit versions use Preview D1/Tigris.

Actual house generation is NOT verified: deployed workers.dev navigation failed with TLS reset/timeout; local workerd using the real remote AI binding returned HTTP502 after a TLS reset. No generated house, real approval or real generated-house reload is claimed. Local selection/zoom screenshots are real; provider-fixture persistence tests are labelled as such. Build and unit36/36, Cloudflare23/23, selected existing browser6+2 and new fixture browser1 pass. Discovery test expectations were corrected for the existing error wording and asynchronous reply setup.

See [WORLD_EDIT_VERIFICATION.md](cloudflare/WORLD_EDIT_VERIFICATION.md) for exact models, files, limits, evidence, final remote preservation audit and remaining test. No Production Worker/D1 changes, commit/push/reset or original artwork edits. Branch main, HEAD f4585907ecb8158eafd61cc769c4c31e94d102c0. Extensive existing uncommitted work remains. Resume by inspecting final-audit.json and repeating ONE bounded actual request once Preview/AI transport recovers; do not reset quotas, accept model licenses automatically, or deploy production.


## 2026-10-30 — Actual world editing verified with Klein

Supersedes the preceding inference-unverified handoff. Actual Preview AI returned two FLUX.2 Klein4B edits; first white-base result rejected, refined grounded house visually reviewed and approved via real Preview API. Final generation4.883s; original/candidate Tigris writes and D1 save passed. Exact original/hash checks passed, outside-mask changed pixels0, full1672×941 retained. Approval200, reload and page reconnect retained real texture, coordinates, original lore/content request and byte-identical original browser world. Browser exceptions0.

Root causes separated: client workers.dev/remote-binding proxy TLS reset; actual internal Llama Vision5016 license requirement before SD/storage; LLaVA analysis did not complete. Native SD inference is not declared unsupported or successful. Tested fallback uses one terrain reference504px, correct multipart, 512px output, mask-only compositing and inside-edge feathering. No fabricated text analysis or automatic license acceptance. Budgeted single transient retry added; no ambiguous-timeout retry. Preview default selects Klein.

See [actual verification](cloudflare/WORLD_EDIT_ACTUAL_VERIFICATION.md), private world-edit-diagnostics/browser-result.json, actual images/screenshots and final-audit.json. The successful UI used current local UI + temporary queued transport into real deployed Preview API/AI/D1/Tigris because direct workers.dev ingress remained unavailable. No mock inference is used for the success claim; direct remote browser smoke test remains pending. Containing personal worlds remain browser-local.

Final normal deployment removes the temporary Preview diagnostic cron and QA-only extra4-reservation allowance; ordinary3/day limit and all usage remain. Existing daily cap was already exhausted; next reset2026-10-31 06:30 Asia/Rangoon. Build, unit36 and disposable Cloudflare26 pass. No Production Worker/D1 changes, commit or push. Source originals/admin accounts untouched; main/HEAD f4585907ecb8158eafd61cc769c4c31e94d102c0 retained. Resume from actual report and final audit; do not restore temporary diagnostic schedules or silently regenerate.


## 2026-10-30 — Normal Preview browser verification complete

Direct workers.dev Chromium test now PASS with normal DNS/TLS verification, real existing-password form login200, MY WORLDS selection, real Klein generation200(8.944s browser/5.401s model), approval200, reload and full browser restart/reconnect(session200), logout200. No request interception, fake AI, local UI or diagnostic transport. Actual outside-mask changed pixels0, original/result hashes matched, original world records unchanged, browser exceptions/request failures0. Prior TLS reset is not currently reproducible; exact historical network cause remains unproven.

Improved status/error messages and durable authenticated rejection via existing ledger; real reject200 persists after reload without changing approved image. Final limit3 restored after one additional actual generation; real429 error UX passed without inference/version changes. Klein remains default; no Llama agreement or SD default change. Build, unit36, integration26, focused browser1 pass.

Final release61c0e27f-5a65-4e14-8514-4b6856d49e39 at100%. Independent audit: Production deployment unchanged;10 protected Preview tables unchanged; Production D1 not accessed; schedules0; diagnostic variables0; pending0. Earlier diagnostic entrypoints archived privately and removed from active .local paths. Temporary password file deleted; actual sessions logged out. No commit/push/Production deploy; main/HEAD f4585907ecb8158eafd61cc769c4c31e94d102c0 unchanged.

See [normal browser verification](cloudflare/PREVIEW_DIRECT_VERIFICATION.md), private direct-browser/result.json, after.json, actual screenshots/image and limit-result.json. Personal-world cross-device sync remains outside scope; current daily AI limit exhausted until2026-10-31 06:30 Asia/Rangoon. Task completed; no scheduled continuation. Preserve existing dirty work.


## 2026-10-31 Asia/Rangoon — Image Management complete (Preview only)

Preserved10 original admin routes/features; appended independent /admin/images and six category routes.11 consistent semantic sidebar SVG icons. Added real multi-upload,8MiB PNG/JPEG/WebP validation, paged/searchable gallery, English metadata/rights, published/unpublished, immutable original replacement, confirmation and retryable cleanup. One additive managed_images table reuses D1 CAS/auth and private Tigris with durable upload/delete receipts. No marketplace, Supabase or R2.

HIDDEN WORLDS publication requires explicit manual nature-only review. Published images only reach public categories. Starter selection copies original bytes/hash into an independent existing IndexedDB asset plus optional User World reference; source replacement/unpublish/delete leaves old user-world image/description intact. Portable backups include/remap starter snapshots. Old worlds/characters/native3D preserved.

Checks: build/typecheck; Vitest37; Cloudflare28; related browser15 pass. Final small DTO change reran only2 image API tests; added starter ZIP assertion reran only1 browser file. Actual normal Preview login/upload/review/publish/replace/metadata/unpublish/delete/anonymous starter snapshot after deletion all passed; page exceptions0. Source tables, AI history and old Tigris keys/sizes unchanged; QA rows/files cleaned to0; cron0. Final release1c8fcbcf-3668-4bdf-8b59-1eb481970c03 at100%. No Production Worker/D1 change, commit or push. Private password file deleted.

See [Image Management verification](cloudflare/IMAGE_MANAGEMENT_VERIFICATION.md) and private image-management/{browser-result,after}.json/screenshots. Nature suitability remains human reviewed; personal worlds are local; native3D/sales are outside scope. Existing20k-row compatibility guard remains. Schema was applied only to Preview; any Production rollout needs separate approval and migration. main/HEAD f4585907ecb8158eafd61cc769c4c31e94d102c0 unchanged; preserve pre-existing dirty work.

## Preview free member accounts (2026-10-30)

Public `/explore` remains open. Member account routes and owned cloud worlds are available only on the isolated Cloudflare Preview. Real email requires Preview `RESEND_API_KEY` and verified-sender `AUTH_EMAIL_FROM`; keep these server-side, outside Git and VITE variables. Without them registration/recovery return503 and verification cannot be bypassed. Additive migration0004 must precede this Worker version; it has been applied only to Preview. Do not deploy this to Production without separate authorization and review. Existing local worlds are preserved; sign in and explicitly import from `/my-worlds`. Account saves confirm D1 persistence before success; media uses immutable private Tigris objects. See [verification, tests, architecture and remaining limits](cloudflare/MEMBER_ACCOUNTS_VERIFICATION.md). Run disposable member browser checks with `npx playwright test --config playwright.member.config.ts`; captured test mail/in-memory media are not real delivery/Tigris.

## Latest Preview registration/Users policy (2026-10-31)

This supersedes earlier verification-required setup notes: ordinary registration uses email, unique username and password, starts a secure session immediately and does not send mail. Optional RESEND_API_KEY/AUTH_EMAIL_FROM are for password reset only. Existing admin Users route now manages actual member accounts; migration0005 is installed only in Preview.30-day deletion recovery and owned-prefix cleanup preserve shared originals. Preview remains on Workers Free by explicit user choice; runtime CPU10ms can still cause platform HTML503 despite optimized reads and safe UI parsing. Large image editing requests exceeding existing3MiB cap return413 before inference. No Production rollout. [Exact release, test results, screenshots, safety and limitations](cloudflare/SIMPLIFIED_MEMBERS_VERIFICATION.md).
