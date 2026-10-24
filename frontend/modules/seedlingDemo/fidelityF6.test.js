/**
 * Seedling fidelity F6: re-entering a room in the GAME'S OWN saved state —
 * I1's I01 · I02 · I03, the three clears the campaign's latched persistence
 * carries that the model refused to BUILD.
 *
 *   · D1 (I01): `{17,29}` is the out-of-band landing of L18's two `tag="-1"`
 *     spinners. The build accepts it as INERT when the next level holds that
 *     writer (`outOfBandWritersOnto`), and still refuses an orphan clear that
 *     names nothing.
 *   · D2 (I02): `{2,0}` builds L2's MoonrockPile (the "appear" response), which
 *     covers `stairsup@48,16`. L0's set moonrock writes it on window 23's t2.
 *   · D3 (I03): `{20,4}` boots `buttonroom@192,16` PRESSED, so its group is
 *     latched from the build and `lock@32,80` fades open under the player; the
 *     solver waits the latched fade out instead of walking to the presser.
 *
 * The game's side: `f6-l17-reentry`, `f6-l2-reentry`, `f6-l20-reentry`
 * (recorded by `check-seedling-bot-differential --record`; tapeRunner holds the
 * model to them) and `fixtures/f6-reentry-oracle.json`
 * (`probe-seedling-f6-reentry.mjs --record`: the moonrock bracket and one
 * control per row, each witness with its clear removed).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import {
    OUT_OF_BAND_WRITER_CLASSES, PERSISTENCE_RESPONSE, REFUSED_CLEAR_RESPONSES, ROLES,
    buildLevelWorld, outOfBandWritersOnto, persistenceClearsFor, rectsOverlap,
} from './levelWorld.js';
import { OUT_OF_BAND_WRITERS } from './outOfBandLedger.js';
import { RESPONDERS, createActivatorState, opensOnTick } from './activators.js';
import { loadExpectation, loadTape } from './fixtures/index.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, runTapeToStream } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';
import { arrivalSolverGoal } from './wasmArrival.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'f6-reentry-oracle.json'), 'utf8'));
const BASE = parseTape(readFileSync(join(HERE, 'fixtures', 'witness-bases', 'r9-solve-32.f6.json'), 'utf8'));
const SRC = atlasLevelSource();
const arm = (name) => ORACLE.arms.find((a) => a.arm === name);
const stagingAt = (boot) => ({ ...BASE, boot, equips: [], despawn: [], tick0: null });
const replay = (name) => runTapeToStream(loadTape(name), { levelSource: SRC });
const recorded = (name) => {
    const e = loadExpectation(name);
    return e.stream ?? e;
};
const without = (name, level, tag) => {
    const t = parseTape(loadTape(name));
    return { ...t, persistence: t.persistence.filter((p) => !(p.level === level && p.tag === tag)) };
};

describe('fidelity F6 — the chain-end staging carries all three clears', () => {
    it.each([[17, 29], [2, 0], [20, 4]])('{%i,%i} is in r9-solve-32\'s persistence (the witness base)', (level, tag) => {
        expect(BASE.persistence.some((p) => p.level === level && p.tag === tag)).toBe(true);
    });
});

describe('fidelity F6 — D1 (I01): a game-written out-of-band clear is INERT at build', () => {
    it('L18\'s two tag -1 spinners are the writers that land on {17,29}', () => {
        expect(outOfBandWritersOnto(17, SRC(18)).map((w) => [w.id, w.as3, w.slot]))
            .toEqual([['spinner@48,96', 'Spinner', 29], ['spinner@112,48', 'Spinner', 29]]);
    });
    it('every writer class names a member of the out-of-band registry', () => {
        for (const as3 of Object.values(OUT_OF_BAND_WRITER_CLASSES)) {
            expect(OUT_OF_BAND_WRITERS[as3], as3).toBeTruthy();
        }
    });
    it('L17 with {17,29} and L18 as its neighbour builds, unchanged, and says why', () => {
        const fresh = buildLevelWorld(SRC(17), { roles: ROLES });
        const w = buildLevelWorld(SRC(17), { roles: ROLES, cleared: [29], nextLevelRecord: SRC(18) });
        expect(w.outOfBandClears).toEqual([{ tag: 29, writers: ['spinner@48,96', 'spinner@112,48'] }]);
        expect(fresh.outOfBandClears).toEqual([]);
        expect(JSON.stringify(w.solids)).toBe(JSON.stringify(fresh.solids));
        expect(JSON.stringify(w.combat)).toBe(JSON.stringify(fresh.combat));
    });
    it('⛔ an orphan clear is STILL refused: no writer, the wrong slot, no neighbour', () => {
        expect(() => buildLevelWorld(SRC(71), { cleared: [29], nextLevelRecord: SRC(72) }))
            .toThrow(/which no entity in this level reads/);
        expect(() => buildLevelWorld(SRC(17), { cleared: [28], nextLevelRecord: SRC(18) }))
            .toThrow(/which no entity in this level reads/);
        expect(() => buildLevelWorld(SRC(17), { cleared: [29] }))
            .toThrow(/which no entity in this level reads/);
    });
    it('the neighbour must be level + 1, and a writer needs an EXPLICIT tag attribute', () => {
        expect(() => outOfBandWritersOnto(17, SRC(19))).toThrow(/level 18's/);
        const untagged = { ...SRC(18), entities: SRC(18).entities.map((e) => (e.type === 'spinner'
            ? { ...e, attrs: { ...e.attrs, tag: undefined } } : e)) };
        for (const e of untagged.entities) if (e.attrs && e.attrs.tag === undefined) delete e.attrs.tag;
        expect(outOfBandWritersOnto(17, untagged)).toEqual([]);
    });
    it('the run builds L17 from the chain-end staging (the boot that refused)', () => {
        const run = createRunForStaging(stagingAt({ level: 17, x: 48, y: 48 }), SRC);
        expect(run.world.outOfBandClears).toEqual([{ tag: 29, writers: ['spinner@48,96', 'spinner@112,48'] }]);
    });
    it('f6-l17-reentry: the model replays the game\'s recording, and the game ignores the slot', () => {
        expect(replay('f6-l17-reentry')).toEqual(recorded('f6-l17-reentry'));
        // CONTROL-L17: the same walk with {17,29} removed is the same stream on the game.
        const c = arm('CONTROL-L17');
        expect(c).toMatchObject({ vsModel: { worst: 0 }, vsWitness: { worst: 0 }, error: '' });
        expect(runTapeToStream(without('f6-l17-reentry', 17, 29), { levelSource: SRC }))
            .toEqual(recorded('f6-l17-reentry'));
    });
});

describe('fidelity F6 — D2 (I02): {2,0} builds the MoonrockPile', () => {
    it('`appear` is no longer a refused response, and L2 with {2,0} has the 32x16 Solid over the stairs', () => {
        expect(PERSISTENCE_RESPONSE.moonrockpile).toBe('appear');
        expect(REFUSED_CLEAR_RESPONSES.appear).toBeUndefined();
        const fresh = buildLevelWorld(SRC(2), { roles: ROLES });
        const w = buildLevelWorld(SRC(2), { roles: ROLES, cleared: [0] });
        expect(fresh.solids.some((s) => s.tag === 'moonrockpile')).toBe(false);
        const pile = w.solids.find((s) => s.tag === 'moonrockpile');
        expect(pile.rect).toMatchObject({ x: 40, y: 16, right: 72, bottom: 32 });
        const stairs = w.teleporters.find((t) => t.x === 48 && t.y === 16);
        expect(rectsOverlap(pile.rect, stairs.rect)).toBe(true);
    });
    it('what writes {2,0}: L0\'s set moonrock finds the stairs under it on window 23\'s t2 — model and game', () => {
        let run = null;
        const st = createTapeStepper(loadTape('r9-solve-0-v3'), { levelSource: SRC, onTick: (t, s, h, x) => { run = x; } });
        for (let r = st.next(); !r.done; r = st.next()) { /* drain */ }
        const write = run.moonrock.events.find((e) => e.what === 'stairs-replaced');
        expect(write).toMatchObject({ t: 2, level: 0, id: 'moonrock@240,256', flag: { level: 2, tag: 0, value: false } });
        expect(arm('MOONROCK-BEFORE')).toEqual({ arm: 'MOONROCK-BEFORE', ticks: write.t - 1, cleared20: false, error: '' });
        expect(arm('MOONROCK-TAKE')).toEqual({ arm: 'MOONROCK-TAKE', ticks: write.t, cleared20: true, error: '' });
    });
    it('f6-l2-reentry: the walk from L3 stops against the pile, as the game does', () => {
        const s = replay('f6-l2-reentry');
        expect(s).toEqual(recorded('f6-l2-reentry'));
        expect(s.transitions).toEqual([{ t: 20, from_level: 3, to_level: 2 }]);
        expect(s.ticks.at(-1)).toMatchObject({ level: 2 });
        // CONTROL-L2: without {2,0} the same keys leave for L0 — on the game and in the model.
        const c = arm('CONTROL-L2');
        expect(c).toMatchObject({ vsModel: { worst: 0 }, last: { level: 0 }, error: '' });
        const m = runTapeToStream(without('f6-l2-reentry', 2, 0), { levelSource: SRC });
        expect(m.ticks.at(-1)).toMatchObject({ level: 0, x: c.last.x, y: c.last.y });
    });
    it('the solver from the chain-end L2 arrival: to L3 solves; to L0 declines on the pile, by name', () => {
        const staging = stagingAt({ level: 2, x: 48, y: 80 });
        const solve = (tiles) => {
            const g = arrivalSolverGoal({ kind: 'exit', level: 2, tiles, name: 'f6' }, { staging, levelSource: SRC, record: SRC(2) });
            const run = createRunForStaging(staging, SRC, { scratchPersistence: true });
            solveSegment({ run, goals: [g.goal], name: 'f6-l2', boot: staging.boot });
            return run;
        };
        expect(solve([[3, 6]]).level).toBe(3);
        expect(() => solve([[3, 1]])).toThrow(/Obstacle: solid:moonrockpile \(moonrockpile@40,16\)/);
    });
});

