import type { BaseWidgetConfig } from '../types';

/** Table-style widgets that bind to an array path in the store / schema. */
export function isTableLikeWidget(widget: BaseWidgetConfig): boolean {
  const w = widget.widget as string | undefined;
  /** widget-type union in types omits legacy values like simple-table still used at runtime */
  const t = widget['widget-type'] as string | undefined;
  return (
    w === 'table' ||
    w === 'dialog-table' ||
    w === 'simple-table' ||
    t === 'table' ||
    t === 'simple-table'
  );
}

/**
 * Resolve `records` for section save payloads.
 * - Back-compat: path ending in `.records` (e.g. `regId.records`)
 * - Else: first array snapshot at a string `widget-data-path` on a table-like widget
 *   (e.g. `household.members` for dialog-table)
 */
export function extractTableRecordsFromSnapshot(
  snapshot: Record<string, unknown>,
  sectionWidgets: BaseWidgetConfig[],
): unknown[] {
  const convention = Object.entries(snapshot).find(
    ([key, value]) => key.endsWith('.records') && Array.isArray(value),
  );
  if (convention) {
    return convention[1] as unknown[];
  }

  const tablePaths: string[] = [];
  sectionWidgets.forEach((widget) => {
    if (!isTableLikeWidget(widget)) return;
    const p = widget['widget-data-path'];
    if (typeof p === 'string' && p.length > 0) {
      tablePaths.push(p);
    } else if (p && typeof p === 'object') {
      Object.values(p as Record<string, unknown>).forEach((sub) => {
        if (typeof sub === 'string' && sub.length > 0) tablePaths.push(sub);
      });
    }
  });

  for (const path of tablePaths) {
    const val = snapshot[path];
    if (Array.isArray(val)) {
      return val;
    }
  }

  return [];
}
