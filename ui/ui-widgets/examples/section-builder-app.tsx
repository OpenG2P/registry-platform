/**
 * Standalone app to run SectionBuilder example
 * Run with: npm run example:dev
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { SectionBuilder } from '../src/components/SectionBuilder';
import { IntakeFormExample } from './intake-form-example';
import { RegisterSectionsExample } from './register-sections-example';
import { ChangeRequestExample } from './change-request-example';
import { SpecialSectionsExample } from './special-sections-example';
import { ThemeExample } from './theme-example';
import { WidgetsExample } from './widgets-example';
import { SectionConfig } from '../src/types';
import { createWidgetStore } from '../src/store';
import { WidgetProvider } from '../src/components/WidgetProvider';
import { sectionBuilderInitialSection } from './shared/exampleSchemas';

const store = createWidgetStore();

type TabId =
  | 'section-builder'
  | 'register-sections'
  | 'change-request'
  | 'intake-form'
  | 'special-sections'
  | 'widgets'
  | 'theme';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'section-builder', label: 'Section Builder' },
  { id: 'register-sections', label: 'Register Sections' },
  { id: 'change-request', label: 'Change Request' },
  { id: 'intake-form', label: 'Intake Form' },
  { id: 'special-sections', label: 'Special Sections' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'theme', label: 'Theme' },
];

function App() {
  const [section, setSection] = useState<SectionConfig>(sectionBuilderInitialSection);
  const [activeTab, setActiveTab] = useState<TabId>('section-builder');

  const handleSectionChange = (updatedSection: SectionConfig) => {
    setSection(updatedSection);
    console.log('Section updated:', updatedSection);
  };

  const handleSave = (savedSection: SectionConfig) => {
    console.log('Section saved:', savedSection);
    alert('Section saved! Check console for JSON output.');
  };

  return (
    <Provider store={store}>
      <WidgetProvider store={store}>
        <div style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#f5f5f5',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 20px',
            background: '#fff',
            borderBottom: '1px solid #e5e5e5',
            flexWrap: 'wrap',
          }}>
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                style={{
                  padding: '8px 16px',
                  fontWeight: activeTab === id ? 600 : 400,
                  background: activeTab === id ? '#e5e7eb' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}>
            {activeTab === 'section-builder' && (
              <div style={{
                width: '100%',
                maxWidth: '1400px',
                margin: '0 auto',
                flex: '1 1 0',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <SectionBuilder
                  initialSection={section}
                  onChange={handleSectionChange}
                  onSave={handleSave}
                />
              </div>
            )}
            {activeTab === 'register-sections' && <RegisterSectionsExample />}
            {activeTab === 'change-request' && <ChangeRequestExample />}
            {activeTab === 'intake-form' && <IntakeFormExample />}
            {activeTab === 'special-sections' && <SpecialSectionsExample />}
            {activeTab === 'widgets' && <WidgetsExample />}
            {activeTab === 'theme' && <ThemeExample />}
          </div>
        </div>
      </WidgetProvider>
    </Provider>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
