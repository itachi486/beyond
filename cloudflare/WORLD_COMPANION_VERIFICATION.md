# World companion — Preview verification, 2026-10-30 UTC

Implementation and verification are partial, not an unconditional completion claim. The real house creation → review → approval → refresh → independent browser login flow passed. Real conversational inference, saved recall and task routing passed at the transport/state level. Model wording, garden appearance and intermittent platform failures remain limitations.

## 1. Existing AI conversation

An actual Workers AI text endpoint already existed, using `@cf/meta/llama-3.1-8b-instruct-fp8-fast`. The old conversation path sent only the latest message and could use local canned replies when AI was unavailable. The new companion path requires actual inference; unavailable AI is an error, not a fictional successful reply.

## 2. Reused implementation

Reuses published central character IDs/publication guards, immutable source files, owned graph snapshots/assets, account auth/CSRF, existing `workers_ai_requests` reservations, D1 world CAS/idempotency, progress/position sidecars, Tigris, existing Overlay and Klein reference-edit/mask/approval endpoints. No migration, new table, dependency, service, billing or Production change. Legacy discovery source/data remains, and the existing editor is available when closing the companion view.

## 3. Conversation changes

Existing `/api/ai/text` accepts `kind:companion`; server reads owned world, saved user statements (bounded last30), latest12 dialogue messages, selected character identity, saved landscape description, approved object labels/coordinates and pending task. Member client-supplied history is not authoritative. Caches retain request IDs, duplicate sends are locked, and failed conversation saves have a separate retry without another inference. The renderer opens directly for existing default artwork as well as published starters.

## 4. Routing and safety

A conservative Korean/English/Spanish lexical guard distinguishes chat/edit/clarify/explore/cancel; the LLM supplies natural replies but cannot authorize arbitrary image edits. Wishes about objects ask confirmation; historical/quoted/explanatory messages stay chat. Explicit edits require a location; nearby gardens use saved house coordinates, and resizing inherits pending object/position. Unapproved previews can be rejected; approved edits are not automatically undone. This is bounded intent recognition, not unrestricted semantic tool planning. The7 required real inputs were exercised: greetings/mood/world question→chat; house/garden→edit; larger→pending garden; cancel→rejection with approved house retained.

## 5. Character integration

One click on an image/name card snapshots the real published source into the existing owned graph. A static canvas renders the original/approved world and a trimmed alpha character with a contact shadow, rather than floating a character card. Source bytes are unchanged. Automatic placement samples foreground color/edges and penalizes water-like blue; this is a heuristic, not semantic recognition of paths, terrain, occlusion or perspective. Opaque nonuniform backdrops are not guaranteed to be removable. No animation or automatic background regeneration.

## 6. UI

One52px input; transient current reply near character; history collapsed initially. Keyboard arrows+Enter choose an edit location; pointer selection also works. Candidate review uses the existing modal with approve/reject. Save/generation errors preserve the original and approved world. Mobile bubble bounds were fixed after real screenshot review. Known-place exploration pans the existing artwork; it does not generate unseen terrain or unlock fictitious places. Unsupported/expired requests never display a fake AI answer.

## 7. Memory

The existing progress conversation map remains character/point scoped; legacy messages and discovery data are preserved. Companion ID, snapshot, automatic position/scale and pending request reuse optional progress fields. Real model initially confused biography with current geography and claimed not to remember; prompting now separates identity from landscape and adds bounded authoritative saved visitor statements. Later real model correctly recalled the saved positive mood, including after an independent login. This does not guarantee all answers are accurate.

## 8. Actual conversation results

Normal Chromium workers.dev HTTPS, no interception, mock provider, DNS shim or ignored TLS errors. The QA account recorded26 successful real text requests; observed response times0.699–2.712s. Required greetings all returned200. Casual chat did not call image generation. Weather/height questions supplied no measured external data. Initial and some later answers were repetitive, mixed languages, confused landscape, or contradicted an action (e.g. saying cancel was impossible although the candidate was rejected). Final prompts include the pending task and response directive; their additional ambiguity test was blocked by real429, so do not claim that final wording is fully verified. Local fixtures are explicitly synthetic and separate from these results.

## 9. Actual world work

Model `@cf/black-forest-labs/flux-2-klein-4b`, existing reference conditioning + mask compositing; no Llama Vision agreement or SD default change. Official model reference: https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/ .

- House request: HTTP200,7.536s browser /5.662s model. Full1672×941 retained; original SHA-256 `ea60bc6535805578be8378bd469cce47d4a5c5b9543c75e63dbaaa224d363f8c`; candidate `52d988758cc048fd2b830b73617030165acf84f31a1252a6316b7f6a3ecfd729`.57,358 inside-mask pixels changed, outside0. Original equals the saved starter. Candidate visually reviewed and approved through the UI, HTTP200. Tigris original/candidate and D1 save stages succeeded.
- Garden request: correct house-relative coordinates returned, then edit POST returned platform HTML503. QA ledger reservation remains pending; exact failure stage was not captured. Do not assume it was TLS, billing or a proven current CPU event. Earlier project evidence confirmed Free CPU failures, but this specific incident has no matching tail outcome. No automatic retry of the uncertain request and no approval.
- Distinct “make it larger” request: server inherited garden label and position, HTTP200,7.150s including chat /3.877s model. Saved candidate was reviewed and rejected via the cancel conversation; approved house remained. The garden is not clearly visible, so semantic/visual garden success is NOT claimed. No additional image attempt was made beyond the unchanged daily limit.

