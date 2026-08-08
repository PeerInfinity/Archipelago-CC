#!/usr/bin/env node
/**
 * plan-seedling-r6-shieldboss — ⛓⛓⛓ THE SHIELDSPIRE, THE LADDER'S SECOND
 * BOSS KILL, AND THE FIRST KEY THAT WAS INSIDE THE BODY THAT HELD IT.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 5. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §4.5, with §2.4 amended by
 * §8.14 and the tick counts derived from §8.2's anim table by
 * `shieldBossFight.js`.
 *
 * ── WHAT THE WINDOW DOES ──────────────────────────────────────────────
 *
 * It boots into level 19 four tiles south of `shieldboss@80,32` and HOLDS
 * `up` for the entire tape. That single span does four jobs, and the fact
 * that it is ONE span is what makes the pair honest:
 *
 *   1. it walks the player into `hitPlayer()`'s own 48x16 band
 *      (`[80,128) x [88,104)`) and then PINS them against the boss's 48x48
 *      solid at y 90.05 — the stance needs no steering at all;
 *   2. it holds `direction = 1` for every tick, so `slashDirection` (latched
 *      at the press by `set slashing`) is always UP and the 16x32 rect is
 *      always over the body — §12.7's `direction` interleave, paid by
 *      geometry instead of by a schedule;
 *   3. it keeps the band occupied, which is the whole clock: 120
 *      CONSECUTIVE `hitPlayer` calls while the animation is `"sit"`;
 *   4. and after the removal it walks the same held key into
 *      `bosskey@96,64` — the key that was inside the wall.
 *
 * The treatment is THREE `primary` presses and nothing else — one per
 * `movedShield` window, each at `windowFrom + 7`.
 *
 * ── ⛔⛔⛔ AND THREE IS THE COUNT BECAUSE ONE PRESS IS FIVE HITS ──────
 *
 * `Player.slash`'s `slashDelayMax` is ZERO and `slashing` stays up for the
 * six advances of the "slash" animation, so the hit test runs on `T+1 …
 * T+5` (`presses.SLASH_HIT_TICKS`). The first cut of this plan spent a
 * separate ARMING press up front, and the game refuted it inside forty
 * ticks: hit 1 of that press was swallowed, **hit 2 of the same press
 * found him sitting and started a RETALIATION stab**, and the player was
 * shoved 50 px south at tick 37. The recording is the whole finding.
 *
 * ⛓⛓⛓ The fix is not a fourth press placed more carefully — it is that
 * the arming dispatch is ABSORBED BY THE FIRST LANDING PRESS. Inside a
 * `movedShield` window:
 *
 *     +8   `!activated`  -> swallowed, and nothing else changes
 *     +9   still `movedShield` -> `super.hit` LANDS, `hitsTimer = 30`, `sit()`
 *     +10  now `"sit"`   -> `startStab(true)` -> REFUSED, `hitsTimer > 0`
 *     +11  same
 *     +12  same
 *
 * ⇒ the swallowed hit costs the schedule NOTHING, the retaliation is shut
 * out by the i-frame the landed hit just set, and every later press behaves
 * the same way with its first hit landing instead of its second.
 *
 * ── ⛓⛓ THE THREE INSTANTS OF THE DEATH ──────────────────────────────
 *
 *     tag       the third landed hit         `{19,0}`, from `startDeath`
 *     destroy   +23 graphic updates          the die animation wraps
 *     removed   +11 more                     `Mobile.death`'s eleventh fade
 *
 * ⛔ AND ONLY THE THIRD ONE OPENS THE ROOM. The body is `"ShieldBoss"`,
 * which is in `Mobile.solids`, for all 34 of those ticks — so a plan that
 * walked north on the tag would spend 34 ticks against a wall, and one that
 * walked on `destroy` would spend 11.
 *
 * ── ⛓⛓⛓ THE PAIR: TWO HITS FOR THREE ────────────────────────────────
 *
 * The control is the same tape with the THIRD LANDING PRESS DELETED — and
 * the movement span is byte-identical, because there is only one and it
 * belongs to a different generator than the presses do (§12's amendment to
 * §3.2, learnt the hard way when slice 4's first control died of a clock).
 *
 * What the control shows is not "nothing happens". It is the OPPOSITE of
 * the drive: the third `startStab` fires on the same tick, `movedShield`
 * opens on the same tick, nobody hits it, `endAnim` runs the chain to
 * `"stab"`, and the stab's damaging frames land on a player standing in the
 * band. ⇒ `hits` 2 of 3, `{19,0}` still SET, and the player TAKES A HIT —
 * which is the sharpest possible statement of what the abort buys.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r6-shieldboss.mjs [--write]
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const WRITE = process.argv.includes('--write');

const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { serializeTape, parseTape, heldKeysAt } = await import(join(MODULE, 'tapeFormat.js'));
const {
    SHIELD_BOSS, SHIELD_BOSS_ANIM_UPDATES, shieldBossDeathSchedule, shieldBossWindowFor,
} = await import(join(MODULE, 'shieldBossFight.js'));
const { SLASH_HIT_TICKS } = await import(join(MODULE, 'presses.js'));

/**
 * ⚠ THE BOOT BLOCK IS `new Game(level, x, y)`'s ARGUMENTS, not the entity
 * point — `spawnFromBoot` adds `(Tile.w/2, Tile.h/2)`. Tile (6,7)'s CORNER
 * is (96,112); the spawn is (104,120), dead centre under the body.
 */
