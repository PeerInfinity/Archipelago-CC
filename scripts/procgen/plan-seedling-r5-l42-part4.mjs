#!/usr/bin/env node
/**
 * plan-seedling-r5-l42-part4 — ⛓⛓⛓ THE ROUND TRIP, DRIVEN: THREE CHAINS,
 * THE PART, AND THE EXIT TAKEN.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 19 step 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §32.8 (this slice's own
 * first job), §31 (the round trip priced) and §30.8 (the room read as a
 * pursuit). `r5Totem.L42_SOLVE` is the ordering and the three chains.
 *
 * ── ⛓⛓⛓ WHY THE GOAL IS THE ROUND TRIP AND NOT THE REACH ─────────────
 *
 * L42 holds no activator, no presser and no pushable: one part, two
 * crushers and a 2-tile corridor. §31 priced it as
 *
 *     arrival (15,20)  ->  totempart 4 @184,152  ->  teleporter@240,336
 *
 * — and the teleporter is ONE TILE BELOW the arrival, so a plan that parks
 * the crushers anywhere in the row-13/14 return corridor collects the part
 * and strands the player. The answer parks both bodies in the TOP ROOM,
 * which is the one part of the level nothing else needs, and it takes NINE
 * charges in three chains to get them there.
 *
 * ── ⛓⛓ AND EVERY ESCAPE IN IT IS A ONE-PIXEL SEAM ────────────────────
 *
 * `laneHitsPlayer` is inclusive on all four edges where the swept body's
 * own overlap is strict (§29.5), so a player box sitting exactly on a
 * lane's edge is SEEN from a cell the charging body passes one pixel away.
 * Chain 1 rides that seam at the col-6 shaft (§32.2); chain 3 rides it in
 * the nook at tile (6,4), the only free cell in row 4 of a room whose two
 * rows a 32 px body fills.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-l42-part4.mjs [--write] [--map]
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const {
    synthesizeLegs, plannerObstacleAt, livePerVisitOpts,
} = await import(join(MODULE, 'botDriverV2.js'));
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { runTape, createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { assertWindowEndsAtRest } = await import(join(MODULE, 'director.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { fadeBand, describeFadeBand } = await import(join(MODULE, 'deadFrameBand.js'));
const { CEREMONY_DEAD_FRAMES } = await import(join(MODULE, 'sealCeremony.js'));
const { L42_PART4, L42_SOLVE } = await import(join(MODULE, 'r5Totem.js'));
const {
    detectionRects, laneHitsPlayer, scanCrusher, crusherRect,
} = await import(join(MODULE, 'crusher.js'));

const WRITE = process.argv.includes('--write');
const MAP = process.argv.includes('--map');
const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

const A = 'crusher@96,144';
const B = 'crusher@128,144';
const BOOT = Object.freeze({
    level: 42,
    x: L42_PART4.arrival.tx * TILE_SIZE,
    y: L42_PART4.arrival.ty * TILE_SIZE,
});
const EXIT = Object.freeze({ x: 240, y: 336 });
/**
 * ⛓ The trailing idle ticks, spent in L40. `synthesizeLegs` stops its tick
 * counter on the transition, and `assertWindowEndsAtRest` wants coast after
 * the last released span — so the window is extended past its last input
 * rather than cut on it, and the two parked crushers step through every one
 * of those ticks in the room the player has just left.
 */
const REST_TICKS = 30;

const world = buildLevelWorld(levelSource(42), { roles: ROLES, inventory: held });
const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });
const centre = (tx, ty) => ({ x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 });
const tile = (p) => `(${Math.floor(p.x / TILE_SIZE)},${Math.floor(p.y / TILE_SIZE)})`;

console.log('## the room');
console.log(`   arrival tile (${L42_PART4.arrival.tx},${L42_PART4.arrival.ty}), `
    + `part @${L42_PART4.part.x},${L42_PART4.part.y}, exit teleporter @${EXIT.x},${EXIT.y}`);
console.log(`   ⛔ ${L42_PART4.flood.nodes} nodes from the arrival with both crushers home — `
    + `part reachable ${L42_PART4.flood.partReachable}`);
