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

import { describe, expect, it } from 'vitest';

import { readCiArmCosts } from './ciGatePlan.js';
import { gateRoster } from './gateRoster.js';
import {
    RETIRED_ROSTER_ROW_KEYS, ROSTER_ROW_KEY, gateChannel, gateStandingRows, newRowRefusal,
    readStandingValues, retiredKeyProblem, standingRows, writerRoster,
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
 * ⛓⛓⛓ F1 task 0 (planner ruling, 2026-09-13) — **THE WRITER CREATES A NEW ROW
 * ONLY FOR A PRICED ARM.** An unselected `standing-values --write` started the
 * Seedling full tier on the box (the differential's derived `gate:` row) and
 * ran nine more NEW gate rows red. Every row below reads the REAL roster, bank
 * and costs file, and a FAKE runner stands in for the spawn.
 */
describe('F1 task 0 — the writer never creates an unbounded NEW row', () => {
    const roster = gateRoster();
    const bank = readStandingValues()?.rows ?? {};
    const costs = readCiArmCosts();
    /** ⛓ What `--write` would spawn, recorded instead of run. */
    const spawned = (rows, opts = {}) => {
        const calls = [];
        const fakeRun = (row) => calls.push(row.key);
        for (const row of writerRoster({ rows, bank, gates: roster, costs, ...opts }).runnable) {
            fakeRun(row);
        }
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
     * ⛔ THE NINE the sidecars write ran red, each with its measured shape.
     * None is priced, so none is spawned; each refusal names the gate's own
     * declared reason.
     */
    it.each([
        ['gate: jta-balance-pass', 'EXIT 2 in 0.1 s — takes a positional <exported rules.json>'],
        ['gate: maze-consumable-tiles', 'EXIT 1 — its fixture is an UNTRACKED preset dir'],
        ['gate: maze-loop-mana', 'EXIT 1 — its fixture is an UNTRACKED preset dir'],
        ['gate: atlas-sphere-roundtrip', 'EXIT 1 after PASS lines, no total — no .venv'],
        ['gate: jta-locations-roundtrip', 'EXIT 1 after PASS lines, no total — no .venv'],
        ['gate: region-library-roundtrip', 'EXIT 1 after 8 PASS, no total — no .venv (reproduced)'],
        ['gate: region-library-sphere-roundtrip', 'EXIT 1 after PASS lines, no total — no .venv'],
        ['gate: region-library-sphere-roundtrip-maze', 'EXIT 1 after PASS lines, no total — no .venv'],
        ['gate: region-library-sphere-roundtrip-runner', 'EXIT 1 after PASS lines, no total — no .venv'],
    ])('%s is REFUSED, never spawned (%s)', (key) => {
        const row = ROWS.find((r) => r.key === key);
        expect(row).toBeDefined();
        expect(bank[key]).toBeUndefined();
        expect(spawned([row])).toEqual([]);
        const { refused } = writerRoster({ rows: [row], bank, gates: roster, costs });
        expect(refused[0].why).toMatch(/^unpriced — /);
        expect(refused[0].why).toContain('@ci-box:');
    });

    it('⛔ a fixture NEW unbounded gate is not spawned; named by --key= it is', () => {
        const gate = { file: 'check-scratch-tier.mjs', path: 'scripts/procgen/check-scratch-tier.mjs' };
        const row = { key: 'gate: scratch-tier', kind: 'gate', command: `node ${gate.path}` };
        const opts = { gates: [gate] };
        expect(writerRoster({ rows: [row], bank: {}, costs, ...opts }).runnable).toEqual([]);
        expect(spawned([row], opts)).toEqual([]);
        expect(spawned([row], { ...opts, exactKeys: [row.key] })).toEqual([row.key]);
    });

    it('a PRICED NEW row, a banked row and a non-gate row are spawned; over budget is not', () => {
        const priced = ROWS.find((r) => r.kind === 'gate' && !bank[r.key] && costs.arms[r.key]);
        expect(priced).toBeDefined();
        const banked = ROWS.find((r) => r.kind === 'gate' && bank[r.key]);
        const identity = ROWS.find((r) => r.kind === 'identity');
        expect(spawned([priced, banked, identity])).toEqual([priced.key, banked.key, identity.key]);
        const tight = { ...costs, budgetMs: costs.arms[priced.key].ms - 1 };
        expect(newRowRefusal({ row: priced, costs: tight })).toMatch(/over the .* budget/);
    });
});

