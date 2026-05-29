/**
 * IntakeForm Mode Example
 *
 * Mirrors the host application's MultiSectionAccordionForms component pattern.
 * Uses real-world section schema structure from backend with:
 * - 3-column panel layout (horizontal parent → 3 vertical children)
 * - Static data sources on select widgets
 * - Action buttons (Cancel, Save Draft, Submit) outside sections
 */

import React, { useMemo, useState } from 'react';
import { createWidgetStore } from '../src/store';
import { WidgetProvider, SectionsContainer } from '../src';
import type { SectionConfig } from '../src/types';
import type { SectionChanges } from '../src/components/SectionRenderer';
import type { SectionsFormHandle } from '../src/components/SectionsContainer';

// Shortened register ID for readability (represents section_register_id from backend)
const REG_ID = 'a1a4d25a';

// ── Section UI schemas (derived from backend response) ──────────

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
              'widget-required': true,
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
              'widget-required': true,
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
              'widget-required': true,
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
              'widget-label': 'Has Personal Phone',
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
              'widget-required': true,
            },
            {
              widget: 'text',
              'widget-id': 'email',
              'widget-type': 'input',
              'widget-label': 'Email',
              'widget-data-path': `${REG_ID}.email`,
              'widget-data-validation': { validationType: 'email', required: true },
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
              'widget-required': true,
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
              'widget-required': true,
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
              'widget-required': true,
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

const intakeFormSections: SectionConfig[] = [
  personalInfoSection,
  locationSection,
  socioEconomicSection,
];

// ── Example component (mirrors host MultiSectionAccordionForms) ──

export const IntakeFormExample = () => {
  const store = useMemo(() => createWidgetStore(), []);
  const schemaData = useMemo(() => ({}), []);
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

  const handleDraft = async () => {
    console.log('Save Draft clicked');
    alert('Draft saved');
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
    <WidgetProvider store={store} schemaData={schemaData}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
      }}>
        <h1 style={{ fontSize: '24px', fontFamily: 'Roboto, sans-serif', marginBottom: '8px' }}>
          Farmer Intake Form
        </h1>

        <SectionsContainer
          sections={intakeFormSections}
          mode="IntakeForm"
          isDraft={showActions}
          onSectionSave={handleSectionSave}
          onFormReady={setFormHandle}
          namespace={(_, i) => `section-${i}`}
        />

        {/* Action Buttons — outside sections, mirroring host app */}
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
              onClick={handleDraft}
              style={{
                padding: '10px 32px',
                borderRadius: '9999px',
                background: '#000',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Save Draft
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
