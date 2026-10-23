/**
 * ⛓ rules-l39 F1 in the MAZE (⚖ the user 2026-10-23, "(a) One obstacle"): an UNCUT rope is solid over its
 * whole RUN — `RopeStart`'s hitbox is `_xend - _x + 16` wide (`RopeStart.as:26`; game-witnessed by
 * `probe-seedling-l39-pulser.mjs` span-blocked / span-cut / span-slash) — so `regionAtlasMazeProjection` lays
 * the pulley PLUS its run (the atlas row's `run`) as ONE rope obstacle: one id, the same `struck_by`, and a
 * cut on ANY of its cells clears every one. Driven through the engine on the committed
 * `seedling_playthrough_maze` preset's L16 r1c1 world, where `rope@32,16` runs (2..5, 1) and (4,1) is water.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    createState, deserializeMazeWorld, INPUT_N, step, turnInput, useInput, whyBlocked,
} from '../mazeRoom/mazeRoomEngine.js';
import { MAZE_TILE_LIB, scriptedStep } from '../mazeRoom/tileSpike/tileStep.js';
import { ropeEvents } from '../mazeRoom/tileSpike/deriveTileLogic.js';
import HELPERS from '../mazeRoom/tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const PRESET = JSON.parse(readFileSync(fileURLToPath(
    new URL('../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url)), 'utf8'));
const PAYLOAD = PRESET.preset_sidecars['1'].level_16__r1c1.playable_payload;
const world = deserializeMazeWorld(PAYLOAD);
const SWORD = 'Progressive Sword';
const SWIM = 'Progressive Swim';
const EVENT = 'L16 flag 0: rope@32,16 cleared';
/** The player one tile south of (x,1), carrying `inv`, with `broken` struck this visit. */
const below = (x, inv, broken) => ({
    ...createState(world), player_pos: { x, y: 2 }, inventory: new Set(inv), ...(broken ? { broken } : {}),
});
const entersRun = (x, inv, broken) => step(world, below(x, inv, broken), INPUT_N) !== null;

describe('L16 rope@32,16 — the pulley plus its run is ONE rope obstacle', () => {
    it('the run\'s plain cells carry one obstacle id; the water cell keeps its own gate (Swim AND the cut\'s items)', () => {
        const row1 = PAYLOAD.obstacles.filter((o) => o.y === 1).map((o) => [o.x, o.id]);
        expect(row1).toEqual([[2, 'rope_2_1'], [3, 'rope_2_1'], [4, 'atlas_gate_0'], [5, 'rope_2_1']]);
        expect(PAYLOAD.obstacleLib.rope_2_1).toMatchObject({
            kind: 'rope', struck_by: ['sword', 'spear', 'fire'], clear_set: [['sw_0']], activates: 'sw_0', event: EVENT,
        });
        expect(PAYLOAD.obstacleLib.atlas_gate_0.name).toBe('(Progressive Swim AND (Progressive Sword OR Ghost Spear OR Fire))');
    });

    it('UNCUT, every plain run cell blocks — holding the Sword is not a cut (on main\'s one-cell rope (3,1) and (5,1) were open)', () => {
        for (const x of [2, 3, 5]) {
            expect(entersRun(x, [SWORD, SWIM]), `(${x},1)`).toBe(false);
            expect(whyBlocked(world, below(x, [SWORD]), INPUT_N), `(${x},1)`).toBe('rope_2_1 is shut — needs sw_0');
        }
    });

    it('⚠ NAMED: the water cell (4,1) prices the cut by its ITEMS, not the cut itself — uncut it is open with Sword + Swim', () => {
        // One obstacle per cell, and the cell's gate is that one; the rule side prices the same crossing the same way.
        expect(entersRun(4, [SWORD, SWIM])).toBe(true);
        expect(entersRun(4, [SWORD])).toBe(false);
        expect(entersRun(4, [SWIM])).toBe(false);
    });

    it('a strike on ONE run cell (3,1) cuts the rope: none of the plain run cells blocks after it', () => {
        const struck = [turnInput('N'), useInput('sword')].reduce((s, i) => step(world, s, i), below(3, [SWORD]));
        // ONE cut state: the strike is recorded at the rope's canonical cell (`at`, the pulley), whichever cell was hit
        expect(struck.broken).toEqual(['2,1']);
        for (const x of [2, 3, 5]) expect(entersRun(x, [SWORD], struck.broken), `(${x},1)`).toBe(true);
        // the water cell is crossed once cut with Swim (its own gate), and not without it
        expect(entersRun(4, [SWORD, SWIM], struck.broken)).toBe(true);
        expect(entersRun(4, [SWORD], struck.broken)).toBe(false);
    });

    it('the carried EVENT (cut on an earlier visit) opens the whole run with nothing struck', () => {
        for (const x of [2, 3, 5]) expect(entersRun(x, [EVENT], []), `(${x},1)`).toBe(true);
    });

    it('⚠ NAMED: the game keeps the PULLEY (2,1) solid after the cut (`RopeStart.as:40-47`); the maze opens it with the run, as the atlas does', () => {
        expect(entersRun(2, [SWORD], ['3,1'])).toBe(true);
    });

    // ⇔ step / whyBlocked agree on every run cell after a cut made at ANOTHER run cell; and the scripted step
    // (tileSpike) records the same one cut state as the native engine.
    const strikeAt = (x, stepper) => [turnInput('N'), useInput('sword')].reduce((s, i) => stepper(s, i), below(x, [SWORD]));
    const native = (s, i) => step(world, s, i);
    const scripted = (s, i) => scriptedStep(world, s, i, HELPERS, MAZE_TILE_LIB).next;
    it('a strike at (5,1) opens (2,1) and (3,1) — step and whyBlocked agree on each cell', () => {
        const struck = strikeAt(5, native);
        expect(struck.broken).toEqual(['2,1']);
        for (const x of [2, 3, 5]) {
            const s = below(x, [SWORD], struck.broken);
            expect(step(world, s, INPUT_N), `(${x},1)`).not.toBeNull();
            expect(whyBlocked(world, s, INPUT_N), `(${x},1)`).toBeNull();
        }
    });
    it('scripted == native: a strike on any run cell gives the same broken state on both paths', () => {
        for (const x of [2, 3, 5]) {
            const n = strikeAt(x, native);
            const t = strikeAt(x, scripted);
            expect(t.broken, `(${x},1)`).toEqual(n.broken);
            expect(n.broken, `(${x},1)`).toEqual(['2,1']);
        }
    });
    it('the rope is ONE event target, keyed at its canonical cell (ropeEvents)', () => {
        expect(ropeEvents(world)).toEqual([{ key: '2,1', x: 2, y: 1, event: EVENT }]);
    });
});
