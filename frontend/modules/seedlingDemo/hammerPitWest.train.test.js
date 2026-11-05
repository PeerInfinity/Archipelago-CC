// TRAIN tier (⚖ Robert 2026-11-02 CI manual-only P5): the hammer solves run on js-land/** train pushes and on dispatch
// (`-f train=true`), NOT on a slice push. `npm run test:unit:train`.
/**
 * seedlingDemo/hammerPitWest.train.test — ⛓⛓ SEEDLING HAMMER-PHASE PIT-WEST: the L40 west pit corridor from the L39
 * arrival (census wall G). ⚖ The user queued the slice on 2026-11-05 (the L40 census's step 6).
 *
 * The states are the page's own requests for L40 legs 387/388 (`level_40__r23c29 <- in_L39_144_0 ->
 * exit:out_pit_13_21` / `_14_21`), captured at `97739720dd` (their first ask, the page's 640 work units), atlas records
 * cut to levels 40 and 43 (byte-identical answers to the uncut capture, OFF and ON). The route to the pits is a one-tile
 * maze with four live chasers standing in it at spawn; the smallest removal set admitting a corridor has size 4, so the
 * chooser, C1 and CPAIR (size 3) answer EMPTY and the kill rung gets no target.
 *   - OFF: the page's refusal (the anytime deadline, the dashless pass in DETOUR's via set).
 *   - `CHOOSER_CUT` ON: the cut `bob@192,480` (the hit's) + the rest is offered, the chaser arm kills the bob, and the walk
 *     reaches the pit — SOLVED hitless inside the page's 640 units, its plan replayed on a fresh run (⚖ 30(c)).
 *   - `DETOUR_VIA_BOUND` ON (alone): the same EXHAUSTED refusal by name, no deadline, a fraction of the work.
 * Leg 367 (CPAIR's fixture, the same arrival → `out_pit_5_21`, whose climb a TRIPLE answers) is the control: the cut is
 * never asked and ON = OFF. The L16 guard re-derives `r9-solve-16` with both switches ON.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import {
    CHOOSER_CUT_COUNTS, DETOUR_VIA_BOUND, resetChooserCutCounts, solveSegment, withChooserCut, withDetourViaBound,
} from './solverBot.js';
import { buildTape } from './botDriverV1.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (dir, name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', dir, name))).toString('utf8'));
const LEG387 = fixture('hammer-pit-west', 'leg387-l40-l43-request.json.gz');
const LEG388 = fixture('hammer-pit-west', 'leg388-l40-l43-request.json.gz');
const LEG367 = fixture('hammer-cpair', 'leg367-l40-l43-request.json.gz');

/** A captured request solved as the page asks it (its passes, its budget), the two switches as given. */
function solveLeg(row, { cut = false, bound = false, budget = undefined } = {}) {
    const req = restoreRequest(row.requests[0].request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    resetChooserCutCounts();
    const bounded0 = DETOUR_VIA_BOUND.counts.bounded;
    const answer = withChooserCut(cut, () => withDetourViaBound(bound, () => solveAnytime({ ...tape, source,
        levelSource, ...(budget === undefined ? {} : { budgetWork: budget }) }, { passes })));
    return {
        ok: answer.ok, work: answer.work,
        message: answer.ok ? null : String(answer.message),
        plan: answer.ok ? answer.plan : null,
        keys: answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : null,
        counts: JSON.parse(JSON.stringify(CHOOSER_CUT_COUNTS)),
        bounded: DETOUR_VIA_BOUND.counts.bounded - bounded0,
        fresh: () => freshReplay(tape, source, answer.plan),
    };
}

/** ⚖ 30(c): the plan's keys on a FRESH run of the request's staging, row by row against the plan's expected rows. */
function freshReplay(tape, source, plan) {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const rowOf = () => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
    const hits0 = run.playerHits.length;
    const diverged = [];
    if (JSON.stringify(rowOf()) !== JSON.stringify(plan.expected[0])) diverged.push(-1);
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        const want = plan.expected[k + 1];
        if (want && JSON.stringify(rowOf()) !== JSON.stringify(want)) diverged.push(k);
    }
    return { diverged: diverged.length, hits: run.playerHits.length - hits0, deaths: run.playerDeaths.length, level: run.level };
}

const EXHAUSTED = 'the combat ladder is EXHAUSTED. The corridor passes through danger at (216.5,504.6) — chaser:bob@192,480';

