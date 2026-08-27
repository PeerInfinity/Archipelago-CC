/**
 * labRoomEditor — the host side of the ROOM-EDITOR CONTRACT for `kind: 'lab'`.
 *
 * EDITOR INTEGRATION arc, slice W3. What the rows below are ABOUT:
 *
 *  · the door REFUSES rather than hanging, in every way it can fail before the
 *    document is in the page (an unknown page, no panel mounted, a payload the
 *    panel throws on);
 *  · the OUT path is the envelope's `room` TRANSITION `n → null` and nothing
 *    else — not a count of edits (trap 599's family), not the first
 *    `levelChanged` after the load;
 *  · `onSave` fires EXACTLY ONCE and the subscription is gone afterwards;
 *  · this module imports nothing from a substrate.
 *
 * ⛓ The bus is the REAL one (it loads headless), so what these rows exercise is
 * the routing the app actually runs. The PANEL is a stand-in, because a real
 * one wants an iframe.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let eventBus;
let mod;
let envelopeMod;

const IFRAME_ID = 'procgenLab-maze-1';

beforeEach(async () => {
    vi.resetModules();
    ({ default: eventBus } = await import('../../app/core/eventBus.js'));
    mod = await import('./labRoomEditor.js');
    envelopeMod = await import('../procgenCore/labRoomEnvelope.js');
    /**
     * ⛓⛓ EDITOR INTEGRATION W4 — **THE APP REGISTERS ITS BUS, AND THESE ROWS
     * STAND IN FOR THE APP.** `labRoomEditor.js` no longer IMPORTS
     * `app/core/eventBus.js` (importing it printed `[centralRegistry]
     * CentralRegistry initialized`, which `lab.html` must not pay for); the
     * panel registers it at its own import instead. ⛔ Registered HERE rather
     * than passing `bus` to every call, because what these rows exercise is
     * the DEFAULT path — the one `regionEditors`' binding uses.
     */
    mod.registerAppEventBus(eventBus);
    mod.clearLabPanelInstances();
    // ⛓ The adapter registers `iframe_<id>` dynamically at publish time in the
    //   app; a test that skipped this would watch the bus DROP its own fixture
    //   (`eventBus.js:126`, warn + return) and call it a routing result.
    eventBus.registerPublisher('procgenLab:levelChanged', 'testFrame');
});

afterEach(() => {
    mod.clearLabPanelInstances();
});

/** A `ProcgenLabPanelUI` stand-in that records the two verbs. */
function fakePanel({ substrate = 'maze', iframeId = IFRAME_ID, onNavigate = null } = {}) {
    return {
        substrate,
        iframeId,
        loads: [],
        navigates: [],
        raised: 0,
        notes: [],
        load(record) { this.loads.push(record); return true; },
        navigate(search) {
            if (onNavigate) onNavigate(search);
            this.navigates.push(search);
            return true;
        },
        raise() { this.raised += 1; return true; },
        _note(text, bad) { this.notes.push({ text, bad }); },
    };
}

const announce = (payload, iframeId = IFRAME_ID, substrate = 'maze') => {
    eventBus.publish('procgenLab:levelChanged', { substrate, iframeId, payload }, 'testFrame');
};

const envelope = (room, record) => envelopeMod.makeSetRecordEnvelope({
    substrate: 'maze', room, record,
});

const LIBRARY = { library: { library_id: 'demo', entries: [{}, {}, {}] }, overlay: {} };

/* ══════════════════════════════════════════════════════════════════════
 * THE REFUSALS — none of them throws, none of them hangs
 * ══════════════════════════════════════════════════════════════════════ */

