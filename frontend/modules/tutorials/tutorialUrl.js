/**
 * tutorialUrl.js — `?tutorial=<id>[&tutorialStep=<n>]`: open the Tutorial
 * panel on that tutorial when the app opens (⚖ the user, 2026-10-10). The
 * request is read ONCE per page load and consumed by whichever panel instance
 * starts it, so a panel closed and reopened later does not restart it.
 *
 * `tutorialStep` is 1-based, as the panel shows it ("Step 3 of 12").
 * Pure apart from reading `location.search`, so the parser is unit-tested.
 */
export const TUTORIAL_PARAM = 'tutorial';
export const STEP_PARAM = 'tutorialStep';

/** `{ id, index }` (index 0-based) from a query string, or null when it names no tutorial. */
export function parseTutorialRequest(search) {
    const params = new URLSearchParams(search);
    const id = params.get(TUTORIAL_PARAM)?.trim();
    if (!id) return null;
    const step = Number.parseInt(params.get(STEP_PARAM) ?? '', 10);
    return { id, index: Number.isFinite(step) && step >= 1 ? step - 1 : 0 };
}

/** A link to `base` that opens tutorial `id` (keeps `base`'s own query, e.g. `?game=…&seed=…`). */
export function tutorialLink(base, id) {
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${TUTORIAL_PARAM}=${encodeURIComponent(id)}`;
}

let pending;

/** The page's request, the first time it is asked for; afterwards null. */
export function takeTutorialRequest() {
    if (pending === undefined) {
        pending = typeof location !== 'undefined' ? parseTutorialRequest(location.search) : null;
    }
    const r = pending;
    pending = null;
    return r;
}

/** Is there a request nobody has taken yet? (does not consume it) */
export function hasTutorialRequest() {
    if (pending === undefined) {
        pending = typeof location !== 'undefined' ? parseTutorialRequest(location.search) : null;
    }
    return pending !== null;
}
