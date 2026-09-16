/**
 * procgenHelpBaseline — **THE ROWS** (slice seedling-headless-G1; the killed
 * import door's completed control, H1).
 *
 * ⛔ The measured defect: two consecutive `--write-baseline` runs at one head
 * wrote different bytes (247 of 250 entries: `ms`, `why`, `wrote`; and `wrote`
 * reduced to directories still moved on 2), so every
 * regeneration was a diff nobody could review. The rows construct two runs
 * that differ ONLY in what load moves — wall clock, the throwaway tree's
 * random name, a ceiling kill, the file count a killed writer reached, and
 * (H1) the place a killed door's captured PREFIX was cut — and
 * require the same bytes; and, so that is not vacuous, two runs that differ in
 * what the gate READS (membership, inherited output) must NOT.
 */
import { describe, expect, it } from 'vitest';

import { baselineDocument, residueKinds } from './procgenHelpBaseline.js';

const door = (o = {}) => ({ ok: true, why: [], wrote: [], stdout: '', stderr: '', ms: 100, ...o });
const row = (file, imp = {}, help = {}) => ({ file, import: door(imp), help: door(help) });

/** One run's rows; `tree` and `load` are what a busier box moves. */
function run({ tree, load }) {
    return [
        row('inert.mjs', { ms: 90 + load }),
        /**
         * ⛓ H1's case — a KILLED import door, whose own capture is a PREFIX that
         * load cuts in a different place every run (nothing here, the banner
         * there). The field is computed against the CONTROL re-run under the
         * long ceiling, which finished, so neither cut moves the bytes; the
         * `⛔ NOT VACUOUS` row below drops the control and watches them move.
         */
        row('killed-banner.mjs', {
            ok: false,
            ms: 5000 + load,
            timedOut: true,
            ceiling: 5000,
            why: ['ran past the 5000 ms ceiling and was killed'],
            stdout: load ? '[centralRegistry] CentralRegistry initialized' : '',
            control: {
                ceiling: 15000,
                timedOut: false,
                ms: 6100 + load,
                stdout: '[centralRegistry] CentralRegistry initialized\n# DONE',
                stderr: '',
            },
        }, { stdout: '[centralRegistry] CentralRegistry initialized\nusage' }),
        row('killed-writer.mjs', {
            ok: false,
            ms: 5000 + load,
            why: [
                ...(load ? ['ran past the 5000 ms ceiling and was killed'] : ['exit 0']),
                `printed ${7 + load * 400} line(s) to stdout on a bare import: # CENSUS`,
                `wrote ${11 + load} file(s) under the repo: NewDocs/survey/route.json …`,
            ],
            /** ⛓ measured: a killed writer wrote 11 files, then 12 — and elsewhere nothing at all. */
            wrote: load ? ['__pycache__/x.pyc', 'NewDocs/survey/route.json',
                ...Array.from({ length: 11 }, (_, i) => `NewDocs/survey/views/step-${i}.json`)] : [],
            stdout: '[stateManagerProxy] Worker is not defined\n# CENSUS',
        }, { stdout: '[stateManagerProxy] Worker is not defined\nusage' }),
        row('refuser.mjs', {
            ok: false,
            ms: 130 + load,
            why: ['exit 2', `printed to stderr: not found at /tmp/procgen-help-tree-${tree}/x.swf`],
        }),
    ];
}

