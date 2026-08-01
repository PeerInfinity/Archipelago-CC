#!/usr/bin/env node
/**
 * plan-seedling-r2-route — compute the R2 full-walk route and write it to
 * `frontend/modules/seedlingDemo/fixtures/r2-route.json`.
 *
 * Region-atlas Phase 8, subtractive ladder rung R2, slice 6. Brief:
 * `CC/docs/plans/seedling-bot-r2-opus-kickoff.md` §9 and §11.
 *
 * Same shape as `plan-seedling-r1-route.mjs` and for the same reasons —
 * this is ROUTE AUTHORING, it gates nothing, the committed leg list is the
 * artifact and this script is how it was arrived at. Read that file's
 * docblock for the doctrine; what follows is only what R2 changed.
 *
 * ── THREE THINGS ARE DIFFERENT, and all three are the rung ─────────────
 *
 * **1. The solids are back.** R1 planned with `noclip: true` and a census
 * of three cheap roles; this plans with collision ON and the full
 * `blocking` census R2 paid for. A component is a 4-connected blob of
 * tiles whose CENTRE the player box fits at with every solid, pixelmask,
 * unmodelled terrain, pit tile, live trigger and avoid volume priced.
 *
 * **2. The geometry is POST-CLEAR.** A tape's `persistence` clears are
 * applied when each world is built, so a cleared lock has already merged
 * the components either side of it and `(level, component)` ids are
 * computed from the world the walk actually meets. Computing them from the
 * pre-clear world would produce a graph whose nodes do not exist.
 *
 * The clear list is DERIVED, not authored: `persistenceClearsFor` reads
 * each level's own entities and offers the tags whose clearing removes a
 * blocker, refusing (by name, with the reason) the ones that would arm a
 * FallRock, make a MoonrockPile appear, boot a ButtonRoom pressed, take a
 * pickup or despawn an enemy. The list is then PRUNED to the levels the
 * route enters and the route is re-planned against the pruned list, which
 * must reproduce it exactly — a fixed point, asserted rather than assumed.
 *
 * **3. There are HOLD EDGES.** A `Lock` whose `tSet >= 0` does not answer
 * to any clear; it answers to its button. So the graph carries an
 * intra-level edge from the component a presser can be reached from to
 * every component that becomes connected once its group opens — derived by
 * flooding the level twice, once with the group shut and once open, rather
 * than declared. R2's route uses exactly one of them (L71's
 * `button@112,176` under `lock@112,160`), and the derivation is what makes
 * that a fact about the map instead of a fact about this file.
 *
 * Run: node scripts/procgen/plan-seedling-r2-route.mjs [--write] [--verbose]
 *      node scripts/procgen/plan-seedling-r2-route.mjs --clears
 *      node scripts/procgen/plan-seedling-r2-route.mjs --reach=71:3
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { persistenceClearsFor, TILE_SIZE } =
    await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { contactsAt } = await import(join(MODULE, 'botDriverV2.js'));
const {
    R2_BOOT, R2_HOLD_TICKS, R2_ITEM_ROOMS, R2_LATTICE, R2_NO_HAZARDS,
    R2_SEGMENT_BOUNDARIES,
} = await import(join(MODULE, 'r2Walk.js'));
const { makeRouteGraph } = await import(join(HERE, 'seedlingRouteGraph.mjs'));

const WRITE = process.argv.includes('--write');
const VERBOSE = process.argv.includes('--verbose');
const OUT = join(MODULE, 'fixtures', 'r2-route.json');
const LEVEL_COUNT = 116;

/** The plan half of `relax`, exactly as `synthesizeLegs` derives it. */
const PLAN = {
    noclip: false, noHazards: R2_NO_HAZARDS, avoidVolumes: true, lattice: R2_LATTICE,
};

const source = atlasLevelSource();

// ── the clear list ────────────────────────────────────────────────────
const allClears = [];
const refusedClears = [];
for (let level = 0; level < LEVEL_COUNT; level++) {
    const { offered, refused } = persistenceClearsFor(source(level));
    allClears.push(...offered);
    refusedClears.push(...refused);
}

