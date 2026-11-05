#!/usr/bin/env node
/**
 * MEASUREMENT (slice tile-rules-automation-r-a1, ⚖ Robert 2026-11-02: "Route A, R-A1 first (Recommended)"): the
 * DERIVED-RULES TABLE. The whole game is compiled (`buildPlaythroughMaze({levels: all})`) and certified natively in N
 * worker shards with `rows: true`, so the certifier RETURNS every row it compares — its maze-derived rule, the
 * seedling_playthrough rule, its arrival and its verdict. A second compile plants a sentinel item in every rule
 * (`seedlingEchoSentinels.js`) to find the rules the maze payloads COPY. `derivedRuleRows.js` then labels every element
 * row derived / echoed / arrival-dependent / path-vs-edge / problem.
 *
 * It MOVES NO PRESET and changes no rule: it writes `derived-rules.json` (every labelled row, the echoes, the counts) into
 * --out, for rules-4's per-approach charge (Q2) and the override slice (R-A3) to read.
 *
 * ⛓ THE PIN: the counts are held against `seedling-derived-rules-expected.json` (the W0 sizing's numbers where they are
 * independent of this probe, and this probe's first CI run where they are its own). A drift is a FAIL row, by name: rows
 * that move under a rules slice (rules-4's Q1 moves L49/L54/L91) re-record that file in the slice that moves them.
 *
 * Not a wasm probe and it takes no box. CI-sized (W0's emit: ~67 s wall on 4 vCPU, a 6 GB heap per shard), so it runs
 * through seedling-probe.yml (manual dispatch only; nothing on push runs it):
 *   gh workflow run seedling-probe.yml -R PeerInfinity/Archipelago-CC --ref <branch> -f probes=probe-seedling-derived-rules.mjs
 *
 * Run: node scripts/procgen/probe-seedling-derived-rules.mjs [--shards=4] [--out=test-results/seedling-probe] [--levels=level_89,level_91]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { tmpdir } from 'node:os';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const T = (p) => resolve(REPO, p);
export const EXPECTED_FILE = T('scripts/procgen/seedling-derived-rules-expected.json');

/**
 * The certifier problems whose cause a census has named (`labelDerivedRows`'s `explained`): labelled by that cause, the
 * verdict kept. Each must still match a problem row, or the run FAILs by name (a stale explanation).
 */
export const EXPLAINED_PROBLEMS = Object.freeze([
    {
        label: 'level_63__r6c9 → level_63__r0c1',
        as: 'path-vs-edge',
        why: 'block-state framing: r0c1\'s foothold groups (6,6), which the Spear reaches, with (5,5), which needs L63 flag 1 once the spear block is parked on (5,6) (rules-4 Q4 census, session rules-l63-darktrap-census)',
    },
]);

/**
 * ⛓ THE TABLE'S NAMED EXCLUSIONS (session tile-rules-automation-r-a3, designer GO: "name it in the table's exclusion list WITH
 * ITS REASON, not silently"): exact elements the derived-rule table must NOT override, each with why. A stale entry (no
 * longer an exact element) is refused by `derivedRuleTable`. The `sharedBinding` rows are excluded by their fact, not here (and re-admitted by the binding witness ledger, never here).
 */
export const TABLE_EXCLUSIONS = Object.freeze([
    {
        // ⛓ slice rules-sharedbinding-witnesses: its binding (L63 flag 6 = lightpole@48,272) is game-witnessed 8/8 and the
        // row is EXACT, but admitting it moves AP_1's BYTES — the table writes its derived And in the derivation's child
        // order (Ghost Spear, Ghost Sword Fusion), the composition's is (Ghost Sword Fusion, Ghost Spear): truth-table
        // equal, 2 lines of AP_1_rules.json and the same HasAll reordered in worlds/seedling_playthrough/Rules.py; seed 1
        // measured byte-identical (sphere log, spoiler, rules, .archipelago). The brief's rule: any AP_1 byte move STOPS the
        // row. Drop this entry on the planner's ruling to accept the reorder.
        key: 'level_65__r0c2|level_65__r0c2 -> level_63__r10c2',
        why: 'AP_1 byte move: the derived rule is the composed one with its And children reordered (truth-table equal); held for a ruling (slice rules-sharedbinding-witnesses)',
    },
    // (empty) L20 r3c1 -> r1c4 was named here in phase 1 (a hidden hand input: GROUPED_LOCK_EXCEPTIONS['20:lock@32,80']'s
    // hasShield through the grid). The echo plant's carrier mapping (this slice) shows it is an ECHO: the bidirectional atlas
    // row r1c4 <-> r3c1 is copied into r3c1's own world, a direction the forward-only mapping never counted. The `echoed`
    // label keeps it out of the table, so an entry here would be stale (refused). R-A4 rewrites the row (rules-4).
]);

