#!/usr/bin/env node
/**
 * Which item gives a NO-HIT line across a wallflyer's flight, PLAYED ON THE GAME (slice rules-no-hit-l22). The logic
 * never expects the player to tank a hit (⚖ Robert 2026-10-21, generalised 2026-11-11), and L22's crossing from L25's
 * door to L29's door takes one with no item. This probe asks, per door pair and per item arm of the three wallflyer
 * rooms (L22, L25, L27): is there a walk that lands in the far room with ZERO hits taken?
 *
 * ⛓ THE HANDS. A case is `l<level>-<from>-<to>-<arm>`: stand on the landing the `<from>` room's door gives, hold the
 * arm's items and nothing else, reach the `<to>` room. The keys come from a SEARCH on the JS model (`searchNoHit`:
 * weighted A* over 4-tick key macros, a branch dropped at its first hit, states merged on the player's 2 px cell and
 * every body's pose). A found plan is kept in `seedling-wallflyer-nohit-plans.json` as key spans; a search that ends
 * without one is kept there too, with its node budget, as NOT FOUND (which is "this search did not find one", never
 * "impossible"). A plan marked `joined` is a found plan's first ticks (its crossing) and then a straight walk to another
 * door of the same side: two L22 searches found the crossing but not the walk after it inside their budget.
 * The model only chooses keys. The GAME is the judge: every check reads what the wasm did.
 * Staged: position, inventory and inputs. No flag, no removed body, no game value; `noDamage` and `noclip` are false.
 *
 * ⛔ NO WAND ROW. The model refuses a WandShot in a room that holds a wallflyer (`MODEL_REFUSES`), so there is no
 * search for it, and a tape built without the shots does not replay on the game (a cast moves the player). Unwitnessed.
 *
 * And the DERIVATION the rule would stand on (`BAND` rows): every wallflyer's flight band, from the class's own
 * transcription (`seedlingWallFlyerBands.wallFlyerBands`).
 *
 * Prints `BAND {json}`, `ROW {json}`, `INFO {json}`, `PASS:`/`FAIL:` rows, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * ⛓ `--chest` (slice rules-no-hit-directional, a REPORT, no rule reads it): **from which side does L25's chest open?**
 * `Chest.as:63` opens a chest only for a player on the line just under its bottom edge, and until then it is a Solid.
 * L25's chest stands in the mouth of the corridor to L28's door, so that line is reached from L28's door only. The
 * `CHEST_CASES` walk at it on the game: from L22's door against its east face and from above (expected SHUT: the player
 * never stands in the chest's cell or the cell under it), and from L28's door (expected OPEN: the player walks up
 * through the chest's cell). The keys are a waypoint walk on the model; the game is the judge. Not a no-hit question:
 * hits are printed, not checked.
 *
 * Run: node scripts/procgen/probe-seedling-wallflyer-nohit.mjs [--host=http://localhost:8000] [--only=l22-25-29-sword,…] [--repeat=N] [--dump] [--chest]
 *      node scripts/procgen/probe-seedling-wallflyer-nohit.mjs --search=l22-25-29-none,… [--max-nodes=N] [--write]
 * `--only=` plays the named cases only.
 * `--repeat=N` plays every plan N times, each on its own fresh page.
 * `--dump` prints every tenth observation of each run.
 * `--chest` plays the `CHEST_CASES` INSTEAD of the no-hit plans (`--only=`, `--repeat=` and `--dump` apply to them).
 * `--search=` runs the model search for the named cases INSTEAD of playing (no browser, no box lock); `--max-nodes=N`
 * is its node budget (default 60000); `--write` records what it found (or did not) in the plans file.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');
export const PLANS_FILE = join(HERE, 'seedling-wallflyer-nohit-plans.json');
const TILE = 16;

/** The campaign's state before any item (its seam holds none): the latch every case boots from. */
export const BASE = 'r8-solve-2';
/** The item arms, as the seam flags each case holds. `none` is the control. */
export const ARMS = Object.freeze({
    none: [], sword: ['hasSword'], spear: ['hasSpear'], wand: ['hasWand'], shield: ['hasShield'],
    darkshield: ['hasShield', 'hasDarkShield'], fire: ['hasFire'],
});
/** The arms whose `primary` press the model plays in a wallflyer room (the search offers the press to these only). */
export const PRESS_ARMS = Object.freeze(['sword', 'spear', 'fire']);
/** The arms the model refuses in a wallflyer room, by name: no search, so no row. */
export const MODEL_REFUSES = Object.freeze({ wand: 'levelRun refuses a WandShot in a room holding a wallflyer (the shot\'s "Enemy" solids)' });

