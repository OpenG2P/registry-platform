import { SectionConfig } from '../types';
import { collectWidgets } from './sectionValidate';
import { getValueByPath } from './pathUtils';
import type { SectionChanges } from '../components/SectionRenderer';
import { extractTableRecordsFromSnapshot, isTableLikeWidget } from './extractTableRecordsFromSnapshot';

/**
 * Build SectionChanges from section config and current store values.
 * Works for intake forms (no sectionRegisterId) and edit flows (with sectionRegisterId).
 */
export function buildSectionChanges(
  section: SectionConfig,
  storeValues: Record<string, unknown>,
  namespace?: string,
  options?: { dbSectionId?: string; sectionRegisterId?: string }
): SectionChanges {
  const sectionWidgets = collectWidgets(section.panels);
  const resolvePath = (path: string) => (namespace ? `${namespace}.${path}` : path);

  const snapshot: Record<string, unknown> = {};
  let hasTable = false;

  sectionWidgets.forEach((widget) => {
    const widgetPath = widget['widget-data-path'];
    if (!widgetPath) return;

    if (isTableLikeWidget(widget)) {
      hasTable = true;
    }

    if (typeof widgetPath === 'object') {
      Object.values(widgetPath).forEach((path: unknown) => {
        if (typeof path === 'string' && path.length > 0) {
          snapshot[path] = getValueByPath(storeValues, resolvePath(path));
        }
      });
    } else if (typeof widgetPath === 'string') {
      snapshot[widgetPath] = getValueByPath(storeValues, resolvePath(widgetPath));
    }
  });

  let records: unknown[];

  if (!hasTable) {
    const cleanedSnapshot: Record<string, unknown> = {};
    Object.entries(snapshot).forEach(([fullPath, value]) => {
      const fieldPath = fullPath.includes('.')
        ? fullPath.split('.').slice(1).join('.')
        : fullPath;
      cleanedSnapshot[fieldPath] = value;
    });

    const { sectionRegisterId } = options || {};
    const sectionData =
      sectionRegisterId && namespace
        ? (getValueByPath(storeValues, `${namespace}.${sectionRegisterId}`) as Record<string, unknown>) || {}
        : (sectionRegisterId
            ? (storeValues[sectionRegisterId] as Record<string, unknown>)
            : {}) || {};

    records = [
      {
        ...sectionData,
        ...cleanedSnapshot,
        ...(sectionRegisterId ? { edit_action: 'UPDATE' as const } : {}),
      },
    ];
  } else {
    records = extractTableRecordsFromSnapshot(snapshot, sectionWidgets);
  }

  const files: unknown[] = [];
  const supportingDocs = section['section-supporting-documents'] || [];
  supportingDocs.forEach((doc) => {
    const path = doc['document-data-path'];
    if (path) {
      files.push(getValueByPath(storeValues, resolvePath(path)));
    }
  });

  return {
    section_id: options?.dbSectionId ?? section['section-id'],
    section_register_id: options?.sectionRegisterId,
    records,
    files: files.length > 0 ? files : undefined,
  };
}
