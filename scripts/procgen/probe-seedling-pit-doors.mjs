#!/usr/bin/env node
/**
 * Seedling's PIT DOORS, ON THE GAME (fidelity PITPORT D1; `CONTACT_FIDELITY.pitTeleporterCrossing`).
 *
 * Three teleporters in the atlas stand on their own Pit tile, each in a room with no fallthrough (a fall is `die()`):
 * L43's `teleporter@144,64` → L37 (tile 9,4), L58's `teleporter@80,16` → L46 (tile 5,1; tag 1, the Yeti's) and L100's
 * `teleporter@288,96` → L101 (tile 18,6). Which of the door and the pit takes the player is decided by the game's order:
 *
 *     Teleporter.as:89-118   update(): checkDeactivated(); a live door fires on the first frame the player box overlaps
 *                            its 16x16 rect (`!playerTouching`) — no fall guard
 *     Game.as:2040 / :2169   the player is added before the teleporters and `addUpdate` prepends: the doors update FIRST
 *     Player.as:745-771      checkFallingInPit(): the fall fades for 20 frames before its own `FP.world =` / `die()`
 *
 * Tapes, each on a FRESH page (`r8-solve-11`'s committed block re-pointed at the room's arrival, as YETI staged L58):
 *   l43-south      the solver's `reach-exit` (switch ON) from the L40 stairs' arrival, the room's boss, lock and wand
 *                  cleared at the boot (tags 5, 4, 0); onto the door from the SOUTH (the corridor), 10 ticks in L37
 *   l43-north      the same boot; around the door's ring to its north tile, then onto the door going DOWN
 *   l100-west      the solver's `reach-exit` booted in the door's corridor at tile (10,6) (the L99 stairs' arrival is cut
 *                  off by the cliffsides; the route's own arrival is the survey's): onto the door from the WEST
 *   l100-east      around the door's ring to its east tile, then onto the door going LEFT
 *   l58-east       L58 with `{58,0}`/`{58,1}` cleared at the boot (YETI's `revisit`): up through the island to the door's
 *                  south-east tile, then onto the door DIAGONALLY (up-left, its corner first)
 *   l58-shut-east  the same walk with the door SHUT (no clears; up beside the Yeti): the Pit takes the player
 * Every door walk ends with 10 ticks in the next room; the shut one with 60 still ticks (the fall and the respawn).
 *
 * The model replays each tape and is compared to the game tick by tick (0 px). Prints `PASS:`/`FAIL:` rows,
 * `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. `--out=<dir>` writes one witness file per tape.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP. Takes the
 * box lock. Headless LOGIC-ONLY.
 *
 * Run: node scripts/procgen/probe-seedling-pit-doors.mjs [--host=http://localhost:8000] [--out=<dir>] [--only=l43-south,…]
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { watcherStaging } from './plan-seedling-watcher-witness.mjs';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const M = (p) => import(join(MODULE, p));
const AFTER_CROSSING = 10;
const AFTER_SHUT = 60;

/** The three pit doors (OEL position, destination, the pit tile under each). */
export const PIT_DOORS = Object.freeze({
    43: Object.freeze({ x: 144, y: 64, to: 37, tile: [9, 4] }),
    58: Object.freeze({ x: 80, y: 16, to: 46, tile: [5, 1] }),
    100: Object.freeze({ x: 288, y: 96, to: 101, tile: [18, 6] }),
});

/**
 * The witnesses. `via` is a list of tile-centre waypoints walked straight before the door (none: the solver's own
 * `reach-exit`, switch ON); `shut` names the one whose door is deactivated.
 */
