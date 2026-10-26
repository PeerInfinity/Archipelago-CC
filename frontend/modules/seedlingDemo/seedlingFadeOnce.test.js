/**
 * ⛓ GRAPHICS G7 — ONE FADE PER `new Game`. The user saw the level start "fade in from black twice" on the JS
 * runtime (2026-10-25). The cause (§G7's capture): the host delivers its items as the arrival's fade ends, each
 * item flag REBOOTS the JS run in place (`jsRuntimeCore.rebootInPlace`, a new run object), and the effect skin met
 * that run as a fresh one and queued its build's 20-frame fade again. In the game an item flag is a `Main.*`
 * static write: no new world, no `blackCover = 1`.
 *
 * This drives the REAL runtime through the page's own clock calls, in the page's order (`jsRuntimePage.advance`:
 * `fadeSlot` at the top of a slot, then `tick`, then `carryThroughReboot` + `stepEffectSkin`), and reads the black
 * cover each slot would paint (`screenOps`' rule). The pin: the cover never rises except at a `new Game`, and each
 * `new Game` gets exactly one ramp from 1 down to 0. The mutant (`inPlace` never true) is the pre-G7 page.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime, IN_PLACE_REBOOT_WHY } from './jsRuntimeCore.js';
import { carryThroughReboot, effectSkinView, fadeSlot, stepEffectSkin } from './seedlingEffectSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const recordOf = (level) => MAP.levels.find((l) => l.level === level) ?? null;

/** `jsRuntimePage.lastBootInPlace`, over the runtime's events. */
const lastBootInPlace = (rt) => {
    const ev = rt.events;
    for (let i = ev.length - 1; i >= 0; i -= 1) if (ev[i].type === 'boot') return ev[i].why === IN_PLACE_REBOOT_WHY;
    return false;
};
/** The black cover a paint shows (`seedlingEffectSkin.screenOps`): a queued fade not yet shown is 1. */
const coverOf = (skin) => (skin?.fadeQueue?.length && !skin.cover ? 1 : (skin?.cover ?? 0));

/**
 * The page's clock, one slot per call, with the host's verbs queued at the slots `script` names. `inPlace` is the
 * page's predicate (the mutant swaps it). Returns each slot's `{ slot, cover, held, level, boots }`.
 */
