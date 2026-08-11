/**
 * plan-seedling-r8-hammer-pair — ⚖ **THE DRIVEN PAIR THAT TURNS A PREDICTION
 * INTO A CAPABILITY.** R8 slice 8, kickoff §16.8's fifth piece.
 *
 * ⚖ THE USER'S CORRECTION IS THE CHARTER: *"The hammer spins in a predictable
 * pattern. Opportunistic attack means waiting until the hammer isn't in the
 * way, or moving to where the hammer won't be. Forbidding the whole disc the
 * hammer passes through is wrong."* `gameClock` makes the phase computable and
 * `spinner.hammerHitsPlayer` makes it a contact — but a model that PREDICTS an
 * angle and a model that IS RIGHT about one are different claims, and only the
 * game can tell them apart.
 *
 * ── ⛓⛓⛓ THE PAIR IS ONE INTEGER APART, AND THAT IS THE WHOLE DESIGN ──
 *
 * Both tapes are the SAME room, the SAME boot position, the SAME 324 ticks of
 * THE SAME input — a 244-tick wait and an 80-tick walk north. The only
 * difference between them is the declared `save.time`:
 *
 *   ARM      `save.time` 4800  ⇒ the player spends fifteen ticks INSIDE
 *                              `spinner@48,96`'s 13 px hammer disc, 7.75 px
 *                              deep, and the model predicts **ZERO** contacts.
 *   CONTROL  `save.time` 4835  ⇒ the same walk through the same disc, and the
 *                              model predicts a **HAMMER** contact at a NAMED
 *                              tick.
 *
 * ── ⛔⛔⛔ AND THE GAME REFUTED THE FIRST VERSION OF THIS PAIR ─────────
 *
 * The first cut was a pure 254-tick stand with no escape, and the recording
 * came back **`hits: 1` against a model that predicted 0** — on the ARM.
 * Localised rather than patched: the model's own next prediction was a BODY
 * contact at tick **256**, two ticks past the tape's last observation, and the
 * differential reads `hits` from `botStatus` AFTER the tape disarms while the
 * page keeps running (measured: `game_time` 5082 against the disarm's 5075 —
 * seven frames later). The game's own `hits_timer` DATED it there. So the
 * model was right about the 254 ticks it drove and the READOUT was billing a
 * frame it did not.
 *
 * ⇒ **A ZERO-HIT TAPE HAS TO END CLEAR, NOT MERELY RUN CLEAN.** The 80-tick
 * walk north is that: both arms finish 26–36 px outside every disc, so the
 * frames between the disarm and the readout cannot bill either of them. ⚠ The
 * arm's exposure went UP rather than down — fifteen ticks inside the disc
 * instead of ten — because the walk crosses the body's path instead of waiting
 * for it.
 *
 * ⛔ WHY THAT MAKES IT A PAIR AND NOT TWO TAPES. Everything a differential
 * could otherwise blame is held fixed — the geometry, the walk, the bodies'
 * trajectories (`Spinner.update`'s motion has no `Game.time` term at all), the
 * item state, the RNG. `save.time` reaches exactly one mechanism on this
 * roster: `hammerAngle = (Game.time % 45) / 45 · 2π`. So if the game agrees
 * with both arms, the only thing that can have decided the difference is the
 * angle — which is the claim.
 *
 * ⛔ AND THE WITNESS IS A TICK AND A SOURCE, NEVER A COUNT (trap 113). The
 * control's assertion names the tick, the arm (`spinner-hammer`, not the 7x7
 * body), the body's id and the phase; the game's own `hits`, its `hits_timer`
 * at the disarm — which counts down from 30 and therefore DATES the hit — and
 * the observation stream itself, whose knockback the model has to reproduce
 * pixel for pixel, are the three things that settle it.
 *
 * ⚠ THE ARM'S CLAIM IS THE INTERESTING HALF. "No hit" is cheap if you stand
 * far away; this stands SEVEN PIXELS INSIDE the disc that slice 7's ingredient
 * forbade outright, for ten ticks, and takes nothing.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r8-hammer-pair.mjs
 *   node scripts/procgen/plan-seedling-r8-hammer-pair.mjs --check
 *
 * Then record (the game is the only oracle):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-hammer-arm --only=r8-hammer-control
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { SPINNER } = await import(join(MODULE, 'spinner.js'));
const { LOAD_FADE_FRAMES } = await import(join(MODULE, 'gameClock.js'));
const { BOOT_PRESWAP_FRAMES } = await import(join(MODULE, 'r7Acceptance.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();

/**
 * L18's own arrival from L16 — the same boot `r8-l18-spinner-press` uses, so
 * the pair stands where the arc's existing spinner witness already stands.
 */
