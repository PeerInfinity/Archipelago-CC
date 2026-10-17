/**
 * seedlingDemo/hammerDashShape.test — ⛓⛓⛓ SEEDLING DB: THE CHEAPER DASH SEARCH, BEHIND THREE SWITCHES
 * (`solverBot.js`: `DASH_LEG_PRECHECK`, `DASH_NO_SWING_PREFIX`, `DASH_KEEP_PARTIAL`; ⚖ the user 2026-10-16, *"Build
 * the best shape, OFF"*; ⛓ dash flip, the user 2026-10-16, *"Prepare the flip"*: (i) and (iii) ship ON, (ii) OFF). Named `hammer*` because it is a hammer-phase slice, so the arc's bounded vitest set
 * (`hammer*`) picks it up beside the other hammer-phase switches.
 *
 * The rows, and the corridors they stand on:
 *   · the leg pre-check's boundary, on a real corridor: sweep 38845773709's request 478:0 (L52, committed as
 *     `fixtures/dash-shape/sweep-478-l52.json`, its staging plus two level records). A single waypoint at (148,116)
 *     walks an undashed leg of exactly 235 ticks, and one at (148,115) exactly 236. The rows measure both legs first,
 *     so a moved world fails here by name rather than in the boundary row;
 *   · the same request solved whole (`solveAnytime`, budget 640, window 0, the way DS replayed it): the ticks are
 *     identical ON and OFF, and the work drops;
 *   · the keep, on `r9-solve-0`'s first corridor in L0 (its committed trace: 7 windows, 64 previews, 237 → 145 t),
 *     with a counting deadline handed to `planSwordDash` directly. In place there is no deadline, so the keep can
 *     only be seen this way until the JS arc's dash-only window lands.
 * Every switch is set by its own `with…` inside the row and restored after it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { levelSourceFromAtlas } from './atlasSource.js';
import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import { solveAnytime } from './jsRuntimeSolver.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import {
    DASH_CHAIN_PREFIXES, DASH_KEEP_PARTIAL, DASH_KEEP_PARTIAL_DEFAULT, DASH_LEG_PRECHECK, DASH_LEG_PRECHECK_DEFAULT,
    DASH_LEG_PRECHECK_MARGIN, DASH_NO_SWING_PREFIX,
    PREVIEW_AGREEMENT_BOUND, dashLegPrecheck, dashPrefixesFor, deriveKillByChaser, planSwordDash, previewWalk,
    strikePolicyFor, withDashKeepPartial, withDashLegPrecheck, withDashNoSwingPrefix, withSolveDeadline,
} from './solverBot.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';

const SWEEP = JSON.parse(readFileSync(new URL('./fixtures/dash-shape/sweep-478-l52.json', import.meta.url), 'utf8'));
const sweepSource = levelSourceFromAtlas({ levels: SWEEP.records });
const sweepRun = () => createRunForStaging(SWEEP.staging, sweepSource, { scratchPersistence: SWEEP.scratchPersistence });
/** The two corridors at the pre-check's boundary (measured: the first row asserts their legs). */
/** The pre-check's edge: the longest undashed leg it still scans (195 + 40, read from the module). */
const EDGE = PREVIEW_AGREEMENT_BOUND + DASH_LEG_PRECHECK_MARGIN;
const LEG_235 = [{ x: 148, y: 116 }];
const LEG_236 = [{ x: 148, y: 115 }];

