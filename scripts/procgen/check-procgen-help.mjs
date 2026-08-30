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
 * ── ⛔⛔⛔ AND IT DRIVES A THROWAWAY WORKTREE, NOT YOUR TREE ──────────
 *
 * R9 slice SG1 W2, ⚖ ruling 71 (b). **MEASURED on main `511b271af`, primary
 * tree porcelain-0 before:** a `--doors=all` run left `seedlingDamageSites.js`
 * and `region_library_files.json` dirtied with regeneration drift, five
 * untracked worldgen/rules droppings, and a stale `.git/index.lock` from a
 * SIGKILLed child git op which then errored the gate's OWN porcelain observer
 * twice. Every one of those is declared in the baseline's `wrote:` lists — the
 * gate finds effectful import doors THE ONLY WAY IT CAN, by letting them
 * happen — so the damage is not a defect in the gate, it is the gate working.
 * What was wrong was the tree it happened in.
 *
 * ⇒ by default the children run with `cwd` a `git worktree add --detach` tree
 * at HEAD, submodules init'd, and BOTH disk observers are scoped to it. It is
 * removed on exit and on signal, and the droppings — including any killed
 * child's git locks, which live under that worktree's own private
 * `.git/worktrees/<name>/` — die with it.
 *
 * ⛔ WHICH MEANS THE MEASUREMENT IS OF **HEAD**, NOT OF YOUR WORKING TREE. An
 * instrument you have edited but not committed is not in the population. The
 * header says which tree and which sha it drove, and NAMES the uncommitted
 * `scripts/procgen/` paths a dirty primary tree is hiding from the run.
 * `--in-place` is the escape hatch and preserves the old behaviour exactly.
 *
 * ⛓ THAT INCLUDES THIS GATE. Its own two doors are measured on the WORKTREE's
 * copy, so an edit to `check-procgen-help.mjs` is not self-tested until it is
 * committed — the uniform rule applied to the file it is written in, rather
 * than a self-exception that would make a second population rule. The dirty
 * warning names this file like any other instrument; `--in-place` measures it.
 *
 * ⛓ THE SUBMODULES ARE NOT OPTIONAL AND THE INIT IS ASSERTED, not trusted.
 * A cold worktree has none, and several instruments guard on
 * `existsSync(<artifact>/game.html)`: without the submodule they print SKIP
 * and exit 0, i.e. they read as INERT FOR THE WRONG REASON — a false green on
 * the exact property this gate measures, silently shrinking the effectful set.
 * So `submodule status` is read back and an uninitialised line is a REFUSAL.
 *
 * ⛓ AND CI STAYS `--in-place`, DECIDED FROM WHAT CI'S CLONE SUPPORTS.
 * `unittests_frontend.yml` checks out `submodules: recursive` at the default
 * depth-1. A worktree there does NOT inherit those checkouts, so it would pay
 * a network re-clone of five submodules on every push — for no containment,
 * since the CI checkout is already a throwaway that dies with the runner — and
 * an init that failed would hand back the false green above. The `@ci-face`
 * declares `--in-place` for that reason.
 *
 * Run: node scripts/procgen/check-procgen-help.mjs
 *      node scripts/procgen/check-procgen-help.mjs --in-place
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
 * @ci-face gate-help-ci: --doors=ci --in-place
 *
 * ⛓⛓⛓ SG2, ⚖ 71 (a) — **THIS GATE'S CLOSURE IS SIX FILES AND ITS SUBJECT IS
 * ALL 265 INSTRUMENTS**, so the byte key derived from an import closure alone
 * would call the row unmoved while every file it actually opens two doors on
 * had changed. That is the stale green `rowInputKey`'s docblock names, and it
 * is the one thing derivation genuinely cannot see here: the population is
 * `readdirSync(DIR)` at run time, not an import. So the gate DECLARES it, and
 * the seeds carry their own closures with them.
 *
 * @key-inputs code: scripts/procgen/*.mjs
 * @key-inputs data: scripts/procgen/check-procgen-help.baseline.json
 */

