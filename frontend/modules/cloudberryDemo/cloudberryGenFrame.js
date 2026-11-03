/**
 * Cloudberry substrate — the BROWSER generator for build-time generation (P2b): a
 * hidden same-origin Cloudberry game page whose generator API answers the pipeline's
 * `generate` (`cloudberryGeneration.js` generator shape).
 *
 * The page is created on the first generation only (the game is ~26 MB; most worlds
 * have no Cloudberry region), from the site the panel uses (`siteUrl()`: the module
 * setting, the local copy, or /cloudberry-kingdom-wasm/), with `?embed=1` — no
 * attract mode, no menus, and `window.cloudberry.generateText` +
 * `__cloudberryEmbed.canonicalDocText` (the document hash the page checks at
 * configure). Nothing is injected into it: it is not the panel's game page.
 *
 * It is a 2×2 px, transparent frame in the corner of the window rather than
 * `display:none` or off-screen, so the browser does not throttle the page's boot.
 * It is removed after `IDLE_CLOSE_MS` without a generation.
 */

export const GEN_FRAME_ID = 'cloudberryGenerator';
const READY_TIMEOUT_MS = 240000;
export const IDLE_CLOSE_MS = 120000;

function hex(buffer) {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {object} opts
 * @param {() => Promise<string>} opts.siteUrl  the site base (absolute, ending in '/')
 * @param {string} [opts.packsUrl]               the art library base the page reads
 * @param {(msg: string) => void} [opts.log]
 */
export function createFrameGenerator({ siteUrl, packsUrl = '', log = () => {} }) {
    let frame = null;
    let ready = null;
    let idleTimer = null;
    let build = '';

    function close() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = null;
        frame?.remove();
        frame = null;
        ready = null;
    }

    function touch() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(close, IDLE_CLOSE_MS);
    }

    async function open() {
        const base = await siteUrl();
        try {
            const info = await fetch(`${base}build-info.json`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
            build = info?.build ?? '';
        } catch { build = ''; }
        const q = new URLSearchParams({ embed: '1', ...(packsUrl ? { packs: packsUrl } : {}) });
        frame = document.createElement('iframe');
        frame.id = GEN_FRAME_ID;
        frame.title = 'Cloudberry level generator';
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;border:0;opacity:0;'
            + 'pointer-events:none;z-index:-1;';
        frame.src = `${base}index.html?${q}`;
        document.body.appendChild(frame);
        log(`cloudberry generator: loading ${frame.src}`);
        const t0 = Date.now();
        for (;;) {
            const w = frame?.contentWindow;
            if (w?.cloudberry?.generateText && w.__cloudberryEmbed?.canonicalDocText) break;
            if (!frame) throw new Error('the generator page was closed while loading');
            if (Date.now() - t0 > READY_TIMEOUT_MS) {
                throw new Error(`the Cloudberry page at ${base} did not offer its generator within ${READY_TIMEOUT_MS / 1000} s`);
            }
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => { setTimeout(r, 250); });
        }
        await frame.contentWindow.cloudberry.ready?.();
        log(`cloudberry generator: ready in ${Date.now() - t0} ms (build ${build || '?'})`);
        return frame.contentWindow;
    }

    return {
        get build() { return build; },
        close,
        /** The page's feature flags (`__cloudberryEmbed.features`, e.g. doubleJump): opens the page if needed. */
        async features() {
            ready ??= open().catch((err) => { close(); throw err; });
            const w = await ready;
            return { ...(w.__cloudberryEmbed?.features ?? {}) };
        },
        async generate(args) {
            ready ??= open().catch((err) => { close(); throw err; });
            const w = await ready;
            touch();
            const text = await w.cloudberry.generateText(args);
            const canon = w.__cloudberryEmbed.canonicalDocText(text);
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon));
            touch();
            return { text, docSha256: hex(digest) };
        },
    };
}
