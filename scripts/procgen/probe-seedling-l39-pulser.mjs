#!/usr/bin/env node
/**
 * Seedling's L39 PULSER and ROPE SPAN, ON THE GAME (rules `rules-l39`). `rope@96,384` (tset 6, tag 9) arms
 * `pulser@64,96` (tset 6): `RopeStart.set activate` publishes the rope's group (`RopeStart.as:79-91`) and a Pulser
 * pulses only while `activate` (`Pulser.as:54-84`); on every later entry `check()` re-hits the rope from its cleared
 * tag (`RopeStart.as:31-38`). An UNCUT rope is solid over its whole run — its hitbox is `_xend - _x + 16` wide
 * (`RopeStart.as:26`, the far end = the LAST node, `Game.as:2419-2427`) and "Rope" is in `Mobile.solids`
 * (`Mobile.as:17`); a cut shrinks it to the pulley tile (`:40-47`). L39's run crosses the col-9 corridor at (9,24).
 *
 * Tapes, each on a FRESH page, built on `fixtures/tapes/r9-solve-16.json`'s staging (its `seam`, `save` and `rng`;
 * boot, persistence, inputs and items replaced; `tick0` dropped):
 *   pulse-armed     boot beside the pulser (west side), NO items, `{39,9}` staged (the cut): the pulses hit the player
 *   pulse-control   the same with nothing staged: the pulser never pulses, no hit
 *   span-blocked    boot in the corridor south of the rope (row 27), no items, nothing staged, walk north: the uncut
 *                   rope's run stops the walk south of it (y >= SPAN_BOTTOM)
 *   span-cut        the same with `{39,9}` staged: the run is gone, only the pulley (6,24) stays; the walk passes north
 *   span-slash      the same walk with the SWORD, slashing north at the rope from the corridor: the cut clears {39,9}
 *   chain-armed     boot at (9,6), NO items, `{39,9}` staged, walk north for 300 ticks: an armed pulser opens nothing
 *                   of the chain — no fire block starts within its reach, so the walk stops under wandlock@144,64
 *   l43-open        ⚖ `l43-fallrock-removed` (the user, 2026-10-22): boot in L43's arena at (11,22), no items, with
 *                   {43,1} {43,2} {43,3} cleared — the state the Wand leaves (`Wand.as:53-68`; the rocks are built fallen,
 *                   `FallRock.as:42-47`) — and walk south: on the DELIVERED set the doorway (11,24) stays open and the
 *                   walk takes `stairsup@176,464` → L40
 *   l43-control     the same on the set WITHOUT that row (the pre-L43 delivery): the fallen doorway rock stops the walk
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l39-pulser.mjs [--host=http://localhost:8000] [--out=<dir>] [--only=span-cut,…] [--dump]
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SOURCE_TAPE = 'frontend/modules/seedlingDemo/fixtures/tapes/r9-solve-16.json';
/** The rope run's bottom edge (row 24): a walk from the south whose top stays at or below it never crossed. */
export const SPAN_TOP = 384;
export const SPAN_BOTTOM = 400;
/** `wandlock@144,64`'s bottom edge: the chain's first lock. */
export const CHAIN_BOTTOM = 80;
export const L39_ROPE = '39,9';
/** L43's doorway rock (11,24): a walk from the arena that never passes its top edge was stopped by it. */
export const L43_DOORWAY_TOP = 384;

/** The tapes, derived from the source tape. Exported for the unit rows. */
export function l39Tapes(source) {
    const none = Object.fromEntries(Object.keys(source.seam.items).map((k) => [k, false]));
    const tape = (name, over) => {
        const { tick0: _drop, ...rest } = source;
        return { ...rest, name: `l39-pulser-${name}`, description: `probe-seedling-l39-pulser: ${name}`, ...over };
    };
    const seam = (items) => ({ ...source.seam, items: { ...none, ...items } });
    const cut = [{ level: 39, tag: 9, note: '' }];
    const north = (n) => [{ key: 'up', from: 0, to: n }];
    const south = (n) => [{ key: 'down', from: 0, to: n }];
    const wandRocks = [1, 2, 3].map((tag) => ({ level: 43, tag, note: '' }));
    const PX = Number(process.env.L39_PX ?? 82);
    const PY = Number(process.env.L39_PY ?? 100);
    const corridor = { level: 39, x: 148, y: 440 };
    return {
        'pulse-armed': tape('pulse-armed', { boot: { level: 39, x: PX, y: PY }, persistence: cut, seam: seam({}), tick_count: 200, inputs: [] }),
        'pulse-control': tape('pulse-control', { boot: { level: 39, x: PX, y: PY }, persistence: [], seam: seam({}), tick_count: 200, inputs: [] }),
        'span-blocked': tape('span-blocked', { boot: corridor, persistence: [], seam: seam({}), tick_count: 160, inputs: north(160) }),
        'span-cut': tape('span-cut', { boot: corridor, persistence: cut, seam: seam({}), tick_count: 160, inputs: north(160) }),
        'span-slash': tape('span-slash', {
            boot: corridor, persistence: [], seam: seam({ hasSword: true }), tick_count: 200,
            inputs: [...north(80), ...Array.from({ length: 6 }, (_, i) => ({ key: 'primary', from: 80 + i * 12, to: 81 + i * 12 })),
                { key: 'up', from: 160, to: 200 }],
        }),
        'chain-armed': tape('chain-armed', { boot: { level: 39, x: 148, y: 100 }, persistence: cut, seam: seam({}), tick_count: 300, inputs: north(300) }),
        'l43-open': tape('l43-open', { boot: { level: 43, x: 180, y: 352 }, persistence: wandRocks, seam: seam({}), tick_count: 200, inputs: south(200) }),
        'l43-control': tape('l43-control', { boot: { level: 43, x: 180, y: 352 }, persistence: wandRocks, seam: seam({}), tick_count: 200, inputs: south(200) }),
    };
}

