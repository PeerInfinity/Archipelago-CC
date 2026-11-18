/**
 * ⛓ AN-1b (⚖ D6, Robert 2026-11-16T19:59:48Z: "I don't want explore actions to be available in ActionNodes"):
 * a substrate's `queueActions` is ENFORCED only where its entry opts in with `strictQueueActions`. The rule, the
 * queue-time guard in gameState, and the pin that no other substrate changes.
 */
import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACTION_NOT_OFFERED, strictQueueRefusal } from './strictQueueActions.js';
import { GameState } from '../gameState/state.js';
import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const ENTRIES = substrateRegistry.getAll();

describe('strictQueueRefusal', () => {
    const strict = { strictQueueActions: true, queueActions: ['regionMove', 'act'] };
    it('refuses, by name, a custom action the strict list does not hold', () => {
        const r = strictQueueRefusal(strict, 'explore', { substrateLabel: 'Action Nodes', region: 'train' });
        expect(r).toMatchObject({ ok: false, code: ACTION_NOT_OFFERED });
        expect(r.reason).toContain("no 'explore' action");
        expect(r.reason).toContain('Action Nodes (train)');
        expect(r.reason).toContain('regionMove, act');
    });
    it('lets a listed one through', () => {
        expect(strictQueueRefusal(strict, 'act')).toBeNull();
    });
    it('without the opt-in the list is NOT enforced (as before), and no entry refuses nothing', () => {
        expect(strictQueueRefusal({ queueActions: ['regionMove'] }, 'explore')).toBeNull();
        expect(strictQueueRefusal({ strictQueueActions: false, queueActions: [] }, 'explore')).toBeNull();
        expect(strictQueueRefusal(null, 'explore')).toBeNull();
    });
});

describe('⛔ PIN: only ActionNodes opts in — every other substrate queues exactly as before', () => {
    it('the population is the registry\'s, and it is not vacuous', () => {
        expect(ENTRIES.length).toBeGreaterThan(6);
    });
    it('exactly one entry declares strictQueueActions, and it is action_nodes, whose list holds no explore', () => {
        const strict = ENTRIES.filter((e) => e.loopSupport?.strictQueueActions === true).map((e) => e.id);
        expect(strict).toEqual(['action_nodes']);
        expect(substrateRegistry.get('action_nodes').loopSupport.queueActions).not.toContain('explore');
    });
    it.each(ENTRIES.filter((e) => e.id !== 'action_nodes').map((e) => [e.id, e]))('%s: an explore is never refused by the rule', (_id, e) => {
        expect(strictQueueRefusal(e.loopSupport ?? null, 'explore')).toBeNull();
    });
});

describe('gameState: the queue-time guard', () => {
    const bus = { publish() {}, subscribe: () => () => {} };
    const fresh = () => {
        const gs = new GameState(bus);
        gs.setStartRegions?.(['Menu']);
        gs.updatePath('A', 'Menu -> A', 'Menu');
        return gs;
    };
    it('with no guard every custom action is appended, as before', () => {
        const gs = fresh();
        expect(gs.addCustomAction('explore', { regionName: 'A' })).toBe(true);
        expect(gs.path.at(-1)).toMatchObject({ type: 'customAction', actionName: 'explore', sourceRegion: 'A' });
        expect(gs.lastQueueRefusal).toBeNull();
    });
    it('a guard refusal appends nothing, returns false and records the refusal (add and insert)', () => {
        const gs = fresh();
        gs.setCustomActionGuard((name, region) => strictQueueRefusal(
            region === 'A' ? { strictQueueActions: true, queueActions: ['act'] } : null, name, { region }));
        const before = gs.path.length;
        expect(gs.addCustomAction('explore', { regionName: 'A' })).toBe(false);
        expect(gs.insertCustomActionAt('explore', 'A', 1, {})).toBe(false);
        expect(gs.path.length).toBe(before);
        expect(gs.lastQueueRefusal).toMatchObject({ actionName: 'explore', region: 'A', code: ACTION_NOT_OFFERED });
        expect(gs.addCustomAction('act', { regionName: 'A' })).toBe(true);
    });
    it('a guard that throws refuses, naming the throw', () => {
        const gs = fresh();
        gs.setCustomActionGuard(() => { throw new Error('boom'); });
        expect(gs.addCustomAction('explore', { regionName: 'A' })).toBe(false);
        expect(gs.lastQueueRefusal).toMatchObject({ code: 'guard-threw' });
        expect(gs.lastQueueRefusal.reason).toContain('boom');
    });
});
