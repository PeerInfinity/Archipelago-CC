/**
 * ⛓⛓ CONTENT SETS R1 — **THE TEXT ADVENTURE READS ITS WORDS FROM ITS CONTENT SET.**
 *
 * The default pack (`frontend/packs/text-adventure/`, the entry's `defaultContentPack`) holds every string the
 * generation writes; a later pack in the world's stack that presents a mechanic wins; one that lacks a slot the
 * role needs falls through; a theme's `place` concept names a room. Pinned here with a FIXTURE second pack held in
 * memory (⛔ no second pack is committed under `frontend/packs/` — that is slice R3): the default pack is read from
 * disk, the fixture from memory.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import { substrateRegistryEntry } from './textAdventureSubstrateWrapperLibrary.js';
import {
    TEXT_ADVENTURE_ROOM_REFUSALS, extractTextAdventureRules, generateTextAdventureRoom, placeTextAdventureRules,
    presentedProse, roomPlace, serializeTextAdventureRoom,
} from './textAdventureRoom.js';
import {
    GATE_PROSE_SLOTS, ITEM_PROSE_SLOTS, TEXT_ADVENTURE_CONTENT_ROLES,
} from './textAdventureConceptRealisations.js';
import { arrivalLine } from './templating.js';
import { CONCEPTS } from '../procgenCore/concepts.js';
import { assertContentRoles, contentRolesOf } from '../procgenCore/contentRoles.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { createRng } from '../shared/rng.js';
import { CONCEPT_TRIAL_STATE } from '../procgenPipeline/presetDefs.js';
import { prepareRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import {
    RECORDED_CONTENT_KEY, defaultContentSetOf, effectiveContentStack, loadContentSet,
} from '../procgenPipeline/worldContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DEFAULT = substrateRegistryEntry.defaultContentPack;
const DEFAULT_SET = defaultContentSetOf([DEFAULT]);

// ── the fixture theme, in memory ─────────────────────────────────────────
const THEME = 'theme';
const MEM = 'mem:/packs/';
const FILES = {
    [`${THEME}/pack.json`]: {
        schema_version: 1, id: THEME, title: 'A fixture theme', licence: 'CC0',
        layers: { concepts: 'concepts/manifest.json', text: 'text/manifest.json' },
    },
    [`${THEME}/concepts/manifest.json`]: {
        schema_version: 1,
        concepts: {
            // presents the guardian with every gate slot: it wins over the default pack
            [`${THEME}:character/the-gate`]: {
                kind: 'character', name: 'The Gate',
                text: { blocked: `${THEME}:gate/blocked`, passedWith: `${THEME}:gate/passedWith` }, presents: 'guardian',
            },
            // presents water but LACKS a slot the gate role needs: not a candidate, so the default pack's speaks
            [`${THEME}:object/half-water`]: {
                kind: 'object', name: 'Half Water', text: { blocked: `${THEME}:water/blocked` }, presents: 'water',
            },
            // presents swim with a key its stack does not hold: refused at resolution, the default pack's speaks
            [`${THEME}:object/swim`]: {
                kind: 'object', name: 'Swim', text: { checkMessage: `${THEME}:swim/missing` }, presents: 'swim',
            },
            // a place: the room's name and description
            [`${THEME}:place/the-lobby`]: {
                kind: 'place', name: 'The Lobby', description: 'A waiting room for {regionName}. Nobody waits long.',
            },
            // a place-kind concept that presents a mechanic is that mechanic's look, never a room (and, with no
            // `checkMessage` slot, not the sword's words either: the default pack's speak for the sword)
            [`${THEME}:place/the-armoury`]: {
                kind: 'place', name: 'The Armoury', presents: 'sword',
            },
        },
    },
    [`${THEME}/text/manifest.json`]: {
        schema_version: 1,
        strings: {
            [`${THEME}:gate/blocked`]: 'The Gate to {destinationRegion} knows its rule, and you do not meet it.',
            [`${THEME}:gate/passedWith`]: 'The Gate checks your sword and steps aside for {destinationRegion}.',
            [`${THEME}:water/blocked`]: 'Half a message.',
        },
    },
};
/** The fixture from memory; anything else (the default pack) from the committed packs on disk. */
function themeIo() {
    const read = [];
    const disk = nodePackIo();
    return {
        read,
        base: MEM,
        readJson: async (url) => {
            read.push(url);
            const rel = url.slice(MEM.length);
            if (rel in FILES) return structuredClone(FILES[rel]);
            if (rel.startsWith(`${THEME}/`)) throw new Error(`no file ${url}`);
            return disk.readJson(new URL(rel, disk.base).href);
        },
    };
}
const themeSet = () => loadContentSet([DEFAULT, THEME], themeIo());
const strings = (rel) => FILES[`${THEME}/text/manifest.json`].strings[rel];
/** An rng whose every draw throws — and whose state may be read. */
const noDrawRng = (state = 7) => ({
    getState: () => state,
    next: () => { throw new Error('drew'); },
    choice: () => { throw new Error('drew'); },
});

