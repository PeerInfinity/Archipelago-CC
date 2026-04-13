/**
 * FlashBridgeAdapter
 *
 * Bridges an injected Flash game (BridgeGeneric.as) to the
 * Archipelago-CC frontend's event bus and dispatcher.
 *
 * Ported from flash-ap-api/ap_flash_client.js, with the archipelago.js
 * layer replaced by event-bus / dispatcher plumbing:
 *   - state changes from Flash that map to AP locations are published
 *     as user:locationCheck via the dispatcher (the client module
 *     forwards to the AP server when connected; otherwise stateManager
 *     handles them locally).
 *   - item writes into Flash are computed from the stateManager's
 *     inventory snapshot (the single source of truth), not from
 *     client.items.received. This means that removing an item from
 *     the inventory (e.g. by shift-clicking in the Inventory panel)
 *     naturally propagates into the Flash game.
 *
 * The bridge itself exposes two window-level callbacks that Flash
 * polls each frame:
 *   stateChanged(property, value) - pushed from Flash on change
 *   getItemQueue()                - pulled by Flash for new writes
 *
 * These are registered on window globals; the adapter installs
 * namespaced versions keyed to its flashObjectId so multiple flash
 * panels can coexist, and keeps a short-lived registry so the
 * global entry points can dispatch to the right instance.
 */

const adapters = new Map(); // flashObjectId -> adapter

function ensureGlobalEntryPoints() {
  if (typeof window === 'undefined') return;
  if (window.__flashPanelGlobalsInstalled) return;
  window.__flashPanelGlobalsInstalled = true;

  // Raw call counters — incremented unconditionally at the top of
  // each shim, so they can be read from diagnostic code regardless
  // of whether any adapter is attached or what the shim dispatch
  // does downstream.
  window.__flashShimGetItemQueueCalls = 0;
  window.__flashShimStateChangedCalls = 0;

  window.stateChanged = function (property, value) {
    window.__flashShimStateChangedCalls++;
    for (const adapter of adapters.values()) {
      if (adapter.attached) adapter._onStateChanged(property, value);
    }
  };

  window.getItemQueue = function () {
    window.__flashShimGetItemQueueCalls++;
    const combined = [];
    for (const adapter of adapters.values()) {
      if (adapter.attached) combined.push(...adapter._buildQueue());
    }
    if (combined.length === 0) return '[]';
    return JSON.stringify(combined);
  };
}

export class FlashBridgeAdapter {
  constructor({ config, flashObjectId, stateManager, dispatcher, eventBus, log }) {
    this.config = config;
    this.flashObjectId = flashObjectId;
    this.stateManager = stateManager;
    this.dispatcher = dispatcher;
    this.eventBus = eventBus;
    this.log = log || (() => {});

    this.attached = false;
    this.bridgeConfigured = false;

    // Lookup maps built from the game config
    this.apItemIdToFlash = {};
    this.locationFlashToApId = {};
    this.flashItemDefs = {};
    this.propertyToLocationFlash = {};
    this.bossList = new Set();

    // Runtime state
    this.undoQueue = [];
    this.pendingWrites = {};
    this.gameState = {};
    this.checkedApLocations = new Set();

    // Diagnostics
    this._queueTickCount = 0;
    this._lastOwnedKey = null;    // serialized set of owned item names

    // Note: we do NOT dedup writes on the JS side. The bridge
    // (BridgeGeneric.as) keeps its own _lastWritten cache that
    // short-circuits repeat writes, and critically clears that
    // cache on read-back mismatch — so failed writes retry next
    // frame. Any JS-side cache here would break that retry path
    // (seen with Seedling's Main class, where static setters
    // throw #1009 until the game instance is fully initialized).

    this.unsubscribeHandles = [];

    this._buildLookups(config);
    adapters.set(flashObjectId, this);
    ensureGlobalEntryPoints();
  }

