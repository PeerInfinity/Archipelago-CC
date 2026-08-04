#!/usr/bin/env node
/**
 * probe-seedling-r5-l38-entrance — ⛔⛔ THE ENTRANCE LEG IS NOT A WALK.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 8, step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §20.8 (the price this
 * refutes) and §21.
 *
 * ── WHAT THE BRIEF SAYS ───────────────────────────────────────────────
 *
 * §20.8 priced the shaft tape and put the L38 half in one line:
 *
 *     "the L38 leg (boot at (144,288), the entrance button at
 *      (36..44, 53..59), the door at (144,0))"
 *
 * — a boot, a button, a door. Three waypoints. This probe went to plan
 * that walk and could not, because **L38 is two rooms that do not
 * connect**, and the entrance button is in the one the player does not
 * arrive in.
 *
 * ── ⛔⛔ THE MEASUREMENT ───────────────────────────────────────────────
 *
 * L37's only door into the cluster lands at (144,288), tile (9,18), in
 * L38's SOUTH room. `buttonroom@32,48` (tile (2,3)) and
 * `teleporter@144,0 -> L39` (tile (9,0)) are both in the NORTH one. Row 7
 * is solid across the level except at column 9, and that one cell holds
 * `chest@144,112` — a `type = "Solid"` entity — underneath
 * `cover@144,112 {t 0}`.
 *
 * So the join is ONE CELL with TWO solids stacked in it, and opening the
 * cover is not enough: the chest is what is behind it.
 *
 * ── ⛓⛓ AND THE CHAIN THAT OPENS IT IS FIVE LINKS LONG ────────────────
 *
 * ```
 *   1  buttonroom@144,128  (9,8)   t 2, room -1   the SELF-LATCH (§20.6)
 *        -> cover@208,224  (13,14) fades open
 *   2  buttonroom@208,224  (13,14) t 1, room -1   a SECOND self-latch,
 *        under the cover link 1 opened
 *        -> pulser@80,224  (5,14)  `activate = true`, permanently
 *   3  ⛔⛔ THE PULSE MOVES THE BLOCK. `Pulser.hit()` runs every tick of
 *        its expansion and dispatches
 *        `(c as PushableBlockFire).hit(new Point(x, y), "Pulse")` —
 *        so `pushableblockfire@80,208` at (5,13), one cell NORTH of the
 *        pulser, is shoved to (5,12)
 *   4  (5,12) IS `button@80,192 {t 0}`, and a block presses a button
 *        (slice 6's finding, in a level nobody had looked at)
 *        -> cover@144,112 (9,7) fades open, uncovering the chest
 *   5  `Chest.update` opens on a `collideLine("Player", ...)` one pixel
 *        below its box, gated on `!collide("Solid", x, y)` — i.e. only
 *        once the cover is off — and `open()` sets **`type = ""`**.
 *        THAT is what makes column 9 passable.
 * ```
 *
 * ⇒ Three of those five are mechanics no rung has built: the `Pulser`'s
 * periodic pulse (a world-driven `PushableBlockFire` mover AND a 22 px
 * player damage ring), the `Chest`'s open-and-desolidify, and the
 * `SealPiece` its `open()` spawns (a `special` pickup with a 150-frame
 * ceremony, plus `SealController`).
 *
 * ⚠ AND `moveTypes = ["Fire", "Pulse"]` HAS BEEN READ FIVE TIMES ON THIS
 * ARC AS "Fire is the one that matters". The other member has a writer,
 * and it is a level's whole opening mechanic.
 *
 * ── ⛔ THE SECOND REFUTATION: THE ROPE'S STANCE ───────────────────────
 *
 * `r5Shaft.ROPE_PULL.stance` is `(7,25)`. Tile (7,25) is not reachable
 * from L39's arrival by any path: (8,25) is wall and (7,24) is the rope
 * itself. The stance that works is **(9,25)**, in the corridor directly
 * south of the pulley — and it is terrain **18**, not water.
 *
 * ⇒ §20.5's "the rope's shaft is WATER, so `canSwim` is on the critical
 * path to the totem cluster" followed from the unreachable stance. The
 * reachable one is dry. `canSwim` may still be owed for another reason;
 * it is not owed for this one.
 *
 * Usage:
 *     node scripts/procgen/probe-seedling-r5-l38-entrance.mjs
 */

