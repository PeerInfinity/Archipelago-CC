#!/usr/bin/env node
/**
 * Seedling's L32 Bob-arena rock, MOVED, ON THE GAME (rules `rules-l32-rock-move`). ⚖ The user (2026-10-19,
 * "Level-data patch"): the delivered set moves L32's `fallrocklarge@64,128` (tag 1, `bossrock`, `thirdboss`) to
 * (88,128) (`seedlingSetPatches.PATCH_L32_BOSSROCK_MOVED`), so a player WITHOUT Fire leaves L32 by the stairs after
 * the kill. Under R4 Fire comes from the server, not the kill; in vanilla the landed rock covers
 * `stairsdown@72,136` → L30 and the room's other way out (the burnable tree over the pit) needs Fire.
 *
 * Two tapes, both from `fixtures/tapes/swim-u5-bobboss-encounter.json` (boot L32 (72,120), the fight solved):
 *   walkout   its inputs up to t840 (the fight, the kill, the Fire pickup press), its equip DROPPED, then `down`
 *             to t980 — fidelity APFLIP D1's `l32-rock-walkout` spec. Nothing burns the tree
 *   fire-pit  the whole tape, Fire held from the boot (`seam.items.hasFire`; on p4g the kill grants none), so its
 *             slot-1 equip at t840 and its press at t880 burn the tree ({32,0}) and the pit falls to L30
 *
 * Two arms per tape, each on a FRESH page (a reused page keeps the previous build's entities):
 *   DELIVERED  `vanillaRecordSet`'s own default (`SEEDLING_SET_PATCHES`), mounted by `botLoadLevels`
 *   CONTROL    the same delivery WITHOUT the L32 row (every other patch kept): vanilla's rock
 * walkout:  DELIVERED passes iff the player goes L32 → L30 by the STAIRS (arrival (232,184), the stairs' own
 *           playerx/playery + 8) with no Fire and the fight's clears {32,1}{32,3}{32,4}; CONTROL iff it stays in
 *           L32 (the vanilla seal reproduced) with the same clears.
 * fire-pit: BOTH arms pass iff the tree burns ({32,0}) and L32 → L30 happens after it, not at the stairs' arrival
 *           — the move leaves the Fire route as it was.
 *
 * The model replays each arm's tape on its mounted records, as a ROW ONLY: on this tree `bobBossRockRect()` is the
 * constant (64,128), so the model's rock does not follow the move until fidelity APFLIP's switched
 * `levelRun.bobArenaRockRect()` lands (APFLIP D1 measured that model == game there).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-l32-rock-move.mjs [--host=http://localhost:8000] [--out=<dir>] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { PATCH_L32_BOSSROCK_MOVED, SEEDLING_SET_PATCHES } from '../../frontend/modules/seedlingDemo/seedlingSetPatches.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SOURCE_TAPE = 'frontend/modules/seedlingDemo/fixtures/tapes/swim-u5-bobboss-encounter.json';
/** The stairs' arrival in L30 (`stairsdown@72,136`: playerx 224, playery 176; the game reports the centre, +8). */
export const STAIRS_ARRIVAL = Object.freeze({ x: 232, y: 184 });
/** The fight's clears on p4g: the rock {32,1}, and the boss report rows (32,3) and (32,4). */
export const FIGHT_CLEARS = Object.freeze(['32,1', '32,3', '32,4']);
/** The burnable tree over the pit (`burnabletree@64,0`, tag 0). */
export const TREE_CLEAR = '32,0';

/** The two tapes, derived from the source tape (fidelity APFLIP D1's `tapePatch`, and the tape itself). */
export function l32Tapes(source) {
    const walkoutInputs = source.inputs.filter((i) => i.from < 840).map((i) => ({ ...i, to: Math.min(i.to, 840) }));
    return {
        walkout: { ...source, name: 'l32-walkout', description: 'probe-seedling-l32-rock-move: walkout',
            tick_count: 980, equips: [], inputs: [...walkoutInputs, { key: 'down', from: 840, to: 980 }] },
        'fire-pit': { ...source, name: 'l32-fire-pit', description: 'probe-seedling-l32-rock-move: fire-pit',
            seam: { ...source.seam, items: { ...source.seam.items, hasFire: true } } },
    };
}

/** The transitions a drained stream implies, with the first tick in the new level (its arrival). */
const derivedTransitions = (ticks) => ticks.slice(1).flatMap((o, i) => (o.level === ticks[i].level ? []
    : [{ t: o.t, from: ticks[i].level, to: o.level, at: { x: o.x, y: o.y } }]));

