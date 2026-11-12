#!/usr/bin/env node
// rules-route-goals-witness: one sweep leg, solved in node and/or played ON THE GAME (headless p4g), with its persistence
// staging overridden. Generalises the BK2 witness's `witness.mjs` + `solve-control.mjs` to any leg the sweep captured.
//
//   node legwitness.mjs --req=<capture.jsonl> --leg=<id> [--persist=none|<L>:<t>,...] [--cap=N] --solve=<plan.json>
//        the leg's first captured request (`--capture-requests`), staging persistence replaced, solved dashless at
//        main's defaults (the budget lifted to --cap work units; 0 = none). Writes the plan.
//   node legwitness.mjs --req=… --leg=… [--persist=…] --plan=<plan.json> --play=<out.json>
//        plays the plan's keys on the game (delivered AP set) from the same staging; prints one ROW with the end,
//        hits and EVERY persistence flag the game cleared (so an in-visit press is named, not counted).
//   --boot=x,y  re-stage the boot at another real door arrival of the boot level (from the leg list), nothing else.
//   --save-tape=<tape.json> write the staged tape played (the evidence copy).
//   --tape=<tape.json> instead of --plan: play a tape built elsewhere (the hand-planned arms).
// Staging is the captured request's own (boot, inventory, save, seam) with ONLY `persistence` changed. Nothing else:
// no removed body, no game value, no flag the run does not earn.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.env.REPO || process.cwd();
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');

export function loadLeg(file, id) {
    for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
        const o = JSON.parse(line);
        if (String(o.id) === String(id)) return restoreRequest(o.requests[0].request);
    }
    throw new Error(`leg ${id} not in ${file}`);
}
export function persistOf(spec, fallback) {
    if (spec == null) return fallback;
    if (spec === 'none') return [];
    return spec.split(',').map((s) => { const [level, tag] = s.split(':').map(Number); return { level, tag }; });
}

const req = loadLeg(arg('req'), arg('leg'));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = req;
tape.staging = { ...tape.staging, persistence: persistOf(arg('persist'), tape.staging.persistence) };
// The game page here is FRESH (no AP grants in acquisition order), so its slot array is the one `addItemsFromSave` builds
// from the held items (`tapeFormat.inventorySlotsFor`), not the sweep page's AP-order array: stage THAT, or an equip
// index means a different item on the game than on the model (measured: slot 2 = Spear on the sweep page, Wand here).
{ const { inventorySlotsFor } = await M('tapeFormat.js'); tape.staging = { ...tape.staging, inventory_slots: inventorySlotsFor(tape.staging.seam?.items ?? {}) }; }
// --boot=x,y: another REAL door arrival of the same level (a sweep leg's resolved arrival), same inventory/goal.
if (arg('boot')) { const [x, y] = arg('boot').split(',').map(Number); tape.staging = { ...tape.staging, boot: { ...tape.staging.boot, x, y } }; }
const levelSource = levelSourceFromAtlas(source.records);
console.log('STAGING', JSON.stringify({ boot: tape.staging.boot, persistence: tape.staging.persistence, goal: tape.solverGoal ?? null }));

if (arg('solve')) {
    const { settleSolve, solveFromTape, replayTape, liveOf } = await M('jsRuntimeSolver.js');
    // the re-staged slots (and any re-staged boot) have no live row from the page: the live run IS the staging's own replay.
    tape.live = liveOf(replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence, equips: tape.equips }));
    const cap = Number(arg('cap') ?? 60000);
    let work = 0;
    const t0 = Date.now();
    const answer = settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: arg('dash') ?? 'none', adds: null, fineCheckpoints: true,
        shouldStop: () => { work += 1; return cap > 0 && work > cap; } }));
    console.log('SOLVE', JSON.stringify({ ok: answer.ok, work, ms: Date.now() - t0, ticks: answer.plan?.solution?.length ?? null,
        message: answer.ok ? null : String(answer.message).slice(0, 900) }));
    if (answer.ok) writeFileSync(arg('solve'), JSON.stringify({ staging: tape.staging, keys: answer.plan.solution.map((k) => [...k]),
        equipsAt: [...(answer.plan.equipsAt ?? [])], expectedLast: answer.plan.expected.at(-1) }));
}

