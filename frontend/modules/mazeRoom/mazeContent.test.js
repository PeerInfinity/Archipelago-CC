/**
 * ⛓⛓ CONTENT SETS R2 — **THE MAZE READS ITS LOOKS FROM ITS CONTENT SET.**
 *
 * The default pack (`frontend/packs/maze/`, the entry's `defaultContentPack`) holds the name, colour and symbol
 * every concept gate and item-concept row is written with at generation; a later pack in the world's stack that
 * presents a mechanic with a `look` wins; one that presents it without a look falls through. Pinned with a FIXTURE
 * second pack held in memory (⛔ no second pack is committed under `frontend/packs/` — that is slice R3): the
 * default packs are read from disk, the fixture from memory.
 *
 * The committed worlds' bytes are held elsewhere (`procgenPipeline/conceptTrialWorld.test.js` T4 D2 for the one
 * committed world that names concepts; every other committed maze world names none, so the consumer never runs).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import {
    MAZE_CONTENT_REFUSALS, MAZE_CONTENT_ROLES, conceptGateFor, isConceptGate, presentItemLib, presentedLook,
} from './mazeConcepts.js';
import { CONCEPTS, isConceptRow, itemRowsOf, markConceptRow } from '../procgenCore/concepts.js';
import { assertContentRoles } from '../procgenCore/contentRoles.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { createRng } from '../shared/rng.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { prepareRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import {
    RECORDED_CONTENT_KEY, defaultContentSetOf, effectiveContentStack, loadContentSet,
} from '../procgenPipeline/worldContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DEFAULT = substrateRegistryEntry.defaultContentPack;
const DEFAULT_SET = defaultContentSetOf([DEFAULT]);
const TEXT_ADVENTURE_DEFAULT = substrateRegistry.get('text_adventure').defaultContentPack;

// ── the fixture theme, in memory ─────────────────────────────────────────
const THEME = 'theme';
const MEM = 'mem:/packs/';
const THEME_CONCEPTS = {
    // presents the guardian with a look: it wins over the default pack (name, colour and symbol)
    [`${THEME}:character/the-gate`]: {
        kind: 'character', name: 'The Gate', look: { color: '#a04040', symbol: '#' }, presents: 'guardian',
    },
    // presents swim with a look: the item rows take its colour and symbol (never its name: that is the AP name)
    [`${THEME}:object/swim`]: {
        kind: 'object', name: 'Paddling', look: { color: '#123456', symbol: 'diamond' }, presents: 'swim',
    },
    // presents water WITHOUT a look: not a candidate for the gate role, so the default pack's look stands
    [`${THEME}:object/plain-water`]: { kind: 'object', name: 'Plain Water', presents: 'water' },
};
const FILES = {
    [`${THEME}/pack.json`]: {
        schema_version: 1, id: THEME, title: 'A fixture theme', licence: 'CC0',
        layers: { concepts: 'concepts/manifest.json' },
    },
    [`${THEME}/concepts/manifest.json`]: { schema_version: 1, concepts: THEME_CONCEPTS },
};
/** The fixture from memory; anything else (the default packs) from the committed packs on disk. */
function themeIo() {
    const disk = nodePackIo();
    return {
        base: MEM,
        readJson: async (url) => {
            const rel = url.slice(MEM.length);
            if (rel in FILES) return structuredClone(FILES[rel]);
            if (rel.startsWith(`${THEME}/`)) throw new Error(`no file ${url}`);
            return disk.readJson(new URL(rel, disk.base).href);
        },
    };
}
const themeSet = (stack = [DEFAULT, THEME]) => loadContentSet(stack, themeIo());
const themed = (key) => THEME_CONCEPTS[`${THEME}:${key}`];
const SWORD = { rule: 'Has', args: { item_name: CONCEPTS.sword.item.id } };

