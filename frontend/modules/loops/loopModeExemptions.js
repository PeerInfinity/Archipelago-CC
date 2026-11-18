/**
 * loopModeExemptions.js — classification of `source` tags that
 * mark a dispatcher event as PLANNING/AUTHORING rather than performed
 * play (M3b strict-gate exemption matrix; see
 * docs/json/developer/procgen/loop-recording.md).
 *
 * Consumers:
 *   - loops/loopState.evaluateActionGate — planning sources bypass the
 *     strict loop-mode action gate.
 *   - gameState handleRegionMove — planning sources keep their
 *     event-driven path append even in loop mode (the loop-mode
 *     always-append retirement applies to performed play only).
 *
 * Sources:
 *   - 'regionGraph-*'        — region-graph authoring clicks
 *     (addToPath / overwritePath / oneStep / direct move).
 *   - 'regionMap-*'          — the Region Map panel's clicks (region-map
 *     step 4): the same four shapes as the Region Graph's, through the
 *     shared regionView/regionActions.js (regionMap/regionMapClicks.js
 *     REGION_MAP_SOURCES), so they plan the same way.
 *   - 'regionView-path-*'    — the shared click actions' path moves
 *     (regionView/clickActions.js PATH_SOURCE_PREFIX; mode-toggle design
 *     R7): every map panel's built-in path action dispatches under
 *     'regionView-path-<panelId>', so the ACTION, not the panel, decides
 *     that a click plans. Panel-owned play actions (a Flash teleport) keep
 *     their own source and stay gated.
 *   - 'procgenPlayer-*'      — procgenPlayer's synthesized transitions
 *     (the initial Menu → first-region placement).
 *   - 'menuPanel-*'          — the menu panel's exit buttons, its
 *     skip-the-menu hop and its Restart teleport. Pressing an exit out
 *     of the start region is AUTHORING the path, exactly like a
 *     region-graph click: without this the strict gate would swallow
 *     the press whenever loop mode is on, and the path append would be
 *     dropped, so the queue would have nothing to run.
 */
export function isLoopModePlanningSource(source) {
    if (typeof source !== 'string') return false;
    return source.startsWith('regionGraph')
        || source.startsWith('regionMap')
        || source.startsWith('regionView-path')
        || source.startsWith('procgenPlayer')
        || source.startsWith('menuPanel');
}
