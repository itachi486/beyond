# Latest — hybrid personal-world exploration

Personal Spirit-world Explore Mode reuses the existing clean `public/celestial-world.webp` (inspected against the supplied cosmic fantasy references). Three shared-texture shader planes provide distant artwork and soft-edged architectural depth crops; live Points stars, nebula sprites, haze, a painted-portal energy overlay and actual portal-character light rings add motion. UV crops are image layers, not newly modeled buildings or genuine transparent island cutouts. Scenery stays decorative; selectable targets come from saved graph IDs and relationships. The six-world reference selector remains unchanged.

One artwork texture/plane geometry is reused; overscan/aspect fitting and conservative depth parallax avoid a flat screen-fixed wallpaper. Artwork is disabled in Edit Mode. Missing artwork reports a separate warning while native characters/control remain. Resize updates atmosphere before the immediate render, including reduced-motion portrait layout. Existing camera pan/zoom/focus/back and accessible anchors are retained.

Character alpha comes from the original file, not a checkerboard or color-key trick. Remove the old preview checkerboard and rectangular AI-image aura; imported image materials avoid tone-mapping color shifts and keep soft alpha. Files and data references remain unchanged. High-detail scenery is artwork; image characters remain2.5D, not rigged3D. Actual PNG alpha and public publication filtering are tested.

Ordinary users now obtain new characters from Central Library only. Existing local graphs/assets remain intact and editable. Administrator-only local authoring and external backup imports use the existing server session capability, with live checks before new manual creation/file saves/import. This normal-application policy does not make personal IndexedDB/localStorage immune to its owner's developer tools. Central server writes are independently authenticated as before.

---

# Latest — character discovery exploration (local only)

The current task improves **HIDDEN WORLDS personal Spirit-world Explore Mode**, using its actual saved SpiritGraph. It does not replace the exact-image six-world selector, landing, native legacy world routes, or the administrator workspace. Renderer remains Three.js/OrthographicCamera so existing 2.5D/imported character coordinates, scales and editor placement remain compatible. Exploration gestures deliberately pan the existing view instead of introducing a conflicting free-flight/orbit coordinate system.

Implemented layered Points stars (three draws;2400 desktop/840 mobile), four shared-texture nebula sprites and two decorative low-poly distant planets, with different camera parallax and slow motion. Scenery has no discovery IDs or invented characters. Camera bounds and finite reusable background layers create an extended-space impression, not literal infinite content. Existing assets/model silhouettes/scales are untouched.

Exploration mode: drag/pan, smooth wheel/pinch zoom, keyboard/tap character selection, eased focus on actual character IDs, hover halo and on-demand labels, real outgoing/incoming relationship labels and follow actions, Back to previous discovery, Close/Escape and Reset view. Manual input interrupts travel. Trail/selection/camera remain transient; no new persistent discovery/reward tracking. Missing selection IDs clear safely. Existing imported character previews reuse AssetPreview and IndexedDB originals; missing assets show an honest unavailable message. No automatic regeneration, upload or paid call.

Edit mode retains drag-to-position, existing bounds, undo/redo, resize/scale, graph links and original save/reopen/export policies. Connection curve and label projection buffers are reused per frame; no React camera state updates. Reduced motion stops idle rendering, while explicit camera actions still draw. Events, atmosphere geometry/materials/textures and RAF are cleaned on disposal. No FPS/performance benchmark is claimed; browser tests and fixed object/draw budgets are evidence, not measurements of physical mobile devices.

Investigation: source has five procedural Spirit types plus dynamically imported/local/central character instances, not a fixed ten-character ID roster. No actual operator Chrome-profile inventory was opened or modified, and no names/IDs were fabricated to match that number. Existing authored asset/data-model files and their sizes/positions remain unchanged by this task; tests use isolated local fixtures.

Checks so far: typecheck/build PASS, unit24/24, server48/48, focused Spirit browser11/11. Final full browser result is pending. Evidence logs `/tmp/beyond-discovery-{build,unit,server,full}.log`; focused `/tmp/beyond-discovery-focused2.log`. Inspected real screenshots1440/375 showed genuine characters/paths and also a remaining mobile viewport-height/toolbar polish to finish after the frozen suite.

No commit/push/deploy, administrator/login/API/schema/env/actual user-data edits. Task-start hashes `/tmp/beyond-discovery-start.json`; branch main and HEAD f4585907ecb8158eafd61cc769c4c31e94d102c0 unchanged. Current new files: spiritAtmosphere.ts and DiscoveryPreview.tsx; modified SpiritEditor.tsx, spiritScene.ts, spirit-editor.css, tests/spirits.spec.ts, and these handoff docs. Resume from newest verification entry rather than historical test counts.

---

# Latest administrator visual decision — light fantasy reference

The user selected `Beyond Admin Fantasy Dashboard.png` as the authenticated administrator workspace reference, superseding the earlier dark dashboard only. Keep the cosmic login unchanged. Warm ivory, sage, charcoal, subtle borders/shadows, editorial headings, restrained landscape decoration and compass motif; no mock statistics, copied Korean UI or fake health. Preserve all existing editorial/inventory/central library routes.

