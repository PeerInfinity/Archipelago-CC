/**
 * procgenCore/contentRoles — **THE ROLES CONTRACT** (content sets C2).
 *
 * ⛓ The subjects are test-double entries over the SHIPPED concept table, and pack stacks read through
 * `loadPackStack` with an in-memory `readJson` (the C1 tests' shape). No registered entry declares a role in this
 * slice; the last block holds every committed entry to the contract all the same.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { PACK_CONCEPT_KINDS, createPackConcepts } from '../packConcepts/packConcepts.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { CONCEPTS, ConceptContractError, assertRealisations, realisationsOf } from './concepts.js';
import {
    ACCEPTS_FORMS, NEED_FIELDS, ROLE_FIELDS,
    assertContentRoles, assertPresents, candidatesForRole, contentRolesOf, resolveRole, roleRefusal, rolesFilledBy, textVariantKey,
} from './contentRoles.js';
import { createTextLibrary } from '../textLibrary/textLibrary.js';
import { SUBSTRATE_LIBRARIES } from './substrateLibraries.js';
import { withFixtureProvenance } from '../contentPacks/testing/fixtureProvenance.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const MODULES = join(ROOT, 'frontend', 'modules');

/** The brief's three roles, verbatim in shape. */
function roles() {
    return {
        gate: {
            accepts: { presents: ['guardian', 'water'] },
            needs: { look: true, text: ['blocked', 'passedWith'] },
            why: 'a planned gate, shown as the concept the rule selected',
        },
        character: { accepts: { kinds: ['character'] }, needs: { text: ['greeting'] }, why: 'someone to meet in a room' },
        info: { accepts: { kinds: ['info'] }, needs: { text: ['body'] }, why: 'a piece of information held at a location' },
    };
}

/** A fresh double each call: realises every concept a role presents, so a test may break one field. */
function double() {
    const presented = Object.values(roles()).flatMap((r) => r.accepts.presents ?? []);
    return {
        id: 'double',
        conceptRealisations: Object.fromEntries(presented.map((id) => [id, { tier: 'skin' }])),
        contentRoles: roles(),
    };
}

function throwsNaming(fn, re) {
    let err = null;
    try { fn(); } catch (e) { err = e; }
    expect(err, 'expected a throw').toBeInstanceOf(ConceptContractError);
    expect(err.message).toMatch(re);
    return err;
}

// ── pack stacks, in memory ──────────────────────────────────────────────
const MEM = 'mem:/packs/';
const packJson = (id) => ({ schema_version: 1, id, title: id, licence: 'CC0', layers: { concepts: 'concepts/manifest.json' } });
const memReader = (files) => async (url) => {
    const hit = Object.keys(files).find((suffix) => url.endsWith(suffix));
    if (!hit) throw new Error(`no file ${url}`);
    return structuredClone(files[hit]);
};
const stackOf = (manifests) => loadPackStack(Object.keys(manifests), {
    base: MEM,
    readJson: withFixtureProvenance(memReader(Object.fromEntries(Object.entries(manifests).flatMap(([id, m]) => [
        [`/${id}/pack.json`, packJson(id)],
        [`/${id}/concepts/manifest.json`, m],
    ])))),
});
// The registered entries: every library, imported once (registration is the import's side effect).
for (const lib of SUBSTRATE_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(MODULES, lib));
}

const conceptsOf = async (manifests) => createPackConcepts(await stackOf(manifests));

