/**
 * ⛓ GAME SPEED (slice `seedling-js-game-speed`, ⚖ the user 2026-10-24/26) — **THE SPEED IS PRESENTATION ONLY.**
 * The same run at 1× / 2× / 4× is the same tick sequence: the same `stateDigest()` after every tick, the same checks
 * on the same ticks, the same solves.
 *
 * The fixture is a real Playback-Bot walk on the production load (`jsRuntimeVanillaDelivery.test.js`'s arrangement:
 * `seedling_playthrough` on the JS transport, the solver driving its real rooms): L0 → the starting house (L86), its
 * chest's apitem, and back out to L0. The HOST is modelled as the live one answers: on its own turn, in a
 * MICROTASK chain off the page's report (`onStateChanged` → the event bus → `queueItems` / a walk verb). It hands the
 * chest goal when the page reports level 86, and on the chest's `pendingCheck` it delivers an item (an in-place
 * reboot, `jsRuntimeCore.rebootInPlace`) and hands the walk back to L0. A SYNCHRONOUS host (answers inside the
 * report) is run too.
 *
 * The page's clock is the real one (`jsRuntimeClock`: the accumulator and the one-slot-per-turn pump), the slot is
 * the page's (`jsRuntimePage.slot`: the G4/G7 fade hold, then a tick), and the frames come from a jittery 60 Hz
 * display with stalls, on a simulated event loop: a frame callback, then its microtasks, then each posted task with
 * its microtasks.
 *
 * Mutants (each must turn the pin red):
 *  m1 the PRE-SPEED loop (every due slot inside the frame callback) at 4× — the host's answer is drained a tick late;
 *  m2 a host delivery applied one slot late at 4× (the brief's mutant);
 *  m3 ⛓ CUSTOM SPEED — a host delivery applied one slot late at a FRACTIONAL speed (1.5×). ⚠ m2's mechanism (a
 *     posted task) is one slot late only when two slots fall in one frame (4×); at 1.5× the frame usually owes one,
 *     so that task still runs before the next slot (measured: m2's form stays GREEN at 1.5×). m3 holds the delivery
 *     to the END of the next slot instead — one slot late at every speed.
 *
 * ⛓ CUSTOM SPEED (slice `seedling-js-custom-speed`): the same pin at 0.25× / 0.5× / 1.5× / 3× / 16× (graphics on and
 * off), and the clock's tick count exact (±1) over a minute at fractional speeds.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createJsRuntime, IN_PLACE_REBOOT_WHY } from './jsRuntimeCore.js';
import {
    BASE_MAX_SLOTS_PER_FRAME, BASE_TICKS_PER_SECOND, createSlotClock, createSlotPump, GAME_SPEEDS, maxSlotsAt, parseGameSpeed,
} from './jsRuntimeClock.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { carryThroughReboot, effectSkinView, fadeSlot, stepEffectSkin } from './seedlingEffectSkin.js';
import { loadSeedlingRandomizer } from '../flashPanel/seedlingRandomizerWiring.js';
import { realRoomPlaybackMap, resolveSeedlingAtlasGoal } from '../flashPanel/seedlingPlaybackController.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const GAME = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties });
const MAP_DOC = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const PT = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];

const locationsOf = (rules) => {
    const out = new Map();
    for (const slot of Object.keys(rules.regions ?? {})) {
        for (const [region, r] of Object.entries(rules.regions[slot])) {
            for (const loc of r.locations ?? []) out.set(loc.name, { ...loc, region, parent_region_name: region });
        }
    }
    return out;
};
const LOADED = await loadSeedlingRandomizer({
    flashPanel: PT.flash_panel['1'], manifest: null, transport: 'js', rawRules: PT, locations: locationsOf(PT),
    playerId: Object.keys(PT.regions)[0], gameConfig: GAME, baseUrl: pathToFileURL(join(ROOT, 'frontend/')).href,
    fetchJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
    importModule: (u) => import(/* @vite-ignore */ u),
});
const MAP = realRoomPlaybackMap(LOADED, PT);
const goalOf = (q) => {
    const r = resolveSeedlingAtlasGoal(q, MAP, {});
    if (!r.goal) throw new Error(r.refused);
    return r.goal;
};
const doorGoal = (from, to) => {
    const names = [...MAP.regions.values()].filter((p) => p.level === from)
        .flatMap((p) => (p.exits ?? []).filter((e) => e.target_level === to && e.exitName).map((e) => e.exitName));
    if (names.length !== 1) throw new Error(`doors ${from} → ${to}: ${names.length}`);
    return goalOf({ kind: 'exit', name: names[0] });
};
const CHEST = LOADED.entries.find((e) => e.level === 86);
const GOALS = { in: doorGoal(0, 86), chest: goalOf({ kind: 'location', name: CHEST.location }), out: doorGoal(86, 0) };
const GRANT = [{ class: 'Main', property: 'hasSword', value: true }];
const GRANT_HOME = [{ class: 'Main', property: 'hasShield', value: true }];
const START = { level: 0, x: 80, y: 128 };

