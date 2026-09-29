import { afterEach, describe, expect, it } from 'vitest';

import {
    SUBSTRATE_ORDER_SCHEMA, SUBSTRATE_ORDER_SETTING, entriesInSubstrateOrder, inSubstrateOrder, reorderIds,
    setSubstrateOrder, substrateOrder,
} from './substrateOrder.js';
import { reorderIds as panelReorderIds } from '../substrateRegistryPanel/substrateRegistryPanelLibrary.js';
import { playableSubstrateIds } from '../apworldEditor/sidecarForm.js';
import { substrateEditorLinks } from '../apworldEditor/documentLinks.js';

const IDS = ['bounce', 'flash', 'maze', 'runner'];

/** A fake registry: `getAll()` in id order, as the real one (RO1). */
const fakeRegistry = (entries) => ({
    getAll: () => [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    get: (id) => entries.find((e) => e.id === id),
});

describe('substrateOrder — the user\'s substrate order (REGISTRATION ORDER RO2)', () => {
    afterEach(() => setSubstrateOrder([]));

    it('the setting is a list of ids under the Registry panel\'s module settings, empty by default', () => {
        expect(SUBSTRATE_ORDER_SETTING).toBe('moduleSettings.substrateRegistryPanel.substrateOrder');
        expect(SUBSTRATE_ORDER_SCHEMA.type).toBe('array');
        expect(SUBSTRATE_ORDER_SCHEMA.default).toEqual([]);
    });

    it('no saved order = the ids as given (id order)', () => {
        expect(inSubstrateOrder(IDS)).toEqual(IDS);
    });

    it('a saved order leads; ids it does not name follow in their own order; stale ids and repeats drop', () => {
        setSubstrateOrder(['runner', 'gone', 'maze', 'runner']);
        expect(inSubstrateOrder(IDS)).toEqual(['runner', 'maze', 'bounce', 'flash']);
        expect(substrateOrder()).toEqual(['runner', 'gone', 'maze', 'runner']);
    });

    it('anything but a list of non-empty strings installs as empty (or is filtered)', () => {
        setSubstrateOrder('maze');
        expect(substrateOrder()).toEqual([]);
        setSubstrateOrder(null);
        expect(substrateOrder()).toEqual([]);
        setSubstrateOrder(['maze', 3, '', null, 'flash']);
        expect(substrateOrder()).toEqual(['maze', 'flash']);
    });

    it('substrateOrder() is a copy — mutating it moves nothing', () => {
        setSubstrateOrder(['maze']);
        substrateOrder().push('flash');
        expect(substrateOrder()).toEqual(['maze']);
    });

    it('entries follow the same rule, the objects kept', () => {
        const entries = IDS.map((id) => ({ id }));
        setSubstrateOrder(['maze']);
        const out = entriesInSubstrateOrder(entries);
        expect(out.map((e) => e.id)).toEqual(['maze', 'bounce', 'flash', 'runner']);
        expect(out[0]).toBe(entries[2]);
    });

    it('the Registry panel\'s reorderIds IS this rule (one copy)', () => {
        expect(panelReorderIds).toBe(reorderIds);
    });

    it('⛓ the sidecar substrate picker follows the saved order', () => {
        const reg = fakeRegistry(['runner', 'bounce', 'maze', 'jta'].map((id) => ({
            id, ...(id === 'jta' ? {} : { deserializeWorld: () => null }),
        })));
        expect(playableSubstrateIds(reg)).toEqual(['bounce', 'maze', 'runner']);
        setSubstrateOrder(['runner', 'maze']);
        expect(playableSubstrateIds(reg)).toEqual(['runner', 'maze', 'bounce']);
    });

    it('⛓ the room-editor links follow the saved order', () => {
        const reg = fakeRegistry(['maze', 'bounce'].map((id) => ({
            id, name: id, roomEditor: { kind: 'lab', href: `x/${id}` },
        })));
        expect(substrateEditorLinks(reg).map((r) => r.substrate)).toEqual(['bounce', 'maze']);
        setSubstrateOrder(['maze']);
        expect(substrateEditorLinks(reg).map((r) => r.substrate)).toEqual(['maze', 'bounce']);
    });
});
