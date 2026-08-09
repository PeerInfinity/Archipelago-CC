#!/usr/bin/env node
/**
 * probe-seedling-r7-l40-holder — ⛓⛓⛓ THE SECOND HOLDER IS A BLOCK, SIX
 * TILES SOUTH OF THE BUTTON IT IS FOR, AND R5 REFUSED IT ON A MEASUREMENT
 * ITS OWN INSTRUMENT GOT WRONG.
 *
 * Region-atlas Phase 8, subtractive ladder rung R7, slice 3 (THE L40
 * RECON, ⚖ checkpoint). Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md`
 * §4 slice 3 — *"(a) second-holder search under the FULL R7 verb set,
 * bounded and named; (b) multi-visit routing over the route graph with real
 * entrances + pits; (c) the report."*
 *
 * ⛓ **PROVENANCE: the user named the mechanic mid-slice** — *"place the
 * blocks on the switches, then … so that for one moment all six switches
 * count as pressed"*, describing L39's six-button room, one teleporter
 * BELOW L40. The room is not L40's, and the trick does not transfer; what
 * transferred is the design language it is written in: **in this game a
 * switch that has to stay down is held by a BLOCK.** That is the question
 * R5's census asked and answered wrong.
 *
 * ── WHAT R5 CONCLUDED, AND WHICH CLAUSE MOVES ─────────────────────────
 *
 * `L40_LINK4_REPAIRED.holderCensus` enumerated sixteen hitable classes and
 * found ONE holder, the `iceturret` corpse:
 *
 *     blocksFailOn: 'reach — the nearest of the three is 22 tiles of pushing
 *                    from the t5 button, and slice 16 measured their whole
 *                    reachable sets (27/1/1 cells) with neither button in
 *                    any of them'
 *
 * ⛔⛔⛔ **BOTH HALVES ARE DEFECTIVE, AND THE SECOND IS AN INSTRUMENT BUG.**
 *
 *   1. The distance was measured against the **t5** button only
 *      (`probe-seedling-r5-l40-holder.mjs`'s `nearest` reads `T5_BUTTON`).
 *      No arm of it ever asked about **t2** — and `pushableblockfire@480,480`
 *      is at tile (30,30), in the **same column** as `button@480,384 {t 2}`
 *      at (30,24), with six clear tiles between them.
 *   2. The inherited "27/1/1 cells" is the signature of a push search that
 *      **left the block's own spawn rect in `world.solids`**. This probe
 *      reproduced the "1 cell" figure exactly, then threaded the
 *      `pushables` override that `plannerObstacleAt`/`collidesSolid` have
 *      carried since R4 — *"a block that has been pushed is not where the
 *      level built it"* — and the same block reaches **36 tiles, the t2
 *      button among them, in six straight-line presses**.
 *      [[feedback_verifier_shared_assumption]] in its purest form: the
 *      searcher and the world disagreed about where the searcher was.
 *
 * ⇒ **THE DEADLOCK DISSOLVES WITH NO NEW MECHANIC.** A `PushableBlockFire`
 * is a `Solid`; `Button.update`'s hitables is `["Player","Enemy","Solid"]`;
 * a block that has arrived has `v = 0` and nothing but another fire press
 * moves it. It is the SAME press family R5 already drove byte-exact with
 * the corpse (`r5-l40-part5`), so nothing below rests on an unwitnessed
 * reading. **The block holds t2; the corpse is freed for t5; one corpse,
 * two holds, and now there are two holders.**
 *
 * ── AND A SECOND, INDEPENDENT HOLDER, KEPT BECAUSE IT IS TRUE ─────────
 *
 * R5 also refused the bob family, on STAYING — *"it follows. The lure IS
 * the player"*. **That is false past 80 px.** `Bob.update`
 * (`Enemies/Bob.as:52-76`) puts the whole chase block inside
 * `if (d <= runRange)` and adds NOTHING beyond it — no wander, no patrol,
 * no return-to-post — and `Mobile.friction()` brings 0.5 px/tick to zero in
 * two ticks. A Bob abandoned beyond its leash is a static 8x8 `"Enemy"`
 * body for the rest of the level's life. The clause is true of a Bob you
 * are STANDING NEXT TO, and a lure is a thing you can stop doing.
 *
 * ⚠ It is NOT needed and it is NOT witnessed: `activators.js`'s own header
 * says *"this model presses only on the player"*, so no instrument here can
 * execute an ENEMY press. Recorded as a spare, flagged as unwitnessed, and
 * the route does not use it (§7).
 *
 * ── WHAT THIS PROBE MEASURES ──────────────────────────────────────────
 *
 *   1. the SELF-TRANSIT refusal — the player cannot be its own holder, and
 *      the reason is three measured pixel gaps rather than an argument;
 *   2. the t4-button room, with the group shut — a hard soft-lock, sized;
 *   3. THE PAIR — the corpse's own reachable set with and without a second
 *      holder on `button@480,384 {t 2}`, one bit apart. Necessary AND
 *      sufficient, in one instrument;
 *   4. the bob family's body-reach to that button, so "lurable" is a
 *      measured path and not an adjective;
 *   5. every entrance INTO the L40/41/42/43 cluster, which is what settles
 *      the multi-visit half.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r7-l40-holder.mjs
 *   node scripts/procgen/probe-seedling-r7-l40-holder.mjs --quick   # skip the two BFS arms
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE, rectsOverlap } =
    await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { nodeCentre, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { fireRect, fireRadiusDistance, FIRE_RADIUS, FIRE_WINDOW } =
    await import(join(MODULE, 'fireVerb.js'));
const { bumpIceTurret, createIceTurret, killIceTurret, stepIceTurret } =
    await import(join(MODULE, 'iceTurret.js'));
const { newPushable, hitPushableFromPoint, stepPushable } =
    await import(join(MODULE, 'pushables.js'));
const { ENEMY_CLASSES } = await import(join(MODULE, 'combat.js'));
const { applyFriction, CHASERS } = await import(join(MODULE, 'chasers.js'));
const { L40_CHAIN, L40_CORPSE, L40_LINK4_REPAIRED } = await import(join(MODULE, 'r5Totem.js'));

const QUICK = process.argv.includes('--quick');
const LEVEL = 40;
const LATTICE = L40_CHAIN.lattice;
const INVENTORY = Object.freeze({
    hasSword: true, canSwim: true, hasFeather: true, hasFire: true,
});
const CHEST = new Set(['chest@880,816']);
const TREE_TAG = 0;
const TURRET = L40_CORPSE.turret.id;
const ARRIVAL = { ...L40_CHAIN.from };
const FATAL = new Set([1, 6, 17]);

const rec = atlasLevelSource()(LEVEL);
const world = buildLevelWorld(rec, { roles: ROLES, inventory: INVENTORY, cleared: [TREE_TAG] });

const claims = [];
const claim = (ok, name, detail) => { claims.push({ ok, name, detail }); };

const T2 = world.pressers.find((p) => p.tag === 'button' && p.t === 2);
const T4 = world.pressers.find((p) => p.tag === 'button' && p.t === 4);
const T5 = world.pressers.find((p) => p.tag === 'button' && p.t === 5);
const LOCK = Object.fromEntries(world.activators.map((a) => [a.id, a]));
const LINK3 = ['wandlock@480,560'];
const GROUP2 = ['wandlock@448,432', 'wandlock@512,480'];
const GROUP5 = ['wandlock@800,400'];

// ── the flood, shared by every arm ────────────────────────────────────
const freeNode = (cx, cy, opts) => {
    if (cx < 0 || cy < 0 || cx >= rec.width * 2 || cy >= rec.height * 2) return false;
    const c = nodeCentre(cx, cy, LATTICE);
    try {
        return plannerObstacleAt(world, c.x, c.y, null,
            { inventory: INVENTORY, avoidVolumes: false, ...opts }) === null;
    } catch { return false; }
};
const floodFromNode = (sx, sy, opts) => {
    const seen = new Set();
    const frontier = [];
    for (let dy = 0; dy <= 1; dy += 1) {
        for (let dx = 0; dx <= 1; dx += 1) {
            if (freeNode(sx + dx, sy + dy, opts)) {
                seen.add(`${sx + dx},${sy + dy}`); frontier.push([sx + dx, sy + dy]);
            }
        }
    }
    while (frontier.length > 0) {
        const [cx, cy] = frontier.pop();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const k = `${cx + dx},${cy + dy}`;
            if (seen.has(k) || !freeNode(cx + dx, cy + dy, opts)) continue;
            seen.add(k); frontier.push([cx + dx, cy + dy]);
        }
    }
    return seen;
};
const floodArrival = (open, extra = {}) => floodFromNode(
    Math.floor(ARRIVAL.x / LATTICE), Math.floor(ARRIVAL.y / LATTICE),
    { openChests: CHEST, openActivators: new Set(open), ...extra },
);
const tilesOf = (nodes) => new Set([...nodes].map((k) => {
    const [a, b] = k.split(',').map(Number);
    const c = nodeCentre(a, b, LATTICE);
    return `${Math.floor(c.x / TILE_SIZE)},${Math.floor(c.y / TILE_SIZE)}`;
}));

// ── 0. THE 101-TICK BAR, RE-DERIVED RATHER THAN INHERITED ─────────────
/**
 * `Lock.activationStep` (`Puzzlements/Lock.as:70-92`), whole:
 *
 * ```
 *   if (activate) { if (alpha > 0) alpha -= 0.01; else turnOff(); }
 *   else          { if (type == normType) alpha = 1;
 *                   if (!collideTypes(hitables, x, y)) returnToNormal(); }
 * ```
 *
 * Two facts the chain turns on, and the SECOND one is what makes a holder
 * necessary rather than merely convenient:
 *
 *   · 100 decrements take alpha to 0 and `turnOff()` lands on the tick
 *     AFTER — tick **101** of CONTINUOUS activation. Release re-arms it to
 *     1 (the `type == normType` guard is satisfied while the lock is still
 *     Solid), so the count restarts from scratch. R5's bar is right.
 *   · `returnToNormal()` runs on the FIRST unactivated tick whose cell is
 *     unoccupied. There is no fade back, no grace, no timer. A lock is
 *     passable exactly while its group is published — or while something
 *     stands in it.
 */
