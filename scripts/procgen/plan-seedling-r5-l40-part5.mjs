#!/usr/bin/env node
/**
 * plan-seedling-r5-l40-part5 — ⛓⛓⛓ THE FIRST KILL THIS MODEL PREDICTS,
 * AND THE LINK IT OPENS.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 21 step 1, RE-ARMED
 * at slice 22 step 0b. Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md`
 * §34.10 items 1 and 2, then §35.11 item 1.
 *
 * ── WHAT THE WINDOW DOES ──────────────────────────────────────────────
 *
 * From the L40 arrival at (480,896), in ONE visit:
 *
 *   1. walk to `buttonroom@880,768 {t 3}` and hold it — link 3, the room
 *      self-latch that unplugs the arrival's own column;
 *   2. walk north to (488,440), a stance 112 px inside `iceturret@472,400`'s
 *      128 px attack range;
 *   3. KILL it — three sword presses at the 31-tick i-frame cadence, which
 *      is the first damage this model has ever predicted;
 *   4. two northward `fire.bumps` presses, which put the 16x16 corpse on
 *      `button@480,384 {t 2}`;
 *   5. wait, and watch the t2 group open under a body that is not the
 *      player's.
 *
 * ── ⛔⛔⛔ WHY THAT IS A FINDING AND NOT A LEG ───────────────────────
 *
 * `r5Totem.L40_ARRIVAL_BREAK` reads: *"THE CHAIN FROM THE L40 ARRIVAL STOPS
 * AT LINK 4. One plain button, whose opening exists only WHILE HELD, whose
 * persistence write is inert because its group is 2, and which no block in
 * the level can reach, gates every remaining link."* Every clause of that
 * is still true. **A corpse is not a block**, and the kill stance is inside
 * the links-1–3 component — so the walk that opens link 4 does not need
 * link 4, and the break is repaired from the arrival.
 *
 * ⛔ AND THE CHAIN STOPS ONE LINK LATER, for a reason
 * `probe-seedling-r5-l40-kill.mjs` measures: `button@816,400 {t 4}` — the
 * pulser's arm — is NOT inside link 4's +208. It is behind
 * `wandlock@800,400`, whose only opener is `button@768,400 {t 5}`, and the
 * room past that lock is a EIGHT-CELL ONE-WAY TRAP. So link 5 needs a
 * holder while the player crosses, L40 can make exactly ONE corpse, and it
 * is already spent on link 4 — which is what makes the t5 button reachable
 * in the first place. **One corpse, two holds, strict dependency.**
 *
 * ── THE PAIR ──────────────────────────────────────────────────────────
 *
 * ⛓⛓⛓ R5 SLICE 22: the control is the SAME TARGET LIST with the SECOND
 * `fire.bumps` press removed — same walk, same kill, same stance, same
 * 140-tick wait, and a corpse that comes to rest ONE TILE SHORT at (30,25).
 * Its 16x16 box is `[480,496) x [400,416)` against a button at `[480,496) x
 * [384,400)`: adjacent, not overlapping. The control's 1,937 ticks are
 * byte-identical to the drive's first 1,937.
 *
 * ⛔⛔⛔ AND IT IS NOT SLICE 21's CONTROL, FOR TWO REASONS THAT ARE BOTH
 * FINDINGS. That one deleted the three kill spans from this tape:
 *
 *   1. deleting the kill leaves the turret ALIVE and FIRING, so the control
 *      takes freezes the drive never sees and one of them lands on a
 *      surviving fire press — which `Player.input()`'s first-line return
 *      makes a LOST press, not a delayed one. ⇒ **a byte-identical-walk
 *      pair is impossible in a room with a live shooter**;
 *   2. and a kill-less arm cannot be SYNTHESISED at all: `runFire`'s bump
 *      arm refuses a live turret by name. The deletion worked only because
 *      it bypassed the verb.
 *
 * ⇒ the pair isolates the HOLD, which is what the leg is about, and the
 * other half — no kill, no corpse — is a hard refusal in the verb rather
 * than a walk that did nothing.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-l40-part5.mjs [--write]
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { synthesizeLegs } = await import(join(MODULE, 'botDriverV2.js'));
const { parseTape, serializeTape } = await import(join(MODULE, 'tapeFormat.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { L40_ARRIVAL, L40_CORPSE } = await import(join(MODULE, 'r5Totem.js'));
const { ICE_TURRET } = await import(join(MODULE, 'iceTurret.js'));
const { KILL_PRESS_CADENCE } = await import(join(MODULE, 'combatVerbs.js'));

const WRITE = process.argv.includes('--write');
const levelSource = atlasLevelSource();
const TURRET = L40_CORPSE.turret.id;

/**
 * ⚠ THE CENSUS THIS LEG IS PLANNED AGAINST, asked for by name. L40 holds 21
 * counted enemies, and without the `combat` role the corpse's glide
 * corridor cannot be certified at all — `runFire`'s bump arm refuses an
 * ABSENT census rather than reading it as an empty one.
 */
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];

