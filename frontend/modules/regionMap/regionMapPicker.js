/**
 * regionMapPicker.js — the Region Map's "Go to a region / location" without touching the canvas.
 *
 * The Map's cells and squares are drawn on a canvas, so nothing outside a pointer can click one: not a keyboard user,
 * and not a tutorial step (its actions name DOM controls). The Region Graph has the same picker for the same reason
 * (`regionGraph/nodePicker.js`); this is its Map twin, in the same shape and wording: two text boxes with suggestion
 * lists, in a section that starts folded.
 *
 * ⛓ Choosing a name does EXACTLY what clicking it on the canvas does: the panel's own `clickCell` (the pointer-up
 * path: select the cell, then `clickAt` → `runRegionMapClick`), so the same `regionView:*Clicked` events, the same
 * "On click" actions, the same status. Then it centres the camera on the cell (`centreOnRegion`, which turns Follow off
 * as a manual pan does).
 *
 * Regions are the Map's CELLS that are drawn (not hidden by discovery), by their display key: a cell is what a canvas
 * click hits, and a click on a cell runs the region actions on its region (`regionOfCell`). Locations are those cells'
 * squares (`model.cells[key].tiles`), less any discovery hides or shows as a placeholder.
 *
 * The wiring (lists, refresh, boxes) is `regionView/goToPicker.js`, shared with the Graph's twin
 * (`regionGraph/nodePicker.js`, region-view-dedup); the markup, the lists' contents, the clicks and the wording stay
 * here.
 */
import { pickerSelectors, setupGoToPicker } from '../regionView/goToPicker.js';

export const MAP_PICKER = pickerSelectors('region-map-pick');

let listIds = 0;

/** The picker's element (folded), for the toolbar. */
export function buildRegionMapPicker(doc = document) {
    const n = ++listIds;
    const root = doc.createElement('details');
    root.className = 'region-map-pick';
    root.innerHTML = `
          <summary style="cursor: pointer; user-select: none;">Go to (instead of clicking a cell):</summary>
          <label style="display: inline-block; margin: 2px 4px 2px 0;">
            <span>Region:</span>
            <input type="text" class="region-map-pick-region" list="region-map-pick-region-list-${n}" placeholder="type or choose…" autocomplete="off" style="width: 130px; padding: 1px;">
          </label>
          <label style="display: inline-block; margin: 2px 4px 2px 0;">
            <span>Location:</span>
            <input type="text" class="region-map-pick-location" list="region-map-pick-location-list-${n}" placeholder="type or choose…" autocomplete="off" style="width: 150px; padding: 1px;">
          </label>
          <datalist id="region-map-pick-region-list-${n}"></datalist>
          <datalist id="region-map-pick-location-list-${n}"></datalist>
          <span class="region-map-pick-status" style="font-size: 11px; color: #aaa;"></span>`;
    Object.assign(root.style, { fontSize: '11px' });
    return root;
}

/** The drawn cells: display key → frame (discovery's hidden ones left out). Pure over the panel's fields. */
export function pickableCells(ui) {
    const view = ui.view?.get();
    const out = new Map();
    for (const [key, frame] of ui.frames ?? new Map()) {
        if (ui._visibilityOf(key, view) !== 'hidden') out.set(key, frame);
    }
    return out;
}

/** Those cells' locations: location name → the cell's display key (hidden and placeholder ones left out). */
export function pickableLocations(ui, cells = pickableCells(ui)) {
    const view = ui.view?.get();
    const out = new Map();
    for (const key of cells.keys()) {
        if (ui._visibilityOf(key, view) === 'placeholder') continue;
        for (const t of ui.model?.cells.get(key)?.tiles ?? []) {
            const vis = view?.locations?.get(t.location)?.visibility;
            if (vis === 'hidden' || vis === 'placeholder') continue;
            if (!out.has(t.location)) out.set(t.location, { key, kind: t.kind ?? 'item' });
        }
    }
    return out;
}

/**
 * Wire the picker `root` to panel `ui` (a RegionMapUI). → `{ refresh, goToRegion(name), goToLocation(name) }`; the two
 * `goTo*` resolve to the click's record (`ui.lastClick`) or null, after the status line is written.
 */
export function setupRegionMapPicker(ui, root) {
    const [regionList, locationList] = root.querySelectorAll('datalist');
    const { refresh, say } = setupGoToPicker({
        root,
        selectors: MAP_PICKER,
        lists: () => [regionList, locationList],
        regions: () => pickableCells(ui),
        locations: (cells) => pickableLocations(ui, cells),
        goRegion: (name) => goToRegion(name).catch((e) => say(`Could not go to ${name}: ${e?.message ?? e}`)),
        goLocation: (name) => goToLocation(name).catch((e) => say(`Could not go to ${name}: ${e?.message ?? e}`)),
    });

    async function goToRegion(name) {
        const frame = pickableCells(ui).get(name);
        if (!frame) { say(`No region "${name}" on the map.`); return null; }
        const click = await ui.clickCell(frame, null);
        ui.centreOnRegion(name);
        say(`Went to region ${name}.`);
        return click;
    }

    async function goToLocation(name) {
        const cells = pickableCells(ui);
        const hit = pickableLocations(ui, cells).get(name);
        if (!hit) { say(`No location "${name}" in the map's cells.`); return null; }
        const click = await ui.clickCell(cells.get(hit.key), { location: name, kind: hit.kind });
        ui.centreOnRegion(hit.key);
        say(`Went to location ${name} (in ${hit.key}).`);
        return click;
    }

    return { refresh, goToRegion, goToLocation };
}
