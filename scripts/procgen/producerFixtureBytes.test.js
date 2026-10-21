import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkFixtureBytes, emitFixtures } from './producerFixtureBytes.js';

const dir = mkdtempSync(join(tmpdir(), 'producer-bytes-'));
const lines = () => console.log.mock.calls.map((c) => c[0]);

afterEach(() => vi.restoreAllMocks());

describe('checkFixtureBytes', () => {
    it('is `same` on identical bytes and DIFFERS on one changed byte', () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const p = join(dir, 'a-tape.json');
        writeFileSync(p, '{"x":1}\n');
        expect(checkFixtureBytes(p, '{"x":1}\n')).toBe(true);
        expect(checkFixtureBytes(p, '{"x":2}\n')).toBe(false);
        expect(lines()).toEqual([
            'same a-tape: 8 bytes',
            'DIFFERS a-tape: 8 bytes committed vs 8 derived — re-run with --write',
        ]);
    });

    it('names a missing file', () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        expect(checkFixtureBytes(join(dir, 'absent.json'), '{}')).toBe(false);
        expect(lines()[0]).toMatch(/^DIFFERS absent: the file does not exist/);
    });
});

describe('emitFixtures', () => {
    it('checks EVERY output before exiting 1, and writes nothing under --check', () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
        const p1 = join(dir, 'b1.json');
        const p2 = join(dir, 'b2.json');
        writeFileSync(p1, 'old');
        writeFileSync(p2, 'same');
        emitFixtures([{ path: p1, text: 'new' }, { path: p2, text: 'same' }], { check: true });
        expect(exit).toHaveBeenCalledWith(1);
        expect(lines().filter(Boolean)).toEqual([
            'DIFFERS b1: 3 bytes committed vs 3 derived — re-run with --write',
            'same b2: 4 bytes',
        ]);
        expect(readFileSync(p1, 'utf8')).toBe('old');
    });

    it('writes under --write and is a no-op (false) otherwise', () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const p = join(dir, 'c.json');
        expect(emitFixtures([{ path: p, text: 'w' }], {})).toBe(false);
        expect(emitFixtures([{ path: p, text: 'w' }], { write: true })).toBe(true);
        expect(readFileSync(p, 'utf8')).toBe('w');
    });
});
