#!/usr/bin/env node
/**
 * probe-seedling-swim-sound — is the swim speed a function of WALL CLOCK?
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §3.4 and §6.5.
 *
 * ── THE QUESTION, AND WHY IT IS NOT ACADEMIC ──────────────────────────
 *
 * `Player.as:530` is the one line in the whole physics that reads a SOUND:
 *
 *     moveSpeed = moveSpeeds[state] + 0.25 * int(Music.soundPosition("Swim") < 0.1);
 *
 * It runs inside `if (inWater || inLava)` — which is why no tape on this
 * ladder has ever reached it: every one of the 57 frozen fixtures coerces
 * water. R5's whole chain ends in arming it (BobBoss → fire → conch →
 * `canSwim` → water armable), so the FIRST window that swims runs this line.
 *
 * ── WHAT THE SOURCE SAYS, READ END TO END ─────────────────────────────
 *
 *   `Music.soundPosition(set)`     max over the set of `Sfx.position`
 *                                  (`Music.as:583-596`)
 *   `Sfx.position`                 `(_channel ? _channel.position : _position)
 *                                  / 1000` — SECONDS, so `< 0.1` is "less
 *                                  than 100 ms into the swim sound"
 *                                  (`net/flashpunk/Sfx.as:133`)
 *   `SoundChannel.position`        in a GRAPHICS build, the live mixer clock:
 *                                  `audio_channel_position_ms(...)`
 *                                  (SWFModernRuntime `avm2_media.c:276-291`
 *                                  → `audio/audio.c:583`)
 *
 * ⛔ So it is NOT a stubbed constant, which is what §3.4 hoped. The header
 * of `avm2_media.c` is explicit that "channel positions only advance when an
 * output sink pulls `audio_mix` (browser Web Audio) — never in the native
 * test harness", and the bot runs in a BROWSER.
 *
 * That leaves exactly one question a source read cannot answer: does the
 * sink actually get pulled in an automated browser with no user gesture? If
 * it does not, the position stays 0, `< 0.1` is permanently true, the term
 * is a constant +0.25 and swim is exact. If it does, the number of boosted
 * ticks is REAL MILLISECONDS divided by whatever frame rate the browser
 * happened to achieve — and the same tape gives different physics on the
 * ~25 fps Windows path and the ~0.5 fps local one.
 *
 * ── THE EXPERIMENT ────────────────────────────────────────────────────
 *
 * `hazard-walk-water`'s route, with the water ARMED and the conch granted:
 * level 0's spawn holding RIGHT crosses onto water at column 9. Run it
 * TWICE on the same browser and diff the streams tick for tick.
 *
 *   identical    the clock is inert here; the term is constant and the swim
 *                legs are exact. §6.5 does not open.
 *   different    the term is live, and the divergence tick is where the
 *                sound crossed 100 ms. §6.5 opens: either keep the walk out
 *                of deep water, or take the doctrine's first named
 *                witnessed-not-exact spans.
 *
 * ⚠ TWO RUNS ON ONE BROWSER IS THE WEAKER HALF. The stronger one is the same
 * tape at a different frame rate — the local SwiftShader path is ~50x slower
 * than the Windows one, so a wall-clock term cannot survive both. `--win`
 * runs it through the shipped Windows driver for exactly that comparison.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-swim-sound.mjs            # 2 local runs
 *   node scripts/procgen/probe-seedling-swim-sound.mjs --ticks=90
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = 'seedling_bot_ap';
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const OUT = process.env.PROBE_OUT ?? '/tmp';

const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
};
const TICKS = Number(arg('ticks', '110'));
const RUNS = Number(arg('runs', '2'));

/**
 * The tape: `hazard-walk-water`'s own route with water ARMED.
 *
 * `noclip: true` deliberately — the question is the SPEED TERM, and a
 * collision sweep would put a wall between the measurement and the answer.
 * The conch is a boot GRANT rather than a collection because R0's grants are
 * property writes and `canSwim` is a property: nothing about the swim
 * physics can tell how the flag got set, and the alternative is a
 * twelve-thousand-tick walk to L49 for one line of arithmetic.
 */
