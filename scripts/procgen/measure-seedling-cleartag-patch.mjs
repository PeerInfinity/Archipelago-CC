#!/usr/bin/env node
/**
 * measure-seedling-cleartag-patch — **THE FALLBACK, MEASURED, NOT APPLIED**
 * (Seedling fidelity CLEARTAG, D4). Pure node: no browser, no box lock.
 *
 * ⚖ The user (2026-10-06): *"if the changes required cause other problems,
 * there is the fallback plan of modifying the Seedling levels so that the
 * breakable obstacles aren't at the edge of the screen. I'm currently
 * undecided which option would be better."*
 *
 * For every game-state event in the playthrough rules, the obstacle is moved
 * ONE OBSTACLE-WIDTH INWARD — away from the landing level's door back to the
 * gated landing's source (`backDoor`), which is the door the landing sits in
 * front of — on a COPY of the map document (`levelSourceFromAtlas`), and the
 * model is asked:
 *   · `free`       — every gated landing's box is now outside every solid;
 *   · `into`       — what the moved obstacle's new cell held before (`open`, or
 *                    the terrain/solid it would be stacked on: a move into a
 *                    wall is not a move);
 *   · `pocket`     — with the flag HELD, the doors the landing reaches by a
 *                    tile flood (the planner's own blockers): only the back door
 *                    means the obstacle still gates the room (`gates: true`);
 *   · `opened`     — the same flood with the flag CLEARED (the room it opens);
 *   · `fromPocket` — `solveSegment([clear-tag])` from the landing on the patched
 *                    map with the event's item: the obstacle broken from the
 *                    POCKET side, which is what the patch buys;
 *   · `others`     — every other landing into the level that the move puts
 *                    inside the obstacle (a patch that makes a new gate);
 *   · `tapes`      — the committed tapes whose replay visits the level (what a
 *                    model-side adoption of the patch would re-record).
 * The patch row it prints is in `seedlingSetPatches.js`'s shape; ⚠ the applier
 * has no `move` op today (`remove` and `set-attrs` only), so a move is that op
 * added or a remove + add pair — named, not written.
 *
 * USAGE: node scripts/procgen/measure-seedling-cleartag-patch.mjs [--json] [--no-tapes]
 */
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAtlas } from '../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../frontend/modules/seedlingDemo/atlasSource.js';
import { createRunForStaging, runTape } from '../../frontend/modules/seedlingDemo/tapeRunner.js';
import { parseTape } from '../../frontend/modules/seedlingDemo/tapeFormat.js';
import { arrivalStaging, gameLandings } from '../../frontend/modules/seedlingDemo/fidelityArrival.js';
import { arrivalInsideSolid } from '../../frontend/modules/seedlingDemo/arrivalSolid.js';
import { plannerObstacleAt } from '../../frontend/modules/seedlingDemo/botDriverV2.js';
import { solveSegment, SolverRefusal } from '../../frontend/modules/seedlingDemo/solverBot.js';
import { runtimeEventsOf } from '../../frontend/modules/flashPanel/seedlingPlaybackController.js';

argvHelp(import.meta.url);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULES = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
const TAPES = join(ROOT, 'frontend/modules/seedlingDemo/fixtures/tapes');
const args = process.argv.slice(2);
const ITEMS = { hasSword: ['hasSword'], hasFire: ['hasSword', 'hasFire'], hasWand: ['hasWand'], hasKey: [], null: [] };
const itemsFor = (e) => (e.obstacle.class.startsWith('shieldlock') ? ['hasShield', 'hasDarkShield']
    : ITEMS[String(e.action?.item ?? null)] ?? []);
const TILE = 16;

const ATLAS = loadAtlas();
const BASE_SRC = levelSourceFromAtlas(ATLAS);

/** The atlas doc with `fn(record)` applied to level `n`'s record (a copy; the input untouched). */
const patchedDoc = (n, fn) => ({ ...ATLAS, levels: ATLAS.levels.map((r) => (r.level === n ? fn(r) : r)) });

