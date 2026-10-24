// frontend/modules/presets/loadJSZipBrowser.js
/**
 * ⛓⛓ **THE VENDORED JSZip, IN A PAGE — ONE INJECTION, TWO PAGES.**
 *
 * EDITOR v3 slice E1c. `frontend/libs/jszip/jszip.min.js` is a UMD script, not
 * an ESM module, so it cannot be `import`ed: it is injected with a `<script>`
 * tag and read off `window.JSZip`. `presetUI` has done exactly that since the
 * `.archipelago` reader was written; the set editor on `watch.html` needs the
 * same library and would otherwise have written the same fifteen lines a second
 * time — including the same `src` path, which is the half that differs between
 * the two pages and is therefore the half worth passing in.
 *
 * ⛔ THE PROMISE IS MEMOISED PER `src`. Two presses on a page that injects twice
 * would leave two `<script>` tags racing to define one global, and the second
 * would silently win; one promise per URL is the same reason `loadVanillaSet`
 * is memoised one module over.
 */

/** The one vendored copy. Relative paths are the caller's — see `presetUI` vs `watch.html`. */
export const JSZIP_SCRIPT = 'libs/jszip/jszip.min.js';

const pending = new Map();

/**
 * @param {{src: string, doc?: Document, scope?: object}} options
 *   `src` — the URL this page reaches the vendored script at.
 * @returns {Promise<Function>} the JSZip constructor
 */
export function loadJSZipBrowser({ src, doc = globalThis.document, scope = globalThis } = {}) {
    if (!src) {
        throw new Error('loadJSZipBrowser: `src` is required — the two pages that inject this '
            + 'script reach it by different relative paths, so nothing here may guess one');
    }
    if (scope.JSZip) return Promise.resolve(scope.JSZip);
    if (pending.has(src)) return pending.get(src);
    const promise = new Promise((resolve, reject) => {
        const script = doc.createElement('script');
        script.src = src;
        script.onload = () => {
            if (scope.JSZip) resolve(scope.JSZip);
            else reject(new Error(`loadJSZipBrowser: ${src} loaded but defined no JSZip`));
        };
        script.onerror = () => reject(new Error(`loadJSZipBrowser: could not load ${src}`));
        doc.head.appendChild(script);
    });
    // ⛔ A failed load must not poison the page forever — the next press retries.
    pending.set(src, promise.catch((e) => { pending.delete(src); throw e; }));
    return pending.get(src);
}
