#!/usr/bin/env node
/**
 * probe-seedling-l39-pulser-kill — ⛓⛓ seedling-fidelity-l39phantom D0: A PULSER KILLS `spinner@112,88` IN L39, ON THE
 * GAME, and what is left of it afterwards (its fade, its removal), compared with the model tick by tick at 0 px.
 *
 * Plays the committed `l39shaft-solver-step66` witness's tape (the survey's step-66 plan; p4g; the delivered set,
 * mounted with `botLoadLevels`) on a FRESH page (headless, the logic-only channel) and, on every tick of
 * `L39PHANTOM_WINDOW`, reads `botMobiles`' `Spinner` rows (`x`, `y`, `hits`, `hits_timer`, `destroy`, `alpha`). The
 * model replays the same tape (`fidelityL39Phantom.l39PhantomModelSamples`). Checks: the game and the model agree on
 * every sampled tick; the model's `pulserEnemyKills` names `pulser@64,96 → spinner@112,88`; the game's death / last
 * listed / gone ticks equal the model's.
 *
 *   --record        write `fixtures/l39shaft-witness/l39phantom-pulser-kill.json` (the game's rows over the window)
 *   --dump=a-b      print both sides on those ticks
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-l39-pulser-kill.mjs [--record] [--dump=1260-1280]
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
import { L39PHANTOM_PATH, L39PHANTOM_PULSER, L39PHANTOM_SOURCE, L39PHANTOM_SPINNER, L39PHANTOM_WINDOW,
    L39PHANTOM_WITNESS, L39SHAFT_WITNESS_DIR, compareL39Phantom, deathReadout, gameSpinnerRows,
    l39PhantomModelSamples, packSpinnerRows } from '../../frontend/modules/seedlingDemo/fidelityL39Phantom.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** The delivered set, as `probe-seedling-l39-shaft.mjs` mounts it. */
async function deliveredSet() {
    const { vanillaRecordSet } = await import(join(MODULE, 'levelSetExporter.js'));
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    return vanillaRecordSet(readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
        readJson('frontend/modules/flashPanel/atlases/seedling-map.json')).set;
}

async function playOnGame(page, tapeJson, set) {
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { planLevelSetChunks } = await import(join(MODULE, 'levelSetValidator.js'));
    const tape = parseTape(JSON.stringify(tapeJson));
    const bot = (n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge.game;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const answers = [];
    for (const c of planLevelSetChunks(set).chunks) answers.push(await bot('botLoadLevels', JSON.stringify(c)));
    if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
    if (await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape refused');
    if (await bot('botStart') !== 'ok') throw new Error('botStart refused');
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
        if (Number.isInteger(s.tick) && m.tick === s.tick && s.tick >= L39PHANTOM_WINDOW.from && s.tick <= L39PHANTOM_WINDOW.to) {
            byTick.set(s.tick, { t: s.tick, level: s.level, rows: s.level === 39 ? packSpinnerRows(gameSpinnerRows(m)) : '' });
        }
        if (s.finished || (Number.isInteger(s.tick) && s.tick > L39PHANTOM_WINDOW.to)) { status = s; break; }
    }
    if (!status) throw new Error('the tape never passed the window inside the deadline');
    return { status, samples: [...byTick.values()].sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-l39-pulser-kill.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const source = JSON.parse(readFileSync(join(L39SHAFT_WITNESS_DIR, `${L39PHANTOM_SOURCE}.json`), 'utf8'));
    const tape = source.tape;
    const model = await l39PhantomModelSamples(tape, {}, { set: 'delivered' });
    check('the model replays the window', model.error === null, model.error ?? '');
    const kill = model.kills.find((k) => k.enemy === L39PHANTOM_SPINNER);
    check(`the model's pulserEnemyKills names ${L39PHANTOM_PULSER} → ${L39PHANTOM_SPINNER}`,
        kill?.pulser === L39PHANTOM_PULSER, JSON.stringify(kill ?? null));
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
        played = await playOnGame(page, tape, await deliveredSet());
    } finally {
        await browser.close();
    }
    const { samples } = played;
    const msamples = model.samples.filter(Boolean).map((m) => ({ t: m.t, level: m.level, rows: packSpinnerRows(m.rows) }));
    const mByT = [];
    for (const m of msamples) mByT[m.t] = m;
    const dump = arg('dump')?.split('-').map(Number) ?? null;
    if (dump) {
        for (const g of samples.filter((x) => x.t >= dump[0] && x.t <= dump[1])) {
            console.log(`      t${g.t} game  [${g.rows}]\n            model [${mByT[g.t]?.rows ?? '-'}]`);
        }
    }
    const span = L39PHANTOM_WINDOW.to - L39PHANTOM_WINDOW.from + 1;
    check(`the game was sampled on every tick of the window (${span})`, samples.length === span, `${samples.length}`);
    const { bad, fencepost } = compareL39Phantom(samples, mByT);
    check(`the game reproduces the model at 0 px (every spinner's x, y, hits, hitsTimer, destroy, alpha) on all `
        + `${samples.length} sampled tick(s) but the named removal fencepost`, bad.length === 0, bad.slice(0, 3).join('; '));
    const g = deathReadout(samples);
    const m = deathReadout(msamples);
    check('the kill: destroy goes up on the same tick on both sides', g.destroyAt !== null && g.destroyAt === m.destroyAt,
        `game ${JSON.stringify(g)} model ${JSON.stringify(m)}`);
    check('the removal fencepost (`isRemovePendingFencepost`) is exactly one observation, the game\'s first gone tick',
        fencepost.length === 1 && fencepost[0] === g.goneAt && m.goneAt === g.goneAt + 1,
        `fencepost ticks [${fencepost}]`);
    if (RECORD) {
        mkdirSync(L39SHAFT_WITNESS_DIR, { recursive: true });
        writeFileSync(L39PHANTOM_PATH, `${JSON.stringify({ name: L39PHANTOM_WITNESS, page: PAGE_NAME,
            recordedBy: 'scripts/procgen/probe-seedling-l39-pulser-kill.mjs --record',
            source: `fixtures/l39shaft-witness/${L39PHANTOM_SOURCE}.json (its tape)`, set: 'delivered',
            window: L39PHANTOM_WINDOW, readout: g, modelReadout: m, removePendingFencepost: fencepost,
            rows: '{t, level, rows: x,y,hits,hitsTimer,destroy(0|1),alpha per Spinner, sorted, ;-joined} — fidelityL39Phantom.packSpinnerRows',
            samples })}\n`);
        console.log(`recorded ${L39PHANTOM_PATH.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
