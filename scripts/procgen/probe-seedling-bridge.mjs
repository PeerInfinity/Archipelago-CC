#!/usr/bin/env node
/**
 * probe-seedling-bridge — how many TICKS after ONE press does a bridge
 * become walkable? A PAIR, differing only in whether the press exists.
 *
 * Region-atlas Phase 8, rung R4. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §2.2/§3.3, and
 * `frontend/modules/seedlingDemo/bridges.js`, whose answer this either
 * confirms or corrects.
 *
 * ── THE QUESTION, AND WHY READING HARDER WOULD NOT SETTLE IT ──────────
 *
 * `bridges.js` transcribes the cycle exactly and derives `framesToOpen()`
 * = 60 from it, on the premise stated in its own docblock: *"One thrust
 * tips 60 to 59."* Wiring the model into `levelRun` turned that premise
 * up as an assumption rather than a transcription, and the chain that
 * decides it is four classes deep:
 *
 *   - `Player.update()` calls `spear()` BEFORE `super.update()`, so the
 *     rect fires on the tick AFTER the one whose `input()` set `spearing`.
 *   - `spearing` is cleared by `spearEnd`, the COMPLETE CALLBACK of
 *     `sprSpear` — a `Spritemap(imgSpear, 36, 7, spearEnd)` playing an
 *     8-frame animation at 45 fps against the engine's own frame rate.
 *   - `spear()` re-fires whenever `spearDelay` (max **1**) has drained, so
 *     it collides the rect every OTHER tick for as long as `spearing`
 *     holds.
 *   - and `genericHit`'s `e is Tile` arm has **no already-open guard**:
 *     every firing decrements.
 *
 * So one X press is not one decrement — it is one decrement per rect
 * firing, and the count depends on a sprite frame rate divided by an
 * engine frame rate. That is arithmetic across two subsystems the model
 * does not have, which is precisely the shape of thing this arc measures
 * instead of deriving (the R3 lesson: the oracle corrected the update
 * order; §11: the oracle corrected §8.5).
 *
 * ── THE MEASUREMENT ───────────────────────────────────────────────────
 *
 * L63's one bridge is tile (2,9), and it is a genuine seal: column 2 is
 * the only north-south corridor in that half of the level, so the tile
 * separates the L61/L62 arrivals above it from the L61 door at (0,208) and
 * the L65 door at (32,304) below.
 *
 * Boot at tile (2,8), hold DOWN until the player pins against the bridge's
 * north face, press once, then hold DOWN for the rest of the tape. The
 * player steps through on the very tick the type flips, so the tick their
 * `y` first crosses 144 IS the answer.
 *
 *   press arm    crosses y = 144 at some tick T
 *   control      never crosses — pinned at the face for the whole tape
 *
 * `bridges.framesToOpen()` predicts 60 on-screen frames after the timer
 * reaches 59. If T - pressTick is ~60 the premise holds and one press is
 * one decrement; if it is materially smaller, the rect fired more than
 * once and `bridges.js` needs the firing count, not the press count.
 *
 * ⚠ The player stays 11 px from the tile centre for the whole window, so
 * the 64 px on-screen policy is satisfied by construction and the
 * measurement is of the timer alone.
 *
 * Run: node scripts/procgen/probe-seedling-bridge.mjs
 */

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = 'seedling_bot_ap';
const WASM_DIR = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const OUT = process.env.PROBE_OUT ?? '/tmp';

if (!existsSync(WASM_DIR)) {
    console.log(`SKIP: no wasm artifact at ${WASM_DIR}`);
    process.exit(0);
}

const TICKS = 320;
const PRESS = 25;
/** The bridge tile's own top edge — crossing it is the whole measurement. */
const BRIDGE_TOP = 144;

