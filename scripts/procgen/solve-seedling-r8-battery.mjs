#!/usr/bin/env node
/**
 * solve-seedling-r8-battery — the LIVE SOLVER re-solves the leg-only act2
 * rooms from staged boots. R8 slice 2, kickoff §4 slice 2 track B.
 *
 * ── THE DERIVATION (stated, then computed — never copied) ─────────────
 *
 * The battery is derived from chain `act2-the-sword`'s OWN `walk.units`:
 *
 *   1. Units are mapped to segments mechanically: a segment ends at each
 *      crossing, and a crossing is a leg with an `exit` — so walking the
 *      unit list with a counter that advances after every exit-leg assigns
 *      every unit to the segment its ticks run in (trailing units after the
 *      last exit belong to the last segment; they are the 0-tick terminal
 *      legs `synthesizeLegs` requires).
 *   2. A segment QUALIFIES iff it contains NO `phases` unit and no target
 *      mechanic outside {collect, chest}. A `phases` block is hand-authored
 *      choreography — the very thing the solver's combat/puzzle policies
 *      (slice 3) exist to replace; `hold`/`shove`/`bait`/… are mechanics
 *      whose known-answer rooms kickoff §4 slice 3 claims by name (L4, L5,
 *      L6, L8). `collect`/`chest` are the two acquisition verbs this
 *      slice's policy registers.
 *
 * Result: segments 1, 2, 3, 7, 9, 10, 11 — seven rooms. The script PRINTS
 * the derivation so the §10 statement is a copy of the computed answer.
 *
 * ── ⛔ THE WITHDRAWN EIGHTH ROW — L6, and what its recording refuted ───
 *
 * A probe-graduated `r8-solve-6` was ruled in, solved, recorded — and the
 * recording REFUTED the solve. The solve was COMBAT-BLIND (the builder's
 * default `roles` builds a pre-R5 world with no combat census — the
 * defect `solveSegment` now refuses by name), so the blind model crossed
 * a room whose sandtraps and bobs it could not see. The GAME, driven by
 * those same inputs, hit `sandtrap@64,16` at t=20, was knocked back, and
 * died twice without ever crossing — and the census-on model reproduces
 * the game's whole stream DIGIT FOR DIGIT, both deaths included. The
 * withdrawn tape/expectation/trace and the `--mobiles` body witness are
 * banked in `NewDocs/plans/r8-slice2-l6-blind-probe/` (a withdrawn
 * recording is a free oracle); L6 stays slice 3's room. Kickoff §10 has
 * the full account.
 *
 * ── WHAT THE SOLVER IS HANDED (and what it is NOT) ────────────────────
 *
 * Each row boots the COMMITTED segment tape's own v8 boot block — boot,
 * save, persistence, rng, seam, pins, verbatim (staged per §3.5: the boot
 * block is the honest declaration the seam machinery reads; the grants
 * channel is seam-invisible and stays empty). The GOALS are derived from
 * the segment's units: each exit-leg contributes `reach-exit` (the OEL
 * coordinates only), each collect/chest target contributes
 * `collect-placement` (the PLACEMENT only). ⛔ The hand-authored stance
 * coordinates, waypoints and hold ticks are NOT handed over — deriving the
 * how is the solver's whole job; the macro layer names the what.
 *
 * Run (model-side; no artifact needed):
 *   node scripts/procgen/solve-seedling-r8-battery.mjs            # write
 *   node scripts/procgen/solve-seedling-r8-battery.mjs --check    # verify byte-identical
 *
 * Then record the fixtures (the game is the only oracle) — ⛔ ALWAYS `--only=`.
 * THE SEVEN LEG-ONLY ROOMS (R8 slice 2):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-solve-1,r8-solve-2,r8-solve-3,r8-solve-7,r8-solve-9,r8-solve-10,r8-solve-11
 *
 * ⛓ THE TWO SLICE-3b ROOMS (L4 and L6) HAVE THEIR OWN LINE, and until R9 slice
 * 3 the repo carried NONE — which is how `r8-solve-4`'s drift survived three
 * reports. This script WRITES all nine rows on every non-`--check` run, so a
 * re-record that names only the drifted one is the only honest way to spend a
 * licence on it:
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-solve-4
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-solve-6
 *
 * ⛔ AND `--check` RUNS AT EVERY CLOSE (R8 §18.9 lesson 3 / trap 169). The
 * differential replays the ARTIFACT, so it cannot see that the artifact is no
 * longer a walk its producer would author. Two claims, two instruments, both
 * on the checklist. The published value is over **stdout only**:
 *   node scripts/procgen/solve-seedling-r8-battery.mjs --check 2>/dev/null | md5sum
 */

