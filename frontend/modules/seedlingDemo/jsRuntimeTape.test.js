/**
 * jsRuntimeTape — ⛓⛓ PHASE B: the Bot.as TAPE VERBS on the JS runtime core (`botLoadTape` / `botStart` / `botStatus`
 * `finished`·`tick`·`items` / `botDrain`), and the pin that the no-tape path did not move.
 *
 *  1. THE NO-TAPE IDENTITY PIN — a page with no tape loaded ticks BYTE-IDENTICALLY to the core before Phase B: the
 *     run's state digest (`run.stateDigest()`), the pre-Phase-B `botStatus` fields, the walker's state and the host's
 *     reports, chained over a keyboard leg and a walker leg, hash to the value measured on the pre-Phase-B core
 *     (`NO_TAPE_CHAIN`, recorded at `9c0f9045`). And a tape LOADED but never started leaves the chain unchanged too
 *     (the leak a mutant of `tickOnce` reds — see the report, `CC/docs/cloud-reports/seedling-js-tape-bridge.md`).
 *  2. THE TAPE — a committed vanilla-room tape loaded, started, played to `finished` and drained: the drain agrees
 *     with the JS MODEL (`runTape` over the same atlas) at EVERY tick, through the lab's own comparator
 *     (`diffObservationStreams` over `gameStreamFromDrain`), and its last frame is the model's end state.
 *  3. THE REFUSALS — the game's own strings where the game has one (`no tape loaded`, `already running`, the version
 *     gate), and named ones where only the JS frame refuses (`JS_TAPE_REFUSALS`). A relaxed tape plays as declared.
 *  4. LIVE INPUT NEVER REACHES A REPLAY — a tape played while the page feeds live keys into EVERY tape tick (arrows,
 *     X, C, and the V/I menu toggles) drains byte-identically to the same tape with no live keys, ends in the same
 *     state digest and inventory, never opens the V menu and notes no `inventory` event. This is what L3's
 *     `#jsTouch` strip leans on during a REPLAY: touch feeds the same held set `rt.tick` takes.
 *  ⛓ The whole committed roster (every `fixtures/tapes/*.json` that parses) is swept in `jsRuntimeTape.slow.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime, JS_TAPE_REFUSALS } from './jsRuntimeCore.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { TOGGLE_KEYS } from './inventoryMenu.js';
import { canonicalDigestText, digestOfText } from './levelRun.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { runTape } from './tapeRunner.js';
import {
    diffObservationStreams, gameStreamFromDrain, gameVisibleTape, holdingWindowTape, parseTape,
} from './tapeFormat.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const GAME = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties });
const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes/';
const tapeOf = (name) => readJson(`${TAPES}${name}.json`);

/** The `botStatus` fields the core reported BEFORE Phase B — the identity chain reads these and only these. */
export const PRE_PHASE_B_STATUS = Object.freeze(['runtime', 'level', 'time', 'ticks', 'game_time', 'x', 'y', 'deaths',
    'hits', 'hits_timer', 'halted', 'persistence_cleared']);

/** The level-0 stairs down to L2 (`owls_nest_stairs`, (256, 272)) — a walker goal the vanilla map boots next to. */
const STAIRS_GOAL = { kind: 'exit', level: 0, tiles: [[16, 17]] };

/**
 * ⛓ THE NO-TAPE SCENARIO, parameterised by the module so the chain can be measured on the pre-Phase-B core too
 * (a copy of `git show 9c0f9045:…/jsRuntimeCore.js` beside this one). `between(rt)` runs once before the ticks — the
 * tape-loaded leg loads a tape there and never starts it.
 * @returns {{chain: string, rows: number, walk: string}}
 */
