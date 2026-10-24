/**
 * swfRecompilerUI.js — the SWF Recompiler panel: pick a SWF (an example the
 * recompiler page ships, or a file of your own), then Recompile (SWF → C),
 * Compile (C → WebAssembly, with clang running in the browser) and Run, each
 * stage's status and time shown; Check compares the run with what the example
 * is known to print and draw (runCheck.js).
 *
 * The work happens in SWFRecomp-CC's own recompiler page — the
 * `swfrecomp-browser` submodule (`browser/`) — driven over its `swfrecomp-walk`
 * v1 message API (walkClient.js). The page must be cross-origin isolated to
 * compile, so the panel picks a ROUTE by asking the page (`hello`):
 *   - 'panel': the page in this panel's iframe (`allow="cross-origin-isolated"`;
 *     its service worker adds Document-Isolation-Policy) can compile and run —
 *     Chrome and full Chromium;
 *   - 'tab': it cannot (no DIP: the Playwright headless SHELL, other browsers),
 *     so Recompile opens the page in a NEW TAB and drives it over a
 *     BroadcastChannel named by a unique `?walkChannel=`. "Open in a new tab"
 *     takes this route on any browser.
 * The graphics host runs one SWF per page load, so a second Recompile reloads
 * the page first (`reload`).
 *
 * ⚠ On a successful compile the Wasmer SDK logs one or two "panicked at …" /
 * "RuntimeError: unreachable" lines to the console (vendor/wasmer-sdk). They
 * are not failures; the panel reads stage results, never the console.
 */
import { WalkClient, channelTransport, frameTransport, uniqueChannel } from './walkClient.js';
import { EXAMPLE_PIXELS, expectedLines, gradeRun, outputTxtPath } from './runCheck.js';

export const MODULE_ID = 'swfRecompilerPanel';
export const COMPONENT_TYPE = 'swfRecompilerPanel';
/** The submodule, relative to the app document. */
export const BROWSER_DIR = 'modules/swfRecompilerPanel/browser/';
export const PAGE_PATH = `${BROWSER_DIR}recompiler/index.html`;
/** The source select's value for "a SWF file of your own". */
export const FILE_SOURCE = 'file';
export const STAGES = Object.freeze(['load', 'recompile', 'compile', 'run', 'check']);
const CONNECT_TIMEOUT_MS = 60000;
/** How long Check waits for the expected trace lines to be printed. */
const TRACE_WAIT_MS = 5000;

/** Selectors a tutorial or a test may name (scoped to the panel). */
export const CONTROLS = Object.freeze({
    source: 'select.swfr-source',
    file: 'input.swfr-file',
    recompile: 'button.swfr-recompile',
    compile: 'button.swfr-compile',
    run: 'button.swfr-run',
    check: 'button.swfr-check',
    openTab: 'button.swfr-open-tab',
    status: '.swfr-status',
    route: '.swfr-route',
    stage: (name) => `.swfr-stage[data-stage="${name}"]`,
    trace: 'pre.swfr-trace',
    frame: 'iframe.swfr-frame',
});

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

const secs = (ms) => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/** One line per finished stage, from its result (WALK_API.md § Commands). */
export function stageSummary(stage, r) {
    switch (stage) {
        case 'load': return `${r.label} (${kb(r.bytes)})`;
        case 'recompile': return `${r.fileCount} C files (${kb(r.cBytes)}${r.avm2 ? ', AVM2' : ''}) in ${secs(r.ms)}`;
        case 'compile': return `a ${kb(r.guestBytes)} guest from ${r.fileCount} files: clang ${secs(r.clangMs)}, `
            + `${secs(r.ms)} with the compiler download`;
        case 'run': return `${r.status ?? 'running'} (${r.width}×${r.height}), started in ${secs(r.ms)}`;
        default: return '';
    }
}

