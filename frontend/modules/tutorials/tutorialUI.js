/**
 * TutorialUI — the Tutorial panel. A list of tutorials; once one is started,
 * its current section with the current step marked, ◀ / ▶, "Do it" (perform
 * this step) and "Play" (perform every remaining step, one after another).
 *
 * ⚖ The user, 2026-10-10:
 *   - "Do it" AND "Play", plus an auto-advance option and its delay (settings
 *     `autoAdvance`, `autoAdvanceDelayMs`): when a step's `done` turns true —
 *     from Do it, or from the person doing it by hand — the panel moves on.
 *   - the cursor animation and the outline on the next thing to press are in
 *     the first version (settings `animateCursor`, `cursorMoveMs`,
 *     `showOutline`); desktop only.
 *   - the default layout is NOT split; starting a tutorial moves this panel
 *     into a stack of its own under the stack it was in (tutorialLayout.js),
 *     and "Merge" puts it back. The mobile layout is never split.
 *   - the list is grouped by TRACK (tutorialShape.js TRACKS); in-progress
 *     tutorials, and the developer track, sit in COLLAPSED sections of their
 *     own. An in-progress tutorial marks the step where it stops working.
 *   - an OUTSIDE step (a terminal command, e.g. a local MultiServer) shows its
 *     command with a Copy button; Do it is off for it, and Play waits for its
 *     done check (or stops, when it has none).
 *
 * The DOM is built with createElement + textContent, except step and prose
 * text, which goes through markdown-lite (procgenDocs/markdownLite.js: it
 * escapes everything first, so content cannot inject markup).
 */
import eventBus from '../../app/core/eventBus.js';
import settingsManager from '../../app/core/settingsManager.js';
import { DOCS_LINK_TARGETS, docsHref } from '../../app/config/docsBase.js';
import { inline } from '../procgenDocs/markdownLite.js';
import { TUTORIALS } from './content/index.js';
import { TRACKS, blocksFor, panelSteps } from './tutorialShape.js';
import { buildContext } from './tutorialContext.js';
import {
    hideCursor, nextPressable, performAction, performStep, setOutline, waitFor,
} from './tutorialExecutor.js';
import { TUTORIAL_PARAM, takeTutorialRequest } from './tutorialUrl.js';
import { componentItems, isDesktopLayout, isSplit, mergeBack, splitOut } from './tutorialLayout.js';

export const MODULE_ID = 'tutorials';
export const COMPONENT_TYPE = 'tutorialPanel';
export const PROGRESS_KEY = 'progress';
export const SETTING = (key) => `moduleSettings.${MODULE_ID}.${key}`;
export const DEFAULTS = Object.freeze({
    autoAdvance: true,
    autoAdvanceDelayMs: 1200,
    animateCursor: true,
    cursorMoveMs: 600,
    showOutline: true,
});
const DONE_POLL_MS = 300;
const QUICK_LAUNCH = Object.freeze({ panel: 'quickLaunchPanel' });
const URL_START_TIMEOUT_MS = 10000;

/** One class per control, so the in-app test and the CSS address them by name. */
export const CONTROLS = Object.freeze({
    list: 'tut-list',
    start: 'tut-start',
    prev: 'tut-prev',
    next: 'tut-next',
    doIt: 'tut-do',
    play: 'tut-play',
    layout: 'tut-layout',
    quickLaunch: 'tut-ql',
    exit: 'tut-exit',
    position: 'tut-pos',
    status: 'tut-status',
    step: 'tut-step',
    current: 'tut-current',
    done: 'tut-done',
    drafts: 'tut-drafts',
    developer: 'tut-developer',
    badge: 'tut-badge',
    command: 'tut-command',
    copy: 'tut-copy',
    blocked: 'tut-blocked',
    banner: 'tut-banner',
});
export const TEXT = Object.freeze({
    prev: '◀ Back',
    next: 'Next ▶',
    doIt: 'Do it',
    play: '▶ Play',
    pause: '⏸ Pause',
    split: 'Split ⇩',
    merge: 'Merge ⇧',
    quickLaunch: 'Quick Launch',
    exit: 'All tutorials',
    start: 'Start',
    resume: 'Resume',
    inProgress: 'In progress',
    drafts: 'In progress',
    copy: 'Copy',
    copied: 'Copied',
    outsideWaiting: 'Do this step yourself, outside the app — Play carries on once it is done.',
    outsideStopped: 'This step happens outside the app: do it yourself, then press Next ▶.',
});

