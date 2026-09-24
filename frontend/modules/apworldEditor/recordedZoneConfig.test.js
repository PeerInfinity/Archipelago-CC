/**
 * apworldEditor — **THE ZONE READ-BACK PREFERS WHAT THE DOCUMENT RECORDS**
 * (APWORLD SUBSTRATE CHANGE R6b). The compile writes
 * `procgen_metadata.substrate_configs[id]` (`procgenCore/substrateConfigRecord.js`);
 * the hub hands it to the target's `zoneConfigFromSlot` as `recorded`, and jta
 * takes a recorded field over both its own read-back and its assumption — still
 * VERIFIED by re-extracting every committed zone.
 *
 * ⛓ Two kinds of document: the committed jta fixtures (which record nothing —
 * their outcome is pinned unchanged) and the same documents with the record the
 * fixture generator now writes (its `--out` regeneration differs from each
 * committed file ONLY by that block, plan §17), plus a world built end-to-end
 * through the pipeline under a non-default config and read back.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { DEFAULT_ITEMS } from '../shared/procgen/library.js';
import { arrangeShuffledSpiral, buildRulesJson } from '../procgenPipeline/procgenPipelineEngine.js';
import { mergeSubstrateItemLib } from '../procgenPipeline/sphereConfigHooks.js';
import { RECORDABLE_CONFIG_HOOK, SUBSTRATE_CONFIGS_KEY } from '../procgenCore/substrateConfigRecord.js';
import { regenerationProvenance } from './regionGenerationFlow.js';
import { REGION_SOURCE_KINDS } from './regionRegenerate.js';
import {
    REPLACE_REGION_CONTENT_OP, ZONE_NOT_RECORDED, installedZoneConfigFrom, replaceRegionContentFromZone,
    zoneConfigSplitSentence, zoneContentFor, zoneJobAnswer, zoneOfRegion, zoneSourceFacts, zoneSourceRefusal,
} from './regionContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const JTA = 'jta';
const jta = substrateRegistry.get(JTA);
const clone = (o) => JSON.parse(JSON.stringify(o));
const SEED_DIR = 'AP_14089154938208861744';
const load = (game) => JSON.parse(readFileSync(
    join(ROOT, 'frontend', 'presets', game, SEED_DIR, `${SEED_DIR}_rules.json`), 'utf8'));
/** ⛓ The five fixtures `generate-jta-locations-test-preset.mjs` writes. */
const FIXTURES = ['jta_locations_test', 'jta_randomized_test', 'jta_prestige_test', 'jta_dataset_test', 'jta_schedule_test'];
/** ⛓ The record each carries once regenerated (the generator's own config, §17's diff). */
const RECORD = (goalZone, perkShuffleSeed) => ({
    emitZoneLocations: true, goalZone, freeZones: 1, startingPerks: 0, perkShuffleSeed,
});
const withRecord = (doc, rec) => {
    const out = clone(doc);
    out.procgen_metadata = { ...(out.procgen_metadata ?? {}), [SUBSTRATE_CONFIGS_KEY]: { [JTA]: rec } };
    return out;
};
const slotOf = (doc) => Object.keys(doc.preset_sidecars)[0];
const jtaRegions = (doc, p) => Object.entries(doc.preset_sidecars[p]).filter(([, e]) => e.substrate === JTA).map(([r]) => r);
/** ⛓ The first zone no region of the slot plays. */
const freeZone = (doc, p) => {
    const held = new Set(jtaRegions(doc, p).map((r) => zoneOfRegion(doc, p, r)));
    return [...Array(installedZoneConfigFrom(doc, p, JTA).zoneCount).keys()].find((z) => !held.has(z));
};
const otherLabel = () => substrateRegistry.getAll().find((e) => !zoneSourceFacts(e).offers).id;

afterAll(() => jta.applyPipelineConfig({}));

describe('⛓⛓ the committed fixtures record nothing — their read-back and outcome are unchanged', () => {
    it.each(FIXTURES.map((g) => [g]))('%s: recorded = [], assumed = the three unread fields', (g) => {
        const doc = load(g);
        expect(Object.hasOwn(doc, 'procgen_metadata')).toBe(false);
        const rec = installedZoneConfigFrom(doc, slotOf(doc), JTA);
        expect(rec.ok).toBe(true);
        expect(rec.recorded).toEqual([]);
        expect(rec.assumed).toEqual({ perkShuffleSeed: null, freeZones: 1, startingPerks: 0 });
    });

    it('jta_randomized_test is still REFUSED without its record, naming the assumed shuffle seed', () => {
        const doc = load('jta_randomized_test');
        const p = slotOf(doc);
        const got = zoneContentFor(doc, p, jtaRegions(doc, p)[0], JTA, freeZone(doc, p));
        expect(got.ok).toBe(false);
        expect(got.why).toContain(ZONE_NOT_RECORDED);
        expect(got.why).toContain('`perkShuffleSeed` (assumed null)');
        expect(got.why).not.toContain('The document records');
    });
});

