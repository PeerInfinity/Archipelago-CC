#!/usr/bin/env node
/**
 * probe-seedling-r5-feather — WHERE THE FEATHER'S ROUTE ACTUALLY IS.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 5, step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §16.10, which is the
 * measurement this probe re-asks at the granularity the player moves at.
 *
 * ── WHAT §16.10 SAID, AND WHY IT HAD TO BE RE-ASKED ───────────────────
 *
 * Slice 4 step 5 measured the feather unreachable and wrote the numbers
 * down rather than a sentence, which is what makes this probe possible at
 * all. Two of those numbers are about L87:
 *
 *     from the L44 arrival (28,17), canSwim   321 tiles   L92 door: NO
 *     from the L44 arrival (28,17), no conch  149 tiles   L92 door: NO
 *
 * ⛔ AND THEY WERE MEASURED WITH TWO THINGS WRONG AT ONCE, both of which
 * this probe reproduces before it disagrees.
 *
 * 1. **A TILE-CENTRE LATTICE.** One probe per tile, at `(tx*16+8,
 *    ty*16+8)`. That is the exact instrument
 *    `feedback_reachability_needs_the_movement_granularity` was written
 *    about: `Mobile.moveX/moveY` step ONE PIXEL at a time and a `CliffSide`
 *    is a PIXELMASK rather than a full cell, so a lattice that only ever
 *    asks about tile centres reports seals the walk never meets. R2's recon
 *    lost seven corridors to it.
 * 2. ⛔⛔ **AN EXEMPTION THAT NEVER FIRED.** `plannerObstacleAt`'s third
 *    argument is an **INDEX** into `level.teleporters`; the committed
 *    measurement passed the teleporter OBJECT. `i === allowTeleporter` is
 *    false for every `i`, so the L92 door's own volume stayed an obstacle —
 *    and the test's comment says in as many words that it was exempted "so
 *    this is not the teleporter-volume policy reporting its own avoidance
 *    as a wall". It was precisely that.
 *
 * ⚠ SO THIS PROBE RUNS THREE GRANULARITIES AND PRINTS THEM TOGETHER. The
 * coarse arm is not decoration: it is the CONTROL that reproduces §16.10's
 * committed numbers, which is what makes the finer arms' disagreement a
 * measurement rather than a new opinion. An instrument that cannot
 * reproduce the known answer is not evidence about the unknown one. And
 * neither lattice is the game — 16 px cannot see a half-tile, 8 px cannot
 * see a tile centre — so the PIXEL arm is what settles it.
 *
 * ── THE CANDIDATE CHAIN THIS TESTS ────────────────────────────────────
 *
 * The kickoff hands slice 5 a chain to CONFIRM (instruments propose):
 *
 *   L44 → L87 → door@0,144 → L89 (272,240) → step east onto L89's own
 *   teleporter@288,240 → L87 (16,144) → north to the L92 door@16,32 →
 *   L92 → L91 → door@16,144 → L89 from the TOP → descend to the feather
 *
 * with two named unknowns. Both are answered below, and the answer to the
 * second one SHORTENS the chain: if L87 is one component then the L89
 * round trip is a no-op, because the door it comes back through
 * (`L89@288,240` → L87 (16,144)) lands in the same component the L44
 * arrival is already in.
 *
 * ── ⛔ AND THE REAL BLOCKER IS SOMEWHERE ELSE ENTIRELY ─────────────────
 *
 * It is in L92, it is TWO ENTITIES, and they are named here with the
 * single-entity sweep the granularity memo asks for: for each seal, which
 * one entity, if removed, opens it.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-feather.mjs
 *   node scripts/procgen/probe-seedling-r5-feather.mjs --maps
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { nodeCentre, plannerObstacleAt, climbsArmedWaterfall } =
    await import(join(MODULE, 'botDriverV2.js'));
const { FEATHER_BLOCKER } = await import(join(MODULE, 'r5Swim.js'));

const MAPS = process.argv.includes('--maps');
const source = atlasLevelSource();

/** Everything the walk holds by the time it asks this question. */
const INVENTORY = Object.freeze({
    hasFire: true, canSwim: true, hasSword: true, hasFeather: false,
});
const withFeather = { ...INVENTORY, hasFeather: true };

