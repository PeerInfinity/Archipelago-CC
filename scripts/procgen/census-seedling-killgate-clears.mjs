#!/usr/bin/env node
/**
 * census-seedling-killgate-clears — **WHAT ACTUALLY OPENS THE KILL GATE'S
 * LOCK**, and where the body was when it stopped being alive.
 *
 * PROCGEN ELEMENTS arc 3, slice 4d, D3(i). ⛔ MEASURED BEFORE THE DEMAND WAS
 * DESIGNED. 4c §13.13 found the arc's only rich post-sword seed clearing its
 * kill lock with `cause:'water'` — pass-2 furniture DROWNED the spinner, and
 * the gate opened for a reason the level did not pose. This census asks how
 * often that happens, on which cells, and how far from the pocket.
 *
 * ⛔ THE SOLVE IS ON THE **FINAL** LEVEL, never on the skeleton: the whole
 * point is what pass 2 painted.
 *
 * Columns per (arm, seed): placed / certified / the FINAL solve's verdict, the
 * `scratchClears` row for THIS element's lock (`cause`, `by`, `at`), the lethal
 * (water/pit) cells the level holds and which kept template painted them, and
 * the BODY'S REACHABLE CELL SET — a bounded run of `stepSpinner` itself from
 * the pocket with the door WALLED, which is the geometry a demand would have to
 * name.
 *
 * Run:
 *   node scripts/procgen/census-seedling-killgate-clears.mjs --seeds=1-40
 *   node scripts/procgen/census-seedling-killgate-clears.mjs --seeds=1-40 --json=/tmp/x.json
 */

import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..'));
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const CORE = (p) => import(join(REPO, 'frontend/modules/procgenCore', p));

