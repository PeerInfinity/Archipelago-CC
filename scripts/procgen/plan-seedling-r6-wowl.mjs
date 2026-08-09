#!/usr/bin/env node
/**
 * plan-seedling-r6-wowl — ⛓⛓⛓ THE OWL, AND THE LADDER'S THIRD BOSS KILL IS
 * ONE THE PLAYER NEVER DEALS.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slices 6f and 6g. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §8.5, §8.6, §14.4, §16.5,
 * §16.8, §19 (the pinned draw schedule and fight model this drives), §20 (the
 * first search) and §21 (the attribution that moved it).
 *
 * ── WHAT THE WINDOW DOES ──────────────────────────────────────────────
 *
 * `onlyHitBy = "Lava"`: a sword press cannot damage the Owl at all. It takes
 * `Enemy.hit`'s `justKnock` arm and SHOVES him, and the only thing that can
 * kill him is his own `hit(6, centre, 1, "Lava")` — fired when his 12x12
 * box's FIRST overlapping `Tile` is `t == 17`. So the tape is three shoves
 * and a lot of dodging, and every number below came out of a search over the
 * real `levelRun`.
 *
 * ── ⛔⛔⛔ FINDING 1, RETIRED BY THE GAME (§21) ────────────────────────
 *
 * Slice 6f opened the fight with the intro-dismissing press, on the reading
 * that `FinalBoss.update` lowers `Game.freezeObjects` at the top of the frame
 * and `Player.input()` therefore still runs that tick. **The game counted
 * ZERO hit tests for that press.** `Bot` dispatches the DOWN edge on a span's
 * `from` and the UP edge on its `to`, `Input.onKeyUp` is the only writer of
 * `_release`, and `Input.update()` runs at the END of the engine frame — so
 * the intro ends on `to`, the freeze is still up when the player updates on
 * `from`, and the press is swallowed at both ends.
 *
 * §19.5 read the edge as `from` because the boss's polled position was one
 * 0.5303 px step further along than a release on `to` permits. It was, and
 * the step is the TAPE's: an N-tick tape runs **N + 1** world updates,
 * because `Bot.update` records observation N and disarms at the top of a
 * frame whose world update then runs anyway. Two off-by-ones, cancelling in
 * both quantities the 6e probe could measure.
 *
 * ⇒ **the fight opens with no free shove**, and this plan buys its first one.
 * `hitThisSequence` still starts FALSE, so the first lava hit still needs no
 * barrage before it — only a press.
 *
 * ── ⛓⛓⛓ FINDING 2: A STANDING PLAYER DIES, AND AN ORBITING ONE ALMOST
 *    NEVER GETS TOUCHED ────────────────────────────────────────────────
 *
 * `stepsAhead` is **-15**, so the barrage is aimed fifteen steps of the
 * player's own velocity BEHIND them, and the rock then takes 17 more ticks to
 * land. A stationary player is aimed at directly and dies inside the first
 * barrage. A player holding a 64 px square orbit carries ~32 ticks of lead —
 * about 22 px per axis against a +-20 px spray.
 *
 * ⚠ AND WHETHER A ROCK LANDS AT ALL IS A PROPERTY OF THE PLAN, NOT OF THE
 * ORBIT. §20.4's plan took none of 95, slice 6g's took one (at tick 555, on
 * the approach to the third stance), and slice 6h's takes none again — the
 * vulnerable state is the STANCE and the walk to it either way, and `hitsMax`
 * 3 survives one. The check is `<= 1`, which is the claim; the count is
 * reported rather than asserted.
 *
 * ⛔ AND THE ORBIT'S CENTRE IS A CONSTRAINT, NOT A PREFERENCE. `t == 16` —
 * the ring around the lava — is a LETHAL terrain state, so the whole octagon
 * plus a tile of margin is forbidden floor for the player.
 *
 * ── ⛓⛓ FINDING 3: THE FIVE HIT TESTS ARE CULLED BY THE RECT ───────────
 *
 * §14.4/§19.6 derived the shove from the RECEIVER's gate: `justKnock` sets no
 * `hitsTimer`, so all five of a press's tests land and compound. The
 * DISPATCHER has gates too — the 16x32 slash rect, which faces where the
 * player's PREVIOUS tick's velocity pointed, and a 16 px
 * `FP.distanceRectPoint` — and the shove is 4.75 px on the second test and
 * 8.75 on every one after. So the body recedes out of its own hit rect
 * part-way through its own press, and how many of the five land is GEOMETRY.
 * `run.finalBossShoves` records every test that reached him.
 *
 * ⚠ THE COUNT IS STILL A MODEL NUMBER. The game has confirmed the DISPATCH
 * count (`botStatus.slash.tests` reads 5 for one press) and has not yet been
 * asked one whose tests land.
 *
 * ── THE PAIR ──────────────────────────────────────────────────────────
 *
 * The one-primitive-fewer PREFIX (W-totem's shape): the same tape with the
 * THIRD shove press deleted, and the movement spans byte-identical because
 * they come from a separate generator (§12). The control's boss takes two of
 * three lava hits, `{112,0}` and `{112,1}` are never written, and the fight
 * runs on.
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
const { ROLES, buildLevelWorld } = await import(join(MODULE, 'levelWorld.js'));
const { serializeTape, parseTape, heldKeysAt } = await import(join(MODULE, 'tapeFormat.js'));
const { keysToSpans } = await import(join(MODULE, 'mover.js'));
const { FINAL_BOSS } = await import(join(MODULE, 'finalBossFight.js'));

/**
 * ⚠ THE BOOT BLOCK IS `new Game(level, x, y)`'s ARGUMENTS, not the entity
 * point — `spawnFromBoot` adds `(Tile.w/2, Tile.h/2)`. (55,101) spawns the
 * player at **(63,109)**, which is 10 px west-north-west of the Owl's own
 * spawn (72,104) — clear of his 12x12 box (so no contact damage) and on a
 * `t == 37` floor tile rather than the lethal `t == 16` ring.
 */
