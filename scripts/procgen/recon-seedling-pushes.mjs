#!/usr/bin/env node
/**
 * recon-seedling-pushes — the MULTI-PUSH state search, with the oracle's
 * rules rather than a hand grid's.
 *
 * Region-atlas Phase 8, subtractive ladder rung R4. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §8.5 (the sweep this
 * replaces), §10.3 (why it was qualified) and §10.6 (what the probes pinned).
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * §8.5 swept SINGLE pushes from the cells of ONE component and concluded
 * that L65's health approach is sealed. §10.3 then found the intended
 * technique in the game's own comment threads — *"push it then move
 * yourself then push again a few times, shuffling around"*, and *"hit it
 * with your spear from across the pit"* — which breaks both of that
 * sweep's assumptions. A hand re-run under corrected rules still found no
 * breach, and then a hand grid was wrong twice in one night (§10.6). So
 * the question moved from a reading to an instrument, and the instrument
 * builds its cells from the SHIPPED `buildLevelWorld` geometry — never
 * from a transcribed grid, never from `tx/16` (a tileset COLUMN is not a
 * tile type; that is §2.5's trap and it has bitten this arc twice).
 *
 * ── THE FIVE RULES, ALL ORACLE-PINNED (§10.6) ─────────────────────────
 *
 * 1. **The push is one tile in the player's FACING direction.** Not "away
 *    from the hit point": `Player.genericHit`'s `PushableBlockSpear` arm
 *    passes `_relative = true` and `PushableBlockFire.hit` RETURNS from
 *    the relative branch before the `moveTypes` check
 *    (`PushableBlockFire.as:76-87`), so `tile = getPos() - p*16` with
 *    `p = (-1,0)/(0,1)/(1,0)/(0,-1)` for `spearDirection` 0/1/2/3 — i.e.
 *    E/N/W/S. Confirmed live in L65: dx = 15.95, facing W, block W.
 * 2. **Reach is TWO tiles, across pits and through walls.** The spear rect
 *    is 32x5 with NO line-of-sight gate (`Player.as:944-968`). Confirmed
 *    live in L67 by a pair one span apart: the press arm walked into the
 *    block's vacated cell (y = 115.90), the control pinned at its south
 *    face (y = 130.05).
 * 3. **Press cells are every standable cell of every CURRENTLY reachable
 *    component**, and reachability is recomputed after every push — the
 *    push that opens the cell the next push is made from is the whole
 *    technique the walkthrough describes.
 * 4. **A block that comes to rest on water, lava or a pit DESTROYS
 *    itself** (`PushableBlockFire.input()`: `myTile.t == 1 || 17 || 6 ->
 *    destroy = true`, against `FP.world.nearestToPoint("Tile", ...)`,
 *    which is the model's own `nearestWalkableTile`). Irreversible within
 *    the visit — and, since a destroyed block is a wall REMOVED, also a
 *    candidate opener in its own right.
 * 5. **A visit is the unit.** `PushableBlockFire` holds its position in an
 *    instance var with no persistence, so leaving the level and returning
 *    rebuilds every block at its `.oel` cell. The search therefore never
 *    crosses a level boundary: it is a question about ONE visit.
 *
 * ── WHAT IS A BREACH ──────────────────────────────────────────────────
 *
 * Not "the components merged" — R2's "the rock **or** the pushable" was a
 * REACHABILITY answer and R4's question is a WALK answer (§8.5's own
 * warning). A breach here is: some reachable state of the level makes a
 * TARGET reachable that the untouched level does not — where the targets
 * are the level's own teleporters and pickups, read from the world rather
 * than named by hand. The report also prints losses, because a stray press
 * that SEALS something is exactly what the §3.2 press audit exists to
 * forbid.
 *
 * ── THE BOUNDS, NAMED (a bounded sweep names what it bounded) ──────────
 *
 * - **Enemies are not block obstacles here.** A block's own solid list is
 *   `["Solid","Tree","Rock","Rope","ShieldBoss"]` plus `"Enemy"` and
 *   `"Player"` (`Mobile.as:17` + `PushableBlockFire.as:31`), and the
 *   model's `world.solids` is the PLAYER's list — enemies are `notSolid`
 *   in the census because they do not stop the player. A chaser standing
 *   in the destination tile would stop a push at runtime. Every push whose
 *   destination contains an enemy's SPAWN cell is flagged; a mobile enemy
 *   elsewhere is a live-probe question, not a static one.
 * - **The player is a block obstacle**, and that one IS modelled: a press
 *   whose own stance box overlaps the destination tile is excluded and
 *   counted (`player-in-path`).
 * - **Stances are lattice cell centres.** Run at more than one pitch: the
 *   planner's own 8 is the answer that can become a route, and a finer
 *   pitch is a strictly more permissive control whose SILENCE is what
 *   makes a negative result strong.
 * - **`v.length > 0` blocks a re-press while a block glides** (0.5 px/tick,
 *   32 ticks per tile). The search assumes each push completes before the
 *   next; that is a leg-synthesis constraint, not a reachability one.
 *
 * ⚠ INSTRUMENTS PROPOSE, THE ORACLE CONFIRMS. A breach found here is a
 * candidate for a live probe on its own press cells (the
 * `probe-seedling-l67-reach2.mjs` pattern, coast-corrected), never a
 * claim. A NON-breach is what upgrades §8.5 from a source reading to a
 * tested one, at the granularity this file prints.
 *
 * Run: node scripts/procgen/recon-seedling-pushes.mjs --level=65
 *      node scripts/procgen/recon-seedling-pushes.mjs --level=65,63,67
 *      node scripts/procgen/recon-seedling-pushes.mjs --level=65 --pitch=8,4,2
 *      node scripts/procgen/recon-seedling-pushes.mjs --level=63 --avoid-volumes=off
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const {
    buildLevelWorld, RELAXED_ROLES, TILE_SIZE, rectsOverlap, maskHitsBox,
} = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { nodeCentre, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { spearRect, RIGHT, UP, LEFT, DOWN } = await import(join(MODULE, 'presses.js'));

const source = atlasLevelSource();
const LEVEL_COUNT = 116;

/** The one tag a press can move. See the class dispatch note below. */
const PUSHABLE_SPEAR = 'pushableblockspear';
/**
 * The other two, kept visible because their ABSENCE from the search is a
 * claim: `genericHit` tests `e is PushableBlockSpear` FIRST, so a plain
 * `PushableBlockFire` falls to the non-relative arm where `moveTypes`
 * (`["Fire","Pulse"]`) does gate it — no press moves one. And plain
 * `PushableBlock` matches NO arm of `genericHit` at all: it is WALK-pushed
 * (§10.4) and a press does nothing to it whatsoever.
 */
