/**
 * check-procgen-help — **THE ROWS, ON A FIXTURE REPOSITORY WHOSE INSTRUMENT'S
 * BANNER PRINTS AFTER THE SHORT CEILING** (slice seedling-headless-H1).
 *
 * ⛔ THE DEFECT THESE ROWS ARE ABOUT (G1 ⚖ OPEN 3). A baselined file's IMPORT
 * door runs under `--known-ceiling` (5,000 ms on the real tree) and is KILLED
 * there by design, so its captured output is a PREFIX cut wherever the box
 * was. That output is the CONTROL the baseline records as `inheritedOutput`,
 * and under `--doors=ci` — CI's face for a baselined file — it is the ONLY
 * control the help door has. A box loaded enough to kill the import door
 * BEFORE the line a hoisted module prints at LOAD therefore writes a SMALLER
 * control, and the next run attributes that module's banner to the help door:
 * a FALSE RED, from load alone.
 *
 * ⛓⛓ WHY THE FIXTURE INSTRUMENT SLEEPS FIRST, AND WHY THAT IS THE WHOLE
 * POINT. A margin is measured, never assumed: a fixture whose banner prints
 * immediately would reproduce the defect only on a box that happened to be
 * busy, i.e. "sometimes", which is not a row. Here the banner is printed by an
 * imported module AFTER a delay LONGER than the short ceiling, so the killed
 * prefix has NO banner on every box, at any load — load can only make it
 * later, never earlier. The unfixed writer is red deterministically and the fix
 * is green deterministically.
 *
 * ⛓ HOW THE GATE IS DRIVEN, since it takes no `--repo=`: its own import
 * closure (DERIVED, not listed) is copied into a one-commit scratch repository
 * beside a fixture instrument, and it is run there with `--in-place --only=`.
 * `REPO` is `<the gate's own directory>/../..` and `BASELINE_FILE` is resolved
 * beside the gate, so a copy in a scratch tree reads and writes THAT tree's
 * baseline — which is what makes a `--write-baseline` row possible at all. It
 * also means the rows drive the WORKING TREE's gate, not HEAD's (trap 1367 is
 * about the real tree's own run, which measures a worktree at HEAD).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = 'check-procgen-help.mjs';

/** ⛓ The banner's delay and the two ceilings — the margin, written once. */
const BANNER_DELAY_MS = 2000;
const SHORT_CEILING_MS = 500;
const LONG_CEILING_MS = 20000;
const BANNER = '[fixtureBanner] printed at LOAD, after the short ceiling';
const INSTRUMENT = 'fixture-slow-banner.mjs';

const ID = ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false'];
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const git = (cwd, ...args) => execFileSync('git', [...ID, ...args],
    { cwd, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const md5 = (t) => createHash('md5').update(t).digest('hex').slice(0, 12);

const roots = [];
afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });

/**
 * ⛔ THE CLOSURE IS DERIVED FROM THE SOURCES, NEVER LISTED. A hand list would
 * go stale the day the gate imports one more module, and the failure would be
 * a `MODULE_NOT_FOUND` inside a child — a fixture defect wearing a gate
 * finding. A specifier that does not resolve is a REFUSAL by name here.
 */
function closureOf(entry) {
    const seen = new Set();
    const walk = (abs) => {
        if (seen.has(abs)) return;
        seen.add(abs);
        const src = readFileSync(abs, 'utf8');
        for (const m of [...src.matchAll(/(?:from|import)\s+'(\.[^']+)'/g)]) {
            const next = resolve(dirname(abs), m[1]);
            try { readFileSync(next); } catch {
                throw new Error(`checkProcgenHelp fixture: ${relative(HERE, abs)} imports `
                    + `${m[1]}, which does not resolve to a file (${next})`);
            }
            walk(next);
        }
    };
    walk(join(HERE, entry));
    return [...seen].map((abs) => relative(HERE, abs));
}

/** The fixture instrument, and the module whose LOAD prints the banner late. */
const BANNER_MODULE = `/* A module whose LOAD prints AFTER the short ceiling — the hoisted
 * shape no guard in the importer can preempt. */
await new Promise((r) => setTimeout(r, ${BANNER_DELAY_MS}));
console.log(${JSON.stringify(BANNER)});
`;
const INSTRUMENT_SOURCE = `/**
 * fixture-slow-banner — a fixture instrument whose imported module banners late.
 *
 * Run: node scripts/procgen/${INSTRUMENT}
 */
import { argvHelp } from './argvHelp.js';
import './fixtureBanner.js';

argvHelp(import.meta.url);

console.log('# FIXTURE REPORT');
console.log('module scope did work on a bare import');
`;

