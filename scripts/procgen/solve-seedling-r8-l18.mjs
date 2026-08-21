#!/usr/bin/env node
/**
 * solve-seedling-r8-l18 — ⛓⛓⛓ **THE HONEST L18**, driven by the live solver
 * with `noDamage` RETIRED. R8 slice 8, kickoff §16.8's fifth piece.
 *
 * ── WHAT THIS IS, AND WHAT IT REPLACES ────────────────────────────────
 *
 * L18 is D2's kill-lock room: `lock@144,112` is `tset -1`, so nothing but
 * `Game.totalEnemies()` reaching zero opens it, and the room's two `Spinner`s
 * are its only openers. R8 slice 6 recorded `r8-l18-spinner-press` there under
 * `noDamage` — a witness for the ENEMY's half — and slice 7 built the press
 * arm's strike schedule, drove it, and REPORTED the room rather than recording
 * it (§11.10.1: a room that refuses is reported, never recorded).
 *
 * ⚖ THE USER'S CORRECTION is why that changes here: *"The hammer spins in a
 * predictable pattern. Opportunistic attack means waiting until the hammer
 * isn't in the way, or moving to where the hammer won't be. Forbidding the
 * whole disc the hammer passes through is wrong."* With `gameClock` counting
 * `Game.time` and `spinner.hammerHitsPlayer` asking the exact question, the
 * schedule's own predicate (`solverBot.clearOfHammersAt`) stops forbidding a
 * 13 px disc and starts forbidding a 13 px LINE — and the room solves.
 *
 * ── THE THREE THINGS THAT HAD TO CHANGE, AND ALL THREE WERE DEFECTS ───
 *
 *  1. **THE INGREDIENT.** The disc that manufactured the policy problem
 *     (trap 171). Measured: the same 60 cells and the same 600-tick horizon
 *     leave ONE clear cell under the disc and eleven under the line, and no
 *     static striking stance under the disc against three under the line.
 *  2. **THE SCAN'S BOUND.** `deriveStrike` truncates at 40 candidates in TICK
 *     order. Under the disc those forty spanned hundreds of ticks; under the
 *     line they all landed at `i = 2..5`, every one of them unreachable, and
 *     the scan rejected itself. The candidates are pre-filtered by an
 *     admissible ETA floor now. ⛓ The conservative ingredient had been HIDING
 *     a defect in the bound.
 *  3. **THE KILL LOCK HAD NO WRITER.** §16.3 said the spinner arm *"leaves
 *     the opening itself to `stepActivators`' own kill-lock arm"*. There is no
 *     such arm — `active = a.t >= 0 && …` makes a `tset == -1` lock
 *     unreachable by construction, as it must be, because no button answers
 *     one. What opens it model-side is the TAPE's declared v9 `at` row, and
 *     the chaser family has raised that structured declaration since slice 4.
 *     The spinner family now does too, and `execKillByPress` grew the
 *     `PendingDeclaration` tail every other kill arm already had.
 *
 * ── THE SOLVE, AND ITS NUMBERS ARE THE ROOM'S ────────────────────────
 *
 * Two bodies, three landed presses each, `hitsTimer` 30 apart; the kill lock's
 * clear declared at `removal + opensOnTick(0.01)`; the exit crossed to L19.
 * ⛔ ZERO HITS AND ZERO SPINNER CONTACTS, on a tape that does NOT declare
 * `noDamage` — which is the whole difference from `r8-l18-spinner-press`, and
 * the reason that tape stays exactly where it is as the conservative era's
 * mechanism witness.
 *
 * Run (model-side):
 *   node scripts/procgen/solve-seedling-r8-l18.mjs
 *   node scripts/procgen/solve-seedling-r8-l18.mjs --check
 *
 * Then record (the game is the only oracle):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-solve-18
 */

import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');
const TRACES = join(MODULE, 'fixtures', 'traces');

const CHECK = process.argv.includes('--check');

const { parseTape, requiredTapeVersion, assertTapeWithinRuntimeBudget } =
    await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();
const NAME = 'r8-solve-18';

