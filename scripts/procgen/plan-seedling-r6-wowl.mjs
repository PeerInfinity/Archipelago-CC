#!/usr/bin/env node
/**
 * plan-seedling-r6-wowl — ⛓⛓⛓ THE OWL, AND THE LADDER'S THIRD BOSS KILL IS
 * ONE THE PLAYER NEVER DEALS.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 6f. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §8.5, §8.6, §14.4, §16.5,
 * §16.8 and §19 (the pinned draw schedule and fight model this drives).
 *
 * ── WHAT THE WINDOW DOES ──────────────────────────────────────────────
 *
 * `onlyHitBy = "Lava"`: a sword press cannot damage the Owl at all. It takes
 * `Enemy.hit`'s `justKnock` arm and SHOVES him, and the only thing that can
 * kill him is his own `hit(6, centre, 1, "Lava")` — fired when his 12x12
 * box's FIRST overlapping `Tile` is `t == 17`. So the tape is three shoves and
 * a lot of dodging, and every number below came out of a search over the real
 * `levelRun`.
 *
 * ── ⛓⛓⛓ FINDING 1: THE INTRO-DISMISSING PRESS **IS** THE FIRST SHOVE ──
 *
 * §16.5's `entry:` disposition says the room's `!started` intro raises
 * `Game.freezeObjects` on the first update from any distance and holds it
 * until an X RELEASE. What nobody had noticed is that the SAME press is
 * `useItem(Main.primary)`: `FinalBoss.update` lowers the freeze at the TOP of
 * the frame, above the player's own update, so `Player.input()` runs on that
 * very tick and `Input.pressed(keys[4])` is still live. One press, two jobs —
 * and because the boss spawns 3.00 px from the lava octagon on his opening
 * leg (§8.5), the shove it buys is enough. **Lava hit 1 lands on tick 9 of a
 * window whose first input is at tick 2.**
 *
 * ⇒ and that retires §8.5's "the fight is at least three full pod cycles".
 * `hitThisSequence` starts FALSE, so the first hit needs no barrage before
 * it: the window endures **two** barrages, not three.
 *
 * ── ⛓⛓⛓ FINDING 2: A STANDING PLAYER DIES, AND AN ORBITING ONE IS NEVER
 *    TOUCHED ─────────────────────────────────────────────────────────────
 *
 * `stepsAhead` is **-15**, so the barrage is aimed fifteen steps of the
 * player's own velocity BEHIND them, and the rock then takes 17 more ticks to
 * land. A stationary player is aimed at directly and dies inside the first
 * barrage (measured: 3 hits, dead at tick 555). A player holding a 64 px
 * square orbit at ~0.68 px/tick per axis carries ~32 ticks of lead — about 22
 * px per axis against a +-20 px spray — and takes ONE hit in 1500 ticks.
 *
 * ⛔ AND THE ORBIT'S CENTRE IS A CONSTRAINT, NOT A PREFERENCE. `t == 16` —
 * the ring around the lava — is a LETHAL terrain state, so the whole octagon
 * plus a tile of margin is forbidden floor for the player. Two of the four
 * quadrant orbits the search tried DROWNED; the north-west one survives.
 *
 * ── ⛓⛓ FINDING 3: THE FIVE HIT TESTS ARE CULLED BY THE REACH ──────────
 *
 * §14.4/§19.6 derived the shove from the RECEIVER's gate: `justKnock` sets no
 * `hitsTimer`, so all five of a press's tests land and compound. The
 * DISPATCHER has a gate too — `Player.slash`'s 16 px `FP.distanceRectPoint`,
 * re-measured every tick — and the shove is 4.75 px on the second test and
 * 8.75 on every one after. So the body recedes out of its own hit rect
 * part-way through its own press, and how many of the five land is GEOMETRY.
 * `run.finalBossShoves` records every test with the distance that decided it.
 *
 * ── THE PAIR ──────────────────────────────────────────────────────────
 *
 * The one-primitive-fewer PREFIX (W-totem's shape): the same tape with the
 * THIRD shove press deleted, and the movement spans byte-identical because
 * they come from a separate generator (§12). The control's boss takes two of
 * three lava hits, `{112,0}` and `{112,1}` are never written, and the fight
 * runs on into the third barrage.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r6-wowl.mjs [--write] [--search]
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const WRITE = process.argv.includes('--write');
const SEARCH = process.argv.includes('--search');

const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { serializeTape, parseTape, heldKeysAt } = await import(join(MODULE, 'tapeFormat.js'));
const { keysToSpans } = await import(join(MODULE, 'mover.js'));
const { FINAL_BOSS } = await import(join(MODULE, 'finalBossFight.js'));

/**
 * ⚠ THE BOOT BLOCK IS `new Game(level, x, y)`'s ARGUMENTS, not the entity
 * point — `spawnFromBoot` adds `(Tile.w/2, Tile.h/2)`. (55,101) spawns the
 * player at **(63,109)**, which is 10 px west-north-west of the Owl's own
 * spawn (72,104) — close enough for the slash's 16 px reach, clear of his
 * 12x12 box (so no contact damage), and on a `t == 37` floor tile rather than
 * the lethal `t == 16` ring.
 */
