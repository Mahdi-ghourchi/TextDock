# TextDock release audit

**Audit date:** 2026-10-25  
**Scope:** The files present in this folder-backed workspace and the summarized assignment. The supplied 1,017-line attachment was not present in the workspace, so this report does not claim to have inspected it.

## Baseline and evidence

- The folder has no `.git` directory. `git status` and `git log` therefore cannot establish whether the folder is clean or reveal prior changes/history. No changes were reverted. Do not interpret this audit as a Git hygiene or commit-history review.
- `.dockerignore` excludes `.env`, `.git`, and local dependency/build artifacts from the Docker build context.
- No project-specific `.env` file was present in the inspected file inventory. `.env.example` and the Compose fallback contain `textdock-local-dev`, explicitly a local-only development password. No production credential was found in the reviewed source/config/docs. Without Git history, a history-wide secret scan was not possible.
- `package-lock.json` is present. Frontend dependencies are exact-version entries; backend requirements are pinned, but there is no Python lockfile. No `LICENSE` file was present; this audit does not add one.
- Final verification updated the vulnerable frontend build/test tools to `vite@6.4.4` and `vitest@4.1.12` using npm, updating `package.json` and `package-lock.json`. `npm ci` completed and `npm audit --audit-level=moderate` reports zero known frontend advisories. CI itself does not run `npm audit`.
- Initial frontend baseline: `npm test` passed (14 tests); `npm run build` passed (TypeScript project build plus Vite production build).
- Initial backend baseline: from `backend`, `python -m pytest -q` passed (11 tests), and `DATABASE_URL=sqlite:///./baseline-check.db python -m alembic upgrade head` reached revision `0001_create_shares`. An earlier attempt from the repository root failed to locate `app`/`alembic.ini`; that was a working-directory mistake, not a code failure.
- After the changes listed below, frontend tests pass (19 tests), the frontend build passes, backend tests still pass (11 tests), and the SQLite migration still reaches head. A real-browser smoke confirmed document creation, typing/autosave status, and preview rendering; the exact temporary document was removed afterward.
- `npm run build` performs TypeScript checking, but no frontend lint command/configuration is present. No backend linter or formatter is configured in the inspected package/CI files. CI runs frontend tests/build and API tests/migration only.
- Docker is not installed in this environment. The Compose stack, container health checks, and image builds were not run. PostgreSQL integration, broader browser end-to-end flows, browser storage quota/eviction, screen-reader behavior, and deployed TLS/proxy behavior remain unverified. A limited browser smoke did cover local document creation, typing/autosave status, and preview rendering.

## Implementation status