/**
 * ⛔ THE STAGED BOOT IS THE CAMPAIGN'S OWN LATCH, READ OFF DISK — the same
 * source `r8-solve-20` and the `r8-d2` chain use, for the same reason: booting
 * a state invented beside the campaign would be a claim about a different game.
 *
 * ⚠ WHAT IS **NOT** DECLARED: nothing about L18 itself. The kill-lock clear
 * this walk earns is authored by the two-pass loop from the run's own ledger,
 * not typed here.
 */
/**
 * ⛓ R9 SLICE 7 — RE-POINTED AT THE TWIN. This was `r7-act2-11.json`, the last
 * committed segment of the hand chain `act2-the-sword`, which ⚖ ruling 14
 * retired. `r8-solve-11` is the SOLVER tape for the same room from the same
 * boot, and the swap is a MEASUREMENT, not a hope: at slice 7's baseline the
 * two files' boot blocks were compared field by field and came out BYTE-EQUAL
 * over all eleven — `boot`, `noclip`, `noDamage`, `noHazards`, `grants`,
 * `persistence`, `equips`, `pins`, `save`, `rng`, `seam`. Only the fields in
 * that list are read below. The hand chain's post-sword latch and the solver
 * chain's are the same numbers; what changed is which file holds them.
 */
const LATCH = parseTape(JSON.parse(
    readFileSync(join(TAPES, 'r8-solve-11.json'), 'utf8')));

/**
 * L18's own arrival from L16 — ⚖ §16.3 ruling 1's route. `assertD2RouteGraph`
 * re-derives the D2 edges from the atlas and L13 has NO edge to L18: the only
 * path is L13 -> L14 -> L15 -> L16 -> L18. Read from the atlas rather than
 * typed, because a boot block is `new Game(level, x, y)`'s ARGUMENTS.
 */
function arrivalInto(fromLevel, toLevel) {
    const e = (levelSource(fromLevel).entities ?? []).find(
        (x) => x.attrs && Number(x.attrs.to) === toLevel && x.attrs.playerx !== undefined);
    if (!e) throw new Error(`no L${fromLevel} -> L${toLevel} teleporter in the atlas`);
    return { level: toLevel, x: Number(e.attrs.playerx), y: Number(e.attrs.playery) };
}
const exitTo = (level, to) => {
    const e = (levelSource(level).entities ?? []).find(
        (x) => (x.type === 'stairsup' || x.type === 'stairsdown' || x.type === 'teleporter')
            && Number(x.attrs?.to) === to);
    if (!e) throw new Error(`L${level} has no exit to L${to}`);
    return { x: e.x, y: e.y };
};

const BOOT = Object.freeze(arrivalInto(16, 18));
const GOALS = [{ kind: 'reach-exit', exit: exitTo(18, 19) }];

console.log(`## ${NAME} — boot L${BOOT.level} (${BOOT.x},${BOOT.y}), goals `
    + `${GOALS.map((g) => g.kind).join(' then ')}`);

const makeRun = (persistence) => createLevelRun({
    levelSource,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    // ⛔ HONEST. This is the flag `r8-l18-spinner-press` declares and this tape
    // does not, and it is the whole claim: under it `Player.hit` returns on
    // its first line and a walk through a hammer costs nothing.
    noDamage: false,
    grants: [],
    despawn: [],
    persistence,
    equips: LATCH.equips,
    pins: LATCH.pins ?? [],
    save: LATCH.save ?? null,
    rng: LATCH.rng ?? null,
    seam: LATCH.seam ?? null,
    // ⛔ THE REPLAY'S OWN CENSUS, BY NAME (trap 158).
    roles: ROLES,
});

/**
 * ⛓ THE CLOCK IS A PRECONDITION, ASSERTED BEFORE THE SOLVE. Without it every
 * hammer question falls back to the 13 px disc and this room is exactly as
 * unsolvable as slice 7 reported it.
 */
{
    const probe = makeRun(LATCH.persistence);
    check('the clock RUNS at this boot — the hammer\'s phase is computable',
        probe.gameTimeRefusal === null && Number.isFinite(probe.gameTime),
        `Game.time ${probe.gameTime} at the first live tick `
        + `(refusal: ${probe.gameTimeRefusal ?? 'none'})`);
}

