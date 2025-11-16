# Remaining Exporter Issues for Factorio

## Issue 2: Progressive item resolution in StateManager

**Status:** In Progress
**Priority:** Critical
**Type:** StateManager/Inventory

**Description:**
The StateManager is not resolving progressive items correctly. When a player receives `progressive-science-pack`, it should grant the corresponding level of science pack (e.g., `logistic-science-pack` for level 1) based on how many progressive-science-pack items have been collected.

**Current Behavior:**
- Player receives `progressive-science-pack` item
- The item is added to inventory as-is
- When checking for `logistic-science-pack`, it's not found
- Access rules that check for `logistic-science-pack` fail

**Expected Behavior:**
- Player receives `progressive-science-pack` item
- StateManager looks up progression_mapping for this item
- Grants the appropriate level-specific item (logistic-science-pack, military-science-pack, etc.) based on count
- Access rules that check for the level-specific item should pass

**Affected Locations:**
- "Automate logistic-science-pack" and similar automation locations that require specific science pack technologies

**Files to Check:**
- `frontend/modules/stateManager/core/inventoryManager.js` - Inventory management
- `frontend/modules/stateManager/core/initialization.js` - Progressive item resolution
- `frontend/modules/stateManager/stateManager.js` - Main state manager

**Next Steps:**
1. Check how inventoryManager resolves progressive items
2. Verify that progression_mapping from rules.json is loaded
3. Implement progressive item resolution if missing
4. Test with progressive-science-pack → logistic-science-pack resolution
