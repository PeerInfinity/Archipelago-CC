# Modules Panel Implementation Plan

**Created:** 2026-02-25
**Status:** Pending
**Priority:** High

## Overview

Finish implementing the Modules panel with six changes:

1. Central panel-close-to-checkbox sync in panelManager
2. Remove priority up/down buttons
3. Wire up external module loading from URL
4. Use `moduleInfo.column` and stack IDs for panel placement
5. Support multiple instances of the same panel type (for iframe panels)
6. Create new stacks dynamically when needed

## 1. Central Panel Close → Checkbox Sync

**Problem:** When a user closes a panel tab in Golden Layout, only 3 of ~20 modules manually publish `ui:panelManuallyClosed`. The rest silently close without updating the Modules panel checkbox.

**Solution:** Move the `ui:panelManuallyClosed` publish into panelManager's `itemDestroyed` handler, so it fires centrally for every panel close, using centralRegistry to look up the moduleId.

### Files to change

**`frontend/app/core/panelManager.js`** — In the `itemDestroyed` handler (around line 121):

```javascript
// After existing removeMappingByPanelId call:
this.goldenLayout.on('itemDestroyed', (item) => {
  if (item.isComponent) {
    const componentType = item.componentType;
    const panelId = item.id;

    // Existing cleanup
    if (this.panelMapById.has(panelId)) {
      this.removeMappingByPanelId(panelId);
    }

    // NEW: Publish ui:panelManuallyClosed centrally
    const componentEntry = centralRegistry.panelComponents.get(componentType);
    if (componentEntry && componentEntry.moduleId) {
      eventBus.publish('ui:panelManuallyClosed', {
        moduleId: componentEntry.moduleId
      }, 'panelManager');
    }
  }
});
```

**Impact:** The existing subscriber in `frontend/app/initialization/index.js:391-404` already listens for `ui:panelManuallyClosed` and sets `moduleState.enabled = false` then publishes `module:stateChanged`. The modules panel already listens for `module:stateChanged` and updates the checkbox. So the full chain is already wired — only the first event publication is missing.

**Edge case — programmatic disable:** When `disableModule()` is called, it calls `destroyPanelByComponentType()`, which triggers `itemDestroyed`, which would now publish `ui:panelManuallyClosed`. But `disableModule()` already sets `moduleState.enabled = false` before destroying the panel. The handler in index.js:392 checks `moduleState.enabled !== false` before acting, so the duplicate event is harmless.

**Optional cleanup:** The 3 modules that manually publish `ui:panelManuallyClosed` (client, timerPanel, pathAnalyzerPanel) can have those calls removed since panelManager now handles it centrally. This is a nice-to-have, not required — the existing handler's `enabled !== false` guard prevents double-processing.

### Dependency

panelManager needs access to centralRegistry and eventBus. Check whether it already imports them; if not, add imports.

---

## 2. Remove Priority Buttons

**Problem:** The up/down buttons (▲ ▼) exist in the modules panel UI but have no event listeners and no backend implementation. Implementing priority reordering at runtime would require a major refactor with unclear benefit.

**Solution:** Remove the buttons entirely.

### Files to change

**`frontend/modules/modules/modulesUI.js`** — In `_renderModules()` (around lines 330-340):

- Remove the creation of `upButton` and `downButton` elements
- Remove `controlsDiv.appendChild(upButton)` and `controlsDiv.appendChild(downButton)`
- Remove the commented-out `_handlePriorityChange` method (lines 411-416)

**CSS cleanup:** The button styling in the CSS block (lines 62-76) can stay since it applies to all buttons in `.module-controls`, including the "Add External Module" button. No CSS changes needed.

---

## 3. External Module Loading from URL

**Problem:** The "Add External Module" button shows a prompt dialog and publishes `module:loadExternalRequest`, but nothing listens for that event. The module never actually loads.

**Solution:** Add a listener for `module:loadExternalRequest` in the initialization orchestrator (or in modulesUI itself) that dynamically imports the module, registers it, initializes it, creates its panel, and updates the modules list.

