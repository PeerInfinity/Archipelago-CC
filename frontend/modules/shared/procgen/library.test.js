import { describe, it, expect } from 'vitest';

import {
    DEFAULT_ITEMS,
    DEFAULT_OBSTACLES,
    isObstacleCleared,
    evaluateRuleAgainstInventory,
    getItemRenderHints,
} from './library.js';

describe('getItemRenderHints', () => {
    it('returns the library entry verbatim when the item is known', () => {
        const hints = getItemRenderHints('key_red', DEFAULT_ITEMS);
        expect(hints.color).toBe(DEFAULT_ITEMS.key_red.color);
        expect(hints.name).toBe(DEFAULT_ITEMS.key_red.name);
        // key_red.symbol is 'key' so the label rides through.
        expect(hints.label).toBe('key');
    });

    it('falls back to a hashed HSL color and the first-letter label for unknown items', () => {
        const hints = getItemRenderHints('Magic Compass', { /* no entries */ });
        expect(hints.color).toMatch(/^hsl\(\d+, 65%, 55%\)$/);
        expect(hints.label).toBe('M');
        expect(hints.name).toBe('Magic Compass');
    });

    it('produces deterministic colors — same id always hashes the same way', () => {
        const a = getItemRenderHints('Sword', {});
        const b = getItemRenderHints('Sword', {});
        expect(a.color).toBe(b.color);
    });

    it('produces different colors for different ids (most of the time)', () => {
        // 360 hue buckets — collisions are possible but unlikely
        // across a small batch of distinct names.
        const colors = ['Sword', 'Magnet', 'Bow', 'Bridge', 'Key']
            .map((id) => getItemRenderHints(id, {}).color);
        expect(new Set(colors).size).toBeGreaterThan(1);
    });

    it('uppercases the first character of the id for the label', () => {
        expect(getItemRenderHints('compass', {}).label).toBe('C');
        expect(getItemRenderHints('Compass', {}).label).toBe('C');
        expect(getItemRenderHints('!special', {}).label).toBe('!');
    });

    it('falls back to ? when given an empty id', () => {
        expect(getItemRenderHints('', {}).label).toBe('?');
    });

    it('uses default item lib when none is supplied', () => {
        // No lib → key_red should still resolve via the implicit DEFAULT_ITEMS.
        const hints = getItemRenderHints('key_red');
        expect(hints.name).toBe('Red Key');
    });
});

describe('isObstacleCleared / evaluateRuleAgainstInventory smoke (covered indirectly)', () => {
    it('combo_list door clears when the matching key is in inventory', () => {
        expect(isObstacleCleared('door_red', new Set(['key_red']), DEFAULT_OBSTACLES)).toBe(true);
        expect(isObstacleCleared('door_red', new Set(['key_blue']), DEFAULT_OBSTACLES)).toBe(false);
    });

    it('rule-typed obstacle dispatches through evaluateRuleAgainstInventory', () => {
        const lib = {
            gate_compass: {
                clear_set_type: 'rule',
                clear_rule: { rule: 'Has', args: { item_name: 'compass' } },
            },
        };
        expect(isObstacleCleared('gate_compass', new Set(['compass']), lib)).toBe(true);
        expect(isObstacleCleared('gate_compass', new Set(), lib)).toBe(false);
    });

    it('evaluates True_ / False_ / And / Or directly', () => {
        expect(evaluateRuleAgainstInventory({ rule: 'True_' }, new Set())).toBe(true);
        expect(evaluateRuleAgainstInventory({ rule: 'False_' }, new Set())).toBe(false);
        const and = {
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'a' } },
                { rule: 'Has', args: { item_name: 'b' } },
            ],
        };
        expect(evaluateRuleAgainstInventory(and, new Set(['a', 'b']))).toBe(true);
        expect(evaluateRuleAgainstInventory(and, new Set(['a']))).toBe(false);
    });
});
