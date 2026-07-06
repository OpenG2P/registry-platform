/**
 * Change Request — side-by-side old vs new section values (CRView mode).
 * Mirrors the host ChangeRequestValuesTabs pattern.
 */

import React, { useMemo } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionRenderer } from '../src';
import { changeRequestSection } from './shared/exampleSchemas';
import { changeRequestNewData, changeRequestOldData } from './shared/exampleData';

export const ChangeRequestExample = () => {
  const storeNew = useMemo(() => createWidgetStore(), []);
  const storeOld = useMemo(() => createWidgetStore(), []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px',
    }}>
      <h1 style={{ fontSize: '24px', fontFamily: 'Roboto, sans-serif', margin: 0 }}>
        Change Request
      </h1>

      <WidgetProvider store={storeNew} schemaData={changeRequestNewData}>
        <SectionRenderer
          section={changeRequestSection}
          schemaData={changeRequestNewData}
          hideEditButton
          mode="CRView"
          changeRequestType="new"
        />
      </WidgetProvider>

      <WidgetProvider store={storeOld} schemaData={changeRequestOldData}>
        <SectionRenderer
          section={changeRequestSection}
          schemaData={changeRequestOldData}
          hideEditButton
          mode="CRView"
          changeRequestType="old"
        />
      </WidgetProvider>
    </div>
  );
};

export default ChangeRequestExample;
