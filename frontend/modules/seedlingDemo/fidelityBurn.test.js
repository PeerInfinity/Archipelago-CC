/**
 * Seedling fidelity BURN: a `burnabletree` on the frontier of a corridor is a
 * clearable obstacle, and the solver's `burn` verb clears it.
 *
 *   · The game's rule (`Scenery/BurnableTree.as`): `hit(t)` acts only on
 *     `t == "Fire"` (`:31-37`), which only `Player.fire()` passes
 *     (`Player.as:1032`, `useItem` case 1 — or case 5, the Fire Wand, which the
 *     model refuses). The tree stays SOLID through its 20-frame animation and
 *     `burnEnd -> die()` removes it 41 updates later; `removed()` writes
 *     `setPersistence(tag, false)` (`:49-54`) and `check()` removes a tree whose
 *     tag is cleared on the next build (`:56-63`). The model's `applyFire` arm
 *     has carried all of that since R5 slice 12 (`r5-l37-burn`, game-recorded).
 *   · The solver (`solverBot`): `OBSTACLE_STRATEGIES['solid:burnabletree']` is
 *     `burn`; `resolveBurnStrategy` gates on the Fire, derives a stance from
 *     `presses.auditFire` (with a LEAN where a tile centre is outside the 16 px
 *     radius), and `execBurn` selects Fire's slot, runs `runFire`'s `burns`
 *     arm and selects the old slot again.
 *   · The witnesses: `burn-l24-reach-exit` (route step 93) and
 *     `burn-l44-reach-exit` (route step 102) are the solver's own plans,
 *     authored by `scripts/procgen/plan-seedling-burn-witness.mjs` and recorded
 *     on the game by `check-seedling-bot-differential --record`; tapeRunner
 *     holds the model to the recording.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, solveSegment } from './solverBot.js';
import { buildStagedTape } from './botDriverV1.js';
import { runTape } from './tapeRunner.js';
import { HIT_TO_GONE_TICKS } from './burnableTree.js';
import { KNOWN_STRATEGY_VERBS, summarizeTrace } from './decisionTrace.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'burn-write-oracle.json'), 'utf8'));
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
/** The witness's own staging: its boot block, without the equips its solve made. */
const stagingOf = (t, items = {}) => ({
    ...t, equips: [], despawn: [], tick0: null,
    seam: { ...t.seam, items: { ...t.seam.items, ...items } },
});
const solve = (t, goal, items = {}) => {
    const staging = stagingOf(t, items);
    const run = createRunForStaging(staging, SRC);
    const out = solveSegment({ run, goals: [goal], name: `${t.name}-resolve`, boot: staging.boot });
    return { run, out, staging };
};

const CASES = [
    {
        name: 'burn-l24-reach-exit', step: 93, level: 24, to: 12,
        goal: { kind: 'reach-exit', exit: { x: 32, y: 144 } }, tree: 'burnabletree@32,128',
    },
    {
        name: 'burn-l44-reach-exit', step: 102, level: 44, to: 45,
        goal: { kind: 'reach-exit', exit: { x: 64, y: 0 } }, tree: 'burnabletree@48,64',
    },
];

describe('fidelity BURN — the `burn` verb is registered for a burnable tree', () => {
    it('the table names `burn` for `solid:burnabletree`, and the executor is registered', () => {
        expect(OBSTACLE_STRATEGIES['solid:burnabletree']).toBe('burn');
        expect(typeof STRATEGY_EXECUTORS.burn).toBe('function');
    });
});

