#!/usr/bin/env node
/**
 * witness-seedling-profile — per physics-profile key, does perturbing it move any committed replay? (engine-prep A3; RWK's check_profile_live.py, restated).
 *
 * A ONE-OFF MEASUREMENT recorded as data (⚖ Q3), not a per-push gate: its
 * output is `scripts/procgen/seedling-profile-witnesses.json`, committed, and
 * `seedlingProfileWitness.test.js` only checks that file's shape against
 * today's `PROFILE` — it never re-measures.
 *
 * ── THE METHOD ─────────────────────────────────────────────────────────
 *
 * The replay is the JS model over a tier of committed tapes (default `fast`:
 * every tape of at most 600 ticks, the differential's own threshold; `full`:
 * every committed tape, recorded in its own file so the fast record and its
 * guard stay exactly as they were). Each
 * run is a CHILD PROCESS, because an override is process-wide at load: the
 * child installs its profile (`seedlingProfileLoader.mjs`) before it imports
 * the model, runs every tape through `runTapeToStream` with the real level
 * geometry, and prints one line per tape — the stream's md5, or `threw:`.
 *
 *   1. CONTROL, twice, with no override. Both runs must agree tape for tape
 *      (the model is deterministic), and the control must match every
 *      committed expectation except the ones `tapeRunner.test.js` declares
 *      EXPECTED_TO_DIVERGE — asserted before any key is perturbed.
 *   2. Per key × magnitude, the perturbed run. A tape MOVES when its stream
 *      differs from the control's (for every tape the control matches that
 *      is exactly "differs from its committed expectation", and it keeps the
 *      declared divergers informative) or when it THROWS.
 *
 * Two magnitudes per key: `ulp`, the next double above the default (+1 ULP),
 * and `pct10`, the default × 1.1 — or +1 when the default is an integer, the
 * smallest move an integer-valued key can make. A key is `corpus-blind` only
 * when NEITHER magnitude moves any tape; otherwise it `moves`.
 *
 * ⚠ `corpus-blind` is a statement about THIS corpus, not about the game: the
 * stream cannot see the quantity, or no tape takes the path that reads it, or
 * no fixture carries the body it belongs to. A tape-based gate cannot catch a
 * wrong value in a blind key.
 *
 * Run:
 *   node scripts/procgen/witness-seedling-profile.mjs --write            # measure every key, write the JSON
 *   node scripts/procgen/witness-seedling-profile.mjs --only=walkSpeed,swimLengthFrames   # measure some keys, print only
 *   node scripts/procgen/witness-seedling-profile.mjs --check            # both committed JSONs are well formed and name every key
 *   node scripts/procgen/witness-seedling-profile.mjs --write --jobs=4 --tier=fast
 *   node scripts/procgen/witness-seedling-profile.mjs --write --jobs=4 --tier=full   # every tape → the -full JSON
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const DEMO = join(REPO, 'frontend/modules/seedlingDemo');
const SELF = fileURLToPath(import.meta.url);

/** The committed measurement (the fast tier). */
export const WITNESS_JSON = 'scripts/procgen/seedling-profile-witnesses.json';
/** The committed full-tier measurement — a sibling file, so the fast record's shape and guard never moved. */
export const WITNESS_FULL_JSON = 'scripts/procgen/seedling-profile-witnesses-full.json';
/** The tiers, and the file each one is recorded in. */
export const TIER_FILES = Object.freeze({ fast: WITNESS_JSON, full: WITNESS_FULL_JSON });
/** FAST = every tape at or below this many ticks — `check-seedling-bot-differential.mjs`'s FAST_TIER_MAX_TICKS. */
export const FAST_TIER_MAX_TICKS = 600;
/** The two perturbations, in the order they are measured. */
export const MAGNITUDES = Object.freeze(['ulp', 'pct10']);
/** The two verdicts. */
export const VERDICTS = Object.freeze(['moves', 'corpus-blind']);
/** How many moved tape names a row keeps. */
export const MOVED_TAPES_KEPT = 10;
/**
 * The tapes whose control stream is DECLARED to differ from the committed
 * expectation — `tapeRunner.test.js`'s EXPECTED_TO_DIVERGE, which is
 * `'r5-l60-kill'` plus `r5Chain.js`'s MODEL_EXEMPT_NAMES (the three
 * `r5-bobboss-*` tapes, all longer than the fast tier).
 */
