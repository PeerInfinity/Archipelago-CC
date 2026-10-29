#!/usr/bin/env node
/**
 * The WEAPON REACH witnesses (slice rules-weapon-reach-census): a stance from which the Spear THRUST lights a pole and
 * the Ghost Sword SWING does not (LOOSER: the rules charge the pole's door `Or(<event>, Ghost Spear)` there, and a
 * Ghost Sword holder holds the Ghost Spear but can no longer thrust it), and the reverse (TIGHTER).
 *
 * The stances are `census-seedling-weapon-reach.mjs`'s rows (a tile, a facing; the player at the tile's centre as the
 * game lands one). Each scene is played twice, each on a FRESH page on the DELIVERED set with the items GRANTED on arrival:
 *   spear              ['spear']                        — the thrust (slot 3)
 *   ghost-spear-sword  ['ghostsword', 'spear', 'sword'] — what AP delivers with all three items: the swing (slot 4),
 *                                                          the thrust gone (`Inventory.addItemsFromSave`)
 *
 *   L101-7-4-E    lightpole@144,64  tag 0, from [7,4] facing E — thrust through the wall [8,4]; LOOSER (the in-room event's place)
 *   L62-7-14-N    lightpole@120,200 tag 0, from [7,14] facing N — the far side's only stance; LOOSER (door out_teleporter_112_64)
 *   L63-2-5-E     lightpole@64,88   tag 1, from [2,5] facing E  — the far side; LOOSER (door out_teleporter_64_0)
 *   L63-4-7-N     lightpole@64,88   tag 1, from [4,7] facing N  — the far side's other stance; LOOSER
 *   L63-2-18-N    lightpole@48,272  tag 6, from [2,18] facing N — the L65 landing pocket; TIGHTER
 *   L63-8-18-N    lightpole@112,272 tag 7, from [8,18] facing N — the L65 landing pocket; TIGHTER
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-weapon-reach.mjs [--host=http://localhost:8000] [--only=L101-7-4-E,…] [--repeat=N]
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

/** The scenes: a pole, a stance tile, a facing, and which weapon the census says lights it. Exported for the unit rows. */
export const SCENES = Object.freeze({
    'L101-7-4-E': { level: 101, tag: 0, tile: [7, 4], dir: 'right', thrust: true, swing: false },
    'L62-7-14-N': { level: 62, tag: 0, tile: [7, 14], dir: 'up', thrust: true, swing: false },
    'L63-2-5-E': { level: 63, tag: 1, tile: [2, 5], dir: 'right', thrust: true, swing: false },
    'L63-4-7-N': { level: 63, tag: 1, tile: [4, 7], dir: 'up', thrust: true, swing: false },
    'L63-2-18-N': { level: 63, tag: 6, tile: [2, 18], dir: 'up', thrust: false, swing: true },
    'L63-8-18-N': { level: 63, tag: 7, tile: [8, 18], dir: 'up', thrust: false, swing: true },
});

/** The tapes: one per scene × mix. Exported for the unit rows. */
export function weaponReachTapes() {
    const out = {};
    for (const [scene, s] of Object.entries(SCENES)) {
        for (const mix of Object.keys(MIXES)) {
            const boot = { level: s.level, x: s.tile[0] * TILE, y: s.tile[1] * TILE };
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
    const s = SCENES[scene];
    return { lit: mix === 'spear' ? s.thrust : s.swing, slots: mix === 'spear' ? [3] : [4] };
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
