#!/usr/bin/env node
/**
 * Three steps the shuffled world `seedling_er` asks for and the solver refuses, PLAYED ON THE GAME (slice
 * rules-er-c1-c3-witness). The AP logic says each is reachable with the items it names; the route survey's solver,
 * holding exactly those, says no. Vanilla never asks: it reaches the same rooms later, with more items. This probe
 * holds what the survey held, stands where the survey landed, and lets the game answer.
 *
 *   c1-l12-chest   `Level 012 - Chest` by `level_12__r0c19 -(Red Key)-> r0c37 -(Fire)-> r42c28`, from L0's door
 *                  (16,80) with the Sword, Fire and the Red Key, and NO Shield. The walk is the solver's own, once it
 *                  is handed the logic's path as three sub-goals (the Red Key lock {12,4}, the burnable tree {12,2},
 *                  the chest). The game writes {12,4}, {12,2} and the chest's {12,9}, adds a seal, and never writes
 *                  the Shield lock's {12,10}.
 *   c2-l22-swordless  L22 from L25's door (16,128) to L29's door (192,64) with NO item at all. Two rows of wallflyers
 *                  (y 88 and y 120) lie between; the walk crosses the lower row beside the west flyer, passes the
 *                  upper row WEST of its rock (tile column 2, where neither flyer's flight ends), and goes round the
 *                  pushable block by the row above it. The player lands in L29.
 *   c3-l40-pit     L40 from L19's stairs (320,592) to the pit at tile (14,27) -> L43 with the Sword only. The walk
 *                  passes puncher@128,624 without stopping (it never lands a punch on a moving player), stands in the
 *                  one-tile corridor of row 30 and slashes the Bobs as they come (three hits each, `Enemy.hitsMax`),
 *                  then steps into the pit. The player lands in L43.
 *
 * ⛓ THE HANDS. c2 and c3 are WAYPOINT plans (`WAYPOINTS`): `followWaypoints` turns them into keys by advancing the JS
 * model one tick at a time (hold the keys toward the next point; `fight` taps the Sword on a cadence while a chaser is
 * near). The model only chooses the keys. The GAME is the judge: every check below reads what the wasm did.
 * Staged: position, facing, inventory and inputs. No flag, no removed body, no game value.
 *
 * And three MODEL rows (`INFO`, not checks: they are the gap this probe hands to the solver's planner, and they flip
 * when it closes): the solver from the same staging with the survey's own goal, its verdict and refusal.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, `INFO {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-er-landings.mjs [--host=http://localhost:8000] [--only=c2-l22-swordless,…] [--repeat=N] [--no-model] [--dump]
 * `--repeat=N` runs every tape N times, each on its own fresh page.
 * `--no-model` skips the three MODEL rows.
 * `--dump` prints every tenth observation of each run.
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

/**
 * The campaign's two latches a staged room boots from (the route survey's own policy): `r8-solve-11` is the post-sword
 * latch; `r8-solve-2` is the campaign's state before any item (its seam holds none).
 */
export const POST_SWORD_BASE = 'r8-solve-11';
export const PRE_SWORD_BASE = 'r8-solve-2';

/** The three cases: where the survey landed, what it held, and the survey's own goal (for the MODEL rows). */
export const CASES = Object.freeze({
    'c1-l12-chest': Object.freeze({
        base: POST_SWORD_BASE, boot: Object.freeze({ level: 12, x: 16, y: 80 }), items: ['hasFire'], keys: [0],
        goal: Object.freeze({ kind: 'collect-placement', placement: Object.freeze({ x: 320, y: 816 }) }),
    }),
    'c2-l22-swordless': Object.freeze({
        base: PRE_SWORD_BASE, boot: Object.freeze({ level: 22, x: 16, y: 128 }), items: [], keys: [],
        goal: Object.freeze({ kind: 'reach-exit', exit: Object.freeze({ x: 192, y: 64 }) }),
    }),
    'c3-l40-pit': Object.freeze({
        base: POST_SWORD_BASE, boot: Object.freeze({ level: 40, x: 320, y: 592 }), items: [], keys: [],
        goal: Object.freeze({ kind: 'reach-pit', pit: Object.freeze({ tx: 14, ty: 27, x: 224, y: 432 }) }),
    }),
});