export const SEARCH = Object.freeze({ macro: 4, weight: 2.5, maxNodes: 60000, lead: 5, tail: 20, near: 56, speed: 1.3 });

export const caseName = ({ level, from, to, arm }) => `l${level}-${from}-${to}-${arm}`;
export function parseCase(name) {
    const m = /^l(\d+)-(\d+)-(\d+)-([a-z]+)$/.exec(name);
    if (!m || !(m[4] in ARMS)) throw new Error(`probe-seedling-wallflyer-nohit: no case ${name} (l<level>-<from>-<to>-<arm>, arm one of ${Object.keys(ARMS).join(', ')})`);
    return { level: Number(m[1]), from: Number(m[2]), to: Number(m[3]), arm: m[4] };
}

export const readMap = () => JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));

/**
 * A level's doors, from its own links: `{to, x, y, landing}` per link entity, `landing` the point the far room's link
 * back puts the player on (its `playerx`/`playery`). A door with no link back is refused by name.
 */
export function doorsOf(map, levelNo) {
    const level = map.levels.find((l) => l.level === levelNo);
    if (!level) throw new Error(`probe-seedling-wallflyer-nohit: no level ${levelNo}`);
    return (level.entities ?? []).filter((e) => Number.isInteger(Number(e.attrs?.to)) && e.attrs.playerx !== undefined).map((e) => {
        const to = Number(e.attrs.to);
        const back = (map.levels.find((l) => l.level === to)?.entities ?? [])
            .find((b) => Number(b.attrs?.to) === levelNo && b.attrs.playerx !== undefined);
        if (!back) throw new Error(`probe-seedling-wallflyer-nohit: L${levelNo}'s door to L${to} has no link back`);
        return { to, x: e.x, y: e.y, landing: { x: Number(back.attrs.playerx), y: Number(back.attrs.playery) } };
    });
}
/** The levels that hold a wallflyer, from the map. */
export const wallFlyerLevels = (map) => map.levels.filter((l) => (l.entities ?? []).some((e) => e.type === 'wallflyer')).map((l) => l.level).sort((a, b) => a - b);

/** One case's staging: the base latch re-pointed at the landing, holding exactly the arm's items. */
export async function caseStaging(map, { level, from, arm }) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const door = doorsOf(map, level).find((d) => d.to === from);
    if (!door) throw new Error(`probe-seedling-wallflyer-nohit: L${level} has no door to L${from}`);
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(join(TAPES, `${BASE}.json`), 'utf8'))));
    staging.boot = { level, ...door.landing };
    staging.save = { totem_parts: [], keys: [], seal_parts: [] };
    staging.seam = { ...staging.seam, items: { ...staging.seam.items, ...Object.fromEntries(ARMS[arm].map((p) => [p, true])) } };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    staging.noDamage = false;
    return staging;
}

/** Per-tick key lists -> the tape's `{key, from, to}` spans. */
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
/** The inverse of `spansOf`. */
export function perTickOf(inputs, ticks) {
    const perTick = Array.from({ length: ticks }, () => []);
    for (const { key, from, to } of inputs) for (let t = from; t < to; t += 1) perTick[t].push(key);
    return perTick.map((k) => k.sort());
}

async function modelRun(staging) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    return createRunForStaging(JSON.parse(JSON.stringify(staging)), atlasLevelSource(), { scratchPersistence: true });
}

/** A plan on the model: the level it ends in and every hit the player took (`t:id`). */
export async function replayOnModel(map, c, perTick) {
    const run = await modelRun(await caseStaging(map, c));
    for (const keys of perTick) { run.advance(new Set(keys)); if (run.level !== c.level) break; }
    return { level: run.level, hits: run.playerHits.map((h) => `${h.t}:${h.id}`) };
}

const MOVES = Object.freeze([[], ['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right']]);

/**
 * The model search for one case: weighted A* over `macro`-tick key macros (nine moves; for a `PRESS_ARMS` arm, each
 * also with `primary` on its first tick while a body is within `near` px). A branch ends at its first hit or at a
 * wrong room. The heuristic is the tile distance to the target door over the room's non-wall cells. Deterministic.
 *
 * @returns {{found:true, perTick:string[][], nodes:number} | {found:false, nodes:number, exhausted:boolean}}
 */
