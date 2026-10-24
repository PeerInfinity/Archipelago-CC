/**
 * `md5.js` against `node:crypto` — the test is the only place node's own md5
 * is allowed, because the module under test must run in a page.
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { md5 } from './md5.js';

const nodeMd5 = (s) => createHash('md5').update(s).digest('hex');

describe('md5 — the dependency-free RFC 1321 digest', () => {
    const vectors = [
        ['', 'd41d8cd98f00b204e9800998ecf8427e'],
        ['abc', '900150983cd24fb0d6963f7d28e17f72'],
        ['The quick brown fox jumps over the lazy dog', '9e107d9d372bb6826bd81d3542a419d6'],
        // 1,000 bytes: fifteen full blocks plus a tail, so the padding spills into a 17th block
        [Array.from({ length: 1000 }, (_, i) => String.fromCharCode(33 + (i % 94))).join(''), null],
    ];
    for (const [s, known] of vectors) {
        it(`${s.length} byte(s) ${JSON.stringify(s.slice(0, 16))}… agrees with node:crypto${known ? ' and the published digest' : ''}`, () => {
            expect(md5(s)).toBe(nodeMd5(s));
            if (known) expect(md5(s)).toBe(known);
        });
    }

    it('every length 0..130 agrees (every padding boundary: 55, 56, 63, 64, 119, 120)', () => {
        for (let n = 0; n <= 130; n++) {
            const s = 'a'.repeat(n);
            expect(md5(s), `length ${n}`).toBe(nodeMd5(s));
        }
    });

    it('hashes a string as UTF-8, as node does', () => {
        const s = 'é ☃ 𝄞';
        expect(md5(s)).toBe(nodeMd5(Buffer.from(s, 'utf8')));
    });
});
