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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { HELP_FLAG, helpText, wantsHelp } from './argvHelp.js';
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
