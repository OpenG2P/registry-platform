/**
 * Standalone example showing how to use JSONEditorPanel in a host application
 * Run with: npx vite (after setting up vite.config.ts)
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JSONEditorPanel } from '../src/components/SectionBuilder';
import { SectionConfig } from '../src/types';

// Example section data
const initialSection: SectionConfig = {
  'section-id': 'example-section',
  'section-title': 'Example Section',
  'section-editable': true,
  panels: [
    {
      'panel-id': 'personal-details',
      'panel-orientation': 'horizontal',
      panels: [
        {
          'panel-id': 'left-column',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'text',
              'widget-type': 'input',
              'widget-id': 'name',
              'widget-label': 'Full Name',
              'widget-data-path': 'person.name',
              'widget-required': true,
            },
            {
              widget: 'text',
              'widget-type': 'input',
              'widget-id': 'email',
              'widget-label': 'Email Address',
              'widget-data-path': 'person.email',
              'widget-data-validation': {
                validationType: 'email',
                required: true,
              },
            },
          ],
        },
        {
          'panel-id': 'right-column',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'number',
              'widget-type': 'input',
              'widget-id': 'age',
              'widget-label': 'Age',
              'widget-data-path': 'person.age',
              'widget-data-validation': {
                min: 0,
                max: 120,
              },
            },
            {
              widget: 'date',
              'widget-type': 'input',
              'widget-id': 'dob',
              'widget-label': 'Date of Birth',
              'widget-data-path': 'person.dob',
            },
          ],
        },
      ],
    },
  ],
};

function App() {
  const [section, setSection] = useState<SectionConfig>(initialSection);

  const handleChange = (updatedSection: SectionConfig) => {
    setSection(updatedSection);
    console.log('Section updated:', updatedSection);
  };

  const handleSave = () => {
    console.log('Saving section:', section);
    // In a real application, you would save this to your backend
    // For this example, we'll just log it and show an alert
    localStorage.setItem('section-config', JSON.stringify(section, null, 2));
    alert('Section saved! Check console and localStorage for the JSON output.');
  };

  const handleReset = () => {
    setSection(initialSection);
  };

  const handleExport = () => {
    const jsonString = JSON.stringify(section, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'section-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header with actions */}
      <div style={{
        padding: '15px 20px',
        background: '#f8f9fa',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>Section Configuration Editor</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleReset}
            style={{ 
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Reset
          </button>
          <button 
            onClick={handleExport}
            style={{ 
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Export JSON
          </button>
          <button 
            onClick={handleSave} 
            style={{ 
              background: '#007bff', 
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* JSON Editor - takes full remaining height */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <JSONEditorPanel 
          section={section} 
          onChange={handleChange} 
        />
      </div>
    </div>
  );
}

// Render the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