/** c1's flags (`assets/levels/OverWorld/region1.oel`): the Red Key lock, the burnable tree, the chest, the Shield lock. */
export const L12 = Object.freeze({ redLock: 4, tree: 2, chest: 9, shieldLock: 10 });
/** The logic's path for c1, as the three sub-goals the solver is handed. */
export const C1_SUBGOALS = Object.freeze([
    { kind: 'clear-tag', tag: { level: 12, tag: L12.redLock }, at: { x: 416, y: 240 }, obstacle: 'bosslock@416,240' },
    { kind: 'clear-tag', tag: { level: 12, tag: L12.tree }, at: { x: 480, y: 640 }, obstacle: 'burnabletree@480,640' },
    CASES['c1-l12-chest'].goal,
]);
/** Where each case ends: c1 stays in L12; c2 lands in L29; c3 in L43. */
export const LANDS = Object.freeze({ 'c2-l22-swordless': 29, 'c3-l40-pit': 43 });

/**
 * The hand plans. `['to', x, y, tol?]` holds the keys toward (x,y) until within `tol` px (default 1) on both axes;
 * `['keys', 'a+b', n]` holds keys for n ticks; `['fight', r, cadence, max]` taps `primary` every `cadence` ticks until
 * no chaser has been within `r` px for 40 ticks (at most `max` ticks).
 */
export const WAYPOINTS = Object.freeze({
    // Row 8 at y 130 (clear of the lower flyer row's band and of bob@96,144), up through the lower row beside the
    // west flyer, west along row 6, up column 2 (west of rock@48,80), east along row 4, round pushableblock@96,64 by
    // row 3, east to the door.
    'c2-l22-swordless': [['to', 68, 130], ['to', 76, 104], ['to', 40, 104], ['to', 40, 72], ['to', 90, 72],
        ['to', 90, 56], ['to', 120, 56], ['to', 120, 72], ['to', 200, 72]],
    // Down the stairs' column, west along row 42 under the puncher's pocket, up column 8, face east at the corner of
    // row 30 and slash; again nearer the pit; then column 13 up to row 27 and east into the pit tile.
    'c3-l40-pit': [['to', 328, 680], ['to', 136, 680], ['to', 136, 489], ['keys', 'right', 2], ['fight', 70, 10, 1500],
        ['to', 185, 488], ['fight', 60, 10, 2500], ['to', 216, 488], ['to', 216, 440], ['to', 240, 440]],
});
const LEAD_TICKS = 5;
const TAIL_TICKS = 20;
const QUIET_TICKS = 40;

/** One case's staging: the base latch re-pointed at the landing, holding exactly `items` and `keys`. */
export async function landingStaging({ base, boot, items, keys }) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(join(TAPES, `${base}.json`), 'utf8'))));
    staging.boot = { ...boot };
    staging.save = { totem_parts: [], keys: [...keys], seal_parts: [] };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(items.map((p) => [p, true])) } };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    return staging;
}

/** Per-tick key lists -> the tape's `{key, from, to}` spans. Exported for the unit rows. */
export function spansOf(perTick) {
    const inputs = [];
    const open = {};
    perTick.forEach((keys, t) => {
        for (const k of Object.keys(open)) if (!keys.includes(k)) { inputs.push({ key: k, from: open[k], to: t }); delete open[k]; }
        for (const k of keys) if (!(k in open)) open[k] = t;
    });
    for (const k of Object.keys(open)) inputs.push({ key: k, from: open[k], to: perTick.length });
    return inputs.sort((a, b) => a.from - b.from || a.key.localeCompare(b.key));
}

/** The keys that move (x,y) toward (tx,ty), none inside `tol`. Exported for the unit rows. */
export function keysToward(x, y, tx, ty, tol = 1) {
    const keys = [];
    if (tx - x > tol) keys.push('right'); else if (tx - x < -tol) keys.push('left');
    if (ty - y > tol) keys.push('down'); else if (ty - y < -tol) keys.push('up');
    return keys;
}

