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

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    REPO, SCRIPT_DIR, argvFor, ciArgvIn, ciBoxIn, ciShallowIn, gateRoster, isGateFile, machineDrivers,
    standingRowIn, treeWritesIn, variantsIn,
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

/**
 * ⛓⛓⛓ V3b (⚖ user, 2026-09-05) — **`@ci-box`: THE GATE SAYS ONLY THIS BOX CAN
 * ANSWER IT.**
 *
 * ⛔ THE ROWS THAT MATTER ARE THE REFUSALS, exactly as for `@ci-shallow` one
 * describe up — an exclusion armed by an empty line is an exclusion nobody can
 * audit, and this one keeps 49 gates out of CI.
 */
describe('@tree-writes — declared, never detected (F2 task 7)', () => {
    it('reads the paths and the reason', () => {
        expect(treeWritesIn('/**\n * @tree-writes a/b.json, c.txt: restored in finally\n */\n'))
            .toEqual({ paths: ['a/b.json', 'c.txt'], reason: 'restored in finally' });
        expect(treeWritesIn('/**\n * ordinary\n */\n')).toBe(null);
    });

    it('⛔ refuses a line with no path or no reason, and a second line, BY NAME', () => {
        expect(() => treeWritesIn('/**\n * @tree-writes\n */\n', { file: 'check-x.mjs' }))
            .toThrow(/check-x\.mjs has a malformed @tree-writes/);
        expect(() => treeWritesIn('/**\n * @tree-writes a.json\n */\n', { file: 'check-x.mjs' }))
            .toThrow(/malformed @tree-writes/);
        expect(() => treeWritesIn('/**\n * @tree-writes a: r\n * @tree-writes b: r\n */\n', { file: 'check-x.mjs' }))
            .toThrow(/declares 2 @tree-writes lines/);
    });
});

describe('@ci-box — declared, never detected', () => {
    it('reads the reason off the line, as free text', () => {
        const text = '/**\n * @ci-box its fixture is regenerated, not committed\n */\n';
        expect(ciBoxIn(text)).toEqual({ reason: 'its fixture is regenerated, not committed' });
    });

    it('a gate that declares none answers null', () => {
        expect(ciBoxIn('/**\n * an ordinary docblock\n */\n')).toBe(null);
    });

    /** ⛔ F2 task 6 — a reason may DECLARE a positional, as a backquoted token. */
    it('a reason that declares a positional `<x>` carries it, and argvFor answers null for both worlds', () => {
        const text = '/**\n * @ci-box it takes a positional `<exported rules.json>` and exits 2 without it\n */\n';
        const ciBox = ciBoxIn(text);
        expect(ciBox).toEqual({ reason: 'it takes a positional `<exported rules.json>` and exits 2 without it',
            positional: '<exported rules.json>' });
        const gate = { file: 'check-scratch.mjs', flags: ['host'], ciBox };
        expect(argvFor(gate, 'local')).toBe(null);
        expect(argvFor(gate, 'live')).toBe(null);
        // ⛓ the control: the word in prose, unquoted, is not a declaration
        const prose = ciBoxIn('/**\n * @ci-box a positional argument is never needed here\n */\n');
        expect(prose.positional).toBeUndefined();
        expect(argvFor({ ...gate, ciBox: prose }, 'local')).toEqual(['--host=http://localhost:8000']);
    });

    /** ⛔ The same narrowness every declaration in this file has: `gateRoster`'s
     *  own docblock spells the tag out for a reader. */
    it('a prose mention of the tag is not a declaration', () => {
        const prose = '/**\n'
            + ' * the spelling is  @ci-box <why the box must answer this gate>,\n'
            + ' * on a docblock line that STARTS with the tag.\n'
            + ' */\n';
        expect(ciBoxIn(prose)).toBe(null);
    });

    it('⛔ a line with NO reason on it is refused BY NAME', () => {
        expect(() => ciBoxIn('/**\n * @ci-box\n */\n', { file: 'check-scratch.mjs' }))
            .toThrow(/check-scratch\.mjs.*malformed @ci-box/s);
    });

    it('⛔ two declarations are refused — one exclusion cannot have two reasons', () => {
        const text = '/**\n * @ci-box reason one\n * @ci-box reason two\n */\n';
        expect(() => ciBoxIn(text, { file: 'check-scratch.mjs' }))
            .toThrow(/check-scratch\.mjs declares 2 @ci-box lines/);
    });

    /**
     * ⛓ …AND THE LIVE ROSTER CARRIES THEM, with a non-vacuity assertion first
     * (trap 824). ⛔ WHICH gates declare it, and that the CI plan therefore did
     * not move, is asserted in `ciGatePlan.test.js` where the consequence lives.
     */
    it('the roster reads the declarations off real gates', () => {
        const roster = gateRoster({ repo: REPO });
        expect(roster.length).toBeGreaterThan(10);
        const declaring = roster.filter((g) => g.ciBox);
        expect(declaring.length).toBeGreaterThan(0);
        for (const g of declaring) expect(g.ciBox.reason.length).toBeGreaterThan(15);
    });
});

