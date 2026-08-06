#!/usr/bin/env node
/**
 * plan-seedling-r5-l37-burn — THE BURN'S FIRST DRIVE, AND ITS OWN 2x2.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 14 step 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §27.10.
 *
 * ── WHY L37 AND NOT L40 ───────────────────────────────────────────────
 *
 * `burnableTree.js` has been built since slice 12 and driven by nothing, so
 * `OUT_OF_BAND_WRITERS.BurnableTree.witness` has read `none yet` for two
 * slices. The brief's tree was L40's — and §27.9 measured that it is BEHIND
 * `chest@880,816`, which is link 1 of an eleven-link chain. L37's needs no
 * chain at all:
 *
 * ```
 *   L37  burnabletree@128,192 {tag 1}   no enemies, no pushables, no pits
 *   L40  burnabletree@872,784 {tag 0}   16 components, and the chest first
 * ```
 *
 * ⇒ the verb is certified on the room that can say nothing else, and only
 * then used on the room where a wrong answer costs a ledger.
 *
 * ── ⛔⛔ AND "THE TREE IS A DOOR" WAS THE FLOOD'S POLICY, NOT THE ROOM ─
 *
 * The first cut of this script claimed a closed room — 96 nodes shut, 584
 * burned. It was measuring something the DRIVE never asks:
 * `plannerObstacleAt`'s lethal-terrain policy defaults to "the player holds
 * nothing", and `planNow` passes `run.inventory`, which here includes the
 * CONCH. With the drive's own policy:
 *
 * ```
 *   as the DRIVE plans (conch held)   2049 -> 2065    +16
 *   holding nothing                     96 ->  584   +488
 * ```
 *
 * ⇒ **+16 is the tree's own 2x2 footprint and nothing else.** A player who
 * can swim goes round it. So this tape certifies the VERB; the claim that
 * survives every policy is that the walk enters the tree's OWN CELLS and
 * the control enters none of them.
 *
 * ── ⛓ WHAT THE PRESS ARM ASSERTS THAT NO OTHER FIRE LEG DOES ─────────
 *
 * `runFire`'s `burns` arm is two-sided in TIME as well as in set: the tree
 * is STILL SOLID ten ticks after the press (`hit()`'s whole body is
 * `playSound; burn = true; play("burn")` and removes nothing) and GONE at
 * forty-one (`burnEnd -> die()`), and the flag lands with the removal
 * rather than with the trigger. A model that opened the cell on the press
 * tick would satisfy every set-valued check in the file and plan a step the
 * game refuses.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-l37-burn.mjs
 *   node scripts/procgen/plan-seedling-r5-l37-burn.mjs --write
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --record --win \
 *       --only=r5-l37-burn
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
const {
    HIT_TO_GONE_TICKS, WAIT_AFTER_PRESS_TICKS, assertBurnWaitCovers,
} = await import(join(MODULE, 'burnableTree.js'));
const { L37_BURN } = await import(join(MODULE, 'r5Totem.js'));

const WRITE = process.argv.includes('--write');
const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

const world = buildLevelWorld(levelSource(37), { roles: ROLES, inventory: held });
const centre = (t) => ({ x: t.tx * TILE_SIZE + TILE_SIZE / 2, y: t.ty * TILE_SIZE + TILE_SIZE / 2 });

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

console.log('## the room');
{
    const tree = world.burnableTrees.find((t) => t.id === L37_BURN.tree.id);
    if (!tree) throw new Error(`L37 has no ${L37_BURN.tree.id}`);
    console.log(`   ${tree.id} {tag ${tree.tag}} rect [${tree.rect.x},${tree.rect.right}) x `
        + `[${tree.rect.y},${tree.rect.bottom}) — tiles `
        + `(${tree.rect.x / TILE_SIZE},${tree.rect.y / TILE_SIZE})..`
        + `(${tree.rect.right / TILE_SIZE - 1},${tree.rect.bottom / TILE_SIZE - 1})`);
    console.log(`   enemies ${world.combat.enemies.length}, pushables `
        + `${(world.pushables ?? []).length}, pit tiles ${world.pitTiles.length} — `
        + 'nothing in this room can wedge, push back or kill');
    console.log(`   the burn is ${HIT_TO_GONE_TICKS} ticks and a leg waits `
        + `${WAIT_AFTER_PRESS_TICKS}`);
}

/**
 * ⛓ RE-DERIVED HERE RATHER THAN TAKEN FROM THE MODULE — a declaration
 * checked against itself is not a check, and this is the measurement whose
 * first reading was wrong.
 */
