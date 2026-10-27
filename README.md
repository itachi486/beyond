# BEYOND — The Internet Within the Internet

A browser-local discovery universe built from scratch in `internet_project/beyond`. The neighboring Jalisco/NopaHua project is not used or modified. No account, paid API, backend, tracking, or cloud database is required.

## Run

Requires Node **22.12+** (tested 22.23.2) and npm.

```sh
cd /home/administrator/internet_project/beyond
npm ci
npm run dev
```

Open the URL Vite prints (normally http://localhost:5173).

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Browser tests use Playwright Chromium:

```sh
npx playwright install chromium
npm run test:browser
```

On this particular Linux host Chromium needs the existing library bundle:
`LD_LIBRARY_PATH=/tmp/jalisco-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run test:browser`.
This host-specific prefix is not needed on a normally configured computer.

## Experience

The threshold uses a **new generated, text-free environment painting** as one background layer, live HTML typography, controls, moving star layers and orbital accents. It does not display the supplied screenshot as the application. The original reference remains untouched in the parent directory. The generated background is optimized to a local ~367KB WebP.

Enter the Unknown lazy-loads a genuine Three.js scene. Four data-driven worlds have different structures: an architectural Archive, rock-spire Elsewhere, fragmented crystalline Unsolved, and a forest-and-water Natural World. All have procedural floating terrain, portals, a celestial sky, stars, distant landmarks and mist. The exploration scene is a **stylized procedural environment**, not a photorealistic reconstruction of every architectural detail in the reference.

- Drag with a mouse or touch to look; WASD/arrows or the movement pad move.
- Camera orientation never rotates automatically. Reduced motion disables environmental floating/pulsing. Movement remains directly controlled.
- Click a luminous landmark to open a discovery; click a colored portal to travel to another world. World buttons provide an equivalent keyboard-accessible route.
- Nearby cards provide accessible alternatives to canvas picking.
- Only authored same-world content relationships produce spatial connection lines. Detail panels include explicit cross-world related discoveries.
- Escape closes overlays; focus remains within active dialogs. Settings offer simplified rendering and reduced motion.
- Bookmarks, visit history, tutorial dismissal, language, and display settings use versioned `beyond:v1:*` localStorage. Malformed data and unavailable storage are handled safely. Storage clearing/private browser sessions can remove this local data; there is no server backup.
- Every discovery has a direct `/discoveries/:slug` URL. Back/forward work through React Router. Clipboard sharing uses the current stable URL, with a manual-copy message when permission is unavailable.
- WebGL initialization, context loss or scene-module errors leave all discovery content and navigation usable in a 2D alternative.

## Content and languages

Eight curated discoveries, two in each world, include Venusian time, exoplanets, Socotra, Cappadocia, dark matter, Enceladus, coral reefs and auroras. Body copy is locally bundled; no runtime content requests. Each entry cites a NASA, NOAA or UNESCO source inspected during implementation. Summaries are original paraphrases. The environments are explicitly fictional; scientific uncertainty is labeled, and no extraterrestrial life is claimed.

**English and Spanish are fully available** for interface and all eight discoveries. Japanese, Korean, French, Simplified Chinese and Traditional Chinese appear disabled and marked upcoming. They are not advertised as translated. No external translation API is used. Switching language retains routes, selection, local collections and the current 3D camera.

## Architecture

- `src/App.tsx`: routes, navigation, threshold, collections and discovery panels.
- `src/components/`: accessible overlay, icons, scene error boundary.
- `src/worlds/engine.ts`: procedural geometry, lighting, sky, raycasting, pointer/keyboard controls and resource disposal.
- `src/worlds/WorldScene.tsx`: React lifecycle bridge, loading/failure states and movement pad. Three.js is lazy loaded separately from the first screen.
- `src/data/universe.ts`: typed worlds and content, stable IDs, positions, relationships, sources and metadata.
- `src/locales/index.ts`: typed English/Spanish catalog and honest language availability.
- `src/lib/storage.ts`: versioned, validated local persistence.
- `src/styles.css`: color/spacing tokens, responsive composition, accessible focus and reduced-motion styles.
- `src/tests/`: content graph, localization and storage unit tests.
- `tests/`: actual browser interaction tests.

Three.js is used directly, avoiding the additional React Three Fiber/Drei dependencies for this modest scene. The engine mutates camera transforms outside React and caps pixel ratio, particles and geometry for practical rendering. Settings can rebuild the scene; normal locale or panel changes do not. Resize observers, animation frames, GPU materials/geometries/textures and listeners are cleaned up on unmount. Rendering skips hidden tabs. The 3D module is ~125KB gzip, loaded after entering.

## Extend

1. Add a `Discovery` to `src/data/universe.ts`: unique stable `id`/`slug`, both localized titles/summaries/body, category, world ID, position, valid related IDs, source URLs, content type, explicit fiction label, share image and creation date. Verify factual sources before adding claims.
2. Add a world to the `WorldId` type and `worlds` array, a sky/background palette and a distinct structure style in `engine.ts`. Do not add empty destinations.
3. Add a language catalog conforming to the English message shape, translate all discovery fields, then enable that language in `languageOptions`. Extend the `Locale` union and storage validation only when the full catalog is ready.
4. Run all checks and browser tests, including direct URLs and fallback mode.

## Static hosting

`npm run build` produces `dist/`. Serve it over HTTP, with **all non-file routes falling back to `index.html`**. React Router direct discovery/world URLs require this SPA fallback. Vite dev/preview and the attached Sites static hosting supply it. Other hosts must configure their own rewrite. `public/_redirects` is provided for hosts supporting that format; it is not universally recognized. Do not open `dist/index.html` via `file://`.

The `.openai/hosting.json` manifest describes a separate private BEYOND Site. It has no connection to the NopaHua staging Worker or its credentials, databases, authentication or deployment settings.

## Verification boundaries

See `VERIFICATION.md` for commands and actual results. Browser QA uses headless Chromium with software WebGL. This proves functionality, not frame rate on every phone or support in every browser. No physical-device or Safari testing is claimed. There is no audio, multiplayer, user-generated content or AI content service. Eight short discoveries are a curated MVP, not an exhaustive encyclopedia.
