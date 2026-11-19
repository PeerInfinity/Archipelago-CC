/**
 * walk-seedling-whole-game.mjs — the summary is read off the instrument's
 * `[MEASURE end]` line. The fixtures are re-measure-4's own lines (A1, A′1,
 * the skip probe), with the walkEnd/why/botHead fields the instrument on main
 * adds, so the summary is pinned against the shapes a real walk printed.
 */
import { describe, expect, it } from 'vitest';

import { measureEnv, parseArgs, parseMeasureFields, summarize, summaryLine } from './walk-seedling-whole-game.mjs';

const B = 'BROWSER LOG (log): ';
const YETI = 'error: level_58__r3c3: the bot cannot walk to location \\"L58 flag 1: yeti@56,56 cleared\\" — no-verb';
const A1 = [
    `${B}[tutorial-walk-timing] seedling-whole-game: load 3.7s, start-game-page 6.3s, start-game 1.6s, bot-plays-open 0.5s, bot-plays 2988.8s`,
    `${B}[MEASURE end] seedling-whole-game t=3001s step=bot-plays checked=39 botQueue=48 botCursor=23 botChecked=24 botHead="Level 089 - Feather" botRegion="level_58__r3c3" lastRegionEvent="level_58__r3c3" regionChanges=140 wasmPushes=94 transport=wasm wasmMemMB=656 jsHeapMB=169 status="${YETI}" walkEnd=failed walkStep=bot-plays why="the app shows it cannot finish: the Playback Bot says \\"${YETI}\\""`,
].join('\n');

describe('walk-seedling-whole-game summary', () => {
    it('a refusal: N/48, the head entry, its region, the status quoted', () => {
        const s = summarize(A1);
        expect(s).toMatchObject({ reached: 24, total: 48, entry: 24, location: 'Level 089 - Feather', region: 'level_58__r3c3', skips: 0, walkS: 2988.8 });
        expect(s.cause).toMatch(/^refusal "error: level_58__r3c3: .*no-verb"$/);
        expect(summaryLine(s, 3010)).toMatch(/^24\/48, stop: entry 24 "Level 089 - Feather" in level_58__r3c3, cause: refusal .* \(transport wasm; walk 2989 s, run 3010 s\)$/);
    });

    it('a stall is named a stall, not a refusal (A′1: the 300 s bot stall)', () => {
        const status = 'Sphere 1.8 → routing via \\"level_12__r0c37 -> level_21\\" → level_25__r2c7 (5/48) — playing tick 1/858';
        const log = `${B}[MEASURE end] seedling-whole-game t=739s step=bot-plays checked=5 botQueue=48 botCursor=4 botChecked=4 botHead="Level 025 - Chest" botRegion="level_12__r0c37" transport=wasm status="${status}" walkEnd=failed walkStep=bot-plays why="the app shows it cannot finish: the Playback Bot has said \\"${status}\\" for 300 s"`;
        const s = summarize(log);
        expect(s).toMatchObject({ reached: 4, entry: 5, region: 'level_12__r0c37' });
        expect(s.cause).toMatch(/^stall ".*for 300 s"$/);
    });

    it('a budget stop says the wait ran out', () => {
        const log = `${B}[MEASURE end] seedling-whole-game t=600s step=bot-plays checked=12 botQueue=48 botCursor=7 botChecked=7 botHead="Level 019 - Boss Key 0" botRegion="level_19" transport=wasm status="Sphere 3.1 → playing tick 4/90" walkEnd=failed walkStep=bot-plays why="its done check never held"`;
        expect(summarize(log).cause).toMatch(/^budget: the step's wait ran out/);
    });

    it('the skip probe: skipped heads are not counted as reached', () => {
        const skips = Array.from({ length: 10 }, (_, i) => `${B}[MEASURE skip ${i + 1}] t=${2956 + i}s skipping entry ${24 + i}/48 "x" (sphere 6.13)`);
        const end = A1.split('\n')[1].replace('botCursor=23 botChecked=24', 'botCursor=34 botChecked=49');
        const s = summarize([...skips, end].join('\n'));
        expect(s).toMatchObject({ reached: 39, skips: 10, entry: 35 });
        expect(summaryLine(s, 1)).toMatch(/^39\/48 \(\+10 skipped\)/);
    });

    it('no [MEASURE end] line → null (the caller says nothing was measured)', () => {
        expect(summarize('[PROGRESS 1/1] tutorial-walk-seedling-whole-game FAILED')).toBeNull();
    });

    it('fields: quoted values are JSON-decoded', () => {
        expect(parseMeasureFields('[MEASURE end] a=1 b="x \\"y\\" z"')).toEqual({ a: '1', b: 'x "y" z' });
    });

    it('args → env: seed 1 and no runtime pass no knob for them; the clocks sit above the budget', () => {
        const env = measureEnv(parseArgs(['--budget-s=600']));
        expect(env).toEqual({
            TEST_MEASURE_STEP_TIMEOUT_MS: '600000', TEST_MEASURE_BOT_STALL_MS: '300000',
            TEST_AUTO_START_TIMEOUT_MS: '900000', TEST_TIMEOUT: '1200000',
        });
        expect(measureEnv(parseArgs(['--seed=2', '--runtime=js', '--skip-refusals=3']))).toMatchObject({
            TEST_MEASURE_PLAYTHROUGH_SEED: '2', TEST_MEASURE_FLASH_RUNTIME: 'js', TEST_MEASURE_SKIP_REFUSALS: '3',
        });
        expect(() => parseArgs(['--runtime=flash'])).toThrow(/wasm or js/);
        expect(() => parseArgs(['--bogus'])).toThrow(/unknown argument/);
    });
});
