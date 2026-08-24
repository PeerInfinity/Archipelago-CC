/**
 * walkReport — the verdict vocabulary, unit-rowed.
 * ⚖ R9 ruling 43, slice 12c′.
 *
 * The mode this feeds turns a STOP into the user's licence, so every row here
 * is about the one question the licence rests on: **did the WALK move**, as
 * distinct from "did the bytes move". ⚖ Ruling 39's `why` sweep moves bytes
 * and not one input key, and a reader that could not tell those apart would
 * ask the user to license a prose edit.
 */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
    WALK_REPORT_FLAG, WALK_VERDICTS, createWalkReport, verdictFor, walkReportTarget,
} from './walkReport.js';

/** A tape's bytes, in the shape a producer emits (4-space, trailing newline). */
const tape = (over = {}) => `${JSON.stringify({
    tape_version: 11,
    game: 'seedling',
    name: 'fixture-tape',
    description: 'the room story',
    tick_count: 3,
    inputs: [{ t: 0, held: ['right'] }],
    ...over,
}, null, 4)}\n`;

describe('walkReport: the verdict is read off the FIELDS, and `inputs` decides', () => {
    it('⛓ the five verdicts are the ones this module can return, and no others', () => {
        expect(WALK_VERDICTS).toEqual(['absent', 'none', 'walk-moves', 'description', 'other']);
    });

    it('⛓ no committed tape at all is `absent` — a GROWTH in flight, not a move', () => {
        const v = verdictFor(tape(), null);
        expect(v.verdict).toBe('absent');
        expect(v.committedTicks).toBeNull();
        expect(v.solvedTicks).toBe(3);
    });

    it('⛓ byte-identical is `none`', () => {
        const v = verdictFor(tape(), tape());
        expect(v.verdict).toBe('none');
        expect(v.moved).toEqual([]);
        expect(v.inputsIdentical).toBe(true);
    });

    it('⛓⛓ different `inputs` is `walk-moves` — the only verdict a licence covers', () => {
        const v = verdictFor(tape({ inputs: [{ t: 0, held: ['left'] }], tick_count: 9 }), tape());
        expect(v.verdict).toBe('walk-moves');
        expect(v.inputsIdentical).toBe(false);
        expect(v.moved).toEqual(['inputs', 'tick_count']);
        expect(v.solvedTicks).toBe(9);
        expect(v.committedTicks).toBe(3);
    });

    /**
     * ⛓⛓⛓ ⚖ RULING 39's SWEEP, AS A VERDICT. This is the case the whole
     * field-by-field reading exists for: the sentence in the declaration
     * changed, the producer wrote it into `description`, the bytes moved and
     * **the walk did not**.
     */
    it('⛓⛓ only `description` differs — that is ⚖ ruling 39\'s sweep, NOT a walk move', () => {
        const v = verdictFor(tape({ description: 'the room story, reworded' }), tape());
        expect(v.verdict).toBe('description');
        expect(v.moved).toEqual(['description']);
        expect(v.inputsIdentical).toBe(true);
    });

    /**
     * ⛔⛔ **THE PRECEDENCE ROW, AND IT IS THE ONE A TIE-BREAK GETS WRONG.**
     * A tape whose inputs AND description both moved is a WALK MOVE carrying
     * new prose. If `description` won the tie, a real walk move would ride
     * into the tree under a prose edit's name and never reach the user's
     * licence at all.
     */
    it('⛔⛔ inputs AND description both differ is `walk-moves`, never `description`', () => {
        const v = verdictFor(
            tape({ inputs: [{ t: 0, held: ['left'] }], description: 'reworded too' }), tape());
        expect(v.verdict).toBe('walk-moves');
        expect(v.moved).toEqual(['description', 'inputs']);
    });

    it('⛓ anything else moving is `other`, and the fields are NAMED rather than absorbed', () => {
        const v = verdictFor(tape({ rng: { seed: 7 } }), tape());
        expect(v.verdict).toBe('other');
        expect(v.moved).toEqual(['rng']);
    });
});

