## Sample Locale

This folder is both a **reference** and a **fallback**:

- **Reference** — shows how **core** translations should be structured when uploading a language via the
  Configuration UI.

- **Fallback** — `language.helpers.ts` bundles `core.json` at compile time. Any platform key missing
  from the API language config silently falls back to these values, so the app never shows a
  `MISSING_MESSAGE` error for core strings.

### Files

- `core.json` — Platform-level translations shared across all registry implementations: staff-portal UI
  labels, configuration screens, change requests, messages, widget `common`/`table`/`errors`/
  `validation` strings, and other keys referenced via `t()` / `translate()` in
  `staff-portal-ui` and `ui-widgets`.

**Domain translations** (register labesl, field labels, tab lebels, section labels, master data labels, enums) are **not** stored
here. Each registry implementation provides its own `domain_translation` via the Configuration UI
or registry deployment.

At runtime: `getLanguageMessages()` merges `{ ...coreFallback, ...apiCore, ...apiDomain }` — API
values win on duplicate keys; domain keys come from the active registry only.

### Rules

- Keep platform keys in `snake_case` (nested groups: `common`, `table`, `errors`, `validation`).
- When adding a new platform UI string, add the key to `core.json` so the fallback stays complete.