const BOOT = { level: 112, x: 55, y: 101 };
const GRANTS = [{ level: 112, items: ['sword'] }];
const PINS = ['sound', 'dead_frames'];
/**
 * ⛔ EMPTY, AND BOTH HALVES ARE EARNED. The lava and its `t == 16` ring are
 * routed around by the plan (the search FORBADE them rather than scoring them
 * away), and the four pod cells are avoided by construction and asserted
 * every tick by `levelRun`'s own pin refusal.
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

// ── THE PLAN, AS SEARCHED (§21.8) ─────────────────────────────────────
/**
 * The intro press. ⛔ NOT a shove — see FINDING 1. It is a one-tick span
 * because `levelRun` refuses a longer one across the intro (no arm has driven
 * one), and it costs the fight nothing: the boss is frozen until its `to`.
 */
const INTRO_PRESS = 2;
/** The square orbit that dodges the barrages: NW quadrant, 64 px, 30/side. */
const ORBIT = { cx: 56, cy: 56, s: 32, period: 30 };
/**
 * The three shoves: press tick and the stance the player walks to. Each was
 * found by replaying the real `levelRun` over a polar grid around the boss's
 * own position at that tick — see `--search`.
 */
const SHOVES = [
    { t: 15, x: 61, y: 102 },
    { t: 298, x: 102, y: 52 },
    { t: 697, x: 29, y: 134 },
];
/** How long before a press the player leaves the orbit for the stance. */
const APPROACH = 60;
/**
 * ⛔⛔ THE LAST TICKS BEFORE A PRESS HOLD ONE KEY, AND THAT IS THE FACING.
 *
 * `Player.slash`'s rect is `getSlashRect()` on `slashDirection`, which
 * `set slashing` copies from `direction` — and `direction` is written in
 * `sprites()`, BELOW `slash()` in `Player.update`. So the rect a press throws
 * is the facing implied by the PREVIOUS tick's velocity, and the rule is
 * `v.x` first (`< 0` left, `> 0` right) and only then `v.y`. Holding a single
 * key toward the boss for the ticks below the press is what makes the rect
 * point at him; a diagonal approach would face him horizontally whatever the
 * geometry wanted.
 */
