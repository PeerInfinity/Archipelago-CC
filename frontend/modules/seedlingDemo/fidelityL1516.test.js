/**
 * ⛓⛓ SEEDLING FIDELITY L1516 — L15's `chest@144,96` is a Solid the player cannot walk through (wave 21, D1/D2).
 *
 * `Chest.update` opens on `collideLine("Player", px+2, py+17, px+12, py+17)` (`Chest.as:63`) and `World.collideLine`
 * at precision 1 never tests `toX` (`World.as:442`, `:514`): the probes are px+2 .. px+11. `chest.chestProbeLine`
 * carried `x1 = px+12`, read inclusive by `keyLineTouches`, so the model opened the chest from a box whose left edge
 * sat in (px+11, px+12] — rules-2's first L15 swim cut, climbing column 9, walked through a chest the game kept.
 * Switch `chestProbeLineEnd` (OFF): px+11. Witnessed on the game (p4g headless logic-only,
 * `probe-seedling-l15-chest-line.mjs`, `fixtures/l1516-witness/`): the edge tape stops under the Solid, the inner tape
 * (4 ticks less east) opens it; the model ON reproduces both at 0 px.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { PIN_NAMES, parseTape } from './tapeFormat.js';
import { runTape } from './tapeRunner.js';
import { chestProbeLine } from './chest.js';
import { keyLineTouches } from './activators.js';
import { chestLineTapes, expectChestLine, CHEST_ID } from '../../../scripts/procgen/probe-seedling-l15-chest-line.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIT = join(HERE, 'fixtures', 'l1516-witness');
const SOURCE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'r9-solve-15.json'), 'utf8'));
const row = (name) => JSON.parse(readFileSync(join(WIT, `l15-chest-line-${name}.json`), 'utf8'));
const replay = (name) => {
    const t = parseTape({ ...chestLineTapes(SOURCE)[name], pins: [...PIN_NAMES] });
    const r = runTape(t, { levelSource: atlasLevelSource() });
    return { opened: (r.chestOpens ?? []).some((c) => c.id === CHEST_ID), final: r.ticks.at(-1) };
};
const ENV = ['SEEDLING_CONTACT_FIDELITY', 'SEEDLING_CHEST_PROBE_LINE_END'];

describe('L1516 D2 — a chest\'s probe line stops one pixel short of `toX`', () => {
    it.skipIf(ENV.some((k) => process.env[k]))('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.chestProbeLineEnd).toBe(false);
        expect(CONTACT_FIDELITY.chestProbeLineEnd).toBe(false);
    });

    it('the line: OFF px+2..px+12 (byte-identical), ON px+2..px+11 (the keyLock\'s transcription)', () => {
        expect(withContactFidelity({ chestProbeLineEnd: false }, () => chestProbeLine(144, 96))).toEqual({ x0: 146, x1: 156, y: 113 });
        expect(withContactFidelity({ chestProbeLineEnd: true }, () => chestProbeLine(144, 96))).toEqual({ x0: 146, x1: 155, y: 113 });
        // The game's stop: x 157.997, box [155.997, 159.997) — its first integer probe is 156.
        const box = { x: 155.99692271842153, right: 159.99692271842153, y: 112.34349760511718, bottom: 117.34349760511718 };
        expect(withContactFidelity({ chestProbeLineEnd: false }, () => keyLineTouches(box, chestProbeLine(144, 96)))).toBe(true);
        expect(withContactFidelity({ chestProbeLineEnd: true }, () => keyLineTouches(box, chestProbeLine(144, 96)))).toBe(false);
    });

    for (const name of ['edge', 'inner']) {
        it(`${name}: the model ON reproduces the game's final tick exactly, and the chest's open`, () => {
            const g = row(name);
            const on = withContactFidelity({ chestProbeLineEnd: true }, () => replay(name));
            expect(on.opened).toBe(g.game.opened);
            expect({ x: on.final.x, y: on.final.y, level: on.final.level })
                .toEqual({ x: g.game.final.x, y: g.game.final.y, level: g.game.final.level });
            expect(expectChestLine(name, on)).toBe(true);
            expect(g.modelOn.maxDrift).toBe(0);
        });
    }

    it('edge: the model OFF is the gap — it opens the chest the game keeps and leaves L15 by the stairs', () => {
        const g = row('edge');
        const off = withContactFidelity({ chestProbeLineEnd: false }, () => replay('edge'));
        expect(g.game.opened).toBe(false);
        expect(off.opened).toBe(true);
        expect(off.final.level).toBe(16);
        expect(g.modelOff.firstDrift.t).toBe(200);
    });

    it('inner: the model OFF agrees (the control: the line is live at x ≈ 152)', () => {
        const g = row('inner');
        const off = withContactFidelity({ chestProbeLineEnd: false }, () => replay('inner'));
        expect(off.opened).toBe(true);
        expect(off.final).toMatchObject({ x: g.game.final.x, y: g.game.final.y, level: g.game.final.level });
    });
});

/**
 * ⛓⛓ D3 — sweep leg 206 (`level_16__r1c1 <- in_L15_144_16 -> exit:out_pit_8_3`): the goal pit (13,4) is ENCLOSED (its
 * four neighbours are pits) and is entered only across a corner (`solverBot.enclosedPitCorners`, switch
 * `enclosedPitCorner`, OFF). The pushable block the refusal named is not the obstacle. Witnessed on the game
 * (`probe-seedling-l16-corner-pit.mjs`): `corner`, `control` and the solver's own `solve` tape, 0 px.
 */
