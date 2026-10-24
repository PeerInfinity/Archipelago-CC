#!/usr/bin/env node
/**
 * check-seedling-producer-boundaries — **A CHAIN BOUNDARY IS CHECKED FROM THE
 * PREDECESSOR, OR IT IS REFUSED BY NAME.** R9 slice P3, ⚖ ruling 54 (6),
 * §42.5 / §42.10's fourth item.
 *
 * ── ⛔⛔⛔ THE DEFECT THIS EXISTS FOR (trap 769) ──────────────────────
 *
 * `solve-seedling-r9-campaign.mjs` and `solve-seedling-r8-d2-chain.mjs` both
 * carry this clause:
 *
 *   > *"⚠ UNDER `--check` THE SUCCESSOR READS ITS OWN COMMITTED BOOT rather
 *   > than re-driving the game for it … A latch that HAS changed shows up as a
 *   > byte diff, which is the check."*
 *
 * The second sentence is false, and §42.5 measured it false. Under `--check`
 * each segment's boot comes from ITS OWN committed tape; under emit it is
 * derived from the PREDECESSOR's measured latch. So the check compares the
 * tape against a derivation **seeded from that same tape** — a FIXED POINT,
 * which tests self-consistency and never correctness
 * ([[feedback_fixed_point_is_not_correctness]]). At `r9/re-record-attempt-5`
 * `73bf6d724` the campaign producer's `--check` is GREEN while its own emit
 * rewrites `r9-solve-13.rng.seed` and `r9-solve-14.rng.seed` — the committed
 * tape being a SPLICE of two internally coherent chains.
 *
 * ⛓ THE REPAIR IS NOT INSIDE `--check`, AND THAT IS DELIBERATE. Printing a
 * third verdict there would write a line whose CONTENT is *which latches this
 * machine happens to hold*, and ⚖ ruling 8 publishes each producer's `--check`
 * stdout md5 as a byte-inertia fingerprint. R9 slice 9 already caught a
 * wall-clock line making one of those a property of the machine. A gate's rows
 * are its own output and carry no such fingerprint, so the third verdict lives
 * HERE and the producers' seven md5s do not move.
 *
 * ── WHAT IT ASSERTS ──────────────────────────────────────────────────
 *
 * For every boundary of every multi-segment chain: derive the successor's boot
 * from the PREDECESSOR's cached latch — the same envelope the producer's emit
 * path derives from, found under the same key the pipeline computes — and
 * compare it FIELD BY FIELD against the successor's committed blocks.
 *
 *   PASS:  VERIFIED   — derived from a latch of the predecessor's own bytes,
 *                       and equal to the committed boot.
 *   FAIL:  DISAGREES  — derived and DIFFERENT. This is §42's case.
 *   SKIP:  REFUSED    — no latch for the predecessor's bytes on this machine.
 *                       ⛔ NOT A PASS, and it never prints as one. The gate
 *                       names every key it looked for and every directory it
 *                       looked in, so the reader can tell "checked and equal"
 *                       from "could not be asked" — which is precisely what
 *                       §42.5b's `unasked` column exists to say.
 *
 * ⛓ THE THREE STATES ARE THE STANDING ROW. `standingValues.headlineOf` counts
 * `^PASS:` / `^FAIL:` / `^SKIP:` prefixes into `pass/fail/skip`, so this gate's
 * standing value carries all three counts with no new machinery, and a RISE in
 * REFUSED on this box is a row move rather than a silence.
 *
 * ── ⛔ WHY A REFUSAL DOES NOT EXIT NON-ZERO ───────────────────────────
 *
 * The latch cache is MACHINE-GLOBAL (⚖ 47b (5)) and exists on exactly one box.
 * A gate that failed on its ABSENCE would be red on every other machine and in
 * CI, and would therefore gate nothing anywhere. Absence of evidence is not
 * evidence of a defect — so the exit code is non-zero ONLY for a boundary that
 * was actually derived and actually disagreed, and the refusals are loud,
 * counted, and never called green.
 *
 * ── ⛔⛔ THE BOUND, AND WHAT IT EXCLUDES (trap 771) ───────────────────
 *
 * The comparison set is `segmentBootFromLatch`'s OWN returned keys, read off
 * the object at run time rather than retyped: `boot, save, persistence, pins,
 * rng, seam`. A tape ALSO carries `tick0`, `grants`, `despawn`, `equips`,
 * `noclip`, `noDamage`, `noHazards` — **a latch has no opinion about any of
 * them**, so they are neither produced nor refused here: they are simply not in
 * this conversation, and this gate PRINTS that sentence rather than letting a
 * "0 moved" line imply a coverage it does not have.
 *
 * ⛓ AND `persistence` IS COMPARED AS THE INHERITED CLEARED SET. A successor's
 * timed `at` row is its OWN solve's output (`twoPassSolve` earns it during the
 * walk, not before it) and `note` is prose the game never reads, so comparing
 * whole rows would red on every boundary for two fields no latch can produce.
 * What the latch DOES carry is which `{level, tag}` slots stand cleared at the
 * seam, and that is what is compared. The exclusion is named on every row.
 *
 * ── ⛓⛓ THE `rng.seed` ROW CARRIES ITS OWN AMBIGUITY (slice 12f, §43) ──
 *
 * 12f measured the game's `Rng.state` at a latch to be a RANDOM VARIABLE per
 * drive on a tape that does not declare the `sound` pin: fourteen drives of
 * byte-equal `r9-solve-0` gave 3297 draws seven times and 3298 once, while six
 * drives WITH `"sound"` in `pins` gave 3298 six times out of six. So for an
 * UNPINNED predecessor this row compares one sample against another, and a
 * disagreement may be a splice (the `-5` case, two coherent chains) or a
 * re-draw — and nothing in the cache can tell them apart. The row therefore
 * PRINTS the predecessor's `pins` and TAGS the disagreement, while still
 * counting it as DISAGREES: a splice is exactly what was found at `-5`, and the
 * cure for the ambiguity is the pin plus a re-record (⚖ 49, the fifth run's),
 * never a softer gate. The count of unpinned predecessors is printed too, so
 * the number is on the record rather than in a reader's head.
 *
 * ── ⛓ READ-ONLY, ALWAYS ──────────────────────────────────────────────
 *
 * This gate NEVER writes to the cache — not even the forward re-key
 * `readLatchCache` performs. It is an observer of a machine-global directory
 * that other sessions are driving.
 *
 * ⛓ OFFLINE: no browser, no Windows, no dev server. ~1 s.
 *
 * Run:
 *   node scripts/procgen/check-seedling-producer-boundaries.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { latchCacheCandidates } from './provisionalLatch.js';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
/**
 * ⛓⛓⛓ R9 P3b (d), §44.9 item 2 — **THE CI FACE, AND IT IS A DIFFERENT CLAIM.**
 *
 * ⛔⛔ THE PROBLEM (d) HAD TO SOLVE. The latch cache is MACHINE-GLOBAL and
 * exists on exactly one box, so on a fresh checkout this gate is `0 VERIFIED /
 * 0 DISAGREES / 18 REFUSED` and exits 0 — *a row that gates nothing*. Two
 * honest shapes were on the table: keep it a box row with a quoted face, or
 * run it in CI as a STRUCTURE check whose VALUE row is still the box's. This
 * is the second, and what makes it honest is that the two verdicts are
 * DIFFERENT SENTENCES that cannot be read as each other.
 *
 * ⛓ THE FACE IS DECLARED HERE, where `@standing-variant` would be, and read
 * by `gateRoster.ciFaceIn`. The prefix REPLACES `gate:` for the CI row, so a
 * structure number and a value number are different KEYS rather than two
 * readings of one:
 *
 * @ci-face structure: --structure
 *
 * `--structure` asserts only what a fresh checkout can answer:
 *   · every declared chain segment has a committed tape that PARSES;
 *   · every boundary COMPUTES at least one well-formed cache key from the
 *     predecessor's own bytes — i.e. `latchCacheCandidates` still answers for
 *     this roster;
 *   · nothing throws on the way.
 * ⛔ IT READS NO LATCH AND VERIFIES NO VALUE, EVER. ⛓ MEASURED, not argued:
 * `findLatch` builds its `looked` list from `latchCacheCandidates` BEFORE it
 * touches the filesystem, so the structure verdict is cache-independent by
 * construction — pointed at directories that do not exist it still reads
 * `18 resolved to a key, 0 could not`. A broken chain declaration, an
 * unparseable tape or a moved key format are real regressions this catches in
 * CI, where today nothing catches them at all.
 *
 * ⛔⛔ AND THE QUOTING PATH IS CLOSED AT THE OTHER END. `ALL PASS …` is one of
 * the five verdict forms `gates.mjs` and `standingValues.headlineOf` parse, so
 * a `--structure` run produces a `pass/fail` headline that on THIS box reads
 * `18/0` — identical to the VALUE row. That is trap 806's shape: a green face
 * a parser reads as the number it is not. Making the total unparseable would
 * be worse (a runner reads "no total line" as a CRASH), so the protection is
 * elsewhere and is asserted rather than intended: no `@standing-variant`
 * declares this arm, so nothing derives a `--structure` command into a
 * standing row, and `ci-summary.mjs` REFUSES this gate's key by name.
 */
