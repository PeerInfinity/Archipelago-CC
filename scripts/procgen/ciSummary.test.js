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

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    batteryCompleteness, CI_DONE_MARK, CI_PLANNED_MARK, GATE_JOB, GUARD_JOB, gateVerdicts, parseGateLines, parseGateMsLines, pickGateRuns,
    pickSuiteRun, pickVitestJob, shardNoteIn, SUITE_SHARD_JOB, SUITE_SLOW_JOB, suiteJobs,
    sumSummaries, VITEST_JOB,
} from './ciSummary.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

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
            .toEqual({ id: 2, of: 3, fixed: false });
    });

    /** ⛓ ci-jsut-split — a headless shard says it is a FIXED-count slice, so the
     *  audit holds it to its kill deadline and never to the bin budget. */
    it('reads `; fixed count` as a fixed shard', () => {
        expect(shardNoteIn('## shard 1 of 2 — procgen-help +40; 612.0s measured in CI; fixed count'))
            .toEqual({ id: 1, of: 2, fixed: true });
    });

    /** ⛔ A job that ran its whole set printed no note, and answering `shard 0
     *  of 1` for it would judge an unpartitioned job against a per-shard
     *  budget nobody chose for it. */
    it('answers null for a job that was never sharded', () => {
        expect(shardNoteIn('# ci-gates — the headless procgen gates, on this pushed head'))
            .toBe(null);
    });
});

/**
 * ⛓⛓⛓ **R1 — WHICH JOB THE SUITE'S NUMBERS COME OUT OF.** `ci-summary` used to
 * refuse an in-progress RUN outright, and `unittests_frontend.yml` keeps the run
 * open while the browser gate shards finish (S3's matrix) — so a reader was told
 * *"pass --wait"* minutes after the Vitest job had concluded and its log was
 * final. The pick is pure so it can be asked here, without a run.
 *
 * ⛔ The shapes below are REAL: measured off run 34287938067 (the ⚖ 52 baseline
 * at `4689b7067a`), `gh api repos/…/actions/runs/<id>/jobs` returns five jobs
 * named `JavaScript Unit Tests (Vitest)`, `Browser gates (shard plan)` and three
 * `Browser gate shard — …`.
 */
describe('pickVitestJob — the SUITE lives in one job of a matrix run', () => {
    const RUN_34287938067 = [
        { id: 1, name: 'JavaScript Unit Tests (Vitest)', status: 'completed', conclusion: 'success' },
        { id: 2, name: 'Browser gates (shard plan)', status: 'completed', conclusion: 'success' },
        { id: 3, name: 'Browser gate shard — seedling-wasm-element', status: 'in_progress', conclusion: null },
        { id: 4, name: 'Browser gate shard — maze-lab +14', status: 'queued', conclusion: null },
        { id: 5, name: 'Browser gate shard — producer: plan-seedling-r7-ends-meet --check +8', status: 'queued', conclusion: null },
    ];

    it('picks the Vitest job out of the shard matrix, whatever order it is in', () => {
        expect(pickVitestJob(RUN_34287938067).id).toBe(1);
        expect(pickVitestJob([...RUN_34287938067].reverse()).id).toBe(1);
    });

    /**
     * ⛔ **THE POINT OF THE WHOLE CHANGE**, as a row: the run is not completed
     * (two shards are still queued) and the suite's job is. A reader keyed on
     * the RUN would refuse here.
     */
    it('…and that job can be completed while the run is not', () => {
        const job = pickVitestJob(RUN_34287938067);
        expect(job.status).toBe('completed');
        expect(job.conclusion).toBe('success');
        expect(RUN_34287938067.every((j) => j.status === 'completed')).toBe(false);
    });

    /** ⛓ `null`, never `jobs[0]` — the fallback is the caller's decision, and a
     *  silent first-job pick is how a renamed job stops being noticed. */
    it('answers null when no job matches, rather than falling through', () => {
        expect(pickVitestJob(RUN_34287938067.slice(1))).toBeNull();
        expect(pickVitestJob([])).toBeNull();
        expect(pickVitestJob(undefined)).toBeNull();
        expect(pickVitestJob([{ name: undefined }])).toBeNull();
    });

    /** ⛓ The match is the stable PREFIX: the workflow's suffix is `(Vitest)`. */
    it('matches on the prefix the workflow keeps', () => {
        expect(VITEST_JOB.test('JavaScript Unit Tests (Vitest)')).toBe(true);
        expect(VITEST_JOB.test('JavaScript Unit Tests')).toBe(true);
        expect(VITEST_JOB.test('Browser gate shard — maze-lab +14')).toBe(false);
    });
});

