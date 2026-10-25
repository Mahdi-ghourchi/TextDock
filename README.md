# TextDock

> **Local-first Markdown & Plain-Text Editor**
>
> Write locally. Keep control of your documents. Share only when you choose.

TextDock is a local-first Markdown and plain-text editor. Documents live in the browser's IndexedDB and remain available without an account or a running API. Sharing is an explicit, separate action that creates a read-only snapshot through the optional API.

**Maintained by:** [Mahdi Ghourchi](https://github.com/Mahdi-ghourchi)

---

## Table of Contents

- [Run the Editor](#run-the-editor)
- [Run the Sharing API Locally](#run-the-sharing-api-locally)
- [Run with Docker Compose](#run-with-docker-compose)
- [Features](#features)
- [Checks](#checks)
- [Documentation](#documentation)
- [Current Boundaries](#current-boundaries)

---

## Run the Editor

**Requirements:** Node.js 22 or newer and npm.

### 1. Install dependencies and start the development server

```powershell
npm ci
npm run dev
```

### 2. Open the editor

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

The following capabilities work without the API:

- Local editing and document management
- Search and Markdown preview
- Theme selection
- TXT/MD import and export

> [!IMPORTANT]
> Do not clear site data if you want to keep this browser's local library; browser storage is not a backup.

> [!NOTE]
> Once the app's files are loaded, editing does not need the sharing API. TextDock does not currently register a service worker, so offline first-load or reload is not guaranteed.

---

## Run the Sharing API Locally

**Requirements:** Python 3.12 or newer.

The API can use SQLite for development; deployments should use PostgreSQL.

### 1. Create and activate a virtual environment

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

### 2. Configure the development environment

```powershell
$env:DATABASE_URL = "sqlite:///./textdock-dev.db"
$env:CORS_ORIGINS = "http://localhost:5173"
```

### 3. Apply migrations and start the API

```powershell
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --no-access-log
```

### 4. Start the frontend

Run Vite in a second terminal from the project root. Its `/api` proxy forwards share requests to `localhost:8000`.

**Sharing behavior**

- Share links work when the API is running.
- If the API is unavailable, local editing continues and the share dialog reports the API error.

**API endpoints**

| Endpoint | Purpose |
|---|---|
| `http://localhost:8000/api/docs` | Interactive API documentation |
| `/health/live` | Liveness status |
| `/health/ready` | Database readiness |

---

## Run with Docker Compose

**Requirements:** Docker Engine/Desktop with the Compose plugin.

### 1. Configure the environment

```powershell
Copy-Item .env.example .env
```

### 2. Build and start the application

```powershell
docker compose up --build
```

### 3. Open TextDock

Access the application at:

**`http://localhost:8080`**

### What Compose runs

- PostgreSQL
- Alembic migrations before starting the API
- The built SPA served through nginx

The PostgreSQL volume survives container restarts.

> [!WARNING]
> The checked-in password is for local development only; set a unique high-entropy `POSTGRES_PASSWORD` and the public `CORS_ORIGINS` before deployment.

The API URL password must be URL-encoded if it contains reserved characters.

### Stop the stack

```powershell
docker compose down
```

This preserves database data.

> [!CAUTION]
> `docker compose down -v` removes the database volume and permanently deletes all shared snapshots.

---

## Features

### Local-first editing

- [x] IndexedDB library with create, delete, duplicate, full-text title/content search, and explicit save status.
- [x] Debounced local autosave; `Ctrl+S` / `⌘S` saves immediately.
- [x] Markdown editing and safe preview (raw HTML is disabled, output is sanitized, unsafe URL schemes are blocked, and Markdown images are shown as alt text rather than fetched automatically).
- [x] Import/export `.md`, `.markdown`, and `.txt` documents, with a 5 MiB import limit.
- [x] Light/dark appearance and keyboard-operable controls.

### Sharing and snapshots

- [x] Explicit snapshot creation, 24-hour/7-day/30-day expiry, read-only share view, and a separate revocation capability.
- [x] Snapshot API with PostgreSQL persistence, schema migrations, health checks, a 1 MB content limit, and a bounded request body.

---

## Checks

Run the frontend checks from the project root.

### Frontend

```powershell
npm test
npm run build
```

### Backend

```powershell
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q
$env:DATABASE_URL = "sqlite:///./textdock-check.db"
python -m alembic upgrade head
```

> [!NOTE]
> Tests use SQLite and do not require PostgreSQL. Docker Compose deployment could not be exercised on the implementation machine because Docker is not installed.

---

## Documentation

| Document | Description |
|---|---|
| [Architecture and decisions](docs/ARCHITECTURE.md) | Architecture and design decisions |
| [Versioned API](docs/API.md) | API documentation |
| [Security and privacy](docs/SECURITY.md) | Security and privacy considerations |
| [Testing and deployment](docs/DEPLOYMENT.md) | Testing and deployment guidance |
| [Release audit](docs/audit-report.md) | Release audit |
| [Documentation benchmark](docs/documentation-benchmark.md) | Documentation benchmark |
| [Product record](PRODUCT.md) | Product record |
| [Design system](DESIGN.md) | Design system |

---

## Current Boundaries

### Product limitations

- No accounts, cross-device sync, collaboration, version history, or local-backup workflow.
- Shares are bearer-link capabilities, not identity-bound permissions.
- Copy the link before closing the share dialog because the app does not retain it or its revocation capability.

### Snapshot lifecycle

A snapshot's content is deleted when it is revoked or when it is requested after expiry.

A maintenance command purges old expired/revoked records after 30 days and must be scheduled by the operator.

### Production responsibilities

The following remain operator responsibilities:

- Production hosting
- TLS termination
- Rate limiting
- Monitoring
- A real public origin

---

<sub>TextDock · Local-first Markdown and plain-text editing</sub>
