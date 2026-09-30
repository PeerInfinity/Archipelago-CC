#!/usr/bin/env node
/**
 * witness-seedling-entities — per entity-record NUMBER leaf, does perturbing it move any committed replay? (behaviour-parameters P1; the profile witness's sibling).
 *
 * The same one-off measurement, recorded as data, that
 * `witness-seedling-profile.mjs` makes for the profile — and the same
 * harness (its `runChild`, `pool`, `tierTapes` and `checkWitness` are
 * imported, not copied): a CONTROL twice with no override, then per leaf ×
 * magnitude a child process with the override installed through
 * `SEEDLING_ENTITY_RECORDS` (`--entities=`) before the model is imported,
 * running every FAST-tier tape through `runTapeToStream`. A tape MOVES when
 * its stream md5 differs from the control's, or it THROWS. `ulp` is +1 ULP;
 * `pct10` is ×1.1, or +1 for an integer default. `corpus-blind` = neither
 * magnitude moved any tape.
 *
 * What is measured: every NON-doc NUMBER leaf of every registered record
 * (`entityRecords.entityLeaves()` after importing `ENTITY_RECORD_MODULES`).
 * Strings, booleans and nulls are content too, but have no ULP; they are
 * outside this witness by construction and named as such in the doc.
 *
 * The record is `scripts/procgen/seedling-entity-witnesses.json`, keyed by
 * record path; its summary's `byClass` is per RECORD.
 * `seedlingEntityWitness.test.js` checks that file names exactly today's
 * number leaves — it never re-measures.
 *
 * ⚠ `corpus-blind` is a statement about THIS corpus: many rows describe
 * classes no fast-tier tape meets, or census fields (pricing, envelopes) the
 * replay never reads.
 *
 * Run:
 *   node scripts/procgen/witness-seedling-entities.mjs --write --jobs=4        # every leaf → the JSON
 *   node scripts/procgen/witness-seedling-entities.mjs --only=spinner.moveSpeed,chasers.bob.dieAnim.rate   # print only
 *   node scripts/procgen/witness-seedling-entities.mjs --records=spinner,crusher   # print the leaves of some records
 *   node scripts/procgen/witness-seedling-entities.mjs --check
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import {
    MAGNITUDES, MOVED_TAPES_KEPT, checkWitness, declaredDivergers, perturb, pool, runChild, summarise, tierTapes, verdictOf,
} from './witness-seedling-profile.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEMO = join(REPO, 'frontend/modules/seedlingDemo');
const load = (f) => import(pathToFileURL(join(DEMO, f)).href);

/** The committed measurement (the fast tier only). */
export const ENTITY_WITNESS_JSON = 'scripts/procgen/seedling-entity-witnesses.json';
/** The command every "run the witness" message names. */
export const ENTITY_WITNESS_COMMAND = 'node scripts/procgen/witness-seedling-entities.mjs --write';
/** `checkWitness`'s wording for a record path. */
export const ENTITY_CHECK_OPTS = Object.freeze({ noun: '', names: 'record number leaf', command: ENTITY_WITNESS_COMMAND });

/**
 * Every registered record's non-doc number leaves, as `{key, class}` —
 * `key` the path, `class` the record (so `summarise` counts per record).
 */
export async function entityNumberFields() {
    const entities = await load('entityRecords.js');
    await Promise.all(entities.ENTITY_RECORD_MODULES.map((m) => load(m)));
    return entities.entityLeaves().filter((l) => l.type === 'number').map((l) => ({ key: l.path, class: l.record, value: l.value }));
}

