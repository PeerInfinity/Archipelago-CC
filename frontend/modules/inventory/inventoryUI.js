import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import connection from '../client/core/connection.js';
import messageHandler from '../client/core/messageHandler.js';
import eventBus from '../../app/core/eventBus.js';

export class InventoryUI {
  // Add constants for special groups
  static SPECIAL_GROUPS = {
    EVENTS: 'Events',
  };

  constructor(gameUI) {
    this.gameUI = gameUI;
    this.itemData = null;
    this.groupNames = [];
    this.hideUnowned = true;
    this.hideCategories = false;
    this.sortAlphabetically = false;
    this.rootElement = this.createRootElement();
    this.groupedContainer = this.rootElement.querySelector('#inventory-groups');
    this.flatContainer = this.rootElement.querySelector('#inventory-flat');
    this.unsubscribeHandles = [];
    this.attachControlEventListeners();
    this.isInitialized = false;
  }

  createRootElement() {
    const element = document.createElement('div');
    element.classList.add('inventory-panel-container', 'panel-container');
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.height = '100%';
    element.style.overflow = 'hidden';

    element.innerHTML = `
        <div class="sidebar-header" style="flex-shrink: 0;">
          <h2>Inventory</h2>
          <!-- Expand button might need separate logic if needed outside GL -->
        </div>
        <div class="inventory-controls" style="flex-shrink: 0;">
          <label>
            <input type="checkbox" id="hide-unowned" checked />
            Hide unowned items
          </label>
          <div class="checkbox-container">
            <input type="checkbox" id="hide-categories" />
            <label for="hide-categories">Hide categories</label>
          </div>
          <div class="checkbox-container">
            <input type="checkbox" id="sort-alphabetically" />
            <label for="sort-alphabetically">Sort alphabetically</label>
          </div>
        </div>
        <div id="inventory-groups" class="sidebar-content" style="flex-grow: 1; overflow-y: auto;">
          <!-- Populated by JS -->
        </div>
        <div id="inventory-flat" class="sidebar-content" style="display: none; flex-grow: 1; overflow-y: auto;">
          <!-- Populated by JS -->
        </div>
        `;
    return element;
  }

  getRootElement() {
    return this.rootElement;
  }

  initializeUI(itemData, groupNames) {
    this.itemData = itemData || {};
    this.groupNames = Array.isArray(groupNames) ? groupNames : [];

    const groupedContainer = this.groupedContainer;
    const flatContainer = this.flatContainer;
    groupedContainer.innerHTML = '';
    flatContainer.innerHTML = '';
    const flatGroup = document.createElement('div');
    flatGroup.className = 'inventory-group';
    const flatItems = document.createElement('div');
    flatItems.className = 'inventory-items';
    flatGroup.appendChild(flatItems);
    flatContainer.appendChild(flatGroup);

    const sortedGroupNames = [...this.groupNames].sort((a, b) =>
      a.localeCompare(b)
    );

    sortedGroupNames.forEach((groupName) => {
      const groupItems = Object.entries(this.itemData).filter(
        ([_, data]) =>
          data.groups && data.groups.includes(groupName) && !data.event
      );

      if (this.sortAlphabetically) {
        groupItems.sort(([a], [b]) => a.localeCompare(b));
      }

      if (groupItems.length > 0) {
        this.createGroupDiv(groupedContainer, groupName, groupItems);
      }
    });

    const eventItems = Object.entries(this.itemData).filter(
      ([_, data]) => data.event
    );

    if (this.sortAlphabetically) {
      eventItems.sort(([a], [b]) => a.localeCompare(b));
    }

    if (eventItems.length > 0) {
      this.createGroupDiv(
        groupedContainer,
        InventoryUI.SPECIAL_GROUPS.EVENTS,
        eventItems
      );
    }

    const addedToFlat = new Set();
    let flatItemsList = Object.entries(this.itemData);
    if (this.sortAlphabetically) {
      flatItemsList.sort(([a], [b]) => a.localeCompare(b));
    }
    flatItemsList.forEach(([name, _]) => {
      if (!addedToFlat.has(name)) {
        this.createItemDiv(flatItems, name);
        addedToFlat.add(name);
      }
    });

    this.attachItemEventListeners();
    this.updateDisplay();
  }

