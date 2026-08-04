#!/usr/bin/env node
/**
 * probe-seedling-r5-totem-entrance — HOW L39 OPENS, and it is not the
 * spinners.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 5, step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §17.
 *
 * ── WHAT THE BRIEF SAYS, AND WHY IT CANNOT BE RIGHT ───────────────────
 *
 * Slice 5's brief prices the totem path's entrance as "L38 → L39, whose
 * corridor is plugged by wandlock tset -1 tag 8 — kill the 3 spinners".
 * Every noun in that sentence is real: the lock is at (144,592), its
 * `tSet` is -1 (which on a `Lock` means `totalEnemies() <= 0`), and L39
 * holds exactly three spinners.
 *
 * ⛔ AND THE ROUTE IS CIRCULAR. L38's door lands the player at tile (9,38)
 * — the BOTTOM of a 19x40 room — and the lock is at (9,37), the next tile
 * north, in a corridor one tile wide. The three spinners are at (7,5),
 * (14,7) and (14,13), thirty tiles up, on the FAR SIDE of the lock they
 * open. Measured, at the planner's own lattice: **4 cells reachable from
 * the arrival**, and not one of the three.
 *
 * ⛓ THE OPENER IS A BUTTON, IN ANOTHER ROOM. `L38`'s
 * `buttonroom@32,48 {tset: 8, tag: 4, flip: 1, room: 39}` —
 * `ButtonRoom.as:76-96`:
 *
 *     var persist:Boolean = _active;
 *     if (flip) persist = !persist;
 *     if (room == -1) { ...activate every Activator sharing `t`... }
 *     else Game.setPersistence(t, persist, room);
 *     //  persist = false, then things won't exist.
 *
 * With `flip` true and the button pressed, `persist` is FALSE and `t` is
 * the TSET (8, not the tag) — so the write is
 * `levelPersistence[39 * 30 + 8] = false`, and `Lock.check()` removes a
 * `tSet < 0` lock whose flag is off. **The plug is deleted at build time by
 * a button in the previous room**, which is the same shape R1 already met
 * from the other side: L38's arrival buttonroom writes into L37 and builds
 * a FallRock already fallen (`r1Walk.R1_PERSISTENCE_EFFECTS`).
 *
 * ⛔ AND THERE IS A SECOND GATE BEHIND IT. With the lock gone the corridor
 * opens to 56 cells and stops at `rope@96,384` (tag 9), tile (6,24).
 * `RopeStart` is `PRESS_ARM_POLICY`'s `refused` — it SHRINKS to a one-cell
 * solid rather than despawning, and writes persistence — so the rung owes
 * it an arm or a clear. With tag 9 off as well the room opens to **688
 * cells and all three spinners**.
 *
 * ⚠ So the spinners are not the entrance; they are what the entrance
 * REACHES. Their kill bill (9 plain-sword presses, `Spinner.removed()`
 * writing three persistence entries) is still owed — after the button and
 * the rope, not before.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-totem-entrance.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { nodeCentre, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));

const source = atlasLevelSource();
/** Everything R5 has earned by the time it reaches the totem path. */
const INVENTORY = Object.freeze({
    hasSword: true, canSwim: true, hasFeather: true, hasFire: true,
});
const LATTICE = 8;
const CELLS = TILE_SIZE / LATTICE;
/** The cluster, and the only door into it from outside. */
const CLUSTER = Object.freeze([39, 40, 41, 42, 43]);
const L39_ARRIVAL = Object.freeze({ x: 152, y: 616 });
const SPINNERS = Object.freeze([
    Object.freeze({ x: 112, y: 88 }), Object.freeze({ x: 224, y: 112 }),
    Object.freeze({ x: 224, y: 208 }),
]);

let failures = 0;
const claim = (ok, what, detail) => {
    if (!ok) failures += 1;
    console.log(`   ${ok ? '✓' : '⛔'} ${what}`);
    if (detail) console.log(`      ${detail}`);
};