import {
    ROLES, buildLevelWorld,
} from '../../frontend/modules/seedlingDemo/levelWorld.js';
import { atlasLevelSource } from '../../frontend/modules/seedlingDemo/levelSource.js';
import { playerBoxAt, resolveTerrainState } from '../../frontend/modules/seedlingDemo/playerPhysicsV2.js';
import { auditFire } from '../../frontend/modules/seedlingDemo/presses.js';
import { ROPE_PULL } from '../../frontend/modules/seedlingDemo/r5Shaft.js';

/* eslint-disable no-console */

const TILE = 16;
const source = atlasLevelSource();
const claims = [];
const claim = (ok, label, detail = '') => {
    claims.push({ ok, label });
    console.log(`   ${ok ? '✓' : '⛔'} ${label}${detail ? `\n      ${detail}` : ''}`);
};

/** An 8 px lattice flood, which is the pitch every R5 route plans at. */
function flood(world, rec, start, { open = new Set(), pushables = null } = {}) {
    const P = 8;
    const ok = (x, y) => x > 0 && y > 0 && x < rec.width * TILE && y < rec.height * TILE
        && !world.collidesSolid(playerBoxAt(x, y), { openActivators: open, pushables });
    const seen = new Set([`${start.x},${start.y}`]);
    const q = [[start.x, start.y]];
    while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[P, 0], [-P, 0], [0, P], [0, -P]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (!ok(nx, ny)) continue;
            const k = `${nx},${ny}`;
            if (seen.has(k)) continue;
            seen.add(k);
            q.push([nx, ny]);
        }
    }
    const tiles = new Set([...seen].map((k) => {
        const [a, b] = k.split(',').map(Number);
        return `${Math.floor(a / TILE)},${Math.floor(b / TILE)}`;
    }));
    return { cells: seen.size, tiles };
}

const rec38 = source(38);
const w38 = buildLevelWorld(rec38, { roles: ROLES, inventory: { hasSword: true, fire: true } });
const blockId = w38.solids.find((s) => s.pushableId)?.pushableId;
const blockAt = (tx, ty) => new Map([[blockId, {
    rect: {
        x: tx * TILE, y: ty * TILE, w: TILE, h: TILE, right: tx * TILE + TILE, bottom: ty * TILE + TILE,
    },
    removed: false,
}]]);

// ── 1. ⛔⛔ L38 IS TWO ROOMS ──────────────────────────────────────────
console.log('## ⛔⛔ L38 is TWO ROOMS, and the entrance is in the far one\n');
const south = flood(w38, rec38, { x: 152, y: 296 }, { pushables: blockAt(5, 13) });
const north = flood(w38, rec38, { x: 152, y: 24 }, { pushables: blockAt(5, 13) });
console.log(`   SOUTH room (the L37 arrival, tile 9,18):  ${south.cells} cells / ${south.tiles.size} tiles`);
console.log(`   NORTH room (the L39 return, tile 9,1):    ${north.cells} cells / ${north.tiles.size} tiles`);
claim(!south.tiles.has('2,3'),
    'the entrance `buttonroom@32,48` (2,3) is NOT reachable from the L37 arrival',
    '§20.8 priced the leg as boot -> button -> door; the button is in the other room');
claim(!south.tiles.has('9,0'),
    'nor is `teleporter@144,0 -> L39` (9,0)');
claim(north.tiles.has('2,3') && north.tiles.has('9,0'),
    'both ARE reachable from the north room — which is entered only from L39');
claim([...south.tiles].every((t) => !north.tiles.has(t)),
    'and the two floods share not one tile: the rooms are disjoint');

