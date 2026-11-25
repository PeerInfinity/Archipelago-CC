/**
 * ⛓ THE + / − BADGES (subRegionView = collapsible; region-graph-groups-c; ⚖ the user, session 84c8ab35,
 * 2026-11-24: "Small +/− badge" — "Each collapsed region gets a small + badge on its corner. Clicking the badge opens
 * it into option A's box, and a − badge on the box closes it again. Clicking the node itself still runs your click
 * actions, as in B.").
 *
 * One DOM button per group node, in a layer over the canvas (beside the node-overlay layer, `nodeOverlayManager.js`):
 *   · a CLOSED group's merged node gets a `+`; an OPEN group's box gets a `−`; the button sits centred on the node's
 *     top-right corner, in screen pixels (`BADGE_SIZE_PX` visible inside a `BADGE_HIT_PX` hit square);
 *   · a press on the button opens / closes that group (`GraphDataManager.setSubRegionGroupOpen`). The button is not
 *     inside the Cytoscape container, so the canvas never sees the press: a badge NEVER runs click actions. Its
 *     pointer / mouse / touch events also stop where they land;
 *   · it shows at every zoom where region labels show (`zoom >= ui.zoomLevels.showRegionNames`) and is hidden below
 *     that zoom, and on a node discovery hides.
 * The badges are NOT Cytoscape elements: the element set, every reader of it, saved positions and layouts never see
 * them. In any other view the layer is empty.
 */
import {
    isRegionGroupNode, badgeCentre, badgeText, BADGE_SIZE_PX, BADGE_HIT_PX,
} from './subRegionGroups.js';

export const BADGE_LAYER_CLASS = 'region-graph-group-badges';
export const BADGE_CLASS = 'rg-group-badge';

const LAYER_STYLE = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:6';

/** The button's style: a `BADGE_HIT_PX` transparent square with a `BADGE_SIZE_PX` round glyph drawn in its centre. */
function buttonStyle() {
    return `position:absolute;width:${BADGE_HIT_PX}px;height:${BADGE_HIT_PX}px;margin:0;padding:0;border:0;`
        + `background:transparent;pointer-events:auto;cursor:pointer;touch-action:manipulation;display:none;`;
}
function glyphStyle(open) {
    return `position:absolute;left:${(BADGE_HIT_PX - BADGE_SIZE_PX) / 2}px;top:${(BADGE_HIT_PX - BADGE_SIZE_PX) / 2}px;`
        + `width:${BADGE_SIZE_PX}px;height:${BADGE_SIZE_PX}px;border-radius:50%;box-sizing:border-box;`
        + `border:1px solid #ddd;background:${open ? '#3a3a48' : '#2d6cdf'};color:#fff;`
        + `font:bold 15px/${BADGE_SIZE_PX - 2}px sans-serif;text-align:center;pointer-events:none;`;
}

export class GroupBadgeLayer {
    /** @param {object} ui - the RegionGraphUI (cy, rootElement, dataManager, zoomLevels, subRegionView) */
    constructor(ui, { doc = globalThis.document } = {}) {
        this.ui = ui;
        this.doc = doc;
        this.badges = new Map(); // group node id → button
        this._layer = null;
        this._frame = null;
        this._boundCy = null;
    }

    /** The layer element (created on first use, inside the panel's root, over the canvas). */
    layer() {
        if (this._layer || !this.doc || !this.ui.rootElement) return this._layer;
        const div = this.doc.createElement('div');
        div.className = BADGE_LAYER_CLASS;
        div.setAttribute('style', LAYER_STYLE);
        this.ui.rootElement.appendChild(div);
        this._layer = div;
        return div;
    }

    /** Listen to the cy instance (once per instance): the badges follow pan, zoom, drags and layouts. */
    bind() {
        const cy = this.ui.cy;
        if (!cy || this._boundCy === cy) return;
        this._boundCy = cy;
        const schedule = () => this.scheduleSync();
        cy.on('viewport resize layoutstop', schedule);
        cy.on('position', 'node', schedule);
    }

