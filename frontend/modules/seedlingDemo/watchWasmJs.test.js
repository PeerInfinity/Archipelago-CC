/**
 * seedlingDemo/watchWasmJs.test.js — LAB L3: the ship's stage machine over BOTH transports.
 *
 * `shipToWasm` and `shipToJs` are one function (`watchWasm.shipToFrame`) with a transport name. These rows drive it
 * end to end in node over a FAKE FRAME per transport — a fake `__swfBridge` whose callbacks appear only when the
 * test (the "person") presses Start — and pin:
 *   · the JS transport's stage order (`probe runtime start [levels] spot play`), and that it shares the wasm
 *     transport's head (probe → runtime → start → levels, the same refusal names) unchanged;
 *   · the spot's queue items, exactly (`spotItemsOf` over `games/seedling.json`): inventory first, the teleport last;
 *   · the two laws, as MUTANTS that must fail: a parent that presses ▶ Start, and a ship that skips the
 *     `botLevelSet` read-back.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLifetime } from '../procgenCore/pageLifetime.js';
import { labTouchShownInitially, LAB_TOUCH_STORAGE_KEY } from './watchTouchOption.js';
import {
    JS_STAGES, WASM_STAGES, atSpot, jsPageFor, shipToJs, shipToWasm, spotItemsOf, stagesOf,
} from './watchWasm.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(HERE, '../flashPanel/games/seedling.json'), 'utf8'));

/** A one-room set the way `buildLevelSet` shapes the parts the read-back reads. */
const SET = { set_id: 'test-set', rooms: [{ id: 0 }], start: { level: 0, x: 40, y: 40 } };
const CHUNKS = [{ set_id: 'test-set', chunk_index: 0, chunk_count: 1 }];

/**
 * ⛓ A FAKE FRAME. Pointing `src` at a page builds a fresh window; the bridge's callbacks appear only on `press()`,
 * which is the test playing the person (and `__swfBridgeStart` counts every call, so a parent that pressed is seen).
 * The JS game: `queueItems` applies the teleport (`new_instance`) and records the rest; `botStatus` reports the
 * player at the ctor + the half tile. The wasm game: `botLoadTape`/`botStart`/`botStatus`(finished)/`botDrain`.
 */
function fakeFrame({ transport, readback = null } = {}) {
    const frame = {
        style: {}, win: null, presses: 0, queued: [], listeners: [],
        addEventListener(type, fn) { this.listeners.push({ type, fn }); },
        removeEventListener() {},
        get contentWindow() { return this.win; },
    };
    let src = null;
    Object.defineProperty(frame, 'src', {
        get: () => src,
        set(v) {
            src = v;
            frame.win = v === 'about:blank' ? { blank: true } : makeWin();
        },
    });
    function makeWin() {
        let mounted = null;
        let at = { level: -1, x: null, y: null };
        const game = {
            wireCheck: () => 'ok',
            botStatus: () => JSON.stringify(transport === 'js'
                ? { runtime: 'js', ...at, ticks: 1 }
                : { level: 0, x: 88, y: 136, finished: true, tick: 0, items: {} }),
            botLoadLevels: (json) => { mounted = JSON.parse(json).set_id; return 'ok'; },
            botLevelSet: () => JSON.stringify(readback ?? {
                active: mounted, table_levels: mounted ? 1 : 0, start_level: mounted ? 0 : null,
            }),
            botLoadTape: () => 'ok',
            botStart: () => 'ok',
            botDrain: () => JSON.stringify({ ticks: [{ t: 0, level: 0, x: 88, y: 136 }], transitions: [] }),
        };
        const win = {
            __runtimeReady: true,
            __swfBridge: {
                game: {},
                queueItems(items) {
                    for (const it of items) {
                        frame.queued.push(it);
                        if (it.invocation === 'new_instance') {
                            const [level, x, y] = it.args;
                            at = level < 0 ? { level: 0, x: 48, y: 48 } : { level, x: x + 8, y: y + 8 };
                        }
                    }
                },
            },
            __swfBridgeStart() { frame.presses += 1; Object.assign(win.__swfBridge.game, game); },
            __seedlingJsSound: { readout: { state: 'running', cues: 0, music: { loaded: 'ready' } } },
        };
        frame.press = () => Object.assign(win.__swfBridge.game, game);
        return win;
    }
    return frame;
}

