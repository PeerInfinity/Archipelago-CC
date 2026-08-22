#!/usr/bin/env node
/**
 * derive-seedling-tick0 — THE v11 TICK-0 LATCH, MEASURED ONCE PER CHAIN
 * SEGMENT BY A ZERO-TICK FRESH-PAGE RUN. R9 slice 8, ⚖ ruling 20.
 *
 * ── WHAT THIS MEASURES, AND WHY ONLY THE GAME CAN ─────────────────────
 *
 * A segment tape declares its boot state PRE-BUILD: `botStart` applies
 * `rng`/`seam.time` ABOVE the deferred build (`Bot.as:1689`), and a FRESH
 * page then spends that declaration — it BUILDS the boot level (draws) and
 * pays the LOAD FADE (frames, and in a render-coupled room, more draws)
 * before the walk's first tick. A CONTINUATION does neither: `botStart`
 * skips the rebuild (`Bot.as:1722-1725`), so the live world at a boundary is
 * one whole build and one whole fade away from where the recording's walk
 * actually started.
 *
 * R9 slice 5 answered that by ZEROING the declaration on a continuation;
 * slice 6 by BUMPING `seam.time` by a derived constant. Both were
 * corrections standing in for a state nobody had measured. This instrument
 * measures it.
 *
 * ⛓⛓⛓ THE ZERO-TICK TAPE IS THE WHOLE TRICK, and it verifies by reading
 * `Bot.as` rather than by hoping:
 *
 *   1. the armed update gate returns early while `blackCover > 0 ||
 *      Game.freezeObjects`, counting `deadFrames++` and NOT advancing
 *      `tick` — so the WHOLE boot fade is spent BEFORE tick 0;
 *   2. on the first LIVE frame the observation at tick 0 is recorded;
 *   3. `if (tick >= tickCount)` — TRUE immediately when `tick_count` is 0 —
 *      fires `latchSeam`, which its own docblock places "AFTER the final
 *      observation ... and BEFORE this frame's `super.update()`".
 *
 * ⇒ a zero-tick tape's TERMINAL `seam` block IS the tick-0 reading: after
 * the fade, before any world update. The driver reads `botSeam` only once
 * `status.finished` is set, which is that same disarm.
 *
 * ⛔⛔ TWO CORRECTIONS `segmentBootFromLatch` MAKES THAT MUST NOT APPLY HERE,
 * and getting either wrong produces a field that parses, replays, and is
 * silently the WRONG STATE:
 *
 *   (1) it takes the four PRE-BUILD rows from `envelope.beginEntry`, because
 *       that is what a SUCCESSOR must declare. Fed the zero-tick envelope
 *       unchanged it would hand back that same boot's PRE-build reading —
 *       i.e. exactly what the tape ALREADY declares — and the tick-0 field
 *       would be a no-op duplicate whose every check passed vacuously. So
 *       the envelope is re-pointed: at tick 0 the build has HAPPENED, and
 *       "pre-build" and "current" are the same instant, which is the
 *       TERMINAL block.
 *   (2) it subtracts `BOOT_PRESWAP_FRAMES` from `save.time`, because a boot
 *       DECLARATION is a pre-swap quantity. A tick-0 reading is not a
 *       declaration to boot from — it is a literal state the page WRITES
 *       through `Main.time = seamTime`, on a continuation that neither
 *       rebuilds nor pays the pre-swap frame. Uncorrected, every written
 *       clock would be one frame short.
 *
 * ⛔ THE SET IS DERIVED, NEVER TYPED (⚖ ruling 17). Every segment of every
 * chain in `PLAYTHROUGH_CHAINS` with two or more segments — 20 today, over
 * THREE chains (`toy-west-pair` 2, `r8-d2` 3, `r9-campaign` 15). The script
 * REFUSES to write any tape outside that set.
 *
 * ⛔ THE TAPE IS THE ARTIFACT. The block is written INTO the segment's own
 * tape; there is no sidecar duplicating it (⚖ ruling 17).
 *
 * ── THE CHECK ────────────────────────────────────────────────────────
 *
 * `tick0.seam.time == declared + LOAD_FADE_FRAMES + BOOT_PRESWAP_FRAMES`
 * (= +21) is slice 6's (d′) constant, DEMOTED from a value the page adds to
 * a prediction the measurement judges. Where it holds, the room's boot is
 * render-clean in the clock's sense; where it does not, the DELTA is
 * published by name rather than rounded away.
 *
 * ⚠ THE RNG HALF HAS NO SUCH PREDICTION. Build draws are a property of the
 * level's own construction and fade draws exist only in render-coupled
 * rooms; nothing on disk derives either. The measured value is the answer,
 * and `seamRngPosture` says at which boundaries it can be ASSERTED.
 *
 * Run (the derivation needs Windows Chrome and a dev server on :8000):
 *   node scripts/procgen/derive-seedling-tick0.mjs --list     # the set, no game
 *   node scripts/procgen/derive-seedling-tick0.mjs --check    # re-derives NOTHING
 *   node scripts/procgen/derive-seedling-tick0.mjs            # drives + writes
 *   node scripts/procgen/derive-seedling-tick0.mjs --only=r8-solve-6
 */

