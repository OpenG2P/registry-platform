/**
 * Special Sections — header, scores, ID authentication, register lookup, dialog table.
 */

import React, { useCallback, useMemo } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionChanges } from '../src/components/SectionRenderer';
import { specialSections } from './shared/exampleSchemas';
import { specialSectionsSchemaData } from './shared/exampleData';
import { createExampleDataSourceHandler } from './shared/mockDataSourceHandler';

const translations: Record<string, string> = {
  'Functional Record ID': 'Functional Record ID',
  'Record Status': 'Record Status',
  'Status Reason': 'Status Reason',
  'Select': 'Select',
  'Enter Reason': 'Enter Reason',
  'Created by': 'Created by',
  'Created at': 'Created at',
  'Last Approved by': 'Last Approved by',
  'Last Approved at': 'Last Approved at',
};

export const SpecialSectionsExample = () => {
  const store = useMemo(() => createWidgetStore(), []);
  const dataSourceRequestHandler = useMemo(() => createExampleDataSourceHandler(), []);

  const translateFn = useCallback(
    (key: string, options?: { defaultValue?: string }) =>
      translations[key] || options?.defaultValue || key,
    [],
  );

  const handleSectionSave = async (changes: SectionChanges) => {
    console.log('Section saved:', changes);
    alert(`Section "${changes.section_id}" saved! Check console for payload.`);
  };

  return (
    <WidgetProvider
      store={store}
      schemaData={specialSectionsSchemaData}
      t={translateFn}
      dataSourceRequestHandler={dataSourceRequestHandler}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
      }}>
        <h1 style={{ fontSize: '24px', fontFamily: 'Roboto, sans-serif', marginBottom: '8px' }}>
          Special Sections
        </h1>

        <SectionsContainer
          sections={specialSections}
          schemaData={specialSectionsSchemaData}
          mode="RegistryView"
          onSectionSave={handleSectionSave}
        />
      </div>
    </WidgetProvider>
  );
};

export default SpecialSectionsExample;
