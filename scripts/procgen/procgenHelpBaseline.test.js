/**
 * procgenHelpBaseline — **THE ROWS** (slice seedling-headless-G1).
 *
 * ⛔ The measured defect: two consecutive `--write-baseline` runs at one head
 * wrote different bytes (247 of 250 entries: `ms`, `why`, `wrote`; and `wrote`
 * reduced to directories still moved on 2), so every
 * regeneration was a diff nobody could review. The rows construct two runs
 * that differ ONLY in what load moves — wall clock, the throwaway tree's
 * random name, a ceiling kill, the file count a killed writer reached — and
 * require the same bytes; and, so that is not vacuous, two runs that differ in
 * what the gate READS (membership, inherited output) must NOT.
 */
import { describe, expect, it } from 'vitest';

import { baselineDocument } from './procgenHelpBaseline.js';

const door = (o = {}) => ({ ok: true, why: [], wrote: [], stdout: '', stderr: '', ms: 100, ...o });
const row = (file, imp = {}, help = {}) => ({ file, import: door(imp), help: door(help) });

/** One run's rows; `tree` and `load` are what a busier box moves. */
function run({ tree, load }) {
    return [
        row('inert.mjs', { ms: 90 + load }),
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
        expect(Object.keys(doc.importDoorEffectful)).toEqual(['killed-writer.mjs', 'refuser.mjs']);
        expect(doc.importDoorEffectful['killed-writer.mjs']).toEqual({
            inheritedOutput: ['[stateManagerProxy] Worker is not defined'],
            helpResidue: null,
        });
        expect(doc.counts).toEqual({ instruments: 3, importDoorEffectful: 2 });
    });

    it('⛔ NOT VACUOUS: membership and inherited output DO move the bytes', () => {
        const base = run({ tree: 'x', load: 0 });
        const a = baselineDocument(base, 'cafe');
        const fixed = base.map((r) => (r.file === 'refuser.mjs' ? row('refuser.mjs') : r));
        expect(baselineDocument(fixed, 'cafe')).not.toBe(a);
        const quiet = base.map((r) => (r.file === 'killed-writer.mjs'
            ? { ...r, help: door({ stdout: 'usage' }) } : r));
        expect(baselineDocument(quiet, 'cafe')).not.toBe(a);
    });
});