export class SwfRecompilerUI {
    /** The live panel (tests and tutorials read it). */
    static instance = null;

    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState || {};
        this.route = null;
        this.hello = null;
        this.frameClient = null;
        this.tabClient = null;
        this.busy = false;
        this.fileBytes = null;
        this.fileName = null;
        /** The page instance a SWF was loaded into (one SWF per page load). */
        this.loadedInstance = null;
        this.loadedOn = null;
        this.example = null;
        this._buildDom();
        SwfRecompilerUI.instance = this;
        this.ready = this._connectFrame();
    }

    getRootElement() { return this.root; }

    destroy() {
        this.frameClient?.close();
        this.tabClient?.close();
        this.frameClient = null;
        this.tabClient = null;
        this.frame?.remove();
        if (SwfRecompilerUI.instance === this) SwfRecompilerUI.instance = null;
    }

    // ── DOM ───────────────────────────────────────────────────────────────

    _buildDom() {
        this.root = el('div', 'swfr-panel');
        this.root.dataset.ready = 'false';

        const pick = el('div', 'swfr-row');
        const label = el('label', 'swfr-label', 'SWF ');
        this.sourceEl = el('select', 'swfr-source');
        this.sourceEl.disabled = true;
        this.sourceEl.addEventListener('change', () => this._sourceChanged());
        label.appendChild(this.sourceEl);
        pick.appendChild(label);
        this.fileEl = el('input', 'swfr-file');
        this.fileEl.type = 'file';
        this.fileEl.accept = '.swf,application/x-shockwave-flash';
        this.fileEl.hidden = true;
        this.fileEl.addEventListener('change', () => this._fileChosen());
        pick.appendChild(this.fileEl);
        this.root.appendChild(pick);

        const buttons = el('div', 'swfr-row swfr-buttons');
        const button = (cls, text, title, fn) => {
            const b = el('button', cls, text);
            b.type = 'button';
            b.title = title;
            b.disabled = true;
            b.addEventListener('click', fn);
            buttons.appendChild(b);
            return b;
        };
        this.recompileBtn = button('swfr-recompile', 'Recompile', 'SWF → C: SWFRecomp, running in your browser',
            () => this._onRecompile());
        this.compileBtn = button('swfr-compile', 'Compile', 'C → WebAssembly: clang, running in your browser',
            () => this._runAction('compile'));
        this.runBtn = button('swfr-run', 'Run', 'Run the recompiled movie', () => this._runAction('run'));
        this.checkBtn = button('swfr-check', 'Check',
            'Compare the run with what the example is known to print and draw', () => this._onCheck());
        this.openTabBtn = button('swfr-open-tab', 'Open in a new tab',
            'Run the recompiler page in a tab of its own (works where the panel cannot compile)', () => this._onOpenTab());
        this.root.appendChild(buttons);

        this.routeEl = el('div', 'swfr-route', 'Connecting to the recompiler page…');
        this.root.appendChild(this.routeEl);
        this.statusEl = el('div', 'swfr-status', 'Starting…');
        this.root.appendChild(this.statusEl);

        const stages = el('div', 'swfr-stages');
        this.stageEls = {};
        const titles = { load: 'Load', recompile: 'Recompile', compile: 'Compile', run: 'Run', check: 'Check' };
        for (const s of STAGES) {
            const row = el('div', 'swfr-stage');
            row.dataset.stage = s;
            row.dataset.state = 'idle';
            row.appendChild(el('span', 'swfr-stage-name', titles[s]));
            row.appendChild(el('span', 'swfr-stage-state', '—'));
            row.appendChild(el('span', 'swfr-stage-text', ''));
            stages.appendChild(row);
            this.stageEls[s] = row;
        }
        this.root.appendChild(stages);

        const traceBox = el('details', 'swfr-trace-box');
        traceBox.appendChild(el('summary', null, 'Trace (what the movie printed)'));
        this.traceEl = el('pre', 'swfr-trace');
        traceBox.appendChild(this.traceEl);
        this.root.appendChild(traceBox);

        this.frameBox = el('details', 'swfr-frame-box');
        this.frameBox.open = true;
        this.frameSummary = el('summary', null, 'The recompiler page');
        this.frameBox.appendChild(this.frameSummary);
        this.channel = uniqueChannel('swfr-frame');
        this.frame = el('iframe', 'swfr-frame');
        this.frame.setAttribute('allow', 'cross-origin-isolated');
        this.frame.title = 'SWFRecomp in-browser recompiler';
        this.frame.src = `${PAGE_PATH}?walkChannel=${this.channel}`;
        this.frameBox.appendChild(this.frame);
        this.root.appendChild(this.frameBox);
    }

    _setStage(stage, state, text = '') {
        const row = this.stageEls[stage];
        row.dataset.state = state;
        if (state === 'done' || state === 'error') row.dataset.at = String(Date.now());
        row.querySelector('.swfr-stage-state').textContent = { idle: '—', active: '…', done: '✓', error: '✗' }[state];
        row.querySelector('.swfr-stage-text').textContent = text;
    }

    _resetStages(from = 'load') {
        for (const s of STAGES.slice(STAGES.indexOf(from))) this._setStage(s, 'idle');
        if (from === 'load') {
            this.traceEl.textContent = '';
            delete this.root.dataset.verdict;
        }
    }

    _status(text) { this.statusEl.textContent = text; }

    /** Enable each button by what is done (one action at a time). */
    _refreshButtons() {
        const ready = this.root.dataset.ready === 'true';
        const done = (s) => this.stageEls[s].dataset.state === 'done';
        const haveSource = this.sourceEl.value && (this.sourceEl.value !== FILE_SOURCE || this.fileBytes);
        this.sourceEl.disabled = !ready || this.busy;
        this.recompileBtn.disabled = !ready || this.busy || !haveSource;
        this.compileBtn.disabled = this.busy || !done('recompile');
        this.runBtn.disabled = this.busy || !done('compile');
        this.checkBtn.disabled = this.busy || !done('run');
        this.openTabBtn.disabled = !ready || this.busy;
    }

    // ── the page ──────────────────────────────────────────────────────────

    /** Ask the iframe's page what it can do here, and pick the route. */
    async _connectFrame() {
        this.frameClient = new WalkClient(frameTransport(this.frame));
        this._listen(this.frameClient, 'panel');
        try {
            const hello = await this.frameClient.connect({ timeoutMs: CONNECT_TIMEOUT_MS });
            this._ready(hello, hello.capabilities?.compile && hello.capabilities?.run ? 'panel' : 'tab');
        } catch (e) {
            this._status(`Error: ${e.message}`);
            this.routeEl.textContent = 'The recompiler page did not answer. Is the swfRecompilerPanel/browser submodule checked out?';
        }
    }

    _ready(hello, route) {
        this.hello = hello;
        this._setRoute(route);
        const keep = this.sourceEl.value;
        this.sourceEl.replaceChildren(
            ...hello.examples.map((ex) => {
                const o = el('option', null, `Example: ${ex.name}`);
                o.value = ex.name;
                return o;
            }),
            Object.assign(el('option', null, 'A SWF file of your own…'), { value: FILE_SOURCE }),
        );
        if (keep) this.sourceEl.value = keep;
        this.examples = hello.examples;
        this.root.dataset.ready = 'true';
        this._status(`Ready: ${hello.build?.commit ? `SWFRecomp-CC ${String(hello.build.commit).slice(0, 9)}, ` : ''}`
            + `${route === 'panel' ? 'compiles in this panel' : 'compiles in a new tab'}`);
        this._sourceChanged();
    }

    _setRoute(route) {
        this.route = route;
        this.root.dataset.route = route;
        this.routeEl.textContent = route === 'panel'
            ? 'Runs here: this browser can compile inside the panel.'
            : 'Runs in a new tab: this browser cannot compile inside the panel (it needs cross-origin isolation, '
                + 'which a panel gets only from Chrome\'s Document-Isolation-Policy). Recompile opens the tab.';
        this.frameSummary.textContent = route === 'panel' ? 'The recompiler page (the movie runs here)'
            : 'The recompiler page (here it can recompile, not compile — the run is in the tab)';
        this.frameBox.open = route === 'panel';
    }

    /** Route a client's events into the stage list and the trace. */
    _listen(client, which) {
        client.on('stage', (e) => {
            if (this._target() !== client) return;
            if (e.state === 'active' && e.text) this._setStage(e.stage, 'active', e.text);
        });
        client.on('trace', (e) => {
            if (this._target() !== client) return;
            this.traceEl.textContent += `${e.line}\n`;
        });
        client.on('runError', (e) => {
            if (this._target() !== client) return;
            this._setStage('run', 'error', e.error);
            this._status(`Error: the movie failed — ${e.error}`);
        });
        client.on('fresh', () => {
            if (this._target() !== client || this.busy) return;
            // The page reloaded under us (a layout move re-creates the iframe): what it had is gone.
            if (this.loadedOn === which) {
                this.loadedInstance = null;
                this._resetStages();
                this._status('The recompiler page reloaded; press Recompile again.');
                this._refreshButtons();
            }
        });
    }

    _target() { return this.route === 'tab' ? this.tabClient : this.frameClient; }

    /**
     * Open the page in a new tab. ⛔ Synchronous up to window.open: a browser
     * opens a tab only inside the click that asked for it.
     */
    _openTab() {
        this.tabClient?.close();
        this.tabClient = null;
        const channel = uniqueChannel('swfr-tab');
        const url = new URL(`${PAGE_PATH}?walkChannel=${channel}`, document.baseURI).href;
        const w = window.open(url, '_blank');
        if (!w) throw new Error('The browser blocked the new tab: allow pop-ups for this site, then press Open in a new tab.');
        this.tabClient = new WalkClient(channelTransport(channel));
        this._listen(this.tabClient, 'tab');
        if (this.loadedOn === 'tab') this.loadedInstance = null;
        return this.tabClient;
    }

    async _connectedTarget() {
        const client = this._target();
        if (!client) throw new Error('No recompiler page: press Open in a new tab.');
        if (!client.instance) {
            this._status(this.route === 'tab' ? 'Waiting for the recompiler tab…' : 'Waiting for the recompiler page…');
            await client.connect({ timeoutMs: CONNECT_TIMEOUT_MS });
        }
        return client;
    }

    // ── actions ───────────────────────────────────────────────────────────

    _sourceChanged() {
        this.fileEl.hidden = this.sourceEl.value !== FILE_SOURCE;
        this.example = this.examples?.find((ex) => ex.name === this.sourceEl.value) ?? null;
        if (!this.busy) this._resetStages();
        this._refreshButtons();
    }

    async _fileChosen() {
        const f = this.fileEl.files?.[0];
        this.fileBytes = f ? await f.arrayBuffer() : null;
        this.fileName = f ? f.name.replace(/\.swf$/i, '') : null;
        this._resetStages();
        this._refreshButtons();
    }

    _onOpenTab() {
        try {
            this._setRoute('tab');
            this._openTab();
            this._resetStages();
            this._status('Opened the recompiler in a new tab; press Recompile.');
        } catch (e) {
            this._status(`Error: ${e.message}`);
        }
        this._refreshButtons();
    }

    _onRecompile() {
        // The new tab must open inside this click (see _openTab).
        try {
            if (this.route === 'tab' && !this.tabClient) this._openTab();
        } catch (e) {
            this._status(`Error: ${e.message}`);
            return;
        }
        this._perform(async () => {
            let client = await this._connectedTarget();
            if (this.loadedInstance && this.loadedInstance === client.instance) {
                this._status('Reloading the recompiler page (one SWF per page load)…');
                await client.reload({ timeoutMs: CONNECT_TIMEOUT_MS });
                client = await this._connectedTarget();
            }
            this._resetStages();
            const args = this.sourceEl.value === FILE_SOURCE
                ? { bytes: this.fileBytes.slice(0), name: this.fileName ?? 'input' }
                : { example: this.sourceEl.value };
            await this._stage(client, 'load', args);
            this.loadedInstance = client.instance;
            this.loadedOn = this.route;
            await this._stage(client, 'recompile');
            this._status('Recompiled to C. Press Compile.');
        });
    }

    _runAction(stage) {
        this._perform(async () => {
            const client = await this._connectedTarget();
            this._resetStages(stage);
            await this._stage(client, stage);
            this._status(stage === 'compile' ? 'Compiled to WebAssembly. Press Run.'
                : `Running${this.route === 'tab' ? ' in the recompiler tab' : ' below'}. Press Check.`);
        });
    }

    async _onCheck() {
        this._perform(async () => {
            const client = await this._connectedTarget();
            this._setStage('check', 'active', 'Reading the canvas and the trace…');
            let expected = null;
            if (this.example && this.loadedSource === this.example.name) {
                const res = await fetch(`${BROWSER_DIR}${outputTxtPath(this.example)}`);
                if (res.ok) expected = expectedLines(await res.text());
            }
            const pixels = expected ? EXAMPLE_PIXELS[this.example.name] ?? null : null;
            // The readback waits for the movie's next frame; read it first.
            const readback = pixels
                ? (await client.request('readback', { points: pixels.map((p) => p.at) })).pixels : null;
            // ⛓ `run` replies once the movie is RUNNING, before its first frame
            // has necessarily printed: measured 2026-10-14, a Check pressed at
            // once read 0 of the 7 lines. Wait (bounded) for the expected ones.
            let { lines } = await client.request('traces', { since: 0 });
            const until = Date.now() + TRACE_WAIT_MS;
            while (expected && Date.now() < until && !expected.every((l) => lines.includes(l))) {
                await new Promise((r) => setTimeout(r, 250));
                ({ lines } = await client.request('traces', { since: 0 }));
            }
            const g = gradeRun({ expected, lines, pixels, readback });
            this.root.dataset.verdict = g.verdict;
            this._setStage('check', g.verdict === 'fail' ? 'error' : 'done', g.text);
            this.stageEls.check.dataset.verdict = g.verdict;
            this._status(g.verdict === 'pass' ? 'Checked: the run matches the example.' : g.text);
        });
    }

    async _stage(client, stage, args = {}) {
        this._setStage(stage, 'active', 'Working…');
        try {
            const r = await client.request(stage, args);
            if (stage === 'load') this.loadedSource = r.name;
            this._setStage(stage, 'done', stageSummary(stage, r));
            return r;
        } catch (e) {
            this._setStage(e.stage ?? stage, 'error', e.message);
            throw e;
        }
    }

    /** One action at a time; errors land in the status line. */
    async _perform(fn) {
        if (this.busy) return;
        this.busy = true;
        this._refreshButtons();
        try {
            await fn();
        } catch (e) {
            this._status(`Error: ${e.message}`);
        } finally {
            this.busy = false;
            this._refreshButtons();
        }
    }
}
