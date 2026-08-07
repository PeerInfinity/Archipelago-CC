#!/usr/bin/env node
/**
 * mine-seedling-roster-history — the evidence half of R6 slice 0's roster
 * trim (`note_roster_trim_evaluation`, kickoff §3.6).
 *
 * The full `--win` differential is ~3.5 hours at 100 tapes and gate latency
 * is the arc's slowest loop, so the ruling is to TIER the roster rather
 * than delete from it. A tier assignment is only defensible if it is
 * measured, and the only measurement the arc has kept is
 * `test-results/seedling-differential/checkpoint.jsonl` — every per-tape
 * verdict of every sweep since R5 slice 11, appended in order.
 *
 * ── What this reads, and the one inference it makes ───────────────────
 * A record is `{tape, fp, ok, checks[], secs}`. `fp` is per-TAPE
 * (`hash(modelFingerprint + tapeBytes + expectationBytes)`), so it cannot
 * group a run. Runs are recovered structurally instead: the sweep walks
 * `fixtureNames()` in sorted order and never repeats a tape, so a tape
 * name that reappears STARTS A NEW RUN. That is an inference, and it is
 * cross-checked against the number of `payloads/<modelFingerprint>/`
 * directories on disk — a mismatch is reported, never swallowed.
 *
 * ⚠ A run may be partial (`--only=`, an interrupt, `--tier=fast`), so
 * "did not appear in run N" is NOT evidence about a tape. Every count
 * below is over the runs a tape actually appeared in, and the roster
 * coverage per run is printed so a reader can see which runs were narrow.
 *
 * ── The three criteria, and what each can and cannot say ──────────────
 * 1. SOLE DETECTOR — a run in which this tape failed and no other tape
 *    did. Never cut a sole detector without a named replacement. This is
 *    the criterion with teeth; the others are advisory.
 * 2. CO-DETECTOR — failed in a run where others failed too. Weaker: the
 *    defect had other witnesses, but this tape saw it.
 *    ⛔ A tape that has never failed is NOT thereby redundant. It may
 *    cover a mechanism nothing has broken yet. Absence of a red is
 *    absence of evidence, and this script says so rather than ranking it
 *    last.
 * 3. COST — median seconds. The full walks are the cost centre; the
 *    ruling keeps at least one per rung as the integration stratum.
 *
 * Coverage-by-mechanism is NOT inferred here: it comes from the tape's own
 * declarations (levels, verbs, flags), which `--coverage` prints beside the
 * history so the two strata stay visibly separate.
 *
 * Usage:
 *   node scripts/procgen/mine-seedling-roster-history.mjs [--coverage] [--json]
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const CHECKPOINT_DIR = join(REPO, 'test-results', 'seedling-differential');
const CHECKPOINT = join(CHECKPOINT_DIR, 'checkpoint.jsonl');
const PAYLOADS = join(CHECKPOINT_DIR, 'payloads');

const WANT_COVERAGE = process.argv.includes('--coverage');
const AS_JSON = process.argv.includes('--json');

if (!existsSync(CHECKPOINT)) {
    console.error(`no checkpoint at ${CHECKPOINT} — nothing to mine`);
    process.exit(1);
}

const { fixtureNames, loadTape } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/index.js'));

const ROSTER = fixtureNames();
const ROSTER_SET = new Set(ROSTER);

// ── Parse, and segment into runs ──────────────────────────────────────
const records = readFileSync(CHECKPOINT, 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));

/** @type {{tapes: Map<string, object>}[]} */
const runs = [];
let current = null;
for (const r of records) {
    if (!current || current.tapes.has(r.tape)) {
        current = { tapes: new Map() };
        runs.push(current);
    }
    current.tapes.set(r.tape, r);
}

const payloadDirs = existsSync(PAYLOADS)
    ? readdirSync(PAYLOADS, { withFileTypes: true }).filter((d) => d.isDirectory()).length
    : 0;

// ── Per-tape history ──────────────────────────────────────────────────
const hist = new Map();
const seen = (name) => {
    if (!hist.has(name)) {
        hist.set(name, {
            name, runs: 0, fails: 0, soleDetector: 0, coDetector: 0,
            secs: [], inRoster: ROSTER_SET.has(name),
            soleDetectorRuns: [],
        });
    }
    return hist.get(name);
};

runs.forEach((run, i) => {
    const failed = [...run.tapes.values()].filter((r) => !r.ok);
    for (const r of run.tapes.values()) {
        const h = seen(r.tape);
        h.runs++;
        if (typeof r.secs === 'number') h.secs.push(r.secs);
        if (!r.ok) {
            h.fails++;
            if (failed.length === 1) { h.soleDetector++; h.soleDetectorRuns.push(i + 1); }
            else h.coDetector++;
        }
    }
});

const median = (a) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
};

