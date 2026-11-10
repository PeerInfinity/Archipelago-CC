/**
 * A file for the room's seed beats the room's spoiler data (client/core/spoilerData.js → client:roomSpoilerData);
 * a file for ANOTHER seed loses to it; a file whose seed is unknown still wins.
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
import { SphereState } from './sphereState.js';
import { readRoomSpoilerData } from '../client/core/spoilerData.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../client/core/fixtures/spoilerData');
const SEED = JSON.parse(readFileSync(join(DIR, 'seed.json'), 'utf8'));
const OWN = JSON.parse(readFileSync(join(DIR, 'own_slot.json'), 'utf8'));
const FILE_LOG = readFileSync(join(DIR, 'sphere_log.jsonl'), 'utf8');
// The same log, for another seed / with no seed_name: only the metadata line changes.
const withMetadata = (edit) => {
  const [first, ...rest] = FILE_LOG.split('\n');
  const meta = JSON.parse(first);
  expect(meta.type).toBe('metadata');
  return [JSON.stringify(edit(meta)), ...rest].join('\n');
};
const OTHER_SEED = '99999999999999999999';
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
function stubFetch(fileLog = FILE_LOG) {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const fetchMock = vi.fn(async (url) => {
    if (url === PRESET) return { ok: true, json: async () => ({}) };
    if (url === PRESET_LOG) {
      await held;
      return { ok: true, statusText: 'OK', text: async () => fileLog };
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

  it('a server:… rules source is an expected case: logged as info, never the "Could not parse" warning', async () => {
    stubFetch();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const info = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      bus.publish('stateManager:rulesLoaded', { source: `server:${SEED.seed_name}:P1`, playerId: '1' });
      await settle();
      const said = (spy) => spy.mock.calls.map((args) => String(args[0])).filter((m) => m.includes('Could not parse sourceName'));
      expect(said(warn)).toEqual([]);
      expect(said(info)).toEqual([expect.stringContaining("(Rules from the room's data; no file log)")]);
    } finally {
      warn.mockRestore();
      info.mockRestore();
    }
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

  it('the fixtures are what these rows assume: file and room are for the same seed', () => {
    expect(SphereState.peekSeedName(FILE_LOG)).toBe(String(SEED.seed_name));
    expect(SphereState.peekSeedName(ROOM.text)).toBe(String(SEED.seed_name));
  });

  describe('a file for ANOTHER seed loses to the room', () => {
    let otherLog;
    beforeEach(() => { otherLog = withMetadata((m) => ({ ...m, seed_name: OTHER_SEED })); });

    it('it finishes AFTER Connected: the room\'s log stays', async () => {
      const { release } = stubFetch(otherLog);
      bus.publish('stateManager:rulesLoaded', { source: PRESET, playerId: '1' });
      await settle();
      bus.publish('client:roomSpoilerData', ROOM);
      await settle();
      expect(state.logOrigin).toBe('room');
      const before = state.getSphereData();
      release();
      await settle();
      expect(state.logOrigin).toBe('room');
      expect(state.sphereLogPath).toBe(ROOM.source);
      expect(state.getSphereData()).toBe(before);
      expect(state.logMetadata.seed_name).toBe(String(SEED.seed_name));
    });

    it('it finishes BEFORE Connected: the room\'s log replaces it', async () => {
      const { release } = stubFetch(otherLog);
      release();
      bus.publish('stateManager:rulesLoaded', { source: PRESET, playerId: '1' });
      await settle();
      expect(state.logOrigin).toBe('file');
      expect(state.logMetadata.seed_name).toBe(OTHER_SEED);
      bus.publish('client:roomSpoilerData', ROOM);
      await settle();
      expect(state.logOrigin).toBe('room');
      expect(state.sphereLogPath).toBe(ROOM.source);
      expect(state.logMetadata.seed_name).toBe(String(SEED.seed_name));
    });

    it('with no room data, it is used whatever its seed', async () => {
      const { release } = stubFetch(otherLog);
      release();
      bus.publish('stateManager:rulesLoaded', { source: PRESET, playerId: '1' });
      await settle();
      expect(state.logOrigin).toBe('file');
      expect(state.sphereLogPath).toBe(PRESET_LOG);
      expect(state.getSphereData().length).toBeGreaterThan(0);
    });
  });

  // No seed_name on the metadata line, and no metadata line at all: the file's seed cannot be known, so it keeps
  // winning (the behaviour before seeds were compared).
  for (const [label, edit] of [
    ['no seed_name', () => withMetadata(({ seed_name, ...m }) => m)],
    ['no metadata line', () => FILE_LOG.split('\n').slice(1).join('\n')],
  ]) {
    describe(`a file whose seed is unknown (${label}) still beats the room`, () => {
      let seedless;
      beforeEach(() => {
        seedless = edit();
        expect(SphereState.peekSeedName(seedless)).toBeNull();
      });

      it('it finishes AFTER Connected: it replaces the room\'s log', async () => {
        const { release } = stubFetch(seedless);
        bus.publish('stateManager:rulesLoaded', { source: PRESET, playerId: '1' });
        await settle();
        bus.publish('client:roomSpoilerData', ROOM);
        await settle();
        expect(state.logOrigin).toBe('room');
        release();
        await settle();
        expect(state.logOrigin).toBe('file');
        expect(state.sphereLogPath).toBe(PRESET_LOG);
      });

      it('it finishes BEFORE Connected: the room\'s log is refused', async () => {
        const { release } = stubFetch(seedless);
        release();
        bus.publish('stateManager:rulesLoaded', { source: PRESET, playerId: '1' });
        await settle();
        const before = state.getSphereData();
        bus.publish('client:roomSpoilerData', ROOM);
        await settle();
        expect(state.logOrigin).toBe('file');
        expect(state.getSphereData()).toBe(before);
      });
    });
  }
});

describe('SphereState.peekSeedName', () => {
  it.each([
    ['a metadata line', '{"type":"metadata","seed_name":"123"}\n{"type":"state_update"}', '123'],
    ['a numeric seed_name, as a string', '{"type":"metadata","seed_name":123}', '123'],
    ['a log_header before it', '{"type":"log_header"}\n{"type":"metadata","seed_name":"7"}', '7'],
    ['blank lines first', '\n\n{"type":"metadata","seed_name":"7"}', '7'],
    ['metadata without seed_name (only seed)', '{"type":"metadata","seed":1}', null],
    ['a state_update first', '{"type":"state_update"}\n{"type":"metadata","seed_name":"7"}', null],
    ['an unparsable first line', 'nope\n{"type":"metadata","seed_name":"7"}', null],
    ['empty text', '', null],
    ['not text', null, null],
  ])('%s', (_label, text, expected) => {
    expect(SphereState.peekSeedName(text)).toBe(expected);
  });
});
