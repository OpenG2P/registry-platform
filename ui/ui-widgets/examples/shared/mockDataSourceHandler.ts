import type { DataSourceRequestHandler } from '../../src/types';

const ATTRIBUTE_VALUES: Record<string, Array<{ value_code: string; value_display: string }>> = {
  PREFIX: [
    { value_code: 'MR', value_display: 'Mr.' },
    { value_code: 'MRS', value_display: 'Mrs.' },
    { value_code: 'MS', value_display: 'Ms.' },
    { value_code: 'DR', value_display: 'Dr.' },
  ],
  GENDER: [
    { value_code: 'M', value_display: 'Male' },
    { value_code: 'F', value_display: 'Female' },
    { value_code: 'O', value_display: 'Other' },
  ],
  RELATIONSHIP_TO_HEAD: [
    { value_code: 'SPOUSE', value_display: 'Spouse' },
    { value_code: 'CHILD', value_display: 'Child' },
    { value_code: 'PARENT', value_display: 'Parent' },
    { value_code: 'SIBLING', value_display: 'Sibling' },
    { value_code: 'OTHER', value_display: 'Other' },
  ],
};

const MOCK_REGISTER_RECORDS = [
  {
    internal_record_id: 'rec-001',
    record_name: 'Alex Johnson',
    functional_record_id: 'FN-10001',
    field_a: 'Value A1',
    field_b: 'Value B1',
    field_c: 'Value C1',
  },
  {
    internal_record_id: 'rec-002',
    record_name: 'Maria Garcia',
    functional_record_id: 'FN-10002',
    field_a: 'Value A2',
    field_b: 'Value B2',
    field_c: 'Value C2',
  },
  {
    internal_record_id: 'rec-003',
    record_name: 'Samuel Okonkwo',
    functional_record_id: 'FN-10003',
    field_a: 'Value A3',
    field_b: 'Value B3',
    field_c: 'Value C3',
  },
];

const MOCK_GEO_LEVEL_VALUES: Record<string, Array<{ level_value_id: string; level_value_mnemonic: string }>> = {
  region: [
    { level_value_id: 'reg-01', level_value_mnemonic: 'Addis Ababa' },
    { level_value_id: 'reg-02', level_value_mnemonic: 'Oromia' },
  ],
  sub_city: [
    { level_value_id: 'sub-01', level_value_mnemonic: 'Bole' },
    { level_value_id: 'sub-02', level_value_mnemonic: 'Kirkos' },
  ],
  woreda: [
    { level_value_id: 'wor-01', level_value_mnemonic: 'Woreda 03' },
    { level_value_id: 'wor-02', level_value_mnemonic: 'Woreda 07' },
  ],
};

const MOCK_GEO_CHILDREN: Record<string, Record<string, Array<{ level_value_id: string; level_value_mnemonic: string }>>> = {
  sub_city: {
    'reg-01': MOCK_GEO_LEVEL_VALUES.sub_city,
    'reg-02': [{ level_value_id: 'sub-03', level_value_mnemonic: 'Adama' }],
  },
  woreda: {
    'sub-01': MOCK_GEO_LEVEL_VALUES.woreda,
    'sub-02': [{ level_value_id: 'wor-03', level_value_mnemonic: 'Woreda 01' }],
    'sub-03': [{ level_value_id: 'wor-04', level_value_mnemonic: 'Woreda 02' }],
  },
};

/** Mock API handler for examples that use attribute / registry endpoints. */
export function createExampleDataSourceHandler(): DataSourceRequestHandler {
  return async (service, endpoint, method, params) => {
    // eslint-disable-next-line no-console
    console.log('[examples] dataSourceRequestHandler', { service, endpoint, method, params });

    if (service === 'attributes' && endpoint === 'values') {
      const attributeId = (params as { attribute_id?: string })?.attribute_id ?? '';
      const values = ATTRIBUTE_VALUES[attributeId] ?? [];
      return { response_body: { values } };
    }

    if (service === 'register' && endpoint === 'records') {
      const searchText = String((params as { search_text?: string })?.search_text ?? '').toLowerCase();
      const page = Number((params as { current_page?: number })?.current_page ?? 1);
      const pageSize = Number((params as { page_size?: number })?.page_size ?? 10);
      const filtered = searchText
        ? MOCK_REGISTER_RECORDS.filter(
            (r) =>
              r.record_name.toLowerCase().includes(searchText) ||
              r.functional_record_id.toLowerCase().includes(searchText) ||
              r.internal_record_id.toLowerCase().includes(searchText),
          )
        : MOCK_REGISTER_RECORDS;
      const totalCount = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const start = (page - 1) * pageSize;
      const records = filtered.slice(start, start + pageSize);
      return {
        records,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_count: totalCount,
          page_size: pageSize,
        },
      };
    }

    if (service === 'master-data' && endpoint === 'geo-level-values') {
      const levelId = String((params as { level_id?: string })?.level_id ?? '');
      const parentId = String((params as { parent_level_value_id?: string })?.parent_level_value_id ?? '');
      if (levelId === 'region') {
        return MOCK_GEO_LEVEL_VALUES.region;
      }
      if (parentId && MOCK_GEO_CHILDREN[levelId]?.[parentId]) {
        return MOCK_GEO_CHILDREN[levelId][parentId];
      }
      return MOCK_GEO_LEVEL_VALUES[levelId] ?? [];
    }

    if (service === 'registry' && endpoint === 'authenticate_registrant') {
      // eslint-disable-next-line no-console
      console.log(
        '[examples] authenticate_registrant payload',
        (params as { request_payload?: unknown })?.request_payload ?? params,
      );
      const rid =
        (params as { request_payload?: { register_id?: string }; register_id?: string })
          ?.request_payload?.register_id ||
        (params as { register_id?: string })?.register_id ||
        'demo-register';
      return {
        response_body: {
          response_payload: {
            authorization_session_id: 'auth-session-demo-001',
            provider_name:
              (params as { request_payload?: { provider_id?: string }; provider_id?: string })
                ?.request_payload?.provider_id ||
              (params as { provider_id?: string })?.provider_id ||
              'eSignet',
            authorization_url: `https://example.com/?register_id=${encodeURIComponent(String(rid))}`,
          },
        },
      };
    }

    throw new Error(`Unknown endpoint: ${service}/${endpoint} (${method})`);
  };
}