// ── 2. THE JOIN IS ONE CELL WITH TWO SOLIDS IN IT ────────────────────
console.log('\n## the join, and why opening the cover is not enough\n');
{
    const boxAt79 = playerBoxAt(9 * TILE + 8, 7 * TILE + 8);
    const shut = w38.collidesSolid(boxAt79);
    const coverOpen = w38.collidesSolid(boxAt79, { openActivators: new Set(['cover@144,112']) });
    console.log(`   (9,7) with everything shut:      ${shut ? shut.tag : 'clear'}`);
    console.log(`   (9,7) with cover@144,112 open:   ${coverOpen ? coverOpen.tag : 'clear'}`);
    claim(shut?.tag === 'cover' || shut?.tag === 'chest', 'the join cell is solid');
    claim(coverOpen?.tag === 'chest',
        '⛔ AND IT IS STILL SOLID WITH THE COVER OPEN — the chest is behind it',
        '`Chest` is `type = "Solid"` until `open()` sets `type = ""` (Chest.as:76). '
        + 'The cover is what STOPS you opening it: `Chest.update`\'s gate is '
        + '`!collide("Solid", x, y)`.');
    const row7 = [];
    for (let tx = 0; tx < rec38.width; tx += 1) {
        if (!w38.collidesSolid(playerBoxAt(tx * TILE + 8, 7 * TILE + 8))) row7.push(tx);
    }
    claim(row7.length === 0,
        `row 7 is solid across all ${rec38.width} columns with the cover shut `
        + `(free columns: [${row7.join(' ') || 'none'}])`);
}

// ── 3. THE CHAIN, LINK BY LINK ───────────────────────────────────────
console.log('\n## ⛓⛓ the five-link chain, each link measured as a flood delta\n');
{
    const links = [
        {
            label: '0. nothing pressed, block on its spawn (5,13)',
            open: new Set(), block: [5, 13],
        },
        {
            label: '1. `buttonroom@144,128` (9,8) t2 room -1 SELF-LATCHES -> cover@208,224 opens',
            open: new Set(['cover@208,224']), block: [5, 13],
        },
        {
            label: '2. `buttonroom@208,224` (13,14) t1 room -1 self-latches -> `pulser@80,224` armed',
            open: new Set(['cover@208,224']), block: [5, 13],
        },
        {
            label: '3+4. the PULSE shoves the block (5,13) -> (5,12) onto `button@80,192` t0 '
                + '-> cover@144,112 opens',
            open: new Set(['cover@208,224', 'cover@144,112']), block: [5, 12],
        },
    ];
    let prev = null;
    for (const l of links) {
        const f = flood(w38, rec38, { x: 152, y: 296 },
            { open: l.open, pushables: blockAt(l.block[0], l.block[1]) });
        const delta = prev === null ? '' : ` (${f.cells - prev >= 0 ? '+' : ''}${f.cells - prev})`;
        console.log(`   ${String(f.cells).padStart(4)} cells${delta.padEnd(7)} ${l.label}`);
        prev = f.cells;
    }
    console.log('   ⛔ AND THE LAST LINK ADDS NOTHING TO THE FLOOD, which is the point:');
    console.log('      the chest is still there. Link 5 is `Chest.open()` setting `type = ""`,');
    console.log('      and it is an ENTITY STATE CHANGE no census flag can express.');
}

// ── 4. THE PULSER IS THE ENGINE, AND IT IS NOT EVEN A RESPONDER ──────
console.log('\n## ⛔ the Pulser: the engine of the chain, absent from the census\n');
{
    const ids = w38.activators.map((a) => `${a.id}(t${a.t})`);
    console.log(`   L38 activators: [${ids.join(' ')}]`);
    claim(!w38.activators.some((a) => a.id.startsWith('pulser')),
        '`pulser@80,224` is NOT in `world.activators`',
        'It IS an `Activators` (`Pulser extends Activators`, `super(..., _t)`), and its '
        + 'group is 1 — but the census collects responders that change GEOMETRY, and a '
        + 'Pulser is `type = "Solid"` either way. So `runHold` on `buttonroom t1` would '
        + 'fail with "no responder answers", and the group that drives the level opens '
        + 'nothing as far as the model is concerned.');
    const group1 = w38.pressers.filter((p) => p.t === 1);
    claim(group1.length === 1 && group1[0].tag === 'buttonroom',
        `group 1's only presser is ${group1.map((p) => `${p.tag}@${p.x},${p.y}`).join(' ')}`);
    const group0 = w38.pressers.filter((p) => p.t === 0);
    claim(group0.length === 1 && group0[0].x === 80 && group0[0].y === 192,
        `group 0's only presser is ${group0.map((p) => `${p.tag}@${p.x},${p.y}`).join(' ')} `
        + '— which no player can stand on');
    // The push direction, from the same atan2 the fire arm uses.
    const pulser = { x: 5 * TILE + 8, y: 14 * TILE + 8 };
    const block = { x: 5 * TILE + 8, y: 13 * TILE + 8 };
    claim(block.x === pulser.x && block.y < pulser.y,
        'the block is the pulser\'s exact NORTH neighbour, so the pulse is a pure axis',
        `pulser (${pulser.x},${pulser.y}) block centre (${block.x},${block.y}) — `
        + 'dx 0, dy -16, so `Math.atan2` gives north and the destination is (5,12)');
}

