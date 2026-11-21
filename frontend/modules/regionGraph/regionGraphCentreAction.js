/**
 * ⛓ `regionGraph.centre` (mode-toggle design §4.2, slice CA-S4): "centre the Region Graph on the clicked region", the
 * Region Graph's own action, offered to the OTHER map panel (the Region Map) and never to the Graph itself
 * (`offeredTo`). It starts OFF in every strip (`initial`), so a click does what it did before CA-S4 until a user turns
 * it on. Registered by `regionGraph/index.js` `initialize`, unregistered by its cleanup.
 *
 * It centres every live Region Graph panel that draws the region (the animation the "Go to" picker uses,
 * `nodePicker.js` `centreOn`), and changes nothing else: no selection, no path, no event.
 */
import { PANEL_ACTION_IDS } from '../regionView/clickActions.js';

/** Centre one panel's graph on `regionName`. → true when it draws that node. */
export function centreGraphOn(ui, regionName) {
    const cy = ui?.cy;
    if (!cy || typeof cy.getElementById !== 'function') return false;
    const node = cy.getElementById(regionName);
    if (!node || (typeof node.empty === 'function' ? node.empty() : node.length === 0)) return false;
    cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1) }, { duration: 300 });
    return true;
}

/** The descriptor, over `getPanels()` (the live Region Graph panels). */
export function makeRegionGraphCentreAction(getPanels) {
    return Object.freeze({
        id: PANEL_ACTION_IDS.graphCentre,
        owner: 'regionGraph',
        label: 'Centre the Region Graph on it',
        summary: 'centre Graph',
        target: 'region',
        kind: 'toggle',
        initial: () => false,
        offeredTo: (panelId) => panelId !== 'regionGraph',
        run: (h, ctx) => {
            let centred = 0;
            for (const ui of getPanels()) if (centreGraphOn(ui, ctx.regionName)) centred++;
            return centred > 0 ? { ok: true, centred } : { ok: false, reason: 'not-drawn' };
        },
    });
}