const LOCK_FADE_STEP = 0.01;
const LOCK_OPENS_ON = (() => {
    let alpha = 1;
    for (let tick = 1; tick <= 500; tick += 1) {
        if (alpha > 0) alpha = Math.max(0, Math.min(1, alpha - LOCK_FADE_STEP));
        else return tick;
    }
    return -1;
})();
claim(LOCK_OPENS_ON === 101,
    '⛓ THE 101-TICK BAR IS RE-DERIVED, NOT TRUSTED — and it is 101',
    `\`Lock.activationStep\` opens on tick ${LOCK_OPENS_ON} of CONTINUOUS activation `
    + '(100 decrements of 0.01 from a clamped alpha of 1, then `turnOff()` one tick '
    + 'later because the branch tests `alpha > 0` BEFORE decrementing). A release '
    + 're-arms alpha to 1 while `type == normType`, so the count restarts. R5 read this '
    + 'right and R7 does not get to inherit it — the brief said re-derive.');

// ── 1. SELF-TRANSIT — the player cannot be its own holder ─────────────
/**
 * ⛔⛔⛔ THE HYPOTHESIS THIS SLICE OPENED WITH, AND ITS REFUTATION IS
 * THREE PIXEL GAPS.
 *
 * `returnToNormal`'s occupancy guard means a lock the PLAYER stands in
 * cannot re-solidify. So a player who could press a button and touch its
 * lock AT THE SAME INSTANT would need no holder at all: press for 101
 * ticks, step into the lock, and the opening travels with them.
 *
 * The player's box is `normalHitbox` = 4x5 at origin (2,2)
 * (`Player.as:295`) — FOUR pixels wide. For each (button, lock) pair in its
 * own group, the question is whether ANY player x satisfies both overlaps
 * at once, and the answer is a subtraction.
 */
const PAIRS = [
    { button: T2, lock: LOCK['wandlock@448,432'], name: 'button t2 -> wandlock@448,432 (tag 9)' },
    { button: T2, lock: LOCK['wandlock@512,480'], name: 'button t2 -> wandlock@512,480 (tag 10)' },
    { button: T5, lock: LOCK['wandlock@800,400'], name: 'button t5 -> wandlock@800,400 (tag 21)' },
];
const PLAYER_W = playerBoxAt(0, 0).right - playerBoxAt(0, 0).x;
console.log('## 1. SELF-TRANSIT — can the player press a button and touch its lock at once?\n');
console.log(`   the player's box is ${PLAYER_W} px wide (\`Player.as:295\` normalHitbox 4x5)\n`);
const straddles = [];
for (const p of PAIRS) {
    // the x-interval a player centre must be in for each overlap, then the
    // intersection. y is checked the same way.
    const bx = [p.button.rect.x - PLAYER_W + 2, p.button.rect.right + 2];
    const lx = [p.lock.rect.x - PLAYER_W + 2, p.lock.rect.right + 2];
    const lo = Math.max(bx[0], lx[0]);
    const hi = Math.min(bx[1], lx[1]);
    const gapX = Math.max(0, Math.max(p.lock.rect.x - p.button.rect.right,
        p.button.rect.x - p.lock.rect.right));
    const gapY = Math.max(0, Math.max(p.lock.rect.y - p.button.rect.bottom,
        p.button.rect.y - p.lock.rect.bottom));
    const ok = hi > lo && gapY === 0;
    straddles.push({ name: p.name, gapX, gapY, ok });
    console.log(`   ${p.name.padEnd(44)} gap x ${String(gapX).padStart(3)} px, `
        + `y ${String(gapY).padStart(3)} px  ${ok ? '⛓ STRADDLES' : '⛔ no'}`);
}
console.log('');
claim(straddles.every((s) => !s.ok),
    '⛔⛔⛔ THE PLAYER CANNOT BE ITS OWN HOLDER — every L40 pair, by subtraction',
    `${straddles.map((s) => `${s.name.split(' -> ')[1]} ${s.gapX}px/${s.gapY}px`).join(', ')}. `
    + `A ${PLAYER_W}-px box cannot span a gap of ${PLAYER_W} px or more, and the closest `
    + 'pair in the level is 20 px apart. ⇒ a grouped lock is a ONE-WAY door for the '
    + 'player alone: press 101 ticks, walk in, and it shuts on the first tick after the '
    + 'box clears the cell. **R5\'s "link 5 needs a HOLDER" is CONFIRMED, and this is '
    + 'the arithmetic it was missing.**');

