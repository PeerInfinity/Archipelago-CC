/**
 * exportSeedlingView — the PURE half of `export-seedling-view.mjs`.
 *
 * Editor arc slice 4. Everything here is a decision about STRINGS and
 * OBJECTS: which of the caller's flags are the CLI's own and which are the
 * PAGE's URL parameters, what URL that makes, and what verdict a finished
 * page load deserves. Nothing here launches a browser, starts a server or
 * touches a file — which is the whole reason it can be a vitest row in CI,
 * where neither exists.
 *
 * The split is `watchSolve.js`/`watchViewer.js`'s own, one layer out, and
 * `seedlingOgmo.js` is the scripts/-side precedent for it.
 *
 * ⛔ THE ONE-RENDERER LAW LIVES IN WHAT IS *NOT* HERE. The CLI adds a
 * server and a PNG; the drawing, the layer selection, the cursor and the
 * readiness signal are all the page's, reached through URL parameters it
 * already has. There is no second renderer and no second handshake.
 */

/**
 * The CLI's OWN flags. Everything else the caller passes as `--name=value`
 * is forwarded to the page verbatim as a URL parameter.
 *
 * ⚠ THE LIST IS EXHAUSTIVE ON PURPOSE, and it is checked against the page's
 * own parameter vocabulary by a test: a CLI flag that collided with a page
 * parameter (`--tick=`, say) would silently swallow it, and the export
 * would be of a different view than the caller asked for.
 */
export const CLI_FLAGS = Object.freeze([
    'out', 'trace', 'params', 'host', 'timeout', 'json', 'help', 'quiet',
]);

/**
 * The page's URL parameters (watch.html's docblock, "the whole set").
 * Here so the collision test above has something to compare against, and so
 * an unknown parameter can be NAMED rather than silently forwarded.
 */
export const PAGE_PARAMS = Object.freeze([
    'tape', 'side', 'speed', 'source', 'level', 'boot', 'goals', 'solve',
    'name', 'layers', 'tick', 'shot',
]);

/** `--name=value` / `--name` → `{name, value}`; anything else → null. */
function readFlag(arg) {
    if (!arg.startsWith('--')) return null;
    const body = arg.slice(2);
    const eq = body.indexOf('=');
    return eq === -1
        ? { name: body, value: '1' }
        : { name: body.slice(0, eq), value: body.slice(eq + 1) };
}

/**
 * Split argv into the CLI's own options and the page's URL parameters.
 *
 * `--params=a=b&c=d` is the raw escape hatch (for a query string copied
 * straight out of a browser); individual `--tape=…` style flags are the
 * ergonomic form. Both land in the same map, with the individual flags
 * winning — they are the more specific statement.
 */
export function parseArgs(argv) {
    const opts = { trace: false, json: false, quiet: false, out: '', host: '', timeout: 180000 };
    const page = new Map();
    const unknown = [];
    const bad = [];

    for (const arg of argv) {
        const flag = readFlag(arg);
        if (!flag) { bad.push(`not a flag: ${arg}`); continue; }
        const { name, value } = flag;
        if (name === 'params') {
            for (const [k, v] of new URLSearchParams(value)) {
                if (!PAGE_PARAMS.includes(k)) unknown.push(k);
                page.set(k, v);
            }
            continue;
        }
        if (CLI_FLAGS.includes(name)) {
            if (name === 'trace' || name === 'json' || name === 'quiet' || name === 'help') {
                opts[name] = value !== '0' && value !== 'false';
            } else if (name === 'timeout') {
                const ms = Number(value);
                if (!Number.isFinite(ms) || ms <= 0) bad.push(`--timeout= must be a positive number of ms, got "${value}"`);
                else opts.timeout = ms;
            } else {
                opts[name] = value;
            }
            continue;
        }
        if (!PAGE_PARAMS.includes(name)) unknown.push(name);
        page.set(name, value);
    }

    if (!opts.help) {
        if (!opts.out) bad.push('--out=<file.png> is required');
        else if (!opts.out.endsWith('.png')) bad.push(`--out= must name a .png file, got "${opts.out}"`);
        if (!page.has('tape') && !page.has('boot') && !page.has('level')) {
            bad.push('nothing to draw: give the page a view — --tape=<repo-relative json>, '
                + 'or --boot=<repo-relative json> with --solve=1');
        }
    }
    return { opts, page, unknown, bad };
}

/**
 * The page URL: an origin, the page's own path, the caller's parameters —
 * and `shot=1`, which is not negotiable.
 *
 * ⛔ `?shot=1` IS THE CONTRACT (watch.html's docblock, kickoff §10.6): the
 * page starts PAUSED, draws the requested frame synchronously, and only
 * then raises `body[data-shot-ready="1"]`. A caller who passed `shot=0`
 * would be asking for a screenshot of an animating page — i.e. of whenever
 * the shutter happened to open — so the parameter is FORCED and the
 * override is reported rather than honoured.
 */
export const PAGE_PATH = '/frontend/modules/seedlingDemo/watch.html';