/**
 * ⛓ ci-split C2 (2026-09-27) — **THE HEADLESS GATES LEFT THE VITEST JOB.**
 * `unittests_frontend.yml` runs `ci-gates.mjs` in a job of its own beside the
 * Vitest job, so a run now carries TWO non-shard jobs that both start with a
 * checkout and `npm ci`. `pickVitestJob` takes the FIRST job matching
 * `VITEST_JOB`; a gates job named `JavaScript Unit Tests (gates)` listed ahead
 * of the suite's job would hand `ci-vitest-summary.mjs` a log with no vitest
 * summary in it. The fixture is the job list of the split workflow; the second
 * row reads the workflow itself, so a rename there fails here.
 */
describe('pickVitestJob — the split workflow (the gates are their own job)', () => {
    const SPLIT_RUN = [
        { id: 11, name: 'Headless procgen gates', status: 'in_progress', conclusion: null },
        { id: 12, name: 'JavaScript Unit Tests (Vitest)', status: 'completed', conclusion: 'success' },
        { id: 13, name: 'Browser gates (shard plan)', status: 'completed', conclusion: 'success' },
        { id: 14, name: 'Browser gate shard — seedling-wasm-ship', status: 'in_progress', conclusion: null },
    ];

    it('picks the suite job, not the gates job listed ahead of it', () => {
        expect(pickVitestJob(SPLIT_RUN).id).toBe(12);
        expect(pickVitestJob([...SPLIT_RUN].reverse()).id).toBe(12);
        expect(VITEST_JOB.test('Headless procgen gates')).toBe(false);
    });

    /** ⛔ Read off the workflow, not typed. ⛓ ci-jsut-split: the suite is TWO job
     *  definitions now — the `vitest --shard` matrix and the slow tier — and the
     *  gates are in neither. */
    it('in unittests_frontend.yml the suite family is the shard matrix + the slow job', () => {
        const wf = readFileSync(join(REPO, '.github/workflows/unittests_frontend.yml'), 'utf8');
        const jobs = [];
        for (const block of wf.slice(wf.indexOf('\njobs:\n')).split(/\n(?= {2}[a-z][\w-]*:\n)/).slice(1)) {
            const name = /^ {4}name: (.+)$/m.exec(block)?.[1] ?? '';
            jobs.push({ name, block });
        }
        expect(jobs.length).toBeGreaterThanOrEqual(4);
        const matching = jobs.filter((j) => VITEST_JOB.test(j.name));
        expect(matching.map((j) => j.name)).toEqual([
            'JavaScript Unit Tests (Vitest shard ${{ matrix.shard }}/${{ strategy.job-total }})',
            'JavaScript Unit Tests (slow Vitest)']);
        const [shards, slow] = matching;
        expect(shards.block).toContain(
            'npm run test:unit -- --shard=${{ matrix.shard }}/${{ strategy.job-total }}');
        expect(shards.block).not.toContain('test:unit:slow');
        expect(shards.block).toMatch(/fail-fast: false/);
        expect(slow.block).toContain('npm run test:unit:slow');
        for (const j of matching) expect(j.block).not.toContain('ci-gates.mjs');
        /** ⛓ the EXPANDED names are what the reader's regexes see. */
        const n = JSON.parse(/^ {8}shard: (\[.*\])$/m.exec(shards.block)[1]).length;
        expect(n).toBe(3);
        for (let k = 1; k <= n; k++) {
            expect(SUITE_SHARD_JOB.test(`JavaScript Unit Tests (Vitest shard ${k}/${n})`)).toBe(true);
        }
        expect(SUITE_SLOW_JOB.test(slow.name)).toBe(true);
        const gates = jobs.find((j) => /node scripts\/procgen\/ci-gates\.mjs --set=headless/m.test(j.block));
        expect(gates?.name).toBe('Headless procgen gates (shard ${{ matrix.shard }})');
    });
});

