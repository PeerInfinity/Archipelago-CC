/**
 * SEEDLING HAMMER-PHASE SPINNER880 — the preview meter (`PREVIEW_METER`, OFF; `SEEDLING_PREVIEW_METER=1`): every state
 * `previewWalk` samples under a FINE deadline is counted, and the drive's `walk` site is asked once more per
 * `statesPerUnit` of them (`CC/docs/cloud-reports/seedling-hammer-spinner880.md`).
 *
 * The rows (the L18 press-kill fixture `r9-solve-18`, whose kill re-derives its strike every tick):
 *   - OFF counts nothing and asks nothing more;
 *   - ON with `statesPerUnit` = ∞ is OFF byte for byte (the same answer, the same `shouldStop` calls);
 *   - ON under a deadline that never trips: the same answer, and exactly `asked` more `shouldStop` calls;
 *   - ON under OFF's own total as the budget: the meter's asks spend it, so the solve trips where OFF did not;
 *   - no deadline (or one without fine checkpoints): nothing counted, nothing asked.
 * Those rows pin the SPINNER880 meter itself, so they run with `freeStatesPerAsk` = 0 (every state charged). The
 * FLIPBLOCK row runs the shipped allowance (`CC/docs/cloud-reports/seedling-hammer-flipblock.md`): L18's previews are
 * sparse per work unit, so the allowance covers them — ON asks nothing more and is OFF byte for byte, with OFF's
 * `shouldStop` calls; and under OFF's own total as the budget it no longer trips where OFF did not.
 */

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { PREVIEW_METER, PREVIEW_METER_COUNTS, withPreviewMeter, withSolveDeadline } from './solverBot.js';

const SOURCE = atlasLevelSource();
const L18 = { tape: 'r9-solve-18', goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }] };

/** The fixture's staging, honest, the persistence rows without an `at`, no equips (solveProgress.test.js's shape). */
function stagingOf(name) {
    const base = stagingFromTape(loadTape(name));
    return { ...base, noclip: false, noDamage: false, equips: [],
        persistence: base.persistence.filter((c) => c.at === undefined) };
}

const sorted = (k, v) => (v instanceof Set ? [...v].sort() : (v instanceof Map ? [...v] : v));

/**
 * One `twoPassSolve` with the meter at `meter` (`{enabled, statesPerUnit, freeStatesPerAsk}`; an absent
 * `freeStatesPerAsk` is 0 — the SPINNER880 meter — and `'shipped'` keeps the module's own) under `deadline` (`null` = none, else
 * `(site, calls) => boolean`) with `fine` checkpoints: the answer's bytes, the `shouldStop` calls and the meter's counts.
 */
async function solve({ meter, deadline = null, fine = true }) {
    const staging = stagingOf(L18.tape);
    const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals: L18.goals, name: L18.tape, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle here'); } });
    let calls = 0;
    let promise = null;
    let report = null;
    const was = PREVIEW_METER.statesPerUnit;
    const wasFree = PREVIEW_METER.freeStatesPerAsk;
    PREVIEW_METER.statesPerUnit = meter.statesPerUnit ?? was;
    if (meter.freeStatesPerAsk !== 'shipped') PREVIEW_METER.freeStatesPerAsk = meter.freeStatesPerAsk ?? 0;
    Object.assign(PREVIEW_METER_COUNTS, { states: 0, asked: 0, tripped: 0 });
    try {
        withPreviewMeter(meter.enabled, () => {
            if (deadline === null) { promise = go(); return; }
            report = withSolveDeadline({ fineCheckpoints: fine,
                shouldStop: (site) => { calls += 1; return deadline(site, calls); } }, () => (promise = go())).deadline ?? null;
        });
    } finally {
        PREVIEW_METER.statesPerUnit = was;
        PREVIEW_METER.freeStatesPerAsk = wasFree;
    }
    const counts = { ...PREVIEW_METER_COUNTS };
    let r;
    try {
        r = { ok: true, value: await promise };
    } catch (error) {
        r = { ok: false, error };
    }
    return {
        bytes: r.ok ? JSON.stringify({ out: r.value.out, passes: r.value.passes, persistence: r.value.persistence }, sorted)
            : JSON.stringify({ name: r.error.name, message: r.error.message }),
        ok: r.ok, report, calls, counts,
    };
}

