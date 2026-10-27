# BEYOND operating instructions

Read this file first. Then read `VISION.md`, `DESIGN.md`, `DECISIONS.md`, `STATUS.md`, `DISCUSSION_LOG.md` and `NEXT_SESSION.md`, when present. Also consult README and verification evidence for the affected feature.

- Repository documentation and actual implementation are the primary project-specific sources of truth. Long-term/model memory is supplementary.
- Inspect the implementation, Git branch, remotes, status and user changes before editing. Preserve valid existing decisions and functionality unless the current user task explicitly changes them.
- Keep changes small, reviewable and recoverable. Protect uncommitted work. Never reset, clean, force-checkout, discard user work or force-push without explicit authorization.
- Never expose or commit credentials, tokens, private keys, OAuth secrets, `.env` values or other sensitive files. Report paths/risk categories, not secret values.
- Distinguish code presence/review from verified runtime behavior. Never invent test counts, deployment status or push success. Label facts, assumptions, proposals and unresolved questions.
- The landing has one entry action: ENTER THE UNKNOWN. Do not restore a world picker, destination chooser, bookmark navigation or competing entry CTA before entry. ENTER THE UNKNOWN now reaches the six-destination `/explore` hub (latest integrated brief). Keep the original four worlds, content, direct routes and exploration portals alongside it.
- Preserve accessibility, reduced motion, WebGL/Canvas fallback, cleanup and local persistence. Do not introduce dependencies or reinstall/upgrade them without task authorization.
- Intended GitHub repository: https://github.com/itachi486/beyond . Verify actual access, remote identity, branch and ancestry before any commit/push. Do not change remotes, branches, visibility, permissions or authentication without authorization. A missing/inaccessible remote is not permission to push somewhere else.
- The existing `.openai/hosting.json` identifies a separate Sites host. Its historical source commit does not establish GitHub synchronization. Do not silently substitute Sites publication for a requested GitHub push.
- After meaningful work update project documents, verification records and NEXT_SESSION.md. Record actual changed files, branch/status, checks, evidence, limitations and next actions.
- Before ending ensure another agent can resume from repository documents alone. Update the handoff even when authentication, remote history or an environment limitation blocks delivery.

## Integrated persistence rules

- Admin and public content share Node/SQLite; never restore disconnected hardcoded runtime content or bypass server authorization/CSRF/eligibility. See README for bootstrap and environments.
- Do not invent credentials, verification, factual discoveries, performance results or AI generation. Preserve original public content with clear review status and preserve IDs/aliases/revisions.
- Schema migrations must be idempotent and non-destructive; test writes only in disposable fixture databases. Never commit `.local`, `.env`, SQLite, tokens or generated credentials.
- Latest user authorization includes a reviewed commit and normal push to the existing intended GitHub repository, but no deployment or remote/auth settings change. Historical task-only restrictions do not replace latest authorization.
