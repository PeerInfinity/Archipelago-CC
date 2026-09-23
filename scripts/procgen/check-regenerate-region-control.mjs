#!/usr/bin/env node
/**
 * check-regenerate-region-control — **EVERY TRACKED SIDECAR ENTRY, REGENERATED
 * FOR EVERY REALISER TARGET, ON A COPY: HOW MANY COME OUT CLEAN** (APWORLD
 * SUBSTRATE CHANGE R0; the substrate-change plan §1.6).
 *
 * A CONTROL, not a gate on corpus bytes: it NEVER WRITES. For each tracked
 * `_rules.json` (plus, with `--fixtures`, the untracked ones on disk), each
 * populated slot, the first `--limit` entries of that slot in entry order, and
 * each target in `--targets`, it applies the hub's `regenerate-region-sidecar`
 * op through `applyRulesDocOp` (copy-on-write — the loaded document is never
 * mutated, and nothing is written back) and bins the answer:
 *
 *   · CLEAN       — the op applied, every document location name of the region
 *                   is carried by the new payload (`apLocationNamesOf`), and the
 *                   slot's `sidecarIssues` ERRORS are a subset of the baseline's;
 *   · STRANDED    — the op applied and the ONLY new errors are the sibling
 *                   references its description NAMED (`strandedReferences`: the old
 *                   payload hosted a value siblings point at) — reported, never
 *                   repaired, by the op's design;
 *   · NEW-ERRORS  — the op applied but the report gained an error it did not
 *                   name (by kind), or a name was lost;
 *   · REFUSED     — by class: the realiser's own sentence (digits and quoted ids
 *                   folded), or the op's refusal head.
 *
 * with the median and max milliseconds of the op per (from → to). Exit 0 always
 * — the table is the product (it is §1.6's missing number).
 *
 * ⚠ The zone realisers are SLOW (runner ≈ 0.6 s a region; bounce's braid can
 * take seconds on a many-location region), so the default is the fast form:
 * `--limit=12` entries per slot and `--targets=maze,text_adventure`. Progress
 * (one line per document, with its elapsed time) goes to stderr.
 *
 * ⛔ AND ONE OP MAY NEVER RETURN — measured at R0: `procgen_topdown/AP_4`'s
 * start region `C` → `bounce` ran past ten minutes in one synchronous realise
 * (its one location is gated on a `HasAll` of every `Checked N` item). The op
 * is synchronous and cannot be interrupted in-thread, so every op runs in ONE
 * worker thread with a budget (`--op-timeout=<s>`, default `DEFAULT_OP_TIMEOUT_S`);
 * an op past it is TERMINATED with its worker, binned `timed out`, named on
 * stderr, and a fresh worker takes the next op.
 *
 * ⛓ THE STARTING INVENTORY (R3, plan §9.2): the op hands the realiser each rule
 * with the slot's `starting_items` OWNED. `--starting=<item>[,<item>…]` appends
 * those names to EVERY slot's `starting_items` on the worker's copy before its
 * ops (a slot whose rules never name them is unmoved), and `--from=<id>[,<id>…]`
 * keeps only entries whose CURRENT substrate is listed — so the granted-arrow
 * table of the bounce slots is `--from=bounce --targets=bounce --starting=…`.
 * The `rules owned` column counts the ops whose spec rewrote ≥ 1 rule (the op's
 * description or refusal carries the starting-inventory clause).
 *
 * ⛓ THE LIBRARY ENTRY SOURCE (R5a, plan §12): `--source=library` asks the op
 * with `source: {kind: 'library', …}` instead of a seed — EVERY entry of every
 * SERVED pack (`frontend/region-libraries/`, read off disk through the served
 * index) × EVERY committed region whose current substrate is the entry's
 * (`--limit` does not apply unless given; the hook draws no rng, so the ops are
 * fast). The rows are `from → <substrate> ← <entry_id>`; `--targets` / `--seed`
 * / `--starting` do not apply.
 *
 * Run:
 *   node scripts/procgen/check-regenerate-region-control.mjs
 *   node scripts/procgen/check-regenerate-region-control.mjs --source=library
 *   node scripts/procgen/check-regenerate-region-control.mjs --from=bounce --targets=bounce --starting='Right arrow'
 *   node scripts/procgen/check-regenerate-region-control.mjs --json
 *   node scripts/procgen/check-regenerate-region-control.mjs --targets=all --limit=4
 *   node scripts/procgen/check-regenerate-region-control.mjs --targets=bounce,runner --limit=2 --fixtures
 *   node scripts/procgen/check-regenerate-region-control.mjs --seed=7
 *   node scripts/procgen/check-regenerate-region-control.mjs --targets=bounce --op-timeout=20
 *
 * Pure node: no dev server, no browser. `--targets=all` = every registered entry
 * with a realiser (derived from the registry, never listed here).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const argv = process.argv.slice(2);
const arg = (n) => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    return hit ? hit.slice(n.length + 3) : null;
};
const JSON_OUT = argv.includes('--json');
const FIXTURES = argv.includes('--fixtures');

/** ⛓ The fast form's defaults (the header's ⚠). */
export const DEFAULT_LIMIT = 12;
export const DEFAULT_TARGETS = Object.freeze(['maze', 'text_adventure']);
export const DEFAULT_SEED = 1;
/** ⛓ One op's budget, in seconds (the header's ⛔). */
export const DEFAULT_OP_TIMEOUT_S = 60;

