#!/usr/bin/env node
// MEASUREMENT ONLY (slice seedling-hammer-walk-l53-page). Two phases, nothing tracked is edited:
//
//   solve:  [SEEDLING_* env] node play-request.mjs solve --capture=<jsonl[.gz]> --i=K --arm=<label> --out=<json>
//           The captured request solved as the page's worker does (`solveAnytime`, the request's own passes and
//           budget), the env read back from solverBot's switch objects. A solved plan is replayed on a FRESH model
//           run (chain.mjs's `modelled`: row by row against `plan.expected`, its hits and deaths) and folded into a
//           tape the l107-lane way: `buildStagedTape` over the request's OWN staging (its seam clock and rng kept,
//           so a fresh game boots at the clock and rng the model solved against), `plan.equipsAt` as tape equips.
//
//   play:   node play-request.mjs play --in=<json>[,<json>…] [--page=seedling_bot_ap_p4g] [--host=http://localhost:8000]
//           Each tape on a FRESH game page (headless logic-only, the box lock): botLoadTape → botStart → drain to
//           the latch, `botStatus.hits` sampled on every poll (a rise is stamped with the newest drained tick).
//           The drained rows are compared with `plan.expected` (`wasmPlayback.firstDivergence`'s rule: expected[r.t];
//           both sides out of the room = agree). Rewrites each <json> with its `game` block.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = process.env.ARCHCC_ROOT ?? '/home/user/Archipelago-CC';
const MODULE = join(ROOT, 'frontend/modules/seedlingDemo');
const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const phase = process.argv[2];