/**
 * ⛓⛓⛓ F1 task 0 — **`@standing-row`: A GATE WHOSE STANDING VALUE IS ANOTHER
 * ROW.** The Seedling differential's `gate:` row was its default arm, the
 * 150-tape full tier, and an unselected `standing-values --write` started it.
 */
describe('@standing-row — declared, never detected', () => {
    it('reads a key that itself contains a colon, then the reason', () => {
        const text = '/**\n * @standing-row roster: --tier=full: the composite: quoted per part\n */\n';
        expect(standingRowIn(text, { file: 'check-scratch.mjs' }))
            .toEqual({ key: 'roster: --tier=full', why: 'the composite: quoted per part' });
    });

    it('a gate that declares none answers null, and prose is not a declaration', () => {
        expect(standingRowIn('/**\n * an ordinary docblock\n */\n')).toBe(null);
        expect(standingRowIn('/**\n * spelled  @standing-row <kind>: <key>: <why>\n */\n')).toBe(null);
    });

    it('⛔ a line with no reason, or no key form, is refused BY NAME', () => {
        expect(() => standingRowIn('/**\n * @standing-row roster: --tier=full\n */\n',
            { file: 'check-scratch.mjs' })).toThrow(/check-scratch\.mjs.*malformed @standing-row/s);
        expect(() => standingRowIn('/**\n * @standing-row just words\n */\n',
            { file: 'check-scratch.mjs' })).toThrow(/malformed @standing-row/);
    });

    it('⛔ two declarations, and a declaration of the row it would get anyway, are refused', () => {
        const two = '/**\n * @standing-row roster: a: why\n * @standing-row roster: b: why\n */\n';
        expect(() => standingRowIn(two, { file: 'check-scratch.mjs' }))
            .toThrow(/declares 2 @standing-row lines/);
        expect(() => standingRowIn('/**\n * @standing-row gate: scratch: why\n */\n',
            { file: 'check-scratch.mjs' })).toThrow(/the row it would get anyway/);
    });

    /** ⛓ Non-vacuity first (trap 824), then the one declarer by name. */
    it('the roster reads it off the differential, naming the composite row', () => {
        const declaring = gateRoster({ repo: REPO }).filter((g) => g.standingRow);
        expect(declaring.map((g) => g.file)).toEqual(['check-seedling-bot-differential.mjs']);
        expect(declaring[0].standingRow.key).toBe('roster: --tier=full');
    });

    /** ⛔ A variant is an arm of the gate's own row; a gate with no row has none. */
    it('⛔ @standing-row paired with @standing-variant is refused as a PAIR', () => {
        const root = mkdtempSync(join(tmpdir(), 'f1-standing-row-'));
        try {
            mkdirSync(join(root, SCRIPT_DIR), { recursive: true });
            writeFileSync(join(root, SCRIPT_DIR, 'check-scratch-pair.mjs'),
                '/**\n * @standing-row roster: x: why\n * @standing-variant arm: --y\n */\n'
                + "console.log('ALL CHECKS PASSED');\nprocess.exit(0);\n");
            expect(() => gateRoster({ repo: root })).toThrow(/check-scratch-pair\.mjs declares `@standing-row roster: x` AND 1 @standing-variant/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
});

/**
 * ⛓⛓⛓ S5 (⚖ 72) — **`@ci-argv`: THE SAME CLAIM, ASKED THE WAY A CHECKOUT CAN
 * ASK IT.**
 *
 * ⛔ THE ROWS THAT MATTER ARE AGAIN THE REFUSALS, and one of them is NEW in
 * kind: a gate declaring BOTH `@ci-face` and `@ci-argv` is refused as a PAIR.
 * The two say opposite things about one run — a different claim under its own
 * key, and the same claim under the standing one — and whichever a consumer
 * happened to read first would decide it silently, which is exactly how P4b
 * (D) froze a row for a month.
 */
describe('@ci-argv — the same claim, run the way CI can run it', () => {
    it('reads the flags off the left side and the argument off the right', () => {
        const text = '/**\n * @ci-argv --in-place: a runner checkout IS the throwaway tree\n */\n';
        expect(ciArgvIn(text)).toEqual({
            argv: ['--in-place'],
            reason: 'a runner checkout IS the throwaway tree',
        });
    });

    it('…and reads more than one flag, in order', () => {
        const text = '/**\n * @ci-argv --in-place --jobs=4: two flags, one argument\n */\n';
        expect(ciArgvIn(text).argv).toEqual(['--in-place', '--jobs=4']);
    });

    it('a gate that declares none answers null', () => {
        expect(ciArgvIn('/**\n * an ordinary docblock\n */\n')).toBe(null);
    });

    /** ⛔ The same narrowness the other three tags have: this module's own
     *  docblock spells the tag out for a reader, mid-sentence. */
    it('a prose mention of the tag is not a declaration', () => {
        const prose = '/**\n'
            + ' * the spelling is  @ci-argv <flags>: <why these flags do not move the\n'
            + ' * claim>, on a docblock line that STARTS with the tag.\n'
            + ' */\n';
        expect(ciArgvIn(prose)).toBe(null);
    });

    it('⛔ a line with NO argument on it is refused BY NAME', () => {
        expect(() => ciArgvIn('/**\n * @ci-argv --in-place\n */\n', { file: 'check-scratch.mjs' }))
            .toThrow(/check-scratch\.mjs.*malformed @ci-argv/s);
    });

    /**
     * ⛔⛔ THE REASON IS THE DECLARATION'S ONLY DEFENCE. A flag that narrows
     * the question would publish a bounded number under the STANDING key —
     * `@ci-face`'s defect wearing this tag as a costume — so a line that
     * arms the append without making the argument is refused.
     */
    it('⛔ …and an EMPTY argument is refused too, not read as "no reason given"', () => {
        expect(() => ciArgvIn('/**\n * @ci-argv --in-place:\n */\n', { file: 'check-scratch.mjs' }))
            .toThrow(/check-scratch\.mjs.*malformed @ci-argv/s);
    });

    it('⛔ a left-side word that is not a flag is refused, `(none)` included', () => {
        expect(() => ciArgvIn('/**\n * @ci-argv (none): nothing to add\n */\n',
            { file: 'check-scratch.mjs' })).toThrow(/check-scratch\.mjs.*"\(none\)".*not a flag/s);
    });

    it('⛔ two declarations are refused — a gate runs ONE way in CI', () => {
        const text = '/**\n * @ci-argv --a: one\n * @ci-argv --b: two\n */\n';
        expect(() => ciArgvIn(text, { file: 'check-scratch.mjs' }))
            .toThrow(/check-scratch\.mjs declares 2 @ci-argv lines/);
    });

    /**
     * ⛓ …AND THE LIVE ROSTER CARRIES IT, non-vacuously (trap 824). ⛔ WHICH
     * gate declares it, and what the declaration DOES to the arm CI runs, is
     * asserted in `ciGatePlan.test.js` where the consequence lives.
     */
    it('the roster reads at least one declaration off a real gate', () => {
        const roster = gateRoster({ repo: REPO });
        expect(roster.length).toBeGreaterThan(10);
        const declaring = roster.filter((g) => g.ciArgv);
        expect(declaring.length).toBeGreaterThan(0);
        for (const g of declaring) expect(g.ciArgv.reason.length).toBeGreaterThan(20);
    });

    /**
     * ⛔⛔ THE PAIR REFUSAL, over the LIVE tree — a gate cannot declare both.
     * It is asserted here rather than only in the parser because the refusal
     * lives in `gateRoster()`, which is the one place both declarations are
     * read for the same file.
     */
    it('⛔ no gate declares both @ci-face and @ci-argv, and the roster REFUSES one that does', () => {
        const roster = gateRoster({ repo: REPO });
        expect(roster.filter((g) => g.ciFace && g.ciArgv)).toEqual([]);
        /** ⛓ …and the refusal is reachable: a scratch tree with one such gate. */
        const dir = mkdtempSync(join(tmpdir(), 'gate-roster-both-'));
        mkdirSync(join(dir, SCRIPT_DIR), { recursive: true });
        writeFileSync(join(dir, SCRIPT_DIR, 'check-scratch.mjs'),
            '/**\n * @ci-face bounded: --only=one\n'
            + ' * @ci-argv --in-place: the same claim, in a checkout\n */\n');
        try {
            expect(() => gateRoster({ repo: dir }))
                .toThrow(/check-scratch\.mjs declares BOTH .*@ci-face.*@ci-argv/s);
        } finally { rmSync(dir, { recursive: true, force: true }); }
    });

    /**
     * ⛔⛔ V3b — **AND THE SAME PAIR REFUSAL FOR `@ci-box`, BOTH WAYS ROUND.**
     * A box-only gate has no CI run for a face to re-key or for argv to point
     * at, so either declaration beside it is a statement about a run that does
     * not happen. ⛓ Two cases and not one: a refusal that only fired for the
     * face would let the argv arrive through the other door.
     */
    it('⛔ no gate declares @ci-box beside @ci-face or @ci-argv, and both pairs are REFUSED',
        () => {
            const roster = gateRoster({ repo: REPO });
            expect(roster.filter((g) => g.ciBox && (g.ciFace || g.ciArgv))).toEqual([]);
            for (const [beside, re] of [
                [' * @ci-face bounded: --only=one\n', /@ci-box.*AND.*@ci-face/s],
                [' * @ci-argv --in-place: the same claim, in a checkout\n', /@ci-box.*AND.*@ci-argv/s],
            ]) {
                const dir = mkdtempSync(join(tmpdir(), 'gate-roster-box-'));
                mkdirSync(join(dir, SCRIPT_DIR), { recursive: true });
                writeFileSync(join(dir, SCRIPT_DIR, 'check-scratch.mjs'),
                    `/**\n * @ci-box only this box has the fixture\n${beside} */\n`);
                try {
                    expect(() => gateRoster({ repo: dir })).toThrow(re);
                    expect(() => gateRoster({ repo: dir })).toThrow(/check-scratch\.mjs/);
                } finally { rmSync(dir, { recursive: true, force: true }); }
            }
        });
});

/**
 * ⛓⛓ H2 — **THE `dual` KIND, on a scratch tree whose four files differ in
 * exactly the two properties the classifier reads.** A windows-only file, a
 * dual one, a file that only MENTIONS the headless module in a docblock, and a
 * plain browser file. Two mutants the row must red, both driven: a classifier
 * that calls every Windows file `dual` (the mention file and the windows-only
 * file would flip), and one that never yields `dual`.
 */
describe('H2 — the dual kind', () => {
    const WIN = "const WIN_PY = '/mnt/c/Windows/py.exe';\n";
    const HEADLESS = "import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';\n";
    const files = {
        'check-win-only.mjs': WIN,
        'check-both.mjs': HEADLESS + WIN,
        'check-mention.mjs': "/** see './headlessChromium.js' */\n" + WIN,
        'check-browser.mjs': "import { chromium } from 'playwright';\n",
    };
    const scratch = () => {
        const dir = mkdtempSync(join(tmpdir(), 'gate-roster-dual-'));
        mkdirSync(join(dir, SCRIPT_DIR), { recursive: true });
        for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, SCRIPT_DIR, f), text);
        return dir;
    };

    it('classifies by BOTH properties, and dual is a browser row that is not windows', () => {
        const dir = scratch();
        try {
            const by = Object.fromEntries(gateRoster({ repo: dir }).map((g) => [g.file, g]));
            expect([by['check-win-only.mjs'].windows, by['check-win-only.mjs'].dual]).toEqual([true, false]);
            expect([by['check-both.mjs'].windows, by['check-both.mjs'].dual]).toEqual([false, true]);
            expect(by['check-both.mjs'].browser).toBe(true);
            expect([by['check-mention.mjs'].windows, by['check-mention.mjs'].dual]).toEqual([true, false]);
            expect([by['check-browser.mjs'].windows, by['check-browser.mjs'].dual]).toEqual([false, false]);
            const kinds = Object.fromEntries(machineDrivers({ repo: dir }).map((d) => [d.file, d.kind]));
            expect(kinds).toEqual({ 'check-both.mjs': 'dual', 'check-browser.mjs': 'browser',
                'check-mention.mjs': 'windows', 'check-win-only.mjs': 'windows' });
        } finally { rmSync(dir, { recursive: true, force: true }); }
    });

    it('on the live tree, dual is exactly "holds the driver path AND imports the headless module"', () => {
        const roster = gateRoster({ repo: REPO });
        const read = (f) => readFileSync(join(REPO, SCRIPT_DIR, f), 'utf8');
        const derived = roster.filter((g) => /=\s*'\/mnt\/c\/Windows\/py\.exe'/.test(read(g.file))
            && /from '\.\/headlessChromium\.js'/.test(read(g.file))).map((g) => g.file);
        expect(derived.length).toBeGreaterThan(0);
        expect(roster.filter((g) => g.dual).map((g) => g.file)).toEqual(derived);
        expect(roster.filter((g) => g.dual && (g.windows || !g.browser))).toEqual([]);
    });
});

