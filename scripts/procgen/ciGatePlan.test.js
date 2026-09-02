/**
 * ciGatePlan — **THE PARTITION, INTERROGATED WITHOUT SPENDING A RUNNER**
 * (standing-values CI arc, slice S3; ⚖ 72).
 *
 * ⛔⛔ WHY THIS FILE EXISTS AT ALL. The rule it pins decides how many CI jobs
 * there are and which arm lands in which one — and the only other way to ask
 * it a question is to push and wait twenty minutes
 * (`feedback_ci_fix_untested_environment`: a CI-config change's first
 * execution is production). Everything here is pure: a roster stub, a bank
 * stub, no network, no box, no browser.
 *
 * ⛓ THE ROWS THAT USE THE LIVE ROSTER are the ones whose whole content is
 * *"and this agrees with the tree"*, and each is guarded against vacuity by a
 * non-empty assertion first (trap 824).
 */

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    CI_SHARD_BUDGET_MS, armName, auditRunShards, ciGateArms, ciGatePlanFor, ciRunnable,
    ciSourced, planCiShards,
} from './ciGatePlan.js';
import { LOCAL_HOST, REPO, argvFor, gateRoster } from './gateRoster.js';
import { readStandingValues, standingRows } from './standingValues.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** ⛓ An arm shaped like `ciGateArms`' output, with only the fields the
 *  partition reads — the planner must not need a real gate to be asked. */
const arm = (key, file = `check-${key}.mjs`) => ({
    gate: { file }, label: null, argv: [], bankKey: key, key,
});
const bankOf = (msByKey) => ({
    rows: Object.fromEntries(Object.entries(msByKey).map(([k, ms]) => [k, { ms }])),
});

describe('ciRunnable — what a runner can answer', () => {
    it('rejects the Windows rows and NOTHING else', () => {
        const roster = gateRoster({ repo: REPO });
        expect(roster.length).toBeGreaterThan(20);
        const refused = roster.filter((g) => !ciRunnable(g));
        expect(refused.length).toBeGreaterThan(0);
        expect(refused.every((g) => g.windows)).toBe(true);
        expect(roster.filter((g) => g.windows).map((g) => g.file).sort())
            .toEqual(refused.map((g) => g.file).sort());
    });

    /**
     * ⛔ THE HALF THAT WOULD HAVE CAUGHT THE OLD REFUSAL. Before S3 a browser
     * gate was refused by `ci-summary` by name; if this predicate ever starts
     * rejecting browser rows again, every browser standing row silently loses
     * its CI answer while the workflow keeps printing lines for it.
     */
    it('accepts every browser gate — that is what S3 bought', () => {
        const browser = gateRoster({ repo: REPO }).filter((g) => g.browser && !g.windows);
        expect(browser.length).toBeGreaterThan(15);
        expect(browser.filter((g) => !ciRunnable(g))).toEqual([]);
    });
});

