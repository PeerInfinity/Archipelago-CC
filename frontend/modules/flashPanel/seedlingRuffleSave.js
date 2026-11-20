/**
 * ⛓⛓ USE THE SAVE / CLEAR — **THE FLASH (RUFFLE) SEEDLING SAVE, `…/shrumsave`** (slice `ruffle-save-toggle-clear`,
 * ⚖ Robert 2026-11-19: "Same toggle + clear for Ruffle"). The JS runtime's switch and button (`seedlingJsSave.js`,
 * slice `js-save-toggle-clear`) for the save the Flash runtime's game keeps through Ruffle.
 *
 * ⛓ WHAT RUFFLE DOES (measured on the pinned Ruffle 0.7.1, `ruffleCdn.js`, with a probe SWF that does what Seedling's
 * `Main.begin` does — `SharedObject.getLocal("shrumsave")` at its first frame, then `flush()`; the report
 * `CC/docs/seedling-ruffle-save-toggle-clear.md` has the log):
 *  · The store is the HOST page's `window.localStorage` (Ruffle runs in the page, not in an iframe). Ruffle reads the
 *    `window.localStorage` getter ONCE, while it builds the player, and then uses that object with indexed access:
 *    `s[key]` (read), `s[key] = v` (write), `delete s[key]`. `Storage.prototype.getItem` is never called.
 *  · The key is `<host, no port>/<SWF URL path without its leading "/">/shrumsave`. The SWF URL's query is NOT in it.
 *  · Read: at the SWF's `getLocal`, i.e. its first frame, after the player is built and the SWF fetched.
 *  · Written: at once on `flush()`, AND (unflushed data too) when the player is removed from the page (synchronously,
 *    inside the removal) and when the page unloads.
 *  · Ruffle has no config that turns SharedObject persistence off, and no per-player storage hook.
 *
 * ⛓ THE MECHANISM — **MOVE THE SAVE ASIDE BEFORE THE PLAYER IS BUILT.** The panel calls `prepareRuffleSave` right
 * before it embeds the SWF (the old player was already removed by the teardown, so its own last write is in):
 *  · OFF: the stored save moves to an ASIDE key (`seedlingRuffleSaveAside_<the save key>`, JSON `{saved}`, `saved` =
 *    the stored string or null when there was none) and the save key is removed, so the SWF's `getLocal` finds
 *    nothing. While the aside key exists, whatever is under the save key was written by an OFF run and is thrown away
 *    — at the next boot (here) and, as a courtesy, when the panel removes the player (`endRuffleSaveRun`). Ruffle's
 *    own write at page unload can land after any handler of ours, so the next boot is what guarantees it: the SWF
 *    never sees an OFF run's save.
 *  · ON: if an aside key exists, the save it holds goes back under the save key (or the key is removed when it held
 *    none) and the aside key is removed. With no aside key, NOTHING is touched: today's behaviour, byte for byte.
 *  The aside key, not page memory, carries the state, so a crash, a killed tab or an unload in any order loses
 *  nothing: the next boot reads the same two keys and acts the same.
 *
 * ⛓ CLEAR — removes this page's save key and its aside key, nothing else. With a player running, the aside key is
 * instead set to `{saved: null}`: the running game keeps its progress in memory and Ruffle will write it at the
 * next flush or removal, and the marker makes the next boot throw that away (ON: "no save"; OFF: still none). That
 * is the JS button's "nothing more is written for this run".
 *
 * ⛓ ITS OWN SETTING (`flashPanel.seedlingRuffleSave`), not the JS one: a different save (one per site and SWF,
 * shared by every room and seed, vs one per room), a different runtime, and a different moment it acts (at the
 * game's next boot, vs at once).
 */
import { reportStorageWriteFailure } from '../../app/core/storageQuota.js';

