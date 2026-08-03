#!/usr/bin/env node
/**
 * plan-seedling-r3-route — compute the R3 full-walk route and write it to
 * `frontend/modules/seedlingDemo/fixtures/r3-route.json`.
 *
 * Region-atlas Phase 8, subtractive ladder rung R3, slice 5. Brief:
 * `CC/docs/plans/seedling-bot-r3-opus-kickoff.md` §9 and §11.
 *
 * Same shape as `plan-seedling-r2-route.mjs` and for the same reasons: this
 * is ROUTE AUTHORING, it gates nothing, the committed leg list is the
 * artifact and this script is how it was arrived at. Read `r1`'s docblock
 * for the doctrine and `r2`'s for the geometry; what follows is only what
 * R3 changed.
 *
 * ── TWO THINGS ARE DIFFERENT, and both of them are the rung ────────────
 *
 * **1. "REACHED" IS THE PICKUP'S OWN TILE, not a component of the level.**
 * At R2 a grant fired on the arrival tick, so entering the room WAS
 * collection and a leg could stop at the door. R3 has to stand ON the
 * pickup, so the tour targets a component the pickup can be walked INTO
 * from — `componentsAround(level, pickup.rect)` — and the leg carries a
 * `collect` naming it. A route that gets into the room and no further is a
 * route that collects nothing, and at R2 it would have looked identical.
 *
 * **2. THE MAP CHANGES HALFWAY, because the PLAYER changes it.** R3's one
 * real opener is L71's `shieldlock@288,256`, and `Lock.turnOff()` writes
 * `setPersistence(2, false)`. So the geometry after the touch is the
 * geometry before it WITH TAG 2 CLEARED — the same clear R2 declared on its
 * tape, earned instead of asserted. The tour therefore runs over TWO
 * graphs:
 *
 *     phase 1   the 7 named-exception clears           boot -> darkshield -> the lock
 *     phase 2   those 7 PLUS the earned (71, 2)        the lock -> darksuit -> the pit
 *
 * Modelling it any other way is wrong in one direction or the other: a
 * graph with the lock standing seals the return trip that comes back
 * through the same corridor, and a graph with it gone lets the tour walk
 * east before the shield is even collected.
 *
 * ⚠ INSTRUMENTS PROPOSE, THE SHIPPED PLANNER CONFIRMS. `recon-seedling-r3
 * --minimal` computed the 8-clear bill; this script is what has to
 * reproduce it, and the clear list below is the recon's answer minus the
 * one entry R3 opens by hand.
 *
 * Run: node scripts/procgen/plan-seedling-r3-route.mjs [--write] [--verbose]
 *      node scripts/procgen/plan-seedling-r3-route.mjs --reach=71:3
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { contactsAt, nodeCentre } = await import(join(MODULE, 'botDriverV2.js'));
const {
    R3_BOOT, R3_CLEARS, R3_HOLD_TICKS, R3_ITEM_ROOMS, R3_LATTICE, R3_NODE_MARGIN,
    R3_NO_HAZARDS, R3_SEGMENT_BOUNDARIES, R3_TOUCH, assertRouteWellFormed,
} = await import(join(MODULE, 'r3Walk.js'));
const { makeRouteGraph } = await import(join(HERE, 'seedlingRouteGraph.mjs'));

const WRITE = process.argv.includes('--write');
const VERBOSE = process.argv.includes('--verbose');
const OUT = join(MODULE, 'fixtures', 'r3-route.json');
const LEVEL_COUNT = 116;

/** The plan half of `relax`, exactly as `synthesizeLegs` derives it. */
const PLAN = {
    noclip: false, noHazards: R3_NO_HAZARDS, avoidVolumes: true, lattice: R3_LATTICE,
};
const source = atlasLevelSource();
/** Shared across both phases: keyed by level AND its own cleared tags. */
const cache = { worlds: new Map(), components: new Map() };


/**
 * ⛔ THE FROZEN CENSUS PIN — the levels this rung's `blocking` census could
 * not build when this route was authored.
 *
 * R2 paid the blocking bill for the 47 levels its walk entered; R5 paid it
 * for the whole map, and 29 of these went from "throws" to "builds". More
 * buildable levels means more edges, and more edges means the BFS finds a
 * DIFFERENT (shorter) tour — the R4 planner authored a route one leg
 * shorter the first time the wider census was in place, against six
 * recorded and frozen tapes. The committed route file is the artifact, so
 * the graph it was authored over is pinned BY NUMBER rather than by a
 * predicate that would rot silently at the next widening.
 *
 * L57 and L112 are absent because they still do not build for reasons of
 * their own (an unextracted `TentacleBeast` mask; an unpriced `Pod`
 * volume), which is R6's bill and not a pin.
 */
