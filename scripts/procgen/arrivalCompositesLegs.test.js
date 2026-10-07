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
 *
 * Wave 8 moved two more X legs, each by ONE switch (measured in node, the same way): L30's residue was the BobSoldier
 * (BOBSOLDIER W4 `bobSoldierLive`) — it now crosses ON PLAN, a 167 t `detour`, and the OFF control is the old 162 t
 * walk the game left at t54; L45's residue was the jellyfish (KILLLOCK K1 `jellyfishLive`) — the solver now declines
 * it BY NAME (the bait stance's route needs FIRE for the tree at (48,64)), and the OFF control is the old 720 t walk.
 *
 *   mutant: the L30 leg's `ticks` loosened -> 'L30 past the BobSoldier …' reds
 *   mutant: `declinedHolds` without its clause check -> 'residue L45: … the other leg's clause' reds
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
import { withKillLockBodies } from '../../frontend/modules/seedlingDemo/killLockBodies.js';

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
    it('the X legs: L28 the exact repeat, L30 crosses (wave 8), L45 and the two L88 legs decline', () => {
        expect(LEGS.X.map((l) => [l.name, l.expect])).toEqual([
            ['residue L28', 'repeat'], ['L30 past the BobSoldier', 'cross'], ['residue L45', 'declined'],
            ['residue L88 a', 'declined'], ['residue L88 b', 'declined'],
        ]);
    });
    for (const leg of DECLINED.filter((l) => l.goal.level === 88)) {
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
    const leg = DECLINED.find((l) => l.name === 'residue L88 a');
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

describe('composites probe X — wave 8: L30 crosses past the live BobSoldier (BOBSOLDIER W4), L45 declines beside the live jellyfish (KILLLOCK K1)', () => {
    const l30 = LEGS.X.find((l) => l.name === 'L30 past the BobSoldier');
    const l45 = LEGS.X.find((l) => l.name === 'residue L45');
    it(`L30 past the BobSoldier: the solver's plan is exactly the pinned ${l30.ticks} t detour to L31; bobSoldierLive OFF plans the old 162 t walk`, () => {
        expect(l30).toMatchObject({ expect: 'cross', producer: 'solver', verbs: ['detour'] });
        const { result } = serve(l30);
        expect(result.ok, result.message).toBe(true);
        expect(result.plan.verbs).toEqual(l30.verbs);
        expect(result.plan.solution.length).toBe(l30.ticks);
        expect(result.plan.expected.at(-1)).toMatchObject({ level: 31, deaths: 0 });
        // the control: the BobSoldier as the plain mover it was (the BEFORE of W4) — the walk the game left at t54
        const off = withContactFidelity({ bobSoldierLive: false }, () => serve(l30).result);
        expect(off.ok, off.message).toBe(true);
        expect(off.plan.verbs).toEqual(['walk']);
        expect(off.plan.solution.length).toBe(162);
    });
    it('residue L45: the solver refuses BY NAME — the route needs FIRE for the tree at (48,64); jellyfishLive OFF plans the old 720 t walk', () => {
        expect(l45.clause).toBe('burnabletree@48,64 cannot be burned by this run — this run does not hold FIRE');
        const { result } = serve(l45);
        expect(result.ok).toBe(false);
        expect(String(result.message)).toMatch(/reach-exit \(112,0\)->L46 -> bait \(jellyfish@224,176\) stance -> burn: /);
        expect(String(result.message)).toContain(l45.clause);
        // the control: the jellyfish not a live body (the BEFORE of K1) — the walk the game left at t119
        const off = withKillLockBodies({ jellyfishLive: false }, () => serve(l45).result);
        expect(off.ok, off.message).toBe(true);
        expect(off.plan.solution.length).toBe(720);
        expect(off.plan.expected.at(-1).level).toBe(46);
    });
    const named = `the solver declined ${l45.goal.name} in level 45 (refusal): solverBot(wasm-exit-45) reach-exit (112,0)->L46 -> `
        + `bait (jellyfish@224,176) stance -> burn: ${l45.clause}. …`;
    const base = { answer: { ok: true, action: 'force-re-arrival' }, end: 'failed', level: 45, failed: named, legs: [{ outcome: 'failed' }] };
    it('residue L45: the verdict holds on the live run\'s shape (CI seedling-probe 37648075682 at 3a0614dd81)', () => {
        expect(declinedHolds(l45, base)).toBe(true);
    });
    it('residue L45: a silent success reds (crossed or done, a played plan, out of the level)', () => {
        expect(declinedHolds(l45, { ...base, end: 'crossed', failed: null, level: 46, legs: [{ outcome: 'crossed' }] })).toBe(false);
        expect(declinedHolds(l45, { ...base, end: 'done', failed: null })).toBe(false);
        expect(declinedHolds(l45, { ...base, legs: [{ outcome: 'diverged' }, { outcome: 'failed' }] })).toBe(false);
    });
    it('residue L45: an unnamed failure reds (no solver name, the old exact repeat, another goal\'s name, the other leg\'s clause, a timeout)', () => {
        expect(declinedHolds(l45, { ...base, failed: null })).toBe(false);
        expect(declinedHolds(l45, { ...base, failed: 'the game left the plan on out_teleporter_112_0 in level 45 at the SAME tick with the SAME game row 2 times in a row' })).toBe(false);
        expect(declinedHolds(l45, { ...base, failed: named.replace('out_teleporter_112_0', 'out_teleporter_0_96') })).toBe(false);
        expect(declinedHolds(l45, { ...base, failed: named.replace(l45.clause, 'the re-planned corridor failed too') })).toBe(false);
        expect(declinedHolds(l45, { ...base, end: 'timeout', failed: null })).toBe(false);
    });
});