/** ⛓ The op's data source: `generate` (the realiser) or `library` (the header's ⛓). */
export const CONTROL_SOURCES = Object.freeze(['generate', 'library']);
const SOURCE = arg('source') ?? CONTROL_SOURCES[0];
if (!CONTROL_SOURCES.includes(SOURCE)) {
    process.stderr.write(`--source must be one of [${CONTROL_SOURCES.join(', ')}], got ${SOURCE}\n`);
    process.exit(2);
}
const LIBRARY = SOURCE === 'library';
const LIMIT = arg('limit') === null && LIBRARY ? Infinity : Number.parseInt(arg('limit') ?? `${DEFAULT_LIMIT}`, 10);
const SEED = Number.parseInt(arg('seed') ?? `${DEFAULT_SEED}`, 10);
const OP_TIMEOUT_S = Number(arg('op-timeout') ?? DEFAULT_OP_TIMEOUT_S);
const list = (v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
/** ⛓ Names appended to every slot's `starting_items` (the header's ⛓). */
const STARTING = list(arg('starting'));
/** ⛓ Only entries whose current substrate is one of these (empty = all). */
const FROM = list(arg('from'));

const errOut = (s) => process.stderr.write(`${s}\n`);

function documents() {
    const ls = (...extra) => execFileSync('git',
        ['-C', REPO, 'ls-files', ...extra, '--', 'frontend/presets'], { encoding: 'utf8' })
        .split('\n').filter((f) => f.endsWith('_rules.json'));
    const tracked = ls();
    const untracked = FIXTURES ? ls('--others', '--exclude-standard') : [];
    return [...new Set([...tracked, ...untracked])].sort();
}

const mod = (rel) => import(pathToFileURL(join(REPO, rel)).href);

async function loadModules() {
    const { REGISTRY_LIBRARIES } = await import('./reference/registry.mjs');
    const saved = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
    const quiet = () => {};
    Object.assign(console, { log: quiet, info: quiet, warn: quiet, error: quiet, debug: quiet });
    const failed = [];
    try {
        for (const rel of REGISTRY_LIBRARIES) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await mod(rel);
            } catch (e) {
                failed.push({ file: rel, error: String(e?.message ?? e).split('\n')[0] });
            }
        }
    } finally {
        Object.assign(console, saved);
    }
    const { substrateRegistry } = await mod('frontend/modules/shared/procgen/substrateRegistry.js');
    const {
        applyRulesDocOp, REGENERATE_NARROWED_BY_START, REGENERATE_SATISFIED_BY_START,
    } = await mod('frontend/modules/apworldEditor/rulesDocOps.js');
    const { sidecarIssues } = await mod('frontend/modules/apworldEditor/sidecarIssues.js');
    const { regionRealiserKind, strandedReferences } = await mod('frontend/modules/apworldEditor/regionRegenerate.js');
    return {
        substrateRegistry, applyRulesDocOp, sidecarIssues, regionRealiserKind, strandedReferences, failed,
        ownedClauses: [REGENERATE_SATISFIED_BY_START, REGENERATE_NARROWED_BY_START],
    };
}