function reach(level, cleared) {
    const world = buildLevelWorld(source(level), {
        roles: ROLES, inventory: INVENTORY, cleared,
    });
    const plan = {
        noclip: false, noHazards: [], avoidVolumes: true,
        lattice: LATTICE, nodeMargin: 0, inventory: INVENTORY,
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
    const near = (px, py, r = 3) => {
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

// ── 1. the cluster has exactly ONE door from outside ──────────────────
console.log('## 1. THE TOTEM CLUSTER, and the one door into it\n');
{
    const doors = [];
    for (let l = 0; l < 116; l += 1) {
        let rec;
        try { rec = source(l); } catch { continue; }
        for (const e of rec.entities ?? []) {
            if (e.type !== 'teleporter') continue;
            const to = Number(e.attrs?.to);
            if (!CLUSTER.includes(to)) continue;
            const px = Number(e.attrs.playerx) + 8;
            const py = Number(e.attrs.playery) + 8;
            doors.push({ from: l, to, px, py, outside: !CLUSTER.includes(l) });
        }
    }
    for (const d of doors) {
        console.log(`   ${d.outside ? '⇒' : ' '} L${d.from} → L${d.to} arriving (${d.px},${d.py}) `
            + `tile (${Math.floor(d.px / TILE_SIZE)},${Math.floor(d.py / TILE_SIZE)})`);
    }
    const outside = doors.filter((d) => d.outside);
    claim(outside.length === 1 && outside[0].from === 38 && outside[0].to === 39,
        `exactly ONE door from outside the cluster: ${outside.map((d) => `L${d.from}→L${d.to}`).join(', ')}`,
        'so whatever opens L39 opens the whole totem path, and nothing else can');
}

// ── 2. ⛔ THE ARRIVAL IS A FOUR-CELL POCKET ───────────────────────────
console.log('\n## 2. ⛔ THE ARRIVAL, AND THE LOCK ONE TILE NORTH OF IT\n');
const shut = reach(39, null);
{
    const lock = shut.world.solids.find((s) => s.tag === 'wandlock' && s.x === 144 && s.y === 592);
    claim(!!lock, `\`wandlock@144,592\` is built and SOLID at tile `
        + `(${Math.floor(144 / TILE_SIZE)},${Math.floor(592 / TILE_SIZE)}), one north of the `
        + `arrival at tile (${Math.floor(L39_ARRIVAL.x / TILE_SIZE)},`
        + `${Math.floor(L39_ARRIVAL.y / TILE_SIZE)})`);
    claim(shut.seen.size === 4,
        `${shut.seen.size} cells reachable from the arrival with nothing cleared`,
        'one tile of corridor, and the plug is the next one');
    const reached = SPINNERS.filter((s) => shut.near(s.x, s.y));
    claim(reached.length === 0,
        `and NONE of the three spinners is reachable (${reached.length}/3)`,
        '⛔ WHICH MAKES "kill the 3 spinners" CIRCULAR: `tSet -1` is '
        + '`totalEnemies() <= 0`, and the enemies it counts are on the far side of the '
        + 'lock they open. The brief\'s entrance is not an entrance.');
}

// ── 3. ⛓ THE OPENER IS A BUTTON IN L38 ───────────────────────────────
console.log('\n## 3. ⛓ THE OPENER IS `buttonroom@32,48`, IN L38\n');
{
    const rec = source(38);
    const button = (rec.entities ?? []).find((e) => e.type === 'buttonroom'
        && Number(e.attrs?.room) === 39);
    claim(!!button,
        `L38 holds ${button ? `\`buttonroom@${button.x},${button.y}\` `
            + `{tset: ${button.attrs.tset}, tag: ${button.attrs.tag}, `
            + `flip: ${button.attrs.flip}, room: ${button.attrs.room}}` : 'NO buttonroom naming L39'}`,
        '`ButtonRoom.as:87-93`: `persist = flip ? !_active : _active`, then '
        + '`Game.setPersistence(t, persist, room)` — `t` is the TSET, not the tag, and '
        + 'the comment is "persist = false, then things won\'t exist"');
    claim(!!button && Number(button.attrs.tset) === 8 && Number(button.attrs.flip) === 1,
        'its tset is 8 — the wandlock\'s tag — and `flip` is 1, so a press writes FALSE',
        'the same shape R1 already met from the other side: L38\'s ARRIVAL buttonroom '
        + 'writes into L37 and builds a FallRock already fallen '
        + '(`r1Walk.R1_PERSISTENCE_EFFECTS`), which is the one persistence EFFECT the '
        + 'ladder has priced so far');
}

// ── 4. what each clear opens, measured ────────────────────────────────
console.log('\n## 4. WHAT EACH GATE OPENS, from the arrival\n');
{
    const rows = [
        ['nothing cleared', null],
        ['{39,8} — the L38 button\'s write', [8]],
        ['...and {39,9} — the rope', [8, 9]],
    ];
    let last = null;
    for (const [label, cleared] of rows) {
        const r = reach(39, cleared);
        const spun = SPINNERS.filter((s) => r.near(s.x, s.y)).length;
        console.log(`   ${String(r.seen.size).padStart(4)} cells  ${spun}/3 spinners  ${label}`);
        last = { r, spun };
    }
    claim(last.spun === 3 && last.r.seen.size > 600,
        'both gates together reach all three spinners',
        '⇒ the spinners are not the ENTRANCE, they are what the entrance REACHES — and '
        + 'their bill (9 plain-sword presses; `Spinner.removed()` writes persistence per '
        + 'kill) is owed AFTER the button and the rope, not before.');
    const rope = shut.world.solids.find((s) => s.tag === 'rope');
    claim(!!rope,
        `the second gate is \`rope@${rope?.x},${rope?.y}\`, tile `
        + `(${Math.floor((rope?.x ?? 0) / TILE_SIZE)},${Math.floor((rope?.y ?? 0) / TILE_SIZE)})`,
        '⛔ `RopeStart` is `presses.PRESS_ARM_POLICY`\'s `refused` — it SHRINKS to a '
        + 'one-cell solid rather than despawning, and writes persistence. So the rung '
        + 'owes it an ARM (the seventh) or a clear, and this probe is where that debt is '
        + 'named rather than discovered mid-route.');
}

console.log(`\n${failures === 0 ? '✅ every claim above held' : `⛔ ${failures} claim(s) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