/**
 * Tile flood from `run.state` over the planner's own obstacle test
 * (`plannerObstacleAt`, the live geometry): the doors it touches. A door tile
 * is recorded and not expanded (stepping on it leaves the level); a proximity
 * hazard is not a wall for this question.
 */
function floodDoors(run) {
    const w = run.world;
    const opts = run.liveGeometryOpts();
    // `world.width/height` are in TILES.
    const W = w.width;
    const H = w.height;
    const start = [Math.floor(run.state.x / TILE), Math.floor(run.state.y / TILE)];
    const seen = new Set([start.join(',')]);
    const doors = new Set();
    const q = [start];
    while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx; const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(`${nx},${ny}`)) continue;
            const hit = plannerObstacleAt(w, nx * TILE + TILE / 2, ny * TILE + TILE / 2, null, opts);
            if (hit?.kind === 'teleporter') {
                const t = w.teleporters.find((tp) => tp.rect.x <= nx * TILE + 8 && nx * TILE + 8 < tp.rect.right
                    && tp.rect.y <= ny * TILE + 8 && ny * TILE + 8 < tp.rect.bottom);
                doors.add(t ? `${t.isStairs ? 'stairs' : 'tp'}@${t.x},${t.y}->L${t.to}` : `door@${nx * TILE},${ny * TILE}`);
                seen.add(`${nx},${ny}`);
                continue;
            }
            if (hit && hit.kind !== 'proximity-hazard') continue;
            seen.add(`${nx},${ny}`);
            q.push([nx, ny]);
        }
    }
    return { tiles: seen.size, doors: [...doors].sort() };
}

/** Every committed tape's visited levels (boot + transitions), from a replay. Memoised per process. */
let visitsCache = null;
function tapeVisits() {
    if (visitsCache) return visitsCache;
    visitsCache = new Map();
    const index = JSON.parse(readFileSync(join(TAPES, 'index.json'), 'utf8'));
    for (const t of index.tapes) {
        try {
            const tape = parseTape(JSON.parse(readFileSync(join(TAPES, t.file), 'utf8')));
            const out = runTape(tape, { levelSource: BASE_SRC });
            visitsCache.set(t.file, new Set([tape.boot.level, ...out.transitions.map((x) => x.to_level)]));
        } catch (e) {
            visitsCache.set(t.file, new Set([t.bootLevel, `replay-failed: ${String(e.message).slice(0, 60)}`]));
        }
    }
    return visitsCache;
}

const insideIds = (run) => (arrivalInsideSolid(run)?.solids ?? []).map((q) => q.id).sort();

/**
 * One GROUP per gated landing set: the stacked L12 locks share one landing and
 * free it only together, so they move together (one patch, two rows).
 */
function eventGroups() {
    const groups = new Map();
    for (const e of runtimeEventsOf(RULES).events) {
        const o = e.obstacle;
        const lands = gameLandings(ATLAS).filter((l) => l.level === o.level);
        const gated = lands.filter((l) => insideIds(createRunForStaging(arrivalStaging(l), BASE_SRC))
            .includes(`${o.class}@${o.x},${o.y}`));
        const key = `${o.level}|${gated.map((g) => `${g.x},${g.y}`).join(';')}`;
        if (!groups.has(key)) groups.set(key, { level: o.level, gated, lands, events: [] });
        groups.get(key).events.push(e);
    }
    return [...groups.values()];
}

