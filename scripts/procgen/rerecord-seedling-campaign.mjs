#!/usr/bin/env node
/**
 * rerecord-seedling-campaign — **ONE COMMAND THAT RE-DERIVES EVERY BOOT OF
 * EVERY MULTI-SEGMENT CHAIN FROM THE GAME, IN CHAIN ORDER, WRITES EXACTLY THE
 * PREDICTED SET, RECORDS ONCE, AND PROVES THE CHAINS PLAY.**
 * ⚖ Ruling 21 (user, 2026-08-21: *"a way to streamline the process of
 * re-recording the whole campaign chain from the solver"*), R9 slice 9.
 *
 * ── WHAT IT IS FOR, AND WHAT ITS FIRST RUN COST ───────────────────────
 *
 * Ruling 11 made the campaign a chain of SOLVER recordings, each booting its
 * predecessor's MEASURED latch. Every change that moves a walk — the
 * shortening design, `facingToward`, a new goal type, a new room — moves every
 * boot downstream of it, and doing that by hand is how a stale field survives.
 * This is that job as one resumable, cached, per-step-flushing command.
 *
 * ⛔⛔⛔ THE DEFECT IT WAS BUILT AROUND DOES NOT EXIST, AND SAYING SO IS PART
 * OF THE INSTRUMENT. Slice 9 was sent to find why slice 6's measured latch
 * "did not land" in `r8-solve-6`'s `rng`. It did land: all eleven of slice 6's
 * cached latches carry exactly their successor's committed seed, the artifact
 * driven is game-identical to the artifact committed, and the GAME reproduces
 * both today (`r8-solve-4` -> 1726967612, `r8-solve-5` -> 514746467, fresh
 * page, cache bypassed).
 *
 * ⛓⛓⛓ WHAT THE CAMPAIGN CHAIN'S `boundary 5/15` REFUSAL ACTUALLY WAS —
 * MEASURED, AND NOW FIXED AT ITS SOURCE (⚖ ruling 23): `Bot.as:1587` applies a
 * tape's declared persistence clears BEFORE the world is built, and says why
 * in its own comment — "applying a clear after the world exists would leave
 * the blocker standing for this visit". `gameVisibleTape` used to hand the
 * game a TIMED row with only its `at` removed. On a FRESH page that meant the
 * gated body never spawned; on a CONTINUATION, whose room the game had already
 * built at the previous boundary, it meant the body stood. One tape, two
 * worlds. `r8-solve-5` walks its 558 inputs to 514746467 with the row and
 * 1196897329 without — the second being the live value the wasm CAMPAIGN arm
 * had refused since slice 7b, with everything else identical.
 *
 * ⇒ the projection now withholds a timed row on EVERY path, the game earns the
 * clear by play, and THIS pipeline's first run is the licence to re-record the
 * boots that moved as a result.
 *
 * ── THE LAWS ──────────────────────────────────────────────────────────
 *
 *  · EVERY boot field comes from the MEASUREMENT. A field the envelope does
 *    not carry is a REFUSAL BY NAME, never a carry-over from the committed
 *    block (`rerecordCampaign.bootFromEnvelopeOnly`). The committed block is
 *    read only to DIFF against, and every compared field is printed — moved
 *    or not, because a diff that printed only movers cannot tell "unchanged"
 *    from "not compared".
 *  · THE SEALED TABLE IS THE LICENCE — a PERMISSION, not a forecast. S0 says,
 *    offline and per segment, `none` / `boot-only` / `walk-moves`: what that
 *    segment MAY move. S2 writes only what the table permits; a segment whose
 *    bytes would move and is not on it is a refusal naming the block. A
 *    `walk-moves` verdict is a STOP — that licence is the user's. ⛔ Because
 *    the verdict is a function of the TAPES it reads the same before and after
 *    a run, so it is NOT the idempotence claim: that one is S1 measuring zero
 *    movers, which costs a browser.
 *  · THE CACHE IS KEYED ON THE BYTES THE GAME **READS** (R9 P1, ⚖ 54 (4)) —
 *    `gameVisibleTape` minus the fields no consumer of the shipped bytes can
 *    read, which is exactly `description` today. It used to be the COMPLETE
 *    bytes, and that threw away answers the GPU had already paid for: the
 *    difference is `tick0`, which S2 re-derives AFTER S1 has driven and which
 *    is never in the bytes shipped. See `provisionalLatch.js`.
 *  · RESUMABLE. Each stage writes its state to the run directory with a
 *    `finished` flag, and `--from=`/`--to=` re-enter at a stage boundary.
 *
 * ── ⚖ RULING 43 — CHANGES TO EXISTING TAPES, NOT ONLY GROWTH ──────────
 *
 * S0's sealed table used to permit `none` / `boot-only` only, and treated
 * `walk-moves` as a STOP **against a verdict nothing measured** — it asserted
 * no segment was PREDICTED to move its walk, which is true of a prediction
 * nobody made. S0 now MEASURES it, out of the producers' own `--check`
 * re-solves (`walkMoves.js`, `walkReport.js`), and `--license-walks=<ruling-id>`
 * turns the measured STOP into a permission for EXACTLY the measured set:
 * refused by name without an id, never widening (the set IS the measurement),
 * with every successor of a moved walk cascaded to `boot-only` and the ruling
 * printed by S5. The licence is SPENT at the top of S1, where the moved
 * segments' own producers re-author them — a walk lives in `inputs`, which
 * S2's surgical BOOT writes cannot touch.
 *
 * ── STAGES ────────────────────────────────────────────────────────────
 *   S0 PREDICT  offline; the sealed table + the MEASURED walk moves.
 *               `--dry-run` stops here.
 *   S1 MEASURE  the licence is spent (the producers re-author), then chain
 *               order, fresh page per segment + a zero-tick run per
 *               segment; every boot field from the envelope.
 *   S2 WRITE    surgical text edits of exactly the predicted set.
 *   S3 RECORD   ONE `--win --record --only=<set>`; the producers' `--check`.
 *   S4 PROVE    the JS sequence gate · the wasm chain arms · the census.
 *   S5 REPORT   the sealed table with its measured column.
 *
 * ⛔⛔ **S4 IS THE GATE RUN; DO NOT RUN SHIP/ROSTER STANDALONE AFTER A RECORD.**
 * ⚖ Ruling 32 E. R9 slice 11 re-ran by hand the gates S4 had just run and paid
 * ~30 minutes for a second opinion nobody had asked for — and one of those
 * duplicate runs produced the unexplained red that cost another 40 (§21.9).
 * After this pipeline completes, S4's verdicts ARE the slice's gate row; the
 * only reason to drive ship or the roster again is a change made AFTER it.
 *
 * Run:
 *   node scripts/procgen/rerecord-seedling-campaign.mjs --dry-run
 *   node scripts/procgen/rerecord-seedling-campaign.mjs            # S0..S5
 *   node scripts/procgen/rerecord-seedling-campaign.mjs --from=S2
 *   node scripts/procgen/rerecord-seedling-campaign.mjs --to=S1 --no-cache
 *   node scripts/procgen/rerecord-seedling-campaign.mjs --license-walks=<ruling-id>
 *
 * The browser stages need Windows Chrome and a dev server on :8000.
 */

import {
    existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    accountingUniverse, bootFromEnvelopeOnly, chainSubjects, mergePersistence,
    movedProjections, projectionIndex, timedClearHazard,
} from './rerecordCampaign.js';
import {
    CHECK_FLAG, LICENSE_FLAG, applyLicence, cascadeFrom, licenceFrom, movedSegments,
    nominateOwners, participationOf, producerOrder, reportRows,
} from './walkMoves.js';
import {
    BRANCH_FLAG, DRIVE_FLAG, PROVISIONAL_FLAG, TABLE_FLAG,
    certifyAgainstLatch, certificationCell, latchCacheCandidates, latchCell,
    renderTableMarkdown,
} from './provisionalLatch.js';
import { buildInstruments } from './reference/instruments.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
/**
 * ⛓ THE CODE ROOT — always this tree's, never a rehearsal's. The four modules
 * below are pure functions of their arguments and the rehearsal WANTS them:
 * a fake `segmentBootFromLatch` would rehearse nothing. Only the ROSTER moves
 * (`ctx.tapesDir`); see `buildContext`.
 */
const MODULE = join(ROOT, 'frontend/modules/seedlingDemo');

const STAGES = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];
const arg = (name, dflt) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? dflt : hit.slice(name.length + 3);
};
const DRY_RUN = process.argv.includes('--dry-run');
/** ⚖ Ruling 38 (2), R9 slice 12d — the growth command. See `grow()` below. */
const GROW = process.argv.includes('--grow');
const NO_CACHE = process.argv.includes('--no-cache');
/**
 * ⚖ Ruling 43, R9 slice 12c′ — **THE WALK LICENCE.** Parsed BEFORE any stage
 * runs, because a bare `--license-walks` must refuse with nothing written; see
 * `walkMoves.licenceFrom`. `process.argv` is read here rather than only inside
 * that module so the instruments index's argv scan can see the flag.
 */
const LICENSE_TOKEN = process.argv.find((a) => a === '--license-walks'
    || a.startsWith('--license-walks='));
let LICENCE = null;
try {
    LICENCE = licenceFrom(LICENSE_TOKEN === undefined ? [] : [LICENSE_TOKEN]);
} catch (e) {
    console.log(`FAIL: ${e.message}`);
    process.exit(1);
}
/**
 * ⛔⛔ **THIS IS A PIPELINE, NOT A PRODUCER, AND `--check` MUST SAY SO OUT
 * LOUD.** It ignores unknown flags, so a caller who hands it `--check`
 * expecting a read-only verdict gets S0..S5: browser stages, GPU, and writes.
 * That is not hypothetical — `standingValues.producerScripts` scans this
 * directory for that flag's own LITERAL SPELLING and added a row for this file the
 * moment S0's walk measurement started shelling out with it, which then RAN
 * the whole pipeline inside a baseline measurement. The flag name lives in
 * `walkMoves.js` (a `.js`, outside that scan) so this refusal cannot re-arm
 * the row it exists to explain.
 */
if (process.argv.includes(CHECK_FLAG)) {
    console.log(`FAIL: rerecord-seedling-campaign has no ${CHECK_FLAG}. It is the RE-RECORD `
        + 'PIPELINE (S0..S5) — it MEASURES with a browser and WRITES tapes, and it ignores '
        + 'unknown flags, so running it as if it were a producer would drive the GPU and '
        + 'move artifacts. Use `--dry-run` for the offline S0 verdict, or `--to=S0`.');
    process.exit(1);
}
/**
 * ⛓⛓⛓ R9 P1, ⚖ 54 (1)/(2)/(3) — **THE READ-ONLY MODES.** Each answers a
 * question about the pipeline's SUBJECT without running the pipeline, and each
 * exits before S0. They are parsed here, beside the licence, for the same
 * reason: `process.argv` is read in this file so the instruments index's argv
 * scan can see the flags an instrument accepts.
 *
 * ⛔ A BARE `--latch-provisional` IS A REFUSAL, not a default over every
 * segment: driving "everything" is the shape that spent three runs' worth of
 * GPU before the game disagreed with the first row.
 */
/**
 * ⛔⛔ THE LITERALS ARE SPELLED HERE, AND THE ASSERTION IS WHY THAT IS NOT A
 * SECOND SOURCE OF TRUTH (⚖ 17). `instruments.mjs` derives an instrument's
 * flags by scanning its OWN source for a `--x` literal near a read of `argv`,
 * so a flag parsed only through an imported constant is one the reference
 * table omits — measured: the first build of this block published `--branch`
 * and NOT `--latch-provisional`, `--table` or `--drive`. `--license-walks`
 * above already spells its literal for exactly this reason and says so; this
 * adds the row that keeps the two from drifting apart.
 */
const PROVISIONAL_TOKEN = process.argv.find((a) => a === '--latch-provisional'
    || a.startsWith('--latch-provisional='));
const TABLE = process.argv.includes('--table');
const DRIVE = process.argv.includes('--drive');
const BRANCH = arg('branch', null);
for (const [literal, constant, where] of [
    ['--latch-provisional', PROVISIONAL_FLAG, 'PROVISIONAL_FLAG'],
    ['--table', TABLE_FLAG, 'TABLE_FLAG'],
    ['--drive', DRIVE_FLAG, 'DRIVE_FLAG'],
    ['--branch', BRANCH_FLAG, 'BRANCH_FLAG'],
]) {
    if (literal !== constant) {
        console.log(`FAIL: this file parses \`${literal}\` and provisionalLatch.${where} is `
            + `\`${constant}\` — the spelling the reference table publishes and the spelling `
            + 'the command accepts have come apart.');
        process.exit(1);
    }
}
/** The read-only modes actually asked for — the header names them. */
const READ_ONLY = [
    PROVISIONAL_TOKEN !== undefined ? PROVISIONAL_FLAG : null,
    TABLE ? TABLE_FLAG : null,
].filter(Boolean);

const FROM = arg('from', 'S0');
const TO = DRY_RUN ? 'S0' : arg('to', 'S5');
const RUN_DIR = arg('run-dir', join(process.env.TMPDIR || '/tmp',
    `rerecord-seedling-campaign`));
if (!STAGES.includes(FROM) || !STAGES.includes(TO)) {
    console.log(`FAIL: --from/--to must name a stage (${STAGES.join(', ')})`);
    process.exit(1);
}
const wants = (s) => STAGES.indexOf(s) >= STAGES.indexOf(FROM)
    && STAGES.indexOf(s) <= STAGES.indexOf(TO);

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};
/** ⛓ 7b's flush rule: a stage's state hits the disk the moment it exists. */
const flush = (ctx, stage, state) => {
    writeFileSync(join(ctx.runDir, `${stage}.json`),
        `${JSON.stringify({ finished: true, ...state }, null, 2)}\n`);
};
const resume = (ctx, stage) => {
    const p = join(ctx.runDir, `${stage}.json`);
    if (!existsSync(p)) {
        throw new Error(`⛔ ${stage} has no state in ${ctx.runDir}. A stage entered with `
            + `--from=${FROM} needs its predecessor's flushed state; run the earlier `
            + 'stage or point --run-dir at the run that produced it.');
    }
    const s = JSON.parse(readFileSync(p, 'utf8'));
    if (!s.finished) throw new Error(`⛔ ${stage}'s state is not marked finished`);
    return s;
};

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ R9 P1b, ⚖ 54 (3) — **THE INJECTION SEAM: ONE `context`, BUILT AT THE
 * TOP FROM ARGV, HANDED TO EVERY STAGE.**
 * ══════════════════════════════════════════════════════════════════════ */
