/**
 * artifactContentHash — the differential's fingerprint must be the same on
 * every host that holds the same bytes (slice seedling-headless-H3).
 *
 * ⛓ Both directions, because a hash that ignores its input passes the first
 * row and a hash of the stamp passes the second: a TOUCH (mtime only) must
 * move nothing, and ONE FLIPPED BYTE must move it.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { updateWithArtifactFiles, updateWithModuleDir } from './artifactContentHash.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = ['game.html', 'payload.wasm'];

const digest = (dir) => updateWithArtifactFiles(createHash('sha256'), dir, FILES).digest('hex');

describe('updateWithArtifactFiles hashes CONTENT, never the stamp', () => {
    let dir;
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'artifact-hash-'));
        writeFileSync(join(dir, 'game.html'), '<script src="payload.js"></script>');
        writeFileSync(join(dir, 'payload.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('a touch (mtime only, as actions/checkout does) leaves the hash unchanged', () => {
        const before = digest(dir);
        const later = new Date(Date.now() + 86_400_000);
        for (const f of FILES) utimesSync(join(dir, f), later, later);
        expect(digest(dir)).toBe(before);
    });

    it('one flipped byte in the payload changes the hash', () => {
        const before = digest(dir);
        const p = join(dir, 'payload.wasm');
        const bytes = readFileSync(p);
        bytes[4] ^= 1;
        writeFileSync(p, bytes);
        expect(digest(dir)).not.toBe(before);
    });

    it('an absent file contributes nothing (the caller decides SKIP)', () => {
        const only = updateWithArtifactFiles(createHash('sha256'), dir, ['game.html']).digest('hex');
        rmSync(join(dir, 'payload.wasm'));
        expect(digest(dir)).toBe(only);
    });

    it('the differential spends this helper and reads no mtime into its fingerprint', () => {
        const src = readFileSync(join(HERE, 'check-seedling-bot-differential.mjs'), 'utf8');
        expect(src).toMatch(/updateWithArtifactFiles\(h, ARTIFACT, \['game\.html', `\$\{PAGE_BASE\}\.wasm`\]\)/);
        // ⚠ CODE, not prose: the docblock names the retired `size:mtimeMs` on purpose.
        expect(src).not.toMatch(/\.mtimeMs\b|statSync\(/);
    });
});

/**
 * ⛓⛓ F1 — **`seedlingDemo/fixtures/*.js` JOIN THE FINGERPRINT.** The tier and
 * roster definitions decide which tapes a tier holds; a byte there must
 * invalidate a stored PASS, and a touch must not.
 */
describe('updateWithModuleDir — the model half, by name and content', () => {
    let dir;
    const fp = (d) => {
        const h = createHash('sha256');
        updateWithModuleDir(h, d);
        updateWithModuleDir(h, join(d, 'fixtures'), { prefix: 'fixtures/' });
        return h.digest('hex');
    };
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'module-dir-hash-'));
        mkdirSync(join(dir, 'fixtures'));
        writeFileSync(join(dir, 'index.js'), 'export const a = 1;\n');
        writeFileSync(join(dir, 'fixtures', 'index.js'), 'export const b = 2;\n');
        writeFileSync(join(dir, 'fixtures', 'tiers.js'), 'export const TIERS = [];\n');
        writeFileSync(join(dir, 'fixtures', 'tape.json'), '{}');
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('one byte in fixtures/tiers.js moves it; a touch does not; a non-.js file is not read', () => {
        const before = fp(dir);
        const later = new Date(Date.now() + 86_400_000);
        utimesSync(join(dir, 'fixtures', 'tiers.js'), later, later);
        writeFileSync(join(dir, 'fixtures', 'tape.json'), '{"moved": true}');
        expect(fp(dir)).toBe(before);
        writeFileSync(join(dir, 'fixtures', 'tiers.js'), 'export const TIERS = [1];\n');
        expect(fp(dir)).not.toBe(before);
    });

    it('the prefix keeps a same-named file in the two directories from aliasing', () => {
        const swapped = fp(dir);
        writeFileSync(join(dir, 'index.js'), 'export const b = 2;\n');
        writeFileSync(join(dir, 'fixtures', 'index.js'), 'export const a = 1;\n');
        expect(fp(dir)).not.toBe(swapped);
    });

    it('the unprefixed pass feeds exactly what the pre-F1 loop fed (name, then bytes)', () => {
        const old = createHash('sha256');
        old.update('index.js');
        old.update(readFileSync(join(dir, 'index.js')));
        expect(updateWithModuleDir(createHash('sha256'), dir).digest('hex')).toBe(old.digest('hex'));
    });

    it('the differential hashes BOTH directories through this helper', () => {
        const src = readFileSync(join(HERE, 'check-seedling-bot-differential.mjs'), 'utf8');
        expect(src).toMatch(/updateWithModuleDir\(h, moduleDir\);/);
        expect(src).toMatch(/updateWithModuleDir\(h, join\(moduleDir, 'fixtures'\), \{ prefix: 'fixtures\/' \}\);/);
    });
});

