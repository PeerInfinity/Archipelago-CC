/**
 * ── THE DECISION TRACE — R8 slice 0 track C ───────────────────────────
 *
 * What the solver SAW, what obstacle it identified, which strategy it chose,
 * and what it rejected and why. The Cloudberry Kingdom interview's
 * footnote-3 lesson: the step-through visualisation is what made the design
 * AI debuggable, and the expensive path is retrofitting it. So the schema
 * ships with the rung rather than after it — kickoff §3.4, ⚖ ruling 4.
 *
 * ⛔⛔⛔ IT IS A SIDECAR, AND THAT IS A CONTRACT, NOT A FILE-LAYOUT
 * PREFERENCE. `gameVisibleTape`/`GAME_VISIBLE_DROPS` is a CLASSIFICATION
 * LIST: a new tape field fails the pinning test until someone says which side
 * of the model/game line it is on. A trace is model-only by construction and
 * has no business being classified at all, so it never becomes a tape field —
 * it lives beside the tape, keyed to it, and `assertTraceIsSidecarOnly`
 * asserts the tape format never grew one.
 *
 * ── ⛓ WHAT MAKES A TRACE A MEASUREMENT RATHER THAN A LOG ──────────────
 *
 * `assertTraceMatchesTape`. A trace claims to explain the run a tape drove;
 * the check is that every row's `keys` is EXACTLY what `heldKeysAt` says the
 * tape held on that tick. A trace whose keys disagree with its tape is
 * explaining a different run, and without that row a trace is decoration that
 * always passes. (The arc's own lesson, from the other side: a readout that
 * cannot see the channel it reports on reads exactly like a channel that
 * never played.)
 *
 * ── ⚠ WHAT SLICE 0 ASSUMED, HAVING NO PRODUCER TO ASK ─────────────────
 *
 * No producer exists yet — slice 2's solver is the first. Four assumptions,
 * stated so slice 2 can overturn them in ITS as-built rather than discover
 * them:
 *
 *  1. **A trace is SPARSE.** A row is emitted when the policy DECIDES, not
 *     every tick, so `tick` is strictly increasing and NOT contiguous. A
 *     dense trace is a legal sparse one.
 *  2. **`saw` is open-ended but must carry `level`, `x`, `y`.** Every
 *     decision is about a player somewhere; the rest is the policy's to
 *     choose. Refusing unknown keys would freeze the schema before the
 *     policy that fills it exists.
 *  3. **`goal.kind` and `strategy.verb` are FREE STRINGS, and unknown ones
 *     are REPORTED rather than refused.** `KNOWN_GOAL_KINDS` /
 *     `KNOWN_STRATEGY_VERBS` are the vocabulary as of this slice;
 *     `summarizeTrace` names anything outside them. A refusal here would
 *     block slice 2 on a list written before its policy; a silence would
 *     hide a typo. Reporting is the third option, and it is the shape this
 *     package already uses for an absence.
 *  4. **`rejected` is REQUIRED and MAY BE EMPTY.** "I considered nothing
 *     else" is a claim the producer has to make out loud; an absent field
 *     and an empty list would otherwise be the same bytes and different
 *     statements.
 */

import { heldKeysAt, KEY_NAMES, GAME_VISIBLE_DROPS } from './tapeFormat.js';

export class DecisionTraceError extends Error {}

const fail = (msg) => { throw new DecisionTraceError(msg); };

/** The schema version. Bumped when a REQUIRED field is added or removed. */
export const TRACE_VERSION = 1;

/**
 * ⛔ THE ROW CONTRACT, AS TWO LISTS — the shape this package uses for every
 * options bag it has ever dropped a key from (`LIVE_GEOMETRY_KEYS`,
 * `SEAM_SIGNATURE`, `GAME_VISIBLE_DROPS`). The validator walks the LISTS, so
 * a field added here is checked for free and a field checked by hand
 * somewhere else is a roster that will rot (trap 89).
 */
export const TRACE_ROW_REQUIRED = Object.freeze([
    'tick', 'saw', 'goal', 'strategy', 'rejected', 'keys',
]);
export const TRACE_ROW_OPTIONAL = Object.freeze(['path', 'obstacle', 'note']);

/** `saw` is open-ended, but a decision is always about a player somewhere. */
export const SAW_REQUIRED = Object.freeze(['level', 'x', 'y']);

/**
 * The vocabulary as of slice 0. ⚠ NOT a refusal list — `summarizeTrace`
 * REPORTS anything outside it by name. See assumption 3 above.
 */
