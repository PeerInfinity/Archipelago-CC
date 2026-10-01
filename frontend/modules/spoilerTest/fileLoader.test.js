// frontend/modules/spoilerTest/fileLoader.test.js
/**
 * EDITOR v3 slice E1c — **THE SPHERE-LOG SIDECAR SURVIVES A `.json.gz` NAME.**
 *
 * ⛓ The brief said to MEASURE whether `fileLoader`'s derivation breaks on a
 * gzipped ruleset name before changing anything. It does: `AP_1_rules.json.gz`
 * misses the `_rules.json` branch, misses the `.json` branch too, and lands in
 * the error branch — deriving `AP_1_rules.json_sphere_log.jsonl`, a path that
 * cannot exist, while logging about a missing extension rather than about the
 * sidecar. The fix is one `.gz` strip before the suffix test, and this row is
 * both the measurement and the pin.
 *
 * ⚠ Only the RULESET name loses its `.gz`. The two files are compressed
 * independently, so a gzipped rules file does not imply a gzipped sidecar.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileLoader, deriveSphereLogPath, embeddedSphereLogLabel } from './fileLoader.js';

describe('deriveSphereLogPath', () => {
    it('derives the sidecar beside a plain ruleset', () => {
        expect(deriveSphereLogPath('presets/alttp/AP_1/AP_1_rules.json'))
            .toBe('presets/alttp/AP_1/AP_1_sphere_log.jsonl');
    });

    it('strips a multiworld player suffix', () => {
        expect(deriveSphereLogPath('presets/x/AP_9/AP_9_P2_rules.json'))
            .toBe('presets/x/AP_9/AP_9_sphere_log.jsonl');
    });

    it('derives the SAME sidecar for a gzipped ruleset name', () => {
        expect(deriveSphereLogPath('presets/alttp/AP_1/AP_1_rules.json.gz'))
            .toBe('presets/alttp/AP_1/AP_1_sphere_log.jsonl');
    });

    it('handles a bare filename and a leading ./', () => {
        expect(deriveSphereLogPath('AP_1_rules.json')).toBe('./AP_1_sphere_log.jsonl');
        expect(deriveSphereLogPath('./d/AP_1_rules.json.gz')).toBe('d/AP_1_sphere_log.jsonl');
    });

    it('returns null when there is no ruleset path', () => {
        expect(deriveSphereLogPath('')).toBeNull();
        expect(deriveSphereLogPath(null)).toBeNull();
    });
});

/**
 * ⛓ topdown-spoiler-log (2026-10-01) — **AN EMBEDDED `sphere_log` IS THE
 * FALLBACK, THE `.jsonl` STAYS AUTHORITATIVE.** Every `procgen_topdown` preset
 * embeds its log and ships no `.jsonl`; "Load Suggested Log" ended at the 404.
 */
describe('attemptAutoLoad — the embedded sphere_log fallback', () => {
    const RULES = 'presets/g/AP_1/AP_1_rules.json';
    const EMBEDDED = [
        { type: 'metadata', seed: 1 },
        { type: 'state_update', sphere_index: '0', player_data: { 1: {} } },
    ];
    const respond = (ok, body = '') => vi.fn(async () => ({
        ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'File not found',
        text: async () => body,
    }));
    afterEach(() => vi.unstubAllGlobals());

    it('reads the embedded log when the .jsonl 404s', async () => {
        vi.stubGlobal('fetch', respond(false));
        const r = await new FileLoader().attemptAutoLoad(RULES, null, null, null, EMBEDDED);
        expect(r.success).toBe(true);
        expect(r.embedded).toBe(true);
        expect(r.logPath).toBe(embeddedSphereLogLabel(RULES));
        expect(r.logData).toEqual(EMBEDDED);
    });

    it('keeps the .jsonl authoritative when it exists', async () => {
        const line = { type: 'state_update', sphere_index: 'file' };
        vi.stubGlobal('fetch', respond(true, JSON.stringify(line)));
        const r = await new FileLoader().attemptAutoLoad(RULES, null, null, null, EMBEDDED);
        expect(r.embedded).toBeUndefined();
        expect(r.logPath).toBe('presets/g/AP_1/AP_1_sphere_log.jsonl');
        expect(r.logData).toEqual([line]);
    });

    it('still reports the 404 when there is no embedded log', async () => {
        vi.stubGlobal('fetch', respond(false));
        for (const none of [null, []]) {
            const r = await new FileLoader().attemptAutoLoad(RULES, null, null, null, none);
            expect(r.success).toBe(false);
            expect(r.error).toContain('404');
        }
    });
});