/**
 * ⛓ `--tick=last` — THE ONE VALUE THE PAGE CANNOT PARSE, AND WHY IT IS HERE.
 *
 * `?shot=1` holds the cursor where it landed, and with no `?tick=` that is
 * frame 0 — a room before anything has happened in it. The overwhelmingly
 * common ask of an exporter ("show me the walk") is therefore the LAST
 * frame, and nobody knows that number without first replaying the tape.
 *
 * ⛔ IT IS NOT A NEW HANDSHAKE. The CLI resolves it by loading the page the
 * ordinary way, reading `window.__editorShot.frames` from the readiness
 * contract it already waits on, and loading the SAME page again with a
 * concrete `?tick=N`. One contract, used twice — never a scrub poked
 * through the DOM, and never a frame count derived on this side.
 */
export const TICK_LAST = 'last';
export const wantsLastTick = (page) => page.get('tick') === TICK_LAST;

export function buildViewUrl(origin, page, { tick } = {}) {
    const q = new URLSearchParams();
    let forcedShot = null;
    for (const [k, v] of page) {
        if (k === 'shot') { if (v !== '1') forcedShot = v; continue; }
        // `--tick=last` is resolved by the caller (see TICK_LAST); until it
        // is, the parameter is simply absent, so the first load is the
        // ordinary one and the page decides its own frame count.
        if (k === 'tick' && v === TICK_LAST) {
            if (tick !== undefined && tick !== null) q.set('tick', String(tick));
            continue;
        }
        q.set(k, v);
    }
    q.set('shot', '1');
    return { url: `${origin}${PAGE_PATH}?${q.toString()}`, forcedShot };
}

/**
 * ⚠ THE CLASS OF PAGE 404 THAT IS AN ANSWER, NOT AN ERROR (slice 2 §9.4):
 * the page asks for `fixtures/traces/<name>.trace.json` on every tape and
 * only the SOLVER's tapes have one, so a hand-authored walk logs a 404 that
 * the trace pane RENDERS as "no trace for this tape". Filtered on the
 * sidecar suffix so that every other missing resource still counts.
 */
export const isExpectedSidecar404 = (line) => /\.trace\.json/.test(line);

/** Exit codes, named once so the docblock, the CLI and its check agree. */
export const EXIT = Object.freeze({
    ok: 0,
    usage: 1,
    refused: 2,
    timeout: 3,
    pageErrors: 4,
});

/**
 * ⛓⛓⛓ THE VERDICT — trap 184's law, written where a test can reach it.
 *
 * A run that ends in a NAMED REFUSAL — a lethal terrain, water under an
 * unpinned `sound`, one of the SIX committed boots whose v9 `persistence[].at`
 * the v8 fold refuses (slice 3 §10.3) — must surface the page's own message
 * and exit NON-ZERO. A blank or partial frame with exit 0 is the defect,
 * because the caller of an exporter reads the PNG, not the log.
 *
 * Hence three facts, not one:
 *
 *  - `refused`  the page put a message in its own status bar (`#status.bad`).
 *               ⚠ THIS OUTRANKS A DRAWN FRAME. A run that threw mid-way
 *               still draws what it got and still raises the readiness flag,
 *               so "there are pixels" is NOT evidence that the view is the
 *               one that was asked for.
 *  - `ready`    the readiness contract fired, so a painted canvas exists.
 *  - `pageErrors` console/page errors beyond the sidecar class.
 *
 * `write` is deliberately false for every refusal and every timeout: the
 * one thing this tool must never do is leave a plausible-looking PNG behind
 * for a view the page refused to produce.
 */
export function classify({ ready, refused, message = '', pageErrors = [] }) {
    if (refused) {
        return {
            code: EXIT.refused,
            write: false,
            why: `the page REFUSED — this is its own message, not the CLI's: ${message}`
                + (ready ? '  ⚠ (a PARTIAL frame was drawn and deliberately NOT written)' : ''),
        };
    }
    if (!ready) {
        return {
            code: EXIT.timeout,
            write: false,
            why: `the page never raised its readiness flag${message ? ` — last status: ${message}` : ''}`,
        };
    }
    if (pageErrors.length) {
        return {
            code: EXIT.pageErrors,
            write: true,
            // ⚠ WRITTEN ANYWAY, AND STILL NON-ZERO. The frame is real and is
            // worth looking at; the exit code is what stops a caller from
            // reading a page that was throwing as a clean one.
            why: `${pageErrors.length} unexpected page error(s): ${pageErrors.join(' | ')}`,
        };
    }
    return { code: EXIT.ok, write: true, why: null };
}

/**
 * The PNG header, read from the bytes — width, height and the signature.
 *
 * Here because the acceptance row's claim is "a PNG of the right size
 * exists", and a check that only asserted the file's LENGTH would pass on
 * any 8 KB of noise. Pure byte arithmetic: IHDR is always the first chunk.
 */
export function readPngHeader(bytes) {
    const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const isPng = bytes.length > 24 && SIG.every((b, i) => bytes[i] === b);
    if (!isPng) return { isPng: false, width: 0, height: 0 };
    const at = (i) => (bytes[i] << 24 | bytes[i + 1] << 16 | bytes[i + 2] << 8 | bytes[i + 3]) >>> 0;
    return { isPng: true, width: at(16), height: at(20) };
}
