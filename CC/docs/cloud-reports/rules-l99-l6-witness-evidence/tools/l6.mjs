#!/usr/bin/env node
// rules-l99-l6-witness: L6 (Dungeon1/4.oel) westbound, NO weapon, from the L7 stairs' landing (216,40) to the L5
// teleporter (32,0) — `level_6 -> level_5__r1c5`, rule True_. ON THE GAME (wasm p4g, headless logic-only).
//
//   node l6.mjs --model                      the solver from the captured request (#26) and from its canSwim=false twin
//   node l6.mjs --build=<dir> [--arm=a,b]    the hand tapes (waypoints; the model only advances the player's clock)
//   node l6.mjs --play=<dir>  [--arm=a,b]    plays each tape; samples the player and both Bobs every 5 ticks; one ROW per arm
//
// Staging: the connected slot-2 request #26 (`hammer-connected-l6` capture, cap_conn_L6_26.json): no weapon, canSwim
// (Questy's Progressive Swim), seals [0,1,2], persistence L5:0 + L8:0, boot (208,32). `noswim` = the same with canSwim
// false — the rule is True_, so the crossing must exist with no item at all.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const HERE = new URL('.', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const { spansOf, keysToward } = await import(join(R, 'scripts/procgen/probe-seedling-er-landings.mjs'));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { requiredTapeVersion } = await M('tapeFormat.js');

const CAP = JSON.parse(readFileSync(join(HERE, '../l6/cap_conn_L6_26.json'), 'utf8'));
export function staging(variant) {
    const req = restoreRequest(CAP.request ?? CAP);
    const s = JSON.parse(JSON.stringify(req.staging));
    if (variant === 'noswim') s.seam.items.canSwim = false;
    // The capture's runtime seam carries `items.hitsMax` and `inventory_slots`; the tape format names them
    // `seam.hits_max` and (no field). Same values.
    const { hitsMax, ...items } = s.seam.items;
    s.seam = { ...s.seam, items, hits_max: hitsMax ?? 3 };
    delete s.inventory_slots;
    return s;
}
export const GOAL = { kind: 'reach-exit', exit: { x: 32, y: 0 } };

// The hand scripts. Row 2 is y 32-48 (centre 40); the water is cols 6-8 (x 96-144) of row 2; the sandtrap pairs sit
// at cols 4 and 10 of rows 1 and 3; bob@96,16 centres at (104,24), bob@112,48 at (120,56).
const BAIT = (x, wait) => [['to', 200, 40], ['to', x, 40], ['wait', wait]];
// Row 1 (or 3) only over columns 5-9 (x 80-160): columns 4 and 10 of those rows hold the sandtraps.
const WEST_ROW1 = [['to', 150, 40], ['to', 150, 24], ['to', 88, 24], ['to', 88, 40], ['to', 40, 40], ['to', 40, 16], ['to', 40, 4]];
const WEST_ROW3 = [['to', 150, 40], ['to', 150, 56], ['to', 88, 56], ['to', 88, 40], ['to', 40, 40], ['to', 40, 16], ['to', 40, 4]];
export const ARMS = {};
for (const v of ['swim', 'noswim']) {
    // Bait from row 2, column 9 (x 152): both Bobs wake (Bob.runRange 80) and their straight chase lines cross the water.
    ARMS[`${v}-bait152-row1`] = { variant: v, script: [...BAIT(152, 150), ...WEST_ROW1] };
    ARMS[`${v}-bait152-row3`] = { variant: v, script: [...BAIT(152, 150), ...WEST_ROW3] };
    // No bait: walk straight through row 1 (control: what the Bobs do when nobody waits for them).
    ARMS[`${v}-nobait-row1`] = { variant: v, script: [['to', 200, 40], ['to', 152, 40], ...WEST_ROW1] };
}

async function author(st, script) {
    const { createRunForStaging } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    // AUTHOR-ONLY: both Bobs despawned at t 0 on the model copy (the model throws on a Bob contact; it only moves the
    // player here). The PLAYED tape keeps both.
    const a = { ...JSON.parse(JSON.stringify(st)), despawn: ['bob@96,16', 'bob@112,48']
        .map((id) => ({ level: 6, id, at: 0, note: 'author-only: the key script never reads a Bob' })) };
    const run = createRunForStaging(a, atlasLevelSource(), { scratchPersistence: true });
    const perTick = [];
    const step = (k) => { perTick.push([...k]); run.advance(new Set(k)); };
    for (let i = 0; i < 5; i++) step([]);
    for (const w of script) {
        if (run.level !== 6) break;
        if (w[0] === 'wait') { for (let i = 0; i < w[1]; i++) step([]); continue; }
        if (w[0] === 'to') {
            for (let n = 0; n < 600 && run.level === 6; n++) {
                const k = keysToward(run.state.x, run.state.y, w[1], w[2], 1);
                if (!k.length) break;
                step(k);
            }
            if (process.env.L6_TRACE) console.error('TO', JSON.stringify(w), '->', run.level, 'hits', run.playerHits.length, run.state.x.toFixed(1), run.state.y.toFixed(1), 't', perTick.length);
        }
    }
    for (let i = 0; i < 20; i++) step([]);
    return { perTick, model: { end: { level: run.level, x: run.state.x, y: run.state.y }, hits: run.playerHits.length } };
}

