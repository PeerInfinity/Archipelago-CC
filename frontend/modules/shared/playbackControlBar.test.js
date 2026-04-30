import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackControlBar } from './playbackControlBar.js';

// Vitest runs under the 'node' environment (no DOM). The control bar
// is a pure DOM widget; we install jsdom-style globals via a tiny
// shim so the same tests verify wiring rather than just construction.

class FakeElement {
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.attributes = {};
        this.style = {};
        this.classList = makeClassList();
        this._listeners = {};
        this.parentNode = null;
        this.disabled = false;
        this.value = '';
        this.type = '';
        this.min = '';
        this.max = '';
        this.step = '';
        this.title = '';
        this.textContent = '';
        this.htmlFor = '';
        this.className = '';
        this.onclick = null;
    }
    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }
    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) this.children.splice(idx, 1);
        child.parentNode = null;
        return child;
    }
    addEventListener(name, fn) {
        if (!this._listeners[name]) this._listeners[name] = [];
        this._listeners[name].push(fn);
    }
    removeEventListener(name, fn) {
        const list = this._listeners[name];
        if (!list) return;
        const idx = list.indexOf(fn);
        if (idx !== -1) list.splice(idx, 1);
    }
    dispatch(name) {
        const list = this._listeners[name] || [];
        for (const fn of list) fn();
    }
    click() {
        if (this.onclick) this.onclick();
    }
    queryAll(predicate, out = []) {
        for (const child of this.children) {
            if (predicate(child)) out.push(child);
            child.queryAll(predicate, out);
        }
        return out;
    }
    findButton(title) {
        return this.queryAll((el) => el.tagName === 'BUTTON' && el.title === title)[0];
    }
}

function makeClassList() {
    const set = new Set();
    return {
        add: (c) => set.add(c),
        remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
        toggle: (c) => { set.has(c) ? set.delete(c) : set.add(c); },
    };
}

const fakeDocument = {
    createElement(tag) { return new FakeElement(tag); },
};

beforeEach(() => {
    globalThis.document = fakeDocument;
});
afterEach(() => {
    delete globalThis.document;
});

describe('PlaybackControlBar', () => {
    it('mounts with the four control buttons', () => {
        const bar = new PlaybackControlBar({});
        const root = bar.getElement();
        expect(root).toBeTruthy();
        for (const title of ['Instant', 'Step', 'Play', 'Stop']) {
            expect(root.findButton(title)).toBeTruthy();
        }
    });

    it('wires action callbacks for each button', () => {
        const actions = {
            instant: vi.fn(),
            step: vi.fn(),
            play: vi.fn(),
            stop: vi.fn(),
        };
        const bar = new PlaybackControlBar({ actions, initialRate: 5 });
        const root = bar.getElement();

        root.findButton('Instant').click();
        expect(actions.instant).toHaveBeenCalledTimes(1);

        root.findButton('Step').click();
        expect(actions.step).toHaveBeenCalledTimes(1);

        root.findButton('Play').click();
        expect(actions.play).toHaveBeenCalledWith(5);

        // Stop is disabled while not running, but the action still fires
        // if invoked programmatically. Simulate "user pressed stop after
        // we marked running".
        bar.setRunning(true);
        root.findButton('Stop').click();
        expect(actions.stop).toHaveBeenCalledTimes(1);
    });

    it('reflects running state by toggling button disabled flags', () => {
        const bar = new PlaybackControlBar({});
        const root = bar.getElement();
        const playBtn = root.findButton('Play');
        const stopBtn = root.findButton('Stop');

        expect(playBtn.disabled).toBe(false);
        expect(stopBtn.disabled).toBe(true);

        bar.setRunning(true);
        expect(playBtn.disabled).toBe(true);
        expect(stopBtn.disabled).toBe(false);
        expect(root.classList.contains('is-running')).toBe(true);

        bar.setRunning(false);
        expect(playBtn.disabled).toBe(false);
        expect(stopBtn.disabled).toBe(true);
        expect(root.classList.contains('is-running')).toBe(false);
    });

    it('keeps slider and number input in sync via setRate', () => {
        const bar = new PlaybackControlBar({ initialRate: 4 });
        const root = bar.getElement();
        const slider = root.queryAll((el) => el.tagName === 'INPUT' && el.type === 'range')[0];
        const numberInput = root.queryAll((el) => el.tagName === 'INPUT' && el.type === 'number')[0];

        bar.setRate(10);
        expect(slider.value).toBe('10');
        expect(numberInput.value).toBe('10');
        expect(bar.getRate()).toBe(10);
    });

    it('clamps out-of-range rates', () => {
        const bar = new PlaybackControlBar({ initialRate: 4 });
        bar.setRate(0.01);
        expect(bar.getRate()).toBeGreaterThanOrEqual(0.5);
        bar.setRate(99999);
        expect(bar.getRate()).toBeLessThanOrEqual(30);
    });

    it('dispatches setRate when the slider is moved', () => {
        const setRate = vi.fn();
        const bar = new PlaybackControlBar({ actions: { setRate }, initialRate: 4 });
        const root = bar.getElement();
        const slider = root.queryAll((el) => el.tagName === 'INPUT' && el.type === 'range')[0];

        slider.value = '12';
        slider.dispatch('input');
        expect(setRate).toHaveBeenCalledWith(12);
        expect(bar.getRate()).toBe(12);
    });

    it('destroy() removes the element from its parent and detaches listeners', () => {
        const bar = new PlaybackControlBar({});
        const parent = new FakeElement('div');
        parent.appendChild(bar.getElement());

        expect(parent.children.length).toBe(1);
        bar.destroy();
        expect(parent.children.length).toBe(0);
        expect(bar.getElement()).toBe(null);
    });

    it('survives construction in a headless environment', () => {
        delete globalThis.document;
        const bar = new PlaybackControlBar({});
        expect(bar.getElement()).toBe(null);
        // Methods should not throw when DOM isn't there.
        expect(() => bar.setRate(7)).not.toThrow();
        expect(() => bar.setRunning(true)).not.toThrow();
        expect(() => bar.destroy()).not.toThrow();
        // restore for afterEach cleanup
        globalThis.document = fakeDocument;
    });
});
