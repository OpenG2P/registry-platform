import { DEFAULT_REGISTER_ID } from './loadExampleSchema';

export { DEFAULT_REGISTER_ID } from './loadExampleSchema';

/** Primary record persona: Daniel Kebede — Addis Ababa household member. */
const baseRecordFields = {
  birth_date: '1985-11-08',
  estimated_age: 40,
  gender: 'male',
  marital_status: 'married',
  education_level: 'secondary',
  external_reference_id: 'REF-ETH-2024-0084721',
  has_personal_phone: 'yes',
  phone: '+251 911 482 736',
  email: 'daniel.kebede@example.com',
  kebele_code: 'BOL-04',
  locality_ea_code: 'EA-11827',
  address_descriptor: 'Baro Kefa Street, near Edna Mall, Bole',
  gps_latitude: 8.980603,
  gps_longitude: 38.757762,
  gps_accuracy: 8.4,
  disabled: 'no',
  disability_type: '',
  disability_severity: '',
  source_of_income: 'EMPLOYMENT',
  table_records: [
    { degree: 'Diploma', institution: 'Addis Ababa TVET College', level: 'SECONDARY', year: 2006 },
    { degree: 'Certificate', institution: 'Bole Community School', level: 'PRIMARY', year: 2002 },
  ],
};

const sampleScores = [
  {
    score_type: 'PMT',
    computed_score: 38,
    computed_at: '2026-04-16T10:12:00Z',
    triggered_by_cr_id: 'CR-2026-004821',
  },
  {
    score_type: 'FSS',
    computed_score: 0.72,
    computed_at: '2026-03-10T08:30:00Z',
    triggered_by_cr_id: 'CR-2026-004819',
  },
  {
    score_type: 'Poverty Score',
    computed_score: 22,
    computed_at: '2026-01-02T09:05:00Z',
    triggered_by_cr_id: 'CR-2026-004801',
  },
];

/** Header / ID-auth persona: Helen Tadesse — household head on the registrant record. */
const registrantRecord = {
  register_id: 'a1a4d25a-1cd4-4356-abac-985a0b3c6bcd',
  internal_record_id: '99c9a49b-404c-4fda-b893-92c655831208',
  initiated_by_staff_id: 'ET-WG-0042',
  record_name: 'Helen Tadesse',
  functional_record_id: '1048291056732',
  foundational_id: '9876543210987656',
  record_image_storage_id: '',
  record_image_url: '',
  record_status: 'active',
  record_status_reason: 'Annual verification completed',
  created_by: 'Selam Bekele',
  created_at: '14 Jan 2025',
  last_approved_by: 'Yonas Mekonnen',
  last_approved_at: '20 Mar 2026',
  last_authenticated_on: '2026-04-18T11:05:00Z',
  last_authentication_status: 'success',
  authentication_expiry_date: '2026-07-18T00:00:00Z',
  completion_score: 94.35,
  ideal_score: 100,
  psut: 'PSUT-DEMO-7F3A9C2E1B8D4F6A0E5C',
  first_name: 'Helen',
  last_name: 'Tadesse',
  date_of_birth: '1988-03-14',
  gender: 'Female',
  email: 'helen.tadesse@example.com',
  phone: '+251 922 615 903',
  nationality: 'Ethiopian',
  language: 'Amharic',
  address: {
    street: 'Baro Kefa Street',
    city: 'Addis Ababa',
    state: 'Bole Sub-City',
    postal_code: '1000',
  },
};

const householdMembers = [
  {
    has_national_id: true,
    foundational_id: '9876543210987656',
    rid: '',
    prefix: 'MRS',
    first_name: 'Helen',
    middle_name: 'Almaz',
    last_name: 'Tadesse',
    birth_date: '1988-03-14',
    gender: 'F',
    is_head: true,
    relationship_to_head: '',
  },
  {
    has_national_id: false,
    foundational_id: '',
    rid: '28471930562847193056284719305',
    prefix: 'MR',
    first_name: 'Daniel',
    middle_name: 'Kebede',
    last_name: 'Tadesse',
    birth_date: '1985-11-08',
    gender: 'M',
    is_head: false,
    relationship_to_head: 'SPOUSE',
  },
  {
    has_national_id: true,
    foundational_id: '1122334455667788',
    rid: '',
    prefix: 'MS',
    first_name: 'Hanna',
    middle_name: 'Daniel',
    last_name: 'Tadesse',
    birth_date: '2012-07-22',
    gender: 'F',
    is_head: false,
    relationship_to_head: 'CHILD',
  },
];

const sampleSupportingDocuments = {
  national_id_front: 'https://example.com/docs/national-id-front.pdf',
  national_id_back: 'https://example.com/docs/national-id-back.pdf',
  passport: null,
  birth_certificate: 'https://example.com/docs/birth-certificate.pdf',
  proof_of_address: null,
  photo: 'https://example.com/docs/passport-photo.png',
  bank_statement: null,
  employment_letter: null,
  other: null,
};

