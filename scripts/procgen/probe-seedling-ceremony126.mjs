#!/usr/bin/env node
/**
 * probe-seedling-ceremony126 — ⛓⛓⛓ seedling-fidelity-ceremony126: L64's GHOSTSPEAR CEREMONY ON THE GAME — the
 * solver's route-survey step-125 tape (the stance walk enters the pickup, the verb pages the ceremony) and a `primary`
 * press whose thrust lands on the ceremony's first frozen frame (LOST) — PLAYED ON THE GAME AND COMPARED WITH THE MODEL
 * TICK BY TICK.
 *
 * Each witness (`fidelityCeremony126.CEREMONY126_WITNESSES`) is played on a FRESH p4g page (headless, the logic-only
 * channel); every poll reads `botStatus` (hits, frozen timer); the level and position are the game's own per-tick observations
 * (`botDrain`), read after the tape finishes. The model replays the
 * witness's MODEL tape (a lost press is modelled as no press — `levelRun` refuses to author one, `FROZEN_TICK_PRESS`).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-ceremony126.mjs                     # every witness: build, play, compare
 *   node scripts/procgen/probe-seedling-ceremony126.mjs --only=<name>[,…]   # some
 *   node scripts/procgen/probe-seedling-ceremony126.mjs --record            # also write fixtures/ceremony126-witness/
 *   node scripts/procgen/probe-seedling-ceremony126.mjs --dump=40-50        # print both sides on those ticks
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
import { CEREMONY126_SPAN, CEREMONY126_WITNESSES, CEREMONY126_WITNESS_DIR, ceremony126ModelSamples, ceremony126SampleOf,
    compareCeremony126Witness, packCeremony126Sample } from '../../frontend/modules/seedlingDemo/fidelityCeremony126.js';

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
        const s = JSON.parse(await page.evaluate(() => String(window.__swfBridge.game.botStatus())));
        if (Number.isInteger(s.tick) && !byTick.has(s.tick)) byTick.set(s.tick, ceremony126SampleOf(s));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    // ⚠ The level and position come from the game's OWN per-tick observation (`Bot.botDrain`: `obsX/obsY/obsLevel`,
    // recorded at the tick's input, `Bot.as:3234`), not from the poll: a poll that first sees a tick while the
    // ceremony's dead frames are still running reads the live `p.x` of a frame the tape never observes (measured: t74,
    // the first live tick after the Ghostspear's ceremony, read the frozen position; t75 on agreed).
    const drained = JSON.parse(await bot('botDrain')).ticks;
    const obs = new Map(drained.map((o) => [o.t, o]));
    const samples = [...byTick.values()].filter((s) => s.t <= tape.tick_count && obs.has(s.t))
        .map((s) => ({ ...s, level: obs.get(s.t).level, x: obs.get(s.t).x, y: obs.get(s.t).y }))
        .sort((a, b) => a.t - b.t);
    return { status, samples, polled: byTick.size, drained: drained.length };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-ceremony126.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const only = arg('only')?.split(',') ?? Object.keys(CEREMONY126_WITNESSES);
    for (const name of only) {
        const w = CEREMONY126_WITNESSES[name];
        if (!w) throw new Error(`unknown witness ${name}; known: ${Object.keys(CEREMONY126_WITNESSES).join(', ')}`);
        const tape = w.tape();
        const model = await ceremony126ModelSamples(w.model());
        const raw = await ceremony126ModelSamples(tape);
        console.log(`      ${name}: ${tape.tick_count} t; the tape itself in the model: ${raw.error ?? 'replays'}; `
            + `model ceremony obs ${model.ceremony[0]}..${model.ceremony.at(-1)}`);
        check(`${name}: the model replays its model tape to its end`, model.error === null, model.error ?? '');
        check(`${name}: the model's ceremony holds obs ${CEREMONY126_SPAN.firstObs}..${CEREMONY126_SPAN.lastObs}`,
            model.ceremony[0] === CEREMONY126_SPAN.firstObs && model.ceremony.at(-1) === CEREMONY126_SPAN.lastObs,
            `${model.ceremony[0]}..${model.ceremony.at(-1)}`);
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
        console.log(`      ${name}: polled ${played.polled} tick(s), drained ${played.drained} observation(s)`);
        const dump = arg('dump')?.split('-').map(Number) ?? null;
        if (dump) {
            for (const g of samples.filter((x) => x.t >= dump[0] && x.t <= dump[1])) {
                console.log(`      t${g.t} game ${JSON.stringify(g)}\n         model ${JSON.stringify(model.samples[g.t])}`);
            }
        }
        const bad = compareCeremony126Witness(samples, model.samples);
        check(`${name}: the game reproduces the model at 0 px — level, player, hits, frozen timer — on all `
            + `${samples.length} sampled tick(s)`, bad.length === 0, bad.slice(0, 4).join('; '));
        check(`${name}: the game finished in level 62 (the exit) with the tape's error null`,
            status.level === 62 && !status.error, `level ${status.level} error ${status.error}`);
        if (RECORD) {
            mkdirSync(CEREMONY126_WITNESS_DIR, { recursive: true });
            const path = join(CEREMONY126_WITNESS_DIR, `${name}.json`);
            writeFileSync(path, `${JSON.stringify({ name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-ceremony126.mjs --record',
                end: { level: status.level, tick: status.tick, dead_frames: status.dead_frames ?? null }, tape,
                rows: '[t, level, x, y, hits, frozen] — fidelityCeremony126.packCeremony126Sample',
                samples: samples.map(packCeremony126Sample) })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