/**
 * A one-commit scratch repository holding the gate's closure, the fixture
 * instrument, and a baseline that already NAMES it.
 *
 * @param {object} [o]
 * @param {[string, string][]} [o.patch]  `[file, from, to]` triples applied to
 *   the COPIES — the mutants. Each `from` must occur exactly once.
 * @param {string[]} [o.inherited]  the seeded entry's `inheritedOutput`.
 */
function fixtureRepo({ patch = [], inherited = [BANNER] } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'help-gate-fixture-'));
    roots.push(dir);
    const procgen = join(dir, 'scripts/procgen');
    mkdirSync(join(procgen, 'reference'), { recursive: true });
    const patched = new Map(patch.map(([file, from, to]) => [file, [from, to]]));
    for (const rel of closureOf(GATE)) {
        const to = join(procgen, rel);
        if (!patched.has(rel)) { copyFileSync(join(HERE, rel), to); continue; }
        const [from, into] = patched.get(rel);
        const src = readFileSync(join(HERE, rel), 'utf8');
        const hits = src.split(from).length - 1;
        if (hits !== 1) {
            throw new Error(`checkProcgenHelp fixture: the mutant's anchor occurs ${hits} `
                + `time(s) in ${rel} — a splice anchor must be UNIQUE: ${from}`);
        }
        writeFileSync(to, src.replace(from, into));
    }
    for (const [name, src] of [['fixtureBanner.js', BANNER_MODULE],
        [INSTRUMENT, INSTRUMENT_SOURCE]]) writeFileSync(join(procgen, name), src);
    /**
     * ⛔ `"type": "module"`, OR THE COPIED `.js` MODULES ARE COMMONJS. Measured
     * building this fixture: without it the gate's very first import died with
     * *"Named export 'argvHelp' not found. The requested module './argvHelp.js'
     * is a CommonJS module"* — the real tree's `.js` files are ESM only because
     * the ROOT `package.json` says so, which a scratch repository does not
     * inherit from the tree its files were copied out of.
     */
    writeFileSync(join(dir, 'package.json'),
        `${JSON.stringify({ name: 'help-gate-fixture', private: true, type: 'module' }, null, 2)}\n`);
    writeFileSync(join(procgen, 'check-procgen-help.baseline.json'), `${JSON.stringify({
        note: 'FIXTURE',
        measuredAt: 'fixture',
        counts: { instruments: 1, importDoorEffectful: 1 },
        importDoorEffectful: { [INSTRUMENT]: { inheritedOutput: inherited, helpResidue: null } },
    }, null, 2)}\n`);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'fixture');
    return dir;
}

/**
 * The gate, run in its own copy, against the fixture instrument alone.
 *
 * ⛓ THE CEILINGS ARE THE MARGIN, AND IT IS MEASURED RATHER THAN ASSUMED: the
 * banner is printed 2000 ms into the import and the short ceiling is 500 ms, so
 * the parent's kill timer would have to fire 1500 ms LATE for the killed prefix
 * to contain the banner. Load can only push the banner later.
 */
const runGate = (dir, args) => spawnSync(process.execPath,
    [join(dir, 'scripts/procgen', GATE), '--in-place', `--only=${INSTRUMENT}`, '--jobs=1',
        `--known-ceiling=${SHORT_CEILING_MS}`, `--ceiling=${LONG_CEILING_MS}`, ...args],
    { cwd: dir, env: ENV, encoding: 'utf8' });
const baselineOf = (dir) => readFileSync(
    join(dir, 'scripts/procgen/check-procgen-help.baseline.json'), 'utf8');
const rowsOf = (r) => JSON.parse(r.stdout);

describe('the door result carries the KILL as a fact', () => {
    it('an import door killed at the short ceiling reports timedOut + the ceiling that killed it', () => {
        const r = runGate(fixtureRepo(), ['--json']);
        expect(r.status).toBe(0);
        const [row] = rowsOf(r);
        expect(row.file).toBe(INSTRUMENT);
        /** ⛓ the import door: KILLED at the short ceiling, so its stdout is a
         *  prefix with no banner in it — the defect, in one assertion. */
        expect(row.import.timedOut).toBe(true);
        expect(row.import.ceiling).toBe(SHORT_CEILING_MS);
        expect(row.import.stdout).toBe('');
        /** ⛓ and the help door, under the LONG ceiling, was not killed and did
         *  print the banner — so the two doors disagree about the banner. */
        expect(row.help.timedOut).toBe(false);
        expect(row.help.ceiling).toBe(LONG_CEILING_MS);
        expect(row.help.stdout).toContain(BANNER);
    }, 60000);

    it('⛔ MUTANT: with `timedOut` off the result, the killed door is indistinguishable from a clean exit', () => {
        const dir = fixtureRepo({ patch: [[GATE, '        timedOut: r.timedOut,\n', '']] });
        const [row] = rowsOf(runGate(dir, ['--json']));
        expect(row.import.timedOut).toBeUndefined();
    }, 60000);
});
