# Running Examples

This guide explains how to run the Section Builder and Intake Form examples. The app includes tabs to switch between them.

## Option 1: Quick Setup with Vite (Recommended)

Create a simple Vite React app to test the SectionBuilder:

### 1. Install Vite and dependencies

```bash
# In the project root
npm install -D vite @vitejs/plugin-react
npm install react react-dom @reduxjs/toolkit react-redux zod i18next react-i18next
```

### 2. Create a simple HTML entry point

Create `examples/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Section Builder Example</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/section-builder-app.tsx"></script>
</body>
</html>
```

### 3. Create the app file

Create `examples/section-builder-app.tsx` (see below)

### 4. Create vite config

Create `vite.config.ts` in project root:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@openg2p/registry-widgets': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
```

### 5. Run the dev server

```bash
npx vite
```

## Option 2: Use Create React App

If you prefer Create React App:

```bash
npx create-react-app section-builder-demo --template typescript
cd section-builder-demo
npm install @openg2p/registry-widgets json-edit-react
# Copy the example file and import it
```

## Option 3: Simple HTML with CDN (Limited)

For a quick test, you can use React via CDN, but this has limitations with TypeScript and module imports.

## Intake Form Mode

`examples/intake-form-example.tsx` demonstrates `SectionsContainer` with `mode="IntakeForm"`:

- Accordion layout: sections expand/collapse on header click
- First section open by default
- Previous / Save buttons for stepwise navigation
- `isDraft`: when `true` or `undefined`, sections are editable; when `false`, readonly

Usage:

```tsx
import { SectionsContainer, createWidgetStore, WidgetProvider } from '@openg2p/registry-widgets';

<SectionsContainer
  sections={sections}
  mode="IntakeForm"
  isDraft={true}
  onSectionSave={handleSectionSave}
/>
```

## Option 4: Build and Import in Another Project

1. Build the library:
```bash
npm run build
```

2. In your React project, import:
```tsx
import { SectionBuilder } from '@openg2p/registry-widgets';
```

## Recommended: Quick Vite Setup

See the `vite-example-setup.sh` script for automated setup.
