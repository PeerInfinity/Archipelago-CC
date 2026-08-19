#!/usr/bin/env node
/**
 * probe-seedling-l59-l67 — the gold-key room's three unknowns, live.
 *
 * ⚠ SUPERSEDED by `probe-seedling-l67-reach2.mjs` (the pair that answered
 * the reach question). This probe was routed on a hand-drawn tile grid that
 * was wrong in three cells, and its scripted verdict line misread the
 * trace. Kept because its trace settled two facts the hard way: (10,6) and
 * (10,7) are PITS (the lightpole merely STANDS on one), and `die()` is an
 * in-place respawn at the current world's BOOT tile with ~18 dead frames,
 * after which the tape keeps running. See kickoff §10.6.
 *
 * Region-atlas Phase 8, rung R4, §10.2/§10.3's second probe. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §10.
 *
 * L67 is the intended-play walkthrough's west gold-key puzzle room
 * ("use the spear on it from across the gaps to move it correctly"), and
 * three claims about it are source readings no recording has tested:
 *
 *   1  the spear's 32 px rect pushes a block TWO tiles away, across a pit
 *      (`pushableblockspear@144,112` at (9,7), pressed from (11,7) with
 *      the pit (10,7) between)
 *   2  `LightPole` does not block (type "LightPole", absent from the
 *      player's solid list) — the row-6 corridor crosses one at (10,6)
 *   3  §8.5's facing-direction table — a W press from (11,7) should send
 *      the block toward (8,7), which the extract says is PIT, which
 *      `destroy` (fade + remove) says destroys it — CONTRADICTING the
 *      walkthrough's "move the block onto the button". Something gives.
 *
 * SHAPE. Boot at (11,7), face W, spear once. Then walk N → W along row 6
 * (crossing the lightpole cell) → S into the block's own cell (9,7):
 *
 *   x pins ≈ (10,6)'s east face on the W leg    → the lightpole BLOCKS
 *   final y reaches ≈ 120 (into (9,7))          → the block LEFT its cell:
 *                                                  2-tile across-pit reach
 *                                                  ORACLE-CONFIRMED
 *   final y stops ≈ 110 (the block's north face) → reach-2 FAILED; the
 *                                                  walkthrough's phrase
 *                                                  means something else
 *
 * Run: node scripts/procgen/probe-seedling-l59-l67.mjs
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const WASM_DIR = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

if (!existsSync(WASM_DIR)) {
    console.log(`SKIP: no wasm artifact at ${WASM_DIR}`);
    process.exit(0);
}

const TICKS = 125;

const tape = {
    tape_version: 4,
    game: 'seedling',
    name: 'probe-l67-reach2',
    description: 'Across-pit spear press at the key-room block, then walk into its cell.',
    boot: { level: 67, x: 176, y: 112 },
    noclip: false,
    noDamage: true,
    noHazards: ['water', 'lava', 'ice', 'waterfall'],
    grants: [{ level: 67, items: ['sword', 'spear'] }],
    persistence: [],
    equips: [{ t: 0, slot: 1 }],
    tick_count: TICKS,
    inputs: [
        { key: 'left', from: 5, to: 6 },        // face W; ~2 px drift, stays on (11,7)
        { key: 'primary', from: 12, to: 13 },   // the across-pit press
        { key: 'up', from: 20, to: 40 },        // (11,7) -> (11,6)
        { key: 'left', from: 45, to: 90 },      // row 6 W across the lightpole cell
        { key: 'down', from: 95, to: 120 },     // into (9,7) if the block left it
    ],
};

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const bot = (name, a) => page.evaluate(
    ([n, x]) => String(window.__swfBridge.game[n](x)), [name, a],
);
const botJson = async (name, a) => JSON.parse(await bot(name, a));

try {
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) {
        await page.waitForTimeout(250);
    }
    await page.click('#btn-start');
    for (let i = 0; i < 480
        && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
        await page.waitForTimeout(250);
    }

    console.log('l67 probe: across-pit reach-2 press, lightpole crossing, cell re-entry');
    const loaded = await bot('botLoadTape', JSON.stringify(tape));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    if (await bot('botStart') !== 'ok') throw new Error('botStart refused');

    let last = null;
    let stalledSince = null;
    const STALL_FRAMES = 120;
    const DEADLINE = Date.now() + 30 * 60 * 1000;
    for (;;) {
        const st = await botJson('botStatus');
        const line = `tick=${st.tick}/${st.tick_count} dead=${st.dead_frames} `
            + `x=${Number(st.x).toFixed(2)} y=${Number(st.y).toFixed(2)} err=${st.error ?? ''}`;
        if (line !== last) { console.log(`  ${line}`); last = line; }
        if (st.finished) break;
        if (st.tick === stalledSince?.tick && st.dead_frames > stalledSince.dead + STALL_FRAMES) {
            throw new Error(`tape stalled at tick ${st.tick} (dead=${st.dead_frames})`);
        }
        if (st.tick !== stalledSince?.tick) stalledSince = { tick: st.tick, dead: st.dead_frames };
        if (Date.now() > DEADLINE) throw new Error('deadline');
        await page.waitForTimeout(1000);
    }

    const drained = await botJson('botDrain');
    const ticks = drained.ticks ?? [];
    const at = (t) => ticks.find((o) => o.t === t) ?? {};
    const westStop = at(88);
    const finals = at(TICKS - 1);
    console.log(`\n  after W leg (t=88):  x=${westStop.x} y=${westStop.y}`);
    console.log(`  final (t=${TICKS - 1}):     x=${finals.x} y=${finals.y}`);

    if (westStop.x > 166) {
        console.log('⛔ THE LIGHTPOLE BLOCKS: the W leg pinned east of (10,6). The census');
        console.log('   entry ("LightPole does not block") is wrong — re-derive the corridor.');
    } else {
        console.log('✅ the W leg crossed the lightpole cell — LightPole does not block.');
        if (finals.y > 116) {
            console.log('✅ THE BLOCK LEFT (9,7): the 2-tile ACROSS-PIT press is ORACLE-CONFIRMED.');
            console.log('   (Whether it rests on (8,7) or sank there is the next question —');
            console.log('   this probe only proves the reach and the vacated cell.)');
        } else {
            console.log('⛔ THE BLOCK IS STILL AT (9,7): the reach-2 press did NOT move it.');
            console.log('   Either the spear rect is shorter than modelled or the press path');
            console.log('   differs — §8.5\'s press-cell sweeps used the wrong reach either way.');
        }
    }
} catch (e) {
    console.error(`\nPROBE FAILED: ${e.message}`);
    console.error(logs.slice(-25).join('\n'));
    process.exitCode = 1;
} finally {
    await browser.close();
}
