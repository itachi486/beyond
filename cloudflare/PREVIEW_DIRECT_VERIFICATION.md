# Normal Preview browser verification — 2026-10-30

**PASS: normal direct workers.dev browser access, real administrator password login, real Klein generation, rejection/approval, persistence and a full browser restart.** This supersedes the earlier diagnostic-transport-only qualification.

Final Preview release: `61c0e27f-5a65-4e14-8514-4b6856d49e39`, independently read back at100%. Final audit2026-10-30T17:26:22Z: Production deployment unchanged,10 protected Preview tables unchanged, Production D1 not accessed, schedules0, diagnostic variables0, pending edit/diagnostic jobs0. Ordinary image cap restored to3. No commit, push, branch change or Production deployment.

## Direct access and TLS

Ordinary system DNS and both official IPv4 addresses completed TLS1.3 with valid hostname/certificate checks. Unmodified Chromium connected directly to `https://beyond-cloudflare-preview.itach9279.workers.dev`. Browser security details: TLS1.3, issuerYE1, subjectitach9279.workers.dev. No ignoreHTTPSErrors, host-resolver overrides, browser proxy, request interception, local UI server, fake provider, diagnostic Worker or queued transport was used. IPv6 is unavailable on this host; normal IPv4 worked.

Earlier resets occurred on a different observed Cloudflare edge path (SIN); current ordinary requests reached NRT and validated the certificate. A transient external path failure is consistent with this evidence, but the exact historical network cause cannot be established retrospectively. No backend TLS setting or certificate was changed, and a permanent network-wide repair is not claimed. Direct access is now actually verified rather than assumed from control-plane access. One initial automation run waited for networkidle although the sign-in screen was already rendered; it was corrected to DOMContentLoaded plus visible UI readiness. That was an automation wait failure, not an observed certificate error.

The management CLI independently needed its existing process-only DNS fallback to deploy; this did not intercept or modify the real browser's DNS, HTTPS or app requests. A HEAD probe of the JSON capabilities endpoint returns405 by its existing GET-only contract; GET and ordinary browsing succeed.

## Actual user flow and result

1. Open normal `/admin`; enter existing operator-provided email/password via the actual form; login200, server session200. No account/password reset or seeded session.
2. Select the previous disposable QA world through MY WORLDS. Review its retained unapproved first candidate. Reject via the real new endpoint200. Approved image unchanged; reject state persists after reload.
3. Create/select a new disposable local world through the UI; retain original description and graph. Select normalized coordinates x0.31958131097710446/y0.7687348912167606 near the foreground terrain/mountains; test zoom.
4. Ask “여기에 아름다운 집을 만들어 줘”. Actual HTTP200 from the ordinary Preview API. Model `@cf/black-forest-labs/flux-2-klein-4b`, `reference-edit-with-mask-composite`. Exactly1 inference request; no automatic regeneration on reopen.
5. Progress message visible, duplicate action unavailable. Candidate shown while no approved-world replacement exists. Original unchanged before approval. Actual image/hash/pixel checks passed, then the QA result was visually reviewed before clicking Approve and save to world.
6. Approval200, saved confirmation visible. Reload retained the same actual saved texture, coordinates, original description, content request and byte-identical original world record.
7. Close the Chromium context/browser, relaunch the same disposable persistent profile, open MY WORLDS, select the world again. Session200; same actual texture decoded; original local world records unchanged. Logout200.

Actual request ID `42b6a79c-786f-4664-b8a8-c67c62dffeea`, world ID `3c8413f5-3b98-490e-99be-c1e47353bbd8`.

- Browser generation request:8,944ms; model5,401ms.
- Private Tigris original write731ms; candidate write431ms; D1 candidate commit22ms.
- Output1672×941 PNG,3,228,359bytes. Source WebP375,152bytes.
- **Outside-mask changed pixels0**; inside changed57,109.
- Source SHA256 `41b2c635bcae77a1b00b20f573a69917520e6dad22f922be0c7e17b14b4c238d`; result `ccd6baa5bf67e6e124a4e526f1f4495005dec5ab4e05dcccd6b938ded4643173`. Both matched the real saved records.
- Browser page exceptions0; failed network requests0.

