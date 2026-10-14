/**
 * Play a test's Playback Bot run faster, and put everything back after.
 * ⚖ (user, 2026-10-14): "Can we make the tests increase the game speed? Some of the substrates have ways to increase
 * their speed, or an instant mode." Standing: the person's speed settings are kept; tests may use instant mode.
 *
 *  - INSTANT BLOCKS: every Loops block whose Bot honours Instant (`loopState.regionBotHonorsInstant`: the walkTo
 *    solvers on a fine substrate — jta, omsi) gets its per-block Instant flag. The global `loopState.setInstantMode`
 *    the rows already set does NOT reach these walks: `_handleBotExecutedAction` passes only the BLOCK's flag to the
 *    controller's `instant()`, both ways, so a global-instant run walks JtA at the clock's own pace. The bot's loop
 *    runner writes a fresh queue every loop, so the flags are set again on every `loopState:queueUpdated`.
 *  - NOIZ2SA has no Bot × Instant (a summary substrate plays real-time physics) but has the Bot speed setting: 4× for
 *    the run. Mana is charged per game second, so the run's costs are unchanged.
 *
 * Neither touches the person's SAVED settings: Instant flags set here are removed again (only the ones this set), and
 * Noiz2sa's speed is applied to the trainer service in memory and restored from the saved setting.
 */
import { resolveQueueBlocks } from '../loops/blockIdentity.js';

export const TEST_NOIZ2SA_BOT_SPEED = 4;
const NOIZ2SA_BOT_SPEED_KEY = 'moduleSettings.noiz2saSubstrate.botSpeed';

/**
 * Start the speed-up. → `restore()` (async), which undoes it. Dependencies are injected so the logic is unit-tested:
 * `eventBus` ({subscribe, unsubscribe}), `getLoopState()`, `getNoiz2saService()` (→ the trainer service or null),
 * `readSavedSetting(key, fallback)` (async).
 */
export function startBotTestSpeed({ eventBus, getLoopState, getNoiz2saService = () => null, readSavedSetting = null }) {
    const mine = new Map(); // blockKey → {region, instance}: the Instant flags this set
    let noiz2saBefore = null;

    const apply = () => {
        const loopState = getLoopState?.();
        if (loopState?.getActionQueue) {
            const { visits } = resolveQueueBlocks(loopState.getActionQueue());
            for (const { name, instance } of visits) {
                if (!loopState.regionBotHonorsInstant?.(name)) continue;
                if (loopState.getBlockInstant(name, instance)) continue;
                loopState.setBlockInstant(name, instance, true);
                mine.set(`${name}#${instance}`, { region: name, instance });
            }
        }
        // Re-applied on every queue write: a module enabled mid-run (a tutorial's Modules step) reads its saved
        // settings when it initialises.
        const service = getNoiz2saService?.();
        if (service?.settings && service.settings.botSpeed !== TEST_NOIZ2SA_BOT_SPEED) {
            if (noiz2saBefore === null) noiz2saBefore = service.settings.botSpeed;
            service.applySettings({ botSpeed: TEST_NOIZ2SA_BOT_SPEED });
        }
    };
    apply();
    eventBus.subscribe('loopState:queueUpdated', apply, 'tests');

    return async function restore() {
        eventBus.unsubscribe('loopState:queueUpdated', apply, 'tests');
        const loopState = getLoopState?.();
        for (const { region, instance } of mine.values()) loopState?.setBlockInstant?.(region, instance, false);
        mine.clear();
        const service = getNoiz2saService?.();
        if (service?.settings && noiz2saBefore !== null) {
            let speed = noiz2saBefore;
            if (readSavedSetting) {
                try { speed = await readSavedSetting(NOIZ2SA_BOT_SPEED_KEY, noiz2saBefore); } catch { /* the in-memory value */ }
            }
            service.applySettings({ botSpeed: speed });
        }
    };
}

/** The app's own dependencies, for the in-app rows. */
export async function startAppBotTestSpeed() {
    const [{ default: eventBus }, { centralRegistry }, { default: settingsManager }, noiz2sa] = await Promise.all([
        import('../../app/core/eventBus.js'),
        import('../../app/core/centralRegistry.js'),
        import('../../app/core/settingsManager.js'),
        import('../noiz2saSubstrate/index.js'),
    ]);
    return startBotTestSpeed({
        eventBus,
        getLoopState: () => {
            try { return centralRegistry.getPublicFunction('loops', 'getLoopState')?.() ?? null; } catch { return null; }
        },
        // Only while the module is on: an off module's trainer is not the page's to touch.
        getNoiz2saService: () => {
            try {
                const on = window.moduleManagerApi?.getAllModuleStates?.()?.[noiz2sa.moduleInfo.name]?.enabled === true;
                return on ? noiz2sa.getTrainerService() : null;
            } catch { return null; }
        },
        readSavedSetting: (key, fallback) => settingsManager.getSetting(key, fallback),
    });
}
