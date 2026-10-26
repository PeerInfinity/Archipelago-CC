#!/usr/bin/env node
/**
 * Seedling's L93 DOOR into L98 (`out_teleporter_112_80`, tile [7,5]), ON THE GAME (slice tile-primitives-pixelmask-l86):
 * does the player need the Feather to reach it from `level_93__r10c7`?
 *
 * ⛓ PIXELMASK FOOTPRINTS. The door stands in building7's doorway (`Building7Mask.png`, 80x96 at 80,8: the tile
 * [7,5] carries no mask pixel, its neighbours [6,5]/[8,5] are wholly solid, `Scenery/Building.as:21-22`). The
 * shipped rules bound it through building7's `manual` sprite rect, so `level_93__r10c7 -> level_98` was True_.
 * With the grid taking the building's footprint from its mask the door is its own sub-region `r5c7`, reached from
 * r10c7 only up the column below it: [7,9] water, [7,8]/[7,7] a waterfall (`dirs: {N: hasFeather}`; `Player.as:1557`
 * makes a fall one-way down without the Feather), [7,6] water — so the rule becomes Has(Progressive Swim, 2).
 *
 * Tapes, each on a FRESH page on the DELIVERED set, `noHazards` EMPTY, so the Feather is the one variable:
 *   pool-swim     boots on r10c7 (112,160) with the Conch, holds UP — stalls on the fall, no L98
 *   pool-feather  the same with the Conch + Feather — climbs the fall and takes the door into L98 (the control)
 *   landing-swim  boots where L98's door lands the player (`in_L98_112_192` -> [7,6], 112,96) with the Conch,
 *                 holds DOWN for 30 ticks — swims down the fall and comes to rest on r10c7 (the reverse,
 *                 `r5c7 -> r10c7` Swim). Held longer, the player walks on into [7,11], the Dark-Suit cell
 *                 (`r10c7 -> r14c7` charges the Dark Suit), and the game puts them back at the landing.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l93-door.mjs [--host=http://localhost:8000] [--only=pool-swim,…] [--repeat=N] [--dump]
 * `--repeat=N` runs every tape N times, each on its own fresh page (the 8x a slice owes, in one CI job).
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
/** Where `out_teleporter_112_80` leads (`to: 98`). */
export const DOOR_TO = 98;
/** r10c7 = tile [7,10], y 160..176: where a player who swam down the fall from the landing comes to rest. */
export const R10_Y = Object.freeze([160, 176]);
/** DOWN ticks that carry the landing to r10c7 and no further: [7,11] below it is the Dark-Suit cell (lava). */
const LANDING_HOLD = 30;

/** Ticks holding the direction, then idle ticks: the door's transition lands inside them. */
const HOLD = 200;
const SETTLE = 60;

/** The tapes. Exported for the unit rows. */
export function l93Tapes() {
    const tape = (name, boot, items, key, hold = HOLD) => ({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [], persistence: [], equips: [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        name: `l93-door-${name}`, description: `probe-seedling-l93-door: ${name}`,
        boot, grants: [{ level: 93, items }], tick_count: HOLD + SETTLE, inputs: [{ key, from: 0, to: hold }],
    });
    const pool = { level: 93, x: 112, y: 160 };
    return {
        'pool-swim': tape('pool-swim', pool, ['conch'], 'up'),
        'pool-feather': tape('pool-feather', pool, ['conch', 'feather'], 'up'),
        'landing-swim': tape('landing-swim', { level: 93, x: 112, y: 96 }, ['conch'], 'down', LANDING_HOLD),
    };
}

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const levels = [...new Set(ticks.map((o) => o.level))];
    const in93 = ticks.filter((o) => o.level === 93);
    return {
        levels,
        reachedDoor: levels.includes(DOOR_TO),
        minY93: in93.length ? Math.min(...in93.map((o) => o.y)) : null,
        maxY93: in93.length ? Math.max(...in93.map((o) => o.y)) : null,
        hits: status?.hits ?? null,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape: only the Feather climbs to the door; the landing swims down to r10c7 and stays in L93. */
export function expectL93(name, r) {
    if (name === 'pool-feather') return r.reachedDoor;
    if (name === 'landing-swim') {
        return !r.reachedDoor && r.levels.length === 1 && r.levels[0] === 93 && r.final?.y >= R10_Y[0] && r.final.y < R10_Y[1];
    }
    return !r.reachedDoor;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l93-door.mjs', kind: 'browser' });
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
        for (const [name, raw] of Object.entries(l93Tapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.status);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                grants: tape.grants, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = {
                'pool-swim': 'with the Conch but NO Feather the waterfall below the door is not climbed: no L98',
                'pool-feather': 'with the Feather the waterfall is climbed and out_teleporter_112_80 takes the player into L98',
                'landing-swim': 'from the L98 landing (7,6) with the Conch the player swims DOWN the fall and rests on r10c7',
            }[name];
            check(`${name}: ${what}`, expectL93(name, read),
                JSON.stringify({ levels: read.levels, minY93: read.minY93, maxY93: read.maxY93, final: read.final }));
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
