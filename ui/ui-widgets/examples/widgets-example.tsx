/**
 * Widgets — explore all input widget types across three demo sections.
 */

import React, { useMemo } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionChanges } from '../src/components/SectionRenderer';
import { widgetExploreSections } from './shared/exampleSchemas';
import { widgetExploreSampleData } from './shared/exampleData';

export const WidgetsExample = () => {
  const store = useMemo(() => createWidgetStore(), []);

  const handleSectionSave = async (changes: SectionChanges) => {
    console.log('Section saved:', changes);
    alert(`Section "${changes.section_id}" saved! Check console for payload.`);
  };

  return (
    <WidgetProvider store={store} schemaData={widgetExploreSampleData}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
      }}>
        <h1 style={{ fontSize: '24px', fontFamily: 'Roboto, sans-serif', marginBottom: '8px' }}>
          Widgets
        </h1>

        <SectionsContainer
          sections={widgetExploreSections}
          schemaData={widgetExploreSampleData}
          mode="RegistryView"
          onSectionSave={handleSectionSave}
        />
      </div>
    </WidgetProvider>
  );
};

export default WidgetsExample;
