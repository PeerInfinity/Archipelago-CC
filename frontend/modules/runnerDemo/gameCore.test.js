/**
 * Runner game session — event semantics over real physics: touch-edge
 * pickup/exit firing, once-per-session dedup, respawn reporting,
 * gate-state locking, collected seeding, item -> ability mapping.
 */

import { describe, it, expect } from 'vitest';
import {
    createGameSession, itemsToAbilities,
    ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME,
} from './gameCore.js';
import { flatRun, gapJump, oneWay, spikeRun } from './fixtures.js';

/** Tick the session until `pred(events, session)` or maxTicks. */
function runUntil(session, pred, { maxTicks = 2000, inputAt = () => ({}) } = {}) {
    const all = [];
    for (let t = 0; t < maxTicks; t++) {
        const events = session.tick(inputAt(t));
        all.push(...events);
        if (pred(events, session)) return { events: all, ticks: t };
    }
    return { events: all, ticks: maxTicks };
}

describe('itemsToAbilities', () => {
    it('maps AP item names (strings or {name}) to abilities', () => {
        const none = {
            doubleJump: false, blue: false, spring: false, glide: false, shield: false,
        };
        expect(itemsToAbilities([])).toEqual(none);
        expect(itemsToAbilities([ABILITY_ITEM_NAMES.doubleJump]).doubleJump).toBe(true);
        expect(itemsToAbilities([{ name: ABILITY_ITEM_NAMES.blue }]).blue).toBe(true);
        expect(itemsToAbilities([ABILITY_ITEM_NAMES.spring]).spring).toBe(true);
        expect(itemsToAbilities([ABILITY_ITEM_NAMES.glide]).glide).toBe(true);
        expect(itemsToAbilities([VICTORY_ITEM_NAME, 'Nonsense'])).toEqual(none);
    });
});

describe('touch-triggered goals', () => {
    it('auto-run collects the pickup then exits the portal, each once', () => {
        const session = createGameSession(flatRun);
        const { events } = runUntil(session,
            (evs) => evs.some((e) => e.type === 'exit'));
        const pickups = events.filter((e) => e.type === 'pickup');
        const exits = events.filter((e) => e.type === 'exit');
        expect(pickups).toEqual([{ type: 'pickup', id: 'pk_flat' }]);
        expect(exits).toEqual([{ type: 'exit', portalId: 'exit_main', arrow: 'right' }]);
        expect(events.findIndex((e) => e.type === 'pickup'))
            .toBeLessThan(events.findIndex((e) => e.type === 'exit'));
    });

    it('a touch held across ticks fires once; a portal exits once per session', () => {
        const session = createGameSession(flatRun);
        // run PAST the exit: the player pins against the right wall,
        // standing inside the portal box for many ticks
        runUntil(session, () => false, { maxTicks: 800 });
        // then reset and revisit: exitedPortals cleared -> fires again
        const collectedBefore = [...session.collected];
        session.reset();
        const { events } = runUntil(session,
            (evs) => evs.some((e) => e.type === 'exit'), { maxTicks: 800 });
        expect(events.filter((e) => e.type === 'exit')).toHaveLength(1);
        // collected pickups persist across reset (AP checks don't un-check)
        expect([...session.collected]).toEqual(collectedBefore);
        expect(events.filter((e) => e.type === 'pickup')).toHaveLength(0);
    });

    it('seedCollected suppresses re-offers on a fresh session', () => {
        const session = createGameSession(flatRun);
        session.seedCollected(['pk_flat']);
        const { events } = runUntil(session,
            (evs) => evs.some((e) => e.type === 'exit'));
        expect(events.filter((e) => e.type === 'pickup')).toHaveLength(0);
    });
});