import { execFileSync, spawn } from 'node:child_process';
import {
    existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, helpText, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => (argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(name.length + 3);
const JSON_OUT = argv.includes('--json');
const WRITE_BASELINE = argv.includes('--write-baseline');
/**
 * ⛓ ⚖ 71 (b)'s escape hatch — drive THIS tree, the pre-SG1 behaviour exactly.
 *
 * ⛔⛔ AND ONE MORE REASON THE WORKTREE IS THE DEFAULT, stated here because
 * this is the flag people reach for precisely WHEN THEIR TREE IS DIRTY:
 * `repairPorcelain` calls `git checkout -- <path>` on paths it believes its own
 * children moved, which is trap 893 wearing an instrument. It is bounded — a
 * path already dirty BEFORE the batch is in `wasPaths` and is left alone, and
 * an untracked creation is never deleted — so an edit that pre-dates the run is
 * safe. What is NOT safe is an edit made DURING a batch to a path a child also
 * touched: that path is not in `wasPaths`, the mtime sweep names it, and it is
 * restored to HEAD. Under the default that acts on a throwaway tree and is
 * harmless; under `--in-place` it acts on yours.
 */
const IN_PLACE = argv.includes('--in-place');
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
/**
 * ⛓⛓⛓ **THE INHERITED OUTPUT, RECORDED PER FILE — because a bounded face has
 * no control to attribute with.** The help door tells "the instrument printed"
 * from "a module it imports printed at LOAD" by comparing against the file's
 * OWN bare import. Under `--doors=ci` that import is not run for a baselined
 * file, so the control is gone and ten instruments reddened for
 * `[stateManagerProxy] … Worker is not defined` — a line no guard in the
 * importer can preempt.
 *
 * ⛔ AND THE FIRST RECORDING OF IT WAS TOO BROAD. It derived a repo-wide set
 * of "lines printed at import time by MORE THAN ONE instrument", which sounds
 * like ambient logging and is not: 46 lines came back and among them were
 * `## the claims`, `## the room` and `(dry run — pass --write to emit the
 * tapes)` — REPORT lines that two sibling instruments happen to share. A
 * cross-file rule cannot tell a shared MODULE's banner from a shared HOUSE
 * STYLE.
 *
 * ⛓ The evidence is per-file, and the write run already has it: at
 * `--write-baseline` BOTH doors run, so what the help door inherited from its
 * imports is exactly the INTERSECTION of that file's two outputs. That set is
 * stored in the file's own entry, and it cannot leak to a sibling.
 */
const INHERITED = new Map(Object.entries(BASELINE.importDoorEffectful ?? {})
    .map(([f, e]) => [f, new Set(e.inheritedOutput ?? [])]));

const git = (cwd, args) => execFileSync('git', args,
    { cwd, encoding: 'utf8', maxBuffer: 1 << 26 }).trim();

/**
 * ⛓⛓⛓ **THE TREE THE CHILDREN ARE DRIVEN IN** (⚖ 71 (b)).
 *
 * ⛔ THE BASELINE FILE IS DELIBERATELY NOT IN IT. `BASELINE_FILE` is resolved
 * from THIS file's own location, so the run reads — and `--write-baseline`
 * writes — the PRIMARY tree's baseline, whichever tree the children ran in.
 * A baseline written into a throwaway would be a measurement that deleted
 * itself.
 */
const HEAD = git(REPO, ['rev-parse', 'HEAD']);
let TREE = REPO;
let WORKTREE = null;
let SUBMODULES = 0;

/** ⛓ Removed on exit AND on signal — a killed run must not leave a worktree
 *  (nor the primary repo's registration of one) behind. Idempotent. */
let treeRemoved = false;
function removeWorktree() {
    if (!WORKTREE || treeRemoved) return;
    treeRemoved = true;
    /**
     * ⛔⛔ **`-f -f`, AND THE SINGLE `--force` WAS MEASURED FAILING.** A
     * worktree whose `add` was interrupted stays LOCKED with the reason
     * `initializing`, and git refuses `remove --force` on a locked tree —
     * *"cannot remove a locked working tree … use 'remove -f -f' to override
     * or unlock first"*. `worktree prune` does not rescue it either: prune
     * deliberately skips LOCKED registrations. So the one case a cleanup path
     * exists for — a setup that died halfway — was the one case it could not
     * clean, and the registration outlived every attempt. Found by hand on
     * three real orphans; both forces are load-bearing.
     */
    try { git(REPO, ['worktree', 'remove', '-f', '-f', WORKTREE]); } catch {
        try { rmSync(WORKTREE, { recursive: true, force: true }); } catch { /* gone */ }
        /* ⛓ a lock left behind would make `prune` skip the registration too. */
        try { git(REPO, ['worktree', 'unlock', WORKTREE]); } catch { /* not locked */ }
    }
    try { git(REPO, ['worktree', 'prune']); } catch { /* nothing to prune */ }
}
process.on('exit', removeWorktree);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => { removeWorktree(); process.exit(130); });
}

