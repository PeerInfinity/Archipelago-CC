/**
 * The SCRIPTED tile definition (`scriptedStep` + the helper bodies) on the fixed `SAMPLE` of `seedling_playthrough_maze`
 * regions, which must agree line for line with the NATIVE engine on the same regions.
 *
 * ⚖ Robert 2026-11-02 CI manual-only P3: TRAIN tier — moved out of `deriveLevelWorldLogic.slow.test.js`, which runs on
 * every push. This SUPERSEDES the 2026-10-21 ruling "Native all + scripted sample" for push: it runs on js-land/** train
 * pushes and on dispatch (`-f train=true`). design-2's rule: a slice that touches tileStep.js, maze_tiles.helpers.json,
 * maze_tiles.py or an engine primitive runs it (CI dispatch or cloud, not the box) before designer review, and reports it.
 * The full scripted pass over EVERY region stays the calib tier's (`deriveLevelWorldLogic.calib.test.js`).
 *
 *   npm run test:unit:train -- frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.train.test.js
 */
import { describe, it, expect } from 'vitest';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { RULES, ATLAS, SAMPLE, OPEN_L63, PERMISSIVE } from './deriveLevelWorldLogic.fixture.js';

describe('seedling_playthrough_maze — the scripted tile definition on the sample', () => {
    it('scripted tile definition on the sample — and it agrees with the native one', () => {
        for (const r of SAMPLE) expect(Object.keys(RULES.preset_sidecars['1'])).toContain(r);
        // ⛓ the native lines it is compared with — the same call the slow tier's native case makes for its own sample checks.
        const sampleLines = certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions: SAMPLE, atlas: ATLAS, permissive: PERMISSIVE }).lines;
        const { problems, lines } = certifyPlaythroughMaze(RULES, HELPERS, { native: false, regions: SAMPLE, atlas: ATLAS, permissive: PERMISSIVE });
        expect(problems).toEqual([OPEN_L63]);
        expect(lines).toEqual(sampleLines);
        // ⛓ RULES l63-pole-crossings: the poles' Ghost Sword arm grows L63's subset universe 4x; measured scripted on its two
        // sample regions, main's preset 18.6 + 17.8 s → 61.7 + 58.8 s (+84 s over the ~450 s pass), so 600 s left too thin a margin.
    }, 900_000);
});
