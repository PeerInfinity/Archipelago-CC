/**
 * The composites probe's D legs (`probe-seedling-wasm-arrival-composites.mjs`), held to the MODEL in node.
 *
 * Fidelity STEPOFF2 made the latched step-off sub-pixel: the five latched D legs went from 32–33 t (a walk to
 * a cell centre and back) to 12–13 t. The probe pins each leg's plan length (`ticks` ± `PLAN_TICKS_TOLERANCE`)
 * on the game; this file pins those numbers to the solver's own plan from the same boot (the JS page's
 * `new Game(level, x, y)`, as `wasmArrivalComposite.test.js` boots its arrivals), EXACTLY — so a pin cannot
 * drift loose (back to 33) while the probe still passes, and a solver regression to the ring walk reds here
 * before any box run.
 *
 * Also the D leg STEPOFF2 opened: L3's pocket with the Sword — `break` (a record before the reach-exit one),
 * `step-off`, `walk` — and its plan ships as a wasm tape (`shippedTape`) whose own rows replay to L11.
 *
 *   mutant: a D leg's `ticks` loosened back to 33 -> 'every latched D leg …' reds (that leg)
 *
 * And the X session's L88 legs (`declined`): fidelity TERRAIN's live drill (`drillLive`, ON since wave 6) makes the
 * solver decline them BY NAME before any plan ships — held here in node at the default switches, the OFF control
 * restores the old drill-blind plans, and `declinedHolds` (the probe's verdict) reds a silent success and a failure
 * without the solver's name.
 *
 *   mutant: `declinedHolds` without its name clause -> 'an unnamed failure reds' reds
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEGS, PLAN_TICKS_TOLERANCE, declinedHolds } from './probe-seedling-wasm-arrival-composites.mjs';
import { createJsRuntime } from '../../frontend/modules/seedlingDemo/jsRuntimeCore.js';
import { arrivalSolveRequest, arrivalSolverGoal } from '../../frontend/modules/seedlingDemo/wasmArrival.js';
import { createInPlaceProduceService } from '../../frontend/modules/seedlingDemo/wasmWalkTape.js';
import { createRunForStaging } from '../../frontend/modules/seedlingDemo/tapeRunner.js';
import { heldKeysAt } from '../../frontend/modules/seedlingDemo/tapeFormat.js';
import { shippedTape } from '../../frontend/modules/seedlingDemo/wasmPlayback.js';
import { indexLevels, levelSourceFromAtlas } from '../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../frontend/modules/seedlingDemo/contactFidelity.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECORDS = indexLevels(MAP);
const SOURCE = levelSourceFromAtlas(RECORDS);
const ITEM_OF = { 'Progressive Sword': 'hasSword' };

/** The JS page's own boot at the leg's arrival, with the leg's granted items held. */
function arrival(leg) {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems((leg.grant ?? []).map((name) => ({ class: 'Main', property: ITEM_OF[name], value: true })));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: leg.at }]);
    rt.tick();
    expect(rt.run?.level).toBe(leg.at[0]);
    return rt.session.staging;
}

/** The engine's `arrive()` solve, in place. */
function serve(leg) {
    const staging = arrival(leg);
    const mapped = arrivalSolverGoal(leg.goal, { staging, levelSource: SOURCE, record: RECORDS.get(leg.goal.level) });
    const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SOURCE, records: RECORDS, scratchPersistence: true });
    return { staging, result: createInPlaceProduceService().start(request).result };
}

const PINNED = LEGS.D.filter((l) => l.ticks !== undefined);

describe('composites probe D — the latched legs\' plan lengths are the solver\'s own (fidelity STEPOFF2)', () => {
    it(`the pinned set is every latched step-off leg (${PINNED.length}), with one tick of stated slack`, () => {
        expect(PINNED.map((l) => l.name)).toEqual(LEGS.D.filter((l) => l.stepOff).map((l) => l.name));
        expect(PINNED.length).toBeGreaterThan(0);
        expect(PLAN_TICKS_TOLERANCE).toBe(1);
    });
    for (const leg of PINNED) {
        it(`every latched D leg: ${leg.name} — the solver's plan is exactly the pinned ${leg.ticks} t (steps off, crosses)`, () => {
            const { result } = serve(leg);
            expect(result.ok, result.message).toBe(true);
            expect(result.plan.verbs).toEqual(['step-off', 'walk']);
            expect(result.plan.expected.at(-1).level).not.toBe(leg.goal.level);
            expect(result.plan.solution.length).toBe(leg.ticks);
        });
    }
});