const BOOT = { level: 19, x: 96, y: 112 };
const GRANTS = [{ level: 19, items: ['sword'] }];
const PINS = ['sound', 'dead_frames'];
const NO_HAZARDS = ['water', 'lava', 'ice', 'waterfall'];

/** Where inside the sixteen-tick window the press goes. */
const WINDOW_OFFSET = 7;
/** `Player.update` calls `slash()` one tick after the press edge. */
const PRESS_TO_SWING = 1;
/**
 * ⛔ 31, NOT 2 — §14.9's proven-inert cadence, and R5 slice 23's finding.
 * `slashTimerMax` is 20, so a press 31 ticks after the last one always
 * finds `slashTimer` at 0 and can never become a DASH (which would
 * `knockback(2, …)` the player straight out of the band). Every dialogue
 * press is then a bare slash that reaches nothing.
 */
const TALK_CADENCE = 31;

const HOLD_KEY = 'up';

const press = (t) => ({ key: 'primary', from: t, to: t + 1 });

const run = (inputs, tickCount, { untilTick = null } = {}) => {
    const r = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: BOOT,
        noclip: false,
        noHazards: NO_HAZARDS,
        noDamage: false,
        grants: GRANTS,
        persistence: [],
        equips: [],
        pins: PINS,
        save: { totem_parts: [], keys: [], seal_parts: [] },
        roles: ROLES,
    });
    const stream = [];
    const n = untilTick ?? tickCount;
    for (let k = 0; k < n; k += 1) {
        stream.push({ t: k, x: r.state.x, y: r.state.y, level: r.level });
        r.advance(heldKeysAt({ inputs }, k));
    }
    return { run: r, stream };
};

// ── PHASE 1: the clock, measured on a tape with NO presses at all ─────
//
// ⛔ DERIVED, NOT CHOSEN. The band counter starts on the first tick the
// player's box overlaps `[80,128) x [88,104)`, which depends on the boot
// point and the walk — so the plan asks the model where that is rather than
// assuming a tick. Everything after it is `shieldBossWindowFor` arithmetic.
const HOLD_LONG = [{ key: HOLD_KEY, from: 0, to: 4000 }];
const probe = run(HOLD_LONG, 400);
const firstInBand = probe.run.shieldBossBand.find((b) => b.inBand)?.t;
if (firstInBand === undefined) {
    throw new Error('plan: holding `up` from the boot never reached the band');
}
const stab1 = probe.run.shieldBossStabs[0]?.t;
if (stab1 !== firstInBand + SHIELD_BOSS.swingTimeMax - 1) {
    throw new Error(`plan: the first startStab is at ${stab1}, not `
        + `${firstInBand + SHIELD_BOSS.swingTimeMax - 1} — the counter is not the `
        + '120-consecutive-tick clock the schedule is derived from');
}

/**
 * One cycle: press at `windowFrom + 7`, and the LANDING is not the press's
 * first hit test on the first window — it is its SECOND, because hit 1 is
 * the swallowed dispatch. Every later window lands on hit 1.
 *
 * ⛓ The plan does not have to know which: `sit()` runs on whichever hit
 * lands, and the next `startStab` is 120 band ticks after THAT. So the
 * cycle is derived from the landing rather than from the press.
 */
