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
const { collectGoal, reachGoal } = await import(join(REPO, 'scripts/procgen/seedling-atlas-goals.mjs'));
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

const levelSource = atlasLevelSource();

/**
 * ⛓⛓⛓ R9 SLICE 7 — THE ROOMS, AND WHERE EACH NUMBER COMES FROM.
 *
 * This producer used to read `PLAYTHROUGH_CHAINS.act2-the-sword` and derive
 * both its goals and its row set from that chain's hand-authored `walk.units`.
 * ⚖ Ruling 14 retired the chain and its twelve `r7-act2-*` tapes;
 * ⚖ ruling 17 (the user: *"I want to minimize hardcoding in general"*) decides
 * what replaces it: the SAME derivation `solve-seedling-r9-campaign.mjs`
 * already used for these rooms, shared out into
 * `seedling-atlas-goals.mjs`.
 *
 * ⛓ THE SWAP IS BYTE-INERT, AND IT WAS MEASURED BEFORE IT WAS MADE: the hand
 * route's eleven goal lists and the atlas's eleven were compared coordinate for
 * coordinate and came out **IDENTICAL, 11 of 11** (§15). Nothing about what the
 * solver is asked to do has changed; the goals are now read out of the atlas
 * instead of out of a retired chain's units.
 *
 * ⛔ **THE ROOM ORDER IS A DECLARATION, NOT A DERIVATION**, and it always was —
 * `solve-seedling-r9-campaign.mjs` says the same of its own segment list. Which
 * rooms this battery covers, and which way each one is crossed, is a statement
 * about R8's playthrough. What is DERIVED is every coordinate under it.
 *
 * ⚠ SEGMENT 11 CROSSES BACK TO L10 and the campaign's `r9-solve-11` leaves by
 * `teleporter@32,0` to L3 instead. One room, two errands: this is the BATTERY's
 * room and that is the ROUTE's step 11 (§14.5).
 */
const BATTERY_ROOMS = Object.freeze({
    1: Object.freeze({ level: 0, to: 2 }),
    2: Object.freeze({ level: 2, to: 3 }),
    3: Object.freeze({ level: 3, to: 4 }),
    4: Object.freeze({ level: 4, to: 5 }),
    5: Object.freeze({ level: 5, to: 6 }),
    6: Object.freeze({ level: 6, to: 7 }),
    7: Object.freeze({ level: 7, to: 8 }),
    8: Object.freeze({ level: 8, to: 9 }),
    9: Object.freeze({ level: 9, to: 10 }),
    10: Object.freeze({ level: 10, to: 11, pickup: 'sword' }),
    11: Object.freeze({ level: 11, to: 10, pickup: 'chest' }),
});

/**
 * ⛓⛓⛓ R9 SLICE 7 — **THE CLASSIFIER RETIRED WITH THE ROUTE IT READ, AND ITS
 * ANSWER IS NOW HISTORY RATHER THAN CODE.**
 *
 * Until this slice, the split below was DERIVED: the script read
 * `act2-the-sword`'s units and excluded any segment carrying a `phases` block
 * or a mechanic outside {collect, chest}, printing `segment 4: EXCLUDED —
 * mechanic 'hold', 'shove'`, `segments 5, 6, 8: EXCLUDED — N phases block(s)`
 * and `derived battery [1, 2, 3, 7, 9, 10, 11]`. That derivation asked *"does
 * this segment's HAND walk contain choreography"* — a question about a walk
 * that no longer exists on disk, and one **no solver tape can answer**, because
 * a solver walk has no `phases` block by construction.
 *
 * ⇒ ⚖ ruling 17: the record goes to the tracked `seedling-bot.md` R9 § as a
 * table with the numbers, and the split survives here as the DECLARATION it has
 * become. It is not a derivation pretending to be one — keeping the old
 * `check()` rows against a baked table would have been a fixed point over typed
 * data asserting itself (trap 250), which is worse than an honest constant.
 *
 * Provenance: R7's hand route, read at `855a6d200` immediately before the
 * twelve tapes were deleted — segment 4 `hold` + `shove`, segments 5 and 6 one
 * `phases` block each, segment 8 two `phases` blocks + `shove`.
 */
const LEG_ONLY_ROOMS = Object.freeze([1, 2, 3, 7, 9, 10, 11]);
const CHOREOGRAPHED_ROOMS = Object.freeze({
    4: "mechanic 'hold', mechanic 'shove'",
    5: '1 phases block(s)',
    6: '1 phases block(s)',
    8: '2 phases block(s), mechanic \'shove\'',
});

for (const segNo of Object.keys(BATTERY_ROOMS).map(Number)) {
    const why = CHOREOGRAPHED_ROOMS[segNo];
    console.log(why
        ? `  segment ${segNo}: EXCLUDED — ${why} (hand choreography / slice-3 mechanics)`
        : `  segment ${segNo}: BATTERY — legs only`
            + `${BATTERY_ROOMS[segNo].pickup ? ` + [${BATTERY_ROOMS[segNo].pickup === 'sword'
                ? 'collect' : 'chest'}]` : ''}`);
}
const battery = [...LEG_ONLY_ROOMS];
console.log(`## derived battery: segments [${battery.join(', ')}] `
    + `(${battery.length} rooms)`);
