#!/usr/bin/env node
/**
 * plan-seedling-r5-l40-part1 — THE SECOND CEREMONY, AND IT IS FREE.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 13 step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §24.5 / §26.
 *
 * ── WHY THIS ONE FIRST ────────────────────────────────────────────────
 *
 * §24.5 priced L40's north half as an ELEVEN-LINK CHAIN — a chest, a burn,
 * a pulser, three walk-pushes, a boss key — and §23.9's arrival flood
 * already recorded which of the level's prizes need none of it. Exactly one
 * does:
 *
 * ```
 *   L40_ARRIVAL.reached   totempart 1 @160,640   "⛓ FREE"
 *   L40_ARRIVAL.unreached totempart 0, bosskey, both north teleporters, …
 * ```
 *
 * ⇒ **the second of the five ceremonies costs a walk.** Not because the
 * route got lucky: the arrival flood was measured with every activator
 * group SHUT and the R5 item set held, so "free" is a measured verdict on
 * the room and this tape is what cashes it.
 *
 * ── ⛓ AND IT IS A SEPARATE WINDOW, WHICH IS ALSO A MEASUREMENT ────────
 *
 * §24.7 makes L39 a ONE-WINDOW room — the rope drops a rock onto the
 * teleporter home and `REFUSED_CLEAR_RESPONSES.arm` forbids declaring a
 * fallrock tag, so nothing can boot into L39 after the pull. L40 has the
 * opposite shape: its arrival needs no earned flag at all
 * (`L40_ARRIVAL.groupDelta` is **0** — opening groups 0 and 1 by fiat adds
 * nothing), so the window boots straight into the room `teleporter@144,0`
 * would have delivered the player to.
 *
 * ── ⚠ WHAT THE ROUTE MUST NOT TOUCH, AND IT IS NOT WHAT IT LOOKS LIKE ──
 *
 * `control@224,432` reads as a trigger and is not one: slice 13's recon
 * (`r5Totem.L40_FALLTHROUGH`) reads it as a PARAMETER BLOCK consumed once
 * at `loadlevel`, whose `@x,@y` is the base of an OFFSET rather than a
 * place. What it configures is every PIT in the level: a fall transports to
 * **L43, the wand room**, with no way back. So the thing to avoid is the
 * pit tiles, and the planner already refuses those.
 *
 * ⚠ AND L40 IS FULL OF ENEMIES — 12 bobs, 2 punchers, a bobsoldier, an
 * iceturret, a bombpusher and 5 spinners. This leg presses nothing, so
 * `runFire`'s refusal is not engaged; `noDamage` is on, as it is for every
 * committed tape on the ladder, and the walk is planned around the census's
 * avoid volumes.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-l40-part1.mjs
 *   node scripts/procgen/plan-seedling-r5-l40-part1.mjs --write
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --record --win \
 *       --only=r5-l40-part1
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { synthesizeLegs } = await import(join(MODULE, 'botDriverV2.js'));
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { L40_ARRIVAL, L40_FALLTHROUGH } = await import(join(MODULE, 'r5Totem.js'));

const WRITE = process.argv.includes('--write');
const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

const PART_1 = Object.freeze({ x: 160, y: 640 });
const world = buildLevelWorld(levelSource(40), { roles: ROLES, inventory: held });

console.log('## the room');
{
    const part = (world.pickups ?? []).find(
        (p) => p.tag === 'totempart' && p.x === PART_1.x && p.y === PART_1.y);
    if (!part) throw new Error(`L40 has no totempart at (${PART_1.x},${PART_1.y})`);
    console.log(`   totempart@${part.x},${part.y} rect [${part.rect.x},${part.rect.right}) x `
        + `[${part.rect.y},${part.rect.bottom}) — tile `
        + `(${Math.floor(part.x / TILE_SIZE)},${Math.floor(part.y / TILE_SIZE)})`);
    console.log(`   boot (${L40_ARRIVAL.boot.x},${L40_ARRIVAL.boot.y}), spawn `
        + `(${L40_ARRIVAL.spawn.x},${L40_ARRIVAL.spawn.y}) — from `
        + `${L40_ARRIVAL.from.teleporter} in L${L40_ARRIVAL.from.level}`);
    console.log(`   ⚠ every pit in this level transports to L${L40_FALLTHROUGH.toLevel} `
        + `(offset ${L40_FALLTHROUGH.offset.x},${L40_FALLTHROUGH.offset.y}) — `
        + `${world.pitTiles.length} pit tile(s), all forbidden`);
    console.log(`   enemies: ${world.combat.enemies.length} live, `
        + `[${[...new Set(world.combat.enemies.map((e) => e.as3))].sort().join(' ')}]`);
}

/**
 * ⛓ THE APPROACH STANCE, and it is one tile east.
 *
 * A planner may not route ONTO a pickup, so the collect leg's target is a
 * neighbour and `runCollect` walks the last cell. The part's rect is a whole
 * cell here (unlike `totempart 2`, which straddles a column boundary), so
 * the default aim at its centre is on a clear line and no `collect.aim`
 * override is needed. Stated because the OTHER part needed one.
 */