export const KNOWN_GOAL_KINDS = Object.freeze([
    'reach-exit', 'reach-cell', 'collect-placement', 'clear-tag', 'kill', 'survive',
]);
export const KNOWN_STRATEGY_VERBS = Object.freeze([
    'walk', 'shove', 'hold', 'bait', 'touch', 'kill', 'chest', 'fire', 'spear',
    'wait', 'dodge', 'shove-sink',
    // ⛓ R8 slice 2: the first producer's own catalog surfaced a verb slice 0
    // had not listed — `collect` (the pickup-ceremony verb, `runCollect`,
    // driven since R5). Added rather than left "unknown": the REPORT channel
    // exists for typos and genuinely new verbs, and a verb the package has
    // driven for three rungs is neither. The reporting path keeps its own
    // test coverage against a synthetic unknown.
    'collect',
    /**
     * ⛓ R9 slice 4: the `break` verb — a sword swing that removes a
     * `BreakableRock` from the world. Listed for `collect`'s own reason (it is
     * DRIVEN, so it is neither a typo nor unknown), and listed in the slice
     * that first drives it rather than left for the report to flag.
     *
     * ⚠ AND THE LIST IS STILL SHORT OF WHAT THE SOLVER REGISTERS: `weigh`,
     * `fight`, `keylock` and `wand` are `STRATEGY_EXECUTORS` rows this array
     * has never carried, so a trace that drives one REPORTS it as unknown. That
     * is the report channel working as designed and it is not this slice's to
     * change — moving them would re-pin every trace summary that has recorded
     * the current answer.
     */
    'break',
]);

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * ⛔ ONE ROW, VALIDATED AGAINST THE LISTS AND NOTHING ELSE.
 *
 * Every required field dropped in turn fails BY NAME — that is the mutation
 * list this stratum's tests walk, mechanically, over `TRACE_ROW_REQUIRED`
 * rather than one hand-written case per field.
 */
export function assertTraceRow(row, i, what = 'decisionTrace') {
    const at = `${what}: rows[${i}]`;
    if (!isPlainObject(row)) fail(`${at} must be an object`);
    for (const k of TRACE_ROW_REQUIRED) {
        if (!(k in row)) {
            fail(`${at} is missing required field "${k}". The row contract is `
                + `${TRACE_ROW_REQUIRED.join(', ')} (optional: `
                + `${TRACE_ROW_OPTIONAL.join(', ')}) — a decision that does not say `
                + 'what it saw, what it wanted, what it chose, what it rejected and '
                + 'what it pressed is not a decision anybody can review.');
        }
    }
    const unknown = Object.keys(row).filter(
        (k) => !TRACE_ROW_REQUIRED.includes(k) && !TRACE_ROW_OPTIONAL.includes(k));
    if (unknown.length) {
        fail(`${at} carries unknown field(s) ${unknown.join(', ')}. An unlisted key in a `
            + 'record is a SILENCE, not an error: a consumer would never read it and '
            + 'nothing would say so. Add it to TRACE_ROW_OPTIONAL with a reason.');
    }
    if (!Number.isInteger(row.tick) || row.tick < 0) {
        fail(`${at}.tick must be a non-negative integer tick index; got `
            + `${JSON.stringify(row.tick)}`);
    }
    if (!isPlainObject(row.saw)) fail(`${at}.saw must be an object`);
    for (const k of SAW_REQUIRED) {
        if (!(k in row.saw)) {
            fail(`${at}.saw is missing "${k}". \`saw\` is open-ended on purpose, but `
                + `every decision is about a player somewhere: ${SAW_REQUIRED.join(', ')} `
                + 'are the minimum, and without them a trace cannot be checked against '
                + 'the run it claims to explain.');
        }
    }
    if (!isPlainObject(row.goal) || typeof row.goal.kind !== 'string' || !row.goal.kind) {
        fail(`${at}.goal must be an object with a non-empty string \`kind\``);
    }
    if (!isPlainObject(row.strategy) || typeof row.strategy.verb !== 'string'
        || !row.strategy.verb) {
        fail(`${at}.strategy must be an object with a non-empty string \`verb\``);
    }
    if (!Array.isArray(row.rejected)) {
        fail(`${at}.rejected must be an ARRAY, and it may be empty — "I considered `
            + 'nothing else" is a claim the policy has to make out loud. An absent '
            + 'field and an empty list would otherwise be the same bytes and different '
            + 'statements.');
    }
    row.rejected.forEach((r, ri) => {
        if (!isPlainObject(r) || typeof r.option !== 'string' || !r.option
            || typeof r.why !== 'string' || !r.why) {
            fail(`${at}.rejected[${ri}] must be {option, why} with both non-empty `
                + 'strings. A rejection with no reason is the one thing a trace exists '
                + 'to carry.');
        }
    });
    if (!Array.isArray(row.keys)) fail(`${at}.keys must be an array of key names`);
    for (const k of row.keys) {
        if (!KEY_NAMES.includes(k)) {
            fail(`${at}.keys names "${k}", which is not a tape key. The legal names are `
                + `${KEY_NAMES.join(', ')} — one definition, shared with the format the `
                + 'game is handed.');
        }
    }
    if ('path' in row) {
        if (!Array.isArray(row.path)) fail(`${at}.path must be an array of {x, y}`);
        row.path.forEach((p, pi) => {
            if (!isPlainObject(p) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
                fail(`${at}.path[${pi}] must be {x, y} finite numbers`);
            }
        });
    }
    if ('obstacle' in row && row.obstacle !== null) {
        if (!isPlainObject(row.obstacle) || typeof row.obstacle.kind !== 'string'
            || !row.obstacle.kind) {
            fail(`${at}.obstacle must be null or an object with a non-empty string `
                + '`kind` — the census/semantic tables are what name it');
        }
    }
    return row;
}

