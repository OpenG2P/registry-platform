# UI Widgets Example App

Interactive demo for `@openg2p/registry-widgets`. Run from the **package root** (`ui-widgets/`).

## Quick start

```bash
# From ui-widgets/
npm run example:setup   # first time only
npm run example:dev
```

Opens `http://localhost:3000` with hot reload.

## Tabs

| Tab | File | What it shows |
|-----|------|----------------|
| Section Builder | `section-builder-app.tsx` | Live section JSON editor |
| Register Sections | `register-sections-example.tsx` | Multi-section RegistryView |
| Change Request | `change-request-example.tsx` | Old vs new CRView comparison |
| Intake Form | `intake-form-example.tsx` | Accordion intake mode |
| Special Sections | `special-sections-example.tsx` | Header, scores, ID auth, register lookup, dialog table |
| Widgets | `widgets-example.tsx` | Input widget gallery (3 sections) |
| Theme | `theme-example.tsx` | Theme presets and token overrides |

## Layout

```
examples/
├── index.html
├── section-builder-app.tsx     # App shell + tab navigation
├── *-example.tsx               # One file per tab
└── shared/
    ├── exampleSchemas.ts       # Loads section JSONC from example-ui-schema/
    ├── exampleData.ts          # Sample record data (schemaData)
    ├── loadExampleSchema.ts    # JSONC parse + register-id substitution
    └── mockDataSourceHandler.ts

../example-ui-schema/
├── sections/                   # Section UI schemas (*.jsonc)
└── widgets/                    # Widget reference snippets

../vite.config.ts               # Vite root = ./examples
../vite-env.d.ts                # TypeScript types for ?raw imports
```