Owned `sourceAssetId` is checked against saved world ownership/hash and reads immutable Tigris bytes, avoiding the previous3MiB inline JSON413. Existing inline/admin path remains. Source reads are capped8MiB and editing dimensions512–2048; do not claim support for arbitrary originals.

## 10. Preservation and checks

House approval persisted after refresh and a new browser context/password login. Reconnected world retained starter hash, companion, complete saved dialogue and approved candidate hash. Cancel left0 unapproved saved candidates and the original approved house. Failed-save fixture verifies no generated reply is presented as saved and retry does not re-run inference.11 protected pre-existing editorial/source tables matched before/after hashes. Existing retention cron remains `30 3 * * *`; no temporary app diagnostics or schedules were added. QA records/images are retained, not purged; no existing user data was deleted.

Checks: build/typecheck PASS; Vitest40/40; Cloudflare38/38; separate member browser suite3/3 (account, admin, companion); existing starter snapshot/backup browser1/1. Final targeted companion rerun PASS. These are targeted regressions, not a claim the obsolete manual-discovery UI tests or entire browser suite passed. Existing large chunk warning remains.

## 11. Limits and remaining work

- Actual service reservation cap reached9000/9000 for2026-10-30 UTC; ambiguous wish verification returned429. QA26 text successes,2 image successes,1 orphan pending image reservation. Limits were never raised; reservation estimates are not actual provider billing.
- Orphan pending reservation after the503 is visible in private evidence; no fabricated error completion or automatic retry/reconciliation was written. A future supported stale-request recovery policy remains work.
- Text-model instruction adherence/action narration and natural garden appearance are incomplete. Full freeform reasoning and semantic placement/occlusion are not implemented. Unknown places cannot be truly explored.
- Final gallery read showed thumbnail503s; narrowed public character GET snapshots to required tables, then regression-tested. Final post-optimization public browser image decoding failed with a fetch/network error; full authenticated recheck was blocked by the unchanged8-logins/hour QA guard. Final placement refinement and final response directives therefore do not have a fully successful end-to-end live rerun. Free platform reliability is not guaranteed; password hashing and plan were not weakened/changed.
- Real email reset remains unconfigured from earlier tasks and is outside this change.

## Files touched for this task

Production code: `shared/companion-intent.mjs`, `.d.mts`; `cloudflare/companion-context.mjs`, `workers-ai.mjs`, `world-edits.mjs`, `handler.mjs`; `src/features/account/cloudWorlds.ts`; `src/features/creation/WorldCompanion.tsx`, `companionScene.ts`, `world-companion.css`, `WorldDiscoveries.tsx`, `SpiritEditor.tsx`, `worldDiscoveryProgress.ts`, `workersDialogue.ts`, `WorldImageEditor.tsx`.

Tests/config: `cloudflare/tests/companion.test.mjs`, `src/tests/companion-intent.test.ts`, `tests/world-companion.spec.ts`, `tests/local-member-server.mjs`, `tests/member-accounts.spec.ts`, `tests/image-management.spec.ts`, `playwright.member.config.ts`, `playwright.config.ts`. Existing starter/member assertions now check the canvas and actual source asset hash, rather than a removed image DOM node. No unrelated pre-existing dirty work was discarded.

Private evidence: `/home/administrator/beyond-backups/cloudflare-preview/world-companion/` — browser-result.json, finish-result.json, reconnect-result.json, final-smoke.json, final-ui-result.json, pixels.json, image-ledger.json, quota-and-pending.json, worker-tail.jsonl, before/after.json, original/candidate images and actual screenshots. The503 garden failure,429 final-smoke, final login limit and public fetch failure are retained. Thumbnail503s were also observed before narrowing reads; the first detailed gallery result was overwritten by the later login-limit run, so do not treat its latest JSON as the original thumbnail log. Local CLI DNS shim was management-only; actual browser used normal DNS/TLS. Branchmain, HEADf4585907ecb8158eafd61cc769c4c31e94d102c0 unchanged; no commit/push/Production access or deploy.


## Final release and stopping state

Preview `d2a45a99-849a-4789-af92-13d311542d91`. Final read-only audit:11 protected tables unchanged; existing retention schedule unchanged; no Production access. Final unit40/40, backend38/38 and targeted companion browser PASS. The successful real house/independent-reconnect run preceded the final thumbnail-read and foreground-placement refinement. Final live recheck is incomplete for the reasons above; no additional AI calls, quota/rate-limit changes, account creation, data deletion or automatic continuation are scheduled. Temporary QA password file removed; QA account/world and immutable images retained. Closed test browsers discard their cookies; this is not a claim that every earlier server session row was explicitly revoked.

Actual screenshot: `approved-world.png`; source candidate: `candidate.png`; independent reconnect: `independent-reconnect.png`; mobile: `final-mobile.png`. Hangul glyphs appear as boxes in the headless screenshot environment; response strings in JSON are intact. This is a visual verification limitation, not proof that Korean typography is correct on a real user's device.
