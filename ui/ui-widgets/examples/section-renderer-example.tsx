/**
 * Section Renderer (RegistryView) Example
 *
 * Uses the same UI schema as the Intake Form example but renders
 * in the default RegistryView mode with edit overlay support.
 */

import React, { useMemo } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionConfig } from '../src/types';
import type { SectionChanges } from '../src/components/SectionRenderer';

const REG_ID = 'a1a4d25a';

// ── Section UI schemas (same as intake-form-example) ──────────

const scoresSection: SectionConfig = {
  'section-id': 'record_scores',
  'section-title': 'Score',
  'section-editable': false,
  'section-hide-edit-button': true,
  'section-column-span': 3,
  panels: [
    {
      'panel-id': 'panel_scores_main',
      'panel-orientation': 'vertical',
      'panel-column-span': 3,
      widgets: [
        {
          widget: 'scores-display',
          'widget-type': 'group',
          'widget-id': 'record-scores',
          'widget-readonly': true,
          'widget-data-path': 'scores',
        },
      ],
    },
  ],
};

const personalInfoSection: SectionConfig = {
  'section-id': 'farmer_personal_info',
  'section-title': 'Personal Information',
  'section-editable': true,
  panels: [
    {
      'panel-id': 'panel_personal_info_main',
      'panel-orientation': 'horizontal',
      panels: [
        {
          'panel-id': 'panel_personal_info_1',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'date',
              'widget-id': 'birth_date',
              'widget-type': 'input',
              'widget-label': 'Birth Date',
              'widget-data-path': `${REG_ID}.birth_date`,
            },
            {
              widget: 'number',
              'widget-id': 'estimated_age',
              'widget-type': 'input',
              'widget-label': 'Estimated Age',
              'widget-data-path': `${REG_ID}.estimated_age`,
            },
            {
              widget: 'select',
              'widget-id': 'gender',
              'widget-type': 'input',
              'widget-label': 'Gender',
              'widget-data-path': `${REG_ID}.gender`,
              'widget-data-source': {
                type: 'static',
                options: [
                  { label: 'Male', value: 'male' },
                  { label: 'Female', value: 'female' },
                  { label: 'Other', value: 'other' },
                ],
              },
            },
          ],
        },
        {
          'panel-id': 'panel_personal_info_2',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'select',
              'widget-id': 'marital_status',
              'widget-type': 'input',
              'widget-label': 'Marital Status',
              'widget-data-path': `${REG_ID}.marital_status`,
              'widget-data-source': {
                type: 'static',
                options: [
                  { label: 'Single', value: 'single' },
                  { label: 'Married', value: 'married' },
                  { label: 'Divorced', value: 'divorced' },
                  { label: 'Widowed', value: 'widowed' },
                ],
              },
            },
            {
              widget: 'select',
              'widget-id': 'education_level',
              'widget-type': 'input',
              'widget-label': 'Education Level',
              'widget-data-path': `${REG_ID}.education_level`,
              'widget-data-source': {
                type: 'static',
                options: [
                  { label: 'None', value: 'none' },
                  { label: 'Primary', value: 'primary' },
                  { label: 'Secondary', value: 'secondary' },
                  { label: 'Tertiary', value: 'tertiary' },
                ],
              },
            },
            // Long single token (no spaces): in RegistryView readonly mode this truncates with
            // an ellipsis; hover the value for the full string (native title tooltip).
            {
              widget: 'text',
              'widget-id': 'external_reference_id',
              'widget-type': 'input',
              'widget-label': 'External reference ID',
              'widget-data-path': `${REG_ID}.external_reference_id`,
            },
          ],
        },
        {
          'panel-id': 'panel_personal_info_3',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'select',
              'widget-id': 'has_personal_phone',
              'widget-type': 'input',
              'widget-label': 'Has Personal Phone with you?',
              'widget-data-path': `${REG_ID}.has_personal_phone`,
              'widget-data-format': { layout: 'vertical', sortOptions: false },
              'widget-data-source': {
                type: 'static',
                options: [
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                ],
              },
            },
            {
              widget: 'text',
              'widget-id': 'phone',
              'widget-type': 'input',
              'widget-label': 'Phone',
              'widget-data-path': `${REG_ID}.phone`,
            },
            {
              widget: 'text',
              'widget-id': 'email',
              'widget-type': 'input',
              'widget-label': 'Email',
              'widget-data-path': `${REG_ID}.email`,
              'widget-data-validation': { validationType: 'email' },
            },
          ],
        },
      ],
    },
  ],
};

