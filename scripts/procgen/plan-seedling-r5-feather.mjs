#!/usr/bin/env node
/**
 * plan-seedling-r5-feather — THE WALK THAT EARNS THE FEATHER.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 5, step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §16.10 (the measurement
 * this retires) and §17.
 *
 * ── WHAT THIS WALK IS FOR ─────────────────────────────────────────────
 * `climbsArmedWaterfall` has had both arms since slice 4 step 5, on a PROBE
 * grant: `r5-waterfall-shut` stalls on the face and `r5-waterfall-climb`
 * goes through, and the field they differ in is `grants`. What that pair
 * cannot say is where the feather COMES FROM. This walk says it: four
 * levels, two sword swings and a descent, ending with `Feather.removed()`
 * writing `hasFeather` and clearing {89,0}.
 *
 * ── ⛔ AND IT IS A ROUTE §16.10 SAID DID NOT EXIST ────────────────────
 * See `probe-seedling-r5-feather` for the measurement and the two reasons
 * the committed one was wrong. This script CONFIRMS the consequences:
 * every door on the chain, both rocks with their stances, and the descent.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-feather.mjs            # plan + report
 *   node scripts/procgen/plan-seedling-r5-feather.mjs --write    # write the tape
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
const { rockBreaksUnder, outOfBandFlagFor } = await import(join(MODULE, 'breakableRocks.js'));
const {
    FEATHER, FEATHER_WALK, FEATHER_EARNED, FEATHER_LADDER, FEATHER_UNCROSSED,
    L92_ROCKS, ROCK_OUT_OF_BAND_FLAG, SUPERSEDES, assertWalkDoors,
} = await import(join(MODULE, 'r5Feather.js'));

const WRITE = process.argv.includes('--write');
const source = atlasLevelSource();
/** ⛓ The world the walk really runs in: both items are banked at the boot. */
const held = { hasSword: true, canSwim: true };
const worldFor = (n) => buildLevelWorld(source(n), { roles: ROLES, inventory: held });

// ── 1. the chain, door by door ────────────────────────────────────────
console.log('## the chain, door by door');
for (const hop of assertWalkDoors(worldFor)) {
    console.log(`   L${hop.from} -> L${hop.to} arriving (${hop.arrival.x},${hop.arrival.y}) `
        + `tile (${Math.floor(hop.arrival.x / TILE_SIZE)},${Math.floor(hop.arrival.y / TILE_SIZE)})`);
}
console.log(`   ⛔ this chain retires ${SUPERSEDES.section} (${SUPERSEDES.constant}):`);
for (const r of SUPERSEDES.reasons) console.log(`      · ${r}`);
console.log(`   ⚠ what survives: ${SUPERSEDES.survives}`);

// ── 2. ⛔ THE TWO ROCKS, and the order is forced ──────────────────────
{
    console.log('\n## ⛔ L92\'s two rocks — the whole price of the feather');
    const w = worldFor(92);
    for (const r of L92_ROCKS) {
        const id = `breakablerock@${r.rock.x},${r.rock.y}`;
        const solid = w.solids.find((s) => s.rockId === id);
        if (!solid) {
            throw new Error(`L92 has no BreakableRock at (${r.rock.x},${r.rock.y}); it has `
                + `[${w.solids.filter((s) => s.rockId).map((s) => s.rockId).join(' ')}]`);
        }
        if (!rockBreaksUnder(solid.rockType, held)) {
            throw new Error(`${id} is rockType ${solid.rockType}, which this walk's weapon `
                + 'cannot break — `hit(_t)` breaks only when `rockType <= _t`');
        }
        if (w.collidesSolid(playerBoxAt(r.stance.x, r.stance.y))) {
            throw new Error(`the declared stance (${r.stance.x},${r.stance.y}) for ${id} is `
                + 'inside a solid');
        }
        const flag = outOfBandFlagFor(92, solid.persistTag);
        console.log(`   ${id} rockType ${solid.rockType} tag ${solid.persistTag} — stance `
            + `(${r.stance.x},${r.stance.y}) facing ${r.facing}; \`endAnim\` clears `
            + `{${flag.level},${flag.tag}}`);
        console.log(`      ${r.why}`);
        if (flag.level !== ROCK_OUT_OF_BAND_FLAG.level || flag.tag !== ROCK_OUT_OF_BAND_FLAG.tag) {
            throw new Error(`${id}'s write resolves to {${flag.level},${flag.tag}} and the `
                + `declaration says {${ROCK_OUT_OF_BAND_FLAG.level},`
                + `${ROCK_OUT_OF_BAND_FLAG.tag}}`);
        }
    }
}

