import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import '../mazeRoom/mazeRoomLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { sidecarFieldsOf, sidecarPayloadErrors, validateSidecarFields } from '../procgenCore/sidecarFields.js';
import { buildTopDownEnvelope, runTopDownToStep } from '../procgenPipeline/topDownSteps.js';
import { arrangeShuffledSpiral, buildRulesJson } from '../procgenPipeline/procgenPipelineEngine.js';
import { pipelineLayoutsOf, PIPELINE_LAYOUTS } from '../procgenCore/substratePredicates.js';
import {
  DEFAULT_MYSTERY_LOCK, MYSTERY_LOCKS, MYSTERY_PIPELINE_CONFIG_KEYS, MYSTERY_SIDECAR_FIELDS, MYSTERY_SUBSTRATE_ID,
  MYSTERY_SUBSTRATE_REFUSALS as REFUSALS, caseDocError, mysteryConfigFromSource, mysteryRegionsOfSource, mysteryZoneForSpecs,
  caseWorldError, mysteryFillerItem, mysteryPlacedConfigFromSource, mysterySpareQuestions, mysteryZoneRules,
  substrateRegistryEntry as entry,
} from './mysterySubstrateLibrary.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const caseDoc = (over = {}) => ({
  story: 'garden-room', version: 'v1', case: 'cases/miniatures/garden-room', goal: 'q.who',
  locations: { 'Question 01': 'q.door', 'Question 02': 'q.who' },
  items: { 'The gardener\'s note': 'note' },
  ...over,
});
const specs = (ids, region = 'The case') => ({ region_id: region, exitSpecs: [], locationSpecs: ids.map((id) => ({ id, item: null })), seed: 1 });
const reasonOf = (fn) => { try { fn(); } catch (e) { return e.reason; } return null; };

/** A small FILLED source world (locations carry their items): the case's region, with or without a second region in front of it. */
function sourceWorld({ street = false } = {}) {
  const doc = caseDoc();
  const rule = (items) => (items.length ? { rule: 'Has', item_name: items[0] } : { rule: 'True_' });
  const regions = {
    Menu: { name: 'Menu', exits: [{ name: 'In', connected_region: street ? 'The street' : 'The case', access_rule: rule([]) }], locations: [] },
    'The case': {
      name: 'The case',
      exits: street ? [{ name: 'Down', connected_region: 'The street', access_rule: rule([]) }] : [],
      locations: [
        { name: 'Question 01', id: 1000, access_rule: rule([]), item: { name: 'The gardener\'s note', player: 1, advancement: true, type: 'None' } },
        { name: 'Question 02', id: 1001, access_rule: rule(['The gardener\'s note']), item: { name: 'Victory', player: 1, advancement: true, type: 'None' } },
      ],
    },
  };
  if (street) {
    regions['The street'] = { name: 'The street', exits: [{ name: 'Up', connected_region: 'The case', access_rule: rule([]) }], locations: [] };
  }
  const item = (name, id, classification) => ({ name, id, groups: [], classification, type: null, max_count: 1 });
  return {
    schema_version: 3, game_name: 'Mystery test', game_directory: 'mystery_test', archipelago_version: '0.6.7',
    generation_seed: 1, player_names: { 1: 'Player1' },
    regions: { 1: regions },
    start_regions: { 1: { default: ['Menu'], available: [] } },
    items: { 1: { 'The gardener\'s note': item('The gardener\'s note', 1, 'progression'), Victory: item('Victory', 2, 'progression') } },
    item_groups: { 1: {} }, itempool_counts: { 1: { 'The gardener\'s note': 1, Victory: 1 } },
    progression_mapping: { 1: {} }, starting_items: { 1: [] },
    world: { 1: { game: 'Mystery test', slot_data: { mystery: doc } } },
    exporter: { 1: {} }, game_info: { 1: {} }, helpers: { 1: {} },
  };
}

