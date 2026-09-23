/**
 * ⛔⛔ **EVERY EVENT THIS MODULE PUBLISHES MUST BE REGISTERED, AND THE BUS
 * FAILS THIS SILENTLY** (EDITOR INTEGRATION P1-e; plan §17.5).
 *
 * `app/core/eventBus.js:126-129` checks the publisher registry and `return`s —
 * it does NOT throw — so an unregistered publish is a `warn` in the console and
 * a subscriber that is simply never called. MEASURED on the real page: the
 * glue's `stats.itemsFound` counted the find, the panel log carried the line
 * (written by the glue's own `_log`, not by the subscriber), and the readout
 * element stayed empty. The event had been unregistered since M1 introduced it,
 * invisible because nothing in production published it until P1 wired the check
 * binding.
 *
 * ⇒ this row asks the module's OWN `register()` what it declares, and requires
 * every event the module publishes to be among them. It runs in node against
 * the real function with a recording API — no browser, no bus.
 */
import { describe, expect, it } from 'vitest';

import { initialize, register, setActivePanelInstance } from './index.js';
import { AP_ITEM_FOUND_EVENT } from './seedlingRegionGlue.js';
import { FLASH_SEEDLING_LOAD_REGION_EVENT } from './flashSeedlingLibrary.js';

/** A registrationApi that records rather than registers. */
function recordRegistration() {
    const seen = { publishers: [], subscriberIntents: [], other: [] };
    /**
     * ⛓ A PROXY, so a NEW registration call this test does not know about is
     * RECORDED rather than throwing. A hand-written stub would have to be
     * updated every time `register()` learns a new verb, and the day it was not
     * would be the day this row stopped running.
     */
    const api = new Proxy({}, {
        get: (_t, name) => (...a) => {
            if (name === 'registerEventBusPublisher') seen.publishers.push(a[0]);
            else if (name === 'registerEventBusSubscriberIntent') seen.subscriberIntents.push(a[0]);
            else seen.other.push(String(name));
        },
    });
    register(api);
    return seen;
}

describe('the flashPanel module\'s bus registration', () => {
    const seen = recordRegistration();

    /**
     * ⛓ THE ONE THIS FILE EXISTS FOR. Without it the panel's *"found X for
     * Player Y"* readout can never be reached, and NOTHING says so — not a
     * throw, not a failing row, not the glue's own counter.
     */
    it('declares a PUBLISHER for the AP item-found readout event', () => {
        expect(seen.publishers).toContain(AP_ITEM_FOUND_EVENT);
    });

    it('…and a SUBSCRIBER intent for it, because the panel listens too', () => {
        expect(seen.subscriberIntents).toContain(AP_ITEM_FOUND_EVENT);
    });

    it('still declares the substrate load-region intent it always had', () => {
        expect(seen.subscriberIntents).toContain(FLASH_SEEDLING_LOAD_REGION_EVENT);
    });

    /**
     * ⛔ AND THE GENERAL FORM, so a NEW event cannot repeat this. Every event
     * name the module's own source publishes through the module bus must be
     * declared. The set is read out of the source rather than typed here, so
     * adding a `publish(SOME_EVENT, …)` and forgetting the registration reds
     * this row rather than shipping a silent no-op.
     */
    it('every event the module PUBLISHES is registered — derived, not typed', async () => {
        const { readFileSync } = await import('node:fs');
        const { fileURLToPath } = await import('node:url');
        const src = ['./seedlingRegionGlue.js', './index.js', './flashPanelUI.js']
            .map((rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'))
            .join('\n');
        // `eventBus.publish(X, …)` / `this.eventBus?.publish?.(X, …)` — the
        // identifier or literal in first position.
        const published = new Set();
        for (const m of src.matchAll(/publish(?:As)?\??\.?\(\s*([A-Z_][A-Z0-9_]*)\s*,/g)) {
            published.add(m[1]);
        }
        // Resolve the constants this module owns to their values.
        const known = { AP_ITEM_FOUND_EVENT, FLASH_SEEDLING_LOAD_REGION_EVENT };
        const names = [...published].filter((n) => n in known).map((n) => known[n]);
        expect(names.length).toBeGreaterThan(0);
        for (const event of names) {
            expect(seen.publishers, `${event} is published but not registered`).toContain(event);
        }
    });
});

/**
 * ⛓ SEEDLING T2b (U1) — a `flashSeedling:loadRegion` brings the panel forward,
 * as every other substrate panel's load does. Driven through the module's real
 * `initialize()` with a recording bus: the handler that runs is the one the
 * page subscribes, not a helper called by hand.
 */
describe('the flashPanel module activates itself on a region load (U1)', () => {
    function boot({ locked = false } = {}) {
        const subs = new Map();
        const published = [];
        const bus = {
            subscribe: (ev, fn) => { subs.set(ev, [...(subs.get(ev) ?? []), fn]); return () => {}; },
            unsubscribe: () => {},
            publish: (ev, data) => published.push({ ev, data }),
        };
        const stop = initialize('flashPanel', 0, {
            getDispatcher: () => null,
            getEventBus: () => bus,
            getModuleFunction: (mod, fn) => (mod === 'loops' && fn === 'isFocusLocked' ? () => locked : null),
        });
        const fire = (ev, payload) => { for (const fn of subs.get(ev) ?? []) fn(payload); };
        return { published, fire, stop };
    }

    it('registers the ui:activatePanel publisher it needs', () => {
        expect(recordRegistration().publishers).toContain('ui:activatePanel');
    });

    it('a region load publishes ui:activatePanel for the flash panel', () => {
        const { published, fire, stop } = boot();
        fire(FLASH_SEEDLING_LOAD_REGION_EVENT, { region_id: 'r', world: null });
        stop();
        expect(published.filter((p) => p.ev === 'ui:activatePanel'))
            .toEqual([{ ev: 'ui:activatePanel', data: { panelId: 'flashPanel' } }]);
    });

    it('…and gives the GAME the keyboard with it (U2a): the load asks the panel to focus the game', () => {
        const asked = [];
        setActivePanelInstance({ focusGame: (why) => asked.push(why) });
        const { fire, stop } = boot();
        fire(FLASH_SEEDLING_LOAD_REGION_EVENT, { region_id: 'r', world: null });
        stop();
        setActivePanelInstance(null);
        expect(asked).toEqual(['a region load activated the panel']);
    });

    it('…neither the tab nor the keyboard under a focus lock', () => {
        const asked = [];
        setActivePanelInstance({ focusGame: (why) => asked.push(why) });
        const { fire, stop } = boot({ locked: true });
        fire(FLASH_SEEDLING_LOAD_REGION_EVENT, { region_id: 'r', world: null });
        stop();
        setActivePanelInstance(null);
        expect(asked).toEqual([]);
    });

    it('…and does NOT when loops pins another panel (isFocusLocked)', () => {
        const { published, fire, stop } = boot({ locked: true });
        fire(FLASH_SEEDLING_LOAD_REGION_EVENT, { region_id: 'r', world: null });
        stop();
        expect(published.filter((p) => p.ev === 'ui:activatePanel')).toEqual([]);
    });
});