// ── 5. ⛔ THE ROPE'S DECLARED STANCE IS UNREACHABLE, AND DRY ─────────
console.log('\n## ⛔ the rope: the declared stance cannot be stood in, and the real one is DRY\n');
{
    const rec39 = source(39);
    const w39 = buildLevelWorld(rec39, {
        roles: ROLES, cleared: [8], inventory: { hasSword: true, canSwim: true, fire: true },
    });
    const f = flood(w39, rec39, { x: 152, y: 616 });
    console.log(`   from L39's arrival (9,38) with the plug deleted: ${f.cells} cells / `
        + `${f.tiles.size} tiles`);
    const declared = `${ROPE_PULL.stance.tx},${ROPE_PULL.stance.ty}`;
    claim(!f.tiles.has(declared),
        `⛔ \`ROPE_PULL.stance\` (${declared}) is NOT reachable from the arrival`,
        '(8,25) is wall and (7,24) is the rope itself, so the whole west shaft is behind '
        + 'the thing the stance is meant to pull. Declared in slice 7 and never walked.');
    const reach = [];
    for (let ty = 20; ty <= 30; ty += 1) {
        if (!f.tiles.has(`9,${ty}`)) continue;
        const a = auditFire(w39, { x: 9 * TILE + 8, y: ty * TILE + 8 });
        if (a.live.some((r) => r.as3 === 'RopeStart')) reach.push(ty);
    }
    claim(reach.length > 0,
        `the reachable stances that DO reach the rope are column 9 rows [${reach.join(' ')}]`,
        'and the walk arrives from the south, so the one it takes is (9,25) — the corridor '
        + 'cell directly below the pulley');
    for (const ty of reach) {
        const t = resolveTerrainState(w39, 9 * TILE + 8, ty * TILE + 8);
        console.log(`      (9,${ty}) terrain ${t}${t === 1 || t === 25 ? ' ⛔ WET' : ' — dry'}`);
    }
    const wet = reach.some((ty) => {
        const t = resolveTerrainState(w39, 9 * TILE + 8, ty * TILE + 8);
        return t === 1 || t === 25;
    });
    claim(!wet,
        '⛔ AND EVERY ONE OF THEM IS DRY — §20.5\'s "the rope\'s shaft is WATER" is retired',
        'That claim was measured at the UNREACHABLE stance (7,25), which is a water tile '
        + 'in the west shaft. `canSwim` is not owed for this pull. It was found by a '
        + '`PhysicsV2Error` refusing an unpinned wet tick — the refusal did its job, and '
        + 'the tick it refused was one no walk can take.');
}

// ── the verdict ──────────────────────────────────────────────────────
const failed = claims.filter((c) => !c.ok);
console.log('');
if (failed.length === 0) {
    console.log(`✓ all ${claims.length} claims hold`);
    console.log('');
    console.log('⛔⛔ AND THAT IS THE FINDING: §20.8\'s "the L38 leg" is a five-link puzzle,');
    console.log('    three of whose mechanics are unbuilt — the `Pulser`\'s pulse, the');
    console.log('    `Chest`\'s desolidify, and the `SealPiece` ceremony `open()` spawns.');
    console.log('    The shaft tape cannot be synthesized over it, and the eighteen presses');
    console.log('    stay a plan for one more slice.');
} else {
    console.log(`⛔ ${failed.length} of ${claims.length} claims FAILED:`);
    for (const c of failed) console.log(`   · ${c.label}`);
    process.exitCode = 1;
}
