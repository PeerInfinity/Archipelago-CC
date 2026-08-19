#!/usr/bin/env node
/**
 * probe-seedling-build-cost — what does ONE level build cost the gameplay
 * stream, and how many dead frames does its fade take? R7 slice 2.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * `probe-seedling-seam-chain.mjs` measured a segment boundary and found the
 * segmented run's gameplay state exactly **1562 LFSR steps** ahead of the
 * contiguous run's, with `save.time` **+21**. The explanation was immediate
 * and it was still an EXPLANATION: a boundary at an arrival duplicates one
 * level BUILD and one level FADE, because segment N arrives into the level
 * and segment N+1 boots into it.
 *
 * ⛔ AN EXPLANATION THAT MATCHES A NUMBER IS NOT A MEASUREMENT OF IT. So
 * this measures the duplicated quantity directly and independently: boot the
 * level with a DECLARED gameplay seed and `tick_count: 0`, and read the
 * latch. `Bot.botStart` writes the seed before the build (`Bot.as:1689` —
 * "the declared seed is the build's first number"), and the build runs in
 * `Game.begin()` before the first observation, so the distance from the
 * declared seed to the latched state IS the build's draw count, with nothing
 * else in it.
 *
 * If that number is 1562, the seam's delta is one L94 build and the
 * attribution is arithmetic. If it is not, the difference is the rest of the
 * story and it is named rather than assumed.
 *
 * ⚠ `pins: ["dead_frames"]`, so the fade's cost is update-determined and the
 * `latch.dead_frames` reading means the same thing it means in the chain.
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/probe-seedling-build-cost.mjs
 *   node scripts/procgen/probe-seedling-build-cost.mjs --levels=94,0
 */

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { step } = await import(join(REPO, 'frontend/modules/seedlingDemo/rng.js'));

const ATLAS = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));

/** The arrival each probed level is booted at — the teleporter's own drop. */
const BOOTS = {
    94: { level: 94, x: 288, y: 160 },
    0: { level: 0, x: 80, y: 128 },
};
const LEVELS = (process.argv.filter((a) => a.startsWith('--levels='))
    .flatMap((a) => a.slice('--levels='.length).split(',')).filter(Boolean)
    .map(Number)).length
    ? process.argv.filter((a) => a.startsWith('--levels='))
        .flatMap((a) => a.slice('--levels='.length).split(',')).filter(Boolean).map(Number)
    : [94];

/** A state the LFSR really occupies, so the origin is not a special case. */
const SEED = 987286273;

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--no-sandbox',
    ],
});

const call = (page, name, arg) => page.evaluate(([n, a]) => {
    const g = window.__swfBridge && window.__swfBridge.game;
    if (!g || typeof g[n] !== 'function') return null;
    return a === undefined ? g[n]() : g[n](a);
}, [name, arg]);