const locationSection: SectionConfig = {
  'section-id': 'farmer_location',
  'section-title': 'Location',
  'section-editable': true,
  'section-supporting-documents': [
    {
      'document-data-path': `${REG_ID}.proof_of_address`,
      'document-label': 'Proof of Address',
      'document-type': 'image',
      'document-accept': '.pdf,.jpg,.jpeg,.png',
      'document-required': false,
    },
  ],
  panels: [
    {
      'panel-id': 'panel_location_main',
      'panel-orientation': 'horizontal',
      panels: [
        {
          'panel-id': 'panel_location_1',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'text',
              'widget-id': 'address_line_1',
              'widget-type': 'input',
              'widget-label': 'Address Line 1',
              'widget-data-path': `${REG_ID}.address_line_1`,
            },
            {
              widget: 'text',
              'widget-id': 'address_line_2',
              'widget-type': 'input',
              'widget-label': 'Address Line 2',
              'widget-data-path': `${REG_ID}.address_line_2`,
            },
            {
              widget: 'text',
              'widget-id': 'postal_code',
              'widget-type': 'input',
              'widget-label': 'Postal Code',
              'widget-data-path': `${REG_ID}.postal_code`,
            },
            {
              widget: 'text',
              'widget-id': 'country_code',
              'widget-type': 'input',
              'widget-label': 'Country Code',
              'widget-data-path': `${REG_ID}.country_code`,
            },
          ],
        },
        {
          'panel-id': 'panel_location_2',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'text',
              'widget-id': 'region',
              'widget-type': 'input',
              'widget-label': 'Region',
              'widget-data-path': `${REG_ID}.region`,
            },
            {
              widget: 'text',
              'widget-id': 'district',
              'widget-type': 'input',
              'widget-label': 'District',
              'widget-data-path': `${REG_ID}.district`,
            },
            {
              widget: 'text',
              'widget-id': 'locality',
              'widget-type': 'input',
              'widget-label': 'Locality',
              'widget-data-path': `${REG_ID}.locality`,
            },
          ],
        },
        {
          'panel-id': 'panel_location_3',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'number',
              'widget-id': 'latitude',
              'widget-type': 'input',
              'widget-label': 'Latitude',
              'widget-data-path': `${REG_ID}.latitude`,
              'widget-data-format': {
                textAlign: 'right',
                allowSigned: true,
                numericType: 'decimal',
                decimalPlaces: 6,
              },
            },
            {
              widget: 'number',
              'widget-id': 'longitude',
              'widget-type': 'input',
              'widget-label': 'Longitude',
              'widget-data-path': `${REG_ID}.longitude`,
              'widget-data-format': {
                textAlign: 'right',
                allowSigned: true,
                numericType: 'decimal',
                decimalPlaces: 6,
              },
            },
            {
              widget: 'number',
              'widget-id': 'altitude',
              'widget-type': 'input',
              'widget-label': 'Altitude',
              'widget-data-path': `${REG_ID}.altitude`,
              'widget-data-format': {
                textAlign: 'right',
                allowSigned: true,
                numericType: 'decimal',
                decimalPlaces: 6,
              },
            },
          ],
        },
      ],
    },
  ],
};

