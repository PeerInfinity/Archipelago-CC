/**
 * apworldEditor/reverseLinks — **THE TWO DOORS THAT POINT *AT* THE HUB**
 * (APWorld editor hub, H4c; plan §3 idea 6, *"reverse links everywhere"*).
 *
 * Six controls now carry the label "Open in APWorld Editor" — the Presets
 * screen, the procgen pipeline, the marking tool, both lab pages and the bounce
 * editor — and every one of them is somewhere else in the tree. What this file
 * drives is the HUB'S OWN SIDE of both: the module-level stash that catches a
 * hand-off arriving before anybody has opened the panel, and the bounce
 * editor's publisher.
 *
 * ⛔⛔ **THE STASH IS THE CLAIM, NOT A CONVENIENCE.** The panel's subscription
 * lives on the PANEL; the module's `initialize()` always runs and the panel's
 * does not. A door pressed while the hub has never been opened publishes into
 * nothing — which is precisely the shape of the defect H4b met on the bus
 * (`procgenLab:levelChanged` skipped with only a warn line): the press reports
 * success and the reader gets a panel showing something else.
 *
 * ⚠ NO DOM. `apworldEditorUI.js` is driven by the in-app row
 * (`apworld-bounce-editor-reverse-link-selects-the-region`) and by
 * `hubExits.test.js`'s source reading; this file is about the two MODULES.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/** ⛓ A bus stand-in with the MODULE shape (two-argument publish + subscribe). */
const fakeBus = () => {
    const subs = new Map();
    const published = [];
    return {
        published,
        subs,
        publish(event, data) { published.push({ event, data }); },
        subscribe(event, cb) {
            if (!subs.has(event)) subs.set(event, []);
            subs.get(event).push(cb);
        },
        send(event, data) { for (const cb of subs.get(event) ?? []) cb(data); },
    };
};

describe('the hub module — a hand-off that arrives before the panel exists', () => {
    let mod;
    let bus;

    beforeEach(async () => {
        vi.resetModules();
        mod = await import('./index.js');
        bus = fakeBus();
        await mod.initialize('apworldEditor', 0, { getEventBus: () => bus });
    });

    it('⛓ stashes the DOCUMENT and the door it came through', () => {
        bus.send(mod.APWORLD_EDITOR_LOAD_RULES,
            { jsonData: { game_name: 'X' }, source: 'the maze lab (SET arm)' });
        expect(mod.consumePendingEditorRules())
            .toEqual({ jsonData: { game_name: 'X' }, source: 'the maze lab (SET arm)' });
        // ⛔ ONE-SHOT: a second read is `null`, so a stash cannot go stale.
        expect(mod.consumePendingEditorRules()).toBe(null);
    });

    /**
     * ⛓ THE TWO DOORS THAT PREDATE H4c SEND NO `source`, and `null` is the
     * honest answer — the panel then files the session as plain `hand-off`
     * rather than under a name this module invented for them.
     */
    it('⛓ a publisher that names no source stashes `source: null`', () => {
        bus.send(mod.APWORLD_EDITOR_LOAD_RULES, { jsonData: { game_name: 'X' } });
        expect(mod.consumePendingEditorRules()).toEqual({ jsonData: { game_name: 'X' }, source: null });
    });

    it('⛔ ignores an empty hand-off rather than stashing a document-shaped hole', () => {
        bus.send(mod.APWORLD_EDITOR_LOAD_RULES, { source: 'somewhere' });
        bus.send(mod.APWORLD_EDITOR_LOAD_RULES, null);
        expect(mod.consumePendingEditorRules()).toBe(null);
    });

    it('⛓ stashes a region SELECTION, with its optional slot', () => {
        bus.send(mod.APWORLD_EDITOR_SELECT_REGION, { region: 'region_1_0', player: '3' });
        expect(mod.consumePendingSelectRegion()).toEqual({ region: 'region_1_0', player: '3' });
        expect(mod.consumePendingSelectRegion()).toBe(null);
    });

    /**
     * ⛓ `player` IS OPTIONAL AND `null` MEANS "whichever slot the hub shows".
     * The bounce editor is opened on ONE region and does not carry the slot it
     * came from; a default of `'1'` here would be a guess wearing the caller's
     * name.
     */
    it('⛓ a selection with no slot stashes `player: null`', () => {
        bus.send(mod.APWORLD_EDITOR_SELECT_REGION, { region: 'Hall' });
        expect(mod.consumePendingSelectRegion()).toEqual({ region: 'Hall', player: null });
    });

    it('⛔ refuses a selection that names no region — an empty name selects nothing', () => {
        bus.send(mod.APWORLD_EDITOR_SELECT_REGION, { region: '' });
        bus.send(mod.APWORLD_EDITOR_SELECT_REGION, { region: 7 });
        bus.send(mod.APWORLD_EDITOR_SELECT_REGION, {});
        expect(mod.consumePendingSelectRegion()).toBe(null);
    });

    /**
     * ⛓⛓ THE TWO STASHES ARE INDEPENDENT SLOTS. A reader who pressed *"open in
     * the APWorld editor"* on a lab page and then *"open in the APWorld editor"*
     * on the bounce panel has said two different things, and a single slot would
     * make the second erase the first.
     */
    it('⛓ the document stash and the selection stash do not share a slot', () => {
        bus.send(mod.APWORLD_EDITOR_LOAD_RULES, { jsonData: { game_name: 'X' } });
        bus.send(mod.APWORLD_EDITOR_SELECT_REGION, { region: 'Hall' });
        expect(mod.consumePendingEditorRules()?.jsonData).toEqual({ game_name: 'X' });
        expect(mod.consumePendingSelectRegion()?.region).toBe('Hall');
    });
});