if (process.argv.includes('--model')) {
    const { atlasLevelSource } = await M('levelSource.js');
    const { twoPassSolve } = await M('twoPassSolve.js');
    const { createRunForStaging } = await M('tapeRunner.js');
    for (const v of ['swim', 'noswim']) {
        const st = staging(v);
        const t0 = Date.now();
        let row;
        try {
            const levelSource = atlasLevelSource();
            const s = await twoPassSolve({ makeRun: (p) => createRunForStaging({ ...st, persistence: p }, levelSource),
                goals: [GOAL], name: `l6-${v}`, boot: st.boot, dashMode: 'all', persistence: st.persistence, log: () => {} });
            row = { verdict: 'SOLVED', ticks: s.out.perTick.length };
        } catch (e) { row = { verdict: 'REFUSED', refusal: String(e.message).split('\n')[0].slice(0, 400) }; }
        console.log('MODEL', JSON.stringify({ variant: v, ...row, ms: Date.now() - t0 }));
    }
}

if (arg('build')) {
    const dir = arg('build'); mkdirSync(dir, { recursive: true });
    for (const name of (arg('arm') ? arg('arm').split(',') : Object.keys(ARMS))) {
        const a = ARMS[name];
        const st = staging(a.variant);
        const { perTick, model } = await author(st, a.script);
        const t = { ...st, game: 'seedling', name: `l6-${name}`, description: `rules-l99-l6-witness: L6 west ${name} (hand script)`,
            noclip: false, noDamage: false, noHazards: [], grants: [], equips: [], tick_count: perTick.length, inputs: spansOf(perTick) };
        writeFileSync(join(dir, `${name}.tape.json`), JSON.stringify({ ...t, tape_version: requiredTapeVersion(t, 8) }));
        console.log('BUILT', name, JSON.stringify({ ticks: perTick.length, model }));
    }
}

if (arg('play')) {
    const { chromium } = await import('playwright');
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
    const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
    const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const { parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(R, rel), 'utf8'));
    const set = vanillaRecordSet(readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
        readJson('frontend/modules/flashPanel/atlases/seedling-map.json')).set;
    const dir = arg('play');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;
    takeBoxLockOrExit({ name: 'rules-l99-l6-witness', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const call = (page, n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
    const until = async (page, fn, ms) => { for (const t0 = Date.now(); ;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout'); await page.waitForTimeout(100); } };
    let proved = false;
    for (const name of (arg('arm') ? arg('arm').split(',') : Object.keys(ARMS))) {
        const tape = parseTape(readFileSync(join(dir, `${name}.tape.json`), 'utf8'));
        const page = await browser.newPage();
        try {
            await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
            await until(page, () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await until(page, () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; console.log('CHANNEL: headless logic-only (asserted)'); }
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const samples = [];
            let lastT = -1; let status; let maxHits = 0;
            for (const t0 = Date.now(); Date.now() - t0 < 20 * 60 * 1000;) {
                const [s, m] = await page.evaluate(() => [String(window.__swfBridge.game.botStatus()), String(window.__swfBridge.game.botMobiles())]);
                status = JSON.parse(s);
                if (status.error) throw new Error(status.error);
                if (Number.isInteger(status.tick) && status.tick >= lastT + 5) {
                    lastT = status.tick;
                    const mob = JSON.parse(m);
                    const bobs = (mob.mobiles ?? []).filter((r) => /::Bob$|^Bob$/.test(r.cls)).map((r) => ({ x: +r.x.toFixed(1), y: +r.y.toFixed(1), d: !!r.destroy }));
                    maxHits = Math.max(maxHits, status.hits ?? 0);
                    samples.push({ t: status.tick, level: status.level, x: status.x, y: status.y, hits: status.hits, bobs });
                }
                if (status.finished) break;
                await page.waitForTimeout(15);
            }
            const drained = JSON.parse(await call(page, 'botDrain'));
            const ticks = drained?.ticks ?? [];
            const inL6 = samples.filter((s) => s.level === 6);
            const row = { arm: name, finished: !!status.finished, obs: ticks.length, tick_count: tape.tick_count,
                end: ticks.at(-1) ? { level: ticks.at(-1).level, x: ticks.at(-1).x, y: ticks.at(-1).y } : null,
                hits: status.hits ?? null, maxHits, levels: [...new Set(ticks.map((o) => o.level))],
                firstTickInL5: ticks.findIndex((o) => o.level === 5),
                bobsAliveLastL6: inL6.at(-1)?.bobs.filter((b) => !b.d).length ?? null };
            console.log('ROW', JSON.stringify(row));
            writeFileSync(join(dir, `${name}.game.json`), JSON.stringify({ row, samples, ticks: ticks.map((o) => [o.level, o.x, o.y]) }));
        } catch (e) {
            console.log('ROW', JSON.stringify({ arm: name, error: String(e.message).split('\n')[0] }));
        } finally { await page.close(); }
    }
    await browser.close();
}
