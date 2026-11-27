/**
 * ⛓ SEEDLING HAMMER-PHASE ENTRY-37 WALL — the train-tier witness (two ~25 s solves of the captured request).
 *
 * Request S1 37:8 (whole-game entry 37 "Level 068 - Health", the L63 → L65 exit `(128,304)`, the 2560-unit held retry;
 * re-measure-10's evidence, the same request re-measure-11 stops on), both wand keys ON (W67 + W68):
 *   - OFF: the axe-dodge refusal on `spinningaxe@128,80` (`8c781b9832a7`). MEASURED at any budget (none, 10240):
 *     AXETIMING's dash chain is refused because "the `primary` slot fires `wand`" — the run holds the sword;
 *   - `AXE_TIMING_SWORD_SWAP` ON: a plan — the full pass, 617 ticks, 0 hits on a fresh replay of its keys and equips,
 *     the sword selected at the crossing and the wand again after it; the work fits the 2560 budget.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { AXE_TIMING_SWORD_SWAP_COUNTS, withAxeTimingSwordSwap } from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE = join(HERE, '..', '..', '..', 'CC', 'docs', 'cloud-reports', 'seedling-whole-game-wasm-remeasure-10-evidence');
const WAND_KEYS = { wandShotTrapBodies: true, wandShotEnemyBodies: true };
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

const load = (file, id, i) => {
    const legs = gunzipSync(readFileSync(join(EVIDENCE, file))).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
    return legs.find((l) => l.id === id).requests.find((r) => r.i === i).request;
};

/** Solve a captured request in THIS module instance, synchronously (so the `with…` scopes hold), and price its plan. */
function solve(captured) {
    const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(captured);
    const levelSource = levelSourceFromAtlas(source.records);
    const answer = solveAnytime({ ...tape, source, levelSource }, { passes });
    const text = answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : String(answer.message ?? '');
    let hits = null;
    let equips = null;
    if (answer.ok) {
        const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null,
            scratchPersistence: tape.scratchPersistence === true });
        const h0 = run.playerHits.length;
        equips = [];
        for (const [k, held] of answer.plan.solution.entries()) {
            const slot = answer.plan.equipsAt?.get(k);
            if (slot !== undefined) { run.equipNow(slot); equips.push([k, run.progress('primaryWeapon')]); }
            run.advance(held);
        }
        hits = run.playerHits.length - h0 + run.playerDeaths.length;
    }
    return { ok: answer.ok, kind: answer.kind ?? null, answer: sha(text), message: answer.ok ? null : text, work: answer.work,
        passes: answer.passes, ticks: answer.ok ? answer.plan.solution.length : null, hits, equips, budget: tape.budgetWork };
}

describe('entry-37 wall — the captured request S1 37:8, both wand keys ON', () => {
    const req = load('S1.stop-requests-32-33-37.jsonl.gz', 37, 8);

    it('OFF: the axe-dodge refusal (the AXETIMING rung refused on the wand in `primary`)', () => {
        const r = withContactFidelity(WAND_KEYS, () => withAxeTimingSwordSwap(false, () => solve(req)));
        expect(r.kind).toBe('refusal');
        expect(r.answer).toBe('8c781b9832a7');
        expect(r.message).toContain('hazard:spinningaxe@128,80');
    }, 600000);

    it('AXE_TIMING_SWORD_SWAP ON: a hitless plan inside the 2560 budget, the sword selected for the crossing only', () => {
        AXE_TIMING_SWORD_SWAP_COUNTS.landings.length = 0;
        const r = withContactFidelity(WAND_KEYS, () => withAxeTimingSwordSwap(true, () => solve(req)));
        expect(r.ok).toBe(true);
        expect(r.answer).toBe('6fc9184e21ed');
        expect(r.ticks).toBe(617);
        expect(r.hits).toBe(0);
        expect(r.budget).toBe(2560);
        expect(r.work).toBeLessThanOrEqual(2560);
        expect(r.passes.map((p) => [p.pass, p.ok])).toEqual([['dashless', false], ['full', true]]);
        // the crossing: sword in, wand back (the plan's other equips are the walk's own spear presses)
        const at = r.equips.findIndex(([, w]) => w === 'sword');
        expect(at).toBeGreaterThan(-1);
        expect(r.equips[at + 1][1]).toBe('wand');
        // the first landing parks beside jellyfish@160,64 (the next gate refuses); the walked-on landing is clean
        expect(AXE_TIMING_SWORD_SWAP_COUNTS.landings.map((l) => l.gate)).toEqual(['jellyfish@160,64', null]);
    }, 600000);
});