/** A waypoint plan -> per-tick keys, chosen by advancing the JS model (the model picks keys; it judges nothing). */
export async function followWaypoints(staging, way) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const run = createRunForStaging(JSON.parse(JSON.stringify(staging)), atlasLevelSource(), { scratchPersistence: true });
    const perTick = [];
    const from = run.level;
    const step = (keys) => { perTick.push([...keys]); run.advance(new Set(keys)); };
    for (let i = 0; i < LEAD_TICKS; i += 1) step([]);
    for (const w of way) {
        if (run.level !== from) break;
        if (w[0] === 'keys') { for (let i = 0; i < w[2]; i += 1) step(w[1].split('+')); continue; }
        if (w[0] === 'fight') {
            const [, r, cadence, max] = w;
            for (let n = 0, quiet = 0; n < max && quiet < QUIET_TICKS; n += 1) {
                const near = (run.chasers ?? []).some((c) => Math.hypot(c.x - run.state.x, c.y - run.state.y) < r);
                quiet = near ? 0 : quiet + 1;
                step(n % cadence === 0 ? ['primary'] : []);
            }
            continue;
        }
        const [, tx, ty, tol = 1] = w;
        for (let n = 0; n < 600 && run.level === from; n += 1) {
            const keys = keysToward(run.state.x, run.state.y, tx, ty, tol);
            if (!keys.length) break;
            step(keys);
        }
    }
    for (let i = 0; i < TAIL_TICKS; i += 1) step([]);
    return { perTick, model: { level: run.level, hits: run.playerHits.map((h) => `${h.t}:${h.id}`) } };
}

/** The solver from one staging (the survey's `twoPassSolve`). Throws its refusal. */
export async function solveFrom(staging, goals, name) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const levelSource = atlasLevelSource();
    return twoPassSolve({ makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals, name, boot: staging.boot, dashMode: 'all', persistence: staging.persistence, log: () => {} });
}

function verbsOf(solved) {
    return (solved.out.trace?.rows ?? []).map((r) => `${r.strategy?.verb ?? '?'}${r.obstacle?.id ? `(${r.obstacle.id})` : ''}`);
}

/** The three tapes. c1 asks the solver (a few seconds); c2 and c3 follow their waypoints. */
export async function landingTapes(names = Object.keys(CASES)) {
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { requiredTapeVersion } = await import(join(MODULE, 'tapeFormat.js'));
    const out = {};
    for (const name of names) {
        const staging = await landingStaging(CASES[name]);
        if (name === 'c1-l12-chest') {
            const solved = await solveFrom(staging, C1_SUBGOALS, `er-landings-${name}`);
            const built = buildStagedTape({ staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick, name: `er-landings-${name}` });
            out[name] = { ...built, description: `probe-seedling-er-landings: ${name} (the solver's walk for the `
                + 'logic\'s path as three sub-goals)', planVerbs: verbsOf(solved) };
            continue;
        }
        const { perTick, model } = await followWaypoints(staging, WAYPOINTS[name]);
        const t = { ...staging, game: 'seedling', name: `er-landings-${name}`,
            description: `probe-seedling-er-landings: ${name} (hand waypoints)`, noclip: false, noDamage: false,
            noHazards: [], grants: [], equips: [], tick_count: perTick.length, inputs: spansOf(perTick) };
        out[name] = { ...t, tape_version: requiredTapeVersion(t, 8), model };
    }
    return out;
}

/**
 * What one run says. `wrote` = the game's `persistence_cleared` at the end LESS the first armed sample's. `respawns`
 * counts the observations where the player is back on the boot tile after having left it (a death puts it there).
 * Exported for the unit rows.
 */
export function readRun(ticks, firstCleared = [], lastCleared = [], { maxHits = 0, seals = 0 } = {}) {
    const start = ticks[0] ?? null;
    let away = false;
    let respawns = 0;
    for (const o of ticks) {
        if (!start || o.level !== start.level) { away = true; continue; }
        const home = Math.abs(o.x - start.x) < 0.5 && Math.abs(o.y - start.y) < 0.5;
        if (home && away) respawns += 1;
        away = !home;
    }
    return {
        levels: [...new Set(ticks.map((o) => o.level))],
        wrote: lastCleared.filter((c) => !firstCleared.includes(c)).sort(),
        maxHits, seals, respawns,
        final: ticks.at(-1) ?? null,
    };
}