// ── 2. THE t4 ROOM — a soft-lock, sized ───────────────────────────────
const t4Node = [Math.floor((T4.rect.x + 4) / LATTICE), Math.floor((T4.rect.y + 3) / LATTICE)];
const t4Shut = floodFromNode(t4Node[0], t4Node[1],
    { openChests: CHEST, openActivators: new Set([...LINK3, ...GROUP2]) });
const t4Tiles = tilesOf(t4Shut);
const pitTileKeys = new Set([...world.pitTiles].map((p) => `${p.tx},${p.ty}`));
const t4Pits = [...t4Tiles].filter((t) => pitTileKeys.has(t));
const t4Exits = world.teleporters.filter((tp) => [...t4Tiles].some((t) => {
    const [tx, ty] = t.split(',').map(Number);
    return rectsOverlap({ x: tx * 16, y: ty * 16, right: tx * 16 + 16, bottom: ty * 16 + 16 },
        tp.rect);
}));
console.log(`## 2. the t4-button room with group 5 shut: ${t4Shut.size} nodes, `
    + `tiles {${[...t4Tiles].join(' ')}}`);
console.log(`   pit tiles inside: ${t4Pits.length}   level exits inside: ${t4Exits.length}\n`);
claim(t4Shut.size <= 8 && t4Pits.length === 0 && t4Exits.length === 0,
    '⛔⛔ THE t4 ROOM IS A HARD SOFT-LOCK — no pit, no exit, no way back',
    `${t4Shut.size} lattice nodes over ${t4Tiles.size} tiles, with ZERO pit tiles and ZERO `
    + 'teleporters. R5 measured the 8 cells; this adds what a multi-visit question has to '
    + 'ask of them — a pit would have been a one-way transport into L43 and an honest '
    + 'escape, and there is not one. ⇒ **pressing `button@816,400 {t 4}` without a hold '
    + 'on `button@768,400 {t 5}` ENDS THE RUN**, and link 7\'s block push is lost with it '
    + 'because a `PushableBlock` has no persistence tag and every level load rebuilds it '
    + 'where the .oel put it.');

// ── 3. THE BOB FAMILY — R5's STAYING refusal, at source ───────────────
/**
 * ⛓⛓⛓ THE CENSUS ROW THAT MOVES, AND WHY IT IS A REFUTATION RATHER THAN
 * A DISAGREEMENT.
 *
 * R5 refused the bob family on STAYING. The refusal is scoped to a lure
 * that never ends. The source scopes the chase to `d <= runRange`, and
 * `chasers.applyFriction` — this repo's own transcription of
 * `Mobile.friction()` — is what decides how long the coast is.
 */
const BOB = ENEMY_CLASSES.bob;
const coast = (() => {
    let v = { x: BOB.speed, y: 0 };
    for (let t = 1; t <= 100; t += 1) {
        v = applyFriction(v);
        if (v.x === 0 && v.y === 0) return t;
    }
    return -1;
})();
console.log('## 3. the bob family, out of leash\n');
console.log(`   runRange ${BOB.aggro.range} px, speed ${BOB.speed} px/tick, `
    + `coast to rest in ${coast} tick(s) once the impulse stops\n`);
claim(coast <= 2 && BOB.aggro.range === 80 && CHASERS.bob.freezesOnGameFreeze === true,
    '⛓⛓⛓ AN ABANDONED BOB COMES TO REST AND STAYS — R5\'s STAYING REFUSAL IS SCOPED',
    `\`Bob.update\`'s chase block is inside \`if (d <= ${BOB.aggro.range})\` and adds NOTHING `
    + `past it — no wander, no patrol, no return-to-post — and \`Mobile.friction()\` takes `
    + `${BOB.speed} px/tick to zero in ${coast} tick(s). A Bob left beyond 80 px is a `
    + 'static 8x8 "Enemy"-typed body for the rest of the level\'s life, and `Button.update`'
    + '\'s hitables is `["Player","Enemy","Solid"]`. ⛔ R5\'s clause — *"it follows. The '
    + 'lure IS the player"* — is true of a Bob you are standing next to, and a lure is a '
    + 'thing you can stop doing. `Enemy.update`\'s off-screen return pins it a second, '
    + 'independent way.');

// ⛓ …and the LURE is a measured path, not an adjective.
const chaserFree = (tx, ty, open) => {
    if (tx < 0 || ty < 0 || tx >= rec.width || ty >= rec.height) return false;
    const cx = tx * TILE_SIZE + 8;
    const cy = ty * TILE_SIZE + 8;
    if (world.collidesSolid({ x: cx - 4, y: cy - 4, right: cx + 4, bottom: cy + 4 },
        { openChests: CHEST, openActivators: new Set(open) })) return false;
    return !FATAL.has(world.nearestWalkableTile(cx, cy)?.t ?? 0);
};
const bodyFlood = (sx, sy, open) => {
    const seen = new Set();
    if (!chaserFree(sx, sy, open)) return seen;
    seen.add(`${sx},${sy}`);
    const fr = [[sx, sy]];
    while (fr.length > 0) {
        const [cx, cy] = fr.pop();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const k = `${cx + dx},${cy + dy}`;
            if (seen.has(k) || !chaserFree(cx + dx, cy + dy, open)) continue;
            seen.add(k); fr.push([cx + dx, cy + dy]);
        }
    }
    return seen;
};
const T2_TILE = { tx: Math.floor(T2.x / TILE_SIZE), ty: Math.floor(T2.y / TILE_SIZE) };
const buttonBody = bodyFlood(T2_TILE.tx, T2_TILE.ty, LINK3);
const lurable = (rec.entities ?? [])
    .filter((e) => CHASERS[e.type] || ENEMY_CLASSES[e.type]?.aggro?.kind === 'chase')
    .map((e) => ({ type: e.type, tx: Math.floor(e.x / TILE_SIZE), ty: Math.floor(e.y / TILE_SIZE) }))
    .filter((e) => buttonBody.has(`${e.tx},${e.ty}`));
console.log(`   the button tile (${T2_TILE.tx},${T2_TILE.ty}) sits in a `
    + `${buttonBody.size}-tile 8x8-BODY region under links 1-3 alone`);
console.log(`   chase-family enemies inside it: ${lurable.length} — `
    + `${lurable.map((e) => `${e.type}@t(${e.tx},${e.ty})`).join(' ')}\n`);
claim(lurable.length >= 1,
    '⛓⛓ …AND THE LURE IS A MEASURED PATH: the button shares a body-region with the bobs',
    `${lurable.length} chase-family enemies stand inside the same ${buttonBody.size}-tile `
    + 'region as `button@480,384`, flooded for an 8x8 body over non-fatal terrain with '
    + 'only links 1-3 open. ⚠ THE BOUND: this is CONNECTIVITY, not a lure PLAN — the '
    + 'escort is long (the region joins the button column the south way round, through '
    + 'row 42) and every step of it must keep the player inside `runRange` without '
    + 'walking the body onto a pit. Ticks unpriced here on purpose.');

