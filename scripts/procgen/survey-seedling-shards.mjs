#!/usr/bin/env node
/**
 * survey-seedling-shards — THE ROUTE SURVEY'S PLAN, MERGE, COMPARE AND FETCH,
 * for running it SHARDED on CI runners (rules arc, slice `rules-survey-ci`;
 * ⚖ user 2026-10-06: CPU-heavy work runs in CI, off the box).
 *
 * The solves themselves are `survey-seedling-route.mjs`, unchanged: a shard is
 * `--through=<b> --route=<m> --only=<its steps> --out=<shard file>`. This file
 * is everything around that, over the pure halves in `surveyShards.js`:
 *
 *   --bound    print the frontier's bound (`surveyRoute.chainBound` over the
 *              committed chain) — what the census reads, so the workflow's
 *              default `through` is read, not typed.
 *   --plan     read the route (`route.json`, written by the survey's own
 *              `--derive-only`) and price-balance its steps over `--shards=<n>`.
 *              The price is a prior survey's `ms` (`--costs=<survey.json>`,
 *              matched by step identity); without one it is uniform and says so.
 *              `--json` prints the GitHub matrix and each shard's job timeout.
 *   --merge    assemble the shards' `--out` files (`--shard=<file>`, repeated,
 *              or `--shards-dir=<dir>`) into `route.json` + `survey.json` under
 *              `throughSurveyDir` — byte-for-byte the unsharded run's format, so
 *              `census-seedling-campaign.mjs --check-frontier` reads it unchanged.
 *              ⛔ Refuses BY NAME (exit 1) a missing, duplicated, off-route or
 *              foreign-route step. `--base=<survey.json>` fills the steps no shard
 *              ran (an `--only` re-run); `--partial` writes what it has.
 *   --compare  two surveys of one route, verdict by verdict (`--compare=<a>
 *              --with=<b>`): the box-vs-runner equivalence table. A TIMEOUT
 *              disagreement is two machines' wall clocks, never a model gap.
 *   --fetch    `gh run download` a `seedling-survey.yml` run's merged artifact
 *              into this tree's survey directory (`--fetch=<run id>`), so a
 *              planner can `--write-frontier` locally from CI's survey.
 *
 * Run:
 *   node scripts/procgen/survey-seedling-shards.mjs --bound
 *   node scripts/procgen/survey-seedling-shards.mjs --plan --through=3.1 --route=full --shards=12 --timeout=1500
 *   node scripts/procgen/survey-seedling-shards.mjs --plan --through=3.1 --route=full --shards=12 --costs=<survey.json> --only=26,30 --json
 *   node scripts/procgen/survey-seedling-shards.mjs --plan --through=3.1 --route=full --route-json=<route.json>
 *   node scripts/procgen/survey-seedling-shards.mjs --merge --through=3.1 --route=full --shards-dir=<dir> --out-dir=<dir>
 *   node scripts/procgen/survey-seedling-shards.mjs --merge --through=3.1 --route=full --shard=<a.json> --shard=<b.json> --base=<survey.json>
 *   node scripts/procgen/survey-seedling-shards.mjs --merge --through=3.1 --route=full --shard=<a.json> --partial
 *   node scripts/procgen/survey-seedling-shards.mjs --compare=<box survey.json> --with=<ci survey.json> --md
 *   node scripts/procgen/survey-seedling-shards.mjs --fetch=<run id> --repo=PeerInfinity/Archipelago-CC --force
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);

const { compareSurveys, mergeShards, partitionSteps, stepCosts } = await import('./surveyShards.js');
const { seedlingSurveyDir, throughSurveyDir } = await import('./seedlingSurveyDir.js');

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argOf = (k, dflt = null) => {
    const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
    return hit === undefined ? dflt : hit.slice(k.length + 3);
};
const argsOf = (k) => process.argv.filter((a) => a.startsWith(`--${k}=`)).map((a) => a.slice(k.length + 3));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const fail = (msg) => { console.error(`ERROR: ${msg}`); process.exit(2); };

/** ⛔ The routes this file plans for, from the survey's own vocabulary. */
const { ROUTE_MODES } = await import('./surveyRoute.js');
function routeArgs() {
    const through = argOf('through');
    const mode = argOf('route', 'full');
    if (!through) fail('--through=<sphere>|end is required (--bound prints the frontier\'s)');
    if (!ROUTE_MODES.includes(mode)) fail(`--route=${mode} — the route modes are ${ROUTE_MODES.join(' | ')}`);
    return { through, mode };
}