/** The earlier pack: a character, a piece of information, and a guardian presenter that lacks `passedWith`. */
const BASE = {
    schema_version: 1,
    concepts: {
        'base:character/keeper': { kind: 'character', name: 'The Keeper', text: { greeting: 'base:keeper/greeting' } },
        'base:info/sign': { kind: 'info', name: 'A Sign', text: { body: 'base:sign/body' } },
        'base:character/half-gate': {
            kind: 'character', name: 'The Half Gate', look: { color: '#808080', symbol: 'H' },
            text: { blocked: 'base:half-gate/blocked' }, presents: 'guardian',
        },
    },
};
/** The later pack: a guardian presenter that supplies everything the gate role needs. */
const THEME = {
    schema_version: 1,
    concepts: {
        'theme:character/the-gate': {
            kind: 'character', name: 'The Gate', look: { color: '#a04040', symbol: '#' },
            text: { blocked: 'theme:gate/blocked', passedWith: 'theme:gate/passed', greeting: 'theme:gate/hello' },
            presents: 'guardian',
        },
    },
};

describe('the vocabulary', () => {
    it('the role fields, the two accepts forms, the need fields', () => {
        expect(ROLE_FIELDS).toEqual(['accepts', 'needs', 'why']);
        expect(ACCEPTS_FORMS).toEqual(['kinds', 'presents']);
        expect(NEED_FIELDS).toEqual(['look', 'art', 'text']);
    });
});

