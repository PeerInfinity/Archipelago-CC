/**
 * fidelity UNBILLEDGATE (planner `seedling-fidelity-planning-7`, wave 15) — a solve whose drive took damage no plan
 * billed is refused (`solverBot.UNBILLED_DAMAGE`, `CONTACT_FIDELITY.unbilledDamageGate`, OFF by default).
 *
 * The witness: route survey step 47 (L22 → L29, staged boot), whose 201-t walk the solver returns at main
 * `926cc2a86f` with an unbilled `wallflyer@64,80` hit at run t84; the GAME (p4f headless) takes the same hit at the
 * same tick (`fixtures/unbilled-witness/survey-step-47.json`). The control: divergence leg 622's forced hit, which the
 * forced-hit rung BILLS, still solves with the gate ON.
 * Report: `CC/docs/cloud-reports/seedling-fidelity-unbilledgate.md`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SolverRefusal, UNBILLED_DAMAGE, UNBILLED_DAMAGE_TRACE, solveSegment, unbilledDamageOf } from './solverBot.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { arrivalSolverGoal, arrivalSolveRequest } from './wasmArrival.js';
import { createInPlaceProduceService } from './wasmWalkTape.js';
import { ANYTIME_PASSES } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const json = (...p) => JSON.parse(readFileSync(join(HERE, ...p), 'utf8'));
const WITNESS = json('fixtures', 'unbilled-witness', 'survey-step-47.json');
const MAP = json('..', 'flashPanel', 'atlases', 'seedling-map.json');

/** Step 47's solve, as the survey asks it: the tape's own staging, the survey's atlas, one fresh run. */
function solveStep47() {
    const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(WITNESS.tape))));
    const levelSource = levelSourceFromAtlas(patchedMapDocument(MAP));
    const run = createRunForStaging(staging, levelSource);
    return solveSegment({ run, goals: WITNESS.goals, name: 'survey-step-47', boot: staging.boot,
        forkRun: () => createRunForStaging(staging, levelSource) });
}

const withGate = (on, fn) => withContactFidelity({ unbilledDamageGate: on }, fn);