Layout: full-width brand/account header, desktop left navigation, four scoped metrics, primary chart/statistics and recent tables, right system/quick-actions/about column. Under800px navigation folds behind an accessible toggle; cards/tables stack for375px. English catalogs are admin-only; public locale behavior is untouched. Permanent deletion uses a named modal, target name/ID, precise scope warning, Cancel and Delete Permanently, busy lock and actual server outcome. Archive remains a distinct retaining operation.

---

# Cosmic administrator + shared originals

The supplied `Beyond Cosmic Admin Experience.png` is copied unchanged to public/admin-cosmic-reference.png. CSS uses/clips the upper illustration, masks baked UI/logo regions and renders all actual brand/form controls in HTML. Very wide layouts reuse the existing clean celestial artwork. Login keeps server-derived onboarding/config/review states, real email/password/show/hide/errors and honest recovery guidance. No screenshot is used as a functional form or dashboard.

CosmicDashboard composes four real metrics (editorial worlds, undeleted central originals, editorial connections, active administrator accounts), SVG graph of persisted worlds/inter-world edges, recorded central actions/existing revisions, central-type donut and working quick actions. Thumbnail art is labelled illustrative; graph positions are editorial layout rather than geography. No seeded statistics/growth/user activity is invented. Dashboard/Worlds/Characters/Connections/Analytics/Settings are primary routes, with retained Users/Content/Discoveries/Activity Log and original editors/contracts. Cream admin styles are superseded by a scoped dark blue/purple/cyan/gold cosmic sheet; public six-world/landing styles remain untouched.

Central character metadata is SQLite; immutable original/thumbnail revision files are outside served directories. Lazy additive tables do not alter old schemas/IDs/grants. Auth/Origin/JSON/CSRF and live session recheck wrap writes; source validation repeats server-side. Shared pure glTF bounds now live in shared/model-validation.mjs, reexported by the existing browser upload module. Sharp checks magic+decode, pixels and thumbnail output; server additionally validates GLB chunks, embedded buffers/textures, accessors/indices/scenes/resource budgets. No remote model URI fetch.

Public listing contains active, nonarchived metadata only; private fields/file keys/administrator emails are omitted. Public file/preview access checks active state and optimistic version. Metadata/file edits increment version; stale writes fail409. DELETE is explicit confirmed archival, never physical purge. Original revisions remain for preservation. Root paths/symlink resolution and Vite deny rules prevent direct-static bypass. File/DB failure compensation cleans only new files, and a failure to clean reports operator action without leaking storage paths.

CentralLibrary is a separate public dialog in SpiritEditor. Downloaded originals pass the existing client decoder and real preview before confirmation. Persisted IndexedDB cache has centralId/version; Character has optional centralCharacterId/centralVersion plus existing uploadedAssetId snapshot. Same ID/version cache is reused; local movement/scale/graph relationships never update the original. Personal library omits central-cache entries and remains usable. Existing saved worlds reopen from local copies offline/after deactivation; new acquisition requires a current active original. This deliberately preserves old snapshots instead of silently replacing their content. Existing backup/export code is unchanged.

---

# First-administrator onboarding correction

Coarse GET-only setup state does not grant access or publish configured email/credentials. AdminApp loads session and setup state together, showing one of explicit local setup instructions, config missing, ready sign-in or existing-account operator review. Status unavailable fails closed with retry guidance. POST setup/register remains blocked by the original shared auth gate; no public password-setting endpoint exists.

Reuse `createInitialAdmin` for allowed-email, password policy, scrypt and BEGIN IMMEDIATE single-account checks. CLI now uses configured email without requiring an argument, checks configuration/existing account before asking for secrets, reads and confirms hidden input and refuses replacement. New input reader bounds bytes, handles UTF-8, backspace, CRLF/pasted confirmation, restores raw mode and cancels on Ctrl-C/EOF. Non-TTY accepts two matching lines, only for controlled automation; no plaintext persistence or output. Existing sessions/cookies/login/CSRF remain unchanged. CLI registration requires filesystem/process access, avoiding unauthenticated email-only claiming.

No password reset feature is added. Recovery guidance preserves existing accounts and requires an authorized operator procedure if the old password is lost. Actual zero-admin installation needs first enrollment, not reset. Narrow admin-setup CSS overrides keep instructions and privacy notes visible on375px. Other admin and user pages remain as before.

---

# Private administration update

Reuse existing AdminApp, SQLite editorial models and scrypt/session/CSRF backend. Add server-only ADMIN_ALLOWED_EMAIL enforcement in bootstrap, login and findSession, including existing AI private reads/generation gates. Configuration accepts one normalized valid email; absent/malformed/list values deny access. Bootstrap remains private and refuses an existing admin; transaction rechecks avoid concurrent double creation. Unexpected multiple admin rows deny sessions rather than silently deleting data. No public registration or new authentication provider.

Dashboard extends existing real counts, marking browser characters/worlds Not centrally stored. Shared AdminInventory fetches authorized SQL-paginated Users and Characters lists (10/page), filters/search, abort guards, details and actual private image previews. Users are real admins only. Server AI image assets do not imply centrally stored character entities or local world usage. Existing Worlds/Discoveries/Connections retain IDs/contracts, publication/revisions and destructive-action confirmations. Content is an entry to those editors. System Settings retains password/default-language actions and adds secret-free configuration/status.

