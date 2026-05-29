import { UISchema, SectionConfig, PanelConfig, BaseWidgetConfig } from '../types';

/**
 * Recursively translate widget configuration using translation keys
 * This utility helps transform a schema with translation keys into translated strings
 * 
 * @param widgetConfig - Widget configuration that may contain translation keys
 * @param translate - Translation function (from useWidgetTranslation or i18next)
 * @returns Translated widget configuration
 */
export const translateWidgetConfig = (
  widgetConfig: BaseWidgetConfig,
  translate: (key: string, options?: any) => string
): BaseWidgetConfig => {
  const translated: BaseWidgetConfig = { ...widgetConfig };

  // Helper to check if a string is a translation key
  const isTranslationKey = (str: string): boolean => {
    // Translation keys contain dots (e.g., "sections.personalDetails", "fields.name", "common.addItem")
    // or namespace prefix with colon (e.g., "namespace:key" for backward compatibility)
    return str.includes('.') || str.includes(':');
  };

  // Translate widget-label if it's a translation key
  if (translated['widget-label'] && typeof translated['widget-label'] === 'string') {
    const label = translated['widget-label'];
    if (isTranslationKey(label)) {
      translated['widget-label'] = translate(label, { defaultValue: label });
    }
  }

  // Translate placeholder
  if (translated['widget-data-placeholder'] && typeof translated['widget-data-placeholder'] === 'string') {
    const placeholder = translated['widget-data-placeholder'];
    if (isTranslationKey(placeholder)) {
      translated['widget-data-placeholder'] = translate(placeholder, { defaultValue: placeholder });
    }
  }

  // Translate helptext
  if (translated['widget-data-helptext'] && typeof translated['widget-data-helptext'] === 'string') {
    const helptext = translated['widget-data-helptext'];
    if (isTranslationKey(helptext)) {
      translated['widget-data-helptext'] = translate(helptext, { defaultValue: helptext });
    }
  }

  // Translate tooltip
  if (translated['widget-data-tooltip'] && typeof translated['widget-data-tooltip'] === 'string') {
    const tooltip = translated['widget-data-tooltip'];
    if (isTranslationKey(tooltip)) {
      translated['widget-data-tooltip'] = translate(tooltip, { defaultValue: tooltip });
    }
  }

  // Translate add-label
  if (translated['widget-data-add-label'] && typeof translated['widget-data-add-label'] === 'string') {
    const addLabel = translated['widget-data-add-label'];
    if (isTranslationKey(addLabel)) {
      translated['widget-data-add-label'] = translate(addLabel, { defaultValue: addLabel });
    }
  }

  // Translate column labels in table widgets
  if (translated['widget-data-columns'] && Array.isArray(translated['widget-data-columns'])) {
    translated['widget-data-columns'] = translated['widget-data-columns'].map((col) => {
      if (col['widget-label'] && typeof col['widget-label'] === 'string') {
        const colLabel = col['widget-label'];
        if (isTranslationKey(colLabel)) {
          return {
            ...col,
            'widget-label': translate(colLabel, { defaultValue: colLabel }),
          };
        }
      }
      return col;
    });
  }

  // Translate nested widgets
  if (translated.widgets && Array.isArray(translated.widgets)) {
    translated.widgets = translated.widgets.map((widget) =>
      translateWidgetConfig(widget, translate)
    );
  }

  // Translate widget-item (for array/accordion widgets)
  if (translated['widget-item']) {
    translated['widget-item'] = translateWidgetConfig(translated['widget-item'], translate);
  }

  // Translate static data source labels
  const dataSource = translated['widget-data-source'];
  if (dataSource && typeof dataSource === 'object' && 'type' in dataSource) {
    if (dataSource.type === 'static' && 'options' in dataSource && Array.isArray(dataSource.options)) {
      translated['widget-data-source'] = {
        ...dataSource,
        options: dataSource.options.map((option: { value: string | number; label: string }) => {
          if (option.label && typeof option.label === 'string') {
            const optionLabel = option.label;
            if (isTranslationKey(optionLabel)) {
              return {
                ...option,
                label: translate(optionLabel, { defaultValue: optionLabel }),
              };
            }
          }
          return option;
        }),
      };
    }
  }

  return translated;
};

/**
 * Recursively translate panel configuration
 */
export const translatePanelConfig = (
  panel: PanelConfig,
  translate: (key: string, options?: any) => string
): PanelConfig => {
  const translated: PanelConfig = { ...panel };

  // Translate nested panels
  if (translated.panels && Array.isArray(translated.panels)) {
    translated.panels = translated.panels.map((p) => translatePanelConfig(p, translate));
  }

  // Translate widgets in panel
  if (translated.widgets && Array.isArray(translated.widgets)) {
    translated.widgets = translated.widgets.map((widget) =>
      translateWidgetConfig(widget, translate)
    );
  }

  return translated;
};

/**
 * Translate entire UI Schema
 * 
 * @param schema - UI Schema with potential translation keys
 * @param translate - Translation function
 * @returns Translated UI Schema
 */
export const translateUISchema = (
  schema: UISchema,
  translate: (key: string, options?: any) => string
): UISchema => {
  return {
    ...schema,
    sections: schema.sections.map((section) => {
      const translatedSection: SectionConfig = { ...section };

      // Translate section-title
      if (translatedSection['section-title'] && typeof translatedSection['section-title'] === 'string') {
        const title = translatedSection['section-title'];
        // Check if it's a translation key (contains dots or namespace prefix)
        if (title.includes('.') || title.includes(':')) {
          translatedSection['section-title'] = translate(title, { defaultValue: title });
        }
      }

      // Translate panels
      if (translatedSection.panels && Array.isArray(translatedSection.panels)) {
        translatedSection.panels = translatedSection.panels.map((panel) =>
          translatePanelConfig(panel, translate)
        );
      }

      return translatedSection;
    }),
  };
};
