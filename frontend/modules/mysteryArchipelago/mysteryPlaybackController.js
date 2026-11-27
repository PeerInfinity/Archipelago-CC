/**
 * The Playback Bot's controller for a `mystery` region (the registry's `getPlaybackController`).
 *
 * It answers through the HOST: a walk to a location checks it (under the client's logic gate), and a walk to an exit leaves the office by it. It does not read the case or work
 * the page; the page learns the question is solved from the next `mystery:state`, as it does for
 * a check made on another device. Each target lands in one step, so there is nothing to play,
 * step or pace.
 *
 * Pure: every dependency is handed in (index.js installs the live one), so it runs in node.
 */

export const MYSTERY_WALK_REFUSALS = Object.freeze({
    NO_CASE_REGION: 'the player is not in a region that is a mystery case',
    NOT_A_QUESTION: 'the location is not a question of this case',
    NO_SUCH_EXIT: 'the region has no such exit',
    UNKNOWN_TARGET: 'a mystery case has only locations and exits to walk to',
});

/** The region an exit entry of a deserialised world leads to. */
function exitTarget(exit) {
    return exit?.targetRegion ?? exit?.target_region ?? exit?.connected_region ?? exit?.to ?? null;
}

/**
 * @param {Object} deps
 * @param {{publish: Function}} deps.dispatcher - the module's dispatcher
 * @param {() => Array<{regionId: string, payload: Object}>} deps.getCaseRegions
 * @param {() => string|null} deps.getActiveRegionId
 * @param {string} deps.sourceModule - the `sourceModule` a check carries
 */
export function createMysteryPlaybackController({ dispatcher, getCaseRegions, getActiveRegionId, sourceModule }) {
    const controller = {
        lastRefusal: null,
        play() {},
        stop() {},
        step() {},
        instant() {},
        reset() {},
        setRate() {},

        /** @param {{kind: string, name?: string}} target @returns {boolean} false when the target cannot be taken */
        walkTo(target) {
            controller.lastRefusal = null;
            const refuse = (reason) => { controller.lastRefusal = reason; return false; };
            const here = getActiveRegionId();
            const region = (getCaseRegions() ?? []).find((r) => r.regionId === here);
            if (!region) return refuse(MYSTERY_WALK_REFUSALS.NO_CASE_REGION);
            if (target?.kind === 'location') {
                const names = Object.values(region.payload?.ap_locations ?? {});
                if (!names.includes(target.name)) return refuse(MYSTERY_WALK_REFUSALS.NOT_A_QUESTION);
                // Not `reportedByGame`: the page did not solve it, so the client's logic gate applies
                // (a question whose papers are not held is not checked).
                dispatcher.publish('user:locationCheck', {
                    locationName: target.name, regionName: here, sourceModule, originator: 'PlaybackBot', fromBot: true,
                }, { initialTarget: 'bottom' });
                return true;
            }
            if (target?.kind === 'exit') {
                const exits = region.payload?.exits;
                const exit = exits instanceof Map ? exits.get(target.name) : null;
                const to = exitTarget(exit);
                if (!to) return refuse(MYSTERY_WALK_REFUSALS.NO_SUCH_EXIT);
                dispatcher.publish('user:regionMove', {
                    sourceRegion: here, targetRegion: to, exitName: target.name, sourceModule, originator: 'PlaybackBot', fromBot: true,
                }, { initialTarget: 'bottom' });
                return true;
            }
            return refuse(MYSTERY_WALK_REFUSALS.UNKNOWN_TARGET);
        },
    };
    // A loops Bot block calls `perform` when a controller has it; here it is the same act.
    controller.perform = controller.walkTo;
    return controller;
}
