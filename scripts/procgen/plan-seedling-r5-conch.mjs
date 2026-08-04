#!/usr/bin/env node
/**
 * plan-seedling-r5-conch — THE D5 WALK, and the item that arms the water.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 4, step 4. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §2.6.2 and §15.10.
 *
 * ── WHAT THIS WALK IS FOR ─────────────────────────────────────────────
 * `canSwim` is the conch and the conch is at the bottom of Dungeon 5, five
 * doors and a pit from L44. Every rung so far has coerced water away; this
 * is the walk that earns the right to stop.
 *
 * ⛔ AND IT IS THE CHAIN'S FIRST PAYMENT, NOT A PROBE. L48's arrival is
 * (120,296) and `karlore@112,272` is the tile directly north of it — the
 * one-tile corridor out, which the headline pair measured at 2 reachable
 * tiles against 138. So this walk cannot be planned at all without `fire`
 * banked before `new Game(48, ...)` runs, which is precisely what slice 4
 * step 4's `ADDED_TIME_REMOVAL` made expressible.
 *
 * ── ⛔ WHAT ICE COSTS, IN TWO KNOBS ───────────────────────────────────
 * Both are numbers whose published derivations turn out to be about GROUND
 * friction, and R5 is the first route to stop on ice:
 *
 *   `tolerance`    1.0 is half the 1.70 px ground stopping quantum. Ice's
 *                  is ~19.5 px, and raising the knob is NOT MONOTONE — see
 *                  `r5Swim.D5_WALK`'s docblock for the measured sweep and
 *                  which waypoint each failure lands on.
 *   the coast      `assertWindowEndsAtRest` reads SPANS, not physics, and
 *                  its 8 ticks are 20x short here. A `PICKUP_CEREMONY`
 *                  freezes the player without zeroing `v`, so the approach's
 *                  velocity resumes when the dialogue ends.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-conch.mjs            # plan + report
 *   node scripts/procgen/plan-seedling-r5-conch.mjs --write    # write the tape
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { synthesizeLegs } = await import(join(MODULE, 'botDriverV2.js'));
const { serializeTape, parseTape, HAZARD_STATES } = await import(join(MODULE, 'tapeFormat.js'));
const { assertWindowEndsAtRest } = await import(join(MODULE, 'director.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { cameraTrack } = await import(join(MODULE, 'camera.js'));
const encounters = await import(join(MODULE, 'encounters.js'));
const {
    CONCH, D5_WALK, D5_EARNED, D5_LADDER, D5_UNCROSSED, D5_INERT_LOCK,
} = await import(join(MODULE, 'r5Swim.js'));
const { KARLORE } = await import(join(MODULE, 'r5Chain.js'));

const WRITE = process.argv.includes('--write');
const source = atlasLevelSource();
/** ⛓ The world the walk really runs in: `fire` is banked before every door. */
const heldFire = { hasFire: true };
const worldFor = (n) => buildLevelWorld(source(n), { roles: ROLES, inventory: heldFire });

// ── 1. the corridor, confirmed against the extract ────────────────────
console.log('## the D5 corridor, door by door');
let prev = null;
for (const leg of D5_WALK.legs) {
    const w = worldFor(leg.level);
    const exit = leg.exit;
    if (!exit) {
        console.log(`   L${leg.level}  TERMINAL — ${leg.targets.length} target(s)`);
        break;
    }
    if (exit.pit) {
        const pit = w.pitTiles.find((p) => p.tx === exit.pit.tx && p.ty === exit.pit.ty);
        if (!pit) throw new Error(`L${leg.level} has no pit tile at (${exit.pit.tx},${exit.pit.ty})`);
        if (!w.fallthrough) {
            throw new Error(`L${leg.level} holds a pit and NO control block — walking onto `
                + 'one is `die()`, not a transport');
        }
        console.log(`   L${leg.level}  pit (${exit.pit.tx},${exit.pit.ty}) -> `
            + `L${w.fallthrough.level}`);
        prev = w.fallthrough.level;
        continue;
    }
    const tel = w.teleporters.find((t) => t.x === exit.x && t.y === exit.y);
    if (!tel) throw new Error(`L${leg.level} has no teleporter at (${exit.x},${exit.y})`);
    console.log(`   L${leg.level}  teleporter@${exit.x},${exit.y} -> L${tel.to} `
        + `arriving (${tel.arrival.x},${tel.arrival.y})`);
    prev = tel.to;
}