describe('⛔ browser-safe and nameless (the SOURCE, read)', () => {
    it('frontend/modules/procgenCore/contentRoles.js: no node: import, no registry import, no registered substrate id', () => {
        const ids = substrateRegistry.getAll().map((e) => e.id);
        expect(ids.length).toBeGreaterThan(0);
        const src = readFileSync(join(HERE, 'contentRoles.js'), 'utf8');
        expect(src).not.toMatch(/from\s+['"]node:/);
        expect(src).not.toMatch(/substrateRegistry|reference\/registry|procgenDocs\/generated/);
        const named = ids.filter((id) => new RegExp(`(?<![A-Za-z0-9_])${id}(?![A-Za-z0-9_])`).test(src));
        expect(named).toEqual([]);
    });
});

describe('assertContentRoles — a malformed declaration THROWS, naming the role', () => {
    it('the brief\'s roles pass; an entry with none is not an error (rule 4)', () => {
        expect(() => assertContentRoles(double(), CONCEPTS)).not.toThrow();
        expect(() => assertContentRoles({ id: 'bare' }, CONCEPTS)).not.toThrow();
        expect(() => assertContentRoles({ id: 'nulled', contentRoles: null }, CONCEPTS)).not.toThrow();
        expect(() => assertContentRoles(undefined, CONCEPTS)).not.toThrow();
    });

    it('every pack concept kind may be accepted', () => {
        const e = double();
        e.contentRoles.any = { accepts: { kinds: [...PACK_CONCEPT_KINDS] }, why: 'anything at all' };
        expect(() => assertContentRoles(e, CONCEPTS)).not.toThrow();
    });

    const bad = [
        ['contentRoles that is not an object', (e) => { e.contentRoles = ['gate']; }, /"double"'s `contentRoles` is not an object/],
        ['a role that is not an object', (e) => { e.contentRoles.gate = 'gate'; }, /role "gate" is not an object/],
        ['an empty role id', (e) => { e.contentRoles[''] = roles().info; }, /role with an empty id/],
        ['an unknown role field', (e) => { e.contentRoles.info.fallback = 'x'; }, /role "info": unknown field "fallback"/],
        ['a role with no why', (e) => { delete e.contentRoles.info.why; }, /role "info" has no `why`/],
        ['an empty why', (e) => { e.contentRoles.info.why = ''; }, /role "info" has no `why`/],
        ['no accepts', (e) => { delete e.contentRoles.info.accepts; }, /role "info": `accepts` is not an object/],
        ['accepts with neither form', (e) => { e.contentRoles.info.accepts = {}; }, /role "info": `accepts` must declare exactly one .* \(it declares neither\)/],
        ['accepts with both forms', (e) => { e.contentRoles.gate.accepts.kinds = ['character']; }, /role "gate": `accepts` must declare exactly one .* \(it declares presents and kinds\)/],
        ['an unknown accepts form', (e) => { e.contentRoles.info.accepts = { kind: ['info'] }; }, /role "info": `accepts` has unknown field "kind"/],
        ['an empty kinds list', (e) => { e.contentRoles.info.accepts.kinds = []; }, /role "info": `accepts.kinds` is not a non-empty list/],
        ['an unknown kind', (e) => { e.contentRoles.info.accepts.kinds = ['clue']; }, /role "info": `accepts.kinds` names "clue", not a pack concept kind/],
        ['a mechanic concept kind as a pack kind', (e) => { e.contentRoles.info.accepts.kinds = ['enemy']; }, /`accepts.kinds` names "enemy"/],
        ['a kind listed twice', (e) => { e.contentRoles.info.accepts.kinds = ['info', 'info']; }, /`accepts.kinds` lists "info" twice/],
        ['an empty presents list', (e) => { e.contentRoles.gate.accepts.presents = []; }, /role "gate": `accepts.presents` is not a non-empty list/],
        ['presents naming no concept in the table', (e) => { e.contentRoles.gate.accepts.presents = ['dragon']; }, /role "gate": `accepts.presents` names "dragon", which the concept table does not hold/],
        ['presents naming a concept the entry does not realise', (e) => { delete e.conceptRealisations.water; }, /role "gate": `accepts.presents` names "water", which the entry's `conceptRealisations` does not realise/],
        ['needs that is not an object', (e) => { e.contentRoles.info.needs = ['body']; }, /role "info": `needs` is not an object/],
        ['needs listing name', (e) => { e.contentRoles.info.needs.name = true; }, /role "info": `needs.name` — every pack concept has a name/],
        ['an unknown need', (e) => { e.contentRoles.info.needs.sound = true; }, /role "info": `needs` has unknown field "sound"/],
        ['a look need that is not a boolean', (e) => { e.contentRoles.gate.needs.look = 'yes'; }, /role "gate": `needs.look` is "yes", not a boolean/],
        ['an art need that is not a boolean', (e) => { e.contentRoles.gate.needs.art = 1; }, /role "gate": `needs.art` is 1, not a boolean/],
        ['an empty text list', (e) => { e.contentRoles.info.needs.text = []; }, /role "info": `needs.text` is not a non-empty list/],
        ['an empty text slot', (e) => { e.contentRoles.info.needs.text = ['']; }, /role "info": `needs.text` holds ""/],
        ['a text slot twice', (e) => { e.contentRoles.gate.needs.text = ['blocked', 'blocked']; }, /role "gate": `needs.text` lists "blocked" twice/],
    ];
    it.each(bad)('refuses %s', (_label, mutate, re) => {
        const e = double();
        mutate(e);
        throwsNaming(() => assertContentRoles(e, CONCEPTS), re);
    });
});

describe('contentRolesOf — normalises, as realisationsOf does', () => {
    it('an entry → its field; a roles object → itself; anything else → {}', () => {
        const e = double();
        expect(contentRolesOf(e)).toBe(e.contentRoles);
        expect(contentRolesOf(e.contentRoles)).toBe(e.contentRoles);
        expect(contentRolesOf({ id: 'x', contentRoles: null })).toEqual({});
        expect(contentRolesOf({ id: 'bare' })).toEqual({});
        expect(contentRolesOf({})).toEqual({});
        expect(contentRolesOf(null)).toEqual({});
        expect(contentRolesOf([roles().info])).toEqual({});
        // a realisations object is not a roles object
        expect(contentRolesOf(e.conceptRealisations)).toEqual({});
    });
});

describe('roleRefusal — null when the concept fills the role, else the FIRST thing missing', () => {
    const r = roles();
    const fit = Object.freeze({
        key: 'p:character/fit', pack: 'p', kind: 'character', name: 'Fit',
        look: { color: '#000000', symbol: 'F' }, art: 'p:character/fit',
        text: { greeting: 'p:fit/greeting', blocked: 'p:fit/blocked', passedWith: 'p:fit/passed' },
        presents: 'guardian',
    });
    it('a concept with everything fills the gate role; without `presents` it fills the character role', () => {
        expect(roleRefusal(r.gate, fit)).toBeNull();
        expect(roleRefusal(r.character, { ...fit, presents: undefined })).toBeNull();
    });
    it('⛓ S1: a concept that presents a mechanic never fills a KIND role (it is that mechanic\'s look)', () => {
        expect(roleRefusal(r.character, fit)).toBe('"p:character/fit" presents "guardian", so it is that mechanic\'s look and fills no kind role');
        // the kind check comes first: a presenter of the wrong kind is refused for its kind
        expect(roleRefusal(r.info, fit)).toMatch(/is a character; the role accepts info/);
    });
    it.each([
        ['no concept', r.character, null, /no such pack concept/],
        ['the wrong kind', r.info, fit, /"p:character\/fit" is a character; the role accepts info/],
        ['not presenting an accepted concept', r.gate, { ...fit, presents: 'sword' }, /"p:character\/fit" does not present any of "guardian", "water"/],
        ['presenting nothing', r.gate, { ...fit, presents: undefined }, /does not present any of/],
        ['no look', r.gate, { ...fit, look: undefined }, /"p:character\/fit" has no `look`/],
        ['no art', { ...r.character, needs: { art: true } }, { ...fit, presents: undefined, art: undefined }, /"p:character\/fit" has no `art`/],
        ['no text at all', r.character, { ...fit, presents: undefined, text: undefined }, /has no text slot "greeting"/],
        ['a missing text slot, named', r.gate, { ...fit, text: { blocked: 'p:fit/blocked' } }, /has no text slot "passedWith"/],
    ])('refuses %s', (_label, role, concept, re) => {
        expect(roleRefusal(role, concept)).toMatch(re);
    });
    it('the order: kind before look before text', () => {
        expect(roleRefusal(r.gate, { ...fit, presents: 'sword', look: undefined, text: undefined })).toMatch(/does not present/);
        expect(roleRefusal(r.gate, { ...fit, look: undefined, text: undefined })).toMatch(/no `look`/);
    });
    it('a false need asks for nothing', () => {
        expect(roleRefusal({ ...r.character, needs: { look: false, art: false, text: ['greeting'] } },
            { ...fit, presents: undefined, look: undefined, art: undefined })).toBeNull();
    });
});

describe('a two-pack stack: the later pack\'s guardian presenter fills the gate role', () => {
    it('candidatesForRole, in the library\'s order; the presenter that lacks a slot is refused with the slot named', async () => {
        const pc = await conceptsOf({ base: BASE, theme: THEME });
        const e = double();
        expect(() => assertPresents(pc, CONCEPTS)).not.toThrow();
        expect(candidatesForRole(e, 'gate', pc)).toEqual(['theme:character/the-gate']);
        expect(roleRefusal(e.contentRoles.gate, pc.get('base:character/half-gate'))).toBe('"base:character/half-gate" has no text slot "passedWith"');
        // the character role: every character with a greeting, in keys() order (stack order, then declaration order)
        const greeters = pc.keys().filter((k) => pc.get(k).kind === 'character' && pc.get(k).text?.greeting && !pc.get(k).presents);
        expect(candidatesForRole(e, 'character', pc)).toEqual(greeters);
        expect(candidatesForRole(e.contentRoles, 'info', pc)).toEqual(pc.ofKind('info'));
    });

    it('rolesFilledBy: every role, in the entry\'s declared order', async () => {
        const pc = await conceptsOf({ base: BASE, theme: THEME });
        const e = double();
        expect(rolesFilledBy(e, pc)).toEqual(Object.keys(e.contentRoles).map((role) => ({
            role, concepts: candidatesForRole(e, role, pc),
        })));
        expect(rolesFilledBy(e, pc).map((r) => r.role)).toEqual(Object.keys(e.contentRoles));
        expect(rolesFilledBy({ id: 'bare' }, pc)).toEqual([]);
    });

    it('the earlier pack alone fills no gate', async () => {
        const pc = await conceptsOf({ base: BASE });
        expect(candidatesForRole(double(), 'gate', pc)).toEqual([]);
    });

    it('an undeclared role is refused by name', async () => {
        const pc = await conceptsOf({ base: BASE });
        throwsNaming(() => candidatesForRole(double(), 'villain', pc), /no role "villain" \(declared: gate, character, info\)/);
        throwsNaming(() => candidatesForRole({ id: 'bare' }, 'gate', pc), /no role "gate" \(the entry declares none\)/);
    });
});

/** A content set in memory: the stack's concepts, and a text library holding `strings` (keys of either pack). */
async function setOf(manifests, strings) {
    const stack = await stackOf(manifests);
    const ids = stack.map((l) => l.id);
    const text = createTextLibrary(ids.map((id) => ({
        id,
        layers: { text: { schema_version: 1, strings: Object.fromEntries(Object.entries(strings).filter(([k]) => k.startsWith(`${id}:`))) } },
    })));
    return { ids, concepts: createPackConcepts(stack), text };
}

describe('⛓ S1 resolveRole — the one shared resolver', () => {
    const STRINGS = {
        'base:keeper/greeting': 'Hello from the base.',
        'base:sign/body': 'The sign says what signs say.',
        'base:half-gate/blocked': 'half',
        'theme:gate/blocked': 'Shut.',
        'theme:gate/passed': 'Open.',
        'theme:gate/hello': 'Hi.',
    };
    it('each candidate with its needed slots RESOLVED, latest pack first', async () => {
        const set = await setOf({ base: BASE, theme: THEME }, STRINGS);
        const got = resolveRole(double(), 'gate', set);
        expect(got.map((c) => c.key)).toEqual(['theme:character/the-gate']);
        expect(got[0].text).toEqual({ blocked: 'Shut.', passedWith: 'Open.' });
        expect(got[0].concept).toBe(set.concepts.get('theme:character/the-gate'));
        expect(resolveRole(double(), 'info', set)).toEqual([{
            key: 'base:info/sign', concept: set.concepts.get('base:info/sign'), text: { body: STRINGS['base:sign/body'] },
        }]);
    });
    it('a presenter fills no kind role: the theme\'s Gate (which has a greeting) is not a character', async () => {
        const set = await setOf({ base: BASE, theme: THEME }, STRINGS);
        expect(resolveRole(double(), 'character', set).map((c) => c.key)).toEqual(['base:character/keeper']);
    });
    it('a candidate whose key does not resolve falls through; none resolving ⇒ []', async () => {
        const { 'base:sign/body': _gone, ...rest } = STRINGS;
        const set = await setOf({ base: BASE, theme: THEME }, rest);
        expect(candidatesForRole(double(), 'info', set.concepts)).toEqual(['base:info/sign']);
        expect(resolveRole(double(), 'info', set)).toEqual([]);
    });
    it('the stack order decides: two packs filling one role, the later first; `presents` narrows', async () => {
        const LATER = { schema_version: 1, concepts: { 'later:character/keeper': { kind: 'character', name: 'Later', text: { greeting: 'later:greeting' } } } };
        const set = await setOf({ base: BASE, later: LATER }, { ...STRINGS, 'later:greeting': 'Later hello.' });
        expect(resolveRole(double(), 'character', set).map((c) => c.key)).toEqual(['later:character/keeper', 'base:character/keeper']);
        const both = await setOf({ base: BASE, theme: THEME }, STRINGS);
        expect(resolveRole(double(), 'gate', both, { presents: 'water' })).toEqual([]);
        expect(resolveRole(double(), 'gate', both, { presents: 'guardian' }).map((c) => c.key)).toEqual(['theme:character/the-gate']);
    });
    it('⛓ S2 `variant`: `<key>/<variant>` is asked first, then `<key>`; without a variant nothing changes', async () => {
        const variantKey = textVariantKey('base:sign/body', 'maze');
        expect(variantKey).toBe('base:sign/body/maze');
        const set = await setOf({ base: BASE, theme: THEME }, { ...STRINGS, [variantKey]: 'The maze\'s own sign.' });
        expect(resolveRole(double(), 'info', set, { variant: 'maze' })[0].text).toEqual({ body: 'The maze\'s own sign.' });
        expect(resolveRole(double(), 'info', set)[0].text).toEqual({ body: STRINGS['base:sign/body'] });
        // a variant nobody wrote falls back to the shared line
        expect(resolveRole(double(), 'info', set, { variant: 'elsewhere' })[0].text).toEqual({ body: STRINGS['base:sign/body'] });
        // the gate's two slots: one has a variant, the other falls back, per slot
        const gateSet = await setOf({ base: BASE, theme: THEME }, { ...STRINGS, [textVariantKey('theme:gate/blocked', 'maze')]: 'Shut (maze).' });
        expect(resolveRole(double(), 'gate', gateSet, { variant: 'maze' })[0].text).toEqual({ blocked: 'Shut (maze).', passedWith: 'Open.' });
    });
    it('no set ⇒ []; an undeclared role is refused by name', async () => {
        expect(resolveRole(double(), 'gate', null)).toEqual([]);
        const set = await setOf({ base: BASE }, STRINGS);
        throwsNaming(() => resolveRole(double(), 'villain', set), /no role "villain"/);
    });
});

describe('assertPresents — every presents in the stack names a concept in the table', () => {
    it('⛓ PL-1 — a NAMESPACED presents names a structure entry, so it is not looked up in the concept table', async () => {
        const pc = await conceptsOf({
            base: BASE,
            game: { schema_version: 1, concepts: { 'game:task/pick-locks': { kind: 'task', name: 'Pick Locks', presents: 'game:task/pick-locks' } } },
        });
        expect(() => assertPresents(pc, CONCEPTS)).not.toThrow();
        expect(pc.presenting('game:task/pick-locks').name).toBe('Pick Locks');
    });
    it('refuses an unknown id by pack, key and id', async () => {
        const pc = await conceptsOf({
            base: BASE,
            odd: { schema_version: 1, concepts: { 'odd:character/dragon': { kind: 'character', name: 'A Dragon', presents: 'dragon' } } },
        });
        throwsNaming(() => assertPresents(pc, CONCEPTS), /pack "odd" concept "odd:character\/dragon" presents "dragon", which the concept table does not hold/);
    });
    it('an override that drops presents is not checked for the entry it replaced', async () => {
        const pc = await conceptsOf({
            odd: { schema_version: 1, concepts: { 'odd:character/dragon': { kind: 'character', name: 'A Dragon', presents: 'dragon' } } },
            fix: { schema_version: 1, concepts: { 'odd:character/dragon': { kind: 'character', name: 'A Dragon' } } },
        });
        expect(() => assertPresents(pc, CONCEPTS)).not.toThrow();
    });
});

describe('the committed entries (every registered substrate, through substrateLibraries.js)', () => {
    it('each still passes assertRealisations, and passes assertContentRoles', () => {
        const entries = substrateRegistry.getAll();
        expect(entries.length).toBeGreaterThan(0);
        // the libraries reach entries that realise concepts, so the presents half has subjects when a role arrives
        expect(entries.some((e) => Object.keys(realisationsOf(e)).length > 0)).toBe(true);
        for (const e of entries) {
            expect(() => assertRealisations(e, CONCEPTS), e.id).not.toThrow();
            expect(() => assertContentRoles(e, CONCEPTS), e.id).not.toThrow();
        }
    });
});
