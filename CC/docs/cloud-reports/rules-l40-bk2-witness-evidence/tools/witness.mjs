#!/usr/bin/env node
// rules-l40-bk2-witness: L40 Boss Key 2 from the L39 arrival, door shut vs door open, ON THE GAME (p4g, headless).
//
//   node witness.mjs --build=<dir>          the model builds the hand-planned door-shut tapes (closed-loop controller
//                                           on the model's own run) + the control tape (the solver's plan WITH {40,12}),
//                                           writes <dir>/<arm>.tape.json and the model's rows.
//   node witness.mjs --play=<dir> [--arm=]  plays each tape on the game (delivered AP set), samples the player and both
//                                           pushables every 10 ticks, and prints one ROW per arm.
// Staging: the committed sweep-leg-873 request (L39 → L40 (488,904), BK2's sphere-6.8 inventory: Sword, Shield, Fire,
// Torch, keys [0,1], seals 0-6), with `persistence` = [] (door shut) or the request's own [{40,12}] (control).
// Nothing else is staged: no flag the step did not earn, no removed body, no game value.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;

const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { createRunForStaging } = await M('tapeRunner.js');
const { buildStagedTape } = await M('botDriverV1.js');
const { parseTape, gameVisibleTape } = await M('tapeFormat.js');
const { tapeEquips } = await M('wasmPlayback.js');

const fx = JSON.parse(gunzipSync(readFileSync(join(R, 'frontend/modules/seedlingDemo/fixtures/hammer-bk2-approach-order/leg873-l39-l40-bk2-request.json.gz'))));
const REQ = restoreRequest(fx.requests[0].request);
const SOURCE = levelSourceFromAtlas(REQ.source.records);
const SHUT = { ...REQ.staging, persistence: [] };
const OPEN = REQ.staging;
const BK2 = { level: 40, tag: 14 };           // apitem@656,528 {tag 14, look bosskey2}
const FLAG12 = { level: 40, tag: 12 };        // buttonroom@880,768 {tset 3, tag 12} → wandlock@480,560 {tset 3}

/** A closed-loop author on the model: each step reads the run and emits that tick's keys. */
function author(staging, script) {
    const run = createRunForStaging(staging, SOURCE, { scratchPersistence: true });
    const keys = [];
    const equips = [];
    const tick = (k) => { keys.push([...k]); run.advance(new Set(k)); };
    const api = {
        run, keys,
        get x() { return run.state.x; }, get y() { return run.state.y; },
        hold(k, n) { for (let i = 0; i < n; i++) tick(k); },
        /** walk along one axis to `target` (stop within 0.75 px), max `n` ticks. */
        go(axis, target, n = 2000) {
            for (let i = 0; i < n; i++) {
                const v = axis === 'x' ? run.state.x : run.state.y;
                if (Math.abs(v - target) <= 0.75) { tick([]); return true; }
                tick([axis === 'x' ? (v < target ? 'right' : 'left') : (v < target ? 'down' : 'up')]);
            }
            return false;
        },
        equip(slot) { equips.push([keys.length, slot]); run.equipNow(slot); },
        press(k = 'primary', gap = 40) { tick([k]); api.hold([], gap); },
    };
    script(api);
    return { keys, equips, run };
}

function pushRow(run) {
    const out = {};
    for (const [id, b] of run.entities('pushables')) out[id] = { x: b.rect.x, y: b.rect.y, removed: b.removed ?? false };
    return out;
}

/** The door-shut arms: walk up the arrival corridor, east along row 42, north up column 36 to the fire block. */
const toCorridor = (a) => { a.go('y', 680); a.go('x', 584); a.go('y', 600); };
const ARMS = {
    // A1: Fire from directly below, centred, at its nearest stance; then pressing up into it.
    'A1-fire-below-centre': (a) => { toCorridor(a); a.equip(1); a.hold(['up'], 30); for (let i = 0; i < 6; i++) a.press('primary', 45); a.hold(['up'], 60); },
    // A2/A3: the same at the corridor's west / east edge (the widest horizontal angle a stance in column 36 can make).
    'A2-fire-below-west-edge': (a) => { toCorridor(a); a.go('x', 578.2); a.equip(1); a.hold(['up'], 30); for (let i = 0; i < 6; i++) a.press('primary', 45); },
    'A3-fire-below-east-edge': (a) => { toCorridor(a); a.go('x', 589.8); a.equip(1); a.hold(['up'], 30); for (let i = 0; i < 6; i++) a.press('primary', 45); },
    // A4: the door itself: walk up column 30 from row 42 into wandlock@480,560, then Fire and Sword at it.
    'A4-door-shut': (a) => { a.go('y', 680); a.hold(['up'], 120); a.equip(1); a.press('primary', 45); a.equip(0); a.press('primary', 45); a.hold(['up'], 30); },
};

