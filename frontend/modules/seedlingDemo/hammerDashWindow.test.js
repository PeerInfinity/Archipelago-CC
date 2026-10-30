/**
 * seedlingDemo/hammerDashWindow.test — ⛓ SEEDLING HAMMER-PHASE DASH (`seedling-hammer-dash-window`; ⚖ the user queued it
 * 2026-10-30, planner `seedling-hammer-phase-planning-2`). Report: `CC/docs/cloud-reports/seedling-hammer-dash-window.md`.
 *
 * PART 1 — THE UPGRADE WINDOW'S MARGIN, MEASURED (no code: the window is `SOLVER_UPGRADE_WINDOW_WORK`, 85, unchanged).
 * A leg's THRESHOLD is the smallest window whose shipped plan is the unwindowed one (`solveAnytime`, budget 640); its
 * MARGIN is 85 − threshold. The window counts what `DASH_ONLY_WINDOW` says:
 *   - ON (the default since the dash flip): the full pass's `sword-dash` asks. L4 (16,16) → its stairs: 39 (margin 46).
 *   - OFF (the off-default arm, ⛓ WINDOW WHOLE PASS): every unit of the attempt. L4: 84 (margin 1; it was 76 before
 *     `holdWaitPriced` added 4 units to each pass).
 * The 1-unit edge the brief named is the OFF arm's. On the shipped arm the edge is leg 108 (L12, `level_12__r0c19 <-
 * in_L0_304_176 -> exit:out_teleporter_432_352`, sweep `38845773709`, its atlas records cut to levels 12 and 33 —
 * identical answers to the uncut capture): its full pass asks 173 dash previews, keep-partial ships the 328 t plan from
 * the windows accepted by ask 85, and at 84 it ships 343 t. MARGIN 0.
 * THE MARGIN PINS (below) fail when the next default change crosses a stated floor.
 *
 * PART 2 — THE WHOLE-CHAIN DASH UNDER A `stand` TAIL (`DASH_STAND_WHOLE`, OFF). L20 (survey step 29's room: r8-d2-20's
 * boot, the Shield, then stairsup@16,48 → L13): the collect stance's approach (a 50-tick tail that ends on the ceremony
 * sample) and the `holdWaitPriced` hold stance on `lock@32,80` (131 ticks). The room has no spinner, so the press-blind
 * chain IS the window-by-window one and ON plans the same keys; what ON adds is the certificate: the whole dashed walk
 * and its whole stand, previewed once. L4's stairs leg (Part 1's) carries a stand tail too (`holdWaitPriced`'s hold on
 * `button@16,64`, 126 ticks): ON it is certified whole with the same keys and the SAME units, so the switch does not
 * move Part 1's thresholds. Leg 108 has no stand-tail corridor: ON = OFF there, unit for unit.
 *
 * ── THE MUTATION LIST (each row's catcher named) ──
 *   m1 drop the stand from the certificate (`spinnerDashWhole`'s whole preview without `standTailOpts(stand)`)
 *        → 'ON: … certified whole with its stand' and 'ON under the window: L4 …' red (0 stood ticks: the corridor
 *          falls back, `why` null, and L4's full pass spends the fallback's units)
 *   m2 shorten the certified stand by one tick (`standTailOpts({ ...stand, ticks: stand.ticks - 1 })`)
 *        → 'ON: … certified whole with its stand' and 'ON under the window: L4 …' red (130 of 131, 125 of 126)
 *   m3 move the window across L4's OFF threshold (`SOLVER_UPGRADE_WINDOW_WORK` 85 → 83)
 *        → 'THE MARGIN PIN: L4 …' and 'THE MARGIN PIN: leg 108 …' red
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { ANYTIME_PASSES, liveOf, solveAnytime, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } from './jsRuntimeSolver.js';
import { DASH_ONLY_WINDOW, withDashOnlyWindow } from './dashOnlyWindowHook.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { DASH_STAND_WHOLE, withDashStandWhole } from './solverBot.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const ENV = globalThis.process?.env ?? {};
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(MAP));

/**
 * THE MARGIN FLOORS (window − threshold), per arm: the measured margin at this slice, and the floor a pin holds. A
 * default change that moves a threshold past its floor reds the pin, so it is re-measured rather than crossed.
 */
const DASH_WINDOW_MARGIN_FLOORS = Object.freeze({
    l4: Object.freeze({ on: 40, off: 1 }),     // measured 46 / 1 (thresholds 39 / 84)
    leg108: Object.freeze({ on: 0 }),          // measured 0 (threshold 85); OFF ships its dashless 561 t at any window under 238
});

