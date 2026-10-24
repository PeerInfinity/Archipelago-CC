/**
 * rehearsalTree — **THE FAKE TREE THE RE-RECORD PIPELINE IS REHEARSED
 * AGAINST, GENERATED FROM THE COMMITTED ROSTER RATHER THAN HAND-WRITTEN.**
 * R9 slice P1b, ⚖ ruling 54 (3); kickoff §39.12 (b).
 *
 * ── ⛔⛔⛔ WHY A FAKE TREE, AND WHY GENERATED ──────────────────────────
 *
 * Three re-record attempts STOPPED after the GPU had already been spent, and
 * every one of the defects that stopped them is pure bookkeeping, decidable
 * offline: a producer order taken from the FILE SYSTEM (§35.4 item 4), a fix
 * for it that only ever worked on the RESUME path (§37.3 (a)), two guards
 * naming the GLOBAL failure counter instead of their own subject (§35.4
 * item 5, §37.3 (b)), a record set taken from `s2.wrote` instead of the
 * projection diff (§33.4 item 4). None of them was caught before the browser,
 * because the pipeline had no subject it could be pointed at except the real
 * roster.
 *
 * ⛔ AND A HAND-WRITTEN FIXTURE WOULD NOT HAVE HELD. A fake tape typed once
 * decays the moment the tape format grows a field — the same shape as every
 * hand-transcribed table this rung has had to re-derive. So the tree is
 * GENERATED at rehearsal time, out of the committed tapes and the real
 * `SEAM_SIGNATURE`, and it PROVES ITSELF before it is used: see
 * `latchEnvelopeFor`'s round-trip assertion.
 *
 * ── ⛓⛓⛓ THE ENVELOPE IS THE INVERSE OF `segmentBootFromLatch`, AND THE
 *        INVERSE ALREADY EXISTED ───────────────────────────────────────
 *
 * `r7Acceptance.seamBootFields(tape)` maps a parsed tape onto
 * `SEAM_SIGNATURE[].field` — which is exactly the record `segmentBootFromLatch`
 * reads back. So a latch that authors a given tape's boot is that tape's own
 * `seamBootFields`, plus the rows a BOOT side never declares:
 *
 *   · the five CALM invariants (`shake`, `menu`, `freezeObjects`, `talking`,
 *     `blackCover`) and `arrival.velocity` — `seamLatchFindings` asserts these
 *     and a boot map has no opinion about them, so a fake latch must carry the
 *     calm values or S1's calm row is UNCLAIMED rather than green;
 *   · `rng.cosmetic`, which `seamBootFields` OMITS when it is 0 (0 means
 *     "undeclared" on the wire) while `segmentBootFromLatch` REQUIRES it.
 *
 * ⛓ MEASURED BEFORE ANY OF THIS WAS WRITTEN, on `main` @`d82f28f3b`: for
 * `r8-solve-7`, `r8-solve-9`, `r9-solve-3`, `r8-d2-19`, `r8-d2-20` and
 * `r9-solve-13`, `bootFromEnvelopeOnly` through the pipeline's OWN
 * `mergePersistence` projection reports **38 field(s) compared, 0 moved**.
 * That is what makes S1's control the strong one — ZERO movers, the state the
 * pipeline is supposed to report when nothing changed — and this module
 * ASSERTS it per boundary rather than trusting it.
 *
 * ⚠ `persistence` IS THE ONE ROW THAT NEEDS THE PIPELINE'S PROJECTION. A
 * latch's clear set is `{level, tag}`; the committed rows carry `note` too, and
 * `mergePersistence` re-attaches it. A generator that compared the raw
 * `segmentBootFromLatch` output would report every segment's provenance prose
 * as a mover — which is `bootFromEnvelopeOnly`'s own documented reason for
 * taking a `project` function.
 *
 * ── WHAT ELSE THE TREE CARRIES ────────────────────────────────────────
 *
 *   chains          the DECLARATION, as data — `playthroughWalk.js` cannot be
 *                   imported under a fake roster (it `loadTape`s every segment
 *                   at MODULE SCOPE, §26.7)
 *   instrumentRows  `participationOf` keys the instruments scan by producer
 *                   FILE NAME, so a fake producer absent from it is
 *                   `unmeasured` and the walk measurement rehearses nothing
 *   producers       real `.mjs` files, written here, that emit tapes and write
 *                   a REAL `walkReport` — the report shape is imported from
 *                   `walkReport.js`, never re-spelled
 *   stubs           a fake `--record`, a fake tick-0 derivation and the S4
 *                   gates, so S0..S5 completes without a browser
 *
 * ⛔ NOTHING HERE EVER WRITES INSIDE THE REPOSITORY. The tree is built under a
 * caller-supplied directory (the run directory, which is `$TMPDIR`-rooted by
 * default) and `buildRehearsalTree` REFUSES a directory inside the committed
 * fixtures by name.
 */

