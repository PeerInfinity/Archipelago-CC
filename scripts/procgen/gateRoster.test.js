/**
 * gateRoster — **THE ROSTER'S TWO PROMISES, PINNED** (editor v3 · Q6).
 *
 * ⛓ This file did not exist until Q6. It pins what Q6 adds — the
 * `@standing-variant` declaration that lets ONE gate be TWO standing rows —
 * and the ONE invariant the module's own docblock already promises and
 * nothing checked: **the roster is READ OUT OF THE GATES** (⚖ ruling 17), so
 * every `check-*.mjs` on disk is a row and nothing else is.
 *
 * ⛔ THE COUNTS HERE ARE INTERPOLATED, NEVER TYPED. A row that types `28` is
 * a row that goes red when somebody adds a gate — which is the opposite of
 * what a derived roster is for, and `lint-gate-labels` says so by name.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    REPO, SCRIPT_DIR, ciShallowIn, gateRoster, isGateFile, variantsIn,
} from './gateRoster.js';

/**
 * ⛔ THE ROSTER IS BUILT INSIDE EACH ROW, NOT AT COLLECT TIME. `gateRoster`
 * REFUSES a malformed declaration by throwing, and a throw at module scope
 * takes the whole file down as *"no tests"* — a red that names no row, which
 * is the shape a mutant cannot be read off. The file list comes off DISK, so
 * the interpolated count below survives the refusal it is meant to describe.
 */
const GATE_FILES = readdirSync(join(REPO, SCRIPT_DIR)).filter(isGateFile).sort();
/** ⛓ The gate ⚖ §26.7a measured two arms of; the only declarer today. */
const DECLARING = 'check-seedling-editor-generate.mjs';

describe('⛓ the roster is read out of the gates', () => {
    it('every check-*.mjs on disk is a row, and nothing else is', () => {
        const roster = gateRoster();
        expect(roster.map((g) => g.file)).toEqual(GATE_FILES);
        expect(roster.map((g) => g.path)).toEqual(GATE_FILES.map((f) => `${SCRIPT_DIR}/${f}`));
    });
});

describe('⛓⛓ @standing-variant — an arm a gate declares for itself', () => {
    it('the generate gate declares the own-server arm, with no extra argv', () => {
        const gate = gateRoster().find((g) => g.file === DECLARING);
        expect(gate.variants).toEqual([{ label: 'own server', argv: [] }]);
    });

    /**
     * ⛔ THE OTHER DIRECTION, and it is the row the narrow anchor is FOR. The
     * declaring gate's docblock spells the tag out for a reader mid-sentence;
     * a reader that matched the token anywhere on a line would harvest that
     * sentence as a declaration too.
     */
    it(`⛔ each of the other ${GATE_FILES.length - 1} gates declares none`, () => {
        const others = gateRoster().filter((g) => g.file !== DECLARING);
        expect(others.map((g) => g.file)).toEqual(GATE_FILES.filter((f) => f !== DECLARING));
        expect(others.filter((g) => g.variants.length > 0).map((g) => g.file)).toEqual([]);
    });

    it('a prose mention of the tag is not a declaration — the line must START with it', () => {
        const prose = '/**\n'
            + ' * the spelling is `@standing-variant <label>: <argv | (none)>`, where the\n'
            + ' * argv is the LITERAL extra flags that arm is run with.\n'
            + ' */\n';
        expect(variantsIn(prose)).toEqual([]);
    });

    it('…and a declaration is read whatever its argv, in order', () => {
        const text = '/**\n'
            + ' * @standing-variant own server: (none)\n'
            + ' * @standing-variant pages: --pages=https://example.invalid --json\n'
            + ' */\n';
        expect(variantsIn(text)).toEqual([
            { label: 'own server', argv: [] },
            { label: 'pages', argv: ['--pages=https://example.invalid', '--json'] },
        ]);
    });
});