import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');
const LIST_ONLY = process.argv.includes('--list');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '')
    .slice('--only='.length).split(',').filter(Boolean);
/**
 * ⛓ `--no-cache` — THE REPRODUCIBILITY CONTROL. The cache exists so a re-run
 * costs nothing; this flag exists so "the same tape measured twice gives the
 * same answer" can be ASKED. A tick-0 reading that moves between two runs is
 * not a state to commit, and the only way to find out is to drive it twice.
 */
const NO_CACHE = process.argv.includes('--no-cache');
/** `--dry-run` measures and reports, and writes NOTHING. */
const DRY_RUN = process.argv.includes('--dry-run');

const { parseTape, serializeTape, gameVisibleTape, requiredTapeVersion } =
    await import(join(MODULE, 'tapeFormat.js'));
const { segmentBootFromLatch, seamLatchFindings, BOOT_PRESWAP_FRAMES, seamRngPosture } =
    await import(join(MODULE, 'r7Acceptance.js'));
const { LOAD_FADE_FRAMES } = await import(join(MODULE, 'gameClock.js'));
const { PLAYTHROUGH_CHAINS, chainKind } = await import(join(MODULE, 'playthroughWalk.js'));
const { rngPostureOf } = await import(join(MODULE, 'r6Acceptance.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildLevelWorld } = await import(join(MODULE, 'levelWorld.js'));

/**
 * ⛓ `bootCost` STAYS DERIVED AND BECOMES A CHECK (⚖ ruling 20). It is the
 * same sum `watchWasm.BOOT_COST_FRAMES` is, imported from the two modules
 * that own the halves rather than typed as 21 in a third place.
 */
const BOOT_COST = LOAD_FADE_FRAMES + BOOT_PRESWAP_FRAMES;

// ── THE DERIVED SET ───────────────────────────────────────────────────

/**
 * ⛔ EVERY SEGMENT OF EVERY MULTI-SEGMENT CHAIN, read out of
 * `PLAYTHROUGH_CHAINS`. Not a list, not a count, and not the "18" the brief
 * predicted — `toy-west-pair` is a third multi-segment chain and its second
 * segment is a genuine continuation (it declares a `seam.time` and an rng
 * triple), so the derivation says TWENTY.
 *
 * ⚠ INDEX 0 IS IN THE SET TOO. Segment 0 of a chain is never a continuation
 * window, so it never has its tick-0 state written — but the field is
 * uniform, the missing-field refusal then needs no `k > 0` carve-out, and
 * the two TRUE STARTS (`r8-solve-1`, `r7-ends-meet-1`) are the only rooms
 * whose tick-0 clock has no declared term to check against, which is a fact
 * worth measuring rather than skipping.
 */
function derivedSet() {
    const rows = [];
    for (const chain of PLAYTHROUGH_CHAINS) {
        if (chain.segments.length < 2) continue;
        chain.segments.forEach((name, index) => rows.push({
            chain: chain.id, kind: chainKind(chain), index, name,
            segments: chain.segments.length,
        }));
    }
    return rows;
}

const SET = derivedSet();
const IN_SET = new Set(SET.map((r) => r.name));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const tapePath = (name) => join(TAPES, `${name}.json`);
const readTape = (name) => parseTape(JSON.parse(readFileSync(tapePath(name), 'utf8')));

/** The boot room's seam posture — CLEAN means the rng row is comparable. */
function postureOf(level) {
    const source = atlasLevelSource();
    const tiles = [...new Set(
        buildLevelWorld(source(level), { roles: ['blocking'] }).tiles.map((t) => t.t))];
    const p = rngPostureOf(source(level), tiles);
    return seamRngPosture(p.renderCoupled, p.consumers);
}

// ── THE ZERO-TICK VARIANT ─────────────────────────────────────────────

/**
 * The same tape with its WALK removed and everything that declares the
 * world kept. ⛔ `expect`/`observations` are dropped: they describe a walk
 * that is not being taken, and a zero-tick tape carrying a 294-tick
 * expectation would refuse before the browser opened.
 */
function zeroTickVariant(tape) {
    const raw = JSON.parse(serializeTape(tape));
    delete raw.expect;
    delete raw.observations;
    raw.inputs = [];
    raw.tick_count = 0;
    // ⚠ A FORWARD TIMED ROW GOES TOO. `{5,0}@427` is a clear this walk EARNS
    // at tick 427; a zero-tick run never reaches it, and declaring it would
    // hand the game a clear at boot — the ledger rebuild ⚖ ruling 14's timed
    // rule exists to prevent.
    if (Array.isArray(raw.persistence)) {
        raw.persistence = raw.persistence.filter((c) => c.at === undefined);
    }
    // ⚠ And the tick-0 block itself, if the tape already carries one: the
    // derivation must measure the GAME, never re-read its own last answer.
    delete raw.tick0;
    return parseTape(raw);
}

// ── THE WINDOWS CHANNEL ───────────────────────────────────────────────

const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');
const CACHE = join(WIN_SCRATCH_WSL, 'tick0-cache');

/**
 * ⛓ THE CACHE IS KEYED ON THE BYTES DRIVEN, on `latchOf`'s precedent. A
 * re-run that changes nothing costs nothing; a tape whose boot moved by one
 * byte is a different key and is re-driven. ⛔ It is keyed on the ZERO-TICK
 * variant, which is what the game actually saw — not on the segment tape,
 * whose walk the derivation deliberately discarded.
 */
function cacheKey(bytes) {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i += 1) {
        h ^= bytes.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `${h.toString(16).padStart(8, '0')}-${bytes.length}`;
}

function driveZeroTick(label, zeroTape) {
    const shipped = JSON.stringify(gameVisibleTape(zeroTape));
    const key = cacheKey(shipped);
    mkdirSync(CACHE, { recursive: true });
    const cached = join(CACHE, `${label}-${key}.json`);
    if (existsSync(cached) && !NO_CACHE) {
        console.log(`    ${label}: CACHED (${key})`);
        return JSON.parse(readFileSync(cached, 'utf8'));
    }
    mkdirSync(WIN_SCRATCH_WSL, { recursive: true });
    writeFileSync(join(WIN_SCRATCH_WSL, 'seedling-bot-replay-win.py'),
        readFileSync(WIN_DRIVER));
    const outWsl = join(WIN_SCRATCH_WSL, `tick0-${label}.json`);
    writeFileSync(join(WIN_SCRATCH_WSL, `tick0-tape-${label}.json`), shipped);
    try { unlinkSync(outWsl); } catch { /* first run */ }
    const t0 = Date.now();
    let out;
    try {
        out = execFileSync(WIN_PY, [
            '-3.12', `${WIN_SCRATCH_DOS}\\seedling-bot-replay-win.py`,
            '--url', PAGE_URL,
            '--tape', `${WIN_SCRATCH_DOS}\\tick0-tape-${label}.json`,
            '--out', `${WIN_SCRATCH_DOS}\\tick0-${label}.json`,
            // A zero-tick tape finishes on its first live frame; the whole
            // cost is the page load and the fade. 120 s is the page, not the
            // walk.
            '--deadline-sec', '120',
        ], { cwd: WIN_SCRATCH_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        const said = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`${e.message}${said ? `\n${said}` : ''}`);
    }
    out.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
        .forEach((l) => console.log(`    ${l}`));
    if (!existsSync(outWsl)) throw new Error(`the driver wrote no stream for ${label}`);
    const got = JSON.parse(readFileSync(outWsl, 'utf8'));
    if (!got.seam) throw new Error(`${label}: the driver returned no seam block`);
    console.log(`    drove ${label}: ${got.stream.ticks.length} observation(s), `
        + `${got.status.dead_frames} dead, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    writeFileSync(cached, JSON.stringify(got));
    return got;
}

// ── THE PROJECTION ────────────────────────────────────────────────────

/**
 * The tick-0 envelope, projected to the tape's own two channels.
 *
 * ⛔ THE ENVELOPE IS RE-POINTED, and the docblock at the top of this file
 * says why: `segmentBootFromLatch` reads the four PRE-BUILD rows out of
 * `beginEntry`, which at tick 0 is the reading the tape already declares.
 * The terminal block IS the post-build instant, so it stands in for both.
 */
function tick0BlockFromEnvelope(envelope) {
    const projected = segmentBootFromLatch({ ...envelope, beginEntry: envelope.seam });
    return {
        rng: {
            seed: projected.rng.seed,
            split: projected.rng.split,
            cosmetic: projected.rng.cosmetic,
            fp: projected.rng.fp,
        },
        // ⛔ THE PRE-SWAP FRAME IS ADDED BACK. `segmentBootFromLatch`
        // subtracts it to author a BOOT declaration; a tick-0 reading is a
        // literal state the page writes, and a continuation pays no pre-swap
        // frame. Uncorrected this is one frame short at every boundary.
        seam: { time: projected.seam.time + BOOT_PRESWAP_FRAMES },
    };
}

/**
 * ⛔⛔⛔ THE WRITE IS SURGICAL, AND `serializeTape` IS **NOT** THE AUTHOR.
 *
 * Measured, on the first attempt at this: re-emitting a committed segment
 * through `serializeTape` rewrote all twenty tapes wholesale. Two reasons,
 * both invisible until the diff was read:
 *
 *   1. `serializeTape` indents with TWO spaces; every committed tape is
 *      FOUR (the producers' own `JSON.stringify(..., null, 4)`), so every
 *      line reflowed;
 *   2. it writes `note` only when truthy, and the committed persistence rows
 *      carry `"note": ""` — so each row silently lost a key.
 *
 * The result parsed, replayed and would have passed a naive "does it still
 * load" check while breaking ⚖ ruling 20's own law that everything but the
 * new field is BYTE-IDENTICAL. So this instrument does not re-author: it
 * reads the committed TEXT, changes exactly two things — `tape_version` and
 * the new `tick0` block — and re-emits with the formatting the file already
 * had. `JSON.parse` preserves key order, and the identity
 * `JSON.stringify(JSON.parse(text), null, 4) + "\n" === text` is MEASURED
 * over all twenty pristine tapes rather than assumed (it holds, 20/20).
 *
 * ⚠ The block is inserted AFTER `seam` and BEFORE `tick_count`, which is
 * where `serializeTape` puts it too — the two emitters disagree about
 * whitespace, not about order.
 *
 * ⛔⛔ AND THE BUMP ADDS A **SECOND** KEY, WHICH THE BRIEF DID NOT PREDICT:
 * `despawn` is MANDATORY from v10 up (`parseDespawns`: "[] when nothing is
 * removed"), and all twenty segments are v8 or v9, so none carries it. A v11
 * tape therefore has to declare `despawn: []`. That is the tape format's own
 * rule rather than a choice made here — every version's fields have been
 * mandatory from that version on since v2 — and `[]` is exactly what these
 * tapes have always MEANT. It is reported as a delta rather than dodged by
 * relaxing v10's guard, which is not this slice's to relax. `inputs`,
 * expectations and the trace sidecars are untouched, which is the law's
 * actual subject.
 */
function withTick0(text, block, label) {
    const obj = JSON.parse(text);
    if (JSON.stringify(JSON.parse(text), null, 4) + '\n' !== text) {
        throw new Error(`${label}: the committed tape does not round-trip through `
            + 'a 4-space re-emit, so a surgical write would reformat it. Refusing '
            + 'rather than rewriting a file this instrument does not own the shape of.');
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k === 'tape_version') { out[k] = 11; continue; }
        if (k === 'tick0') continue;          // replaced below, never duplicated
        // `despawn` rides where `serializeTape` puts it — after `persistence`,
        // before `equips` — so a v11 tape and a re-serialized one agree.
        if (k === 'equips' && obj.despawn === undefined) out.despawn = [];
        if (k === 'tick_count') out.tick0 = block;
        out[k] = v;
    }
    if (out.despawn === undefined) out.despawn = [];
    if (out.tick0 === undefined) out.tick0 = block;   // a tape with no tick_count key
    // ⛔ AND THE RESULT MUST PARSE AS THE v11 TAPE IT CLAIMS TO BE. A
    // surgical write that produced an unparseable tape would be caught by
    // the next reader instead of by its author.
    const reparsed = parseTape(JSON.parse(JSON.stringify(out)));
    if (reparsed.tape_version !== 11 || reparsed.tick0 === null) {
        throw new Error(`${label}: the surgical write did not produce a v11 tape `
            + `carrying a tick-0 latch (got v${reparsed.tape_version}, `
            + `tick0 ${reparsed.tick0 === null ? 'null' : 'present'})`);
    }
    if (requiredTapeVersion(reparsed) !== 11) {
        throw new Error(`${label}: requiredTapeVersion says `
            + `${requiredTapeVersion(reparsed)}, not 11`);
    }
    return `${JSON.stringify(out, null, 4)}\n`;
}

// ── THE RUN ───────────────────────────────────────────────────────────

const selected = SET.filter((r) => ONLY.length === 0 || ONLY.includes(r.name));
for (const name of ONLY) {
    if (!IN_SET.has(name)) {
        console.log(`FAIL: --only names "${name}", which is not a segment of any `
            + 'multi-segment chain in PLAYTHROUGH_CHAINS. This instrument writes '
            + 'ONLY the derived set; a tape outside it has no boundary to be '
            + 'continued across and no reason to carry a tick-0 latch.');
        failures += 1;
    }
}

console.log(`## THE DERIVED SET — ${SET.length} segments over `
    + `${new Set(SET.map((r) => r.chain)).size} multi-segment chains, `
    + `read from PLAYTHROUGH_CHAINS`);
for (const r of SET) {
    const t = readTape(r.name);
    const posture = postureOf(t.boot.level);
    console.log(`  ${r.chain.padEnd(13)} ${String(r.index).padStart(2)}/${r.segments} `
        + `${r.name.padEnd(14)} bootL${String(t.boot.level).padEnd(3)} `
        + `declared=${t.seam?.time ?? 'NONE (true start)'} `
        + `${r.index === 0 ? '(never a continuation)' : (posture.comparable
            ? 'rng ASSERTED' : 'rng NOT COMPARABLE')}`);
}

if (LIST_ONLY) process.exit(failures ? 1 : 0);

let wrote = 0;
for (const row of selected) {
    const tape = readTape(row.name);
    const declared = tape.seam?.time ?? null;
    const posture = postureOf(tape.boot.level);

    if (CHECK) {
        /**
         * ⛔ `--check` RE-DERIVES NOTHING. It asserts that every segment of
         * every multi-segment chain CARRIES the field and that its clock
         * obeys the (d′) identity — which is exactly the claim a reader
         * needs and costs no GPU. A gate that had to drive twenty browsers
         * to say "yes" would never be run (trap 474).
         */
        check(`${row.name} carries a tick-0 latch`, tape.tick0 !== null,
            tape.tick0 === null
                ? '⛔ MISSING — run `node scripts/procgen/derive-seedling-tick0.mjs '
                    + `--only=${row.name}` + '` (Windows Chrome + a dev server on :8000)'
                : `rng.seed ${tape.tick0.rng.seed}, seam.time ${tape.tick0.seam.time}`);
        if (tape.tick0 === null) continue;
        check(`${row.name} is stamped v11`, tape.tape_version === 11,
            `tape_version ${tape.tape_version}; requiredTapeVersion says `
            + `${requiredTapeVersion(tape)}`);
        if (declared === null) {
            console.log(`  ⚠ ${row.name} is a TRUE START — it declares no \`seam\`, so `
                + `its tick-0 clock (${tape.tick0.seam.time}) has NO declared term to `
                + 'check against. The measured value is the whole answer.');
        } else {
            const delta = tape.tick0.seam.time - declared;
            check(`${row.name}'s tick-0 clock is declared + bootCost`, delta === BOOT_COST,
                `declared ${declared} + ${BOOT_COST} = ${declared + BOOT_COST}, `
                + `measured ${tape.tick0.seam.time} (delta ${delta})`);
        }
        continue;
    }

    if (!IN_SET.has(row.name)) {
        throw new Error(`refusing to write ${row.name}: not in the derived set`);
    }
    console.log(`\n## ${row.name} — zero-tick fresh-page run (boot L${tape.boot.level}, `
        + `${posture.comparable ? 'render-CLEAN' : 'render-COUPLED'})`);
    const zero = zeroTickVariant(tape);
    const got = driveZeroTick(row.name, zero);

    /**
     * ⛔ A LATCH THAT IS NOT A CALM ARRIVAL IS A STOP, on
     * `solve-seedling-r8-d2-chain.carryFromLatch`'s precedent: a tick-0
     * state measured mid-fade or mid-freeze is a state no continuation
     * reproduces, and writing it would put a number nobody measured into a
     * committed tape.
     */
    const calm = seamLatchFindings(got.seam, { requireCalm: true });
    const notCalm = calm.filter((r) => !r.ok);
    check(`${row.name}'s zero-tick run ends at a CALM ARRIVAL`, notCalm.length === 0,
        notCalm.length === 0
            ? `latched at tick ${got.seam.seam['latch.tick']}, `
                + `${got.status.dead_frames} dead frames`
            : notCalm.map((r) => `${r.name} [${r.detail}]`).join('; '));
    if (notCalm.length) continue;

    /**
     * ⛓ THE TICK IS 0, ASSERTED. The whole construction rests on the disarm
     * happening on the first LIVE frame; a latch at any other tick means the
     * dead-frame gate or the disarm moved and the block is not a tick-0
     * reading at all.
     */
    check(`${row.name}'s latch is at TICK 0`, got.seam.seam['latch.tick'] === 0,
        `latch.tick ${got.seam.seam['latch.tick']}`);

    const block = tick0BlockFromEnvelope(got.seam);
    if (declared === null) {
        console.log(`  ⚠ TRUE START — no declared \`seam.time\`; measured tick-0 clock `
            + `${block.seam.time}, dead frames ${got.status.dead_frames}`);
    } else {
        const delta = block.seam.time - declared;
        check(`${row.name}'s tick-0 clock is declared + bootCost`, delta === BOOT_COST,
            `declared ${declared} + ${BOOT_COST} = ${declared + BOOT_COST}, `
            + `measured ${block.seam.time} (delta ${delta})`);
    }
    console.log(`  tick0 rng {seed ${block.rng.seed}, cosmetic ${block.rng.cosmetic}, `
        + `fp ${block.rng.fp}} vs declared {seed ${tape.rng.seed}, `
        + `cosmetic ${tape.rng.cosmetic}, fp ${tape.rng.fp}}`);

    const have = readFileSync(tapePath(row.name), 'utf8');
    const json = withTick0(have, block, row.name);
    if (DRY_RUN) {
        console.log(`  DRY RUN — would ${have === json ? 'leave unchanged' : 'write'} `
            + `${tapePath(row.name)}`);
    } else if (have === json) {
        console.log(`  unchanged (${json.length} bytes)`);
    } else {
        writeFileSync(tapePath(row.name), json);
        wrote += 1;
        console.log(`  wrote ${tapePath(row.name)} (${have.length} -> ${json.length} bytes)`);
    }
}

if (!CHECK && !LIST_ONLY) {
    console.log(`\n## ${wrote} tape(s) written of ${selected.length} driven. `
        + '⛔ Regenerate the manifest in the SAME commit: '
        + 'node scripts/procgen/generate-tape-index.mjs');
}
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures ? 1 : 0);
