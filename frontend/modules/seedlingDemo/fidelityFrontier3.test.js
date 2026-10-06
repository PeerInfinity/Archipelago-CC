/**
 * ⛓⛓⛓ SEEDLING FIDELITY FRONTIER3 — the frontier's solids with no strategy
 * row, and the planner's pixel-mask collision.
 *
 *  D2  the planner routes through what the pixel mask lets through:
 *      `exitAimFor` (a reach-exit's aim leaves a trigger centre a MASK blocks)
 *      and `FINE_LATTICE` (a frontier refusal is asked once more on the 8 px
 *      lattice, under the `fineLattice` grant — off roster-wide on `main`,
 *      because it moves one census row). Witnesses `frontier3-l62-door-niche` and
 *      `frontier3-l87-pocket`, recorded on the game (model = game, 0 px).
 *  D3  the rows and the gates: `grasslock` and `cover` are `hold`'s
 *      responders, `crusher` names `bait` (selected, not registered), and a
 *      wall whose opener is not in the room is named as a gate
 *      (`obstacleGateFor`: the seal door's ITEM gate, L112's ENCOUNTER gate).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, maskHitsBox, rectsOverlap, TILE_SIZE } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape } from './tapeRunner.js';
import { plannerObstacleAt } from './botDriverV2.js';
import {
    FINE_LATTICE, FINE_LATTICE_ROSTER_WIDE, OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, SolverRefusal, exitAimFor, obstacleGateFor,
    solveSegment,
} from './solverBot.js';
import { frontier3Staging, FRONTIER3_WITNESSES }
    from '../../../scripts/procgen/plan-seedling-frontier3-witness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const expectation = (name) => JSON.parse(
    readFileSync(join(HERE, 'fixtures', 'expectations', `${name}.json`), 'utf8'));
const witness = (name) => FRONTIER3_WITNESSES.find((w) => w.name === name);

/** A run on the survey's staging, booted at `boot` (the witnesses' own helper). */
const stagedRun = async (boot) => {
    const staging = await frontier3Staging({ boot });
    return { run: createRunForStaging(staging, SRC), staging };
};

/** The refusal a goal draws from that boot (or `null` when it solves). */
const refusalOf = async (boot, goal, opts = {}) => {
    const { run, staging } = await stagedRun(boot);
    try {
        solveSegment({ run, goals: [goal], name: 'frontier3-probe', boot: staging.boot, ...opts });
        return null;
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return e;
    }
};

describe('fidelity FRONTIER3 D2 — a reach-exit aims where the pixel mask lets the player stand', () => {
    it('L62\'s door is the ONLY trigger in the map whose centre box is inside a pixelmask', () => {
        const masked = [];
        for (const record of MAP.levels) {
            let w;
            try { w = buildLevelWorld(record); } catch { continue; }
            w.teleporters.forEach((tp) => {
                const hit = w.plannerBlockerAt(playerBoxAt(tp.rect.x + TILE_SIZE / 2, tp.rect.y + TILE_SIZE / 2));
                if (hit?.kind === 'pixelmask') masked.push(`L${record.level} ${tp.x},${tp.y} ${hit.blocker.tag}`);
            });
        }
        expect(masked).toEqual(['L62 112,64 building6']);
    });

    it('exitAimFor moves L62\'s aim off the masked centre to (120,74); any other door keeps its centre', async () => {
        const { run } = await stagedRun({ level: 62, x: 112, y: 80 });
        const index = run.world.teleporters.findIndex((t) => t.x === 112 && t.y === 64);
        const aim = exitAimFor(run.world, index);
        expect(aim).toEqual({ x: 120, y: 74 });
        const tp = run.world.teleporters[index];
        expect(rectsOverlap(playerBoxAt(aim.x, aim.y), tp.rect)).toBe(true);
        expect(plannerObstacleAt(run.world, aim.x, aim.y, index)).toBeNull();
        expect(plannerObstacleAt(run.world, 120, 72, index)?.kind).toBe('pixelmask');
        const other = run.world.teleporters.findIndex((t) => t.x === 48 && t.y === 304);
        expect(exitAimFor(run.world, other)).toEqual({ x: 56, y: 312 });
    });

    it('L62 from the L64 arrival solves in 12 t with no fine-lattice walk; the committed tape is that plan', async () => {
        const w = witness('frontier3-l62-door-niche');
        const { run, staging } = await stagedRun(w.boot);
        const out = solveSegment({ run, goals: [w.goal], name: 'frontier3-l62', boot: staging.boot });
        expect(run.level).toBe(64);
        expect(out.perTick.length).toBe(tape(w.name).tick_count);
        expect(out.perTick.length).toBe(12);
        expect(out.fineLatticeWalks).toBeUndefined();
    });

    it('⛓ the fine-lattice retry is ON roster-wide (⚖ licensed at the wave-6 harvest); with the grant withheld L87\'s pocket refuses as before', async () => {
        expect(FINE_LATTICE_ROSTER_WIDE).toBe(true);
        const w = witness('frontier3-l87-pocket');
        const e = await refusalOf(w.boot, w.goal, { fineLattice: false });
        // the frontier names the nearest cliffside (the sweep's `pixelmask:cliffside0/1` rows)
        expect(e.message).toMatch(/Obstacle: pixelmask:cliffside[01] \(cliffside[01]@\d+,\d+\)[^.]*\. No strategy row exists/);
    });

    it('L87\'s pocket solves with the grant, on the 8 px lattice, up the 5 px column beside cliffside1@48,32', async () => {
        expect(FINE_LATTICE).toBe(8);
        const w = witness('frontier3-l87-pocket');
        expect(w.fineLattice).toBe(true);
        const { run, staging } = await stagedRun(w.boot);
        const out = solveSegment({ run, goals: [w.goal], name: 'frontier3-l87', boot: staging.boot,
            dashMode: 'all', fineLattice: true });
        expect(run.level).toBe(89);
        expect(out.perTick.length).toBe(tape(w.name).tick_count);
        expect(out.fineLatticeWalks).toHaveLength(1);
        expect(out.fineLatticeWalks[0].refused).toMatch(/^solverBot\(frontier3-l87\): no corridor for goal reach-exit/);
        // the walk row says which lattice planned it
        expect(out.trace.rows.some((r) => r.strategy?.verb === 'walk' && r.strategy.lattice === 8)).toBe(true);
    });

    it.each(FRONTIER3_WITNESSES.map((w) => [w.name]))('%s: THE GAME agrees with the model at every observation (0 px)', (name) => {
        const game = expectation(name);
        const model = runTape(tape(name), { levelSource: SRC });
        expect(model.ticks.length).toBe(game.ticks.length);
        const off = model.ticks.filter((o, i) => o.level !== game.ticks[i].level
            || o.x !== game.ticks[i].x || o.y !== game.ticks[i].y);
        expect(off).toEqual([]);
        expect(game.transitions.at(-1).to_level).toBe(witness(name).to);
    });

    it('the L62 game stream stands in the doorway, clear of building6\'s mask, before it crosses', () => {
        const game = expectation('frontier3-l62-door-niche');
        const w = buildLevelWorld(MAP.levels.find((l) => l.level === 62));
        const mask = w.pixelmasks.find((p) => p.tag === 'building6');
        const tp = w.teleporters.find((t) => t.x === 112 && t.y === 64);
        const last = game.ticks.filter((o) => o.level === 62).at(-1);
        expect(rectsOverlap(playerBoxAt(last.x, last.y), tp.rect)).toBe(true);
        expect(maskHitsBox(mask.mask, mask.maskX, mask.maskY, playerBoxAt(last.x, last.y))).toBe(false);
        expect(maskHitsBox(mask.mask, mask.maskX, mask.maskY, playerBoxAt(120, 72))).toBe(true);
    });
});

