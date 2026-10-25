# Design system

TextDock is an **Operate** surface. This visual system is an implementation direction inferred from the product brief, not an approved brand identity.

## Own-world

The editor borrows the visible construction grid of a gridded type specimen and makes that armature part of the writing surface. A precise 24px field sits behind a sheet-like document column; the text editor adds quiet baselines, while blue marks indicate selection and action. Cool light paper and deep ink keep the task legible; dark appearance uses the same rules with a dark instrument panel. The visual grid is intentional and aligned with the selected design direction, not an arbitrary decorative overlay.

## Palette

| Role | Light | Dark |
| --- | --- | --- |
| Workspace | `#f4f6f9` | `#151b24` |
| Document surface | `#ffffff` | `#1c2430` |
| Primary ink | `#202a37` | `#e2e8f1` |
| Secondary ink | `#626e7d` | `#a6b1c0` |
| Muted ink | `#667383` | `#9ba8b9` |
| Action blue | `#315fd2` | `#85a8ff` |
| Success | `#287855` | `#80d5ad` |

Tokens are defined in `src/style.css`; semantic roles, not arbitrary isolated colors, should drive new components.

## Type and composition

- System UI sans-serif for controls, labels, and headings; system monospace for authored text and measured metadata. No remote font request.
- One broad, centered document sheet sits beside a compact library rail. The editor keeps a readable 72-character measure in preview.
- Small mono labels establish file format and local status; document title has the strongest text hierarchy.
- The only border-side indicator in content is the standard Markdown blockquote marker, preserving recognizable document semantics.

## Controls, state, and adaptation

Buttons, inputs, menus, save indicators, search, preview, and share dialog use semantic native elements with visible focus. Save success, in-progress, and failure are distinct states. Sharing has a separate explicit flow and an honest warning that the link grants access.

At tablet widths the library narrows. On small screens it becomes a collapsible overlay; writing remains full-width. Reduced-motion preferences are honored. The library's collapse is immediate rather than animating layout width.
