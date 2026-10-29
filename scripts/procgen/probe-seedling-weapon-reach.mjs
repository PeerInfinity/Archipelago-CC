#!/usr/bin/env node
/**
 * The WEAPON REACH witnesses (slice rules-weapon-reach-census): a stance from which the Spear THRUST lights a pole and
 * the Ghost Sword SWING may not (LOOSER: the rules charge the pole's door `Or(<event>, Ghost Spear)` there, and a
 * Ghost Sword holder holds the Ghost Spear but can no longer thrust it), and the reverse (TIGHTER).
 *
 * The stances are `census-seedling-weapon-reach.mjs`'s rows (a tile, a facing, a point in it). Each scene is played with
 * the mixes it names, each on a FRESH page on the DELIVERED set with the items GRANTED on arrival:
 *   spear              ['spear']                        — the thrust (slot 3)
 *   ghost-spear-sword  ['ghostsword', 'spear', 'sword'] — what AP delivers with all three items: the swing (slot 4),
 *                                                          the thrust gone (`Inventory.addItemsFromSave`)
 *
 * The scenes (`SCENES`): at each of the three poles the centre-stance census called LOOSER (L101 lightpole@144,64,
 * L62 lightpole@120,200, L63 lightpole@64,88), the rules' own stance (tile centre, the charged facing) with both mixes,
 * and the ghost swing from the deepest point of the same tile; and the two TIGHTER L65 landing pockets of L63.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-weapon-reach.mjs [--host=http://localhost:8000] [--only=L101-7-4-centre-E,…] [--repeat=N]
 * `--repeat=N` runs every tape N times, each on its own fresh page.
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

/** The two mixes, as `Bot.as` `grantItem` names. Exported for the unit rows. */
export const MIXES = Object.freeze({
    'spear': ['spear'],
    'ghost-spear-sword': ['ghostsword', 'spear', 'sword'],
});

/**
 * The scenes: a pole, the player's position (`at`, px — a tile centre is `tile·16 + 8`), a facing, and what the census
 * says each mix does there (`lit`; a mix not named is not played). Exported for the unit rows.
 *   centre   the rules' own stance (`poleThrustStances`: tile centre, the facing it charges) — the thrust lights it, the
 *            ghost swing from the SAME point and facing does not (the census's closest calls);
 *   fine     the ghost swing from the deepest point of that same tile (`poleFineStances`) — it lights it, so the tile
 *            the rules charge is a stance for a Ghost Sword holder too;
 *   pocket   the L65 landing pockets of L63 (TIGHTER): the ghost swing lights the pole, no thrust does.
 */
export const SCENES = Object.freeze({
    'L101-7-4-centre-E': { level: 101, tag: 0, tile: [7, 4], at: [120, 72], dir: 'right', lit: { 'spear': true, 'ghost-spear-sword': false } },
    'L101-7-4-fine-N': { level: 101, tag: 0, tile: [7, 4], at: [126, 72], dir: 'up', lit: { 'ghost-spear-sword': true } },
    'L62-7-14-centre-N': { level: 62, tag: 0, tile: [7, 14], at: [120, 232], dir: 'up', lit: { 'spear': true, 'ghost-spear-sword': false } },
    'L62-7-14-fine-E': { level: 62, tag: 0, tile: [7, 14], at: [120, 226], dir: 'right', lit: { 'ghost-spear-sword': true } },
    'L63-2-5-centre-E': { level: 63, tag: 1, tile: [2, 5], at: [40, 88], dir: 'right', lit: { 'spear': true, 'ghost-spear-sword': false } },
    'L63-2-5-fine-N': { level: 63, tag: 1, tile: [2, 5], at: [46, 88], dir: 'up', lit: { 'ghost-spear-sword': true } },
    'L63-4-7-centre-N': { level: 63, tag: 1, tile: [4, 7], at: [72, 120], dir: 'up', lit: { 'spear': true, 'ghost-spear-sword': false } },
    'L63-4-7-fine-E': { level: 63, tag: 1, tile: [4, 7], at: [72, 114], dir: 'right', lit: { 'ghost-spear-sword': true } },
    'L63-2-18-pocket-N': { level: 63, tag: 6, tile: [2, 18], at: [40, 296], dir: 'up', lit: { 'spear': false, 'ghost-spear-sword': true } },
    'L63-8-18-pocket-N': { level: 63, tag: 7, tile: [8, 18], at: [136, 296], dir: 'up', lit: { 'spear': false, 'ghost-spear-sword': true } },
});

