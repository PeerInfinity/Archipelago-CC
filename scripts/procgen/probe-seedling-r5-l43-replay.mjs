#!/usr/bin/env node
/**
 * probe-seedling-r5-l43-replay — ⛓⛓ THE WAND PAIR, REPLAYED HEADLESS,
 * BEFORE A `--win` RECORDING IS SPENT.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 23 step 2.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * The wand's ceremony is INPUT-BOUNDED — `NPC.update` advances on
 * `Input.released(Key.X)` — and the two consumers reach that release by
 * different routes:
 *
 *   - the MODEL's `levelRun` spends a model tick per dialogue frame and
 *     reads the TAPE's `primary` releases;
 *   - the GAME's `Bot.update` returns early on a frozen frame (the tape
 *     does not advance and dispatches no edges) and lets `autoAdvance()`
 *     press X instead.
 *
 * ⛔ Whether those two agree is a question about the ACCOUNTING of frozen
 * frames, and it is exactly the kind of asymmetry a first recording gets
 * refuted by. This replays both arms on the local Chromium — ~0.5 fps, so
 * slow, but it does not contend with a `--win` sweep — and prints the first
 * disagreement with BOTH streams on it, which is what a correction is
 * derived from ([[feedback_refuted_run_leaves_a_game_observation]]).
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l43-replay.mjs [--only=NAME]
 */

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const PAGE_URL = 'http://localhost:8000/frontend/modules/flashPanel/wasm/'
    + 'seedling_bot_ap/game.html';

const ONLY = process.argv.filter((a) => a.startsWith('--only='))
    .map((a) => a.slice('--only='.length)).pop();

const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { runTapeToStream } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));

const NAMES = ONLY ? [ONLY] : ['r5-l43-wand', 'r5-l43-wand-control'];

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

let bad = 0;
try {
    for (const name of NAMES) {
        const tape = loadTape(name);
        const page = await browser.newPage();
        const bot = (n, a) => page.evaluate(
            ([k, x]) => String(window.__swfBridge.game[k](x)), [n, a],
        );
        const botJson = async (n, a) => JSON.parse(await bot(n, a));
        console.log(`\n## ${name} — ${tape.tick_count} ticks\n`);
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480
                && !(await page.evaluate(() => !!window.__runtimeReady)); i++) {
                await page.waitForTimeout(250);
            }
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(
                () => !!(window.__swfBridge?.game?.botStatus))); i++) {
                await page.waitForTimeout(250);
            }
            if (await bot('botLoadTape', JSON.stringify(tape)) !== 'ok') {
                throw new Error('botLoadTape refused the tape');
            }
            if (await bot('botStart') !== 'ok') throw new Error('botStart refused');
            let st = null;
            for (let i = 0; i < 3600; i += 1) {
                st = await botJson('botStatus');
                if (st.finished) break;
                if (i % 30 === 0) {
                    console.log(`   … tick ${st.tick}/${st.tick_count} `
                        + `dead ${st.dead_frames} level ${st.level}`);
                }
                await page.waitForTimeout(1000);
            }
            if (!st?.finished) throw new Error(`never finished (tick ${st?.tick})`);
            const drained = await botJson('botDrain');
            const game = drained.ticks ?? [];
            const model = runTapeToStream(tape, {
                levelSource: atlasLevelSource(), roles: ROLES,
            }).ticks;
            console.log(`   game ${game.length} obs, model ${model.length} obs`);
            console.log(`   dead_frames ${st.dead_frames}  `
                + `saw_auto_advance ${st.saw_auto_advance}  `
                + `save ${JSON.stringify(st.save?.totem_parts)}  `
                + `hasWand ${st.items?.hasWand}  `
                + `cleared ${JSON.stringify(st.persistence_cleared)}`);
            let diff = -1;
            for (let i = 0; i < Math.min(game.length, model.length); i += 1) {
                if (game[i].x !== model[i].x || game[i].y !== model[i].y
                    || game[i].level !== model[i].level) { diff = i; break; }
            }
            if (diff < 0 && game.length === model.length) {
                console.log('   ✓ BYTE-IDENTICAL');
            } else {
                bad += 1;
                console.log(`   ⛔ FIRST DIVERGENCE at ${diff < 0 ? 'length' : diff}`);
                for (let i = Math.max(0, diff - 2); i < Math.min(diff + 6, game.length); i += 1) {
                    console.log(`      t${i}  game (${game[i]?.x}, ${game[i]?.y}) L${game[i]?.level}`
                        + `   model (${model[i]?.x}, ${model[i]?.y}) L${model[i]?.level}`);
                }
            }
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
if (bad > 0) process.exitCode = 1;