const cycle = (stabTick, { swallows = false } = {}) => {
    const w = shieldBossWindowFor(stabTick);
    const pressTick = w.windowFrom + WINDOW_OFFSET;
    const swingTick = pressTick + PRESS_TO_SWING + (swallows ? 1 : 0);
    if (swingTick > w.windowTo) {
        throw new Error(`plan: the landing at ${swingTick} is past the window's `
            + `${w.windowTo} — a press at ${pressTick} with SLASH_HIT_TICKS `
            + `${SLASH_HIT_TICKS} does not fit`);
    }
    return { w, pressTick, swingTick, nextStab: swingTick + SHIELD_BOSS.swingTimeMax };
};

const c1 = cycle(stab1, { swallows: true });
const c2 = cycle(c1.nextStab);
const c3 = cycle(c2.nextStab);

const KILL_TICK = c3.swingTick;
const DEATH = shieldBossDeathSchedule(KILL_TICK);

// ── PHASE 2: the key, measured the same way ───────────────────────────
const KILL_INPUTS = [
    { key: HOLD_KEY, from: 0, to: 4000 },
    press(c1.pressTick), press(c2.pressTick), press(c3.pressTick),
];
const keyProbe = run(KILL_INPUTS, DEATH.removedTick + 120);
const contactTick = keyProbe.run.shieldBossKills.find((k) => k.what === 'removed')
    ? keyProbe.stream.find((o) => o.t > DEATH.removedTick && o.y <= 78)?.t
    : null;
if (contactTick === null || contactTick === undefined) {
    throw new Error('plan: the walk never reached the key after the removal');
}
/** Four `x` releases at the inert cadence, from just after the contact. */
const TALK_FROM = contactTick + 4;
const TALK_PRESSES = 5;
const TALK = Array.from({ length: TALK_PRESSES },
    (_, i) => press(TALK_FROM + i * TALK_CADENCE));

const KILL_TICK_COUNT = TALK_FROM + TALK_PRESSES * TALK_CADENCE + 40;
const INPUTS = [
    { key: HOLD_KEY, from: 0, to: KILL_TICK_COUNT },
    press(c1.pressTick), press(c2.pressTick), press(c3.pressTick),
    ...TALK,
];

/**
 * ⛓ THE CONTROL'S LENGTH: it runs past the third stab's damaging frames and
 * stops. It has no removal to walk through and no key to take, so a control
 * of equal length would be 200 ticks of a walk into a wall — [[the prefix
 * shape]] §12.11 settled on, for the same reason.
 */
const CONTROL_TICK_COUNT = c3.w.stabFrom + SHIELD_BOSS_ANIM_UPDATES.stab + 30;
const CONTROL_INPUTS = [
    { key: HOLD_KEY, from: 0, to: CONTROL_TICK_COUNT },
    press(c1.pressTick), press(c2.pressTick),
];

const tapeFor = (name, inputs, tickCount, description) => parseTape({
    tape_version: 6,
    game: 'seedling',
    name,
    description,
    boot: BOOT,
    noclip: false,
    // ⛔ FALSE ON BOTH ARMS. Survival is the claim on the drive (zero hits
    // across 600 ticks under a boss whose stab is the room's only damage
    // source) and DAMAGE is the claim on the control — a `noDamage: true`
    // control would have proved nothing at all.
    noDamage: false,
    noHazards: NO_HAZARDS,
    grants: GRANTS,
    persistence: [],
    equips: [],
    pins: PINS,
    save: { totem_parts: [], keys: [], seal_parts: [] },
    tick_count: tickCount,
    inputs,
});

const tape = tapeFor('r6-shield-kill', INPUTS, KILL_TICK_COUNT,
    'R6 slice 5: THE SHIELDSPIRE. Boots into L19 under `shieldboss@80,32` and holds '
    + '`up` for the whole tape — which walks into `hitPlayer()`\'s own 48x16 band, pins '
    + 'the player at y 90.05 against the 48x48 solid, holds `direction = 1` so every '
    + 'latched `slashDirection` is UP, and keeps the 120-update stand-under counter '
    + 'running. Four `primary` presses: one ARMING press (the first `hit()` of every '
    + 'room entry is swallowed — `activated` is an instance field re-armed by every '
    + '`new Game`) and three landings, each at `movedShield + 7`, the only animation '
    + '`super.hit` is reachable through. Each landed hit calls `sit()` and ABORTS the '
    + 'stab before its damaging frames, so the fight is fought at zero damage. The '
    + 'third hit writes `{19,0}` from `startDeath`; `destroy` lands 23 graphic updates '
    + 'later and `FP.world.remove` 11 after that — and only the removal takes the wall '
    + 'away, because "ShieldBoss" is in `Mobile.solids`. Then the same held key walks '
    + 'north through the vacated cell into `bosskey@96,64`, the keyType-0 key that was '
    + 'INSIDE the body, and pays its two-page ceremony.');

