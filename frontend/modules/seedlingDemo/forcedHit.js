/**
 * seedlingDemo/forcedHit — slice `seedling-fidelity-forcedhit` (wave 13, planner `seedling-fidelity-planning-6`).
 *
 * ⚖ THE USER, 2026-10-11 ("Allow forced hits"): when an exhaustive input search proves that EVERY crossing takes a
 * hit, the solver may plan the least-damage crossing and bill the hit, instead of refusing.
 *
 * This module is the PROOF and the CROSSING; the solver's combat ladder (`solverBot.climbLadderUnder`) asks it only
 * where every rung has refused (the EXHAUSTED verdict), behind `FORCED_HITS` (`CONTACT_FIDELITY.forcedHits`, OFF).
 *
 * ── (a) THE PROOF — a measured fact, not a search that gave up ───────────────────────────────────────────────────
 * From the state the ladder was asked in, every input sequence over `FORCED_HIT_ALPHABET` (the 8 directions + none,
 * each × {nothing, primary, secondary, both}: 36 held sets) is stepped on the run itself — a fork of the segment
 * (`solveSegment`'s `fork`), so the model is the oracle, not a forecast or a danger box. A prefix that bills a
 * `playerHits` row (or a death) is a LEAF; one that does not is extended by one more tick. The proof HOLDS at depth
 * `d` when no hitless prefix of length `d` is left: then no input sequence of any length from this state is hitless
 * (each has a length-`d` prefix, and every one of those is hit). It FAILS, by name, when a hitless prefix survives
 * `depthMax`, or when the node budget runs out first — "the search gave up" is never read as "every crossing is hit".
 * ⚠ What it does not cover, named: an equip (slot change) is not in the alphabet; the proof is from THIS state (an
 * earlier choice might never have stood here).
 *
 * ── (b) THE BUDGET ───────────────────────────────────────────────────────────────────────────────────────────────
 * The proof's leaves give `minHits`, the fewest hits any length-`d` prefix takes (≥ 1). A crossing is admitted only
 * when it bills EXACTLY `minHits` (so it is provably least-damage: no crossing takes fewer), at most
 * `maxHitsPerCrossing`, at most `maxPerSegment` over the segment, no death, and leaves `hits ≤ hitsMax − 1 − margin`.
 * The state the hit leaves — the knockback, the 30-tick i-frame, the shake, the dark-suit retaliation — is the run's
 * own (`levelRun.applyPlayerHit`); the chosen crossing is REPLAYED on the live run key for key, and the live run's
 * new `playerHits` rows must be the fork's, so every later plan of the segment reads the damage it actually carries
 * (`worldHitsOf`). ⚠ `hits` is per world (a door or a death swaps the `Player`), so a crossing that ends in a
 * transition hands the next room a fresh 0; one that ends in the same room carries `hits` to every later goal of
 * the segment, and the segment's result says so (`damage`, an optional field).
 *
 * ── (c) THE VERDICT ──────────────────────────────────────────────────────────────────────────────────────────────
 * A trace row `strategy: {verb: 'forced-hit', rung: 'forced-hit', proof, billed, candidate, ticks}` — distinct from
 * a solved walk with 0 hits — and a `forcedHits` row on the segment's result.
 */
import { BotDriverV2Error, drive } from './botDriverV2.js';
import { CONTACT_FIDELITY } from './solverView.js';

/**
 * The switch and its bounds. `enabled` reads `CONTACT_FIDELITY.forcedHits`, so the page, its solve worker and the
 * divergence sweep's `contact_fidelity=` set it with the rest; `SEEDLING_FORCED_HITS=1` for a node measurement,
 * `withForcedHits` for a test.
 */
