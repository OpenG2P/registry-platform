const IDENTITY_AND_META_KEYS = new Set([
  'edit_action',
  'internal_record_id',
  'link_internal_record_id',
  'functional_record_id',
  'created_at',
  'created_by',
  'last_approved_at',
  'last_approved_by',
  'search_text',
]);

type RowRecord = Record<string, unknown>;

const isPlainRecord = (value: unknown): value is RowRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const valuesEqual = (baselineValue: unknown, currentValue: unknown): boolean => {
  if (Object.is(baselineValue, currentValue)) return true;
  if (baselineValue === undefined || baselineValue === null || baselineValue === '') {
    return currentValue === undefined || currentValue === null || currentValue === '';
  }
  if (currentValue === undefined || currentValue === null || currentValue === '') {
    return false;
  }
  try {
    return JSON.stringify(baselineValue) === JSON.stringify(currentValue);
  } catch {
    return false;
  }
};

const getRowId = (row: RowRecord): string | null => {
  const id = row.internal_record_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
};

const sectionFieldKeys = (baseline: RowRecord, current: RowRecord): string[] => {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  return [...keys].filter((key) => !IDENTITY_AND_META_KEYS.has(key));
};

const pickChangedFields = (baseline: RowRecord, current: RowRecord): RowRecord => {
  const changed: RowRecord = {};
  for (const key of sectionFieldKeys(baseline, current)) {
    if (!valuesEqual(baseline[key], current[key])) {
      changed[key] = current[key];
    }
  }
  return changed;
};

/** All section fields (changed or not). Identity / meta keys stay out of the CR payload. */
const pickAllSectionFields = (baseline: RowRecord, current: RowRecord): RowRecord => {
  const fields: RowRecord = {};
  for (const key of sectionFieldKeys(baseline, current)) {
    fields[key] = Object.prototype.hasOwnProperty.call(current, key)
      ? current[key]
      : baseline[key];
  }
  return fields;
};

const toRowList = (records: unknown[]): RowRecord[] =>
  records.filter(isPlainRecord);

const diffFormRecord = (baselineRecords: unknown[], currentRecords: unknown[]): unknown[] => {
  const baseline = toRowList(baselineRecords)[0] ?? {};
  const current = toRowList(currentRecords)[0] ?? {};
  const changedFields = pickChangedFields(baseline, current);
  if (Object.keys(changedFields).length === 0) return [];
  return [{ ...pickAllSectionFields(baseline, current), edit_action: 'UPDATE' }];
};

const diffTableRows = (baselineRecords: unknown[], currentRecords: unknown[]): unknown[] => {
  const baselineRows = toRowList(baselineRecords);
  const currentRows = toRowList(currentRecords);
  const baselineById = new Map<string, RowRecord>();
  for (const row of baselineRows) {
    const id = getRowId(row);
    if (id) baselineById.set(id, row);
  }

  const result: RowRecord[] = [];

  currentRows.forEach((row, index) => {
    const editAction = typeof row.edit_action === 'string' ? row.edit_action : undefined;
    const rowId = getRowId(row);

    if (editAction === 'DELETE') {
      if (!rowId) return;
      result.push({ internal_record_id: rowId, edit_action: 'DELETE' });
      return;
    }

    if (editAction === 'ADD') {
      result.push({ ...row, edit_action: 'ADD' });
      return;
    }

    const baseline = (rowId && baselineById.get(rowId)) || (!rowId ? baselineRows[index] : undefined);
    if (!baseline) return;

    const changedFields = pickChangedFields(baseline, row);
    if (Object.keys(changedFields).length === 0) return;

    result.push({
      ...changedFields,
      ...(rowId ? { internal_record_id: rowId } : {}),
      edit_action: 'UPDATE',
    });
  });

  return result;
};

export function diffSectionChangeRecords(
  baselineRecords: unknown[],
  currentRecords: unknown[],
  { isTable }: { isTable: boolean },
): unknown[] {
  return isTable
    ? diffTableRows(baselineRecords, currentRecords)
    : diffFormRecord(baselineRecords, currentRecords);
}
