/**
 * ⛓ SEEDLING HAMMER-PHASE L65→L68 HIT — the train-tier witness of `WALK_BLADE_ARM` (three ~20 s solves).
 *
 * Whole-game entry 37 past its wall: request S1 37:8 (re-measure-10's committed evidence, L63 → L65 `(128,304)`) is
 * solved with `AXE_TIMING_SWORD_SWAP` ON (617 t, 0 hits; its swap selects the wand again after the crossing), and the
 * next leg is chained from its end exactly as a host would (the earlier leg's keys and equips as the prefix): L65 →
 * L68 `(184,64)` from L65 (136,24) at t617, the request's own 640 / 85 budgets, both wand keys ON.
 *   - OFF: SOLVED with one model hit, `chaser:bob@208,80` at t1282, in both passes; no budget cut (so a held retry on a
 *     budget cut never applies), the hit-avoid pass cut by its window. The plan ships the hit.
 *   - ON: the walk selects the held sword before its walks through strike bodies, and the leg solves HITLESS in both
 *     passes (593 t); a fresh replay of the prefix + plan takes no hit.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, budgetCut, liveOf, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { withAxeTimingSwordSwap } from './solverBot.js';
import { WALK_BLADE_ARM_COUNTS, resetWalkBladeArmCounts, withWalkBladeArm } from './walkBladeArm.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE = join(HERE, '..', '..', '..', 'CC', 'docs', 'cloud-reports', 'seedling-whole-game-wasm-remeasure-10-evidence');
const WAND_KEYS = { wandShotTrapBodies: true, wandShotEnemyBodies: true };
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

const load = (file, id, i) => {
    const legs = gunzipSync(readFileSync(join(EVIDENCE, file))).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
    return legs.find((l) => l.id === id).requests.find((r) => r.i === i).request;
};

/** The next leg's request: the earlier leg's keys and equips appended to the prefix, the live digest re-taken. */
function chainNext(tape, plan, solverGoal, levelSource) {
    const off = tape.perTick.length;
    const perTick = [...tape.perTick, ...plan.solution];
    const equips = new Map([...(tape.equips ?? new Map())]);
    for (const [t, s] of plan.equipsAt ?? []) equips.set(t + off, s);
    const run = replayTape({ staging: tape.staging, perTick, levelSource, equips, scratchPersistence: tape.scratchPersistence === true });
    return { ...tape, perTick, equips, live: liveOf(run), solverGoal, budgetWork: 640, upgradeWindowWork: 85 };
}

/** The hits a fresh replay of `tape`'s prefix + `plan` takes on the plan's own ticks. */
function replayHits(tape, plan, levelSource) {
    const off = tape.perTick.length;
    const equips = new Map([...tape.equips, ...[...plan.equipsAt].map(([t, s]) => [t + off, s])]);
    const run = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...plan.solution], levelSource, equips,
        scratchPersistence: tape.scratchPersistence === true });
    return run.ledger('playerHits').filter((h) => h.t > off).map((h) => `${h.source}:${h.id}@t${h.t}`);
}

describe('L65 → L68 (184,64), chained from S1 37:8, both wand keys ON', () => {
    const captured = load('S1.stop-requests-32-33-37.jsonl.gz', 37, 8);
    const { passes = ANYTIME_PASSES, source, ...tape0 } = restoreRequest(captured);
    const levelSource = levelSourceFromAtlas(source.records);
    const solve = (t) => solveAnytime({ ...t, source, levelSource }, { passes });
    // the prefix leg, with the swap ON and the arm OFF (the arrival the brief names: the wand selected at t617)
    let leg = null;
    const legOf = () => {
        leg ??= withContactFidelity(WAND_KEYS, () => withAxeTimingSwordSwap(true, () => withWalkBladeArm(false, () => {
            const a = solve(tape0);
            return chainNext(tape0, a.plan, { kind: 'reach-exit', exit: { x: 184, y: 64 } }, levelSource);
        })));
        return leg;
    };

    it('OFF: the plan solves with the bob\'s hit in both passes, no budget cut, and ships it', () => {
        const t = legOf();
        expect(t.perTick.length).toBe(617);
        expect(t.live.row).toMatchObject({ level: 65, x: 136, y: 24 });
        const a = withContactFidelity(WAND_KEYS, () => withAxeTimingSwordSwap(true, () => withWalkBladeArm(false, () => solve(t))));
        expect(a.ok).toBe(true);
        expect(sha(JSON.stringify(a.plan.solution.map((k) => [...k])))).toBe('b66bb6016c58');
        expect(a.plan.solution.length).toBe(695);
        expect(a.passes.map((p) => [p.pass, p.ticks, p.modelHits?.hits ?? null])).toEqual([
            ['dashless', 697, 1], ['full', 695, 1], ['hit-avoid', null, null]]);
        expect(a.passes[2].cut).toBe('window');
        expect(budgetCut(a)).toBe(false);
        expect(withContactFidelity(WAND_KEYS, () => replayHits(t, a.plan, levelSource))).toEqual(['chaser:bob@208,80@t1282']);
    }, 600000);

    it('WALK_BLADE_ARM ON: the sword is selected for the walks and the leg solves hitless in both passes', () => {
        const t = legOf();
        resetWalkBladeArmCounts();
        const a = withContactFidelity(WAND_KEYS, () => withAxeTimingSwordSwap(true, () => withWalkBladeArm(true, () => solve(t))));
        expect(a.ok).toBe(true);
        expect(sha(JSON.stringify(a.plan.solution.map((k) => [...k])))).toBe('00ff039aabc7');
        expect(a.plan.solution.length).toBe(593);
        expect(a.passes.map((p) => [p.pass, p.ticks, p.modelHits?.hits ?? null])).toEqual([['dashless', 667, 0], ['full', 593, 0]]);
        expect(a.work).toBeLessThanOrEqual(640);
        // the arm selected the sword (slot 0 of [0,1,3,2]) at the leg's first walk, the wand selected, in each pass
        expect(WALK_BLADE_ARM_COUNTS.rows.slice(0, 2)).toEqual([
            { t: 617, level: 65, from: 'wand', slot: 0 }, { t: 617, level: 65, from: 'wand', slot: 0 }]);
        expect(a.plan.equipsAt.get(0)).toBe(0);
        expect(withContactFidelity(WAND_KEYS, () => replayHits(t, a.plan, levelSource))).toEqual([]);
    }, 600000);
});