/** "Works up to step 3 of 9; step 4 does not work yet." */
function blockedText(blocked, n) {
    const which = `step ${blocked.index + 1}`;
    return blocked.index === 0 ? `${which} of ${n} does not work yet.` : `works up to step ${blocked.index} of ${n}; ${which} does not work yet.`;
}

/** Where an in-progress tutorial stops working: `{ index, step }`, or null. */
export function blockedStep(t, steps = panelSteps(t)) {
    if (t.status !== 'in-progress' || !t.firstFailingStep) return null;
    return steps.find(({ step }) => step.id === t.firstFailingStep) ?? null;
}

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

function button(cls, text, title, onClick) {
    const b = el('button', cls, text);
    b.type = 'button';
    if (title) b.title = title;
    b.addEventListener('click', onClick);
    return b;
}

/** Markdown-lite text with relative `.md` links resolved against the guide's own directory. */
function richText(tag, cls, text, docPath, linkTarget) {
    const e = el(tag, cls);
    e.innerHTML = inline(text);
    const base = docPath ? docPath.slice(0, docPath.lastIndexOf('/') + 1) : '';
    for (const a of e.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href');
        if (!/^[a-z]+:/i.test(href) && !href.startsWith('#') && base) {
            const resolved = new URL(href, `https://x/${base}`).pathname.slice(1);
            a.setAttribute('href', docsHref(resolved, linkTarget));
        }
        a.target = '_blank';
        a.rel = 'noopener';
    }
    return e;
}

/** A prose block: paragraphs, and `- ` lines as a bullet list. */
function proseBlock(text, docPath, linkTarget) {
    const lines = text.split('\n');
    if (lines.every((l) => l.startsWith('- '))) {
        const ul = el('ul', 'tut-bullets');
        for (const l of lines) ul.append(richText('li', null, l.slice(2), docPath, linkTarget));
        return ul;
    }
    return richText('p', 'tut-prose', text.replace(/\n/g, ' '), docPath, linkTarget);
}

export class TutorialUI {
    /** The live panel (the in-app rows drive it); null when it is closed. */
    static instance = null;

    constructor(container) {
        this.container = container;
        this.root = el('div', 'tutorial-panel');
        container.element.appendChild(this.root);
        this.tutorial = null;
        this.steps = [];
        this.index = 0;
        this.doneSteps = new Set();
        this.playing = false;
        this.busy = false;
        this.status = '';
        this.settings = { ...DEFAULTS };
        this.linkTarget = DOCS_LINK_TARGETS.github;
        this.ctx = buildContext({ eventBus });
        this._token = 0;
        this._pollTimer = null;
        this._advanceTimer = null;
        // Which collapsed sections of the list are open (render() rebuilds them).
        this.openSections = new Set();
        this._unsubs = [
            eventBus.subscribe('settings:changed', () => this._loadSettings().then(() => this.render()), MODULE_ID),
        ];
        container.on?.('destroy', () => this.destroy());
        TutorialUI.instance = this;
        this.ready = this._init();
    }

    async _init() {
        await this._loadSettings();
        const saved = await settingsManager.getSetting(SETTING(PROGRESS_KEY), null);
        this.saved = saved && TUTORIALS.some((e) => e.tutorial.id === saved.id) ? saved : null;
        this.render();
        await this._startFromUrl();
    }

    /** `?tutorial=<id>[&tutorialStep=<n>]` (tutorialUrl.js), once per page load. */
    async _startFromUrl() {
        const request = takeTutorialRequest();
        if (request) await this.startRequest(request);
    }

    /**
     * Bring this panel forward and start `request.id` at `request.index` (the
     * URL's request; the in-app row drives it directly). Waits for the panel's
     * tab to exist — the layout builds panels before it finishes — so the
     * split has a stack to split. An unknown id leaves the list showing, with
     * a note. Returns true when a tutorial started.
     */
    async startRequest(request) {
        await waitFor(() => this.item() || document.querySelector('.mobile-layout-container'), URL_START_TIMEOUT_MS);
        const item = this.item();
        if (item) item.parentItem?.setActiveComponentItem?.(item, true);
        else eventBus.publish('ui:activatePanel', { panelId: COMPONENT_TYPE }, MODULE_ID);
        if (!TUTORIALS.some((e) => e.tutorial.id === request.id)) {
            this.notice = `No tutorial named "${request.id}" (from the page's ?${TUTORIAL_PARAM}= parameter).`;
            this.render();
            return false;
        }
        this.notice = null;
        this.start(request.id, request.index);
        return true;
    }

