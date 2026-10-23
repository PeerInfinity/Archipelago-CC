/**
 * ⛓⛓⛓ SEEDLING FIDELITY PITLATCH — ONE latch predicate for a door on a Pit tile (wave 27; PITPORT's review condition,
 * behind PITPORT's own switch `CONTACT_FIDELITY.pitTeleporterCrossing`, OFF).
 *
 * The split it closes: `findExit` admitted a live pit door only when the run was NOT latched on it, but the planner's
 * pit arm (`plannerObstacleAt` → `liveDoorPitTile(level, index)`) ignored the latch, so with the allowed exit = a LATCHED
 * pit door the planner treated that pit as floor. `stepOffCellFor` is the caller that showed it: ON at the base it
 * planned a walk off L43's latched door to (152,56) and off L100's to (296,88).
 *
 * The game (p4g headless, `probe-seedling-pit-doors.mjs` `l43-latched` / `l100-latched`, `fixtures/pitdoor-witness/`):
 * booted ON the door (latched by `Teleporter.check()`), the step off held from the first tick — the Pit takes the
 * player at t0 (after 0.72 px), it respawns ON the door at t20, t40, t60, and the door never fires. The model
 * reproduces both at 0 px (`fidelityPitPort`'s D1 rows), and `stepOffMinimalFor` already said "falls" for every
 * direction. So the planner must refuse that tile: `liveDoorPitTile(level, index, latched)` → null when latched.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { solverPlanOpts, stepOffCellFor, stepOffMinimalFor } from './solverBot.js';
import { DEFAULT_LATTICE, isWalkableTile, liveDoorPitTile, pitLatchOpts, plannerObstacleAt } from './botDriverV2.js';
import { PIT_DOORS } from '../../../scripts/procgen/probe-seedling-pit-doors.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'pitdoor-witness', `pitdoor-${name}.json`), 'utf8'));
const ON = (fn) => withContactFidelity({ pitTeleporterCrossing: true }, fn);
const OFF = (fn) => withContactFidelity({ pitTeleporterCrossing: false }, fn);
const doorIndex = (w, level) => w.teleporters.findIndex((t) => t.x === PIT_DOORS[level].x && t.y === PIT_DOORS[level].y);
const centre = (level) => ({ x: PIT_DOORS[level].x + 8, y: PIT_DOORS[level].y + 8 });
const latchedRun = (level) => createRunForStaging(
    arrivalStaging({ level, x: PIT_DOORS[level].x, y: PIT_DOORS[level].y }, { items: ['hasSword'] }), atlasLevelSource());
/** The solver's plan bag for a step-off (`solverPlanOpts`' shape, with no contacts). */
const stepOffOpts = (run) => ({
    liveBag: run.liveGeometryOpts(), avoidVolumes: true, keys: run.progress('keys'), contacts: new Set(),
    lattice: DEFAULT_LATTICE, inventory: run.progress('inventory'), noHazards: run.noHazards, ...pitLatchOpts(run),
});

describe('PITLATCH D2 — the one predicate', () => {
    it('a LATCHED live pit door: `liveDoorPitTile` is null and `plannerObstacleAt` returns {kind: \'pit\'} for its tile (ON)', () => {
        const src = atlasLevelSource();
        for (const level of [43, 100]) {
            const w = buildLevelWorld(src(level));
            const i = doorIndex(w, level);
            const c = centre(level);
            const latched = new Set([i]);
            ON(() => {
                expect(liveDoorPitTile(w, i)).toMatchObject({ tx: PIT_DOORS[level].tile[0], ty: PIT_DOORS[level].tile[1] });
                expect(liveDoorPitTile(w, i, latched)).toBe(null);
                expect(liveDoorPitTile(w, i, new Set())).not.toBe(null);
                // Latched on ANOTHER door: this one is still the live exit.
                expect(liveDoorPitTile(w, i, new Set([i + 1000]))).not.toBe(null);
                expect(plannerObstacleAt(w, c.x, c.y, i)).toBe(null);
                expect(plannerObstacleAt(w, c.x, c.y, i, { latched })).toMatchObject({ kind: 'pit',
                    blocker: { tx: PIT_DOORS[level].tile[0], ty: PIT_DOORS[level].tile[1] } });
                expect(isWalkableTile(w, ...PIT_DOORS[level].tile, i, { lattice: 16, latched })).toBe(false);
                expect(isWalkableTile(w, ...PIT_DOORS[level].tile, i, { lattice: 16 })).toBe(true);
            });
            // OFF: the pit is a pit whatever the latch, as at the base.
            OFF(() => {
                expect(liveDoorPitTile(w, i)).toBe(null);
                expect(plannerObstacleAt(w, c.x, c.y, i)?.kind).toBe('pit');
                expect(plannerObstacleAt(w, c.x, c.y, i, { latched })?.kind).toBe('pit');
            });
        }
    });

    it('`pitLatchOpts`: `{latched}` (the run\'s own set) ON, `{}` OFF — an OFF bag is the bag it was', () => {
        const run = latchedRun(43);
        expect(OFF(() => pitLatchOpts(run))).toEqual({});
        expect(ON(() => pitLatchOpts(run))).toEqual({ latched: run.state.latched });
        expect([...run.state.latched]).toEqual([doorIndex(run.world, 43)]);
    });

    it('the solver\'s plan bag carries it (`solverPlanOpts`, every solver planner call\'s bag): ON `latched`, OFF no key', () => {
        const run = latchedRun(43);
        expect(ON(() => solverPlanOpts(run, new Set()).latched)).toBe(run.state.latched);
        expect('latched' in OFF(() => solverPlanOpts(run, new Set()))).toBe(false);
        // And it is the latch the planner reads: the door's tile under the solver's bag is a pit.
        const c = centre(43);
        const i = doorIndex(run.world, 43);
        expect(ON(() => plannerObstacleAt(run.world, c.x, c.y, i, solverPlanOpts(run, new Set()))?.kind)).toBe('pit');
    });
});

describe('PITLATCH D2 — the step off a latched pit door, planned as the game behaves', () => {
    it('the game: booted ON the door, the Pit takes the player at t0 and respawns it ON the door; it never crosses', () => {
        for (const [name, level] of [['l43-latched', 43], ['l100-latched', 100]]) {
            const g = witness(name).game;
            expect(g.crossedAt, name).toBe(null);
            expect(g.respawns, name).toEqual([20, 40, 60]);
            expect(g.final.level, name).toBe(level);
        }
    });

    it('`stepOffCellFor` finds NO cell (ON and OFF) — the base, ON, planned (152,56) / (296,88) across the latched pit', () => {
        for (const level of [43, 100]) {
            for (const arm of [ON, OFF]) {
                arm(() => {
                    const run = latchedRun(level);
                    const [i] = [...run.state.latched];
                    expect(stepOffCellFor(run, i, stepOffOpts(run)), `L${level}`).toBe(null);
                });
            }
        }
    });

    it('`stepOffMinimalFor` agrees: every direction falls, at the game\'s own t0 position', () => {
        for (const [name, level] of [['l43-latched', 43], ['l100-latched', 100]]) {
            const t0 = witness(name).gameTicks.find((o) => o.t === 1);
            ON(() => {
                const run = latchedRun(level);
                const [i] = [...run.state.latched];
                const all = stepOffMinimalFor(run, i);
                expect(all.every((c) => /^falls at /.test(c.rejected ?? '')), name).toBe(true);
                const dir = name === 'l43-latched' ? 'up' : 'left';
                expect(all.find((c) => c.dir === dir).rejected).toBe(`falls at (${t0.x},${t0.y})`);
            });
        }
    });
});
