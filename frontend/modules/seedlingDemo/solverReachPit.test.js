/**
 * ⛓⛓ SEEDLING SWIM U1, D1 — THE `reach-pit` GOAL.
 *
 * The solver's pit counterpart of `reach-exit`: walk onto ONE named pit tile of
 * a level whose `control` block names a `fallthrough` level, let the game carry
 * the player, and coast the transport so the segment ends on the ground in the
 * next level.
 *
 * ⚠ THE FIXTURE IS L30 → L31, NOT THE SURVEY'S L12 → L21. The survey's step 24
 * (L12 from (16,80)) refuses on the ROOM, not on the goal kind — the corridor
 * crosses `shieldlocknorm@288,704`, then (with the route's own Red Key and
 * Shield granted) a `bosslock@416,240` whose stance `puncher@416,256` guards;
 * see the U1 report. L30's one pit `(3,14)` is the room with a committed boot
 * (`r3-collect-torch`) whose pit the solver can reach: a `breakablerock` stands
 * ON the tile (the `break` verb clears it, with the sword granted), and the
 * fall lands in L31 at `fallDestination`'s ctor (48,544) — the player's
 * position after the descent is the ctor plus the half tile.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { withItemFlag } from './watchSolve.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { fallDestination } from './playerPhysicsV2.js';
import { assertGoal, solveSegment } from './solverBot.js';

const TAPE = new URL('./fixtures/tapes/r3-collect-torch.json', import.meta.url);
const PIT = Object.freeze({ tx: 3, ty: 14, x: 48, y: 224 });

function l30Run({ sword = true } = {}) {
    let staging = solveStaging(stagingFromTape(parseTape(JSON.parse(readFileSync(TAPE, 'utf8')))));
    if (sword) staging = withItemFlag(staging, 'sword', true);
    return { run: createRunForStaging(staging, atlasLevelSource()), boot: staging.boot };
}

describe('assertGoal — reach-pit', () => {
    it('accepts a pit TILE whose rect origin agrees with it', () => {
        const g = { kind: 'reach-pit', pit: { ...PIT } };
        expect(assertGoal(g, 0)).toBe(g);
    });

    it('refuses a pit whose x/y is not the tile origin, and a non-integer tile', () => {
        expect(() => assertGoal({ kind: 'reach-pit', pit: { ...PIT, x: 50 } }, 0))
            .toThrow(/reach-pit needs pit \{tx, ty, x, y\}/);
        expect(() => assertGoal({ kind: 'reach-pit', pit: { tx: 3.5, ty: 14, x: 56, y: 224 } }, 0))
            .toThrow(/reach-pit needs pit/);
        expect(() => assertGoal({ kind: 'reach-pit' }, 0)).toThrow(/reach-pit needs pit/);
    });

    it('the unknown-kind refusal lists the three kinds the solver owns', () => {
        expect(() => assertGoal({ kind: 'reach-cell' }, 0))
            .toThrow(/'reach-exit', 'reach-pit' and 'collect-placement'/);
    });
});

describe('solveSegment — reach-pit L30 (3,14) → L31', () => {
    it('the landing is the model\'s own: `fallDestination` of the tile centre is L31 @ (48,544)', () => {
        const world = buildLevelWorld(atlasLevelSource()(30));
        expect(world.fallthrough.level).toBe(31);
        expect(fallDestination(world, { x: PIT.x + 8, y: PIT.y + 8 }))
            .toEqual({ to_level: 31, ctor: { x: 48, y: 544 } });
    });

    it('SOLVES: breaks the rock on the tile, falls at t=98, coasts 80 ticks, ends in L31 on the ground', () => {
        const { run, boot } = l30Run();
        const out = solveSegment({ run, goals: [{ kind: 'reach-pit', pit: { ...PIT } }],
            name: 'u1-reach-pit', boot });
        // Predicted before the first run: "~100 ticks to the edge (a rock to
        // break first), then the transport". Measured: 178 = 98 + 80.
        expect(out.perTick.length).toBe(178);
        expect(run.transitions).toEqual([{ t: 98, from_level: 30, to_level: 31 }]);
        expect(run.level).toBe(31);
        expect(run.state.fall ?? null).toBeNull();
        expect({ x: run.state.x, y: run.state.y }).toEqual({ x: 48 + 8, y: 544 + 8 });
        expect(out.replans).toBe(0);
        expect(out.records.at(-1)).toEqual({ goal: 'reach-pit', to: 31, t: 98, coast: 80 });
        expect(out.records[0]).toMatchObject({ strategy: 'break', target: 'breakablerock@48,224' });
        expect(out.trace.rows.map((r) => r.goal.kind)).toEqual(['reach-pit', 'reach-pit']);
    });

    it('a pit the level does not have is refused BY NAME, before a tick is spent', () => {
        const { run, boot } = l30Run();
        expect(() => solveSegment({ run, name: 'u1-absent-pit', boot,
            goals: [{ kind: 'reach-pit', pit: { tx: 0, ty: 0, x: 0, y: 0 } }] }))
            .toThrow(/reach-pit \(0,0\): level 30 has no pit tile there — its pits are \[\(3,14\)\]/);
        expect(run.ticksCompleted).toBe(0);
    });

    it('pre-sword, the rock on the tile refuses by the break verb\'s own name (the pit is not a bypass)', () => {
        const { run, boot } = l30Run({ sword: false });
        expect(() => solveSegment({ run, name: 'u1-pit-nosword', boot,
            goals: [{ kind: 'reach-pit', pit: { ...PIT } }] }))
            .toThrow(/reach-pit \(3,14\)->L31 -> break: breakablerock@48,224 cannot be broken by this run/);
    });
});