describe('ciGateArms — the arms, and BOTH of an arm\'s keys', () => {
    it('the browser set is the browser gates plus their declared arms', () => {
        const roster = gateRoster({ repo: REPO });
        const gates = roster.filter((g) => g.browser && !g.windows);
        const variants = gates.reduce((n, g) => n + (g.variants?.length ?? 0), 0);
        expect(gates.length).toBeGreaterThan(15);
        const arms = ciGateArms({ repo: REPO, set: 'browser' });
        expect(arms.length).toBe(gates.length + variants);
        /** ⛓ …and a declared arm is a SECOND standing row, keyed apart. */
        expect(new Set(arms.map((a) => a.key)).size).toBe(arms.length);
    });

    it('the headless set is unchanged, and a @ci-face still replaces the prefix', () => {
        const arms = ciGateArms({ repo: REPO, set: 'headless' });
        expect(arms.length).toBeGreaterThan(3);
        const faced = arms.filter((a) => a.gate.ciFace);
        expect(faced.length).toBeGreaterThan(0);
        for (const a of faced) {
            expect(a.key.startsWith(`${a.gate.ciFace.prefix}:`)).toBe(true);
            expect(a.bankKey.startsWith('gate:')).toBe(true);
            /** ⛔ the face's argv is what CI RUNS — a bounded claim, its own key. */
            expect(a.argv).toEqual(a.gate.ciFace.argv);
        }
    });

    it('a browser arm is pointed at the caller\'s host, both shapes of it', () => {
        const arms = ciGateArms({ repo: REPO, set: 'browser', host: 'http://h:1' });
        const hosted = arms.filter((a) => a.argv.some((x) => x.startsWith('--host=')));
        const rooted = arms.filter((a) => a.argv.some((x) => x.startsWith('--root=')));
        expect(hosted.length).toBeGreaterThan(0);
        expect(rooted.length).toBeGreaterThan(0);
        /** ⛔ `--root=` is the PAGES-shaped origin: getting this wrong is not a
         *  failure, it is a gate that passes against the wrong tree. */
        for (const a of rooted) expect(a.argv).toContain('--root=http://h:1/frontend');
        for (const a of hosted) expect(a.argv).toContain('--host=http://h:1');
    });

    it('refuses an unknown set BY NAME', () => {
        expect(() => ciGateArms({ repo: REPO, set: 'windows' })).toThrow(/unknown set/);
    });

    /**
     * ⛓⛓⛓ S5 — **THE ARGV PROPERTY, FROM BOTH ENDS, AND IT IS THE THIRD
     * COSTUME'S DOOR.** P4b (D) froze a row because a key was published under
     * a prefix the reader did not ask for; S4's second costume was a key that
     * resolved to no file. Both were caught by asserting the two populations
     * COMPOSE. `@ci-argv` opens a third door onto the same defect, one level
     * down: an arm can now publish under the STANDING key while running argv
     * the standing row does not — and a flag that NARROWS the question
     * (`--only=`, `--doors=ci`) would bank a bounded number under the full
     * claim's key with nothing red anywhere.
     *
     * ⇒ the invariant, asserted over the live tree: **a standing-keyed arm's
     * argv is the LOCAL argv plus exactly the flags its gate DECLARES** — the
     * local argv is never dropped (a substitution is what a `@ci-face` does,
     * and a faced arm is never standing-keyed), and an undeclared extra flag
     * is a red naming the arm and the flag.
     */
    it('⛔ a standing-keyed arm runs the LOCAL argv plus exactly its declared CI flags', () => {
        const arms = ciGateArms({ repo: REPO, set: 'all', host: 'http://h:1' });
        const standing = arms.filter((a) => a.key === a.bankKey);
        /** ⛓ non-vacuity, both halves (trap 824): there ARE standing-keyed
         *  arms, and at least one of them needs argv to address its world. */
        expect(standing.length).toBeGreaterThan(20);
        expect(standing.filter((a) => a.argv.length > 0).length).toBeGreaterThan(0);
        for (const a of standing) {
            /** ⛔ a faced gate publishes under its OWN prefix; if one ever
             *  reaches this list the face has stopped replacing the key. */
            expect(a.gate.ciFace).toBe(null);
            const base = a.label
                ? (a.gate.variants.find((v) => v.label === a.label)?.argv ?? [])
                : argvFor(a.gate, 'local', { host: 'http://h:1' });
            for (const f of base) expect(a.argv).toContain(f);
            const extra = a.argv.filter((f) => !base.includes(f));
            expect(extra).toEqual(a.gate.ciArgv?.argv ?? []);
        }
    });

    /**
     * ⛓⛓⛓ S5 — **THE DECLARER, AND WHAT ITS DECLARATION DOES.** Non-vacuity
     * for the property above (trap 824): without a gate that declares
     * `@ci-argv`, "the extras are exactly the declared flags" is `[] === []`
     * for every arm and the append could be deleted with nothing red.
     * ⛔ The gate is found by its DECLARATION, not by name — a row that typed
     * `check-procgen-help.mjs` would go red the day the declaration moves to
     * a second gate, which is the direction that should stay green.
     */
    it('⛔ the gate that declares @ci-argv runs CI with those flags, under its STANDING key', () => {
        const arms = ciGateArms({ repo: REPO, set: 'all' });
        const declared = arms.filter((a) => a.gate.ciArgv);
        expect(declared.length).toBeGreaterThan(0);
        for (const a of declared) {
            /** ⛔ the same claim ⇒ the same key. This is the clause that keeps
             *  `@ci-argv` from becoming a face by accident. */
            expect(a.key).toBe(a.bankKey);
            expect(a.key.startsWith('gate:')).toBe(true);
            for (const f of a.gate.ciArgv.argv) expect(a.argv).toContain(f);
        }
    });

    /** ⛓ …and the OTHER end of the same property: an arm whose published key
     *  differs from its bank key is a FACE, and its argv is the face's own —
     *  a substitution, never an append. */
    it('⛔ …and every arm that is NOT standing-keyed is a declared face', () => {
        const arms = ciGateArms({ repo: REPO, set: 'all', host: LOCAL_HOST });
        const faced = arms.filter((a) => a.key !== a.bankKey);
        expect(faced.length).toBeGreaterThan(0);
        for (const a of faced) {
            expect(a.gate.ciFace).not.toBe(null);
            expect(a.key.startsWith(`${a.gate.ciFace.prefix}:`)).toBe(true);
            expect(a.argv).toEqual(a.gate.ciFace.argv);
        }
    });
});

