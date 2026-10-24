// cliRun — the pipeline drivers' exit codes and error classification (§5au item 3).
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import {
    EXIT, InputError, UsageError, outcomeOf, parseOrUsage, readInputJson,
} from './cliRun.js';
import { EnvelopeStampError } from '../../frontend/modules/procgenPipeline/steppedPipeline.js';

describe('cliRun', () => {
    it('the five codes the user ruled (2026-10-18)', () => {
        expect(EXIT).toEqual({ ok: 0, usage: 1, oracle_mismatch: 2, input: 3, internal: 4 });
    });

    it('classifies a thrown error by kind', () => {
        expect(outcomeOf(new UsageError('x'))).toBe('usage');
        expect(outcomeOf(new InputError('x'))).toBe('input');
        expect(outcomeOf(new EnvelopeStampError('x'))).toBe('input');
        expect(outcomeOf(new TypeError('x'))).toBe('internal');
    });

    it('parseOrUsage turns any parser throw into a UsageError, keeping the message', () => {
        expect(() => parseOrUsage(() => { throw new Error('unknown flag: --x'); }))
            .toThrow(UsageError);
        expect(() => parseOrUsage(() => { throw new Error('unknown flag: --x'); }))
            .toThrow('unknown flag: --x');
        expect(parseOrUsage(() => 7)).toBe(7);
    });

    it('readInputJson: missing and non-JSON files are InputErrors naming the flag', () => {
        const dir = mkdtempSync(join(tmpdir(), 'cliRun-'));
        const bad = join(dir, 'bad.json');
        writeFileSync(bad, '{oops');
        expect(() => readInputJson(join(dir, 'nope.json'), '-i')).toThrow(/^-i .*nope\.json: no such file$/);
        expect(() => readInputJson(bad, '--source')).toThrow(InputError);
        expect(() => readInputJson(bad, '--source')).toThrow(/--source .*: not JSON/);
        const good = join(dir, 'good.json');
        writeFileSync(good, '{"a":1}');
        expect(readInputJson(good)).toEqual({ a: 1 });
    });
});