import {
    cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

export class RehearsalTreeError extends Error {
    constructor(message) { super(message); this.name = 'RehearsalTreeError'; }
}
const fail = (m) => { throw new RehearsalTreeError(m); };

/** ⛓ The file that says "this directory is a rehearsal" — one spelling. */
export const REHEARSAL_MARKER = 'rehearsal.json';
/**
 * ⛓ R9 P3b — the ref a rehearsal's baseline is NAMED by. It is deliberately
 * not SHA-shaped: a reader of a rehearsal's S3 output must not be able to
 * mistake it for a commit in this repository.
 */
export const BASELINE_REF = 'rehearsal-tree@generated';

/**
 * ⛓ THE CALM ARRIVAL, one value per invariant `seamLatchFindings` asserts.
 * These are the fork's own numbers for a spent fade at a standing stop —
 * `INVARIANT_CHECKS` in `r7Acceptance.js` is the predicate each one satisfies,
 * and a value here that stopped satisfying it would redden every boundary of
 * the rehearsal's own control run, which is the check that keeps this table
 * honest.
 */
export const CALM_ARRIVAL = Object.freeze({
    'static.Game.shake': 0,
    'static.Game.menu': false,
    'static.Game.freezeObjects': false,
    'static.Game.talking': false,
    'arrival.blackCover': 0,
    'arrival.velocity': Object.freeze({ vx: 0, vy: 0, hits: 0, hits_timer: 0 }),
});

/**
 * **THE LATCH A TAPE'S OWN BOOT IMPLIES** — `segmentBootFromLatch` run
 * backwards, out of `seamBootFields` plus the rows above.
 *
 * @param {object} tape        a PARSED successor tape (`parseTape`)
 * @param {object} deps        `{signature, prebuildFields, seamBootFields}` —
 *   the REAL ones from `r7Acceptance.js`; nothing here is re-spelled
 * @param {object} [opts]
 * @param {number} [opts.tick] the latch tick to report
 * @param {object} [opts.override] fields to overwrite AFTER the derivation —
 *   this is how a rehearsal makes a boundary MOVE, and it is the only way one
 *   can: everything else is the successor's own committed answer
 * @returns {object} a `driveLatch` record's `envelope`
 */
export function latchEnvelopeFor(tape, deps, { tick = 0, override = {} } = {}) {
    const { signature, prebuildFields, seamBootFields } = deps ?? {};
    if (!signature || !prebuildFields || !seamBootFields) {
        fail('latchEnvelopeFor: needs {signature, prebuildFields, seamBootFields} — the '
            + 'REAL `SEAM_SIGNATURE`, `SEAM_PREBUILD_FIELDS` and `seamBootFields`. A '
            + 'second spelling of the signature would decay separately from the game\'s.');
    }
    const seam = { ...seamBootFields(tape) };
    for (const row of signature) {
        if (row.comparable === 'excluded') continue;
        if (Object.prototype.hasOwnProperty.call(seam, row.field)) continue;
        if (Object.prototype.hasOwnProperty.call(CALM_ARRIVAL, row.field)) {
            seam[row.field] = CALM_ARRIVAL[row.field];
            continue;
        }
        /**
         * ⛔ `rng.cosmetic` IS THE ONE ASYMMETRY, AND IT IS THE WIRE FORMAT'S.
         * `seamBootFields` omits a 0 because 0 means "inherit the page's
         * stream" on the boot side; `segmentBootFromLatch` requires the field
         * because a LATCH always read something.
         */
        if (row.field === 'rng.cosmetic') { seam[row.field] = tape.rng.cosmetic; continue; }
        /**
         * ⛔ A SIGNATURE ROW WITH NO FILL RULE IS A REFUSAL BY NAME, never a
         * default. The signature grows; a generator that invented a value for
         * a new row would author a latch the game could not have produced,
         * which is the same defect as carrying a stale field.
         */
        fail(`latchEnvelopeFor: \`${row.field}\` (group ${row.group}, ${row.comparable}) is `
            + 'in SEAM_SIGNATURE and this generator has no rule for it. A fake latch that '
            + 'guessed it would author a state the game cannot reach — add the rule to '
            + '`CALM_ARRIVAL` (an invariant) or beside `rng.cosmetic` (a wire asymmetry), '
            + 'deliberately.');
    }
    Object.assign(seam, override);
    seam['latch.tick'] = tick;
    const beginEntry = {};
    for (const f of prebuildFields) beginEntry[f] = seam[f];
    return { latched: true, partial: false, why: null, seam, beginEntry };
}

/**
 * ⛓ A whole `driveLatch` RECORD, shaped exactly like the Windows driver's:
 * `{envelope, end, observations, deadFrames, hits, persistenceCleared}`.
 */
export function latchRecordFor(tape, deps, opts = {}) {
    const envelope = latchEnvelopeFor(tape, deps, opts);
    return {
        envelope,
        end: { tick: opts.tick ?? 0, level: tape.boot.level, x: tape.boot.x, y: tape.boot.y },
        observations: (opts.tick ?? 0) + 1,
        deadFrames: 0,
        hits: 0,
        persistenceCleared: tape.persistence.map((c) => ({ level: c.level, tag: c.tag })),
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE PRODUCERS AND STUBS THIS TREE WRITES
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛔⛔ THE FAKE PRODUCER READS ITS PLAN AND USES THE **REAL** `walkReport`.
 * The report shape is what S0's whole measurement is keyed on, so a fake
 * producer that hand-rolled one would be rehearsing a format nobody uses. It
 * imports `createWalkReport` by absolute path out of this repository.
 *
 * ⛔ AND IT SPELLS ITS OWN FLAGS THROUGH THE PIPELINE'S CONSTANTS for the same
 * reason the pipeline does — see `rerecordCampaign.test.js`'s two rows about
 * `producerScripts`. (These files live OUTSIDE `scripts/procgen/`, so that
 * scan cannot reach them either way; the discipline is the point.)
 */
const PRODUCER_SOURCE = (repo) => `#!/usr/bin/env node
/** GENERATED by scripts/procgen/rehearsalTree.js — a REHEARSAL producer. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWalkReport } from ${JSON.stringify(join(repo, 'scripts/procgen/walkReport.js'))};
import { CHECK_FLAG } from ${JSON.stringify(join(repo, 'scripts/procgen/walkMoves.js'))};

const HERE = dirname(fileURLToPath(import.meta.url));
const TREE = join(HERE, '..');
const ME = process.argv[1].split('/').pop();
const plan = JSON.parse(readFileSync(join(TREE, 'plans', \`\${ME}.json\`), 'utf8'));
const TAPES = join(TREE, 'tapes');
const CHECK = process.argv.includes(CHECK_FLAG);
const token = process.argv.find((a) => a.startsWith('--walk-report='));
const report = createWalkReport({ producer: ME, tapesDir: TAPES, arg: token });

for (const owned of plan.owns) {
    const path = join(TAPES, \`\${owned.segment}.json\`);
    const committed = JSON.parse(readFileSync(path, 'utf8'));
    const derived = { ...committed };
    if (owned.move === 'walk') {
        derived.inputs = committed.inputs.map((r, i) => (i === 0
            ? { ...r, key: r.key === 'right' ? 'left' : 'right' } : r));
    }
    if (owned.move === 'description') derived.description = \`\${committed.description} (re-emitted)\`;
    const text = \`\${JSON.stringify(derived, null, 4)}\\n\`;
    report.note(path, text, owned.arrival ?? null);
    if (!CHECK) writeFileSync(path, text);
    console.log(\`\${owned.move === 'none' ? 'PASS' : 'FAIL'}: \${owned.segment} — \`
        + \`\${owned.move === 'none' ? 'byte-identical' : \`the \${owned.move} moved\`}\`);
}
process.exit(plan.exit ?? (plan.owns.some((o) => o.move !== 'none') && CHECK ? 1 : 0));
`;

/**
 * ⛓ THE FAKE `--record`. It writes an expectation per label in the `--only=`
 * set and NAMES what it wrote, which is the only thing S3's claim is about:
 * the SET. ⛔ It does not run the model — the physics is the fourth run's
 * subject and a rehearsal that pretended otherwise would be claiming a stratum
 * it does not have.
 */
const RECORD_STUB = `#!/usr/bin/env node
/** GENERATED by scripts/procgen/rehearsalTree.js — a REHEARSAL --record. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const TREE = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=').slice(7);
const set = only.split(',').map((x) => x.trim()).filter(Boolean);
const dir = join(TREE, 'expectations');
mkdirSync(dir, { recursive: true });
const recording = process.argv.includes('--record');
for (const label of set) {
    const p = join(TREE, 'tapes', \`\${label}.json\`);
    if (!existsSync(p)) { console.log(\`FAIL: \${label} — no such tape\`); continue; }
    const md5 = createHash('md5').update(readFileSync(p)).digest('hex');
    if (recording) {
        writeFileSync(join(dir, \`\${label}.json\`), \`\${JSON.stringify({ label, md5 }, null, 2)}\\n\`);
        console.log(\`RECORDED: \${label}\`);
    }
    console.log(\`PASS: \${label} — \${md5}\`);
}
console.log(\`## the rehearsal differential saw \${set.length} label(s)\`);
process.exit(0);
`;

/**
 * ⛓⛓ THE FAKE TICK-0 DERIVATION, AND IT EARNS ITS KEEP. It rewrites every
 * tape's `tick0.rng.seed`, which is a REAL change to every file on disk — and
 * S3's record set must stay empty over it, because `tick0` is a
 * `GAME_VISIBLE_DROPS` field. That is §35.4 item 3's *"S2's fifteen tick-0
 * re-derivations cost no GPU at all"*, rehearsed rather than quoted.
 */
const TICK0_STUB = `#!/usr/bin/env node
/** GENERATED by scripts/procgen/rehearsalTree.js — a REHEARSAL tick-0 derivation. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const TAPES = join(dirname(fileURLToPath(import.meta.url)), '..', 'tapes');
let n = 0;
for (const f of readdirSync(TAPES).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
    const p = join(TAPES, f);
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    if (!raw.tick0 || !raw.tick0.rng) continue;
    raw.tick0 = { ...raw.tick0, rng: { ...raw.tick0.rng, seed: (raw.tick0.rng.seed % 97) + 1 } };
    writeFileSync(p, \`\${JSON.stringify(raw, null, 4)}\\n\`);
    n += 1;
}
console.log(\`PASS: \${n} tick-0 block(s) re-derived — and every one is projected away\`);
process.exit(0);
`;

/** ⛓ An S4 gate that says PASS. S4 is rehearsed for WIRING, not for physics. */
const GATE_STUB = (what) => `#!/usr/bin/env node
/** GENERATED by scripts/procgen/rehearsalTree.js — a REHEARSAL S4 gate. */
console.log('PASS: ${what} — REHEARSAL STUB (S4 is rehearsed for WIRING, never physics)');
console.log('ALL CHECKS PASSED');
process.exit(0);
`;

/* ══════════════════════════════════════════════════════════════════════
 * THE TREE
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ THE DECLARATION THE REHEARSAL RUNS AGAINST — four segments and a headline
 * in one chain, plus a ONE-SEGMENT chain, which is the shape `r8-solve-11`
 * fell through (§33.4 item 1) and the shape a headline falls through
 * (§33.4 item 2).
 *
 * ⛔⛔ THE OWNERSHIP IS CHOSEN SO THAT FILE ORDER IS THE WRONG ANSWER.
 * `solve-rh-chain.mjs` sorts BEFORE `solve-rh-first.mjs`, and `-first` owns
 * segment 0 — so a `producerOrder` that fell back to `[...running].sort()`
 * would run the chain producer against a predecessor that no longer exists.
 * That is §35.4 item 4 exactly, and it is why the rehearsal can see it.
 */
export const REHEARSAL_PLAN = Object.freeze({
    chains: Object.freeze([
        Object.freeze({
            id: 'rh-main',
            kind: 'custody',
            segments: Object.freeze(['rh-a', 'rh-b', 'rh-c', 'rh-d']),
            headline: 'rh-main-full',
        }),
        Object.freeze({ id: 'rh-solo', kind: 'staged', segments: Object.freeze(['rh-e']) }),
    ]),
    owners: Object.freeze({
        'solve-rh-first.mjs': Object.freeze(['rh-a']),
        'solve-rh-chain.mjs': Object.freeze(['rh-b', 'rh-c', 'rh-d', 'rh-main-full']),
        'solve-rh-solo.mjs': Object.freeze(['rh-e']),
    }),
    /**
     * ⛓ THE SOURCE TAPES, and every one is a committed artifact of this tree.
     * ⛔ They are copied, never moved or edited in place: `buildRehearsalTree`
     * refuses to write anywhere but its own directory.
     */
    sources: Object.freeze({
        'rh-a': 'r8-solve-6',
        'rh-b': 'r8-solve-7',
        'rh-c': 'r8-solve-8',
        'rh-d': 'r8-solve-9',
        'rh-e': 'r8-solve-10',
        'rh-main-full': 'r9-solve-11',
    }),
});

const FIXTURES_MARK = join('frontend', 'modules', 'seedlingDemo', 'fixtures');

/**
 * Build one rehearsal tree.
 *
 * @param {object} opts
 * @param {string} opts.dir        where to build it — REFUSED inside `fixtures/`
 * @param {string} opts.repo       this repository's root
 * @param {string} opts.sourceTapes the committed tapes directory (READ-ONLY)
 * @param {object} opts.deps       `{parseTape, signature, prebuildFields,
 *   seamBootFields, segmentBootFromLatch, bootFromEnvelopeOnly, mergePersistence}`
 * @param {object} [opts.scenario] `{moves, exits, latchOverrides}`
 * @returns {object} the marker's contents
 */
export function buildRehearsalTree({ dir, repo, sourceTapes, deps, scenario = {} }) {
    const target = resolve(dir);
    /**
     * ⛔⛔ THE REFUSAL THAT MATTERS MOST IN THIS FILE. A rehearsal writes
     * tapes, runs a fake `--record` and rewrites tick-0 blocks. Pointed at the
     * committed roster it would move artifacts under a name that says
     * "rehearsal", which is the one thing ⚖ 40's tape licence exists to stop.
     */
    if (target.includes(FIXTURES_MARK) || resolve(sourceTapes).startsWith(target)) {
        fail(`⛔ REFUSING to build a rehearsal tree at ${target}: it is inside the `
            + 'committed fixtures (or contains the source roster). A rehearsal WRITES '
            + 'tapes, RE-DERIVES tick-0 blocks and runs a fake `--record` — pointed at '
            + 'the real roster it would move committed artifacts. Build it under the run '
            + 'directory.');
    }
    const { parseTape, segmentBootFromLatch, bootFromEnvelopeOnly, mergePersistence } = deps;
    const moves = scenario.moves ?? {};
    const exits = scenario.exits ?? {};
    const latchOverrides = scenario.latchOverrides ?? {};
    /**
     * ⛓⛓⛓ R9 P3b, §47.6 — **A TAPE NO PRODUCER OWNS.** `{ <label>: <source> }`
     * drops a copy of a committed tape into the roster with NO owner and no
     * chain, which is the shape of every `plan-seedling-*`-authored tape:
     * outside `solverRoster` by construction, and invisible until the
     * complement is derived. ⛔ It is deliberately NOT a chain segment — a
     * scenario that made it one would be rehearsing a different hole.
     */
    const orphanTapes = scenario.orphanTapes ?? {};

    rmSync(target, { recursive: true, force: true });
    /**
     * ⛓⛓⛓ R9 P3b, §47.5 — **`baseline/` IS THE TREE'S STAND-IN FOR A COMMIT.**
     * The real pipeline reads S3's `before` at a SHA, because a commit cannot
     * be moved by a stage that runs after it. A scratch tree has no history,
     * so the generator writes the tapes TWICE — once as the roster the run
     * will move, once here as the run's true before — and `rehearsalContext`
     * projects `baseline/` instead of shelling `git show`. That is what makes
     * a scenario able to mutate a tape BETWEEN S0 and S1 and still be seen.
     */
    for (const sub of ['tapes', 'baseline', 'latches', 'producers', 'stubs', 'plans',
        'expectations']) {
        mkdirSync(join(target, sub), { recursive: true });
    }

    // ── 1. the tapes: copies, re-described so they nominate their owner ──
    const ownerOf = new Map();
    for (const [file, segs] of Object.entries(REHEARSAL_PLAN.owners)) {
        for (const s of segs) ownerOf.set(s, file);
    }
    const parsed = new Map();
    for (const [label, source] of Object.entries(REHEARSAL_PLAN.sources)) {
        const from = join(sourceTapes, `${source}.json`);
        if (!existsSync(from)) {
            fail(`⛔ the rehearsal's source tape ${source} is not on the committed roster. `
                + 'The tree is GENERATED from that roster, so a renamed or retired tape '
                + 'is a rehearsal that has to be re-pointed rather than a silent skip.');
        }
        const raw = JSON.parse(readFileSync(from, 'utf8'));
        raw.name = label;
        raw.description = `REHEARSAL copy of ${source}. Authored by `
            + `scripts/procgen/${ownerOf.get(label)} for the P1b rehearsal.`;
        const text = `${JSON.stringify(raw, null, 4)}\n`;
        writeFileSync(join(target, 'tapes', `${label}.json`), text);
        /** ⛓ …and the SAME BYTES as the run's before — one `text`, two files,
         *  so the baseline cannot drift from the roster it is a baseline OF. */
        writeFileSync(join(target, 'baseline', `${label}.json`), text);
        parsed.set(label, parseTape(raw));
    }
    /** ⛓ …and the ORPHANS, written to both the roster and the baseline for the
     *  same reason the segments are. They own no chain and nominate nobody. */
    for (const [label, source] of Object.entries(orphanTapes)) {
        const from = join(target, 'tapes', `${source}.json`);
        if (!existsSync(from)) {
            fail(`⛔ the orphan ${label} names ${source}, which is not in this tree's own `
                + `roster (${Object.keys(REHEARSAL_PLAN.sources).join(', ')}). An orphan is a `
                + 'COPY of a generated tape, so the two can never disagree about format.');
        }
        const raw = JSON.parse(readFileSync(from, 'utf8'));
        raw.name = label;
        raw.description = `REHEARSAL orphan copied from ${source}. NO producer emits it — `
            + 'it stands for a `plan-seedling-*`-authored tape, outside the solver roster '
            + 'by construction (R9 P3b, §47.6).';
        const text = `${JSON.stringify(raw, null, 4)}\n`;
        writeFileSync(join(target, 'tapes', `${label}.json`), text);
        writeFileSync(join(target, 'baseline', `${label}.json`), text);
    }

    // ── 2. the latches, DERIVED from each SUCCESSOR's own boot blocks ────
    /**
     * ⛓⛓⛓ AND EVERY ONE IS PROVED BEFORE IT IS WRITTEN. The claim the whole
     * rehearsal rests on is that S1's control is ZERO MOVERS; a generator that
     * merely believed that would be handing the gate a fixed point. So each
     * envelope is run through `segmentBootFromLatch` and diffed against the
     * successor's committed blocks with the pipeline's OWN `mergePersistence`
     * projection, and a mover the scenario did not ASK for is a refusal.
     */
    const BOOT_BLOCKS = ['boot', 'save', 'persistence', 'pins', 'rng', 'seam'];
    const latchProof = [];
    for (const chain of REHEARSAL_PLAN.chains) {
        for (let k = 0; k < chain.segments.length - 1; k += 1) {
            const from = chain.segments[k];
            const to = chain.segments[k + 1];
            const succ = parsed.get(to);
            const committed = {};
            for (const b of BOOT_BLOCKS) if (succ[b] !== undefined) committed[b] = succ[b];
            const record = latchRecordFor(succ, deps,
                { tick: parsed.get(from).tick_count, override: latchOverrides[from] ?? {} });
            const project = (e) => {
                const b = segmentBootFromLatch(e);
                return { ...b,
                    persistence: mergePersistence(b.persistence, committed.persistence) };
            };
            const { rows } = bootFromEnvelopeOnly(record.envelope, committed, project);
            const movers = rows.filter((r) => r.moved).map((r) => r.field);
            const asked = Object.keys(latchOverrides[from] ?? {});
            if (!asked.length && movers.length) {
                fail(`⛔ the derived latch for ${from} -> ${to} moves ${movers.join(', ')} `
                    + 'and the scenario asked for no override. The fake tree\'s whole '
                    + 'contract is that an untouched boundary measures ZERO movers — a '
                    + 'generator that shipped this would hand the gate a control that '
                    + 'cannot fail.');
            }
            latchProof.push({ from, to, compared: rows.length, moved: movers, asked });
            writeFileSync(join(target, 'latches', `${from}.json`),
                `${JSON.stringify(record, null, 2)}\n`);
        }
    }

    // ── 3. the producers and their plans ─────────────────────────────────
    for (const [file, segs] of Object.entries(REHEARSAL_PLAN.owners)) {
        writeFileSync(join(target, 'producers', file), PRODUCER_SOURCE(repo));
        writeFileSync(join(target, 'plans', `${file}.json`), `${JSON.stringify({
            owns: segs.map((segment) => ({ segment, move: moves[segment] ?? 'none' })),
            exit: exits[file] ?? null,
        }, null, 2)}\n`);
    }

    // ── 4. the stubs S2, S3 and S4 shell ────────────────────────────────
    writeFileSync(join(target, 'stubs', 'check-seedling-bot-differential.mjs'), RECORD_STUB);
    writeFileSync(join(target, 'stubs', 'derive-seedling-tick0.mjs'), TICK0_STUB);
    for (const [file, what] of [
        ['check-seedling-editor-sequence.mjs', 'the JS sequence gate'],
        ['census-seedling-campaign.mjs', 'the census'],
        ['check-seedling-wasm-ship.mjs', 'the wasm ship gate'],
    ]) writeFileSync(join(target, 'stubs', file), GATE_STUB(what));

    // ── 5. the instrument rows `participationOf` needs ──────────────────
    /**
     * ⛓ Shaped exactly like `buildInstruments().rows`: a `file`, the `flags`
     * it reads and whether it is a browser row. The fake producers all accept
     * `--walk-report`, so all three PARTICIPATE — a rehearsal in which nobody
     * could be measured would rehearse nothing.
     */
    const instrumentRows = Object.keys(REHEARSAL_PLAN.owners).map((file) => ({
        file,
        flags: [{ name: 'walk-report' }, { name: 'check' }],
        browser: false,
    }));

    const marker = {
        rehearsal: true,
        generatedBy: 'scripts/procgen/rehearsalTree.js',
        generatedFrom: sourceTapes,
        chains: REHEARSAL_PLAN.chains,
        owners: REHEARSAL_PLAN.owners,
        sources: REHEARSAL_PLAN.sources,
        instrumentRows,
        scenario: { moves, exits, latchOverrides, orphanTapes },
        /** ⛓ R9 P3b — the pseudo-ref `rehearsalContext` resolves to `baseline/`. */
        baselineRef: BASELINE_REF,
        latchProof,
    };
    writeFileSync(join(target, REHEARSAL_MARKER), `${JSON.stringify(marker, null, 2)}\n`);
    return marker;
}

/** Read a tree's marker, refusing a directory that is not one. */
export function readRehearsalMarker(dir) {
    const p = join(resolve(dir), REHEARSAL_MARKER);
    if (!existsSync(p)) {
        fail(`⛔ ${dir} carries no ${REHEARSAL_MARKER}, so it is not a rehearsal tree. `
            + 'The pipeline REFUSES to run against an unmarked directory: the marker is '
            + 'what separates a generated fake roster from the committed one, and a '
            + 'rehearsal writes tapes.');
    }
    const m = JSON.parse(readFileSync(p, 'utf8'));
    if (m.rehearsal !== true) fail(`⛔ ${p} does not declare \`rehearsal: true\``);
    return m;
}

/** ⛓ Kept for a caller that wants the tapes without the rest (unused today). */
export function copyRoster(fromDir, toDir) {
    mkdirSync(toDir, { recursive: true });
    cpSync(fromDir, toDir, { recursive: true });
}