async function waitFor(page, desc, fn, timeoutMs = 1800000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${desc}`);
        await page.waitForTimeout(500);
    }
}

/** How many LFSR steps from `a` to `b`, or -1 within the bound. */
function stepsBetween(a, b, bound = 2000000) {
    let u = a >>> 0;
    for (let n = 1; n <= bound; n += 1) {
        u = step(u);
        if (u === (b >>> 0)) return n;
    }
    return -1;
}

try {
    console.log('# one level build, measured from a declared origin\n');
    for (const level of LEVELS) {
        const boot = BOOTS[level];
        if (!boot) { console.log(`SKIP level ${level}: no declared arrival point`); continue; }
        const tape = parseTape({
            tape_version: 8,
            game: 'seedling',
            boot,
            noclip: false,
            noDamage: false,
            noHazards: [],
            grants: [],
            persistence: [],
            equips: [],
            pins: ['dead_frames'],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: { seed: SEED, split: false, cosmetic: 0, fp: 0 },
            seam: null,
            tick_count: 0,
            inputs: [],
        });
        const page = await browser.newPage();
        let latch;
        let envelope;
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready',
                () => page.evaluate(() => !!window.__runtimeReady));
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks',
                () => page.evaluate(() => !!(window.__swfBridge?.game?.botSeam)));
            const loaded = await call(page, 'botLoadTape', JSON.stringify(tape));
            if (loaded !== 'ok') throw new Error(`botLoadTape(L${level}): ${loaded}`);
            const started = await call(page, 'botStart');
            if (started !== 'ok') throw new Error(`botStart(L${level}): ${started}`);
            await waitFor(page, `L${level} to finish`, async () => {
                const st = JSON.parse(await call(page, 'botStatus'));
                return st.finished ? st : null;
            });
            envelope = JSON.parse(await call(page, 'botSeam'));
            latch = envelope.seam;
        } finally {
            await page.close();
        }
        const got = latch['rng.gameplay'];
        // ⛔⛔ ZERO IS A MEASUREMENT, NOT A FAILURE — and L0 is what taught
        // this probe so. `botStart` builds a world only when
        // `bootLevel != Main.level || !atBootPosition()` (`Bot.as:1638`).
        // The page boots straight to `new Game(0, 80, 128)` (`Main.as:50`),
        // so a tape declaring exactly that boot REUSES the world the page
        // already built and takes NOT ONE DRAW. The latched state is the
        // declared seed, unmoved.
        //
        // ⛓ Which is also the mechanism that would make a chain contiguous
        // if its segments ran in ONE page: segment N+1 booting the level and
        // position segment N ended at would not rebuild, and the seam's
        // duplicated-build offset would be zero. The differential replays
        // every tape in its own fresh page, so that is not available to a
        // committed chain — but it is the shape of what an in-page chain
        // would cost, and it is worth having measured rather than assumed.
        const draws = got === SEED ? 0 : stepsBetween(SEED, got);
        const lv = ATLAS.levels.find((l) => l.level === level);
        const tiles = lv.layers.reduce((n, la) => n + la.tiles.length, 0);
        check(`L${level}: the build's draw count is measurable from the declared seed`,
            draws >= 0,
            draws === 0
                ? `ZERO — the latched state IS the declared seed (${SEED}). This boot `
                    + 'matched the page\'s own `new Game(0, 80, 128)` in level AND '
                    + 'position, so `Bot.as:1638` reused the existing world and no build '
                    + 'ran. Not a null result: it is the measurement that an in-page '
                    + 'segment boundary costs nothing.'
                : draws > 0
                    ? `declared ${SEED} -> latched ${got} = ${draws} draw(s); the tile `
                        + `layer alone is ${tiles} tiles x 3 (\`Tile.as:97-99\`) = `
                        + `${tiles * 3}, so ${draws - tiles * 3} come from the `
                        + `${lv.entities.length} entity construction(s) and the boot itself`
                    : `latched ${got} is not reachable from ${SEED} within the bound — `
                        + 'the build is not the only thing moving this stream');
        console.log(`  L${level} (${lv.class}, ${lv.width}x${lv.height}): `
            + `${draws} gameplay draw(s), ${latch['latch.dead_frames']} dead frame(s), `
            + `time ${latch['save.time']}`);

        // ── ⛓⛓⛓ R7 SLICE 2b: THIS PROBE IS THE SECOND BATCH'S WITNESS ──
        //
        // The batch's whole claim is that `Bot.latchBeginEntry` reads the
        // stream at the instant `botStart`'s declaration lands — before the
        // build. This probe declares a seed and runs ZERO ticks, so the
        // entry reading must be the declared seed EXACTLY, and the distance
        // from there to the terminal reading must be the same `draws` the
        // check above computed. Two readings, one number, no argument.
        //
        // ⚠ AND THE `save.time` HALF IS THE SAME CLAIM. `botStart` writes
        // `Main.time` above the `new Game` line too, so the terminal clock is
        // the entry clock plus the fade's dead frames — the +21 the seam's
        // delta showed for L94, now readable inside ONE run instead of
        // inferred across two.
        const entry = envelope.beginEntry ?? null;
        check(`L${level}: ⛓ the begin()-ENTRY latch reads the DECLARED seed — the `
            + 'instant a segment boot reproduces',
        draws === 0
            ? entry === null || entry['rng.gameplay'] === SEED
            : Boolean(entry) && entry['rng.gameplay'] === SEED
                && entry['begin.level'] === level,
        entry === null
            ? '⛔ NO `beginEntry` BLOCK — either this build predates the second batch '
                + 'or the boot reused the current world and ran no `Game.begin()` '
                + `(draws measured ${draws}, so ${draws === 0 ? 'the reuse path is the '
                    + 'expected one here' : 'a build DID run and the block should exist'})`
            : `entry rng ${entry['rng.gameplay']} (declared ${SEED}) at L`
                + `${entry['begin.level']} tick ${entry['begin.tick']}; terminal `
                + `${got} = ${draws} draw(s) later`);
        if (entry && draws > 0) {
            const fade = latch['save.time'] - entry['save.time'];
            const dead = latch['latch.dead_frames'];
            // ⛔⛔ A BOUND, NOT AN EQUALITY — and the first run of this check
            // is why. `Game.as:832`'s `time += timeRate` and `Bot.update`'s
            // `deadFrames++` both fire once per engine frame while the fade
            // runs, so the naive claim is `fade === dead`. MEASURED on L94:
            // **fade +20 against 21 dead frames.** One frame apart, and the
            // sign is the open question: `Bot.update()` runs from the TOP of
            // `Main.update()`, BEFORE `Engine.update()` reaches
            // `Game.update()`, and the world it reads on the boot's swap
            // frame is the OUTGOING one — so exactly one frame of the window
            // is countable on either side of the swap depending on which
            // world was current when it was counted.
            //
            // ⚠ THAT IS THE KNOWN PER-LEVEL DEAD-FRAME SHAPE (R5's trap: a
            // load costs 21/20 or 20/19 and an inherited constant nearly
            // "corrected" a right answer). So this asserts the bound the two
            // accountings share and PRINTS both numbers, rather than fitting
            // an equality to whichever one came out first. A drift of two or
            // more is a real defect and still goes red.
            check(`L${level}: …and the clock's delta is the dead-frame count within one `
                + 'frame (the swap frame is countable on either side)',
            Math.abs(fade - dead) <= 1,
            `entry time ${entry['save.time']} -> terminal ${latch['save.time']} = `
                + `+${fade}, against ${dead} latched dead frame(s) — delta `
                + `${fade - dead}`);
            console.log(`  L${level} FP: entry ${entry['fp.seed']} -> terminal `
                + `${latch['fp.seed']} — the build's FP draws, a quantity nothing `
                + 'measured before this latch existed');
        }
    }
} finally {
    await browser.close();
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
