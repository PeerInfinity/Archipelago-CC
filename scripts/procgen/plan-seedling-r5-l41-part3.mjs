#!/usr/bin/env node
/**
 * plan-seedling-r5-l41-part3 — THE CRUSHER'S FIRST LIVE DRIVE, AND THE
 * FOURTH COLLECT CEREMONY.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 16 step 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §29 (slice 15's as-built),
 * and `r5Totem.L41_PART3` for the room.
 *
 * ── ⛓⛓⛓ WHY THIS ROOM RETIRES `hazardVolume`'s HARD-AVOID ────────────
 *
 * §24.6 measured that `totempart 3` "crosses on the crusher alone" and read
 * that as an obstacle. It is an obstacle AND it is the room's only usable
 * machine. L41 has TWO gates that each need a SOLID standing on a button —
 * `wandlock@240,96` (whose `returnToNormal` fires the tick nothing is in its
 * cell) and `cover@112,128` (same shape) — ONE pushable block, and the
 * block's only push stance is the cover's own cell. A player alone cannot
 * open either.
 *
 * `Button.update` collides `["Player","Enemy","Solid"]` and excludes only a
 * `Cover`; a `Crusher` is `type = "Solid"`. Three baits walk it from
 * (256,80) to (256,240) — which is ON `button@248,232` — where it holds the
 * cover open permanently, and the FIRST of those baits is also what clears
 * the doorway to the part. The obstacle is the key.
 *
 * ── ⛔⛔ AND A PARKED CRUSHER IS STILL A LIVE SCANNER ─────────────────
 *
 * §29.8: `update()` re-derives `v` on every tick it is at rest, so a park is
 * a POSITION and not a state. Everything this leg does AFTER the third bait
 * — six block pushes, a 160-tick wait, a walk the length of the room and a
 * 150-frame ceremony — happens beside a crusher that is re-scanning its four
 * 64 px lanes every single tick, and one stance inside one of them charges it
 * off `button@248,232`, shuts the cover and seals the room with the player
 * inside it.
 *
 * So the audit below is not a formality and it is not taken from the plan:
 * the tape is REPLAYED and every tick's player box is put to the same
 * `scanCrusher` the run steps, against the live solid list of that tick.
 * `r5Totem.PARKED_SCAN_AUDIT` is what it found.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-l41-part3.mjs [--write] [--search] [--map]
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
const { rockBreaksUnder } = await import(join(MODULE, 'breakableRocks.js'));
const { assertWindowEndsAtRest } = await import(join(MODULE, 'director.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { L41_PART3, PARKED_SCAN_AUDIT } = await import(join(MODULE, 'r5Totem.js'));
const {
    CRUSHER_PLAN, detectionRects, laneHitsPlayer, scanCrusher,
} = await import(join(MODULE, 'crusher.js'));

const WRITE = process.argv.includes('--write');
const SEARCH = process.argv.includes('--search');
const MAP = process.argv.includes('--map');
const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

const CRUSHER = Object.freeze({ x: 240, y: 64 });
const CRUSHER_ID = `crusher@${CRUSHER.x},${CRUSHER.y}`;
/** The tape's own boot — the rock swing's stance, one window earlier. */
const BOOT = Object.freeze({ level: 41, x: 208, y: 80 });
/**
 * ⛓ The trailing idle ticks. `synthesizeLegs` stops the tick counter on the
 * ceremony's own frame, and `assertWindowEndsAtRest` wants ~8 ticks of coast
 * after the last released span — so the window is extended past its last
 * input rather than cut on it. They are not free ticks: the crusher steps
 * through every one of them and the audit below covers them.
 */
const REST_TICKS = 30;

const world = buildLevelWorld(levelSource(41), { roles: ROLES, inventory: held });
const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

console.log('## the room');
for (const r of L41_PART3.rocks) {
    const solid = world.solids.find((s) => s.rockId === r.id);
    if (!solid) throw new Error(`L41 has no ${r.id}`);
    if (!rockBreaksUnder(solid.rockType, held)) {
        throw new Error(`${r.id} is rockType ${solid.rockType}, unbreakable by this walk`);
    }
    if (solid.persistTag !== r.tag) {
        throw new Error(`${r.id} carries tag ${solid.persistTag}, not ${r.tag}`);
    }
    console.log(`   ${r.id} tag ${solid.persistTag}`);
}
console.log(`   crusher ${L41_PART3.crusher}, block ${L41_PART3.block}`);
console.log(`   ⛓ the doctrine: ${CRUSHER_PLAN.phases.map((p) => p.verb).join(' -> ')}`);
console.log(`   ⛔ ${L41_PART3.flood.crusherHome.nodes} nodes with it home, `
    + `${L41_PART3.flood.crusherParkedWest.nodes} parked — part reachable `
    + `${L41_PART3.flood.crusherHome.partReachable} / `
    + `${L41_PART3.flood.crusherParkedWest.partReachable}`);