/** The expectation per case. Exported for the unit rows. */
export function expectLanding(name, r) {
    const has = (tag) => r.wrote.includes(`12:${tag}`);
    if (r.respawns > 0) return false;
    if (name === 'c1-l12-chest') {
        return has(L12.redLock) && has(L12.tree) && has(L12.chest) && !has(L12.shieldLock) && r.seals === 1
            && r.levels.length === 1 && r.levels[0] === CASES[name].boot.level;
    }
    return r.final?.level === LANDS[name] && r.levels.includes(CASES[name].boot.level);
}

const WHAT = {
    'c1-l12-chest': 'Sword, Fire, Red Key, no Shield: the Red Key lock opens, the tree burns, the chest gives its seal; the Shield lock is never written',
    'c2-l22-swordless': 'no item: from L25\'s door the player crosses both wallflyer rows and lands in L29, without dying',
    'c3-l40-pit': 'Sword only: from L19\'s stairs the player passes the puncher, kills the corridor Bobs and falls to L43, without dying',
};

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(MODULE, p));
    const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-er-landings.mjs', kind: 'browser' });
    const only = arg('only', null)?.split(',');
    const names = Object.keys(CASES).filter((n) => !only || only.includes(n));
    if (!process.argv.includes('--no-model')) {
        for (const name of names) {
            const t0 = Date.now();
            let row;
            try {
                const s = await solveFrom(await landingStaging(CASES[name]), [CASES[name].goal], `er-landings-model-${name}`);
                row = { verdict: 'SOLVED', ticks: s.out.perTick.length, verbs: verbsOf(s) };
            } catch (e) {
                row = { verdict: 'REFUSED', refusal: String(e.message).split('\n')[0].slice(0, 400) };
            }
            console.log(`INFO ${JSON.stringify({ model: name, goal: CASES[name].goal, ...row, ms: Date.now() - t0 })}`);
        }
    }
    const tapes = await landingTapes(names);

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
    const waitFor = async (page, what, fn, ms, every = 250) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(every);
        }
    };
    const logs = [];
    const clearedOf = (st) => (st?.persistence_cleared ?? []).map((c) => (typeof c === 'string' ? c : `${c.level}:${c.tag}`));
    const sealsOf = (st) => (st?.save?.seal_parts ?? []).filter((s) => s >= 0).length;
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
            // The cleared set at the first armed sample (the boot's own clears applied) and at the end; the most
            // hits any sample held (the game's `hits` counts hits TAKEN and resets on a level change).
            let first = null;
            let maxHits = 0;
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = JSON.parse(String(await page.evaluate(() => window.__swfBridge.game.botStatus())));
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                if (first === null && !st.arm?.pending && st.arm?.armed_at >= 0) first = clearedOf(st);
                maxHits = Math.max(maxHits, st?.hits ?? 0);
                return st?.finished ? st : null;
            }, 15 * 60 * 1000, 20);
            const drained = await json(page, 'botDrain');
            return { status, mounted, first: first ?? [], last: clearedOf(status), maxHits, seals: sealsOf(status),
                items: Object.entries(status.items ?? {}).filter(([, v]) => v === true).map(([k]) => k).sort(),
                keys: (status.save?.keys ?? []).flatMap((k, i) => (k ? [i] : [])),
                ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
        } finally {
            await page.close();
        }
    };
    try {
        const repeat = Math.max(1, Number(arg('repeat', '1')) || 1);
        for (const [name, raw] of Object.entries(tapes).flatMap((e) => Array(repeat).fill(e))) {
            const { planVerbs, model, ...fields } = raw;
            const tape = parseTape({ ...fields, pins: [...PIN_NAMES] });
            const g = await run(tape);
            const read = readRun(g.ticks, g.first, g.last, { maxHits: g.maxHits, seals: g.seals });
            const row = { tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                boot: tape.boot, held: { items: g.items, keys: g.keys }, ...(planVerbs ? { planVerbs } : {}),
                ...(model ? { model } : {}), ...read };
            console.log(`ROW ${JSON.stringify(row)}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            check(`${name}: ${WHAT[name]}`, expectLanding(name, read),
                JSON.stringify({ levels: read.levels, wrote: read.wrote, maxHits: read.maxHits, seals: read.seals, respawns: read.respawns, final: read.final }));
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
