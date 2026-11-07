/**
 * recordingRoute.js — **THE ROUTE THE CAMPAIGN CHAIN WAS RECORDED ON, compared
 * with today's.** (tile-frontier-route, ⚖ user 2026-11-04: *"A: Small follow-up
 * (Recommended)"*.)
 *
 * The committed `fixtures/campaign-recording-route.json` is a projection of a
 * `route.json` the survey wrote (`survey-seedling-route.mjs --derive-only`) at the
 * commit it names. `census-seedling-campaign.mjs` aligns the chain against it and
 * reports where today's route leaves it; `rerecord-seedling-campaign.mjs --grow`
 * refuses to grow a chain whose route the survey no longer picks. ONE spelling of
 * "the same walk" for both, here.
 *
 * ⛓ Two routes are compared on the PHYSICAL WALK of each step —
 * `(level, visit, crossesTo, restart)`. Goal prose is not compared: the sphere
 * labels inside it move without the route moving.
 *
 * Pure: no I/O, no imports.
 */

/** The fixture's path, relative to the repository root. */
export const RECORDING_ROUTE_REL = 'frontend/modules/seedlingDemo/fixtures/campaign-recording-route.json';

/** A survey route step, reduced to what alignment, the divergence and the readout read. */
export function projectStep(s) {
    return {
        step: s.step,
        level: s.level,
        visit: s.visit,
        crossesTo: s.crossesTo ?? null,
        restart: s.restart === true,
        goals: (s.goals ?? []).map((g) => ({
            kind: g.kind, why: g.why, ...(g.then !== undefined ? { then: g.then } : {}),
        })),
    };
}

/** The physical walk of one step, or null for a step that is not there. */
export function walkTuple(s) {
    return s ? [s.level, s.visit, s.crossesTo ?? null, s.restart === true] : null;
}

export function sameWalk(a, b) {
    return JSON.stringify(walkTuple(a)) === JSON.stringify(walkTuple(b));
}

const view = (s) => (s ? {
    level: s.level, visit: s.visit, crossesTo: s.crossesTo ?? null,
    restart: s.restart === true, goals: (s.goals ?? []).map((g) => g.why),
} : null);

/**
 * The first step at which `current` leaves `recorded`, or null when the two walk
 * alike over the RECORDED route's length. Today's route may run longer than the
 * recording: that is room to grow, not a divergence.
 *
 * @param {object[]} recorded the recording route's steps
 * @param {object[]} current today's route's steps
 * @param {string[]} [segments] the chain's segment names, index-aligned with the recording
 */
export function routeDifference(recorded, current, segments = []) {
    for (let k = 0; k < recorded.length; k += 1) {
        if (sameWalk(recorded[k], current[k])) continue;
        return {
            fromStep: recorded[k].step,
            segment: segments[k] ?? null,
            recorded: view(recorded[k]),
            current: view(current[k]),
            recordedSteps: recorded.length,
            currentSteps: current.length,
        };
    }
    return null;
}

/** One line a reader can follow: where the walk goes from one step. */
export function describeWalk(s) {
    if (!s) return 'no such step';
    const out = s.crossesTo === null ? 'ends there'
        : s.restart ? `restarts to L${s.crossesTo}` : `leaves to L${s.crossesTo}`;
    return `L${s.level}: ${s.goals.join('; ')} — ${out}`;
}

/**
 * `--grow`'s guard. Growing appends today's next route step to the chain; when
 * today's route has left the route the chain was recorded on, that would splice
 * two routes into one chain (and on a shorter route, `steps[covered]` reads past
 * its end and says "THE ROUTE ENDS HERE", which is false). Returns null when the
 * routes agree, else `{ what, detail }` naming the step.
 */
export function growRouteRefusal(recorded, current, segments = []) {
    const d = routeDifference(recorded, current, segments);
    if (!d) return null;
    return {
        what: `TODAY'S ROUTE LEAVES THE ROUTE THE CHAIN WAS RECORDED ON, at step ${d.fromStep}`,
        detail: `   recorded (${d.recordedSteps} steps): ${describeWalk(d.recorded)}\n`
            + `   today    (${d.currentSteps} steps): ${describeWalk(d.current)}\n`
            + `   the chain's segment there: ${d.segment ?? '(none)'}\n\n`
            + '   ⛔ Growing would append a room of today\'s route to a chain recorded on '
            + 'another, splicing two routes into one walk. The tapes still play; to grow '
            + 'the chain, its tail is re-recorded on today\'s route first — that is a '
            + 'decision for the user, not for this command.',
    };
}