describe('fidelity UNBILLEDGATE — a solve with damage no plan billed', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_UNBILLED_DAMAGE_GATE)(
        'ships OFF, and UNBILLED_DAMAGE reads the key', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.unbilledDamageGate).toBe(false);
            expect(UNBILLED_DAMAGE.enabled).toBe(false);
            withGate(true, () => expect(UNBILLED_DAMAGE.enabled).toBe(true));
            expect(UNBILLED_DAMAGE.enabled).toBe(false);
            expect(UNBILLED_DAMAGE_TRACE.sink).toBeNull();
        });

    it('unbilledDamageOf: rows after the handover clock, minus the billed ones; deaths counted', () => {
        const hits = [
            { t: 3, level: 1, source: 'chaser', id: 'bob@0,0', hits: 1, died: false },  // the prefix's
            { t: 9, level: 1, source: 'chaser', id: 'bob@0,0', hits: 2, died: false },  // billed below
            { t: 12, level: 1, source: 'wallflyer', id: 'wallflyer@8,8', hits: 3, died: true },
        ];
        const deaths = [{ t: 12, level: 1, source: 'wallflyer', id: 'wallflyer@8,8' }];
        const run = { ledger: (k) => (k === 'playerHits' ? hits : deaths) };
        const billed = [{ billed: [{ t: 9, source: 'chaser', id: 'bob@0,0' }] }];
        const d = unbilledDamageOf(run, 5, billed, (t) => t - 1);
        expect(d.billed).toBe(1);
        expect(d.unbilled).toEqual([{ t: 12, tick: 11, level: 1, source: 'wallflyer', id: 'wallflyer@8,8', hits: 3,
            died: true }]);
        expect(d.deaths).toEqual([{ t: 12, tick: 11, level: 1, source: 'wallflyer', id: 'wallflyer@8,8' }]);
        expect(unbilledDamageOf(run, 0, [], () => null).unbilled.map((h) => h.t)).toEqual([3, 9, 12]);
    });

    it('the witness: the GAME takes step 47\'s hit at the tick the model does (t84, 0 -> 1)', () => {
        const rises = [];
        for (let i = 1; i < WITNESS.game.length; i += 1) {
            const [t, level, hits] = WITNESS.game[i];
            const [, plevel, phits] = WITNESS.game[i - 1];
            if (level === plevel && hits !== phits) rises.push([t, phits, hits]);
        }
        expect(rises).toEqual([[84, 0, 1]]);
    });

    it('OFF: step 47 SOLVES with the unbilled hit (the census window sees it, decides nothing)', () => {
        const seen = [];
        UNBILLED_DAMAGE_TRACE.sink = (row) => seen.push(row);
        let out;
        try {
            out = withGate(false, solveStep47);
        } finally {
            UNBILLED_DAMAGE_TRACE.sink = null;
        }
        expect(out.perTick.length).toBe(201);
        expect(out.forcedHits).toBeUndefined();
        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({ name: 'survey-step-47', prefix: 0, ticks: 201, billed: 0, deaths: [], gate: false });
        expect(seen[0].unbilled).toEqual([{ t: 84, tick: 83, level: 22, source: 'wallflyer', id: 'wallflyer@64,80',
            hits: 1, died: false }]);
    });

    it('ON: step 47 is REFUSED by name — obstacle.kind unbilled-damage, its tick, source and count', () => {
        let err = null;
        try {
            withGate(true, solveStep47);
        } catch (e) {
            err = e;
        }
        expect(err).toBeInstanceOf(SolverRefusal);
        expect(err.message).toMatch(/UNBILLED DAMAGE/);
        expect(err.obstacle).toMatchObject({ kind: 'unbilled-damage', id: 'wallflyer@64,80', tick: 83, t: 84,
            level: 22, source: 'wallflyer', hits: 1, deaths: 0, billed: 0 });
        expect(err.perTick).toHaveLength(201);
        expect(err.goal?.kind).toBe('reach-exit');
    });

    it('ON: a hit inside a replayed PREFIX is the prefix\'s, not the segment\'s — the rest of step 47 solves', () => {
        const all = withGate(false, solveStep47).perTick;
        const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(WITNESS.tape))));
        const levelSource = levelSourceFromAtlas(patchedMapDocument(MAP));
        const run = createRunForStaging(staging, levelSource);
        const prefix = all.slice(0, 100); // through the t84 hit
        for (const held of prefix) run.advance(held);
        expect(run.ledger('playerHits').map((h) => h.t)).toEqual([84]);
        const out = withGate(true, () => solveSegment({ run, goals: WITNESS.goals, name: 'survey-step-47-prefix',
            boot: staging.boot, prefix,
            forkRun: () => createRunForStaging(staging, levelSource) }));
        expect(out.perTick.length).toBeGreaterThan(100);
    });

    it('ON: a BILLED forced hit is not unbilled — leg 622 still solves (the control)', () => {
        const RECS = new Map(indexLevels(MAP));
        const SRC = levelSourceFromAtlas(RECS);
        const rt = createJsRuntime();
        rt.setVanilla(RECS);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [73, 64, 16] }]);
        rt.tick();
        const s = rt.session.staging;
        const items = { hitsMax: 3, hasTorch: true, hasDarkSuit: false, hasSpear: true, hasFeather: true, canSwim: true,
            hasFireWand: false, hasWand: true, hasFire: true, hasDarkShield: false, hasShield: true,
            hasGhostSword: false, hasDarkSword: false, hasSword: true };
        const staging = { ...s, inventory_slots: [0, 1, 3, 2], seam: { ...s.seam, items: { ...s.seam.items, ...items } } };
        const goal = { kind: 'exit', level: 73, tiles: [[4, 0]], name: 'level_73__r0c4 -> level_74' };
        const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(73) });
        const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS,
            scratchPersistence: true }), passes: ANYTIME_PASSES };
        const seen = [];
        UNBILLED_DAMAGE_TRACE.sink = (row) => seen.push(row);
        let res;
        try {
            res = withGate(true, () => createInPlaceProduceService().start(req).result);
        } finally {
            UNBILLED_DAMAGE_TRACE.sink = null;
        }
        expect(res.ok).toBe(true);
        expect(res.plan.verbs).toEqual(['forced-hit']);
        expect(seen.length).toBeGreaterThan(0);
        for (const row of seen) expect(row).toMatchObject({ billed: 1, unbilled: [], deaths: [], gate: true });
    });
});
