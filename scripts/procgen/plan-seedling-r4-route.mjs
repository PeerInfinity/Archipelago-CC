#!/usr/bin/env node
/**
 * plan-seedling-r4-route — compute the R4 full-walk route and write it to
 * `frontend/modules/seedlingDemo/fixtures/r4-route.json`.
 *
 * Region-atlas Phase 8, subtractive ladder rung R4, slice 4. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §11 and §12.3 item 4.
 *
 * Same shape as `plan-seedling-r3-route.mjs` and for the same reasons: this
 * is ROUTE AUTHORING, it gates nothing, the committed leg list is the
 * artifact and this script is how it was arrived at. Read `r1`'s docblock
 * for the doctrine, `r2`'s for the geometry and `r3`'s for the narrowing;
 * what follows is only what R4 changed.
 *
 * ── THREE THINGS ARE DIFFERENT, and all three are the rung ─────────────
 *
 * **1. THE FLOOR IS THE GAME'S.** `noHazards` is `["water"]`, so lava is
 * armed and forbidden — which is not a routing inconvenience, it is a
 * different map. L78, L79 and L82 leave it, and with them `darksuit` and
 * R3's whole tail. Every clear in the bill is therefore RE-DERIVED against
 * this map rather than inherited from R3's.
 *
 * **2. THE PLAYER MOVES WALLS.** R3's one map change was a lock the player
 * touched, and it was BANKED — `Lock.turnOff()` writes persistence, so the
 * level stayed open. R4's five are PER VISIT: a `PushableBlockFire` holds
 * its position in an instance variable with no persistence at all, so
 * leaving L63 and coming back rebuilds the block in its corridor. That
 * cannot be a graph phase, because a phase is a fact about the whole run.
 * It is modelled where it belongs instead: as extra TARGETS inside one leg,
 * planned against the run's own live `pushables` — which
 * `botDriverV2.planNow` now threads for exactly this.
 *
 * ⚠ So this script does NOT search for the chains. `recon-seedling-pushes`
 * did that and the game confirmed it to the pixel; the stances live in
 * `r4Walk.R4_PUSH_CHAINS`. What this script does is CONFIRM them with the
 * shipped geometry — every stance standable, every stance in the component
 * the leg is in, and the chain's target reachable only afterwards — which is
 * the "instruments propose, the shipped planner confirms" rule at the one
 * place it has been broken twice.
 *
 * **3. THE CLEAR BILL HAS AN EARNED HALF THAT IS NOT A LOCK.** R3 earned one
 * flag, by touching a shield lock. R4 earns two, and the second one is a
 * LIGHTPOLE the third L65 push cannot geometrically avoid. Neither is
 * declared; both are asserted from the run.
 *
 * Run: node scripts/procgen/plan-seedling-r4-route.mjs [--write] [--verbose]
 *      node scripts/procgen/plan-seedling-r4-route.mjs --survey
 *      node scripts/procgen/plan-seedling-r4-route.mjs --reach=63:1
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { contactsAt, nodeCentre, plannerObstacleAt } =
    await import(join(MODULE, 'botDriverV2.js'));
const {
    R4_BOOT, R4_CLEARS, R4_EARNED, R4_EQUIP_SLOT, R4_ITEM_ROOMS, R4_KEY_LOCK,
    R4_KEY_PICKUP, R4_LATTICE, R4_NODE_MARGIN, R4_NO_HAZARDS, R4_PUSH_CHAINS,
    R4_SEGMENT_BOUNDARIES, assertRouteWellFormed,
} = await import(join(MODULE, 'r4Walk.js'));
const { makeRouteGraph } = await import(join(HERE, 'seedlingRouteGraph.mjs'));

const WRITE = process.argv.includes('--write');
const VERBOSE = process.argv.includes('--verbose');
const OUT = join(MODULE, 'fixtures', 'r4-route.json');
const LEVEL_COUNT = 116;

/** The plan half of `relax`, exactly as `synthesizeLegs` derives it. */
const PLAN = {
    noclip: false, noHazards: R4_NO_HAZARDS, avoidVolumes: true, lattice: R4_LATTICE,
};
const source = atlasLevelSource();
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
    lattice: R4_LATTICE,
    holdTicks: 101,
    levelCount: LEVEL_COUNT,
    cache,
    excludeLevels: FROZEN_UNBUILDABLE,
});