const declaredDivergers = async () => ['r5-l60-kill', ...(await load('r5Chain.js')).MODEL_EXEMPT_NAMES];
/** A child that runs longer than this is killed (by its own pid) and every tape counts as `threw:timeout`. */
const CHILD_TIMEOUT_MS = 300_000;

const load = (f) => import(pathToFileURL(join(DEMO, f)).href);

/** The next double above `x` (+1 ULP). */
export function nextUp(x) {
    if (Number.isNaN(x) || x === Infinity) return x;
    if (x === 0) return Number.MIN_VALUE;
    const b = new DataView(new ArrayBuffer(8));
    b.setFloat64(0, x);
    const bits = b.getBigUint64(0);
    b.setBigUint64(0, x > 0 ? bits + 1n : bits - 1n);
    return b.getFloat64(0);
}

/** The perturbed value of `v` at `magnitude`. */
export function perturb(v, magnitude) {
    if (magnitude === 'ulp') return nextUp(v);
    if (magnitude === 'pct10') return Number.isInteger(v) ? v + 1 : v * 1.1;
    throw new Error(`unknown magnitude ${magnitude}`);
}

/** The verdict of a key row: `moves` when either magnitude moved or threw on any tape. */
export const verdictOf = (row) => (MAGNITUDES.some((m) => row[m].moved + row[m].threw > 0) ? 'moves' : 'corpus-blind');

/**
 * The problems with a witness JSON against today's profile, as lines (empty
 * when it is sound). NOT a re-measurement: it checks the file names exactly
 * `profileKeys`, every row's counts add up to the tape count, every verdict
 * is one of the two and follows from its counts, the control moved nothing,
 * and the summary is the recount of the rows.
 */
export function checkWitness(json, profileKeys, profileFields = []) {
    const out = [];
    if (!json || typeof json !== 'object') return ['not a JSON object'];
    for (const f of ['measuredAt', 'head', 'tier', 'tapes', 'control', 'keys', 'summary']) {
        if (!(f in json)) out.push(`missing top-level field "${f}"`);
    }
    if (out.length) return out;
    const n = json.tapes.length;
    if (!Array.isArray(json.tapes) || n === 0) out.push('tapes must be a non-empty list of tape names');
    if (json.control.moved !== 0) out.push(`the control moved ${json.control.moved} tape(s); it must move none`);
    const have = Object.keys(json.keys);
    const missing = profileKeys.filter((k) => !have.includes(k));
    const extra = have.filter((k) => !profileKeys.includes(k));
    for (const k of missing) out.push(`PROFILE.${k} has no witness row — run the witness (node scripts/procgen/witness-seedling-profile.mjs --write)`);
    for (const k of extra) out.push(`witness row "${k}" names no PROFILE key — run the witness`);
    for (const [k, row] of Object.entries(json.keys)) {
        if (!VERDICTS.includes(row.verdict)) { out.push(`${k}: verdict "${row.verdict}" is not one of ${VERDICTS.join(', ')}`); continue; }
        for (const m of MAGNITUDES) {
            const r = row[m];
            if (!r) { out.push(`${k}: no ${m} row`); continue; }
            if (r.moved + r.threw + r.same !== n) out.push(`${k}.${m}: moved+threw+same = ${r.moved + r.threw + r.same}, not the ${n} tapes`);
            if (!Array.isArray(r.movedTapes) || r.movedTapes.length !== Math.min(r.moved + r.threw, MOVED_TAPES_KEPT)) {
                out.push(`${k}.${m}: movedTapes must list the first ${MOVED_TAPES_KEPT} moved/threw tapes`);
            }
        }
        if (row[MAGNITUDES[0]] && row[MAGNITUDES[1]] && verdictOf(row) !== row.verdict) out.push(`${k}: verdict "${row.verdict}" does not follow from its counts`);
    }
    if (!out.length) {
        const again = summarise(json.keys, profileFields);
        if (JSON.stringify(again) !== JSON.stringify(json.summary)) out.push('the summary is not the recount of the rows');
    }
    return out;
}

