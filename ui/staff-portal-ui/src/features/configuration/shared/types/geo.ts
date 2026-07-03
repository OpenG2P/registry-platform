export interface GeoLevel {
    level_id: string;
    level_mnemonic: string;
    parent_level_id: string | null;
}

export interface GeoLevelValue {
    level_value_id: string;
    level_id: string;
    level_value_mnemonic: string;
    parent_level_value_id: string;
}

export interface PaginationMeta {
    number_of_items: number;
    number_of_pages: number;
}
