/**
 * profileBoot — the page's `?profile=<url>`: install a physics profile
 * override BEFORE the page's model evaluates (engine-prep R1).
 *
 * `seedlingProfile.js` reads `globalThis.__SEEDLING_PROFILE__` once, when it
 * evaluates, and every module that copies a constant out of it copies it at
 * ITS load. A page that imports its entry statically has evaluated the whole
 * model before any of its own code runs, so nothing on the page could set the
 * global in time. This bootstrap is what the page's `<script>` imports
 * instead: it reads `?profile=`, fetches the file's JSON TEXT (the text, so the
 * loader's duplicate-key scan sees it), sets the global, loads the profile
 * (which validates it — a refusal fails the boot, naming the URL), prints the
 * announcements to the console, and only then dynamically imports the page's
 * real entry. It is the browser face of `scripts/procgen/seedlingProfileLoader.mjs`.
 *
 * With no `?profile=` it imports the entry and nothing else: no fetch, the
 * global untouched, the profile evaluated by the entry exactly as before.
 *
 * ⛔ Dependency-free on purpose: a static import here would evaluate before
 * the global is set. `seedlingProfile.js` is imported dynamically, after it.
 *
 * ⚠ The ES-module boot only. The bundled main app (`?bundled=true`,
 * `frontend/dist/bundle.js`) evaluates the profile at bundle load through
 * `flashPanel/seedlingSemantics.js`, and no page on that boot goes through
 * here; `watch.html` has no bundled boot.
 *
 * Usage (the page's inline module):
 *     import { bootWithProfile } from './profileBoot.js';
 *     const { main } = await bootWithProfile(new URL('./watchViewer.js', import.meta.url).href);
 *     main();
 */

const PROFILE_GLOBAL = '__SEEDLING_PROFILE__';
const DEFAULT_SOURCE = 'compiled-in default';
/** The repo root, which a `?profile=` path is relative to — the page's own convention for `?tape=`. */
const REPO_ROOT = new URL('../../../', import.meta.url);

/** The `?profile=` value in `search`, or null when absent or empty. */
export function profileParam(search) {
    return new URLSearchParams(search).get('profile') || null;
}

/** The URL a `?profile=` path names: repo-relative, like `?tape=`; an absolute URL stays as it is. */
export function profileUrl(path, root = REPO_ROOT) {
    return new URL(String(path).replace(/^\/+/, ''), root).href;
}

/**
 * Install the `?profile=` override (when there is one), then import `entryUrl`.
 *
 * @param {string} entryUrl  the page's real entry, as an absolute URL
 * @param {{search?: string, fetch?: Function, log?: Function, root?: URL}} [opts]
 * @returns {Promise<object>} the entry's module namespace
 * @throws {Error} naming the profile URL, when it cannot be fetched, is
 *   refused, or arrived after the profile had already evaluated
 */
export async function bootWithProfile(entryUrl, {
    search = globalThis.location?.search ?? '',
    fetch: fetchImpl = globalThis.fetch,
    log = (line) => console.log(line),
    root = REPO_ROOT,
} = {}) {
    const path = profileParam(search);
    if (path === null) return import(entryUrl);
    const url = profileUrl(path, root);
    let text;
    try {
        const res = await fetchImpl(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
    } catch (e) {
        throw new Error(`?profile=${path}: cannot fetch ${url} (${e.message})`);
    }
    globalThis[PROFILE_GLOBAL] = text;
    let profile;
    try {
        profile = await import('./seedlingProfile.js');
    } catch (e) {
        throw new Error(`?profile=${path}: ${e.message}`);
    }
    if (profile.PROFILE_SOURCE === DEFAULT_SOURCE) {
        throw new Error(`?profile=${path}: installed TOO LATE — seedlingProfile.js had already evaluated without it`);
    }
    for (const line of profile.profileAnnouncements()) log(`[profile] ${line}`);
    return import(entryUrl);
}
