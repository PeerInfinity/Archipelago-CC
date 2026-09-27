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
 * ⛓ S2 — the form also carries the GENERATION SETTINGS: a bag of the target's
 * own `defaultProcgenParams` plus the region size (`regionSizeFor`), drawn by
 * R1's `renderRegionGenerationForm` (the pipeline's and R2's form), handed to
 * the build (`initialiseKnobs(substrate, bag)`, the layout's size) and recorded
 * in the op's `provenance`. A substrate change RESETS the bag to the new
 * target's defaults and keeps the size (`initialiseBagFor`).
 *
 * ⛓ S3 — **LOOP MODE** (a checkbox, OFF by default like the pipeline's
 * `enableLoopMode`) and its **XP effect** (the generator's own values). On, the
 * job carries the page's sphere log (`sphereState`'s raw entries) and the op
 * writes `loop_costs` and `manaEnabled` on every payload. The toggle is drawn
 * DISABLED with the op's own sentence when no log is reachable
 * (`initialiseLoopToggle`). Off, the args carry no `loopMode` at all, so the op,
 * its record and the document are the pre-S3 bytes.
 *
 * ⛔ **THE OP IS THE AUTHORITY, THE FORM A COURTESY** (1305): the refusal the form
 * prints is the op's own (`initialiseOpRefusal`), and the answer to a landed
 * Generate is the op's own description. ⛔ No substrate is named here.
 */

import {
    INITIALISE_LOOP_MODE_ON, initialiseFailureSentence, initialiseOpRefusal, initialiseSphereLogRefusal,
} from './rulesDocOps.js';
import {
    BACK_EXITS, DEFAULT_REGION_XP_EFFECT, DEFAULT_SUBSTRATE_ID, INITIALISE_FIRST_SEED, INITIALISE_SIZE_KEYS,
    SPHERE_LOG_SOURCE, autoGridSide, initialiseFacts, initialiseRegionSize, initialiseSphereLog, initialiseTargets,
    planInitialise,
} from './slotInitialise.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
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
 * ⛓⛓ S2 — **THE SETTINGS BAG FOR A TARGET**: its own `defaultProcgenParams`
 * and the region size — `previous`'s when given (a substrate change keeps the
 * size the reader set), else the slot's (`regionSizeFor`). Every other key of
 * `previous` is DROPPED: one target's knobs are nonsense to another.
 */
export function initialiseBagFor(doc, player, substrate, previous = null) {
    const size = initialiseRegionSize(doc, String(player), previous);
    return {
        ...(substrateRegistry.get(substrate)?.defaultProcgenParams ?? {}),
        [INITIALISE_SIZE_KEYS.width]: size.width,
        [INITIALISE_SIZE_KEYS.height]: size.height,
    };
}

/**
 * ⛓ The form's state when it opens: the default substrate (the engine's), its
 * settings bag, the AUTO grid side for it, the first seed, return exits ON (⚖ #1).
 */
export function initialiseFormDefaults(doc, player) {
    const targets = initialiseTargets();
    const substrate = targets.includes(DEFAULT_SUBSTRATE_ID) ? DEFAULT_SUBSTRATE_ID : (targets[0] ?? DEFAULT_SUBSTRATE_ID);
    const state = {
        substrate, seed: INITIALISE_FIRST_SEED, backExits: BACK_EXITS.ADD, sideAuto: true, side: null,
        bag: initialiseBagFor(doc, player, substrate),
        // ⛓ S3 — OFF by default (the pipeline's `enableLoopMode: false`).
        loopMode: { enabled: false, regionXpEffect: DEFAULT_REGION_XP_EFFECT },
    };
    return withAutoSide(doc, player, state);
}

/**
 * ⛓ A form change: `patch` over the state — a CHANGED substrate resets the bag
 * (`initialiseBagFor`, the size kept) — then the auto side.
 */
export function withInitialisePatch(doc, player, state, patch) {
    const next = { ...state, ...patch };
    if (patch.substrate !== undefined && patch.substrate !== state.substrate && patch.bag === undefined) {
        next.bag = initialiseBagFor(doc, player, patch.substrate, state.bag);
    }
    return withAutoSide(doc, player, next);
}

/** ⛓ While the side is AUTO, it follows the substrate, the seed and the region size (the layout reads all three). */
export function withAutoSide(doc, player, state) {
    if (!state.sideAuto) return state;
    const { side } = autoGridSide(doc, player, {
        substrate: state.substrate, seed: state.seed, backExits: state.backExits, bag: state.bag,
    });
    return { ...state, side };
}

/**
 * ⛓ The op's (and the worker job's) arguments for the form's state. S3: loop
 * mode rides only when it is ON — off, the args are the pre-S3 args exactly.
 */