if (arg('model')) {
    // replay a plan on the MODEL (scratch persistence): its end, hits and the flags it clears, before the game sees it.
    const { createRunForStaging } = await M('tapeRunner.js');
    const plan = JSON.parse(readFileSync(arg('model'), 'utf8'));
    const run = createRunForStaging({ ...tape.staging }, levelSource, { scratchPersistence: true });
    const eq = new Map(plan.equipsAt);
    plan.keys.forEach((k, i) => { if (eq.has(i)) run.equipNow(eq.get(i)); run.advance(new Set(k)); });
    console.log('MODEL', JSON.stringify({ ticks: plan.keys.length, end: { level: run.level, x: run.state.x, y: run.state.y }, hits: run.playerHits.length,
        earned: (run.earnedClears ?? []).map((c) => `${c.level}:${c.tag}@t${c.t}(${c.by})`) }));
}

if (arg('play')) {
    const { buildStagedTape } = await M('botDriverV1.js');
    const { parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { tapeEquips } = await M('wasmPlayback.js');
    let gtape;
    if (arg('tape')) gtape = parseTape(readFileSync(arg('tape'), 'utf8'));
    else {
        const plan = JSON.parse(readFileSync(arg('plan'), 'utf8'));
        const built = buildStagedTape({ staging: { ...tape.staging, equips: tapeEquips(plan.equipsAt) }, perTick: plan.keys.map((k) => new Set(k)), name: `leg${arg('leg')}` });
        if (arg('save-tape')) writeFileSync(arg('save-tape'), JSON.stringify(built));
        gtape = parseTape(JSON.stringify(built));   // the parser normalises the rng block (fp 0 = inherit the page's)
    }
    const { chromium } = await import('playwright');
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
    const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
    const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const { l25Sets } = await M('fidelityL25ApItem.js');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;
    takeBoxLockOrExit({ name: 'rules-route-goals-witness', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const call = (page, n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
    const until = async (page, fn, ms) => { for (const t0 = Date.now(); ;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout'); await page.waitForTimeout(100); } };
    const page = await browser.newPage();
    try {
        await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
        await until(page, () => page.evaluate(() => !!window.__runtimeReady), 180000);
        await page.click('#btn-start');
        await until(page, () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
        await assertLogicOnlyChannel(page);
        const answers = [];
        for (const c of planLevelSetChunks(l25Sets(R).delivered).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
        if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
        const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(gtape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
        const samples = [];
        let lastT = -1;
        let status;
        for (const t0 = Date.now(); Date.now() - t0 < 20 * 60 * 1000;) {
            status = JSON.parse(String(await call(page, 'botStatus')));
            if (status.error) throw new Error(status.error);
            if (Number.isInteger(status.tick) && status.tick >= lastT + 10) { lastT = status.tick; samples.push([status.tick, status.level, status.x, status.y, status.hits]); }
            if (status.finished) break;
            await page.waitForTimeout(20);
        }
        const staged = new Set(tape.staging.persistence.map((c) => `${c.level}:${c.tag}`));
        const clears = [...new Set((status.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`))].sort();
        const row = { leg: Number(arg('leg')), persist: tape.staging.persistence.map((c) => `${c.level}:${c.tag}`), finished: !!status.finished,
            ticks: gtape.tick_count, end: { level: status.level, x: status.x, y: status.y }, hits: status.hits ?? null,
            clears, earned: clears.filter((c) => !staged.has(c)) };
        console.log('ROW', JSON.stringify(row));
        writeFileSync(arg('play'), JSON.stringify({ row, samples }));
    } finally { await page.close(); await browser.close(); }
}
