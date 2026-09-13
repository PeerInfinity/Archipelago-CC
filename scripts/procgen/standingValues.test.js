/**
 * standingValues — **THE DERIVED ROW LIST, PINNED** (editor v3 · Q6).
 *
 * ⛓ This file did not exist until Q6. It pins the row Q6 adds — the second
 * arm of `check-seedling-editor-generate.mjs`, whose KEY the orchestrator
 * types verbatim into `standing-values.mjs --write --key=…` — and the ONE
 * invariant the module's own docblock already promises and nothing checked:
 * **every row is DERIVED, none is typed**, so the `gate:` rows are exactly the
 * roster's gates and their declared arms, under keys that are unique.
 *
 * ⛔ A KEY IS AN INTERFACE. `--check` diffs the file's keys against the
 * derivation's; a key that moves is a row nothing has measured plus a row an
 * instrument was retired from. So the two spellings below are asserted
 * CHARACTER FOR CHARACTER rather than by shape.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CI_SHARD_BUDGET_MS, readCiArmCosts } from './ciGatePlan.js';
import { gateRoster } from './gateRoster.js';
import {
    RETIRED_ROSTER_ROW_KEYS, ROSTER_ROW_KEY, gateChannel, gateStandingRows, newRowAdmission,
    newRowClass, readStandingValues, retiredKeyProblem, runRow, standingRows, writerRoster,
} from './standingValues.js';

const ROWS = standingRows();
const GATE_ROWS = ROWS.filter((r) => r.kind === 'gate');

/** ⛓ ⚖ §26.7a's two arms, spelled the way a seal will quote them. */
const BASE_KEY = 'gate: seedling-editor-generate';
const VARIANT_KEY = 'gate: seedling-editor-generate (own server)';
const GATE_PATH = 'scripts/procgen/check-seedling-editor-generate.mjs';

describe('⛓⛓ the second arm is a row of its own', () => {
    it('the variant row carries the no-host command, under the key a seal quotes', () => {
        const row = ROWS.find((r) => r.key === VARIANT_KEY);
        expect(row).toBeDefined();
        expect(row.command).toBe(`node ${GATE_PATH}`);
        expect(row.kind).toBe('gate');
    });

    /**
     * ⛔ THE BASE ROW IS THE ROW THAT ALREADY HAS A MEASURED VALUE ON DISK
     * (224/0). If its key or its command moved, `standing-values.json` would
     * lose that number to a rename and `--check` would report a retirement
     * that never happened.
     */
    it('…and the base row is untouched — same key, same command', () => {
        const row = ROWS.find((r) => r.key === BASE_KEY);
        expect(row.command).toBe(`node ${GATE_PATH} --host=http://localhost:8000`);
    });

    it('⛔ the arm follows its gate; it is not appended after the roster', () => {
        const base = ROWS.findIndex((r) => r.key === BASE_KEY);
        const variant = ROWS.findIndex((r) => r.key === VARIANT_KEY);
        expect(variant).toBe(base + 1);
    });
});

describe('⛓ every row is derived — the gate rows ARE the roster and its arms', () => {
    it('each gate contributes its base row and one row per declared arm', () => {
        /** ⛓ F1 task 0 — a gate declaring `@standing-row` contributes none. */
        const expected = gateRoster().filter((g) => !g.standingRow).flatMap((g) => {
            const name = g.file.replace(/^check-/, '').replace(/\.mjs$/, '');
            return [`gate: ${name}`, ...g.variants.map((v) => `gate: ${name} (${v.label})`)];
        });
        expect(GATE_ROWS.map((r) => r.key)).toEqual(expected);
    });

    it('and no two rows share a key — a key is what --check diffs on', () => {
        const dupes = ROWS.map((r) => r.key)
            .filter((k, i, all) => all.indexOf(k) !== i);
        expect(dupes).toEqual([]);
    });
});