export async function searchNoHit(map, c, { macro = SEARCH.macro, weight = SEARCH.weight, maxNodes = SEARCH.maxNodes, log = () => {} } = {}) {
    if (MODEL_REFUSES[c.arm]) throw new Error(`probe-seedling-wallflyer-nohit: no model search for ${c.arm}: ${MODEL_REFUSES[c.arm]}`);
    const SEM = await import(join(REPO, 'frontend/modules/flashPanel/seedlingSemantics.js'));
    const OV = await import(join(REPO, 'frontend/modules/flashPanel/seedlingPlaythroughOverlay.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const level = map.levels.find((l) => l.level === c.level);
    const goal = doorsOf(map, c.level).find((d) => d.to === c.to);
    if (!goal) throw new Error(`probe-seedling-wallflyer-nohit: L${c.level} has no door to L${c.to}`);
    const g = SEM.buildSeedlingRegionGrid({ x: 0, y: 0, w: level.width, h: level.height }, level, { tileOverride: OV.overlayTileSemantics, pixelMaskFootprints: true });
    const W = g.width;
    const H = g.height;
    const clamp = (v, hi) => Math.max(0, Math.min(hi - 1, v));
    const dist = new Array(W * H).fill(Infinity);
    const start = [clamp(Math.floor(goal.x / TILE), W), clamp(Math.floor(goal.y / TILE), H)];
    dist[start[1] * W + start[0]] = 0;
    for (const queue = [start]; queue.length;) {
        const [x, y] = queue.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || g.cells[ny * W + nx].kind === 'wall' || dist[ny * W + nx] < Infinity) continue;
            dist[ny * W + nx] = dist[y * W + x] + 1;
            queue.push([nx, ny]);
        }
    }
    const staging = await caseStaging(map, c);
    const source = atlasLevelSource();
    const actions = [...MOVES.map((m) => ({ m, p: false })), ...(PRESS_ARMS.includes(c.arm) ? MOVES.map((m) => ({ m, p: true })) : [])];
    const ticksOf = (path) => [
        ...Array.from({ length: SEARCH.lead }, () => []),
        ...path.flatMap((a) => Array.from({ length: macro }, (_, i) => (actions[a].p && i === 0 ? [...actions[a].m, 'primary'] : [...actions[a].m]))),
    ];
    const evaluate = (path) => {
        const run = createRunForStaging(JSON.parse(JSON.stringify(staging)), source, { scratchPersistence: true });
        try {
            for (const keys of ticksOf(path)) { run.advance(new Set(keys)); if (run.level !== c.level) break; }
        } catch { return { dead: true }; }
        if (run.playerHits.length) return { dead: true };
        if (run.level !== c.level) return run.level === c.to ? { goal: true } : { dead: true };
        const s = run.state;
        const bodies = [...run.wallFlyers.bodies, ...(run.chasers ?? [])];
        const key = [`${Math.round(s.x / 2)},${Math.round(s.y / 2)}`,
            ...run.wallFlyers.bodies.map((w) => `${w.x},${w.y},${Math.sign(w.vx)},${Math.sign(w.vy)},${w.hits},${w.destroy ? 1 : 0},${w.dieAnim ? 1 : 0}`),
            ...(run.chasers ?? []).map((b) => `${Math.round(b.x / 4)},${Math.round(b.y / 4)},${b.hits ?? 0},${b.removed || b.destroy ? 1 : 0}`)].join(';');
        return { key, h: (dist[clamp(Math.floor(s.y / TILE), H) * W + clamp(Math.floor(s.x / TILE), W)] * TILE) / SEARCH.speed,
            near: bodies.some((b) => !b.removed && Math.hypot(b.x - s.x, b.y - s.y) < SEARCH.near), x: s.x, y: s.y };
    };
    const heap = [];
    const push = (n) => {
        heap.push(n);
        for (let i = heap.length - 1; i > 0;) {
            const p = (i - 1) >> 1;
            if (heap[p].f <= heap[i].f) break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
        }
    };
    const pop = () => {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            for (let i = 0; ;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;
                if (l < heap.length && heap[l].f < heap[m].f) m = l;
                if (r < heap.length && heap[r].f < heap[m].f) m = r;
                if (m === i) break;
                [heap[m], heap[i]] = [heap[i], heap[m]];
                i = m;
            }
        }
        return top;
    };
    const root = evaluate([]);
    if (root.dead) return { found: false, nodes: 0, exhausted: true };
    const seen = new Set([root.key]);
    push({ path: [], f: root.h, near: root.near });
    let nodes = 0;
    let best = Infinity;
    while (heap.length && nodes < maxNodes) {
        const n = pop();
        for (let a = 0; a < actions.length; a += 1) {
            if (actions[a].p && !n.near) continue;
            const path = [...n.path, a];
            const r = evaluate(path);
            nodes += 1;
            if (r.goal) return { found: true, perTick: [...ticksOf(path), ...Array.from({ length: SEARCH.tail }, () => [])], nodes };
            if (r.dead || seen.has(r.key)) continue;
            seen.add(r.key);
            if (r.h < best) { best = r.h; log(`  nearest so far: (${r.x.toFixed(0)},${r.y.toFixed(0)}) after ${path.length * macro} ticks, ${nodes} nodes`); }
            push({ path, f: path.length * macro + weight * r.h, near: r.near });
        }
    }
    return { found: false, nodes, exhausted: heap.length === 0 };
}

