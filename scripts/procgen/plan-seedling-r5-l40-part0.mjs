#!/usr/bin/env node
/**
 * plan-seedling-r5-l40-part0 — THE THIRD COLLECT CEREMONY, AND IT IS LINK 11.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 14 step 1b. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §24.5 link 11.
 *
 * ── ⛓⛓ WHY THIS RUNS WITHOUT THE BOSS KEY ────────────────────────────
 *
 * §24.5's chain is ordered by what the ARRIVAL can reach, and on that
 * ordering the NW cluster is link 11 — last, behind the bosslock. But the
 * cluster's own dependencies are internal: `buttonroom@272,208 {t 0}`, then
 * the three `breakablerock`s {tags 22,23,24}, then
 * `buttonroom@160,128 {t 1}`, and only the last puts `totempart 0 @64,144`
 * in reach. Nothing in that list needs the key. So this tape BOOTS INTO THE
 * CLUSTER — `Bot.as:811` re-boots with `new Game(bootLevel, bootX, bootY)`
 * whenever the tape's boot block disagrees with where the player is, which
 * is what slice 12's press probes are built on — and drives the four links
 * in their own forced order.
 *
 * ⚠ WHAT THAT DOES AND DOES NOT PROVE, stated rather than blurred: it
 * proves the four links and the ceremony. It does NOT prove the cluster is
 * reachable from the L40 arrival — §24.5 says it is not, and links 3-10 are
 * still undriven. The route claim stays where §24.5 left it.
 *
 * ```
 *   boot (17,14)            728 nodes
 *   + buttonroom t 0        760      wandlocks {40,4}/{40,5}/{40,6} open
 *   + the three rocks       776      and `buttonroom@160,128` is in reach
 *   + buttonroom t 1        968      and `totempart 0` is in reach
 * ```
 *
 * ── ⚠ WHAT SHARES THE ROOM ───────────────────────────────────────────
 *
 *   spinners {40,17}/{40,18}/{40,19}   at (12,8), (12,9), (12,10) — modelled
 *                                      billiards, and each one's `removed()`
 *                                      writes its tag WHATEVER killed it. The
 *                                      ledger claim is that none dies.
 *   bombpusher@112,128                 a 3x3 SOLID and unkillable (`hit` is an
 *                                      empty override). ⛔ AND ITS `update()`
 *                                      HAS NO FREEZE GUARD — see the header of
 *                                      `L40_NW` for what that means for a
 *                                      ceremony 150 frames long.
 *   five Bobs                          `Bob.removed()` is EMPTY, so a bob kill
 *                                      costs the ledger nothing; their motion
 *                                      is unmodelled and their LOS test is
 *                                      COMMENTED OUT, so they chase through
 *                                      walls. Not Solid, cannot wedge.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-l40-part0.mjs [--write]
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { synthesizeLegs, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { rockBreaksUnder } = await import(join(MODULE, 'breakableRocks.js'));
const { L40_NW } = await import(join(MODULE, 'r5Totem.js'));

const WRITE = process.argv.includes('--write');
const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

const world = buildLevelWorld(levelSource(40), { roles: ROLES, inventory: held });
const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

console.log('## the cluster');
for (const r of L40_NW.rocks) {
    const solid = world.solids.find((s) => s.rockId === r.id);
    if (!solid) throw new Error(`L40 has no ${r.id}`);
    if (!rockBreaksUnder(solid.rockType, held)) {
        throw new Error(`${r.id} is rockType ${solid.rockType}, which this walk's weapon `
            + 'cannot break — `hit(_t)` breaks only when `rockType <= _t`, and `_t` is 1 '
            + 'only with the ghost sword.');
    }
    if (solid.persistTag !== r.tag) {
        throw new Error(`${r.id} carries tag ${solid.persistTag}, not the declared ${r.tag}`);
    }
    console.log(`   ${r.id} tag ${solid.persistTag} rockType ${solid.rockType}`);
}
console.log('   ⛔ THREE ROCKS, TWO SWINGS:');
for (const sw of L40_NW.swings) {
    console.log(`      stance (${sw.stance.x},${sw.stance.y}) facing ${sw.facing} -> `
        + `[${sw.breaks.join(' ')}]`);
}
console.log(`   ${world.combat.enemies.filter((e) => e.x < 400 && e.y < 400)
    .map((e) => `${e.as3}@${e.x},${e.y}`).join(' ')}`);

console.log('\n## the flood, link by link');
{
    const P = L40_NW.lattice;
    const nx = world.width * TILE_SIZE / P;
    const ny = world.height * TILE_SIZE / P;
    const base = { avoidVolumes: false, inventory: held };
    const walkable = (tx, ty, o) => tx >= 0 && ty >= 0 && tx < nx && ty < ny
        && plannerObstacleAt(world, tx * P + P / 2, ty * P + P / 2, null, { ...base, ...o }) === null;
    const flood = (o) => {
        const seen = new Set();
        const key = (a, b) => b * nx + a;
        const from = [Math.floor(L40_NW.spawn.x / P), Math.floor(L40_NW.spawn.y / P)];
        if (!walkable(from[0], from[1], o)) return seen;
        seen.add(key(from[0], from[1]));
        const q = [from];
        while (q.length) {
            const [x, y] = q.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const a = x + dx;
                const b = y + dy;
                if (seen.has(key(a, b)) || !walkable(a, b, o)) continue;
                seen.add(key(a, b));
                q.push([a, b]);
            }
        }
        return seen;
    };
    const has = (s, tx, ty) => {
        for (let a = tx * TILE_SIZE / P; a < (tx + 1) * TILE_SIZE / P; a += 1) {
            for (let b = ty * TILE_SIZE / P; b < (ty + 1) * TILE_SIZE / P; b += 1) {
                if (s.has(b * nx + a)) return true;
            }
        }
        return false;
    };
    const G0 = new Set(L40_NW.group0);
    const G1 = new Set(L40_NW.group1);
    const ROCKS = new Set(L40_NW.rocks.map((r) => r.id));
    const arms = [
        ['shut', flood({})],
        ['+t0', flood({ openActivators: G0 })],
        ['+rocks', flood({ openActivators: G0, brokenRocks: ROCKS })],
        ['+t1', flood({ openActivators: new Set([...G0, ...G1]), brokenRocks: ROCKS })],
    ];
    for (const [n, s] of arms) console.log(`   ${n.padEnd(7)} ${s.size}`);
    check(arms.map(([, s]) => s.size).join(' ') === L40_NW.flood.join(' '),
        '⛓⛓ THE CLUSTER OPENS IN FOUR STEPS — 728 / 760 / 776 / 968',
        `[${arms.map(([, s]) => s.size).join(' ')}] against [${L40_NW.flood.join(' ')}]`);
    const p0 = { tx: L40_NW.part.x / TILE_SIZE, ty: L40_NW.part.y / TILE_SIZE };
    check(arms.slice(0, 3).every(([, s]) => !has(s, p0.tx, p0.ty))
        && has(arms[3][1], p0.tx, p0.ty),
        '⛓⛓⛓ …and ONLY THE LAST puts `totempart 0` in reach — the order is forced',
        `part 0 at tile (${p0.tx},${p0.ty}): `
        + `${arms.map(([n, s]) => `${n}=${has(s, p0.tx, p0.ty)}`).join(' ')}. ⛔ A cluster `
        + 'whose links can be driven in any order is not a chain; this one cannot.');
}

const centre = (t) => ({ x: t.tx * TILE_SIZE + TILE_SIZE / 2, y: t.ty * TILE_SIZE + TILE_SIZE / 2 });
let out = null;
let failure = null;
try {
    out = synthesizeLegs([{
        level: 40,
        targets: [
            // link 11a — the `room = -1` SELF-LATCH. §20.6: the setter is
            // behind `if (a)`, so the group stays open when the player steps
            // off, which is what makes the rest of the leg possible at all.
            {
                x: L40_NW.buttonroom0.x + 8,
                y: L40_NW.buttonroom0.y + 8,
                hold: { presser: { ...L40_NW.buttonroom0 }, ticks: L40_NW.holdTicks },
            },
            // link 11b — the three rocks, in the order their own geometry
            // forces (the westmost is behind the two east of it).
            ...L40_NW.swings.map((sw) => ({
                ...sw.stance,
                spear: { rock: { x: sw.x, y: sw.y }, facing: sw.facing },
            })),
            // link 11c — the second self-latch.
            {
                x: L40_NW.buttonroom1.x + 8,
                y: L40_NW.buttonroom1.y + 8,
                hold: { presser: { ...L40_NW.buttonroom1 }, ticks: L40_NW.holdTicks },
            },
            // ⛓⛓⛓ THE CEREMONY.
            { ...centre(L40_NW.collectStance) },
            { ...centre(L40_NW.collectStance), collect: { pickup: { ...L40_NW.part } } },
        ],
    }], {
        levelSource,
        boot: { level: 40, ...L40_NW.boot },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 40, items: [...HELD] }],
            persistence: [],
            equips: [],
            roles: [...ROLES],
        },
        name: 'r5-l40-part0',
        lattice: L40_NW.lattice,
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
    description: '⛓⛓⛓ THE THIRD COLLECT CEREMONY — `totempart 0 @64,144`, behind L40\'s NW '
        + 'cluster. Four links in a forced order: `buttonroom@272,208 {t 0}` self-latches '
        + 'group 0, the three `breakablerock`s {tags 22,23,24} come down, '
        + '`buttonroom@160,128 {t 1}` self-latches group 1, and only THEN is the part in '
        + 'reach (728 / 760 / 776 / 968 nodes). ⚠ The tape BOOTS INTO THE CLUSTER: §24.5 '
        + 'makes this link 11 of a chain the L40 arrival cannot reach, and this proves the '
        + 'links and the ceremony, not the route to them. ⛔ Three modelled spinners share '
        + 'the room and none dies — `Spinner.removed()` writes its tag whatever killed it, '
        + 'where `Bob.removed()` is EMPTY.',
}));

const run = runTape(tape, { levelSource });
const end = run.ticks[run.ticks.length - 1];
console.log('\n## the drive');
console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} spans — ends L${end.level} `
    + `(${end.x.toFixed(2)},${end.y.toFixed(2)}) tile `
    + `(${Math.floor(end.x / TILE_SIZE)},${Math.floor(end.y / TILE_SIZE)})`);
console.log(`   collected: ${run.collected.map((c) => `t${c.t} item=${c.item ?? 'null'}`).join(', ') || 'NONE'}`);
console.log(`   rocks broken: ${run.rocksBroken.map((r) => r.id).join(', ') || 'none'}`);
console.log(`   lock writes: [${run.lockWrites.map((wr) => `${wr.flag.level}:${wr.flag.tag}=${wr.flag.value}`).join(' ')}]`);
console.log(`   earned clears: [${run.earnedClears.map((wr) => `${wr.level}:${wr.tag} by ${wr.by ?? '?'}`).join(' ')}]`);
console.log(`   spinner writes: ${run.spinnerWrites.map((s) => `{${s.flag.level},${s.flag.tag}} ${s.cause}`).join(', ') || 'none'}`);

console.log('\n## the claims');
check(run.collected.length === 1,
    '⛓⛓⛓ ONE COLLECT CEREMONY — `totempart 0`, the THIRD of the five',
    `${run.collected.length}`);
check(run.collected[0]?.item === null,
    '⛓ …and it banks no inventory property — a totem part is save-file state',
    `item = ${run.collected[0]?.item ?? 'null'}; `
    + '`hasTotemPart` is not in `Bot.itemReadout` (§20.8), so the 150 frozen frames are '
    + 'the claim.');
{
    const broke = run.rocksBroken.map((r) => r.id).sort();
    const want = [...new Set(L40_NW.swings.flatMap((sw) => sw.breaks))].sort();
    check(broke.join(' ') === want.join(' ') && broke.length === 3,
        '⛔⛔ …and all THREE rocks came down on TWO SWINGS — the collateral is NAMED',
        `[${broke.join(' ')}] from ${L40_NW.swings.length} swing(s). ⛔ `
        + '`breakablerock@176,128` and `breakablerock@176,144` are vertically adjacent '
        + 'and a slash is an AREA, so one swing takes both. The first cut of this leg '
        + 'aimed one swing per rock and `runSpear` refused target 2 with "ALREADY GONE '
        + 'before the press" — a positive control catching a plan that had the effect '
        + 'right and the cause wrong.');
}
{
    const got = [...new Set(run.earnedClears.map((wr) => `${wr.level}:${wr.tag}`))].sort();
    check(got.join(' ') === [...L40_NW.earned].sort().join(' '),
        '⛓⛓ …and the ledger is the three rock tags and the two buttonroom tags, exactly',
        `[${got.join(' ')}] against [${[...L40_NW.earned].sort().join(' ')}]`);
}
check(run.spinnerWrites.length === 0,
    '⛓⛓ …and NONE of the three spinners dies',
    `${run.spinnerWrites.length}. ⛔ Each `
    + 'is a kill-write on its own tag and a billiard earns it by bouncing into a hazard '
    + 'as readily as by being hit — so an empty list is a claim, not an absence. '
    + '⛓ Bob-family deaths, by contrast, would write NOTHING: `Bob.removed()` and '
    + '`BobSoldier.removed()` are empty bodies.');
check(run.transitions.length === 0 && run.transports.length === 0,
    '⛓ …without leaving L40, and without falling into L43',
    `${run.transitions.length} transition(s), ${run.transports.length} pit fall(s)`);

/**
 * ⛓⛓ THE SHUT-BEFORE CONTROL — every press deleted, the walk kept.
 *
 * ⚠ The buttonrooms are NOT presses and stay: they latch by being stood on,
 * and a control that could not latch group 0 would be stopped at the wrong
 * wall. What the deletion removes is exactly the three rock swings.
 */
