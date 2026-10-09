#!/usr/bin/env node
/**
 * Seedling fidelity DASH, D1: **HOW MANY HIT TESTS DOES A SWORD PRESS BUY — ASKED OF THE GAME.**
 *
 * The CANCROSS report's D3 found the solver's L16 → L17 `all` plan (111 t, `5b1f924b52`)
 * refuted on the game: the player is hit and the streams part at t104. This probe is the
 * instrument that found why, kept so the answer can be re-asked of any tape.
 *
 * It plays one tape on a fresh page (default build p4f, headless logic-only) and reads,
 * at every tick it can sample (`botStatus` + `botMobiles`, polled while the tape runs):
 *
 *   SLASH   `botStatus.slash.tests` — `Bot.slashTests`, the game's own count of
 *           `Player.slash()` rect tests (one per tick `slashing` is up). The model's
 *           count is its `presses` ledger: one row per sword thrust, `fired` = the
 *           `ticksCompleted` it was tested at, which the game's counter shows at
 *           observation `fired + 1`. The comparison is CUMULATIVE per sampled tick,
 *           so a tick the poll missed cannot fake an agreement or a disagreement.
 *   ARROWS  every `Projectiles::Arrow` row's (x, y), against the model's
 *           `arrowFlights` at the same tick (reported, and a FAIL only with `--arrows`).
 *   STREAM  the drained stream against `runTapeToStream` (`diffObservationStreams`).
 *
 * ⛓ WHAT IT MEASURED (D1): on the 111 t plan the game's counter rises on FOUR
 * observations after each DASH press (t77: obs 79–82; t83: obs 85–88) and on five after a
 * plain one, where the model tested five for both — and the model's fifth dash test
 * (fired 88) is the one that pulled `rope@32,16`. So the model silenced
 * `arrowtrap@96/112/128,32` one volley early; the game fired at t100 and arrow
 * `(100, 52)` hit the player at t104. `combatVerbs.SLASH_ANIM_TICKS` is the fix.
 *
 * Prereqs: a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the wasm
 * build (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock.
 *
 * Run: SEEDLING_PORT=9270 node scripts/procgen/probe-seedling-dash-window.mjs \
 *        --tape=dash-l16-sword-refuted [--tape-file=<path>] [--out=<file.json>] [--arrows]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/**
 * The model's cumulative sword hit-test count at each observation: a thrust `fired` at
 * `ticksCompleted` F is tested inside the tick that produces observation F + 1.
 */