/** The SharedObject name Seedling's `Main.begin` opens (`vendor/seedling/src/Main.as:44`). */
export const RUFFLE_SAVE_NAME = 'shrumsave';
export const RUFFLE_SAVE_ASIDE_PREFIX = 'seedlingRuffleSaveAside_';
/** The owner the Storage panel's quota notice names. */
export const RUFFLE_SAVE_OWNER = 'Flash Panel (Seedling Flash save)';
/** ⛓ USE THE SAVE — the setting (`moduleSettings.flashPanel.seedlingRuffleSave`), default OFF. */
export const RUFFLE_SAVE_SETTING_PROP = 'seedlingRuffleSave';
export const RUFFLE_SAVE_SETTING_KEY = `moduleSettings.flashPanel.${RUFFLE_SAVE_SETTING_PROP}`;
export const RUFFLE_SAVE_DEFAULT = false;

/** The schema prop (the Settings panel's row and the default's one source). */
export function ruffleSaveSchemaProps() {
    return {
        [RUFFLE_SAVE_SETTING_PROP]: {
            type: 'boolean',
            default: RUFFLE_SAVE_DEFAULT,
            label: 'Seedling Flash (Ruffle): use the save',
            description: "Runtime 'flash' (Ruffle) only. On: the game's own save (the Ruffle SharedObject "
                + "\"…/shrumsave\", one per site and SWF, shared by every room and seed) is read and written as the "
                + 'game always did. Off (the default): the game starts with no save and nothing it saves is kept; a save '
                + 'stored before is set aside, untouched, and comes back when this is turned on. A change takes effect at '
                + "the game's next load. The Flash panel's \"Clear the Flash save\" removes the stored save either way. "
                + 'Native Flash Player keeps its own save files, which this does not reach.',
        },
    };
}

/**
 * The localStorage key Ruffle keeps `name` under for the SWF at `swfUrl` (resolved against `baseUrl`):
 * `<hostname>/<path without its leading "/">/<name>`. Measured on Ruffle 0.7.1: the port and the query are not in it.
 * Null when the URL cannot be resolved.
 */
export function ruffleSaveKey(swfUrl, baseUrl, name = RUFFLE_SAVE_NAME) {
    if (!swfUrl) return null;
    let u;
    try { u = new URL(swfUrl, baseUrl); } catch { return null; }
    return `${u.hostname}/${u.pathname.replace(/^\//, '')}/${name}`;
}

/** The aside key of a save key. */
export function ruffleSaveAsideKey(key) {
    return `${RUFFLE_SAVE_ASIDE_PREFIX}${key}`;
}

function readAside(storage, key) {
    const raw = storage.getItem(ruffleSaveAsideKey(key));
    if (raw === null) return { present: false, saved: null };
    try {
        const v = JSON.parse(raw);
        return { present: true, saved: typeof v?.saved === 'string' ? v.saved : null };
    } catch {
        // unreadable marker: it still marks the save key as an OFF run's; the save it held is lost either way
        return { present: true, saved: null, unreadable: true };
    }
}

function defaultStorage() {
    return typeof localStorage !== 'undefined' ? localStorage : null;
}

/**
 * Before the player is built: make the save key hold what the switch says the SWF may see.
 * @returns {{action: string, key: string}} action: 'untouched' | 'restored' | 'restored-none' | 'set-aside' |
 *   'set-aside-none' | 'discarded-off-run' | 'kept-aside' | 'error' | 'no-storage' | 'no-key'
 */