const { DEFAULT_BOUNDS } = await CORE('levelGenerator.js');
const { parseElementSpec } = await CORE('elementSpec.js');
const { DEFAULT_BUDGET, bootStaging, solve } = await M('procgenOracle.js');
const { POST_SWORD_PALETTE, instantiateKept } = await M('procgenPalette.js');
const { generateSeedlingLevel, seedlingSkeletonSpec } = await M('procgenSeedling.js');
const { terrainAt } = await M('procgenLevel.js');
const { TILE_SIZE } = await M('levelWorld.js');
const { SPINNER, newSpinner, spinnerRect, stepSpinner } = await M('spinner.js');

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`)
    .slice(`--${n}=`.length);
const say = (l = '') => process.stdout.write(`${l}\n`);

const [S0, S1] = arg('seeds', '1-40').split('-').map(Number);
const SEEDS = Array.from({ length: S1 - S0 + 1 }, (_, i) => S0 + i);
const BUDGET = Object.freeze({ ...DEFAULT_BUDGET });
const BOUNDS = DEFAULT_BOUNDS;
/** ⛓ The body's walk is bounded by the SAME number the solver's is — one
 *  `maxTicksPerTarget`. A reachable set measured over a longer run than any
 *  solve can last would name cells no route could ever be hurt by. */
const WALK_TICKS = BUDGET.maxTicksPerTarget;

/**
 * ⛓ THE SKELETON KINDS THE CENSUS SWEEPS. `empty` alone is the DEFAULT room and
 * it is a bad host for a kill gate (a 10x10 open room offers few main-path cuts
 * whose wall the law will accept); the carved kinds are where 4b's stamped
 * chamber gives the gate somewhere to be, so the demand's PRICE has to be
 * measured there too.
 */
const KINDS = arg('kinds', 'empty').split(',').map((k) => k.trim()).filter(Boolean);

const ARMS = [
    { name: 'DEFAULT', elements: undefined },
    { name: 'killgate', elements: parseElementSpec('killgate') },
];

/** Every cell of the record, by terrain name. */
function terrainGrid(record) {
    const g = [];
    for (let y = 0; y < record.height; y += 1) {
        g.push([]);
        for (let x = 0; x < record.width; x += 1) g[y].push(terrainAt(record, x, y));
    }
    return g;
}

/**
 * ⛓⛓⛓ **THE BODY'S REACHABLE SET, RUN THROUGH `stepSpinner` ITSELF** — not a
 * model of it. The spinner's ctor heading is `-PI/4` (`SPINNER.heading`), so the
 * motion is DIAGONAL and not axis-aligned; the only honest way to say where it
 * goes is to step it.
 *
 * Solids: the level's WALL cells, plus the element's own DOOR cell — a `lock`
 * is Solid, and while the body is alive the door is shut, so the body is
 * confined to the START side by construction.
 * ⛔ `noTerrain: true` — this run asks WHERE IT GOES, not what kills it.
 */
function reachableCells(grid, door, pocket, ticks = WALK_TICKS) {
    const solid = (tx, ty) => tx < 0 || ty < 0 || ty >= grid.length || tx >= grid[0].length
        || grid[ty][tx] === 'wall' || (tx === door.x && ty === door.y);
    const collides = (r) => {
        for (let ty = Math.floor(r.y / TILE_SIZE); ty <= Math.floor((r.bottom - 1) / TILE_SIZE); ty += 1) {
            for (let tx = Math.floor(r.x / TILE_SIZE); tx <= Math.floor((r.right - 1) / TILE_SIZE); tx += 1) {
                if (solid(tx, ty)) return { tx, ty };
            }
        }
        return null;
    };
    let s = newSpinner({ id: 'census', x: pocket.x * TILE_SIZE, y: pocket.y * TILE_SIZE });
    const seen = new Map();
    for (let t = 0; t < ticks; t += 1) {
        const tx = Math.floor(s.x / TILE_SIZE);
        const ty = Math.floor(s.y / TILE_SIZE);
        const k = `${tx},${ty}`;
        if (!seen.has(k)) seen.set(k, t);
        s = stepSpinner(s, { collides: (rect) => collides(rect), noTerrain: true });
    }
    return seen;
}

/**
 * ⛓⛓⛓ **THE DEMAND-SET CANDIDATE, GEOMETRIC — the 4-connected flood of SKELETON
 * GROUND from the pocket with the element's DOOR CELL treated as WALL.**
 *
 * ⛔ IT IS A STRICT SUPERSET OF ANY BODY PATH, and that is an argument rather
 * than a hope: the body's 7x7 box lives inside the 16x16 cell its centre is in,
 * so the centre can only be in a NON-SOLID cell, and to move between two cells
 * the box straddles their shared edge — which a diagonal-only contact cannot
 * offer. ⇒ the centre's cell path is 4-connected through non-solid cells, and
 * the flood contains it. Measured against the stepped set below rather than
 * asserted.
 *
 * `boundary` = the WALL cells 4-adjacent to the region. They are demanded too,
 * as `wall`: pass 2 may CARVE, and a carve on the region's edge would let the
 * body OUT of the set this was computed on.
 */
function floodRegion(grid, door, pocket) {
    const H = grid.length;
    const W = grid[0].length;
    const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H
        || grid[y][x] === 'wall' || (x === door.x && y === door.y);
    const seen = new Set([`${pocket.x},${pocket.y}`]);
    const boundary = new Set();
    const stack = [pocket];
    while (stack.length) {
        const c = stack.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = c.x + dx;
            const y = c.y + dy;
            const k = `${x},${y}`;
            if (solid(x, y)) {
                if (x >= 0 && y >= 0 && x < W && y < H && grid[y][x] === 'wall') boundary.add(k);
                continue;
            }
            if (seen.has(k)) continue;
            seen.add(k);
            stack.push({ x, y });
        }
    }
    return { region: seen, boundary };
}

const rows = [];
for (const kind of KINDS) {
  const SKELETON = seedlingSkeletonSpec(kind);
  for (const arm of ARMS) {
    for (const seed of SEEDS) {
        const row = { kind, arm: arm.name, seed };
        let out;
        try {
            out = generateSeedlingLevel({ seed, palette: POST_SWORD_PALETTE, bounds: BOUNDS,
                budget: BUDGET, skeleton: SKELETON, elements: arm.elements });
        } catch (e) {
            row.outcome = e.name === 'GenerationAborted' ? 'ABORTED' : `THREW:${e.name}`;
            row.detail = e.message.slice(0, 200);
            rows.push(row);
            continue;
        }
        const info = out.model.elements;
        const head = out.model.elementHead?.name ?? null;
        row.head = head;
        row.placed = Boolean(info.ran && info.placed.length);
        row.certified = out.certification?.certified ?? null;
        row.gap = out.certification?.gap ?? null;
        if (head !== 'killgate' || !row.placed) {
            row.outcome = head === 'killgate'
                ? (out.certification && !out.certification.certified
                    ? 'DROPPED' : 'REFUSED')
                : 'not-a-killgate';
            row.refusal = info.refused?.reason ?? null;
            rows.push(row);
            continue;
        }
        const p = out.model.elements.placed[0];
        const door = p.doorCell;
        const pocket = p.clearer[0];
        row.door = `${door.x},${door.y}`;
        row.pocket = `${pocket.x},${pocket.y}`;
        row.keptCount = out.summary.keptCount;
        // ── the FINAL level's solve ───────────────────────────────────
        let solved;
        try {
            solved = solve(out.record, bootStaging({ boot: out.model.boot(),
                items: POST_SWORD_PALETTE.items ?? null, pins: out.summary.pins }),
            out.model.goals, BUDGET, { name: `census-${kind}-s${seed}-${arm.name}` });
        } catch (e) {
            row.outcome = `FINAL SOLVE THREW:${e.name}`;
            row.detail = e.message.slice(0, 200);
            rows.push(row);
            continue;
        }
        row.outcome = solved.verdict;
        row.ticks = solved.ticks ?? null;
        const lockId = `lock@${door.x * TILE_SIZE},${door.y * TILE_SIZE}`;
        const clear = (solved.scratchClears ?? []).find((c) => c.lock === lockId) ?? null;
        row.cleared = Boolean(clear);
        row.cause = clear?.cause ?? null;
        row.by = clear?.by ?? null;
        row.at = clear?.at ?? null;
        // ── the lethal terrain the FINAL level holds, and who painted it ──
        const grid = terrainGrid(out.record);
        /** ⛔ THE FLOOD IS COMPUTED ON THE **SKELETON**, which is what a
         *  construct-time demand can see; the lethal cells come from the FINAL
         *  level, which is what pass 2 painted. */
        const skelGrid = terrainGrid(out.model.skeleton());
        const lethal = [];
        for (let y = 0; y < grid.length; y += 1) {
            for (let x = 0; x < grid[y].length; x += 1) {
                if (grid[y][x] === 'water' || grid[y][x] === 'pit') lethal.push({ x, y, t: grid[y][x] });
            }
        }
        row.lethalCount = lethal.length;
        // ── the body's reachable set, and the intersection ────────────
        const seen = reachableCells(grid, door, pocket);
        row.reachCount = seen.size;
        const hits = lethal.filter((c) => seen.has(`${c.x},${c.y}`));
        row.lethalInReach = hits.length;
        row.lethalInReachCells = hits.map((c) => `${c.t}@${c.x},${c.y}(t=${seen.get(`${c.x},${c.y}`)})`);
        row.reachCells = [...seen.keys()];
        /** ⛓ THE GEOMETRIC CANDIDATE, measured against the stepped set. */
        const flood = floodRegion(skelGrid, door, pocket);
        row.floodCount = flood.region.size;
        row.boundaryCount = flood.boundary.size;
        row.floodIsSuperset = [...seen.keys()].every((k) => flood.region.has(k));
        row.lethalInFlood = lethal.filter((c) => flood.region.has(`${c.x},${c.y}`)).length;
        /** ⛓ Which kept template painted each hit — the attribution D3(i) owes. */
        row.painters = hits.map((c) => {
            const k = (out.summary.kept ?? []).find((kk) => {
                const conc = instantiateKept(POST_SWORD_PALETTE, kk);
                return (conc.terrain ?? []).some((w) => kk.at.tx + w.dx === c.x
                    && kk.at.ty + w.dy === c.y && w.terrain === c.t);
            });
            return `${c.t}@${c.x},${c.y}<-${k?.instance ?? k?.template ?? 'unknown'}`;
        });
        row.chebyshevToPocket = hits.map((c) => Math.max(Math.abs(c.x - pocket.x), Math.abs(c.y - pocket.y)));
        rows.push(row);
    }
  }
}

// ── the report ────────────────────────────────────────────────────────
say('# census-seedling-killgate-clears — what opens the kill gate\'s lock');
say('');
say(`kinds ${KINDS.join(',')}, seeds ${S0}..${S1}, post-sword, bounds obstacleTarget=${BOUNDS.obstacleTarget}, `
    + `budget maxTicksPerTarget=${BUDGET.maxTicksPerTarget}, walk ${WALK_TICKS} ticks`);
say('');
say('| kind | arm | seed | head | placed | cert | final | cleared | cause | lethal | inReach | flood | inFlood | reach | painters |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    say(`| ${r.kind} | ${r.arm} | ${r.seed} | ${r.head ?? '-'} | ${r.placed ?? '-'} | ${r.certified ?? '-'} `
        + `| ${r.outcome} | ${r.cleared ?? '-'} | ${r.cause ?? '-'} | ${r.lethalCount ?? '-'} `
        + `| ${r.lethalInReach ?? '-'} | ${r.floodCount ?? '-'} | ${r.lethalInFlood ?? '-'} `
        + `| ${r.reachCount ?? '-'} | ${(r.painters ?? []).join(' ') || '-'} |`);
}
say('');
const gates = rows.filter((r) => r.head === 'killgate' && r.placed);
const cleared = gates.filter((r) => r.cleared);
const causes = {};
for (const r of cleared) causes[r.cause] = (causes[r.cause] ?? 0) + 1;
say(`## ROLL-UP`);
say(`placed kill gates: ${gates.length} of ${rows.length} cells`);
say(`certified: ${gates.filter((r) => r.certified).length}`);
say(`locks that CLEARED at all: ${cleared.length}`);
say(`causes: ${JSON.stringify(causes)}`);
say(`gates whose reachable set holds LETHAL terrain: `
    + `${gates.filter((r) => (r.lethalInReach ?? 0) > 0).length}`);