  createItemDiv(container, name) {
    const itemContainer = document.createElement('div');
    itemContainer.className = 'item-container';
    itemContainer.innerHTML = `
      <button 
        class="item-button" 
        data-item="${name}"
        title="${name}"
      >
        ${name}
      </button>
    `;

    container.appendChild(itemContainer);
  }

  updateDisplay() {
    if (!this.itemData) return;

    const groupedContainer = this.groupedContainer;
    const flatContainer = this.flatContainer;

    if (this.hideCategories) {
      groupedContainer.style.display = 'none';
      flatContainer.style.display = '';
      this.updateVisibility(flatContainer);
    } else {
      flatContainer.style.display = 'none';
      groupedContainer.style.display = '';
      this.updateVisibility(groupedContainer);
    }
  }

  updateVisibility(container) {
    const groups = container.querySelectorAll('.inventory-group');
    groups.forEach((group) => {
      const items = group.querySelectorAll('.item-container');
      let visibleItems = 0;

      items.forEach((container) => {
        const button = container.querySelector('.item-button');
        const isOwned = button.classList.contains('active');

        if (this.hideUnowned && !isOwned) {
          container.style.display = 'none';
        } else {
          container.style.display = '';
          visibleItems++;
        }
      });

      if (!this.hideCategories) {
        group.style.display = visibleItems > 0 ? '' : 'none';
      }
    });
  }

  createGroupDiv(container, groupName, items) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'inventory-group';
    groupDiv.innerHTML = `<h3>${groupName}</h3>`;

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'inventory-items';

    items.forEach(([name, _]) => {
      this.createItemDiv(itemsDiv, name);
    });