const BOOT = Object.freeze({ level: 18, x: 16, y: 112 });

/**
 * ⛔ THE TWO NUMBERS ARE DERIVED, NOT CHOSEN.
 *
 * `spinner@48,96` orbits into the spawn box and its BODY reaches it at tick
 * 256 — an `Enemy.hitPlayer` contact, which no phase can dodge. So the wait
 * ends at 244 and the walk north starts there: the player crosses the body's
 * own approach, which is where the hammer decides, and is out of every disc
 * long before the tape ends. One phase takes the hammer on the way through and
 * the other does not, which is the entire experiment.
 *
 * ⚠ 80 TICKS OF WALK IS THE MARGIN THE REFUTATION BOUGHT: the readout is
 * served after the disarm, so the tape has to finish somewhere the next
 * several frames cannot reach.
 */
const STAND = 244;
const ESCAPE = 80;
/** North — away from the body's approach, along L18's west wall. */
const ESCAPE_KEY = 'up';

/** The declared `save.time` a given phase offset needs. */
const DECLARED_BASE = 4800;

const mk = (time) => createLevelRun({
    levelSource,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    // ⛔ HONEST. The whole point is that the game's own `Player.hit` is allowed
    // to fire; under `noDamage` it returns on its first line and both arms
    // would report the same nothing.
    noDamage: false,
    grants: [],
    persistence: [],
    despawn: [],
    equips: [],
    pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: null,
    seam: {
        items: { hasSword: true },
        time,
        hits_max: 3,
        cutscene: [false, false, false, false],
        menu_state: 0,
    },
    roles: ROLES,
});

/**
 * Stand still for `STAND` ticks under one clock and report what the model saw.
 *
 * ⚠ THE DISC DEPTH IS MEASURED ON THE WAY, because "inside the disc" is the
 * arm's whole claim and a run that merely took no damage 40 px away would
 * satisfy a contact count just as well.
 */
function stand(time) {
    const run = mk(time);
    let discTicks = 0;
    let deepest = Infinity;
    const sample = () => {
        const box = playerBoxAt(run.state.x, run.state.y);
        let gapHere = Infinity;
        for (const b of run.spinnerBodies) {
            const gap = Math.max(
                (b.x - SPINNER.hammerLength) - box.right,
                box.x - (b.x + SPINNER.hammerLength),
                (b.y - SPINNER.hammerLength) - box.bottom,
                box.y - (b.y + SPINNER.hammerLength),
            );
            if (gap < gapHere) gapHere = gap;
        }
        if (gapHere <= 0) discTicks += 1;
        if (gapHere < deepest) deepest = gapHere;
    };
    for (let t = 0; t < STAND; t += 1) { sample(); run.advance(new Set()); }
    for (let t = 0; t < ESCAPE; t += 1) { sample(); run.advance(new Set([ESCAPE_KEY])); }
    /**
     * ⛔ THE TAIL THE REFUTATION PAID FOR. `botStatus.hits` is served after the
     * disarm and the page keeps running, so a tape that merely ran clean can
     * still be billed for the frame after its last observation. This is the
     * margin, measured on the model's own forecast: how close does any body
     * get in the twenty frames AFTER the tape ends, and does anything land.
     */
    let tailGap = Infinity;
    for (let t = 0; t < 20; t += 1) {
        const box = playerBoxAt(run.state.x, run.state.y);
        for (const b of run.spinnerBodies) {
            tailGap = Math.min(tailGap, Math.max(
                (b.x - SPINNER.hammerLength) - box.right,
                box.x - (b.x + SPINNER.hammerLength),
                (b.y - SPINNER.hammerLength) - box.bottom,
                box.y - (b.y + SPINNER.hammerLength),
            ));
        }
        run.advance(new Set());
    }
    return {
        run,
        time,
        discTicks,
        deepest,
        tailGap,
        // ⚠ The contacts/hits BEFORE the tail frames are the tape's claim; the
        // tail's own count is what the READOUT will see.
        tailHits: run.playerHits.length,
        contacts: run.spinnerContacts.filter((c) => c.t <= STAND + ESCAPE),
        hits: run.playerHits.filter((h) => h.t <= STAND + ESCAPE),
    };
}