    /** One badge per group node in `collapsible`; none in any other view. Called after every rebuild. */
    rebuild() {
        this.bind();
        for (const btn of this.badges.values()) btn.remove?.();
        this.badges.clear();
        const cy = this.ui.cy;
        if (!cy || this.ui.subRegionView !== 'collapsible') return;
        const layer = this.layer();
        if (!layer) return;
        cy.nodes().forEach((node) => {
            if (!isRegionGroupNode(node)) return;
            const open = isRegionGroupNode(node, 'box');
            const key = node.data('groupKey');
            const { glyph, title } = badgeText(key, open);
            const btn = this.doc.createElement('button');
            btn.className = `${BADGE_CLASS} ${open ? 'rg-group-badge-open' : 'rg-group-badge-closed'}`;
            btn.setAttribute('type', 'button');
            btn.setAttribute('style', buttonStyle());
            btn.setAttribute('title', title);
            btn.setAttribute('aria-label', title);
            btn.dataset.groupKey = key;
            btn.dataset.open = open ? 'true' : 'false';
            const span = this.doc.createElement('span');
            span.setAttribute('style', glyphStyle(open));
            span.textContent = glyph;
            btn.appendChild(span);
            // The press stops here: nothing below the button (the canvas) hears it.
            for (const type of ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend', 'dblclick']) {
                btn.addEventListener(type, (e) => e.stopPropagation?.());
            }
            btn.addEventListener('click', (e) => {
                e.stopPropagation?.();
                e.preventDefault?.();
                this.press(key, !open);
            });
            layer.appendChild(btn);
            this.badges.set(node.id(), btn);
        });
        this.sync();
    }

    /** The badge's action: open (or close) the group. Runs no click action. → `setSubRegionGroupOpen`'s result. */
    press(key, open) {
        return this.ui.dataManager?.setSubRegionGroupOpen?.(key, open) ?? { changed: false, ms: 0 };
    }

    scheduleSync() {
        if (this._frame !== null || this.badges.size === 0) return;
        const raf = globalThis.requestAnimationFrame ?? ((f) => setTimeout(f, 16));
        this._frame = raf(() => { this._frame = null; this.sync(); });
    }

    /** Is the badge shown at this zoom? Where region labels show (`zoomLevels.showRegionNames`), and above. */
    visibleAtZoom(zoom) {
        return zoom >= (this.ui.zoomLevels?.showRegionNames ?? 0.5);
    }

    /** Place every badge on its node's top-right corner (screen pixels), or hide it. */
    sync() {
        const cy = this.ui.cy;
        if (!cy || this.badges.size === 0) return;
        const showZoom = this.visibleAtZoom(cy.zoom());
        for (const [id, btn] of this.badges) {
            const node = cy.getElementById(id);
            const shown = showZoom && node.length > 0 && !node.hasClass('discovery-hidden') && node.visible?.() !== false;
            if (!shown) { btn.style.display = 'none'; continue; }
            const c = badgeCentre(node.renderedBoundingBox({ includeLabels: false }));
            btn.style.left = `${c.x - BADGE_HIT_PX / 2}px`;
            btn.style.top = `${c.y - BADGE_HIT_PX / 2}px`;
            btn.style.display = 'block';
        }
    }

    /** The badge's centre in the panel's coordinates (for the tests and the shots): null when hidden. */
    centreOf(groupKey) {
        for (const btn of this.badges.values()) {
            if (btn.dataset.groupKey !== groupKey || btn.style.display === 'none') continue;
            return { x: parseFloat(btn.style.left) + BADGE_HIT_PX / 2, y: parseFloat(btn.style.top) + BADGE_HIT_PX / 2 };
        }
        return null;
    }

    /** The badge button of a group (or undefined). */
    buttonOf(groupKey) {
        for (const btn of this.badges.values()) if (btn.dataset.groupKey === groupKey) return btn;
        return undefined;
    }

    destroy() {
        for (const btn of this.badges.values()) btn.remove?.();
        this.badges.clear();
        this._layer?.remove?.();
        this._layer = null;
        this._boundCy = null;
    }
}