    async _loadSettings() {
        for (const k of Object.keys(DEFAULTS)) {
            this.settings[k] = await settingsManager.getSetting(SETTING(k), DEFAULTS[k]);
        }
        this.linkTarget = await settingsManager.getSetting('moduleSettings.quickLaunch.docsLinkTarget', DOCS_LINK_TARGETS.github);
    }

    /** The panel factories (desktopLayout.js, the mobile layout) mount this element. */
    getRootElement() {
        return this.root;
    }

    /** This panel's Golden Layout component item (null on the mobile layout). */
    item() {
        return componentItems(COMPONENT_TYPE).find((it) => it.container === this.container) ?? null;
    }

    // ── the tutorial's lifecycle ───────────────────────────────────────

    /** Start (or resume at `index`) a tutorial by id; splits the layout. */
    start(id, index = 0) {
        const entry = TUTORIALS.find((e) => e.tutorial.id === id);
        if (!entry) throw new Error(`no tutorial ${id}`);
        this.tutorial = entry.tutorial;
        this.steps = panelSteps(this.tutorial);
        this.doneSteps = new Set();
        this.index = Math.max(0, Math.min(index, this.steps.length - 1));
        if (isDesktopLayout()) splitOut(this.item());
        this._enterStep();
    }

    /** Back to the list. Merges the layout back and stops anything running. */
    exit() {
        this._stop();
        this.tutorial = null;
        this.steps = [];
        setOutline(null);
        hideCursor();
        mergeBack(this.item());
        this._saveProgress(null);
        this.render();
    }

    /** Go to a step (the ◀ / ▶ buttons, a click on a step): stops Play. */
    goTo(index) {
        if (this.playing) this._stop();
        this._goTo(index);
    }

    _goTo(index) {
        if (!this.tutorial) return;
        const i = Math.max(0, Math.min(index, this.steps.length - 1));
        this._clearTimers();
        this.index = i;
        this._enterStep();
    }

    current() {
        return this.steps[this.index] ?? null;
    }

    isLast() {
        return this.index >= this.steps.length - 1;
    }

    _enterStep() {
        this.status = '';
        this.ctx.markStep();
        this._saveProgress({ id: this.tutorial.id, index: this.index });
        this.render();
        this._watchDone();
        this._updateOutline();
    }

    _saveProgress(value) {
        this.saved = value;
        settingsManager.updateModuleSetting(MODULE_ID, PROGRESS_KEY, value)?.catch?.(() => {});
    }

    // ── done-polling and auto-advance ──────────────────────────────────

    _clearTimers() {
        clearInterval(this._pollTimer);
        clearTimeout(this._advanceTimer);
        this._pollTimer = null;
        this._advanceTimer = null;
    }

    _watchDone() {
        this._clearTimers();
        const entry = this.current();
        if (!entry?.step.done) return;
        const token = ++this._token;
        let checking = false;
        this._pollTimer = setInterval(async () => {
            if (checking || token !== this._token) return;
            checking = true;
            let ok = false;
            let failed = null;
            try { ok = Boolean(await entry.step.done(this.ctx)); } catch { ok = false; }
            if (!ok && entry.step.failed) {
                try { failed = (await entry.step.failed(this.ctx)) || null; } catch { failed = null; }
            }
            checking = false;
            if (token !== this._token) return;
            if (failed) {
                // The app says this step cannot finish: say so, and stop Play here.
                this._clearTimers();
                this.playing = false;
                this.status = `This step cannot finish: ${failed}`;
                hideCursor();
                this.render();
                return;
            }
            if (!ok) return;
            this._markDone(entry);
        }, DONE_POLL_MS);
    }

    _markDone(entry) {
        if (this.current() === entry) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
        this.doneSteps.add(entry.step.id);
        this.render();
        this._maybeAdvance();
    }