describe('labRoomEditor — it refuses by name and never throws', () => {
    it('refuses a page that is not a lab page', () => {
        const r = mod.openLabRoomEditor({
            page: 'bounce', arm: 'set', room: 0, record: LIBRARY, onSave: () => {},
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('bounce');
        expect(r.why).toContain('maze');
    });

    it('refuses a missing arm — the words `set`/`edit` come off the registry entry', () => {
        mod.registerLabPanelInstance(fakePanel());
        const r = mod.openLabRoomEditor({
            page: 'maze', room: 0, record: LIBRARY, onSave: () => {},
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('arm');
    });

    it('refuses a fractional or negative room index', () => {
        mod.registerLabPanelInstance(fakePanel());
        for (const room of [-1, 1.5, '2', null]) {
            const r = mod.openLabRoomEditor({
                page: 'maze', arm: 'set', room, record: LIBRARY, onSave: () => {},
            });
            expect(r.ok).toBe(false);
            expect(r.why).toContain('room');
        }
    });

    it('refuses a record that is not a document, naming the `panel` kind', () => {
        mod.registerLabPanelInstance(fakePanel());
        const r = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 0, record: null, onSave: () => {},
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('panel');
    });

    it('refuses a missing onSave — it is the ONLY return path', () => {
        mod.registerLabPanelInstance(fakePanel());
        const r = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 0, record: LIBRARY,
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('onSave');
    });

    it('⛓ refuses when no lab panel for that page is mounted — and says which to open', () => {
        mod.registerLabPanelInstance(fakePanel({ substrate: 'seedling' }));
        const r = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 0, record: LIBRARY, onSave: () => {},
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('Procgen Lab');
        expect(r.why).toContain('maze');
    });

    it('⛔ a panel whose `load` THROWS is a refusal in the same call, not a hang', () => {
        const panel = fakePanel();
        panel.load = () => { throw new Error('that is not a payload object'); };
        mod.registerLabPanelInstance(panel);
        const r = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 0, record: LIBRARY, onSave: () => {},
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('not a payload object');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE ROUND TRIP
 * ══════════════════════════════════════════════════════════════════════ */

describe('labRoomEditor — document in, ONE room, folded document out', () => {
    it('⛓⛓⛓ loads the document, navigates to the room, and calls onSave ONCE on the '
        + 'room → null transition', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        const saved = [];
        const handle = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 1, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        expect(handle.ok).toBe(true);
        // 1. THE DOCUMENT IN — verbatim, through the panel's own `load`.
        expect(panel.loads).toEqual([LIBRARY]);
        expect(panel.raised).toBe(1);
        // …and NOTHING has been navigated yet: the page has not said it holds it.
        expect(panel.navigates).toEqual([]);

        // 2. The page reports it is holding a SET document with no room open.
        announce(envelope(null, LIBRARY));
        expect(panel.navigates).toEqual(['?source=set&room=1']);
        expect(saved).toEqual([]);

        // 3. The room opens…
        announce(envelope(1, LIBRARY));
        expect(saved).toEqual([]);

        // 4. …and closes, with the folded document.
        const edited = { library: { library_id: 'demo', entries: [{}, { edited: true }, {}] },
            overlay: {} };
        announce(envelope(null, edited));
        expect(saved).toEqual([edited]);
    });

    it('⛔ a SECOND levelChanged after the close does NOT call onSave twice', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        const saved = [];
        mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 1, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        announce(envelope(null, LIBRARY));
        announce(envelope(1, LIBRARY));
        announce(envelope(null, { closed: 'once' }));
        announce(envelope(null, { closed: 'twice' }));
        announce(envelope(2, LIBRARY));
        announce(envelope(null, { closed: 'thrice' }));
        expect(saved).toEqual([{ closed: 'once' }]);
    });

    it('⛔ the LADDER payload is not a close — a page that never reaches the SET arm '
        + 'never navigates and never saves', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        const saved = [];
        mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 0, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        announce({ seed: 5, level: { tiles: [] } });
        announce({ seed: 6, level: { tiles: [] } });
        expect(panel.navigates).toEqual([]);
        expect(saved).toEqual([]);
    });

    it('⛔ an envelope addressed to ANOTHER frame is ignored — two labs, one bus', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        const saved = [];
        mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 1, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        announce(envelope(null, LIBRARY), 'procgenLab-maze-2');
        expect(panel.navigates).toEqual([]);
        announce(envelope(null, LIBRARY));
        announce(envelope(1, LIBRARY));
        announce(envelope(null, { mine: true }), 'procgenLab-maze-2');
        expect(saved).toEqual([]);
        announce(envelope(null, { mine: true }));
        expect(saved).toEqual([{ mine: true }]);
    });

    it('⛓ the navigate is sent ONCE — a navigate per announce would re-open the room '
        + 'the reader just closed', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 2, record: LIBRARY, onSave: () => {},
        });
        announce(envelope(null, LIBRARY));
        announce(envelope(null, LIBRARY));
        announce(envelope(null, LIBRARY));
        expect(panel.navigates).toEqual(['?source=set&room=2']);
    });

    it('⛔ a navigate the page REFUSES surfaces in the panel\'s note and stops the wait', () => {
        const panel = fakePanel({
            onNavigate: () => { throw new Error('?room= — nothing is held'); },
        });
        mod.registerLabPanelInstance(panel);
        const saved = [];
        mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 1, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        announce(envelope(null, LIBRARY));
        expect(panel.notes[0].bad).toBe(true);
        expect(panel.notes[0].text).toContain('nothing is held');
        // …and the subscription is gone: a later close reaches nobody.
        announce(envelope(1, LIBRARY));
        announce(envelope(null, LIBRARY));
        expect(saved).toEqual([]);
    });

    it('⛓ `close()` gives up on the room and onSave never fires', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        const saved = [];
        const handle = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 1, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        announce(envelope(null, LIBRARY));
        announce(envelope(1, LIBRARY));
        handle.close();
        announce(envelope(null, { late: true }));
        expect(saved).toEqual([]);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE INSTANCE REGISTRY, AND THE BINDING
 * ══════════════════════════════════════════════════════════════════════ */

describe('labRoomEditor — the panel registry and the binding', () => {
    it('finds a mounted panel by its substrate and forgets it on unregister', () => {
        const maze = fakePanel({ substrate: 'maze' });
        const seed = fakePanel({ substrate: 'seedling', iframeId: 'procgenLab-seedling-2' });
        mod.registerLabPanelInstance(maze);
        mod.registerLabPanelInstance(seed);
        expect(mod.findLabPanel('maze')).toBe(maze);
        expect(mod.findLabPanel('seedling')).toBe(seed);
        expect(mod.labPanelInstances()).toEqual([maze, seed]);
        mod.unregisterLabPanelInstance(maze);
        expect(mod.findLabPanel('maze')).toBe(null);
        // ⛔ Idempotent: `destroy()` may run twice on a torn-down layout.
        mod.unregisterLabPanelInstance(maze);
        expect(mod.labPanelInstances()).toEqual([seed]);
    });

    it('⛓ `bindLabRoomEditor` carries the page AND the arm — the two labs differ in '
        + 'BOTH', () => {
        const maze = fakePanel({ substrate: 'maze' });
        const seed = fakePanel({ substrate: 'seedling', iframeId: 'procgenLab-seedling-2' });
        mod.registerLabPanelInstance(maze);
        mod.registerLabPanelInstance(seed);
        const openMaze = mod.bindLabRoomEditor({ page: 'maze', arm: 'set' });
        const openSeed = mod.bindLabRoomEditor({ page: 'seedling', arm: 'edit' });
        expect(openMaze({ room: 0, record: LIBRARY, onSave: () => {} }).ok).toBe(true);
        expect(openSeed({ room: 3, record: LIBRARY, onSave: () => {} }).ok).toBe(true);
        expect(maze.loads.length).toBe(1);
        expect(seed.loads.length).toBe(1);
        announce(envelope(null, LIBRARY));
        announce(envelopeMod.makeSetRecordEnvelope({
            substrate: 'seedling', room: null, record: LIBRARY,
        }), 'procgenLab-seedling-2', 'seedling');
        expect(maze.navigates).toEqual(['?source=set&room=0']);
        expect(seed.navigates).toEqual(['?source=edit&room=3']);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE IMPORT LIST
 * ══════════════════════════════════════════════════════════════════════ */

describe('labRoomEditor — what it is allowed to know', () => {
    it('⛔ imports NOTHING from a substrate — `procgenCore/` and the app bus only', () => {
        const src = readFileSync(
            fileURLToPath(new URL('./labRoomEditor.js', import.meta.url)), 'utf8');
        const specs = [...src.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
        /**
         * ⛓ EDITOR INTEGRATION W4 — **`shared/communicationProtocol.js` JOINED
         * THE LIST, AND IT IS NOT A SUBSTRATE.** `createPageLabTransport` speaks
         * the wire format `AdapterClient` speaks, and minting its own message
         * names would be a second spelling of a handshake the client alone
         * decides. `shared/` is the submodule every side of the app reads; the
         * claim this row makes — no substrate, ever — is untouched, and the
         * loop below is what actually makes it.
         */
        /**
         * ⛓⛓⛓ EDITOR INTEGRATION W4 — **AND THE APP EDGE IS GONE, WHICH IS A
         * STRICTER CLAIM THAN THE ONE THIS ROW STARTED WITH.** This module
         * imported `app/core/eventBus.js` for ONE thing (the default `bus`), and
         * W4 measured what that costs a page that is not the app: importing this
         * file printed `[centralRegistry] CentralRegistry initialized`. `lab.html`
         * is a standalone static page and now has a reason to import the
         * contract. The APP registers its bus at `procgenLabPanelUI`'s import,
         * the same inversion the instance registry already uses.
         * ⛓ `shared/communicationProtocol.js` joined for `createPageLabTransport`,
         * which speaks the wire format `AdapterClient` speaks — `shared/` is the
         * submodule every side reads and is not a substrate. The claim the loop
         * below makes — no substrate, ever — is untouched.
         */
        expect(specs).toEqual([
            '../procgenCore/labProtocol.js',
            '../procgenCore/labRoomEnvelope.js',
            '../shared/communicationProtocol.js',
        ]);
        expect(specs.some((sp) => sp.includes('app/'))).toBe(false);
        /**
         * ⛔ THE SCAN IS OVER THE SPECIFIERS, NOT THE FILE. The docblock NAMES
         * `mazeRoom/` and `seedlingDemo/` on purpose — saying which two
         * directories this module may not import is the whole point of the
         * sentence — and a substring scan over the source would redden on the
         * documentation of the rule it is checking.
         */
        for (const dir of ['mazeRoom', 'seedlingDemo', 'bounceDemo', 'flashPanel',
            'bounceRegionEditor', 'runnerDemo', 'procgenPipeline']) {
            expect(specs.some((s) => s.includes(`${dir}/`))).toBe(false);
        }
        // ⛓ …and there is no DYNAMIC one either — the same rule, the other spelling.
        expect(src).not.toMatch(/\bimport\s*\(/);
    });
});