// ── 3. the feather, and the pocket it sits in ────────────────────────
{
    const w = worldFor(FEATHER.level);
    const f = w.pickups.find((p) => p.x === FEATHER.pickup.x && p.y === FEATHER.pickup.y);
    if (!f || f.tag !== FEATHER.item) {
        throw new Error(`L${FEATHER.level} has no ${FEATHER.item} at the declared position`);
    }
    const typeAt = (tx, ty) => w.walkableTiles.find((t) => t.tx === tx && t.ty === ty)?.t;
    const { tx, ty } = FEATHER.tile;
    console.log(`\n## the feather`);
    console.log(`   ${f.tag}@${f.x},${f.y} volume ${JSON.stringify(f.rect)} on tile `
        + `(${tx},${ty}), type ${typeAt(tx, ty)}`);
    console.log(`   above (${tx},${ty - 1}) type ${typeAt(tx, ty - 1)}, `
        + `below (${tx},${ty + 1}) type ${typeAt(tx, ty + 1)} — `
        + `${typeAt(tx, ty - 1) === HAZARD_STATES.waterfall
            && typeAt(tx, ty + 1) === HAZARD_STATES.waterfall
            ? 'BOTH waterfalls, so the pocket is entered from ABOVE only'
            : 'NOT both waterfalls — §16.10\'s surviving half has stopped being true'}`);
    if (typeAt(tx, ty - 1) !== HAZARD_STATES.waterfall
        || typeAt(tx, ty + 1) !== HAZARD_STATES.waterfall) {
        throw new Error('the feather\'s pocket is not bounded by two waterfalls any more');
    }
}

// ── 4. the synthesis ──────────────────────────────────────────────────
const synth = synthesizeLegs(FEATHER_WALK.legs.map((l) => ({
    level: l.level,
    targets: l.targets.map((t) => ({ ...t })),
    ...(l.exit ? { exit: { ...l.exit } } : {}),
})), {
    levelSource: source,
    boot: { ...FEATHER_WALK.boot },
    name: FEATHER_WALK.name,
    lattice: FEATHER_WALK.lattice,
    nodeMargin: FEATHER_WALK.nodeMargin,
    allowGrazes: FEATHER_WALK.allowGrazes,
    tolerance: FEATHER_WALK.tolerance,
    maxTicksPerTarget: FEATHER_WALK.maxTicksPerTarget,
    relax: {
        noclip: false,
        noDamage: true,
        noHazards: [...FEATHER_WALK.noHazards],
        grants: FEATHER_WALK.grants.map((g) => ({ level: g.level, items: [...g.items] })),
        persistence: [],
        pins: [...FEATHER_WALK.pins],
    },
});

const tape = synth.tape;
tape.tape_version = 5;
tape.pins = [...FEATHER_WALK.pins];
tape.equips = tape.equips ?? [];
tape.description = 'THE FEATHER WALK — L87 -> L92 -> L91 -> L89, two sword swings and a '
    + 'descent, with the solids on and everything but the waterfall ARMED. ⛔ It is a '
    + 'route §16.10 measured as closed, and the measurement was wrong twice: a '
    + 'TILE-CENTRE lattice (a CliffSide is a pixelmask and the cells it leaves free are '
    + 'half-tiles) and an `allowTeleporter` argument passed the teleporter OBJECT where '
    + '`plannerObstacleAt` wants an INDEX, so the L92 door\'s own volume counted as a '
    + 'wall. What survives is the pocket: the feather has a WATERFALL above and below, so '
    + 'it is reached only from ABOVE — which is why the walk goes the long way round. '
    + '⛔ The seal was in L92 and it was TWO `breakablerock`s (14 / 92 / 256 cells for '
    + 'neither / one / both), broken east-to-west because the second is not reachable '
    + 'until the first is gone. `endAnim` removes each rock SEVEN ticks after the swing '
    + 'and writes `setPersistence(-1, false)`, which from L92 is L91\'s tag 29 — two '
    + 'writes, one flag. ⛓ `Feather.removed()` then writes `hasFeather` and clears '
    + '{89,0}, and the window that spends it is the one that retires "waterfall".';