function play(script, slots, { inPlace = lastBootInPlace } = {}) {
    const rt = createJsRuntime({ log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.queueItems([{ class: 'game', property: 'menu', value: false }]);
    rt.setVanilla(MAP);   // `Main.as:51`: the game's own first frame, `new Game(0, 80, 128)`
    const view = () => effectSkinView(rt.run, { record: recordOf(rt.run.level) });
    let skin = null;
    const rows = [];
    for (let slot = 0; slot < slots; slot += 1) {
        if (script[slot]) rt.queueItems(script[slot]);
        const s = fadeSlot(skin, view(), { run: rt.run, fresh: rt.run.ticksCompleted === 0, inPlace: () => inPlace(rt) });
        skin = s.skin;
        if (!s.held) {
            rt.tick(new Set());
            const fv = view();
            skin = stepEffectSkin(carryThroughReboot(skin, fv, { run: rt.run, inPlace: () => inPlace(rt) }), fv, rt.ticks);
        }
        rows.push({ slot, cover: +coverOf(skin).toFixed(4), held: s.held, level: rt.run.level,
            boots: rt.events.filter((e) => e.type === 'boot').map((e) => e.why) });
    }
    return rows;
}

/** The slots where the cover RISES (a fade starting), and whether every stretch between them only falls. */
function ramps(rows) {
    const starts = [];
    let prev = 0;
    for (const r of rows) {
        if (r.cover > prev) starts.push(r.slot);
        prev = r.cover;
    }
    return starts;
}

// The level start the user sees: the game's own first frame (L0), then the host's arrival teleport, then its
// item deliveries — one queued DURING the arrival's fade (the run does not tick while a dead frame is held, so it
// is drained on the first live tick after the fade), one well after it.
const SCRIPT = {
    40: [{ invocation: 'new_instance', className: 'Game', args: [16, 32, 50] }],
    48: [{ class: 'Main', property: 'hasShield', value: true }],
    120: [{ class: 'Main', property: 'hasSword', value: true }],
};
const SLOTS = 180;

describe('G7 — one fade per new Game', () => {
    it('the level start: one ramp per `new Game` (L0\'s first frame, the arrival) and none at a reboot in place', () => {
        const rows = play(SCRIPT, SLOTS);
        const boots = rows.at(-1).boots;
        // not vacuous: the runtime really rebooted twice in place, and once more after the arrival's fade
        expect(boots).toEqual(['the game\'s own first frame (Main.as:51)', 'teleport (new Game)', IN_PLACE_REBOOT_WHY, IN_PLACE_REBOOT_WHY]);
        const firstReboot = rows.findIndex((r) => r.boots.length === 3);
        const arrival = rows.findIndex((r) => r.boots.length === 2);
        expect(rows.slice(arrival, firstReboot).some((r) => r.held), 'the delivery waited out the arrival\'s fade').toBe(true);
        // one ramp at the first frame and one at the arrival; nothing at either reboot
        expect(ramps(rows)).toEqual([0, arrival]);
        // each ramp falls monotonically from 1 to 0, and the cover stays 0 after it
        for (const [from, to] of [[0, arrival], [arrival, SLOTS]]) {
            const covers = rows.slice(from, to).map((r) => r.cover);
            // 1 when the step that met the new Game paints first (the arrival); 0.95 when a hold does (the boot's first slot)
            expect(covers[0]).toBeGreaterThanOrEqual(0.95);
            for (let i = 1; i < covers.length; i += 1) expect(covers[i], `slot ${from + i}`).toBeLessThanOrEqual(covers[i - 1]);
            expect(covers.at(-1)).toBe(0);
        }
        // the arrival's fade is the game's: 20 dead frames, 1 − 0.05k (`Bot.pinDeadFrames`)
        const fade = rows.slice(arrival).filter((r) => r.held).map((r) => r.cover);
        expect(fade).toEqual(Array.from({ length: 20 }, (_, k) => +Math.max(1 - 0.05 * (k + 1), 0).toFixed(4)));
    });

    it('MUTANT — the pre-G7 page (no reboot is in place): the reboots fade from black again, and the pin goes red', () => {
        const rows = play(SCRIPT, SLOTS, { inPlace: () => false });
        const arrival = rows.findIndex((r) => r.boots.length === 2);
        const r = ramps(rows);
        expect(r.length).toBe(4);
        expect(r.slice(0, 2)).toEqual([0, arrival]);
    });
});

// ⛓ GAME SPEED (slice `seedling-js-game-speed`) — the same level start on the page's REAL clock
// (`jsRuntimeClock`: the accumulator and the one-slot-per-turn pump) at 1× and 2×, on a 60 Hz display. Each slot
// is `play`'s; the fades are dead-frame slots, so at 2× the same covers are shown in half the wall-clock time.
async function playClocked(script, slots, speed) {
    const { createSlotClock, createSlotPump } = await import('./jsRuntimeClock.js');
    const rt = createJsRuntime({ log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.queueItems([{ class: 'game', property: 'menu', value: false }]);
    rt.setVanilla(MAP);
    const view = () => effectSkinView(rt.run, { record: recordOf(rt.run.level) });
    let skin = null;
    let now = 0;
    const rows = [];
    const slot = () => {
        const n = rows.length;
        if (script[n]) rt.queueItems(script[n]);
        const s = fadeSlot(skin, view(), { run: rt.run, fresh: rt.run.ticksCompleted === 0, inPlace: () => lastBootInPlace(rt) });
        skin = s.skin;
        if (!s.held) {
            rt.tick(new Set());
            const fv = view();
            skin = stepEffectSkin(carryThroughReboot(skin, fv, { run: rt.run, inPlace: () => lastBootInPlace(rt) }), fv, rt.ticks);
        }
        rows.push({ slot: n, cover: +coverOf(skin).toFixed(4), held: s.held, level: rt.run.level,
            boots: rt.events.filter((e) => e.type === 'boot').map((e) => e.why), at: now });
    };
    const tasks = [];
    const pump = createSlotPump({ clock: createSlotClock({ speed }), runSlot: slot, postTask: (fn) => tasks.push(fn) });
    for (let f = 0; rows.length < slots; f += 1) {
        now = f * (1000 / 60);
        pump.frame(now);
        while (tasks.length) tasks.shift()();
    }
    return rows.slice(0, slots);
}

describe('G7 × GAME SPEED — one fade per new Game at 1× and 2×, shown twice as fast', () => {
    it('the clocked page at 1× and 2× shows the same cover on every slot as the slot loop above; the arrival\'s fade takes 20 slots, ≈ 667 ms at 1× and ≈ 333 ms at 2×', async () => {
        const strip = (rows) => rows.map(({ at, ...r }) => r);
        const bare = play(SCRIPT, SLOTS);
        const fadeMs = {};
        for (const speed of [1, 2]) {
            const rows = await playClocked(SCRIPT, SLOTS, speed);
            expect(strip(rows), `${speed}×`).toEqual(bare);
            const arrival = rows.findIndex((r) => r.boots.length === 2);
            const fade = rows.slice(arrival).filter((r) => r.held);
            expect(fade).toHaveLength(20);
            fadeMs[speed] = fade.at(-1).at - fade[0].at;
        }
        // 19 slot gaps of 1000/30 ms (1×) and 1000/60 ms (2×), quantised to the 60 Hz frames
        expect(fadeMs[1]).toBeGreaterThan(19 * (1000 / 30) - 20);
        expect(fadeMs[1]).toBeLessThan(19 * (1000 / 30) + 20);
        expect(fadeMs[2]).toBeGreaterThan(19 * (1000 / 60) - 20);
        expect(fadeMs[2]).toBeLessThan(19 * (1000 / 60) + 20);
    });
});