describe('walkReport: the flag is OFF by default and refuses a bare form', () => {
    it('⛓ absent is `null` — a producer with no flag writes nothing and changes nothing', () => {
        expect(walkReportTarget(['node', 'p.mjs', '--check'])).toBeNull();
    });

    it('⛓ `--walk-report=<path>` is the path', () => {
        expect(walkReportTarget(['node', 'p.mjs', `${WALK_REPORT_FLAG}=/tmp/r.json`]))
            .toBe('/tmp/r.json');
    });

    it('⛔ a BARE `--walk-report` is refused BY NAME, not defaulted', () => {
        expect(() => walkReportTarget(['node', 'p.mjs', WALK_REPORT_FLAG]))
            .toThrow(/needs a path/);
        expect(() => walkReportTarget(['node', 'p.mjs', `${WALK_REPORT_FLAG}=`]))
            .toThrow(/needs a path/);
    });
});

describe('walkReport: the report NAMES what the producer actually emitted', () => {
    const scratch = () => mkdtempSync(join(tmpdir(), 'walk-report-'));

    it('⛓ a disabled report notes nothing and writes nothing', () => {
        const dir = scratch();
        const r = createWalkReport({
            producer: 'p.mjs', tapesDir: dir, argv: ['node', 'p.mjs', '--check'], onExit: false,
        });
        expect(r.enabled).toBe(false);
        r.note(join(dir, 'a.json'), tape());
        expect(r.segments).toEqual([]);
        expect(r.write()).toBeNull();
    });

    it('⛓⛓ a TRACE sidecar is not a tape — a path outside the tape dir is skipped', () => {
        const dir = scratch();
        const traces = scratch();
        const out = join(scratch(), 'report.json');
        const r = createWalkReport({
            producer: 'p.mjs',
            tapesDir: dir,
            argv: ['node', 'p.mjs', `${WALK_REPORT_FLAG}=${out}`],
            onExit: false,
        });
        r.note(join(traces, 'a.trace.json'), '{"trace":1}');
        r.note(join(dir, 'a.json'), tape());
        expect(r.segments.map((s) => s.segment)).toEqual(['a']);
        const body = JSON.parse(readFileSync(r.write() && out, 'utf8'));
        expect(body.producer).toBe('p.mjs');
        expect(body.segments).toHaveLength(1);
    });

    /**
     * ⛔ THE CALIBRATION S0 RESTS ON. S0 asserts every chain segment appears in
     * EXACTLY ONE producer's report; a producer that emitted one tape twice
     * would satisfy that count while meaning something else entirely.
     */
    it('⛔ a producer emitting one tape TWICE is refused BY NAME', () => {
        const dir = scratch();
        const out = join(scratch(), 'report.json');
        const r = createWalkReport({
            producer: 'p.mjs',
            tapesDir: dir,
            argv: ['node', 'p.mjs', `${WALK_REPORT_FLAG}=${out}`],
            onExit: false,
        });
        r.note(join(dir, 'a.json'), tape());
        expect(() => r.note(join(dir, 'a.json'), tape())).toThrow(/emitted a twice/);
    });

    /**
     * ⛔⛔ THE COMMITTED SIDE IS READ AT `note`, NOT AT WRITE. Without
     * `--check` the producer OVERWRITES the tape immediately after `note`
     * returns; a report that read the file at exit would compare the new bytes
     * against themselves and call every walk `none`.
     */
    it('⛔⛔ the committed side is captured BEFORE the producer overwrites the tape', () => {
        const dir = scratch();
        const out = join(scratch(), 'report.json');
        const path = join(dir, 'a.json');
        writeFileSync(path, tape());
        const r = createWalkReport({
            producer: 'p.mjs',
            tapesDir: dir,
            argv: ['node', 'p.mjs', `${WALK_REPORT_FLAG}=${out}`],
            onExit: false,
        });
        const derived = tape({ inputs: [{ t: 0, held: ['left'] }] });
        r.note(path, derived);
        // what `emit` does next, in write mode:
        writeFileSync(path, derived);
        expect(r.segments[0].verdict).toBe('walk-moves');
    });
});
