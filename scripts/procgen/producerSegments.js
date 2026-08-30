/**
 * producerSegments — **WHO OWNS A TAPE IS A FACT ABOUT THE PRODUCER, NOT ABOUT
 * THE TAPE'S PROSE.** R9 slice P3 (C), ⚖ ruling 17, ⚖ ruling 54 (7).
 *
 * ── ⛔⛔⛔ WHAT THIS REPLACES ──────────────────────────────────────────
 *
 * Two consumers derived ownership by REGEXING ENGLISH out of a committed
 * tape's `description`:
 *
 *   `walkMoves.nominateOwners`   `/scripts\/procgen\/([\w.-]+\.mjs)/g`
 *   `rerecordCampaign.solverRoster`
 *                                `/Authored by scripts\/procgen\/solve-seedling|LIVE SOLVER/i`
 *
 * Both are ⚖ ruling 17's opposite: a sentence a human typed, standing in for a
 * fact the code already knows. And both had already decayed by the time this
 * was written — `plan-seedling-r7-act2.mjs` is RETIRED (⚖ ruling 14) and three
 * committed descriptions still name it, so the nomination map contained a
 * producer that is not in the tree. A regex over prose cannot notice that; a
 * producer asked directly cannot fail to.
 *
 * ── THE DERIVATION ───────────────────────────────────────────────────
 *
 * Every producer already declares its segments — `CAMPAIGN_SEGMENTS`, the chain
 * tables, `BATTERY_ROOMS` + `HANDED_TO_CAMPAIGN`, a bare `NAME`. What it did
 * not have was a way to be ASKED. `--segments` is that: each producer prints
 *
 *     {"producer": "<file>.mjs", "emits": [...], "declares": [...]}
 *
 * and EXITS BEFORE ANY SOLVE. `emits` is the tapes the producer WRITES — that
 * is the ownership answer, and it is what "one producer per tape" (trap 169)
 * is a law about. `declares` is every tape its table names, including the
 * PROMOTED and HANDED-OVER ones it deliberately does not write; the difference
 * between the two lists is the handover, made visible instead of inferred.
 *
 * ⛔ THE EXIT IS BEFORE THE SOLVE AND THAT IS THE WHOLE TRICK (trap 584).
 * `solve-seedling-r9-campaign.mjs` solves the entire campaign at module scope
 * and drives Windows Chrome for its latches, so NOTHING can import it. A mode
 * that prints and exits above that work is the only way to ask it a question
 * without running it, and it costs a subprocess rather than a refactor.
 *
 * ⛓ AND IT IS BYTE-INERT TO ⚖ RULING 8. `--segments` prints nothing on the
 * `--check` path and adds no row to it, so every producer's `--check` stdout
 * md5 is unmoved. That was measured, not assumed.
 *
 * ── ⛔ WHAT THIS MODULE DOES **NOT** CLAIM ───────────────────────────
 *
 * A producer that does not accept `--segments` is reported as NOT
 * PARTICIPATING, by name, with the reason — never silently omitted. The set of
 * participants is DERIVED by reading each candidate's own source for the flag
 * (the same reading `gateRoster.readsFlag` does for gates), so a producer that
 * adopts the mode tomorrow joins without this file being edited.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, '..', '..');

export class ProducerSegmentsError extends Error {
    constructor(message) { super(message); this.name = 'ProducerSegmentsError'; }
}
const fail = (m) => { throw new ProducerSegmentsError(m); };

/** The flag, spelled once. A producer reads it, this module passes it. */
export const SEGMENTS_FLAG = '--segments';

/**
 * A producer's own answer, printed and exited. Called from the producer, above
 * every solve.
 *
 * ⛔ `process.exit(0)` rather than a `return`: the callers are module-scope
 * scripts with no function to return from, and a mode that fell through would
 * run the solve it exists to avoid.
 */
