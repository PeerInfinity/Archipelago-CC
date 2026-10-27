/**
 * ⛓ ONE FADE PER CROSSING. The user (2026-10-26): "in js mode, it does a double fade on every room transition. It
 * doesn't do that in wasm mode." The cause, measured on the live page (the Playback Bot walking seedling_atlas with
 * the graphics stack on): every door showed TWO full 20-frame ramps on the room it led to. (1) The door's own
 * `new Game` (`Teleporter.as`), held by the page as its build's dead frames; (2) the host's ARRIVAL TELEPORT, which
 * the region binding queues on the very frame it reads the door's `pendingExit`. The JS runtime drained its queue
 * only on a TICK, so that teleport waited out the whole hold and then booted a fresh run that faded in from black
 * again. The game polls its queue on every frame (`BridgeGeneric`'s own `ENTER_FRAME`, outside `Game`'s
 * `blackCover` gate), so on the wasm page the teleport lands a frame or two into the door's fade.
 *
 * The fix, and what this drives: the page polls the queue on each dead frame it holds (`jsRuntimeCore.drainItems`),
 * and a fresh run met while a fade is still owed lets that fade PLAY ON (`adoptRunEffectSkin`). The real runtime is
 * driven through the page's own clock calls in its order (`jsRuntimePage.advance`, as `seedlingFadeOnce.test.js`
 * does), with a host that answers each crossing with an arrival teleport the way the binding does. The pin: each
 * crossing shows exactly ONE ramp, monotone non-increasing, of the game's 20 frames at `1 − 0.05k`.
 * Mutants: today's page (no poll on a held frame) shows two ramps per crossing; the game's restart drawn literally
 * (a fresh run's fade replaces the one showing) is not monotone.
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

const lastBootInPlace = (rt) => {
    const ev = rt.events;
    for (let i = ev.length - 1; i >= 0; i -= 1) if (ev[i].type === 'boot') return ev[i].why === IN_PLACE_REBOOT_WHY;
    return false;
};
/** The black cover a paint shows (`seedlingEffectSkin.screenOps`): a queued fade not yet shown is 1. */
const coverOf = (skin) => (skin?.fadeQueue?.length && !skin.cover ? 1 : (skin?.cover ?? 0));
/** The tile of the live room's teleporter (a door or stairs) to `to`, from the run's world. */
const doorTo = (run, to) => {
    const tp = run.world.teleporters.find((t) => t.to === to);
    return [Math.floor(tp.x / 16), Math.floor(tp.y / 16)];
};
const FADE = Array.from({ length: 20 }, (_, k) => +Math.max(1 - 0.05 * (k + 1), 0).toFixed(4));

/**
 * The page's slot (`jsRuntimePage.slot`), one per call. `drive(rt, slot)` returns the keys to hold (or starts a walk).
 * The host answers each NEW crossing with `new Game(to, …)` at its arrival through `answer(items)`, and may queue
 * `extra` items with it (a delivery). `drain` = the page polls the queue on a held frame (the fix; false = today's
 * page); `forget` = the mutant that draws the game's restart.
 */
