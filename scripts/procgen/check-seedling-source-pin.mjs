#!/usr/bin/env node
/**
 * check-seedling-source-pin — **THE SEEDLING SOURCE SUBMODULE IS THE SOURCE
 * THE SHIPPED BUILDS WERE COMPILED FROM** (slice seedling-headless-V1). Node
 * only, no browser, no dev server, no box lock: it reads git and one file.
 *
 * `vendor/seedling` is the `PeerInfinity/Seedling` fork as a submodule, and
 * every seedling-reading instrument reads it (`seedlingSource.js`). The wasm
 * builds record the AS3 commit each was compiled from, in
 * `frontend/modules/flashPanel/wasm/builds.json` (`source.repo` +
 * `source.commit`). Two pins of one fact drift silently — a gitlink bumped
 * without a rebuild would have every extractor describe a game no shipped
 * build runs — so this gate holds them together:
 *
 *   (i)   the gitlink of `vendor/seedling` at HEAD EQUALS the `source.commit`
 *         of the build whose `role` is `default` (the build the host drives) —
 *         ⛓ or, when the manifest pins a `candidate` beside it (R9 slice P4E,
 *         the next default), THAT build's: the pinned tree must contain every
 *         build's source (row iii), and the candidate's is the newest;
 *   (ii)  the checked-out submodule IS at that gitlink (a checkout that drifted
 *         feeds every extractor a different tree than the one pinned);
 *   (iii) every OTHER build compiled from the fork has a `source.commit` that
 *         is an ANCESTOR of the gitlink — the pinned tree contains each
 *         build's source, so one submodule serves them all;
 *   (iv)  ⚖ js-6's pin ruling (slice seedling-tut-F2b-2, 2026-10-14): the
 *         in-browser recompiler the app ships (`swfrecomp-browser`, the
 *         submodule at BROWSER_SUBMODULE) was built from the SAME SWFRecomp-CC
 *         commit as the build row (i) selects — its `release.json`
 *         `source.commit` EQUALS that build's `source.recompiler`, FULL SHAs on
 *         both sides. So the S1 tutorial can say truthfully that the page
 *         recompiles with the recompiler that built the game the reader plays.
 *         A release present but UNSTAMPED is a named FAIL; an uninitialised
 *         submodule (or no `release.json`) is a `SKIP:` by name.
 *         ⛓ Its OFFLINE SUB-ROW (iv-b): a page-only release records
 *         `source.buildInputsUnchanged` (`from`, `to`, `diff`): the build
 *         inputs did not move between the commit the binaries came from and
 *         the commit the page came from. `from` must equal `source.commit`,
 *         and every `diff` path must be in THIS FILE'S literal
 *         BUILD_INPUT_ALLOWLIST — the release's own `allowlist` field is
 *         informational only, so a release cannot vouch for itself. The field
 *         absent = PASS (the page and the binaries share one commit). No git
 *         diff is run: CI has no SWFRecomp-CC history.
 *
 * ⛓ The builds are selected by DATA (`role`, `source.repo`), never by name,
 * so a renamed or added build needs no edit here.
 *
 * ⛔ AN UNINITIALISED SUBMODULE IS A REFUSAL, NOT A FAILURE (`SKIP:`, exit 0,
 * `ALL PASS — REFUSED`): "the question could not be put" is not "the pins
 * disagree" — the model is `check-seedling-full-tier-owed.mjs`. The same holds
 * for an uninitialised wasm submodule (no `builds.json` to read).
 *
 * ⛔ AND ROW (iii) CANNOT BE ASKED OF A SHALLOW CLONE. CI checks submodules
 * out at depth 1, where no ancestor of the gitlink exists, so (iii) is
 * `SKIP:` by name there and (i)–(ii) still answer.
 *
 * ⛓ ITS SUBJECT IS THE `vendor/seedling` GITLINK, which the derived BUILD
 * population cannot see: it reaches a submodule by containment or by a CODE
 * member spelling a path INTO it (`vendor/seedling/…`), and this gate reads the
 * gitlink with `git ls-tree` under the bare name. Measured at V1: the derived
 * key held the wasm gitlink and not this one, so a bumped pin would have left
 * this row's key unmoved. Declared:
 *
 * @key-inputs build: vendor/seedling frontend/modules/swfRecompilerPanel/browser
 *
 * ⛓ NO `@ci-shallow` DECLARATION, SINCE G1 (`8ce80b7819`): row (iii) asks
 *    `merge-base --is-ancestor` of the submodule, which a depth-1 submodule
 *    checkout cannot answer — so the vitest job UNSHALLOWS `vendor/seedling`
 *    before vitest and the gates (measured: 1 → 33 commits in 1 s), and CI
 *    reads the same `3/0` the box does (run 35011021071). The declaration was
 *    born with the gate at V1 and read UNVERIFIABLE for one run; it came off
 *    after G1 because a declaration that names a limit CI no longer has would
 *    keep `ci-summary --gates` reporting this arm as `shallow` forever.
 *
 * ⛓ ADOPTED INTO THE HEADLESS CI SET AT BIRTH (the vitest job's `ci-gates.mjs`
 *    step): pure node, no server, no browser, no box lock. Its price on the box
 *    is stated in its slice's commit; the runner's is read back off the first
 *    CI run by `--write-costs`.
 *
 * Run:
 *   node scripts/procgen/check-seedling-source-pin.mjs
 *   node scripts/procgen/check-seedling-source-pin.mjs --repo=<dir>   (a fixture repository; the rows' door)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { SEEDLING_REPO, SEEDLING_SUBMODULE } from './seedlingSource.js';

/** The pin manifest, inside the wasm submodule. */
export const BUILDS_JSON = 'frontend/modules/flashPanel/wasm/builds.json';
/** Row (iv): the in-browser recompiler release (`PeerInfinity/swfrecomp-browser`) and its manifest. */
export const BROWSER_SUBMODULE = 'frontend/modules/swfRecompilerPanel/browser';
export const RELEASE_JSON = `${BROWSER_SUBMODULE}/release.json`;
/**
 * Row (iv-b): the SWFRecomp-CC paths a page-only release may show changed
 * between `source.commit` and the page's commit, each with the reason it
 * cannot reach a built file. ⛔ Literal on purpose: the release's own
 * `allowlist` is informational, so it cannot widen this.
 */