/** `jsRuntimePage.lastBootInPlace`. */
const lastBootInPlace = (rt) => {
    const ev = rt.events;
    for (let i = ev.length - 1; i >= 0; i -= 1) if (ev[i].type === 'boot') return ev[i].why === IN_PLACE_REBOOT_WHY;
    return false;
};

/** A deterministic display: ~60 Hz with ±2 ms jitter and a 70 ms stall every 47th frame (catch-up frames at 1× too). */
function* frameTimes() {
    let seed = 12345;
    let now = 0;
    for (let f = 0; ; f += 1) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        now += (f % 47 === 46 ? 70 : 1000 / 60) + ((seed / 2147483648) * 4 - 2);
        yield now;
    }
}
const turn = () => new Promise((r) => { setImmediate(r); });

/**
 * Play the walk at `speed`. `graphics` = a stack is on (the page holds dead frames for the load fades); `host` =
 * 'microtask' | 'sync'; `pump` = 'page' (the slice's) | 'legacy' (m1); `lateAt` = a speed at which the host's
 * delivery is applied one slot late (m2). Stops once the run has ticked `untilTicks` (or the walk back is done + 30).
 */
async function play({ speed, graphics = true, host = 'microtask', pump: pumpKind = 'page', lateAt = null, lateSlotAt = null, untilTicks = null }) {
    const digests = [];
    const checks = [];
    let stage = 'in';
    let doneAt = null;
    const tasks = [];
    const postTask = (fn) => { tasks.push(fn); };
    let rt = null;
    const answer = (fn) => {
        if (host === 'sync') fn();
        else Promise.resolve().then(() => Promise.resolve()).then(fn);
    };
    // m3: held back until the END of the next slot, so it reaches the run exactly one slot late at any speed
    const lateSlot = [];
    const deliver = (items) => {
        if (lateSlotAt === speed) lateSlot.push(items);
        else if (lateAt === speed) postTask(() => rt.queueItems(items)); else rt.queueItems(items);
    };
    const hand = (goal) => {
        expect(rt.playback.walkTo(goal)).toEqual({ ok: true });
        rt.playback.play();
    };
    rt = createJsRuntime({
        onStateChanged: (p, v) => {
            if (p === 'level' && v === 86 && stage === 'in') { stage = 'chest'; answer(() => hand(GOALS.chest)); }
            if (p === 'pendingCheck' && stage === 'chest') {
                checks.push({ tick: rt.ticks, value: v });
                stage = 'out';
                answer(() => { deliver(GRANT); hand(GOALS.out); });
            }
            // back in L0: a second delivery, outside any ceremony (the chest's is deferred to the ceremony's end)
            if (p === 'level' && v === 0 && stage === 'out') { stage = 'home'; answer(() => deliver(GRANT_HOME)); }
        },
    });
    expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
    rt.setVanilla(MAP_DOC);
    expect(planLevelSetChunks(LOADED.set).chunks.map((c) => rt.game.botLoadLevels(JSON.stringify(c))).at(-1)).toBe('ok');
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [START.level, START.x, START.y] }]);
    rt.playback.setSolverWalk(true);
    hand(GOALS.in);

    let skin = null;
    let held = 0;
    const view = () => effectSkinView(rt.run, { record: rt.mounted?.records?.get(rt.run.level) ?? null });
    const slot = () => {
        try { slotBody(); } finally { while (lateSlot.length) rt.queueItems(lateSlot.shift()); }
    };
    const slotBody = () => {
        if (graphics && rt.run) {
            const s = fadeSlot(skin, view(), { run: rt.run, fresh: rt.run.ticksCompleted === 0, inPlace: () => lastBootInPlace(rt) });
            skin = s.skin;
            // ⛓ the page polls the host's queue on a held dead frame too (`jsRuntimePage.slot`, `drainItems`)
            if (s.held) { held += 1; rt.drainItems(); return; }
        }
        const out = rt.tick(new Set());
        expect(out.halted ?? null).toBeNull();
        if (rt.run) digests.push(rt.run.stateDigest());
        if (graphics) { const fv = view(); skin = stepEffectSkin(carryThroughReboot(skin, fv, { run: rt.run, inPlace: () => lastBootInPlace(rt) }), fv, rt.ticks); }
        if (stage === 'home' && doneAt === null && rt.playback.state === WALK_STATES.DONE && rt.run.level === 0) doneAt = rt.ticks;
    };
    const clock = createSlotClock({ speed });
    const pump = pumpKind === 'legacy'
        ? { frame(now) { for (let n = clock.due(now); n > 0; n -= 1) slot(); } }
        : createSlotPump({ clock, runSlot: slot, postTask });
    const stop = () => (untilTicks !== null ? digests.length >= untilTicks : doneAt !== null && rt.ticks >= doneAt + 30);
    let frames = 0;
    let wallMs = 0;
    for (const now of frameTimes()) {
        frames += 1;
        wallMs = now;
        pump.frame(now);
        await turn();
        while (tasks.length) { tasks.shift()(); await turn(); }
        if (stop() || frames > 200000) break;
        if (SETTLED.includes(rt.playback.state) && rt.playback.state === WALK_STATES.FAILED) throw new Error(`walk failed at ${rt.ticks}`);
    }
    return { digests: untilTicks !== null ? digests.slice(0, untilTicks) : digests, checks, held, doneAt, frames, wallMs,
        solves: rt.playback.solverStats.solves, reboots: rt.events.filter((e) => e.type === 'boot' && e.why === IN_PLACE_REBOOT_WHY).length };
}

