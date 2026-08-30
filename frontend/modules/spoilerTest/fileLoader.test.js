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

import { describe, expect, it } from 'vitest';

import { deriveSphereLogPath } from './fileLoader.js';

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