export const FORCED_HITS = {
    get enabled() { return CONTACT_FIDELITY.forcedHits === true; },
    /** the deepest proof asked (36 + 36² = 1332 fork steps is the whole depth-2 tree; depth 3 only if it is pruned) */
    depthMax: 3,
    /** fork steps a proof may spend before it gives up (a give-up is NOT a proof) */
    nodeBudget: 2000,
    /**
     * run ticks a proof may advance, the forks' replays included (each fork replays the segment's ticks so far): a
     * proof asked deep in a long segment is refused by its cost rather than spending a minute
     */
    advanceBudget: 600000,
    /** the most hits one crossing may bill */
    maxHitsPerCrossing: 1,
    /** the most hits a segment may bill by forced crossings */
    maxPerSegment: 2,
    /** a crossing must leave `hits ≤ hitsMax − 1 − margin` (never a death, and one hit of slack) */
    margin: 1,
    /** how many proof leaves (fewest hits first) are tried as a crossing's prefix */
    prefixCandidates: 12,
};

/**
 * A read-only instrument (the census's): with `sink` set, the rung hands it one row per asking — `{what, at, proof,
 * outcome: 'billed' | 'not-proven' | 'no-crossing', candidate?, billed?, rejected?, why?}`. Inert while `null`.
 */
export const FORCED_HIT_TRACE = { sink: null };

/** Run `fn` with `CONTACT_FIDELITY.forcedHits` set to `enabled`, restoring the previous value (also on a throw). */
export function withForcedHits(enabled, fn) {
    const before = CONTACT_FIDELITY.forcedHits;
    CONTACT_FIDELITY.forcedHits = enabled === true;
    try {
        return fn();
    } finally {
        CONTACT_FIDELITY.forcedHits = before;
    }
}

