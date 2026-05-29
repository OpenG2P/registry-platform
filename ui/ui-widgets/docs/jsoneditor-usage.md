# Using JSONEditorPanel in Host Applications

The `JSONEditorPanel` component provides a powerful JSON editor interface using `json-edit-react`. It can be used standalone in your host application to edit section configurations or any JSON data.

## Installation

The `json-edit-react` library is already included as a dependency in this package. However, if you're using this in a host application, make sure you have the required peer dependencies:

```bash
npm install react react-dom @openg2p/registry-widgets
```

## Importing JSONEditorPanel

Currently, `JSONEditorPanel` is exported from the SectionBuilder module. You can import it in two ways:

### Option 1: Direct Import (Recommended)
```tsx
import { JSONEditorPanel } from '@openg2p/registry-widgets/dist/components/SectionBuilder';
import type { SectionConfig } from '@openg2p/registry-widgets';
```

### Option 2: Import from Source (if using source files)
```tsx
import { JSONEditorPanel } from '@openg2p/registry-widgets/src/components/SectionBuilder';
import type { SectionConfig } from '@openg2p/registry-widgets';
```

## Basic Usage

### Simple Example

```tsx
import React, { useState } from 'react';
import { JSONEditorPanel } from '@openg2p/registry-widgets/dist/components/SectionBuilder';
import type { SectionConfig } from '@openg2p/registry-widgets';

function MyApp() {
  const [section, setSection] = useState<SectionConfig>({
    'section-id': 'my-section',
    'section-title': 'My Section',
    'section-editable': true,
    panels: [
      {
        'panel-id': 'panel-1',
        'panel-orientation': 'vertical',
        widgets: [
          {
            widget: 'text',
            'widget-type': 'input',
            'widget-id': 'name',
            'widget-label': 'Name',
            'widget-data-path': 'person.name',
          },
        ],
      },
    ],
  });

  const handleChange = (updatedSection: SectionConfig) => {
    setSection(updatedSection);
    console.log('Section updated:', updatedSection);
  };

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <JSONEditorPanel 
        section={section} 
        onChange={handleChange} 
      />
    </div>
  );
}
```

## Component Props

### JSONEditorPanelProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `section` | `SectionConfig` | Yes | - | The section configuration object to edit |
| `onChange` | `(section: SectionConfig) => void` | Yes | - | Callback function called when the JSON is modified |
| `context` | `'section' \| 'panel' \| 'widget'` | No | `'section'` | Context for the editor (currently not used but reserved for future use) |

## Features

### 1. Tree View Editor
- Visual tree-based JSON editing
- Enum support for specific fields (widget types, orientations, etc.)
- Type-aware editing (strings, numbers, booleans, arrays, objects)

### 2. Raw JSON View
- Toggle between tree view and raw JSON text editor
- Syntax highlighting in raw mode
- Real-time validation

### 3. Validation
- Automatic validation of section structure
- Error messages displayed at the bottom
- Validates required fields like `section-id` and `panels` array

### 4. Auto-population
- Automatically populates `widget-type` based on `widget` selection
- Helps maintain consistency in widget configurations

## Advanced Usage

### Custom Styling

The component uses inline styles, but you can wrap it in a styled container:

```tsx
<div style={{ 
  width: '800px', 
  height: '600px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  overflow: 'hidden'
}}>
  <JSONEditorPanel 
    section={section} 
    onChange={handleChange} 
  />
</div>
```

### Handling Validation Errors

```tsx
const [errors, setErrors] = useState<string[]>([]);

const handleChange = (updatedSection: SectionConfig) => {
  // The component handles validation internally
  // You can also add your own validation here
  setSection(updatedSection);
};

// The component displays validation errors automatically
// You can also access the section data to perform additional validation
```

### Saving Changes

```tsx
const handleSave = () => {
  // Save the current section to your backend
  fetch('/api/sections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(section),
  });
};

return (
  <div>
    <JSONEditorPanel 
      section={section} 
      onChange={setSection} 
    />
    <button onClick={handleSave}>Save Section</button>
  </div>
);
```

## Complete Example

Here's a complete example that demonstrates using JSONEditorPanel in a host application:

```tsx
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JSONEditorPanel } from '@openg2p/registry-widgets/dist/components/SectionBuilder';
import type { SectionConfig } from '@openg2p/registry-widgets';

const initialSection: SectionConfig = {
  'section-id': 'example-section',
  'section-title': 'Example Section',
  'section-editable': true,
  panels: [
    {
      'panel-id': 'personal-details',
      'panel-orientation': 'horizontal',
      panels: [
        {
          'panel-id': 'left-column',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'text',
              'widget-type': 'input',
              'widget-id': 'name',
              'widget-label': 'Full Name',
              'widget-data-path': 'person.name',
              'widget-required': true,
            },
            {
              widget: 'text',
              'widget-type': 'input',
              'widget-id': 'email',
              'widget-label': 'Email Address',
              'widget-data-path': 'person.email',
              'widget-data-validation': {
                validationType: 'email',
                required: true,
              },
            },
          ],
        },
        {
          'panel-id': 'right-column',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'number',
              'widget-type': 'input',
              'widget-id': 'age',
              'widget-label': 'Age',
              'widget-data-path': 'person.age',
              'widget-data-validation': {
                min: 0,
                max: 120,
              },
            },
          ],
        },
      ],
    },
  ],
};

function App() {
  const [section, setSection] = useState<SectionConfig>(initialSection);

  const handleChange = (updatedSection: SectionConfig) => {
    setSection(updatedSection);
    console.log('Section updated:', updatedSection);
  };

  const handleSave = () => {
    console.log('Saving section:', section);
    // Save to your backend or local storage
    localStorage.setItem('section-config', JSON.stringify(section));
    alert('Section saved!');
  };

  const handleReset = () => {
    setSection(initialSection);
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header with actions */}
      <div style={{
        padding: '15px 20px',
        background: '#f8f9fa',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h2 style={{ margin: 0 }}>Section Configuration Editor</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleReset}>Reset</button>
          <button onClick={handleSave} style={{ 
            background: '#007bff', 
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}>
            Save
          </button>
        </div>
      </div>

      {/* JSON Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <JSONEditorPanel 
          section={section} 
          onChange={handleChange} 
        />
      </div>
    </div>
  );
}

// Render the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
```

## Notes

1. **Dependencies**: The `json-edit-react` library is bundled with this package, so you don't need to install it separately.

2. **Type Safety**: Use TypeScript types from `@openg2p/registry-widgets` for full type safety.

3. **Performance**: The component handles large JSON objects efficiently with internal state management.

4. **Validation**: The component performs basic validation, but you may want to add additional validation logic in your `onChange` handler.

5. **Export Path**: If you encounter import issues, check the actual export path in the built distribution files.

## Troubleshooting

### Import Error
If you get an import error, try:
```tsx
// Check if the path exists in dist
import { JSONEditorPanel } from '@openg2p/registry-widgets/dist/components/SectionBuilder/JSONEditorPanel';
```

### Type Errors
Make sure you're importing the types:
```tsx
import type { SectionConfig } from '@openg2p/registry-widgets';
```

### Missing Dependencies
Ensure all peer dependencies are installed:
```bash
npm install react react-dom @reduxjs/toolkit react-redux zod i18next react-i18next
```