/** The undashed walk's legs, previewed the way `planSwordDash`'s own baseline is. */
function undashedLegs(run, wps, tolerance) {
    const strike = strikePolicyFor(run, { dashPlan: null, dashMode: 'all', iframeLapse: true });
    const legs = [];
    for (const s of previewWalk(run, wps, tolerance, { strike }).samples) legs[s.wp] = (legs[s.wp] ?? 0) + 1;
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

    it('the margin is 40 over the agreement bound 195: 235 is the longest undashed leg scanned', () => {
        expect(DASH_LEG_PRECHECK_MARGIN).toBe(40);
        expect(PREVIEW_AGREEMENT_BOUND).toBe(195);
        withDashLegPrecheck(true, () => {
            expect(dashLegPrecheck([12, 235, 40])).toBeNull();
            expect(dashLegPrecheck([12, 236, 40])).toMatch(/^DASH_LEG_PRECHECK: the UNDASHED walk's longest leg is 236 tick\(s\), past PREVIEW_AGREEMENT_BOUND 195 \+ DASH_LEG_PRECHECK_MARGIN 40 = 235/);
        });
        withDashLegPrecheck(false, () => expect(dashLegPrecheck([1000])).toBeNull());
    });
});

describe('seedling DB (i) — DASH_LEG_PRECHECK: a corridor past the bound by more than the margin is not scanned', () => {
    it('the two corridors measure 235 and 236 ticks on their one undashed leg', () => {
        expect(undashedLegs(sweepRun(), LEG_235, DEFAULT_TOLERANCE)).toEqual([235]);
        expect(undashedLegs(sweepRun(), LEG_236, DEFAULT_TOLERANCE)).toEqual([236]);
    });

    it(`ON, the ${EDGE}-tick corridor still scans, exactly as OFF; the ${EDGE + 1}-tick one refuses by name with nothing scanned`, () => {
        // A deadline after two previews bounds each scan: "scans" is "previews a candidate", and OFF/ON must agree.
        const plan = (wps) => withSolveDeadline(counter(3), () => planSwordDash(sweepRun(), wps, { tolerance: DEFAULT_TOLERANCE }));
        const off235 = withDashLegPrecheck(false, () => plan(LEG_235));
        const on235 = withDashLegPrecheck(true, () => plan(LEG_235));
        expect(off235.scanned).toBe(2);
        expect(JSON.stringify(on235)).toBe(JSON.stringify(off235));

        const off236 = withDashLegPrecheck(false, () => plan(LEG_236));
        const on236 = withDashLegPrecheck(true, () => plan(LEG_236));
        expect(off236.scanned).toBe(2);
        expect(on236).toMatchObject({ plan: null, baseline: 236, scanned: 0, candidates: [] });
        expect(on236.why).toMatch(/^DASH_LEG_PRECHECK: the UNDASHED walk's longest leg is 236 tick\(s\)/);
        // it asked its deadline once (the corridor's entry), and never before a preview
        const asks = counter(Number.MAX_SAFE_INTEGER);
        withDashLegPrecheck(true, () => withSolveDeadline(asks, () => planSwordDash(sweepRun(), LEG_236, { tolerance: DEFAULT_TOLERANCE })));
        expect(asks.asked).toEqual(['sword-dash']);
    }, 60_000);

    it('ON, sweep request 478:0 solved whole ships the same ticks for less work', () => {
        const solve = () => solveAnytime({ staging: SWEEP.staging, perTick: [], live: SWEEP.live, solverGoal: SWEEP.solverGoal,
            name: SWEEP.from.name, scratchPersistence: SWEEP.scratchPersistence, equips: null, budgetWork: SWEEP.budgetWork,
            upgradeWindowWork: null, levelSource: sweepSource });
        const off = withDashLegPrecheck(false, solve);
        const on = withDashLegPrecheck(true, solve);
        expect(off.ok && on.ok).toBe(true);
        expect(on.plan.solution.length).toBe(off.plan.solution.length);
        expect(on.plan.solution).toEqual(off.plan.solution);
        expect(on.work).toBeLessThan(off.work);
        // OFF the full pass spends the budget on the 381-tick leg's scan; ON it refuses that corridor by name
        expect(off.passes.find((p) => p.pass === 'full')).toMatchObject({ ok: false, deadline: 'sword-dash', limit: 'budget' });
    }, 120_000);
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
