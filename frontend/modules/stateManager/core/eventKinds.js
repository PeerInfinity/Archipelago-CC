/**
 * Event kinds — which EVENT locations the state manager may collect on its own
 * (RULES `rules-obstacle-events`).
 *
 * The reachability engine auto-collects an event once its location is reachable
 * (`autoCollectEventsEnabled`, `reachabilityEngine.computeReachableRegions`).
 * That is right for a LOGIC event (AP's own sweep does the same) and wrong for
 * one that mirrors state the GAME keeps: a saved obstacle's flag
 * (`event_kind: 'game_state'`, `flashPanel/seedlingObstacleEvents.js`) is set
 * when the player really breaks the rock, and collecting it on reach would
 * open the edge it gates with nothing broken in the game. Those are collected
 * by the runtime that watches the game's persistence flag, never here.
 *
 * ⛔ FAIL-CLOSED: an event with NO `event_kind` keeps today's behaviour (every
 * committed event before this slice); a kind is auto-collected only when this
 * table says so, so an unknown kind is NOT.
 */
export const EVENT_KIND_POLICY = Object.freeze({
    game_state: Object.freeze({
        autoCollect: false,
        why: 'mirrors a flag the game saves (a broken rock); the runtime collects it on the game\'s flag',
    }),
});

/** True when the reachability engine may auto-collect this event location. */
export function autoCollectsEvent(location) {
    const kind = location?.event_kind;
    if (kind === undefined || kind === null) return true;
    return EVENT_KIND_POLICY[kind]?.autoCollect === true;
}
