#!/usr/bin/env node
/**
 * MEASUREMENT (slice tile-primitives-whole-game-classify, branch only): Seedling's L3 door to L111
 * (`out_teleporter_0_64`, tile [0,4], under `breakablerockghost@0,64 {tag 1}`), ON THE GAME: does the player need
 * the Conch (Progressive Swim) to reach it? Its only open neighbour is [1,4], WATER (tx 32 -> `Tile(..., 1)`,
 * `Game.as:2126-2127`); [0,3]/[0,5] are tx 48 = t 2, Solid. Without `canSwim` water starts a 10-frame drown
 * countdown (`Player.as:312`, `checkDrowning` :1456-1480), so a one-tile dip MIGHT be crossed. The rules say
 * `And(Ghost Sword Fusion, Ghost Spear, Progressive Sword)` (the rock); the maze adds Swim.
 *
 * Tapes, each on a FRESH page on the DELIVERED set, `noHazards` EMPTY, the rock declared cleared (persistence {3,1})
 * so the Conch is the one variable; both boot on [2,4] (32,64) and hold LEFT:
 *   dry   no Conch — the measurement: does the player reach L111?
 *   wet   the Conch — the control: the player swims [1,4] and takes the door into L111
 *
 * Run: node scripts/procgen/probe-seedling-l3-water-door.mjs [--host=http://localhost:8000] [--only=dry,wet] [--repeat=N] [--dump]
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
export const DOOR_TO = 111;
/** Ticks holding LEFT, then idle ticks: the door's transition lands inside them. */
const HOLD = 200;
const SETTLE = 60;

/** The tapes. Exported for the unit rows. */
export function l3Tapes() {
    const tape = (name, items) => ({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: false, noHazards: [], equips: [],
        persistence: [{ level: 3, tag: 1, note: 'breakablerockghost@0,64 broken: the Conch is the one variable' }],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        name: `l3-water-door-${name}`, description: `probe-seedling-l3-water-door: ${name}`,
        boot: { level: 3, x: 32, y: 64 }, grants: items.length ? [{ level: 3, items }] : [],
        tick_count: HOLD + SETTLE, inputs: [{ key: 'left', from: 0, to: HOLD }],
    });
    return { dry: tape('dry', []), wet: tape('wet', ['conch']) };
}

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const levels = [...new Set(ticks.map((o) => o.level))];
    const in3 = ticks.filter((o) => o.level === 3);
    return {
        levels,
        reachedDoor: levels.includes(DOOR_TO),
        minX3: in3.length ? Math.min(...in3.map((o) => o.x)) : null,
        hits: status?.hits ?? null,
        final: ticks.at(-1) ?? null,
    };
}

/** The control's expectation: with the Conch the player reaches L111. The dry tape is MEASURED, not expected. */
export function expectL3(name, r) {
    return name === 'wet' ? r.reachedDoor : true;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l3-water-door.mjs', kind: 'browser' });
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
        for (const [name, raw] of Object.entries(l3Tapes()).flatMap((e) => Array(repeat).fill(e))) {
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
                dry: `MEASURED without the Conch: reachedDoor=${read.reachedDoor}`,
                wet: 'with the Conch the player swims [1,4] and out_teleporter_0_64 takes them into L111',
            }[name];
            check(`${name}: ${what}`, expectL3(name, read), JSON.stringify({ levels: read.levels, minX3: read.minX3, hits: read.hits, final: read.final }));
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
