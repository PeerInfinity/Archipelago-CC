#!/usr/bin/env node
/**
 * The whole-game certifier's TAIL, ON THE GAME (slice rules-certifier-tail): the two rows whose verdict the
 * rules and the maze dispute, each answered by the game itself.
 *
 * ROW 2 — `level_3__r0c4 → level_111` (`out_teleporter_0_64`, tile [0,4]). The rules charge it
 * And(Ghost Sword Fusion, Ghost Spear, Sword), the `breakablerockghost@0,64` (tag 1) that sits on the door; the maze
 * also asks the Swim, because the one tile between r0c4's dry lane ([2,4]) and the door is water ([1,4]: tileset
 * column 32, `Dungeon1/1.oel`). `Player.as:1456` starts the drown on water without `canSwim` (10 frames,
 * `drownTimerMax`, `:312`), and the walk is 0.8 px/frame (`dMS`, `:73`). The rock is staged CLEARED (`{3,1}`:
 * `BreakableRock.check` removes it, `BreakableRock.as:50`), so the water is the one variable:
 *   l3-noswim   boot [2,4] (32,64), nothing held, hold LEFT: the door is never touched (the rules are LOOSER)
 *   l3-swim     the same with the Conch (the control): the door takes the player to L111
 * (`probe-seedling-l3-water-door.mjs` measured the same pair, never asserted: CI run 40425654108, dry 0/3, wet 3/3.)
 *
 * PART D — "Level 025 - Chest" (`chest@96,96`, tag 0) on the CURRENT build, where the AP delivery writes it as an
 * `apitem` (`apPlacementRewriter.rewriteRecordSet`): `Pickups/APItem.as` centres it on the tile (`_x + Tile.w/2`) with
 * an 8x8 box at origin 4,4, so x 100..108, y 100..108, NON-solid and taken on overlap from any side — not the
 * vanilla `Chest` (`Chest.as:27-30`, solid, opened only from the line under it, `:61-64`).
 *   l25-ap-main      boot (128,32) = L22's landing (`teleporter@0,128 to=25`), walk W one tile, S four, then W onto it:
 *                    the apitem clears {25,0} from L25's MAIN area
 *   l25-ap-pocket    boot (96,112) = L28's landing (`Dungeon3/7.oel teleporter@96,0`), hold UP: clears {25,0} too
 *   l25-vanilla-main the main-area tape on the VANILLA delivery (a real `Chest`): {25,0} is NOT written (the control
 *                    that the main-area walk is the one the AS3 "opens only from below" fix will close)
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too
 * (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-certifier-tail.mjs [--host=http://localhost:8000] [--only=l3-noswim,…]
 *      [--repeat=N] [--dump]   (--repeat: every tape N times, each on its own fresh page; --dump: every 10th tick)
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
/** Where L3's `out_teleporter_0_64` leads (`to="111"`). */
export const L3_DOOR_TO = 111;
/** L3's `breakablerockghost@0,64` persistence slot, staged cleared. */
export const L3_GHOST_ROCK = { level: 3, tag: 1 };
/** "Level 025 - Chest": its persistence slot. */
export const L25_CHEST = '25,0';
/** The vanilla chest entity the AP delivery rewrites. */
export const L25_CHEST_ENTITY = Object.freeze({ type: 'chest', x: 96, y: 96 });