Warm cream #f7f5ee, sage #e4eae1, forest actions #486448, restrained terracotta and charcoal are admin-scoped. Responsive sidebar/table/details overlay, keyboard focus and same authenticated route system remain. User-facing six-world art/3D/character library/backup modules were not edited. No dependency, schema migration or server synchronization introduced.

---

# Portable character/world packages — current design

Reuse the existing CreatedWorld V1/V2 validators, graph model and upload decoding/model bounds. Portable format version1 is independent of world version. Shared `BackupControls` provides fantasy-styled export, focus-contained nested import dialogs, file/asset/count/result previews, name confirmation and EN/ES errors. Background dialogs become inert while import is open. Download names and ZIP asset paths use fixed labels/UUIDs, never user text.

`backupZip.ts` implements a bounded STORE-only ZIP profile without new dependencies: strict directory/local-header agreement, sequential non-overlapping entries, fixed safe path grammar, CRC32,80 MiB total,42 files and JSON2 MiB. Compression, encryption, traversal, extra files/duplicate entries/ZIP64 and unsupported structure are rejected. `worldBackup.ts` validates package version, world graph, all required assets, hashes, resource formats and decodability before writing.

Restore copies originals to new asset UUIDs in a single IndexedDB add transaction. New world/character/object/content/connection UUIDs remap worldId, contentIds, endpoints, referenceId and self-world portals. External portals remain external and are disclosed. Optional `backupFingerprint` (package SHA-256) on worlds/assets plus auxiliary receipts deduplicate exact reimports even when auxiliary receipt storage fails. Existing V1/V2 records remain valid. Imported character library records keep a template with display/type/content; placement copies it to new world/character/content IDs, retaining the explicit graph relationship system.

Web Locks serialize restores across tabs where supported; UI locks duplicate submits. World insertion uses existing non-destructive saveWorld and re-reads storage at commit. Storage estimate is checked when browser exposes it. On localStorage failure, new binaries are compensating-deleted; cleanup failure has an explicit partial-restore warning. No true atomic transaction spans IndexedDB and localStorage: abrupt termination may leave unreferenced copies. Browsers without Web Locks do not have a cross-tab restore lock. No existing records are intentionally overwritten.

---

# External character import design

SpiritEditor exposes Upload Character before optional AI creation. A focus-trapped fantasy dialog supports file picking/drop, actual image/WebGL preview and editable name, description, spirit type, scale, placement, tags and source URL. Registration is blocked until decode/render readiness. Library-only save and current-world placement are separate. Source/credit can be entered in description and source URL. No external production tool integration or AI fallback is invoked.

New optional graph fields `uploadedAssetId`, `uploadedKind`, `tags`, `sourceUrl` retain existing V1/V2 data. UUID asset records contain original Blobs and editable metadata in IndexedDB. Blob URLs are transient render handles recreated from durable Blobs, never the sole stored reference. Same asset can be placed in multiple local worlds. Relationships are explicit graph edges, independent of position.

Image planes preserve alpha/aspect. GLTFLoader parses real meshes with bounded resources, normalizes size, and uses OrbitControls in preview. Cloned instances preserve skeleton structure; no skeletal animation playback claim. Async load guards, template caching and disposal protect edits/reopen. Reduced motion keeps existing scene policy. Data/blob CSP allowances support textures without permitting blob scripts or remote resource loading.

---

# AI character image integration — current local state

Extended existing SpiritEditor with CREATE A CHARACTER, a fantasy creation dialog (name/type/personality/story/appearance/abilities, optional512KB PNG/JPEG/WebP reference and validated related website). Indeterminate truthful progress, duplicate-submit lock, preview gated by actual image load, regenerate/edit/use/retry, configuration/login/quota/billing guidance, mobile scroll and reduced motion. Manual character templates remain available. No fake production images or automatic generation on reopen.

Server uses official openai SDK7.45.1, images.generate / images.edit and PNG base64 responses. Default model `gpt-image-2.5-sunburst`, explicit override AI_IMAGE_MODEL. Checked official current references: https://developers.openai.com/api/reference/resources/images/methods/generate and /edit; gpt-image-1 is retired in current docs, not used. API credentials stay server-only. Vite plugin loads OPENAI_API_KEY privately from .env.local; Node npm start now loads .env and .env.local. Existing .gitignore already excludes .env.local; no secret file contents/values output or modified.

Important live configuration result: .env.local exists but Vite loadEnv currently reports OPENAI_API_KEY absent/empty. User reports trial credit$0.00 and explicitly requires confirmed usable credit before any live generation test. Accordingly **NO live OpenAI request was made**. No authentication/billing/model access success claim. Both key and billing/credit/access need operator verification before real generation. Test results below are mocked service/SDK, never presented as real AI output.

New /api/ai/status, POST /api/ai/generations and GET /api/ai/assets/:id. Actual paid-capable generation/asset reads require existing server-authenticated session; POST also exactOrigin/JSON/CSRF. There are no public visitor accounts, subscription or payment systems, so current integration uses existing authorized admin sessions without modifying their authority or UI. Do not expose paid generation anonymously or claim general visitor/premium auth is implemented.

