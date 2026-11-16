#!/usr/bin/env node
// rules-landing-contact-census: play tapes ON THE GAME (wasm p4g, headless logic-only) with a level set mounted.
//   node play.mjs --spot=delivered|vanilla|x,y [--tapes=<dir>/<a>.tape.json,…] [--arrivals=73:64:16,…] [--ticks=180]
//                 [--out=<dir>]
// --spot picks the set: `delivered` = `vanillaRecordSet`'s own default (`SEEDLING_SET_PATCHES`, the L73 move in it);
// `vanilla` = the same WITHOUT the L73 row (the runner at 72,24); `x,y` = the table with the L73 row moved to (x, y).
// --arrivals boots each landing item-less, idle and each held direction (the census probe's tapes).
// Every tape on a FRESH page (a reused page keeps the previous build's entities). Per tape: one ROW — hits (first
// hit tick on the `seedlingHitTicks` clock), level changes, the bodies at the end, and every polled tick to
// <out>/<name>.game.json.gz.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { basename, join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SPOT = arg('spot', 'delivered');
const TICKS = Number(arg('ticks', '180'));
const OUT = arg('out');
if (OUT) mkdirSync(OUT, { recursive: true });
const { patchesFor } = await import('./author.mjs');
const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
const { vanillaRecordSet } = await M('levelSetExporter.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const { inputVerdict } = await import(join(R, 'scripts/procgen/probe-seedling-landing-contact.mjs'));
const readJson = (rel) => JSON.parse(readFileSync(join(R, rel), 'utf8'));
const SET = vanillaRecordSet(readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
    readJson('frontend/modules/flashPanel/atlases/seedling-map.json'), { patches: patchesFor(SPOT) }).set;
const l73 = SET.rooms?.find?.((r) => r.level === 73);
console.log(`SET ${SPOT}: ${SET.set_id}${l73 ? '' : ''}`);

const tapes = [];
for (const f of arg('tapes') ? arg('tapes').split(',') : []) tapes.push({ name: basename(f).replace(/\.tape\.json$/, ''), tape: parseTape(readFileSync(f, 'utf8')) });
for (const spec of arg('arrivals') ? arg('arrivals').split(',') : []) {
    const [level, x, y] = spec.split(':').map(Number);
    for (const key of [null, 'up', 'down', 'left', 'right']) {
        const name = `arrive-L${level}-${x}-${y}-${key ?? 'idle'}@${SPOT.replace(',', '-')}`;
        tapes.push({ name, tape: parseTape({ tape_version: 8, game: 'seedling', name, description: `rules-landing-contact-census: ${name}`,
            boot: { level, x, y }, noclip: false, noDamage: false, noHazards: [], grants: [], persistence: [], equips: [], pins: [...PIN_NAMES],
            save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { seed: 1, split: false }, seam: {}, tick_count: TICKS,
            inputs: key ? [{ key, from: 0, to: TICKS }] : [] }) });
    }
}

const { chromium } = await import('playwright');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const URL_ = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
takeBoxLockOrExit({ name: 'rules-arrival-chase-witness play.mjs', kind: 'browser' });
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const call = (page, n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
let proved = false;
for (const { name, tape } of tapes) {
    const page = await browser.newPage();
    try {
        await page.goto(URL_, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 720 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
        await page.click('#btn-start');
        for (let i = 0; i < 720 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
        await assertLogicOnlyChannel(page);
        if (!proved) { console.log('CHANNEL: headless logic-only (asserted)'); proved = true; }
        const answers = [];
        for (const c of planLevelSetChunks(SET).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
        if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
        const mounted = JSON.parse(await call(page, 'botLevelSet'))?.active;
        if (mounted !== SET.set_id) throw new Error(`mounted ${mounted}`);
        if (await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
        if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
        const reads = []; let status;
        for (const t0 = Date.now(); Date.now() - t0 < 5 * 60 * 1000;) {
            const [s, m] = await page.evaluate(() => [String(window.__swfBridge.game.botStatus()), String(window.__swfBridge.game.botMobiles())]);
            status = JSON.parse(s);
            if (status.error) throw new Error(status.error);
            if (Number.isInteger(status.tick)) {
                const mob = (JSON.parse(m).mobiles ?? []).filter((b) => !/Player/.test(b.cls ?? '')).map((b) => `${String(b.cls).replace('Enemies::', '')}(${(+b.x).toFixed(1)},${(+b.y).toFixed(1)})${b.destroy ? 'X' : ''}`);
                reads.push({ tick: status.tick, level: status.level, x: status.x, y: status.y, hits: status.hits ?? 0, hits_timer: status.hits_timer, dead_frames: status.dead_frames ?? 0, mob });
            }
            if (status.finished) break;
        }
        const v = inputVerdict(reads, tape.boot.level);
        const inBoot = reads.filter((r) => r.level === tape.boot.level);
        const maxHits = Math.max(0, ...inBoot.map((r) => r.hits));
        const row = { tape: name, set: SET.set_id, ticks: tape.tick_count, finished: !!status?.finished, verdict: v.verdict, firstHit: v.firstHit,
            hitsInBoot: maxHits, restarts: v.restarts, levels: [...new Set(reads.map((r) => r.level))],
            end: { level: status?.level, x: +Number(status?.x).toFixed(2), y: +Number(status?.y).toFixed(2), t: status?.tick },
            lastInBoot: inBoot.at(-1) && { t: inBoot.at(-1).tick, x: +Number(inBoot.at(-1).x).toFixed(2), y: +Number(inBoot.at(-1).y).toFixed(2), mob: inBoot.at(-1).mob },
            firstMob: reads.find((r) => r.tick >= 1)?.mob ?? null, polled: reads.length };
        console.log('ROW', JSON.stringify(row));
        if (OUT) writeFileSync(join(OUT, `${name}.game.json.gz`), gzipSync(JSON.stringify({ row, reads })));
    } catch (e) {
        console.log('ROW', JSON.stringify({ tape: name, error: String(e.message).split('\n')[0] }));
    } finally { await page.close(); }
}
await browser.close();
