/**
 * seedlingDemo/frontierReadout.js — **THE CAMPAIGN READOUT'S ROUTE SENTENCE,
 * spelled once** (tile-frontier-route, ⚖ user 2026-11-04: "A: Small follow-up
 * (Recommended)").
 *
 * `watchViewer.renderCampaign` prints it under ROUTE COMPLETE, and the browser
 * gate (`check-seedling-editor-sequence.mjs` claim 13) re-derives the route
 * difference from the committed recording route and today's survey route, feeds
 * it through THIS function, and requires the page to show exactly that. Pure and
 * browser-safe: no imports, no DOM.
 */

/**
 * The sentence for where today's route leaves the route the chain was recorded
 * on, from the frontier's own fields (`recordingRoute`, and `routeDiffers` =
 * `coverage['route-only'].differsFromRecorded`); null when the frontier names no
 * recording route, or when the two routes agree.
 */
export function routeDiffersLine(frontier) {
    if (!frontier?.recordingRoute) return null;
    const d = frontier.routeDiffers;
    if (d === undefined) {
        return '⚠ today\'s route was not compared (no survey was on disk when the frontier '
            + 'was written).';
    }
    if (d === null) return null;
    const exitOf = (s) => (s.restart ? null : s.goals.filter((g) => /→ L\d+$/.test(g)).at(-1) ?? null);
    const side = (s) => {
        const exit = exitOf(s);
        const did = s.goals.filter((g) => g !== exit);
        const then = s.crossesTo === null ? `ends in L${s.level}`
            : s.restart ? `restarts to L${s.crossesTo}`
                : exit ? `leaves by ${exit}` : `leaves to L${s.crossesTo}`;
        return `(L${s.level}): ${did.length ? `${did.join('; ')}, then ` : ''}${then}`;
    };
    return `⚠ Today's survey picks a different route from step ${d.fromStep}. `
        + `The recording ${side(d.recorded)}. `
        + `Today ${d.current ? side(d.current) : 'has no such step'} `
        + `(${d.currentSteps} steps against the recording's ${d.recordedSteps}). `
        + 'The tapes still play end to end; growing the chain past its tail needs it '
        + 'on today\'s route (a re-record).';
}

