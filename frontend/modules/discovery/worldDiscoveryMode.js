/**
 * Discovery-mode session overrides: which discovery settings Loop mode and a
 * world's own `discovery_mode` block force, and the one serialised writer that
 * applies them.
 *
 * A world MAY carry `discovery_mode["<p>"] = { enabled: true|false }` (written
 * by the Procgen Pipeline's "Discovery mode" select / `--discovery-mode`). It is
 * per player, like `loop_costs`. ABSENT is the default and means "same as loop
 * mode": Loop mode forces LOOP_MODE_OVERRIDES while it is on, and nothing is
 * forced while it is off — exactly the behaviour before the block existed.
 *
 *   world block   loop mode   → overrides
 *   (absent)      on          LOOP_MODE_OVERRIDES
 *   (absent)      off         none (the user's saved settings)
 *   enabled:true  on          LOOP_MODE_OVERRIDES
 *   enabled:true  off         WALK_TO_REVEAL_OVERRIDES
 *   enabled:false either      DISCOVERY_OFF_OVERRIDES (and every region,
 *                              location and exit counts as discovered)
 *
 * Every bundle writes only keys from OVERRIDE_KEYS, and applying a bundle
 * clears the session override of every OVERRIDE_KEYS key it does not set, so
 * moving between any two rows leaves no stale override behind.
 */

const PREFIX = 'moduleSettings.discovery.';

// Unchanged from loops/eventCoordinator.js's former _enableDiscoveryForLoopMode.
export const LOOP_MODE_OVERRIDES = Object.freeze({
  enableDiscoveryMode: true,
  regionDiscoveryTrigger: 'onExitDiscovered',
  autoDiscoverLocations: false,
  autoDiscoverExits: false,
  undiscoveredDisplay: 'placeholder',
  showUndiscoveredRegionNames: false,
  clickDiscoversRegion: false,
  disableLocationCheckUI: true,
});

// Discovery without Loop mode: walking into a region reveals it with its
// locations and exits; undiscovered ones show as placeholders.
export const WALK_TO_REVEAL_OVERRIDES = Object.freeze({
  enableDiscoveryMode: true,
  regionDiscoveryTrigger: 'onEnter',
  autoDiscoverLocations: true,
  autoDiscoverExits: true,
  undiscoveredDisplay: 'placeholder',
  showUndiscoveredRegionNames: false,
  clickDiscoversRegion: false,
  disableLocationCheckUI: false,
});

export const DISCOVERY_OFF_OVERRIDES = Object.freeze({
  enableDiscoveryMode: false,
});

export const OVERRIDE_KEYS = Object.freeze(Object.keys(LOOP_MODE_OVERRIDES));

/**
 * The loaded slot's choice: 'on', 'off', or null when the world carries no
 * block for that slot (the default — "same as loop mode").
 */
export function readWorldDiscoveryMode(rawJsonData, playerId) {
  const enabled = rawJsonData?.discovery_mode?.[String(playerId)]?.enabled;
  if (enabled === true) return 'on';
  if (enabled === false) return 'off';
  return null;
}

/** The bundle to force for a (world choice, loop mode) pair; null = none. */
export function resolveDiscoveryOverrides({ worldMode = null, loopActive = false } = {}) {
  if (worldMode === 'off') return DISCOVERY_OFF_OVERRIDES;
  if (loopActive) return LOOP_MODE_OVERRIDES;
  if (worldMode === 'on') return WALK_TO_REVEAL_OVERRIDES;
  return null;
}

/**
 * A writer that applies bundles one at a time, in call order. Each apply is a
 * run of awaited per-key writes; two overlapping runs used to interleave (a
 * restore that had cleared one key was overtaken by an enable, then cleared the
 * rest), leaving `enableDiscoveryMode` stuck on after loop mode ended. Chaining
 * makes the last call's bundle the final state.
 */
export function createOverrideApplier(settingsManager) {
  let chain = Promise.resolve();
  return function apply(bundle) {
    const run = async () => {
      for (const key of OVERRIDE_KEYS) {
        if (bundle && Object.prototype.hasOwnProperty.call(bundle, key)) {
          await settingsManager.updateSetting(`${PREFIX}${key}`, bundle[key], { persist: false });
        } else {
          await settingsManager.clearOverride(`${PREFIX}${key}`);
        }
      }
    };
    chain = chain.then(run, run);
    return chain;
  };
}
