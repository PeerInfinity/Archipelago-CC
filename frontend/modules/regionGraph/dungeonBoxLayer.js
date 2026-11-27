/**
 * ⛓ THE DUNGEON BOXES (region-graph-dungeon-groups; Direction-aware layout, Dungeon grouping = `twoStepBoxes`).
 *
 * A faint labelled box round each dungeon (a Region Map group, `dungeonGroups.js`) of 2+ drawn nodes, drawn as a DOM
 * OVERLAY inside the graph container, UNDER Cytoscape's canvas (as the map look's canvas is: z-index −1 in an
 * isolated stacking context, and after the map-look canvas so a box shows over the map art). It is NOT a Cytoscape
 * element: no compound parent (those are `nested`'s sub-region boxes, which it never touches), so every reader of the
 * element set — the tap, the node picker, the pathfinder, counts, hub detection, saved positions, layouts — never sees
 * it. `pointer-events: none`: a press goes through it to the graph.
 *
 *   · A box is its members' current boxes (`boundingBox`, labels excluded) plus the layout's `blockPad`, converted to
 *     screen pixels, so it follows its nodes when they move (a drag, the layout's animation), pan and zoom; it is
 *     recomputed one frame after `position` / `viewport` / `resize` / `layoutstop`.
 *   · A member that discovery hides (`discovery-hidden`) is left out; a box with no member shown is hidden. The label
 *     is the dungeon's name (the group id), drawn just above the box's top edge, or `???` while any member shown is an
 *     undiscovered placeholder.
 *   · The boxes belong to ONE Direction-aware run: `show(boxes)` after its start; any later layout's `layoutstart`, a
 *     graph rebuild (`clear()`), or a run with another grouping value removes them.
 */
import { blockPad } from './dungeonGroups.js';

export const DUNGEON_BOX_LAYER_CLASS = 'rg-dungeon-boxes';
export const DUNGEON_BOX_CLASS = 'rg-dungeon-box';

const LAYER_STYLE = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:-1';
const BOX_STYLE = 'position:absolute;box-sizing:border-box;border:1px dashed rgba(170,190,220,0.45);'
    + 'background:rgba(120,150,200,0.07);border-radius:6px;pointer-events:none;display:none';
/** The label sits just ABOVE the box's top edge, so at any zoom it never covers a node inside the box. */
const LABEL_STYLE = 'position:absolute;left:2px;bottom:100%;margin-bottom:1px;font:11px sans-serif;line-height:12px;'
    + 'color:rgba(200,215,235,0.8);white-space:nowrap;pointer-events:none';

export class DungeonBoxLayer {
    /** @param {object} ui - the RegionGraphUI (cy, graphContainer, directionSettings) */
    constructor(ui, { doc = globalThis.document } = {}) {
        this.ui = ui;
        this.doc = doc;
        this.boxes = []; // [{dungeon, label, members, el, labelEl}]
        this._layer = null;
        this._boundCy = null;
        this._frame = null;
        this._hostIsolation = null;
        this.syncCount = 0;
    }

    /** The layer element (created on first use, inside the graph container, under the canvas). */
    layer() {
        const host = this.ui.graphContainer;
        if (!this.doc || !host) return null;
        if (!this._layer) {
            const div = this.doc.createElement('div');
            div.className = DUNGEON_BOX_LAYER_CLASS;
            div.setAttribute('style', LAYER_STYLE);
            this._layer = div;
            this._hostIsolation = host.style?.isolation ?? '';
        }
        // Under the canvas, over the map look's (both z-index −1: the later sibling paints on top).
        if (this._layer.parentNode !== host || this._layer.nextSibling?.classList?.contains?.('rg-map-look-canvas')) {
            host.appendChild(this._layer);
        }
        if (host.style && host.style.isolation !== 'isolate') host.style.isolation = 'isolate';
        return this._layer;
    }