console.log(`\n## the walk`);
console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} span(s), `
    + `${synth.grazes.length} graze(s), ${synth.arrivals.length} arrival(s)`);
console.log(`   transitions ${synth.transitions.map((t) => `${t.from_level}->${t.to_level}@${t.t}`).join(' ')}`);
console.log(`   presses     ${JSON.stringify((synth.spears ?? []).map((s) => `${s.kind} `
    + `${s.id} @L${s.level} t${s.pressTick} facing ${s.facing}`))}`);
console.log(`   collects    ${JSON.stringify(synth.collects.map((c) => `${c.item}@L${c.level} `
    + `(${c.approach} approach ticks, ${c.ceremony} ceremony, ${c.releases} releases)`))}`);

// ── 5. the coast, and where it leaves the player ─────────────────────
tape.tick_count += FEATHER_WALK.coastTicks;
const rest = assertWindowEndsAtRest(tape);
if (rest.length > 0) throw new Error(`${tape.name} not at rest:\n  ${rest.join('\n  ')}`);
parseTape(serializeTape(tape));

const run = runTape(tape, { levelSource: source });
const end = run.ticks.at(-1);
const final = run.final;
console.log(`\n## where it stops`);
console.log(`   terminal L${end.level} (${end.x.toFixed(3)},${end.y.toFixed(3)}) `
    + `v=(${final.vx},${final.vy}) terrain ${final.terrain}`);
if (final.vx !== 0 || final.vy !== 0) {
    throw new Error(`the walk ends MOVING — v=(${final.vx},${final.vy}). A PICKUP_CEREMONY `
        + 'freezes the player without zeroing `v`, so the approach\'s velocity resumes when '
        + `the dialogue ends. Raise FEATHER_WALK.coastTicks above ${FEATHER_WALK.coastTicks}.`);
}
// ⛓ THE HANDOFF INTO THE FLIP WINDOW. The next window arms the waterfall
// and holds UP; it can only do that from inside the pocket.
{
    const tx = Math.floor(end.x / TILE_SIZE);
    const ty = Math.floor(end.y / TILE_SIZE);
    console.log(`   tile (${tx},${ty}) — the feather's own pocket is `
        + `(${FEATHER.tile.tx},${FEATHER.tile.ty})`);
    if (tx !== FEATHER.tile.tx || ty !== FEATHER.tile.ty) {
        throw new Error(`the walk comes to rest on tile (${tx},${ty}), not in the feather's `
            + 'pocket. The flip window holds UP from where this one stopped, and it can '
            + 'only cross the waterfall above the pocket from inside it.');
    }
}

// ── 6. the ledger, and the item ───────────────────────────────────────
console.log(`\n## what the walk earns`);
console.log(`   inventory   ${JSON.stringify(Object.entries(run.inventory)
    .filter(([, v]) => v === true).map(([k]) => k))}`);
if (run.inventory[FEATHER.property] !== true) {
    throw new Error(`the walk ends without ${FEATHER.property} — the ceremony did not fire`);
}
// ⚠ TWO LEDGERS. A pickup's clear comes through `collected`, an opener's
// through `earnedClears`, and the game reports their UNION. Both are
// checked as exact sets so neither can quietly absorb the other's entry.
const openers = (run.earnedClears ?? []).map((c) => `${c.level}:${c.tag}`).sort();
const picked = (run.collected ?? []).map((c) => {
    const decl = FEATHER_EARNED.find((d) => d.level === c.level);
    return `${c.level}:${decl ? decl.tag : '?'}`;
}).sort();
const wantOpeners = FEATHER_EARNED.filter((c) => c.from === 'earnedClears')
    .map((c) => `${c.level}:${c.tag}`).sort();