/**
 * ⛓ WAS THIS FILE LAUNCHED, OR MERELY IMPORTED? ⛔ DECLARED HERE, ABOVE BOTH
 * ITS USES — a `const` read above its declaration is a TDZ throw at module
 * scope, which for this gate means every child's IMPORT door dying on a
 * ReferenceError. Measured, on the first run after the guard went in.
 */
const IS_ENTRY_POINT = isEntryPoint(import.meta.url);

/**
 * ⛓⛓⛓ **AN ORPHANED WORKTREE FROM AN EARLIER RUN IS REPORTED, NEVER DELETED**
 * — and this row exists because one appeared. During SG1's own matrix a
 * `procgen-help-tree-*` turned up in `/tmp` that no run of mine had left: a
 * half-created tree whose registration held a `locked` file reading
 * **`initializing`** and an `index.lock` with no `index` — the signature of a
 * `git worktree add` SIGKILLed mid-checkout. The exit and signal handlers
 * cannot cover that case: SIGKILL runs nothing.
 *
 * ⛔ REPORT, NEVER AUTO-DELETE. It is the same law `repairPorcelain` states
 * fifty lines down — restoring a tracked path is recoverable, deleting
 * somebody's directory is not — and an orphan here may be ANOTHER SESSION'S
 * run in flight, whose tree looks exactly like a dead one from outside.
 * `worktree prune` first, because that only drops registrations whose
 * directory is already gone; whatever survives it is a real directory and gets
 * NAMED, with its lock reason, so it stops accumulating silently.
 */
if (!JSON_OUT && IS_ENTRY_POINT) {
    try { git(REPO, ['worktree', 'prune']); } catch { /* nothing to prune */ }
    try {
        const orphans = git(REPO, ['worktree', 'list', '--porcelain']).split('\n\n')
            .map((b) => b.split('\n'))
            .filter((ls) => (ls[0] ?? '').startsWith('worktree ')
                && ls[0].includes('/procgen-help-tree-'))
            .map((ls) => ({
                path: ls[0].slice('worktree '.length),
                locked: ls.find((l) => l.startsWith('locked')) ?? null,
            }));
        for (const o of orphans) {
            /* ⛓ STABLE PREFIX — this line is the only standing detector for
             *  the class, so a future check can grep `## ⚠ ORPHAN WORKTREE`. */
            console.log(`## ⚠ ORPHAN WORKTREE — ${o.path}${o.locked ? ` (${o.locked})` : ''}: a `
                + 'previous `procgen-help-tree-*` is still registered. Either a run in flight in '
                + 'another session, or one SIGKILLed mid-setup. ⛔ NOT removed by this run; '
                + '`git worktree remove --force <path> && git worktree prune` clears a dead one.');
        }
    } catch { /* a repo that cannot list worktrees is not this gate's finding */ }
}