describe('planCiShards — the partition', () => {
    it('is a COVER: every arm lands in exactly one shard', () => {
        const arms = ciGateArms({ repo: REPO, set: 'browser' });
        const shards = planCiShards({ arms, bank: null, budgetMs: 300000 });
        const placed = shards.flatMap((s) => s.keys);
        expect(placed.length).toBeGreaterThan(0);
        expect(placed.slice().sort()).toEqual(arms.map((a) => a.key).sort());
        expect(new Set(placed).size).toBe(placed.length);
    });

    /**
     * ⛔⛔ THE COVER IS LOAD-BEARING FOR SG1's DEMOS DEDUP, and this is where
     * that is asserted rather than hoped. `check-procgen-demos` skips a `cli`
     * row that invokes a roster gate on the licence that *"the battery runs it
     * as its own row"*; sharding splits the battery across JOBS, so the
     * licence now rests on every licensed sibling being somewhere in the plan.
     */
    it('holds every gate the demos catalogue dedups against', () => {
        const { arms } = ciGatePlanFor({ repo: REPO, set: 'browser' });
        const names = new Set(arms.map((a) => a.gate.file));
        for (const f of ['check-seedling-editor-generate.mjs', 'check-seedling-editor-sequence.mjs',
            'check-seedling-editor-arm.mjs', 'check-maze-lab.mjs']) {
            expect({ f, held: names.has(f) }).toEqual({ f, held: true });
        }
    });

    it('gives an arm at or above the budget a shard of its own', () => {
        const arms = [arm('a'), arm('big'), arm('b')];
        const bank = bankOf({ a: 10, big: 999, b: 10 });
        const shards = planCiShards({ arms, bank, budgetMs: 100 });
        const alone = shards.find((s) => s.keys.includes('big'));
        expect(alone.keys).toEqual(['big']);
    });

    /**
     * ⛔ THE UNPRICED ROW IS THE ONE A "0 ms" DEFAULT WOULD HAVE HIDDEN. A gate
     * added today has nothing banked; pricing that at zero packs it into a
     * shard for free and the shard silently becomes the slow one.
     */
    it('prices a row with NO banked ms at the whole budget, so it lands alone', () => {
        const arms = [arm('a'), arm('brand-new'), arm('b')];
        const bank = bankOf({ a: 10, b: 10 });
        const shards = planCiShards({ arms, bank, budgetMs: 100 });
        const alone = shards.find((s) => s.keys.includes('brand-new'));
        expect(alone.keys).toEqual(['brand-new']);
        expect(alone.unpriced).toBe(1);
        /** ⛓ …and the control: the priced pair still share one shard. */
        expect(shards.filter((s) => !s.keys.includes('brand-new'))
            .flatMap((s) => s.keys).sort()).toEqual(['a', 'b']);
    });

    it('an empty bank makes every arm its own shard, and never drops one', () => {
        const arms = [arm('a'), arm('b'), arm('c')];
        const shards = planCiShards({ arms, bank: null, budgetMs: 100 });
        expect(shards.length).toBe(3);
        expect(shards.flatMap((s) => s.keys).sort()).toEqual(['a', 'b', 'c']);
    });

    it('no shard exceeds the budget unless a single arm does', () => {
        const arms = [arm('a'), arm('b'), arm('c'), arm('d')];
        const bank = bankOf({ a: 60, b: 50, c: 40, d: 30 });
        const shards = planCiShards({ arms, bank, budgetMs: 100 });
        for (const s of shards) expect(s.ms).toBeLessThanOrEqual(100);
    });

    /**
     * ⛔⛔ THE PLAN IS COMPUTED TWICE BY TWO PROCESSES — the job that publishes
     * the matrix and the job that takes shard *i* out of it — and they must
     * agree without talking. A tie broken by iteration order would put a
     * different arm in shard 1 on the two sides.
     */
    it('is deterministic, ties broken by name', () => {
        const arms = [arm('z'), arm('y'), arm('x')];
        const bank = bankOf({ x: 50, y: 50, z: 50 });
        const a = planCiShards({ arms, bank, budgetMs: 100 });
        const b = planCiShards({ arms: arms.slice().reverse(), bank, budgetMs: 100 });
        expect(a.map((s) => s.keys)).toEqual(b.map((s) => s.keys));
        expect(a[0].keys).toEqual(['x', 'y']);
    });

    it('names a shard for its heaviest member', () => {
        const arms = [arm('a'), arm('b')];
        const shards = planCiShards({ arms, bank: bankOf({ a: 10, b: 80 }), budgetMs: 100 });
        expect(shards[0].name).toBe('b +1');
    });
});

