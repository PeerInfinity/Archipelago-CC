/**
 * gateTotal — the rows (slice seedling-headless-F2 task 3).
 *
 * ⛓ Anchored on the READERS, not on this module's own constants (a guard that
 * reads its own default cannot see it move): every line is judged by
 * `standingValues.headlineOf`, and the crash path runs a REAL child process.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkLine, totalLine } from './gateTotal.js';
import { headlineOf } from './standingValues.js';

const HELPER = pathToFileURL(join(import.meta.dirname, 'gateTotal.js')).href;

function runGate(body) {
    const dir = mkdtempSync(join(tmpdir(), 'gate-total-'));
    const f = join(dir, 'check-fixture.mjs');
    writeFileSync(f, `import { checkLine, failOnCrash, totalLine } from '${HELPER}';\n${body}`);
    const r = spawnSync(process.execPath, [f], { encoding: 'utf8' });
    return { exit: r.status, ...headlineOf('gate', `${r.stdout}${r.stderr}`) };
}

describe('gateTotal — what the writer reads', () => {
    it('a green run: N PASS lines and ALL CHECKS PASSED', () => {
        const out = [checkLine(true, 'a'), checkLine(true, 'b'), 'All fixture assertions passed.',
            totalLine(0)].join('\n');
        expect(headlineOf('gate', out)).toEqual({ value: '2/0', total: 'ALL CHECKS PASSED' });
    });

    it('a red run: the FAIL is counted and the total names the count', () => {
        const out = [checkLine(true, 'a'), checkLine(false, 'b'), totalLine(1)].join('\n');
        expect(headlineOf('gate', out)).toEqual({ value: '1/1', total: '1 CHECK(S) FAILED' });
        expect(headlineOf('gate', totalLine(3)).total).toBe('3 CHECK(S) FAILED');
    });

    it('⛔ the forms these gates printed before are NOT totals to the reader', () => {
        for (const old of ['All atlas sphere round-trip assertions passed.',
            'VERIFY CLI SPHERE CONFIG: ALL OK', '✅ ALL PASS', 'check-ta-mana-leg: ALL PASS',
            'PASS — bounce embed', 'VERIFY ITEM CHANNELS: OK', '❌ 2 FAILURE(S)']) {
            expect(headlineOf('gate', old).total).toBeNull();
        }
    });
});

describe('failOnCrash — a throw is one failed check, on a real process', () => {
    it('a top-level throw after two passes reads 2/1 · 1 CHECK(S) FAILED, exit 1', () => {
        expect(runGate(`failOnCrash();\nconsole.log(checkLine(true, 'a'));\n`
            + `console.log(checkLine(true, 'b'));\nthrow new Error('boom');\n`))
            .toEqual({ exit: 1, value: '2/1', total: '1 CHECK(S) FAILED' });
    });

    it('a rejected top-level await is caught the same way', () => {
        expect(runGate(`failOnCrash();\nawait Promise.reject(new Error('rej'));\n`))
            .toEqual({ exit: 1, value: '0/1', total: '1 CHECK(S) FAILED' });
    });

    it('a counting gate that had already failed reports its own failures + 1', () => {
        expect(runGate(`let failures = 0;\nfailOnCrash(() => failures);\n`
            + `console.log(checkLine(false, 'x')); failures++;\nthrow new Error('late');\n`))
            .toEqual({ exit: 1, value: '0/2', total: '2 CHECK(S) FAILED' });
    });

    it('a green gate is untouched by the handler', () => {
        expect(runGate(`failOnCrash();\nconsole.log(checkLine(true, 'a'));\nconsole.log(totalLine(0));\n`))
            .toEqual({ exit: 0, value: '1/0', total: 'ALL CHECKS PASSED' });
    });
});
