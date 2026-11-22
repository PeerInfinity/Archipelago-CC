/**
 * ⛓ THE CA-S4 EQUIVALENCE ORACLE (tests only; nothing in the app imports it): the four `regionGraph:nodeSelected`
 * listeners and Flash's "TP on UI click" check handler AS THEY WERE AT BASE d358d50e02, extracted with `git show` and
 * kept VERBATIM inside factories that supply what their closures read (`this` / the module-level state). They are the
 * BEFORE side of `panelClickActions.equivalence.test.js`.
 *
 *   - Flash: `flashPanel/flashPanelUI.js:1687-1691` (the listener) and `:1701-1706` (`handleUserLocationCheck`);
 *   - Discovery: `discovery/index.js:485-501` (`handleRegionClicked`; subscribed at `:285`);
 *   - apcalc: `apcalc/index.js:69-78`;
 *   - vibeCodingSim: `vibeCodingSim/index.js:85-92`.
 * CA-S5 retired `regionGraph:nodeSelected` in the app; these listeners still hear it on the test's BASE bus, where the
 * equivalence test re-publishes the base's selection event itself (`baseSelect`, delta S).
 */

/** Flash at base: `self` = { teleportOnClickCheckbox, _teleportToRegion, _teleportToLocation }. */
export function legacyFlash(self) {
    return {
        // flashPanelUI.js:1687 — subscribed to 'regionGraph:nodeSelected'
        onNodeSelected: (payload) => {
            if (!self.teleportOnClickCheckbox?.checked) return;
            if (!payload?.nodeId) return;
            self._teleportToRegion(payload.nodeId);
        },
        // flashPanelUI.js:1701 — the dispatcher receiver's user:/system:locationCheck
        handleUserLocationCheck(eventData) {
            if (!self.teleportOnClickCheckbox?.checked) return;
            if (!eventData?.locationName) return;
            if (eventData.originator === 'FlashPanel') return;
            self._teleportToLocation(eventData.locationName);
        },
    };
}

/** Discovery at base: `m` = { _settings, discoveryStateSingleton, log, autoDiscoverLocationsInRegion, autoDiscoverExitsInRegion }. */
export function legacyDiscovery(m) {
    const { discoveryStateSingleton, log, autoDiscoverLocationsInRegion, autoDiscoverExitsInRegion } = m;
    return function handleRegionClicked(eventData) {
      const _settings = m._settings;
      if (!_settings.enableDiscoveryMode || !_settings.clickDiscoversRegion) return;
      if (!discoveryStateSingleton) return;

      // regionGraph:nodeSelected uses nodeId, ui:regionHeaderClicked uses regionName
      const regionName = eventData?.regionName || eventData?.nodeId;
      if (!regionName) return;

      if (!discoveryStateSingleton.isRegionDiscovered(regionName)) {
        log('info', `[Discovery Module] Discovering region via click: ${regionName}`);
        const wasNewlyDiscovered = discoveryStateSingleton.discoverRegion(regionName);
        if (wasNewlyDiscovered) {
          autoDiscoverLocationsInRegion(regionName);
          autoDiscoverExitsInRegion(regionName);
        }
      }
    };
}

/** apcalc at base: `m` = { gameState, panelInstance } (read at call time). */
export function legacyApcalc(m) {
    return (data) => {
        const nodeId = data?.nodeId;
        if (!nodeId) return;
        if (nodeId === 'C' && m.gameState) {
            m.gameState.reset();
            if (m.panelInstance) m.panelInstance.render();
        } else if (m.panelInstance) {
            m.panelInstance.setPathFilter(nodeId);
        }
    };
}

/** vibeCodingSim at base: `m` = { panelInstance } (read at call time). */
export function legacyVibe(m) {
    return (data) => {
        const nodeId = data?.nodeId;
        if (nodeId && m.panelInstance) {
            // Region names are like "Complete Node 3" — look up which feature this maps to
            // The graph_structure maps indices to feature IDs
            m.panelInstance.selectFeatureByRegion(nodeId);
        }
    };
}