// ── Report ────────────────────────────────────────────────────────────
const rows = ROSTER.map((n) => {
    const h = hist.get(n) ?? seen(n);
    return { ...h, medianSecs: median(h.secs) };
});
const orphans = [...hist.values()].filter((h) => !h.inRoster);

if (AS_JSON) {
    console.log(JSON.stringify({
        runs: runs.length, payloadDirs, roster: ROSTER.length,
        rows, orphans: orphans.map((o) => o.name),
    }, null, 2));
    process.exit(0);
}

console.log(`records ${records.length} | runs (inferred) ${runs.length} `
    + `| payload dirs on disk ${payloadDirs} | roster ${ROSTER.length}`);
if (payloadDirs && payloadDirs !== runs.length) {
    console.log(`⚠ RUN-COUNT MISMATCH: ${runs.length} inferred vs ${payloadDirs} payload `
        + 'dirs. Payload dirs are keyed by MODEL fingerprint, so two runs at the '
        + 'same fingerprint share a dir and a run that wrote no payload has none — '
        + 'the counts are related, not equal. Reported, not reconciled.');
}
console.log('');
console.log('RUN SHAPES (roster coverage per run — a narrow run is not evidence):');
runs.forEach((r, i) => {
    const f = [...r.tapes.values()].filter((x) => !x.ok).map((x) => x.tape);
    console.log(`  run ${String(i + 1).padStart(2)}: ${String(r.tapes.size).padStart(3)} tape(s)`
        + `${f.length ? `  RED: ${f.join(', ')}` : ''}`);
});

console.log('');
console.log('SOLE DETECTORS (a run this tape failed alone — never cut without a named replacement):');
const soles = rows.filter((r) => r.soleDetector > 0);
if (!soles.length) console.log('  (none)');
for (const r of soles.sort((a, b) => b.soleDetector - a.soleDetector)) {
    console.log(`  ${r.name.padEnd(30)} sole ${r.soleDetector}x  (runs ${r.soleDetectorRuns.join(',')})`);
}

console.log('');
console.log('CO-DETECTORS (failed alongside others):');
const cos = rows.filter((r) => r.coDetector > 0 && r.soleDetector === 0);
if (!cos.length) console.log('  (none)');
for (const r of cos.sort((a, b) => b.coDetector - a.coDetector)) {
    console.log(`  ${r.name.padEnd(30)} co ${r.coDetector}x`);
}

console.log('');
console.log('COST (median seconds, descending — the cut targets if any):');
for (const r of [...rows].sort((a, b) => (b.medianSecs ?? -1) - (a.medianSecs ?? -1)).slice(0, 25)) {
    console.log(`  ${r.name.padEnd(30)} ${String(r.medianSecs ?? '—').padStart(5)}s `
        + `over ${String(r.runs).padStart(2)} run(s)`
        + `${r.fails ? `  [${r.fails} red]` : ''}`);
}

const totalSecs = rows.reduce((s, r) => s + (r.medianSecs ?? 0), 0);
console.log('');
console.log(`TOTAL of medians: ${totalSecs}s = ${(totalSecs / 60).toFixed(1)} min `
    + `(serial browser replay; the real sweep adds per-tape page loads)`);

const never = rows.filter((r) => r.runs === 0);
if (never.length) {
    console.log('');
    console.log(`⚠ NO HISTORY AT ALL (${never.length}) — these are in the roster and the `
        + 'checkpoint has never recorded them. Absence of evidence:');
    for (const r of never) console.log(`  ${r.name}`);
}
if (orphans.length) {
    console.log('');
    console.log(`⚠ IN THE CHECKPOINT, NOT IN THE ROSTER (${orphans.length}) — renamed or removed fixtures:`);
    for (const o of orphans) console.log(`  ${o.name} (${o.runs} run(s), ${o.fails} red)`);
}

if (WANT_COVERAGE) {
    console.log('');
    console.log('COVERAGE, from each tape\'s OWN declarations (a separate stratum):');
    for (const n of ROSTER) {
        let t;
        try { t = loadTape(n); } catch { console.log(`  ${n.padEnd(30)} (unreadable)`); continue; }
        const levels = new Set();
        if (t.boot?.level != null) levels.add(t.boot.level);
        for (const g of t.grants ?? []) if (g.level != null) levels.add(g.level);
        for (const c of t.persistence ?? []) if (c.level != null) levels.add(c.level);
        const keys = new Set();
        for (const s of t.spans ?? []) for (const k of [].concat(s.key ?? [])) keys.add(k);
        const flags = Object.entries(t).filter(([k, v]) => v === true).map(([k]) => k);
        console.log(`  ${n.padEnd(30)} ticks=${String(t.tick_count ?? '?').padStart(6)}`
            + ` levels={${[...levels].sort((a, b) => a - b).join(',')}}`
            + ` keys={${[...keys].sort().join(',')}}`
            + ` flags=[${flags.join(',')}]`);
    }
}