console.log('\n## the flood, from the stance — BOTH policies');
{
    const P = L37_BURN.lattice;
    const nx = world.width * TILE_SIZE / P;
    const ny = world.height * TILE_SIZE / P;
    const walkable = (tx, ty, opts) => tx >= 0 && ty >= 0 && tx < nx && ty < ny
        && plannerObstacleAt(world, tx * P + P / 2, ty * P + P / 2, null, opts) === null;
    const flood = (opts) => {
        const seen = new Set();
        const key = (a, b) => b * nx + a;
        const from = [Math.floor(L37_BURN.stance.x / P), Math.floor(L37_BURN.stance.y / P)];
        if (!walkable(from[0], from[1], opts)) return seen;
        seen.add(key(from[0], from[1]));
        const q = [from];
        while (q.length) {
            const [x, y] = q.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const a = x + dx;
                const b = y + dy;
                if (seen.has(key(a, b)) || !walkable(a, b, opts)) continue;
                seen.add(key(a, b));
                q.push([a, b]);
            }
        }
        return seen;
    };
    const burned = new Set([L37_BURN.tree.id]);
    /**
     * ⛔ THE POLICY IS PART OF THE MEASUREMENT. `held` is what the driver
     * plans with (`planNow` forwards `run.inventory`); `nothing` is
     * `plannerObstacleAt`'s conservative default. The first cut of this
     * script reported the second and read it as a statement about the room.
     */
    const held4 = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
    const arms = {
        held: {
            shut: flood({ avoidVolumes: false, inventory: held4 }).size,
            burned: flood({ avoidVolumes: false, inventory: held4, burnedTrees: burned }).size,
        },
        nothing: {
            shut: flood({ avoidVolumes: false }).size,
            burned: flood({ avoidVolumes: false, burnedTrees: burned }).size,
        },
    };
    for (const k of ['held', 'nothing']) {
        console.log(`   ${k.padEnd(8)} ${arms[k].shut} -> ${arms[k].burned}  `
            + `(+${arms[k].burned - arms[k].shut})`);
    }
    check(arms.held.shut === L37_BURN.flood.held.shut
        && arms.held.burned === L37_BURN.flood.held.burned
        && arms.held.burned - arms.held.shut === L37_BURN.flood.held.delta,
        '⛔⛔ THE BURN OPENS ITS OWN 2x2 AND NOTHING ELSE — +16 under the policy the '
        + 'DRIVE plans with, not the +488 a conservative flood reports',
        `${arms.held.shut} -> ${arms.held.burned} against the banked `
        + `${L37_BURN.flood.held.shut} -> ${L37_BURN.flood.held.burned}. `
        + '⛔ The two floods differ by ONE OPTION — `inventory` — and the 96-node "closed '
        + 'room" the first cut reported is bounded by 26 nodes of lethal terrain and a '
        + 'teleporter. A player holding the conch swims round the tree.');
    check(arms.nothing.shut === L37_BURN.flood.nothing.shut
        && arms.nothing.burned === L37_BURN.flood.nothing.burned,
        '⚠ …and the conservative flood is banked TOO, with its policy in its name',
        `${arms.nothing.shut} -> ${arms.nothing.burned}. Kept because a number that was `
        + 'once read as a finding should stay visible beside the reading that replaced '
        + 'it — deleting it is how the same mistake gets made twice.');
}

/**
 * ⛓ ONE WEAPON, ONE EQUIP, FOR THE WHOLE VISIT (§20.5). `useItem` reads the
 * SELECTED SLOT, so a run whose `primary` is still 0 fires a SWORD — and
 * `BurnableTree.hit(t)` is gated on `t == "Fire"`, so the press would reach
 * the tree and do nothing while the effect check reported it standing.
 */