if (arg('build')) {
    const dir = arg('build'); mkdirSync(dir, { recursive: true });
    const rows = {};
    for (const [name, script] of Object.entries(ARMS)) {
        const { keys, equips, run } = author(SHUT, script);
        const tape = buildStagedTape({ staging: { ...SHUT, equips: tapeEquips(equips) }, perTick: keys.map((k) => new Set(k)), name: `l40-bk2-${name}` });
        writeFileSync(join(dir, `${name}.tape.json`), JSON.stringify(tape));
        rows[name] = { ticks: keys.length, end: { x: run.state.x, y: run.state.y, level: run.level }, hits: run.playerHits.length,
            pushables: pushRow(run), clears: [...(run.scratchClears ?? [])].map((c) => typeof c === 'string' ? c : `${c.level}:${c.tag}`) };
        console.log('MODEL', name, JSON.stringify(rows[name]));
    }
    const plan = JSON.parse(readFileSync(arg('plan'), 'utf8'));
    const ctl = buildStagedTape({ staging: { ...OPEN, equips: tapeEquips(plan.equipsAt) }, perTick: plan.keys.map((k) => new Set(k)), name: 'l40-bk2-B-control-flag12' });
    writeFileSync(join(dir, 'B-control-flag12.tape.json'), JSON.stringify(ctl));
    // B-shut: the SAME inputs with the door shut (the control's line minus {40,12}).
    const shut = buildStagedTape({ staging: { ...SHUT, equips: tapeEquips(plan.equipsAt) }, perTick: plan.keys.map((k) => new Set(k)), name: 'l40-bk2-B-control-inputs-door-shut' });
    writeFileSync(join(dir, 'B-control-inputs-door-shut.tape.json'), JSON.stringify(shut));
    for (const [name, st] of [['B-control-flag12', OPEN], ['B-control-inputs-door-shut', SHUT]]) {
        const run = createRunForStaging({ ...st }, SOURCE, { scratchPersistence: true });
        const eq = new Map(plan.equipsAt);
        plan.keys.forEach((k, i) => { if (eq.has(i)) run.equipNow(eq.get(i)); run.advance(new Set(k)); });
        rows[name] = { ticks: plan.keys.length, end: { x: run.state.x, y: run.state.y, level: run.level }, hits: run.playerHits.length,
            pushables: pushRow(run), clears: [...(run.scratchClears ?? [])].map((c) => typeof c === 'string' ? c : `${c.level}:${c.tag}`) };
        console.log('MODEL', name, JSON.stringify(rows[name]));
    }
    writeFileSync(join(dir, 'model-rows.json'), JSON.stringify(rows, null, 1));
}

if (arg('play')) {
    const { chromium } = await import('playwright');
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
    const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
    const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const { l25Sets } = await M('fidelityL25ApItem.js');
    const dir = arg('play');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;
    const set = l25Sets(R).delivered;
    takeBoxLockOrExit({ name: 'rules-l40-bk2-witness', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const call = (page, n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
    const json = async (page, n, a) => JSON.parse(await call(page, n, a));
    const until = async (page, fn, ms) => { for (const t0 = Date.now(); ;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout'); await page.waitForTimeout(100); } };
    const arms = (arg('arm') ? arg('arm').split(',') : [...Object.keys(ARMS), 'B-control-flag12', 'B-control-inputs-door-shut']);
    let proved = false;
    for (const name of arms) {
        const tape = parseTape(readFileSync(join(dir, `${name}.tape.json`), 'utf8'));
        const page = await browser.newPage();
        try {
            await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
            await until(page, () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await until(page, () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const samples = [];
            let lastT = -1;
            let status;
            for (const t0 = Date.now(); Date.now() - t0 < 20 * 60 * 1000;) {
                const [s, m] = await page.evaluate(() => [String(window.__swfBridge.game.botStatus()), String(window.__swfBridge.game.botMobiles())]);
                status = JSON.parse(s);
                if (status.error) throw new Error(status.error);
                const mob = JSON.parse(m);
                if (Number.isInteger(status.tick) && status.tick >= lastT + 10) {
                    lastT = status.tick;
                    const blocks = (mob.mobiles ?? []).filter((r) => /PushableBlock/.test(r.cls)).map((r) => `${r.cls.split('::').pop()}(${r.x},${r.y})${r.destroy ? 'X' : ''}`);
                    samples.push({ t: status.tick, level: status.level, x: status.x, y: status.y, hits: status.hits, blocks: blocks.join(' ') });
                }
                if (status.finished) break;
                await page.waitForTimeout(20);
            }
            const drained = await json(page, 'botDrain');
            const ticks = drained?.ticks ?? [];
            const clears = [...new Set((status.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`))].sort();
            const lastBlocks = samples.at(-1)?.blocks;
            const row = { arm: name, finished: !!status.finished, obs: ticks.length, tick_count: tape.tick_count,
                end: ticks.at(-1) ? { level: ticks.at(-1).level, x: ticks.at(-1).x, y: ticks.at(-1).y } : null, hits: status.hits ?? null,
                bk2: clears.includes(`${BK2.level}:${BK2.tag}`), flag12: clears.includes(`${FLAG12.level}:${FLAG12.tag}`),
                clearsL40: clears.filter((c) => c.startsWith('40:')), blocks: lastBlocks };
            console.log('ROW', JSON.stringify(row));
            writeFileSync(join(dir, `${name}.game.json`), JSON.stringify({ row, samples, ticks: ticks.map((o) => [o.level, o.x, o.y]) }));
        } catch (e) {
            console.log('ROW', JSON.stringify({ arm: name, error: String(e.message).split('\n')[0] }));
        } finally { await page.close(); }
    }
    await browser.close();
}