/** The probe's flags. Exported for the unit rows. */
export function parseArgs(argv) {
    const arg = (k, d) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
    const shards = Number(arg('shards', '4'));
    if (!Number.isInteger(shards) || shards < 1) throw new Error(`--shards must be a positive integer, got ${arg('shards')}`);
    const levels = arg('levels', null)?.split(',').filter(Boolean) ?? null;
    return { shards, out: arg('out', 'test-results/seedling-probe'), levels };
}

/**
 * Where `actual` departs from `expected`: every leaf `expected` names must be equal in `actual` (a key `expected` does
 * not name is not pinned). Keys starting with `$` are comments. Returns `path: expected X, measured Y` lines. Exported for
 * the unit rows.
 */
export function expectedMismatches(actual, expected, path = '') {
    const out = [];
    for (const [k, want] of Object.entries(expected)) {
        if (k.startsWith('$')) continue;
        const at = path ? `${path}.${k}` : k;
        const got = actual?.[k];
        if (want && typeof want === 'object' && !Array.isArray(want)) out.push(...expectedMismatches(got, want, at));
        else if (JSON.stringify(got) !== JSON.stringify(want)) out.push(`${at}: expected ${JSON.stringify(want)}, measured ${JSON.stringify(got)}`);
    }
    return out;
}

if (!isMainThread) await worker();
else if (isEntryPoint(import.meta.url)) await main();

