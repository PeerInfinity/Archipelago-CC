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
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
 * banner is printed ${BANNER_DELAY_MS} ms into the import, the short ceiling is
 * ${SHORT_CEILING_MS} ms, so the parent's kill timer would have to fire
 * ${BANNER_DELAY_MS - SHORT_CEILING_MS} ms LATE for the killed prefix to contain
 * the banner. Load can only push the banner later.
 */
const runGate = (dir, args, { short = SHORT_CEILING_MS, long = LONG_CEILING_MS } = {}) =>
    spawnSync(process.execPath,
        [join(dir, 'scripts/procgen', GATE), '--in-place', `--only=${INSTRUMENT}`, '--jobs=1',
            `--known-ceiling=${short}`, `--ceiling=${long}`, ...args],
        { cwd: dir, env: ENV, encoding: 'utf8' });
/** The entry the writer recorded for the fixture instrument. */
const entryOf = (dir) => JSON.parse(baselineOf(dir)).importDoorEffectful[INSTRUMENT];
/** ⛓ The mutant of task 2: the writer that does NOT complete the control. */
const NO_RERUN = [GATE, "const killed = instruments.filter((f) => byDoor.get(`import:${f}`)?.timedOut);",
    'const killed = [];'];
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

describe('the writer completes a killed import door\'s control', () => {
    it('two `--write-baseline` runs record the late banner and write the SAME BYTES', () => {
        const dir = fixtureRepo();
        const first = runGate(dir, ['--write-baseline']);
        expect(first.status).toBe(0);
        const a = baselineOf(dir);
        expect(entryOf(dir).inheritedOutput).toEqual([BANNER]);
        /** ⛓ the writer says what it re-ran, so the cost is in the log. */
        expect(first.stdout).toContain('re-ran 1 killed import door(s) under the '
            + `${LONG_CEILING_MS} ms ceiling to complete the control (0 still truncated)`);
        const second = runGate(dir, ['--write-baseline']);
        expect(second.status).toBe(0);
        expect(md5(baselineOf(dir))).toBe(md5(a));
    }, 60000);

    it('⛔ NOT THE SEED: with `inheritedOutput` seeded EMPTY the FIRST write records the banner anyway', () => {
        /**
         * ⛓ The vacuity objection this row exists for: the written field could
         * have been copied from the baseline already on disk. It is not read —
         * `inheritedOf` intersects the two doors of the CURRENT run — and with
         * the seed empty the banner can only have come from the control re-run,
         * because the judged import door was killed 1.5 s before it printed.
         */
        const dir = fixtureRepo({ inherited: [] });
        expect(runGate(dir, ['--write-baseline']).status).toBe(0);
        expect(entryOf(dir).inheritedOutput).toEqual([BANNER]);
    }, 60000);

    it('⛔ MUTANT + THE FALSE RED: the un-completed control records nothing, and `--doors=ci` reds the help door for it', () => {
        const mutant = fixtureRepo({ patch: [NO_RERUN] });
        const w = runGate(mutant, ['--write-baseline']);
        expect(w.status).toBe(0);
        /** ⛔ DETERMINISTIC, not "on a loaded box": the prefix cannot hold a
         *  line printed 1.5 s after the kill, on any box, at any load. */
        expect(entryOf(mutant).inheritedOutput).toEqual([]);
        expect(w.stdout).not.toContain('re-ran');
        /**
         * ⛔⛔ AND THIS IS THE COST OF THE MISSING CONTROL, IN CI'S OWN FACE.
         * `--doors=ci` does not run a baselined file's import door, so the
         * recorded set is the ONLY control: with the banner missing from it the
         * help door's own stdout no longer equals the derived help text and the
         * row reds — for a line no guard in the importer can preempt.
         */
        const red = runGate(mutant, ['--doors=ci']);
        expect(red.status).toBe(1);
        expect(red.stdout).toContain('stdout is NOT the derived help text');
        /** ⛓ THE SAME HELP DOOR, judged against the completed control: green. */
        const fixed = fixtureRepo();
        expect(runGate(fixed, ['--write-baseline']).status).toBe(0);
        const green = runGate(fixed, ['--doors=ci']);
        expect(green.status).toBe(0);
        expect(green.stdout).toContain('ALL PASS');
    }, 60000);

    it('a control killed at the LONG ceiling too is named as truncated, not silently recorded', () => {
        /** ⛓ 15 s of work is not load, so the writer says which file it could
         *  not complete rather than writing an intersection against a prefix
         *  under a rule that claims otherwise. */
        const dir = fixtureRepo();
        const r = runGate(dir, ['--write-baseline'], { short: 300, long: 1000 });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain(`## ⚠ control truncated at 1000 ms — ${INSTRUMENT}:`);
        expect(r.stdout).toContain('(1 still truncated)');
        expect(entryOf(dir).inheritedOutput).toEqual([]);
    }, 60000);
});

/**
 * ⛓ THE SCRATCH LEAK (found by H1, closed here). This gate is on its own
 * import-door baseline, so a full run imports itself in a child that runs the
 * whole gate — a chain SIGKILLed at the ceiling, each link's scratch leaked
 * (~5 per full run). A child that finds `PROCGEN_HELP_SCRATCH_PARENT` takes
 * its scratch INSIDE that directory, which the top-level run removes. The row
 * kills a gate child itself, since a finished gate removes its scratch either
 * way and would make the mutant look green.
 */
describe('a gate child killed mid-run leaves its scratch under the PARENT scratch, never under TMPDIR', () => {
    const killedGate = (dir, env) => spawnSync(process.execPath,
        [join(dir, 'scripts/procgen', GATE), '--in-place', `--only=${INSTRUMENT}`, '--jobs=1',
            '--known-ceiling=4000', '--ceiling=6000', '--json'],
        { cwd: dir, env: { ...ENV, ...env }, encoding: 'utf8', timeout: 1500, killSignal: 'SIGKILL' });
    const scratchDirs = (d) => (existsSync(d) ? readdirSync(d) : []).filter((n) => n.startsWith('procgen-help-'));
    const fresh = () => { const d = mkdtempSync(join(tmpdir(), 'leak-row-')); roots.push(d); return d; };

    it('the child honours the parent env: TMPDIR stays clean, the parent dir holds the scratch', () => {
        const dir = fixtureRepo();
        const tmp = fresh(); const parent = fresh();
        const r = killedGate(dir, { TMPDIR: tmp, PROCGEN_HELP_SCRATCH_PARENT: parent });
        expect(r.signal).toBe('SIGKILL');
        expect(scratchDirs(tmp)).toEqual([]);
        expect(scratchDirs(parent).length).toBe(1);
    }, 30000);

    it('⛔ NOT VACUOUS: without the env the killed child leaks under TMPDIR (the pre-fix shape)', () => {
        const dir = fixtureRepo();
        const tmp = fresh();
        const r = killedGate(dir, { TMPDIR: tmp });
        expect(r.signal).toBe('SIGKILL');
        expect(scratchDirs(tmp).length).toBe(1);
    }, 30000);
});