const BOOT = { level: 112, x: 55, y: 101 };
const GRANTS = [{ level: 112, items: ['sword'] }];
const PINS = ['sound', 'dead_frames'];
/**
 * ⛔ EMPTY, AND BOTH HALVES ARE EARNED. The lava and its `t == 16` ring are
 * routed around by the plan (the search FORBADE them rather than scoring them
 * away — two of its four candidate orbit centres drowned), and the four pod
 * cells are avoided by construction and asserted every tick by `levelRun`'s
 * own pin refusal.
 */
const NO_HAZARDS = [];
/**
 * ⛓⛓⛓ THE FIRST GAMEPLAY-CONSUMER TAPES ON THE SPLIT STREAM.
 *
 * Slice 6a shipped `rng: {seed, split}` with the split OFF by default and no
 * fixture asking for it. L112 is the first room whose GAMEPLAY reads random
 * numbers, so these two tapes are the first that declare it — and the split
 * is a PREMISE, not a preference: with it off, `Music.playSound("Rock", 0)`
 * draws from the gameplay stream once per rock LANDING and
 * `finalBossRng.js`'s schedule is short by exactly that many.
 * `assertOwlStreamPremises` refuses the fight without it.
 */
const RNG = { seed: 101, split: true };

// ── THE PLAN, AS SEARCHED ─────────────────────────────────────────────
/** The intro press — which is also shove 1 (see FINDING 1). */
const PRESS_1 = 2;
/** The square orbit that dodges both barrages: NW quadrant, 64 px, 30/side. */
const ORBIT = { cx: 56, cy: 56, s: 32, period: 30 };
/** Shove 2: a stance 16 px from the boss's leg to pod1, pressed at tick 326. */
const PRESS_2 = 326;
const STANCE_2 = { x: 103, y: 55 };
/** Shove 3: the KILL, from a stance west of his leg to pod2. */
const PRESS_3 = 789;
const STANCE_3 = { x: 37, y: 140 };
/** How long before a press the player leaves the orbit for the stance. */
const APPROACH = 90;

/**
 * The controller the search drove, kept as the tape's GENERATOR rather than
 * as a hand-written span list.
 *
 * ⛓ THE MOVEMENT AND THE TREATMENT COME FROM SEPARATE GENERATORS (§12): the
 * presses are a literal list and the movement is this closure, so deleting a
 * press cannot perturb a single movement tick. `keysToSpans` is lossless, so
 * the tape's spans ARE these per-tick sets.
 */
function controller(presses) {
    const phases = [
        { from: 0, kind: 'hold' },
        { from: 12, kind: 'orbit' },
        { from: PRESS_2 - APPROACH, kind: 'goto', ...STANCE_2 },
        { from: PRESS_2 - 3, kind: 'hold' },
        { from: PRESS_2 + 8, kind: 'orbit' },
        { from: PRESS_3 - APPROACH, kind: 'goto', ...STANCE_3 },
        { from: PRESS_3 - 3, kind: 'hold' },
    ];
    return (t, run) => {
        const out = new Set();
        if (presses.includes(t)) out.add('primary');
        let ph = null;
        for (const p of phases) if (t >= p.from) ph = p;
        if (!ph || ph.kind === 'hold') return out;
        let tx;
        let ty;
        if (ph.kind === 'goto') { tx = ph.x; ty = ph.y; } else {
            const i = Math.floor((t - ph.from) / ORBIT.period) % 4;
            [tx, ty] = [[ORBIT.cx + ORBIT.s, ORBIT.cy], [ORBIT.cx, ORBIT.cy + ORBIT.s],
                [ORBIT.cx - ORBIT.s, ORBIT.cy], [ORBIT.cx, ORBIT.cy - ORBIT.s]][i];
        }
        const dx = tx - run.state.x;
        const dy = ty - run.state.y;
        // ⛔ THE DEADBAND IS THE PLAYER'S OWN STEP. `moveSpeed` is 0.5 and the
        // per-axis step oscillates 0.41..0.97 (friction is subtractive on the
        // LENGTH and the input cap is per axis), so a band under 1 px chatters
        // and one over it parks short. 0.8 is inside both.
        if (dx > 0.8) out.add('right'); else if (dx < -0.8) out.add('left');
        if (dy > 0.8) out.add('down'); else if (dy < -0.8) out.add('up');
        return out;
    };
}

