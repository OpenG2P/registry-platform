import React, { useState } from 'react';
import { SectionBuilder } from '../src/components/SectionBuilder';
import { SectionConfig } from '../src/types';

/**
 * Example page demonstrating the Section Builder component
 */
export const SectionBuilderExample: React.FC = () => {
  const [section, setSection] = useState<SectionConfig>({
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
                'widget-readonly': false,
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
      {
        'panel-id': 'address-section',
        'panel-orientation': 'vertical',
        widgets: [
          {
            widget: 'textarea',
            'widget-type': 'input',
            'widget-id': 'address',
            'widget-label': 'Address',
            'widget-data-path': 'person.address',
            'widget-data-format': {
              rows: 3,
            },
          },
        ],
      },
    ],
  });

  const handleSectionChange = (updatedSection: SectionConfig) => {
    setSection(updatedSection);
    console.log('Section updated:', updatedSection);
  };

  const handleSave = (savedSection: SectionConfig) => {
    console.log('Section saved:', savedSection);
    alert('Section saved! Check console for JSON output.');
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      background: '#f5f5f5',
    }}>
      <div style={{ 
        width: '100%',
        maxWidth: '1400px',
        height: '100vh',
        margin: '0 auto',
      }}>
        <SectionBuilder
          initialSection={section}
          onChange={handleSectionChange}
          onSave={handleSave}
        />
      </div>
    </div>
  );
};

/**
 * Minimal example with empty section
 */
export const SectionBuilderMinimalExample: React.FC = () => {
  const [section, setSection] = useState<SectionConfig>({
    'section-id': 'new-section',
    'section-title': 'New Section',
    'section-editable': false,
    panels: [],
  });

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      background: '#f5f5f5',
    }}>
      <div style={{ 
        width: '100%',
        maxWidth: '1400px',
        height: '100vh',
        margin: '0 auto',
      }}>
        <SectionBuilder
          initialSection={section}
          onChange={setSection}
        />
      </div>
    </div>
  );
};

/**
 * Example with pre-populated complex section
 */
export const SectionBuilderComplexExample: React.FC = () => {
  const [section, setSection] = useState<SectionConfig>({
    'section-id': 'complex-section',
    'section-title': 'Complex Form Section',
    'section-editable': true,
    'section-column-span': 2,
    panels: [
      {
        'panel-id': 'header-panel',
        'panel-orientation': 'horizontal',
        'panel-column-span': 2,
        panels: [
          {
            'panel-id': 'profile-panel',
            'panel-orientation': 'vertical',
            widgets: [
              {
                widget: 'profile',
                'widget-type': 'layout',
                'widget-id': 'user-profile',
                'widget-label': 'User Profile',
                'widget-data-path': 'user',
              },
            ],
          },
          {
            'panel-id': 'details-panel',
            'panel-orientation': 'vertical',
            widgets: [
              {
                widget: 'text',
                'widget-id': 'username',
                'widget-label': 'Username',
                'widget-data-path': 'user.username',
                'widget-required': true,
              },
              {
                widget: 'select',
                'widget-id': 'country',
                'widget-label': 'Country',
                'widget-data-path': 'user.country',
                'widget-data-source': {
                  type: 'static',
                  options: [
                    { value: 'us', label: 'United States' },
                    { value: 'uk', label: 'United Kingdom' },
                    { value: 'ca', label: 'Canada' },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        'panel-id': 'form-panel',
        'panel-orientation': 'vertical',
        widgets: [
          {
            widget: 'text',
            'widget-id': 'phone',
            'widget-label': 'Phone Number',
            'widget-data-path': 'contact.phone',
            'widget-data-format': {
              inputType: 'tel',
            },
            'widget-data-validation': {
              validationType: 'phone',
            },
          },
          {
            widget: 'currency',
            'widget-id': 'salary',
            'widget-label': 'Salary',
            'widget-data-path': 'employment.salary',
            'widget-data-format': {
              currency: 'USD',
              decimals: 2,
            },
          },
          {
            widget: 'boolean',
            'widget-id': 'agreement',
            'widget-label': 'I agree to the terms',
            'widget-data-path': 'agreement.accepted',
            'widget-required': true,
            'widget-data-format': {
              booleanControlType: 'checkbox',
            },
          },
        ],
      },
      {
        'panel-id': 'table-panel',
        'panel-orientation': 'vertical',
        widgets: [
          {
            widget: 'table',
            'widget-id': 'data-table',
            'widget-label': 'Data Table',
            'widget-data-path': 'tableData',
            'widget-column-span': 2,
            'widget-data-columns': [
              {
                'column-key': 'name',
                'widget-label': 'Name',
                widget: 'text',
              },
              {
                'column-key': 'value',
                'widget-label': 'Value',
                widget: 'number',
              },
            ],
          },
        ],
      },
    ],
  });

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      background: '#f5f5f5',
    }}>
      <div style={{ 
        width: '100%',
        maxWidth: '1400px',
        height: '100vh',
        margin: '0 auto',
      }}>
        <SectionBuilder
          initialSection={section}
          onChange={setSection}
        />
      </div>
    </div>
  );
};

export default SectionBuilderExample;
