#!/usr/bin/env node
/**
 * Seedling's ROPE CUTS, ON THE GAME (rules `rules-rope-events`). A `RopeStart` hit clears the rope's own tag and
 * publishes its tset group (`RopeStart.as:40-49,79-91`); on every later entry `check()` re-hits it from the cleared
 * tag (`:31-38`), so the group is re-published each visit. The rules make the cut a cross-visit EVENT; these tapes put
 * the two rooms it decides to the game. (L16's re-entry, with and without `{16,0}`, is fidelity F7's own probe,
 * `probe-seedling-f7-reentry.mjs`; this one adds the CUT and L28.)
 *
 * Seven tapes, each on a FRESH page, all built on `fixtures/tapes/r9-solve-16.json`'s staging (its `seam`, `save` and
 * `rng`; boot, persistence, inputs and items replaced; `tick0` dropped):
 *   l16-cut        r9-solve-16 as recorded: boot L16 at the L15 arrival (32,64) with the Sword; the solve cuts
 *                  `rope@32,16` from the west, crosses the three lanes and leaves by `stairsup@352,80` → L18 with no hit
 *   l28-cut        boot L28 at the L25 arrival (96,16) with the Sword, walk to the plateau's east end and slash east at
 *                  `rope@160,64`: the game clears the rope's `{28,0}` AND the rock's `{28,1}` (`FallRock.fall`, the
 *                  same frame), so the rock lies fallen on `button@112,240` from then on
 *   l28-fire       the same walk with FIRE alone (no Sword, no Spear), Fire's slot selected and pressed: the cut is made
 *                  (`Player.as:1032` → `genericHit` → `RopeStart.hit()`, ⚖ the user 2026-10-21 "fire should count too")
 *   l28-noitem     the CONTROL: the same walk and presses with no item cut nothing
 *   l28-cross      boot L28 at the L27 arrival (128,288), NO items, with `{28,0}` + `{28,1}` cleared (the state the
 *                  cut leaves): walk east to column 11 and north through `grasslock@176,208` — the fallen rock holds
 *                  the button on this visit, so the lock is open and the walk crosses (y < the lock's top)
 *   l28-control    the same walk with nothing cleared: the lock stands and the walk stops under it
 *   l28-rock-only  the same walk with `{28,1}` alone cleared: which tag builds the rock fallen (FallRock.as:42-47)
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-rope-events.mjs [--host=http://localhost:8000] [--out=<dir>] [--only=l28-cut,…]
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
/** `grasslock@176,208`'s top edge: a walk north of it has crossed. */
export const L28_LOCK_TOP = 208;
export const L16_ROPE = '16,0';
export const L28_ROPE = '28,0';
export const L28_ROCK = '28,1';

/** The tapes, derived from the source tape. Exported for the unit rows. */
export function ropeTapes(source) {
    const none = Object.fromEntries(Object.keys(source.seam.items).map((k) => [k, false]));
    const tape = (name, over) => {
        const { tick0: _drop, ...rest } = source;
        return { ...rest, name: `rope-events-${name}`, description: `probe-seedling-rope-events: ${name}`, ...over };
    };
    const seam = (items) => ({ ...source.seam, items: { ...none, ...items } });
    const clear = (...tags) => tags.map((t) => ({ level: 28, tag: t, note: '' }));
    const cutWalk = [{ key: 'down', from: 0, to: 41 }, { key: 'right', from: 41, to: 82 }];
    const presses = (from, n) => Array.from({ length: n }, (_, i) => ({ key: 'primary', from: from + i * 12, to: from + i * 12 + 1 }));
    const crossWalk = [{ key: 'right', from: 0, to: Number(process.env.L28_R ?? 41) },
        { key: 'up', from: Number(process.env.L28_R ?? 41), to: 260 }];
    return {
        'l16-cut': tape('l16-cut', {}),
        'l28-cut': tape('l28-cut', {
            boot: { level: 28, x: 96, y: 16 }, persistence: [], seam: seam({ hasSword: true }), tick_count: 220,
            inputs: [{ key: 'down', from: 0, to: Number(process.env.L28_D ?? 41) },
                { key: 'right', from: Number(process.env.L28_D ?? 41), to: Number(process.env.L28_E ?? 82) },
                { key: 'primary', from: Number(process.env.L28_E ?? 82), to: Number(process.env.L28_E ?? 82) + 1 },
                { key: 'primary', from: Number(process.env.L28_E ?? 82) + 8, to: Number(process.env.L28_E ?? 82) + 9 }],
        }),
        'l28-fire': tape('l28-fire', {
            boot: { level: 28, x: 96, y: 16 }, persistence: [], seam: seam({ hasFire: true }), tick_count: 220,
            equips: [{ t: 0, slot: Number(process.env.L28_FIRE_SLOT ?? 0) }], inputs: [...cutWalk, ...presses(82, 8)],
        }),
        'l28-noitem': tape('l28-noitem', {
            boot: { level: 28, x: 96, y: 16 }, persistence: [], seam: seam({}), tick_count: 220, inputs: [...cutWalk, ...presses(82, 8)],
        }),
        'l28-cross': tape('l28-cross', {
            boot: { level: 28, x: 128, y: 288 }, persistence: clear(0, 1), seam: seam({}), tick_count: 260, inputs: crossWalk,
        }),
        'l28-control': tape('l28-control', {
            boot: { level: 28, x: 128, y: 288 }, persistence: [], seam: seam({}), tick_count: 260, inputs: crossWalk,
        }),
        'l28-rock-only': tape('l28-rock-only', {
            boot: { level: 28, x: 128, y: 288 }, persistence: clear(1), seam: seam({}), tick_count: 260, inputs: crossWalk,
        }),
    };
}

