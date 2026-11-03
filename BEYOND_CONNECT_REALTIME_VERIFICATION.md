# CONNECT real-time implementation — 2026-11-03

## Scope and source preservation

User attachment `54ef1ce1-a866-4e2f-b381-6f2527c98926/Pasted text.txt` is the implementation brief; the supplied numbers, avatars, names and example posts are artwork, not live data. Work started at `f8df80ba8d074fd67ca6694a2d73dd0450c98eba`, preserving the dirty tree, on feature branch `feature/connect-realtime-20261103`. No main modification/push, Production deployment, B10 activation, billing change, AI call, or existing image/object deletion.

Baseline: `/tmp/beyond-social/baseline.json`, status-before and preservation.json. All 403 baseline files remain; only 12 pre-existing files related to this task changed. Existing unrelated dirty/untracked work remains. An alternate Git index selects HEAD plus only CONNECT hunks in the shared handler, HiddenWorldsPage and Preview config; existing administrator/AI/B10 implementation changes are not swept into this commit. The Preview config additionally preserves the already-active administrator principal flag, shared9000 budget and disabled per-account3-image limit; these known runtime settings must not regress to stale HEAD values when deploying CONNECT. Selected source builds independently in `/tmp/beyond-social/git-review/source-final`.

## Backgrounds and real UI

- Hub: original `Beyond Worlds Connect Hub.png` → `public/connect-hub-reference.png`.
- Feed: original `Cosmic Social Feed Above Floating Islands.png` → `public/connect-social-reference.png`.
- Both are exact copied PNGs; browser checks compare SHA-256 against the originals. No generated replacement, circular crop or segmented background cards. Hub retains one full artwork panorama, with swipe/pan on narrow screens. Feed uses the original full-scene image with responsive cover positioning.
- Baked sample names/counts/posts are masked/blurred and replaced with server-derived information. Artwork scenery is decorative: its depicted island names are not additional groups or membership claims.
- Only CREATE's saved choices (maximum three) produce interactive group entrances. CONNECT does not offer a second selector. Exactly six canonical groups retain the existing official image UUIDs and group IDs. Two former unavailable definitions are archived in SQL before removal, and removal refuses any existing selection/membership referencing them.
- Hologram-style recent messages, compact composer, author-only edit/delete confirmations, history pagination, Unicode text and local display times. React renders text safely. Mobile keyboard offset and reduced-motion support included. Animation runs after enqueue/send and cannot gate network dispatch.

## Server and persistence

New `connect-access.mjs`, `connect-messages.mjs`, `connect-social-api.mjs`, `connect-room.mjs`; existing connect-api reuses the same actor/session resolver. `ConnectRoom` is one SQLite Durable Object per canonical global group, with WebSocket Hibernation. No paid external service or AI call.

Existing member/admin sessions remain authoritative. The Worker derives actor/owner/session identity, not client payloads. WebSocket Origin must match; REST writes retain Origin+JSON+CSRF. Selection+active membership+fresh session are checked on join, incoming commands and outgoing recipients. Audience auth is cached per session hash, not merely owner ID: revoking one session cannot borrow another session's validity.

Online is the unique authorized owner count among live room sockets seen within 65 seconds; it is not registered members, global site visitors or baked artwork numbers. Heartbeat20 seconds, expiry/alarm30 seconds, typing6 seconds. Maximum3 connections per owner/300 per room; successful mutations60 per owner/minute, plus100 socket frames/10 seconds per connection. These are abuse controls, not AI budgets. Free quotas still apply; large-scale/load behavior is not proven.

`0009_connect_social.sql` adds durable messages, server sequence, revision, events, operation receipts and temporary anti-spam windows. Message+event+receipt+rate updates share one D1 atomic batch guarded by current access/CAS. ACK occurs after D1 commit. Retry uses the same operation/client ID and immutable original send hash, including after edit/delete. No automatic message expiry. Delete leaves a tombstone; events reference current content rather than retaining old plaintext copies. Existing 30-day account deletion policy is unchanged: pending denies access but retains data; final profile deletion anonymizes/clears authored messages and emits a deletion event.

