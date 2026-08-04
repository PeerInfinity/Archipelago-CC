#!/usr/bin/env node
/**
 * probe-seedling-r5-totem-shaft — ⛔⛔ THE GATE BEHIND THE GATE, and the
 * weapon this arc has never fired.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 5, step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §17.7 (the recon this
 * continues) and §18 (what it found).
 *
 * ── WHERE §17.7 STOPPED ───────────────────────────────────────────────
 *
 * `probe-seedling-r5-totem-entrance` overturned the brief's "kill the 3
 * spinners" and ended on a table:
 *
 *      4 cells / 0 spinners   nothing cleared
 *     56 cells / 0 spinners   {39,8} — L38's ButtonRoom write
 *    688 cells / 3 spinners   ...and {39,9} — the rope
 *
 * and concluded that the rope was the second and last gate. **The 688
 * cells do not include the top of the room**, and the top of the room is
 * the entire errand: `totempart 2` at (72,40) and `teleporter@144,0 -> L40`,
 * which is the only way into L40, L41, L42 and L43 — the wand, and
 * therefore the Witch's darksword.
 *
 * ── WHAT THIS PROBE MEASURES ──────────────────────────────────────────
 *
 * 1. The fourth row of that table: what the three `WandLock`s in column 9
 *    are worth (**+44 cells**, and they are the only 44 that matter).
 * 2. That the shaft is the ONLY route to them — by flooding from the
 *    arrival with the locks forced open and with them shut.
 * 3. That the three locks cannot be opened in sequence: their buttons are
 *    under COVERS, the covers' own buttons are elsewhere, and
 *    `Lock.activationStep`'s restore is occupancy-guarded.
 * 4. That the game's three `PushableBlockFire`s are the intended holders,
 *    and that **no weapon this arc models can move one**.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-totem-shaft.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { nodeCentre, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { PRESS_ARM_POLICY } = await import(join(MODULE, 'presses.js'));
const {
    TOTEM_ENTRANCE, TOTEM_ROPE, TOTEM_SHAFT, GROUP_6,
} = await import(join(MODULE, 'r5Totem.js'));

const source = atlasLevelSource();
/** Everything R5 has earned by the time it reaches the totem path. */
const INVENTORY = Object.freeze({
    hasSword: true, canSwim: true, hasFeather: true, hasFire: true,
});
const LATTICE = 8;
const CELLS = TILE_SIZE / LATTICE;
const L39_ARRIVAL = Object.freeze({ x: 152, y: 616 });

let failures = 0;
const claim = (ok, what, detail) => {
    if (!ok) failures += 1;
    console.log(`   ${ok ? '✓' : '⛔'} ${what}`);
    if (detail) console.log(`      ${detail}`);
};

function reach(cleared, open = null) {
    const world = buildLevelWorld(source(39), {
        roles: ROLES, inventory: INVENTORY, ...(cleared ? { cleared } : {}),
    });
    const plan = {
        noclip: false, noHazards: [], avoidVolumes: true,
        lattice: LATTICE, nodeMargin: 0, inventory: INVENTORY,
        openActivators: open,
    };
    const free = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= world.width * CELLS || cy >= world.height * CELLS) {
            return false;
        }
        const c = nodeCentre(cx, cy, LATTICE);
        try { return plannerObstacleAt(world, c.x, c.y, null, plan) === null; } catch { return false; }
    };
    const seen = new Set();
    const stack = [[Math.floor(L39_ARRIVAL.x / LATTICE), Math.floor(L39_ARRIVAL.y / LATTICE)]];
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const k = `${x},${y}`;
        if (seen.has(k) || !free(x, y)) continue;
        seen.add(k);
        for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
            if (!seen.has(`${a},${b}`) && free(a, b)) stack.push([a, b]);
        }
    }
    const near = (px, py, r = 2) => {
        for (let dy = -r; dy <= r; dy += 1) {
            for (let dx = -r; dx <= r; dx += 1) {
                if (seen.has(`${Math.floor(px / LATTICE) + dx},${Math.floor(py / LATTICE) + dy}`)) {
                    return true;
                }
            }
        }
        return false;
    };
    return { world, seen, near };
}

const SHAFT_OPEN = new Set(TOTEM_SHAFT.locks.map((l) => l.id));
const WANTED = TOTEM_SHAFT.reaches.map((r) => ({ ...r }));