export function prepareRuffleSave({ on, key, storage = defaultStorage(), log = () => {}, report = reportStorageWriteFailure }) {
    if (!key) return { action: 'no-key', key };
    if (!storage) return { action: 'no-storage', key };
    const asideKey = ruffleSaveAsideKey(key);
    try {
        const aside = readAside(storage, key);
        if (on) {
            if (!aside.present) {
                log(`[flash save] the save is on (Settings: "Use the save"): the game reads its save as always (${key})`);
                return { action: 'untouched', key };
            }
            if (aside.saved === null) storage.removeItem(key);
            else storage.setItem(key, aside.saved);
            storage.removeItem(asideKey);
            log(aside.saved === null
                ? `[flash save] the save is on: no save was set aside, so the game starts with none (${key})`
                : `[flash save] the save is on: the save set aside while it was off is back (${key})`);
            return { action: aside.saved === null ? 'restored-none' : 'restored', key };
        }
        if (aside.present) {
            const had = storage.getItem(key) !== null;
            storage.removeItem(key);
            log(`[flash save] the save is off (Settings: "Use the save"): the game starts with no save`
                + (had ? '; what the last run saved was thrown away' : '') + ` (the stored save stays set aside, ${asideKey})`);
            return { action: had ? 'discarded-off-run' : 'kept-aside', key };
        }
        const saved = storage.getItem(key);
        try {
            storage.setItem(asideKey, JSON.stringify({ saved }));
        } catch (err) {
            // ⛔ never remove the save before it is safely aside: this run sees it instead
            report?.({ key: asideKey, value: saved ?? '', error: err, owner: RUFFLE_SAVE_OWNER });
            log(`[flash save] the save is off, but it could not be set aside (${err?.message ?? err}): `
                + 'this run sees the stored save', 'error');
            return { action: 'error', key, error: err };
        }
        storage.removeItem(key);
        log(`[flash save] the save is off (Settings: "Use the save"): the game starts with no save`
            + (saved === null ? '' : `; the stored save is set aside until it is turned on (${asideKey})`));
        return { action: saved === null ? 'set-aside-none' : 'set-aside', key };
    } catch (err) {
        log(`[flash save] could not prepare the save: ${err?.message ?? err}`, 'error');
        return { action: 'error', key, error: err };
    }
}

/**
 * After the player is removed (its last write is in): an OFF run's save is thrown away now. A courtesy — the next
 * boot does the same, which is what holds when the page unloads first.
 * @returns {boolean} whether a save key was removed
 */
export function endRuffleSaveRun({ key, storage = defaultStorage() }) {
    if (!key || !storage) return false;
    try {
        if (!readAside(storage, key).present || storage.getItem(key) === null) return false;
        storage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

/**
 * The "Clear the Flash save" button: remove this page's save key and its aside key. `live` (a player is running):
 * the aside key becomes `{saved: null}` instead, so what the running game still writes is thrown away at the next
 * boot.
 * @returns {{removed: boolean, key: string|null, live?: boolean, error?: any, none?: string}}
 */
export function clearRuffleSave({ key, live = false, storage = defaultStorage(), log = () => {}, report = reportStorageWriteFailure }) {
    if (!key) {
        log('[flash save] no Flash game is configured, so there is no save to clear');
        return { removed: false, key: null, none: 'no-key' };
    }
    if (!storage) return { removed: false, key, none: 'no-storage' };
    const asideKey = ruffleSaveAsideKey(key);
    try {
        const aside = readAside(storage, key);
        const had = storage.getItem(key) !== null || (aside.present && aside.saved !== null);
        storage.removeItem(key);
        if (live) {
            try {
                storage.setItem(asideKey, JSON.stringify({ saved: null }));
            } catch (err) {
                report?.({ key: asideKey, value: '{"saved":null}', error: err, owner: RUFFLE_SAVE_OWNER });
                log(`[flash save] cleared the save (${key}), but the running game may write it again: `
                    + `${err?.message ?? err}`, 'error');
                return { removed: had, key, live, error: err };
            }
        } else {
            storage.removeItem(asideKey);
        }
        log(had ? `[flash save] cleared the Flash save (${key})` : `[flash save] there was no Flash save to clear (${key})`);
        if (live) {
            log('[flash save] the game running now keeps its progress until it is loaded again; nothing it saves '
                + 'from now on is kept');
        }
        return { removed: had, key, live };
    } catch (err) {
        log(`[flash save] could not clear the save: ${err?.message ?? err}`, 'error');
        return { removed: false, key, error: err };
    }
}