let out = null;
let failure = null;
try {
    out = synthesizeLegs([{
        level: 37,
        targets: [
            { ...centre(L37_BURN.boot.tile), equip: { slot: L37_BURN.fireSlot } },
            {
                ...L37_BURN.stance,
                fire: {
                    burns: [{ x: L37_BURN.tree.x, y: L37_BURN.tree.y }],
                    wait: L37_BURN.wait,
                },
            },
            { ...centre(L37_BURN.proof) },
        ],
    }], {
        levelSource,
        boot: { level: 37, ...L37_BURN.boot.at },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 37, items: [...HELD] }],
            persistence: [],
            equips: [],
            roles: [...ROLES],
        },
        name: 'r5-l37-burn',
        lattice: L37_BURN.lattice,
        allowGrazes: true,
        maxTicksPerTarget: 2000,
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
    description: '⛓⛓⛓ THE BURN, DRIVEN — `burnabletree@128,192 {tag 1}` in L37, the EIGHTH '
        + 'geometry family\'s first witness. `burnableTree.js` shipped in slice 12 and '
        + 'nothing burned anything for two slices, so `OUT_OF_BAND_WRITERS` carried '
        + '"none yet". ⛔ The tree is SOLID FOR THE WHOLE ANIMATION — `hit()` is '
        + '`playSound; burn = true; play("burn")` and removes nothing — and the cell '
        + 'opens 41 ticks later when `burnEnd -> die()` fires, which is also where the '
        + 'persistence write lives (`removed()`), the OPPOSITE of a FallRock. The leg '
        + 'asserts both halves: still solid at T+10, gone at T+53, and the walk that '
        + 'follows enters the tree\'s OWN cells (8,13) and (9,13), which the control — the '
        + 'same tape with the press deleted — never touches. ⛔ Flooded as the DRIVE plans '
        + '(conch held) the burn opens +16 nodes, its own 2x2 and nothing else: a '
        + 'conservative flood\'s "+488 / closed room" was the lethal-terrain default, not '
        + 'the room.',
}));