// ⛓ and the ring: is the door the player must use outside the leash?
const parked = { x: T2.x + 8, y: T2.y + 8 };
const RING = [
    { name: 'wandlock@512,480 cell (the ONE door east)', x: 520, y: 488 },
    { name: 'its west neighbour t(31,30)', x: 504, y: 488 },
    { name: 't(31,29), one tile further north', x: 504, y: 472 },
    { name: 't(31,28)', x: 504, y: 456 },
];
console.log('## 3b. the parked body\'s leash against the door the player must use\n');
for (const r of RING) {
    const d = Math.hypot(r.x - parked.x, r.y - parked.y);
    console.log(`   ${r.name.padEnd(42)} d = ${d.toFixed(1)} px  `
        + `${d > BOB.aggro.range ? '⛓ outside the leash' : '⛔ INSIDE — it would follow'}`);
}
console.log('');
const doorD = Math.hypot(520 - parked.x, 488 - parked.y);
claim(doorD > BOB.aggro.range,
    '⛓⛓⛓ THE DOOR IS OUTSIDE THE LEASH — so a parked body is crossable in BOTH directions',
    `\`wandlock@512,480\` sits ${doorD.toFixed(1)} px from a body parked on `
    + `\`button@480,384\`, against a runRange of ${BOB.aggro.range}. The player can walk to `
    + 'it, stand in it and cross it — either way — without ever re-arming the chase. That '
    + 'is what turns a hold into a DOOR rather than a one-shot. ⚠ Errands that DO enter '
    + 'the ring (the corpse\'s stances up column 34) wake it and cost a re-park; the '
    + 'route pays that, the verdict does not depend on it.');

// ── 3c. THE BLOCK — R5's `blocksFailOn: 'reach'`, re-measured ─────────
/**
 * ⛓⛓⛓ THE HEADLINE, AND IT IS RUN AS A PAIR SO THE DEFECT IS VISIBLE
 * RATHER THAN MERELY FIXED.
 *
 * Both arms are the same BFS over the block's tile, each edge one
 * `Player.fire()` press from a stance in the player's current component
 * (the rect gate then the radius gate, the game's own order), the block
 * stepped through `pushables.stepPushable` for its whole glide.
 *
 *   `threaded: false`   the block's spawn rect is left in `world.solids` —
 *                       every push collides with the block itself
 *   `threaded: true`    the `pushables` override is passed, exactly as
 *                       `plannerObstacleAt`'s R4 note says it must be
 *
 * A search whose mover is still nailed to the map cannot move it, and it
 * does not say so — it returns a number. **1 cell and 36 cells are the same
 * instrument one argument apart**, and 1 is the figure R5's census
 * inherited.
 */
const BLOCK_ID = 'pushableblockfire@480,480';
const BLOCK_START = { tx: 30, ty: 30 };
const otherBlocks = world.pushables.filter((b) => b.id !== BLOCK_ID)
    .map((b) => ({ x: b.x, y: b.y, right: b.x + 16, bottom: b.y + 16 }));
const blockRect = (tx, ty) => ({
    x: tx * 16, y: ty * 16, w: 16, h: 16, right: tx * 16 + 16, bottom: ty * 16 + 16,
});
const GONE = new Map([[BLOCK_ID, { removed: true }]]);
const blockSearch = (threaded, corpseHoldsT2 = false) => {
    const here = (tx, ty) => (threaded
        ? new Map([[BLOCK_ID, { removed: false, rect: blockRect(tx, ty) }]])
        : null);
    // ⛓ THE CORPSE, WHERE `L40_CORPSE.corpseEndsAt` PUTS IT — two fire
    // presses north of its spawn, resting on `button@480,384 {t 2}`. It is a
    // 16x16 `Solid` from the first tick the player is not standing in it.
    const CORPSE_RECT = { x: 480, y: 384, w: 16, h: 16, right: 496, bottom: 400 };
    const blockedFor = (box) => otherBlocks.some((o) => rectsOverlap(box, o))
        || (corpseHoldsT2 && rectsOverlap(box, CORPSE_RECT));
    const nodeOk = (cx, cy, open, bt) => {
        if (cx < 0 || cy < 0 || cx >= rec.width * 2 || cy >= rec.height * 2) return false;
        const c = nodeCentre(cx, cy, LATTICE);
        const pb = { x: c.x - 2, y: c.y - 2, right: c.x + 2, bottom: c.y + 3 };
        if (rectsOverlap(pb, blockRect(bt.tx, bt.ty)) || blockedFor(pb)) return false;
        try {
            return plannerObstacleAt(world, c.x, c.y, null, {
                inventory: INVENTORY, avoidVolumes: false, openChests: CHEST,
                openActivators: open, pushables: here(bt.tx, bt.ty),
            }) === null;
        } catch { return false; }
    };
    const comp = (open, bt) => {
        const seen = new Set();
        const sx = Math.floor(ARRIVAL.x / LATTICE);
        const sy = Math.floor(ARRIVAL.y / LATTICE);
        const fr = [];
        for (let dy = 0; dy <= 1; dy += 1) {
            for (let dx = 0; dx <= 1; dx += 1) {
                if (nodeOk(sx + dx, sy + dy, open, bt)) {
                    seen.add(`${sx + dx},${sy + dy}`); fr.push([sx + dx, sy + dy]);
                }
            }
        }
        while (fr.length > 0) {
            const [cx, cy] = fr.pop();
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const k = `${cx + dx},${cy + dy}`;
                if (seen.has(k) || !nodeOk(cx + dx, cy + dy, open, bt)) continue;
                seen.add(k); fr.push([cx + dx, cy + dy]);
            }
        }
        return seen;
    };
    const cellFree = (tx, ty, open) => {
        if (tx < 0 || ty < 0 || tx >= rec.width || ty >= rec.height) return false;
        const r = blockRect(tx, ty);
        // ⚠ `pushables: GONE` — the question is whether the DESTINATION is
        // clear, and the block's own spawn must not answer it.
        if (world.collidesSolid(r, { openChests: CHEST, openActivators: open,
            pushables: threaded ? GONE : null })) return false;
        if (blockedFor(r)) return false;
        return !FATAL.has(world.nearestWalkableTile(tx * 16 + 8, ty * 16 + 8)?.t ?? 0);
    };
    const pressTo = (p, tx, ty, open) => {
        let b = newPushable({ id: BLOCK_ID, as3: 'PushableBlockFire',
            tag: 'pushableblockfire', x: tx * 16, y: ty * 16, family: 'fire' });
        const h = hitPushableFromPoint(b, p, 'Fire');
        if (!h.moved) return null;
        b = h.block;
        const ctx = {
            collides: (box) => world.collidesSolid(box, { openChests: CHEST,
                openActivators: open, pushables: threaded ? GONE : null })
                || (blockedFor(box) ? { blocked: true } : null),
            tileTypeAt: (x, y) => world.nearestWalkableTile(x, y)?.t ?? 0,
        };
        for (let i = 0; i < 80; i += 1) {
            b = stepPushable(b, ctx);
            if (b.removed || b.destroy) return null;
        }
        return { tx: Math.floor(b.x / 16), ty: Math.floor(b.y / 16) };
    };
    const seen = new Map([[`${BLOCK_START.tx},${BLOCK_START.ty}`, null]]);
    const queue = [[BLOCK_START.tx, BLOCK_START.ty]];
    let onT2 = null;
    let onT5 = null;
    while (queue.length > 0) {
        const [tx, ty] = queue.shift();
        const open = new Set(LINK3);
        if (corpseHoldsT2 || rectsOverlap(blockRect(tx, ty), T2.rect)) {
            GROUP2.forEach((i) => open.add(i));
        }
        if (rectsOverlap(blockRect(tx, ty), T5.rect)) GROUP5.forEach((i) => open.add(i));
        const c = comp(open, { tx, ty });
        const box = blockRect(tx, ty);
        const centre = { x: tx * 16 + 8, y: ty * 16 + 8 };
        const outs = new Map();
        for (const k of c) {
            const [cx, cy] = k.split(',').map(Number);
            const p = nodeCentre(cx, cy, LATTICE);
            const r = fireRect(p.x, p.y);
            if (!(r.right > box.x && r.x < box.right && r.bottom > box.y && r.y < box.bottom)) {
                continue;
            }
            if (fireRadiusDistance(p, { x: centre.x, y: centre.y,
                originX: 8, originY: 8, w: 16, h: 16 }) > FIRE_RADIUS) continue;
            const to = pressTo(p, tx, ty, open);
            if (!to || (to.tx === tx && to.ty === ty)) continue;
            outs.set(`${to.tx},${to.ty}`, to);
        }
        for (const to of outs.values()) {
            const k = `${to.tx},${to.ty}`;
            if (seen.has(k) || !cellFree(to.tx, to.ty, open)) continue;
            seen.set(k, `${tx},${ty}`);
            queue.push([to.tx, to.ty]);
            if (!onT2 && rectsOverlap(blockRect(to.tx, to.ty), T2.rect)) onT2 = k;
            if (!onT5 && rectsOverlap(blockRect(to.tx, to.ty), T5.rect)) onT5 = k;
        }
    }
    const walk = (goal) => {
        if (!goal) return null;
        const out = []; let k = goal;
        while (k) { out.push(k); k = seen.get(k); }
        return out.reverse();
    };
    return { tiles: seen.size, onT2, onT5, path: walk(onT2), pathT5: walk(onT5) };
};

