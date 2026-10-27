# BEYOND — The Internet Within the Internet

A public discovery universe and private editorial workspace in one React/TypeScript/Vite/Three.js project. Node and SQLite provide real shared persistence; no paid service or visitor account is required. The neighboring Jalisco/NopaHua project is not used.

Read [AGENTS.md](AGENTS.md), [STATUS.md](STATUS.md), [NEXT_SESSION.md](NEXT_SESSION.md), [DESIGN.md](DESIGN.md), [DECISIONS.md](DECISIONS.md) and [VERIFICATION.md](VERIFICATION.md) for current decisions and evidence. Older entries are explicitly historical.

## Local setup

Requires **Node 22.23+** (tested 22.23.2) with `node:sqlite`, currently experimental in Node 22, and npm. Use the lockfile on a fresh checkout:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Vite dev and preview mount the same local API. On first API access SQLite creates schema/seed version 1 and six-world migration version 2 idempotently. Default storage is `.local/beyond.sqlite` (ignored), with restrictive directory/file permissions. Back up the database and its WAL consistently before future migrations. Never commit local DBs, credentials or `.env`.

Create the first editor manually in a separate terminal:

```sh
npm run admin:setup -- your-email@example.com
```

Enter a unique password at the hidden terminal prompt (minimum 12 characters). No default credential or public admin signup exists. The command refuses to create another initial admin once one exists. It does not print the password. Visit `/admin/login`; protected `/admin` redirects there when unauthenticated. Password changes require the current password and revoke existing sessions. There is no email reset/multi-admin invitation implementation yet. No real operator account was created by this task.

Optional `.env` configuration is described by `.env.example`: `BEYOND_DB_PATH` selects persistent storage, `APP_ORIGIN` selects the exact allowed origin. Neither uses a `VITE_` client prefix. With no explicit origin, development accepts the current localhost/127.0.0.1 port. Restart after changing environment configuration. A different database path starts a distinct store; configure the same path for setup and serving.

## Build and serve

```sh
npm run typecheck
npm test
npm run test:server
npm run build
npm run preview
```

`npm start` serves `dist` and APIs through the Node server on loopback port 4173. For a future production host, place it behind a TLS reverse proxy, supply a persistent backed-up volume and set the exact HTTPS origin:

```sh
NODE_ENV=production APP_ORIGIN=https://your-real-domain.example PORT=4173 npm start
```

This is an illustrative operator command, **not a deployment performed by this task**. Production uses Secure `__Host-` cookies; HTTPS is mandatory. The old `.openai/hosting.json` static Sites manifest is preserved but cannot host this new SQLite backend on its own. No hosting/authentication settings were changed or deployment performed.

## Public exploration

The animated landing retains one **ENTER THE UNKNOWN** action, now entering `/explore`. The second screen is one continuous procedural Three.js scene: six persisted destinations around a compass terrace with actual connecting walkways. Golden branching arches, a crystal sphere, moonlit ruins, a garden/waterfall, a luminous future city and a library/orb interpret the reference composition. This is **stylized procedural geometry, not a photorealistic replica or a flattened reference image**.

WASD/arrows and touch controls move; drag looks; clicking/tapping destinations or keyboard-accessible destination buttons moves along paths. Manual movement interrupts automatic travel without forced rotation. Near a destination, contextual hints and a discovery list appear. Published discovery markers use local coordinates and open the same content panel as the accessible list. Closing a panel preserves the scene/camera position. Reduced motion removes ambient movement and uses immediate deliberate destination changes. WebGL failure leaves accessible destination/content controls.

The original four worlds, eight discoveries, direct world/discovery routes, portals, bookmarks, history, sharing and EN/ES remain. Only six `hubKey` destinations inhabit the new hub; legacy worlds remain separate accessible routes. Personal collections remain browser-local `beyond:v1:*` data. Public/admin content comes from `/api/public/universe` and the same SQLite records; no disconnected admin array or silent bundled fallback is used. Focus refresh updates content after edits; world switching does not refetch per click.

## Editorial model and security

Worlds support stable IDs, slug aliases, publication states, theme/color/order and bounded hub placement for the six supported scene motifs. This is not a general 3D scene editor. Discoveries support EN/optional ES content, structured paragraphs, evidence/interpretation/questions, described HTTPS sources, source review, factual/hypothesis/fictional classification, uncertainty, publication states, coordinates and revisions. Hub discoveries use local X/Z ±4 and Y 0–6; the visible marker is elevated above the island surface. The scene caps markers at 24 per destination; the accessible list still exposes all eligible records.

Only authorized editorial actions can verify. New factual publication requires verification and sources; hypothetical/fictional content requires explicit hypothetical status and uncertainty. Rejected/draft/archived content is excluded publicly. The eight originally public discoveries remain visible **labelled Requires review**, not falsely verified; changing their claims/sources or unpublishing removes this grandfathered visibility. Six new hub destinations contain no fabricated published discoveries, so initially show honest empty states. Initial admin totals are 11 worlds (6 hub + 4 legacy + 1 draft Signal) and 9 discoveries (8 legacy published + 1 editorial draft); public totals are 10 worlds/8 discoveries. Counts change with real edits.

Relationships reference real stable IDs, reject duplicates/self-links, preserve editorial explanation and revisions. Archive/unpublish substitutes for destructive content deletion. Slug aliases preserve old links. Optimistic versions reject concurrent stale updates. Lists search/filter/paginate by 10.

Passwords use native scrypt; sessions are random, server-stored as hashes, expire after 8 hours, and use HttpOnly/SameSite Strict cookies. All admin endpoints recheck authorization. Mutations require exact origin, JSON and a session CSRF token. Login has persisted account/IP rate limits. Body limits, safe URLs and escaped text are enforced. No AI question engine, biometric authentication, external identity provider or fake verification is implemented.

## Browser verification

```sh
npm run test:browser
```

Use an installed Playwright Chromium. This particular host requires:

```sh
LD_LIBRARY_PATH=/tmp/jalisco-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run test:browser
```

Server/admin tests create disposable databases and generated fixture credentials, never real accounts. See VERIFICATION.md for actual results, screenshot evidence and limitations. Physical devices, the user's Google Chrome profile, production TLS proxy and live deployment are not verified by these local tests.

## Git delivery

Intended existing repository: https://github.com/itachi486/beyond. Local branch is `main`; no remote configuration was changed. Remote read succeeded with an empty ref list and the public repository displayed Quick setup during this task. Delivery must use a normal push to that verified URL, rechecking refs first; never force. Final commit/push evidence is reported only after successful commands. A GitHub push is not a deployment.
