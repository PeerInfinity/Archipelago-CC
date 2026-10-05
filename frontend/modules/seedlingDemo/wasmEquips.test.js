/**
 * ⛓ WASM EQUIPS — the wasm engine ships the solver's slot selections (tape v4
 * `equips`, `[{t, slot}]`). Before this, `shippedTape` took keys only and a
 * plan that selects a slot (BURN: Fire's slot for the press, the sword's again
 * after) played on the game's own slot, diverging at the first press after the
 * equip. The JS page always applied them (`keysFor` → `run.equipNow`).
 *
 * The plan is the REAL solve of fidelity BURN's step 93 (`burn-l24-reach-exit`:
 * L24, Fire held, the sword selected; equips `[{60,1},{114,0}]`), through the
 * request the wasm engine builds (`arrivalSolveRequest` → `solveFromTape`).
 * What the GAME does with a shipped tape is modelled here by replaying the
 * tape's OWN rows (its inputs and its `equips`) — the game witness is the live
 * probe (`probe-seedling-wasm-midroom-replan.mjs` session E).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { liveOf, replayTape, solveFromTape } from './jsRuntimeSolver.js';
import { arrivalSolveRequest, continuationSolveRequest } from './wasmArrival.js';
import { indexLevels } from './atlasSource.js';
import { shadowMismatch, shippedTape, tapeEquips } from './wasmPlayback.js';
import { equipSlotRefusal, slotOrderRefusal } from './wasmDelivery.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const WITNESS = parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', 'burn-l24-reach-exit.json'), 'utf8'));
/** The witness's boot block without the equips its own solve made (fidelityBurn's `stagingOf`). */
const STAGING = { ...WITNESS, equips: [], despawn: [], tick0: null };
const EXIT = { kind: 'reach-exit', exit: { x: 32, y: 144 } };
/** The engine's goal for the crossing: the exit tile under the tree (`teleporter@32,144`). */
const GOAL = { kind: 'exit', level: 24, tiles: [[2, 9]], name: 'L24 → L12' };
const RECORDS = indexLevels(JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8')));
const RECORD = RECORDS.get(24);
const rowOf = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });

const PLAN = solveFromTape(arrivalSolveRequest({ staging: STAGING, solverGoal: EXIT, levelSource: SRC, records: new Map(),
    scratchPersistence: true }));

/** The game, modelled: the staging + a tape's own key spans + its own `equips` rows, from `run`. */
function playTape(run, tape) {
    const eq = new Map(tape.equips.map((e) => [e.t, e.slot]));
    const rows = [rowOf(run)];
    for (let t = 0; t < tape.tick_count; t += 1) {
        if (eq.has(t)) run.equipNow(eq.get(t));
        run.advance(new Set(heldKeysAt(tape, t)));
        rows.push(rowOf(run));
    }
    return rows;
}
const ship = (keys, equips, staging = STAGING) => parseTape(JSON.stringify(shippedTape({ staging, keys, equips, name: 'equips-test' })));

describe(`WASM EQUIPS — the BURN plan (route step 93) ships its ${WITNESS.equips.length} slot selections`, () => {
    it('the solve the engine asks for selects Fire\'s slot on the press and the sword\'s again', () => {
        expect([...PLAN.equipsAt]).toEqual([[60, 1], [114, 0]]);
        expect(PLAN.solution.length).toBe(WITNESS.tick_count); // the committed witness IS this solve
        expect([...PLAN.equipItems.keys()]).toEqual([60, 114]);
        expect(PLAN.equipItems.get(60)).toMatchObject({ hasSword: true, hasFire: true });
    });

    it('the shipped tape carries `equips` [{60,1},{114,0}] and replaying ITS rows is the plan, row for row (crosses to L12)', () => {
        const tape = ship(PLAN.solution, tapeEquips(PLAN.equipsAt));
        expect(tape.equips).toEqual([{ t: 60, slot: 1 }, { t: 114, slot: 0 }]);
        const rows = playTape(createRunForStaging(STAGING, SRC, { scratchPersistence: true }), tape);
        expect(rows).toEqual(PLAN.expected);
        expect(rows.at(-1).level).toBe(12);
    });

    it('CONTROL (the defect): the same keys shipped WITHOUT equips leave the plan at the first tick after the press', () => {
        const tape = ship(PLAN.solution, []);
        const rows = playTape(createRunForStaging(STAGING, SRC, { scratchPersistence: true }), tape);
        const first = rows.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(PLAN.expected[i]));
        expect(first).toBeGreaterThan(60);
        expect(rows.at(-1).level).toBe(24);
    });

    it('an equip past the tape\'s last tick is refused by name (it would never fire)', () => {
        expect(() => shippedTape({ staging: STAGING, keys: PLAN.solution.slice(0, 60), equips: [{ t: 60, slot: 1 }] }))
            .toThrow(/an equip at tick 60 of a 60-tick tape never fires/);
    });
});