async function topDown(source, { substrateByRegion, lock } = {}) {
  entry.applyPipelineConfig({ ...mysteryConfigFromSource(source), ...(lock ? { lock } : {}) });
  const env = buildTopDownEnvelope({
    source, seed: 1, gridDims: { width: 2, height: 2 }, regionSizeBase: { width: 8, height: 6 },
    substrateMix: { [MYSTERY_SUBSTRATE_ID]: 1, maze: 1 },
  });
  // Every region the source's case claims is the mystery's; the rest are named by the caller.
  env.opts.substrateByRegion = { ...mysteryRegionsOfSource(source), ...(substrateByRegion ?? {}) };
  await runTopDownToStep(env, 'compile');
  return env.compile.rulesJson;
}

afterEach(() => entry.applyPipelineConfig({}));

describe('the registry entry', () => {
  it('is registered under its id, with a declared payload', () => {
    expect(substrateRegistry.get(MYSTERY_SUBSTRATE_ID)).toBe(entry);
    expect(validateSidecarFields(MYSTERY_SIDECAR_FIELDS)).toEqual([]);
  });

  it('declares the keys its config reads, and records what was installed', () => {
    expect([...MYSTERY_PIPELINE_CONFIG_KEYS]).toEqual(['caseDoc', 'caseWorld', 'lock']);
    expect(entry.recordablePipelineConfig()).toEqual({ lock: DEFAULT_MYSTERY_LOCK });
    entry.applyPipelineConfig({ caseDoc: caseDoc(), lock: MYSTERY_LOCKS.EVERYTHING });
    expect(entry.recordablePipelineConfig()).toEqual({ caseDoc: caseDoc(), lock: MYSTERY_LOCKS.EVERYTHING });
    entry.applyPipelineConfig({});
    expect(entry.recordablePipelineConfig()).toEqual({ lock: DEFAULT_MYSTERY_LOCK });
  });

  it('refuses a malformed case document and an unknown lock, by name', () => {
    expect(caseDocError(caseDoc())).toBeNull();
    expect(reasonOf(() => entry.applyPipelineConfig({ caseDoc: { story: 'x' } }))).toBe(REFUSALS.BAD_CASE);
    expect(reasonOf(() => entry.applyPipelineConfig({ caseDoc: caseDoc({ locations: { a: 'q', b: 'q' } }) }))).toBe(REFUSALS.BAD_CASE);
    expect(reasonOf(() => entry.applyPipelineConfig({ caseDoc: caseDoc(), lock: 'sometimes' }))).toBe(REFUSALS.BAD_LOCK);
  });
});

describe('mysteryRegionsOfSource', () => {
  it('claims the region whose locations are the case\'s, and no other', () => {
    expect(mysteryRegionsOfSource(sourceWorld({ street: true }))).toEqual({ 'The case': MYSTERY_SUBSTRATE_ID });
    const noCase = sourceWorld(); delete noCase.world['1'].slot_data.mystery;
    expect(mysteryRegionsOfSource(noCase)).toEqual({});
  });
});

describe('mysteryZoneForSpecs', () => {
  const config = { caseDoc: caseDoc(), lock: MYSTERY_LOCKS.NEW_READING };

  it('answers the case as a payload: questions to location names, papers by item name, the lock', () => {
    const zone = mysteryZoneForSpecs(config, specs(['Question 01', 'Question 02']));
    expect(zone.locations.map((l) => l.id)).toEqual(['Question 01', 'Question 02']);
    expect(zone.payload).toEqual({
      story: 'garden-room', version: 'v1', case: 'cases/miniatures/garden-room', goal: 'q.who', lock: 'new-reading',
      ap_locations: { 'q.door': 'Question 01', 'q.who': 'Question 02' },
      papers: { 'The gardener\'s note': 'note' },
    });
  });

  it('names the case directory by the story when the case names none', () => {
    const doc = caseDoc(); delete doc.case;
    expect(mysteryZoneForSpecs({ caseDoc: doc }, specs(['Question 01', 'Question 02'])).payload.case).toBe('cases/garden-room');
  });

  it('refuses, by name: no case, a location that is no question, a question with no location', () => {
    expect(reasonOf(() => mysteryZoneForSpecs({ caseDoc: null }, specs([])))).toBe(REFUSALS.NO_CASE);
    expect(reasonOf(() => mysteryZoneForSpecs(config, specs(['Question 01', 'Question 02', 'A chest'])))).toBe(REFUSALS.NOT_A_QUESTION);
    expect(reasonOf(() => mysteryZoneForSpecs(config, specs(['Question 01'])))).toBe(REFUSALS.QUESTION_MISSING);
  });
});

