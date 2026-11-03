// scratch (SHIELDBUMP D1, the GAME witness): play the committed tape `l40button-l42-part0` on the default wasm build
// (headless, the page at SEEDLING_PORT), sample the game's Spinner rows per tick (the LAST poll before the tick advanced,
// SMALLGAPS' join), and compare at --from..--to: the GAME, the RUN (the model's replay), and the forecasts taken at
// --from on a second replay — spinnerForecastWithPress and the fight cursor, each told the run's own top-of-tick states
// — with forecastShieldBump OFF and ON. Positions are entity points (rect + SPINNER origin). Takes the box lock.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const R = args.root ?? '/tmp/claude-0/sbwt/';
const MAIN = '/home/user/Archipelago-CC/';
const D = R + 'frontend/modules/seedlingDemo/';
const TAPE = args.tape ?? 'l40button-l42-part0';
const FROM = Number(args.from ?? 1300);
const TO = Number(args.to ?? 1360);
const BODY = args.body ?? 'spinner@192,160';
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(MAIN + 'scripts/procgen/headlessChromium.js');
const { takeBoxLockOrExit } = await import(MAIN + 'scripts/procgen/boxLock.js');
const { assertLogicOnlyChannel } = await import(MAIN + 'scripts/procgen/seedlingChannel.js');
const { loadTape } = await import(D + 'fixtures/index.js');
const { gameVisibleTape } = await import(D + 'tapeFormat.js');
const { createTapeStepper } = await import(D + 'tapeRunner.js');
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { withContactFidelity } = await import(D + 'contactFidelity.js');
const { SPINNER } = await import(D + 'spinner.js');
const tape = loadTape(TAPE);

let game = null;
if (args.game !== '0') {
    takeBoxLockOrExit({ name: `shieldbump l42 witness ${TAPE}`, kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const frames = [];
    try {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/${process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g'}/game.html`, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
        await assertLogicOnlyChannel(page);
        const bot = (n, a) => page.evaluate(([name, x]) => {
            const g = window.__swfBridge.game;
            return String(x === undefined ? g[name]() : g[name](x));
        }, [n, a]);
        if ((await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)))) !== 'ok') throw new Error('botLoadTape');
        if ((await bot('botStart')) !== 'ok') throw new Error('botStart');
        const deadline = Date.now() + 900000;
        while (Date.now() < deadline) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const m = JSON.parse(raw[0]);
            const s = JSON.parse(raw[1]);
            const t = m.tick ?? s.tick;
            if (Number.isInteger(t) && t >= FROM - 2 && t <= TO + 2) {
                frames.push({ t, rows: (m.mobiles ?? []).filter((r) => /(^|[.:])(Spinner|Player)$/.test(r.cls)) });
            }
            if (s.finished) break;
        }
    } finally {
        await browser.close();
    }
    game = new Map();
    for (const f of frames) game.set(f.t, f.rows); // the LAST poll at each tick wins
}

