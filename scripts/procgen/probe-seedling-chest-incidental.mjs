#!/usr/bin/env node
/**
 * ⛓ SEEDLING HAMMER CHEST-INCIDENTAL — two chests opened on ONE visit, witnessed on the game (W0's game witness).
 * A hand-built 10x10 room (`chestIncidentalRoom`: chest A at tile (4,3) tag 1, chest B at (6,3) tag 2, the boot at
 * (1,8)) is delivered as a one-room set; the solver's own tape for the goal list [A, B] — solved with
 * `CHEST_LEG_DELTA` ON, because OFF the second chest leg refuses ("A chest the leg did not name …") and there is no
 * tape — is played on the headless game (default build p4g, logic-only). The probe asks the game:
 *   · BOTH chests open on the one visit: the game's `persistence_cleared` holds {0,1} and {0,2} (`Chest.open()`
 *     clears its tag), so chest A is still open — its tag still cleared — while leg 2 opens B. That is the fact the
 *     OFF check misreads: the visit's open set keeps A, so `{A, B}` against `{B}` is not an unnamed open.
 *   · the model's stream is the game's at 0 px over the whole tape, and the model's `chestOpens` ledger names the
 *     same two chests (each opened once, A before B).
 * Usage: `node scripts/procgen/probe-seedling-chest-incidental.mjs --host=http://localhost:8000 [--out=<dir>]`.
 * `--tape-only` prints the witness tape's summary (no browser, no lock). Takes the box lock (kind `browser`).
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));

/** The two chests, as tiles and tags. Exported for the unit rows. */
export const CHEST_A = Object.freeze({ tx: 4, ty: 3, tag: 1 });
export const CHEST_B = Object.freeze({ tx: 6, ty: 3, tag: 2 });
export const BOOT = Object.freeze({ tx: 1, ty: 8 });

/**
 * The witness: the room, delivered as a one-room set, its mounted record, and the solver's tape for [A, B] with
 * `CHEST_LEG_DELTA` ON. Pure (no browser). Exported so `hammerChestIncidental.test.js` rebuilds the same tape.
 */
