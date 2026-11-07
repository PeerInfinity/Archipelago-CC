/**
 * apworldEditor — P5d (⚖ Robert 2026-11-05: "Recover it, lock as fallback"; "Save it"; "All,
 * measured first"; "(a) Use the fallback"): **A REGENERATE REBUILDS A REGION WITH THE LOGIC
 * IT WAS GENERATED WITH.**
 *
 * The information the document did not carry, now recovered:
 *   - the ENTRY GATE sphere growth hands a zone region (`entrance.requirement`): from its
 *     record (`procgen_metadata[p].sphere_tree`), or, for a slot with no driver, from the
 *     entering exit ∩ what every player inside holds (`regionHeldItems`);
 *   - the generation knobs the request does not spell (`params.knobs`, Cloudberry).
 * The table: every Cloudberry region of the committed Cloudberry worlds regenerates the SAME
 * generator request as its generation (measured at P5d: all 12 of 4 worlds; without the
 * recovery 6 — 4 refused, 2 lose their Double Jump hero). Each pin names the mutant it kills.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { collectPendingGenerations, generateRegion } from '../procgenPipeline/procgenPipelineEngine.js';
import { mergeSubstrateItemLib } from '../procgenPipeline/sphereConfigHooks.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { createRng } from '../shared/rng.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { clearCloudberryLevelCache, installCloudberryGenerator } from '../cloudberryDemo/cloudberryGeneration.js';
import { cloudberryTestGenerator } from '../cloudberryDemo/cloudberryTestGenerator.js';
import { CLOUDBERRY_RECORDED_KNOBS, cloudberryRecordedKnobs } from '../cloudberryDemo/cloudberryProcgenParams.js';
import { composeRegenerateArgs, regionGenerationPlan } from './regionGenerationFlow.js';
import { regenerateAwaitingGeneration } from './regionGenerationRun.js';
import {
    ENTRY_GATE_SOURCES, buildDocumentRegionSpec, recoverEntryGate, regenerateRegionEntry, regionHeldItems,
    withRecoveredEntryGate,
} from './regionRegenerate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const PRESETS = join(ROOT, 'frontend', 'presets');
const readPreset = (dir) => {
    const seed = readdirSync(join(PRESETS, dir)).find((x) => x.startsWith('AP_'));
    return JSON.parse(readFileSync(join(PRESETS, dir, seed, `${seed}_rules.json`), 'utf8'));
};
/** ⛓ Derived: every committed preset whose slot 1 holds a Cloudberry region. */
const WORLDS = readdirSync(PRESETS).filter((d) => !d.endsWith('.json'))
    .map((d) => [d, (() => { try { return readPreset(d); } catch { return null; } })()])
    .filter(([, doc]) => Object.values(doc?.preset_sidecars?.['1'] ?? {}).some((e) => e?.substrate === 'cloudberry'));
const CB = readPreset('cloudberry_sphere_worldgen');
const P = '1';
const strip = ({ rerolls, trace, settings, reroll, ...rest } = {}) => JSON.stringify(rest);

let asked = [];
beforeEach(() => {
    clearCloudberryLevelCache();
    asked = [];
    const base = cloudberryTestGenerator();
    installCloudberryGenerator({ build: base.build, features: base.features,
        async generate(a) { asked.push(a); return base.generate(a); } }, { store: null });
});
afterEach(() => { installCloudberryGenerator(null, { store: null }); clearCloudberryLevelCache(); });

/** The request a region regenerates with: the form's read-back knobs, the RECORDED level seed. */
async function requestOf(doc, region, { recover = true } = {}) {
    const reg = substrateRegistry.get('cloudberry');
    const plan = regionGenerationPlan(doc, P, region, 'cloudberry', { seed: 1 });
    const args = composeRegenerateArgs(doc, P, region, 'cloudberry', plan.recorded ?? plan.defaults);
    const params = { maxIterations: 0, ...args.regionParams };
    const base = buildDocumentRegionSpec(doc, P, region, { substrate: 'cloudberry' });
    const { spec } = recover ? withRecoveredEntryGate(doc, P, region, base, { backGated: reg.backPortalGated(params) })
        : { spec: base };
    const seed = doc.preset_sidecars[P][region].playable_payload.params.generate.seed;
    const run = () => {
        try {
            return { r: generateRegion({ substrate: 'cloudberry', region_id: region, size: spec.size, entrances: spec.entrances,
                exits: spec.exitSpecs, locations: spec.locationSpecs, itemLib: mergeSubstrateItemLib(DEFAULT_ITEMS, ['cloudberry']),
                obstacleLib: DEFAULT_OBSTACLES, rng: createRng(1), seed, params, freeItems: [] }) };
        } catch (e) { return { e: String(e.message) }; }
    };
    clearCloudberryLevelCache();   // two worlds share a request (the same level): each region asks its own
    asked = [];
    const first = collectPendingGenerations(run);
    await Promise.all(first.pending);
    const out = first.pending.length ? run() : first.value;
    return out.e ? { refused: out.e } : { request: asked[0] };
}

