/**
 * regionEditors — the ROOM-EDITOR RESOLVER, and its four answers.
 *
 * EDITOR INTEGRATION arc, slice W3. ⛓ The claim this file exists for is that
 * the answer comes off the SUBSTRATE REGISTRY and not off a table somebody's
 * `initialize()` wrote into: the maze and Seedling editors are LAB PAGES, and a
 * page never calls `initialize()`, so a self-registration could never have
 * reached them.
 *
 * ⛔ THE ROWS DERIVE THEIR ROSTER. Which substrates declare a `roomEditor` is
 * read off the registry, never listed here — a hand list would pass whatever it
 * said the day it was written.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULES_DIR = fileURLToPath(new URL('..', import.meta.url));

/** ⛓ The seven libraries the capability matrix loads, in its own order. */
const LIBRARIES = [
    'mazeRoom/mazeRoomLibrary.js',
    'bounceDemo/bounceDemoLibrary.js',
    'runnerDemo/runnerDemoLibrary.js',
    'textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js',
    'flashPanel/flashSeedlingLibrary.js',
    'jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js',
    'omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js',
];

let substrateRegistry;
let mod;
let labRoomEditor;
let eventBus;
/** ⛓ The seven real entries, kept so a PROBE registered by a row can be undone. */
let realEntries;

/**
 * ⛔ IMPORTED ONCE, AND THE STATE IS RESTORED PER ROW instead. The seven
 * libraries cost ~2.8s to import; a `vi.resetModules()` in `beforeEach` paid
 * that ten times over and pushed the file past vitest's 5s per-test timeout the
 * moment it ran beside other files — which is a FLAKE, not a finding.
 */
beforeAll(async () => {
    ({ default: eventBus } = await import('../../app/core/eventBus.js'));
    ({ substrateRegistry } = await import('../shared/procgen/substrateRegistry.js'));
    for (const rel of LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await import(`../${rel}`);
    }
    mod = await import('./regionEditors.js');
    labRoomEditor = await import('../procgenLabPanel/labRoomEditor.js');
    /**
     * ⛓⛓ EDITOR INTEGRATION W4 — **THE APP REGISTERS ITS BUS, AND THIS ROW
     * STANDS IN FOR THE APP.** `labRoomEditor.js` no longer IMPORTS
     * `app/core/eventBus.js` (importing it booted the CentralRegistry, which
     * `lab.html` must not pay for); `procgenLabPanelUI` registers it at its own
     * import. ⛔ Registered here rather than passed per call, because what
     * `getRegionEditor`'s binding uses is the DEFAULT path.
     */
    labRoomEditor.registerAppEventBus(eventBus);
    realEntries = substrateRegistry.getAll();
    eventBus.registerPublisher('procgenLab:levelChanged', 'testFrame');
/**
 * ⛔ AND THE HOOK CARRIES ITS OWN TIMEOUT. The seven libraries are ~24s of
 * TRANSFORM the first time vitest sees them, and the default hook budget is
 * 10s — measured: this hook passed alone and timed out two runs in three when
 * the file ran beside `procgenCore/`. A budget the work cannot fit in is a
 * flake, not a finding.
 */
}, 120_000);

afterEach(() => {
    // ⛓ THE REGISTRY BACK TO THE EIGHT, so a row's PROBE entry cannot be seen
    //   by the roster row that follows it.
    substrateRegistry.clear();
    for (const entry of realEntries) substrateRegistry.register(entry);
    for (const key of Object.keys(mod.regionEditors)) delete mod.regionEditors[key];
    labRoomEditor.clearLabPanelInstances();
});

/**
 * ⛓ A UNIQUE iframeId PER PANEL, ACROSS THE WHOLE FILE. Modules are no longer
 * reset per row, so an opener whose room never closed is still subscribed —
 * and `addressedTo` is what keeps it from hearing the next row's announce.
 */
let panelSeq = 0;
function fakePanel(substrate, iframeId = `procgenLab-${substrate}-${(panelSeq += 1)}`) {
    return {
        substrate,
        iframeId,
        loads: [],
        navigates: [],
        load(r) { this.loads.push(r); return true; },
        navigate(s) { this.navigates.push(s); return true; },
        raise() { return true; },
        _note() {},
    };
}

