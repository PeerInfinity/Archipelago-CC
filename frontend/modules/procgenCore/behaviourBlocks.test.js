/**
 * procgenCore/behaviourBlocks — **THE FOUR REGISTRIES AND THE STARTER SET**
 * (behaviour parameters P2, D2).
 *
 * ⛓ The browser-safe / nameless source test for this file lives beside the
 * one for `concepts.js` (`concepts.test.js`), so the two are held to ONE rule.
 */
import { describe, expect, it } from 'vitest';

import { domainKind } from './templateContract.js';
import {
    BLOCKS, BLOCK_FAMILIES, BehaviourVocabularyError, DEFENCE_RESPONSES, REGISTRIES, TILE_TRIGGERS,
    WEAPON_CATEGORIES, assertVocabulary, createRegistry, fieldValueRefusal,
} from './behaviourBlocks.js';

const throwsNaming = (fn, re) => {
    expect(fn).toThrow(BehaviourVocabularyError);
    expect(fn).toThrow(re);
};

describe('createRegistry — declared where introduced', () => {
    it('declare / has / get / ids, in declaration order; a record is frozen and carries its id', () => {
        const r = createRegistry('things');
        const a = r.declare('a', { why: 'first' });
        r.declare('b', { why: 'second', extra: 1 });
        expect(r.name).toBe('things');
        expect(r.ids()).toEqual(['a', 'b']);
        expect(r.has('a')).toBe(true);
        expect(r.has('c')).toBe(false);
        expect(r.get('b')).toEqual({ why: 'second', extra: 1, id: 'b' });
        expect(Object.isFrozen(a)).toBe(true);
        expect(r.get('c')).toBeUndefined();
    });

    it('refuses a duplicate id, a missing why and a non-string id — by name', () => {
        const r = createRegistry('things');
        r.declare('a', { why: 'first' });
        throwsNaming(() => r.declare('a', { why: 'again' }), /registry "things" already declares "a"/);
        throwsNaming(() => r.declare('b', {}), /registry "things" id "b" carries no `why`/);
        throwsNaming(() => r.declare('b', { why: '' }), /id "b" carries no `why`/);
        throwsNaming(() => r.declare(7, { why: 'x' }), /the id 7; an id is a non-empty string/);
        throwsNaming(() => r.declare('', { why: 'x' }), /an id is a non-empty string/);
        expect(r.ids()).toEqual(['a']);
    });

    it('a registry needs a name', () => {
        throwsNaming(() => createRegistry(''), /non-empty name/);
    });
});