const worldFor = (level, inventory = INVENTORY) =>
    buildLevelWorld(source(level), { roles: ROLES, inventory });

/**
 * A reachability instrument at ONE lattice, with a named ignore set.
 *
 * ⚠ `ignore` names entities by TAG AND POSITION, never by tag alone. "The
 * breakable rocks are passable" is a different claim from "the rock at
 * (256,112) is passable", and the sweep below needs to make the second one
 * one rock at a time.
 *
 * ⚠ AND THE PREDICATE IS A PARAMETER, because §16.10 used TWO of them —
 * `collidesSolid` at the tile centre for L89 and `isWalkableTile` (i.e.
 * `plannerObstacleAt`, with the target teleporter exempted) for L87. The
 * control below has to reproduce each committed number with the instrument
 * that produced it, or it is not a control.
 *
 * `allowTeleporter` is `isWalkableTile`'s own third argument: a door's
 * volume is planner-forbidden floor, so asking "is the door reachable"
 * without it is the avoidance policy reporting itself as a wall.
 */
function reach(level, {
    lattice, inventory = INVENTORY, ignore = [], predicate = 'planner',
    allowTeleporter = null, noHazards = [],
} = {}) {
    const world = worldFor(level, inventory);
    const cells = TILE_SIZE / lattice;
    const plan = {
        noclip: false, noHazards, avoidVolumes: true, lattice, nodeMargin: 0, inventory,
    };
    /** The obstacle at a cell, or null — the same query `free` decides on. */
    const obstacleAt = (cx, cy) => {
        if (predicate === 'solid') {
            const hit = world.collidesSolid(playerBoxAt(cx * lattice + lattice / 2,
                cy * lattice + lattice / 2));
            return hit === null ? null : { kind: 'pickup-or-solid', blocker: hit };
        }
        const c = nodeCentre(cx, cy, lattice);
        try { return plannerObstacleAt(world, c.x, c.y, allowTeleporter, plan); } catch { return null; }
    };
    const free = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= world.width * cells || cy >= world.height * cells) {
            return false;
        }
        if (predicate === 'solid') {
            const hit = world.collidesSolid(playerBoxAt(cx * lattice + lattice / 2,
                cy * lattice + lattice / 2));
            if (hit === null) return true;
            return ignore.some((r) => hit.tag === r.tag && hit.x === r.x && hit.y === r.y);
        }
        const c = nodeCentre(cx, cy, lattice);
        let o;
        try { o = plannerObstacleAt(world, c.x, c.y, allowTeleporter, plan); } catch { return false; }
        if (o === null) return true;
        const b = o.blocker;
        return !!b && ignore.some((r) => b.tag === r.tag && b.x === r.x && b.y === r.y);
    };
    // ⛔ THE REFUSAL IS ON THE STEP, NOT THE CELL — R4's one directed rule.
    // A waterfall is something a route crosses DOWNWARD all the time.
    const stepOk = (from, to) => !climbsArmedWaterfall(world, from, to, plan);
    const flood = (cx, cy) => {
        const seen = new Set();
        const stack = [[cx, cy]];
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const k = `${x},${y}`;
            if (seen.has(k) || !free(x, y)) continue;
            seen.add(k);
            for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
                if (seen.has(`${a},${b}`) || !free(a, b)) continue;
                if (!stepOk({ tx: x, ty: y }, { tx: a, ty: b })) continue;
                stack.push([a, b]);
            }
        }
        return seen;
    };
    /** The free cell nearest a PLAYER position, which is where an arrival is. */
    const cellNear = (px, py) => {
        const cx0 = Math.floor(px / lattice);
        const cy0 = Math.floor(py / lattice);
        for (let r = 0; r < 8; r += 1) {
            for (let dy = -r; dy <= r; dy += 1) {
                for (let dx = -r; dx <= r; dx += 1) {
                    if (free(cx0 + dx, cy0 + dy)) return [cx0 + dx, cy0 + dy];
                }
            }
        }
        return null;
    };
    const tileCells = (tx, ty) => {
        const out = [];
        for (let dy = 0; dy < cells; dy += 1) {
            for (let dx = 0; dx < cells; dx += 1) out.push(`${tx * cells + dx},${ty * cells + dy}`);
        }
        return out;
    };
    return { world, cells, plan, predicate, free, obstacleAt, stepOk, flood, cellNear, tileCells };
}

