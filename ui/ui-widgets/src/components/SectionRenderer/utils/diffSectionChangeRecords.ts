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

const sectionFieldKeys = (baseline: RowRecord, current: RowRecord): string[] =>
  [...new Set([...Object.keys(baseline), ...Object.keys(current)])];

const pickChangedFields = (baseline: RowRecord, current: RowRecord): RowRecord => {
  const changed: RowRecord = {};
  for (const key of sectionFieldKeys(baseline, current)) {
    if (!valuesEqual(baseline[key], current[key])) {
      changed[key] = current[key];
    }
  }
  return changed;
};

/** All widget-bound section fields (changed or not). */
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

const diffFormRecord = (
  baselineRecords: unknown[],
  currentRecords: unknown[],
  internalRecordId?: string,
): unknown[] => {
  const baseline = toRowList(baselineRecords)[0] ?? {};
  const current = toRowList(currentRecords)[0] ?? {};
  const changedFields = pickChangedFields(baseline, current);
  if (Object.keys(changedFields).length === 0) return [];

  const payload: RowRecord = {
    ...pickAllSectionFields(baseline, current),
    edit_action: 'UPDATE',
  };

  const recordId =
    getRowId(current) ??
    getRowId(baseline) ??
    (typeof internalRecordId === 'string' && internalRecordId.length > 0
      ? internalRecordId
      : null);
  if (recordId) {
    payload.internal_record_id = recordId;
  }

  return [payload];
};

const pickSectionFields = (row: RowRecord, sectionKeys: Set<string>): RowRecord => {
  const out: RowRecord = {};
  for (const key of sectionKeys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      out[key] = row[key];
    }
  }
  if (row.internal_record_id !== undefined) out.internal_record_id = row.internal_record_id;
  if (row.link_internal_record_id !== undefined) out.link_internal_record_id = row.link_internal_record_id;
  return out;
};

const diffTableRows = (
  baselineRecords: unknown[],
  currentRecords: unknown[],
  tableColumnKeys?: string[],
): unknown[] => {
  const baselineRows = toRowList(baselineRecords);
  const currentRows = toRowList(currentRecords);

  let sectionKeys: Set<string>;
  if (tableColumnKeys && tableColumnKeys.length > 0) {
    sectionKeys = new Set(tableColumnKeys);
  } else {
    sectionKeys = new Set<string>();
    for (const row of baselineRows) {
      for (const key of Object.keys(row)) {
        sectionKeys.add(key);
      }
    }
  }

  const baselineById = new Map<string, RowRecord>();
  for (const row of baselineRows) {
    const id = getRowId(row);
    if (id) baselineById.set(id, row);
  }

  const result: RowRecord[] = [];

  currentRows.forEach((row) => {
    const editAction =
      typeof row.edit_action === 'string' ? row.edit_action : undefined;

    const rowId = getRowId(row);

    if (editAction === 'DELETE') {
      if (!rowId) return;
      result.push({
        ...row,
        internal_record_id: rowId,
        edit_action: 'DELETE',
      });
      return;
    }

    if (editAction === 'ADD' || !rowId) {
      result.push({
        ...row,
        edit_action: 'ADD',
      });
      return;
    }

    result.push({
      ...pickSectionFields(row, sectionKeys),
      edit_action: 'UPDATE',
    });
  });

  return result;
};

export function diffSectionChangeRecords(
  baselineRecords: unknown[],
  currentRecords: unknown[],
  { isTable, internalRecordId, tableColumnKeys }: { isTable: boolean; internalRecordId?: string; tableColumnKeys?: string[] },
): unknown[] {
  return isTable
    ? diffTableRows(baselineRecords, currentRecords, tableColumnKeys)
    : diffFormRecord(baselineRecords, currentRecords, internalRecordId);
}