/**
 * ⛔⛔ WHAT THE PART DOES **NOT** WRITE — a correction to this slice's own
 * brief, made before the recording rather than after it.
 *
 * The brief asks the tape to assert "the ledger ({41,0} and part 3's
 * write)". `BossTotemPart.removed()` is
 *
 *     if (doActions) Player.hasTotemPartSet(totemPart, true);
 *
 * — a SAVE-FILE write, not `Game.setPersistence`, and the extract confirms
 * it from the other side: `totempart@240,144` carries `totempart="3"` and no
 * `tag` attribute at all. So part 3 contributes NOTHING to the persistence
 * ledger, `hasTotemPart` is still not in `Bot.itemReadout` (§20.8), and the
 * ceremony's claim is what it was for parts 0, 1 and 2: the game's own
 * 150 frozen frames. The ledger for this window is `{41,0}` alone.
 */
{
    const part = (levelSource(41).entities ?? []).find((e) => e.type === 'totempart');
    check(part?.attrs?.tag === undefined && part?.attrs?.totempart === '3',
        '⛔ …and the PART writes no persistence — `hasTotemPartSet` is SAVE-FILE state',
        `totempart@${part?.x},${part?.y} attrs ${JSON.stringify(part?.attrs)}. `
        + '`BossTotemPart.removed()` calls `Player.hasTotemPartSet(3, true)`, not '
        + '`Game.setPersistence`, so this window\'s ledger is `{41,0}` — the wandlock — '
        + 'and nothing else. The brief asked for "part 3\'s write"; there is none, and '
        + 'the 150 dead frames are the claim exactly as they were for parts 0-2.');
}

/**
 * ⚠ THE BAIT SPANS ARE SEARCHED, NOT GUESSED — and the search is here
 * rather than in the leg because a choreography is a phase-1 artifact
 * (`CRUSHER_PLAN`): it is verified against `stepCrusher` tick by tick, and
 * the winner is banked in `L41_PART3`. `--search` re-runs it.
 */
if (SEARCH) {
    console.log('\n## searching bait 1 — the WEST charge that clears the doorway');
    const prefix = () => createLevelRun({
        levelSource,
        boot: { ...BOOT },
        persistence: L41_PART3.rocks.map((r) => ({ level: 41, tag: r.tag })),
        inventory: held,
        noDamage: true,
    });
    const drive = (run, spans) => {
        for (const s of spans) {
            const k = s.key ? new Set([s.key]) : new Set();
            for (let i = 0; i < s.ticks; i += 1) run.advance(k);
        }
        return run;
    };
    for (let L = 16; L <= 26; L += 1) {
        const run = drive(prefix(), [
            { key: 'left', ticks: L }, { key: 'down', ticks: 40 }, { key: null, ticks: 160 },
        ]);
        const c = [...run.crushers.values()][0];
        if (run.crusherContacts.length === 0 && c.x === 64 && c.y === 80) {
            console.log(`   left ${L} / down 40 -> park (64,80), 0 contacts`);
        }
    }
}

// ── the leg ───────────────────────────────────────────────────────────
const centre = (t) => ({ x: t[0] * TILE_SIZE + TILE_SIZE / 2, y: t[1] * TILE_SIZE + TILE_SIZE / 2 });
const tile = (p) => `(${Math.floor(p.x / TILE_SIZE)},${Math.floor(p.y / TILE_SIZE)})`;

