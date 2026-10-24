#!/usr/bin/env node
/**
 * probe-seedling-corpse-bump — ⛓⛓⛓ seedling-fidelity-corpsebump: THE BODIES A PUSHABLE'S GLIDE AND AN ICE-TURRET
 * CORPSE'S SLIDE STOP ON (`CONTACT_FIDELITY.blockSweepBodies`), AND THE CORPSE BUMPED ONTO A BUTTON AS A WEIGH'S HOLDER
 * (`CONTACT_FIDELITY.corpseBumpWeigh`), PLAYED ON THE GAME AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * Each witness (`fidelityCorpseBump.CORPSEBUMP_WITNESSES`) is played on a FRESH p4g page (headless, the logic-only
 * channel); every poll reads `botStatus` (the player) and `botMobiles` (every pushable block, chaser and ice turret),
 * and the model replays the same tape with the witness's switches ON (and OFF, which is reported, not checked).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-corpse-bump.mjs                     # every witness: build, play, compare
 *   node scripts/procgen/probe-seedling-corpse-bump.mjs --only=<name>[,…]   # some
 *   node scripts/procgen/probe-seedling-corpse-bump.mjs --record            # also write fixtures/corpsebump-witness/
 *   node scripts/procgen/probe-seedling-corpse-bump.mjs --dump=60-66        # print both sides on those ticks
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
import { CORPSEBUMP_WITNESSES, CORPSEBUMP_WITNESS_DIR, compareCorpseBumpWitness, corpseBumpModelSamples,
    corpseBumpSampleOf, packCorpseBumpSample } from '../../frontend/modules/seedlingDemo/fidelityCorpseBump.js';

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
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, corpseBumpSampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-corpse-bump.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const only = arg('only')?.split(',') ?? Object.keys(CORPSEBUMP_WITNESSES);
    for (const name of only) {
        const w = CORPSEBUMP_WITNESSES[name];
        if (!w) throw new Error(`unknown witness ${name}; known: ${Object.keys(CORPSEBUMP_WITNESSES).join(', ')}`);
        const tape = await w.tape();
        const model = await corpseBumpModelSamples(tape, w.switches);
        const off = await corpseBumpModelSamples(tape, Object.fromEntries(Object.keys(w.switches).map((k) => [k, false])));
        console.log(`      ${name}: ${tape.tick_count} t; switches ${JSON.stringify(w.switches)}`);
        check(`${name}: the model (switches ON) replays the tape to its end`, model.error === null, model.error ?? '');
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
                console.log(`      t${g.t} game p(${g.x}, ${g.y}) ${JSON.stringify(g.blocks)} ${JSON.stringify(g.bodies)}\n`
                    + `         model p(${m?.x}, ${m?.y}) ${JSON.stringify(m?.blocks)} ${JSON.stringify(m?.bodies)}`);
            }
        }
        const bad = compareCorpseBumpWitness(samples, model.samples);
        check(`${name}: the game reproduces the model (switches ON) at 0 px — the player, every block, every chaser and `
            + `turret — on all ${samples.length} sampled tick(s)`, bad.length === 0, bad.slice(0, 4).join('; '));
        const badOff = compareCorpseBumpWitness(samples, off.samples);
        console.log(`      ${name}: OFF the model parts from the game on ${badOff.length} tick(s)${badOff.length
            ? `, first ${badOff[0]}` : ''}${off.error ? ` (OFF error: ${off.error.slice(0, 200)})` : ''}`);
        for (const c of w.checks?.(samples) ?? []) check(`${name}: ${c.name}`, c.ok, c.detail);
        if (RECORD) {
            mkdirSync(CORPSEBUMP_WITNESS_DIR, { recursive: true });
            const path = join(CORPSEBUMP_WITNESS_DIR, `${name}.json`);
            writeFileSync(path, `${JSON.stringify({ name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-corpse-bump.mjs --record',
                end: { level: status.level, tick: status.tick }, tape,
                rows: '[t, level, x, y, blocks, bodies] — fidelityCorpseBump.packCorpseBumpSample',
                samples: samples.map(packCorpseBumpSample) })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
