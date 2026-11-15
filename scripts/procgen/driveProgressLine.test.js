import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { driveProgressLine } from './driveProgressLine.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * ⛓ SEEDLING HAMMER ENDS-MEET-DIGEST — a `--check` digest is md5 of the whole
 * output, so two drives of the same tape that differ only in PAGE PHASE must
 * print the same bytes. The two drives below are the measured pair behind the
 * 4b4cacff/f1675cfc flip: same tape, same observation count, 37 vs 38 dead
 * frames, different wall clocks.
 */
describe('driveProgressLine', () => {
    const driveA = { label: 'a-tape', observations: 62, deadFrames: 37, ms: 6400 };
    const driveB = { label: 'a-tape', observations: 62, deadFrames: 38, ms: 7900 };

    it('--check: two drives differing only in page phase print identical bytes', () => {
        const a = driveProgressLine({ ...driveA, check: true });
        const b = driveProgressLine({ ...driveB, check: true });
        expect(a).toBe(b);
        expect(a).not.toMatch(/dead|\d+s$/);
    });

    it('--check still prints what the tape determines (label, observation count)', () => {
        const line = driveProgressLine({ ...driveA, check: true });
        expect(line).toBe('    drove a-tape: 62 observations');
        expect(driveProgressLine({ ...driveA, observations: 61, check: true })).not.toBe(line);
    });

    it('record path keeps the page-timing readouts as progress', () => {
        expect(driveProgressLine({ ...driveB, check: false }))
            .toBe('    drove a-tape: 62 observations, 38 dead, 8s');
    });

    it('plan-seedling-r7-ends-meet prints its drive line through this helper', () => {
        const src = readFileSync(join(HERE, 'plan-seedling-r7-ends-meet.mjs'), 'utf8');
        expect(src).toContain("from './driveProgressLine.js'");
        expect(src).toMatch(/console\.log\(driveProgressLine\(/);
        // ⛔ no second, inline spelling of the dead-frame count on any path
        expect(src).not.toMatch(/\$\{status\.dead_frames\}/);
    });
});
