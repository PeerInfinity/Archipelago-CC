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
import { fileURLToPath } from 'node:url';

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

// ── the run ───────────────────────────────────────────────────────────
console.log(`# rerecord-seedling-campaign — stages ${FROM}..${TO}`
    + `${DRY_RUN ? ' (--dry-run)' : ''}${NO_CACHE ? ' (--no-cache)' : ''}`);
console.log(`# run directory: ${RUN_DIR}\n`);

const s0 = wants('S0') ? predict() : resume('S0');
const s1 = wants('S1') ? measure(s0) : (wants('S2') || wants('S5') ? resume('S1') : null);
const s2 = wants('S2') ? write(s0, s1) : (wants('S3') || wants('S5') ? resume('S2') : null);
if (wants('S3')) record(s2);
if (wants('S4')) prove();
if (wants('S5')) report(s0, s1, s2);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