/**
 * ⛓⛓⛓ **AND THE WORKTREE IS BUILT ONLY WHEN THIS FILE WAS LAUNCHED, NEVER
 * WHEN IT WAS MERELY IMPORTED** — the entry-point guard, and W2 SHIPPED
 * WITHOUT IT AND MEASURED THE COST.
 *
 * ⛔⛔ THE DEFECT, AND IT IS THE GATE BITING ITSELF. This file is one of the
 * 265 instruments, so every `--doors=all` run opens its IMPORT door: `node -e
 * "await import(<this file>)"`. Without this guard that child ran the module
 * scope above, which now starts a 30-second `git worktree add` — and the child
 * is KILLED at its 5 s baselined ceiling, mid-checkout. Each run therefore
 * left a half-created tree in `/tmp` and a `locked initializing` registration
 * in the COMMON gitdir (a linked worktree registers in the primary repo's
 * `.git/worktrees/`, which is why they accumulated THERE), and **neither is
 * visible to this gate's own observers**: the porcelain and the mtime sweep
 * watch the working tree, not `.git`. Three of them had piled up before the
 * matrix noticed. ⛓ It cannot be seen as a NEW finding either — this file is
 * already on the import-door baseline, so its row is KNOWN and green whatever
 * its module scope does. A gate that cannot observe its own new side effect is
 * exactly what its own docblock is about.
 *
 * ⛓ WHAT THE GUARD PRESERVES, and why it is the honest fix rather than a
 * suppression: an IMPORTED run now behaves exactly as it did before SG1 — the
 * whole gate, in whatever tree it was imported from — which is precisely the
 * behaviour the baseline entry for this file records. The measured question is
 * unchanged and no baseline re-derivation is owed.
 *
 * ⛓ The HELP door never reached here: `argvHelp` prints and exits far above.
 */