// ── THE SEARCH: one sweep of the clock, both arms taken from it ───────
//
// ⛔ THE PHASES ARE ENUMERATED, NOT PICKED. All 45 residues are driven and the
// arm/control are the extremes of what came back, so "a safe phase exists" and
// "an unsafe one exists" are both measurements of the same sweep rather than
// two separately-motivated stances.
const sweep = [];
for (let k = 0; k < SPINNER.hammerPeriod; k += 1) sweep.push(stand(DECLARED_BASE + k));

const clean = sweep.filter((s) => s.contacts.length === 0);
const hammerFirst = sweep.filter((s) => s.contacts[0]?.arm === 'hammer');
check('the clock sweep produced BOTH arms — safe phases and unsafe ones',
    clean.length > 0 && hammerFirst.length > 0,
    `${clean.length} of ${SPINNER.hammerPeriod} phases take nothing, `
    + `${hammerFirst.length} take a HAMMER first`);
check('⛔ and NO phase takes a BODY contact inside the stand — the pair is '
    + 'about the ANGLE and nothing else',
    sweep.every((s) => s.contacts.every((c) => c.arm === 'hammer')),
    `${sweep.reduce((n, s) => n + s.contacts.filter((c) => c.arm === 'body').length, 0)} `
    + 'body contact(s) across all 45 phases');

// The ARM is the safe phase that stands DEEPEST inside the disc; the CONTROL
// is the unsafe phase whose hit lands EARLIEST, so the two extremes of the
// same sweep are what get recorded.
const arm = clean.reduce((a, b) => (b.deepest < a.deepest ? b : a));
const control = hammerFirst.reduce((a, b) => (b.contacts[0].t < a.contacts[0].t ? b : a));

check('the ARM goes INSIDE the disc, and says how deep',
    arm.discTicks > 0 && arm.deepest < 0,
    `${arm.discTicks} tick(s) inside, ${(-arm.deepest).toFixed(2)} px past the `
    + `${SPINNER.hammerLength} px reach, save.time ${arm.time}`);
check('the ARM takes NOTHING — zero contacts, zero hits',
    arm.contacts.length === 0 && arm.hits.length === 0,
    `${arm.contacts.length} contact(s), ${arm.hits.length} hit(s)`);
check('⛔ and the ARM ENDS CLEAR — the readout is served after the disarm, which '
    + 'is the refutation this pair was rebuilt around',
    arm.tailGap > 0 && arm.tailHits === arm.hits.length,
    `${arm.tailGap.toFixed(2)} px outside every disc for the 20 frames after the tape, `
    + `${arm.tailHits} hit(s) still`);
check('the CONTROL takes a HAMMER contact at a NAMED tick, from a NAMED body',
    control.contacts[0]?.arm === 'hammer' && control.hits.length > 0,
    `tick ${control.contacts[0]?.t}, ${control.contacts[0]?.id}, `
    + `Game.time ${control.contacts[0]?.gameTime} (phase `
    + `${control.contacts[0]?.gameTime % SPINNER.hammerPeriod}/${SPINNER.hammerPeriod}), `
    + `angle ${(control.contacts[0]?.angle * 180 / Math.PI).toFixed(1)}°, save.time `
    + `${control.time}`);
check('⛔ the CONTROL takes EXACTLY ONE hit and does not die, and ENDS CLEAR too',
    control.hits.length === 1 && control.tailHits === 1 && control.tailGap > 0,
    `${control.hits.length} hit(s) in the tape, ${control.tailHits} after 20 more frames, `
    + `ending ${control.tailGap.toFixed(2)} px clear`);
check('⛓ the CONTROL\'s hit is BILLED through the one funnel, at the hammer\'s force',
    control.hits[0]?.source === 'spinner-hammer' && control.hits[0]?.hits === 1,
    `source ${control.hits[0]?.source}, hits ${control.hits[0]?.hits}, `
    + `knockback ${JSON.stringify(control.hits[0]?.knockback)}`);
check('⛓⛓ the two arms are ONE INTEGER apart and nothing else',
    arm.time !== control.time,
    `arm save.time ${arm.time}, control save.time ${control.time} — the same boot, the `
    + `same ${STAND} ticks, the same (empty) input`);
check('⛓ and the clock is the model\'s own: first live tick reads '
    + '`save.time + BOOT_PRESWAP_FRAMES + LOAD_FADE_FRAMES`',
    mk(DECLARED_BASE).gameTime === DECLARED_BASE + BOOT_PRESWAP_FRAMES + LOAD_FADE_FRAMES,
    `${mk(DECLARED_BASE).gameTime} = ${DECLARED_BASE} + ${BOOT_PRESWAP_FRAMES} + `
    + `${LOAD_FADE_FRAMES}`);

