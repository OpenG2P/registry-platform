# How to Run the Section Builder Example

## Quick Start (Recommended)

### Step 1: Install Dependencies

```bash
npm run example:setup
```

This will install:
- Vite and React plugin (dev dependencies)
- React, React-DOM, Redux, and other peer dependencies

### Step 2: Run the Example

```bash
npm run example:dev
```

This will:
- Start a Vite dev server on `http://localhost:3000`
- Automatically open your browser
- Hot-reload on file changes

## Manual Setup

If you prefer to install dependencies manually:

```bash
# Install dev dependencies
npm install -D vite @vitejs/plugin-react

# Install peer dependencies (if not already installed)
npm install react react-dom @reduxjs/toolkit react-redux zod i18next react-i18next
```

Then run:
```bash
npx vite
```

## What Gets Started

The example app (`examples/section-builder-app.tsx`) includes:

- ✅ Full SectionBuilder component
- ✅ Redux store setup
- ✅ WidgetProvider configuration
- ✅ Example section with panels and widgets
- ✅ Change and save handlers

## File Structure

```
examples/
├── index.html              # HTML entry point
├── section-builder-app.tsx # Main React app
└── section-builder-example.tsx # Component examples (for reference)

vite.config.ts             # Vite configuration
```

## Troubleshooting

### Port Already in Use

If port 3000 is busy, Vite will automatically try the next available port. Check the terminal output for the actual URL.

### Module Not Found Errors

Make sure all dependencies are installed:
```bash
npm install
npm run example:setup
```

### TypeScript Errors

The project uses TypeScript. Make sure `tsconfig.json` is properly configured. Run:
```bash
npm run type-check
```

## Building for Production

To build the example app:

```bash
npm run example:build
```

Output will be in `dist-examples/` directory.

## Alternative: Use in Your Own Project

If you want to use SectionBuilder in your own React project:

1. Build this library:
   ```bash
   npm run build
   ```

2. In your project, install:
   ```bash
   npm install @openg2p/registry-widgets json-edit-react
   ```

3. Import and use:
   ```tsx
   import { SectionBuilder } from '@openg2p/registry-widgets';
   ```

## Viewing the Mockup

You can also view the static HTML mockup without running React:

```bash
open docs/section-builder-mockup.html
```

Or just open `docs/section-builder-mockup.html` in your browser.
