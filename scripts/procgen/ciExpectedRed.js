/**
 * ciExpectedRed — **THE ARMS ALLOWED TO BE RED IN CI, BY NAME, AND THE JUDGE
 * THAT FAILS EVERY OTHER RED** (Seedling fidelity, slice GATESUBJ — D4).
 *
 * ── ⛔ WHY IT EXISTS ─────────────────────────────────────────────────
 *
 * The gate steps of `unittests_frontend.yml` are `continue-on-error: true`, on
 * purpose: they are STANDING-VALUE READERS (`ci-gates.mjs`'s docblock says
 * why — `check-seedling-full-tier-owed` is red whenever a measurement is owed,
 * which is a scheduling fact, not a merge gate). The cost of that was measured
 * at main `f1b4f85446` (run 39540239745): FIVE arms printed `exit=1` on every
 * push for two to three weeks — `procgen-demos`, `seedling-editor-phases`,
 * `seedling-editor-refusal`, `seedling-hammer-monotonicity`,
 * `seedling-rewind-exactness` — and every job was green. A red printed in a
 * line nobody reads is a red nobody sees.
 *
 * ⛓ The arms keep `continue-on-error`. What changes is that a SECOND step reads
 * the battery's own `## CI-GATE |` lines and fails the job when an arm is red
 * and NOT declared here — the `KNOWN_RED` shape of `ci-producer-checks.mjs`,
 * one step over.
 *
 * ── THE TABLE ────────────────────────────────────────────────────────
 *
 * Keyed by the arm's CI KEY, exactly as the `## CI-GATE | <key> |` line prints
 * it (`gate: seedling-editor-phases`, `identity: …`, `producer: …`). Each row
 * says WHO owns the red, WHY it is red and SINCE when — a row without an owner
 * is a red nobody is going to fix.
 *
 * ⛔ THREE WAYS A ROW IS ITSELF RED, so the table cannot rot quietly:
 *   · an arm red in the log and ABSENT from the table   → `UNEXPECTED-RED`
 *   · a listed arm that printed `exit=0`                → `NOW-GREEN` (drop its entry)
 *   · a listed key that names no arm of any CI set      → `STALE` (a renamed or
 *     deleted gate would otherwise keep its licence forever)
 * A listed arm this log does not carry is a SIBLING SHARD's — named, not judged.
 */

import { CI_GATE_MARK, parseGateLines } from './ciSummary.js';

/**
 * ⛓ THE EXPECTED-RED ARMS, AS SEEDED BY GATESUBJ at its head (measured: CI run
 * 39540239745 at `f1b4f85446` and this slice's own head). Add a row only with an
 * owner; delete it in the commit that turns the arm green.
 */
export const CI_GATE_EXPECTED_RED = Object.freeze({
    'gate: seedling-hammer-monotonicity': Object.freeze({
        owner: 'seedling-hammer-phase-planning-2',
        why: 'CRASH ON INVOCATION, not a measured red: the roster runs the gate bare and it '
            + 'requires `--row=` (`Error: --row=null: not a row (--rows lists them)`, 0.0 s, '
            + 'no verdict line). Either the gate takes a default row set under the battery or '
            + 'the roster passes one.',
        since: '014fc135 (2026-10-17, the introducing commit)',
    }),
    'gate: seedling-rewind-exactness': Object.freeze({
        owner: 'seedling-hammer-phase-planning-2',
        why: 'CRASH ON INVOCATION, not a measured red: the roster runs the gate bare and it '
            + 'requires `--row=` or `--script` (`Error: --row=null: not a row (--rows lists '
            + 'them), and no --script`, 0.0 s, no verdict line).',
        since: '014fc135 (2026-10-17, the introducing commit)',
    }),
});

/** The marker every line this judge prints carries — ONE spelling. */
export const EXPECTED_RED_MARK = '## EXPECTED-RED |';

/**
 * ⛓ THE JUDGE, AS A PURE FUNCTION of a battery log, the table and the CI keys
 * that exist — so its edges are unit rows, not a CI run.
 *
 * @param {string} log the battery's own output (`/tmp/gates.log`)
 * @param {object} table `CI_GATE_EXPECTED_RED`'s shape
 * @param {Iterable<string>|null} knownKeys every CI arm key of every set; `null`
 *   skips the STALE check (a caller that cannot derive the roster says so)
 * @returns {{rows: object[], red: number, read: number}}
 */
export function judgeExpectedRed(log, table, knownKeys = null) {
    const lines = parseGateLines(log);
    const rows = [];
    for (const g of lines.values()) {
        const entry = table[g.key] ?? null;
        const bad = !(g.exit === 0);
        let verdict;
        if (bad && !entry) verdict = 'UNEXPECTED-RED';
        else if (bad) verdict = 'EXPECTED-RED';
        else if (entry) verdict = 'NOW-GREEN';
        else continue;
        rows.push({ key: g.key, verdict, exit: g.exit, value: g.value, total: g.total, entry,
            ok: verdict === 'EXPECTED-RED' });
    }
    const known = knownKeys ? new Set(knownKeys) : null;
    for (const [key, entry] of Object.entries(table)) {
        if (lines.has(key)) continue;
        if (known && !known.has(key)) {
            rows.push({ key, verdict: 'STALE', entry, ok: false });
        } else {
            rows.push({ key, verdict: 'ELSEWHERE', entry, ok: true });
        }
    }
    /** ⛔ A log with NO gate line read nothing — never a green. */
    const empty = lines.size === 0;
    if (empty) rows.push({ key: '(battery)', verdict: 'NO-GATE-LINES', ok: false, entry: null });
    return { rows, red: rows.filter((r) => !r.ok).length, read: lines.size };
}

/** One parseable line per judged row. */
export function formatJudgement({ rows, red, read }) {
    const out = [];
    for (const r of rows) {
        const tail = {
            'UNEXPECTED-RED': `exit=${r.exit} | ${r.value} | ${r.total ?? '(no total)'} — red and NOT in `
                + '`CI_GATE_EXPECTED_RED` (scripts/procgen/ciExpectedRed.js): fix it, or add a row WITH '
                + 'an owner',
            'EXPECTED-RED': `exit=${r.exit} | ${r.value} | owner ${r.entry?.owner} — ${r.entry?.why}`,
            'NOW-GREEN': `exit=0 | ${r.value} | listed (owner ${r.entry?.owner}) and now GREEN — `
                + 'drop its entry, the debt was paid',
            STALE: `listed (owner ${r.entry?.owner}) but no CI arm of any set has this key — `
                + 'renamed or deleted; drop or re-key the entry',
            ELSEWHERE: `listed (owner ${r.entry?.owner}); not in this log — a sibling shard's arm`,
            'NO-GATE-LINES': `the log carries no \`${CI_GATE_MARK}\` line — nothing was read`,
        }[r.verdict];
        out.push(`${EXPECTED_RED_MARK} ${r.verdict} | ${r.key} | ${tail}`);
    }
    out.push(`## EXPECTED-RED-DONE | ${read} gate line(s) read | ${red} red | `
        + `${rows.filter((r) => r.verdict === 'EXPECTED-RED').length} expected-red`);
    return out.join('\n');
}