Reconnect uses an event cursor, paginated missed events, revision merge, stable server ordering and dedupe. Live messages do not incorrectly advance the catch-up cursor. Account-pinned drafts/outbox use captured account namespaces and auth epochs. Queued operations are retained until ACK; ambiguous network errors do not create new operation IDs. History pages query the server; live client view is bounded at200 messages without deleting stored history.

## Local verification

| Check | Actual result |
|---|---|
| Cloudflare standard runner `npm run test:cloudflare` | PASS:27 test files,0 failed. File-isolated runner reports files; do not inflate this into an invented assertion total. |
| CONNECT service tests, `node --test --experimental-test-isolation=none cloudflare/tests/connect.test.mjs cloudflare/tests/connect-social.test.mjs` | PASS:24 tests, including11 new social tests. These overlap the27-file run. |
| Frontend `npm run test` | PASS:78 tests/15 files, including3 merge tests. |
| Server `npm run test:server` | PASS:101 tests. First sandbox run failed due local-port restrictions; rerun with local network permission passed without test changes. |
| Existing CREATE/CONNECT browser suite | PASS:3 tests against disposable adapter fixture. Updated6-group contract and unavailable real-time guard verified; not remote DO evidence. |
| New browser suite against local workerd+D1+SQLite DO | PASS:3 tests: two-account messages/presence/edit/delete/history/offline/reload; cross-group denial/typing/revocation/animation failure; same-owner unique count/session-specific logout/wrong-Origin rejection. Local runtime, not deployed Cloudflare evidence. |
| TypeScript/build | PASS:`npm run build` includes tsc; full working tree and independently selected commit source both build. Existing >500kB chunk warning remains. |
| Alternate all-files no-isolation experiment | NOT A PASS:41 registered tests cancelled with `Promise resolution is still pending but the event loop has already resolved`. The existing normal file-isolated runner above passed; do not combine counts or hide this harness incompatibility. |

Repeated local signup runs also reached the existing authentication IP throttle (429). No authentication limit was weakened; fresh isolated fixtures and reusable QA credentials were used for the final passing run.

Local visual evidence: `/tmp/beyond-social/local-feed-desktop.png`, `local-feed-tablet.png`, `local-feed-mobile.png`; Hub one/three/mobile in `/tmp/beyond-connect/`. Mobile width390 and tablet820 have no document horizontal overflow; Hub intentionally pans its artwork internally. Reduced-motion and animation failure preserve send delivery. IME guard exists; actual human IME/assistive technology and full international load tests remain NOT TESTED.

Logs: `/tmp/beyond-social/` service-tests.log, connect-service-final.log, cloudflare-tests.log, cloudflare-detailed.log, frontend-final.log, server-tests.log, gallery-browser.log, local-browser-final.log, build-final.log, isolated-build-final.log.

## Preview application and outstanding remote evidence

PASS: before migration, a real Preview D1 export was created at `/home/administrator/beyond-backups/connect-social-2026-11-03/before.sql` (0600,2,584,802 bytes). It is private and must never enter Git. Guarded Preview-only0009 execute succeeded; no0006/B10 migration. Preview deployment succeeded:

- Worker `beyond-cloudflare-preview`.
- Version `7b16e328-bf97-4e35-a590-41940b4ad10e`.
- D1 `beyond-migration-preview`, UUID `5b21c5ee-c783-40a4-b5ec-6e086b1aa6ed`.
- New `CONNECT_ROOMS` SQLite DO binding/migration and `CONNECT_REALTIME_ENABLED=1`.
- Existing Tigris `beyond-preview`, secrets, model, shared9000 AI budget, disabled3-image count and retention cron remain unchanged. B10 OFF.

