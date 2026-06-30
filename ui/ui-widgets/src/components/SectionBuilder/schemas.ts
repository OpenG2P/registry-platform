/**
 * JSON Schema definitions for Section Builder validation
 * These schemas are used by json-edit-react to provide validation and constraints
 */

export const WIDGET_TYPES = [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'radio',
  'checkbox',
  'file',
  'simple-table',
  'table',
  'array-widget',
  'iterable-accordion',
  'phone',
  'currency',
  'display',
  'profile',
] as const;

export const ORIENTATIONS = ['horizontal', 'vertical'] as const;

export const CONDITION_OPERATORS = [
  'equals',
  'notEquals',
  'notEmpty',
  'empty',
  'greaterThan',
  'lessThan',
  'contains',
  'notContains',
] as const;

export const DATA_SOURCE_TYPES = ['static', 'api', 'schema'] as const;

export const VALIDATION_TYPES = ['email', 'phone', 'url'] as const;

export const CHARACTER_TYPES = [
  'any',
  'alphabetic',
  'alphanumeric',
  'numeric',
  'numeric-decimal',
  'custom',
] as const;

export const CASE_CONTROLS = ['none', 'lowercase', 'uppercase', 'capitalize'] as const;

export const NUMERIC_TYPES = ['integer', 'decimal'] as const;

export const BOOLEAN_REPRESENTATIONS = ['true-false', 'yes-no', 'on-off', 'custom'] as const;

export const BOOLEAN_CONTROL_TYPES = ['checkbox', 'radio', 'toggle'] as const;

/**
 * Base widget schema - common properties for all widgets
 */
