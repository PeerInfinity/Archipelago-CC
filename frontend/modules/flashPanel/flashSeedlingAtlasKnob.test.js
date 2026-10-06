/**
 * ⛓⛓ SEEDLING SWIM S2 D1 — **THE ATLAS INSTALL KNOB** (`seedlingAtlasId`,
 * `flashSeedlingLibrary.js`). A bag key names an atlas by its served `atlas_id`;
 * absent = the starter. These rows drive the knob the way the panel does — the
 * picker writes the bag, `presetRun.buildRunFromState` builds the run, the
 * headless runner builds the world — and read the atlas off the WORLD
 * (`region_atlas.atlas_id`, every placed room's `atlas_ref`), so a knob that is
 * recorded but never reaches the install goes red here (mutant (a)).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, afterEach, beforeAll } from 'vitest';

import {
    substrateRegistryEntry as entry,
    FLASH_SEEDLING_SUBSTRATE_ID,
    SEEDLING_STARTER_ATLAS,
    SEEDLING_PLAYTHROUGH_ATLAS,
    SEEDLING_INSTALLABLE_ATLASES,
    SEEDLING_ATLAS_ID_KEY,
    buildSeedlingAtlasRegionParams,
    seedlingAtlasDocById,
    renderSeedlingAtlasProcgenParams,
} from './flashSeedlingLibrary.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(ROOT + rel, 'utf8'));
const INDEX = readJson('frontend/modules/flashPanel/atlases/atlas_files.json');

let buildRunFromState;
let runPresetHeadless;
beforeAll(async () => {
    const { REGISTRY_LIBRARIES } = await import('../../../scripts/procgen/reference/registry.mjs');
    for (const rel of REGISTRY_LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await import(ROOT + rel);
    }
    ({ buildRunFromState, runPresetHeadless } = await import('../procgenPipeline/presetRun.js'));
});
afterEach(() => { entry.prepareSphereGrowth({}); entry.applyPipelineConfig({}); });

const STATES = Object.freeze({
    sphereGrowth: { seed: 1, startSubstrate: 'maze', sphereCount: 2, fillerCount: 0, maxItemsPerRegion: 1 },
    shuffledSpiral: { seed: 1, regionWidth: 8, regionHeight: 6 },
});
async function worldOf(mode, params) {
    const state = {
        mode, params: { ...STATES[mode], ...params },
        scenario: { items: { key_blue: 1, victory: 1 }, obstacles: {} },
        substrateQuotas: { maze: 2, [FLASH_SEEDLING_SUBSTRATE_ID]: 1 }, substrateMix: {}, substrateMode: 'quotas',
    };
    const { rulesJson } = await runPresetHeadless(buildRunFromState(structuredClone(state)));
    const refs = Object.values(rulesJson.preset_sidecars['1'])
        .filter((s) => s.substrate === FLASH_SEEDLING_SUBSTRATE_ID)
        .map((s) => s.playable_payload.atlas_ref);
    return { atlasId: rulesJson.region_atlas?.['1']?.atlas_id, refs };
}

/** The picker's DOM, just enough of it: `select`/`option`/`div`/`label` with their events. */
function withFakeDocument(fn) {
    const el = (tag) => ({
        tag, children: [], dataset: {}, listeners: {}, value: '', textContent: '',
        appendChild(c) { this.children.push(c); return c; },
        addEventListener(type, f) { this.listeners[type] = f; },
    });
    const prior = globalThis.document;
    globalThis.document = { createElement: el };
    try { return fn(); } finally { globalThis.document = prior; }
}
const findSelect = (node) => (node.tag === 'select' ? node : node.children.map(findSelect).find(Boolean) ?? null);