/** ⛓ A refusal's CLASS: digits and quoted/backticked ids folded, so one cause is one row. */
export function refusalClass(error) {
    const threw = /refused region "[^"]*": (.*?)(?: — with (?:\d+ items? riding free|\d+ rules? (?:treated|narrowed)).*)?\.$/
        .exec(error);
    const head = threw ? `threw: ${threw[1]}` : error.replace(/^apworld: /, '');
    return head.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '…').replace(/\d+(\.\d+)?/g, 'N').slice(0, 120);
}

const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

/** ⛓ ONE op, classified — runs in the worker. */
function classifyOp(mods, doc, baseline, p, region, to, source) {
    const { substrateRegistry, applyRulesDocOp, strandedReferences } = mods;
    const s = performance.now();
    let res;
    try {
        res = applyRulesDocOp(doc, {
            op: 'regenerate-region-sidecar', player: p, region, substrate: to, ...(source ? { source } : { seed: SEED }),
        });
    } catch (e) {
        res = { ok: false, error: `THREW OUTSIDE THE OP: ${e?.message ?? e}` };
    }
    const ms = performance.now() - s;
    const owned = mods.ownedClauses.some((c) => (res.ok ? res.description : res.error).includes(c));
    if (!res.ok) return { ms, owned, refused: refusalClass(res.error) };
    const reg = substrateRegistry.get(to);
    const entry = res.doc.preset_sidecars[p][region];
    const carried = typeof reg?.apLocationNamesOf === 'function'
        ? new Set(reg.apLocationNamesOf(entry.playable_payload)) : null;
    const lost = carried
        ? (doc.regions?.[p]?.[region]?.locations ?? []).filter((l) => !carried.has(l.name)).length : 0;
    const named = new Set(strandedReferences(doc, p, region, entry).map((x) => `REF_UNRESOLVED|${x.region}`));
    const all = [...errorKeys(mods, res.doc, p)].filter((k) => !baseline.has(k));
    const added = all.filter((k) => !named.has(k.split('|').slice(0, 2).join('|')));
    return { ms, owned, lost, stranded: all.length - added.length, addedKinds: added.map((k) => k.split('|')[0]) };
}

const errorKeys = (mods, doc, p) => new Set(mods.sidecarIssues(doc, p).filter((i) => i.severity === 'error')
    .map((i) => `${i.kind}|${i.region}|${i.message ?? ''}`));

/** ⛓ The worker: load once, answer one op per message. */
async function workerLoop() {
    const mods = await loadModules();
    let cached = { rel: null, doc: null, base: new Map() };
    parentPort.on('message', ({ rel, p, region, to, source }) => {
        if (cached.rel !== rel) {
            const doc = JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
            if (STARTING.length) {
                doc.starting_items = { ...(doc.starting_items ?? {}) };
                for (const p of Object.keys(doc.preset_sidecars ?? {})) {
                    doc.starting_items[p] = [...(doc.starting_items[p] ?? []), ...STARTING];
                }
            }
            cached = { rel, doc, base: new Map() };
        }
        if (!cached.base.has(p)) cached.base.set(p, errorKeys(mods, cached.doc, p));
        parentPort.postMessage(classifyOp(mods, cached.doc, cached.base.get(p), p, region, to, source));
    });
    const realisers = mods.substrateRegistry.getAll()
        .filter((e) => mods.regionRealiserKind(e) !== null).map((e) => e.id);
    parentPort.postMessage({ ready: true, realisers, failed: mods.failed });
}

/**
 * ⛓ Every entry of every SERVED pack, read off disk through the served index
 * (the files the page fetches), as the op's `source` — the entry inlined.
 */
function servedLibraryJobs() {
    const dir = join(REPO, 'frontend', 'region-libraries');
    const index = JSON.parse(readFileSync(join(dir, 'region_library_files.json'), 'utf8')).libraries ?? [];
    return index.flatMap((row) => {
        const pack = JSON.parse(readFileSync(join(dir, row.file), 'utf8'));
        return (pack.entries ?? []).map((entry) => ({
            to: entry.substrate,
            label: `${entry.substrate} ← ${entry.entry_id}`,
            source: { kind: 'library', library_id: pack.library_id, entry_id: entry.entry_id, entry },
        }));
    });
}

