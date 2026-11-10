/**
 * The FULL scripted certifier pass (⚖ "Native all + scripted sample", user 2026-10-21, session
 * tile-primitives-grow-levels): every region of the committed `seedling_playthrough_maze` preset on the
 * SCRIPTED tile definition, which must produce exactly the native engine's lines. The slow tier runs the
 * native pass on every region (`deriveLevelWorldLogic.slow.test.js`) and the train tier the scripted one on a
 * sample (`deriveLevelWorldLogic.train.test.js`, ⚖ Robert 2026-11-02 CI manual-only P3); this
 * is the manual tier, for a change to `tileStep.js`, the helper bodies or the certifier itself.
 *
 *   npm run test:unit:calib -- frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.calib.test.js
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import { playthroughPermissiveLocations } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const PERMISSIVE = playthroughPermissiveLocations();
// ⛓ The one row the slow tier pins OPEN by name (`OPEN_L63` in deriveLevelWorldLogic.slow.test.js, whose expectation this
// mirrors: a test file cannot be imported without registering its suites). Session tile-rules-automation-r-a1 found this
// file still expecting no problem at all after OPEN_L63 was named, which would red every P3 calib pass.
const OPEN_L63 = 'level_63__r6c9 → level_63__r0c1 holding [Ghost Spear,L63 flag 7: lightpole@112,272 cleared]: derived true, atlas false';

describe('seedling_playthrough_maze — scripted ≡ native on every region', () => {
    it('every region, both engines, only the named OPEN row and the same lines', () => {
        const native = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS, permissive: PERMISSIVE });
        const scripted = certifyPlaythroughMaze(RULES, HELPERS, { native: false, atlas: ATLAS, permissive: PERMISSIVE });
        expect(native.problems).toEqual([OPEN_L63]);
        expect(scripted.problems).toEqual([OPEN_L63]);
        expect(scripted.lines).toEqual(native.lines);
    // ⚖ Robert 2026-11-09, via the liaison: "Raise to 1,200 s (Recommended)" (session tile-rules-automation-r-a4b). Measured on CI,
    // normalised to each run's own L40 scripted time: the control 2d1283375e projects to ~875 s and the R-A4b tip (sided openers)
    // to ~976 s on the slowest runner seen, so 1,200 s leaves ~23% headroom. Only this test's limit: `vitest.calib.config.js`'s
    // `testTimeout` stays, and a per-test limit overrides it (measured: with this one raised, the test passed at 971 s).
    }, 1_200_000);
});