const DIRECTION_SETS = [[], ['up'], ['down'], ['left'], ['right'],
    ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right']];
const ACTION_SETS = [[], ['primary'], ['secondary'], ['primary', 'secondary']];
/** The proof's input alphabet: every held set of the 8 directions + none, × primary, × secondary (36). */
export const FORCED_HIT_ALPHABET = Object.freeze(DIRECTION_SETS
    .flatMap((d) => ACTION_SETS.map((a) => Object.freeze([...d, ...a]))));

/**
 * The player's `hits` in the world the run stands in, read off the ledger: the last `playerHits` row's `hits` when it
 * landed after the last world swap (a door's `transitions` row or a death), else 0 — `Player.hits` is per world, so a
 * door or a death starts the next one at 0. `{hits, lastHitAt, id}` (`lastHitAt`/`id` null at 0): the i-frame and
 * the knockback are that row's tick's (`levelRun.applyPlayerHit`).
 */
export function worldHitsOf(run) {
    const last = (run.ledger('playerHits') ?? []).at(-1) ?? null;
    const swapAt = Math.max(run.transitions.at(-1)?.t ?? -1, (run.ledger('playerDeaths') ?? []).at(-1)?.t ?? -1);
    return last !== null && last.t > swapAt ? { hits: last.hits, lastHitAt: last.t, id: last.id }
        : { hits: 0, lastHitAt: null, id: null };
}

const hitsOf = (r) => (r.ledger('playerHits') ?? []).length;
const deathsOf = (r) => (r.ledger('playerDeaths') ?? []).length;
const label = (keys) => keys.map((k) => k.join('+') || '·').join(' ');

/**
 * THE PROOF. `fork()` returns a fresh run standing exactly where the live run stands (or `null` when the caller's
 * deadline tripped). Returns `{proven: true, depth, nodes, leaves, minHits, best}` — `best` the leaves billing
 * `minHits` with no death, fewest-ticks first — or `{proven: false, why, nodes, …}`.
 */
export function proveForcedHit(fork, { depthMax = FORCED_HITS.depthMax, nodeBudget = FORCED_HITS.nodeBudget,
    alphabet = FORCED_HIT_ALPHABET, replayTicks = 0, advanceBudget = FORCED_HITS.advanceBudget } = {}) {
    let frontier = [[]];
    let nodes = 0;
    let advances = 0;
    const leaves = [];
    for (let depth = 1; depth <= depthMax; depth += 1) {
        const next = [];
        // the whole depth or nothing: a depth the budget cannot finish is refused before a node of it is spent
        const cost = frontier.length * alphabet.length;
        if (advances + cost * (replayTicks + depth) > advanceBudget) {
            return { proven: false, nodes, depth, leaves: leaves.length, open: frontier.length,
                hitless: depth > 1 ? label(frontier[0]) : null,
                why: `depth ${depth} needs ${cost} fork(s), each replaying the segment's ${replayTicks} tick(s): `
                    + `${cost * (replayTicks + depth)} run ticks, over the advance budget's ${advanceBudget - advances} `
                    + '— a search that gave up is not a proof' };
        }
        if (nodes + cost > nodeBudget) {
            return { proven: false, nodes, depth, leaves: leaves.length, open: frontier.length,
                hitless: label(frontier[0]),
                why: `${frontier.length} prefix(es) of ${depth - 1} tick(s) are still hitless (first `
                    + `[${label(frontier[0])}]), and depth ${depth} needs ${frontier.length * alphabet.length} more `
                    + `fork step(s) than the budget's ${nodeBudget - nodes} — a search that gave up is not a proof` };
        }
        for (const p of frontier) {
            for (const a of alphabet) {
                const f = fork();
                if (f === null) {
                    return { proven: false, nodes, depth, leaves: leaves.length,
                        why: 'the caller\'s deadline tripped inside the proof\'s fork' };
                }
                nodes += 1;
                advances += replayTicks + depth;
                const h0 = hitsOf(f);
                const d0 = deathsOf(f);
                const keys = [...p, a];
                let firstHit = null;
                let crossed = null;
                for (let i = 0; i < keys.length; i += 1) {
                    let o;
                    try {
                        o = f.advance(new Set(keys[i]));
                    } catch (e) {
                        /**
                         * ⛔ AN INPUT THE MODEL REFUSES TO STEP IS AN INPUT WHOSE ANSWER IS UNKNOWN — e.g. a sword
                         * press on a frozen tick (`levelRun` refuses rather than model it). The proof is over the
                         * WHOLE alphabet, so one unanswered sequence means it does not hold, by name.
                         */
                        return { proven: false, nodes, depth, leaves: leaves.length, unmodelled: label(keys),
                            why: `the model refuses to step [${label(keys)}] (tick ${i + 1}: `
                                + `${String(e?.message ?? e).split('\n')[0].slice(0, 140)}) — an input with no `
                                + 'answer leaves the proof open' };
                    }
                    if (firstHit === null && hitsOf(f) > h0) firstHit = i + 1;
                    if (o.transition) { crossed = o.transition; break; }
                }
                const hits = hitsOf(f) - h0;
                const died = deathsOf(f) - d0;
                if (hits > 0 || died > 0) {
                    leaves.push({ keys, hits, died, firstHit, crossed: crossed ? crossed.to_level : null });
                } else if (crossed) {
                    // a hitless input that leaves the room: it is a crossing, so nothing is forced
                    return { proven: false, nodes, depth, leaves: leaves.length,
                        why: `the hitless input [${label(keys)}] leaves level ${crossed.from_level} for `
                            + `${crossed.to_level} — no hit is forced`, hitless: label(keys) };
                } else next.push(keys);
            }
        }
        if (next.length === 0) {
            const alive = leaves.filter((l) => l.died === 0);
            const minHits = alive.length ? Math.min(...alive.map((l) => l.hits)) : null;
            const best = alive.filter((l) => l.hits === minHits)
                .sort((x, y) => x.keys.length - y.keys.length || x.firstHit - y.firstHit);
            return { proven: true, depth, nodes, advances, leaves: leaves.length, deadly: leaves.length - alive.length,
                minHits, best, alphabet: alphabet.length };
        }
        frontier = next;
    }
    return { proven: false, nodes, depth: depthMax, leaves: leaves.length, open: frontier.length,
        hitless: label(frontier[0]),
        why: `${frontier.length} prefix(es) of ${depthMax} tick(s) are still hitless (first [${label(frontier[0])}]) `
            + '— no hit is proven forced inside the bound' };
}

/**
 * THE CROSSING. Each candidate is played on its own fork: an optional proof-leaf prefix, then the corridor `wps`
 * driven by `botDriverV2.drive` exactly as `walkTo` drives it (the waypoints in order, the last one `until:
 * 'transition'` when the walk crosses). Returns the admitted candidates' best `{keys, billed, ticks, transition,
 * label}` (fewest hits, then fewest ticks), and every rejection named.
 *
 * `strikeFor(run)` builds the walk's strike policy on a fork (`solverBot.strikePolicyFor`), or is null.
 */
export function planForcedCrossing(fork, proof, wps, { crossTo = null, tolerance = 0, maxTicks, contacts,
    axisAligned = false, strikeFor = null, hitsMax, hitsNow, budgetLeft }) {
    const rejected = [];
    const admitted = [];
    const cap = Math.min(FORCED_HITS.maxHitsPerCrossing, budgetLeft, hitsMax - 1 - FORCED_HITS.margin - hitsNow);
    if (proof.minHits === null) return { best: null, rejected: [{ candidate: 'all', why: 'every proof leaf dies' }] };
    if (proof.minHits > cap) {
        return { best: null, rejected: [{ candidate: 'all',
            why: `the least-damage crossing takes ${proof.minHits} hit(s), over the budget's ${cap} (hits now `
                + `${hitsNow}, hitsMax ${hitsMax}, margin ${FORCED_HITS.margin}, ${budgetLeft} left this segment)` }] };
    }
    const tries = [
        { label: 'corridor', prefix: [], armed: true },
        { label: 'corridor-unarmed', prefix: [], armed: false },
        ...proof.best.slice(0, FORCED_HITS.prefixCandidates)
            .map((l) => ({ label: `prefix [${label(l.keys)}] + corridor`, prefix: l.keys, armed: false })),
    ];
    for (const c of tries) {
        const f = fork();
        if (f === null) { rejected.push({ candidate: c.label, why: 'the caller\'s deadline tripped' }); break; }
        const h0 = hitsOf(f);
        const d0 = deathsOf(f);
        const keys = [];
        let transition = null;
        try {
            for (const k of c.prefix) {
                const held = new Set(k);
                keys.push(held);
                const o = f.advance(held);
                if (o.transition) { transition = o.transition; break; }
            }
            if (transition === null) {
                const strike = c.armed && strikeFor ? strikeFor(f) : null;
                for (let wi = 0; wi < wps.length; wi += 1) {
                    const last = wi === wps.length - 1;
                    const t = drive(f, wps[wi], keys, {
                        until: (last && crossTo) ? 'transition' : 'arrival', tolerance, maxTicks,
                        avoidVolumes: true, contacts, crossTo, grazes: [], strike, axisAligned,
                        what: `forced-hit candidate ${c.label} waypoint ${wi} (${wps[wi].x},${wps[wi].y})`,
                    });
                    if (t && crossTo) { transition = t; break; }
                }
            }
        } catch (e) {
            // a walk the driver refutes, or an input the model refuses to step (named as such): a rejected candidate
            rejected.push({ candidate: c.label, why: `${e instanceof BotDriverV2Error ? '' : 'the model refused: '}`
                + String(e?.message ?? e).split('\n')[0].slice(0, 200) });
            continue;
        }
        const billed = (f.ledger('playerHits') ?? []).slice(h0).map((h) => ({ t: h.t, level: h.level,
            source: h.source, id: h.id, hits: h.hits }));
        const why = deathsOf(f) > d0 ? 'the crossing dies'
            : (crossTo && (!transition || transition.to_level !== crossTo.level))
                ? `the crossing did not reach level ${crossTo.level}`
                : (billed.length !== proof.minHits)
                    ? `the crossing bills ${billed.length} hit(s), not the proven least ${proof.minHits}`
                    : null;
        if (why) { rejected.push({ candidate: c.label, why }); continue; }
        admitted.push({ label: c.label, keys, billed, ticks: keys.length, transition });
    }
    admitted.sort((x, y) => x.billed.length - y.billed.length || x.ticks - y.ticks);
    return { best: admitted[0] ?? null, admitted: admitted.length, rejected };
}
