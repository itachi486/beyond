# Integrated admin + six-world verification — current task

## Scope and environment

Local Node22.23.2, React19/Vite6/Three0.180, SQLite built-in (experimental), existing dependency installation. No packages installed or upgraded. No real operator account, external DB, email sending, live user writes or deployment used. Admin/server browser fixtures use generated temporary credentials and disposable SQLite directories. Chromium uses software WebGL on this host; not the user's actual Chrome profile/physical device.

## Commands and actual results

- `npm run typecheck`: passed after hub marker/type and default-coordinate fixes.
- `npm test`: 9 passed, 0 failed.
- `npm run build`: passed; existing large Three.js chunk warning (~509kB minified, lazy loaded), SQLite experimental warning. No bundle budget/performance benchmark claimed.
- `npm run test:server`: **16 passed, 0 failed, 0 skipped** (final rerun).
- `LD_LIBRARY_PATH=/tmp/jalisco-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run test:browser`: **43 passed, 0 failed** (final full rerun, 2.2 minutes).
- No ESLint/lint script/config exists in this repository; lint was not run or claimed. TypeScript and Node syntax checks are separate checks.
- `node --check server/api.mjs`: passed; all 10 server .mjs modules passed syntax checks before delivery.
- `git diff --check`: passed before delivery.

Server cases exercise bootstrap restrictions, hash/cookie/session expiration/logout, exact origin/JSON/CSRF, persistent rate limiting, protected pages/API, CRUD/archive and revisions, source/publication checks, slug aliases, optimistic conflicts, connections, credential revocation, persistence across reopen, production Secure cookies, static distribution server, idempotent six-world migration, review/fiction/hypothesis/rejection rules and bounded hub discovery positions. Tests write only to isolated fixtures.

Browser coverage includes original exploration, raycasts, portals, bookmarks/history/sharing, EN/ES, landing entry/fullscreen animated pixels/reduced-motion/fallback; private admin login/logout/responsive lists and actual editor create/preview/publish/archive/restore; source review and shared DB publish->hub->unpublish; 6 persisted destinations with no per-click refetch; manual/auto travel interruption, actual canvas destination raycast and WebGL failure.

## Failures investigated (not suppressed)

Initial integration run: 40/42 browser cases passed. One exact World selector lacked an explicit accessible label; corrected. Keyboard movement after focusing a navigation button did not interrupt auto travel because the engine ignored button targets; corrected input handling. Both focused regressions passed.

After adding real 3D discovery coordinates, a draft UI save exposed default legacy coordinates on the first (hub) world; corrected the initial record to local `[0,1,0]` and retained server bounds. A subsequent 41/42 run had an immediate Escape close timing failure in the original bookmarks scenario; overlay keyboard/focus registration now uses a layout effect before paint. Existing assertions/tests were retained. An added actual canvas raycast test passed independently. Final full rerun is reported below, not replaced by these partial results.

## Visual inspection

Inspected actual admin and hub screenshots at 375/768/1440px. Observed six accessible destination controls, no horizontal overflow in sampled layouts, and six distinct desktop silhouettes around the central connected terrace. `/tmp/beyond-hub-{375,768,1440}.png` and `/tmp/beyond-admin-{375,768,1440}.png`, helper log `/tmp/beyond-integrated-visual.log` are ephemeral evidence, not tracked artifacts. Browser tests recreate viewport coverage.

The reference's overall spatial concept is interpreted as genuine stylized procedural 3D. Current architecture/art is materially simpler and less detailed than the supplied cinematic image; photorealistic fidelity is not claimed. No GPU heap audit, physical-device FPS, Safari/Firefox, production TLS proxy or deployed backend test performed. Original whole-screen landing motion tests remain and compare composed frames, rather than treating a running animation object as proof of visible motion.

## Preservation and security review

Original HeroScene, distributed landing CSS, asset, package-lock and storage helper match the pre-admin snapshot. Overlay registration timing is the intentional small exception to the original shared dialog helper. Existing four world records, eight discovery bodies/IDs/routes and related-order preservation have explicit server tests. New six destinations are not populated with invented scientific claims. Original public records retain Requires review status; substantive edit/unpublish ends grandfathering.

Secret-pattern/path review covered the intended tracked and new source files, reported no matching credential/private-key/JWT patterns, and did not print values. `.local/`, `.env*` except placeholder `.env.example`, SQLite sidecars, node_modules, dist and browser output are ignored. Pattern scan is not proof against every possible secret; fixture credentials are generated at runtime, no real credential is configured. No GitHub workflow is authored locally; old static hosting manifest is unchanged. No remote authentication/visibility/settings or deployment changed.

