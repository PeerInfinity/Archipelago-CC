// frontend/assets/games/alttp/inventory.js
import { GameInventory } from '../../helpers/index.js';

export class ALTTPInventory extends GameInventory {
  constructor(
    items = [],
    excludeItems = [],
    progressionMapping = {},
    itemData = {}
  ) {
    super();
    console.debug('Creating ALTTPInventory with:', {
      items,
      excludeItems,
      progressionMapping: !!progressionMapping,
      itemData: !!itemData,
    });

    this.items = new Map();
    this.progressionMapping = progressionMapping;
    this.itemData = itemData;

    // Initialize all items to 0
    if (itemData) {
      Object.keys(itemData).forEach((itemName) => {
        this.items.set(itemName, 0);
      });
    }

    // Add initial items if any
    items.forEach((itemName) => {
      console.debug(`Adding initial item: ${itemName}`);
      this.addItem(itemName);
    });
  }

  addItem(itemName) {
    const currentCount = this.items.get(itemName) || 0;
    const newCount = currentCount + 1;
    console.debug(`Adding item ${itemName}: ${currentCount} -> ${newCount}`);
    this.items.set(itemName, newCount);
  }

  has(itemName) {
    if (this.items.get(itemName) > 0) {
      return true;
    }

    // Check progressive items
    if (this.progressionMapping) {
      for (const [baseItem, progression] of Object.entries(
        this.progressionMapping
      )) {
        const baseCount = this.items.get(baseItem) || 0;
        for (const upgrade of progression.items) {
          if (
            (upgrade.name === itemName ||
              upgrade.provides?.includes(itemName)) &&
            baseCount >= upgrade.level
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  getItemState(itemName) {
    return {
      directCount: this.items.get(itemName) || 0,
      isExcluded: false,
      progressiveInfo: this.getProgressiveItemInfo(itemName),
      itemData: this.itemData[itemName],
    };
  }

  getProgressiveItemInfo(itemName) {
    const progressiveInfo = {};

    for (const [baseItem, progression] of Object.entries(
      this.progressionMapping
    )) {
      const baseCount = this.items.get(baseItem) || 0;
      const relevantUpgrades = progression.items.filter(
        (upgrade) =>
          upgrade.name === itemName || upgrade.provides?.includes(itemName)
      );

      if (relevantUpgrades.length > 0) {
        progressiveInfo[baseItem] = {
          currentCount: baseCount,
          upgrades: relevantUpgrades,
          provides: relevantUpgrades.some(
            (upgrade) => baseCount >= upgrade.level
          ),
        };
      }
    }

    return progressiveInfo;
  }

  count(itemName) {
    const directCount = this.items.get(itemName) || 0;
    const progressiveInfo = this.getProgressiveItemInfo(itemName);

    this.log({
      message: `Count check for ${itemName}`,
      directCount,
      progressiveInfo,
    });

    return directCount;
  }

  countGroup(groupName) {
    let count = 0;
    const groupMembers = [];

    this.items.forEach((itemCount, itemName) => {
      const itemInfo = this.itemData[itemName];
      if (itemInfo && itemInfo.groups.includes(groupName)) {
        count += itemCount;
        groupMembers.push({ item: itemName, count: itemCount });
      }
    });

    this.log({
      message: `Group ${groupName} count: ${count}`,
      members: groupMembers,
    });

    return count;
  }
}