const FROZEN_UNBUILDABLE = new Set([
    1, 6, 8, 16, 19, 26, 28, 33, 34, 35, 36, 41, 42, 58, 66, 69, 86, 88, 91,
    93, 100, 101, 103, 104, 105, 107, 108, 111, 113,
]);

const planWith = (clears) => makeRouteGraph({
    source,
    clears: clears.map((c) => ({ level: c.level, tag: c.tag })),
    plan: PLAN,
    lattice: R3_LATTICE,
    holdTicks: R3_HOLD_TICKS,
    levelCount: LEVEL_COUNT,
    cache,
    excludeLevels: FROZEN_UNBUILDABLE,
});

/** The clears the walk DECLARES — the seven named exceptions. */
const DECLARED = R3_CLEARS.map((c) => ({ level: c.level, tag: c.tag, note: c.note }));
/** ...plus the one the PLAYER earns, which is phase 2's geometry. */
const EARNED = { level: R3_TOUCH.level, tag: R3_TOUCH.tag, note: 'earned by the touch' };

console.log(`clears: ${DECLARED.length} declared (named exceptions), 1 earned `
    + `(L${EARNED.level} tag ${EARNED.tag}, by the touch)`);

const phase1 = planWith(DECLARED);
const phase2 = planWith([...DECLARED, EARNED]);

// `--reach=<level>:<component>` on the phase-1 graph, the R2 diagnostic.
const reachArg = process.argv.find((a) => a.startsWith('--reach='));
if (reachArg) {
    const start = reachArg.slice('--reach='.length);
    const { dist } = phase1.bfs(start);
    console.log(`${dist.size} node(s) reachable from ${start}:`);
    [...dist.entries()].sort((a, b) => a[1] - b[1])
        .forEach(([n, d]) => console.log(`  ${d}  ${n}`));
    process.exit(0);
}

/**
 * ── `--survey`: WHICH ITEM ROOMS SURVIVE THE NARROWING ─────────────────
 *
 * The one question R2's planner could not ask, and the one R3 has to ask
 * FIRST. At R2 an item was collected by entering its LEVEL, so "reachable"
 * meant "some component of that level is reachable". At R3 the walk has to
 * stand on the pickup, and a level can be reachable while the pickup's own
 * tile is not — which is not a routing difficulty, it is a different
 * answer to whether the item is on the claim at all.
 *
 * Printed as a table rather than thrown one room at a time, because a
 * shrinkage of the target is a FINDING FOR THE USER (kickoff §1 ruling 3)
 * and a finding delivered one item per run is a finding delivered wrong.
 */
function survey(g, label) {
    const start = `${R3_BOOT.level}:${phase1.componentAt(R3_BOOT.level,
        R3_BOOT.x + TILE_SIZE / 2, R3_BOOT.y + TILE_SIZE / 2)}`;
    const { dist } = g.bfs(start);
    console.log(`\n${label}: ${dist.size} node(s) reachable from ${start}`);
    const sealed = [];
    for (const room of R3_ITEM_ROOMS) {
        const world = g.worldFor(room.level);
        if (!world) {
            console.log(`  ${room.item.padEnd(11)} L${room.level}: LEVEL UNBUILDABLE`);
            sealed.push(room);
            continue;
        }
        const p = (world.pickups ?? []).find((q) => q.x === room.pickup.x
            && q.y === room.pickup.y);
        const around = p ? g.componentsAround(room.level, p.rect) : [];
        const ok = around.filter((id) => dist.has(`${room.level}:${id}`));
        const inLevel = [...dist.keys()].filter((n) => n.startsWith(`${room.level}:`));
        console.log(`  ${room.item.padEnd(11)} L${room.level}: the pickup touches `
            + `[${around.join(',')}], of which reachable [${ok.join(',')}] `
            + `${ok.length ? '✅' : '❌ SEALED'} — the walk reaches [${inLevel.join(' ')}] `
            + 'of this level');
        if (ok.length === 0) sealed.push(room);
    }
    return sealed;
}
if (process.argv.includes('--survey')) {
    survey(phase1, `phase 1 (the ${DECLARED.length} declared clears)`);
    survey(phase2, `phase 2 (+ the earned L${EARNED.level} tag ${EARNED.tag})`);
    console.log('\n⚠ `darksuit` SEALED in phase 1 and open in phase 2 is the TOUCH '
        + 'working, not a finding: that is the whole reason there are two phases. A room '
        + 'sealed in BOTH is a room this rung cannot collect from.');
    process.exit(0);
}