export const BUILD_INPUT_ALLOWLIST = Object.freeze({
    'SWFRecomp/assets/NotoSans-OFL.txt':
        'the licence text beside the font; CMake embeds only assets/NotoSans.ttf (--embed-file of that one file)',
});
const FULL_SHA = /^[0-9a-f]{40}$/;
const RERELEASE = 're-release swfrecomp-browser from the default build\'s recompiler commit, or a re-pin (user-gated)';

const git = (cwd, args) => execFileSync('git', args,
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (cwd, args) => {
    try { execFileSync('git', args, { cwd, stdio: 'ignore' }); return true; } catch { return false; }
};
const short = (sha) => String(sha).slice(0, 10);

/**
 * The rows, as `{ kind: 'PASS'|'FAIL'|'SKIP', msg }`, plus `refused` when the
 * question could not be put at all.
 */
export function checkSourcePin({ repo }) {
    const rows = [];
    const row = (kind, msg) => rows.push({ kind, msg });
    const manifestPath = join(repo, BUILDS_JSON);
    const builds = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).builds ?? [] : null;
    const pinning = builds ? pinningBuilds(builds) : null;

    sourceRows({ repo, builds, pinning, row });
    recompilerRows({ repo, builds, pinning, row });
    // ⛔ REFUSED = no pin was compared at all (every row a SKIP).
    return { rows, refused: rows.every((r) => r.kind === 'SKIP') };
}

/**
 * ⛓ P4E: a candidate, when there is one, is the build the submodule pins;
 * otherwise the default is. Two is a FAIL by name in row (i).
 */
function pinningBuilds(builds) {
    const fromFork = builds.filter((b) => b.source?.repo === SEEDLING_REPO);
    const pinRole = fromFork.some((b) => b.role === 'candidate') ? 'candidate' : 'default';
    return { fromFork, pinRole, defaults: fromFork.filter((b) => b.role === pinRole) };
}

