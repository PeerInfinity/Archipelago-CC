/**
 * spearPush — SEEDLING FIDELITY PUSHBLOCK (wave 11): the `solid:pushableblockspear`
 * row, and the `shove` verb's THRUST arm.
 *
 * The route survey refused five steps on L63/L65/L67 with *"No strategy row
 * exists for this obstacle"*. The rooms are R4's three push rooms; the search
 * (`deriveBlockRoute`'s `pressMoves`) re-derives R4's hand-written pushes, and
 * only the SPEAR moves the block (`pushables.PUSH_SPEAR_DIRECTION`,
 * game-measured: a sword slash leaves `spearDirection` at -1).
 *
 * Boots are the survey's own construction (`r8-solve-11`'s latch re-pointed at
 * the room, timed clears stripped) with the Spear in `seam.items`, which is what
 * the survey's `saveGrant` hands these steps (route step 114, `Ghost Spear` ->
 * `seam.items.hasSpear`).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, solveSegment } from './solverBot.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const levelSource = atlasLevelSource();

function staged(level, x, y, { spear = true } = {}) {
    const tape = parseTape(JSON.parse(readFileSync(
        join(HERE, 'fixtures', 'tapes', 'r8-solve-11.json'), 'utf8')));
    const staging = solveStaging(stagingFromTape(tape));
    staging.boot = { level, x, y };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    if (spear) staging.seam = { ...staging.seam, items: { ...(staging.seam?.items ?? {}), hasSpear: true } };
    return { run: createRunForStaging(staging, levelSource), boot: staging.boot };
}

const solve = (level, x, y, goal, opts) => {
    const { run, boot } = staged(level, x, y, opts);
    try {
        return { run, out: solveSegment({ run, goals: [goal], name: `spear-push-${level}`, boot }) };
    } catch (e) {
        return { run, error: e };
    }
};
const shoveRow = (rows) => rows.find((r) => r.strategy?.verb === 'shove');

describe('PUSHBLOCK: the strategy row', () => {
    it('a spear block is a `shove` obstacle, and `shove` is registered', () => {
        expect(OBSTACLE_STRATEGIES['solid:pushableblockspear']).toBe('shove');
        expect(typeof STRATEGY_EXECUTORS.shove).toBe('function');
    });
});

describe('PUSHBLOCK: L65 (route steps 146 and 148)', () => {
    it('from L63@(128,16): R4\'s three thrusts — W, N across the pit, W into the pit — and the room crosses to L68', () => {
        const { run, out, error } = solve(65, 128, 16, { kind: 'reach-exit', exit: { x: 184, y: 64 } });
        expect(error).toBeUndefined();
        expect(run.level).toBe(68);
        expect(run.playerHits).toEqual([]);
        // ⛓ wave-11 harvest: 541 → 539 with DARKTRAP2's `spearingWindow` ON (the light arm's sword presses inside the
        // spear's window are gated, as on the game) — DARKTRAP2's predicted "146 SOLVED 539", game-witnessed.
        expect(out.perTick.length).toBe(539);
        const rec = out.records.find((r) => r.strategy === 'shove');
        expect(rec.steps.map((s) => [s.verb, s.to])).toEqual([
            ['press', { tx: 10, ty: 8 }], ['press', { tx: 10, ty: 7 }], ['press', { tx: 9, ty: 7 }],
        ]);
        // ⚠ The trace's rows for a SOLVED segment carry no `shove` row here; the RECORD is the claim.
        expect(rec.steps.map((s) => s.verb)).toEqual(['press', 'press', 'press']);
        expect(rec).toMatchObject({ verb: 'press', dir: 'W', destroys: true, weapon: 'spear' });
    });

    it('from L68@(185,80): one thrust E opens the way back to L63', () => {
        const { run, out, error } = solve(65, 185, 80, { kind: 'reach-exit', exit: { x: 128, y: 0 } });
        expect(error).toBeUndefined();
        expect(run.level).toBe(63);
        const rec = out.records.find((r) => r.strategy === 'shove');
        expect(rec).toMatchObject({ verb: 'press', dir: 'E', to: { tx: 12, ty: 8 }, weapon: 'spear' });
    });

    it('the spear is SELECTED for each thrust and the old slot selected again after', () => {
        const { out } = solve(65, 185, 80, { kind: 'reach-exit', exit: { x: 128, y: 0 } });
        const rec = out.records.find((r) => r.strategy === 'shove');
        expect(rec.slot).toBe(1);
        expect(rec.restoredSlot).toBe(0);
    });
});

describe('PUSHBLOCK: without the spear the refusal names the item', () => {
    it('L65: "the run holds NO SPEAR", not "No strategy row exists"', () => {
        const { error } = solve(65, 128, 16, { kind: 'reach-exit', exit: { x: 184, y: 64 } }, { spear: false });
        expect(error?.message).toMatch(/holds NO SPEAR/);
        expect(error?.message).not.toMatch(/No strategy row exists/);
    });
});

describe('PUSHBLOCK: L63 (route steps 145/180) resolves the thrust R4 made', () => {
    it('one thrust E from the cell west of the block sinks it into the pit at (8,6)', () => {
        const { error } = solve(63, 16, 96, { kind: 'reach-exit', exit: { x: 128, y: 304 } });
        // ⚠ The walk to the stance then refuses in the DarkTrap light arm (a handover, not this verb):
        // the row is the claim here.
        const row = shoveRow(error?.rows ?? []);
        expect(row.strategy).toMatchObject({ dir: 'E', to: { tx: 8, ty: 6 }, destroys: true });
    });
});
