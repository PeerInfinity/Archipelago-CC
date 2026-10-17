/**
 * seedlingDemo/hammerDashShape.test — ⛓⛓⛓ SEEDLING DB: THE CHEAPER DASH SEARCH, BEHIND THREE SWITCHES
 * (`solverBot.js`: `DASH_LEG_PRECHECK`, `DASH_NO_SWING_PREFIX`, `DASH_KEEP_PARTIAL`; ⚖ the user 2026-10-16, *"Build
 * the best shape, OFF"*; ⛓ dash flip, the user 2026-10-16, *"Prepare the flip"*: (i) and (iii) ship ON, (ii) OFF). Named `hammer*` because it is a hammer-phase slice, so the arc's bounded vitest set
 * (`hammer*`) picks it up beside the other hammer-phase switches.
 *
 * The rows, and the corridors they stand on:
 *   · ⛓ Seedling DK (⚖ the user, 2026-10-17: *"Fix the skip's cutoff first"*) — the leg pre-check's boundary is a
 *     leg's FLOOR (`dashLegFloor`, a clean run's ticks less what one window's ground saves at its own rate), not DB's
 *     tick margin of 40. On a real corridor: sweep 38845773709's request 392:0 (L40, committed as
 *     `fixtures/dash-shape/sweep-392-l40.json`, its staging plus the records of L40 and L43). With its first waypoint
 *     at (488,680) and its second at (217,680), leg 1 is a clean run of 237 ticks over 271.5 px, floor 195; at
 *     (214,680), 238 ticks over 274.9 px, floor 196. The rows measure both legs first, so a moved world fails here by
 *     name rather than in the boundary row;
 *   · the same request solved whole (`solveAnytime`, budget 640, window 0, the way DS replayed it): the ticks are
 *     identical ON and OFF, and the work drops (its 261-tick leg over 303 px is floor 220);
 *   · the D2 counter-example (DF, `seedling-dash-flip.md`): `axe-l48-reach-l49`'s corridor has a 305-tick undashed
 *     leg, a 192 px climb and then the walk dithering at its waypoint. It is not a clean run, so it SCANS, and the
 *     producer plans its 368-tick tape (K = 40 refused it: 585 t);
 *   · DB's L52 corridor (request 478:0, `sweep-478-l52.json`): a room with a waterfall refuses nothing;
 *   · the keep, on `r9-solve-0`'s first corridor in L0 (its committed trace: 7 windows, 64 previews, 237 → 145 t),
 *     with a counting deadline handed to `planSwordDash` directly. In place there is no deadline, so the keep can
 *     only be seen this way until the JS arc's dash-only window lands.
 * Every switch is set by its own `with…` inside the row and restored after it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { AXE_WITNESSES, axePlan, axeStaging } from '../../../scripts/procgen/plan-seedling-axe-witness.mjs';

import { levelSourceFromAtlas } from './atlasSource.js';
import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import { solveAnytime } from './jsRuntimeSolver.js';
import { createLevelRun } from './levelRun.js';
import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import {
    DASH_CHAIN_PREFIXES, DASH_KEEP_PARTIAL, DASH_KEEP_PARTIAL_DEFAULT, DASH_LEG_PRECHECK, DASH_LEG_PRECHECK_DEFAULT,
    DASH_LEG_CLEAN_PATH, DASH_LEG_CLEAN_STILL, DASH_NO_SWING_PREFIX,
    PREVIEW_AGREEMENT_BOUND, dashLegFloor, dashLegGain, dashLegPrecheck, dashLegRuns, dashPrefixesFor,
    deriveKillByChaser, planSwordDash, previewWalk,
    strikePolicyFor, withDashKeepPartial, withDashLegPrecheck, withDashNoSwingPrefix, withSolveDeadline,
} from './solverBot.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';

const SWEEP = JSON.parse(readFileSync(new URL('./fixtures/dash-shape/sweep-478-l52.json', import.meta.url), 'utf8'));
const sweepSource = levelSourceFromAtlas({ levels: SWEEP.records });
const sweepRun = () => createRunForStaging(SWEEP.staging, sweepSource, { scratchPersistence: SWEEP.scratchPersistence });
/** DB's L52 corridor: one waypoint whose undashed leg is a clean run of 289 ticks (floor 196), in a waterfall room. */
const L52_CLEAN = [{ x: 175, y: 120 }];