const targets = [
    /**
     * ⛓⛓⛓ PHASE 1, THREE TIMES. Each bait is a short choreography whose
     * every tick is simulated by the same `stepCrusher` the run steps, and
     * each asserts a PARK POSITION because phase 2's flood is taken against
     * it. The stance is the PREVIOUS bait's own resting cell, so the drive
     * to it costs zero ticks — asserted below, because a stance that cost
     * the walk even one tick would be a choreography starting somewhere its
     * search never saw.
     */
    ...L41_PART3.baits.map((b) => ({
        ...b.stance,
        bait: {
            crusher: { ...CRUSHER },
            approach: b.approach.map((s) => ({ ...s })),
            spans: b.spans.map((s) => ({ ...s })),
            park: { ...b.park },
        },
    })),
    // ⛔ THE EQUIP, and without it every press below fires a SWORD and the
    // effect check reports the block unmoved without ever saying why.
    { ...centre(L41_PART3.pushes[0].stance), equip: { slot: 1 } },
    /**
     * ⛓⛓ THE SIX PUSHES. The first stance is `cover@112,128`'s OWN CELL —
     * it is standable only because 32x32 of crusher is sitting on the
     * cover's button two thirds of a room away, which is the whole reason
     * the baits come first.
     */
    ...L41_PART3.pushes.map((p) => ({
        ...centre(p.stance),
        fire: {
            moves: [{
                from: { tx: p.from[0], ty: p.from[1] },
                to: { tx: p.to[0], ty: p.to[1] },
            }],
        },
    })),
    /**
     * ⛓⛓⛓ THE FADE THE PLAYER IS NOT HOLDING. The block is now on
     * `button@176,176` and `wandlock@240,96` needs 101 CONTINUOUS ticks —
     * the player's own box is at the last push stance, three tiles away.
     */
    {
        ...centre(L41_PART3.pushes[L41_PART3.pushes.length - 1].stance),
        wait: {
            ticks: 160,
            opens: L41_PART3.wandlock.id,
            why: 'the block parked on `button@176,176` by the sixth push is what publishes '
                + 'group 1; the player is at the push stance and holds nothing. A `Lock` '
                + 'fades over 101 continuous ticks and the count restarts on release, so '
                + 'the wait is a measurement of a hold nobody is performing.',
        },
    },
    // ⛓⛓⛓ THE CEREMONY. The stance is the chamber cell NORTH of the part,
    // reached through the doorway the wandlock has just opened.
    { ...centre(L41_PART3.collectStance) },
    { ...centre(L41_PART3.collectStance), collect: { pickup: { ...L41_PART3.part } } },
];

let out = null;
let failure = null;
try {
    out = synthesizeLegs([{ level: 41, targets }], {
        levelSource,
        boot: { ...BOOT },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 41, items: [...HELD] }],
            /**
             * ⛓ THE WINDOW BOOTS WITH ITS OWN TAGS CLEAR. The two
             * `breakablerock`s are what SHIELD the crusher (§28.8) — with
             * them standing it never scans and the three choreographies move
             * it not one pixel — so the swing that removes them belongs to an
             * earlier window, exactly as an item does. Declaring the tags is
             * how this window says which state it starts from, and it is the
             * ONE field the control arm differs in.
             */
            persistence: L41_PART3.rocks.map((r) => ({ level: 41, tag: r.tag })),
            equips: [],
            /**
             * ⛓ PINS ON. A pin is not a crutch — it selects which
             * vanilla-reachable execution the run gets and creates no
             * vanilla-unreachable one — and this window is the one that
             * needs `dead_frames` most: `Game.blackCover` decaying per
             * UPDATE rather than per RENDER makes the boot fade a fixed
             * number, so the ceremony's 150 frames are compared against a
             * budget with no band in it. `sound` is inert here (L41 holds
             * no water and `Music.soundPosition` has exactly one reader,
             * `Player.as:530`) and is declared anyway, because a pin list
             * that varies per tape is a second thing to reason about.
             */
            pins: ['sound', 'dead_frames'],
            roles: [...ROLES],
        },
        name: 'r5-l41-part3',
        lattice: 8,
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
    tick_count: out.tape.tick_count + REST_TICKS,
    description: '⛓⛓⛓ THE CRUSHER\'S FIRST LIVE DRIVE, AND THE FOURTH COLLECT CEREMONY — '
        + '`totempart 3 @240,144` in L41. The room has TWO gates that each stay open only '
        + 'while a `"Solid"` is in their own cell (`wandlock@240,96`, the part chamber\'s '
        + 'only doorway; `cover@112,128`, the one block\'s only push stance), ONE pushable '
        + 'block, and the block is behind the first of them — so a player alone opens '
        + 'neither. `Button.update` collides `["Player","Enemy","Solid"]` and a `Crusher` '
        + 'is `type = "Solid"`: three baits walk it (256,80) -> (64,80) -> (64,240) -> '
        + '(256,240), which is ON `button@248,232`, where it holds the cover open for the '
        + 'rest of the visit — and bait 1 is also what clears the doorway. Then six '
        + '`fire.moves` presses put the block on `button@176,176`, 76 idle ticks finish '
        + 'the wandlock\'s 101-tick fade, and the part is collected. ⛔ THE OBSTACLE IS '
        + 'THE MACHINE: `hazardVolume` prices this crusher hard-avoid over the four lanes '
        + 'the solution operates. ⚠ The window boots with the two `breakablerock` tags '
        + 'declared clear — they SHIELD the crusher, so the swing that removes them '
        + 'belongs to an earlier window, and that one field is the whole of the control '
        + 'arm.',
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
for (const f of out.fires) {
    const m = f.moves[0];
    console.log(`   push (${m.from.tx},${m.from.ty}) -> (${m.to.tx},${m.to.ty}) `
        + `press t${f.pressTick}`);
}
for (const w of out.waits) {
    console.log(`   wait ${w.opens} — ${w.ticks} idle ticks, OPENED AT ${w.openedAt}`);
}
console.log(`   collected: ${run.collected.map((c) => `t${c.t} item=${c.item ?? 'null'}`).join(', ') || 'NONE'}`);
console.log(`   lock writes: [${run.lockWrites.map((wr) => `${wr.flag.level}:${wr.flag.tag}=${wr.value}@t${wr.t}`).join(' ')}]`);
console.log(`   crusher ends at (${[...run.crushers.values()][0].x},`
    + `${[...run.crushers.values()][0].y}); contacts ${run.crusherContacts.length}`);
