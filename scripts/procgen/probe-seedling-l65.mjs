#!/usr/bin/env node
/**
 * probe-seedling-l65 — does a spear press actually move L65's block, and
 * which way?
 *
 * Region-atlas Phase 8, rung R4, §10.5's decisive probe. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §10.3.
 *
 * §8.5 ruled health SEALED from a SOURCE READING of the push path
 * (`_relative` returns before `moveTypes`; the block moves one tile in the
 * player's FACING direction). No recording has ever tested that reading,
 * and the intended-play walkthrough describes push choreography the sweep's
 * assumptions exclude — the R3 lesson says the oracle, not the source,
 * settles it.
 *
 * THE DISCRIMINATOR. Boot beside the block at tile (12,8) — one cell EAST
 * of `pushableblockspear@176,128` (11,8) — walk W into its face to record
 * a baseline stop, spear once facing W, then walk W again:
 *
 *   Δx ≈ 0    the block did not move — the press does nothing here, and
 *             §8.5's seal verdict was wrong about the MECHANIC (moveTypes
 *             gating after all?) — diagnose before trusting anything
 *   Δx ≈ 16   the block moved ONE tile W — §8.5's direction table is
 *             ORACLE-CONFIRMED at reach 1, and with it the seal analysis
 *   Δx ≈ 32   the block left the row entirely (moved twice / destroyed) —
 *             a mechanic the model does not carry; diagnose
 *
 * ((10,8)'s west neighbour (9,8) is solid, so even a vanished block stops
 * the player at Δx ≈ 32 — every outcome has a distinct stop.)
 *
 * Run: node scripts/procgen/probe-seedling-l65.mjs
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = 'seedling_bot_ap';
const WASM_DIR = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

if (!existsSync(WASM_DIR)) {
    console.log(`SKIP: no wasm artifact at ${WASM_DIR}`);
    process.exit(0);
}

const PRESS_AT = 30;
const TICKS = 80;

const tape = {
    tape_version: 4,
    game: 'seedling',
    name: 'probe-l65-push-west',
    description: 'Baseline stop at the block, one spear press facing W, re-advance.',
    boot: { level: 65, x: 192, y: 128 },
    noclip: false,
    noDamage: true,
    noHazards: ['water', 'lava', 'ice', 'waterfall'],
    grants: [{ level: 65, items: ['sword', 'spear'] }],
    persistence: [],
    equips: [{ t: 0, slot: 1 }],
    tick_count: TICKS,
    inputs: [
        { key: 'left', from: 5, to: 25 },
        { key: 'primary', from: PRESS_AT, to: PRESS_AT + 1 },
        { key: 'left', from: 40, to: 75 },
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

    console.log('l65 probe: one spear press at the health block, facing W');
    const loaded = await bot('botLoadTape', JSON.stringify(tape));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    if (await bot('botStart') !== 'ok') throw new Error('botStart refused');

    let last = null;
    let stalledSince = null;
    const STALL_FRAMES = 120;
    const DEADLINE = Date.now() + 25 * 60 * 1000;
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
    const xAt = (t) => ticks.find((o) => o.t === t)?.x;
    const baseline = xAt(28);
    const after = xAt(78);
    const delta = baseline - after;
    console.log(`\n  baseline stop x=${baseline}  after-press stop x=${after}  Δx=${delta.toFixed(2)}`);
    if (Math.abs(delta) < 1) {
        console.log('⛔ THE BLOCK DID NOT MOVE. §8.5\'s mechanic reading is wrong in the');
        console.log('   direction nobody predicted — diagnose the push path before ruling.');
    } else if (delta < 20) {
        console.log('✅ ONE TILE WEST. §8.5\'s direction table is ORACLE-CONFIRMED at reach 1:');
        console.log('   facing W pushes W, the seal analysis stands on tested ground.');
    } else {
        console.log('⚠ THE BLOCK LEFT THE ROW (moved twice, or destroyed). The model carries');
        console.log('   no such mechanic — diagnose before trusting any push analysis.');
    }
} catch (e) {
    console.error(`\nPROBE FAILED: ${e.message}`);
    console.error(logs.slice(-25).join('\n'));
    process.exitCode = 1;
} finally {
    await browser.close();
}
