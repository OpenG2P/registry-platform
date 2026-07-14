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

    return {
      createdBy: getValueByPath(dataSource, `${recordPath}.created_by`),
      createdDate: getValueByPath(dataSource, `${recordPath}.created_at`),
      approvedBy: getValueByPath(dataSource, `${recordPath}.last_approved_by`),
      approvedDate: getValueByPath(dataSource, `${recordPath}.last_approved_at`),
    };
  }, [mode, currentSchemaData, storeValues]);