console.log(`   open activators: [${[...run.openActivators].join(' ')}]`);

/**
 * ── ⛔⛔⛔ THE PARKED-SCANNER AUDIT ───────────────────────────────────
 *
 * The one check §29 did not name and this leg cannot go without. The tape
 * is REPLAYED through a fresh `createLevelRun` and, on every tick from the
 * third bait's last onward, the live crusher is asked the game's own
 * question about the live player: `scanCrusher(crusher, playerBox,
 * playerPoint, solidBoxesForMover(...))`. The solid list is the one the run
 * has AT THAT TICK — the block moves six times and the wandlock opens
 * during this window, and both change what shields what.
 *
 * Two claims come out of it, and they are different claims:
 *
 *   THE MEASUREMENT   the crusher's entity position is (256,240) on every
 *                     one of those ticks. That is the fact `button@248,232`
 *                     and therefore `cover@112,128` and therefore the whole
 *                     block chain depends on.
 *   THE MECHANISM     `scan.dir` is null on every one of them, so it was
 *                     never CLOSE to moving — the route is not surviving on
 *                     a margin, it is outside the volume.
 *
 * A leg that had only the first would be a leg that got away with it.
 */
const PARK = { x: 256, y: 240 };
const bait3 = out.baits[out.baits.length - 1];
const audit = (() => {
    /**
     * ⛓⛓ THE AUDIT RIDES `runTape`'s OWN LOOP.
     *
     * `createTapeStepper` is the incremental face of `runTape` — literally
     * the same generator, driven to completion so the end-of-loop checks
     * still fire — and it now yields the live crushers and, per crusher,
     * the scan taken with the RUN's own solid list and the run's own two
     * player shapes (`levelRun.crusherScans`).
     *
     * ⛔⛔ THE FIRST CUT DROVE A SECOND `createLevelRun` FROM THE TAPE'S
     * SPANS, AND IT WAS A DIFFERENT WALK — twice over. It built its held
     * set as ONE KEY PER TICK, so every diagonal (`chooseHeld` holds two)
     * turned into a straight line; and it never applied the tape's
     * `equips`, so its six `primary` presses fired a SWORD and the block
     * never moved. It reported a nearest approach of 0.00 px to a lane at a
     * tile the real walk does not enter. A verifier that replays a
     * different walk verifies nothing about this one, and both mistakes are
     * the same mistake: a second copy of the tick loop wearing a plan
     * script. ⇒ [[feedback_verifier_shared_assumption]] from the other
     * side — the danger is not only a verifier that shares the generator's
     * assumptions, it is one that shares NONE of them by accident.
     */
    const hot = [];
    const moved = [];
    const inLaneShielded = [];
    const west = detectionRects({ ...PARK }).find((r) => r.dir === 'W');
    let closest = null;
    let ticks = 0;
    const stepper = createTapeStepper(tape, { levelSource });
    let r = stepper.next();
    while (!r.done) {
        const { observation, crushers, crusherScans } = r.value;
        const t = observation.t;
        if (t >= bait3.to && crushers) {
            ticks += 1;
            const c = crushers.get(CRUSHER_ID);
            if (c.x !== PARK.x || c.y !== PARK.y) moved.push({ t, x: c.x, y: c.y });
            const s = crusherScans.get(CRUSHER_ID);
            if (s.dir !== null) hot.push({ t, x: observation.x, y: observation.y, dir: s.dir });
            // ⚠ "SHIELDED" AND "OUTSIDE EVERY LANE" ARE DIFFERENT WORLDS,
            // and `scan.dir === null` covers both — `scanCrusher`'s sight
            // test is an EARLY EXIT, so a blocked line never reaches the
            // lane loop at all. A stance that is inside a lane and merely
            // shielded is safe on geometry that MOVES (this window pushes a
            // block six times), so it is counted separately even though it
            // is not a failure.
            const box = playerBoxAt(observation.x, observation.y);
            const inALane = detectionRects({ x: c.x, y: c.y })
                .filter((lane) => laneHitsPlayer(box, lane)).map((lane) => lane.dir);
            if (s.shieldedBy && inALane.length > 0) {
                inLaneShielded.push({ t, x: observation.x, y: observation.y, lanes: inALane });
            }
            // How near did the route come to the ONE volume it may not
            // enter — the west lane, the only one of the four whose cells
            // are walkable at all once the room's walls are taken out.
            const d = Math.max(west.x - box.right, box.x - west.right,
                west.y - box.bottom, box.y - west.bottom);
            if (closest === null || d < closest.d) {
                closest = { d, t, x: observation.x, y: observation.y };
            }
        }
        r = stepper.next();
    }
    return { hot, moved, inLaneShielded, closest, ticks, result: r.value };
})();