SQLite private asset BLOBs and generation ledger are initialized idempotently only on configured authenticated AI use. Default server policy3 free /20 premium perUTCday, configurable AI_IMAGE_FREE_DAILY_LIMIT / AI_IMAGE_PREMIUM_DAILY_LIMIT; trusted operator-assigned AI_IMAGE_PREMIUM_CREATOR_IDS, not client fields or billing claims. Separate AI_IMAGE_DAILY_ATTEMPT_LIMIT(default60) bounds failures. Durable unique requestID + payload hash + transactional reservations prevent concurrent/retry double quota deductions. Failed generations do not count as completed-image quota (provider charges are outside this policy). Errors and usage recorded without raw prompt/key/provider error body. SDK retries disabled,120s timeout. Missing key/auth, billing/credit, rate limit, invalid request/model access, provider5xx, network and timeout have distinct sanitized messages. Never generate dummy art after failure.

Images persist as owner-protected PNG assets in existing BEYOND_DB_PATH SQLite, not expiring upstream URLs or localStorage base64. Reopen requires same server database and an authorized session; logout/missing image shows an error and does not regenerate. Preserve DB/backups; stateless hosting needs persistent disk or future object storage. Unused generated assets currently retained; no destructive cleanup/deployment performed. New AI tables exercised only in disposable test databases, not manually applied to real DB.

Optional Character fields preserve V1/V2 compatibility: creatorId, personality, appearancePrompt, abilities, assetId/imageUrl, local visibility, animationPreset. Existing graph/content references reused. Use confirmation adds a durable UUID and optional related-site content. Scene uses true Three.js textured2.5D planes with aura/ribbon/sparks, float/sway/pulse and selected glow. This is NOT a rigged model or AI animation/dialog/autonomy. Cached textures reuse private assets across edits/duplicates; cleanup on removal/dispose; no per-frame React state. Old procedural characters, connectivity, content, history and existing2D worlds remain.

---

# Character-based CREATE — latest local direction

Newly created worlds now use version2 graph data and SpiritEditor. Existing version1 SVG worlds still open their original WorldEditor unchanged; no forced migration or deletion. The current creation modal, Hidden Worlds artwork, six-destination selector and bookmarks remain. Current new-world flow: Hidden Worlds → CREATE → name/description modal → save valid version2 → real Three.js character scene. Saved `creation=UUID` deep links remain browser-local.

Five procedural3D spirit types: faceted cloak/face with luminous eyes and type-specific constellation petals, orbiting collection books, sculpted feather, portal arch or custom energy knot. Physical clearcoat/translucent materials and additive ribbons provide stylized glass/light response, not ray-traced photorealism. Distinct color/silhouette, slow float/sway, selected halo; bounded360 background stars. Camera fits characters; resize redraws immediately. Three.js reused, lazy-loaded only for the new editor; no new dependencies/assets/services.

Character operations: add/select, actual raycast pointer/touch drag on constant-z plane, accessible keyboard selection/movement, XYZ/name/description/type/material preset/color/scale/custom role, duplicate with copied content/new IDs, cascading delete, bounded50-step undo/redo, explicit save, MY WORLDS return. Maximum40 characters/120 connections/200 contents. Mobile caps DPR1 and ambient24Hz (desktop1.5/30Hz). Reduced motion renders only invalidated frames, with GPU-call regression coverage. Renderer/RAF/ResizeObserver/listeners/geometries/materials dispose on exit; WebGL failure keeps accessible data controls.

Directed graph paths have IDs/type/label/description/local visibility, curved3D lines and moving direction beads; create by two selections or destination selector, reject self/missing/duplicate source→target pairs, edit/delete through canvas or accessible path controls. Move updates endpoints. World Spirit follows/highlights outgoing group; Collector/Custom expose content; Creator opens existing/new text editing; Portal follows an outgoing path or enters an actually stored local world. Incoming/outgoing paths remain separate. No remote/private-world permission is granted; missing/corrupt local targets are refused.

Per-character website/image URLs, notes/stories/ideas and character references have own IDs/dates/owner associations and source metadata. Custom centered content dialog shares creation design. Edit/delete and provenance links work; React text escaping, http(s)-only URL validation, no scripts/HTML/iframes/metadata scraping. Image content is an external original link, not uploaded storage or auto-embedding. Explore Mode hides library/edit fields while retaining character content and pathway traversal; mode switches preserve edits.

Storage decision: considered IndexedDB, retained the existing small bounded text/URL localStorage store to keep version1+version2 in one validated atomic serialized write and avoid a split-store migration. No binary image uploads. `beyond:v1:created-worlds` holds complete world/graph; bad schemas or references block writes without overwriting; quota/stale revision errors visible; old draft/bookmarks untouched. This browser/origin only. No server synchronization, public publishing, external user-world permissions or account-based ownership implementation. More/binary assets will require a separately planned IndexedDB migration.

