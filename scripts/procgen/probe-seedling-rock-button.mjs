#!/usr/bin/env node
/**
 * probe-seedling-rock-button — ⛓⛓⛓ seedling-fidelity-rockbutton (wave 41): A LANDED FALLROCK HOLDS A BUTTON DOWN
 * (`CONTACT_FIDELITY.fallRockHoldsButton`), PLAYED ON THE GAME.
 *
 * Plays each `fidelityRockButton.ROCKBUTTON_WITNESSES` tape (L28: the walk with the rock booted fallen, its control with
 * nothing cleared, and the in-play rope cut whose rock lands on `button@112,240`) on a FRESH p4g page (headless, the
 * logic-only channel) and compares it with the model tick by tick, the switch ON: the player at 0 px, the level, the
 * hits, and L28's persistence writes (the rope {28,0}, the rock {28,1}, `grasslock@176,208`'s {28,2}). With `--off`, it
 * also prints how far the model with the switch OFF is from the game (informational; no check).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-rock-button.mjs                         # every witness: build, play, compare
 *   node scripts/procgen/probe-seedling-rock-button.mjs --only=rockbutton-l28-walk
 *   node scripts/procgen/probe-seedling-rock-button.mjs --record                # also write fixtures/rockbutton-witness/<name>.json
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { L28, ROCKBUTTON_WITNESS_DIR, ROCKBUTTON_WITNESSES, compareRockButton, rockButtonModelSamples,
    rockButtonSampleOf, rockButtonTape } from '../../frontend/modules/seedlingDemo/fidelityRockButton.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
async function playOnGame(page, tapeJson) {
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const tape = parseTape(JSON.stringify(tapeJson));
    const bot = (n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge.game;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    const started = await bot('botStart');
    if (started !== 'ok') throw new Error(`botStart: ${started}`);
    const byTick = new Map();
    const deadline = Date.now() + 600000;
    let status = null;
    while (Date.now() < deadline) {
        const s = JSON.parse(await page.evaluate(() => String(window.__swfBridge.game.botStatus())));
        if (Number.isInteger(s.tick)) byTick.set(s.tick, rockButtonSampleOf(s));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const only = arg('only')?.split(',') ?? null;
    const RECORD = process.argv.includes('--record');
    const OFF = process.argv.includes('--off');
    takeBoxLockOrExit({ name: 'probe-seedling-rock-button.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    for (const w of ROCKBUTTON_WITNESSES) {
        if (only && !only.includes(w.name)) continue;
        const tape = await rockButtonTape(w);
        const model = await rockButtonModelSamples(tape);
        const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
        let played;
        try {
            const page = await browser.newPage();
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
                await page.waitForTimeout(250);
            }
            await assertLogicOnlyChannel(page);
            played = await playOnGame(page, tape);
        } finally {
            await browser.close();
        }
        const { status, samples } = played;
        const bad = compareRockButton(samples, model.samples);
        check(`${w.name}: the game reproduces the model (switch ON) at 0 px on all ${samples.length} sampled tick(s) `
            + '(player, level, hits, L28 flags)', bad.length === 0, bad.slice(0, 4).join('; '));
        const first = (tag) => samples.find((s) => s.cleared.includes(tag))?.t ?? null;
        const lockModel = model.ledger.writes.find((x) => x.tag === L28.lock.tag)?.t ?? null;
        check(`${w.name}: the game writes ${L28.lock.id}'s {28,${L28.lock.tag}} at the model's lockWrites t + 1`
            + `${lockModel === null ? ' (the model writes none: neither must the game)' : ` (t${lockModel + 1})`}`,
        first(L28.lock.tag) === (lockModel === null ? null : lockModel + 1),
        `game first holds it at ${first(L28.lock.tag) === null ? 'no tick' : `t${first(L28.lock.tag)}`}`);
        const minY = Math.min(...samples.filter((s) => s.level === L28.level).map((s) => s.y));
        console.log(`  ${w.name}: game min y ${minY.toFixed(2)}, end (${status.x?.toFixed?.(2)}, ${status.y?.toFixed?.(2)}) `
            + `L${status.level}, max hits ${Math.max(0, ...samples.map((s) => s.hits ?? 0))}; rope {28,0} t${first(0)}, `
            + `rock {28,1} t${first(1)}, lock {28,2} ${first(2) === null ? '-' : `t${first(2)}`}`);
        if (OFF) {
            const off = await rockButtonModelSamples(tape, { fallRockHoldsButton: false });
            const offBad = compareRockButton(samples, off.samples);
            console.log(`  INFO ${w.name}: the switch OFF differs from the game on ${offBad.length} tick(s)`
                + `${offBad.length ? ` — first ${offBad[0]}` : ''}`);
        }
        if (RECORD) {
            mkdirSync(ROCKBUTTON_WITNESS_DIR, { recursive: true });
            const path = join(ROCKBUTTON_WITNESS_DIR, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify({ name: w.name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-rock-button.mjs --record',
                end: { level: status.level, tick: status.tick }, writes: model.ledger.writes, tape, samples })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
