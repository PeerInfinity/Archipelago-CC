/**
 * wasmPlayback — solver-walk W2: the host tape a wasm playback ships, the
 * declaration rule it ships under, the mid-room policy, the moonrock / level-0
 * refusal, and the trajectory compare (plan `NewDocs/plans/seedling-js-solver-walk-plan.md`
 * §5.3 W2). The engine that drives them (`flashPanel/seedlingWasmPlayback.js`)
 * has its own file; both read W1's RECORDED arrivals
 * (`fixtures/wasm-arrival-p4e.json`), never a hand-written latch.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    MAX_RECOVERIES, MID_ROOM_POLICY, TAPE_KEY_RELEASES, WasmPlaybackError, divergenceAction, divergenceFailure,
    exactDeclarationRefusal, firstDivergence, foldDrain, goalAction, keysHeldAtReset, shippedTape, wasmGoalRefusal,
} from './wasmPlayback.js';
import { stagingFromWasmArrival } from './wasmArrival.js';
import { parseTape } from './tapeFormat.js';
import { indexLevels } from './atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const RECORDED = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4e.json').arrivals;
const RECORDS = indexLevels(readJson('frontend/modules/flashPanel/atlases/seedling-map.json'));
const HOUSE = 86;
const byLabel = (prefix, level) => RECORDED.find((a) => a.label.startsWith(prefix) && a.status.level === level);
const A = byLabel('A ', HOUSE);
const C = byLabel('C ', HOUSE);
const stage = (a) => stagingFromWasmArrival({ seam: structuredClone(a.seam), status: structuredClone(a.status),
    state: structuredClone(a.state), record: RECORDS.get(a.status.level) }).staging;
const KEYS = [['up'], ['up'], ['up', 'primary'], []];

describe('shippedTape — the tape the game is handed', () => {
    it('boot = this level + the SPAWN (same world), the solve\'s pins, the keys folded tick for tick', () => {
        const t = shippedTape({ staging: stage(A), keys: KEYS });
        expect(t.boot).toEqual({ level: HOUSE, x: A.state.playerPositionX, y: A.state.playerPositionY });
        expect(t.pins).toEqual(['sound', 'dead_frames']);
        expect(t.tick_count).toBe(KEYS.length);
        expect(parseTape(t).tick_count).toBe(KEYS.length);
    });

    it('the seam block is STRIPPED to null — though the solve\'s staging declares the live kit', () => {
        const staging = stage(A);
        expect(staging.seam?.items).toBeTruthy();
        const t = shippedTape({ staging, keys: KEYS });
        expect(t.seam).toBeNull();
    });

    it('the rng is left alone (seed 0, fp 0 = untouched) — the staging\'s seeds are the BEGIN record\'s, not the live stream', () => {
        const staging = stage(A);
        expect(staging.rng.seed).toBe(A.seam.beginEntry['rng.gameplay']);
        // The live stream at the same arrival is NOT the begin record's (the build drew from it):
        expect(A.status.rng.state).not.toBe(A.seam.beginEntry['rng.gameplay']);
        const t = shippedTape({ staging, keys: KEYS });
        expect(t.rng).toEqual({ seed: 0, split: false, cosmetic: 0, fp: 0 });
    });

    it('a SPLIT stream is refused by name (a split botStart resets the cosmetic stream no verb reads)', () => {
        const staging = stage(A);
        staging.rng = { ...staging.rng, split: true };
        expect(() => shippedTape({ staging, keys: [] })).toThrow(WasmPlaybackError);
        expect(() => shippedTape({ staging, keys: [] })).toThrow(/SPLIT/);
    });

    it('ALL THREE save arrays declared, persistence = the live cleared set (C: the chest row + the seal slot value)', () => {
        const t = shippedTape({ staging: stage(C), keys: KEYS });
        expect(Object.keys(t.save).sort()).toEqual(['keys', 'seal_parts', 'totem_parts']);
        expect(t.save.seal_parts).toEqual([C.status.save.seal_parts[0]]);
        expect(t.persistence.map(({ level, tag }) => ({ level, tag }))).toEqual([{ level: HOUSE, tag: 0 }]);
        const tA = shippedTape({ staging: stage(A), keys: KEYS });
        expect(tA.save).toEqual({ totem_parts: [], keys: [], seal_parts: [] });
        expect(tA.persistence).toEqual([]);
    });

    it('hold ONLY when asked: the zero-tick freeze holds, the plan tape ends un-held', () => {
        const freeze = shippedTape({ staging: stage(A), keys: [], hold: true });
        expect(freeze.hold).toBe(true);
        expect(freeze.tick_count).toBe(0);
        expect(parseTape(freeze).hold).toBe(true);
        const plan = shippedTape({ staging: stage(A), keys: KEYS });
        expect(plan.hold).toBeUndefined();
    });

    it('every tape it builds passes its own declaration rule against the arrival it came from', () => {
        for (const a of [A, C]) {
            expect(exactDeclarationRefusal(shippedTape({ staging: stage(a), keys: KEYS }), a.status)).toBeNull();
            expect(exactDeclarationRefusal(shippedTape({ staging: stage(a), keys: [], hold: true }), a.status)).toBeNull();
        }
    });
});

describe('exactDeclarationRefusal — the fake-check rule (W0 ii.5–ii.8)', () => {
    const tapeA = () => shippedTape({ staging: stage(A), keys: KEYS });
    it('an UNEARNED clear (the chest on a fresh room) is refused by name as a FAKE check', () => {
        const t = { ...tapeA(), persistence: [{ level: HOUSE, tag: 0, note: 'x' }] };
        expect(exactDeclarationRefusal(t, A.status)).toMatch(/FAKE check/);
    });
    it('an OMITTED earned clear is refused (botStart would RESTORE the chest)', () => {
        const t = { ...shippedTape({ staging: stage(C), keys: KEYS }), persistence: [] };
        expect(exactDeclarationRefusal(t, C.status)).toMatch(/omits.*RESTORE/);
    });
    it('an omitted or wrong save array is refused (botStart WIPES an omitted one)', () => {
        const tC = shippedTape({ staging: stage(C), keys: KEYS });
        expect(exactDeclarationRefusal({ ...tC, save: { keys: [], totem_parts: [] } }, C.status)).toMatch(/omits save.seal_parts/);
        expect(exactDeclarationRefusal({ ...tC, save: { ...tC.save, seal_parts: [] } }, C.status)).toMatch(/seal_parts/);
    });
    it('a declared seam, a re-seeded rng, a mismatched split, another level — each refused', () => {
        const t = tapeA();
        expect(exactDeclarationRefusal({ ...t, seam: { time: 1 } }, A.status)).toMatch(/seam/);
        expect(exactDeclarationRefusal({ ...t, rng: { ...t.rng, seed: 5 } }, A.status)).toMatch(/re-seeds/);
        expect(exactDeclarationRefusal({ ...t, rng: { ...t.rng, split: true } }, A.status)).toMatch(/split/);
        expect(exactDeclarationRefusal({ ...t, boot: { ...t.boot, level: 0 } }, A.status)).toMatch(/same world/);
    });
});

describe('wasmGoalRefusal — the rooms the wasm runtime cannot stage', () => {
    it('LEVEL 0 (the overworld hub) is REFUSED by name: it holds a moonrock, which reads beam/rockSet', () => {
        const why = wasmGoalRefusal({ level: 0 }, RECORDS.get(0));
        expect(why).toMatch(/level 0 holds a moonrock/);
        expect(why).toMatch(/save\.(beam|rockSet)/);
    });
    it('the Starting House stages; a room not loaded yet gives no verdict; an unknown level is named', () => {
        expect(wasmGoalRefusal({ level: HOUSE }, RECORDS.get(HOUSE))).toBeNull();
        expect(wasmGoalRefusal({ level: HOUSE }, undefined)).toBeNull();
        expect(wasmGoalRefusal({ level: 999 }, null)).toMatch(/no level 999/);
    });
});

describe('goalAction — the mid-room policy', () => {
    it(`a goal in the room the player is in → ${MID_ROOM_POLICY}; another room → wait for the arrival; a tape playing → queue`, () => {
        expect(MID_ROOM_POLICY).toBe('forced-re-arrival');
        expect(goalAction({ goal: { level: HOUSE }, liveLevel: HOUSE })).toBe('force-re-arrival');
        expect(goalAction({ goal: { level: HOUSE }, liveLevel: 0 })).toBe('await-arrival');
        expect(goalAction({ goal: { level: HOUSE }, liveLevel: HOUSE, playing: true })).toBe('queue');
        expect(goalAction({ goal: { level: HOUSE }, liveLevel: 0, playing: true })).toBe('queue');
    });
});

describe('foldDrain + firstDivergence — the W3 compare, recorded only', () => {
    const expected = [{ level: 86, x: 56, y: 56 }, { level: 86, x: 56, y: 55 }, { level: 86, x: 56, y: 54 }, { level: 0, x: 168, y: 296 }];
    it('drain row t is the row BEFORE tick t (measured: 102 ticks drain 103 rows) — expected[t]', () => {
        const p = foldDrain(foldDrain(null, { ticks: [{ t: 0, level: 86, x: 56, y: 56 }] }),
            { ticks: [{ t: 1, level: 86, x: 56, y: 55 }, { t: 2, level: 86, x: 56, y: 54 }] });
        expect(p.ticks).toBe(3);
        expect(firstDivergence(expected, p.rows, { roomLevel: 86 })).toBeNull();
    });
    it('the first off-plan row is named with both sides', () => {
        const rows = [{ t: 0, level: 86, x: 56, y: 56 }, { t: 1, level: 86, x: 57, y: 55 }];
        expect(firstDivergence(expected, rows, { roomLevel: 86 })).toEqual({ t: 1,
            expected: { level: 86, x: 56, y: 55 }, got: { level: 86, x: 57, y: 55 } });
    });
    it('a crossing is "left the room": the glue\'s redirect level agrees with the plan\'s vanilla target', () => {
        const rows = [{ t: 3, level: 71, x: 10, y: 10 }];
        expect(firstDivergence(expected, rows, { roomLevel: 86 })).toBeNull();
        expect(firstDivergence(expected, [{ t: 2, level: 71, x: 10, y: 10 }], { roomLevel: 86 })).not.toBeNull();
    });
});

describe('divergenceAction / divergenceFailure — W3\'s recovery policy (⚖ W-Q3: bounded 3, then by name)', () => {
    const CHEST = { kind: 'location', level: HOUSE, tag: 0, name: 'Starting House - Chest' };
    const DOOR = { kind: 'exit', level: HOUSE, tiles: [[3, 4]], name: 'exit_S' };
    const open = { persistence_cleared: [{ level: HOUSE, tag: 0 }] };
    it('recover while recoveries < MAX_RECOVERIES (3), fail at 3', () => {
        expect(MAX_RECOVERIES).toBe(3);
        expect([0, 1, 2, 3, 4].map((recoveries) => divergenceAction({ goal: DOOR, recoveries })))
            .toEqual(['recover', 'recover', 'recover', 'fail', 'fail']);
    });
    it('a location whose clear already landed is DONE (even at the bound); a different clear, or an exit, is not', () => {
        expect(divergenceAction({ goal: CHEST, recoveries: 0, status: open })).toBe('done');
        expect(divergenceAction({ goal: CHEST, recoveries: 3, status: open })).toBe('done');
        expect(divergenceAction({ goal: { ...CHEST, tag: 1 }, recoveries: 0, status: open })).toBe('recover');
        expect(divergenceAction({ goal: DOOR, recoveries: 0, status: open })).toBe('recover');
        expect(divergenceAction({ goal: CHEST, recoveries: 0, status: null })).toBe('recover');
    });
    it('the failure names the goal, the count, the bound and the last divergence', () => {
        const msg = divergenceFailure({ goal: CHEST, recoveries: 3,
            divergence: { t: 7, expected: { level: HOUSE, x: 56, y: 50 }, got: { level: HOUSE, x: 58, y: 50 } } });
        expect(msg).toBe('the game left the plan 4 times on Starting House - Chest in level 86 (gave up after 3 forced '
            + 're-arrivals, the bound is 3); last at tick 7: expected {"level":86,"x":56,"y":50}, game {"level":86,"x":58,"y":50}');
    });
});

describe('keysHeldAtReset — the keys a mid-span botReset would leave held (W3, measured)', () => {
    const sol = [['up'], ['up'], ['up', 'primary'], ['primary'], []];
    const st = (tick, held, extra = {}) => ({ armed: true, finished: false, tick, input: { t: tick - 1, held }, ...extra });
    it('at tick T the tape holds solution[T-1]: echo-held AND plan-held there', () => {
        expect(keysHeldAtReset({ status: st(1, ['up']), solution: sol })).toEqual(['up']);
        expect(keysHeldAtReset({ status: st(3, ['up', 'primary']), solution: sol })).toEqual(['up', 'primary']);
        // the measured case: the plan changes keys on the NEXT tick — the key is still held now
        expect(keysHeldAtReset({ status: st(3, ['up', 'primary']), solution: [...sol.slice(0, 3), ['down']] })).toEqual(['up', 'primary']);
        expect(keysHeldAtReset({ status: st(4, ['primary']), solution: sol })).toEqual(['primary']);
        expect(keysHeldAtReset({ status: st(5, []), solution: sol })).toEqual([]);
    });
    it('a key only a person holds, or one the echo does not report, is left alone (a pair would be a fresh PRESS)', () => {
        expect(keysHeldAtReset({ status: st(1, ['up', 'right']), solution: sol })).toEqual(['up']);
        expect(keysHeldAtReset({ status: st(2, []), solution: sol })).toEqual([]);
    });
    it('nothing for a finished / un-armed tape, tick 0, a tick past the plan, or no plan', () => {
        expect(keysHeldAtReset({ status: st(1, ['up'], { finished: true }), solution: sol })).toEqual([]);
        expect(keysHeldAtReset({ status: st(1, ['up'], { armed: false }), solution: sol })).toEqual([]);
        expect(keysHeldAtReset({ status: st(0, ['up']), solution: sol })).toEqual([]);
        expect(keysHeldAtReset({ status: st(6, ['up']), solution: sol })).toEqual([]);
        expect(keysHeldAtReset({ status: st(1, ['up']), solution: null })).toEqual([]);
        expect(keysHeldAtReset({ status: null, solution: sol })).toEqual([]);
    });
    it('the eight names are Bot.keyCodeFor\'s, with their Flash key codes', () => {
        expect(TAPE_KEY_RELEASES.map((k) => [k.name, k.keyCode])).toEqual([['right', 39], ['up', 38], ['left', 37], ['down', 40],
            ['primary', 88], ['secondary', 67], ['inventory', 86], ['inventory2', 73]]);
    });
});