console.log(`   ⛓ the ordering: ${L42_SOLVE.ordering.map((s) => `${s.id === A ? 'A' : 'B'}${s.dir}`).join(' ')}`);
for (const c of L42_PART4.crushers) {
    const r = crusherRect(c.home);
    console.log(`   ${c.id} home (${c.home.x},${c.home.y}) body [${r.x},${r.right}) x [${r.y},${r.bottom})`);
}

/**
 * ⛓⛓⛓ THE DIPSTICK, DECLARED BEFORE THE DRIVE. A crusher's position is in
 * no readout the game emits (§30.4), so what a park is asserted BY is where
 * the player is allowed to stand. Both crushers' constructor bodies sit
 * across the only corridor to the part — rows 9,10 at cols 6..9 — so the
 * route to `totempart 4` walks through 32x32 of crusher twice over, and the
 * control arm, whose crushers never move, cannot enter either cell.
 */
const DIPSTICKS = L42_SOLVE.dipsticks;
for (const d of DIPSTICKS) {
    const c = L42_PART4.crushers.find((x) => x.id === d.of);
    const r = crusherRect(c.home);
    const p = centre(d.tx, d.ty);
    const box = playerBoxAt(p.x, p.y);
    const inside = box.x < r.right && box.right > r.x && box.y < r.bottom && box.bottom > r.y;
    check(inside,
        `⛓⛓ DIPSTICK (${d.tx},${d.ty}) IS INSIDE ${d.of}'s CONSTRUCTOR BODY`,
        `player box [${box.x},${box.right}) x [${box.y},${box.bottom}) against `
        + `[${r.x},${r.right}) x [${r.y},${r.bottom}). A park is a POSITION nothing in `
        + 'the game\'s stream reports, so the witness is the WALK: this cell is inside a '
        + '32x32 Solid until the chain that moves it runs, and the control arm never '
        + 'enters it.');
}

// ── the leg ───────────────────────────────────────────────────────────
const baitOf = (crusher, chain, stance) => ({
    ...centre(stance.tx, stance.ty),
    bait: {
        crusher,
        approach: chain.approach.map((s) => ({ ...s })),
        spans: chain.spans.map((s) => ({ ...s })),
        park: { ...chain.park },
    },
});

/**
 * ⛓⛓⛓ THREE CHAINS, THREE BAITS, NINE CHARGES. Each `bait` is one
 * crusher's whole chain — the escape from every charge lands in the lane of
 * the next, so the three charges are one continuous choreography and the
 * verb sees one park (§30.8's shape, three times over).
 *
 * ⛓ The `{approach, spans}` split is MEASURED and not authored: the
 * approach is every tick up to and including the one the body first moves
 * on. Chains 1 and 2 are SEVEN ticks — both stances sit one step outside
 * the lane, which is §30.3's "the approach IS the trigger" falling out of
 * the search rather than being designed in — and chain 3 is NINETEEN,
 * because its crusher is parked twelve tiles east of the stance and the
 * walk into the west lane is three spans long.
 */
const targets = [
    baitOf({ x: 96, y: 144 }, L42_SOLVE.escape, L42_PART4.chainA.stance),
    baitOf({ x: 128, y: 144 }, L42_SOLVE.chain2, L42_SOLVE.chain2.stance),
    baitOf({ x: 96, y: 144 }, L42_SOLVE.chain3, L42_SOLVE.chain3.stance),
    /**
     * ⛓⛓ THE DIPSTICKS, WALKED. Both are cells a 32x32 crusher occupied
     * when the level was built; standing in them is the park's witness in
     * the only stream the game gives (§30.4).
     */
    ...DIPSTICKS.map((d) => centre(d.tx, d.ty)),
    /**
     * ⛓⛓⛓ THE CEREMONY. The stance is the chamber cell WEST of the part;
     * `runCollect` walks from it into the volume and the game's own 150
     * frozen frames are the claim — `BossTotemPart.removed()` is
     * `Player.hasTotemPartSet(4, true)`, save-file state, so this window
     * banks NOTHING in the persistence ledger (§30.7).
     */
    { ...centre(L42_SOLVE.collectStance.tx, L42_SOLVE.collectStance.ty) },
    {
        ...centre(L42_SOLVE.collectStance.tx, L42_SOLVE.collectStance.ty),
        collect: { pickup: { x: L42_PART4.part.x, y: L42_PART4.part.y } },
    },
];