const solved = await twoPassSolve({
    makeRun,
    goals: GOALS,
    name: NAME,
    boot: BOOT,
    persistence: LATCH.persistence,
    log: (m) => console.log(m),
});
const { out } = solved;

/**
 * ⛔ THE EMITTED TAPE IS REPLAYED, and every claim below is read off THAT run
 * rather than off the solving pass. A solver that measured its own walk and a
 * tape that reproduces it are different artifacts, and the tape is the one the
 * game will be handed.
 */
const run = makeRun(solved.persistence);
for (const held of out.perTick) run.advance(held);

const hits = run.playerHits.length;
const deaths = run.playerDeaths.length;
check(`${NAME}: ZERO hits and ZERO deaths (the standing zero-hit policy)`,
    hits === 0 && deaths === 0, `hits ${hits}, deaths ${deaths}`);
/**
 * ⛓⛓⛓ THE HEADLINE, AND IT IS A CLAIM ABOUT THE **HAMMER** SPECIFICALLY.
 * `spinnerContacts` carries one row per test the geometry passed, by ARM —
 * so "zero" here means neither the 7x7 body nor the 13 px line ever reached
 * the player, on a tape where both would have been billed (trap 113: an arm
 * and a tick, never a count).
 */
check('⛓⛓⛓ ZERO SPINNER CONTACTS — neither the body nor the hammer, on an '
    + 'HONEST tape', run.spinnerContacts.length === 0,
    JSON.stringify(run.spinnerContacts));
check('⛔ and `noDamage` is NOT declared — the flag `r8-l18-spinner-press` needs',
    run.noDamage !== true, 'noDamage false');

const kills = run.spinnerPressKills ?? [];
check('both spinners died to a PRESS', kills.length === 2,
    JSON.stringify(kills.map((k) => ({ id: k.id, t: k.t, removed: k.removedTick }))));
const tests = run.spinnerPressHits ?? [];
const landed = tests.filter((h) => h.landed);
check('⛓ each body takes `hitsMax` LANDED hits, and the refused tests are '
    + 'recorded beside them (traps 85/93)',
    landed.length === 6 && tests.length > landed.length,
    `${landed.length} landed of ${tests.length} test(s)`);

const opens = (run.spinnerKillLockOpens ?? []).filter((o) => !o.nil);
check('⛓⛓ the kill-lock scan RAN at the REMOVAL and is NOT nil', opens.length === 1,
    JSON.stringify((run.spinnerKillLockOpens ?? []).map((o) => ({ t: o.t, nil: o.nil }))));
const declared = solved.persistence.find((p) => p.level === 18 && p.tag === 0);
check('⛓⛓⛓ {18,0} is DECLARED at the tick the model computed — the removal '
    + 'plus the `Lock`\'s own fade',
    Boolean(declared) && declared.at === opens[0]?.t + 101,
    `declared at ${declared?.at} = removal ${opens[0]?.t} + 101 (${declared?.note})`);
check('⛔ and the loop CONVERGED — a discover pass, a measure pass, a solve pass',
    solved.passes.map((p) => p.kind).join(',') === 'discover,measure,solve',
    JSON.stringify(solved.passes));
check('⛓ the measuring pass and the solving pass AGREE below the declared tick',
    solved.prefixChecks.length === 1 && solved.prefixChecks[0].comparedTicks >= declared.at,
    JSON.stringify(solved.prefixChecks.map((p) => ({ ticks: p.comparedTicks, at: p.declaredAt }))));

const t = run.transitions[run.transitions.length - 1];
check('the segment ends at a LEVEL ARRIVAL (§3.5), in L19',
    Boolean(t) && t.to_level === 19, JSON.stringify(run.transitions));
check('the arrival is CALM (v = 0 at the latch)',
    run.state.vx === 0 && run.state.vy === 0, `v=(${run.state.vx},${run.state.vy})`);

