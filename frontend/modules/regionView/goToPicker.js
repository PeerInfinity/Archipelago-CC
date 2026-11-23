/**
 * ⛓ goToPicker.js — the "Go to a region / location" picker's wiring, ONE copy for both maps (region-view-dedup).
 *
 * A map drawn on a canvas cannot be clicked by a keyboard user or a tutorial step, so each map panel carries two text
 * boxes with suggestion lists, in a folded section: the Region Graph's `regionGraph/nodePicker.js` (`rg-pick*`) and
 * the Region Map's `regionMap/regionMapPicker.js` (`region-map-pick*`). They were twins; this is what they share:
 *   - the selectors, from the class prefix (`pickerSelectors`);
 *   - the suggestion lists (`fillList`: sorted, one `<option>` per name);
 *   - when the lists are read: on opening the section, and on either box's focus;
 *   - the boxes: a trimmed, non-blank name goes to the panel's `goRegion(name)` / `goLocation(name)`.
 * What stays in each panel: its markup (the two differ in layout and wording, and each is pinned byte for byte), what
 * its lists hold (`regions()` / `locations(regions)`), what choosing a name does, and the status wording.
 */

/** A picker's selectors from its class prefix (`rg-pick`, `region-map-pick`). */
export function pickerSelectors(prefix) {
    return Object.freeze({
        section: `details.${prefix}`,
        region: `input.${prefix}-region`,
        location: `input.${prefix}-location`,
        status: `.${prefix}-status`,
    });
}

/** Fill a `<datalist>` with one `<option>` per name, sorted (created in the list's own document). */
export function fillList(list, names) {
    const doc = list.ownerDocument ?? document;
    list.replaceChildren(...[...names].sort((a, b) => a.localeCompare(b)).map((name) => {
        const o = doc.createElement('option');
        o.value = name;
        return o;
    }));
}

/**
 * Wire a picker. → `{ refresh, say }`.
 * @param {object} p
 * @param {Element} p.root - the picker's `<details>`
 * @param {object} p.selectors - `pickerSelectors(prefix)`
 * @param {() => [Element, Element]} p.lists - the region and location `<datalist>`s, read at each refresh
 * @param {() => Map} p.regions - the pickable regions: name → whatever `locations` and the panel need
 * @param {(regions: Map) => Map} p.locations - the pickable locations of those regions: name → …
 * @param {(name: string) => void} p.goRegion - choose a region (the panel writes the status through `say`)
 * @param {(name: string) => void} p.goLocation - choose a location
 */
export function setupGoToPicker({ root, selectors, lists, regions, locations, goRegion, goLocation }) {
    const regionBox = root.querySelector(selectors.region);
    const locationBox = root.querySelector(selectors.location);
    const status = root.querySelector(selectors.status);
    const say = (text) => { status.textContent = text; };

    // The lists are read when they can be used, not kept in step with the map.
    const refresh = () => {
        const found = regions();
        const [regionList, locationList] = lists();
        fillList(regionList, found.keys());
        fillList(locationList, locations(found).keys());
    };
    root.addEventListener('toggle', () => { if (root.open) refresh(); });
    regionBox.addEventListener('focus', refresh);
    locationBox.addEventListener('focus', refresh);

    regionBox.addEventListener('change', () => {
        const name = regionBox.value.trim();
        if (name) goRegion(name);
    });
    locationBox.addEventListener('change', () => {
        const name = locationBox.value.trim();
        if (name) goLocation(name);
    });
    return { refresh, say };
}
