/**
 * checkSidecarFields — **THE GATE'S OWN ROWS** (PRESET SIDECARS slice D0).
 *
 * ⛓ The PREDICATE is pinned next door (`procgenCore/sidecarFields.test.js`)
 * and the real declarations in `sidecarFieldsRegistry.test.js`: this file is
 * about what only the script has — which documents it reads (TRACKED ones, and
 * untracked ones only under `--fixtures`), what its FAIL line names, and what
 * it exits with.
 *
 * ⛔ EVERY ROW RUNS AGAINST A TEMP GIT TREE, never against `frontend/presets/`:
 * the corpus's real answer is a MEASUREMENT the slice takes by running the
 * gate, and CI's checkout carries a different population from a working tree
 * with untracked fixture presets. The entry each row plants is a REAL committed
 * one (the multiworld document's first maze region), so the pass row is about
 * the plumbing and not about a payload this file chose to fit.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, 'check-sidecar-fields.mjs');
const REAL = JSON.parse(readFileSync(join(HERE, '..', '..', 'frontend', 'presets', 'multiworld',
    'AP_05594871498841892311', 'AP_05594871498841892311_P1_rules.json'), 'utf8'));
const [REGION, ENTRY] = Object.entries(REAL.preset_sidecars['1'])[0];

describe('check-sidecar-fields — the corpus gate', () => {
    let root;
    const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'd0-sidecar-fields-'));
        git('init', '-q');
    });
    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    /** ⛓ Write a one-entry document at `frontend/presets/<preset>/AP_1/AP_1_rules.json`. */
    const write = (preset, entry, { track = true } = {}) => {
        const rel = join('frontend', 'presets', preset, 'AP_1', 'AP_1_rules.json');
        mkdirSync(dirname(join(root, rel)), { recursive: true });
        writeFileSync(join(root, rel), JSON.stringify({ preset_sidecars: { 1: { [REGION]: entry } } }));
        if (track) git('add', rel);
        return rel;
    };

    /** ⛓ Output AND exit code — an exit code without a summary is not a verdict. */
    const run = (...flags) => {
        try {
            return { code: 0, out: execFileSync('node', [GATE, `--tree=${root}`, ...flags], { encoding: 'utf8' }) };
        } catch (err) {
            return { code: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
        }
    };

    it('a tracked committed entry passes, and the headline derives its counts', () => {
        expect(ENTRY.substrate).toBe('maze');
        write('alpha', ENTRY);
        const { code, out } = run();
        expect(out).toContain('documents read   1 (1 with sidecars)');
        expect(out).toContain('ALL PASS — 1 entries over 1 substrates');
        expect(code).toBe(0);
    });

    it('⛔ an UNDECLARED key FAILs, and the line names file, slot, region, field and cause', () => {
        const rel = write('beta', { ...ENTRY, playable_payload: { ...ENTRY.playable_payload, surprise: 1 } });
        const { code, out } = run();
        expect(out).toContain(`FAIL  ${rel}  slot 1  region ${JSON.stringify(REGION)}  field surprise  `
            + 'UNDECLARED_FIELD');
        expect(out).not.toContain('ALL PASS');
        expect(code).toBe(1);
    });

    it('an UNTRACKED document is out of scope — until `--fixtures` asks for it', () => {
        write('alpha', ENTRY);
        write('gamma', { ...ENTRY, playable_payload: { ...ENTRY.playable_payload, surprise: 1 } },
            { track: false });
        const plain = run();
        expect(plain.out).toContain('documents read   1 ');
        expect(plain.code).toBe(0);
        const fixtures = run('--fixtures');
        expect(fixtures.out).toContain('documents read   2 ');
        expect(fixtures.out).toContain('field surprise  UNDECLARED_FIELD');
        expect(fixtures.code).toBe(1);
    });

    it('a substrate nobody registered is UNREGISTERED — never a skipped entry', () => {
        write('delta', { ...ENTRY, substrate: 'no_such_substrate' });
        const { code, out } = run();
        expect(out).toContain('UNREGISTERED');
        expect(code).toBe(1);
    });
});