if (!IN_PLACE && IS_ENTRY_POINT) {
    /* ⛓ `mkdtemp` reserves the NAME; `git worktree add` wants the path absent. */
    WORKTREE = mkdtempSync(join(tmpdir(), 'procgen-help-tree-'));
    rmSync(WORKTREE, { recursive: true, force: true });
    try {
        git(REPO, ['worktree', 'add', '-q', '--detach', WORKTREE, HEAD]);
    } catch (e) {
        console.log(`⛔ check-procgen-help: could not create a throwaway worktree at `
            + `${WORKTREE} — ${String(e.message ?? e).split('\n')[0]}\n`
            + '   ⛓ run with `--in-place` to drive THIS tree instead (⚠ the children really '
            + 'write: at the measured heads that means two tracked files dirtied and five '
            + 'untracked droppings).');
        process.exit(1);
    }
    /**
     * ⛔⛔ AND THE INIT IS ASSERTED, NOT TRUSTED. A cold worktree has NO
     * submodules, and several instruments guard on an artifact that lives in
     * one: without it they print SKIP and exit 0, i.e. they read as INERT FOR
     * THE WRONG REASON — a false green on the exact property this gate
     * measures. `submodule status` marks an uninitialised path with a leading
     * `-`, and that is a REFUSAL. ⛓ The set is DERIVED from the repo, never
     * named here: a submodule added tomorrow is covered without an edit.
     */
    try {
        git(WORKTREE, ['submodule', 'update', '--init', '-q']);
    } catch (e) {
        console.log(`⛔ check-procgen-help: \`submodule update --init\` failed in the `
            + `throwaway worktree — ${String(e.message ?? e).split('\n')[0]}`);
        process.exit(1);
    }
    const subs = git(WORKTREE, ['submodule', 'status']).split('\n').filter(Boolean);
    const uninit = subs.filter((l) => l.startsWith('-'));
    if (uninit.length) {
        console.log(`⛔ check-procgen-help: ${uninit.length} of ${subs.length} submodule(s) are `
            + 'UNINITIALISED in the throwaway worktree — an instrument guarded on an artifact '
            + 'inside one would print SKIP and exit 0, reading as INERT for the wrong reason:\n'
            + uninit.map((l) => `   ⛔ ${l.trim()}`).join('\n'));
        process.exit(1);
    }
    /**
     * ⛓⛓⛓ **AND `node_modules` IS LINKED IN — MEASURED, BY GETTING IT WRONG.**
     * A fresh worktree has none (it is gitignored), and node resolves an
     * import by walking UP from the importing FILE, so every instrument that
     * imports `@playwright/test` died with MODULE_NOT_FOUND. The first
     * worktree run filed `check-procgen-demos.mjs` as `HELP SIDE EFFECT —
     * exit 1` **in 91 ms**: a whole class of rows turned red for the harness,
     * not for the property. A change that moves the verdict set is not a
     * containment fix, it is a different gate.
     *
     * ⛔ IT IS A SYMLINK TO THE PRIMARY TREE'S, and that is a deliberate hole
     * in the containment with a reason: `node_modules` is a BUILD ARTIFACT,
     * not repository content — it is not in the porcelain, and the mtime sweep
     * has excluded it since the gate was written, so it was never part of what
     * "the tree moved" means here. `npm ci` into a throwaway would cost
     * minutes per run to isolate a population nothing observes.
     *
     * ⛓ AND ONLY THIS ONE. The other gitignored trees (`NewDocs/`, the nested
     * `node_modules` under `frontend/libs/` and `iframe_games/`) are NOT
     * linked: an instrument that needs gitignored CONTENT at import time is
     * doing work at import, which is the finding this gate exists to make.
     *
     * ⛔ TWO PROPERTIES OF THE LINK THAT ARE DELIBERATE, so the next reader
     * does not "improve" them:
     *   · `newerThan` runs `find` WITHOUT `-L`, so the mtime sweep does not
     *     descend through this symlink. Adding `-L` would sweep the primary
     *     tree's `node_modules` on every batch — slow, and it would report the
     *     hole below as a finding on whichever row happened to be running.
     *   · a child that WRITES through the link writes into the PRIMARY tree's
     *     `node_modules`. That hole is pre-existing and has always been
     *     unobserved (the path is out of the porcelain and out of the sweep),
     *     but under a worktree it now CROSSES TREES, which is worth knowing
     *     before someone reads "the droppings die with the worktree" as
     *     covering every byte a child can write.
     */
    const modules = join(REPO, 'node_modules');
    if (existsSync(modules)) symlinkSync(modules, join(WORKTREE, 'node_modules'), 'dir');

    TREE = WORKTREE;
    SUBMODULES = subs.length;
}

const DIR = join(TREE, 'scripts/procgen');
const instruments = readdirSync(DIR).filter((f) => f.endsWith('.mjs')).sort()
    .filter((f) => !ONLY || f === ONLY);
/**
 * ⛔ AN `--only=` THAT SELECTS NOTHING IS A REFUSAL BY NAME, never a stack
 * trace. Found while building W2: `--only=argvHelp.js` (a `.js`, so not an
 * instrument) ran the whole tree setup and then died in the summary line with
 * `Cannot read properties of undefined (reading 'file')` — a typo reported as
 * a crash, which is the failure `boxLock`'s own docblock names one directory
 * over: a refusal is a printed sentence and an exit code.
 */
if (ONLY && !instruments.length) {
    console.log(`check-procgen-help: --only=${ONLY} matched NO instrument in `
        + `${TREE === REPO ? 'this tree' : `the worktree at ${HEAD.slice(0, 9)}`}'s `
        + 'scripts/procgen/ — the population is its `*.mjs` files, named exactly '
        + '(e.g. `--only=solve-seedling-r9-campaign.mjs`).');
    process.exit(1);
}

