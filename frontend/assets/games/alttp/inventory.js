import { ALTTPState } from './state.js';

// frontend/assets/games/alttp/inventory.js

export class ALTTPInventory {
  constructor(items = [], progressionMapping = {}, itemData = {}) {
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
      this.addItem(itemName);
    });
  }

  addItem(itemName) {
    const currentCount = this.items.get(itemName) || 0;
    this.items.set(itemName, currentCount + 1);
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
    return directCount;
  }

  countGroup(groupName) {
    let count = 0;
    this.items.forEach((itemCount, itemName) => {
      const itemInfo = this.itemData[itemName];
      // Only count items that have group data and belong to the specified group
      if (itemInfo?.groups?.includes(groupName)) {
        count += itemCount;
      }
    });
    return count;
  }
}
