#!/usr/bin/env node
/**
 * ⛓ SEEDLING FIDELITY CHESTSEAL — a chest `checkBySeal()` removed, witnessed on the game (wave 32, W0 + D1 + D2).
 *
 * `Chest`'s constructor runs `checkBySeal()` (`vendor/seedling/src/Chest.as:35`, `:47-57`): with all sixteen seal
 * parts held it writes `Game.setPersistence(tag, false)` — the AP check report (`Game.as` `pendingCheck`) — and the
 * chest is removed before the first frame the player moves in (`Chest.check()` on the first `Game.update`). This
 * probe runs L15's `chest@144,96` (tag {15,1}) twice on p4g, headless logic-only, from `r9-solve-15`'s staging:
 *
 *   `seal-edge`     the L1516 `edge` inputs (down, right until 190, up) with `save.seal_parts` = all sixteen: the
 *                   player walks UP THROUGH the chest's cell — the chest is not there — and its flag is cleared
 *                   with no `open()` (no SealPiece, no ceremony).
 *   `control-edge`  the same inputs on the source tape's own save (one seal part): the chest is Solid, the player
 *                   stops under it (L1516's `edge` row, re-measured here so the pair shares one page build).
 *
 * The model replays each tape with `CONTACT_FIDELITY.chestSealRemoval` OFF and ON and the drift is reported per arm.
 *
 * Usage: `node scripts/procgen/probe-seedling-chestseal.mjs --host=http://localhost:9741 [--out=<dir>] [--only=…]`.
 * Takes the box lock (kind `browser`).
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
/** `chest@144,96`'s persistence flag: set while the chest stands, cleared by `open()` or by `checkBySeal()`. */
export const CHEST_CLEAR = '15,1';
export const CHEST_ID = 'chest@144,96';
/** All sixteen seal parts, in collection order (`SealController.hasAllSealParts()` reads the last slot). */
export const ALL_SEALS = Object.freeze(Array.from({ length: 16 }, (_, i) => i));

/** The two tapes, derived from the source tape. Exported for the unit rows. */
export function chestSealTapes(source) {
    const seam = { ...source.seam, items: { ...source.seam.items, hasSword: false, hasSpear: false, canSwim: true } };
    const tape = (name, save) => ({
        ...source, name: `chestseal-${name}`, description: `probe-seedling-chestseal: ${name}`, seam, save,
        tick_count: 300,
        inputs: [{ key: 'down', from: 0, to: 80 }, { key: 'right', from: 80, to: 190 }, { key: 'up', from: 190, to: 300 }],
    });
    return {
        'seal-edge': tape('seal-edge', { ...source.save, seal_parts: [...ALL_SEALS] }),
        'control-edge': tape('control-edge', source.save),
    };
}

/** The chest's cell is [144,160) x [96,112); a player box above y 112 in that column walked through it. */
export const passedThroughChest = (ticks) => ticks.some((o) => o.level === 15 && o.x >= 146 && o.x <= 158 && o.y < 104);

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
    const { withContactFidelity } = await M('contactFidelity.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    const levelSource = levelSourceFromAtlas(mountedRecordsOf(set));
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-chestseal.mjs', kind: 'browser' });
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
            // The bridge's own report log, if the page declared `pendingCheck` (the host declares it; a bare page
            // may not — reported as-is, never inferred).
            const reports = await page.evaluate(() => (window.__swfBridge?.stateLog ?? [])
                .filter((r) => r.name === 'pendingCheck').map((r) => String(r.value)));
            return { status, mounted, reports, ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
        } finally {
            await page.close();
        }
    };
    const rows = [];
    const model = (tape, on) => withContactFidelity({ chestSealRemoval: on }, () => {
        const r = runTape(tape, { levelSource });
        const ticks = r.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level }));
        return { ticks, opened: (r.chestOpens ?? []).some((c) => c.id === CHEST_ID), final: ticks.at(-1) };
    });
    const drift = (a, b) => {
        let max = 0;
        let first = null;
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            const d = a[i].level !== b[i].level ? Infinity : Math.max(Math.abs(a[i].x - b[i].x), Math.abs(a[i].y - b[i].y));
            if (d > 1e-6 && first === null) first = { t: a[i].t, game: b[i], model: a[i] };
            if (d > max) max = d;
        }
        return { max, first };
    };
    try {
        const only = arg('only', null)?.split(',');
        for (const [name, raw] of Object.entries(chestSealTapes(readJson(SOURCE_TAPE)))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const clears = [...new Set((g.status.persistence_cleared ?? []).map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
            const game = {
                cleared: clears.includes(CHEST_CLEAR), through: passedThroughChest(g.ticks), final: g.ticks.at(-1) ?? null,
                pendingCheck: g.reports,
            };
            const off = model(tape, false);
            const on = model(tape, true);
            const dOff = drift(off.ticks, g.ticks);
            const dOn = drift(on.ticks, g.ticks);
            const row = {
                tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length, clears, game,
                modelOff: { opened: off.opened, through: passedThroughChest(off.ticks), final: off.final, maxDrift: dOff.max, firstDrift: dOff.first },
                modelOn: { opened: on.opened, through: passedThroughChest(on.ticks), final: on.final, maxDrift: dOn.max, firstDrift: dOn.first },
            };
            rows.push(row);
            console.log(`ROW ${JSON.stringify(row)}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            if (name === 'seal-edge') {
                check(`${name}: the game has no chest — the player walks through its cell, and {${CHEST_CLEAR}} is cleared`,
                    game.through && game.cleared, JSON.stringify(game));
                check(`${name}: the model ON reproduces the game at 0 px`, dOn.max === 0 && !on.opened,
                    JSON.stringify({ maxDrift: dOn.max, firstDrift: dOn.first }));
                check(`${name}: the model OFF is the gap (the chest stands, a Solid, under the player)`,
                    !passedThroughChest(off.ticks) && dOff.max > 0, JSON.stringify({ maxDrift: dOff.max, firstDrift: dOff.first }));
            } else {
                check(`${name}: the game keeps the chest Solid and stops the player under it`,
                    !game.through && !game.cleared && game.final?.level === 15, JSON.stringify(game));
                check(`${name}: the model OFF and ON both agree at 0 px (the control: one seal part)`,
                    dOff.max === 0 && dOn.max === 0, JSON.stringify({ off: dOff.max, on: dOn.max }));
            }
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (OUT) {
        mkdirSync(OUT, { recursive: true });
        for (const r of rows) writeFileSync(join(OUT, `chestseal-${r.tape}.json`), `${JSON.stringify(r, null, 1)}\n`);
        console.log(`wrote ${rows.length} witness file(s) to ${OUT}`);
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
