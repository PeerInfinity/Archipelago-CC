#!/usr/bin/env node
/**
 * probe-seedling-l39-shaft — ⛓⛓⛓ seedling-fidelity-l39shaft: L39'S THREE-BLOCK SHAFT, THE USER'S SOLUTION, PLAYED ON
 * THE GAME AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * The three blocks onto the three inner buttons, the player between them at (9,9), one Fire press: each block glides
 * onto the outer button under the cover the other two hold open, and for ~22 ticks every block is on two buttons at
 * once (`fidelityL39Shaft.js`). The tape is played on a FRESH p4g page (headless, the logic-only channel); every poll
 * reads `botStatus` (the player, `persistence_cleared`) and `botMobiles` (every `PushableBlockFire` and `Spinner`),
 * and the model replays the same tape (keys `--on=<k1,k2>` ON, the rest at their defaults).
 *
 *   --tape=<file>   the tape (default: the committed `r5-shaft`, `SHAFT_PLAN`'s eighteen presses — D1, the scripted
 *                   witness); a survey walk view for D2 (the solver's own plan)
 *   --name=<name>   the witness name (default `l39shaft-scripted`)
 *   --record        write `fixtures/l39shaft-witness/<name>.json` (the tape and the game's rows)
 *   --set=<set>     `vanilla` (default: the page's own levels, the atlas records) or `delivered` (the playthrough's
 *                   set — `SEEDLING_SET_PATCHES` applied, mounted with `botLoadLevels`; L39 has no fallrock there), the
 *                   model replaying on the same records (`fidelityL39Shaft.l39LevelSource`)
 *   --on=<k1,k2>    contact-fidelity keys ON for the model's replay (the rest at their defaults)
 *   --dump=a-b      print both sides on those ticks
 *   --json [--json-out=<file>]   also write both sides' packed rows (`{game, model}`) for an offline diff
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-l39-shaft.mjs
 *   node scripts/procgen/probe-seedling-l39-shaft.mjs --tape=<step-66-walk.json> --name=l39shaft-solver-step66 --on=l39ShaftPress --record
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
import { L39, L39SHAFT_SCRIPTED_WITNESS, L39SHAFT_WITNESS_DIR, compareL39Witness, halfOnReadout, l39ModelSamples,
    l39SampleOf, lockTimeline, packL39Sample } from '../../frontend/modules/seedlingDemo/fidelityL39Shaft.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** The delivered set (`vanillaRecordSet` with the default patches), as `probe-seedling-l39-pulser.mjs` mounts it. */
async function deliveredSet() {
    const { vanillaRecordSet } = await import(join(MODULE, 'levelSetExporter.js'));
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    return vanillaRecordSet(readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
        readJson('frontend/modules/flashPanel/atlases/seedling-map.json')).set;
}