const tapeFor = (withPress) => ({
    tape_version: 4,
    game: 'seedling',
    name: withPress ? 'probe-bridge-press' : 'probe-bridge-control',
    description: 'Pin against L63\'s bridge, press once (or not), hold DOWN.',
    boot: { level: 63, x: 32, y: 128 },
    noclip: false,
    noDamage: true,
    noHazards: ['water', 'lava', 'ice', 'waterfall'],
    grants: [{ level: 63, items: ['sword', 'spear'] }],
    persistence: [],
    equips: [{ t: 0, slot: 1 }],
    tick_count: TICKS,
    inputs: [
        // Long by design: the bridge is the wall that stops it, and being
        // pinned there is also what makes the facing DOWN.
        { key: 'down', from: 5, to: 20 },
        ...(withPress ? [{ key: 'primary', from: PRESS, to: PRESS + 1 }] : []),
        // Held for the rest of the tape, so the tick the player moves IS
        // the tick the tile stopped being Solid.
        { key: 'down', from: 30, to: TICKS - 2 },
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
                + `x=${Number(st.x).toFixed(2)} y=${Number(st.y).toFixed(2)} `
                + `L${st.level} err=${st.error ?? ''}`;
            if (line !== last) { console.log(`  ${line}`); last = line; }
            if (st.finished) break;
            if (st.tick === stalledSince?.tick && st.dead_frames > stalledSince.dead + 200) {
                throw new Error(`tape stalled at tick ${st.tick}`);
            }
            if (st.tick !== stalledSince?.tick) {
                stalledSince = { tick: st.tick, dead: st.dead_frames };
            }
            if (Date.now() > DEADLINE) throw new Error('deadline');
            await page.waitForTimeout(1000);
        }
        const drained = await botJson('botDrain');
        writeFileSync(join(OUT, `${tape.name}.drain.json`), JSON.stringify(drained));
        const ticks = drained.ticks ?? [];
        const crossed = ticks.find((o) => o.y >= BRIDGE_TOP);
        if (logs.length) console.log('  page console tail:', logs.slice(-6).join(' | '));
        const finals = ticks.at(-1) ?? {};
        return { crossed, final: { x: finals.x, y: finals.y }, ticks };
    } finally {
        await page.close();
    }
}

try {
    console.log('bridge pair: PRESS arm');
    const press = await runTape(tapeFor(true));
    console.log('\nbridge pair: CONTROL arm');
    const control = await runTape(tapeFor(false));

    console.log(`\n  press:   crossed y=${BRIDGE_TOP} at tick `
        + `${press.crossed ? press.crossed.t : 'NEVER'}; final (${press.final.x}, ${press.final.y})`);
    console.log(`  control: crossed y=${BRIDGE_TOP} at tick `
        + `${control.crossed ? control.crossed.t : 'NEVER'}; final (${control.final.x}, ${control.final.y})`);
    if (press.crossed && !control.crossed) {
        const elapsed = press.crossed.t - PRESS;
        console.log(`\n✅ THE BRIDGE OPENED, ${elapsed} tick(s) after the press tick (${PRESS}).`);
        console.log('   `bridges.framesToOpen()` predicts 60 on-screen frames from a SINGLE');
        console.log('   decrement. Read the number above against that:');
        console.log('     ~60-62  one press is one decrement — the docblock premise holds;');
        console.log('     ~20-40  the rect fired more than once while `spearing` held, and');
        console.log('             the model must count FIRINGS rather than presses.');
    } else if (!press.crossed && !control.crossed) {
        console.log('\n⛔ NEITHER ARM CROSSED — the press did not reach the tile, or 60 frames');
        console.log('   is short of the truth. Check the press arm\'s y against 141 (the');
        console.log('   pinned face) before blaming the timer.');
    } else {
        console.log('\n⚠ UNEXPECTED SHAPE — the control crossed, so the tile was not Solid to');
        console.log('   begin with. Diagnose the world, not the spear.');
    }
} catch (e) {
    console.error(`\nPROBE FAILED: ${e.message}`);
    process.exitCode = 1;
} finally {
    await browser.close();
}
