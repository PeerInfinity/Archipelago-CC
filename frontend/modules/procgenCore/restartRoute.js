/**
 * ⛓ THE RESTART MOVE FOR POSITION-AWARE ROUTE PLANNERS — one helper, every planner that moves the PLAYER.
 *
 * ⚖ The user, 2026-10-05: *"I don't want to add new edges that lead to menu. I want the logic to be aware that
 * returning to the menu at any point is always possible."* A slot that declares it (`returnToMenu(rules, p)`,
 * `procgenCore/restartWarp.js`) gives the planner ONE built-in move beside the graph's exits: Restart, which puts
 * the player on the declared start (`Menu`, the Menu panel's `restartTargetOf`), from where the graph's own exits
 * (`GameStart` → the start region) lead on. No edge is added and no crossing is invented: a route that uses it
 * BEGINS with a RESTART step, and the walk after it is an ordinary route from the restart target.
 *
 * WHO USES IT. A planner that plans the player's movement from where the player stands (the Playback Bot's sphere
 * queue and manual targets, the region graph's one-step move). AP reachability is from the start already and never
 * needs it (the path analyzer, `analyzePathToRegion`).
 *
 * FAIL-CLOSED. A slot without the flag, or a document without a restart target, never gets the move: the planner's
 * dead end stays the refusal it was.
 *
 * Route shape = `PathFinder.findPathWithExits`'s: `{steps: [{region, exitUsed}], length}`. A Restart route's
 * `steps[1]` is `{region: <restart target>, exitUsed: null, restart: true}`; every later step is the walk's.
 */

import { returnToMenu } from './restartWarp.js';
import { startRegionsOf } from './rulesGraph.js';

/**
 * ⚖ THE TIE-BREAK — the single rule a later ruling may change. When the player can WALK to the goal from where
 * they stand, the walk wins, however long it is; Restart is taken only when no walk exists.
 */
export const ROUTE_TIE_BREAK = 'walk-before-restart';

/** Which of the two candidate routes the tie-break picks (`null` = neither exists). */
export function preferRoute(walk, restart) {
    return walk ?? restart ?? null;
}

/**
 * Where the Menu panel's Restart puts the player of `rules`' slot `playerId`: the first declared start region
 * (`menuPanelEngine.restartTargetOf`, M2). Restated here so procgenCore imports no panel; a unit row pins the two
 * equal over the committed presets.
 */
export function restartTargetFor(rules, playerId = '1') {
    return startRegionsOf(rules, String(playerId)).default[0] ?? null;
}

/** Is this route step the built-in RESTART move (never an exit crossing)? */
export function isRestartStep(step) {
    return step?.restart === true;
}

/**
 * Plan the player's route from `from` to `to`, with Restart available when the slot declares it.
 *
 * @param {object} args
 * @param {string} args.from the region the player stands in
 * @param {string} args.to the goal region
 * @param {(a: string, b: string) => ({steps: Array<{region: string, exitUsed: string|null}>, length: number}|null)}
 *   args.findPath the graph's walk planner (`pathFinder.findPathWithExits`, bound)
 * @param {object|null} args.rules the loaded rules.json
 * @param {string} [args.playerId='1']
 * @param {string|null} [args.restartTarget] where Restart puts the player; omitted = `restartTargetFor(rules, p)`
 * @param {Map<string, Array<{region: string, exit: string, landing: string|null}>>|null} [args.avoid] ⛓ WAVE-6
 *   CONSUMER — exits whose crossing LANDED INSIDE A SOLID (an `arrival-inside-solid` refusal), each with the
 *   refusal's other arrivals as AP exits (`seedlingArrivalEscape`). Every walk this route asks for avoids them
 *   (`avoidingFindPath`); omitted = the walks are `findPath`'s, unchanged.
 * @param {(a: string, b: string) => object|null} [args.eventPath] ⛓ OBSTACLE EVENTS — the BREAK-BEFORE-FIRST-USE walk
 *   (`eventRoute.eventPathFinder`): asked only where the graph's walk has none, so a route meets the game-state events it
 *   needs by crossing credit or a goal-first BREAK step — before any Restart. Omitted = the walks are `findPath`'s.
 * @returns {{route: object|null, kind: 'walk'|'restart'|null, why: string|null}}
 *   `why` names the refusal when `route` is null; without the flag it is exactly `no path from <from> to <to>`.
 */