const PUSHABLE_OTHERS = Object.freeze(['pushableblock', 'pushableblockfire']);

/** `PushableBlockFire.input()` — the three tile types that destroy a block. */
const DESTROYS_BLOCK = Object.freeze({ 1: 'water', 17: 'lava', 6: 'pit' });

/**
 * `spearDirection` -> the tile step the block takes.
 *
 * Derived, not asserted: `p = (int(d%2==0)*(d-1), int(d%2==1)*(2-d))` and
 * the block's target is `getPos() - p*16`, so the step is `-p`.
 */
const STEP = Object.freeze({
    [RIGHT]: { dx: 1, dy: 0, name: 'E' },
    [UP]: { dx: 0, dy: -1, name: 'N' },
    [LEFT]: { dx: -1, dy: 0, name: 'W' },
    [DOWN]: { dx: 0, dy: 1, name: 'S' },
});
const DIRS = [RIGHT, UP, LEFT, DOWN];
const DIR_NAME = { [RIGHT]: 'RIGHT', [UP]: 'UP', [LEFT]: 'LEFT', [DOWN]: 'DOWN' };

const arg = (name, fallback) => {
    const found = process.argv.find((a) => a.startsWith(`--${name}=`));
    return found === undefined ? fallback : found.slice(name.length + 3);
};

const tileRect = (tx, ty) => ({
    x: tx * TILE_SIZE,
    y: ty * TILE_SIZE,
    right: (tx + 1) * TILE_SIZE,
    bottom: (ty + 1) * TILE_SIZE,
});

// ── arrivals: every way into a level, from anywhere ────────────────────

/**
 * Every entry point into `level`, teleporters AND pit falls, from every
 * level in the extract.
 *
 * ⚠ THE SEARCH RUNS PER SOURCE LEVEL, NOT OVER THE UNION, and the first
 * cut of this instrument got that wrong in a way that answered a different
 * question with a confident "no breach": seeding the flood from every
 * arrival at once puts the player on BOTH sides of the seal, so every
 * target is reachable before a single press and nothing can ever be
 * gained. A door is only an entry if the walk can get to the level it
 * comes from — which is why the report is a table by source, with the
 * union kept only as the labelled control it is.
 */
