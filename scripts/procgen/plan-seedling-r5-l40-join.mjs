#!/usr/bin/env node
/**
 * plan-seedling-r5-l40-join — LINKS 1 AND 2, AND THEY ARE ONE GATE.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 14 step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §24.5 / §27.10.
 *
 * ── THE GATE ──────────────────────────────────────────────────────────
 *
 * Row 51 of L40's south-east chamber is wall across columns 47-57 except at
 * (55,51), where `chest@880,816` stands; `burnabletree@872,784` is a 32x32
 * solid covering the four cells above it. §24.5 measured all three arms
 * from the arrival and this re-derives them:
 *
 * ```
 *   chest opened, tree standing    +4 cells   — one cell, into the tree
 *   tree burned, chest shut        +0 cells   — the chamber is still sealed
 *   BOTH                          +40 cells   — and `buttonroom@880,768` is in it
 * ```
 *
 * ⛓ **AND THE ORDER IS FORCED BY THE PLAY, NOT BY THE GEOMETRY.** §24.5's
 * one pixel of shared edge (`816 > 816` is false, so `Chest.update`'s
 * `!collide("Solid")` gate is satisfied with the tree standing) means
 * either link could go first *as a flag*. It cannot as a ROUTE: every
 * stance that reaches the tree is inside the chest's own cell, which is
 * Solid until the chest opens. So the chest is link 1 because the burn has
 * nowhere to stand until it is.
 *
 * ── ⚠ WHAT THIS LEG DOES NOT MODEL, NAMED RATHER THAN ASSUMED ────────
 *
 * The chamber holds `bobsoldier@880,832` — standing in the chest's own
 * stance band — two `Spinner`s ({40,15} and {40,16}) and two `Bob`s.
 *
 *   Bob / BobSoldier   ⛓ their `update()`s return on `Game.freezeObjects`,
 *                      so both DO hold still through the 331-frame seal
 *                      ceremony (source-verified: `Bob.as:52`,
 *                      `BobSoldier.as:76`)
 *   Bob motion         ⛔ NOT MODELLED, and not modellable cheaply: the LOS
 *                      test in both classes is COMMENTED OUT, so a bob
 *                      chases through walls within `runRange` 80. Neither
 *                      is Solid to the player and neither can wedge
 *                      anything (there is no pushable in this chamber), so
 *                      the route goes PAST them rather than around them.
 *   the ledger         ⛓⛓ `Bob.removed()` and `BobSoldier.removed()` are
 *                      EMPTY — a bob-family kill writes NOTHING. Only
 *                      `Spinner.removed()` writes, and unconditionally.
 *                      So the ledger claim here is exactly "no spinner
 *                      died", and `run.spinnerWrites` is what asserts it.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-l40-join.mjs
 *   node scripts/procgen/plan-seedling-r5-l40-join.mjs --write
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
const { chestStanceBand } = await import(join(MODULE, 'chest.js'));
const { HITBOX } = await import(join(MODULE, 'playerPhysicsV1.js'));
const { HIT_TO_GONE_TICKS } = await import(join(MODULE, 'burnableTree.js'));
const { L40_ARRIVAL, L40_JOIN, L40_CHAIN } = await import(join(MODULE, 'r5Totem.js'));

const WRITE = process.argv.includes('--write');
const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

const world = buildLevelWorld(levelSource(40), { roles: ROLES, inventory: held });
const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

console.log('## the gate');
{
    const chest = world.chests.find((c) => c.id === L40_JOIN.chest.id);
    const tree = world.burnableTrees.find((t) => t.id === L40_JOIN.tree.id);
    if (!chest || !tree) throw new Error('L40 is missing the chest or the tree');
    console.log(`   ${chest.id} {tag ${chest.persistTag}} at tile `
        + `(${chest.x / TILE_SIZE},${chest.y / TILE_SIZE})`);
    console.log(`   ${tree.id} {tag ${tree.tag}} rect [${tree.rect.x},${tree.rect.right}) x `
        + `[${tree.rect.y},${tree.rect.bottom})`);
    const band = chestStanceBand(chest.x, chest.y, HITBOX);
    console.log(`   the chest's stance band is y in {${band.join(', ')}} — TWO ROWS, and `
        + `bobsoldier@880,832 stands in them`);
    console.log('   chamber enemies: '
        + `${world.combat.enemies.filter((e) => e.x >= 700 && e.y >= 700)
            .map((e) => `${e.as3}@${e.x},${e.y}`).join(' ')}`);
}

console.log('\n## the three arms of the gate, re-derived');
{
    const P = L40_ARRIVAL.lattice;
    const nx = world.width * TILE_SIZE / P;
    const ny = world.height * TILE_SIZE / P;
    const walk = (tx, ty, o) => tx >= 0 && ty >= 0 && tx < nx && ty < ny
        && plannerObstacleAt(world, tx * P + P / 2, ty * P + P / 2, null,
            { avoidVolumes: false, ...o }) === null;
    const flood = (o) => {
        const seen = new Set();
        const key = (a, b) => b * nx + a;
        const from = [Math.floor(L40_ARRIVAL.spawn.x / P), Math.floor(L40_ARRIVAL.spawn.y / P)];
        if (!walk(from[0], from[1], o)) return seen;
        seen.add(key(from[0], from[1]));
        const q = [from];
        while (q.length) {
            const [x, y] = q.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const a = x + dx;
                const b = y + dy;
                if (seen.has(key(a, b)) || !walk(a, b, o)) continue;
                seen.add(key(a, b));
                q.push([a, b]);
            }
        }
        return seen;
    };
    const chestSet = new Set([L40_JOIN.chest.id]);
    const treeSet = new Set([L40_JOIN.tree.id]);
    const shut = flood({}).size;
    const chestOnly = flood({ openChests: chestSet }).size;
    const treeOnly = flood({ burnedTrees: treeSet }).size;
    const both = flood({ openChests: chestSet, burnedTrees: treeSet }).size;
    console.log(`   shut ${shut}; chest only ${chestOnly} (+${chestOnly - shut}); `
        + `tree only ${treeOnly} (+${treeOnly - shut}); both ${both} (+${both - shut})`);
    const want = L40_CHAIN.joinPairs;
    check(shut === L40_CHAIN.shutCells
        && chestOnly === want[0].cells && treeOnly === want[1].cells && both === want[2].cells,
        '⛓⛓ THE GATE IS TWO SOLIDS STACKED IN ONE CELL — +4 / +0 / +40, and NEITHER '
        + 'ALONE OPENS IT',
        `${shut} / ${chestOnly} / ${treeOnly} / ${both} against §24.5's `
        + `${L40_CHAIN.shutCells} / ${want[0].cells} / ${want[1].cells} / ${want[2].cells}. `
        + '⛔ An audit of either blocker alone reads as "no way through", which is exactly '
        + 'how a conjunctive gate hides.');
}

let out = null;
let failure = null;
try {
    out = synthesizeLegs([{
        level: 40,
        targets: [
            { ...L40_JOIN.approach, equip: { slot: L40_JOIN.fireSlot } },
            {
                ...L40_JOIN.chestStance,
                chest: { chest: { x: L40_JOIN.chest.x, y: L40_JOIN.chest.y } },
            },
            {
                ...L40_JOIN.burnStance,
                fire: {
                    burns: [{ x: L40_JOIN.tree.x, y: L40_JOIN.tree.y }],
                    wait: L40_JOIN.wait,
                },
            },
            { ...L40_JOIN.proof },
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
            roles: [...ROLES],
        },
        name: 'r5-l40-join',
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
    description: '⛓⛓⛓ L40 LINKS 1 AND 2 — the chest and the tree, which are ONE GATE. Row '
        + '51 of the south-east chamber is wall except at (55,51), where `chest@880,816` '
        + 'stands, and `burnabletree@872,784` is a 32x32 solid on the four cells above it: '
        + 'chest alone +4, tree alone +0, both +40. ⛓ The ORDER is forced by the route and '
        + 'not by the flags — every stance that reaches the tree is inside the chest\'s own '
        + 'cell. The chest is a SEAL CEREMONY (331 dead frames) and the burn is 41 ticks of '
        + 'a still-solid tree. ⚠ The chamber holds a bobsoldier in the chest\'s stance band '
        + 'and two spinners; bob-family `removed()` is EMPTY so a bob kill writes nothing, '
        + 'and the ledger claim is that no SPINNER died.',
}));

const run = runTape(tape, { levelSource });
const end = run.ticks[run.ticks.length - 1];
console.log('\n## the drive');
console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} spans — ends L${end.level} `
    + `(${end.x.toFixed(2)},${end.y.toFixed(2)}) tile `
    + `(${Math.floor(end.x / TILE_SIZE)},${Math.floor(end.y / TILE_SIZE)})`);
console.log(`   chest opens: ${run.chestOpens.map((c) => `t${c.t} ${c.id} tag ${c.persistTag}`).join(', ') || 'NONE'}`);
console.log(`   seal ceremonies: ${run.sealCollections.map((s) => `${s.from} ${s.deadFrames} dead frames`).join(', ') || 'NONE'}`);
console.log(`   tree burns: ${run.treeBurns.map((b) => `${b.id} fired t${b.t} gone t${b.goneAt} {${b.flag.level},${b.flag.tag}}`).join(', ') || 'NONE'}`);
console.log(`   spinner writes: ${run.spinnerWrites.map((s) => `{${s.flag.level},${s.flag.tag}} ${s.cause}`).join(', ') || 'none'}`);
console.log(`   earned clears: [${run.earnedClears.map((w) => `${w.level}:${w.tag} by ${w.by ?? '?'}`).join(' ')}]`);

console.log('\n## the claims');
const burn = run.treeBurns[0];
check(run.chestOpens.length === 1 && run.chestOpens[0].id === L40_JOIN.chest.id
    && run.chestOpens[0].persistTag === L40_JOIN.chest.persistTag,
    `⛓⛓⛓ LINK 1 — ${L40_JOIN.chest.id} OPENED, and its flag is {40,${L40_JOIN.chest.persistTag}}`,
    `[${run.chestOpens.map((c) => `${c.id} tag ${c.persistTag}`).join(' ') || 'none'}]`);
check(run.sealCollections.length === 1,
    '⛓⛓ …and the SealPiece it spawns is collected — a seal ceremony, in the game\'s own '
    + 'dead-frame count',
    `${run.sealCollections.length}; ${run.sealCollections[0]?.deadFrames ?? '?'} dead frames. `
    + '⚠ NOT one of the five COLLECT ceremonies the rung stops on — a seal is a `special` '
    + 'pickup and a totem part is a different pickup with a different controller. Counted '
    + 'separately on purpose.');
check(run.treeBurns.length === 1 && burn?.id === L40_JOIN.tree.id,
    `⛓⛓⛓ LINK 2 — ${L40_JOIN.tree.id} BURNED, and it is the only tree in the level`,
    `[${run.treeBurns.map((b) => b.id).join(' ') || 'none'}]`);
check(burn && burn.goneAt - burn.t === HIT_TO_GONE_TICKS,
    `⛓ …with the same ${HIT_TO_GONE_TICKS}-tick gap L37's tree measured`,
    `fired t${burn?.t}, gone t${burn?.goneAt}. Two trees, one transcription — and the `
    + 'second is what makes the first a constant rather than a coincidence.');
check(burn && burn.flag.level === 40 && burn.flag.tag === L40_JOIN.tree.tag,
    `⛓ …and the write is {40,${L40_JOIN.tree.tag}} — the brief's "{40,0}"`,
    `{${burn?.flag.level},${burn?.flag.tag}}`);
{
    /**
     * ⛔⛔ AND THE TWO WRITES ARE IN TWO DIFFERENT LISTS — measured here,
     * not designed.
     *
     * `earnedClears` carries `{40,0}` (the burn banks through
     * `rockFlags`, the same path a broken rock takes) and NOT `{40,13}`:
     * a chest's clear goes into `pendingEarnedClears`, which is CASHED
     * when the level it names is next built, and this run never leaves
     * L40. So a "whole ledger" claim summed from `earnedClears` alone
     * would silently drop the chest — the §24.7 shape again, one family
     * over. The sum has to name `chestOpens` too.
     */
    const got = [...new Set([
        ...run.earnedClears.map((w) => `${w.level}:${w.tag}`),
        ...run.chestOpens.filter((c) => c.persistTag >= 0)
            .map((c) => `${c.level}:${c.persistTag}`),
    ])].sort();
    const want = [...L40_JOIN.earned].sort();
    check(got.join(' ') === want.join(' '),
        '⛓⛓ …and the run\'s WHOLE ledger is those two writes — SUMMED ACROSS TWO LISTS, '
        + 'because the chest\'s clear is not in `earnedClears`',
        `[${got.join(' ')}] against [${want.join(' ')}]. ⛔ `
        + `earnedClears alone is [${run.earnedClears.map((w) => `${w.level}:${w.tag}`).join(' ')}]: `
        + 'a burn banks through `rockFlags` immediately and a chest banks through '
        + '`pendingEarnedClears`, which is CASHED when the level is next built — and this '
        + 'run never leaves L40. A ledger summed from one list would drop link 1 entirely '
        + 'while looking complete.');
}
check(run.spinnerWrites.length === 0,
    '⛓⛓ …and NEITHER of the chamber\'s two spinners dies',
    `${run.spinnerWrites.length}. ⛔ THE KILL-LEDGER RULE: \`Bob.removed()\` and `
    + '`BobSoldier.removed()` are EMPTY, so bob-family deaths write nothing at all — but '
    + '`Spinner.removed()` writes `setPersistence(tag, false)` with NO test of the cause, '
    + 'so a billiard that bounces into a hazard earns {40,15} or {40,16} on a tick no '
    + 'route chose. An empty list here is a claim.');
