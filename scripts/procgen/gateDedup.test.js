/**
 * gateDedup — **THE LICENCE, AND ITS FAIL-CLOSED HALF** (R9 slice SG1, ⚖ 71 (a)).
 *
 * ⛔ THE ROW THAT MATTERS IS THE FAIL-CLOSED ONE. A licence tested only on the
 * quadrant it was written for (a roster gate, deduped) is a licence nobody has
 * gated: the defect that costs a run is the OPPOSITE one — a command the
 * battery does NOT pay for being skipped because it happened to look like a
 * gate. So the roster is passed IN, and the interesting rows are the ones
 * where the target is absent from it.
 *
 * ⛓ The catalogue rows are read off the REAL data module, and the counts are
 * INTERPOLATED (⚖ 17; trap: a typed cardinality in a test name reds it when
 * somebody adds an entry) — what is asserted is the PARTITION, not a number.
 */

import { describe, expect, it } from 'vitest';

import { DEMOS } from '../../frontend/modules/procgenDocs/demos.js';
import { cliTargetsIn, siblingGatesIn } from './gateDedup.js';
import { gateRoster, isGateFile } from './gateRoster.js';

const ROSTER = new Set(gateRoster().map((g) => g.file));

describe('cliTargetsIn — the detector is the reference, not the mention', () => {
    it('reads the invoked path out of a plain command', () => {
        expect(cliTargetsIn('node scripts/procgen/check-seedling-editor-sequence.mjs'))
            .toEqual(['check-seedling-editor-sequence.mjs']);
    });

    it('reads BOTH targets out of a pipeline, once each', () => {
        expect(cliTargetsIn('node scripts/procgen/check-a.mjs | node scripts/procgen/check-b.mjs '
            + '&& node scripts/procgen/check-a.mjs')).toEqual(['check-a.mjs', 'check-b.mjs']);
    });

    it('finds nothing in a command that invokes nothing here', () => {
        expect(cliTargetsIn('npm test -- --mode=test-spoilers')).toEqual([]);
    });

    /** ⛔ The mention costume: a longer path that merely ENDS in the spelling. */
    it('does not match a path that only ENDS in the repo-relative spelling', () => {
        expect(cliTargetsIn('node /elsewhere/scripts/procgen/check-a.mjs')).toEqual([]);
    });

    /** ⛔ …and the suffix costume, which `\b` is what refuses. */
    it('does not match a longer file name that starts with one', () => {
        expect(cliTargetsIn('cat scripts/procgen/check-a.mjs.bak')).toEqual([]);
    });
});

describe('siblingGatesIn — roster membership is the LICENCE', () => {
    it('licenses a command whose one target is a roster gate', () => {
        expect(siblingGatesIn('node scripts/procgen/check-a.mjs', new Set(['check-a.mjs'])))
            .toBe('check-a.mjs');
    });

    /** ⛔⛔ THE FAIL-CLOSED ARM. Absent from the roster ⇒ nothing else drives
     *  it ⇒ it must still run. This is the row the mutant on disk reproduces. */
    it('REFUSES to license a target the roster does not hold', () => {
        expect(siblingGatesIn('node scripts/procgen/check-a.mjs', new Set(['check-b.mjs'])))
            .toBeNull();
    });

    it('REFUSES a command that mixes a roster gate with anything else', () => {
        expect(siblingGatesIn('node scripts/procgen/check-a.mjs && '
            + 'node scripts/procgen/generate-seedling-level.mjs --seed=1',
        new Set(['check-a.mjs']))).toBeNull();
    });

    /**
     * ⛔⛔ THE ARGV ARM (⚖ 71 (a)'s tightening). Roster membership says the
     * battery runs that FILE; it does not say the battery runs it asking THIS
     * question. A flag selects a different measured question wearing the same
     * name, and the row must run.
     */
    it('REFUSES a roster gate invoked with a flag of its own', () => {
        const roster = new Set(['check-a.mjs']);
        expect(siblingGatesIn('node scripts/procgen/check-a.mjs --only=3', roster)).toBeNull();
        expect(siblingGatesIn('node scripts/procgen/check-a.mjs --doors=all', roster)).toBeNull();
        expect(siblingGatesIn('node scripts/procgen/check-a.mjs --jobs=1 --host=http://x', roster))
            .toBeNull();
    });

    /** ⛓ …and `--host=` alone is the one exception, because it is the flag
     *  `argvFor` itself puts on a `local` arm. */
    it('licenses a roster gate carrying only --host=', () => {
        expect(siblingGatesIn('node scripts/procgen/check-a.mjs --host=http://localhost:8000',
            new Set(['check-a.mjs']))).toBe('check-a.mjs');
    });

    /** ⛔ A pipeline whose FIRST half is a licensed gate is still a different
     *  command, and the crude tokenizer is what refuses it. */
    it('REFUSES a roster gate piped into something else', () => {
        expect(siblingGatesIn('node scripts/procgen/check-a.mjs | head -3',
            new Set(['check-a.mjs']))).toBeNull();
    });

    /** ⛔ …and a runner other than `node` is not this invocation either. */
    it('REFUSES a roster gate run through a different runner', () => {
        expect(siblingGatesIn('timeout 30 node scripts/procgen/check-a.mjs',
            new Set(['check-a.mjs']))).toBeNull();
    });

    it('REFUSES a command that invokes no instrument in this directory', () => {
        expect(siblingGatesIn('npm test', ROSTER)).toBeNull();
    });

    it('REFUSES an empty roster, whatever the command', () => {
        expect(siblingGatesIn('node scripts/procgen/check-a.mjs', new Set())).toBeNull();
    });
});

describe('the catalogue, partitioned by the real roster', () => {
    const withCli = DEMOS.filter((e) => e.cli);
    const licensed = withCli.filter((e) => siblingGatesIn(e.cli.command, ROSTER));

    it('licenses SOME rows and leaves the rest to run', () => {
        expect(licensed.length).toBeGreaterThan(0);
        expect(licensed.length).toBeLessThan(withCli.length);
    });

    /** ⛓ Every licensed row's target really is a gate file on disk — the
     *  membership test and the naming convention agreeing is the check that
     *  the roster module and this one are asking one question. */
    it('every licensed row names only `check-*.mjs` files the roster holds', () => {
        for (const e of licensed) {
            for (const t of cliTargetsIn(e.cli.command)) {
                expect(isGateFile(t)).toBe(true);
                expect(ROSTER.has(t)).toBe(true);
            }
        }
    });

    /** ⛔ …and the complement is not empty by accident: the generator CLIs are
     *  the rows trap 476 put on the clock, and they must keep running. */
    it('leaves the generator CLIs unlicensed', () => {
        const unlicensed = withCli.filter((e) => !siblingGatesIn(e.cli.command, ROSTER));
        expect(unlicensed.length).toBeGreaterThan(0);
        for (const e of unlicensed) {
            expect(siblingGatesIn(e.cli.command, ROSTER)).toBeNull();
        }
    });
});
