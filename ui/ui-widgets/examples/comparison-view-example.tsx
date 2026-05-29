/**
 * Example: Displaying the same section schema with different data
 * Use case: CR detail page showing old record vs new CR side by side
 */

import React from 'react';
import {
  WidgetProvider,
  SectionsContainer,
  createWidgetStore,
} from '@openg2p/react-widgets';
import { SectionConfig } from '../src/types';
import type { SectionMode } from '../src/components/SectionsContainer';

// Example section schema (same for both old and new)
const exampleSectionSchema: SectionConfig = {
  'section-id': 'personal-info',
  'section-title': 'Personal Information',
  panels: [
    {
      'panel-id': 'basic-info',
      'panel-orientation': 'vertical',
      widgets: [
        {
          widget: 'text-input',
          'widget-type': 'input',
          'widget-label': 'First Name',
          'widget-id': 'first-name',
          'widget-data-path': 'firstName',
          'widget-readonly': true, // Read-only for comparison view
        },
        {
          widget: 'text-input',
          'widget-type': 'input',
          'widget-label': 'Last Name',
          'widget-id': 'last-name',
          'widget-data-path': 'lastName',
          'widget-readonly': true,
        },
        {
          widget: 'text-input',
          'widget-type': 'input',
          'widget-label': 'Email',
          'widget-id': 'email',
          'widget-data-path': 'email',
          'widget-readonly': true,
        },
        {
          widget: 'phone-input',
          'widget-type': 'input',
          'widget-label': 'Phone Number',
          'widget-id': 'phone',
          'widget-data-path': 'phone',
          'widget-readonly': true,
        },
      ],
    },
  ],
};

// Old record data
const oldRecordData = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+1234567890',
};

// New CR data
const newCRData = {
  firstName: 'John',
  lastName: 'Smith', // Changed
  email: 'john.smith@example.com', // Changed
  phone: '+1234567890',
};

/**
 * Approach 1: Two separate WidgetProviders (Recommended)
 * Each provider has its own Redux store, so data is completely isolated
 */
export const ComparisonViewWithSeparateProviders = () => {
  // Create separate stores for old and new data
  const oldRecordStore = React.useMemo(() => createWidgetStore(), []);
  const newCRStore = React.useMemo(() => createWidgetStore(), []);

  return (
    <div className="comparison-container" style={{ display: 'flex', gap: '2rem', padding: '2rem' }}>
      {/* Old Record Section */}
      <div className="old-record-section" style={{ flex: 1 }}>
        <h2 className="section-header" style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
          Old Record
        </h2>
        <WidgetProvider store={oldRecordStore} schemaData={oldRecordData}>
          <SectionsContainer sections={[exampleSectionSchema]} hideEditButton={true} />
        </WidgetProvider>
      </div>

      {/* New CR Section */}
      <div className="new-cr-section" style={{ flex: 1 }}>
        <h2 className="section-header" style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
          New CR
        </h2>
        <WidgetProvider store={newCRStore} schemaData={newCRData}>
          <SectionsContainer sections={[exampleSectionSchema]} hideEditButton={true} />
        </WidgetProvider>
      </div>
    </div>
  );
};

/**
 * Approach 2: Single WidgetProvider with namespace prefix
 * Use data path prefixes to separate old and new data in the same store
 * Note: This requires modifying data paths in the schema
 */
export const ComparisonViewWithNamespacedData = () => {
  const store = React.useMemo(() => createWidgetStore(), []);

  // Create modified schemas with namespace prefixes
  const oldRecordSection: SectionConfig = {
    ...exampleSectionSchema,
    'section-id': 'old-personal-info',
    panels: exampleSectionSchema.panels.map(panel => ({
      ...panel,
      widgets: panel.widgets?.map(widget => ({
        ...widget,
        'widget-data-path': `old.${widget['widget-data-path']}`,
        'widget-id': `old-${widget['widget-id']}`,
      })),
    })),
  };

  const newCRSection: SectionConfig = {
    ...exampleSectionSchema,
    'section-id': 'new-personal-info',
    panels: exampleSectionSchema.panels.map(panel => ({
      ...panel,
      widgets: panel.widgets?.map(widget => ({
        ...widget,
        'widget-data-path': `new.${widget['widget-data-path']}`,
        'widget-id': `new-${widget['widget-id']}`,
      })),
    })),
  };

  // Combined data with namespace prefixes
  const combinedData = {
    old: oldRecordData,
    new: newCRData,
  };

  return (
    <WidgetProvider store={store} schemaData={combinedData}>
      <div className="comparison-container" style={{ display: 'flex', gap: '2rem', padding: '2rem' }}>
        <div className="old-record-section" style={{ flex: 1 }}>
          <h2 className="section-header" style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
            Old Record
          </h2>
          <SectionsContainer sections={[oldRecordSection]} hideEditButton={true} />
        </div>

        <div className="new-cr-section" style={{ flex: 1 }}>
          <h2 className="section-header" style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
            New CR
          </h2>
          <SectionsContainer sections={[newCRSection]} hideEditButton={true} />
        </div>
      </div>
    </WidgetProvider>
  );
};

/**
 * Approach 3: Reusable Comparison Component
 * A more flexible component that can be used for any section comparison
 */
interface ComparisonSectionProps {
  section: SectionConfig;
  oldData: Record<string, any>;
  newData: Record<string, any>;
  oldLabel?: string;
  newLabel?: string;
  className?: string;
}

