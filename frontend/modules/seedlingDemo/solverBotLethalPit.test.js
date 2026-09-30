/**
 * ⛓ SEEDLING SWIM U4, D2 — a PREVIEW that walks onto lethal floor is a
 * truncated preview (`kind: 'lethal-pit'` / `'drowned'`), not an engine throw.
 *
 * The class, measured: the corridor-body sweep's post-sword THREW cells
 * (`PhysicsV2Error`: "the player fell into a pit in level 900, which has NO
 * control block", and "the player DROWNED in level 900") all came out of
 * `deriveRefuge`'s straight-line PREVIEW of a refuge cell, which cut a corner
 * onto a pass-2 `pit-patch` or `water-pool`. The throw escaped the
 * certification solve and aborted the whole generation.
 *
 * The subject here is committed: level 4's pit (5,4) is lethal (L4 has no
 * `control` block), and the only way into it is from the west, tile (4,4).
 *
 * ⛓ AND ITS WATER TWIN: two of the same sweep's cells threw "the player
 * DROWNED in level 900" from the same preview over a pass-2 `water-pool`.
 * Level 0's lake is armed water and the staging holds no conch, so a straight
 * preview from tile (6,13) into tile (6,14) latches `drown.drowning`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { previewWalk } from './solverBot.js';
import { fallDestination, PhysicsV2Error } from './playerPhysicsV2.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** `r8-solve-11`'s staging (the survey's staged base) re-pointed at a boot. */
function stagedRun(level, x, y) {
    const tape = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'r8-solve-11.json'), 'utf8'));
    const staging = solveStaging(stagingFromTape(parseTape(tape)));
    staging.boot = { level, x, y };
    return createRunForStaging(staging, atlasLevelSource());
}
const l4Run = () => stagedRun(4, 64, 64);
const l0Run = () => stagedRun(0, 96, 208);

const PIT = { x: 88, y: 72 };

describe('previewWalk and lethal floor', () => {
    it('the subject: L4 boots on (72,72), and its pit (5,4) is lethal by the model\'s own function', () => {
        const run = l4Run();
        expect([run.level, run.state.x, run.state.y]).toEqual([4, 72, 72]);
        expect(run.world.pitTiles.some((p) => p.tx === 5 && p.ty === 4)).toBe(true);
        expect(() => fallDestination(run.world, PIT)).toThrow(PhysicsV2Error);
    });

    it('a straight preview into the pit TRUNCATES as lethal-pit where the fall begins, and does not throw', () => {
        const run = l4Run();
        const walk = previewWalk(run, [PIT], 0);
        expect(walk.truncated?.kind).toBe('lethal-pit');
        expect(walk.truncated.why).toMatch(/LETHAL pit — the tile at \(88,72\) in level 4, which has no control block/);
        // The fall is irreversible from its first tick; the preview stops there,
        // well short of the 20-tick countdown that used to reach `fallDestination`.
        expect(walk.samples.length).toBeLessThan(20);
    });

    it('the live run is untouched by the preview', () => {
        const run = l4Run();
        previewWalk(run, [PIT], 0);
        expect([run.ticksCompleted, run.state.x, run.state.y]).toEqual([0, 72, 72]);
    });

    it('a straight preview into armed water TRUNCATES as drowned where the drown latches, and does not throw', () => {
        const run = l0Run();
        expect([run.level, run.state.x, run.state.y]).toEqual([0, 104, 216]);
        expect(run.progress('inventory')?.canSwim ?? false).toBe(false);
        expect(run.world.lethalTerrainTiles.some((t) => t.tx === 6 && t.ty === 14)).toBe(true);
        const walk = previewWalk(run, [{ x: 104, y: 232 }], 0);
        expect(walk.truncated?.kind).toBe('drowned');
        expect(walk.truncated.why).toMatch(/LATCHED DROWNING at \(.*\) in level 0/);
        expect([run.ticksCompleted, run.state.x, run.state.y]).toEqual([0, 104, 216]);
    });
});
