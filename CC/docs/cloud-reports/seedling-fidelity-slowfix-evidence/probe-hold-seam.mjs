#!/usr/bin/env node
/**
 * seedling-fidelity-slowfix D-B — THE L15 HOLD SEAM, ON THE GAME (evidence tool; not a gate).
 *
 * logical-links B's known divergence `l15-post-chest-walk` (history 75: `level_15__r1c5 -> level_14` after
 * 'Level 015 - Chest', model x 115.05, game 115.30 at t18) is a bot-HOLD artefact: the chest leg ends `hold: true`, the
 * game runs held frames while the continuation is solved, and `Bot.update` steps the pinned Swim channel on each of them
 * (`Game.time` and the player stay put). Two recordings, each on a FRESH page with the AP set mounted (the delivered set
 * with L15's `chest@144,96` the page's `apitem` {tag 1, look chest}):
 *   joined   both legs as ONE tape (no hold)                       → the model at 0 px with no held frames
 *   held     the chest leg with `hold: true`, `--hold-ms` of hold, then the engine's own continuation tape
 *            (`l15-continuation-tape-as-shipped.json`) on the held game → the model at 0 px with `stepHeldFrames(n)`,
 *            n = the pin's advance over the hold (read from `botStatus.sound_pin`)
 * Run (dev server at the repo root): SEEDLING_PORT=<port> node CC/docs/cloud-reports/seedling-fidelity-slowfix-evidence/probe-hold-seam.mjs
 *        [--hold-ms=300] [--out=<file.json>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..');
const P = join(REPO, 'scripts', 'procgen');
const M = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const HOLD_MS = Number(arg('hold-ms', '300'));
const OUT = arg('out', null);
const { chromium } = await import(join(REPO, 'node_modules', 'playwright', 'index.mjs'));
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(P, 'headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(P, 'seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(P, 'boxLock.js'));
const { gameVisibleTape, parseTape } = await import(join(M, 'tapeFormat.js'));
const { buildStagedTape } = await import(join(M, 'botDriverV1.js'));
const { vanillaRecordSet } = await import(join(M, 'levelSetExporter.js'));
const { planLevelSetChunks } = await import(join(M, 'levelSetValidator.js'));

const W = JSON.parse(readFileSync(join(M, 'fixtures', 'hold-seam-witness', 'l15-hold-seam.json'), 'utf8'));
const CONT = JSON.parse(readFileSync(join(HERE, 'l15-continuation-tape-as-shipped.json'), 'utf8'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const EMBED = JSON.parse(readFileSync(join(M, 'fixtures', 'seedling-vanilla-set.json'), 'utf8'));
const vset = vanillaRecordSet(EMBED, MAP).set;
const apL15 = (rec) => ({ ...rec, entities: rec.entities.map((e) => (e.type === 'chest' && e.x === 144 && e.y === 96
    ? { type: 'apitem', x: 144, y: 96, attrs: { tag: '1', look: 'chest' } } : e)) });
const set = { ...vset, set_id: `${vset.set_id}-l15ap`,
    rooms: vset.rooms.map((r) => (r.id === 15 ? { ...r, source: { ...r.source, record: apL15(r.source.record) } } : r)) };
const sets = (keys) => keys.map((k) => new Set(k));
const joined = buildStagedTape({ staging: W.staging, perTick: sets([...W.chestKeys, ...W.walkKeys]), name: 'slowfix-l15-joined' });
const chest = buildStagedTape({ staging: W.staging, perTick: sets(W.chestKeys), name: 'slowfix-l15-chest-held' });

takeBoxLockOrExit({ name: 'probe-hold-seam.mjs', kind: 'browser' });
const pin = (s) => s?.sound_pin?.channels?.[0] ?? null;
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const page0 = async () => {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4g/game.html`, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
    await page.click('#btn-start');
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
    await assertLogicOnlyChannel(page);
    const bot = (n, a) => page.evaluate(([name, x]) => { const g = window.__swfBridge.game; return String(x === undefined ? g[name]() : g[name](x)); }, [n, a]);
    const answers = [];
    for (const c of planLevelSetChunks(set).chunks) answers.push(await bot('botLoadLevels', JSON.stringify(c)));
    if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
    const status = async () => JSON.parse(await bot('botStatus'));
    const play = async (tapeJson) => {
        const a = await bot('botLoadTape', JSON.stringify(tapeJson));
        if (a !== 'ok') throw new Error(`botLoadTape: ${a}`);
        await bot('botStart');
        const pins = {};
        for (;;) { const s = await status(); if (!(s.tick in pins)) pins[s.tick] = pin(s); pins[s.tick] = pins[s.tick] ?? pin(s); if (s.finished) return { s, pins }; }
    };
    return { page, bot, status, play };
};
const tk = (d) => d.ticks.map((o) => ({ t: o.t, level: o.level, x: o.x, y: o.y }));
const out = {};
try {
    { const g = await page0(); await g.play(gameVisibleTape(parseTape(JSON.stringify(joined)))); out.joined = tk(JSON.parse(await g.bot('botDrain'))); await g.page.close(); }
    {
        const g = await page0();
        const r = await g.play({ ...gameVisibleTape(parseTape(JSON.stringify(chest))), tape_version: 12, hold: true });
        const atEnd = pin(r.s);
        const t0 = Date.now();
        let last = null;
        while (Date.now() - t0 < HOLD_MS) last = await g.status();
        out.seam = { atEnd, gameTimeAtEnd: r.s.game_time, last: { game_time: last.game_time, x: last.x, pin: pin(last) } };
        out.chest = tk(JSON.parse(await g.bot('botDrain')));
        const c = await g.play(CONT);
        out.contPins = c.pins;
        out.continuation = tk(JSON.parse(await g.bot('botDrain')));
        out.heldFrames = c.pins[1].frames - 1 - atEnd.frames;
        await g.page.close();
    }
} finally { await browser.close(); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
console.log(`joined: ${out.joined.length} obs, equal to the fixture's: ${same(out.joined, W.joined.ticks)}`);
console.log(`held: seam pin ${out.seam.atEnd.frames} -> ${out.seam.last.pin.frames} over ${HOLD_MS} ms (game_time ${out.seam.gameTimeAtEnd} -> ${out.seam.last.game_time}); heldFrames ${out.heldFrames}`);
console.log(`held: continuation t18 x ${out.continuation[18].x}; equal to the fixture's: ${same(out.continuation, W.held.continuation)}`);
if (OUT) writeFileSync(OUT, JSON.stringify(out));