/** ⛓ Seedling DK: sweep request 392:0 (L40), the pit corridor whose leg 1 is the pre-check's boundary. */
const PIT = JSON.parse(readFileSync(new URL('./fixtures/dash-shape/sweep-392-l40.json', import.meta.url), 'utf8'));
const pitSource = levelSourceFromAtlas({ levels: PIT.records });
const pitRun = () => createRunForStaging(PIT.staging, pitSource, { scratchPersistence: PIT.scratchPersistence });
/** The boundary: leg 1 a clean run at floor 195 (still scanned) and at floor 196 (refused); measured by the first row. */
const FLOOR_195 = [{ x: 488, y: 680 }, { x: 217, y: 680 }];
const FLOOR_196 = [{ x: 488, y: 680 }, { x: 214, y: 680 }];

/** The D2 counter-example: `axe-l48-reach-l49`'s first corridor (tick 0), as `walkTo` asked `planSwordDash` it. */
const AXE = AXE_WITNESSES.find((w) => w.name === 'axe-l48-reach-l49');
const AXE_WPS = [[120, 280], [136, 264], [200, 264], [200, 248], [232, 248], [232, 56], [184, 56]].map(([x, y]) => ({ x, y }));
/** The axe producer's own fidelity pin (`plan-seedling-axe-witness.mjs`, `PINNED_FIDELITY`). */
const AXE_FIDELITY = { waypointSlide: false };

/** The undashed walk, previewed the way `planSwordDash`'s own baseline is. */
function undashedWalk(run, wps, tolerance) {
    const strike = strikePolicyFor(run, { dashPlan: null, dashMode: 'all', iframeLapse: true });
    return previewWalk(run, wps, tolerance, { strike });
}
function undashedLegs(run, wps, tolerance) {
    const legs = [];
    for (const s of undashedWalk(run, wps, tolerance).samples) legs[s.wp] = (legs[s.wp] ?? 0) + 1;
    return [...legs].map((n) => n ?? 0);
}

/** A deterministic deadline: answers false `n` times, then true (and records every site it was asked for). */
function counter(n) {
    const asked = [];
    return { asked, shouldStop: (site) => { asked.push(site); return asked.length > n; } };
}

const L0 = parseTape(JSON.parse(readFileSync(new URL('./fixtures/tapes/r9-solve-0.json', import.meta.url), 'utf8')));
const l0Run = () => createLevelRun({
    levelSource: atlasLevelSource(), boot: L0.boot, noclip: false, noHazards: L0.noHazards, noDamage: false,
    grants: L0.grants, persistence: L0.persistence, despawn: [], equips: L0.equips, pins: L0.pins ?? [],
    save: L0.save ?? null, rng: L0.rng ?? null, seam: L0.seam ?? null, roles: ROLES,
});
/** `r9-solve-0`'s first walk corridor, off its committed trace (tick 0). */
const L0_WPS = [{ x: 136, y: 200 }, { x: 136, y: 184 }, { x: 72, y: 184 }, { x: 72, y: 200 }, { x: 40, y: 200 }];
const planL0 = () => planSwordDash(l0Run(), L0_WPS, { tolerance: DEFAULT_TOLERANCE });
// The (iii) rows read the corridor's COMMITTED trace (every prefix, no pre-check), so they pin (i) and (ii) OFF: an
// env-ON run of this file (`SEEDLING_DASH_NO_SWING_PREFIX=1 …`) would otherwise drop `[0]` and re-count the scan.
const planL0Committed = () => withDashLegPrecheck(false, () => withDashNoSwingPrefix(false, planL0));