console.log('\n## the parked-scanner audit');
console.log(`   ${audit.ticks} ticks from the third bait's last (t${bait3.to}) to the end`);
console.log(`   crusher off (${PARK.x},${PARK.y}) on ${audit.moved.length} of them`);
console.log(`   player inside a live lane on ${audit.hot.length} of them`);
console.log(`   player inside a lane but SHIELDED on ${audit.inLaneShielded.length} of them`);
console.log(`   nearest approach to the WEST lane: ${audit.closest.d.toFixed(2)} px at `
    + `t${audit.closest.t} (${audit.closest.x.toFixed(2)},${audit.closest.y.toFixed(2)}) `
    + `tile ${tile(audit.closest)}`);

check(audit.moved.length === 0,
    '⛓⛓⛓ THE CRUSHER NEVER LEAVES `button@248,232` — every tick after the third bait',
    `${audit.moved.length} of ${audit.ticks} tick(s) off (${PARK.x},${PARK.y})`
    + `${audit.moved.length ? `, first t${audit.moved[0].t} at (${audit.moved[0].x},${audit.moved[0].y})` : ''}`
    + '. ⛔ A park is a POSITION and not a state (§29.8): `update()` re-derives `v` on '
    + 'every tick it is at rest, so the six pushes, the 160-tick wait, the walk and the '
    + 'ceremony all run beside a live scanner. One stance in one lane and it charges off '
    + 'the button, `cover@112,128` resets, and the room shuts with the player in it.');
check(audit.hot.length === 0,
    '⛓⛓ …and it was never CLOSE — `scan.dir` is null on every one of those ticks',
    `${audit.hot.length} tick(s) with the player in a lane and a clear line`
    + `${audit.hot.length ? `, first t${audit.hot[0].t} at (${audit.hot[0].x.toFixed(2)},${audit.hot[0].y.toFixed(2)}) dir ${audit.hot[0].dir}` : ''}`
    + '. This is the MECHANISM where the position check is the measurement: a route that '
    + 'stayed on the button by luck of a tick would pass the first and fail this.');