/** From a player position, flood and report. */
function from(level, px, py, opts) {
    const r = reach(level, opts);
    const start = r.cellNear(px, py);
    if (start === null) throw new Error(`L${level}: no free cell near (${px},${py})`);
    return { ...r, start, seen: r.flood(start[0], start[1]) };
}

const touches = (r, tx, ty) => r.tileCells(tx, ty).some((k) => r.seen.has(k));

/**
 * ⛔ THE HARVEST TEST, AND IT IS NOT BARE ADJACENCY.
 *
 * `recon-seedling-r5`'s flood harvests a pickup when a flooded cell is
 * 4-adjacent to its volume, which is right for a pickup on open floor and
 * OPTIMISTIC here: the cell below the feather is the bottom of a waterfall,
 * and "adjacent to the volume" would report the feather collectable from a
 * cell whose step INTO it is the one step `climbsArmedWaterfall` refuses.
 * So the test is the adjacency AND the step.
 */
function feathersReachable(r) {
    const f = r.world.pickups.find((p) => p.tag === 'feather');
    if (!f) throw new Error('L89 has no feather');
    const lattice = TILE_SIZE / r.cells;
    // ⛔ THE TARGET IS "THE CELLS THE FEATHER ITSELF BLOCKS", NOT ITS RECT.
    // The volume is 8x8 and the PLAYER BOX is what has to overlap it, so at
    // one-pixel granularity the positions the collect verb wants are a band
    // three pixels wider than the rect on every side — and taking the rect
    // literally leaves the flood stopping short of a target set that is
    // entirely inside the blocked band. Asking the obstacle instead is the
    // same set at 8 px and the right one at 1.
    const vol = [];
    const pad = TILE_SIZE;
    for (let cy = Math.floor((f.rect.y - pad) / lattice);
        cy < Math.ceil((f.rect.bottom + pad) / lattice); cy += 1) {
        for (let cx = Math.floor((f.rect.x - pad) / lattice);
            cx < Math.ceil((f.rect.right + pad) / lattice); cx += 1) {
            if (r.predicate === 'solid') {
                // The coarse control's own reading: the flood can stand in
                // the volume, so the volume's CELLS are the target.
                const inRect = cx * lattice + lattice / 2 >= f.rect.x
                    && cx * lattice + lattice / 2 < f.rect.right
                    && cy * lattice + lattice / 2 >= f.rect.y
                    && cy * lattice + lattice / 2 < f.rect.bottom;
                if (inRect) vol.push([cx, cy]);
                continue;
            }
            const o = r.obstacleAt(cx, cy);
            if (o && o.kind === 'pickup' && o.blocker?.tag === 'feather') vol.push([cx, cy]);
        }
    }
    const legal = [];
    const adjacent = [];
    for (const [vx, vy] of vol) {
        for (const [a, b] of [[vx + 1, vy], [vx - 1, vy], [vx, vy + 1], [vx, vy - 1]]) {
            if (!r.seen.has(`${a},${b}`)) continue;
            adjacent.push(`(${a},${b})->(${vx},${vy})`);
            if (r.stepOk({ tx: a, ty: b }, { tx: vx, ty: vy })) legal.push(`(${a},${b})->(${vx},${vy})`);
        }
    }
    // ⚠ The volume's OWN cells count when the predicate lets the flood
    // stand in them — which the plain-solid arm does and the planner arm
    // (avoid volumes) never does. Both readings are "the pickup is
    // reachable"; only one of them is available per instrument.
    const inside = vol.some(([vx, vy]) => r.seen.has(`${vx},${vy}`));
    return { vol, adjacent, legal, inside, ok: inside || legal.length > 0 };
}