  // --------------------------------------------------------------
  // Lookup tables
  // --------------------------------------------------------------
  _buildLookups(config) {
    const offset = config.ap_id_offset || 0;

    if (config.ap_items) {
      for (const item of config.ap_items) {
        this.apItemIdToFlash[offset + parseInt(item.id, 10)] = item.flash_name;
      }
    }
    if (config.ap_locations) {
      for (const loc of config.ap_locations) {
        this.locationFlashToApId[loc.flash_name] = offset + parseInt(loc.id, 10);
      }
    }
    if (config.items) {
      for (const item of config.items) {
        this.flashItemDefs[item.flash_name] = item;
      }
    }
    if (config.locations) {
      for (const loc of config.locations) {
        this.propertyToLocationFlash[loc.property] = loc.flash_name;
      }
    }
    if (config.boss_locations) {
      for (const b of config.boss_locations) this.bossList.add(b);
    }
  }

  // --------------------------------------------------------------
  // Bridge lifecycle
  // --------------------------------------------------------------
  _getFlash() {
    return document.getElementById(this.flashObjectId);
  }

  async waitForBridge(maxMs) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const el = this._getFlash();
      if (el && typeof el.wireCheck === 'function') return el;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`bridge did not become ready within ${maxMs}ms`);
  }

  configureBridge() {
    const flash = this._getFlash();
    if (!flash || typeof flash.configure !== 'function') return 'error:flash not ready';
    const bridgeConfig = {
      classes: this.config.classes,
      state_properties: this.config.state_properties,
    };
    try {
      const result = flash.configure(JSON.stringify(bridgeConfig));
      if (result === 'ok') this.bridgeConfigured = true;
      return result;
    } catch (e) {
      return `error:${e.message}`;
    }
  }

  wireCheck() {
    const flash = this._getFlash();
    if (!flash || typeof flash.wireCheck !== 'function') return 'not ready';
    try { return flash.wireCheck(); } catch (e) { return `error:${e.message}`; }
  }

  readState() {
    const flash = this._getFlash();
    if (!flash || typeof flash.readState !== 'function') return 'not ready';
    try { return flash.readState(); } catch (e) { return `error:${e.message}`; }
  }

  // --------------------------------------------------------------
  // Attach / detach — subscribe to event bus
  // --------------------------------------------------------------
  attach() {
    if (this.attached) return;
    this.attached = true;

    // Diagnostic subscriptions: we don't need these to drive state
    // sync (the per-frame rebuild handles that) but having them
    // lets us log timing correlations when debugging why writes
    // aren't reaching Flash.
    const sub = (event, handler) => {
      const unsub = this.eventBus.subscribe(event, handler.bind(this));
      this.unsubscribeHandles.push(unsub);
    };
    sub('stateManager:ready', () => {
      this.log('eventbus: stateManager:ready');
    });
    sub('stateManager:inventoryChanged', () => {
      this.log('eventbus: inventoryChanged');
    });
    sub('stateManager:rulesLoaded', () => {
      this.log('eventbus: rulesLoaded');
    });
  }

  detach() {
    this.attached = false;
    this.unsubscribeHandles.forEach((u) => typeof u === 'function' && u());
    this.unsubscribeHandles = [];
    adapters.delete(this.flashObjectId);
  }

  // --------------------------------------------------------------
  // Flash -> frontend: state changes
  // --------------------------------------------------------------
  _onStateChanged(property, value) {
    this.gameState[property] = value;

    // Skip client-initiated writes (undo or AP-given items)
    if (this.pendingWrites[property] > 0) {
      this.pendingWrites[property]--;
      if (this.pendingWrites[property] <= 0) delete this.pendingWrites[property];
      return;
    }

    // Location detection: property going true -> player found a location
    const locFlash = this.propertyToLocationFlash[property];
    if (locFlash && value === true) {
      if (this.bossList.has(locFlash) /* && !slotData?.boss_locations */) {
        // Boss gating: without access to slotData yet, let them through.
        // Future: subscribe to game:roomInfo / game:connected to receive slotData.
      }

      // Undo: take the game-given item back so the AP item can arrive clean
      const propDef = this._findPropertyDef(property);
      if (propDef) {
        this.undoQueue.push({
          'class': propDef['class'],
          property,
          value: false,
        });
      }

      // Dispatch the location check
      this._dispatchLocationCheck(locFlash);
      this.log(`location: ${locFlash}`, 'location');
    }
  }

  _dispatchLocationCheck(flashName) {
    if (!this.dispatcher) return;
    const locationName = this._flashLocationToAp(flashName);
    if (!locationName) {
      this.log(`no AP mapping for ${flashName}`);
      return;
    }
    const payload = {
      locationName,
      originator: 'FlashPanel',
      originalDOMEvent: false,
    };
    this.dispatcher.publish('user:locationCheck', payload, {
      initialTarget: 'bottom',
    });
  }

  /**
   * Map a flash_name location to the AP location *name* (not id).
   * The dispatcher pipeline expects locationName; the client module
   * resolves that to a server id.
   */
  _flashLocationToAp(flashName) {
    // flash_name and the AP location name are typically identical in
    // the existing seedling config. If the config provides a mapping,
    // use it; otherwise fall back to flashName.
    const mapping = this.config.flash_to_ap_location_names;
    if (mapping && mapping[flashName]) return mapping[flashName];
    return flashName;
  }

  _findPropertyDef(property) {
    return (this.config.state_properties || [])
      .find((p) => p.property === property);
  }

  // --------------------------------------------------------------
  // frontend -> Flash: item writes via getItemQueue
  // --------------------------------------------------------------
  _buildQueue() {
    this._queueTickCount++;
    // Heartbeat: log once every ~2s of ticks so we can see whether
    // Flash is actively polling getItemQueue.
    if (this._queueTickCount % 60 === 1) {
      this.log(`queue tick ${this._queueTickCount}`);
    }

    const writes = this._buildItemWritesFromInventory();

    // Undo writes go first so game-given items disappear before AP
    // items arrive in the same frame.
    const combined = this.undoQueue.concat(writes);
    this.undoQueue = [];

    if (combined.length === 0) return [];

    // Mark each write as pending so the stateChanged callback
    // doesn't interpret our write as a player pickup.
    for (const item of combined) {
      const p = item.property;
      this.pendingWrites[p] = (this.pendingWrites[p] || 0) + 1;
    }
    return combined;
  }

  /**
   * Build the full set of bridge write commands from the state
   * manager's current inventory. Called each getItemQueue tick.
   * Inventory is the single source of truth — adding, removing, or
   * editing it propagates here automatically.
   */
  _buildItemWritesFromInventory() {
    const snapshot = this.stateManager.getLatestStateSnapshot?.();
    const inventoryCounts = snapshot?.inventory || {};

    // Classify each owned item into flash items, expanding progressives
    // and fusions using the same logic as flash-ap-api.
    const flashItems = this._inventoryToFlashItems(inventoryCounts);

    const writes = [];
    const addAccum = {}; // property -> { def, total }

    for (const flashName of flashItems) {
      const def = this.flashItemDefs[flashName];
      if (!def) continue;

      if (def.op === 'add') {
        const key = def.property;
        if (!addAccum[key]) addAccum[key] = { def, total: 0 };
        addAccum[key].total += (def.value || 1);
      } else {
        writes.push({
          'class': def['class'],
          property: def.property,
          value: def.value,
        });
      }
    }

    for (const key in addAccum) {
      const acc = addAccum[key];
      writes.push({
        'class': acc.def['class'],
        property: acc.def.property,
        value: (acc.def.base || 0) + acc.total,
      });
    }

    // For every location-mapped property NOT backed by a currently-owned
    // item, emit a clearing write. This is what makes inventory removal
    // propagate into Flash: removing an item from the inventory causes
    // no write in the loop above, and the clearing write below drives
    // the property back to its "empty" value.
    //
    // Only clear properties that map to an item (have a flashItemDef
    // somewhere) — we don't touch things like hitsMax that are op:add.
    const writtenProperties = new Set(writes.map((w) => w.property));
    for (const loc of (this.config.locations || [])) {
      const propDef = this._findPropertyDef(loc.property);
      if (!propDef) continue;
      if (writtenProperties.has(loc.property)) continue;
      writes.push({
        'class': propDef['class'],
        property: loc.property,
        value: false,
      });
    }

    return writes;
  }

  _inventoryToFlashItems(inventoryCounts) {
    const result = [];
    const progressiveCounts = {};
    const fusionFlags = {};

    // Diagnostic: log whenever the set of owned item names changes,
    // so we can see inventory updates land in the panel log as
    // they happen (not just on the first non-empty snapshot).
    const ownedNames = Object.keys(inventoryCounts)
      .filter((n) => (inventoryCounts[n] || 0) > 0)
      .sort();
    const ownedKey = ownedNames.join('|');
    if (ownedKey !== this._lastOwnedKey) {
      this._lastOwnedKey = ownedKey;
      this.log(`inventory changed (${ownedNames.length} owned): ${ownedNames.join(', ') || '(empty)'}`);
      const unknown = ownedNames.filter((n) => this._apNameToFlash(n) === null);
      if (unknown.length > 0) {
        this.log(`items not in ap_items config: ${unknown.join(', ')}`);
      }
    }

    // Treat inventoryCounts as multiset: for each owned item, classify
    // it count-times.
    for (const itemName of Object.keys(inventoryCounts)) {
      const count = inventoryCounts[itemName] || 0;
      if (count <= 0) continue;

      const flashName = this._apNameToFlash(itemName);
      if (!flashName) continue;

      for (let i = 0; i < count; i++) {
        if (flashName[0] !== '!') {
          result.push(flashName);
        } else {
          const progChain = this.config.progressive_items?.[flashName];
          if (progChain) {
            progressiveCounts[flashName] = (progressiveCounts[flashName] || 0) + 1;
          } else if (this._isFusionFlag(flashName)) {
            fusionFlags[flashName] = true;
          }
        }
      }
    }

    // Expand progressive chains
    for (const group in progressiveCounts) {
      const chain = this.config.progressive_items[group];
      if (!Array.isArray(chain)) continue;
      const count = progressiveCounts[group];
      for (let i = 0; i < Math.min(count, chain.length); i++) {
        result.push(chain[i]);
      }
    }

    // Check fusion conditions
    if (this.config.fusion_items) {
      for (const fusion of this.config.fusion_items) {
        let ok = true;
        if (fusion.requires_flags) {
          for (const flag of fusion.requires_flags) {
            if (!fusionFlags[flag]) { ok = false; break; }
          }
        }
        if (ok && fusion.requires_items) {
          for (const req of fusion.requires_items) {
            if (!result.includes(req)) { ok = false; break; }
          }
        }
        if (ok && fusion.requires_progressive) {
          for (const group in fusion.requires_progressive) {
            const need = fusion.requires_progressive[group];
            if ((progressiveCounts[group] || 0) < need) { ok = false; break; }
          }
        }
        if (ok) result.push(fusion.result);
      }
    }

    return result;
  }

  _apNameToFlash(apName) {
    // Look up via ap_items by either ap_name (canonical AP display
    // name) or flash_name (for configs where the two are identical).
    // Returns null when there is no match — callers treat that as
    // "unknown item, ignore".
    if (this.config.ap_items) {
      for (const item of this.config.ap_items) {
        if (item.ap_name === apName || item.flash_name === apName) {
          return item.flash_name;
        }
      }
    }
    return null;
  }

  _isFusionFlag(flashName) {
    if (!this.config.fusion_items) return false;
    for (const fusion of this.config.fusion_items) {
      if (fusion.requires_flags && fusion.requires_flags.includes(flashName)) return true;
    }
    return false;
  }


}