describe('fidelity FRONTIER3 D3 — the rows, and the gates whose opener is not in the room', () => {
    it('the table: grasslock and cover are hold\'s responders; crusher names bait, which is not registered', () => {
        expect(OBSTACLE_STRATEGIES['solid:grasslock']).toBe('hold');
        expect(OBSTACLE_STRATEGIES['solid:cover']).toBe('hold');
        expect(OBSTACLE_STRATEGIES['solid:crusher']).toBe('bait');
        expect(STRATEGY_EXECUTORS.bait).toBeUndefined();
        // scenery with no verb in the game stays rowless: a wall, never a work order
        for (const tag of ['planttorch', 'bonetorch', 'bonetorch2', 'dungeonspire', 'ruinedpillar', 'tree', 'rock',
            'finaldoor', 'rocklock']) {
            expect(OBSTACLE_STRATEGIES[`solid:${tag}`]).toBeUndefined();
        }
    });

    it('L42 (route step 108): the crusher refuses as the computed work order `bait`', async () => {
        const e = await refusalOf({ level: 42, x: 240, y: 320 }, { kind: 'collect-placement', placement: { x: 184, y: 152 } });
        expect(e.message).toMatch(/Obstacle: solid:crusher \(crusher@96,144\)\. Strategy 'bait' is SELECTED but not registered/);
    });

    it('L112 (route step 234): the rocklock is an ENCOUNTER gate naming the Owl', async () => {
        const e = await refusalOf({ level: 112, x: 32, y: 208 }, { kind: 'reach-exit', exit: { x: 112, y: 0 } });
        expect(e.message).toMatch(/Obstacle: solid:rocklock \(rocklock@112,16\)/);
        expect(e.message).toMatch(/ENCOUNTER-GATE \(rocklock@112,16\): no presser in level 112 publishes its group; its opener is finalboss@\d+,\d+'s death/);
        expect(e.considered.at(-1).option).toBe('encounter-gate');
    });

    it('L113 (route step 235): the seal door is an ITEM gate', async () => {
        const e = await refusalOf({ level: 113, x: 72, y: 128 }, { kind: 'reach-exit', exit: { x: 112, y: 0 } });
        expect(e.message).toMatch(/Obstacle: solid:finaldoor \(finaldoor@112,0\)[^.]*\. ITEM-GATE \(finaldoor@112,0\): the seal door opens only on approach for a player holding all 16 Seal parts/);
    });

    it('obstacleGateFor answers only the two gates, and nothing for a verb-bearing or scenery solid', async () => {
        const { run } = await stagedRun({ level: 112, x: 32, y: 208 });
        expect(obstacleGateFor(run, { kind: 'solid', tag: 'planttorch', id: 'planttorch@80,32' })).toBeNull();
        expect(obstacleGateFor(run, { kind: 'solid', tag: 'lock', id: 'lock@0,0' })).toBeNull();
        expect(obstacleGateFor(run, { kind: 'pixelmask', tag: 'rocklock', id: 'x' })).toBeNull();
        expect(obstacleGateFor(run, { kind: 'solid', tag: 'rocklock', id: 'rocklock@112,16' }).gate).toBe('ENCOUNTER');
    });
});