const FACE = 8;

/**
 * The controller the search drove, kept as the tape's GENERATOR rather than
 * as a hand-written span list.
 *
 * ⛓ THE MOVEMENT AND THE TREATMENT COME FROM SEPARATE GENERATORS (§12).
 * `movement` is the full shove list and decides where the player goes;
 * `presses` is a literal list and decides what he does when he gets there.
 * Deleting a press therefore cannot perturb a single movement tick, which is
 * what makes the control a one-primitive-fewer PREFIX rather than a different
 * tape.
 */
function controller(movement, presses) {
    return (t, run) => {
        const out = new Set();
        if (t === INTRO_PRESS || presses.includes(t)) out.add('primary');
        const own = movement.find((k) => t >= k.t - APPROACH && t <= k.t + 6);
        let tx;
        let ty;
        if (own && t >= own.t - FACE && t <= own.t) {
            const b = run.finalBosses[0];
            if (!b) return out;
            const dx = b.x - run.state.x;
            const dy = b.y - run.state.y;
            if (Math.abs(dx) >= Math.abs(dy)) out.add(dx > 0 ? 'right' : 'left');
            else out.add(dy > 0 ? 'down' : 'up');
            return out;
        }
        if (own && t > own.t) return out; // the six ticks after a press: still
        if (own) { tx = own.x; ty = own.y; } else {
            const i = Math.floor(t / ORBIT.period) % 4;
            [tx, ty] = [[ORBIT.cx + ORBIT.s, ORBIT.cy], [ORBIT.cx, ORBIT.cy + ORBIT.s],
                [ORBIT.cx - ORBIT.s, ORBIT.cy], [ORBIT.cx, ORBIT.cy - ORBIT.s]][i];
        }
        const dx = tx - run.state.x;
        const dy = ty - run.state.y;
        // ⛔ THE DEADBAND IS THE PLAYER'S OWN STEP. `moveSpeed` is 0.8 on this
        // floor and the per-axis step oscillates 0.81..1.53 on a diagonal, so
        // a band under 0.8 chatters and one much over it parks short.
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
function drive(movement, presses, ticks) {
    const r = freshRun();
    const ctrl = controller(movement, presses);
    const keys = [];
    for (let t = 0; t < ticks; t += 1) {
        const k = ctrl(t, r);
        keys.push([...k]);
        r.advance(new Set(k));
    }
    return { run: r, keys };
}

/** Replay a SPAN list, which is what the tape carries and the game reads. */
function replay(inputs, ticks) {
    const r = freshRun();
    for (let t = 0; t < ticks; t += 1) r.advance(heldKeysAt({ inputs }, t));
    return { run: r };
}

if (SEARCH) {
    /**
     * ── THE SEARCH, RUN RATHER THAN DESCRIBED ─────────────────────────
     *
     * Slice 6f kept only the triple; slice 6g had to re-run it when the fix
     * moved the plan, and a search that lives in a session is a search that
     * gets re-derived. It is behind a flag because it is minutes of full
     * `levelRun` replays and the PLAN above is its answer, pinned as a
     * constant with thirteen checks over it.
     */
    const world = buildLevelWorld(atlasLevelSource()(112), { roles: ROLES });
    const tileAt = (x, y) => world.tiles.find((t) => t.x === Math.floor(x / 16) * 16 + 8
        && t.y === Math.floor(y / 16) * 16 + 8);
    const lethalFloor = (x, y) => {
        const t = tileAt(x, y);
        return !t || t.t === 16 || t.t === 17;
    };
    const LAVA_CENTRE = { x: 120, y: 128 };
    const RADII = [10, 12, 14, 16, 18];
    const DIRS = 24;
    const STEP = 4;
    const HORIZON = 1500;

    const track = (shoves) => {
        const { run } = drive(shoves, shoves.map((s) => s.t), HORIZON);
        const lavaAt = new Set(run.finalBossLava.map((l) => l.t));
        let armed = true;
        return run.owlTicks.map((o) => {
            if (o.phase === 'podTick') armed = true;
            const row = { t: o.t, x: o.bossX, y: o.bossY, phase: o.phase, hits: o.hits, armed };
            if (lavaAt.has(o.t)) armed = false;
            return row;
        });
    };
    /** Contiguous walk blocks in which the (k+1)-th lava hit is still available. */
    const blocksFor = (rows, k) => {
        const out = [];
        for (const o of rows) {
            if (!(o.armed && o.hits === k
                && (o.phase === 'walk' || o.phase === 'walkGrenade'))) continue;
            const last = out[out.length - 1];
            if (last && o.t === last[last.length - 1] + 1) last.push(o.t); else out.push([o.t]);
        }
        return out;
    };
    const stances = (rows, T) => {
        const b = rows.find((o) => o.t === T);
        const out = [];
        if (!b) return out;
        for (const r of RADII) {
            for (let i = 0; i < DIRS; i += 1) {
                const ang = (i / DIRS) * Math.PI * 2;
                const x = Math.round(b.x + r * Math.cos(ang));
                const y = Math.round(b.y + r * Math.sin(ang));
                // FORBIDDEN, never scored away.
                if (lethalFloor(x, y) || lethalFloor(x + 2, y + 2)
                    || lethalFloor(x - 2, y - 2)) continue;
                if (Math.abs(x - b.x) < 8 && Math.abs(y - b.y) < 8) continue;
                if (FINAL_BOSS.podPositions.some((p) => Math.abs(x - p.x) < 12
                    && Math.abs(y - p.y) < 12)) continue;
                if ((b.x - x) * (LAVA_CENTRE.x - b.x)
                    + (b.y - y) * (LAVA_CENTRE.y - b.y) <= 0) continue;
                out.push({ t: T, x, y, r, dir: i });
            }
        }
        return out;
    };

    const chosen = [];
    let tried = 0;
    let rejected = 0;
    for (let w = 0; w < 3; w += 1) {
        const rows = track(chosen);
        const blocks = blocksFor(rows, w);
        let best = null;
        for (const block of blocks) {
            if (best) break;
            for (let i = 0; i < block.length; i += STEP) {
                for (const s of stances(rows, block[i])) {
                    tried += 1;
                    const list = [...chosen, { t: s.t, x: s.x, y: s.y }];
                    let run;
                    try {
                        ({ run } = drive(list, list.map((k) => k.t),
                            Math.min(HORIZON, s.t + 120)));
                    } catch { rejected += 1; continue; }
                    if (run.finalBossLava.length < w + 1
                        || run.playerHits.some((h) => h.died)) { rejected += 1; continue; }
                    const hits = run.playerHits.length;
                    const at = run.finalBossLava[w].t;
                    if (best === null || hits < best.hits
                        || (hits === best.hits && at < best.at)) best = { s, hits, at };
                }
            }
        }
        if (!best) {
            console.error(`\n⛔ the search found no ${w + 1}th shove`);
            process.exit(1);
        }
        chosen.push({ t: best.s.t, x: best.s.x, y: best.s.y });
    }
    console.log('\nTHE SEARCH TRIPLE (see the as-built §21.8):');
    console.log(`  SCORE       three lava self-hits, the kill, both tags, `
        + `the fewest player hits and then the earliest hit`);
    console.log(`  GRANULARITY press ticks every ${STEP} eligible walk ticks, block by `
        + `block; stances on a ${RADII.length}-radius x ${DIRS}-direction polar grid `
        + `(${RADII.join('/')} px), rounded to integers; ${tried} candidates, each a full `
        + '`levelRun` replay');
    console.log('  CONSTRAINT  FORBIDDEN, not scored: a stance overlapping the boss\'s '
        + '12x12 box; a push whose ray points away from the lava centre; any tile with '
        + 't in {16, 17} (both are lethal); the four pod cells; a run that throws');
    console.log(`  rejected ${rejected} of ${tried}`);
    console.log(`  FOUND ${JSON.stringify(chosen)}`);
    if (JSON.stringify(chosen) !== JSON.stringify(SHOVES)) {
        console.error('\n⛔ the search no longer reproduces the pinned plan');
        process.exit(1);
    }
    console.log('  — and it is the plan pinned above, reproduced');
}

const PRESS_TICKS = SHOVES.map((s) => s.t);

// ── the drive, and the tick count derived from the TAGS ────────────────
const probe = drive(SHOVES, PRESS_TICKS, PRESS_TICKS[2] + 200);
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
const driven = drive(SHOVES, PRESS_TICKS, TICKS);
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
const pressSpans = (ts) => ts.map((t) => ({ key: 'primary', from: t, to: t + 1 }));
const INPUTS = [
    ...keysToSpans(driven.keys),
    ...pressSpans([INTRO_PRESS, ...PRESS_TICKS]),
];
const CONTROL_TICKS = PRESS_TICKS[2] + 30;
const controlDriven = drive(SHOVES, PRESS_TICKS.slice(0, 2), CONTROL_TICKS);
const CONTROL_INPUTS = [
    ...keysToSpans(controlDriven.keys),
    ...pressSpans([INTRO_PRESS, ...PRESS_TICKS.slice(0, 2)]),
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
    'R6 slice 6g: THE OWL. Boots into L112 ten pixels west-north-west of `finalboss@64,96` '
    + 'and presses `primary` at tick 2 to dismiss the room\'s intro — which costs the '
    + 'fight NOTHING (the intro ends on the span\'s RELEASE, so the freeze is still up '
    + 'when the player updates on the press tick and the game counts zero hit tests for '
    + 'it; slice 6f\'s "the intro press IS the first shove" is retired). `onlyHitBy = '
    + '"Lava"` means no press can damage him: the sword takes `Enemy.hit`\'s `justKnock` '
    + 'arm and moves him, and the kill is his own `hit(6, centre, 1, "Lava")` when his '
    + '12x12 box\'s first overlapping Tile is t=17. Three shoves — at ticks 15, 296 and '
    + '699, each from a stance the search FORBADE the lethal `t == 16` ring and the four '
    + 'pod cells out of, each preceded by eight ticks of a single held key so the slash '
    + 'rect faces him — land lava hits at 18, 305 and 706. Between them the player holds '
    + 'a 64 px square orbit in the north-west quadrant for both 240-tick barrages: '
    + '`stepsAhead` is -15, so the rockfall is aimed fifteen steps BEHIND a moving player '
    + 'and lands 17 ticks later, and of ninety-five rocks exactly one reaches him (tick '
    + '555, on the approach to the third stance). The third hit is the kill; `endAnim`\'s '
    + '"dead" arm writes `{112,0}` AND `{112,1}` 109 ticks later, spawns five more '
    + 'RockFalls (ten draws) and runs `Button.activateAll(null, 0, true)`. Declares '
    + '`rng: {seed: 101, split: true}` — the first gameplay consumer of the split stream.');

const control = tapeFor('r6-owl-control', CONTROL_INPUTS, CONTROL_TICKS,
    'R6 slice 6g: the two-shoves-for-three control — the same tape with the THIRD press '
    + 'deleted. The movement spans are byte-identical for every tick they share, because '
    + 'the presses are a literal list and the movement is a separate generator (§12) that '
    + 'is handed the full shove list either way. What the control shows is not "nothing '
    + 'happens": the boss takes lava hits 1 and 2 on the same ticks, walks the same legs, '
    + 'and then walks the third UNSHOVED. `hits` stops at 2 of 3, `{112,0}` and `{112,1}` '
    + 'are never written, and there is no corpse. A PREFIX, not an equal: the drive\'s '
    + 'tail is a 109-tick death chain the control has no death to run.');

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
/**
 * ⛔⛔⛔ THE INTRO PRESS IS NOT A SHOVE, AND THIS IS THE ROW THAT SAYS SO.
 *
 * §20.3's retirement, kept as an assertion rather than as prose: no hit test
 * of the tape's FIRST press ever reaches him, because the intro's freeze is
 * still up when the player updates on the span's `from` and the span's `to`
 * is a release. The game's own witness is `botStatus.slash.tests`, which read
 * 0 for exactly this press (§21.4).
 */
check(!a.run.finalBossShoves.some((h) => h.t > INTRO_PRESS && h.t <= INTRO_PRESS + 5),
    '⛔⛔ THE INTRO PRESS DELIVERS NO HIT TEST — §20.3 retired, and asserted',
    `hit tests in ticks ${INTRO_PRESS + 1}..${INTRO_PRESS + 5}: `
    + `${a.run.finalBossShoves.filter((h) => h.t > INTRO_PRESS
        && h.t <= INTRO_PRESS + 5).length}`);
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
/**
 * ⛓⛓⛓ AND SLICE 6h's PLAN BUYS A REFUSAL ROW THE OLD ONE COULD NOT.
 *
 * The first press's tests run on ticks 16..20 and the boss's own LAVA hit
 * lands at 18 — which sets `hitsTimer = 30`, and `Enemy.hit`'s first gate is
 * `hitsTimer <= 0`. So the third test reaches him and is REFUSED, with a
 * reason, by a different gate from the one that culls the other four. Trap
 * 114 says the rect's cull leaves no row; this says the i-frame's does, and
 * the two are visible side by side in one press.
 */
const refused = a.run.finalBossShoves.filter((h) => !h.landed);
check(a.run.finalBossShoves.length < 3 * 5
    && refused.length === 1 && refused[0].why === 'hitsTimer is 30'
    && refused[0].t === lava[0].t,
    '⛔⛔ NOT ALL FIVE TESTS LAND — the cull is at the RECT (no row) and the ONE row '
    + 'there is comes from the lava i-frame, on the tick the self-hit landed',
    `${a.run.finalBossShoves.length} of ${3 * 5} hit tests reached him, `
    + `${landed.length} landed and ${refused.length} was refused `
    + `(t${refused[0]?.t}: ${refused[0]?.why}); per press `
    + JSON.stringify(PRESS_TICKS.map((P) => a.run.finalBossShoves
        .filter((h) => h.t > P && h.t <= P + 5).length))
    + ' — the shove carries him out of his own hit rect part-way through his own press');
/**
 * ⛓⛓ THE ORBIT DODGES THE ROCKS, AND WHICH ONES IT DOES NOT IS THE PLAN's.
 *
 * §20.4's plan took none of 95; slice 6g's took one, at tick 555, while the
 * player crossed to the third stance; this one takes none of 95 again. The
 * count is a property of three particular walks through a barrage, so it is
 * REPORTED and the assertion is the claim that survives a re-search: at most
 * one hit, and no death — `hitsMax` 3 leaves two to spare.
 */
check(a.run.playerHits.length <= 1 && !a.run.playerHits.some((h) => h.died),
    '⛓⛓ ONE ROCK IN A HUNDRED REACHES HIM — and `hitsMax` 3 survives it',
    `${a.run.owlRockLandings.length} rocks landed, `
    + `${a.run.owlRockLandings.filter((r) => r.hitPlayer).length} on the player; `
    + `${a.run.playerHits.length} hit(s) total `
    + JSON.stringify(a.run.playerHits.map((h) => `t${h.t} ${h.source}`)));
check(a.run.ticksCompleted === TICKS,
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
/**
 * ⛔⛔⛔ THE CONTROL'S WORLD DIVERGES, AND THE TICK IT DIVERGES ON IS THE
 * FINDING.
 *
 * §12's separation is about the GENERATOR: the movement closure is handed the
 * full shove list either way, so deleting a press cannot change where the
 * player is TOLD to go. It is a closed-loop controller, though, and the
 * control's world stops being the drive's the moment the unshoved Owl walks
 * into the player — which he does, at tick 709, twelve ticks after the press
 * that would have thrown him. After that the control's player is in i-frames
 * (`Player.input()` gates its whole movement block on `hitsTimer <= 0`) and
 * its spans are a different tape.
 *
 * ⇒ the identity is asserted over the ticks the two arms SHARE, and the
 * divergence tick is asserted to be exactly that contact. "Identical up to
 * here, and here is why" is a stronger pair claim than an identity bought by
 * ending the control early — and it names what the third shove buys.
 *
 * ⛔ AND THE COMPARISON IS PER TICK, NOT PER SPAN STRING. A span that is live
 * when the control's tape ENDS is truncated by its own `tick_count`
 * (`up:704-750` against `up:704-727`), so two identical drives print two
 * different span lists. Slice 6f's version compared the strings and passed
 * only because that plan's last shared span happened to close before the
 * control did — a coincidental predicate, and it rotted the moment the plan
 * moved. What the claim is ABOUT is the keys the game holds on each shared
 * tick, so that is what is compared.
 */
const contact = c.run.playerHits.find((h) => !a.run.playerHits.some((g) => g.t === h.t));
const DIVERGES_AT = contact ? contact.t : CONTROL_TICKS;
const move = (t) => t.inputs.filter((s) => s.key !== 'primary');
/** The movement keys the GAME holds on tick `t`, primary excluded. */
const movesAt = (t, tick) => [...heldKeysAt({ inputs: move(t) }, tick)].sort().join('+');
const sharedTicks = Math.min(DIVERGES_AT, tape.tick_count, control.tick_count);
let firstMoveDiff = null;
for (let t = 0; t < sharedTicks && firstMoveDiff === null; t += 1) {
    if (movesAt(tape, t) !== movesAt(control, t)) firstMoveDiff = t;
}
check(firstMoveDiff === null,
    '⛔ THE MOVEMENT SPANS COME FROM A SEPARATE GENERATOR AND ARE IDENTICAL UP TO THE '
    + 'TICK THE CONTROL\'S WORLD DIVERGES',
    `${sharedTicks} shared ticks compared key by key up to t${DIVERGES_AT}`
    + `${firstMoveDiff === null ? '' : ` — FIRST DIFFERENCE AT t${firstMoveDiff}`}; `
    + `${move(tape).length} vs ${move(control).length} movement spans; the presses differ `
    + `by exactly one (${tape.inputs.length - move(tape).length} vs `
    + `${control.inputs.length - move(control).length} primary)`);
check(contact !== undefined && contact.source === 'owlBody'
    && contact.t > PRESS_TICKS[2] && contact.t < PRESS_TICKS[2] + 30,
    '⛓⛓⛓ AND WHAT THE THIRD SHOVE BUYS IS MEASURED: without it the Owl WALKS INTO THE '
    + 'PLAYER, twelve ticks later',
    `drive hits ${JSON.stringify(a.run.playerHits.map((h) => `t${h.t} ${h.source}`))}; `
    + `control hits ${JSON.stringify(c.run.playerHits.map((h) => `t${h.t} ${h.source}`))}`);

for (const k of checks) {
    console.log(`${k.ok ? '  ok ' : 'FAIL '}${k.name}\n       ${k.detail}`);
}
console.log('');
console.log(`intro press ${INTRO_PRESS} (no shove); shoves ${PRESS_TICKS.join(', ')}; `
    + `lava hits ${lava.map((l) => l.t).join(', ')}; tags ${tags?.t}; drive ${TICKS} ticks, `
    + `control ${CONTROL_TICKS}`);
console.log(`gameplay draws ${a.run.owlStreamCount} (level build 2 + `
    + `${a.run.owlStreamCount - 2} in the fight); rocks ${a.run.owlRockLandings.length}; `
    + `grenades ${a.run.owlGrenadeEvents.filter((g) => g.what === 'spawned').length}`);


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