/** The tapes. Exported for the unit rows. */
export function tailTapes() {
    const tape = (name, boot, { items = [], persistence = [], inputs, ticks }) => ({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [], persistence, equips: [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        name: `certifier-tail-${name}`, description: `probe-seedling-certifier-tail: ${name}`,
        boot, grants: items.length ? [{ level: boot.level, items }] : [], tick_count: ticks, inputs,
    });
    const rock = [{ ...L3_GHOST_ROCK, note: 'breakablerockghost@0,64 staged broken: the water is the one variable' }];
    const l3 = { level: 3, x: 32, y: 64 };
    const l3Inputs = [{ key: 'left', from: 0, to: 240 }];
    // From (128,32): W one tile onto column 7, S down column 7 to row 6, then W onto the apitem's tile.
    const mainInputs = [{ key: 'left', from: 0, to: 20 }, { key: 'down', from: 24, to: 110 }, { key: 'left', from: 114, to: 160 }];
    const main = { level: 25, x: 128, y: 32 };
    return {
        'l3-noswim': tape('l3-noswim', l3, { persistence: rock, inputs: l3Inputs, ticks: 300 }),
        'l3-swim': tape('l3-swim', l3, { items: ['conch'], persistence: rock, inputs: l3Inputs, ticks: 300 }),
        'l25-ap-main': tape('l25-ap-main', main, { inputs: mainInputs, ticks: 200 }),
        'l25-ap-pocket': tape('l25-ap-pocket', { level: 25, x: 96, y: 112 }, { inputs: [{ key: 'up', from: 0, to: 40 }], ticks: 80 }),
        'l25-vanilla-main': tape('l25-vanilla-main', main, { inputs: mainInputs, ticks: 200 }),
    };
}

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const levels = [...new Set(ticks.map((o) => o.level))];
    const clears = [...new Set((status?.persistence_cleared ?? []).map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
    const in3 = ticks.filter((o) => o.level === 3);
    return {
        levels,
        clears,
        reachedL111: levels.includes(L3_DOOR_TO),
        minX3: in3.length ? Math.min(...in3.map((o) => o.x)) : null,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape. Exported for the unit rows. */
export function expectRun(name, r) {
    if (name === 'l3-noswim') return !r.reachedL111;
    if (name === 'l3-swim') return r.reachedL111;
    if (name === 'l25-ap-main' || name === 'l25-ap-pocket') return r.clears.includes(L25_CHEST);
    if (name === 'l25-vanilla-main') return !r.clears.includes(L25_CHEST);
    return false;
}

export const WHAT = Object.freeze({
    'l3-noswim': 'with the ghost rock gone and NO Swim, the water at [1,4] keeps the player off L3\'s door to L111',
    'l3-swim': 'the CONTROL: with the Conch the same walk takes the door into L111',
    'l25-ap-main': 'the AP delivery\'s L25 apitem is taken from L25\'s MAIN area (L22\'s landing): {25,0}',
    'l25-ap-pocket': 'the AP delivery\'s L25 apitem is taken from the L28 pocket too: {25,0}',
    'l25-vanilla-main': 'the CONTROL: the vanilla Chest is NOT opened by the main-area walk (no {25,0})',
});

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
    const { rewriteRecordSet, AP_LOOK } = await M('apPlacementRewriter.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const vanilla = vanillaRecordSet(EMBED, MAP).set;
    // ⛓ The AP arm: the one L25 location rewritten exactly as the delivery's rewriter writes every placement.
    const ap = rewriteRecordSet(vanilla, new Map([['25|0', {
        ledgerId: 'probe-certifier-tail-l25-chest', level: 25, tag: 0, look: AP_LOOK, entity: { ...L25_CHEST_ENTITY },
    }]])).set;
    const setFor = (name) => (name.startsWith('l25-ap-') ? ap : vanilla);
    console.log(`PAGE: ${PAGE} · delivered ${vanilla.set_id} · l25-ap-* on ${ap.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-certifier-tail.mjs', kind: 'browser' });
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
    const run = async (tape, set) => {
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
        for (const [name, raw] of Object.entries(tailTapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape, setFor(name));
            const read = readRun(g.ticks, g.status);
            console.log(`ROW ${JSON.stringify({ tape: name, set_id: setFor(name).set_id, mounted: g.mounted?.active,
                observations: g.ticks.length, boot: tape.boot, grants: tape.grants,
                persistence: tape.persistence.map((c) => `${c.level},${c.tag}`), ...read,
                ...(process.argv.includes('--dump') ? { trace: g.ticks.filter((o) => o.t % 10 === 0) } : {}) })}`);
            check(`${name}: the game ran the tape to its end on the mounted set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === setFor(name).set_id,
                `${g.ticks.length} obs, ${g.mounted?.active}`);
            check(`${name}: ${WHAT[name]}`, expectRun(name, read),
                JSON.stringify({ levels: read.levels, clears: read.clears, minX3: read.minX3, final: read.final }));
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