/** Inward: away from the back door, on its dominant axis; away from the nearest level edge when the door is under it. */
function inward(o, size, back, world) {
    const overlaps = back.x < o.x + size.w && o.x < back.x + TILE && back.y < o.y + size.h && o.y < back.y + TILE;
    if (!overlaps) {
        const axisX = Math.abs(o.x - back.x) >= Math.abs(o.y - back.y);
        return axisX ? { dx: Math.sign(o.x - back.x), dy: 0, why: 'away from the back door' }
            : { dx: 0, dy: Math.sign(o.y - back.y), why: 'away from the back door' };
    }
    const d = [{ dx: 1, dy: 0, m: o.x }, { dx: -1, dy: 0, m: world.width * TILE - (o.x + size.w) },
        { dx: 0, dy: 1, m: o.y }, { dx: 0, dy: -1, m: world.height * TILE - (o.y + size.h) }].sort((a, b) => a.m - b.m)[0];
    return { dx: d.dx, dy: d.dy, why: 'the back door is under the obstacle: away from the nearest level edge' };
}

export function patchCensus({ tapes = true } = {}) {
    const rows = [];
    const visits = tapes ? tapeVisits() : null;
    for (const g of eventGroups()) {
        const L = g.gated[0];
        const baseRun = createRunForStaging(arrivalStaging(L), BASE_SRC);
        const rec = ATLAS.levels.find((r) => r.level === g.level);
        const back = baseRun.world.teleporters.filter((t) => t.to === L.from)
            .sort((a, b) => Math.hypot(a.x - L.x, a.y - L.y) - Math.hypot(b.x - L.x, b.y - L.y))[0];
        const moves = g.events.map((e) => {
            const o = e.obstacle;
            const ent = rec.entities.find((x) => x.type === o.class && x.x === o.x && x.y === o.y);
            const solid = baseRun.world.solids.find((q) => q.tag === o.class && q.x === o.x && q.y === o.y);
            const size = { w: solid.rect.w, h: solid.rect.h };
            const dir = inward(o, size, back, baseRun.world);
            const to = { x: o.x + dir.dx * size.w, y: o.y + dir.dy * size.h };
            const into = [];
            for (let y = to.y; y < to.y + size.h; y += TILE) {
                for (let x = to.x; x < to.x + size.w; x += TILE) {
                    const hit = plannerObstacleAt(baseRun.world, x + 8, y + 8, null, baseRun.liveGeometryOpts());
                    const self = g.events.some((q) => hit?.blocker?.tag === q.obstacle.class
                        && hit?.blocker?.x === q.obstacle.x && hit?.blocker?.y === q.obstacle.y);
                    if (hit && !self) into.push(`${hit.kind}${hit.blocker?.tag ? `:${hit.blocker.tag}` : ''}@${x},${y}`);
                }
            }
            return { e, o, ent, size, dir, to, into };
        });
        const doc = patchedDoc(g.level, (r) => ({
            ...r, entities: r.entities.map((x) => {
                const m = moves.find((q) => q.ent === x);
                return m ? { ...x, x: m.to.x, y: m.to.y } : x;
            }),
        }));
        const SRC = levelSourceFromAtlas(doc);
        const free = g.gated.map((l) => {
            const ins = insideIds(createRunForStaging(arrivalStaging(l), SRC));
            return { landing: `L${l.from} ${l.door} -> (${l.x},${l.y})`, inside: ins };
        });
        const tags = moves.map((m) => m.o.tag);
        const pocket = floodDoors(createRunForStaging(arrivalStaging(L), SRC));
        const opened = floodDoors(createRunForStaging(arrivalStaging(L, { cleared: tags }), SRC));
        const gates = pocket.doors.every((d) => d.endsWith(`->L${L.from}`)) && opened.doors.length > pocket.doors.length;
        // The other landings whose inside-set the move CHANGED (a new gate, or one it freed).
        const others = g.lands.filter((l) => !g.gated.includes(l)).map((l) => {
            const before = insideIds(createRunForStaging(arrivalStaging(l), BASE_SRC));
            const after = insideIds(createRunForStaging(arrivalStaging(l), SRC));
            return JSON.stringify(before) === JSON.stringify(after) ? null
                : `L${l.from} ${l.door} -> (${l.x},${l.y}): [${before.join('+')}] -> [${after.join('+')}]`;
        }).filter(Boolean);
        // The clear from the POCKET side, each event in turn (stacked locks: the first, then both).
        const fromPocket = [];
        for (const m of moves) {
            const st = arrivalStaging(L, { items: itemsFor(m.e) });
            const others2 = moves.filter((q) => q !== m).map((q) => q.o.tag);
            const staged = { ...st, ...(others2.length ? { persistence: others2.map((tag) => ({ level: g.level, tag, note: 'stacked: the other lock cleared' })) } : {}),
                ...(m.e.action?.item === 'hasKey' ? { save: { totem_parts: [], seal_parts: [], ...(st.save ?? {}), keys: [0, 1, 2, 3, 4] } } : {}) };
            try {
                const run = createRunForStaging(staged, SRC);
                const out = solveSegment({ run, goals: [{ kind: 'clear-tag', tag: { level: g.level, tag: m.o.tag },
                    at: { ...m.to }, obstacle: `${m.o.class}@${m.to.x},${m.to.y}` }], name: `cleartag-patch-${g.level}-${m.o.tag}`,
                boot: { level: L.level, x: L.x, y: L.y } });
                const r2 = out.records.find((x) => x.goal === 'clear-tag');
                fromPocket.push({ event: m.e.eventId, verdict: 'SOLVES', ticks: out.perTick.length, verb: r2.strategy ?? null,
                    ...(others2.length ? { staged: `the other lock cleared: ${others2.join(',')}` } : {}) });
            } catch (err) {
                if (!(err instanceof SolverRefusal)) throw err;
                fromPocket.push({ event: m.e.eventId, verdict: 'REFUSES', kind: err.obstacle?.kind, reason: err.obstacle?.reason ?? null,
                    why: String(err.message).slice(0, 220) });
            }
        }
        const crossing = visits ? [...visits].filter(([, v]) => v.has(g.level)).map(([f]) => f) : null;
        rows.push({
            events: moves.map((m) => m.e.eventId), level: g.level, backDoor: `${back.x},${back.y}->L${L.from}`,
            patches: moves.map((m) => ({ level: g.level, op: 'move', match: { type: m.o.class, x: m.o.x, y: m.o.y, attrs: m.ent.attrs },
                to: m.to, why: m.dir.why, into: m.into.length ? m.into : ['open'] })),
            free, pocket, opened, gates, fromPocket, others,
            tapes: crossing ? { count: crossing.length, files: crossing } : null,
        });
    }
    return rows;
}