    bind() {
        const cy = this.ui.cy;
        if (!cy || this._boundCy === cy) return;
        this._boundCy = cy;
        const schedule = () => this.scheduleSync();
        cy.on('viewport resize layoutstop', schedule);
        cy.on('position', 'node', schedule);
        // Another layout's start ends this run's boxes (the Direction-aware run calls `show` after its own start).
        cy.on('layoutstart', () => this.clear());
    }

    /** Draw `boxes` (`[{dungeon, label, members: [node id]}]`, from `buildDirectionLayout`); [] clears. */
    show(boxes = []) {
        this.clear();
        if (!boxes.length) return;
        this.bind();
        const layer = this.layer();
        for (const b of boxes) {
            const entry = { ...b, el: null, labelEl: null };
            if (layer) {
                const el = this.doc.createElement('div');
                el.className = DUNGEON_BOX_CLASS;
                el.setAttribute('style', BOX_STYLE);
                el.dataset.dungeon = String(b.dungeon);
                const label = this.doc.createElement('span');
                label.setAttribute('style', LABEL_STYLE);
                el.appendChild(label);
                layer.appendChild(el);
                entry.el = el;
                entry.labelEl = label;
            }
            this.boxes.push(entry);
        }
        this.sync();
    }

    clear() {
        for (const b of this.boxes) b.el?.remove?.();
        this.boxes = [];
    }

    scheduleSync() {
        if (this.boxes.length === 0 || this._frame !== null) return;
        const raf = globalThis.requestAnimationFrame ?? ((f) => setTimeout(f, 16));
        this._frame = raf(() => { this._frame = null; this.sync(); });
    }

    /** Each box's model rectangle now (`{x1, y1, x2, y2}`, its members' boxes + the pad) and label, or null if none shown. */
    modelBoxOf(box) {
        const cy = this.ui.cy;
        if (!cy) return null;
        const pad = blockPad(this.ui.directionSettings?.spacing);
        let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
        let placeholder = false;
        let shown = 0;
        for (const id of box.members) {
            const n = cy.getElementById(id);
            if (!n || n.length === 0 || n.hasClass('discovery-hidden')) continue;
            if (n.hasClass('undiscovered-placeholder')) placeholder = true;
            const bb = n.boundingBox({ includeLabels: false });
            x1 = Math.min(x1, bb.x1); y1 = Math.min(y1, bb.y1); x2 = Math.max(x2, bb.x2); y2 = Math.max(y2, bb.y2);
            shown += 1;
        }
        if (shown === 0) return null;
        return { x1: x1 - pad, y1: y1 - pad, x2: x2 + pad, y2: y2 + pad, label: placeholder ? '???' : box.label, shown };
    }

    /** Place every box on screen. */
    sync() {
        const cy = this.ui.cy;
        if (!cy || this.boxes.length === 0) return;
        this.syncCount += 1;
        this.layer();
        const z = cy.zoom();
        const pan = cy.pan();
        for (const b of this.boxes) {
            if (!b.el) continue;
            const m = this.modelBoxOf(b);
            if (!m) { b.el.style.display = 'none'; continue; }
            b.el.style.left = `${m.x1 * z + pan.x}px`;
            b.el.style.top = `${m.y1 * z + pan.y}px`;
            b.el.style.width = `${(m.x2 - m.x1) * z}px`;
            b.el.style.height = `${(m.y2 - m.y1) * z}px`;
            b.el.style.display = 'block';
            b.labelEl.textContent = m.label;
        }
    }

    /** The boxes now, in model coordinates (for the tests, the in-app row and the shots). */
    report() {
        return this.boxes.map((b) => ({ dungeon: b.dungeon, label: b.label, members: [...b.members], box: this.modelBoxOf(b) }));
    }

    destroy() {
        this.clear();
        const host = this.ui.graphContainer;
        this._layer?.remove?.();
        // Leave the isolation the map look needs while its canvas is there.
        if (host?.style && !host.querySelector?.('.rg-map-look-canvas')) host.style.isolation = this._hostIsolation ?? '';
        this._layer = null;
        this._boundCy = null;
    }
}