/** ⛓ The main thread's handle on the worker: spawn, ask with a budget, respawn after a kill. */
function opRunner() {
    let worker = null;
    const spawn = () => new Promise((resolve, reject) => {
        worker = new Worker(new URL(import.meta.url), {
            workerData: { regenerateControlWorker: true }, argv: process.argv.slice(2), stdout: true, stderr: true,
        });
        worker.stdout.resume();
        worker.stderr.resume();
        worker.once('message', resolve);
        worker.once('error', reject);
    });
    const ask = (msg) => new Promise((resolve) => {
        const w = worker;
        const timer = setTimeout(() => {
            w.removeAllListeners('message');
            w.terminate().then(() => spawn()).then(() => resolve({ timedOut: true, ms: OP_TIMEOUT_S * 1000 }));
        }, OP_TIMEOUT_S * 1000);
        w.once('message', (m) => { clearTimeout(timer); resolve(m); });
        w.postMessage(msg);
    });
    return { spawn, ask, stop: () => worker?.terminate() };
}

async function main() {
    const t0 = Date.now();
    const runner = opRunner();
    const { realisers, failed } = await runner.spawn();
    // ⛓ `--source=library`: every served entry, as `{to, source, label}` jobs (the header's ⛓).
    const servedJobs = LIBRARY ? servedLibraryJobs() : null;
    const targetsArg = arg('targets');
    const targets = targetsArg === 'all' ? realisers
        : (targetsArg ? targetsArg.split(',').map((s) => s.trim()).filter(Boolean) : [...DEFAULT_TARGETS]);

    const cells = new Map(); // "from → to" -> tally
    const tally = (from, to) => {
        const k = `${from} → ${to}`;
        if (!cells.has(k)) {
            cells.set(k, {
                from, to, n: 0, clean: 0, stranded: 0, newErrors: 0, namesLost: 0, timedOut: 0, owned: 0,
                refused: {}, newKinds: {}, ms: [],
            });
        }
        return cells.get(k);
    };
    const timeouts = [];
    const docs = documents();
    let entries = 0;
    for (const [di, rel] of docs.entries()) {
        const td = Date.now();
        let doc;
        try {
            doc = JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
        } catch {
            continue;
        }
        const slots = Object.entries(doc?.preset_sidecars ?? {});
        if (!slots.length) continue;
        let here = 0;
        for (const [p, slot] of slots) {
            for (const [region, entry] of Object.entries(slot ?? {}).slice(0, LIMIT)) {
                if (FROM.length && !FROM.includes(entry?.substrate)) continue;
                const jobs = LIBRARY
                    ? servedJobs.filter((j) => j.to === entry?.substrate)
                    : targets.map((to) => ({ to, label: to, source: undefined }));
                if (LIBRARY && !jobs.length) continue;
                entries += 1;
                for (const { to, label, source } of jobs) {
                    const t = tally(entry?.substrate ?? '(none)', label);
                    t.n += 1;
                    here += 1;
                    // eslint-disable-next-line no-await-in-loop
                    const r = await runner.ask({ rel, p, region, to, source });
                    t.ms.push(r.ms);
                    if (r.owned) t.owned += 1;
                    if (r.timedOut) {
                        t.timedOut += 1;
                        timeouts.push({ document: rel, slot: p, region, from: t.from, to });
                        errOut(`  ⛔ TIMED OUT (> ${OP_TIMEOUT_S} s): ${rel} slot ${p} ${region} → ${to}`);
                    } else if (r.refused) {
                        t.refused[r.refused] = (t.refused[r.refused] ?? 0) + 1;
                    } else {
                        if (r.lost) t.namesLost += 1;
                        if (r.addedKinds.length || r.lost) {
                            t.newErrors += 1;
                            for (const kind of r.addedKinds) t.newKinds[kind] = (t.newKinds[kind] ?? 0) + 1;
                        } else if (r.stranded) {
                            t.stranded += 1;
                        } else {
                            t.clean += 1;
                        }
                    }
                }
            }
        }
        errOut(`[${di + 1}/${docs.length}] ${rel}: ${here} op(s), ${((Date.now() - td) / 1000).toFixed(1)} s`);
    }
    await runner.stop();

    const rows = [...cells.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
        .map((t) => ({
            from: t.from, to: t.to, n: t.n, clean: t.clean, stranded: t.stranded, newErrors: t.newErrors,
            namesLost: t.namesLost, timedOut: t.timedOut, rulesOwned: t.owned,
            refused: Object.values(t.refused).reduce((s, x) => s + x, 0), refusedByClass: t.refused,
            newErrorKinds: t.newKinds, medianMs: round1(median(t.ms)), maxMs: round1(Math.max(...t.ms)),
        }));
    const totals = rows.reduce((s, r) => ({
        n: s.n + r.n, clean: s.clean + r.clean, stranded: s.stranded + r.stranded, newErrors: s.newErrors + r.newErrors,
        refused: s.refused + r.refused, timedOut: s.timedOut + r.timedOut, rulesOwned: s.rulesOwned + r.rulesOwned,
    }), { n: 0, clean: 0, stranded: 0, newErrors: 0, refused: 0, timedOut: 0, rulesOwned: 0 });
    const out = {
        source: SOURCE,
        seed: LIBRARY ? null : SEED, limitPerSlot: LIMIT, opTimeoutS: OP_TIMEOUT_S, targets, from: FROM, starting: STARTING,
        realisers, documents: docs.length,
        entries, libraryLoadFailures: failed, totals, rows, timeouts, seconds: Math.round((Date.now() - t0) / 100) / 10,
    };
    if (JSON_OUT) {
        console.log(JSON.stringify(out, null, 1));
        return;
    }
    console.log(`regenerate-region control — ${LIBRARY
        ? `source library (${servedJobs.length} served entries)` : `seed ${SEED}`}, ≤${LIMIT} entries per slot, `
        + `${OP_TIMEOUT_S} s per op, targets [${LIBRARY ? [...new Set(servedJobs.map((j) => j.to))].join(', ') : targets.join(', ')}] `
        + `(realisers registered: ${realisers.join(', ')})`
        + `${FROM.length ? `, from [${FROM.join(', ')}]` : ''}${STARTING.length ? `, starting += [${STARTING.join(', ')}]` : ''}`);
    console.log(`${docs.length} documents, ${entries} entries, ${totals.n} ops in ${out.seconds} s`);
    for (const f of failed) console.log(`  ⚠ library did not load: ${f.file}: ${f.error}`);
    console.log('');
    console.log('| from → to | ops | clean | stranded (named) | new errors | refused | timed out | rules owned | median ms | max ms |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rows) {
        console.log(`| ${r.from} → ${r.to} | ${r.n} | ${r.clean} | ${r.stranded} | ${r.newErrors} | ${r.refused} | ${r.timedOut} | ${r.rulesOwned} | ${r.medianMs} | ${r.maxMs} |`);
    }
    console.log(`| **total** | ${totals.n} | ${totals.clean} | ${totals.stranded} | ${totals.newErrors} | ${totals.refused} | ${totals.timedOut} | ${totals.rulesOwned} | | |`);
    const classes = {};
    const kinds = {};
    for (const r of rows) {
        for (const [c, n] of Object.entries(r.refusedByClass)) classes[`${r.to} ← ${c}`] = (classes[`${r.to} ← ${c}`] ?? 0) + n;
        for (const [k, n] of Object.entries(r.newErrorKinds)) kinds[`${r.to}: ${k}`] = (kinds[`${r.to}: ${k}`] ?? 0) + n;
    }
    if (Object.keys(classes).length) {
        console.log('\nrefused, by class (target ← cause):');
        for (const [c, n] of Object.entries(classes).sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${c}`);
    }
    if (timeouts.length) {
        console.log(`\ntimed out (> ${OP_TIMEOUT_S} s, terminated):`);
        for (const x of timeouts) console.log(`  ${x.document} slot ${x.slot} ${x.region}: ${x.from} → ${x.to}`);
    }
    if (Object.keys(kinds).length) {
        console.log('\nnew sidecarIssues errors, by kind:');
        for (const [k, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${k}`);
    }
}

if (!isMainThread && workerData?.regenerateControlWorker) await workerLoop();
else if (isEntryPoint(import.meta.url)) await main();
