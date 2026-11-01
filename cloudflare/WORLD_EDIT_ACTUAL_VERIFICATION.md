> Follow-up complete: normal direct workers.dev password login and actual generation/reconnect now pass without diagnostic transport. See [normal browser verification](PREVIEW_DIRECT_VERIFICATION.md).

# Actual Preview world image editing — 2026-10-30

Final Preview release: `a02ee577-7947-4855-98f1-92a2d529bf52` at100%. Independent final audit2026-10-30T14:51:40Z: Production deployment unchanged;10 protected Preview tables unchanged; Production D1 not accessed; remaining cron schedules0; pending world-edit requests0; real refined candidate approved=true.

Actual AI generation, visual review, approval, storage, reload and reconnect **passed using FLUX.2 Klein 4B**. This is a correction to the earlier inference-unverified report. The app was not rebuilt: changes isolate the failing stages, add bounded retries and a reference-edit adapter, and retain original/version/approval/mask preservation.

## Actual result

- Model: `@cf/black-forest-labs/flux-2-klein-4b` through the deployed Preview's real `env.AI.run`.
- Original: 1672×941 WebP, SHA-256 `41b2c635bcae77a1b00b20f573a69917520e6dad22f922be0c7e17b14b4c238d`.
- Saved candidate: 1672×941 PNG, 3,223,571 bytes, SHA-256 `304dfef4b67adf88d03b41af67b8d12935a341308140ec2006b2167c9e3ff262`.
- Request: “여기에 아름다운 집을 만들어 줘”, selected x=0.31958131097710446, y=0.7687348912167606. Same original world ID `a8977e0f-129d-4c4b-ae34-48f13eb5d9f3` was retried without replacing its description or graph.
- Result ID: `535ce757-a14d-4d38-b7d6-7dbf4c8ec313`.
- Real decoded-pixel comparison: **0 pixels changed outside the mask**; 56,655 changed inside. Original and saved-image hashes both matched. The immutable original source bytes match the original file; mask-edge feathering changes only pixels inside the ellipse.
- AI response 4,883ms; original Tigris Put 1,222ms; candidate Put 601ms; D1 candidate commit 1,150ms. The full diagnostic Worker execution took 11,643ms. Queue/transport overhead is separate: the browser generation round trip was 45,513ms.
- Approval: actual existing Preview API HTTP200, 1,968ms Worker execution (52,080ms browser round trip including the diagnostic queue).
- After reload: actual saved texture decoded, approved version returned, original browser-world record remained byte-for-byte equal, coordinates/lore/content request retained.
- After closing/reopening the page: actual saved texture decoded again, remote approved=true, same local world data retained. No further inference. Browser page exceptions: 0.

The first real Klein result also generated and stored successfully (4,965ms), but its white disc under the house failed visual review and was **not approved**. Its private image/version was retained. A binary guide image supplied as a second reference likely caused the disc. The corrected adapter sends only the landscape reference and explicit terrain/foundation instructions; the server applies the separate mask afterward. The refined house is grounded in the grass/rock surface, with no white platform. This is one reviewed QA result, not a guarantee of photorealism or arbitrary-placement quality.

## What caused the failures

| Stage | Actual observation | Conclusion |
|---|---|---|
| Client → workers.dev / local remote-binding proxy | DNS trouble and TLS reset/timeout; tail WebSocket also reset | This execution environment's public Preview ingress/proxy path is still unreliable. Do not attribute these TLS failures to Tigris or image decoding. Exact network-policy/provider cause is not established. |
| Cloudflare control API | Deployment/settings reads HTTP200 | Control-plane connectivity is separate from workers.dev ingress. Process-only DNS-over-HTTPS fallback was used; no system DNS/TLS settings were changed. |
| REST AI catalog | HTTP403/code10000 | Current operator token cannot read that catalog. This is not proof the deployed AI binding cannot infer. |
| Llama 3.2 Vision | Actual binding error5016 in120ms: explicit license agreement required | Primary pipeline stopped **before native Stable Diffusion or Tigris**. No automatic license agreement was sent. |
| LLaVA alternative analysis | Request remained incomplete, no image candidate committed; diagnostic caller timed out | Not a successful inference. Its disposable session expired; the exact two QA ledger rows were closed as diagnostic_session_expired without refunding/deleting usage. No ambiguous inference retry. |
| Klein actual inference | Two successful real calls (~5sec each) | Reference-image editing works on this account. |
| Output download | Inline Base64 model output, no external image URL | There is no external provider-image HTTP download in this working path. |
| Tigris and D1 | Actual original/candidate writes and private reads succeeded; approval persisted | Storage was not the cause of the observed earlier failures. |

**Native Stable Diffusion is not declared unsupported.** Its documented request contract was checked and an adapter is retained, but actual execution of that model was blocked by upstream analysis; native SD inference success is still unverified. The tested fallback is explicitly `reference-edit-with-mask-composite`, not native mask inpainting. Klein itself conditions on the terrain image; it does not produce a separate textual scene-analysis report. Metadata labels this honestly.