/**
 * `--chest`: the walks at L25's chest. `way` is tile cells the player's centre is walked to in order (from the landing
 * of `from`'s door), `holds` the key holds after it, `expect` what the game should show.
 */
export const CHEST_CASES = Object.freeze([
    { name: 'l25-22-chest-east', level: 25, from: 22, way: [[7, 2], [7, 6]], holds: [[['left', 'down'], 45]], expect: 'shut' },
    { name: 'l25-22-chest-above', level: 25, from: 22, way: [[7, 2], [7, 5], [6, 5]], holds: [[['down'], 35]], expect: 'shut' },
    { name: 'l25-28-chest-below', level: 25, from: 28, way: [], holds: [[[], 70], [['up'], 90]], expect: 'open' },
]);
/** The one chest of a level, as its Solid rect (`Chest.as`: a 16x16 hitbox on its tile). */
export function chestOf(map, levelNo) {
    const chests = (map.levels.find((l) => l.level === levelNo)?.entities ?? []).filter((e) => e.type === 'chest');
    if (chests.length !== 1) throw new Error(`probe-seedling-wallflyer-nohit: L${levelNo} holds ${chests.length} chests, not one`);
    return { x: chests[0].x, y: chests[0].y, right: chests[0].x + TILE, bottom: chests[0].y + TILE };
}
/** A chest case's keys: the waypoint walk and the holds, played on the model (which only chooses the keys). */
export async function chestCaseKeys(map, c) {
    const run = await modelRun(await caseStaging(map, { level: c.level, from: c.from, arm: 'none' }));
    const perTick = [];
    const advance = (keys) => { run.advance(new Set(keys)); perTick.push([...keys].sort()); };
    for (let i = 0; i < SEARCH.lead; i += 1) advance([]);
    for (const [tx, ty] of c.way) {
        const wx = tx * TILE + TILE / 2;
        const wy = ty * TILE + TILE / 2;
        for (let n = 0; n < 400 && run.level === c.level; n += 1) {
            const dx = wx - run.state.x;
            const dy = wy - run.state.y;
            if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) break;
            advance([...(dx > 1.4 ? ['right'] : dx < -1.4 ? ['left'] : []), ...(dy > 1.4 ? ['down'] : dy < -1.4 ? ['up'] : [])]);
        }
    }
    for (const [keys, ticks] of c.holds) for (let i = 0; i < ticks && run.level === c.level; i += 1) advance(keys);
    return { perTick, model: { level: run.level, x: run.state.x, y: run.state.y, hits: run.playerHits.map((h) => `${h.t}:${h.id}`) } };
}
/**
 * What a run's observations say about the chest: `inChest` / `under` = how many have the player's centre in the chest's
 * cell / in the cell under it (the only place its opening line is touched from). A closed chest is a Solid, so a centre
 * inside its cell means it opened. `centre` maps an observation to the player's centre.
 */
export function readChestRun(ticks, chest, centre = (o) => ({ x: o.x, y: o.y })) {
    const inRect = (p, r) => p.x >= r.x && p.x < r.right && p.y >= r.y && p.y < r.bottom;
    const below = { x: chest.x, y: chest.bottom, right: chest.right, bottom: chest.bottom + TILE };
    return { inChest: ticks.filter((o) => inRect(centre(o), chest)).length, under: ticks.filter((o) => inRect(centre(o), below)).length,
        levels: [...new Set(ticks.map((o) => o.level))], final: ticks.at(-1) ?? null };
}

