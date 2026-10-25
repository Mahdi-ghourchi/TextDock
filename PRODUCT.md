# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Inferred from the requested feature set: people who write Markdown or plain-text documents and need a local place to draft, organize, search, or share them without creating an account. The primary audience and usage research remain unconfirmed.

## Product Purpose

TextDock is a local-first text editor. Its primary success measure is that a person can create and keep working with their documents offline, with clear feedback that edits have been saved.

## Positioning

Documents live in the user's browser storage by default; sharing is a separate, explicit action that publishes a read-only snapshot.

## Operating Context

The editor is used in a browser across desktop and mobile layouts. Editing is independent of the sharing API after the app is loaded, but no service worker is configured, so offline first-load or reload is not guaranteed. People create and manage a personal document library, edit in Markdown or plain text, preview Markdown, import/export files, and optionally publish a snapshot through the sharing service.

## Capabilities and Constraints

- No account is required.
- Local documents persist in IndexedDB and remain usable without the sharing API.
- Autosave must report saving, saved, and error states; users can also explicitly save.
- Supported file formats are Markdown and plain text.
- Markdown preview disables raw HTML and sanitizes output and unsafe links.
- Sharing is explicit, read-only, snapshot-based, and uses expiring bearer capabilities.
- Document size, share size, title length, and share lifetime require documented limits.
- The sharing service requires a separately configured PostgreSQL database; local editing must not depend on it.
- Local titles are limited to 160 characters; imports are limited to 5 MiB; shared UTF-8 content is limited to 1 MB; shares expire after 24 hours, 7 days, or 30 days.
- Share revocation must require a separate high-entropy capability; no account ownership is implied.

## Brand Commitments

The product is named TextDock. The direct, low-key voice and explicit descriptions of save, share, and privacy behavior are implementation choices inferred from the brief, not approved brand research. There is no confirmed logo or existing visual identity.

## Evidence on Hand

No customer research, testimonials, benchmarks, or production service endpoints were provided. Do not invent or imply these.

## Product Principles

- Local work remains useful when the network is unavailable.
- Saving state is visible rather than assumed.
- Sharing is deliberate, limited to a snapshot, and read-only.
- Security behavior is explained without implying account ownership.
- The editor remains usable with keyboard, touch, and assistive technology.

## Accessibility & Inclusion

Use semantic controls, visible keyboard focus, accessible names and live save-state announcements, responsive layouts, and reduced-motion support.