export function modelTestsByObservation(presses, observations) {
    // ⛓ seedling-fidelity-ghostsword: a ghost swing is `slash()` too — `Bot.slashTests` counts its seven tests.
    const fired = presses.filter((p) => p.weapon === 'sword' || p.weapon === 'ghostsword')
        .map((p) => p.fired).sort((a, b) => a - b);
    const out = [];
    let k = 0;
    for (let t = 0; t <= observations; t += 1) {
        while (k < fired.length && fired[k] + 1 <= t) k += 1;
        out.push(k);
    }
    return out;
}

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-dash-window.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { loadTape } = await M('fixtures/index.js');
    const { diffObservationStreams, gameStreamFromDrain, gameVisibleTape, parseTape } = await M('tapeFormat.js');
    const { createTapeStepper } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');

    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const TAPE = arg('tape');
    const FILE = arg('tape-file');
    const OUT = arg('out');
    const ARROWS = process.argv.includes('--arrows');
    if (!TAPE && !FILE) {
        console.error('probe-seedling-dash-window: --tape=<fixture name> or --tape-file=<path> is required');
        process.exit(2);
    }
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
        console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
        process.exit(0);
    }
    const tape = FILE ? parseTape(readFileSync(FILE, 'utf8')) : loadTape(TAPE);
    let failed = 0;
    const check = (name, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };

    // ── the MODEL ──
    const ticks = [];
    const arrowsAt = [];
    let run = null;
    {
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            ticks[o.t] = { t: o.t, x: o.x, y: o.y, level: o.level };
            arrowsAt[o.t] = run ? run.entities('arrowFlights').filter((a) => !a.removed)
                .map((a) => [a.x, a.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]) : [];
            r = st.next();
        }
    }
    const modelTests = modelTestsByObservation(run.ledger('presses'), tape.tick_count);
    const modelStream = { ticks: ticks.filter(Boolean), transitions: run.transitions.map((x) => ({ ...x })) };

    // ── the GAME ──
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const frames = [];
    let drain = null;
    try {
        const page = await browser.newPage();
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
            await page.waitForTimeout(250);
        }
        await assertLogicOnlyChannel(page);
        const bot = (n, a) => page.evaluate(([name, x]) => {
            const g = window.__swfBridge.game;
            return String(x === undefined ? g[name]() : g[name](x));
        }, [n, a]);
        const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if ((await bot('botStart')) !== 'ok') throw new Error('botStart refused');
        const deadline = Date.now() + 600000;
        while (Date.now() < deadline) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const s = JSON.parse(raw[1]);
            frames.push({ status: s, mobiles: JSON.parse(raw[0]) });
            if (s.finished) break;
        }
        drain = JSON.parse(await bot('botDrain'));
    } finally {
        await browser.close();
    }
    check('the tape ran to its end on the game', frames.at(-1)?.status?.finished === true);

    // ── the JOIN: the first sample of each in-tape tick ──
    const byTick = new Map();
    for (const f of frames) {
        const t = f.status.tick;
        if (Number.isInteger(t) && t >= 0 && t <= tape.tick_count && !byTick.has(t)) byTick.set(t, f);
    }
    const samples = [...byTick.entries()].sort((a, b) => a[0] - b[0]);
    const testsOff = samples.filter(([t, f]) => f.status.slash?.tests !== modelTests[t]);
    check('the game\'s `Bot.slashTests` is the model\'s cumulative sword hit-test count at every sampled tick',
        samples.length > 0 && testsOff.length === 0,
        `${samples.length} sampled tick(s) of ${tape.tick_count + 1}`
        + (testsOff.length ? `; first off at obs ${testsOff[0][0]}: game ${testsOff[0][1].status.slash?.tests}, `
            + `model ${modelTests[testsOff[0][0]]} (${testsOff.length} tick(s) off)` : ''));
    const gameArrows = (f) => (f.mobiles.mobiles ?? []).filter((r) => /Arrow$/.test(r.cls))
        .map((r) => [r.x, r.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const arrowsOff = samples.filter(([t, f]) => JSON.stringify(gameArrows(f)) !== JSON.stringify(arrowsAt[t]));
    const arrowRow = `${arrowsOff.length} of ${samples.length} sampled tick(s) differ`
        + (arrowsOff.length ? `; first at obs ${arrowsOff[0][0]}: game ${JSON.stringify(gameArrows(arrowsOff[0][1]))}, `
            + `model ${JSON.stringify(arrowsAt[arrowsOff[0][0]])}` : '');
    if (ARROWS) check('every arrow in flight is the model\'s at every sampled tick', arrowsOff.length === 0, arrowRow);
    else console.log(`ROW arrows: ${arrowRow}`);
    const game = gameStreamFromDrain(drain).stream;
    const diff = diffObservationStreams(game, modelStream);
    check('the drained stream is the model\'s, tick for tick', diff === null,
        diff ?? `${game.ticks.length} observations, transitions ${JSON.stringify(game.transitions)}`);
    const last = frames.at(-1)?.status ?? {};
    console.log(`ROW game: hits ${last.hits}, hits_timer ${last.hits_timer}, level ${last.level}, `
        + `slash ${JSON.stringify(last.slash)}, cleared ${JSON.stringify(last.persistence_cleared)}`);
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ tape: TAPE ?? FILE, page: PAGE_NAME, modelTests,
            samples: samples.map(([t, f]) => ({ t, tests: f.status.slash?.tests, hits: f.status.hits,
                arrows: gameArrows(f) })), drain }, null, 1)}\n`);
        console.log(`wrote ${OUT}`);
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}
