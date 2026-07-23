import { useMemo } from 'react';
import { getValueByPath } from '../../../utils/pathUtils';
import { SectionMode } from '../../SectionsContainer';

export const useCrViewData = (
  mode: SectionMode,
  currentSchemaData: Record<string, unknown>,
  storeValues: Record<string, unknown>,
) =>
  useMemo(() => {
    if (mode !== 'CRView') return null;
    const dataSource = { ...storeValues, ...currentSchemaData };
    const recordPath = Object.keys(dataSource)[0];
    const records = (dataSource[recordPath] as { records?: unknown[] } | undefined)?.records;
    const auditPath =
      Array.isArray(records) && records.length > 0
        ? `${recordPath}.records.${records.length - 1}`
        : recordPath;

    return {
      createdBy: getValueByPath(dataSource, `${auditPath}.created_by`),
      createdDate: getValueByPath(dataSource, `${auditPath}.created_at`),
      approvedBy: getValueByPath(dataSource, `${auditPath}.last_approved_by`),
      approvedDate: getValueByPath(dataSource, `${auditPath}.last_approved_at`),
    };
  }, [mode, currentSchemaData, storeValues]);
