import { describe, it, expect } from 'vitest';
import {
  ACTION_NODES_BUNDLE,
  ACTION_NODES_OVERRIDES,
  DISCOVERY_OFF_OVERRIDES,
  LOOP_MODE_OVERRIDES,
  OVERRIDE_KEYS,
  WALK_TO_REVEAL_OVERRIDES,
  createOverrideApplier,
  readWorldDiscoveryMode,
  resolveDiscoveryOverrides,
  settingsChangeSteps,
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

describe('⛓ the actionNodes bundle (AN-1b)', () => {
  it('a block with bundle "actionNodes" reads as that mode; enabled:false still means off', () => {
    expect(readWorldDiscoveryMode({ discovery_mode: { 1: { enabled: true, bundle: ACTION_NODES_BUNDLE } } }, '1')).toBe(ACTION_NODES_BUNDLE);
    expect(readWorldDiscoveryMode({ discovery_mode: { 1: { enabled: false, bundle: ACTION_NODES_BUNDLE } } }, '1')).toBe('off');
  });
  it('it is Loop mode\'s bundle with autoDiscoverLocations on, forced with Loop mode ON and OFF', () => {
    expect(ACTION_NODES_OVERRIDES).toEqual({ ...LOOP_MODE_OVERRIDES, autoDiscoverLocations: true });
    expect(resolveDiscoveryOverrides({ worldMode: ACTION_NODES_BUNDLE, loopActive: true })).toBe(ACTION_NODES_OVERRIDES);
    expect(resolveDiscoveryOverrides({ worldMode: ACTION_NODES_BUNDLE, loopActive: false })).toBe(ACTION_NODES_OVERRIDES);
    for (const k of Object.keys(ACTION_NODES_OVERRIDES)) expect(OVERRIDE_KEYS).toContain(k);
  });
  it('⛔ PIN: every other row of the table is unchanged', () => {
    expect(resolveDiscoveryOverrides({ worldMode: null, loopActive: true })).toBe(LOOP_MODE_OVERRIDES);
    expect(resolveDiscoveryOverrides({ worldMode: null, loopActive: false })).toBe(null);
    expect(resolveDiscoveryOverrides({ worldMode: 'on', loopActive: false })).toBe(WALK_TO_REVEAL_OVERRIDES);
    expect(resolveDiscoveryOverrides({ worldMode: 'off', loopActive: true })).toBe(DISCOVERY_OFF_OVERRIDES);
    expect(LOOP_MODE_OVERRIDES.autoDiscoverLocations).toBe(false);
  });
});

describe('⛓ the order trap: the applier writes the trigger BEFORE autoDiscoverLocations (AN-1b)', () => {
  // Apply the bundle key by key, in the applier's own order, from the defaults, and collect the steps the module
  // would run after each write (index.js handleSettingsChanged).
  const DEFAULTS = { regionDiscoveryTrigger: 'onEnter', autoDiscoverLocations: false };
  function stepsWhileApplying(bundle) {
    let cur = { ...DEFAULTS };
    const seen = [];
    for (const key of OVERRIDE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(bundle, key)) continue;
      const next = { ...cur, [key]: bundle[key] };
      const steps = settingsChangeSteps(cur, next);
      for (const [name, on] of Object.entries(steps)) if (on) seen.push(`${name}@${key}`);
      cur = next;
    }
    return seen;
  }
  it('the precondition: the trigger key comes first', () => {
    expect(OVERRIDE_KEYS.indexOf('regionDiscoveryTrigger')).toBeLessThan(OVERRIDE_KEYS.indexOf('autoDiscoverLocations'));
  });
  it('the actionNodes bundle runs the cascade while locations are off, THEN the location step', () => {
    expect(stepsWhileApplying(ACTION_NODES_OVERRIDES)).toEqual([
      'cascade@regionDiscoveryTrigger', 'cascadeLocations@autoDiscoverLocations',
    ]);
  });
  it('Loop mode\'s bundle runs the cascade only (its locations stay hidden, as before)', () => {
    expect(stepsWhileApplying(LOOP_MODE_OVERRIDES)).toEqual(['cascade@regionDiscoveryTrigger']);
  });
  it('walk-to-reveal (trigger onEnter) runs neither', () => {
    expect(stepsWhileApplying(WALK_TO_REVEAL_OVERRIDES)).toEqual([]);
  });
});
