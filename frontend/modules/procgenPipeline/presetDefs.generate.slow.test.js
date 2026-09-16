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
 *   - every scenario item id resolves in the item library its substrates
 *     declare (`mergedItemLib`) — a misspelt item was MEASURED (P1, mutant B:
 *     'Rite arrow' in the maze + bounce mix) to be planned into a sphere as a
 *     gate item no substrate knows, with the oracle clean and the world green;
 *   - every scenario OBSTACLE id is one of DEFAULT_OBSTACLES — the only
 *     obstacle library the pipeline hands the engine (no builder passes an
 *     obstacleLib). Measured (P2): 'dor_red' in the grid-growth pool AND a
 *     registry-declared bounce `libraryObstacles` id both generated green with
 *     the obstacle silently dropped (the same world, md5-equal) — so a check
 *     against DEFAULT_OBSTACLES ∪ libraryObstacles would pass a dropped one;
 *   - its served region libraries resolve from `frontend/region-libraries/` on
 *     disk (a missing or invalid file is a thrown sentence naming both), and
 *     each reference's `library_id` is the served pack's CURRENT id — measured
 *     (P2, mutant A): a stale id only WARNS in resolveLibrarySelection and the
 *     world generates against the current file, green;
 *   - a top-down preset realises the committed Adventure world with its
 *     committed sphere log — what a plain page load has loaded, and what the
 *     panel's "Use currently-loaded rules.json / sphere log" (both on by
 *     default) hand it (measured P2 W0: the log changes the world's bytes);
 *   - every substrate the definition names realises at least one region —
 *     measured (P2, mutant B): a top-down preset whose substrate sits in
 *     quotas rather than the mix realises an all-maze world, green;
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
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import {
    SHIPPED_PRESETS, PRESET_HEADLESS_BUDGET_MS, PRESETS_SKIPPED_AS_HEAVY,
} from './presetDefs.js';
import {
    buildRunFromState, runPresetHeadless, presetSubstrateIds, heavySubstrateIds, mergedItemLib,
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

/** The committed world a top-down preset realises here, and its sphere log. */
const TOPDOWN_SOURCE_FILE = 'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const TOPDOWN_SPHERE_LOG_FILE = 'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl';

/** `fetch` over the served tree on disk — the shape resolveLibrarySelection reads. */
async function diskFetch(url) {
    const file = join(FRONTEND, url);
    if (!existsSync(file)) return { ok: false, status: 404 };
    const text = readFileSync(file, 'utf8');
    return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
}

async function resolvedLibrariesOf(preset) {
    const refs = preset.state.libraries ?? [];
    if (refs.length === 0) return { resolved: [], warnings: [] };
    const { resolved, errors, warnings } = await resolveLibrarySelection(refs, { fetchImpl: diskFetch, basePath: '' });
    if (errors.length) {
        throw new Error(`preset ${preset.id} names region libraries that do not resolve from `
            + `frontend/region-libraries/: ${errors.join('; ')}`);
    }
    return { resolved, warnings };
}

function buildCtxOf(preset, resolvedLibraries) {
    if (preset.state.mode !== 'topDown') return { resolvedLibraries };
    return {
        resolvedLibraries,
        topDownSource: JSON.parse(readFileSync(join(ROOT, TOPDOWN_SOURCE_FILE), 'utf8')),
        sphereLog: readFileSync(join(ROOT, TOPDOWN_SPHERE_LOG_FILE), 'utf8')
            .split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line)),
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

            const itemLib = mergedItemLib(preset.state);
            const unknownItems = Object.keys(preset.state.scenario?.items ?? {}).filter((id) => !(id in itemLib));
            expect(unknownItems, `preset ${preset.id} names scenario item(s) no item library of its substrates `
                + 'declares — the sphere planner places such an id as a gate item anyway, and the world stays green').toEqual([]);

            const unknownObstacles = Object.keys(preset.state.scenario?.obstacles ?? {})
                .filter((id) => !(id in DEFAULT_OBSTACLES));
            expect(unknownObstacles, `preset ${preset.id} names scenario obstacle(s) that are not in `
                + 'DEFAULT_OBSTACLES, the only obstacle library the pipeline hands the engine — such an '
                + 'obstacle is dropped silently and the world stays green').toEqual([]);

            const { resolved: resolvedLibraries, warnings } = await resolvedLibrariesOf(preset);
            expect(warnings, `preset ${preset.id} carries a served region library reference whose `
                + 'library_id is not the served pack\'s current one — applying it warns of drift and '
                + 'generates against the current file; set the reference to the id in '
                + `region_library_files.json (${warnings.join('; ')})`).toEqual([]);
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
            const realised = new Set(Object.values(a.rulesJson.preset_sidecars?.['1'] ?? {})
                .map((sidecar) => sidecar?.substrate));
            expect(presetSubstrateIds(preset.state).filter((id) => !realised.has(id)),
                `preset ${preset.id} names substrate(s) that realise no region in its world `
                + `(realised: ${[...realised].join(', ')})`).toEqual([]);
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