/** Counts per verdict, per class × verdict, and the keys that threw. */
export function summarise(keys, profileFields) {
    const cls = Object.fromEntries(profileFields.map((f) => [f.key, f.class]));
    const verdicts = Object.fromEntries(VERDICTS.map((v) => [v, 0]));
    const byClass = {};
    const threw = [];
    for (const [k, row] of Object.entries(keys)) {
        verdicts[row.verdict] += 1;
        const c = cls[k] ?? 'unknown';
        byClass[c] ??= Object.fromEntries(VERDICTS.map((v) => [v, 0]));
        byClass[c][row.verdict] += 1;
        if (MAGNITUDES.some((m) => row[m].threw > 0)) threw.push(k);
    }
    return { verdicts, byClass, threw };
}

// ── the child ────────────────────────────────────────────────────────

/** Run the tier under whatever profile is installed; one line per tape on stdout. */
async function child() {
    const { installProfileFromEnv } = await import('./seedlingProfileLoader.mjs');
    const tapes = JSON.parse(readFileSync(process.argv.find((a) => a.startsWith('--tapes=')).slice('--tapes='.length), 'utf8'));
    let run;
    try {
        await installProfileFromEnv();
        const [{ runTapeToStream }, { atlasLevelSource }, fixtures, { diffObservationStreams }] = await Promise.all([
            load('tapeRunner.js'), load('levelSource.js'), load('fixtures/index.js'), load('tapeFormat.js'),
        ]);
        const levelSource = atlasLevelSource();
        run = (name) => {
            const stream = runTapeToStream(fixtures.loadTape(name), { levelSource });
            const text = JSON.stringify(stream);
            const exp = diffObservationStreams(fixtures.loadExpectation(name).stream, stream) === null ? 'same' : 'diverges';
            return `${md5hex(text)}\t${exp}`;
        };
    } catch (e) {
        // the model itself refused to load under this profile: every tape threw
        for (const name of tapes) process.stdout.write(`${name}\tthrew:load: ${head(e)}\n`);
        return;
    }
    for (const name of tapes) {
        let line;
        try { line = run(name); } catch (e) { line = `threw:${head(e)}`; }
        process.stdout.write(`${name}\t${line}\n`);
    }
}

const head = (e) => String(e?.message ?? e).split('\n')[0].replace(/\t/g, ' ').slice(0, 120);
let md5hex;

// ── the parent ───────────────────────────────────────────────────────