let out = null;
let failure = null;
try {
    out = synthesizeLegs([
        { level: 42, targets, exit: { ...EXIT } },
        { level: 40, targets: [] },
    ], {
        levelSource,
        boot: { ...BOOT },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 42, items: [...HELD] }],
            /** ⛓ L42 holds no persistence at all — no rock, no lock, no chest. */
            persistence: [],
            equips: [],
            /**
             * ⛓ PINS ON. `dead_frames` is what makes the ceremony's 150
             * frames a fixed number rather than a band term, and this
             * window's budget has TWO loads in it (the boot and L40) —
             * so the fade is the one part of the count that has a band.
             */
            pins: ['sound', 'dead_frames'],
            roles: [...ROLES],
        },
        name: 'r5-l42-part4',
        lattice: 8,
        allowGrazes: true,
        maxTicksPerTarget: 6000,
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
    tick_count: out.tape.tick_count + REST_TICKS,
    description: '⛓⛓⛓ THE ROUND TRIP, DRIVEN — `totempart 4 @184,152` in L42, and the '
        + 'EXIT TAKEN. The room is a PURSUIT: no activator, no presser, no pushable, one '
        + 'part, two crushers and a 2-tile corridor whose only route to the part runs '
        + 'through both of their constructor bodies. And the cost is the ROUND TRIP — '
        + '`teleporter@240,336` is one tile BELOW the arrival — so parking the bodies '
        + 'anywhere in the row-13/14 return corridor collects the part and strands the '
        + 'player. This parks both in the TOP ROOM, the one part of the level nothing '
        + 'needs: nine charges in three `bait` chains, A W/S/E, B W/N/E, A W/N/E. ⛓⛓ '
        + 'EVERY ESCAPE IS A ONE-PIXEL SEAM: `laneHitsPlayer` is inclusive where the '
        + 'swept body is strict, so the player is SEEN from cells the body passes one '
        + 'pixel from — the col-6 shaft for chain 1, the nook at tile (6,4) for chain 3, '
        + 'which is the only free cell in row 4 of a two-row room a 32 px body fills. '
        + 'Then the walk crosses BOTH vacated crusher cells (the park\'s only witness in '
        + 'the game\'s stream), collects the part, and leaves through the teleporter into '
        + 'L40.',
}));

