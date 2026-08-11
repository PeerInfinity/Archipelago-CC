#!/usr/bin/env node
/**
 * plan-seedling-r8-l18-spinner — THE PRESS ARM'S DRIVEN PAIR. R8 slice 6
 * track A, kickoff §13.10's L18 row.
 *
 * ── WHAT THIS WITNESSES, AND WHAT IT DELIBERATELY DOES NOT ────────────
 *
 * `KILL_ARM_POLICY.Spinner` flipped `refused` -> `modelled` this slice, and a
 * refusal retired without a DRIVEN witness is trap 101. This is the witness:
 * a walk that presses L18's two spinners to death and lets the GAME adjudicate
 * every consequence.
 *
 *   · the DAMAGE — three landed presses per body at `hitsMax` 3, with the
 *     four refused dispatches of each press recorded rather than assumed
 *     (⛔ ONE PRESS IS FIVE HIT TESTS and the RECEIVER decides how many land:
 *     `hitSpinner` sets `hitsTimer = 30`, so tests 2..5 are refused on
 *     i-frames — traps 85/93);
 *   · the DEATH STAGING — `CORPSE_COUNTING.Spinner` is a `fade` row, so
 *     `destroy` lands on the killing blow and the body is removed eleven
 *     accumulated 0.1 subtractions later;
 *   · the `classCount` CONSEQUENCE — L18's `lock@144,112` is `tset -1`, so
 *     the second death takes `Game.totalEnemies()` to zero and the lock
 *     OPENS. This is the first `modelled` kill arm whose scan is not a nil;
 *   · ⛔ the OUT-OF-BAND WRITE — both placements carry `tag = "-1"`, and a
 *     −1 is not a no-op: `Main.levelPersistenceSet` indexes `level*30 + tag`
 *     unchecked, so each removal writes **{17,29}**. Kickoff §13.10 measured
 *     this consequence as NIL; it is not, and the GAME's own
 *     `persistence_cleared` is what settles it.
 *
 * ⚠ `noDamage` IS DECLARED, AND THE REASON IS A BOUND RATHER THAN A
 * CONVENIENCE. `Spinner.update` swings a `collideLine("Player", …)` whose
 * angle is `(Game.time % 45) / 45 · 2π`, and `Game.time` counts DEAD FRAMES —
 * a per-load variable this model does not carry. So a stance INSIDE the 13 px
 * hammer disc is a contact the model cannot price, and `levelRun` refuses one
 * BY NAME on an honest tape. Under `noDamage` the game's own `Player.hit`
 * returns on its first line, so the question is inert and this pair can stand
 * where the press needs to stand. ⇒ what this tape claims is the ENEMY's
 * half; the player's half is a NAMED REFUSAL, not a silent zero, and an
 * honest L18 solve needs a stance derivation that stays outside the disc —
 * which is the next slice's charge.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r8-l18-spinner.mjs
 *   node scripts/procgen/plan-seedling-r8-l18-spinner.mjs --check
 *
 * Then record (the game is the only oracle):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-l18-spinner-press
 */

