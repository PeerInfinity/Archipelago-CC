import { describe, it, expect } from 'vitest';
import { createBotDriver } from './botDriver.js';
import { createGameSession } from './gameCore.js';
import {
    flatRun, gapJump, doubleGap, stepStone, springGap, springShelf, djShelf,
} from './fixtures.js';

/**
 * Drive the real game session with the driver's per-frame inputs —
 * the same call order game/main.js uses (nextInput sees the PREVIOUS
 * tick's state, so a landing/respawn is observed exactly once, the
 * frame after it happened). Pass an existing `session` to continue a
 * run (gate flips, target switches) instead of starting fresh.
 */
function makeHarness(level, { items = [], constants = undefined } = {}) {
    const session = createGameSession(level, { constants });
    session.setItems(items);
    const helpers = {
        isPortalOpen: (id) => session.gateStates.portals[id] !== false,
        isPickupOpen: (id) => session.gateStates.pickups[id] !== false,
    };
    const events = [];
    const counts = { resets: 0, deaths: 0 };
    const run = (driver, { maxFrames = 4000, until = () => false } = {}) => {
        const inputs = [];
        for (let f = 0; f < maxFrames; f++) {
            const bot = driver.nextInput(session.state, level, session.abilities, helpers);
            inputs.push(bot);
            for (const ev of session.tick({
                jump: !!bot?.jump, drop: !!bot?.drop, reset: !!bot?.reset,
            })) {
                events.push(ev);
                if (ev.type === 'respawned') {
                    if (ev.cause === 'reset') counts.resets += 1;
                    else counts.deaths += 1;
                }
            }
            if (until({ events, counts })) {
                return { inputs, frames: f + 1, done: true };
            }
        }
        return { inputs, frames: maxFrames, done: false };
    };
    const sawEvent = (type, id) => events.some((ev) => ev.type === type
        && (id === undefined || ev.id === id || ev.portalId === id));
    return { session, events, counts, run, sawEvent };
}

const untilEvent = (h, type, id) => () => h.sawEvent(type, id);

describe('botDriver — completes fixture levels (pickup then portal)', () => {
    it('flatRun: both goals with ZERO input (auto-play is the degenerate plan)', () => {
        const h = makeHarness(flatRun);
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'pk_flat' });
        const a = h.run(driver, { until: untilEvent(h, 'pickup', 'pk_flat') });
        expect(a.done).toBe(true);
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        const b = h.run(driver, { until: untilEvent(h, 'exit', 'exit_main') });
        expect(b.done).toBe(true);
        // Flat flush strip: auto-run alone carries every leg.
        expect([...a.inputs, ...b.inputs].every((i) => i === null)).toBe(true);
        expect(h.counts.deaths).toBe(0);
    });

    it('gapJump: jumps the gap to the portal without dying', () => {
        const h = makeHarness(gapJump);
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'pk_edge' });
        expect(h.run(driver, { until: untilEvent(h, 'pickup', 'pk_edge') }).done).toBe(true);
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        const r = h.run(driver, { until: untilEvent(h, 'exit', 'exit_main') });
        expect(r.done).toBe(true);
        expect(r.inputs.some((i) => i?.jump)).toBe(true); // a real synthesized jump
        expect(h.counts.deaths).toBe(0);
        expect(h.counts.resets).toBe(0);
    });

    it('doubleGap: crosses with an air-jump policy under Double Jump', () => {
        const h = makeHarness(doubleGap, { items: ['Double Jump'] });
        const driver = createBotDriver();
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        const r = h.run(driver, { until: untilEvent(h, 'exit', 'exit_main') });
        expect(r.done).toBe(true);
        expect(h.counts.deaths).toBe(0);
    });

    it('springGap: rides the spring bounce across under Springs', () => {
        const h = makeHarness(springGap, { items: ['Springs'] });
        const driver = createBotDriver();
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        const r = h.run(driver, { until: untilEvent(h, 'exit', 'exit_main') });
        expect(r.done).toBe(true);
        expect(h.counts.deaths).toBe(0);
    });

    it('stepStone: chains two jumps across the gated stepping stone', () => {
        const h = makeHarness(stepStone, { items: ['Blue Platforms'] });
        const driver = createBotDriver();
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        const r = h.run(driver, { until: untilEvent(h, 'exit', 'exit_main') });
        expect(r.done).toBe(true);
        expect(h.counts.deaths).toBe(0);
    });

    it('springShelf: collects the shelf pickup off the bounce, then falls out to the exit', () => {
        const h = makeHarness(springShelf, { items: ['Springs'] });
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'pk_shelfTop' });
        const a = h.run(driver, { until: untilEvent(h, 'pickup', 'pk_shelfTop') });
        expect(a.done).toBe(true);
        // continue to the exit — the fall-off leg back to the trunk
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        const b = h.run(driver, { until: untilEvent(h, 'exit', 'exit_main') });
        expect(b.done).toBe(true);
        expect(h.counts.deaths).toBe(0); // the saw never touches the route
    });

    it('djShelf: catches the shelf with a dj arc for the pickup, then exits', () => {
        const h = makeHarness(djShelf, { items: ['Double Jump'] });
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'pk_shelfTop' });
        const a = h.run(driver, { until: untilEvent(h, 'pickup', 'pk_shelfTop') });
        expect(a.done).toBe(true);
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        const b = h.run(driver, { until: untilEvent(h, 'exit', 'exit_main') });
        expect(b.done).toBe(true);
        expect(h.counts.deaths).toBe(0);
    });

    it('springShelf without Springs: shelf pickup is unroutable — stuck, no reset-thrash', () => {
        const h = makeHarness(springShelf);
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'pk_shelfTop' });
        h.run(driver, { maxFrames: 1500 });
        expect(h.counts.resets).toBe(0);
        expect(driver.getStatus().stuck).toBe(true);
        expect(h.sawEvent('pickup', 'pk_shelfTop')).toBe(false);
    });
});

