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

function solveAt(tx, ty, items) {
    const rec = chamberWithSpinner(tx, ty);
    const staging = bootStaging({ boot: bootAtTile(rec, START.tx, START.ty), items,
        pins: ['dead_frames'], time: GENERATED_BOOT_TIME });
    return solve(rec, staging, [collectGoal(GOAL.tx * 16, GOAL.ty * 16)], DEFAULT_BUDGET,
        { name: `enemy-census-spinner@${tx},${ty}`, scratchPersistence: true });
}

describe('F2 — a lock-less spinner on the walk, post-sword', () => {
    it('(5,5): was EXHAUSTED; now SOLVES in 234 t by a press kill whose end is OBSERVED', () => {
        const out = solveAt(5, 5, POST_SWORD_ITEMS);
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.ticks).toBe(234);
        expect(out.certification?.certified).toBe(true);
        const kills = out.records.filter((r) => r.strategy === 'kill');
        expect(kills).toHaveLength(1);
        expect(kills[0]).toMatchObject({ arm: 'press', target: 'spinner@80,80', ledger: 'spinnerWrites' });
        expect(kills[0].landings).toHaveLength(3);
    });

    it('(2,2): the press arm swings through stone — REFUSED by the ladder, naming the run\'s line-of-sight refusal (not a crash)', () => {
        const out = solveAt(2, 2, POST_SWORD_ITEMS);
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).toMatch(/the combat ladder is EXHAUSTED/);
        expect(out.reasonText).toMatch(/kill: spinner@32,32 is a live Spinner and the press arm's schedule swung through a Solid/);
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