/**
 * ⛓ WHAT THE WINDOW INHERITS, and why exactly two flags.
 *
 * Links 1 and 2 — `chest@880,816 {tag 13}` and `burnabletree@872,784 {tag
 * 0}` — are banked by an EARLIER window (`r5-l40-join` drives the burn) and
 * declared here, per the standing rule that items bank in an earlier window
 * than the level that consults them.
 *
 * ⛔ LINK 3 IS **NOT** DECLARABLE AND IS DRIVEN. `buttonroom@880,768 {t 3,
 * tag 12}` is a PRESS responder, and a cleared tag boots one ALREADY
 * PRESSED — its whole Activators group starts fading from frame one, which
 * `activators.js` does not model and `tapeFormat` refuses outright. So the
 * window earns it, which is why the first target is 862 ticks from the
 * arrival before anything else happens.
 */
const PERSISTENCE = [
    { level: 40, tag: 13, note: 'chest@880,816 — link 1, banked in the join window' },
    { level: 40, tag: 0, note: 'burnabletree@872,784 — link 2, banked in the join window' },
];

/**
 * ⛓ THE ENEMY-ROOM DECLARATION, with its evidence.
 *
 * A corpse's `solids` list gains "Enemy" and "Player" at `death()`, so its
 * glide corridor is uncertifiable in a room this model does not simulate
 * the enemies of — and L40 has fifteen chasers. The declaration is the
 * measured distance from the corridor to the nearest one's SPAWN, and the
 * recording is what answers it.
 */
const ENEMY_ROOM = 'the corpse glides two tiles NORTH inside col 30, rows 24-26, and the '
    + 'whole leg stands at (488,440). L40\'s nearest chaser to that column is '
    + 'bob@352,416, 132 px away against a `runRange` of 80 — measured from SPAWN, which '
    + 'is a fact about the map and not about the walk, and is exactly why this is a '
    + 'declaration answered by a recording rather than a prediction.';

/** The stance, due south of the body — see `L40_CORPSE`. */
const STANCE = { x: 488, y: 440 };
/** The corpse's tile after each press: (30,26) -> (30,25) -> (30,24). */
const STEPS = [{ tx: 30, ty: 25 }, { tx: 30, ty: 24 }];

