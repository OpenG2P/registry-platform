export type GeoHierarchyLevel = {
    level: string;
    level_value_id: string;
    level_value_mnemonic: string;
};

export type GeoHierarchyRecord = GeoHierarchyLevel[];

export type GeoLocationSelection = {
    hierarchy: GeoHierarchyRecord;
    displayName: string;
    displayPath: string;
};
