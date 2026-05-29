# SectionBuilder Host Application Integration

This guide shows how to integrate SectionBuilder into your host application with proper height adaptation.

## Basic Integration

### Using Tailwind CSS (Recommended)

```tsx
import { SectionBuilder } from '@openg2p/registry-widgets';
import type { SectionConfig } from '@openg2p/registry-widgets';

function MyPage() {
  const [section, setSection] = useState<SectionConfig>({
    'section-id': 'my-section',
    'section-title': 'My Section',
    'section-editable': true,
    panels: [],
  });

  return (
    <div className="p-8">
      {/* Option 1: Fixed minimum height with internal scrolling */}
      <div className="bg-white rounded-[30px] p-8 min-h-[600px] w-full">
        <SectionBuilder
          initialSection={section}
          onChange={setSection}
          onSave={(s) => console.log('Saved:', s)}
        />
      </div>
    </div>
  );
}
```

### Adapting to Remaining Screen Height

### With Sidebar Layout (Recommended)

When you have a sidebar (like an orange menu on the left), calculate the available height:

```tsx
function MyPage() {
  const [section, setSection] = useState<SectionConfig>({...});

  return (
    <div className="h-screen flex">
      {/* Left Sidebar */}
      <aside className="w-64 bg-orange-500 flex-shrink-0">
        {/* Your sidebar content */}
      </aside>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Optional Header */}
        <header className="h-16 bg-white border-b flex-shrink-0">
          {/* Header content */}
        </header>
        
        {/* SectionBuilder Container */}
        <div className="flex-1 overflow-hidden p-8">
          <div className="bg-white rounded-[30px] p-8 h-full">
            <SectionBuilder
              initialSection={section}
              onChange={setSection}
              onSave={handleSave}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Without Sidebar

To make SectionBuilder fill the remaining viewport height:

```tsx
function MyPage() {
  const [section, setSection] = useState<SectionConfig>({...});

  return (
    <div className="h-screen flex flex-col">
      {/* Header or navigation */}
      <header className="h-16 bg-gray-100 flex-shrink-0">...</header>
      
      {/* Main content area */}
      <div className="flex-1 overflow-hidden p-8">
        <div className="bg-white rounded-[30px] p-8 h-full flex flex-col">
          <SectionBuilder
            initialSection={section}
            onChange={setSection}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
```

### Using Inline Styles with Sidebar

```tsx
function MyPage() {
  const [section, setSection] = useState<SectionConfig>({...});

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
    }}>
      {/* Left Sidebar */}
      <aside style={{
        width: '256px', // 64 * 4 = 256px (w-64 equivalent)
        background: '#f97316', // orange-500
        flexShrink: 0,
      }}>
        {/* Your sidebar content */}
      </aside>
      
      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Optional Header */}
        <header style={{
          height: '64px',
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
        }}>
          {/* Header content */}
        </header>
        
        {/* SectionBuilder Container */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          padding: '32px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '30px',
            padding: '32px',
            height: '100%',
          }}>
            <SectionBuilder
              initialSection={section}
              onChange={setSection}
              onSave={handleSave}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Using Inline Styles without Sidebar

```tsx
function MyPage() {
  const [section, setSection] = useState<SectionConfig>({...});

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{ height: '64px', flexShrink: 0 }}>...</header>
      
      {/* Main content - fills remaining space */}
      <div style={{ 
        flex: 1,
        overflow: 'hidden',
        padding: '32px',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '30px',
          padding: '32px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <SectionBuilder
            initialSection={section}
            onChange={setSection}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
```

## Key Points

1. **Height Adaptation**: SectionBuilder uses `height: 100%` internally, so ensure its container has a defined height.

2. **Sidebar Layout**: When you have a sidebar, use flexbox to calculate available height:
   - Sidebar: `flex-shrink: 0` (fixed width)
   - Main content: `flex: 1` (takes remaining space)
   - SectionBuilder container: `height: 100%` (fills available space)

3. **Internal Scrolling**: Both JSON Editor and Visual Builder panels scroll independently when content exceeds available space.

4. **No Browser Scroll**: Use `overflow: hidden` on parent containers to prevent browser-level scrolling.

5. **Flex Layout**: If using flexbox, ensure parent containers use `flex: 1` or `flex-1` to fill available space.

## Height Calculation Pattern

The host application should handle height constraints:

```
Viewport (100vh)
  └─ Layout Container (flex)
      ├─ Sidebar (fixed width, flex-shrink: 0)
      └─ Main Content (flex: 1)
          ├─ Header (fixed height, flex-shrink: 0) [optional]
          └─ SectionBuilder Container (flex: 1)
              └─ SectionBuilder (height: 100%)
```

**Important**: Always use `overflow: hidden` on containers that should not scroll, and `overflow: auto` only on the scrollable content areas.

## JSON Editor "root" Key Behavior

The `json-edit-react` library wraps objects in a "root" key by default. This is **expected behavior** and is handled automatically:

- The library displays data wrapped in "root" for editing
- Changes are automatically unwrapped before being passed to `onChange`
- Your `onChange` handler receives the unwrapped section data

If you see "root: { 0 items }", it means:
- The section data is empty or not properly initialized
- Or the data structure doesn't match the expected `SectionConfig` format

## Complete Example

```tsx
import React, { useState } from 'react';
import { SectionBuilder } from '@openg2p/registry-widgets';
import type { SectionConfig } from '@openg2p/registry-widgets';

function SectionBuilderPage() {
  const [section, setSection] = useState<SectionConfig>({
    'section-id': 'example-section',
    'section-title': 'Example Section',
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

  const handleSave = (savedSection: SectionConfig) => {
    // Save to your backend
    console.log('Saving section:', savedSection);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Your app header */}
      <header className="h-16 bg-white border-b">
        <div className="px-8 py-4">
          <h1 className="text-xl font-semibold">Section Builder</h1>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden p-8">
        <div className="bg-white rounded-[30px] p-8 h-full shadow-lg">
          <SectionBuilder
            initialSection={section}
            onChange={setSection}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
```

## Troubleshooting

### SectionBuilder not filling height
- Ensure parent container has `height: 100%` or `flex: 1`
- Check that all parent containers have proper height constraints
- Use browser DevTools to inspect computed heights

### Browser scrollbar appearing
- Add `overflow: hidden` to parent containers
- Ensure SectionBuilder container has a defined max-height

### JSON Editor showing "root: { 0 items }"
- Verify `initialSection` prop contains valid section data
- Check that section has `section-id` and `panels` array
- The "root" wrapping is normal - data is unwrapped automatically