describe('GAME SPEED — the clock', () => {
    it('1× is the page\'s old accumulator exactly; 2× / 4× scale the slot length and the per-frame cap', () => {
        expect(GAME_SPEEDS).toEqual([1, 2, 4]);
        for (const s of GAME_SPEEDS) {
            const c = createSlotClock({ speed: s });
            expect(c.tickMs).toBe(1000 / (BASE_TICKS_PER_SECOND * s));
            expect(c.maxSlots).toBe(BASE_MAX_SLOTS_PER_FRAME * s);
        }
        // the pre-speed loop, verbatim (TICK_MS 1000/30, cap 5): the same counts on the same frames
        const old = (() => {
            const TICK_MS = 1000 / 30; let last = null; let acc = 0;
            return (now) => { if (last === null) last = now; acc += Math.min(now - last, TICK_MS * 5); last = now; let n = 0; while (acc >= TICK_MS && n < 5) { acc -= TICK_MS; n += 1; } return n; };
        })();
        const c1 = createSlotClock();
        const it = frameTimes();
        for (let f = 0; f < 5000; f += 1) { const now = it.next().value; expect(c1.due(now)).toBe(old(now)); }
    });

    it('the speed reads `1x` / `2` / `4×` / `1.5`; outside 0.25 … 16 or off the 0.05 grid refuses by name and reason', () => {
        expect(parseGameSpeed(null)).toBe(1);
        expect(parseGameSpeed('2')).toBe(2);
        expect(parseGameSpeed('4x')).toBe(4);
        expect(parseGameSpeed('4×')).toBe(4);
        expect(parseGameSpeed('3')).toBe(3);
        expect(parseGameSpeed('1.5')).toBe(1.5);
        expect(parseGameSpeed('0.25')).toBe(0.25);
        expect(parseGameSpeed('16')).toBe(16);
        expect(() => parseGameSpeed('16.05')).toThrow(/\?speed=16\.05: 16\.05× is above the maximum 16×/);
        expect(() => parseGameSpeed('0.2')).toThrow(/below the minimum 0\.25×/);
        expect(() => parseGameSpeed('1.33')).toThrow(/not a multiple of 0\.05/);
        expect(() => parseGameSpeed('fast')).toThrow(/fast is not a number/);
    });

    it('⛓ CUSTOM SPEED — the per-frame cap is a whole slot count, the old one at 1 / 2 / 4, and never skips less wall time than 1×', () => {
        expect([1, 2, 4].map(maxSlotsAt)).toEqual([5, 10, 20]);
        expect([0.25, 0.5, 1.2, 1.5, 3, 16].map(maxSlotsAt)).toEqual([2, 3, 6, 8, 15, 80]);
        for (let k = 5; k <= 320; k += 1) {
            const c = createSlotClock({ speed: k * 0.05 });
            expect(Number.isInteger(c.maxSlots)).toBe(true);
            expect(c.tickMs * c.maxSlots).toBeGreaterThanOrEqual(1000 / 30 * 5 - 1e-9);
        }
    });

    it('⛓ CUSTOM SPEED — over N simulated seconds at 0.25 / 0.5 / 1.5 / 3 / 7.35 / 16×, the slot count is exact (±1), no drift', () => {
        for (const s of [0.25, 0.5, 1.5, 3, 7.35, 16]) {
            for (const seconds of [10, 60, 600]) {
                const c = createSlotClock({ speed: s });
                let slots = 0;
                let first = null;
                let now = 0;
                for (const t of frameTimes()) { first ??= t; now = t; slots += c.due(t); if (t > seconds * 1000) break; }
                expect(Math.abs(slots - ((now - first) / 1000) * BASE_TICKS_PER_SECOND * s), `${s}× over ${seconds} s`).toBeLessThan(1);
            }
        }
        // and a mid-run change keeps it exact on either side (the phase carries)
        const c = createSlotClock({ speed: 0.5 });
        let slots = 0;
        let at = null;
        for (const t of frameTimes()) {
            if (t > 30000 && c.speed === 0.5) { at = { t, slots }; c.setSpeed(3); }
            slots += c.due(t);
            if (t > 60000) {
                const want = (at.t / 1000) * 15 + ((t - at.t) / 1000) * 90;
                expect(Math.abs(slots - want)).toBeLessThan(2);
                break;
            }
        }
    });

    it('over 60 s of a jittery 60 Hz display, the slots run are 30 × the speed a second (4× keeps up: cap 20 > 2 a frame)', () => {
        for (const s of GAME_SPEEDS) {
            const c = createSlotClock({ speed: s });
            let slots = 0;
            let first = null;
            let now = 0;
            for (const t of frameTimes()) { first ??= t; now = t; slots += c.due(t); if (t > 60000) break; }
            // the stalls (70 ms) are under the cap's 166 ms window, so no time is dropped: the count is the elapsed
            // time's (less the slot in progress)
            expect(Math.abs(slots - ((now - first) / 1000) * BASE_TICKS_PER_SECOND * s)).toBeLessThan(1);
        }
    });

    it('the pump runs ONE slot per event-loop turn, never more than the cap owed, and drops no tick it owes', () => {
        const ran = [];
        const tasks = [];
        const c = createSlotClock({ speed: 4 });
        const p = createSlotPump({ clock: c, runSlot: () => ran.push(tasks.length), postTask: (fn) => tasks.push(fn) });
        p.frame(0);
        p.frame(51); // 6 slots due
        expect(ran).toEqual([0]);   // one in the frame callback
        expect(tasks).toHaveLength(1);
        while (tasks.length) tasks.shift()();
        expect(p.slots).toBe(6);
        // a long stall: the clock caps at 20 slots
        p.frame(10000);
        while (tasks.length) tasks.shift()();
        expect(p.slots).toBe(26);
        expect(p.owed).toBe(0);
    });

    it('setSpeed keeps the phase of the slot in progress', () => {
        const c = createSlotClock({ speed: 1 });
        c.due(0);
        expect(c.due(25)).toBe(0); // 3/4 of a 1× slot
        c.setSpeed(4);
        expect(c.due(25)).toBe(0); // 3/4 of a 4× slot carried over
        expect(c.due(25 + (1000 / 120) * 0.26)).toBe(1);
    });
});