const baseWidgetSchema = {
  type: 'object' as const,
  properties: {
    widget: {
      type: 'string' as const,
      enum: WIDGET_TYPES,
      description: 'Widget type identifier',
    },
    'widget-type': {
      type: 'string' as const,
      enum: ['input', 'layout', 'table', 'group'],
      description: 'Widget category type',
    },
    'widget-id': {
      type: 'string' as const,
      minLength: 1,
      description: 'Unique widget identifier',
    },
    'widget-label': {
      type: 'string' as const,
      description: 'Display label for the widget',
    },
    'widget-orientation': {
      type: 'string' as const,
      enum: ORIENTATIONS,
      description: 'Orientation for layout widgets',
    },
    'widget-data-path': {
      oneOf: [
        { type: 'string' as const },
        { type: 'object' as const },
      ],
      description: 'Data binding path (string or object)',
    },
    'widget-data-default': {
      description: 'Default value for the widget',
    },
    'widget-required': {
      type: 'boolean' as const,
      description: 'Whether the widget is required',
    },
    'widget-readonly': {
      type: 'boolean' as const,
      description: 'Whether the widget is readonly',
    },
    'widget-data-validation': {
      type: 'object' as const,
      properties: {
        required: { type: 'boolean' as const },
        validationType: {
          type: 'string' as const,
          enum: VALIDATION_TYPES,
        },
        pattern: { type: 'string' as const },
        patternMessage: { type: 'string' as const },
        minLength: { type: 'number' as const, minimum: 0 },
        maxLength: { type: 'number' as const, minimum: 0 },
        min: { type: 'number' as const },
        max: { type: 'number' as const },
        custom: { type: 'string' as const },
      },
      description: 'Validation configuration',
    },
    'widget-data-format': {
      type: 'object' as const,
      properties: {
        dateFormat: { type: 'string' as const },
        currency: { type: 'string' as const },
        locale: { type: 'string' as const },
        decimals: { type: 'number' as const, minimum: 0, maximum: 10 },
        pattern: { type: 'string' as const },
        inputType: {
          type: 'string' as const,
          enum: ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'file'],
        },
        characterType: {
          type: 'string' as const,
          enum: CHARACTER_TYPES,
        },
        customCharset: { type: 'string' as const },
        caseControl: {
          type: 'string' as const,
          enum: CASE_CONTROLS,
        },
        mask: {
          type: 'object' as const,
          properties: {
            pattern: { type: 'string' as const },
            type: {
              type: 'string' as const,
              enum: ['static', 'phone', 'national-id', 'custom'],
            },
            placeholder: { type: 'string' as const },
          },
        },
        showCharCounter: { type: 'boolean' as const },
        rows: { type: 'number' as const, minimum: 1 },
        numericType: {
          type: 'string' as const,
          enum: NUMERIC_TYPES,
        },
        decimalPlaces: { type: 'number' as const, minimum: 0, maximum: 6 },
        roundingMode: {
          type: 'string' as const,
          enum: ['round', 'truncate'],
        },
        thousandSeparator: { type: 'string' as const },
        decimalSeparator: { type: 'string' as const },
        textAlign: {
          type: 'string' as const,
          enum: ['left', 'right'],
        },
        allowSigned: { type: 'boolean' as const },
        formatOnBlur: { type: 'boolean' as const },
        booleanRepresentation: {
          type: 'string' as const,
          enum: BOOLEAN_REPRESENTATIONS,
        },
        booleanControlType: {
          type: 'string' as const,
          enum: BOOLEAN_CONTROL_TYPES,
        },
        booleanTrueLabel: { type: 'string' as const },
        booleanFalseLabel: { type: 'string' as const },
        allowUnset: { type: 'boolean' as const },
        layout: {
          type: 'string' as const,
          enum: ['vertical', 'horizontal', 'grid'],
        },
        sortOptions: { type: 'boolean' as const },
        inputMethod: {
          type: 'string' as const,
          enum: ['picker', 'manual', 'hybrid'],
        },
        dateConstraint: {
          type: 'string' as const,
          enum: ['any', 'past-only', 'future-only'],
        },
        dateTimeFormat: { type: 'string' as const },
        dateTimeConstraint: {
          type: 'string' as const,
          enum: ['any', 'past-only', 'future-only'],
        },
      },
      description: 'Format configuration',
    },
    'widget-data-source': {
      type: 'object' as const,
      oneOf: [
        {
          type: 'object' as const,
          properties: {
            type: { type: 'string' as const, const: 'static' },
            options: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  value: {},
                  label: { type: 'string' as const },
                },
                required: ['value', 'label'],
              },
            },
          },
          required: ['type', 'options'],
        },
        {
          type: 'object' as const,
          properties: {
            type: { type: 'string' as const, const: 'api' },
            url: { type: 'string' as const },
            method: {
              type: 'string' as const,
              enum: ['GET', 'POST', 'PUT', 'DELETE'],
            },
            dependsOn: { type: 'string' as const },
            valueKey: { type: 'string' as const },
            labelKey: { type: 'string' as const },
            headers: { type: 'object' as const },
            body: { type: 'object' as const },
          },
          required: ['type', 'url'],
        },
        {
          type: 'object' as const,
          properties: {
            type: { type: 'string' as const, const: 'schema' },
            path: { type: 'string' as const },
            valueKey: { type: 'string' as const },
            labelKey: { type: 'string' as const },
          },
          required: ['type', 'path'],
        },
      ],
      description: 'Data source configuration',
    },
    'widget-data-options': {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string' as const,
          enum: ['show', 'hide', 'enable', 'disable', 'require'],
        },
        actions: {
          type: 'array' as const,
          description: 'Sequential conditional rules (enable/disable first, then require)',
          items: {
            type: 'object' as const,
            properties: {
              action: {
                type: 'string' as const,
                enum: ['show', 'hide', 'enable', 'disable', 'require'],
              },
              condition: {
                type: 'object' as const,
                properties: {
                  field: { type: 'string' as const },
                  operator: {
                    type: 'string' as const,
                    enum: CONDITION_OPERATORS,
                  },
                  value: {},
                },
                required: ['field', 'operator'],
              },
            },
            required: ['action'],
          },
        },
        condition: {
          type: 'object' as const,
          properties: {
            field: { type: 'string' as const },
            operator: {
              type: 'string' as const,
              enum: CONDITION_OPERATORS,
            },
            value: {},
          },
          required: ['field', 'operator'],
        },
        minDate: { type: 'string' as const },
        maxDate: { type: 'string' as const },
        minDateField: { type: 'string' as const },
        maxDateField: { type: 'string' as const },
        minDateMessage: { type: 'string' as const },
        maxDateMessage: { type: 'string' as const },
        showCalendar: { type: 'boolean' as const },
      },
      description: 'Widget options and conditional logic',
    },
    'widget-data-placeholder': {
      type: 'string' as const,
      description: 'Placeholder text',
    },
    'widget-data-helptext': {
      type: 'string' as const,
      description: 'Help text',
    },
    'widget-data-tooltip': {
      type: 'string' as const,
      description: 'Tooltip text',
    },
    'widget-data-columns': {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          'column-key': { type: 'string' as const },
          'column-group': {
            type: 'string' as const,
            description: 'Groups dialog-table columns in a shared inner grid so conditional fields do not displace other rows',
          },
          'widget-label': { type: 'string' as const },
          widget: { type: 'string' as const },
          'widget-type': { type: 'string' as const },
          'widget-data-path': { type: 'string' as const },
          'widget-data-default': {},
          'widget-data-format': { type: 'object' as const },
          'widget-data-validation': { type: 'object' as const },
          'widget-data-source': { type: 'object' as const },
          'widget-data-placeholder': { type: 'string' as const },
          'widget-required': { type: 'boolean' as const },
          'widget-readonly': { type: 'boolean' as const },
        },
      },
      description: 'Table column definitions',
    },
    'widget-data-operations': {
      type: 'object' as const,
      properties: {
        add: { type: 'boolean' as const },
        remove: { type: 'boolean' as const },
        edit: { type: 'boolean' as const },
      },
      description: 'Array operations configuration',
    },
    'widget-data-add-label': {
      type: 'string' as const,
      description: 'Label for add button',
    },
    'widget-data-collapsed': {
      type: 'boolean' as const,
      description: 'Whether accordion is collapsed by default',
    },
    'widget-column-span': {
      type: 'number' as const,
      minimum: 1,
      description: 'Number of columns to span',
    },
    'widget-lookup-config': {
      type: 'object' as const,
      properties: {
        search_placeholder: {
          type: 'string' as const,
          description: 'Placeholder text for the popup search input',
        },
        page_size: {
          type: 'number' as const,
          minimum: 1,
          description: 'Number of records per page in search results',
        },
        action_label: {
          type: 'string' as const,
          description: 'Label for the empty-state search button (default: Select {widget-label})',
        },
        select_record_label: {
          type: 'string' as const,
          description: 'Label for the apply button in the lookup popup (default: Select {widget-label})',
        },
      },
      description: 'Register lookup widget configuration',
    },
    'widget-item': {
      type: 'object' as const,
      description: 'Item template for array widgets',
    },
    widgets: {
      type: 'array' as const,
      items: { type: 'object' as const },
      description: 'Nested widgets for layout widgets',
    },
    _comment: {
      type: 'string' as const,
      description: 'Comment/documentation',
    },
  },
  required: ['widget', 'widget-id'],
};