/** `dashOnlyWindow.test.js`'s witness: L4 (16,16) with the sword → its stairs (dashless 255 t, full 219 t). */
function l4StairsSword() {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [4, 16, 16] }]);
    rt.tick();
    const s = rt.session;
    const tp = rt.run.world.teleporters[0];
    return { staging: s.staging, perTick: s.perTick, live: liveOf(rt.run), levelSource: SRC, name: 'dash-window-L4',
        solverGoal: { kind: 'reach-exit', exit: { x: tp.x, y: tp.y } }, scratchPersistence: rt.run.scratchPersistence === true };
}
const counter = () => { let n = 0; return () => n++; };
/** L4 at window `w` under the arm `on` (DASH_ONLY_WINDOW): the shipped plan's ticks. */
const l4At = (w, on) => withDashOnlyWindow(on, () => solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK,
    upgradeWindowWork: w }, { clock: counter() })).plan.solution.length;

const LEG108 = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-dashwin', 'leg108-l12-request.json.gz')))
    .toString('utf8'));
/** Leg 108 at window `w` under the arm `on`: the shipped plan's ticks and pass. */
function leg108At(w, on) {
    const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(LEG108.requests[0].request);
    const a = withDashOnlyWindow(on, () => solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records),
        upgradeWindowWork: w }, { passes, clock: counter() }));
    return { ticks: a.plan.solution.length, pass: a.plan.pass, budget: tape.budgetWork };
}

describe('PART 1 — the upgrade window\'s margin, measured on L4 and on leg 108 (the window stays 85)', () => {
    it('the window and the arm are today\'s: 85, the dash-only window ON', () => {
        expect(SOLVER_UPGRADE_WINDOW_WORK).toBe(85);
        expect(SOLVER_BUDGET_WORK).toBe(640);
        if (ENV.SEEDLING_DASH_ONLY_WINDOW === undefined) expect(DASH_ONLY_WINDOW.enabled).toBe(true);
    });

    it('L4: the thresholds — ON 39 (38 keeps the partial 235 t), OFF 84 (83 ships the dashless 255 t)', () => {
        expect([l4At(39, true), l4At(38, true)]).toEqual([219, 235]);
        expect([l4At(84, false), l4At(83, false)]).toEqual([219, 255]);
    }, 120000);

    it('THE MARGIN PIN: L4 ships its full 219 t at the window minus each arm\'s floor (ON 40, OFF 1)', () => {
        const { on, off } = DASH_WINDOW_MARGIN_FLOORS.l4;
        expect(l4At(SOLVER_UPGRADE_WINDOW_WORK - on, true)).toBe(219);
        expect(l4At(SOLVER_UPGRADE_WINDOW_WORK - off, false)).toBe(219);
    }, 120000);

    it('leg 108 (L12) on the shipped arm: 328 t at 85 (the full pass, a kept partial), 343 t at 84 — the threshold IS the window', () => {
        expect(leg108At(85, true)).toEqual({ ticks: 328, pass: 'full', budget: 640 });
        expect(leg108At(84, true)).toEqual({ ticks: 343, pass: 'full', budget: 640 });
    }, 120000);

    it('THE MARGIN PIN: leg 108 ships 328 t at the window minus its floor (ON 0); OFF, its dashless 561 t', () => {
        expect(leg108At(SOLVER_UPGRADE_WINDOW_WORK - DASH_WINDOW_MARGIN_FLOORS.leg108.on, true).ticks).toBe(328);
        expect(leg108At(SOLVER_UPGRADE_WINDOW_WORK, false)).toEqual({ ticks: 561, pass: 'dashless', budget: 640 });
    }, 120000);
});

/** L20 (survey step 29's room) solved by the survey's two-pass loop, with `DASH_STAND_WHOLE` at `on` and its audit read. */
async function l20(on) {
    const tape = loadTape('r8-d2-20');
    const staging = solveStaging(stagingFromTape(tape));
    const levelSource = atlasLevelSource();
    const goals = [{ kind: 'collect-placement', placement: { x: 112, y: 48 } }, { kind: 'reach-exit', exit: { x: 16, y: 48 } }];
    const audit = [];
    DASH_STAND_WHOLE.audit = audit;
    try {
        const out = await withDashStandWhole(on, () => twoPassSolve({ goals, name: 'dash-window-L20', boot: staging.boot,
            persistence: staging.persistence, makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource) }));
        return { keys: JSON.stringify(out.out.perTick.map((k) => [...k])), ticks: out.out.perTick.length,
            audit: audit.map(({ what, ...a }) => ({ ...a, what: what.replace(/^solverBot\(dash-window-L20\) /, '') })) };
    } finally {
        DASH_STAND_WHOLE.audit = null;
    }
}