const line = (s) => console.log(s);
let failures = 0;
const claim = (ok, what, detail) => {
    if (!ok) failures += 1;
    line(`   ${ok ? '✓' : '⛔'} ${what}`);
    if (detail) line(`      ${detail}`);
};

// ─────────────────────────────────────────────────────────────────────
// 1. THE CONTROL — the coarse instrument reproduces §16.10's numbers
// ─────────────────────────────────────────────────────────────────────

line('## 1. THE CONTROL: the tile-centre lattice, against §16.10\'s committed numbers');
line('   (a feasibility instrument that has never reproduced a known answer is not');
line('    evidence about an unknown one)\n');
const L87_L92_DOOR = worldFor(87).teleporters.findIndex((t) => t.to === FEATHER_BLOCKER.l87.door.to);
{
    // L87, with `isWalkableTile` and the L92 teleporter exempted — the
    // instrument §16.10's L87 numbers were measured with.
    const doorTile = FEATHER_BLOCKER.l87.door;
    for (const [canSwim, want] of [
        [true, FEATHER_BLOCKER.l87.reachesWithConch],
        [false, FEATHER_BLOCKER.l87.reachesWithout],
    ]) {
        const l87 = from(87, FEATHER_BLOCKER.l87.from.tx * TILE_SIZE + 8,
            FEATHER_BLOCKER.l87.from.ty * TILE_SIZE + 8, {
                lattice: TILE_SIZE, noHazards: ['waterfall'], allowTeleporter: L87_L92_DOOR,
                inventory: { canSwim },
            });
        claim(l87.seen.size === want,
            `L87 from the L44 arrival, canSwim ${canSwim}: ${l87.seen.size} tiles `
            + `(§16.10 says ${want})`);
        claim(touches(l87, doorTile.tx, doorTile.ty) === FEATHER_BLOCKER.l87.connected,
            `   ...L92 door (${doorTile.tx},${doorTile.ty}) reached: `
            + `${touches(l87, doorTile.tx, doorTile.ty)} `
            + `(§16.10 says ${FEATHER_BLOCKER.l87.connected})`);
    }
    // L89, with the plain-solid tile-centre probe — the other instrument.
    for (const f of FEATHER_BLOCKER.floods) {
        const l89 = from(89, f.at.tx * TILE_SIZE + 8, f.at.ty * TILE_SIZE + 8,
            { lattice: TILE_SIZE, predicate: 'solid' });
        const got = feathersReachable(l89);
        claim(l89.seen.size === f.reaches,
            `L89 from the L${f.door} door (${f.at.tx},${f.at.ty}): ${l89.seen.size} tiles `
            + `(§16.10 says ${f.reaches})`);
        claim(got.ok === f.feather,
            `   ...feather: ${got.ok} (§16.10 says ${f.feather})`);
    }
}

// ─────────────────────────────────────────────────────────────────────
// 2. THE TWO UNKNOWNS, at BOTH granularities
// ─────────────────────────────────────────────────────────────────────