/**
 * ⛓⛓ ci-skip-rules RULE 1 — a main push of an already-green SHA SKIPS its
 * suite, and that skipped run is the newest at the SHA. The reader must answer
 * with the run that did run the suite (the branch's), or the planners' "JSUT
 * at the merged SHA before the ff" reads a skip.
 */
describe('pickSuiteRun — the newest run whose suite did NOT skip', () => {
    const run = (id, o = {}) => ({ databaseId: id, event: 'push', headBranch: 'main',
        status: 'completed', conclusion: 'success', ...o });
    const job = (name, status, conclusion) => ({ name, status, conclusion });
    const SUITE = 'JavaScript Unit Tests (Vitest)';
    const GUARD = 'Same SHA already green?';

    it('passes over the skipped main run and answers with the branch run', () => {
        const runs = [run(2), run(1, { headBranch: 'fidelity-harvest/x' })];
        const jobs = { 2: [job(GUARD, 'completed', 'success'), job(SUITE, 'completed', 'skipped')],
            1: [job(SUITE, 'completed', 'success')] };
        const { run: r, passedOver } = pickSuiteRun(runs, (x) => jobs[x.databaseId]);
        expect(r.databaseId).toBe(1);
        expect(passedOver.map((p) => p.run.databaseId)).toEqual([2]);
    });

    it('a main run whose guard has not decided defers to an older SUCCESSFUL run', () => {
        const runs = [run(2, { status: 'in_progress', conclusion: null }),
            run(1, { headBranch: 'b' })];
        const jobs = { 2: [job(GUARD, 'in_progress', null), job(SUITE, 'queued', null)],
            1: [job(SUITE, 'completed', 'success')] };
        expect(pickSuiteRun(runs, (x) => jobs[x.databaseId]).run.databaseId).toBe(1);
        /** …and a run with no jobs listed yet is undecided too. */
        expect(pickSuiteRun(runs, (x) => (x.databaseId === 2 ? [] : jobs[1])).run.databaseId)
            .toBe(1);
    });

    /** ⛔ The guard finds only a SUCCESS, so with none the main run is the answer. */
    it('with no older success the undecided main run IS the answer', () => {
        const runs = [run(2, { status: 'in_progress', conclusion: null }),
            run(1, { headBranch: 'b', conclusion: 'cancelled' })];
        const jobs = { 2: [job(GUARD, 'in_progress', null)], 1: [job(SUITE, 'completed', 'cancelled')] };
        expect(pickSuiteRun(runs, (x) => jobs[x.databaseId]).run.databaseId).toBe(2);
    });

    /** ⛔ The guard is a main-PUSH job: a dispatch or a branch push is never predicted. */
    it('an in-progress dispatch or branch run is the answer, never passed over', () => {
        for (const o of [{ event: 'workflow_dispatch' }, { headBranch: 'b' }]) {
            const runs = [run(2, { status: 'in_progress', conclusion: null, ...o }), run(1)];
            const jobs = { 2: [job(SUITE, 'in_progress', null)], 1: [job(SUITE, 'completed', 'success')] };
            expect(pickSuiteRun(runs, (x) => jobs[x.databaseId]).run.databaseId).toBe(2);
        }
    });

    it('no run at all is null', () => {
        expect(pickSuiteRun([], () => []).run).toBe(null);
    });

    /**
     * ⛔ MEASURED on the rule-1 probe (run 39056958592): GitHub SKIPS a job whose
     * ancestor skipped unless its `if:` calls a status function, and the guard
     * skips on every branch push — so the browser shards never ran. Every job
     * with `needs:` must say `!cancelled()` (or `always()`).
     */
    it('every job with `needs:` in unittests_frontend.yml carries a status function', () => {
        const wf = readFileSync(join(REPO, '.github/workflows/unittests_frontend.yml'), 'utf8');
        const blocks = wf.slice(wf.indexOf('\njobs:\n')).split(/\n(?= {2}[a-z][\w-]*:\n)/).slice(1);
        const needing = blocks.filter((b) => /^ {4}needs:/m.test(b));
        expect(needing.length).toBeGreaterThanOrEqual(4);
        for (const b of needing) {
            expect(/^ {4}if: .*(?:!cancelled\(\)|always\(\))/m.test(b), b.split('\n')[0]).toBe(true);
        }
    });

    /** ⛓ Read off the workflow: the guard's name is GUARD_JOB's, and it is not the suite's. */
    it('in unittests_frontend.yml the guard job carries the name GUARD_JOB matches', () => {
        const wf = readFileSync(join(REPO, '.github/workflows/unittests_frontend.yml'), 'utf8');
        const names = [...wf.matchAll(/^ {4}name: (.+)$/gm)].map((m) => m[1]);
        expect(names.filter((n) => GUARD_JOB.test(n))).toEqual([GUARD]);
        expect(VITEST_JOB.test(GUARD)).toBe(false);
    });
});

