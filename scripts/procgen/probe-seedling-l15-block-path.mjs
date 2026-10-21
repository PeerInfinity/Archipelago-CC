#!/usr/bin/env node
/**
 * Seedling's L15 BLOCK PATH, ON THE GAME (rules `rules-block-path`). ⚖ The user (2026-10-20): "Level 15 requires the
 * sword to break the blocks. Then the block can be pushed onto the button to open the lock and reach the stairs." and
 * "For L15, crossing the water tiles is an alternate path". The rules now price `level_15__r1c5 -> level_15__r1c9` as
 * Or(Progressive Sword, Ghost Spear, Progressive Swim) (`seedlingBlockPaths.js`); these tapes put each half to the game.
 *
 * Four tapes, each on a FRESH page, all from `fixtures/tapes/r9-solve-15.json`'s staging (boot L15 (48,64), the L14
 * arrival; its `seam.items` edited, nothing else):
 *   with-sword   the campaign's own L15 solve, as recorded: both rocks broken ({15,2}, {15,3}), the block shoved onto
 *                `button@112,32`, `lock@128,48` opened ({15,0}), L15 → L16 by `stairsdown@144,16`
 *   no-weapon    the same inputs with `hasSword` false (no Spear, no Conch): no rock breaks, and the player stays in L15
 *   button-hold  boot ON the button (112,32), no items; stand 120 ticks (the lock's fade is 101), then walk for the
 *                lock: the button is DIAGONAL to it, so the player never reaches the lock's tile (x stays < 128)
 *   swim         the Conch only (`canSwim`), no weapon: down into the water, east along it, north at column 8 and
 *                east into the arrival column at row 5 (round `chest@144,96`, a Solid on the game that the model
 *                walks through — its first cut went straight up column 9 and stopped under the chest), then north
 *                to the stairs — L15 → L16 with both rocks and the lock standing
 *
 * The model replays each tape as a row (the same expectations were measured on it first).
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l15-block-path.mjs [--host=http://localhost:8000] [--out=<dir>] [--only=swim,…]
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
const SOURCE_TAPE = 'frontend/modules/seedlingDemo/fixtures/tapes/r9-solve-15.json';
/** The lock's west face: a player held west of `lock@128,48` never reports x >= 128. */
export const LOCK_WEST_FACE = 128;
/** The forward trip's clears: the lock (tag 0) and both rocks (tags 2, 3). */
export const ROCK_CLEARS = Object.freeze(['15,2', '15,3']);
export const LOCK_CLEAR = '15,0';

/** The four tapes, derived from the source tape. Exported for the unit rows. */
export function l15Tapes(source) {
    const items = (over) => ({ ...source.seam.items, hasSword: false, hasSpear: false, canSwim: false, ...over });
    const tape = (name, over) => ({ ...source, name: `l15-block-path-${name}`, description: `probe-seedling-l15-block-path: ${name}`, ...over });
    return {
        'with-sword': tape('with-sword', {}),
        'no-weapon': tape('no-weapon', { seam: { ...source.seam, items: items({}) } }),
        'button-hold': tape('button-hold', {
            boot: { level: 15, x: 112, y: 32 }, seam: { ...source.seam, items: items({}) }, tick_count: 260,
            inputs: [{ key: 'right', from: 120, to: 160 }, { key: 'down', from: 120, to: 160 },
                { key: 'down', from: 160, to: 200 }, { key: 'right', from: 200, to: 260 }],
        }),
        swim: tape('swim', {
            seam: { ...source.seam, items: items({ canSwim: true }) }, tick_count: 520,
            inputs: [{ key: 'down', from: 0, to: 80 }, { key: 'right', from: 80, to: Number(process.env.SWIM_R1 ?? 170) },
                { key: 'up', from: Number(process.env.SWIM_R1 ?? 170), to: Number(process.env.SWIM_U1 ?? 230) },
                { key: 'right', from: Number(process.env.SWIM_U1 ?? 230), to: Number(process.env.SWIM_R2 ?? 255) },
                { key: 'up', from: Number(process.env.SWIM_R2 ?? 255), to: 520 }],
        }),
    };
}

const derivedTransitions = (ticks) => ticks.slice(1).flatMap((o, i) => (o.level === ticks[i].level ? []
    : [{ t: o.t, from: ticks[i].level, to: o.level, at: { x: o.x, y: o.y } }]));

/** What one stream says. Exported for the unit rows. */
export function readL15(ticks, cleared) {
    const transitions = derivedTransitions(ticks);
    const out = transitions.find((t) => t.from === 15 && t.to === 16) ?? null;
    const maxX = Math.max(...ticks.filter((o) => o.level === 15).map((o) => o.x));
    const clears = [...new Set(cleared.map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
    return { transitions, out, maxX, clears, final: ticks.at(-1) ?? null };
}

/** The expectation per tape, applied to the game and to the model alike. */
export function expectL15(name, r) {
    if (name === 'with-sword') return r.out !== null;
    if (name === 'no-weapon') return r.out === null && r.final?.level === 15;
    if (name === 'button-hold') return r.out === null && r.maxX < LOCK_WEST_FACE;
    return r.out !== null;
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
    const { mountedRecordsOf } = await M('wasmWalkTape.js');
    const { levelSourceFromAtlas } = await M('atlasSource.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const { runTape } = await M('tapeRunner.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    const levelSource = levelSourceFromAtlas(mountedRecordsOf(set));
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-l15-block-path.mjs', kind: 'browser' });
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
            if (await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
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
        for (const [name, raw] of Object.entries(l15Tapes(readJson(SOURCE_TAPE)))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readL15(g.ticks, g.status.persistence_cleared ?? []);
            let model;
            try {
                const m = readL15(runTape(tape, { levelSource }).ticks, []);
                model = { refused: null, transitions: m.transitions, maxX: m.maxX, final: m.final, agrees: expectL15(name, m) };
            } catch (e) {
                model = { refused: e.message.split('\n')[0] };
            }
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length, ...read, model };
            rows.push(row);
            console.log(`ROW ${JSON.stringify(row)}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const rocks = ROCK_CLEARS.every((c) => read.clears.includes(c));
            if (name === 'with-sword') {
                check(`${name}: both rocks break, the lock opens, and L15 → L16`,
                    expectL15(name, read) && rocks && read.clears.includes(LOCK_CLEAR), JSON.stringify({ out: read.out, clears: read.clears }));
            } else if (name === 'no-weapon') {
                check(`${name}: no rock breaks and the player stays in L15`,
                    expectL15(name, read) && !ROCK_CLEARS.some((c) => read.clears.includes(c)), JSON.stringify({ final: read.final, clears: read.clears }));
            } else if (name === 'button-hold') {
                check(`${name}: held 120 ticks on the DIAGONAL button, the player never reaches the lock (max x < ${LOCK_WEST_FACE})`,
                    expectL15(name, read), JSON.stringify({ maxX: read.maxX, final: read.final }));
            } else {
                check(`${name}: with the Conch and no weapon, L15 → L16 by the water, rocks standing`,
                    expectL15(name, read) && !ROCK_CLEARS.some((c) => read.clears.includes(c)), JSON.stringify({ out: read.out, clears: read.clears }));
            }
            check(`${name}: the model agrees`, model.agrees === true, JSON.stringify(model.refused ?? model.final));
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (OUT) {
        mkdirSync(OUT, { recursive: true });
        for (const r of rows) writeFileSync(join(OUT, `l15-block-path-${r.tape}.json`), `${JSON.stringify(r, null, 1)}\n`);
        console.log(`wrote ${rows.length} witness file(s) to ${OUT}`);
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
