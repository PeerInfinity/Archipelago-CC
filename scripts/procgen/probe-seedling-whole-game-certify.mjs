#!/usr/bin/env node
/**
 * MEASUREMENT (slices tile-primitives-whole-game-classify → tile-primitives-whole-game-tools): the WHOLE-GAME maze
 * certifier. Every level of the playthrough atlas is compiled together (`buildPlaythroughMaze({levels: all})`), then
 * `certifyPlaythroughMaze` runs natively in N worker shards (levels i % N, the pixelmask-l86 recipe), deduped. Two arms
 * over the same compiled document:
 *   - new: the certifier as on the tree (inbound pricing of internal-only members) + the rules producer's `permissive` list;
 *   - old: a scratch copy of the certifier with `internalOnly` forced false (fresh-arrival pricing) and no `permissive`.
 * ⛔ The triple it prints is PROBLEMS / ACCEPTED / THREW — not "stricter / looser / unsound". Problems split by direction:
 * "derived true, atlas false" (the maze is looser than the atlas) and "derived false, atlas true" (stricter). A row priced
 * from a cross-level landing carries `(landing x,y)`; a line `<@x,y`.
 * Not a wasm probe and it takes no box. It is CI-sized (~45 s on a runner; each shard may take a 6 GB heap; 115 levels on main
 * e3efad7ef5 = new 31 / 6 / 0, clean 99/115), so run it through seedling-probe.yml, which only lends it a runner and reads
 * its `PASS:` / `ALL CHECKS PASSED` lines (the job's `--host` is ignored):
 *   gh workflow run seedling-probe.yml -R PeerInfinity/Archipelago-CC --ref <branch> -f probes=probe-seedling-whole-game-certify.mjs
 * It writes `whole-game-certify.json` (every problem / accepted / line per arm) and the compiled `whole-game-rules.json`
 * into --out, which that job uploads as its artifact. Nothing on push runs it.
 *
 * Run: node scripts/procgen/probe-seedling-whole-game-certify.mjs [--shards=4] [--out=test-results/seedling-probe] [--arms=new,old]
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { tmpdir } from 'node:os';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const T = (p) => resolve(REPO, p);
const CERT = T('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js');
const OLD_CERT = T('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.oldframing.tmp.js');
/** Where the old arm forces `internalOnly` false. */
export const OLD_FRAMING_HOOK = 'const internalOnly = (world, name) => {';

/** The probe's flags. Exported for the unit rows. */
export function parseArgs(argv) {
    const arg = (k, d) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
    const shards = Number(arg('shards', '4'));
    if (!Number.isInteger(shards) || shards < 1) throw new Error(`--shards must be a positive integer, got ${arg('shards')}`);
    const arms = arg('arms', 'new,old').split(',');
    const bad = arms.filter((a) => a !== 'new' && a !== 'old');
    if (bad.length) throw new Error(`--arms: unknown arm(s) ${bad.join(', ')} (new, old)`);
    return { shards, out: arg('out', 'test-results/seedling-probe'), arms };
}

/** The old arm's certifier source: `internalOnly` answers false. Throws when the hook moved. Exported for the unit rows. */
export function oldFramingSource(src) {
    if (!src.includes(OLD_FRAMING_HOOK)) throw new Error('old arm: the internalOnly hook moved');
    return src.replace(OLD_FRAMING_HOOK, `${OLD_FRAMING_HOOK} if (true) return false;`);
}

/** Whether a run writes the old arm's scratch certifier into the tree: only when the old arm runs. Exported for the unit rows. */
export function needsOldCert(arms) {
    return arms.includes('old');
}

/** Shard `shard` of `shards`: the levels i % shards === shard, and their regions (`level_N__…`). Exported for the unit rows. */
export function shardRegions(regionNames, shard, shards) {
    const levels = [...new Set(regionNames.map((s) => s.split('__')[0]))].sort();
    const mine = levels.filter((_, i) => i % shards === shard);
    return { levels: mine, regions: regionNames.filter((s) => mine.includes(s.split('__')[0])) };
}

/** One arm's shard results merged: deduped, sorted, counted. Exported for the unit rows. */
export function mergeArm(parts, allLevels) {
    const problems = [...new Set(parts.flatMap((p) => p.problems))].sort();
    const acceptedKeys = [...new Set(parts.flatMap((p) => p.accepted.map((a) => JSON.stringify({ label: a.label, source: a.source, by: a.by }))))].sort();
    const lines = [...new Set(parts.flatMap((p) => p.lines))].sort();
    // ⛓ The rows an UNADMITTED landing skipped points of (session tile-primitives-lightpoles), named — never silent; and (session
    // tile-primitives-sphere-order-8) an event location's points holding its own event at a landing (`why: 'own event'`).
    const skipped = [...new Set(parts.flatMap((p) => (p.skipped ?? []).map((k) => JSON.stringify(k))))].sort().map((k) => JSON.parse(k));
    const threw = parts.filter((p) => p.threw).map((p) => `shard ${p.shard}: ${p.threw}`);
    const problemLevels = new Set(problems.map((p) => p.match(/^(level_\d+)/)?.[1]).filter(Boolean));
    const clean = [...allLevels].filter((l) => !problemLevels.has(l)).length;
    const looser = problems.filter((p) => /derived true, atlas false/.test(p)).length;
    const stricter = problems.filter((p) => /derived false, atlas true/.test(p)).length;
    return { problems, accepted: acceptedKeys.map((k) => JSON.parse(k)), skipped, lines, threw, clean, levels: allLevels.size, looser, stricter };
}