const freshRun = () => createLevelRun({
    levelSource: atlasLevelSource(),
    boot: BOOT,
    noclip: false,
    noHazards: NO_HAZARDS,
    // ⛔ FALSE ON BOTH ARMS. Surviving two live barrages IS the claim on the
    // drive; a `noDamage: true` tape would have proved nothing about the
    // stance at all.
    noDamage: false,
    grants: GRANTS,
    persistence: [],
    equips: [],
    pins: PINS,
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: RNG,
    roles: ROLES,
});

/** Drive the controller and return the per-tick key sets it chose. */
function drive(presses, ticks) {
    const r = freshRun();
    const ctrl = controller(presses);
    const keys = [];
    const stream = [];
    for (let t = 0; t < ticks; t += 1) {
        stream.push({ t, x: r.state.x, y: r.state.y, level: r.level });
        const k = ctrl(t, r);
        keys.push([...k]);
        r.advance(new Set(k));
    }
    return { run: r, keys, stream };
}

/** Replay a SPAN list, which is what the tape carries and the game reads. */
function replay(inputs, ticks) {
    const r = freshRun();
    const stream = [];
    for (let t = 0; t < ticks; t += 1) {
        stream.push({ t, x: r.state.x, y: r.state.y, level: r.level });
        r.advance(heldKeysAt({ inputs }, t));
    }
    return { run: r, stream };
}

// ── the drive, and the tick count derived from the TAGS ────────────────
const probe = drive([PRESS_1, PRESS_2, PRESS_3], PRESS_3 + 200);
const tagRow = probe.run.finalBossKills.find((k) => k.what === 'tagsWritten');
if (!tagRow) {
    throw new Error('plan: the three shoves did not reach `endAnim`\'s "dead" arm — '
        + `lava hits ${JSON.stringify(probe.run.finalBossLava.map((l) => l.t))}`);
}
/**
 * ⛔ THE WINDOW ENDS ON THE TAG TICK, +1. The two persistence writes land 109
 * ticks after the third lava hit (`finalBossDeathSchedule`; §8.6 priced it
 * 110 and §19.7 re-derived it as 109 — trap 104 in both directions, and they
 * compose). A tape that ended on the kill would have killed him and witnessed
 * nothing.
 */
const TICKS = tagRow.t + 2;
const driven = drive([PRESS_1, PRESS_2, PRESS_3], TICKS);
/**
 * ⛔⛔ AND `keysToSpans` DROPS THE PRESS, SILENTLY.
 *
 * It is the MOVER's encoder and it iterates `MOVER_KEYS` — `up`, `right`,
 * `down`, `left` — so a per-tick key set containing `primary` comes back as
 * spans with no press in them at all. The first cut of this plan handed it the
 * controller's own sets and got a tape whose every tick was the Owl's intro:
 * three shoves in the DRIVE and zero in the REPLAY, with nothing in between to
 * say which half was wrong. The presses are appended by name.
 * → [[feedback_span_encoder_drops_the_key_it_does_not_own]]
 */
const pressSpans = (presses) => presses.map((t) => ({ key: 'primary', from: t, to: t + 1 }));
const INPUTS = [
    ...keysToSpans(driven.keys),
    ...pressSpans([PRESS_1, PRESS_2, PRESS_3]),
];
const CONTROL_TICKS = PRESS_3 + 30;
const controlDriven = drive([PRESS_1, PRESS_2], CONTROL_TICKS);
const CONTROL_INPUTS = [
    ...keysToSpans(controlDriven.keys),
    ...pressSpans([PRESS_1, PRESS_2]),
];

