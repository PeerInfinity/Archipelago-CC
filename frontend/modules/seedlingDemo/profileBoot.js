/**
 * profileBoot — the page's `?profile=<path>`: install a physics profile
 * override BEFORE the page's model evaluates (engine-prep R1).
 *
 * `seedlingProfile.js` reads `globalThis.__SEEDLING_PROFILE__` once, when it
 * evaluates, and every module that copies a constant out of it copies it at
 * ITS load. The page imports its entry statically, so the whole model has
 * evaluated before any of the page's own module code runs.
 *
 * ⛓ THIS IS A CLASSIC SCRIPT, loaded with a plain `<script src>` placed BEFORE
 * the page's `<script type="module">`, and the fetch is SYNCHRONOUS. A classic
 * script runs while the document is parsed, and every module script runs after
 * parsing, so the global is set before the first module evaluates.
 *
 * ⛔ Why not a module bootstrap that dynamically imports the entry: it was built
 * first and measured wrong. `DOMContentLoaded` does not wait for a module's
 * top-level `await`, so the page's `main()` then ran AFTER the page reported
 * itself loaded. `check-procgen-demos.mjs` presses `#campaignRun` as soon as
 * the button is enabled at load, so its CAMPAIGN row went red 3 times out of 3.
 * With this form and no `?profile=`, the page's modules boot exactly as before:
 * the inline module is untouched.
 *
 * With `?profile=`:
 *   1. the file's TEXT is fetched (the text, so the loader's duplicate-key
 *      scan sees it), repo-relative like `?tape=`;
 *   2. it is set as the global;
 *   3. a module error while the page loads is shown in `#status`, naming the
 *      `?profile=` path. That is how a REFUSED override surfaces: the profile
 *      throws, and the import fails;
 *   4. once loaded, the profile's announcements are logged, each prefixed
 *      `[profile]`, and an install that came too late is refused by name.
 * A failed fetch must not leave the page running the DEFAULTS under a URL that
 * asked for a profile. So it installs text the profile refuses (not JSON): the
 * model's import fails, and `#status` shows the fetch error.
 *
 * ⚠ The ES-module boot only. The bundled main app (`?bundled=true`,
 * `frontend/dist/bundle.js`) evaluates the profile at bundle load through
 * `flashPanel/seedlingSemantics.js`, and nothing on that boot loads this
 * script; `watch.html` has no bundled boot.
 *
 * The pure parts are published on `globalThis.__seedlingProfileBoot` for
 * `profileBoot.test.js`. The file has no `import` or `export`, so it runs
 * as a classic script and as a module alike.
 */
(function profileBoot(g) {
    const PROFILE_GLOBAL = '__SEEDLING_PROFILE__';
    /** What a failed fetch installs: not JSON, so `seedlingProfile.js` refuses it and the model never runs. */
    const FETCH_FAILED = '?profile= fetch failed';
    const DEFAULT_SOURCE = 'compiled-in default';

    /** The `?profile=` value in `search`, or null when absent or empty. */
    function profileParam(search) {
        return new URLSearchParams(search).get('profile') || null;
    }

    /** The URL a `?profile=` path names, relative to `root` (the repo root); an absolute URL stays as it is. */
    function profileUrl(path, root) {
        return new URL(String(path).replace(/^\/+/, ''), root).href;
    }

    /**
     * Install the `?profile=` override named in `search`, if any, with `get`
     * (a synchronous `url → {status, text}`).
     *
     * @returns {{path: string, url: string} | null} null when there is no `?profile=`
     * @throws {Error} naming the path and the URL, when the fetch fails
     */
    function installProfile(search, { root, get }) {
        const path = profileParam(search);
        if (path === null) return null;
        const url = profileUrl(path, root);
        let res;
        try { res = get(url); } catch (e) { throw new Error(`?profile=${path}: cannot fetch ${url} (${e.message})`); }
        if (res.status !== 200) throw new Error(`?profile=${path}: cannot fetch ${url} (HTTP ${res.status})`);
        g[PROFILE_GLOBAL] = res.text;
        return { path, url };
    }

    /** The lines the page logs once the profile has loaded, or throws when it loaded without the override. */
    function announce(installed, profile) {
        if (profile.PROFILE_SOURCE === DEFAULT_SOURCE) {
            throw new Error(`?profile=${installed.path}: installed TOO LATE — seedlingProfile.js had already evaluated without it`);
        }
        return profile.profileAnnouncements().map((line) => `[profile] ${line}`);
    }

    g.__seedlingProfileBoot = Object.freeze({ profileParam, profileUrl, installProfile, announce });

    const doc = g.document;
    const script = doc?.currentScript;
    if (!script || !script.src || typeof g.XMLHttpRequest !== 'function') return; // not a page load (a test import)

    const showOnStatus = (message) => {
        const status = doc.getElementById('status');
        if (!status) return;
        status.className = 'bad';
        status.textContent = message;
    };
    const syncGet = (url) => {
        const xhr = new g.XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.send();
        return { status: xhr.status, text: xhr.responseText };
    };

    let installed;
    let fetchError = null;
    try {
        installed = installProfile(g.location.search, { root: new URL('../../../', script.src), get: syncGet });
    } catch (e) {
        fetchError = e.message;
        installed = { path: profileParam(g.location.search), url: null };
        g[PROFILE_GLOBAL] = FETCH_FAILED;
        console.error(fetchError);
    }
    if (installed === null) return;
    g.__seedlingProfileBoot = Object.freeze({ ...g.__seedlingProfileBoot, installed });
    // only while the page loads: a later error is the page's own, not the profile's
    let refused = false;
    const onLoadError = (ev) => {
        refused = true;
        showOnStatus(fetchError ?? `?profile=${installed.path}: ${String(ev.message).replace(/^Uncaught (Error: )?/, '')}`);
    };
    g.addEventListener('error', onLoadError);
    g.addEventListener('load', () => {
        g.removeEventListener('error', onLoadError);
        if (refused) return;
        import(new URL('./seedlingProfile.js', script.src).href).then((profile) => {
            for (const line of announce(installed, profile)) console.log(line);
        }).catch((e) => { showOnStatus(e.message); console.error(e); });
    });
}(globalThis));