After returning the ordinary limit to3, a separate direct-browser login200 and existing-world attempt produced429 `daily_limit_reached` before any AI stage. The user-friendly error was visible; version records and approved image were unchanged. Logout200. Previous usage was not erased. A temporary regular Preview cap8 allowed exactly1 additional real generation beyond the7 existing reservations; it is removed. The next daily reset is2026-10-31 06:30 Asia/Rangoon.

## UX changes without rebuilding the feature

Generation preparation, AI work, approval save and rejection now show distinct honest status messages. Candidate-ready and saved/rejected confirmations are visible. Authentication, quota, concurrency, image-load, network and timeout errors have actionable wording. Network/timeouts advise checking saved versions before retrying because completion may be ambiguous. No false percentage/completion claims.

Rejection was previously transient component state, so a candidate could return after reopening. New authenticated/Origin/JSON/CSRF/actor-checked `POST /api/ai/world-edits/:id/reject` stores `rejected:true` in the existing Preview ledger. Original/candidate files stay immutable and private. Approved versions cannot be rejected; rejected candidates cannot be approved silently. History labels rejected versions. Loading no longer automatically opens a rejected candidate. Original/current scenery remains until an explicitly approved new version is saved. Hidden history controls are excluded from modal focus trapping.

Klein remains the Preview default; mask-only compositing and inside-mask feathering remain unchanged. No Llama license agreement was accepted. Unverified Stable Diffusion was not made the default. No schema migration, new dependencies or underlying auth change.

## Cleanup, tests and evidence

Temporary diagnostic entrypoints from earlier work were archived privately in `direct-browser/retired-diagnostics/` and removed from active `.local` paths. Active Worker source exports only fetch; no diagnostic routes/scheduled handler. Deployed cron0, diagnostic variables0. The temporary password file was deleted; passwords were not printed or written into reports, source or Git. Actual sessions were logged out. The original user's browser/profile was never accessed; this is a disposable QA profile.

Validation: build/typecheck PASS (existing Three.js chunk warning); Vitest36/36 PASS; disposable Cloudflare integration26/26 PASS, including rejection persistence/CSRF and denial of approving a rejected candidate; focused browser UX1/1 PASS including reject/reload/approve/original retention/375px layout. These fixture tests supplement the separately successful real direct-browser flow above.

Private evidence `/home/administrator/beyond-backups/cloudflare-preview/direct-browser/`:

- `result.json`: direct browser configuration, TLS, actual form login, response paths/statuses, generation, pixel/hash checks, reload/restart, logout and zero exceptions/failures. No auth payloads captured.
- `generated-house.png`, `original.webp`: actual generation and immutable original.
- `login-page.png`, `logged-in.png`, `candidate-rejected.png`, `location-selected.png`, `generation-in-progress.png`, `generated-candidate.png`, `approved-world.png`, `after-reload.png`, `after-browser-reconnect.png`: real normal-Preview screenshots.
- `limit-result.json`, `limit-error.png`: real quota-error UX and unchanged versions.
- `before.json`, `after.json`: independent preservation/deployment/schedule/config audit.
- `world-state.json`: disposable browser-local world strings for recovery, no credentials.
- Logs `/tmp/beyond-direct-{actual,limit,build,server,unit,browser-fixture,final-deploy,after}.log`.

Changed feature files this task: `cloudflare/world-edits.mjs`, `src/features/creation/WorldImageEditor.tsx`, `tests/world-image-editor.spec.ts`, `cloudflare/tests/world-edits.test.mjs`. Preview configuration ended with the original3/day limit and Klein model unchanged. Docs updated for handoff; extensive pre-existing dirty work preserved. Branch main/HEAD f4585907ecb8158eafd61cc769c4c31e94d102c0 unchanged.

## Remaining limits

No remaining blocker was observed for the requested direct Preview flow. Exact cause of the historical network resets remains unproven; current direct access is verified, not guaranteed for every network. Personal worlds remain browser-local, so arbitrary cross-device world synchronization is not added. Native SD is still unverified and optional; Llama Vision still requires operator licensing if separately selected. Physical mobile, Safari/Firefox and arbitrary-generation quality were not newly certified. The current day's ordinary image quota is exhausted; reopening saved worlds works without inference. No further work is scheduled.
