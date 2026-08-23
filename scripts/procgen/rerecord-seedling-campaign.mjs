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
 *  · THE CACHE IS KEYED ON THE COMPLETE BYTES, not on the game-visible
 *    projection: two different complete boots project to the same bytes
 *    (`tick0` is dropped), so a projection-keyed cache can hand the second
 *    one the first one's latch.
 *  · RESUMABLE. Each stage writes its state to the run directory with a
 *    `finished` flag, and `--from=`/`--to=` re-enter at a stage boundary.
 *
 * ── STAGES ────────────────────────────────────────────────────────────
 *   S0 PREDICT  offline; the sealed table. `--dry-run` stops here.
 *   S1 MEASURE  chain order, fresh page per segment + a zero-tick run per
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
    bootFromEnvelopeOnly, chainSubjects, latchCacheKey, mergePersistence, timedClearHazard,
} from './rerecordCampaign.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const MODULE = join(ROOT, 'frontend/modules/seedlingDemo');
const TAPES = join(MODULE, 'fixtures/tapes');

const { parseTape, gameVisibleTape } = await import(join(MODULE, 'tapeFormat.js'));
const { segmentBootFromLatch, seamLatchFindings } = await import(
    join(MODULE, 'r7Acceptance.js'));
const { PLAYTHROUGH_CHAINS } = await import(join(MODULE, 'playthroughWalk.js'));
const { rngPostureForBootLevel } = await import(join(MODULE, 'seamPosture.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));

const STAGES = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];
const arg = (name, dflt) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? dflt : hit.slice(name.length + 3);
};
const DRY_RUN = process.argv.includes('--dry-run');
/** ⚖ Ruling 38 (2), R9 slice 12d — the growth command. See `grow()` below. */
const GROW = process.argv.includes('--grow');
const NO_CACHE = process.argv.includes('--no-cache');
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

mkdirSync(RUN_DIR, { recursive: true });
let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};
/** ⛓ 7b's flush rule: a stage's state hits the disk the moment it exists. */
const flush = (stage, state) => {
    writeFileSync(join(RUN_DIR, `${stage}.json`),
        `${JSON.stringify({ finished: true, ...state }, null, 2)}\n`);
};
const resume = (stage) => {
    const p = join(RUN_DIR, `${stage}.json`);
    if (!existsSync(p)) {
        throw new Error(`⛔ ${stage} has no state in ${RUN_DIR}. A stage entered with `
            + `--from=${FROM} needs its predecessor's flushed state; run the earlier `
            + 'stage or point --run-dir at the run that produced it.');
    }
    const s = JSON.parse(readFileSync(p, 'utf8'));
    if (!s.finished) throw new Error(`⛔ ${stage}'s state is not marked finished`);
    return s;
};

const textOf = (label) => readFileSync(join(TAPES, `${label}.json`), 'utf8');
const rawOf = (label) => JSON.parse(textOf(label));
const tapeOf = (label) => parseTape(rawOf(label));

// ── S0 · PREDICT ──────────────────────────────────────────────────────
/**
 * ⛓ THE SUBJECT IS EVERY MULTI-SEGMENT CHAIN, derived from
 * `PLAYTHROUGH_CHAINS`. `chainSubjects` labels the ones that are CUSTODY
 * chains from a TRUE START — the shape ruling 11 asked for — but a STAGED
 * chain's later segments still boot their predecessors' latches, so their
 * boots are re-derived here too. ⛔ Nothing is typed.
 */
function subjects() {
    const custody = new Set(chainSubjects(PLAYTHROUGH_CHAINS, tapeOf).map((c) => c.id));
    return PLAYTHROUGH_CHAINS
        .filter((c) => (c.segments ?? []).length >= 2)
        .map((c) => ({
            id: c.id,
            kind: c.kind ?? 'custody',
            trueStartCustody: custody.has(c.id),
            segments: c.segments.slice(),
        }));
}

