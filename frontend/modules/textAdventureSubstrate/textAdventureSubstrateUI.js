/**
 * Text Adventure substrate panel — renders a procgen-emitted region
 * as a textual description with clickable exits and locations.
 *
 * Step 5 (this commit): skeleton. Subscribes to
 * textAdventure:loadRegion via index.js's handler, mounts a panel
 * that displays the current region's name. Step 6 adds the v1
 * feature set (compass-direction exits, location list with
 * checked/unchecked separation, click handlers, state reactivity,
 * inventory display, message history, etc.).
 *
 * The panel reads from the deserialized tile-grid world (same shape
 * the maze panel consumes) — exits.Map for compass-direction exits,
 * items.Map for locations, obstacleLib for logic-gate clearance
 * lookup. Tile geometry is unused.
 */

import { setPanelInstance, consumePendingLoadRegion } from './index.js';

export class TextAdventureSubstrateUI {
    static moduleApis = null;
    static setModuleApis(apis) { TextAdventureSubstrateUI.moduleApis = apis; }

    constructor(container, _componentState) {
        this.container = container;
        this.world = null;
        this.currentRegionId = null;
        this.arrivedFromExitId = null;

        // Guard DOM creation so the panel constructs cleanly in
        // headless test environments (where vitest runs under
        // 'node'). Production paths set up the rootElement; tests
        // exercise the non-rendering behaviour without touching DOM.
        if (typeof document !== 'undefined') {
            this.rootElement = document.createElement('div');
            this.rootElement.className = 'text-adventure-substrate-panel';
        } else {
            this.rootElement = null;
        }

        setPanelInstance(this);

        // If textAdventure:loadRegion fired before this panel mounted,
        // index.js buffered the payload. Drain it now.
        const pending = consumePendingLoadRegion();
        if (pending) {
            this._adoptLoadedRegion(pending);
        }

        this.render();

        if (this.rootElement && container?.getElement) {
            container.getElement().appendChild(this.rootElement);
        }
    }

    /**
     * Apply a region payload published via textAdventure:loadRegion.
     * Called by the module-level handler when this panel is already
     * mounted, and (via constructor) on initial mount with any
     * buffered payload.
     */
    applyLoadedRegion(payload) {
        this._adoptLoadedRegion(payload);
        this.render();
    }

    _adoptLoadedRegion(payload) {
        // Payload shape (per procgen-player.md §"Event flow"):
        //   { region_id, world, arrivedFrom }
        // arrivedFrom.exit_id (when present) names the exit IN THE
        // LOADED REGION that the player arrived through. Step 6 will
        // use it to render an arrival message; for now we just stash
        // it so step 6 can consume it without a follow-up refactor.
        this.world = payload?.world ?? null;
        this.currentRegionId = payload?.region_id ?? null;
        this.arrivedFromExitId = payload?.arrivedFrom?.exit_id ?? null;
    }

    render() {
        if (!this.rootElement) return;
        this.rootElement.innerHTML = '';

        if (!this.world || !this.currentRegionId) {
            const placeholder = document.createElement('div');
            placeholder.className = 'text-adventure-placeholder';
            placeholder.textContent = 'Waiting for region…';
            this.rootElement.appendChild(placeholder);
            return;
        }

        const heading = document.createElement('h2');
        heading.className = 'text-adventure-region-name';
        heading.textContent = this.currentRegionId;
        this.rootElement.appendChild(heading);
    }

    destroy() {
        // Step 6 will unsubscribe state listeners here. Skeleton
        // panel has nothing to clean up beyond letting the DOM go.
        this.rootElement = null;
        this.world = null;
    }
}