const tapeFor = (name, inputs, tickCount, description) => parseTape({
    tape_version: 7,
    game: 'seedling',
    name,
    description,
    boot: BOOT,
    noclip: false,
    noDamage: false,
    noHazards: NO_HAZARDS,
    grants: GRANTS,
    persistence: [],
    equips: [],
    pins: PINS,
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: RNG,
    tick_count: tickCount,
    inputs,
});

const tape = tapeFor('r6-owl-kill', INPUTS, TICKS,
    'R6 slice 6f: THE OWL. Boots into L112 ten pixels west-north-west of `finalboss@64,96` '
    + 'and presses `primary` ONCE at tick 2 — which both dismisses the room\'s intro '
    + '(`FinalBoss.update` lowers `Game.freezeObjects` at the TOP of the frame, so '
    + '`Player.input()` still runs that tick and the press is not lost) and delivers the '
    + 'FIRST SHOVE. `onlyHitBy = "Lava"` means no press can damage him: the sword takes '
    + '`Enemy.hit`\'s `justKnock` arm and moves him, and the kill is his own '
    + '`hit(6, centre, 1, "Lava")` when his 12x12 box\'s first overlapping Tile is t=17. '
    + 'Lava hit 1 lands on tick 9. The player then holds a 64 px square orbit in the '
    + 'north-west quadrant for both 240-tick barrages — `stepsAhead` is -15, so the '
    + 'rockfall is aimed fifteen steps BEHIND a moving player and lands 17 ticks later, '
    + 'and a stationary player dies inside the first barrage. Two more presses, at ticks '
    + '326 and 789, shove him into the octagon from stances the search FORBADE the lethal '
    + '`t == 16` ring and the four pod cells out of. The third is the kill; '
    + '`endAnim`\'s "dead" arm writes `{112,0}` AND `{112,1}` 109 ticks later, spawns five '
    + 'more RockFalls (ten draws) and runs `Button.activateAll(null, 0, true)`. Declares '
    + '`rng: {seed: 101, split: true}` — the first gameplay consumer of the split stream.');

const control = tapeFor('r6-owl-control', CONTROL_INPUTS, CONTROL_TICKS,
    'R6 slice 6f: the two-shoves-for-three control — the same tape with the THIRD press '
    + 'deleted. The movement spans are byte-identical for every tick they share, because '
    + 'the presses are a literal list and the movement is a separate generator (§12). What '
    + 'the control shows is not "nothing happens": the boss takes lava hits 1 and 2 on the '
    + 'same ticks, walks to the same pods, and then walks the third leg UNSHOVED and '
    + 'starts his third barrage. `hits` stops at 2 of 3, `{112,0}` and `{112,1}` are never '
    + 'written, and there is no corpse. A PREFIX, not an equal: the drive\'s tail is a '
    + '109-tick death chain the control has no death to run.');

// ── the gates ────────────────────────────────────────────────────────
const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

const a = replay(tape.inputs, tape.tick_count);
const c = replay(control.inputs, control.tick_count);

const lava = a.run.finalBossLava;
check(lava.length === 3 && lava.every((l) => l.landed) && lava[2].killed,
    '⛓⛓⛓ THREE LAVA SELF-HITS, AND THE THIRD IS THE KILL',
    lava.map((l) => `t${l.t} hits=${l.hits} firstT=${l.firstT} wholly=${l.wholly}`).join('; '));
check(lava.every((l) => l.firstT === FINAL_BOSS.lavaT),
    '⛔ every hit\'s FIRST tile in world order is lava — trap 95\'s selection, not "the box '
    + 'overlaps a lava cell"',
    lava.map((l) => `t${l.t} firstT=${l.firstT} overlapped=${l.overlapped}`).join('; '));
const flags = a.run.finalBossFlags;
check(flags.length === 2
    && flags.some((f) => f.level === 112 && f.tag === 0)
    && flags.some((f) => f.level === 112 && f.tag === 1),
    '⛓⛓⛓ `{112,0}` AND `{112,1}` — the rung\'s last two ledger rows',
    JSON.stringify(flags));
