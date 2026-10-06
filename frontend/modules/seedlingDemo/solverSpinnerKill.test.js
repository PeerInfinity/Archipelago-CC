/**
 * ⛓⛓⛓ SEEDLING SWIM U1, D3 (concept library F2) — THE KILL WITHOUT A LOCK.
 *
 * A lock-less Spinner on the walk used to exhaust the combat ladder with the
 * kill rung's `!target` text: `chooseBodyToRemove` quantified over `chasers`
 * and the static census, and a live spinner is in neither. It is now a
 * removal candidate (`run.entities('spinnerBodies')`), and the kill rung kills
 * it with the kill-lock's own PRESS arm, `lock: null` — the observation is the
 * roster (the body leaves it on `Spinner.removed()`) cross-checked against
 * `run.ledger('spinnerWrites')`.
 *
 * The room is `census-seedling-enemies.mjs`'s own chamber (start (1,1), a 6x6
 * chamber (2,2)..(7,7), a `totempart` goal at (8,8), one untagged spinner),
 * solved through `procgenOracle.solve` exactly as the census solves it.
 */

import { describe, expect, it } from 'vitest';

import { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';
import {
    DEFAULT_BUDGET, GENERATED_BOOT_TIME, VERDICT, bootStaging, collectGoal, solve,
} from './procgenOracle.js';
import { POST_SWORD_ITEMS, PRE_SWORD_ITEMS } from './procgenPalette.js';
import { SEEDLING_DEFAULTS } from './procgenSeedling.js';

const START = { tx: 1, ty: 1 };
const GOAL = { tx: 8, ty: 8 };

/** `census-seedling-enemies.room()` with `--goal=totempart` and one spinner. */
function chamberWithSpinner(tx, ty) {
    let rec = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    const floor = new Set(['1,1', '1,2', '8,8', '8,7']);
    for (let y = 2; y <= 7; y += 1) for (let x = 2; x <= 7; x += 1) floor.add(`${x},${y}`);
    const wall = [];
    for (let y = 1; y <= 8; y += 1) {
        for (let x = 1; x <= 8; x += 1) if (!floor.has(`${x},${y}`)) wall.push({ tx: x, ty: y, terrain: 'wall' });
    }
    rec = withTerrain(rec, wall);
    return withEntities(rec, [
        { type: 'totempart', ...oelAtTile(GOAL.tx, GOAL.ty), attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
        { type: 'spinner', ...oelAtTile(tx, ty), attrs: { tag: '-1' } },
    ]);
}

/** `census-seedling-enemies.corridorRoom('spinner')`: a 1-wide L from (1,1)
 *  along row 1 and down column 8 to the goal, the body standing IN it at (4,1). */
function corridorWithSpinner() {
    let rec = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    const floor = new Set();
    for (let x = 1; x <= 8; x += 1) floor.add(`${x},1`);
    for (let y = 1; y <= 8; y += 1) floor.add(`8,${y}`);
    const wall = [];
    for (let y = 1; y <= 8; y += 1) {
        for (let x = 1; x <= 8; x += 1) if (!floor.has(`${x},${y}`)) wall.push({ tx: x, ty: y, terrain: 'wall' });
    }
    rec = withTerrain(rec, wall);
    return withEntities(rec, [
        { type: 'totempart', ...oelAtTile(GOAL.tx, GOAL.ty), attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
        { type: 'spinner', ...oelAtTile(4, 1), attrs: { tag: '-1' } },
    ]);
}

function solveRoom(rec, items, name) {
    const staging = bootStaging({ boot: bootAtTile(rec, START.tx, START.ty), items,
        pins: ['dead_frames'], time: GENERATED_BOOT_TIME });
    return solve(rec, staging, [collectGoal(GOAL.tx * 16, GOAL.ty * 16)], DEFAULT_BUDGET,
        { name, scratchPersistence: true });
}

function solveAt(tx, ty, items) {
    const rec = chamberWithSpinner(tx, ty);
    const staging = bootStaging({ boot: bootAtTile(rec, START.tx, START.ty), items,
        pins: ['dead_frames'], time: GENERATED_BOOT_TIME });
    return solve(rec, staging, [collectGoal(GOAL.tx * 16, GOAL.ty * 16)], DEFAULT_BUDGET,
        { name: `enemy-census-spinner@${tx},${ty}`, scratchPersistence: true });
}

/**
 * ⛓ SEEDLING SWIM U6 (D3) — every PRESS row below re-timed once more when
 * `stepToward` began scoring the four diagonals beside the facings (the
 * controller's own nine movement sets): (5,5) 245 → 241, (2,2) 252 → 260, (7,6)
 * 213 → 212, (3,6) 166 → 173, (2,7) 266 → 258. Each still kills with three
 * landings and certifies; the CORRIDOR arm (225) and every walk row are
 * byte-identical.
 */
describe('F2 — a lock-less spinner on the walk, post-sword', () => {
    /**
     * ⛓ U4b D1 — 234 → 245 t. The strike schedule now prices each forecast row
     * at the clock its own tick swings under (`gameTimeAt(i)`), so the first
     * strike it plans is a different (cell, tick): the one the old pairing took
     * was clear only against the NEXT tick's hammer.
     */
    // ⛓ LINEFLIP — 241 → 221 t: the hammer's `collideLine` samples untruncated (W1 ON), so the strike plan prices a
    // different (cell, tick) clear against the player's fractional box. Still one press kill, three landings, certified.
    it('(5,5): was EXHAUSTED; now SOLVES in 221 t by a press kill whose end is OBSERVED', () => {
        const out = solveAt(5, 5, POST_SWORD_ITEMS);
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.ticks).toBe(221);
        expect(out.certification?.certified).toBe(true);
        const kills = out.records.filter((r) => r.strategy === 'kill');
        expect(kills).toHaveLength(1);
        expect(kills[0]).toMatchObject({ arm: 'press', target: 'spinner@80,80', ledger: 'spinnerWrites' });
        expect(kills[0].landings).toHaveLength(3);
    });

    /**
     * ⛓ U3 D2 — the schedule sees walls. At U1 the live arm pressed from the
     * start cell as the body wandered into reach across the corner of the
     * mouth's stone, and the run refused the hit (*"tile:Stone at (32, 29.0…)
     * on the line to its entity point"*). The press now asks
     * `run.collideLineSolid` first, and the kill lands from a cell with a
     * line. ⛔ With the predicate forced false (U3 mutant (a)) the U1 text
     * returns byte for byte, and this row reds.
     *
     * ⛓ U6 D2 — 154 → 252 t. With the transit arm priced at its own tick's
     * phase the strike walks a different corridor, and the kill ends with the
     * player ON the dead body's placement tile. The static ingredient priced
     * that tile as *"a static "Enemy" body at its placement"* (the live roster
     * was its only exclusion) and the next gate refused; a spinner the run
     * killed is excluded now too (`dangerMap.spinnersTheRunSteps`).
     */
    it('(2,2): was the run\'s line-of-sight refusal; now SOLVES in 260 t, the swing planned on a clear line', () => {
        const out = solveAt(2, 2, POST_SWORD_ITEMS);
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.ticks).toBe(260);
        expect(out.certification?.certified).toBe(true);
        const kills = out.records.filter((r) => r.strategy === 'kill');
        expect(kills).toHaveLength(1);
        expect(kills[0]).toMatchObject({ arm: 'press', target: 'spinner@32,32' });
        expect(kills[0].landings).toHaveLength(3);
    });

    /**
     * ⛓ U4b D1 — the refusal read *"no reachable cell … for the next 45
     * tick(s) … The room has nowhere to be."*, and the window was not the wall:
     * 39 cells were clear for all 45 ticks. The live arm had pressed at t 63 on
     * a train priced against the NEXT tick's hammer, the run billed the hammer
     * at t 64, and every refuge preview then stalled under the hit's steering
     * loss. Priced at the clock each forecast row swings under
     * (`spinnerClockPairing.test.js`), the kill lands. ⛔ With `clearOfHammersAt`
     * back at `gameTimeAt(i + 1)` the U3 text returns byte for byte.
     */
    it('(7,6): was "nowhere to be"; now SOLVES in 212 t, the train priced at its own tick\'s phase', () => {
        const out = solveAt(7, 6, POST_SWORD_ITEMS);
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.ticks).toBe(212);
        expect(out.certification?.certified).toBe(true);
        const kills = out.records.filter((r) => r.strategy === 'kill');
        expect(kills).toHaveLength(1);
        expect(kills[0]).toMatchObject({ arm: 'press', target: 'spinner@112,96' });
        expect(kills[0].landings).toHaveLength(3);
    });

    /**
     * ⛓ U4b D3 — the bounded pass spent its forty-three opportunities on four
     * cells whose corridors all cross the hammer, and refused *"no (cell, tick)
     * … 43 opportunit(ies)"*. The admission's continuation keeps scanning in
     * tick order with one walk per cell and finds (88,88) at +142 after one more
     * cell. ⛔ With `continuation: false` the D1 text returns byte for byte.
     *
     * ⛓ U6 D1 — 226 → 166 t. The first strike is the same ((88,88) +142,
     * the first landing at t 39); the re-derivation after it now skips
     * (88,56) +67, whose wait was unpriced, and takes (88,72) +70. The second
     * landing comes at 72 instead of 98, and the third at 108 instead of 179.
     */
    it('(3,6): was "no (cell, tick)"; now SOLVES in 173 t on a strike past the bounded pass', () => {
        const out = solveAt(3, 6, POST_SWORD_ITEMS);
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.ticks).toBe(173);
        expect(out.certification?.certified).toBe(true);
        const kills = out.records.filter((r) => r.strategy === 'kill');
        expect(kills).toHaveLength(1);
        expect(kills[0]).toMatchObject({ arm: 'press', target: 'spinner@48,96' });
        expect(kills[0].landings).toHaveLength(3);
    });

    /**
     * ⛓ U6 D1 — the refusal read *"every key set … lands the player box … at
     * (86.53,83.57) … There is no step out."*, and no step-out exists from
     * there: all ten key sets fail on the first tick. The corner was made
     * earlier, by the walk arriving at its strike cell about seven ticks before
     * the train and standing in the billiard's path. `deriveStrike` now prices
     * that dwell (`[eta, i − 2)` at the cell's box). ⛔ With the dwell window
     * empty (U6 mutant (a)) the U4b text returns byte for byte.
     */
    it('(2,7): was "no step out"; now SOLVES in 258 t, the wait before the train priced', () => {
        const out = solveAt(2, 7, POST_SWORD_ITEMS);
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.ticks).toBe(258);
        expect(out.certification?.certified).toBe(true);
        const kills = out.records.filter((r) => r.strategy === 'kill');
        expect(kills).toHaveLength(1);
        expect(kills[0]).toMatchObject({ arm: 'press', target: 'spinner@32,112' });
        expect(kills[0].landings).toHaveLength(3);
    });
});

