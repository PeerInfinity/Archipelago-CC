/**
 * nodePicker.js — "Go to a region / location" without touching the canvas.
 *
 * The graph's nodes are drawn by Cytoscape on a canvas, so nothing outside a
 * pointer can tap one: not a keyboard user, and not a tutorial step (its
 * actions name DOM controls). The picker is two text boxes with suggestion
 * lists, in a section of the controls that starts folded (⚖ the user,
 * 2026-10-10: "both regions and locations, in a collapsible section that's
 * collapsed by default"). Choosing a name does EXACTLY what tapping its node
 * does — the same handler, so the "On Region Node Click" options apply — and
 * centres the view on it.
 *
 * Regions are the graph's own region nodes (what the graph shows, so
 * discovery mode hides what it hides). Locations are every location of those
 * regions, whether or not a location node is drawn right now (they are only
 * drawn on hover / zoom, up to a limit): an undrawn one is handed to the tap
 * handler as a stand-in that answers the same `data()` keys.
 */
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import discoveryStateSingleton from '../discovery/singleton.js';

export const PICKER = Object.freeze({
    section: 'details.rg-pick',
    region: 'input.rg-pick-region',
    location: 'input.rg-pick-location',
    status: '.rg-pick-status',
});

export function pickerHTML() {
    return `
        <details class="rg-pick" style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #555;">
          <summary style="font-weight: bold; margin-bottom: 5px; cursor: pointer; user-select: none;">Go to (instead of clicking a node):</summary>
          <label style="display: block; margin: 3px 0;">
            <span style="display: inline-block; width: 62px;">Region:</span>
            <input type="text" class="rg-pick-region" list="rg-pick-region-list" placeholder="type or choose…" autocomplete="off" style="width: 150px; padding: 2px;">
          </label>
          <label style="display: block; margin: 3px 0;">
            <span style="display: inline-block; width: 62px;">Location:</span>
            <input type="text" class="rg-pick-location" list="rg-pick-location-list" placeholder="type or choose…" autocomplete="off" style="width: 150px; padding: 2px;">
          </label>
          <datalist id="rg-pick-region-list"></datalist>
          <datalist id="rg-pick-location-list"></datalist>
          <div class="rg-pick-status" style="font-size: 11px; color: #aaa; min-height: 1em;"></div>
        </details>`;
}

/** The region nodes the graph shows: name → node. */
function regionNodes(ui) {
    const out = new Map();
    ui.cy?.nodes().forEach((n) => {
        if (n.hasClass('player') || n.hasClass('location-node') || n.hasClass('discovery-hidden')) return;
        const name = n.data('regionName');
        if (name) out.set(name, n);
    });
    return out;
}

/** Every location of those regions: name → parent region. */
function locationsOf(ui, regions) {
    const staticData = stateManager.getStaticData?.();
    const out = new Map();
    for (const region of regions.keys()) {
        for (const loc of staticData?.regions?.get(region)?.locations ?? []) {
            if (ui.isDiscoveryModeActive && !discoveryStateSingleton.isLocationDiscovered(loc.name)) continue;
            out.set(loc.name, region);
        }
    }
    return out;
}

function fillList(list, names) {
    list.replaceChildren(...[...names].sort((a, b) => a.localeCompare(b)).map((name) => {
        const o = document.createElement('option');
        o.value = name;
        return o;
    }));
}

function centreOn(ui, node) {
    ui.cy.animate({ center: { eles: node }, zoom: Math.max(ui.cy.zoom(), 1) }, { duration: 300 });
}

export function setupNodePicker(ui) {
    const root = ui.controlPanel.querySelector(PICKER.section);
    if (!root) return;
    const regionBox = root.querySelector(PICKER.region);
    const locationBox = root.querySelector(PICKER.location);
    const status = root.querySelector(PICKER.status);
    const say = (text) => { status.textContent = text; };

    // The lists are read when they can be used, not kept in step with the graph.
    const refresh = () => {
        const regions = regionNodes(ui);
        fillList(root.querySelector('#rg-pick-region-list'), regions.keys());
        fillList(root.querySelector('#rg-pick-location-list'), locationsOf(ui, regions).keys());
    };
    root.addEventListener('toggle', () => { if (root.open) refresh(); });
    regionBox.addEventListener('focus', refresh);
    locationBox.addEventListener('focus', refresh);

    regionBox.addEventListener('change', () => {
        const name = regionBox.value.trim();
        if (!name) return;
        const node = regionNodes(ui).get(name);
        if (!node) return say(`No region "${name}" in the graph.`);
        ui.interactionManager.handleRegionNodeClick(node);
        centreOn(ui, node);
        say(`Went to region ${name}.`);
    });

    locationBox.addEventListener('change', () => {
        const name = locationBox.value.trim();
        if (!name) return;
        const regions = regionNodes(ui);
        const parent = locationsOf(ui, regions).get(name);
        if (!parent) return say(`No location "${name}" in the graph's regions.`);
        const drawn = ui.cy.nodes('.location-node').filter((n) => (n.data('locationName') || n.data('label')) === name)[0];
        const data = { locationName: name, label: name, parentRegion: parent };
        ui.interactionManager.handleLocationNodeClick(drawn ?? { data: (key) => data[key] });
        centreOn(ui, drawn ?? regions.get(parent));
        say(`Went to location ${name} (in ${parent}).`);
    });
}