const run = runTape(tape, { levelSource });
const end = run.ticks[run.ticks.length - 1];
console.log('\n## the drive');
console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} spans — ends L${end.level} `
    + `(${end.x.toFixed(2)},${end.y.toFixed(2)}) tile ${tile(end)}`);
for (const b of out.baits) {
    console.log(`   bait ${b.dir} ${b.crusherFrom.x},${b.crusherFrom.y} -> `
        + `${b.crusherTo.x},${b.crusherTo.y} (${b.approachTicks} approach + `
        + `${b.ticks - b.approachTicks} escape, t${b.from}..${b.to})`);
}
console.log(`   collected ${run.collected.length}, transitions ${run.transitions.length}, `
    + `frozen frames owed ${run.frozenFramesOwed}`);

// ── the claims ────────────────────────────────────────────────────────
console.log('\n## the claims');
{
    const got = out.baits.map((b) => `${b.crusherTo.x},${b.crusherTo.y}`).join(' ');
    const want = [L42_SOLVE.escape, L42_SOLVE.chain2, L42_SOLVE.chain3]
        .map((c) => `${c.park.x},${c.park.y}`).join(' ');
    check(got === want,
        '⛓⛓⛓ THREE BAITS, NINE CHARGES, AND BOTH BODIES END IN THE TOP ROOM',
        `[${got}] against [${want}]. ⛔ THE PARKS AND NOT THE DIRECTIONS: \`runBait\` `
        + `reports \`dir\` off the NET displacement ([${out.baits.map((b) => b.dir).join(' ')}]), `
        + 'which for a three-charge chain is not any single charge — chain 3 goes W 112, '
        + 'N 128, E 128 and nets (+16,-128), so the record says N while the last charge '
        + 'is E. ⛓ Each park is the run\'s own answer: `runBait` '
        + 'asserts the crusher was AT REST when the verb began, AWAKE when the approach '
        + 'ended (observed through `run.crushersParked`, not predicted through a second '
        + 'copy of the scan), parked at the declared POSITION when the escape did, and '
        + 'never once overlapping the player.');
}
check(run.crusherContacts.length === 0,
    '⛓⛓ ZERO CONTACTS — no tick of this tape has the player inside either 32x32 body',
    `${run.crusherContacts.length}. ⛔ \`Crusher.hit()\` deals 1000 ("KILL EVERYTHING"), `
    + 'so every one of these would be `die()` at any `hitsMax` and the run survives them '
    + 'only because `Bot.noDamage` is on. A choreography that is run over completes '
    + 'looking exactly like one that worked, which is why the count is a claim.');
{
    const visited = new Set();
    for (const t of run.ticks) {
        if (t.level !== 42) continue;
        visited.add(`${Math.floor(t.x / TILE_SIZE)},${Math.floor(t.y / TILE_SIZE)}`);
    }
    const missed = DIPSTICKS.filter((d) => !visited.has(`${d.tx},${d.ty}`));
    check(missed.length === 0,
        '⛓⛓⛓ THE PARKS\' WITNESS IS THE WALK — the player stands in BOTH vacated cells',
        `dipsticks [${DIPSTICKS.map((d) => `(${d.tx},${d.ty})`).join(' ')}], missed `
        + `[${missed.map((d) => `(${d.tx},${d.ty})`).join(' ') || 'none'}]. Neither cell `
        + 'is enterable while its crusher is home — they are the only corridor to the '
        + 'part and each is inside a 32x32 Solid — so the walk is the measurement the '
        + 'readout cannot make.');
}
check(run.collected.length === 1 && run.collected[0].item === null,
    '⛓⛓⛓ THE FIFTH COLLECT CEREMONY — `totempart 4`, and it banks no inventory property',
    `${run.collected.length} collect(s), item = ${run.collected[0]?.item ?? 'null'}. `
    + '`hasTotemPart` is not in `Bot.itemReadout` (§20.8) and `BossTotemPart.removed()` '
    + 'writes SAVE-FILE state rather than persistence (§30.7), so the game\'s 150 frozen '
    + 'frames are the whole of the claim — the same shape as parts 3, 2, 1 and 0.');
{
    /**
     * ⛓⛓ THE BUDGET, TERM FOR TERM AS THE VERIFIER COMPUTES IT. The model
     * owes `frozenFramesOwed` plus one `CEREMONY_DEAD_FRAMES.pickup` per
     * collect; what the GAME reports on top of that is the boot fade, and
     * this window has TWO loads in it — the boot into L42 and the arrival
     * in L40. ⛔ The fade is PER LEVEL
     * ([[feedback_dead_frame_constant_is_per_level]]), so a budget copied
     * from a single-room window would be one load short.
     */
    const loads = run.transitions.length + 1;
    const modelled = (run.frozenFramesOwed ?? 0)
        + run.collected.length * CEREMONY_DEAD_FRAMES.pickup;
    const band = fadeBand(loads);
    console.log(`   model owes ${modelled} frozen frames; the game should report `
        + `${(modelled + band.lo).toFixed(1)}..${(modelled + band.hi).toFixed(1)}`);
    check(run.transitions.length === 1 && loads === 2
        && modelled >= CEREMONY_DEAD_FRAMES.pickup,
    '⛓⛓⛓ THE EXIT IS TAKEN — one transition, so the budget carries TWO loads',
    `${loads} load(s), model owes ${modelled} frozen frames (${CEREMONY_DEAD_FRAMES.pickup} `
        + `of them the pickup) and the fade band is ${describeFadeBand(loads)}. ⛓ The `
        + 'game-side number is the recorded differential\'s claim, not this script\'s: '
        + 'what is asserted here is that the window is a two-load window and that the '
        + 'ceremony is in it.');
}
{
    const t = run.transitions[0];
    check(t?.from_level === 42 && t?.to_level === 40,
        '⛓⛓ …AND IT CROSSES INTO L40, WHERE THE ARRIVAL IS THE TELEPORTER THE ROOM WAS '
            + 'ENTERED BY',
        `L${t?.from_level} -> L${t?.to_level} at t${t?.t}. \`teleporter@240,336\` names `
        + '`playerx 848 / playery 16`, and `L40 teleporter@848,0` names `240,320` — the '
        + 'arrival this window booted at. The round trip is closed by the level data, '
        + 'not by the plan.');
}
{
    const last = run.ticks[run.ticks.length - 1];
    check(last.level === 40,
        '⛓⛓ THE WINDOW COMES TO REST IN L40',
        `ends L${last.level} at (${last.x.toFixed(2)},${last.y.toFixed(2)}) tile `
        + `${tile(last)} after ${REST_TICKS} trailing idle ticks. A door mid-window is `
        + 'established practice (the two-leg `r5-karlore-fire` pair); what a window may '
        + 'not do is end mid-transition.');
    const rest = assertWindowEndsAtRest(tape);
    check(rest.length === 0,
        '⛓ …AT REST — the last span releases with coast to spare',
        rest.length === 0 ? `${REST_TICKS} trailing idle ticks past the last input.`
            : rest.join('; '));
}
check(run.lockWrites.length === 0 && run.transports.length === 0,
    '⛓ THE LEDGER IS EMPTY, AND NOTHING FELL',
    `${run.lockWrites.length} lock write(s), ${run.transports.length} pit fall(s). L42 `
    + 'holds no `Lock`, no `breakablerock` and no chest, and the part writes save-file '
    + 'state — so this window EARNS nothing and DECLARES nothing, and the ceremony is '
    + 'the only thing in it that the persistence ledger could have been confused for.');