/**
 * ⛔⛔ R9 SLICE 7 — **THE OLD ROW HERE WOULD NOW ASSERT A CONSTANT AGAINST
 * ITSELF, SO IT IS REPLACED RATHER THAN KEPT.**
 *
 * It read `battery.join(',') === '1,2,3,7,9,10,11'`. While `battery` was
 * DERIVED from the hand route's units that compared two things — a derivation
 * and a prediction — and a chain edit moved it. Now that the split is a
 * declaration (above), the same row would compare `LEG_ONLY_ROOMS` to a
 * transcription of `LEG_ONLY_ROOMS` and pass for as long as somebody edited
 * both, which is a fixed point over typed data (trap 250) wearing the old
 * row's words.
 *
 * ⇒ what IS still checkable is that the two declarations PARTITION the rooms:
 * every room this producer covers is classified exactly once, none forgotten
 * and none in both lists. That is a real consistency claim about data a future
 * edit can break, and it is the honest remainder of the classifier.
 */
const classified = [...LEG_ONLY_ROOMS, ...Object.keys(CHOREOGRAPHED_ROOMS).map(Number)]
    .sort((a, b) => a - b);
const allRooms = Object.keys(BATTERY_ROOMS).map(Number).sort((a, b) => a - b);
check('every battery room is classified EXACTLY once — leg-only or choreographed',
    classified.join(',') === allRooms.join(','),
    `classified [${classified.join(', ')}] vs rooms [${allRooms.join(', ')}] — a room in `
    + 'both lists or in neither is a split that stopped covering its own subject');

// ── 2. goals, derived from the ATLAS (⚖ ruling 17) ────────────────────
function goalsFor(segNo) {
    const room = BATTERY_ROOMS[segNo];
    const goals = [];
    if (room.pickup) goals.push(collectGoal(levelSource, room.level, room.pickup));
    goals.push(reachGoal(levelSource, room.level, room.to));
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
    // ⛓ R9 slice 7: `!battery.includes(...)` is still a real cross-check — it
    //   reads the OTHER declaration, so a room moved into `LEG_ONLY_ROOMS`
    //   without being taken out of `SLICE_3B_ROWS` reds here rather than
    //   silently authoring a row twice. What it no longer claims is that a
    //   classifier DERIVED the exclusion; the hand route that could answer that
    //   retired with ⚖ ruling 14, and the record moved to `seedling-bot.md`.
    check(`segment ${row.segNo} is declared choreographed, not leg-only (the hand walk's `
        + 'choreography is a fact about the hand walk, not a label)',
    !battery.includes(row.segNo) && CHOREOGRAPHED_ROOMS[row.segNo] !== undefined,
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

/**
 * ⛓⛓⛓ R9 SLICE 7 — THE STAGED BOOT IS READ FROM THE COVERING SOLVER TAPE.
 *
 * ⚖ Ruling 14's first execution deleted `r7-act2-1..11`; ⚖ ruling 17 (the
 * user, 2026-08-21: *"I want to minimize hardcoding in general"*) decides HOW
 * this script replaces the read: by DERIVATION from a surviving artifact, never
 * by a constant. Each row's staged boot now comes from its own `r8-solve-N`
 * tape on disk.
 *
 * ⛓ FOR ROWS 1, 2, 3, 4 AND 11 THE SWAP IS BYTE-INERT, AND THAT IS MEASURED,
 * not hoped. At slice 7's baseline the hand tape and its twin were compared
 * over all eleven boot-block fields — `boot`, `noclip`, `noDamage`,
 * `noHazards`, `grants`, `persistence`, `equips`, `pins`, `save`, `rng`,
 * `seam` — and came out BYTE-EQUAL for every one of those five. It is also
 * SELF-CHECKING: these are the rows this script still EMITS, so a wrong boot
 * would break the existing `is byte-identical to what this solver derives`
 * claim.
 *
 * ⛔ FOR ROWS 6, 7, 9 AND 10 THE SWAP MOVES WHAT THIS SCRIPT PRINTS, AND THE
 * MOVE IS THE POINT. Those four are HANDED OVER (⚖ ruling 11) — solved and
 * reported here, EMITTED by `solve-seedling-r9-campaign.mjs` — and slice 6
 * re-recorded their tapes from the true-start chain's MEASURED LATCHES, so
 * their boots differ from R7's hand latches in `seam`. Reading the real
 * artifact means this script now measures the walk from the boot the chain
 * actually reaches, rather than from a hand latch no file holds any more. No
 * tape moves (these rows emit nothing); the solver-vs-hand table's tick counts
 * for them do. R9 slice 7 §15 publishes the row-level diff.
 */
const committedFor = (segNo) => parseTape(JSON.parse(
    readFileSync(join(TAPES, `r8-solve-${segNo}.json`), 'utf8')));

/**
 * ⛓ THE HAND ANSWER — each retired tape's own `tick_count`, and the ONE value
 * here that is a literal, because ⚖ ruling 17 allows a constant exactly where
 * no surviving artifact carries it: **nothing on disk records how long the HAND
 * walk was.** The solver tape records the SOLVER's walk, which is a different
 * number and in five rooms a much smaller one — `r7-act2-4` was 347 ticks and
 * `r8-solve-4` is 255. Reading the count off the twin would silently rewrite
 * this script's oldest INFORMATION row into an identity (`solver == hand`,
 * always), which is the failure ruling 17 exists to prevent, not an instance of
 * it. Provenance: the `tick_count` field of `r7-act2-N.json` at `855a6d200`,
 * read immediately before the files were deleted.
 */
const HAND_TICKS = Object.freeze({
    1: 183, 2: 47, 3: 245, 4: 347, 6: 355, 7: 146, 9: 122, 10: 89, 11: 87,
});

mkdirSync(TRACES, { recursive: true });
const summary = [];
for (const row of rows) {
    const committedName = `r7-act2-${row.segNo}`;
    const committed = committedFor(row.segNo);
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
        + `${HAND_TICKS[row.segNo]} ticks. The diff is INFORMATION, not a gate — the `
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
        name: row.name, solver: out.perTick.length, hand: HAND_TICKS[row.segNo],
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
