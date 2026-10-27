/**
 * ⛓⛓⛓ SEEDLING FIDELITY L100 (wave 33) — THE ROCK DOOR'S SWING STANCE IS HALF A TILE OFF THE GRID (`fineSwingStance`).
 *
 * L100's `breakablerock@128,144` is the one door through the wall column x 128-143 (route survey step 219, divergence
 * leg 907). Its near side is the 8 px sliver x 120-127 between the `CliffSideMaskL` column at x 112 (opaque x 0-7) and
 * the rock. Every 16 px ring cell on that side is a centre x 120 whose 4x5 box meets the mask, so the break stance
 * refused. ON, `deriveSwingStance` asks the same pixel window on the 8 px lattice once every 16 px cell has failed.
 *
 * Game witness: `l100-sliver-rock` (p4g, `plan-seedling-l100-witness.mjs`) — the step-219 staging booted inside the
 * sliver at (124,60): down x 124 beside the CliffSide masks, the swing from (124,140), the door, L101; 0 hits, the
 * model equal to the game over 186 observations. Ships OFF (`contactFidelity.test.js` pins the defaults).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { withContactFidelity } from './contactFidelity.js';
import { solveSegment } from './solverBot.js';
import { DEFAULT_DASH_MODE } from '../../../scripts/procgen/dashMode.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));

/** A committed tape's staging, its inputs and the plan's equips dropped (the survey staged none). */
const stagingOf = (t, boot = null) => {
    const s = solveStaging(stagingFromTape({ ...t, inputs: [], tick_count: 0 }));
    s.equips = [];
    if (boot) s.boot = { ...boot };
    return s;
};

const SLIVER = tape('l100-sliver-rock');
// The survey's own step-219 arrival (the staged block's top-left; the player stands at (40,104)).
const ARRIVAL = Object.freeze({ level: 100, x: 32, y: 96 });
const GOAL = Object.freeze({ kind: 'reach-exit', exit: { x: 288, y: 96 } });
const ROCK = 'breakablerock@128,144';
const solve = (on, staging = stagingOf(SLIVER)) => withContactFidelity({ fineSwingStance: on }, () => {
    const run = createRunForStaging(staging, SRC);
    return solveSegment({ run, goals: [GOAL], name: 'l100', boot: staging.boot, dashMode: DEFAULT_DASH_MODE });
});
const refusalOf = (fn) => {
    try {
        fn();
    } catch (e) {
        return e.message;
    }
    return null;
};
const STANCE_REFUSAL = /no REACHABLE stance for a swing at breakablerock@128,144 in level 100 — 2 cell\(s\) put the slash rect on the rock/;

describe('L100 — the rock door\'s swing stance on the 8 px lattice (fineSwingStance)', () => {
    it('OFF: from inside the sliver the break stance refuses — its only rect cells are the far side\'s', () => {
        expect(refusalOf(() => solve(false))).toMatch(STANCE_REFUSAL);
    }, 60_000);

    it('ON: the solver\'s plan from the sliver IS the committed game witness, and breaks the rock from x 124', () => {
        const out = solve(true);
        expect(out.perTick.length).toBe(SLIVER.tick_count);
        const run = createRunForStaging(stagingOf(SLIVER), SRC);
        let brokeFrom = null;
        for (const held of out.perTick) {
            run.advance(held);
            if (brokeFrom === null && run.entities('brokenRocks')?.has(ROCK)) brokeFrom = { x: run.state.x, y: run.state.y };
        }
        expect(run.level).toBe(101);
        expect(run.playerHits).toHaveLength(0);
        // The 8 px node centre x 124 — the 16 px centres x 120 (mask) and x 136 (rock) are no stance.
        expect(brokeFrom.x).toBe(124);
        // and the walk is the committed one, key for key
        const want = [];
        for (let t = 0; t < SLIVER.tick_count; t += 1) want.push([...(SLIVER.inputs ?? [])
            .filter((i) => i.from <= t && t < i.to).map((i) => i.key)].sort().join('+'));
        expect(out.perTick.map((k) => [...k].sort().join('+'))).toEqual(want);
    }, 60_000);

    it('ON from the survey\'s own arrival: the stance no longer refuses (the leg goes on to the jellyfish crossing)', () => {
        const off = refusalOf(() => solve(false, stagingOf(SLIVER, ARRIVAL)));
        expect(off).toMatch(STANCE_REFUSAL);
        const on = refusalOf(() => solve(true, stagingOf(SLIVER, ARRIVAL)));
        expect(on ?? '').not.toMatch(/no REACHABLE stance for a swing/);
    }, 120_000);
});