/**
 * A lattice cell in `componentId` from which `rect` can be walked into, as
 * a pixel position.
 *
 * ⚠ The APPROACH POINT, not the target. `runCollect` and `runTouch` drive
 * the last pixels themselves — into a volume the planner is forbidden to
 * route through — so what the leg needs is somewhere adjacent to stand,
 * inside the component the tour actually arrives in.
 *
 * Nearest to the volume's centre, with a deterministic tie-break, because
 * the route is a COMMITTED artifact and Map iteration order is not a
 * tie-break anyone reviewed.
 */
function approachCell(g, level, componentId, rect, clearance = 0) {
    const map = g.componentsOf(level);
    const cx0 = Math.floor(rect.x / R3_LATTICE) - 1;
    const cx1 = Math.ceil(rect.right / R3_LATTICE);
    const cy0 = Math.floor(rect.y / R3_LATTICE) - 1;
    const cy1 = Math.ceil(rect.bottom / R3_LATTICE);
    const centre = { x: (rect.x + rect.right) / 2, y: (rect.y + rect.bottom) / 2 };
    const candidates = [];
    for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
            if (map.get(`${cx},${cy}`) !== componentId) continue;
            const p = nodeCentre(cx, cy, R3_LATTICE);
            // ⚠ CLEARANCE FROM THE VOLUME, and it is the controller's
            // overshoot that demands it. The bang-bang controller passes a
            // waypoint before braking back, so a cell whose player box is
            // merely OUTSIDE the pickup is one the drive can still clip —
            // and clipping a pickup starts its ceremony a waypoint early,
            // which freezes the player mid-drive. `hasArrived` needs them
            // STOPPED, and a freeze preserves velocity rather than clearing
            // it, so the drive never arrives and the leg stalls for its
            // whole budget. L64's ghostspear found this at (76.36,34.91),
            // one third of a pixel into a 12x4 volume.
            const box = {
                x: p.x - 2 - clearance,
                y: p.y - 2 - clearance,
                right: p.x + 2 + clearance,
                bottom: p.y + 3 + clearance,
            };
            if (box.x < rect.right && box.right > rect.x
                && box.y < rect.bottom && box.bottom > rect.y) continue;
            candidates.push({ ...p, d: Math.hypot(p.x - centre.x, p.y - centre.y) });
        }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    return { x: candidates[0].x, y: candidates[0].y };
}

/** The rect of a pickup, from the world the phase's graph built. */
function pickupRect(g, level, at) {
    const world = g.worldFor(level);
    const p = (world.pickups ?? []).find((q) => q.x === at.x && q.y === at.y);
    if (!p) {
        throw new Error(`level ${level} has no pickup at (${at.x},${at.y}); it has `
            + `[${(world.pickups ?? []).map((q) => `${q.tag}@${q.x},${q.y}`).join(' ')}]`);
    }
    return p.rect;
}

/** The nearest node of `level` from `cursor` that `want` accepts. */
function hopTo(g, cursor, level, want, what) {
    const { dist } = g.bfs(cursor);
    const candidates = [...dist.keys()]
        .filter((n) => n.startsWith(`${level}:`) && want(Number(n.split(':')[1])))
        .sort((a, b) => dist.get(a) - dist.get(b) || (a < b ? -1 : 1));
    if (candidates.length === 0) {
        const nodes = [...g.edges.keys()].filter((n) => n.startsWith(`${level}:`));
        console.error(`\nno path ${cursor} -> ${what}. Diagnostics:`);
        console.error(`  ${dist.size} node(s) reachable from ${cursor}`);
        console.error(`  L${level} nodes with edges: ${nodes.join(' ') || '(none)'}`);
        throw new Error(`no path from ${cursor} to ${what}. With the crutches off this `
            + 'is a SEAL, and a seal the slice-0 feasibility pass did not name is a '
            + 'finding for the user, not an item to trade away. Run --survey for the '
            + 'whole table before deciding anything from this one line.');
    }
    return { node: candidates[0], hops: g.pathBetween(cursor, candidates[0]) };
}

