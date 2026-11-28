/**
 * The Regions panel's "Loading region data..." state, shown WITHOUT touching the panel's skeleton.
 *
 * `#region-details-container` is not a plain list: it holds the section skeleton the renderer fills
 * (`#accessibility-sorted-sections` > `#available-content` / `#unavailable-content`, and
 * `#general-sorted-list-section` > `#general-sorted-list-content`; `regionUI.js` `createRootElement`). The
 * renderer only LOOKS those up (`regionRenderer.js` `renderRegions` / `updateSectionVisibility`); nothing builds
 * them again. The loading state used to be `container.innerHTML = '<p>Loading region data...</p>'`, which
 * destroyed them: a render that bailed for want of data during a world load (the proxy has no snapshot for a
 * moment) left the panel showing "Loading region data..." until the page was reloaded, every later render
 * warning "available-content element not found". The Region Map tutorial's walk tripped on it after other rows
 * had loaded worlds (`CC/docs/region-map/walk-order.md`).
 *
 * So the loading state empties the sections' CONTENT (the old world's blocks go, as before), hides the sections
 * with the `hidden` attribute (separate from the `style.display` the renderer sets per sort method), and shows a
 * message element of its own. Clearing it removes both, so a panel that renders after it is the DOM it would be
 * had it never loaded.
 */

export const REGIONS_LOADING_CLASS = 'region-loading-message';
export const REGIONS_LOADING_TEXT = 'Loading region data...';

const SECTION_IDS = ['accessibility-sorted-sections', 'general-sorted-list-section'];
const CONTENT_IDS = ['available-content', 'unavailable-content', 'general-sorted-list-content'];

/** Show the loading state in `container` (the panel's `#region-details-container`). Idempotent. */
export function showRegionsLoading(container) {
    if (!container) return;
    for (const id of CONTENT_IDS) {
        const el = container.querySelector(`#${id}`);
        if (el) el.innerHTML = '';
    }
    for (const id of SECTION_IDS) {
        const el = container.querySelector(`#${id}`);
        if (el) el.hidden = true;
    }
    if (container.querySelector(`.${REGIONS_LOADING_CLASS}`)) return;
    const p = container.ownerDocument.createElement('p');
    p.className = REGIONS_LOADING_CLASS;
    p.textContent = REGIONS_LOADING_TEXT;
    container.prepend(p);
}

/** Clear it: the message goes and the sections are shown again (the renderer then sets their display). */
export function clearRegionsLoading(container) {
    if (!container) return;
    container.querySelector(`.${REGIONS_LOADING_CLASS}`)?.remove();
    for (const id of SECTION_IDS) {
        const el = container.querySelector(`#${id}`);
        if (el?.hidden) el.removeAttribute('hidden');
    }
}