describe('L1516 D3 — an enclosed pit is entered across a corner', async () => {
    const { buildLevelWorld } = await import('./levelWorld.js');
    const { enclosedPitCorners } = await import('./solverBot.js');
    const { cornerPitTapes, fallPitOf } = await import('../../../scripts/procgen/probe-seedling-l16-corner-pit.mjs');
    const { stagingFromTape } = await import('./tapeRunner.js');
    const { loadAtlas } = await import('./levelSource.js');
    const { arrivalSolverGoal, arrivalSolveRequest } = await import('./wasmArrival.js');
    const { createInPlaceProduceService } = await import('./wasmWalkTape.js');
    const { ANYTIME_PASSES } = await import('./jsRuntimeSolver.js');
    const W16 = buildLevelWorld(atlasLevelSource()(16), {});
    const pitAt = (tx, ty) => W16.pitTiles.find((p) => p.tx === tx && p.ty === ty);
    const SOLVE = JSON.parse(readFileSync(join(WIT, 'l16-corner-pit-solve.tape.json'), 'utf8'));
    const cornerRow = (name) => JSON.parse(readFileSync(join(WIT, `l16-corner-pit-${name}.json`), 'utf8'));

    it.skipIf(ENV.some((k) => process.env[k]) || process.env.SEEDLING_ENCLOSED_PIT_CORNER)('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.enclosedPitCorner).toBe(false);
        expect(CONTACT_FIDELITY.enclosedPitCorner).toBe(false);
    });

    it('L16 (13,4) is the one enclosed pit of its cluster; its corners are (12,5) and (14,5)', () => {
        expect(W16.pitTiles.map((p) => `${p.tx},${p.ty}`).sort())
            .toEqual(['12,3', '12,4', '13,3', '13,4', '13,5', '14,3', '14,4']);
        for (const p of W16.pitTiles) {
            if (p.tx === 13 && p.ty === 4) continue;
            expect(enclosedPitCorners(W16, p), `${p.tx},${p.ty}`).toBeNull();
        }
        const c = enclosedPitCorners(W16, pitAt(13, 4));
        expect(c.map((k) => ({ cell: k.cell, keys: k.keys, corner: k.corner, stance: k.stance }))).toEqual([
            { cell: { tx: 14, ty: 5 }, keys: ['left', 'up'], corner: { x: 224, y: 80 }, stance: { x: 230, y: 85 } },
            { cell: { tx: 12, ty: 5 }, keys: ['right', 'up'], corner: { x: 208, y: 80 }, stance: { x: 202, y: 85 } },
        ]);
    });

    for (const name of ['corner', 'control', 'solve']) {
        it(`${name}: the model reproduces the game's fall pit and landing`, () => {
            const g = cornerRow(name);
            const raw = name === 'solve' ? SOLVE : cornerPitTapes(SOURCE)[name];
            const r = runTape(parseTape({ ...raw, pins: [...PIN_NAMES] }), { levelSource: atlasLevelSource() });
            const ticks = r.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level }));
            expect(fallPitOf(ticks)).toEqual(g.game.pit);
            expect(ticks.at(-1)).toEqual(g.game.final);
            expect(g.model.max).toBe(0);
        });
    }

    const solveLeg206 = () => {
        const base = { ...SOLVE, tick_count: 0, inputs: [], equips: [] };
        const staging = stagingFromTape(parseTape(base));
        const records = new Map(loadAtlas().levels.map((l) => [l.level, l]));
        const goal = { kind: 'exit', level: 16, tiles: [[13, 4]], name: 'level_16__r1c1 -> level_17 #6' };
        const mapped = arrivalSolverGoal(goal, { staging, levelSource: atlasLevelSource(), record: records.get(16) });
        const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: atlasLevelSource(), records,
            scratchPersistence: true }), passes: ANYTIME_PASSES };
        return createInPlaceProduceService().start(req).result;
    };

    it('OFF: leg 206\'s goal refuses — no corridor reaches (13,4)', () => {
        const res = withContactFidelity({ enclosedPitCorner: false }, solveLeg206);
        expect(res.ok).toBe(false);
        expect(String(res.message)).toMatch(/no corridor for goal reach-pit toward \(216,72\)/);
    });

    it('ON: leg 206\'s goal is solved, and the solution is the witnessed tape key for key', () => {
        const res = withContactFidelity({ enclosedPitCorner: true }, solveLeg206);
        expect(res.ok).toBe(true);
        expect(res.plan.solution.length).toBe(335);
        expect(res.plan.expected.at(-1)).toMatchObject({ level: 17, x: 136 });
        const held = (t) => SOLVE.inputs.filter((i) => i.from <= t && t < i.to).map((i) => i.key).sort();
        res.plan.solution.forEach((h, t) => expect([...h].filter((k) => typeof k === 'string').sort(), `t${t}`).toEqual(held(t)));
    });
});