/** The six-hour GitHub job cap, less margin. */
const JOB_CAP_MIN = 355;

if (process.argv.includes('--bound')) {
    const { chainBound } = await import('./surveyRoute.js');
    const { CAMPAIGN_SEGMENTS } = await import('../../frontend/modules/seedlingDemo/campaignChain.js');
    console.log(chainBound(readJson(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-sphere-order.json')).order,
        CAMPAIGN_SEGMENTS));
} else if (process.argv.includes('--plan')) {
    const { through, mode } = routeArgs();
    const routeP = argOf('route-json', join(throughSurveyDir(REPO, through, mode), 'route.json'));
    if (!existsSync(routeP)) fail(`${routeP} is not on disk — run survey-seedling-route.mjs --through=${through} --route=${mode} --derive-only first`);
    const route = readJson(routeP);
    if (route.routeMode?.mode !== mode || route.routeMode?.through !== through) {
        fail(`${routeP} is ${route.routeMode?.mode} through ${route.routeMode?.through}, not ${mode} through ${through}`);
    }
    const shardsN = Number(argOf('shards', '10'));
    const timeoutS = Number(argOf('timeout', '1500'));
    const only = argOf('only');
    let steps = route.steps;
    if (only) {
        const want = new Set(only.split(',').map((s) => s.trim()).filter(Boolean));
        const unknown = [...want].filter((id) => !steps.some((s) => String(s.step) === id));
        if (unknown.length) fail(`--only names step(s) not on the route: ${unknown.join(',')}`);
        steps = steps.filter((s) => want.has(String(s.step)));
    }
    const costsP = argOf('costs');
    const { costs, source } = stepCosts(steps, costsP && existsSync(costsP) ? readJson(costsP) : null);
    const shards = partitionSteps(steps.map((s) => String(s.step)), shardsN, costs);
    /**
     * ⛓ A job's timeout is its WORST case — every step running to the survey's
     * own `--timeout` — plus setup, capped under GitHub's six hours. A shard that
     * still overruns is killed, uploads nothing, and the merge names its steps.
     */
    const jobMinutes = (s) => Math.min(JOB_CAP_MIN, Math.ceil((s.steps.length * (timeoutS + 30)) / 60) + 15);
    const plan = {
        route: mode,
        through,
        steps: steps.length,
        costSource: source,
        shards: shards.map((s) => ({ ...s, timeoutMinutes: jobMinutes(s) })),
    };
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(plan));
    } else {
        console.log(`PLAN ${mode} through ${through}: ${steps.length} step(s) over ${shards.length} shard(s); price = ${source}`);
        for (const s of plan.shards) {
            console.log(`  shard ${s.shard}: ${s.steps.length} step(s) est ${Math.round(s.cost / 1000)} s, job cap ${s.timeoutMinutes} min — ${s.steps.join(',')}`);
        }
    }
} else if (process.argv.includes('--merge')) {
    const { through, mode } = routeArgs();
    const outDir = resolve(argOf('out-dir', throughSurveyDir(REPO, through, mode)));
    const routeP = argOf('route-json', join(outDir, 'route.json'));
    if (!existsSync(routeP)) fail(`${routeP} is not on disk — the plan's route (--derive-only) is what every shard must share`);
    const route = readJson(routeP);
    const files = [...argsOf('shard')];
    const dir = argOf('shards-dir');
    if (dir) {
        const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory()
            ? walk(join(d, e.name)) : /^shard-.*\.json$/.test(e.name) ? [join(d, e.name)] : []));
        files.push(...walk(dir).sort());
    }
    if (!files.length) fail('--merge needs --shard=<file> (repeated) or --shards-dir=<dir> holding shard-*.json');
    const shards = files.map((f) => ({ name: f.split('/').pop().replace(/\.json$/, ''), survey: readJson(f) }));
    const baseP = argOf('base');
    const partial = process.argv.includes('--partial');
    const res = mergeShards(route, shards, { base: baseP ? readJson(baseP) : null, partial });
    for (const r of res.refusals) console.log(`MERGE-FAIL: ${r}`);
    if (res.refusals.length) process.exit(1);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'route.json'), `${JSON.stringify(route, null, 2)}\n`);
    writeFileSync(join(outDir, 'survey.json'), `${JSON.stringify(res.survey, null, 2)}\n`);
    const tally = {};
    for (const r of res.survey.rows) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
    console.log(`MERGE ${mode} through ${through}: ${res.survey.rows.length}/${route.steps.length} step(s) from `
        + `${shards.length} shard(s)${baseP ? ' + base' : ''}; verdicts ${JSON.stringify(tally)}`);
    if (res.missing.length) console.log(`MERGE-PARTIAL: ${res.missing.length} step(s) have no row: ${res.missing.join(',')}`);
    console.log(`wrote ${join(outDir, 'survey.json')}`);
} else if (argOf('compare')) {
    const a = readJson(argOf('compare'));
    const withP = argOf('with');
    if (!withP) fail('--compare=<a> needs --with=<b>');
    const res = compareSurveys(a, readJson(withP));
    for (const r of res.refusals) console.log(`COMPARE-FAIL: ${r}`);
    if (res.refusals.length) process.exit(1);
    const md = process.argv.includes('--md');
    const sec = (ms) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}`);
    if (md) console.log('| step | level | A | B | family A | family B | A s | B s | agree |\n|---|---|---|---|---|---|---|---|---|');
    for (const r of res.rows) {
        if (md) {
            console.log(`| ${r.step} | L${r.level} | ${r.a} | ${r.b} | ${r.familyA ?? ''} | ${r.familyB ?? ''} | ${sec(r.msA)} | ${sec(r.msB)} | ${r.agree ? '✓' : '**✗**'} |`);
        } else if (!r.agree) {
            console.log(`DISAGREE step ${r.step} L${r.level}: ${r.a}${r.familyA ? ` (${r.familyA})` : ''} vs ${r.b}${r.familyB ? ` (${r.familyB})` : ''}; ${sec(r.msA)} s vs ${sec(r.msB)} s`);
        }
    }
    console.log(`COMPARE: ${res.rows.length - res.disagreements}/${res.rows.length} step(s) agree on verdict and family; ${res.disagreements} disagree`);
} else if (argOf('fetch')) {
    const run = argOf('fetch');
    const repo = argOf('repo', 'PeerInfinity/Archipelago-CC');
    const tmp = mkdtempSync(join(tmpdir(), 'seedling-survey-fetch-'));
    try {
        execFileSync('gh', ['run', 'download', run, '-R', repo, '-n', 'seedling-survey-merged', '-D', tmp], { stdio: 'inherit' });
        const dest = seedlingSurveyDir(REPO);
        const dirs = readdirSync(tmp).filter((d) => /^through-/.test(d) && existsSync(join(tmp, d, 'survey.json')));
        if (!dirs.length) fail(`run ${run}'s seedling-survey-merged artifact holds no through-*/survey.json`);
        for (const d of dirs) {
            const target = join(dest, d);
            if (existsSync(target) && !process.argv.includes('--force')) fail(`${target} exists — --force replaces it`);
            rmSync(target, { recursive: true, force: true });
            mkdirSync(dest, { recursive: true });
            cpSync(join(tmp, d), target, { recursive: true });
            console.log(`fetched run ${run} → ${target}`);
        }
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
} else {
    fail('one of --bound | --plan | --merge | --compare=<a> | --fetch=<run id> (see --help)');
}