BLOCKED: normal Preview browser end-to-end is NOT verified. First remote attempt registered QA accounts and saved choices, but the universe did not finish loading. Subsequent Node requests and normal Chromium navigations failed with `EAI_AGAIN`, `ECONNRESET`, and `net::ERR_CONNECTION_RESET`. Browser same-origin fetch was tried without interception, TLS bypass or diagnostic relay; navigation still reset. A fixed-DNS-address read-only TLS test also reset (HTTP000). Later `api.cloudflare.com` and `github.com` DNS queries returned `EAI_AGAIN`, demonstrating this session's broader network failure, not proof of a Worker defect.

BLOCKED: post-deployment protected-table hashes, actual remote six-group read/count/presence, real D1/DO message roundtrip, and Production active-version recheck could not be completed after DNS failed. Pre-deployment hashes are in `/tmp/beyond-social/remote-before.json`. Protected tables: worlds, discoveries, connections, managed_images, user_worlds, admin_personal_worlds, user_world_assets, workers_ai_requests. Do not claim post hashes equal or actual remote message persistence until checked. Deployment/migration success is distinct from live functional success. No real-user deletion/edit, image generation, image upload or Tigris PUT/DELETE was performed. QA signup/CREATE participation is limited to newly created test accounts; prior data is retained.

Production last verified before this deployment: `ab62838a-ddbb-4970-8c93-853d8df98fbb`. No Production mutation was issued. Builds repository linkage remains the previously reported repository/main configuration; its pre-existing `Workers Builds: beyond` failure must not be represented as a successful new deployment. Current GitHub checks need a fresh read when networking returns.

Rollback: preserve the export and additive schema/receipts/messages. Do not drop tables or reset the database. To suspend new chat, review a Preview deployment that disables the real-time flag while retaining the DO class/binding/migration; blindly rolling back to a pre-DO-class version can conflict with Durable Object migration history. Do not remove existing DO namespaces. Never use a Production resource as a workaround.

## Delivery and follow-up

Code and docs are prepared for feature branch only. Exact commit/push outcome is recorded below after the real Git operation. main and Production are excluded. Current remaining acceptance blockers are remote browser verification, post-deployment preservation comparison, and any network-blocked Git push. Local tests must not be called remote passes.


### Final delivery state

- Feature code commit: `e2d4c00cfa3563db72422dcc743cab3e62615e6d`.
- Follow-up UI correction: `d65191b437497e9af7aaaabb5288de4a4c91910a`.
- Final UI uses image-coordinate masks per baked example post, preserving the surrounding artwork at desktop/tablet/mobile ratios. Simultaneous send/receive particle instances are independent and bounded; text reveal240ms, travel500/550ms, reduced-motion skips effects. Final local browser run:3/3 PASS in17.0 seconds. Final independent source build PASS.
- Selected commit source tests:24 CONNECT service tests and65 frontend tests/13 files PASS; these are a subset/overlap, not extra tests to add to the working-tree totals.
- Last successful Preview deployment remains `7b16e328-bf97-4e35-a590-41940b4ad10e`. Later image-coordinate/individual-mask/independent-particle corrections are LOCAL ONLY: the final Preview deploy attempt failed with Wrangler `fetch failed` (exit1) before upload completion. Do not claim the deployed Preview contains these final UI corrections.
- Push attempted with `git push origin HEAD:refs/heads/feature/connect-realtime-20261103`, without force. FAILED: `Could not resolve host: github.com`. Remote feature HEAD, current main and GitHub checks could not be re-read. No successful push is claimed.
- The deployed working tree included previously preserved local work and is not identical to the isolated feature commits. Review remaining dirty work separately before any future source-based release; never assume this task commits unrelated AI/admin/B10 work.

When network access returns: read current remote refs and Cloudflare versions/settings; verify only Preview resources/Free settings; deploy final checked UI to Preview; reuse known QA accounts or isolated new accounts; verify two real remote sockets, actual D1 history/edit/delete/reconnect, online counts, and protected-table hashes; then push the feature branch normally and inspect GitHub checks. Never use main or Production to work around this blocker.

Platform design sources: [Free SQLite Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [pricing and WebSocket billing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [WebSocket Hibernation guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/). Platform support is distinct from this session's blocked remote round-trip verification.
