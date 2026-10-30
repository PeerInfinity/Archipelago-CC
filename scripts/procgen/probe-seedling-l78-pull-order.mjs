#!/usr/bin/env node
/**
 * Seedling's L78 LAVATRAPS on ONE step, ON THE GAME (session tile-primitives-sphere-order-10): when one tile step enters the
 * discs of two traps at once, which trap reels the player in?
 *
 * The rules producer's disc (`lavaTrapPulls`) is every tile whose CENTRE lies within 32 px of the trap's centre
 * (`LavaTrap.as:21,81-82`). L78's traps at (6,5) and (9,6) both take (8,5) and neither takes (8,4), so the tile step
 * (8,4) → (8,5) enters both discs from outside both, and the maze refuses it (`pull_ambiguous_dropped`). The game is not
 * tile-stepped: the player walks 0.8 px a tick (`Player.as:73`), its x,y the centre of a 4x5 box (`Player.as:295`), and
 * each trap tests `FP.distance` of the two centres, truncated to int, against 32 (`LavaTrap.as:81-82`). Walking down
 * from (136,72) the player enters (9,6)'s disc at y 76 and (6,5)'s only at y 80, so the geometry says (9,6) — but the
 * tongue grabs only when its tip, extended frame by frame (`tongueLengths` 7, 22, 32), meets the player's box
 * (`LavaTrap.as:145`), a race four or five ticks wide that this probe settles on the game.
 *
 * The player boots on (8,4) — INSIDE (9,3)'s disc, so that trap's `wait` holds (`:26,101-103`: it re-arms only once
 * d > 32) — and outside the other two, which arm on the first tick. Tapes, each on a FRESH page on the DELIVERED set,
 * the Dark Suit held (released on the trap's own tile, `:64-69`), `noDamage` (L78's lava runners walk the corridor):
 *   down        holds DOWN from (8,4): the ambiguous step
 *   up-lava     holds UP from (7,7), on the lava the suit walks: its mirror (7,7) → (7,6), whose first disc is (6,5)'s
 *   control     holds RIGHT from (4,4), outside every disc, into (5,4) — (6,5)'s disc alone: the probe sees a pull
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}` (the trap the player was released on, or null), and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED`. The `down` tape's expectation is the geometric order (the disc entered first wins); a FAIL there
 * is the finding, not a broken probe, once the control passes.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l78-pull-order.mjs [--host=http://localhost:8000] [--only=down,…] [--repeat=N] [--dump]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const TILE = 16;
/** L78's three LavaTraps (tile coordinates, the map's entities). */
export const L78_TRAPS = Object.freeze([[9, 3], [6, 5], [9, 6]]);

/** Ticks holding the key, then idle ticks: the tongue's grab and reel land inside them. */
const HOLD = 40;
const SETTLE = 120;

/** The tapes. Exported for the unit rows. */
export function l78Tapes() {
    const tape = (name, boot, key) => ({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [], persistence: [], equips: [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        name: `l78-pull-order-${name}`, description: `probe-seedling-l78-pull-order: ${name}`,
        boot, grants: [{ level: 78, items: ['darksuit'] }], tick_count: HOLD + SETTLE, inputs: [{ key, from: 0, to: HOLD }],
    });
    return {
        down: tape('down', { level: 78, x: 8 * TILE, y: 4 * TILE }, 'down'),
        'up-lava': tape('up-lava', { level: 78, x: 7 * TILE, y: 7 * TILE }, 'up'),
        control: tape('control', { level: 78, x: 4 * TILE, y: 4 * TILE }, 'right'),
    };
}

/**
 * The trap whose TILE the player stands in, or null. The release is not on the trap's centre: the tongue lets go at its
 * last length, 7 px out (`tongueLengths`, `LavaTrap.as:23,58-68`), still inside the trap's own tile.
 */
export function trapAt(o) {
    if (!o) return null;
    const hit = L78_TRAPS.find(([tx, ty]) => Math.floor(o.x / TILE) === tx && Math.floor(o.y / TILE) === ty);
    return hit ? [...hit] : null;
}

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const in78 = ticks.filter((o) => o.level === 78);
    // the first tick the player stands in a trap's tile: the reel's end (`LavaTrap.as:62-68`)
    const first = in78.find((o) => trapAt(o));
    return {
        levels: [...new Set(ticks.map((o) => o.level))],
        start: in78[0] ?? null,
        releasedOn: first ? trapAt(first) : null,
        releasedAt: first?.t ?? null,
        final: ticks.at(-1) ?? null,
        finalTrap: trapAt(ticks.at(-1)),
        hits: status?.hits ?? null,
    };
}

/** The expectation per tape: each ambiguous step onto the trap whose disc it enters first; the control onto (6,5). */
export const EXPECTED = Object.freeze({ down: [9, 6], 'up-lava': [6, 5], control: [6, 5] });
export function expectL78(name, r) {
    return JSON.stringify(r.releasedOn) === JSON.stringify(EXPECTED[name]);
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-l78-pull-order.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const call = (page, n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const json = async (page, n, a) => { const r = await call(page, n, a); return r === null ? null : JSON.parse(r); };
    const waitFor = async (page, what, fn, ms) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(250);
        }
    };
    const logs = [];
    const run = async (tape) => {
        const page = await browser.newPage();
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            await assertLogicOnlyChannel(page);
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const mounted = await json(page, 'botLevelSet');
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = await json(page, 'botStatus');
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                return st?.finished ? st : null;
            }, 10 * 60 * 1000);
            const drained = await json(page, 'botDrain');
            return { status, mounted, ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
        } finally {
            await page.close();
        }
    };
    try {
        const only = arg('only', null)?.split(',');
        const repeat = Math.max(1, Number(arg('repeat', '1')) || 1);
        for (const [name, raw] of Object.entries(l78Tapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.status);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                grants: tape.grants, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = {
                down: 'the step (8,4) → (8,5) is reeled onto (9,6), the trap whose disc it enters first',
                'up-lava': 'the step (7,7) → (7,6) is reeled onto (6,5), the trap whose disc it enters first',
                control: 'the step (4,4) → (5,4) is reeled onto (6,5), the one disc it enters',
            }[name];
            check(`${name}: ${what}`, expectL78(name, read),
                JSON.stringify({ start: read.start, releasedOn: read.releasedOn, releasedAt: read.releasedAt, final: read.final }));
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
