/**
 * The level-world CERTIFIER (`certifyPlaythroughMaze.js`) on the committed `seedling_playthrough_maze` preset
 * (⚖ "Certifier", user 2026-10-21). ⚖ Tier split (user, 2026-10-21, session tile-primitives-grow-levels:
 * "Native all + scripted sample"): here, EVERY region on the NATIVE engine (⚖ Q6 "native default"), and the
 * SCRIPTED tile definition (⚖ Q3 "one def; logic by search" — `scriptedStep` + the helper bodies) on a fixed
 * SAMPLE, which must agree with the native lines for the same regions. The full scripted pass over every
 * region is the calib tier's (`deriveLevelWorldLogic.calib.test.js`): measured over the whole game it is
 * 346 s scripted against 50 s native.
 *
 * The sample: both shared level worlds the parity was built on (L15, L16) and one per-sub-region level (L14).
 *
 * Slow tier: ~35 s native (every region, then the sample again for its lines) + ~86 s scripted sample on one
 * core (measured 2026-10-21, L13–L17).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const SAMPLE = ['level_14', 'level_15__r1c5', 'level_15__r1c9', 'level_15__r6c8', 'level_16__r1c1', 'level_16__r4c21'];

describe('seedling_playthrough_maze — every region certified against the atlas at every subset', () => {
    let sampleLines;
    it('native engine, every region', () => {
        const { problems, lines } = certifyPlaythroughMaze(RULES, HELPERS, { native: true });
        expect(problems).toEqual([]);
        expect(lines.length).toBeGreaterThan(0);
        sampleLines = certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions: SAMPLE }).lines;
    }, 300_000);
    it('scripted tile definition on the sample — and it agrees with the native one', () => {
        for (const r of SAMPLE) expect(Object.keys(RULES.preset_sidecars['1'])).toContain(r);
        const { problems, lines } = certifyPlaythroughMaze(RULES, HELPERS, { native: false, regions: SAMPLE });
        expect(problems).toEqual([]);
        expect(lines).toEqual(sampleLines);
    }, 600_000);
});