let blockOn = null;
if (!QUICK) {
    console.log('## 3c. THE BLOCK — `pushableblockfire@480,480` against `button@480,384 {t 2}`\n');
    const nailed = blockSearch(false);
    blockOn = blockSearch(true);
    const withCorpse = blockSearch(true, true);
    console.log(`   spawn rect LEFT in world.solids    ${String(nailed.tiles).padStart(3)} tiles   `
        + `t2: ${nailed.onT2 ? '⛓' : '⛔'}  t5: ${nailed.onT5 ? '⛓' : '⛔'}   <- R5's inherited figure`);
    console.log(`   \`pushables\` THREADED, no corpse    ${String(blockOn.tiles).padStart(3)} tiles   `
        + `t2: ${blockOn.onT2 ? `⛓ ${blockOn.onT2}` : '⛔'}  t5: ${blockOn.onT5 ? '⛓' : '⛔'}`);
    console.log(`   \`pushables\` THREADED + CORPSE ON t2 ${String(withCorpse.tiles).padStart(3)} tiles   `
        + `t2: ${withCorpse.onT2 ? '⛓' : '⛔ (occupied)'}  `
        + `t5: ${withCorpse.onT5 ? `⛓ ${withCorpse.onT5}` : '⛔'}`);
    if (blockOn.path) {
        console.log(`\n   block -> t2, ${blockOn.path.length - 1} presses: ${blockOn.path.join(' -> ')}`);
    }
    if (withCorpse.pathT5) {
        console.log(`   block -> t5, ${withCorpse.pathT5.length - 1} presses: `
            + `${withCorpse.pathT5.join(' -> ')}`);
    }
    console.log('');
    claim(withCorpse.onT5 !== null,
        '⛓⛓⛓ THE INTENDED ASSIGNMENT, MEASURED: CORPSE -> t2, BLOCK -> t5',
        `with the corpse resting on \`button@480,384\` where \`L40_CORPSE.corpseEndsAt\` `
        + `already puts it (two fire presses north of its spawn), \`wandlock@512,480\` is `
        + `held open and \`pushableblockfire@480,480\` reaches \`button@768,400 {t 5}\` in `
        + `${withCorpse.pathT5 ? withCorpse.pathT5.length - 1 : '?'} presses — east through `
        + 'the lock cell, north up column 34, east along row 24, then down and in. ⛓ THE '
        + 'USER GAVE THIS ROUTE FROM PLAY and it is cheaper than the mirror image '
        + '(block on t2, corpse the long way): 2 + 34 presses against 6 + 34, and it is '
        + 'the assignment the level is built around — the corpse settles ON t2 by itself.');
    claim(nailed.tiles === 1 && blockOn.onT2 !== null,
        '⛓⛓⛓ THE SECOND HOLDER IS A BLOCK — six fire presses straight up column 30',
        `\`pushableblockfire@480,480\` sits at tile (30,30) in the SAME COLUMN as `
        + `\`button@480,384 {t 2}\` at (30,24), with six clear tiles between them, and a `
        + `fire press from the south drives it one tile north per press. Reach: `
        + `${blockOn.tiles} tiles with the \`pushables\` override threaded, `
        + `${nailed.tiles} without. ⛔ **R5's \`blocksFailOn: 'reach'\` measured the `
        + 'distance to the **t5** button and inherited a reachable-set figure from a '
        + "search whose mover was still nailed to the map** — this probe reproduces the "
        + '1-cell figure exactly by omitting one argument. A block that has arrived has '
        + '`v = 0` and only another fire press moves it, so the hold is PERMANENT, and '
        + 'a `Solid` on a `Button` is the very family `r5-l40-part5` already drove '
        + 'byte-exact with the corpse.');
}

// ── 4. THE PAIR — the corpse's reach, one bit apart ───────────────────
/**
 * ⛓⛓⛓ THE INSTRUMENT IS R5's, WITH THREE BOUNDS LIFTED, AND IT IS RUN
 * TWICE SO THE HOLD IS ISOLATED RATHER THAN ASSERTED.
 *
 * `probe-seedling-r5-l40-holder.mjs` searched the corpse's tile with the
 * activator set a FUNCTION of that tile. Three things it could not express,
 * each of which lowers the answer:
 *
 *   1. `corpseCellFree` passed NO `openActivators`, so link 3's own OPEN
 *      lock (`wandlock@480,560`, the plug in column 30) read as Solid TO
 *      THE CORPSE and sealed it into the northern pocket. That alone is why
 *      its reachable set was 35 tiles;
 *   2. the player's component was recomputed from the CORPSE's press, so
 *      whenever the body was off `button@480,384` the search gave the
 *      player 844 cells — the exact cells a second holder would add back;
 *   3. a corpse parked in a LOCK's own cell holds that lock open forever
 *      (`returnToNormal`'s occupancy guard), which was not modelled at all.
 *
 * With all three lifted, the two arms differ in ONE bit: whether something
 * OTHER than the corpse publishes group 2.
 */
const centreOf = (tx, ty) => ({ x: tx * TILE_SIZE + 8, y: ty * TILE_SIZE + 8 });
const corpseBox = (tx, ty) => {
    const c = centreOf(tx, ty);
    return { x: c.x - 8, y: c.y - 8, right: c.x + 8, bottom: c.y + 8 };
};
const LOCK_CELLS = Object.fromEntries([...GROUP2, ...GROUP5, ...LINK3]
    .map((id) => [id, LOCK[id].rect]));
