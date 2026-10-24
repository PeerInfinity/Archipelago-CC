/**
 * The FULL scripted certifier pass (⚖ "Native all + scripted sample", user 2026-10-21, session
 * tile-primitives-grow-levels): every region of the committed `seedling_playthrough_maze` preset on the
 * SCRIPTED tile definition, which must produce exactly the native engine's lines. The slow tier runs the
 * native pass on every region and the scripted one on a sample (`deriveLevelWorldLogic.slow.test.js`); this
 * is the manual tier, for a change to `tileStep.js`, the helper bodies or the certifier itself.
 *
 *   npm run test:unit:calib -- frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.calib.test.js
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));

describe('seedling_playthrough_maze — scripted ≡ native on every region', () => {
    it('every region, both engines, no problem and the same lines', () => {
        const native = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS });
        const scripted = certifyPlaythroughMaze(RULES, HELPERS, { native: false, atlas: ATLAS });
        expect(native.problems).toEqual([]);
        expect(scripted.problems).toEqual([]);
        expect(scripted.lines).toEqual(native.lines);
    }, 900_000);
});
