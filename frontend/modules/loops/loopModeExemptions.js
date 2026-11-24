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
 *   - 'regionMap-*'          — the Region Map panel's clicks as step 4
 *     sent them. Since CA-S3 its clicks run the shared click actions and
 *     carry 'regionView-path-regionMap' (below); the prefix is kept for
 *     older callers, as 'regionGraph*' is (mode-toggle design R7).
 *   - 'regionView-path-*'    — the shared click actions' path moves
 *     (regionView/clickActions.js PATH_SOURCE_PREFIX; mode-toggle design
 *     R7): every map panel's built-in path action dispatches under
 *     'regionView-path-<panelId>', so the ACTION, not the panel, decides
 *     that a click plans. Panel-owned play actions (a Flash teleport) keep
 *     their own source and stay gated.
 *   - 'actionNodes-plan-*'   — the ActionNodes click (`actionNodes.act`)
 *     and its card's "perform all remaining" button
 *     (actionNodes/nodeClickAction.js PLAN_SOURCE_PREFIX, slice AN-3b):
 *     in Loop mode they QUEUE the free hops to the node, then its acts.
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
        || source.startsWith('actionNodes-plan')
        || source.startsWith('procgenPlayer')
        || source.startsWith('menuPanel');
}
