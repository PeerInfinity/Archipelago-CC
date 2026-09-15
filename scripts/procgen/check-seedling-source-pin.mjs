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
 *         of the build whose `role` is `default` (the build the host drives);
 *   (ii)  the checked-out submodule IS at that gitlink (a checkout that drifted
 *         feeds every extractor a different tree than the one pinned);
 *   (iii) every OTHER build compiled from the fork has a `source.commit` that
 *         is an ANCESTOR of the gitlink — the pinned tree contains each
 *         build's source, so one submodule serves them all.
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
 * @ci-shallow row (iii) asks `merge-base --is-ancestor` of the submodule, and a depth-1 submodule checkout carries no ancestor of its own head
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
    const sub = join(repo, SEEDLING_SUBMODULE);

    if (!existsSync(join(sub, '.git'))) {
        row('SKIP', `the ${SEEDLING_SUBMODULE} submodule is not initialised — git submodule update --init ${SEEDLING_SUBMODULE}`);
        return { rows, refused: true };
    }
    const manifestPath = join(repo, BUILDS_JSON);
    if (!existsSync(manifestPath)) {
        row('SKIP', `no ${BUILDS_JSON} — the wasm submodule is not initialised, so no build names a source`);
        return { rows, refused: true };
    }

    const lsTree = git(repo, ['ls-tree', 'HEAD', SEEDLING_SUBMODULE]);
    const m = /^160000 commit ([0-9a-f]{40})\t/.exec(lsTree);
    if (!m) {
        row('FAIL', `HEAD carries no gitlink at ${SEEDLING_SUBMODULE} (ls-tree: ${JSON.stringify(lsTree)})`);
        return { rows, refused: false };
    }
    const gitlink = m[1];

    const builds = JSON.parse(readFileSync(manifestPath, 'utf8')).builds ?? [];
    const fromFork = builds.filter((b) => b.source?.repo === SEEDLING_REPO);
    const defaults = fromFork.filter((b) => b.role === 'default');

    // (i) the gitlink is the default build's source
    if (defaults.length !== 1) {
        row('FAIL', `${BUILDS_JSON} names ${defaults.length} build(s) with role "default" compiled from `
            + `${SEEDLING_REPO} — exactly one is the build the submodule pins`);
    } else {
        const [d] = defaults;
        row(d.source.commit === gitlink ? 'PASS' : 'FAIL',
            `(i) the ${SEEDLING_SUBMODULE} gitlink ${short(gitlink)} ${d.source.commit === gitlink ? 'EQUALS' : 'is NOT'} `
            + `the default build ${d.name}'s source.commit ${short(d.source.commit)}`
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
    return { rows, refused: false };
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
