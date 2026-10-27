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
