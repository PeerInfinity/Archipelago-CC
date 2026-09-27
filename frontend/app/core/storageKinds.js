/**
 * storageKinds — the vocabulary a module uses to DECLARE the localStorage keys it
 * owns (`moduleInfo.storage`), read by the Storage panel (modules/storagePanel).
 *
 * A declaration is one object, written on ONE line so the pins test
 * (modules/storagePanel/storageDeclarationPins.test.js) can read it from source:
 *
 *   storage: [
 *     { key: 'mazeRoom_params', kind: STORAGE_KINDS.state, label: 'Maze Room parameters' },
 *     { prefix: 'jtaBalance_patches_v1_', kind: STORAGE_KINDS.cache, label: 'Balance patches, one per seed' },
 *     { pattern: '/shrumsave$', kind: STORAGE_KINDS.user, label: 'Seedling save (Ruffle)' },
 *   ],
 *
 * Exactly one matcher: `key` (the whole key), `prefix` (a key family) or `pattern`
 * (a RegExp source, for keys whose start is not ours — e.g. Ruffle's
 * `<host>/<path>/<name>` SharedObjects). A module declares the keys of the game it
 * wraps as well as its own.
 *
 * Imports nothing, so any module (and settingsManager) can import it.
 */

export const STORAGE_KINDS = Object.freeze({
    /** Things the person made: game saves, saved queues, documents, presets. Never cleared in bulk. */
    user: 'user',
    /** Settings and panel state the app can rebuild (from defaults, or the next change). */
    state: 'state',
    /** Caches the app can rebuild by recomputing or refetching. */
    cache: 'cache',
});

/** Chromium's localStorage quota, in UTF-16 code units (key + value) per origin — measured, plan §37.1.2. */
export const LOCAL_STORAGE_QUOTA_CHARS = 5 * 1024 * 1024;