// ── the two tapes ─────────────────────────────────────────────────────
const PER_TICK = [
    ...Array.from({ length: STAND }, () => new Set()),
    ...Array.from({ length: ESCAPE }, () => new Set([ESCAPE_KEY])),
];

function tapeFor(name, time) {
    const folded = buildTape(PER_TICK, BOOT, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return {
        game: 'seedling',
        name,
        boot: BOOT,
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        equips: [],
        pins: ['dead_frames'],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false },
        seam: {
            items: { hasSword: true },
            time,
            hits_max: 3,
            cutscene: [false, false, false, false],
            menu_state: 0,
        },
        tick_count: PER_TICK.length,
        inputs: folded.inputs,
        tape_version: 8,
    };
}

const SHARED = `⚖ R8 SLICE 8 — THE DRIVEN PAIR FOR THE HAMMER'S PHASE, and the two `
    + `arms are ONE INTEGER apart. Same room (L18), same boot, same ${STAND} ticks of the `
    + 'same EMPTY input; the only difference is the declared `save.time`, which reaches '
    + 'exactly one mechanism on this roster — `hammerAngle = (Game.time % 45)/45·2π` '
    + '(`Spinner.as:70-72`). `Spinner.update`\'s MOTION has no `Game.time` term at all, so '
    + 'the bodies follow identical orbits in both arms and the angle is the only thing '
    + 'that can decide the difference. ⚖ The user\'s correction — "the hammer spins in a '
    + 'predictable pattern; forbidding the whole disc it passes through is wrong" — is '
    + 'what this pair turns from a prediction into a measured capability. Authored by '
    + 'scripts/procgen/plan-seedling-r8-hammer-pair.mjs.';

const DESCRIPTIONS = {
    'r8-hammer-arm': `${SHARED} ⛓ THIS IS THE ARM: the player stands `
        + `${arm.discTicks} tick(s) INSIDE \`spinner@48,96\`'s ${SPINNER.hammerLength} px `
        + `hammer disc — ${(-arm.deepest).toFixed(2)} px past its reach, a stance R8 slice `
        + '7\'s ingredient forbade outright — and takes NOTHING. The model predicts zero '
        + 'contacts and the GAME\'s own `hits: 0` is what settles it.',
    'r8-hammer-control': `${SHARED} ⛔ THIS IS THE CONTROL: the same ten ticks inside the `
        + `same disc at an UNSAFE phase. The model predicts a HAMMER contact at tick `
        + `${control.contacts[0].t} from ${control.contacts[0].id} at Game.time `
        + `${control.contacts[0].gameTime} (phase `
        + `${control.contacts[0].gameTime % SPINNER.hammerPeriod}/${SPINNER.hammerPeriod}, `
        + `angle ${(control.contacts[0].angle * 180 / Math.PI).toFixed(1)}°), billed at `
        + 'force 4 and damage 1 through `applyPlayerHit`. ⛔ A TICK AND A SOURCE, NEVER A '
        + 'COUNT (trap 113): the game\'s `hits`, its `hits_timer` at the disarm (which '
        + 'counts down from 30 and therefore DATES the hit) and the knockback the '
        + 'observation stream has to reproduce pixel for pixel are the three witnesses.',
};

function tapeJson(obj) {
    const parsed = parseTape(obj);
    return `${JSON.stringify({
        tape_version: requiredTapeVersion(parsed),
        game: 'seedling',
        name: obj.name,
        description: DESCRIPTIONS[obj.name],
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

for (const [name, time] of [['r8-hammer-arm', arm.time], ['r8-hammer-control', control.time]]) {
    const tape = tapeFor(name, time);
    const budget = assertTapeWithinRuntimeBudget(tape, name);
    console.log(`## ${name}: ${budget.spans} span(s), ${Math.round(budget.bytes / 1024)} KB`);
    const path = join(TAPES, `${name}.json`);
    const json = tapeJson(tape);
    if (CHECK) {
        const have = existsSync(path) ? readFileSync(path, 'utf8') : null;
        check(`${name} is byte-identical to what this plan derives`, have === json,
            have === null ? 'the file does not exist' : `${json.length} bytes`);
    } else {
        writeFileSync(path, json);
        console.log(`  wrote ${path} (${json.length} bytes, ${PER_TICK.length} ticks)`);
    }
}

if (CHECK) console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