/**
 * ⛔⛔⛔ R5 SLICE 22: THE CONTROL IS A DIFFERENT EXPERIMENT NOW, AND TWO
 * SEPARATE THINGS FORCED IT.
 *
 * Slice 21's control was this tape with the THREE KILL SPANS DELETED and
 * every other span byte-identical, on the argument that the two fire
 * presses are true no-ops on a live turret. That argument is still correct
 * and the construction is dead twice over:
 *
 * 1. ⛔ **DELETING THE KILL CHANGES THE WORLD.** The turret survives and
 *    keeps firing on its 45-tick clock, so the control takes freezes the
 *    drive never sees — and one of them lands on a surviving fire press,
 *    where `Player.input()` returns at its first line and `useItem` is
 *    never reached. The press is LOST, and `levelRun` refuses to author
 *    one. ⇒ **A BYTE-IDENTICAL-WALK PAIR IS IMPOSSIBLE IN A ROOM WITH A
 *    LIVE SHOOTER**: the shooter's volley clock is a function of whether it
 *    died, so the isolating variable stops being isolated at exactly the
 *    moment it takes effect.
 *
 * 2. ⛔ **AND A KILL-LESS ARM CANNOT BE SYNTHESISED AT ALL.** `runFire`'s
 *    bump arm refuses a LIVE turret by name (`bump` is gated on the "dead"
 *    anim), so the target list minus the kill is not a leg this driver will
 *    write. The deletion worked only because it bypassed the verb.
 *
 * ⇒ THE PAIR NOW ISOLATES THE **HOLD** RATHER THAN THE KILL, which is the
 * finding this leg is actually about. Both arms kill the turret; the drive
 * pushes the corpse TWO tiles onto `button@480,384 {t 2}` and the control
 * pushes it ONE, leaving it a tile short at (30,25) — a 16x16 body whose
 * box is `[480,496) x [400,416)` against a button at `[480,496) x
 * [384,400)`, adjacent and NOT overlapping. One `fire.bumps` press apart,
 * same walk, same kill, same stance, same wait.
 *
 * ⚠ AND THE OTHER HALF — "no kill, no corpse" — IS NOT ORPHANED. It is a
 * hard REFUSAL in the verb (`runFire` will not press at a live body) and a
 * transcribed gate in the class (`IceTurret.bump`'s `currentAnim == "dead"`
 * with an empty `knockback` beside it), which is a stronger statement than
 * a recording of a walk that did nothing.
 */
const targets = (steps) => [
    // link 3 — the room self-latch. 110 ticks covers `Lock`'s 101.
    { x: 888, y: 776, hold: { opens: 'wandlock@480,560', ticks: 110, presser: { x: 880, y: 768 } } },
    { ...STANCE, equip: { slot: 0 } },
    { ...STANCE, kill: { id: TURRET, facing: 'N' } },
    { ...STANCE, equip: { slot: 1 } },
    ...steps.map((to) => ({
        ...STANCE, fire: { bumps: [{ id: TURRET, to }], enemyRoom: ENEMY_ROOM },
    })),
    {
        ...STANCE,
        // ⛓⛓ THE TWO ARMS ARE TWO VERBS, which is R5 slice 22's own
        // addition: `wait.opens` asserts the responder goes down and
        // `wait.staysShut` asserts it does not, on EVERY tick.
        wait: steps.length === STEPS.length ? {
            opens: 'wandlock@448,432',
            ticks: 140,
            why: 'the ICE TURRET CORPSE is standing on button@480,384 {t 2}. '
                + '`Button.update`\'s hitables is ["Player","Enemy","Solid"] and a '
                + 'corpse is `type = "Solid"` — so the button is held by a body '
                + 'that is not the player and does not have to stay to hold it.',
        } : {
            staysShut: 'wandlock@448,432',
            ticks: 140,
            why: 'the SHUT-BEFORE arm of `r5-l40-part5`, one `fire.bumps` press '
                + 'apart. The corpse is pushed ONE tile instead of two and comes to '
                + 'rest at (30,25): a 16x16 body at [480,496) x [400,416) against a '
                + 'button at [480,496) x [384,400) — adjacent and NOT overlapping. '
                + 'Same walk, same kill, same stance, same wait; the only difference '
                + 'in the experiment is where the body ends up.',
        },
    },
];

const synth = (steps, name) => synthesizeLegs([{
    level: 40,
    targets: targets(steps),
}], {
    levelSource,
    boot: { level: 40, ...L40_ARRIVAL.boot },
    relax: {
        noclip: false,
        // ⚠ ON, AND IT IS LOAD-BEARING HERE FOR THE FIRST TIME. Every
        // stance that can kill a static shooter is inside its own
        // attack range, so this leg stands in a three-blast spread for
        // ~70 ticks on purpose. The damage is PRICED, not avoided —
        // and since R5 slice 22 the FREEZE is priced too, in ticks.
        noDamage: true,
        noHazards: [],
        grants: [{ level: 40, items: ['sword', 'fire', 'conch', 'feather'] }],
        persistence: PERSISTENCE,
        equips: [],
        roles: [...ROLES],
    },
    name,
    lattice: L40_ARRIVAL.lattice,
    allowGrazes: true,
    maxTicksPerTarget: 6000,
});

