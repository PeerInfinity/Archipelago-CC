#!/usr/bin/env node
/**
 * probe-seedling-shake-exact — ⛓ seedling-fidelity-shakeexact D2: THE SHAKING CAMERA, ASKED OF THE GAME TICK BY TICK.
 *
 * ⚖ The user (2026-10-25, "Exact for split"): under `Rng.split` `view()` jiggles by
 * `shake * Game.shakeJiggle(Game.time, axis) - shake/2` (`Game.as:2004-2011`), no draw — so the model computes a split
 * run's camera exactly (`CONTACT_FIDELITY.shakeExactSplit`, `levelRun.stepCameraNow`), and keeps the band where it
 * cannot know it (`camera.SHAKE_BAND_KEPT`).
 *
 * Plays a tape on the recompiled game (p4g by default, headless) and polls `botStatus()` once per sampled tick: the
 * player, `hits`, `game_time` and `camera` ({x, y, shake} as `view()` left it). Then replays the same tape through the
 * model (`tapeRunner`, the process's switches with `shakeExactSplit` forced ON unless `--off`) and joins the two on
 * the tick:
 *   - the CLOCK: the model's `gameTime` after tick t is the game's `game_time` after frame t;
 *   - the CAMERA: on every sampled tick the model holds a point, it is the game's camera (0 px); where it holds a band,
 *     the game's camera lies inside it — and on a split run with a counting clock no shaking frame is banded unless a
 *     `SHAKE_BAND_KEPT` case opened it;
 *   - the player's position and `hits` (a camera compared on a diverged walk measures nothing).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-shake-exact.mjs --file=<tape.json>
 *   … --tape=<fixture name>     a committed tape instead of --file
 *   … --witness=<fixture.json>  the `tape` member of a committed witness (e.g. a bomb-witness), instead of --file
 *   … --split                   re-declare the tape's `rng.split` true (a split:false witness's walk, run split)
 *   … --upto=<tick>             compare only samples at or before this tick
 *   … --off                     replay the model with `shakeExactSplit` OFF (the control: the band)
 *   … --reuse=<out.json>        no browser: re-join the model against the game rows a previous `--out` wrote
 *   … --out=<file.json>         write every game row and the join
 *   … --record --name=<n>       with --upto: write the tape and the GAME's rows through that tick to
 *                               `fixtures/shake-witness/<n>.json` — only on a PASS; `fidelityShakeExact.test.js`
 *                               replays it
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const flag = (k) => process.argv.includes(`--${k}`);
    const sources = ['tape', 'file', 'witness'].filter((k) => arg(k) !== null);
    if (sources.length !== 1) {
        console.error('probe-seedling-shake-exact: exactly one of --tape=<fixture> / --file=<path> / --witness=<path>');
        process.exit(2);
    }
    const UPTO = arg('upto') === null ? Infinity : Number(arg('upto'));
    const RECORD = flag('record');
    const NAME = arg('name');
    if (RECORD && (!NAME || !Number.isFinite(UPTO))) {
        console.error('probe-seedling-shake-exact: --record needs --name=<witness name> and --upto=<tick>');
        process.exit(2);
    }
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    let tape;
    if (arg('tape')) tape = loadTape(arg('tape'));
    else if (arg('file')) tape = parseTape(readFileSync(arg('file'), 'utf8'));
    else tape = parseTape(JSON.stringify(JSON.parse(readFileSync(arg('witness'), 'utf8')).tape));
    if (flag('split')) tape = parseTape(JSON.stringify(redeclareSplit(JSON.parse(JSON.stringify(tape)))));
    const source = arg('tape') ?? arg('file') ?? arg('witness');
    const REUSE = arg('reuse');
    const game = REUSE ? JSON.parse(readFileSync(REUSE, 'utf8')).game : await playOnGame(tape, PAGE_URL);
    if (!game) process.exit(1);
    const join_ = await modelJoin(tape, game, { UPTO, on: !flag('off') });
    const pass = report(join_, tape, game, UPTO);
    const OUT = arg('out');
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ source, page: PAGE_NAME, split: tape.rng?.split === true, game,
            rows: join_.rows, summary: join_.summary }, null, 1)}\n`);
        console.log(`wrote ${OUT}`);
    }
    if (RECORD) {
        if (!pass) {
            console.log('NOT RECORDED: the run did not pass — a witness the model disagrees with is not a fixture');
            process.exit(1);
        }
        const dir = join(MODULE, 'fixtures', 'shake-witness');
        mkdirSync(dir, { recursive: true });
        // One sample per tick: the poll the join used (its clock is the model's), else the last at that tick.
        const used = new Map(join_.rows.map((r) => [r.t, r.gameTime]));
        const byTick = new Map();
        for (const g of game) {
            if (g.t < 1 || g.t > UPTO) continue;
            if (!byTick.has(g.t) || g.gameTime === used.get(g.t) || byTick.get(g.t).gameTime !== used.get(g.t)) {
                byTick.set(g.t, g);
            }
        }
        const keep = [...byTick.values()];
        const out = {
            name: NAME, source, page: PAGE_NAME, upto: UPTO, split: tape.rng?.split === true,
            recordedBy: `scripts/procgen/probe-seedling-shake-exact.mjs --record${flag('split') ? ' --split' : ''}`,
            note: 'the GAME\'s player, hits, game_time and camera {x, y, shake} at each sampled tick 1..upto '
                + '(`botStatus()`); t0 is polled before the boot world exists',
            tape,
            samples: keep.map((g) => ({ t: g.t, level: g.level, p: [g.x, g.y], hits: g.hits, time: g.gameTime,
                cam: g.camera })),
        };
        const path = join(dir, `${NAME}.json`);
        writeFileSync(path, `${JSON.stringify(out)}\n`);
        console.log(`RECORDED ${path} (${out.samples.length} samples)`);
    }
    // The battery's verdict contract (seedling-probe.yml's summary reads this line).
    console.log(pass ? '\nALL CHECKS PASSED' : '\n1 CHECK(S) FAILED');
    process.exit(pass ? 0 : 1);
}

/** Every `rng` block the parsed tape carries, split. */
export function redeclareSplit(raw) {
    if (raw.rng) raw.rng = { ...raw.rng, split: true };
    for (const t of raw.ticks ?? []) if (t.rng) t.rng = { ...t.rng, split: true };
    return raw;
}