const never = () => false;

describe('PREVIEW_METER — previewed states are work (hammer-phase SPINNER880)', () => {
    it('ships OFF', () => {
        expect(PREVIEW_METER.enabled).toBe(globalThis.process?.env?.SEEDLING_PREVIEW_METER === '1');
    });

    it('OFF counts nothing; ON with statesPerUnit = ∞ is OFF byte for byte; ON asks exactly `asked` more', async () => {
        const off = await solve({ meter: { enabled: false }, deadline: never });
        expect(off.ok).toBe(true);
        expect(off.counts).toEqual({ states: 0, asked: 0, tripped: 0 });
        const inf = await solve({ meter: { enabled: true, statesPerUnit: Infinity }, deadline: never });
        expect(inf.bytes).toBe(off.bytes);
        expect(inf.calls).toBe(off.calls);
        expect(inf.counts.asked).toBe(0);
        expect(inf.counts.states).toBeGreaterThan(0);
        const on = await solve({ meter: { enabled: true }, deadline: never });
        expect(on.bytes).toBe(off.bytes);
        expect(on.counts.states).toBe(inf.counts.states);
        expect(on.counts.asked).toBeGreaterThan(0);
        expect(on.counts.asked).toBeLessThanOrEqual(Math.floor(on.counts.states / PREVIEW_METER.statesPerUnit));
        expect(on.calls).toBe(off.calls + on.counts.asked);
        expect(on.counts.tripped).toBe(0);
    }, 300000);

    it("ON under OFF's own total as the budget: the meter spends it, and the solve trips where OFF did not", async () => {
        const off = await solve({ meter: { enabled: false }, deadline: never });
        const budget = off.calls;
        const within = (site, n) => n > budget;
        const offB = await solve({ meter: { enabled: false }, deadline: within });
        expect(offB.bytes).toBe(off.bytes);
        expect(offB.report).toBe(null);
        const onB = await solve({ meter: { enabled: true }, deadline: within });
        expect(onB.ok === false || onB.report !== null).toBe(true);
        expect(onB.calls).toBeGreaterThan(budget);
    }, 300000);

    it('no deadline, or one without fine checkpoints: nothing counted, nothing asked, OFF\'s answer', async () => {
        const off = await solve({ meter: { enabled: false } });
        const on = await solve({ meter: { enabled: true } });
        expect(on.bytes).toBe(off.bytes);
        expect(on.counts).toEqual({ states: 0, asked: 0, tripped: 0 });
        const coarse = await solve({ meter: { enabled: true }, deadline: never, fine: false });
        const coarseOff = await solve({ meter: { enabled: false }, deadline: never, fine: false });
        expect(coarse.bytes).toBe(coarseOff.bytes);
        expect(coarse.calls).toBe(coarseOff.calls);
        expect(coarse.counts).toEqual({ states: 0, asked: 0, tripped: 0 });
    }, 300000);

    it('FLIPBLOCK: the shipped allowance covers sparse previews — ON is OFF byte for byte, the same calls, and '
        + "OFF's own budget no longer trips", async () => {
        expect(PREVIEW_METER.freeStatesPerAsk).toBe(1024);
        const off = await solve({ meter: { enabled: false }, deadline: never });
        const on = await solve({ meter: { enabled: true, freeStatesPerAsk: 'shipped' }, deadline: never });
        expect(on.counts.states).toBeGreaterThan(0);
        // the witness's previews are under the allowance per paid ask (else this row would not test the allowance)
        expect(on.counts.states).toBeLessThan(off.calls * PREVIEW_METER.freeStatesPerAsk);
        expect(on.counts.asked).toBe(0);
        expect(on.bytes).toBe(off.bytes);
        expect(on.calls).toBe(off.calls);
        const budget = off.calls;
        const onB = await solve({ meter: { enabled: true, freeStatesPerAsk: 'shipped' }, deadline: (site, n) => n > budget });
        expect(onB.report).toBe(null);
        expect(onB.bytes).toBe(off.bytes);
    }, 300000);
});