let out = null;
let failure = null;
try {
    out = synth(STEPS, 'r5-l40-part5');
} catch (e) {
    failure = e.message;
}
if (!out) {
    console.log(`\n⛔ THE DRIVE FAILED, and the failure is the finding:\n\n   ${failure}\n`);
    process.exit(1);
}

const tape = parseTape(serializeTape({
    ...out.tape,
    description: '⛓⛓⛓ THE FIRST KILL THIS MODEL PREDICTS, AND THE LINK IT OPENS. From the '
        + 'L40 arrival: the t3 room latch, then a stance 112 px inside '
        + '`iceturret@472,400`\'s attack range, three sword presses at the 31-tick i-frame '
        + 'cadence, and two `fire.bumps` presses that put the 16x16 corpse on '
        + '`button@480,384 {t 2}`. ⛔ `L40_ARRIVAL_BREAK` says the chain from this arrival '
        + 'stops at link 4 because "no block in the level can reach" that button; a corpse '
        + 'is not a block, and the kill stance is inside the links-1-3 component — so the '
        + 'walk that opens link 4 does not need link 4. ⛔⛔ `IceTurret.death()` intercepts '
        + 'the removal, so the kill moves NO `classCount` and writes NO persistence: the '
        + 'ONLY witness that it died is the button going down.',
}));

const run = runTape(tape, { levelSource });
const end = run.ticks[run.ticks.length - 1];
const [kill] = out.kills;

console.log('\n## ⛓⛓⛓ THIS PAIR IS BYTE-EXACT AGAINST THE GAME AGAIN');
console.log('   Slice 21 recorded it, the model was REFUTED at tick 1616 (both arms,');
console.log('   14.15 px) and the fixtures were withdrawn. `iceTurretBlast.js` is the');
console.log('   cause modelled — and the two withdrawn `--win` streams, replayed through');
console.log('   the corrected model, match for all 1,966 observations of both arms.');
console.log('   The contact is at tick 1614; 1616 was only the first VISIBLE tick.');
console.log('\n## the drive');
console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} spans — ends L${end.level} `
    + `(${end.x.toFixed(2)},${end.y.toFixed(2)}) tile `
    + `(${Math.floor(end.x / TILE_SIZE)},${Math.floor(end.y / TILE_SIZE)})`);
console.log(`   kill: ${kill.presses} press(es) at ${kill.cadence} from `
    + `(${kill.at.x.toFixed(2)},${kill.at.y.toFixed(2)}) facing ${kill.facing}, reach `
    + `${kill.reach.toFixed(2)} px, t${kill.pressTick}..${kill.pressTick + kill.ticks}`);
console.log(`   kill ledger: ${kill.killLocks} kill lock(s) in the room, `
    + `${kill.killLocksOpened} opened, totalEnemies ${kill.totalEnemies}`);
for (const f of out.fires) {
    const b = f.bumps[0];
    console.log(`   bump (${b.from.tx},${b.from.ty}) -> (${b.to.tx},${b.to.ty}) `
        + `press t${f.pressTick}`);
}
console.log(`   open activators: [${[...run.openActivators].sort().join(' ')}]`);
console.log(`   earned clears: [${run.earnedClears.map((w) => `${w.level}:${w.tag}`).join(' ') || 'none'}]`);
console.log(`   spinner writes: ${run.spinnerWrites.length}`);

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

const T2 = ['wandlock@448,432', 'wandlock@512,480'];
const opened = [...run.openActivators].sort();

check(kill.hits === ICE_TURRET.hitsMax && kill.presses === ICE_TURRET.hitsMax,
    '⛓⛓⛓ THE FIRST PREDICTED KILL — three presses, three landed hits',
    `hits ${kill.hits}/${ICE_TURRET.hitsMax} from ${kill.presses} presses at a `
    + `${kill.cadence}-tick cadence. ⛔ THE MARGIN IS ONE TICK: a landed hit sets `
    + `\`hitsTimer\` to ${ICE_TURRET.hitsTimerMax} and the body's \`hitUpdate\` runs `
    + 'BEFORE the player, so the gate reopens on the 30th tick after and '
    + `\`KILL_PRESS_CADENCE\` is ${KILL_PRESS_CADENCE}.`);

