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
 * ── Run: ──────────────────────────────────────────────────────────────
 *
 *   node scripts/procgen/check-procgen-help.mjs
 *   node scripts/procgen/check-procgen-help.mjs --only=solve-seedling-r9-campaign.mjs
 *   node scripts/procgen/check-procgen-help.mjs --json
 *   node scripts/procgen/check-procgen-help.mjs --ceiling=20000
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
 * standing md5. That is not one slice.
 *
 * ⛓ SO THE DEBT IS RECORDED RATHER THAN WAVED THROUGH, and the row reds BOTH
 * WAYS: a file that is not on the list must be inert on import (a NEW
 * module-scope worker reds by name), and a file ON the list that has become
 * inert reds too (it was fixed — take it off, or the same defect can come
 * back under a name nobody re-reads).
 *
 * ⛓ WHAT THE DOOR IS WORTH TODAY, measured rather than assumed: five
 * instruments are `import`ed by a test file (`loadJSZipNode`,
 * `make-seedling-vanilla-overlay`, `make-seedling-starter-atlas`,
 * `make-seedling-playthrough-rules` and — by URL, i.e. spawned, not imported —
 * `export-seedling-level-set`), and every one that is genuinely imported is
 * INERT on import. So the CI exposure of this door is nil at this head, and
 * the baseline is what keeps it nil.
 */
const BASELINE_FILE = join(HERE, 'check-procgen-help.baseline.json');
const BASELINE = (() => {
    try { return JSON.parse(readFileSync(BASELINE_FILE, 'utf8')); } catch {
        return { importDoorEffectful: [] };
    }
})();
const KNOWN = new Set(Object.keys(BASELINE.importDoorEffectful ?? {}));

/**
 * ⛓ THE CEILING, AND ITS REASON. An instrument that prints help still pays
 * for its own hoisted imports; the heaviest of those in this directory pull
 * the solver and the level generator. This is where DRIVING lives, not where
 * starting up does — and every row prints its own milliseconds so a reader
 * can see the distribution rather than trust the line.
 */
const CEILING_MS = Number(arg('ceiling', 12000));

const DIR = join(REPO, 'scripts/procgen');
const instruments = readdirSync(DIR).filter((f) => f.endsWith('.mjs')).sort()
    .filter((f) => !ONLY || f === ONLY);

const porcelain = () => execFileSync('git', ['status', '--porcelain'],
    { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 });

const newerThan = (marker) => {
    try {
        return execFileSync('find', [REPO, '-newer', marker, '-type', 'f',
            '-not', '-path', '*/.git/*', '-not', '-path', '*/node_modules/*'],
        { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
            .map((p) => p.slice(REPO.length + 1));
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
function run(args, cache) {
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
        }, CEILING_MS);
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, timedOut, ms: Date.now() - t0, out, err });
        });
    });
}

