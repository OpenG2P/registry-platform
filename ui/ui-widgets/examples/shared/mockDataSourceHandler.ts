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

const GEO_LEVELS = [
  { level_id: 'L1', level_mnemonic: 'region', parent_level_id: null },
  { level_id: 'L2', level_mnemonic: 'zone', parent_level_id: 'L1' },
  { level_id: 'L3', level_mnemonic: 'woreda', parent_level_id: 'L2' },
];

const GEO_LEVEL_VALUES = [
  { level_value_id: 'R1', level_id: 'L1', level_value_mnemonic: 'addis_ababa', parent_level_value_id: null },
  { level_value_id: 'R2', level_id: 'L1', level_value_mnemonic: 'oromia', parent_level_value_id: null },
  { level_value_id: 'Z1', level_id: 'L2', level_value_mnemonic: 'bole', parent_level_value_id: 'R1' },
  { level_value_id: 'Z2', level_id: 'L2', level_value_mnemonic: 'kirkos', parent_level_value_id: 'R1' },
  { level_value_id: 'Z3', level_id: 'L2', level_value_mnemonic: 'east_shewa', parent_level_value_id: 'R2' },
  { level_value_id: 'W1', level_id: 'L3', level_value_mnemonic: 'woreda_03', parent_level_value_id: 'Z1' },
  { level_value_id: 'W2', level_id: 'L3', level_value_mnemonic: 'woreda_04', parent_level_value_id: 'Z1' },
  { level_value_id: 'W3', level_id: 'L3', level_value_mnemonic: 'woreda_01', parent_level_value_id: 'Z2' },
  { level_value_id: 'W4', level_id: 'L3', level_value_mnemonic: 'adama', parent_level_value_id: 'Z3' },
];

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

/** Mock API handler for examples that use attribute / registry endpoints. */
export function createExampleDataSourceHandler(): DataSourceRequestHandler {
  return async (service, endpoint, method, params) => {
    // eslint-disable-next-line no-console
    console.log('[examples] dataSourceRequestHandler', { service, endpoint, method, params });

    if (service === 'master-data' && endpoint === 'geo-levels') {
      return { response_body: { response_payload: GEO_LEVELS } };
    }

    if (service === 'master-data' && endpoint === 'geo-level-values') {
      const levelId = String((params as { level_id?: string })?.level_id ?? '');
      const parentValueId = String(
        (params as { parent_level_value_id?: string })?.parent_level_value_id ?? '',
      );
      const values = GEO_LEVEL_VALUES.filter(
        (item) =>
          item.level_id === levelId &&
          (item.parent_level_value_id ?? '') === parentValueId,
      );
      return { response_body: { response_payload: values } };
    }

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