/**
 * ⛔⛔ THE PARKED-SCANNER AUDIT, one room along. §29.8: a park is a POSITION
 * and not a state, so everything this leg does AFTER the third bait — two
 * dipstick cells, a collect walk, 150 frozen frames and the length of the
 * room to the teleporter — happens beside two crushers re-scanning eight
 * 64 px lanes every tick. The tape is REPLAYED and every tick's player box
 * is put to the same `scanCrusher` the run steps, against that tick's own
 * solid list.
 */
const audit = (() => {
    const bait3 = out.baits[out.baits.length - 1];
    const stepper = createTapeStepper(tape, { levelSource });
    let r = stepper.next();
    const hot = [];
    const moved = [];
    let closest = null;
    let ticks = 0;
    /**
     * ⛔ THE LAST L42 TICK'S POSITIONS, and they are read HERE because
     * `run.crushers` at the end of the tape is L40's map — the window ends
     * in the room next door, so "where did they finish" is a question about
     * the last tick that was still in this one.
     */
    let lastInRoom = null;
    while (!r.done) {
        const { observation, crushers, crusherScans } = r.value;
        const t = observation.t;
        if (t >= bait3.to && crushers && observation.level === 42) {
            ticks += 1;
            const box = playerBoxAt(observation.x, observation.y);
            lastInRoom = { t, at: new Map([...crushers].map(([id, c]) => [id, { x: c.x, y: c.y }])) };
            for (const [id, c] of crushers) {
                const park = L42_SOLVE.parks[id];
                if (c.x !== park.x || c.y !== park.y) moved.push({ t, id, x: c.x, y: c.y });
                const s = crusherScans.get(id);
                if (s && s.dir !== null) hot.push({ t, id, dir: s.dir, x: observation.x, y: observation.y });
                for (const lane of detectionRects({ x: c.x, y: c.y })) {
                    const d = Math.max(lane.x - box.right, box.x - lane.right,
                        lane.y - box.bottom, box.y - lane.bottom);
                    if (closest === null || d < closest.d) {
                        closest = { d, t, id, dir: lane.dir, x: observation.x, y: observation.y };
                    }
                }
            }
        }
        r = stepper.next();
    }
    return { hot, moved, closest, ticks, lastInRoom, result: r.value };
})();

console.log('\n## the parked-scanner audit');
console.log(`   ${audit.ticks} L42 ticks from the third bait's last (t${out.baits[2].to})`);
console.log(`   a crusher off its park on ${audit.moved.length} of them`);
console.log(`   player inside a live lane on ${audit.hot.length} of them`);
console.log(`   nearest approach to any of the eight lanes: ${audit.closest.d.toFixed(2)} px `
    + `at t${audit.closest.t} (${audit.closest.id} ${audit.closest.dir})`);