describe('⛔ a malformed declaration REFUSES BY NAME — it is never skipped', () => {
    it('a line with no colon names the file and the line it could not read', () => {
        const text = '/**\n * @standing-variant own server (none)\n */\n';
        expect(() => variantsIn(text, { file: 'check-scratch.mjs' }))
            .toThrow(/check-scratch\.mjs.*malformed @standing-variant/s);
    });

    it('an empty right-hand side names the file too', () => {
        const text = '/**\n * @standing-variant own server:\n */\n';
        expect(() => variantsIn(text, { file: 'check-scratch.mjs' }))
            .toThrow(/check-scratch\.mjs.*malformed @standing-variant/s);
    });

    it('an argv word that is not a flag is refused, not silently passed through', () => {
        const text = '/**\n * @standing-variant own server: localhost\n */\n';
        expect(() => variantsIn(text, { file: 'check-scratch.mjs' }))
            .toThrow(/check-scratch\.mjs.*"localhost".*not a flag/s);
    });
});

/**
 * ⛓⛓⛓ S4 (⚖ 72; trap 1058) — **`@ci-shallow`: THE GATE SAYS CI'S CHECKOUT
 * CANNOT ASK ITS QUESTION.**
 *
 * ⛔ THE ROWS THAT MATTER ARE THE REFUSALS. An exclusion that can be armed by
 * a malformed or empty line is an exclusion nobody can audit — and the whole
 * reason this declaration exists is that the previous exclusion (`cheap`, a
 * 60 s timing band) was one nobody could read the REASON out of.
 */
describe('@ci-shallow — declared, never detected', () => {
    it('reads the reason off the line, as free text', () => {
        const text = '/**\n * @ci-shallow every verdict is a diff against a baseline commit\n */\n';
        expect(ciShallowIn(text)).toEqual({
            reason: 'every verdict is a diff against a baseline commit',
        });
    });

    it('a gate that declares none answers null', () => {
        expect(ciShallowIn('/**\n * an ordinary docblock\n */\n')).toBe(null);
    });

    /** ⛔ The same narrowness `variantsIn` has, and for the same reason: this
     *  file's OWN docblock spells the tag out for a reader. */
    it('a prose mention of the tag is not a declaration', () => {
        const prose = '/**\n'
            + ' * the spelling is  @ci-shallow <why a depth-1 checkout cannot answer this>,\n'
            + ' * on a docblock line that STARTS with the tag.\n'
            + ' */\n';
        expect(ciShallowIn(prose)).toBe(null);
    });

    it('⛔ a line with NO reason on it is refused BY NAME', () => {
        expect(() => ciShallowIn('/**\n * @ci-shallow\n */\n', { file: 'check-scratch.mjs' }))
            .toThrow(/check-scratch\.mjs.*malformed @ci-shallow/s);
    });

    it('⛔ two declarations are refused — one exclusion cannot have two reasons', () => {
        const text = '/**\n * @ci-shallow reason one\n * @ci-shallow reason two\n */\n';
        expect(() => ciShallowIn(text, { file: 'check-scratch.mjs' }))
            .toThrow(/check-scratch\.mjs declares 2 @ci-shallow lines/);
    });

    /**
     * ⛓ …AND THE LIVE ROSTER CARRIES THE DECLARATIONS, with a non-vacuity
     * assertion first (trap 824). ⛔ WHICH gates declare it is asserted in
     * `ciGatePlan.test.js`, where the consequence lives — here it is only
     * that the parser reaches the tree at all.
     */
    it('the roster reads at least one declaration off a real gate', () => {
        const roster = gateRoster({ repo: REPO });
        expect(roster.length).toBeGreaterThan(10);
        const declaring = roster.filter((g) => g.ciShallow);
        expect(declaring.length).toBeGreaterThan(0);
        for (const g of declaring) expect(g.ciShallow.reason.length).toBeGreaterThan(20);
    });
});
