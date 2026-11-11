/**
 * procgenCore/fakeEditorDom.testkit — **A NODE-SIDE DOM JUST WIDE ENOUGH TO MOUNT AN EDITOR PANEL.**
 *
 * This repo's vitest runs `environment: 'node'`, so a panel that builds `<select>`s, buttons and an overlay
 * canvas cannot be mounted as-is. These rows need it mounted: they digest what a PRESS does (the command table,
 * the status line, the ops, the overlay strokes) before and after a move of code between files, and a digest of
 * the pure halves alone would not see the wiring move.
 *
 * ⛔ It models only what the editor panels read: children, `innerHTML = ''` clearing them, a `<select>`'s
 * `options` (through `<optgroup>`s) and its value falling back to the first option the way a browser's does,
 * listeners by type, and a 2D context that RECORDS its calls. Anything else is absent rather than faked, so a
 * panel that starts reading something new fails here loudly instead of reading a plausible blank.
 */

/** ⛓ The 2D context: every call is recorded as `[name, ...args]`, plus the stroke style in force. */
export function recordingContext(log) {
    const ctx = {
        strokeStyle: '', fillStyle: '', lineWidth: 1,
        save() { log.push(['save']); },
        restore() { log.push(['restore']); },
        clearRect(...a) { log.push(['clearRect', ...a]); },
        setLineDash(d) { log.push(['setLineDash', [...d]]); },
        strokeRect(...a) { log.push(['strokeRect', ctx.strokeStyle, ...a]); },
        beginPath() { log.push(['beginPath']); },
        moveTo(...a) { log.push(['moveTo', ...a]); },
        lineTo(...a) { log.push(['lineTo', ...a]); },
        stroke() { log.push(['stroke', ctx.strokeStyle]); },
        fillText(...a) { log.push(['fillText', ...a]); },
        fillRect(...a) { log.push(['fillRect', ctx.fillStyle, ...a]); },
        drawImage() { log.push(['drawImage']); },
    };
    return ctx;
}

export class FakeElement {
    constructor(tagName, { id = '', paintLog = null } = {}) {
        this.tagName = String(tagName).toLowerCase();
        this.id = id;
        this.children = [];
        this.parentNode = null;
        this.style = {};
        this.dataset = {};
        this.textContent = '';
        this.className = '';
        this.title = '';
        this.checked = false;
        this.disabled = false;
        this.width = 0;
        this.height = 0;
        this._value = '';
        this._listeners = new Map();
        this._paintLog = paintLog;
    }

    get value() {
        if (this.tagName !== 'select') return this._value;
        const opts = this.options;
        if (opts.length === 0) return this._value;
        return opts.some((o) => o.value === this._value) ? this._value : opts[0].value;
    }

    set value(v) { this._value = String(v); }

    /** ⛓ Every `<option>` below, through `<optgroup>`s — the browser's `select.options`. */
    get options() {
        const out = [];
        const walk = (n) => {
            for (const c of n.children) {
                if (c.tagName === 'option') out.push(c);
                else walk(c);
            }
        };
        walk(this);
        return out;
    }

    /** ⛓ `''` clears; a run of `<option value="…">text</option>` (a select filled by markup) is parsed. */
    set innerHTML(html) {
        for (const c of this.children) c.parentNode = null;
        this.children = [];
        if (html === '') return;
        const rest = html.replace(/<option\b[^>]*\bvalue="([^"]*)"[^>]*>([^<]*)<\/option>/g, (_, v, t) => {
            const o = new FakeElement('option', { paintLog: this._paintLog });
            o.value = v;
            o.textContent = t;
            this.appendChild(o);
            return '';
        });
        if (rest.trim() !== '') {
            throw new Error(`FakeElement: only innerHTML = '' or <option> runs are modelled, got ${JSON.stringify(html)}`);
        }
    }

    get innerHTML() { return ''; }

    appendChild(c) {
        c.parentNode = this;
        this.children.push(c);
        return c;
    }

    removeChild(c) {
        this.children = this.children.filter((x) => x !== c);
        c.parentNode = null;
        return c;
    }

    addEventListener(type, fn) {
        if (!this._listeners.has(type)) this._listeners.set(type, []);
        this._listeners.get(type).push(fn);
    }

    removeEventListener(type, fn) {
        const l = this._listeners.get(type);
        if (l) this._listeners.set(type, l.filter((f) => f !== fn));
    }

    /** Fire every live listener of `type` with `event` (a plain object). */
    dispatch(type, event = {}) {
        for (const fn of [...(this._listeners.get(type) ?? [])]) fn({ preventDefault() {}, ...event });
    }

    getContext(kind) {
        if (kind !== '2d' || !this._paintLog) return null;
        return recordingContext(this._paintLog);
    }

    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
}

/**
 * ⛓ A document holding exactly the elements named by `ids` (a page's own id list, read from its HTML by the
 * caller), so `getElementById` answers `null` for anything the page does not have — the same answer a browser
 * gives. Every canvas it creates records into `paintLog`.
 */
export function fakeDocument(ids, { paintLog = [], tagOf = () => 'div' } = {}) {
    const byId = new Map();
    const doc = {
        paintLog,
        _listeners: new Map(),
        createElement: (t) => new FakeElement(t, { paintLog }),
        createTextNode: (text) => Object.assign(new FakeElement('#text', { paintLog }), { textContent: String(text) }),
        getElementById: (id) => byId.get(id) ?? null,
        addEventListener: FakeElement.prototype.addEventListener,
        removeEventListener: FakeElement.prototype.removeEventListener,
        dispatch: FakeElement.prototype.dispatch,
    };
    for (const id of ids) byId.set(id, new FakeElement(tagOf(id), { id, paintLog }));
    return doc;
}

/**
 * ⛓ The `id="…"` of every element in an HTML file whose id starts with `prefix`, with its tag — so a harness
 * mounts the page's own controls rather than a list it keeps.
 */
export function idsInHtml(html, prefix) {
    const out = new Map();
    for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bid="([^"]+)"/g)) {
        if (m[2].startsWith(prefix)) out.set(m[2], m[1].toLowerCase());
    }
    return out;
}

/**
 * ⛓ The ids (with `prefix`) of every element the HTML ships with a bare `checked` attribute — a checkbox
 * the page opens ticked, which a harness must open ticked too or it mounts a different page.
 */
export function checkedIdsInHtml(html, prefix) {
    return [...html.matchAll(/<input\b[^>]*\bid="([^"]+)"[^>]*>/g)]
        .filter((m) => m[1].startsWith(prefix) && /\schecked(\s|>|=|\/)/.test(m[0]))
        .map((m) => m[1]);
}

/**
 * ⛓ The static `<option value="…">` list of one `<select id="…">` in the HTML, so a harness can fill a select
 * the page ships pre-filled (the mode select) from the page itself.
 */
export function staticOptionsOf(html, id) {
    const m = html.match(new RegExp(`<select[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</select>`));
    if (!m) return [];
    return [...m[1].matchAll(/<option[^>]*\bvalue="([^"]*)"/g)].map((x) => x[1]);
}