/**
 * ⛔⛔ WHY A PIPELINE THAT SPENDS A GPU NEEDS ONE. Three re-record attempts
 * STOPPED after the browser had already been driven, on defects that are pure
 * bookkeeping — a producer order taken from the FILE SYSTEM (§35.4 item 4), a
 * guard reading the GLOBAL failure counter (§35.4 item 5, twice), a record set
 * taken from `s2.wrote` instead of the projection diff (§33.4 item 4). Every
 * one of those is decidable offline against a FAKE tree, and none of them was,
 * because this file resolved its whole subject from its own location: the
 * roster it reads, the chains it enumerates, the producers it shells and the
 * Windows driver it spends. ⇒ every one of those becomes a FIELD here, with
 * TODAY'S VALUE as the default, so the real pipeline is unchanged and a
 * rehearsal is possible at all.
 *
 * ⛓ WHAT MOVES IN A REHEARSAL, AND WHAT DELIBERATELY DOES NOT:
 *
 *   MOVES     `tapesDir` · `chains` · `instrumentRows` · `scriptPath` ·
 *             `exec` · `driveLatch` · `runDir` · `cacheDir`
 *   DOES NOT  `parseTape`/`gameVisibleTape`, `segmentBootFromLatch`/
 *             `seamLatchFindings`, `rngPostureForBootLevel`/`atlasLevelSource`
 *             — the rehearsal's whole point is to run the REAL ones; a fake
 *             `segmentBootFromLatch` would rehearse nothing. They are fields
 *             so the context is built in ONE place, not so they can be faked.
 *
 * ⛔⛔ `playthroughWalk.js` IS TAKEN AS DATA, NOT AS AN IMPORT, and that is
 * forced rather than chosen: it `loadTape`s every declared segment AT MODULE
 * SCOPE (§26.7) through `fixtures/index.js`'s own hard-wired `TAPES_DIR`,
 * which no context can redirect. Importing it under a fake roster would read
 * the REAL one; so `chains` is a value, and a rehearsal never imports that
 * module at all. (Teaching `fixtures/index.js` a tapes root would move a
 * production module for a test-only reason — a ⚖ 40 event, refused.)
 *
 * ⚠ AND ONE SEAM §39.12's TABLE DID NOT NAME: `reference/instruments.mjs`.
 * `participationOf` keys the instruments scan's rows by producer FILE NAME, so
 * a fake producer is *"not in the instruments index at all"* and every fake
 * segment comes back `unmeasured` — the walk measurement would rehearse
 * nothing. It is LAZY (a memoised provider) because the real default scans the
 * whole directory and all 18 docs, and `--latch-provisional` does not need it.
 */
async function buildContext(overrides = {}) {
    const root = overrides.root ?? ROOT;
    const moduleDir = overrides.moduleDir ?? MODULE;
    const tapesDir = overrides.tapesDir ?? join(moduleDir, 'fixtures/tapes');
    const tape = overrides.tapeFormat ?? await import(join(MODULE, 'tapeFormat.js'));
    const acceptance = overrides.acceptance ?? await import(join(MODULE, 'r7Acceptance.js'));
    const posture = overrides.posture ?? await import(join(MODULE, 'seamPosture.js'));
    const levels = overrides.levels ?? await import(join(MODULE, 'levelSource.js'));
    const chains = overrides.chains
        ?? (await import(join(MODULE, 'playthroughWalk.js'))).PLAYTHROUGH_CHAINS;
    let instrumentRowsCache = overrides.instrumentRows ?? null;

    const ctx = {
        root,
        moduleDir,
        tapesDir,
        runDir: overrides.runDir ?? RUN_DIR,
        cacheDir: overrides.cacheDir ?? CACHE,
        noCache: overrides.noCache ?? NO_CACHE,
        chains,
        parseTape: tape.parseTape,
        gameVisibleTape: tape.gameVisibleTape,
        segmentBootFromLatch: acceptance.segmentBootFromLatch,
        seamLatchFindings: acceptance.seamLatchFindings,
        rngPostureForBootLevel: posture.rngPostureForBootLevel,
        atlasLevelSource: levels.atlasLevelSource,
        /**
         * ⛓ WHERE A NAMED SCRIPT LIVES. Both the producers (`measureWalks`,
         * `spendWalkLicence`) and every `shell()` stage resolve through this
         * one function, so a rehearsal substitutes STUBS without either call
         * site learning that it might be rehearsing.
         */
        scriptPath: overrides.scriptPath ?? ((file) => `scripts/procgen/${file}`),
        /** The process runner — `execFileSync` today, and its exact options. */
        exec: overrides.exec ?? ((cmd, args, opts) => execFileSync(cmd, args, opts)),
        /** Filled below: it closes over `ctx` itself. */
        driveLatch: null,
        async instrumentRows() {
            if (instrumentRowsCache === null) {
                instrumentRowsCache = (await buildInstruments()).rows;
            }
            return instrumentRowsCache;
        },
    };

    ctx.textOf = (label) => readFileSync(join(ctx.tapesDir, `${label}.json`), 'utf8');
    ctx.rawOf = (label) => JSON.parse(ctx.textOf(label));
    ctx.tapeOf = (label) => ctx.parseTape(ctx.rawOf(label));
    /**
     * ⛓ EVERY TAPE ON DISK, derived from the directory — not the chain lists.
     * S3's record set is a question about ARTIFACTS, and a tape this pipeline
     * authors no boot for (`r8-solve-20`, the `r8-d2` headline) still has an
     * expectation that goes stale when its producer re-authors it.
     */
    ctx.allTapeLabels = () => readdirSync(ctx.tapesDir)
        .filter((f) => f.endsWith('.json') && f !== 'index.json')
        .map((f) => f.slice(0, -5)).sort();
    /** The bytes the GAME is handed — `driveLatch`'s own projection, one spelling. */
    ctx.gameVisibleTextOf = (label) => JSON.stringify(ctx.gameVisibleTape(ctx.tapeOf(label)));
    ctx.driveLatch = overrides.driveLatch
        ?? ((label, completeTape) => windowsDriveLatch(ctx, label, completeTape));

    mkdirSync(ctx.runDir, { recursive: true });
    return ctx;
}

// ── S0 · PREDICT ──────────────────────────────────────────────────────
/**
 * ⛓ THE SUBJECT IS EVERY MULTI-SEGMENT CHAIN, derived from
 * `PLAYTHROUGH_CHAINS`. `chainSubjects` labels the ones that are CUSTODY
 * chains from a TRUE START — the shape ruling 11 asked for — but a STAGED
 * chain's later segments still boot their predecessors' latches, so their
 * boots are re-derived here too. ⛔ Nothing is typed.
 */
function subjects(ctx) {
    const custody = new Set(chainSubjects(ctx.chains, ctx.tapeOf).map((c) => c.id));
    return ctx.chains
        .filter((c) => (c.segments ?? []).length >= 2)
        .map((c) => ({
            id: c.id,
            kind: c.kind ?? 'custody',
            trueStartCustody: custody.has(c.id),
            segments: c.segments.slice(),
        }));
}

/**
 * ⛓⛓⛓ R9 SLICE 12e′ — **WHO THE WALK MEASUREMENT MUST ACCOUNT FOR, which is
 * NOT the same list as whose boots it re-derives.** See
 * `rerecordCampaign.accountingUniverse` for the defect that taught the
 * difference: `r8-solve-11`'s walk move was reported by its own producer and
 * dropped, because its chain has one segment and `subjects()` — correctly, for
 * ITS question — does not enumerate it.
 *
 * ⛔ A one-segment chain still authors no boot and reaches neither S1's
 * boundaries nor S2's writes. It is here so a walk move in it is a ROW the
 * licence can cover, and so a segment nobody can measure is NAMED.
 */
function accountingChains(ctx) {
    const subject = new Map(subjects(ctx).map((c) => [c.id, c]));
    return accountingUniverse(ctx.chains).map((c) => ({
        id: c.id,
        kind: subject.get(c.id)?.kind ?? (ctx.chains.find((x) => x.id === c.id)?.kind
            ?? 'custody'),
        trueStartCustody: subject.get(c.id)?.trueStartCustody ?? false,
        segments: c.segments.slice(),
        /**
         * ⛓ R9 12e′ RE-RUN — the chain's HEADLINE, when it is a tape no chain
         * claims as a segment (§33.4 item 2). `accountingUniverse` decides
         * that; nothing here re-asks it.
         */
        headline: c.headline ?? null,
    }));
}

/**
 * ⛓⛓⛓ R9 SLICE 12c′, ⚖ RULING 43 — **THE WALK MOVES, MEASURED OUT OF THE
 * PRODUCERS.**
 *
 * Each participating producer is run ONCE with `--check --walk-report=<path>`;
 * its report says, segment by segment, whether today's solve differs from the
 * committed tape and IN WHICH FIELD. See `walkMoves.js` for the three filters
 * and their calibration, and `walkReport.js` for why `inputs` — not bytes —
 * is what decides.
 *
 * ⛔⛔ **A NON-ZERO EXIT IS THE EXPECTED CASE, NOT A FAILURE.** A producer
 * whose walk moved FAILS its own byte check and exits 1 — that is the very
 * event this is measuring. So the verdict is keyed on THE REPORT FILE
 * EXISTING AND PARSING, not on the exit code, and a producer that produced no
 * report is a STOP naming it and its log. "It disagreed" and "it crashed" must
 * not print the same thing.
 *
 * ⛔ AND IT IS OFFLINE. Only producers the instruments scan says read
 * `--walk-report` participate, and the one nominated producer that drives a
 * browser is named `unmeasured` with that mechanism as its reason — S0's own
 * contract is "offline, no browser", and §26.6's law is that a scratch tree
 * cannot run a browser stage at all.
 */
async function measureWalks(ctx, chains) {
    const nominated = nominateOwners(chains, { tapesDir: ctx.tapesDir });
    const participation = participationOf([...nominated.keys()],
        { instrumentRows: await ctx.instrumentRows() });
    console.log('\n## THE WALK MEASUREMENT — the producers, and what each may answer');
    const reports = [];
    const owners = [];
    const crashed = [];
    for (const p of participation) {
        const nominatedBy = nominated.get(p.file) ?? [];
        if (!p.participates) {
            console.log(`   ${'—'.padEnd(6)} ${p.file.padEnd(32)} UNMEASURED — ${p.why}`);
            continue;
        }
        const out = join(ctx.runDir, `walk-${p.file.replace(/\.mjs$/, '')}.json`);
        if (existsSync(out)) unlinkSync(out);
        const t0 = Date.now();
        let status = 0;
        let log = '';
        try {
            log = ctx.exec('node', [ctx.scriptPath(p.file), CHECK_FLAG,
                `--walk-report=${out}`],
            { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
                maxBuffer: 256 * 1024 * 1024 });
        } catch (e) {
            status = e.status ?? -1;
            log = [e.stdout, e.stderr].filter(Boolean).join('\n');
        }
        const ms = Date.now() - t0;
        const logFile = join(ctx.runDir, `walk-${p.file.replace(/\.mjs$/, '')}.log`);
        writeFileSync(logFile, `$ node ${ctx.scriptPath(p.file)} ${CHECK_FLAG} `
            + `--walk-report=${out}\n${log}`);
        if (!existsSync(out)) {
            crashed.push(`${p.file} produced NO walk report (exit ${status}) — it did not `
                + `disagree, it did not run. Read ${logFile}`);
            console.log(`   ${'FAIL'.padEnd(6)} ${p.file.padEnd(32)} no report, exit ${status}`);
            continue;
        }
        const report = JSON.parse(readFileSync(out, 'utf8'));
        reports.push(report);
        /**
         * ⛔ THE CALIBRATION IS BY NAME, NOT BY COUNT (trap 578, and the
         * count-as-proxy trap beside it): a producer that reported the RIGHT
         * NUMBER of the WRONG segments would satisfy an arithmetic and mean
         * nothing. What is checked is that every segment which NOMINATED this
         * producer is in the report it wrote.
         */
        const missing = nominatedBy.filter((s) => !report.segments.some((x) => x.segment === s));
        owners.push({ file: p.file, ms, exit: status, nominated: nominatedBy.length,
            reported: report.segments.length, missing });
        console.log(`   ${'ok'.padEnd(6)} ${p.file.padEnd(32)} `
            + `${String(report.segments.length).padStart(2)} segment(s) reported, `
            + `${nominatedBy.length} nominated, ${(ms / 1000).toFixed(1)}s, exit ${status}`);
    }
    const { rows, unmeasured, stops } = reportRows(reports, chains,
        participation.filter((p) => !p.participates), nominated);
    const moved = movedSegments(rows);
    const cascade = cascadeFrom(chains, moved);
    return { rows, unmeasured, stops: [...stops, ...crashed], moved, cascade, owners,
        participation };
}