describe('flash_seedling — the atlas install knob (S2 D1)', () => {
    it('the installable atlases are the bundled starter and playthrough, each served under its own id', () => {
        expect(SEEDLING_INSTALLABLE_ATLASES.map((a) => a.atlas_id))
            .toEqual([SEEDLING_STARTER_ATLAS.atlas_id, SEEDLING_PLAYTHROUGH_ATLAS.atlas_id]);
        for (const atlas of SEEDLING_INSTALLABLE_ATLASES) {
            const row = INDEX.atlases.find((a) => a.atlas_id === atlas.atlas_id);
            expect(row, `atlas_files.json lists ${atlas.atlas_id}`).toBeTruthy();
            expect(readJson(`frontend/modules/flashPanel/atlases/${row.file}`)).toEqual(atlas);
        }
    });

    it('an id outside them is refused by name, never swapped for the starter', () => {
        expect(() => seedlingAtlasDocById('seedling-00000000'))
            .toThrow(/seedlingAtlasId "seedling-00000000" names no installable atlas/);
        expect(() => entry.applyPipelineConfig({ atlasId: 'seedling-00000000' })).toThrow(/names no installable/);
        expect(() => entry.applyPipelineConfig({ atlasDoc: SEEDLING_STARTER_ATLAS,
            atlasId: SEEDLING_PLAYTHROUGH_ATLAS.atlas_id })).toThrow(/one config installs one atlas/);
    });

    it('absent, the bag builds the regionParams and the spiral config it always built', () => {
        expect(buildSeedlingAtlasRegionParams({ params: {} })).toEqual({ seedlingAtlas: { hostChildren: true } });
        expect(entry.pipelineConfigFromParams({ params: {} })).toBe(null);
        expect(entry.pipelineConfigFromParams({ params: { [SEEDLING_ATLAS_ID_KEY]: SEEDLING_STARTER_ATLAS.atlas_id } }))
            .toBe(null);
        expect(entry.pipelineConfigFromParams({ params: { [SEEDLING_ATLAS_ID_KEY]: SEEDLING_PLAYTHROUGH_ATLAS.atlas_id } }))
            .toEqual({ atlasId: SEEDLING_PLAYTHROUGH_ATLAS.atlas_id });
    });

    it.each(Object.keys(STATES))('%s: no knob → the starter; the picker set to the playthrough → every placed room '
        + 'is a playthrough room (mutant (a): the knob recorded but never installed)', async (mode) => {
        const plain = await worldOf(mode, {});
        expect(plain.atlasId).toBe(SEEDLING_STARTER_ATLAS.atlas_id);
        expect(plain.refs.length).toBeGreaterThan(0);
        expect(new Set(plain.refs)).toEqual(new Set([SEEDLING_STARTER_ATLAS.atlas_id]));

        const bag = {};
        const node = withFakeDocument(() => renderSeedlingAtlasProcgenParams({ params: bag }));
        const select = findSelect(node);
        expect(select.children.map((o) => o.value)).toEqual(SEEDLING_INSTALLABLE_ATLASES.map((a) => a.atlas_id));
        expect(select.value).toBe(SEEDLING_STARTER_ATLAS.atlas_id);
        select.value = SEEDLING_PLAYTHROUGH_ATLAS.atlas_id;
        select.listeners.change();
        expect(bag).toEqual({ [SEEDLING_ATLAS_ID_KEY]: SEEDLING_PLAYTHROUGH_ATLAS.atlas_id });

        const picked = await worldOf(mode, bag);
        expect(picked.atlasId).toBe(SEEDLING_PLAYTHROUGH_ATLAS.atlas_id);
        expect(picked.refs.length).toBeGreaterThan(0);
        expect(new Set(picked.refs)).toEqual(new Set([SEEDLING_PLAYTHROUGH_ATLAS.atlas_id]));
    });

    it('sphere growth installs the named atlas in prepareSphereGrowth — BEFORE any room is realised, where the '
        + 'tree\'s gate veto (`canHostExitGates`) reads it', () => {
        entry.prepareSphereGrowth({ params: { [SEEDLING_ATLAS_ID_KEY]: SEEDLING_PLAYTHROUGH_ATLAS.atlas_id } });
        expect(entry.rulesJsonBlocks().region_atlas.atlas_id).toBe(SEEDLING_PLAYTHROUGH_ATLAS.atlas_id);
        // ⛓ RULES (B): 168 -> 169 — `level_71__r14c12` gains its first door, the pit into L82.
        // ⛓ RULES logical-links: 169 -> 168 — `level_0__r1c6` loses its only doors: the L2 stairs and the
        //   L110 pit arrival bind to r8c0, the component the physics model's flood reaches from them.
        // ⛓ RULES burnable-trees: 168 -> 171 — the sub-regions split off along the trees that hold doors:
        //   L12 r42c29, L37 r12c6, L44 r6c4 (L40's r48c54 holds none).
        // ⛓ RULES re-closing locks: 171 -> 175 — the levels split at a button-only lock add zones with doors
        //   (L15's L16 arrival column, L16's L18-side pocket, L39's L40-side pocket and one more).
        // ⛓ RULES game-truth-gaps: 175 -> 178 — L57 is lifted from never-enter (⚖ 2026-10-06): `level_57` itself, and
        //   L58's two sub-regions whose doors back into L57 are now wired (r4c1, r6c5).
        expect(entry.zoneCount).toBe(178);
        entry.prepareSphereGrowth({ params: {} });
        expect(entry.rulesJsonBlocks().region_atlas.atlas_id).toBe(SEEDLING_STARTER_ATLAS.atlas_id);
    });

    it('a zone realised from regionParams naming the playthrough installs it (the top-down / initialise path)', () => {
        const specs = entry.buildZoneSpecs({ region_id: 'r', exitSpecs: [{ side: 'north' }], locationSpecs: [] },
            buildSeedlingAtlasRegionParams({ params: { [SEEDLING_ATLAS_ID_KEY]: SEEDLING_PLAYTHROUGH_ATLAS.atlas_id } }));
        expect(specs.atlasId).toBe(SEEDLING_PLAYTHROUGH_ATLAS.atlas_id);
        const zone = entry.generateZoneForSpecs(specs);
        expect(zone.payload.atlas_ref).toBe(SEEDLING_PLAYTHROUGH_ATLAS.atlas_id);
        expect(entry.rulesJsonBlocks().region_atlas.atlas_id).toBe(SEEDLING_PLAYTHROUGH_ATLAS.atlas_id);
    });
});