// ── 1. the fourth row of §17.7's table ────────────────────────────────
console.log('## 1. ⛔⛔ THE FOURTH ROW — what §17.7 measured, and the row it stopped one short of\n');
{
    const rows = [
        ['nothing cleared', null, null, TOTEM_ENTRANCE.cells.shut],
        ['{39,8} — the L38 button', [8], null, TOTEM_ENTRANCE.cells.buttonOnly],
        ['...and {39,9} — the rope', [8, 9], null, TOTEM_ENTRANCE.cells.andRope],
        ['...and the three WandLocks OPEN', [8, 9], SHAFT_OPEN, TOTEM_ENTRANCE.cells.andShaft],
    ];
    let last = null;
    for (const [label, cleared, open, expected] of rows) {
        const r = reach(cleared, open);
        const got = WANTED.map((wnt) => `${wnt.what}:${r.near(wnt.x + 8, wnt.y + 8) ? 'Y' : 'n'}`);
        console.log(`   ${String(r.seen.size).padStart(4)} cells  ${got.join(' ')}  ${label}`);
        claim(r.seen.size === expected,
            `   ...and the declaration says ${expected}`,
            r.seen.size === expected ? null
                : '⛔ the map or the model has moved under a committed number');
        last = r;
    }
    const got = WANTED.filter((wnt) => last.near(wnt.x + 8, wnt.y + 8));
    claim(got.length === WANTED.length,
        `only the last row reaches ${WANTED.map((w) => w.what).join(' and ')}`,
        '⇒ the rope is NOT the last gate. The 688 cells are the room; the 44 the locks '
        + 'are worth are the ERRAND — `totempart 2` and the one door into L40..L43.');
}

// ── 2. the shaft is the only route ────────────────────────────────────
console.log('\n## 2. THE SHAFT IS THE ONLY ROUTE, and it is one tile wide\n');
{
    const shut = reach([8, 9]);
    for (const wnt of WANTED) {
        claim(!shut.near(wnt.x + 8, wnt.y + 8),
            `${wnt.what} at (${wnt.x},${wnt.y}) tile (${wnt.tile.tx},${wnt.tile.ty}) is `
            + 'UNREACHABLE with the locks shut');
    }
    const w = shut.world;
    for (const l of TOTEM_SHAFT.locks) {
        const a = w.activators.find((x) => x.id === l.id);
        console.log(`   ${l.id} tile (${l.tile.tx},${l.tile.ty}) tSet ${a.t} tag ${a.persistTag}`);
    }
    const tx = new Set(TOTEM_SHAFT.locks.map((l) => l.tile.tx));
    claim(tx.size === 1 && [...tx][0] === 9,
        'all three stand in column 9 — the same column the arrival corridor climbs',
        'so they are passed in series, and there is no way round any of them');
}

// ── 3. ⛔ they cannot be opened in sequence ───────────────────────────
console.log('\n## 3. ⛔ THREE SIMULTANEOUS HOLDS, ONE PLAYER\n');
{
    console.log('   `Lock.activationStep` (Puzzlements/Lock.as:63-88):');
    console.log('       activate  -> alpha > 0 ? alpha -= 0.01 : turnOff()');
    console.log('       otherwise -> if (type == normType) alpha = 1');
    console.log('                    if (!collideTypes(hitables, x, y)) returnToNormal()');
    console.log('   ⇒ 101 ticks of a HELD group to open, and it restores the moment the');
    console.log('     group goes quiet unless something is standing in the lock itself.\n');
    const rec = source(39);
    const at = (type, t) => (rec.entities ?? []).find(
        (e) => e.type === type && Number(e.attrs?.tset) === t,
    );
    for (const p of TOTEM_SHAFT.pairs) {
        const cover = at('cover', p.cover.t);
        const lockButton = at('button', p.lockButton.t);
        const coverButton = at('button', p.coverButton.t);
        const stacked = cover.x === lockButton.x && cover.y === lockButton.y;
        console.log(`   button t${p.coverButton.t}@${coverButton.x},${coverButton.y} `
            + `opens cover t${p.cover.t}@${cover.x},${cover.y}, which lies on `
            + `button t${p.lockButton.t}@${lockButton.x},${lockButton.y} -> ${p.opens}`);
        claim(stacked, `   the lock-button really is UNDER the cover`,
            stacked ? null : 'the pairing this room is built on has moved');
    }
    claim(TOTEM_SHAFT.pairs.length === 3,
        'so the room is SIX presses, not three, and three of them must be held at once',
        'the locks are vertically adjacent and every button is five to seven tiles away, '
        + 'so stepping off one to reach the next closes the first. A player is one holder.');
}