if (process.argv.includes('--clears')) {
    console.log(`${allClears.length} clear(s) OFFERED across ${LEVEL_COUNT} levels:`);
    allClears.forEach((c) => console.log(`  L${c.level} tag ${c.tag}: ${c.note}`));
    console.log(`\n${refusedClears.length} REFUSED:`);
    refusedClears.forEach((c) => console.log(`  L${c.level} tag ${c.tag}: ${c.why}`));
    process.exit(0);
}

/**
 * Plan and tour the whole map under one clear list.
 *
 * A thin call into `seedlingRouteGraph.makeRouteGraph`, which is where the
 * geometry lives — it is shared with R3's feasibility recon so that the
 * instrument and the planner cannot disagree about what is reachable.
 *
 * Still a function rather than top-level code because it is run TWICE —
 * once with every offered clear and once with the list pruned to the levels
 * the first run entered — and the two must agree. A pruning that changed
 * the route would mean a clear in a level the walk never enters had been
 * load-bearing, which cannot happen but is worth finding out rather than
 * believing.
 */
function planWith(clears) {
    return makeRouteGraph({
        source, clears, plan: PLAN, lattice: R2_LATTICE,
        holdTicks: R2_HOLD_TICKS, levelCount: LEVEL_COUNT,
    });
}

// ── the tour ──────────────────────────────────────────────────────────
function tour(g) {
    const bootSpawn = { x: R2_BOOT.x + TILE_SIZE / 2, y: R2_BOOT.y + TILE_SIZE / 2 };
    const bootComponent = g.componentAt(R2_BOOT.level, bootSpawn.x, bootSpawn.y);
    if (bootComponent === null) {
        throw new Error(`the boot position (${bootSpawn.x},${bootSpawn.y}) in level `
            + `${R2_BOOT.level} is not in any walkable component`);
    }
    const START = `${R2_BOOT.level}:${bootComponent}`;
    const hops = [];
    let cursor = START;
    const visitOrder = [];
    for (const room of R2_ITEM_ROOMS) {
        const { dist } = g.bfs(cursor);
        const candidates = [...dist.keys()]
            .filter((n) => n.startsWith(`${room.level}:`))
            .sort((a, b) => dist.get(a) - dist.get(b));
        if (candidates.length === 0) {
            const nodesOf = (lv) => [...g.edges.keys()].filter((n) => n.startsWith(`${lv}:`));
            console.error(`\nno path ${cursor} -> L${room.level}. Diagnostics:`);
            console.error(`  ${cursor} leaves by: ${(g.edges.get(cursor) ?? [])
                .map((e) => `${e.kind}->${e.to}`).join(' ') || '(nothing)'}`);
            console.error(`  ${dist.size} node(s) reachable from ${cursor}`);
            console.error(`  L${room.level} components with outgoing edges: `
                + `${nodesOf(room.level).join(' ') || '(none)'}`);
            console.error(`  components of L${room.level}: `
                + `${new Set(g.componentsOf(room.level).values()).size}`);
            throw new Error(`no path to L${room.level} (${room.items.join('+')}) from `
                + `${cursor}. With the solids back this is a SEAL, and a seal the `
                + 'slice-0 feasibility pass did not name is a finding for the user, not '
                + 'an item to trade away.');
        }
        hops.push(...g.pathBetween(cursor, candidates[0]));
        cursor = candidates[0];
        visitOrder.push(`${room.items.join('+')}(L${room.level})`);
    }
    // The tail: back to the cluster hub and out through its pit, so the
    // walk ends on solid floor in L82 rather than in a dead-end room.
    const { dist: fromLast } = g.bfs(cursor);
    const hub = [...fromLast.keys()].filter((n) => n.startsWith('71:'))
        .sort((a, b) => fromLast.get(a) - fromLast.get(b))[0];
    if (!hub) throw new Error(`no path back to the cluster hub L71 from ${cursor}`);
    hops.push(...g.pathBetween(cursor, hub));
    const out = (g.edges.get(hub) ?? []).find((e) => e.kind === 'fall' && e.toLevel === 82);
    if (!out) throw new Error(`L71's fall to L82 is not an edge out of ${hub}`);
    hops.push({ from: hub, edge: out });
    return { hops, visitOrder, START };
}

/**
 * hops -> legs.
 *
 * One leg per level ENTERED, including every pass-through. A HOLD hop is
 * the exception and the reason this is not R1's loop verbatim: it stays
 * INSIDE its level, so it contributes targets to the leg already open
 * rather than starting a new one.
 */