describe('the declaration', () => {
    it('declares a committed default pack and roles that hold the contract', () => {
        const committed = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/packs.json'), 'utf8')).packs.map((p) => p.id);
        expect(committed).toContain(DEFAULT);
        expect(substrateRegistryEntry.contentRoles).toBe(MAZE_CONTENT_ROLES);
        expect(() => assertContentRoles(substrateRegistryEntry, CONCEPTS)).not.toThrow();
    });
    it('every concept the entry realises is accepted by exactly one role, and the default pack fills it', () => {
        const roles = Object.entries(MAZE_CONTENT_ROLES);
        for (const cid of Object.keys(substrateRegistryEntry.conceptRealisations)) {
            const accepting = roles.filter(([, r]) => r.accepts.presents.includes(cid));
            expect(accepting.length, cid).toBe(1);
            const look = presentedLook(DEFAULT_SET, accepting[0][0], cid);
            expect(look, cid).not.toBeNull();
            expect(DEFAULT_SET.concepts.presenting(cid).pack, cid).toBe(DEFAULT);
        }
    });
    it('an item concept\'s default look is the concept table\'s own row (the value the maze wrote before R2)', () => {
        for (const cid of MAZE_CONTENT_ROLES.item.accepts.presents) {
            const [row] = itemRowsOf(CONCEPTS[cid]);
            const look = presentedLook(DEFAULT_SET, 'item', cid);
            expect({ color: look.color, symbol: look.symbol }, cid).toEqual({ color: row.color, symbol: row.symbol });
        }
    });
});

describe('presentedLook — which pack is shown', () => {
    it('a later pack that presents the mechanic with a look wins', async () => {
        const look = presentedLook(await themeSet(), 'gate', 'guardian');
        const gate = themed('character/the-gate');
        expect(look).toEqual({ name: gate.name, color: gate.look.color, symbol: gate.look.symbol });
    });
    it('a later pack that presents it WITHOUT a look is not a candidate: the default pack\'s is shown', async () => {
        expect(presentedLook(await themeSet(), 'gate', 'water')).toEqual(presentedLook(DEFAULT_SET, 'gate', 'water'));
    });
    it('the stack ORDER decides: reversed, the default pack is shown for the guardian', async () => {
        expect(presentedLook(await themeSet([THEME, DEFAULT]), 'gate', 'guardian'))
            .toEqual(presentedLook(DEFAULT_SET, 'gate', 'guardian'));
    });
    it('⛓ in a mixed world the text adventure\'s pack (later, presenting the guardian with no look) does not hide the maze\'s', async () => {
        const stack = effectiveContentStack({ substrateIds: ['maze', 'text_adventure'], content: [] });
        expect(stack.indexOf(TEXT_ADVENTURE_DEFAULT)).toBeGreaterThan(stack.indexOf(DEFAULT));
        const set = await loadContentSet(stack, themeIo());
        expect(set.concepts.presenting('guardian').pack).toBe(TEXT_ADVENTURE_DEFAULT);
        expect(presentedLook(set, 'gate', 'guardian')).toEqual(presentedLook(DEFAULT_SET, 'gate', 'guardian'));
    });
    it('a set no pack of which presents the mechanic with a look answers null', async () => {
        expect(presentedLook(await loadContentSet([TEXT_ADVENTURE_DEFAULT], themeIo()), 'gate', 'guardian')).toBeNull();
    });
});

describe('the placer\'s refusals', () => {
    const base = DEFAULT_OBSTACLES.logic_gate;
    it('a selected gate concept with no content set is refused by name', () => {
        expect(() => conceptGateFor(SWORD, { offered: ['guardian'], rng: createRng(1), n: 0, logicGateBase: base }))
            .toThrow(MAZE_CONTENT_REFUSALS.noContentSet('gate "guardian_gate_0"', 'guardian'));
    });
    it('a selected gate concept no pack in the set presents with a look is refused by name', async () => {
        const set = await loadContentSet([TEXT_ADVENTURE_DEFAULT], themeIo());
        expect(() => conceptGateFor(SWORD, { offered: ['guardian'], rng: createRng(1), n: 0, logicGateBase: base, contentSet: set }))
            .toThrow(MAZE_CONTENT_REFUSALS.noPresenter('gate "guardian_gate_0"', 'guardian', 'gate', set.ids));
    });
    it('a rule no concept realises needs no set (no candidate, nothing read)', () => {
        expect(conceptGateFor({ rule: 'True_' }, { offered: ['guardian'], rng: createRng(1), n: 0, logicGateBase: base }))
            .toBeNull();
    });
});