check(audit.ticks === PARKED_SCAN_AUDIT.ticks
    && bait3.to === PARKED_SCAN_AUDIT.fromTick
    && audit.moved.length === PARKED_SCAN_AUDIT.movedTicks
    && audit.hot.length === PARKED_SCAN_AUDIT.hotTicks
    && audit.inLaneShielded.length === PARKED_SCAN_AUDIT.inLaneShieldedTicks
    && Math.abs(audit.closest.d - PARKED_SCAN_AUDIT.nearestWestLanePx) < 0.005,
    '⛓ …and the audit is BANKED — `r5Totem.PARKED_SCAN_AUDIT` is these numbers',
    `t${bait3.to} + ${audit.ticks} ticks, ${audit.moved.length} moved, `
    + `${audit.hot.length} hot, ${audit.inLaneShielded.length} shielded-in-lane, `
    + `${audit.closest.d.toFixed(2)} px against `
    + `t${PARKED_SCAN_AUDIT.fromTick} + ${PARKED_SCAN_AUDIT.ticks}, `
    + `${PARKED_SCAN_AUDIT.movedTicks} / ${PARKED_SCAN_AUDIT.hotTicks} / `
    + `${PARKED_SCAN_AUDIT.inLaneShieldedTicks} / `
    + `${PARKED_SCAN_AUDIT.nearestWestLanePx} px. A number nobody pins is a number the `
    + 'next slice re-derives and cannot compare.');
check(audit.closest.d > 0,
    '⛓ …and the route\'s nearest approach to the west lane is OUTSIDE it',
    `${audit.closest.d.toFixed(2)} px of clearance at t${audit.closest.t}. ⚠ The lane test `
    + 'is `World.collideRect` — `Entity.as:263`, four `>=`/`<=` — where every other '
    + 'overlap in this package is strict, so a clearance of exactly 0 would be INSIDE '
    + 'it (§29.5).');

/**
 * ⛓ And the volume itself, printed rather than remembered: the four lanes
 * of the parked crusher intersected with the cells a player can stand in.
 * `L41_PART3.avoidAfterBait3` names the west lane as a rect; this is what
 * is left of all four once the room's own walls are taken out.
 */
if (MAP) {
    const P = 8;
    const nx = world.world.width / P;
    const ny = world.world.height / P;
    const replay = createLevelRun({
        levelSource,
        boot: { ...BOOT },
        persistence: L41_PART3.rocks.map((r) => ({ level: 41, tag: r.tag })),
        inventory: held,
        noDamage: true,
    });
    const opts = livePerVisitOpts(replay);
    const solids = replay.world.solidBoxesForMover(opts, CRUSHER_ID);
    console.log('\n## the parked crusher\'s live volume, on the 8 px lattice '
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
            const s = scanCrusher({ ...PARK }, playerBoxAt(px, py), { x: px, y: py }, solids);
            line += s.dir === null ? '.' : s.dir;
        }
        console.log(`${String(b).padStart(3)}${b % 2 ? ' ' : '|'} ${line}`);
    }
}

// ── the claims ────────────────────────────────────────────────────────
console.log('\n## the claims');
{
    const zero = out.arrivals.filter((a) => a.index < 3)
        .map((a, i) => a.tick - (i === 0 ? 0 : out.baits[i - 1].to));
    check(zero.every((n) => n === 0),
        '⛓⛓ EACH BAIT STARTS WHERE THE LAST ONE ENDED — the drive to its stance is FREE',
        `walk ticks before each bait: [${zero.join(' ')}]. The three choreographies were `
        + 'searched as one continuous span chain from the boot, so a stance that cost the '
        + 'planner even one tick would be a bait verified from a position its search never '
        + 'saw. This is what makes the emitted stream span-for-span the one '
        + '`r5Totem.test.js` has driven since slice 15.');
}
{
    const got = out.baits.map((b) => `${b.dir}->${b.crusherTo.x},${b.crusherTo.y}`).join(' ');
    const want = L41_PART3.parks.map((p) => `${p.dir}->${p.to.x},${p.to.y}`).join(' ');
    check(got === want,
        '⛓⛓⛓ THREE BAITS, THREE DECLARED PARKS — and the third is ON `button@248,232`',
        `[${got}] against [${want}]. ⛓ Each is the run's own answer: \`runBait\` asserts `
        + 'the crusher was AT REST when the verb began, AWAKE when the approach ended '
        + '(observed through `run.crushersParked`, not predicted through a second copy of '
        + 'the scan), parked at the declared position when the escape did, and never once '
        + 'overlapping the player.');
}
check(run.crusherContacts.length === 0 && audit.result.crusherContacts.length === 0,
    '⛓⛓ ZERO CONTACTS — no tick of this tape has the player inside the 32x32 body',
    `${run.crusherContacts.length} in the replay, ${audit.result.crusherContacts.length} in the audit. `
    + '⛔ `Crusher.hit()` deals 1000 ("KILL EVERYTHING"), so every one of these would be '
    + '`die()` at any `hitsMax` and the run survives them only because `Bot.noDamage` is '
    + 'on. A choreography that is run over completes looking exactly like one that worked, '
    + 'which is why the count is a claim and the end position is not enough.');