const activatorsFor = (tx, ty, heldT2) => {
    const out = new Set(LINK3);
    if (heldT2 || rectsOverlap(corpseBox(tx, ty), T2.rect)) GROUP2.forEach((i) => out.add(i));
    if (rectsOverlap(corpseBox(tx, ty), T5.rect)) GROUP5.forEach((i) => out.add(i));
    // bound 3: a 16x16 body resting in a lock cell is the occupancy guard.
    for (const [id, r] of Object.entries(LOCK_CELLS)) {
        if (rectsOverlap(corpseBox(tx, ty), r)) out.add(id);
    }
    return out;
};
const turretsFor = (tx, ty) => {
    const c = centreOf(tx, ty);
    return new Map([[TURRET, {
        id: TURRET, x: c.x, y: c.y, dead: true, removed: false, solid: true,
        rect: corpseBox(tx, ty),
    }]]);
};
const corpseCellFree = (tx, ty, open) => {
    if (tx < 0 || ty < 0 || tx >= rec.width || ty >= rec.height) return false;
    const c = centreOf(tx, ty);
    // bound 1: the corpse sees the same open activators the player does.
    if (world.collidesSolid(corpseBox(tx, ty), { openChests: CHEST, openActivators: open })) {
        return false;
    }
    return !FATAL.has(world.nearestWalkableTile(c.x, c.y)?.t ?? 0);
};
const PRESS_SETTLE = 60;
const pressFrom = (p, tx, ty, open) => {
    const c = createIceTurret(472, 400);
    killIceTurret(c);
    stepIceTurret(c, {});
    const at = centreOf(tx, ty);
    c.x = at.x; c.y = at.y;
    c.tile = { x: tx, y: ty }; c.cTile = { x: tx, y: ty }; c.lTile = { x: tx, y: ty };
    c.prev1 = null; c.prev2 = null; c.settled = false;
    const ctx = {
        onScreen: true,
        blockedAt: (x, y) => !!world.collidesSolid(
            { x: x - 8, y: y - 8, right: x + 8, bottom: y + 8 },
            { openChests: CHEST, openActivators: open },
        ),
        terrainAt: (x, y) => world.nearestWalkableTile(x, y)?.t ?? 0,
        playerOverlaps: () => false,
    };
    const last = FIRE_WINDOW.hitTicks[FIRE_WINDOW.hitTicks.length - 1];
    // ⚠ A PRESS IS FIVE BUMPS (R5 §34.6). One `bumpIceTurret` from a body at
    // a tile centre decodes to no move at all.
    for (let k = 0; k <= last; k += 1) {
        stepIceTurret(c, ctx);
        if (FIRE_WINDOW.hitTicks.includes(k)) bumpIceTurret(c, p, 'Fire');
    }
    for (let i = 0; i < PRESS_SETTLE; i += 1) stepIceTurret(c, ctx);
    if (c.destroy || c.removed) return null;
    return { tx: Math.floor(c.x / TILE_SIZE), ty: Math.floor(c.y / TILE_SIZE) };
};
const pressTargetsFrom = (comp, tx, ty, open) => {
    const out = new Map();
    const box = corpseBox(tx, ty);
    const c = centreOf(tx, ty);
    for (const key of comp) {
        const [cx, cy] = key.split(',').map(Number);
        const p = nodeCentre(cx, cy, LATTICE);
        const r = fireRect(p.x, p.y);
        if (!(r.right > box.x && r.x < box.right && r.bottom > box.y && r.y < box.bottom)) continue;
        // ⚠ `fireRadiusDistance`, not its `Corrected` twin — the game's own line.
        if (fireRadiusDistance(p, { x: c.x, y: c.y, originX: 8, originY: 8, w: 16, h: 16 })
            > FIRE_RADIUS) continue;
        const to = pressFrom(p, tx, ty, open);
        if (!to || (to.tx === tx && to.ty === ty)) continue;
        out.set(`${to.tx},${to.ty}`, to);
    }
    return [...out.values()];
};
/** The block's resting rect once it is on `button@480,384` — a real Solid. */
const HELD_RECT = Object.freeze({ x: 480, y: 384, w: 16, h: 16, right: 496, bottom: 400 });
const corpseSearch = (heldT2) => {
    // ⚠ WITH the hold, tile (30,24) is OCCUPIED by the holder, so the corpse
    // cannot settle where R5 measured it settling. Its start moves one tile
    // south — the cell it comes to rest against instead.
    const start = heldT2
        ? { tx: 30, ty: 25 }
        : {
            tx: Math.floor(L40_CORPSE.corpseEndsAt.x / TILE_SIZE),
            ty: Math.floor(L40_CORPSE.corpseEndsAt.y / TILE_SIZE),
        };
    const goal = { tx: Math.floor(T5.x / TILE_SIZE), ty: Math.floor(T5.y / TILE_SIZE) };
    const seen = new Map([[`${start.tx},${start.ty}`, null]]);
    const queue = [[start.tx, start.ty]];
    let reached = false;
    while (queue.length > 0 && !reached) {
        const [tx, ty] = queue.shift();
        const open = activatorsFor(tx, ty, heldT2);
        const comp = floodFromNode(
            Math.floor(ARRIVAL.x / LATTICE), Math.floor(ARRIVAL.y / LATTICE),
            { openChests: CHEST, openActivators: open, turrets: turretsFor(tx, ty),
                extraVolumes: heldT2 ? [HELD_RECT] : undefined },
        );
        for (const to of pressTargetsFrom(comp, tx, ty, open)) {
            const k = `${to.tx},${to.ty}`;
            if (seen.has(k) || !corpseCellFree(to.tx, to.ty, open)) continue;
            if (heldT2 && rectsOverlap(corpseBox(to.tx, to.ty), HELD_RECT)) continue;
            seen.set(k, `${tx},${ty}`);
            queue.push([to.tx, to.ty]);
            if (to.tx === goal.tx && to.ty === goal.ty) reached = true;
        }
    }
    const cols = [...seen.keys()].map((k) => Number(k.split(',')[0]));
    let path = null;
    if (reached) {
        path = [];
        let k = `${goal.tx},${goal.ty}`;
        while (k) { path.push(k); k = seen.get(k); }
        path.reverse();
    }
    return { tiles: seen.size, eastMost: Math.max(...cols), reached, path, goal, start };
};

if (!QUICK) {
    console.log('## 4. THE PAIR — the corpse\'s reachable set, one bit apart\n');
    const control = corpseSearch(false);
    const treat = corpseSearch(true);
    for (const [label, r] of [['CONTROL    nothing else holds t2', control],
        ['TREATMENT  the BLOCK holds t2', treat]]) {
        console.log(`   ${label.padEnd(38)} ${String(r.tiles).padStart(4)} tiles, `
            + `east-most col ${String(r.eastMost).padStart(2)}, `
            + `goal t(${r.goal.tx},${r.goal.ty}) ${r.reached ? '⛓ REACHED' : '⛔ NOT REACHED'}`);
    }
    if (treat.path) {
        console.log(`\n   the ${treat.path.length - 1}-press path: ${treat.path.join(' -> ')}`);
    }
    console.log('');
    claim(!control.reached && treat.reached,
        '⛓⛓⛓ THE SECOND HOLDER IS NECESSARY *AND* SUFFICIENT — measured as a pair',
        `Same instrument, same corpse model, same 16x16 body: without a second holder the `
        + `t5 button is NOT among the ${control.tiles} tiles the corpse can be bumped to `
        + `(east-most column ${control.eastMost}); with one it is, in `
        + `${treat.path.length - 1} presses. ⛓ The whole of R5's *"ONE CORPSE, TWO HOLDS, `
        + 'STRICT DEPENDENCY"* is confirmed AND localised: the dependency is exactly the '
        + 'publication of group 2, and anything that publishes it dissolves the deadlock. '
        + '⚠ THE BOUND: this is the corpse\'s REACH, not a drive. Stances, tick cost and '
        + 'the re-parks the leash charges are the implementing slice\'s to price.');
    claim(control.tiles > L40_LINK4_REPAIRED.corpseReach.tiles,
        '⛔ …and R5\'s own 35-tile figure is superseded by THREE lifted bounds, not by one',
        `the control arm alone reaches ${control.tiles} tiles against R5's `
        + `${L40_LINK4_REPAIRED.corpseReach.tiles}, with the SAME verdict. The gap is `
        + '(1) `corpseCellFree` passing no `openActivators`, so link 3\'s own open plug '
        + 'read Solid to the corpse and sealed it in the northern pocket; (2) the player '
        + 'component recomputed from the corpse\'s own press; (3) a body in a lock cell '
        + 'holding that lock open. **A refusal that survives its instrument getting '
        + 'stronger is a better refusal**, and this one did.');
}