function arrivalsInto(level) {
    const found = [];
    for (let from = 0; from < LEVEL_COUNT; from++) {
        let world;
        try {
            world = buildLevelWorld(source(from), { roles: RELAXED_ROLES });
        } catch {
            continue;
        }
        for (const tp of world.teleporters) {
            if (tp.to !== level || tp.deactivated) continue;
            found.push({ kind: 'teleporter', from, x: tp.playerx, y: tp.playery });
        }
        if (world.fallthrough && world.fallthrough.level === level) {
            const ft = world.fallthrough;
            for (const tile of world.pitTiles) {
                const cx = tile.tx * TILE_SIZE + TILE_SIZE / 2;
                const cy = tile.ty * TILE_SIZE + TILE_SIZE / 2;
                found.push({
                    kind: 'fall',
                    from,
                    x: Math.floor(Math.max(cx - ft.offsetX, 0) / TILE_SIZE) * TILE_SIZE,
                    y: Math.floor(Math.max(cy - ft.offsetY, 0) / TILE_SIZE) * TILE_SIZE,
                });
            }
        }
    }
    // The arrival CTOR is a tile corner; the player entity lands at its
    // centre — the same `+ TILE_SIZE/2` every route resolver applies.
    const seen = new Set();
    return found.filter((a) => {
        const key = `${a.kind}:${a.x},${a.y}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map((a) => ({ ...a, px: a.x + TILE_SIZE / 2, py: a.y + TILE_SIZE / 2 }));
}

// ── the per-state world ───────────────────────────────────────────────

/**
 * A world with the blocks at `state`'s positions.
 *
 * Rebuilt from the extract per state rather than mutated back and forth:
 * `plannerBlockerAt` closes over the `solids` ARRAY, so an in-place edit
 * that was not perfectly undone would leak into every later state, and a
 * leak here is exactly the kind of wrong-map answer §8.5 already paid for.
 */
function worldForState(level, clears, blocks, state) {
    const world = buildLevelWorld(
        source(level), clears?.length ? { cleared: clears } : undefined,
    );
    const solidsOf = (w) => w.solids.filter((s) => s.tag === PUSHABLE_SPEAR);
    const live = solidsOf(world);
    if (live.length !== blocks.length) {
        throw new Error(`L${level}: rebuilt world has ${live.length} `
            + `${PUSHABLE_SPEAR} solids, the state tracks ${blocks.length}`);
    }
    // Same extract, same build order, so index i is block i. Asserted by
    // the spawn tile rather than assumed.
    live.forEach((s, i) => {
        if (s.x !== blocks[i].x0 || s.y !== blocks[i].y0) {
            throw new Error(`L${level}: block ${i} rebuilt at (${s.x},${s.y}), `
                + `expected its spawn (${blocks[i].x0},${blocks[i].y0})`);
        }
    });
    for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        const b = state[i];
        if (b.dead) {
            for (const list of [world.solids, world.objectSolids]) {
                const at = list.indexOf(s);
                if (at >= 0) list.splice(at, 1);
            }
        } else {
            s.rect = tileRect(b.tx, b.ty);
            s.x = b.tx * TILE_SIZE;
            s.y = b.ty * TILE_SIZE;
        }
    }
    return world;
}

// ── the flood ─────────────────────────────────────────────────────────

/**
 * Every lattice cell the player can stand in and walk to, from `arrivals`.
 *
 * The standability test is `plannerObstacleAt` — the SHIPPED planner's,
 * not a re-derived one — so a cell this flood calls standable is a cell
 * the driver's own A* would accept, and the pit/lethal-terrain/avoid-volume
 * policies come along for free.
 */
function flood(world, seeds, pitch, plan) {
    const nx = world.width * TILE_SIZE / pitch;
    const ny = world.height * TILE_SIZE / pitch;
    const free = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= nx || cy >= ny) return false;
        const c = nodeCentre(cx, cy, pitch);
        try {
            return plannerObstacleAt(world, c.x, c.y, null, plan) === null;
        } catch {
            return false;
        }
    };
    const seen = new Set();
    const queue = [];
    const seed = (cx, cy) => {
        const k = `${cx},${cy}`;
        if (seen.has(k) || !free(cx, cy)) return;
        seen.add(k);
        queue.push([cx, cy]);
    };
    const landed = [];
    for (const a of seeds) {
        const cx = Math.floor(a.px / pitch);
        const cy = Math.floor(a.py / pitch);
        const before = seen.size;
        seed(cx, cy);
        // ⚠ AN ARRIVAL CELL CAN BE BLOCKED AND THE ARRIVAL STILL REAL —
        // the game put the player there. R2's forced-contact rule: an
        // arrival blocked only by volumes it is standing IN is stepped off
        // into its neighbours. Modelled here as the cheap half: if the
        // landing cell itself refuses, seed its four neighbours.
        if (seen.size === before) {
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                seed(cx + dx, cy + dy);
            }
        }
        landed.push({ ...a, seeded: seen.size > before, cx, cy });
    }
    while (queue.length > 0) {
        const [cx, cy] = queue.pop();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const k = `${cx + dx},${cy + dy}`;
            if (seen.has(k) || !free(cx + dx, cy + dy)) continue;
            seen.add(k);
            queue.push([cx + dx, cy + dy]);
        }
    }
    return { cells: seen, landed };
}

/**
 * The level's own targets: what "reachable" is being asked ABOUT.
 *
 * Teleporters and pickups, read from the world. A target counts as reached
 * when any reachable cell is 4-adjacent to its volume — the same DILATED
 * test `componentsAround` uses, because a trigger's own cells are blocked
 * by construction and "the cells whose centre is inside the rect" returns
 * nothing for a six-pixel-tall button (R2's L71 lesson).
 */
function targetsOf(world) {
    const out = [];
    for (const tp of world.teleporters) {
        if (tp.deactivated) continue;
        out.push({ kind: 'door', name: `-> L${tp.to}`, at: `${tp.x},${tp.y}`, rect: tp.rect });
    }
    for (const p of world.pickups) {
        out.push({ kind: 'pickup', name: p.tag, at: `${p.x},${p.y}`, rect: p.rect });
    }
    for (const p of world.pressers) {
        out.push({ kind: 'presser', name: `${p.tag}(t${p.t})`, at: `${p.x},${p.y}`, rect: p.rect });
    }
    return out;
}

/**
 * ⚠ THE DILATION IS IN PIXELS, NOT IN CELLS, and the difference is a whole
 * verdict. `componentsAround` dilates a volume by ONE CELL because it runs
 * at pitch 8 and one cell is half a tile; the same expression at pitch 2
 * asks about cells two pixels away, which are still inside the teleporter
 * volume — and the first cut of this instrument duly reported every door
 * of L65 sealed at pitch 2, including the two the walk arrives through.
 * A pitch-independent instrument needs a pitch-independent question.
 */
const TARGET_DILATION = TILE_SIZE / 2;

function reachedTargets(targets, cells, pitch) {
    const pad = Math.ceil(TARGET_DILATION / pitch);
    const hit = new Set();
    for (const t of targets) {
        const c0 = Math.floor(t.rect.x / pitch) - pad;
        const c1 = Math.ceil(t.rect.right / pitch) + pad - 1;
        const r0 = Math.floor(t.rect.y / pitch) - pad;
        const r1 = Math.ceil(t.rect.bottom / pitch) + pad - 1;
        let ok = false;
        for (let cy = r0; cy <= r1 && !ok; cy++) {
            for (let cx = c0; cx <= c1 && !ok; cx++) {
                if (cells.has(`${cx},${cy}`)) ok = true;
            }
        }
        if (ok) hit.add(`${t.kind}|${t.name}|${t.at}`);
    }
    return hit;
}

// ── the pushes available from a state ─────────────────────────────────

/**
 * Every press, from every reachable stance, that MOVES a block.
 *
 * The four outcomes are all reported, because three of them are audit
 * findings even when the fourth is empty:
 *   `moves`            the block goes one tile (or dies on arrival)
 *   `inert`            the rect reaches it but the destination is solid,
 *                      so `moveX` collides immediately and the block does
 *                      not move at all — a legal press with no effect
 *   `player-in-path`   the stance's own box is in the destination tile;
 *                      the block collides with `"Player"` and wedges
 *   `enemy-in-path`    an enemy SPAWNS in the destination tile (bounded:
 *                      mobile enemies are not tracked)
 */
function pushesFrom(world, state, blocks, cells, pitch, enemies) {
    const moves = new Map();
    const inert = [];
    const blockedByPlayer = [];
    const blockedByEnemy = [];
    for (const key of cells) {
        const [cx, cy] = key.split(',').map(Number);
        const c = nodeCentre(cx, cy, pitch);
        for (const dir of DIRS) {
            const rect = spearRect(c.x, c.y, dir);
            for (let i = 0; i < state.length; i++) {
                const b = state[i];
                if (b.dead) continue;
                const bRect = tileRect(b.tx, b.ty);
                if (!rectsOverlap(rect, bRect)) continue;
                const step = STEP[dir];
                const nx = b.tx + step.dx;
                const ny = b.ty + step.dy;
                const dest = tileRect(nx, ny);
                const press = {
                    block: i, dir, from: { tx: b.tx, ty: b.ty }, to: { tx: nx, ty: ny },
                    stance: { x: c.x, y: c.y, cx, cy },
                };
                if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) {
                    inert.push({ ...press, why: 'destination is off the level grid' });
                    continue;
                }
                const wall = world.solids.find(
                    (s) => !(s.tag === PUSHABLE_SPEAR && s.rect.x === b.tx * TILE_SIZE
                        && s.rect.y === b.ty * TILE_SIZE)
                        && rectsOverlap(dest, s.rect),
                );
                if (wall) {
                    inert.push({ ...press, why: `destination holds ${wall.tag}` });
                    continue;
                }
                // ⚠ THE REAL MASK, NOT THE BOUNDING RECT. `OpenTree`'s
                // 32x32 rect swallows its own 10x12 doorway — the R2
                // lesson the planner already learned — and L65's L68 door
                // sits INSIDE that doorway. Testing the rect here reported
                // a push into the tree cell as inert for the wrong reason,
                // which is the shape of answer that survives review.
                const mask = world.pixelmasks.find(
                    (p) => maskHitsBox(p.mask, p.maskX, p.maskY, dest),
                );
                if (mask) {
                    inert.push({ ...press, why: `destination holds ${mask.tag} (pixelmask)` });
                    continue;
                }
                if (rectsOverlap(playerBoxAt(c.x, c.y), dest)) {
                    blockedByPlayer.push(press);
                    continue;
                }
                const enemy = enemies.find(
                    (e) => e.tx === nx && e.ty === ny,
                );
                if (enemy) {
                    blockedByEnemy.push({ ...press, why: `${enemy.type} spawns there` });
                    continue;
                }
                // ── the destruction check (`PushableBlockFire.input()`) ──
                // Against the model's own resolver, not "the tile it lands
                // on": the game asks `nearestToPoint("Tile", ...)` from the
                // block's centre, and the two answers differ wherever the
                // landing cell's own tile has left the "Tile" list.
                const centreX = nx * TILE_SIZE + TILE_SIZE / 2;
                const centreY = ny * TILE_SIZE + TILE_SIZE / 2;
                const under = world.nearestWalkableTile(centreX, centreY);
                const kills = under ? DESTROYS_BLOCK[under.t] : undefined;
                const outcome = { ...press, kills: kills ?? null, under: under?.t ?? null };
                const k = `${i}|${nx},${ny}|${kills ?? ''}`;
                if (!moves.has(k)) moves.set(k, { ...outcome, stances: [] });
                // ⚠ THE OVERLAP AREA IS CARRIED, and it is the difference
                // between a stance a probe can hit and one it cannot. The
                // spear rect is 5 px THICK and a legal press can share as
                // little as half a pixel with the block — a stance that is
                // true of the model and hopeless against a controller that
                // arrives with a tolerance. Stances are ranked by it, so
                // the one the report names first is the one furthest from
                // every edge.
                moves.get(k).stances.push({
                    ...press.stance,
                    dir,
                    overlap: (Math.min(rect.right, bRect.right) - Math.max(rect.x, bRect.x))
                        * (Math.min(rect.bottom, bRect.bottom) - Math.max(rect.y, bRect.y)),
                });
            }
        }
    }
    for (const m of moves.values()) m.stances.sort((a, b) => b.overlap - a.overlap);
    return { moves: [...moves.values()], inert, blockedByPlayer, blockedByEnemy };
}

/**
 * Which extract tags are ENEMIES for the block's own solid list.
 *
 * ⚠ A NAME MATCH, and therefore a BOUND rather than a census: the world
 * does not carry enemies at all (they are `notSolid` — they do not stop
 * the PLAYER), and the block's list does (`"Enemy"`). Anything this misses
 * shows up as a push the model allows and the game refuses, which is the
 * safe direction for a search whose positives are probed.
 */
const ENEMY_TAG = /bob|jelly|turret|drill|spinner|trap|flyer|bulb|runner|tentacle|watcher|boss|grenade|axe|slime|ghost|worm|bat/i;

/** Enemy SPAWN cells, from the raw extract (they are `notSolid` in the world). */
function enemySpawns(level) {
    const record = source(level);
    const out = [];
    for (const e of record.entities ?? []) {
        out.push({
            type: e.type,
            x: Number(e.x),
            y: Number(e.y),
            tx: Math.floor(Number(e.x) / TILE_SIZE),
            ty: Math.floor(Number(e.y) / TILE_SIZE),
        });
    }
    return out;
}

// ── the search ────────────────────────────────────────────────────────

const stateKey = (state) => state.map((b) => (b.dead ? 'X' : `${b.tx},${b.ty}`)).join('|');

/**
 * A canonical name for the region the player is standing in — the
 * lowest-numbered cell of its flood.
 *
 * ⚠ WHERE THE PLAYER IS PART OF THE STATE, and leaving it out is the flaw
 * that made the first cut of this search report chains it could not walk.
 * It re-flooded from the ARRIVALS after every push, so a push that severs
 * the room behind the player was scored as if the player had teleported
 * back to the door. In L65 that is not hypothetical: the block's own cell
 * (11,9) is a cut vertex of the entry side, and a push S both opens the
 * corridor ahead and seals the way back. A push is made from a stance, and
 * the player is standing on that stance when the block lands.
 */
function canonRegion(cells) {
    let best = null;
    for (const k of cells) {
        const [cx, cy] = k.split(',').map(Number);
        if (best === null || cy < best[1] || (cy === best[1] && cx < best[0])) best = [cx, cy];
    }
    return best === null ? 'empty' : `${best[0]},${best[1]}`;
}

function search(level, arrivals, { pitch, plan, maxPushes, clears, blocks, targets, enemies }) {
    const start = blocks.map((b) => ({ tx: b.tx, ty: b.ty, dead: false }));
    const worldCache = new Map();
    const worldFor = (state) => {
        const k = stateKey(state);
        if (!worldCache.has(k)) worldCache.set(k, worldForState(level, clears, blocks, state));
        return worldCache.get(k);
    };

    const world0 = worldFor(start);
    const first = flood(world0, arrivals, pitch, plan);
    const seen = new Set([`${stateKey(start)}#${canonRegion(first.cells)}`]);
    const queue = [{ state: start, chain: [], cells: first.cells, landed: first.landed }];
    const visited = [];

    while (queue.length > 0) {
        const node = queue.shift();
        const { state, chain, cells } = node;
        const world = worldFor(state);
        const hit = reachedTargets(targets, cells, pitch);
        const pushes = pushesFrom(world, state, blocks, cells, pitch, enemies);
        visited.push({ ...node, cellCount: cells.size, hit, pushes });
        if (chain.length >= maxPushes) continue;
        for (const m of pushes.moves) {
            const next = state.map((b, i) => (i === m.block
                ? (m.kills ? { ...b, dead: true } : { tx: m.to.tx, ty: m.to.ty, dead: false })
                : { ...b }));
            const nextWorld = worldFor(next);
            // Every stance, not just the best one: two stances that make
            // the SAME push can end up in different regions of the level
            // it produces, and only one of them may be the useful side.
            for (const s of m.stances) {
                const after = flood(nextWorld, [{ px: s.x, py: s.y }], pitch, plan);
                const key = `${stateKey(next)}#${canonRegion(after.cells)}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const link = { ...m, stances: [s, ...m.stances.filter((o) => o !== s)] };
                queue.push({
                    state: next,
                    chain: [...chain, link],
                    cells: after.cells,
                    landed: after.landed,
                });
            }
        }
    }
    return { visited };
}

// ── the report ────────────────────────────────────────────────────────

const stateLabel = (state) =>
    state.map((b) => (b.dead ? 'DESTROYED' : `(${b.tx},${b.ty})`)).join(' ');

function describeChain(chain) {
    return chain.map((m, i) => {
        const s = m.stances[0];
        return `${i + 1}. push ${STEP[m.dir].name}: (${m.from.tx},${m.from.ty}) -> `
            + `(${m.to.tx},${m.to.ty})`
            + `${m.kills ? ` and DESTROYS on ${m.kills}` : ''}`
            + `\n      stance USED (${s.x},${s.y}) facing ${DIR_NAME[m.dir]}, `
            + `${s.overlap.toFixed(1)} px² of rect on the block`
            + `\n      same push also legal from: ${m.stances.slice(1, 6)
                .map((o) => `(${o.x},${o.y})/${o.overlap.toFixed(1)}px²`).join(' ') || '(nowhere else)'}`
            + ' ⚠ a different stance can leave the player in a different region';
    });
}

/** One entry group's search, printed and reduced to a verdict. */
function reportEntry(level, label, arrivals, ctx, control = false) {
    const t0 = Date.now();
    const { targets, maxPushes, pitch } = ctx;
    const { visited } = search(level, arrivals, ctx);
    const initial = visited[0];
    console.log(`\n   ── ENTERING FROM ${label} `
        + `(${arrivals.length} arrival${arrivals.length === 1 ? '' : 's'}, `
        + `${initial.cellCount} standable cells reachable untouched)`);
    if (initial.cellCount === 0) {
        console.log('      no arrival cell is standable — this entry seeds nothing.');
        return { gained: [], lost: [], visited };
    }
    for (const t of targets) {
        const key = `${t.kind}|${t.name}|${t.at}`;
        console.log(`      ${initial.hit.has(key) ? 'REACHABLE' : '⛔ SEALED '} `
            + `${t.kind.padEnd(8)} ${t.name.padEnd(18)} @${t.at}`);
    }
    const p0 = initial.pushes;
    console.log(`      presses that MOVE a block: ${p0.moves.length}`
        + `; inert (destination solid): ${p0.inert.length}`
        + `; player-in-path: ${p0.blockedByPlayer.length}`
        + `; enemy-spawn-in-path: ${p0.blockedByEnemy.length}`);
    for (const m of p0.moves) {
        console.log(`         ${STEP[m.dir].name} -> (${m.to.tx},${m.to.ty})`
            + `${m.kills ? ` DESTROYS on ${m.kills}` : ''}`
            + `  from ${m.stances.length} stance(s), e.g. (${m.stances[0].x},${m.stances[0].y})`);
    }
    for (const why of new Set(p0.inert.map((i) => `${STEP[i.dir].name}: ${i.why}`))) {
        console.log(`         inert ${why}`);
    }
    for (const b of new Set(p0.blockedByEnemy.map((e) => `${STEP[e.dir].name}: ${e.why}`))) {
        console.log(`         enemy-blocked ${b}`);
    }

    const gained = [];
    const lost = [];
    for (const v of visited) {
        if (v === initial) continue;
        for (const k of v.hit) if (!initial.hit.has(k)) gained.push({ v, k });
        for (const k of initial.hit) if (!v.hit.has(k)) lost.push({ v, k });
    }
    console.log(`      ${visited.length} reachable block state(s), depth <= ${maxPushes}, `
        + `pitch ${pitch}:`);
    for (const v of visited) {
        console.log(`         ${stateLabel(v.state).padEnd(24)} `
            + `player region ${canonRegion(v.cells).padEnd(7)} `
            + `${String(v.cellCount).padStart(5)} cells, `
            + `${v.hit.size}/${targets.length} target(s), ${v.chain.length} push(es)`);
    }
    if (control) {
        // The union is not a state any visit is ever in, so its gain/loss
        // verdict compares two different questions. Its VALUE is the cell
        // counts and the push inventory, which is why it prints those and
        // stops there.
        console.log('      (control: gain/loss suppressed — the union is not a visit)');
        return { gained: [], lost: [], visited };
    }
    if (gained.length === 0) {
        console.log('      ⇒ NO BREACH from this entry: every reachable block state reaches'
            + '\n        exactly the targets the untouched level already reaches.');
    } else {
        console.log(`      ⇒ ⛔ BREACH — ${gained.length} target(s) become reachable:`);
        const bySt = new Map();
        for (const g of gained) {
            const k = stateKey(g.v.state);
            if (!bySt.has(k)) bySt.set(k, { v: g.v, keys: [] });
            bySt.get(k).keys.push(g.k);
        }
        for (const { v, keys } of bySt.values()) {
            console.log(`         state ${stateLabel(v.state)} reaches ${keys.join(', ')}`);
            for (const line of describeChain(v.chain)) console.log(`            ${line}`);
        }
        console.log('         ⚠ A CANDIDATE, NOT A CLAIM — confirm on the game with a live'
            + '\n           probe on these stances (coast-corrected) before ruling on it.');
    }
    if (lost.length > 0) {
        console.log(`      ⚠ A STRAY PRESS CAN SEAL: ${[...new Set(lost.map((l) => l.k))]
            .join(', ')}\n        — which is what the §3.2 press audit forbids, here, by name.`);
    }
    console.log(`      (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    return { gained, lost, visited };
}

function report(level, pitch, plan, maxPushes, clears, only) {
    const record = source(level);
    const base = buildLevelWorld(source(level), clears?.length ? { cleared: clears } : undefined);
    const blocks = base.solids.filter((s) => s.tag === PUSHABLE_SPEAR).map((s) => ({
        x0: s.x, y0: s.y, tx: Math.floor(s.x / TILE_SIZE), ty: Math.floor(s.y / TILE_SIZE),
    }));
    const targets = targetsOf(base);
    const enemies = enemySpawns(level).filter((e) => ENEMY_TAG.test(e.type));
    const arrivals = arrivalsInto(level);

    console.log(`\n══ L${level} — ${record.width}x${record.height} tiles, pitch ${pitch}, `
        + `avoidVolumes ${plan.avoidVolumes ? 'ON' : 'OFF'}, `
        + `noHazards [${plan.noHazards.join(',') || 'none'}], maxPushes ${maxPushes}`);
    if (clears?.length) console.log(`   clears applied: ${clears.join(', ')}`);
    console.log(`   ${PUSHABLE_SPEAR}: ${blocks.length
        ? blocks.map((b) => `@${b.x0},${b.y0} = tile (${b.tx},${b.ty})`).join(', ')
        : 'NONE — no press can move anything in this level'}`);
    const others = (record.entities ?? []).filter((e) => PUSHABLE_OTHERS.includes(e.type));
    if (others.length) {
        console.log(`   press-immune pushables present: ${others
            .map((e) => `${e.type}@${e.x},${e.y}`).join(', ')}`
            + ' (walk-push or Fire/Pulse only — see the class dispatch note)');
    }
    if (blocks.length === 0) return { gained: [], lost: [] };

    // ⚠ ONE SEARCH PER ARRIVAL, not per source level. A visit starts at
    // exactly one door, and L65's two doors from L63 land in components
    // that do not reach each other — so seeding both at once gave the
    // untouched level a reachable set no single visit ever has, and every
    // later state then "lost" the half the player was never in.
    const ctx = { pitch, plan, maxPushes, clears, blocks, targets, enemies };
    const all = { gained: [], lost: [] };
    const entries = arrivals.filter((a) => only === null || only.includes(a.from));
    for (const a of entries) {
        const r = reportEntry(level, `L${a.from} (${a.kind} -> ${a.x},${a.y})`, [a], ctx);
        all.gained.push(...r.gained);
        all.lost.push(...r.lost);
    }
    if (entries.length > 1) {
        console.log('\n   ── the UNION control (every entry at once — the player on BOTH');
        console.log('      sides of any seal, so it can only ever say "no gain")');
        reportEntry(level, 'ANY ENTRY (control)', arrivals, ctx, true);
    }
    return all;
}

/**
 * The level as the SHIPPED world sees it, one character per tile.
 *
 * Printed on demand because two hand grids were wrong in one night
 * (§10.6), and the cure for that is not a more careful hand — it is
 * reading the same `buildLevelWorld` the planner reads. Legend:
 *
 *   `#` a solid (tile or entity)   `.` walkable floor   `o` pit
 *   `~` water   `^` lava   `=` ice   `v` waterfall   `B` the pushable
 *   `T` a teleporter volume        `P` a pickup       `!` an avoid volume
 */
function grid(level, clears) {
    const world = buildLevelWorld(source(level), clears?.length ? { cleared: clears } : undefined);
    const walk = new Map(world.walkableTiles.map((t) => [`${t.tx},${t.ty}`, t]));
    const glyphFor = (tx, ty) => {
        const r = tileRect(tx, ty);
        const block = world.solids.find((s) => s.tag === PUSHABLE_SPEAR
            && s.rect.x === r.x && s.rect.y === r.y);
        if (block) return 'B';
        const t = walk.get(`${tx},${ty}`);
        if (!t) {
            return world.pixelmasks.some(
                (p) => maskHitsBox(p.mask, p.maskX, p.maskY, r),
            ) ? '%' : '#';
        }
        if (world.solids.some((s) => rectsOverlap(r, s.rect) && s.cls)) return '#';
        if (world.teleporters.some((tp) => !tp.deactivated && rectsOverlap(r, tp.rect))) return 'T';
        if (world.pickups.some((p) => rectsOverlap(r, p.rect))) return 'P';
        if (world.proximityHazards.some((h) => (h.disc
            ? Math.hypot(r.x + 8 - h.disc.x, r.y + 8 - h.disc.y) < h.disc.r
            : rectsOverlap(r, h.rect)))) return '!';
        return { 1: '~', 6: 'o', 17: '^', 22: '=', 25: 'v' }[t.t] ?? '.';
    };
    console.log(`\n   ── L${level} as buildLevelWorld sees it `
        + '(# solid  . floor  o pit  ~water ^lava =ice vwaterfall  B block  T door '
        + ' P pickup  ! avoid volume  % pixelmask)');
    console.log(`      ${'   '}${Array.from({ length: world.width }, (_, i) => i % 10).join('')}`);
    for (let ty = 0; ty < world.height; ty++) {
        let row = '';
        for (let tx = 0; tx < world.width; tx++) row += glyphFor(tx, ty);
        console.log(`      ${String(ty).padStart(2)} ${row}`);
    }
    const named = (world.solids ?? []).filter((s) => s.cls)
        .map((s) => `${s.tag}@${s.x},${s.y}=(${Math.floor(s.x / TILE_SIZE)},${Math.floor(s.y / TILE_SIZE)})`);
    if (named.length) console.log(`      entity solids: ${named.join(' ')}`);
}

// ── main ──────────────────────────────────────────────────────────────

const levels = (arg('level', '65')).split(',').map(Number);
const pitches = (arg('pitch', '8,4')).split(',').map(Number);
const maxPushes = Number(arg('max-pushes', '6'));
const avoidVolumes = arg('avoid-volumes', 'on') !== 'off';
/** R4's terminal hazard set, as ruled (§9.1). */
const noHazards = (arg('no-hazards', 'water')).split(',').filter(Boolean);
const clears = (arg('clears', '')).split(',').filter(Boolean).map(Number);
/** Restrict the entry table to these source levels; null = every entry. */
const only = arg('from', null) === null
    ? null : arg('from', '').split(',').filter(Boolean).map(Number);

const plan = {
    noclip: false,
    noHazards,
    avoidVolumes,
    lattice: null,
};

console.log('the multi-push state search — §10.6\'s oracle-pinned rules, over the '
    + 'shipped\nlevelWorld geometry (never a hand grid, never tx/16)');
for (const level of levels) {
    if (process.argv.includes('--grid')) grid(level, clears);
    for (const pitch of pitches) {
        report(level, pitch, { ...plan, lattice: pitch }, maxPushes, clears, only);
    }
}
