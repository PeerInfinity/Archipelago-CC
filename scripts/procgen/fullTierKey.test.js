/**
 * fullTierKey — ci-skip-rules RULE 3: a full-tier run whose input key equals a
 * GREEN run's is quoted instead of re-driven. A key that misses an input would
 * quote a run about another tree, so its edges are pinned here.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    KEY_ARTIFACT_PREFIX, KEY_EXTRA_FILES, deadFrameFiles, importClosure, keyArtifactName, tierKey,
} from './fullTierKey.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIFFERENTIAL = join(REPO, 'scripts/procgen/check-seedling-bot-differential.mjs');

describe('tierKey moves with every input', () => {
    const base = { tier: 'full', fingerprint: 'f1',
        tapes: [{ name: 'a', fp: '1' }, { name: 'b', fp: '2' }],
        files: [{ path: 'x.js', bytes: 'one' }] };
    const k = tierKey(base);

    it('is stable, and blind to the ORDER of tapes and files', () => {
        expect(tierKey(base)).toBe(k);
        expect(tierKey({ ...base, tapes: [...base.tapes].reverse() })).toBe(k);
        expect(k).toMatch(/^[0-9a-f]{16}$/);
    });

    it('moves with the tier, the fingerprint, a tape, a file\'s bytes or its path', () => {
        const moved = [
            { ...base, tier: 'gate' },
            { ...base, fingerprint: 'f2' },
            { ...base, tapes: [{ name: 'a', fp: '1' }, { name: 'b', fp: '3' }] },
            { ...base, tapes: [{ name: 'a', fp: '1' }] },
            { ...base, files: [{ path: 'x.js', bytes: 'two' }] },
            { ...base, files: [{ path: 'y.js', bytes: 'one' }] },
        ];
        for (const m of moved) expect(tierKey(m)).not.toBe(k);
    });
});

describe('importClosure — the differential\'s own imports, derived', () => {
    const closure = importClosure(DIFFERENTIAL, { repo: REPO });

    it('follows the `join(REPO|HERE, …)` dynamic imports and the static ones', () => {
        expect(closure).toContain('scripts/procgen/check-seedling-bot-differential.mjs');
        /** the headless channel, a static import */
        expect(closure).toContain('scripts/procgen/seedlingChannel.js');
        /** the model, a `join(REPO, …)` dynamic import */
        expect(closure).toContain('frontend/modules/seedlingDemo/tapeRunner.js');
        /** the partition, a `join(HERE, …)` dynamic import */
        expect(closure).toContain('scripts/procgen/fullTierShards.js');
        /** …and this module, which the differential loads for --tier-key */
        expect(closure).toContain('scripts/procgen/fullTierKey.js');
    });

    it('the extra files exist, and the workflow is one of them', () => {
        expect(KEY_EXTRA_FILES).toContain('.github/workflows/seedling-full-tier.yml');
        for (const f of KEY_EXTRA_FILES) expect(() => readFileSync(join(REPO, f))).not.toThrow();
    });
});

/**
 * ⛔ The key must cover `check-seedling-full-tier-owed`'s (iv), or a reused run
 * quoted into the bank leaves that gate red with no drive allowed. The gate
 * prints the population it derived; this asks for the same list.
 */
describe('the key\'s dead-frame population is the owed gate\'s', () => {
    it('deadFrameFiles equals the list check-seedling-full-tier-owed prints', () => {
        /** ⛓ The gate exits 1 whenever a tier is OWED; its stdout is what is read. */
        const out = spawnSync('node', [join(REPO, 'scripts/procgen/check-seedling-full-tier-owed.mjs')],
            { cwd: REPO, encoding: 'utf8' }).stdout;
        const line = out.split('\n').find((l) => l.includes('the dead-frame line filter'));
        /**
         * ⚠ In CI's depth-1 clone the gate REFUSES before it prints the list
         * (its baseline commit is absent), so this pin is a LOCAL one; the
         * refusal is asserted so that nothing else can hide behind it.
         */
        if (!line) {
            expect(out).toMatch(/REFUSED: this tree cannot be asked/);
            return;
        }
        const printed = line.slice(line.lastIndexOf('`: ') + 3).split(', ').map((f) => f.trim()).sort();
        expect(deadFrameFiles(REPO)).toEqual(printed);
    });
});

/** ⛓ The artifact NAME is the lookup, so the workflow and the module must spell it alike. */
describe('seedling-full-tier.yml banks and looks up the key under one name', () => {
    const wf = readFileSync(join(REPO, '.github/workflows/seedling-full-tier.yml'), 'utf8');

    it('the upload and the lookup both use KEY_ARTIFACT_PREFIX', () => {
        expect(keyArtifactName('abc')).toBe(`${KEY_ARTIFACT_PREFIX}abc`);
        expect(wf).toContain(`name: ${KEY_ARTIFACT_PREFIX}\${{ needs.plan.outputs.key }}`);
        expect(wf).toContain(`actions/artifacts?name=${KEY_ARTIFACT_PREFIX}$KEY`);
    });

    /** ⛔ Only a GREEN tier may bank a key: a red one quoted as a skip hides a FAIL. */
    it('the key is banked only after every shard and the merge succeeded', () => {
        const bank = wf.slice(wf.indexOf('- name: Bank this tier\'s input key'));
        expect(bank).toMatch(/if: success\(\) && needs\.shard\.result == 'success'/);
        const upload = wf.slice(wf.indexOf('- name: Upload the tier key'));
        expect(upload).toMatch(/if: success\(\) && needs\.shard\.result == 'success'/);
    });

    it('a reuse skips the shards and the merge, and `force` re-drives', () => {
        expect(wf).toMatch(/ {2}shard:\n[\s\S]*?if: needs\.plan\.outputs\.reuse == ''/);
        expect(wf).toMatch(/if: always\(\) && needs\.plan\.result == 'success' && needs\.plan\.outputs\.reuse == ''/);
        expect(wf).toMatch(/ {6}force:\n[\s\S]*?type: boolean\n\s*default: false/);
    });
});