const STANCE = Object.freeze({ tx: 11, ty: 40 });
const centre = (t) => ({ x: t.tx * TILE_SIZE + TILE_SIZE / 2, y: t.ty * TILE_SIZE + TILE_SIZE / 2 });

let out = null;
let failure = null;
try {
    out = synthesizeLegs([{
        level: 40,
        targets: [
            { ...centre(STANCE) },
            { ...centre(STANCE), collect: { pickup: { ...PART_1 } } },
        ],
    }], {
        levelSource,
        boot: { level: 40, ...L40_ARRIVAL.boot },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 40, items: [...HELD] }],
            persistence: [],
            equips: [],
            // ⛓ The census this leg is planned against — and asked for by
            // name, per `synthesizeLegs`' `relax.roles`. L40 holds 21 live
            // enemies and a walk planned without the `combat` role would be
            // routed around none of them.
            roles: [...ROLES],
        },
        name: 'r5-l40-part1',
        lattice: L40_ARRIVAL.lattice,
        allowGrazes: true,
        maxTicksPerTarget: 4000,
    });
} catch (e) {
    failure = e.message;
}
if (!out) {
    console.log(`\n⛔ THE DRIVE FAILED, and the failure is the finding:\n\n   ${failure}\n`);
    process.exit(1);
}

const tape = parseTape(serializeTape({
    ...out.tape,
    description: '⛓⛓⛓ THE SECOND COLLECT CEREMONY — `totempart 1 @160,640`, and it costs a '
        + 'WALK. §24.5 priced L40\'s north half as an eleven-link chain (a chest, a burn, '
        + 'a pulser, three walk-pushes, a boss key) and §23.9\'s arrival flood recorded '
        + 'which prizes need none of it: exactly one does. Measured with every activator '
        + 'group SHUT, so "free" is a verdict about the room. ⚠ The route stays off every '
        + 'pit: `control@224,432` is a PARAMETER BLOCK, not a trigger, and what it '
        + 'configures is a fall that transports to L43 — the wand room, one way. The 150 '
        + 'frozen frames are the claim; `hasTotemPart` is not in `Bot.itemReadout`.',
}));

const run = runTape(tape, { levelSource });
const end = run.ticks[run.ticks.length - 1];
console.log('\n## the drive');
console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} spans — ends L${end.level} `
    + `(${end.x.toFixed(2)},${end.y.toFixed(2)}) tile `
    + `(${Math.floor(end.x / TILE_SIZE)},${Math.floor(end.y / TILE_SIZE)})`);
console.log(`   collected: ${run.collected.map((c) => `t${c.t} item=${c.item ?? 'null'}`).join(', ') || 'NONE'}`);
console.log(`   spinner writes: ${run.spinnerWrites.map((w) => `{${w.flag.level},${w.flag.tag}} ${w.cause}`).join(', ') || 'none'}`);

console.log('\n## the claims');
const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });
check(run.collected.length === 1,
    '⛓⛓⛓ ONE COLLECT CEREMONY — totempart 1, the SECOND of the five',
    `${run.collected.length}`);
check(run.collected[0]?.item === null,
    '⛓ …and it banks no inventory property — a totem part is save-file state',
    `item = ${run.collected[0]?.item ?? 'null'}`);
check(run.transitions.length === 0,
    '⛓ …without leaving L40 — no teleporter, no stairs, no pit',
    `${run.transitions.length} transition(s); ${run.transports.length} pit fall(s). ⚠ A pit `
    + `here is a ONE-WAY door into L${L40_FALLTHROUGH.toLevel}, so a transport would be the `
    + 'route falling into the wand room rather than a hazard it survived.');
check(run.transports.length === 0,
    '⛓⛓ …and it never falls — the fallthrough is untouched',
    `${run.transports.length}`);
check(run.earnedClears.length === 0 && run.lockWrites.length === 0,
    '⛓ …and it earns NO persistence at all — the chain is untouched',
    `earnedClears ${run.earnedClears.length}, lockWrites ${run.lockWrites.length}. `
    + 'A leg that opened a link would make the "free" claim about a different room.');
check(run.spinnerWrites.length === 0,
    '⛓ …and none of L40\'s five spinners dies on the way',
    `${run.spinnerWrites.length} — a `
    + '`Spinner.removed()` write is earned by a billiard bouncing into a hazard as '
    + 'readily as by a kill (`spinner.SPINNER_TERRAIN_WRITE`), so an empty list here is '
    + 'a claim rather than an absence.');

let bad = 0;
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);

if (WRITE) {
    const path = join(MODULE, 'fixtures', 'tapes', `${tape.name}.json`);
    writeFileSync(path, serializeTape(tape));
    console.log(`\n   wrote ${path}`);
} else {
    console.log('\n(dry run — pass --write to emit the tape)');
}