describe('fidelity F6 — D3 (I03): a pressed ButtonRoom boots its group FADING', () => {
    it('`press` is no longer refused; L20 with {20,4} marks the button bootPressed and latches group 0', () => {
        expect(REFUSED_CLEAR_RESPONSES.press).toBeUndefined();
        expect(persistenceClearsFor(SRC(20)).refused.some((r) => r.tag === 4)).toBe(false);
        const w = buildLevelWorld(SRC(20), { roles: ROLES, cleared: [4] });
        const b = w.pressers.find((p) => p.tag === 'buttonroom');
        expect(b).toMatchObject({ x: 192, y: 16, t: 0, room: -1, flip: false, persistTag: 4, bootPressed: true });
        const st = createActivatorState(w);
        expect([...st.latched]).toEqual([[0, true]]);
        expect([...st.roomWritten]).toEqual(['buttonroom@192,16']);
        // One fade step in at creation: the game's first update of the new world is in the arrival frame.
        expect(st.byId.get('lock@32,80')).toMatchObject({ alpha: 1 - RESPONDERS.lock.fade, held: 1, open: false });
        const fresh = createActivatorState(buildLevelWorld(SRC(20), { roles: ROLES }));
        expect([...fresh.latched]).toEqual([]);
        expect(fresh.byId.get('lock@32,80')).toMatchObject({ alpha: 1, held: 0 });
    });
    it('⛔ a cross-room flip = 0 ButtonRoom that boots pressed is refused by name', () => {
        const w = buildLevelWorld(SRC(20), { roles: ROLES });
        const synthetic = { ...w, pressers: [{ tag: 'buttonroom', x: 1, y: 2, t: 3, room: 9, flip: false, persistTag: 4, bootPressed: true }] };
        expect(() => createActivatorState(synthetic)).toThrow(/cross-room button with flip = 0/);
    });
    it('f6-l20-reentry: the lock opens under the player on the game\'s tick', () => {
        const s = replay('f6-l20-reentry');
        expect(s).toEqual(recorded('f6-l20-reentry'));
        expect(s.transitions).toEqual([{ t: 7, from_level: 13, to_level: 20 }]);
        // The arrival is t7; the fade is `opensOnTick` updates, the first in the arrival frame.
        const moved = s.ticks.findIndex((o, i) => i > 50 && o.y > s.ticks[i - 1].y);
        expect(moved).toBe(7 + opensOnTick(RESPONDERS.lock.fade));
        // CONTROL-L20: without {20,4} the lock never opens — on the game and in the model.
        const c = arm('CONTROL-L20');
        expect(c).toMatchObject({ vsModel: { worst: 0 }, error: '' });
        const m = runTapeToStream(without('f6-l20-reentry', 20, 4), { levelSource: SRC });
        expect(m.ticks.at(-1)).toMatchObject({ level: 20, x: c.last.x, y: c.last.y });
        expect(c.last.y).toBeLessThan(80);
    });
    it('the solver plans L20 from the pressed state: it waits the latched fade out, then crosses to L19', () => {
        const staging = stagingAt({ level: 20, x: 32, y: 48 });
        const g = arrivalSolverGoal({ kind: 'exit', level: 20, tiles: [[12, 3]], name: 'f6' }, { staging, levelSource: SRC, record: SRC(20) });
        const run = createRunForStaging(staging, SRC, { scratchPersistence: true });
        const out = solveSegment({ run, goals: [g.goal], name: 'f6-l20', boot: staging.boot });
        expect(run.level).toBe(19);
        expect(run.playerHits).toEqual([]);
        const row = out.trace.rows.find((r) => r.obstacle?.id === 'lock@32,80');
        expect(row).toMatchObject({ strategy: { verb: 'hold' } });
        expect(row.rejected[0]).toMatchObject({ option: 'presser' });
    });
});

describe('fidelity F6 — D4: the chain-end staging boots in every room I1 measured', () => {
    it.each([2, 13, 16, 17, 20])('L%i boots (I1\'s M3 refused L2, L17 and L20)', (level) => {
        const arrival = { 2: [48, 80], 13: [96, 48], 16: [112, 48], 17: [48, 48], 20: [32, 48] }[level];
        expect(() => createRunForStaging(stagingAt({ level, x: arrival[0], y: arrival[1] }), SRC)).not.toThrow();
    });
});
