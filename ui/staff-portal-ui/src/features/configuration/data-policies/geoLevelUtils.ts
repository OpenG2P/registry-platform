import type { GeoLevel } from '@/features/configuration/shared/types/geo';

export function orderGeoLevelsByHierarchy(levels: GeoLevel[]): GeoLevel[] {
    const result: GeoLevel[] = [];
    const visited = new Set<string>();
    let current = levels.find((level) => !level.parent_level_id);

    while (current && !visited.has(current.level_id)) {
        visited.add(current.level_id);
        result.push(current);
        current = levels.find((level) => level.parent_level_id === current!.level_id);
    }

    return result;
}

export function findGeoLevelByMnemonic(levels: GeoLevel[], mnemonic: string): GeoLevel | undefined {
    return levels.find((level) => level.level_mnemonic === mnemonic);
}
