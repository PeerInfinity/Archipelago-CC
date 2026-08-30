/**
 * Host-side glue between procgen and the real Seedling game
 * (CC/docs/plans/region-atlas-plan.md, Phase 4 — projection 3).
 *
 * It subscribes `flashSeedling:loadRegion`, feeds the game's property reports
 * into `SeedlingRegionBinding` (the pure state machine — traps and rulings
 * documented there), and applies the effects it returns:
 *
 *   teleport   -> the flashPanel adapter's existing invocation queue, i.e. the
 *                 `teleport` recipe in games/seedling.json — one shipped
 *                 AP<->game translation, not a second one (ruling 2)
 *   regionMove -> `user:regionMove` on the dispatcher with
 *                 `initialTarget: 'bottom'`, the dialect every substrate bridge
 *                 uses; procgenPlayer receives it, loads the target region and
 *                 forwards up the chain so gameState follows
 *   warn       -> LOUD: console.warn AND the panel's own log
 *
 * ⛓⛓ **AND IT SUBSCRIBES `procgen:activeSubstrateChanged`** (EDITOR INTEGRATION
 * W6, H2; plan §11.1 A2 / §11.6 item 2). flashPanel is not procgen-only, so it
 * deliberately has no `SubstrateInactiveOverlay` and the game keeps running
 * while a maze region owns the player. That is fine for the PANEL and wrong for
 * the BINDING: without this, a still-live game's level change resolved a
 * crossing out of a region that was no longer current. The bounce bridge has
 * had the same guard since it shipped (`flashSubstrate/bridge.js:204-207`).
 *
 * ⛔ THE SUBSCRIPTION IS THE PANEL'S ONLY STAKE, AND IT IS NOT THE PANEL'S. The
 * park is a fact about what the binding may read, so it is wired here — the one
 * place that already holds the event bus and the binding — and `flashPanelUI`
 * is untouched.
 *
 * It lives here rather than in flashSubstrate because it drives flashPanel's
 * `WasmBridgeAdapter`. Note that flashSubstrate's in-iframe bridge DROPS
 * `arrivedFrom` today; this consumes it host-side instead, which is what makes
 * "arrive at the exit you came through" work at all.
 */

import { FLASH_SEEDLING_SUBSTRATE_ID } from './flashSeedlingLibrary.js';
import { SeedlingRegionBinding } from './seedlingRegionBinding.js';

/** procgenPlayer's own broadcast of "which substrate owns the player now". */
export const ACTIVE_SUBSTRATE_EVENT = 'procgen:activeSubstrateChanged';

/**
 * ⛓ The panel readout M1 owes the user: *"found X for Player Y"*, the instant
 * the check fires, off the host's own placement table rather than a round trip
 * to the server. Published on the module event bus so the panel can render it
 * without this file knowing what a panel is.
 */
export const AP_ITEM_FOUND_EVENT = 'flashSeedling:apItemFound';

export class SeedlingRegionGlue {
    /**
     * @param {object} deps
     * @param {object} deps.eventBus         module event bus (subscribe/unsubscribe)
     * @param {function} deps.getDispatcher  resolves the module dispatcher lazily
     * @param {string} deps.loadRegionEvent  the substrate's loadRegion event name
     * @param {string} [deps.substrateId]    which substrate id is OURS; defaults to
     *   the registry entry's own constant, never a literal spelled here
     * @param {function} [deps.getPanel]     resolves the active flashPanel instance
     * @param {function} [deps.now]          injectable clock (tests)
     */
    constructor({ eventBus, getDispatcher, loadRegionEvent, substrateId, getPanel, now } = {}) {
        this.eventBus = eventBus ?? null;
        this.getDispatcher = getDispatcher ?? (() => null);
        this.loadRegionEvent = loadRegionEvent;
        this.substrateId = substrateId ?? FLASH_SEEDLING_SUBSTRATE_ID;
        this.getPanel = getPanel ?? (() => null);
        this.binding = new SeedlingRegionBinding({ now });
        this.adapter = null;
        this.delivery = null;
        /** H6 — the AP check binding. Set from outside, like the delivery. */
        this.checkBinding = null;
        this._unsubs = [];
        this._handler = (payload) => this.handleLoadRegion(payload);
        this._activeHandler = (payload) => this.handleActiveSubstrateChanged(payload);
        // Diagnostics — the verify script reads these rather than inferring
        // behaviour from console text.
        this.stats = { loads: 0, teleports: 0, regionMoves: 0, warnings: 0, parks: 0,
            resumes: 0, setDeliveries: 0, locationChecks: 0, itemsFound: 0 };
    }