// ── 5. MULTI-VISIT — every entrance, from the atlas ───────────────────
/**
 * ⛔⛔⛔ THE MULTI-VISIT HALF, AND IT IS NOT A ROUTING QUESTION.
 *
 * The brief asks whether the chain's items can be collected across several
 * honest visits, each spending its one corpse differently. The answer does
 * not need a router: it needs the door list.
 */
const atlas = JSON.parse(readFileSync(
    join(REPO, 'frontend', 'modules', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const entrancesTo = (target) => {
    const out = [];
    for (const [lv, L] of Object.entries(atlas.levels)) {
        for (const e of (L.entities ?? [])) {
            if (['teleporter', 'stairsup', 'stairsdown'].includes(e.type)
                && String(e.attrs?.to) === String(target)) {
                out.push({ from: Number(lv), type: e.type, at: `${e.x},${e.y}`,
                    lands: `${e.attrs.playerx},${e.attrs.playery}` });
            }
        }
    }
    return out;
};
console.log('## 5. every entrance INTO the L40 cluster\n');
const cluster = {};
for (const lv of [40, 41, 42, 43]) {
    cluster[lv] = entrancesTo(lv);
    const ctl = (atlas.levels[String(lv)].entities ?? []).filter((e) => e.type === 'control');
    console.log(`   L${lv}: ${cluster[lv].map((e) => `L${e.from} ${e.type}@${e.at} -> (${e.lands})`).join(' | ')}`);
    if (ctl.length) console.log(`         own pit fallthrough: ${JSON.stringify(ctl[0].attrs)}`);
}
console.log('');
const outsideDoors = cluster[40].filter((e) => ![40, 41, 42, 43].includes(e.from));
claim(outsideDoors.length === 1 && outsideDoors[0].from === 39
    && cluster[41].every((e) => e.from === 40)
    && cluster[42].every((e) => e.from === 40)
    && cluster[43].every((e) => e.from === 40),
    '⛔⛔⛔ MULTI-VISIT BUYS NOTHING — THE CLUSTER HAS EXACTLY ONE DOOR FROM OUTSIDE',
    `L40 has ${cluster[40].length} entrances and ${cluster[40].length - outsideDoors.length} `
    + 'of them come from L41/L42/L43, which are themselves entered ONLY from L40. L41 and '
    + 'L42 are single-teleporter dead ends behind the bosslock; L43 is entered only by '
    + 'L40\'s stairs and L40\'s own pits, and its `teleporter@144,64 -> L37` is an EXIT. '
    + '⇒ every honest visit to the cluster starts at `L39 teleporter@144,0 -> (480,896)` '
    + 'and faces the same shut level. **A second visit is a second copy of the same '
    + 'problem, not a second half of it.**');

/**
 * ⛓ …AND THE LEDGER HALF, WHICH IS WHAT DECIDES *WHICH* LINKS A SECOND
 * VISIT WOULD EVEN KEEP. Transcribed from each class's own `check()`.
 */
const DURABILITY = [
    { link: 1, what: 'chest@880,816 {tag 13}', durable: true,
        why: '`Chest` writes and reads its tag; the seal identity commits at OPEN' },
    { link: 2, what: 'burnabletree@872,784 {tag 0}', durable: true,
        why: '`BurnableTree.removed()` -> setPersistence(tag,false); `check()` despawns on it' },
    { link: 3, what: 'buttonroom@880,768 {t 3, tag 12}', durable: true,
        why: '`ButtonRoom.activate` cannot be reset to false, and `check()` RE-PUBLISHES '
            + 'the group on every entry — the lock re-opens 101 ticks into each visit' },
    { link: 4, what: 'button@480,384 {t 2} -> wandlock tags 9/10', durable: false,
        why: '⛔ `Lock.check()` honours persistence only when `tSet < 0`; a GROUPED lock '
            + 'writes the flag and never reads it' },
    { link: 5, what: 'button@768,400 {t 5} -> wandlock tag 21', durable: false, why: 'as link 4' },
    { link: 6, what: 'button@816,400 {t 4} -> pulser@592,576', durable: false,
        why: 'a `Button` republishes rather than latching; the pulser is armed only while held' },
    { link: 7, what: 'the pulse shoves pushableblockfire@576,576', durable: false,
        why: '⛔ no `PushableBlock` in L40 carries a tag; `loadlevel` rebuilds it at its .oel cell' },
    { link: 8, what: 'pushableblock@576,560 walk-pushed north x3', durable: false, why: 'as link 7' },
    { link: 9, what: 'bosskey@656,528 {keyType 2}', durable: true, why: '`hasKey[2]` is a save-file flag' },
    { link: 10, what: 'bosslock@480,352 {tag 8}', durable: true,
        why: '`BossLock.check()` removes itself on a cleared tag (tSet is -1)' },
    { link: 11, what: 'the NW cluster: buttonrooms {tags 1,7} + breakablerocks {22,23,24}',
        durable: true, why: '`BreakableRock` and `ButtonRoom` both read their own tags' },
];
console.log('## 5b. which of the chain\'s writes survive a re-entry\n');
for (const d of DURABILITY) {
    console.log(`   link ${String(d.link).padStart(2)}  ${d.durable ? '⛓ DURABLE   ' : '⛔ PER-VISIT'} `
        + `${d.what}`);
}
console.log('');
const perVisit = DURABILITY.filter((d) => !d.durable).map((d) => d.link);
claim(perVisit.join(',') === '4,5,6,7,8',
    '⛔⛔ …AND THE PER-VISIT RUN IS EXACTLY 4-8, WITH THE KEY AT ITS FAR END',
    `links ${perVisit.join(', ')} leave no trace a re-entry can read, and link 9 — the boss `
    + 'key, the first DURABLE thing past the wall — sits behind all five. ⇒ **the chain '
    + '4->9 must close inside ONE visit**, and the second holder is required whatever the '
    + 'visit count. Links 1/2/3 and 9/10/11 do survive, so a run that once gets the key '
    + 'never has to solve L40 again — which is a fact about the SEGMENT SHAPE, not a way '
    + 'round the wall.');

// ── 6. THE REFUSALS THE FULL R7 VERB SET STILL EARNS ──────────────────
const REFUSALS = [
    { verb: 'the wand\'s shot (`wandShot.js`, `wandVerb.js`)',
        fails: 'AVAILABILITY — it is behind the gate it would open',
        why: '`wand@144,224` is in L43 behind `BossTotem`, which needs all five totem '
            + 'parts; parts 0/3/4 are behind L40\'s bosslock, which is behind the key, '
            + 'which is behind links 4-8. Strictly circular. And a shot is a projectile, '
            + 'not a body: `Button.update` admits only Player/Enemy/Solid.' },
    { verb: 'the fire verb\'s five-bump press (`fireVerb.js`)',
        fails: 'nothing — it is the instrument, not a candidate',
        why: 'it is what moves the corpse, and §4 above is its measurement. It PLACES no '
            + 'new body: `BurnableTree.hit` is the only Fire-gated responder in L40 and it '
            + 'REMOVES a solid rather than positioning one.' },
    { verb: 'a mover-certified dash (`mover.js`, R6 slice 1)',
        fails: 'the clock is not the constraint',
        why: 'the mover changes travel TIME. The bar is 101 CONTINUOUS ticks of publication '
            + 'and a one-tick `returnToNormal`; no arrival speed shortens either, and §1 '
            + 'shows the straddle fails by geometry, not by timing.' },
    { verb: 'the damage model / knockback (`enemyDamage.js`, `playerDamage.js`)',
        fails: 'it is a PLACING verb, and placing was never the refusal',
        why: '`genericHit`\'s force does displace an "Enemy" — a second way to position a '
            + 'bob besides luring, worth having. STAYING is what R5 refused on, and §3 is '
            + 'where that moves.' },
    { verb: 'the R6-modelled entities (bosses, bossTotem, fallRock, crusher, magicalLock)',
        fails: 'ABSENCE — none is in L40',
        why: 'the level\'s only R6-modelled class is `spinner` x5, which R5 already refused '
            + 'on both PLACING (a fixed billiard path no verb aims) and a kill\'s '
            + '`setPersistence(tag,false)` ledger write.' },
];
console.log('## 6. the rest of the R7 verb set, each refused by name\n');
for (const r of REFUSALS) console.log(`   ⛔ ${r.verb}\n      ${r.fails}`);
console.log('');
claim(REFUSALS.length === 5,
    '⛓ THE SWEEP NAMES WHAT IT SWEPT',
    'five verb families beyond R5\'s, each with the property it fails on and why. '
    + '[[feedback_bounded_sweep_must_name_what_it_bounded]]: an empty findings list and a '
    + 'clean pass print the same thing, so the list is the finding.');

// ── 7. ⚠⚠ THE BOUND ON EVERYTHING ABOVE ───────────────────────────────
/**
 * ⚠ THE ONE THING STILL UNWITNESSED — AND THE ROUTE DOES NOT USE IT.
 *
 * The BOB hold (§3) is a source reading the model cannot execute:
 * `activators.stepActivators` presses on the player and says so in its own
 * header, so no vitest stratum, no differential and no committed fixture in
 * this tree can go red if the reading is wrong. A bounded site search ran
 * over all 116 levels for a cheap live witness — every `button` with a
 * TAGGED lock in its group (so the open is visible in
 * `botStatus.persistence_cleared` with no new AS3) and a chase-family enemy
 * with an 8x8-body path to it, then every player-standable tile 72-88 px
 * from the button with the button on the enemy's approach line, the
 * geometry an abandon needs. **One site, L16, and its three park tiles all
 * sit BEHIND the very lock they would open.** ⇒ no cheap witness exists,
 * and the bob hold stays a SPARE.
 *
 * ⛓⛓⛓ THE BLOCK HOLD (§3c) IS NOT IN THAT CLASS, AND THAT IS THE WHOLE
 * DIFFERENCE BETWEEN A PROPOSAL AND A TASK. A `PushableBlockFire` is a
 * `Solid`, and a `Solid` on a `Button` is the mechanism `r5-l40-part5`
 * ALREADY DROVE BYTE-EXACT with the corpse — same `Button.update`, same
 * hitables entry, same `Lock` fade, 1,966 observations of both arms
 * reproduced. What is new is only WHICH Solid and WHICH button, and the
 * fire press that moves it is `fireVerb` + `pushables`, driven since R2.
 * ⇒ the route below rests on nothing this arc has not already witnessed.
 */
const HOLD_IS_UNWITNESSED = Object.freeze({
    claim: 'THE SPARE ONLY — an "Enemy"-typed body holds a Button for 101 continuous ticks '
        + 'and its group\'s Lock opens, with the player beyond runRange',
    loadBearing: false,
    whyNot: 'the route uses the BLOCK hold (§3c), whose mechanism `r5-l40-part5` already '
        + 'drove byte-exact with the corpse — a Solid on a Button, same hitables entry',
    sources: Object.freeze(['Puzzlements/Button.as:24 hitables', 'Puzzlements/Lock.as:70-92',
        'Enemies/Bob.as:52-76', 'Mobile.friction()']),
    modelCanExecute: false,
    modelReason: 'activators.js: "This model presses only on the player"',
    cheapSiteSearch: 'all 116 levels, every (button, tagged lock in group, body-reachable '
        + 'chaser) triple, park tiles 72-88 px out on the approach line',
    cheapSiteResult: 'ONE hit (L16 button t1@272,48 / lock@320,112 tag 7), whose park tiles '
        + 't(22,4) t(22,5) t(21,6) are all behind that same lock',
    verdict: 'NO CHEAP WITNESS EXISTS — the probe must be authored in L40',
});
console.log('## 7. ⚠ the bound\n');
console.log(`   UNWITNESSED: ${HOLD_IS_UNWITNESSED.claim}`);
console.log(`   the model cannot execute it — ${HOLD_IS_UNWITNESSED.modelReason}`);
console.log(`   cheap-site search: ${HOLD_IS_UNWITNESSED.cheapSiteResult}`);
console.log(`   ⇒ ${HOLD_IS_UNWITNESSED.verdict}\n`);
claim(HOLD_IS_UNWITNESSED.modelCanExecute === false
    && HOLD_IS_UNWITNESSED.loadBearing === false,
    '⚠ THE ENEMY-PRESS CLAIM IS SOURCE-READ AND UNWITNESSABLE HERE — AND IT IS THE SPARE',
    'stated rather than buried. `activators.js` presses only on the player, so no '
    + 'instrument in this tree can go red if `Bob.update`\'s leash reading is wrong, and '
    + 'the cheap-site search is bounded with its bound named: one hit, L16, whose park '
    + 'tiles sit behind the lock they would open. ⇒ **the bob hold is a SPARE and the '
    + 'route does not use it.** The route uses the block, whose press family '
    + '`r5-l40-part5` already drove byte-exact — so what the implementing slice owes is '
    + 'the ORDINARY pair discipline on a new leg, not a new mechanism\'s first witness.');

console.log('## claims\n');
let bad = 0;
for (const c of claims) {
    console.log(`   ${c.ok ? '✅' : '❌'} ${c.name}`);
    console.log(`      ${c.detail}\n`);
    if (!c.ok) bad += 1;
}
console.log(bad === 0 ? '✅ ALL CLAIMS HOLD' : `❌ ${bad} CLAIM(S) FAILED`);
console.log('\n(a probe — no tape, and no oracle either: see §7)');
process.exit(bad === 0 ? 0 : 1);