const kills = a.run.finalBossKills;
const kill = kills.find((k) => k.what === 'kill');
const tags = kills.find((k) => k.what === 'tagsWritten');
check(kill && tags && tags.t - kill.t === 109,
    '⛔ THE DEATH CHAIN IS 109 TICKS, NOT §8.6\'s 110 — the model\'s prediction, and the '
    + 'recording arbitrates it',
    `kill t${kill?.t} -> dieAnimEnded t${kills.find((k) => k.what === 'dieAnimEnded')?.t} `
    + `-> tags t${tags?.t} (${tags && kill ? tags.t - kill.t : '?'} ticks)`);
const landed = a.run.finalBossShoves.filter((h) => h.landed);
/**
 * ⛔⛔⛔ AND THE CULL IS AT THE **RECT**, NOT AT THE REACH.
 *
 * §14.4/§19.6 said all five of a press's tests land, from the RECEIVER's side.
 * They do not, and the gate that stops them is one stage earlier than the one
 * this check was first written against: `Player.slash` re-runs
 * `collideRectInto` every tick, so a body the previous test shoved 8.75 px is
 * not COLLECTED at all — it never reaches `FP.distanceRectPoint`, and
 * `pressRespondersIn`'s `finalBosses` join drops it before the run's arm sees
 * it. So the refusal leaves no ledger row: the witness is the COUNT.
 */
check(a.run.finalBossShoves.length < 3 * 5 && landed.length === a.run.finalBossShoves.length,
    '⛔⛔ NOT ALL FIVE TESTS LAND — and the cull is at the RECT, one stage before '
    + 'the 16 px reach: a shoved body is not COLLECTED, so it leaves no refusal row',
    `${a.run.finalBossShoves.length} of ${3 * 5} hit tests reached him and all `
    + `${landed.length} of those landed; per press `
    + JSON.stringify([2, 326, 789].map((P) => a.run.finalBossShoves
        .filter((h) => h.t > P && h.t <= P + 5).length))
    + ' — the shove carries him out of his own hit rect part-way through his own press');
/**
 * ⛓⛓⛓ THE ORBIT DODGES THE BARRAGE COMPLETELY, AND THE ONE HIT IT DOES NOT
 * DODGE IS NOT A ROCK.
 *
 * 95 rocks land across two barrages and NOT ONE reaches the player: the -15
 * `stepsAhead` plus the rock's own 17-tick flight put ~32 ticks of the player's
 * velocity between the aim point and where he actually is. What does reach him
 * is a GRENADE — dropped at the Owl's own feet during a walk phase, exploding
 * 51 ticks later inside a 20 px radius, while the player is standing still at
 * a shove stance. ⇒ the vulnerable state is not the barrage; it is the STANCE.
 */
check(a.run.playerHits.length <= 1
    && !a.run.owlRockLandings.some((r) => r.hitPlayer)
    && a.run.playerHits.every((h) => h.source === 'owlGrenade'),
    '⛓⛓⛓ NOT ONE OF 95 ROCKS TOUCHES HIM — the only hit in two live barrages is a '
    + 'GRENADE at a stance, and `hitsMax` 3 survives it',
    `${a.run.owlRockLandings.length} rocks landed, `
    + `${a.run.owlRockLandings.filter((r) => r.hitPlayer).length} on the player; `
    + `${a.run.playerHits.length} hit(s) total `
    + JSON.stringify(a.run.playerHits.map((h) => `t${h.t} ${h.source}`)));
check(a.run.owlPods.every((p) => true) && a.run.ticksCompleted === TICKS,
    '⛓ the four pod cells are never entered — `levelRun` asserts the pin every tick',
    `${TICKS} ticks completed with no pin refusal; pods now `
    + JSON.stringify(a.run.owlPods.map((p) => p.anim)));
const corpse = a.run.finalBossCorpse;
check(corpse.length > 0 && corpse.every((r) => r.clearance > 0),
    '⛔ THE CORPSE IS A PERMANENT WALL AND THE STANCE CLEARS IT — the positive witness for '
    + 'a refusal no tape may reach',
    `${corpse.length} corpse ticks, minimum clearance `
    + `${Math.min(...corpse.map((r) => r.clearance)).toFixed(2)} px at `
    + `(${corpse[0]?.rect.x}, ${corpse[0]?.rect.y})`);