export function initialiseArgs(player, state) {
    return {
        player: String(player),
        substrate: state.substrate,
        gridDims: { width: state.side, height: state.side },
        seed: state.seed,
        backExits: state.backExits,
        // ⛓ S2 — a COPY: the form's controls keep writing the bag they were drawn on.
        ...(state.bag !== undefined ? { bag: { ...state.bag } } : {}),
        ...(state.loopMode?.enabled === true ? { loopMode: { ...state.loopMode } } : {}),
    };
}

/** ⛓ The page's sphere-log entries when they are a non-empty list, else null (the precedence's first rung). */
const pageEntries = (pageLog) => (Array.isArray(pageLog) && pageLog.length > 0 ? pageLog : null);

/**
 * ⛓ The worker job for the form's state: the args, the document, the job kind —
 * and (S3, loop mode on) the page's sphere-log entries AS DATA (the worker has
 * no `sphereState`; the document it is handed carries its own embedded log).
 */
export function initialiseJob(doc, player, state, pageLog = null) {
    const args = initialiseArgs(player, state);
    const log = args.loopMode ? pageEntries(pageLog) : null;
    return { job: INITIALISE_JOB, doc, ...args, ...(log ? { sphereLog: log } : {}) };
}

/**
 * ⛓⛓ S3 — **CAN THE LOOP-MODE TOGGLE BE TURNED ON?** — the op's own sphere-log
 * refusal asked as if it were on: `{refusal, source, entries}`, `refusal` null
 * when a log is reachable (`source` = `SPHERE_LOG_SOURCE`'s page / embedded).
 */
export function initialiseLoopToggle(doc, player, pageLog = null) {
    const refusal = initialiseSphereLogRefusal(doc, {
        player: String(player), loopMode: { enabled: true }, sphereLog: pageEntries(pageLog),
    });
    const log = initialiseSphereLog(doc, player, pageEntries(pageLog));
    return { refusal, source: log.source, entries: log.entries ? log.entries.length : 0 };
}

/**
 * ⛓⛓ **THE PREVIEW** — the op's refusal when it would refuse (the form then
 * draws no Generate), else the layout's plan and its sentence:
 * *"81 regions placed on 13×13, 53 teleporters; 80 return exits will be added;
 * 0 unplaceable"*, the unplaceable NAMED with their why when any — and, when
 * the layout stripped a Menu (M2), *"; Menu: 13 exits → 13 roots"*.
 *
 * @returns {{refusal: string|null, plan: object|null, text: string}}
 */
export function initialisePreview(doc, player, state, pageLog = null) {
    const args = initialiseArgs(player, state);
    const refusal = initialiseOpRefusal(doc, args)
        ?? initialiseSphereLogRefusal(doc, { ...args, sphereLog: pageEntries(pageLog) });
    if (refusal) return { refusal, plan: null, text: refusal };
    const plan = planInitialise(doc, args.player, args);
    if (!plan.ok) return { refusal: `apworld: the layout threw — ${plan.threw}`, plan: null, text: plan.threw };
    const back = state.backExits === BACK_EXITS.NONE
        ? 'no return exits (off)'
        : `${plan.returnExits} return exit${plan.returnExits === 1 ? '' : 's'} will be added`;
    const names = plan.unplaced.length
        ? `: ${plan.unplaced.map((u) => `${u.region} (${u.why})`).join(', ')}` : '';
    // ⛓ M2 — the HUB (R8): a stripped Menu's exits each feed a root; say how
    // many exits and how many roots got a cell (they differ by the shortage).
    const hub = plan.menu
        ? `; ${plan.menu}: ${plan.menuExits} exit${plan.menuExits === 1 ? '' : 's'} → `
            + `${plan.menuRoots.length} root${plan.menuRoots.length === 1 ? '' : 's'}`
        : '';
    // ⛓ S3 — which log loop mode will price from.
    const loop = args.loopMode
        ? `; ${INITIALISE_LOOP_MODE_ON} (${args.loopMode.regionXpEffect}), priced from the `
            + `${initialiseSphereLog(doc, args.player, pageEntries(pageLog)).source === SPHERE_LOG_SOURCE.PAGE ? 'loaded' : 'embedded'} sphere log`
        : '';
    return {
        refusal: null,
        plan,
        text: `${plan.placed} region${plan.placed === 1 ? '' : 's'} placed on ${args.gridDims.width}×${args.gridDims.height}, `
            + `${plan.teleporters} teleporter${plan.teleporters === 1 ? '' : 's'}; ${back}; `
            + `${plan.unplaced.length} unplaceable${names}${hub}${loop}`,
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
        text: `${initialiseFailureSentence(args.substrate, { ...res, why: res.why ?? res.threw })} Nothing was recorded.`,
    };
}
