import { describe, it, expect } from 'vitest';
import {
  DISCOVERY_OFF_OVERRIDES,
  LOOP_MODE_OVERRIDES,
  OVERRIDE_KEYS,
  WALK_TO_REVEAL_OVERRIDES,
  createOverrideApplier,
  readWorldDiscoveryMode,
  resolveDiscoveryOverrides,
} from './worldDiscoveryMode.js';

const PREFIX = 'moduleSettings.discovery.';

// A settingsManager stand-in with the real override semantics and a yield on
// every write, so two un-serialised runs would interleave.
function makeSettingsManager() {
  const overrides = new Map();
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return {
    overrides,
    async updateSetting(key, value, { persist = true } = {}) {
      await tick();
      if (!persist) overrides.set(key, value);
    },
    async clearOverride(key) {
      await tick();
      overrides.delete(key);
    },
  };
}

describe('readWorldDiscoveryMode', () => {
  it('reads the LOADED slot only, and absent means null', () => {
    const doc = { discovery_mode: { 1: { enabled: false }, 2: { enabled: true } } };
    expect(readWorldDiscoveryMode(doc, '1')).toBe('off');
    expect(readWorldDiscoveryMode(doc, 2)).toBe('on');
    expect(readWorldDiscoveryMode(doc, '3')).toBe(null);
    expect(readWorldDiscoveryMode({}, '1')).toBe(null);
    expect(readWorldDiscoveryMode(null, '1')).toBe(null);
  });

  it('ignores a top-level block (per-player only)', () => {
    expect(readWorldDiscoveryMode({ discovery_mode: { enabled: true } }, '1')).toBe(null);
  });
});

describe('resolveDiscoveryOverrides', () => {
  it('with no world block, Loop mode alone decides — the behaviour before the block existed', () => {
    expect(resolveDiscoveryOverrides({ worldMode: null, loopActive: true })).toBe(LOOP_MODE_OVERRIDES);
    expect(resolveDiscoveryOverrides({ worldMode: null, loopActive: false })).toBe(null);
  });

  it('a world with discovery on uses the loop bundle in loop mode and walk-to-reveal outside it', () => {
    expect(resolveDiscoveryOverrides({ worldMode: 'on', loopActive: true })).toBe(LOOP_MODE_OVERRIDES);
    expect(resolveDiscoveryOverrides({ worldMode: 'on', loopActive: false })).toBe(WALK_TO_REVEAL_OVERRIDES);
  });

  it('a world with discovery off turns it off in and out of loop mode', () => {
    expect(resolveDiscoveryOverrides({ worldMode: 'off', loopActive: true })).toBe(DISCOVERY_OFF_OVERRIDES);
    expect(resolveDiscoveryOverrides({ worldMode: 'off', loopActive: false })).toBe(DISCOVERY_OFF_OVERRIDES);
  });

  it('the loop bundle is exactly the eight values loop mode has always forced', () => {
    expect(LOOP_MODE_OVERRIDES).toEqual({
      enableDiscoveryMode: true,
      regionDiscoveryTrigger: 'onExitDiscovered',
      autoDiscoverLocations: false,
      autoDiscoverExits: false,
      undiscoveredDisplay: 'placeholder',
      showUndiscoveredRegionNames: false,
      clickDiscoversRegion: false,
      disableLocationCheckUI: true,
    });
  });

  it('every bundle writes only keys the applier also clears', () => {
    for (const bundle of [WALK_TO_REVEAL_OVERRIDES, DISCOVERY_OFF_OVERRIDES]) {
      for (const key of Object.keys(bundle)) expect(OVERRIDE_KEYS).toContain(key);
    }
  });
});

describe('createOverrideApplier', () => {
  it('applies a bundle as session overrides and clears every key it does not set', async () => {
    const sm = makeSettingsManager();
    const apply = createOverrideApplier(sm);
    await apply(LOOP_MODE_OVERRIDES);
    expect(sm.overrides.size).toBe(8);
    await apply(DISCOVERY_OFF_OVERRIDES);
    expect([...sm.overrides]).toEqual([[`${PREFIX}enableDiscoveryMode`, false]]);
    await apply(null);
    expect(sm.overrides.size).toBe(0);
  });

  it('B1: a clear issued while an enable is still writing ends cleared (calls do not interleave)', async () => {
    const sm = makeSettingsManager();
    const apply = createOverrideApplier(sm);
    // Not awaited: the second call is issued while the first is mid-run,
    // as the rules-load auto-disable does behind a stateManager-ready enable.
    const first = apply(LOOP_MODE_OVERRIDES);
    const second = apply(null);
    await Promise.all([first, second]);
    expect(sm.overrides.size).toBe(0);
  });

  it('the last call wins in the other order too', async () => {
    const sm = makeSettingsManager();
    const apply = createOverrideApplier(sm);
    apply(null);
    await apply(LOOP_MODE_OVERRIDES);
    expect(Object.fromEntries([...sm.overrides].map(([k, v]) => [k.slice(PREFIX.length), v])))
      .toEqual(LOOP_MODE_OVERRIDES);
  });

  it('a failed run does not wedge the chain', async () => {
    const sm = makeSettingsManager();
    let fail = true;
    const realUpdate = sm.updateSetting;
    sm.updateSetting = async (...args) => {
      if (fail) { fail = false; throw new Error('boom'); }
      return realUpdate(...args);
    };
    const apply = createOverrideApplier(sm);
    await apply(LOOP_MODE_OVERRIDES).catch(() => {});
    await apply(LOOP_MODE_OVERRIDES);
    expect(sm.overrides.size).toBe(8);
  });
});