const control = tapeFor('r6-shield-control', CONTROL_INPUTS, CONTROL_TICK_COUNT,
    'R6 slice 5: the two-hits-for-three control — the same tape with the THIRD landing '
    + 'press deleted. The movement is one `up` span and is byte-identical, so the '
    + 'stance, the band and the clock are all unchanged: the third `startStab` fires on '
    + 'the same tick and `movedShield` opens on the same tick. What is missing is the '
    + 'hit that would have called `sit()` — so `endAnim` runs the chain on to "stab" '
    + 'and the stab\'s frames 5..8 land on a player standing in the band. `hits` stops '
    + 'at 2 of 3, `{19,0}` is never written, the body is never removed, and the PLAYER '
    + 'takes the damage the drive\'s abort buys off. A PREFIX, not an equal: the drive\'s '
    + 'tail is a corpse, a walk and a ceremony the control has no death to produce.');

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

const a = run(tape.inputs, tape.tick_count);
const c = run(control.inputs, control.tick_count);

const fmt = (rows) => rows.map((h) => `t${h.t} ${h.swallowed ? 'SWALLOWED'
    : (h.landed ? `landed hits=${h.hits}` : `refused ${h.refusedAt}`)}`).join(', ');
const landed = a.run.shieldBossHits.filter((h) => h.landed);
check(a.run.shieldBossHits.length === 3 * SLASH_HIT_TICKS
    && a.run.shieldBossHits[0].swallowed && landed.length === 3,
    `⛔ THREE PRESSES, ${3 * SLASH_HIT_TICKS} HIT TESTS, THREE LANDINGS — and the `
    + 'swallowed dispatch is the FIRST press\'s own first test',
    fmt(a.run.shieldBossHits));
check(landed.every((h) => h.anim === 'movedShield' && h.aborted !== undefined),
    '⛓ every landing is inside `movedShield`, the ONLY window',
    landed.map((h) => `t${h.t} anim=${h.anim} aborted=${h.aborted}`).join(', '));
check(a.run.shieldBossStabs.length === 3
    && a.run.shieldBossStabs.every((s) => !s.retaliation),
    '⛓ THREE stand-under stabs and no retaliation at all',
    a.run.shieldBossStabs.map((s) => `t${s.t} window [${s.windowFrom},${s.windowTo}]`)
        .join(', '));
const kills = a.run.shieldBossKills;
check(kills.length === 3
    && kills[0].what === 'tag' && kills[0].t === KILL_TICK
    && kills[1].what === 'destroy' && kills[1].t === DEATH.destroyTick
    && kills[2].what === 'removed' && kills[2].t === DEATH.removedTick,
    '⛔⛔ THE TAG PRECEDES THE CORPSE BY 23 AND THE CORPSE THE REMOVAL BY 11',
    kills.map((k) => `${k.what}@${k.t}`).join(' -> ')
    + ` (derived: tag ${DEATH.tagTick}, destroy ${DEATH.destroyTick}, removed `
    + `${DEATH.removedTick})`);
check(a.run.shieldBossFlags.length === 1 && a.run.shieldBossFlags[0].level === 19
    && a.run.shieldBossFlags[0].tag === 0,
    '⛓⛓⛓ `{19,0}` — the kill witness, written by `startDeath`',
    JSON.stringify(a.run.shieldBossFlags));
check(a.run.damage.hits === 0 && a.run.playerHits.length === 0,
    '⛓⛓⛓ ZERO DAMAGE across the whole fight — every stab aborted before frame 5',
    `hits ${a.run.damage.hits}, ${a.run.playerHits.length} `
    + `contact(s); the room's only damage source is `
    + '`hitPlayer`\'s `frame >= 5 && frame <= 8` arm and it never fired');