describe('the declaration', () => {
    it('declares a committed default pack and roles that hold the contract', () => {
        const committed = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/packs.json'), 'utf8')).packs.map((p) => p.id);
        expect(committed).toContain(DEFAULT);
        expect(substrateRegistryEntry.contentRoles).toBe(TEXT_ADVENTURE_CONTENT_ROLES);
        expect(() => assertContentRoles(substrateRegistryEntry, CONCEPTS)).not.toThrow();
    });
    it('a role\'s text needs are its slot table\'s keys: a role and the placer cannot disagree', () => {
        expect(contentRolesOf(substrateRegistryEntry).gate.needs.text).toEqual(Object.keys(GATE_PROSE_SLOTS));
        expect(contentRolesOf(substrateRegistryEntry).item.needs.text).toEqual(Object.keys(ITEM_PROSE_SLOTS));
    });
    it('the default pack presents every concept the entry realises, each with its role\'s slots, all resolving', () => {
        const presentsRole = Object.entries(TEXT_ADVENTURE_CONTENT_ROLES).filter(([, r]) => r.accepts.presents);
        for (const cid of Object.keys(substrateRegistryEntry.conceptRealisations)) {
            const roles = presentsRole.filter(([, r]) => r.accepts.presents.includes(cid));
            expect(roles.length, cid).toBe(1);
            const prose = presentedProse(DEFAULT_SET, roles[0][0], cid);
            expect(Object.keys(prose ?? {}), cid).toEqual(roles[0][1].needs.text);
        }
    });
    it('the default pack offers no place: alone, it names no room', () => {
        expect(roomPlace(DEFAULT_SET, 'region_1_1', createRng(1))).toBeNull();
    });
});

describe('presentedProse — which pack speaks', () => {
    it('a later pack that presents the mechanic with every slot wins', async () => {
        const set = await themeSet();
        expect(presentedProse(set, 'gate', 'guardian')).toEqual({
            blocked: strings(`${THEME}:gate/blocked`), passedWith: strings(`${THEME}:gate/passedWith`),
        });
    });
    it('a later pack that lacks a slot the role needs is not a candidate: the default pack\'s speaks', async () => {
        const set = await themeSet();
        expect(presentedProse(set, 'gate', 'water')).toEqual(presentedProse(DEFAULT_SET, 'gate', 'water'));
    });
    it('a slot whose key the stack does not hold falls through too', async () => {
        const set = await themeSet();
        expect(presentedProse(set, 'item', 'swim')).toEqual(presentedProse(DEFAULT_SET, 'item', 'swim'));
    });
    it('the stack ORDER decides, not the key order: reversed, the default pack speaks for the guardian', async () => {
        const reversed = await loadContentSet([THEME, DEFAULT], themeIo());
        expect(presentedProse(reversed, 'gate', 'guardian')).toEqual(presentedProse(DEFAULT_SET, 'gate', 'guardian'));
    });
    it('a set no pack of which presents the mechanic answers null', async () => {
        const themeOnly = await loadContentSet([THEME], themeIo());
        expect(presentedProse(themeOnly, 'item', 'sword')).toBeNull();
    });
});

