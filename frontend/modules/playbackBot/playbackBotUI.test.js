import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class FakeElement {
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this._listeners = {};
        this.classList = (() => {
            const set = new Set();
            return {
                add: (c) => set.add(c),
                remove: (c) => set.delete(c),
                contains: (c) => set.has(c),
                toggle: (c) => { set.has(c) ? set.delete(c) : set.add(c); },
            };
        })();
        this.parentNode = null;
        this.disabled = false;
        this.value = '';
        this.type = '';
        this.title = '';
        this.textContent = '';
        this.className = '';
        this.onclick = null;
        this.innerHTML = '';
    }
    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }
    insertBefore(child, before) {
        child.parentNode = this;
        const idx = this.children.indexOf(before);
        if (idx === -1) this.children.push(child);
        else this.children.splice(idx, 0, child);
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
    removeEventListener() {}
    queryAll(predicate, out = []) {
        for (const child of this.children) {
            if (predicate(child)) out.push(child);
            child.queryAll?.(predicate, out);
        }
        return out;
    }
    findButton(title) {
        return this.queryAll((el) => el.tagName === 'BUTTON' && el.title === title)[0];
    }
}

const fakeDocument = {
    createElement(tag) { return new FakeElement(tag); },
};

beforeEach(() => { globalThis.document = fakeDocument; });
afterEach(() => { delete globalThis.document; });

import { PlaybackBotUI } from './playbackBotUI.js';

const SAMPLE_SPHERE_DATA = [
    { sphereIndex: 0, fractionalIndex: 0, locations: [], accessibleRegions: ['Menu', 'Overworld'], accessibleLocations: ['Free Loc'] },
    { sphereIndex: 0, fractionalIndex: 1, locations: ['Free Loc'], accessibleRegions: [], accessibleLocations: ['Locked Loc'] },
    { sphereIndex: 1, fractionalIndex: 1, locations: ['Locked Loc'], accessibleRegions: [], accessibleLocations: [] },
];

describe('PlaybackBotUI — initialization', () => {
    it('mounts with control bar + cursor + log', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA });
        const root = bot.getElement();
        expect(root).toBeTruthy();
        expect(root.findButton('Step')).toBeTruthy();
        expect(root.findButton('Play')).toBeTruthy();
        expect(root.findButton('Reset')).toBeTruthy();
    });

    it('starts with cursor at 0/N (idle)', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA });
        const cursor = bot.getElement().queryAll((el) => el.className === 'playback-bot-cursor')[0];
        expect(cursor.textContent).toMatch(/Cursor: idle/);
    });

    it('reports no sphere log when data is empty', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => [] });
        const cursor = bot.getElement().queryAll((el) => el.className === 'playback-bot-cursor')[0];
        expect(cursor.textContent).toMatch(/No sphere log loaded/);
    });
});

describe('PlaybackBotUI — stepping', () => {
    it('step() advances the cursor by one entry', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA });
        bot.step();
        const cursor = bot.getElement().queryAll((el) => el.className === 'playback-bot-cursor')[0];
        expect(cursor.textContent).toMatch(/Cursor: 1 \/ 3/);
    });

    it('instant() advances to the end and marks complete', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA });
        bot.instant();
        const cursor = bot.getElement().queryAll((el) => el.className === 'playback-bot-cursor')[0];
        expect(cursor.textContent).toMatch(/complete/);
    });

    it('reset() returns the cursor to idle and clears the log', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA });
        bot.step();
        bot.step();
        bot.reset();
        const cursor = bot.getElement().queryAll((el) => el.className === 'playback-bot-cursor')[0];
        expect(cursor.textContent).toMatch(/idle/);
    });

    it('appends a step entry to the log on each step', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA });
        bot.step();
        bot.step();
        const logRows = bot.getElement().queryAll((el) => el.className?.startsWith('playback-bot-log-entry'));
        expect(logRows.length).toBe(2);
    });

    it('emits a done entry when stepping past the end', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA });
        for (let i = 0; i < SAMPLE_SPHERE_DATA.length + 2; i++) bot.step();
        const logRows = bot.getElement().queryAll((el) => el.className === 'playback-bot-log-entry playback-bot-log-done');
        expect(logRows.length).toBeGreaterThanOrEqual(1);
    });
});

describe('PlaybackBotUI — completion handling', () => {
    it('caps cursor at data.length and reports complete', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA });
        bot.instant();
        const cursor = bot.getElement().queryAll((el) => el.className === 'playback-bot-cursor')[0];
        expect(cursor.textContent).toMatch(/3 \/ 3/);
        expect(cursor.textContent).toMatch(/complete/);
    });
});
