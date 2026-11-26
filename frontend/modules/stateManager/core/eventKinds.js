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
 * `substrate_state` (AN-TIME-2) is the same rule for state a SUBSTRATE's own
 * runtime keeps: an ActionNodes knowledge flag is held once the node that
 * teaches it is performed, not once that node is reachable.
 *
 * ⛔ FAIL-CLOSED: an event with NO `event_kind` keeps today's behaviour (every
 * committed event before this slice); a kind is auto-collected only when this
 * table says so, so an unknown kind is NOT.
 */
export const EVENT_KIND_POLICY = Object.freeze({
    game_state: Object.freeze({
        autoCollect: false,
        playerCheckable: false,
        why: 'mirrors a flag the game saves (a broken rock); the runtime collects it on the game\'s flag',
    }),
    goal: Object.freeze({
        autoCollect: false,
        playerCheckable: true,
        why: 'an add-on slot\'s goal event (client/core/upstreamGoal.js): reaching it is not finishing; it is checked like any location (a click, the Timer, a bot, the Loop queue), and that check reports the goal',
    }),
    substrate_state: Object.freeze({
        autoCollect: false,
        playerCheckable: false,
        why: 'state a substrate runtime keeps (an ActionNodes knowledge flag, `Knows: <flag>`): it is learned by PERFORMING the node, so the runtime collects it on the action (actionNodes/actionNodesRuntime.js), never on reach',
    }),
});

/** True when the reachability engine may auto-collect this event location. */
export function autoCollectsEvent(location) {
    const kind = location?.event_kind;
    if (kind === undefined || kind === null) return true;
    return EVENT_KIND_POLICY[kind]?.autoCollect === true;
}

/**
 * True when an event location is one a player (or the Timer / a bot acting for one) checks
 * like an ordinary location, rather than one the state manager or a game runtime collects.
 * Fail-closed: only a kind whose policy row says so.
 */
export function playerChecksEvent(location) {
    const kind = location?.event_kind;
    if (kind === undefined || kind === null) return false;
    return EVENT_KIND_POLICY[kind]?.playerCheckable === true;
}