/**
 * ⛔ THE WHOLE TRACE. The envelope's fields all have a consumer in this
 * module (trap 119): `tape` and `tick_count` are what
 * `assertTraceMatchesTape` compares, `boot` is what `deathJumpFindings`
 * reads, `rows` is everything else. A field nobody reads is a comment.
 */
export const TRACE_REQUIRED = Object.freeze([
    'trace_version', 'tape', 'tick_count', 'boot', 'rows',
]);

export function parseDecisionTrace(json, what = 'decisionTrace') {
    const t = typeof json === 'string' ? JSON.parse(json) : json;
    if (!isPlainObject(t)) fail(`${what}: a trace is an object`);
    for (const k of TRACE_REQUIRED) {
        if (!(k in t)) {
            fail(`${what} is missing required field "${k}". The envelope is `
                + `${TRACE_REQUIRED.join(', ')}; every one of them has a consumer in `
                + 'this module, which is what stops a ledger with no caller reading '
                + 'exactly like a ledger that is empty.');
        }
    }
    if (t.trace_version !== TRACE_VERSION) {
        fail(`${what}: trace_version is ${JSON.stringify(t.trace_version)}; this build `
            + `reads ${TRACE_VERSION}. A version is bumped when a REQUIRED field moves, `
            + 'so an older trace is refused rather than half-read.');
    }
    if (typeof t.tape !== 'string' || !t.tape) {
        fail(`${what}: \`tape\` must name the tape this trace explains — a trace with no `
            + 'tape cannot be checked against anything');
    }
    if (!Number.isInteger(t.tick_count) || t.tick_count < 0) {
        fail(`${what}: tick_count must be a non-negative integer`);
    }
    if (!isPlainObject(t.boot) || !Number.isInteger(t.boot.level)
        || !Number.isFinite(t.boot.x) || !Number.isFinite(t.boot.y)) {
        fail(`${what}: \`boot\` must be the tape's own {level, x, y} — it is what a `
            + 'silent death is detected against (trap 142: the tell is a jump to the '
            + 'boot position with NO level change, and the damage counter cannot see it)');
    }
    if (!Array.isArray(t.rows)) fail(`${what}: \`rows\` must be an array`);
    let last = -1;
    t.rows.forEach((row, i) => {
        assertTraceRow(row, i, what);
        if (row.tick <= last) {
            fail(`${what}: rows[${i}].tick is ${row.tick} and the previous row is at `
                + `${last}. Ticks are STRICTLY INCREASING — a trace is sparse (a row `
                + 'per DECISION, not per tick), so two rows on one tick is two '
                + 'decisions the policy cannot have made in one place.');
        }
        if (row.tick >= t.tick_count) {
            fail(`${what}: rows[${i}].tick is ${row.tick}, outside the trace's own `
                + `[0, ${t.tick_count}). A decision after the run ended is a decision `
                + 'about a run this trace does not describe.');
        }
        last = row.tick;
    });
    return t;
}

/**
 * ⛓⛓⛓ THE ROW THAT MAKES A TRACE A MEASUREMENT.
 *
 * A trace claims to explain the run a tape drove. This asserts that every
 * row's `keys` is EXACTLY what `heldKeysAt` says the tape held on that tick —
 * one definition of "what was pressed", shared with the format the game is
 * handed. Without it a trace is decoration that always passes; with it, a
 * policy whose recorded decisions and emitted spans drifted apart is caught
 * by the artifact rather than by a reader.
 *
 * ⚠ Returns FINDINGS rather than throwing, because a drift is a claim about
 * the producer and a caller may want all of them rather than the first.
 */