describe('baselineDocument — two runs at one head write the same bytes', () => {
    it('load (wall clock, tree name, a ceiling kill, a truncated or absent write) moves NOTHING', () => {
        const a = baselineDocument(run({ tree: 'ksdL2m', load: 0 }), 'cafe');
        const b = baselineDocument(run({ tree: '4efCRT', load: 1 }), 'cafe');
        expect(b).toBe(a);
    });

    it('what closing an entry must preserve is still recorded', () => {
        const doc = JSON.parse(baselineDocument(run({ tree: 'x', load: 0 }), 'cafe'));
        expect(Object.keys(doc.importDoorEffectful)).toEqual(['killed-banner.mjs',
            'killed-writer.mjs', 'refuser.mjs']);
        expect(doc.importDoorEffectful['killed-writer.mjs']).toEqual({
            inheritedOutput: ['[stateManagerProxy] Worker is not defined'],
            helpResidue: null,
        });
        /** ⛓ the killed door's control is what the banner was read off — its own
         *  capture at `load: 0` was empty. `# DONE` is the import door's alone. */
        expect(doc.importDoorEffectful['killed-banner.mjs']).toEqual({
            inheritedOutput: ['[centralRegistry] CentralRegistry initialized'],
            helpResidue: null,
        });
        expect(doc.counts).toEqual({ instruments: 4, importDoorEffectful: 3 });
    });

    it('⛔ NOT VACUOUS: membership and inherited output DO move the bytes', () => {
        const base = run({ tree: 'x', load: 0 });
        const a = baselineDocument(base, 'cafe');
        const fixed = base.map((r) => (r.file === 'refuser.mjs' ? row('refuser.mjs') : r));
        expect(baselineDocument(fixed, 'cafe')).not.toBe(a);
        const quiet = base.map((r) => (r.file === 'killed-writer.mjs'
            ? { ...r, help: door({ stdout: 'usage' }) } : r));
        expect(baselineDocument(quiet, 'cafe')).not.toBe(a);
        /**
         * ⛔ AND THE KILLED DOOR'S CONTROL IS LOAD-BEARING (H1): without it the
         * field falls back to the PREFIX — empty at `load: 0` — and the entry
         * loses the banner its help door will print on every run. That is the
         * false red, at the level of the bytes.
         */
        const uncompleted = base.map((r) => (r.file === 'killed-banner.mjs'
            ? { ...r, import: { ...r.import, control: undefined } } : r));
        const doc = JSON.parse(baselineDocument(uncompleted, 'cafe'));
        expect(doc.importDoorEffectful['killed-banner.mjs'].inheritedOutput).toEqual([]);
        expect(baselineDocument(uncompleted, 'cafe')).not.toBe(a);
    });
});

/**
 * ⛓ G1's second small item: `helpResidue` is the KIND of each help-door
 * failure, never its text. 0 of 250 entries carry one at `36d20e65a4`, so the
 * only way to hold the field to its rule is to construct a failing help door
 * here — with the same load-dependent prose the `why` field was dropped for.
 */
function runWithBrokenHelp({ tree, load }) {
    return [
        row('broken-help.mjs', { ok: false, why: ['exit 2'] }, {
            ok: false,
            ms: 5000 + load,
            why: [
                ...(load ? ['ran past the 5000 ms ceiling and was killed (SIGKILL)'] : ['exit 1']),
                `printed to stderr: cannot open /tmp/procgen-help-tree-${tree}/x.swf`,
                `printed ${3 + load * 40} line(s) to stdout on a bare --help: usage`,
                `wrote ${1 + load} file(s) under the repo: NewDocs/x.json`,
                'the repo\'s `git status --porcelain` MOVED — RESTORED NewDocs/x.json',
            ],
        }),
    ];
}

describe('helpResidue — the KIND of a failing help door, never its text', () => {
    it('two runs whose help doors fail the same way for different prose write the same bytes', () => {
        const a = baselineDocument(runWithBrokenHelp({ tree: 'AAAAAA', load: 0 }), 'deadbeef');
        const b = baselineDocument(runWithBrokenHelp({ tree: 'ZZZZZZ', load: 1 }), 'deadbeef');
        expect(a).toBe(b);
        const residue = JSON.parse(a).importDoorEffectful['broken-help.mjs'].helpResidue;
        expect(residue).toEqual(['exit', 'stderr', 'stdout']);
    });
    it('⛔ NOT VACUOUS: a different KIND of failure does move the bytes', () => {
        const a = baselineDocument(runWithBrokenHelp({ tree: 'AAAAAA', load: 0 }), 'deadbeef');
        const rows = runWithBrokenHelp({ tree: 'AAAAAA', load: 0 });
        rows[0].help.why = ['exit 1', 'left 1 entry(ies) in its own cache: x'];
        expect(baselineDocument(rows, 'deadbeef')).not.toBe(a);
    });
    it('residueKinds classifies every producer prefix and sorts', () => {
        expect(residueKinds([
            'wrote 3 file(s) under the repo: a, b, c', 'exit 2 (SIGTERM)',
            'left 2 entry(ies) in its own cache: x', 'printed to stderr: boom',
            'printed 9 line(s) to stdout on a bare import: y', 'ran past the 5000 ms ceiling and was killed',
            'stdout is NOT the derived help text — the instrument RAN instead of printing', 'printed NOTHING',
            'something nobody wrote a prefix for',
        ])).toEqual(['cache', 'exit', 'help-text', 'other', 'stderr', 'stdout']);
        expect(residueKinds([])).toEqual([]);
        expect(residueKinds(undefined)).toEqual([]);
    });
});