const derivedTransitions = (ticks) => ticks.slice(1).flatMap((o, i) => (o.level === ticks[i].level ? []
    : [{ t: o.t, from: ticks[i].level, to: o.level, at: { x: o.x, y: o.y } }]));

/** What one run says. Exported for the unit rows. */
export function readRun(ticks, status) {
    const clears = [...new Set((status?.persistence_cleared ?? []).map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
    const in28 = ticks.filter((o) => o.level === 28);
    return {
        transitions: derivedTransitions(ticks),
        clears,
        hits: status?.hits ?? null,
        minY28: in28.length ? Math.min(...in28.map((o) => o.y)) : null,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per tape. */
export function expectRope(name, r) {
    if (name === 'l16-cut') return r.clears.includes(L16_ROPE) && r.hits === 0 && r.transitions.some((t) => t.from === 16 && t.to === 18);
    if (name === 'l28-cut' || name === 'l28-fire') return r.clears.includes(L28_ROPE) && r.clears.includes(L28_ROCK);
    if (name === 'l28-noitem') return !r.clears.includes(L28_ROPE);
    if (name === 'l28-control') return r.minY28 !== null && r.minY28 >= L28_LOCK_TOP;
    return r.minY28 !== null && r.minY28 < L28_LOCK_TOP;
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
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-rope-events.mjs', kind: 'browser' });
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
    const rows = [];
    try {
        const only = arg('only', null)?.split(',');
        for (const [name, raw] of Object.entries(ropeTapes(readJson(SOURCE_TAPE)))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.status);
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                boot: tape.boot, persistence: tape.persistence.map((c) => `${c.level},${c.tag}`), ...read };
            rows.push(row);
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const what = {
                'l16-cut': `the cut from the L15 side clears {${L16_ROPE}}, and the walk crosses the lanes to L18 with no hit`,
                'l28-cut': `the cut clears the rope {${L28_ROPE}} and the rock {${L28_ROCK}} together`,
                'l28-fire': `with FIRE alone (no Sword, no Spear) the same cut clears {${L28_ROPE}} and {${L28_ROCK}} (Player.as:1032)`,
                'l28-noitem': `the CONTROL: the same walk and presses with no item cut nothing`,
                'l28-cross': `on a later visit (both tags cleared, no items) the fallen rock holds the button: north of the lock (y < ${L28_LOCK_TOP})`,
                'l28-control': `with nothing cleared the lock stands: the walk stays at y >= ${L28_LOCK_TOP}`,
                'l28-rock-only': `{${L28_ROCK}} alone builds the rock fallen: north of the lock (y < ${L28_LOCK_TOP})`,
            }[name];
            check(`${name}: ${what}`, expectRope(name, read),
                JSON.stringify({ clears: read.clears, hits: read.hits, minY28: read.minY28, final: read.final, transitions: read.transitions }));
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (OUT) {
        mkdirSync(OUT, { recursive: true });
        for (const r of rows) writeFileSync(join(OUT, `rope-events-${r.tape}.json`), `${JSON.stringify(r, null, 1)}\n`);
        console.log(`wrote ${rows.length} witness file(s) to ${OUT}`);
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
