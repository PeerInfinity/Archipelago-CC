/**
 * playbackBot/substrateLoopPlanner — **WHOSE PLAN A LOOP IS** (ActionNodes design §7; slice AN-3a).
 *
 * The loop runner (`loopModeRunner.js`) plans one target per loop from the sphere log (`loopDriver.js`). A substrate
 * registry entry may instead declare `loopBot.planLoop(context)`, the whole loop's plan. The runner asks it ONLY when
 * every region of the loaded world belongs to ONE substrate that declares it: every region but the world's declared
 * start regions (the scaffold's `Menu`, which carries no sidecar) has a sidecar naming that substrate. Any other
 * world — no sidecars, a mixed world, a substrate without the hook — gets null, and the runner plans exactly as
 * before.
 *
 * `planLoop(context)` returns `{kind, path, reason, lines, key}`: `kind` 'done' ends the run, 'unreachable' waits and
 * retries; any other kind is a loop whose `path` (gameState path entries) the runner writes as the queue, as it does
 * for its own plans. `lines` is the reasoning log.
 *
 * Pure: the registry is passed in.
 */

/**
 * @param {object|null} rulesJson
 * @param {string|number} playerId
 * @param {{get: (id: string) => object|undefined}} registry
 * @returns {{substrateId: string, planLoop: (context: object) => object}|null}
 */
export function substrateLoopPlannerOf(rulesJson, playerId, registry) {
    const p = String(playerId ?? '1');
    const regions = rulesJson?.regions?.[p];
    if (!regions || typeof regions !== 'object') return null;
    const starts = new Set(Array.isArray(rulesJson?.start_regions?.[p]) ? rulesJson.start_regions[p]
        : (rulesJson?.start_regions?.[p]?.default ?? []));
    const sidecars = rulesJson?.preset_sidecars?.[p] ?? {};
    let substrateId = null;
    let any = false;
    for (const name of Object.keys(regions)) {
        const sub = sidecars[name]?.substrate ?? null;
        if (!sub) {
            if (starts.has(name)) continue;
            return null;
        }
        if (substrateId !== null && sub !== substrateId) return null;
        substrateId = sub;
        any = true;
    }
    if (!any) return null;
    const planLoop = registry?.get?.(substrateId)?.loopBot?.planLoop;
    return typeof planLoop === 'function' ? { substrateId, planLoop } : null;
}