// ── 4. ⛔⛔ the holders, and the weapon that is not modelled ──────────
console.log('\n## 4. ⛔⛔ THE HOLDERS ARE BLOCKS, AND NO MODELLED WEAPON MOVES ONE\n');
{
    const rec = source(39);
    const blocks = (rec.entities ?? []).filter((e) => e.type === 'pushableblockfire');
    console.log(`   L39 holds ${blocks.length} PushableBlockFire(s): `
        + blocks.map((b) => `(${b.x},${b.y})`).join(' '));
    claim(blocks.length === TOTEM_SHAFT.pairs.length,
        `${blocks.length} blocks for ${TOTEM_SHAFT.pairs.length} lock-buttons — the count `
        + 'is the intended solution',
        '`pressedGroups`\' own docblock has said since R2 that the game\'s `hitables` is '
        + '["Player", "Enemy", "Solid"] and that "a pushed block holds a button down too '
        + '— and that is the intended solution to more than one room". This is that room.');

    const policy = PRESS_ARM_POLICY.PushableBlockFire;
    console.log(`\n   PRESS_ARM_POLICY.PushableBlockFire = ${policy.policy}`);
    console.log(`      ${policy.why}`);
    claim(policy.policy === 'inert',
        'and it is RIGHT — for a sword',
        '`Player.as:921` passes "Sword" (or "Spear" with the ghostsword) and '
        + '`PushableBlockFire.moveTypes` is ["Fire", "Pulse"], so `hit()`\'s `cont` loop '
        + 'never matches. The R2 classification is not wrong; it is answering a different '
        + 'question from the one this route asks.');

    console.log(`\n   ⛔ the weapon that DOES move one: ${TOTEM_SHAFT.blockedBy.mechanic}`);
    console.log(`      ${TOTEM_SHAFT.blockedBy.as3}`);
    console.log(`      ${TOTEM_SHAFT.blockedBy.target}`);
    console.log('      and what it costs beyond the transcription:');
    for (const n of TOTEM_SHAFT.blockedBy.alsoNeeds) console.log(`        · ${n}`);
    console.log('\n   ⇒ slice 4 earned `fire` and §15 recorded that it "is never SPENT",');
    console.log('     because Karlore\'s plug is removed at `added()` time. THIS is where');
    console.log('     it is spent, as a weapon, for the first time on the arc — and it is');
    console.log('     the price of L40 (step 3), the wand (step 4) and the darksword');
    console.log('     (step 5), because all three are behind this one shaft.');
}

// ── 5. the two mechanics this step DID build ──────────────────────────
console.log('\n## 5. WHAT IS BUILT ANYWAY — the entrance and the rope\n');
{
    const w = buildLevelWorld(source(38), { roles: ROLES, inventory: INVENTORY });
    const p = w.pressers.find((q) => q.tag === 'buttonroom' && q.x === 32 && q.y === 48);
    claim(p?.room === 39 && p?.t === 8 && p?.flip === true,
        `the census now carries the cross-room fields: {t: ${p?.t}, tag: ${p?.persistTag}, `
        + `flip: ${p?.flip}, room: ${p?.room}}`,
        'so the press is a modelled write rather than a declared clear — two entries, '
        + `{39,8} and {38,4}, and the second is the button's own tag`);
    const shut = buildLevelWorld(source(39), { roles: ROLES, inventory: INVENTORY });
    const open = buildLevelWorld(source(39), { roles: ROLES, inventory: INVENTORY, cleared: [8] });
    claim(!!shut.solids.find((s) => s.tag === 'wandlock' && s.x === 144 && s.y === 592)
        && !open.solids.find((s) => s.tag === 'wandlock' && s.x === 144 && s.y === 592),
        'and the plug is BUILT without the flag and ABSENT with it');
    const rope = open.solids.find((s) => s.tag === 'rope');
    const pulled = buildLevelWorld(source(39), { roles: ROLES, inventory: INVENTORY, cleared: [8, 9] })
        .solids.find((s) => s.tag === 'rope');
    claim(rope.rect.w === 112 && pulled.rect.w === TILE_SIZE,
        `the rope is ${rope.rect.w} px of wall and SHRINKS to ${pulled.rect.w}, it does not `
        + 'despawn',
        `\`RopeStart.hit()\` runs setHitbox(16, 16, 8, 8) — ${TOTEM_ROPE.src}`);
    console.log('\n   group 6, member by member:');
    for (const m of GROUP_6) console.log(`      ${m.member.padEnd(18)} ${m.verdict} — ${m.why}`);
}

console.log(`\n${failures === 0 ? '✅ every claim above held' : `⛔ ${failures} claim(s) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