/** A readout that records every call — the vocabulary the page paints from. */
function recorder() {
    const log = [];
    return {
        log,
        onStage: (stage) => log.push(['stage', stage]),
        onRefusal: (stage, reason) => log.push(['refusal', stage, reason]),
        onTick: () => log.push(['tick']),
        onVerdict: () => log.push(['verdict']),
    };
}

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const serveAll = () => { globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) }); };

/** Ship, and press Start ONCE the ship is waiting there (as a person would) — never before. */
async function shipAndPress(ship, payload, frame, extra = {}, { press = true } = {}) {
    const lifetime = createLifetime(`test-${Math.random()}`);
    const readout = recorder();
    const p = ship(payload, { frame, lifetime, readout, gameConfig: CONFIG, ...extra });
    if (press) {
        const t0 = Date.now();
        while (!readout.log.some(([k, s]) => k === 'stage' && s === 'start') && Date.now() - t0 < 5000) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => { setTimeout(r, 50); });
        }
        frame.press();
    }
    const state = await p;
    const src = frame.src;
    lifetime.retire('test over');
    // ⛓ and a retired ship blanks its frame (the teardown both transports share); a probe refusal never touched it
    expect(frame.src).toBe(src === null ? null : 'about:blank');
    return { state, readout, src };
}

const TAPE = {
    tape_version: 11, boot: { level: 18, x: 16, y: 112 }, tick_count: 0, inputs: [],
    seam: { items: { hasSword: true, hasShield: false }, hits_max: 5, time: 4837 },
    save: { keys: [1, 3], seal_parts: [7], totem_parts: [2] },
};

describe('the JS transport\'s stage vocabulary', () => {
    it('is probe → runtime → start → [levels] → spot → play, and shares the wasm head', () => {
        expect(JS_STAGES).toEqual(['probe', 'runtime', 'start', 'levels', 'spot', 'play']);
        expect(stagesOf({ transport: 'js' })).toEqual(['probe', 'runtime', 'start', 'spot', 'play']);
        expect(stagesOf({ transport: 'js', levelSet: SET })).toEqual(JS_STAGES);
        expect(JS_STAGES.slice(0, 4)).toEqual(WASM_STAGES.slice(0, 4));
    });
    it('⛔ the wasm list is UNCHANGED — the default transport is wasm', () => {
        expect(stagesOf({})).toEqual(['probe', 'runtime', 'start', 'tape', 'running', 'finished', 'drain',
            'verdict']);
        expect(stagesOf({ levelSet: SET })).toEqual([...WASM_STAGES]);
    });
    it('the frame URL asks for Seedling art and the page\'s own ▶ Start', () => {
        expect(jsPageFor('')).toBe('jsRuntime.html?graphics=seedling&start=click');
        expect(jsPageFor('?jsCamera=follow')).toBe('jsRuntime.html?graphics=seedling&start=click&camera=follow');
        expect(jsPageFor('?jsCamera=x%26y')).toBe('jsRuntime.html?graphics=seedling&start=click');
    });
});

