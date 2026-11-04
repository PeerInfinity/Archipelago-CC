#!/usr/bin/env node
/**
 * probe-seedling-frozen-press — ⛓⛓⛓ seedling-fidelity-frozenpress: A `primary` PRESS INSIDE AN ICE TURRET'S FREEZE IS
 * LOST ON THE GAME, AND THE SAME PRESS MOVED TO THE FIRST INPUT THE MODEL'S `freezeForecast` CALLS FREE LANDS — PLAYED
 * ON THE GAME AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * Each witness (`fidelityFrozenPress.FROZENPRESS_WITNESSES`) is played on a FRESH p4g page (headless, the logic-only
 * channel); every poll reads `botStatus` (the player, its hits and freeze) and `botMobiles` (the turret, its hits and
 * i-frame). The model replays the witness's MODEL tape (`frozenPressModelTape`: a lost press is modelled as no press —
 * `levelRun` refuses to author one, `FROZEN_TICK_PRESS`) and its `freezeForecast` is checked against the game's
 * `frozen_timer` on every input.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-frozen-press.mjs                     # every witness: build, play, compare
 *   node scripts/procgen/probe-seedling-frozen-press.mjs --only=<name>[,…]   # some
 *   node scripts/procgen/probe-seedling-frozen-press.mjs --record            # also write fixtures/frozenpress-witness/
 *   node scripts/procgen/probe-seedling-frozen-press.mjs --dump=60-70        # print both sides on those ticks
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
import { FROZENPRESS_WITNESSES, FROZENPRESS_WITNESS_DIR, compareFrozenPressWitness, frozenPressModelSamples,
    frozenPressModelTape, frozenPressSampleOf, packFrozenPressSample } from '../../frontend/modules/seedlingDemo/fidelityFrozenPress.js';

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
    const deadline = Date.now() + 1200000;
    let status = null;
    while (Date.now() < deadline) {
        const raw = await page.evaluate(() => {
            const g = window.__swfBridge.game;
            return [String(g.botStatus()), String(g.botMobiles())];
        });
        const s = JSON.parse(raw[0]);
        const m = JSON.parse(raw[1]);
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, frozenPressSampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-frozen-press.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const only = arg('only')?.split(',') ?? Object.keys(FROZENPRESS_WITNESSES);
    for (const name of only) {
        const w = FROZENPRESS_WITNESSES[name];
        if (!w) throw new Error(`unknown witness ${name}; known: ${Object.keys(FROZENPRESS_WITNESSES).join(', ')}`);
        const tape = await w.tape();
        const model = await frozenPressModelSamples(await frozenPressModelTape(name));
        const raw = await frozenPressModelSamples(tape);
        console.log(`      ${name}: ${tape.tick_count} t; model presses ${JSON.stringify(w.modelPresses)}; the tape `
            + `itself in the model: ${raw.error ?? 'replays'}`);
        check(`${name}: the model replays its model tape to its end`, model.error === null, model.error ?? '');
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
        const dump = arg('dump')?.split('-').map(Number) ?? null;
        if (dump) {
            for (const g of samples.filter((x) => x.t >= dump[0] && x.t <= dump[1])) {
                const m = model.samples[g.t];
                console.log(`      t${g.t} game ${JSON.stringify(g)}\n`
                    + `         model ${JSON.stringify(m)}`);
            }
        }
        const bad = compareFrozenPressWitness(samples, model.samples);
        check(`${name}: the game reproduces the model at 0 px — the player, its hits and freeze, the turret, its hits `
            + `and i-frame — on all ${samples.length} sampled tick(s)`, bad.length === 0, bad.slice(0, 4).join('; '));
        // The forecast for input t against the game: input t is refused iff the observation it produces has
        // frozen_timer > 0 (the gate reads the timer after that tick's `freezeStep`).
        const byT = new Map(samples.map((g) => [g.t, g]));
        const fbad = [];
        for (let t = 0; t + 1 < tape.tick_count; t += 1) {
            const g = byT.get(t + 1);
            if (!g || !model.forecast[t]) continue;
            if (model.forecast[t].refusedNext !== (g.frozen > 0)) fbad.push(`input ${t}: forecast `
                + `${model.forecast[t].refusedNext} game frozen_timer ${g.frozen}`);
        }
        check(`${name}: the model's freezeForecast names exactly the inputs the game refuses`, fbad.length === 0,
            fbad.slice(0, 4).join('; '));
        for (const c of w.checks?.(samples) ?? []) check(`${name}: ${c.name}`, c.ok, c.detail);
        if (RECORD) {
            mkdirSync(FROZENPRESS_WITNESS_DIR, { recursive: true });
            const path = join(FROZENPRESS_WITNESS_DIR, `${name}.json`);
            writeFileSync(path, `${JSON.stringify({ name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-frozen-press.mjs --record',
                end: { level: status.level, tick: status.tick }, tape,
                rows: '[t, level, x, y, hits, frozen, turret "x,y,hits,hitsTimer"] — fidelityFrozenPress.packFrozenPressSample',
                samples: samples.map(packFrozenPressSample) })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
