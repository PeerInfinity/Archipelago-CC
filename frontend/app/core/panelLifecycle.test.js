/**
 * seedling-pipeline T4 (finding 2, trap 1404) — **A PANEL'S `onShow` IS CALLED ON
 * A TAB SWITCH.**
 *
 * MEASURED at `874ee020ea`: `panelManager.registerPanelComponent`'s wrapper wired
 * `container.on('show', () => uiProvider.onShow())`, but nothing registers
 * through it. The factories Golden Layout actually builds panels with are
 * `desktopLayout.js`'s and the dynamic-enable one in `initialization/index.js`,
 * and neither wired `show`/`hide`/`resize`. So a provider's `onShow` never ran
 * on a tab switch (T2b: 0 calls in 2 clicks), and panels wired their own
 * `container.on('show')`.
 *
 * These rows drive the LIVE desktop factory over a fake container that emits
 * the way Golden Layout's `ComponentContainer` does (`on(name, cb)`, `emit`).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import eventBus from './eventBus.js';
import { wirePanelLifecycle } from './panelManager.js';
import { createGoldenLayoutComponentFactory } from '../layout/desktopLayout.js';
import {
    PANEL_SHOWN_EVENT,
    TextAdventureSubstrateWrapperPanel,
} from '../../modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapperPanel.js';

const REPO = new URL('../../../', import.meta.url);
const source = (rel) => readFileSync(fileURLToPath(new URL(rel, REPO)), 'utf8');
const code = (rel) => source(rel).split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line)).join('\n');

/** Golden Layout's container surface, as far as a factory touches it. */
function fakeContainer() {
    const listeners = new Map();
    return {
        element: { innerHTML: '', children: [], append(el) { this.children.push(el); } },
        on(name, cb) { (listeners.get(name) ?? listeners.set(name, []).get(name)).push(cb); },
        emit(name) { for (const cb of listeners.get(name) ?? []) cb(); },
        count(name) { return (listeners.get(name) ?? []).length; },
    };
}

const quiet = { debug() {}, info() {}, warn() {}, error() {} };

describe('the desktop factory wires the provider\'s lifecycle onto the container', () => {
    let savedHTMLElement;
    beforeEach(() => {
        savedHTMLElement = globalThis.HTMLElement;
        globalThis.HTMLElement = class {};
    });
    afterEach(() => { globalThis.HTMLElement = savedHTMLElement; });

    const build = (Provider) => {
        const container = fakeContainer();
        const factory = createGoldenLayoutComponentFactory(
            'somePanel', { componentClass: Provider, moduleId: 'someModule' }, quiet, () => {});
        factory(container, {});
        return container;
    };

    it('⛔ a `show` on the container calls the provider\'s onShow — once per show', () => {
        const calls = { show: 0, hide: 0, resize: 0 };
        class P {
            getRootElement() { return new HTMLElement(); }
            onShow() { calls.show += 1; }
            onHide() { calls.hide += 1; }
            onResize() { calls.resize += 1; }
        }
        const c = build(P);
        expect(c.element.children).toHaveLength(1);
        c.emit('show');
        c.emit('show');
        c.emit('hide');
        c.emit('resize');
        expect(calls).toEqual({ show: 2, hide: 1, resize: 1 });
    });

    it('a provider without the methods gets no listener', () => {
        class P { getRootElement() { return new HTMLElement(); } }
        const c = build(P);
        expect(c.count('show') + c.count('hide') + c.count('resize')).toBe(0);
    });

    it('the provider\'s `this` is the provider', () => {
        let seen = null;
        class P {
            getRootElement() { return new HTMLElement(); }
            onShow() { seen = this; }
        }
        const c = build(P);
        c.emit('show');
        expect(seen).toBeInstanceOf(P);
    });
});

describe('wirePanelLifecycle — the one wiring every factory shares', () => {
    it('wires exactly the methods the provider has, and says which', () => {
        const c = fakeContainer();
        const hits = [];
        expect(wirePanelLifecycle(c, { onShow: () => hits.push('show') })).toEqual(['show']);
        c.emit('show');
        c.emit('hide');
        expect(hits).toEqual(['show']);
        expect(wirePanelLifecycle(fakeContainer(), null)).toEqual([]);
        expect(wirePanelLifecycle(null, { onShow() {} })).toEqual([]);
    });
});