/**
 * ⛔⛔ **AN OBSERVER THAT CANNOT READ THE TREE REFUSES BY NAME.** Measured by
 * another session: a SIGKILLed child's git op left an `index.lock`, every
 * subsequent `git status` died with *"Another git process seems to be
 * running"*, and the gate produced **nine minutes of one repeated fatal and no
 * verdict at all** — an exit code that is not a verdict. A bounded retry
 * covers a lock that is about to go away on its own; past that the run STOPS
 * and says what it could not do.
 */
const PORCELAIN_TRIES = 3;
/**
 * ⛓ One reader, two subjects: the batch observers ask about TREE, the header
 * asks about the PRIMARY tree (what a worktree run cannot see).
 *
 * ⛔⛔ `--no-optional-locks` IS LOAD-BEARING, AND IT IS THE OBSERVER'S ALONE.
 * `git status` takes `index.lock` OPPORTUNISTICALLY, only to refresh the
 * index — it does not need it to answer. Another session measured what that
 * costs: a SIGKILLed child's git op left the lock behind, every subsequent
 * status died with *"Another git process seems to be running"*, and the gate
 * produced nine minutes of one repeated fatal and NO VERDICT. A read that
 * cannot be blocked cannot be the thing that dies.
 *
 * ⛔⛔ AND IT IS DELIBERATELY NOT PUT IN THE CHILDREN'S ENVIRONMENT
 * (`GIT_OPTIONAL_LOCKS=0`), which would suppress their lock-taking too —
 * **TRAP 789: the instrument SUPPRESSED the effect it measures, and the null
 * read as inertness.** This gate's subject is what an import DOES, and taking
 * a git lock is one of the things it can do — the same class as taking the box
 * lock, which this gate already reports by name (that is what
 * `verify-seedling-ap-placement.mjs` is on the baseline for). Making the
 * children stop doing the observable thing would suppress the evidence along
 * with the collision. A child that genuinely collides is a finding about THAT
 * INSTRUMENT; the bounded retry below is what keeps the run alive to report it.
 *
 * ⛓ Independently disqualifying: without the index refresh a stat-dirty file
 * reads as MODIFIED, so a child that only touched an mtime would be reported
 * as having moved the porcelain — a manufactured finding in a gate whose whole
 * output is findings.
 *
 * ⛓⛓ THE RULE THAT FALLS OUT, and it is a rule and not a coincidence: this
 * gate injects exactly two variables into a child, and each one either
 * ISOLATES it (`XDG_CACHE_HOME`) or NORMALISES its output (`NO_COLOR`).
 * Nothing it injects changes what the child is ABLE to do. A third variable
 * has to pass that test.
 */
const porcelainOf = (cwd) => execFileSync('git',
    ['--no-optional-locks', 'status', '--porcelain'],
    { cwd, encoding: 'utf8', maxBuffer: 1 << 26 });
function porcelain() {
    let last = null;
    for (let i = 0; i < PORCELAIN_TRIES; i += 1) {
        try {
            return porcelainOf(TREE);
        } catch (e) {
            last = e;
            /* ⛓ a coarse wait: a lock held by a dying child clears in ms. */
            if (i + 1 < PORCELAIN_TRIES) { try { execFileSync('sleep', ['2']); } catch { /**/ } }
        }
    }
    console.log(`\n⛔ check-procgen-help: THE PORCELAIN OBSERVER COULD NOT READ ${TREE} after `
        + `${PORCELAIN_TRIES} tries — ${String(last?.stderr ?? last?.message ?? last)
            .split('\n').filter(Boolean)[0]}\n`
        + '   ⛓ This is a REFUSAL, not a verdict: the run stops here rather than reporting '
        + 'rows judged by an observer that was not working.\n'
        + '   ⛓ A stale `index.lock` under the tree\'s gitdir is the usual cause — a child '
        + 'this gate SIGKILLed at its ceiling mid-git-op.');
    process.exit(1);
    /* c8 ignore next */
    return '';
}