describe('gate states', () => {
    it('locked goals fire locked events, do not trigger, and reopen', () => {
        const session = createGameSession(flatRun);
        session.setGateStates({ pickups: { pk_flat: false }, portals: { exit_main: false } });
        const { events } = runUntil(session,
            (evs) => evs.some((e) => e.type === 'lockedPortal'), { maxTicks: 800 });
        expect(events.filter((e) => e.type === 'lockedPickup'))
            .toEqual([{ type: 'lockedPickup', id: 'pk_flat' }]);
        expect(session.collected.size).toBe(0);
        expect(events.filter((e) => e.type === 'exit')).toHaveLength(0);
        // open the gates; a fresh touch-enter must fire the real events
        session.setGateStates({});
        session.reset();
        const { events: after } = runUntil(session,
            (evs) => evs.some((e) => e.type === 'exit'), { maxTicks: 800 });
        expect(after.some((e) => e.type === 'pickup')).toBe(true);
    });
});

describe('respawns', () => {
    it('reports hazard death and survives to the exit on a later attempt', () => {
        const session = createGameSession(spikeRun);
        // no input: the auto-run hits the spikes and respawns
        const { events } = runUntil(session,
            (evs) => evs.some((e) => e.type === 'respawned'), { maxTicks: 800 });
        expect(events.at(-1)).toEqual({ type: 'respawned', cause: 'hazard' });
        // hold jump periodically to bunny-hop the spikes
        const { events: attempt2 } = runUntil(session,
            (evs) => evs.some((e) => e.type === 'exit'),
            { maxTicks: 3000, inputAt: (t) => ({ jump: t % 30 < 20 }) });
        expect(attempt2.some((e) => e.type === 'exit')).toBe(true);
    });

    it('reports falls into the gap; a full-hold jump clears it', () => {
        const session = createGameSession(gapJump);
        const fell = runUntil(session,
            (evs) => evs.some((e) => e.type === 'respawned'), { maxTicks: 1500 });
        expect(fell.events.at(-1)).toEqual({ type: 'respawned', cause: 'fell' });
        // full-hold bunny hop crosses the 3.2-unit gap
        const { events } = runUntil(session,
            (evs) => evs.some((e) => e.type === 'exit'),
            { maxTicks: 5000, inputAt: (t) => ({ jump: t % 40 < 30 }) });
        expect(events.some((e) => e.type === 'exit')).toBe(true);
    });

    it('reset input reports a reset respawn', () => {
        const session = createGameSession(flatRun);
        session.tick({});
        const events = session.tick({ reset: true });
        expect(events).toEqual([{ type: 'respawned', cause: 'reset' }]);
    });
});

describe('abilities in the session', () => {
    it('items un-suppress gated platforms mid-session (per-tick re-assert)', () => {
        const session = createGameSession(oneWay);
        // without Blue Platforms the shelf is absent: the ledge run
        // falls to the floor and reaches the floor portal
        const noItem = runUntil(session,
            (evs) => evs.some((e) => e.type === 'exit'), { maxTicks: 1500 });
        expect(noItem.events.some((e) => e.type === 'pickup')).toBe(false);
        // grant the item on a fresh session: the shelf carries the run
        // across to its right-end pickup
        const session2 = createGameSession(oneWay);
        session2.setItems([ABILITY_ITEM_NAMES.blue]);
        const withItem = runUntil(session2,
            (evs) => evs.some((e) => e.type === 'pickup'), { maxTicks: 1500 });
        expect(withItem.events.filter((e) => e.type === 'pickup'))
            .toEqual([{ type: 'pickup', id: 'pk_shelf' }]);
    });

    it('holding drop falls through the shelf back to the floor route', () => {
        const session = createGameSession(oneWay);
        session.setItems([ABILITY_ITEM_NAMES.blue]);
        const { events } = runUntil(session,
            (evs) => evs.some((e) => e.type === 'exit'),
            { maxTicks: 1500, inputAt: () => ({ drop: true }) });
        // dropped through before the shelf pickup: exit reached, no pickup
        expect(events.some((e) => e.type === 'exit')).toBe(true);
        expect(events.some((e) => e.type === 'pickup')).toBe(false);
    });
});
