/**
 * ⛓⛓⛓ SEEDLING FIDELITY CANCROSS — the solver as an oracle, one real case per
 * verdict class.
 *
 *   can            swordless L14 from its captured arrival (the DETOUR rung):
 *                  the witness IS the committed `l14-swordless-detour` tape's keys
 *   cannot         L22 from L25 toward L29, bare: the ladder EXHAUSTED on a static
 *                  wallflyer (not chaser-only, so no DETOUR) — a true refusal
 *   undecided      the same L14 call under a budget of 0 consults (`e.deadline`),
 *                  and the DETOUR rung's own bound (a field since ROBUST D1)
 *   model-refused  the Ghost Sword on L14: `levelRun` refuses the press arm
 *
 * and D2's derivation over L16 → L18 (`stairsup@352,80`) from L15, pool
 * {sword, conch}: the block-route search's REAL `MAX_ROUTE_ORDERS` bound
 * (`undecided`, read off `SolverRefusal.bound`), a minimal set not proved
 * minimal, and — since ROBUST D3 — the Conch no longer turning the Sword's `can`
 * into `cannot` (the PULL rung probes past the sandtrap to the lane).
 *
 * ⛔ No clock is read: every budget here is the deterministic consult counter.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { stagingFromTape, createRunForStaging } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { DEFAULT_DASH_MODE, SolverRefusal, deriveChaserDetour } from './solverBot.js';
import {
    CAN_CROSS_DASH_MODE, CanCrossError, DEFAULT_CONSULT_BUDGET, VERDICTS, buildArrivalStaging, canCross, classifyError,
    deriveMinimalSets, doorArrival, importClosure, solverStamp,
} from './seedlingCanCross.js';

const SRC = atlasLevelSource();
const L14 = () => stagingFromTape(loadTape('l14-swordless-detour'));
/** A tape's held keys per tick (row order within a tick is the fold's, not a fact). */
const heldOf = (tape) => {
    const held = Array.from({ length: tape.tick_count }, () => []);
    for (const i of tape.inputs) for (let t = i.from; t < i.to; t += 1) held[t].push(i.key);
    return held.map((h) => h.sort().join('+'));
};
const ask = (o) => canCross({ level: 14, exit: 15, dashMode: 'none', ...o });

describe('canCross — one real case per verdict', () => {
    it('can: swordless L14 from the captured arrival, and the witness is the committed tape\'s keys', () => {
        const r = ask({ arrival: { staging: L14() } });
        expect(r.verdict).toBe('can');
        expect(r.cause).toEqual({ kind: 'solved', basis: 'field' });
        expect(r.plan).toMatchObject({ ticks: 173, landed: 15, deaths: 0, hits: 0, rungs: ['detour'] });
        expect(r.arrival.assumed).toEqual([]);
        const committed = loadTape('l14-swordless-detour');
        expect(r.witness.tape.tick_count).toBe(committed.tick_count);
        expect(heldOf(r.witness.tape)).toEqual(heldOf(committed));
        expect(r.witness.replayed).toEqual({ observations: 174, landed: 15, agrees: true });
        expect(r.budget).toMatchObject({ kind: 'consults', limit: DEFAULT_CONSULT_BUDGET, deterministic: true });
    });

    it('cannot: L22 from L25 toward L29, bare — EXHAUSTED on a static wallflyer, a true refusal', () => {
        const r = canCross({ level: 22, exit: 29, arrival: { from: 25 }, dashMode: 'none', witness: false });
        expect(r.verdict).toBe('cannot');
        expect(r.cause).toMatchObject({ kind: 'refusal', basis: 'field', name: 'SolverRefusal',
            obstacle: { kind: 'danger', id: 'wallflyer@128,80' } });
        expect(r.why).toMatch(/combat ladder is EXHAUSTED/);
        expect(r.witness).toBeUndefined();
    });

    it('undecided: a budget of 0 consults trips at the first site — never `cannot`', () => {
        const r = ask({ arrival: { staging: L14() }, budget: { consults: 0 } });
        expect(r.verdict).toBe('undecided');
        expect(r.cause).toMatchObject({ kind: 'budget', basis: 'field',
            deadline: { tripped: true, first: 'detour' } });
        expect(r.budget).toMatchObject({ kind: 'consults', limit: 0, consults: 1, deterministic: true });
        expect(r.why).toMatch(/⏱ DEADLINE/);
    });

    it('undecided: the DETOUR rung\'s own bound classifies as a bound, read off the row\'s FIELD', () => {
        const run = createRunForStaging(L14(), SRC, { scratchPersistence: true });
        const d = deriveChaserDetour(run, { aim: { x: 32, y: 64 }, allowTeleporter: null,
            planOpts: { liveBag: run.liveGeometryOpts(), avoidVolumes: true, keys: run.progress('keys'),
                contacts: new Set(), lattice: 16, inventory: run.progress('inventory'), noHazards: run.noHazards },
            certify: () => ({ hit: { x: 0, y: 0 }, hitWp: 99, truncated: null, ticks: 1 }), maxPreviews: 5 });
        expect(d.wps).toBe(null);
        expect(d.bound).toMatchObject({ name: 'DETOUR_RUNG', hit: ['maxPreviews'], previews: 5, maxPreviews: 5 });
        // the words are the solver's, unchanged; the FIELD is what is read
        expect(d.why).toMatch(/preview\(s\) of the 5 bound spent .* candidate\(s\) left unasked/);
        const e = new SolverRefusal('x: the combat ladder is EXHAUSTED', {
            considered: [{ option: 'detour', why: 'the kill rung\'s words' },
                { option: 'detour', why: 'no words to match', bound: d.bound }] });
        expect(classifyError(e)).toMatchObject({ verdict: 'undecided',
            cause: { kind: 'bound', basis: 'field', bound: 'DETOUR_RUNG', maxPreviews: 5, previews: 5,
                unasked: d.bound.unasked } });
        // the same row with `bound: null` (the open set ran dry) is a true refusal, whatever its words say
        const exhausted = new SolverRefusal('x', { considered: [{ option: 'detour', why: d.why, bound: null }] });
        expect(classifyError(exhausted).verdict).toBe('cannot');
    });

    it('undecided: a block-route bound is read off `SolverRefusal.bound`, not the message', () => {
        const e = new SolverRefusal('no words to match', { bound: { name: 'MAX_ROUTE_EXPANSIONS',
            site: 'block-route', limit: 2000, expansions: 2001 } });
        expect(classifyError(e)).toMatchObject({ verdict: 'undecided', cause: { kind: 'bound', basis: 'field',
            bound: 'MAX_ROUTE_EXPANSIONS', limit: 2000, expansions: 2001, site: 'block-route' } });
        // the old words without the field are a true refusal now: a caller reads fields
        const words = new SolverRefusal('solverBot: the block-route search for b@0,0 in level 1 hit '
            + '`MAX_ROUTE_ORDERS` — …');
        expect(classifyError(words).verdict).toBe('cannot');
    });

    it('model-refused: the Ghost Sword on L14 — the model refuses the press arm, by name', () => {
        const r = ask({ arrival: { staging: L14() }, inventory: ['ghostsword'] });
        expect(r.verdict).toBe('model-refused');
        expect(r.cause).toMatchObject({ kind: 'model', basis: 'field' });
        expect(r.why).toMatch(/ghostsword press .* Neither is modelled/);
        expect(r.arrival.items).toEqual(['hasGhostSword']);
    });

    it('the verdict vocabulary is the contract\'s four', () => {
        expect(VERDICTS).toEqual(['can', 'cannot', 'undecided', 'model-refused']);
        expect(classifyError(new TypeError('a defect'))).toBe(null);
    });
});