export const readPlans = (file = PLANS_FILE) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { plans: {}, notFound: {} });

/** A case's tape for the game: the staging, the keys, nothing disabled. */
export async function caseTape(map, name, perTick) {
    const { requiredTapeVersion } = await import(join(MODULE, 'tapeFormat.js'));
    const staging = await caseStaging(map, parseCase(name));
    const t = { ...staging, game: 'seedling', name: `wallflyer-nohit-${name}`, description: `probe-seedling-wallflyer-nohit: ${name}`,
        noclip: false, noDamage: false, noHazards: [], grants: [], equips: [], tick_count: perTick.length, inputs: spansOf(perTick) };
    return { ...t, tape_version: requiredTapeVersion(t, 8) };
}

/**
 * What one game run says: the levels seen, where it ended, the most hits any sample held, and `respawns` (the
 * observations where the player is back on the boot point after having left it: a death puts it there).
 */
export function readRun(ticks, { maxHits = 0 } = {}) {
    const start = ticks[0] ?? null;
    let away = false;
    let respawns = 0;
    for (const o of ticks) {
        if (!start || o.level !== start.level) { away = true; continue; }
        const home = Math.abs(o.x - start.x) < 0.5 && Math.abs(o.y - start.y) < 0.5;
        if (home && away) respawns += 1;
        away = !home;
    }
    return { levels: [...new Set(ticks.map((o) => o.level))], maxHits, respawns, final: ticks.at(-1) ?? null };
}
/** A no-hit crossing: ended in the target room, having started in the case's, with no hit and no respawn. */
export const isNoHitCrossing = (c, r) => r.final?.level === c.to && r.levels[0] === c.level && r.maxHits === 0 && r.respawns === 0;