describe('the payload round trip', () => {
  it('deserialises exits to a Map by name and serialises them back', () => {
    const payload = {
      ...mysteryZoneForSpecs({ caseDoc: caseDoc() }, specs(['Question 01', 'Question 02'])).payload,
      exits: [{ exit_id: 'Down', exitName: 'Down', side: 'E', targetRegion: 'The street' }],
    };
    const world = entry.deserializeWorld(payload);
    expect(world.exits.has('Down')).toBe(true);
    expect(entry.serializeWorld(world)).toEqual(payload);
    expect(entry.apLocationNamesOf(payload).sort()).toEqual(['Question 01', 'Question 02']);
  });

  it('refuses a payload that is no case', () => {
    expect(reasonOf(() => entry.deserializeWorld({ exits: [] }))).toBe(REFUSALS.BAD_PAYLOAD);
  });
});

describe('through the top-down driver', () => {
  it('the case\'s own world becomes one mystery region that keeps its rules', async () => {
    const source = sourceWorld();
    const rules = await topDown(source, { lock: MYSTERY_LOCKS.EVERYTHING });
    const sidecar = rules.preset_sidecars['1']['The case'];
    expect(sidecar.substrate).toBe(MYSTERY_SUBSTRATE_ID);
    expect(sidecar.playable_payload.ap_locations).toEqual({ 'q.door': 'Question 01', 'q.who': 'Question 02' });
    expect(sidecar.playable_payload.lock).toBe('everything');
    expect(sidecarPayloadErrors(sidecarFieldsOf(entry), sidecar.playable_payload)).toEqual([]);
    const locations = Object.fromEntries(rules.regions['1']['The case'].locations.map((l) => [l.name, l.access_rule]));
    expect(Object.keys(locations).sort()).toEqual(['Question 01', 'Question 02']);
    expect(JSON.stringify(locations['Question 02'])).toContain('The gardener\'s note');
    expect(rules.procgen_metadata['1'].substrate_configs[MYSTERY_SUBSTRATE_ID]).toEqual({ caseDoc: caseDoc(), lock: 'everything' });
  });

  it('a case beside a maze region: each region keeps its own substrate, and the way between them', async () => {
    const rules = await topDown(sourceWorld({ street: true }), { substrateByRegion: { 'The street': 'maze' } });
    const sidecars = rules.preset_sidecars['1'];
    expect(sidecars['The case'].substrate).toBe(MYSTERY_SUBSTRATE_ID);
    expect(sidecars['The street'].substrate).toBe('maze');
    expect(entry.apExitNamesOf(sidecars['The case'].playable_payload)).toEqual(['Down']);
    expect(sidecarPayloadErrors(sidecarFieldsOf(entry), sidecars['The case'].playable_payload)).toEqual([]);
  });

  it('a region that is not the case is refused by name', async () => {
    await expect(topDown(sourceWorld({ street: true }), { substrateByRegion: { 'The street': MYSTERY_SUBSTRATE_ID } }))
      .rejects.toMatchObject({ reason: REFUSALS.QUESTION_MISSING });
  });
});

describe('the committed long case', () => {
  // The generated (filled) world of the long case: the same preset the in-app rows load.
  const preset = path.join(REPO, 'frontend/presets/mystery_custom_house_fire/AP_14089154938208861744/AP_14089154938208861744_rules.json');
  it('realises whole: every question a location, every paper an item, the placements and the pool as they were', async () => {
    const source = JSON.parse(fs.readFileSync(preset, 'utf8'));
    const block = source.world['1'].slot_data.mystery;
    expect(Object.values(mysteryRegionsOfSource(source))).toEqual([MYSTERY_SUBSTRATE_ID]);
    const rules = await topDown(source);
    const [regionName, sidecar] = Object.entries(rules.preset_sidecars['1']).find(([, s]) => s.substrate === MYSTERY_SUBSTRATE_ID);
    const payload = sidecar.playable_payload;
    expect(payload.version).toBe(block.version);
    expect(Object.keys(payload.ap_locations).sort()).toEqual(Object.values(block.locations).sort());
    expect(payload.papers).toEqual(block.items);
    for (const itemName of Object.keys(payload.papers)) expect(rules.items['1'], itemName).toHaveProperty([itemName]);
    expect(rules.itempool_counts['1']).toEqual(source.itempool_counts['1']);
    const placed = (doc, name) => Object.fromEntries(doc.regions['1'][name].locations.map((l) => [l.name, l.item?.name ?? null]));
    expect(placed(rules, regionName)).toEqual(placed(source, regionName));
    expect(sidecarPayloadErrors(sidecarFieldsOf(entry), payload)).toEqual([]);
  });
});

