/**
 * seedlingDemo/arrowLaneCrossing — slice `seedling-fidelity-arrowlane` (wave 18, planner `seedling-fidelity-planning-8`).
 *
 * ⚖ THE USER, 2026-10-16: *"arrows aren't supposed to be dodgeable."* So this is NOT a dodge, a volley-gap or a timing
 * policy. An ARMED trap's lane is crossed the way the game crosses it: the walk takes the arrows that reach it, and
 * the hits are BILLED (forced-hits' billing, `forcedHit.js`), certified by the run's own arrow stepping.
 *
 * ── WHAT THE SOURCE SAYS ─────────────────────────────────────────────────────────────────────────────────────────
 *     ArrowTrap.as:31-62   while armed (`activate XOR shootDefault`): three `Arrow`s at (x−4, x, x+4), v = (0, 5),
 *                          every 11 updates (`shootTimerMax` 10 + the firing update)
 *     Arrow.as:42-58       `hitables` Player, Enemy, Tree, Solid, Shield; a Player takes `hit(null, 5, (x, y))`
 *                          (1 damage), and ANY hit stops the arrow (the removal is outside the switch)
 * The model already steps every trap and every arrow (`levelRun.stepArrowTrapsNow`, cover included) and bills the
 * player arm (`applyArrowHit` → `applyPlayerHit({source: 'arrow'})`). What it did not have is a PLANNER that can cross
 * a lane: `dangerMap.arrowDanger` prices an ARMED lane at horizon 0, every horizon, to the level's floor, so a walk
 * that STARTS in a lane (L16's arrival from L17, (120,56)) is refused by the walk's gate, and one whose AIM is in a lane
 * (L16's `stairsdown@112,64`) is refused by AVOID's A* ("the goal tile is not walkable"), before any rung runs.
 *
 * ── THE ARM (behind `CONTACT_FIDELITY.arrowLaneCrossing`, ⛔ OFF: byte-identical) ──────────────────────────────────
 * 1. ENGAGED ONLY WHERE THE CROSSING IS FORCED BY GEOMETRY (`laneCrossingFor`), never as a shortcut through a room a
 *    lane-free corridor crosses, and never AHEAD of a rung that crosses without a hit:
 *    - the player's box is in an armed lane NOW (`start`): engaged by the walk itself, before its gate (OFF, the gate
 *      refuses there before any rung runs, so nothing is pre-empted);
 *    - otherwise only as the ladder's LAST rung (`arrow-lane`, after PULL — the rope that silences L16's lanes with a
 *      sword, which a sworded walk takes with no hit — and after FORCED-HIT), when the aim's box is in an armed lane
 *      (`aim`) or an
 *    A* with every armed lane forbidden plans no corridor from here to the aim where the same A* without them does
 *    (`separated`). A lane-free corridor,
 *    where one exists, is still the walk's (the lanes stay priced, as before).
 * 2. ENGAGED, the lanes AND the arrows of their traps leave the walk's danger questions (`laneCrossingExcept`: the
 *    gate, the corridor probe, every rung's certification, AVOID's volumes) — they are priced by step 3 instead.
 *    Every other reason the map gives stays priced; a body the corridor meets climbs the ladder as before.
 * 3. THE CERTIFICATE (`solverBot.walkToUnder`): the corridor the walk will drive is driven first on a FORK of the
 *    segment (the run itself is the oracle: its traps, its arrows, its cover, its knockback). Admitted only when every
 *    `playerHits` row the fork bills is an ARROW of an engaged trap, nothing dies, and the hits fit the forced-hit
 *    budget (`FORCED_HITS`: per crossing, per segment, `hitsMax − 1 − margin`). The live drive must then bill the
 *    fork's rows, key for key (else the fork is not this run, and the solve fails loudly), and the segment's
 *    `forcedHits` carries one row `{candidate: 'arrow-lane', proof: {lane: …}}` — so `unbilledDamageOf` reads the
 *    hits as billed and `damage` carries them to the next goal.
 *
 * ⛔ No dodge: the corridor is the walk's own (no search for a hitless timing, no volley-gap wait). ⛔ No dash through
 * a lane: an engaged walk is driven undashed (`planSwordDash` is not asked), so the certificate and the drive are the
 * same walk by construction.
 */
import { CONTACT_FIDELITY, arrowLaneForPlacement, arrowLaneRect, rectsOverlap } from './solverView.js';

/** The switch, read off `CONTACT_FIDELITY.arrowLaneCrossing` (`SEEDLING_ARROW_LANE_CROSSING=0|1` for a node run). */
export const ARROW_LANE_CROSSING = {
    get enabled() { return CONTACT_FIDELITY.arrowLaneCrossing === true; },
};

/**
 * A read-only instrument (the census's): with `sink` set, the walk hands it one row per engaged walk —
 * `{what, at, why, ids, outcome: 'billed' | 'clean' | 'refused', billed?, why?}`. Inert while `null`.
 */
export const ARROW_LANE_TRACE = { sink: null };

