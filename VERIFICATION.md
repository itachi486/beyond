# Verification record

Implemented and checked on 2026-10-27 UTC. All operations were limited to the new BEYOND directory and its separate owner-private Sites deployment. The existing NopaHua/Jalisco application was not modified.

## Final results

| Command / check | Actual result |
| --- | --- |
| Dependency installation | Succeeded; package-lock.json retained for `npm ci` |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; separate lazy 3D chunk and Three.js vendor chunk |
| `npm test` | 9 passed, 0 failed |
| `npm run test:browser` (Linux library prefix documented in README) | 11 passed, 0 failed; Chromium software WebGL |
| `npm audit` after upgrading Vitest | 0 vulnerabilities |
| Vite development server | Started successfully on port 5178 for QA |
| Screenshots | Threshold and worlds inspected at desktop/mobile; layouts tested at 375, 768, 1440px |

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