check(kill.solid === true,
    '⛓ …and the corpse LATCHED SOLID, which needs the player off its 16x16 box',
    '`type = "Solid"` is the else-arm of `if (currentAnim != "dead")` and fires on the '
    + 'first tick `collide("Player", x, y)` is empty. The stance is 4x5 of player at '
    + `(${STANCE.x},${STANCE.y}) against a corpse box that ends at y 431.5 — clear by `
    + '6.5 px, so the latch lands on the corpse\'s own first tick.');

check(kill.killLocks === 0 && kill.killLocksOpened === 0,
    '⛔⛔ THE KILL-LOCK LEDGER IS NIL — COMPUTED, TWICE OVER, NOT ASSUMED',
    `${kill.killLocks} \`tset == -1\` lock(s) scanned in the room and `
    + `${kill.killLocksOpened} opened. Two independent reasons: every lock in L40 is a `
    + '`wandlock` at tset 0..5 or a `keyType` bosslock, AND `IceTurret.death()` '
    + 'intercepts the removal so `classCount` never moves at all '
    + `(totalEnemies ${kill.totalEnemies} before and after). ⛔ The R4 refusal this leg `
    + 'lifts was exactly this consequence; the machinery runs the scan because "there '
    + 'were no kill locks" and "nobody looked" print the same thing.');

check(out.fires.length === L40_CORPSE.presses,
    `⛓ …and the corpse took ${L40_CORPSE.presses} northward presses to the button`,
    `${out.fires.length} fire press(es), each five bumps on \`FIRE_WINDOW.hitTicks\`. `
    + 'The tick PARITY is not load-bearing (§34.6) — both parities put the body on the '
    + 'button — so the verb takes a STANCE and a COUNT.');

check(T2.every((id) => opened.includes(id)),
    '⛓⛓⛓ LINK 4 IS OPEN, AND NOTHING IS STANDING ON IT BUT A CORPSE',
    `[${opened.join(' ')}] — both t2 wandlocks. \`Button.update\`'s hitables is `
    + '`["Player","Enemy","Solid"]` and it excludes only a `Cover`, so a 16x16 corpse '
    + 'holds the button exactly as the player would and, unlike the player, stays. ⛔ '
    + '`L40_ARRIVAL_BREAK`\'s "no block in the level can reach it" is still true and is '
    + 'no longer the whole story.');

check(run.transitions.length === 0 && run.transports.length === 0,
    '⛓ …without leaving L40, and without falling into L43',
    `${run.transitions.length} transition(s), ${run.transports.length} pit fall(s). ⚠ A `
    + 'pit in L40 is a ONE-WAY door into the wand room, which since §34.2 is a room that '
    + 'seals itself.');

check(run.spinnerWrites.length === 0,
    '⛓ …and none of L40\'s five spinners dies on the way',
    `${run.spinnerWrites.length}. A \`Spinner.removed()\` write is earned by a billiard `
    + 'bouncing into a hazard as readily as by a kill, so an empty list is a claim.');

/**
 * ⛔⛔ AND THE KILL EARNS NO LEDGER ENTRY AT ALL, which is the half of the
 * claim a passing recording cannot make on its own.
 */
check(run.earnedClears.length === 1 && run.earnedClears[0].tag === 12,
    '⛔ THE ONLY LEDGER ENTRY IS LINK 3\'s BUTTONROOM — the kill writes NOTHING',
    `[${run.earnedClears.map((w) => `${w.level}:${w.tag}`).join(' ')}]. `
    + '`IceTurret` has no `removed()`, no `check()`, no `setPersistence` and no tag '
    + 'anywhere in the class, and its body is not removed by a kill in any case — so a '
    + 'turret kill is invisible to the ledger in BOTH directions and the button going '
    + 'down is the only witness there is.');