Changed/new source: creation/spiritModel.ts, spiritScene.ts, SpiritEditor.tsx, SpiritContentModal.tsx, spirit-editor.css; creation/worldStore.ts and worlds/HiddenWorldsPage.tsx. Added tests/spiritModel.test.ts under src/tests and tests/spirits.spec.ts; prior creation tests retain version1 editor assertions through explicit version1 fixtures, while new tests exercise actual version2 creation. No admin/API/schema/auth/secrets/image/background source changes, commit/push/deployment.

---

# Local CREATE world composer — current implementation

HIDDEN WORLDS CREATE now opens a centered fantasy glass modal first, never the editor directly. Separate labels, whitespace validation, nearby errors, textarea Enter, focus trapping/return, Escape/Cancel and deliberate non-dismissible backdrop. Storage success gates editor entry; duplicate synchronous submissions locked. Navy/violet translucent surfaces, teal focus glow, gold-gradient action and decorative pointer-transparent sparks; reduced-motion CSS removes animation.

New local schema version1 includes UUID/name/description/createdAt/updatedAt/theme/objects. Existing storage utility/prefix reused with `beyond:v1:created-worlds`; legacy `hidden-world-draft` and bookmark keys are not changed/deleted. Malformed/unsupported data blocks writes instead of resetting it. Save detects stale modification timestamps, handles unavailable/quota storage and only shows success on true write. Old draft can prefill a new modal without automatic conversion or deletion.

Actual 2D SVG scene composer, not3D or AI-generated worlds: eight original vector object artworks (crystal, portal, tree, ruins, island, door, orb, sanctuary), drag/touch/keyboard move, normalized1000x650 coordinates, numerical size/rotation/layer/name, selection/deselect/delete, bounded50-step undo/redo, three atmospheres, zoom/reset view, preview, explicit save and MY WORLDS reopen. Up to200 objects per world. Query `creation=UUID` on existing Hidden route reopens saved local world on refresh; no new backend/auth/admin APIs. MY WORLDS lists individual local worlds and keeps original drafts/bookmarks.

Object/metadata edits remain in memory until Save; creation itself immediately saves an empty valid world. Leaving via MY WORLDS warns on unsaved changes; browser reload uses beforeunload. This browser/origin only, no server sync/publication/export/multi-user permission linking. CONNECT remains honestly unavailable. Existing hub/reference images/other five destinations/admin/backend unchanged in this task. No package/dependency addition, commit/push/deploy.

Files: src/features/creation/{CreateWorldModal.tsx,WorldEditor.tsx,ObjectArt.tsx,worldStore.ts,creation.css}; src/worlds/HiddenWorldsPage.tsx; src/tests/worldStore.test.ts; tests/creation.spec.ts; tests/hidden-worlds-page.spec.ts (original action assertions adapted to the new create-then-editor flow); existing project documents. Prior uncommitted work preserved.

---

# Hidden Worlds image-native screen — local work

The exact supplied1536x1024 `Hidden Worlds_ Floating Realms.png` is copied unchanged to public/hidden-worlds-reference.png. Its lower four labels and top-left BEYOND logo are embedded pixels, preserved. No top-right Explore/Create/Connect/My Worlds menu exists in the supplied image or was added as DOM. Existing global icon/language navigation remains; duplicate DOM wordmark hidden only on this page.

Default /explore?world=realm-hidden-worlds (and matching world route) now loads HiddenWorldsPage; explicit view=walk retains the older3D garden/navigation. Other five destinations and admin/server/data source remain unchanged. Transparent SVG polygons map the left portal / central crystal / connected arches / right library. Canvas2D at30Hz adds rotating elliptical portal light, localized glow/pulse, bounded particles and flowing links. Reduced motion is static; no per-frame React updates; observer/RAF cleanup. Original image unchanged. Portrait panorama plus whole-image overview, no stretching.

Four real actions: EXPLORE lists existing public catalog discoveries and opens their original routes; CREATE edits a name/description local-browser draft (no shared-world publishing), validates limits and reports storage failure; MY WORLDS reopens that draft and existing saved discoveries; CONNECT explicitly states user-world permission linking is not available, never pretends success or accesses private worlds. Existing backend does not provide visitor-world authoring/connection authorization, so none invented. This screen is not a completed multi-user world builder.

Changed src/App.tsx; added src/worlds/HiddenWorldsPage.tsx, hidden-worlds-page.css, public/hidden-worlds-reference.png, tests/hidden-worlds-page.spec.ts; adapted tests/reference-selection.spec.ts for the intentional Hidden destination replacement; updated existing docs. Prior uncommitted changes preserved. No dependency install, admin changes, commit/push/deployment.

---

# Reference-hub refinement — latest Korean brief

Existing exact-image implementation inspected and preserved. This follow-up only adds gold accents to UNSOLVED's cold mist palette and silver-white accents to the library's warm gold, disperses letter particles outward on pointer exit, and removes the global image brightness filter on activation. Click energy remains entirely in the transparent Canvas overlay; original artwork receives no color/filter transformation. No new3D, dependencies, admin/data/auth/routing changes. Added six real landmark-click browser cases, one per existing canonical destination ID.