async function door(kind, file) {
    const abs = join(DIR, file);
    const cache = join(scratch, `${kind}-${file}`);
    rmSync(cache, { recursive: true, force: true });
    mkdirSync(cache, { recursive: true });
    writeFileSync(MARKER, '');
    const before = porcelain();
    const args = kind === 'help'
        ? [abs, '--help']
        : ['--input-type=module', '-e', `await import(${JSON.stringify(`file://${abs}`)});`];
    const r = await run(args, cache);
    const touched = newerThan(MARKER).filter((p) => !p.startsWith('scripts/procgen/'));
    const wrote = [];
    const cacheFiles = readdirSync(cache, { recursive: true });
    rmSync(cache, { recursive: true, force: true });
    const why = [];
    if (r.timedOut) why.push(`ran past the ${CEILING_MS} ms ceiling and was killed`);
    else if (r.code !== 0) why.push(`exit ${r.code}${r.signal ? ` (${r.signal})` : ''}`);
    const after = porcelain();
    if (after !== before) {
        /**
         * ⛔⛔ A GATE THAT LEAVES THE TREE DIRTY IS NOT A GATE, IT IS A SECOND
         * INSTRUMENT. `extract-seedling-damage-sites.mjs` rewrites a TRACKED
         * source file on import; without this the check would hand the next
         * reader a modified worktree and a box lock whose `treeState` had
         * moved under it.
         *
         * ⛔⛔⛔ AND IT NEVER DELETES — MEASURED, BY LOSING WORK. The first cut
         * removed any path that was `??` in the AFTER porcelain and absent
         * from the BEFORE one, on the theory that the child had just created
         * it. A file written BY HAND in another window during the run matches
         * that description exactly, and one was deleted mid-run. Restoring a
         * tracked path is recoverable from git; deleting an untracked one is
         * not, so the two are not the same act and only the recoverable one is
         * automatic. An untracked creation is REPORTED by name.
         *
         * ⛓ AND A PATH IS ONLY THIS RUN'S IF BOTH OBSERVERS SAY SO — the
         * porcelain delta AND the mtime sweep. Either alone can be somebody
         * else's edit.
         */
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
        why.push('the repo\'s `git status --porcelain` MOVED'
            + `${restored.length ? ` — RESTORED ${restored.join(', ')}` : ''}`
            + `${left.length ? ` — ⛔ LEFT IN PLACE ${left.join(', ')}` : ''}`);
    }
    if (touched.length) {
        wrote.push(...touched);
        why.push(`wrote ${touched.length} file(s) under the repo: `
            + `${touched.slice(0, 3).join(', ')}${touched.length > 3 ? ' …' : ''}`);
    }
    if (cacheFiles.length) why.push(`left ${cacheFiles.length} entry(ies) in its cache: `
        + `${cacheFiles.slice(0, 3).join(', ')}`);
    if (r.err.trim()) why.push(`printed to stderr: ${r.err.trim().split('\n')[0].slice(0, 120)}`);
    /**
     * ⛔⛔ THE DISCRIMINATOR, AND THE GATE'S FIRST CUT DID NOT HAVE IT.
     * Without this row `lint-gate-labels.mjs --help` PASSED — it scanned 514
     * files, printed a report, exited 0, wrote nothing and left no cache, so
     * every observer above was satisfied by an instrument that had just done
     * its whole job. "Had no side effect I could see" is not "printed help".
     * So the help door asserts stdout IS the text `argvHelp` derives for that
     * file, byte for byte; nothing an instrument prints by accident can equal
     * it, and the assertion needs no list.
     */
    if (kind === 'help' && !why.length && r.out !== `${helpText(abs)}\n`) {
        why.push(r.out.trim()
            ? 'stdout is NOT the derived help text — the instrument RAN instead of printing'
            : 'printed NOTHING');
    }
    return { ok: why.length === 0, ms: r.ms, why, wrote };
}

const rows = [];
for (const file of instruments) {
    /* eslint-disable no-await-in-loop */
    const help = await door('help', file);
    const imported = await door('import', file);
    /* eslint-enable no-await-in-loop */
    rows.push({ file, help, import: imported });
    const known = KNOWN.has(file);
    const ok = help.ok && (imported.ok ? !known : known);
    if (!JSON_OUT) {
        const mark = (d) => (d.ok ? 'ok' : 'SIDE EFFECT');
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${file} — `
            + `HELP ${mark(help)} (${help.ms} ms) · IMPORT ${mark(imported)}`
            + `${known ? ' (KNOWN)' : ''} (${imported.ms} ms)`);
        for (const w of help.why) console.log(`    ⛔ HELP: ${w}`);
        if (!imported.ok && !known) for (const w of imported.why) console.log(`    ⛔ IMPORT: ${w}`);
        if (imported.ok && known) {
            console.log('    ⛔ IMPORT: this file is on the baseline as a module-scope worker '
                + 'and is now INERT — it was fixed; remove it from '
                + '`check-procgen-help.baseline.json` (`--write-baseline`).');
        }
    }
}
rmSync(scratch, { recursive: true, force: true });

if (WRITE_BASELINE) {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
    /**
     * ⛓ EACH ENTRY CARRIES THE DOOR IT FAILS AND, WHERE THERE IS ONE, THE
     * PATHS IT WROTE — so a later slice can retire an entry BY NAME and know
     * what closing it has to preserve, instead of re-running the census.
     */
    const effectful = Object.fromEntries(rows.filter((r) => !r.import.ok).sort(
        (a, b) => a.file.localeCompare(b.file),
    ).map((r) => [r.file, {
        why: r.import.why,
        wrote: r.import.wrote.sort(),
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
    console.log(`wrote ${BASELINE_FILE.split('/').pop()} — ${Object.keys(effectful).length} `
        + `of ${rows.length} `
        + `instrument(s) do module-scope work on import, at ${head}`);
    process.exit(0);
}
if (JSON_OUT) {
    console.log(JSON.stringify(rows, null, 1));
    process.exit(bad.length ? 1 : 0);
}

const helpBad = rows.filter((r) => !r.help.ok);
const importFresh = rows.filter((r) => !r.import.ok && !KNOWN.has(r.file));
const importFixed = rows.filter((r) => r.import.ok && KNOWN.has(r.file));
const bad = [...new Set([...helpBad, ...importFresh, ...importFixed])];
const slowest = rows.slice().sort((a, b) => Math.max(b.help.ms, b.import.ms)
    - Math.max(a.help.ms, a.import.ms))[0];
console.log('');
console.log(`## ${rows.length} instrument(s), two doors each; `
    + `${rows.filter((r) => KNOWN.has(r.file)).length} on the import-door baseline. `
    + `Slowest: ${slowest.file} `
    + `(${Math.max(slowest.help.ms, slowest.import.ms)} ms against a ${CEILING_MS} ms ceiling).`);
console.log('## ⛓ The ceiling is a PROXY — the assertions that decide a row are the porcelain, '
    + 'the mtime sweep, the child\'s own cache, its exit code and its stderr.');
if (bad.length === 0) {
    console.log(`\nALL PASS — ${rows.length} instrument(s) answer \`--help\` with no side `
        + `effect this gate can observe; ${rows.filter((r) => KNOWN.has(r.file)).length} `
        + 'still do module-scope work on IMPORT and are the baseline\'s named debt');
    process.exit(0);
}
console.log(`\n${bad.length} CHECK(S) FAILED`);
process.exit(1);