describe('WASM EQUIPS — a continuation in the held room', () => {
    for (const K of [30, 110]) {
        it(`frozen at K=${K} (${K < 60 ? 'before' : 'after'} Fire\'s slot): a LEAD tick + the re-solve ships equips shifted by the lead, and the room replays exactly`, () => {
            const prefix = PLAN.solution.slice(0, K).map((h) => [...h]);
            const roomEquips = new Map(tapeEquips(PLAN.equipsAt).filter((e) => e.t < K).map((e) => [e.t, e.slot]));
            const lead = [[...PLAN.solution[K - 1]]];
            const c = continuationSolveRequest({ staging: STAGING, shipped: [...prefix, ...lead], goal: GOAL, levelSource: SRC,
                records: RECORDS, record: RECORD, equips: roomEquips });
            expect(c.refusal).toBeUndefined();
            const cont = solveFromTape(c.request);
            const shipped = ship([...lead.map((h) => new Set(h)), ...cont.solution], tapeEquips(cont.equipsAt, lead.length));
            expect(shipped.equips).toEqual(tapeEquips(cont.equipsAt, 1));
            // The game: the arrival tape's first K ticks (its own equips), then the continuation tape (its own equips).
            const game = createRunForStaging(STAGING, SRC, { scratchPersistence: true });
            const first = ship(PLAN.solution, tapeEquips(PLAN.equipsAt));
            playTape(game, { ...first, tick_count: K, equips: first.equips.filter((e) => e.t < K) });
            const rows = playTape(game, shipped);
            expect(rows.slice(1)).toEqual(cont.expected);
            expect(game.level).toBe(12);
            // After the burn the re-solve just walks: no slot change, so the game crosses with Fire's slot still selected.
            if (K > 60) expect([cont.equipsAt.size, game.primary]).toEqual([0, 1]);
        });
    }

    it('RESIDUE (the solver\'s, pinned): frozen MID-BURN (K=80, the tree hit at t64, gone at t105) the re-solve declines — the burn verb cannot apply to a burning tree', () => {
        const K = 80;
        const c = continuationSolveRequest({ staging: STAGING, shipped: PLAN.solution.slice(0, K + 1).map((h) => [...h]), goal: GOAL,
            levelSource: SRC, records: RECORDS, record: RECORD, equips: new Map([[60, 1]]) });
        expect(() => solveFromTape(c.request)).toThrow(/Obstacle: solid:burnabletree \(burnabletree@32,128\).*Strategy 'burn' failed to apply/);
    });

    it('the held check after Fire\'s slot: the shadow WITH the room\'s equips equals the game (slot 1); WITHOUT them it is named', () => {
        const K = 80;
        const prefix = PLAN.solution.slice(0, K).map((h) => [...h]);
        const game = createRunForStaging(STAGING, SRC, { scratchPersistence: true });
        const first = ship(PLAN.solution, tapeEquips(PLAN.equipsAt));
        playTape(game, { ...first, tick_count: K, equips: first.equips.filter((e) => e.t < K) });
        const status = { level: game.level, x: game.state.x, y: game.state.y, primary: game.primary };
        expect(status.primary).toBe(1);
        const args = { staging: STAGING, shipped: prefix, goal: GOAL, levelSource: SRC, records: RECORDS, record: RECORD };
        const withEq = continuationSolveRequest({ ...args, equips: new Map([[60, 1]]) });
        expect(shadowMismatch(withEq.shadowRow, status)).toBeNull();
        expect(withEq.request.live.digest).toBe(liveOf(game).digest);
        const without = continuationSolveRequest(args);
        expect(shadowMismatch(without.shadowRow, status)).toMatchObject({ expected: { primary: 0 }, got: { primary: 1 } });
    });

    it('the shadow replay re-makes a room equip at its tick (replayTape), so the worker\'s own replay asserts equal', () => {
        const perTick = PLAN.solution.slice(0, 80);
        const a = replayTape({ staging: STAGING, perTick, levelSource: SRC, scratchPersistence: true, equips: new Map([[60, 1]]) });
        expect(a.primary).toBe(1);
    });
});