{
    const at = audit.lastInRoom.at;
    check(at.get(A).x === L42_SOLVE.parks[A].x && at.get(A).y === L42_SOLVE.parks[A].y
        && at.get(B).x === L42_SOLVE.parks[B].x && at.get(B).y === L42_SOLVE.parks[B].y,
    '⛓⛓ BOTH BODIES ARE STILL ON THEIR PARKS ON THE LAST TICK IN THE ROOM',
    `${A} (${at.get(A).x},${at.get(A).y}), ${B} (${at.get(B).x},${at.get(B).y}) at `
    + `t${audit.lastInRoom.t}, against the ordering's `
    + `(${L42_SOLVE.parks[A].x},${L42_SOLVE.parks[A].y}) and `
    + `(${L42_SOLVE.parks[B].x},${L42_SOLVE.parks[B].y}). ⛔ Read at the last L42 tick and `
    + 'not at the end of the tape: this window ENDS IN L40, so `run.crushers` there is '
    + 'the next room\'s map and a check written against it would compare two undefineds '
    + 'and pass.');
}
check(audit.moved.length === 0,
    '⛓⛓⛓ NEITHER BODY MOVES AGAIN — every tick after the third bait',
    `${audit.moved.length} of ${audit.ticks} tick(s) off a park`
    + `${audit.moved.length ? `, first t${audit.moved[0].t} ${audit.moved[0].id} at (${audit.moved[0].x},${audit.moved[0].y})` : ''}`
    + '. ⛔ The corridor the player returns through is the corridor a woken crusher '
    + 'would close: A parked at (208,96) charging west reaches x = 128, and the col-6 '
    + 'shaft and the part chamber are both under its south lane\'s reach.');
check(audit.hot.length === 0,
    '⛓⛓ …and neither was ever CLOSE — `scan.dir` is null on every one of those ticks',
    `${audit.hot.length} tick(s) with the player in a lane and a clear line`
    + `${audit.hot.length ? `, first t${audit.hot[0].t} ${audit.hot[0].id} dir ${audit.hot[0].dir}` : ''}`
    + '. Two different claims: the position is the MEASUREMENT, `scan.dir === null` is '
    + 'the MECHANISM (§30.6), and a route that stayed clear by luck of a tick would pass '
    + 'the first and fail this.');
check(audit.closest.d > 0,
    '⛓ …and the nearest approach to any lane is OUTSIDE it',
    `${audit.closest.d.toFixed(2)} px at t${audit.closest.t}. ⚠ The lane test is `
    + '`World.collideRect` — four `>=`/`<=` where every other overlap in this package is '
    + 'strict — so a clearance of exactly 0 would be INSIDE it (§29.5). That convention '
    + 'is also what makes both escapes possible, which is why it is never tidied.');

if (MAP) {
    const P = 8;
    const nx = world.world.width / P;
    const ny = world.world.height / P;
    const replay = createLevelRun({
        levelSource, boot: { ...BOOT }, inventory: held, noDamage: true, roles: [...ROLES],
    });
    for (const [id, park] of Object.entries(L42_SOLVE.parks)) {
        const c = replay.crushers.get(id);
        c.x = park.x;
        c.y = park.y;
    }
    const opts = livePerVisitOpts(replay);
    console.log('\n## the two parked crushers\' live volume, on the 8 px lattice '
        + '(# blocked, . cold, E/N/W/S hot)');
    console.log(`     ${[...Array(nx).keys()].map((i) => (i % 2 ? ' ' : String(Math.floor(i / 2) % 10))).join('')}`);
    for (let b = 0; b < ny; b += 1) {
        let line = '';
        for (let a = 0; a < nx; a += 1) {
            const px = a * P + P / 2;
            const py = b * P + P / 2;
            if (plannerObstacleAt(world, px, py, null, { ...opts, avoidVolumes: false, inventory: held })) {
                line += '#';
                continue;
            }
            let mark = '.';
            for (const [id, park] of Object.entries(L42_SOLVE.parks)) {
                const s = scanCrusher({ ...park }, playerBoxAt(px, py), { x: px, y: py },
                    replay.world.solidBoxesForMover(opts, id));
                if (s.dir !== null) mark = s.dir;
            }
            line += mark;
        }
        console.log(`${String(b).padStart(3)}${b % 2 ? ' ' : '|'} ${line}`);
    }
}