async function predict(ctx) {
    console.log('# S0 · PREDICT — offline, no browser\n');
    /**
     * ⛓ TWO LISTS, TWO QUESTIONS (R9 12e′). `subjects()` is whose BOOTS are
     * re-derived — multi-segment chains, because a one-segment chain has no
     * boundary. `accountingChains()` is who the WALK MEASUREMENT must account
     * for — every chain, deduplicated — because a producer can report a walk
     * move in a chain this pipeline authors no boot for, and dropping it is
     * how `r8-solve-11` went unnoticed (§33).
     */
    const chains = accountingChains(ctx);
    const bootSubjects = new Set(subjects(ctx).map((c) => c.id));
    check('⛓ the subject is DERIVED from PLAYTHROUGH_CHAINS',
        chains.length > 0,
        chains.map((c) => `${c.id}(${c.segments.length}${c.trueStartCustody
            ? ', true-start custody' : `, ${c.kind}`}${bootSubjects.has(c.id) ? ''
            : ', walk-accounting only'})`).join(' · '));

    const table = [];
    for (const chain of chains) {
        /**
         * ⛔⛔ THE PREDICTION RULE, AND IT IS A CONSEQUENCE OF ⚖ RULING 23
         * RATHER THAN A GUESS. The projection now withholds a TIMED clear from
         * the game on every path, so a segment that declares one for its OWN
         * boot room is driven against a world that HAS the gated body where it
         * used to be driven against one that did not. Its fresh-page exit is
         * therefore re-measured — and from the FIRST such segment onward every
         * successor's boot is that new exit, so the whole tail of the chain is
         * `boot-only`.
         *
         * ⛔ A segment BEFORE the first one is `none`: nothing upstream moved.
         * ⛔ `walk-moves` is never PREDICTED. The model never simulated the
         * gated body, so no input changes; if S1 measures a walk move it is a
         * STOP and a finding, not a licence.
         */
        let firstHazard = -1;
        const rows = chain.segments.map((name, i) => {
            const t = ctx.tapeOf(name);
            const hazard = timedClearHazard(t, i);
            const ownTimed = hazard.ownRoom.length > 0;
            if (ownTimed && firstHazard === -1) firstHazard = i;
            return { name, i, t, hazard, ownTimed };
        });
        for (const r of rows) {
            const posture = ctx.rngPostureForBootLevel(r.t.boot.level, ctx.atlasLevelSource());
            const bootMoves = firstHazard !== -1 && r.i > firstHazard;
            const tick0Moves = bootMoves || r.ownTimed;
            table.push({
                chain: chain.id,
                segment: r.name,
                role: 'segment',
                index: r.i,
                bootLevel: r.t.boot.level,
                committed: {
                    rngSeed: r.t.rng?.seed ?? null,
                    rngFp: r.t.rng?.fp ?? null,
                    seamTime: r.t.seam?.time ?? null,
                    tick0Seed: r.t.tick0?.rng?.seed ?? null,
                },
                ownRoomTimedClears: r.hazard.ownRoom,
                continuationHazard: r.hazard.atRisk,
                posture: { comparable: posture.comparable, verdict: posture.verdict },
                verdict: bootMoves ? 'boot-only' : 'none',
                tick0Rederived: tick0Moves,
                why: bootMoves
                    ? `downstream of ${chain.segments[firstHazard]}, whose fresh-page exit `
                        + 'is re-measured under ⚖ ruling 23'
                    : r.ownTimed
                        ? 'its own build now spawns the gated body, so its TICK-0 block is '
                            + 're-derived; its BOOT is upstream of every move and does not'
                        : 'nothing upstream of it moved',
            });
        }
        /**
         * ⛓⛓⛓ R9 12e′ RE-RUN — **THE HEADLINE'S OWN ROW (§33.4 item 2).**
         *
         * `solve-seedling-r8-d2-chain.mjs` re-authors `r8-d2` on every run and
         * REPORTS it (measured at this head: *"3 segment(s) reported, 2
         * nominated"*), and until now the row went in neither the table nor
         * `unmeasured` — the same floor `r8-solve-11` fell through, one level
         * up, on a 2186 t tape.
         *
         * ⛔ ITS BOOT VERDICT IS `none` BY CONSTRUCTION, NOT BY MEASUREMENT.
         * A headline is the whole chain driven in ONE run, so its boot is
         * segment 0's own — upstream of every move ⚖ ruling 23 predicts, and
         * there is no predecessor latch for this pipeline to re-derive. What
         * it CAN have is a WALK move, which the merge below gives it.
         */
        if (chain.headline) {
            const t = ctx.tapeOf(chain.headline);
            const posture = ctx.rngPostureForBootLevel(t.boot.level, ctx.atlasLevelSource());
            table.push({
                chain: chain.id,
                segment: chain.headline,
                role: 'headline',
                index: chain.segments.length,
                bootLevel: t.boot.level,
                committed: {
                    rngSeed: t.rng?.seed ?? null,
                    rngFp: t.rng?.fp ?? null,
                    seamTime: t.seam?.time ?? null,
                    tick0Seed: t.tick0?.rng?.seed ?? null,
                },
                ownRoomTimedClears: [],
                continuationHazard: false,
                posture: { comparable: posture.comparable, verdict: posture.verdict },
                verdict: 'none',
                tick0Rederived: false,
                why: 'a chain HEADLINE is the whole walk driven in ONE run — its boot is '
                    + 'segment 1\'s own and this pipeline authors no boot for it. Only its '
                    + 'WALK can move.',
            });
        }
    }

    /**
     * ⛓⛓⛓ R9 SLICE 12c′, ⚖ RULING 43 — **THE WALK HALF OF THE TABLE, AND IT
     * IS MEASURED.** Everything above this line is ⚖ ruling 23's BOOT
     * prediction; a walk move is never predicted (§18.4), so it is measured
     * here and merged in.
     */
    const walk = await measureWalks(ctx, chains);
    const byId = new Map(table.map((r) => [r.segment, r]));
    for (const r of walk.rows) {
        const row = byId.get(r.segment);
        if (!row) continue;
        row.walk = { verdict: r.verdict, producer: r.producer, moved: r.moved,
            solvedTicks: r.solvedTicks, committedTicks: r.committedTicks };
        if (r.verdict === 'walk-moves') {
            row.verdict = 'walk-moves';
            row.tick0Rederived = true;
            row.why = `its WALK re-solves differently today — ${r.committedTicks} t committed `
                + `against ${r.solvedTicks} t, measured by ${r.producer}`;
        }
    }
    for (const u of walk.unmeasured) {
        const row = byId.get(u.segment);
        if (row) row.walk = { verdict: 'unmeasured', why: u.why };
    }
    /**
     * ⛓⛓ THE CASCADE. A moved walk ends somewhere new, so every SUCCESSOR
     * boots from a latch that has changed — `boot-only`, automatically, and it
     * is the FIRST move in a chain that decides (everything after it is
     * downstream whether or not it moved too).
     */
    for (const [, c] of walk.cascade) {
        for (const name of c.successors) {
            const row = byId.get(name);
            if (!row || row.verdict === 'walk-moves') continue;
            row.verdict = 'boot-only';
            row.tick0Rederived = true;
            row.why = `downstream of ${c.firstMoveSegment}, whose WALK moved — its boot is `
                + 'that segment\'s latch, and the latch has changed (⚖ ruling 43\'s cascade)';
        }
    }

    const licensed = table.filter((r) => r.verdict !== 'none').map((r) => r.segment);
    const tick0Set = table.filter((r) => r.tick0Rederived).map((r) => r.segment);
    console.log('\n## THE SEALED TABLE');
    for (const r of table) {
        console.log(`   ${r.chain.padEnd(14)} `
            + `${(r.role === 'headline' ? 'HL' : String(r.index + 1)).padStart(2)} `
            + `${r.segment.padEnd(14)} L${String(r.bootLevel).padEnd(3)} `
            + `${r.verdict.padEnd(11)} tick0:${r.tick0Rederived ? 'RE-DERIVE' : 'keep     '} `
            + `walk:${(r.walk?.verdict ?? 'unmeasured').padEnd(11)} `
            + `${r.ownRoomTimedClears.length ? `own-timed[${r.ownRoomTimedClears}] ` : ''}`
            + `${r.posture.comparable ? '' : 'rng NOT COMPARABLE '}`);
    }
    console.log(`\n## THE LICENSED SET (boot writes): ${licensed.length} — `
        + `${licensed.join(', ') || '(empty)'}`);
    console.log(`## TICK-0 RE-DERIVATIONS: ${tick0Set.length} — ${tick0Set.join(', ')}`);

    // ── the walk measurement's own accounting ─────────────────────────
    check('⛓ every chain segment is ACCOUNTED FOR — reported by exactly ONE producer, '
        + 'or NAMED unmeasured',
    walk.stops.length === 0 && walk.rows.length + walk.unmeasured.length === table.length,
    walk.stops.length ? walk.stops.join(' · ')
        : `${walk.rows.length} measured + ${walk.unmeasured.length} unmeasured `
            + `= ${table.length}`);
    check('⛓ every participating producer reported the segments that NOMINATED it',
        walk.owners.every((o) => o.missing.length === 0),
        walk.owners.map((o) => `${o.file} ${o.reported}/${o.nominated}`
            + `${o.missing.length ? ` ⛔ MISSING ${o.missing.join(',')}` : ''}`).join(' · '));
    if (walk.unmeasured.length) {
        console.log(`\n## ⚠ UNMEASURED — ${walk.unmeasured.length} segment(s), and a licence `
            + 'can never cover them:');
        for (const u of walk.unmeasured) console.log(`   ${u.segment.padEnd(16)} ${u.why}`);
    }

    // ── the walk moves, and the licence (⚖ ruling 43) ─────────────────
    const licence = applyLicence(walk.moved, LICENCE);
    if (walk.moved.length) {
        console.log(`\n## ⛔ MEASURED WALK MOVES — ${walk.moved.length}:`);
        for (const m of walk.moved) {
            console.log(`   ${m.segment.padEnd(16)} ${m.before} t -> ${m.after} t   `
                + `(${m.chain} #${m.index + 1}, measured by ${m.producer})`);
        }
        for (const [id, c] of walk.cascade) {
            console.log(`   cascade in ${id}: the first move is ${c.firstMoveSegment}, so `
                + `${c.successors.length} successor(s) become boot-only`
                + `${c.successors.length ? ` — ${c.successors.join(', ')}` : ''}`);
        }
    } else {
        console.log('\n## MEASURED WALK MOVES: none — every measured segment re-solves to '
            + 'the walk its committed tape already holds.');
    }
    if (licence.sealed) {
        console.log(`\n## ⚖ THE LICENCE: \`${LICENSE_FLAG}=${licence.sealed.ruling}\` — `
            + `${licence.sealed.segments.length} segment(s) permitted`
            + `${licence.sealed.note ? ` (${licence.sealed.note})` : ''}`);
    }
    check('⛓ every measured WALK MOVE is covered by a licence (⚖ ruling 43)',
        licence.stops.length === 0,
        licence.stops.length ? licence.stops.join(' · ')
            : (LICENCE ? `under ${LICENCE.ruling}` : 'nothing moved, so nothing needed one'));

    /**
     * ⛔⛔ **ONE OBJECT FOR BOTH THE FLUSH AND THE RETURN — R9 slice 12e′
     * (third run).** These used to be written twice, and the second copy was a
     * strict SUBSET: the flushed state carried `walk.rows`, the returned value
     * carried only `moved` and `licence`. So `spendWalkLicence`'s
     * `producerOrder(s0.walk?.rows ?? [], …)` saw rows on a `--from=S1` RESUME
     * (which reads the flushed file) and an empty array on a straight-through
     * S0→S1 run — and an empty row set silently means the file system's order,
     * which is the very thing §35.4's fix removed. The fix that only works on
     * the resume path is the shape this rewrite makes unspellable: the state
     * S1 resumes and the state S1 is handed are now the SAME OBJECT, so they
     * cannot drift apart again. `producerOrder` refuses an empty row set by
     * name as the second half of the same fix.
     */
    const s0State = {
        licensed,
        tick0Set,
        table,
        rulingBase: 'ruling 23',
        walk: {
            rows: walk.rows,
            unmeasured: walk.unmeasured,
            owners: walk.owners,
            moved: walk.moved,
            cascade: [...walk.cascade.entries()].map(([id, c]) => ({ chain: id, ...c })),
            licence: licence.sealed,
        },
    };
    flush(ctx, 'S0', s0State);
    return s0State;
}

// ── THE WINDOWS CHANNEL ───────────────────────────────────────────────
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const WSL = '/mnt/c/playwright';
const DOS = 'C:\\playwright';
const CACHE = join(WSL, 'rerecord-cache');

/**
 * ⛓⛓⛓ R9 P1, ⚖ 54 (4) — **THE KEY IS THE BYTES THE GAME READS.**
 *
 * It used to be the COMPLETE tape (`rerecordCampaign.latchCacheKey`), on the
 * argument that `GAME_VISIBLE_DROPS` removes `tick0` and two complete boots
 * could therefore share a projection. ⛔ That argument is about the WRONG
 * CONSUMER: the bytes this function ships are
 * `JSON.stringify(gameVisibleTape(parsed))` — three lines below — so `tick0`
 * is never driven and a latch cannot depend on it. The measurement is in
 * `provisionalLatch.js`'s docblock: `r8-d2-19`'s 721-tick answer sits in this
 * cache under `558c4596083c` and the tape the branch committed for that same
 * walk misses it, the whole difference being the `tick0` block S2 re-derives
 * AFTER S1 has driven.
 *
 * ⇒ `latchCacheCandidates` looks under the new key FIRST and the pre-P1
 * spelling second, and a hit always says WHICH — a legacy reuse is never
 * mistaken for a current one, and nothing is deleted (⚖ 47b(5): this cache is
 * machine-global and shared across trees and sessions).
 *
 * ⛓ AND A LEGACY HIT RE-KEYS FORWARD. "md5 is one-way" is true of the cache
 * files alone and false at the moment one of them hits: the tape that produced
 * it is in hand, so `readLatchCache` copies the record under the new key and
 * says it did. The legacy arm therefore converges instead of decaying — and
 * nothing is ever deleted.
 */
