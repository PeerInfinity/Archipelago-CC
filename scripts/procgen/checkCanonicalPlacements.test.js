/**
 * checkCanonicalPlacements — **THE GATE'S OWN ROWS** (APWorld coverage slice
 * P1).
 *
 * ⛓ The PREDICATE is pinned next door, in `rulesDocOps.test.js`: this file is
 * about the three things only the script has — which documents it reads, what
 * its headline says, and what it exits with.
 *
 * ⛔ EVERY ROW RUNS AGAINST A TEMP ROOT, never against `frontend/presets/`. A
 * row that staled a committed preset to see the gate red would be a row that
 * dirties the tree, and the corpus's real answer (`ALL PASS`) is a MEASUREMENT
 * the slice takes by running the gate, not something to assert here — the
 * population is different on CI's checkout than on a working tree that carries
 * untracked fixture presets.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, 'check-canonical-placements.mjs');

/** ⛓ A minimal document of the shape the gate reads: one region with one
 *  location, one item, and whatever placements the row wants. */
function document(placements) {
    return {
        game_name: 'P1 Fixture',
        regions: { 1: { Hall: { name: 'Hall', locations: [{ name: 'Hall Chest', id: 1 }] } } },
        items: { 1: { Key: { name: 'Key', id: 1 } } },
        canonical_placements: { 1: placements },
    };
}

describe('check-canonical-placements — the corpus gate', () => {
    let root;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'p1-placements-'));
    });
    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    /** ⛓ Write `frontend/presets/<preset>/<seed>/<file>` inside the temp root. */
    const write = (preset, seed, file, doc) => {
        const dir = join(root, 'frontend', 'presets', preset, seed);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, file), JSON.stringify(doc, null, 2));
    };

    /** ⛓ Run the gate against the temp root, returning its output AND its exit
     *  code — the code is half the claim (trap: an exit code without a summary
     *  is not a verdict, and a summary without the code is not one either). */
    const run = () => {
        try {
            return { code: 0, out: execFileSync('node', [GATE, `--tree=${root}`],
                { encoding: 'utf8' }) };
        } catch (err) {
            return { code: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
        }
    };

    it('⛓ reads every _rules.json under an AP_ directory and says how many', () => {
        write('alpha', 'AP_1', 'AP_1_rules.json', document({ 'Hall Chest': 'Key' }));
        write('beta', 'AP_2', 'AP_2_rules.json', document({}));
        const { code, out } = run();
        expect(out).toContain('documents read   2');
        expect(out).toContain('ALL PASS');
        expect(code).toBe(0);
    });

    /**
     * ⛔⛔ **THE MULTIWORLD SPELLING IS THE ONE A PATTERN LOSES.** Four presets
     * in the corpus write `AP_<id>_P<n>_rules.json`, so a glob keyed on
     * `AP_<id>_rules.json` would read one document where there are four — and
     * would do it silently, because the files it did read all pass.
     */
    it('⛔ reads a multiworld preset\'s per-slot files, not just the first', () => {
        for (const n of [1, 2, 3]) {
            write('multi', 'AP_9', `AP_9_P${n}_rules.json`, document({}));
        }
        expect(run().out).toContain('documents read   3');
    });

    it('⛓⛓ reds on a stale location, naming the preset, the slot and the entry', () => {
        write('alpha', 'AP_1', 'AP_1_rules.json',
            document({ 'Hall Chest': 'Key', 'A Room That Was Deleted': 'Key' }));
        const { code, out } = run();
        expect(out).toContain('FINDING');
        expect(out).toContain('alpha');
        expect(out).toContain('slot 1');
        expect(out).toContain('A Room That Was Deleted');
        expect(out).toContain('unknown location');
        expect(out).not.toContain('ALL PASS');
        expect(code).toBe(1);
    });

    it('⛓ reds on a stale item too, and the headline counts BOTH findings', () => {
        write('alpha', 'AP_1', 'AP_1_rules.json',
            document({ 'Hall Chest': 'An Item That Was Renamed', Nowhere: 'Key' }));
        const { out } = run();
        expect(out).toContain('unknown item');
        expect(out).toContain('unknown location');
        // ⛓ The headline is COMPUTED — the label carries no typed number, so
        //   this asserts the arithmetic rather than a string somebody wrote.
        expect(out).toContain('2 FINDINGS');
    });

    it('⛓ a document with no placement block is read and contributes nothing', () => {
        const doc = document({});
        delete doc.canonical_placements;
        write('alpha', 'AP_1', 'AP_1_rules.json', doc);
        const { code, out } = run();
        expect(out).toContain('documents read   1');
        expect(out).toContain('placement slots  0');
        expect(out).toContain('ALL PASS');
        expect(code).toBe(0);
    });

    it('⛓ a document that will not parse is a FINDING, not a crash', () => {
        const dir = join(root, 'frontend', 'presets', 'alpha', 'AP_1');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'AP_1_rules.json'), '{ not json');
        const { code, out } = run();
        expect(out).toContain('UNREADABLE');
        expect(code).toBe(1);
    });

    it('⛓ --json carries the same answer as data', () => {
        write('alpha', 'AP_1', 'AP_1_rules.json', document({ Nowhere: 'Key' }));
        let raw;
        try {
            raw = execFileSync('node', [GATE, `--tree=${root}`, '--json'], { encoding: 'utf8' });
        } catch (err) {
            raw = err.stdout;
        }
        const parsed = JSON.parse(raw);
        expect(parsed.documents).toBe(1);
        expect(parsed.findings).toHaveLength(1);
        expect(parsed.findings[0]).toMatchObject({ player: '1', location: 'Nowhere' });
    });
});