export function noTapeChain(create, { between = () => {} } = {}) {
    const reports = [];
    const rt = create({ onStateChanged: (p, v) => reports.push([p, v]) });
    rt.game.configure(BRIDGE_CONFIG);
    rt.setVanilla(MAP);
    between(rt);
    const rows = [];
    const row = (out) => {
        const st = JSON.parse(rt.game.botStatus());
        rows.push(canonicalDigestText({
            out, run: rt.run ? rt.run.stateDigest() : null,
            status: Object.fromEntries(PRE_PHASE_B_STATUS.map((k) => [k, st[k]])),
            walk: rt.playback.state, reports: reports.splice(0),
        }));
    };
    // The keyboard leg: a held key, a turn, a release, nothing.
    const legs = [['right', 24], ['down', 8], ['left', 16], [null, 12], ['up', 6]];
    for (const [key, n] of legs) for (let i = 0; i < n; i += 1) row(rt.tick(new Set(key ? [key] : [])));
    // The walker leg: the walk to the stairs, to its end.
    expect(rt.playback.walkTo(STAIRS_GOAL)).toEqual({ ok: true });
    rt.playback.play();
    for (let i = 0; i < 1500 && ![WALK_STATES.DONE, WALK_STATES.FAILED].includes(rt.playback.state); i += 1) row(rt.tick());
    return { chain: digestOfText(rows.join('\n')), rows: rows.length, walk: rt.playback.state };
}

/**
 * ⛔ MEASURED ON THE PRE-PHASE-B CORE (`9c0f9045`), never derived from the code under test: the chain the no-tape
 * scenario above hashes to, and its row count. A Phase B edit that moved one field of one tick reds this row.
 */
// ⛓ Re-measured at the fidelity W35 flip (2026-10-30, js-13 signed): 0d022900a706b10a780bf029f08a → 1f44092f380a801342ab2c06ee51.
// Method: `noTapeChain` over `createJsRuntime` from `git show 9c0f904549:…/jsRuntimeCore.js` (the pre-Phase-B core, copied
// beside this file) with W35's contactFidelity.js and its flags exactly as they ship (116 keys, 105 ON). Cause: the
// `globals` part of `run.stateDigest()` hashes the whole CONTACT_FIDELITY object, so ANY new key moves this chain, even OFF
// — measured: red with the three W35 keys false, green only with contactFidelity.js itself reverted.
const NO_TAPE_CHAIN = Object.freeze({ chain: '1f44092f380a801342ab2c06ee51', rows: 224, walk: WALK_STATES.DONE });

/** A runtime on the vanilla map, configured, with the game's own first frame booted. */
function vanillaRuntime() {
    const rt = createJsRuntime();
    rt.game.configure(BRIDGE_CONFIG);
    rt.setVanilla(MAP);
    return rt;
}

/** Ship a tape the way the lab does (`gameVisibleTape`, `botLoadTape`, `botStart`) and tick it to `finished`. */
function playTape(rt, raw, { maxTicks = 5000 } = {}) {
    const loaded = rt.game.botLoadTape(JSON.stringify(gameVisibleTape(parseTape(raw))));
    const started = loaded === 'ok' ? rt.game.botStart() : null;
    let st = JSON.parse(rt.game.botStatus());
    for (let i = 0; started === 'ok' && i < maxTicks && !st.finished; i += 1) {
        rt.tick(new Set());
        st = JSON.parse(rt.game.botStatus());
    }
    return { loaded, started, status: st, drained: JSON.parse(rt.game.botDrain()) };
}

describe('⛓ PHASE B — the no-tape path is byte-identical', () => {
    it('the no-tape chain (keyboard + walker, digest per tick) is the one measured on the pre-Phase-B core', () => {
        expect(noTapeChain(createJsRuntime)).toEqual(NO_TAPE_CHAIN);
    });

    it('a tape LOADED but never started leaves every tick of the chain where it was (no tape input leaks)', () => {
        const loadedOnly = noTapeChain(createJsRuntime, {
            between: (rt) => expect(rt.game.botLoadTape(JSON.stringify(tapeOf('collide-up-rock')))).toBe('ok'),
        });
        expect(loadedOnly).toEqual(NO_TAPE_CHAIN);
    });
});

