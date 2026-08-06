# @openg2p/registry-widgets

Schema-driven React widget library for the OpenG2P Registry platform. Renders sections, panels, and widgets from UI JSON, with Redux-backed form state, validation, conditional logic, API data sources, and theming.

## Install

```bash
npm install @openg2p/registry-widgets json-edit-react
```

Peer dependencies: `react`, `react-dom`, `@reduxjs/toolkit`, `react-redux`, `zod`.

## Quick start

```tsx
import { Provider } from 'react-redux';
import {
  createWidgetStore,
  WidgetProvider,
  SectionsContainer,
} from '@openg2p/registry-widgets';
import type { SectionConfig } from '@openg2p/registry-widgets';

const store = createWidgetStore();
const sections: SectionConfig[] = [];
const schemaData = { };

function App() {
  return (
    <Provider store={store}>
      <WidgetProvider
        store={store}
        schemaData={schemaData}
        dataSourceRequestHandler={async (service, endpoint, method, params) => {
          return [];
        }}
        t={(key) => key}
      >
        <SectionsContainer
          sections={sections}
          schemaData={schemaData}
          mode="RegistryView"
          onSectionSave={async (changes) => console.log(changes)}
        />
      </WidgetProvider>
    </Provider>
  );
}
```

## Core concepts

- **UI schema** — Sections contain panels and widgets. Each widget has a `widget-data-path` (e.g. `register-id.birth_date`) resolved against `schemaData`.
- **WidgetProvider** — Supplies `schemaData`, optional `dataSourceRequestHandler` for API/static selects, and a `t` translation function.
- **SectionsContainer** — Renders one or more sections. Modes: `RegistryView` (read/edit per section) or `IntakeForm` (accordion flow).
- **SectionBuilder** — Visual + JSON editor for authoring section schemas at runtime.

## Widgets

Input: `text`, `textarea`, `number`, `boolean`, `date`, `datetime`, `select`, `radio`, `checkbox`, `multi-select`, `phone`, `file`, `display`.

Collections: `table`, `dialog-table`.

Special: `profile`, `header-section`, `scores-display`, `id-authentication`, `register-lookup`, `parent-lookup`.

Custom widgets can be registered via `widgetRegistry`.

## Theming

Pass a `theme` prop to `WidgetProvider` or read resolved tokens with `useWidgetTheme()`. See the **Theme** tab in the example app.

## Example app

Interactive demos (Section Builder, Register Sections, Change Request, Intake Form, Special Sections, Widgets, Theme):

```bash
npm run example:setup   # first time
npm run example:dev
```

Details: [examples/README.md](https://github.com/OpenG2P/registry-platform/blob/develop/ui/ui-widgets/examples/README.md)

Sample section schemas and widget snippets live in [example-ui-schema/](https://github.com/OpenG2P/registry-platform/tree/develop/ui/ui-widgets/example-ui-schema).

## Development

```bash
npm install
npm run build          # library → dist/
npm run type-check
npm run lint
npm run example:build  # example app → dist-examples/
```

- `tsconfig.json` — type-check for `src/` and `examples/`
- `tsconfig.build.json` — Rollup library build (`src/` only)

## License

MPL-2.0