function windowsDriveLatch(ctx, label, completeTape) {
    const parsed = ctx.parseTape(completeTape);
    const projected = ctx.gameVisibleTape(parsed);
    const candidates = latchCacheCandidates(
        { complete: completeTape, projected, legacy: 'complete' });
    const key = candidates[0].key;
    mkdirSync(ctx.cacheDir, { recursive: true });
    if (!ctx.noCache) {
        const { record, hitBy, rekeyed } = readLatchCache(ctx, label, candidates);
        if (record) {
            console.log(`    ${label}: latch REUSED key=${hitBy.key} (${hitBy.era}) `
                + `file=${hitBy.file}`);
            if (rekeyed) console.log(`    ${label}: RE-KEYED forward -> ${rekeyed}`);
            return record;
        }
    }
    const cached = join(ctx.cacheDir, `latch-${label}-${key}.json`);
    const shipped = JSON.stringify(projected);
    mkdirSync(WSL, { recursive: true });
    writeFileSync(join(WSL, 'seedling-bot-replay-win.py'),
        readFileSync(join(HERE, 'seedling-bot-replay-win.py')));
    writeFileSync(join(WSL, `rr-tape-${label}.json`), shipped);
    const outWsl = join(WSL, `rr-stream-${label}.json`);
    try { unlinkSync(outWsl); } catch { /* first run */ }
    const t0 = Date.now();
    let out;
    try {
        out = ctx.exec('/mnt/c/Windows/py.exe', [
            '-3.12', `${DOS}\\seedling-bot-replay-win.py`,
            '--url', PAGE_URL,
            '--tape', `${DOS}\\rr-tape-${label}.json`,
            '--out', `${DOS}\\rr-stream-${label}.json`,
            '--deadline-sec', String(Math.ceil(parsed.tick_count * 1.5) + 180),
        ], { cwd: WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        throw new Error(`${label}: the Windows driver failed — ${e.message}\n`
            + [e.stdout, e.stderr].filter(Boolean).join('\n'));
    }
    out.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
        .forEach((l) => console.log(`      ${l}`));
    if (!existsSync(outWsl)) throw new Error(`${label}: the driver wrote no stream`);
    const got = JSON.parse(readFileSync(outWsl, 'utf8'));
    console.log(`    ${label}: ${got.stream.ticks.length} observations, `
        + `${got.status.dead_frames} dead, ${((Date.now() - t0) / 1000).toFixed(0)}s, `
        + `key=${key}`);
    if (!got.seam) throw new Error(`${label}: the driver returned no seam envelope`);
    const record = {
        envelope: got.seam,
        end: got.stream.ticks[got.stream.ticks.length - 1],
        observations: got.stream.ticks.length,
        deadFrames: got.status.dead_frames,
        hits: got.status.hits,
        persistenceCleared: got.status.persistence_cleared,
    };
    writeFileSync(cached, JSON.stringify(record));
    return record;
}


/**
 * ⛓⛓⛓ R9 P1 — **THE CACHE READ, AND THE RE-KEY THAT MAKES THE MIGRATION
 * CONVERGE.**
 *
 * `latchCacheCandidates` returns the new key first and the pre-P1 spelling
 * second. "md5 is one-way, so the old files cannot be re-keyed" is true of the
 * files ALONE — and false at the moment one of them HITS: the tape that
 * produced it is in hand. So a legacy hit copies the record forward under the
 * new key and SAYS it did. Nothing is deleted (this cache is machine-global,
 * ⚖ 47b(5)); the legacy arm simply stops being consulted for that tape.
 *
 * ⛔ IT NEVER WRITES OVER AN EXISTING FILE. A new-key file that is already
 * there is the answer; re-writing it would be a second opinion about a
 * measurement nobody re-took.
 */
function readLatchCache(ctx, label, candidates, { rekey = true } = {}) {
    for (const c of candidates) {
        const file = join(ctx.cacheDir, `latch-${label}-${c.key}.json`);
        if (!existsSync(file)) continue;
        const record = JSON.parse(readFileSync(file, 'utf8'));
        let rekeyed = null;
        if (rekey && c.era !== 'key') {
            const forward = join(ctx.cacheDir, `latch-${label}-${candidates[0].key}.json`);
            if (!existsSync(forward)) {
                mkdirSync(ctx.cacheDir, { recursive: true });
                writeFileSync(forward, JSON.stringify(record));
                rekeyed = forward;
            }
        }
        return { record, hitBy: { ...c, file }, rekeyed };
    }
    return { record: null, hitBy: null, rekeyed: null };
}

// ── S1 · MEASURE ──────────────────────────────────────────────────────
/**
 * ⛔⛔ THE BLOCKS A LATCH AUTHORS — and this list is `segmentBootFromLatch`'s
 * OWN key set, ASSERTED against it at run time rather than retyped, so a
 * signature row added tomorrow is either carried or named.
 *
 * ⛔ `equips` IS DELIBERATELY NOT HERE, and the omission is the law working
 * rather than an exception to it. The latch has no opinion about it: it is not
 * a `SEAM_BOOT_SPEC` row and `segmentBootFromLatch` does not return it, so a
 * pipeline that "re-derived" it would be inventing a value, which is the same
 * defect as carrying a stale one. Every chain segment on the roster declares
 * `equips: []` (measured), and the pipeline leaves the field ALONE and says so
 * rather than writing an empty array it did not measure.
 */
const BOOT_BLOCKS = ['boot', 'save', 'persistence', 'pins', 'rng', 'seam'];
const committedBlocks = (tape) => {
    const out = {};
    for (const b of BOOT_BLOCKS) if (tape[b] !== undefined) out[b] = tape[b];
    return out;
};

/**
 * ⛓⛓⛓ R9 SLICE 12c′, ⚖ RULING 43 — **A LICENSED WALK MOVE IS RE-AUTHORED BY
 * ITS OWN PRODUCER, AND IT HAPPENS BEFORE ANYTHING IS MEASURED FROM IT.**
 *
 * ⛔ S2's writes are SURGICAL BOOT writes; a walk lives in `inputs`, which
 * only the producer can author. So the licence is spent HERE — at the top of
 * S1, above the first latch drive — for the same reason `--grow` runs the
 * producer before the pipeline (§26.6): every later stage reads the tapes off
 * disk, and a stage that measured the OLD walk would hand its successor a
 * boot for a walk nobody will commit.
 *
 * ⛔ IT SPENDS EXACTLY THE SEALED SET AND CANNOT WIDEN IT: the producers come
 * from `s0.walk.licence.segments`, which is the MEASURED set S0 flushed. A
 * producer re-authors every tape it owns — the ones that did not move come
 * back byte-identical, which is the control.
 */
function spendWalkLicence(ctx, s0) {
    const licence = s0.walk?.licence ?? null;
    const permitted = licence?.segments ?? [];
    if (!permitted.length) return { ran: [] };
    /**
     * ⛔⛔ **THE ORDER IS THE CHAINS', NOT THE FILE SYSTEM'S** (R9 12e′ re-run).
     * A sorted-file order ran `solve-seedling-r8-d2-chain.mjs` before
     * `solve-seedling-r8-l18.mjs`, which OWNS that chain's first segment — so
     * the chain producer drove the game for the latch of the very tape this
     * run was about to replace and solved from a predecessor that no longer
     * exists. `producerOrder` derives the order from the chains' own indices
     * and refuses a cycle by name.
     */
    const producers = producerOrder(s0.walk?.rows ?? [],
        [...new Set(permitted.map((p) => p.producer))]);
    console.log(`## ⚖ THE WALK LICENCE, SPENT — \`${licence.ruling}\` permits `
        + `${permitted.length} walk move(s): `
        + `${permitted.map((p) => `${p.segment} ${p.before}t->${p.after}t`).join(', ')}`);
    console.log('## their producer(s) re-author every tape they own, in the order the '
        + `CHAINS require: ${producers.join(' -> ')}`);
    const ran = [];
    for (const file of producers) {
        const r = shell(ctx, `${file} re-authors its walks under ⚖ ${licence.ruling}`,
            'node', [ctx.scriptPath(file)],
            `s1-producer-${file.replace(/\.mjs$/, '')}`);
        ran.push({ file, ok: r.ok });
    }
    return { ran };
}

function measure(ctx, s0) {
    console.log('\n# S1 · MEASURE — the GAME, in chain order\n');
    /**
     * ⛓⛓⛓ R9 SLICE 12e′ RE-RUN — **THE RECORD SET'S `BEFORE`, TAKEN HERE AND
     * NOWHERE ELSE.** It has to be above `spendWalkLicence`, because that is
     * the line where the producers re-author the moved walks: a snapshot taken
     * one line lower would compare the new bytes against themselves and find
     * nothing moved, which is the same defect `walkReport.note`'s placement
     * exists to avoid one level down.
     */
    const projectionsBefore = projectionIndex(ctx.allTapeLabels(), ctx.gameVisibleTextOf);
    console.log(`## the game-visible projection of ${Object.keys(projectionsBefore).length} `
        + 'tape(s), snapshotted BEFORE the licence is spent — S3\'s record set is the '
        + 'diff against this, never S2\'s boot writes');
    const spent = spendWalkLicence(ctx, s0);
    let blockSetChecked = false;
    const chains = subjects(ctx);
    const measured = {};
    const boundaries = [];
    for (const chain of chains) {
        console.log(`## ${chain.id}`);
        /**
         * ⛓ THE COMPLETE TAPE FOR SEGMENT k IS THE COMMITTED ONE WITH ANY
         * BOOT THIS RUN HAS ALREADY AUTHORED APPLIED — the chain is walked in
         * order precisely so segment k is driven as the artifact segment k − 1
         * just made it, and never as a provisional nobody will commit.
         */
        const pending = {};
        for (let k = 0; k < chain.segments.length; k += 1) {
            const name = chain.segments[k];
            const complete = pending[name] ?? ctx.rawOf(name);
            if (k === chain.segments.length - 1) {
                measured[name] = measured[name] ?? { complete };
                continue;
            }
            const successor = chain.segments[k + 1];
            const rec = ctx.driveLatch(name, complete);
            const env = rec.envelope;
            const calm = ctx.seamLatchFindings(env, { requireCalm: true })
                .filter((r) => !r.ok);
            check(`${chain.id} ${k + 1}/${chain.segments.length}: ${name} ends at a CALM `
                + 'ARRIVAL', calm.length === 0,
            calm.map((r) => `${r.name} [${r.detail}]`).join('; ')
                    || `latched at tick ${env.seam['latch.tick']}`);
            if (calm.length) {
                throw new Error(`⛔ STOP at ${chain.id} boundary ${k + 1}: a latch that is `
                    + 'not a calm arrival cannot author a boot.');
            }
            /**
             * ⛔ THE BLOCK LIST IS THE PROJECTION'S OWN, CHECKED ON THE FIRST
             * REAL ENVELOPE. If `segmentBootFromLatch` ever returns a block
             * this pipeline does not write, every write would be silently
             * partial — so the two key sets are compared once, against a latch
             * the game produced rather than a synthetic one.
             */
            if (!blockSetChecked) {
                blockSetChecked = true;
                const got = Object.keys(ctx.segmentBootFromLatch(env)).sort();
                /**
                 * ⛔ IT TESTS ITS OWN CHECK, NOT THE GLOBAL COUNTER (R9 12e′
                 * re-run). `if (failures)` here made ANY earlier failure — a
                 * producer exiting 1, three rows up — throw this message,
                 * which is a TRUE SENTENCE ABOUT THE WRONG SUBJECT: it named
                 * the projection while the key sets it had just compared were
                 * identical, and printed PASS one line above the throw.
                 */
                const blockSetOk = JSON.stringify(got)
                    === JSON.stringify([...BOOT_BLOCKS].sort());
                check('⛓ BOOT_BLOCKS is `segmentBootFromLatch`\'s own key set', blockSetOk,
                    `${got.join(',')} against ${[...BOOT_BLOCKS].sort().join(',')}`);
                if (!blockSetOk) {
                    throw new Error('⛔ STOP: the projection authors a block this pipeline '
                        + 'does not write, so every write would be silently partial.');
                }
            }
            const succRaw = pending[successor] ?? ctx.rawOf(successor);
            const succCommitted = committedBlocks(ctx.parseTape(succRaw));
            /**
             * ⛓ `note` and `at` are re-attached BEFORE the diff, not after —
             * see `mergePersistence`. A diff run against the raw measured set
             * would report every segment's provenance prose as a mover and
             * would then WRITE the rows without it.
             */
            const project = (e) => {
                const b = ctx.segmentBootFromLatch(e);
                return { ...b,
                    persistence: mergePersistence(b.persistence, succCommitted.persistence) };
            };
            const { blocks, rows } = bootFromEnvelopeOnly(env, succCommitted, project);
            const movers = rows.filter((r) => r.moved);
            console.log(`    -> ${successor}: ${rows.length} field(s) compared, `
                + `${movers.length} moved`);
            for (const r of rows) {
                console.log(`       ${r.moved ? '⛓ MOVED ' : '        '}${r.field.padEnd(24)}`
                    + ` ${JSON.stringify(r.committed)} -> ${JSON.stringify(r.measured)}`);
            }
            const licensed = s0.licensed.includes(successor);
            check(`${successor}: its move is on the SEALED TABLE`,
                movers.length === 0 || licensed,
                movers.length === 0 ? 'nothing moved'
                    : licensed
                        ? `${movers.map((m) => m.field).join(', ')} moved, and the table `
                            + 'predicted boot-only here'
                        : `⛔ ${movers.map((m) => m.field).join(', ')} moved and ${successor} `
                            + 'is predicted `none` — the sealed table is the licence');
            boundaries.push({
                chain: chain.id, k: k + 1, from: name, to: successor,
                moved: movers.map((m) => m.field), rows, licensed,
                end: rec.end, observations: rec.observations, hits: rec.hits,
                persistenceCleared: rec.persistenceCleared,
            });
            const next = { ...succRaw };
            for (const b of BOOT_BLOCKS) if (blocks[b] !== undefined) next[b] = blocks[b];
            pending[successor] = next;
            measured[name] = { complete, envelope: env, end: rec.end };
            measured[successor] = { complete: next };
        }
    }
    flush(ctx, 'S1',
        { boundaries, pending: measured, licenceSpent: spent.ran, projectionsBefore });
    return { boundaries, measured, projectionsBefore };
}

// ── S2 · WRITE ────────────────────────────────────────────────────────
/**
 * ⛔ SURGICAL. The committed tapes are `JSON.stringify(obj, null, 4) + "\n"`
 * and that is MEASURED per file before anything is written — slice 8
 * reformatted twenty tapes by trusting `serializeTape`, whose two-space indent
 * and dropped `"note": ""` parse and replay and break byte-identity wholesale.
 * A file that does not round-trip is REFUSED rather than rewritten.
 */
function writeBoot(ctx, label, blocks) {
    const text = ctx.textOf(label);
    const obj = JSON.parse(text);
    if (`${JSON.stringify(obj, null, 4)}\n` !== text) {
        throw new Error(`${label}: the committed tape does not round-trip through a `
            + '4-space re-emit, so a surgical write would reformat it. Refusing.');
    }
    const before = JSON.stringify(obj);
    for (const b of BOOT_BLOCKS) {
        if (blocks[b] !== undefined && Object.prototype.hasOwnProperty.call(obj, b)) {
            obj[b] = blocks[b];
        }
    }
    const after = `${JSON.stringify(obj, null, 4)}\n`;
    const changed = before !== JSON.stringify(obj);
    if (changed) writeFileSync(join(ctx.tapesDir, `${label}.json`), after);
    return changed;
}

function write(ctx, s0, s1) {
    console.log('\n# S2 · WRITE — exactly the sealed set\n');
    const wrote = [];
    /**
     * ⛔⛔ **THIS COUNTER IS THE CHECK'S OWN SUBJECT — R9 slice 12e′ (third
     * run), and it is §35.4 item 5's defect a second time, in S2.** The row
     * below used to test the GLOBAL `failures`, so a producer that exited 1
     * three stages earlier reddened *"the projection authors a block this
     * pipeline does not write"* while every write on this page was in fact
     * licensed and no `FAIL: <label> would move …` line had been printed. A
     * guard that names the wrong subject is worse than no guard: it is read as
     * evidence about the writes.
     */
    let offTable = 0;
    for (const [label, rec] of Object.entries(s1.pending ?? s1.measured ?? {})) {
        const blocks = committedBlocks(ctx.parseTape(rec.complete));
        const onTable = s0.licensed.includes(label);
        const moved = writeBootDry(ctx, label, blocks);
        if (moved && !onTable) {
            offTable += 1;
            console.log(`FAIL: ${label} would move ${moved.join(', ')} and is not on the `
                + 'sealed table — the table IS the licence');
            continue;
        }
        if (!moved) continue;
        writeBoot(ctx, label, blocks);
        wrote.push({ label, fields: moved });
        console.log(`  wrote ${label}: ${moved.join(', ')}`);
    }
    check('⛓ every write is on the sealed table', offTable === 0,
        offTable ? `⛔ ${offTable} write(s) named above are off the table`
            : `${wrote.length} write(s), every one licensed`);
    /**
     * ⛓⛓ THE TICK-0 HALF IS THE OTHER INSTRUMENT'S JOB (trap 169 — one
     * producer per artifact). `derive-seedling-tick0.mjs` owns the v11 block:
     * it drives the ZERO-TICK variant of each segment's NEW boot and writes
     * the result surgically. It is run over its WHOLE derived set rather than
     * `--only=` the predicted movers, so the segments the table says should
     * NOT move are re-measured too and stand as the control.
     */
    const t0 = shell(ctx, 'the tick-0 blocks are re-derived from the NEW boots', 'node',
        [ctx.scriptPath('derive-seedling-tick0.mjs')]);
    flush(ctx, 'S2', { wrote, tick0: t0.ok });
    return { wrote };
}

/** The fields a write WOULD move, without moving them. */
function writeBootDry(ctx, label, blocks) {
    const obj = JSON.parse(ctx.textOf(label));
    const moved = [];
    for (const b of BOOT_BLOCKS) {
        if (blocks[b] === undefined || !Object.prototype.hasOwnProperty.call(obj, b)) continue;
        if (JSON.stringify(obj[b]) !== JSON.stringify(blocks[b])) moved.push(b);
    }
    return moved.length ? moved : null;
}

// ── S3/S4 · RECORD and PROVE ──────────────────────────────────────────
/**
 * ⛔ THE WHOLE OUTPUT GOES TO THE RUN DIRECTORY, and only its tail to the
 * console. A gate that prints thousands of rows and is summarised by its last
 * forty is a gate whose COUNTS cannot be quoted afterwards — and a count is
 * how a truncated sweep is told from a complete one (trap: a bounded sweep
 * must name what it bounded). The tally line is derived from the whole text.
 */
function shell(ctx, what, cmd, args, logName) {
    console.log(`\n$ ${cmd} ${args.join(' ')}`);
    const finish = (ok, out, status) => {
        const file = join(ctx.runDir, `${logName ?? what.replace(/\W+/g, '-')}.log`);
        writeFileSync(file, `$ ${cmd} ${args.join(' ')}\n${out}`);
        const tally = { PASS: 0, FAIL: 0, SKIP: 0 };
        for (const line of out.split('\n')) {
            const m = /^(PASS|FAIL|SKIP)\b/.exec(line);
            if (m) tally[m[1]] += 1;
        }
        console.log(out.split('\n').slice(ok ? -40 : -60).join('\n'));
        console.log(`## ${tally.PASS} / ${tally.FAIL} / ${tally.SKIP} `
            + `(PASS/FAIL/SKIP) over ${out.split('\n').length} line(s) -> ${file}`);
        check(what, ok, `exit ${status} — ${tally.PASS}/${tally.FAIL}/${tally.SKIP}`);
        return { ok, out, tally };
    };
    try {
        const out = ctx.exec(cmd, args, { cwd: ctx.root, encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
        return finish(true, out, 0);
    } catch (e) {
        return finish(false, [e.stdout, e.stderr].filter(Boolean).join('\n'), e.status);
    }
}

/**
 * ⛓⛓⛓ R9 SLICE 12e′ RE-RUN — **THE RECORD SET IS DERIVED FROM THE GAME-VISIBLE
 * PROJECTION DIFF, AND `s2.wrote` IS THE DEFECT IT REPLACES.**
 *
 * `s2.wrote` is the tapes whose BOOT blocks S2 edited — which is the cascade's
 * SUCCESSORS, so it is every moved segment except the FIRST in each chain,
 * whose boot is upstream of its own move and never changes. 12e′ predicted the
 * cost to the name: eight recorded where thirteen are owed, the five dropped
 * ones (`r8-solve-10`, `r8-solve-18`, `r8-d2`, `r8-solve-20`, `r8-solve-11`)
 * left carrying stale expectations into S4 — a red AFTER the GPU is spent.
 *
 * ⛔ THE SET IS NOT `s0.licensed` EITHER, and that is not a near miss. That
 * list is the BOOT permission: at this head it holds thirteen segments whose
 * walks nothing has moved, and it holds neither the headline nor
 * `r8-solve-20`. A permission says what MAY move; only the artifacts say what
 * DID.
 *
 * ⛔ AND A MOVE OUTSIDE THE LICENCE IS A STOP, NOT A BIGGER RECORDING. The
 * diff is over EVERY tape in the directory, so it can see a tape no stage of
 * this pipeline was supposed to touch — and the honest answer to that is to
 * name it and refuse, because ⚖ ruling 49's licence is a list of tapes and a
 * run that recorded a fourteenth would have spent the user's permission on
 * something they did not give.
 */
function record(ctx, s0, s1, s2) {
    console.log('\n# S3 · RECORD — the tapes whose GAME-VISIBLE PROJECTION moved\n');
    const before = s1?.projectionsBefore;
    if (!before) {
        throw new Error('⛔ S3 has no `projectionsBefore` from S1. The record set is the '
            + 'projection diff across the run, so a S1 state written before this was built '
            + 'cannot answer it — re-enter at --from=S1 rather than recording a guess.');
    }
    const after = projectionIndex(ctx.allTapeLabels(), ctx.gameVisibleTextOf);
    const { moved, appeared, vanished } = movedProjections(before, after);
    const set = [...moved, ...appeared];
    const wrote = new Set((s2?.wrote ?? []).map((w) => w.label));
    console.log(`## ${Object.keys(after).length} tape(s) projected; ${moved.length} moved, `
        + `${appeared.length} appeared, ${vanished.length} vanished`);
    for (const label of set) {
        console.log(`   ${label.padEnd(18)} ${appeared.includes(label) ? 'APPEARED' : 'moved'}`
            + `${wrote.has(label) ? '' : '   ⛓ NOT in S2\'s boot writes — the row `s2.wrote` '
                + 'could not see'}`);
    }
    check('⛔ no tape VANISHED under this run', vanished.length === 0, vanished.join(', '));
    /**
     * ⛓ THE LICENCE IS THE BOUND, AND IT IS CHECKED HERE RATHER THAN TRUSTED.
     * S0 sealed the segments ⚖ ruling 43's licence permits; a projection that
     * moved outside that set is a tape this run had no permission to author.
     */
    const permitted = new Set((s0?.walk?.licence?.segments ?? []).map((p) => p.segment));
    const unlicensed = set.filter((label) => !permitted.has(label) && !wrote.has(label));
    check('⛓ every projection that moved is on the sealed licence, or is a boot S2 wrote',
        unlicensed.length === 0,
        unlicensed.length ? `⛔ ${unlicensed.join(', ')} moved and no licence covers it`
            : `${set.length} tape(s) inside the permission`);
    /**
     * ⛔⛔ **IT TESTS ITS OWN TWO CONDITIONS, NOT THE GLOBAL COUNTER — R9 P1b,
     * AND THIS IS THE SAME DEFECT A FOURTH TIME.** §35.4 item 5 found it in
     * S1's boot-block guard and §37.3 (b) found it again in S2's sealed-table
     * guard, which swept *"`:892` was the last global-`failures` guard in the
     * file"* — and this one was written in the same slice that added S3, so
     * the sweep passed over it.
     *
     * `if (failures)` here means a producer that exited 1 at S1, or a boundary
     * whose calm row went red three stages earlier, throws **"the projection
     * diff names a tape this run was not licensed to move"** — a sentence that
     * reads as evidence about the RECORD SET while the `unlicensed` check one
     * line above may have printed PASS. That is a TRUE-SOUNDING SENTENCE ABOUT
     * THE WRONG SUBJECT, and it fires BEFORE the GPU, so the run stops with a
     * misattributed reason and the real one is forty lines up.
     *
     * ⛓ THE TWO CONDITIONS ARE S3's OWN: a projection that moved outside the
     * permission, and a tape that VANISHED. Both are reasons not to record;
     * neither is "somebody else failed". A failure anywhere still reddens the
     * run — `failures` is non-zero and the process exits 1 — it just no longer
     * gets to name S3's subject. Found by the P1b rehearsal, offline, on a
     * fake tree, which is the whole of what ⚖ 54 (3) is for.
     */
    const s3Stops = unlicensed.length + vanished.length;
    if (s3Stops) {
        flush(ctx, 'S3', { set: [], moved, appeared, vanished, stopped: true });
        throw new Error('⛔ STOP before the GPU: '
            + (unlicensed.length
                ? `the projection diff names ${unlicensed.length} tape(s) this run was not `
                    + `licensed to move — ${unlicensed.join(', ')}.`
                : `${vanished.length} tape(s) VANISHED under this run — `
                    + `${vanished.join(', ')}.`));
    }
    if (!set.length) {
        console.log('## no projection moved, so there is nothing to record — and that is a '
            + 'MEASUREMENT, not a skip.');
        flush(ctx, 'S3', { set: [], moved, appeared, vanished, skipped: true });
        return;
    }
    shell(ctx, 'the differential RECORDS the derived set', 'node',
        [ctx.scriptPath('verify-seedling-bot-differential.mjs'), '--win', '--record',
            `--only=${set.join(',')}`]);
    flush(ctx, 'S3', { set, moved, appeared, vanished });
}

/**
 * ⛓ DERIVED, NEVER TYPED: every tape whose own `description` says a solver
 * authored it, plus the four hand witnesses the gate carries as controls.
 */
function solverRoster(ctx) {
    const names = ctx.allTapeLabels();
    const solver = names.filter((n) => /Authored by scripts\/procgen\/solve-seedling|LIVE SOLVER/i
        .test(ctx.rawOf(n).description || ''));
    return [...solver, 'r8-hammer-arm', 'r8-hammer-control',
        'r8-l18-spinner-press', 'r8-l6-bob-contact'];
}

function prove(ctx) {
    console.log('\n# S4 · PROVE — the chains play\n');
    const rows = [];
    rows.push(['the JS sequence gate', shell(ctx, 'the JS sequence gate', 'node',
        [ctx.scriptPath('check-seedling-editor-sequence.mjs')]).ok]);
    rows.push(['the census CONTINUES on every pair', shell(ctx, 'the census', 'node',
        [ctx.scriptPath('census-seedling-campaign.mjs')]).ok]);
    rows.push(['the wasm ship gate (CAMPAIGN arm)', shell(ctx, 'the wasm ship gate', 'node',
        [ctx.scriptPath('check-seedling-wasm-ship.mjs')]).ok]);
    /**
     * ⛓⛓⛓ THE SOLVER-ROSTER GATE IS THE GAME-INVISIBILITY CLAIM, and the
     * roster is DERIVED from the tapes' own provenance (a solver-authored
     * description) rather than named — ⚖ ruling 17, and the four hand
     * witnesses the gate has always carried alongside it.
     */
    const solver = solverRoster(ctx);
    console.log(`## the solver roster: ${solver.length} tape(s), derived`);
    rows.push(['the solver-roster differential', shell(ctx, 'the solver-roster differential',
        'node', [ctx.scriptPath('verify-seedling-bot-differential.mjs'), '--win',
            `--only=${solver.join(',')}`]).ok]);
    flush(ctx, 'S4', { rows });
    return rows;
}

// ── S5 · REPORT ───────────────────────────────────────────────────────
function report(ctx, s0, s1, s2) {
    console.log('\n# S5 · REPORT\n');
    console.log('## the sealed table, with its measured column');
    const movedBy = new Map();
    for (const b of (s1?.boundaries ?? [])) movedBy.set(b.to, b.moved);
    for (const r of s0.table) {
        const m = movedBy.get(r.segment);
        console.log(`   ${r.chain.padEnd(14)} ${r.segment.padEnd(14)} `
            + `predicted ${r.verdict.padEnd(10)} measured `
            + `${m === undefined ? '(not a successor)' : (m.length ? m.join(',') : 'none')}`);
    }
    /**
     * ⛓ ⚖ RULING 43 — **THE LICENCE PRINTS HERE, WITH ITS RULING AND ITS
     * BEFORE/AFTER TICKS.** A walk move is the user's permission, so the run's
     * own report has to be able to say whose it was and what it bought; a
     * table that only said "written" would leave the authority off the record.
     */
    const licence = s0.walk?.licence ?? null;
    if (licence) {
        console.log(`\n## ⚖ THE WALK LICENCE: \`${licence.ruling}\` — `
            + `${licence.segments.length} segment(s)`);
        for (const p of licence.segments) {
            console.log(`   ${p.segment.padEnd(16)} ${p.before} t -> ${p.after} t   `
                + `(${p.chain}, re-authored by ${p.producer})`);
        }
        if (!licence.segments.length) console.log(`   ${licence.note}`);
    } else {
        console.log('\n## ⚖ THE WALK LICENCE: none was given, and none was needed — S0 '
            + 'measured no walk move.');
    }
    console.log(`\n## written: ${(s2?.wrote ?? []).map((w) => w.label).join(', ') || '(none)'}`);
    console.log(`## run directory: ${ctx.runDir}`);
    console.log('## ⛓ IDEMPOTENCE IS NOT THE CORRECTNESS CLAIM, and it is not S0\'s to '
        + 'make. S0\'s verdict is a PERMISSION — which segments MAY move — and it is a '
        + 'function of the TAPES, so it says the same thing before and after a run. The '
        + 'fixed point is S1 MEASURING ZERO MOVERS at every boundary against the final '
        + 'committed artifacts, which is a browser row and not a re-print. And even that '
        + 'is only a fixed point: what CLOSES this pipeline is S4 — the chain playing end '
        + 'to end on the real game (trap 250).');
}

// ── ⛓⛓⛓ THE GROWTH COMMAND — ⚖ RULING 38 ITEM (2), R9 SLICE 12d ───────
/**
 * `--grow` records THE NEXT ROOM, end to end.
 *
 * ── ⛔ WHAT IT REPLACES ────────────────────────────────────────────────
 *
 * Slice 12b″ grew this chain by one room and it took a whole session:
 * `SEGMENTS`, `PLAYTHROUGH_CHAINS`, `PAGE_CHAINS`, the demos catalogue's
 * counts, `R8_ENEMY_BRIDGE`, `index.json`, the frontier, the doc's chain table
 * and a `--record` follow-up the pipeline did not fold in — twelve edits, half
 * of them the same fact. ⚖ Ruling 38 (1) made the membership ONE declaration;
 * this is (2), the command that appends to it.
 *
 * ── THE SUBJECT IS DERIVED, AND SO IS THE ANSWER ──────────────────────
 *
 * The room to grow into is the chain's own tail `to` — nothing is passed on
 * the command line, because a room named by a human is a room nobody checked
 * against the route. Whether it SOLVES is the SURVEY's answer, read off the
 * two artifacts the census reads (`route.json` + `survey.json`), and
 * cross-checked against the committed frontier — two derivations, one answer.
 *
 * ⛔⛔ **A REFUSAL IS THE ANSWER, NOT AN ERROR.** If the survey refuses the
 * next step, `--grow` prints the refusal VERBATIM — family and text — and
 * writes NOTHING. That is the correct outcome for a chain standing in front of
 * an unsolved room, and it is today's: route step 17, L15, `shove`. The exit
 * code is 0, because the command did what it is for; a STALE or MISSING
 * artifact exits 1, because then it could not ask.
 *
 * ── WHAT A GROWTH WRITES (seven artifacts, 12b″'s own list) ───────────
 *   1  `campaignChain.js`            the appended segment
 *   2  `fixtures/tapes/<new>.json`   the tape           ) the producer's,
 *   3  `fixtures/traces/<new>.trace.json`  the sidecar  ) in one run
 *   4  `fixtures/tapes/<pred>.json`  the predecessor's `why` → `description`
 *   5  `fixtures/expectations/<new>.json`  the recording (S3)
 *   6  `fixtures/tapes/index.json`   regenerated
 *   7  `fixtures/campaign-frontier.json`   re-derived
 * then S0..S5 over the whole chain, the reference regenerated, and the
 * standing values re-measured. Everything else a growth touches DERIVES from
 * artifact 1 since ⚖ ruling 38 (1).
 *
 * ── ⛔⛔ THE TWO LAWS ITS OWN PROOF ESTABLISHED ────────────────────────
 *
 * **A SCRATCH TREE CANNOT RUN THE BROWSER STAGES, AND THAT IS THE HARNESS
 * RATHER THAN THE COMMAND.** The dev server serves ONE tree, so a browser
 * stage entered from a second worktree drives the FIRST tree's pages and
 * reports about the wrong subject — a green that means nothing. So a growth is
 * REHEARSED offline (`--grow --to=S0`: append, author, predict) and RUN in the
 * tree the server is serving.
 *
 * **THE FOUR SUMMARIES RUN ONLY AFTER A COMPLETE PIPELINE.** `index.json`, the
 * frontier, the generated reference and `standing-values.json` all DESCRIBE a
 * finished tree. `standing-values.json` in particular is what ⚖ ruling 32 A
 * makes the NEXT slice's BEFORE, so a rehearsal that stamped it would hand the
 * next slice a baseline measured on an unfinished chain.
 *
 * ⛓ AND ONE SENTENCE WORTH KEEPING, from the mutant that proved the revert:
 * **the survey's YES is evidence, not a guarantee.** It solves from a STAGED
 * boot; the producer solves from the predecessor's MEASURED LATCH. Those are
 * different starting states, so the producer's refusal is the one that counts —
 * its walk is the one that would be recorded.
 *
 * Run:
 *   node scripts/procgen/rerecord-seedling-campaign.mjs --grow --dry-run
 *   node scripts/procgen/rerecord-seedling-campaign.mjs --grow --to=S0  # rehearse
 *   node scripts/procgen/rerecord-seedling-campaign.mjs --grow
 */
const SURVEY_DIR = join(ROOT, 'NewDocs/plans/seedling-editor-survey');
const FRONTIER_PATH = join(MODULE, 'fixtures/campaign-frontier.json');
const CHAIN_DECL = join(MODULE, 'campaignChain.js');

/** A refusal that is the ANSWER: say it, write nothing, exit 0. */
function growRefuses(what, detail) {
    console.log(`\n## ⛔ --grow REFUSES: ${what}\n`);
    console.log(detail);
    console.log('\n## NOTHING WAS WRITTEN. `git status --porcelain` should be empty.');
    process.exit(0);
}
/** A refusal that means it could not ASK: exit 1. */
function growCannotAsk(what, cure) {
    console.log(`\n## ⛔⛔ --grow CANNOT ASK: ${what}`);
    console.log(`## THE CURE: ${cure}`);
    console.log('## NOTHING WAS WRITTEN.');
    process.exit(1);
}

async function grow(ctx) {
    console.log('# --grow — the next room, end to end (⚖ ruling 38 (2), R9 slice 12d)\n');
    const decl = await import(pathToFileURL(CHAIN_DECL).href);
    const names = [...decl.CAMPAIGN_SEGMENT_NAMES];
    const tail = decl.campaignTail();
    const next = decl.campaignNextLevel();
    console.log(`## the chain: ${names.length} segment(s), tail ${tail.name} `
        + `(L${tail.level} → L${tail.to})`);
    console.log(`## the room in front of it, DERIVED from the tail's own \`to\`: L${next}`);

    // ── the frontier: the census's checked projection of the survey ────
    if (!existsSync(FRONTIER_PATH)) {
        growCannotAsk(`${FRONTIER_PATH} is not on disk`,
            'node scripts/procgen/census-seedling-campaign.mjs --write-frontier');
    }
    const frontier = JSON.parse(readFileSync(FRONTIER_PATH, 'utf8'));
    if (frontier.chain !== decl.CAMPAIGN_CHAIN_ID
        || JSON.stringify(frontier.segments) !== JSON.stringify(names)) {
        growCannotAsk('the committed frontier is STALE — it describes a different chain '
            + `(${frontier.chain}: ${(frontier.segments ?? []).length} segment(s)) than `
            + `the declaration does (${decl.CAMPAIGN_CHAIN_ID}: ${names.length}). Growing `
            + 'from a stale frontier would ask the route about the wrong room',
        'node scripts/procgen/census-seedling-campaign.mjs --write-frontier');
    }
    if (frontier.covered !== names.length) {
        growCannotAsk(`the frontier says the chain covers ${frontier.covered} route `
            + `step(s) and the declaration has ${names.length} segment(s)`,
        'node scripts/procgen/census-seedling-campaign.mjs (it names the segment where '
            + 'the chain stops prefixing the route)');
    }

    // ── the survey: the frontier's own source, read again ─────────────
    const routeP = join(SURVEY_DIR, 'route.json');
    const surveyP = join(SURVEY_DIR, 'survey.json');
    if (!existsSync(routeP) || !existsSync(surveyP)) {
        growCannotAsk(`${routeP} / survey.json are not on disk — the survey's answer is `
            + 'what decides whether the next room solves, and this command will not '
            + 'invent it',
        'node scripts/procgen/survey-seedling-route.mjs');
    }
    const route = JSON.parse(readFileSync(routeP, 'utf8'));
    const survey = JSON.parse(readFileSync(surveyP, 'utf8'));
    const step = route.steps[frontier.covered] ?? null;
    if (!step) {
        growRefuses('THE ROUTE ENDS HERE',
            `the chain covers all ${route.steps.length} route step(s); there is no next `
            + 'room to grow into. A chain that has walked the whole route is finished, '
            + 'not stuck.');
    }
    /**
     * ⛔ TWO DERIVATIONS, ONE ANSWER. The declaration's tail says the next room
     * is L`next`; the route says the next STEP is in L`step.level`. If those
     * disagree the chain is not walking the route the survey surveyed, and
     * growing would append a room nobody aligned.
     */
    if (step.level !== next) {
        growCannotAsk(`the declaration's tail leaves into L${next} and route step `
            + `${step.step} is in L${step.level} — the chain and the route disagree about `
            + 'what comes next',
        'node scripts/procgen/census-seedling-campaign.mjs (its alignment row names the '
            + 'segment where the two part)');
    }
    const row = (survey.rows ?? []).find((r) => String(r.step) === String(step.step));
    if (!row) {
        growCannotAsk(`the survey has no row for route step ${step.step} (L${step.level})`,
            'node scripts/procgen/survey-seedling-route.mjs');
    }

    // ── THE ANSWER ────────────────────────────────────────────────────
    if (row.verdict !== 'SOLVED' || row.refusal) {
        /**
         * ⛓ AND THE FRONTIER'S COPY OF IT IS CHECKED, where it has one. The
         * census projects the FIRST refused step; when that is this step the
         * two texts must be the same sentence, or one of the artifacts is
         * older than the other and the refusal being quoted is not today's.
         */
        if (frontier.nextStep && frontier.nextStep.step === step.step
            && frontier.refusal && frontier.refusal.text !== row.refusal) {
            growCannotAsk('the committed frontier and the survey give DIFFERENT refusals '
                + `for route step ${step.step} — one of them is older than the other, and `
                + 'a refusal quoted from a stale artifact is a sentence about a room '
                + 'nobody asked today',
            'node scripts/procgen/census-seedling-campaign.mjs --write-frontier');
        }
        growRefuses(`route step ${step.step}, L${step.level}, DOES NOT SOLVE`,
            `   family: ${row.family ?? frontier.refusal?.family ?? '(unnamed)'}\n\n`
            + `   ${row.refusal}\n\n`
            + `   goals asked: ${step.goals.map((g) => g.why).join('; ')}\n`
            + `   the boot the survey used: ${row.boot?.kind} `
            + `${row.boot?.source ?? ''} at L${row.boot?.block?.level}@`
            + `${row.boot?.block?.x},${row.boot?.block?.y}\n\n`
            + '   ⛓ THIS IS THE WORK ORDER. The chain grows when the solver crosses this '
            + 'room, not before — a segment appended over a refusal would be a tape of a '
            + 'walk nobody found.');
    }

    // ── the segment this growth would append, DERIVED ─────────────────
    const prefix = /^(r\d+)-/.exec(tail.name)?.[1];
    if (!prefix) {
        growCannotAsk(`the tail is named "${tail.name}" and no rung prefix (\`rN-\`) can `
            + 'be read off it, so a name for the new segment cannot be derived',
        'name the tail by the arc convention (`rN-solve-<level>`), or extend this '
            + 'derivation deliberately');
    }
    const newName = `${prefix}-solve-${step.level}`;
    if (names.includes(newName) || existsSync(join(ctx.tapesDir, `${newName}.json`))) {
        growCannotAsk(`the derived name "${newName}" is already taken — L${step.level} is `
            + 'being visited a SECOND time, and which tape owns which visit is a decision '
            + 'a human makes (⛔ trap 169: `r9-solve-11` vs `r8-solve-11` is exactly this)',
        'append the segment by hand with a name that says which visit it is, then re-run '
            + 'the pipeline with --from=S0');
    }
    /**
     * ⛓ `collects` COMES FROM THE ATLAS, not from the goal's prose. A route
     * goal of kind `collect-placement` carries the CELL; the entity standing in
     * that cell names the type, which is the same lookup the producer's
     * `placement(level, type)` does in reverse.
     */
    const src = ctx.atlasLevelSource();
    const collects = [];
    for (const g of step.goals) {
        if (g.kind !== 'collect-placement') continue;
        const ent = (src(step.level).entities ?? []).find(
            (e) => e.x === g.placement.x && e.y === g.placement.y);
        if (!ent) {
            growCannotAsk(`route step ${step.step} collects at `
                + `(${g.placement.x},${g.placement.y}) in L${step.level} and the atlas has `
                + 'no entity there, so the goal cannot be re-derived by the producer',
            'node scripts/procgen/survey-seedling-route.mjs --derive-only (the route and '
                + 'the atlas have to agree before a tape can be authored from either)');
        }
        collects.push(ent.type);
    }
    /**
     * ⛔ THE `why` IS DERIVED FROM THE SOLVE RECORD (⚖ ruling 17), never a hand
     * sentence: the rung, the room, the goals the atlas gave, and what the
     * solver actually spent. It is written into the tape's `description` by the
     * producer, so a `why` that described a different walk reds `--check`.
     */
    const why = `L${step.level} — grown by \`rerecord-seedling-campaign.mjs --grow\` at `
        + `route step ${step.step}: ${step.goals.map((g) => g.why).join('; ')}. The `
        + `survey's own solve is ${row.ticks} tick(s), ${row.traceRows} decision(s), `
        + `${row.replans} re-plan(s), passes [${(row.passes ?? [])
            .map((p) => p.kind).join(', ')}]`;

    const plan = { newName, level: step.level, to: step.crossesTo, collects, why,
        predecessor: tail.name, step: step.step };
    console.log('\n## ⛓ THE SURVEY SOLVES IT. The segment this growth appends:\n');
    console.log(`   name       ${plan.newName}`);
    console.log(`   rooms      L${plan.level} → L${plan.to}`);
    console.log(`   collects   ${plan.collects.join(', ') || '(nothing)'}`);
    console.log(`   why        ${plan.why}`);
    console.log('\n## THE SEVEN ARTIFACTS THIS GROWTH WRITES:\n');
    const artifacts = [
        `frontend/modules/seedlingDemo/campaignChain.js (the appended segment)`,
        `frontend/modules/seedlingDemo/fixtures/tapes/${plan.newName}.json`,
        `frontend/modules/seedlingDemo/fixtures/traces/${plan.newName}.trace.json`,
        `frontend/modules/seedlingDemo/fixtures/tapes/${plan.predecessor}.json `
            + '(re-emitted; ⛔ see THE ONE THING THIS COMMAND CANNOT DERIVE, below)',
        `frontend/modules/seedlingDemo/fixtures/expectations/${plan.newName}.json (S3)`,
        'frontend/modules/seedlingDemo/fixtures/tapes/index.json',
        'frontend/modules/seedlingDemo/fixtures/campaign-frontier.json',
    ];
    artifacts.forEach((a, i) => console.log(`   ${i + 1}. ${a}`));
    console.log('\n## THEN: the producer, S0..S5 over the whole chain, the reference '
        + 'regenerated, and `standing-values.mjs --write`.');

    /**
     * ⛔⛔⛔ THE ONE THING `--grow` CANNOT DERIVE, SAID OUT LOUD RATHER THAN
     * DISCOVERED LATER.
     *
     * Slice 12b″ had to rewrite the PREDECESSOR's `why` when it grew this
     * chain: `r9-solve-13`'s said *"the chain STOPS at L14, whose CAMERA BAND
     * the route survey refuses"*, and that went false the moment L14 solved.
     *
     * ⛔ AND NO GATE WOULD HAVE CAUGHT IT. §23c.4 says the producer's `--check`
     * reds on a stale `why` — true THEN, because the human had already changed
     * the declaration and the tape had not been re-emitted. It is NOT true of a
     * `why` that is stale in BOTH: the check compares the tape's `description`
     * against the declaration, so a sentence that is false about the world but
     * consistent between the two passes forever. A fixed point cannot see it
     * (trap: a fixed point tests self-consistency, never correctness).
     *
     * ⇒ this is a REVIEW ITEM, printed verbatim, and it is the one place a
     * growth still needs a human — but ⚖ RULING 39 (user, 2026-08-23: *"Yes, I
     * approve of that change for the why"*) shrinks the class it can bite: a
     * segment's `why` carries ONLY THE ROOM'S OWN STORY, and frontier-status
     * sentences live in `campaign-frontier.json` and the readout. A room story
     * does not decay when the chain grows past it. The print names the
     * convention so the reviewer knows what they are checking against.
     */
    console.log('\n## ⛔⛔ THE ONE THING THIS COMMAND CANNOT DERIVE — REVIEW IT:\n');
    console.log(`   ${plan.predecessor}'s \`why\` in campaignChain.js reads:\n`);
    console.log(`     "${tail.why}"\n`);
    console.log('   ⚖ RULING 39 (user, 2026-08-23) IS THE CONVENTION TO CHECK IT '
        + 'AGAINST: a segment\'s\n   `why` carries ONLY THE ROOM\'S OWN STORY. A '
        + 'FRONTIER-STATUS sentence — "the chain\n   stops here", "the refusal is the '
        + 'next work order" — belongs to `campaign-frontier\n   .json` and the readout, '
        + 'never to a `why`. A room story does not decay when the\n   chain grows past '
        + 'it; a status sentence does, which is the whole defect.\n');
    console.log('   ⛔ NO GATE CAN ANSWER THIS FOR YOU. The producer\'s `--check` '
        + 'compares the tape\'s\n   `description` against this declaration, so a sentence '
        + 'stale in BOTH is self-\n   consistent and passes forever. Slice 12b″\'s '
        + 'predecessor said "the chain STOPS\n   at L14, whose CAMERA BAND the route '
        + 'survey refuses" and it went FALSE. Edit\n   campaignChain.js before the growth '
        + 'if this one has.');

    if (DRY_RUN) {
        console.log('\n## --dry-run: PLANNED ONLY, nothing written.');
        return { plan, planned: artifacts, dryRun: true };
    }

    // ── 1. the declaration ────────────────────────────────────────────
    /**
     * ⛔⛔ THE APPEND IS REVERSIBLE UNTIL THE PRODUCER AGREES, and it has to be.
     * The survey's SOLVED verdict is a claim about a walk it found from a
     * STAGED boot; the producer solves the same room from its predecessor's
     * MEASURED LATCH, which is a different starting state. The survey saying
     * yes is therefore evidence, not a guarantee — and a `--grow` that left a
     * segment in the declaration after the producer refused it would leave a
     * chain naming a tape that does not exist, which is the one state the LAWS
     * say must never be pushed. So the pre-append text is kept, and a producer
     * refusal restores it: the command writes NOTHING.
     *
     * ⛓ ONLY THE FIRST STEP GETS THE REVERT. Once the producer has written
     * tapes, restoring the declaration would be a lie about what is on disk;
     * from there the growth is RESUMABLE and says so.
     */
    const before = readFileSync(CHAIN_DECL, 'utf8');
    appendSegment(plan);
    console.log(`\n  wrote ${CHAIN_DECL} — ${names.length} → ${names.length + 1} segments`);

    /**
     * ⛔⛔ EVERYTHING AFTER THE APPEND RUNS IN CHILD PROCESSES, and that is a
     * consequence rather than a style: this module imported `PLAYTHROUGH_CHAINS`
     * at load, so the chain THIS process holds is the one from BEFORE the
     * append. A pipeline run in-process would predict, measure and prove the
     * old chain while the declaration on disk said something else — the exact
     * shape of defect ⚖ ruling 38 (1) exists to remove. So the growth SHELLS
     * each stage, every one of them reading the declaration fresh.
     */
    /**
     * ⛓ `--from=`/`--to=` PASS THROUGH to the pipeline, and that is what makes
     * a growth REHEARSABLE. `--grow --to=S0` appends, authors the tapes and
     * runs the pipeline's OFFLINE prediction — no browser, no GPU — which is
     * the whole of what can honestly be checked in a scratch worktree: the dev
     * server serves ONE tree, so a browser stage entered from a second one
     * would drive the pages of the first and report about the wrong subject.
     */
    const passthrough = [`--run-dir=${ctx.runDir}`];
    if (process.argv.some((a) => a.startsWith('--from='))) passthrough.push(`--from=${FROM}`);
    if (process.argv.some((a) => a.startsWith('--to='))) passthrough.push(`--to=${TO}`);
    const steps = [
        ['the producer authors the new segment and re-emits its predecessor',
            [ctx.scriptPath('solve-seedling-r9-campaign.mjs')], 'grow-producer'],
        [`the pipeline ${FROM}..${TO} over the grown chain`,
            [ctx.scriptPath('rerecord-seedling-campaign.mjs'), ...passthrough],
            'grow-pipeline'],
    ];
    /**
     * ⛔⛔ THE FOUR SUMMARIES RUN ONLY AFTER A COMPLETE PIPELINE. `index.json`,
     * the frontier, the generated reference and the standing values all
     * DESCRIBE a finished tree. Writing them over a half-grown one would
     * publish a set of numbers for a state nobody proved — and `standing-
     * values.json` in particular is the artifact ⚖ ruling 32 A makes the next
     * slice's BEFORE, so a rehearsal that stamped it would hand the next slice
     * a baseline measured on an unfinished chain.
     */
    if (TO === 'S5') {
        steps.push(
            ['the tape index', [ctx.scriptPath('generate-tape-index.mjs')], 'grow-index'],
            ['the frontier, re-derived',
                [ctx.scriptPath('census-seedling-campaign.mjs'), '--write-frontier'],
                'grow-frontier'],
            ['the generated reference (the doc\'s chain table)',
                [ctx.scriptPath('generate-procgen-reference.mjs')], 'grow-reference'],
            ['the standing values, re-measured',
                [ctx.scriptPath('standing-values.mjs'), '--write'], 'grow-standing'],
        );
    } else {
        console.log(`\n## ⚠ REHEARSAL (--to=${TO}): the tape index, the frontier, the `
            + 'reference and the standing values are NOT written — they describe a '
            + 'FINISHED tree and this one is half-grown.');
    }
    const ran = [];
    for (const [what, args, log] of steps) {
        const r = shell(ctx, what, 'node', args, log);
        ran.push({ what, ok: r.ok, tally: r.tally });
        if (!r.ok && ran.length === 1) {
            writeFileSync(CHAIN_DECL, before);
            console.log(`\n## ⛔⛔ THE PRODUCER REFUSED ${plan.newName}, so the append is `
                + 'REVERTED and NOTHING is written.');
            console.log('## The survey solves this room from a STAGED boot; the producer '
                + 'solves it from its predecessor\'s MEASURED LATCH, and those are '
                + 'different starting states. The producer\'s refusal is the one that '
                + 'counts, because its walk is the one that would be recorded.');
            console.log(`## Read ${join(ctx.runDir, `${log}.log`)}.`);
            break;
        }
        if (!r.ok) {
            console.log(`\n## ⛔⛔ THE GROWTH STOPPED AT: ${what}`);
            console.log('## The declaration is APPENDED and the tree is HALF-GROWN. '
                + `Read ${join(ctx.runDir, `${log}.log`)}, fix, and re-enter with `
                + `\`--run-dir=${ctx.runDir}\` — every stage is resumable and the append is `
                + 'idempotent only in the sense that it has already happened: do not run '
                + '`--grow` twice.');
            break;
        }
    }
    console.log('\n## WHAT MOVED — hand this table to the as-built:\n');
    for (const r of ran) {
        console.log(`   ${r.ok ? 'PASS' : 'FAIL'}  ${r.what} — `
            + `${r.tally.PASS}/${r.tally.FAIL}/${r.tally.SKIP}`);
    }
    console.log('\n## and the seven artifacts above; `git status --porcelain` is the '
        + 'other half of the answer.');
    return { plan, planned: artifacts, dryRun: false, ran };
}

/**
 * ⛔ A SURGICAL APPEND, and it refuses rather than guessing where the list
 * ends: the declaration is source a human reads, so a growth edits it the way
 * a human would and leaves everything above untouched.
 */
function appendSegment(plan) {
    const text = readFileSync(CHAIN_DECL, 'utf8');
    const marker = '\n]);\n';
    const at = text.indexOf(marker, text.indexOf('export const CAMPAIGN_SEGMENTS'));
    if (at < 0) {
        throw new Error('⛔ campaignChain.js: the end of CAMPAIGN_SEGMENTS could not be '
            + 'found. The append is a text edit on a shape this command expects; a '
            + 'reformat of the declaration has to be matched here deliberately.');
    }
    const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    const wrapped = [];
    let line = '';
    for (const word of plan.why.split(' ')) {
        if (line && (line.length + word.length + 1) > 68) { wrapped.push(line); line = ''; }
        line = line ? `${line} ${word}` : word;
    }
    if (line) wrapped.push(line);
    const whySrc = wrapped.map((l, i) => (i === 0
        ? `        why: ${q(`${l} `)}`
        : `            + ${q(i === wrapped.length - 1 ? l : `${l} `)}`)).join('\n');
    const rowSrc = `    Object.freeze({\n`
        + `        name: '${plan.newName}', level: ${plan.level}, to: ${plan.to},`
        + `${plan.collects.length
            ? ` collects: Object.freeze([${plan.collects.map(q).join(', ')}]),` : ''}\n`
        + `${whySrc},\n`
        + `    }),`;
    writeFileSync(CHAIN_DECL, `${text.slice(0, at)}\n${rowSrc}${text.slice(at)}`);
}


/* ══════════════════════════════════════════════════════════════════════
 * ⚖ 54 (1) — `--latch-provisional`: ASK THE GAME BEFORE THE SERIES
 * ══════════════════════════════════════════════════════════════════════ */
/**
 * ⛓⛓⛓ R9 P1 — **S1's LATCH DRIVE FOR ONE SEGMENT, WITHOUT S0..S5.**
 *
 * Kickoff §33.2: a producer's `--check` latches the COMMITTED tape and only
 * its EMIT path latches the provisional one, so a walk the producers called
 * certified had never met the game. Three re-record attempts STOPPED at S1 on
 * exactly such a row, each after the GPU had been spent on its predecessors.
 * This asks the same question for ONE named segment, ahead of the series.
 *
 * ⛔⛔ **READ-ONLY BY DEFAULT, AND IT NEVER ENTERS A STAGE.** A cache miss
 * REPORTS `unasked` and exits 0; driving requires `--drive`, which is a GPU
 * row and is meant to be announced. It writes no tape, no expectation and no
 * trace — the only thing a `--drive` writes is the latch file in the
 * machine-global cache, which is that cache's job, and the run names the file.
 *
 * ⛔ THE FOREIGN-REF GUARD (§26.6's law, closed for this mode). `--branch=`
 * reads a tape out of a git object — no checkout, no worktree, so a slice's
 * tree is never detached under its owner. But the PAGE is the tree the dev
 * server is serving, and a tape from a ref whose game build differs would be
 * driven against the wrong game. So the ref's gitlink for the wasm submodule
 * must equal this tree's, and a difference is a REFUSAL BY NAME rather than a
 * green that means nothing.
 *
 * ⚠ THE MODEL COLUMN AND THE GAME COLUMN MUST BE ABOUT THE SAME WALK. The
 * model's arrival comes from the OWNING producer's `--check --walk-report` in
 * THIS tree; it is used only when that producer's own solve length equals the
 * tape's `tick_count`. Otherwise the row says the two are about different
 * walks and makes no model claim — which is exactly what a pre-flip branch
 * tape prints here, by name.
 */
function gitShow(ctx, ref, path) {
    try {
        return ctx.exec('git', ['show', `${ref}:${path}`],
            { cwd: ctx.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
        throw new Error(`⛔ ${ref} has no ${path} — ${(e.stderr || e.message).trim()}`);
    }
}

const WASM_SUBMODULE = 'frontend/modules/flashPanel/wasm';
function gitlinkOf(ctx, ref) {
    const out = ctx.exec('git', ['ls-tree', ref, WASM_SUBMODULE],
        { cwd: ctx.root, encoding: 'utf8' }).trim();
    const m = /^160000 commit ([0-9a-f]{40})\t/.exec(out);
    if (!m) throw new Error(`⛔ ${ref} declares no gitlink for ${WASM_SUBMODULE} — the game `
        + 'build a tape from it would be driven against cannot be established.');
    return m[1];
}

/**
 * The model's own word about every segment a participating producer owns, in
 * THIS tree. One `--check --walk-report` per producer; offline by measurement,
 * not by contract — both `latchOf` call sites in the two browser-driving
 * producers are `!CHECK`-guarded, so `--check` cannot reach the GPU.
 */
function walkReportsFor(ctx, files) {
    const out = new Map();
    for (const file of files) {
        const target = join(ctx.runDir,
            `provisional-walk-${file.replace(/\.mjs$/, '')}.json`);
        if (existsSync(target)) unlinkSync(target);
        try {
            ctx.exec('node', [ctx.scriptPath(file), CHECK_FLAG,
                `--walk-report=${target}`],
            { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
                maxBuffer: 256 * 1024 * 1024 });
        } catch { /* ⛔ a non-zero exit is the EXPECTED case: a moved walk fails
                     its own byte check. The verdict is the REPORT existing. */ }
        if (!existsSync(target)) continue;
        const report = JSON.parse(readFileSync(target, 'utf8'));
        for (const seg of report.segments ?? []) {
            out.set(seg.segment, { ...seg, producer: report.producer });
        }
    }
    return out;
}

function latchProvisional(ctx, names, { branch = null, drive = false }) {
    console.log('# ⚖ 54 (1) · --latch-provisional — the GAME\'s word on a walk, '
        + 'ahead of the series\n');
    const chains = accountingChains(ctx);
    const known = new Set(chains.flatMap((c) => [...c.segments, c.headline].filter(Boolean)));
    const unknown = names.filter((n) => !known.has(n));
    if (unknown.length) {
        console.log(`FAIL: ${unknown.join(', ')} — no chain declares this segment. The `
            + `declared set is: ${[...known].sort().join(', ')}`);
        failures += 1;
        return;
    }

    if (branch) {
        const here = gitlinkOf(ctx, 'HEAD');
        const there = gitlinkOf(ctx, branch);
        check(`⛓ ${branch} drives the same game build this tree serves`, here === there,
            here === there ? `${WASM_SUBMODULE} @${here.slice(0, 12)} on both sides`
                : `⛔ ${WASM_SUBMODULE} is ${there.slice(0, 12)} at ${branch} and `
                    + `${here.slice(0, 12)} here — the dev server serves ONE tree, so a `
                    + 'tape from that ref would be driven against a different game');
        if (here !== there) {
            console.log('⛔ STOP: refusing to drive a foreign build\'s tape against this '
                + 'tree\'s page.');
            return;
        }
    }

    const owners = nominateOwners(chains, { tapesDir: ctx.tapesDir });
    const wanted = new Set();
    for (const [file, segs] of owners) if (segs.some((x) => names.includes(x))) wanted.add(file);
    console.log(`## the model's word — ${[...wanted].join(', ') || '(no owner nominated)'}`);
    const model = walkReportsFor(ctx, [...wanted]);

    for (const name of names) {
        const raw = branch
            ? JSON.parse(gitShow(ctx, branch,
                `frontend/modules/seedlingDemo/fixtures/tapes/${name}.json`))
            : ctx.rawOf(name);
        const parsed = ctx.parseTape(raw);
        const projected = ctx.gameVisibleTape(parsed);
        const candidates = latchCacheCandidates(
            { complete: raw, projected, legacy: 'complete' });

        console.log(`\n## ${name}${branch ? ` @${branch}` : ''} — ${parsed.tick_count} tick(s)`);
        for (const c of candidates) {
            console.log(`   key ${c.key} (${c.era}) — ${c.why}`);
        }

        const cached = readLatchCache(ctx, name, candidates);
        let latch = cached.record;
        let hitBy = cached.hitBy;
        if (latch) {
            console.log(`   ⛓ CACHE HIT under ${hitBy.era} — ${hitBy.file}`);
            if (cached.rekeyed) {
                console.log(`   ⛓ RE-KEYED forward — WROTE ${cached.rekeyed} (the legacy `
                    + 'file is kept; this tape will hit under the new key from now on)');
            }
        } else if (drive) {
            console.log('   ⛔ CACHE MISS — DRIVING (this is the GPU row).');
            latch = ctx.driveLatch(name, raw);
            hitBy = { key: candidates[0].key, era: 'driven',
                file: join(ctx.cacheDir, `latch-${name}-${candidates[0].key}.json`) };
            console.log(`   ⛓ WROTE ${hitBy.file}`);
        } else {
            console.log(`   ⛔ CACHE MISS and no ${DRIVE_FLAG} — this row is \`unasked\`. `
                + 'A miss is NOT a pass: nobody has put this walk to the game.');
        }

        /**
         * ⛔ THE MODEL COLUMN IS ONLY ADMITTED WHEN IT IS ABOUT THIS WALK. A
         * producer in this tree that solves the room differently is reporting
         * a different walk's arrival, and a certification built on it would be
         * §33.2's defect with the sides swapped.
         */
        const reported = model.get(name) ?? null;
        let arrival = null;
        if (reported && reported.arrival && reported.solvedTicks === parsed.tick_count) {
            arrival = reported.arrival;
        } else if (reported && reported.arrival) {
            console.log(`   ⚠ the model column is NOT admitted: ${reported.producer} solves `
                + `${name} at ${reported.solvedTicks} t and this tape is `
                + `${parsed.tick_count} t — a different walk, so it makes no claim here`);
        } else if (reported) {
            console.log(`   ⚠ ${reported.producer} reported ${name} but offered no arrival `
                + '(a producer older than ⚖ 54 (1))');
        } else {
            console.log(`   ⚠ no participating producer in this tree reported ${name}`);
        }

        const findings = latch
            ? ctx.seamLatchFindings(latch.envelope, { requireCalm: true }) : null;
        const cert = certifyAgainstLatch({ latch, model: arrival, latchFindings: findings });
        for (const r of cert.rows) {
            console.log(`   ${r.ok ? '  ' : '⛔'} ${r.side.padEnd(5)} ${r.name.padEnd(14)} `
                + `${r.detail}`);
        }
        if (latch) {
            const seam = latch.envelope.seam;
            console.log(`   GAME: tick ${seam['latch.tick']} · L${seam.level} · `
                + `(${seam.playerPositionX}, ${seam.playerPositionY}) · `
                + `v=(${seam['arrival.velocity']?.vx}, ${seam['arrival.velocity']?.vy}) · `
                + `hits=${latch.hits} · ${latch.observations} observation(s)`);
        }
        if (arrival) {
            console.log(`   MODEL: L${arrival.level} (declared L${arrival.to ?? '—'}) · `
                + `ctor (${arrival.ctor?.x}, ${arrival.ctor?.y}) · `
                + `end (${arrival.end?.x}, ${arrival.end?.y}) · `
                + `v=(${arrival.velocity?.vx}, ${arrival.velocity?.vy}) · `
                + `hits=${arrival.hits} deaths=${arrival.deaths}`);
        }
        check(`${name}: certification`, cert.level !== 'REFUSED', certificationCell(cert));
    }
}


/* ══════════════════════════════════════════════════════════════════════
 * ⚖ 54 (2) — `--table`: THE PIPELINE PRODUCES THE TABLE A SEAL QUOTES
 * ══════════════════════════════════════════════════════════════════════ */
/**
 * ⛓⛓⛓ R9 P1 — **EVERY TABLE IN §30.6 / §31.6 / §32.5 / §33.3 WAS A HAND
 * TRANSCRIPTION OF A PRODUCER'S STDOUT**, and §33.2 is what happens when one
 * of those columns is later read as a verdict it never was. ⚖ 54 (2): the
 * pipeline prints it, and a seal QUOTES the instrument.
 *
 * ⛔ IT NEVER DRIVES AND IT NEVER WRITES A LATCH. The game column is read out
 * of the cache and says `unasked` when nobody has answered — which is the
 * third state the hand tables did not have. Asking the game is
 * `--latch-provisional`'s job, on purpose, one segment at a time.
 *
 * ⛓ `--branch=<ref>` ADDS A COLUMN rather than replacing one. "Committed" is
 * the tape on disk in this tree and `@ref` is the tape at that ref, so the
 * pair reads the way (D′)/(D″) were always written — 541 → 410 — and neither
 * number has to be carried in a human's head. The tapes come out of git
 * objects: no checkout, no worktree, so nobody's tree is detached under them.
 *
 * ⚠ THE MODEL COLUMN IS THIS TREE'S SOLVER. At a ref whose solver differs
 * (a pre-flip archive, say) it will not agree with the `@ref` column, and the
 * arrival is admitted only when the two lengths match — the row then says
 * `unasked` for the arrival rather than describing a different walk.
 */
async function table(ctx, { branch = null }) {
    const chains = accountingChains(ctx);
    const walk = await measureWalks(ctx, chains);
    const refTickOf = (segment) => {
        if (!branch) return null;
        try {
            return JSON.parse(gitShow(ctx, branch,
                `frontend/modules/seedlingDemo/fixtures/tapes/${segment}.json`)).tick_count ?? null;
        } catch { return null; }
    };
    const tapeAt = (segment) => {
        if (!branch) {
            return existsSync(join(ctx.tapesDir, `${segment}.json`))
                ? ctx.rawOf(segment) : null;
        }
        try {
            return JSON.parse(gitShow(ctx, branch,
                `frontend/modules/seedlingDemo/fixtures/tapes/${segment}.json`));
        } catch { return null; }
    };

    const rows = [];
    const seen = [
        ...walk.rows.map((r) => ({ ...r, measured: true })),
        ...walk.unmeasured.map((r) => ({ ...r, measured: false })),
    ].sort((a, b) => (a.chain === b.chain ? a.index - b.index
        : chains.findIndex((c) => c.id === a.chain) - chains.findIndex((c) => c.id === b.chain)));

    for (const r of seen) {
        const raw = tapeAt(r.segment);
        let latch = null;
        let hitBy = null;
        if (raw) {
            const projected = ctx.gameVisibleTape(ctx.parseTape(raw));
            const candidates = latchCacheCandidates(
                { complete: raw, projected, legacy: 'complete' });
            /**
             * ⛔ `rekey: false` — a TABLE reports, it does not tidy. The
             * forward re-key is `--latch-provisional`'s, where a human asked
             * for the answer.
             */
            const hit = readLatchCache(ctx, r.segment, candidates, { rekey: false });
            latch = hit.record;
            hitBy = hit.hitBy;
        }
        const refTicks = refTickOf(r.segment);
        const subjectTicks = branch ? refTicks : (r.committedTicks ?? null);
        const arrival = (r.arrival && r.solvedTicks === subjectTicks) ? r.arrival : null;
        const cert = certifyAgainstLatch({
            latch,
            model: arrival,
            latchFindings: latch
                ? ctx.seamLatchFindings(latch.envelope, { requireCalm: true }) : null,
        });
        rows.push({
            chain: r.chain,
            index: r.index,
            role: r.role,
            segment: r.segment,
            producer: r.producer ?? null,
            committedTicks: r.committedTicks ?? null,
            refTicks,
            modelTicks: r.solvedTicks ?? null,
            verdict: r.measured ? r.verdict : null,
            why: r.measured ? null : r.why,
            arrival,
            latch: latchCell(latch, hitBy),
            certification: cert.level,
            reasons: cert.reasons,
        });
    }

    const markdown = renderTableMarkdown(rows, { ref: branch });
    console.log(`\n# ⚖ 54 (2) · THE TABLE — ${rows.length} row(s)`
        + `${branch ? `, against \`${branch}\`` : ''}\n`);
    console.log(markdown);
    const mdPath = join(ctx.runDir, 'table.md');
    const jsonPath = join(ctx.runDir, 'table.json');
    writeFileSync(mdPath, `${markdown}\n`);
    writeFileSync(jsonPath, `${JSON.stringify({ ref: branch, rows }, null, 2)}\n`);
    console.log(`\n## ${mdPath}\n## ${jsonPath}`);
    const unasked = rows.filter((r) => r.certification === 'unasked'
        || r.certification === 'MODEL-CERTIFIED').length;
    console.log(`\n## ${rows.filter((r) => r.certification === 'GAME-CERTIFIED').length} `
        + `GAME-CERTIFIED · ${unasked} the game has NOT been asked about · `
        + `${rows.filter((r) => r.certification === 'REFUSED').length} REFUSED`);
    for (const st of walk.stops) console.log(`⚠ ${st}`);
    return { rows, markdown };
}

// ── the run ───────────────────────────────────────────────────────────
/**
 * ⛓ THE CONTEXT IS BUILT ONCE, HERE, ABOVE EVERY MODE — and above the header,
 * because the header names the run directory the context resolves. Its
 * defaults are today's values, so every line below runs against exactly the
 * subject it ran against before this seam existed.
 */
const CTX = await buildContext();

console.log(`# rerecord-seedling-campaign — ${READ_ONLY.length
    ? `${READ_ONLY.join(' ')} (READ-ONLY: no stage runs)` : `stages ${FROM}..${TO}`}`
    + `${DRY_RUN ? ' (--dry-run)' : ''}${NO_CACHE ? ' (--no-cache)' : ''}`);
console.log(`# run directory: ${CTX.runDir}\n`);

/**
 * ⛔⛔ THE READ-ONLY MODES RUN INSTEAD OF THE PIPELINE, NEVER BESIDE IT. A
 * caller who typed `--latch-provisional --from=S2` means one of two things and
 * the command must not pick; a stage flag alongside a read-only mode is a
 * REFUSAL BY NAME.
 */
if (READ_ONLY.length) {
    const conflicts = [
        GROW ? '--grow' : null,
        DRY_RUN ? '--dry-run' : null,
        LICENCE ? LICENSE_FLAG : null,
        process.argv.some((a) => a.startsWith('--from=')) ? '--from=' : null,
        process.argv.some((a) => a.startsWith('--to=')) ? '--to=' : null,
    ].filter(Boolean);
    if (READ_ONLY.length > 1 || conflicts.length) {
        console.log(`FAIL: ${READ_ONLY.join(' + ')}${conflicts.length
            ? ` with ${conflicts.join(', ')}` : ''} — the read-only modes answer a question `
            + 'ABOUT the pipeline and do not run it. Run one at a time, with no stage flag.');
        process.exit(1);
    }
}

if (PROVISIONAL_TOKEN !== undefined) {
    const value = PROVISIONAL_TOKEN === PROVISIONAL_FLAG
        ? '' : PROVISIONAL_TOKEN.slice(PROVISIONAL_FLAG.length + 1);
    const names = value.split(',').map((x) => x.trim()).filter(Boolean);
    if (!names.length) {
        console.log(`FAIL: ${PROVISIONAL_FLAG} needs a segment — `
            + `\`${PROVISIONAL_FLAG}=<segment>[,<segment>…]\`. It drives the GAME for the `
            + 'walk you name; a default over every segment is the shape that spent three '
            + 'runs of GPU before the game disagreed with the first row.');
        process.exit(1);
    }
    latchProvisional(CTX, names, { branch: BRANCH, drive: DRIVE });
    console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
    process.exit(failures ? 1 : 0);
}

if (TABLE) {
    await table(CTX, { branch: BRANCH });
    console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
    process.exit(failures ? 1 : 0);
}

if (GROW) {
    const g = await grow(CTX);
    console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
    process.exit(failures || (g.ran ?? []).some((r) => !r.ok) ? 1 : 0);
}

const s0 = wants('S0') ? await predict(CTX) : resume(CTX, 'S0');
// ⛓ S3 needs S1's state too now — the record set is the projection diff S1
//   snapshotted, so re-entering at `--from=S3` resumes S1 rather than guessing.
const s1 = wants('S1') ? measure(CTX, s0)
    : (wants('S2') || wants('S3') || wants('S5') ? resume(CTX, 'S1') : null);
const s2 = wants('S2') ? write(CTX, s0, s1)
    : (wants('S3') || wants('S5') ? resume(CTX, 'S2') : null);
if (wants('S3')) record(CTX, s0, s1, s2);
if (wants('S4')) prove(CTX);
if (wants('S5')) report(CTX, s0, s1, s2);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