The full image remains contain-fit on desktop. Portrait has a swipeable full-height panorama plus full-image overview; this preserves the artwork's aspect ratio rather than stretching or losing destinations permanently. The embedded CHOOSE YOUR CURIOSITY / Six worlds. Endless discoveries. heading remains exactly as in the original image.

---

# Current direction: exact-reference interactive selector

The latest user brief supersedes the previous procedural-3D-first selection screen. `/explore` uses the supplied `01-reference.png` unchanged as `public/world-selection-reference.png`, not a generated replacement. Six normalized irregular SVG polygons follow the artwork's landmarks; real transparent keyboard/touch controls sit over the image. World IDs and EN/ES names come from the existing shared universe. No permanent destination menu or rectangular hover cards.

Canvas2D at a bounded 30Hz overlays ambient stars and localized glow, entry sparks, expanding rings and three world-specific trails. Sampled letter pixels gather into localized titles: branching gold / violet helix / blue wisps / emerald vines / rising cyan / amber orbits. Exit disperses/fades; clicking intensifies the burst then enters the existing destination using `arrival=direct`. No per-frame React state updates. Reduced motion has static emphasis; unavailable Canvas retains artwork, static SVG text and navigation. Original artwork elements themselves are not independently animated or physically simulated.

Desktop contains the original aspect ratio (letterboxing where needed). Portrait starts a native scrollable full-height panorama; the compact overview toggle fits the entire artwork. These are deliberate alternatives to stretching or permanently cropping the image. Embedded English artwork heading cannot translate without editing the image; controls and world names translate EN/ES. Native Three.js scenes and previous native-title work remain for destinations and explicit `?view=walk`; no admin/content/auth changes.

---

# Second-pass visual gap review and shared hub kit — 2026-10-28 UTC

Inspected both supplied reference images and the latest first-pass garden/hub screenshots before editing. The first pass improved the garden close-up, but identical cone islands, flat thin bridge ribbons, central guide-line clutter and a near-empty sky still made the whole scene read as a tabletop model. The reference combines irregular geological masses, substantial connected masonry, a legible compass terrace, rich architecture, strong directional light and overlapping atmospheric depth. Normal camera position/FOV and persisted world layout remain unchanged in this pass so visual gains are attributable to the environment, not a forced cinematic camera move.

## Implemented shared standards

- `hubEnvironment.ts`: reusable authored irregular island geometry with nine offset rock strata, overhangs, varied undersides, tiled UVs/vertex shading, uneven surface aprons and segmented coping. Replaces shared disc/cone base geometry for the central terrace, other five destination grounds and distant islands. HIDDEN WORLDS retains its existing custom cliff.
- Stone bridges now have full-depth decks, curbs, posts, cross-beams, brackets and restrained brass inlays/caps, using five instanced batches. Raised structures begin outside the central terrace; original walk paths still cross the terrace. Removed the old thin luminous guide tubes cluttering the center. Entrance bridge meets the terrace rim. Added segmented concentric stone bands and a compass rose.
- Existing local CC0 Mossy Rock maps supply stone/rock materials, with neutral placeholders, simplified-mode normal-map omission and disposal on scene teardown. No new external assets or downloads. Reused provenance remains in public/assets/hidden-worlds/ATTRIBUTION.md.
- Lower cool ambient light, an oblique warm key, ACES filmic mapping/exposure and approximate soft contact masks replace the uniformly bright model appearance. These contact masks are art-directed static approximations, not dynamic shadow-map/contact-occlusion simulation.
- Layered cloud banks, a procedural nebula sky and larger distant cliff silhouettes improve foreground/middle/background separation. Sky noise is baked into a small tileable DataTexture once; two texture samples replace per-pixel multi-octave sine evaluation. No postprocessing/bloom/SSR, true volumetrics or new dependencies. The render loop now renders on demand when motion is reduced (camera/resize/texture invalidation) and limits idle ambient draws to30Hz otherwise. Direct camera movement renders immediately. Automatic travel carries distance across path samples with a bounded wall-clock step, retaining the same path and no forced rotation.
- Garden now has smaller, denser canopy leaves, broken rear retaining walls, folded waterfall sheet geometry and less repetitive/contrasty pool ripples. Root/fern/arch detail and existing portal motion remain. No content, admin, route or data-model changes.

## Architectural gaps still requiring real passes

Shared foundations improved across the hub, but the five destination landmarks have NOT been superficially relabeled as finished architecture. WHAT IF needs a substantial branching arcade/door kit; HUMAN MIND needs a faceted crystal pavilion with internal memory detail; UNSOLVED needs authored buttressed/broken tower masonry; YOUR FUTURE needs tiered building facades and elevated connections; NEVER KNEW needs a vaulted library/shelving/artifact interior. Retain their stable IDs/navigation while applying this same silhouette/material/connection standard, one complete destination at a time.

Actual rendered normal-camera and garden screenshots: /tmp/beyond-second-pass-hub-1440.png and /tmp/beyond-second-pass-close-{375,768,1440}.png; sampled normal camera375/768 too. The sky and terrain are materially richer, yet still procedural/stylized; reference-level scanned detail, cinematic cloud rendering, advanced reflections and physical water remain absent. Do not infer physical-device performance from software-WebGL tests.