function pageSlots(drive, { drain = true, forget = false, extra = [], answer }) {
    const rt = createJsRuntime({ log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.queueItems([{ class: 'game', property: 'menu', value: false }]);
    rt.setVanilla(MAP);
    const view = () => effectSkinView(rt.run, { record: recordOf(rt.run.level) });
    let skin = null;
    let seenCrossings = 0;
    const rows = [];
    const slot = () => {
        const n = rows.length;
        const keys = drive(rt, n) ?? new Set();
        const s = fadeSlot(forget && skin?.epoch.run !== rt.run ? null : skin, view(),
            { run: rt.run, fresh: rt.run.ticksCompleted === 0, inPlace: () => lastBootInPlace(rt) });
        skin = s.skin;
        if (s.held) {
            if (drain) rt.drainItems();
        } else {
            rt.tick(keys);
            const fv = view();
            skin = stepEffectSkin(carryThroughReboot(skin, fv, { run: rt.run, inPlace: () => lastBootInPlace(rt) }), fv, rt.ticks);
        }
        const crossings = rt.events.filter((e) => e.type === 'transition');
        for (const tr of crossings.slice(seenCrossings)) {
            const at = rt.arrival;
            answer(rt, [{ invocation: 'new_instance', className: 'Game', args: [tr.to, at.x, at.y] }, ...extra], n);
        }
        seenCrossings = crossings.length;
        rows.push({ slot: n, cover: +coverOf(skin).toFixed(4), held: s.held, level: rt.run.level, crossings: crossings.length,
            boots: rt.events.filter((e) => e.type === 'boot').length });
    };
    return { rt, rows, slot };
}

/** The bare slot loop. The host answers `hostDelay` slots after the slot it saw the crossing (0 = the same slot: measured live). */
function play(drive, slots, { hostDelay = 0, ...opts } = {}) {
    const answers = new Map();
    const page = pageSlots(drive, { ...opts, answer: (rt, items, n) => {
        if (hostDelay === 0) rt.queueItems(items);
        else answers.set(n + hostDelay, items);
    } });
    for (let n = 0; n < slots; n += 1) {
        if (answers.has(n)) page.rt.queueItems(answers.get(n));
        page.slot();
    }
    return { rows: page.rows, rt: page.rt };
}

/**
 * ⛓ GAME SPEED — the same slots on the page's REAL clock (`jsRuntimeClock`: one slot per event-loop turn, the first
 * in the animation frame, the rest as posted tasks) on a 60 Hz display. The host's answer is a `postMessage` from
 * the panel: a TASK, queued behind the slots already posted, and `hostDelayMs` later when given. At 4× a frame runs
 * up to four slots, so the answer can land several slots into the door's fade.
 */
async function playClocked(drive, slots, speed, { hostDelayMs = 0, ...opts } = {}) {
    const { createSlotClock, createSlotPump } = await import('./jsRuntimeClock.js');
    let now = 0;
    const tasks = [];
    const later = [];
    const page = pageSlots(drive, { ...opts, answer: (rt, items) => {
        const deliver = () => rt.queueItems(items);
        if (hostDelayMs === 0) tasks.push(deliver);
        else later.push({ due: now + hostDelayMs, deliver });
    } });
    const pump = createSlotPump({ clock: createSlotClock({ speed }), runSlot: page.slot, postTask: (fn) => tasks.push(fn) });
    for (let f = 0; page.rows.length < slots; f += 1) {
        now = f * (1000 / 60);
        for (const l of later.filter((x) => x.due <= now)) { later.splice(later.indexOf(l), 1); tasks.push(l.deliver); }
        pump.frame(now);
        while (tasks.length) tasks.shift()();
    }
    return { rows: page.rows.slice(0, slots), rt: page.rt };
}

/** The slots where the cover RISES (a fade starting). */
function ramps(rows) {
    const starts = [];
    let prev = 0;
    for (const r of rows) {
        if (r.cover > prev) starts.push(r.slot);
        prev = r.cover;
    }
    return starts;
}

// Arrive at L16 beside its stairs to L15 (16, 64); walk LEFT onto them by keys; then the BOT (the page's own
// walker, `playback.walkTo`) walks L15's stairs back to L16; then keys onto L16's stairs again.
function script({ arriveAt = 30 } = {}) {
    let botFrom = null;
    let thirdFrom = null;
    return (rt, slot) => {
        if (slot === arriveAt) rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [16, 40, 64] }]);
        const n = rt.events.filter((e) => e.type === 'transition').length;
        if (n === 0 && slot > arriveAt + 30) return new Set(['left']);
        if (n === 1 && rt.run.level === 15 && botFrom === null && rt.run.ticksCompleted > 5) {
            botFrom = slot;
            const [tx, ty] = doorTo(rt.run, 16);
            expect(rt.playback.walkTo({ kind: 'exit', level: 15, tiles: [[tx, ty]] })).toEqual({ ok: true });
            rt.playback.play();
        }
        if (n === 2 && rt.run.level === 16 && rt.run.ticksCompleted > 5) {
            if (thirdFrom === null) { thirdFrom = slot; rt.playback.reset(); }
            return new Set(['left']);
        }
        return null;
    };
}
const SLOTS = 600;

/** Each crossing's stretch of rows: from the slot that crossed to the next crossing (or the end). */
function stretches(rows) {
    const out = [];
    for (let i = 1; i < rows.length; i += 1) if (rows[i].crossings > rows[i - 1].crossings) out.push(i);
    return out.map((from, k) => rows.slice(from, out[k + 1] ?? rows.length));
}

