/**
 * pressGlideFollow — ⛓⛓⛓ SEEDLING HAMMER-PHASE ENTRY-38 STEP 2: A PUSH CHAIN'S GLIDE WAIT LEANS TOWARD THE NEXT STANCE
 * (`PRESS_GLIDE_FOLLOW`, OFF).
 *
 * ⚖ The user approved the slice on 2026-11-27 (*"Measure-first slice (Recommended)"*): past the entry-38 shove
 * (`SPEAR_PRESS_GATE_WAIT`), under the folded stack (ALL+WBA) the L63 → L61 exit refuses at route step 2/4 of its spear
 * route, and given budget it ships a plan with one model hit (`chaser:jellyfish@192,56`, tick 459), taken while route
 * step 2 IDLES out the block's glide at its stance.
 *
 * MEASURED (`CC/docs/cloud-reports/seedling-hammer-entry38-step2.md` §3): `execSpearPress` presses, then idles until
 * the block settles (32 ticks of glide per tile), and only then does `execRoute` walk to the next step's stance. The
 * trailing chaser closes on the idle player during that wait. A player that follows the gliding block toward the
 * next stance as soon as the thrust has landed is out of the chaser's reach (it stalls short of the next stance), and
 * the route is shorter.
 *
 * ON: when route step `i` is a `press` that does not sink its block, and step `i + 1` is a `press` in the SAME
 * direction from a stance (a push chain: the block glides away, toward the side the next stance faces from), the glide
 * wait of step `i` LEANS: once the thrust has landed (the block has left its rect, or is gone) and the run's press
 * gates (`spearPressGates`: `wanding`, `firing`, `spearing`, `slashing`) are down, each glide-wait tick holds the push
 * direction's key instead of idling, while the player is still short of the next stance along the push axis; from the
 * tick it is not, the wait idles as before. The glide wait keeps its settle check and its bound, `execRoute` asserts
 * the same post-condition, and step `i + 1` still walks to its stance with the route's own `walkTo` (now a short walk,
 * or none). The walk planner cannot be asked mid-glide (MEASURED: the gliding block still covers the next stance's
 * tile until it settles, so the stance walk refuses `STANCE_REENTRY`); the lean is a run tick like the idle one it
 * replaces, and the run bills its hits like any other. Nothing here certifies a tick hitless.
 *
 * ⛓ THE THREAD: read inside `execRoute` / `execSpearPress` (solverBot, the `press` route step), i.e. the page's SOLVE
 * WORKER and node; no main-thread mapper reads it, so the worker's env channel
 * (`?seedlingSolverEnv=SEEDLING_PRESS_GLIDE_FOLLOW=1`) is the whole page wiring. `withPressGlideFollow(enabled, fn)`
 * for a row or a witness. OFF nothing here is read.
 *
 * ⚖ No single-game constant: the rule reads the route's own steps, the block's live rect and the run's gates.
 */
import { spearPressGates } from './spearPressGateWait.js';

export const PRESS_GLIDE_FOLLOW = {
    enabled: globalThis.process?.env?.SEEDLING_PRESS_GLIDE_FOLLOW === '1',
};
export const PRESS_GLIDE_FOLLOW_DEFAULT = false;

/**
 * The instrument (ON only): `asked` the press steps the rule was asked about, `eligible` those with a next stance to
 * lean toward, `followed` the last 64 glide waits that leaned (`{t, step, next, leaned}`: the run tick of the first
 * lean, the route step pressed, the step whose stance it leaned toward, the ticks leaned), `declined` the last 64 the
 * fork refused (`{t, step, next, why}`). Nothing reads it but rows and probes.
 */
export const PRESS_GLIDE_FOLLOW_COUNTS = { asked: 0, eligible: 0, followed: [], declined: [] };

export function resetPressGlideFollowCounts() {
    PRESS_GLIDE_FOLLOW_COUNTS.asked = 0;
    PRESS_GLIDE_FOLLOW_COUNTS.eligible = 0;
    PRESS_GLIDE_FOLLOW_COUNTS.followed.length = 0;
    PRESS_GLIDE_FOLLOW_COUNTS.declined.length = 0;
}

/** Run `fn` with `PRESS_GLIDE_FOLLOW` set to `enabled`, restoring the previous value (`withSpearPressGateWait`'s shape). */
export function withPressGlideFollow(enabled, fn) {
    const was = PRESS_GLIDE_FOLLOW.enabled;
    PRESS_GLIDE_FOLLOW.enabled = enabled === true;
    const restore = () => { PRESS_GLIDE_FOLLOW.enabled = was; };
    try {
        const out = fn();
        if (out && typeof out.then === 'function') return out.finally(restore);
        restore();
        return out;
    } catch (e) {
        restore();
        throw e;
    }
}

/**
 * The step whose stance route step `i`'s glide wait may lean toward (pure), or null: step `i` is a `press` that does not
 * sink, and step `i + 1` is a `press` in the same `dir` with a `stance`.
 */
export function glideFollowNext(route, i) {
    const step = route?.[i];
    const next = route?.[i + 1];
    if (!step || !next || step.verb !== 'press' || step.destroys) return null;
    if (next.verb !== 'press' || next.dir !== step.dir || !next.stance) return null;
    return next;
}