/**
 * The clears the walk DECLARES — the named exceptions.
 *
 * ⚠ `R4_DROP_CLEAR=<i>` removes ONE of them, which is how the bill is kept
 * IRREDUNDANT. A one-out sweep is not the same as a minimal bill (two clears
 * in a doorway wide enough for either each answer "not required", and then
 * both come off and the door shuts), so the sweep is the SCREEN and the
 * committed list is what the planner then confirms with every survivor in
 * place. See `r3Walk.R3_CLEARS` for the three rounds that lesson cost.
 */
const DROP = process.env.R4_DROP_CLEAR === undefined
    ? -1 : Number(process.env.R4_DROP_CLEAR);
const DECLARED = R4_CLEARS
    .filter((_, i) => i !== DROP)
    .map((c) => ({ level: c.level, tag: c.tag, note: c.note }));
/**
 * ...plus the ONE the player earns that changes geometry.
 *
 * ⚠ ONLY ONE OF THE TWO. `{68, 0}` despawns the boss lock on the next
 * `Game`, so a leg after it plans against a different L68 — that is a phase.
 * `{65, 2}` is a LIGHTPOLE, whose census entry is `cosmetic`
 * (`type = "LightPole"` is in no solids list), so banking it changes no
 * geometry at all and a second phase for it would be two identical graphs.
 * Recorded here rather than left implicit, because "the earned list and the
 * phase list are the same list" is the kind of assumption that is true until
 * the first cosmetic opener.
 */
const PHASE_2 = R4_EARNED.filter((e) => e.level === R4_KEY_LOCK.level);

const phase1 = planWith(DECLARED);
const phase2 = planWith([...DECLARED, ...PHASE_2]);

console.log(`clears: ${DECLARED.length} declared (named exceptions), `
    + `${R4_EARNED.length} earned (${R4_EARNED.map((e) => `L${e.level}:${e.tag} by `
        + `${e.by}`).join(', ')}), of which ${PHASE_2.length} changes geometry`);

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
 * ── THE PUSHED-BLOCK OVERLAY ──────────────────────────────────────────
 *
 * The `pushables` map `plannerObstacleAt` takes, for the state a chain is in
 * after `n` of its pushes. This is the ONE piece of geometry this script
 * computes rather than reads off the graph, and it exists because a push is
 * per VISIT: `makeRouteGraph` builds one component map per (level, clear
 * list), and a block that moves for thirty-two ticks and is back next visit
 * is not a clear list.
 *
 * ⚠ `removed: true` IS THE DESTRUCTION, and it is what makes three of the
 * five pushes openers. A block resting on water, lava or a pit destroys
 * itself; a pit tile is forbidden floor either way, so reachability cannot
 * tell the two apart — but the SOLID leaving the corridor is the whole
 * claim, and modelling it as "still there, one tile over" would answer a
 * different question in L63 and L67, where the block's own destination is
 * the pit it dies on.
 */
function pushableOverlay(chain, n) {
    const id = `pushableblockspear@${chain.block.x},${chain.block.y}`;
    const world = phase1.worldFor(chain.level);
    const spawn = world.pushables.find((p) => p.id === id);
    if (!spawn) {
        throw new Error(`L${chain.level} has no pushable at (${chain.block.x},`
            + `${chain.block.y}); it has `
            + `[${world.pushables.map((p) => p.id).join(' ') || 'none'}]`);
    }
    const solid = world.solids.find((s) => s.pushableId === id);
    if (n === 0) return new Map([[id, { rect: solid.rect, removed: false }]]);
    const step = chain.pushes[n - 1];
    if (step.to === null) return new Map([[id, { rect: solid.rect, removed: true }]]);
    return new Map([[id, {
        rect: {
            x: step.to.tx * TILE_SIZE,
            y: step.to.ty * TILE_SIZE,
            right: (step.to.tx + 1) * TILE_SIZE,
            bottom: (step.to.ty + 1) * TILE_SIZE,
        },
        removed: false,
    }]]);
}

/**
 * Is a pixel position standable in `level` under a block overlay?
 *
 * Asked with the SHIPPED `plannerObstacleAt` and the driver's own node
 * margin, because "the stance is a cell of the flood" and "the stance is
 * somewhere the drive can stop" are the two questions R3 found are not the
 * same one.
 */
