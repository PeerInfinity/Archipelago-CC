/**
 * refresh-seedling-derived-rules.mjs — its pure parts, on fixtures (slice rule-table-doc-command). No `gh`, no network,
 * no producer run: the argv, which run a dispatch made, the SHA gate, the verdict diff, and the `--check` / `--run` reports.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    ARTIFACT, PROBE, WORKFLOW, checkReport, parseArgs, refreshCommand, runSummary, selectDispatchedRun, shaGate, stalenessReasons, tableDiff,
} from './refresh-seedling-derived-rules.mjs';
import { REGEN_RECIPE } from './seedlingDerivedRuleTable.js';

const row = (key, region, rule = { rule: 'True_' }) => ({ key, kind: 'exit', region, name: key, arrival: 'entrance', atlas: {}, rule });
const INPUTS = { payloadMd5: 'p0', engineMd5: 'e0', engineFiles: 42, witnessMd5: 'w0' };
const table = (rows, excluded = [], inputs = INPUTS) => ({
    measuredAt: 'abc1234567', inputs, counts: { rows: rows.length, regions: new Set(rows.map((r) => r.region)).size, excluded: excluded.length }, excluded, rows,
});
const T0 = table([row('a|a -> b', 'a'), row('c|c -> d', 'c', { rule: 'Has', value: 'Swim' })], [{ key: 'x|x -> y', why: 'sharedBinding: E' }]);
const EXPECTED_T0 = { rows: 2, regions: 2, excluded: 1 };
const staleLine = (m) => `STALE derived-rule table: ${m} — regenerate: ${REGEN_RECIPE}`;

describe('parseArgs', () => {
    it('defaults to the offline --check', () => {
        expect(parseArgs([])).toMatchObject({ mode: 'check', chain: true, runId: null, ref: null, allowShaMismatch: null });
        expect(parseArgs(['--check']).mode).toBe('check');
    });
    it('reads --dispatch with --ref and --wait-max, and --run with its reasoned mismatch', () => {
        expect(parseArgs(['--dispatch', '--ref=claude/x', '--wait-max=30', '--no-chain'])).toMatchObject({ mode: 'dispatch', ref: 'claude/x', waitMaxMin: 30, chain: false });
        expect(parseArgs(['--run=44144131685', '--allow-sha-mismatch=a measured reason=yes'])).toMatchObject({
            mode: 'run', runId: '44144131685', allowShaMismatch: 'a measured reason=yes',
        });
    });
    it('refuses by name: two modes, a non-numeric run, a reasonless mismatch, --ref off dispatch, flags on --check, an unknown flag', () => {
        expect(() => parseArgs(['--dispatch', '--run=1'])).toThrow(/two modes/);
        expect(() => parseArgs(['--run=latest'])).toThrow(/numeric run id/);
        expect(() => parseArgs(['--run=1', '--allow-sha-mismatch='])).toThrow(/measured reason/);
        expect(() => parseArgs(['--run=1', '--allow-sha-mismatch'])).toThrow(/unknown argument/);
        expect(() => parseArgs(['--run=1', '--ref=main'])).toThrow(/--ref goes with --dispatch/);
        expect(() => parseArgs(['--no-chain'])).toThrow(/--check is offline/);
        expect(() => parseArgs(['--write'])).toThrow(/unknown argument --write/);
        expect(() => parseArgs(['--wait-max=0', '--dispatch'])).toThrow(/minutes/);
    });
});

describe('selectDispatchedRun — by headSha and created-after, never "the newest"', () => {
    const after = '2026-11-18T10:00:00Z';
    const runs = [
        { databaseId: 9, headSha: 'other', createdAt: '2026-11-18T10:00:30Z', event: 'workflow_dispatch' }, // newest, wrong SHA
        { databaseId: 8, headSha: 'sha1', createdAt: '2026-11-18T09:00:00Z', event: 'workflow_dispatch' }, // right SHA, before
        { databaseId: 7, headSha: 'sha1', createdAt: '2026-11-18T10:00:10Z', event: 'workflow_dispatch' },
    ];
    it('takes the one run at the SHA created after the dispatch', () => {
        expect(selectDispatchedRun(runs, { headSha: 'sha1', after }).databaseId).toBe(7);
    });
    it('allows a few seconds of clock skew, not more', () => {
        const skew = [{ databaseId: 6, headSha: 'sha1', createdAt: '2026-11-18T09:59:57Z' }];
        expect(selectDispatchedRun(skew, { headSha: 'sha1', after })?.databaseId).toBe(6);
        expect(selectDispatchedRun(skew, { headSha: 'sha1', after, skewMs: 1000 })).toBeNull();
    });
    it('returns null while none has appeared, and refuses two by id', () => {
        expect(selectDispatchedRun(runs.slice(0, 2), { headSha: 'sha1', after })).toBeNull();
        const two = [...runs, { databaseId: 10, headSha: 'sha1', createdAt: '2026-11-18T10:01:00Z', event: 'workflow_dispatch' }];
        expect(() => selectDispatchedRun(two, { headSha: 'sha1', after })).toThrow(/7, 10.*--run=<id>/);
    });
    it('ignores a push-triggered run at the same SHA', () => {
        const push = [{ databaseId: 5, headSha: 'sha1', createdAt: '2026-11-18T10:00:10Z', event: 'push' }];
        expect(selectDispatchedRun(push, { headSha: 'sha1', after })).toBeNull();
    });
});

describe('shaGate', () => {
    it('passes an equal SHA, refuses a different one by name, and prints the reason when allowed', () => {
        expect(shaGate('a'.repeat(40), 'a'.repeat(40), null).ok).toBe(true);
        const no = shaGate('b'.repeat(40), 'a'.repeat(40), null);
        expect(no.ok).toBe(false);
        expect(no.line).toMatch(/SHA MISMATCH.*bbbbbbbbbb.*aaaaaaaaaa.*--allow-sha-mismatch/);
        const yes = shaGate('b'.repeat(40), 'a'.repeat(40), 'the round trip');
        expect(yes.ok).toBe(true);
        expect(yes.line).toMatch(/ALLOWED, reason: the round trip/);
    });
});

describe('tableDiff — element → old → new', () => {
    it('is empty for the same table', () => {
        expect(tableDiff(T0, structuredClone(T0))).toEqual({ moved: [], inputs: [] });
    });
    it('names an added, a removed, a re-ruled row and an exclusion that moved, and the inputs that moved', () => {
        const T1 = table([row('a|a -> b', 'a', { rule: 'Has', value: 'Spear' }), row('e|e -> f', 'e')],
            [{ key: 'c|c -> d', why: 'sharedBinding: F' }], { ...INPUTS, payloadMd5: 'p1' });
        const d = tableDiff(T0, T1);
        expect(d.moved).toEqual([
            { key: 'a|a -> b', was: 'rule {"rule":"True_"}', now: 'rule {"rule":"Has","value":"Spear"}' },
            { key: 'c|c -> d', was: 'rule {"rule":"Has","value":"Swim"}', now: 'excluded (sharedBinding: F)' },
            { key: 'e|e -> f', was: 'absent', now: 'rule {"rule":"True_"}' },
            { key: 'x|x -> y', was: 'excluded (sharedBinding: E)', now: 'absent' },
        ]);
        expect(d.inputs).toEqual([{ field: 'payloadMd5', was: 'p0', now: 'p1' }]);
    });
    it('does not call an inputs-only re-record a verdict move', () => {
        const T1 = { ...structuredClone(T0), measuredAt: 'zzz', inputs: { ...INPUTS, engineMd5: 'e1' } };
        expect(tableDiff(T0, T1).moved).toEqual([]);
    });
});

describe('checkReport (--check)', () => {
    it('OK on a fresh, on-count table', () => {
        const r = checkReport({ table: T0, expectedTable: EXPECTED_T0, stale: [], branch: 'main' });
        expect(r.ok).toBe(true);
        expect(r.lines.at(-1)).toMatch(/^OK: /);
        expect(r.lines.join('\n')).toMatch(/rows 2=2, regions 2=2, excluded 1=1 OK/);
    });
    it('STALE names the md5 that moved, once, and prints the exact refresh command', () => {
        const stale = [staleLine('the maze world payloads moved (payloadMd5 p0 → p1): the derivation\'s input changed')];
        const r = checkReport({ table: T0, expectedTable: EXPECTED_T0, stale, branch: 'claude/x' });
        expect(r.ok).toBe(false);
        const text = r.lines.join('\n');
        expect(text).toMatch(/staleness: STALE — the maze world payloads moved \(payloadMd5 p0 → p1\)/);
        expect(text).toContain(refreshCommand('claude/x'));
        expect(text).toContain('node scripts/procgen/refresh-seedling-derived-rules.mjs --dispatch --ref=claude/x');
        expect(text).not.toContain('regenerate:');
    });
    it('a count off the pin, or a counts block that disagrees with the rows, is a DRIFT', () => {
        expect(checkReport({ table: T0, expectedTable: { ...EXPECTED_T0, rows: 3 }, stale: [], branch: null }).ok).toBe(false);
        const lying = { ...T0, counts: { ...T0.counts, rows: 9 } };
        const r = checkReport({ table: lying, expectedTable: EXPECTED_T0, stale: [], branch: null });
        expect(r.ok).toBe(false);
        expect(r.lines.join('\n')).toMatch(/own counts block says 9[\s\S]*--ref=<branch>/);
    });
});

describe('runSummary (--run)', () => {
    const base = { runId: '1', newTable: T0, identical: true, expectedTable: EXPECTED_T0, drift: [], diff: { moved: [], inputs: [] }, stale: [], chain: 'every step OK' };
    it('OK: byte-identical, on count, no verdict moved, fresh', () => {
        const s = runSummary(base);
        expect(s).toMatchObject({ ok: true, verdictsMoved: false });
        expect(s.lines.join('\n')).toMatch(/BYTE-IDENTICAL[\s\S]*every pinned count matches[\s\S]*verdicts moved: none[\s\S]*staleness: OK[\s\S]*nothing committed or pushed/);
    });
    it('a moved verdict is printed per element and in capitals, with the review rule', () => {
        const s = runSummary({ ...base, identical: false, diff: { moved: [{ key: 'a|a -> b', was: 'absent', now: 'rule {}' }], inputs: [] } });
        expect(s.verdictsMoved).toBe(true);
        const text = s.lines.join('\n');
        expect(text).toMatch(/1 VERDICT\(S\) MOVED:\n {4}a\|a -> b: absent → rule \{\}/);
        expect(text).toMatch(/THE TABLE'S VERDICTS MOVED[\s\S]*designer review/);
    });
    it('NOT OK on a drift, a stale table or a failed chain', () => {
        expect(runSummary({ ...base, drift: ['table.rows: expected 2, measured 3'] }).ok).toBe(false);
        expect(runSummary({ ...base, stale: [staleLine('x')] }).ok).toBe(false);
        expect(runSummary({ ...base, chain: 'FAILED (exit 1; its lines above name the step)' }).ok).toBe(false);
    });
});

describe('the wiring it names', () => {
    it('reads the artifact seedling-probe.yml uploads for the probe, and strips the recipe from a staleness line', () => {
        const yml = readFileSync(join(resolve(dirname(fileURLToPath(import.meta.url)), '../..'), '.github/workflows', WORKFLOW), 'utf8');
        expect(yml).toContain('name: ${{ matrix.id }}-log');
        expect(yml).toContain('id: probe.replace(/\\.mjs$/, "")');
        expect(ARTIFACT).toBe(`${PROBE.replace(/\.mjs$/, '')}-log`);
        expect(stalenessReasons([staleLine('why')])).toEqual(['why']);
    });
});