describe('GAME SPEED — a Playback-Bot walk is the same tick sequence at 1× / 2× / 4×', () => {
    const ref = {};
    const firstDiff = (r, base) => r.digests.findIndex((d, i) => d !== base.digests[i]);

    it.each([['on', true], ['off', false]])('1× (graphics %s, microtask host): solved and played — L0 → L86, the chest checked, two items delivered, out to L0', async (key, graphics) => {
        const r = await play({ speed: 1, graphics });
        ref[key] = r;
        expect(r.doneAt).not.toBeNull();
        expect(r.checks).toEqual([{ tick: expect.any(Number), value: `1|86|${CHEST.tag}|0` }]);
        expect(r.solves).toBe(3);
        expect(r.reboots).toBe(2);   // both deliveries landed (in-place reboots)
        if (graphics) expect(r.held).toBeGreaterThan(40); // the fades were held: L0's boot and both crossings
        else expect(r.held).toBe(0);
    }, 240000);

    it.each([[2, 'on'], [4, 'on'], [2, 'off'], [4, 'off']])('%i× (graphics %s): the same stateDigest after every tick, the same check on the same tick, the same holds', async (speed, key) => {
        const base = ref[key];
        const r = await play({ speed, graphics: key === 'on', untilTicks: base.digests.length });
        expect(r.digests).toHaveLength(base.digests.length);
        expect(firstDiff(r, base), `first differing tick at ${speed}×`).toBe(-1);
        expect(r.checks).toEqual(base.checks);
        expect(r.held).toBe(base.held);
        expect(r.solves).toBe(3);
        expect(r.reboots).toBe(2);
        // and it really was shown faster
        expect(r.wallMs).toBeLessThan((base.wallMs / speed) * 1.15);
    }, 240000);

    it('4× with a SYNCHRONOUS host (answers inside the report): the same tick sequence as 1×', async () => {
        const a = await play({ speed: 1, graphics: false, host: 'sync' });
        const b = await play({ speed: 4, graphics: false, host: 'sync', untilTicks: a.digests.length });
        expect(a.reboots).toBe(2);
        expect(firstDiff(b, a)).toBe(-1);
        expect(b.checks).toEqual(a.checks);
    }, 240000);

    it('MUTANT m1 — the pre-speed loop (every due slot inside the frame callback) at 4×: a host answer lands a tick late, the pin goes red', async () => {
        const r = await play({ speed: 4, graphics: false, pump: 'legacy', untilTicks: ref.off.digests.length });
        expect(firstDiff(r, ref.off)).toBeGreaterThan(-1);
    }, 240000);

    it('MUTANT m2 — a host delivery applied one slot late at 4×: the pin goes red, from the delivery on', async () => {
        const r = await play({ speed: 4, graphics: false, lateAt: 4, untilTicks: ref.off.digests.length });
        expect(firstDiff(r, ref.off)).toBeGreaterThan(ref.off.checks[0].tick);
    }, 240000);

    // ⛓ CUSTOM SPEED — fractional and slow speeds: the same tick sequence as 1× (the 1× refs above)
    it.each([[0.25, 'on'], [0.5, 'on'], [1.5, 'on'], [3, 'on'], [16, 'on'], [0.25, 'off'], [0.5, 'off'], [1.5, 'off'], [3, 'off'], [16, 'off']])(
        '⛓ CUSTOM SPEED %s× (graphics %s): the same stateDigest after every tick, the same check on the same tick, the same holds', async (speed, key) => {
            const base = ref[key];
            const r = await play({ speed, graphics: key === 'on', untilTicks: base.digests.length });
            expect(r.digests).toHaveLength(base.digests.length);
            expect(firstDiff(r, base), `first differing tick at ${speed}×`).toBe(-1);
            expect(r.checks).toEqual(base.checks);
            expect(r.held).toBe(base.held);
            expect(r.solves).toBe(3);
            expect(r.reboots).toBe(2);
            // shown at that speed: the wall time scales by 1 / speed (within the frame quantum and the walk's tail)
            expect(r.wallMs).toBeLessThan((base.wallMs / speed) * 1.15);
            expect(r.wallMs).toBeGreaterThan((base.wallMs / speed) * 0.85);
        }, 240000);

    it('⛓ CUSTOM SPEED — 1.5× with a SYNCHRONOUS host: the same tick sequence as 1×', async () => {
        const a = await play({ speed: 1, graphics: false, host: 'sync' });
        const b = await play({ speed: 1.5, graphics: false, host: 'sync', untilTicks: a.digests.length });
        expect(firstDiff(b, a)).toBe(-1);
        expect(b.checks).toEqual(a.checks);
    }, 240000);

    it('MUTANT m3 — a host delivery applied one slot late at a FRACTIONAL speed (1.5×): the pin goes red, from the delivery on', async () => {
        const r = await play({ speed: 1.5, graphics: false, lateSlotAt: 1.5, untilTicks: ref.off.digests.length });
        // digests[i] is tick i + 1: index `check tick` is the first tick after the check, where the late item lands
        expect(firstDiff(r, ref.off)).toBe(ref.off.checks[0].tick);
    }, 240000);
});