say(`  ... of those, cause=sword: ${gates.filter((r) => (r.lethalInReach ?? 0) > 0 && r.cause === 'sword').length}`);
const ch = gates.flatMap((r) => r.chebyshevToPocket ?? []);
say(`Chebyshev distance pocket -> lethal-in-reach: ${ch.length ? `min ${Math.min(...ch)} max ${Math.max(...ch)}` : 'none'}`);
const rc = gates.map((r) => r.reachCount).filter((n) => Number.isFinite(n));
say(`reachable-set size: ${rc.length ? `min ${Math.min(...rc)} max ${Math.max(...rc)} median ${rc.slice().sort((a, b) => a - b)[Math.floor(rc.length / 2)]}` : 'none'}`);
const fc = gates.map((r) => r.floodCount).filter((n) => Number.isFinite(n));
say(`flood (demand candidate) size: ${fc.length ? `min ${Math.min(...fc)} max ${Math.max(...fc)} median ${fc.slice().sort((a, b) => a - b)[Math.floor(fc.length / 2)]}` : 'none'}`);
say(`flood is a SUPERSET of the stepped set on: `
    + `${gates.filter((r) => r.floodIsSuperset === true).length} of ${gates.filter((r) => r.floodIsSuperset !== undefined).length}`);
say(`gates with LETHAL terrain in the FLOOD: ${gates.filter((r) => (r.lethalInFlood ?? 0) > 0).length}`);
say(`  ... of those, cause=sword: ${gates.filter((r) => (r.lethalInFlood ?? 0) > 0 && r.cause === 'sword').length}`);
say(`boundary (must stay WALL) size: ${gates.map((r) => r.boundaryCount).filter(Number.isFinite).join(', ') || 'none'}`);
say('');
say(`md5(rows) = ${createHash('md5').update(JSON.stringify(rows)).digest('hex')}`);

const OUT = arg('json', '');
if (OUT) {
    writeFileSync(OUT, `${JSON.stringify({ kinds: KINDS, seeds: [S0, S1], budget: BUDGET, bounds: BOUNDS, rows }, null, 2)}\n`);
    process.stderr.write(`[stderr] wrote ${OUT}\n`);
}