/** Spawn one child over `tapes` with `profile` (an object, or null for none); resolve to Map(name → line). */
function runChild(tapes, profile, tmp, label) {
    const tapesFile = join(tmp, 'tapes.json');
    if (!existsSync(tapesFile)) writeFileSync(tapesFile, JSON.stringify(tapes));
    const args = [SELF, '--child', `--tapes=${tapesFile}`];
    if (profile) {
        const p = join(tmp, `${label}.json`);
        writeFileSync(p, `${JSON.stringify(profile)}\n`);
        args.push(`--profile=${p}`);
    }
    const { SEEDLING_PROFILE, ...env } = process.env;
    return new Promise((res) => {
        const c = spawn(process.execPath, args, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        c.stdout.on('data', (d) => { out += d; });
        c.stderr.on('data', (d) => { err += d; });
        const timer = setTimeout(() => { c.kill('SIGKILL'); }, CHILD_TIMEOUT_MS);
        c.on('close', (code, signal) => {
            clearTimeout(timer);
            const lines = new Map();
            for (const l of out.split('\n').filter(Boolean)) {
                const [name, ...rest] = l.split('\t');
                lines.set(name, rest.join('\t'));
            }
            for (const name of tapes) {
                if (!lines.has(name)) {
                    lines.set(name, signal ? `threw:timeout (${signal})`
                        : `threw:child exited ${code}: ${err.split('\n').filter(Boolean).pop() ?? ''}`.slice(0, 160));
                }
            }
            res(lines);
        });
    });
}

/** A pool of `jobs` concurrent tasks. */
async function pool(tasks, jobs, onDone) {
    const results = new Array(tasks.length);
    let next = 0;
    let done = 0;
    const worker = async () => {
        while (next < tasks.length) {
            const i = next++;
            results[i] = await tasks[i]();
            onDone?.(++done, tasks.length);
        }
    };
    await Promise.all(Array.from({ length: Math.min(jobs, tasks.length) }, worker));
    return results;
}

function tierTapes(tier, fixtures) {
    if (tier === 'full') return fixtures.fixtureNames();
    if (tier !== 'fast') throw new Error(`--tier=${tier}: only "fast" (every tape of at most ${FAST_TIER_MAX_TICKS} ticks) and "full" (every tape) are measured`);
    return fixtures.fixtureNames().filter((n) => fixtures.loadTape(n).tick_count <= FAST_TIER_MAX_TICKS);
}

async function measure({ only, jobs, tier }) {
    const [{ PROFILE_DEFAULTS, PROFILE_FIELDS }, fixtures] = await Promise.all([load('seedlingProfile.js'), load('fixtures/index.js')]);
    const tapes = tierTapes(tier, fixtures);
    const DECLARED_DIVERGERS = await declaredDivergers();
    const keys = only ?? Object.keys(PROFILE_DEFAULTS);
    for (const k of keys) if (!(k in PROFILE_DEFAULTS)) throw new Error(`--only: "${k}" is not a PROFILE key`);
    const tmp = mkdtempSync(join(tmpdir(), 'seedling-witness-'));
    const t0 = Date.now();
    try {
        // 1. the control, twice
        const [c1, c2] = await Promise.all([runChild(tapes, null, tmp, 'control-a'), runChild(tapes, null, tmp, 'control-b')]);
        const unstable = tapes.filter((n) => c1.get(n) !== c2.get(n));
        const threwCtl = tapes.filter((n) => c1.get(n).startsWith('threw:'));
        const diverges = tapes.filter((n) => c1.get(n).endsWith('\tdiverges'));
        const undeclared = diverges.filter((n) => !DECLARED_DIVERGERS.includes(n));
        const declared = DECLARED_DIVERGERS.filter((n) => tapes.includes(n));
        console.log(`CONTROL: ${tapes.length} tapes (tier ${tier}); stable across two runs: ${unstable.length ? `NO (${unstable.join(', ')})` : 'yes'}; `
            + `threw ${threwCtl.length}; diverge from expectation ${diverges.length} (${diverges.join(', ') || 'none'}; declared in this tier: ${declared.join(', ')})`);
        if (unstable.length || threwCtl.length || undeclared.length) {
            throw new Error(`the CONTROL is not sound — refusing to perturb (unstable ${unstable.length}, threw ${threwCtl.length}, undeclared divergers ${undeclared.join(', ') || 0})`);
        }
        const ref = new Map(tapes.map((n) => [n, c1.get(n).split('\t')[0]]));

        // 2. per key × magnitude
        const tasks = [];
        for (const k of keys) {
            for (const m of MAGNITUDES) {
                const value = perturb(PROFILE_DEFAULTS[k], m);
                tasks.push(async () => {
                    const lines = await runChild(tapes, { id: `witness-${k}-${m}`, [k]: value }, tmp, `${k}-${m}`);
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
                    return { k, m, r };
                });
            }
        }
        const results = await pool(tasks, jobs, (d, t) => {
            if (d % 10 === 0 || d === t) process.stderr.write(`  ${d}/${t} perturbed runs (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
        });
        const rows = {};
        for (const k of keys) rows[k] = {};
        for (const { k, m, r } of results) rows[k][m] = r;
        for (const k of keys) rows[k].verdict = verdictOf(rows[k]);
        return {
            tapes, rows, PROFILE_FIELDS, wallSeconds: Math.round((Date.now() - t0) / 1000),
            control: { moved: 0, runs: 2, divergesFromExpectation: diverges },
        };
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
}

function printRows(rows) {
    for (const [k, row] of Object.entries(rows)) {
        const cell = (m) => `${m} ${row[m].moved}m/${row[m].threw}t/${row[m].same}s`;
        console.log(`${k.padEnd(28)} ${row.verdict.padEnd(13)} ${cell('ulp').padEnd(22)} ${cell('pct10').padEnd(24)} ${row.pct10.firstThrow ?? row.ulp.firstThrow ?? ''}`.trimEnd());
    }
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.includes('--child')) {
        const { createHash } = await import('node:crypto');
        md5hex = (s) => createHash('md5').update(s).digest('hex');
        await child();
        return;
    }
    const opt = (name, dflt) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
    const { PROFILE, PROFILE_FIELDS } = await load('seedlingProfile.js');
    if (argv.includes('--check')) {
        let bad = 0;
        for (const [tier, file] of Object.entries(TIER_FILES)) {
            const path = join(REPO, file);
            if (!existsSync(path)) { console.log(`RED  ${file} does not exist — run the witness (--write --tier=${tier})`); bad += 1; continue; }
            const json = JSON.parse(readFileSync(path, 'utf8'));
            const problems = checkWitness(json, Object.keys(PROFILE), PROFILE_FIELDS);
            if (json.tier !== tier) problems.push(`${file} records tier "${json.tier}", not "${tier}"`);
            for (const p of problems) console.log(`RED  ${file}: ${p}`);
            console.log(problems.length ? `FAIL — ${file}: ${problems.length} problem(s)` : `PASS — ${file} names all ${Object.keys(PROFILE).length} keys`);
            bad += problems.length;
        }
        process.exit(bad ? 1 : 0);
    }
    const only = opt('only', null)?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
    const write = argv.includes('--write');
    if (only && write) { console.error('refused: --write needs every key (drop --only=)'); process.exit(2); }
    if (!only && !write) { console.error('nothing to do: --write (every key), --only=<key,…> (print), or --check'); process.exit(2); }
    const jobs = Math.max(1, Number(opt('jobs', '4')) || 1);
    const tier = opt('tier', 'fast');
    if (!(tier in TIER_FILES)) { console.error(`--tier=${tier}: only ${Object.keys(TIER_FILES).map((t) => `"${t}"`).join(' and ')} are measured`); process.exit(2); }
    const m = await measure({ only, jobs, tier });
    printRows(m.rows);
    const summary = summarise(m.rows, PROFILE_FIELDS);
    console.log(`\n${JSON.stringify(summary)}\nwall ${m.wallSeconds} s, jobs ${jobs}, ${m.tapes.length} tapes`);
    if (!write) return;
    const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
    const json = {
        measuredAt: new Date().toISOString(),
        head: git('rev-parse', 'HEAD'),
        treeClean: git('status', '--porcelain', '--untracked-files=no') === '',
        tier,
        method: 'per key x magnitude, a child process with the override installed runs every tier tape through runTapeToStream; '
            + 'a tape moves when its stream md5 differs from the control run or it throws. ulp = +1 ULP; pct10 = x1.1, or +1 for an integer default. '
            + 'corpus-blind = neither magnitude moved any tape.',
        jobs,
        wallSeconds: m.wallSeconds,
        tapes: m.tapes,
        control: m.control,
        keys: m.rows,
        summary,
    };
    const problems = checkWitness(json, Object.keys(PROFILE), PROFILE_FIELDS);
    if (problems.length) { for (const p of problems) console.error(`RED  ${p}`); process.exit(1); }
    writeFileSync(join(REPO, TIER_FILES[tier]), `${JSON.stringify(json, null, 2)}\n`);
    console.log(`wrote ${TIER_FILES[tier]}`);
}

argvHelp(import.meta.url);
if (isEntryPoint(import.meta.url)) await main();
