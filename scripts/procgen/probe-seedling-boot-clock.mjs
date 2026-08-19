#!/usr/bin/env node
/**
 * probe-seedling-boot-clock — does a BOOT reach `Game.begin()` at the clock
 * it declared, or one frame past it? R7 slice 2b.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * Slice 2b's batch closed the seam's gameplay-stream offset EXACTLY (1562
 * draws, gone) and left the ending state differing on ONE field by ONE:
 * `save.time`, headline 4969 against the chain's 4970. Every other one of
 * the 46 signature rows agreed.
 *
 * The hypothesis is structural rather than numerical, and it is testable in
 * one boot. `Bot.botStart` writes `Main.time` and then `FP.world = new
 * Game(...)`, which only sets `FP._goto` — the swap runs in
 * `Engine.checkWorld()` at the END of the NEXT `Engine.update()`, and that
 * same `Engine.update()` has already run the OUTGOING world's
 * `Game.update()`, whose `time += timeRate` is below the `blackCover` gate
 * but outside it (`Game.as:832`). So a BOOT spends exactly one outgoing-world
 * update between its declaration and its `Game.begin()`, while a CONTIGUOUS
 * arrival's equivalent frame is already inside the number its own entry latch
 * reads.
 *
 * ⇒ IF a boot declaring `time: T` reaches `begin()` at **T + 1**, the chain's
 * +1 is that one frame, the mechanism is named, and the correct declaration
 * for a successor segment is the predecessor's entry reading MINUS ONE — a
 * DERIVED quantity, not a fitted one.
 *
 * ⇒ IF it reaches `begin()` at T, the hypothesis is refuted and the +1 lives
 * somewhere else, which is a finding and not a number to subtract.
 *
 * ⛔ THE ARM THAT MAKES IT A MEASUREMENT: L0 at (80,128) is the page's own
 * boot, so `Bot.as:1638` REUSES the world and runs no `Game.begin()` at all.
 * That arm must report NO `beginEntry` block — so a "T+1" reading in the L94
 * arm cannot be an artefact of the probe reading some unrelated entry.
 *
 * ⚠ `pins: ["dead_frames"]`, so the clock is update-determined and the
 * reading means what it means in the chain (`Game.as:832` counts dead frames,
 * which are per-RENDER in vanilla).
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/probe-seedling-boot-clock.mjs
 */

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
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

/** A clock the game really occupies, well away from any day/night boundary. */
const DECLARED_TIME = 4881;

const ARMS = [
    {
        name: 'L94 (a real build)',
        boot: { level: 94, x: 288, y: 160 },
        expectsEntry: true,
    },
    {
        name: 'L0 at the page\'s own boot (the world is REUSED)',
        boot: { level: 0, x: 80, y: 128 },
        expectsEntry: false,
    },
];

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

try {
    console.log('# a boot\'s declared clock, read back at `Game.begin()` ENTRY\n');
    console.log(`  declared \`seam.time\` = ${DECLARED_TIME} in every arm\n`);
    for (const arm of ARMS) {
        const tape = parseTape({
            tape_version: 8,
            game: 'seedling',
            boot: arm.boot,
            noclip: false,
            noDamage: false,
            noHazards: [],
            grants: [],
            persistence: [],
            equips: [],
            pins: ['dead_frames'],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: { seed: 987286273, split: false, cosmetic: 0, fp: 0 },
            seam: { time: DECLARED_TIME },
            tick_count: 0,
            inputs: [],
        });
        const page = await browser.newPage();
        let envelope;
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready',
                () => page.evaluate(() => !!window.__runtimeReady));
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks',
                () => page.evaluate(() => !!(window.__swfBridge?.game?.botSeam)));
            const loaded = await call(page, 'botLoadTape', JSON.stringify(tape));
            if (loaded !== 'ok') throw new Error(`botLoadTape(${arm.name}): ${loaded}`);
            const started = await call(page, 'botStart');
            if (started !== 'ok') throw new Error(`botStart(${arm.name}): ${started}`);
            await waitFor(page, `${arm.name} to finish`, async () => {
                const st = JSON.parse(await call(page, 'botStatus'));
                return st.finished ? st : null;
            });
            envelope = JSON.parse(await call(page, 'botSeam'));
        } finally {
            await page.close();
        }
        const entry = envelope.beginEntry ?? null;
        if (!arm.expectsEntry) {
            check(`${arm.name}: NO \`beginEntry\` block — the world was reused and no `
                + '`Game.begin()` ran',
            entry === null,
            entry === null
                ? '⛓ the negative control holds: a reading in the other arm cannot be an '
                    + 'artefact of the probe, because this arm produces none'
                : `⛔ got an entry block ${JSON.stringify(entry)} — `
                    + '`Bot.as:1638`\'s reuse path did not take, and every other reading '
                    + 'in this probe is suspect');
            continue;
        }
        if (!entry) {
            check(`${arm.name}: an entry block exists`, false,
                '⛔ no `beginEntry` — this build predates the second batch');
            continue;
        }
        const delta = entry['save.time'] - DECLARED_TIME;
        check(`${arm.name}: ⛓ the boot reaches \`Game.begin()\` ONE frame past its `
            + 'declared clock',
        delta === 1,
        `declared ${DECLARED_TIME} -> entry ${entry['save.time']} = +${delta} at L`
            + `${entry['begin.level']} tick ${entry['begin.tick']}. `
            + (delta === 1
                ? '⛓ THE MECHANISM IS NAMED: `botStart` writes `Main.time` and then only '
                    + 'sets `FP._goto`; the swap runs in `Engine.checkWorld()` at the END '
                    + 'of the next `Engine.update()`, which has ALREADY run the OUTGOING '
                    + 'world\'s `Game.update()` and its `time += timeRate` '
                    + '(`Game.as:832`). A contiguous arrival\'s equivalent frame is '
                    + 'already inside its own entry reading. ⇒ a successor segment must '
                    + 'declare the predecessor\'s entry reading MINUS ONE, and that is '
                    + 'DERIVED.'
                : delta === 0
                    ? '⛔ THE HYPOTHESIS IS REFUTED — the boot lands exactly on its '
                        + 'declaration, so the chain\'s +1 lives somewhere else and is '
                        + 'not a frame to subtract.'
                    : `⛔ +${delta}, which is neither hypothesis. The outgoing world runs `
                        + 'more than one update between the declaration and the swap, and '
                        + 'the count is what needs naming.'));
    }
} finally {
    await browser.close();
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