export function emitSegments({ producer, emits, declares }) {
    if (!producer || !Array.isArray(emits) || !Array.isArray(declares)) {
        fail('emitSegments: needs {producer, emits[], declares[]}');
    }
    for (const n of emits) {
        if (!declares.includes(n)) {
            fail(`emitSegments: ${producer} says it EMITS ${n} but does not DECLARE it — `
                + 'the emitted set is a subset of the declared one by construction, so this '
                + 'is a bookkeeping error in the producer rather than a fact about it');
        }
    }
    /**
     * ⛔ THE TWO SPELLINGS CANNOT DRIFT. Each producer spells the token itself
     * so the instruments index can SEE the flag (a flag parsed one module away
     * is a flag its table omits); this is the guard that keeps that second
     * spelling honest — a producer that entered on some other token is refused
     * by name rather than answering a question nobody asked it.
     */
    if (!process.argv.includes(SEGMENTS_FLAG)) {
        fail(`emitSegments: ${producer} called it without \`${SEGMENTS_FLAG}\` in argv. The `
            + 'producer spells the token itself so the instruments scan can read it; the '
            + 'token it spells must be this one.');
    }
    console.log(JSON.stringify({ producer, emits, declares }));
    process.exit(0);
}

/** The candidate files: every seedling producer in this directory. */
const isProducer = (f) => /^(?:solve|plan)-seedling-[a-z0-9-]+\.mjs$/.test(f);

/**
 * Which producers can be ASKED, and why the rest cannot — read out of each
 * candidate's own source rather than listed (⚖ ruling 17).
 */
export function producerParticipation({ repo = REPO_DEFAULT } = {}) {
    const dir = join(repo, 'scripts', 'procgen');
    return readdirSync(dir).filter(isProducer).sort().map((file) => {
        const text = readFileSync(join(dir, file), 'utf8');
        /**
         * ⛓ THE READING IS OF THE TOKEN, built from `SEGMENTS_FLAG` rather than
         * typed — the same string the instruments scan looks for, because a
         * producer that does not SPELL the flag is one whose flag that index
         * cannot publish. `emitSegments` refuses any other token, so this
         * reading and the authoritative constant stay one fact.
         */
        const participates = text.includes(`'${SEGMENTS_FLAG}'`)
            && /\bemitSegments\b/.test(text);
        return {
            file,
            participates,
            why: participates ? null
                : `${file} does not accept \`${SEGMENTS_FLAG}\`, so it cannot say which tapes `
                    + 'it emits; only its committed prose nominates it, and prose is not data',
        };
    });
}

/** ⛓ One answer per process — six subprocesses is cheap, sixty is not. */
let CACHE = null;

/**
 * Ask every participating producer what it emits.
 *
 * @returns {{rows: object[], blocked: object[]}} `rows` are
 *   `{producer, emits, declares}`; `blocked` are the non-participants with
 *   their reasons.
 */
