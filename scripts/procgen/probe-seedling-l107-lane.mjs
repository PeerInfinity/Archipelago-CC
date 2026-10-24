#!/usr/bin/env node
/**
 * probe-seedling-l107-lane — measure-only (slice `seedling-js-l107-investigate`): **DOES L107 HAVE A ROUTE AT
 * EVERY ARRIVAL CLOCK, ASKED OF THE GAME?**
 *
 * Leg 785 (`level_107 <- in_L108_0_32 -> exit:out_teleporter_0_48`) solves at 12 of 61 arrival clocks
 * (5600..5611, fidelity MISCRES D2) and the solver refuses the rest on `beamtower@208,120`'s beam. L107's only way
 * west is the 2-tile corridor of rows 7-8 (y 112..144), and BOTH towers' LEFT beams run its whole length: tower 1's
 * band is [y1-19, y1-15], tower 2's [y1-3, y1+1] (y1 = tower 1's live y; `BeamTower.getRect`). Their bob
 * (`y += 0.3·sin(Game.worldFrame(100, 2)…)`) reads `Game.time`, so the ARRIVAL clock fixes each tower's y offset for
 * the whole visit, and a stall cannot change it. Both towers bob together, so the 12 px lane BETWEEN the bands,
 * (y1-15, y1-3), exists at every clock, and the 4x5 player box fits in it.
 *
 * THE LANE WALK (what a player watching the towers does, reading only visible tower state): row 11 west to x 176;
 * under the corridor, wait for tower 2's LEFT beam to end; up into the lane; west along it riding the bob; at x 40
 * wait (still riding the bob) for tower 1's LEFT beam to end; up the cols-2..3 shaft past band 1; west into the
 * (0,48) teleporter. `--fixed=<y>` walks the corridor at a fixed y instead: `--fixed=120.8` is the planner's
 * tile-centre row (the refusal's own danger point is (130.9,120.8)), the CONTROL arm.
 *
 * Per clock: the model plays the walk (its own simulation, drift + beam hit ON) and records the keys; the keys are
 * folded into a tape (`buildStagedTape`, the captured solve request's staging at that seam clock) and played on the
 * game (p4g, headless logic-only). Rows: the model reaches L102 with zero hits; the game reaches L102; the game's
 * stream equals the model's to the transition (a knock the model did not bill would move it). With `--fixed`, the
 * rows instead record whether each side is knocked, and require the two to AGREE.
 *
 *   --seams=a,b,..   arrival clocks (seam.time); default a sample in and out of 5600..5611
 *   --capture=<p>    the captured requests (default CC/docs/cloud-reports/seedling-js-l107-evidence/d2/cap785.jsonl.gz)
 *   --request=<i>    which captured request's staging (default 1, the held 2,560 retry)
 *   --fixed=<y>      the control arm (see above)
 *   --model-only     no browser
 *   --record=<path>  write every row (both streams' summaries) as JSON
 *   --host=<url>     the dev server (default http://localhost:${SEEDLING_PORT:-8000})
 *
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock for the browser.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
export const DEFAULT_CAPTURE = join(REPO, 'CC/docs/cloud-reports/seedling-js-l107-evidence/d2/cap785.jsonl.gz');
export const DEFAULT_SEAMS = Object.freeze([5564, 5580, 5594, 5599, 5600, 5605, 5611, 5612, 5622, 5640, 5653]);
const T1 = 'beamtower@208,120';
const T2 = 'beamtower@208,136';

/** The captured request `i`'s solve staging, its seam clock moved to `seam`. */
export async function stagingAt(seam, { capture = DEFAULT_CAPTURE, request = 1 } = {}) {
    const { restoreRequest } = await import(join(REPO, 'scripts/procgen/seedlingSolveRequestCodec.js'));
    const { atSeamTime } = await import(join(REPO, 'scripts/procgen/replay-seedling-solve-request.mjs'));
    const { levelSourceFromAtlas } = await import(join(MODULE, 'atlasSource.js'));
    const { gunzipSync } = await import('node:zlib');
    const raw = readFileSync(capture);
    const c = JSON.parse((capture.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8').trim().split('\n')[0]);
    const q = c.requests.find((r) => r.i === request);
    if (!q) throw new Error(`no request ${request} in ${capture}`);
    const req = restoreRequest(atSeamTime(q.request, seam));
    return { staging: req.staging, levelSource: levelSourceFromAtlas(req.source.records) };
}

/** The lane walk (or `fixed`'s control; `stall` extra ticks under the corridor first) on the model at `seam`: `{ok, hits, perTick, ticks, waits, to}`. */
export async function laneWalk(seam, { fixed = NaN, stall = 0, capture, request } = {}) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { staging, levelSource } = await stagingAt(seam, { capture, request });
    const run = createRunForStaging(staging, levelSource);
    const trace = () => (typeof run.beamTowerTrace === 'function' ? run.beamTowerTrace() : run.beamTowerTrace);
    const towerY = (id) => {
        const t = trace();
        for (let i = t.length - 1; i >= 0; i -= 1) if (t[i].id === id) return t[i].y;
        return id === T1 ? 136 : 152;
    };
    const sinceLeftBeam = (id) => {
        const t = trace();
        for (let i = t.length - 1; i >= 0; i -= 1) {
            if (t[i].id === id && t[i].beam && t[i].beam.x === 0) return run.ticksCompleted - t[i].t;
        }
        return null;
    };
    const laneY = () => (Number.isFinite(fixed) ? fixed : towerY(T1) - 9.5);
    const perTick = [];
    const hits = [];
    const waits = [];
    let done = null;
    const step = (keys) => {
        const held = new Set(keys);
        perTick.push(held);
        const r = run.advance(held);
        const h = run.playerHits;
        while (hits.length < h.length) {
            const e = h[hits.length];
            hits.push({ t: run.ticksCompleted, id: e.id ?? e.source ?? null,
                x: +run.state.x.toFixed(1), y: +run.state.y.toFixed(1) });
        }
        if (r.transition) done = r.transition;
    };
    const drive = (tx, ty, tol = 1, limit = 400, lane = false) => {
        for (let i = 0; i < limit && !done; i += 1) {
            const s = run.state;
            const dx = tx - s.x;
            const dy = (lane ? laneY() : ty) - s.y;
            if (Math.abs(dx) <= tol && (lane || Math.abs(dy) <= tol)) return;
            const k = [];
            if (dx < -tol) k.push('left');
            if (dx > tol) k.push('right');
            if (dy < -0.75) k.push('up');
            if (dy > 0.75) k.push('down');
            step(k);
        }
    };
    const waitFor = (id, label, lane = false) => {
        let n = 0;
        for (; n < 200 && !done; n += 1) {
            if (sinceLeftBeam(id) === 1) break;
            const k = [];
            if (lane) {
                const dy = laneY() - run.state.y;
                if (dy < -0.75) k.push('up');
                if (dy > 0.75) k.push('down');
            }
            step(k);
        }
        waits.push({ label, ticks: n, t: run.ticksCompleted });
    };
    drive(176, 184, 2);                 // x first: a diagonal steps on the landing's own teleporter pad
    drive(176, 152, 1);
    for (let i = 0; i < 4 + stall && !done; i += 1) step([]);   // `stall`: extra still ticks under the corridor
    waitFor(T2, 'band2');
    drive(176, 0, 1, 60, true);
    for (let i = 0; i < 30 && !done && Math.abs(run.state.y - laneY()) > 1; i += 1) drive(run.state.x, 0, 99, 1, true);
    drive(40, 0, 1, 400, true);
    waitFor(T1, 'band1', true);
    drive(40, 100, 1);
    drive(40, 56, 1);
    drive(-20, 56, 1, 200);
    return { seam, ok: !!done && done.to_level === 102 && hits.length === 0, to: done?.to_level ?? null,
        ticks: run.ticksCompleted, hits, waits, perTick, staging };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
    const MODEL_ONLY = process.argv.includes('--model-only');
    const seams = arg('seams') ? arg('seams').split(',').map(Number) : [...DEFAULT_SEAMS];
    const capture = arg('capture') ?? DEFAULT_CAPTURE;
    const request = Number(arg('request') ?? 1);
    const fixed = Number(arg('fixed') ?? NaN);
    const RECORD = arg('record') ?? '';
    const host = arg('host') ?? `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;
    const { parseTape, gameVisibleTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const arm = Number.isFinite(fixed) ? `fixed y ${fixed}` : 'lane';

    let failed = 0;
    const check = (name, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const rows = [];
    for (const seam of seams) {
        const w = await laneWalk(seam, { fixed, capture, request });
        const { staging, levelSource } = await stagingAt(seam, { capture, request });
        const tape = parseTape({ ...buildStagedTape({ staging, perTick: w.perTick, name: `l107-${arm}-${seam}` }),
            description: `seedling-js-l107-investigate: L107's ${arm} walk at seam.time ${seam}. `
                + 'Authored by scripts/procgen/probe-seedling-l107-lane.mjs.' });
        const replay = runTape(tape, { levelSource });
        const model = replay.ticks;
        const row = { seam, arm, walk: { ok: w.ok, to: w.to, ticks: w.ticks, hits: w.hits, waits: w.waits },
            modelRows: model.length, modelTo: (replay.transitions ?? []).at(-1)?.to_level ?? null, tape, model };
        rows.push(row);
        console.log(`seam ${seam} (${arm}): model walk ${w.ok ? 'reaches L102' : `does not (to ${w.to})`} in ${w.ticks} t, `
            + `hits ${JSON.stringify(w.hits.slice(0, 2))}, waits ${JSON.stringify(w.waits)}; tape replay ends L${row.modelTo}`);
        if (Number.isFinite(fixed)) continue;
        check(`seam ${seam}: the model's lane walk reaches L102 with zero hits`, w.ok,
            `${w.ticks} t, ${w.hits.length} hit(s)`);
        check(`seam ${seam}: the folded tape replays to the same end on the model`, row.modelTo === 102);
    }
    if (MODEL_ONLY) {
        if (RECORD) writeFileSync(RECORD, `${JSON.stringify(rows.map(({ tape, model, ...r }) => r), null, 2)}\n`);
        console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
        process.exit(failed ? 1 : 0);
    }

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
        console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
        process.exit(0);
    }
    const PAGE_URL = `${host.replace(/\/$/, '')}/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    const { chromium } = await import('playwright');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-l107-lane.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
    const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let proved = false;
    const call = (page, name, a) => page.evaluate(([n, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[n] !== 'function') return null;
        return x === undefined ? g[n]() : g[n](x);
    }, [name, a]);
    const json = async (page, name, a) => JSON.parse(await call(page, name, a));
    async function waitFor(page, what, fn, ms = 300000) {
        const t0 = Date.now();
        for (;;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(200);
        }
    }
    // ⛔ A FRESH PAGE PER TAPE (memory: wasm probe tapes share page state).
    async function play(tape) {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            const started = await call(page, 'botStart');
            if (started !== 'ok') throw new Error(`botStart: ${started}`);
            const ticks = [];
            const status = await waitFor(page, 'the latch', async () => {
                ticks.push(...(await json(page, 'botDrain')).ticks);
                const st = await json(page, 'botStatus');
                return st.finished ? st : null;
            });
            ticks.push(...(await json(page, 'botDrain')).ticks);
            return { status, ticks };
        } finally {
            await page.close();
        }
    }
    try {
        for (const row of rows) {
            const game = await play(row.tape);
            const { model } = row;
            const firstDiff = game.ticks.findIndex((o, i) => model[i]
                && (o.level !== model[i].level || o.x !== model[i].x || o.y !== model[i].y));
            const gameLevels = [...new Set(game.ticks.map((o) => o.level))];
            const gameTo = game.ticks.some((o) => o.level === 102) ? 102 : game.ticks.at(-1)?.level ?? null;
            // The walk's knock: the model's first hit tick; a game that agrees through it was knocked there too.
            row.game = { rows: game.ticks.length, to: gameTo, levels: gameLevels, firstDiff,
                gameAt: game.ticks[firstDiff] ?? null, modelAt: model[firstDiff] ?? null,
                error: game.status.error || '' };
            console.log(`seam ${row.seam} (${row.arm}): game ${game.ticks.length} rows, levels ${JSON.stringify(gameLevels)}, `
                + `first differing row ${firstDiff}${firstDiff >= 0 ? ` (game ${JSON.stringify(game.ticks[firstDiff])} `
                + `model ${JSON.stringify(model[firstDiff])})` : ''}`);
            if (Number.isFinite(fixed)) {
                const modelKnocked = row.walk.hits.length > 0;
                check(`seam ${row.seam} (${row.arm}): the game agrees with the model through the walk `
                    + `(the model is ${modelKnocked ? '' : 'NOT '}knocked by ${row.walk.hits[0]?.id ?? 'any beam'})`,
                    firstDiff < 0 && !row.game.error, `first differing row ${firstDiff}`);
                continue;
            }
            check(`seam ${row.seam}: the GAME reaches L102 on the lane walk's keys`, gameTo === 102 && !row.game.error,
                `levels ${JSON.stringify(gameLevels)}${row.game.error ? `, error ${row.game.error}` : ''}`);
            check(`seam ${row.seam}: the game's stream equals the model's (no knock the model did not bill)`,
                firstDiff < 0, `first differing row ${firstDiff}`);
        }
    } finally {
        await browser.close();
    }
    if (RECORD) writeFileSync(RECORD, `${JSON.stringify(rows.map(({ tape, model, ...r }) => r), null, 2)}\n`);
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();
