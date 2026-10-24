/**
 * runCheck — the panel's Check: the trace ⊇ output.txt, and the pixels.
 * The example's expectation is read off the SUBMODULE's own output.txt.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_PIXELS, expectedLines, gradeRun, outputTxtPath } from './runCheck.js';

const BROWSER = join(dirname(fileURLToPath(import.meta.url)), 'browser');
const EX = { name: 'avm2_graphics_runtime', kind: 'graphics' };
const PIX = EXAMPLE_PIXELS.avm2_graphics_runtime;
const good = PIX.map((p) => ({ x: p.at[0], y: p.at[1], rgba: p.rgba }));

describe('runCheck', () => {
    it.skipIf(!existsSync(join(BROWSER, 'catalog.json')))('the S1 example ships an output.txt where the catalog layout puts it', () => {
        const lines = expectedLines(readFileSync(join(BROWSER, outputTxtPath(EX)), 'utf8'));
        expect(lines).toHaveLength(7);
        expect(lines).toContain('bg=ffffff');
        const catalog = JSON.parse(readFileSync(join(BROWSER, 'catalog.json'), 'utf8'));
        expect(catalog.tests.map((t) => t.name)).toContain(EX.name);
    });

    it('PASS: every expected line among the host lines (extra lines allowed) and every pixel exact', () => {
        const g = gradeRun({ expected: ['a=1', 'b=2'], lines: ['[host] boot', 'a=1', 'b=2'], pixels: PIX, readback: good });
        expect(g).toMatchObject({ verdict: 'pass', missing: [], wrongPixels: [] });
        expect(g.text).toBe('Pass: trace 2/2 expected lines, pixels 6/6');
    });

    it('FAIL: a missing line, or a wrong / unread pixel, is named', () => {
        const g = gradeRun({ expected: ['a=1', 'b=2'], lines: ['a=1'], pixels: PIX, readback: [{ rgba: '000000ff' }, ...good.slice(1, 5)] });
        expect(g.verdict).toBe('fail');
        expect(g.missing).toEqual(['b=2']);
        expect(g.wrongPixels.map((p) => p.what)).toEqual(['background', 'gradient end']);
        expect(g.text).toMatch(/background \(5,5\) is 000000ff, not ffffffff; gradient end \(180,140\) is unread/);
    });

    it('NONE: a SWF of your own has no expectation — the trace is reported, not graded', () => {
        expect(gradeRun({ expected: null, lines: ['x'] })).toMatchObject({ verdict: 'none' });
    });

    it('an example with no pixel entry is graded by its trace alone', () => {
        expect(gradeRun({ expected: ['a'], lines: ['a'] })).toMatchObject({ verdict: 'pass', text: 'Pass: trace 1/1 expected lines' });
    });
});
