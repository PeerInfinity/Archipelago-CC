#!/usr/bin/env node
/**
 * probe-seedling-l67-reach2 — does the spear push a block from TWO tiles
 * away, across a pit? A PAIR, one span apart.
 *
 * Region-atlas Phase 8, rung R4, §10.5's second probe, second attempt. The
 * first attempt (`probe-seedling-l59-l67.mjs`) was routed on a hand-drawn
 * tile grid that turned out wrong in three cells; its trace still settled
 * two things the hard way — (10,6) and (10,7) are PITS (the lightpole
 * STANDS ON one, it doesn't block anything), and **`die()` is an in-place
 * respawn at the boot tile with ~18 dead frames, after which THE TAPE KEEPS
 * RUNNING** — a mechanic no rung has modelled.
 *
 * This attempt routes on the SHIPPED geometry (levelWorld + the raw tile
 * types): boot (11,7), face W, spear once — the rect spans (10,7)+(9,7),
 * pit then block — then walk DOWN to (11,8), WEST along row 8 (all floor:
 * (10,8),(9,8)), and UP into the block's own cell (9,7).
 *
 *   press tape:  final y ≈ 120  → the block LEFT (9,7): 2-tile across-pit
 *                                 reach ORACLE-CONFIRMED — the walkthrough's
 *                                 entire key-room solve (N, then W across
 *                                 the light's pit, W, S through the wall,
 *                                 W onto the button) becomes plannable
 *   control:     final y ≈ 134  → the block is still there (its south face)
 *
 * Both ≈ 134 → reach-2 FAILED (the rect is shorter than modelled).
 * Both ≈ 120 → the block was never there — diagnose the world, not the
 * spear. Every outcome is a distinct stop, and the pair is one span apart.
 *
 * Run: node scripts/procgen/probe-seedling-l67-reach2.mjs
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

const TICKS = 95;

const tapeFor = (withPress) => ({
    tape_version: 4,
    game: 'seedling',
    name: withPress ? 'probe-l67-reach2-press' : 'probe-l67-reach2-control',
    description: 'Across-pit reach-2 press (or not), then walk into the block cell from the south.',
    boot: { level: 67, x: 176, y: 112 },
    noclip: false,
    noDamage: true,
    noHazards: ['water', 'lava', 'ice', 'waterfall'],
    grants: [{ level: 67, items: ['sword', 'spear'] }],
    persistence: [],
    equips: [{ t: 0, slot: 1 }],
    tick_count: TICKS,
    inputs: [
        { key: 'left', from: 5, to: 6 },          // face W, ~2 px drift
        ...(withPress ? [{ key: 'primary', from: 12, to: 13 }] : []),
        // ⚠ Span sizes are COAST-CORRECTED: releasing a held arrow leaves
        // ~1.1-1.4 px/tick of velocity that friction (0.2/tick, vector)
        // takes ~5 px to drain. The first attempt sized DOWN for 16 px of
        // HOLD and the coast carried the terrain probe over the y=144
        // midline into (11,9)'s pit — two deaths, both arms, no data.
        { key: 'down', from: 20, to: 32 },        // (11,7) -> (11,8): ~12.5 px + ~4 coast
        { key: 'left', from: 40, to: 62 },        // row 8 west to ~(9,8): ~23 px + coast, 6 px shy of (8,8)'s midline
        { key: 'up', from: 70, to: 84 },          // into (9,7) if vacated, else pin at its face
    ],
});

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

async function runTape(tape) {
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
        const loaded = await bot('botLoadTape', JSON.stringify(tape));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if (await bot('botStart') !== 'ok') throw new Error('botStart refused');

        let last = null;
        let stalledSince = null;
        const DEADLINE = Date.now() + 30 * 60 * 1000;
        for (;;) {
            const st = await botJson('botStatus');
            const line = `tick=${st.tick}/${st.tick_count} dead=${st.dead_frames} `
                + `x=${Number(st.x).toFixed(2)} y=${Number(st.y).toFixed(2)} err=${st.error ?? ''}`;
            if (line !== last) { console.log(`  ${line}`); last = line; }
            if (st.finished) break;
            if (st.tick === stalledSince?.tick && st.dead_frames > stalledSince.dead + 120) {
                throw new Error(`tape stalled at tick ${st.tick}`);
            }
            if (st.tick !== stalledSince?.tick) {
                stalledSince = { tick: st.tick, dead: st.dead_frames };
            }
            if (Date.now() > DEADLINE) throw new Error('deadline');
            await page.waitForTimeout(1000);
        }
        const drained = await botJson('botDrain');
        const { writeFileSync } = await import('node:fs');
        writeFileSync(join('/tmp/claude-1000/-home-robert-CC-Archipelago-CC/'
            + '46a1878c-7a4d-4116-991b-56046e7b05d5/scratchpad', `${tape.name}.drain.json`),
            JSON.stringify(drained));
        const finals = (drained.ticks ?? []).at(-1) ?? {};
        if (logs.length) console.log('  page console tail:', logs.slice(-8).join(' | '));
        return { x: finals.x, y: finals.y };
    } finally {
        await page.close();
    }
}

try {
    console.log('l67 reach-2 pair: PRESS arm');
    const press = await runTape(tapeFor(true));
    console.log('\nl67 reach-2 pair: CONTROL arm');
    const control = await runTape(tapeFor(false));

    console.log(`\n  press:   final (${press.x}, ${press.y})`);
    console.log(`  control: final (${control.x}, ${control.y})`);
    const gone = press.y < 126;
    const held = control.y > 128;
    if (gone && held) {
        console.log('✅ REACH-2 ORACLE-CONFIRMED: the press vacated (9,7) and the control');
        console.log('   pinned at its south face. The across-pit/through-wall press chain —');
        console.log('   the walkthrough\'s key-room solve — is real, and §8.5\'s press-cell');
        console.log('   sweeps must be re-run with 2-tile reach from ANY reachable component.');
    } else if (!gone && held) {
        console.log('⛔ REACH-2 FAILED: both arms pinned at the block. The spear\'s effective');
        console.log('   push reach is shorter than the 32 px rect — re-derive the press-cell');
        console.log('   rule before re-running any sweep.');
    } else {
        console.log('⚠ UNEXPECTED SHAPE — the control did not pin (block absent?) or the');
        console.log('   press arm pinned somewhere new. Diagnose from the traces above.');
    }
} catch (e) {
    console.error(`\nPROBE FAILED: ${e.message}`);
    process.exitCode = 1;
} finally {
    await browser.close();
}
