# Section JSON Builder - Design Document

## Overview
A dual-panel component for creating and editing Section JSON configurations with both JSON editing and visual builder capabilities.

## UI Layout

### Split View Design
- **Left Panel (50%)**: JSON Editor using `json-edit-react`
- **Right Panel (50%)**: Visual Builder with tree view and property editor
- **Divider**: Resizable splitter between panels

### Left Panel: JSON Editor

#### Features
1. **JSON Editor Component**
   - Uses `json-edit-react` library
   - Dark theme code editor (VS Code style)
   - Syntax highlighting
   - Line numbers
   - Real-time validation

2. **JSON Schema Validation**
   - Dynamic schema generation based on TypeScript types
   - Context-aware schemas:
     - Section-level schema when editing section
     - Panel-level schema when editing panel
     - Widget-level schema when editing widget
   - Real-time error highlighting
   - Validation status indicator

3. **Schema Constraints**
   - Enum values for widget types (text, number, date, select, etc.)
   - Enum values for orientations (horizontal, vertical)
   - Required field validation
   - Type checking (string, number, boolean, object, array)
   - Nested structure validation

### Right Panel: Visual Builder

#### Top Section: Tree View (45% width)
1. **Hierarchical Structure Display**
   - Section (root level)
     - Panels (nested)
       - Widgets (leaf nodes)
   - Color coding:
     - Blue: Sections
     - Orange: Panels
     - Green: Widgets

2. **Tree Interactions**
   - Click to select item
   - Visual selection highlighting
   - Expand/collapse nested items
   - Drag-and-drop for reordering (future enhancement)
   - Context menu for actions

3. **Item Actions**
   - Settings icon (⚙) on hover
   - Click to edit properties
   - Delete button
   - Duplicate button

#### Bottom Section: Properties Panel (55% width)
1. **Context-Aware Property Editor**
   - Shows properties based on selected item type:
     - **Section**: section-id, section-title, section-editable, section-column-span
     - **Panel**: panel-id, panel-orientation, panel-column-span
     - **Widget**: All widget-specific properties

2. **Form Controls**
   - Text inputs for IDs, labels, paths
   - Dropdowns for enums (widget type, orientation)
   - Number inputs for spans, validation limits
   - Checkboxes for boolean flags (required, readonly)
   - Nested forms for complex objects (validation, format, data-source)

3. **Widget-Specific Properties**
   - Conditional fields based on widget type
   - Validation rules editor
   - Data source configuration
   - Format options
   - Conditional logic (show/hide, enable/disable)

4. **Action Buttons**
   - Delete: Remove selected item
   - Duplicate: Copy selected item
   - Move Up/Down: Reorder items

#### Bottom Bar: Add Buttons
- **+ Add Panel**: Add new panel to selected section/panel
- **+ Add Widget**: Add new widget to selected panel

## Synchronization

### Two-Way Sync
1. **JSON → Visual**
   - Parse JSON changes
   - Update tree view
   - Update property editor if item is selected
   - Highlight validation errors

2. **Visual → JSON**
   - Property changes update JSON
   - Add/remove operations update JSON
   - Reorder operations update JSON
   - Debounced updates to prevent conflicts

3. **Conflict Resolution**
   - Last edit wins
   - Show notification if both sides edited simultaneously
   - Option to reload from JSON or visual

## JSON Schema Generation

### Schema Structure
```typescript
// Section Schema
{
  type: "object",
  properties: {
    "section-id": { type: "string", minLength: 1 },
    "section-title": { type: "string" },
    "section-editable": { type: "boolean" },
    "section-column-span": { type: "number", minimum: 1 },
    "panels": {
      type: "array",
      items: { $ref: "#/definitions/panel" }
    }
  },
  required: ["section-id", "panels"]
}

// Panel Schema
{
  type: "object",
  properties: {
    "panel-id": { type: "string", minLength: 1 },
    "panel-orientation": { 
      type: "string",
      enum: ["horizontal", "vertical"]
    },
    "panel-column-span": { type: "number", minimum: 1 },
    "panels": { type: "array", items: { $ref: "#/definitions/panel" } },
    "widgets": { type: "array", items: { $ref: "#/definitions/widget" } }
  },
  required: ["panel-id"]
}

// Widget Schema (dynamic based on widget type)
{
  type: "object",
  properties: {
    "widget": {
      type: "string",
      enum: ["text", "number", "date", "select", "boolean", ...]
    },
    "widget-id": { type: "string", minLength: 1 },
    "widget-label": { type: "string" },
    // ... other properties based on widget type
  },
  required: ["widget", "widget-id"]
}
```

## Component Structure

```
SectionBuilder/
├── SectionBuilder.tsx          # Main component
├── JSONEditorPanel.tsx         # Left panel with json-edit-react
├── VisualBuilderPanel.tsx     # Right panel container
├── SectionTree.tsx            # Tree view component
├── PropertyEditor.tsx         # Property form component
├── schemas/
│   ├── sectionSchema.ts       # Section JSON Schema
│   ├── panelSchema.ts         # Panel JSON Schema
│   └── widgetSchemas.ts       # Widget JSON Schemas
└── utils/
    ├── schemaGenerator.ts      # Generate schemas from types
    ├── jsonSync.ts            # Sync logic
    └── validation.ts          # Validation helpers
```

## Features

### Core Features
1. ✅ JSON editing with schema validation
2. ✅ Visual tree view
3. ✅ Property editor
4. ✅ Add/remove panels and widgets
5. ✅ Two-way synchronization

### Future Enhancements
1. Drag-and-drop reordering
2. Copy/paste items
3. Undo/redo
4. Export/import
5. Template library
6. Preview mode
7. Search/filter in tree
8. Bulk operations

## Color Scheme

- **Primary**: #2196f3 (Blue) - Sections
- **Secondary**: #ff9800 (Orange) - Panels
- **Success**: #4caf50 (Green) - Widgets
- **Danger**: #f44336 (Red) - Delete actions
- **Warning**: #ff9800 (Orange) - Warnings
- **Background**: #f8f9fa (Light gray)
- **Text**: #2c3e50 (Dark gray)

## Responsive Design

- Desktop: Split view (50/50)
- Tablet: Stacked view (100% each, toggleable)
- Mobile: Single panel view with toggle

## Accessibility

- Keyboard navigation
- ARIA labels
- Screen reader support
- Focus management
- High contrast mode support