check(run.transitions.length === 0 && run.transports.length === 0,
    '⛓ …without leaving L40 — and without falling, which here is a ONE-WAY door into L43',
    `${run.transitions.length} transition(s), ${run.transports.length} pit fall(s)`);
{
    const proof = `${Math.floor(L40_JOIN.proof.x / TILE_SIZE)},${Math.floor(L40_JOIN.proof.y / TILE_SIZE)}`;
    const entered = run.ticks.filter((t) => `${Math.floor(t.x / TILE_SIZE)},`
        + `${Math.floor(t.y / TILE_SIZE)}` === proof);
    check(entered.length > 0,
        `⛓⛓⛓ …AND THE WALK ENTERS (${proof}) — the chamber the +40 opens, and `
        + '`buttonroom@880,768` is in it',
        `first entered at t${entered[0]?.t}. That chamber is link 3, which is what makes `
        + 'this pair the whole north half\'s doorway.');
    check(entered[0] && burn && entered[0].t >= burn.goneAt,
        '⛓ …and not one tick before the tree came down',
        `first entry t${entered[0]?.t} against goneAt t${burn?.goneAt}`);
}

/**
 * ⛓⛓ THE SHUT-BEFORE CONTROL — the press deleted, the chest kept.
 *
 * ⚠ THE CHEST STAYS OPEN IN THE CONTROL, and that is the point: the chest
 * is not a press, it opens on a probe row the walk crosses, so it cannot be
 * deleted by removing a span. What the control tests is therefore link 2
 * alone against link 1 alone — the +4 arm, measured live: with the chest
 * open and the tree standing the walk gets into (55,51) and no further.
 */
