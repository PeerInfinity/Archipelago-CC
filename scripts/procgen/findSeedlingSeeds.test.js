/**
 * scripts/procgen/find-seedling-seeds — **THE `--where=` GRAMMAR** (PROCGEN
 * ELEMENTS arc 3, slice 4d, D4).
 *
 * ⛓ DRIVEN THROUGH THE REAL CLI, in a child process, because the parser's whole
 * contract is *"a malformed question exits 2 and says why"* — an exit code and a
 * stderr line are not things an imported function has. The rows stop before any
 * generation, so the file is fast.
 *
 * ⛔ THE CLAIM THIS GUARDS is that an unknown property is REFUSED rather than
 * matched against nothing. A filter nobody validated answers "0 hits" for a
 * typo, and 0 hits is a shape this instrument uses to report a real absence —
 * the two must not be spellable the same way.
 */

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..'));
const SCRIPT = join(HERE, 'find-seedling-seeds.mjs');

/** Runs the CLI and returns `{status, stderr}` — never throws on a non-zero exit. */
function run(args) {
    try {
        execFileSync('node', [SCRIPT, ...args],
            { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return { status: 0, stderr: '' };
    } catch (e) {
        return { status: e.status ?? -1, stderr: String(e.stderr ?? '') };
    }
}

describe('the --where= vocabulary', () => {
    it('⛔ an UNKNOWN property is a USAGE ERROR (exit 2) that names the vocabulary', () => {
        const r = run(['--seeds=1-1', '--where=certfied']);
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/"certfied" is not a property this instrument measures/);
        expect(r.stderr).toMatch(/certified/);
        expect(r.stderr).toMatch(/reads like a measurement/);
    });

    it('an EMPTY --where= is refused, and names the vocabulary', () => {
        const r = run(['--seeds=1-1', '--where=']);
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/an EMPTY --where=/);
    });

    it('an empty CLAUSE is refused', () => {
        const r = run(['--seeds=1-1', '--where=certified,']);
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/EMPTY clause/);
    });

    it('a FLAG given a value, and a VALUE property given none, are each refused by name', () => {
        expect(run(['--seeds=1-1', '--where=certified=yes']).stderr)
            .toMatch(/"certified" takes no value/);
        expect(run(['--seeds=1-1', '--where=cause']).stderr).toMatch(/"cause" needs a value/);
    });

    it('a >= on a property that is not a comparison is refused', () => {
        expect(run(['--seeds=1-1', '--where=certified>=2']).stderr)
            .toMatch(/"certified" is not a >= comparison/);
    });

    it('⛓⛓ `grade=` WITHOUT `--require=` is refused — a grade is a property of a DIRECTIVE',
        () => {
            const r = run(['--seeds=1-1', '--where=grade=STRONG']);
            expect(r.status).toBe(2);
            expect(r.stderr).toMatch(/there is nothing to grade/);
        });

    it('⛓ `areas-accepted` at --areas=0 is refused — the module does not run at all', () => {
        const r = run(['--seeds=1-1', '--where=areas-accepted']);
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/the area module does not run at all/);
    });

    it('a biome the generator does not have is refused before any search', () => {
        const r = run(['--seeds=1-1', '--where=certified', '--biome=mid-sword']);
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/not a Seedling biome/);
    });
});