---
## Previous design records

# Hidden Worlds reference-quality prototype — 2026-10-28 UTC

Both supplied files were opened and inspected before code changes: `../img/01-reference.png` (target) and `../img/02-current.png` (existing). Neither is used as a runtime backdrop. This task upgrades only HIDDEN WORLDS and small shared render lifecycle support; it does not redesign the other five destinations.

| Area | Reference vs original current | Prototype response / remaining work |
|---|---|---|
| Composition | Target fills the frame with layered places; current has empty sky and a small model-like cluster | Keep hub/camera/navigation, establish a taller garden silhouette and a closer readable approach; full-hub framing is still unchanged |
| Six-world scale | Distinct large destinations vs small uniform discs | Preserve five destinations and stable DB IDs; one detailed garden prototype only |
| Architecture | Worn monumental stone arch, plants and concealed entrance vs green box/torus | Individually extruded arch voussoirs, chipped instanced masonry, stepped approach, terrace and roots |
| Depth | Foreground roots/books, middle landmarks, distant mist vs flat cones | Custom eroded cliff rings, rock buttresses, canopy/ferns, falling water and local mist layers |
| Materials/light | Rich rough surfaces, warm/cool contrast and shadows vs uniformly lit smooth geometry | CC0 color/normal/roughness maps, actual surface normals, darker foliage, teal opening and warm threshold lamps; no costly new realtime shadows, SSR or HDRI |
| Environmental detail | Dense coherent garden with waterfalls vs sparse round trees/flat water | Curved branch/root meshes, instanced compound leaves/ferns/vines, water/ripple/portal shaders, bounded particles and soft geometry light shafts |
| Navigation | Approachable locations and paths vs miniature spokes | Same connected paths, direct controls and raycasts; garden stops on a real walkway before the arch, no automatic camera spin |

Implementation: `src/worlds/hiddenWorlds.ts` owns one local environment, texture fallbacks and time uniforms; `hub.ts` integrates it at the persisted world origin, pauses decorative motion for reduced-motion and disposes resources. Existing first-frame readiness is now reported after a real render; controls wait for readiness. Neutral 1x1 map placeholders keep shader feature definitions stable while images load and provide valid base material on failure. Local geometry is immediately available; textures refine it progressively. No new dependencies or general scene-editor claim.

Assets: three unmodified 1K Mossy Rock JPEG maps from Poly Haven, Rob Tuytel, CC0, 2,901,083 bytes total. Provenance/download URLs/hashes and verified license links: `public/assets/hidden-worlds/ATTRIBUTION.md`. Runtime is same-origin, no CDN dependency. The public metadata API was unavailable; actual map links were obtained from the asset page and downloaded files validated. No external GLB/GLTF was imported: detailed arch/terrain/foliage geometry is custom-authored. A curated optimized scanned ruin/tree kit could further improve realism; no paid asset was used or assumed licensed.

Limits: no true volumetrics, physically simulated water, ray-traced/reflected scenery, scanned tree canopy or reference-level photorealism. Leaves and branch silhouettes remain procedural. Global sky, compass terrace and five other destinations retain the previous simpler treatment. The next step is to reuse the verified PBR/instancing/progressive-loading approach in one other destination, with license-reviewed close-up models and measured physical-device budgets before a full six-world art pass.

---
## Earlier design records

# Current integrated design addition

The landing composition and distributed Canvas/CSS motion are preserved. Its only CTA now leads to `/explore`. The six-destination reference informs a central compass terrace, golden connecting paths and distinct silhouettes across one procedural scene, not an image backdrop. WHAT IF arches / HUMAN MIND crystal sphere / UNSOLVED ruins / HIDDEN WORLDS garden-waterfall / YOUR FUTURE spires / NEVER KNEW library-orb use the existing navy/indigo/gold/teal palette.

Pointer drag never forces rotation; paths constrain walking; destination raycasts and accessible buttons offer deliberate travel. Mobile touch pad and reduced-motion immediate travel coexist with static WebGL fallback. Context hints remain compact; panels preserve world position. Text transitions are restrained and reduced-motion aware. Screenshots show stylized geometry, not reference-level photorealistic architecture.

Private admin is lazily routed and CSS-scoped `.admin-*`, with readable dark editorial workspace, small navigation, real tables/filters/page controls, explicit source and classification review, draft preview, version/conflict feedback and archive/restore. It does not alter the landing palette/layout. English admin UI; public EN/ES retained. New authored Spanish content is optional and falls back honestly to English. Six supported hub placements are editable; this is not a general scene editor.

Earlier design records below remain relevant except Archive-first/four-world-only restrictions superseded by this task.

---
# BEYOND design and interaction

## Palette and hierarchy

Cosmic Navy `#080D20`, Deep Indigo `#1A2444`, Starlight Gold `#E6C58B`, Signal Teal `#78D9CC`, Moonlight `#E9EDFA`, Nebula Gray `#9BA7C4`. Existing supporting text uses a lighter gray for readability.

The environment is the protagonist. Keep the BEYOND wordmark, concept descriptor, editorial headline, short supporting copy and one gold **ENTER THE UNKNOWN** CTA. Labels should be contextual rather than covering every destination. Avoid generic startup grids, dashboards, excessive neon, large explanatory copy and competing entry controls.