/**
 * Panel schema
 */
export const panelSchema = {
  type: 'object' as const,
  properties: {
    'panel-id': {
      type: 'string' as const,
      minLength: 1,
      description: 'Unique panel identifier',
    },
    'panel-orientation': {
      type: 'string' as const,
      enum: ORIENTATIONS,
      description: 'Panel orientation (horizontal or vertical)',
    },
    'panel-column-span': {
      type: 'number' as const,
      minimum: 1,
      description: 'Number of columns to span',
    },
    panels: {
      type: 'array' as const,
      items: { $ref: '#/definitions/panel' },
      description: 'Nested panels',
    },
    widgets: {
      type: 'array' as const,
      items: baseWidgetSchema,
      description: 'Widgets in this panel',
    },
  },
  required: ['panel-id'],
  definitions: {
    panel: {
      type: 'object' as const,
      properties: {
        'panel-id': {
          type: 'string' as const,
          minLength: 1,
        },
        'panel-orientation': {
          type: 'string' as const,
          enum: ORIENTATIONS,
        },
        'panel-column-span': {
          type: 'number' as const,
          minimum: 1,
        },
        panels: {
          type: 'array' as const,
          items: { $ref: '#/definitions/panel' },
        },
        widgets: {
          type: 'array' as const,
          items: baseWidgetSchema,
        },
      },
      required: ['panel-id'],
    },
  },
};

/**
 * Section schema
 */
export const sectionSchema = {
  type: 'object' as const,
  properties: {
    'section-id': {
      type: 'string' as const,
      minLength: 1,
      description: 'Unique section identifier',
    },
    'section-title': {
      type: 'string' as const,
      description: 'Section title',
    },
    'section-editable': {
      type: 'boolean' as const,
      description: 'Whether section is editable',
    },
    'section-hide-edit-button': {
      type: 'boolean' as const,
      description:
        'RegistryView only: when true, hides the Edit Details link for this section (per-section override).',
    },
    'section-column-span': {
      type: 'number' as const,
      minimum: 1,
      description: 'Number of columns to span',
    },
    'section-supporting-documents': {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          'document-data-path': { type: 'string' as const },
          'document-type': { type: 'string' as const },
          'document-required': { type: 'boolean' as const },
          'document-label': { type: 'string' as const },
          'document-accept': { type: 'string' as const },
          'document-max-size': { type: 'number' as const },
        },
        required: ['document-data-path'],
      },
      description: 'Supporting documents configuration',
    },
    panels: {
      type: 'array' as const,
      items: panelSchema,
      description: 'Panels in this section',
    },
  },
  required: ['section-id', 'panels'],
};

/**
 * Get schema for a specific context (section, panel, or widget)
 */
export function getSchemaForContext(context: 'section' | 'panel' | 'widget'): any {
  switch (context) {
    case 'section':
      return sectionSchema;
    case 'panel':
      return panelSchema;
    case 'widget':
      return baseWidgetSchema;
    default:
      return sectionSchema;
  }
}
