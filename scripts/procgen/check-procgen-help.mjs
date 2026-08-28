#!/usr/bin/env node
/**
 * check-procgen-help — **`--help` PRINTS AND EXITS ON EVERY INSTRUMENT, AND
 * SO DOES A BARE IMPORT** (R9 slice P4a, ⚖ ruling 47b (4); user, 2026-08-28:
 * *"check if there are other ways that these commands are called, other than
 * with the help parameter, that we might want to add protection for"*).
 *
 * ── ⛔⛔⛔ WHAT THIS MEASURED BEFORE THE FIX, AT `1097be9e6` ──────────
 *
 * Spawning `--help` on all 260 instruments, each in a child with a temp
 * `XDG_CACHE_HOME` and a `git status --porcelain` observer around it:
 *
 *   · one instrument WROTE A 148 KB FILE NAMED `--help` into the repository
 *     root — argv[2] read as an output path;
 *   · one REWROTE A TRACKED SOURCE FILE
 *     (`frontend/modules/seedlingDemo/seedlingDamageSites.js`);
 *   · three producers TOOK THE REAL BOX LOCK before parsing anything;
 *   · dozens ran to a wall-clock timeout, i.e. did the whole job.
 *
 * ── ⛓⛓ WHY THERE ARE TWO DOORS AND NOT ONE ──────────────────────────
 *
 * `--help` is not the only way an instrument's module scope runs. **37 test
 * files import from `scripts/procgen/`**, so module-scope work runs inside
 * the vitest process, in CI — and could take the box there. A file whose
 * import is inert and whose `--help` is inert closes both doors at once, so
 * the gate asks both and prints them as two columns of one row:
 *
 *   HELP    `node <instrument> --help`
 *   IMPORT  `node --input-type=module -e "await import(<instrument>)"`
 *
 * ⛔ THE IMPORT DOOR IS NOT A SUBSET OF THE HELP DOOR, AND THAT IS THE POINT.
 * ESM imports are HOISTED, so a guard at the top of a file's BODY preempts
 * that file's own module scope and never its dependencies'. An instrument can
 * therefore print help correctly while its import still solves a chain — the
 * hoisting case, which is what mutant (m6) exists to show.
 *
 * ── WHAT COUNTS AS A SIDE EFFECT ─────────────────────────────────────
 *
 * `strace` is not available on this box, so the observers are the ones a
 * child cannot hide from:
 *
 *   · `git status --porcelain` over the repo, before and after — a tracked
 *     edit OR an untracked new file both show;
 *   · every file under the repo newer than a marker touched at launch
 *     (`.git`, `node_modules` excluded), which also catches a gitignored
 *     write the porcelain cannot see;
 *   · the child's own `XDG_CACHE_HOME`, which must come back EMPTY — a
 *     browser profile, a latch cache or a box lock all land there;
 *   · exit code 0 and an empty stderr;
 *   · a wall clock, REPORTED for every row and asserted against a ceiling.
 *
 * ⚠ THE CEILING IS A PROXY AND SAYS SO. A legitimate `--help` still pays for
 * its file's hoisted imports, which for an instrument that imports the solver
 * is seconds. So the ceiling is set where "it actually drove something"
 * lives, not where "it started up" does, and the four observers above are the
 * real assertions.
 *
 * ⛔ THIS GATE TAKES NO BOX. It is headless and drives nothing itself; its
 * children get a temp cache, so a lock any of them takes is isolated from the
 * real one — which is also how that lock becomes VISIBLE as a finding.
 *
 * ── ⛓ WHAT IT COSTS, AND WHY THE RUNNER LOOKS LIKE THIS ─────────────
 *
 * `ci-gates.mjs` runs EVERY headless gate on every push, so a gate that takes
 * half an hour is a gate somebody switches off. The first cut was serial with
 * one `git status` + one repo-wide mtime sweep PER DOOR and a uniform
 * 12-second ceiling: **10 rows in seven minutes**, i.e. hours for the roster.
 *
 * Three measured changes, in order of what they bought:
 *
 *   · **THE OBSERVERS ARE PER BATCH, NOT PER DOOR.** The porcelain and the
 *     mtime sweep are the expensive pair and the interesting answer is almost
 *     always *"nothing moved"*. So a batch runs, ONE pair of observers is
 *     taken around it, and if the batch is clean every door in it is clean on
 *     that observer — proved for all of them at once. A batch that DID move
 *     is re-run SERIALLY, which is the only way to say WHICH door moved it.
 *   · **BOUNDED CONCURRENCY.** Each child gets its own temp cache, so nothing
 *     they contend for is shared; only the two per-batch observers need the
 *     batch to be quiet, and they are taken outside it.
 *   · **TWO CEILINGS — AND THE WALL CLOCK IS A KILL DEADLINE, NOT A
 *     VERDICT.** ⛔⛔ THE FIRST CUT MADE IT A VERDICT AND CONCURRENCY BROKE
 *     IT. The inert population was measured at p50 271 ms, p90 891 ms, MAX
 *     1,410 ms — **serially** — and a 5,000 ms ceiling looked like a 3.5×
 *     margin. Run six at a time, three files that the serial census clocked
 *     at ~2 s were killed at 5,000 ms and filed as module-scope workers.
 *     **The instrument added to make the gate cheap moved the very quantity
 *     the threshold was calibrated on.** So the verdict is the OBSERVERS —
 *     exit code, cache, porcelain, mtime, stderr, and the stdout identity —
 *     and the clock only decides when to stop waiting, set far above where a
 *     slow-but-inert import lands. A run that never finished is still a
 *     finding, because at this deadline "did not finish" means it was doing
 *     something.
 *   · **AND THE SHORT CEILING IS THE *IMPORT* DOOR'S ALONE.** The baseline
 *     names a file for what its IMPORT does; applying that ceiling to its
 *     HELP door too reddened **32 gates** whose `--help` needs longer than it
 *     just to load playwright. Proving `--help` inert is the property with no
 *     list and no exceptions, so it always gets the full deadline.
 *
 * Run: node scripts/procgen/check-procgen-help.mjs
 *      node scripts/procgen/check-procgen-help.mjs --doors=ci
 *      node scripts/procgen/check-procgen-help.mjs --only=solve-seedling-r9-campaign.mjs
 *      node scripts/procgen/check-procgen-help.mjs --json
 *      node scripts/procgen/check-procgen-help.mjs --write-baseline
 *      node scripts/procgen/check-procgen-help.mjs --ceiling=20000 --known-ceiling=20000 --jobs=1
 *
 * ⛓ THE HEADING IS A PLAIN `Run:` AND NOT A `── Run: ──` RULE, because the
 * instruments index reads `documentedFlags` off a line that STARTS with the
 * word — this file's own help page listed all seven of its flags as
 * `⚠ undocumented` until the rule characters came off. The gate that publishes
 * what an instrument accepts should be able to read itself.
 *
 * @ci-face gate-help-ci: --doors=ci
 */