    groupDiv.appendChild(itemsDiv);
    container.appendChild(groupDiv);
  }

  attachItemEventListeners() {
    this.rootElement.querySelectorAll('.item-button').forEach((button) => {
      button.addEventListener('click', (event) => {
        const itemName = button.dataset.item;
        this.modifyItemCount(itemName, event.shiftKey);
      });
    });
  }

  attachControlEventListeners() {
    const hideUnownedCheckbox = this.rootElement.querySelector('#hide-unowned');
    const hideCategoriesCheckbox =
      this.rootElement.querySelector('#hide-categories');
    const sortAlphabeticallyCheckbox = this.rootElement.querySelector(
      '#sort-alphabetically'
    );

    hideUnownedCheckbox.addEventListener('change', (event) => {
      this.hideUnowned = event.target.checked;
      this.updateDisplay();
    });

    hideCategoriesCheckbox.addEventListener('change', (event) => {
      this.hideCategories = event.target.checked;
      this.updateDisplay();
    });

    sortAlphabeticallyCheckbox.addEventListener('change', (event) => {
      this.sortAlphabetically = event.target.checked;
      if (this.itemData && this.groupNames) {
        this.initializeUI(this.itemData, this.groupNames);
      } else {
        console.warn(
          '[InventoryUI] Cannot re-sort: State or rules not available.'
        );
      }
    });
  }

  attachEventBusListeners() {
    if (this.unsubscribeHandles.length > 0) {
      console.warn(
        '[InventoryUI] attachEventBusListeners called multiple times? Clearing previous listeners.'
      );
      this.destroy();
    }

    console.log('[InventoryUI] Attaching event bus listeners...');

    const readyUnsubscribe = eventBus.subscribe('stateManager:ready', () => {
      console.log('[InventoryUI] Received stateManager:ready event.');
      if (!this.isInitialized) {
        console.log('[InventoryUI] Performing initial sync and render.');
        this.syncWithState();
        this.isInitialized = true;
      }
    });
    this.unsubscribeHandles.push(readyUnsubscribe);
    console.log('[InventoryUI] Subscribed to stateManager:ready');

    let unsubscribeSnapshot = eventBus.subscribe(
      'stateManager:snapshotUpdated',
      this._handleSnapshotUpdated.bind(this)
    );
    this.unsubscribeHandles.push(unsubscribeSnapshot);
    console.log('[InventoryUI] Subscribed to stateManager:snapshotUpdated');

    let unsubscribeInventory = eventBus.subscribe(
      'stateManager:inventoryChanged',
      this._handleInventoryChanged.bind(this)
    );
    this.unsubscribeHandles.push(unsubscribeInventory);
    console.log('[InventoryUI] Subscribed to stateManager:inventoryChanged');
  }

  _handleSnapshotUpdated(snapshotData) {
    if (this.isInitialized) {
      if (snapshotData) {
        this.syncWithState();
      } else {
        console.warn(
          '[InventoryUI] snapshotUpdated event received null snapshotData?'
        );
      }
    }
  }

  _handleInventoryChanged() {
    if (this.isInitialized) {
      this.syncWithState();
    }
  }

  destroy() {
    console.log('[InventoryUI] Destroying listeners...');
    this.unsubscribeHandles.forEach((unsubscribe) => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.unsubscribeHandles = [];
    console.log('[InventoryUI] Listeners destroyed.');
  }

  createOrUpdateCountBadge(container, count) {
    if (!container) return;

    let countBadge = container.querySelector('.count-badge');
    if (!countBadge) {
      countBadge = document.createElement('div');
      countBadge.className = 'count-badge';
      container.appendChild(countBadge);
    }

    if (count > 1) {
      countBadge.textContent = count;
      countBadge.style.display = 'flex';
    } else {
      countBadge.style.display = 'none';
    }
  }

  modifyItemCount(itemName, isShiftPressed = false) {
    if (!stateManager) {
      console.error(
        '[InventoryUI] StateManager proxy not available for modifyItemCount'
      );
      return;
    }
    if (isShiftPressed) {
      console.warn(
        '[InventoryUI] Shift-click (remove item) not yet implemented via worker command.'
      );
    } else {
      stateManager.addItemToInventory(itemName);
    }
  }

  clear() {
    this.itemData = null;
    this.rootElement.querySelectorAll('.item-button').forEach((button) => {
      button.classList.remove('active');
      const countBadge = button
        .closest('.item-container')
        ?.querySelector('.count-badge');
      if (countBadge) {
        countBadge.style.display = 'none';
      }
    });

    const groupedContainer = this.groupedContainer;
    const flatContainer = this.flatContainer;
    if (groupedContainer) groupedContainer.innerHTML = '';
    if (flatContainer) flatContainer.innerHTML = '';
  }

  initialize() {
    console.log('[InventoryUI] Initializing panel...');
    this.isInitialized = false;
    this.attachEventBusListeners();
  }

  async syncWithState() {
    console.log('[InventoryUI] syncWithState called.');

    const snapshotData = stateManager.getLatestStateSnapshot();
    if (!snapshotData) {
      console.warn('[InventoryUI] syncWithState: Snapshot data is null.');
      this.displayError('Snapshot data not available.');
      return;
    }

    if (!this.itemData) {
      let staticData = stateManager?.getStaticData();
      let itemData = staticData?.items;
      let groupData = staticData?.groups;
      let groupNames = groupData ? Object.keys(groupData) : [];
      if (!itemData || !groupData) {
        console.error(
          '[InventoryUI] Failed to get item/group data from proxy in syncWithState.'
        );
        this.displayError('Failed to retrieve static item/group data.');
        return;
      }
      this.itemData = itemData;
      console.log(
        '[InventoryUI] Initializing UI structure with fetched static data.'
      );
      this.initializeUI(this.itemData, groupNames);
    }

    const inventoryCounts = snapshotData.inventory || {};

    if (!this.rootElement) {
      console.error('[InventoryUI] syncWithState: rootElement is null!');
      return;
    }

    Object.keys(this.itemData).forEach((itemName) => {
      const count = inventoryCounts[itemName] || 0;
      const itemElement = this.rootElement.querySelector(
        `.item-button[data-item="${itemName}"]`
      );
      if (itemElement) {
        itemElement.classList.toggle('active', count > 0);
        const container = itemElement.closest('.item-container');
        this.createOrUpdateCountBadge(container, count);
      }
    });

    this.updateDisplay();
  }

  displayError(message) {
    if (this.rootElement) {
      let errorContainer = this.rootElement.querySelector(
        '.inventory-error-message'
      );
      if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.className =
          'inventory-error-message panel-error-message';
        this.rootElement.prepend(errorContainer);
      }
      errorContainer.textContent = message;
      const grid = this.rootElement.querySelector('#inventory-grid');
      if (grid) grid.style.display = 'none';
    }
  }
}
