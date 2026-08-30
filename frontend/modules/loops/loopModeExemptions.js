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
 *   - 'loops-costGenerator'  — cost-generation playback (drives the
 *     real queue machinery to measure costs).
 *   - 'procgenPlayer-*'      — procgenPlayer's synthesized transitions
 *     (the initial Menu → first-region placement).
 */
export function isLoopModePlanningSource(source) {
    if (typeof source !== 'string') return false;
    return source.startsWith('regionGraph')
        || source === 'loops-costGenerator'
        || source.startsWith('procgenPlayer');
}