/**
 * ⛔ RULE 1's second consumer: `--write-costs` and the bank's shard audit price
 * off the newest SUCCESSFUL runs, and a skipped main run is successful with no
 * gate job run. Priced from it, the cost table would be empty.
 */
describe('pickGateRuns — only runs whose gate jobs RAN are a cost population', () => {
    const job = (name, conclusion) => ({ name, status: 'completed', conclusion });
    const SKIPPED = [job('Same SHA already green?', 'success'),
        job('JavaScript Unit Tests (Vitest)', 'skipped'), job('Headless procgen gates', 'skipped'),
        job('Browser gates (shard plan)', 'skipped')];
    const RAN = [job('JavaScript Unit Tests (Vitest)', 'success'), job('Headless procgen gates', 'success'),
        job('Browser gate shard — identity', 'success')];

    it('passes over a skipped run and keeps the newest `limit` that ran', () => {
        const runs = [{ id: 3 }, { id: 2 }, { id: 1 }];
        const jobs = { 3: SKIPPED, 2: RAN, 1: RAN };
        expect(pickGateRuns(runs, (r) => jobs[r.id], 1).map((r) => r.id)).toEqual([2]);
        expect(pickGateRuns(runs, (r) => jobs[r.id], 3).map((r) => r.id)).toEqual([2, 1]);
    });

    it('GATE_JOB names the gate jobs of unittests_frontend.yml, and not the suite or the plan', () => {
        const wf = readFileSync(join(REPO, '.github/workflows/unittests_frontend.yml'), 'utf8');
        const names = [...wf.matchAll(/^ {4}name: (.+)$/gm)].map((m) => m[1]);
        expect(names.filter((n) => GATE_JOB.test(n))).toEqual(
            ['Headless procgen gates (shard ${{ matrix.shard }})',
                'Browser gate shard — ${{ matrix.shard.name }}']);
    });
});

/**
 * ⛓⛓⛓ ci-jsut-split (⚖ user, 2026-10-17) — **ONE SUITE ANSWER OUT OF FOUR JOBS.**
 * The shapes are the job listing of the split workflow: three `Vitest shard k/3`
 * jobs, the `slow Vitest` job, and — when rule 1 skips it — ONE job under the
 * matrix's UNEXPANDED name (measured on run 39083220867 for the browser matrix).
 */
