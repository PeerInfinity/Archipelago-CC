import { describe, it, expect } from 'vitest';
import { createGameSession, itemsToAbilities } from './gameCore.js';
import { bounceStack } from './fixtures/bounceStack.js';

const makeLevel = (over = {}) => ({
    id: 'test',
    size: { width: 400, height: 1200 },
    platforms: [],
    springs: [],
    jetpacks: [],
    pickups: [],
    portals: [],
    ...over,
});

const runFrames = (session, n, input = null) => {
    const events = [];
    for (let i = 0; i < n; i++) events.push(...session.tick(input));
    return events;
};

describe('itemsToAbilities', () => {
    it('maps AP item names (strings or {name} objects) onto abilities', () => {
        const a = itemsToAbilities(['Right arrow', { name: 'Springs' }, 'Victory', 'Unknown']);
        expect(a.right).toBe(true);
        expect(a.springs).toBe(true);
        expect(a.left).toBe(false); // Victory/unknown grant no ability
    });
});

describe('createGameSession', () => {
    it('plays the bounce stack: pickups and exit fire once, in order', () => {
        const session = createGameSession(bounceStack);
        const events = runFrames(session, 500);
        const pickups = events.filter((e) => e.type === 'pickup');
        const exits = events.filter((e) => e.type === 'exit');
        expect(pickups).toEqual([{ type: 'pickup', id: 'loc_arrow' }]);
        expect(exits).toEqual([{ type: 'exit', portalId: 'exit_up', direction: 'up' }]);
        // repeated bounces on the same platforms don't re-fire
        expect(runFrames(session, 200).filter((e) => e.type !== 'fell')).toEqual([]);
    });

    it('seeded pickups never re-fire (region revisit)', () => {
        const session = createGameSession(bounceStack);
        session.seedCollected(['loc_arrow']);
        const events = runFrames(session, 500);
        expect(events.filter((e) => e.type === 'pickup')).toEqual([]);
        expect(session.collected.has('loc_arrow')).toBe(true);
        // the exit still fires — only pickups are AP-persistent
        expect(events.some((e) => e.type === 'exit')).toBe(true);
    });

    it('falls, respawns, and keeps collected pickups (AP checks persist)', () => {
        const level = makeLevel({
            platforms: [{ id: 'p0', x: 200, y: 1100, type: 'green' }],
            pickups: [{ id: 'loc', x: 200, y: 1080, on: 'p0' }],
            portals: [{ id: 'exit_up', x: 200, y: 1060, on: 'p0', target_region: null, direction: 'up' }],
        });
        const session = createGameSession(level);
        runFrames(session, 30); // land once: pickup + exit fire
        expect(session.collected.has('loc')).toBe(true);
        // hold right (ability granted) until we drift off and fall
        session.setItems(['Right arrow']);
        const events = runFrames(session, 600, { right: true });
        expect(events.some((e) => e.type === 'fell')).toBe(true);
        expect(session.collected.has('loc')).toBe(true);
        expect(session.state.fallen).toBe(false); // respawned
    });

    it('applies granted items mid-session: blue platform turns solid next frame', () => {
        const level = makeLevel({
            platforms: [
                { id: 'g', x: 200, y: 1100, type: 'green' },
                { id: 'b', x: 200, y: 980, type: 'blue' },
            ],
            pickups: [{ id: 'loc_b', x: 200, y: 960, on: 'b' }],
            portals: [{ id: 'exit_up', x: 200, y: 940, on: 'b', target_region: null, direction: 'up' }],
        });
        const session = createGameSession(level);
        // without Blue platforms: bounce on g forever, never reach b
        expect(runFrames(session, 300).filter((e) => e.type === 'pickup')).toEqual([]);
        // grant mid-session — no reset needed; suppression lifts immediately
        session.setItems(['Blue platforms']);
        const events = runFrames(session, 300);
        expect(events.some((e) => e.type === 'pickup' && e.id === 'loc_b')).toBe(true);
    });

    it('reset() returns to the entrance but keeps checks; exits can re-fire', () => {
        const session = createGameSession(bounceStack);
        runFrames(session, 500);
        expect(session.collected.size).toBe(1);
        session.reset();
        expect(session.state.y).toBeGreaterThan(1000); // back at the bottom
        const events = runFrames(session, 500);
        expect(events.filter((e) => e.type === 'pickup')).toEqual([]); // still checked
        expect(events.filter((e) => e.type === 'exit')).toHaveLength(1); // re-armed
    });
});