/** What one tape's stream says: the L32 → L30 exit, whether it was by the stairs, and the clears. Exported for the unit rows. */
export function readL32(ticks, cleared) {
    const transitions = derivedTransitions(ticks);
    const out = transitions.find((t) => t.from === 32 && t.to === 30) ?? null;
    const byStairs = out !== null && out.at.x === STAIRS_ARRIVAL.x && out.at.y === STAIRS_ARRIVAL.y;
    const clears = [...new Set(cleared.map((c) => `${Number(c.level)},${Number(c.tag)}`))].sort();
    return { transitions, out, byStairs, clears, final: ticks.at(-1) ?? null };
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
    if (!SEEDLING_SET_PATCHES.includes(PATCH_L32_BOSSROCK_MOVED)) {
        console.log(`FAIL: the delivery's table does not carry ${PATCH_L32_BOSSROCK_MOVED.id}`);
        process.exit(1);
    }
    const armOf = (set) => ({ set, levelSource: levelSourceFromAtlas(mountedRecordsOf(set)) });
    const ARMS = {
        // ⛔ the delivery's OWN default, so a delivery that stops carrying the table is seen here
        delivered: armOf(vanillaRecordSet(EMBED, MAP).set),
        control: armOf(vanillaRecordSet(EMBED, MAP, {
            patches: SEEDLING_SET_PATCHES.filter((p) => p !== PATCH_L32_BOSSROCK_MOVED) }).set),
    };
    console.log(`PAGE: ${PAGE} · delivered ${ARMS.delivered.set.set_id} · control ${ARMS.control.set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-l32-rock-move.mjs', kind: 'browser' });
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
    // ⛔ EVERY TAPE × ARM ON A FRESH PAGE.
    const logs = [];
    const run = async (set, tape) => {
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
    const TAPES = l32Tapes(readJson(SOURCE_TAPE));
    const rows = [];
    try {
        for (const [tapeName, raw] of Object.entries(TAPES)) {
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            for (const [name, a] of Object.entries(ARMS)) {
                const g = await run(a.set, tape);
                const read = readL32(g.ticks, g.status.persistence_cleared ?? []);
                let model;
                try {
                    const m = runTape(tape, { levelSource: a.levelSource });
                    const mr = readL32(m.ticks, []);
                    model = { refused: null, transitions: mr.transitions, final: mr.final };
                } catch (e) {
                    model = { refused: e.message.split('\n')[0] };
                }
                const row = { tape: tapeName, arm: name, set_id: a.set.set_id, mounted: g.mounted?.active,
                    observations: g.ticks.length, ...read, model };
                rows.push(row);
                console.log(`ROW ${JSON.stringify(row)}`);
                const label = `${tapeName} ${name}`;
                check(`${label}: the game ran the tape to its end on the mounted set`,
                    g.ticks.length === tape.tick_count + 1 && g.mounted?.active === a.set.set_id,
                    `${g.ticks.length} obs, ${g.mounted?.active}`);
                const fought = FIGHT_CLEARS.every((c) => read.clears.includes(c));
                const burned = read.clears.includes(TREE_CLEAR);
                if (tapeName === 'walkout') {
                    check(`${label}: the fight is vanilla's — {32,1}{32,3}{32,4} cleared, the tree NOT burned`,
                        fought && !burned, read.clears.join(' '));
                    if (name === 'delivered') {
                        check(`${label}: WITHOUT Fire, L32 → L30 by the STAIRS (arrival ${STAIRS_ARRIVAL.x},${STAIRS_ARRIVAL.y})`,
                            read.byStairs && read.transitions.length === 1, JSON.stringify(read.out));
                    } else {
                        check(`${label}: the vanilla seal is reproduced — the player stays in L32`,
                            read.transitions.length === 0 && read.final?.level === 32, JSON.stringify(read.final));
                    }
                } else {
                    const burnAt = 880;
                    check(`${label}: WITH Fire, the tree burns and the pit falls to L30 after it (not by the stairs)`,
                        fought && burned && read.out !== null && read.out.t > burnAt && !read.byStairs,
                        JSON.stringify({ out: read.out, clears: read.clears }));
                }
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
        for (const r of rows) writeFileSync(join(OUT, `l32-rock-move-${r.tape}-${r.arm}.json`), `${JSON.stringify(r, null, 1)}\n`);
        console.log(`wrote ${rows.length} witness file(s) to ${OUT}`);
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
