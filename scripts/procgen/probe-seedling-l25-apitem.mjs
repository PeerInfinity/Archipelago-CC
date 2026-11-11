#!/usr/bin/env node
/**
 * Seedling's L25 AP CHEST, ON THE GAME (fidelity L25APITEM D1, `CONTACT_FIDELITY.apChestItem`).
 *
 * The randomizer delivers every playthrough location as an `<apitem>` (`seedlingRandomizerWiring`: `vanillaRecordSet`
 * → `buildPlacementTable` → `rewriteRecordSet`), so `Level 025 - Chest` is a NON-SOLID `Pickups/APItem`
 * (`APItem.as:114-115`, 8×8 at the cell's centre) taken on overlap from any side (`Pickup.as:78`), where the vanilla
 * `chest@96,96` is a Solid opened only from the line one pixel under its body (`Chest.as:63`). The tape is the route
 * survey's step-34 solve with the key ON (`fidelityL25ApItem.L25_TAPE`): it walks in from the NORTH-EAST, never
 * stands under the chest, and takes it inside the chest's own cell.
 *
 * Four arms, each on a FRESH page, from the same tape (`fidelityL25ApItem` is the one derivation):
 *   DELIVERED  the whole tape on the delivered set: L25 → L22; the model's replay on the same rooms, 0 px.
 *   TAKE       cut at `takenAt + 1` ticks, `hold`: `{25,0}` is cleared (the apitem's `removed()`).
 *   BEFORE     cut at `takenAt` ticks, `hold`: it is NOT. TAKE/BEFORE bracket the take on the model's tick.
 *   VANILLA    the whole tape on the VANILLA set (the control): the chest stays Solid, `{25,0}` stays set, and the
 *              model's replay on the vanilla rooms (the bottom-line rule) is the game's at 0 px too.
 *
 * `--through` (slice rules-chest-open-side, a REPORT, no rule reads it) plays ONE more tape INSTEAD of the four arms:
 * from the same boot (L22's landing), a waypoint walk on the model (`throughKeys`) to the tile east of the chest's
 * cell, west into the cell, and down the corridor to L28's door. On the DELIVERED set the game takes the apitem and
 * leaves by L28's door (the cell is no Solid from L22's side); on the VANILLA set the same keys stay in L25 with
 * `{25,0}` set (the Chest is a Solid there, opened from the line under it only).
 *
 * `--record` writes `fixtures/l25apitem-witness/oracle.json` (what `fidelityL25ApItem.test.js` holds the model to).
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000; or `SEEDLING_PORT`); the wasm
 * build, or SKIP. Takes the box lock. Headless LOGIC-ONLY.
 *
 * Run: SEEDLING_PORT=9777 node scripts/procgen/probe-seedling-l25-apitem.mjs [--host=…] [--record] [--through]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/**
 * `--through`: the keys of a walk from the tape's boot THROUGH the chest's cell and on down its column, chosen on the
 * model over `levelSource` (the game is the judge). The way is read off the room: the tile east of the chest's cell
 * (reached along the boot's row first), the cell itself, then the room's last row under it. Ends when the model
 * leaves the level, or after `limit` ticks per waypoint.
 * @returns {Promise<{perTick: string[][], model: {level:number, x:number, y:number}}>}
 */
export async function throughKeys(tape, levelSource, room, { tile = 16, lead = 30, limit = 400, tail = 30 } = {}) {
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { createRunForStaging, stagingFromTape } = await M('tapeRunner.js');
    const cell = room.entities.filter((e) => e.type === 'chest' || e.type === 'apitem');
    if (cell.length !== 1) throw new Error(`probe-seedling-l25-apitem: L${room.level} holds ${cell.length} chest cells, not one`);
    const [cx, cy] = [Math.floor(cell[0].x / tile), Math.floor(cell[0].y / tile)];
    const way = [[cx + 1, Math.floor(tape.boot.y / tile)], [cx + 1, cy], [cx, cy], [cx, room.height - 1]];
    const run = createRunForStaging(stagingFromTape(tape), levelSource, { scratchPersistence: true });
    const level = run.level;
    const perTick = [];
    const advance = (keys) => { run.advance(new Set(keys)); perTick.push([...keys].sort()); };
    for (let i = 0; i < lead; i += 1) advance([]);
    for (const [tx, ty] of way) {
        const wx = tx * tile + tile / 2;
        const wy = ty * tile + tile / 2;
        for (let n = 0; n < limit && run.level === level; n += 1) {
            const dx = wx - run.state.x;
            const dy = wy - run.state.y;
            if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) break;
            advance([...(dx > 1.4 ? ['right'] : dx < -1.4 ? ['left'] : []), ...(dy > 1.4 ? ['down'] : dy < -1.4 ? ['up'] : [])]);
        }
    }
    for (let i = 0; i < tail; i += 1) perTick.push([]);
    return { perTick, way, model: { level: run.level, x: run.state.x, y: run.state.y } };
}

