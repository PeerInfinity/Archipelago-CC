/**
 * artifactContentHash — the differential's fingerprint must be the same on
 * every host that holds the same bytes (slice seedling-headless-H3).
 *
 * ⛓ Both directions, because a hash that ignores its input passes the first
 * row and a hash of the stamp passes the second: a TOUCH (mtime only) must
 * move nothing, and ONE FLIPPED BYTE must move it.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { updateWithArtifactFiles } from './artifactContentHash.js';

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
