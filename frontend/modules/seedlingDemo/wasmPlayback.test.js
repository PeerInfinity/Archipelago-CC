/**
 * wasmPlayback — solver-walk W2: the host tape a wasm playback ships, the
 * declaration rule it ships under, the mid-room policy, the moonrock / level-0 (⛓ W5: staged, no longer refused)
 * refusal, and the trajectory compare (solver-walk W2). The engine that drives them (`flashPanel/seedlingWasmPlayback.js`)
 * has its own file; both read W1's RECORDED arrivals
 * (`fixtures/wasm-arrival-p4f.json`), never a hand-written latch.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    adoptedClockStaging,
    FALLBACK_POLICY, MAX_RECOVERIES, MID_ROOM_POLICY, SHIPPED_RNG, TAPE_KEY_RELEASES, WasmPlaybackError, divergenceAction, divergenceFailure, divergenceRepeatFailure, isExactRepeat,
    exactDeclarationRefusal, firstDivergence, foldDrain, goalAction, keysHeldAtReset, shippedTape, wasmGoalRefusal,
    arrivalHoldBlocker, queuedSwapPush, endsHeld, liveDeclarations, primarySplitRefusal, shadowMismatch,
    ADOPT_CLAUSES, INERT_MOBILES, adoptionRefusal, inertMobilesRefusal, talkCircleGuard, talkCirclesAt,
    newGameBeginEntry, newGameCeremony, TUTORIAL_DISMISS_KEY,
} from './wasmPlayback.js';
import { stagingFromWasmArrival } from './wasmArrival.js';
import { parseTape } from './tapeFormat.js';
import { indexLevels } from './atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const RECORDED = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4f.json').arrivals;
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

    it('the rng is left alone (seed 0, fp 0 = untouched) — the staging\'s seed is the BEGIN record\'s, not the live stream; no fp is staged', () => {
        const staging = stage(A);
        expect(staging.rng.seed).toBe(A.seam.beginEntry['rng.gameplay']);
        // ⛓ FP REQUEST — fp is FlashPunk's LCG (waterfall particles only, not solver input): never staged.
        expect(staging.rng).not.toHaveProperty('fp');
        // ⛓ p4f (seedling-wasm-leak L4 3′b): tapeless play runs SPLIT by default, so this
        // room's build drew only from the COSMETIC generator and the live gameplay stream
        // still equals the begin record (on p4e the build's tile draws had moved it).
        // The staging takes the begin record either way, which is the property pinned here.
        expect(A.status.rng.state).toBe(A.seam.beginEntry['rng.gameplay']);
        const t = shippedTape({ staging, keys: KEYS });
        expect(t.rng).toEqual({ seed: 0, split: true, cosmetic: 0, fp: 0 });
        expect(t.rng).toEqual(SHIPPED_RNG);
    });

    it('the COSMETIC split is declared ON whatever botStatus echoes (the echo is the last tape\'s flag, not the live one)', () => {
        // p4f (3′b): tapeless play runs split; `botStatus.rng.split` echoes `Bot.rngSplit`, false after botReset.
        expect(A.status.rng.split).toBe(false);
        for (const split of [false, true]) {
            const staging = stage(A);
            staging.rng = { ...staging.rng, split };
            const t = shippedTape({ staging, keys: [] });
            expect(t.rng.split).toBe(true);
            expect(exactDeclarationRefusal(t, A.status)).toBeNull();
            expect(exactDeclarationRefusal(t, { ...A.status, rng: { ...A.status.rng, split: true } })).toBeNull();
        }
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
    it('a declared seam, a re-seeded rng, an UNSPLIT stream, a declared cosmetic state, another level — each refused', () => {
        const t = tapeA();
        expect(exactDeclarationRefusal({ ...t, seam: { time: 1 } }, A.status)).toMatch(/seam/);
        expect(exactDeclarationRefusal({ ...t, rng: { ...t.rng, seed: 5 } }, A.status)).toMatch(/re-seeds/);
        expect(exactDeclarationRefusal({ ...t, rng: { ...t.rng, split: false } }, A.status)).toMatch(/split false/);
        expect(exactDeclarationRefusal({ ...t, rng: { ...t.rng, cosmetic: 7 } }, A.status)).toMatch(/cosmetic 7/);
        expect(exactDeclarationRefusal({ ...t, boot: { ...t.boot, level: 0 } }, A.status)).toMatch(/same world/);
    });
});

describe('wasmGoalRefusal — the rooms the wasm runtime cannot stage', () => {
    it('⛓ W5 — LEVEL 0 (the overworld hub) is NOT refused: its moonrock\'s beam/rockSet come off readState now', () => {
        expect((RECORDS.get(0)?.entities ?? []).some((e) => e.type === 'moonrock')).toBe(true);
        expect(wasmGoalRefusal({ level: 0 }, RECORDS.get(0))).toBeNull();
    });
    it('the Starting House stages; a room not loaded yet gives no verdict; an unknown level is named', () => {
        expect(wasmGoalRefusal({ level: HOUSE }, RECORDS.get(HOUSE))).toBeNull();
        expect(wasmGoalRefusal({ level: HOUSE }, undefined)).toBeNull();
        expect(wasmGoalRefusal({ level: 999 }, null)).toMatch(/no level 999/);
    });
});

describe('goalAction — the mid-room policy', () => {
    it(`⛓ W7 — a goal in the room the engine HOLDS → ${MID_ROOM_POLICY}; in the room but nothing held (the cold start) → ${FALLBACK_POLICY}; another room → wait for the arrival; a tape playing → queue`, () => {
        expect(MID_ROOM_POLICY).toBe('continuation');
        expect(FALLBACK_POLICY).toBe('forced-re-arrival');
        expect(goalAction({ goal: { level: HOUSE }, liveLevel: HOUSE, heldLevel: HOUSE })).toBe('continue');
        expect(goalAction({ goal: { level: HOUSE }, liveLevel: HOUSE, heldLevel: HOUSE, playing: true })).toBe('queue');
        expect(goalAction({ goal: { level: HOUSE }, liveLevel: 0, heldLevel: 0 })).toBe('await-arrival');
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

describe('⛓ W4 — an EXACT repeat fails fast (isExactRepeat, divergenceAction → repeat, divergenceRepeatFailure)', () => {
    const DOOR = { kind: 'exit', level: HOUSE, tiles: [[3, 4]], name: 'exit_S' };
    const CHEST = { kind: 'location', level: HOUSE, tag: 0, name: 'Starting House - Chest' };
    const d = (t, x, y = 50) => ({ t, expected: { level: HOUSE, x: 56, y: 50 }, got: { level: HOUSE, x, y } });
    it('the same tick and the same game row (===) is a repeat; another tick, x, y, level or no previous is not', () => {
        expect(isExactRepeat(d(54, 58.1), d(54, 58.1))).toBe(true);
        expect(isExactRepeat(d(54, 58.1), d(55, 58.1))).toBe(false);
        expect(isExactRepeat(d(54, 58.1), d(54, 58.1 + 1e-14))).toBe(false);
        expect(isExactRepeat(d(54, 58.1), d(54, 58.1, 51))).toBe(false);
        expect(isExactRepeat(d(54, 58.1), { ...d(54, 58.1), got: { level: 0, x: 58.1, y: 50 } })).toBe(false);
        expect(isExactRepeat(null, d(54, 58.1))).toBe(false);
        expect(isExactRepeat(d(54, 58.1), null)).toBe(false);
        // the EXPECTED side is the plan's — a re-solve may plan differently; only the game's row decides
        expect(isExactRepeat(d(54, 58.1), { ...d(54, 58.1), expected: { level: HOUSE, x: 0, y: 0 } })).toBe(true);
    });
    it('divergenceAction: the first divergence recovers, its exact repeat → repeat (before the bound); a new one recovers', () => {
        expect(divergenceAction({ goal: DOOR, recoveries: 0, divergence: d(54, 58.1), previous: null })).toBe('recover');
        expect(divergenceAction({ goal: DOOR, recoveries: 1, divergence: d(54, 58.1), previous: d(54, 58.1) })).toBe('repeat');
        expect(divergenceAction({ goal: DOOR, recoveries: 1, divergence: d(60, 58.1), previous: d(54, 58.1) })).toBe('recover');
        expect(divergenceAction({ goal: DOOR, recoveries: 3, divergence: d(60, 58.1), previous: d(54, 58.1) })).toBe('fail');
        // a landed clear still wins: the goal is done whatever the divergence was
        expect(divergenceAction({ goal: CHEST, recoveries: 1, status: { persistence_cleared: [{ level: HOUSE, tag: 0 }] },
            divergence: d(54, 58.1), previous: d(54, 58.1) })).toBe('done');
    });
    it('the repeat failure names the goal, the attempts, the tick and both rows', () => {
        expect(divergenceRepeatFailure({ goal: DOOR, recoveries: 1, divergence: d(54, 58.1) })).toBe(
            'the game left the plan on exit_S in level 86 at the SAME tick with the SAME game row 2 times in a row (gave up '
            + 'after 1 forced re-arrival: an exact repeat is a deterministic model/game residue, which a re-solve from the '
            + 'same arrival replays); at tick 54: expected {"level":86,"x":56,"y":50}, game {"level":86,"x":58.1,"y":50}');
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

// ── ⛓ W7 — keep the room still between goals: the continuation's pure rules ───────────────

describe('W7 — endsHeld + liveDeclarations', () => {
    it('a LOCATION plan ends held; an exit never does (its crossing must reach the glue, W0 i.11)', () => {
        expect(endsHeld({ kind: 'location' })).toBe(true);
        expect(endsHeld({ kind: 'exit' })).toBe(false);
        expect(endsHeld(null)).toBe(false);
    });
    it('the arrival staging re-declared LIVE: A\'s staging + C\'s botStatus (the chest since opened) passes C\'s declaration rule; A\'s own does not', () => {
        const live = liveDeclarations(stage(A), C.status);
        expect(live.boot).toEqual(stage(A).boot); // the model's start is the ARRIVAL's
        expect(live.persistence).toEqual([{ level: HOUSE, tag: 0 }]);
        expect(live.save.seal_parts).toEqual([C.status.save.seal_parts[0]]);
        expect(exactDeclarationRefusal(shippedTape({ staging: live, keys: KEYS }), C.status)).toBeNull();
        expect(exactDeclarationRefusal(shippedTape({ staging: stage(A), keys: KEYS }), C.status)).toMatch(/omits/);
        expect(() => liveDeclarations(stage(A), null)).toThrow(WasmPlaybackError);
    });
});

describe('W7 — the X-split rule (primarySplitRefusal)', () => {
    it('X held at the previous end AND pressed on the continuation\'s first tick → refused (the finish released it: a fresh press = a swing)', () => {
        expect(primarySplitRefusal([['up'], ['primary']], [['primary', 'up']])).toMatch(/X-split rule/);
    });
    it('anything else ships: X not held at the end, X not on the first tick, a movement key across the seam, nothing shipped', () => {
        expect(primarySplitRefusal([['primary'], ['up']], [['primary']])).toBeNull();
        expect(primarySplitRefusal([['primary']], [['up'], ['primary']])).toBeNull();
        expect(primarySplitRefusal([['right']], [['right']])).toBeNull();
        expect(primarySplitRefusal([], [['primary']])).toBeNull();
    });
});

describe('W7 — shadowMismatch: the held game against the shadow, to the bit', () => {
    it('equal level/x/y → null; any difference (1e-15 px included) → both rows', () => {
        const row = { level: HOUSE, x: 56, y: 34.55, deaths: 0 };
        expect(shadowMismatch(row, { level: HOUSE, x: 56, y: 34.55 })).toBeNull();
        expect(shadowMismatch(row, { level: HOUSE, x: 56 + 1e-14, y: 34.55 })).toEqual({ expected: { level: HOUSE, x: 56, y: 34.55 },
            got: { level: HOUSE, x: 56 + 1e-14, y: 34.55 } });
        expect(shadowMismatch(row, { level: 0, x: 56, y: 34.55 })).not.toBeNull();
        expect(shadowMismatch(row, null)).not.toBeNull();
    });
});

describe('W7 — arrivalHoldBlocker: the glue query, its three arms', () => {
    const be = { 'begin.level': HOUSE, 'save.time': 4910 };
    it('nothing in flight → hold (null); no glue to ask → hold', () => {
        expect(arrivalHoldBlocker({ marks: [], queued: 0, pushedOn: null }, be)).toBeNull();
        expect(arrivalHoldBlocker(null, be)).toBeNull();
    });
    it('arm 1 MARKS: the binding waits on a swap (or is parked) → not held', () => {
        expect(arrivalHoldBlocker({ marks: ['bounce from level 86'], queued: 0 }, be)).toMatch(/waits on a swap \(bounce from level 86\)/);
    });
    it('arm 2 QUEUED: a teleport waits in the adapter\'s invoke queue → not held (measured: the redirect is pushed ~0.4 s after the door)', () => {
        expect(arrivalHoldBlocker({ marks: [], queued: 1 }, be)).toMatch(/1 teleport\(s\) queued/);
    });
    it('arm 3 PUSHED ON THIS BEGIN: a teleport pushed while this begin record was live lands next → not held; one stamped with an EARLIER record has landed', () => {
        expect(arrivalHoldBlocker({ marks: [], queued: 0, pushedOn: { ...be } }, be)).toMatch(/pushed to the game after this arrival/);
        expect(arrivalHoldBlocker({ marks: [], queued: 0, pushedOn: { ...be, 'save.time': 4800 } }, be)).toBeNull();
        expect(arrivalHoldBlocker({ marks: [], queued: 0, pushedOn: null }, be)).toBeNull();
    });
});

describe('⛓ ARRIVAL JITTER — queuedSwapPush: push the glue\'s queued teleport in the turn its door landed', () => {
    const be = { 'begin.level': HOUSE, 'save.time': 4910 };
    it('a teleport queued → push; `late` iff the door\'s room stepped before the watch saw it', () => {
        expect(queuedSwapPush({ marks: [], queued: 1, pushedOn: null }, { stepped: 0 }, be)).toEqual({ push: true, late: false });
        expect(queuedSwapPush({ marks: [], queued: 2, pushedOn: { ...be, 'save.time': 4800 } }, { stepped: 0 }, be)).toEqual({ push: true, late: false });
        expect(queuedSwapPush({ marks: [], queued: 1 }, { stepped: 3 }, be)).toEqual({ push: true, late: true });
        expect(queuedSwapPush({ marks: [], queued: 1 }, null, be)).toEqual({ push: true, late: true }); // no reading = not provably unstepped
    });
    it('a binding MARK beside the queue (a cross-level arrival\'s echo) still pushes: the push serves that swap', () => {
        expect(queuedSwapPush({ marks: ['arrival teleport to level 86'], queued: 1 }, { stepped: 0 }, be)).toEqual({ push: true, late: false });
    });
    it('nothing queued, PARKED, or a push already stamped on THIS begin → null (no glue → null)', () => {
        expect(queuedSwapPush({ marks: [], queued: 0 }, { stepped: 0 }, be)).toBeNull();
        expect(queuedSwapPush({ marks: ['arrival teleport to level 86'], queued: 0 }, { stepped: 0 }, be)).toBeNull();
        expect(queuedSwapPush({ marks: ['parked'], queued: 1 }, { stepped: 0 }, be)).toBeNull();
        expect(queuedSwapPush({ marks: [], queued: 1, pushedOn: { ...be } }, { stepped: 0 }, be)).toBeNull();
        expect(queuedSwapPush(null, { stepped: 0 }, be)).toBeNull();
    });
});

describe('⛓ W8b — level 0\'s inert NPC Mobiles (introchar, statue2) are ADMITTED by the adoption, each check live', () => {
    const L0 = RECORDS.get(0);
    // The live `botMobiles` rows at an untouched level-0 cold start (measured, plan §5.14).
    const PLAYER = { cls: 'Player', x: 80, y: 128, vx: 0, vy: 0, anim: 'down-stand' };
    const INTRO = { cls: 'NPCs::IntroCharacter', x: 152, y: 296, vx: 0, vy: 0, type: 'Solid', destroy: false, collidable: true, anim: '' };
    const STATUE = { cls: 'NPCs::Statue', x: 208, y: 160, vx: 0, vy: 0, type: 'Solid', destroy: false, collidable: true, anim: '' };
    const SHADOW = { x: 80, y: 128, direction: 3 };
    const BEGIN = { 'begin.level': 0, 'save.time': 100 };
    const STATUS = { level: 0, game_time: 400, x: 80, y: 128, inventory_slots: [], hits: 0, hits_timer: 0, drown_timer: 0, frozen_timer: 0,
        receive_input: true, menu: false, cutscene: [] };
    const refusal = (rows, o = {}) => adoptionRefusal({ beginEntry: BEGIN, status: { ...STATUS, ...o.status }, mobiles: { mobiles: rows },
        record: o.record ?? L0, shadow: o.shadow ?? SHADOW, state: { freezeObjects: false, ...o.state } });
    const clauseOf = (rows, o) => refusal(rows, o)?.clause ?? null;

    it('the record holds exactly the two admitted NPCs, and the inert clauses sit between MOBILES and TIMED', () => {
        expect(L0.entities.filter((e) => Object.values(INERT_MOBILES).some((s) => s.types.includes(e.type))).map((e) => e.type).sort())
            .toEqual(['introchar', 'statue2']);
        expect(ADOPT_CLAUSES.slice(ADOPT_CLAUSES.indexOf('mobiles'), ADOPT_CLAUSES.indexOf('timed')))
            .toEqual(['mobiles', 'inert-velocity', 'inert-position', 'inert-idle', 'inert-talk']);
    });
    it('untouched: ADOPTED (no clause refuses)', () => {
        expect(refusal([STATUE, INTRO, PLAYER])).toBeNull();
    });
    it('⛓ W8c — clause FREEZE sits right after PLAYER-STATE', () => {
        expect(ADOPT_CLAUSES.slice(ADOPT_CLAUSES.indexOf('player-state'), ADOPT_CLAUSES.indexOf('player-state') + 2)).toEqual(['player-state', 'freeze']);
    });
    it('⛓ W8c — clause FREEZE — a freeze no botStatus row shows (a Help, a dialogue) refuses, and so does a bridge that does not report it', () => {
        expect(clauseOf([STATUE, INTRO, PLAYER], { state: { freezeObjects: true } })).toBe('freeze');
        expect(refusal([STATUE, INTRO, PLAYER], { state: { freezeObjects: true } }).why).toMatch(/DEAD/);
        expect(clauseOf([STATUE, INTRO, PLAYER], { state: { freezeObjects: undefined } })).toBe('freeze');
        expect(refusal([STATUE, INTRO, PLAYER], { state: { freezeObjects: undefined } }).why).toMatch(/cannot be ruled out/);
    });
    it('MOBILES — a class that is not admitted (an Enemy beside the NPCs) still refuses', () => {
        expect(clauseOf([STATUE, INTRO, PLAYER, { cls: 'Enemies::Bob', x: 10, y: 10, vx: 0, vy: 0 }])).toBe('mobiles');
    });
    it('INERT-VELOCITY — an NPC with v ≠ 0', () => {
        expect(clauseOf([STATUE, { ...INTRO, vx: 0.25 }, PLAYER])).toBe('inert-velocity');
    });
    it('INERT-POSITION — an NPC off its record position (1 px), or a second row on one entity', () => {
        expect(clauseOf([{ ...STATUE, x: 209 }, INTRO, PLAYER])).toBe('inert-position');
        expect(clauseOf([STATUE, INTRO, { ...INTRO }, PLAYER])).toBe('inert-position');
        expect(inertMobilesRefusal({ rows: [INTRO], record: RECORDS.get(HOUSE), shadow: SHADOW })?.clause).toBe('inert-position');
    });
    it('INERT-IDLE — introchar playing "talk", a destroyed or uncollidable row', () => {
        expect(clauseOf([STATUE, { ...INTRO, anim: 'talk' }, PLAYER])).toBe('inert-idle');
        expect(clauseOf([{ ...STATUE, destroy: true }, INTRO, PLAYER])).toBe('inert-idle');
        expect(clauseOf([STATUE, { ...INTRO, collidable: false }, PLAYER])).toBe('inert-idle');
    });
    it('INERT-TALK — a Statue (no talk animation) inside ITS circle refuses, and its circle is 32, not NPC\'s 24', () => {
        const near = (x, y) => ({ shadow: { x, y, direction: 3 }, status: { x, y } });
        // 25.3 px from the statue's centre: outside 24, inside Statue.as:25's 32 (measured live: the game opens the dialogue there).
        expect(clauseOf([STATUE, INTRO, { ...PLAYER, x: 200, y: 136 }], near(200, 136))).toBe('inert-talk');
        expect(clauseOf([STATUE, INTRO, { ...PLAYER, x: 200, y: 120 }], near(200, 120))).toBeNull();
        expect(INERT_MOBILES['NPCs::Statue']).toMatchObject({ talkRange: 32, talkAnim: null });
        expect(INERT_MOBILES['NPCs::IntroCharacter']).toMatchObject({ talkRange: 24, talkAnim: 'talk' });
    });
    it('the seedling_atlas cold start (168,296), 16 px from introchar: ADMITTED (its open dialogue shows as anim "talk"), the circle recorded', () => {
        const at = { shadow: { x: 168, y: 296, direction: 3 }, status: { x: 168, y: 296 } };
        expect(refusal([STATUE, INTRO, { ...PLAYER, x: 168, y: 296 }], at)).toBeNull();
        expect(clauseOf([STATUE, { ...INTRO, anim: 'talk' }, { ...PLAYER, x: 168, y: 296 }], at)).toBe('inert-idle');
        expect(talkCirclesAt([STATUE, INTRO, PLAYER], { x: 168, y: 296 })).toEqual([{ cls: 'NPCs::IntroCharacter', x: 152, y: 296, talkRange: 24 }]);
        expect(talkCirclesAt([STATUE, INTRO, PLAYER], { x: 80, y: 128 })).toEqual([]);
    });
});

describe('⛓ W8b — talkCircleGuard: adopted inside a talk circle, no X until the plan has left it (`talked` is unread)', () => {
    const CIRCLE = [{ cls: 'NPCs::IntroCharacter', x: 152, y: 296, talkRange: 24 }];
    const walkOut = Array.from({ length: 12 }, (_, i) => ({ x: 168 + 2 * i, y: 296 })); // leaves (d > 24) at row 5: x 178
    it('a plan with no X: no refusal, and the rows LEAVE the circle (the guard is spent)', () => {
        expect(talkCircleGuard({ circles: CIRCLE, solution: Array(11).fill(['right']), expected: walkOut })).toEqual({ refusal: null, left: true });
    });
    it('X while still inside, or on the tick right after the first row outside → refused by name', () => {
        for (const t of [0, 3, 5, 6]) {
            const sol = Array(11).fill(['right']).map((k, i) => (i === t ? ['right', 'primary'] : k));
            expect(talkCircleGuard({ circles: CIRCLE, solution: sol, expected: walkOut }).refusal).toMatch(new RegExp(`X \\(primary\\) at tick ${t}, .*talked`));
        }
    });
    it('X once two ticks past the exit: allowed', () => {
        const sol = Array(11).fill(['right']).map((k, i) => (i === 7 ? ['primary'] : k));
        expect(talkCircleGuard({ circles: CIRCLE, solution: sol, expected: walkOut }).refusal).toBeNull();
    });
    it('a plan that never leaves the circle: X anywhere is refused, and the guard is NOT spent', () => {
        const stay = Array(6).fill({ x: 168, y: 296 });
        expect(talkCircleGuard({ circles: CIRCLE, solution: Array(5).fill([]), expected: stay })).toEqual({ refusal: null, left: false });
        expect(talkCircleGuard({ circles: CIRCLE, solution: [[], [], [], [], ['primary']], expected: stay }).refusal).toMatch(/tick 4/);
    });
});

describe('⛓ W8c — the new-game arm\'s cold start (seedling_playthrough): its −1 begin record, its ceremony, the FREEZE clause', () => {
    // Measured live (plan §5.15): the host's level-set reset boots `new Game(-1, 16, 128)`; the record latches
    // BEFORE `applyStart` resolves the level (`Game.as:741` vs `:832-840`).
    const ARM = { 'begin.level': -1, 'begin.tick': 0, 'rng.gameplay': 98141226, 'rng.cosmetic': 0, 'fp.seed': 1861733589, 'save.time': 4803 };
    const L0_STATUS = { level: 0, cutscene: [false, false, false, false], receive_input: true, menu: false };

    it('the −1 record resolves to the set\'s start level when the game stands in it, every other field kept', () => {
        expect(newGameBeginEntry(ARM, { status: L0_STATUS, startLevel: 0 })).toEqual({ ...ARM, 'begin.level': 0 });
    });
    it('…and only then: a real record, no start level, or a game standing elsewhere → null', () => {
        expect(newGameBeginEntry({ ...ARM, 'begin.level': 0 }, { status: L0_STATUS, startLevel: 0 })).toBeNull();
        expect(newGameBeginEntry(ARM, { status: L0_STATUS, startLevel: undefined })).toBeNull();
        expect(newGameBeginEntry(ARM, { status: L0_STATUS, startLevel: -1 })).toBeNull();
        expect(newGameBeginEntry(ARM, { status: { ...L0_STATUS, level: 13 }, startLevel: 0 })).toBeNull();
        expect(newGameBeginEntry(null, { status: L0_STATUS, startLevel: 0 })).toBeNull();
    });
    it('the ceremony: the wind cutscene → wait; the arrow-key tutorial (a freeze, input accepted) → dismiss; else none', () => {
        expect(newGameCeremony({ status: { ...L0_STATUS, cutscene: [true, false, false, false], receive_input: false }, state: { freezeObjects: true } })).toBe('cutscene');
        expect(newGameCeremony({ status: L0_STATUS, state: { freezeObjects: true } })).toBe('tutorial');
        expect(newGameCeremony({ status: { ...L0_STATUS, menu: true }, state: { freezeObjects: true } })).toBeNull();
        expect(newGameCeremony({ status: L0_STATUS, state: { freezeObjects: false } })).toBeNull();
        expect(TUTORIAL_DISMISS_KEY).toBe('right'); // `Help.as:23` keys[2] = RIGHT, UP, LEFT, DOWN
    });
});

describe('⛓ KEY DELIVERY — a tape declares the game\'s keys ∪ the AP-granted ones (the host channel), never fewer', () => {
    const bools = (idx) => Array.from({ length: 5 }, (_, i) => idx.includes(i));
    const withKeys = (a, idx) => ({ ...structuredClone(a.status), save: { ...a.status.save, keys: bools(idx) } });

    it('liveDeclarations: the game holds key 3 (picked up in play), AP granted key 0 → the tape declares [0, 3]', () => {
        const st = withKeys(A, [3]);
        expect(liveDeclarations(stage(A), st, { granted: { keys: [0] } }).save.keys).toEqual([0, 3]);
        expect(liveDeclarations(stage(A), st).save.keys).toEqual([3]);          // nothing granted: exactly the game's, as before
        expect(liveDeclarations(stage(A), st, { granted: { keys: [3] } }).save.keys).toEqual([3]);
    });

    it('exactDeclarationRefusal: the union passes WITH the grant, is refused without it, and dropping the game\'s own key is refused either way', () => {
        const st = withKeys(A, [3]);
        const tape = (keys) => ({ ...shippedTape({ staging: stage(A), keys: [], hold: true }), save: { ...stage(A).save, keys } });
        expect(exactDeclarationRefusal(tape([0, 3]), st, { granted: { keys: [0] } })).toBeNull();
        expect(exactDeclarationRefusal(tape([0, 3]), st)).toMatch(/save\.keys \[0,3\] is not the game's \[3\]/);
        expect(exactDeclarationRefusal(tape([0]), st, { granted: { keys: [0] } })).toMatch(/save\.keys \[0\] is not the game's \[0,3\]/);
        expect(exactDeclarationRefusal(tape([3]), st, { granted: { keys: [] } })).toBeNull();
    });
});

describe('⛓ WALK IDENTITY (a) — adoptedClockStaging: the adopted shadow put on the HELD clock (a read, never a write)', () => {
    const staging = { boot: { level: 0, x: 1, y: 2 }, seam: { time: 4801, primary: 0 }, save: { keys: [] } };
    it('shifts seam.time by live − model, and nothing else', () => {
        const out = adoptedClockStaging({ staging, modelTime: 4823, liveTime: 4853 });
        expect(out.shift).toBe(30);
        expect(out.staging).toEqual({ ...staging, seam: { time: 4831, primary: 0 } });
        expect(staging.seam.time).toBe(4801); // the input is not mutated
    });
    it('a shadow already on the clock shifts by 0', () => {
        expect(adoptedClockStaging({ staging, modelTime: 4823, liveTime: 4823 })).toMatchObject({ shift: 0, staging: { seam: { time: 4801 } } });
    });
    it.each([
        [{ staging: { ...staging, seam: null }, modelTime: 1, liveTime: 2 }, /declares no seam.time/],
        [{ staging, modelTime: null, liveTime: 2 }, /answers no Game.time/],
        [{ staging, modelTime: 4823, liveTime: undefined }, /no game_time/],
        [{ staging, modelTime: 4823, liveTime: 4822 }, /BEHIND the adopted shadow/],
    ])('refuses by name: %#', (o, why) => {
        expect(adoptedClockStaging(o).refusal).toMatch(why);
    });
});
