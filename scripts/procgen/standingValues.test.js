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

import { gateRoster } from './gateRoster.js';
import { ciSourced, gateStandingRows, standingRows } from './standingValues.js';

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
        const expected = gateRoster().flatMap((g) => {
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
 * `gate: procgen-help` is headless and `cheap: false` (573 s at `a61feaaec`),
 * so ⚖ 54 (6)'s rule selects it for the CI read — and `ci-summary` REFUSES it
 * by name, because the gate declares `@ci-face gate-help-ci` and CI publishes
 * that key instead. `--write` could then only ever KEEP, forever.
 */
describe('⛔ a gate that declares a @ci-face is NEVER CI-sourced', () => {
    /** ⛓ The declaring gates, read off the roster — never named here. */
    const declaring = gateRoster().filter((g) => g.ciFace);
    const headless = gateRoster().filter((g) => !g.browser && !g.windows);

    it('the roster carries at least one declared face, and it is headless', () => {
        expect(declaring.length).toBeGreaterThan(0);
        expect(headless.some((g) => g.ciFace)).toBe(true);
    });

    it('⛔ headless ∧ ¬cheap ∧ a declared face ⇒ NOT CI-sourced', () => {
        for (const g of declaring) {
            expect(ciSourced({ headless: true, cheap: false, ciFace: g.ciFace })).toBe(false);
        }
    });

    it('⛓ …and REMOVING the declaration flips the read path, visibly', () => {
        expect(ciSourced({ headless: true, cheap: false, ciFace: null })).toBe(true);
    });

    it('the other two arms of the rule are unchanged', () => {
        expect(ciSourced({ headless: true, cheap: true })).toBe(false);
        expect(ciSourced({ headless: false, cheap: false })).toBe(false);
        expect(ciSourced({ headless: true, cheap: undefined })).toBe(false);
    });
});