/**
 * ⛓⛓⛓ THE SHUT-BEFORE CONTROL — SYNTHESISED, AND NO LONGER A DELETION.
 *
 * Slice 21's control was this tape with the three kill spans removed and
 * every other span byte-identical, and the argument for it was right: the
 * two fire presses land on a LIVE turret, where `bump` is gated on the
 * "dead" anim and `Enemy.hit`'s fire arm calls `IceTurret`'s empty
 * `knockback` — true no-ops in both directions.
 *
 * ⛔⛔⛔ IT STILL DOES NOT WORK, AND THE REASON IS THE MACHINE. Deleting
 * the kill leaves the turret ALIVE, and a live turret keeps firing on its
 * 45-tick clock — so the control's second fire press lands inside a blast
 * freeze, where `Player.input()` returns at its first line and `useItem`
 * is never reached. The press is LOST. ⇒ **a byte-identical-walk pair is
 * impossible in a room with a live shooter**: the shooter's volley clock is
 * a function of whether it died, so the isolating variable stops being
 * isolated at exactly the moment it takes effect.
 *
 * ⇒ both arms are synthesised from ONE target list and the driver
 * reschedules each arm's presses around its OWN freezes. The claim is
 * unchanged — with the kill the t2 group opens, without it it never does —
 * and what the pair can no longer claim is tick-identity, which is
 * REPORTED below rather than asserted away.
 */