describe('⛓ PHASE B — a tape plays to `finished`, and its drain is the JS model\'s stream', () => {
    const MODEL_SOURCE = levelSourceFromAtlas(MAP);

    for (const name of ['collide-up-rock', 'cross-level-leg']) {
        it(`${name}: botLoadTape ok → botStart ok → finished at tick_count; the drain agrees with runTape at every tick`, () => {
            const raw = tapeOf(name);
            const model = runTape(raw, { levelSource: MODEL_SOURCE });
            const rt = vanillaRuntime();
            const { loaded, started, status, drained } = playTape(rt, raw);
            expect(loaded).toBe('ok');
            expect(started).toBe('ok');
            expect(status).toMatchObject({ loaded: true, armed: false, finished: true, error: '',
                tick: raw.tick_count, tick_count: raw.tick_count });
            expect(drained.ticks).toHaveLength(raw.tick_count + 1);
            expect(drained.transitions).toEqual([]);
            const { stream } = gameStreamFromDrain(drained);
            expect(diffObservationStreams({ ticks: model.ticks, transitions: model.transitions }, stream)).toBeNull();
            // `items` is `itemReadout`'s fourteen, and the run's own.
            expect(Object.keys(status.items)).toHaveLength(14);
            expect(status.items).toMatchObject({ hitsMax: model.inventory.hitsMax, hasSword: model.inventory.hasSword });
            // A second drain is the empty envelope with the base kept (`Bot.as:2870-2886`).
            expect(JSON.parse(rt.game.botDrain())).toEqual({ ticks: [], transitions: [] });
        });
    }

    it('after `finished` the frame goes on LIVE: the keyboard drives again, and the tape does not', () => {
        const rt = vanillaRuntime();
        const { status } = playTape(rt, tapeOf('collide-up-rock'));
        expect(status.finished).toBe(true);
        const before = { x: rt.run.state.x, y: rt.run.state.y };
        for (let i = 0; i < 10; i += 1) rt.tick(new Set(['down']));
        expect(rt.run.state.y).toBeGreaterThan(before.y);
        expect(JSON.parse(rt.game.botStatus())).toMatchObject({ finished: true, armed: false, buffered: 0 });
    });

    it('botStart boots through the SAME boot(): the boot event names the tape, the arrival is its boot block', () => {
        const rt = vanillaRuntime();
        const raw = tapeOf('collide-up-rock');
        expect(rt.game.botLoadTape(JSON.stringify(raw))).toBe('ok');
        expect(rt.game.botStart()).toBe('ok');
        expect(rt.events.filter((e) => e.type === 'boot').at(-1)).toMatchObject({ level: raw.boot.level,
            x: raw.boot.x, y: raw.boot.y, why: 'tape collide-up-rock (botStart)' });
        expect(rt.arrival).toEqual(raw.boot);
        expect(rt.tape).toMatchObject({ loaded: true, armed: true, finished: false, tick: 0 });
    });
});

/**
 * ⛓ LIVE KEYS DURING A TAPE — `slots-l24-fire-first` (L24, two items, `firstUse`: the V menu is OPENABLE on most of
 * its ticks, so a toggle that leaked would open it). `live(t)` is the page's held set on tape tick t (`null` = none).
 * Live keys are fed only while the tape is armed for the tick: the finishing frame is a LIVE frame (`Bot.as:3330-3333`,
 * `tapeRecordThenAct` returns null), so both legs feed it nothing — and the last tape tick carries no toggle, since a
 * V held into the finishing frame is released ON it, a live frame's edge rather than a tape tick's.
 */
const LIVE_PATTERN = [['right'], ['left', 'primary'], ['up', 'secondary'], ['inventory'], [], ['down', 'inventory2'],
    ['right', 'primary', 'inventory'], []];
const LIVE_REPLAY_TAPE = 'slots-l24-fire-first';