const STRUCTURE = process.argv.includes('--structure');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const { parseTape, gameVisibleTape } = await import(join(MODULE, 'tapeFormat.js'));
const { segmentBootFromLatch } = await import(join(MODULE, 'r7Acceptance.js'));
const { PLAYTHROUGH_CHAINS } = await import(join(MODULE, 'playthroughWalk.js'));

/**
 * ⛓⛓ THE TWO CACHES, EACH WITH THE LEGACY SPELLING **ITS OWN WRITER** USED.
 *
 * They are two directories because two different callers drive latches:
 * `solve-seedling-*`'s `latchOf` writes into `/mnt/c/playwright` and keyed on
 * the PROJECTION (which still carried `description` for the tapes it was handed
 * whole); `rerecord-seedling-campaign.mjs`'s `driveLatch` writes into
 * `rerecord-cache/` and keyed on the COMPLETE bytes. `latchCacheCandidates`
 * knows both eras by name, so this gate asks each directory with the era that
 * directory was written under rather than guessing one spelling for both.
 */
const CACHES = Object.freeze([
    Object.freeze({ dir: '/mnt/c/playwright', legacy: 'projection',
        who: "the producers' own `latchOf`" }),
    Object.freeze({ dir: '/mnt/c/playwright/rerecord-cache', legacy: 'complete',
        who: "the re-record pipeline's `driveLatch`" }),
]);

