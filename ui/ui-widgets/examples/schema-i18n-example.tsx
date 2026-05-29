/**
 * Example: Using i18n with UISchema.json
 * 
 * This example shows how to use translation keys in your UISchema
 * and provide translations via WidgetProvider
 */

import React from 'react';
import { WidgetProvider, SectionRenderer, useWidgetTranslation } from '@openg2p/react-widgets';
import type { UISchema } from '@openg2p/react-widgets';

// Example UISchema with translation keys
const uiSchemaWithTranslationKeys: UISchema = {
  sections: [
    {
      'section-id': 'personal-details',
      'section-title': 'sections.personalDetails', // Translation key (no widgets: prefix)
      'section-editable': false,
      panels: [
        {
          'panel-id': 'main-panel',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'text',
              'widget-type': 'input',
              'widget-label': 'fields.name', // Translation key
              'widget-id': 'name',
              'widget-data-path': 'person.name',
              'widget-required': true,
              'widget-data-placeholder': 'placeholders.enterName', // Translation key
              'widget-data-helptext': 'help.nameHelp', // Translation key
            },
            {
              widget: 'select',
              'widget-type': 'input',
              'widget-label': 'fields.country', // Translation key
              'widget-id': 'country',
              'widget-data-path': 'address.country',
              'widget-data-source': {
                type: 'static',
                options: [
                  {
                    value: 'us',
                    label: 'countries.us', // Translation key
                  },
                  {
                    value: 'uk',
                    label: 'countries.uk', // Translation key
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
};

// Translation resources
// Note: widgets is just one namespace among others
const translations = {
  en: {
    translation: {
      sections: {
        personalDetails: 'Personal Details',
        contactInfo: 'Contact Information',
      },
      fields: {
        name: 'Name',
        email: 'Email Address',
        country: 'Country',
      },
      placeholders: {
        enterName: 'Enter your name',
        enterEmail: 'Enter email address',
      },
      help: {
        nameHelp: 'Enter your full legal name',
        emailHelp: 'We will use this for notifications',
      },
      countries: {
        us: 'United States',
        uk: 'United Kingdom',
        in: 'India',
        ca: 'Canada',
      },
      // Widget-specific translations (for built-in UI strings)
      widgets: {
        common: {
          addItem: 'Add Item',
          remove: 'Remove',
          addRow: 'Add Row',
          actions: 'Actions',
          loading: 'Loading...',
          required: '*',
        },
        errors: {
          required: 'This field is required',
        },
      },
    },
  },
  es: {
    translation: {
      sections: {
        personalDetails: 'Detalles Personales',
        contactInfo: 'Información de Contacto',
      },
      fields: {
        name: 'Nombre',
        email: 'Dirección de Correo',
        country: 'País',
      },
      placeholders: {
        enterName: 'Ingrese su nombre',
        enterEmail: 'Ingrese dirección de correo',
      },
      help: {
        nameHelp: 'Ingrese su nombre legal completo',
        emailHelp: 'Usaremos esto para notificaciones',
      },
      countries: {
        us: 'Estados Unidos',
        uk: 'Reino Unido',
        in: 'India',
        ca: 'Canadá',
      },
      widgets: {
        common: {
          addItem: 'Agregar Elemento',
          remove: 'Eliminar',
          addRow: 'Agregar Fila',
          actions: 'Acciones',
          loading: 'Cargando...',
          required: '*',
        },
        errors: {
          required: 'Este campo es obligatorio',
        },
      },
    },
  },
};

// Language switcher component
function LanguageSwitcher() {
  const { changeLanguage, getLanguage } = useWidgetTranslation();

  return (
    <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
      <p>Current Language: {getLanguage()}</p>
      <button onClick={() => changeLanguage('en')} style={{ marginRight: '10px' }}>
        English
      </button>
      <button onClick={() => changeLanguage('es')}>Español</button>
    </div>
  );
}

// Main App component
export function SchemaI18nExample() {
  return (
    <WidgetProvider
      i18nConfig={{
        resources: translations,
        lng: 'en',
        fallbackLng: 'en',
      }}
    >
      <div style={{ padding: '20px' }}>
        <h1>i18n with UISchema Example</h1>
        <LanguageSwitcher />
        
        {/* Render sections from schema */}
        {uiSchemaWithTranslationKeys.sections.map((section) => (
          <SectionRenderer key={section['section-id']} section={section} />
        ))}
      </div>
    </WidgetProvider>
  );
}

/**
 * Alternative: Using direct strings (backward compatible)
 * 
 * You can still use direct strings in your schema, and they will work as before.
 * Translation keys are optional.
 */
const uiSchemaWithDirectStrings: UISchema = {
  sections: [
    {
      'section-id': 'personal-details',
      'section-title': 'Personal Details', // Direct string - still works!
      'section-editable': false,
      panels: [
        {
          'panel-id': 'main-panel',
          widgets: [
            {
              widget: 'text',
              'widget-type': 'input',
              'widget-label': 'Name', // Direct string - still works!
              'widget-id': 'name',
              'widget-data-path': 'person.name',
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Alternative: Mixed approach
 * 
 * You can mix translation keys and direct strings in the same schema.
 * Translation keys will be translated, direct strings will be used as-is.
 */
const uiSchemaMixed: UISchema = {
  sections: [
    {
      'section-id': 'personal-details',
      'section-title': 'sections.personalDetails', // Translation key
      panels: [
        {
          'panel-id': 'main-panel',
          widgets: [
            {
              widget: 'text',
              'widget-type': 'input',
              'widget-label': 'Name', // Direct string
              'widget-id': 'name',
              'widget-data-path': 'person.name',
              'widget-data-placeholder': 'placeholders.enterName', // Translation key
            },
          ],
        },
      ],
    },
  ],
};