// ── 2. ⛔ THE PLUG IS ON THIS ROUTE, and the walk is where fire is SPENT ──
{
    const plugged = buildLevelWorld(source(KARLORE.level), { roles: ROLES });
    const open = worldFor(KARLORE.level);
    const hasPlug = (w) => w.solids.some((s) => s.tag === 'karlore');
    console.log(`\n## ⛔ L${KARLORE.level} is on the route and `
        + `${hasPlug(plugged) ? 'IS' : 'is NOT'} plugged without \`fire\``);
    if (!hasPlug(plugged) || hasPlug(open)) {
        throw new Error('the karlore plug is not conditioned on `fire` in this build, so '
            + 'the D5 walk is not the place the boolean is spent after all');
    }
    // The arrival, and the tile the plug fills, stated as the geometric fact
    // the walk depends on rather than as a memory of the headline pair.
    const arrival = worldFor(47).teleporters.find((t) => t.to === KARLORE.level).arrival;
    const northTile = { tx: Math.floor(arrival.x / TILE_SIZE), ty: Math.floor(arrival.y / TILE_SIZE) - 1 };
    if (northTile.tx !== KARLORE.tile.tx || northTile.ty !== KARLORE.tile.ty) {
        throw new Error(`the tile north of L${KARLORE.level}'s arrival is `
            + `(${northTile.tx},${northTile.ty}), not karlore's `
            + `(${KARLORE.tile.tx},${KARLORE.tile.ty}) — this walk is not passing the plug`);
    }
    console.log(`   arrival (${arrival.x},${arrival.y}) tile `
        + `(${northTile.tx},${northTile.ty + 1}); the plug fills `
        + `(${KARLORE.tile.tx},${KARLORE.tile.ty}), one north — and the model builds `
        + `${open.addedTimeRemoved.length} fewer entit(y/ies) with the item held`);
}

// ── 3. the conch, and the ice under it ────────────────────────────────
{
    const w = worldFor(CONCH.level);
    const conch = w.pickups.find((p) => p.x === CONCH.pickup.x && p.y === CONCH.pickup.y);
    if (!conch || conch.tag !== CONCH.item) {
        throw new Error(`L${CONCH.level} has no ${CONCH.item} at the declared position`);
    }
    const tileAt = (x, y) => w.walkableTiles.find(
        (t) => t.tx === Math.floor(x / TILE_SIZE) && t.ty === Math.floor(y / TILE_SIZE));
    const under = tileAt(conch.rect.x + 4, conch.rect.y + 4);
    const approach = tileAt(CONCH.approach.x, CONCH.approach.y);
    console.log(`\n## the conch`);
    console.log(`   ${conch.tag}@${conch.x},${conch.y} volume ${JSON.stringify(conch.rect)}, `
        + `tag ${conch.tag === CONCH.item ? CONCH.tag : '?'}`);
    console.log(`   it stands on tile type ${under?.t} and the approach cell `
        + `(${CONCH.approach.x},${CONCH.approach.y}) is type ${approach?.t} — `
        + `${under?.t === HAZARD_STATES.ice ? 'ICE, which is what both knobs are about'
            : 'NOT ice, so the tolerance derivation below is stale'}`);
    if (under?.t !== HAZARD_STATES.ice) {
        throw new Error(`the conch's tile is type ${under?.t}, not ice — `
            + '`D5_WALK.tolerance` and its coast were both derived from ice friction');
    }
    if (w.collidesSolid(playerBoxAt(CONCH.approach.x, CONCH.approach.y))) {
        throw new Error('the declared approach cell is inside a solid');
    }
}

// ── 4. the synthesis ──────────────────────────────────────────────────
const synth = synthesizeLegs(D5_WALK.legs.map((l) => ({
    level: l.level,
    targets: l.targets.map((t) => ({ ...t })),
    ...(l.exit ? { exit: { ...l.exit } } : {}),
})), {
    levelSource: source,
    boot: { ...D5_WALK.boot },
    name: D5_WALK.name,
    lattice: D5_WALK.lattice,
    nodeMargin: D5_WALK.nodeMargin,
    allowGrazes: D5_WALK.allowGrazes,
    tolerance: D5_WALK.tolerance,
    relax: {
        noclip: false,
        noDamage: true,
        noHazards: [...D5_WALK.noHazards],
        grants: D5_WALK.grants.map((g) => ({ level: g.level, items: [...g.items] })),
        persistence: [],
        pins: [...D5_WALK.pins],
    },
});