describe('composites probe D — L3\'s pocket with the Sword (STEPOFF2 D3: a break record before the reach-exit)', () => {
    const leg = LEGS.D.find((l) => l.name === 'L3 pocket with the Sword');
    it('the leg is in the probe, last in its session (the Sword stays granted on the page)', () => {
        expect(leg).toMatchObject({ expect: 'cross', producer: 'solver', verbs: ['break', 'step-off', 'walk'], grant: ['Progressive Sword'] });
        expect(LEGS.D.at(-1)).toBe(leg);
    });
    it('the solver breaks the rock from the door, steps off and crosses to L11; the wasm tape of it replays to L11', () => {
        const { staging, result } = serve(leg);
        expect(result.ok, result.message).toBe(true);
        const { plan } = result;
        expect(plan.verbs).toEqual(leg.verbs);
        expect(plan.expected.at(-1)).toMatchObject({ level: 11, deaths: 0 });
        const tape = shippedTape({ staging, keys: plan.solution, name: 'composites-l3-sword' });
        const run = createRunForStaging(staging, SOURCE, { scratchPersistence: true });
        for (let t = 0; t < tape.tick_count; t += 1) run.advance(new Set(heldKeysAt(tape, t)));
        expect(run.level).toBe(11);
    });
});

describe('composites probe X — L88 declines BY NAME beside the live drill (fidelity TERRAIN W3, wave 6)', () => {
    const DECLINED = LEGS.X.filter((l) => l.expect === 'declined');
    it('the declined legs are exactly the two L88 legs; the other residue legs still expect the exact repeat', () => {
        expect(DECLINED.map((l) => l.name)).toEqual(['residue L88 a', 'residue L88 b']);
        expect(LEGS.X.filter((l) => l.expect !== 'declined').every((l) => l.expect === 'repeat')).toBe(true);
    });
    for (const leg of DECLINED) {
        it(`${leg.name}: the solver refuses the corridor (the re-planned corridor failed too); drillLive OFF plans it again`, () => {
            const { result } = serve(leg);
            expect(result.ok).toBe(false);
            expect(String(result.message)).toMatch(/the re-planned corridor failed too/);
            // the control: the drill-blind model (the BEFORE of TERRAIN W3) still finds the old plan out to L87
            const off = withContactFidelity({ drillLive: false }, () => serve(leg).result);
            expect(off.ok, off.message).toBe(true);
            expect(off.plan.expected.at(-1).level).toBe(87);
        });
    }
    const leg = DECLINED[0];
    const named = `the solver declined ${leg.goal.name} in level 88 (refusal): solverBot(wasm-exit-88) reach-exit (32,0)->L87: `
        + 'the re-planned corridor failed too — …';
    const base = { answer: { ok: true, action: 'force-re-arrival' }, end: 'failed', level: 88, failed: named, legs: [{ outcome: 'failed' }] };
    it('the verdict holds on the live run\'s shape (CI seedling-probe at 0fdd9f967f)', () => {
        expect(declinedHolds(leg, base)).toBe(true);
    });
    it('a silent success reds (crossed or done, a played plan, out of the level)', () => {
        expect(declinedHolds(leg, { ...base, end: 'crossed', failed: null, level: 87, legs: [{ outcome: 'crossed' }] })).toBe(false);
        expect(declinedHolds(leg, { ...base, end: 'done', failed: null })).toBe(false);
        expect(declinedHolds(leg, { ...base, legs: [{ outcome: 'diverged' }, { outcome: 'failed' }] })).toBe(false);
    });
    it('an unnamed failure reds (no solver name, another goal\'s name, a timeout)', () => {
        expect(declinedHolds(leg, { ...base, failed: null })).toBe(false);
        expect(declinedHolds(leg, { ...base, failed: 'the game left the plan' })).toBe(false);
        expect(declinedHolds(leg, { ...base, failed: named.replace('out_teleporter_32_0', 'out_teleporter_192_0') })).toBe(false);
        expect(declinedHolds(leg, { ...base, end: 'timeout', failed: null })).toBe(false);
    });
});
