import type { GeoHierarchyRecord, GeoLocationSelection } from './geoLocationTypes';
import type { PolicyFilterExpression } from './policyFilterExpression';

export function geoHierarchyKey(hierarchy: GeoHierarchyRecord): string {
    return hierarchy.map((item) => `${item.level}:${item.level_value_id}`).join('|');
}

export function selectionFromHierarchy(hierarchy: GeoHierarchyRecord): GeoLocationSelection {
    const leaf = hierarchy[hierarchy.length - 1];
    const parents = hierarchy.slice(0, -1);

    return {
        hierarchy,
        displayName: leaf?.level_value_mnemonic || '',
        displayPath: parents.map((item) => item.level_value_mnemonic).join(' > '),
    };
}

export function mergeGeoLocationSelections(
    existing: GeoLocationSelection[],
    incoming: GeoLocationSelection[],
): GeoLocationSelection[] {
    const merged = new Map(
        existing.map((selection) => [geoHierarchyKey(selection.hierarchy), selection]),
    );
    incoming.forEach((selection) => {
        merged.set(geoHierarchyKey(selection.hierarchy), selection);
    });
    return Array.from(merged.values());
}

function hierarchyToConditionGroup(hierarchy: GeoHierarchyRecord): PolicyFilterExpression {
    return {
        type: 'GROUP',
        operator: 'AND',
        children: hierarchy.map((item) => ({
            type: 'CONDITION',
            field_id: item.level,
            operator: 'eq',
            value: item.level_value_mnemonic,
        })),
    };
}

export function toGeoPolicyFilterExpression(
    selections: GeoLocationSelection[],
): PolicyFilterExpression {
    return {
        type: 'GROUP',
        operator: 'AND',
        children: selections.map((selection) =>
            hierarchyToConditionGroup(selection.hierarchy),
        ),
    };
}

export function formatGeoHierarchyRecord(hierarchy: GeoHierarchyRecord): string {
    return hierarchy.map((item) => `${item.level}: ${item.level_value_mnemonic}`).join(' › ');
}
