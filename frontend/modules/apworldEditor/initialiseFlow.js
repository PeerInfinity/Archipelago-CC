/**
 * apworldEditor/initialiseFlow — **WHAT THE "INITIALISE PROCGEN DATA" FORM SAYS
 * AND SENDS**, as pure functions (APWORLD SUBSTRATE CHANGE R7; plan §19, ⚖ user
 * 2026-09-26).
 *
 * The door: a slot with NO sidecar entry (the Map tab's *"No map for this
 * world"* state and the Sidecars tab's empty list) offers **Initialise procgen
 * data ▸**, which opens one form — the substrate (the realiser targets, default
 * the engine's `DEFAULT_SUBSTRATE_ID`), the grid side (auto, editable), the
 * seed, **Add return exits** (default ON, ⚖ #1) — with a PREVIEW line re-planned
 * on every change (`planInitialise`, the layout only) and **Generate ▸**, which
 * runs `initialiseSlot` in the generation worker under
 * `initialiseTimeoutSeconds` and lands ONE `initialise-procgen-layout` with the
 * result inline.
 *
 * ⛔ **THE OP IS THE AUTHORITY, THE FORM A COURTESY** (1305): the refusal the form
 * prints is the op's own (`initialiseOpRefusal`), and the answer to a landed
 * Generate is the op's own description. ⛔ No substrate is named here.
 */

import { initialiseOpRefusal } from './rulesDocOps.js';
import {
    BACK_EXITS, DEFAULT_SUBSTRATE_ID, INITIALISE_FIRST_SEED, autoGridSide, initialiseFacts,
    initialiseTargets, planInitialise,
} from './slotInitialise.js';
import {
    INITIALISE_JOB, REGION_GENERATION_CANCELLED, initialiseTimeoutSentence, regionGenerationLoadTimeoutSentence,
} from './regionGenerationRun.js';

/** ⛓ The door's words, one place (the Map tab and the Sidecars tab draw the same button). */
export const INITIALISE_DOOR_LABEL = 'Initialise procgen data ▸';

/**
 * ⛓ Does the slot get the door? — a BARE slot that has regions. A bare slot the
 * op would still refuse (no start; a document-level metadata block) gets the
 * door, and the form prints the op's sentence with no Generate.
 */
export function initialiseDoorShown(doc, player) {
    const f = initialiseFacts(doc, player);
    return f.bare && f.regions > 0;
}

/**
 * ⛓ The form's state when it opens: the default substrate (the engine's), the
 * AUTO grid side for it, the first seed, return exits ON (⚖ #1).
 */
export function initialiseFormDefaults(doc, player) {
    const targets = initialiseTargets();
    const substrate = targets.includes(DEFAULT_SUBSTRATE_ID) ? DEFAULT_SUBSTRATE_ID : (targets[0] ?? DEFAULT_SUBSTRATE_ID);
    const state = { substrate, seed: INITIALISE_FIRST_SEED, backExits: BACK_EXITS.ADD, sideAuto: true, side: null };
    return withAutoSide(doc, player, state);
}

/** ⛓ While the side is AUTO, it follows the substrate and the seed (the layout draws on the seed). */
export function withAutoSide(doc, player, state) {
    if (!state.sideAuto) return state;
    const { side } = autoGridSide(doc, player, { substrate: state.substrate, seed: state.seed, backExits: state.backExits });
    return { ...state, side };
}

/** ⛓ The op's (and the worker job's) arguments for the form's state. */
export function initialiseArgs(player, state) {
    return {
        player: String(player),
        substrate: state.substrate,
        gridDims: { width: state.side, height: state.side },
        seed: state.seed,
        backExits: state.backExits,
    };
}

/** ⛓ The worker job for the form's state: the args, the document, the job kind. */
export function initialiseJob(doc, player, state) {
    return { job: INITIALISE_JOB, doc, ...initialiseArgs(player, state) };
}

/**
 * ⛓⛓ **THE PREVIEW** — the op's refusal when it would refuse (the form then
 * draws no Generate), else the layout's plan and its sentence:
 * *"81 regions placed on 13×13, 53 teleporters; 80 return exits will be added;
 * 0 unplaceable"*, the unplaceable NAMED with their why when any.
 *
 * @returns {{refusal: string|null, plan: object|null, text: string}}
 */
export function initialisePreview(doc, player, state) {
    const args = initialiseArgs(player, state);
    const refusal = initialiseOpRefusal(doc, args);
    if (refusal) return { refusal, plan: null, text: refusal };
    const plan = planInitialise(doc, args.player, args);
    if (!plan.ok) return { refusal: `apworld: the layout threw — ${plan.threw}`, plan: null, text: plan.threw };
    const back = state.backExits === BACK_EXITS.NONE
        ? 'no return exits (off)'
        : `${plan.returnExits} return exit${plan.returnExits === 1 ? '' : 's'} will be added`;
    const names = plan.unplaced.length
        ? `: ${plan.unplaced.map((u) => `${u.region} (${u.why})`).join(', ')}` : '';
    return {
        refusal: null,
        plan,
        text: `${plan.placed} region${plan.placed === 1 ? '' : 's'} placed on ${args.gridDims.width}×${args.gridDims.height}, `
            + `${plan.teleporters} teleporter${plan.teleporters === 1 ? '' : 's'}; ${back}; `
            + `${plan.unplaced.length} unplaceable${names}`,
    };
}

/**
 * ⛓ The ticker's words: *"built 120 / 445 · 12.3 s of 300"* — or the library
 * load while the worker starts.
 */
export function initialiseTickerText({ phase, elapsedS, budgetS, progress }) {
    if (phase === 'loading') return `Loading the substrate libraries… ${elapsedS.toFixed(1)} s`;
    const built = progress && Number.isInteger(progress.index) ? `built ${progress.index} / ${progress.total} · ` : '';
    return `${built}${elapsedS.toFixed(1)} s of ${budgetS}`;
}

/**
 * ⛓⛓ **THE ANSWER TO A GENERATE THAT DID NOT LAND** — the worker's or the
 * realiser's own words. A result that CAN land is answered by the landed op's
 * description (the panel's), so `{landed: true, text: null}`.
 */
export function initialiseAnswer(args, res, budgetS, lastProgress = null) {
    if (res.ok) return { landed: true, text: null };
    if (res.timedOut && res.phase === 'loading') {
        return { landed: false, text: regionGenerationLoadTimeoutSentence(res.budgetMs) };
    }
    if (res.timedOut) {
        return { landed: false, text: initialiseTimeoutSentence(budgetS, args.substrate, args.player, lastProgress) };
    }
    if (res.cancelled) return { landed: false, text: `apworld: ${REGION_GENERATION_CANCELLED}.` };
    if (res.unavailable || res.workerFailed) return { landed: false, text: `apworld: ${res.threw}` };
    return {
        landed: false,
        text: `apworld: the \`${args.substrate}\` realiser threw${res.region ? ` on region "${res.region}"` : ''} — `
            + `${res.why ?? res.threw}. Nothing was recorded.`,
    };
}