GitHub intended URL: https://github.com/itachi486/beyond; remote read succeeded with empty refs and public HTTP200/Quick setup, replacing earlier historical 404. Branch main starts from 489281882435ab2358dafcc90ab0ef0e62adb807; no configured remote added/changed. Authorized normal push must verify refs again and confirm resulting SHA. Final commit/push evidence is in the delivery report and Git history, not inferred from this document.

---
## Historical verification (earlier scopes; counts are not current)

# Verification record

Implemented and checked on 2026-10-27 UTC. All operations were limited to the new BEYOND directory and its separate owner-private Sites deployment. The existing NopaHua/Jalisco application was not modified.

## Historical baseline results — before the landing update

| Command / check                                                    | Actual result                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Dependency installation                                            | Succeeded; package-lock.json retained for `npm ci`                                   |
| `npm run typecheck`                                                | Passed                                                                               |
| `npm run build`                                                    | Passed; separate lazy 3D chunk and Three.js vendor chunk                             |
| `npm test`                                                         | 9 passed, 0 failed                                                                   |
| `npm run test:browser` (Linux library prefix documented in README) | 11 passed, 0 failed; Chromium software WebGL                                         |
| `npm audit` after upgrading Vitest                                 | 0 vulnerabilities                                                                    |
| Vite development server                                            | Started successfully on port 5178 for QA                                             |
| Screenshots                                                        | Threshold and worlds inspected at desktop/mobile; layouts tested at 375, 768, 1440px |

Browser tests exercise the exact English threshold copy, real canvas creation, all four worlds, data-driven related discoveries, browser back, direct shared paths, bookmarks and history after refresh, Spanish switching and persistence, camera keyboard movement, stationary camera image under reduced motion, drag-to-look image change, camera reset, reduced-motion settings, WebGL failure, malformed storage, unavailable language indicators, actual raycast discovery and portal clicks, clipboard sharing, mobile touch and dialog focus containment.

## Issues found and fixed

- Threshold wordmark wrapped at desktop size: prevented wrapping while maintaining mobile sizing.
- Mobile composition hid the main portal: recomposed the background crop.
- Initial test runner picked up Playwright files: isolated the Vitest test glob.
- Initial dependency install reported vulnerable Vitest transitive packages: upgraded to compatible Vitest 5 and verified zero audit findings.
- Browser assertions originally targeted the wrong disabled-option semantic and ambiguous status/language controls: corrected assertions to inspect native disabled state and the active dialog, retaining all acceptance checks.
- Opening a bookmark now synchronously closes its collection panel, avoiding overlapping navigation state.
- Modal keyboard users can switch languages inside the dialog. Background header controls are inert while dialogs are open.

## Boundaries

No physical-device, Safari, Firefox, sustained frame-rate or GPU benchmarking is claimed. Browser tests use software WebGL. The first-screen art is raster environmental scenery with real HTML and animated overlays; the exploration view is a separate, real, stylized procedural 3D scene. There are eight authored discoveries, not unlimited content. English and Spanish are complete; the other five listed languages are disabled/upcoming. LocalStorage is browser-local and is not synchronized or backed up.

A production build is independently reproducible with `npm ci && npm run build`. Static hosts need an SPA fallback for direct discovery and world URLs. No paid API, external runtime images, account creation, backend or database is involved.

## Previous task — landing motion and persistent handoff (2026-10-27 UTC)

No dependency installation, upgrade, authentication change, commit, push or deployment was performed. Existing tests were retained unchanged; `tests/landing.spec.ts` adds ten landing/lifecycle scenarios. The historical eleven browser tests above were rerun as part of the current suite.

| Actual command/check                                                                                | Result                                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                 | Passed                                                                                                                                 |
| `npm test`                                                                                          | 9 passed, 0 failed                                                                                                                     |
| `npm run build`                                                                                     | Passed                                                                                                                                 |
| `LD_LIBRARY_PATH=/tmp/jalisco-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run test:browser` | 21 passed, 0 failed (11 original + 10 new)                                                                                             |
| `git diff --check`                                                                                  | Passed                                                                                                                                 |
| `git ls-remote --symref https://github.com/itachi486/beyond HEAD refs/heads/main`                   | Exit 128: `Repository not found`; remote history/access unverified                                                                     |
| Screenshots and overflow inspection                                                                 | 375/768/1440px; no horizontal overflow; desktop/mobile images visually inspected                                                       |
| Secret/path scan                                                                                    | Tracked source and new non-ignored files examined; no private-key/token patterns or secret-bearing filenames found; values not printed |

