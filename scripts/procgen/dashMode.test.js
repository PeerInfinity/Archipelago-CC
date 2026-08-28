import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    DASH_FLAG, DASH_MODES, DEFAULT_DASH_MODE,
    dashModeArgv, dashModeNote, dashModeToken, parseDashMode,
} from './dashMode.js';

const HERE = new URL('.', import.meta.url).pathname;

/**
 * ⛓⛓⛓ R9 SLICE 12i — **`--dash`, PARSED ONCE, AND THE PARTICIPANT SET IS
 * DERIVED FROM THE SCRIPTS' OWN TEXT RATHER THAN LISTED HERE.**
 */
describe('R9 slice 12i: the --dash flag', () => {
    it('⛓ the vocabulary is `solverBot`\'s, re-exported and not retyped', () => {
        expect(DASH_MODES).toEqual(['none', 'full', 'all']);
        expect(DASH_MODES).toContain(DEFAULT_DASH_MODE);
        expect(DASH_FLAG).toBe('--dash');
    });

    /**
     * ⛔ THE BYTE-INERTNESS CLAIM, AS THREE ROWS. An unset flag must reach the
     * roster's default, print nothing, and add nothing to a sub-process
     * command line — that conjunction is the whole reason the seven standing
     * `--check` md5s do not move with this module in the tree.
     */
    it('⛓⛓ unset is INERT: the default mode, no note, an empty argv', () => {
        expect(parseDashMode(null)).toBe(DEFAULT_DASH_MODE);
        expect(parseDashMode(undefined)).toBe(DEFAULT_DASH_MODE);
        expect(dashModeToken(['node', 'x.mjs', '--check'])).toBe(null);
        expect(dashModeNote(DEFAULT_DASH_MODE)).toBe(null);
        expect(dashModeArgv(DEFAULT_DASH_MODE)).toEqual([]);
    });

    it('⛓ every mode round-trips through the token, the note and the argv', () => {
        for (const mode of DASH_MODES) {
            expect(parseDashMode(`${DASH_FLAG}=${mode}`)).toBe(mode);
            expect(parseDashMode(dashModeToken(['node', 'x', `${DASH_FLAG}=${mode}`])))
                .toBe(mode);
            const argv = dashModeArgv(mode);
            expect(parseDashMode(dashModeToken(['node', 'x', ...argv]))).toBe(mode);
            if (mode !== DEFAULT_DASH_MODE) {
                expect(dashModeNote(mode)).toContain(mode);
                expect(argv).toEqual([`${DASH_FLAG}=${mode}`]);
            }
        }
    });

    /**
     * ⛔ MUTANT (m5)'s ROW AT THE CLI. A bare `--dash` LOOKS like a boolean and
     * this flag has three states; a fallback that picked one would plan under
     * a build the header did not name.
     */
    it('⛓⛓ a bare `--dash` and an unknown mode are refused BY NAME', () => {
        expect(() => parseDashMode('--dash')).toThrow(/needs a value/);
        expect(() => parseDashMode('--dash=')).toThrow(/is not a dash mode/);
        expect(() => parseDashMode('--dash=nome')).toThrow(/is not a dash mode/);
        expect(() => parseDashMode('--dash=ALL')).toThrow(/is not a dash mode/);
        // ⛓ and the message names the three states, so the fix is in the error.
        expect(() => parseDashMode('--dash=nome')).toThrow(/none \| full \| all/);
    });

    /**
     * ⛓⛓⛓ **THE PARTICIPANT SET IS THE SCRIPTS' OWN, SCANNED — the same law
     * the instruments index publishes flags under** (⚖ ruling 38(6)). A script
     * that imports the parse but never spells the token would be invisible to
     * the reference table; a script that spells the token but never threads
     * `DASH_MODE` would print a header naming a plan it did not make (mutant
     * m3). Both halves are asserted over the DERIVED set, so a twelfth
     * participant joins by being written, not by being listed here.
     */
    it('⛓⛓⛓ every script that imports the parse also SPELLS the token and THREADS it',
        () => {
            const files = readdirSync(HERE).filter((f) => f.endsWith('.mjs'));
            const participants = files.filter((f) =>
                readFileSync(join(HERE, f), 'utf8').includes("from './dashMode.js'"));
            expect(participants.length).toBeGreaterThan(0);
            for (const f of participants) {
                const src = readFileSync(join(HERE, f), 'utf8');
                // the index scans for the literal token in the script's own text
                expect(src, f).toContain("a === '--dash'");
                expect(src, f).toContain("a.startsWith('--dash=')");
                // …and the parsed mode is actually SPENT, not merely parsed
                expect(src.split('DASH_MODE').length - 1, f).toBeGreaterThan(2);
            }
            // ⛓ the set as measured today — a COUNT, so a participant added or
            // dropped without a word about it reds. The names are the reach's,
            // not a list this file curates.
            expect(participants.length).toBe(11);
        });
});