/** Run `fn` with `CONTACT_FIDELITY.arrowLaneCrossing` set to `enabled`, restoring it (also on a throw). */
export function withArrowLaneCrossing(enabled, fn) {
    const before = CONTACT_FIDELITY.arrowLaneCrossing;
    CONTACT_FIDELITY.arrowLaneCrossing = enabled === true;
    try {
        return fn();
    } finally {
        CONTACT_FIDELITY.arrowLaneCrossing = before;
    }
}

/**
 * The ARMED lanes of the run's current level, as the danger map prices them (`arrowLaneRect` to the level's floor):
 * `[{id, rect}]`. Empty under `noclip` (`armedArrowTraps` null) and in a room with no armed trap.
 */
export function armedLanesOf(run) {
    const armed = run.entities('armedArrowTraps');
    if (!armed || armed.size === 0) return [];
    const world = run.worldFor(run.level);
    return (world.arrowTraps ?? []).filter((t) => armed.has(t.id))
        .map((t) => ({ id: t.id, rect: arrowLaneRect(arrowLaneForPlacement(t), world.world.height) }));
}

/**
 * IS THE CROSSING FORCED? `{ids, why, lanes}` or `null`. `boxAt(x, y)` is the player's box (`playerBoxAt`);
 * `separates(volumes)` is true when the walk's own planner (`planWaypoints`) plans a corridor to the aim WITHOUT the
 * volumes and plans none WITH them forbidden — asked only when neither end is in a lane. ⚠ A corridor the planner
 * cannot plan either way is not a separation (an obstacle the walk's frontier clears is in the way, not a lane).
 */
export function laneCrossingFor(run, aim, { boxAt, separates, startOnly = false }) {
    const lanes = armedLanesOf(run);
    if (lanes.length === 0) return null;
    const ids = lanes.map((l) => l.id);
    const inLane = (box) => lanes.filter((l) => rectsOverlap(box, l.rect)).map((l) => l.id);
    const start = inLane(boxAt(run.state.x, run.state.y));
    if (start.length > 0) return { ids, why: 'start', lanes: start };
    if (startOnly) return null;
    const end = inLane(boxAt(aim.x, aim.y));
    if (end.length > 0) return { ids, why: 'aim', lanes: end };
    const vols = lanes.map((l) => ({ level: run.level, kind: 'danger', id: l.id, rect: l.rect,
        why: 'an ARMED trap\'s lane' }));
    if (!separates(vols)) return null;
    return { ids, why: 'separated', lanes: ids };
}

/**
 * The walk's danger exclusion with the engaged lanes added: a `Set` whose `has` also answers for every ARROW of those
 * traps (an arrow's id is `<trap id>#<volley>.<i>`, `arrowTrap.arrowVolley`), so the gate, the probe and AVOID's
 * volume filter set aside the lane AND its arrows by one membership test. `base` (the walk's own exclusion) is kept.
 */
export class LaneCrossingExcept extends Set {
    constructor(base, laneIds) {
        super([...(base ?? []), ...laneIds]);
        this.laneIds = Object.freeze([...laneIds]);
    }

    has(id) {
        if (super.has(id)) return true;
        if (typeof id !== 'string') return false;
        const hash = id.indexOf('#');
        return hash > 0 && this.laneIds.includes(id.slice(0, hash));
    }
}

export function laneCrossingExcept(base, laneIds) {
    return new LaneCrossingExcept(base, laneIds);
}

/** Is a `playerHits` row an arrow of one of `laneIds`' traps? */
export function isLaneArrowHit(row, laneIds) {
    if (row?.source !== 'arrow' || typeof row.id !== 'string') return false;
    const hash = row.id.indexOf('#');
    return hash > 0 && laneIds.includes(row.id.slice(0, hash));
}

/**
 * THE ADMISSION. `billed` are the fork's new `playerHits` rows, `died` its new deaths. `{ok: true}` or
 * `{ok: false, why}`. The budget is the forced-hit rung's (`FORCED_HITS`): `maxHitsPerCrossing`, `budgetLeft` of the
 * segment's `maxPerSegment`, and `hitsMax − 1 − margin − hitsNow`.
 */
export function admitLaneCrossing({ billed, died, laneIds, hitsMax, hitsNow, budgetLeft, maxHitsPerCrossing, margin }) {
    if (died > 0) return { ok: false, why: 'the crossing dies on the fork' };
    const other = billed.filter((h) => !isLaneArrowHit(h, laneIds));
    if (other.length > 0) {
        return { ok: false, why: `the fork bills ${other.length} hit(s) that are not an engaged lane's arrow `
            + `(${other.map((h) => `t${h.t} ${h.source}:${h.id}`).join(', ')}) — the corridor's probe certified them away, `
            + 'so the probe and the drive disagree' };
    }
    const cap = Math.min(maxHitsPerCrossing, budgetLeft, hitsMax - 1 - margin - hitsNow);
    if (billed.length > cap) {
        return { ok: false, why: `the crossing takes ${billed.length} arrow hit(s), over the budget's ${cap} (hits now `
            + `${hitsNow}, hitsMax ${hitsMax}, margin ${margin}, ${budgetLeft} left this segment, `
            + `${maxHitsPerCrossing} per crossing)` };
    }
    return { ok: true };
}
