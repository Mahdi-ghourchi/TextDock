# Security and privacy notes

## Data flow

Documents are persisted in the current browser profile's IndexedDB. They are not uploaded during editing. Creating a share sends the selected title, text content, format, and expiry to the API. This is a deliberate disclosure: anyone with the resulting link can read that snapshot until it expires or is revoked.

There is no account or server-side owner record. Read and revocation capabilities are independent random 256-bit secrets, generated with Python's `secrets` module. Their SHA-256 digests are stored in PostgreSQL and compared with constant-time digest comparison. The raw capability values are returned only once by the create endpoint. Neither bearer token is part of the API URL or server access-log path.

The frontend places the read token in the URL fragment, then removes the fragment from history and sends the token in an Authorization header. Fragments are not sent to the server in HTTP requests or referrer headers. The share link and revoke capability remain in the share dialog only for the current app session. Copy the link before dismissing it; after dismiss or reload the app cannot recover the link or revoke capability. This is an intentional conservative limitation rather than server-side ownership being implied.

## Markdown and browser security

- Raw HTML is not parsed as Markdown. Generated Markdown nodes pass through `rehype-sanitize`; unsafe URL schemes are blocked.
- Markdown images are represented by their alt text instead of being fetched. This avoids automatic third-party image requests (including tracking pixels) in local notes and shared snapshots.
- There are no external font or image requests in the app shell.
- The production nginx config applies a same-origin Content Security Policy, frame denial, MIME sniffing protection, Referrer Policy, and a restrictive Permissions Policy.
- Put production behind HTTPS and configure HSTS at the TLS terminator. The bundled container does not terminate TLS.
- CORS is an explicit origin allowlist and does not enable credentials.

## Service controls

- Pydantic enforces title, document format, expiry choices, and UTF-8 content size. The ASGI middleware and nginx bound request bodies to approximately 6.1 MB.
- The API container runs as an unprivileged user. PostgreSQL is not published to the host by the Compose file.
- Packaged Uvicorn runs with access logging disabled. Do not enable request/header/body logging in a proxy, APM agent, or exception reporter for share requests.
- Revocation immediately clears title and content. An authenticated request for an expired share also clears content. Run `python -m app.cleanup` periodically to delete expired/revoked tombstones after the 30-day retention window.
- Database contents are not application-encrypted; use encrypted disks/managed database encryption and protected backups appropriate to the deployment.

## Known production hardening still required

- Configure TLS, HSTS, production secrets, backups, monitoring, and PostgreSQL access/network rules.
- Add edge/API rate limits and abuse monitoring before public exposure. No user identity exists for per-user quotas.
- The share API currently has no application-level request or creation quota. Do not expose it publicly until an appropriate edge or API rate limit is in place.
- Schedule the cleanup command and define a backup-retention policy.
- Review dependency updates and run PostgreSQL integration tests before production rollout.
- The link and revocation capability are intentionally not persisted by the browser; after the dialog/session is gone they cannot be recovered. A future share-management flow could retain them locally with clear device-profile security expectations.

This document describes implemented controls and open deployment work; it is not a claim of a completed external security audit or penetration test.