export function declaredSegments({ repo = REPO_DEFAULT, fresh = false } = {}) {
    if (CACHE && !fresh && CACHE.repo === repo) return CACHE.value;
    const participation = producerParticipation({ repo });
    const rows = [];
    for (const p of participation.filter((x) => x.participates)) {
        const path = join(repo, 'scripts', 'procgen', p.file);
        let out;
        try {
            out = execFileSync(process.execPath, [path, SEGMENTS_FLAG],
                { cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
        } catch (e) {
            fail(`${p.file} ${SEGMENTS_FLAG} exited non-zero — a producer that cannot say `
                + `what it emits is a STOP, not a gap: ${(e.stderr || e.message).toString()
                    .split('\n').slice(0, 3).join(' | ')}`);
        }
        /**
         * ⛔ THE LAST NON-EMPTY LINE, because a producer may legitimately print
         * a banner above its answer. A parse failure names the producer.
         */
        const last = out.split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? '';
        let parsed;
        try { parsed = JSON.parse(last); } catch {
            fail(`${p.file} ${SEGMENTS_FLAG} did not print JSON as its last line: `
                + `${last.slice(0, 160)}`);
        }
        if (parsed.producer !== p.file) {
            fail(`${p.file} ${SEGMENTS_FLAG} calls itself ${JSON.stringify(parsed.producer)} — `
                + 'a producer that misnames itself would be filed under a name no consumer '
                + 'can match to a file');
        }
        rows.push(parsed);
    }
    const value = { rows, blocked: participation.filter((x) => !x.participates) };
    CACHE = { repo, value };
    return value;
}

/**
 * ⛓⛓⛓ THE OWNER OF A TAPE IS THE PRODUCER THAT EMITS IT.
 *
 * ⛔ TWO PRODUCERS EMITTING ONE TAPE IS A STOP BY NAME — trap 169's own law,
 * enforced here for the first time by something that can see both sides. The
 * prose regex could not: two descriptions naming two scripts read as two
 * unrelated facts.
 *
 * @returns {Map<string, string>} tape name -> producer file
 */
export function ownersByEmit({ repo = REPO_DEFAULT } = {}) {
    const { rows } = declaredSegments({ repo });
    const owner = new Map();
    for (const r of rows) {
        for (const tape of r.emits) {
            if (owner.has(tape) && owner.get(tape) !== r.producer) {
                fail(`${tape} is EMITTED by TWO producers — ${owner.get(tape)} and `
                    + `${r.producer}. One producer per tape (trap 169); two derivations of `
                    + 'one file disagree the first time either moves.');
            }
            owner.set(tape, r.producer);
        }
    }
    return owner;
}

/**
 * ⛓ THE SOLVER ROSTER, DERIVED — every tape a `solve-seedling-*` producer
 * DECLARES, which is what "a tape the solver authored" meant all along.
 *
 * ⛔ `declares`, NOT `emits`, and the difference is the point: a PROMOTED
 * segment (`r8-solve-1`..`r8-solve-4` in `r9-campaign`) is emitted by the
 * battery and declared by the chain, and it belongs on the roster either way.
 * Taking the union of `declares` over the solve producers reproduces the 22
 * the prose regex used to select — measured, element for element, before the
 * regex was deleted.
 */
export function solverRosterFromData({ repo = REPO_DEFAULT } = {}) {
    const { rows } = declaredSegments({ repo });
    const out = new Set();
    for (const r of rows) {
        if (!r.producer.startsWith('solve-seedling-')) continue;
        for (const n of r.declares) out.add(n);
    }
    return [...out].sort();
}

// ── the PROSE, kept only so it can be CHECKED against the data ────────

/**
 * ⛔⛔ THIS IS NOT A DERIVATION AND MUST NEVER BE USED AS ONE. It is the old
 * regex, moved here so exactly one consumer is left: the agreement lint below.
 * A tape's `description` may not DISAGREE with the producer that emits it —
 * prose is documentation of a fact, never the fact.
 */
export function producersNamedInProse(tapeNames, { tapesDir }) {
    if (!tapesDir) fail('producersNamedInProse: `tapesDir` is required');
    const out = new Map();
    for (const name of tapeNames) {
        const path = join(tapesDir, `${name}.json`);
        if (!existsSync(path)) continue;
        let desc = '';
        try { desc = JSON.parse(readFileSync(path, 'utf8')).description ?? ''; } catch { /* */ }
        const named = [...new Set([...desc.matchAll(/scripts\/procgen\/([A-Za-z0-9._-]+\.mjs)/g)]
            .map((m) => m[1]))];
        if (named.length) out.set(name, named);
    }
    return out;
}

/**
 * ⛓⛓⛓ THE LINT: **PROSE MAY NOT DISAGREE WITH DATA.**
 *
 * Three findings, each its own kind, because they are three different mistakes:
 *
 *   `names-a-missing-file`   the description names a producer that is not in
 *                            the tree at all (the `plan-seedling-r7-act2.mjs`
 *                            case — RETIRED by ⚖ ruling 14, still named by
 *                            three committed tapes)
 *   `contradicts-the-owner`  the description names a DIFFERENT producer than
 *                            the one that emits the tape
 *   (silence)                the description names nobody — NOT a finding.
 *                            `r7-ends-meet-1`'s description names no producer
 *                            and never has (trap 576); prose is not required,
 *                            it is only required to be TRUE.
 *
 * @returns {object[]} `{tape, kind, said, owner}` rows, empty when prose agrees
 */
export function proseOwnerDisagreements(tapeNames, { repo = REPO_DEFAULT, tapesDir } = {}) {
    const owner = ownersByEmit({ repo });
    const prose = producersNamedInProse(tapeNames, { tapesDir });
    const dir = join(repo, 'scripts', 'procgen');
    const rows = [];
    for (const [tape, named] of prose) {
        const truth = owner.get(tape) ?? null;
        for (const said of named) {
            if (!existsSync(join(dir, said))) {
                rows.push({ tape, kind: 'names-a-missing-file', said, owner: truth });
                continue;
            }
            /**
             * ⛓ A tape NOTHING declares it emits (a witness authored by a
             * producer that does not accept `--segments` yet) has no derived
             * owner to contradict, so its prose is not judged here — and the
             * blocked producers are reported by `declaredSegments().blocked`
             * rather than being invisible.
             */
            if (truth !== null && said !== truth) {
                rows.push({ tape, kind: 'contradicts-the-owner', said, owner: truth });
            }
        }
    }
    return rows;
}