import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, helpText } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => (argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(name.length + 3);
const JSON_OUT = argv.includes('--json');
const WRITE_BASELINE = argv.includes('--write-baseline');
const ONLY = arg('only', '');

/** ⛓ The KILL DEADLINE, set far above where a slow-but-inert import lands
 *  under concurrency — not a threshold anything is judged against. */
const CEILING_MS = Number(arg('ceiling', 15000));
/** ⛓ …and the IMPORT door of a file the baseline already names only has to be
 *  shown still non-inert, which it demonstrates at once. */
const KNOWN_CEILING_MS = Number(arg('known-ceiling', 5000));
const JOBS = Math.max(1, Number(arg('jobs', 6)));

/**
 * ⛓⛓⛓ **THE CI FACE IS A SMALLER QUESTION, AND IT SAYS SO WITH ITS OWN KEY.**
 * `ci-gates.mjs` runs every headless gate on EVERY PUSH, and a push gate the
 * user waits on is a real cost. The two doors are not equally cheap and not
 * equally urgent:
 *
 *   `--doors=all`  (default) both doors for every instrument — the STANDING
 *                  row's measurement, taken on the box.
 *   `--doors=ci`   the HELP door for every instrument (fast: the inert
 *                  population is p90 891 ms and they run six at a time) plus
 *                  the IMPORT door only for the instruments the baseline does
 *                  NOT already name. That is the half with news in it: a
 *                  `--help` regression anywhere, and a NEW module-scope
 *                  worker. ⛔ What it CANNOT see is a baselined entry that has
 *                  been FIXED — that direction costs the 203 slow runs and is
 *                  a local red, which is where retiring an entry happens
 *                  anyway.
 *   `--doors=help` the help door alone.
 *
 * `@ci-face` gives the CI run its own key prefix, so a bounded number can
 * never be read as the standing one (⚖ P3b (g)).
 */
const DOORS = arg('doors', 'all');
if (!['all', 'ci', 'help'].includes(DOORS)) {
    console.log(`check-procgen-help: unknown --doors=${DOORS} — one of all, ci, help`);
    process.exit(1);
}

/**
 * ⛓⛓⛓ THE IMPORT DOOR'S BASELINE — *"not approved, KNOWN"*, exactly as
 * `lint-gate-labels.allow.json` is.
 *
 * ⛔ WHY THE TWO DOORS ARE GATED DIFFERENTLY, AND IT IS A MEASUREMENT.
 * `--help` can be made inert in every instrument by one guard at the top of
 * its body, and it HAS been: no exceptions, no list. A bare import cannot —
 * only THREE of the 260 instruments at `1097be9e6` had a `main()` guard at
 * all, so 182 of them do their work at module scope and closing that door is
 * 182 behaviour-preserving refactors, each of which can move a producer's
 * standing md5.  That is not one slice.
 *
 * ⛓ SO THE DEBT IS RECORDED RATHER THAN WAVED THROUGH, and the row reds BOTH
 * WAYS: a file that is not on the list must be inert on import (a NEW
 * module-scope worker reds by name), and a file ON the list that has become
 * inert reds too (it was fixed — take it off, or the same defect can come
 * back under a name nobody re-reads).
 *
 * ⛓ WHAT THE DOOR IS WORTH TODAY, measured rather than assumed: the
 * instruments a test file reaches are `loadJSZipNode`,
 * `make-seedling-vanilla-overlay`, `make-seedling-starter-atlas`,
 * `make-seedling-playthrough-rules` — every one INERT on import — and
 * `export-seedling-level-set`, which is reached by `new URL(...)`, i.e.
 * spawned. So the CI exposure of this door is nil at this head, and the
 * baseline is what keeps it nil.
 */
const BASELINE_FILE = join(HERE, 'check-procgen-help.baseline.json');
const BASELINE = (() => {
    try { return JSON.parse(readFileSync(BASELINE_FILE, 'utf8')); } catch {
        return { importDoorEffectful: {} };
    }
})();
const KNOWN = new Set(Object.keys(BASELINE.importDoorEffectful ?? {}));

const DIR = join(REPO, 'scripts/procgen');
const instruments = readdirSync(DIR).filter((f) => f.endsWith('.mjs')).sort()
    .filter((f) => !ONLY || f === ONLY);

const porcelain = () => execFileSync('git', ['status', '--porcelain'],
    { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 });

/** ⛓ …and the gitignored writes the porcelain cannot see. */
const newerThan = (marker) => {
    try {
        return execFileSync('find', [REPO, '-newer', marker, '-type', 'f',
            '-not', '-path', '*/.git/*', '-not', '-path', '*/node_modules/*'],
        { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
            .map((p) => p.slice(REPO.length + 1))
            .filter((p) => !p.startsWith('scripts/procgen/'));
    } catch { return []; }
};

const scratch = mkdtempSync(join(tmpdir(), 'procgen-help-'));
const MARKER = join(scratch, 'marker');

/**
 * ⛔ THE CHILD IS ITS OWN PROCESS GROUP AND IS KILLED AS ONE. An instrument
 * that launches a browser leaves it behind if only the node process is
 * signalled, and a stray chromium is exactly the side effect this gate is
 * about.
 */
function spawnChild(args, cache, ceiling) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        const child = spawn(process.execPath, args, {
            cwd: REPO,
            detached: true,
            env: { ...process.env, XDG_CACHE_HOME: cache, NO_COLOR: '1' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        let err = '';
        child.stdout.on('data', (d) => { if (out.length < 40000) out += d; });
        child.stderr.on('data', (d) => { if (err.length < 40000) err += d; });
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
        }, ceiling);
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, timedOut, ms: Date.now() - t0, out, err });
        });
    });
}