export const PIT_DOOR_WITNESSES = Object.freeze([
    { name: 'l43-south', level: 43, boot: { x: 176, y: 448 }, items: [],
        clears: [{ level: 43, tag: 0 }, { level: 43, tag: 4 }, { level: 43, tag: 5 }], via: null },
    { name: 'l43-north', level: 43, boot: { x: 176, y: 448 }, items: [],
        clears: [{ level: 43, tag: 0 }, { level: 43, tag: 4 }, { level: 43, tag: 5 }],
        via: [[9, 5, 'solver'], [8, 5], [8, 3], [9, 3]] },
    { name: 'l100-west', level: 100, boot: { x: 160, y: 96 }, items: [], clears: [], via: null },
    { name: 'l100-east', level: 100, boot: { x: 160, y: 96 }, items: [], clears: [],
        via: [[17, 6, 'solver'], [17, 5], [19, 5], [19, 6]] },
    { name: 'l58-east', level: 58, boot: { x: 56, y: 96 }, items: ['canSwim'],
        clears: [{ level: 58, tag: 0 }, { level: 58, tag: 1 }], via: [[4, 6], [4, 2], [6, 2]] },
    { name: 'l58-shut-east', level: 58, boot: { x: 56, y: 96 }, items: ['canSwim'], clears: [], shut: true,
        via: [[3, 6], [3, 3, 'up'], [6, 2]] },
]);

const centreOf = ([tx, ty]) => ({ x: tx * 16 + 8, y: ty * 16 + 8 });

/** Axis keys toward `to`, one tick (no planner: the straight walk the tapes append). */
function towards(state, to) {
    const keys = [];
    if (Math.abs(to.x - state.x) > 1) keys.push(to.x > state.x ? 'right' : 'left');
    if (Math.abs(to.y - state.y) > 1) keys.push(to.y > state.y ? 'down' : 'up');
    return keys;
}

export async function pitDoorStaging(w) {
    return watcherStaging({ boot: { level: w.level, ...w.boot }, keys: [], items: w.items, clears: w.clears });
}

/**
 * One witness's `{staging, perTick}`, derived from the model with the switch ON: the solver's `reach-exit` (or the
 * solver's walk to `via`'s first tile when it is marked `'solver'`), the straight `via` walk, then onto the door's
 * centre until the run crosses (or, shut, until it stands on the centre or a transport ends it).
 */
export async function pitDoorTape(w) {
    const { createRunForStaging } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const { solveSegment } = await M('solverBot.js');
    const { withContactFidelity } = await M('contactFidelity.js');
    const levelSource = atlasLevelSource();
    const door = PIT_DOORS[w.level];
    const staging = await pitDoorStaging(w);
    return withContactFidelity({ pitTeleporterCrossing: true }, () => {
        const run = createRunForStaging(staging, levelSource);
        const perTick = [];
        const press = (held) => { perTick.push(held); return run.advance(held); };
        if (w.via === null) {
            const solved = solveSegment({ run: createRunForStaging(staging, levelSource), name: w.name,
                boot: staging.boot, goals: [{ kind: 'reach-exit', exit: { x: door.x, y: door.y } }] });
            for (const h of solved.perTick) press(new Set(h));
            if (run.level !== door.to) throw new Error(`${w.name}: the solver's plan did not cross to L${door.to}`);
            for (let k = 0; k < AFTER_CROSSING; k += 1) press(new Set());
            return { staging, perTick };
        }
        const legs = [...w.via];
        if (legs[0][2] === 'solver') {
            const [tx, ty] = legs.shift();
            const aim = centreOf([tx, ty]);
            // The solver's corridor to the first ring tile: a reach-exit's walk, cut where it reaches that tile.
            const solved = solveSegment({ run: createRunForStaging(staging, levelSource), name: w.name,
                boot: staging.boot, goals: [{ kind: 'reach-exit', exit: { x: door.x, y: door.y } }] });
            for (const h of solved.perTick) {
                if (Math.abs(run.state.x - aim.x) <= 2 && Math.abs(run.state.y - aim.y) <= 2) break;
                press(new Set(h));
            }
        }
        for (const [tx, ty, only] of legs) {
            const aim = centreOf([tx, ty]);
            for (let i = 0; i < 400; i += 1) {
                let keys = towards(run.state, aim);
                if (only === 'up') keys = keys.filter((k) => k === 'up' || k === 'down');
                if (keys.length === 0) break;
                if (press(new Set(keys)).transition) throw new Error(`${w.name}: left L${w.level} on the way round`);
                if (run.level !== w.level || run.state.fall) throw new Error(`${w.name}: fell on the way round`);
            }
        }
        const centre = { x: door.x + 8, y: door.y + 8 };
        for (let i = 0; i < 400; i += 1) {
            const keys = towards(run.state, centre);
            const r = press(new Set(keys));
            if (r.transition && !w.shut) {
                for (let k = 0; k < AFTER_CROSSING; k += 1) press(new Set());
                return { staging, perTick };
            }
            if (w.shut && (run.state.fall || keys.length === 0)) break;
        }
        if (!w.shut) throw new Error(`${w.name}: the walk never crossed the door`);
        for (let k = 0; k < AFTER_SHUT; k += 1) press(new Set());
        return { staging, perTick };
    });
}