export function planRoute({ from, to, findPath: graphWalk, rules, playerId = '1', restartTarget = restartTargetFor(rules, playerId),
    avoid = null, eventPath = null }) {
    const walkPlanner = typeof eventPath === 'function' && typeof graphWalk === 'function'
        ? (a, b) => usable(graphWalk(a, b)) ?? usable(eventPath(a, b)) : graphWalk;
    const findPath = avoid && avoid.size > 0 && typeof walkPlanner === 'function' ? avoidingFindPath(walkPlanner, avoid) : walkPlanner;
    if (!from || !to || typeof findPath !== 'function') {
        return { route: null, kind: null, why: 'no route asked (a missing region or planner)' };
    }
    const walk = usable(findPath(from, to));
    let restart = null;
    let why = null;
    if (!returnToMenu(rules, playerId)) {
        why = `no path from ${from} to ${to}`;  // ⛔ fail-closed: today's refusal, word for word
    } else if (!restartTarget) {
        why = `no path from ${from} to ${to} (no restart target)`;
    } else if (restartTarget === from) {
        why = `no path from ${from} to ${to} (already at the restart target)`;
    } else {
        restart = restartRoute(from, restartTarget, to, findPath);
        if (!restart) why = `no path from ${from} to ${to}, nor from the restart target ${restartTarget}`;
    }
    const route = preferRoute(walk, restart);
    if (!route) return { route: null, kind: null, why };
    return { route, kind: route === walk ? 'walk' : 'restart', why: null };
}

/** A Restart route: `from` → (RESTART) → `target`, then the graph's walk from `target` to `to`. */
function restartRoute(from, target, to, findPath) {
    const restartStep = { region: target, exitUsed: null, restart: true };
    if (target === to) return { steps: [{ region: from, exitUsed: null }, restartStep], length: 1 };
    const after = usable(findPath(target, to));
    if (!after) return null;
    return {
        steps: [{ region: from, exitUsed: null }, restartStep, ...after.steps.slice(1)],
        length: after.steps.length,
    };
}

/** A walk that reaches somewhere (≥ 2 steps; `from === to` is the caller's case, not a route). */
/**
 * ⛓ WAVE-6 CONSUMER — `findPath`, never crossing an avoided exit. A walk that crosses none is `findPath`'s own. One
 * that does is replaced by the shortest DETOUR through another arrival `d` of that exit's level: the walk to
 * `d.region` (avoiding), the crossing `d.exit`, then the walk on from `d.landing` (avoiding). No detour → null.
 * The detours are the refusal's own `wayOut` (the solver's other arrivals), so no graph search is added here.
 */
export function avoidingFindPath(findPath, avoid) {
    const avoided = (p) => p.steps.some((st) => st.exitUsed && avoid.has(st.exitUsed));
    const clean = (a, b) => {
        if (a === b) return { steps: [{ region: a, exitUsed: null }], length: 0 };
        const p = usable(findPath(a, b));
        return p && !avoided(p) ? p : null;
    };
    return (a, b) => {
        const direct = usable(findPath(a, b));
        if (!direct || !avoided(direct)) return direct;
        let best = null;
        for (const [exit, detours] of avoid) {
            if (!direct.steps.some((st) => st.exitUsed === exit)) continue;
            for (const d of detours ?? []) {
                if (!d?.region || !d.exit || !d.landing || avoid.has(d.exit)) continue;
                const head = clean(a, d.region);
                const tail = head ? clean(d.landing, b) : null;
                if (!tail) continue;
                const steps = [...head.steps, { region: d.landing, exitUsed: d.exit }, ...tail.steps.slice(1)];
                if (!best || steps.length < best.steps.length) best = { steps, length: steps.length - 1 };
            }
        }
        return best;
    };
}

function usable(path) {
    return path && Array.isArray(path.steps) && path.steps.length >= 2 ? path : null;
}
