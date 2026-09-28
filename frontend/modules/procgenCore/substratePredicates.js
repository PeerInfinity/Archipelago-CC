/**
 * procgenCore/substratePredicates — **WHAT A REGISTRY ENTRY LETS THE APP DO,
 * ONE FUNCTION PER QUESTION** (substrate chart S1, plan §1 pin 4).
 *
 * These are the app's OWN capability predicates — the ones that decide whether
 * a loops radio button, a hub Initialise target or a sphere override exists —
 * lifted out of the classes that used to hold them so the user-facing
 * capability chart (`substrateCapabilities.js`) can call the SAME function. A
 * chart cell and a control answered by one function cannot disagree.
 *
 *   `regionRealiserKind`  from `apworldEditor/regionRegenerate.js` (which
 *                         re-exports it for its importers)
 *   `captureShapeOf`      the body of `loopState._captureShapeFor`
 *   `solverKindOf`        the ENTRY half of `loopState.regionSolver` (the
 *                         region's `manaEnabled` half stays there)
 *   `offersPlayback`      the body of `loopState._regionOffersPlayback`
 *   `botHonorsInstant`    `loopState.regionBotHonorsInstant`, on the entry
 *
 * ⛔ PURE AND BROWSER-SAFE: every function takes an ENTRY (or `null`/`undefined`
 * for "no substrate") and reads only its declared fields. No registry import,
 * no substrate name, no event — the caller looks the entry up.
 */

/** ⛓ The realiser kinds, as data. `null` = the entry has none. */
export const REALISER_KINDS = Object.freeze({ PROCEDURAL: 'procedural', ZONE: 'zone' });

/**
 * ⛓⛓ **DOES THIS REGISTRY ENTRY BUILD A REGION FROM A SPEC?** The engine's own
 * dispatch (`generateRegionGen`: `generateRegionCore` first, else a zone
 * generator) and the pipeline's `_sphereCapableSubstrates` test — the same three
 * slots, so the hub offers exactly the targets the pipeline realises.
 *
 * @returns {'procedural'|'zone'|null}
 */
export function regionRealiserKind(entry) {
    if (typeof entry?.generateRegionCore === 'function') return REALISER_KINDS.PROCEDURAL;
    if (typeof entry?.generateZoneForSpecs === 'function'
        || typeof entry?.generateZoneForSpecsGen === 'function') return REALISER_KINDS.ZONE;
    return null;
}

/** ⛓ The loop-mode capture shapes (see `captureShapeOf`). */
export const CAPTURE_SHAPES = Object.freeze({ FINE: 'fine', SUMMARY: 'summary', COARSE: 'coarse' });

/**
 * ⛓⛓ **THE ENTRY'S CAPTURE SHAPE** — the single rule every shape-dependent
 * loops branch goes through (`loop-recording.md`):
 *
 *   'fine'    — the entry supplies `takeLastRecording`: the substrate captures
 *               and replays a full action stream and charges its own economy.
 *   'summary' — `loopSupport.summaryRecording`: the recording is the NET
 *               RESULT of the visit and Playback applies it instantly.
 *   'coarse'  — everything else, and no entry at all: the block's own queued
 *               interior IS the recording.
 *
 * The fine check wins if an entry declared both — a real recorder is the
 * stronger contract.
 *
 * @returns {'fine'|'summary'|'coarse'}
 */
export function captureShapeOf(entry) {
    if (typeof entry?.takeLastRecording === 'function') return CAPTURE_SHAPES.FINE;
    if (entry?.loopSupport?.summaryRecording) return CAPTURE_SHAPES.SUMMARY;
    return CAPTURE_SHAPES.COARSE;
}

/** ⛓ The Bot-block solver kinds (see `solverKindOf`). `null` = none. */
export const SOLVER_KINDS = Object.freeze({ WALK_TO: 'walkTo', DELEGATION: 'delegation' });

/**
 * ⛓⛓ **WHICH SOLVER THE ENTRY DECLARES** for a Bot block — its half of
 * `loopState.regionSolver`:
 *
 *   'walkTo'     — `loopSupport.executeVia: 'solver'`: loops drives the
 *                  PlaybackController's `walkTo`.
 *   'delegation' — `sharing.mana.loopActionDelegation`: the substrate walks the
 *                  action itself. ⚠ A REGION additionally needs `manaEnabled`
 *                  for this to engage; that half is the region's, not the
 *                  entry's, and stays in `regionSolver`.
 *
 * walkTo wins if an entry ever declared both.
 *
 * @returns {'walkTo'|'delegation'|null}
 */
export function solverKindOf(entry) {
    if (entry?.loopSupport?.executeVia === 'solver') return SOLVER_KINDS.WALK_TO;
    if (entry?.sharing?.mana?.loopActionDelegation === true) return SOLVER_KINDS.DELEGATION;
    return null;
}

/**
 * ⛓ Whether the entry's regions "auto-run today" and can therefore offer the
 * Playback radio: any real `loopSupport` declaration (manual play, a queueable
 * action, or a solver).
 */
export function offersPlayback(entry) {
    const ls = entry?.loopSupport ?? null;
    return !!ls && (ls.manual || (ls.queueActions?.length > 0) || !!ls.executeVia);
}

/**
 * ⛓ Whether a Bot block on the entry's regions can honour the Instant flag:
 * `loopSupport.instant` ∧ the walkTo solver ∧ a fine capture shape (the
 * reasons the other combinations are out live on `loopState.
 * regionBotHonorsInstant`).
 */
export function botHonorsInstant(entry) {
    if (!entry?.loopSupport?.instant) return false;
    if (solverKindOf(entry) !== SOLVER_KINDS.WALK_TO) return false;
    return captureShapeOf(entry) === CAPTURE_SHAPES.FINE;
}