async function measure({ fields, jobs }) {
    const fixtures = await load('fixtures/index.js');
    const tapes = tierTapes('fast', fixtures);
    const DECLARED = await declaredDivergers();
    const tmp = mkdtempSync(join(tmpdir(), 'seedling-entity-witness-'));
    const t0 = Date.now();
    try {
        const [c1, c2] = await Promise.all([runChild(tapes, null, tmp, 'control-a'), runChild(tapes, null, tmp, 'control-b')]);
        const unstable = tapes.filter((n) => c1.get(n) !== c2.get(n));
        const threwCtl = tapes.filter((n) => c1.get(n).startsWith('threw:'));
        const diverges = tapes.filter((n) => c1.get(n).endsWith('\tdiverges'));
        const undeclared = diverges.filter((n) => !DECLARED.includes(n));
        console.log(`CONTROL: ${tapes.length} tapes (tier fast); stable: ${unstable.length ? `NO (${unstable.join(', ')})` : 'yes'}; `
            + `threw ${threwCtl.length}; diverge from expectation ${diverges.length} (${diverges.join(', ') || 'none'})`);
        if (unstable.length || threwCtl.length || undeclared.length) {
            throw new Error(`the CONTROL is not sound — refusing to perturb (unstable ${unstable.length}, threw ${threwCtl.length}, undeclared divergers ${undeclared.join(', ') || 0})`);
        }
        const ref = new Map(tapes.map((n) => [n, c1.get(n).split('\t')[0]]));
        const tasks = [];
        for (const f of fields) {
            for (const m of MAGNITUDES) {
                const value = perturb(f.value, m);
                tasks.push(async () => {
                    const lines = await runChild(tapes, { [f.key]: value }, tmp, `${f.key}-${m}`, '--entities=');
                    const r = { value, moved: 0, threw: 0, same: 0, movedTapes: [] };
                    for (const n of tapes) {
                        const l = lines.get(n);
                        if (l.startsWith('threw:')) {
                            r.threw += 1;
                            r.firstThrow ??= `${n}: ${l.slice('threw:'.length)}`;
                        } else if (l.split('\t')[0] !== ref.get(n)) r.moved += 1;
                        else { r.same += 1; continue; }
                        if (r.movedTapes.length < MOVED_TAPES_KEPT) r.movedTapes.push(n);
                    }
                    return { k: f.key, m, r };
                });
            }
        }
        const results = await pool(tasks, jobs, (d, t) => {
            if (d % 20 === 0 || d === t) process.stderr.write(`  ${d}/${t} perturbed runs (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
        });
        const rows = {};
        for (const f of fields) rows[f.key] = {};
        for (const { k, m, r } of results) rows[k][m] = r;
        for (const f of fields) rows[f.key].verdict = verdictOf(rows[f.key]);
        return { tapes, rows, wallSeconds: Math.round((Date.now() - t0) / 1000), control: { moved: 0, runs: 2, divergesFromExpectation: diverges } };
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
}

async function main() {
    const argv = process.argv.slice(2);
    const opt = (name, dflt) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
    const all = await entityNumberFields();
    const keys = all.map((f) => f.key);
    if (argv.includes('--check')) {
        const path = join(REPO, ENTITY_WITNESS_JSON);
        if (!existsSync(path)) { console.log(`RED  ${ENTITY_WITNESS_JSON} does not exist — run the witness (${ENTITY_WITNESS_COMMAND})`); process.exit(1); }
        const json = JSON.parse(readFileSync(path, 'utf8'));
        const problems = checkWitness(json, keys, all, ENTITY_CHECK_OPTS);
        if (json.tier !== 'fast') problems.push(`${ENTITY_WITNESS_JSON} records tier "${json.tier}", not "fast"`);
        for (const p of problems) console.log(`RED  ${ENTITY_WITNESS_JSON}: ${p}`);
        console.log(problems.length ? `FAIL — ${ENTITY_WITNESS_JSON}: ${problems.length} problem(s)` : `PASS — ${ENTITY_WITNESS_JSON} names all ${keys.length} number leaves`);
        process.exit(problems.length ? 1 : 0);
    }
    const only = opt('only', null)?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
    const records = opt('records', null)?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
    for (const k of only ?? []) if (!keys.includes(k)) throw new Error(`--only: "${k}" is not a record number leaf`);
    const write = argv.includes('--write');
    if ((only || records) && write) { console.error('refused: --write needs every leaf (drop --only= / --records=)'); process.exit(2); }
    if (!only && !records && !write) { console.error('nothing to do: --write (every leaf), --only=<path,…> / --records=<name,…> (print), or --check'); process.exit(2); }
    const fields = all.filter((f) => (only ? only.includes(f.key) : records ? records.includes(f.class) : true));
    const jobs = Math.max(1, Number(opt('jobs', '4')) || 1);
    console.log(`${fields.length} number leaves × ${MAGNITUDES.length} magnitudes = ${fields.length * MAGNITUDES.length} perturbed runs, jobs ${jobs}`);
    const m = await measure({ fields, jobs });
    for (const [k, row] of Object.entries(m.rows)) {
        const cell = (x) => `${x} ${row[x].moved}m/${row[x].threw}t/${row[x].same}s`;
        console.log(`${k.padEnd(48)} ${row.verdict.padEnd(13)} ${cell('ulp').padEnd(22)} ${cell('pct10')}`);
    }
    const summary = summarise(m.rows, fields);
    console.log(`\n${JSON.stringify(summary)}\nwall ${m.wallSeconds} s, jobs ${jobs}, ${m.tapes.length} tapes`);
    if (!write) return;
    const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
    const entities = await load('entityRecords.js');
    const json = {
        measuredAt: new Date().toISOString(),
        head: git('rev-parse', 'HEAD'),
        treeClean: git('status', '--porcelain', '--untracked-files=no') === '',
        tier: 'fast',
        entitiesMd5: entities.entitiesMd5(),
        method: 'per record number leaf x magnitude, a child process with the entity-records override installed runs every fast-tier tape through runTapeToStream; '
            + 'a tape moves when its stream md5 differs from the control run or it throws. ulp = +1 ULP; pct10 = x1.1, or +1 for an integer default. '
            + 'corpus-blind = neither magnitude moved any tape.',
        jobs,
        wallSeconds: m.wallSeconds,
        tapes: m.tapes,
        control: m.control,
        keys: m.rows,
        summary,
    };
    const problems = checkWitness(json, keys, all, ENTITY_CHECK_OPTS);
    if (problems.length) { for (const p of problems) console.error(`RED  ${p}`); process.exit(1); }
    writeFileSync(join(REPO, ENTITY_WITNESS_JSON), `${JSON.stringify(json, null, 2)}\n`);
    console.log(`wrote ${ENTITY_WITNESS_JSON}`);
}

argvHelp(import.meta.url);
if (isEntryPoint(import.meta.url)) await main();