describe('the placer\'s refusals', () => {
    const SWORD = { rule: 'Has', args: { item_name: CONCEPTS.sword.item.id } };
    const room = () => generateTextAdventureRoom({ region_id: 'Keep', exits: [{ exit_id: 'Gate', side: 'N' }] }).world;
    it('a selected concept with no content set is refused by name', () => {
        expect(() => placeTextAdventureRules(room(), { exit_rules: { Gate: SWORD }, params: { concepts: ['guardian'] } }))
            .toThrow(TEXT_ADVENTURE_ROOM_REFUSALS.noContentSet('Keep', 'guardian'));
    });
    it('a selected concept no pack in the set presents is refused by name', async () => {
        const themeOnly = await loadContentSet([THEME], themeIo());
        expect(() => placeTextAdventureRules(room(), {
            exit_rules: {}, item_placements: [{ item_id: CONCEPTS.sword.item.id, location_id: 'Rack' }],
            params: { concepts: ['sword'], contentSet: themeOnly },
        })).toThrow(TEXT_ADVENTURE_ROOM_REFUSALS.noPresenter('Keep', 'sword', 'item', [THEME]));
    });
    it('no offered concept needs no set: a room with no concept is built without one', () => {
        const world = room();
        placeTextAdventureRules(world, { exit_rules: { Gate: SWORD } });
        expect(world.prose).toBeUndefined();
    });
});

describe('roomPlace — the selection rule', () => {
    it('no place offered ⇒ null, and the rng is neither read nor drawn', () => {
        const rng = { getState: () => { throw new Error('read'); }, next: () => { throw new Error('drew'); } };
        expect(roomPlace(DEFAULT_SET, 'Keep', rng)).toBeNull();
        expect(roomPlace(null, 'Keep', rng)).toBeNull();
    });
    it('a theme\'s place is picked without a draw; one presenting a mechanic is not a room', async () => {
        const set = await themeSet();
        const lobby = FILES[`${THEME}/concepts/manifest.json`].concepts[`${THEME}:place/the-lobby`];
        expect(roomPlace(set, 'Keep', noDrawRng())).toEqual({ name: lobby.name, description: lobby.description });
    });
    it('is a function of the rng\'s state and the region id', async () => {
        const set = await themeSet();
        expect(roomPlace(set, 'Keep', noDrawRng(3))).toEqual(roomPlace(set, 'Keep', noDrawRng(3)));
        expect(roomPlace(set, 'Keep', {})).toEqual(roomPlace(set, 'Keep', noDrawRng(0)));
    });
    it('the room core writes the place into its payload prose, and nothing without one', async () => {
        const set = await themeSet();
        const build = (params) => {
            const { world } = generateTextAdventureRoom({ region_id: 'Keep', exits: [{ exit_id: 'Gate', side: 'N' }], params, rng: noDrawRng() });
            return serializeTextAdventureRoom(world, extractTextAdventureRules(world, { regionId: 'Keep' }));
        };
        const named = build({ contentSet: set });
        expect(named.prose).toEqual({ ...roomPlace(set, 'Keep', noDrawRng()), exits: {}, locations: {} });
        expect(build({ contentSet: DEFAULT_SET })).not.toHaveProperty('prose');
        expect(build({})).not.toHaveProperty('prose');
    });
});

describe('arrivalLine — what the bridge shows on arrival', () => {
    it('enter message, else the payload description, else the generic line naming the place or the region', () => {
        const doc = { regions: { Keep: { enterMessage: 'You enter {regionName}.' } } };
        expect(arrivalLine(doc, 'Keep', { name: 'N', description: 'D' })).toBe('You enter Keep.');
        // a template is authored markup, like every message of the per-game file: only its {values} are escaped
        expect(arrivalLine(null, 'Ke<ep', { name: 'N', description: 'A room for <b>{regionName}</b>.' }))
            .toBe('A room for <b>Ke&lt;ep</b>.');
        expect(arrivalLine(null, 'Keep', { name: 'The <Lobby>' })).toBe('You are in The &lt;Lobby&gt;.');
        expect(arrivalLine(null, 'Keep')).toBe('You are in Keep.');
    });
});

