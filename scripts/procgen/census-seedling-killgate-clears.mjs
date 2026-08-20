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
 * ── ⛓⛓⛓ AND SINCE ARC 5 SLICE 0 (W2): **THE TWO DEMANDS, MEASURED** ───
 *
 * ⛔ MEASURED, NOT SWITCHED — §18.2 C4 is priced here and slice 2 owns the
 * switch. Three sections come out of one run:
 *
 *   THE TWO DEMANDS, per placed gate   the SHIPPED region (`roomDoor
 *       .bodyRegion`, read straight off `buildKillGate`'s candidate) beside the
 *       EXACT set (the body's own `stepSpinner` path over the same
 *       construct-time room), their sizes, the cells only the region claims,
 *       and any cell the body reaches that the region does NOT — the last is
 *       predicted empty and a non-zero count is a finding about `bodyRegion`.
 *   THE CROSS-CHECK   `bodyRegion` minus the element's own cells must BE the
 *       demand rows the level shipped. A disagreement means the candidate match
 *       is wrong and every number in the row is about a different placement.
 *   THE FALSE POSITIVES   the region's price, measured on the cells where NO
 *       element demand shaped pass 2 — because on the corpus the demand itself
 *       shaped, lethal-terrain-in-region is 0 BY CONSTRUCTION and the class C4
 *       priced cannot be re-measured there at all.
 *
 * Run:
 *   node scripts/procgen/census-seedling-killgate-clears.mjs --seeds=1-40
 *   node scripts/procgen/census-seedling-killgate-clears.mjs --seeds=1-12 \
 *       --kinds=winding,rooms,branchy,bushy,loopy,open
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
/**
 * ⛓⛓⛓ THE PRODUCTION GEOMETRY, IMPORTED — arc 5, slice 0 (W2). `buildKillGate`
 * is the function the ELEMENT calls, and every candidate it returns carries the
 * `body` region `roomDoor.bodyRegion` computed for it. ⛔ A census that floods
 * the room itself would be a detector with its own copy of the thing under
 * measurement, and an INERT mutant there would be a finding about the census
 * (trap 417). The two demands compared below are therefore the SHIPPED one and
 * the body's own STEPPER — neither of them re-spelled here.
 */
const { buildKillGate } = await CORE('elements/killGate.js');
const { TILE_FLOOR, cellKey, inInterior, writesOf } = await CORE('elements/roomDoor.js');

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
    return steppedCells((tx, ty) => tx < 0 || ty < 0 || ty >= grid.length || tx >= grid[0].length
        || grid[ty][tx] === 'wall' || (tx === door.x && ty === door.y), pocket, ticks);
}

/**
 * ⛓ THE ONE STEPPER SPELLING, over any `solid(tx, ty)`. The census asks the
 * same question of two different ROOMS — the FINAL level (what pass 2 painted,
 * which is what the drown predictor is about) and the CONSTRUCT-TIME room the
 * demand was computed on (skeleton + the element's own writes + the shut door,
 * which is what the demand COMPARISON is about). Two walks would be two answers
 * to *where does the body go*.
 *
 * ⛔ THE HEADING IS NOT THIS FILE'S TO GET WRONG. `newSpinner` reads
 * `SPINNER.heading` and nothing here overrides it; the ctor velocity's sign is
 * pinned one directory over (`spinner.test.js`: `vx ≈ +√½`, `vy ≈ −√½`), so a
 * flipped sign is a red there before it is a wrong number here.
 */
