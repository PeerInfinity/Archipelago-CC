#!/usr/bin/env node
/**
 * Seedling's L15 CHEST PROBE LINE, ON THE GAME (fidelity L1516 D1/D2, `CONTACT_FIDELITY.chestProbeLineEnd`).
 *
 * `Chest.update` opens on `FP.world.collideLine("Player", px+2, py+17, px+12, py+17)` (`Chest.as:63`), and
 * `World.collideLine` at precision 1 walks `while (x < toX)` and tests the end point only when `precision > 1`
 * (`World.as:442`, `:514`): the probes are px+2 .. px+11. The model's `chestProbeLine` carried `x1 = px+12`, read
 * inclusive by `keyLineTouches`, so a player box whose left edge sits in (px+11, px+12] opened the chest in the model
 * and not on the game. rules-2's first L15 swim cut (`probe-seedling-l15-block-path.mjs`, CI run 39536585514) climbed
 * column 9 and STOPPED at (157.98, 114.24) under `chest@144,96`; the model walked through it.
 *
 * Two tapes, each on a FRESH page, both from `fixtures/tapes/r9-solve-15.json`'s staging (boot L15 (48,64)) with the
 * Conch only (`canSwim`, no weapon), the block-path swim arm's items: down into the water, east along row 7, then up
 * column 9 into the chest from below.
 *   edge    east until the wall (x ≈ 158, box left ≈ 156): no probe inside the box. The chest stays Solid and the
 *           player stops under it; {15,1} stays set.
 *   inner   east 4 ticks less (x ≈ 152): probes inside the box. The chest opens ({15,1} cleared) on both sides — the
 *           control that the line is live at all.
 *
 * Each tape is replayed on the model with the switch OFF and ON; the ON stream is compared to the game's tick by tick.
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l15-chest-line.mjs [--host=http://localhost:8000] [--out=<dir>] [--only=edge,…]
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
/** `chest@144,96`'s persistence flag: set while the chest stands, cleared by `open()`. */
export const CHEST_CLEAR = '15,1';
export const CHEST_ID = 'chest@144,96';

/** The two tapes, derived from the source tape. Exported for the unit rows. */
export function chestLineTapes(source) {
    const seam = { ...source.seam, items: { ...source.seam.items, hasSword: false, hasSpear: false, canSwim: true } };
    const tape = (name, east) => ({
        ...source, name: `l15-chest-line-${name}`, description: `probe-seedling-l15-chest-line: ${name}`, seam,
        tick_count: 300,
        inputs: [{ key: 'down', from: 0, to: 80 }, { key: 'right', from: 80, to: east }, { key: 'up', from: east, to: 300 }],
    });
    return { edge: tape('edge', 190), inner: tape('inner', 186) };
}

/** The expectation per tape: did the chest open, and does the player end in L15 under it (edge) or past it (inner). */
export function expectChestLine(name, r) {
    if (name === 'edge') return !r.opened && r.final?.level === 15 && r.final.y > 112;
    return r.opened;
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

    takeBoxLockOrExit({ name: 'probe-seedling-l15-chest-line.mjs', kind: 'browser' });
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
    const { CONTACT_FIDELITY } = await M('contactFidelity.js');
    const model = (tape, on) => {
        const was = CONTACT_FIDELITY.chestProbeLineEnd;
        CONTACT_FIDELITY.chestProbeLineEnd = on;
        try {
            const r = runTape(tape, { levelSource });
            const ticks = r.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level }));
            return { ticks, opened: (r.chestOpens ?? []).some((c) => c.id === CHEST_ID), final: ticks.at(-1) };
        } finally {
            CONTACT_FIDELITY.chestProbeLineEnd = was;
        }
    };
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
        for (const [name, raw] of Object.entries(chestLineTapes(readJson(SOURCE_TAPE)))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const clears = [...new Set((g.status.persistence_cleared ?? []).map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
            const game = { opened: clears.includes(CHEST_CLEAR), final: g.ticks.at(-1) ?? null };
            const off = model(tape, false);
            const on = model(tape, true);
            const dOff = drift(off.ticks, g.ticks);
            const dOn = drift(on.ticks, g.ticks);
            const row = {
                tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length, clears, game,
                modelOff: { opened: off.opened, final: off.final, maxDrift: dOff.max, firstDrift: dOff.first },
                modelOn: { opened: on.opened, final: on.final, maxDrift: dOn.max, firstDrift: dOn.first },
            };
            rows.push(row);
            console.log(`ROW ${JSON.stringify(row)}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            check(`${name}: the game ${name === 'edge' ? 'keeps the chest Solid and stops the player under it' : 'opens the chest'}`,
                expectChestLine(name, game), JSON.stringify(game));
            check(`${name}: the model ON reproduces the game at 0 px`, dOn.max === 0 && on.opened === game.opened,
                JSON.stringify({ maxDrift: dOn.max, firstDrift: dOn.first }));
            if (name === 'edge') {
                check(`${name}: the model OFF is the gap (it opens the chest the game keeps)`, off.opened && !game.opened,
                    JSON.stringify({ off: off.opened, maxDrift: dOff.max }));
            } else {
                check(`${name}: the model OFF agrees (the control is not the gap)`, dOff.max === 0 && off.opened === game.opened,
                    JSON.stringify({ maxDrift: dOff.max }));
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
        for (const r of rows) writeFileSync(join(OUT, `l15-chest-line-${r.tape}.json`), `${JSON.stringify(r, null, 1)}\n`);
        console.log(`wrote ${rows.length} witness file(s) to ${OUT}`);
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