export const ComparisonSection: React.FC<ComparisonSectionProps> = ({
  section,
  oldData,
  newData,
  oldLabel = 'Old Record',
  newLabel = 'New CR',
  className = '',
}) => {
  const oldStore = React.useMemo(() => createWidgetStore(), []);
  const newStore = React.useMemo(() => createWidgetStore(), []);

  return (
    <div className={`comparison-section ${className}`} style={{ display: 'flex', gap: '2rem', padding: '2rem' }}>
        <div className="old-record-section" style={{ flex: 1 }}>
          <h2 className="section-header" style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
            {oldLabel}
          </h2>
          <WidgetProvider store={oldStore} schemaData={oldData}>
            <SectionsContainer sections={[section]} hideEditButton={true} />
          </WidgetProvider>
        </div>

        <div className="new-cr-section" style={{ flex: 1 }}>
          <h2 className="section-header" style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
            {newLabel}
          </h2>
          <WidgetProvider store={newStore} schemaData={newData}>
            <SectionsContainer sections={[section]} hideEditButton={true} />
          </WidgetProvider>
        </div>
    </div>
  );
};

/**
 * Usage example with multiple sections
 */
export const CRDetailPageExample = () => {
  // Multiple sections to compare
  const personalInfoSection: SectionConfig = {
    'section-id': 'personal-info',
    'section-title': 'Personal Information',
    panels: [
      {
        'panel-id': 'basic-info',
        'panel-orientation': 'vertical',
        widgets: [
          {
            widget: 'text-input',
            'widget-type': 'input',
            'widget-label': 'First Name',
            'widget-id': 'first-name',
            'widget-data-path': 'firstName',
            'widget-readonly': true,
          },
          {
            widget: 'text-input',
            'widget-type': 'input',
            'widget-label': 'Last Name',
            'widget-id': 'last-name',
            'widget-data-path': 'lastName',
            'widget-readonly': true,
          },
        ],
      },
    ],
  };

  const addressSection: SectionConfig = {
    'section-id': 'address',
    'section-title': 'Address',
    panels: [
      {
        'panel-id': 'address-info',
        'panel-orientation': 'vertical',
        widgets: [
          {
            widget: 'text-input',
            'widget-type': 'input',
            'widget-label': 'Street',
            'widget-id': 'street',
            'widget-data-path': 'address.street',
            'widget-readonly': true,
          },
          {
            widget: 'text-input',
            'widget-type': 'input',
            'widget-label': 'City',
            'widget-id': 'city',
            'widget-data-path': 'address.city',
            'widget-readonly': true,
          },
        ],
      },
    ],
  };

  const oldRecord = {
    firstName: 'John',
    lastName: 'Doe',
    address: {
      street: '123 Main St',
      city: 'New York',
    },
  };

  const newCR = {
    firstName: 'John',
    lastName: 'Smith',
    address: {
      street: '456 Oak Ave',
      city: 'Los Angeles',
    },
  };

  return (
    <div className="cr-detail-page" style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>CR Detail Page</h1>
      
      {/* Personal Info Comparison */}
      <ComparisonSection
        section={personalInfoSection}
        oldData={oldRecord}
        newData={newCR}
        oldLabel="Old Record"
        newLabel="New CR"
        className="mb-8"
      />

      {/* Address Comparison */}
      <ComparisonSection
        section={addressSection}
        oldData={oldRecord}
        newData={newCR}
        oldLabel="Old Record"
        newLabel="New CR"
      />
    </div>
  );
};

/**
 * Key Points:
 * 
 * 1. **Separate Stores (Recommended)**: Each WidgetProvider has its own Redux store,
 *    ensuring complete data isolation between old and new records.
 * 
 * 2. **Same Schema**: You can reuse the same section schema for both old and new,
 *    just pass different data via the `schemaData` prop.
 * 
 * 3. **Read-only Mode**: Set `widget-readonly: true` in the schema to prevent
 *    editing in comparison views.
 * 
 * 4. **Flexible Layout**: Use CSS flexbox/grid to arrange old and new sections
 *    side by side or in any layout you prefer.
 * 
 * 5. **Performance**: Creating stores with useMemo ensures they're only created once
 *    per component instance, preventing unnecessary re-renders.
 * 
 * 6. **Hide Edit Button**: Use `hideEditButton={true}` prop on `SectionsContainer` to
 *    hide the edit button band below sections. This is useful for comparison views
 *    where you don't want editing functionality.
 * 
 * 7. **Mode Selection**: Use `mode` prop to switch between 'RegistryView' (default)
 *    and 'CRView'. CRView displays "Created by", "Created Date", "Approved by", and
 *    "Approved Date" information at the bottom of sections.
 */

/**
 * Example: Using CRView mode
 * CRView data is read from schemaData with keys: createdBy, createdDate, approvedBy, approvedDate
 */
export const CRViewExample = () => {
  const store = React.useMemo(() => createWidgetStore(), []);

  // Include CRView data in schemaData
  const schemaDataWithCRView = {
    ...oldRecordData,
    createdBy: 'Ryan David',
    createdDate: '25/10/2025',
    approvedBy: 'Laura Angela',
    approvedDate: '30/10/2025',
  };

  return (
    <WidgetProvider store={store} schemaData={schemaDataWithCRView}>
      <SectionsContainer 
        sections={[exampleSectionSchema]} 
        mode="CRView"
      />
    </WidgetProvider>
  );
};