    start() {
        if (this._unsubs.length > 0 || !this.eventBus?.subscribe) return;
        /**
         * ⛔ BOTH SUBSCRIPTIONS OR NEITHER. A glue that heard `loadRegion` but
         * not the active-substrate broadcast is exactly the pre-W6 state, and it
         * is the one shape that reads as "wired" while doing the wrong thing.
         */
        this._unsubs.push(this._subscribe(this.loadRegionEvent, this._handler));
        this._unsubs.push(this._subscribe(ACTIVE_SUBSTRATE_EVENT, this._activeHandler));
    }

    /** eventBus.subscribe returns an unsubscribe fn in some hosts and nothing
     *  in others; fall back to the explicit call. */
    _subscribe(event, handler) {
        const off = this.eventBus.subscribe(event, handler);
        return typeof off === 'function' ? off : () => this.eventBus.unsubscribe?.(event, handler);
    }

    stop() {
        for (const off of this._unsubs) off();
        this._unsubs = [];
        this.detachAdapter();
    }

    /**
     * The panel built an adapter. Everything the binding knows about the game's
     * state came from the previous one, so restart its view — which also
     * re-arms the arrival teleport for the region we are already in.
     */
    attachAdapter(adapter) {
        if (!adapter || adapter === this.adapter) return;
        this.detachAdapter();
        this.adapter = adapter;
        adapter.onStateReport = (property, value) => {
            /**
             * ⛔ BOTH BINDINGS SEE EVERY REPORT, AND THE ADAPTER HAS ONE HOOK.
             * `onStateReport` is a single slot, so a second consumer that
             * assigned it would silently REPLACE the first. Fanning out here
             * keeps the two state machines pure and independent — neither
             * knows the other exists, and each ignores every property but its
             * own.
             */
            this.apply(this.binding.onStateReport(property, value));
            if (this.checkBinding) {
                this.apply(this.checkBinding.onStateReport(property, value));
            }
        };
        this._standDownAdapter();
        this.binding.onGameRestart();
        this.checkBinding?.onGameRestart();
    }

    detachAdapter() {
        if (this.adapter && this.adapter.onStateReport) this.adapter.onStateReport = null;
        this.adapter = null;
    }

    /**
     * ⛓⛓ **H8 — THE AP LEVEL SET GOES IN BEFORE THE FIRST REGION LOAD**
     * (EDITOR INTEGRATION §17.1.4). A region load teleports the player into a
     * room; delivering the rewritten rooms afterwards would replace the room
     * under the player and hand them a different game than the one AP
     * generated. So the gate runs FIRST, and a delivery that refuses is LOUD.
     *
     * ⛔ THE DELIVERY IS SET FROM OUTSIDE, NEVER CONSTRUCTED HERE. It needs
     * `planLevelSetChunks`, and a static import of the level-set graph from
     * this file would add 794 KB of source to the shipped bundle (measured —
     * `seedlingLevelSetDelivery.js`'s header carries the four figures). The
     * glue owns the ORDERING and nothing else.
     */
    setDelivery(delivery) {
        this.delivery = delivery ?? null;
        return this;
    }

    /**
     * ⛓⛓ **H6 — THE CHECK BINDING**, set from outside for the same reason the
     * delivery is: it holds the PLACEMENT TABLE, and a static import of
     * `apPlacementRewriter.js` from this file would add 87 files / 4,868,066 B
     * to the shipped bundle. The glue owns the WIRING and nothing else.
     */
    setCheckBinding(checkBinding) {
        this.checkBinding = checkBinding ?? null;
        this._standDownAdapter();
        return this;
    }

    /**
     * ⛔⛔ **RETIRING THE UNDO QUEUE, FOR THE COVERED LOCATIONS ONLY.**
     *
     * The adapter's property path answers a location by watching a `Main.*`
     * flag go true, then queues an UNDO that writes it back to false so AP's
     * own item can arrive clean (`flashBridgeAdapter.js:466-476`). With AP
     * placement in the room that path is not merely redundant, it is WRONG:
     * an `APItem` grants nothing, so the only writer of those flags is the
     * bridge itself, and an echo the suppression happens to miss would be read
     * as a player pickup — dispatching the location a second time and taking
     * the granted item straight back. The gate that catches it is *"the flag
     * flips EXACTLY ONCE"*.
     *
     * ⛓ IT IS A SET, NOT A DELETE, and the difference is the two ENCOUNTER
     * locations: `fire@L32` and `darksword@L12` are boss/special grants with no
     * pickup entity, are not rewritten, and MUST stay on the property path. So
     * the adapter is handed the names H6 owns and stands down on exactly those.
     * With no check binding the set is empty and the adapter behaves as it
     * always has.
     */
    _standDownAdapter() {
        this.adapter?.setHostOwnedLocations?.(
            this.checkBinding ? this.checkBinding.hostOwnedLocations() : new Set());
    }