/** ⛓ …and the gitignored writes the porcelain cannot see. */
const newerThan = (marker) => {
    try {
        return execFileSync('find', [TREE, '-newer', marker, '-type', 'f',
            '-not', '-path', '*/.git/*', '-not', '-path', '*/node_modules/*'],
        { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
            .map((p) => p.slice(TREE.length + 1))
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
            cwd: TREE,
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
function localWhy(kind, abs, r, cacheFiles, ceiling, importErr = null, importOut = null,
    file = '') {
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
        const theirs = new Set([...messages(importErr), ...(INHERITED.get(file) ?? [])]);
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
    /**
     * ⛔⛔ AN IMPORT THAT PRINTS IS DOING WORK — AND THIS OBSERVER WAS MISSING.
     * `help.mjs`'s bare import falls through to printing all 262 instruments
     * and exits 0: no cache, no write, nothing on stderr, so every observer
     * the import door had was satisfied by a module that had just rendered a
     * page. It was only ever on the baseline because the WRITE run happened to
     * kill it at the deadline — the entry was LOAD-LUCK, and the "it was
     * fixed" direction went off the moment a quieter run let it finish. The
     * deadline was never the right instrument for this; stdout is.
     */
    if (kind === 'import' && r.out.trim()) {
        why.push(`printed ${r.out.trim().split('\n').length} line(s) to stdout on a bare `
            + `import: ${r.out.trim().split('\n')[0].slice(0, 90)}`);
    }
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
        const theirs = new Set([...(importOut ?? '').split('\n')
            .map((l) => l.trim()).filter(Boolean), ...(INHERITED.get(file) ?? [])]);
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
            execFileSync('git', ['checkout', '--', path], { cwd: TREE, encoding: 'utf8' });
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
            task.importErr ?? null, task.importOut ?? null, task.file),
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
 * ⛓⛓⛓ **THE RUN ANNOUNCES WHICH TREE IT DROVE** (⚖ 71 (b); trap 820 — a guard
 * cannot see which build it drives, so make the artifact announce it). Two
 * runs of this gate at one head now legitimately measure two different
 * populations — HEAD's, and this working tree's — and a log that did not say
 * which would be unattributable a week later.
 *
 * ⛔ AND A DIRTY PRIMARY TREE IS NAMED, NOT SUMMARISED. What a worktree run
 * cannot see is precisely the UNCOMMITTED instruments, so the warning lists the
 * `scripts/procgen/` paths that are dirty or untracked and points at the flag
 * that would measure them. "The tree is dirty" would leave the reader to work
 * out whether it mattered.
 *
 * ⛓ Held back under `--json`, whose stdout is a document a consumer parses.
 */
const treeLine = WORKTREE
    ? `## tree: THROWAWAY WORKTREE ${WORKTREE} at HEAD ${HEAD.slice(0, 9)} — the children run `
      + `there, both disk observers are scoped to it, ${SUBMODULES} submodule(s) initialised, `
      + 'and it is removed on exit and on signal (a killed child\'s git locks live under its '
      + 'own private gitdir and die with it).'
    : `## tree: IN PLACE (${IS_ENTRY_POINT ? '--in-place' : 'IMPORTED, not launched'}) `
      + `${REPO} at HEAD ${HEAD.slice(0, 9)} — ⚠ the children REALLY WRITE here; at the `
      + 'measured heads that is two tracked files dirtied and five untracked droppings, all '
      + 'declared in the baseline\'s `wrote:` lists.';
if (!JSON_OUT) {
    console.log(treeLine);
    if (WORKTREE) {
        const dirty = porcelainOf(REPO).split('\n').filter((l) => l.trim());
        const mine = dirty.map((l) => l.slice(3).split(' -> ').pop())
            .filter((f) => f.startsWith('scripts/procgen/'));
        if (dirty.length) {
            console.log(`## ⚠ the PRIMARY tree has ${dirty.length} uncommitted change(s) — this `
                + 'run measures HEAD, NOT your working tree.');
            console.log(mine.length
                ? `##   ⛔ uncommitted under scripts/procgen/ and therefore NOT in this run's `
                  + `population: ${mine.join(', ')} — use \`--in-place\` to measure them.`
                : '##   ⛓ none of them is under `scripts/procgen/`, so the population is the '
                  + 'same either way.');
        }
    }
    console.log('');
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
    /**
     * ⛓⛓ **ONE LINE PER BATCH, ON STDERR** — because until this slice an
     * in-flight run and a STALLED one looked identical from outside: nothing is
     * printed until both door passes are complete, and the incident that
     * motivated ⚖ 71 (b) was nine minutes of exactly that silence. ⛔ stderr,
     * not stdout: `--json`'s stdout is a document a consumer parses.
     */
    const batches = Math.ceil(doors.length / JOBS);
    for (let i = 0; i < doors.length; i += JOBS) {
        const batch = doors.slice(i, i + JOBS);
        console.error(`## ${kind} batch ${i / JOBS + 1}/${batches} — `
            + `${i}/${doors.length} door(s) done, ${((Date.now() - t0) / 1000).toFixed(0)} s: `
            + `${batch.map((t) => t.file).join(', ')}`);
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
        /** ⛔ A DOOR THIS FACE DID NOT ASK ABOUT IS NOT A DOOR THAT PASSED —
         *  under `--doors=ci` the 203 baselined import doors are SKIPPED, and
         *  the first cut read their empty finding list as "it was fixed" and
         *  printed the retirement notice for every one of them. */
        const asked = r.import.asked !== false;
        const ok = r.help.ok && (!asked || (r.import.ok ? !known : known));
        const mark = (d, was) => (was ? (d.ok ? 'ok' : 'SIDE EFFECT') : 'not asked');
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${r.file} — `
            + `HELP ${mark(r.help, true)} (${r.help.ms} ms) · IMPORT ${mark(r.import, asked)}`
            + `${known ? ' (KNOWN)' : ''}${asked ? ` (${r.import.ms} ms)` : ''}`);
        for (const w of r.help.why) console.log(`    ⛔ HELP: ${w}`);
        if (asked && !r.import.ok && !known) {
            for (const w of r.import.why) console.log(`    ⛔ IMPORT: ${w}`);
        }
        if (asked && r.import.ok && known) {
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
    const head = HEAD;
    /**
     * ⛓ EACH ENTRY CARRIES THE DOOR IT FAILS AND, WHERE THERE IS ONE, THE
     * PATHS IT WROTE — so a later slice can retire an entry BY NAME and know
     * what closing it has to preserve, instead of re-running the census.
     */
    /**
     * ⛓ WHAT EACH FILE'S HELP DOOR INHERITED FROM ITS IMPORTS — the
     * INTERSECTION of that file's two doors, computed here because this is the
     * only run that has both. ⛔ Stack frames are excluded for the same reason
     * `localWhy` excludes them: a frame differs between launch methods for the
     * same warning.
     */
    const lines = (t) => new Set((t ?? '').split('\n').map((l) => l.trim())
        .filter((l) => l && !/^at\s/.test(l)));
    const inheritedOf = (r) => {
        const imp = new Set([...lines(r.import.stdout), ...lines(r.import.stderr)]);
        return [...new Set([...lines(r.help.stdout), ...lines(r.help.stderr)])]
            .filter((l) => imp.has(l)).sort();
    };
    const effectful = Object.fromEntries(rows.filter((r) => !r.import.ok)
        .sort((a, b) => a.file.localeCompare(b.file))
        .map((r) => [r.file, {
            why: r.import.why,
            /** ⛓ the lines this file's `--help` could not avoid (see INHERITED). */
            inheritedOutput: inheritedOf(r),
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
/** ⛔ …and the VERDICT says which tree it is about. An exit code without a
 *  summary is not a verdict, and a summary that does not name its subject is
 *  a number somebody will read against the wrong tree. */
console.log(treeLine);
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