/** A witness tape, as the game and `runTape` read it. */
export async function pitDoorParsedTape(name, { staging, perTick }) {
    const { buildStagedTape } = await M('botDriverV1.js');
    const { parseTape, PIN_NAMES } = await M('tapeFormat.js');
    const built = buildStagedTape({ staging, perTick, name: `pitdoor-${name}` });
    return parseTape({ ...built, pins: [...PIN_NAMES],
        description: `probe-seedling-pit-doors: ${name} (fidelity PITPORT D1; the door on its Pit tile)` });
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const OUT = arg('out', null);
    const only = arg('only', null)?.split(',');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const { gameVisibleTape } = await M('tapeFormat.js');
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
    const witnesses = PIT_DOOR_WITNESSES.filter((w) => !only || only.includes(w.name));
    const tapes = [];
    for (const w of witnesses) tapes.push({ w, tape: await pitDoorParsedTape(w.name, await pitDoorTape(w)) });

    takeBoxLockOrExit({ name: 'probe-seedling-pit-doors.mjs', kind: 'browser' });
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
    const runOnGame = async (tape) => {
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
    const rows = [];
    try {
        for (const { w, tape } of tapes) {
            const door = PIT_DOORS[w.level];
            const g = await runOnGame(tape);
            const mOut = withContactFidelity({ pitTeleporterCrossing: true }, () => runTape(tape, { levelSource }));
            const m = mOut.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level }));
            const crossedAt = (ticks) => ticks.find((o) => o.level === door.to)?.t ?? null;
            const onDoorAt = (ticks) => ticks.find((o) => o.level === w.level
                && o.x + 2 > door.x && o.x - 2 < door.x + 16 && o.y + 3 > door.y && o.y - 2 < door.y + 16)?.t ?? null;
            const boot = { x: w.boot.x + 8, y: w.boot.y + 8 };
            const respawns = g.ticks.filter((o, i) => i > 0 && o.level === w.level && o.x === boot.x && o.y === boot.y
                && !(g.ticks[i - 1].x === boot.x && g.ticks[i - 1].y === boot.y)).map((o) => o.t);
            const row = {
                tape: w.name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                game: { firstOnDoor: onDoorAt(g.ticks), crossedAt: crossedAt(g.ticks), respawns, final: g.ticks.at(-1) ?? null },
                model: { firstOnDoor: onDoorAt(m), crossedAt: crossedAt(m), ...drift(m, g.ticks) },
            };
            rows.push({ row, tape, game: g.ticks });
            console.log(`ROW ${JSON.stringify(row)}`);
            check(`${w.name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id,
                `${g.ticks.length} obs, ${g.mounted?.active}`);
            if (w.shut) {
                check(`${w.name}: the SHUT door does not cross; the Pit takes the player (respawn at the boot)`,
                    row.game.crossedAt === null && respawns.length > 0, JSON.stringify({ respawns, final: row.game.final }));
            } else {
                check(`${w.name}: the LIVE door crosses to L${door.to} on the tick after the box first overlaps it`,
                    row.game.crossedAt !== null && row.game.crossedAt === row.game.firstOnDoor + 1,
                    `first on the door t${row.game.firstOnDoor}, crossed t${row.game.crossedAt}`);
            }
            check(`${w.name}: the model reproduces the game at 0 px`, row.model.max === 0,
                JSON.stringify({ max: row.model.max, first: row.model.first }));
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (OUT) {
        mkdirSync(OUT, { recursive: true });
        for (const r of rows) {
            writeFileSync(join(OUT, `pitdoor-${r.row.tape}.json`),
                `${JSON.stringify({ ...r.row, tape: r.tape, gameTicks: r.game }, null, 1)}\n`);
        }
        console.log(`wrote ${rows.length} witness file(s) to ${OUT}`);
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