describe('⛔ an arm whose command EQUALS the base row is REFUSED BY NAME', () => {
    /** ⛓ A gate that reads no `host` flag: its `local` argv is empty, so an
     *  arm declaring `(none)` asks for the very same command twice. */
    const flagless = {
        file: 'check-scratch.mjs',
        path: 'scripts/procgen/check-scratch.mjs',
        flags: [],
        browser: false,
        windows: false,
        variants: [{ label: 'own server', argv: [] }],
    };

    it('the refusal names the gate, the label and the command it collided on', () => {
        expect(() => gateStandingRows(flagless, []))
            .toThrow(/check-scratch\.mjs.*"own server".*BASE ROW'S/s);
    });

    /**
     * ⛔ NOT DEDUPED — REFUSED. `standingRows`' `seen` set drops a repeated
     * command in silence, and silence here would ship a declaration that
     * produces no row at all.
     */
    it('a genuinely different command is not refused', () => {
        const rows = gateStandingRows({ ...flagless, flags: ['host'] },
            ['--host=http://localhost:8000']);
        expect(rows.map((r) => r.command)).toEqual([
            'node scripts/procgen/check-scratch.mjs --host=http://localhost:8000',
            'node scripts/procgen/check-scratch.mjs',
        ]);
    });
});

/**
 * ⛓⛓⛓ R9 P4b (D) — **⚖ 54 (6) AND P3b (g) DO NOT COMPOSE, AND THE ROW THAT
 * PROVED IT IS ON DISK.**
 *
 * ⛓ S4 (⚖ 72) MOVED the rule and these rows to `ciGatePlan.test.js`, where
 * `ciSourced` now lives with `ciRunnable` and the two DECLARED refusals it
 * reads (`@ci-face`, `@ci-shallow`). ⛔ The reason the move is safe to record
 * as a pointer rather than a duplicate: the rows went WITH the function and
 * were widened with it — a `@ci-face` gate is still asserted NOT CI-sourced
 * at `cheap: false`, over the live roster, with the non-vacuity assertion in
 * front of it.
 */

/**
 * ⛓⛓ H2 — **THE ROSTER ROW'S KEY LOST ITS `--win`, AND THE OLD ONE IS REFUSED.**
 * A stale `--key=` pasted from an old record must fail by name rather than
 * create a second composite row beside the real one.
 */
describe('H2 — the renamed roster row key', () => {
    it('the bank carries the new key and no retired one', () => {
        const rows = readStandingValues()?.rows ?? {};
        expect(rows[ROSTER_ROW_KEY]).toBeTruthy();
        expect(RETIRED_ROSTER_ROW_KEYS.length).toBeGreaterThan(0);
        expect(RETIRED_ROSTER_ROW_KEYS.filter((k) => k in rows)).toEqual([]);
    });
    it('a retired key is refused by name, pointing at the live one; the live key is not', () => {
        for (const k of RETIRED_ROSTER_ROW_KEYS) {
            expect(retiredKeyProblem(k)).toMatch(/RETIRED/);
            expect(retiredKeyProblem(k)).toContain(ROSTER_ROW_KEY);
        }
        expect(retiredKeyProblem(ROSTER_ROW_KEY)).toBeNull();
    });
});

/**
 * ⛓⛓ H2 — **`channel` ON A PLAIN GATE ROW REPLACES `windows: true`.** A dual
 * gate's bare command is its headless channel; a Windows-only gate's is `win`;
 * a gate with no Windows arm carries none.
 */
describe('H2 — the channel on gate rows', () => {
    it('derived gate rows carry the channel their bare command drives, never `windows`', () => {
        const roster = gateRoster();
        expect(GATE_ROWS.filter((r) => 'windows' in r)).toEqual([]);
        /** ⛓ F1 task 0 — minus a gate that declares its row is another one. */
        const dual = roster.filter((g) => g.dual && !g.standingRow);
        expect(dual.length).toBeGreaterThan(0);
        for (const g of dual) {
            const name = g.file.replace(/^check-/, '').replace(/\.mjs$/, '');
            expect(ROWS.find((r) => r.key === `gate: ${name}`)?.channel).toBe('headless');
        }
        expect(gateChannel({ windows: true })).toBe('win');
        expect(gateChannel({ windows: false, dual: false })).toBeNull();
    });
});

/**
 * ⛓⛓⛓ F1 task 0 / 0b (planner rulings, 2026-09-13) — **THE WRITER NEVER
 * CREATES AN UNBOUNDED NEW ROW.** An unselected `standing-values --write`
 * started the Seedling full tier on the box (the differential's derived
 * `gate:` row) and ran nine more NEW gate rows red. The roster rows read the
 * REAL roster, bank and costs file with a FAKE runner; the deadline rows spawn
 * real fixture processes in a temp repo.
 */
describe('F1 task 0 / 0b — the writer never creates an unbounded NEW row', () => {
    const roster = gateRoster();
    const bank = readStandingValues()?.rows ?? {};
    const costs = readCiArmCosts();
    /** ⛓ What `--write` would spawn, and how, recorded instead of run. */
    const spawned = (rows, opts = {}) => {
        const calls = [];
        const plan = writerRoster({ rows, bank, gates: roster, costs, ...opts });
        const fakeRun = (row) => calls.push(plan.probed.has(row.key) ? `probe ${row.key}` : row.key);
        for (const row of plan.runnable) fakeRun(row);
        return calls;
    };

    it('the differential derives NO gate: row — its standing row is the composite', () => {
        expect(ROWS.map((r) => r.key)).not.toContain('gate: seedling-bot-differential');
        const g = roster.find((x) => x.file === 'check-seedling-bot-differential.mjs');
        expect(g.standingRow.key).toBe(ROSTER_ROW_KEY);
        /** ⛓ …and its bounded CI face still names itself (the arm is not a row). */
        expect(g.ciFace?.prefix).toBe('smoke');
    });

    it('every @standing-row names a row the bank carries', () => {
        const declared = roster.filter((x) => x.standingRow);
        expect(declared.length).toBeGreaterThan(0);
        for (const x of declared) expect(Object.keys(bank)).toContain(x.standingRow.key);
    });

    /**
     * ⛔ THE NINE the sidecars write ran red, each with its MEASURED result.
     * All nine are unpriced `@ci-box` gates, so 0b PROBES them (a deadline
     * run) — and the admission refuses every one of those results by name.
     */
    it.each([
        ['gate: jta-balance-pass', { exit: 2, ms: 100, value: '0/0', total: null }, /exited 2/],
        ['gate: maze-consumable-tiles', { exit: 1, ms: 600, value: '0/0', total: null }, /exited 1/],
        ['gate: maze-loop-mana', { exit: 1, ms: 600, value: '0/0', total: null }, /exited 1/],
        ['gate: atlas-sphere-roundtrip', { exit: 1, ms: 29000, value: '60/0', total: null }, /green by PASS tally only \(PASS tally 60\/0\), NO total/],
        ['gate: jta-locations-roundtrip', { exit: 1, ms: 20000, value: '17/0', total: null }, /green by PASS tally only/],
        ['gate: region-library-roundtrip', { exit: 1, ms: 9000, value: '8/0', total: null }, /green by PASS tally only \(PASS tally 8\/0\)/],
        ['gate: region-library-sphere-roundtrip', { exit: 1, ms: 20000, value: '11/0', total: null }, /green by PASS tally only/],
        ['gate: region-library-sphere-roundtrip-maze', { exit: 1, ms: 20000, value: '9/0', total: null }, /green by PASS tally only/],
        ['gate: region-library-sphere-roundtrip-runner', { exit: 1, ms: 20000, value: '10/0', total: null }, /green by PASS tally only/],
    ])('%s is probed under the deadline, and its measured run is REFUSED', (key, measured, why) => {
        const row = ROWS.find((r) => r.key === key);
        expect(row).toBeDefined();
        expect(bank[key]).toBeUndefined();
        expect(spawned([row])).toEqual([`probe ${key}`]);
        expect(newRowAdmission({ ...measured, killed: false }, { deadlineMs: CI_SHARD_BUDGET_MS }))
            .toMatch(why);
    });

    it('⛔ an unpriced NEW gate that is NOT @ci-box is refused before running; --key= runs it', () => {
        const gate = { file: 'check-scratch-tier.mjs', path: 'scripts/procgen/check-scratch-tier.mjs' };
        const row = { key: 'gate: scratch-tier', kind: 'gate', command: `node ${gate.path}` };
        const opts = { gates: [gate] };
        expect(writerRoster({ rows: [row], bank: {}, costs, ...opts }).refused[0].why).toMatch(/^unpriced — /);
        expect(spawned([row], opts)).toEqual([]);
        expect(spawned([row], { ...opts, exactKeys: [row.key] })).toEqual([row.key]);
    });

    it('a PRICED NEW row, a banked row and a non-gate row run plainly; over budget is refused', () => {
        // ⛓ The "priced NEW" fixture is SYNTHETIC: a priced gate row with its
        // key deleted from a COPY of the bank. Reading it off the live bank
        // (`!bank[r.key]`) held only BETWEEN writes — after a full
        // `standing-values --write` every priced gate is banked and the row
        // went red on the sidecars planner's bank commit (2026-09-13). A
        // fixture that depends on the live data's phase is not a fixture.
        const priced = ROWS.find((r) => r.kind === 'gate' && costs.arms[r.key]);
        expect(priced).toBeDefined();
        const bankWithout = { ...bank };
        delete bankWithout[priced.key];
        const banked = ROWS.find((r) => r.kind === 'gate' && r.key !== priced.key && bankWithout[r.key]);
        expect(banked).toBeDefined();
        const identity = ROWS.find((r) => r.kind === 'identity');
        expect(spawned([priced, banked, identity], { bank: bankWithout }))
            .toEqual([priced.key, banked.key, identity.key]);
        const tight = { ...costs, budgetMs: costs.arms[priced.key].ms - 1 };
        expect(newRowClass({ row: priced, costs: tight })).toMatchObject({ class: 'refuse' });
        expect(newRowClass({ row: priced, costs: tight }).why).toMatch(/over the .* budget/);
    });

    /**
     * ⛓⛓ THE DEADLINE, ON REAL PROCESSES. Three fixture gates in a temp repo,
     * run through `runRow`'s deadline path — the path the writer takes for a
     * probed row — and judged by `newRowAdmission`.
     */
    describe('the kill deadline and the admission, on fixture processes', () => {
        let root;
        const write = (name, body) => {
            mkdirSync(join(root, 'scripts/procgen'), { recursive: true });
            writeFileSync(join(root, 'scripts/procgen', name), body);
            return { key: `gate: ${name}`, kind: 'gate', command: `node scripts/procgen/${name}` };
        };
        const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
        beforeAll(() => { root = mkdtempSync(join(tmpdir(), 'f1-0b-')); });
        afterAll(() => { rmSync(root, { recursive: true, force: true }); });

        it('⛔ a gate that sleeps past the deadline is KILLED — its group, by the captured pid — and refused', async () => {
            const row = write('check-sleeper.mjs',
                "import { spawn } from 'node:child_process';\n"
                + "const c = spawn('sleep', ['30'], { stdio: 'ignore' });\n"
                + "console.log(`GRANDCHILD ${c.pid}`);\nsetTimeout(() => {}, 30000);\n");
            const r = await runRow(row, { repo: root, deadlineMs: 1500 });
            expect(r.killed).toBe(true);
            expect(r.ms).toBeLessThan(10000);
            const grandchild = Number(/GRANDCHILD (\d+)/.exec(r.out)?.[1]);
            await new Promise((ok) => { setTimeout(ok, 200); });
            expect(alive(r.pid)).toBe(false);
            expect(grandchild).toBeGreaterThan(0);
            expect(alive(grandchild)).toBe(false);
            expect(newRowAdmission(r, { deadlineMs: 1500 })).toMatch(new RegExp(`KILLED at the 1\\.5 s deadline .*pid ${r.pid}`));
        }, 20000);

        it('⛔ 8 PASS lines then exit 1 is refused as green by PASS tally only', async () => {
            const row = write('check-tally.mjs',
                "for (let i = 0; i < 8; i++) console.log(`PASS: row ${i}`);\nprocess.exit(1);\n");
            const r = await runRow(row, { repo: root, deadlineMs: 10000 });
            expect(r).toMatchObject({ killed: false, exit: 1, value: '8/0', total: null });
            expect(newRowAdmission(r, { deadlineMs: 10000 })).toMatch(/exited 1 .*green by PASS tally only \(PASS tally 8\/0\), NO total line/);
        }, 20000);

        it('⛔ exit 0 with PASS lines but NO total is refused', async () => {
            const row = write('check-nototal.mjs',
                "console.log('PASS: a');\nconsole.log('All assertions passed.');\n");
            const r = await runRow(row, { repo: root, deadlineMs: 10000 });
            expect(newRowAdmission(r, { deadlineMs: 10000 })).toMatch(/exited 0 .*NO total line/);
        }, 20000);

        it('a gate that exits 0 with a TOTAL line under the deadline is admitted', async () => {
            const row = write('check-green.mjs',
                "console.log('PASS: a');\nconsole.log('PASS: b');\nconsole.log('ALL CHECKS PASSED');\n");
            const r = await runRow(row, { repo: root, deadlineMs: 10000 });
            expect(r).toMatchObject({ killed: false, exit: 0, value: '2/0', total: 'ALL CHECKS PASSED' });
            expect(newRowAdmission(r, { deadlineMs: 10000 })).toBeNull();
        }, 20000);
    });
});