/**
 * ── ⛓⛓ THE CONTROL ARM, AND THE OBVIOUS ONE IS NOT A CONTROL ──────────
 *
 * L42 has no flag to withhold: no rock shields these crushers, no lock
 * gates the room, no item is needed. So the isolating variable has to be
 * the CHOREOGRAPHY — and the obvious way to withhold it, emptying the nine
 * charges' held spans and leaving every walk in place, is §29.7's failure
 * one room along. Measured (`L42_SOLVE.naiveControlRefuted`): with the
 * baits emptied the player begins each following walk from the wrong cell,
 * the replayed spans carry it into the lanes, **both crushers charge and
 * the player is inside a body on 1,127 ticks.** An arm that drives the very
 * mechanism it exists to withhold measures nothing — and in a PURSUIT room
 * that is not an accident, because every cell of the corridor is in
 * somebody's lane and any unplanned walk is a trigger.
 *
 * ⛓⛓ SO THE CONTROL IS THE TAPE CUT AT THE FIRST STANCE. It boots at the
 * same arrival, walks the same 268 ticks to the same cell — tile (4,11),
 * one step outside every one of the eight lanes, which is exactly what
 * makes it a bait stance — and then holds nothing at all for the remaining
 * ticks. Both bodies stay in their constructor cells across the only
 * corridor to the part, neither dipstick cell is enterable, the part is
 * never touched and the teleporter is never reached.
 *
 * ⚠ AND ITS CRUSHER TRAJECTORIES ARE COMPUTED IN ITS OWN WORLD, not read
 * off the drive's — the two-worlds law. Standing still is a CLAIM here,
 * not an absence: a resting crusher re-derives `v` every tick (§29.8), so
 * 1,652 ticks of doing nothing is 1,652 scans that have to come back null.
 */
const firstBaitFrom = out.baits[0].from;
const controlInputs = tape.inputs
    .filter((s) => s.from < firstBaitFrom)
    .map((s) => ({ key: s.key, from: s.from, to: Math.min(s.to, firstBaitFrom) }))
    .filter((s) => s.to > s.from);
const controlTape = parseTape(serializeTape({
    ...tape,
    name: 'r5-l42-part4-control',
    inputs: controlInputs,
    description: '⛓⛓ THE CHOREOGRAPHY-WITHHELD CONTROL for `r5-l42-part4`: the same boot, '
        + 'the same arrival walk to the same cell, and then NOTHING for the rest of the '
        + 'window. L42 has no flag to take away — no rock shields these crushers, no lock '
        + 'gates the room, no item is needed — so the isolating variable is the '
        + 'CHOREOGRAPHY itself. ⛔ AND THE OBVIOUS WAY TO WITHHOLD IT IS NOT A CONTROL: '
        + 'emptying the nine charges\' spans and keeping every walk starts each following '
        + 'leg from the wrong cell, and the replayed spans carry the player into the '
        + 'lanes — both crushers charge and the player is inside a body on 1,127 ticks '
        + '(§29.7 one room along, and in a PURSUIT room it is not an accident: every cell '
        + 'of the corridor is in somebody\'s lane, so any unplanned walk is a trigger). '
        + 'Here the player stands at tile (4,11), one step outside all eight lanes, which '
        + 'is exactly what makes it a bait stance — and standing still is a CLAIM, not an '
        + 'absence: a resting crusher re-derives `v` every tick, so this is 1,652 scans '
        + 'that come back null. Both bodies stay across the only corridor to the part, '
        + 'neither dipstick cell is enterable, the part is never touched and the '
        + 'teleporter is never reached.',
}));
/**
 * ⛔ THE NAIVE ARM, MEASURED RATHER THAN ASSERTED AWAY. It is not recorded
 * — what is banked is what it does, so the next reader does not have to
 * re-derive why the tape below is cut instead of holed.
 */
const naive = (() => {
    const baitSpanTicks = new Set();
    for (const b of out.baits) for (let t = b.from; t < b.to; t += 1) baitSpanTicks.add(t);
    const inputs = [];
    for (const s of tape.inputs) {
        let from = null;
        for (let t = s.from; t <= s.to; t += 1) {
            const drop = t < s.to && baitSpanTicks.has(t);
            if (!drop && from === null) from = t;
            if ((drop || t === s.to) && from !== null) {
                if (t > from) inputs.push({ key: s.key, from, to: t });
                from = null;
            }
        }
    }
    const t = parseTape(serializeTape({ ...tape, name: 'r5-l42-part4-naive', inputs }));
    const r = runTape(t, { levelSource });
    return {
        contacts: r.crusherContacts.length,
        crushers: [...r.crushers.entries()].map(([id, k]) => ({ id, x: k.x, y: k.y })),
        collected: r.collected.length,
        transitions: r.transitions.length,
    };
})();
console.log('\n## the NAIVE control — the one that is not a control');
console.log(`   ${naive.contacts} contact tick(s); crushers `
    + `${naive.crushers.map((k) => `${k.id}=(${k.x},${k.y})`).join(' ')}`);