describe('suiteJobs — the suite family, and every way it can be partial', () => {
    const job = (name, conclusion = 'success', status = 'completed', id = name) =>
        ({ id, name, status, conclusion });
    const shard = (k, n = 3, c, st) => job(`JavaScript Unit Tests (Vitest shard ${k}/${n})`, c, st);
    const SLOW = job('JavaScript Unit Tests (slow Vitest)');
    const OTHERS = [job('Same SHA already green?', 'skipped'), job('Headless procgen gates (shard 0)'),
        job('Browser gate shard — seedling-wasm-ship')];

    it('a complete split run: three shards and the slow job, nothing missing', () => {
        const s = suiteJobs([...OTHERS, shard(2), SLOW, shard(1), shard(3)]);
        expect(s.layout).toBe('split');
        expect(s.shards.map((x) => x.k)).toEqual([1, 2, 3]);
        expect(s.slow.name).toBe(SLOW.name);
        expect(s.missing).toEqual([]);
        expect(s.pending).toEqual([]);
    });

    it('⛔ a shard absent from the listing is MISSING by name', () => {
        const s = suiteJobs([shard(1), shard(3), SLOW]);
        expect(s.missing).toEqual(['JavaScript Unit Tests (Vitest shard 2/3)']);
    });

    it('⛔ the slow job is owed whenever any shard ran', () => {
        expect(suiteJobs([shard(1), shard(2), shard(3)]).missing)
            .toEqual(['JavaScript Unit Tests (slow Vitest)']);
    });

    it('⛔ a SKIPPED member of a suite that otherwise ran is missing, not summed away', () => {
        const s = suiteJobs([shard(1), shard(2, 3, 'skipped'), shard(3), SLOW]);
        expect(s.missing).toEqual(['JavaScript Unit Tests (Vitest shard 2/3) (skipped)']);
    });

    it('⛔ shards that disagree on N are named', () => {
        const s = suiteJobs([shard(1), shard(2), shard(3), shard(1, 2), SLOW]);
        expect(s.missing.some((m) => /disagrees/.test(m))).toBe(true);
    });

    it('a red or cancelled shard is NOT missing — its job is there, and it reads red', () => {
        const s = suiteJobs([shard(1), shard(2, 3, 'failure'), shard(3, 3, 'cancelled'), SLOW]);
        expect(s.missing).toEqual([]);
        expect(s.shards.map((x) => x.job.conclusion)).toEqual(['success', 'failure', 'cancelled']);
    });

    it('pending names every member that has not concluded', () => {
        const s = suiteJobs([shard(1), shard(2, 3, null, 'in_progress'), shard(3, 3, null, 'queued'), SLOW]);
        expect(s.pending.map((j) => j.name)).toEqual([
            'JavaScript Unit Tests (Vitest shard 2/3)', 'JavaScript Unit Tests (Vitest shard 3/3)']);
    });

    it('rule 1: the family skipped under its UNEXPANDED matrix name reads as skipped', () => {
        const s = suiteJobs([job('Same SHA already green?'),
            job('JavaScript Unit Tests (Vitest shard ${{ matrix.shard }}/${{ strategy.job-total }})', 'skipped'),
            job('JavaScript Unit Tests (slow Vitest)', 'skipped')]);
        expect(s.skipped).toBe(true);
    });

    it('a run from before the split (one job, both summaries) is `single`', () => {
        const s = suiteJobs([job('JavaScript Unit Tests (Vitest)'), job('Headless procgen gates')]);
        expect(s.layout).toBe('single');
        expect(s.single.name).toBe('JavaScript Unit Tests (Vitest)');
        expect(s.missing).toEqual([]);
    });

    it('no suite job at all is `none`', () => {
        expect(suiteJobs(OTHERS).layout).toBe('none');
        expect(suiteJobs(undefined).layout).toBe('none');
    });
});

describe('sumSummaries — the shards add up to one suite', () => {
    const row = (ff, fp, tf, tp, ts) => ({
        files: { failed: ff, passed: fp, skipped: 0, total: ff + fp },
        tests: { failed: tf, passed: tp, skipped: ts, total: tf + tp + ts } });
    it('sums every field', () => {
        expect(sumSummaries([row(0, 280, 0, 7000, 1), row(1, 279, 2, 6900, 0), row(0, 279, 0, 6927, 0)]))
            .toEqual({ files: { failed: 1, passed: 838, skipped: 0, total: 839 },
                tests: { failed: 2, passed: 20827, skipped: 1, total: 20830 } });
    });
});