line('\n## 2. THE CHAIN\'S TWO NAMED UNKNOWNS');
line('   unknown 1: is L89\'s (17,15)→(18,15) step — the L87 arrival onto L89\'s own');
line('              teleporter@288,240 — inside one component?');
line('   unknown 2: is L87\'s west edge (16,144)→(16,32) walkable?\n');
const L89_EAST_DOOR = worldFor(89).teleporters.findIndex((t) => t.x === 288 && t.y === 240);
for (const lattice of [TILE_SIZE, 8]) {
    line(`   — lattice ${lattice} px —`);
    const l89 = from(89, 280, 248, { lattice, allowTeleporter: L89_EAST_DOOR });
    claim(touches(l89, 18, 15),
        `unknown 1: L89 (17,15)→(18,15) in one component: ${touches(l89, 18, 15)} `
        + `(${l89.seen.size} cells)`,
        'the east door is one step off the arrival — available at either granularity, '
        + 'so the chain\'s first hop was never the doubtful one');
    const l87 = from(87, 24, 152, { lattice, allowTeleporter: L87_L92_DOOR });
    const ok = touches(l87, 1, 2);
    claim(lattice === 8 ? ok : !ok,
        `unknown 2: L87 (1,9)→(1,2) — the L92 door — reached: ${ok} `
        + `(${l87.seen.size} cells)`,
        lattice === 8
            ? '⛓ AND IT HOLDS AT THE GRANULARITY THE PLAYER MOVES AT. §16.10\'s "L87 is '
              + 'SPLIT" is the tile-centre lattice\'s answer, not the game\'s: a '
              + '`CliffSide` is a PIXELMASK and the cells it leaves free are half-tiles, '
              + 'which a probe that only ever asks about tile centres cannot see.'
            : 'the coarse arm says NO, which is §16.10\'s recorded finding, reproduced');
}
{
    // ⛓ AND THE CHAIN SHORTENS. The L89 round trip existed to cross from
    // L87's east half to its west half; if there are no halves, it is a
    // no-op — the same component both ends.
    //
    // ⚠ ONE DOOR PER FLOOD, each with its OWN exemption. Every teleporter
    // but the exempted one is planner-forbidden floor, so a single flood
    // asked about three doors answers NO to two of them for a reason that
    // is about the policy rather than the map.
    const doors = worldFor(87).teleporters;
    const want = [
        ['the L92 door', 92], ['the L89 door', 89], ['the L44 door', 44],
    ];
    const got = want.map(([label, to]) => {
        const i = doors.findIndex((t) => t.to === to);
        const r = from(87, 456, 280, { lattice: 8, allowTeleporter: i });
        const tx = Math.floor(doors[i].x / TILE_SIZE);
        const ty = Math.floor(doors[i].y / TILE_SIZE);
        return { label, ok: touches(r, tx, ty), cells: r.seen.size, tx, ty };
    });
    claim(got.every((g) => g.ok),
        'and from the L44 arrival, EVERY one of L87\'s onward doors is reachable: '
        + got.map((g) => `${g.label} (${g.tx},${g.ty}) ${g.ok} [${g.cells} cells]`).join(', '),
        '⇒ the candidate chain\'s L89 round trip is unnecessary: the walk goes from the '
        + 'L44 arrival straight to the L92 door.');
}

// ─────────────────────────────────────────────────────────────────────
// 2b. ⛔ THE DECIDING ARM: ONE PIXEL, which is what `moveX`/`moveY` step
// ─────────────────────────────────────────────────────────────────────

line('\n## 2b. THE PIXEL ARM — the granularity `Mobile.moveX/moveY` actually use');
line('   Neither lattice is the game. 16 px cannot see a half-tile and 8 px cannot see');
line('   a tile CENTRE (its four probes are at ±4, and the centre is not one of them),');
line('   so the two disagree and only the pixel arm settles it. ~20 s.\n');
{
    const r = reach(87, { lattice: 1, allowTeleporter: L87_L92_DOOR });
    const seen = r.flood(456, 280);
    const door = worldFor(87).teleporters[L87_L92_DOOR];
    let at = null;
    for (let y = door.rect.y; y < door.rect.bottom && at === null; y += 1) {
        for (let x = door.rect.x; x < door.rect.right && at === null; x += 1) {
            if (seen.has(`${x},${y}`)) at = `(${x},${y})`;
        }
    }
    claim(at !== null,
        `L87 from the L44 arrival, ONE PIXEL: ${seen.size} standable positions; the L92 `
        + `door's own rect ${JSON.stringify(door.rect)} is entered at ${at ?? 'NOWHERE'}`,
        '⛓⛓ §16.10 IS RETIRED, AND FOR TWO REASONS AT ONCE. The lattice was one; the '
        + 'other is that `plannerObstacleAt`\'s third argument is an INDEX into '
        + '`level.teleporters` and the committed measurement passed the teleporter '
        + 'OBJECT — so `i === allowTeleporter` was false for every i and the exemption '
        + 'the test\'s own comment claims ("so this is not the teleporter-volume policy '
        + 'reporting its own avoidance as a wall") never fired. It was exactly that.');
}