const tape = synth.tape;
tape.tape_version = 5;
tape.pins = [...D5_WALK.pins];
tape.equips = tape.equips ?? [];
tape.description = 'THE D5 WALK — five doors and a pit from L44 to the conch, with the '
    + 'solids on, lava and ice ARMED, and `fire` banked at the boot. ⛔ It cannot be '
    + 'planned without the item: L48\'s arrival is (120,296) and `karlore@112,272` is the '
    + 'tile directly north of it, the one-tile corridor out (2 reachable tiles with the '
    + 'plug, 138 without) — so this is where `fire` is SPENT and `r5-karlore-fire` is only '
    + 'where it was measured. The conch is taken with the R3 `collect` verb, standing on '
    + 'it and paging its two-page ceremony, and `Conch.removed()` writes `canSwim` and '
    + 'clears {49,0}. ⚠ Two knobs moved for ICE and both had ground-friction derivations: '
    + '`tolerance` 1.0 -> 2.25 (a SEED, not a margin — the sweep is non-monotone) and the '
    + 'window coast 8 -> 32 (a PICKUP_CEREMONY freezes the player without zeroing `v`). '
    + '⛓ The walk comes to rest on a WATER tile, (2,6) — coerced here, armed in the next '
    + 'window with the conch already banked, which is the handoff the swim leg starts from.';
console.log(`\n## the walk`);
console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} span(s), `
    + `${synth.grazes.length} graze(s), ${synth.arrivals.length} arrival(s)`);
console.log(`   transitions ${synth.transitions.map((t) => `${t.from_level}->${t.to_level}@${t.t}`).join(' ')}`);
console.log(`   collects    ${JSON.stringify(synth.collects.map((c) => `${c.item}@L${c.level} `
    + `(${c.approach} approach ticks, ${c.ceremony} ceremony, ${c.releases} releases)`))}`);

// ⚠ THE KEY LIST IS THE CLAIM THAT L48's PROBE ROW IS INERT. "The walk
// never holds key 3" is a fact about the RUN, and a later chain that banks
// one would make §2.6.2's sentence false with nothing here changing.
console.log(`   keys        ${JSON.stringify(synth.keys)} — L${D5_INERT_LOCK.level}'s `
    + `bosslock@${D5_INERT_LOCK.at.x},${D5_INERT_LOCK.at.y} is keyType `
    + `${D5_INERT_LOCK.keyType}, so its probe row is inert for THIS run`);
if ((synth.keys ?? []).includes(D5_INERT_LOCK.keyType)) {
    throw new Error(`the walk banks keyType ${D5_INERT_LOCK.keyType}, so L`
        + `${D5_INERT_LOCK.level}'s bosslock is NOT inert and the route crosses its row`);
}
{
    const lock = worldFor(D5_INERT_LOCK.level).activators
        .find((a) => a.x === D5_INERT_LOCK.at.x && a.y === D5_INERT_LOCK.at.y);
    if (!lock || lock.keyType !== D5_INERT_LOCK.keyType) {
        throw new Error(`L${D5_INERT_LOCK.level} has no keyType-${D5_INERT_LOCK.keyType} `
            + 'lock at the declared position — the inertness claim names nothing');
    }
}

// ── 5. THE COAST, and where it leaves the player ──────────────────────
tape.tick_count += D5_WALK.coastTicks;
const rest = assertWindowEndsAtRest(tape);
if (rest.length > 0) throw new Error(`${tape.name} not at rest:\n  ${rest.join('\n  ')}`);
parseTape(serializeTape(tape));

const run = runTape(tape, { levelSource: source });
const end = run.ticks.at(-1);
const final = run.final;
console.log(`\n## where it stops`);
console.log(`   terminal L${end.level} (${end.x.toFixed(3)},${end.y.toFixed(3)}) `
    + `v=(${final.vx},${final.vy}) terrain ${final.terrain}`);
// ⛔ THE STATIC CHECK IS NOT THE CLAIM. `assertWindowEndsAtRest` reads the
// spans; on ice the player is still moving twelve ticks after the last
// release. The claim is the PHYSICS, and it is asserted here.
if (final.vx !== 0 || final.vy !== 0) {
    throw new Error(`the walk ends MOVING — v=(${final.vx},${final.vy}). On ice the coast `
        + `is 20x the ground one (friction 0.025 against 0.25) and a PICKUP_CEREMONY `
        + 'freezes the player without zeroing `v`, so the approach\'s velocity resumes '
        + `when the dialogue ends. Raise D5_WALK.coastTicks above ${D5_WALK.coastTicks}.`);
}
if (final.terrain !== HAZARD_STATES.water) {
    throw new Error(`the walk comes to rest on terrain ${final.terrain}, not water. The `
        + 'declared handoff into the swim leg is that the slide off the conch\'s ice tile '
        + 'ends in (2,6) — re-derive it, or the next window does not start where this '
        + 'one says it does.');
}
console.log('   ⛓ it comes to rest ON WATER — coerced in this window, armed in the next, '
    + 'and the conch is already banked. That is the swim leg\'s starting line.');