/** Rows (i)–(iii): the `vendor/seedling` gitlink against the builds' AS3 sources. */
function sourceRows({ repo, builds, pinning, row }) {
    const sub = join(repo, SEEDLING_SUBMODULE);
    if (!existsSync(join(sub, '.git'))) {
        row('SKIP', `the ${SEEDLING_SUBMODULE} submodule is not initialised — git submodule update --init ${SEEDLING_SUBMODULE}`);
        return;
    }
    if (!builds) {
        row('SKIP', `no ${BUILDS_JSON} — the wasm submodule is not initialised, so no build names a source`);
        return;
    }

    const lsTree = git(repo, ['ls-tree', 'HEAD', SEEDLING_SUBMODULE]);
    const m = /^160000 commit ([0-9a-f]{40})\t/.exec(lsTree);
    if (!m) {
        row('FAIL', `HEAD carries no gitlink at ${SEEDLING_SUBMODULE} (ls-tree: ${JSON.stringify(lsTree)})`);
        return;
    }
    const gitlink = m[1];
    const { fromFork, pinRole, defaults } = pinning;

    // (i) the gitlink is the pinning build's source
    if (defaults.length !== 1) {
        row('FAIL', `${BUILDS_JSON} names ${defaults.length} build(s) with role "${pinRole}" compiled from `
            + `${SEEDLING_REPO} — exactly one is the build the submodule pins`);
    } else {
        const [d] = defaults;
        row(d.source.commit === gitlink ? 'PASS' : 'FAIL',
            `(i) the ${SEEDLING_SUBMODULE} gitlink ${short(gitlink)} ${d.source.commit === gitlink ? 'EQUALS' : 'is NOT'} `
            + `the ${pinRole} build ${d.name}'s source.commit ${short(d.source.commit)}`
            + (d.source.commit === gitlink ? '' : ' — bump the gitlink to the source the build was compiled from, '
                + 'or rebuild and re-record the manifest'));
    }

    // (ii) the checkout is at the gitlink
    const head = git(sub, ['rev-parse', 'HEAD']);
    row(head === gitlink ? 'PASS' : 'FAIL',
        `(ii) the ${SEEDLING_SUBMODULE} checkout is ${head === gitlink ? 'AT' : 'NOT at'} the gitlink `
        + `(HEAD ${short(head)})` + (head === gitlink ? '' : ` — git submodule update ${SEEDLING_SUBMODULE}`));

    // (iii) every other fork build's source is contained in the pinned tree
    const shallow = git(sub, ['rev-parse', '--is-shallow-repository']) === 'true';
    for (const b of fromFork.filter((x) => !defaults.includes(x))) {
        const c = b.source.commit;
        if (shallow) {
            row('SKIP', `(iii) ${b.name}'s source.commit ${short(c)}: the submodule is a SHALLOW clone, `
                + 'which carries no ancestor of its head — the question cannot be put here');
            continue;
        }
        const ancestor = gitOk(sub, ['merge-base', '--is-ancestor', c, gitlink]);
        row(ancestor ? 'PASS' : 'FAIL',
            `(iii) ${b.name}'s source.commit ${short(c)} ${ancestor ? 'IS' : 'is NOT'} an ancestor of the gitlink `
            + `${short(gitlink)}` + (ancestor ? '' : ' (or is not in the submodule\'s history at all)'));
    }
}

