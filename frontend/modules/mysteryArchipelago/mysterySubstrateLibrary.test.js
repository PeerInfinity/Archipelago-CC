import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import '../mazeRoom/mazeRoomLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { sidecarFieldsOf, sidecarPayloadErrors, validateSidecarFields } from '../procgenCore/sidecarFields.js';
import { buildTopDownEnvelope, runTopDownToStep } from '../procgenPipeline/topDownSteps.js';
import {
  DEFAULT_MYSTERY_LOCK, MYSTERY_LOCKS, MYSTERY_PIPELINE_CONFIG_KEYS, MYSTERY_SIDECAR_FIELDS, MYSTERY_SUBSTRATE_ID,
  MYSTERY_SUBSTRATE_REFUSALS as REFUSALS, caseDocError, mysteryConfigFromSource, mysteryRegionsOfSource, mysteryZoneForSpecs,
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
    expect([...MYSTERY_PIPELINE_CONFIG_KEYS]).toEqual(['caseDoc', 'lock']);
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
