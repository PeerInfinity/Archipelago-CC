/**
 * bridges — the hand-derived stratum for the one tile that rewrites its
 * own solidity.
 *
 * Every value comes from `Scenery/Tile.as` and `Player.as:1098`, not from
 * running this port. The bridge is the last blocker on the R4 route that
 * a KEY PRESS opens, and it is the only terrain on the map whose type is a
 * function of render history rather than of position — so the fencepost
 * ("is the sixtieth frame the one that opens it, or the fifty-ninth?") is
 * the difference between a crossing and walking into a wall.
 */

import { describe, expect, it } from 'vitest';

import {
    BRIDGE_STATE,
    BRIDGE_TIMER_MAX,
    BridgeError,
    ON_SCREEN_RADIUS,
    assertOnScreenThroughout,
    bridgeHit,
    bridgeRender,
    framesToOpen,
    newBridge,
    withinOnScreenRadius,
} from './bridges.js';

describe('the bridge cycle (Tile.as:344-378)', () => {
    it('starts CLOSED at 60 and stays solid until something hits it', () => {
        expect(BRIDGE_TIMER_MAX).toBe(60);
        expect(BRIDGE_STATE).toBe(29);
        let b = newBridge();
        for (let i = 0; i < 500; i++) {
            const r = bridgeRender(b, true);
            expect(r.type).toBe('Solid');
            b = { timer: r.timer };
        }
        // ...and 500 renders later it is still exactly 60. The `>= 60` arm
        // does NOT decrement, which is what makes the timer a latch armed
        // by a press rather than a clock running from level load.
        expect(b.timer).toBe(60);
    });

    it('a Spear press tips it 60 -> 59 and the renders take over', () => {
        const b = bridgeHit(newBridge());
        expect(b.timer).toBe(59);
        expect(bridgeRender(b, true)).toEqual({ timer: 58, type: 'Solid' });
    });

    it('⚠ opens on the SIXTIETH on-screen frame, not the fifty-ninth', () => {
        // 59 decrements walk the timer to 0 while the type is STILL Solid;
        // the next render is the first to take the `<= 0` arm. Answering 59
        // would step the player onto a solid tile.
        expect(framesToOpen()).toBe(60);
        let b = bridgeHit(newBridge());
        let type = 'Solid';
        for (let i = 0; i < 59; i++) {
            const r = bridgeRender(b, true);
            b = { timer: r.timer };
            type = r.type;
        }
        expect(b.timer).toBe(0);
        expect(type).toBe('Solid');           // still shut after 59
        expect(bridgeRender(b, true).type).toBe('Tile');   // the 60th opens it
    });

    it('is a LATCH — nothing re-increments, so an open bridge stays open', () => {
        let b = bridgeHit(newBridge());
        for (let i = 0; i < 60; i++) b = { timer: bridgeRender(b, true).timer };
        for (let i = 0; i < 200; i++) {
            const r = bridgeRender(b, true);
            expect(r.type).toBe('Tile');
            b = { timer: r.timer };
        }
    });

    it('a second press on an open bridge goes NEGATIVE, and stays open', () => {
        // No guard in `genericHit`'s Tile arm. Transcribed rather than
        // clamped: a clamp would hide a double-press the executor should
        // be reporting.
        let b = bridgeHit(newBridge());
        for (let i = 0; i < 60; i++) b = { timer: bridgeRender(b, true).timer };
        b = bridgeHit(b);
        expect(b.timer).toBe(-1);
        expect(bridgeRender(b, true).type).toBe('Tile');
    });

    it('OFF SCREEN it is "Unused" — neither walkable nor solid', () => {
        // The `onScreen` early return is why `Tile.types[29]` is the string
        // "Unused": a bridge nobody has looked at has taken no type at all,
        // so it is in neither the walkable list nor the solid list.
        const b = newBridge();
        expect(bridgeRender(b, false)).toEqual({ timer: 60, type: 'Unused' });
        // And the timer does not move, so an opening PAUSES off screen
        // rather than continuing.
        const opening = bridgeHit(b);
        expect(bridgeRender(opening, false).timer).toBe(59);
        expect(bridgeRender(opening, true).timer).toBe(58);
    });

    it('a re-entered level rebuilds it CLOSED — the per-visit lifetime', () => {
        // `bridgeOpeningTimer` is an instance var with no persistence
        // backing, so `newBridge()` is what the next visit gets however
        // open it was left. This is the OPPOSITE lifetime from the clear a
        // shield lock earns, which `levelRun` banks across a rebuild.
        let b = bridgeHit(newBridge());
        for (let i = 0; i < 60; i++) b = { timer: bridgeRender(b, true).timer };
        expect(bridgeRender(b, true).type).toBe('Tile');
        expect(newBridge().timer).toBe(BRIDGE_TIMER_MAX);
        expect(bridgeRender(newBridge(), true).type).toBe('Solid');
    });
});

describe('the on-screen policy (§3.3)', () => {
    const centre = { x: 40, y: 152 };   // L63's bridge at tile (2,9)

    it('derives to 64 px, with slack over the computed 71/73', () => {
        expect(ON_SCREEN_RADIUS).toBe(64);
        expect(withinOnScreenRadius(40, 152, centre)).toBe(true);
        expect(withinOnScreenRadius(40 + 64, 152, centre)).toBe(true);
        expect(withinOnScreenRadius(40 + 65, 152, centre)).toBe(false);
        expect(withinOnScreenRadius(40, 152 - 65, centre)).toBe(false);
    });

    it('passes a leg that stays beside the bridge', () => {
        const positions = [];
        for (let t = 0; t < 70; t++) positions.push({ t, x: 40, y: 168 - t * 0.2 });
        expect(assertOnScreenThroughout(positions, centre)).toBe(70);
    });

    it('names the tick a leg strays on', () => {
        const positions = [];
        for (let t = 0; t < 70; t++) positions.push({ t, x: 40 + t * 2, y: 152 });
        expect(() => assertOnScreenThroughout(positions, centre))
            .toThrow(/left the bridge's on-screen radius at tick 33/);
    });

    it('REFUSES an empty window rather than passing it', () => {
        // An empty list satisfies every radius, which is the shape of a
        // check that cannot fail — the silent-watcher family.
        expect(() => assertOnScreenThroughout([], centre)).toThrow(BridgeError);
    });

    it('⚠ names a FREEZE inside the opening, because render is not gated', () => {
        // `Tile.render` runs on frozen frames, and this model counts TICKS:
        // a ceremony inside the opening window would open the bridge
        // earlier in the game than in the model. Bounded assumption, made
        // into a named failure.
        const positions = [];
        for (let t = 100; t < 170; t++) positions.push({ t, x: 40, y: 168 });
        expect(() => assertOnScreenThroughout(positions, centre, { frozenTicks: [130] }))
            .toThrow(/FROZEN on tick\(s\) 130/);
        // A freeze OUTSIDE the window is not this check's business.
        expect(assertOnScreenThroughout(positions, centre, { frozenTicks: [50, 900] }))
            .toBe(70);
    });
});