/** Every wallflyer room's flight bands (`seedlingWallFlyerBands`), for the `BAND` rows. */
export async function bandRows(map) {
    const { buildLevelWorld } = await import(join(MODULE, 'levelWorld.js'));
    const { wallFlyerBands } = await import(join(REPO, 'frontend/modules/flashPanel/seedlingWallFlyerBands.js'));
    return wallFlyerLevels(map).flatMap((n) => {
        const level = map.levels.find((l) => l.level === n);
        return wallFlyerBands(level, buildLevelWorld(level)).map((b) => ({ level: n, ...b }));
    });
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const map = readMap();
    const stored = readPlans();

    const searchFor = arg('search', null)?.split(',');
    if (searchFor) {
        const maxNodes = Number(arg('max-nodes', String(SEARCH.maxNodes)));
        for (const name of searchFor) {
            const c = parseCase(name);
            const t0 = Date.now();
            const r = await searchNoHit(map, c, { maxNodes, log: (s) => console.log(s) });
            delete stored.plans[name];
            delete stored.notFound[name];
            if (r.found) {
                stored.plans[name] = { ticks: r.perTick.length, inputs: spansOf(r.perTick), search: { nodes: r.nodes, macro: SEARCH.macro, weight: SEARCH.weight } };
            } else {
                stored.notFound[name] = { nodes: r.nodes, exhausted: r.exhausted, macro: SEARCH.macro, weight: SEARCH.weight };
            }
            console.log(`INFO ${JSON.stringify({ search: name, found: r.found, nodes: r.nodes, ...(r.found ? { ticks: r.perTick.length } : { exhausted: r.exhausted }), ms: Date.now() - t0 })}`);
        }
        if (process.argv.includes('--write')) {
            const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
            writeFileSync(PLANS_FILE, `${JSON.stringify({ $comment: stored.$comment, plans: sorted(stored.plans), notFound: sorted(stored.notFound) })}\n`);
            console.log(`wrote ${PLANS_FILE}`);
        }
        return;
    }

    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(MODULE, p));
    const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const EMBED = JSON.parse(readFileSync(join(MODULE, 'fixtures/seedling-vanilla-set.json'), 'utf8'));
    const set = vanillaRecordSet(EMBED, map).set;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-wallflyer-nohit.mjs', kind: 'browser' });
    for (const b of await bandRows(map)) console.log(`BAND ${JSON.stringify(b)}`);
    for (const [name, row] of Object.entries(stored.notFound)) console.log(`INFO ${JSON.stringify({ notFound: name, ...row })}`);
    for (const [arm, why] of Object.entries(MODEL_REFUSES)) console.log(`INFO ${JSON.stringify({ modelRefuses: arm, why })}`);

    const only = arg('only', null)?.split(',');
    const cases = [];
    for (const [name, p] of Object.entries(stored.plans)) cases.push({ name, perTick: perTickOf(p.inputs, p.ticks) });
    const picked = cases.filter((c) => !only || only.includes(c.name));

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
    const play = async (tape) => {
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
            // The most hits any status sample held (the game's `hits` counts hits TAKEN and resets on a level change).
            let maxHits = 0;
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = JSON.parse(String(await page.evaluate(() => window.__swfBridge.game.botStatus())));
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                maxHits = Math.max(maxHits, st?.hits ?? 0);
                return st?.finished ? st : null;
            }, 15 * 60 * 1000, 20);
            const drained = await json(page, 'botDrain');
            return { mounted, maxHits,
                items: Object.entries(status.items ?? {}).filter(([, v]) => v === true).map(([k]) => k).sort(),
                ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
        } finally {
            await page.close();
        }
    };
    try {
        const repeat = Math.max(1, Number(arg('repeat', '1')) || 1);
        if (process.argv.includes('--chest')) {
            for (const c of CHEST_CASES.filter((x) => !only || only.includes(x.name)).flatMap((e) => Array(repeat).fill(e))) {
                const chest = chestOf(map, c.level);
                const { perTick, model } = await chestCaseKeys(map, c);
                const staging = await caseStaging(map, { level: c.level, from: c.from, arm: 'none' });
                const { requiredTapeVersion } = await M('tapeFormat.js');
                const t = { ...staging, game: 'seedling', name: `wallflyer-nohit-${c.name}`, description: `probe-seedling-wallflyer-nohit --chest: ${c.name}`,
                    noclip: false, noDamage: false, noHazards: [], grants: [], equips: [], tick_count: perTick.length, inputs: spansOf(perTick) };
                const tape = parseTape({ ...t, tape_version: requiredTapeVersion(t, 8), pins: [...PIN_NAMES] });
                const g = await play(tape);
                // Read every observation relative to the first, which is the landing (its cell's centre, as the model reports it).
                const off = { x: tape.boot.x + TILE / 2 - (g.ticks[0]?.x ?? 0), y: tape.boot.y + TILE / 2 - (g.ticks[0]?.y ?? 0) };
                const read = readChestRun(g.ticks, chest, (o) => ({ x: o.x + off.x, y: o.y + off.y }));
                console.log(`ROW ${JSON.stringify({ case: c.name, expect: c.expect, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                    boot: tape.boot, chest, centreOffset: off, maxHits: g.maxHits, model, ...read })}`);
                if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
                check(`${c.name}: the game ran the tape to its end on the delivered set`,
                    g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
                check(`${c.name}: the GAME stays in L${c.level}`, read.levels.length === 1 && read.levels[0] === c.level, JSON.stringify(read.levels));
                if (c.expect === 'shut') {
                    check(`${c.name}: from L${c.from}'s door the player never stands in the chest's cell or under it (the chest stays a Solid, unopened)`,
                        read.inChest === 0 && read.under === 0, JSON.stringify(read));
                } else {
                    check(`${c.name}: from L${c.from}'s door the player lands under the chest and then walks up THROUGH its cell (it opened)`,
                        read.under > 0 && read.inChest > 0, JSON.stringify(read));
                }
            }
            console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
            await browser.close();
            process.exit(failed === 0 ? 0 : 1);
        }
        for (const { name, perTick } of picked.flatMap((e) => Array(repeat).fill(e))) {
            const c = parseCase(name);
            const model = await replayOnModel(map, c, perTick);
            const tape = parseTape({ ...await caseTape(map, name, perTick), pins: [...PIN_NAMES] });
            const g = await play(tape);
            const read = readRun(g.ticks, { maxHits: g.maxHits });
            console.log(`ROW ${JSON.stringify({ case: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                boot: tape.boot, held: g.items, model, ...read })}`);
            if (process.argv.includes('--dump')) console.log(`TICKS ${g.ticks.filter((o) => o.t % 10 === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            check(`${name}: the model lands in L${c.to} with no hit`, model.level === c.to && model.hits.length === 0, JSON.stringify(model));
            check(`${name}: the GAME lands in L${c.to} from L${c.from}'s door holding [${ARMS[c.arm].join(', ') || 'no item'}], with no hit taken`,
                isNoHitCrossing(c, read), JSON.stringify(read));
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