function toLegs(g, hops) {
    const legs = [];
    const legBoots = [];
    const holds = [];
    let standing = { ...R2_BOOT };
    let open = null;
    const openLeg = (level) => {
        legs.push({ level, targets: [] });
        legBoots.push({ ...standing });
        open = legs[legs.length - 1];
        return open;
    };
    for (const { from, edge } of hops) {
        // ⚠ A LEG'S LEVEL IS WHERE THE PLAYER IS, which is the hop's FROM
        // node — not `edge.to`, which is where it goes. The first cut read
        // the destination and produced a leg list whose levels were shifted
        // by one hop: every `exit` named a teleporter the level it was
        // written under does not have.
        const fromLevel = Number(String(from).split(':')[0]);
        if (edge.kind === 'hold') {
            const leg = open ?? openLeg(fromLevel);
            if (leg.level !== edge.toLevel) {
                throw new Error(`a hold edge in L${edge.toLevel} met an open leg in `
                    + `L${leg.level}`);
            }
            leg.targets.push({
                x: edge.stand.x, y: edge.stand.y, hold: { ...edge.hold },
            });
            leg.targets.push({ x: edge.land.x, y: edge.land.y });
            holds.push({
                leg: legs.length - 1,
                level: edge.toLevel,
                presser: `${edge.presserTag}@${edge.hold.presser.x},${edge.hold.presser.y}`,
                ticks: edge.hold.ticks,
                opens: [...edge.opens],
            });
            continue;
        }
        const leg = open ?? openLeg(fromLevel);
        if (leg.level !== fromLevel) {
            throw new Error(`a ${edge.kind} edge out of L${fromLevel} met an open leg `
                + `in L${leg.level}`);
        }
        leg.exit = edge.exit;
        open = null;
        for (const p of edge.through) {
            legs.push({ level: p.level, targets: [], exit: { pit: p.pit } });
            legBoots.push({ ...p.boot });
        }
        standing = { ...edge.boot };
    }
    if (open) throw new Error('the last hop was a hold, so the walk ends mid-level');
    legs.push({ level: standing.level, targets: [] });
    legBoots.push({ ...standing });
    return { legs, legBoots, holds };
}

// ── run 1: every offered clear ────────────────────────────────────────
console.log(`clear list: ${allClears.length} offered, ${refusedClears.length} refused `
    + '(--clears for the full audit)');
const first = planWith(allClears);

// `--reach=<level>:<component>` — what that node can get to, and how far.
// Route authoring is mostly answering that question, and answering it from
// the SAME graph the tour walks is the only version worth having.
const reachArg = process.argv.find((a) => a.startsWith('--reach='));
if (reachArg) {
    const node = reachArg.slice('--reach='.length);
    const { dist } = first.bfs(node);
    const byLevel = new Map();
    for (const [n, d] of dist) {
        const lv = Number(n.split(':')[0]);
        if (!byLevel.has(lv) || byLevel.get(lv) > d) byLevel.set(lv, d);
    }
    console.log(`from ${node}: ${dist.size} node(s), ${byLevel.size} level(s) reachable`);
    console.log([...byLevel.entries()].sort((a, b) => a[0] - b[0])
        .map(([lv, d]) => `L${lv}(d${d})`).join(' '));
    console.log(`\nout of ${node}: ${(first.edges.get(node) ?? [])
        .map((e) => `${e.kind}->${e.to}`).join(' ') || '(nothing)'}`);
    console.log(`\nHOLD edges (${first.holdEdges.length}): ${first.holdEdges
        .map((h) => `L${h.level} ${h.from}->${h.to} via ${h.presser}`).join('; ')}`);
    process.exit(0);
}

const firstTour = tour(first);
const firstLegs = toLegs(first, firstTour.hops);
const routeLevels = new Set(firstLegs.legs.map((l) => l.level));

// ── run 2: pruned to the levels the route enters ──────────────────────
const clears = allClears.filter((c) => routeLevels.has(c.level));
console.log(`pruned to the route's ${routeLevels.size} level(s): ${clears.length} clear(s)`);
const g = planWith(clears);
const { hops, visitOrder, START } = tour(g);
const { legs, legBoots, holds } = toLegs(g, hops);

