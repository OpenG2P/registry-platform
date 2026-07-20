/**
 * Register Sections — multi-section RegistryView layout.
 * Schemas from example-ui-schema/; sample record data only in this file.
 */

import React, { useMemo } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionChanges } from '../src/components/SectionRenderer';
import { registerSections } from './shared/exampleSchemas';
import { recordSampleSchemaData } from './shared/exampleData';
import { createExampleDataSourceHandler } from './shared/mockDataSourceHandler';

export const RegisterSectionsExample = () => {
  const store = useMemo(() => createWidgetStore(), []);
  const dataSourceRequestHandler = useMemo(() => createExampleDataSourceHandler(), []);

  const handleSectionSave = async (changes: SectionChanges) => {
    console.log('Section saved:', changes);
    alert(`Section "${changes.section_id}" saved! Check console for payload.`);
  };

  return (
    <WidgetProvider store={store} schemaData={recordSampleSchemaData} dataSourceRequestHandler={dataSourceRequestHandler}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
      }}>
        <h1 style={{ fontSize: '24px', fontFamily: 'Roboto, sans-serif', marginBottom: '8px' }}>
          Register Sections
        </h1>

        <SectionsContainer
          sections={registerSections}
          schemaData={recordSampleSchemaData}
          mode="RegistryView"
          onSectionSave={handleSectionSave}
        />
      </div>
    </WidgetProvider>
  );
};

export default RegisterSectionsExample;