describe('botDriver — reset recovery (goal behind the player)', () => {
    it('overshoots to the far floor, then resets home for the missed pickup', () => {
        const h = makeHarness(gapJump);
        const driver = createBotDriver();
        // Phase 1: cross the gap (pk_edge collected in floorA's wake en
        // route — the wake invariant; the RESET test needs a target
        // whose goal box is now behind, and the portal drive leaves the
        // player far right on floorB).
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        expect(h.run(driver, { until: untilEvent(h, 'exit', 'exit_main') }).done).toBe(true);
        expect(h.counts.resets).toBe(0);
        // Phase 2: target a fresh pickup on floorA, BEHIND the player.
        // Auto-run can never go left — the only route is the implicit
        // reset edge (one respawn), then floorA's wake collects it.
        h.session.setGateStates({}); // no-op; keeps gate maps explicit
        const fresh = { ...gapJump.pickups[0], id: 'pk_edge' };
        expect(fresh.on).toBe('floorA');
        // pk_edge was already collected in phase 1 (wake) — clear it so
        // the 'pickup' event can fire again on the re-run.
        h.session.collected.delete('pk_edge');
        driver.setTarget({ kind: 'pickup', id: 'pk_edge' });
        const r = h.run(driver, { until: untilEvent(h, 'pickup', 'pk_edge') });
        expect(r.done).toBe(true);
        expect(h.counts.resets).toBe(1);   // exactly one respawn spent
        expect(h.counts.deaths).toBe(0);
    });

    it('does NOT thrash the reset key when the goal is unreachable outright', () => {
        // doubleGap without Double Jump: no route from ANYWHERE, the
        // entrance included — the driver must go stuck (no input), not
        // burn reset respawns hoping something changes.
        const h = makeHarness(doubleGap);
        const driver = createBotDriver();
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        h.run(driver, { maxFrames: 1500 });
        expect(h.counts.resets).toBe(0);
        expect(driver.getStatus().stuck).toBe(true);
        expect(h.sawEvent('exit', 'exit_main')).toBe(false);
    });
});

