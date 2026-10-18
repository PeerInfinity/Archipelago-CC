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
    KEY_ARTIFACT_PREFIX, KEY_EXTRA_FILES, WASM_SUBMODULE, deadFrameFiles, importClosure,
    keyArtifactName, reuseVerdict, tierKey,
} from './fullTierKey.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIFFERENTIAL = join(REPO, 'scripts/procgen/check-seedling-bot-differential.mjs');

describe('tierKey moves with every input', () => {
    const base = { tier: 'full', fingerprint: 'f1',
        tapes: [{ name: 'a', fp: '1' }, { name: 'b', fp: '2' }],
        roster: ['a', 'b', 'c'],
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
            /** ⛓ the re-stamp: a tape deleted OUTSIDE the tier still moves it */
            { ...base, roster: ['a', 'b'] },
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

    it('the extra files exist, and the workflow and the owed gate are among them', () => {
        expect(KEY_EXTRA_FILES).toContain('.github/workflows/seedling-full-tier.yml');
        expect(KEY_EXTRA_FILES).toContain('scripts/procgen/check-seedling-full-tier-owed.mjs');
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

/**
 * ⛓⛓ THE RE-STAMP IS SOUND ONLY WHILE THE KEY COVERS EVERY POPULATION THE OWED
 * GATE READS. (iv) is pinned above; (i)–(iii) are pinned here by the gate's own
 * spellings, so a gate that moves one of them reds this file.
 */
describe('the key covers the owed gate\'s (i) gitlink, (ii) driver and (iii) tapes', () => {
    const owed = readFileSync(join(REPO, 'scripts/procgen/check-seedling-full-tier-owed.mjs'), 'utf8');
    const diff = readFileSync(DIFFERENTIAL, 'utf8');
    const constOf = (name) => new RegExp(`const ${name} = '([^']+)'`).exec(owed)?.[1];

    it('(i) the same submodule', () => expect(constOf('WASM_SUBMODULE')).toBe(WASM_SUBMODULE));
    it('(ii) the driver is hashed into the differential\'s fingerprint', () => {
        const driver = constOf('DRIVER').split('/').pop();
        const fp = diff.slice(diff.indexOf('function modelFingerprint'), diff.indexOf('const FINGERPRINT ='));
        expect(fp).toContain(`'${driver}'`);
    });
    it('(iii) every tier tape is hashed from the gate\'s tape directory', () => {
        const fp = diff.slice(diff.indexOf('function tapeFingerprint'));
        expect(fp).toContain(`'${constOf('TAPES_REL')}'`);
    });
});

describe('reuseVerdict — may a part be stamped AT the head from a reused run?', () => {
    const run = { id: 7, path: '.github/workflows/seedling-full-tier.yml', conclusion: 'success' };
    const artifacts = [{ name: 'tier-merged' }, { name: keyArtifactName('k1') }];

    it('yes, when a key at the head is the one the run banked — and it names the tier', () => {
        expect(reuseVerdict({ run, artifacts, keysAtHead: { campaign: 'k0', full: 'k1' } }))
            .toEqual({ ok: true, tier: 'full', key: 'k1' });
    });
    it('no, BY NAME, when the inputs moved, the run was red, or it measured nothing', () => {
        const no = (o) => {
            const v = reuseVerdict({ run, artifacts, keysAtHead: { full: 'k1' }, ...o });
            expect(v.ok).toBe(false);
            return v.problem;
        };
        expect(no({ keysAtHead: { full: 'k2', campaign: null } })).toMatch(/inputs MOVED/);
        expect(no({ run: { ...run, conclusion: 'failure' } })).toMatch(/only a GREEN tier/);
        expect(no({ artifacts: [{ name: 'tier-merged' }] })).toMatch(/REUSED measured nothing/);
        expect(no({ artifacts: [{ name: keyArtifactName('k1'), expired: true }] }))
            .toMatch(/no unexpired/);
        expect(no({ run: { ...run, path: '.github/workflows/unittests.yml' } }))
            .toMatch(/not a full-tier run/);
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

    /** ⛔ One shard's artifact downloads without its directory and the merge reds. */
    it('the plan refuses fewer than 2 shards before anything is driven', () => {
        const plan = wf.slice(wf.indexOf('  plan:'), wf.indexOf('  shard:\n'));
        const refuse = plan.indexOf('- name: Refuse fewer than 2 shards');
        expect(refuse).toBeGreaterThan(-1);
        expect(refuse).toBeLessThan(plan.indexOf('- name: Checkout repository'));
        expect(plan.slice(refuse)).toMatch(/if \[ "\$SHARDS" -lt 2 \]; then[\s\S]*?exit 1/);
    });

    it('a reuse skips the shards and the merge, and `force` re-drives', () => {
        expect(wf).toMatch(/ {2}shard:\n[\s\S]*?if: needs\.plan\.outputs\.reuse == ''/);
        expect(wf).toMatch(/if: always\(\) && needs\.plan\.result == 'success' && needs\.plan\.outputs\.reuse == ''/);
        expect(wf).toMatch(/ {6}force:\n[\s\S]*?type: boolean\n\s*default: false/);
    });
});