const SWITCHES = [
    ['DASH_LEG_PRECHECK', DASH_LEG_PRECHECK, withDashLegPrecheck],
    ['DASH_NO_SWING_PREFIX', DASH_NO_SWING_PREFIX, withDashNoSwingPrefix],
    ['DASH_KEEP_PARTIAL', DASH_KEEP_PARTIAL, withDashKeepPartial],
];

// ⛓ dash flip (the user, 2026-10-16: *"Prepare the flip"*): (i) and (iii) ship ON; (ii) stays OFF (⚖ 45(b), every prefix).
const SHIPS = { DASH_LEG_PRECHECK: true, DASH_NO_SWING_PREFIX: false, DASH_KEEP_PARTIAL: true };

describe(`seedling DB — the ${SWITCHES.length} switches ship at their flip defaults, and \`with…\` restores them`, () => {
    for (const [name, sw, withIt] of SWITCHES) {
        it.skipIf(globalThis.process?.env?.[`SEEDLING_${name}`] !== undefined)(`${name} ships ${SHIPS[name] ? 'ON' : 'OFF'}`, () => {
            expect(sw.enabled).toBe(SHIPS[name]);
        });

        it(`with${name} sets and restores it, also on a throw`, () => {
            const was = sw.enabled;
            expect(withIt(true, () => sw.enabled)).toBe(true);
            expect(sw.enabled).toBe(was);
            expect(withIt(false, () => sw.enabled)).toBe(false);
            expect(() => withIt(true, () => { throw new Error('boom'); })).toThrow('boom');
            expect(sw.enabled).toBe(was);
        });
    }

    it('the flipped switches name their default (G1\'s flip shape: `SEEDLING_<NAME>=0` opts a process out)', () => {
        expect(DASH_LEG_PRECHECK_DEFAULT).toBe(true);
        expect(DASH_KEEP_PARTIAL_DEFAULT).toBe(true);
    });

    it('⛓ DK: one window adds at most 48.8 px (derived), and a clean run\'s floor is its ticks less that ground at its own rate', () => {
        expect(PREVIEW_AGREEMENT_BOUND).toBe(195);
        expect(dashLegGain()).toBeCloseTo(48.8, 9);
        expect([DASH_LEG_CLEAN_PATH, DASH_LEG_CLEAN_STILL]).toEqual([1.05, 2]);
        // the L40 pit's leg 1 (sweep 392:0), as measured
        const clean = { n: 261, span: 303.3, path: 303.3, line: 303.3, still: 1 };
        expect(dashLegFloor(clean)).toBe(Math.ceil(261 - 48.8 * 261 / 303.3));
        expect(dashLegFloor(clean)).toBe(220);
        // not a clean run: no floor (what it spent beyond travel, a dash can remove whole)
        expect(dashLegFloor({ ...clean, still: 3 })).toBeNull();
        expect(dashLegFloor({ ...clean, path: 303.3 * 1.051 })).toBeNull();
        expect(dashLegFloor({ ...clean, path: 303.3 * 1.05 })).toBe(220);
        withDashLegPrecheck(false, () => expect(dashLegPrecheck(pitRun(), undashedWalk(pitRun(), FLOOR_196, DEFAULT_TOLERANCE))).toBeNull());
    }, 60_000);
});

