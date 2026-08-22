#!/usr/bin/env node
/**
 * reach-seedling-change — **WHAT CAN THIS CHANGE MOVE?** The transitive
 * import closure from a set of changed files to the producers, gates, tests,
 * pages, TAPES, chains and identity-block rows that reach them. R9 slice 11b,
 * ⚖ ruling 32 B.
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 *
 * A slice seals its movers BEFORE it edits, and until now that seal was built
 * by grepping. R9 slice 11 grepped the entry script, sealed *"the pairs dumps
 * do not import the oracle at all"*, and four identity rows moved anyway
 * (kickoff §21.5, trap 555): `procgenSeedling.js:54` imports `procgenOracle`,
 * so generating a level RUNS the certify solve. One hop past the grep.
 *
 * This instrument answers the same question as a graph. It walks the REVERSE
 * import graph — from the changed file to everything that imports it, however
 * far — over `frontend/modules/**` and `scripts/procgen/**`, resolving the
 * `await import(join(REPO, '…'))` form that no grep for `from '…'` can see
 * (trap 543), with the bases DERIVED per file rather than listed (⚖ ruling
 * 17). What it cannot resolve it PRINTS.
 *
 * ⚠⚠ AND THE ANSWER IS AN UPPER BOUND. It says what CAN move, not what WILL:
 * slice 11 reached the ELEMENTS census exactly the way it reached the ENEMY
 * census and only the second one moved. The list is what a seal must have an
 * opinion about, not a forecast that every row moves.
 *
 * ── Run ───────────────────────────────────────────────────────────────
 *
 *   node scripts/procgen/reach-seedling-change.mjs --range=A..B
 *   node scripts/procgen/reach-seedling-change.mjs --files=a.js,b.js
 *   node scripts/procgen/reach-seedling-change.mjs frontend/modules/x.js
 *   node scripts/procgen/reach-seedling-change.mjs --symbol=<file>#<export>
 *   node scripts/procgen/reach-seedling-change.mjs --range=A..B --check=seal.txt
 *   …--json                                        machine-readable, same data
 *   …--only-list                                   the `--only=` argument itself
 *
 * ⛓ `--only-list` prints ONE line — the roster gate's selection for this change,
 * ⚖ ruling 33: every tape whose producer the change reaches, PLUS every tape of
 * every chain those tapes belong to (a moved segment moves its chain's headline
 * and its siblings' seams). Feed it straight in:
 *
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win \
 *     --only=$(node scripts/procgen/reach-seedling-change.mjs --range=A..B --only-list)
 *
 * `--check=<file>` reads a seal — one predicted mover per line, `#` comments
 * and blanks ignored — and FAILS (exit 1) when the closure reaches something
 * the seal does not name. A seal that names MORE than the reach is fine and
 * is reported: an upper bound cannot refute a prediction, only a claim of
 * inertia. `--symbol` narrows the seeds to the files that name one export.
 *
 * ⛔ NO WRITES. This instrument reads the tree and prints; nothing about a
 * reach belongs in a committed artifact, because the answer is a property of
 * the diff and not of the repo.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    DEFAULT_ROOTS, REPO, UPPER_BOUND_SENTENCE,
    buildGraph, movers, reachReport, symbolSeeds,
} from './reachClosure.js';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const arg = (name) => argv.filter((a) => a.startsWith(`--${name}=`))
    .map((a) => a.slice(name.length + 3)).pop();

const RANGE = arg('range');
const FILES = arg('files');
const SYMBOL = arg('symbol');
const CHECK = arg('check');
const JSON_OUT = flag('json');
const ONLY_LIST = flag('only-list');
const positional = argv.filter((a) => !a.startsWith('--'));

if (flag('help') || (!RANGE && !FILES && !SYMBOL && positional.length === 0)) {
    console.log(readFileSync(new URL(import.meta.url), 'utf8')
        .split('\n').slice(1, 48).map((l) => l.replace(/^ ?\*\/?/, '')).join('\n'));
    process.exit(flag('help') ? 0 : 1);
}

/** The changed files, from whichever input mode was asked for. */
function changedFiles() {
    const out = new Set(positional);
    if (FILES) for (const f of FILES.split(',').map((s) => s.trim()).filter(Boolean)) out.add(f);
    if (RANGE) {
        const listed = execFileSync('git', ['diff', '--name-only', RANGE],
            { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
        for (const f of listed) out.add(f);
    }
    return [...out].sort();
}

const graph = buildGraph({ repo: REPO, roots: DEFAULT_ROOTS });

let seedFiles = changedFiles();
let symbolNote = null;
if (SYMBOL) {
    const [file, exportName] = SYMBOL.split('#');
    if (!file || !exportName) {
        console.error('FAIL: --symbol wants <file>#<export>');
        process.exit(1);
    }
    if (!graph.nodes.has(file)) {
        console.error(`FAIL: ${file} is not a node of the graph `
            + `(${DEFAULT_ROOTS.join(', ')} only)`);
        process.exit(1);
    }
    const direct = symbolSeeds({ file, exportName, repo: REPO, graph });
    const allImporters = [...(graph.reverse.get(file) ?? [])];
    symbolNote = `${direct.length} of ${allImporters.length} importer(s) of `
        + `${file} name \`${exportName}\`; the other `
        + `${allImporters.length - direct.length} import the FILE for something else `
        + 'and are still that file\'s dependents';
    seedFiles = [...new Set([...seedFiles, ...direct])].sort();
}

const report = await reachReport(seedFiles, { repo: REPO, roots: DEFAULT_ROOTS, graph });

/**
 * ⚖ RULING 33's SELECTION: the reached tapes, widened to their WHOLE chains.
 * A segment that moves moves the headline it sums into and the seams its
 * siblings are checked against, so a selection that named only the reached
 * tape would gate a chain by one third of itself.
 */
async function onlyList(rep) {
    const names = new Set(rep.tapes.map((t) => t.tape));
    if (rep.chains.length > 0) {
        const { PLAYTHROUGH_CHAINS } = await import(
            new URL('../../frontend/modules/seedlingDemo/playthroughWalk.js', import.meta.url).href);
        for (const c of PLAYTHROUGH_CHAINS) {
            if (!rep.chains.includes(c.id)) continue;
            for (const n of c.segments) names.add(n);
            if (c.headline) names.add(c.headline);
        }
    }
    return [...names].sort();
}

if (ONLY_LIST) {
    console.log((await onlyList(report)).join(','));
} else if (JSON_OUT) {
    console.log(JSON.stringify({
        seeds: report.seeds,
        offGraph: report.offGraph,
        reached: [...report.reached].sort(),
        producers: report.producers,
        gates: report.gates,
        tests: report.tests,
        pages: report.pages,
        tapes: report.tapes,
        chains: report.chains,
        identity: report.identity,
        movers: movers(report),
        unresolvedEdges: report.unresolved.length,
        upperBound: UPPER_BOUND_SENTENCE,
    }, null, 2));
} else {
    const section = (title, rows, render = (r) => r) => {
        console.log(`\n── ${title} (${rows.length}) ──`);
        if (rows.length === 0) console.log('   (none)');
        for (const r of rows) console.log(`   ${render(r)}`);
    };
    console.log(`REACH — ${report.seeds.length} changed file(s) on the graph, `
        + `${report.reached.size} node(s) reached`);
    console.log(UPPER_BOUND_SENTENCE);
    if (report.offGraph.length > 0) {
        console.log(`\n⚠ ${report.offGraph.length} changed path(s) are NOT nodes of this `
            + `graph (outside ${DEFAULT_ROOTS.join(' / ')}, or not a .js/.mjs/.html): `
            + `${report.offGraph.join(', ')}`);
    }
    if (symbolNote) console.log(`\n⚠ --symbol: ${symbolNote}`);
    section('SEEDS', report.seeds);
    section('PRODUCERS (solve-/plan-/rerecord- with a --check)', report.producers);
    section('GATES (check-/verify-)', report.gates);
    section('PAGES (watch*)', report.pages);
    section('TESTS', report.tests);
    section('TAPES whose producer is reached', report.tapes,
        (t) => `${t.tape}  ← ${t.producer.split('/').pop()}`);
    section('CHAINS those tapes belong to', report.chains);
    section('IDENTITY-BLOCK rows reached', report.identity,
        (r) => `${r.label}  ← ${r.script.split('/').pop()}`);
    console.log(`\n── OTHER MODULES REACHED (${report.modules.length}) ──`);
    console.log(`   ${report.modules.length} module file(s); pass --json for the list`);
    if (report.unresolved.length > 0) {
        console.log(`\n⚠ ${report.unresolved.length} DYNAMIC IMPORT(S) COULD NOT BE `
            + 'RESOLVED STATICALLY — a variable segment. They are reported rather than '
            + 'dropped, because a silently-pruned edge makes an upper bound untrue:');
        for (const u of report.unresolved.slice(0, 12)) {
            console.log(`   ${u.file}: import(${u.expr})`);
        }
        if (report.unresolved.length > 12) {
            console.log(`   … and ${report.unresolved.length - 12} more`);
        }
    }
}

if (CHECK && !ONLY_LIST) {
    const path = join(REPO, CHECK);
    const sealPath = existsSync(path) ? path : CHECK;
    if (!existsSync(sealPath)) {
        console.error(`\nFAIL: --check=${CHECK} does not exist`);
        process.exit(1);
    }
    const sealed = new Set(readFileSync(sealPath, 'utf8').split('\n')
        .map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean));
    const reachedMovers = movers(report);
    const unnamed = reachedMovers.filter((m) => !sealed.has(m));
    const extra = [...sealed].filter((s) => !reachedMovers.includes(s)).sort();
    console.log(`\n── SEAL CHECK against ${CHECK} ──`);
    console.log(`   ${reachedMovers.length} mover(s) reached, ${sealed.size} sealed`);
    if (extra.length > 0) {
        console.log(`   ⚠ ${extra.length} sealed name(s) the reach does NOT include — an `
            + 'upper bound cannot refute a prediction of movement, only a claim of '
            + `inertia: ${extra.join(', ')}`);
    }
    if (unnamed.length > 0) {
        console.log(`\nFAIL: ${unnamed.length} reached mover(s) the seal does not name:`);
        for (const m of unnamed) console.log(`   ${m}`);
        process.exit(1);
    }
    console.log('   PASS: every reached mover is named by the seal');
}