function standable(g, level, at, overlay, margin = 0) {
    const world = g.worldFor(level);
    try {
        return plannerObstacleAt(world, at.x, at.y, null,
            { ...PLAN, pushables: overlay, margin }) === null;
    } catch (e) {
        return e;
    }
}

/**
 * ── `--survey`: WHICH ROOMS SURVIVE THE ARMED FLOOR ────────────────────
 *
 * R3's survey asked whether the pickup's own tile was reachable. R4 asks the
 * same question of a different map — one where lava is a wall — and adds the
 * three push chains, because a chain that does not open what it claims is
 * the rung's headline failing rather than a routing difficulty.
 *
 * Printed as a table rather than thrown one room at a time: a shrinkage of
 * the target is a FINDING FOR THE USER, and a finding delivered one item per
 * run is a finding delivered wrong.
 */
function survey() {
    const start = `${R4_BOOT.level}:${phase1.componentAt(R4_BOOT.level,
        R4_BOOT.x + TILE_SIZE / 2, R4_BOOT.y + TILE_SIZE / 2)}`;
    for (const [label, g] of [['phase 1 (declared)', phase1],
        [`phase 2 (+ the earned L${R4_KEY_LOCK.level}:${R4_KEY_LOCK.tag})`, phase2]]) {
        const { dist } = g.bfs(start);
        console.log(`\n${label}: ${dist.size} node(s) reachable from ${start}`);
        for (const room of [...R4_ITEM_ROOMS, R4_KEY_PICKUP]) {
            const world = g.worldFor(room.level);
            if (!world) {
                console.log(`  ${room.item.padEnd(11)} L${room.level}: LEVEL UNBUILDABLE`);
                continue;
            }
            const p = (world.pickups ?? []).find((q) => q.x === room.pickup.x
                && q.y === room.pickup.y);
            const around = p ? g.componentsAround(room.level, p.rect) : [];
            const ok = around.filter((id) => dist.has(`${room.level}:${id}`));
            const inLevel = [...dist.keys()].filter((n) => n.startsWith(`${room.level}:`));
            console.log(`  ${room.item.padEnd(11)} L${room.level}: the pickup touches `
                + `[${around.join(',')}], of which reachable [${ok.join(',')}] `
                + `${ok.length ? 'OK' : 'SEALED (needs a push)'} — the walk reaches `
                + `[${inLevel.join(' ')}]`);
        }
    }
    console.log('\n── the push chains, stance by stance ──');
    for (const chain of R4_PUSH_CHAINS) {
        console.log(`  L${chain.level} ${chain.pushes.length} push(es) — ${chain.opens}`);
        chain.pushes.forEach((p, i) => {
            const before = pushableOverlay(chain, i);
            const ok = standable(phase1, chain.level, p.at, before, R4_NODE_MARGIN);
            console.log(`     ${i + 1}. ${p.facing} at (${p.at.x},${p.at.y}) `
                + `${ok === true ? 'STANDABLE' : `NOT STANDABLE: ${describe(ok)}`}`);
        });
    }
    console.log('\n⚠ A room SEALED in the table above and opened by a chain below is the '
        + 'rung WORKING, not a finding. A room sealed with no chain naming it is one '
        + 'this rung cannot collect from.');
}
const describe = (o) => (o === false ? 'blocked'
    : (o instanceof Error ? o.message : `${o.kind} ${o.blocker?.tag ?? ''}`));

if (process.argv.includes('--survey')) {
    survey();
    process.exit(0);
}

/** A lattice cell in `componentId` from which `rect` can be walked into. */
function approachCell(g, level, componentId, rect, clearance = 0) {
    const map = g.componentsOf(level);
    const cx0 = Math.floor(rect.x / R4_LATTICE) - 1;
    const cx1 = Math.ceil(rect.right / R4_LATTICE);
    const cy0 = Math.floor(rect.y / R4_LATTICE) - 1;
    const cy1 = Math.ceil(rect.bottom / R4_LATTICE);
    const centre = { x: (rect.x + rect.right) / 2, y: (rect.y + rect.bottom) / 2 };
    const candidates = [];
    for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
            if (map.get(`${cx},${cy}`) !== componentId) continue;
            const p = nodeCentre(cx, cy, R4_LATTICE);
            // ⚠ CLEARANCE FROM THE VOLUME — the controller's overshoot, and
            // R3's `ghostspear` found it at one third of a pixel.
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
        throw new Error(`no path from ${cursor} to ${what}. With the floor ARMED this is `
            + 'a seal the coercion used to hide, and a seal nobody named is a finding '
            + 'for the user rather than an item to trade away. Run --survey for the '
            + 'whole table before deciding anything from this one line.');
    }
    return { node: candidates[0], hops: g.pathBetween(cursor, candidates[0]) };
}

