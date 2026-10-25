#!/usr/bin/env node
/**
 * Seedling's L52 → L55 WAY IN, ON THE GAME (slice rules-l55-waterfall): does taking `bosskey@40,88` (keyType 3,
 * "Level 055 - Boss Key 3") need the FEATHER when L52 is entered from below?
 *
 * L52 is all water (no dry floor), split by three waterfalls (`waterfall` tiles, `dirs: {N: hasFeather}`) into a TOP
 * pool (the L54 door and its arrival), a MIDDLE pool (the L55 door at tile [0,3] and its arrival) and a BOTTOM pool
 * (the L51 / L56 doors and their arrivals). On a waterfall `Player.input()` adds `v.y += waterfallAcceleration`
 * (0.8) every update unless `hasFeather && v.y < 0` (`Player.as:1557`), so a fall is one-way DOWN without the
 * Feather. The shipped rules price `level_52 -> level_55` at Swim alone and the key `True_`.
 *
 * Tapes, each on a FRESH page on the DELIVERED set, `noHazards` EMPTY (the water and the waterfall are the subject):
 *   bottom-swim     boots on the L51 arrival (16,112), Conch only: up the col 3-4 waterfall — stalls on its face, no key
 *   bottom-feather  the same inputs with Conch + Feather: climbs it, takes the L55 door and the key
 *   top-swim        boots on the L54 arrival (112,16), Conch only: DOWN the col-5 waterfall, the L55 door, the key —
 *                   the Feather-free way in, so a fix that charged the Feather on every way would be TOO TIGHT
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l55-waterfall.mjs [--host=http://localhost:8000] [--only=top-swim,…] [--repeat=N] [--dump]
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
/** Boss Key 3's slot in `save.keys` (`bosskey@40,88`, keyType 3). */
export const KEY_SLOT = 3;

const spans = (list) => {
    let t = 0;
    return list.map(([key, n]) => { const s = { key, from: t, to: t + n }; t += n; return s; });
};
const total = (list) => list.reduce((a, [, n]) => a + n, 0);
/** Idle ticks after the last span: the key's pickup ceremony lands inside them. */
const SETTLE = 60;

/** The tapes. Exported for the unit rows. */
export function l55Tapes() {
    const base = {
        tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [], persistence: [], equips: [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
    };
    // From the L51 arrival: east to the col 3-4 waterfall, north up it into the middle pool, west into the L55
    // door; in L55, south-east onto the island that holds the key.
    const fromBottom = [['right', 90], ['up', 160], ['left', 280], ['down', 80], ['right', 50]];
    // From the L54 arrival: west to col 5, south down the col-5 waterfall into the middle pool, west into the door.
    const fromTop = [['left', 70], ['down', 60], ['left', 280], ['down', 80], ['right', 50]];
    const tape = (name, boot, items, list) => ({
        ...base, name: `l55-waterfall-${name}`, description: `probe-seedling-l55-waterfall: ${name}`,
        boot, grants: [{ level: 52, items }], tick_count: total(list) + SETTLE, inputs: spans(list),
    });
    return {
        'bottom-swim': tape('bottom-swim', { level: 52, x: 16, y: 112 }, ['conch'], fromBottom),
        'bottom-feather': tape('bottom-feather', { level: 52, x: 16, y: 112 }, ['conch', 'feather'], fromBottom),
        'top-swim': tape('top-swim', { level: 52, x: 112, y: 16 }, ['conch'], fromTop),
    };
}

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const levels = [...new Set(ticks.map((o) => o.level))];
    return {
        key3: status?.save?.keys?.[KEY_SLOT] ?? null,
        levels,
        reached55: levels.includes(55),
        minY52: (() => { const in52 = ticks.filter((o) => o.level === 52); return in52.length ? Math.min(...in52.map((o) => o.y)) : null; })(),
        hits: status?.hits ?? null,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape. */
export function expectL55(name, r) {
    if (name === 'bottom-swim') return r.key3 !== true && !r.reached55;
    return r.key3 === true && r.reached55;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l55-waterfall.mjs', kind: 'browser' });
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
        for (const [name, raw] of Object.entries(l55Tapes()).flatMap((e) => Array(repeat).fill(e))) {
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
            const what = name === 'bottom-swim'
                ? 'with NO feather the bottom pool cannot climb into the middle one: L55 is never entered and key 3 is not held'
                : 'the L55 door is reached and key 3 is taken';
            check(`${name}: ${what}`, expectL55(name, read),
                JSON.stringify({ key3: read.key3, levels: read.levels, minY52: read.minY52, final: read.final }));
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
