/**
 * ciSummary — **THE VERDICT RULE, ASKED WITHOUT A RUNNER** (standing-values
 * CI arc, slice S4; ⚖ 72 (b)).
 *
 * ⛔⛔ WHY THIS FILE EXISTS. ⚖ 72 (b)'s bar is *"three consecutive runs in
 * which THAT ROW reads `same`"*, and `ci-summary --gates` is the instrument
 * that decides what a row reads. Until S4 that decision was inline in the
 * script, where the only way to ask it a question was to point it at a
 * finished CI run over the network — so its edges (a `@ci-face` key, an arm
 * with no line, a `@ci-shallow` row that happens to agree) were never asked.
 * Everything here is pure: a `Map` of parsed lines, a bank object, and arms
 * shaped like `ciGateArms`' output. No network, no box.
 */

import { describe, expect, it } from 'vitest';

import { gateVerdicts, parseGateLines, parseGateMsLines, shardNoteIn } from './ciSummary.js';

/** ⛓ An arm shaped like `ciGateArms`' output, with only the fields the rule
 *  reads — and BOTH keys, which differ exactly for a declared face. */
const arm = (key, gate = {}, bankKey = key) => ({
    gate: { file: `check-${key}.mjs`, ciFace: null, ciShallow: null, ...gate },
    label: null, argv: [], bankKey, key,
});
const lines = (...rows) => new Map(rows.map((r) => [r.key, { exit: 0, total: null, ...r }]));
const bankOf = (o) => Object.fromEntries(Object.entries(o).map(([k, value]) => [k, { value }]));

describe('gateVerdicts — same, MOVED, shallow, not-banked', () => {
    it('a line equal to the bank is `same`, and a different one is `MOVED`', () => {
        const { rows, missing } = gateVerdicts({
            lines: lines({ key: 'gate: a', value: '10/0' }, { key: 'gate: b', value: '9/1' }),
            bank: bankOf({ 'gate: a': '10/0', 'gate: b': '10/0' }),
            arms: [arm('gate: a'), arm('gate: b')],
        });
        expect(rows.map((r) => r.verdict)).toEqual(['same', 'MOVED']);
        expect(rows[1].banked).toBe('10/0');
        expect(missing).toEqual([]);
    });

    /**
     * ⛔⛔ A `@ci-face` KEY IS A DIFFERENT, BOUNDED CLAIM — the bank holds no
     * row under it, and counting it as agreement is the quiet zero the whole
     * refusal ladder exists to prevent (P4b (D)).
     */
    it('a declared face publishes under its own key and is `not-banked`', () => {
        const { rows } = gateVerdicts({
            lines: lines({ key: 'gate-help-ci: help', value: '265/0' }),
            bank: bankOf({ 'gate: help': '265/0' }),
            arms: [arm('gate-help-ci: help', { ciFace: { prefix: 'gate-help-ci' } }, 'gate: help')],
        });
        expect(rows[0].verdict).toBe('not-banked');
        /** ⛔ …and NOT `same`, even though the two numbers are equal. */
        expect(rows[0].banked).toBe(null);
    });

    /* ── ⛔⛔⛔ S4 — THE `shallow` VERDICT (trap 1058) ─────────────────── */

    it('a declared @ci-shallow row is `shallow`, not `MOVED`, and carries its reason', () => {
        const { rows } = gateVerdicts({
            lines: lines({ key: 'gate: records', value: '42/24', exit: 1 }),
            bank: bankOf({ 'gate: records': '73/0/37' }),
            arms: [arm('gate: records', { ciShallow: { reason: 'depth-1 clone' } })],
        });
        expect(rows[0].verdict).toBe('shallow');
        expect(rows[0].shallow).toBe('depth-1 clone');
        /** ⛓ …and BOTH numbers survive, so the reader is not asked to trust
         *  the label — the bank's value is right there beside CI's. */
        expect(rows[0].banked).toBe('73/0/37');
        expect(rows[0].value).toBe('42/24');
    });

    /**
     * ⛔⛔ **THE ROW THAT DECIDES WHERE THE CHECK GOES.** A shallow gate's CI
     * answer can COINCIDE with the bank — `full-tier-owed` would read `same`
     * the moment its banked composite happened to match a depth-1 refusal's
     * shape — and if the compare ran first, that coincidence would count
     * toward ⚖ 72 (b)'s three-run streak for a row whose answer is about a
     * different tree. So the declaration is checked BEFORE the compare, and
     * this is the row that fails if anybody reorders them.
     */
    it('⛔ …even when its value HAPPENS to equal the bank — never a free `same`', () => {
        const { rows } = gateVerdicts({
            lines: lines({ key: 'gate: records', value: '73/0/37' }),
            bank: bankOf({ 'gate: records': '73/0/37' }),
            arms: [arm('gate: records', { ciShallow: { reason: 'depth-1 clone' } })],
        });
        expect(rows[0].verdict).toBe('shallow');
    });

    /**
     * ⛔ AND A BANKED ARM WITH NO LINE IS `missing` — a shard that never ran
     * must read as an ABSENT ANSWER, not as a smaller verdict set that agrees
     * with itself.
     */
    it('an arm the run never answered is missing, not silently dropped', () => {
        const { rows, missing } = gateVerdicts({
            lines: lines({ key: 'gate: a', value: '10/0' }),
            bank: bankOf({ 'gate: a': '10/0', 'gate: b': '5/0' }),
            arms: [arm('gate: a'), arm('gate: b')],
        });
        expect(rows).toHaveLength(1);
        expect(missing).toEqual(['gate: b']);
    });

    /** ⛓ A line for a key no arm claims is still compared against the bank —
     *  the roster moved under the run, and the bank is what the reader wants. */
    it('a line from an arm the roster no longer holds still compares', () => {
        const { rows } = gateVerdicts({
            lines: lines({ key: 'gate: gone', value: '3/0' }),
            bank: bankOf({ 'gate: gone': '3/0' }),
            arms: [],
        });
        expect(rows[0].verdict).toBe('same');
    });

    /** ⛓ …and the whole thing composes with the real parser, so the shapes
     *  the script hands it are the shapes asserted above. */
    it('reads a real `## CI-GATE |` line end to end', () => {
        const log = '2026-09-01T00:00:00Z ## CI-GATE | gate: a | 10/0 | exit=0 | ALL CHECKS PASSED\n';
        const { rows } = gateVerdicts({
            lines: parseGateLines(log), bank: bankOf({ 'gate: a': '10/0' }), arms: [arm('gate: a')],
        });
        expect(rows[0]).toMatchObject({ key: 'gate: a', value: '10/0', exit: 0, verdict: 'same' });
    });
});

