/**
 * seedling-js-inventory-menu — the JS page core HOLDS the room while the V menu is up (fidelity-15's W0 ACK).
 *
 * The keys arrive as the page sends them (one held set per frame); an edge is a release between two frames.
 * `inventoryMenu.test.js` pins the menu's own transcription; these rows pin the core's half: the opening frame is
 * live, every frame after it through the closing one is held (no tape tick), the hold is handed to the run on
 * the close, and the fold carries the X write as an `equips` row.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const GAME_CONFIG = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties });
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const flag = (property) => ({ class: 'main', property, value: true });
const teleportTo = (level, x, y) => ({ invocation: 'new_instance', className: 'Game', args: [level, x, y] });
const K = (...keys) => new Set(keys);

/** L86 (a quiet room) holding Fire then the sword: slots [1, 0], so `firstUse`. */
function armed() {
    const rt = createJsRuntime();
    expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, teleportTo(86, 56, 56)]);
    rt.tick();
    rt.queueItems([flag('hasFire')]);
    rt.tick();
    rt.queueItems([flag('hasSword')]);
    rt.tick();
    for (let k = 0; k < 3; k += 1) rt.tick(K());
    expect(rt.run.inventorySlots).toEqual([1, 0]);
    expect(rt.run.inventoryRefusal).toBeNull();
    return rt;
}

describe('the core holds the room while the V menu is up', () => {
    it('V open → Down → X equips → V close: zero tape ticks between open and close, the hold spent on close', () => {
        const rt = armed();
        rt.tick(K('inventory'));
        const opening = rt.tick(K());                     // the release: a LIVE frame, the menu opens in its tail
        expect(opening.stepped).toBe(true);
        expect(rt.inventoryMenu.open).toBe(true);
        const t = rt.run.ticksCompleted;
        const perTick = rt.session.perTick.length;
        for (const keys of [K('down'), K(), K('primary'), K(), K('inventory'), K()]) {
            const out = rt.tick(keys);
            expect(out.stepped).toBe(false);
        }
        expect(rt.inventoryMenu.open).toBe(false);
        expect(rt.run.ticksCompleted).toBe(t);              // the tape never advanced
        expect(rt.session.perTick.length).toBe(perTick);
        expect(rt.run.primary).toBe(1);                      // slot 1 = the sword
        expect(rt.run.inventoryMenuEquips).toEqual([{ t, slot: 1 }]);
        expect(rt.run.inventoryHolds).toEqual([{ t, level: 86, frames: 6 }]);
        expect(rt.tick(K()).stepped).toBe(true);            // and the next frame is live again
        expect(rt.session.fold().equips).toEqual([{ t, slot: 1 }]);
    });

    it('V and I never reach the tape; an X held across the close is masked until released', () => {
        const rt = armed();
        rt.tick(K('inventory2'));
        rt.tick(K());
        expect(rt.inventoryMenu.open).toBe(true);
        rt.tick(K('down'));                                  // select the sword (slot 1) …
        rt.tick(K());
        rt.tick(K('primary'));
        rt.tick(K());                                        // … X released: equipped
        rt.tick(K('primary'));                               // X goes down inside the hold
        rt.tick(K('primary', 'inventory'));
        rt.tick(K('primary'));                               // V released: closed, X still down
        expect(rt.inventoryMenu.open).toBe(false);
        const presses = rt.run.slashPresses.length;
        rt.tick(K('primary'));
        expect(rt.run.slashPresses.length).toBe(presses);    // no swing: its edge fired on a dead frame
        rt.tick(K());
        rt.tick(K('primary'));
        expect(rt.run.slashPresses.length).toBe(presses + 1); // a fresh press swings
        expect(rt.session.perTick.every((s) => !s.has('inventory') && !s.has('inventory2'))).toBe(true);
    });

    it('a room where the hold cannot step refuses to open, by name, and stays live', () => {
        const rt = armed();
        rt.queueItems([teleportTo(71, 56, 56)]);              // L71: SpinningAxes
        rt.tick();
        expect(rt.run.inventoryRefusal).toMatch(/spinningAxes/);
        rt.tick(K('inventory'));
        const out = rt.tick(K());
        expect(out.stepped).toBe(true);
        expect(rt.inventoryMenu.open).toBe(false);
        expect(rt.events.some((e) => e.type === 'inventory' && /spinningAxes/.test(e.refused ?? ''))).toBe(true);
    });

    it('a C write is refused by the fold, naming the queued `secondaries` directive', () => {
        const rt = armed();
        rt.tick(K('inventory'));
        rt.tick(K());
        rt.tick(K('secondary'));
        rt.tick(K());
        rt.tick(K('inventory'));
        rt.tick(K());
        expect(rt.run.secondary).toBe(0);
        expect(rt.run.secondariesFired).toHaveLength(1);
        expect(() => rt.session.fold()).toThrow(/secondaries: \[\{t, slot\}\]/);
    });
});
