/**
 * A file always beats the room's spoiler data (client/core/spoilerData.js → client:roomSpoilerData).
 *
 * Driven through the module's REAL handlers (initialize → stateManager:rulesLoaded / client:roomSpoilerData) with a
 * fetch stub that holds the preset's .jsonl until the test releases it, so both arrival orders are exercised.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: { getCurrentRulesSource: () => null, getStaticData: () => null },
  getLastRawJsonData: () => null,
}));

import { initialize } from './index.js';
import { destroySphereStateSingleton, getSphereStateSingleton } from './singleton.js';
import { readRoomSpoilerData } from '../client/core/spoilerData.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../client/core/fixtures/spoilerData');
const SEED = JSON.parse(readFileSync(join(DIR, 'seed.json'), 'utf8'));
const OWN = JSON.parse(readFileSync(join(DIR, 'own_slot.json'), 'utf8'));
const FILE_LOG = readFileSync(join(DIR, 'sphere_log.jsonl'), 'utf8');
const ROOM = readRoomSpoilerData({ spoiler_data: OWN['1'] }, {
  dataPackage: SEED.data_package, slotInfo: SEED.slot_info, slot: 1, seedName: SEED.seed_name,
}).log;

const PRESET = './presets/somegame/AP_1/AP_1_rules.json';
const PRESET_LOG = './presets/somegame/AP_1/AP_1_sphere_log.jsonl';

function makeBus() {
  const subscribers = new Map();
  return {
    subscribe: (event, cb) => {
      if (!subscribers.has(event)) subscribers.set(event, new Set());
      subscribers.get(event).add(cb);
      return () => subscribers.get(event)?.delete(cb);
    },
    publish: (event, data) => {
      for (const cb of [...(subscribers.get(event) || [])]) cb(data);
    },
  };
}

/** fetch: the rules doc (no embedded log), no preset index, and the .jsonl held until release(). */
function stubFetch() {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const fetchMock = vi.fn(async (url) => {
    if (url === PRESET) return { ok: true, json: async () => ({}) };
    if (url === PRESET_LOG) {
      await held;
      return { ok: true, statusText: 'OK', text: async () => FILE_LOG };
    }
    return { ok: false, status: 404, statusText: 'Not Found', json: async () => null, text: async () => '' };
  });
  vi.stubGlobal('fetch', fetchMock);
  return { release: () => release(), fetchMock };
}

const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };

describe('sphereState: a file beats the room', () => {
  let bus;
  let state;
  beforeEach(async () => {
    destroySphereStateSingleton();
    bus = makeBus();
    await initialize('sphereState', 0, { getEventBus: () => bus });
    state = getSphereStateSingleton();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    destroySphereStateSingleton();
  });

  it('the preset\'s .jsonl finishes AFTER Connected: the room\'s log loads first, then the file replaces it', async () => {
    const { release } = stubFetch();
    bus.publish('stateManager:rulesLoaded', { source: PRESET, playerId: '1' });
    await settle();
    expect(state.logOrigin).toBeNull(); // the file is still on its way
    bus.publish('client:roomSpoilerData', ROOM);
    await settle();
    expect(state.logOrigin).toBe('room');
    expect(state.sphereLogPath).toBe(ROOM.source);
    release();
    await settle();
    expect(state.logOrigin).toBe('file');
    expect(state.sphereLogPath).toBe(PRESET_LOG);
  });

  it('the preset\'s .jsonl finishes BEFORE Connected: the room\'s log is not used', async () => {
    const { release } = stubFetch();
    release();
    bus.publish('stateManager:rulesLoaded', { source: PRESET, playerId: '1' });
    await settle();
    expect(state.sphereLogPath).toBe(PRESET_LOG);
    const before = state.getSphereData();
    bus.publish('client:roomSpoilerData', ROOM);
    await settle();
    expect(state.logOrigin).toBe('file');
    expect(state.sphereLogPath).toBe(PRESET_LOG);
    expect(state.getSphereData()).toBe(before);
  });

  it('rules from the room\'s data (server:…): no file to fetch, and the room\'s log fills the gap', async () => {
    const { fetchMock } = stubFetch();
    bus.publish('stateManager:rulesLoaded', { source: `server:${SEED.seed_name}:P1`, playerId: '1' });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    bus.publish('client:roomSpoilerData', ROOM);
    await settle();
    expect(state.logOrigin).toBe('room');
    expect(state.getSphereData().length).toBeGreaterThan(0);
  });

  it('a file fetch started for EARLIER rules (the local overlay\'s preset) cannot replace the room\'s log', async () => {
    const { release } = stubFetch();
    bus.publish('stateManager:rulesLoaded', { source: PRESET, playerId: '1' });
    await settle();
    bus.publish('stateManager:rulesLoaded', { source: `server:${SEED.seed_name}:P1`, playerId: '1' });
    bus.publish('client:roomSpoilerData', ROOM);
    await settle();
    release();
    await settle();
    expect(state.logOrigin).toBe('room');
    expect(state.sphereLogPath).toBe(ROOM.source);
  });

  it('new rules clear the room\'s log too (it belonged to the connection, not the next rules)', async () => {
    stubFetch();
    bus.publish('stateManager:rulesLoaded', { source: `server:${SEED.seed_name}:P1`, playerId: '1' });
    bus.publish('client:roomSpoilerData', ROOM);
    await settle();
    expect(state.logOrigin).toBe('room');
    bus.publish('stateManager:rulesLoaded', { source: `server:${SEED.seed_name}:P1`, playerId: '1' });
    await settle();
    expect(state.logOrigin).toBeNull();
    expect(state.getSphereData()).toEqual([]);
  });
});