describe('the office placed whole (the shuffled spiral)', () => {
  const preset = path.join(REPO, 'frontend/presets/mystery_custom_house_fire/AP_14089154938208861744/AP_14089154938208861744_rules.json');
  const source = () => JSON.parse(fs.readFileSync(preset, 'utf8'));
  const sourceRegion = (doc) => Object.values(doc.regions['1']).find((r) => (r.locations ?? []).length > 0);

  it('reads the filled case off a source: each question\'s rule and item, and each item\'s class', () => {
    const doc = source();
    const cfg = mysteryPlacedConfigFromSource(doc);
    const region = sourceRegion(doc);
    expect(caseWorldError(cfg.caseWorld, cfg.caseDoc)).toBeNull();
    expect(cfg.caseWorld.locations.map((l) => [l.name, l.item, l.access_rule]))
      .toEqual(region.locations.map((l) => [l.name, l.item.name, l.access_rule]));
    expect(mysterySpareQuestions(cfg)).toBe(region.locations.filter((l) => doc.items['1'][l.item.name].classification === 'filler').length);
    expect(doc.items['1'][mysteryFillerItem(cfg)].classification).toBe('filler');
  });

  it('a bare source (nothing placed) gives no filled case, and the top-down config is unchanged by this', () => {
    const doc = source();
    for (const l of sourceRegion(doc).locations) delete l.item;
    expect(mysteryPlacedConfigFromSource(doc)).toEqual({});
    expect(Object.keys(mysteryConfigFromSource(source()))).toEqual(['caseDoc']);
  });

  it('with no filled case installed the entry brings no zone, item or goal; installed, one zone', () => {
    expect([entry.zoneCount, entry.victoryItem, entry.fillerItem, entry.libraryItems]).toEqual([0, undefined, undefined, {}]);
    expect(pipelineLayoutsOf(entry)).toEqual([PIPELINE_LAYOUTS.SPIRAL, PIPELINE_LAYOUTS.TOPDOWN]);
    const cfg = mysteryPlacedConfigFromSource(source());
    entry.applyPipelineConfig(cfg);
    expect(entry.zoneCount).toBe(1);
    expect(entry.spiralItemCapacity(0)).toBe(mysterySpareQuestions(cfg));
    expect(Object.keys(entry.libraryItems).sort()).toEqual(Object.keys(cfg.caseWorld.items).sort());
    expect(entry.recordablePipelineConfig().caseWorld).toEqual(cfg.caseWorld);
  });

  it('dealt items take the spare questions in order; the goal stands where the case\'s own stood', () => {
    const cfg = mysteryPlacedConfigFromSource(source());
    const spare = cfg.caseWorld.locations.filter((l) => l.item === mysteryFillerItem(cfg)).map((l) => l.name);
    const goal = cfg.caseWorld.locations.find((l) => l.item === 'Victory').name;
    const held = (zone) => Object.fromEntries(zone.locations.map((l) => [l.global_name, l.item]));
    const dealt = held(mysteryZoneRules(cfg, 0, { region_id: 'r', itemsToPlace: ['key_red', 'Victory'], goalOwned: true }));
    expect([dealt[spare[0]], dealt[spare[1]], dealt[goal]]).toEqual(['key_red', mysteryFillerItem(cfg), 'Victory']);
    // The goal placed elsewhere: the case's own becomes its filler. No goal in the world: the case keeps its own.
    expect(held(mysteryZoneRules(cfg, 0, { region_id: 'r', goalOwned: true }))[goal]).toBe(mysteryFillerItem(cfg));
    expect(held(mysteryZoneRules(cfg, 0, { region_id: 'r' }))[goal]).toBe('Victory');
  });

  it('refuses by name: no filled case, a second zone, more items than spare questions, a filled case that is not the case', () => {
    const cfg = mysteryPlacedConfigFromSource(source());
    expect(reasonOf(() => mysteryZoneRules({ caseDoc: cfg.caseDoc }, 0, {}))).toBe(REFUSALS.NO_CASE_WORLD);
    expect(reasonOf(() => mysteryZoneRules(cfg, 1, {}))).toBe(REFUSALS.NO_SUCH_ZONE);
    const many = Array.from({ length: mysterySpareQuestions(cfg) + 1 }, (_, i) => `item_${i}`);
    expect(reasonOf(() => mysteryZoneRules(cfg, 0, { itemsToPlace: many }))).toBe(REFUSALS.TOO_MANY_ITEMS);
    const short = { ...cfg, caseWorld: { ...cfg.caseWorld, locations: cfg.caseWorld.locations.slice(1) } };
    expect(reasonOf(() => entry.applyPipelineConfig(short))).toBe(REFUSALS.BAD_CASE_WORLD);
    expect(reasonOf(() => entry.applyPipelineConfig({ caseWorld: cfg.caseWorld }))).toBe(REFUSALS.BAD_CASE_WORLD);
  });

  it('a spiral world of maze rooms and the office: the case whole, its rules kept, every location in the sphere log', () => {
    const doc = source();
    const cfg = mysteryPlacedConfigFromSource(doc);
    // The stepped driver's ① installs a quota substrate's config; the monolithic call leaves it to the caller.
    entry.applyPipelineConfig(cfg);
    const { grid, startCell, stats } = arrangeShuffledSpiral({
      regionSize: { width: 7, height: 7 }, itemPool: { victory: 1, key_red: 1, key_green: 1 }, obstaclePool: {}, seed: 5, regionParams: {},
      growthParams: { substrateQuotas: { maze: 3, mystery: 1 }, maxItemsPerRegion: 2, startSubstrate: 'maze', substrateConfig: { mystery: cfg } },
      hazardOpts: {},
    });
    const rules = buildRulesJson(grid, { startCell, seed: 5, completionConditionItem: 'Victory', procgenMetadata: { driver: 'test', stop_reason: stats.stopReason } });
    const [regionName, sidecar] = Object.entries(rules.preset_sidecars['1']).find(([, s]) => s.substrate === MYSTERY_SUBSTRATE_ID);
    const office = rules.regions['1'][regionName];
    const region = sourceRegion(doc);
    expect(office.locations.map((l) => [l.name, l.access_rule])).toEqual(region.locations.map((l) => [l.name, l.access_rule]));
    // The papers stand where the source's fill put them.
    const papers = Object.keys(cfg.caseDoc.items);
    const at = (r) => Object.fromEntries(r.locations.filter((l) => papers.includes(l.item?.name)).map((l) => [l.name, l.item.name]));
    expect(at(office)).toEqual(at(region));
    // Every paper the case places is an item of the world. The papers the case starts with are not: no rule
    // names one, and the page holds them itself (the source's `starting_items`; the spiral has no such channel).
    const start = doc.starting_items['1'];
    expect(JSON.stringify(region)).not.toMatch(new RegExp(start.map((n) => JSON.stringify(n).slice(1, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')));
    for (const name of papers.filter((n) => !start.includes(n))) expect(rules.items['1'], name).toHaveProperty([name]);
    expect(sidecarPayloadErrors(sidecarFieldsOf(entry), sidecar.playable_payload)).toEqual([]);
    expect(Object.values(sidecar.playable_payload.ap_locations).sort()).toEqual(office.locations.map((l) => l.name).sort());
    expect(rules.procgen_metadata['1'].substrate_configs.mystery.caseWorld).toEqual(cfg.caseWorld);
    // Solvable: the world's own sphere log reaches every location, and one location holds the goal.
    const all = Object.values(rules.regions['1']).flatMap((r) => r.locations ?? []);
    const logged = new Set(rules.sphere_log.flatMap((e) => e.player_data?.['1']?.sphere_locations ?? []));
    expect(all.map((l) => l.name).filter((n) => !logged.has(n))).toEqual([]);
    expect(all.filter((l) => l.item?.name === 'Victory')).toHaveLength(1);
  });
});