describe('botDriver — gated-and-locked target parks without dying', () => {
    it('drives to the locked portal host, parks, and arms on unlock', () => {
        const h = makeHarness(gapJump);
        h.session.setGateStates({ portals: { exit_main: false } });
        const driver = createBotDriver();
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        // Drive: crosses the gap (a real jump), touches the locked box
        // once (lockedPortal proves arrival), pins on the right wall.
        const arrive = h.run(driver, { until: untilEvent(h, 'lockedPortal', 'exit_main') });
        expect(arrive.done).toBe(true);
        // Park: a long idle stretch with the gate still closed — no
        // deaths, no resets, no exit (the "without dying needlessly"
        // gate; the wall-pinned park is input-free and harmless).
        h.run(driver, { maxFrames: 800 });
        expect(h.counts.deaths).toBe(0);
        expect(h.counts.resets).toBe(0);
        expect(h.sawEvent('exit', 'exit_main')).toBe(false);
        expect(driver.getStatus().parked).toBe(true);
        // Unlock: the host pushes fresh gate states; the driver's one
        // re-enter jump re-fires the touch-ENTER and the portal arms.
        h.session.setGateStates({ portals: { exit_main: true } });
        const opened = h.run(driver, { until: untilEvent(h, 'exit', 'exit_main') });
        expect(opened.done).toBe(true);
        expect(h.counts.deaths).toBe(0);
    });
});

describe('botDriver — blocked-host avoidance (open portal on the mandatory path)', () => {
    // The gen_z0 shape from the phase-7 smoke: the only route to the
    // final floor crosses a branch tip whose OPEN portal box sits in
    // the tip's wake — avoidance means landing shallow on the tip and
    // jumping off BEFORE the box, not route choice (there is no other
    // route). Geometry sized for celeste defaults (full-hold running
    // jump ~4.9; gaps well past single-jump reach floorA→floorC).
    const tipCrossing = {
        id: 'tipCrossing',
        size: { width: 36, height: 16 },
        platforms: [
            { id: 'floorA', x: 0, y: 0, w: 12, h: 1, type: 'ground' },
            { id: 'tipB', x: 15.2, y: 0, w: 6, h: 1, type: 'ground' },
            { id: 'floorC', x: 24, y: 0, w: 11.5, h: 1, type: 'ground' },
        ],
        hazards: [],
        pickups: [],
        portals: [
            { id: 'exit_br', on: 'tipB', x: 20.8, y: 1.6, arrow: 'down', exitName: null },
            { id: 'exit_main', on: 'floorC', x: 34.9, y: 1.6, arrow: 'right', exitName: null },
        ],
        spawn: { x: 1, y: 1 },
    };

    it('crosses the tip without touching its open portal box', () => {
        const h = makeHarness(tipCrossing);
        const driver = createBotDriver();
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        const r = h.run(driver, { until: untilEvent(h, 'exit', 'exit_main') });
        expect(r.done).toBe(true);
        // The open non-target portal must never fire — the bot jumped
        // clear of its box on the way through.
        expect(h.sawEvent('exit', 'exit_br')).toBe(false);
        expect(h.sawEvent('lockedPortal', 'exit_br')).toBe(false);
        expect(h.counts.deaths).toBe(0);
    });
});

describe('botDriver — edge cases', () => {
    it('emits no input for a goal that is not in this level', () => {
        const h = makeHarness(gapJump);
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'not_here' });
        const r = h.run(driver, { maxFrames: 300 });
        expect(r.inputs.every((i) => i === null)).toBe(true);
        expect(driver.getStatus().nextPlatform).toBeNull();
    });

    it('is idle with no target and reports inactive status', () => {
        const h = makeHarness(flatRun);
        const driver = createBotDriver();
        const r = h.run(driver, { maxFrames: 60 });
        expect(r.inputs.every((i) => i === null)).toBe(true);
        expect(driver.getStatus().active).toBe(false);
    });

    it('clearTarget stops planning', () => {
        const h = makeHarness(gapJump);
        const driver = createBotDriver();
        driver.setTarget({ kind: 'portal', id: 'exit_main' });
        driver.clearTarget();
        expect(driver.getStatus().active).toBe(false);
        const r = h.run(driver, { maxFrames: 60 });
        expect(r.inputs.every((i) => i === null)).toBe(true);
    });
});