/** Per-tick key lists as a tape's `inputs` spans (`{key, from, to}`, `to` exclusive). */
export function spansOf(perTick) {
    const spans = [];
    const open = new Map();
    perTick.forEach((keys, t) => {
        for (const [k, from] of [...open]) if (!keys.includes(k)) { spans.push({ key: k, from, to: t }); open.delete(k); }
        for (const k of keys) if (!open.has(k)) open.set(k, t);
    });
    for (const [k, from] of open) spans.push({ key: k, from, to: perTick.length });
    return spans.sort((a, b) => a.from - b.from || a.key.localeCompare(b.key));
}

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', `http://localhost:${process.env.SEEDLING_PORT || '8000'}`).replace(/\/+$/, '');
    const RECORD = process.argv.includes('--record');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { gameVisibleTape } = await M('tapeFormat.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const F = await M('fidelityL25ApItem.js');
    const sets = F.l25Sets(REPO);
    const tape = F.l25Tape(REPO);
    const model = { delivered: F.l25Replay(tape, sets.deliveredSource), vanilla: F.l25Replay(tape, sets.vanillaSource) };
    const takenAt = model.delivered.takenAt;
    console.log(`PAGE: ${PAGE} · delivered ${sets.delivered.set_id} · vanilla ${sets.vanilla.set_id} · model takenAt ${takenAt}`);

    takeBoxLockOrExit({ name: 'probe-seedling-l25-apitem.mjs', kind: 'browser' });
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
    let proved = false;
    const play = async (set, t) => {
        const page = await browser.newPage();
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const mounted = await json(page, 'botLevelSet');
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(t)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = await json(page, 'botStatus');
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                return st?.finished ? st : null;
            }, 10 * 60 * 1000);
            const drained = await json(page, 'botDrain');
            const clears = [...new Set((status.persistence_cleared ?? []).map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
            return { mounted: mounted?.active ?? null, clears, hits: status.hits ?? null,
                ticks: (drained?.ticks ?? []).map((o) => ({ level: o.level, x: o.x, y: o.y })) };
        } finally {
            await page.close();
        }
    };
    const drift = (m, g) => {
        let worst = 0;
        let first = null;
        const n = Math.min(m.length, g.length);
        for (let i = 0; i < n; i++) {
            const d = m[i].level !== g[i].level ? Infinity : Math.max(Math.abs(m[i].x - g[i].x), Math.abs(m[i].y - g[i].y));
            if (d > 0 && first === null) first = { t: i, game: g[i], model: m[i] };
            if (d > worst) worst = d;
        }
        return { compared: n, worst, first };
    };
    const slot = `${F.L25_SLOT.level},${F.L25_SLOT.tag}`;
    const oracle = { source: 'probe-seedling-l25-apitem.mjs --record (seedling fidelity L25APITEM)', build: PAGE,
        tape: F.L25_TAPE, delivered_set: sets.delivered.set_id, vanilla_set: sets.vanilla.set_id, slot, takenAt };
    if (process.argv.includes('--through')) {
        try {
            const { parseTape } = await M('tapeFormat.js');
            const room = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'))
                .levels.find((l) => l.level === F.L25_SLOT.level);
            const { perTick, way, model: walked } = await throughKeys(tape, sets.deliveredSource, room);
            const through = parseTape({ ...tape, name: 'l25apitem-through', tick_count: perTick.length, inputs: spansOf(perTick) });
            const onVanilla = F.l25Replay(through, sets.vanillaSource);
            const del = await play(sets.delivered, through);
            const van = await play(sets.vanilla, through);
            const levelsOf = (r) => [...new Set(r.ticks.map((o) => o.level))];
            const row = { way, ticks: perTick.length, model: { delivered: walked, vanilla: onVanilla.rows.at(-1) },
                delivered: { mounted: del.mounted, levels: levelsOf(del), cleared: del.clears.includes(slot), end: del.ticks.at(-1) ?? null, hits: del.hits },
                vanilla: { mounted: van.mounted, levels: levelsOf(van), cleared: van.clears.includes(slot), end: van.ticks.at(-1) ?? null, hits: van.hits } };
            console.log(`ROW ${JSON.stringify(row)}`);
            check('THROUGH: the model\'s walk on the delivered room leaves L25 for L28', walked.level === 28, JSON.stringify(walked));
            check('THROUGH/DELIVERED: the game ran the tape on the delivered set', del.mounted === sets.delivered.set_id, String(del.mounted));
            check(`THROUGH/DELIVERED: from L22's landing the game takes the apitem ({${slot}} cleared) and leaves by L28's door`,
                row.delivered.cleared && row.delivered.end?.level === 28, JSON.stringify(row.delivered));
            check('THROUGH/VANILLA (control): the same keys stay in L25 and the Chest is not opened ({25,0} set)',
                van.mounted === sets.vanilla.set_id && !row.vanilla.cleared && row.vanilla.levels.length === 1 && row.vanilla.levels[0] === F.L25_SLOT.level,
                JSON.stringify(row.vanilla));
        } catch (e) {
            console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
            check('the wasm runs', false, String(e.message).split('\n')[0]);
        } finally {
            await browser.close();
        }
        console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
        process.exit(failed ? 1 : 0);
    }
    try {
        check('the model takes the delivered apitem on some tick, and the vanilla room holds none',
            Number.isInteger(takenAt) && model.vanilla.apItems.length === 0, JSON.stringify(model.delivered.taken));
        const full = await play(sets.delivered, tape);
        const take = await play(sets.delivered, F.cutTape(tape, takenAt + 1, { hold: true }));
        const before = await play(sets.delivered, F.cutTape(tape, takenAt, { hold: true }));
        const van = await play(sets.vanilla, tape);
        const dFull = drift(model.delivered.rows, full.ticks);
        const dVan = drift(model.vanilla.rows, van.ticks);
        Object.assign(oracle, {
            delivered: { mounted: full.mounted, observations: full.ticks.length, cleared: full.clears.includes(slot),
                end: full.ticks.at(-1) ?? null, hits: full.hits, positions: { compared: dFull.compared, worst: dFull.worst } },
            take: { ticks: takenAt + 1, cleared: take.clears.includes(slot) },
            before: { ticks: takenAt, cleared: before.clears.includes(slot) },
            takenAtGame: take.ticks[takenAt] ?? null,
            vanilla: { mounted: van.mounted, observations: van.ticks.length, cleared: van.clears.includes(slot),
                end: van.ticks.at(-1) ?? null, positions: { compared: dVan.compared, worst: dVan.worst } },
        });
        console.log(`ROW ${JSON.stringify({ ...oracle, firstDrift: { delivered: dFull.first, vanilla: dVan.first } })}`);
        check('DELIVERED: the game ran the whole tape on the delivered set', full.mounted === sets.delivered.set_id
            && full.ticks.length === tape.tick_count + 1, `${full.ticks.length} obs, ${full.mounted}`);
        check(`DELIVERED: the apitem is taken ({${slot}} cleared) and the tape ends in L22`,
            oracle.delivered.cleared && oracle.delivered.end?.level === 22, JSON.stringify(oracle.delivered));
        check('DELIVERED: the model replays the game at 0 px', dFull.worst === 0, JSON.stringify(dFull));
        check(`TAKE: ${takenAt + 1} ticks clear {${slot}}`, oracle.take.cleared, JSON.stringify(oracle.take));
        check(`BEFORE: ${takenAt} ticks do NOT`, !oracle.before.cleared, JSON.stringify(oracle.before));
        check('VANILLA (control): the Chest stays Solid — {25,0} set — and the model\'s bottom-line room is the game\'s at 0 px',
            van.mounted === sets.vanilla.set_id && !oracle.vanilla.cleared && dVan.worst === 0, JSON.stringify({ ...oracle.vanilla, first: dVan.first }));
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (RECORD && !failed) {
        const out = join(REPO, F.L25_ORACLE);
        writeFileSync(out, `${JSON.stringify(oracle, null, 2)}\n`);
        console.log(`RECORDED: ${out}`);
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}