/**
 * Has the thrust landed and may the lean start (pure)? `rect0` is the block's rect before the press, `live` its live
 * row now, `slashInfo` the run's `slashInfo`. The block must have left `rect0` (or be gone), and no press gate be up.
 */
export function glideFollowReady({ rect0, live, slashInfo }) {
    const moved = !live || live.removed || live.rect.x !== rect0.x || live.rect.y !== rect0.y;
    return moved && spearPressGates(slashInfo).length === 0;
}

/**
 * How far the player is still short of `stance` along the push axis `dir` (`E`/`W`/`N`/`S`) from `(x, y)` (pure):
 * positive while a step in `dir` brings it closer, zero or below once it is level with the stance or past it.
 */
export function shortOfStance(dir, { x, y }, stance) {
    if (dir === 'W') return x - stance.x;
    if (dir === 'E') return stance.x - x;
    if (dir === 'N') return y - stance.y;
    if (dir === 'S') return stance.y - y;
    return 0;
}

/**
 * Is `blockId` at rest on tile `to` in run `r` (pure over the run's reads)? The press verb's own settle test: the
 * run's `pushesSettled` and the block's tile (`tileSize` is the caller's, so no game constant is read here).
 */
export function blockSettledOn(r, blockId, to, tileSize) {
    const l = r.entities('pushables').get(blockId);
    if (!l || l.removed || !r.entities('pushesSettled')) return false;
    return Math.floor(l.rect.x / tileSize) === to.tx && Math.floor(l.rect.y / tileSize) === to.ty;
}

/**
 * The lean, played on a FORK of the run (pure over the fork): from the fork's tick, each tick holds `key` while the
 * player is short of `next.stance` along `next.dir`, else nothing, until `settled(fork)` or `left` ticks. Returns
 * `{keys}` (up to the last lean tick: the verb idles after it, as it would have) or `{why}`: no fork, a level crossed,
 * a death or a hit the lean took (in that order), no settle, or no lean tick at all.
 */
export function leanOnFork({ fork, next, key, left, settled }) {
    const f = fork?.() ?? null;
    if (!f) return { why: 'no fork (none, or the fork deadline tripped)' };
    const hits0 = (f.ledger('playerHits') ?? []).length;
    const deaths0 = (f.ledger('playerDeaths') ?? []).length;
    const keys = [];
    let lastLean = -1;
    for (let n = 0; n < left && !settled(f); n += 1) {
        const lean = shortOfStance(next.dir, f.state, next.stance) > 0;
        keys.push(lean ? [key] : []);
        if (lean) lastLean = n;
        if (f.advance(new Set(keys[n])).transition) return { why: 'the lean crosses a door on the fork' };
    }
    if ((f.ledger('playerDeaths') ?? []).length > deaths0) return { why: 'the lean dies on the fork' };
    const hits = (f.ledger('playerHits') ?? []).slice(hits0);
    if (hits.length) {
        return { why: `the lean takes ${hits.length} hit(s) on the fork (first ${hits[0].source}:${hits[0].id} at t${hits[0].t})` };
    }
    if (!settled(f)) return { why: `the block does not settle on the fork within ${left} tick(s) of leaning` };
    if (lastLean < 0) return { why: 'the player is already level with the next stance' };
    return { keys: keys.slice(0, lastLean + 1) };
}

/**
 * The glide-wait hook `execRoute` hands `execSpearPress` for route step `i` (ON only; the caller asks only with the
 * switch on), or null when the step is not eligible. `rect` is the block's rect now (at rest, before the press; copied
 * here, since a live row moves). The hook's `keys({live, slashInfo, t, fork, key, left, settled})` is the glide-wait
 * tick's keys: on the first tick the thrust has landed and the gates are down, the lean is played on a fork
 * (`leanOnFork`) and, when the fork admits it, its keys are handed out one tick at a time; otherwise (and after them)
 * null, and the verb idles as it did.
 */
export function pressGlideFollowHook({ route, i, rect }) {
    PRESS_GLIDE_FOLLOW_COUNTS.asked += 1;
    const next = glideFollowNext(route, i);
    if (!next) return null;
    PRESS_GLIDE_FOLLOW_COUNTS.eligible += 1;
    const rect0 = { x: rect?.x, y: rect?.y };
    let plan;
    return {
        keys: ({ live, slashInfo, t, fork, key, left, settled }) => {
            if (plan === undefined) {
                if (!glideFollowReady({ rect0, live, slashInfo })) return null;
                const got = leanOnFork({ fork, next, key, left, settled });
                const row = { t, step: i + 1, next: i + 2, ...(got.keys ? { leaned: got.keys.length } : { why: got.why }) };
                (got.keys ? PRESS_GLIDE_FOLLOW_COUNTS.followed : PRESS_GLIDE_FOLLOW_COUNTS.declined).push(row);
                for (const k of ['followed', 'declined']) {
                    if (PRESS_GLIDE_FOLLOW_COUNTS[k].length > 64) PRESS_GLIDE_FOLLOW_COUNTS[k].shift();
                }
                plan = got.keys ?? null;
            }
            return plan?.shift() ?? null;
        },
    };
}
