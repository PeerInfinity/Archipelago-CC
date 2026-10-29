#!/usr/bin/env node
/**
 * Seedling's L89 TELEPORTER to L91 (`out_teleporter_208_0`, tile [13,0]), ON THE GAME (slice rules-l89-waterfall-probe):
 * can a Swim-only player (the Conch, no Feather) touch it?
 *
 * Tile [13,0] is a waterfall (tileset column 28) and [13,1] below it is one too (column 31); [13,2] is water. The
 * door's box is 16x16 at (208,0) (`Teleporter.as:44`), so y 0..16. L91's return door lands the player at playerx 208,
 * playery 16, which `Player.as:375` centres on the tile: (216,24), box y 22..27 (`normalHitbox` 4x5 at origin 2,2,
 * `Player.as:295`). Touching the door means climbing ~6 px up the fall, and `Player.as:1557`
 * (`onWaterfall && (!hasFeather || v.y >= 0)` → `v.y += waterfallAcceleration`) pushes a featherless player down.
 * The maze world gates N into both tiles on Swim x2 (the Feather); the playthrough rules charge
 * `level_89__r1c10 -> level_91` Has(Progressive Swim), one Swim.
 *
 * Tapes, each on a FRESH page on the DELIVERED set, `noHazards` EMPTY, holding UP, so the Feather is the one variable:
 *   landing-swim     boots on L91's landing (208,16 → [13,1]) with the Conch
 *   landing-feather  the same with the Conch + Feather (the control)
 *   water-swim       boots on the water below (208,32 → [13,2]) with the Conch
 *   water-feather    the same with the Conch + Feather (the control)
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l89-waterfall.mjs [--host=http://localhost:8000] [--only=landing-swim,…] [--repeat=N] [--dump]
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
/** Where `out_teleporter_208_0` leads (`to: 91`). */
export const DOOR_TO = 91;
/** The door's box bottom edge (y 0..16): the player's box top is `y - 2`, so it touches once y < 18. */
export const DOOR_BOTTOM = 16;

/** Ticks holding UP, then idle ticks: the door's transition lands inside them. */
const HOLD = 200;
const SETTLE = 60;

/** The tapes. Exported for the unit rows. */
export function l89Tapes() {
    const tape = (name, boot, items) => ({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [], persistence: [], equips: [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        name: `l89-waterfall-${name}`, description: `probe-seedling-l89-waterfall: ${name}`,
        boot, grants: [{ level: 89, items }], tick_count: HOLD + SETTLE, inputs: [{ key: 'up', from: 0, to: HOLD }],
    });
    const landing = { level: 89, x: 208, y: 16 };
    const water = { level: 89, x: 208, y: 32 };
    return {
        'landing-swim': tape('landing-swim', landing, ['conch']),
        'landing-feather': tape('landing-feather', landing, ['conch', 'feather']),
        'water-swim': tape('water-swim', water, ['conch']),
        'water-feather': tape('water-feather', water, ['conch', 'feather']),
    };
}

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const levels = [...new Set(ticks.map((o) => o.level))];
    const in89 = ticks.filter((o) => o.level === 89);
    const minY = in89.length ? Math.min(...in89.map((o) => o.y)) : null;
    const start = in89[0] ?? null;
    return {
        levels,
        reachedDoor: levels.includes(DOOR_TO),
        startY: start?.y ?? null,
        minY89: minY,
        // How far the player's box top stayed below the door's bottom edge (<= 0: touching).
        gapPx: minY === null ? null : +(minY - 2 - DOOR_BOTTOM).toFixed(2),
        maxY89: in89.length ? Math.max(...in89.map((o) => o.y)) : null,
        hits: status?.hits ?? null,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape: the Feather tapes take the door, every Swim-only tape does not. */
export function expectL89(name, r) {
    if (name.endsWith('-feather')) return r.reachedDoor;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l89-waterfall.mjs', kind: 'browser' });
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
        for (const [name, raw] of Object.entries(l89Tapes()).flatMap((e) => Array(repeat).fill(e))) {
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
            const what = name.endsWith('-feather')
                ? 'with the Feather the player climbs the fall and out_teleporter_208_0 takes them into L91'
                : 'with NO feather the fall pushes the player down and the door is never touched';
            check(`${name}: ${what}`, expectL89(name, read),
                JSON.stringify({ levels: read.levels, startY: read.startY, minY89: read.minY89, gapPx: read.gapPx, final: read.final }));
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
