## Sample Locale

This folder is both a **reference** and a **fallback**:

- **Reference** — shows how translations should be structured when uploading a language via the
  Configuration UI. Organize keys into `core` and `domain` following the same format here.

- **Fallback** — `language.helpers.ts` bundles these English translations at compile time.
  Any key missing from the API language config silently falls back to the values here,
  so the app never shows a `MISSING_MESSAGE` error.

### Files

- `core.json` — Platform-level translations (common labels, register, configuration, change
  request, incoming messages, and other shared feature UI).
- `domain.json` — Domain/registry-specific translations (field labels, section labels, register
  names). Domain keys win over core keys on duplicates.

### Rules

- Keep all keys in `snake_case`.
- When adding a new UI string, add it here first so the fallback stays complete.
