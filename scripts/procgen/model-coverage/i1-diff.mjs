#!/usr/bin/env node
/**
 * i1-diff — MEASURE ONLY (slice rules-model-coverage-inventory, 2026-10-05).
 * For every row of the fidelity I1 inventory (CC/docs/cloud-reports/seedling-fidelity-i1.json on branch
 * claude/seedling-fidelity-i1-p129pr), does the refusal text it quotes still exist in the model today?
 * Each quoted fragment (split at "…" / "${...}") of >= 24 chars is searched verbatim (fixed string) in every
 * non-test .js under seedlingDemo/ and flashPanel/. A row whose fragments are ALL gone is a CANDIDATE change
 * (fixed, reworded or moved) — a pointer to read, never a verdict on its own.
 *
 *   node scripts/procgen/model-coverage/i1-diff.mjs --i1=<i1.json> --out=<file>
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=');
const i1 = JSON.parse(readFileSync(arg('i1'), 'utf8'));
const DIRS = ['frontend/modules/seedlingDemo', 'frontend/modules/flashPanel'];
const corpus = [];
for (const d of DIRS) for (const f of readdirSync(join(REPO, d))) {
    if (!f.endsWith('.js') || f.includes('.test.')) continue;
    corpus.push([`${d.split('/').pop()}/${f}`, readFileSync(join(REPO, d, f), 'utf8').replace(/(['"`])\s*\+\s*\n?\s*(['"`])/g, '').replace(/(['"`])\s*\n\s*\+\s*(['"`])/g, '')]);
}
const norm = (s) => s.replace(/\s+/g, ' ');
const corpusN = corpus.map(([f, t]) => [f, norm(t)]);
const rows = [];
for (const r of i1.rows) {
    const quoted = [...(r.text ?? '').matchAll(/"([^"]{24,})"|“([^”]{24,})”/g)].map((m) => m[1] ?? m[2]);
    const src = quoted.length ? quoted : [r.text ?? ''];
    const frags = src.flatMap((q) => q.split(/…|\.\.\.|\$\{[^}]*\}|`/)).map((s) => norm(s).trim()).filter((s) => s.length >= 24);
    const found = frags.map((f) => ({ frag: f.slice(0, 80), files: corpusN.filter(([, t]) => t.includes(f)).map(([n]) => n) }));
    const sitesFiles = (r.sites ?? []).map((s) => s.split(':')[0].split(' ')[0]).filter((f) => /\.js$/.test(f));
    const missingFiles = sitesFiles.filter((f) => !DIRS.some((d) => existsSync(join(REPO, d, f))));
    const present = found.filter((x) => x.files.length).length;
    rows.push({ id: r.id, key: r.key, i1status: r.status, rank: r.rank, fragments: found.length, present,
        verdict: found.length === 0 ? 'NO-QUOTE' : present === 0 ? 'TEXT-GONE' : present < found.length ? 'TEXT-PARTIAL' : 'TEXT-PRESENT',
        missingSiteFiles: missingFiles, found });
}
writeFileSync(arg('out'), JSON.stringify(rows, null, 1));
const c = {}; for (const r of rows) c[r.verdict] = (c[r.verdict] ?? 0) + 1;
console.log(c);
for (const r of rows) console.log(`${r.id} ${r.key} [${r.i1status}] ${r.verdict} ${r.present}/${r.fragments}${r.missingSiteFiles.length ? ' missing:' + r.missingSiteFiles : ''}`);
