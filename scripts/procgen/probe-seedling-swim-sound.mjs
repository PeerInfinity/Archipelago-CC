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

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const OUT = process.env.PROBE_OUT ?? '/tmp';

const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
};
const TICKS = Number(arg('ticks', '110'));
const RUNS = Number(arg('runs', '2'));

/**
 * ⛓ `--win` IS THE STRONG HALF OF THE EXPERIMENT, and slice 2 added it
 * because the local pair is the weak one.
 *
 * Two local runs are both at ~0.4 fps. If the term were live, BOTH would
 * cross 100 ms of sound inside their first swimming tick (a tick is 2.5
 * SECONDS of real time down here) and both would show the same boosted-tick
 * count — identical streams, and the wrong conclusion.
 *
 * The question is a MILLISECONDS-AGAINST-FRAMES one, so it is only answered
 * by comparing across FRAME RATES: at ~24 fps a tick is 42 ms, so a live
 * 100 ms window boosts two or three ticks, while at 0.4 fps it boosts at most
 * one. `--win` drives the identical tape through the real-GPU Windows path
 * and diffs it against the local run's saved stream.
 */
const WIN = process.argv.includes('--win');

/**
 * ⛓ `--pin` IS THE PROBE'S OWN ANSWER, RUN BACK THROUGH IT.
 *
 * Slice 2's `--win` arm DIVERGED at tick 52 and the ruling (kickoff §13.1)
 * took option (c): a frame-clocked `soundPosition` under a Bot flag, PIN
 * classified. `--pin` re-runs the identical experiment with the flag ON, by
 * bumping the tape to v5 and declaring `pins: ["sound"]`.
 *
 * The claim it tests is the POSITIVE one, and it is the only kind of witness
 * a pin can have: **the pair that diverged must now be IDENTICAL.** A pin
 * asserted only by "the 57 fixtures are still byte-inert" would be asserted
 * by a gate it cannot fail — every one of those fixtures coerces water and
 * never reaches `Player.as:530` at all.
 *
 * It also prints the game's own `sound_pin` readout, which is the second
 * stratum on the length: `swimSoundClock.SWIM_LENGTH_FRAMES` is derived from
 * parsing `assets/sound/swim.mp3` (30 MPEG-1 frames × 1152 samples ÷ 44.1
 * kHz × 60 fps = 47), and `Sfx.length` is what the game measured. Two
 * derivations of one number, and the game's is the oracle.
 */
const PIN = process.argv.includes('--pin');
const WIN_STAGE = '/mnt/c/playwright';
const WIN_DRIVE = 'C:\\playwright';
const PY = '/mnt/c/Windows/py.exe';

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
    tape_version: PIN ? 5 : 4,
    game: 'seedling',
    name: PIN ? 'probe-swim-sound-pinned' : 'probe-swim-sound',
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
    ...(PIN ? { pins: ['sound'] } : {}),
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
        const terminal = await botJson('botStatus');
        const drained = await botJson('botDrain');
        writeFileSync(join(OUT, `probe-swim-sound.${label}.json`), JSON.stringify(drained));
        if (logs.length) console.log(`  ${label}: page console tail:`, logs.slice(-4).join(' | '));
        return {
            ticks: drained.ticks ?? [],
            secs: Math.round((Date.now() - started) / 1000),
            status: terminal,
        };
    } finally {
        await page.close();
    }
}

/** Drive the same tape on the real-GPU Windows path and read its stream. */
function runOnWindows(label) {
    mkdirSync(WIN_STAGE, { recursive: true });
    writeFileSync(join(WIN_STAGE, 'seedling-bot-replay-win.py'),
        readFileSync(join(HERE, 'seedling-bot-replay-win.py')));
    writeFileSync(join(WIN_STAGE, `swim-${label}.json`), JSON.stringify({ tapes: [TAPE] }));
    const started = Date.now();
    const out = execFileSync(PY, [
        '-3.12', `${WIN_DRIVE}\\seedling-bot-replay-win.py`,
        '--url', PAGE_URL,
        '--tapes', `${WIN_DRIVE}\\swim-${label}.json`,
        '--out', `${WIN_DRIVE}\\swim-out-${label}.json`,
        '--deadline-sec', '300',
    ], { cwd: WIN_STAGE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    for (const line of out.split('\n')) {
        if (line.startsWith('REPLAY_') || line.startsWith('WEBGPU_')) console.log(`  ${line}`);
    }
    const trace = JSON.parse(readFileSync(join(WIN_STAGE, `swim-out-${label}.json`), 'utf8'));
    const ticks = trace.windows[0].stream.ticks ?? [];
    writeFileSync(join(OUT, `probe-swim-sound.${label}.json`), JSON.stringify({ ticks }));
    return {
        ticks,
        secs: Math.round((Date.now() - started) / 1000),
        status: trace.windows[0].status ?? {},
    };
}

try {
    const runs = [];
    if (WIN) {
        // ⚠ The LOCAL run comes first and second: the pair being compared is
        // "same tape, ~60x apart in frame rate", so both sides have to exist.
        console.log('\n── run 1 (local, SwiftShader) ──');
        runs.push(await runOnce('run1'));
        console.log('\n── run 2 (real-GPU Windows Chrome) ──');
        runs.push(runOnWindows('win'));
    } else {
        for (let i = 1; i <= RUNS; i += 1) {
            console.log(`\n── run ${i} ──`);
            runs.push(await runOnce(`run${i}`));
        }
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

    if (PIN) {
        // The pin's own readouts, from every arm, so a run where the flag
        // silently failed to arrive is a NAMED failure and not an
        // "identical" that proves nothing. A tape that faults disarms, which
        // truncates the stream — but `error` says why, and `pins` says
        // whether the build even honoured the field.
        for (let i = 0; i < runs.length; i += 1) {
            const st = runs[i].status ?? {};
            console.log(`  run ${i + 1} pins=${JSON.stringify(st.pins)} `
                + `sound_pin=${JSON.stringify(st.sound_pin)} `
                + `error=${JSON.stringify(st.error ?? '')}`);
        }
        const armed = runs.every((r) => r.status?.pins?.sound === true);
        const clean = runs.every((r) => !r.status?.error);
        const lens = runs.flatMap((r) => (r.status?.sound_pin?.channels ?? [])
            .map((c) => c.len_frames));
        console.log(`  measured Swim length(s), in FRAMES: ${JSON.stringify(lens)} `
            + '(swimSoundClock.SWIM_LENGTH_FRAMES predicts 47 from the mp3 itself)');
        if (!armed || !clean) {
            console.log('\n⇒ ⛔ THE PIN DID NOT RUN. `pins.sound` false on some arm, or the '
                + 'tape faulted — an "identical" from here would be identical because '
                + 'nothing happened. Fix the arm before reading the diff.');
        } else if (firstDiff === null) {
            console.log('\n⇒ ✅ IDENTICAL WITH THE PIN ARMED. The pair that DIVERGED at '
                + 'tick 52 unpinned is byte-identical across a ~25x frame-rate spread. '
                + 'The swim term is a function of the tick count, and §6.5 is closed by '
                + 'the pin rather than by a routing constraint.');
        } else {
            console.log(`\n⇒ ⛔ STILL DIVERGED at tick ${firstDiff.t} WITH THE PIN ARMED: `
                + `x ${firstDiff.a.x} vs ${firstDiff.b.x}. The pin does not cover the term, `
                + 'or something else in the swim block is wall-clock-shaped. This is a '
                + 'finding for the NEXT batch, not a reason to widen this one.');
        }
    } else if (firstDiff === null) {
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