async function solve() {
    const { restoreRequest } = await import(join(ROOT, 'scripts/procgen/seedlingSolveRequestCodec.js'));
    const { levelSourceFromAtlas } = await import(join(MODULE, 'atlasSource.js'));
    const JR = await import(join(MODULE, 'jsRuntimeSolver.js'));
    const SB = await import(join(MODULE, 'solverBot.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { parseTape, gameVisibleTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { tapeEquips } = await import(join(MODULE, 'wasmPlayback.js'));
    const raw = readFileSync(args.capture);
    const c = JSON.parse((args.capture.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8').trim().split('\n')[0]);
    const q = c.requests.find((r) => String(r.i) === String(args.i ?? 0));
    const req = restoreRequest(q.request);
    const { passes = JR.ANYTIME_PASSES, source, ...tape } = req;
    const env = { rewind: SB.KILLLOCK_CHASER_REWIND.enabled, lineStance: SB.KILLLOCK_LINE_STANCE?.enabled ?? null,
        clearWrite: SB.KILLLOCK_CLEAR_WRITE?.enabled ?? null, rocklockKill: SB.ROCKLOCK_KILL?.enabled ?? null };
    const t0 = Date.now();
    const answer = JR.solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
    const out = { capture: args.capture.split('/').pop(), id: c.id, key: c.key, i: q.i, arm: args.arm, env,
        budgetWork: req.budgetWork, ok: answer.ok, kind: answer.kind ?? null, work: answer.work ?? null, ms: Date.now() - t0,
        passes: (answer.passes ?? []).map(({ ms, ...r }) => r) };
    if (!answer.ok) {
        out.message = String(answer.message ?? '').slice(0, 2000);
        writeFileSync(args.out, `${JSON.stringify(out, null, 1)}\n`);
        console.log(`${args.arm}: REFUSED work=${out.work} ${out.message.slice(0, 300)}`);
        return;
    }
    const plan = answer.plan;
    out.ticks = plan.solution.length;
    out.verbs = plan.verbs ?? null;
    out.digest = createHash('md5').update(JSON.stringify(plan.solution.map((k) => [...k]))).digest('hex').slice(0, 12);
    // chain.mjs `modelled` (copied): the plan's keys on a fresh run, row by row, hits and deaths.
    const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const rowOf = (r) => ({ level: r.level, x: r.state.x, y: r.state.y, deaths: r.playerDeaths.length });
    const same = (a, b) => a.level === b.level && a.x === b.x && a.y === b.y && a.deaths === b.deaths;
    const hits0 = run.playerHits.length; const deaths0 = run.playerDeaths.length;
    let modelAt = same(rowOf(run), plan.expected[0]) ? null : -1;
    for (let k = 0; k < plan.solution.length && modelAt === null; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        const want = plan.expected[k + 1];
        if (want && !same(rowOf(run), want)) modelAt = k;
    }
    out.model = { agreesWithExpected: modelAt === null, firstDiffer: modelAt,
        hits: run.playerHits.slice(hits0).map((h) => ({ t: h.t, source: h.source, id: h.id })),
        deaths: run.playerDeaths.length - deaths0, endLevel: run.level };
    const equips = tapeEquips(plan.equipsAt);
    const built = buildStagedTape({ staging: { ...tape.staging, equips }, perTick: plan.solution.map((k) => new Set(k)),
        name: `walk-l53-page-${args.arm}` });
    out.tape = gameVisibleTape(parseTape(built));
    out.expected = plan.expected.map((r) => ({ level: r.level, x: r.x, y: r.y }));
    out.equips = equips;
    writeFileSync(args.out, `${JSON.stringify(out)}\n`);
    console.log(`${args.arm}: SOLVED ${out.ticks} t work=${out.work} digest=${out.digest} passes=${JSON.stringify(out.passes)} `
        + `model=${JSON.stringify({ ...out.model })} equips=${JSON.stringify(equips)} env=${JSON.stringify(env)}`);
}

async function play() {
    const { chromium } = await import('playwright');
    const { takeBoxLockOrExit } = await import(join(ROOT, 'scripts/procgen/boxLock.js'));
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(ROOT, 'scripts/procgen/headlessChromium.js'));
    const { assertLogicOnlyChannel } = await import(join(ROOT, 'scripts/procgen/seedlingChannel.js'));
    const PAGE = args.page ?? 'seedling_bot_ap_p4g';
    const host = (args.host ?? 'http://localhost:8000').replace(/\/$/, '');
    const URL = `${host}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    takeBoxLockOrExit({ name: 'walk-l53-page play-request.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const call = (page, n, a) => page.evaluate(([n2, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[n2] !== 'function') return null;
        return x === undefined ? g[n2]() : g[n2](x);
    }, [n, a]);
    const json = async (page, n, a) => JSON.parse(await call(page, n, a));
    async function waitFor(page, what, fn, ms = 600000) {
        const t0 = Date.now();
        for (;;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(50);
        }
    }
    let proved = false;
    try {
        for (const path of args.in.split(',')) {
            const row = JSON.parse(readFileSync(path, 'utf8'));
            if (!row.ok) { console.log(`${row.arm}: refused in the solve phase, nothing to play`); continue; }
            const page = await browser.newPage();
            try {
                await page.goto(URL, { waitUntil: 'domcontentloaded' });
                await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
                await page.click('#btn-start');
                await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));
                if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
                const loaded = await call(page, 'botLoadTape', JSON.stringify(row.tape));
                if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
                const st0 = await json(page, 'botStatus');
                const started = await call(page, 'botStart');
                if (started !== 'ok') throw new Error(`botStart: ${started}`);
                const ticks = []; const hitRises = []; let lastHits = null; const statusSamples = [];
                const status = await waitFor(page, 'the latch', async () => {
                    ticks.push(...(await json(page, 'botDrain')).ticks);
                    const st = await json(page, 'botStatus');
                    const t = ticks.at(-1)?.t ?? null;
                    if (lastHits === null || st.hits !== lastHits) {
                        statusSamples.push({ t, hits: st.hits, hits_timer: st.hits_timer, level: st.level, x: st.x, y: st.y });
                        if (lastHits !== null && st.hits > lastHits) hitRises.push({ t, hits: st.hits, x: st.x, y: st.y });
                        lastHits = st.hits;
                    }
                    return st.finished ? st : null;
                });
                ticks.push(...(await json(page, 'botDrain')).ticks);
                const roomLevel = row.tape.boot.level;
                let firstDiff = null; let compared = 0;
                // --mutant=<t>: shift expected[t].x by 0.5 px for this comparison only (the comparison must catch it).
                const expected = row.expected.map((e, k) => (args.mutant && k === Number(args.mutant) ? { ...e, x: e.x + 0.5 } : e));
                for (const r of ticks) {
                    const want = expected[r.t];
                    if (!want) continue;
                    if (want.level !== roomLevel && r.level !== roomLevel) continue;
                    compared += 1;
                    if (want.level !== r.level || want.x !== r.x || want.y !== r.y) {
                        firstDiff = { t: r.t, expected: want, got: { level: r.level, x: r.x, y: r.y },
                            dx: r.x - want.x, dy: r.y - want.y };
                        break;
                    }
                }
                const levels = [...new Set(ticks.map((o) => o.level))];
                const statusKeys = Object.keys(status);
                row.game = { page: PAGE, rows: ticks.length, lastT: ticks.at(-1)?.t ?? null, levels,
                    arrived: ticks.find((o) => o.level !== roomLevel) ?? null, firstDiff, compared, mutant: args.mutant ?? null,
                    rowsDigest: createHash('md5').update(JSON.stringify(ticks.map((o) => [o.t, o.level, o.x, o.y]))).digest('hex').slice(0, 12),
                    hitsAtLoad: st0.hits ?? null, hitsAtEnd: status.hits ?? null, hitRises, statusSamples: statusSamples.slice(0, 40),
                    error: status.error || '', statusKeys,
                    endStatus: Object.fromEntries(Object.entries(status).filter(([k, v]) => typeof v !== 'object' || v === null)) };
                if (!args.mutant) writeFileSync(path, `${JSON.stringify(row)}\n`);
                console.log(`${row.arm}${args.mutant ? ` MUTANT expected[${args.mutant}].x+0.5` : ''}: compared ${compared}, game ${ticks.length} rows (last t ${row.game.lastT}), levels ${JSON.stringify(levels)}, `
                    + `arrived ${JSON.stringify(row.game.arrived)}, hits load ${row.game.hitsAtLoad} end ${row.game.hitsAtEnd}, `
                    + `rises ${JSON.stringify(hitRises)}, firstDiff ${JSON.stringify(firstDiff)}, error '${row.game.error}'`);
            } finally {
                await page.close();
            }
        }
    } finally {
        await browser.close();
    }
}

if (phase === 'solve') await solve();
else if (phase === 'play') await play();
else { console.error('usage: play-request.mjs solve|play …'); process.exit(2); }