async function playOnGame(page, tapeJson, set = null) {
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const tape = parseTape(JSON.stringify(tapeJson));
    const bot = (n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge.game;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    if (set) {
        const { planLevelSetChunks } = await import(join(MODULE, 'levelSetValidator.js'));
        const answers = [];
        for (const c of planLevelSetChunks(set).chunks) answers.push(await bot('botLoadLevels', JSON.stringify(c)));
        if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
        console.log(`      mounted ${set.set_id}: ${JSON.parse(await bot('botLevelSet'))?.active ?? '?'}`);
    }
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
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, l39SampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

/** The lock ledger's read offset that makes the game's lock rows agree with the model's (0 first, then 1, 2). */
function lockLagOf(game, model) {
    for (const lag of [0, 1, 2]) {
        if (game.every((g) => g.level !== L39 || (model[g.t - lag]?.locks ?? []).join(',') === g.locks.join(','))) return lag;
    }
    return null;
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-l39-shaft.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const name = arg('name') ?? L39SHAFT_SCRIPTED_WITNESS;
    const tapePath = arg('tape') ?? join(MODULE, 'fixtures', 'tapes', 'r5-shaft.json');
    const raw = JSON.parse(readFileSync(tapePath, 'utf8'));
    const tape = { ...(raw.tape ?? raw), name };
    const over = Object.fromEntries((arg('on') ?? '').split(',').filter(Boolean).map((k) => [k, true]));
    console.log(`      ${name}: ${tape.tick_count} t from ${tapePath.startsWith(REPO) ? tapePath.slice(REPO.length + 1) : tapePath}`
        + `${Object.keys(over).length ? ` (ON: ${Object.keys(over).join(', ')})` : ''}`);
    const SET = arg('set') ?? 'vanilla';
    const model = await l39ModelSamples(tape, over, { set: SET });
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
        played = await playOnGame(page, tape, SET === 'delivered' ? await deliveredSet() : null);
    } finally {
        await browser.close();
    }
    const { status, samples } = played;
    const dump = arg('dump')?.split('-').map(Number) ?? null;
    if (dump) {
        for (const g of samples.filter((x) => x.t >= dump[0] && x.t <= dump[1])) {
            const m = model.samples[g.t];
            console.log(`      t${g.t} game ${JSON.stringify(packL39Sample(g))}\n         model ${m ? JSON.stringify(packL39Sample(m)) : '-'}`);
        }
    }
    if (process.argv.includes('--json')) {
        writeFileSync(arg('json-out') ?? '/dev/stdout', JSON.stringify({ game: samples.map(packL39Sample),
            model: model.samples.map((m) => (m ? packL39Sample(m) : null)) }));
    }
    const lag = lockLagOf(samples, model.samples);
    check(`${name}: the lock ledger agrees at a fixed read offset`, lag !== null, lag === null ? 'no offset in 0..2' : `${lag} tick(s)`);
    const bad = compareL39Witness(samples, model.samples, { lockLag: lag ?? 0 });
    check(`${name}: the game reproduces the model at 0 px (the player, every fire block, every spinner, the lock tags) `
        + `on all ${samples.length} sampled tick(s)`, bad.length === 0, bad.slice(0, 4).join('; '));
    const gh = halfOnReadout(samples);
    const mh = halfOnReadout(model.samples);
    check(`${name}: the half-on window — all three blocks each on two buttons — is the model's, tick for tick`,
        JSON.stringify(gh.allThreeTwoOn) === JSON.stringify(mh.allThreeTwoOn),
        `game ${gh.allThreeTwoOn.length} tick(s) t${gh.allThreeTwoOn[0] ?? '-'}..t${gh.allThreeTwoOn.at(-1) ?? '-'}, `
        + `model ${mh.allThreeTwoOn.length} t${mh.allThreeTwoOn[0] ?? '-'}..t${mh.allThreeTwoOn.at(-1) ?? '-'}`);
    check(`${name}: every outer button is under a block`, gh.allOuter !== null, gh.allOuter === null ? 'never' : `from t${gh.allOuter}`);
    const end = samples.at(-1);
    check(`${name}: the three shaft wandlocks' tags {39,0} {39,1} {39,2} are cleared, {39,7} is not`,
        ['0', '1', '2'].every((t) => end.locks.map(String).includes(t)) && !end.locks.includes(7),
        `the game ends with [${end.locks}]`);
    console.log(`      ${name}: the game's lock timeline ${JSON.stringify(lockTimeline(samples))}`);
    console.log(`      ${name}: the game ends at L${status.level} t${status.tick} p(${status.x}, ${status.y}), hits ${status.hits ?? '-'}`);
    if (RECORD) {
        mkdirSync(L39SHAFT_WITNESS_DIR, { recursive: true });
        const path = join(L39SHAFT_WITNESS_DIR, `${name}.json`);
        writeFileSync(path, `${JSON.stringify({ name, page: PAGE_NAME,
            recordedBy: 'scripts/procgen/probe-seedling-l39-shaft.mjs --record',
            source: tapePath.startsWith(REPO) ? tapePath.slice(REPO.length + 1) : 'a survey walk view',
            on: Object.keys(over), set: SET, lockLag: lag,
            end: { level: status.level, tick: status.tick }, tape,
            rows: '[t, level, x, y, blocks, spinners, locks] — fidelityL39Shaft.packL39Sample',
            samples: samples.map(packL39Sample) })}\n`);
        console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