if (isEntryPoint(import.meta.url)) {
    const rows = patchCensus({ tapes: !args.includes('--no-tapes') });
    if (args.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ source: 'measure-seedling-cleartag-patch.mjs', rows }, null, 1)}\n`);
    } else {
        for (const r of rows) {
            console.log(`${r.events.join(' + ')} [back door ${r.backDoor}]`);
            for (const p of r.patches) console.log(`  move ${p.match.type}@${p.match.x},${p.match.y} -> (${p.to.x},${p.to.y}) (${p.why}); into: ${p.into.join(', ')}`);
            console.log(`  free: ${r.free.map((f) => `${f.landing} ${f.inside.length ? `STILL INSIDE ${f.inside.join('+')}` : 'free'}`).join(' | ')}`);
            console.log(`  pocket (held): ${r.pocket.tiles} tiles, doors [${r.pocket.doors.join(', ')}]`);
            console.log(`  opened (cleared): ${r.opened.tiles} tiles, ${r.opened.doors.length} doors; still gates: ${r.gates}`);
            for (const f of r.fromPocket) {
                console.log(`  from the pocket ${f.event}: ${f.verdict} ${f.verdict === 'SOLVES'
                    ? `${f.ticks} t ${f.verb}${f.staged ? ` (${f.staged})` : ''}` : `${f.kind}/${f.reason} ${f.why}`}`);
            }
            console.log(`  other landings changed: ${r.others.length ? r.others.join(' | ') : 'none'}`);
            if (r.tapes) console.log(`  committed tapes visiting L${r.level}: ${r.tapes.count}`);
        }
    }
}
