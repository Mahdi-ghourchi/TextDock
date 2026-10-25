# Testing and deployment

## Local checks

From the repository root:

```powershell
npm ci
npm test
npm run build
```

The frontend tests cover Dexie document CRUD against `fake-indexeddb`, file-format parsing, Markdown safety, editor autosave and switching, appearance switching, import, share/revoke UI, and preview behavior. They do not replace testing on a real browser's quota, eviction, or clipboard behavior.

For the API, from `backend`:

```powershell
python -m pip install -r requirements-dev.txt
$env:DATABASE_URL = "sqlite:///./textdock-test.db"
python -m alembic upgrade head
python -m pytest -q
```

The tests exercise snapshot creation/read, hash-at-rest behavior, independent revoke authorization, expiry, input/size limits, health checks, and constant-time capability matching. SQLite runs the migration smoke test. Run integration tests against the exact PostgreSQL major version used in deployment before launch.

## Migrations

Migrations are the only supported schema-change workflow. Do not use `Base.metadata.create_all()` to deploy.

```powershell
cd backend
$env:DATABASE_URL = "postgresql+psycopg://textdock:<url-encoded-password>@localhost:5432/textdock"
python -m alembic upgrade head
python -m alembic current
```

For a schema change, update the SQLAlchemy model, create/review an Alembic revision, test both upgrade and downgrade where safe, then deploy the migration before the application version that requires it. The Compose API service runs `alembic upgrade head` before Uvicorn starts.

## Compose deployment

1. Install Docker Engine and Docker Compose.
2. Copy `.env.example` to `.env`. Replace the local development PostgreSQL password with a unique secret and set the exact browser origin list.
3. Put the `web` service behind a TLS-terminating reverse proxy. Restrict network access to PostgreSQL and the API; only nginx needs a public port.
4. Configure an edge/API rate limit for snapshot creation and reads before making the service public; the application does not currently enforce a request quota.
5. Run `docker compose up --build -d`; verify `GET /health/live` and `/health/ready`.
6. Schedule `python -m app.cleanup` in the API container (for example, a daily one-shot job) and monitor its exit status.
7. Back up PostgreSQL and test restores. Backups include active plaintext snapshots; protect them accordingly.

The checked-in Compose stack is a small single-host starter, not a high-availability deployment. It does not configure TLS, managed secrets, resource quotas, rate limiting, log shipping, or automatic backups. Docker was unavailable in the development environment, so the Compose images and container health checks were not executed here.