describe.each(CASES)('fidelity BURN — route step $step ($name)', ({ name, level, to, goal, tree }) => {
    const t = tape(name);
    it(`the witness boots L${level} holding Fire, with the sword's slot selected`, () => {
        const run = createRunForStaging(stagingOf(t), SRC);
        expect(run.level).toBe(level);
        expect(run.progress('inventory')).toMatchObject({ hasFire: true, hasSword: true, hasFireWand: false });
        expect(run.progress('primaryWeapon')).toBe('sword');
        expect(run.world.burnableTrees.map((b) => b.id)).toEqual([tree]);
    });
    it(`SOLVES: burns ${tree} and crosses to L${to}, with the sword's slot selected again`, () => {
        const { run, out } = solve(t, goal);
        expect(run.level).toBe(to);
        expect(run.ledger('playerDeaths')).toEqual([]);
        const burns = out.records.filter((r) => r.strategy === 'burn');
        expect(burns.map((r) => [r.target, r.burned])).toEqual([[tree, [tree]]]);
        // The equips: Fire's slot on the press tick, the sword's slot again once the tree is gone.
        expect(out.equips.map((e) => e.slot)).toEqual([1, 0]);
        expect(out.equips[0].t).toBe(burns[0].pressTick);
        expect(run.progress('primaryWeapon')).toBe('sword');
        // The burn wrote the tree's clear (`removed()` → `setPersistence(tag, false)`).
        expect(run.earnedClears.some((c) => c.level === level && c.by === 'burnabletree')).toBe(true);
    });
    it('the trace names the `burn` verb, a KNOWN verb, on the tree', () => {
        const { out } = solve(t, goal);
        expect(KNOWN_STRATEGY_VERBS).toContain('burn');
        const row = out.trace.rows.find((r) => r.strategy.verb === 'burn');
        expect(row.obstacle?.id).toBe(tree);
        expect(summarizeTrace(out.trace).unknownStrategyVerbs).toEqual([]);
    });
    it('the committed witness IS the solver\'s plan (keys and equips)', () => {
        const { out, staging } = solve(t, goal);
        const rebuilt = buildStagedTape({
            staging: { ...staging, equips: out.equips }, perTick: out.perTick, name,
        });
        // The spans as a set: `parseTape` and the fold list the same spans in different orders.
        const spans = (inputs) => inputs.map((i) => `${i.from}-${i.to}:${i.key}`).sort();
        expect([rebuilt.tick_count, spans(rebuilt.inputs), rebuilt.equips])
            .toEqual([t.tick_count, spans(t.inputs), t.equips]);
    });
    it('D1 (game-measured): the write lands on the model\'s `goneAt` update, 41 after the first hit', () => {
        // `probe-seedling-burn-write.mjs --record`: the witness cut at `goneAt` ticks does NOT carry
        // the tree's clear on the game, and cut at `goneAt + 1` it does — `removed()` runs in the
        // update `die()` does, `HIT_TO_GONE_TICKS` after `hit()`.
        const [burn] = runTape(t, { levelSource: SRC }).treeBurns;
        const row = ORACLE.tapes.find((r) => r.tape === name);
        expect([row.tree, row.goneAt, row.burnedAt]).toEqual([tree, burn.goneAt, burn.t]);
        expect(burn.goneAt - burn.t).toBe(HIT_TO_GONE_TICKS);
        expect([row.before.cleared, row.write.cleared, row.before.ticks, row.write.ticks])
            .toEqual([false, true, burn.goneAt, burn.goneAt + 1]);
        expect(burn.flag).toEqual({ level, tag: row.tag, outOfBand: false });
    });
    it('CONTROL: the same staging WITHOUT Fire refuses by name — the tree needs Fire', () => {
        expect(() => solve(t, goal, { hasFire: false }))
            .toThrow(new RegExp(`-> burn: ${tree} cannot be burned by this run — this run does not hold FIRE`));
    });
    it('CONTROL: with the Fire Wand fusion it refuses by name — the case-5 press is not modelled', () => {
        expect(() => solve(t, goal, { hasFireWand: true }))
            .toThrow(new RegExp(`${tree} cannot be burned by this run — the run holds the FIRE WAND fusion`));
    });
});

describe('fidelity BURN — the L24 stance is a LEAN (the transcribed fire radius)', () => {
    it('the stance cell above the tree is out of reach at its centre and in reach against the tree', () => {
        const { out } = solve(tape('burn-l24-reach-exit'), CASES[0].goal);
        const rec = out.records.find((r) => r.strategy === 'burn');
        // (56,120) is the cell above the tree's right half; its centre is 19 px from the tree's
        // radius box (built with the PLAYER's originY), so the verb leans down before it presses.
        expect([rec.stance, rec.lean]).toEqual([{ x: 56, y: 120 }, 'down']);
    });
});
