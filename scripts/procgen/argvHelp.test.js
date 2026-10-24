/**
 * argvHelp / argvScan — **THE UNIT ROWS** (R9 slice P4a, ⚖ ruling 47b (4)).
 *
 * ⛔ THE GATE IS `check-procgen-help.mjs`, which spawns every instrument and
 * watches the disk. These rows are the cheap half: that the derivation is the
 * INDEX's (never a hand list), that the token the 260 importers inherit is
 * really in this module's text, and that the insertion anchor the bulk edit
 * used is the one whose two predecessors broke 33 files and 2.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { HELP_FLAG, helpText, isEntryPoint, wantsHelp } from './argvHelp.js';
import { bodyStartLine, flagsIn, inheritedFlagsIn } from './argvScan.js';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('⛓ `--help` is answered from the file, not from a list', () => {
    it('the token the importers inherit is a LITERAL in this module\'s own text', () => {
        const file = join(HERE, 'argvHelp.js');
        const src = readFileSync(file, 'utf8');
        /**
         * ⛔ `argv.includes(HELP_FLAG)` would parse as reading NO flag, and
         * every instrument that imports this module would inherit nothing —
         * the index finds a flag by matching the LITERAL. This row is why the
         * constant and the call are allowed to look redundant.
         */
        expect(src).toContain("includes('--help')");
        expect(flagsIn(src, { file }).map((f) => f.name))
            .toContain(HELP_FLAG.replace(/^--/, ''));
    });

    it('an instrument inherits `--help` from this module and `--wait-for-box` from boxLock', () => {
        const file = join(HERE, 'check-seedling-editor-overlays.mjs');
        const inherited = inheritedFlagsIn(readFileSync(file, 'utf8'), { file });
        expect(inherited.map((f) => `${f.name} <- ${f.from}`))
            .toEqual(expect.arrayContaining(['help <- argvHelp.js', 'wait-for-box <- boxLock.js']));
    });

    it('wantsHelp reads the argv it is given, never the process\'s', () => {
        expect(wantsHelp(['node', 'x.mjs', '--help'])).toBe(true);
        expect(wantsHelp(['node', 'x.mjs', '--check'])).toBe(false);
    });

    it('the help text names the flags the index derives, with the parse site', () => {
        const text = helpText(join(HERE, 'check-seedling-editor-overlays.mjs'));
        expect(text).toContain('--host');
        expect(text).toContain('--wait-for-box   (inherited from boxLock.js)');
        expect(text).toContain('drives nothing');
    });

    it('⛔ a name this directory does not have gets a sentence, not a crash', () => {
        expect(helpText(join(HERE, 'no-such-instrument.mjs'))).toContain('no such instrument');
    });
});

/**
 * ⛔⛔ THE ANCHOR, AND ITS TWO MEASURED PREDECESSORS. Splicing at `headerOf`'s
 * end broke 33 of 260 instruments (it stops on a multi-line import's second
 * line); splicing after the last import broke 2 (a file whose first statement
 * is `export const SITES = Object.freeze([`) — and trap 906's three `verify-*`
 * files, whose docblock sits BELOW their imports, are the other direction.
 */
describe('⛔⛔ where a file\'s body begins (trap 906, and the two anchors before it)', () => {
    const at = (lines) => bodyStartLine(lines.join('\n'));

    it('after a single-line import', () => {
        expect(at(["import { a } from 'b';", '', 'const x = 1;'])).toBe(2);
    });

    it('⛓ after a MULTI-LINE import — the anchor `headerOf` gets wrong', () => {
        expect(at(['import {', '    a, b,', "} from 'c';", '', 'const x = 1;'])).toBe(4);
    });

    it('⛓ ABOVE a first statement that starts with `export`', () => {
        expect(at(['/** doc */', 'export const SITES = Object.freeze([', '    1,', ']);'])).toBe(1);
    });

    it('⛓ BELOW a docblock that sits under the imports (trap 906)', () => {
        expect(at(["import { a } from 'b';", '', '/**', ' * the docblock, below.', ' */',
            'const x = 1;'])).toBe(5);
    });

    it('⛓ after a shebang and a header docblock', () => {
        expect(at(['#!/usr/bin/env node', '/** doc */', 'const x = 1;'])).toBe(2);
    });
});

/**
 * ⛓⛓⛓ **`isEntryPoint` DIRECTLY** — it had only INDIRECT coverage (through
 * `argvHelp`) until R9 slice SG1 gave it a second job, and the second job is
 * the one with a measured incident behind it.
 */
describe('isEntryPoint — only the file that was RUN answers', () => {
    const ME = fileURLToPath(import.meta.url);

    /**
     * ⛓⛓ THE ROW THE SECOND JOB EARNED. SG1 W2 gave `check-procgen-help.mjs` a
     * module scope that builds a git worktree — and that file is one of its own
     * 265 instruments, so its IMPORT door (`node -e "await import(…)"`, which
     * has NO `argv[1]`) started a ~30 s `git worktree add` and was SIGKILLed at
     * its 5 s baselined ceiling, leaving a `locked initializing` registration
     * and a half-created tree PER RUN. Three had accumulated
     * (`procgen-help-tree-cvZlXG` at `7f21fb4a5`, `-E9Z2Sw` and `-dLa04B` at
     * `15e70e7bb`) before anyone noticed, and the gate could not see one of
     * them: its observers watch the WORKING TREE, while the litter lands in
     * `.git/worktrees/` and `/tmp`, and its own row is baselined so it cannot
     * red. Measured after the guard: one import-door opening, ONE orphan
     * before, ZERO after, with the row's verdict unmoved.
     */
    it('is FALSE when there is no argv[1] at all — the bare-import launch', () => {
        expect(isEntryPoint(import.meta.url, ['node'])).toBe(false);
    });

    it('is TRUE for the file that was launched, absolute or relative', () => {
        expect(isEntryPoint(import.meta.url, ['node', ME])).toBe(true);
        expect(isEntryPoint(import.meta.url, ['node', relative(process.cwd(), ME)])).toBe(true);
    });

    /** ⛔ the hoisted-dependency case its own docblock was written for. */
    it('is FALSE for a DIFFERENT file', () => {
        expect(isEntryPoint(import.meta.url, ['node', join(HERE, 'argvHelp.js')])).toBe(false);
    });

    it('⛔ does not crash on an argv[1] that does not exist', () => {
        expect(isEntryPoint(import.meta.url, ['node', '/no/such/instrument.mjs'])).toBe(false);
    });
});