const sampleGeoHierarchy = {
  geo_lowest_level_value_id: 'W2',
  geo_code_hierarchy_json: {
    hierarchy: [
      { level_id: 'L1', level_mnemonic: 'region', level_value_id: 'R1', level_value_mnemonic: 'addis_ababa' },
      { level_id: 'L2', level_mnemonic: 'zone', level_value_id: 'Z1', level_value_mnemonic: 'bole' },
      { level_id: 'L3', level_mnemonic: 'woreda', level_value_id: 'W2', level_value_mnemonic: 'woreda_04' },
    ],
    lowest_level_value_id: 'W2',
  },
};

/** Nested shape so getValueByPath can resolve register-id.field paths. */
export const recordSampleSchemaData: Record<string, unknown> = {
  scores: sampleScores,
  [DEFAULT_REGISTER_ID]: {
    ...baseRecordFields,
    ...sampleGeoHierarchy,
    supporting_documents: sampleSupportingDocuments,
  },
};

export const changeRequestOldData: Record<string, unknown> = {
  [DEFAULT_REGISTER_ID]: {
    ...baseRecordFields,
    marital_status: 'single',
    education_level: 'secondary',
    external_reference_id: 'REF-ETH-2024-0084721',
    phone: '+251 911 482 736',
    email: 'daniel.kebede@example.com',
    created_by: 'Selam Bekele',
    created_at: '10 Jan 2025',
    last_approved_by: 'Yonas Mekonnen',
    last_approved_at: '15 Feb 2025',
  },
};

export const changeRequestNewData: Record<string, unknown> = {
  [DEFAULT_REGISTER_ID]: {
    ...baseRecordFields,
    estimated_age: 40,
    marital_status: 'married',
    education_level: 'tertiary',
    external_reference_id: 'REF-ETH-2026-0084721',
    phone: '+251 922 847 291',
    email: 'daniel.kebede.work@example.com',
    created_by: 'Selam Bekele',
    created_at: '10 Jan 2025',
    last_approved_by: 'Marta Girma',
    last_approved_at: '20 Mar 2026',
  },
};

export const registrantSchemaData = {
  registrant: registrantRecord,
};

export const registerLookupSchemaData: Record<string, unknown> = {
  [DEFAULT_REGISTER_ID]: {
    link_internal_record_id: 'rec-002',
  },
};

export const dialogTableSchemaData: Record<string, unknown> = {
  [DEFAULT_REGISTER_ID]: {
    records: householdMembers,
  },
};

/** Combined data for all special sections in one RegistryView */
export const specialSectionsSchemaData: Record<string, unknown> = {
  scores: sampleScores,
  registrant: registrantRecord,
  [DEFAULT_REGISTER_ID]: {
    link_internal_record_id: 'rec-002',
    records: householdMembers,
  },
};

/** Widget gallery persona: Miriam Hailu — separate demo registrant for input widgets. */
export const widgetExploreSampleData: Record<string, unknown> = {
  [DEFAULT_REGISTER_ID]: {
    is_married: true,
    consent: true,
    salary: 28500,
    date_of_birth: '1991-06-19',
    appointment_time: '2026-06-15T09:30:00',
    functional_id: 'FR-2026-00847',
    document: '',
    amount: 1847.5,
    phone: '+251 933 204 817',
    photo: '',
    display_name: 'Miriam Hailu',
    national_id: '5566778899001122',
    programs: ['pmt', 'fs'],
    gender: 'female',
    country: 'in',
    full_name: 'Miriam Hailu',
    skills: ['Amharic', 'Data Entry', 'Crop Management'],
    notes: [
      { note: 'Verified contact number during field visit on 12 May 2026.' },
      { note: 'Requested follow-up on program eligibility after document upload.' },
    ],
    description:
      'Miriam Hailu registered through the Bole outreach centre. Primary income from small-scale trading; enrolled in PMT and food security programs.',
  },
};

export const themeSampleData = (registerId: string): Record<string, unknown> => ({
  scores: [
    {
      score_type: 'PMT',
      computed_score: 41,
      computed_at: '2026-01-15T10:00:00Z',
      triggered_by_cr_id: 'CR-2026-004830',
    },
  ],
  [registerId]: {
    record_name: 'Helen Tadesse',
    functional_record_id: '1048291056732',
    record_image_storage_id: '',
    record_image_url: '',
    record_status: 'active',
    record_status_reason: 'Annual verification completed',
    created_by: 'Selam Bekele',
    created_at: '10 Jan 2026',
    last_approved_by: 'Yonas Mekonnen',
    last_approved_at: '15 Jan 2026',
    completion_score: 91.2,
    ideal_score: 100,
    birth_date: '1988-03-14',
    estimated_age: 38,
    gender: 'female',
    marital_status: 'married',
    education_level: 'tertiary',
    external_reference_id: 'REF-ETH-2026-004821',
    has_personal_phone: 'yes',
    phone: '+251 922 615 903',
    email: 'helen.tadesse@example.com',
    table_records: [
      { degree: 'BSc', institution: 'Addis Ababa University', level: 'TERTIARY', year: 2010 },
      { degree: 'Diploma', institution: 'St. Mary College', level: 'SECONDARY', year: 2006 },
    ],
  },
});
