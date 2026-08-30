/**
 * flashPanel/seedlingRandomizerReadout — **"found X for Player Y", as a
 * WIDGET rather than a log line** (EDITOR INTEGRATION slice P1-d; plan §17.5).
 *
 * The panel already logs the glue's `flashSeedling:apItemFound` message into
 * `.flash-panel-log`, and that line stays: the log is the transcript. This is
 * the STATE beside it — how many placements this session has found, and the
 * last few, which is the question a person actually asks while playing and the
 * one a scrolling log answers worst.
 *
 * ⛔ PURE, AND SEPARATE FROM THE DOM ON PURPOSE. The panel is browser-only and
 * has no unit suite; a counter that lived inside the DOM handler could only be
 * checked by looking at a screenshot. `record()` is a reducer over the same
 * payload the glue publishes, so the browser row only has to prove that the
 * ELEMENT shows what this says.
 *
 * ⛓ ITS LIFETIME IS THE MOUNT'S. flashPanelUI builds one per mount beside
 * `_apItemFoundHandler` and drops it with the handler — a remounted panel that
 * kept the old one would count into a detached element (the trap that handler's
 * own comment names).
 */

/** How many recent finds the widget shows. */
export const RECENT_LIMIT = 3;

export function createApFoundReadout({ limit = RECENT_LIMIT } = {}) {
    let found = 0;
    let recent = [];
    return {
        get found() { return found; },
        get recent() { return recent; },
        /**
         * ⛓ REFUSES A PAYLOAD IT CANNOT RENDER rather than counting it. An
         * event with no location is not a find; counting it would make the
         * headline number disagree with the rows under it, which is the one
         * way a readout actively misleads.
         */
        record({ location, item, player, forSelf } = {}) {
            if (typeof location !== 'string' || typeof item !== 'string') return false;
            found += 1;
            recent = [{ location, item, player: player ?? null, forSelf: Boolean(forSelf) },
                ...recent].slice(0, limit);
            return true;
        },
        /** The rendered lines, newest first — one string per recent find. */
        lines() {
            return recent.map((r) => `${r.item} → ${r.forSelf ? 'you' : `Player ${r.player}`} `
                + `@ ${r.location}`);
        },
        /** The headline. Singular at one, because a readout that says
         *  "1 locations" reads as broken. */
        headline() {
            return found === 0
                ? 'no Archipelago placements found yet'
                : `${found} placement${found === 1 ? '' : 's'} found`;
        },
        reset() { found = 0; recent = []; },
    };
}