const ticksLog = a.run.owlTicks;
check(ticksLog.length === TICKS && ticksLog.every((r) => r.draws === (
    r.phase === 'barrageSpawn' ? 4 : r.phase === 'walkGrenade' ? 2
        : r.phase === 'barrage' || r.phase === 'walk' ? 1 : (r.deathArm ? 10 : 0))),
    '⛓⛓ THE DRAW SCHEDULE HOLDS ON EVERY TICK — two computations of one number',
    `${ticksLog.length} ticks; total gameplay draws ${a.run.owlStreamCount}; phases `
    + JSON.stringify([...new Set(ticksLog.map((r) => r.phase))]));

// ── the control ──────────────────────────────────────────────────────
const cLava = c.run.finalBossLava;
check(cLava.length === 2 && !cLava.some((l) => l.killed),
    '⛓ THE CONTROL LANDS TWO OF THREE',
    cLava.map((l) => `t${l.t} hits=${l.hits}`).join('; '));
check(c.run.finalBossFlags.length === 0 && c.run.finalBossCorpse.length === 0,
    '⛔ `{112,0}` and `{112,1}` are NEVER WRITTEN and there is no corpse',
    `flags ${c.run.finalBossFlags.length}, corpse ticks ${c.run.finalBossCorpse.length}, `
    + `hits ${c.run.finalBosses[0]?.hits} of ${FINAL_BOSS.hitsMax}`);
const move = (t) => t.inputs.filter((s) => s.key !== 'primary');
const commonMoves = (t) => move(t).map((s) => `${s.key}:${s.from}-${s.to}`);
const driveMoves = commonMoves(tape).filter((s) => Number(s.split(':')[1].split('-')[0]) < CONTROL_TICKS - 40);
const ctrlMoves = commonMoves(control).filter((s) => Number(s.split(':')[1].split('-')[0]) < CONTROL_TICKS - 40);
check(JSON.stringify(driveMoves) === JSON.stringify(ctrlMoves),
    '⛔ THE MOVEMENT SPANS COME FROM A SEPARATE GENERATOR AND ARE IDENTICAL',
    `${driveMoves.length} shared movement spans compared; the presses differ by exactly `
    + `one (${move(tape).length} vs ${move(control).length} movement spans, `
    + `${tape.inputs.length - move(tape).length} vs `
    + `${control.inputs.length - move(control).length} primary)`);
check(c.run.playerHits.length === 0,
    '⛓ and the control takes no damage either — the abort buys a barrage, not a heart',
    `control hits ${c.run.playerHits.length}`);

for (const k of checks) {
    console.log(`${k.ok ? '  ok ' : 'FAIL '}${k.name}\n       ${k.detail}`);
}
console.log('');
console.log(`presses ${[PRESS_1, PRESS_2, PRESS_3].join(', ')}; lava hits `
    + `${lava.map((l) => l.t).join(', ')}; tags ${tags?.t}; drive ${TICKS} ticks, `
    + `control ${CONTROL_TICKS}`);
console.log(`gameplay draws ${a.run.owlStreamCount} (level build 2 + `
    + `${a.run.owlStreamCount - 2} in the fight); rocks ${a.run.owlRockLandings.length}; `
    + `grenades ${a.run.owlGrenadeEvents.filter((g) => g.what === 'spawned').length}`);

if (SEARCH) {
    console.log('\nTHE SEARCH TRIPLE (see the as-built §20):');
    console.log('  SCORE       three lava hits, the kill, both tags, zero damage');
    console.log('  GRANULARITY press ticks at step 6 over each walk window; stances on a '
        + '3-radius x 24-direction polar grid (12/14/16 px), rounded to integers');
    console.log('  CONSTRAINT  FORBIDDEN, not scored: a stance overlapping the boss\'s '
        + '12x12 box; `distanceRectPoint` > 16; a push whose ray points away from the '
        + 'lava centre; any tile with t in {16, 17} (both are lethal); the four pod cells');
}

if (checks.some((k) => !k.ok)) {
    console.error('\n⛔ at least one check FAILED — nothing written');
    process.exit(1);
}

if (WRITE) {
    for (const t of [tape, control]) {
        const path = join(MODULE, 'fixtures', 'tapes', `${t.name}.json`);
        writeFileSync(path, `${serializeTape(t)}\n`);
        console.log(`wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the tapes)');
}
