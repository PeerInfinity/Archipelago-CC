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

    it('locked goals do not trigger; opening the gate mid-session arms them', () => {
        const level = makeLevel({
            platforms: [{ id: 'p0', x: 200, y: 1100, type: 'green' }],
            pickups: [{ id: 'loc', x: 200, y: 1080, on: 'p0' }],
            portals: [{ id: 'exit_up', x: 200, y: 1060, on: 'p0', target_region: null, direction: 'up' }],
        });
        const session = createGameSession(level);
        session.setGateStates({
            portals: { exit_up: false },
            pickups: { loc: false },
        });
        const lockedEvents = runFrames(session, 300);
        // landings fire locked events instead of pickup/exit...
        expect(lockedEvents.some((e) => e.type === 'lockedPickup' && e.id === 'loc')).toBe(true);
        expect(lockedEvents.some((e) => e.type === 'lockedPortal' && e.portalId === 'exit_up')).toBe(true);
        expect(lockedEvents.filter((e) => e.type === 'pickup' || e.type === 'exit')).toEqual([]);
        // ...and nothing is consumed: the exit dedupe stays un-armed
        expect(session.collected.size).toBe(0);

        // the host's next push opens both gates — the next landing triggers
        session.setGateStates({ portals: { exit_up: true }, pickups: { loc: true } });
        const events = runFrames(session, 300);
        expect(events.some((e) => e.type === 'pickup' && e.id === 'loc')).toBe(true);
        expect(events.filter((e) => e.type === 'exit')).toHaveLength(1);
    });

    it('gate states default open: ids absent from the maps never lock', () => {
        const session = createGameSession(bounceStack);
        session.setGateStates({ portals: { some_other_portal: false }, pickups: {} });
        const events = runFrames(session, 500);
        expect(events.some((e) => e.type === 'pickup' && e.id === 'loc_arrow')).toBe(true);
        expect(events.some((e) => e.type === 'exit' && e.portalId === 'exit_up')).toBe(true);
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

describe('teleport-to-start', () => {
    // Entrance at the bottom + a teleport host one plain step above, both at
    // the spawn column so a no-input player climbs straight onto the host.
    const tpLevel = () => makeLevel({
        size: { width: 240, height: 280 },
        platforms: [
            { id: 'entrance', x: 120, y: 180, type: 'green' },
            { id: 'tp_host', x: 120, y: 60, type: 'green' },
        ],
        teleports: [{ id: 'tp', x: 120, y: 40, on: 'tp_host' }],
    });

    it('landing on a teleport host emits fell(teleport:true) and respawns', () => {
        const session = createGameSession(tpLevel());
        let teleported = false;
        for (let i = 0; i < 300 && !teleported; i++) {
            for (const ev of session.tick(null)) {
                if (ev.type === 'fell' && ev.teleport) teleported = true;
            }
        }
        expect(teleported).toBe(true);
        expect(session.state.x).toBeCloseTo(120, 0); // back at the spawn column
        expect(session.state.fallen).toBe(false);
    });
});

// The over-the-top wraparound was REPLACED by the teleport-to-start object
// (see the 'teleport-to-start' suite above + the braid generator's top-row
// teleport in braidGenerator.slow.test.js). gameCore no longer arms any
// over-the-top return — rising above the top row does nothing on its own.
describe('no over-the-top return (replaced by teleport-to-start)', () => {
    // A lone capstone hosting the only portal. With the portal LOCKED, a
    // no-input player parks on it (re-firing lockedPortal); rising back above
    // the row must NOT loop them home — only a teleport host does that now.
    const stacked = () => makeLevel({
        size: { width: 240, height: 280 },
        platforms: [
            { id: 'entrance', x: 120, y: 180, type: 'green' },
            { id: 'cap', x: 120, y: 60, type: 'green' },
        ],
        portals: [{ id: 'topExit', x: 120, y: 40, on: 'cap', direction: 'up' }],
    });

    it('a locked top portal does NOT bounce the player over the top', () => {
        const session = createGameSession(stacked());
        session.setGateStates({ portals: { topExit: false } }); // lock it
        let locked = false, fell = false;
        for (let i = 0; i < 600; i++) {
            for (const ev of session.tick(null)) {
                if (ev.type === 'lockedPortal') locked = true;
                if (ev.type === 'fell') fell = true;
            }
        }
        expect(locked).toBe(true); // parks on the locked capstone, re-firing
        expect(fell).toBe(false);  // no over-the-top loop, no teleport host
    });

    it('an open top portal still exits normally', () => {
        const session = createGameSession(stacked()); // portals default OPEN
        let exited = false;
        for (let i = 0; i < 600 && !exited; i++) {
            for (const ev of session.tick(null)) if (ev.type === 'exit') exited = true;
        }
        expect(exited).toBe(true);
    });
});
