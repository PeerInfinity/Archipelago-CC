/**
 * The FULL scripted certifier pass (⚖ "Native all + scripted sample", user 2026-10-21, session
 * tile-primitives-grow-levels): every region of the committed `seedling_playthrough_maze` preset on the
 * SCRIPTED tile definition, which must produce exactly the native engine's lines. The slow tier runs the
 * native pass on every region (`deriveLevelWorldLogic.slow.test.js`) and the train tier the scripted one on a
 * sample (`deriveLevelWorldLogic.train.test.js`, ⚖ Robert 2026-11-02 CI manual-only P3); this
 * is the manual tier, for a change to `tileStep.js`, the helper bodies or the certifier itself.
 *
 * ⛓ ONE TEST PER LEVEL (⚖ Robert 2026-11-15, "Split the calib test by level (Recommended)"; session tile-calib-split).
 * The certifier is separable by level: every cross-level input (landing cells, starts, the item universe, event
 * bindings, the AP reach) is built from the whole document before `regions` filters its loop, and no shared world
 * spans two levels. Measured on CI (seedling-probe 43746520659 @ 9f60a4b937): the per-level passes, concatenated in
 * level order, equal the whole pass in order, native and scripted (problems, lines, accepted, skipped). So a
 * failure names its level, and a P3 pass reads a time per level. The levels are the preset's own (each sidecar's
 * carrier `atlas_region`, in sidecar order): a new level is a new test with no edit here.
 *
 *   npm run test:unit:calib -- frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.calib.test.js
 *   npm run test:unit:calib -- frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.calib.test.js -t 'level_40:'   (one level)
 *
 * Every test runs under `vitest.calib.config.js`'s `testTimeout`. The setup stays at MODULE level, not in a
 * `beforeAll`: `playthroughPermissiveLocations()` alone took 9.8 s on CI, against a hook's default 10 s.
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
// ⛓ tile-encounter-kill-arms: `OPEN_L53` and `OPEN_L60` closed (deriveLevelWorldLogic.fixture.js's CLOSED_* note).
const OPEN = [OPEN_L63];

const SIDECARS = RULES.preset_sidecars['1'];
/** The level that owns sidecar region `name`: its carrier's `atlas_region` (a level world's first sub-region carries it). */
const levelOf = (name) => {
    const own = SIDECARS[name];
    const carrier = own.playable_payload ? own
        : Object.values(SIDECARS).find((s) => s.playable_payload && s.shared_world === own.shared_world);
    return carrier.playable_payload.atlas_region;
};
/** The partition: level → its regions, in the sidecars' own order (the certifier's iteration order). */
const LEVELS = new Map();
for (const name of Object.keys(SIDECARS)) {
    const level = levelOf(name);
    if (!LEVELS.has(level)) LEVELS.set(level, []);
    LEVELS.get(level).push(name);
}
/** An OPEN row belongs to the level whose region it starts with (`<region> → …`). */
const openIn = (regions) => OPEN.filter((row) => regions.some((r) => row.startsWith(`${r} `)));

const ran = new Map(); // level → { native, scripted } problems, filled by the level tests for the whole verdict

describe('seedling_playthrough_maze — scripted ≡ native on every region, one test per level', () => {
    it('the levels partition the preset\'s regions: each region in exactly one level', () => {
        const parts = [...LEVELS.values()].flat();
        expect([...parts].sort()).toEqual(Object.keys(SIDECARS).sort());
        expect(new Set(parts).size).toBe(parts.length);
        // and every OPEN row is owned by exactly one level, so no level test can lose it
        for (const row of OPEN) expect([...LEVELS.values()].filter((regions) => openIn(regions).includes(row))).toHaveLength(1);
    });

    for (const [level, regions] of LEVELS) {
        it(`${level}: both engines, only the named OPEN rows, the same lines`, () => {
            const opts = { atlas: ATLAS, permissive: PERMISSIVE, regions };
            const native = certifyPlaythroughMaze(RULES, HELPERS, { ...opts, native: true });
            const scripted = certifyPlaythroughMaze(RULES, HELPERS, { ...opts, native: false });
            ran.set(level, { native: native.problems, scripted: scripted.problems });
            expect(native.problems).toEqual(openIn(regions));
            expect(scripted.problems).toEqual(openIn(regions));
            expect(scripted.lines).toEqual(native.lines);
        });
    }

    // ⛓ The monolith's verdict, kept whole: every level ran, and the problems over all of them are exactly the named OPEN
    // rows (so an OPEN row that closes reds here, as it did there). Runs last; its input is what the level tests recorded.
    it('whole verdict: every level ran, and the problems over all levels are exactly the named OPEN rows', () => {
        expect([...LEVELS.keys()].filter((level) => !ran.has(level))).toEqual([]);
        expect([...LEVELS.keys()].flatMap((level) => ran.get(level).native)).toEqual(OPEN);
        expect([...LEVELS.keys()].flatMap((level) => ran.get(level).scripted)).toEqual(OPEN);
    });
});