const TAPE = {
    tape_version: 4,
    game: 'seedling',
    name: 'probe-swim-sound',
    description: 'Level 0, hold RIGHT onto the water at column 9, with water ARMED and '
        + 'canSwim granted. Two identical runs; the streams answer whether Player.as:530\'s '
        + 'Music.soundPosition("Swim") term is a wall-clock quantity on this runtime.',
    boot: { level: 0, x: 80, y: 128 },
    noclip: true,
    noDamage: true,
    // ⚠ WATER IS ABSENT FROM THE SET — that is the whole experiment. Every
    // other hazard stays coerced so nothing else can move the stream.
    noHazards: ['pit', 'lava', 'ice', 'waterfall'],
    grants: [{ level: 0, items: ['conch'] }],
    persistence: [],
    equips: [],
    tick_count: TICKS,
    inputs: [{ key: 'right', from: 0, to: TICKS }],
};

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

async function runOnce(label) {
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
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) {
            await page.waitForTimeout(250);
        }
        await page.click('#btn-start');
        for (let i = 0; i < 480
            && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) {
            await page.waitForTimeout(250);
        }
        const loaded = await bot('botLoadTape', JSON.stringify(TAPE));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if (await bot('botStart') !== 'ok') throw new Error('botStart refused');
        const started = Date.now();
        let last = null;
        for (;;) {
            const st = await botJson('botStatus');
            const line = `tick=${st.tick}/${st.tick_count} dead=${st.dead_frames} `
                + `x=${Number(st.x).toFixed(3)} drown=${st.drown_timer} err=${st.error ?? ''}`;
            if (line !== last) { console.log(`  ${label}: ${line}`); last = line; }
            if (st.finished) break;
            if (Date.now() - started > 30 * 60 * 1000) throw new Error('deadline');
            await page.waitForTimeout(1000);
        }
        const drained = await botJson('botDrain');
        writeFileSync(join(OUT, `probe-swim-sound.${label}.json`), JSON.stringify(drained));
        if (logs.length) console.log(`  ${label}: page console tail:`, logs.slice(-4).join(' | '));
        return {
            ticks: drained.ticks ?? [],
            secs: Math.round((Date.now() - started) / 1000),
        };
    } finally {
        await page.close();
    }
}

try {
    const runs = [];
    for (let i = 1; i <= RUNS; i += 1) {
        console.log(`\n── run ${i} ──`);
        runs.push(await runOnce(`run${i}`));
    }
    console.log('\n## the diff');
    const [a, ...rest] = runs;
    console.log(`  run 1: ${a.ticks.length} observations in ${a.secs}s `
        + `(${(a.ticks.length / Math.max(a.secs, 1)).toFixed(1)} fps)`);
    let firstDiff = null;
    for (let r = 0; r < rest.length; r += 1) {
        const b = rest[r];
        console.log(`  run ${r + 2}: ${b.ticks.length} observations in ${b.secs}s `
            + `(${(b.ticks.length / Math.max(b.secs, 1)).toFixed(1)} fps)`);
        const n = Math.min(a.ticks.length, b.ticks.length);
        for (let t = 0; t < n; t += 1) {
            if (a.ticks[t].x !== b.ticks[t].x || a.ticks[t].y !== b.ticks[t].y) {
                if (firstDiff === null || t < firstDiff.t) {
                    firstDiff = { t, run: r + 2, a: a.ticks[t], b: b.ticks[t] };
                }
                break;
            }
        }
    }
    // Where the water starts, so the diff tick can be read against it.
    const onWater = a.ticks.find((o) => o.x >= 144);
    console.log(`\n  the player's x reaches the column-9 water edge (144) at tick `
        + `${onWater ? onWater.t : '(never — lengthen the tape)'}`);
    if (firstDiff === null) {
        console.log('\n⇒ IDENTICAL. On this runtime the swim term is not a wall-clock '
            + 'quantity — either the audio sink is never pulled, or the position never '
            + 'crosses 100 ms within the tape. Swim legs are EXACT and §6.5 stays shut. '
            + '⚠ Re-run with --win before believing it: two runs at the SAME frame rate '
            + 'is the weaker half of the experiment.');
    } else {
        console.log(`\n⇒ DIVERGED at tick ${firstDiff.t} (run 1 vs run ${firstDiff.run}): `
            + `x ${firstDiff.a.x} vs ${firstDiff.b.x}. The swim speed IS live. §6.5 opens: `
            + 'keep the walk out of deep water, or take the first named '
            + 'witnessed-not-exact spans.');
    }
} finally {
    await browser.close();
}