check([...run.openActivators].sort().join(' ')
    === [L41_PART3.cover.id, L41_PART3.wandlock.id].sort().join(' '),
    '⛓⛓⛓ BOTH GATES ARE OPEN AT THE END, AND NEITHER WAS OPENED BY THE PLAYER',
    `[${[...run.openActivators].sort().join(' ')}]. \`cover@112,128\` is held by 32x32 of `
    + 'crusher standing on `button@248,232`; `wandlock@240,96` is held by a '
    + '`pushableblockfire` standing on `button@176,176`. The player is in neither cell '
    + 'and has never been in either.');
{
    const m = out.fires.map((f) => f.moves[0]);
    const want = L41_PART3.pushes.map((p) => `${p.from[0]},${p.from[1]}->${p.to[0]},${p.to[1]}`);
    const got = m.map((x) => `${x.from.tx},${x.from.ty}->${x.to.tx},${x.to.ty}`);
    check(got.join(' ') === want.join(' ') && got.length === 6,
        '⛓⛓ SIX PUSHES, EACH LANDING ON THE DECLARED TILE — `L41_PART3.pushes` driven',
        `[${got.join(' ')}]. ⛓ Every one of them is a \`fire.moves\` press, and every one `
        + 'is allowed only because `runFire` found the crusher asleep at the stance — the '
        + 'refusal that forced this leg\'s order in the first place. The first stance is '
        + '`cover@112,128`\'s own cell.');
}
{
    const w = out.waits[0];
    check(w?.openedAt === 76,
        '⛓⛓⛓ THE WANDLOCK OPENS 76 IDLE TICKS IN — the `Lock` fade, minus what the '
        + 'glide already spent',
        `openedAt ${w?.openedAt} of ${w?.ticks} declared. A \`Lock\` needs `
        + `${L41_PART3.lockTicks} CONTINUOUS published ticks; the sixth press lands at `
        + `t${out.fires[5].pressTick} and its settle window runs to t${w.from}, so the `
        + `block was already publishing for ${L41_PART3.lockTicks - w.openedAt} of them `
        + `(publication starts at t${w.from + w.openedAt - L41_PART3.lockTicks}, `
        + `${w.from + w.openedAt - L41_PART3.lockTicks - out.fires[5].pressTick} ticks `
        + 'after the press — the block\'s straddling rect reaches the button part way '
        + 'through its own glide). ⚠ THE WAIT EMITS ALL 160 TICKS: breaking out at the '
        + 'open would shorten the tape to exactly the number the ±1 lives in, which is '
        + '`runSpear`\'s rock arm having the same argument.');
}
{
    const got = run.lockWrites.map((wr) => `${wr.flag.level}:${wr.flag.tag}=${wr.value}`);
    check(got.join(' ') === '41:0=false',
        '⛓⛓ THE LEDGER IS ONE WRITE — `{41,0}`, the wandlock, and nothing else',
        `[${got.join(' ')}] at t${run.lockWrites[0]?.t}. ⛔ \`earnedClears\` is EMPTY and `
        + 'that is right: a banked clear is cashed at the next BUILD and this window never '
        + 'leaves L41 (§ slice 9). The rocks are DECLARED, not broken here, so they are '
        + 'not in it either — and the part writes save-file state, not persistence.');
}
check(run.collected.length === 1 && run.collected[0].item === null,
    '⛓⛓⛓ THE FOURTH COLLECT CEREMONY — `totempart 3`, and it banks no inventory property',
    `${run.collected.length} collect(s), item = ${run.collected[0]?.item ?? 'null'}. `
    + '`hasTotemPart` is not in `Bot.itemReadout` (§20.8), so the game\'s 150 frozen '
    + 'frames are the claim — the same shape as parts 2, 1 and 0. ⛓ AND THE CEREMONY IS '
    + 'A ONE-FRAME CLAIM BESIDE THIS CRUSHER, not a 150-frame survival one: '
    + '`Crusher.update` has no freeze gate and `Player.hit` does, so it MOVES through a '
    + 'ceremony and cannot HURT through one (`CEREMONY_RULE`). Here it does neither — the '
    + 'audit above covers the ceremony\'s own frames and it never moves.');