New browser coverage verifies absence of world selection in landing and Settings at three widths; actual changed Canvas frames and running ambient animations; mouse pointer depth; mouse/keyboard/touch CTA activation; single-flight history behavior; interruption by Back; animation-disabled entry; hidden-tab fallback; missing Canvas/WebGL fallback; stopped Canvas drawing after unmount and restarted drawing after return; saved reduced-motion preference; system reduced motion overriding a saved false setting; and changing reduced motion during entry.

Existing suite re-verifies all four worlds, actual raycast portals, camera stability/movement, direct URLs/back navigation, EN/ES, collections and clipboard sharing. Source review confirms disposal code in the unchanged 3D engine, plus cleanup in HeroScene and the transition hook. These checks are not a full heap/GPU leak audit or a physical-device benchmark.

Temporary QA screenshots: `/tmp/beyond-landing-375.png`, `/tmp/beyond-landing-768.png`, `/tmp/beyond-landing-1440.png`. Browser command output: `/tmp/beyond-landing-final-browser.log`. These are ephemeral evidence paths, not required source assets; the reproducible tests live in the repository.

Remote failure is not proof that the GitHub repository does not exist: it may be private or inaccessible to this environment. Branch/remotes/permissions/authentication were left unchanged. No current GitHub push or updated hosted deployment is verified. No new npm audit was run in this task; the zero-vulnerability result above is historical, not a current audit claim.

## Previous task — localhost:5173 motion diagnosis and fix (2026-10-27 UTC)

Initial instructions were diagnosis-only; the user's follow-up explicitly authorized minimal fixes after diagnosis. Application code was changed only after finding a reproducible bug and reporting the evidence. No dependency install/upgrade, commit, push or deployment.

### Endpoint and runtime evidence

- `curl http://localhost:5173/`: HTTP 200. `ss` and process cwd inspection identify Vite serving this workspace. Served HTML has BEYOND, `/src/main.tsx` and Vite markers; App/HeroScene/CSS contain the actual uncommitted motion implementation. This excludes a stale or different 5173 server in this environment.
- Read-only Sites metadata confirms only historical version 1 at baseline commit 4892818 is published. The user clarified they are using local 5173, so that hosted-version difference is not the diagnosis of their local report.
- Fresh Chromium: HeroScene mounted, Canvas 2D present, no landing WebGL renderer (intentional lazy exploration design). Seven ambient animation names match loaded keyframes and currentTime advances. Display/visibility and compositing measurements show effects are not globally hidden by z-index/overflow/opacity. No pageerror/console error/request failure was observed in the sampled pages.
- Rendered full-page samples were captured with animations allowed after entrance type effects settled, six seconds apart. A pixel is counted changed if any RGB channel changes by more than 3/255. At 1440x900, before: 2.085%, after: 8.898% changed; mean maximum-channel delta 0.540 -> 1.112. Upper-sky region: 0.091% -> 15.069%. Mobile 375x900: 10.469% -> 11.705%. Pixel changes are not a perceptual-quality score and CSS phase/frame times are not exactly identical across sessions.
- Both OS reduce and explicit saved reduce yield 0 advancing Canvas frames, 0 active CSS animations and pixel-identical snapshots; accessibility behavior remains intentional.
- Dominant world artwork is a static WebP. Animation is implemented as overlaid stars/clouds/fragments/portal energy, so most scene pixels naturally stay static. This was documented rather than falsely claiming animated 3D scenery on the landing.

### Confirmed state bug / correction

With no saved setting and OS reduce at first load, old App initialized `reduced` from `systemReduce()`. Changing OS to no-preference made `systemMotion=false`, but `reduced` remained true. The resulting low-motion class stopped both Canvas and CSS until a reload. A new regression test failed before correction. App now initializes only the independent explicit app preference (false when unset); effective reduction is still app OR system. An additional test protects explicit saved true after OS changes.

HeroScene star contrast/halos and portal spark trails were strengthened. Scoped CSS adjusts cloud opacity/cycle and portal arc contrast. No layout, world data, route, portal hook or storage helper changes were required.

### Actual commands / results

| Command                                                                                                      | Result                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `npm run test:browser -- --grep 'system motion can resume'` with documented Linux library prefix, before fix | 1 failed as expected, demonstrating the bug                                                  |
| `npm run typecheck`                                                                                          | Passed                                                                                       |
| `npm run build`                                                                                              | Passed                                                                                       |
| `npm test`                                                                                                   | 9 passed, 0 failed                                                                           |
| `LD_LIBRARY_PATH=/tmp/jalisco-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run test:browser`          | 23 passed, 0 failed (existing 21 retained + 2 regressions)                                   |
| `git diff --check`                                                                                           | Passed                                                                                       |
| Direct diagnostic against 5173                                                                               | 1440/375 normal, OS reduce and saved reduce sampled; no observed page/console/request errors |