const argsFor = (kind, abs) => (kind === 'help'
    ? [abs, '--help']
    : ['--input-type=module', '-e', `await import(${JSON.stringify(`file://${abs}`)});`]);

/** Everything a run can be judged on WITHOUT the two per-batch observers. */
function localWhy(kind, abs, r, cacheFiles, ceiling, importErr = null, importOut = null) {
    const why = [];
    if (r.timedOut) why.push(`ran past the ${ceiling} ms ceiling and was killed`);
    else if (r.code !== 0) why.push(`exit ${r.code}${r.signal ? ` (${r.signal})` : ''}`);
    if (cacheFiles.length) {
        why.push(`left ${cacheFiles.length} entry(ies) in its own cache: `
            + `${cacheFiles.slice(0, 3).join(', ')}`);
    }
    /**
     * ⛓⛓ STDERR THE FILE'S OWN IMPORTS ALREADY PRODUCE IS NOT SOMETHING THE
     * HELP PATH DID — and the gate has the evidence to say which. Ten
     * instruments reach `stateManagerProxySingleton.js`, which constructs on
     * import and warns *"Worker is not defined"* under node; imports are
     * HOISTED, so no guard in the importer can preempt it and calling it a
     * `--help` side effect would be filing a true sentence against the wrong
     * subject (trap 566). The IMPORT door of the same file is the control: a
     * help-door stderr that the bare import also produces is attributed to the
     * imports and NAMED; anything MORE than that is the help path's own and is
     * a finding.
     */
    const err = r.err.trim();
    if (err) {
        /**
         * ⛓ LINE BY LINE, not whole-string: the control run is killed at its
         * own ceiling, so its stderr can be a PREFIX of the help door's.
         * ⛓ AND STACK FRAMES ARE NOT MESSAGES. `at async loadESM
         * (node:internal/…)` differs between a `node x.mjs` launch and a
         * `node -e "await import(…)"` one FOR THE SAME WARNING, so comparing
         * them would report the launch method as a side effect. A frame
         * belongs to the message above it; the messages are what a run wrote.
         */
        const messages = (t) => (t ?? '').split('\n').map((l) => l.trim())
            .filter((l) => l && !/^at\s/.test(l));
        const theirs = new Set(messages(importErr));
        const extra = messages(err).filter((l) => !theirs.has(l));
        if (extra.length) why.push(`printed to stderr: ${extra[0].slice(0, 120)}`);
    }
    /**
     * ⛔⛔ THE DISCRIMINATOR, AND THE GATE'S FIRST CUT DID NOT HAVE IT.
     * Without this row `lint-gate-labels.mjs --help` PASSED — it scanned 514
     * files, printed a report, exited 0, wrote nothing and left no cache, so
     * every observer was satisfied by an instrument that had just done its
     * whole job. "Had no side effect I could see" is not "printed help". So
     * the help door asserts stdout IS the text `argvHelp` derives for that
     * file, byte for byte; nothing an instrument prints by accident can equal
     * it, and the assertion needs no list.
     */
    if (kind === 'help' && !why.length) {
        /**
         * ⛓⛓ …AND LINES A HOISTED IMPORT PRINTS ARE NOT LINES THE HELP PATH
         * PRINTED. Ten instruments reach `centralRegistry`/`discoveryState`,
         * which log `[centralRegistry] CentralRegistry initialized` at LOAD;
         * imports hoist, so those two lines are above the help text and no
         * guard in the importer can preempt them. The file's own bare import
         * is the control for exactly this, as it is for stderr.
         *
         * ⛔ AND THE RULE STAYS SHARP: what REMAINS after removing the lines
         * the import also prints must EQUAL the derived help text. An
         * instrument that RAN under `--help` has its output stripped by the
         * same rule and is left with nothing to match — still red.
         */
        /* ⛔ NEVER an empty line: the help text has blank lines of its own, and
         *   a control whose stdout is `''` would otherwise strip every one. */
        const theirs = new Set((importOut ?? '').split('\n')
            .map((l) => l.trim()).filter(Boolean));
        const mine = r.out.split('\n').filter((l, i, a) => !(i === a.length - 1 && l === ''));
        const kept = mine.filter((l) => !(l.trim() && theirs.has(l.trim())));
        const noise = mine.length - kept.length;
        if (kept.join('\n') !== helpText(abs)) {
            why.push(r.out.trim()
                ? 'stdout is NOT the derived help text — the instrument RAN instead of printing'
                : 'printed NOTHING');
        } else if (noise) {
            /* ⛓ a PASS that says what it forgave, so the residue is visible. */
            r.noise = noise;
        }
    }
    return why;
}

/**
 * ⛔⛔ A GATE THAT LEAVES THE TREE DIRTY IS NOT A GATE, IT IS A SECOND
 * INSTRUMENT. `extract-seedling-damage-sites.mjs` rewrites a TRACKED source
 * file on import; without this the check would hand the next reader a modified
 * worktree and a box lock whose `treeState` had moved under it.
 *
 * ⛔⛔⛔ AND IT NEVER DELETES — MEASURED, BY LOSING WORK. The first cut removed
 * any path that was `??` in the AFTER porcelain and absent from the BEFORE
 * one, on the theory that the child had just created it. A file written BY
 * HAND in another window during the run matches that description exactly, and
 * one was deleted mid-run. **Restoring a tracked path is recoverable from git;
 * deleting an untracked one is not**, so the two are not the same act and only
 * the recoverable one is automatic. An untracked creation is REPORTED.
 *
 * ⛓ AND A PATH IS ONLY THIS RUN'S IF BOTH OBSERVERS SAY SO — the porcelain
 * delta AND the mtime sweep. Either alone can be somebody else's edit.
 */
function repairPorcelain(before, after, touched) {
    const lineSet = (t) => new Set(t.split('\n').filter((l) => l.trim()));
    const was = lineSet(before);
    const pathOf = (l) => l.slice(3).split(' -> ').pop();
    const wasPaths = new Set([...was].map(pathOf));
    const mine = new Set(touched);
    const restored = [];
    const left = [];
    for (const line of [...lineSet(after)].filter((l) => !was.has(l))) {
        const path = pathOf(line);
        if (wasPaths.has(path) || !mine.has(path)) { left.push(path); continue; }
        if (line.startsWith('??')) { left.push(`${path} (untracked — NOT deleted)`); continue; }
        try {
            execFileSync('git', ['checkout', '--', path], { cwd: REPO, encoding: 'utf8' });
            restored.push(path);
        } catch { left.push(`${path} (restore FAILED)`); }
    }
    return `the repo's \`git status --porcelain\` MOVED`
        + `${restored.length ? ` — RESTORED ${restored.join(', ')}` : ''}`
        + `${left.length ? ` — ⛔ LEFT IN PLACE ${left.join(', ')}` : ''}`;
}

/**
 * ⛔ THE SHORT CEILING BELONGS TO THE IMPORT DOOR ONLY. The baseline names a
 * file for what its IMPORT does; a `--help` that has to load playwright first
 * is a different question with a different clock, and conflating them
 * reddened 32 gates for their import cost.
 */
const ceilingFor = (file, kind) => (kind === 'import' && KNOWN.has(file)
    ? KNOWN_CEILING_MS : CEILING_MS);

/** One door, run and judged on its own observers; the disk pair is the caller's. */
async function runDoor(task) {
    const cache = join(scratch, `${task.kind}-${task.file}`);
    rmSync(cache, { recursive: true, force: true });
    mkdirSync(cache, { recursive: true });
    const ceiling = ceilingFor(task.file, task.kind);
    const r = await spawnChild(argsFor(task.kind, task.abs), cache, ceiling);
    const cacheFiles = readdirSync(cache, { recursive: true });
    rmSync(cache, { recursive: true, force: true });
    return {
        ms: r.ms,
        wrote: [],
        stderr: r.err,
        stdout: r.out,
        noise: r.noise ?? 0,
        why: localWhy(task.kind, task.abs, r, cacheFiles, ceiling,
            task.importErr ?? null, task.importOut ?? null),
    };
}

/** ⛓ A BATCH, WITH ONE PAIR OF DISK OBSERVERS AROUND IT — and a serial re-run
 *  when, and only when, that pair says something moved. */
async function runBatch(tasks) {
    writeFileSync(MARKER, '');
    const before = porcelain();
    const out = await Promise.all(tasks.map(runDoor));
    const touched = newerThan(MARKER);
    const after = porcelain();
    if (after === before && touched.length === 0) return out;
    if (tasks.length === 1) {
        if (touched.length) {
            out[0].wrote = touched;
            out[0].why.push(`wrote ${touched.length} file(s) under the repo: `
                + `${touched.slice(0, 3).join(', ')}${touched.length > 3 ? ' …' : ''}`);
        }
        if (after !== before) out[0].why.push(repairPorcelain(before, after, touched));
        return out;
    }
    /**
     * ⛔⛔ REPAIR THE BATCH'S OWN DIRT BEFORE THE SERIAL PASS, OR THE SERIAL
     * PASS INHERITS IT AND LEAVES IT. Measured: the first cut fell straight
     * through to the per-door re-run, whose `before` was taken AFTER the batch
     * had already modified the file — so `wasPaths.has(path)` was true, the
     * path was (correctly, by the never-touch-somebody-else's-work rule) left
     * alone, and the run ENDED with two tracked files modified. The batch's
     * observers know what the batch caused; use them, then re-run from a tree
     * that is clean again.
     */
    repairPorcelain(before, after, touched);
    const serial = [];
    for (const t of tasks) serial.push(...await runBatch([t]));   /* eslint-disable-line */
    return serial;
}

/**
 * ⛓ THE IMPORT DOOR RUNS FIRST, FOR EVERY FILE, because it is the HELP door's
 * control: a stderr line the bare import already produces cannot be something
 * `--help` did (see `localWhy`). Two passes, each batched.
 */
const t0 = Date.now();
const byDoor = new Map();
for (const kind of ['import', 'help']) {
    if (kind === 'import' && DOORS === 'help') continue;
    const doors = instruments
        .filter((file) => !(kind === 'import' && DOORS === 'ci' && KNOWN.has(file)))
        .map((file) => ({
        file,
        kind,
        abs: join(DIR, file),
        importErr: kind === 'help' ? (byDoor.get(`import:${file}`)?.stderr ?? null) : null,
        importOut: kind === 'help' ? (byDoor.get(`import:${file}`)?.stdout ?? null) : null,
    }));
    for (let i = 0; i < doors.length; i += JOBS) {
        const batch = doors.slice(i, i + JOBS);
        /* eslint-disable-next-line no-await-in-loop */
        const out = await runBatch(batch);
        batch.forEach((t, k) => byDoor.set(`${t.kind}:${t.file}`, out[k]));
    }
}
const WALL_MS = Date.now() - t0;
rmSync(scratch, { recursive: true, force: true });

const SKIPPED = { ms: 0, why: [], wrote: [], skipped: true };
const rows = instruments.map((file) => {
    const help = byDoor.get(`help:${file}`) ?? SKIPPED;
    const imported = byDoor.get(`import:${file}`) ?? SKIPPED;
    return {
        file,
        help: { ...help, ok: help.why.length === 0 },
        /** ⛓ a door this face did not ask about is not a door that PASSED. */
        import: { ...imported, ok: imported.why.length === 0, asked: !imported.skipped },
    };
});

if (!JSON_OUT && !WRITE_BASELINE) {
    for (const r of rows) {
        const known = KNOWN.has(r.file);
        const ok = r.help.ok && (r.import.ok ? !known : known);
        const mark = (d) => (d.ok ? 'ok' : 'SIDE EFFECT');
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${r.file} — `
            + `HELP ${mark(r.help)} (${r.help.ms} ms) · IMPORT ${mark(r.import)}`
            + `${known ? ' (KNOWN)' : ''} (${r.import.ms} ms)`);
        for (const w of r.help.why) console.log(`    ⛔ HELP: ${w}`);
        if (!r.import.ok && !known) for (const w of r.import.why) console.log(`    ⛔ IMPORT: ${w}`);
        if (r.import.ok && known) {
            console.log('    ⛔ IMPORT: this file is on the baseline as a module-scope worker '
                + 'and is now INERT — it was fixed; remove it from '
                + '`check-procgen-help.baseline.json` (`--write-baseline`).');
        }
    }
}

const helpBad = rows.filter((r) => !r.help.ok && r.help.asked !== false);
const importFresh = rows.filter((r) => r.import.asked !== false && !r.import.ok
    && !KNOWN.has(r.file));
/** ⛔ only a face that ASKED the 203 can say one of them was fixed. */
const importFixed = DOORS === 'all'
    ? rows.filter((r) => r.import.ok && KNOWN.has(r.file))
    : [];
const bad = [...new Set([...helpBad, ...importFresh, ...importFixed])];

if (WRITE_BASELINE) {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
    /**
     * ⛓ EACH ENTRY CARRIES THE DOOR IT FAILS AND, WHERE THERE IS ONE, THE
     * PATHS IT WROTE — so a later slice can retire an entry BY NAME and know
     * what closing it has to preserve, instead of re-running the census.
     */
    const effectful = Object.fromEntries(rows.filter((r) => !r.import.ok)
        .sort((a, b) => a.file.localeCompare(b.file))
        .map((r) => [r.file, {
            why: r.import.why,
            wrote: r.import.wrote.slice().sort(),
            helpResidue: r.help.ok ? null : r.help.why,
            ms: r.import.ms,
        }]));
    writeFileSync(BASELINE_FILE, `${JSON.stringify({
        note: 'GENERATED by `node scripts/procgen/check-procgen-help.mjs --write-baseline` '
            + '(R9 slice P4a, ⚖ 47b (4)). The instruments whose MODULE SCOPE does work when '
            + 'the file is merely imported — no argv, no main guard. ⛔ An entry here is NOT '
            + 'an approved side effect, it is a KNOWN one: closing this door means moving a '
            + "file's work into a `main()`, which for a producer can move its standing "
            + 'stdout md5 (⚖ ruling 8). The list reds BOTH ways — a new entrant, and an '
            + 'entry that has been fixed. The `--help` door has no list and no exceptions.',
        measuredAt: head,
        counts: {
            instruments: rows.length,
            importDoorEffectful: Object.keys(effectful).length,
            wroteIntoTheRepo: Object.values(effectful).filter((e) => e.wrote.length).length,
        },
        importDoorEffectful: effectful,
    }, null, 2)}\n`);
    console.log(`wrote ${BASELINE_FILE.split('/').pop()} — ${Object.keys(effectful).length} of `
        + `${rows.length} instrument(s) do module-scope work on import, at ${head} `
        + `(${(WALL_MS / 1000).toFixed(1)} s)`);
    process.exit(0);
}
if (JSON_OUT) {
    console.log(JSON.stringify(rows, null, 1));
    process.exit(bad.length ? 1 : 0);
}

const slowest = rows.slice().sort((a, b) => Math.max(b.help.ms, b.import.ms)
    - Math.max(a.help.ms, a.import.ms))[0];
console.log('');
console.log(`## ${rows.length} instrument(s), \`--doors=${DOORS}\`, ${JOBS} at a time in `
    + `${(WALL_MS / 1000).toFixed(1)} s; ${rows.filter((r) => KNOWN.has(r.file)).length} on the `
    + `import-door baseline. Slowest: ${slowest.file} `
    + `(${Math.max(slowest.help.ms, slowest.import.ms)} ms; kill deadlines ${CEILING_MS} ms, `
    + `${KNOWN_CEILING_MS} ms for a baselined IMPORT door).`);
console.log('## ⛓ The ceiling is a PROXY — the assertions that decide a row are the porcelain, '
    + 'the mtime sweep, the child\'s own cache, its exit code, its stderr, and for the help '
    + 'door that stdout IS the derived help text.');
if (bad.length === 0) {
    console.log(`\nALL PASS — ${rows.length} instrument(s) answer \`--help\` with no side `
        + `effect this gate can observe; ${rows.filter((r) => KNOWN.has(r.file)).length} `
        + 'still do module-scope work on IMPORT and are the baseline\'s named debt');
    process.exit(0);
}
console.log(`\n${bad.length} CHECK(S) FAILED`);
process.exit(1);