const controlTape = parseTape(serializeTape({
    ...tape,
    name: 'r5-l40-part0-control',
    inputs: tape.inputs.filter((sp) => sp.key !== 'primary'),
    description: '⛓⛓ THE SHUT-BEFORE CONTROL for `r5-l40-part0`: the identical tape with '
        + 'the THREE rock swings deleted and every walk span byte-identical. The '
        + 'buttonrooms still latch — they are stood on, not pressed — so the arm isolates '
        + 'the rocks exactly: group 0 opens, group 1 opens, and the part is still behind '
        + 'three 16x16 solids. No ceremony.',
}));
{
    const cRun = runTape(controlTape, { levelSource });
    console.log('\n## the control arm');
    console.log(`   collected ${cRun.collected.length}, rocks broken `
        + `${cRun.rocksBroken.length}, spinner writes ${cRun.spinnerWrites.length}`);
    check(cRun.rocksBroken.length === 0,
        '⛓⛓ THE CONTROL BREAKS NO ROCK',
        `${cRun.rocksBroken.length}`);
    check(cRun.collected.length === 0,
        '⛓⛓⛓ …AND COLLECTS NOTHING — the ceremony belongs to the three swings',
        `${cRun.collected.length}. The part is 16x16 of pickup behind three 16x16 solids, `
        + 'and a `Pickup`\'s attraction does not reach through a wall.');
    check(cRun.spinnerWrites.length === 0,
        '⛓ …and kills no spinner either — the two arms are two worlds',
        `${cRun.spinnerWrites.length}. §27.5's control killed one with a pulser on an arm `
        + 'where nothing fought anything; every arm pays its own bill.');
}

let bad = 0;
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);

if (WRITE) {
    for (const t of [tape, controlTape]) {
        const path = join(MODULE, 'fixtures', 'tapes', `${t.name}.json`);
        writeFileSync(path, serializeTape(t));
        console.log(`\n   wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the tape)');
}