const wantPicked = FEATHER_EARNED.filter((c) => c.from === 'collected')
    .map((c) => `${c.level}:${c.tag}`).sort();
console.log(`   collected   ${picked.join(' ') || 'none'} `
    + `(${JSON.stringify((run.collected ?? []).map((c) => `${c.item}@L${c.level} t${c.t}`))})`);
console.log(`   openers     ${openers.join(' ') || 'none'}`);
for (const c of FEATHER_EARNED) console.log(`      {${c.level},${c.tag}} via ${c.from} — ${c.by}`);
if (JSON.stringify(openers) !== JSON.stringify(wantOpeners)) {
    throw new Error(`the walk's OPENERS clear [${openers.join(', ')}] and `
        + `\`FEATHER_EARNED\` declares [${wantOpeners.join(', ')}] — an exact set, both ways`);
}
if (JSON.stringify(picked) !== JSON.stringify(wantPicked)) {
    throw new Error(`the walk COLLECTS [${picked.join(', ')}] and \`FEATHER_EARNED\` `
        + `declares [${wantPicked.join(', ')}] — an exact set, both ways`);
}
console.log(`   rocks       ${JSON.stringify((run.rocksBroken ?? []).map((r) => `${r.id}@L`
    + `${r.level} hit ${r.hitTick} gone ${r.goneAt}`))}`);

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
// ⚠ THE DECLARATION IS CHECKED BOTH WAYS, AND IT CARRIES THE RUNG. A
// ladder that priced nothing and a ladder that threaded everything print
// the same count; a ladder whose verdicts silently got HARDER prints the
// same set.
{
    const got = priced.map((v) => `${v.level}:${v.tag}@${v.x},${v.y}=${v.rung}`);
    const want = FEATHER_LADDER.map((v) => `${v.level}:${v.tag}@${v.at.x},${v.at.y}=${v.rung}`);
    if (JSON.stringify([...new Set(got)].sort()) !== JSON.stringify([...want].sort())) {
        throw new Error(`the ladder decided [${[...new Set(got)].join(', ')}] and `
            + `\`FEATHER_LADDER\` declares [${want.join(', ')}]`);
    }
    const deferred = FEATHER_LADDER.filter((v) => v.rung !== 'wake-and-thread');
    console.log(`\n   ⚠ ${deferred.length} of ${FEATHER_LADDER.length} crossing(s) are `
        + 'DEFERRED, not resolved. `Player.as:1372-1379` opens with '
        + '`if (Bot.noDamage) return`, which guards the knockback as well as the damage, '
        + 'so a contact costs this stream nothing — what it costs is the CLAIM that the '
        + 'route is contact-free, and a rung that retires `noDamage` has to pay it.');
}

const census = levels.flatMap((l) => {
    const w = worldFor(l);
    return [...w.combat.enemies, ...w.combat.hazards].map((e) => `${l}:${e.tag}@${e.x},${e.y}`);
});
const seen = priced.map((v) => `${v.level}:${v.tag}@${v.x},${v.y}`);
const uncrossed = census.filter((k) => !seen.includes(k));
console.log(`\n   ${census.length} instance(s) live on the route, ${new Set(seen).size} `
    + `crossed, ${uncrossed.length} never approached:`);
for (const k of uncrossed) console.log(`      · ${k}`);
{
    const want = FEATHER_UNCROSSED.map((v) => `${v.level}:${v.tag}@${v.at.x},${v.at.y}`);
    if (JSON.stringify([...uncrossed].sort()) !== JSON.stringify([...want].sort())) {
        throw new Error(`the uncrossed set is [${uncrossed.join(', ')}] and `
            + `\`FEATHER_UNCROSSED\` declares [${want.join(', ')}]`);
    }
}

if (WRITE) {
    const path = join(MODULE, 'fixtures', 'tapes', `${tape.name}.json`);
    writeFileSync(path, serializeTape(tape));
    console.log(`\n   wrote ${path}`);
} else {
    console.log('\n(dry run — pass --write to emit the tape)');
}
