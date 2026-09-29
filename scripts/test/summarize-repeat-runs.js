#!/usr/bin/env node
/**
 * summarize-repeat-runs.js — the table a REPEAT job prints: one in-app run,
 * N times over, as a rate (plan §48, the user's ruling: "a manual-dispatch
 * input naming one row and a count, running it solo N times and reporting
 * pass/fail per run with duration and whatever the row logs about its
 * target").
 *
 * Reads a directory the workflow (.github/workflows/test-substrates-repeat.yml)
 * fills, one set per run index i (1-based):
 *   run-<i>.meta.json  { run, exit, seconds }   — always written by the job
 *   run-<i>.json       the spec's results file   — absent if the run died first
 *   run-<i>.log        the run's full output     — uploaded, not read here
 * and prints markdown: the RATE first (so a green job is never mistaken for
 * k = N), then one row per run, then the rows that failed in any run.
 *
 * A run PASSES when `npm test` exited 0 — the spec's own verdict, which holds
 * every gate (failed rows, the roster, handler errors) — AND left a results
 * file. The columns say why a run did not.
 *
 * Usage: node scripts/test/summarize-repeat-runs.js <dir> [--title="…"]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** What a row logged about the target it drew — the read-back row's premise, a solo's "hooked" line. */
const TARGET_LINE = /\btarget\b|\bhooked\b/i;
const MAX_CELL = 160;

function cell(text) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
  return flat.length > MAX_CELL ? `${flat.slice(0, MAX_CELL - 1)}…` : flat;
}

function seconds(ms) {
  return ms != null ? `${(ms / 1000).toFixed(1)}s` : '-';
}

/**
 * One run's facts, from its meta and (when present) its results file.
 *
 * @param {{run:number, exit:number|null, seconds:number|null}} meta
 * @param {object|null} results - the spec's results file, parsed
 */
export function describeRun(meta, results) {
  const rows = results?.testDetails || [];
  const failed = rows.filter((r) => r.status === 'failed');
  const firstFailedCondition = failed
    .flatMap((r) => (r.conditions || []).filter((c) => c.status === 'failed').map((c) => `${r.id}: ${c.description}`))[0]
    ?? (failed[0] ? `${failed[0].id}: (died before asserting)` : null);
  const handler = results?.pageDiagnostics?.handlerErrors ?? null;
  const targets = [];
  for (const r of rows) {
    for (const entry of r.logs || []) {
      const msg = typeof entry === 'string' ? entry : entry?.message;
      if (typeof msg === 'string' && TARGET_LINE.test(msg)) targets.push(rows.length > 1 ? `${r.id}: ${msg}` : msg);
    }
  }
  const s = results?.summary || {};
  let why = null;
  if (!results) why = 'no results file — the run died before the spec saved one (see its log)';
  else if (firstFailedCondition) why = firstFailedCondition;
  else if (s.error) why = `runner stopped: ${s.error}`;
  else if ((s.notRunCount ?? 0) > 0) why = `${s.notRunCount} row(s) never ran`;
  else if (handler && (handler.logged > 0 || (handler.pageCount ?? 0) > handler.logged)) {
    why = `handler errors: ${handler.logged} logged${handler.rows?.[0]?.row ? ` (first: ${handler.rows[0].row})` : ''}`;
  } else if (meta.exit !== 0) why = `exit ${meta.exit}`;
  return {
    run: meta.run,
    // exit 0 with no results file: the spec's save failed (it logs, it does not
    // fail) — nothing says what ran, so it cannot count toward the rate's k.
    pass: meta.exit === 0 && !!results,
    exit: meta.exit,
    wallSeconds: meta.seconds,
    rows: rows.length,
    passedRows: rows.filter((r) => r.status === 'passed').length,
    failedRowIds: failed.map((r) => r.id),
    soloDurationMs: rows.length === 1 ? rows[0].durationMs ?? null : null,
    handlerErrors: handler ? Math.max(handler.logged ?? 0, handler.pageCount ?? 0) : null,
    why,
    targets,
    head: results?.frozen?.head ?? null,
    flavour: results?.flavour ?? null,
  };
}

/**
 * The markdown. First line: the rate.
 *
 * @param {ReturnType<typeof describeRun>[]} runs - in run order
 * @param {{title?: string}} [opts]
 * @returns {string}
 */
export function formatRepeatSummary(runs, { title = '' } = {}) {
  const n = runs.length;
  const k = runs.filter((r) => r.pass).length;
  const lines = [];
  lines.push(`**Rate: ${k}/${n} passed**${title ? ` — ${title}` : ''}`);
  lines.push('');
  if (n === 0) {
    lines.push('No run left a meta file — the job did not reach its loop.');
    return lines.join('\n');
  }
  const heads = [...new Set(runs.map((r) => r.head).filter(Boolean))];
  const flavours = [...new Set(runs.map((r) => r.flavour).filter(Boolean))];
  lines.push(`head ${heads.map((h) => `\`${h.slice(0, 10)}\``).join(', ') || '?'}`
    + ` · flavour ${flavours.join(', ') || '?'}`
    + ' · the job is green when it RAN N times; the rate above is the verdict.');
  lines.push('');
  const solo = runs.every((r) => r.rows <= 1);
  lines.push(`| run | verdict | wall | ${solo ? 'row time' : 'rows passed'} | handler errors | why not green | target / hooked |`);
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of runs) {
    const rowCol = solo ? seconds(r.soloDurationMs) : `${r.passedRows}/${r.rows}`;
    lines.push(`| ${r.run} | ${r.pass ? 'PASS' : '**FAIL**'} | ${r.wallSeconds != null ? `${r.wallSeconds}s` : '-'}`
      + ` | ${rowCol} | ${r.handlerErrors ?? '?'} | ${cell(r.why ?? '')} | ${cell(r.targets.join(' · '))} |`);
  }
  const failedIn = new Map();
  for (const r of runs) for (const id of r.failedRowIds) failedIn.set(id, [...(failedIn.get(id) || []), r.run]);
  if (failedIn.size > 0) {
    lines.push('');
    lines.push('| row | failed in | runs |');
    lines.push('|---|---|---|');
    for (const [id, which] of [...failedIn].sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`| ${cell(id)} | ${which.length}/${n} | ${which.join(', ')} |`);
    }
  }
  return lines.join('\n');
}

/** Reads `run-<i>.meta.json` (+ `run-<i>.json`) from a directory, in run order. */
export function loadRuns(dir) {
  const metas = readdirSync(dir)
    .map((f) => /^run-(\d+)\.meta\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  return metas.map((i) => {
    const meta = JSON.parse(readFileSync(path.join(dir, `run-${i}.meta.json`), 'utf8'));
    const resultsPath = path.join(dir, `run-${i}.json`);
    let results = null;
    if (existsSync(resultsPath)) {
      try {
        results = JSON.parse(readFileSync(resultsPath, 'utf8'));
      } catch {
        results = null;
      }
    }
    return describeRun({ run: i, ...meta }, results);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log('Usage: node scripts/test/summarize-repeat-runs.js <dir> [--title="…"]\n'
      + 'Prints the markdown rate table for the run-<i>.meta.json / run-<i>.json files in <dir>.');
    process.exit(args.length === 0 ? 2 : 0);
  }
  const dir = args.find((a) => !a.startsWith('--'));
  const title = (args.find((a) => a.startsWith('--title=')) || '').slice('--title='.length);
  console.log(formatRepeatSummary(loadRuns(dir), { title }));
}