describe('the four registries', () => {
    it('are named, and REGISTRIES holds them by name', () => {
        expect(Object.keys(REGISTRIES)).toEqual(['blocks', 'weaponCategories', 'defenceResponses', 'tileTriggers']);
        expect(REGISTRIES.blocks).toBe(BLOCKS);
        expect(REGISTRIES.weaponCategories).toBe(WEAPON_CATEGORIES);
        expect(REGISTRIES.defenceResponses).toBe(DEFENCE_RESPONSES);
        expect(REGISTRIES.tileTriggers).toBe(TILE_TRIGGERS);
    });

    it('BLOCK_FAMILIES is the closed, structural list', () => {
        expect(BLOCK_FAMILIES).toEqual(['movement', 'attack', 'defence', 'trigger']);
        expect(Object.isFrozen(BLOCK_FAMILIES)).toBe(true);
    });

    it('the starter set holds the plan\'s ids (the one rename: `bounce` is `rebound`)', () => {
        const byFamily = (f) => BLOCKS.ids().filter((id) => BLOCKS.get(id).family === f);
        expect(byFamily('movement')).toEqual(['stationary', 'chase', 'rebound', 'patrol', 'seek', 'ballistic',
            'pushable', 'wall-launch', 'tile-hop', 'lane-charge', 'rise']);
        expect(byFamily('attack')).toEqual(['contact', 'emitter', 'sweep', 'melee', 'pulse', 'stomp', 'explode',
            'beam', 'tether']);
        expect(byFamily('defence')).toEqual(['hp', 'matrix', 'terrain', 'onDeath']);
        expect(byFamily('trigger')).toEqual(['proximity', 'lineOfSight', 'channel', 'persistence', 'onHit',
            'allEnemiesDead', 'itemHeld', 'schedule', 'light', 'facingAway']);
        expect(WEAPON_CATEGORIES.ids()).toEqual(['sword', 'spear', 'fire', 'magic', 'pulse', 'shield', 'armour',
            'lava', 'projectile', 'explosion', 'crusher', 'chain']);
        expect(DEFENCE_RESPONSES.ids()).toEqual(['damage', 'knockOnly', 'ignore', 'breakIfLevel', 'reflect',
            'freeze', 'stun', 'heal', 'split', 'spawn', 'phaseGated']);
        expect(TILE_TRIGGERS.ids()).toEqual(['itemCategory', 'level', 'counter', 'channel']);
    });

    it('every starter record carries a one-sentence `why`', () => {
        for (const reg of Object.values(REGISTRIES)) {
            for (const id of reg.ids()) expect(reg.get(id).why, `${reg.name}.${id}`).toMatch(/\S.*[.)]$/);
        }
    });

    it('⛔ no `slow|medium|fast` anywhere — a field is a range or an open id unless genuinely finite', () => {
        const all = [
            ...BLOCKS.ids().flatMap((id) => BLOCKS.get(id).fields),
            ...DEFENCE_RESPONSES.ids().flatMap((id) => DEFENCE_RESPONSES.get(id).params ?? []),
            ...TILE_TRIGGERS.ids().flatMap((id) => TILE_TRIGGERS.get(id).params ?? []),
        ];
        const lists = all.filter((p) => domainKind(p) === 'list');
        for (const p of lists) expect(p.domain.some((v) => /^(slow|medium|fast)$/.test(v)), p.key).toBe(false);
        expect(lists.map((p) => p.key).sort()).toEqual(['aim', 'axis', 'lit', 'scope']);
    });

    it('assertVocabulary passes: every open {id} names a registry here, and its default is declared', () => {
        expect(() => assertVocabulary()).not.toThrow();
    });
});

describe('a block field in each of the three forms validates', () => {
    it('list, range (stepped and not) and open (string and id) are all accepted on a real block', () => {
        const chase = BLOCKS.get('chase');
        expect(chase.fields.map(domainKind)).toEqual(['range', 'range']);
        expect(BLOCKS.get('rebound').fields.map(domainKind)).toEqual(['range', 'list']);
        expect(BLOCKS.get('onHit').fields.map(domainKind)).toEqual(['open']);
        expect(BLOCKS.get('hp').fields[0].range.step).toBe(1);
        expect(BLOCKS.get('pushable').fields[0].open).toEqual({ id: 'weaponCategories' });
        expect(BLOCKS.get('seek').fields[1].open).toBe('string');
    });

    it('fieldValueRefusal: the form, and for an open {id} the registry', () => {
        const onHit = BLOCKS.get('onHit').fields[0];
        expect(fieldValueRefusal(onHit, 'fire')).toBeNull();
        expect(fieldValueRefusal(onHit, 'laser')).toMatch(/not an id the "weaponCategories" registry declares/);
        expect(fieldValueRefusal(onHit, 3)).toMatch(/not in its domain/);
        const speed = BLOCKS.get('chase').fields[0];
        expect(fieldValueRefusal(speed, 0.5)).toBeNull();
        expect(fieldValueRefusal(speed, 'fast')).toMatch(/not in its domain/);
    });
});

describe('a malformed block is refused by the SAME schema language, re-owned', () => {
    it('a block field with no why names the block and the field', () => {
        expect(() => BLOCKS.declare('scratch-no-why', {
            why: 'scratch', family: 'movement', fields: [{ key: 'speed', range: { min: 0, max: 1 }, default: 0 }],
        })).toThrow(/block "scratch-no-why" parameter "speed" carries no\s+`why`/);
        expect(BLOCKS.has('scratch-no-why')).toBe(false);
    });
    it('an unknown family is refused by name', () => {
        throwsNaming(() => BLOCKS.declare('scratch-bad-family', { why: 'x', family: 'dance', fields: [] }),
            /block "scratch-bad-family" declares family "dance"/);
    });
    it('a response param in a bad form is refused by name', () => {
        throwsNaming(() => DEFENCE_RESPONSES.declare('scratch-bad', {
            why: 'x', params: [{ key: 'factor', range: { min: 1, max: 0 }, default: 1, why: 'x' }],
        }), /response "scratch-bad" parameter "factor" declares the range/);
    });
});