describe('U4b D3 — the census CORRIDOR arm: a spinner in a 1-wide L', () => {
    /**
     * Every one of the bounded pass's forty-one opportunities was down the far
     * leg, and every walk to one met the billiard at the corner at +89. The
     * continuation finds (120,24) at +399 after four more cells, and the live
     * arm presses as the body comes back into reach.
     */
    it('post-sword: was "no (cell, tick)"; now SOLVES in 225 t by a press kill', () => {
        const out = solveRoom(corridorWithSpinner(), POST_SWORD_ITEMS, 'enemy-census-spinner@corridor');
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.ticks).toBe(225);
        expect(out.certification?.certified).toBe(true);
        const kills = out.records.filter((r) => r.strategy === 'kill');
        expect(kills).toHaveLength(1);
        expect(kills[0]).toMatchObject({ arm: 'press', target: 'spinner@64,16' });
        expect(kills[0].landings).toHaveLength(3);
    });

    it('pre-sword: stays REFUSED, and the kill line is the SUB-ORDER', () => {
        const out = solveRoom(corridorWithSpinner(), PRE_SWORD_ITEMS, 'enemy-census-spinner@corridor');
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).toMatch(/kill: spinner@64,16 is a live Spinner whose removal the run OBSERVES .* The sword is a SUB-ORDER the macro layer owes/);
    });
});

describe('F2 — pre-sword, the kill rung names the missing weapon', () => {
    it('(5,5) stays REFUSED, and the kill line is the SUB-ORDER, not `!target`', () => {
        const out = solveAt(5, 5, PRE_SWORD_ITEMS);
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).toMatch(/the combat ladder is EXHAUSTED/);
        expect(out.reasonText).toMatch(/kill: spinner@80,80 is a live Spinner whose removal the run OBSERVES .* holds NOTHING .* The sword is a SUB-ORDER the macro layer owes/);
        expect(out.reasonText).not.toMatch(/a kill needs a target whose removal the model OBSERVES/);
    });
});