// ── 6. the ledger, and the item ───────────────────────────────────────
console.log(`\n## what the walk earns`);
console.log(`   inventory   ${JSON.stringify(Object.entries(run.inventory)
    .filter(([, v]) => v === true).map(([k]) => k))}`);
if (run.inventory[CONCH.property] !== true) {
    throw new Error(`the walk ends without ${CONCH.property} — the ceremony did not fire`);
}
if (run.inventory.hasFire !== true) {
    throw new Error('the walk ends without hasFire, so the boot grant did not land');
}
console.log(`   earned      ${D5_EARNED.map((e) => `{${e.level},${e.tag}}`).join(' ')} `
    + `— ${D5_EARNED[0].by}`);

// ── 7. ⚠ THE ENCOUNTER LADDER, EMITTED (§13) ──────────────────────────
console.log(`\n## the encounter ladder over the walk's own path`);
const camByTick = new Map(cameraTrack(run.ticks, (l) => worldFor(l).world).map((c) => [c.t, c]));
const priced = [];
const levels = [...new Set(run.ticks.map((o) => o.level))];
for (const level of levels) {
    const w = worldFor(level);
    if (w.combat.enemies.length === 0 && w.combat.hazards.length === 0) continue;
    priced.push(...encounters.encounterPlan(run.ticks, w, {
        cameraAt: (t) => camByTick.get(t) ?? null,
    }).verdicts);
}
priced.sort((a, b) => a.from - b.from);
for (const v of priced) {
    console.log(`   ${v.rung === 'wake-and-thread' ? '✓' : '⛔'} L${v.level} `
        + `${v.tag}@${v.x},${v.y} t${v.from}..${v.to} ${v.rung}`
        + (v.clearance !== undefined ? ` clearance ${v.clearance} px` : ''));
    console.log(`      ${v.why}`);
}
// ⚠ THE DECLARATION IS CHECKED BOTH WAYS. A ladder that priced nothing and
// a ladder that threaded everything print the same count.
const seen = priced.map((v) => `${v.level}:${v.tag}@${v.x},${v.y}`);
const want = D5_LADDER.map((v) => `${v.level}:${v.tag}@${v.at.x},${v.at.y}`);
if (JSON.stringify([...new Set(seen)].sort()) !== JSON.stringify([...want].sort())) {
    throw new Error(`the ladder crossed [${[...new Set(seen)].join(', ')}] and `
        + `\`D5_LADDER\` declares [${want.join(', ')}]`);
}
if (priced.some((v) => v.rung !== 'wake-and-thread')) {
    throw new Error('a crossing on this route is not a thread — the walk carries no sword '
        + 'and every verdict here has to be contact-free by the envelope');
}
// ...and the ones it never came near, NAMED (a bounded sweep must say what
// it bounded). Six instances live on the corridor; one is crossed.
const census = levels.flatMap((l) => {
    const w = worldFor(l);
    return [...w.combat.enemies, ...w.combat.hazards].map((e) => `${l}:${e.tag}@${e.x},${e.y}`);
});
const uncrossed = census.filter((k) => !seen.includes(k));
console.log(`\n   ${census.length} instance(s) live on the corridor, ${new Set(seen).size} `
    + `crossed, ${uncrossed.length} never approached:`);
for (const k of uncrossed) console.log(`      · ${k}`);
const declaredUncrossed = D5_UNCROSSED.map((v) => `${v.level}:${v.tag}@${v.at.x},${v.at.y}`);
if (JSON.stringify([...uncrossed].sort()) !== JSON.stringify([...declaredUncrossed].sort())) {
    throw new Error(`the uncrossed set is [${uncrossed.join(', ')}] and \`D5_UNCROSSED\` `
        + `declares [${declaredUncrossed.join(', ')}]`);
}

if (WRITE) {
    const path = join(MODULE, 'fixtures', 'tapes', `${tape.name}.json`);
    writeFileSync(path, serializeTape(tape));
    console.log(`\n   wrote ${path}`);
} else {
    console.log('\n(dry run — pass --write to emit the tape)');
}
