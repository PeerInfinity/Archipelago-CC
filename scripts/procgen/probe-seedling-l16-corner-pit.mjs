#!/usr/bin/env node
/**
 * Seedling's L16 ENCLOSED PIT, ON THE GAME (fidelity L1516 D3, sweep leg 206 `level_16__r1c1 <- in_L15_144_16 ->
 * exit:out_pit_8_3`).
 *
 * L16's pit cluster is seven Pit tiles, (12..14, 3..4) and (13,5); the exit `out_pit_8_3` is the CENTRE, (13,4), and
 * all four of its orthogonal neighbours are pits. `Player.getState` samples ONE point per tick,
 * `nearestToPoint("Tile", x, y + checkOffsetY)` (`Player.as:679`, the cell containing (x, y+1)), and the fall starts
 * on the first tick that point reads Pit (`set state`, `Player.as:720-724`; `fallInPitPos` is that cell, the lerp
 * aims at its centre, `checkFallingInPit`). A diagonal step moves both axes in one tick, so the point can jump the
 * corner (224,80) from the floor cell (14,5) straight into (13,4) without ever reading (13,5) or (14,4).
 *
 * Tapes, each on a FRESH page, from `fixtures/tapes/r9-solve-15.json`'s staging (its seam, the Sword) booted in L16:
 *   corner     boot (232,88) — the player stands at (240,96) in (14,5) — and hold up+left: the probe point crosses
 *              the corner between two ticks and the player falls into (13,4), the lerp ending at (216,72)
 *   control    boot (232,88), hold up 8 ticks then up+left: the point reads (14,4) first, a neighbour pit
 *   solve      `fixtures/l1516-witness/l16-corner-pit-solve.tape.json`: leg 206's goal (`out_pit_8_3`) SOLVED by the
 *              solver with `CONTACT_FIDELITY.enclosedPitCorner` ON from the leg's arrival (L16 (32,64), the Sword),
 *              335 ticks: the walk to the corner stance in (12,5), then the corner step into (13,4)
 *
 * The model replays each tape; its stream is compared to the game's tick by tick. Prints `PASS:`/`FAIL:` rows,
 * `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l16-corner-pit.mjs [--host=http://localhost:8000] [--out=<dir>] [--only=corner,…]
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
const SOLVE_TAPE = 'frontend/modules/seedlingDemo/fixtures/l1516-witness/l16-corner-pit-solve.tape.json';
/** The pit's centre: `checkFallingInPit` lerps the player here. */
export const PIT_CENTRE = Object.freeze({ x: 216, y: 72 });

/** The tapes, derived from the source tape. Exported for the unit rows. */
export function cornerPitTapes(source) {
    const tape = (name, inputs) => ({
        ...source, name: `l16-corner-pit-${name}`, description: `probe-seedling-l16-corner-pit: ${name}`,
        boot: { level: 16, x: 232, y: 88 }, tick_count: 60, inputs,
    });
    return {
        corner: tape('corner', [{ key: 'up', from: 0, to: 60 }, { key: 'left', from: 0, to: 60 }]),
        control: tape('control', [{ key: 'up', from: 0, to: 60 }, { key: 'left', from: 8, to: 60 }]),
        solve: JSON.parse(readFileSync(join(REPO, SOLVE_TAPE), 'utf8')),
    };
}

/** The last L16 tick, where the fall's lerp has carried the player: the centre of the pit it fell into. */
export function fallPitOf(ticks) {
    const l16 = ticks.filter((o) => o.level === 16);
    const last = l16.at(-1);
    return last ? { tx: Math.floor(last.x / 16), ty: Math.floor(last.y / 16), at: { x: last.x, y: last.y } } : null;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l16-corner-pit.mjs', kind: 'browser' });
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
    const drift = (a, b) => {
        let max = 0;
        let first = null;
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const d = !a[i] || !b[i] || a[i].level !== b[i].level ? Infinity
                : Math.max(Math.abs(a[i].x - b[i].x), Math.abs(a[i].y - b[i].y));
            if (d > 1e-9 && first === null) first = { t: (a[i] ?? b[i]).t, game: b[i] ?? null, model: a[i] ?? null };
            if (d > max) max = d;
        }
        return { max: Number.isFinite(max) ? max : 'level-or-length', first };
    };
    try {
        const only = arg('only', null)?.split(',');
        for (const [name, raw] of Object.entries(cornerPitTapes(readJson(SOURCE_TAPE)))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const m = runTape(tape, { levelSource }).ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level }));
            const game = { pit: fallPitOf(g.ticks), final: g.ticks.at(-1) ?? null };
            const model = { pit: fallPitOf(m), final: m.at(-1) ?? null, ...drift(m, g.ticks) };
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length, game, model };
            rows.push(row);
            console.log(`ROW ${JSON.stringify(row)}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            const want = name === 'control' ? { tx: 14, ty: 4 } : { tx: 13, ty: 4 };
            check(`${name}: the game falls into (${want.tx},${want.ty}) and lands in L17`,
                game.pit?.tx === want.tx && game.pit?.ty === want.ty && game.final?.level === 17, JSON.stringify(game));
            check(`${name}: the model reproduces the game at 0 px`, model.max === 0, JSON.stringify({ max: model.max, first: model.first }));
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (OUT) {
        mkdirSync(OUT, { recursive: true });
        for (const r of rows) writeFileSync(join(OUT, `l16-corner-pit-${r.tape}.json`), `${JSON.stringify(r, null, 1)}\n`);
        console.log(`wrote ${rows.length} witness file(s) to ${OUT}`);
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
