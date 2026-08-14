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

    // Optional `(property, value) => void` installed by a host-side consumer
    // of raw BridgeGeneric reports (see _onStateChanged).
    this.onStateReport = null;

    // Lookup maps built from the game config
    this.apItemIdToFlash = {};
    this.locationFlashToApId = {};
    this.flashItemDefs = {};
    this.propertyToLocationFlash = {};
    this.flashLocationToApName = {};
    this.bossList = new Set();

    // Runtime state
    this.undoQueue = [];
    this.invokeQueue = [];        // one-shot invocations (teleport, etc.)
    this.gameState = {};
    this.checkedApLocations = new Set();

    // Property writes we've pushed into the queue that we expect
    // to see a stateChanged echo for. Keyed by property → expected
    // value. We only register an entry when the write will
    // actually change the value (gameState !== write value) —
    // redundant writes don't produce echoes, so they shouldn't
    // block us from detecting real player actions later.
    this.expectedEchoValue = {};

    // Seedling's Main.hasX setters proxy to SAVE_FILE.data.hasX,
    // and SAVE_FILE is null until the preloader initializes it on
    // Play. Writes that land before then throw #1009 once per
    // property per frame and flood the bridge log. We gate all
    // writes on having seen at least one stateChanged from the
    // bridge — which can only fire after a successful Main.*
    // read, i.e. after SAVE_FILE is non-null. Invocations
    // (teleport) bypass this gate because they don't touch
    // SAVE_FILE.
    this.gameReady = false;

    // Properties we've seen at least one stateChanged for. The
    // first stateChanged for each property represents the bridge
    // establishing baseline state — typically values loaded from
    // the game's own save file — not a real player action. We
    // suppress location-check dispatches for those first reads,
    // so stale save-file data can't mistakenly send checks to
    // the AP server. After baseline is established, subsequent
    // stateChanged events *are* treated as player actions.
    this.seenProperties = new Set();

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
        // ap_name is the canonical Archipelago location name (as it
        // appears in the seed / server). The client module's
        // user:locationCheck handler uses this to look up the server
        // protocol id. Fall back to flash_name for configs that
        // haven't been updated yet.
        this.flashLocationToApName[loc.flash_name] = loc.ap_name || loc.flash_name;
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
      path_reads: this.config.path_reads,
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
  // Teleport (and related invocations)
  // --------------------------------------------------------------

  /**
   * Queue a teleport based on the game config's `teleport` block
   * and the given parameter values.
   *
   * ⛔ DE-SCOPED FOR STATIC EXIT LAYOUT (Seedling, plan §4.6, Phase 5b).
   * A randomized set's exits are DATA in the set's own rooms; this call
   * must not be used to redirect a transition after the fact. Two
   * reasons, the second structural:
   *
   *   · Seedling's recipe is `new Game($level,$x,$y)` assigned to
   *     `FP.world` — the same constructor and the same assignment
   *     `Teleporter.update()` has already performed, so a corrected exit
   *     builds two worlds;
   *   · `Teleporter.update()` sets the STATIC `Game.sign` on the line
   *     after its own `new Game`, and this recipe does not touch it. So
   *     a replacement world announces the region of the room the player
   *     did NOT go to, and there is nowhere in this capability to fix
   *     that. Exits-as-data is not merely cheaper; it is the only
   *     mechanism that can get the sign right.
   *
   * Still in scope: the debug region/location jump UI, the region
   * atlas's arrival warp, and DYNAMIC re-linking mid-run (an AP item
   * that re-wires exits), which no static bundle can express.
   *
   * Two teleport invocation modes are supported:
   *
   *   - "new_instance" (Seedling): the config supplies `className`,
   *     `argTemplate`, and optional `assignTo`. The resolved args
   *     (with $-prefixed placeholders substituted from `params`)
   *     are sent to the bridge as a single new_instance queue item.
   *
   *   - "path_write" (Kitty): the config supplies `writes`, an
   *     array of `{ path, value }` entries where `value` is either
   *     a literal or a $-prefixed placeholder. Each write becomes
   *     a separate path-write queue item on the bridge. Used for
   *     games whose game state lives on a live instance (reached
   *     via the bridge's path walker) rather than class statics.
   */
  teleport(params) {
    const spec = this.config.teleport;
    if (!spec) {
      this.log('teleport: no teleport config', 'error');
      return false;
    }

    // Optional pre_invocations run before anything else in the
    // teleport sequence, but only when the game hasn't reached a
    // state where path reads produce values yet. Use case: Kitty
    // starts on a LogoState title screen where no Player exists,
    // so teleport path writes fail with "parent not resolvable".
    // Pre-invocations let the config unconditionally transition
    // into the gameplay state (e.g. `new_instance PlayState -> FlxG.state`)
    // before the teleport lands, so the player appears at the
    // target location without having to click through menus.
    //
    // Gated on !gameReady so they don't run when the user is
    // already playing — which would wipe in-progress state by
    // rebuilding the world from scratch.
    if (!this.gameReady && Array.isArray(spec.pre_invocations)) {
      for (const inv of spec.pre_invocations) {
        this.invokeQueue.push(inv);
      }
      this.log('teleport: queued pre_invocations (game not ready)');
    }

    // Optional preWrites let the config set class statics before
    // the teleport invocation runs — e.g. Seedling needs
    // Game.menu = false so the new Game doesn't come up in menu
    // state. These are plain property-write items and flow
    // through the bridge's existing applyItem path.
    if (Array.isArray(spec.preWrites)) {
      for (const w of spec.preWrites) {
        this.invokeQueue.push(w);
      }
    }

    const substitute = (tok) => {
      if (typeof tok !== 'string' || tok[0] !== '$') return tok;
      return params[tok.slice(1)];
    };

    if (spec.invocation === 'path_write') {
      if (!Array.isArray(spec.writes)) {
        this.log('teleport: path_write mode requires writes array', 'error');
        return false;
      }
      for (const w of spec.writes) {
        this.invokeQueue.push({
          path: w.path,
          value: substitute(w.value),
        });
      }
      this.log(`teleport queued (path_write): ${JSON.stringify(params)}`, 'item');
      return true;
    }

    const resolved = {
      invocation: spec.invocation,
      className: spec.className,
      args: (spec.argTemplate || []).map(substitute),
      assignTo: spec.assignTo,
    };
    this.invokeQueue.push(resolved);
    this.log(`teleport queued: ${JSON.stringify(params)}`, 'item');
    return true;
  }

  /**
   * Teleport to a named region using the config's `region_coords`
   * lookup table. Returns true if the region was found and
   * teleport was queued.
   */
  teleportToRegion(regionName) {
    const coords = this.config.region_coords?.[regionName];
    if (!coords) {
      this.log(`no coords for region "${regionName}"`);
      return false;
    }
    return this.teleport(coords);
  }

  /**
   * Teleport to a named location using the config's
   * `location_coords` lookup table. Returns true if the location
   * was found and teleport was queued.
   */
  teleportToLocation(locationName) {
    const coords = this.config.location_coords?.[locationName];
    if (!coords) {
      this.log(`no coords for location "${locationName}"`);
      return false;
    }
    return this.teleport(coords);
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

    // Raw report hook for host-side consumers that are not about AP
    // locations — today the region-atlas glue, which reads level /
    // playerPositionX / playerPositionY. Deliberately at the TOP: the echo
    // and first-read suppressions below exist for location detection and
    // would swallow reports this consumer must see (it does its own
    // baseline and echo handling, on its own terms). Never let a consumer
    // throw into the bridge's report path.
    if (this.onStateReport) {
      try {
        this.onStateReport(property, value);
      } catch (e) {
        this.log(`onStateReport handler threw: ${e.message}`, 'error');
      }
    }

    // Any stateChanged at all proves the bridge is successfully
    // reading Main.* properties, which only happens after
    // SAVE_FILE is initialized. Flip the write gate the first
    // time we see one.
    if (!this.gameReady) {
      this.gameReady = true;
      this.log('game ready — starting to send writes');
    }

    // Consume the echo of a write we just pushed. If this
    // stateChanged matches the value we asked to be written, it's
    // our own echo — swallow it and don't treat as a player
    // action. If the value differs, it really is a player change
    // (the write we queued hasn't landed yet, or the game
    // overrode it), so fall through to normal handling and clear
    // the stale expectation.
    if (property in this.expectedEchoValue) {
      if (this.expectedEchoValue[property] === value) {
        delete this.expectedEchoValue[property];
        return;
      }
      delete this.expectedEchoValue[property];
    }

    // Suppress the first stateChanged per property — it's the
    // bridge's initial read, not a player action. Real player
    // pickups show up as the *second* stateChanged (or later)
    // for a given property.
    const isInitialRead = !this.seenProperties.has(property);
    if (isInitialRead) {
      this.seenProperties.add(property);
      // Only log the initial read for location-relevant properties.
      // Continuously-changing values (player_x/y, velocity, etc.)
      // would otherwise produce a useless "initial read" line too.
      if (this.propertyToLocationFlash[property]) {
        this.log(`initial read: ${property} = ${value}`);
      }
      return;
    }

    // Location detection: property going true -> player found a location
    const locFlash = this.propertyToLocationFlash[property];

    // Only log player-action state changes for properties that map
    // to AP locations. Path reads like player_x / player_y fire
    // every frame the player moves and would otherwise flood the
    // panel log with useless position updates.
    if (locFlash) {
      this.log(`stateChanged (player action): ${property} = ${value}`);
    }
    if (locFlash && value === true) {
      // Undo: take the game-given item back so the AP item can arrive clean
      const propDef = this._findPropertyDef(property);
      if (propDef) {
        this.undoQueue.push({
          'class': propDef['class'],
          property,
          value: false,
        });
        this.log(`queued undo: ${property} = false`);
      }

      this._dispatchLocationCheck(locFlash);
    }
  }

  _dispatchLocationCheck(flashName) {
    if (!this.dispatcher) return;
    const locationName = this.flashLocationToApName[flashName];
    if (!locationName) {
      this.log(`no AP mapping for flash location ${flashName}`);
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
    this.log(`dispatched user:locationCheck for "${locationName}"`, 'location');
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

    // Drain pending invocations (teleport etc.) on every tick —
    // they don't touch SAVE_FILE and can run even before the
    // game is ready, so they're gated independently.
    const invocations = this.invokeQueue;
    this.invokeQueue = [];

    // Only compute property writes once the game has initialized
    // enough to accept them. Before then, the bridge will throw
    // #1009 on every write attempt and flood its log.
    const writes = this.gameReady ? this._buildItemWritesFromInventory() : [];
    const undoForThisTick = this.gameReady ? this.undoQueue : [];
    if (this.gameReady) this.undoQueue = [];

    // Undo writes go next, so game-given items disappear before AP
    // items arrive in the same frame.
    const combined = invocations.concat(undoForThisTick).concat(writes);

    if (combined.length === 0) return [];

    // Register expected echoes for property writes. Only count a
    // write as producing an echo if its value differs from what
    // we last observed — otherwise the bridge's change detect
    // won't fire stateChanged at all, and a counter-based
    // pendingWrites model would accumulate stale entries that
    // block real player-action events later.
    // (Invocations are skipped — they don't produce stateChanged
    // events at all.)
    for (const item of combined) {
      if (item.property && this.gameState[item.property] !== item.value) {
        this.expectedEchoValue[item.property] = item.value;
      }
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