describe('the reproduce table — every committed Cloudberry region regenerates the request it was generated with', () => {
    const regions = WORLDS.flatMap(([d, doc]) => Object.entries(doc.preset_sidecars[P])
        .filter(([, e]) => e.substrate === 'cloudberry').map(([r]) => [d, doc, r]));

    it('⛓ premise: the committed Cloudberry worlds and their regions are found (derived, not listed)', () => {
        expect(WORLDS.length).toBeGreaterThan(0);
        expect(regions.length).toBeGreaterThan(WORLDS.length);
    });

    it('⛓⛓ with the recovery: every region\'s request is the stored one', async () => {
        const rows = [];
        for (const [d, doc, region] of regions) {
            // eslint-disable-next-line no-await-in-loop
            const got = await requestOf(doc, region);
            rows.push(`${d} ${region}: ${got.refused ? `REFUSED ${got.refused.slice(0, 80)}`
                : strip(got.request) === strip(doc.preset_sidecars[P][region].playable_payload.params.generate) ? 'SAME'
                    : `DIFFERS got ${strip(got.request)} want ${strip(doc.preset_sidecars[P][region].playable_payload.params.generate)}`}`);
        }
        // mutant: no recovery (P5c's spec) → 4 refused + 2 without the Double hero; no knobs → the sphere start differs
        expect(rows.filter((r) => !r.endsWith('SAME')), rows.join('\n')).toEqual([]);
    });

    it('⛓ the control: without the recovery the same table is NOT whole (the defect, measured)', async () => {
        let same = 0;
        for (const [, doc, region] of regions) {
            // eslint-disable-next-line no-await-in-loop
            const got = await requestOf(doc, region, { recover: false });
            if (got.request && strip(got.request) === strip(doc.preset_sidecars[P][region].playable_payload.params.generate)) same += 1;
        }
        expect(same).toBeLessThan(regions.length);
    });
});

describe('recoverEntryGate — only where the original generator handed one', () => {
    it('⛓ a sphere-growth slot: the sphere_tree record, by cell', () => {
        const parent = buildDocumentRegionSpec(CB, P, 'region_3_2', { substrate: 'cloudberry' }).parent;
        expect(recoverEntryGate(CB, P, 'region_3_2', parent)).toEqual({
            requirement: ['Clouds'], counts: {}, source: ENTRY_GATE_SOURCES.SPHERE_TREE, dropped: [] });
        expect(recoverEntryGate(CB, P, 'region_2_2', null)).toBeNull();
    });

    it('⛓ any other recorded driver (top-down, initialise, spiral, grid): none — its realiser had none', () => {
        const doc = JSON.parse(JSON.stringify(CB));
        doc.procgen_metadata[P].driver = 'top-down-sphere';
        const parent = buildDocumentRegionSpec(doc, P, 'region_3_2', { substrate: 'cloudberry' }).parent;
        // mutant: drop the driver test → the attributed tree of a top-down-sphere world is handed to its regenerate
        expect(recoverEntryGate(doc, P, 'region_3_2', parent)).toBeNull();
    });

    it('⛓ no driver (origin unknown): the entering exit ∩ held; an item a player could lack is dropped', () => {
        const doc = JSON.parse(JSON.stringify(CB));
        delete doc.procgen_metadata;
        const parent = buildDocumentRegionSpec(doc, P, 'region_3_2', { substrate: 'cloudberry' }).parent;
        expect(recoverEntryGate(doc, P, 'region_3_2', parent)).toMatchObject({
            requirement: ['Clouds'], source: ENTRY_GATE_SOURCES.ENTERING_EXIT, dropped: [] });
        // a second way in that does not need Clouds: Clouds is no longer held by every player inside
        doc.regions[P].region_2_2.exits.push({ name: 'side_door', connected_region: 'region_3_2', access_rule: { rule: 'True_' } });
        // mutant: no ∩ held → the gate keeps Clouds, and a player through the side door would be assumed to hold it
        expect(regionHeldItems(doc, P, 'region_3_2', ['Clouds'])).toEqual([]);
        expect(recoverEntryGate(doc, P, 'region_3_2', parent)).toMatchObject({ requirement: [], dropped: ['Clouds'] });
    });
});