    /**
     * Move on when the current step is done — after the delay — if auto-advance
     * is on or Play is running. Waits while a "Do it" is still performing (a
     * step whose `done` turns true mid-perform advances once it returns).
     */
    _maybeAdvance() {
        const entry = this.current();
        if (!entry || this.busy || this._advanceTimer || !this.doneSteps.has(entry.step.id)) return;
        if (this.isLast()) {
            if (this.playing) {
                this.playing = false;
                this.status = 'Finished.';
                hideCursor();
                this.render();
            }
            return;
        }
        if (!this.settings.autoAdvance && !this.playing) return;
        this._advanceTimer = setTimeout(() => {
            this._advanceTimer = null;
            if (this.current() !== entry) return;
            this._goTo(this.index + 1);
            if (this.playing) this._playCurrent();
        }, this.settings.autoAdvanceDelayMs);
    }

    _updateOutline() {
        const entry = this.current();
        if (!entry || !this.settings.showOutline || this.busy) {
            setOutline(null);
            return;
        }
        const actions = entry.step.actions ?? [];
        if (!actions.length) {
            setOutline(null);
            return;
        }
        // Outline the next thing a person would press: the first action whose
        // target is not yet showing, else the last action's control.
        setOutline(() => {
            if (this.doneSteps.has(entry.step.id)) return null;
            for (const a of actions) {
                const next = nextPressable(a);
                if (next) return next;
            }
            return null;
        });
    }

    // ── performing ─────────────────────────────────────────────────────

    _opts() {
        return {
            animate: this.settings.animateCursor,
            moveMs: this.settings.cursorMoveMs,
            eventBus,
        };
    }

    /** Perform the current step (the "Do it" button). Resolves true when it was performed; `lastError` says why not. */
    async doIt() {
        const entry = this.current();
        if (!entry || this.busy || entry.step.outside) return;
        this.busy = true;
        this.status = 'Working…';
        setOutline(null);
        this.render();
        let ok = false;
        try {
            await performStep(entry.step, this.ctx, this._opts());
            ok = true;
            this.status = entry.step.done && !this.doneSteps.has(entry.step.id) ? 'Waiting for it to finish…' : '';
        } catch (e) {
            this.lastError = e;
            this.status = `Could not do this step: ${e.message}`;
            this.playing = false;
        } finally {
            this.busy = false;
            if (!this.playing) hideCursor();
        }
        if (ok && !entry.step.done) this._markDone(entry);
        else {
            this.render();
            this._maybeAdvance();
        }
        this._updateOutline();
        return ok;
    }

    _playCurrent() {
        if (!this.playing) return;
        const entry = this.current();
        if (this.doneSteps.has(entry.step.id)) {
            this._maybeAdvance();
            return;
        }
        if (entry.step.outside) {
            // Nothing to perform: wait for its done check (_watchDone is
            // already polling it), or hand over to the person.
            hideCursor();
            if (entry.step.done) {
                this.status = TEXT.outsideWaiting;
            } else {
                this.playing = false;
                this.status = TEXT.outsideStopped;
            }
            this.render();
            return;
        }
        this.doIt();
    }

    togglePlay() {
        if (this.playing) {
            this._stop();
            this.render();
            return;
        }
        this.playing = true;
        this.render();
        this._playCurrent();
    }

    _stop() {
        this.playing = false;
        clearTimeout(this._advanceTimer);
        this._advanceTimer = null;
        hideCursor();
    }

    toggleLayout() {
        const item = this.item();
        if (isSplit(item)) mergeBack(item);
        else splitOut(item);
        this.render();
    }

    async openQuickLaunch() {
        try { await performAction({ activate: QUICK_LAUNCH }, { animate: false, eventBus }); } catch { /* not open in this mode */ }
    }

    // ── drawing ────────────────────────────────────────────────────────

    render() {
        const top = this.root.scrollTop;
        this.root.replaceChildren(this.tutorial ? this._stepView() : this._listView());
        this.root.scrollTop = top;
        // Keep the current step in view when it changes (not on every re-render).
        const key = this.tutorial ? `${this.tutorial.id}#${this.index}` : null;
        if (key && key !== this._shownStep) {
            this.root.querySelector(`.${CONTROLS.current}`)?.scrollIntoView?.({ block: 'nearest' });
        }
        this._shownStep = key;
    }