### Approach

The existing `moduleManagerApi.enableModule()` already handles dynamic import + register + init + panel creation, but it requires a module definition in `combinedModeData.moduleConfig.moduleDefinitions`. For external modules, we need to:

1. Create a temporary module definition with the provided URL/path
2. Add it to `combinedModeData.moduleConfig.moduleDefinitions` and `loadPriority`
3. Call `enableModule()` which handles the rest

### Files to change

**`frontend/app/initialization/index.js`** — Add a listener for `module:loadExternalRequest` after the moduleManagerApi is created (around line 404):

```javascript
eventBus.subscribe('module:loadExternalRequest', async ({ moduleId, modulePath }) => {
  logger.info('init', `Loading external module: ${moduleId} from ${modulePath}`);

  // Create a temporary module definition
  if (!combinedModeData.moduleConfig.moduleDefinitions[moduleId]) {
    combinedModeData.moduleConfig.moduleDefinitions[moduleId] = {
      path: modulePath,
      enabled: true,
      isExternal: true,
    };
    // Add to load priority at the end
    if (!combinedModeData.moduleConfig.loadPriority.includes(moduleId)) {
      combinedModeData.moduleConfig.loadPriority.push(moduleId);
    }
  }

  try {
    await moduleManagerApi.enableModule(moduleId);
    eventBus.publish('module:loaded', { moduleId }, 'core');
  } catch (error) {
    logger.error('init', `Failed to load external module ${moduleId}:`, error);
    eventBus.publish('module:loadFailed', { moduleId, path: modulePath, error: error.message }, 'core');
  }
}, 'core');
```

**`frontend/app/initialization/index.js` — `enableModule()`**: The dynamic import logic (line 601) resolves paths relative to `import.meta.url`. For external modules with absolute URLs or paths starting with `http://`/`https://`, the URL constructor should handle them correctly. For relative paths, they'll resolve relative to the frontend root, which is the intended behavior.

However, there's a subtlety: the path resolution on line 601 does:
```javascript
const resolvedPath = new URL(moduleDefinition.path, new URL('../../', import.meta.url)).href;
```

