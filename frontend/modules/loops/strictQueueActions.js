/**
 * loops/strictQueueActions — **A SUBSTRATE'S DECLARED QUEUE VERBS, ENFORCED** (ActionNodes AN-1b; ⚖ Robert
 * 2026-11-16T19:59:48Z: "I don't want explore actions to be available in ActionNodes").
 *
 * `loopSupport.queueActions` lists which queue verbs a substrate's regions take. The Loops block builder has always
 * HIDDEN a control for a verb a region's entry does not list (the explore button), but nothing refused an entry that
 * arrived some other way (an undiscovered exit or location click, a script, a replayed queue). An entry that ALSO
 * declares `loopSupport.strictQueueActions: true` has its list enforced: a custom action (an explore, …) whose name the
 * list does not hold is refused at queue time (gameState's guard, installed by the loops module) and by the start gate.
 *
 * ⛔ OPT-IN. Only ActionNodes declares it. Every other substrate — those that list no explore as well — queues exactly
 * as before; `strictQueueActions.test.js` holds that over every registered entry.
 *
 * Pure: no registry, no DOM.
 */

/** The refusal code, at queue time and from the gate. */
export const ACTION_NOT_OFFERED = 'action-not-offered';

/**
 * Whether `loopSupport` refuses a custom action named `actionName`: `{ok: false, code, reason}`, or null.
 * @param {object|null} loopSupport - the region's substrate entry's `loopSupport`
 * @param {string} actionName - the custom action's name (`explore`, `act`, …)
 * @param {{substrateLabel?: string, region?: string}} [names] - for the reason text
 */
export function strictQueueRefusal(loopSupport, actionName, { substrateLabel = null, region = null } = {}) {
    if (!loopSupport || loopSupport.strictQueueActions !== true) return null;
    const offered = loopSupport.queueActions ?? [];
    if (offered.includes(actionName)) return null;
    const where = region ? ` (${region})` : '';
    return {
        ok: false,
        code: ACTION_NOT_OFFERED,
        reason: `${substrateLabel ?? 'this substrate'}${where} offers no '${actionName}' action: its queue verbs are ${offered.join(', ') || 'none'}`,
    };
}
