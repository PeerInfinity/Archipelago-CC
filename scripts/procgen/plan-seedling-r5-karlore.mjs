#!/usr/bin/env node
/**
 * plan-seedling-r5-karlore — THE RUNG'S HEADLINE PAIR.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 4, step 3. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §2.6.2 and §4 slice 4.
 *
 * ── WHY THIS IS THE HEADLINE AND THE BOSS FIGHT IS NOT ────────────────
 * `fire` is the first COMBAT-EARNED boolean on the whole arc, and step 2
 * proves it was earned. This proves it does something — and it is the
 * cleanest shape on the ladder for that, because `fire` is never SPENT
 * here. It is simply HELD, and L48 builds differently:
 *
 *     override public function added():void {
 *         super.added();
 *         if (Player.hasFire) FP.world.remove(this);
 *     }
 *
 * `NPC`'s ctor sets `type = "Solid"` and Karlore's own `setHitbox(16,16,8,8)`
 * makes that a whole tile — [112,128) x [272,288), which is the ONE-TILE
 * corridor north out of L48's arrival. No kill, no talk, no ceremony: the
 * plug is either there or it is not, and the item decides which.
 *
 * ── THE PAIR, ONE FIELD APART ─────────────────────────────────────────
 * Two tapes identical in every field but `grants`:
 *
 *   r5-karlore-plug   grants []       — Karlore is built, the walk PINS with
 *                                       its box top flush against y = 288
 *   r5-karlore-fire   grants [fire]   — `added()` removed him, and the same
 *                                       28-tick hold walks through
 *
 * ⚠ AND THE GRANT IS A PROBE GRANT, NAMED AS ONE — the `l71-shieldlock`
 * precedent. Step 2's `r5-bobboss-fire` EARNS the boolean; this pair GRANTS
 * it, because the question here is what the boolean does to L48's geometry
 * and not where it came from. Two claims, two fixtures, and the chain is
 * what joins them.
 *
 * ⚠ THE HOLD IS RIGHT, NOT GENEROUS — §14.10 applied BEFORE the recording.
 * The control's hold is stopped by a Solid, so its length does not matter;
 * the fire arm's is stopped by nothing until row 14, which is WATER. 28
 * ticks lands the fire arm at y ≈ 260.8, inside row 16 and two rows short
 * of a hazard this walk cannot survive. Modelled against a world with the
 * karlore entity filtered out — which is exactly the world `added()` leaves.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-karlore.mjs            # plan + report
 *   node scripts/procgen/plan-seedling-r5-karlore.mjs --write    # write the tapes
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { playerBoxAt, resolveTerrainState } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { synthesizeLegs } = await import(join(MODULE, 'botDriverV2.js'));
const { serializeTape, parseTape, HAZARD_STATES } = await import(join(MODULE, 'tapeFormat.js'));
const { assertWindowEndsAtRest } = await import(join(MODULE, 'director.js'));
const { KARLORE, CONCH, KEY_LEG } = await import(join(MODULE, 'r5Chain.js'));

const WRITE = process.argv.includes('--write');
const source = atlasLevelSource();

// The two worlds the two arms really run in. The fire arm's is the level
// with the karlore entity gone, because that is what `added()` leaves —
// modelled by filtering the RECORD rather than by patching the built world,
// so the build path is identical for both arms.
const fireSource = (n) => {
    const rec = source(n);
    return n === KARLORE.level
        ? { ...rec, entities: rec.entities.filter((e) => e.type !== 'karlore') }
        : rec;
};

// ── 1. the plug, confirmed against the extract ────────────────────────
const world = buildLevelWorld(source(KARLORE.level), { roles: ROLES });
const plug = world.solids.find((s) => s.tag === 'karlore');
if (!plug) throw new Error(`L${KARLORE.level} has no karlore solid`);
console.log(`## L${KARLORE.level} — the plug`);
console.log(`   karlore@${KARLORE.at.x},${KARLORE.at.y} Solid ${JSON.stringify(plug.rect)} `
    + `= tile (${KARLORE.tile.tx},${KARLORE.tile.ty})`);
console.log(`   the arrival is (${KARLORE.arrival.x},${KARLORE.arrival.y}), two rows south`);

// ⛓ THE PLUG REALLY SEALS, asked as a FLOOD rather than as a look at its
// two neighbours.
//
// ⚠ The neighbour test is the wrong question and it says so out loud: tile
// (8,17) beside the plug is OPEN. What makes the corridor one tile wide is
// that (8,18) is SOLID, so the only way into (8,17) is a diagonal through
// the corner at (128,288) — and a 4x5 player box centred there overlaps
// BOTH the plug and (8,18). A pair justified by "its neighbours are walls"
// would have been justified by a false statement that happened to have the
// right conclusion.
const floodFrom = (w, start) => {
    const seen = new Set();
    const q = [start];
    while (q.length) {
        const [x, y] = q.pop();
        const k = `${x},${y}`;
        if (seen.has(k) || x < 0 || y < 0 || x >= w.width || y >= w.height) continue;
        if (w.collidesSolid(playerBoxAt(x * TILE_SIZE + 8, y * TILE_SIZE + 8))) continue;
        seen.add(k);
        q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return seen;
};
const start = [KARLORE.tile.tx, KARLORE.tile.ty + 1];
const beyond = `${KARLORE.tile.tx},${KARLORE.throughRow}`;
const pluggedReach = floodFrom(world, start);
const fireWorld = buildLevelWorld(fireSource(KARLORE.level), { roles: ROLES });
const openReach = floodFrom(fireWorld, start);
console.log(`   with the plug: ${pluggedReach.size} tiles reachable from `
    + `(${start.join(',')}); without it: ${openReach.size}`);
console.log(`   tile (${beyond}) — ${pluggedReach.has(beyond) ? '⛔ REACHABLE ANYWAY' : 'SEALED'}`
    + ` / ${openReach.has(beyond) ? 'reachable once fire is held' : '⛔ STILL SEALED'}`);
if (pluggedReach.has(beyond)) {
    throw new Error(`tile (${beyond}) is reachable with the plug in place, so this pair `
        + 'measures a detour rather than a plug');
}
if (!openReach.has(beyond)) {
    throw new Error(`tile (${beyond}) is unreachable even with karlore removed, so the `
        + 'fire arm cannot get there and the hold is aimed at nothing');
}

// ⛔ AND THE HAZARD TWO ROWS PAST IT, which is what makes the hold's length
// a decision rather than a default.
const waterRow = KARLORE.throughRow - 2;
const waterState = resolveTerrainState(world, KARLORE.tile.tx * TILE_SIZE + 8,
    waterRow * TILE_SIZE + 8, 0, {});
console.log(`   ⚠ tile (${KARLORE.tile.tx},${waterRow}) is terrain state ${waterState}`
    + `${waterState === HAZARD_STATES.water ? ' — WATER, and this walk holds no conch' : ''}`);
if (waterState !== HAZARD_STATES.water) {
    throw new Error(`the hold's length was chosen because row ${waterRow} is water and it `
        + `resolves to ${waterState}. Re-derive the hold.`);
}

// ── 2. the two arms ───────────────────────────────────────────────────
//
// ⛔ THE FIRE ARM ENTERS L48 THROUGH L47'S DOOR, and the first attempt at
// this pair is why. Both tapes booted straight into L48 with
// `grants: [{level: 48, items: ['fire']}]`, and BOTH ARMS PINNED at
// y = 290.25 — byte-identical, 53 observations each. `Karlore.added()` runs
// inside `new Game(48, ...)`; a boot grant is applied AFTERWARDS. So a
// grant naming the level it boots into cannot reach any `added()` in that
// level, and §2.6.2's "hold fire BEFORE entering" turns out to mean it
// literally: a boot is not an entry.
//
// The route is therefore two legs — walk into L47's `teleporter@216,112`
// with the grant already banked, then hold north in L48 — and the CONTROL
// arm is the fire arm's own inputs with `grants` emptied, which keeps the
// pair one field apart through a plan only one of them could have produced.
const synth = synthesizeLegs([
    { level: KARLORE.entryFrom.level, targets: [], exit: { ...KARLORE.entryFrom.teleporter } },
    { level: KARLORE.level, targets: [{ x: KARLORE.arrival.x, y: KARLORE.throughY }] },
], {
    levelSource: fireSource,
    boot: { ...KARLORE.boot },
    name: 'r5-karlore-fire',
    lattice: 16,
    nodeMargin: 0,
    allowGrazes: true,
    relax: {
        noclip: false,
        noDamage: true,
        noHazards: [...KEY_LEG.noHazards],
        grants: [{ level: KARLORE.entryFrom.level, items: ['fire'] }],
        persistence: [],
    },
});
const shared = {
    game: 'seedling',
    tape_version: 5,
    boot: { ...KARLORE.boot },
    noclip: false,
    noDamage: true,
    noHazards: [...KEY_LEG.noHazards],
    persistence: [],
    equips: [],
    pins: [...KEY_LEG.pins],
    inputs: synth.tape.inputs.map((s2) => ({ ...s2 })),
    tick_count: synth.tape.tick_count + KEY_LEG.coastTicks,
};
const control = {
    ...shared,
    name: 'r5-karlore-plug',
    grants: [],
    description: 'THE HEADLINE PAIR, arm 1 of 2 — `fire` WITHHELD. Identical to '
        + '`r5-karlore-fire` in every field but `grants` — the plan is the FIRE arm\'s, and '
        + 'this arm simply runs it without the item. `Karlore.added()` removes '
        + 'himself only `if (Player.hasFire)`, so with the boolean false the NPC is '
        + 'built, `NPC`\'s constructor gives him `type = "Solid"` and his own '
        + '`setHitbox(16,16,8,8)` fills tile (7,17) — and a flood from the arrival reaches '
        + 'TWO tiles with him there against 138 without. The walk PINS with its box top '
        + 'flush against y = 288. Without this arm, "the fire arm walked north" is not '
        + 'evidence that anything was ever in the way.',
};
// ⛔ THE GRANT NAMES L47, AND `synthesizeLegs` WOULD HAVE NAMED L48.
//
// The driver emits the grant against the level its RUN first banked the
// item in, which for a two-leg plan is the second one — and a grant naming
// L48 fires on the first observation whose level is 48, i.e. AFTER
// `new Game(48, ...)` has already built Karlore. That is the same failure
// as the boot-grant one, one level further along, and it produced the same
// symptom: both arms pinned at y = 290.05, byte-identical, 62 observations.
//
// A grant naming L47 fires at tick 0 — the boot level IS 47 — so the item
// is banked thirteen ticks before the door.
const fire = {
    ...shared,
    name: 'r5-karlore-fire',
    grants: [{ level: KARLORE.entryFrom.level, items: ['fire'] }],
    description: 'THE HEADLINE PAIR, arm 2 of 2 — `fire` HELD, and it is the first '
        + 'combat-earned boolean on the arc doing something. `fire` is never SPENT here: '
        + '`Karlore.added()` reads `Player.hasFire` at LEVEL BUILD time and removes the '
        + 'NPC, so the plug is simply absent and the same 28-tick hold walks through '
        + 'tile (7,17) into row 16. ⚠ The grant is a PROBE grant (the `l71-shieldlock` '
        + 'precedent): `r5-bobboss-fire` is where the boolean is EARNED, and this is '
        + 'where it is spent. ⛔ And it ENTERS THROUGH L47: `Karlore.added()` runs inside '
        + '`new Game(48, ...)` and a boot grant is applied afterwards, so a tape that '
        + 'booted into L48 holding fire found the plug still there — both arms pinned at '
        + 'y = 290.25, byte-identical. ⚠ The walk also stops in row 16 rather than going '
        + 'on: row 14 is WATER and this walk holds no conch, so a target chosen for '
        + 'generosity would have drowned the headline (§14.10, applied before the '
        + 'recording instead of after it).',
};
for (const t of [control, fire]) {
    const rest = assertWindowEndsAtRest(t);
    if (rest.length > 0) throw new Error(`${t.name} not at rest:\n  ${rest.join('\n  ')}`);
    parseTape(serializeTape(t));
}

const controlRun = runTape(control, { levelSource: source });
const fireRun = runTape(fire, { levelSource: fireSource });
const cEnd = controlRun.ticks.at(-1);
const fEnd = fireRun.ticks.at(-1);
console.log(`\n## the pair — ONE FIELD APART (\`grants\`)`);
console.log(`   ${shared.inputs.length} span(s), ${shared.tick_count} ticks, `
    + `crossing ${JSON.stringify(synth.transitions)}`);
console.log(`   control  modelled end (${cEnd.x},${cEnd.y.toFixed(2)}) — box top `
    + `${(cEnd.y - 2).toFixed(2)} against the plug's face at ${plug.rect.bottom}`);
console.log(`   fire     modelled end (${fEnd.x},${fEnd.y.toFixed(2)}) — row `
    + `${Math.floor(fEnd.y / TILE_SIZE)}, and the water is row ${waterRow}`);
if (fEnd.level !== KARLORE.level || cEnd.level !== KARLORE.level) {
    throw new Error(`an arm did not end in L${KARLORE.level}: fire L${fEnd.level}, `
        + `control L${cEnd.level}`);
}
if (Math.floor(fEnd.y / TILE_SIZE) !== KARLORE.throughRow) {
    throw new Error(`the fire arm's hold lands it in row ${Math.floor(fEnd.y / TILE_SIZE)}, `
        + `not the declared ${KARLORE.throughRow}`);
}
if (cEnd.y - 2 < plug.rect.bottom || cEnd.y - 2 >= plug.rect.bottom + 1) {
    throw new Error(`the control arm's box top is ${cEnd.y - 2}, which is not a pin on `
        + `${plug.rect.bottom}`);
}

// ⚠ The fire arm's model is the world WITHOUT karlore, which is a world
// `buildLevelWorld` cannot produce from the extract — it has no idea an
// NPC's `added()` reads an item property. So this arm is a declared
// divergence (`r5Chain.MODEL_EXEMPT`), and modelling `added()`-time removal
// is the owed follow-up rather than something this slice invented a hook for.
const naive = runTape(fire, { levelSource: source });
console.log(`   ⚠ the SHIPPED model (which does not know about \`added()\`) puts the fire `
    + `arm at (${naive.ticks.at(-1).x},${naive.ticks.at(-1).y.toFixed(2)}) — a pin, like `
    + 'the control. That is the declared divergence, not a defect.');

// ── 3. what is downstream, stated so the slice's gap is legible ───────
console.log(`\n## downstream of the plug`);
console.log(`   L${KARLORE.level} pit (${CONCH.pit.tx},${CONCH.pit.ty}) -> `
    + `L${CONCH.level}, where \`${CONCH.item}@${CONCH.pickup.x},${CONCH.pickup.y}\` `
    + `(tag ${CONCH.tag}) grants \`${CONCH.property}\``);
const l48Pit = world.pitTiles.find((p) => p.tx === CONCH.pit.tx && p.ty === CONCH.pit.ty);
if (!l48Pit) throw new Error(`L48 has no pit tile at (${CONCH.pit.tx},${CONCH.pit.ty})`);
if (world.fallthrough.level !== CONCH.level) {
    throw new Error(`L48's fallthrough is L${world.fallthrough.level}, not L${CONCH.level}`);
}
const conchWorld = buildLevelWorld(source(CONCH.level), { roles: ROLES });
const conch = conchWorld.pickups.find((p) => p.x === CONCH.pickup.x && p.y === CONCH.pickup.y);
if (!conch || conch.tag !== CONCH.item) {
    throw new Error(`L${CONCH.level} has no ${CONCH.item} at the declared position`);
}
console.log(`   confirmed: the pit is real, its fallthrough is L${world.fallthrough.level}, `
    + `and the ${conch.tag} is at ${JSON.stringify(conch.rect)}`);

if (WRITE) {
    const dir = join(MODULE, 'fixtures', 'tapes');
    for (const t of [control, fire]) {
        const path = join(dir, `${t.name}.json`);
        writeFileSync(path, serializeTape(t));
        console.log(`   wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the two tapes)');
}
