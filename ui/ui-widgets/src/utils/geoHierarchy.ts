/**
 * Geo Hierarchy Builder
 * Manages geo hierarchy state and builds hierarchy JSON structure
 */

export interface GeoLevelData {
  level: string;
  level_value_id: string;
  level_value_mnemonic: string;
}

interface HierarchyState {
  levels: Map<string, GeoLevelData>; // level -> GeoLevelData
  order: string[]; // Ordered list of levels
}

class GeoHierarchyBuilder {
  private hierarchies: Map<string, HierarchyState> = new Map();

  /**
   * Get or create hierarchy state for a group
   */
  private getHierarchy(groupId: string = 'default'): HierarchyState {
    if (!this.hierarchies.has(groupId)) {
      this.hierarchies.set(groupId, {
        levels: new Map(),
        order: [],
      });
    }
    return this.hierarchies.get(groupId)!;
  }

  /**
   * Add a level to the hierarchy
   */
  addLevel(
    level: string,
    level_value_id: string,
    level_value_mnemonic: string,
    groupId: string = 'default'
  ): void {
    const hierarchy = this.getHierarchy(groupId);
    
    // If level already exists, remove it and everything after it
    const existingIndex = hierarchy.order.indexOf(level);
    if (existingIndex >= 0) {
      // Remove this level and all subsequent levels
      const levelsToRemove = hierarchy.order.slice(existingIndex);
      levelsToRemove.forEach((l) => {
        hierarchy.levels.delete(l);
        hierarchy.order = hierarchy.order.filter((o) => o !== l);
      });
    }

    // Add new level
    hierarchy.levels.set(level, {
      level,
      level_value_id,
      level_value_mnemonic,
    });
    hierarchy.order.push(level);
  }

  /**
   * Remove a level and all levels below it
   */
  removeLevelAndBelow(level: string, groupId: string = 'default'): void {
    const hierarchy = this.getHierarchy(groupId);
    const index = hierarchy.order.indexOf(level);
    
    if (index >= 0) {
      // Remove this level and all subsequent levels
      const levelsToRemove = hierarchy.order.slice(index);
      levelsToRemove.forEach((l) => {
        hierarchy.levels.delete(l);
        hierarchy.order = hierarchy.order.filter((o) => o !== l);
      });
    }
  }

  /**
   * Build hierarchy JSON structure
   */
  buildHierarchyJson(groupId: string = 'default'): {
    geo_lowest_level_value_id: string;
    geo_code_hierarchy_json: {
      hierarchy: Array<{
        level: string;
        level_value_id: string;
        level_value_mnemonic: string;
      }>;
      lowest_level_value_id: string;
    };
  } | null {
    const hierarchy = this.getHierarchy(groupId);
    
    if (hierarchy.order.length === 0) {
      return null;
    }

    const hierarchyArray = hierarchy.order.map((level) => {
      const data = hierarchy.levels.get(level)!;
      return {
        level: data.level,
        level_value_id: data.level_value_id,
        level_value_mnemonic: data.level_value_mnemonic,
      };
    });

    const lowestLevel = hierarchy.order[hierarchy.order.length - 1];
    const lowestLevelData = hierarchy.levels.get(lowestLevel)!;

    return {
      geo_lowest_level_value_id: lowestLevelData.level_value_id,
      geo_code_hierarchy_json: {
        hierarchy: hierarchyArray,
        lowest_level_value_id: lowestLevelData.level_value_id,
      },
    };
  }

  /**
   * Clear hierarchy for a group
   */
  clear(groupId: string = 'default'): void {
    this.hierarchies.delete(groupId);
  }

  /**
   * Clear all hierarchies
   */
  clearAll(): void {
    this.hierarchies.clear();
  }

  /**
   * Get current levels for a group
   */
  getLevels(groupId: string = 'default'): GeoLevelData[] {
    const hierarchy = this.getHierarchy(groupId);
    return hierarchy.order.map((level) => hierarchy.levels.get(level)!);
  }
}

// Singleton instance
export const geoHierarchyBuilder = new GeoHierarchyBuilder();
