#!/usr/bin/env node
/**
 * Seedling's SIX SEALED-WITH-ROOM CELLS, ON THE GAME (slice rules-collider-mismatch): the cells
 * `seedlingSemantics.entitySealedTiles` seals whole where the model flood (`census-seedling-offgrid-blockers.mjs`,
 * its `sealed [...] has room for the box` lines) finds a free pixel for the player. Can the game's player box
 * stand in them?
 *
 * The six are three different questions, so the tapes ask each the way the game decides it:
 *   L2  moonrockpile@40,16 [3,1]   — PRESENCE. `Scenery/MoonrockPile.as:26-32` removes the pile while `{2,0}` is
 *        TRUE (a fresh boot), and the delivered set never writes it (`seedlingSetPatches.PATCH_MOONROCK_REMOVED`).
 *        `l2-pile-absent` holds UP from anchor (56,40) under `stairsup@48,16` → L0; `l2-pile-present` clears `{2,0}`
 *        (the pile built, the control) → the player stalls under the 32x16 Solid, no L0.
 *   L47 snowhill@184,72 [13,7] [14,7] — GEOMETRY. `Scenery/SnowHill.as:16` collides through a Pixelmask, not its
 *        96x56 bounding box; the mask leaves a notch where `teleporter@216,112` stands. `l47-notch` holds UP from
 *        anchor (224,140) → the box reaches row 7 and the door takes the player to L48.
 *   L40 iceturret@472,400 [30,25] [30,26], L98 iceturret@104,24 [7,2] — SOLIDITY. An alive IceTurret is type
 *        "Enemy" (`Enemies/Enemy.as:58`); "Solid" is latched only by its CORPSE (`Enemies/IceTurret.as:92-95`), and
 *        an alive body hits the overlapping player (`Enemy.hitPlayer`, `:211-220`). `l40-turret-nodamage`
 *        (`noDamage`) holds UP from (488,448) through the body → the anchor crosses both cells (not Solid);
 *        `l40-turret-damage` (damage on) → the alive turret holds the player off before contact (MEASURED: the
 *        anchor oscillates at y 440-448 and never enters); `l98-turret-nodamage` holds UP from (120,80) → the
 *        approach is water and the player drowns at y 70.5 (`drown_timer`), short of [7,2].
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-collider-cells.mjs [--host=http://localhost:8000] [--only=l47-notch,…] [--repeat=N] [--dump|--dump-all]
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

/** Ticks holding UP, then idle ticks. */
const HOLD = 150;
const SETTLE = 30;

/**
 * The tapes, each with the cells it asks about (`cells`: [tx, ty]) and what the game must show. Exported for the
 * unit rows. `door`: the level the hold must reach (a door IN the cell takes the player); `stall`: the anchor
 * never enters the cells and no door is taken; `enter`: the anchor enters every cell. `why` is the check's label.
 */
export const COLLIDER_CELL_TAPES = Object.freeze({
    'l2-pile-absent': { level: 2, boot: [56, 40], cells: [[3, 1]], door: 0,
        why: 'the pile is absent on the delivered set: the box reaches [3,1] and stairsup@48,16 takes the player to L0' },
    'l2-pile-present': { level: 2, boot: [56, 40], cells: [[3, 1]], stall: true,
        persistence: [{ level: 2, tag: 0, note: 'moonrockpile@40,16 built (MoonrockPile.as:29)' }],
        why: 'with {2,0} cleared the 32x16 pile stands: the player stalls under it, no L0' },
    'l47-notch': { level: 47, boot: [224, 140], cells: [[13, 7], [14, 7]], door: 48,
        why: 'the mask\'s notch: the box reaches row 7 and teleporter@216,112 takes the player to L48' },
    'l40-turret-nodamage': { level: 40, boot: [488, 448], cells: [[30, 25], [30, 26]], enter: true,
        why: 'the anchor crosses both cells: the alive body is not Solid' },
    'l40-turret-damage': { level: 40, boot: [488, 448], cells: [[30, 25], [30, 26]], stall: true, damage: true,
        why: 'with damage on, the alive turret holds the player off: the anchor never enters its cells' },
    'l98-turret-nodamage': { level: 98, boot: [120, 80], cells: [[7, 2]], stall: true,
        why: 'the approach is water: the player drowns short of [7,2] (drown_timer), never in the cell' },
});

/** The tape a spec plays. */
export function colliderCellTape(name, spec) {
    return {
        tape_version: 6, game: 'seedling', noclip: false, noDamage: !spec.damage, noHazards: [], equips: [], grants: [],
        name: `collider-cells-${name}`, description: `probe-seedling-collider-cells: ${name}`, persistence: spec.persistence ?? [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        // `Player.as:375` places the player at the boot point + half a tile, so `boot` names the ANCHOR.
        boot: { level: spec.level, x: spec.boot[0] - 8, y: spec.boot[1] - 8 }, tick_count: HOLD + SETTLE,
        inputs: [{ key: 'up', from: 0, to: HOLD }],
    };
}

/** What one run says about its cells. Exported for the unit rows. */
export function readCells(spec, ticks, status) {
    const levels = [...new Set(ticks.map((o) => o.level))];
    const inLevel = ticks.filter((o) => o.level === spec.level);
    const cellOf = (o) => `${Math.floor(o.x / 16)},${Math.floor(o.y / 16)}`;
    const visited = new Set(inLevel.map(cellOf));
    return {
        levels,
        entered: spec.cells.filter(([x, y]) => visited.has(`${x},${y}`)).map((c) => c.join(',')),
        minY: inLevel.length ? Math.min(...inLevel.map((o) => o.y)) : null,
        hits: status?.hits ?? null,
        frozen: status?.frozen_timer ?? null,
        drown: status?.drown_timer ?? null,
        final: ticks.at(-1) ?? null,
    };
}

/** The game's verdict per tape. */
export function expectCells(spec, r) {
    const all = r.entered.length === spec.cells.length;
    // A door fires on the first tick the BOX overlaps it (`Teleporter.update`), before the anchor need enter its cell.
    if (spec.door !== undefined) return r.levels.includes(spec.door);
    if (spec.stall) return r.entered.length === 0 && r.levels.length === 1;
    return all;
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

    takeBoxLockOrExit({ name: 'probe-seedling-collider-cells.mjs', kind: 'browser' });
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
        for (const [name, spec] of Object.entries(COLLIDER_CELL_TAPES).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...colliderCellTape(name, spec), pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readCells(spec, g.ticks, g.status);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                cells: spec.cells.map((c) => c.join(',')), persistence: tape.persistence, ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.some((a) => a.startsWith('--dump'))) console.log(`TICKS ${g.ticks.filter((o) => o.t % (process.argv.includes('--dump-all') ? 1 : 10) === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = spec.why;
            check(`${name}: ${what}`, expectCells(spec, read),
                JSON.stringify({ levels: read.levels, entered: read.entered, minY: read.minY, hits: read.hits, frozen: read.frozen, drown: read.drown, final: read.final }));
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