describe('seedling DK (i) — DASH_LEG_PRECHECK: a corridor with a clean leg no window can bring under the bound is not scanned', () => {
    it('the boundary corridors measure leg 1 a clean run at floor 195 and at floor 196', () => {
        const at = (wps) => {
            const run = pitRun();
            const legs = dashLegRuns(undashedWalk(run, wps, DEFAULT_TOLERANCE).samples, run.state);
            return { n: legs.map((l) => l.n), span: +legs[1].span.toFixed(1), floor: dashLegFloor(legs[1]) };
        };
        expect(at(FLOOR_195)).toEqual({ n: [198, 237], span: 271.5, floor: 195 });
        expect(at(FLOOR_196)).toEqual({ n: [198, 238], span: 274.9, floor: 196 });
    }, 60_000);

    it('ON, the floor-195 corridor still scans, exactly as OFF; the floor-196 one refuses by name with nothing scanned', () => {
        // A deadline after two previews bounds each scan: "scans" is "previews a candidate", and OFF/ON must agree.
        const plan = (wps) => withSolveDeadline(counter(3), () => planSwordDash(pitRun(), wps, { tolerance: DEFAULT_TOLERANCE }));
        const off195 = withDashLegPrecheck(false, () => plan(FLOOR_195));
        const on195 = withDashLegPrecheck(true, () => plan(FLOOR_195));
        expect(off195.scanned).toBe(2);
        expect(JSON.stringify(on195)).toBe(JSON.stringify(off195));

        const off196 = withDashLegPrecheck(false, () => plan(FLOOR_196));
        const on196 = withDashLegPrecheck(true, () => plan(FLOOR_196));
        expect(off196.scanned).toBe(2);
        expect(on196).toMatchObject({ plan: null, baseline: 198 + 238, scanned: 0, candidates: [] });
        expect(on196.why).toMatch(/^DASH_LEG_PRECHECK: the UNDASHED walk's leg 1 is a clean run of 238 tick\(s\) over 274\.9 px; .* no fewer than 196 tick\(s\)/);
        // it asked its deadline once (the corridor's entry), and never before a preview
        const asks = counter(Number.MAX_SAFE_INTEGER);
        withDashLegPrecheck(true, () => withSolveDeadline(asks, () => planSwordDash(pitRun(), FLOOR_196, { tolerance: DEFAULT_TOLERANCE })));
        expect(asks.asked).toEqual(['sword-dash']);
    }, 60_000);

    it('ON, sweep request 392:0 solved whole ships the same ticks for less work', () => {
        const solve = () => solveAnytime({ staging: PIT.staging, perTick: [], live: PIT.live, solverGoal: PIT.solverGoal,
            name: PIT.from.name, scratchPersistence: PIT.scratchPersistence, equips: null, budgetWork: PIT.budgetWork,
            upgradeWindowWork: null, levelSource: pitSource });
        const off = withDashLegPrecheck(false, solve);
        const on = withDashLegPrecheck(true, solve);
        expect(off.ok && on.ok).toBe(true);
        expect(on.plan.solution.length).toBe(828);
        expect(on.plan.solution).toEqual(off.plan.solution);
        expect(on.work).toBeLessThan(off.work);
        // OFF the full pass spends the budget on the 261-tick leg's scan; ON it refuses that corridor by name
        expect(off.passes.find((p) => p.pass === 'full')).toMatchObject({ ok: false, deadline: 'sword-dash', limit: 'budget' });
    }, 180_000);

    it('the D2 counter-example: the axe corridor\'s 305-tick leg is not a clean run, so ON it SCANS, exactly as OFF', async () => {
        const staging = await axeStaging(AXE);
        const run = () => createRunForStaging(staging, atlasLevelSource());
        await withContactFidelity(AXE_FIDELITY, async () => {
            const r = run();
            const legs = dashLegRuns(undashedWalk(r, AXE_WPS, DEFAULT_TOLERANCE).samples, r.state);
            expect(legs.map((l) => l.n)).toEqual([26, 20, 56, 17, 30, 305, 39]);
            // a 192 px climb walked over a 305 px path: the walk dithers at its waypoint
            expect(+legs[5].line.toFixed(1)).toBe(192.4);
            expect(legs[5].path).toBeGreaterThan(DASH_LEG_CLEAN_PATH * legs[5].line);
            expect(dashLegFloor(legs[5])).toBeNull();
            const plan = () => planSwordDash(run(), AXE_WPS, { tolerance: DEFAULT_TOLERANCE });
            const off = withDashLegPrecheck(false, plan);
            const on = withDashLegPrecheck(true, plan);
            expect(off.plan).not.toBeNull();
            expect(JSON.stringify(on)).toBe(JSON.stringify(off));
        });
    }, 60_000);

    it('the D2 counter-example whole: ON, `plan-seedling-axe-witness` plans axe-l48-reach-l49 at 368 ticks (K = 40: 585)', async () => {
        const { solved } = await withContactFidelity(AXE_FIDELITY, () => withDashLegPrecheck(true, () => axePlan(AXE)));
        expect(solved.out.perTick.length).toBe(368);
        expect(solved.out.dashes.windows).toBe(8);
    }, 180_000);

    it('a room with a waterfall refuses nothing: DB\'s L52 corridor, a clean run of 289 ticks (floor 196), scans ON as OFF', () => {
        const r = sweepRun();
        const legs = dashLegRuns(undashedWalk(r, L52_CLEAN, DEFAULT_TOLERANCE).samples, r.state);
        expect(legs.map((l) => [l.n, dashLegFloor(l)])).toEqual([[289, 196]]);
        expect(undashedLegs(sweepRun(), L52_CLEAN, DEFAULT_TOLERANCE)).toEqual([289]);
        const plan = () => withSolveDeadline(counter(3), () => planSwordDash(sweepRun(), L52_CLEAN, { tolerance: DEFAULT_TOLERANCE }));
        const off = withDashLegPrecheck(false, plan);
        const on = withDashLegPrecheck(true, plan);
        expect(off.scanned).toBe(2);
        expect(JSON.stringify(on)).toBe(JSON.stringify(off));
    }, 60_000);
});

describe('seedling DB (ii) — DASH_NO_SWING_PREFIX: `all` without the swing-only prefix', () => {
    it('ON, `all` lacks [0] and keeps every longer prefix, for either weapon; `full` and `none` are unchanged', () => {
        for (const weapon of ['sword', 'ghostsword']) {
            const off = withDashNoSwingPrefix(false, () => dashPrefixesFor('all', { weapon }));
            const on = withDashNoSwingPrefix(true, () => dashPrefixesFor('all', { weapon }));
            expect(off[0]).toEqual([0]);
            expect(on).toEqual(off.filter((p) => p.length > 1));
            expect(on.length).toBe(off.length - 1);
            for (const mode of ['full', 'none']) {
                expect(withDashNoSwingPrefix(true, () => dashPrefixesFor(mode, { weapon })))
                    .toEqual(withDashNoSwingPrefix(false, () => dashPrefixesFor(mode, { weapon })));
            }
        }
        expect(withDashNoSwingPrefix(false, () => dashPrefixesFor('all'))).toBe(DASH_CHAIN_PREFIXES);
        expect(withDashNoSwingPrefix(true, () => dashPrefixesFor('full'))).toEqual([DASH_CHAIN_PREFIXES.at(-1)]);
    });

    it('ON, the L0 scan previews no swing-only candidate, and names the narrower set', () => {
        const on = withDashNoSwingPrefix(true, planL0);
        expect(on.prefixes).toBe(DASH_CHAIN_PREFIXES.length - 1);
        expect(on.candidates.length).toBeGreaterThan(0);
        expect(on.candidates.every((c) => c.prefix.length > 1)).toBe(true);
    }, 60_000);
});

describe('seedling DB (iii) — DASH_KEEP_PARTIAL: a `sword-dash` trip keeps the windows already accepted', () => {
    const full = planL0Committed();

    it('the corridor: 7 windows over 64 previews, 237 → 145 t (its committed trace)', () => {
        expect(full).toMatchObject({ baseline: 237, ticks: 145, scanned: 64 });
        expect(full.windows).toHaveLength(7);
    }, 60_000);

    /**
     * The trip point: inside the start tick of the 3rd window, after one of its candidates CERTIFIED but before the
     * scan finished that start tick. The asks are the corridor's entry, then one per preview, so a trip at ask
     * `evaluated + 2` has previewed `evaluated` candidates.
     */
    const tripInside = (k) => {
        const at = full.windows[k].at;
        const idx = full.candidates.map((c, i) => (c.at === at ? i : -1)).filter((i) => i >= 0);
        const certified = idx.find((i) => full.candidates[i].certified && i < idx.at(-1));
        return { evaluated: certified + 1, lastOfWindow: (w) => Math.max(...full.candidates
            .map((c, i) => (c.at === w.at ? i : -1))) };
    };

    it('ON, a trip after k accepted windows ships exactly those k; OFF drops them all', () => {
        const { evaluated, lastOfWindow } = tripInside(2);
        // the in-flight start tick already holds a certified candidate: keeping it would be keeping an unaccepted window
        expect(full.candidates.slice(0, evaluated).some((c) => c.certified && c.at === full.windows[2].at)).toBe(true);
        const kept = full.windows.filter((w) => lastOfWindow(w) < evaluated);
        expect(kept).toEqual(full.windows.slice(0, 2));
        const trip = () => withSolveDeadline(counter(evaluated + 1), planL0Committed);

        const on = withDashKeepPartial(true, trip);
        expect(on.plan).not.toBeNull();
        expect(on.kept).toBe('deadline');
        expect(on.windows).toEqual(kept);
        expect(on.scanned).toBe(evaluated);
        // the ticks are the 2nd window's own accepted candidate's: the walk the kept schedule produces
        const second = full.candidates.find((c) => c.certified && c.at === kept[1].at
            && c.prefix.join() === kept[1].prefix.join());
        expect(on.ticks).toBe(second.ticks);
        expect(on.saved).toBe(237 - second.ticks);
        expect(on.plan.windows.map((w) => w.pattern)).toEqual(kept.map((w) => w.prefix));
        expect(on.deadline).toMatchObject({ first: 'sword-dash', sites: { 'sword-dash': 1 } });

        const off = withDashKeepPartial(false, trip);
        expect(off).toMatchObject({ plan: null, why: 'deadline', baseline: 237, windows: null });
        expect('kept' in off).toBe(false);
    }, 60_000);

    it('ON, a trip before any window is accepted still refuses `deadline` (at the entry, and at the first preview)', () => {
        for (const n of [0, 1]) {
            const on = withDashKeepPartial(true, () => withSolveDeadline(counter(n), planL0Committed));
            expect(on).toMatchObject({ plan: null, why: 'deadline' });
        }
    }, 60_000);

    it('ON, an untripped scan is the scan OFF, byte for byte (no `kept` key)', () => {
        const on = withDashKeepPartial(true, planL0Committed);
        expect(JSON.stringify(on)).toBe(JSON.stringify(full));
    }, 60_000);

    it('ON, a trip at another site keeps nothing and drops nothing: the dash scan runs whole', () => {
        // `kill-chaser` trips first (L14's stance rung, asked at its entry), and `sword-dash` never does
        const l14 = () => createLevelRun({
            levelSource: atlasLevelSource(), boot: { level: 14, x: 160, y: 64 }, noclip: false, noHazards: [],
            noDamage: false, grants: [], persistence: [], despawn: [], equips: [], pins: ['dead_frames'],
            save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        });
        const asked = [];
        const out = withDashKeepPartial(true, () => withSolveDeadline({ shouldStop: (site) => {
            asked.push(site);
            return site !== 'sword-dash';
        } }, () => {
            const run = l14();
            const body = run.strikeBodies.find((b) => b.id === 'bob@32,32');
            const kill = deriveKillByChaser(run, { ...body }, new Set(),
                { aim: null, allowTeleporter: null, tolerance: DEFAULT_TOLERANCE });
            expect(kill.stance).toBeNull();
            return planL0Committed();
        }));
        expect(asked[0]).toBe('kill-chaser');
        expect(out.deadline).toMatchObject({ first: 'kill-chaser' });
        const { deadline, ...rest } = out;
        expect(JSON.stringify(rest)).toBe(JSON.stringify(full));
    }, 60_000);
});