import { dirname, join } from 'node:path';
import {
    existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const TAPES = join(REPO, 'frontend', 'modules', 'seedlingDemo', 'fixtures', 'tapes');
const TRACES = join(REPO, 'frontend', 'modules', 'seedlingDemo', 'fixtures', 'traces');

const CHECK = process.argv.includes('--check');

const { parseTape, requiredTapeVersion } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { PLAYTHROUGH_CHAINS } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/playthroughWalk.js'));
const { atlasLevelSource } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelSource.js'));
const { solveSegment } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/solverBot.js'));
const { buildStagedTape } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV1.js'));
const { createRunForStaging, solveStaging, stagingFromTape } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/tapeRunner.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const chain = PLAYTHROUGH_CHAINS.find((c) => c.id === 'act2-the-sword');
const levelSource = atlasLevelSource();

// ── 1. derive the battery from the chain's own units ──────────────────
const MECHANIC_KEYS = ['hold', 'bait', 'wait', 'touch', 'equip', 'spear', 'shove',
    'kill', 'fire', 'keylock', 'collect', 'chest'];
const BATTERY_VERBS = new Set(['collect', 'chest']);

const perSegment = chain.segments.map(() => ({ units: [], phases: 0, mechanics: new Set() }));
{
    let seg = 0;
    for (const unit of chain.walk.units) {
        const s = perSegment[Math.min(seg, perSegment.length - 1)];
        s.units.push(unit);
        if (unit.phases) s.phases += 1;
        for (const target of unit.leg?.targets ?? []) {
            for (const k of MECHANIC_KEYS) if (target[k] !== undefined) s.mechanics.add(k);
        }
        if (unit.leg?.exit) seg += 1;
    }
}
const battery = [];
perSegment.forEach((s, i) => {
    const segNo = i + 1;
    const blockers = [
        ...(s.phases ? [`${s.phases} phases block(s)`] : []),
        ...[...s.mechanics].filter((m) => !BATTERY_VERBS.has(m)).map((m) => `mechanic '${m}'`),
    ];
    if (blockers.length) {
        console.log(`  segment ${segNo}: EXCLUDED — ${blockers.join(', ')} `
            + '(hand choreography / slice-3 mechanics)');
        return;
    }
    battery.push(segNo);
    console.log(`  segment ${segNo}: BATTERY — legs only`
        + `${s.mechanics.size ? ` + [${[...s.mechanics].join(', ')}]` : ''}`);
});
console.log(`## derived battery: segments [${battery.join(', ')}] `
    + `(${battery.length} rooms)`);
check('the derived battery is the seven leg-only rooms',
    battery.join(',') === '1,2,3,7,9,10,11',
    `[${battery.join(', ')}] — a change here is a chain edit or a classifier edit, `
    + 'and either moves the §10 statement');

// ── 2. goals, derived from each segment's own units ───────────────────
function goalsFor(segNo) {
    const goals = [];
    for (const unit of perSegment[segNo - 1].units) {
        if (!unit.leg) continue;
        for (const target of unit.leg.targets ?? []) {
            if (target.collect) {
                goals.push({ kind: 'collect-placement', placement: { ...target.collect.pickup } });
            }
            if (target.chest) {
                goals.push({ kind: 'collect-placement', placement: { ...target.chest.chest } });
            }
        }
        if (unit.leg.exit) goals.push({ kind: 'reach-exit', exit: { ...unit.leg.exit } });
    }
    return goals;
}

/**
 * ⛓⛓⛓ R8 SLICE 3b — THE ROOMS THE CLASSIFIER EXCLUDES, AND WHY THEY ARE
 * HERE ANYWAY.
 *
 * The derivation above excludes a segment that holds a `phases` block or a
 * mechanic outside {collect, chest} — because those are the hand
 * CHOREOGRAPHY the solver's policies exist to replace. Slice 3 registered
 * `hold`; slice 3b registers `shove` and the AVOID -> TIME -> BAIT -> KILL
 * ladder, so the policies those segments were excluded FOR now exist.
 *
 * ⛔ THE CLASSIFIER IS NOT LOOSENED, and that is deliberate. It answers
 * "does this segment's HAND walk contain choreography", which is still true
 * of these rooms and will stay true — the hand answer is not what the solver
 * runs. Loosening it would erase the record of what was hand-authored. So
 * these rows are ADDED with their exclusion ASSERTED, and the assertion is
 * what makes "the solver replaced the choreography" a claim rather than a
 * relabelling.
 *
 * ⚠ THE GOALS COME FROM THE SAME `goalsFor` — the segment's own exits and
 * collect/chest placements. A `phases` block contributes NO goal, because a
 * choreography is a HOW and the macro layer only ever names a WHAT.
 */
const SLICE_3B_ROWS = Object.freeze([
    Object.freeze({
        segNo: 4,
        why: 'L4 — `hold` (slice 3) then `shove` (⚖ §11.8a ruling 1(a): k=2, the '
            + 'minimum tiles such that a corridor plans with the block hypothesised '
            + 'there; k=1 has no corridor and k=3 is the PIT at (5,4))',
    }),
    Object.freeze({
        segNo: 6,
        why: 'L6 — the LADDER\'s proving room: AVOID has no admissible corridor with '
            + 'both bodies standing in the two cells the weave needs, TIME refuses on '
            + '`mover.MOVER_RANGE`\'s own bound, and BAIT derives the stance (56,24) — '
            + '`L6_BOB_DROWN.endsAt` in boot form — from the leash, the body-kill '
            + 'regions, `presserSafety` and reachability',
    }),
]);

const PROBE_ROWS = [];

// ── 3. solve, emit ────────────────────────────────────────────────────
/**
 * The staging block this row is solved from — the committed tape's own,
 * with the two relaxations pinned OFF.
 *
 * ⛔⛔ THE REPLAY'S OWN CENSUS, BY NAME — the slice's own defect, kept as a
 * comment because it was expensive to see: `buildLevelWorld`'s `roles`
 * defaults to `PRE_R5_ROLES`, a COMBAT-BLIND world (deliberately — every
 * R0–R4 fixture is `noDamage`), and `tapeRunner` passes the full `ROLES`
 * for an honest tape. A solver handed the default solved every battery
 * room IDENTICALLY and crossed L6 blind to both bobs, green because the
 * game's own bobs never caught it — the world the solve sensed and the
 * world the replay runs were two different worlds, invisible in every room
 * without enemies.
 *
 * ⛓ THE FIX IS NOW STRUCTURAL rather than a literal typed here (editor arc
 * slice 1). `createRunForStaging` is the ONE tape→run construction —
 * `createTapeStepper`'s own — and it derives the census from `noclip` by
 * the single `rolesForStaging` rule. `solveStaging` is what makes that
 * derivation land on the full `ROLES`: this script no longer SAYS `roles:
 * ROLES`, it declares an honest run and gets the replay's census because
 * they are the same line of code.
 */
const stagingOf = (committed) => solveStaging(stagingFromTape(committed));

/** `tapeJson` — the plan scripts' convention: serialize FROM a parsed tape. */
function tapeJson(obj, description) {
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

for (const row of SLICE_3B_ROWS) {
    check(`segment ${row.segNo} is STILL excluded by the classifier (the hand walk's `
        + 'choreography is a fact about the hand walk, not a label)',
    !battery.includes(row.segNo),
    `the solver replaces the CHOREOGRAPHY, and this row is what makes that a claim `
    + 'rather than a relabelling');
}

/**
 * ⛓⛓⛓ R9 SLICE 6 — **THE ROWS THIS SCRIPT NO LONGER AUTHORS, NAMED** (⚖ ruling
 * 11; trap 169).
 *
 * `solve-seedling-r9-campaign.mjs` re-boots these rooms from their
 * PREDECESSOR'S MEASURED LATCH — the state the running game reaches on the
 * true-start chain — while every row below is authored from `r7-act2-N`'s
 * COMMITTED STAGED BLOCK, which is a hand-chain declaration read off disk.
 * Those are two different derivations of one file, and two producers writing
 * one tape is trap 169's birthplace. ⇒ ownership MOVES; it is not shared.
 *
 * ⛔ THE DERIVATION ABOVE IS UNTOUCHED, and that is deliberate. `battery` still
 * answers "which of `act2-the-sword`'s segments are leg-only", which is a claim
 * about the HAND CHAIN and stays true; what changed is who writes the artifact.
 * Filtering the derivation instead would erase the record of what was derived.
 *
 * ⚠ A ROW HERE IS STILL SOLVED AND STILL REPORTED — the solver-vs-hand table at
 * the bottom keeps its line — it is simply not EMITTED. A handover that also
 * stopped measuring would make "the campaign owns it" and "nobody checks it"
 * print the same thing.
 */
const HANDED_TO_CAMPAIGN = Object.freeze({
    6: 'r9-campaign segment 6 — booted from r8-solve-5\'s measured latch',
    7: 'r9-campaign segment 7 — booted from r8-solve-6\'s measured latch',
    9: 'r9-campaign segment 9 — booted from r8-solve-8\'s measured latch',
    10: 'r9-campaign segment 10 — booted from r8-solve-9\'s measured latch',
});

const rows = [
    ...battery.map((segNo) => ({
        segNo, name: `r8-solve-${segNo}`, goals: goalsFor(segNo), provenance: null,
    })),
    ...SLICE_3B_ROWS.map((r) => ({
        segNo: r.segNo, name: `r8-solve-${r.segNo}`, goals: goalsFor(r.segNo),
        provenance: null, slice3b: r.why,
    })),
    ...PROBE_ROWS,
].map((r) => ({ ...r, handedOver: HANDED_TO_CAMPAIGN[r.segNo] ?? null }));

for (const [segNo, why] of Object.entries(HANDED_TO_CAMPAIGN)) {
    console.log(`  segment ${segNo}: HANDED OVER to `
        + `scripts/procgen/solve-seedling-r9-campaign.mjs — ${why}`);
}
check(`the handover names ${Object.keys(HANDED_TO_CAMPAIGN).length} row(s) this script `
    + 'still SOLVES and no longer EMITS',
rows.filter((r) => r.handedOver).length === Object.keys(HANDED_TO_CAMPAIGN).length,
`[${rows.filter((r) => r.handedOver).map((r) => r.name).join(', ')}] — `
+ 'one producer per tape (trap 169)');

mkdirSync(TRACES, { recursive: true });
const summary = [];
for (const row of rows) {
    const committedName = `r7-act2-${row.segNo}`;
    const committed = parseTape(JSON.parse(
        readFileSync(join(TAPES, `${committedName}.json`), 'utf8')));
    const staging = stagingOf(committed);
    const run = createRunForStaging(staging, levelSource);
    const out = solveSegment({
        run, goals: row.goals, name: row.name, boot: committed.boot,
    });
    const hits = run.playerHits.length;
    const deaths = run.playerDeaths.length;
    check(`${row.name}: ZERO hits and ZERO deaths (the standing zero-hit policy)`,
        hits === 0 && deaths === 0, `hits ${hits}, deaths ${deaths}`);
    // The span fold is `buildTape`'s — the ONE fold, shared with every
    // driver-emitted tape (trap 115: `keysToSpans` drops non-mover keys) —
    // and the v8 HEADER around it is `buildStagedTape`'s, which is the same
    // assembly the editor page emits. Two assemblies of one tape shape
    // would agree until one of them learned a field.
    const tape = buildStagedTape({ staging, perTick: out.perTick, name: row.name });
    const description = `⛓ R8 SLICE ${row.slice3b ? '3b' : '2'} — THE LIVE SOLVER's own solution to `
        + `${row.provenance ? 'L6 (probe-graduated)' : `battery segment ${row.segNo}`}, `
        + `from ${committedName}'s committed v8 boot block (staged per kickoff §3.5). `
        + `GOALS derived from the chain's own units: ${row.goals.map((g) => g.kind
            + (g.exit ? `(${g.exit.x},${g.exit.y})` : `(${g.placement.x},${g.placement.y})`))
            .join(' then ')} — the hand-authored stances/waypoints were NOT handed over. `
        + `Solver: ${out.perTick.length} ticks, ${out.trace.rows.length} decision(s), `
        + `${out.replans} re-plan(s); hand answer ${committedName}: `
        + `${committed.tick_count} ticks. The diff is INFORMATION, not a gate — the `
        + 'differential is the gate. '
        + `${row.slice3b ? `⛓ ${row.slice3b}. ` : ''}`
        + `${row.provenance ?? ''}`
        + 'Authored by scripts/procgen/solve-seedling-r8-battery.mjs; trace sidecar in '
        + 'fixtures/traces/.';
    if (row.handedOver) {
        console.log(`   ⛓ ${row.name}: SOLVED (${out.perTick.length} ticks) and NOT `
            + `EMITTED — ${row.handedOver}`);
    } else {
        emit(join(TAPES, `${row.name}.json`), tapeJson(tape, description), row.name);
        emit(join(TRACES, `${row.name}.trace.json`),
            `${JSON.stringify(out.trace, null, 4)}\n`, `${row.name} trace`);
    }
    summary.push({
        name: row.name, solver: out.perTick.length, hand: committed.tick_count,
        rows: out.trace.rows.length, replans: out.replans,
        probe: Boolean(row.provenance),
    });
}

console.log('\n## solver vs hand, tick for tick (INFORMATION, not a gate)');
for (const s of summary) {
    const d = s.solver - s.hand;
    console.log(`  ${s.name.padEnd(14)} solver ${String(s.solver).padStart(4)} | `
        + `hand ${String(s.hand).padStart(4)} | ${d === 0 ? '==' : (d > 0 ? `+${d}` : d)}`
        + `${s.probe ? '  (probe-graduated; hand = the bait choreography)' : ''}`);
}

if (CHECK) {
    console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
    process.exit(failures ? 1 : 0);
}
