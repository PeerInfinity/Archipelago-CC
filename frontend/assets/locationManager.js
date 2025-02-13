// locationManager.js
import { evaluateRule } from './ruleEngine.js';

export class LocationManager {
  constructor() {
    this.locations = [];
    this.regions = {};
    this.previousReachable = new Set();
    this.mode = null;
    this.settings = null;
    this.startRegions = null;
  }

  loadFromJSON(jsonData) {
    if (!jsonData.version || jsonData.version !== 3) {
      throw new Error('Invalid JSON format: requires version 3');
    }

    // Store complete data
    this.regions = jsonData.regions['1']; // Store player 1's region data
    this.itemData = jsonData.items['1']; // Store player 1's item data
    this.groupData = jsonData.item_groups['1']; // Store player 1's item groups
    this.progressionMapping = jsonData.progression_mapping['1']; // Store progression mapping
    this.mode = jsonData.mode?.['1']; // Store game mode if available
    this.settings = jsonData.settings?.['1']; // Store game settings if available
    this.startRegions = jsonData.start_regions?.['1']; // Store start region data if available

    // Convert region-based locations into flat array
    this.locations = Object.values(this.regions).flatMap((region) => {
      return region.locations.map((location) => ({
        ...location,
        region: region.name,
        player: region.player,
        path_rules: this.buildPathRules(region),
      }));
    });

    console.log('Loaded data:', {
      regionCount: Object.keys(this.regions).length,
      locationCount: this.locations.length,
      itemCount: Object.keys(this.itemData).length,
      groupCount: this.groupData?.length || 0,
    });
  }

  buildPathRules(region) {
    // Combine region rules and entrance rules to determine path access
    const rules = [];

    // Add region-specific rules
    if (region.region_rules && region.region_rules.length) {
      rules.push(...region.region_rules);
    }

    // Add entrance access rules
    if (region.entrances && region.entrances.length) {
      region.entrances.forEach((entrance) => {
        if (entrance.access_rule) {
          rules.push(entrance.access_rule);
        }
      });
    }

    // Return composite rule if we have multiple rules
    if (rules.length > 1) {
      return {
        type: 'and',
        conditions: rules,
      };
    } else if (rules.length === 1) {
      return rules[0];
    }

    return null;
  }

  getProcessedLocations(
    inventory,
    sorting = 'original',
    showReachable = true,
    showUnreachable = true
  ) {
    return this.locations
      .slice()
      .sort((a, b) => {
        if (sorting === 'accessibility') {
          const aAccessible = this.isLocationAccessible(a, inventory);
          const bAccessible = this.isLocationAccessible(b, inventory);
          return bAccessible - aAccessible;
        }
        return 0;
      })
      .filter((location) => {
        const isAccessible = this.isLocationAccessible(location, inventory);
        return (
          (isAccessible && showReachable) || (!isAccessible && showUnreachable)
        );
      });
  }

  isLocationAccessible(location, inventory) {
    try {
      const accessRuleResult = evaluateRule(location.access_rule, inventory);
      const pathRulesResult = evaluateRule(location.path_rules, inventory);
      return accessRuleResult && pathRulesResult;
    } catch (error) {
      console.error(`Error evaluating rules for ${location.name}:`, error);
      return false;
    }
  }

  getNewlyReachableLocations(inventory) {
    const currentReachable = new Set(
      this.locations
        .filter((loc) => this.isLocationAccessible(loc, inventory))
        .map((loc) => `${loc.player}-${loc.name}`)
    );

    const newlyReachable = new Set(
      [...currentReachable].filter((x) => !this.previousReachable.has(x))
    );

    this.previousReachable = currentReachable;
    return newlyReachable;
  }
}