    handleLoadRegion(payload) {
        this.stats.loads += 1;
        if (this.delivery) {
            const gate = this.delivery.gateLoadRegion();
            if (gate.sent) this.stats.setDeliveries += 1;
            if (!gate.proceed) {
                this._warn('[ap placement] the AP level set did NOT mount, so this region load '
                    + `would run on the vanilla rooms — ${gate.why}`);
                return;
            }
        }
        this.apply(this.binding.onLoadRegion(payload ?? {}));
    }

    /**
     * ⛓ `payload` is `{substrate, componentType, label, regionId}` or **null**
     * (procgenPlayer publishes null when nothing is active) — and null parks,
     * which is the correct reading of "no substrate owns the player".
     *
     * ⛔ Compared on the SUBSTRATE id, not on `componentType`: `flashPanel` is
     * the component type of every flash-family entry, so a bounce region in the
     * same panel would read as ours.
     */
    handleActiveSubstrateChanged(payload) {
        const mine = payload?.substrate === this.substrateId;
        const was = this.binding.active;
        const effects = this.binding.setActive(mine);
        if (was !== this.binding.active) this.stats[mine ? 'resumes' : 'parks'] += 1;
        this.apply(effects);
    }

    apply(effects) {
        for (const effect of effects ?? []) {
            switch (effect.type) {
                case 'teleport': this._teleport(effect); break;
                case 'regionMove': this._regionMove(effect); break;
                case 'locationCheck': this._locationCheck(effect); break;
                case 'apItemFound': this._itemFound(effect); break;
                case 'warn': this._warn(effect.message); break;
                default: this._log(effect.message);
            }
        }
    }

    _teleport({ level, x, y, region }) {
        if (!this.adapter?.teleport) {
            this._warn(`[region atlas] no flash adapter to teleport into "${region}" — `
                + 'is the Flash Game panel open and the game started?');
            return;
        }
        this.adapter.teleport({ level, x, y });
        this.stats.teleports += 1;
        this._log(`[region atlas] arrival in "${region}": teleport to level ${level} (${x}, ${y})`);
    }

    _regionMove({ sourceRegion, targetRegion, exitName, fromLevel, toLevel }) {
        const dispatcher = this.getDispatcher();
        if (!dispatcher?.publish) {
            this._warn('[region atlas] no dispatcher — the boundary crossing was detected but not published');
            return;
        }
        dispatcher.publish('user:regionMove', {
            sourceRegion,
            targetRegion,
            exitName,
            source: 'seedlingRegionGlue',
        }, { initialTarget: 'bottom' });
        this.stats.regionMoves += 1;
        this._log(`[region atlas] level ${fromLevel} -> ${toLevel}: crossing "${exitName}" `
            + `-> region "${targetRegion}"`);
    }

    /**
     * ⛓ THE SAME EVENT AND THE SAME DIALECT the adapter's own location path
     * publishes (`flashBridgeAdapter._dispatchLocationCheck`) — one AP
     * vocabulary, not a second one for placements.
     */
    _locationCheck({ location, ledgerId }) {
        const dispatcher = this.getDispatcher();
        if (!dispatcher?.publish) {
            this._warn(`[ap placement] no dispatcher — the check for "${location}" was detected `
                + 'but not published');
            return;
        }
        dispatcher.publish('user:locationCheck', {
            locationName: location,
            originator: 'FlashPanel',
            originalDOMEvent: false,
        }, { initialTarget: 'bottom' });
        this.stats.locationChecks += 1;
        this._log(`[ap placement] checked "${location}" (${ledgerId})`);
    }

    /** *"found X for Player Y"* — the panel readout, off the placement table. */
    _itemFound({ location, item, player, forSelf }) {
        this.stats.itemsFound += 1;
        const who = forSelf ? 'you' : `Player ${player}`;
        const line = `[ap placement] found ${item} for ${who} at "${location}"`;
        this._log(line);
        try {
            this.eventBus?.publish?.(AP_ITEM_FOUND_EVENT,
                { location, item, player, forSelf, message: line });
        } catch { /* a bus that refuses an unknown event is not a check failure */ }
    }

    _warn(message) {
        this.stats.warnings += 1;
        // Loud on BOTH surfaces: the console is where a developer looks, the
        // panel log is where the person actually playing looks.
        if (typeof console !== 'undefined') console.warn(message);
        if (typeof window !== 'undefined' && window.logger?.warn) {
            window.logger.warn('flashPanelSeedlingGlue', message);
        }
        this._panelLog(message, 'error');
    }

    _log(message) {
        if (!message) return;
        this._panelLog(message);
    }

    _panelLog(message, cls) {
        try {
            this.getPanel()?._panelLog?.(message, cls);
        } catch { /* the panel may be mid-teardown */ }
    }
}
