#!/usr/bin/env node
/**
 * ⚠ SCRATCH (slice tile-primitives-rules-automation-w0, MEASURE-ONLY; never lands on main).
 * Emits the maze-DERIVED rule for every row the whole-game certifier prices, in the rules shape, and diffs it
 * against the seedling_playthrough rule it is compared with. The certifier runs UNCHANGED except for recording hooks
 * (a runtime source patch, like the whole-game probe's old arm), so its verdict per row rides along.
 * Run: node scripts/procgen/probe-seedling-scratch-w0-emit.mjs [--levels=level_3,level_40] [--shards=4] [--out=test-results/seedling-probe] [--doc=preset|build]
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { tmpdir } from 'node:os';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const T = (p) => resolve(REPO, p);
const CERT = T('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js');
const REC_CERT = T('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.oldframing.tmp.js'); // .gitignored name
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

function patched(src) {
    const swap = (from, to, all = false) => {
        if (!src.includes(from)) throw new Error(`hook moved: ${from.slice(0, 60)}`);
        src = all ? src.replaceAll(from, to) : src.replace(from, to);
    };
    swap('const compareRow = (label,', `let __cur = null;
    const compareRow = (...__a) => {
        const p0 = problems.length; const a0 = accepted.length; const s0 = skipped.length;
        const t0 = Date.now();
        compareRow0(...__a);
        globalThis.__REC.push({ label: __a[0], source: __a[1], items: __a[2], derived: __cur?.derived ?? null, atlas: __cur?.atlas ?? null,
            closure: __cur?.closure ?? false, problem: problems.length > p0 ? problems.slice(p0) : null, accepted: accepted.slice(a0), skipped: skipped.slice(s0), ms: Date.now() - t0 });
        __cur = null;
    };
    const compareRow0 = (label,`);
    swap('const derived = ruleFromMinimalSets(minimal);', 'const derived = ruleFromMinimalSets(minimal); __cur = { derived, atlas };', true);
    swap('const derived = ruleFromMinimalSets(pair.minimal);', 'const derived = ruleFromMinimalSets(pair.minimal); __cur = { derived, atlas: null, closure: true };');
    swap(`if (t.kind === 'exit') {
                    const to = exitTo.get(t.exitName);`, `if (t.kind === 'exit') {
                    globalThis.__EXITS.push({ label, region: name, exit: t.exitName, minimal: t.minimal, unreachable: t.unreachable });
                    const to = exitTo.get(t.exitName);`);
    swap(`if (t.kind === 'exit') {
                const to = exitTo.get(t.exitName);`, `if (t.kind === 'exit') {
                globalThis.__EXITS.push({ label, region: name, exit: t.exitName, minimal: t.minimal, unreachable: t.unreachable });
                const to = exitTo.get(t.exitName);`);
    // Count the searches/states the derivation does (the cost of an emit).
    swap('const out = deriveLevelWorldLogic(world, helpers, { native, cache: cacheOf(world, name) });',
        'const out = deriveLevelWorldLogic(world, helpers, { native, cache: cacheOf(world, name) }); globalThis.__COST.push({ world: world.sharedWorld.key, kind: "pairs", searched: out.searched, states: out.states });');
    swap(`const out = deriveEntryLogic(world, name, helpers, {
            native, arrivalBlocked: arrivalBlockedFrom(name), cache: arrival ? new Map() : cacheOf(world, name), arriveAt: arrival,
        });`, `const out = deriveEntryLogic(world, name, helpers, {
            native, arrivalBlocked: arrivalBlockedFrom(name), cache: arrival ? new Map() : cacheOf(world, name), arriveAt: arrival,
        }); globalThis.__COST.push({ region: name, arrival, kind: "entry", searched: out.searched, states: out.states });`);
    swap(`const out = deriveEntryLogic(world, name, helpers, {
                native, arrivalBlocked: arrivalBlockedFrom(name), cache: cacheOf(world, via), arriveFrom: via,
            });`, `const out = deriveEntryLogic(world, name, helpers, {
                native, arrivalBlocked: arrivalBlockedFrom(name), cache: cacheOf(world, via), arriveFrom: via,
            }); globalThis.__COST.push({ region: name, via, kind: "inbound", searched: out.searched, states: out.states });`);
    return src;
}

if (!isMainThread) {
    const { docFile, regions } = workerData;
    globalThis.__REC = []; globalThis.__EXITS = []; globalThis.__COST = [];
    const mod = await import(pathToFileURL(REC_CERT).href);
    const M = await import(pathToFileURL(T('scripts/procgen/make-seedling-playthrough-maze.mjs')).href);
    const HELPERS = JSON.parse(readFileSync(T('frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json'), 'utf8'));
    const ATLAS = JSON.parse(readFileSync(T('frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
    const RULES = JSON.parse(readFileSync(docFile, 'utf8'));
    const t0 = Date.now();
    let out; let threw = null;
    try {
        out = mod.certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions, atlas: ATLAS, permissive: M.playthroughPermissiveLocations() });
    } catch (e) { threw = String(e.stack ?? e).slice(0, 2000); out = { problems: [], accepted: [], skipped: [], lines: [] }; }
    parentPort.postMessage({ ms: Date.now() - t0, threw, ...out, rec: globalThis.__REC, exits: globalThis.__EXITS, cost: globalThis.__COST, heapMb: Math.round(process.memoryUsage().heapUsed / 1e6) });
} else {
    console.log('CHANNEL: headless logic-only (no wasm: scratch emit of maze-derived rules)');
    const shards = Number(arg('shards', '4'));
    const outDir = T(arg('out', 'test-results/seedling-probe'));
    mkdirSync(outDir, { recursive: true });
    let docFile = T('frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json');
    if (arg('doc', 'preset') === 'build') {
        const M = await import(pathToFileURL(T('scripts/procgen/make-seedling-playthrough-maze.mjs')).href);
        const ATLAS = JSON.parse(readFileSync(T('frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
        const built = M.buildPlaythroughMaze({ levels: ATLAS.regions.map((r) => r.region_id) });
        docFile = resolve(tmpdir(), `w0-whole-${process.pid}.json`);
        writeFileSync(docFile, built.text);
    }
    const RULES = JSON.parse(readFileSync(docFile, 'utf8'));
    const names = Object.keys(RULES.preset_sidecars['1']);
    const want = arg('levels', null)?.split(',');
    const levels = [...new Set(names.map((s) => s.split('__')[0]))].filter((l) => !want || want.includes(l)).sort();
    writeFileSync(REC_CERT, patched(readFileSync(CERT, 'utf8')));
    const t0 = Date.now();
    let parts;
    try {
        parts = await Promise.all([...Array(Math.min(shards, levels.length)).keys()].map((shard) => new Promise((ok, bad) => {
            const mine = levels.filter((_, i) => i % shards === shard);
            const regions = names.filter((s) => mine.includes(s.split('__')[0]));
            const w = new Worker(fileURLToPath(import.meta.url), { workerData: { docFile, regions }, resourceLimits: { maxOldGenerationSizeMb: 6144 } });
            w.once('message', (m) => ok({ shard, levels: mine, ...m }));
            w.once('error', bad);
        })));
    } finally { unlinkSync(REC_CERT); }
    const wall = Date.now() - t0;
    const sum = (k) => parts.flatMap((p) => p.cost).reduce((a, c) => a + c[k], 0);
    console.log(`EMIT: ${levels.length} levels, wall ${wall} ms, shard ms ${parts.map((p) => p.ms).join('/')}, searches ${sum('searched')}, states ${sum('states')}, heap MB ${parts.map((p) => p.heapMb).join('/')}`);
    const problems = [...new Set(parts.flatMap((p) => p.problems))].sort();
    console.log(`CERT: ${problems.length} problems / ${parts.reduce((a, p) => a + p.accepted.length, 0)} accepted / ${parts.filter((p) => p.threw).length} threw`);
    for (const p of parts.filter((x) => x.threw)) console.log(`THREW ${p.threw}`);
    writeFileSync(resolve(outDir, 'w0-emit.json'), JSON.stringify({ sha: process.env.GITHUB_SHA ?? '', wall, levels, parts: parts.map(({ rec, exits, cost, problems, accepted, skipped, lines, shard, ms, threw }) => ({ shard, ms, threw, rec, exits, cost, problems, accepted, skipped, lines })) }));
    console.log('PASS: emitted');
    console.log('ALL CHECKS PASSED');
}