if (JSON.stringify(legs) !== JSON.stringify(firstLegs.legs)) {
    throw new Error('pruning the clear list to the route\'s own levels CHANGED the '
        + 'route. A clear only affects the level it names, so this cannot happen — '
        + 'which is exactly why it is asserted rather than assumed.');
}

// What each leg STARTS standing inside, computed with the driver's own
// `contactsAt` so the declaration and the check cannot drift apart.
legs.forEach((leg, i) => {
    const world = g.worldFor(leg.level);
    const contacts = contactsAt(world,
        legBoots[i].x + TILE_SIZE / 2, legBoots[i].y + TILE_SIZE / 2,
        { avoidVolumes: true });
    if (contacts.length > 0) leg.contacts = contacts;
});

const grants = R2_ITEM_ROOMS.map((r) => ({ level: r.level, items: [...r.items] }));
for (const grant of grants) {
    if (!legs.some((l) => l.level === grant.level)) {
        throw new Error(`the route never enters L${grant.level}, which grants `
            + `${grant.items.join('+')} — a grant that cannot fire is a route claim `
            + 'that stopped being true');
    }
}

const distinct = new Set(legs.map((l) => l.level));
console.log(`item order: ${visitOrder.join(' -> ')}`);
console.log(`legs ${legs.length}, distinct levels ${distinct.size}, `
    + `falls ${legs.filter((l) => l.exit?.pit).length}, holds ${holds.length}`);
holds.forEach((h) => console.log(`  HOLD leg ${h.leg} L${h.level}: ${h.presser} for `
    + `${h.ticks} ticks, opens ${h.opens.join(' ')}`));
if (VERBOSE) {
    legs.forEach((l, i) => console.log(`  ${String(i).padStart(2)} L${l.level} `
        + `boot(${legBoots[i].x},${legBoots[i].y}) -> `
        + `${l.exit ? (l.exit.pit ? `FALL(${l.exit.pit.tx},${l.exit.pit.ty})`
            : `t(${l.exit.x},${l.exit.y})`) : 'END'}`
        + `${l.targets.length ? `  targets: ${l.targets
            .map((t) => `(${t.x},${t.y})${t.hold ? `[hold ${t.hold.ticks}]` : ''}`)
            .join(' ')}` : ''}`
        + `${l.contacts ? `  contacts: ${l.contacts.join(' ')}` : ''}`));
}

// ── segments ──────────────────────────────────────────────────────────
const boundaries = R2_SEGMENT_BOUNDARIES.map(([level, occurrence], i) => {
    let seen = 0;
    for (let li = 0; li < legs.length; li++) {
        if (legs[li].level !== level) continue;
        seen++;
        if (seen === occurrence) return li;
    }
    throw new Error(`segment boundary ${i}: the route enters L${level} fewer than `
        + `${occurrence} times`);
});
console.log(`segment boundaries at legs ${boundaries.join(', ')}`);

const route = {
    generated_by: 'scripts/procgen/plan-seedling-r2-route.mjs',
    description: 'The R2 walk: every item room still reachable with the SOLIDS BACK, '
        + 'over the (level, component) graph of the POST-CLEAR geometry, with pits as '
        + 'a modelled transport and one HOLD on L71\'s button. Legs carry no targets '
        + 'except where a hold needs them — entering an item room IS collection at '
        + 'this rung.',
    boot: { ...R2_BOOT },
    noHazards: [...R2_NO_HAZARDS],
    item_order: visitOrder,
    start_node: START,
    grants,
    persistence: clears.map((c) => ({ level: c.level, tag: c.tag, note: c.note })),
    persistence_refused: refusedClears
        .filter((c) => routeLevels.has(c.level))
        .map((c) => ({ level: c.level, tag: c.tag, why: c.why })),
    holds,
    segment_boundaries: boundaries,
    leg_boots: legBoots,
    legs,
};

if (g.unbuildable.size > 0) {
    const onRoute = [...g.unbuildable.keys()].filter((l) => routeLevels.has(l));
    console.log(`levels that do not build (${g.unbuildable.size}), on the route: `
        + `${onRoute.join(', ') || 'none'}`);
}
if (WRITE) {
    writeFileSync(OUT, `${JSON.stringify(route, null, 2)}\n`);
    console.log(`\nwrote ${OUT}`);
} else {
    console.log('\n(dry run — pass --write to update fixtures/r2-route.json)');
}