describe('⛓⛓ a RECORDED config is preferred over the assumption — and still verified', () => {
    it('jta_randomized_test WITH its record (perkShuffleSeed 1) verifies every region and extracts a free zone', () => {
        const doc = withRecord(load('jta_randomized_test'), RECORD(3, 1));
        const p = slotOf(doc);
        const rec = installedZoneConfigFrom(doc, p, JTA);
        expect(rec.recorded).toEqual(['emitZoneLocations', 'goalZone', 'freeZones', 'startingPerks', 'perkShuffleSeed']);
        expect(rec.assumed).toEqual({});
        expect(rec.cfg.perkShuffleSeed).toBe(1);
        const region = jtaRegions(doc, p)[0];
        const got = zoneContentFor(doc, p, region, JTA, freeZone(doc, p));
        expect(got.ok, got.why).toBe(true);
        expect(got.verified).toEqual(jtaRegions(doc, p));
        expect(got.config).toEqual({ recorded: rec.recorded, assumed: [] });
    });

    it.each(FIXTURES.map((g) => [g]))('%s with the generator\'s record: every region verifies (the regenerated '
        + 'fixture\'s outcome)', (g) => {
        const doc0 = load(g);
        const quota = jtaRegions(doc0, slotOf(doc0)).length;
        const doc = withRecord(doc0, RECORD(quota - 1, g === 'jta_randomized_test' ? 1 : null));
        const p = slotOf(doc);
        const region = jtaRegions(doc, p)[0];
        // ⛓ a slot whose every zone is held (the 3-zone dataset worlds) re-takes the region's own
        const got = zoneContentFor(doc, p, region, JTA, freeZone(doc, p) ?? zoneOfRegion(doc, p, region));
        expect(got.ok, got.why).toBe(true);
        expect(got.verified).toEqual(jtaRegions(doc, p));
        expect(got.config.assumed).toEqual([]);
    });

    it('⛔ a WRONG record (perkShuffleSeed 2) is refused by the verification, and the sentence names what was recorded',
        () => {
            const doc = withRecord(load('jta_randomized_test'), RECORD(3, 2));
            const p = slotOf(doc);
            const got = zoneContentFor(doc, p, jtaRegions(doc, p)[0], JTA, freeZone(doc, p));
            expect(got.ok).toBe(false);
            expect(got.why).toContain(ZONE_NOT_RECORDED);
            expect(got.why).toContain('The document records');
            expect(got.why).toContain('`perkShuffleSeed` (2)');
            expect(got.why).not.toContain('assumed');
        });

    it('a PARTIAL record: the recorded field is taken, the rest stays assumed (and named so)', () => {
        const doc = withRecord(load('jta_randomized_test'), { perkShuffleSeed: 1 });
        const p = slotOf(doc);
        const rec = installedZoneConfigFrom(doc, p, JTA);
        expect(rec.recorded).toEqual(['perkShuffleSeed']);
        expect(rec.assumed).toEqual({ freeZones: 1, startingPerks: 0 });
        const got = zoneContentFor(doc, p, jtaRegions(doc, p)[0], JTA, freeZone(doc, p));
        expect(got.ok, got.why).toBe(true);
        expect(got.config).toEqual({ recorded: ['perkShuffleSeed'], assumed: ['freeZones', 'startingPerks'] });
    });

    it('the record is read by the ENTRY\'s id — a record under another id is not this one\'s', () => {
        const doc = clone(load('jta_randomized_test'));
        doc.procgen_metadata = { [SUBSTRATE_CONFIGS_KEY]: { [otherLabel()]: RECORD(3, 1) } };
        expect(installedZoneConfigFrom(doc, slotOf(doc), JTA).recorded).toEqual([]);
    });

    it('a recorded goal survives the relabel that trap 1415 refused (the Victory holder moved out of jta)', () => {
        const base = load('jta_locations_test');
        const p = slotOf(base);
        const victoryAt = Object.entries(base.canonical_placements[p]).find(([, i]) => i === 'Victory')[0];
        const holder = jtaRegions(base, p).find((r) => base.regions[p][r].locations.some((l) => l.name === victoryAt));
        const other = jtaRegions(base, p).find((r) => r !== holder);
        const relabel = (doc) => { const d = clone(doc); d.preset_sidecars[p][holder].substrate = otherLabel(); return d; };
        // ⛓ the control: without the record, R5b's refusal
        expect(zoneSourceRefusal(relabel(base), { player: p, region: other, substrate: JTA, zoneIdx: 5 }))
            .toContain('its goal zone is not recorded');
        const doc = relabel(withRecord(base, RECORD(1, null)));
        expect(zoneSourceRefusal(doc, { player: p, region: other, substrate: JTA, zoneIdx: 5 })).toBeNull();
        expect(installedZoneConfigFrom(doc, p, JTA).cfg.goalZone).toBe(1);
        const res = replaceRegionContentFromZone({ doc, player: p, region: other, substrate: JTA, zoneIdx: 5 });
        expect(res.ok, res.why).toBe(true);
    });
});

