/**
 * Saved-queue recorder for the text-adventure substrate.
 *
 * Subscribes to bridge-published events and buffers the player's current
 * region visit. One recording is active at a time (there's only one TA
 * panel) and it matches the player's current region in the engine.
 *
 * As of M2 the recorder no longer persists directly: loops is the sole
 * persister. On exit the finalized capture is stashed in a module-level
 * slot; loopState pulls it via the substrate registry's `takeLastRecording`
 * ONLY when a Record-mode block completes through its expected exit — so a
 * wrong exit / mana-out simply leaves the stash to be overwritten (and thus
 * discarded, per the M2 ruling). The persistent recording tag (arrivalKey,
 * ordinal) and rules-hash are stamped by loopState at persist time.
 *
 * Wiring (in textAdventureSubstrateWrapper/index.js initialize):
 *   const stopRecorder = startTextAdventureRecorder({ eventBus });
 *   // ... on module teardown:
 *   stopRecorder?.();
 *
 * Events consumed:
 *   - textAdventure:loadRegion (eventBus):
 *       Start a new recording for the loaded region. arrivalExitId is
 *       payload.arrivedFrom.exit_id; defaults to 'entrance'. Captures
 *       entry mana via gameState.getCurrentMana.
 *   - textAdventure:commandRecorded (eventBus, bridge-published):
 *       'regionMove' → finalize the current recording (stash) with
 *                      departureExitId = payload.exitName.
 *       'locationCheck' / 'explore' → append the action to the
 *                                     current recording's buffer.
 *   - gameState:manaChanged (eventBus):
 *       Update the rolling-minimum mana of the current recording.
 */

import { getGameStateSingleton } from '../gameState/singleton.js';

// Module-level pending stash — the last finalized visit recording,
// awaiting a loops pull. Overwritten by each new finalize; cleared on read.
let _lastRecording = null;

/**
 * Pull-and-clear the last finalized text-adventure visit recording.
 * loops' sole-persister protocol — exposed on the substrate registry as
 * `takeLastRecording`. Returns the stashed SavedQueue-shaped payload or null.
 */
export function takeLastTextAdventureRecording() {
    const rec = _lastRecording;
    _lastRecording = null;
    return rec;
}

export function startTextAdventureRecorder({ eventBus, moduleName = 'textAdventureSubstrateWrapper' } = {}) {
    if (!eventBus?.subscribe) return () => {};

    let visit = null; // { regionName, arrivalExitId, actions, manaAtEntry, manaMin }

    function getCurrentMana() {
        try {
            const gs = getGameStateSingleton();
            return typeof gs?.getCurrentMana === 'function' ? gs.getCurrentMana() : 0;
        } catch {
            return 0;
        }
    }

    function startVisit(regionName, arrivalExitId) {
        const manaAtEntry = getCurrentMana();
        visit = {
            regionName,
            arrivalExitId: arrivalExitId ?? 'entrance',
            actions: [],
            manaAtEntry,
            manaMin: manaAtEntry,
        };
    }

    function finalizeVisit(departureExitId) {
        if (!visit) return;
        const rec = visit;
        visit = null;
        const manaAtExit = getCurrentMana();
        const locationsChecked = rec.actions
            .filter((a) => a.type === 'locationCheck' && a.locationName)
            .map((a) => a.locationName);
        _lastRecording = {
            regionName: rec.regionName,
            substrate: 'text_adventure',
            arrivalExitId: rec.arrivalExitId,
            departureExitId: departureExitId ?? null,
            actions: rec.actions,
            manaAtEntry: rec.manaAtEntry,
            manaAtExit,
            manaMin: rec.manaMin,
            locationsChecked,
            itemsPickedUp: [],
        };
    }

    const onLoadRegion = (payload) => {
        // Discard any stale recording (loop reset, panel mid-cycle teardown)
        // — we couldn't finalize it cleanly without a departure exit.
        if (visit) visit = null;
        startVisit(payload?.region_id, payload?.arrivedFrom?.exit_id);
    };

    const onCommandRecorded = (cmd) => {
        if (!visit || !cmd?.type) return;
        if (cmd.type === 'regionMove') {
            if (cmd.sourceRegion !== visit.regionName) return; // not us
            finalizeVisit(cmd.exitName ?? null);
            return;
        }
        if (cmd.regionName && cmd.regionName !== visit.regionName) return;
        if (cmd.type === 'locationCheck') {
            visit.actions.push({
                type: 'locationCheck',
                locationName: cmd.locationName,
            });
        } else if (cmd.type === 'explore') {
            visit.actions.push({
                type: 'explore',
                regionName: cmd.regionName,
            });
        }
    };

    const onManaChanged = () => {
        if (!visit) return;
        const cur = getCurrentMana();
        if (typeof cur === 'number' && cur < visit.manaMin) {
            visit.manaMin = cur;
        }
    };

    eventBus.subscribe('textAdventure:loadRegion', onLoadRegion, moduleName);
    eventBus.subscribe('textAdventure:commandRecorded', onCommandRecorded, moduleName);
    eventBus.subscribe('gameState:manaChanged', onManaChanged, moduleName);

    return function stop() {
        eventBus.unsubscribe?.('textAdventure:loadRegion', onLoadRegion, moduleName);
        eventBus.unsubscribe?.('textAdventure:commandRecorded', onCommandRecorded, moduleName);
        eventBus.unsubscribe?.('gameState:manaChanged', onManaChanged, moduleName);
        visit = null;
    };
}