const RECORD = { library: { entries: [{}, {}] }, overlay: {} };

/* ══════════════════════════════════════════════════════════════════════
 * THE DECLARATION IS THE REGISTRY'S
 * ══════════════════════════════════════════════════════════════════════ */

describe('regionEditors — the answer comes off the substrate entry', () => {
    it('⛔ the DEPRECATED override table is EMPTY — nothing in the repository '
        + 'registers itself any more', () => {
        expect(Object.keys(mod.regionEditors)).toEqual([]);
    });

    it('⛔ …and no module CALLS `registerRegionEditor` either — the table being empty '
        + 'at import time would also be true of a call made at `initialize()`', () => {
        const callers = [];
        /**
         * ⛔ `latin1`, NEVER `utf8`-with-a-grep: `procgenPipelineUI.js` carries
         * a NUL byte, which makes plain `grep` treat it as BINARY and SKIP it
         * silently — and it is the file that CALLS `getRegionEditor` four
         * times, so a scan that skipped it would be a scan of everything except
         * the one place that matters.
         */
        const walk = (dir) => {
            for (const e of readdirSync(dir, { withFileTypes: true })) {
                const full = join(dir, e.name);
                if (e.isDirectory()) {
                    if (e.name === 'node_modules' || e.name === 'wasm') continue;
                    walk(full);
                    continue;
                }
                if (!e.name.endsWith('.js') || e.name.endsWith('.test.js')) continue;
                if (full.endsWith(join('procgenPipeline', 'regionEditors.js'))) continue;
                if (readFileSync(full, 'latin1').includes('registerRegionEditor(')) {
                    callers.push(full);
                }
            }
        };
        walk(MODULES_DIR);
        expect(callers).toEqual([]);
    });

    it('⛓⛓⛓ resolves BOUNCE through the registry entry, with that table empty', async () => {
        const open = mod.getRegionEditor('bounce');
        expect(typeof open).toBe('function');
        // ⛔ AND IT REALLY OPENS: the entry's `open` is a DYNAMIC import of the
        //   panel module, so the round trip below is what proves the lazy form
        //   still reaches the one-shot hand-off slot the panel consumes.
        const region = { region_id: 'r1', substrate: 'bounce' };
        const onSave = () => {};
        await open({ region, contract: { sidePortals: {} }, onSave });
        const editor = await import('../bounceRegionEditor/index.js');
        const session = editor.consumePendingSession();
        expect(session.region).toBe(region);
        expect(session.onSave).toBe(onSave);
    });

    it('⛓⛓ resolves the two LAB substrates to an opener bound to THEIR page and arm', () => {
        const maze = fakePanel('maze');
        const seed = fakePanel('seedling');
        labRoomEditor.registerLabPanelInstance(maze);
        labRoomEditor.registerLabPanelInstance(seed);

        expect(mod.getRegionEditor('maze')({
            room: 1, record: RECORD, onSave: () => {},
        }).ok).toBe(true);
        // ⛔ `flash_seedling`, not `seedling`: the registry id and the lab-page
        //   key are different vocabularies, and the entry is where they meet.
        expect(mod.getRegionEditor('flash_seedling')({
            room: 0, record: RECORD, onSave: () => {},
        }).ok).toBe(true);

        expect(maze.loads).toEqual([RECORD]);
        expect(seed.loads).toEqual([RECORD]);

        const announce = (substrate, iframeId, room) => eventBus.publish(
            'procgenLab:levelChanged',
            { substrate, iframeId, payload: { kind: 'set-record', substrate, room, record: RECORD } },
            'testFrame');
        announce('maze', maze.iframeId, null);
        announce('seedling', seed.iframeId, null);
        // ⛓ THE ARMS DIFFER, and this is the row that would go red if one
        //   opener were bound to the other page's grammar.
        expect(maze.navigates).toEqual(['?source=set&room=1']);
        expect(seed.navigates).toEqual(['?source=edit&room=0']);
    });

    it('⛓ every substrate that DECLARES a roomEditor resolves to a function, and '
        + 'every one that does not resolves to null', () => {
        const declaring = [];
        const silent = [];
        for (const entry of substrateRegistry.getAll()) {
            (entry.roomEditor ? declaring : silent).push(entry.id);
        }
        // ⛓ Derived, then NAMED — a roster nobody can read is a roster nobody
        //   notices changing.
        expect(declaring.sort()).toEqual(['bounce', 'flash_seedling', 'maze']);
        expect(silent.sort()).toEqual(['jta', 'omsi', 'runner', 'text_adventure']);
        for (const id of declaring) expect(typeof mod.getRegionEditor(id)).toBe('function');
        // ⛔ The pipeline's "No region editor for X yet" stays true for these.
        for (const id of silent) expect(mod.getRegionEditor(id)).toBe(null);
    });

    it('⛓ an id no substrate carries is null, not a throw', () => {
        expect(mod.getRegionEditor('no_such_substrate')).toBe(null);
        expect(mod.getRegionEditor(undefined)).toBe(null);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE MALFORMED DECLARATIONS — named, not swallowed
 * ══════════════════════════════════════════════════════════════════════ */

describe('regionEditors — a declaration it cannot open is NAMED', () => {
    const withEntry = (roomEditor, id = 'probe') => {
        substrateRegistry.register({ id, label: id, roomEditor });
        return id;
    };

    it('⛔ an unknown `kind` refuses BY NAME and returns null — "no editor yet" and '
        + '"this entry declares one and it is wrong" are different facts', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const id = withEntry({ kind: 'wormhole', page: 'maze' });
        expect(mod.getRegionEditor(id)).toBe(null);
        expect(warn).toHaveBeenCalledTimes(1);
        const said = warn.mock.calls[0][0];
        expect(said).toContain(id);
        expect(said).toContain('wormhole');
        expect(said).toContain('panel');
        expect(said).toContain('lab');
        warn.mockRestore();
    });

    it('⛔ `kind: panel` without an `open` function refuses by name', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const id = withEntry({ kind: 'panel' }, 'probe_panel');
        expect(mod.getRegionEditor(id)).toBe(null);
        expect(warn.mock.calls[0][0]).toContain('open');
        warn.mockRestore();
    });

    it('⛔ `kind: lab` without a `page` or without an `arm` refuses by name', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const noPage = withEntry({ kind: 'lab', arm: 'set' }, 'probe_nopage');
        expect(mod.getRegionEditor(noPage)).toBe(null);
        expect(warn.mock.calls[0][0]).toContain('page');
        const noArm = withEntry({ kind: 'lab', page: 'maze' }, 'probe_noarm');
        expect(mod.getRegionEditor(noArm)).toBe(null);
        expect(warn.mock.calls[1][0]).toContain('arm');
        warn.mockRestore();
    });

    it('⛓ the deprecated override WINS over the entry — that is what "override" means', () => {
        const mine = () => 'mine';
        mod.registerRegionEditor('maze', mine);
        expect(mod.getRegionEditor('maze')).toBe(mine);
        delete mod.regionEditors.maze;
        expect(mod.getRegionEditor('maze')).not.toBe(mine);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⚖ region-editor-launch Q1 — THE ONE OPENER makes the editor's panel
 * ══════════════════════════════════════════════════════════════════════ */

describe('openRoomEditor — the host first, then the door', () => {
    const noSleep = () => Promise.resolve();
    /** A module manager stand-in whose create MOUNTS a lab panel (registers it). */
    function fakeApi({ enabled = true, mounts = true } = {}) {
        const calls = [];
        const state = { enabled };
        return {
            calls,
            getAllModuleStates: () => ({ [mod.LAB_PANEL_MODULE]: { enabled: state.enabled } }),
            async enableModule(id) {
                calls.push(['enable', id]);
                if (id === mod.LAB_PANEL_MODULE) {
                    state.enabled = true;
                    labRoomEditor.registerLabPanelInstance(fakePanel('maze'));
                }
            },
            async createPanelInstance(id, s) {
                calls.push(['create', id, s.substrate]);
                if (mounts) labRoomEditor.registerLabPanelInstance(fakePanel(s.substrate));
            },
        };
    }
    afterEach(() => mod.clearRoomEditorHostRequests());

    it('⛓ a lab page with a mounted panel: no panel is made, the door opens', async () => {
        labRoomEditor.registerLabPanelInstance(fakePanel('maze'));
        const api = fakeApi();
        const handle = await mod.openRoomEditor('maze', { record: RECORD, room: 0, onSave() {} }, { api });
        expect(handle.ok).toBe(true);
        expect(api.calls).toEqual([]);
        handle.close();
    });

    it('⛓⛓ no lab panel: ONE is created for THAT page and the door opens on it', async () => {
        const api = fakeApi();
        const handle = await mod.openRoomEditor('maze', { record: RECORD, room: 1, onSave() {} },
            { api, sleep: noSleep });
        expect(api.calls).toEqual([['create', 'procgenLabPanel', 'maze']]);
        expect(handle.ok).toBe(true);
        expect(labRoomEditor.findLabPanel('maze').loads).toEqual([RECORD]);
        handle.close();
    });

    it('⛔ a double press makes ONE panel, not two', async () => {
        const api = fakeApi();
        const [a, b] = await Promise.all([
            mod.ensureRoomEditorHost('maze', { api, sleep: noSleep }),
            mod.ensureRoomEditorHost('maze', { api, sleep: noSleep }),
        ]);
        expect(a.ok && b.ok).toBe(true);
        expect(api.calls.filter((c) => c[0] === 'create')).toHaveLength(1);
    });

    it('⚠ the lab module DISABLED (its last tab closed): enabled first, and a Seedling page still gets its own', async () => {
        const api = fakeApi({ enabled: false });
        const seedlingPage = substrateRegistry.get('flash_seedling').roomEditor.page;
        const out = await mod.ensureRoomEditorHost('flash_seedling', { api, sleep: noSleep });
        expect(out.ok).toBe(true);
        expect(api.calls).toEqual([['enable', 'procgenLabPanel'], ['create', 'procgenLabPanel', seedlingPage]]);
        // …and for the maze, enabling alone was the answer
        labRoomEditor.clearLabPanelInstances();
        const api2 = fakeApi({ enabled: false });
        expect((await mod.ensureRoomEditorHost('maze', { api: api2, sleep: noSleep })).ok).toBe(true);
        expect(api2.calls).toEqual([['enable', 'procgenLabPanel']]);
    });

    it('⛔ a panel that never appears is a REFUSAL with a sentence, not a hang or a throw', async () => {
        const api = fakeApi({ mounts: false });
        const handle = await mod.openRoomEditor('maze', { record: RECORD, room: 0, onSave() {} },
            { api, timeoutMs: 0, sleep: noSleep });
        expect(handle.ok).toBe(false);
        expect(handle.why).toContain('Procgen Lab — maze');
    });

    it('⛔ no module manager (a headless caller): the old "open it first" sentence', async () => {
        const out = await mod.ensureRoomEditorHost('maze', { api: null });
        expect(out.ok).toBe(false);
        expect(out.why).toContain('Open "Procgen Lab — maze" first');
    });

    it('⛓ a PANEL door: its declared module is ENABLED (that creates a missing panel), then `open` runs', async () => {
        const opened = [];
        const id = 'probe_panel';
        substrateRegistry.register({ id, label: id,
            roomEditor: { kind: 'panel', module: 'someEditor', open: (s) => opened.push(s) } });
        const api = fakeApi();
        await mod.openRoomEditor(id, { region: { region_id: 'r' } }, { api });
        expect(api.calls).toEqual([['enable', 'someEditor']]);
        expect(opened).toHaveLength(1);
    });

    it('⛓ bounce declares the module its panel lives in', () => {
        expect(substrateRegistry.get('bounce').roomEditor.module).toBe('bounceRegionEditor');
    });
});