// ── the tour ──────────────────────────────────────────────────────────
// A STEP is either a graph hop or an in-level ACTION. R2's tour produced
// hops alone; R3's has to interleave a `collect` at every item room and a
// `touch` at the one lock it opens, and an action stays INSIDE its level
// rather than starting a new leg.
const steps = [];
const bootSpawn = { x: R3_BOOT.x + TILE_SIZE / 2, y: R3_BOOT.y + TILE_SIZE / 2 };
const bootComponent = phase1.componentAt(R3_BOOT.level, bootSpawn.x, bootSpawn.y);
if (bootComponent === null) {
    throw new Error(`the boot (${bootSpawn.x},${bootSpawn.y}) in level ${R3_BOOT.level} `
        + 'is not in any walkable component');
}
const START = `${R3_BOOT.level}:${bootComponent}`;
let cursor = START;
const visitOrder = [];

/** The item rooms before the touch, and the one after it. */
const BEFORE_TOUCH = R3_ITEM_ROOMS.slice(0, -1);
const AFTER_TOUCH = R3_ITEM_ROOMS[R3_ITEM_ROOMS.length - 1];

function collectStep(g, room) {
    const rect = pickupRect(g, room.level, room.pickup);
    // ⚠ THE NARROWING. Not "any component of the level" — the components
    // the pickup's own volume is 4-adjacent to, which is what "the walk can
    // stand on it" means. A pickup is a blocked cell to the planner (it is
    // an avoid volume), so the answer is the ring around it.
    const around = new Set(g.componentsAround(room.level, rect));
    if (around.size === 0) {
        throw new Error(`no component can walk into ${room.item}@${room.pickup.x},`
            + `${room.pickup.y} in level ${room.level}`);
    }
    const { node, hops } = hopTo(g, cursor, room.level, (id) => around.has(id),
        `${room.item}'s own tile in L${room.level}`);
    steps.push(...hops.map((h) => ({ kind: 'hop', ...h })));
    cursor = node;
    // The clearance is the node margin the driver plans with: enough that
    // the controller's overshoot cannot reach the volume from here.
    const at = approachCell(g, room.level, Number(node.split(':')[1]), rect, R3_NODE_MARGIN);
    if (!at) {
        throw new Error(`no approach cell with ${R3_NODE_MARGIN} px of clearance for `
            + `${room.item} in L${room.level} — every cell beside the pickup is one the `
            + 'controller could overshoot into, which would start the ceremony a '
            + 'waypoint early and stall the drive.');
    }
    steps.push({
        kind: 'collect', level: room.level, at, pickup: { ...room.pickup },
        item: room.item,
    });
    visitOrder.push(`${room.item}(L${room.level})`);
}

for (const room of BEFORE_TOUCH) collectStep(phase1, room);

// ── the touch ─────────────────────────────────────────────────────────
const lockWorld = phase1.worldFor(R3_TOUCH.level);
const lock = lockWorld.activators.find((a) => a.x === R3_TOUCH.lock.x
    && a.y === R3_TOUCH.lock.y);
if (!lock || !lock.touchRect) {
    throw new Error(`level ${R3_TOUCH.level} has no touch responder at `
        + `(${R3_TOUCH.lock.x},${R3_TOUCH.lock.y})`);
}
const touchFrom = new Set(phase1.componentsAround(R3_TOUCH.level, lock.touchRect));
const toLock = hopTo(phase1, cursor, R3_TOUCH.level, (id) => touchFrom.has(id),
    `the west side of ${lock.id}`);
steps.push(...toLock.hops.map((h) => ({ kind: 'hop', ...h })));
cursor = toLock.node;
const touchAt = approachCell(phase1, R3_TOUCH.level, Number(cursor.split(':')[1]),
    lock.touchRect);
if (!touchAt) throw new Error(`no approach cell for ${lock.id}`);
steps.push({
    kind: 'touch', level: R3_TOUCH.level, at: touchAt, lock: { ...R3_TOUCH.lock },
});