describe('pickSuiteRun — the split family', () => {
    const run = (id, o = {}) => ({ databaseId: id, event: 'push', headBranch: 'main',
        status: 'completed', conclusion: 'success', ...o });
    const job = (name, status, conclusion) => ({ name, status, conclusion });
    const GUARD = 'Same SHA already green?';

    it('passes over a main run whose whole family skipped', () => {
        const runs = [run(2), run(1, { headBranch: 'b' })];
        const jobs = { 2: [job(GUARD, 'completed', 'success'),
            job('JavaScript Unit Tests (Vitest shard ${{ matrix.shard }}/${{ strategy.job-total }})', 'completed', 'skipped'),
            job('JavaScript Unit Tests (slow Vitest)', 'completed', 'skipped')],
        1: [job('JavaScript Unit Tests (Vitest shard 1/3)', 'completed', 'success')] };
        expect(pickSuiteRun(runs, (x) => jobs[x.databaseId]).run.databaseId).toBe(1);
    });

    it('a main run with ONE shard still running and no guard verdict defers to an older success', () => {
        const runs = [run(2, { status: 'in_progress', conclusion: null }), run(1, { headBranch: 'b' })];
        const jobs = { 2: [job(GUARD, 'in_progress', null),
            job('JavaScript Unit Tests (Vitest shard 1/3)', 'completed', 'success'),
            job('JavaScript Unit Tests (Vitest shard 2/3)', 'in_progress', null)],
        1: [] };
        expect(pickSuiteRun(runs, (x) => jobs[x.databaseId]).run.databaseId).toBe(1);
    });
});

/**
 * ⛓⛓⛓ ci-jsut-split (fidelity-9's asks (b), (c)) — A CUT BATTERY READS TRUNCATED.
 * Measured: run 39081866066's one headless job printed 63 of 95 and timed out.
 */
describe('batteryCompleteness — PLANNED without DONE is a truncated job, by name', () => {
    const gate = (k) => `## CI-GATE | ${k} | x | exit=0 | ok`;
    const ts = (l) => `2026-10-18T00:12:15.5310669Z ${l}`;
    it('a finished battery is complete, and TIGHT past the warn fraction', () => {
        const log = [`${CI_PLANNED_MARK} 2 arm(s) | step deadline 1200s`, gate('a'), gate('b'),
            `${CI_DONE_MARK} 2 of 2 arm(s) | 950.0s of a 1200s step deadline`].map(ts).join('\n');
        const b = batteryCompleteness([{ job: 'Headless procgen gates (shard 0)', log }]);
        expect(b.truncated).toEqual([]);
        expect(b.tight.map((j) => j.job)).toEqual(['Headless procgen gates (shard 0)']);
        expect(b.jobs[0]).toMatchObject({ planned: 2, printed: 2, elapsedS: 950, deadlineS: 1200 });
    });
    it('⛔ no DONE line ⇒ TRUNCATED, with planned and printed', () => {
        const log = [`${CI_PLANNED_MARK} 95 arm(s)`, gate('a'), '##[error]The action has timed out after 20 minutes.']
            .map(ts).join('\n');
        const b = batteryCompleteness([{ job: 'Headless procgen gates (shard 1)', log }]);
        expect(b.truncated).toHaveLength(1);
        expect(b.truncated[0]).toMatchObject({ planned: 95, printed: 1, done: false });
    });
    it('a log from before the markers (or a suite job) is not judged', () => {
        expect(batteryCompleteness([{ job: 'x', log: gate('a') }]).jobs).toEqual([]);
    });
});

describe('unittests_frontend.yml — every gate battery is checked complete', () => {
    const wf = readFileSync(join(REPO, '.github/workflows/unittests_frontend.yml'), 'utf8');
    it('each ci-gates step passes --deadline-s = its own timeout-minutes × 60', () => {
        const steps = wf.split('- name: ').filter((b) => /node scripts\/procgen\/ci-gates\.mjs/.test(b)
            && /--shard=/.test(b));
        expect(steps).toHaveLength(2);
        for (const b of steps) {
            const min = Number(/timeout-minutes: (\d+)/.exec(b)[1]);
            expect(Number(/--deadline-s=(\d+)/.exec(b)[1])).toBe(min * 60);
        }
    });
    it('a "Battery complete?" step follows each, failing on a missing CI-DONE', () => {
        const checks = wf.split('- name: ').filter((b) => /^'?Battery complete\?/.test(b));
        expect(checks).toHaveLength(2);
        for (const c of checks) {
            expect(c).toContain("grep -aq '^## CI-DONE |' /tmp/gates.log");
            expect(c).toContain('exit 1');
        }
    });
});