describe('hammer-phase PIT-WEST — the L40 west pit corridor (`CHOOSER_CUT`, `DETOUR_VIA_BOUND`)', () => {
    it('388 OFF at the page\'s 640: the deadline, as the page fails it', () => {
        const off = solveLeg(LEG388);
        expect(off.ok).toBe(false);
        expect(off.message).toContain('the caller\'s anytime deadline');
        expect(off.counts.asked).toBe(0);
        expect(off.bounded).toBe(0);
    }, 240_000);

    it('388 CHOOSER_CUT ON: the cut holds bob@192,480 and three more; the chaser arm kills it and the walk reaches the '
        + 'pit — SOLVED hitless inside 640, its plan replayed on a fresh run', () => {
        const on = solveLeg(LEG388, { cut: true });
        expect(on.ok).toBe(true);
        expect(on.work).toBeLessThanOrEqual(640);
        expect(on.plan.verbs).toEqual(['kill', 'walk']);
        expect(on.plan.solution.length).toBe(1156);
        expect(on.counts.cuts[0].hit).toBe('bob@192,480');
        expect(on.counts.cuts[0].set[0]).toBe('bob@192,480');
        expect(on.counts.cuts[0].set).toHaveLength(4);
        expect(on.counts.cuts[0].set).toContain('puncher@128,624');
        expect(on.fresh()).toEqual({ diverged: 0, hits: 0, deaths: 0, level: 43 });
    }, 240_000);

    it('387 CHOOSER_CUT ON: the same cut, SOLVED hitless inside 640 to out_pit_13_21', () => {
        const on = solveLeg(LEG387, { cut: true });
        expect(on.ok).toBe(true);
        expect(on.work).toBeLessThanOrEqual(640);
        expect(on.plan.solution.length).toBe(1034); // the full pass's upgrade (the dashless pass answers 1111)
        expect(on.counts.cuts[0].set[0]).toBe('bob@192,480');
        expect(on.fresh()).toEqual({ diverged: 0, hits: 0, deaths: 0, level: 43 });
    }, 240_000);

    it('388 DETOUR_VIA_BOUND ON alone, the deadline lifted (40960): OFF\'s EXHAUSTED refusal by name, its detour row refused before a leg', () => {
        const on = solveLeg(LEG388, { bound: true, budget: 40960 });
        expect(on.ok).toBe(false);
        expect(on.message).toContain(EXHAUSTED);
        expect(on.message).toContain('(DETOUR_VIA_BOUND)');
        expect(on.message).not.toContain('anytime deadline');
        expect(on.bounded).toBe(2); // one per pass
        expect(on.work).toBeLessThan(200);
    }, 240_000);

    it('388 both ON = CHOOSER_CUT alone (the cut answers before DETOUR is asked)', () => {
        const cut = solveLeg(LEG388, { cut: true });
        const both = solveLeg(LEG388, { cut: true, bound: true });
        expect([both.ok, both.work, both.keys]).toEqual([cut.ok, cut.work, cut.keys]);
    }, 360_000);

    it('367 (a triple answers its climb): the cut is never asked, and ON = OFF', () => {
        const off = solveLeg(LEG367);
        const on = solveLeg(LEG367, { cut: true });
        expect(on.counts.asked).toBe(0);
        expect([on.ok, on.work, on.keys, on.message]).toEqual([off.ok, off.work, off.keys, off.message]);
    }, 360_000);

    it('the L16 guard: with both switches ON the solver re-derives r9-solve-16', () => {
        const raw = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'r9-solve-16.json'), 'utf8'));
        const levelSource = atlasLevelSource();
        const [exit] = levelSource(16).entities.filter((x) => ['stairsup', 'stairsdown', 'teleporter'].includes(x.type)
            && Number(x.attrs?.to) === 18);
        const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(raw))));
        resetChooserCutCounts();
        const out = withChooserCut(true, () => withDetourViaBound(true, () => solveSegment({
            run: createRunForStaging(staging, levelSource), goals: [{ kind: 'reach-exit', exit: { x: exit.x, y: exit.y } }],
            name: raw.name, boot: staging.boot, dashMode: 'all' })));
        const sorted = (inputs) => inputs.map((r) => JSON.stringify(r)).sort();
        const inputs = buildTape(out.perTick, raw.boot, raw.name,
            { noclip: false, noDamage: false, noHazards: [], grants: [] }).inputs;
        expect(out.perTick.length).toBe(raw.tick_count);
        expect(sorted(inputs)).toEqual(sorted(raw.inputs));
        expect(CHOOSER_CUT_COUNTS.admitted).toBe(0);
    }, 120_000);
});
