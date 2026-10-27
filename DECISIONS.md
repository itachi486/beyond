# Latest decisions — integrated admin + six-world brief

- User explicitly authorized private admin/backend and Git commit/push; earlier animation-only restrictions are historical. Deployment remains unauthorized.
- Keep existing React/Vite/Three dependencies; add Node built-ins SQLite/crypto/HTTP, no new packages or external auth provider. Visitors remain account-free; editors have manually bootstrapped private accounts.
- One landing CTA enters `/explore` and the new continuous six-world hub. Four existing worlds/routes/8discovery content/collections remain accessible, not replaced or renamed.
- Six stable hub records migrate idempotently (schema v2); original v1 seed retained and draft Signal preserved. No fabricated published hub discoveries. Empty destinations tell the truth.
- Admin/public share persisted records, server-side eligibility and stable IDs. New factual claims require explicit authorized verification and sources. Legacy original public claims remain visible with Requires review until edited/unpublished, without inventing verification.
- Archive/unpublish instead of destructive content deletion; retain slug aliases, revisions and optimistic versions. Connections validate real IDs and explanation. Hub discovery positions affect actual markers; bounded 24 per destination, accessible list covers all.
- No default credentials, public editor registration, AI generator, deployment or remote settings changes. Normal push only after tests/security/remote review; intended existing repository itachi486/beyond became public and empty during this task.

Historical decisions follow; later explicit user scope wins on conflicts.

---
# Decision history

## 2026-10-27 — Initial implementation (historical evidence)

- React/TypeScript/Vite with direct Three.js; local content and localStorage, no paid service or mandatory account. Baseline source commit: `489281882435ab2358dafcc90ab0ef0e62adb807`.
- Four worlds, eight sourced discoveries; English/Spanish complete, five other languages honestly marked upcoming.
- A separate owner-private Sites publication exists historically. It is not proof of a GitHub push.

## 2026-10-27 — Landing, continuity and Git workflow

**User decisions:**

- One primary landing CTA: ENTER THE UNKNOWN. Remove all pre-entry world selection and competing destination entry controls.
- Enter the existing first world (The Archive), keeping all worlds, discoveries and navigation intact.
- Animation should create wonder without obstructing interaction or forcing camera rotation.
- Persistent project memory, verification records and an actionable handoff are mandatory. Git supports reviewable history and recovery; claims require actual evidence.
- Intended ongoing GitHub repository is `itachi486/beyond`. Preserve remote/branch/auth/visibility settings; never overwrite remote work.

**Implementation:** HeroScene ambient layers, reliable entry hook and landing-only UI restrictions. Verification outcomes are recorded separately in VERIFICATION.md and STATUS.md, not implied by these decisions.

**Unresolved Git fact:** the local branch is `main`, no Git remote is configured, and an authenticated/environment Git HTTPS lookup of the requested URL returned `Repository not found`. Missing repository and insufficient access are not distinguishable from that response. No commit or push is authorized to an alternative destination by this failure.

## 2026-10-27 — Local animation follow-up

The user identified localhost:5173 in Google Chrome and explicitly authorized minimal fixes after diagnosis. Live OS preference and persisted app preference must remain independent; do not automatically turn initial OS reduce into sticky application state. Motion remains disabled when either explicit app reduce or current system reduce is enabled.

Rendered-video/pixel evidence is required alongside automated tests when judging animation visibility. Improve overlay contrast rather than replacing the established layout or claiming that the raster backdrop is a fully animated world. Actual Chrome profile state is unknown; report the reproduced bug separately from the user's unverified exact trigger. No commit/push/deploy for this task.

## 2026-10-28 (Asia/Rangoon) — Whole-screen landing motion only

Distribute ambient motion through all screen thirds and depths while preserving a calm text zone and existing palette. Reuse Canvas/CSS, capped particles and cleanup; retain the portal without concentrating all moving effects around it. Validate nine composed regions rather than only a Canvas or the portal. No admin/back-end plan, world/content/collection behavior, dependency, GitHub or deployment work belongs to this scope. Runtime results are recorded separately in VERIFICATION.md.