describe('canCross — the arrival built without a capture', () => {
    it('the door from L13 lands where the game lands you, and every default is listed', () => {
        expect(doorArrival(SRC, 14, 13)).toEqual({ x: 160, y: 64,
            via: { level: 13, type: 'stairsdown', x: 32, y: 32 } });
        const { staging, assumed } = buildArrivalStaging({ level: 14, arrival: { from: 13 }, inventory: ['spear'],
            levelSource: SRC });
        expect(staging.boot).toEqual({ level: 14, x: 160, y: 64 });
        expect(staging.seam.items.hasSpear).toBe(true);
        expect('time' in staging.seam).toBe(false);
        expect(assumed.map((a) => a.split(' ')[0])).toEqual(['persistence', 'save', 'rng', 'beam', 'rockSet',
            'hitsMax', 'time', 'primary', 'cutscene']);
    });

    it('fresh-built and captured L14 arrivals give the same verdict and the same plan', () => {
        const fresh = ask({ arrival: { from: 13 }, witness: false });
        const captured = ask({ arrival: { staging: L14() }, witness: false });
        expect(fresh.verdict).toBe('can');
        expect(fresh.plan.hash).toBe(captured.plan.hash);
        expect(fresh.budget.consults).toBe(captured.budget.consults);
    });

    it('a request it cannot ask is refused by name, never a verdict', () => {
        expect(() => ask({ arrival: { from: 99 } })).toThrow(CanCrossError);
        expect(() => ask({ exit: 99, arrival: { from: 13 } })).toThrow(/0 door\(s\) matching exit 99/);
        expect(() => ask({ arrival: null })).toThrow(/no default spawn/);
        expect(() => ask({ arrival: { from: 13 }, inventory: ['bow'] })).toThrow(/unknown inventory item `bow`/);
        expect(() => ask({ arrival: { staging: L14() }, level: 15, exit: 16 })).toThrow(/boots level 14/);
    });
});