// ─────────────────────────────────────────────────────────────────────
// 3. ⛔ THE REAL SEAL, AND IT IS IN L92
// ─────────────────────────────────────────────────────────────────────

line('\n## 3. ⛔ THE SEAL IS IN L92, AND IT IS TWO ENTITIES');
line('   L87@16,32 lands at L92 (280,136), tile (17,8). The L91 door is `L92@32,144`,');
line('   tile (2,9), the other end of the level.\n');
const ROCKS = worldFor(92).solids
    .filter((s) => s.tag === 'breakablerock')
    .map((s) => ({ tag: s.tag, x: s.x, y: s.y }))
    .sort((a, b) => a.x - b.x);
line(`   L92 holds ${ROCKS.length} breakablerock(s): `
    + `${ROCKS.map((r) => `@${r.x},${r.y} tile(${Math.floor(r.x / TILE_SIZE)},`
        + `${Math.floor(r.y / TILE_SIZE)})`).join('  ')}\n`);
{
    const sweep = [
        ['neither broken', []],
        [`only @${ROCKS[0].x},${ROCKS[0].y}`, [ROCKS[0]]],
        [`only @${ROCKS[1].x},${ROCKS[1].y}`, [ROCKS[1]]],
        ['both broken', ROCKS],
    ];
    const l91DoorIdx = worldFor(92).teleporters.findIndex((t) => t.to === 91);
    const l91Door = worldFor(92).teleporters[l91DoorIdx];
    // ⚠ AT BOTH GRANULARITIES, because a seal is exactly the claim §16.10
    // got wrong: an 8 px sweep that says "sealed" has to be confirmed by
    // the arm that steps one pixel at a time before it is a finding.
    const doorRect = l91Door.rect;
    const enters = (seen) => {
        for (let y = doorRect.y; y < doorRect.bottom; y += 1) {
            for (let x = doorRect.x; x < doorRect.right; x += 1) if (seen.has(`${x},${y}`)) return true;
        }
        return false;
    };
    let both = null;
    for (const [name, ignore] of sweep) {
        const l92 = from(92, 280, 136, { lattice: 8, ignore, allowTeleporter: l91DoorIdx });
        const coarse = touches(l92, Math.floor(l91Door.x / TILE_SIZE), Math.floor(l91Door.y / TILE_SIZE));
        const px = reach(92, { lattice: 1, ignore, allowTeleporter: l91DoorIdx });
        const pxSeen = px.flood(280, 136);
        const fine = enters(pxSeen);
        line(`   ${fine ? '✓' : '⛔'} ${name.padEnd(24)} 8px ${String(l92.seen.size).padStart(4)} `
            + `cells door ${String(coarse).padEnd(5)} | 1px ${String(pxSeen.size).padStart(6)} `
            + `positions door ${fine}`);
        if (name === 'both broken') both = fine && coarse;
        if (coarse !== fine) {
            failures += 1;
            line('      ⛔ THE TWO GRANULARITIES DISAGREE on this row — the pixel arm is the '
                + 'game, and a route built on the other one is a guess');
        }
    }
    claim(both === true,
        'the cut is NAMED: BOTH rocks, and neither alone',
        '`BreakableRock.hit(_t)` breaks when `rockType <= _t` and `Player.as:1071-1074` '
        + 'passes `hasGhostSword ? 1 : 0` — a `breakablerock` is rockType 0, so a PLAIN '
        + 'SWORD press breaks it. The price of the feather is two swings, not an item.');
}

// ─────────────────────────────────────────────────────────────────────
// 4. THE REST OF THE CHAIN, at 8 px
// ─────────────────────────────────────────────────────────────────────