function playTapeUnderLiveKeys(live) {
    const rt = vanillaRuntime();
    const raw = tapeOf(LIVE_REPLAY_TAPE);
    expect(rt.game.botLoadTape(JSON.stringify(gameVisibleTape(parseTape(raw))))).toBe('ok');
    expect(rt.game.botStart()).toBe('ok');
    const events0 = rt.events.length;
    let st = JSON.parse(rt.game.botStatus());
    let menuEverOpen = false;
    let openableTicks = 0;
    for (let i = 0; i < 5000 && !st.finished; i += 1) {
        const armedTick = st.armed && st.tick < st.tick_count;
        let keys = armedTick && live ? live(st.tick) : [];
        if (armedTick && st.tick === st.tick_count - 1) keys = keys.filter((k) => !TOGGLE_KEYS.includes(k));
        rt.tick(new Set(keys));
        menuEverOpen ||= rt.inventoryMenu.open;
        if (rt.run.inventoryOpenable) openableTicks += 1;
        st = JSON.parse(rt.game.botStatus());
    }
    return {
        status: st, drain: rt.game.botDrain(), digest: canonicalDigestText(rt.run.stateDigest()),
        slots: [...rt.run.inventorySlots], primary: rt.run.primary, menuEverOpen, openableTicks,
        inventoryEvents: rt.events.slice(events0).filter((e) => e.type === 'inventory'),
    };
}

describe('⛓ PHASE B — live input never reaches a replay (keyboard, and the `#jsTouch` strip that feeds the same set)', () => {
    it(`${LIVE_REPLAY_TAPE}: arrows, X, C, V and I fed into every tape tick → the drain, end state and inventory are the quiet replay's`, () => {
        const quiet = playTapeUnderLiveKeys(null);
        const noisy = playTapeUnderLiveKeys((t) => LIVE_PATTERN[t % LIVE_PATTERN.length]);
        expect(quiet.status).toMatchObject({ finished: true, error: '' });
        // the menu COULD have opened: the pin is not vacuous
        expect(quiet.slots.length).toBeGreaterThanOrEqual(2);
        expect(noisy.openableTicks).toBeGreaterThan(100);
        expect(noisy.status).toEqual(quiet.status);
        expect(noisy.drain).toBe(quiet.drain);
        expect(noisy.digest).toBe(quiet.digest);
        expect(noisy.slots).toEqual(quiet.slots);
        expect(noisy.primary).toBe(quiet.primary);
        expect(noisy.menuEverOpen).toBe(false);
        expect(noisy.inventoryEvents).toEqual([]);
    });
});

describe('⛓ PHASE B — the refusals, the game\'s strings where it has one', () => {
    it('botStart with no tape, a second botStart while armed, the version gate', () => {
        const rt = vanillaRuntime();
        expect(rt.game.botStart()).toBe('error:no tape loaded');
        expect(rt.game.botLoadTape(JSON.stringify(tapeOf('collide-up-rock')))).toBe('ok');
        expect(rt.game.botStart()).toBe('ok');
        expect(rt.game.botStart()).toBe('error:already running');
        expect(rt.game.botLoadTape(JSON.stringify({ ...tapeOf('collide-up-rock'), tape_version: 9 })))
            .toBe('error:tape_version must be 1, 2, 3, 4, 5, 6, 7, 8 or 12, got 9');
        expect(rt.game.botLoadTape('{')).toMatch(/^error:/);
    });

    it('a `hold` tape is refused BY NAME (a wasm build capability the JS runtime does not declare)', () => {
        const rt = vanillaRuntime();
        // the lab's own spelling of a held window (`holdingWindowTape`), projected as it ships
        const held = gameVisibleTape(holdingWindowTape(parseTape(tapeOf('collide-up-rock'))));
        expect(held).toMatchObject({ tape_version: 12, hold: true });
        expect(rt.game.botLoadTape(JSON.stringify(held))).toBe(JS_TAPE_REFUSALS.hold);
        expect(JSON.parse(rt.game.botStatus())).toMatchObject({ loaded: false, armed: false, finished: false });
    });

    it('a RELAXED tape (friction-stop, noclip) plays AS DECLARED — the model\'s world, not solveStaging\'s', () => {
        const raw = tapeOf('friction-stop');
        const model = runTape(raw, { levelSource: levelSourceFromAtlas(MAP) });
        const { loaded, status, drained } = playTape(vanillaRuntime(), raw);
        expect(loaded).toBe('ok');
        expect(status.finished).toBe(true);
        expect(diffObservationStreams({ ticks: model.ticks, transitions: model.transitions },
            gameStreamFromDrain(drained).stream)).toBeNull();
    });
});
