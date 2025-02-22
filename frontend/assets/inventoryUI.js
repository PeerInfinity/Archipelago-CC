import stateManager from './stateManagerSingleton.js';

export class InventoryUI {
  constructor(gameUI) {
    this.gameUI = gameUI;
    this.itemData = null;
    this.hideUnowned = true; // Changed to true to match default checkbox state
    this.attachEventListeners();
    this.handleEventCollection = this.handleEventCollection.bind(this);
    stateManager.addItemCollectionCallback(this.handleEventCollection);
  }

  initialize(itemData, groups) {
    this.itemData = itemData;
    this.initializeUI(itemData, groups);
  }

  initializeUI(itemData, groups) {
    const inventoryContainer = document.getElementById('inventory-groups');
    inventoryContainer.innerHTML = '';

    // First handle all regular item groups
    groups.sort().forEach((group) => {
      const groupItems = Object.entries(itemData)
        .filter(
          ([_, data]) => data.groups.includes(group) && !data.event // Exclude event items from regular groups
        )
        .sort(([a], [b]) => a.localeCompare(b));

      if (groupItems.length > 0) {
        this.createGroupDiv(inventoryContainer, group, groupItems);
      }
    });

    // Then handle event items in their own group at the end
    const eventItems = Object.entries(itemData)
      .filter(([_, data]) => data.event)
      .sort(([a], [b]) => a.localeCompare(b));

    if (eventItems.length > 0) {
      this.createGroupDiv(inventoryContainer, 'Events', eventItems);
    }

    this.attachItemEventListeners();

    // Initialize the state of all items, including events
    Object.entries(itemData).forEach(([name, _]) => {
      const count = stateManager.getItemCount(name);
      if (count > 0) {
        const buttons = document.querySelectorAll(`[data-item="${name}"]`);
        buttons.forEach((button) => {
          button.classList.add('active');
          const container = button.closest('.item-container');
          if (count > 1) {
            let countBadge = container.querySelector('.count-badge');
            if (!countBadge) {
              countBadge = document.createElement('div');
              countBadge.className = 'count-badge';
              container.appendChild(countBadge);
            }
            countBadge.textContent = count;
            countBadge.style.display = 'flex';
          }
        });
      }
    });

    this.updateDisplay();
  }

  createGroupDiv(container, groupName, items) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'inventory-group';
    groupDiv.innerHTML = `
      <h3>${groupName}</h3>
      <div class="inventory-items">
        ${items
          .map(
            ([name, data]) => `
            <div class="item-container">
              <button 
                class="item-button" 
                data-item="${name}"
                title="${name}"
                data-advancement="${data.advancement}"
                data-priority="${data.priority}"
                data-useful="${data.useful}"
              >
                ${name}
              </button>
            </div>
          `
          )
          .join('')}
      </div>
    `;
    container.appendChild(groupDiv);
  }

  attachItemEventListeners() {
    document.querySelectorAll('.item-button').forEach((button) => {
      button.addEventListener('click', () => {
        const itemName = button.dataset.item;
        this.toggleItem(itemName);
      });
    });
  }

  attachEventListeners() {
    const hideUnownedCheckbox = document.getElementById('hide-unowned');
    if (hideUnownedCheckbox) {
      hideUnownedCheckbox.addEventListener('change', (e) => {
        this.hideUnowned = e.target.checked;
        this.updateDisplay();
      });
    }
  }

  updateDisplay() {
    if (!this.itemData) return;

    document.querySelectorAll('.inventory-group').forEach((group) => {
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

      group.style.display = visibleItems > 0 ? '' : 'none';
    });
  }

  toggleItem(itemName) {
    if (!this.itemData || !this.itemData[itemName]) return;

    const currentCount = stateManager.getItemCount(itemName);

    const buttons = document.querySelectorAll(`[data-item="${itemName}"]`);
    const containers = Array.from(buttons).map((button) =>
      button.closest('.item-container')
    );

    stateManager.addItemToInventory(itemName);

    buttons.forEach((button) => button.classList.add('active'));

    containers.forEach((container) => {
      let countBadge = container.querySelector('.count-badge');
      if (!countBadge) {
        countBadge = document.createElement('div');
        countBadge.className = 'count-badge';
        container.appendChild(countBadge);
      }

      if (currentCount + 1 > 1) {
        countBadge.textContent = currentCount + 1;
        countBadge.style.display = 'flex';
      } else {
        countBadge.style.display = 'none';
      }
    });

    if (window.consoleManager) {
      window.consoleManager.print(
        `${itemName} count: ${currentCount + 1}`,
        'info'
      );
    }

    stateManager.invalidateCache();
    this.updateDisplay(); // Add this line before updating the view
    this.gameUI.updateViewDisplay();
  }

  handleEventCollection(itemName, count) {
    const buttons = document.querySelectorAll(`[data-item="${itemName}"]`);
    const containers = Array.from(buttons).map((button) =>
      button.closest('.item-container')
    );

    buttons.forEach((button) => button.classList.add('active'));

    containers.forEach((container) => {
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
    });

    this.updateDisplay();
    this.gameUI.updateViewDisplay();
  }

  clear() {
    this.itemData = null;
    document.querySelectorAll('.item-button').forEach((button) => {
      button.classList.remove('active');
      const countBadge = button
        .closest('.item-container')
        ?.querySelector('.count-badge');
      if (countBadge) {
        countBadge.style.display = 'none';
      }
    });

    const container = document.getElementById('inventory-groups');
    if (container) container.innerHTML = '';
  }
}