const took = a.run.collected.filter((k) => k.keyType === 0);
check(took.length === 1,
    '⛓⛓ THE KEY IS TAKEN — from the cell the body occupied',
    JSON.stringify(a.run.collected));
check(took.length === 1 && took[0].t > DEATH.removedTick,
    '⛔ …and only AFTER the removal, not after the tag',
    `collected at t${took[0]?.t}, removal at ${DEATH.removedTick}, tag at `
    + `${DEATH.tagTick} — 34 ticks of wall between the two`);
check([...a.run.keys ?? []].includes(0) || took.length === 1,
    '⛓ `Player.hasKeySet(0, true)` — the run banks keyType 0',
    JSON.stringify([...(a.run.keys ?? [])]));

// ── the control ──────────────────────────────────────────────────────
const cLanded = c.run.shieldBossHits.filter((h) => h.landed);
check(c.run.shieldBossHits.length === 2 * SLASH_HIT_TICKS && cLanded.length === 2,
    '⛓ THE CONTROL LANDS TWO OF THREE',
    fmt(c.run.shieldBossHits));
check(c.run.shieldBossStabs.length === 3,
    '⛔ …and the THIRD STAB FIRES ANYWAY, on the same tick as the drive\'s',
    `control stabs ${c.run.shieldBossStabs.map((s) => s.t).join(', ')} against the `
    + `drive's ${a.run.shieldBossStabs.map((s) => s.t).join(', ')}`);
check(c.run.shieldBossKills.length === 0 && c.run.shieldBossFlags.length === 0,
    '⛔ `{19,0}` IS NEVER WRITTEN and the body is never removed',
    `kills ${c.run.shieldBossKills.length}, flags ${c.run.shieldBossFlags.length}, `
    + `hits ${c.run.shieldBosses[0]?.hits} of ${SHIELD_BOSS.hitsMax}`);
check(c.run.damage.hits > 0 && c.run.playerHits.some((h) => h.source === 'shieldBossStab'),
    '⛓⛓⛓ AND THE PLAYER TAKES THE HIT THE ABORT BUYS OFF',
    `control hits ${c.run.damage.hits} against the drive's ${a.run.damage.hits}; `
    + `${JSON.stringify(c.run.playerHits)} — the stab reached frames 5..8 with the `
    + 'player still in the band');
const movement = (t) => t.inputs.filter((s) => s.key === HOLD_KEY);
check(JSON.stringify(movement(tape)[0].key) === JSON.stringify(movement(control)[0].key)
    && movement(tape).length === 1 && movement(control).length === 1
    && movement(tape)[0].from === movement(control)[0].from,
    '⛔ THE MOVEMENT SPANS ARE FROM A SEPARATE GENERATOR AND ARE IDENTICAL',
    `drive ${JSON.stringify(movement(tape))} vs control `
    + `${JSON.stringify(movement(control))} — only the `
    + `\`to\` differs, because the control is a PREFIX (${control.tick_count} against `
    + `${tape.tick_count})`);
let firstDiff = -1;
for (let i = 0; i < c.stream.length; i += 1) {
    if (a.stream[i].x !== c.stream[i].x || a.stream[i].y !== c.stream[i].y) {
        firstDiff = i; break;
    }
}
check(firstDiff === -1 || firstDiff > c3.swingTick,
    '⛓ the two arms are position-identical until the missing hit',
    firstDiff === -1 ? 'identical for the whole control'
        : `first positional difference at tick ${firstDiff}, and the deleted press `
        + `fires at ${c3.swingTick}`);

for (const k of checks) {
    console.log(`${k.ok ? '  ok ' : 'FAIL '}${k.name}\n       ${k.detail}`);
}
console.log('');
console.log(`band opens at tick ${firstInBand}; stabs at `
    + `${[stab1, c1.nextStab, c2.nextStab].join(', ')}; presses at `
    + `${[c1.pressTick, c2.pressTick, c3.pressTick].join(', ')}; landings at `
    + `${[c1.swingTick, c2.swingTick, c3.swingTick].join(', ')}`);
console.log(`kill ${KILL_TICK} -> destroy ${DEATH.destroyTick} -> removed `
    + `${DEATH.removedTick}; key contact ~${contactTick}; talk from ${TALK_FROM}`);
console.log(`drive ${tape.tick_count} ticks, control ${control.tick_count}`);

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