// ── phase 2: the map the player just changed ──────────────────────────
// The touch leaves the player pinned against the lock's west face and
// snapped to its row. Resolve THAT position into phase 2's graph, where
// the lock is gone, rather than assuming the component id survived the
// renumbering — it does not, and an id carried across would be a fact
// about the wrong map.
const snapped = { x: touchAt.x, y: lock.snapY };
const afterComponent = phase2.componentAt(R3_TOUCH.level, snapped.x, snapped.y);
if (afterComponent === null) {
    throw new Error(`the post-touch position (${snapped.x},${snapped.y}) in level `
        + `${R3_TOUCH.level} is not in any walkable component of phase 2`);
}
cursor = `${R3_TOUCH.level}:${afterComponent}`;
if (VERBOSE) console.log(`phase 2 resumes at ${cursor} (${snapped.x},${snapped.y})`);
collectStep(phase2, AFTER_TOUCH);

// ── the tail: back to the hub and out through its pit ──────────────────
const { dist: fromLast } = phase2.bfs(cursor);
const hub = [...fromLast.keys()].filter((n) => n.startsWith(`${R3_TOUCH.level}:`))
    .sort((a, b) => fromLast.get(a) - fromLast.get(b) || (a < b ? -1 : 1))[0];
if (!hub) throw new Error(`no path back to the cluster hub L${R3_TOUCH.level}`);
steps.push(...phase2.pathBetween(cursor, hub).map((h) => ({ kind: 'hop', ...h })));
const out = (phase2.edges.get(hub) ?? []).find((e) => e.kind === 'fall' && e.toLevel === 82);
if (!out) throw new Error(`L${R3_TOUCH.level}'s fall to L82 is not an edge out of ${hub}`);
steps.push({ kind: 'hop', from: hub, edge: out });

// ── steps -> legs ─────────────────────────────────────────────────────
// One leg per level ENTERED, including every pass-through. An ACTION and a
// HOLD both stay INSIDE their level, so they contribute targets to the leg
// already open rather than starting a new one.
const legs = [];
const legBoots = [];
const holds = [];
const collects = [];
const touches = [];
let standing = { ...R3_BOOT };
let open = null;
const openLeg = (level) => {
    legs.push({ level, targets: [] });
    legBoots.push({ ...standing });
    open = legs[legs.length - 1];
    return open;
};
for (const step of steps) {
    if (step.kind === 'collect' || step.kind === 'touch') {
        const leg = open ?? openLeg(step.level);
        if (leg.level !== step.level) {
            throw new Error(`a ${step.kind} in L${step.level} met an open leg in `
                + `L${leg.level}`);
        }
        const target = step.kind === 'collect'
            ? { x: step.at.x, y: step.at.y, collect: { pickup: { ...step.pickup } } }
            : { x: step.at.x, y: step.at.y, touch: { lock: { ...step.lock } } };
        leg.targets.push(target);
        (step.kind === 'collect' ? collects : touches).push({
            leg: legs.length - 1, level: step.level, ...step,
        });
        continue;
    }
    const { from, edge } = step;
    // ⚠ A LEG'S LEVEL IS WHERE THE PLAYER IS — the hop's FROM node, never
    // `edge.to`. The R2 planner's first cut read the destination and
    // produced a leg list whose levels were shifted by one hop.
    const fromLevel = Number(String(from).split(':')[0]);
    if (edge.kind === 'hold') {
        const leg = open ?? openLeg(fromLevel);
        if (leg.level !== edge.toLevel) {
            throw new Error(`a hold edge in L${edge.toLevel} met an open leg in `
                + `L${leg.level}`);
        }
        leg.targets.push({ x: edge.stand.x, y: edge.stand.y, hold: { ...edge.hold } });
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
        throw new Error(`a ${edge.kind} edge out of L${fromLevel} met an open leg in `
            + `L${leg.level}`);
    }
    leg.exit = edge.exit;
    open = null;
    for (const p of edge.through) {
        legs.push({ level: p.level, targets: [], exit: { pit: p.pit } });
        legBoots.push({ ...p.boot });
    }
    standing = { ...edge.boot };
}
if (open) throw new Error('the last step was an action, so the walk ends mid-level');
legs.push({ level: standing.level, targets: [] });
legBoots.push({ ...standing });