if (!isMainThread) await worker();
else if (isEntryPoint(import.meta.url)) await main();

async function worker() {
    const { rulesFile, shard, shards, arm, permissive } = workerData;
    const mod = await import(pathToFileURL(arm === 'old' ? OLD_CERT : CERT).href);
    const HELPERS = JSON.parse(readFileSync(T('frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json'), 'utf8'));
    const ATLAS = JSON.parse(readFileSync(T('frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
    const RULES = JSON.parse(readFileSync(rulesFile, 'utf8'));
    const { levels: mine, regions } = shardRegions(Object.keys(RULES.preset_sidecars['1']), shard, shards);
    const t0 = Date.now();
    let out;
    try {
        out = mod.certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions, atlas: ATLAS, permissive: arm === 'old' ? [] : permissive });
    } catch (e) {
        out = { threw: String(e.stack ?? e).slice(0, 2000), problems: [], lines: [], accepted: [], skipped: [] };
    }
    parentPort.postMessage({ shard, arm, ms: Date.now() - t0, levels: mine, ...out });
}

async function main() {
    const { shards, out, arms } = parseArgs(process.argv);
    const outDir = T(out);
    mkdirSync(outDir, { recursive: true });
    console.log('CHANNEL: headless logic-only (no wasm: a node measurement of the maze certifier)');
    const M = await import(pathToFileURL(T('scripts/procgen/make-seedling-playthrough-maze.mjs')).href);
    const ATLAS = JSON.parse(readFileSync(T('frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
    const levels = ATLAS.regions.map((r) => r.region_id);
    let t0 = Date.now();
    const built = M.buildPlaythroughMaze({ levels });
    const rulesFile = resolve(tmpdir(), `whole-game-${process.pid}.json`);
    writeFileSync(rulesFile, built.text);
    const rules = JSON.parse(built.text);
    console.log(`BUILT: ${levels.length} levels, ${Object.keys(rules.regions['1']).length} regions, ${built.text.length} B in ${Date.now() - t0} ms`);
    const permissive = M.playthroughPermissiveLocations();
    console.log(`PERMISSIVE: ${permissive.length} — ${permissive.join(' | ')}`);
    // The old arm: the certifier with internal-only members priced from their fresh arrival (the framing before sphere-order-2).
    // Written only when the old arm runs; a killed run (an OOM'd worker) can strand it, so .gitignore covers `*.oldframing.tmp.js`.
    const scratch = needsOldCert(arms);
    if (scratch) writeFileSync(OLD_CERT, oldFramingSource(readFileSync(CERT, 'utf8')));
    const result = {};
    try {
        for (const arm of arms) {
            t0 = Date.now();
            const parts = await Promise.all([...Array(shards).keys()].map((shard) => new Promise((ok, bad) => {
                const w = new Worker(fileURLToPath(import.meta.url), { workerData: { rulesFile, shard, shards, arm, permissive }, resourceLimits: { maxOldGenerationSizeMb: 6144 } });
                w.once('message', ok);
                w.once('error', bad);
            })));
            const allLevels = new Set(Object.keys(rules.preset_sidecars['1']).map((s) => s.split('__')[0]));
            const { looser, stricter, ...merged } = mergeArm(parts, allLevels);
            const { problems, accepted, skipped, lines, threw, clean } = merged;
            result[arm] = { ...merged, shardMs: parts.map((p) => p.ms), wallMs: Date.now() - t0 };
            console.log(`ARM ${arm}: ${problems.length} problems (derived-true/atlas-false ${looser}, derived-false/atlas-true ${stricter}, other ${problems.length - looser - stricter}) / ${accepted.length} accepted / ${threw.length} threw; ${skipped.length} row(s) skip unadmitted landing points; clean ${clean}/${allLevels.size} levels; ${lines.length} lines; wall ${Date.now() - t0} ms`);
            for (const p of problems) console.log(`  PROBLEM[${arm}] ${p}`);
            for (const a of accepted) console.log(`  ACCEPTED[${arm}] ${JSON.stringify(a)}`);
            for (const k of skipped) console.log(`  SKIPPED[${k.why ?? 'unadmitted'}][${arm}] ${k.label}: ${k.points} of ${k.of} points${k.partial ? ' (row also a problem)' : ''}`);
            for (const t of threw) console.log(`  THREW[${arm}] ${t}`);
            console.log(`PASS: arm ${arm} measured`);
        }
    } finally {
        if (scratch) unlinkSync(OLD_CERT);
    }
    if (result.new && result.old) {
        const onlyNew = result.new.problems.filter((p) => !result.old.problems.includes(p));
        const onlyOld = result.old.problems.filter((p) => !result.new.problems.includes(p));
        console.log(`FRAMING DIFF: ${onlyNew.length} problem(s) only under new, ${onlyOld.length} only under old`);
        for (const p of onlyNew) console.log(`  +NEW ${p}`);
        for (const p of onlyOld) console.log(`  -OLD ${p}`);
    }
    const sha = process.env.GITHUB_SHA ?? '';
    writeFileSync(resolve(outDir, 'whole-game-certify.json'), `${JSON.stringify({ sha, built: { levels: levels.length, bytes: built.text.length }, permissive, result }, null, 1)}\n`);
    writeFileSync(resolve(outDir, 'whole-game-rules.json'), built.text);
    console.log('ALL CHECKS PASSED');
}
