import React, { useMemo } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionConfig } from '../src/types';
import type { SectionChanges } from '../src/components/SectionRenderer';

export const DialogTableExample = () => {
  const store = useMemo(() => createWidgetStore(), []);

  const schemaData: any = {
    household: {
      members: [
        { firstName: 'Amina', lastName: 'Khan', dob: '2001-05-10', gender: 'F', phone: '+254700000001' },
        { firstName: 'John', lastName: 'Doe', dob: '1997-11-02', gender: 'M', phone: '+254700000002' },
      ],
    },
  };

  const sections: SectionConfig[] = [
    {
      'section-id': 'dialog-table-example',
      'section-title': 'HH Members',
      'section-editable': true,
      panels: [
        {
          'panel-id': 'p1',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'dialog-table',
              'widget-type': 'table',
              'widget-id': 'householdMembers',
              'widget-label': 'Household Members',
              'widget-data-path': 'household.members',
              'widget-data-dialog-title-add': 'Add record',
              'widget-data-dialog-title-edit': 'Edit record',
              'widget-data-operations': { add: true, edit: true, remove: true },
              'widget-data-columns': [
                {
                  'column-key': 'firstName',
                  widget: 'text',
                  'widget-type': 'input',
                  'widget-label': 'First Name',
                  'column-visible-in-table': true,
                },
                {
                  'column-key': 'lastName',
                  widget: 'text',
                  'widget-type': 'input',
                  'widget-label': 'Last Name',
                  'column-visible-in-table': true,
                },
                {
                  'column-key': 'dob',
                  widget: 'date',
                  'widget-type': 'input',
                  'widget-label': 'Date of Birth',
                  'column-visible-in-table': true,
                },
                {
                  'column-key': 'gender',
                  widget: 'select',
                  'widget-type': 'input',
                  'widget-label': 'Gender',
                  'column-visible-in-table': false,
                  'widget-data-source': {
                    type: 'static',
                    options: [
                      { value: 'F', label: 'Female' },
                      { value: 'M', label: 'Male' },
                      { value: 'O', label: 'Other' },
                    ],
                  },
                },
                {
                  'column-key': 'phone',
                  widget: 'phone',
                  'widget-type': 'input',
                  'widget-label': 'Phone',
                  'column-visible-in-table': false,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  const handleSectionSave = async (changes: SectionChanges) => {
    console.log('DialogTableExample section saved:', changes);
    alert(`Saved. Check console for payload (section_id=${changes.section_id}).`);
  };

  return (
    <WidgetProvider store={store} schemaData={schemaData}>
      <div className="bg-white rounded-[20px] p-6">
        <div className="mb-4">
          <div className="text-lg font-semibold">Dialog Table Widget</div>
          <div className="text-sm text-gray-600">
            Table shows a subset of columns; Add/Edit opens a modal with all fields.
          </div>
        </div>

        <SectionsContainer
          sections={sections}
          schemaData={schemaData}
          mode="RegistryView"
          onSectionSave={handleSectionSave}
          namespace={() => 'dialog-table-example'}
        />
      </div>
    </WidgetProvider>
  );
};