## Landing composition and motion

The existing local WebP is environmental art, not a complete screenshot UI. HTML provides the type, controls and state. `HeroScene.tsx` adds a capped 2D star/particle layer, independent cloud bands, floating silhouettes and illuminated portal layers. Calm pointer parallax affects depth layers without forcing camera rotation. Twinkles have varied multi-second periods; no rapid flashing. Ambient drift is deliberately slow but continuous.

The CTA's hover/focus/press affects portal illumination. Activation brightens the portal and zooms the environmental layer toward it. Typography fades out, then routing enters the real Three.js world. An independent 950ms timer handles completion; animation events, Canvas and WebGL are not prerequisites. Duplicate activation is locked synchronously. Back/forward cancels pending navigation; hiding the tab finishes entry; reducing motion finishes an active entry immediately.

## Exploration

Keep existing pointer-drag look, WASD/arrows, touch movement pad, clickable landmarks/portals, accessible destination buttons, meaningful connections, history and bookmarks. The four worlds remain stylized procedural geometry, not a photorealistic recreation of the reference. World picker controls are permitted only after entering; they are accessible equivalents to spatial portal navigation.

## Accessibility and performance

375/768/1440px layouts, keyboard-visible focus, native controls and focus-contained dialogs. Keep labels and sufficient touch areas. No essential meaning depends on animation or color alone. Mobile uses a recomposed portal location and fewer particles.

System reduced motion and an explicitly saved application preference produce a static landing without pointer parallax, ambient loops or cinematic zoom. Entry remains functional. The same preference continues to control exploration animation. A failed 2D context leaves CSS art and CTA; failed WebGL leaves all content accessible.

Canvas has at most 115 stars, 28 portal sparks and 36 foreground dust motes (52/12/18 simplified), capped pixel ratio, a throttled ~30fps loop and no per-frame React state updates. Cleanup cancels frames, disconnects ResizeObserver, removes listeners and clears properties. Three.js stays lazy-loaded; keep its existing disposal and stable camera controls. Do not add expensive effects or dependencies solely for decoration.

## Motion visibility diagnosis (2026-10-27)

Keep the app preference independent of the current OS preference: unsaved app state defaults false, OS state is live, and effective reduction is their OR. Never initialize saved app state from the initial OS state, which can latch a stopped scene after the OS setting changes. Explicit saved reduce must survive OS changes.

The background WebP is still static art, not an animated island model. Use meaningful contrast in bounded overlay stars, drifting cloud bands and gold/teal portal arcs/trails; verify the fully composited output over time. A running animation object or isolated Canvas pixel difference alone does not demonstrate visible motion against the artwork. Current tuning preserves the existing composition, particles limits, multisecond twinkles and accessibility overrides.

## Whole-screen motion distribution — 2026-10-28 (Asia/Rangoon)

Layer the existing static artwork with stratified stars, drifting dust in every screen third, counter-moving west/center/lower atmospheric bands and small vector island silhouettes at multiple depths. Keep the portal as a focal invitation without making it the only animated area. Choose distinct durations, phases, directions and parallax factors. Dim foreground motes across the central text zone. Simplified mode keeps bounded counts and fewer cloud layers; Canvas-unavailable mode is static. No additional WebGL or dependencies are needed for the landing.

Assess actual composed frames in a 3x3 grid at 375/768/1440px, alongside subjective readability and an uninterrupted video. A large changed-pixel percentage does not establish aesthetic quality; a small region with zero motion may indicate uneven coverage. Do not move the typography or restore competing entry controls to manufacture motion.


## 2026-10-30 — Preview world image partial edits

Added Preview-only location selection/zoom, normalized coordinate and published-character context forwarding, visual analysis, 512px neighborhood mask inpainting, full-resolution outside-mask pixel preservation, immutable private original/candidate versions, explicit approval and version conflict checks. Existing admin authentication/CSRF and AI budgets remain authoritative. Original personal-world/character graph records are preserved; containing worlds remain browser-local, while successful edit versions use Preview D1/Tigris.

Actual house generation is NOT verified: deployed workers.dev navigation failed with TLS reset/timeout; local workerd using the real remote AI binding returned HTTP502 after a TLS reset. No generated house, real approval or real generated-house reload is claimed. Local selection/zoom screenshots are real; provider-fixture persistence tests are labelled as such. Build and unit36/36, Cloudflare23/23, selected existing browser6+2 and new fixture browser1 pass. Discovery test expectations were corrected for the existing error wording and asynchronous reply setup.

See [WORLD_EDIT_VERIFICATION.md](cloudflare/WORLD_EDIT_VERIFICATION.md) for exact models, files, limits, evidence, final remote preservation audit and remaining test. No Production Worker/D1 changes, commit/push/reset or original artwork edits. Branch main, HEAD f4585907ecb8158eafd61cc769c4c31e94d102c0. Extensive existing uncommitted work remains. Resume by inspecting final-audit.json and repeating ONE bounded actual request once Preview/AI transport recovers; do not reset quotas, accept model licenses automatically, or deploy production.


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