// the RUN: top-of-tick states and the spinner points after each tick (index t = after the advance of tick t-1, as the
// stepper's observation t)
const states = new Map();
const after = new Map();
let bumps = [];
let presses = new Map();
{
    let run = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next();
    while (!r.done) {
        const t = r.value.observation.t;
        if (run && t >= FROM - 1 && t <= TO + 1) {
            states.set(run.ticksCompleted, { ...run.state });
            if (args.debug && run.ticksCompleted >= 1329 && run.ticksCompleted <= 1336) { const sb = run.entities('spinnerBodies').find((b) => b.id === BODY); console.log('RUN after', run.ticksCompleted - 1, JSON.stringify(sb)); }
            after.set(run.ticksCompleted, (run.entities('spinnerBodies') ?? []).map((b) => ({ id: b.id,
                x: b.rect.x + SPINNER.originX, y: b.rect.y + SPINNER.originY })));
        }
        r = st.next();
    }
    if (args.debug) console.log('RUN pressHits', JSON.stringify(run.ledger('spinnerPressHits').filter((h) => h.t >= 1328 && h.t <= 1336)));
    bumps = run.shieldBumps.filter((b) => b.family === 'spinner' && b.t >= FROM && b.t <= TO + 1);
    presses = new Map((run.slashPresses ?? []).filter((p) => p.t >= FROM && p.t < TO)
        .map((p) => [p.t, { direction: p.direction }]));
}
// the FORECASTS at FROM, told the run's own states
const forecasts = {};
for (const on of [false, true]) {
    let run = null;
    let asked = false;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next();
    while (!r.done && !asked) {
        if (run && run.ticksCompleted === FROM) {
            asked = true;
            withContactFidelity({ forecastShieldBump: on }, () => {
                const n = run.ticksCompleted;
                const at = (t) => states.get(t) ?? null;
                const need = TO - n;
                const f = run.spinnerForecastWithPress(need, { pressAt: n + need, direction: run.state.direction,
                    positions: at, players: at });
                const F = run.spinnerFightForecast();
                for (let i = 0; i < need; i += 1) F.advance(states.get(n + i), presses.get(n + i) ?? null);
                if (on && args.debug) {
                    console.log('CURSOR bumps', JSON.stringify(F.shieldBumps));
                    console.log('CURSOR tests', JSON.stringify(F.tests.filter((x) => x.t >= 1328 && x.t <= 1336)));
                    for (let j = 1328 - n; j <= 1335 - n; j += 1) {
                        const b = F.snap(j).st.get(BODY);
                        console.log('CURSOR snap', n + j, JSON.stringify({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, hits: b.hits, ht: b.hitsTimer }));
                    }
                }
                const ids = (run.entities('spinnerBodies') ?? []).map((b) => b.id);
                const pts = (rows) => rows.map((row) => row.map((rect, k) => ({ id: ids[k], x: rect.x + SPINNER.originX,
                    y: rect.y + SPINNER.originY })));
                forecasts[on ? 'ON' : 'OFF'] = { n, press: pts(f.rows), cursor: pts(F.rows), unmodelled: f.unmodelled,
                    cursorUnmodelled: F.unmodelled, bumps: f.shieldBump?.bumps ?? null };
            });
        }
        r = st.next();
    }
}
// the TABLE: per tick T (the body after tick T's advance; the game's sample at observation T+1)
const pick = (list, id) => list?.find((b) => b.id === id) ?? null;
const out = [];
let worst = { runGame: 0, OFFpress: 0, ONpress: 0, OFFcursor: 0, ONcursor: 0 };
for (let T = FROM; T < TO; T += 1) {
    const i = T - FROM;
    const run = pick(after.get(T + 1), BODY);
    const g = game?.get(T + 1)?.filter((r) => /Spinner$/.test(r.cls)) ?? null;
    // the game's row nearest the run's body (botMobiles carries no census id)
    const gb = g && run ? g.reduce((a, b) => (Math.hypot(b.x - run.x, b.y - run.y) < Math.hypot(a.x - run.x, a.y - run.y) ? b : a)) : null;
    const d = (a, b) => (a && b ? +Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)).toFixed(4) : null);
    const row = { T, run: run && [+run.x.toFixed(3), +run.y.toFixed(3)], game: gb && [+gb.x.toFixed(3), +gb.y.toFixed(3)],
        runGame: d(run, gb) };
    for (const arm of ['OFF', 'ON']) {
        row[`${arm}press`] = d(pick(forecasts[arm].press[i], BODY), run);
        row[`${arm}cursor`] = d(pick(forecasts[arm].cursor[i], BODY), run);
    }
    for (const k of Object.keys(worst)) if (row[k] !== null) worst[k] = Math.max(worst[k], row[k]);
    out.push(row);
}
console.log('PRESSES', JSON.stringify([...presses.keys()]));
console.log('BUMPS (run)', JSON.stringify(bumps.map((b) => ({ t: b.t, id: b.id, shoved: b.shoved }))));
console.log('FORECAST bumps ON', JSON.stringify(forecasts.ON.bumps?.map((b) => b.t)), 'unmodelled OFF/ON',
    forecasts.OFF.unmodelled.length, forecasts.ON.unmodelled.length, 'cursor', forecasts.OFF.cursorUnmodelled.length,
    forecasts.ON.cursorUnmodelled.length);
for (const r of out) if (args.all || Object.values(r).some((v) => typeof v === 'number' && v > 0 && v !== r.T)) console.log(JSON.stringify(r));
console.log('WORST', JSON.stringify(worst), 'game samples', game ? game.size : 'skipped');
if (args.record) {
    const samples = [];
    for (const [t, rows] of [...(game ?? new Map())].sort((a, b) => a[0] - b[0])) {
        const pl = rows.find((r) => /Player$/.test(r.cls));
        const sp = rows.filter((r) => /Spinner$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y, vx: r.vx, vy: r.vy }));
        samples.push({ t, player: pl ? { x: pl.x, y: pl.y } : null, spinners: sp });
    }
    writeFileSync(args.record, JSON.stringify({ tape: TAPE, build: process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g',
        from: FROM, to: TO, body: BODY,
        note: 'botMobiles() Spinner and Player rows, the LAST poll at each Bot tick (SMALLGAPS join): t = the Bot observation, i.e. the state after the advance of tick t-1',
        samples }, null, 1) + '\n');
}
if (args.out) writeFileSync(args.out, JSON.stringify({ tape: TAPE, from: FROM, to: TO, body: BODY, bumps, rows: out, worst }, null, 1));
