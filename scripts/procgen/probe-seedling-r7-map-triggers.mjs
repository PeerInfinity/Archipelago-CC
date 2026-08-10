#!/usr/bin/env node
/**
 * THE MAP-MODIFYING TRIGGER CENSUS — what changes the map at RUN TIME, and
 * which of those changes a rules row has to carry (R7 slice 4, ⚖ user).
 *
 * Rules v1's first pass treated a level as static geometry plus item gates. It
 * is not. The user's steer — *"there may be other triggered events that modify
 * the map"* — is right, and this is the enumeration, bounded by the mechanism
 * rather than by the example that prompted it.
 *
 * NINE CLASSES, swept from the fork's source (out of repo, so the citations are
 * the record) and censused from the committed extract where the extract can see
 * them:
 *
 *  A. ITEM-CONDITIONAL SELF-REMOVAL — an entity that deletes itself when the
 *     player holds something. `NPCs/Karlore.as:added()`, `hasFire`. **The only
 *     BLOCKING one in the game** (`BobBoss` shares the test but is an Enemy;
 *     `BossKey`/`BossTotemPart` are pickups). ✅ MODELLED (overlay row).
 *  B. CROSS-LEVEL PERSISTENCE — `ButtonRoom.as:93`,
 *     `Game.setPersistence(t, persist, room)`: a button in ONE room writes a
 *     persistence tag in ANOTHER. ⛔ NOT MODELLED. Censused below.
 *  C. DEATH-CREATED EXITS — `TentacleBeast.as:213` and
 *     `LightBossController.as:104` construct the room's only exit Teleporter
 *     when the boss dies. ✅ handled by the never-enter ruling (§6.1).
 *  D. CORPSES THAT ARE WALLS — `FinalBoss`, `BossTotem`, `TentacleBeast`,
 *     `IceTurret` all write `type = "Solid"` on death. Adds geometry, so it
 *     can only ever REMOVE reachability from a route the logic already allows
 *     — the safe direction. ⚠ And the IceTurret corpse is a TOOL, not just an
 *     obstacle: R7 §12.3's L40 route holds a button down with it.
 *  E. DROPPED ROCKS — `FallRock`/`FallRockLarge` go `type = ""` (parked at
 *     y = -16) to `"Solid"` where they land. Same safe direction.
 *  F. THE MOONROCK — `Moonrock.as:114` makes the set rock a 48x48 Solid that
 *     is not otherwise there (`Main.rockSet`), and `:135` writes
 *     `setPersistence(0, false, 2)` — a tag in LEVEL 2. ⛓ Nothing in L2
 *     carries tag 0, so that second write is INERT; banked so nobody
 *     re-derives it.
 *  G. TILE MUTATION — Igneous-to-Lava converts permanently (ruled DARK SUIT,
 *     §13.5); a Bridge opens on a "Spear" hit (already gated); `Tile.as:531`
 *     sets a neighbour Solid, which is the cave-mouth wall the semantics
 *     table already transcribes.
 *  H. RUNTIME PICKUPS — `Witch.as` adds the DarkSword, `BobBoss.as` adds Fire
 *     (both are ledger rows), and ⚠ `NPCs/Watcher.as` adds a **Seed** when the
 *     Watcher is killed: the game's SECOND ENDING. Rules v1 carries only the
 *     L115 Seed, so the alternate goal is unmodelled — named, not fixed.
 *  I. LIGHT — `LightPole` and friends toggle on persistence. No traversal
 *     effect this logic models.
 *
 * What this script CHECKS, because it is the class the extract can see and the
 * one that is missing from the rules: every cross-level ButtonRoom, resolved to
 * the entity that actually reads the tag it writes. A write nothing reads is
 * inert; a write a LOCK reads is a door in another room.
 *
 * Usage: node scripts/procgen/probe-seedling-r7-map-triggers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAP = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const levels = new Map(MAP.levels.map((l) => [l.level, l]));

/** Tags whose entity BLOCKS the player (Mobile.solids), per seedlingSemantics. */
const BLOCKING = new Set([
    'lock', 'wandlock', 'grasslock', 'rocklock', 'bosslock', 'magicallock',
    'magicallockfire', 'shieldlock', 'shieldlocknorm', 'cover', 'breakablerock',
    'breakablerockghost', 'burnabletree', 'chest', 'moonrock', 'fallrock',
    'fallrocklarge', 'pushableblock', 'pushableblockfire', 'pushableblockspear',
]);

const writers = [];
for (const level of MAP.levels) {
    for (const e of level.entities) {
        if (e.type !== 'buttonroom') continue;
        const room = Number(e.attrs?.room);
        if (!Number.isInteger(room) || room < 0) continue;
        writers.push({ from: level.level, x: e.x, y: e.y, tag: String(e.attrs.tset), to: room });
    }
}

const totalButtonRooms = MAP.levels
    .reduce((n, l) => n + l.entities.filter((e) => e.type === 'buttonroom').length, 0);

console.log('CLASS B — CROSS-LEVEL PERSISTENCE (ButtonRoom.as:93)');
console.log(`  buttonroom entities: ${totalButtonRooms}; writing into ANOTHER level: ${writers.length}`);
let traversal = 0;
for (const w of writers) {
    const dest = levels.get(w.to);
    const readers = (dest?.entities ?? []).filter((e) => String(e.attrs?.tag) === w.tag);
    console.log(`\n  L${w.from} buttonroom @${w.x},${w.y} (tset ${w.tag}) -> tag ${w.tag} in L${w.to}`);
    if (readers.length === 0) {
        console.log('    INERT — nothing in that level carries the tag');
        continue;
    }
    for (const r of readers) {
        const blocks = BLOCKING.has(r.type);
        if (blocks) traversal += 1;
        console.log(`    ${blocks ? '⛔ TRAVERSAL' : '   cosmetic '} ${r.type} @${r.x},${r.y} `
            + `${JSON.stringify(r.attrs)}`);
    }
}

console.log(`\n  ⇒ ${traversal} of ${writers.length} cross-level writes move a BLOCKING entity.`);
console.log('\n⛔ THE ONE THAT CHANGES A RULE: L38\'s button opens L39\'s `wandlock {tset -1, tag 8}`.');
console.log('   A tSet of -1 makes that lock a KILL-LOCK by `Lock.checkEnemies()`, and this');
console.log('   slice\'s overlay therefore gates every tSet -1 lock on a WEAPON. But `Lock.check()`');
console.log('   honours persistence whenever `tSet < 0` — so this one ALSO opens from a button in');
console.log('   another room, and the weapon rule is too STRICT for it. The honest rule is the');
console.log('   disjunction, and the button half is choreography (free under the puzzle policy).');
console.log('\n⚠ UNMODELLED AND NAMED: class H\'s second ending (`Watcher.as` drops a Seed when the');
console.log('   Watcher is killed). Rules v1 carries only the L115 Seed as the goal.');
process.exit(0);