const socioEconomicSection: SectionConfig = {
  'section-id': 'socio_economic_and_health',
  'section-title': 'Socio-Economic & Health',
  'section-editable': true,
  panels: [
    {
      'panel-id': 'panel_socio_economic_and_health_main',
      'panel-orientation': 'horizontal',
      panels: [
        {
          'panel-id': 'panel_health',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'select',
              'widget-id': 'disabled',
              'widget-type': 'input',
              'widget-label': 'Disabled',
              'widget-data-path': `${REG_ID}.disabled`,
              'widget-data-format': { layout: 'vertical', sortOptions: false },
              'widget-data-source': {
                type: 'static',
                options: [
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                ],
              },
            },
            {
              widget: 'select',
              'widget-id': 'disability_type',
              'widget-type': 'input',
              'widget-label': 'Disability Type',
              'widget-data-path': `${REG_ID}.disability_type`,
              'widget-data-source': {
                type: 'static',
                options: [
                  { label: 'Vision', value: 'VISION' },
                  { label: 'Hearing', value: 'HEARING' },
                  { label: 'Mobility', value: 'MOBILITY' },
                  { label: 'Cognition', value: 'COGNITION' },
                  { label: 'Self Care', value: 'SELF_CARE' },
                  { label: 'Communication', value: 'COMMUNICATION' },
                ],
              },
            },
            {
              widget: 'select',
              'widget-id': 'disability_severity',
              'widget-type': 'input',
              'widget-label': 'Disability Severity',
              'widget-data-path': `${REG_ID}.disability_severity`,
              'widget-data-source': {
                type: 'static',
                options: [
                  { label: 'No Difficulty', value: 'NO_DIFFICULTY' },
                  { label: 'Some Difficulty', value: 'SOME_DIFFICULTY' },
                  { label: 'A Lot of Difficulty', value: 'A_LOT_OF_DIFFICULTY' },
                  { label: 'Cannot Do at All', value: 'CANNOT_DO_AT_ALL' },
                ],
              },
            },
          ],
        },
        {
          'panel-id': 'panel_socio_economic',
          'panel-orientation': 'vertical',
          widgets: [
            {
              widget: 'select',
              'widget-id': 'source_of_income',
              'widget-type': 'input',
              'widget-label': 'Source of Income',
              'widget-data-path': `${REG_ID}.source_of_income`,
              'widget-data-source': {
                type: 'static',
                options: [
                  { label: 'Crop Production', value: 'CROP_PRODUCTION' },
                  { label: 'Livestock Production', value: 'LIVESTOCK_PRODUCTION' },
                  { label: 'Government/NGO Support', value: 'GOVERNMENT_NGO_SUPPORT' },
                  { label: 'Others', value: 'OTHERS' },
                ],
              },
            },
          ],
        },
        {
          'panel-id': 'panel_empty_3',
          'panel-orientation': 'vertical',
          widgets: [],
        },
      ],
    },
  ],
};

const tableSection: SectionConfig = {
  'section-id': 'table_widget_example',
  'section-title': 'Table Widget Example',
  'section-editable': true,
  'section-column-span': 3,
  panels: [
    {
      'panel-id': 'panel_table_main',
      'panel-orientation': 'vertical',
      'panel-column-span': 3,
      widgets: [
        {
          widget: 'table',
          'widget-type': 'table',
          'widget-id': 'education_history',
          'widget-label': 'Education History',
          'widget-column-span': 3,
          'widget-data-path': `${REG_ID}.education_history`,
          'widget-data-operations': { add: true, remove: true, edit: true },
          'widget-data-columns': [
            {
              'column-key': 'degree',
              widget: 'text',
              'widget-type': 'input',
              'widget-label': 'Degree',
            },
            {
              'column-key': 'institution',
              widget: 'text',
              'widget-type': 'input',
              'widget-label': 'Institution',
            },
            {
              'column-key': 'level',
              widget: 'select',
              'widget-type': 'input',
              'widget-label': 'Level',
              'widget-data-source': {
                type: 'static',
                options: [
                  { label: 'Primary', value: 'PRIMARY' },
                  { label: 'Secondary', value: 'SECONDARY' },
                  { label: 'Tertiary', value: 'TERTIARY' },
                ],
              },
            },
            {
              'column-key': 'year',
              widget: 'number',
              'widget-type': 'input',
              'widget-label': 'Year',
              'widget-data-validation': { min: 1900, max: 2100 },
            },
          ],
        },
      ],
    },
  ],
};

