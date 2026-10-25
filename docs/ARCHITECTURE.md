# Architecture and decisions

## Runtime boundaries

```text
Browser
  React + TypeScript + Vite
  ├─ IndexedDB (Dexie): private documents and settings-local UI state
  └─ Explicit share request ──> FastAPI /api/v1 (only when sharing or viewing)
                                  └─ SQLAlchemy ──> PostgreSQL
```

The editor never waits for the service to load or save personal documents. The backend is not a synchronization endpoint: it receives a copy only after a user chooses to create a share. Read links return that immutable snapshot, not the current document.

## Frontend

- React 18 function components with strict TypeScript and Vite.
- Dexie manages a versioned IndexedDB database. A document record contains a stable UUID, title, content, format, and creation/edit timestamps.
- Autosave is debounced and surfaces `Saving`, `Saved`, and failure states. `Ctrl+S` / `⌘S` forces a save.
- React Markdown with GFM parses Markdown; raw HTML parsing is never enabled, `rehype-sanitize` removes unsafe generated nodes, and React Markdown's URL transform blocks dangerous URL schemes.
- Share-link tokens are carried in the URL fragment, which browsers do not send in HTTP requests or referrers. The shared-document route removes the fragment from browser history before sending the token in an Authorization header.
- Vite proxies `/api` and `/health` to the local API during development. Production nginx serves the SPA and proxies API requests on the same origin.

## API and storage

- FastAPI exposes versioned JSON routes in `backend/app/routes/shares.py`.
- Pydantic validates title, format, expiry choices, Unicode content size, and share request limits.
- Each share gets a random public identifier plus independent 256-bit read and revocation capabilities. The database stores SHA-256 digests of both capabilities; comparisons are constant-time. Because capabilities have high entropy, this resists offline guessing without storing a server-side pepper.
- SQLAlchemy 2.x maps snapshots to PostgreSQL. Alembic owns schema evolution. SQLite is supported for development/tests only.
- Revocation uses a distinct `X-Revoke-Capability`; there is deliberately no fabricated owner identity. Revocation erases title and content and leaves a tombstone until retention cleanup.
- Health checks separate process liveness from database readiness. The API does not log share-token headers; the packaged Uvicorn command disables access logs.

## Decisions and tradeoffs

| Decision | Why | Cost / boundary |
| --- | --- | --- |
| IndexedDB rather than a server account | Editing is local and does not depend on an identity or sharing service once the app is loaded | Data belongs to one browser profile; clearing browser storage loses it. No service worker guarantees offline first-load or reload |
| Explicit snapshots, not live document URLs | A share cannot silently reveal later edits | Updates require creating a new share |
| No accounts | Matches the no-account product and avoids false ownership | Anyone with a link can read until expiry or revocation |
| Separate revoke secret | The public read link alone cannot revoke itself | The current UI keeps link and revocation capability only in the open share dialog; copy before dismissing |
| Hash bearer capabilities at rest | A database read does not directly reveal usable capabilities | A lost read token cannot be recovered from the server |
| Local CSS/system font stacks | Avoid third-party network requests and preserve offline rendering | Typography follows platform fonts |
| PostgreSQL in production, SQLite for tests | PostgreSQL is the deployment database; SQLite gives fast deterministic test setup | SQLite tests are not a substitute for PostgreSQL integration tests |
| Expiry choices are fixed | Makes duration reviewable and avoids arbitrary retention requests | Custom expiry intervals are not supported |

## Product limits

Import files are limited to 5 MiB. Shared UTF-8 content and titles are limited to 1,000,000 bytes and 160 characters respectively; the request body is capped at 6.1 MB to allow for JSON escaping of valid content. Share durations are 24 hours, 7 days, or 30 days. The frontend library is limited by available browser storage and currently has no export-all/backup function.
