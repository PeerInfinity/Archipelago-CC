#!/usr/bin/env node
/**
 * probe-seedling-l40bk2 — ⛓⛓⛓ seedling-fidelity-l40bk2: L40'S BOSS KEY 2 CHAIN AS THE SOLVER BUILDS IT FROM INSIDE THE
 * LOCK ROOM (the Sword's circling kill, the corpse on t2, 35 Fire presses onto t5, the hold on `button@816,400`, the
 * pulser's push), PLAYED ON THE GAME AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * Each witness (`fidelityL40Bk2.L40BK2_WITNESSES`) is played on a FRESH p4g page (headless, the logic-only channel);
 * every poll reads `botStatus` (the player, its hits) and `botMobiles` (every pushable block, chaser and ice turret),
 * and the model replays the same tape with the witness's switches ON (and OFF, which is reported, not checked).
 * `--from-fixture` plays the committed recording's tape instead of re-solving it (the solve is ~3.5 min).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-l40bk2.mjs                     # every witness: build, play, compare
 *   node scripts/procgen/probe-seedling-l40bk2.mjs --only=<name>[,…]   # some
 *   node scripts/procgen/probe-seedling-l40bk2.mjs --from-fixture      # the committed tape, not a fresh solve
 *   node scripts/procgen/probe-seedling-l40bk2.mjs --record            # also write fixtures/l40bk2-witness/
 *   node scripts/procgen/probe-seedling-l40bk2.mjs --dump=60-66        # print both sides on those ticks
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { compareCorpseBumpWitness, corpseBumpModelSamples } from '../../frontend/modules/seedlingDemo/fidelityCorpseBump.js';
import { L40BK2_WITNESSES, L40BK2_WITNESS_DIR, l40Bk2SampleOf, packL40Bk2Sample }
    from '../../frontend/modules/seedlingDemo/fidelityL40Bk2.js';

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
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, l40Bk2SampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-l40bk2.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const FROM_FIXTURE = process.argv.includes('--from-fixture');
    const only = arg('only')?.split(',') ?? Object.keys(L40BK2_WITNESSES);
    for (const name of only) {
        const w = L40BK2_WITNESSES[name];
        if (!w) throw new Error(`unknown witness ${name}; known: ${Object.keys(L40BK2_WITNESSES).join(', ')}`);
        const tape = FROM_FIXTURE
            ? JSON.parse(readFileSync(join(L40BK2_WITNESS_DIR, `${name}.json`), 'utf8')).tape : await w.tape();
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
            mkdirSync(L40BK2_WITNESS_DIR, { recursive: true });
            const path = join(L40BK2_WITNESS_DIR, `${name}.json`);
            writeFileSync(path, `${JSON.stringify({ name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-l40bk2.mjs --record',
                end: { level: status.level, tick: status.tick }, tape,
                rows: '[t, level, x, y, blocks, bodies, hits] — fidelityL40Bk2.packL40Bk2Sample',
                samples: samples.map(packL40Bk2Sample) })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