describe('the spot\'s queue items — exactly the host\'s shapes, off games/seedling.json', () => {
    it('inventory first (flags, hitsMax, keys, seal log, totem parts), preWrites, then new_instance Game', () => {
        const { items, spot, dropped } = spotItemsOf(TAPE, CONFIG);
        expect(spot).toEqual({ level: 18, x: 16, y: 112 });
        expect(items).toEqual([
            { class: 'Main', property: 'hasSword', value: true },
            { class: 'Main', property: 'hitsMax', value: 5 },
            { invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasKeySet', args: [1, true] },
            { invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasKeySet', args: [3, true] },
            { invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasSealPartSet', args: [0, 7] },
            { invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasTotemPartSet', args: [2, true] },
            { class: 'Game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [18, 16, 112] },
        ]);
        // ⚠ what the bridge cannot take is SAID
        expect(dropped).toEqual(['time']);
    });
    it('no tape = the set\'s start: level −1, the game\'s own new-game arm', () => {
        const { items, spot } = spotItemsOf(null, CONFIG);
        expect(spot.level).toBe(-1);
        expect(items.at(-1)).toEqual({ invocation: 'new_instance', className: 'Game', args: [-1, 0, 0] });
    });
    it('atSpot reads the player at the ctor + the half tile; a start spot takes the set\'s start level', () => {
        const spot = { level: 3, x: 16, y: 32 };
        expect(atSpot({ level: 3, x: 24, y: 40 }, spot)).toBe(true);
        expect(atSpot({ level: 3, x: 16, y: 32 }, spot)).toBe(false);
        expect(atSpot({ level: 2, x: 24, y: 40 }, spot)).toBe(false);
        expect(atSpot({ level: -1 }, { level: -1 })).toBe(false);
        expect(atSpot({ level: 5, x: 0, y: 0 }, { level: -1 }, 5)).toBe(true);
        expect(atSpot({ level: 4, x: 0, y: 0 }, { level: -1 }, 5)).toBe(false);
    });
});

describe('⛓⛓ one stage machine, two transports — driven over fake frames', () => {
    it('JS: a set ships through levels → spot → play, and the spot is the tape\'s boot', async () => {
        serveAll();
        const frame = fakeFrame({ transport: 'js' });
        const tape = { ...TAPE, boot: { level: 0, x: 40, y: 40 } };
        const { state, readout, src } = await shipAndPress(shipToJs,
            { levelSet: SET, chunks: CHUNKS, tape, label: 't' }, frame);
        expect(state.refusal).toBeNull();
        expect(state.reached).toEqual(JS_STAGES);
        expect(src).toBe('jsRuntime.html?graphics=seedling&start=click');
        expect(frame.presses).toBe(0);
        expect(state.readback.active).toBe('test-set');
        expect(state.spot.arrived).toEqual({ level: 0, x: 48, y: 48 });
        expect(state.sound.state).toBe('running');
        expect(frame.queued.at(-1)).toEqual({ invocation: 'new_instance', className: 'Game', args: [0, 40, 40] });
        expect(readout.log.filter(([k]) => k === 'verdict')).toEqual([]);
    });
    it('JS: no set → no levels stage', async () => {
        serveAll();
        const { state } = await shipAndPress(shipToJs, { tape: TAPE, label: 't' }, fakeFrame({ transport: 'js' }));
        expect(state.reached).toEqual(['probe', 'runtime', 'start', 'spot', 'play']);
    });
    it('wasm: the same head, then its own tail — unchanged', async () => {
        serveAll();
        const frame = fakeFrame({ transport: 'wasm' });
        const { state, src } = await shipAndPress(shipToWasm,
            { tape: { tape_version: 8, boot: { level: 0, x: 80, y: 128 }, tick_count: 0, inputs: [] }, label: 't' },
            frame, { wasmPage: 'game.html' });
        expect(state.refusal).toBeNull();
        expect(state.reached).toEqual(['probe', 'runtime', 'start', 'tape', 'running', 'finished', 'drain',
            'verdict']);
        expect(src).toBe('game.html');
        expect(frame.presses).toBe(0);
        expect(state.hold.capable).toBe(false);
    });
    it('the probe refusal is named per transport', async () => {
        globalThis.fetch = async () => ({ ok: false, status: 404 });
        const js = await shipAndPress(shipToJs, { tape: TAPE }, fakeFrame({ transport: 'js' }), {}, { press: false });
        expect(js.state.refusal).toMatchObject({ stage: 'probe', reason: 'js-page-missing' });
        const wasm = await shipAndPress(shipToWasm, { tape: TAPE }, fakeFrame({ transport: 'wasm' }),
            { wasmPage: 'game.html' }, { press: false });
        expect(wasm.state.refusal).toMatchObject({ stage: 'probe', reason: 'wasm-build-missing' });
    });
    it('JS: a read-back that disagrees is refused at levels, by the shared name', async () => {
        serveAll();
        const frame = fakeFrame({ transport: 'js', readback: { active: 'other', table_levels: 1, start_level: 0 } });
        const { state } = await shipAndPress(shipToJs, { levelSet: SET, chunks: CHUNKS, tape: TAPE }, frame);
        expect(state.refusal).toMatchObject({ stage: 'levels', reason: 'set-readback-disagrees' });
        expect(frame.queued).toEqual([]);
    });
    it('JS: no game config → refused at spot, by name', async () => {
        serveAll();
        const { state } = await shipAndPress(shipToJs, { tape: TAPE }, fakeFrame({ transport: 'js' }),
            { gameConfig: null });
        expect(state.refusal).toMatchObject({ stage: 'spot', reason: 'no-game-config' });
    });
});

/**
 * ⛔⛔ THE MUTANTS. Each is `watchWasm.js` with ONE edit, written beside it (so its relative imports resolve), run
 * through the same driver, and it must FAIL the property the real file has. Without these the rows above could pass
 * on a ship that never waited for anybody.
 */
describe('⛔ mutants: a parent that presses Start, a ship that skips the read-back', () => {
    const SRC = readFileSync(join(HERE, 'watchWasm.js'), 'utf8');
    async function withMutant(edit, fn) {
        const from = edit[0];
        expect(SRC.split(from).length).toBe(2);
        const path = join(HERE, `.mutant-watchWasm-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
        writeFileSync(path, SRC.replace(from, edit[1]));
        try {
            return await fn(await import(pathToFileURL(path).href));
        } finally {
            rmSync(path, { force: true });
        }
    }

    it('M-press: a parent that presses ▶ Start passes `start` with NO person — the real ship does not', async () => {
        serveAll();
        // the real ship, never pressed, times out at `start` (shortened through the fake: the until fuse is long, so
        // the row asserts it is STILL waiting after the mutant would have finished)
        const realFrame = fakeFrame({ transport: 'js' });
        const life = createLifetime('real-unpressed');
        const real = shipToJs({ tape: TAPE }, { frame: realFrame, lifetime: life, readout: recorder(),
            gameConfig: CONFIG });
        await new Promise((r) => { setTimeout(r, 1500); });
        life.retire('enough');
        const realState = await real;
        expect(realState.reached).not.toContain('start');
        expect(realFrame.presses).toBe(0);

        await withMutant([
            "    readout.onStage('start', 'waiting for ▶ Start inside the frame', state);",
            "    readout.onStage('start', 'waiting for ▶ Start inside the frame', state);\n"
                + '    win().__swfBridgeStart();',
        ], async (m) => {
            const frame = fakeFrame({ transport: 'js' });
            const { state } = await shipAndPress(m.shipToJs, { tape: TAPE }, frame, {}, { press: false });
            expect(frame.presses).toBe(1);
            expect(state.reached).toContain('play');
        });
    });

    it('M-readback: a ship that skips the read-back mounts a wrong set and PLAYS — the real one refuses', async () => {
        serveAll();
        const bad = { active: 'other', table_levels: 1, start_level: 0 };
        const real = await shipAndPress(shipToJs, { levelSet: SET, chunks: CHUNKS, tape: TAPE },
            fakeFrame({ transport: 'js', readback: bad }));
        expect(real.state.refusal?.reason).toBe('set-readback-disagrees');

        await withMutant([
            'const out = deliverChunks({ bot, chunks: list, set: levelSet });',
            "const out = (list.forEach((c) => bot('botLoadLevels', JSON.stringify(c))), { ok: true });",
        ], async (m) => {
            const { state } = await shipAndPress(m.shipToJs, { levelSet: SET, chunks: CHUNKS, tape: TAPE },
                fakeFrame({ transport: 'js', readback: bad }));
            expect(state.refusal).toBeNull();
            expect(state.reached).toContain('play');
        });
    });
});

/**
 * ⛓ LAB L3 × L1b — `#jsTouch` STARTS FROM THE LAB'S ONE OPTION. The stored `seedlingLab.touchControls` (auto / on /
 * off, MANUAL's select) decides the JS frame's controls box default, `?touch=` overriding as it does for MANUAL; the
 * box is a per-ship override and never writes the stored choice.
 */
describe('⛓ #jsTouch follows the lab\'s on-screen-controls option', () => {
    const VIEWER = readFileSync(join(HERE, 'watchViewer.js'), 'utf8');
    const memStorage = (stored) => {
        const m = new Map(stored == null ? [] : [[LAB_TOUCH_STORAGE_KEY, stored]]);
        return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
    };
    const shown = (stored, coarse, search = '') => labTouchShownInitially({
        storage: memStorage(stored), search, matchMediaFn: () => ({ matches: coarse }),
    });

    it('changing the stored option changes the default; ?touch= overrides it', () => {
        expect(shown('on', false)).toBe(true);
        expect(shown('off', true)).toBe(false);
        expect(shown('auto', true)).toBe(true);
        expect(shown('auto', false)).toBe(false);
        expect(shown(null, true)).toBe(true);
        expect(shown('off', false, '?touch=1')).toBe(true);
        expect(shown('on', true, '?touch=0')).toBe(false);
    });

    const body = (src) => src.slice(src.indexOf('async function mountJsTouch('), src.indexOf('let jsTouch = null;'));
    const pinned = (src) => /box\.checked = [^;]*labTouchShownInitially\(\{\s*storage: labStorage\(\), search: location\.search/
        .test(body(src)) && !/writeLabTouchSetting|setItem|touchControlsVisible\('auto'/.test(body(src));

    it('⛔ the page starts #jsTouch from the option and never writes it — mutants fail the pin', () => {
        expect(pinned(VIEWER)).toBe(true);
        const ownRule = VIEWER.replace(/labTouchShownInitially\(\{\s*storage: labStorage\(\), search: location\.search,/,
            "touchControlsVisible('auto', {");
        expect(ownRule).not.toBe(VIEWER);
        expect(pinned(ownRule)).toBe(false);
        const writes = VIEWER.replace("box.onchange = () => { box.dataset.touched = '1'; apply(); };",
            "box.onchange = () => { box.dataset.touched = '1'; writeLabTouchSetting(labStorage(), box.checked ? 'on' : 'off'); apply(); };");
        expect(writes).not.toBe(VIEWER);
        expect(pinned(writes)).toBe(false);
    });
});

/**
 * ⛓⛓ PHASE B — A JS REPLAY TAKES THE WASM TAIL, over a frame whose game is the REAL JS core (`createJsRuntime` on
 * the vanilla map, ticked on a timer once the person presses Start). The model stream is `watchOverlays.collectRun`'s,
 * the lab's own (`replayJsShipFor`), so the verdict read here is the one the lab paints: JS frame vs JS model.
 */
describe('⛓ PHASE B — ▶ load in JS on a REPLAY replays the tape to a per-tick verdict', () => {
    const ROOT = join(HERE, '../../..');
    const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    const tapeOf = (n) => JSON.parse(readFileSync(join(HERE, `fixtures/tapes/${n}.json`), 'utf8'));

    function realJsFrame(createJsRuntime) {
        const frame = { style: {}, win: null, presses: 0, listeners: [], timers: [],
            addEventListener(type, fn) { this.listeners.push({ type, fn }); }, removeEventListener() {},
            get contentWindow() { return this.win; } };
        let src = null;
        Object.defineProperty(frame, 'src', {
            get: () => src,
            set(v) {
                src = v;
                for (const t of frame.timers.splice(0)) clearInterval(t);
                if (v === 'about:blank') { frame.win = { blank: true }; return; }
                const rt = createJsRuntime();
                rt.game.configure(JSON.stringify({ classes: CONFIG.classes, state_properties: CONFIG.state_properties }));
                const win = { __runtimeReady: true, __swfBridge: { game: {}, queueItems: (i) => rt.queueItems(i) } };
                frame.press = () => {
                    rt.setVanilla(MAP);
                    Object.assign(win.__swfBridge.game, rt.game);
                    frame.timers.push(setInterval(() => rt.tick(new Set()), 2));
                };
                frame.win = win;
            },
        });
        return frame;
    }

    it('collide-up-rock: probe → runtime → start → tape → running → finished → drain → verdict, agreeing per tick', async () => {
        serveAll();
        const { createJsRuntime } = await import('./jsRuntimeCore.js');
        const { collectRun, modelStreamOf } = await import('./watchOverlays.js');
        const { levelSourceFromAtlas } = await import('./atlasSource.js');
        const { JS_REPLAY_STAGES } = await import('./watchWasm.js');
        const tape = tapeOf('collide-up-rock');
        const collected = collectRun(tape, levelSourceFromAtlas(MAP));
        expect(collected.error ?? null).toBeNull();
        const frame = realJsFrame(createJsRuntime);
        try {
            const { state } = await shipAndPress(shipToJs, {
                tape, label: 'collide-up-rock', replay: true, modelStream: modelStreamOf(collected),
            }, frame);
            expect(state.refusal).toBeNull();
            expect(state.reached).toEqual(JS_REPLAY_STAGES.filter((s) => s !== 'levels'));
            expect(state.drain).toEqual({ observations: tape.tick_count + 1, reportedTransitions: 0 });
            expect(state.verdict.perTick).toMatchObject({ kind: 'agrees', agrees: true });
        } finally {
            for (const t of frame.timers.splice(0)) clearInterval(t);
        }
    }, 30000);

    it('⛓ a JS replay of a SEQUENCE chains on ONE run: toy-west-pair, every window agreeing per tick, held between', async () => {
        serveAll();
        const { createJsRuntime } = await import('./jsRuntimeCore.js');
        const { levelSourceFromAtlas } = await import('./atlasSource.js');
        const { PAGE_CHAINS } = await import('./director.js');
        const { walkChainModel } = await import('./jsRuntimeSequence.js');
        const names = PAGE_CHAINS['toy-west-pair'];
        const tapes = names.map(tapeOf);
        const model = walkChainModel(tapes, levelSourceFromAtlas(MAP));
        expect(model.error).toBeNull();
        // the whole sequence's stream, `walkSequence`'s concatenation: each window's duplicated last frame dropped
        let off = 0;
        const whole = { ticks: [], transitions: [] };
        model.windows.forEach((w, k) => {
            const keep = k < model.windows.length - 1 ? w.modelStream.ticks.slice(0, -1) : w.modelStream.ticks;
            whole.ticks.push(...keep.map((o) => ({ ...o, t: o.t + off })));
            whole.transitions.push(...w.modelStream.transitions.map((t) => ({ ...t, t: t.t + off })));
            off += w.tickCount;
        });
        const frame = realJsFrame(createJsRuntime);
        try {
            const { state } = await shipAndPress(shipToJs, {
                replay: true, label: 'toy-west-pair', modelStream: whole,
                windows: tapes.map((tape, k) => ({ tape, label: names[k], modelStream: model.windows[k].modelStream })),
            }, frame);
            expect(state.refusal).toBeNull();
            expect(state.hold).toMatchObject({ capable: true });
            expect(state.reached).toEqual(stagesOf({ windows: 2, transport: 'js', replay: true }));
            expect(state.reached).toContain('boundary 1/2');
            expect(state.windows.map((w) => w.hold)).toEqual([true, false]);
            expect(state.windows.map((w) => w.heldAtFinish)).toEqual([true, false]);
            // the boundary's live world is the frame's own latch, and the window was ADMITTED on it
            expect(state.windows[1].live).toMatchObject({ level: tapes[1].boot.level,
                ctor: { x: tapes[1].boot.x, y: tapes[1].boot.y } });
            for (const w of state.windows) expect(w.verdict.perTick).toMatchObject({ kind: 'agrees', agrees: true });
            expect(state.verdict.perTick).toMatchObject({ kind: 'agrees', agrees: true });
            expect(state.drain.observations).toBe(tapes[0].tick_count + tapes[1].tick_count + 1);
        } finally {
            for (const t of frame.timers.splice(0)) clearInterval(t);
        }
    }, 30000);

    it('⛔ a live JS ship (no `replay`) is Phase A, unchanged: spot → play', () => {
        expect(stagesOf({ transport: 'js' })).toEqual(['probe', 'runtime', 'start', 'spot', 'play']);
        expect(stagesOf({ transport: 'js', replay: true })).toEqual(['probe', 'runtime', 'start', 'tape', 'running',
            'finished', 'drain', 'verdict']);
    });
});
