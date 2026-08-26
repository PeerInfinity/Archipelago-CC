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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULES_DIR = fileURLToPath(new URL('..', import.meta.url));

/** ⛓ The eight libraries the capability matrix loads, in its own order. */
const LIBRARIES = [
    'mazeRoom/mazeRoomLibrary.js',
    'bounceDemo/bounceDemoLibrary.js',
    'runnerDemo/runnerDemoLibrary.js',
    'textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js',
    'flashSubstrate/flashSubstrateLibrary.js',
    'flashPanel/flashSeedlingLibrary.js',
    'jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js',
    'omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js',
];

let substrateRegistry;
let mod;
let labRoomEditor;
let eventBus;

beforeEach(async () => {
    vi.resetModules();
    ({ default: eventBus } = await import('../../app/core/eventBus.js'));
    ({ substrateRegistry } = await import('../shared/procgen/substrateRegistry.js'));
    for (const rel of LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await import(`../${rel}`);
    }
    mod = await import('./regionEditors.js');
    labRoomEditor = await import('../procgenLabPanel/labRoomEditor.js');
    labRoomEditor.clearLabPanelInstances();
    eventBus.registerPublisher('procgenLab:levelChanged', 'testFrame');
});

afterEach(() => {
    labRoomEditor.clearLabPanelInstances();
});

function fakePanel(substrate, iframeId) {
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
        const walk = (dir) => {
            for (const name of readdirSync(dir)) {
                const full = join(dir, name);
                if (statSync(full).isDirectory()) {
                    if (name === 'node_modules' || name === 'wasm') continue;
                    walk(full);
                    continue;
                }
                if (!name.endsWith('.js') || name.endsWith('.test.js')) continue;
                if (full.endsWith(join('procgenPipeline', 'regionEditors.js'))) continue;
                const src = readFileSync(full, 'latin1');
                if (/\bregisterRegionEditor\s*\(/.test(src)) callers.push(full);
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
        const maze = fakePanel('maze', 'procgenLab-maze-1');
        const seed = fakePanel('seedling', 'procgenLab-seedling-2');
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
        announce('maze', 'procgenLab-maze-1', null);
        announce('seedling', 'procgenLab-seedling-2', null);
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
        expect(silent.sort()).toEqual(['flash', 'jta', 'omsi', 'runner', 'text_adventure']);
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