/**
 * ⛔ THE FIELDS A TAPE CARRIES THAT NO LATCH PRODUCES — named so the bound is
 * stated rather than implied. Derived: everything on a parsed tape that is not
 * a `segmentBootFromLatch` key and not the tape's own identity/inputs.
 */
const NOT_IN_THE_CONVERSATION = Object.freeze(
    ['tick0', 'grants', 'despawn', 'equips', 'noclip', 'noDamage', 'noHazards']);

/** ⛓ The pin that makes the game's latch `Rng.state` reproducible (12f, §43). */
const RNG_PIN = 'sound';

let pass = 0;
let fail = 0;
let skip = 0;
const P = (name, detail) => { pass += 1; console.log(`PASS: ${name}${detail ? ` — ${detail}` : ''}`); };
const F = (name, detail) => { fail += 1; console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`); };
const S = (name, detail) => { skip += 1; console.log(`SKIP: ${name}${detail ? ` — ${detail}` : ''}`); };

const tapePath = (name) => join(TAPES, `${name}.json`);
const rawOf = (name) => JSON.parse(readFileSync(tapePath(name), 'utf8'));

/**
 * ⛓ ONE flattening, so "which field moved" is a path a reader can grep for
 * rather than a diff of two blobs. An array is a leaf: a latch either
 * reproduces `save.hasKey` whole or it does not.
 */
function flatten(value, prefix = '', out = {}) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        out[prefix] = JSON.stringify(value ?? null);
        return out;
    }
    for (const k of Object.keys(value)) flatten(value[k], prefix ? `${prefix}.${k}` : k, out);
    return out;
}

/**
 * The cleared `{level, tag}` slots a boot INHERITS — a successor's own timed
 * `at` row is not inherited, it is earned by the walk that follows.
 */
const inheritedClears = (rows) => (rows ?? [])
    .filter((c) => c.at === undefined)
    .map((c) => ({ level: c.level, tag: c.tag }))
    .sort((a, b) => a.level - b.level || a.tag - b.tag);

/** Look for a predecessor's latch in both caches, newest key first, never writing. */
function findLatch(label, parsed) {
    const looked = [];
    for (const cache of CACHES) {
        const candidates = latchCacheCandidates({
            complete: parsed, projected: gameVisibleTape(parsed), legacy: cache.legacy,
        });
        for (const c of candidates) {
            const file = join(cache.dir, `latch-${label}-${c.key}.json`);
            looked.push(`${cache.dir}/latch-${label}-${c.key}.json [${c.era}]`);
            if (existsSync(file)) {
                const record = JSON.parse(readFileSync(file, 'utf8'));
                /**
                 * ⛔ THE TWO WRITERS CACHE TWO SHAPES, and this is unwrapped by
                 * READING rather than by knowing which directory it came from.
                 * `latchOf` caches the driver's `seam` block — the envelope
                 * itself. `driveLatch` caches a RECORD whose `envelope` is that
                 * same block, beside the run's `end`/`observations`/`deadFrames`
                 * counters. A gate that assumed the first shape found the second
                 * one's file, read `latched === undefined` off it, and reported
                 * REFUSED for three boundaries whose latches were sitting right
                 * there — a true sentence about the wrong subject.
                 */
                const envelope = record?.envelope ?? record;
                return { record: envelope, era: c.era,
                    key: c.key, dir: cache.dir, who: cache.who, looked };
            }
        }
    }
    return { record: null, looked };
}

console.log('# check-seedling-producer-boundaries — every chain boundary, derived from the '
    + 'PREDECESSOR\n');
console.log(`## the bound: the comparison visits \`segmentBootFromLatch\`'s own keys. A tape's `
    + `${NOT_IN_THE_CONVERSATION.join(', ')} are NOT visited by any row below — a latch has `
    + 'no opinion about them, so they are neither produced nor refused here.');