line('\n## 4. THE REST OF THE CHAIN');
{
    const l89DoorIdx = worldFor(91).teleporters.findIndex((t) => t.to === 89);
    const l89Door = worldFor(91).teleporters[l89DoorIdx];
    const l91 = from(91, 248, 72, { lattice: 8, allowTeleporter: l89DoorIdx });
    const dt = { tx: Math.floor(l89Door.x / TILE_SIZE), ty: Math.floor(l89Door.y / TILE_SIZE) };
    claim(touches(l91, dt.tx, dt.ty),
        `L91 from the L92 arrival (248,72): ${l91.seen.size} cells, L89 door@`
        + `${l89Door.x},${l89Door.y} reached: ${touches(l91, dt.tx, dt.ty)}`);

    const l89 = from(89, 216, 24, { lattice: 8 });
    const got = feathersReachable(l89);
    claim(got.ok,
        `L89 from the L91 door (216,24): ${l89.seen.size} cells; the feather's legal `
        + `approach step(s): ${got.legal.join(' ') || 'NONE'}`,
        'both are DESCENDING steps into the pocket, which is what §16.10 said the '
        + 'geometry allows and what the shut arm of `climbsArmedWaterfall` proved is '
        + 'the only direction.');

    // ⛔ AND THE CONTROL FOR IT: the same question from the L87 door, which
    // is the door the walk could otherwise have used, and where the harvest
    // rule alone would have said YES.
    const below = from(89, 280, 248, { lattice: 8 });
    const belowGot = feathersReachable(below);
    claim(!belowGot.ok,
        `and NOT from the L87 door (280,248): ${below.seen.size} cells, `
        + `adjacent ${belowGot.adjacent.length}, legal ${belowGot.legal.length}`,
        'the featherless flood does not even REACH the cell under the pocket, so this '
        + 'arm fails adjacency before it fails the step — but the step test is what '
        + 'keeps the claim honest once the feather is held.');

    // ⚠ AND THE SAME PAIR AT ONE PIXEL, because this is the claim the whole
    // slice rests on and it is the one §16.10 got wrong at 16.
    for (const [label, px, py, want] of [
        ['the L91 door (216,24)', 216, 24, true],
        ['the L87 door (280,248)', 280, 248, false],
    ]) {
        const r = reach(89, { lattice: 1 });
        const seen = r.flood(px, py);
        const got = feathersReachable({ ...r, seen });
        claim(got.ok === want,
            `L89 at ONE PIXEL from ${label}: ${seen.size} positions, feather ${got.ok} `
            + `(inside ${got.inside}, legal steps ${got.legal.length})`,
            got.ok === want ? 'the pixel arm agrees with the 8 px arm'
                : '⛔ THE GRANULARITIES DISAGREE — believe the pixel one');
    }

    // ⛓ THE WAY OUT, and it is the earned chain's own witness.
    const out = from(89, 280, 248, { lattice: 8, inventory: withFeather });
    const outGot = feathersReachable(out);
    claim(outGot.legal.length > belowGot.legal.length,
        `with the feather HELD the same flood reaches ${out.seen.size} cells and the `
        + `pocket has ${outGot.legal.length} legal steps in (was ${belowGot.legal.length})`,
        '⛓ so the feather is what opens its own pocket from below — the walk descends '
        + 'to take it and can climb back out through the waterfall it came down.');
}

if (MAPS) {
    line('\n## the 8 px free maps (\'.\' free)');
    for (const level of [87, 92, 91, 89]) {
        const r = reach(level, { lattice: 8 });
        line(`\n   L${level} ${r.world.width}x${r.world.height} tiles`);
        for (let cy = 0; cy < r.world.height * r.cells; cy += 1) {
            let row = `   ${String(cy).padStart(3)} `;
            for (let cx = 0; cx < r.world.width * r.cells; cx += 1) row += r.free(cx, cy) ? '.' : '#';
            line(row);
        }
    }
}

line(`\n${failures === 0 ? '✅ every claim above held' : `⛔ ${failures} claim(s) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