Ephemeral evidence: `/tmp/beyond-5173-animation-diagnosis.json` and `.log` (before), `/tmp/beyond-5173-animation-after.json` and `.log` (after), `/tmp/beyond-motion-regression-before.log`, `/tmp/beyond-motion-fix-browser.log`, screenshot pairs `/tmp/beyond-5173-diag-*-0.png` / `*-6.png` and `/tmp/beyond-5173-after-*-0.png` / `*-6.png`, actual desktop video `/tmp/beyond-localhost-5173-motion.webm`. Diagnostic scripts are under /tmp; their instrumented counters only touched disposable browser contexts, not application files or user browser profiles.

No Google Chrome executable is installed in this environment. Browser automation used bundled Chromium (same rendering engine family), not the user's existing Chrome profile. Their saved setting, system preference, extensions or DevTools emulation are unverified. No physical-device/Safari/Firefox/performance/heap claim is made. Existing app code outside the narrowly changed files is preserved; Git remains uncommitted and unpushed.

## Latest task — whole-screen landing animation, 2026-10-28 (Asia/Rangoon)

Scope was limited to the landing renderer/styles, additive tests and relevant documents. App, portal transition hook, world renderer/data, local persistence, translations, dependency inputs, background art and hosting settings were preserved against task-start SHA-256 snapshots. No install, admin/backend/API/DB addition, commit, push or deployment.

### Actual commands and tests

| Command/check                                                                                       | Result                                                                                                                                |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                 | Passed                                                                                                                                |
| `npm test`                                                                                          | 9 passed, 0 failed                                                                                                                    |
| `npm run build`                                                                                     | Passed                                                                                                                                |
| `LD_LIBRARY_PATH=/tmp/jalisco-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run test:browser` | 29 passed, 0 failed; previous 23 retained and 6 new                                                                                   |
| `git diff --check`                                                                                  | Passed                                                                                                                                |
| Direct `http://localhost:5173/` samples                                                             | 375/768/1440px, six-second composited screenshot pairs, all 9 regions changed; no observed console/page errors or horizontal overflow |

The six new browser scenarios inspect full composed pixel changes in all nine regions at three widths, distinct pointer depth without moving typography, static atmosphere plus working entry when Canvas 2D is unavailable, and one bounded drawing loop after repeated resize. Existing tests cover reentry/cleanup, system and saved reduced motion, Canvas/WebGL fallback, real world portals, route history, EN/ES, bookmarks and sharing. Frame-loop guards are not physical-device performance benchmarks.

### Visual inspection versus automation

Before and after were captured with animations allowed after title entrance settled. No pointer input was needed for the timed changes. A pixel counts changed when any RGB channel differs by more than 3/255; nine equal screen regions were measured. Samples have slightly different frame times/phases, so do not treat percentages as exact repeatable perceptual scores.

| Viewport | Smallest region change before | Smallest region change after | All 9 regions >1% after |
| -------- | ----------------------------- | ---------------------------- | ----------------------- |
| 375x900  | 0.032%                        | 11.877%                      | Yes                     |
| 768x900  | 0.173%                        | 8.392%                       | Yes                     |
| 1440x900 | 0.183%                        | 4.437%                       | Yes                     |

At 1440px specifically, middle-left changed 0.183% -> 54.957% and bottom-right 0.183% -> 48.041%. This establishes spread beyond the portal, not that half the picture physically travels. Broad low-amplitude atmospheric changes contribute many pixels. Desktop/mobile screenshots were visually inspected for composition and text/CTA readability. New backgrounds were not substituted: the same local WebP is still used beneath live overlays.

Evidence (ephemeral /tmp): `beyond-fullscreen-before.json`, `beyond-fullscreen-after.json`, their `.log` files, paired `beyond-fullscreen-{before,after}-{375,768,1440}-{0,6}.png`, browser log `beyond-fullscreen-browser.log` and desktop video `/tmp/beyond-fullscreen-motion.webm`. The diagnostic sampler is `/tmp/beyond-fullscreen-sample.mjs`; reproducible regression checks live in `tests/fullscreen-motion.spec.ts`.

Headless Chromium was used, not the user's actual Google Chrome profile. No physical-mobile, Safari/Firefox, sustained GPU/frame-rate/heap measurements were performed. Existing accessibility choices remain: OS/app reduce is static, failed Canvas is static, simplified mode reduces effects, and exploration retains its existing no-WebGL fallback.