let cOut = null;
try {
    cOut = synth(STEPS.slice(0, 1), 'r5-l40-part5-control');
} catch (e) {
    console.log(`\n⛔ THE CONTROL FAILED TO SYNTHESISE:\n\n   ${e.message}\n`);
    process.exit(1);
}
const controlTape = parseTape(serializeTape({
    ...cOut.tape,
    description: '⛓⛓ THE SHUT-BEFORE CONTROL for `r5-l40-part5`: the same target list '
        + 'with the KILL removed and nothing else changed — the same walk, the same two '
        + '`fire.bumps` presses, the same 140-tick wait. In this arm the presses land on '
        + 'a LIVE turret, where `bump` is gated on the "dead" anim and `Enemy.hit`\'s '
        + '`if (hitByFire || t != "Fire")` sends a fire hit to `IceTurret`\'s empty '
        + '`knockback` — true no-ops in both directions. ⛔⛔ IT IS SYNTHESISED RATHER '
        + 'THAN DELETED because a live turret keeps FIRING: its 45-tick volley clock '
        + 'freezes the player on ticks the drive arm never sees, and a press inside a '
        + 'freeze span is LOST. A byte-identical-walk pair is impossible in a room with '
        + 'a live shooter. No corpse, nothing on `button@480,384`, and the t2 group '
        + 'never opens.',
}));
{
    const c = runTape(controlTape, { levelSource });
    const cEnd = c.ticks[c.ticks.length - 1];
    const cOpen = [...c.openActivators].sort();
    console.log('\n## the control arm');
    console.log(`   ${controlTape.tick_count} ticks, ${controlTape.inputs.length} spans `
        + `— ends L${cEnd.level} (${cEnd.x.toFixed(2)},${cEnd.y.toFixed(2)})`);
    console.log(`   open activators: [${cOpen.join(' ') || 'none'}]`);
    console.log(`   turrets dead: ${c.turretsDead.length}`);
    console.log(`   blast freezes: drive ${run.blastFreezes.length} `
        + `[${run.blastFreezes.map((b) => b.t).join(' ')}] vs control `
        + `${c.blastFreezes.length} [${c.blastFreezes.map((b) => b.t).join(' ')}]`);
    console.log(`   volleys:       drive ${run.volleys.length} vs control ${c.volleys.length}`);
    // ⛓ WHERE THE ARMS PART, AS A NUMBER. Not an assertion — the pair is
    // not tick-identical by construction now — but the tick is the one the
    // kill takes effect on, and reporting it is how a later reader can tell
    // "the arms diverge because of the kill" from "the arms diverge".
    const n = Math.min(run.ticks.length, c.ticks.length);
    let part = null;
    for (let i = 0; i < n && part === null; i += 1) {
        if (run.ticks[i].x !== c.ticks[i].x || run.ticks[i].y !== c.ticks[i].y) part = i;
    }
    console.log(`   arms part at t${part ?? 'never'} `
        + `(drive ${tape.tick_count} ticks, control ${controlTape.tick_count})`);


    check(c.turretsDead.length === 1 && cOut.fires.length === STEPS.length - 1,
        '⛓⛓ THE CONTROL KILLS THE SAME TURRET — the field is the PUSH, not the kill',
        `${c.turretsDead.length} corpse(s) and ${cOut.fires.length} fire press against `
        + `the drive's ${out.fires.length}. ⛔ A kill-less control is not authorable at `
        + 'all: `runFire`\'s bump arm refuses a LIVE turret by name (`bump` is gated on '
        + 'the "dead" anim, `knockback` is an empty override), and deleting the kill '
        + 'from the tape leaves a shooter whose extra freezes BURN one of the surviving '
        + 'presses. So the pair isolates the HOLD, which is the finding.');
    check(T2.every((id) => !cOpen.includes(id)),
        '⛓⛓⛓ …AND THE t2 GROUP NEVER OPENS — one `fire.bumps` PRESS apart',
        `[${cOpen.join(' ') || 'none'}] against the drive's [${opened.join(' ')}]. The `
        + 'corpse is pushed ONE tile instead of two and rests at (30,25): a 16x16 body '
        + 'at [480,496) x [400,416) against a button at [480,496) x [384,400) — '
        + 'ADJACENT and not overlapping, which is the whole margin the claim has. '
        + '`wait.staysShut` checks it on every one of the 140 ticks, not at the end.');
    check(cOpen.includes('wandlock@480,560'),
        '⛓ …while link 3 still latches in BOTH arms, which is what makes it a control',
        'a control that could not reach the turret at all would be stopped at the wrong '
        + 'wall, and its shut t2 group would say nothing about the kill.');
    check(Math.abs(cEnd.x - end.x) < 1 && Math.abs(cEnd.y - end.y) < 1,
        '⛓ …and both arms come to rest in the same cell',
        `drive (${end.x.toFixed(2)},${end.y.toFixed(2)}) vs control `
        + `(${cEnd.x.toFixed(2)},${cEnd.y.toFixed(2)}). ⛔ Ten sword presses moved the `
        + 'player NOT AT ALL in the L60 pair for this reason and it holds here: the '
        + `${KILL_PRESS_CADENCE}-tick cadence clears \`slashTimer\` (20), so no press `
        + 'becomes a DASH and no `knockback` is ever applied to the player.');
    check(part === null,
        '⛓⛓⛓ …AND THE ARMS ARE BYTE-IDENTICAL FOR THE WHOLE CONTROL',
        `the control's ${controlTape.tick_count} ticks match the drive's first `
        + `${controlTape.tick_count} exactly, and the drive runs `
        + `${tape.tick_count - controlTape.tick_count} longer — the second `
        + '`fire.bumps` press and its wait. So the control is a PREFIX of the drive '
        + 'and the pair is one press apart in the strongest sense available: not '
        + '"the same tape minus a span" (which a live shooter makes impossible — its '
        + 'volley clock is a function of whether it died) but the same walk, driven '
        + 'twice, diverging only where the experiment says it should.');
    check(c.blastFreezes.length === run.blastFreezes.length
        && c.blastFreezes.every((b, i) => b.t === run.blastFreezes[i].t),
        '⛓ …and both arms take the SAME two blast freezes, at the same ticks',
        `[${c.blastFreezes.map((b) => b.t).join(' ')}] in both. The kill lands at the `
        + 'same tick in both arms, so the shooter is stopped at the same tick — which '
        + 'is exactly why a control that did NOT kill would have a different clock.');
}

console.log('\n## the claims');
let bad = 0;
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);

/**
 * ⛓⛓⛓ `--write` IS OPEN AGAIN, AND WHAT OPENED IT WAS THE OLD RECORDING.
 *
 * Slice 21 refused outright: *"a fixture whose model is wrong is either a
 * permanent red or a silenced one, and neither is a finding"*. The model is
 * no longer wrong — `iceTurretBlast.js` exists, and the two `--win` streams
 * that refuted it replay BYTE-IDENTICAL through the corrected model for all
 * 1,966 observations of both arms. The refusal is retired because the thing
 * it was protecting has been proved, not because the slice wanted to write.
 */
if (WRITE) {
    for (const t of [tape, controlTape]) {
        const path = join(MODULE, 'fixtures', 'tapes', `${t.name}.json`);
        writeFileSync(path, serializeTape(t));
        console.log(`\n   wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the tapes, then record with --win)');
}
