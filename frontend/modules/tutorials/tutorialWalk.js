/**
 * tutorialWalk.js — playing a whole tutorial the way its in-app walk row does,
 * and THE RATCHET that grades the result against the tutorial's record.
 *
 * ⚖ The user, 2026-10-10: every tutorial is written now, finished feature or
 * not; an in-progress one records the first step that does not work yet
 * (`firstFailingStep`, tutorialShape.js). Its walk row then:
 *   - FAILS when an EARLIER step fails — a regression;
 *   - FAILS when the recorded step now works — move the record on (or mark
 *     the tutorial ready), so it cannot quietly go stale;
 *   - passes when the walk ends exactly at the recorded step.
 *
 * An OUTSIDE step (a terminal command) that has no `standIn` ends the walk
 * as a STOP, not a failure (⚖ design check A2, 2026-10-10): the test cannot
 * run a terminal. It is recorded in `firstFailingStep` the same way, and the
 * verdict names it as a stop.
 *
 * Pure: the walk is handed the functions that perform a step, so the loop and
 * the verdict are unit-tested in node; the in-app row hands it the panel's.
 */
import { panelSteps } from './tutorialShape.js';

/**
 * Walk every step the panel walks, in order.
 *   perform(entry)  performs an in-app step (throws when it cannot)
 *   standIn(entry)  runs an outside step's stand-in
 *   waitDone(entry) resolves true once the step's `done` holds (true at once
 *                   for a step with no `done`)
 * → { end: 'complete' } | { end: 'failed' | 'stopped', index, stepId, why }
 */
export async function walkTutorial(tutorial, { perform, standIn, waitDone, onStep }) {
    const steps = panelSteps(tutorial);
    for (const entry of steps) {
        const { step, index } = entry;
        onStep?.(entry);
        const at = (end, why) => ({ end, index, stepId: step.id, why });
        if (step.outside && !step.standIn) return at('stopped', 'an outside step with no stand-in');
        try {
            if (step.outside) await standIn(entry);
            else await perform(entry);
        } catch (e) {
            return at('failed', e?.message ?? String(e));
        }
        let done = false;
        try { done = await waitDone(entry); } catch (e) { return at('failed', `done check threw: ${e?.message ?? e}`); }
        if (!done) return at('failed', 'its done check never held');
    }
    return { end: 'complete' };
}

function describe(tutorial, outcome) {
    if (outcome.end === 'complete') return 'every step works';
    const n = panelSteps(tutorial).length;
    const verb = outcome.end === 'stopped' ? 'stops' : 'fails';
    return `${verb} at step ${outcome.index + 1} of ${n} (${outcome.stepId}): ${outcome.why}`;
}

/**
 * Grade a walk against the tutorial's record → { ok, message }.
 * `ready` must complete. `in-progress` must end exactly at
 * `firstFailingStep` (null = it must complete).
 */
export function ratchetVerdict(tutorial, outcome) {
    const now = describe(tutorial, outcome);
    if (tutorial.status === 'ready') {
        return outcome.end === 'complete'
            ? { ok: true, message: `ready: ${now}` }
            : { ok: false, message: `ready, but it ${now}` };
    }
    const steps = panelSteps(tutorial);
    const recorded = tutorial.firstFailingStep;
    const recordedIndex = recorded === null ? steps.length : steps.findIndex(({ step }) => step.id === recorded);
    const reached = outcome.end === 'complete' ? steps.length : outcome.index;
    if (reached === recordedIndex) {
        return { ok: true, message: `in progress, as recorded: ${now}` };
    }
    if (reached < recordedIndex) {
        const was = recorded === null ? 'every step worked' : `the record says step ${recordedIndex + 1} (${recorded})`;
        return { ok: false, message: `REGRESSION: it ${now}; ${was}` };
    }
    const next = outcome.end === 'complete' ? 'null (or mark it ready)' : `'${outcome.stepId}'`;
    return {
        ok: false,
        message: `the record is STALE: step ${recordedIndex + 1} (${recorded}) works now, and it ${now}. `
            + `Set firstFailingStep to ${next}.`,
    };
}