/** The tapes: one per scene × the mixes it names. Exported for the unit rows. */
export function weaponReachTapes() {
    const out = {};
    for (const [scene, s] of Object.entries(SCENES)) {
        for (const mix of Object.keys(s.lit)) {
            // `spawnFromBoot`: the player stands at the boot + (8, 8).
            const boot = { level: s.level, x: s.at[0] - 8, y: s.at[1] - 8 };
            out[`${scene}-${mix}`] = {
                scene, mix,
                tape: {
                    tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [], persistence: [], equips: [],
                    save: { totem_parts: [], keys: [], seal_parts: [] },
                    name: `weapon-reach-${scene}-${mix}`, description: `probe-seedling-weapon-reach: ${scene} ${mix}`,
                    boot, grants: [{ level: s.level, items: [...MIXES[mix]] }], tick_count: 40,
                    inputs: [{ key: s.dir, from: 0, to: 1 }, { key: 'primary', from: 4, to: 5 }],
                },
            };
        }
    }
    return out;
}

/** What the census says each mix does at a scene. Exported for the unit rows. */
export function expected(scene, mix) {
    return { lit: SCENES[scene].lit[mix], slots: mix === 'spear' ? [3] : [4] };
}

/** What one run says. Exported for the unit rows. */
export function readRun(scene, ticks, status) {
    const s = SCENES[scene];
    const cleared = (status?.persistence_cleared ?? []).map((c) => (typeof c === 'string' ? c : `${c.level}:${c.tag}`));
    const first = ticks[0] ?? null;
    return {
        levels: [...new Set(ticks.map((o) => o.level))],
        at: first ? [first.x, first.y] : null,
        slots: status?.inventory_slots ?? null,
        slash: status?.slash ?? null,
        lit: cleared.includes(`${s.level}:${s.tag}`),
    };
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };

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

    takeBoxLockOrExit({ name: 'probe-seedling-weapon-reach.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
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
        for (const [name, { scene, mix, tape: raw }] of Object.entries(weaponReachTapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(scene) && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(scene, g.ticks, g.status);
            const want = expected(scene, mix);
            console.log(`ROW ${JSON.stringify({ tape: name, scene, mix, set_id: set.set_id, mounted: g.mounted?.active,
                observations: g.ticks.length, ...read })}`);
            check(`${name}: the game ran the tape to its end on the delivered set, in L${SCENES[scene].level}`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id
                    && read.levels.length === 1 && read.levels[0] === SCENES[scene].level,
                `${g.ticks.length} obs, ${g.mounted?.active}, levels ${JSON.stringify(read.levels)}`);
            const s = SCENES[scene];
            check(`${name}: the player starts on its stance (${s.at})`,
                !!read.at && Math.abs(read.at[0] - s.at[0]) < 1 && Math.abs(read.at[1] - s.at[1]) < 1, JSON.stringify(read.at));
            check(`${name}: the slots are ${JSON.stringify(want.slots)}`, JSON.stringify(read.slots) === JSON.stringify(want.slots),
                JSON.stringify(read.slots));
            check(`${name}: pole {${SCENES[scene].level},${SCENES[scene].tag}} lit = ${want.lit}`, read.lit === want.lit,
                JSON.stringify({ at: read.at, slash: read.slash }));
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