// ── the whole world: the concept trial world with the fixture theme added to its stack ──
const ta = (rulesJson) => Object.entries(rulesJson.preset_sidecars['1']).filter(([, s]) => s.substrate === 'text_adventure');
/** The document minus every text-adventure payload's `prose` and the recorded content list: what a theme may not move. */
const withoutPresentation = (rulesJson) => {
    const out = structuredClone(rulesJson);
    for (const [, s] of ta(out)) delete s.playable_payload.prose;
    for (const block of Object.values(out.procgen_metadata ?? {})) delete block[RECORDED_CONTENT_KEY];
    return out;
};

describe('⛓ the concept trial world with a fixture theme: presentation moves, logic does not', async () => {
    const committed = readFileSync(join(ROOT, 'frontend/presets/concept_trial/AP_1/AP_1_rules.json'), 'utf8');
    const ctrl = await runPresetHeadless(await prepareRunFromState(structuredClone(CONCEPT_TRIAL_STATE), { io: themeIo() }));
    const themed = { ...CONCEPT_TRIAL_STATE, params: { ...CONCEPT_TRIAL_STATE.params, content: [THEME] } };
    const world = await runPresetHeadless(await prepareRunFromState(structuredClone(themed), { io: themeIo() }));
    const set = await loadContentSet(effectiveContentStack({
        substrateIds: Object.keys(CONCEPT_TRIAL_STATE.substrateQuotas), content: [THEME],
    }), themeIo());

    it('the control (default pack only) is byte for byte the committed preset', () => {
        expect(JSON.stringify(ctrl.rulesJson, null, 2)).toBe(committed);
    });
    it('the world\'s logic is the control\'s: everything but the text-adventure prose and the record is equal', () => {
        expect(world.oracleErrors ?? []).toEqual([]);
        expect(JSON.stringify(withoutPresentation(world.rulesJson))).toBe(JSON.stringify(withoutPresentation(ctrl.rulesJson)));
        expect(world.rulesJson.procgen_metadata['1'][RECORDED_CONTENT_KEY]).toEqual([THEME]);
    });
    it('the guardian\'s words are the fixture\'s', () => {
        const guarded = ta(world.rulesJson).flatMap(([, s]) => Object.values(s.playable_payload.prose?.exits ?? {}));
        expect(guarded.length).toBeGreaterThan(0);
        const g = presentedProse(set, 'gate', 'guardian');
        for (const exit of guarded) expect(exit).toEqual({ inaccessibleMessage: g.blocked, moveMessage: g.passedWith });
        expect(g.blocked).toBe(strings(`${THEME}:gate/blocked`));
    });
    it('every text-adventure room carries the fixture\'s place; the control\'s carry none', () => {
        const lobby = FILES[`${THEME}/concepts/manifest.json`].concepts[`${THEME}:place/the-lobby`];
        for (const [rid, s] of ta(world.rulesJson)) {
            expect(s.playable_payload.prose, rid).toMatchObject({ name: lobby.name, description: lobby.description });
        }
        for (const [rid, s] of ta(ctrl.rulesJson)) {
            expect(s.playable_payload.prose?.name, rid).toBeUndefined();
            expect(s.playable_payload.prose?.description, rid).toBeUndefined();
        }
    });
    it('what the fixture does not present is the default pack\'s: the sword\'s check message, unchanged', () => {
        const said = (rj) => ta(rj).flatMap(([, s]) => Object.values(s.playable_payload.prose?.locations ?? {}));
        expect(said(world.rulesJson).length).toBeGreaterThan(0);
        expect(said(world.rulesJson)).toEqual(said(ctrl.rulesJson));
        expect(said(world.rulesJson)).toContainEqual({ checkMessage: presentedProse(DEFAULT_SET, 'item', 'sword').checkMessage });
    });
});
