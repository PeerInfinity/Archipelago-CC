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

/** Does `ui`'s graph draw a node `regionName`? */
function drawsNode(cy, regionName) {
    if (!cy || typeof cy.getElementById !== 'function') return false;
    const node = cy.getElementById(regionName);
    return !!node && !(typeof node.empty === 'function' ? node.empty() : node.length === 0);
}

/**
 * Centre one panel's graph on `regionName`. → true when it draws that node.
 *
 * ⛓ A HIDDEN GRAPH (its tab not the active one: Cytoscape measures 0×0) is not animated: showing the tab fits the
 * graph (`regionGraphUI.js` `onPanelShow`), which would undo it unseen. The name is kept as `ui.pendingCentreOn`
 * (the last one wins) and `onPanelShow` centres on it instead of fitting (`applyPendingCentre`; region-map
 * tutorial G4). The action never shows the tab itself.
 */
export function centreGraphOn(ui, regionName) {
    const cy = ui?.cy;
    if (!drawsNode(cy, regionName)) return false;
    const node = cy.getElementById(regionName);
    if (typeof cy.width === 'function' && cy.width() === 0) {
        ui.pendingCentreOn = regionName;
        return true;
    }
    ui.pendingCentreOn = null;
    cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1) }, { duration: 300 });
    // ⛓ A DOM readout of the last centring (region-map tutorial, G3): a step's `done` reads no Cytoscape instance.
    if (ui.rootElement?.dataset) Object.assign(ui.rootElement.dataset, { centredOn: regionName, centredAt: String(Date.now()) });
    return true;
}

/**
 * On a show (`onPanelShow`, after `cy.resize()`): centre on the pending name, if any and still drawn. → true when it
 * centred (the caller then does not fit); the pending name is cleared either way.
 */
export function applyPendingCentre(ui) {
    const name = ui?.pendingCentreOn ?? null;
    if (!name) return false;
    ui.pendingCentreOn = null;
    return drawsNode(ui.cy, name) && centreGraphOn(ui, name);
}

/** A rebuilt graph that no longer draws the pending name drops it (`graphDataManager.js` after a rebuild). */
export function dropStalePendingCentre(ui) {
    if (ui?.pendingCentreOn && !drawsNode(ui.cy, ui.pendingCentreOn)) ui.pendingCentreOn = null;
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