describe('PART 2 — the whole-chain dash under a `stand` tail (`DASH_STAND_WHOLE`, OFF)', () => {
    it.skipIf(ENV.SEEDLING_DASH_STAND_WHOLE !== undefined)('ships OFF, with no audit installed', () => {
        expect(DASH_STAND_WHOLE.enabled).toBe(false);
        expect(DASH_STAND_WHOLE.audit).toBe(null);
        expect(withDashStandWhole(true, () => DASH_STAND_WHOLE.enabled)).toBe(true);
        expect(DASH_STAND_WHOLE.enabled).toBe(false);
    });

    it('OFF reproduces today: L20 in 560 t; both stand-tail corridors are planned window by window (no whole-chain ask)', async () => {
        const off = await l20(false);
        expect(off.ticks).toBe(560);
        expect(off.audit.map(({ what, standTicks, whole, ticks, baseline, why }) => ({ what, standTicks, whole, ticks, baseline, why })))
            .toEqual([
                { what: 'collect (112,48) stance', standTicks: 50, whole: false, ticks: 122, baseline: 177, why: null },
                { what: 'reach-exit (16,48)->L13 -> hold stance (lock@32,80)', standTicks: 131, whole: false, ticks: 19,
                    baseline: 27, why: null },
            ]);
    }, 120000);

    it('ON: the same keys; each stand-tail dash is certified whole with its stand — the hold\'s all 131 ticks, the collect\'s to its ceremony', async () => {
        const [off, on] = [await l20(false), await l20(true)];
        expect(on.keys).toBe(off.keys);
        expect(on.audit.map(({ whole, ticks, standTicks, why }) => ({ whole, ticks, standTicks, why }))).toEqual([
            { whole: true, ticks: 122, standTicks: 50, why: 'certified whole with its 10-tick stand (hammer DASH)' },
            { whole: true, ticks: 19, standTicks: 131, why: 'certified whole with its 131-tick stand (hammer DASH)' },
        ]);
    }, 120000);

    it('ON under the window: L4\'s hold stance (button@16,64, a 126-tick stand) — the same keys AND the same units (the window does not move)', () => {
        const at = (on) => {
            const audit = [];
            DASH_STAND_WHOLE.audit = audit;
            try {
                const a = withDashStandWhole(on, () => solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK,
                    upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK }, { clock: counter() }));
                return { keys: JSON.stringify(a.plan.solution.map((k) => [...k])), passes: a.passes.map(({ ms, ...r }) => r),
                    audit: audit.map(({ standTicks, whole, ticks, baseline, why }) => ({ standTicks, whole, ticks, baseline, why })) };
            } finally {
                DASH_STAND_WHOLE.audit = null;
            }
        };
        const [off, on] = [at(false), at(true)];
        expect(on.keys).toBe(off.keys);
        expect(on.passes).toEqual(off.passes);
        expect(on.passes.map((r) => [r.ticks, r.work])).toEqual([[255, 23], [219, 61]]);
        expect(off.audit).toEqual([{ standTicks: 126, whole: false, ticks: 27, baseline: 43, why: null }]);
        expect(on.audit).toEqual([{ standTicks: 126, whole: true, ticks: 27, baseline: 43,
            why: 'certified whole with its 126-tick stand (hammer DASH)' }]);
    }, 120000);

    it('ON with no stand tail = OFF: leg 108 (no corridor of it ends standing), key for key and unit for unit', () => {
        const at = (on) => {
            const audit = [];
            DASH_STAND_WHOLE.audit = audit;
            try {
                const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(LEG108.requests[0].request);
                const a = withDashStandWhole(on, () => solveAnytime({ ...tape, source,
                    levelSource: levelSourceFromAtlas(source.records) }, { passes, clock: counter() }));
                return { keys: JSON.stringify(a.plan.solution.map((k) => [...k])), passes: a.passes.map(({ ms, ...r }) => r), audit };
            } finally {
                DASH_STAND_WHOLE.audit = null;
            }
        };
        const [off, on] = [at(false), at(true)];
        expect([off.audit, on.audit]).toEqual([[], []]);
        expect(on.keys).toBe(off.keys);
        expect(on.passes).toEqual(off.passes);
    }, 120000);
});