For absolute URLs (http://...), `new URL('http://example.com/module.js', base)` ignores the base and uses the absolute URL directly — this is correct behavior per the URL spec. For relative paths like `./modules/custom/index.js`, it resolves relative to the frontend root — also correct.

**`frontend/modules/modules/modulesUI.js`** — In `_handleAddExternalModule()`: The current implementation is mostly fine. The sanitization of the path for the moduleId is reasonable. The event publish is correct.

Additionally, remove the block in `_renderModules()` (lines 317-324) that prevents enabling/disabling external modules via checkbox. Once external modules are properly loaded, the same enable/disable flow should work for them.

### Testing approach

To test, serve a simple external module via `python -m http.server`:
1. Create a test module at e.g. `frontend/modules/testExternal/index.js`
2. Load it via the prompt: `./modules/testExternal/index.js`

---

## 4. Panel Placement Using Column and Stack IDs

**Problem:** When `enableModule()` creates a panel via `panelManager.createPanelForComponent()`, it doesn't specify which stack/column to place it in. Golden Layout's `addComponent()` adds to the last active stack, which may not be the right column.

**Solution:** Use the module's `moduleInfo.column` (1=left, 2=middle, 3=right) to find the target stack by its ID (`left-stack`, `middle-stack`, `right-stack`), then add the component to that stack specifically. Fall back to stack index, then to the last stack.

### Column-to-stack mapping

| `moduleInfo.column` | Stack ID | Fallback |
|---------------------|----------|----------|
| 1 | `left-stack` | 1st stack by index |
| 2 | `middle-stack` | 2nd stack by index (or last) |
| 3 | `right-stack` | 3rd stack by index (or last) |
| undefined | — | Default GL behavior (last active stack) |

### Files to change

**`frontend/app/core/panelManager.js`** — Modify `createPanelForComponent()` to accept and use a `targetColumn` parameter:

```javascript
async createPanelForComponent(componentType, title, targetColumn = null, additionalState = {}) {
  // ... existing validation ...

  if (targetColumn) {
    const stack = this._findStackForColumn(targetColumn);
    if (stack) {
      // Add to specific stack instead of using GL's default placement
      stack.addChild({
        type: 'component',
        componentType: componentType,
        title: title || componentType,
        componentState: additionalState
      });
      // Return the newly created item
      const newItem = stack.contentItems[stack.contentItems.length - 1];
      return newItem;
    }
  }

  // Fall through to existing addComponent logic
  // ... existing code ...
}
```

Add a new helper method:

```javascript
_findStackForColumn(column) {
  const columnToStackId = { 1: 'left-stack', 2: 'middle-stack', 3: 'right-stack' };
  const stackId = columnToStackId[column];
  const root = this.goldenLayout.root;

  // Try by stack ID first
  if (stackId) {
    const stack = this._findItemById(root, stackId);
    if (stack) return stack;
  }

  // Fallback: find by stack index
  const stacks = this._getAllStacks(root);
  const index = column - 1;
  if (index < stacks.length) {
    return stacks[index];
  }

  // Final fallback: last stack (or create one — see section 6)
  return stacks[stacks.length - 1] || null;
}

_findItemById(item, id) {
  if (!item) return null;
  if (item.id === id) return item;
  if (item.contentItems) {
    for (const child of item.contentItems) {
      const found = this._findItemById(child, id);
      if (found) return found;
    }
  }
  return null;
}

_getAllStacks(item, stacks = []) {
  if (!item) return stacks;
  if (item.isStack) stacks.push(item);
  if (item.contentItems) {
    for (const child of item.contentItems) {
      this._getAllStacks(child, stacks);
    }
  }
  return stacks;
}
```

**`frontend/app/initialization/index.js`** — In `enableModule()` (around line 801), pass `column` to `createPanelForComponent`:

```javascript
const column = actualModuleObject?.moduleInfo?.column || null;
await panelManagerInstance.createPanelForComponent(
  componentType,
  panelTitle,
  column,  // NEW: pass target column
);
```

---

## 5. Multiple Panel Instances (Iframe Panels)

**Problem:** The module system has a 1-to-1 mapping between moduleId and componentType, and between componentType and panel instance. The user wants to open multiple iframe panels simultaneously.

**Observation:** Golden Layout natively supports multiple components of the same `componentType`. Each gets its own container with a unique `id`. The IframePanelUI already handles this correctly — it filters `iframe:loadUrl` events by `panelId` (line 179).

The limitations are in the module management layer:
- `enableModule()` creates exactly one panel
- `disableModule()` destroys the first matching panel by componentType
- The modules panel checkbox is a single toggle

### Approach: Add a "New Instance" mechanism

Rather than reworking the 1-to-1 moduleId/componentType mapping, add the ability for specific modules to declare they support multiple instances. Then provide a way to create additional instances beyond the one created by `enableModule`.

**moduleInfo change:** Add an optional `allowMultipleInstances: true` field:

```javascript
// In frontend/modules/iframePanel/index.js
export const moduleInfo = {
  name: 'iframePanel',
  title: 'Iframe Panel',
  componentType: 'iframePanel',
  icon: '🖼️',
  column: 3,
  description: 'Iframe Panel display panel.',
  allowMultipleInstances: true,  // NEW
};
```

**panelManager change:** Add a `createAdditionalInstance()` method:

```javascript
async createAdditionalInstance(componentType, title, targetColumn = null, instanceState = {}) {
  // Similar to createPanelForComponent but doesn't check for existing instances
  // Passes instanceState to the component constructor so it knows which instance it is
  const state = { ...instanceState, instanceId: Date.now() };
  // ... use targetColumn logic from section 4, or default placement ...
}
```

**moduleManagerApi change:** Add `createPanelInstance(moduleId, instanceState)`:

```javascript
api.createPanelInstance = async (moduleId, instanceState = {}) => {
  const componentType = centralRegistry.getComponentTypeForModule(moduleId);
  const moduleInstance = importedModules.get(moduleId);
  const moduleInfoObj = moduleInstance?.moduleInfo;

  if (!moduleInfoObj?.allowMultipleInstances) {
    logger.warn('init', `Module ${moduleId} does not support multiple instances.`);
    return null;
  }

  const title = instanceState.title || moduleInfoObj.title || moduleId;
  const column = instanceState.column || moduleInfoObj.column || null;
  return panelManagerInstance.createAdditionalInstance(componentType, title, column, instanceState);
};
```

**disableModule change:** When disabling a module that allows multiple instances, destroy ALL panels of that componentType, not just the first one. Modify `destroyPanelByComponentType` to accept an `all` flag, or add `destroyAllPanelsByComponentType`.

**Modules panel UI change:** For modules with `allowMultipleInstances`, show a "+" button next to the checkbox that calls `moduleManagerApi.createPanelInstance()`.

**IframePanelUI change:** The constructor already receives `componentState`. It can read `instanceState.instanceId` or other properties to differentiate instances. No changes needed to IframePanelUI itself — it already works with unique container IDs.

### Instance state flow

```
createPanelInstance(moduleId, { title: "Map View", url: "..." })
  → panelManager.createAdditionalInstance("iframePanel", "Map View", 3, { title: "Map View", url: "..." })
    → GL.addComponent("iframePanel", "Map View", { title: "Map View", url: "...", instanceId: 12345 })
      → IframePanelUI constructor receives componentState = { title: "Map View", url: "...", instanceId: 12345 }
```

---

## 6. Dynamic Stack Creation

**Problem:** If a module defaults to column 3 but only 2 stacks exist (e.g., compact layout), there's no stack to add it to.

**Solution:** In `_findStackForColumn()` (from section 4), when the target column index exceeds the number of existing stacks, create new stacks to fill the gap.

### Implementation in `_findStackForColumn`:

```javascript
_findStackForColumn(column) {
  const columnToStackId = { 1: 'left-stack', 2: 'middle-stack', 3: 'right-stack' };
  const stackId = columnToStackId[column];
  const root = this.goldenLayout.root;

  // Try by stack ID
  if (stackId) {
    const stack = this._findItemById(root, stackId);
    if (stack) return stack;
  }

  // Try by index
  const stacks = this._getAllStacks(root);
  const targetIndex = column - 1;

  if (targetIndex < stacks.length) {
    return stacks[targetIndex];
  }

  // Create new stacks until we have enough
  // Find the root row (or the first row in the layout)
  const rootRow = this._findRootRow(root);
  if (!rootRow) {
    log('warn', 'Cannot create new stack: no root row found');
    return stacks[stacks.length - 1] || null;
  }

  while (stacks.length <= targetIndex) {
    const newStack = {
      type: 'stack',
      content: []
    };
    rootRow.addChild(newStack);
    // Re-scan to get the newly created stack object
    stacks.push(this._getAllStacks(root).pop());
  }

  return stacks[targetIndex];
}
```

**Note:** GL's `addChild` on a row creates a new stack to the right of existing stacks. The exact API call may need adjustment based on the GL version in use — needs testing.

---

## Implementation Order

1. **Remove priority buttons** (section 2) — smallest, no dependencies
2. **Central panel-close sync** (section 1) — small, high value
3. **Panel placement by column** (section 4) + **dynamic stack creation** (section 6) — these go together
4. **External module loading** (section 3) — medium, uses column placement
5. **Multi-instance panels** (section 5) — largest, independent of others

## Resolved Questions

1. **Stack creation sizing:** Equal split of remaining space. When creating a new stack, redistribute widths evenly across all stacks in the root row.
2. **Multi-instance panel titles:** API allows code to specify a name. If none is specified, auto-increment ("Iframe Panel 2", "Iframe Panel 3"). No UI for user-entered names needed yet.
3. **Disabling multi-instance modules:** Disabling closes ALL instances of the module.
