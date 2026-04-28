import { describe, it, expect } from 'vitest';

import {
    DEFAULT_ITEMS,
    DEFAULT_OBSTACLES,
    isObstacleCleared,
    evaluateRuleAgainstInventory,
    getItemRenderHints,
} from './library.js';

describe('library entry feature tagging', () => {
    it('every DEFAULT_ITEMS entry has a non-empty feature string', () => {
        for (const [id, def] of Object.entries(DEFAULT_ITEMS)) {
            expect(typeof def.feature, `item '${id}' is missing a feature tag`).toBe('string');
            expect(def.feature.length, `item '${id}' has an empty feature tag`).toBeGreaterThan(0);
        }
    });

    it('every DEFAULT_OBSTACLES entry has a non-empty feature string', () => {
        for (const [id, def] of Object.entries(DEFAULT_OBSTACLES)) {
            expect(typeof def.feature, `obstacle '${id}' is missing a feature tag`).toBe('string');
            expect(def.feature.length, `obstacle '${id}' has an empty feature tag`).toBeGreaterThan(0);
        }
    });

    it('keys and doors share the colored_doors_and_keys feature', () => {
        // This pairing is what the Library subsection's filtering
        // depends on — keys and doors of the same color must group
        // together so a substrate that supports neither hides both.
        for (const id of ['key_red', 'key_green', 'key_blue']) {
            expect(DEFAULT_ITEMS[id].feature).toBe('colored_doors_and_keys');
        }
        for (const id of ['door_red', 'door_green', 'door_blue']) {
            expect(DEFAULT_OBSTACLES[id].feature).toBe('colored_doors_and_keys');
        }
    });

    it('logic_gate carries the logic_gate feature tag', () => {
        expect(DEFAULT_OBSTACLES.logic_gate.feature).toBe('logic_gate');
    });
});

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

describe('isObstacleCleared evaluator injection (§8)', () => {
    it('uses opts.evaluateRule for rule-typed obstacles when supplied', () => {
        const lib = {
            gate_compass: {
                clear_set_type: 'rule',
                // The local evaluator returns false on this construct
                // (`CountItem` is outside its supported set — see
                // evaluateRuleAgainstInventory's default branch);
                // injection replaces it with a richer evaluator.
                clear_rule: { rule: 'CountItem', args: { item_name: 'compass', count: 2 } },
            },
        };
        let calls = 0;
        const customEval = (rule, _inv) => {
            calls += 1;
            // Pretend we counted compasses and saw two.
            return rule.rule === 'CountItem' && rule.args.count === 2;
        };
        const cleared = isObstacleCleared(
            'gate_compass',
            new Set(),
            lib,
            { evaluateRule: customEval },
        );
        expect(cleared).toBe(true);
        expect(calls).toBe(1);
    });

    it('does not use opts.evaluateRule for combo_list obstacles', () => {
        let calls = 0;
        const customEval = () => { calls += 1; return false; };
        // Standard colored door — combo_list type — should bypass the
        // injected evaluator entirely.
        const cleared = isObstacleCleared(
            'door_red',
            new Set(['key_red']),
            DEFAULT_OBSTACLES,
            { evaluateRule: customEval },
        );
        expect(cleared).toBe(true);
        expect(calls).toBe(0);
    });

    it('falls back to the local evaluator when no opts are supplied', () => {
        // Simple Has rule the local evaluator handles natively.
        const lib = {
            simple: {
                clear_set_type: 'rule',
                clear_rule: { rule: 'Has', args: { item_name: 'compass' } },
            },
        };
        expect(isObstacleCleared('simple', new Set(['compass']), lib)).toBe(true);
        expect(isObstacleCleared('simple', new Set(), lib)).toBe(false);
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

    it('evaluates HasAll / HasAny natively', () => {
        const all = { rule: 'HasAll', args: { items: ['a', 'b'] } };
        expect(evaluateRuleAgainstInventory(all, new Set(['a', 'b']))).toBe(true);
        expect(evaluateRuleAgainstInventory(all, new Set(['a']))).toBe(false);
        const any = { rule: 'HasAny', args: { items: ['a', 'b'] } };
        expect(evaluateRuleAgainstInventory(any, new Set(['a']))).toBe(true);
        expect(evaluateRuleAgainstInventory(any, new Set())).toBe(false);
    });

    it('treats unsupported rule constructs as unsatisfied (graceful degradation)', () => {
        // CountItem isn't in the local subset; instead of throwing,
        // the evaluator returns false so substrate placement / path
        // extraction keeps working.
        expect(evaluateRuleAgainstInventory(
            { rule: 'CountItem', args: { item_name: 'x', count: 2 } },
            new Set(),
        )).toBe(false);
    });
});