/**
 * ⛓ WHAT THE WIRING NEWLY REACHES. Two providers in the tree define onShow: the
 * flash panel (which wired it itself, retired below) and the text-adventure
 * wrapper, whose onShow had NEVER run. Measured in the browser once the wiring
 * reached it: it threw `Module name is required for eventBus.publish()` on
 * every show, inside Golden Layout's emit.
 */
describe('a provider\'s lifecycle throw is contained, and the wrapper\'s onShow no longer throws', () => {
    it('⛔ a throwing onShow does not escape the emit, and later listeners still run', () => {
        const c = fakeContainer();
        wirePanelLifecycle(c, { onShow() { throw new Error('boom'); } });
        let after = 0;
        c.on('show', () => { after += 1; });
        const saved = console.error;
        console.error = () => {};
        try { expect(() => c.emit('show')).not.toThrow(); } finally { console.error = saved; }
        expect(after).toBe(1);
    });

    it('⛔ the text-adventure wrapper\'s onShow publishes its event (named), and does not throw', () => {
        let heard = 0;
        const cb = () => { heard += 1; };
        // the module's register() does this in the app (`registerEventBusPublisher`)
        eventBus.registerPublisher(PANEL_SHOWN_EVENT, 'textAdventureSubstrateWrapper');
        eventBus.subscribe(PANEL_SHOWN_EVENT, cb, 'panelLifecycle.test');
        try {
            expect(() => TextAdventureSubstrateWrapperPanel.prototype.onShow.call({})).not.toThrow();
        } finally {
            eventBus.unsubscribe(PANEL_SHOWN_EVENT, cb, 'panelLifecycle.test');
        }
        expect(heard).toBe(1);
    });
});

/**
 * ⛔ ASSERTED OVER THE SOURCE: the dynamic-enable factory lives inside
 * `initialization/index.js`'s `enableModule`, which has no node moment. The live
 * proof for the desktop path is the rows above plus the spiral gate's D3.
 */
describe('every live Golden Layout factory calls it', () => {
    it('the dynamic-enable factory in initialization/index.js', () => {
        const body = code('frontend/app/initialization/index.js');
        const at = body.indexOf('[Dynamic Enable] Creating component');
        expect(at).toBeGreaterThan(0);
        const factory = body.slice(at, body.indexOf('[Dynamic Enable] Error instantiating component', at));
        expect(factory).toMatch(/wirePanelLifecycle\(container, uiProvider\)/);
    });

    it('panelManager\'s own wrapper uses the same wiring (no second spelling)', () => {
        const body = code('frontend/app/core/panelManager.js');
        expect(body).toMatch(/wirePanelLifecycle\(container, this\.uiProvider\)/);
        expect(body).not.toMatch(/container\.on\('show', \(\) => this\.uiProvider\.onShow\(\)\)/);
    });

    /**
     * ⛓ THE RETIRED DUPLICATE. The flash panel wired its own
     * `this.container.on('show', () => this.onShow())` because the factory did
     * not; with the factory wiring it, keeping both would run onShow TWICE per
     * tab switch. Its own wiring is retired; the other panels' own wirings call
     * PRIVATE handlers (`onPanelShow`, `_handlePanelShow`, …), which the factory
     * does not reach, so they stay.
     */
    it('no panel both defines onShow AND wires it onto its container itself', () => {
        const out = execFileSync('git', ['ls-files', '-z', 'frontend/modules', 'frontend/app'],
            { cwd: fileURLToPath(REPO), encoding: 'utf8' })
            .split('\0').filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));
        const definers = out.filter((f) => /^\s+onShow\(\) \{/m.test(code(f)));
        // the walk is not vacuous: the two providers with an onShow are found
        expect(definers).toEqual(expect.arrayContaining([
            'frontend/modules/flashPanel/flashPanelUI.js',
            'frontend/modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapperPanel.js',
        ]));
        for (const f of definers) {
            expect(code(f), f).not.toMatch(/container\??\.on\??\.?\(\s*'show',\s*\(\) => this\.onShow\(\)\)/);
        }
    });
});
