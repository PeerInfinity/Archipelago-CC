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
 * Run:
 *   node scripts/procgen/check-regenerate-region-control.mjs
 *   node scripts/procgen/check-regenerate-region-control.mjs --json
 *   node scripts/procgen/check-regenerate-region-control.mjs --targets=all --limit=4
 *   node scripts/procgen/check-regenerate-region-control.mjs --targets=bounce,runner --limit=2 --fixtures
 *   node scripts/procgen/check-regenerate-region-control.mjs --seed=7
 *
 * Pure node: no dev server, no browser. `--targets=all` = every registered entry
 * with a realiser (derived from the registry, never listed here).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

const LIMIT = Number.parseInt(arg('limit') ?? `${DEFAULT_LIMIT}`, 10);
const SEED = Number.parseInt(arg('seed') ?? `${DEFAULT_SEED}`, 10);

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
    const { applyRulesDocOp } = await mod('frontend/modules/apworldEditor/rulesDocOps.js');
    const { sidecarIssues } = await mod('frontend/modules/apworldEditor/sidecarIssues.js');
    const { regionRealiserKind, strandedReferences } = await mod('frontend/modules/apworldEditor/regionRegenerate.js');
    return { substrateRegistry, applyRulesDocOp, sidecarIssues, regionRealiserKind, strandedReferences, failed };
}

/** ⛓ A refusal's CLASS: digits and quoted/backticked ids folded, so one cause is one row. */
export function refusalClass(error) {
    const threw = /realiser refused region "[^"]*": (.*?) — with \d+ items? riding free/.exec(error);
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

async function main() {
    const t0 = Date.now();
    const {
        substrateRegistry, applyRulesDocOp, sidecarIssues, regionRealiserKind, strandedReferences, failed,
    } = await loadModules();
    const realisers = substrateRegistry.getAll().filter((e) => regionRealiserKind(e) !== null).map((e) => e.id);
    const targetsArg = arg('targets');
    const targets = targetsArg === 'all' ? realisers
        : (targetsArg ? targetsArg.split(',').map((s) => s.trim()).filter(Boolean) : [...DEFAULT_TARGETS]);
    const errorKeys = (doc, p) => new Set(sidecarIssues(doc, p).filter((i) => i.severity === 'error')
        .map((i) => `${i.kind}|${i.region}|${i.message ?? ''}`));

    const cells = new Map(); // "from → to" -> tally
    const tally = (from, to) => {
        const k = `${from} → ${to}`;
        if (!cells.has(k)) cells.set(k, { from, to, n: 0, clean: 0, stranded: 0, newErrors: 0, namesLost: 0, refused: {}, newKinds: {}, ms: [] });
        return cells.get(k);
    };
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
            const baseline = errorKeys(doc, p);
            for (const [region, entry] of Object.entries(slot ?? {}).slice(0, LIMIT)) {
                entries += 1;
                for (const to of targets) {
                    const t = tally(entry?.substrate ?? '(none)', to);
                    t.n += 1;
                    here += 1;
                    const s = performance.now();
                    let res;
                    try {
                        res = applyRulesDocOp(doc, {
                            op: 'regenerate-region-sidecar', player: p, region, substrate: to, seed: SEED,
                        });
                    } catch (e) {
                        res = { ok: false, error: `THREW OUTSIDE THE OP: ${e?.message ?? e}` };
                    }
                    t.ms.push(performance.now() - s);
                    if (!res.ok) {
                        const c = refusalClass(res.error);
                        t.refused[c] = (t.refused[c] ?? 0) + 1;
                        continue;
                    }
                    const reg = substrateRegistry.get(to);
                    const carried = typeof reg?.apLocationNamesOf === 'function'
                        ? new Set(reg.apLocationNamesOf(res.doc.preset_sidecars[p][region].playable_payload)) : null;
                    const lost = carried
                        ? (doc.regions?.[p]?.[region]?.locations ?? []).filter((l) => !carried.has(l.name)).length : 0;
                    const named = new Set(strandedReferences(doc, p, region, res.doc.preset_sidecars[p][region])
                        .map((x) => `REF_UNRESOLVED|${x.region}`));
                    const all = [...errorKeys(res.doc, p)].filter((k) => !baseline.has(k));
                    const added = all.filter((k) => !named.has(k.split('|').slice(0, 2).join('|')));
                    if (lost) t.namesLost += 1;
                    if (!added.length && !lost && all.length) {
                        t.stranded += 1;
                    } else if (added.length || lost) {
                        t.newErrors += 1;
                        for (const k of added) {
                            const kind = k.split('|')[0];
                            t.newKinds[kind] = (t.newKinds[kind] ?? 0) + 1;
                        }
                    } else {
                        t.clean += 1;
                    }
                }
            }
        }
        errOut(`[${di + 1}/${docs.length}] ${rel}: ${here} op(s), ${((Date.now() - td) / 1000).toFixed(1)} s`);
    }

    const rows = [...cells.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
        .map((t) => ({
            from: t.from, to: t.to, n: t.n, clean: t.clean, stranded: t.stranded, newErrors: t.newErrors,
            namesLost: t.namesLost,
            refused: Object.values(t.refused).reduce((s, x) => s + x, 0), refusedByClass: t.refused,
            newErrorKinds: t.newKinds, medianMs: round1(median(t.ms)), maxMs: round1(Math.max(...t.ms)),
        }));
    const totals = rows.reduce((s, r) => ({
        n: s.n + r.n, clean: s.clean + r.clean, stranded: s.stranded + r.stranded, newErrors: s.newErrors + r.newErrors,
        refused: s.refused + r.refused,
    }), { n: 0, clean: 0, stranded: 0, newErrors: 0, refused: 0 });
    const out = {
        seed: SEED, limitPerSlot: LIMIT, targets, realisers, documents: docs.length, entries,
        libraryLoadFailures: failed, totals, rows, seconds: Math.round((Date.now() - t0) / 100) / 10,
    };
    if (JSON_OUT) {
        console.log(JSON.stringify(out, null, 1));
        return;
    }
    console.log(`regenerate-region control — seed ${SEED}, ≤${LIMIT} entries per slot, targets [${targets.join(', ')}] `
        + `(realisers registered: ${realisers.join(', ')})`);
    console.log(`${docs.length} documents, ${entries} entries, ${totals.n} ops in ${out.seconds} s`);
    for (const f of failed) console.log(`  ⚠ library did not load: ${f.file}: ${f.error}`);
    console.log('');
    console.log('| from → to | ops | clean | stranded (named) | new errors | refused | median ms | max ms |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rows) {
        console.log(`| ${r.from} → ${r.to} | ${r.n} | ${r.clean} | ${r.stranded} | ${r.newErrors} | ${r.refused} | ${r.medianMs} | ${r.maxMs} |`);
    }
    console.log(`| **total** | ${totals.n} | ${totals.clean} | ${totals.stranded} | ${totals.newErrors} | ${totals.refused} | | |`);
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
    if (Object.keys(kinds).length) {
        console.log('\nnew sidecarIssues errors, by kind:');
        for (const [k, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${k}`);
    }
}

if (isEntryPoint(import.meta.url)) await main();