function predict() {
    console.log('# S0 · PREDICT — offline, no browser\n');
    const chains = subjects();
    check('⛓ the subject is DERIVED from PLAYTHROUGH_CHAINS',
        chains.length > 0,
        chains.map((c) => `${c.id}(${c.segments.length}${c.trueStartCustody
            ? ', true-start custody' : `, ${c.kind}`})`).join(' · '));

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
            const t = tapeOf(name);
            const hazard = timedClearHazard(t, i);
            const ownTimed = hazard.ownRoom.length > 0;
            if (ownTimed && firstHazard === -1) firstHazard = i;
            return { name, i, t, hazard, ownTimed };
        });
        for (const r of rows) {
            const posture = rngPostureForBootLevel(r.t.boot.level, atlasLevelSource());
            const bootMoves = firstHazard !== -1 && r.i > firstHazard;
            const tick0Moves = bootMoves || r.ownTimed;
            table.push({
                chain: chain.id,
                segment: r.name,
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
    }

    const licensed = table.filter((r) => r.verdict !== 'none').map((r) => r.segment);
    const tick0Set = table.filter((r) => r.tick0Rederived).map((r) => r.segment);
    console.log('\n## THE SEALED TABLE');
    for (const r of table) {
        console.log(`   ${r.chain.padEnd(14)} ${String(r.index + 1).padStart(2)} `
            + `${r.segment.padEnd(14)} L${String(r.bootLevel).padEnd(3)} `
            + `${r.verdict.padEnd(10)} tick0:${r.tick0Rederived ? 'RE-DERIVE' : 'keep     '} `
            + `${r.ownRoomTimedClears.length ? `own-timed[${r.ownRoomTimedClears}] ` : ''}`
            + `${r.posture.comparable ? '' : 'rng NOT COMPARABLE '}`);
    }
    console.log(`\n## THE LICENSED SET (boot writes): ${licensed.length} — `
        + `${licensed.join(', ') || '(empty)'}`);
    console.log(`## TICK-0 RE-DERIVATIONS: ${tick0Set.length} — ${tick0Set.join(', ')}`);
    check('⛓ no segment is predicted to move its WALK',
        table.every((r) => r.verdict !== 'walk-moves'),
        'a walk move is the user\'s licence, never this pipeline\'s');
    flush('S0', { licensed, tick0Set, table, rulingBase: 'ruling 23' });
    return { licensed, tick0Set, table };
}

// ── THE WINDOWS CHANNEL ───────────────────────────────────────────────
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const WSL = '/mnt/c/playwright';
const DOS = 'C:\\playwright';
const CACHE = join(WSL, 'rerecord-cache');

/**
 * ⛔ THE CACHE KEY IS THE COMPLETE TAPE. See `rerecordCampaign.latchCacheKey`
 * for why the game-visible projection is one field short of a safe key. A
 * cache HIT prints its key and the file it reused, so a reuse is never silent.
 */
function driveLatch(label, completeTape) {
    const key = latchCacheKey(completeTape);
    mkdirSync(CACHE, { recursive: true });
    const cached = join(CACHE, `latch-${label}-${key}.json`);
    if (existsSync(cached) && !NO_CACHE) {
        console.log(`    ${label}: latch REUSED key=${key} file=${cached}`);
        return JSON.parse(readFileSync(cached, 'utf8'));
    }
    const parsed = parseTape(completeTape);
    const shipped = JSON.stringify(gameVisibleTape(parsed));
    mkdirSync(WSL, { recursive: true });
    writeFileSync(join(WSL, 'seedling-bot-replay-win.py'),
        readFileSync(join(HERE, 'seedling-bot-replay-win.py')));
    writeFileSync(join(WSL, `rr-tape-${label}.json`), shipped);
    const outWsl = join(WSL, `rr-stream-${label}.json`);
    try { unlinkSync(outWsl); } catch { /* first run */ }
    const t0 = Date.now();
    let out;
    try {
        out = execFileSync('/mnt/c/Windows/py.exe', [
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

function measure(s0) {
    console.log('\n# S1 · MEASURE — the GAME, in chain order\n');
    let blockSetChecked = false;
    const chains = subjects();
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
            const complete = pending[name] ?? rawOf(name);
            if (k === chain.segments.length - 1) {
                measured[name] = measured[name] ?? { complete };
                continue;
            }
            const successor = chain.segments[k + 1];
            const rec = driveLatch(name, complete);
            const env = rec.envelope;
            const calm = seamLatchFindings(env, { requireCalm: true }).filter((r) => !r.ok);
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
                const got = Object.keys(segmentBootFromLatch(env)).sort();
                check('⛓ BOOT_BLOCKS is `segmentBootFromLatch`\'s own key set',
                    JSON.stringify(got) === JSON.stringify([...BOOT_BLOCKS].sort()),
                    `${got.join(',')} against ${[...BOOT_BLOCKS].sort().join(',')}`);
                if (failures) {
                    throw new Error('⛔ STOP: the projection authors a block this pipeline '
                        + 'does not write, so every write would be silently partial.');
                }
            }
            const succRaw = pending[successor] ?? rawOf(successor);
            const succCommitted = committedBlocks(parseTape(succRaw));
            /**
             * ⛓ `note` and `at` are re-attached BEFORE the diff, not after —
             * see `mergePersistence`. A diff run against the raw measured set
             * would report every segment's provenance prose as a mover and
             * would then WRITE the rows without it.
             */
            const project = (e) => {
                const b = segmentBootFromLatch(e);
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
    flush('S1', { boundaries, pending: measured });
    return { boundaries, measured };
}

// ── S2 · WRITE ────────────────────────────────────────────────────────
/**
 * ⛔ SURGICAL. The committed tapes are `JSON.stringify(obj, null, 4) + "\n"`
 * and that is MEASURED per file before anything is written — slice 8
 * reformatted twenty tapes by trusting `serializeTape`, whose two-space indent
 * and dropped `"note": ""` parse and replay and break byte-identity wholesale.
 * A file that does not round-trip is REFUSED rather than rewritten.
 */
function writeBoot(label, blocks) {
    const text = textOf(label);
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
    if (changed) writeFileSync(join(TAPES, `${label}.json`), after);
    return changed;
}

function write(s0, s1) {
    console.log('\n# S2 · WRITE — exactly the sealed set\n');
    const wrote = [];
    for (const [label, rec] of Object.entries(s1.pending ?? s1.measured ?? {})) {
        const blocks = committedBlocks(parseTape(rec.complete));
        const onTable = s0.licensed.includes(label);
        const moved = writeBootDry(label, blocks);
        if (moved && !onTable) {
            failures += 1;
            console.log(`FAIL: ${label} would move ${moved.join(', ')} and is not on the `
                + 'sealed table — the table IS the licence');
            continue;
        }
        if (!moved) continue;
        writeBoot(label, blocks);
        wrote.push({ label, fields: moved });
        console.log(`  wrote ${label}: ${moved.join(', ')}`);
    }
    check('⛓ every write is on the sealed table', failures === 0);
    /**
     * ⛓⛓ THE TICK-0 HALF IS THE OTHER INSTRUMENT'S JOB (trap 169 — one
     * producer per artifact). `derive-seedling-tick0.mjs` owns the v11 block:
     * it drives the ZERO-TICK variant of each segment's NEW boot and writes
     * the result surgically. It is run over its WHOLE derived set rather than
     * `--only=` the predicted movers, so the segments the table says should
     * NOT move are re-measured too and stand as the control.
     */
    const t0 = shell('the tick-0 blocks are re-derived from the NEW boots', 'node',
        ['scripts/procgen/derive-seedling-tick0.mjs']);
    flush('S2', { wrote, tick0: t0.ok });
    return { wrote };
}

/** The fields a write WOULD move, without moving them. */
function writeBootDry(label, blocks) {
    const obj = JSON.parse(textOf(label));
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
function shell(what, cmd, args, logName) {
    console.log(`\n$ ${cmd} ${args.join(' ')}`);
    const finish = (ok, out, status) => {
        const file = join(RUN_DIR, `${logName ?? what.replace(/\W+/g, '-')}.log`);
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
        const out = execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
        return finish(true, out, 0);
    } catch (e) {
        return finish(false, [e.stdout, e.stderr].filter(Boolean).join('\n'), e.status);
    }
}

function record(s2) {
    console.log('\n# S3 · RECORD — one --record over the licensed set\n');
    const set = (s2.wrote ?? []).map((w) => w.label);
    if (!set.length) {
        console.log('## nothing was written, so there is nothing to record.');
        flush('S3', { set: [], skipped: true });
        return;
    }
    shell('the differential RECORDS the licensed set', 'node',
        ['scripts/procgen/verify-seedling-bot-differential.mjs', '--win', '--record',
            `--only=${set.join(',')}`]);
    flush('S3', { set });
}

/**
 * ⛓ DERIVED, NEVER TYPED: every tape whose own `description` says a solver
 * authored it, plus the four hand witnesses the gate carries as controls.
 */
function solverRoster() {
    const names = readdirSync(TAPES)
        .filter((f) => f.endsWith('.json') && f !== 'index.json')
        .map((f) => f.slice(0, -5)).sort();
    const solver = names.filter((n) => /Authored by scripts\/procgen\/solve-seedling|LIVE SOLVER/i
        .test(rawOf(n).description || ''));
    return [...solver, 'r8-hammer-arm', 'r8-hammer-control',
        'r8-l18-spinner-press', 'r8-l6-bob-contact'];
}

function prove() {
    console.log('\n# S4 · PROVE — the chains play\n');
    const rows = [];
    rows.push(['the JS sequence gate', shell('the JS sequence gate', 'node',
        ['scripts/procgen/check-seedling-editor-sequence.mjs']).ok]);
    rows.push(['the census CONTINUES on every pair', shell('the census', 'node',
        ['scripts/procgen/census-seedling-campaign.mjs']).ok]);
    rows.push(['the wasm ship gate (CAMPAIGN arm)', shell('the wasm ship gate', 'node',
        ['scripts/procgen/check-seedling-wasm-ship.mjs']).ok]);
    /**
     * ⛓⛓⛓ THE SOLVER-ROSTER GATE IS THE GAME-INVISIBILITY CLAIM, and the
     * roster is DERIVED from the tapes' own provenance (a solver-authored
     * description) rather than named — ⚖ ruling 17, and the four hand
     * witnesses the gate has always carried alongside it.
     */
    const solver = solverRoster();
    console.log(`## the solver roster: ${solver.length} tape(s), derived`);
    rows.push(['the solver-roster differential', shell('the solver-roster differential',
        'node', ['scripts/procgen/verify-seedling-bot-differential.mjs', '--win',
            `--only=${solver.join(',')}`]).ok]);
    flush('S4', { rows });
    return rows;
}

// ── S5 · REPORT ───────────────────────────────────────────────────────
function report(s0, s1, s2) {
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
    console.log(`\n## written: ${(s2?.wrote ?? []).map((w) => w.label).join(', ') || '(none)'}`);
    console.log(`## run directory: ${RUN_DIR}`);
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
 * Run:
 *   node scripts/procgen/rerecord-seedling-campaign.mjs --grow --dry-run
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

async function grow() {
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
    if (names.includes(newName) || existsSync(join(TAPES, `${newName}.json`))) {
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
    const src = atlasLevelSource();
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
     * growth still needs a human. Deriving it is residue and would need the
     * `why` to be composed of parts a machine can check.
     */
    console.log('\n## ⛔⛔ THE ONE THING THIS COMMAND CANNOT DERIVE — REVIEW IT:\n');
    console.log(`   ${plan.predecessor}'s \`why\` in campaignChain.js reads:\n`);
    console.log(`     "${tail.why}"\n`);
    console.log('   Does that sentence survive the chain growing past it? Slice 12b″\'s '
        + 'predecessor said\n   "the chain STOPS at L14, whose CAMERA BAND the route '
        + 'survey refuses" and it went\n   FALSE. ⛔ No gate can tell you: the producer\'s '
        + '`--check` compares the tape\'s\n   `description` against this declaration, so a '
        + 'sentence stale in BOTH is self-\n   consistent and passes. Edit '
        + 'campaignChain.js before the growth if it has gone false.');

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
    const steps = [
        ['the producer authors the new segment and rewrites its predecessor\'s `why`',
            ['scripts/procgen/solve-seedling-r9-campaign.mjs'], 'grow-producer'],
        ['the pipeline S0..S5 over the grown chain',
            ['scripts/procgen/rerecord-seedling-campaign.mjs', `--run-dir=${RUN_DIR}`],
            'grow-pipeline'],
        ['the tape index', ['scripts/procgen/generate-tape-index.mjs'], 'grow-index'],
        ['the frontier, re-derived',
            ['scripts/procgen/census-seedling-campaign.mjs', '--write-frontier'],
            'grow-frontier'],
        ['the generated reference (the doc\'s chain table)',
            ['scripts/procgen/generate-procgen-reference.mjs'], 'grow-reference'],
        ['the standing values, re-measured',
            ['scripts/procgen/standing-values.mjs', '--write'], 'grow-standing'],
    ];
    const ran = [];
    for (const [what, args, log] of steps) {
        const r = shell(what, 'node', args, log);
        ran.push({ what, ok: r.ok, tally: r.tally });
        if (!r.ok && ran.length === 1) {
            writeFileSync(CHAIN_DECL, before);
            console.log(`\n## ⛔⛔ THE PRODUCER REFUSED ${plan.newName}, so the append is `
                + 'REVERTED and NOTHING is written.');
            console.log('## The survey solves this room from a STAGED boot; the producer '
                + 'solves it from its predecessor\'s MEASURED LATCH, and those are '
                + 'different starting states. The producer\'s refusal is the one that '
                + 'counts, because its walk is the one that would be recorded.');
            console.log(`## Read ${join(RUN_DIR, `${log}.log`)}.`);
            break;
        }
        if (!r.ok) {
            console.log(`\n## ⛔⛔ THE GROWTH STOPPED AT: ${what}`);
            console.log('## The declaration is APPENDED and the tree is HALF-GROWN. '
                + `Read ${join(RUN_DIR, `${log}.log`)}, fix, and re-enter with `
                + `\`--run-dir=${RUN_DIR}\` — every stage is resumable and the append is `
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

// ── the run ───────────────────────────────────────────────────────────
console.log(`# rerecord-seedling-campaign — stages ${FROM}..${TO}`
    + `${DRY_RUN ? ' (--dry-run)' : ''}${NO_CACHE ? ' (--no-cache)' : ''}`);
console.log(`# run directory: ${RUN_DIR}\n`);

if (GROW) {
    const g = await grow();
    console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
    process.exit(failures || (g.ran ?? []).some((r) => !r.ok) ? 1 : 0);
}

const s0 = wants('S0') ? predict() : resume('S0');
const s1 = wants('S1') ? measure(s0) : (wants('S2') || wants('S5') ? resume('S1') : null);
const s2 = wants('S2') ? write(s0, s1) : (wants('S3') || wants('S5') ? resume('S2') : null);
if (wants('S3')) record(s2);
if (wants('S4')) prove();
if (wants('S5')) report(s0, s1, s2);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