describe('WASM EQUIPS — a slot the game cannot select as the model did is refused BY NAME', () => {
    const items = { hasSword: true, hasFire: true };
    it('the game holds the sword then Fire ([0, 1], the model\'s order): no refusal', () => {
        expect(equipSlotRefusal({ equipsAt: PLAN.equipsAt, equipItems: PLAN.equipItems, slots: [0, 1] })).toBeNull();
        expect(equipSlotRefusal({ equipsAt: PLAN.equipsAt, equipItems: PLAN.equipItems, slots: [0] })).toBeNull();
    });
    it('Fire arrived first ([1], + the sword appended = [1, 0]): slot 1 is the SWORD on the game — refused', () => {
        expect(equipSlotRefusal({ equipsAt: new Map([[60, 1]]), equipItems: new Map([[60, items]]), slots: [1] }))
            .toMatch(/the model's slots are \[0,1\] \(item 1\), the game's \[1,0\] \(item 0\) — the game appends a late slot/);
    });
    it('a slot the game does not hold: refused (an index past the end reads 0, the sword)', () => {
        expect(equipSlotRefusal({ equipsAt: new Map([[5, 1]]), equipItems: new Map([[5, { hasSword: true }]]), slots: [0] }))
            .toMatch(/selects slot 1 at tick 5, and the game will hold 1 slot\(s\) \[0\]/);
    });
    it('an equip with no record of the model\'s inventory: refused (cannot be checked)', () => {
        expect(equipSlotRefusal({ equipsAt: new Map([[5, 0]]), equipItems: new Map(), slots: [0] }))
            .toMatch(/carries no record of the model's inventory/);
    });
    it('no equips: nothing to refuse', () => {
        expect(equipSlotRefusal({ equipsAt: new Map(), slots: [] })).toBeNull();
    });
});

describe('WASM EQUIPS — the game\'s slot ORDER is acquisition order (`Inventory.items` is static; only a new game / load rebuilds it)', () => {
    const items = { hasSword: true, hasFire: true };
    it('the game\'s [1, 0] (Fire received first) against the model\'s [0, 1]: the BURN plan is refused at its first slot use (its walk taps X with the sword from tick 0)', () => {
        expect(slotOrderRefusal({ solution: PLAN.solution, equipsAt: PLAN.equipsAt, items, slots: [1, 0] }))
            .toMatch(/the plan presses a slot key at tick 0, and the game holds its slots in acquisition order \[1,0\] where the model derives \[0,1\]/);
    });
    it('a plan that uses no slot plays whatever the order', () => {
        expect(slotOrderRefusal({ solution: [new Set(['left']), new Set()], equipsAt: new Map(), items, slots: [1, 0] })).toBeNull();
    });
    it('the canonical order (or the sword still to be appended: [1] + sword = [1, 0]) — same / refused', () => {
        expect(slotOrderRefusal({ solution: PLAN.solution, equipsAt: PLAN.equipsAt, items, slots: [0, 1] })).toBeNull();
        expect(slotOrderRefusal({ solution: [new Set()], equipsAt: new Map([[0, 1]]), items, slots: [1, 0] })).toMatch(/selects a slot at tick 0/);
        expect(slotOrderRefusal({ solution: PLAN.solution, equipsAt: PLAN.equipsAt, items, slots: [1] })).toMatch(/\[1,0\]/);
    });
});
