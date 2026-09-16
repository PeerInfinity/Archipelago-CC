/**
 * EVERY shipped preset generates — headless, twice, byte-identically, inside the
 * 30 s budget.
 *
 * ⛓ PROCGEN PIPELINE PRESETS P0. Before this row nothing asserted that a
 * preset in the Procgen Pipeline panel's drop-down still generates:
 * `presetDefs.test.js` pins SHAPE, and the browser gate (`check-procgen-presets`)
 * is box-only and drove some of the list by hand. This row iterates
 * `SHIPPED_PRESETS` — a new preset ENROLS by being in the list — and generates
 * each through `presetRun.js`, the SAME assembly the panel's Generate calls
 * (`buildRunFromState` → `runPresetHeadless`), with the panel's whole registry
 * loaded (`REGISTRY_LIBRARIES`; a partial registry drops quota entries the
 * panel keeps).
 *
 * Per preset:
 *   - every substrate id the DEFINITION names is registered — applyPresetState
 *     drops an unregistered one silently, and a sphere preset whose only quota
 *     is unregistered was MEASURED to generate a 4-region maze world, which
 *     would pass every other assertion here;
 *   - its served region libraries resolve from `frontend/region-libraries/` on
 *     disk (a missing or invalid file is a thrown sentence naming both);
 *   - a top-down preset realises the committed Adventure world
 *     (the panel's top-down source is whatever world is loaded; this is the
 *     fixture the plan names for it);
 *   - two runs: no throw, a world holding more than the Menu region, the two
 *     `rulesJson` byte-identical (JSON.stringify — no "modulo": the pipeline
 *     writes no wall clock since P0 task 2), each run ≤ PRESET_HEADLESS_BUDGET_MS,
 *     and sphere growth's plan-vs-world oracle clean.
 *
 * ⛔ A preset naming a substrate whose registry entry declares
 * `generationCost: 'heavy'` is NOT generated here (⚖ user 2026-09-16: "Skip
 * runner presets in CI, by a declared field"): the skip prints a sentence naming
 * the preset and the field, and the skipped set — DERIVED from the registry — must
 * equal the `PRESETS_SKIPPED_AS_HEAVY` allowlist, so it cannot grow silently.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    SHIPPED_PRESETS, PRESET_HEADLESS_BUDGET_MS, PRESETS_SKIPPED_AS_HEAVY,
} from './presetDefs.js';
import {
    buildRunFromState, runPresetHeadless, presetSubstrateIds, heavySubstrateIds,
} from './presetRun.js';
import { resolveLibrarySelection } from './regionLibraryLoader.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FRONTEND = join(ROOT, 'frontend');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

/**
 * Room above the two budgeted runs for the libraries and the registry. ⛔ NOT a
 * multiple of the budget: vitest's timeout must not fire before the budget
 * assertion can, or a budget too small to hold reads as a timeout.
 */
const TIMEOUT_SLACK_MS = 60_000;

/** The committed world a top-down preset realises here. */
const TOPDOWN_SOURCE_FILE = 'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json';

/** `fetch` over the served tree on disk — the shape resolveLibrarySelection reads. */
async function diskFetch(url) {
    const file = join(FRONTEND, url);
    if (!existsSync(file)) return { ok: false, status: 404 };
    const text = readFileSync(file, 'utf8');
    return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
}

async function resolvedLibrariesOf(preset) {
    const refs = preset.state.libraries ?? [];
    if (refs.length === 0) return [];
    const { resolved, errors } = await resolveLibrarySelection(refs, { fetchImpl: diskFetch, basePath: '' });
    if (errors.length) {
        throw new Error(`preset ${preset.id} names region libraries that do not resolve from `
            + `frontend/region-libraries/: ${errors.join('; ')}`);
    }
    return resolved;
}

function buildCtxOf(preset, resolvedLibraries) {
    if (preset.state.mode !== 'topDown') return { resolvedLibraries };
    return {
        resolvedLibraries,
        topDownSource: JSON.parse(readFileSync(join(ROOT, TOPDOWN_SOURCE_FILE), 'utf8')),
    };
}

const skipped = [];

describe('every shipped preset generates headless', () => {
    for (const preset of SHIPPED_PRESETS) {
        const heavy = heavySubstrateIds(preset.state);
        if (heavy.length > 0) {
            skipped.push(preset.id);
            it(`${preset.id} is not generated here: it names ${heavy.join(', ')}, declared generationCost 'heavy'`, () => {
                console.log(`SKIPPED ${preset.id}: its substrate${heavy.length > 1 ? 's' : ''} `
                    + `${heavy.join(', ')} declare${heavy.length > 1 ? '' : 's'} generationCost 'heavy' on the `
                    + 'registry entry, so this preset is generated by hand and by the box browser gate, not in CI.');
            });
            continue;
        }
        it(`${preset.id} generates twice, byte-identically, within the headless budget`, async () => {
            const unregistered = presetSubstrateIds(preset.state).filter((id) => !substrateRegistry.has(id));
            expect(unregistered, `preset ${preset.id} names substrate id(s) no registry entry declares `
                + `— applyPresetState would drop them and the world would generate without them`).toEqual([]);

            const resolvedLibraries = await resolvedLibrariesOf(preset);
            const runs = [];
            for (let i = 0; i < 2; i += 1) {
                // A fresh run per Generate, as the panel builds one per click.
                const built = buildRunFromState(preset.state, buildCtxOf(preset, resolvedLibraries));
                // eslint-disable-next-line no-await-in-loop
                runs.push({ mode: built.mode, ...(await runPresetHeadless(built)) });
            }
            const [a, b] = runs;
            const regions = Object.keys(a.rulesJson.regions['1']);
            console.log(`${preset.id} · ${a.mode} · ${regions.length} regions · ${a.ms} ms / ${b.ms} ms`);

            expect(regions.filter((r) => r !== 'Menu').length).toBeGreaterThan(0);
            expect(JSON.stringify(b.rulesJson)).toBe(JSON.stringify(a.rulesJson));
            for (const r of runs) {
                expect(r.ms, `${preset.id} took ${r.ms} ms, over PRESET_HEADLESS_BUDGET_MS`)
                    .toBeLessThanOrEqual(PRESET_HEADLESS_BUDGET_MS);
                if (r.oracleErrors) expect(r.oracleErrors).toEqual([]);
            }
        }, 2 * PRESET_HEADLESS_BUDGET_MS + TIMEOUT_SLACK_MS);
    }

    it('the presets skipped as heavy are exactly the PRESETS_SKIPPED_AS_HEAVY allowlist', () => {
        expect(skipped).toEqual([...PRESETS_SKIPPED_AS_HEAVY]);
    });
});