const registryViewSections: SectionConfig[] = [
  scoresSection,
  personalInfoSection,
  locationSection,
  socioEconomicSection,
  tableSection,
];

// ── Schema data (pre-populated for view mode) ──────────
// Must be a nested object so getValueByPath can traverse dot-notation
// widget-data-path values like "a1a4d25a.birth_date".

const sampleSchemaData: Record<string, unknown> = {
  scores: [
    {
      score_type: 'PMT',
      computed_score: 42,
      computed_at: '2026-04-16T10:12:00Z',
      triggered_by_cr_id: 'CR-001',
    },
    {
      score_type: 'FSS',
      computed_score: 0.78,
      computed_at: '2026-03-10T08:30:00Z',
      triggered_by_cr_id: 'CR-000',
    },
    {
      score_type: 'Poverty Score',
      computed_score: 18,
      computed_at: '2026-01-02T09:05:00Z',
      triggered_by_cr_id: 'CR-000',
    },
    
    {
      score_type: 'Poverty Score',
      computed_score: 18,
      computed_at: '2026-01-02T09:05:00Z',
      triggered_by_cr_id: 'CR-000',
    },
  ],
  [`${REG_ID}.birth_date`]: '1990-05-15',
  [`${REG_ID}.estimated_age`]: 35,
  [`${REG_ID}.gender`]: 'male',
  [`${REG_ID}.marital_status`]: 'married',
  [`${REG_ID}.education_level`]: 'secondary',
  [`${REG_ID}.has_personal_phone`]: 'yes',
  [`${REG_ID}.phone`]: '+1 555-0123',
  [`${REG_ID}.email`]: 'john.doe@example.com',
  [`${REG_ID}.address_line_1`]: '123 Farm Road',
  [`${REG_ID}.address_line_2`]: 'Rural District',
  [`${REG_ID}.postal_code`]: '10001',
  [`${REG_ID}.country_code`]: 'US',
  [`${REG_ID}.region`]: 'Midwest',
  [`${REG_ID}.district`]: 'Springfield',
  [`${REG_ID}.locality`]: 'Green Valley',
  [`${REG_ID}.latitude`]: 39.781721,
  [`${REG_ID}.longitude`]: -89.650148,
  [`${REG_ID}.altitude`]: 182.5,
  [`${REG_ID}.disabled`]: 'no',
  [`${REG_ID}.disability_type`]: '',
  [`${REG_ID}.disability_severity`]: '',
  [`${REG_ID}.source_of_income`]: 'CROP_PRODUCTION',
  [`${REG_ID}.education_history`]: [
    { degree: 'BSc', institution: 'Springfield University', level: 'TERTIARY', year: 2012 },
    { degree: 'High School', institution: 'Springfield High', level: 'SECONDARY', year: 2008 },
  ],
};

export const SectionRendererExample = () => {
  const store = useMemo(() => createWidgetStore(), []);

  const handleSectionSave = async (changes: SectionChanges) => {
    console.log('Section saved:', changes);
    alert(`Section "${changes.section_id}" saved! Check console for payload.`);
  };

  return (
    <WidgetProvider
      store={store}
      schemaData={sampleSchemaData}
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
          Farmer Registry — Section Renderer
        </h1>

        <SectionsContainer
          sections={registryViewSections}
          schemaData={sampleSchemaData}
          mode="RegistryView"
          onSectionSave={handleSectionSave}
          namespace={(_, i) => `rv-section-${i}`}
        />
      </div>
    </WidgetProvider>
  );
};

export default SectionRendererExample;