/**
 * ⛓⛓ S5b — **THE COST LINE, WHICH IS NOT THE VERDICT LINE** (trap 1068).
 *
 * ⛔ THE ROW THAT MATTERS IS THE LAST ONE: a job log carries BOTH markers and
 * the two readers must not see each other's lines. `##   ms |` contains
 * `## ` and a `|`, so a reader written loosely enough would fold an arm's
 * cost into the verdict map as a row with no `exit=` — which is exactly the
 * shape `parseGateLines` already drops, and dropping it silently is how the
 * next widening of the line format goes unnoticed.
 */
describe('parseGateMsLines — what the arm cost the runner', () => {
    const LOG = [
        '2026-09-01T22:10:00.0000000Z ## CI-GATE | gate: maze-lab | 231/0 | exit=0 | ALL PASS',
        '2026-09-01T22:10:00.0000000Z ##   ms | gate: maze-lab | here=33.2s',
        '2026-09-01T22:10:00.0000000Z ##   ms | gate: seedling-wasm-element | here=901.2s',
        '2026-09-01T22:10:00.0000000Z ##   ms | mangled | here=soon',
        '2026-09-01T22:10:00.0000000Z something else entirely',
    ].join('\n');

    it('reads every `here=` line, in milliseconds, past the log timestamp', () => {
        const ms = parseGateMsLines(LOG);
        expect(ms.get('gate: maze-lab')).toBe(33200);
        expect(ms.get('gate: seedling-wasm-element')).toBe(901200);
    });

    it('drops a line whose `here=` is not a number, rather than banking NaN', () => {
        expect(parseGateMsLines(LOG).has('mangled')).toBe(false);
        expect(parseGateMsLines(LOG).size).toBe(2);
    });

    /** ⛔ THE TWO READERS DO NOT SEE EACH OTHER'S LINES. */
    it('the verdict reader takes nothing from a cost line, and the reverse', () => {
        expect([...parseGateLines(LOG).keys()]).toEqual(['gate: maze-lab']);
        expect(parseGateMsLines(LOG).has('231/0')).toBe(false);
    });
});

describe('shardNoteIn — was this job a slice of a partition?', () => {
    it('reads the id and the count out of the job\'s own note', () => {
        expect(shardNoteIn('## shard 2 of 3 — maze-lab +16; 171.7s banked'))
            .toEqual({ id: 2, of: 3 });
    });

    /** ⛔ A job that ran its whole set printed no note, and answering `shard 0
     *  of 1` for it would judge an unpartitioned job against a per-shard
     *  budget nobody chose for it. */
    it('answers null for a job that was never sharded', () => {
        expect(shardNoteIn('# ci-gates — the headless procgen gates, on this pushed head'))
            .toBe(null);
    });
});
