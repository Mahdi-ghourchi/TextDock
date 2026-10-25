# TextDock API v1

Base path: `/api/v1`. Requests and responses use JSON except for empty `204` revocation responses. The interactive OpenAPI UI is `/api/docs`.

## Create a snapshot

`POST /api/v1/shares`

```json
{
  "title": "Meeting notes",
  "content": "# Notes\n\nDraft text",
  "format": "markdown",
  "expires_in_hours": 168
}
```

`format` must be `markdown` or `text`. `expires_in_hours` is `24`, `168`, or `720` and defaults to `168`. Titles are trimmed, non-empty, and limited to 160 characters. Content is limited to 1,000,000 UTF-8 bytes. The HTTP request body is bounded to 6,100,000 bytes to allow JSON escaping while bounding parser memory.

Response (`201 Created`):

```json
{
  "id": "opaque-public-id",
  "access_token": "returned-once",
  "revoke_capability": "returned-once",
  "created_at": "2026-10-23T18:30:00Z",
  "expires_at": "2026-10-30T18:30:00Z"
}
```

The access token and separate revoke capability are only returned at creation. Store them securely; the API stores hashes. The web client puts the access token in the share URL fragment and then uses an Authorization header for reads. It does not send the token in the URL path or query string.

## Read a snapshot

`GET /api/v1/shares/{id}`

Header: `Authorization: Bearer <access_token>`

Response (`200 OK`) contains only `id`, `title`, `content`, `format`, `created_at`, and `expires_at`; it never returns capabilities.

## Revoke a snapshot

`DELETE /api/v1/shares/{id}`

Header: `X-Revoke-Capability: <revoke_capability>`

Returns `204 No Content`. Repeated authorized revocation is safe. The share's title/content are erased immediately. Missing/invalid capability returns `404` to avoid disclosing the existence of a snapshot.

## Errors and operational endpoints

- `401` when a read request omits the bearer token.
- `404` for a nonexistent share or incorrect read/revocation capability.
- `410` for a correctly authenticated expired/revoked share.
- `413` for an oversized request body; `422` for schema/validation errors.
- `GET /health/live` checks process liveness.
- `GET /health/ready` executes a database check and returns `503` if the database cannot be reached.

The API deliberately has no list-all, ownership, update, or account endpoints.