describe('canCross — deterministic, and stamped', () => {
    it('the same call twice is the same verdict, plan and work; no hook at all is the same plan', () => {
        const a = ask({ arrival: { from: 13 }, inventory: ['sword'], dashMode: 'all', witness: false });
        const b = ask({ arrival: { from: 13 }, inventory: ['sword'], dashMode: 'all', witness: false });
        const none = ask({ arrival: { from: 13 }, inventory: ['sword'], dashMode: 'all', witness: false, budget: null });
        expect(a.verdict).toBe('can');
        expect([b.verdict, b.plan.hash, b.budget.consults]).toEqual([a.verdict, a.plan.hash, a.budget.consults]);
        expect(none.plan.hash).toBe(a.plan.hash);
        expect(none.budget).toMatchObject({ kind: 'none', consults: 0, deterministic: true });
    });

    it('a wall-clock budget says it is not deterministic', () => {
        const r = ask({ arrival: { from: 13 }, inventory: ['sword'], budget: { ms: 60000 }, witness: false });
        expect(r.budget).toMatchObject({ kind: 'ms', deterministic: false });
    });

    it('the stamp hashes the solve\'s whole import closure and the atlas', () => {
        const s = solverStamp();
        expect(s.id).toMatch(/^[0-9a-f]{32}$/);
        const closure = importClosure([new URL('./solverBot.js', import.meta.url).pathname]);
        expect(closure.some((f) => f.endsWith('/seedlingDemo/levelRun.js'))).toBe(true);
        expect(s.files).toBeGreaterThan(closure.length);
        expect(ask({ arrival: { from: 13 }, inventory: ['sword'], witness: false }).solver.id).toBe(s.id);
    });
});

describe('deriveMinimalSets — the derivation question, with its caveats visible', () => {
    it('L16 → L18 from L15 over {sword, conch}: {sword} is minimal but unproved, and {sword, conch} also CAN (ROBUST D3)', () => {
        const d = deriveMinimalSets({ level: 16, exit: { x: 352, y: 80 }, arrival: { from: 15 }, dashMode: 'none',
            pool: ['sword', 'conch'] });
        expect(d.rows.map((r) => [r.set.join('+') || '∅', r.verdict])).toEqual([
            ['∅', 'undecided'], ['conch', 'undecided'], ['sword', 'can'], ['sword+conch', 'can']]);
        expect(d.rows[0].why).toMatch(/^bound: .*hit `MAX_ROUTE_ORDERS`/);
        expect(d.rows[0].cause).toMatchObject({ kind: 'bound', basis: 'field', bound: 'MAX_ROUTE_ORDERS', limit: 8 });
        expect(d.minimal).toEqual([['sword']]);
        expect(d.unprovedBelow).toEqual({ sword: [[]] });
        expect(d.nonMonotone).toEqual([]);
        expect(d.solver).toBe(solverStamp().id);
    }, 120_000);
});

describe('the game witness — a door-built arrival\'s `can`, recorded on the game (D3)', () => {
    // ⛓ DASHFLIP: the default returned to the solver's `all`, so this row names `none`.
    it('`cancross-l16-sword-none` IS canCross\'s `none` witness for L16 → L17 with the Sword, byte for byte', () => {
        const r = canCross({ level: 16, exit: 17, arrival: { from: 15 }, inventory: ['sword'],
            dashMode: 'none', name: 'cancross-l16-sword-none' });
        expect(r.verdict).toBe('can');
        expect(r.plan).toMatchObject({ ticks: 206, landed: 17, hits: 0, rungs: ['pull'] });
        const path = new URL('./fixtures/tapes/cancross-l16-sword-none.json', import.meta.url);
        expect(`${JSON.stringify(r.witness.tape, null, 4)}\n`).toBe(readFileSync(path, 'utf8'));
        expect(r.witness.replayed).toEqual({ observations: 207, landed: 17, agrees: true });
    });

    /**
     * ⛓ SEEDLING FIDELITY DASHFLIP — the DEFAULT is the solver's `all` again, and its
     * L16 → L17 plan is the game-recorded `dash-l16-sword-all` (117 t, PULL, 0 hits;
     * DASH D2's `--record`), byte for byte but its prose. At the legacy dash window
     * this plan was the refuted 111 t.
     */
    it('the default dash mode is the solver\'s, and its L16 → L17 plan IS `dash-l16-sword-all`, every field but its prose', () => {
        expect(CAN_CROSS_DASH_MODE).toBe(DEFAULT_DASH_MODE);
        expect(CAN_CROSS_DASH_MODE).toBe('all');
        const r = canCross({ level: 16, exit: 17, arrival: { from: 15 }, inventory: ['sword'],
            name: 'dash-l16-sword-all' });
        expect(r.verdict).toBe('can');
        expect(r.plan).toMatchObject({ ticks: 117, hash: '12575cff30', landed: 17, hits: 0, rungs: ['pull'] });
        // ⚠ Every field but `description`: the DASH slice rewrote that one by hand.
        const path = new URL('./fixtures/tapes/dash-l16-sword-all.json', import.meta.url);
        const committed = JSON.parse(readFileSync(path, 'utf8'));
        const planned = { ...r.witness.tape };
        delete committed.description;
        delete planned.description;
        expect(JSON.stringify(planned, null, 4)).toBe(JSON.stringify(committed, null, 4));
        expect(r.witness.replayed).toEqual({ observations: 118, landed: 17, agrees: true });
    });
});
