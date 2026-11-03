# Character identity, versions and private relationship memory — 2026-11-04

## Delivery scope

Implemented in the existing Central Character Library / Admin Characters and Companion. No second character application, model replacement, new 3D character, package installation, paid inference, Production or Preview deployment. This request authorized implementation, verification, feature commit/push; actual Preview schema was inspected READ ONLY. Apply ONLY migration0012 to the intended Preview after separately authorizing a release. Until then the deployed Preview remains unchanged and legacy conversation gracefully skips the unavailable feature tables.

## 1. Existing system verified again

Actual Preview D1 schema read saved privately at `/tmp/beyond-character-identity-baseline/live-schema.json`. `central_characters` retains its17 existing columns (name/description/type/tags/active/deleted/version/files/etc), with no independent persona columns. Member/admin personal world JSON remains in `user_worlds.data` / `admin_personal_worlds.data`; `world.graph.characters[]` holds local personality/abilities/centralCharacterId/centralVersion, and serialized `sidecars.progress` holds transcripts. Existing administrative authentication/CSRF/sole allowed email and member session ownership reused. Text API remains `/api/ai/text`, Workers AI `@cf/meta/llama-3.1-8b-instruct-fp8-fast` and `env.AI.run()`. Current semanticVersion1 and image/action routing retained, including deterministic identity/greeting/status responses.

## 2. Central character identity

Structured fields: personality, thinkingStyle, values, communicationStyle, backgroundStory, likes, dislikes, behavioralTraits, knowledge, emotionalExpression. Each is a validated string, max2000 chars; total identity JSON max14000 chars/request max24000 bytes. Unknown fields/nonstrings rejected. Unset fields remain blank, never fabricated. HTML stays text, never rendered as markup. Central imported instances use the assigned central identity snapshot; local world personality cannot override it. Legacy noncentral personal character persona/abilities remains a fallback, not promoted to a shared central original.

## 3. Actual Companion prompt integration

Server resolves the authenticated owner, owned world and canonical character, then reads its immutable assigned identity and at most8 relevant owner/character memories. Both modern semantic Companion planner and legacy conversational prompts receive server identity, version, private memories, current world and bounded recent history. Identity is explicitly fixed administrator data; user/world/history/memory strings cannot be treated as identity replacement instructions. Historical experience location is distinguished from current world. No memories means no invented shared history. Existing request/response action formats, model choice, greetings/name checks/tool responses and image generation/approval logic preserved.

Browser fixture captures the ACTUAL `env.AI.run()` input through the existing text API. It verifies the published patient persona plus A's tea preference in A's prompt, and absence of A's preference from B's prompt; A's other-world request retains the same private relationship. The model itself is explicitly synthetic in fixtures. Real provider inference/personality adherence/jailbreak robustness were NOT measured or claimed.

## 4. Version management

Separate immutable UUID identity version IDs and per-character identity numbers (baseline0, v1, v2...). Asset/catalog `centralVersion` is retained unchanged and shown separately. New draft snapshots the currently saved central name/description/type/catalog version and typed identity; it does not activate anything. Published payload cannot be overwritten. Compare any two saved versions, preview fields, see active version and publication audit. Restoring a prior published version or baseline is an explicit confirmed publication with the same scope controls; no histories/assets/memories are deleted. Baseline metadata is an honest snapshot at migration/first observation with EMPTY identity, not fabricated historical personas.

## 5. Publication policy

Default UI scope is Apply to all users. No publication without confirmation checkbox + server confirmation + optimistic policy revision. All-users publication updates existing assignments and future default. Preserve-existing publication atomically pins current real owners (world graphs, companion and legacy discovery references) to their prior identity before changing the future default. Assignments are independent of memory. Admin preview shows affected owner labels, kinds/current identity versions and existing-owner counts. New draft and publish receipts are idempotent; reused operations with different payloads, stale revisions, unauthorized writers and invalid scopes rejected. No personal world JSON, image pointer, original file, transcript or relationship is rewritten by a publication.

## 6. Relationship storage / retrieval

Identity is `(owner_id, character_id)`, independent of world/point/version. Each memory has ID/category/content, source hash and conversation/index reference, actual source world/point, explicit/user-confirmed state, confidence of explicit source, revision and timestamps. Confidence is evidence of an explicit user statement, not independent verification that a claimed fact is objectively true. Retrieval ranks bounded100 candidate rows by query relevance, preferred name, location and recency, returns at most8. No embedding service/new model/whole-history replay.

Memory generation is deliberately conservative: deterministic extraction of explicit preferred names (English/Korean/Spanish patterns), expressed preferences and requests to remember experiences/promises/context. Arbitrary conversation is not summarized or inferred into user facts. Unrecognized phrasing may create no memory; this is a privacy-preserving limitation, not a claim to understand every language or every important event.

## 7. Asynchronous creation / management UI

After successful cloud conversation save (including retry-save), UI sends an OPTIONAL, unawaited memory-sync request. Server verifies exact saved world/version/character and derives the latest user statement from the saved transcript; no client-supplied memory/owner is trusted. A queued job is fenced by relationship epoch and processed with Workers `waitUntil`; local fixtures await it for deterministic assertions. No additional AI inference is required. Missing/failed memory jobs do not block text response or transcript save. Source hashes/content constraints deduplicate; stale queued/failed jobs can safely retry on a subsequent matching sync. There is no new cron and no guarantee of recovery if a browser exits before it sends sync.

Companion Relationship memories panel shows only its owner's records with source-world context, supports corrections, individual forget and forget-all with confirmation. Corrected records are marked user-confirmed. It explains original transcript retention and future-context policy. Nonsecret explicit new statements can create new memories later; suppressed deleted statements are not silently recreated.