export async function chestIncidentalWitness() {
    const { emptyLevel, oelAtTile, withEntities, bootAtTile } = await M('procgenLevel.js');
    const { DEFAULT_BUDGET, bootStaging, collectGoal, solve } = await M('procgenOracle.js');
    const { PRE_SWORD_ITEMS } = await M('procgenPalette.js');
    const { buildLevelSet } = await M('levelSetExporter.js');
    const { mountedRecordsOf } = await M('wasmWalkTape.js');
    const { withChestLegDelta } = await M('chestLegDelta.js');
    const ent = (type, { tx, ty, tag }) => ({ type, ...oelAtTile(tx, ty), attrs: { tag: String(tag) } });
    const room = withEntities(emptyLevel({ level: 900 }), [ent('chest', CHEST_A), ent('chest', CHEST_B)]);
    const { set } = buildLevelSet([{ record: room, name: 'chest-incidental', seed: 0 }], {
        setId: 'chest-incidental-witness', generator: 'scripts/procgen/probe-seedling-chest-incidental.mjs',
        provenance: { room: 'two chests, (4,3) tag 1 and (6,3) tag 2' },
    });
    const records = mountedRecordsOf(set);
    const record = records.get(0) ?? [...records.values()][0];
    const staging = bootStaging({ boot: bootAtTile(record, BOOT.tx, BOOT.ty), items: PRE_SWORD_ITEMS });
    const goal = (c) => { const o = oelAtTile(c.tx, c.ty); return collectGoal(o.x, o.y); };
    const solved = withChestLegDelta(true, () => solve(record, staging, [goal(CHEST_A), goal(CHEST_B)], DEFAULT_BUDGET,
        { name: 'chest-incidental' }));
    return { set, records, record, staging, solved };
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const OUT = arg('out', null);
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const { levelSourceFromAtlas } = await M('atlasSource.js');
    const { runTape } = await M('tapeRunner.js');
    const { gameVisibleTape } = await M('tapeFormat.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');

    const { set, records, solved } = await chestIncidentalWitness();
    if (solved.verdict !== 'SOLVED' || !solved.tape) {
        console.log(`FAIL: the witness room does not solve ON — ${solved.verdict}: ${String(solved.reasonText ?? '').slice(0, 300)}`);
        process.exit(1);
    }
    const tape = solved.tape;
    const levelSource = levelSourceFromAtlas(records);
    const modelRun = runTape(tape, { levelSource });
    const model = {
        ticks: modelRun.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })),
        chestOpens: (modelRun.chestOpens ?? []).map((c) => ({ t: c.t, id: c.id, persistTag: c.persistTag })),
    };
    const chestRecords = (solved.records ?? []).filter((r) => r.strategy === 'chest')
        .map((r) => ({ id: r.chest.id, openedAt: r.openedAt, ...(r.openBefore ? { openBefore: r.openBefore } : {}) }));
    console.log(`TAPE: ${tape.tick_count} ticks · boot ${JSON.stringify(tape.boot)} · model chestOpens `
        + `${JSON.stringify(model.chestOpens)} · chest records ${JSON.stringify(chestRecords)}`);
    if (process.argv.includes('--tape-only')) process.exit(0);
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) {
        console.log(`SKIP: no wasm artifact ${PAGE}`);
        process.exit(0);
    }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-chest-incidental.mjs', kind: 'browser' });
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
    let row = null;
    let gameTicks = [];
    try {
        const page = await browser.newPage();
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
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
        await page.close();
        const ticks = (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level }));
        gameTicks = ticks;
        const clears = [...new Set((status.persistence_cleared ?? []).map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
        let maxDrift = 0;
        let firstDrift = null;
        for (let i = 0; i < Math.min(ticks.length, model.ticks.length); i++) {
            const a = model.ticks[i];
            const b = ticks[i];
            const d = a.level !== b.level ? Infinity : Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
            if (d > 1e-6 && firstDrift === null) firstDrift = { t: a.t, game: b, model: a };
            if (d > maxDrift) maxDrift = d;
        }
        row = {
            set_id: set.set_id, mounted: mounted?.active, page: PAGE, tick_count: tape.tick_count,
            observations: ticks.length, clears, model: { chestOpens: model.chestOpens }, chestRecords,
            maxDrift, firstDrift, final: { game: ticks.at(-1) ?? null, model: model.ticks.at(-1) ?? null },
        };
        console.log(`ROW ${JSON.stringify(row)}`);
        check('the game ran the solver\'s tape to its end on the delivered set',
            ticks.length === tape.tick_count + 1 && mounted?.active === set.set_id, `${ticks.length} obs, ${mounted?.active}`);
        check(`the game opened BOTH chests on the one visit: {0,${CHEST_A.tag}} and {0,${CHEST_B.tag}} cleared`,
            clears.includes(`0,${CHEST_A.tag}`) && clears.includes(`0,${CHEST_B.tag}`), JSON.stringify(clears));
        check('the model\'s chestOpens names the same two chests, A then B, each once',
            model.chestOpens.length === 2 && model.chestOpens[0].persistTag === CHEST_A.tag
            && model.chestOpens[1].persistTag === CHEST_B.tag, JSON.stringify(model.chestOpens));
        check('the model reproduces the game at 0 px over the whole tape', maxDrift === 0,
            JSON.stringify({ maxDrift, firstDrift }));
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (OUT && row) {
        mkdirSync(OUT, { recursive: true });
        // ⛓ the game's own stream rides in the file (not the ROW line): `[t, x, y, level]` per observation, the
        // replay row in `hammerChestIncidental.test.js` holds the model to it at 0 px.
        writeFileSync(join(OUT, 'chest-incidental-game.json'), `${JSON.stringify({ ...row,
            gameTicks: gameTicks.map((o) => [o.t, o.x, o.y, o.level]) })}\n`);
        console.log(`wrote the witness row to ${OUT}`);
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