describe('presentItemLib — the item concepts\' rows', () => {
    const marked = Object.fromEntries(['sword', 'swim'].flatMap((cid) => itemRowsOf(CONCEPTS[cid])
        .map((row) => [row.id, markConceptRow(row, cid)])));
    const lib = { ...DEFAULT_OBSTACLES, plain: { name: 'Plain', id: 'plain', color: '#000000' }, ...marked };
    it('a library with no marked row is returned as is, and needs no set', () => {
        const plain = { plain: lib.plain };
        expect(presentItemLib(plain, undefined)).toBe(plain);
    });
    it('the default pack writes back exactly the rows it was given (the value and the key order)', () => {
        const out = presentItemLib(lib, DEFAULT_SET);
        expect(out).not.toBe(lib);
        expect(JSON.stringify(out)).toBe(JSON.stringify(lib));
    });
    it('a theme recolours the rows it presents (colour and symbol, never the name); the rest are untouched', async () => {
        const before = structuredClone(lib);
        const out = presentItemLib(lib, await themeSet());
        const swim = CONCEPTS.swim.item.id;
        const look = themed('object/swim').look;
        expect(out[swim]).toEqual({ ...lib[swim], color: look.color, symbol: look.symbol });
        expect(Object.keys(out[swim])).toEqual(Object.keys(lib[swim]));
        expect(out[CONCEPTS.sword.item.id]).toEqual(lib[CONCEPTS.sword.item.id]);
        expect(out.plain).toBe(lib.plain);
        expect(lib).toEqual(before);
    });
    it('a marked row with no set is refused by name', () => {
        expect(() => presentItemLib(lib, null)).toThrow(/no content set was handed in/);
    });
});

// ── the whole world ──────────────────────────────────────────────────────
/**
 * A maze-only sphere world that realises BOTH gate concepts and both item concepts (the concept library's D4
 * world, `procgenPipeline/conceptWorld.test.js`; ⛔ not a committed preset — a committed preset enrols in rosters).
 */
const bundle = (content) => ({
    mode: 'sphereGrowth',
    params: {
        seed: 1, startSubstrate: 'maze', sphereCount: 3, fillerCount: 0, revisitPercent: 25,
        concepts: ['sword', 'guardian', 'swim', 'water'], content,
    },
    scenario: { items: { [CONCEPTS.sword.item.id]: 1, [CONCEPTS.swim.item.id]: 1, victory: 1 }, obstacles: {} },
    substrateQuotas: { maze: 99 },
    substrateMix: {},
    substrateMode: 'quotas',
});
const sidecarsOf = (rj) => Object.entries(rj.preset_sidecars['1']).filter(([, s]) => s.substrate === 'maze');
const conceptGates = (rj) => sidecarsOf(rj).flatMap(([rid, s]) => Object.entries(s.playable_payload.obstacleLib ?? {})
    .filter(([, def]) => isConceptGate(def)).map(([id, def]) => ({ rid, id, def })));
const conceptItems = (rj) => sidecarsOf(rj).flatMap(([rid, s]) => Object.entries(s.playable_payload.itemLib ?? {})
    .filter(([, def]) => isConceptRow(def)).map(([id, def]) => ({ rid, id, def })));
/** The document minus what a content set may change: the concept rows' presentation, and the record. */
const withoutPresentation = (rulesJson) => {
    const out = structuredClone(rulesJson);
    for (const [, s] of sidecarsOf(out)) {
        for (const def of Object.values(s.playable_payload.obstacleLib ?? {})) {
            if (isConceptGate(def)) for (const f of ['name', 'color', 'symbol']) delete def[f];
        }
        for (const def of Object.values(s.playable_payload.itemLib ?? {})) {
            if (isConceptRow(def)) for (const f of ['color', 'symbol']) delete def[f];
        }
    }
    for (const block of Object.values(out.procgen_metadata ?? {})) delete block[RECORDED_CONTENT_KEY];
    return out;
};
const lookOf = (def) => ({ name: def.name, color: def.color, symbol: def.symbol });