## 8. Deletion / privacy semantics

Hash-only tombstones prevent re-extraction of forgotten sources/content. Relationship epochs fence in-flight jobs on correction/forget. Per-world conversation boundaries exclude older transcript context, including assistant paraphrases, from future prompts after correction/forget. The original transcript itself stays byte-preserved for its existing history viewer. New post-boundary exchanges build fresh context. If optional memory/suppression/context reads fail, replies retain canonical identity but omit memory/older dialogue context; no erased facts are reintroduced as a fallback. Current world and pending action state are separate and preserved.

## 9. Schema / lifecycle

New `cloudflare/migrations/0012_character_identity_memory.sql`, additive/idempotent:
- character_identity_versions, character_identity_policies
- character_version_assignments, character_identity_publications
- character_relationships, character_memories
- character_memory_suppressions, character_memory_context_boundaries
- character_memory_jobs, character_mutation_limits

Original columns/tables/worlds/assets/transcripts untouched. New numeric revisions bounded to safe integers; uniqueness prevents duplicate versions, assignments, jobs and facts. Published snapshots immutable. Final existing account/admin deletion cascades private relationships and assignments; suspension/deletion-pending fails current session guards, without accelerating the existing30-day retention. No real account deletion or database mutation performed during this work.

## 10. Security / isolation

All writes require existing session, exact Origin/JSON/CSRF and fresh atomic auth guard. Only sole allowlisted administrator drafts/publishes; owner comes from server session, never payload. Owned-world/character checks reject forged sources and AI character IDs. Member/admin principals isolated; no administrator access to other users' memory API. Account A's facts are absent from B's actual prompt. Mutations guarded at40 budgeted operations/minute (some requests consume more than one guarded mutation); reads bounded100 rows. Explicit secret/password/API token/OTP/private-key/long credential/contact/selected sensitive-data patterns are refused for memory. Filters are conservative pattern guards, not a mathematical guarantee that every possible secret can be recognized. Existing transcript policy is separate; this feature does not retroactively sanitize or erase old chat records. React text rendering protects identity comparisons and memory contents against XSS; browser exercises literal malicious HTML.

## 11. Validation

- TypeScript / full working-tree build PASS; existing >500kB bundle warning retained.
- Frontend unit suite88/88 PASS (18 files).
- Existing server suite101/101 PASS.
- Final Cloudflare suite570/570 PASS; this includes the10 focused character tests and imported fixture overlap. Do NOT add overlapping direct runs as extra unique tests.
- Character focused service10/10 PASS: immutable versions, both scopes, empty baseline, restores, idempotency, CAS conflicts, true world-owner pinning, legacy non-UUID world IDs/discovery refs, same-character cross-world recall, A/B isolation, correction/delete/forget-all, queue fencing, duplicate prevention, sensitive inputs, XSS-safe data, private API, denied forged owner/character/memory IDs, read outages, transient job failure and rate limits.
- Working-tree browser scenario1/1 PASS: real disposable admin/member APIs, identity publish/explicit confirmation, actual model-input capture, A/B isolation, cross-world memory, correction, literal XSS, forget-all, conversation save despite forced memory503. Repeated with the independently selected commit source; final result logged separately. Same scenario, not extra unique tests.
- Migration repeatability and old central/world JSON preservation verified on in-memory disposable SQLite/D1; actual Preview schema inspected read-only. No real migration applied.
- Independently selected source builds and focused tests pass; no reliance on hidden unstaged runtime files.
- Secret-literal scan against configured server secrets and private-key markers: no matches; no env/private credential/backup files selected.

Logs: `/tmp/character-{typecheck-final,build-final,unit-all,server-all,cloudflare-final,service-final,browser-final,isolated-build-last,isolated-browser-last}.log` (filename `isolated` uses normal ASCII in actual filesystem). Browser screenshots `/tmp/beyond-character-identity-admin.png`, `/tmp/beyond-character-memory-companion.png` are disposable fixtures, not real provider/real-user acceptance.

## 12. Main source files / Git selection

New core: `shared/character-identity.mjs`, `cloudflare/character-state.mjs`, `cloudflare/character-identity-api.mjs`, migration0012. UI: `src/admin/CharacterIdentityEditor.tsx` integrated into existing CentralCharacters, `src/features/creation/RelationshipMemories.tsx` integrated into existing WorldCompanion. Worker/handler forward waitUntil and reuse the existing AI path. Tests: `cloudflare/tests/character-identity.test.mjs`, `tests/character-identity.spec.ts`, `playwright.identity.config.ts` and existing disposable server fixture.

Started from feature/connect-realtime-20261103 HEAD4b44a60 with76 dirty tracked and89 untracked entries. New branch `feature/character-identity-memory-20261104`. To avoid committing the entire dirty workspace, an alternate Git index selected the feature and required pre-existing Companion/runtime dependencies. This includes the current semantic-planning/candidate/account-runtime foundation and necessary previous migration/test helpers. A narrow saved-world hydration prerequisite is selected from HiddenWorldsPage, while its unrelated plaza/gallery/close-navigation changes remain in the working tree. Unrelated files/notes/hosting configs are not swept into this commit; no reset/clean/rebase/discard. Review source exported at `/tmp/beyond-character-review-source` and tested independently. The feature commit contains runtime prerequisites as well as newly authored code; do not portray all selected dependency lines as newly invented for this task.

Commit / feature push results are recorded in the delivery addendum after the actual Git operations. main merge and Production deployment are excluded. Preview deployment is not part of this request; migration/worker release requires a subsequent authorized Preview release, preserving budgets and all prior live data.