check(run.transitions.length === 0 && run.transports.length === 0,
    '⛓ …without leaving L41, and without falling anywhere',
    `${run.transitions.length} transition(s), ${run.transports.length} pit fall(s)`);
{
    const rest = assertWindowEndsAtRest(tape);
    check(rest.length === 0,
        '⛓ THE WINDOW ENDS AT REST — the last span releases with coast to spare',
        rest.length === 0
            ? `${REST_TICKS} trailing idle ticks past the last input; the crusher steps `
              + 'through every one of them and the audit covers them.'
            : rest.join('; '));
}

/**
 * ── ⛓⛓ THE SHUT-BEFORE CONTROL, AND IT IS ONE FIELD ──────────────────
 *
 * §29.7: the naive control for this room — "walk east without baiting" —
 * is not a control at all, because any walk into the west lane unleashes
 * the crusher, so the arm drives the very mechanism it was meant to
 * withhold. The isolating variable is the ROCKS.
 *
 * With `persistence: []` the two `breakablerock`s are standing, the
 * crusher's west sight line is blocked by `breakablerock@224,80`,
 * `collideLine` takes its early exit, and it never scans at all. Every span
 * of this tape is byte-identical and the whole room stays shut: no park, no
 * button, no cover, no push, no wandlock, no part.
 *
 * ⚠ AND THE CONTROL'S CRUSHER TRAJECTORY IS COMPUTED IN ITS OWN WORLD, not
 * copied from the drive's — the two-worlds law. Its answer is that there
 * is no trajectory.
 */
const controlTape = parseTape(serializeTape({
    ...tape,
    name: 'r5-l41-part3-control',
    persistence: [],
    description: '⛓⛓ THE SHUT-BEFORE CONTROL for `r5-l41-part3`: the identical tape with '
        + 'ONE field changed — the two `breakablerock` tags are no longer declared clear, '
        + 'so the rocks are STANDING. `breakablerock@224,80` blocks `crusher@240,64`\'s '
        + 'west sight line, `collideLine` takes its early exit, and the crusher never '
        + 'scans: the same three choreographies move it not one pixel. ⛔ SO THE ORDER IS '
        + 'THE ROOM, not the spans. No park on `button@248,232` means `cover@112,128` '
        + 'stays shut, means the block\'s only push stance is unreachable, means '
        + '`button@176,176` is never held, means `wandlock@240,96` never fades, means the '
        + 'part chamber has no doorway. ⚠ §29.7: the OBVIOUS control — walking east '
        + 'without baiting — is not one, because any walk into the west lane drives the '
        + 'mechanism it was meant to withhold.',
}));
{
    const c = runTape(controlTape, { levelSource });
    const cc = [...c.crushers.values()][0];
    console.log('\n## the control arm');
    console.log(`   crusher ends at (${cc.x},${cc.y}); contacts ${c.crusherContacts.length}`);
    console.log(`   open activators: [${[...c.openActivators].join(' ') || 'none'}]`);
    console.log(`   collected ${c.collected.length}, lock writes ${c.lockWrites.length}`);
    check(cc.x === 256 && cc.y === 80,
        '⛔⛔ THE CONTROL\'S CRUSHER NEVER MOVES — it is still in its constructor cell',
        `(${cc.x},${cc.y}) against the drive's (${PARK.x},${PARK.y}). Computed in the `
        + 'CONTROL\'S OWN WORLD, not read off the drive\'s: a shielded crusher takes '
        + '`scanCrusher`\'s early exit and never derives `v` at all.');
    check([...c.openActivators].length === 0,
        '⛓⛓⛓ …SO NEITHER GATE EVER OPENS — the room is exactly as the level built it',
        `[${[...c.openActivators].join(' ') || 'none'}]. Two gates, one block, and the `
        + 'block behind the first gate: with no Solid to spare, a player opens neither.');
    check(c.collected.length === 0 && c.lockWrites.length === 0,
        '⛓⛓ …AND NOTHING IS COLLECTED AND NOTHING IS WRITTEN',
        `${c.collected.length} collect(s), ${c.lockWrites.length} lock write(s). The `
        + 'ceremony belongs to the three baits, and the baits belong to the swing that '
        + 'happened in an earlier window.');
    check(c.crusherContacts.length === 0,
        '⛓ …and the control is not run over either — the two arms are two worlds',
        `${c.crusherContacts.length} contact(s). A crusher that never scans never charges, `
        + 'so the identical spans that dodge one in the drive have nothing to dodge here.');
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