const derivedTransitions = (ticks) => ticks.slice(1).flatMap((o, i) => (o.level === ticks[i].level ? []
    : [{ t: o.t, from: ticks[i].level, to: o.level, at: { x: o.x, y: o.y } }]));

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const clears = [...new Set((status?.persistence_cleared ?? []).map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
    const in39 = ticks.filter((o) => o.level === 39);
    const in43 = ticks.filter((o) => o.level === 43);
    return {
        maxY43: in43.length ? Math.max(...in43.map((o) => o.y)) : null,
        transitions: derivedTransitions(ticks),
        clears,
        hits: status?.hits ?? null,
        minY39: in39.length ? Math.min(...in39.map((o) => o.y)) : null,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape. */
export function expectL39(name, r) {
    if (name === 'pulse-armed') return (r.hits ?? 0) > 0;
    if (name === 'pulse-control') return r.hits === 0;
    if (name === 'span-blocked') return r.minY39 !== null && r.minY39 >= SPAN_BOTTOM;
    if (name === 'span-cut') return r.minY39 !== null && r.minY39 < SPAN_TOP;
    if (name === 'span-slash') return r.clears.includes(L39_ROPE) && r.minY39 !== null && r.minY39 < SPAN_TOP;
    if (name === 'chain-armed') return r.minY39 !== null && r.minY39 >= CHAIN_BOTTOM && r.transitions.length === 0;
    if (name === 'l43-open') return r.transitions.some((t) => t.from === 43 && t.to === 40);
    if (name === 'l43-control') return r.maxY43 !== null && r.maxY43 < L43_DOORWAY_TOP && r.transitions.length === 0;
    return false;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const OUT = arg('out', null);
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
    const { SEEDLING_SET_PATCHES, PATCH_L43_FALLROCK_REMOVED } = await M('seedlingSetPatches.js');
    /** `l43-control`'s world: the delivery without `l43-fallrock-removed` (the pre-L43 set). */
    const preL43 = vanillaRecordSet(EMBED, MAP, { patches: SEEDLING_SET_PATCHES.filter((p) => p !== PATCH_L43_FALLROCK_REMOVED) }).set;
    const setFor = (name) => (name === 'l43-control' ? preL43 : set);
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id} · l43-control on ${preL43.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-l39-pulser.mjs', kind: 'browser' });
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
    const rows = [];
    try {
        const only = arg('only', null)?.split(',');
        for (const [name, raw] of Object.entries(l39Tapes(readJson(SOURCE_TAPE)))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape, setFor(name));
            const read = readRun(g.ticks, g.status);
            const row = { tape: name, set_id: setFor(name).set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                boot: tape.boot, persistence: tape.persistence.map((c) => `${c.level},${c.tag}`), ...read };
            rows.push(row);
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === setFor(name).set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = {
                'pulse-armed': `with {${L39_ROPE}} (the cut) the pulser pulses and hits the player beside it`,
                'pulse-control': 'the CONTROL: nothing staged, the pulser never pulses — no hit',
                'span-blocked': `the uncut rope's RUN stops a walk up the corridor at col 9 (y >= ${SPAN_BOTTOM})`,
                'span-cut': `with {${L39_ROPE}} the run is gone and the walk passes north (y < ${SPAN_TOP})`,
                'span-slash': `with the Sword a slash from the corridor cuts the rope ({${L39_ROPE}}) and the walk passes`,
                'l43-open': 'after the Wand (its three rock tags cleared) the delivered L43 doorway stays open: the walk south takes the stairs to L40',
                'l43-control': `the CONTROL, the pre-L43 set: the fallen doorway rock stops the walk (y < ${L43_DOORWAY_TOP})`,
                'chain-armed': `an armed pulser opens no chain lock with no item: the walk stops under wandlock@144,64 (y >= ${CHAIN_BOTTOM})`,
            }[name];
            check(`${name}: ${what}`, expectL39(name, read),
                JSON.stringify({ clears: read.clears, hits: read.hits, minY39: read.minY39, maxY43: read.maxY43, final: read.final, transitions: read.transitions }));
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (OUT) {
        mkdirSync(OUT, { recursive: true });
        for (const r of rows) writeFileSync(join(OUT, `l39-pulser-${r.tape}.json`), `${JSON.stringify(r, null, 1)}\n`);
        console.log(`wrote ${rows.length} witness file(s) to ${OUT}`);
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