check(naive.contacts === L42_SOLVE.naiveControlRefuted.contacts
    && naive.collected === 0 && naive.transitions === 0,
'⛔⛔ THE OBVIOUS CONTROL DRIVES THE MECHANISM IT WITHHOLDS — §29.7, one room along',
`${naive.contacts} contact tick(s) against the banked `
+ `${L42_SOLVE.naiveControlRefuted.contacts}; crushers `
+ `${naive.crushers.map((k) => `(${k.x},${k.y})`).join(' ')} against home. Emptying the `
+ 'nine charges\' spans leaves every WALK in place, and each of those walks was planned '
+ 'from the cell the choreography before it ended in — so the player starts them '
+ 'somewhere else and the replayed spans carry it into the lanes. In a pursuit room '
+ 'every corridor cell is in somebody\'s lane: an unplanned walk is a trigger, so the '
+ 'arm that was supposed to withhold the crusher exercises it 1,127 times.');
{
    const c = runTape(controlTape, { levelSource });
    const ends = [...c.crushers.entries()].map(([id, k]) => `${id}=(${k.x},${k.y})`);
    const visited = new Set(c.ticks.filter((t) => t.level === 42)
        .map((t) => `${Math.floor(t.x / TILE_SIZE)},${Math.floor(t.y / TILE_SIZE)}`));
    console.log('\n## the control arm');
    console.log(`   ${controlTape.tick_count} ticks, ${controlTape.inputs.length} spans`);
    console.log(`   crushers ${ends.join(' ')}; contacts ${c.crusherContacts.length}`);
    console.log(`   collected ${c.collected.length}, transitions ${c.transitions.length}, `
        + `frozen frames owed ${c.frozenFramesOwed}`);
    const last = c.ticks[c.ticks.length - 1];
    console.log(`   ends L${last.level} (${last.x.toFixed(2)},${last.y.toFixed(2)}) tile ${tile(last)}`);

    const home = Object.fromEntries(L42_PART4.crushers.map((k) => [k.id, k.home]));
    check([...c.crushers.entries()].every(([id, k]) => k.x === home[id].x && k.y === home[id].y)
        && c.crusherContacts.length === 0,
    '⛔⛔ THE CONTROL\'S CRUSHERS NEVER MOVE — both are still in their constructor cells',
    `${ends.join(' ')} against the drive's parks, ${c.crusherContacts.length} contact(s). `
    + 'Computed in the CONTROL\'S OWN world: a crusher leaves rest only by scanning a '
    + 'player inside one of its four lanes, and the cell this tape stands still in is one '
    + 'step outside all eight. ⛓ That is a claim about every one of the '
    + `${controlTape.tick_count - firstBaitFrom} ticks it spends there, not about the `
    + 'first one — a resting `Crusher` re-derives `v` on every tick (§29.8).');
    check(DIPSTICKS.every((d) => !visited.has(`${d.tx},${d.ty}`)),
        '⛓⛓⛓ …SO NEITHER DIPSTICK CELL IS ENTERABLE — the corridor to the part is shut',
        `visited [${DIPSTICKS.filter((d) => visited.has(`${d.tx},${d.ty}`)).map((d) => `(${d.tx},${d.ty})`).join(' ') || 'neither'}]. `
        + 'Both are inside a 32x32 `Solid`, and the player collides with a crusher body '
        + 'like any other wall — so the same input stream simply stops against it.');
    check(c.collected.length === 0 && c.transitions.length === 0,
        '⛓⛓ …AND THE PART IS NEVER COLLECTED AND THE ROOM IS NEVER LEFT',
        `${c.collected.length} collect(s), ${c.transitions.length} transition(s), `
        + `${c.frozenFramesOwed} frozen frames owed against the drive's `
        + `${run.frozenFramesOwed}. ⛓ The recorded difference is a SUBTRACTION rather `
        + 'than a budget — both arms are the same tape, one load apart — and it should '
        + `come out at ${CEREMONY_DEAD_FRAMES.pickup} plus one load's fade.`);
}

let bad = 0;
console.log('');
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
    console.log('\n(dry run — pass --write to emit the tapes)');
}