console.log('## `persistence` is compared as the INHERITED CLEARED SET `{level, tag}`: a '
    + "successor's timed `at` row is its own walk's earning and `note` is prose the game "
    + 'never reads.\n');

const chains = PLAYTHROUGH_CHAINS.filter((c) => c.segments.length > 1);
let boundaries = 0;
let unpinned = 0;
const missingTapes = [];

for (const chain of chains) {
    console.log(`## chain ${chain.id} — ${chain.segments.length} segment(s), `
        + `${chain.segments.length - 1} boundary(ies)`);
    for (let i = 0; i < chain.segments.length - 1; i += 1) {
        const prevName = chain.segments[i];
        const nextName = chain.segments[i + 1];
        const at = `${chain.id} ${prevName} -> ${nextName}`;
        boundaries += 1;
        if (!existsSync(tapePath(prevName)) || !existsSync(tapePath(nextName))) {
            missingTapes.push(at);
            F(`${at}: a declared segment has no committed tape`,
                `${!existsSync(tapePath(prevName)) ? prevName : nextName} is not on disk — `
                + '"not recorded yet" and "recorded and different" must not print the same '
                + 'thing, and this gate can make neither claim');
            continue;
        }
        const prev = parseTape(rawOf(prevName));
        const next = parseTape(rawOf(nextName));
        const pins = prev.pins ?? [];
        const pinned = pins.includes(RNG_PIN);
        if (!pinned) unpinned += 1;

        const hit = findLatch(prevName, prev);
        /**
         * ⛓⛓⛓ R9 P3b (d) — **THE STRUCTURE VERDICT, WHICH NEVER TOUCHES A
         * VALUE.** What a fresh checkout CAN answer is that this boundary
         * resolved to at least one well-formed cache key from the
         * predecessor's own bytes. `hit.looked` is computed from
         * `latchCacheCandidates` and is independent of whether any file
         * exists, which is what makes this claim the same everywhere.
         */
        if (STRUCTURE) {
            const wellFormed = hit.looked.length > 0
                && hit.looked.every((l) => /^latch-.+-[0-9a-f]{6,}\.json \[/
                    .test(l.split('/').pop()));
            if (wellFormed) {
                P(`${at}: STRUCTURE — resolved to ${hit.looked.length} well-formed cache `
                    + 'key(s) from the predecessor\'s own bytes',
                '⛔ NO VALUE VERIFIED — `--structure` does not read a latch, here or anywhere');
            } else {
                F(`${at}: STRUCTURE — the boundary produced NO well-formed cache key`,
                    `${hit.looked.length} candidate(s): ${hit.looked.join(' ; ')}. Either the `
                    + 'chain declares a segment `latchCacheCandidates` cannot key, or the key '
                    + 'format moved — a defect a fresh checkout CAN see');
            }
            continue;
        }
        if (!hit.record) {
            S(`${at}: REFUSED — no latch for ${prevName}'s own bytes on this machine`,
                `looked for ${hit.looked.length} key(s): ${hit.looked.join(' ; ')}. This `
                + 'boundary is NOT claimed green; it could not be asked');
            continue;
        }
        let derived;
        try {
            derived = segmentBootFromLatch(hit.record);
        } catch (e) {
            S(`${at}: REFUSED — ${prevName}'s latch cannot author a boot`,
                `${hit.era} ${hit.key} in ${hit.dir}: ${e.message.split('\n')[0]}`);
            continue;
        }

        /**
         * ⛓ THE COMPARISON SET IS THE DERIVATION'S OWN KEYS, read off the
         * object rather than retyped — a signature block added to
         * `segmentBootFromLatch` tomorrow is compared without this file being
         * edited, and one removed stops being compared instead of silently
         * comparing `undefined` against `undefined`.
         */
        const keys = Object.keys(derived);
        const a = {};
        const b = {};
        for (const k of keys) {
            if (k === 'persistence') {
                flatten(inheritedClears(derived[k]), 'persistence(inherited clears)', a);
                flatten(inheritedClears(next[k]), 'persistence(inherited clears)', b);
            } else {
                flatten(derived[k] ?? null, k, a);
                flatten(next[k] ?? null, k, b);
            }
        }
        const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
        const moved = fields.filter((f) => a[f] !== b[f]);
        const where = `[${hit.era} ${hit.key}] from ${hit.who}, ${fields.length} field(s) `
            + `over ${keys.join(', ')}`;
        if (!moved.length) {
            P(`${at}: VERIFIED — the successor's committed boot IS the predecessor's `
                + 'measured latch', where);
            continue;
        }
        const detail = moved.map((f) => {
            const tag = (f === 'rng.seed' && !pinned)
                ? ' (UNPINNED PREDECESSOR — sample vs sample; see §43)' : '';
            return `${f}${tag}: derived ${a[f]} != committed ${b[f]}`;
        }).join(' | ');
        F(`${at}: DISAGREES — the committed boot is NOT what the predecessor's latch derives`,
            `${where}; pins ${JSON.stringify(pins)}; ${detail}`);
    }
    console.log('');
}

// ── the numbers this gate owes the record ────────────────────────────
console.log(STRUCTURE
    ? `## ${boundaries} boundary(ies) over ${chains.length} multi-segment chain(s), `
        + `STRUCTURE ONLY: ${pass} resolved to a key, ${fail} could not. ⛔ 0 VALUES `
        + 'VERIFIED — this face exists so CI can catch a broken chain declaration or a '
        + 'moved key format; the VALUE row is measured on the box that holds the cache.'
    : `## ${boundaries} boundary(ies) over ${chains.length} multi-segment chain(s): `
        + `${pass} VERIFIED, ${fail} DISAGREES, ${skip} REFUSED-UNVERIFIED`);
/**
 * ⛓ R9 SLICE 12h — THE SENTENCE BRANCHES ON THE COUNT, because at `unpinned === 0`
 * every clause of the old one is FALSE: there is no sample-vs-sample row left to
 * warn about, and "belongs to the fifth run" is a forecast the fifth run spent.
 * A caveat that keeps printing after its subject is gone is ⚖ ruling 39's
 * decaying class — a true-sounding sentence about a world that has moved.
 */
console.log(unpinned === 0
    ? `## ${unpinned} of ${boundaries} boundary(ies) have an UNPINNED predecessor `
        + `(no "${RNG_PIN}" in its \`pins\`) — so EVERY \`rng.seed\` row below compares two `
        + 'readings of a DETERMINISTIC draw count, not two samples of a random variable. '
        + '⚖ ruling 57 pinned the roster and R9 slice 12h re-recorded it; 12f §43 is the '
        + 'measurement that made the ambiguity visible, and this line is its discharge.'
    : `## ${unpinned} of ${boundaries} boundary(ies) have an UNPINNED predecessor `
        + `(no "${RNG_PIN}" in its \`pins\`), so their \`rng.seed\` row compares ONE SAMPLE of a `
        + 'random variable against another — 12f §43. ⛔ That is a RE-RECORD to cure '
        + '(⚖ 49/57), never a softer gate — and a tape that LOST the pin is the shape to '
        + 'suspect first, since the roster carried it whole at slice 12h.');
if (skip) {
    console.log(`## ⛔ the ${skip} REFUSED boundary(ies) above are NOT green. This gate's exit `
        + 'code is 0 for them because the latch cache is MACHINE-GLOBAL (⚖ 47b (5)) and its '
        + 'absence is not a defect — but nothing here has said their boots are right.');
}
console.log('');

if (fail === 0) {
    console.log(STRUCTURE
        ? `ALL PASS — STRUCTURE ONLY: ${pass} boundary(ies) resolved to a cache key; `
            + '0 VALUES VERIFIED (the latch cache is MACHINE-GLOBAL and this run did not '
            + 'read it). ⛔ This number is NOT the gate\'s standing value and must never be '
            + 'quoted as one — that row is measured on the box.'
        : `ALL PASS — ${pass} VERIFIED, ${skip} REFUSED-UNVERIFIED (not claimed green)`);
    process.exit(0);
}
console.log(`${fail} CHECK(S) FAILED`);
process.exit(1);
