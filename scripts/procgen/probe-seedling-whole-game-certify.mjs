#!/usr/bin/env node
/**
 * MEASUREMENT (slice tile-primitives-whole-game-classify, branch only): the WHOLE-GAME maze certifier. Every level of the
 * playthrough atlas is compiled together (`buildPlaythroughMaze({levels: all})`), then `certifyPlaythroughMaze` runs natively
 * in N shards (levels i % N, the pixelmask-l86 recipe), deduped. Two arms over the same compiled document:
 *   - new: the certifier as on the tree (inbound pricing of internal-only members) + the rules producer's `permissive` list;
 *   - old: a scratch copy of the certifier with `internalOnly` forced false (fresh-arrival pricing) and no `permissive`.
 * Not a wasm probe: it runs through seedling-probe.yml only for the CI runner; it prints the lines that job reads.
 *
 *   node scripts/procgen/probe-seedling-whole-game-certify.mjs [--shards=4] [--out=test-results/seedling-probe] [--arms=new,old]
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { tmpdir } from 'node:os';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const T = (p) => resolve(REPO, p);
const CERT = T('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js');
const OLD_CERT = T('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.oldframing.tmp.js');

if (!isMainThread) {
    const { rulesFile, shard, shards, arm, permissive } = workerData;
    const mod = await import(pathToFileURL(arm === 'old' ? OLD_CERT : CERT).href);
    const HELPERS = JSON.parse(readFileSync(T('frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json'), 'utf8'));
    const ATLAS = JSON.parse(readFileSync(T('frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
    const RULES = JSON.parse(readFileSync(rulesFile, 'utf8'));
    const SC = RULES.preset_sidecars['1'];
    const levels = [...new Set(Object.keys(SC).map((s) => s.split('__')[0]))].sort();
    const mine = levels.filter((_, i) => i % shards === shard);
    const t0 = Date.now();
    // pit-sinks-landings measurement: one level at a time, with its time and heap, so a blow-up names its level.
    const out = { problems: [], lines: [], accepted: [] };
    for (const level of mine) {
        const regions = Object.keys(SC).filter((s) => s.split('__')[0] === level);
        const t1 = Date.now();
        process.stderr.write(`LEVEL-START ${arm} ${level} (${regions.length} regions)\n`);
        try {
            const r = mod.certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions, atlas: ATLAS, permissive: arm === 'old' ? [] : permissive });
            out.problems.push(...r.problems); out.lines.push(...r.lines); out.accepted.push(...r.accepted);
        } catch (e) {
            out.threw = `${out.threw ?? ''}${level}: ${String(e.stack ?? e).slice(0, 600)}\n`;
        }
        process.stderr.write(`LEVEL-DONE ${arm} ${level} ${Date.now() - t1} ms heap ${Math.round(process.memoryUsage().heapUsed / 1e6)} MB\n`);
    }
    parentPort.postMessage({ shard, arm, ms: Date.now() - t0, levels: mine, ...out });
} else {
    const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
    const shards = Number(arg('shards', '4'));
    const outDir = T(arg('out', 'test-results/seedling-probe'));
    const arms = arg('arms', 'new,old').split(',');
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
    const src = readFileSync(CERT, 'utf8');
    // pit-sinks-landings measurement: the OLD arm prices every region from its entrance cell (landing-rooted arrivals off).
    const hook = 'function arrivalsOf(world, name) {';
    if (!src.includes(hook)) throw new Error('old arm: the arrivalsOf hook moved');
    writeFileSync(OLD_CERT, src.replace(hook, `${hook} if (true) return [null];`));
    const result = {};
    try {
        for (const arm of arms) {
            t0 = Date.now();
            const parts = await Promise.all([...Array(shards).keys()].map((shard) => new Promise((ok, bad) => {
                const w = new Worker(fileURLToPath(import.meta.url), { workerData: { rulesFile, shard, shards, arm, permissive }, resourceLimits: { maxOldGenerationSizeMb: 6144 } });
                w.once('message', ok);
                w.once('error', bad);
            })));
            const problems = [...new Set(parts.flatMap((p) => p.problems))].sort();
            const acceptedKeys = [...new Set(parts.flatMap((p) => p.accepted.map((a) => JSON.stringify({ label: a.label, source: a.source, by: a.by }))))].sort();
            const lines = [...new Set(parts.flatMap((p) => p.lines))].sort();
            const threw = parts.filter((p) => p.threw).map((p) => `shard ${p.shard}: ${p.threw}`);
            const problemLevels = new Set(problems.map((p) => p.match(/^(level_\d+)/)?.[1]).filter(Boolean));
            const allLevels = new Set(Object.keys(rules.preset_sidecars['1']).map((s) => s.split('__')[0]));
            const clean = [...allLevels].filter((l) => !problemLevels.has(l)).length;
            result[arm] = { problems, accepted: acceptedKeys.map((k) => JSON.parse(k)), lines, threw, clean, levels: allLevels.size,
                shardMs: parts.map((p) => p.ms), wallMs: Date.now() - t0 };
            const looser = problems.filter((p) => /derived true, atlas false/.test(p)).length;
            const stricter = problems.filter((p) => /derived false, atlas true/.test(p)).length;
            console.log(`ARM ${arm}: ${problems.length} problems (derived-true/atlas-false ${looser}, derived-false/atlas-true ${stricter}, other ${problems.length - looser - stricter}) / ${acceptedKeys.length} accepted / ${threw.length} threw; clean ${clean}/${allLevels.size} levels; ${lines.length} lines; wall ${Date.now() - t0} ms`);
            for (const p of problems) console.log(`  PROBLEM[${arm}] ${p}`);
            for (const a of acceptedKeys) console.log(`  ACCEPTED[${arm}] ${a}`);
            for (const t of threw) console.log(`  THREW[${arm}] ${t}`);
            console.log(`PASS: arm ${arm} measured`);
        }
    } finally {
        unlinkSync(OLD_CERT);
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