describe('ciGatePlanFor — the live tree', () => {
    /**
     * ⛓ THE ONE ROW THAT ASSERTS A SHAPE OF TODAY'S ANSWER rather than a rule.
     * ⛔ It deliberately does NOT pin the shard COUNT or the arm count: those
     * move whenever a gate is added or the bank is re-measured, and a number
     * typed here is the wrong-and-green this arc has already produced three
     * times. What it pins is the PROPERTY the workflow depends on.
     */
    it('partitions the live browser set into shards that cover it', () => {
        const { arms, shards, budgetMs } = ciGatePlanFor({ repo: REPO, set: 'browser' });
        expect(arms.length).toBeGreaterThan(15);
        expect(shards.length).toBeGreaterThan(0);
        expect(shards.flatMap((s) => s.keys).sort()).toEqual(arms.map((a) => a.key).sort());
        expect(budgetMs).toBe(CI_SHARD_BUDGET_MS);
        /** ⛓ a multi-arm shard is inside the budget; a lone heavy arm may not be. */
        for (const s of shards) {
            if (s.keys.length > 1) expect(s.ms).toBeLessThanOrEqual(budgetMs);
        }
    });

    it('armName carries the declared arm\'s label', () => {
        expect(armName({ gate: { file: 'check-a-b.mjs' }, label: null })).toBe('a-b');
        expect(armName({ gate: { file: 'check-a-b.mjs' }, label: 'own server' }))
            .toBe('a-b (own server)');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ `ciSourced` — WHICH ROWS THE BANK QUOTES FROM CI (⚖ 72, S4)
 *
 * ⛓ MOVED HERE FROM `boxLock.test.js` / `standingValues.test.js` WITH THE
 * FUNCTION, and widened with it. The two old homes each asserted a piece of
 * the rule with a hand-spread argument list, and one of them had already gone
 * stale that way once (its own note records asserting a question production
 * had stopped asking). The rule now takes the ROSTER ROW, so every row here
 * hands it the same shape production does.
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ A roster row with only the fields the rule reads. */
const g = (o = {}) => ({
    file: 'check-x.mjs', browser: false, windows: false, ciFace: null, ciShallow: null, ...o,
});

describe('ciSourced — the four clauses, each on its own', () => {
    it('selects a CI-runnable row only once it stops being cheap', () => {
        expect(ciSourced({ gate: g(), cheap: false })).toBe(true);
        expect(ciSourced({ gate: g(), cheap: true })).toBe(false);
    });

    /**
     * ⛓⛓ THE WIDENING S4 IS: a BROWSER row is CI-sourced now. Before S3 CI ran
     * no browser at all and this arm read `false`; the arms exist and are
     * measured, so quoting them is the economy ⚖ 54 (6) asked for.
     */
    it('⛓ a BROWSER row is CI-sourced — S3 gave those arms answers', () => {
        expect(ciSourced({ gate: g({ browser: true }), cheap: false })).toBe(true);
    });

    /** ⛓ A row nothing has measured has no `cheap` yet: the first measurement
     *  is the box's, and it is what decides. */
    it('does not select a row nothing has measured', () => {
        expect(ciSourced({ gate: g(), cheap: undefined })).toBe(false);
    });

    it('⛔ never selects a Windows row, at any cost (⚖ 72 (a))', () => {
        expect(ciSourced({ gate: g({ windows: true }), cheap: false })).toBe(false);
        expect(ciSourced({ gate: g({ windows: true }), cheap: true })).toBe(false);
    });

    it('⛔ never selects a declared @ci-face (P4b (D))', () => {
        expect(ciSourced({ gate: g({ ciFace: { prefix: 'gate-help-ci' } }), cheap: false }))
            .toBe(false);
    });

    it('⛔ never selects a declared @ci-shallow (S4, trap 1058)', () => {
        expect(ciSourced({ gate: g({ ciShallow: { reason: 'depth-1' } }), cheap: false }))
            .toBe(false);
    });

    /** ⛔ An identity/producer/suite row has no gate: CI prints `## CI-GATE |`
     *  lines under GATE keys only, so there is nothing to quote. S4c is where
     *  the identity rows' production side is built, if ever. */
    it('⛔ a row with no gate is never CI-sourced', () => {
        expect(ciSourced({ gate: null, cheap: false })).toBe(false);
    });
});

/**
 * ⛓⛓⛓ THE LIVE ROSTER AND THE COMMITTED BANK — the rows whose whole content
 * is *"and this agrees with the tree"*, each guarded against vacuity first.
 */
describe('ciSourced over the live tree', () => {
    const roster = gateRoster({ repo: REPO });
    const bank = readStandingValues({ repo: REPO });
    const gateOf = (command) => roster.find((r) => command.includes(r.path)) ?? null;
    const rows = standingRows({ repo: REPO });
    const selected = rows.filter((r) => ciSourced({
        gate: r.kind === 'gate' ? gateOf(r.command) : null, cheap: bank?.rows?.[r.key]?.cheap,
    }));

    /**
     * ⛔⛔ **THE GUARD THE BRIEF ASKED FOR, AND IT IS ASSERTED AT `cheap:
     * false` ON PURPOSE.** Both declaring gates are UNDER the 60 s band today,
     * so a rule that only excluded them by `¬cheap` would pass every row that
     * used their real `cheap` value — and would go silently wrong the day
     * `slice-records` (30.8 s and growing with every recorded slice) crossed
     * it. This row hands the rule the value that would have selected them.
     */
    it('⛔ a declared @ci-shallow gate is excluded EVEN AT `cheap: false`', () => {
        const declaring = roster.filter((r) => r.ciShallow);
        expect(declaring.length).toBeGreaterThan(0);
        for (const gate of declaring) expect(ciSourced({ gate, cheap: false })).toBe(false);
    });

    /**
     * ⛓⛓⛓ S5 — **THE ROW THE WHOLE SLICE IS ABOUT.** P4b (D) measured this
     * gate frozen: CI-runnable, `cheap: false`, selected by the rule and then
     * REFUSED BY NAME by the reader, so the CI path could never answer it and
     * the local path was never chosen again. It is CI-sourced now because its
     * face is retired and CI answers the FULL claim under the standing key —
     * ⛔ and NOT because any clause was loosened, which the row below (the
     * remaining faced gate, still excluded) is the control for.
     */
    it('⛓ a gate that declares @ci-argv IS CI-sourced — the same claim, same key', () => {
        const declaring = gateRoster({ repo: REPO }).filter((g) => g.ciArgv);
        expect(declaring.length).toBeGreaterThan(0);
        for (const g of declaring) expect(ciSourced({ gate: g, cheap: false })).toBe(true);
    });

    it('⛔ …and so is a declared @ci-face, at the same value', () => {
        const faced = roster.filter((r) => r.ciFace);
        expect(faced.length).toBeGreaterThan(0);
        for (const gate of faced) expect(ciSourced({ gate, cheap: false })).toBe(false);
    });

    /**
     * ⛓⛓ **A STATED NON-ZERO.** Until S4 this file's ancestor asserted the
     * rule selected ZERO rows, which was the honest reading then. S4's whole
     * point is that the number is no longer zero — so the row asserts the
     * direction, never the count (a count typed here is the wrong-and-green
     * this arc has produced four times).
     */
    it('selects a NON-EMPTY set at this head, out of a non-empty roster', () => {
        expect(rows.length).toBeGreaterThan(20);
        expect(selected.length).toBeGreaterThan(0);
    });

    /**
     * ⛔⛔⛔ **THE COMPOSITION PROPERTY, AND IT IS THE ONE THAT CANNOT BE TRUE
     * BY CONSTRUCTION.** A selected row's `command` becomes `ci-summary
     * --gate=<its key>`, which can only be answered if CI PRINTS A LINE UNDER
     * THAT EXACT KEY. `ciGateArms` is what the workflow runs, and an arm whose
     * gate declares a `@ci-face` publishes under a DIFFERENT key — so a rule
     * that selected such a row would freeze it at its last local value with a
     * polite reason, forever, which is precisely P4b (D)'s defect. Asserting
     * the two sets compose is the only thing that catches a fifth clause
     * arriving on one side and not the other.
     */
    it('⛔ every selected row has an arm publishing a line under the SAME key', () => {
        const published = new Set(ciGateArms({ repo: REPO, set: 'all' })
            .filter((a) => !a.gate.ciFace).map((a) => a.key));
        expect(published.size).toBeGreaterThan(0);
        expect(selected.length).toBeGreaterThan(0);
        for (const row of selected) expect(published.has(row.key)).toBe(true);
    });

    /** ⛓ …and no selected row is one the bank has never measured, because the
     *  `cheap` clause is a MEASURED field and an unmeasured row has none. */
    it('every selected row is banked, not cheap, and CI-runnable', () => {
        for (const row of selected) {
            expect(bank.rows[row.key]?.cheap).toBe(false);
            const gate = gateOf(row.command);
            expect(ciRunnable(gate)).toBe(true);
            expect(gate.ciFace).toBe(null);
            expect(gate.ciShallow).toBe(null);
        }
    });
});

/**
 * ⛓⛓⛓ THE OTHER CONSUMER OF `ciRunnable` — `ci-summary.mjs`'s REFUSAL LADDER.
 *
 * ⛔⛔ EVERY ROW HERE IS OFF-NETWORK BY CONSTRUCTION, and that is asserted
 * rather than hoped: the refusals all fire BEFORE the first `gh` call, and the
 * one row that must get PAST them runs with a `PATH` that holds no `gh` at
 * all — so a row that stopped refusing would fail at the network instead of
 * quietly querying GitHub from a unit test. ⛓ Every key is DERIVED from the
 * live roster; a typed gate name here would be the hand list this arc keeps
 * finding wrong-and-green.
 */
describe('ci-summary.mjs — the refusal ladder, derived from the same predicate', () => {
    const CI_SUMMARY = join(HERE, 'ci-summary.mjs');
    const roster = gateRoster({ repo: REPO });
    const nameOf = (g) => g.file.replace(/^check-/, '').replace(/\.mjs$/, '');
    const runCi = (args) => {
        try {
            const out = execFileSync(process.execPath, [CI_SUMMARY, ...args], {
                cwd: REPO,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 60000,
                env: { ...process.env, PATH: '/nonexistent' },
            });
            return { code: 0, out };
        } catch (e) {
            return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
        }
    };

    it('REFUSES a Windows row by name, exit 5, without a network call', () => {
        const win = roster.find((g) => g.windows);
        expect(win).toBeTruthy();
        const r = runCi(['deadbeef1', `--gate=gate: ${nameOf(win)}`]);
        expect(r.code).toBe(5);
        expect(r.out).toMatch(/REFUSED/);
        expect(r.out).toMatch(/Windows/);
    });

    it('REFUSES a gate that is not on the roster at all, exit 5', () => {
        const r = runCi(['deadbeef1', '--gate=gate: no-such-gate-anywhere']);
        expect(r.code).toBe(5);
        expect(r.out).toMatch(/no gate named/);
    });

    it('REFUSES a @ci-face gate asked under its `gate:` key, exit 5', () => {
        const faced = roster.find((g) => g.ciFace);
        expect(faced).toBeTruthy();
        const r = runCi(['deadbeef1', `--gate=gate: ${nameOf(faced)}`]);
        expect(r.code).toBe(5);
        expect(r.out).toMatch(/@ci-face/);
    });

    /**
     * ⛔⛔⛔ **THE ROW S4 OWES ITS OWN DEFECT TO — THE READER SIDE OF THE
     * COMPOSITION PROPERTY.** `ciGatePlan.test.js` already asserts that every
     * CI-sourced row has an ARM PUBLISHING a line under its key. That is only
     * half of it: the row's `command` is `ci-summary --gate=<key>`, so the
     * READER must also be able to ask for that key. It could not — the ladder
     * derived a gate FILE from the key, and `gate: seedling-editor-generate
     * (own server)` names no file, so S4's first `--write` KEPT that row with
     * *"no gate named …"*. A row frozen by its own reader, which is P4b (D)
     * one costume over. ⛓ Every key here is DERIVED from the rule.
     */
    it('⛔ does NOT refuse any key `ciSourced` selects — arm labels included', () => {
        const bank = readStandingValues({ repo: REPO });
        const gateOf = (command) => roster.find((x) => command.includes(x.path)) ?? null;
        const selected = standingRows({ repo: REPO }).filter((r) => ciSourced({
            gate: r.kind === 'gate' ? gateOf(r.command) : null, cheap: bank?.rows?.[r.key]?.cheap,
        }));
        expect(selected.length).toBeGreaterThan(0);
        /** ⛓ …and the population really does hold a labelled arm, or this row
         *  would pass without ever testing the case it was written for. */
        expect(selected.some((r) => /\(.+\)$/.test(r.key))).toBe(true);
        for (const row of selected) {
            const r = runCi(['deadbeef1', `--gate=${row.key}`]);
            expect(`${row.key}: ${r.out}`).not.toMatch(/REFUSED/);
            expect(r.code).not.toBe(5);
        }
    });

    /**
     * ⛔⛔ S4's OWN RUNG — THE SECOND LOCK. `ciSourced` never routes a
     * `@ci-shallow` row down this path; if a later widening forgot the clause,
     * THIS is what turns a silently-banked depth-1 answer into a red naming
     * the gate. ⛓ It is the same shape as the `@ci-face` rung above and it is
     * asserted the same way, off the live roster.
     */
    it('REFUSES a @ci-shallow gate by name, exit 5, before any network call', () => {
        const shallow = roster.find((x) => x.ciShallow);
        expect(shallow).toBeTruthy();
        const r = runCi(['deadbeef1', `--gate=gate: ${nameOf(shallow)}`]);
        expect(r.code).toBe(5);
        expect(r.out).toMatch(/@ci-shallow/);
        expect(r.out).toContain(shallow.ciShallow.reason);
    });

    /**
     * ⛔⛔ THE ROW S3 EXISTS FOR. Before this slice a browser key was refused
     * BY NAME — *"needs a browser and CI runs neither, so no answer for it
     * exists at any SHA"* — and that sentence is now false. A refusal that
     * outlives the thing it refused is the quietest way to make a working
     * production side look broken.
     */
    it('does NOT refuse a browser key any more — it goes on to ask CI', () => {
        const browser = roster.find((g) => g.browser && !g.windows);
        expect(browser).toBeTruthy();
        const r = runCi(['deadbeef1', `--gate=gate: ${nameOf(browser)}`]);
        expect(r.out).not.toMatch(/REFUSED/);
        expect(r.code).not.toBe(5);
        /** ⛓ …and it died at the NETWORK, which is what "got past the ladder"
         *  looks like when there is no `gh` on the PATH. */
        expect(r.out).toMatch(/ENOENT|spawnSync|gh/);
    });
});

/**
 * ⛓⛓⛓ S5b — **THE AUDIT, WHICH READS NOTHING THIS MODULE PRICED.**
 *
 * ⛔ Its inputs are the runner's own `here=` seconds and each job's own shard
 * note. That is the whole reason it can see what every priced assertion in
 * this file could not: the 24-arm shard whose PRICED total was 423.8 s ran
 * 1,388.8 s, and only the second number is in here.
 */
describe('auditRunShards — did the partition hold, by the runner\'s own clock?', () => {
    const job = (name, shard, arms) => ({ name, shard,
        arms: Object.entries(arms).map(([key, ms]) => ({ key, ms })) });

    /** ⛓ The regression itself: run 33563524638's one browser job, rounded. */
    it('REDS a multi-arm shard over budget — the collapsed partition', () => {
        const a = auditRunShards({
            jobs: [job('shard', { id: 0, of: 1 },
                { element: 901200, pages: 160500, arm: 43800, rest: 283300 })],
            budgetMs: 600000,
        });
        expect(a.ok).toBe(false);
        expect(a.over.map((r) => r.ms)).toEqual([1388800]);
    });

    /**
     * ⛔ THE CONTROL WITHOUT WHICH THE ROW ABOVE IS VACUOUS. A guard that reds
     * on every run is not a guard, and the shape it must NOT red on is the
     * module's own rule working: `seedling-wasm-element` is 901 s and there is
     * nowhere smaller to put it.
     */
    it('allows a ONE-ARM shard over budget — that is `planCiShards`\' own rule', () => {
        const a = auditRunShards({
            jobs: [job('element', { id: 0, of: 2 }, { element: 901200 }),
                job('rest', { id: 1, of: 2 }, { pages: 160500, arm: 43800 })],
            budgetMs: 600000,
        });
        expect(a.ok).toBe(true);
        expect(a.rows.map((r) => r.over)).toEqual([false, false]);
    });

    /** ⛔ An unsharded job was never partitioned under a budget; holding it to
     *  one is an exclusion by a number nobody chose for it. */
    it('reports an unsharded job and never judges it', () => {
        const a = auditRunShards({
            jobs: [job('headless', null, { help: 700000 })], budgetMs: 600000,
        });
        expect(a.ok).toBe(true);
        expect(a.rows[0].sharded).toBe(false);
    });

    /** ⛓ …and the OTHER direction, reported and not red — the pre-S4 box-proxy
     *  over-split, which run 33548827760 shows at 466.7 s across two shards. */
    it('names over-splitting as `loose`, without failing on it', () => {
        const a = auditRunShards({
            jobs: [job('a', { id: 0, of: 3 }, { p: 158000, q: 137000 }),
                job('b', { id: 1, of: 3 }, { r: 44400, s: 127300 }),
                job('c', { id: 2, of: 3 }, { element: 896500 })],
            budgetMs: 600000,
        });
        expect(a.ok).toBe(true);
        expect(a.loose.ms).toBe(466700);
    });
});