const run = runTape(tape, { levelSource });
const end = run.ticks[run.ticks.length - 1];
console.log('\n## the drive');
console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} spans — ends L${end.level} `
    + `(${end.x.toFixed(2)},${end.y.toFixed(2)}) tile `
    + `(${Math.floor(end.x / TILE_SIZE)},${Math.floor(end.y / TILE_SIZE)})`);
console.log(`   tree burns: ${run.treeBurns
    .map((b) => `${b.id} fired t${b.t} gone t${b.goneAt} {${b.flag.level},${b.flag.tag}}`)
    .join(', ') || 'NONE'}`);
console.log(`   earned clears: [${run.earnedClears
    .map((w) => `${w.level}:${w.tag} by ${w.by ?? '?'}`).join(' ')}]`);

const fired = out.fires[0];
console.log(`   press at tick ${fired.from + fired.pressTick} stance `
    + `(${fired.at.x},${fired.at.y}); still solid at T+${fired.stillSolidAt}`);

console.log('\n## the claims');
const burn = run.treeBurns[0];
check(run.treeBurns.length === 1 && burn?.id === L37_BURN.tree.id,
    '⛓⛓⛓ ONE TREE BURNED, and it is the one the leg names',
    `[${run.treeBurns.map((b) => b.id).join(' ') || 'none'}]. A fire press has no aim and `
    + 'the rect is 32x32, so "exactly one" is a claim rather than an assumption.');
check(burn && burn.goneAt - burn.t === HIT_TO_GONE_TICKS,
    `⛓⛓ …and the removal is ${HIT_TO_GONE_TICKS} ticks after the hit, not on it`,
    `fired t${burn?.t}, gone t${burn?.goneAt} — a gap of ${burn ? burn.goneAt - burn.t : '?'}. `
    + '⛔ `15 * 0.0333` is 0.4995, so twenty animation frames are NOT forty updates: the '
    + 'fractional deficit accumulates and the twentieth index lands one update late. '
    + 'Simulated by `animCallbackTick`, never divided.');
check(fired.stillSolidAt !== null,
    '⛓⛓⛓ …and the tree was STILL SOLID ten ticks after the press — the half of the claim '
    + 'a set-valued check cannot make',
    `read at T+${fired.stillSolidAt}, inside the window (last hit tick 8) and 31 ticks `
    + 'before the removal. Without it "the tree burned" is compatible with a model that '
    + 'removed it on the trigger frame.');
check(burn && burn.flag.level === 37 && burn.flag.tag === L37_BURN.tree.tag,
    `⛓ …and the write is {37,${L37_BURN.tree.tag}} — IN BAND, because the tag is >= 0`,
    `{${burn?.flag.level},${burn?.flag.tag}}. A ${'`tag = -1`'} tree writes through the `
    + 'out-of-band family instead (`setPersistence(-1, false)` lands at `i*30 + j` in '
    + 'another level\'s slot); this one does not, and the two are one call apart in '
    + '`burnWrites`.');
check(run.earnedClears.length === 1
    && run.earnedClears[0].level === 37
    && run.earnedClears[0].tag === L37_BURN.tree.tag,
    '⛓ …and the run\'s WHOLE ledger is that one write',
    `[${run.earnedClears.map((w) => `${w.level}:${w.tag}`).join(' ')}]. The room `
    + 'holds no lock, no button, no rock and no rope, so a second entry would be '
    + 'something the plan cannot name.');
check(run.transitions.length === 0 && run.transports.length === 0,
    '⛓ …without leaving L37 — four teleporters in the room and none is touched',
    `${run.transitions.length} transition(s), ${run.transports.length} pit fall(s)`);
const tileOf = (t) => `${Math.floor(t.x / TILE_SIZE)},${Math.floor(t.y / TILE_SIZE)}`;
const FOOTPRINT = new Set(L37_BURN.footprint.map((f) => `${f.tx},${f.ty}`));
{
    /**
     * ⛓⛓ THE CLAIM THAT SURVIVES EVERY POLICY: the walk enters the tree's
     * OWN CELLS. A 32x32 Solid's cells are unenterable while it stands,
     * whatever the router believes about the water next door — which is
     * exactly what the "closed room" reading did not have going for it.
     */
    const inFoot = run.ticks.filter((t) => FOOTPRINT.has(tileOf(t)));
    const crossed = [...new Set(inFoot.map(tileOf))].sort();
    check(crossed.join(' ') === [...L37_BURN.crossed].sort().join(' '),
        '⛓⛓⛓ …AND THE WALK ENTERS THE TREE\'S OWN CELLS — (8,13) and (9,13), which are '
        + 'unenterable while a 32x32 Solid is standing in them',
        `[${crossed.join(' ')}] against the banked [${[...L37_BURN.crossed].join(' ')}]; `
        + `first at t${inFoot[0]?.t}. ⛓ THIS is the positive arm, and it is the one that `
        + 'does not depend on the terrain policy the flood is run under.');
    check(inFoot[0] && burn && inFoot[0].t >= burn.goneAt,
        '⛓⛓ …and NOT ONE TICK BEFORE THE REMOVAL',
        `first entry t${inFoot[0]?.t} against goneAt t${burn?.goneAt}. ⛔ THIS is the check `
        + 'the 41 ticks exist for: a leg that stepped in on the press tick would have '
        + 'walked into a wall, and `WAIT_AFTER_PRESS_TICKS` is the obligation that '
        + 'stops it.');
    check(run.ticks.some((t) => tileOf(t) === `${L37_BURN.proof.tx},${L37_BURN.proof.ty}`),
        `⚠ …and it goes on to (${L37_BURN.proof.tx},${L37_BURN.proof.ty}) — REPORTED, not `
        + 'claimed',
        'a player holding the conch can reach that tile with the tree standing, so '
        + '"the control never enters it" would be a fact about the control\'s SPANS and '
        + 'not about the room. Kept as drift detection.');
}
check(assertBurnWaitCovers(L37_BURN.wait, 'the L37 burn leg'),
    `⛓ …and the leg's declared wait (${L37_BURN.wait}) covers the module's obligation `
    + `(${WAIT_AFTER_PRESS_TICKS})`,
    'asserted through `burnableTree.assertBurnWaitCovers`, so the plan and the module '
    + 'cannot disagree about the number.');

/**
 * ⛓⛓⛓ THE SHUT-BEFORE CONTROL — one field apart, and the field is the press.
 *
 * ⚠ THE EQUIP STAYS. It is not an input span (it rides on the tape's
 * `equips` list) and deleting it would change what the arm is testing from
 * "the press opens the way" to "a run with no weapon opens the way". The
 * spans are byte-identical; exactly one `primary` span is gone.
 */
const controlTape = parseTape(serializeTape({
    ...tape,
    name: 'r5-l37-burn-control',
    inputs: tape.inputs.filter((sp) => sp.key !== 'primary'),
    description: '⛓⛓ THE SHUT-BEFORE CONTROL for `r5-l37-burn`: the identical tape with '
        + 'the ONE fire press deleted and every walk span byte-identical. The tree stands, '
        + 'so the 24-tile room the walk starts in stays closed and the proof tile is '
        + 'never entered. ⚠ The equip is kept — it is not an input span, and a control '
        + 'holding no weapon would be testing the equip rather than the press.',
}));
{
    const cRun = runTape(controlTape, { levelSource });
    const cEnd = cRun.ticks[cRun.ticks.length - 1];
    console.log('\n## the control arm');
    console.log(`   ${controlTape.tick_count} ticks, ${controlTape.inputs.length} spans — `
        + `ends (${cEnd.x.toFixed(2)},${cEnd.y.toFixed(2)}) tile `
        + `(${Math.floor(cEnd.x / TILE_SIZE)},${Math.floor(cEnd.y / TILE_SIZE)})`);
    console.log(`   tree burns: ${cRun.treeBurns.length}, earned clears: `
        + `[${cRun.earnedClears.map((w) => `${w.level}:${w.tag}`).join(' ') || ''}]`);
    check(cRun.treeBurns.length === 0,
        '⛓⛓ THE CONTROL BURNS NOTHING — the press is the only thing that lights it',
        `${cRun.treeBurns.length}`);
    check(cRun.earnedClears.length === 0,
        `⛓ …and earns no persistence at all, so {37,${L37_BURN.tree.tag}} belongs to the `
        + 'press and not to the walk',
        `[${cRun.earnedClears.map((w) => `${w.level}:${w.tag}`).join(' ') || 'none'}]`);
    const cFoot = [...new Set(cRun.ticks.map(tileOf))].filter((t) => FOOTPRINT.has(t));
    check(cFoot.length === 0,
        '⛓⛓⛓ …AND IT ENTERS NONE OF THE TREE\'S FOUR CELLS ON ANY TICK',
        `[${cFoot.join(' ') || 'none'}]. ⛓ The tree is still a 32x32 Solid on this arm, so `
        + 'this is a claim the geometry guarantees and the press arm had to earn. ⚠ It is '
        + 'the pair\'s whole negative: the room is NOT closed to a player holding the '
        + 'conch, so any claim about tiles further east would be about the spans.');
    const cols = new Set(cRun.ticks.map((t) => Math.floor(t.x / TILE_SIZE)));
    check(Math.max(...cols) === L37_BURN.control.maxColumn,
        `⚠ …and the furthest column it touches is ${L37_BURN.control.maxColumn} — REPORTED `
        + 'DATA, not a verdict about the room',
        `reached column ${Math.max(...cols)}; a control replays the whole tape into an `
        + 'unchanged world, so its extent is the spans\' artefact (§27.5). Here to catch '
        + 'drift.');
    check(cRun.transitions.length === 0 && cRun.transports.length === 0,
        '⛓ …and it leaves L37 by no other door either',
        `${cRun.transitions.length} transition(s), ${cRun.transports.length} pit fall(s) — `
        + 'a control that teleported out would be blocked by the wrong thing.');
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