function expectOneRampEach(rows, n) {
    const parts = stretches(rows);
    expect(parts.length, 'crossings').toBe(n);
    for (const part of parts) {
        const label = `the crossing at slot ${part[0].slot} (→ level ${part[0].level})`;
        // the host's teleport really landed inside this crossing (not vacuous): a boot after the door
        expect(part.at(-1).boots, `${label}: the host's arrival teleport booted`).toBeGreaterThan(part[0].boots);
        expect(ramps(part), `${label}: one ramp`).toEqual([part[0].slot]);
        const covers = part.map((r) => r.cover);
        for (let i = 1; i < covers.length; i += 1) expect(covers[i], `${label}: slot ${part[i].slot}`).toBeLessThanOrEqual(covers[i - 1]);
        expect(part.filter((r) => r.held).map((r) => r.cover), `${label}: the game's fade`).toEqual(FADE);
    }
}

describe('one fade per crossing (the JS page)', () => {
    it('three crossings, two walked by keys and one by the bot, the host answering each at once: ONE ramp each', () => {
        const { rows, rt } = play(script(), SLOTS);
        expect(rt.events.filter((e) => e.type === 'transition').map((e) => `${e.from}→${e.to}`)).toEqual(['16→15', '15→16', '16→15']);
        expectOneRampEach(rows, 3);
    });

    it('the host answering a slot late, with an item delivery beside its teleport: still ONE ramp each', () => {
        const { rows, rt } = play(script(), SLOTS, { hostDelay: 2, extra: [{ class: 'Main', property: 'hasShield', value: true }] });
        expect(rt.events.some((e) => e.type === 'boot' && e.why === IN_PLACE_REBOOT_WHY), 'the delivery rebooted in place').toBe(true);
        expectOneRampEach(rows, 3);
    });

    it('the fresh start: an arrival after L0 has shown keeps its own fade; one landing INSIDE L0\'s fade continues it', () => {
        // after L0's fade (the room has been shown live): two ramps, `seedlingFadeOnce.test.js`'s case
        const late = play(script({ arriveAt: 30 }), 60).rows;
        expect(ramps(late)).toEqual([0, late.findIndex((r) => r.boots === 2)]);
        // queued while L0's first-frame fade is still held: it lands inside it, and the start shows ONE fade
        const early = play(script({ arriveAt: 5 }), 34).rows;   // before its first crossing (keys from slot 36)
        expect(early.find((r) => r.slot === 6).boots, 'the arrival landed on a held frame').toBe(2);
        expect(ramps(early)).toEqual([0]);
        expect(early.filter((r) => r.held).map((r) => r.cover)).toEqual(FADE);
    });

    it('MUTANT — today\'s page (the queue drained on a tick only): TWO ramps per crossing, and the pin goes red', () => {
        const { rows } = play(script(), SLOTS, { drain: false });
        const parts = stretches(rows);
        expect(parts.length).toBe(3);
        for (const part of parts) expect(ramps(part).length).toBe(2);
        expect(() => expectOneRampEach(rows, 3)).toThrow();
    });

    it('MUTANT — the game\'s restart drawn literally (a fresh run\'s fade replaces the one showing): not monotone, red', () => {
        const { rows } = play(script(), SLOTS, { forget: true });
        expect(() => expectOneRampEach(rows, 3)).toThrow();
    });

    it('GAME SPEED — the page\'s real clock at 1×, 2× and 4×, the host answering by a posted task: ONE ramp each', async () => {
        for (const speed of [1, 2, 4]) {
            const { rows, rt } = await playClocked(script(), SLOTS, speed);
            expect(rt.events.filter((e) => e.type === 'transition').map((e) => `${e.from}→${e.to}`), `${speed}×`).toEqual(['16→15', '15→16', '16→15']);
            expectOneRampEach(rows, 3);
        }
    });

    it('GAME SPEED — the host 100 ms late at 4× (≈ 12 slots into the fade): absorbed, ONE ramp each; today\'s page still TWO', async () => {
        const { rows } = await playClocked(script(), SLOTS, 4, { hostDelayMs: 100 });
        expectOneRampEach(rows, 3);
        const today = (await playClocked(script(), SLOTS, 4, { hostDelayMs: 100, drain: false })).rows;
        for (const part of stretches(today)) expect(ramps(part).length).toBe(2);
    });
});
