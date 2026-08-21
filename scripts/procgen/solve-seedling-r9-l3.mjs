#!/usr/bin/env node
/**
 * solve-seedling-r9-l3 — ⛓⛓⛓ **THE ROOM THE `break` VERB OPENED**, driven by
 * the live solver. R9 slice 4 (kickoff §3.5 / §12).
 *
 * ── WHAT THIS IS ──────────────────────────────────────────────────────
 *
 * Route-survey **step 12** is L3 entered from L11 on the way back west, and
 * until this slice it was the survey's only VERB-MISSING row:
 *
 *     solverBot(survey-step-12): no corridor for goal reach-exit toward
 *     (72,8) in level 3. Obstacle: solid:breakablerock (breakablerock@96,112).
 *     No strategy row exists for this obstacle. Planner said: no walkable
 *     tile path in level 3 from tile (6,8) to (4,0). The two are in different
 *     connected components …
 *
 * ⛔ **THE ROCK IS THE DOOR OUT OF THE ARRIVAL POCKET.** The boot cell
 * (104,136) is a one-cell island — Stone on three sides, WATER on the fourth —
 * and `breakablerock@96,112` is its only non-lethal neighbour. There is no way
 * round: the planner's own sentence is *"different connected components"*. So
 * this room is the verb's forcing case, and the tape is what the GAME says
 * about it (R8 lesson 4: the game is the only oracle).
 *
 * ── THE BOOT IS THE SURVEY'S, WHICH IS R8 SLICE 8's ───────────────────
 *
 * `r7-act2-11`'s committed v8 block — the campaign's own post-sword latch —
 * re-pointed at L3's arrival coordinates from L11, read out of the ATLAS. That
 * is exactly `r8-solve-18`'s construction and exactly the survey's `staged`
 * boot policy, so this tape's claim is the same one the survey makes: *this
 * room is solvable from this declared state*. ⚠ It is a DECLARATION and not a
 * measured latch — the campaign's true-start chain is ⚖ ruling 11's slice, not
 * this one, and this tape will be re-recorded from a real latch when the chain
 * reaches L3.
 *
 * ⛔ THE COMMITTED TIMED CLEARS ARE STRIPPED, for the survey's own reason: a
 * v9 `persistence[].at` is a witness belonging to the HAND walk that recorded
 * it, and a solver deriving its own walk never lived through that tick.
 *
 * Run (model-side):
 *   node scripts/procgen/solve-seedling-r9-l3.mjs
 *   node scripts/procgen/solve-seedling-r9-l3.mjs --check
 *
 * Then record (the game is the only oracle):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r9-solve-3
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
const NAME = 'r9-solve-3';

const LATCH = parseTape(JSON.parse(
    readFileSync(join(TAPES, 'r7-act2-11.json'), 'utf8')));

/** The atlas's own arrival coordinates for a crossing — never typed here. */
function arrivalInto(fromLevel, toLevel) {
    const e = (levelSource(fromLevel).entities ?? []).find(
        (x) => x.attrs && Number(x.attrs.to) === toLevel && x.attrs.playerx !== undefined);
    if (!e) throw new Error(`no L${fromLevel} -> L${toLevel} exit in the atlas`);
    return { level: toLevel, x: Number(e.attrs.playerx), y: Number(e.attrs.playery) };
}
const exitTo = (level, to) => {
    const e = (levelSource(level).entities ?? []).find(
        (x) => (x.type === 'stairsup' || x.type === 'stairsdown' || x.type === 'teleporter')
            && Number(x.attrs?.to) === to);
    if (!e) throw new Error(`L${level} has no exit to L${to}`);
    return { x: e.x, y: e.y };
};

const BOOT = Object.freeze(arrivalInto(11, 3));
const GOALS = [{ kind: 'reach-exit', exit: exitTo(3, 2) }];

console.log(`## ${NAME} — boot L${BOOT.level} (${BOOT.x},${BOOT.y}) [L11's own arrival, `
    + `from the atlas], goal reach-exit (${GOALS[0].exit.x},${GOALS[0].exit.y}) -> L2`);

/**
 * ⛔ THE TIMED CLEARS ARE STRIPPED — the survey's line, with the survey's
 * reason. A `persistence[].at` row is a WITNESS from the walk that recorded it.
 */
const PERSISTENCE = LATCH.persistence.filter((p) => p.at === undefined || p.at === null);

