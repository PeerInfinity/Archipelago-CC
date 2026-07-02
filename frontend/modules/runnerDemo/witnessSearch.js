/**
 * TEST-ONLY witness oracle (plan §4.3) — the runner's analog of
 * bounce's `exhaustivePhases` role: a forward search over REAL
 * simulated states with per-tick input branching and quantized-key
 * dedup. Never used in production; the slow corpus test measures the
 * canRun policy family's conservatism gap against it.
 *
 * Soundness: every claim is a real trajectory. The search only ever
 * advances exact engine states through `step` (the same law as the
 * solver: no physics of its own); quantization gates INSERTION into
 * the visited set, it never fabricates states. So `platforms`,
 * `pickups`, and `portals` are all witnessed by a real input tape
 * (reconstructable via `opts.witnesses`).
 *
 * Completeness: best-effort only — dedup can merge distinct states
 * whose futures differ (tighten `opts.quantum` to trade time for
 * coverage), and `opts.budget` caps expansions (`exhausted: true`
 * means the frontier drained first, i.e. complete up to
 * quantization). That direction is fine for the corpus test: the
 * oracle only has to be MORE complete than the finite policy family,
 * and the test asserts solver ⊆ oracle, never the reverse.
 *
 * The input alphabet is per-tick held-state; jump branches only at
 * DECISION POINTS — ticks where a press or release can change the
 * physics: while holding (release timing = variable jump height),
 * while grounded / inside the coyote window (a press can launch), or
 * with an air jump in hand. Anywhere else a press is inert or
 * dominated by pressing at the next decision point, so skipping it
 * costs only redundant tapes (a completeness heuristic — soundness is
 * untouched; without it the aerial state fan-out drowns the budget
 * before the search progresses rightward at all). Drop branches only
 * when the level has one-way platforms. Reset is excluded — death
 * already respawns, and reset trajectories reach nothing more.
 */

import { DEFAULTS, step as physicsStep, spawnState } from './physics.js';

const DEFAULT_QUANTUM = { x: 0.1, y: 0.1, vx: 0.25, vy: 0.5 };

function keyOf(s, q, dt) {
    return `${Math.round(s.x / q.x)}|${Math.round(s.y / q.y)}`
        + `|${Math.round(s.vx / q.vx)}|${Math.round(s.vy / q.vy)}`
        + `|${s.pressingJump ? 1 : 0}${s.currentlyJumping ? 1 : 0}`
        + `${s.canJumpAgain ? 1 : 0}${s.onGround ? 1 : 0}${s.desiredJump ? 1 : 0}`
        + `|${Math.round(s.coyoteTimeCounter / dt)}`
        + `|${Math.round(s.jumpBufferCounter / dt)}`
        + `|${s.hits}`;
}

/**
 * Search the level under one ability set. Returns
 * `{ platforms, pickups, portals, expanded, exhausted, witnessFor }`
 * — `platforms` is every support the player can stand on (goal-wake
 * host reachability), `witnessFor(platformId)` an input tape (array
 * of per-tick held-state inputs) ending on that support, available
 * when `opts.witnesses` is true.
 */
export function witnessSearch(level, abilities, opts = {}) {
    const C = opts.constants ?? DEFAULTS;
    const budget = opts.budget ?? 2_000_000; // every fixture × ability
    //                          set exhausts under ~1.4M (probe-measured)
    const q = opts.quantum ?? DEFAULT_QUANTUM;
    const dt = 1 / C.TICK_HZ;
    const trackWitnesses = opts.witnesses ?? false;

    const hasOneWay = level.platforms.some((p) => p.type !== 'ground');
    const inputsFor = (s) => {
        // jump is a decision only when pressing (release timing), able
        // to launch (ground / coyote-or-buffer window), or holding an
        // air jump; otherwise a press is inert or dominated by a
        // press at the next decision point (see header)
        const jumpMatters = s.pressingJump || s.onGround || s.canJumpAgain
            || (!s.currentlyJumping && s.coyoteTimeCounter < C.coyoteTime);
        const base = jumpMatters ? [{}, { jump: true }] : [{}];
        if (!hasOneWay) return base;
        return [...base, ...base.map((i) => ({ ...i, drop: true }))];
    };

    const platforms = new Set();
    const pickups = new Set();
    const portals = new Set();
    // parent links for tape reconstruction: key → { parentKey, input }
    const parents = trackWitnesses ? new Map() : null;
    const firstSupportKey = trackWitnesses ? new Map() : null;

    const start = spawnState(level, C);
    const startKey = keyOf(start, q, dt);
    const visited = new Set([startKey]);
    const frontier = [{ state: start, key: startKey }];
    let expanded = 0;

    const record = (s, key) => {
        if (s.standingOn) {
            if (!platforms.has(s.standingOn)) {
                platforms.add(s.standingOn);
                firstSupportKey?.set(s.standingOn, key);
            }
        }
        for (const id of s.touchedPickups) pickups.add(id);
        for (const id of s.touchedPortals) portals.add(id);
    };
    record(start, startKey);

    while (frontier.length > 0 && expanded < budget) {
        const { state, key } = frontier.shift();
        expanded += 1;
        for (const input of inputsFor(state)) {
            const next = physicsStep(state, input, level, abilities, C);
            const nextKey = keyOf(next, q, dt);
            if (visited.has(nextKey)) continue;
            visited.add(nextKey);
            parents?.set(nextKey, { parentKey: key, input });
            record(next, nextKey);
            frontier.push({ state: next, key: nextKey });
        }
    }

    return {
        platforms,
        pickups,
        portals,
        expanded,
        exhausted: frontier.length === 0,
        witnessFor(platformId) {
            if (!parents) throw new Error('witnessSearch: pass opts.witnesses to record tapes');
            let k = firstSupportKey.get(platformId);
            if (k === undefined) return null;
            const tape = [];
            while (k !== startKey) {
                const link = parents.get(k);
                tape.push(link.input);
                k = link.parentKey;
            }
            return tape.reverse();
        },
    };
}