describe('withRecoveredEntryGate — the back exit realised as sphere growth realises it', () => {
    const backOf = (spec) => spec.exitSpecs.find((x) => x.tile && x.target_region === spec.parent.name);

    it('⛓ ungated (cloudberry): the way back is free when its items are held; the document\'s rule is kept', () => {
        const base = buildDocumentRegionSpec(CB, P, 'region_3_2', { substrate: 'cloudberry' });
        const { spec, gate } = withRecoveredEntryGate(CB, P, 'region_3_2', base, { backGated: false });
        expect(gate.requirement).toEqual(['Clouds']);
        expect(spec.entrances[0]).toMatchObject({ requirement: ['Clouds'] });
        // mutant: leave the back exit as the document's rule → the plan sees Clouds on the way back (the B lock)
        expect(backOf(spec)).toMatchObject({ requirement: [], counts: {} });
        expect(backOf(spec).access_rule).toEqual(backOf(base).access_rule);
    });

    it('⛓ ungated, not held: the document\'s rule stays (the realiser\'s fallback — cloudberry locks its start door)', () => {
        const doc = JSON.parse(JSON.stringify(CB));
        delete doc.procgen_metadata;
        doc.regions[P].region_2_2.exits.push({ name: 'side_door', connected_region: 'region_3_2', access_rule: { rule: 'True_' } });
        const base = buildDocumentRegionSpec(doc, P, 'region_3_2', { substrate: 'cloudberry' });
        // mutant: free it regardless of held → a player through the side door walks back without Clouds
        expect(backOf(withRecoveredEntryGate(doc, P, 'region_3_2', base, { backGated: false }).spec)).toEqual(backOf(base));
    });

    it('⛓ gated: the entry gate from sphere growth\'s record; a gate from the entering exit leaves the rule (directional)', () => {
        const base = buildDocumentRegionSpec(CB, P, 'region_3_2', { substrate: 'cloudberry' });
        expect(backOf(withRecoveredEntryGate(CB, P, 'region_3_2', base, { backGated: true }).spec).requirement).toEqual(['Clouds']);
        const doc = JSON.parse(JSON.stringify(CB));
        delete doc.procgen_metadata;
        // mutant: drop the source test → the entering-exit gate replaces a gated way back (bounce: Right arrow for a west way back)
        expect(backOf(withRecoveredEntryGate(doc, P, 'region_3_2', base, { backGated: true }).spec)).toEqual(backOf(base));
    });

    it('⛓ a PROCEDURAL target (zone false) is never handed one: the spec as it was', () => {
        const base = buildDocumentRegionSpec(CB, P, 'region_3_2', { substrate: 'cloudberry' });
        const out = withRecoveredEntryGate(CB, P, 'region_3_2', base, { zone: false });
        expect(out.spec).toBe(base);
        expect(out.gate).toBeNull();
    });

    it('⛓⛓ the op: region_3_2 regenerates (it was refused), its start door free, and it says which gate it used', async () => {
        const res = await regenerateAwaitingGeneration(() => regenerateRegionEntry({
            doc: CB, player: P, region: 'region_3_2', substrate: 'cloudberry', seed: 7,
        }), { collect: collectPendingGenerations });
        expect(res.ok, res.threw).toBe(true);
        expect(res.entryGate).toMatchObject({ requirement: ['Clouds'], source: ENTRY_GATE_SOURCES.SPHERE_TREE });
        expect(res.entry.playable_payload.gate_rules?.portals?.west).toBeUndefined();
    });
});

describe('the knobs a Cloudberry payload records beside its request', () => {
    it('⛓ derived: every knob the request does not spell, not the hero variation', () => {
        expect(CLOUDBERRY_RECORDED_KNOBS).toContain('cloudberryChecksPerPiece');
        expect(CLOUDBERRY_RECORDED_KNOBS).not.toContain('cloudberryHeroVariation');
        expect(CLOUDBERRY_RECORDED_KNOBS).not.toContain('cloudberryTileset');
        // only non-default values: a default world's payload bytes stay
        expect(cloudberryRecordedKnobs({})).toEqual({});
        expect(cloudberryRecordedKnobs({ cloudberryChecksPerPiece: 2, cloudberryMinPieces: 2 })).toEqual({ cloudberryChecksPerPiece: 2 });
    });

    it('⛓ the committed sphere world records checks-per-piece 2, and the form reads it back', () => {
        const e = CB.preset_sidecars[P].region_2_2;
        expect(e.playable_payload.params.knobs).toEqual({ cloudberryChecksPerPiece: 2 });
        // mutant: the read-back ignores params.knobs → the start region regenerates with 3 pieces, not 2
        const plan = regionGenerationPlan(CB, P, 'region_2_2', 'cloudberry', { seed: 1 });
        expect((plan.recorded ?? plan.defaults).cloudberryChecksPerPiece).toBe(2);
    });
});