export function traceTapeAgreementFindings(trace, tape) {
    const rows = [];
    rows.push({
        name: `trace ${trace.tape}: it names the tape it explains`,
        ok: trace.tape === tape.name,
        detail: `trace says "${trace.tape}", tape is "${tape.name}"`,
    });
    rows.push({
        name: `trace ${trace.tape}: the tick counts agree`,
        ok: trace.tick_count === tape.tick_count,
        detail: `trace ${trace.tick_count}, tape ${tape.tick_count}`,
    });
    let disagreed = 0;
    let firstDetail = null;
    for (const row of trace.rows) {
        const want = [...heldKeysAt(tape, row.tick)].sort();
        const got = [...row.keys].sort();
        if (want.join(',') !== got.join(',')) {
            disagreed += 1;
            if (firstDetail === null) {
                firstDetail = `tick ${row.tick}: trace holds [${got.join(' ') || 'nothing'}], `
                    + `the tape holds [${want.join(' ') || 'nothing'}]`;
            }
        }
    }
    rows.push({
        name: `trace ${trace.tape}: ⛓ every row's keys are the TAPE's keys on that tick`,
        ok: disagreed === 0,
        detail: disagreed === 0
            ? `${trace.rows.length} row(s) agree with \`heldKeysAt\` — the trace explains `
                + 'THIS run'
            : `${disagreed} of ${trace.rows.length} row(s) disagree. ${firstDetail}. A `
                + 'trace whose keys are not the tape\'s is explaining a different run.',
    });
    return rows;
}

/** Throwing wrapper, for producers that want the first drift to stop them. */
export function assertTraceMatchesTape(trace, tape, what = 'decisionTrace') {
    for (const r of traceTapeAgreementFindings(trace, tape)) {
        if (!r.ok) fail(`${what}: ${r.name} — ${r.detail}`);
    }
    return trace;
}

/**
 * ⛔ TRAP 142, GRADUATED FROM THE PROBES INTO THE TRACE.
 *
 * A silent death makes every other finding in an arm vacuous, the damage
 * counter cannot see it (it reads the NEW Player), and the tell is a jump to
 * the BOOT position with NO level change. The trace carries `boot` and every
 * row's `saw.{level,x,y}`, so the tell is computable here — which is what
 * "the probes become trace queries" means in practice.
 *
 * ⚠ It is a FINDING, not a throw: a segment that legitimately returns to its
 * boot cell would fire it, and the honest answer is to report the tick and
 * let the reader look, not to refuse the trace.
 */
export function deathJumpFindings(trace) {
    const hits = [];
    let prev = null;
    for (const row of trace.rows) {
        const s = row.saw;
        if (prev && s.level === prev.level && prev.level === trace.boot.level
            && s.x === trace.boot.x && s.y === trace.boot.y
            && (prev.x !== trace.boot.x || prev.y !== trace.boot.y)) {
            hits.push({ tick: row.tick, from: { x: prev.x, y: prev.y } });
        }
        prev = { level: s.level, x: s.x, y: s.y };
    }
    return [{
        name: `trace ${trace.tape}: no row jumps to the BOOT position without a level change`,
        ok: hits.length === 0,
        detail: hits.length === 0
            ? 'nothing looks like a silent death — the row is here so that the absence '
                + 'is REPORTED rather than silent'
            : `${hits.length} jump(s) to boot {${trace.boot.x},${trace.boot.y}} in level `
                + `${trace.boot.level} with no transition: `
                + `${hits.map((h) => `tick ${h.tick} (from ${h.from.x},${h.from.y})`).join('; ')}`
                + ' — trap 142: a silent death reads as `hits 0` and makes every other '
                + 'finding in the arm vacuous',
    }];
}

/**
 * ⛔ THE SIDECAR LAW, ASSERTED RATHER THAN OBSERVED.
 *
 * `GAME_VISIBLE_DROPS` is a classification list and a trace has no side of
 * that line to be on — it is model-only by construction. This asserts the
 * tape format never grew a trace field, so "it is a sidecar" stays a fact
 * about the code instead of a note in a docblock.
 */