/** The game's rows, one sample per tick. ⛔ Takes the box (a browser instrument). */
async function playOnGame(tape, PAGE_URL) {
    const { gameVisibleTape } = await import(join(MODULE, 'tapeFormat.js'));
    takeBoxLockOrExit({ name: 'probe-seedling-shake-exact.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const frames = [];
    let finished = false;
    try {
        const page = await browser.newPage();
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) {
            await page.waitForTimeout(250);
        }
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
        const started = await bot('botStart');
        if (started !== 'ok') throw new Error(`botStart: ${started}`);
        const deadline = Date.now() + 900000;
        while (Date.now() < deadline) {
            const s = JSON.parse(await page.evaluate(() => String(window.__swfBridge.game.botStatus())));
            frames.push({ t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits, gameTime: s.game_time,
                camera: s.camera ?? null, finished: s.finished });
            if (s.finished) { finished = true; break; }
        }
    } finally {
        await browser.close();
    }
    if (!finished) {
        console.log('FAIL: the tape never finished inside the deadline');
        return null;
    }
    // ⚠ EVERY DISTINCT (tick, game_time) POLL, not the first per tick: inside a dead span (a freeze, a fade) the bot's
    // tick stands still while frames run, so the first poll at a tick can be mid-span (measured: u14-moonrock-beam t2,
    // 451 frames behind the model's state after the tick). The join picks the poll whose clock is the model's.
    const seen = new Set();
    const out = [];
    for (const f of frames) {
        if (!Number.isInteger(f.t) || f.t > tape.tick_count) continue;
        const k = `${f.t}:${f.gameTime}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(f);
    }
    return out;
}

/**
 * The model's camera after each tick, joined to the game's. Exported for the committed witness test, which replays a
 * recorded `samples` stream through the same join.
 */
export async function modelJoin(tape, game, { UPTO = Infinity, on = true } = {}) {
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const byT = new Map();
    for (const g of game) {
        if (!byT.has(g.t)) byT.set(g.t, []);
        byT.get(g.t).push(g);
    }
    // The poll at tick t whose `game_time` is the model's clock (a counting clock), else the LAST poll at t.
    const pick = (t, clock) => {
        const at = byT.get(t);
        if (!at) return null;
        return (clock === null ? null : at.find((g) => g.gameTime === clock)) ?? at.at(-1);
    };
    const rows = [];
    let threw = null;
    let lastTick = 0;
    let counts = null;
    withContactFidelity({ shakeExactSplit: on }, () => {
        let run = null;
        // ⛔ NO `cameraWitness`: this join asks the MODEL's camera, so a band stays a band here.
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        try {
            for (let r = st.next(); !r.done; r = st.next()) {
                const t = run.ticksCompleted;
                lastTick = t;
                if (t > UPTO) break;
                const g = pick(t, run.gameTime);
                const c = run.cameraNow;
                if (!g || t < 1 || !g.camera) continue;
                const o = r.value.observation;
                rows.push({
                    t, level: run.level, gameLevel: g.level,
                    clock: run.gameTime, gameTime: g.gameTime,
                    p: [o.x, o.y], gp: [g.x, g.y], hits: o.hits ?? null, ghits: g.hits,
                    shake: run.shake, gshake: g.camera.shake,
                    cam: c.cam, band: c.band, gcam: { x: g.camera.x, y: g.camera.y },
                });
            }
        } catch (e) {
            threw = e.message.slice(0, 600);
        }
        counts = run?.shakeExactCounts ?? null;
    });
    // A tick whose camera the game JIGGLED: the shake `view()` read was > 0, i.e. the previous sample's live shake.
    const prevShake = new Map();
    for (const g of game) prevShake.set(g.t + 1, g.camera?.shake ?? 0);
    let exactEq = 0; let exactNe = 0; let bandIn = 0; let bandOut = 0; let shakingFrames = 0; let shakingExact = 0;
    let clockNe = 0; let walkNe = 0;
    const firstNe = [];
    for (const r of rows) {
        const jiggled = (prevShake.get(r.t) ?? 0) > 0;
        if (jiggled) shakingFrames += 1;
        if (r.clock !== null && r.clock !== r.gameTime) clockNe += 1;
        if (r.p[0] !== r.gp[0] || r.p[1] !== r.gp[1] || r.level !== r.gameLevel) walkNe += 1;
        if (r.cam) {
            if (r.cam.x === r.gcam.x && r.cam.y === r.gcam.y) {
                exactEq += 1;
                if (jiggled) shakingExact += 1;
            } else {
                exactNe += 1;
                if (firstNe.length < 8) firstNe.push(r);
            }
        } else if (r.band) {
            const inside = r.gcam.x >= r.band.x.lo && r.gcam.x <= r.band.x.hi
                && r.gcam.y >= r.band.y.lo && r.gcam.y <= r.band.y.hi;
            if (inside) bandIn += 1;
            else { bandOut += 1; if (firstNe.length < 8) firstNe.push(r); }
        }
    }
    return { rows, threw, lastTick, counts,
        summary: { samples: rows.length, shakingFrames, shakingExact, exactEq, exactNe, bandIn, bandOut, clockNe,
            walkNe, firstNe, counts, threw } };
}

function report({ summary: s, threw, lastTick }, tape, game, UPTO) {
    const ticks = [...new Set(game.map((g) => g.t))];
    const missing = [];
    for (let i = 1; i < ticks.length; i += 1) if (ticks[i] - ticks[i - 1] > 1) missing.push(`${ticks[i - 1] + 1}..${ticks[i] - 1}`);
    console.log(`game: ${ticks.length} sampled tick(s) of ${tape.tick_count + 1}; split=${tape.rng?.split === true}; `
        + `unsampled spans: ${missing.length ? missing.slice(0, 10).join(' ') : 'none'}`);
    console.log(`model: ${JSON.stringify(s.counts)}${threw ? ` THREW after t${lastTick}: ${threw}` : ''}`);
    console.log(`join: ${s.samples} sample(s); shaking frames ${s.shakingFrames} (exact and equal ${s.shakingExact}); `
        + `point ${s.exactEq} equal / ${s.exactNe} unequal; band ${s.bandIn} inside / ${s.bandOut} outside; `
        + `clock unequal ${s.clockNe}; walk unequal ${s.walkNe}`);
    for (const r of s.firstNe) console.log(`  ✗ t${r.t} model ${JSON.stringify(r.cam ?? r.band)} game ${JSON.stringify(r.gcam)} shake ${r.shake}/${r.gshake} clock ${r.clock}/${r.gameTime}`);
    const reached = !threw || lastTick >= Math.min(UPTO, tape.tick_count);
    const pass = reached && s.exactNe === 0 && s.bandOut === 0 && s.clockNe === 0 && s.walkNe === 0;
    console.log(`${pass ? 'PASS' : 'FAIL'}: every sampled camera is the game's (point at 0 px, or band containing it), `
        + `the clock and the walk agree${Number.isFinite(UPTO) ? ` <= t${UPTO}` : ''}`);
    return pass;
}