    _listView() {
        const wrap = el('div', CONTROLS.list);
        wrap.append(el('h3', 'tut-heading', 'Tutorials'));
        if (this.notice) wrap.append(el('div', CONTROLS.status, this.notice));
        const ql = button(CONTROLS.quickLaunch, TEXT.quickLaunch, 'Open the Quick Launch panel', () => this.openQuickLaunch());
        const bar = el('div', 'tut-toolbar');
        bar.append(ql);
        wrap.append(bar);
        const all = TUTORIALS.map((e) => e.tutorial);
        const tracks = Object.entries(TRACKS);
        // Ready tutorials, under their track's heading (collapsed tracks aside).
        for (const [key, track] of tracks) {
            if (track.collapsed) continue;
            const list = all.filter((t) => t.track === key && t.status === 'ready');
            if (!list.length) continue;
            wrap.append(el('h4', 'tut-track', track.title));
            for (const t of list) wrap.append(this._card(t));
        }
        // ⚖ 2026-10-10: in-progress tutorials in a collapsed section …
        const drafts = all.filter((t) => t.status === 'in-progress' && !TRACKS[t.track].collapsed);
        if (drafts.length) {
            const box = this._section(CONTROLS.drafts, `${TEXT.drafts} (${drafts.length})`);
            for (const [key, track] of tracks) {
                const list = drafts.filter((t) => t.track === key);
                if (!list.length) continue;
                box.append(el('h4', 'tut-track', track.title));
                for (const t of list) box.append(this._card(t));
            }
            wrap.append(box);
        }
        // … and so are the developer ones (ready or not).
        for (const [key, track] of tracks) {
            if (!track.collapsed) continue;
            const list = all.filter((t) => t.track === key);
            if (!list.length) continue;
            const box = this._section(key === 'developer' ? CONTROLS.developer : `tut-track-${key}`, `${track.title} (${list.length})`);
            for (const t of list) box.append(this._card(t));
            wrap.append(box);
        }
        return wrap;
    }

    /** A collapsed section of the list that remembers being opened across re-renders. */
    _section(cls, title) {
        const d = el('details', `tut-collapsed ${cls}`);
        d.open = this.openSections.has(cls);
        d.append(el('summary', 'tut-collapsed-title', title));
        d.addEventListener('toggle', () => {
            if (d.open) this.openSections.add(cls);
            else this.openSections.delete(cls);
        });
        return d;
    }

    _card(tutorial) {
        const card = el('div', 'tut-card');
        card.dataset.tutorialId = tutorial.id;
        const title = el('div', 'tut-card-title', tutorial.title);
        if (tutorial.status === 'in-progress') title.append(' ', el('span', CONTROLS.badge, TEXT.inProgress));
        card.append(title, el('div', 'tut-card-text', tutorial.summary));
        const steps = panelSteps(tutorial);
        const blocked = blockedStep(tutorial, steps);
        if (blocked) {
            card.append(el('div', 'tut-card-blocked', blockedText(blocked, steps.length)));
        }
        const resume = this.saved?.id === tutorial.id;
        const row = el('div', 'tut-card-row');
        row.append(el('span', 'tut-card-count', `${steps.length} steps`));
        if (resume) {
            row.append(button(`${CONTROLS.start} tut-resume`, `${TEXT.resume} (step ${this.saved.index + 1})`,
                'Carry on where you left off', () => this.start(tutorial.id, this.saved.index)));
        }
        row.append(button(CONTROLS.start, resume ? 'Restart' : TEXT.start, 'Start this tutorial', () => this.start(tutorial.id)));
        card.append(row);
        return card;
    }