/** Row (iv) and its offline sub-row (iv-b): the in-browser recompiler release against the pinning build. */
function recompilerRows({ repo, builds, pinning, row }) {
    const releasePath = join(repo, RELEASE_JSON);
    if (!existsSync(join(repo, BROWSER_SUBMODULE, '.git')) || !existsSync(releasePath)) {
        row('SKIP', `(iv) the ${BROWSER_SUBMODULE} submodule is not initialised (no ${RELEASE_JSON}), so (iv) and `
            + `its sub-row cannot be asked — git submodule update --init ${BROWSER_SUBMODULE}`);
        return;
    }
    if (!builds) {
        row('SKIP', `(iv) no ${BUILDS_JSON} — the wasm submodule is not initialised, so no build names a recompiler`);
        return;
    }
    let release;
    try {
        release = JSON.parse(readFileSync(releasePath, 'utf8'));
    } catch (e) {
        row('FAIL', `(iv) ${RELEASE_JSON} is not JSON: ${e.message}`);
        return;
    }
    const commit = release?.source?.commit;
    if (typeof commit !== 'string' || !FULL_SHA.test(commit)) {
        row('FAIL', `(iv) ${RELEASE_JSON} is UNSTAMPED: source.commit is ${JSON.stringify(commit ?? null)}, not a full `
            + 'SHA — the release must name the SWFRecomp-CC commit its built files came from');
        return;
    }
    const { pinRole, defaults } = pinning;
    if (defaults.length !== 1) {
        row('FAIL', `(iv) ${BUILDS_JSON} names ${defaults.length} build(s) with role "${pinRole}" compiled from `
            + `${SEEDLING_REPO}, so no one recompiler is pinned`);
    } else {
        const [d] = defaults;
        const recompiler = d.source?.recompiler;
        if (typeof recompiler !== 'string' || !FULL_SHA.test(recompiler)) {
            row('FAIL', `(iv) the ${pinRole} build ${d.name} records source.recompiler ${JSON.stringify(recompiler ?? null)}, `
                + 'not a full SHA — the manifest must name the SWFRecomp-CC commit it was built with');
        } else {
            const equal = commit === recompiler;
            row(equal ? 'PASS' : 'FAIL',
                `(iv) swfrecomp-browser's source.commit ${commit} ${equal ? 'EQUALS' : 'is NOT'} the ${pinRole} build `
                + `${d.name}'s source.recompiler ${recompiler}` + (equal ? '' : ` — ${RERELEASE}`));
        }
    }

    // (iv-b) a page-only release: its build inputs did not move
    const unchanged = release.source.buildInputsUnchanged;
    if (unchanged === undefined) {
        row('PASS', '(iv-b) no source.buildInputsUnchanged: the release\'s page and built files come from source.commit itself');
        return;
    }
    const problems = [];
    if (unchanged?.from !== commit) {
        problems.push(`its from ${JSON.stringify(unchanged?.from ?? null)} is not source.commit ${short(commit)}`);
    }
    if (!Array.isArray(unchanged?.diff)) {
        problems.push(`its diff is ${JSON.stringify(unchanged?.diff ?? null)}, not a list of paths`);
    } else {
        const outside = unchanged.diff.filter((p) => !Object.prototype.hasOwnProperty.call(BUILD_INPUT_ALLOWLIST, p));
        if (outside.length) problems.push(`its diff names ${outside.join(', ')}, outside this checker's allowlist`);
    }
    row(problems.length ? 'FAIL' : 'PASS',
        problems.length
            ? `(iv-b) source.buildInputsUnchanged does not hold: ${problems.join('; ')} — ${RERELEASE}`
            : `(iv-b) source.buildInputsUnchanged holds: from = source.commit, and its diff `
                + `(${unchanged.diff.length} path(s)${unchanged.diff.length ? `: ${unchanged.diff.join(', ')}` : ''}) `
                + `is inside this checker's allowlist, to ${short(unchanged.to)}`);
}

async function main() {
    const repoArg = process.argv.slice(2).find((a) => a.startsWith('--repo='));
    const repo = repoArg ? resolve(repoArg.slice('--repo='.length))
        : join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const { rows, refused } = checkSourcePin({ repo });
    for (const r of rows) console.log(`${r.kind}: ${r.msg}`);
    const n = (k) => rows.filter((r) => r.kind === k).length;
    if (refused) {
        console.log('\nALL PASS — REFUSED: this tree cannot be asked (0 pins compared, NONE claimed green). '
            + '⛔ This is NOT "the pins agree"; it is "the question could not be put".');
        process.exit(0);
    }
    if (n('FAIL') === 0) {
        console.log(`\nALL PASS — ${n('PASS')} VERIFIED, ${n('SKIP')} UNVERIFIABLE (not claimed green)`);
        process.exit(0);
    }
    console.log(`\n${n('FAIL')} CHECK(S) FAILED`);
    process.exit(1);
}

argvHelp(import.meta.url);
if (isEntryPoint(import.meta.url)) await main();