const makeRun = (persistence) => createLevelRun({
    levelSource,
    boot: BOOT,
    noclip: false,
    noHazards: [],
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

const solved = await twoPassSolve({
    makeRun,
    goals: GOALS,
    name: NAME,
    boot: BOOT,
    persistence: PERSISTENCE,
    log: (m) => console.log(m),
});
const { out } = solved;

/**
 * ⛔ THE EMITTED TAPE IS REPLAYED, and every claim below is read off THAT run.
 */
const run = makeRun(solved.persistence);
/**
 * ⛔⛔ THE BREAK IS WATCHED **DURING** THE REPLAY, NOT AFTER IT — and that is
 * `breakableRocks`' own law, not a convenience. A break is PER VISIT: the
 * run's `brokenRocks` getter reports the state for the level the run is IN, so
 * once this walk crosses to L2 the set is EMPTY and a check that read it at the
 * end would report "the rock is still there" about a room the run has left.
 */
const brokenDuring = new Set();
for (const held of out.perTick) {
    run.advance(held);
    for (const id of (run.brokenRocks ?? [])) brokenDuring.add(id);
}

const hits = run.playerHits.length;
const deaths = run.playerDeaths.length;
check(`${NAME}: ZERO hits and ZERO deaths (the standing zero-hit policy)`,
    hits === 0 && deaths === 0, `hits ${hits}, deaths ${deaths}`);

/**
 * ⛓⛓⛓ THE HEADLINE: the run BROKE THE ROCK, and it is read off the run's own
 * per-visit rock state rather than off the solver's report. `brokenRocks` is
 * one of the fourteen live-geometry families and it is what the planner
 * consults, so a run that reports the id here is a run whose corridor really
 * opened.
 */
const broken = [...brokenDuring];
check('⛓⛓⛓ `breakablerock@96,112` is GONE from the run\'s own live geometry',
    broken.includes('breakablerock@96,112'), JSON.stringify(broken));

const breakRows = out.trace.rows.filter((r) => r.strategy.verb === 'break');
check('⛓ the decision trace carries exactly ONE `break` row, naming the rock',
    breakRows.length === 1 && breakRows[0].obstacle.id === 'breakablerock@96,112',
    JSON.stringify(breakRows.map((r) => ({ verb: r.strategy.verb, id: r.obstacle.id }))));

/**
 * ⛔ AND THE WRITE THE BREAK MAKES IS RECORDED, because `endAnim` is
 * `Game.setPersistence(tag, false)` UNCONDITIONALLY. L3's rock carries
 * `tag = 0`, so the write is IN BAND — `{3,0}` — and not the out-of-band
 * arithmetic L92's `tag = -1` rocks pay. Asserted so the day a route breaks a
 * -1 rock the difference is visible rather than folded.
 */
const earned = (run.earnedClears ?? []).filter((c) => (c.by ?? '').includes('breakablerock'));
check('⛓⛓ the break EARNS a persistence clear, attributed to the rock by name',
    earned.length === 1 && earned[0].level === 3,
    JSON.stringify(run.earnedClears ?? []));

const t = run.transitions[run.transitions.length - 1];
check('the segment ends at a LEVEL ARRIVAL (§3.5), in L2',
    Boolean(t) && t.to_level === 2, JSON.stringify(run.transitions));
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
    // ⛓ A CEILING FOR THE PARSE, not the value written: `tapeJson` emits
    // `requiredTapeVersion(parsed)`, i.e. the LOWEST version this tape's own
    // fields need. Declaring the ceiling here is what lets the budget assert
    // parse it before that number exists.
    tape_version: 9,
};

const description = '⛓⛓⛓ R9 SLICE 4 — **THE ROOM THE `break` VERB OPENED.** Route-survey '
    + 'step 12 (L3 entered from L11, heading west to L2) was the survey\'s ONLY '
    + 'VERB-MISSING row: `breakablerock@96,112` is the door out of a one-cell arrival '
    + 'pocket — Stone on three sides, WATER on the fourth — and the planner\'s own '
    + 'sentence was "the two are in different connected components". The engine has '
    + 'modelled the swing since R5 slice 5 (`levelRun`\'s `BreakableRock` arm, '
    + '`rockBreaksUnder`, `hitRock`, the persistence write); what did not exist was a '
    + 'SOLVER row, so a rock press was named by OEL coordinate in a hand-written leg and '
    + 'to the live solver a rock was stone. This slice registered '
    + '`OBSTACLE_STRATEGIES[\'solid:breakablerock\'] = \'break\'` and an executor that '
    + 'derives its own stance — and the stance here is the BOOT CELL itself, which is '
    + 'why the derivation asks the live position before it sweeps the ring. Boot: '
    + 'r7-act2-11\'s committed v8 block (the campaign\'s post-sword latch) re-pointed at '
    + 'L3\'s arrival from L11, read out of the atlas — R8 slice 8\'s own construction and '
    + 'the survey\'s `staged` policy, with the committed TIMED clears stripped. ⚠ A '
    + 'staged boot is a DECLARATION, not a measured latch: this tape says "L3 is solvable '
    + 'from this declared state", and ⚖ ruling 11\'s true-start chain is what will '
    + `re-record it from a real one. Solver: ${out.perTick.length} ticks, `
    + `${out.trace.rows.length} decision(s), ${out.replans} re-plan(s), ZERO hits. `
    + 'Authored by scripts/procgen/solve-seedling-r9-l3.mjs; trace sidecar in '
    + 'fixtures/traces/.';

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

console.log(`\n## ${NAME}: ${out.perTick.length} ticks, ${hits} hit(s), ${deaths} death(s); `
    + `rock broken: ${broken.join(', ') || 'NONE'}`);
console.log('## there is NO hand answer for this room — the differential is the entire gate.');

if (CHECK) console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