    _stepView() {
        const t = this.tutorial;
        const entry = this.current();
        const wrap = el('div', 'tut-run');
        wrap.dataset.tutorialId = t.id;

        const top = el('div', 'tut-toolbar');
        top.append(
            button(CONTROLS.exit, TEXT.exit, 'Stop this tutorial and go back to the list', () => this.exit()),
            el('span', 'tut-title', t.title),
        );
        if (isDesktopLayout()) {
            const split = isSplit(this.item());
            top.append(button(CONTROLS.layout, split ? TEXT.merge : TEXT.split,
                split ? 'Put this panel back into the stack above it' : 'Give this panel a stack of its own under the one it is in',
                () => this.toggleLayout()));
        }
        top.append(button(CONTROLS.quickLaunch, TEXT.quickLaunch, 'Open the Quick Launch panel', () => this.openQuickLaunch()));
        const head = el('div', 'tut-head');
        head.append(top);

        const nav = el('div', 'tut-toolbar tut-nav');
        const prev = button(CONTROLS.prev, TEXT.prev, 'The previous step', () => this.goTo(this.index - 1));
        prev.disabled = this.index === 0 || this.busy;
        const next = button(CONTROLS.next, TEXT.next, 'The next step', () => this.goTo(this.index + 1));
        next.disabled = this.isLast() || this.busy;
        const outside = Boolean(entry.step.outside);
        const doIt = button(CONTROLS.doIt, TEXT.doIt,
            outside ? 'This step happens outside the app, so the panel cannot do it' : 'Perform this step for me', () => this.doIt());
        doIt.disabled = outside || this.busy || this.playing || this.doneSteps.has(entry.step.id);
        const play = button(CONTROLS.play, this.playing ? TEXT.pause : TEXT.play,
            this.playing ? 'Stop after this step' : 'Perform every step from here, one after another', () => this.togglePlay());
        nav.append(prev, el('span', CONTROLS.position, `Step ${this.index + 1} of ${this.steps.length}`), next, doIt, play);
        head.append(nav, el('div', CONTROLS.status, this.status));
        wrap.append(head);
        const blocked = blockedStep(t, this.steps);
        if (t.status === 'in-progress') {
            wrap.append(el('div', CONTROLS.banner, blocked
                ? `In progress: ${blockedText(blocked, this.steps.length)}`
                : 'In progress: every step works, but the tutorial is not finished yet.'));
        }

        const sec = entry.section;
        const body = el('div', 'tut-section');
        body.append(el('h4', 'tut-section-title', sec.title));
        let n = 0;
        let list = null;
        for (const b of blocksFor(sec.blocks, 'panel')) {
            if (b.prose !== undefined) {
                list = null;
                body.append(proseBlock(b.prose, t.doc, this.linkTarget));
                continue;
            }
            if (!list) {
                list = el('ol', 'tut-steps');
                body.append(list);
            }
            n += 1;
            const s = b.step;
            const li = richText('li', CONTROLS.step, s.text, t.doc, this.linkTarget);
            li.dataset.stepId = s.id;
            li.value = n;
            if (s === entry.step) li.classList.add(CONTROLS.current);
            if (this.doneSteps.has(s.id)) li.classList.add(CONTROLS.done);
            if (blocked?.step === s) {
                li.classList.add(CONTROLS.blocked);
                li.title = 'This step does not work yet';
            }
            if (s.command) li.append(this._commandBox(s.command));
            const target = this.steps.findIndex((x) => x.step === s);
            if (!li.title) li.title = 'Go to this step';
            li.addEventListener('click', (ev) => {
                if (ev.target.closest('a')) return;
                this.goTo(target);
            });
            list.append(li);
        }
        wrap.append(body);
        if (this.isLast() && this.doneSteps.has(entry.step.id) && t.outro) {
            const out = el('div', 'tut-section tut-outro');
            out.append(el('h4', 'tut-section-title', t.outro.title));
            for (const b of blocksFor(t.outro.blocks, 'panel')) out.append(proseBlock(b.prose, t.doc, this.linkTarget));
            wrap.append(out);
        }
        return wrap;
    }

    /** An outside step's command, with a Copy button. */
    _commandBox(command) {
        const box = el('div', CONTROLS.command);
        box.append(el('pre', null, command));
        const copy = button(CONTROLS.copy, TEXT.copy, 'Copy the command', async (ev) => {
            ev.stopPropagation();
            try {
                await navigator.clipboard.writeText(command);
                copy.textContent = TEXT.copied;
            } catch { /* no clipboard permission: the text is selectable */ }
        });
        box.append(copy);
        return box;
    }

    destroy() {
        if (TutorialUI.instance === this) TutorialUI.instance = null;
        this._clearTimers();
        this.ctx.dispose();
        this.playing = false;
        setOutline(null);
        hideCursor();
        for (const u of this._unsubs) u?.();
        this._unsubs = [];
    }
}
