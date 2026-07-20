# Section Builder Component

A dual-panel React component for creating and editing Section JSON configurations with both JSON editing and visual builder capabilities.

## Features

- **JSON Editor (Left Panel)**: Direct JSON editing with schema validation using `json-edit-react`
- **Visual Builder (Right Panel)**: Graphical interface with tree view and property editor
- **Two-Way Synchronization**: Changes in either panel are automatically reflected in the other
- **Schema Validation**: Real-time validation based on TypeScript type definitions
- **Add/Remove/Edit**: Easily add panels and widgets, edit properties, and delete items
- **Duplicate**: Clone existing panels or widgets

## Installation

The SectionBuilder is part of the `@openg2p/registry-widgets` package. Make sure you have `json-edit-react` installed:

```bash
npm install json-edit-react
```

## Basic Usage

```tsx
import React, { useState } from 'react';
import { SectionBuilder } from '@openg2p/registry-widgets';
import { SectionConfig } from '@openg2p/registry-widgets';

const MyComponent = () => {
  const [section, setSection] = useState<SectionConfig>({
    'section-id': 'my-section',
    'section-title': 'My Section',
    'section-editable': false,
    panels: []
  });

  return (
    <SectionBuilder
      initialSection={section}
      onChange={setSection}
      onSave={(savedSection) => {
        console.log('Saved:', savedSection);
      }}
    />
  );
};
```

## Props

### SectionBuilderProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `initialSection` | `SectionConfig` | No | Initial section configuration |
| `onChange` | `(section: SectionConfig) => void` | No | Callback when section changes |
| `onSave` | `(section: SectionConfig) => void` | No | Callback when section is saved |

## Component Structure

```
SectionBuilder/
├── SectionBuilder.tsx          # Main component
├── JSONEditorPanel.tsx         # Left panel with json-edit-react
├── VisualBuilderPanel.tsx     # Right panel container
├── SectionTree.tsx            # Tree view component
├── PropertyEditor.tsx         # Property form component
└── schemas.ts                  # JSON Schema definitions
```

## Examples

See `ui-schema/` (`.jsonc` files) for examples. See the package [README.md](../../../README.md) for Section Builder usage.

## Features in Detail

### JSON Editor Panel

- Uses `json-edit-react` for JSON editing
- Schema-based validation
- Real-time error display
- Dark theme code editor

### Visual Builder Panel

#### Tree View
- Hierarchical display of section structure
- Color-coded items:
  - Blue: Sections
  - Orange: Panels
  - Green: Widgets
- Click to select and edit
- Settings icon (⚙) on hover

#### Property Editor
- Context-aware form fields
- Shows relevant properties based on selected item type
- Text inputs, dropdowns, checkboxes
- Delete and Duplicate buttons

#### Add Buttons
- **+ Add Panel**: Add new panel to selected section/panel
- **+ Add Widget**: Add new widget to selected panel

## JSON Schema

The component uses JSON Schema for validation. Schemas are generated from TypeScript type definitions:

- `sectionSchema` - Section configuration schema
- `panelSchema` - Panel configuration schema
- `baseWidgetSchema` - Base widget schema (extended per widget type)

## Synchronization

The component maintains two-way synchronization:

1. **JSON → Visual**: When JSON is edited, the tree view and property editor update
2. **Visual → JSON**: When properties are edited or items are added/removed, the JSON updates

Changes are debounced to prevent performance issues.

## Styling

The component uses inline styles for a self-contained experience. You can override styles by:

1. Using CSS to target component classes
2. Wrapping the component in a styled container
3. Modifying the component source for custom themes

## Limitations

- Currently supports single section editing (not multiple sections)
- Drag-and-drop reordering is not yet implemented
- Undo/redo functionality is not available
- Export/import features are not included

## Future Enhancements

- Drag-and-drop reordering
- Copy/paste items
- Undo/redo
- Export/import
- Template library
- Preview mode
- Search/filter in tree
- Bulk operations

## Contributing

When adding new features:

1. Update the JSON schemas in `schemas.ts`
2. Update the PropertyEditor for new fields
3. Update this README

## License

MPL-2.0
