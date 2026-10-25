# TextDock

TextDock is a local-first Markdown and plain-text editor. Documents live in the browser's IndexedDB and remain available without an account or a running API. Sharing is an explicit, separate action that creates a read-only snapshot through the optional API.

Maintained by [Mahdi Ghourchi](https://github.com/Mahdi-ghourchi).

## Run the editor

Requires Node.js 22 or newer and npm.

```powershell
npm ci
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Local editing, document management, search, Markdown preview, theme selection, and TXT/MD import/export work without the API. Do not clear site data if you want to keep this browser's local library; browser storage is not a backup.

Once the app's files are loaded, editing does not need the sharing API. TextDock does not currently register a service worker, so offline first-load or reload is not guaranteed.

## Run the sharing API locally

Requires Python 3.12 or newer. The API can use SQLite for development; deployments should use PostgreSQL.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:DATABASE_URL = "sqlite:///./textdock-dev.db"
$env:CORS_ORIGINS = "http://localhost:5173"
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --no-access-log
```

Run Vite in a second terminal from the project root. Its `/api` proxy forwards share requests to `localhost:8000`. Share links work when the API is running; if it is unavailable, local editing continues and the share dialog reports the API error.

Interactive API docs are at `http://localhost:8000/api/docs`. Liveness and database readiness are reported separately at `/health/live` and `/health/ready`.

## Run with Docker Compose

Install Docker Engine/Desktop with the Compose plugin, then:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open `http://localhost:8080`. Compose runs PostgreSQL, applies Alembic migrations before starting the API, and serves the built SPA through nginx. The PostgreSQL volume survives container restarts. The checked-in password is for local development only; set a unique high-entropy `POSTGRES_PASSWORD` and the public `CORS_ORIGINS` before deployment. The API URL password must be URL-encoded if it contains reserved characters.

Stop the stack with `docker compose down`. This preserves database data; `docker compose down -v` removes it and permanently deletes all shared snapshots.

## Features

- IndexedDB library with create, delete, duplicate, full-text title/content search, and explicit save status.
- Debounced local autosave; `Ctrl+S` / `⌘S` saves immediately.
- Markdown editing and safe preview (raw HTML is disabled, output is sanitized, unsafe URL schemes are blocked, and Markdown images are shown as alt text rather than fetched automatically).
- Import/export `.md`, `.markdown`, and `.txt` documents, with a 5 MiB import limit.
- Light/dark appearance and keyboard-operable controls.
- Explicit snapshot creation, 24-hour/7-day/30-day expiry, read-only share view, and a separate revocation capability.
- Snapshot API with PostgreSQL persistence, schema migrations, health checks, a 1 MB content limit, and a bounded request body.

## Checks

```powershell
npm test
npm run build
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q
$env:DATABASE_URL = "sqlite:///./textdock-check.db"
python -m alembic upgrade head
```

Tests use SQLite and do not require PostgreSQL. Docker Compose deployment could not be exercised on the implementation machine because Docker is not installed.

## Documentation

- [Architecture and decisions](docs/ARCHITECTURE.md)
- [Versioned API](docs/API.md)
- [Security and privacy](docs/SECURITY.md)
- [Testing and deployment](docs/DEPLOYMENT.md)
- [Release audit](docs/audit-report.md)
- [Documentation benchmark](docs/documentation-benchmark.md)
- [Product record](PRODUCT.md)
- [Design system](DESIGN.md)

## Current boundaries

There are no accounts, cross-device sync, collaboration, version history, or local-backup workflow. Shares are bearer-link capabilities, not identity-bound permissions; copy the link before closing the share dialog because the app does not retain it or its revocation capability. A snapshot's content is deleted when it is revoked or when it is requested after expiry; a maintenance command purges old expired/revoked records after 30 days and must be scheduled by the operator. Production hosting, TLS termination, rate limiting, monitoring, and a real public origin remain operator responsibilities.
