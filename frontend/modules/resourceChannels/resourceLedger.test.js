import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceLedger, LEDGER_REFUSALS } from './resourceLedger.js';
import { resourcesPanelModel, describeGives } from './resourcesPanel.js';

const STATS = { strength: { name: 'Strength' } };
const RESOURCES = { gold: { name: 'Gold' }, bread: { name: 'Bread' } };

describe('the host ledger', () => {
    let ledger, changes;
    beforeEach(() => {
        changes = [];
        ledger = new ResourceLedger({ onChange: (s) => changes.push(s) });
        ledger.configure({ owner: 'action_nodes', stats: STATS, resources: RESOURCES });
    });

    it('starts every declared id at 0 and names them', () => {
        expect(ledger.snapshot()).toMatchObject({
            owner: 'action_nodes',
            stats: { strength: 0 },
            resources: { gold: 0, bread: 0 },
            names: { stats: { strength: 'Strength' }, resources: { gold: 'Gold', bread: 'Bread' } },
        });
    });

    it('applies a change all-or-nothing and reports it', () => {
        expect(ledger.apply({ stats: { strength: 1 }, resources: { gold: 3 } }, { source: 'act:x' })).toEqual({ ok: true });
        expect(ledger.getStat('strength')).toBe(1);
        expect(ledger.getResource('gold')).toBe(3);
        expect(changes.at(-1).lastSource).toBe('act:x');
        const n = changes.length;
        // gold +1 is fine, bread -1 is not: nothing changes
        const r = ledger.apply({ resources: { gold: 1, bread: -1 } });
        expect(r).toMatchObject({ ok: false, code: LEDGER_REFUSALS.resourceBelowZero });
        expect(ledger.getResource('gold')).toBe(3);
        expect(changes.length).toBe(n);
    });

    it('refuses by name: a stat going down, an unknown id, a fraction, no world', () => {
        expect(ledger.apply({ stats: { strength: -1 } })).toMatchObject({ ok: false, code: LEDGER_REFUSALS.statDown });
        expect(ledger.apply({ stats: { luck: 1 } })).toMatchObject({ ok: false, code: LEDGER_REFUSALS.unknownStat });
        expect(ledger.apply({ resources: { wood: 1 } })).toMatchObject({ ok: false, code: LEDGER_REFUSALS.unknownResource });
        expect(ledger.apply({ resources: { gold: 0.5 } })).toMatchObject({ ok: false, code: LEDGER_REFUSALS.notInteger });
        ledger.clear();
        expect(ledger.apply({ resources: { gold: 1 } })).toMatchObject({ ok: false, code: LEDGER_REFUSALS.notConfigured });
    });

    it('resetRun sets every value to 0 plus the totals given (unknown ids and negatives ignored)', () => {
        ledger.apply({ stats: { strength: 2 }, resources: { gold: 9, bread: 1 } });
        ledger.resetRun({ stats: { strength: 1 }, resources: { gold: 5, wood: 3, bread: -2 } }, { source: 'reset' });
        expect(ledger.snapshot()).toMatchObject({ stats: { strength: 1 }, resources: { gold: 5, bread: 0 }, lastSource: 'reset' });
    });
});

describe('the Resources panel model (driven by the sharing declarations)', () => {
    const registry = new Map([
        ['action_nodes', { id: 'action_nodes', label: 'Action Nodes', sharing: { mana: {}, items: {}, stats: {}, resources: {} } }],
        ['maze', { id: 'maze', label: 'Maze', sharing: { mana: {} } }],
        ['plain', { id: 'plain', label: 'Plain' }],
    ]);
    const reg = { get: (id) => registry.get(id) };

    it('one section per sharing substrate of the world; ledger rows only for its owner; boosts described', () => {
        const ledger = new ResourceLedger();
        ledger.configure({ owner: 'action_nodes', stats: STATS, resources: RESOURCES });
        ledger.apply({ resources: { gold: 3 } });
        ledger.setBoosts([{ item: 'Pocket Money', held: 1, gives: { stats: {}, resources: { gold: 5 }, mana: 0 } }]);
        const m = resourcesPanelModel({
            ledger: ledger.snapshot(), mana: { current: 50, max: 100 }, substrates: ['maze', 'action_nodes', 'plain', 'maze'], registry: reg,
        });
        expect(m.sections.map((s) => s.id)).toEqual(['action_nodes', 'maze']);
        const an = m.sections[0];
        expect(an.categories).toEqual(['mana', 'items', 'stats', 'resources']);
        expect(an.rows.find((r) => r.id === 'gold')).toMatchObject({ kind: 'resource', label: 'Gold', value: 3 });
        expect(an.rows.find((r) => r.kind === 'boost').value).toBe('1 held: Gold +5');
        expect(m.sections[1].rows).toEqual([]);
    });

    it('describeGives names stats and resources and states mana only when not 0', () => {
        expect(describeGives({ stats: { strength: 1 }, resources: {}, mana: 10 }, { stats: { strength: 'Strength' }, resources: {} }))
            .toBe('Strength +1, +10 mana');
        expect(describeGives({ mana: 0 })).toBe('nothing');
    });

    it('a world with no sharing substrate is empty', () => {
        expect(resourcesPanelModel({ ledger: new ResourceLedger().snapshot(), substrates: ['plain'], registry: reg }).empty).toBe(true);
    });
});