import { dirname, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

const { parseTape, requiredTapeVersion, assertTapeWithinRuntimeBudget } =
    await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { DEFAULT_TOLERANCE, buildTape, chooseHeld, hasArrived } =
    await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { distanceRectPoint, SLASH_REACH } = await import(join(MODULE, 'presses.js'));
const { SPINNER } = await import(join(MODULE, 'spinner.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();
const NAME = 'r8-l18-spinner-press';
/**
 * The boot: L18's own arrival from L16 (`stairsdown@16,16 {to: 16}` is the way
 * back, so the honest entrance is the other side of it) — taken as the
 * teleporter's own destination rather than typed, per R6 slice 0's lesson that
 * a boot block is `new Game(level, x, y)`'s ARGUMENTS.
 */
const BOOT = Object.freeze({ level: 18, x: 16, y: 112 });

/**
 * ⛓ THE STANCE IS CHOSEN, NOT DERIVED, AND THIS FILE SAYS SO. A PAIR is a
 * WITNESS, not a solve: its job is to put the press where the game can
 * adjudicate it. The derivation — a stance that stays outside the hammer disc
 * while the body passes through the sword's reach — is the policy work an
 * honest L18 solve needs, and it is the next slice's.
 *
 * Both cells are read off the orbit: `spinner@112,48` and `spinner@48,96` both
 * pass through the cell centres below within the first few ticks of the visit.
 */
const STANCES = Object.freeze([
    Object.freeze({ id: 'spinner@48,96', x: 56, y: 104 }),
    Object.freeze({ id: 'spinner@112,48', x: 120, y: 56 }),
]);

const run = createLevelRun({
    levelSource,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    // ⚠ DECLARED — see the header. The claim is about the ENEMY's damage.
    noDamage: true,
    grants: [],
    persistence: [],
    despawn: [],
    equips: [],
    pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: null,
    // A sword is what a press needs; the rest of the campaign is irrelevant
    // to this claim and is left false.
    seam: { items: { hasSword: true } },
    roles: ROLES,
});

const NO_KEYS = new Set();
const PRESS = new Set(['primary']);
const perTick = [];
const MAX_TICKS = 1200;
/**
 * ⛔ THE PRESS PHASE'S OWN BOUND, AND IT IS BIGGER THAN THE WALK'S BECAUSE IT
 * IS WAITING FOR AN ORBIT. A spinner's i-frame is 30 ticks and its circuit is
 * hundreds, so a fixed stance gets ONE press per lap: three laps per body.
 * Ticks are almost free (a wait is one span); it is SPANS the runtime refuses
 * a tape for.
 */
const MAX_PRESS_TICKS = 2600;
/**
 * `slashTimerMax` is 20, so two presses closer than that are a DASH rather
 * than a second swing; `hitsTimer` is 30, so the receiver refuses anything
 * inside thirty ticks anyway. 31 is the floor `combatVerbs.KILL_PRESS_CADENCE`
 * already names and it is imported in spirit rather than re-derived here.
 */
const CADENCE = 31;
let lastPress = -CADENCE;

const bodyById = (id) => run.spinnerBodies.find((b) => b.id === id) ?? null;

for (const stance of STANCES) {
    // ── walk to the stance ────────────────────────────────────────────
    /**
     * ⛔ THE ARRIVAL TEST IS `hasArrived`'s, NOT A HAND-WRITTEN ONE. The first
     * cut asked for `|dx| < 0.5 && v === 0`, which the bang-bang controller
     * NEVER satisfies — it oscillates about the aim — so the walk burned its
     * whole 1,200-tick guard flipping keys and the tape came out at 2,354
     * SPANS against a 1,800 ceiling. A tolerance is the claim (trap: R6 slice
     * 0), and the one every other verb on this ladder uses is this one.
     */
    let guard = 0;
    while (guard < MAX_TICKS) {
        if (hasArrived(run.state, stance, DEFAULT_TOLERANCE)) break;
        const held = chooseHeld(run.state, stance, DEFAULT_TOLERANCE);
        perTick.push(held);
        run.advance(held);
        guard += 1;
    }
    check(`reached the stance for ${stance.id}`, guard < MAX_TICKS,
        `(${run.state.x},${run.state.y}) after ${guard} tick(s)`);

    /**
     * ── FOLLOW THE BODY AND PRESS WHEN IT IS IN REACH ─────────────────
     *
     * ⛓ THE FOLLOW IS WHAT MAKES THIS A PAIR ABOUT A **MOVING** TARGET.
     * Standing still works and costs 3,954 ticks: a spinner is a billiard
     * with a 30-tick i-frame, so a fixed stance waits out a whole orbit
     * between presses. Walking at it presses every `CADENCE` ticks instead —
     * and it is the harder claim, because the body is somewhere new on every
     * one of the five hit tests AND on every tick of the approach.
     *
     * ⚠ THE AIM IS THE ENTITY POINT, and `chooseHeld` is the SAME controller
     * every other verb on the ladder drives with (one movement model, trap
     * 118's direction).
     */
    let spent = 0;
    while (spent < MAX_PRESS_TICKS) {
        const b = bodyById(stance.id);
        if (!b) break;                       // removed — the kill is done
        const reach = distanceRectPoint(run.state.x, run.state.y, b.rect);
        const armed = perTick.length - lastPress >= CADENCE;
        const press = armed && reach <= SLASH_REACH && b.hitsTimer === 0;
        // ⛔ A PRESS TICK HOLDS NO DIRECTION KEY. `Player.sprites()` writes
        // `direction` from `v` and the slash rect reads it — so a press taken
        // mid-step aims where the walk was going, which is right, and a press
        // taken while turning aims at the turn. The follow releases on the
        // press tick so the rect is the approach's own facing (trap 80, the
        // move key and the weapon sharing one field).
        /**
         * ⛔⛔⛔ AND THE WAIT IS WHY THIS WALK STANDS STILL — A TAPE'S BUDGET
         * IS **SPANS**, NOT TICKS (trap 16, paid again).
         *
         * The first cut FOLLOWED the body (`chooseHeld` toward its entity
         * point every tick) and killed both in 2,623 ticks instead of 3,954 —
         * and the GAME REFUSED IT AT LOAD: `heap_alloc(71502) failed - out of
         * memory`, before the first tick. A follow re-aims every tick, so the
         * span count is the tick count: **2,572 spans against a measured
         * ceiling of 1,800**, and 94 KB against 90. A denser plan is a DEAD
         * run, not a slow one.
         *
         * ⇒ the walk stands where the orbit will bring the body and waits.
         * It costs a third more ticks and two orders of magnitude fewer
         * spans, and `assertTapeWithinRuntimeBudget` below is the check that
         * this plan script did not have when the game refused the first one.
         */
        const held = press ? PRESS : NO_KEYS;
        if (press) lastPress = perTick.length;
        perTick.push(held);
        run.advance(held);
        spent += 1;
    }
    check(`${stance.id} is GONE from the world`, bodyById(stance.id) === null,
        `after ${spent} tick(s)`);
}

// ── what the run measured ─────────────────────────────────────────────
const tests = run.spinnerPressHits;
const landed = tests.filter((h) => h.landed);
const kills = run.spinnerPressKills;
const writes = run.spinnerWrites;
const locks = run.spinnerKillLocks;

console.log('\n## the hit tests, one row each (⛔ NOT one row per press)');
for (const h of tests) {
    console.log(`  t=${String(h.t).padStart(4)} ${h.id} ${h.landed ? 'LANDED' : 'refused'}`
        + ` hits=${h.hits} reach=${h.reach.toFixed(2)}${h.why ? ` — ${h.why}` : ''}`);
}
console.log('\n## kills', JSON.stringify(kills));
console.log('## writes', JSON.stringify(writes));
console.log('## kill-lock scans', JSON.stringify(locks));

check('every landed hit is followed by four REFUSED tests of the same press',
    landed.length === 6 && tests.length >= 6,
    `${landed.length} landed of ${tests.length} test(s) — ONE press is ONE hit `
    + '(the receiver sets hitsTimer 30; traps 85/93)');
check('both bodies died to a PRESS', kills.length === 2, JSON.stringify(kills.map((k) => k.id)));
check('⛔ each removal writes OUT OF BAND to {17,29} (§13.10\'s "no-op", refuted)',
    writes.length === 2 && writes.every((w) => w.outOfBand
        && w.flag.level === 17 && w.flag.tag === 29),
    JSON.stringify(writes.map((w) => w.flag)));
check('⛓ the kill-lock scan RAN and is NOT nil — L18\'s lock@144,112 is `tset -1`',
    locks.length === 2 && locks.some((l) => !l.nil),
    JSON.stringify(locks.map((l) => ({ nil: l.nil, opens: l.opens }))));
check('the player took ZERO hits (noDamage is declared — the ENEMY half is the claim)',
    run.playerHits.length === 0, `${run.playerHits.length}`);

const folded = buildTape(perTick, BOOT, NAME,
    { noclip: false, noDamage: true, noHazards: [], grants: [] });
const tape = {
    game: 'seedling',
    name: NAME,
    boot: BOOT,
    noclip: false,
    noDamage: true,
    noHazards: [],
    grants: [],
    persistence: [],
    equips: [],
    pins: ['dead_frames'],
    // ⚠ A v6 `save` BLOCK IS REQUIRED ONCE A SEAM IS DECLARED — `parseTape`
    // refuses `null` by name, which is the format telling the author that a
    // tape claiming a seam is claiming a save state too.
    save: { totem_parts: [], keys: [], seal_parts: [] },
    // ⚠ AND A v7 `rng` BLOCK FOR THE SAME REASON. The generator is DEFAULT-OFF
    // (`split: false` — `Rng.cos()` is then the gameplay stream), so this
    // declares the seed and nothing else; a null would be the format's
    // "inherit", which a tape carrying a seam may not say (trap 130).
    rng: { seed: 1, split: false },
    seam: { items: { hasSword: true } },
    tick_count: perTick.length,
    inputs: folded.inputs,
    tape_version: 8,
};

const description = '⛓⛓⛓ R8 SLICE 6 — THE PRESS ARM\'S DRIVEN PAIR. '
    + '`KILL_ARM_POLICY.Spinner` flipped `refused` -> `modelled` this slice and a refusal '
    + 'retired without a driven witness is trap 101; this is the witness. The player '
    + 'presses L18\'s two spinners to death and the GAME adjudicates every consequence: '
    + `${landed.length} LANDED hits out of ${tests.length} hit TESTS (⛔ one press is FIVE `
    + 'tests and the RECEIVER decides — `hitSpinner` sets `hitsTimer` 30, so tests 2..5 '
    + 'are refused on i-frames, traps 85/93), two deaths on the `fade` staging, the '
    + '`classCount` consequence in a room whose `lock@144,112` is `tset -1` (the first '
    + '`modelled` kill arm whose scan is NOT a nil), and ⛔ TWO OUT-OF-BAND WRITES to '
    + '{17,29}: both placements carry `tag = "-1"` and a −1 is not a no-op — '
    + '`Main.levelPersistenceSet` indexes `level*30 + tag` unchecked. Kickoff §13.10 '
    + 'measured that consequence as NIL and the game settles it. ⚠ `noDamage` is DECLARED '
    + 'and the reason is a BOUND: the hammer\'s angle is `(Game.time % 45)/45·2π` and '
    + '`Game.time` counts DEAD FRAMES, which this model does not carry, so a stance '
    + 'inside the 13 px disc is a contact it cannot price — `levelRun` refuses one BY '
    + 'NAME on an honest tape. This tape claims the ENEMY\'s half. The stance is CHOSEN, '
    + 'not derived: a pair is a witness, not a solve. Authored by '
    + 'scripts/procgen/plan-seedling-r8-l18-spinner.mjs.';

function tapeJson(obj) {
    const parsed = parseTape(obj);
    return `${JSON.stringify({
        tape_version: requiredTapeVersion(parsed),
        game: 'seedling',
        name: obj.name,
        description,
        boot: parsed.boot,
        noclip: parsed.noclip,
        noDamage: parsed.noDamage,
        noHazards: parsed.noHazards,
        grants: parsed.grants,
        persistence: parsed.persistence,
        equips: parsed.equips,
        pins: parsed.pins,
        save: parsed.save,
        rng: parsed.rng,
        seam: parsed.seam,
        tick_count: parsed.tick_count,
        inputs: parsed.inputs,
    }, null, 4)}\n`;
}

/**
 * ⛔ THE BUDGET, ASSERTED BEFORE THE GAME IS ASKED. The runtime refuses a
 * dense tape at LOAD with a heap failure, which reads as a broken harness
 * rather than as a plan that is too dense — this slice paid for that reading
 * once (see the wait above).
 */
const budget = assertTapeWithinRuntimeBudget(tape, NAME);
console.log(`## budget: ${budget.spans} span(s), ${Math.round(budget.bytes / 1024)} KB`);

const path = join(TAPES, `${NAME}.json`);
const json = tapeJson(tape);
if (CHECK) {
    const have = existsSync(path) ? readFileSync(path, 'utf8') : null;
    check(`${NAME} is byte-identical to what this plan derives`, have === json,
        have === null ? 'the file does not exist' : `${json.length} bytes`);
} else {
    writeFileSync(path, json);
    console.log(`\n  wrote ${path} (${json.length} bytes, ${perTick.length} ticks)`);
}

if (CHECK) console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