describe('⛓⛓ writer → reader, end to end — a world built under a NON-default config reads itself back', () => {
    const buildJta = (cfg, quota) => {
        jta.applyPipelineConfig(cfg);
        const { grid, startCell, stats } = arrangeShuffledSpiral({
            regionSize: { width: 8, height: 6 }, itemPool: {}, obstaclePool: {}, seed: 1,
            growthParams: { substrateQuotas: { [JTA]: quota }, assumeBidirectional: true, startSubstrate: JTA },
        });
        return buildRulesJson(grid, {
            startCell, seed: 1, itemLib: mergeSubstrateItemLib(DEFAULT_ITEMS, [JTA]),
            completionConditionItem: jta.victoryItem,
            procgenMetadata: { driver: 'shuffled-spiral', stop_reason: stats.stopReason },
        });
    };
    const CFG = { emitZoneLocations: true, goalZone: 3, freeZones: 2, startingPerks: 1, perkShuffleSeed: 7 };

    it('the record is the installed config; the hub installs it (from a reset) and every region verifies', () => {
        const doc = buildJta(CFG, 4);
        expect(doc.procgen_metadata[SUBSTRATE_CONFIGS_KEY][JTA]).toEqual(CFG);
        expect(jta[RECORDABLE_CONFIG_HOOK]()).toEqual(CFG);
        jta.applyPipelineConfig({});
        const p = slotOf(doc);
        const got = zoneContentFor(doc, p, jtaRegions(doc, p)[0], JTA, freeZone(doc, p));
        expect(got.ok, got.why).toBe(true);
        expect(got.verified).toHaveLength(4);
        expect(got.config.assumed).toEqual([]);
    });

    it('a recorded NULL goal (zone locations on, no goal installed) is taken as recorded, never refused as unrecorded',
        () => {
            const cfg = { ...CFG, goalZone: null };
            const doc = buildJta(cfg, 4);
            expect(doc.procgen_metadata[SUBSTRATE_CONFIGS_KEY][JTA].goalZone).toBeNull();
            jta.applyPipelineConfig({});
            const p = slotOf(doc);
            const rec = installedZoneConfigFrom(doc, p, JTA);
            expect(rec.ok, rec.why).toBe(true);
            expect(rec.cfg.goalZone).toBeNull();
            const got = zoneContentFor(doc, p, jtaRegions(doc, p)[0], JTA, freeZone(doc, p));
            expect(got.ok, got.why).toBe(true);
        });

    it('⛔ the same world with its record REMOVED is refused — the defaults do not rebuild it', () => {
        const doc = buildJta(CFG, 4);
        delete doc.procgen_metadata[SUBSTRATE_CONFIGS_KEY];
        jta.applyPipelineConfig({});
        const p = slotOf(doc);
        const got = zoneContentFor(doc, p, jtaRegions(doc, p)[0], JTA, freeZone(doc, p));
        expect(got.ok).toBe(false);
        expect(got.why).toContain(ZONE_NOT_RECORDED);
    });
});

describe('⛓ the hub\'s sentence and record name the split', () => {
    it('zoneConfigSplitSentence names recorded, assumed and the verified count', () => {
        expect(zoneConfigSplitSentence({ recorded: ['perkShuffleSeed'], assumed: ['freeZones'] }, 3))
            .toBe('config: recorded `perkShuffleSeed`; assumed `freeZones` — verified on 3 regions of the slot');
        expect(zoneConfigSplitSentence({ recorded: [], assumed: [] }, 1))
            .toBe('config: recorded none; assumed none — verified on 1 region of the slot');
    });

    it('the worker\'s answer carries the split, and the provenance records it', async () => {
        const doc = withRecord(load('jta_randomized_test'), RECORD(3, 1));
        const p = slotOf(doc);
        const region = jtaRegions(doc, p)[0];
        const source = { kind: REGION_SOURCE_KINDS.ZONE, substrate: JTA, zoneIdx: freeZone(doc, p) };
        const ans = await zoneJobAnswer({ doc, player: p, region, substrate: JTA, source });
        expect(ans.ok, ans.threw).toBe(true);
        expect(ans.config).toEqual({ recorded: ['emitZoneLocations', 'goalZone', 'freeZones', 'startingPerks', 'perkShuffleSeed'], assumed: [] });
        const prov = regenerationProvenance({ substrate: JTA, source }, { ...ans, ms: 1 });
        expect(prov.op).toBe(REPLACE_REGION_CONTENT_OP);
        expect(prov.config).toEqual(ans.config);
    });
});