async function worker() {
    const { rulesFile, regions, permissive } = workerData;
    const { certifyPlaythroughMaze } = await import(pathToFileURL(T('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js')).href);
    const HELPERS = JSON.parse(readFileSync(T('frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json'), 'utf8'));
    const ATLAS = JSON.parse(readFileSync(T('frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
    const RULES = JSON.parse(readFileSync(rulesFile, 'utf8'));
    const t0 = Date.now();
    let out;
    try {
        out = certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions, atlas: ATLAS, permissive, rows: true });
    } catch (e) {
        out = { threw: String(e.stack ?? e).slice(0, 2000), problems: [], lines: [], accepted: [], skipped: [], rows: [] };
    }
    parentPort.postMessage({ ms: Date.now() - t0, heapMb: Math.round(process.memoryUsage().heapUsed / 1e6), ...out });
}

async function main() {
    const { shards, out, levels: only } = parseArgs(process.argv);
    const outDir = T(out);
    mkdirSync(outDir, { recursive: true });
    console.log('CHANNEL: headless logic-only (no wasm: a node measurement of the maze-derived rules)');
    const M = await import(pathToFileURL(T('scripts/procgen/make-seedling-playthrough-maze.mjs')).href);
    const { plantEchoSentinels, findEchoes } = await import(pathToFileURL(T('scripts/procgen/seedlingEchoSentinels.js')).href);
    const { shardRegions } = await import(pathToFileURL(T('scripts/procgen/probe-seedling-whole-game-certify.mjs')).href);
    const { labelDerivedRows, summarizeDerivedRows, derivedRuleTable } = await import(pathToFileURL(T('frontend/modules/mazeRoom/tileSpike/derivedRuleRows.js')).href);
    const TBL = await import(pathToFileURL(T('scripts/procgen/seedlingDerivedRuleTable.js')).href);
    const ATLAS = JSON.parse(readFileSync(T('frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
    const all = ATLAS.regions.map((r) => r.region_id);
    const levels = only ?? all;
    const bad = levels.filter((l) => !all.includes(l));
    if (bad.length) throw new Error(`--levels: not in the playthrough atlas: ${bad.join(', ')}`);
    let t0 = Date.now();
    // ⛔ Both compiles measure the COMPOSED rules (`derivedTable: {rows: []}`): with the committed table applied the AP
    // column would be the table itself (a self-confirming comparison that hides composed ≠ derived), and the sentinel
    // compile would trip guard 2 on every planted table row. The world payloads are byte-identical either way
    // (derivedRuleOverride.test.js), so the derivation is unchanged; the shipped override is held by the producers' --check.
    const NO_TABLE = { rows: [], excluded: [], inputs: null };
    const built = M.buildPlaythroughMaze({ levels, derivedTable: NO_TABLE });
    const rules = JSON.parse(built.text);
    console.log(`BUILT: ${levels.length} levels, ${Object.keys(rules.regions['1']).length} regions, ${built.text.length} B in ${Date.now() - t0} ms`);
    t0 = Date.now();
    let planted = null;
    const plantedDoc = JSON.parse(M.buildPlaythroughMaze({ levels, plant: (x) => { planted = plantEchoSentinels(x); }, embedSphereLog: false, derivedTable: NO_TABLE }).text);
    const echoes = findEchoes(plantedDoc, rules);
    const counts = Object.fromEntries(Object.entries(echoes.byKind).map(([k, v]) => [k, v.length]));
    console.log(`ECHOES: planted ${JSON.stringify(planted)}; copied ${JSON.stringify(counts)}; in shared worlds ${JSON.stringify(echoes.inShared)}; ${echoes.elements.length} AP elements; ${Date.now() - t0} ms`);
    for (const u of echoes.unmapped) console.log(`  UNMAPPED ECHO ${u}`);
    const rulesFile = resolve(tmpdir(), `derived-rules-${process.pid}.json`);
    writeFileSync(rulesFile, built.text);
    const permissive = M.playthroughPermissiveLocations();
    t0 = Date.now();
    const names = Object.keys(rules.preset_sidecars['1']);
    const n = Math.min(shards, new Set(names.map((s) => s.split('__')[0])).size);
    const parts = await Promise.all([...Array(n).keys()].map((shard) => new Promise((ok, fail) => {
        const { regions } = shardRegions(names, shard, n);
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: { rulesFile, regions, permissive }, resourceLimits: { maxOldGenerationSizeMb: 6144 } });
        w.once('message', (m) => ok({ shard, ...m }));
        w.once('error', fail);
    })));
    const wall = Date.now() - t0;
    const problems = [...new Set(parts.flatMap((p) => p.problems))].sort();
    const accepted = new Set(parts.flatMap((p) => p.accepted.map((a) => JSON.stringify({ label: a.label, source: a.source, by: a.by })))).size;
    const threw = parts.filter((p) => p.threw);
    const rows = parts.flatMap((p) => p.rows);
    console.log(`CERT: ${problems.length} problems / ${accepted} accepted / ${threw.length} threw; ${rows.length} rows; wall ${wall} ms, shard ms ${parts.map((p) => p.ms).join('/')}, heap MB ${parts.map((p) => p.heapMb).join('/')}`);
    for (const p of problems) console.log(`  PROBLEM ${p}`);
    for (const p of threw) console.log(`  THREW shard ${p.shard}: ${p.threw}`);
    // ⛓ THE BINDING WITNESSES (slice rules-sharedbinding-witnesses): the ledger's events re-admit the sharedBinding
    // elements that name only them. A --levels run places fewer events, so it keeps the entries its document places.
    const placed = new Set(Object.values(rules.regions['1']).flatMap((r) => (r.locations ?? []).filter((l) => l.event).map((l) => l.item?.name ?? l.name)));
    const witnessed = TBL.readBindingWitnesses().filter((w) => !only || placed.has(w.event));
    console.log(`WITNESSED BINDINGS: ${witnessed.length} (${witnessed.map((w) => w.event).join('; ')})`);
    const table = labelDerivedRows(rows, { rules, echoes: new Set(echoes.elements), explained: EXPLAINED_PROBLEMS, witnessed });
    const override = derivedRuleTable(table, { rules, exclusions: TABLE_EXCLUSIONS });
    const summary = {
        certifier: { problems: problems.length, accepted, threw: threw.length }, echoes: { copied: counts, elements: echoes.elements.length }, ...summarizeDerivedRows(table),
        table: { rows: override.rows.length, regions: new Set(override.rows.map((r) => r.region)).size, excluded: override.excluded.length },
    };
    console.log(`SUMMARY: ${JSON.stringify(summary)}`);
    const sha = process.env.GITHUB_SHA ?? '';
    const regionClass = Object.fromEntries([...table.regions].map(([k, r]) => [k, { class: r.class, arrivals: [...r.arrivals].sort() }]));
    writeFileSync(resolve(outDir, 'derived-rules.json'), `${JSON.stringify({ sha, levels: levels.length, summary, echoes, problems, regions: regionClass, unpriced: table.unpriced, rows: table.elements }, null, 1)}\n`);
    console.log(`WROTE: ${resolve(outDir, 'derived-rules.json')} (${table.elements.length} element rows)`);
    // ⛓ THE DERIVED-RULE TABLE (session tile-rules-automation-r-a3): emitted beside derived-rules.json, and held against the
    // committed file (`TABLE_FILE`) on a whole-game run — a regeneration is this artifact copied over it.
    const tableDoc = {
        $comment: 'GENERATED by scripts/procgen/probe-seedling-derived-rules.mjs (seedling-probe.yml, manual) — never hand-edited. The rules '
            + 'producers OVERRIDE their composed rule with `rule` on every row (seedlingDerivedRuleTable.js). Selection: EXACT elements '
            + '(overridable: one fresh arrival, rooted, not walked in, no partial row; echo-free; derived rule truth-table EQUAL to the '
            + 'composed one) minus sharedBinding (every event-layer event, rules-4 ruling (a), unless every event it names has a GAME '
            + 'witness in scripts/procgen/seedling-binding-witnesses.json, ruling (c)) minus the named exclusions.',
        measuredAt: sha.slice(0, 10),
        inputs: only ? null : TBL.tableInputs(rules),
        counts: summary.table,
        excluded: override.excluded,
        rows: override.rows,
    };
    const tableText = `${JSON.stringify(tableDoc, null, 1)}\n`;
    writeFileSync(resolve(outDir, 'seedling-playthrough-derived-rules.json'), tableText);
    console.log(`TABLE: ${override.rows.length} rows in ${summary.table.regions} regions; ${override.excluded.length} exact elements excluded`);
    let failed = threw.length;
    if (!only) {
        const committed = TBL.readDerivedRuleTable();
        const strip = (d) => JSON.stringify({ inputs: d.inputs, excluded: d.excluded, rows: d.rows });
        if (strip(committed) === strip(tableDoc)) {
            console.log(`PASS: the derived-rule table matches ${TBL.TABLE_FILE.slice(REPO.length + 1)}`);
        } else {
            failed += 1;
            const key = (r) => JSON.stringify(r);
            const was = new Map((committed.rows ?? []).map((r) => [r.key, key(r)]));
            const now = new Map(tableDoc.rows.map((r) => [r.key, key(r)]));
            for (const [k, v] of now) if (!was.has(k)) console.log(`  TABLE ADDED ${k}`); else if (was.get(k) !== v) console.log(`  TABLE CHANGED ${k}`);
            for (const k of was.keys()) if (!now.has(k)) console.log(`  TABLE REMOVED ${k}`);
            if (JSON.stringify(committed.inputs) !== JSON.stringify(tableDoc.inputs)) console.log(`  TABLE INPUTS ${JSON.stringify(committed.inputs)} → ${JSON.stringify(tableDoc.inputs)}`);
            if (JSON.stringify(committed.excluded) !== JSON.stringify(tableDoc.excluded)) console.log('  TABLE EXCLUDED list moved');
            console.log(`FAIL: the derived-rule table differs from ${TBL.TABLE_FILE.slice(REPO.length + 1)} — ${TBL.REGEN_RECIPE}`);
        }
    }
    if (threw.length) console.log(`FAIL: ${threw.length} shard(s) threw`);
    if (echoes.unmapped.length) { failed += 1; console.log(`FAIL: ${echoes.unmapped.length} echoed rule(s) name no AP element`); }
    for (const x of EXPLAINED_PROBLEMS) {
        const hit = table.elements.some((e) => e.certifierLabel === x.label && e.verdict === 'problem');
        if (hit) console.log(`PASS: explained problem ${x.label} → ${x.as}`);
        else if (!only) { failed += 1; console.log(`FAIL: explained problem ${x.label} matches no problem row (stale explanation)`); }
    }
    if (only) {
        console.log('PASS: emitted (a --levels run is not held against the whole-game pin)');
    } else {
        const expected = JSON.parse(readFileSync(EXPECTED_FILE, 'utf8'));
        const drift = expectedMismatches(summary, expected.summary);
        for (const d of drift) console.log(`  DRIFT ${d}`);
        if (drift.length) { failed += 1; console.log(`FAIL: ${drift.length} count(s) drifted from ${EXPECTED_FILE.slice(REPO.length + 1)}`); }
        else console.log(`PASS: every pinned count matches ${EXPECTED_FILE.slice(REPO.length + 1)}`);
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exitCode = failed ? 1 : 0;
}
