// frontend/modules/presets/rulesJsonWriters.test.js
/**
 * EDITOR v3 slice E1c — **THE TWO BYPASSERS ADOPT THE SHARED WRITER, AND THE
 * BYTES DO NOT MOVE.**
 *
 * `apcalcGeneratorUI` and `tileMapAnalyzerUI` each wrote their rules.json with
 * a bare `JSON.stringify(rules, null, 2)`. That is a SECOND rules.json writer:
 * it has no tile-array splice and no `indent` knob, so a document downloaded
 * from either panel was formatted by a rule nothing else in the repo followed.
 *
 * ⛔ **ADOPTION IS ONLY SAFE IF IT IS BYTE-IDENTICAL AT THE DEFAULT**, so that
 * is what is PINNED here — over documents these panels actually produce and over
 * the whole committed corpus, not over a shape invented for the row.
 *
 * ⚠ **AND THE ROW IS NOT VACUOUS**: the corpus contains documents WITH
 * `preset_sidecars[…].playable_payload.tiles`, and for those the two writers
 * DISAGREE by design. The row asserts both halves, so a `stringifyRulesJson`
 * that quietly became `JSON.stringify` would go red.
 *
 * ⚠ **WHAT THIS ROW CANNOT DO**: `tileMapAnalyzer`'s own inputs
 * (`*_tilemap.json` / `*_tiles.json`) are GITIGNORED by design
 * (`tileMapDataManager.js`), so no committed document is one this panel
 * produced. Its adoption is pinned by the general claim over 259 real
 * documents plus the fact that `rulesExporter.js` builds no `preset_sidecars`
 * at all — named here rather than left as an unstated assumption.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { generate, exportRulesJson } from '../apcalcGenerator/apcalcGeneratorEngine.js';
import {
    DEFAULT_RULES_JSON_INDENT, RULES_JSON_SETTINGS_SCHEMA, RULES_SCHEMA_VERSION,
} from './documentBundle.js';
import { stringifyRulesJson } from '../shared/rulesJsonBuilder.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const PRESETS_DIR = join(REPO, 'frontend/presets');

function everyCommittedRulesPath(dir = PRESETS_DIR, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) everyCommittedRulesPath(full, out);
        else if (entry.name.endsWith('_rules.json')) out.push(full);
    }
    return out;
}

const hasSidecarTiles = (doc) => Object.values(doc?.preset_sidecars ?? {})
    .some((regionMap) => Object.values(regionMap ?? {})
        .some((sidecar) => Array.isArray(sidecar?.playable_payload?.tiles)));

describe('the shared writer at the default indent', () => {
    it('is the DEFAULT the schema declares', () => {
        expect(DEFAULT_RULES_JSON_INDENT)
            .toBe(RULES_JSON_SETTINGS_SCHEMA.properties.indent.default);
        expect(DEFAULT_RULES_JSON_INDENT).toBe(2);
    });

    it('is byte-identical to JSON.stringify(…, null, 2) on a REAL apcalc document', async () => {
        const gameData = await generate({
            seed: 1,
            numSpheres: 3,
            opsPerSphere: 2,
            numsPerSphere: 2,
            trashPerSphere: 1,
            maxBranches: 2,
            reuseAttempts: 0,
        }, () => {});
        const rules = exportRulesJson(gameData);
        expect(rules.schema_version).toBe(RULES_SCHEMA_VERSION);
        expect(stringifyRulesJson(rules, { indent: DEFAULT_RULES_JSON_INDENT }))
            .toBe(JSON.stringify(rules, null, 2));
    });

    it('is byte-identical on every committed document WITHOUT sidecar tiles', () => {
        const paths = everyCommittedRulesPath();
        let plain = 0;
        let spliced = 0;
        const moved = [];
        for (const p of paths) {
            const doc = JSON.parse(readFileSync(p, 'utf8'));
            const shared = stringifyRulesJson(doc, { indent: DEFAULT_RULES_JSON_INDENT });
            const bare = JSON.stringify(doc, null, 2);
            if (hasSidecarTiles(doc)) {
                spliced += 1;
                // ⚠ NON-VACUITY: for these the two writers MUST disagree.
                if (shared === bare) moved.push(`${p} (splice did nothing)`);
            } else {
                plain += 1;
                if (shared !== bare) moved.push(`${p} (bytes moved)`);
            }
        }
        expect(moved).toEqual([]);
        expect(plain).toBeGreaterThan(0);
        expect(spliced).toBeGreaterThan(0);
    });

    it('MINIFIES at indent 0 — same object, under half the bytes', () => {
        const doc = JSON.parse(readFileSync(
            join(PRESETS_DIR, 'seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
        const two = stringifyRulesJson(doc, { indent: 2 });
        const zero = stringifyRulesJson(doc, { indent: 0 });
        expect(zero).not.toContain('\n');
        expect(JSON.stringify(JSON.parse(zero))).toBe(JSON.stringify(JSON.parse(two)));
        expect(zero.length / two.length).toBeLessThan(0.5);
    });
});