describe('⛓ a maze world with a fixture theme: presentation moves, logic does not', async () => {
    const ctrl = await runPresetHeadless(await prepareRunFromState(bundle([]), { io: themeIo() }));
    const world = await runPresetHeadless(await prepareRunFromState(bundle([THEME]), { io: themeIo() }));

    it('the world realises both gate concepts and both item concepts (else this row pins nothing)', () => {
        expect(new Set(conceptGates(ctrl.rulesJson).map((g) => g.def.concept))).toEqual(new Set(MAZE_CONTENT_ROLES.gate.accepts.presents));
        expect(new Set(conceptItems(ctrl.rulesJson).map((i) => i.def.concept))).toEqual(new Set(MAZE_CONTENT_ROLES.item.accepts.presents));
    });
    it('the world\'s logic is the control\'s: everything but the concept rows\' presentation and the record is equal', () => {
        expect(world.oracleErrors ?? []).toEqual([]);
        expect(JSON.stringify(withoutPresentation(world.rulesJson))).toBe(JSON.stringify(withoutPresentation(ctrl.rulesJson)));
        expect(world.rulesJson.procgen_metadata['1'][RECORDED_CONTENT_KEY]).toEqual([THEME]);
        expect(RECORDED_CONTENT_KEY in ctrl.rulesJson.procgen_metadata['1']).toBe(false);
    });
    it('the guardian gate carries the fixture\'s name, colour and symbol; the control\'s the default pack\'s', () => {
        const gate = themed('character/the-gate');
        const guardians = (rj) => conceptGates(rj).filter((g) => g.def.concept === 'guardian');
        expect(guardians(world.rulesJson).length).toBeGreaterThan(0);
        for (const g of guardians(world.rulesJson)) {
            expect(lookOf(g.def), g.rid).toEqual({ name: gate.name, color: gate.look.color, symbol: gate.look.symbol });
        }
        for (const g of guardians(ctrl.rulesJson)) expect(lookOf(g.def), g.rid).toEqual(presentedLook(DEFAULT_SET, 'gate', 'guardian'));
    });
    it('what the fixture does not present with a look is the default pack\'s: the water gate and the sword rows', () => {
        const water = (rj) => conceptGates(rj).filter((g) => g.def.concept === 'water');
        expect(water(world.rulesJson).length).toBeGreaterThan(0);
        expect(water(world.rulesJson)).toEqual(water(ctrl.rulesJson));
        for (const g of water(world.rulesJson)) expect(lookOf(g.def), g.rid).toEqual(presentedLook(DEFAULT_SET, 'gate', 'water'));
        const sword = (rj) => conceptItems(rj).filter((i) => i.def.concept === 'sword');
        expect(sword(world.rulesJson).length).toBeGreaterThan(0);
        expect(sword(world.rulesJson)).toEqual(sword(ctrl.rulesJson));
    });
    it('the swim rows take the fixture\'s colour and symbol and keep their AP name', () => {
        const look = themed('object/swim').look;
        const swim = (rj) => conceptItems(rj).filter((i) => i.def.concept === 'swim');
        expect(swim(world.rulesJson).length).toBeGreaterThan(0);
        for (const i of swim(world.rulesJson)) {
            expect(i.def, i.rid).toMatchObject({ name: CONCEPTS.swim.item.name, color: look.color, symbol: look.symbol });
        }
        for (const i of swim(ctrl.rulesJson)) {
            const d = presentedLook(DEFAULT_SET, 'item', 'swim');
            expect(i.def, i.rid).toMatchObject({ color: d.color, symbol: d.symbol });
        }
    });
});