describe('the bounce editor — "Open in APWorld Editor"', () => {
    let bounce;

    beforeEach(async () => {
        vi.resetModules();
        globalThis.document = {
            head: { appendChild() {} },
            createElement: () => ({ set rel(_v) {}, set href(_v) {} }),
        };
        bounce = await import('../bounceRegionEditor/index.js');
    });

    /**
     * ⛔⛔ **THE BUS DROPS AN UNREGISTERED PUBLISHER** — a warn line and no
     * throw. So the door has to be DECLARED, and this row reads the module's
     * own declaration rather than trusting that somebody remembered.
     */
    it('⛔ declares itself the publisher of `apworldEditor:selectRegion`', () => {
        const seen = [];
        bounce.register({
            registerPanelComponent() {},
            registerEventBusPublisher(e) { seen.push(e); },
        });
        expect(seen).toContain('apworldEditor:selectRegion');
        expect(seen).toContain('ui:activatePanel');
        expect(bounce.APWORLD_EDITOR_SELECT_REGION).toBe('apworldEditor:selectRegion');
    });

    it('⛓ names the region, THEN raises the hub — and carries no document', async () => {
        const bus = fakeBus();
        await bounce.initialize('bounceRegionEditor', 0, { getEventBus: () => bus });
        expect(bounce.openRegionInApworldEditor('region_1_0')).toBe(true);
        expect(bus.published.map((p) => p.event))
            .toEqual(['apworldEditor:selectRegion', 'ui:activatePanel']);
        expect(bus.published[0].data).toEqual({ region: 'region_1_0', player: null });
        expect(bus.published[1].data).toEqual({ panelId: 'apworldEditorPanel' });
        /**
         * ⛔ NO LEVEL, NO CONTRACT, NO DOCUMENT. The level in front of that
         * panel is a WORKING COPY nobody has saved back yet, and a link that
         * pushed it would publish edits the reader never committed.
         */
        expect(Object.keys(bus.published[0].data).sort()).toEqual(['player', 'region']);
    });

    it('⛔ answers false — and publishes nothing — with no region and before initialize', async () => {
        const bus = fakeBus();
        // ⛓ Before `initialize()` there is no bus at all.
        expect(bounce.openRegionInApworldEditor('region_1_0')).toBe(false);
        await bounce.initialize('bounceRegionEditor', 0, { getEventBus: () => bus });
        expect(bounce.openRegionInApworldEditor(null)).toBe(false);
        expect(bounce.openRegionInApworldEditor('')).toBe(false);
        expect(bus.published).toEqual([]);
    });
});