const controlTape = parseTape(serializeTape({
    ...tape,
    name: 'r5-l40-join-control',
    inputs: tape.inputs.filter((sp) => sp.key !== 'primary'),
    description: '⛓⛓ THE SHUT-BEFORE CONTROL for `r5-l40-join`: the identical tape with '
        + 'the ONE fire press deleted. ⚠ The chest still opens — it is a probe row the walk '
        + 'crosses, not a press — so this arm IS the +4 measurement, driven: the walk '
        + 'reaches the chest\'s own cell and the tree holds the four above it. The chamber '
        + 'behind the gate is never entered.',
}));
{
    const cRun = runTape(controlTape, { levelSource });
    const cEnd = cRun.ticks[cRun.ticks.length - 1];
    console.log('\n## the control arm');
    console.log(`   ${controlTape.tick_count} ticks — ends (${cEnd.x.toFixed(2)},`
        + `${cEnd.y.toFixed(2)}) tile (${Math.floor(cEnd.x / TILE_SIZE)},`
        + `${Math.floor(cEnd.y / TILE_SIZE)})`);
    console.log(`   chest opens ${cRun.chestOpens.length}, tree burns ${cRun.treeBurns.length}, `
        + `spinner writes ${cRun.spinnerWrites.length}`);
    check(cRun.treeBurns.length === 0,
        '⛓⛓ THE CONTROL BURNS NOTHING',
        `${cRun.treeBurns.length}`);
    check(cRun.chestOpens.length === 1,
        '⛓ …and STILL OPENS THE CHEST, which is what makes it the +4 arm rather than the '
        + 'shut one',
        `${cRun.chestOpens.length} — a chest is opened by standing on a probe row, so no `
        + 'span deletion can withhold it. The pair therefore isolates link 2 exactly.');
    const proof = `${Math.floor(L40_JOIN.proof.x / TILE_SIZE)},${Math.floor(L40_JOIN.proof.y / TILE_SIZE)}`;
    check(cRun.ticks.every((t) => `${Math.floor(t.x / TILE_SIZE)},`
        + `${Math.floor(t.y / TILE_SIZE)}` !== proof),
        `⛓⛓⛓ …AND IT NEVER ENTERS (${proof}) ON ANY TICK`,
        'the +40 chamber stays sealed on the arm that does not burn.');
    check(cRun.spinnerWrites.length === 0,
        '⛓ …and it kills no spinner either',
        `${cRun.spinnerWrites.length}. ⛔ §27.5's control killed one with a PULSER on an arm `
        + 'where nothing fought anything — a modelled position is a bill, and this arm has '
        + 'to pay it separately from the press arm. Two worlds, two evolutions.');
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