function steppedCells(solid, pocket, ticks = WALK_TICKS) {
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
 * ── ⛓⛓⛓ **THE TWO DEMANDS, arc 5 slice 0 (W2)** — MEASURED, NOT SWITCHED ──
 *
 * ⛔ SLICE 2 OWNS THE SWITCH. Nothing here changes a production demand line;
 * this file computes what each of the two candidate demands WOULD claim about
 * the same room and publishes the difference.
 *
 *   REGION   what SHIPS today — `roomDoor.bodyRegion`, the 4-connected flood of
 *            FLOOR from the pocket with the element's own writes applied and the
 *            door SHUT, plus the walls 4-adjacent to it. ⛓ It is read off
 *            `buildKillGate`'s candidate (`pick.body`) and is therefore the
 *            SAME OBJECT the element demanded, not a re-derivation.
 *   STEPPED  the EXACT set — the body's own path, `stepSpinner` run from the
 *            pocket over the CONSTRUCT-TIME room (skeleton + the candidate's
 *            writes + the shut door), which is the room the demand is computed
 *            on. §18.2 C4's *"available whenever the contract may ask the
 *            binding to step a body"*.
 *
 * ⚠ **THE CENSUS USED TO FLOOD THE ROOM ITSELF, AND THAT WAS NOT THE SHIPPED
 * DEMAND.** The old `floodRegion` walked the SKELETON grid without the
 * element's GROWN WALL, so it named cells the wall had already sealed off — a
 * `flood` column that was wider than anything the element ever claimed. It is
 * gone; the numbers in §15.4/§15.6's `flood` column are that copy's, not
 * `bodyRegion`'s, and the `region` column here supersedes them.
 *
 * @param {object} room  the model's OWN room probe (`out.model.roomProbe()`)
 * @param {object} pick  one `buildKillGate` candidate
 */
function steppedForCandidate(room, pick) {
    const writes = writesOf(pick.tiles);
    const door = pick.cand.cell;
    const solid = (x, y) => {
        if (!inInterior(room, x, y)) return true;
        if (x === door.x && y === door.y) return true;
        const w = writes.get(cellKey(x, y));
        return w === undefined ? !room.floorAt(x, y) : w !== TILE_FLOOR;
    };
    return steppedCells(solid, pick.pocket.cell);
}

/** The two sets for one candidate, plus their difference — no level needed. */
function demandsFor(room, pick) {
    const region = pick.body.region;
    const stepped = new Set(steppedForCandidate(room, pick).keys());
    const regionOnly = [...region].filter((k) => !stepped.has(k));
    const steppedOutside = [...stepped].filter((k) => !region.has(k));
    return { region, stepped, regionOnly, steppedOutside };
}

/**
 * ⛓ WHICH `buildKillGate` CANDIDATE THE ELEMENT ACTUALLY DREW. The placement
 * records the door cell and the clearer; the candidate list is enumerated by the
 * same function on the same room, so the match is exact. ⛔ A miss is REPORTED
 * rather than defaulted to candidate 0 — a census that guessed here would
 * publish one candidate's geometry under another's row.
 */
function drawnCandidate(built, door, pocket) {
    return (built.candidates ?? []).find((c) => c.cand.cell.x === door.x
        && c.cand.cell.y === door.y && c.pocket.cell.x === pocket.x
        && c.pocket.cell.y === pocket.y) ?? null;
}

/**
 * ⛓⛓ THE CROSS-CHECK THAT KEEPS THIS INSTRUMENT HONEST. The demand the level
 * SHIPPED is `out.model.elementDemand()`; the region above is what
 * `bodyRegion` returned for the candidate this census matched. `demandOf`
 * excludes the element's OWN cells (door, pocket, grown wall, carve), so the
 * shipped floor rows must be exactly `region` minus those. ⛔ If this ever
 * disagrees, the candidate match or the writes are wrong and every number in
 * the row is about a different placement (trap 383).
 */
function demandCrossCheck(shipped, pick) {
    const mine = new Set([cellKey(pick.cand.cell.x, pick.cand.cell.y),
        cellKey(pick.pocket.cell.x, pick.pocket.cell.y),
        ...pick.tiles.map((t) => cellKey(t.x, t.y))]);
    const wantFloor = [...pick.body.region].filter((k) => !mine.has(k)).sort();
    const wantWall = [...pick.body.boundary].filter((k) => !mine.has(k)).sort();
    const gotFloor = shipped.filter((d) => d.must === 'floor')
        .map((d) => cellKey(d.x, d.y)).sort();
    const gotWall = shipped.filter((d) => d.must === 'wall')
        .map((d) => cellKey(d.x, d.y)).sort();
    if (JSON.stringify(wantFloor) !== JSON.stringify(gotFloor)) {
        return `floor rows differ: bodyRegion ${wantFloor.length} vs shipped ${gotFloor.length}`;
    }
    if (JSON.stringify(wantWall) !== JSON.stringify(gotWall)) {
        return `wall rows differ: bodyRegion ${wantWall.length} vs shipped ${gotWall.length}`;
    }
    return null;
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
        /**
         * ── ⛓⛓⛓ **THE COUNTERFACTUAL ARM (W2)** — the only corpus that can
         * ── still price the REGION's false positives ──────────────────────
         *
         * ⛔ THE SHIPPED CORPUS CANNOT ANSWER THE QUESTION, BY CONSTRUCTION.
         * §18.2 C4 prices the region at *"one false positive in ten"* — a gate
         * whose flood held lethal terrain the body never reached — and that was
         * measured BEFORE the demand existed. Today the demand FORBIDS lethal
         * terrain anywhere in the region, so `lethalRegionOnly` is 0 on every
         * placed gate and always will be: the constraint removed the class it is
         * priced by (trap 377 — it MOVED which cell meets it).
         *
         * ⇒ the price is measured where pass 2 ran WITHOUT a kill-gate demand:
         * every cell whose level carries NO element demand at all. For each
         * kill-gate candidate `buildKillGate` offers on that room, the two
         * demands are computed and checked against the lethal terrain pass 2
         * ACTUALLY painted there.
         *
         * ⚠ **AND ITS BOUND IS NAMED.** These rooms have no grown wall in them,
         * so pass 2 painted a room the candidate's own wall would have changed;
         * the arm prices the DIFFERENCE BETWEEN TWO DEMANDS on real unconstrained
         * furniture, not the placements the loop would have made. That is what
         * the pre-demand corpus was too, one step less directly.
         */
        const noDemand = out.model.elementDemand().length === 0;
        if (noDemand) {
            const cfGrid = terrainGrid(out.record);
            const cfLethal = [];
            for (let y = 0; y < cfGrid.length; y += 1) {
                for (let x = 0; x < cfGrid[y].length; x += 1) {
                    if (cfGrid[y][x] === 'water' || cfGrid[y][x] === 'pit') cfLethal.push({ x, y });
                }
            }
            const cfProbe = out.model.roomProbe();
            const cfBuilt = buildKillGate(cfProbe);
            row.cfLethal = cfLethal.length;
            row.cfCandidates = (cfBuilt.candidates ?? []).length;
            row.cfRefusal = cfBuilt.refused?.reason ?? null;
            let regionHits = 0;
            let steppedHits = 0;
            let falsePos = 0;
            let escapes = 0;
            /**
             * ⛓ TWO GRANULARITIES, because they answer different questions and
             * a reader who saw only one would over-read it. The CANDIDATE
             * counts are the ones comparable with §15.5's *"one gate in ten"*
             * (a per-placement boolean); the CELL counts say whether the
             * region's extra cells ever hold lethal terrain AT ALL, which is
             * what a boolean of 0 cannot distinguish from "the region adds
             * nothing anywhere".
             */
            let regionCells = 0;
            let steppedCells2 = 0;
            let onlyRegionCells = 0;
            for (const c of cfBuilt.candidates ?? []) {
                const d = demandsFor(cfProbe, c);
                const inR = cfLethal.filter((L) => d.region.has(cellKey(L.x, L.y)));
                const inS = cfLethal.filter((L) => d.stepped.has(cellKey(L.x, L.y)));
                if (inR.length) regionHits += 1;
                if (inS.length) steppedHits += 1;
                if (inR.length && !inS.length) falsePos += 1;
                regionCells += inR.length;
                steppedCells2 += inS.length;
                onlyRegionCells += inR.filter((L) => !d.stepped.has(cellKey(L.x, L.y))).length;
                if (d.steppedOutside.length) escapes += 1;
            }
            row.cfRegionHits = regionHits;
            row.cfSteppedHits = steppedHits;
            row.cfFalsePositives = falsePos;
            row.cfSteppedEscapes = escapes;
            row.cfRegionLethalCells = regionCells;
            row.cfSteppedLethalCells = steppedCells2;
            row.cfRegionOnlyLethalCells = onlyRegionCells;
            row.cfRegionOnlyCells = (cfBuilt.candidates ?? [])
                .reduce((a, c) => a + demandsFor(cfProbe, c).regionOnly.length, 0);
        }
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
        /** ⛓ The lethal cells come from the FINAL level, which is what pass 2
         *  painted; both demands are computed on the CONSTRUCT-TIME room, which
         *  is all a demand can see. */
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
        /**
         * ── ⛓⛓⛓ THE TWO DEMANDS FOR THE PLACEMENT THAT SHIPPED (W2) ──────
         *
         * ⛔ BOTH ARE ABOUT THE **CONSTRUCT-TIME** ROOM. The demand is computed
         * before pass 2 exists, so a comparison against a set stepped over the
         * FINAL level would be comparing a claim with a room the claim could not
         * see. `row.reachCount` above is the FINAL-level walk and stays what it
         * always was — it is the drown PREDICTOR's set, not the demand's.
         */
        const probe = out.model.roomProbe();
        const built = buildKillGate(probe);
        const pick = drawnCandidate(built, door, pocket);
        row.candidates = (built.candidates ?? []).length;
        if (pick === null) {
            row.demandNote = 'the drawn candidate is not in buildKillGate\'s list on this room';
        } else {
            const shipped = out.model.elementDemand();
            row.demandMismatch = demandCrossCheck(shipped, pick);
            row.shippedDemand = shipped.length;
            const d = demandsFor(probe, pick);
            row.regionCount = d.region.size;
            row.boundaryCount = pick.body.boundary.size;
            row.steppedCount = d.stepped.size;
            row.regionOnly = d.regionOnly.length;
            row.steppedOutsideRegion = d.steppedOutside.length;
            row.steppedOutsideCells = d.steppedOutside;
            row.regionIsSuperset = d.steppedOutside.length === 0;
            row.lethalInRegion = lethal.filter((c) => d.region.has(cellKey(c.x, c.y))).length;
            row.lethalInStepped = lethal.filter((c) => d.stepped.has(cellKey(c.x, c.y))).length;
            /** ⛓ The FALSE-POSITIVE cells of the shipped demand ON THIS LEVEL:
             *  lethal terrain the REGION forbids and the body never reaches. ⛔
             *  On the corpus the demand itself shaped this is 0 by construction
             *  — see the COUNTERFACTUAL arm for the number that is not. */
            row.lethalRegionOnly = lethal.filter((c) => d.region.has(cellKey(c.x, c.y))
                && !d.stepped.has(cellKey(c.x, c.y))).length;
        }
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
say('| kind | arm | seed | head | placed | cert | final | cleared | cause | lethal | inReach | reach | painters |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    say(`| ${r.kind} | ${r.arm} | ${r.seed} | ${r.head ?? '-'} | ${r.placed ?? '-'} | ${r.certified ?? '-'} `
        + `| ${r.outcome} | ${r.cleared ?? '-'} | ${r.cause ?? '-'} | ${r.lethalCount ?? '-'} `
        + `| ${r.lethalInReach ?? '-'} `
        + `| ${r.reachCount ?? '-'} | ${(r.painters ?? []).join(' ') || '-'} |`);
}
say('');
/**
 * ⛓⛓⛓ THE TWO DEMANDS, PER PLACED GATE (arc 5 slice 0, W2). One row per gate
 * that PLACED: what the shipped REGION claims, what the body's own STEPPED path
 * claims, and what the difference costs on THIS level.
 */
say('## THE TWO DEMANDS — REGION (shipped) vs STEPPED (exact), per placed gate');
say('');
say('| kind | arm | seed | cand | region | stepped | region-only | stepped-outside | '
    + 'demand rows | lethal∈region | lethal∈stepped | false-pos | cross-check |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows.filter((x) => Number.isFinite(x.regionCount))) {
    say(`| ${r.kind} | ${r.arm} | ${r.seed} | ${r.candidates} | ${r.regionCount} | ${r.steppedCount} `
        + `| ${r.regionOnly} | ${r.steppedOutsideRegion} | ${r.shippedDemand} | ${r.lethalInRegion} `
        + `| ${r.lethalInStepped} | ${r.lethalRegionOnly} | ${r.demandMismatch ?? 'ok'} |`);
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
say(`boundary (must stay WALL) size: ${gates.map((r) => r.boundaryCount).filter(Number.isFinite).join(', ') || 'none'}`);
say('');

// ── ⛓⛓⛓ W2: THE TWO DEMANDS, ROLLED UP ──────────────────────────────
const measured = rows.filter((r) => Number.isFinite(r.regionCount));
const span = (ns) => (ns.length
    ? `min ${Math.min(...ns)} max ${Math.max(...ns)} median ${ns.slice().sort((a, b) => a - b)[Math.floor(ns.length / 2)]}`
    : 'none');
say('## THE TWO DEMANDS — ROLL-UP');
say(`gates measured: ${measured.length}`);
say(`REGION size (shipped): ${span(measured.map((r) => r.regionCount))}`);
say(`STEPPED size (exact):  ${span(measured.map((r) => r.steppedCount))}`);
say(`REGION-ONLY cells (what the exact demand would stop claiming): `
    + `${span(measured.map((r) => r.regionOnly))}, total `
    + `${measured.reduce((a, r) => a + r.regionOnly, 0)}`);
/**
 * ⛔ THE PREDICTED-EMPTY ONE, AND IT IS A CLAIM ABOUT `bodyRegion` RATHER THAN
 * ABOUT THIS CENSUS. The region is a superset of any body path BY CONSTRUCTION
 * (the 7x7 box lives inside one 16x16 cell and can only cross a shared EDGE, so
 * the centre's cell path is 4-connected through non-solid cells). A non-empty
 * count here is a FINDING about the shipped demand, not a tuning input.
 */
say(`STEPPED cells OUTSIDE the region: `
    + `${measured.reduce((a, r) => a + r.steppedOutsideRegion, 0)} `
    + `(gates with any: ${measured.filter((r) => r.steppedOutsideRegion > 0).length} of ${measured.length})`);
const escaped = measured.filter((r) => r.steppedOutsideRegion > 0);
if (escaped.length) {
    for (const r of escaped) {
        say(`  ⛔ FINDING: ${r.kind}/${r.arm}/${r.seed} steps outside its own demand at `
            + `${JSON.stringify(r.steppedOutsideCells)}`);
    }
}
say(`region == stepped exactly: ${measured.filter((r) => r.regionOnly === 0).length} of ${measured.length}`);
const mismatched = measured.filter((r) => r.demandMismatch);
say(`⛓ CROSS-CHECK — bodyRegion reproduces the SHIPPED demand rows on `
    + `${measured.length - mismatched.length} of ${measured.length}`);
for (const r of mismatched) say(`  ⛔ ${r.kind}/${r.arm}/${r.seed}: ${r.demandMismatch}`);
say(`lethal terrain inside the REGION on the shipped corpus: `
    + `${measured.filter((r) => (r.lethalInRegion ?? 0) > 0).length} `
    + `(0 is BY CONSTRUCTION — the demand forbids it)`);

// ── ⛓⛓⛓ W2: THE COUNTERFACTUAL — the region's price, where pass 2 was free ──
const cf = rows.filter((r) => Number.isFinite(r.cfCandidates));
const cfWithCands = cf.filter((r) => r.cfCandidates > 0);
const cfCands = cf.reduce((a, r) => a + r.cfCandidates, 0);
say('');
say('## THE REGION\'S FALSE POSITIVES — measured where NO element demand shaped pass 2');
say(`unconstrained cells: ${cf.length} of ${rows.length}; of those, `
    + `${cfWithCands.length} offer a kill-gate candidate at all `
    + `(${cfCands} candidates in total)`);
say(`candidates whose REGION holds lethal terrain:  ${cf.reduce((a, r) => a + r.cfRegionHits, 0)}`);
say(`candidates whose STEPPED path holds it:        ${cf.reduce((a, r) => a + r.cfSteppedHits, 0)}`);
const fp = cf.reduce((a, r) => a + r.cfFalsePositives, 0);
const rh = cf.reduce((a, r) => a + r.cfRegionHits, 0);
say(`⛓⛓⛓ FALSE POSITIVES (lethal in REGION, not in STEPPED): ${fp}`);
say(`  as a share of all candidates:            ${cfCands ? `${fp}/${cfCands} = ${(fp / cfCands).toFixed(3)}` : 'n/a'}`);
say(`  as a share of REGION-refused candidates: ${rh ? `${fp}/${rh} = ${(fp / rh).toFixed(3)}` : 'n/a'}`);
/**
 * ⛔ THE DENOMINATOR §15.5's *"one in ten"* USED WAS **GATES**, NOT CANDIDATES,
 * and quoting a candidate rate against it would be trap 383 — a subject found
 * with a different instrument is a different subject. A ROOM here is the
 * closest comparable unit: one unconstrained room, one geometry, ask whether
 * ANY kill gate it could carry would be refused by the region and admitted by
 * the stepped set. ⛓ It is still not the same population (§15.5's ten were
 * gates the loop actually PLACED and CERTIFIED), and that is said rather than
 * smoothed over.
 */
say(`  as a share of ROOMS offering a candidate:  `
    + `${cfWithCands.length ? `${cf.filter((r) => r.cfFalsePositives > 0).length}/${cfWithCands.length} `
        + `= ${(cf.filter((r) => r.cfFalsePositives > 0).length / cfWithCands.length).toFixed(3)}` : 'n/a'}`);
say('');
say('⛓ THE SAME QUESTION AT CELL GRANULARITY — a candidate-level 0 cannot tell');
say('  "the region adds nothing" from "the region adds cells nothing is painted in"');
say(`  cells the REGION demands that the STEPPED set does not: `
    + `${cf.reduce((a, r) => a + (r.cfRegionOnlyCells ?? 0), 0)}`);
say(`  LETHAL cells inside the region:                        `
    + `${cf.reduce((a, r) => a + (r.cfRegionLethalCells ?? 0), 0)}`);
say(`  LETHAL cells inside the stepped path:                  `
    + `${cf.reduce((a, r) => a + (r.cfSteppedLethalCells ?? 0), 0)}`);
say(`  ⛓⛓⛓ LETHAL cells the region forbids and the body NEVER REACHES: `
    + `${cf.reduce((a, r) => a + (r.cfRegionOnlyLethalCells ?? 0), 0)}`);
say('');
say(`counterfactual candidates whose stepped set ESCAPES its region: `
    + `${cf.reduce((a, r) => a + r.cfSteppedEscapes, 0)}`);
const cfRefusals = {};
for (const r of cf.filter((x) => x.cfRefusal)) {
    cfRefusals[r.cfRefusal] = (cfRefusals[r.cfRefusal] ?? 0) + 1;
}
say(`rooms offering no candidate, by refusal: ${JSON.stringify(cfRefusals)}`);
say('');
say(`md5(rows) = ${createHash('md5').update(JSON.stringify(rows)).digest('hex')}`);

const OUT = arg('json', '');
if (OUT) {
    writeFileSync(OUT, `${JSON.stringify({ kinds: KINDS, seeds: [S0, S1], budget: BUDGET, bounds: BOUNDS, rows }, null, 2)}\n`);
    process.stderr.write(`[stderr] wrote ${OUT}\n`);
}