// ── the forced contacts ───────────────────────────────────────────────
// What each leg STARTS standing inside, computed with the driver's OWN
// `contactsAt` so the declaration and the check cannot drift apart.
//
// ⚠ PER PHASE. A leg after the touch is standing in the map the player
// changed, and asking phase 1 what it is standing in would ask about a
// level that no longer exists — L71's own return leg is exactly that case.
const touchLeg = touches[0].leg;
legs.forEach((leg, i) => {
    const g = i <= touchLeg ? phase1 : phase2;
    const world = g.worldFor(leg.level);
    const contacts = contactsAt(world,
        legBoots[i].x + TILE_SIZE / 2, legBoots[i].y + TILE_SIZE / 2,
        { avoidVolumes: true });
    if (contacts.length > 0) leg.contacts = contacts;
});

// ── the report ────────────────────────────────────────────────────────
console.log(`\nvisit order: ${visitOrder.join(' -> ')}`);
console.log(`${legs.length} leg(s) across ${new Set(legs.map((l) => l.level)).size} `
    + `level(s); ${collects.length} collect(s), ${touches.length} touch(es), `
    + `${holds.length} hold(s)`);
if (VERBOSE) {
    legs.forEach((l, i) => console.log(`  ${String(i).padStart(2)} L${l.level} `
        + `${JSON.stringify(l.targets)} ${JSON.stringify(l.exit ?? null)}`));
}

// Every item room is entered, and entered with a collect on it.
for (const room of R3_ITEM_ROOMS) {
    const got = collects.find((c) => c.item === room.item);
    if (!got) throw new Error(`no collect was planned for ${room.item}`);
    if (legs[got.leg].level !== room.level) {
        throw new Error(`${room.item}'s collect is on a leg in L${legs[got.leg].level}`);
    }
}
// ⚠ THE ORDER CONSTRAINT, ASSERTED. `ShieldLock.update` gates on
// `Player.hasDarkShield`, so the darkshield collect must precede the touch.
const shieldLeg = collects.find((c) => c.item === R3_TOUCH.item).leg;
if (!(shieldLeg < touchLeg)) {
    throw new Error(`the ${R3_TOUCH.item} collect is on leg ${shieldLeg} and the touch `
        + `on leg ${touchLeg}: the shield has to come FIRST or the lock never activates`);
}

const route = {
    generated_by: 'scripts/procgen/plan-seedling-r3-route.mjs',
    description: 'The R3 full walk: the SAME MAP as R2 with the crutches off. Items are '
        + 'COLLECTED (walked onto and talked through, grants EMPTY), one blocker is '
        + 'OPENED by hand (L71 shieldlock@288,256, touched while holding the dark '
        + 'shield), and the persistence clear list is down from 25 to the 7 named '
        + "exceptions, each waiting on an opener a later rung builds. The map changes "
        + 'halfway: Lock.turnOff() writes setPersistence(2, false), so everything after '
        + 'the touch is planned against the geometry the PLAYER made.',
    boot: { ...R3_BOOT },
    noHazards: [...R3_NO_HAZARDS],
    item_order: visitOrder,
    start_node: START,
    grants: [],
    persistence: DECLARED,
    earned: [EARNED],
    holds,
    touches: touches.map((t) => ({ leg: t.leg, level: t.level, lock: t.lock, at: t.at })),
    collects: collects.map((c) => ({
        leg: c.leg, level: c.level, item: c.item, pickup: c.pickup, at: c.at,
    })),
    segment_boundaries: R3_SEGMENT_BOUNDARIES.map(([level, occurrence], i) => {
        // ⚠ NAMED, NOT INDEXED. "The Nth leg in level L" survives a route
        // that shifts by a leg; a raw index silently points somewhere else.
        let seen = 0;
        const at = legs.findIndex((l) => l.level === level && ++seen === occurrence);
        if (at < 0) {
            throw new Error(`segment boundary ${i} names occurrence ${occurrence} of `
                + `level ${level}, which the route has only ${seen} of`);
        }
        return at;
    }),
    leg_boots: legBoots,
    legs,
};

assertRouteWellFormed(route);

if (WRITE) {
    writeFileSync(OUT, `${JSON.stringify(route, null, 2)}\n`);
    console.log(`\nwrote ${OUT}`);
} else {
    console.log('\n(dry run — pass --write to commit the route)');
}