// ── the tour ──────────────────────────────────────────────────────────
const steps = [];
const bootSpawn = { x: R4_BOOT.x + TILE_SIZE / 2, y: R4_BOOT.y + TILE_SIZE / 2 };
const bootComponent = phase1.componentAt(R4_BOOT.level, bootSpawn.x, bootSpawn.y);
if (bootComponent === null) {
    throw new Error(`the boot (${bootSpawn.x},${bootSpawn.y}) in level ${R4_BOOT.level} `
        + 'is not in any walkable component');
}
const START = `${R4_BOOT.level}:${bootComponent}`;
let cursor = START;
const visitOrder = [];

const chainFor = (level) => R4_PUSH_CHAINS.find((c) => c.level === level);

/**
 * Walk to a room, collect from it.
 *
 * ⚠ `after` is the block overlay the room is reached UNDER. For a level with
 * a chain the pickup is only reachable after the last push, so the
 * `componentsAround` question has to be asked of the pushed map — which the
 * graph does not have, because the graph is per clear list. Asked directly
 * of the geometry instead, with the same `plannerObstacleAt` the graph uses.
 */
function collectStep(g, room, { overlay = null } = {}) {
    const rect = pickupRect(g, room.level, room.pickup);
    const around = new Set(g.componentsAround(room.level, rect));
    if (!overlay) {
        if (around.size === 0) {
            throw new Error(`no component can walk into ${room.item}@${room.pickup.x},`
                + `${room.pickup.y} in level ${room.level}`);
        }
        const { node, hops } = hopTo(g, cursor, room.level, (id) => around.has(id),
            `${room.item}'s own tile in L${room.level}`);
        steps.push(...hops.map((h) => ({ kind: 'hop', ...h })));
        cursor = node;
    }
    const at = overlay
        // Inside a level whose geometry the walk itself changed, the
        // approach point is computed against the CHANGED map — and the leg
        // is already open, so there is no hop.
        ? nearestStandableBeside(g, room.level, rect, overlay)
        : approachCell(g, room.level, Number(cursor.split(':')[1]), rect, R4_NODE_MARGIN);
    if (!at) {
        throw new Error(`no approach cell with ${R4_NODE_MARGIN} px of clearance for `
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

/** `approachCell`, but over a pushed map the component graph does not have. */
function nearestStandableBeside(g, level, rect, overlay) {
    const world = g.worldFor(level);
    const CELLS = TILE_SIZE / R4_LATTICE;
    const centre = { x: (rect.x + rect.right) / 2, y: (rect.y + rect.bottom) / 2 };
    const out = [];
    for (let cy = 0; cy < world.height * CELLS; cy++) {
        for (let cx = 0; cx < world.width * CELLS; cx++) {
            const p = nodeCentre(cx, cy, R4_LATTICE);
            const box = {
                x: p.x - 2 - R4_NODE_MARGIN,
                y: p.y - 2 - R4_NODE_MARGIN,
                right: p.x + 2 + R4_NODE_MARGIN,
                bottom: p.y + 3 + R4_NODE_MARGIN,
            };
            if (box.x < rect.right && box.right > rect.x
                && box.y < rect.bottom && box.bottom > rect.y) continue;
            if (standable(g, level, p, overlay, R4_NODE_MARGIN) !== true) continue;
            out.push({ ...p, d: Math.hypot(p.x - centre.x, p.y - centre.y) });
        }
    }
    if (out.length === 0) return null;
    out.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    return { x: out[0].x, y: out[0].y };
}

/**
 * A push chain, CONFIRMED and emitted as targets.
 *
 * Three things are checked per push, and each of them is a way a declared
 * stance could be wrong without the tape saying so until the recording:
 *
 *   1. the stance is STANDABLE in the map the previous push left;
 *   2. the setup point is standable too and is axis-aligned with the stance
 *      along the push direction — which is what makes the FACING right, and
 *      the facing comes from velocity, so a stance reached by a last
 *      correction on the other axis aims the rect at a wall;
 *   3. the block really is where the push says it starts.
 *
 * What is NOT checked here is the rect and its unintended responders: that
 * is `levelRun.applyThrust`'s audit, which runs on the tick the rect fires,
 * against the world. A second copy here would be the two-consumers failure.
 */
const FACING_STEP = { E: [1, 0], N: [0, -1], W: [-1, 0], S: [0, 1] };
function pushChainSteps(g, chain) {
    chain.pushes.forEach((push, i) => {
        const before = pushableOverlay(chain, i);
        const at = standable(g, chain.level, push.at, before, R4_NODE_MARGIN);
        if (at !== true) {
            throw new Error(`L${chain.level} push ${i + 1}: the declared stance `
                + `(${push.at.x},${push.at.y}) is not standable after ${i} push(es) — `
                + `${describe(at)}. The sweep found it at the planner's own pitch, so `
                + 'this means the geometry, the clear list or the overlay has moved.');
        }
        const from = standable(g, chain.level, push.from, before, R4_NODE_MARGIN);
        if (from !== true) {
            throw new Error(`L${chain.level} push ${i + 1}: the setup point `
                + `(${push.from.x},${push.from.y}) is not standable — ${describe(from)}.`);
        }
        const [dx, dy] = FACING_STEP[push.facing];
        const alongX = push.from.x - push.at.x;
        const alongY = push.from.y - push.at.y;
        // The setup point must be BEHIND the stance along the push axis, and
        // exactly on it in the other one.
        if (dx !== 0 ? (alongY !== 0 || Math.sign(alongX) !== -dx)
            : (alongX !== 0 || Math.sign(alongY) !== -dy)) {
            throw new Error(`L${chain.level} push ${i + 1}: the setup point `
                + `(${push.from.x},${push.from.y}) is not directly behind the stance `
                + `(${push.at.x},${push.at.y}) along ${push.facing}. The approach has to `
                + 'END moving the way the press aims — `sprites()` derives '
                + '`Player.direction` from VELOCITY (x before y, sticky at rest), so a '
                + 'final correction on the other axis faces the wrong way and the rect '
                + 'hits a wall.');
        }
        steps.push({
            kind: 'spear', level: chain.level, at: { ...push.from }, setup: true,
        });
        steps.push({
            kind: 'spear',
            level: chain.level,
            at: { ...push.at },
            facing: push.facing,
            block: { ...chain.block },
            to: push.to,
        });
    });
}

// ── the itinerary ─────────────────────────────────────────────────────
// Declared rather than derived, because R4's order is decided by two
// mechanics (the spear before every press, the key before its lock) and a
// greedy tour that happened to satisfy them would be one geometry edit from
// not doing so. The ASSERTIONS are in `assertRouteWellFormed`; this is where
// the intent is written down.
const [SWORD, FEATHER, TORCH, SPEAR, HEALTH] = R4_ITEM_ROOMS;

for (const room of [SWORD, FEATHER, TORCH]) collectStep(phase1, room);

// ── the spear, and the SELECTION that makes a press a thrust ──────────
collectStep(phase1, SPEAR);
steps.push({ kind: 'equip', level: SPEAR.level, slot: R4_EQUIP_SLOT });

// ⛔ AND THERE IS NO `darkshield` LEG, which is the rung's real cost. See
// `r4Walk`'s header: armed lava leaves two terminal branches — L74's cluster
// and L68 — and a walk can only end in one. This tour takes the L68 one.

// ── the key chain: L59 -> L67, one push, the textless ceremony ────────
{
    const chain = chainFor(R4_KEY_PICKUP.level);
    const overlay = pushableOverlay(chain, chain.pushes.length);
    const world = phase1.worldFor(R4_KEY_PICKUP.level);
    const rect = (world.pickups ?? []).find((q) => q.x === R4_KEY_PICKUP.pickup.x
        && q.y === R4_KEY_PICKUP.pickup.y).rect;
    // The ARRIVAL component, not the pickup's: the whole point is that the
    // pickup is sealed until the push.
    const entry = new Set(phase1.componentsAround(R4_KEY_PICKUP.level,
        { x: chain.pushes[0].at.x - 2, y: chain.pushes[0].at.y - 2,
            right: chain.pushes[0].at.x + 2, bottom: chain.pushes[0].at.y + 3 }));
    const { node, hops } = hopTo(phase1, cursor, R4_KEY_PICKUP.level,
        (id) => entry.has(id), `L${R4_KEY_PICKUP.level}'s push stance`);
    steps.push(...hops.map((h) => ({ kind: 'hop', ...h })));
    cursor = node;
    // ⚠ THE POSITIVE CONTROL AT PLAN TIME. If the key's own tile were
    // reachable WITHOUT the push, the chain would prove nothing — and the
    // whole keyType-4 story would be a detour.
    const before = new Set(phase1.componentsAround(R4_KEY_PICKUP.level, rect));
    const reachable = [...before].some((id) => entry.has(id));
    if (reachable) {
        throw new Error(`L${R4_KEY_PICKUP.level}'s bosskey is reachable from the push `
            + 'stance WITHOUT pushing anything, so the chain opens nothing.');
    }
    pushChainSteps(phase1, chain);
    collectStep(phase1, R4_KEY_PICKUP, { overlay });
}

// ── L63's one push, which opens the door L65's chain needs ────────────
{
    const chain = chainFor(63);
    const overlay = pushableOverlay(chain, chain.pushes.length);
    const stanceRect = {
        x: chain.pushes[0].at.x - 2, y: chain.pushes[0].at.y - 2,
        right: chain.pushes[0].at.x + 2, bottom: chain.pushes[0].at.y + 3,
    };
    const entry = new Set(phase1.componentsAround(63, stanceRect));
    const { node, hops } = hopTo(phase1, cursor, 63, (id) => entry.has(id),
        "L63's push stance");
    steps.push(...hops.map((h) => ({ kind: 'hop', ...h })));
    cursor = node;
    pushChainSteps(phase1, chain);
    // The door the push opened, walked to over the CHANGED map. The graph
    // cannot supply this hop — its L63 has the block in the corridor — so
    // the leg carries the door as its own exit and the driver plans the
    // walk against the run's live `pushables`.
    steps.push({ kind: 'exit-after-push', level: 63, to: 65, exit: { x: 128, y: 304 },
        overlay });
}

// ── L65's three pushes, and the door to health's room ─────────────────
{
    const chain = chainFor(65);
    const overlay = pushableOverlay(chain, chain.pushes.length);
    pushChainSteps(phase1, chain);
    steps.push({ kind: 'exit-after-push', level: 65, to: 68, exit: { x: 184, y: 64 },
        overlay });
}

// ── L68: the boss lock, then health ───────────────────────────────────
steps.push({ kind: 'keylock', level: R4_KEY_LOCK.level, lock: { ...R4_KEY_LOCK.lock },
    at: { ...R4_KEY_LOCK.at }, from: { ...R4_KEY_LOCK.from } });
/**
 * ⚠ THE ONE REACHABILITY QUESTION `nearestStandableBeside` CANNOT ASK.
 *
 * That helper answers "is there a standable cell beside the pickup", which
 * inside a level the walk itself changed is the right question for the
 * APPROACH POINT and the wrong one for the CLAIM: a cell can be standable
 * and in a component the stance cannot walk to. L68 is exactly that case,
 * and it is not hypothetical — `bosslock@16,32` and `magicallock@16,32`
 * share a cell, so with only the boss lock earned the tile is still solid
 * and health is still sealed. The one-out sweep over the clear bill reports
 * `L68 tag 1` NOT REQUIRED for precisely this reason, and it is wrong.
 *
 * So it is asked here, of phase 2, both ways.
 */
{
    const world = phase2.worldFor(R4_KEY_LOCK.level);
    const healthRect = (world.pickups ?? []).find((q) => q.x === HEALTH.pickup.x
        && q.y === HEALTH.pickup.y).rect;
    const beside = new Set(phase2.componentsAround(R4_KEY_LOCK.level, healthRect));
    const stance = phase2.componentAt(R4_KEY_LOCK.level, R4_KEY_LOCK.at.x, R4_KEY_LOCK.at.y);
    if (stance === null || !beside.has(stance)) {
        throw new Error(`with L${R4_KEY_LOCK.level} tag ${R4_KEY_LOCK.tag} EARNED, the `
            + `keylock stance (${R4_KEY_LOCK.at.x},${R4_KEY_LOCK.at.y}) is in component `
            + `${stance} and health's own tile touches [${[...beside].join(',')}]. The `
            + 'boss lock is not the only thing in that cell — `magicallock@16,32` shares '
            + 'it and needs a wand shot, so `L68 tag 1` has to stay a DECLARED clear. '
            + 'Dropping it makes the walk open one of two locks and stand in front of '
            + 'the other.');
    }
}
// ⚠ PHASE 2, and `overlay: {}` rather than null: health's approach is
// computed inside a level the walk itself changed — the boss lock is gone —
// and an empty overlay means "no blocks here", which L68 has none of. The
// point is to take the `nearestStandableBeside` arm, which asks the geometry
// directly, rather than the graph arm, which would hop.
collectStep(phase2, HEALTH, { overlay: new Map() });

// ── steps -> legs ─────────────────────────────────────────────────────
const legs = [];
const legBoots = [];
const collects = [];
const spears = [];
const keylocks = [];
const equips = [];
let standing = { ...R4_BOOT };
let open = null;
const openLeg = (level) => {
    legs.push({ level, targets: [] });
    legBoots.push({ ...standing });
    open = legs[legs.length - 1];
    return open;
};
const inLevelKinds = new Set(['collect', 'spear', 'keylock', 'equip']);
for (const step of steps) {
    if (inLevelKinds.has(step.kind)) {
        const leg = open ?? openLeg(step.level);
        if (leg.level !== step.level) {
            throw new Error(`a ${step.kind} in L${step.level} met an open leg in `
                + `L${leg.level}`);
        }
        const index = leg.targets.length;
        if (step.kind === 'collect') {
            leg.targets.push({
                x: step.at.x, y: step.at.y, collect: { pickup: { ...step.pickup } },
            });
            collects.push({
                leg: legs.length - 1, index, level: step.level, item: step.item,
                pickup: { ...step.pickup }, at: { ...step.at },
            });
        } else if (step.kind === 'equip') {
            // ⚠ No position of its own: an equip costs no ticks and happens
            // wherever the previous target left the player. The target still
            // carries an `{x, y}` because `synthesizeLegs` drives to one, so
            // it repeats the position the leg is already at.
            const prev = leg.targets[leg.targets.length - 1];
            leg.targets.push({ x: prev.x, y: prev.y, equip: { slot: step.slot } });
            equips.push({ leg: legs.length - 1, index, slot: step.slot });
        } else if (step.kind === 'spear') {
            if (step.setup) {
                leg.targets.push({ x: step.at.x, y: step.at.y });
            } else {
                leg.targets.push({
                    x: step.at.x,
                    y: step.at.y,
                    spear: {
                        facing: step.facing,
                        block: { ...step.block },
                        ...(step.to ? { to: { ...step.to } } : { to: null }),
                    },
                });
                spears.push({
                    leg: legs.length - 1, index, level: step.level,
                    at: { ...step.at }, facing: step.facing, block: { ...step.block },
                    to: step.to ? { ...step.to } : null,
                });
            }
        } else {
            leg.targets.push({ x: step.from.x, y: step.from.y });
            leg.targets.push({
                x: step.at.x, y: step.at.y, keylock: { lock: { ...step.lock } },
            });
            keylocks.push({
                leg: legs.length - 1, index: index + 1, level: step.level,
                lock: { ...step.lock }, at: { ...step.at },
            });
        }
        continue;
    }
    if (step.kind === 'exit-after-push') {
        const leg = open ?? openLeg(step.level);
        if (leg.level !== step.level) {
            throw new Error(`an exit-after-push in L${step.level} met an open leg in `
                + `L${leg.level}`);
        }
        leg.exit = { ...step.exit };
        open = null;
        const world = phase1.worldFor(step.level);
        const tp = world.teleporters.find((t) => t.x === step.exit.x && t.y === step.exit.y);
        if (!tp || tp.to !== step.to) {
            throw new Error(`L${step.level} has no teleporter to L${step.to} at `
                + `(${step.exit.x},${step.exit.y})`);
        }
        standing = { level: tp.to, x: tp.playerx, y: tp.playery };
        continue;
    }
    const { from, edge } = step;
    const fromLevel = Number(String(from).split(':')[0]);
    const leg = open ?? openLeg(fromLevel);
    if (leg.level !== fromLevel) {
        throw new Error(`a ${edge.kind} edge out of L${fromLevel} met an open leg in `
            + `L${leg.level}`);
    }
    if (edge.kind === 'hold') {
        // ⚠ NOT A CAPABILITY GAP — `runHold` has worked since R2 and R3's
        // route used it. It is that R4's itinerary declares its openers, and
        // a hold the tour discovered on its own would be 101 ticks of
        // standing on a volume the acceptance does not know about. If a
        // future edit makes one necessary, DECLARE it and delete this.
        throw new Error(`the R4 tour took a HOLD edge in L${edge.toLevel}, which the `
            + 'itinerary does not declare. R4 opens one thing by hand — L68\'s boss '
            + 'lock, with a key — and a hold nobody planned would be an opener the '
            + 'ledger cannot account for.');
    }
    leg.exit = edge.exit;
    open = null;
    for (const p of edge.through) {
        legs.push({ level: p.level, targets: [], exit: { pit: p.pit } });
        legBoots.push({ ...p.boot });
    }
    standing = { ...edge.boot };
}
if (open === null) {
    legs.push({ level: standing.level, targets: [] });
    legBoots.push({ ...standing });
}

// ── the forced contacts ───────────────────────────────────────────────
// What each leg STARTS standing inside, computed with the driver's OWN
// `contactsAt` so the declaration and the check cannot drift apart.
//
// ⚠ PER PHASE, and per KEY SET. A leg after the boss lock is standing in a
// map the player changed; a leg after the bosskey is standing in a map with
// one more avoid volume in it, because a `BossLock`'s probe row is inert
// until the walk holds its key.
const keyLeg = collects.find((c) => c.item === 'bosskey').leg;
const lockLeg = keylocks[0].leg;
legs.forEach((leg, i) => {
    const g = i <= lockLeg ? phase1 : phase2;
    const world = g.worldFor(leg.level);
    const contacts = contactsAt(world,
        legBoots[i].x + TILE_SIZE / 2, legBoots[i].y + TILE_SIZE / 2,
        { avoidVolumes: true, keys: i > keyLeg ? new Set([R4_KEY_PICKUP.keyType]) : null });
    if (contacts.length > 0) leg.contacts = contacts;
});

// ── the report ────────────────────────────────────────────────────────
console.log(`\nvisit order: ${visitOrder.join(' -> ')}`);
console.log(`${legs.length} leg(s) across ${new Set(legs.map((l) => l.level)).size} `
    + `level(s); ${collects.length} collect(s), ${spears.length} spear(s), `
    + `${keylocks.length} keylock(s), ${equips.length} equip(s)`);
if (VERBOSE) {
    legs.forEach((l, i) => console.log(`  ${String(i).padStart(2)} L${l.level} `
        + `${JSON.stringify(l.targets)} ${JSON.stringify(l.exit ?? null)}`));
}

for (const room of [...R4_ITEM_ROOMS, R4_KEY_PICKUP]) {
    const got = collects.find((c) => c.item === room.item);
    if (!got) throw new Error(`no collect was planned for ${room.item}`);
    if (legs[got.leg].level !== room.level) {
        throw new Error(`${room.item}'s collect is on a leg in L${legs[got.leg].level}`);
    }
}

const route = {
    generated_by: 'scripts/procgen/plan-seedling-r4-route.mjs',
    description: 'The R4 full walk: R3\'s map with the HAZARDS ARMED. `noHazards` is '
        + '["water"] alone, so lava is a wall — which costs `darksuit` and R3\'s whole '
        + 'tail — and `health` joins the claim in its place, behind five spear presses '
        + 'across three levels, a boss key, and a lock that opens on it. `hitsMax == 4` '
        + 'is asserted as a POSITIVE for the first time on the ladder. `grants` is '
        + 'EMPTY; two flags are EARNED (L68 tag 0 by the boss lock, L65 tag 2 by a '
        + 'lightpole the third push cannot geometrically avoid) and eleven declared.',
    boot: { ...R4_BOOT },
    noHazards: [...R4_NO_HAZARDS],
    item_order: visitOrder,
    start_node: START,
    grants: [],
    persistence: DECLARED,
    earned: R4_EARNED.map((e) => ({ level: e.level, tag: e.tag, by: e.by })),
    equips,
    spears,
    keylocks,
    collects,
    segment_boundaries: R4_SEGMENT_BOUNDARIES.map(([level, occurrence], i) => {
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

if (DROP < 0) assertRouteWellFormed(route);

if (WRITE) {
    writeFileSync(OUT, `${JSON.stringify(route, null, 2)}\n`);
    console.log(`\nwrote ${OUT}`);
} else {
    console.log('\n(dry run — pass --write to commit the route)');
}
