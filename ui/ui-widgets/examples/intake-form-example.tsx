/**
 * IntakeForm Mode Example
 *
 * Mirrors the host application's MultiSectionAccordionForms component pattern.
 * Section schemas are loaded from example-ui-schema/; this file only holds data and UI wiring.
 */

import { useMemo, useState } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionChanges } from '../src/components/SectionRenderer';
import type { SectionsFormHandle } from '../src/components/SectionsContainer';
import { intakeFormSections } from './shared/exampleSchemas';
import { recordSampleSchemaData } from './shared/exampleData';
import { createExampleDataSourceHandler } from './shared/mockDataSourceHandler';

export const IntakeFormExample = () => {
  const store = useMemo(() => createWidgetStore(), []);
  const schemaData = useMemo(() => recordSampleSchemaData, []);
  const dataSourceRequestHandler = useMemo(() => createExampleDataSourceHandler(), []);
  const [formHandle, setFormHandle] = useState<SectionsFormHandle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showActions = true;

  const handleSectionSave = async (changes: SectionChanges) => {
    console.log('Section saved (per-section):', changes);
  };

  const handleCancel = () => {
    console.log('Cancel clicked');
    alert('Cancel clicked — would navigate back');
  };

  const handleSubmit = async () => {
    if (!formHandle) return;
    setIsSubmitting(true);
    try {
      const sections = await formHandle.validateAndGetData();
      console.log('All sections data:', sections);
      alert(`Form submitted! Check console for data.\nSections: ${sections.length}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Submit failed';
      console.warn(msg, e);
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <WidgetProvider store={store} schemaData={schemaData} dataSourceRequestHandler={dataSourceRequestHandler}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
      }}>
        <h1 style={{ fontSize: '24px', fontFamily: 'Roboto, sans-serif', marginBottom: '8px' }}>
          Intake Form
        </h1>

        <SectionsContainer
          sections={intakeFormSections}
          mode="IntakeForm"
          isDraft={showActions}
          onSectionSave={handleSectionSave}
          onFormReady={setFormHandle}
        />

        {showActions && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
          }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '10px 32px',
                borderRadius: '9999px',
                background: '#E1E1E1',
                color: '#717171',
                fontWeight: 700,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!formHandle || isSubmitting}
              style={{
                padding: '10px 32px',
                borderRadius: '9999px',
                background: formHandle && !isSubmitting ? '#000' : '#9ca3af',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                border: 'none',
                cursor: formHandle && !isSubmitting ? 'pointer' : 'not-allowed',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        )}
      </div>
    </WidgetProvider>
  );
};

export default IntakeFormExample;