export function assertTraceIsSidecarOnly(tapeSample) {
    const banned = ['trace', 'decisions', 'decision_trace', 'rejected'];
    const present = banned.filter((k) => tapeSample && k in tapeSample);
    if (present.length) {
        fail(`decisionTrace: the tape carries ${present.join(', ')}. A trace is a `
            + 'SIDECAR — `GAME_VISIBLE_DROPS` classifies model-only tape fields and a '
            + 'trace is not a tape field at all. Moving it into the tape would make the '
            + 'pinning test ask which side of the game/model line a debugging record '
            + 'sits on, which is a question with no honest answer.');
    }
    for (const d of GAME_VISIBLE_DROPS) {
        if (banned.some((b) => d.startsWith(b))) {
            fail(`decisionTrace: GAME_VISIBLE_DROPS names "${d}", which is a trace `
                + 'field. The classification list is for TAPE fields.');
        }
    }
    return { sidecar: true, checked: banned };
}

/** `<name>.tape.json` -> `<name>.trace.json`, one convention, one place. */
export function traceSidecarName(tapeName) {
    if (typeof tapeName !== 'string' || !tapeName) {
        fail('traceSidecarName: needs the tape name');
    }
    return `${tapeName}.trace.json`;
}

/**
 * ── THE PRODUCER SEAM, for slice 2's solver ───────────────────────────
 *
 * The policy calls `record` once per DECISION and `finish` once at the end.
 * Deliberately tiny: the solver owns the loop, this owns the contract, and
 * `finish` runs the whole validator so a malformed trace is caught where it
 * was produced rather than where it is read.
 */
export function createTraceBuilder({ tape, boot }) {
    if (typeof tape !== 'string' || !tape) {
        fail('createTraceBuilder: `tape` names the tape this trace will explain');
    }
    const rows = [];
    return {
        record(row) {
            assertTraceRow(row, rows.length, 'traceBuilder');
            if (rows.length && row.tick <= rows[rows.length - 1].tick) {
                fail(`traceBuilder: tick ${row.tick} is not after the previous row's `
                    + `${rows[rows.length - 1].tick}; a trace is sparse but ordered`);
            }
            rows.push(row);
            return row;
        },
        get length() { return rows.length; },
        finish(tickCount) {
            return parseDecisionTrace({
                trace_version: TRACE_VERSION,
                tape,
                tick_count: tickCount,
                boot: { level: boot.level, x: boot.x, y: boot.y },
                rows,
            }, `traceBuilder(${tape})`);
        },
    };
}

/**
 * The CLI's data half — counts by goal, by strategy and by obstacle, plus
 * the vocabulary REPORT (assumption 3): anything outside
 * `KNOWN_GOAL_KINDS`/`KNOWN_STRATEGY_VERBS` is named rather than refused, so
 * a typo surfaces and a genuinely new verb is visible the first time it runs.
 */
export function summarizeTrace(trace) {
    const tally = (xs) => xs.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map());
    const goals = tally(trace.rows.map((r) => r.goal.kind));
    const verbs = tally(trace.rows.map((r) => r.strategy.verb));
    const obstacles = tally(trace.rows.filter((r) => r.obstacle).map((r) => r.obstacle.kind));
    return {
        tape: trace.tape,
        rows: trace.rows.length,
        tickCount: trace.tick_count,
        firstTick: trace.rows.length ? trace.rows[0].tick : null,
        lastTick: trace.rows.length ? trace.rows[trace.rows.length - 1].tick : null,
        goals: Object.fromEntries(goals),
        verbs: Object.fromEntries(verbs),
        obstacles: Object.fromEntries(obstacles),
        rejections: trace.rows.reduce((n, r) => n + r.rejected.length, 0),
        rowsWithPath: trace.rows.filter((r) => Array.isArray(r.path)).length,
        unknownGoalKinds: [...goals.keys()].filter((k) => !KNOWN_GOAL_KINDS.includes(k)),
        unknownStrategyVerbs: [...verbs.keys()].filter((v) => !KNOWN_STRATEGY_VERBS.includes(v)),
    };
}

/** One row, as a line. The CLI's `--dump` and nothing else uses it. */
export function formatTraceRow(row) {
    const at = `t${String(row.tick).padStart(5)}`;
    const where = `L${row.saw.level} (${row.saw.x},${row.saw.y})`;
    const keys = row.keys.length ? row.keys.join('+') : '-';
    const obstacle = row.obstacle ? ` blocked-by=${row.obstacle.kind}`
        + `${row.obstacle.id ? `:${row.obstacle.id}` : ''}` : '';
    const rejected = row.rejected.length
        ? `\n         rejected: ${row.rejected.map((r) => `${r.option} (${r.why})`).join('; ')}`
        : '';
    return `${at} ${where} goal=${row.goal.kind}${obstacle} -> ${row.strategy.verb}`
        + ` keys=[${keys}]${rejected}`;
}