## Input formats and changes

Native SD: encoded PNG byte arrays for `image` and `mask`, 512×512, `num_steps:20`, `strength:1`, `guidance:7.5`; output stream. The original crop/mask generation is retained.

Klein: proper multipart body and generated boundary, `input_image_0` as binary PNG, 504×504 reference (below the documented 512px limit), width/height=512. Output Base64 PNG/JPEG is bounded and decoded before composition. The full world is never sent to text-to-image regeneration. Only a 512px neighborhood is edited, then mask pixels are copied/blended into the original full-resolution raster. The original WebP bytes and candidate PNG use new private immutable keys.

Retry: one extra attempt only for explicit TLS/connection or temporary HTTP502/503 errors. It creates a separate daily quota/neuron reservation. Invalid input, licenses, quota and ambiguous inference timeouts are not automatically retried. Multipart input is rebuilt for retry so consumed streams are not reused. The timeout is installed before starting inference. Provider errors include stage names and per-stage durations, without request images/credentials in ordinary logs.

Changed application files: `cloudflare/world-edits.mjs`, `workers-ai.mjs`, new `world-edit-model.mjs`, new `world-edit-inference.mjs`, `wrangler.cloudflare.preview.jsonc`; tests `world-edit-provider.test.mjs` and `world-edits.test.mjs`. No UI recreation, auth change, dependency install, original artwork edit or schema migration. Preview selects the tested Klein model; native SD remains an opt-in adapter. Ordinary limits remain3 images/day,30 text/day,9000 reserved neurons/day. Existing usage was not reset. The temporary internal QA exception allowed4 additional image reservations (license failure, incomplete analysis, two real Klein results), then was removed. Ordinary generation remains exhausted until the next UTC daily reset (2026-10-31 06:30 Asia/Rangoon).

## Transport qualification and cleanup

Because public Preview HTTPS ingress remained unavailable from this agent, browser clicks used the current unchanged local UI with disposable local author credentials. Only edit API transport was queued through the Cloudflare control plane to a short-lived Preview scheduled diagnostic. The **existing deployed Preview API**, real server-verified Preview administrator session, real AI binding and real Preview D1/Tigris executed generation and approval. GETs read the real persisted records/private media. This is not a simulated AI provider, and is not claimed as a successful direct workers.dev browser connection. A direct-user-network smoke test remains necessary when that ingress is reachable.

The diagnostic queue claimed each job once, created a short-lived session in memory, and removed sessions afterward. It was deadline-guarded and Preview-only. The final normal Worker deployment removes the diagnostic handler, extra quota exception and cron; `final-audit.json` independently verifies no remaining schedules, no pending world-edit test requests, protected tables unchanged, and Production deployment unchanged. Production D1 was never accessed. No commit/push/Production deployment.

Checks: build/typecheck PASS; Vitest36/36 PASS; disposable Cloudflare tests26/26 PASS, including multipart/reference constraints, bounded budgeted retry, no retry on invalid input/quota, native PNG mask contract, exact outside-mask preservation, approval/version conflicts and a one-model Klein flow. The successful actual images and end-to-end results above are independent of those fixture tests.

## Evidence and handoff

Private evidence: `/home/administrator/beyond-backups/cloudflare-preview/world-edit-diagnostics/`:

- `edited.png`, `original.webp`: actual refined candidate and exact original.
- `actual-selected.png`, `actual-candidate-screen.png`, `actual-approved-world.png`, `actual-after-reload.png`, `actual-reconnected-world.png`: actual UI captures.
- `browser-result.json`: full actual generation/approval durations, pixel/hash checks, reload/reconnect and exception results.
- `browser-world.json`: disposable local world's persisted strings; not the user's browser data.
- `initial-edited.png`, `initial-klein-unapproved.json`: real rejected first result, retained for review.
- `failure-llama-license.json`, `failure-llava-timeout.json`, `connectivity.json`, `modelCatalog.json`: failure evidence.
- `final-audit.json`: final release, cron cleanup, data preservation and real approved record.
- `/tmp/beyond-edit-{tests,unit,build,actual,final-deploy,tail}.log`: execution logs.

Official references checked2026-10-30:
https://developers.cloudflare.com/workers-ai/models/stable-diffusion-v1-5-inpainting/
https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/
https://developers.cloudflare.com/workers-ai/models/llava-1.5-7b-hf/
https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/
https://developers.cloudflare.com/workers-ai/platform/pricing/

Personal-world definitions remain browser-local: reconnect verified in the same disposable browser; full cross-device world sync is not introduced. Preserve existing uncommitted work. Branch main/HEAD f4585907ecb8158eafd61cc769c4c31e94d102c0 unchanged. Do not restore the diagnostic cron or quota exception in normal deployments. Do not automatically accept model licenses. For further QA, reuse the saved approved result rather than generating automatically.
