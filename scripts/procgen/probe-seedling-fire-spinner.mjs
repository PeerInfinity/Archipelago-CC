#!/usr/bin/env node
/**
 * probe-seedling-fire-spinner — ⛓⛓⛓ seedling-fidelity-firespinner: A FIRE PRESS REACHING A SPINNER, PLAYED ON THE GAME
 * AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * The witness (`fidelityFireSpinner.fireSpinnerTape`) is `r5-shaft`'s first 680 ticks plus ONE Fire press at t590, whose
 * five hit ticks reach `spinner@224,112`'s live body. `Enemy.hit`'s fire arm is `knockback(0.325, player)` per
 * dispatch (eleven a hit tick for an "Enemy") and nothing else: `hits` and `hitsTimer` stay put. The tape is played on
 * a FRESH p4g page (headless, the logic-only channel); every poll reads `botStatus` (the player) and `botMobiles` (every
 * `Spinner`: position, velocity, `hits`, `hits_timer`), and the model replays the same tape (`--on=<k1,k2>` ON, the
 * rest at their defaults).
 *
 *   --press=<t>     the Fire press tick (default 590)
 *   --end=<t>       the tape's last tick (default 680)
 *   --name=<name>   the witness name (default `firespinner-l39-knock`)
 *   --tape=<name>   a COMMITTED tape (`fixtures/tapes/<name>.json`) played as itself instead of the staging (D2's
 *                   roster witnesses: `fidelityFireSpinner.FIRESPINNER_ROSTER`); `--name` defaults to `firespinner-<name>`
 *   --on=<k1,k2>    contact-fidelity keys ON for the model's replay
 *   --record        write `fixtures/firespinner-witness/<name>.json` (the tape and the game's rows)
 *   --dump=a-b      print both sides on those ticks
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-fire-spinner.mjs --on=fireSpinnerArm
 *   node scripts/procgen/probe-seedling-fire-spinner.mjs --record
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
import { FIRESPINNER_END, FIRESPINNER_PRESS, FIRESPINNER_WITNESS, FIRESPINNER_WITNESS_DIR,
    committedTape, compareFireSpinnerWitness, fireSpinnerModelSamples, fireSpinnerSampleOf, fireSpinnerTape,
    packFireSpinnerSample } from '../../frontend/modules/seedlingDemo/fidelityFireSpinner.js';

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
        const raw = await page.evaluate(() => {
            const g = window.__swfBridge.game;
            return [String(g.botStatus()), String(g.botMobiles())];
        });
        const s = JSON.parse(raw[0]);
        const m = JSON.parse(raw[1]);
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, fireSpinnerSampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-fire-spinner.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const TAPE = arg('tape');
    const name = arg('name') ?? (TAPE ? `firespinner-${TAPE}` : FIRESPINNER_WITNESS);
    const press = TAPE ? null : Number(arg('press') ?? FIRESPINNER_PRESS);
    const end = Number(arg('end') ?? FIRESPINNER_END);
    const tape = TAPE ? committedTape(TAPE) : fireSpinnerTape({ press, end, name });
    const over = Object.fromEntries((arg('on') ?? '').split(',').filter(Boolean).map((k) => [k, true]));
    console.log(`      ${name}: ${tape.tick_count} t, ${TAPE ? `the committed tape ${TAPE}` : `Fire press at t${press}`}`
        + `${Object.keys(over).length ? ` (ON: ${Object.keys(over).join(', ')})` : ''}`);
    const model = await fireSpinnerModelSamples(tape, over);
    check(`${name}: the model replays the tape to its end`, model.error === null, model.error ?? '');
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
            console.log(`      t${g.t} game ${JSON.stringify(packFireSpinnerSample(g))}\n         model `
                + `${m ? JSON.stringify(packFireSpinnerSample(m)) : '-'}`);
        }
    }
    const bad = compareFireSpinnerWitness(samples, model.samples);
    check(`${name}: the game reproduces the model at 0 px (the player, every spinner's position, hits, hitsTimer, every fire block) on `
        + `all ${samples.length} sampled tick(s)`, bad.length === 0, `${bad.length} bad: ${bad.slice(0, 3).join('; ')}`);
    const allSp = samples.flatMap((g) => g.spinners);
    check(`${name}: on the game no spinner takes a hit (hits 0, hits_timer 0 on every sampled tick)`,
        allSp.every((b) => b.hits === 0 && b.ht === 0),
        JSON.stringify(allSp.find((b) => b.hits !== 0 || b.ht !== 0) ?? null));
    const knocks = model.firePresses.flatMap((p) => p.hits.filter((h) => h.as3 === 'Spinner')
        .map((h) => `t${p.t}→${p.fired} ${h.id} ${h.knocked ? 'knocked' : h.why}`));
    console.log(`      ${name}: the model's Fire→spinner dispatches ${knocks.length ? knocks.join('; ') : 'none'}`);
    console.log(`      ${name}: the game ends at L${status.level} t${status.tick} p(${status.x}, ${status.y})`);
    if (RECORD) {
        mkdirSync(FIRESPINNER_WITNESS_DIR, { recursive: true });
        const path = join(FIRESPINNER_WITNESS_DIR, `${name}.json`);
        writeFileSync(path, `${JSON.stringify({ name, page: PAGE_NAME,
            recordedBy: 'scripts/procgen/probe-seedling-fire-spinner.mjs --record',
            source: TAPE ? `fixtures/tapes/${TAPE}.json` : 'fixtures/tapes/r5-shaft.json (fidelityFireSpinner.fireSpinnerTape)',
            press, end: TAPE ? tape.tick_count : end,
            end_status: { level: status.level, tick: status.tick }, tape,
            rows: '[t, level, x, y, spinners, blocks] — spinners `x,y,hits,hits_timer,vx,vy;…`, fire blocks `x,y;…` (fidelityFireSpinner.packFireSpinnerSample)',
            samples: samples.map(packFireSpinnerSample) })}\n`);
        console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