// ── emit ──────────────────────────────────────────────────────────────
const folded = buildTape(out.perTick, BOOT, NAME,
    { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tape = {
    game: 'seedling',
    name: NAME,
    boot: BOOT,
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: solved.persistence,
    equips: LATCH.equips,
    pins: LATCH.pins,
    save: LATCH.save,
    rng: LATCH.rng,
    seam: LATCH.seam,
    tick_count: out.perTick.length,
    inputs: folded.inputs,
    tape_version: 9,
};

const description = '⛓⛓⛓ R8 SLICE 8 — **THE HONEST L18**. The live solver crosses D2\'s '
    + 'kill-lock room with `noDamage` RETIRED and takes NOTHING: zero hits, and zero '
    + 'spinner contacts on either arm — neither `Enemy.hitPlayer`\'s 7x7 body at force 3 '
    + 'nor `Spinner.update`\'s 13 px `collideLine` at force 4. ⚖ THE USER\'S CORRECTION '
    + 'IS WHY THIS EXISTS: "the hammer spins in a predictable pattern; opportunistic '
    + 'means waiting until the hammer isn\'t in the way, or standing where it won\'t be. '
    + 'Forbidding the whole disc the hammer passes through is wrong." R8 slice 7 built '
    + 'the strike schedule and REPORTED this room; what it was fighting was its own '
    + 'ingredient (trap 171). Three things changed and all three were defects: the '
    + 'ingredient (disc -> exact line, `gameClock` counting `Game.time`), '
    + '`deriveStrike`\'s 40-candidate bound (which under an accurate ingredient selected '
    + 'forty unreachable ticks and rejected itself), and the kill lock\'s MISSING WRITER '
    + '— §16.3 named an arm of `stepActivators` that does not exist, so the spinner '
    + 'family now raises the same structured declaration the chaser family has raised '
    + 'since slice 4 and `execKillByPress` grew the `PendingDeclaration` tail every '
    + `other kill arm already had. Both bodies die to three landed presses (${landed.length} `
    + `of ${tests.length} hit TESTS — the receiver\'s own \`hitsTimer\` refuses the rest, `
    + `traps 85/93), \`{18,0}\` is declared at ${declared?.at} = the removal plus the `
    + '`Lock`\'s own 101-step fade, and the walk crosses to L19. Boot: r7-act2-11\'s '
    + 'committed v8 block at L18\'s own arrival from L16 (⚖ §16.3 ruling 1 — L13 has no '
    + `edge to L18). Solver: ${out.perTick.length} ticks, `
    + `${out.trace.rows.length} decision(s), ${out.replans} re-plan(s). ⚠ `
    + '`r8-l18-spinner-press` stays exactly where it is as the CONSERVATIVE ERA\'s '
    + 'mechanism witness — it declares `noDamage` and this tape does not. Authored by '
    + 'scripts/procgen/solve-seedling-r8-l18.mjs; trace sidecar in fixtures/traces/.';

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

function emit(path, json, what) {
    if (CHECK) {
        const have = existsSync(path) ? readFileSync(path, 'utf8') : null;
        check(`${what} is byte-identical to what this solver derives`, have === json,
            have === null ? 'the file does not exist'
                : have === json ? `${json.length} bytes`
                    : '⛔ DRIFT — the committed artifact is not what the solver produces today');
        return;
    }
    writeFileSync(path, json);
    console.log(`  wrote ${path} (${json.length} bytes)`);
}

const budget = assertTapeWithinRuntimeBudget(tape, NAME);
console.log(`## budget: ${budget.spans} span(s), ${Math.round(budget.bytes / 1024)} KB`);

mkdirSync(TRACES, { recursive: true });
emit(join(TAPES, `${NAME}.json`), tapeJson(tape), NAME);
emit(join(TRACES, `${NAME}.trace.json`),
    `${JSON.stringify(out.trace, null, 4)}\n`, `${NAME} trace`);

console.log(`\n## ${NAME}: ${out.perTick.length} ticks, ${hits} hit(s), ${deaths} death(s), `
    + `${run.spinnerContacts.length} spinner contact(s); {18,0} at ${declared?.at}`);
console.log('## there is NO hand answer for L18 — the differential is the entire gate.');

if (CHECK) console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