| Area | Status and evidence |
| --- | --- |
| CRUD | Create, rename, edit, duplicate, and delete are implemented against IndexedDB. Autosave, duplicate titles, save-before-switch, and failed-save switching have UI tests; delete requires confirmation. Deletion is permanent. |
| Persistence | Dexie/IndexedDB is the source of truth for documents. Debounced saves expose saving/saved/error states, and a failed save prevents switching away. Browser quota, eviction, profile loss, and device transfer are outside the app's control; there is no export-all/restore workflow. Theme preference is optional `localStorage`; startup now falls back to light appearance if that storage throws. There is no service worker, so offline first-load/reload is not guaranteed. |
| Markdown | `react-markdown` and GFM render into React elements; raw HTML is not enabled, `rehype-sanitize` is applied, and unsafe URL schemes are rejected. New regression coverage verifies remote images are not loaded automatically; their alt text is shown instead. CommonMark/GFM feature behavior beyond current tests was not exhaustively tested. |
| Import/export | `.md`, `.markdown`, and `.txt` imports are accepted up to 5 MiB; exports create UTF-8 text downloads with sanitized filenames. Documents use generated IDs, so equal filenames/titles do not overwrite one another. Export is one document at a time; there is no library backup/import format. Invalid/legacy encodings, very large editor content, and filename behavior across every OS were not browser-tested. |
| Search/navigation | Search filters titles and content case-insensitively; results are ordered by edit time. Navigation, empty states, and selected-document semantics are present. The list is not virtualized; no large-library performance benchmark exists. |
| Sharing | The optional API creates immutable snapshots, returns separate random read/revoke capabilities once, stores only SHA-256 hashes, supports 24-hour/7-day/30-day expiry and authorized revocation, and erases content on revocation or authenticated expiry. The browser keeps the capabilities only in the current dialog state. After closing/reloading, there is no share-management/revocation recovery flow. API request creation/read rate limits are not implemented and must be supplied before public exposure. Share error visibility was corrected and is covered by a UI regression test. |
| Accessibility | Native controls, labels, live status, modal semantics, keyboard focus trapping/restoration, visible global focus styling, and reduced-motion CSS exist. The title and editor textarea previously suppressed focus outlines; visible outlines are now restored. Automated accessibility auditing, keyboard-only browser testing, zoom testing, contrast measurement, and assistive-technology checks were not run. |
| Security | Snapshot access uses bearer capabilities, a separate revocation capability, constant-time comparisons, no-store headers for snapshot reads/creation, bounded share bodies, exact CORS origins, and Markdown sanitization. Markdown image fetches are now suppressed to avoid implicit remote requests. The default Compose password is development-only. There is no application-level rate limiting, production TLS/HSTS, managed-secret configuration, monitoring, or backup policy; deployment guidance calls these out. |
| Docker/CI | Compose provides PostgreSQL, API migration/startup, nginx, service health checks, and a persistent DB volume. CI uses Node 22 and Python 3.12 and runs tests/build/migration. Docker execution was unavailable here; PostgreSQL-specific behavior has not been verified. CI action references use major-version tags rather than immutable SHAs. |
| Documentation | README, architecture, API, security, deployment, product, and design notes were reviewed. README now names the maintainer, links the audit/benchmark, and accurately describes image-preview behavior. Security/deployment docs now explicitly gate public API exposure on rate limiting. No public deployment URL or unsupported badge/screenshot was added. |

## Ranked findings

| Rank | Severity | Finding | Status / action |
| --- | --- | --- | --- |
| 1 | High — release blocker | The share API has no rate limit or creation quota. Anyone able to reach it can consume request/DB resources. | Not patched with an in-process limiter because it would not be reliable across replicas or behind untrusted proxy headers. Put a trusted edge/API limit in front before public exposure; documentation now says this explicitly. |
| 2 | High — data-retention risk | Local documents have no all-library backup/restore path. Browser profile deletion, storage eviction, or device loss can permanently lose documents. | This is a product boundary, not a hidden persistence guarantee. README already warns that browser storage is not a backup; the audit calls out the missing workflow. Consider a validated export/restore design before positioning this as durable storage. |
| 3 | Medium | LocalStorage access for the theme preference could throw during app initialization and prevent the editor from rendering. | Fixed: theme now falls back to light when storage access is unavailable. Regression-tested. |
| 4 | Medium | Remote Markdown image syntax could trigger an automatic third-party fetch in local preview, exposing a viewer's network address or visit to the image host. | Fixed: previews render image alt text rather than loading image URLs. Regression-tested; README/security docs explain this constraint. |
| 5 | Medium | Share copy/revoke failures were not rendered in the already-created-share view, making failures look like non-responses. | Fixed: errors and success notices now appear inside the dialog. Revocation failure is regression-tested. |
| 6 | Low | Title and editor fields overrode the global visible focus rule. | Fixed: both fields now show a visible focus outline. Needs real-browser keyboard/accessibility verification. |
| 7 | Low | No configured lint workflow, browser E2E suite, PostgreSQL integration suite, or Docker validation is present/available. | No tooling was added solely for this audit. Add these as separate release-hardening work; current CI checks and environment limitations are recorded above. |

No confirmed P0 vulnerability or data-corruption defect was found in the inspected code. Public deployment is still not release-ready until the high-severity operational/data-retention items are addressed or explicitly accepted.

## Release commands

From the project root:

```powershell
npm ci
npm test
npm run build
```

From `backend`:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
$env:DATABASE_URL = "sqlite:///./textdock-check.db"
python -m alembic upgrade head
python -m alembic current
```

Before release, additionally run the Compose stack on a Docker-enabled host, test against the intended PostgreSQL version, apply a trusted public rate limit, configure TLS/secrets/backups, and perform real-browser accessibility and storage-failure checks.
