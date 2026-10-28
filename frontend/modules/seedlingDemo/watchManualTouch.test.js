/**
 * watchManual × touchControls — the lab page's MANUAL on-screen controls (slice `seedling-lab-touch-controls`).
 *
 * ⛓ ONE INPUT PATH. A tap on the d-pad must reach the run exactly as the keyboard does: the same physical `code`,
 * the same `driving` gate, the same held set, the same tape. These rows drive the flash panel's REAL pointer core
 * (`createTouchKeyBridge`, over Seedling's REAL `touch_controls` block) into the page's ONE writer
 * (`createManualKeys` via `touchSendFor`), and compare against the same presses made through `keys.key` — the call
 * the page's keyboard listener makes.
 *
 * The browser row (`scripts/procgen/check-seedling-editor-manual.mjs`, the TOUCH row) proves the page's path to it:
 * the mount under the canvas, real pointer events, STOP's release.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createManualKeys, createManualSession, foldRoundTrip, touchSendFor } from './watchManual.js';
import {
    createTouchKeyBridge, DPAD_DIRECTIONS, dpadDirectionKeys, parseTouchLayout,
} from '../flashPanel/touchControls.js';
import { parseTape } from './tapeFormat.js';
import { stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (...p) => JSON.parse(readFileSync(join(HERE, ...p), 'utf8'));
const LAYOUT = parseTouchLayout(readJson('..', 'flashPanel', 'games', 'seedling.json').touch_controls);
const VIEWER = readFileSync(join(HERE, 'watchViewer.js'), 'utf8');

/**
 * The flash panel's pointer core over Seedling's layout, with each zone at its own x (the DOM binder's geometry is
 * the panel's to test; here a zone is "the thing at x = n"). Buttons limited to another transport are left out, as
 * `setButtons('js')` hides them.
 */
function touchRig(keys) {
    const at = new Map();
    const zones = [];
    const dirKeys = dpadDirectionKeys(LAYOUT.dpad);
    for (const dir of DPAD_DIRECTIONS) zones.push({ id: `dpad-${dir}`, keys: dirKeys[dir] });
    for (const b of LAYOUT.buttons) {
        if (b.transports && !b.transports.includes('js')) continue;
        zones.push({ id: `button-${b.id}`, keys: b.keys });
    }
    zones.forEach((z, i) => { at.set(z.id, i); z.hitTest = (x) => x === i; });
    const bridge = createTouchKeyBridge({ zones, send: touchSendFor(keys) });
    keys.attach(bridge);
    return { bridge, x: (id) => at.get(id) };
}

const sorted = (it) => [...it].sort();

describe('⛓ a touch press IS a keyboard press — the same held codes', () => {
    it('every d-pad direction and every js button holds what its keys hold on the keyboard', () => {
        let driving = true;
        const touch = createManualKeys({ isDriving: () => driving });
        const board = createManualKeys({ isDriving: () => driving });
        const { bridge, x } = touchRig(touch);
        const cases = [
            ['dpad-right', ['ArrowRight']], ['dpad-up', ['ArrowUp']], ['dpad-left', ['ArrowLeft']],
            ['dpad-down', ['ArrowDown']], ['dpad-downright', ['ArrowDown', 'ArrowRight']],
            ['dpad-upleft', ['ArrowUp', 'ArrowLeft']],
            ['button-primary', ['KeyX']], ['button-secondary', ['KeyC']], ['button-inventory', ['KeyV']],
        ];
        for (const [zone, codes] of cases) {
            bridge.down(1, x(zone), 0);
            for (const c of codes) board.key(true, c);
            expect(sorted(touch.codes()), zone).toEqual(sorted(board.codes()));
            expect(sorted(touch.held()), zone).toEqual(sorted(board.held()));
            bridge.up(1);
            for (const c of codes) board.key(false, c);
            expect(touch.codes(), `${zone} released`).toEqual([]);
        }
        expect(driving).toBe(true);
    });

    it('two thumbs: a d-pad slide and a held button, released independently', () => {
        const keys = createManualKeys({ isDriving: () => true });
        const { bridge, x } = touchRig(keys);
        bridge.down(1, x('dpad-left'), 0);
        bridge.down(2, x('button-primary'), 0);
        expect(sorted(keys.held())).toEqual(['left', 'primary']);
        bridge.move(1, x('dpad-right'), 0);
        expect(sorted(keys.held())).toEqual(['primary', 'right']);
        bridge.up(2);
        expect(sorted(keys.held())).toEqual(['right']);
    });

    it('⛔ the SAME driving gate: a tap while stopped presses nothing', () => {
        let driving = false;
        const keys = createManualKeys({ isDriving: () => driving });
        const { bridge, x } = touchRig(keys);
        bridge.down(1, x('dpad-right'), 0);
        expect(keys.codes()).toEqual([]);
        expect(keys.key(true, 'ArrowRight')).toBe(false);
        bridge.up(1);
        driving = true;
        expect(keys.key(true, 'KeyQ')).toBe(false); // unbound: the keyboard's refusal, shared
        bridge.down(1, x('dpad-up'), 0);
        expect(keys.codes()).toEqual(['ArrowUp']);
    });

    it('⛔ the held set has ONE door — `codes()` is a copy, not the set', () => {
        const keys = createManualKeys({ isDriving: () => true });
        keys.key(true, 'ArrowRight');
        const leaked = keys.codes();
        leaked.push('KeyX');
        expect(keys.codes()).toEqual(['ArrowRight']);
        expect(sorted(keys.held())).toEqual(['right']);
    });
});

describe('⛔ release — STOP, an arm switch, blur and a hidden page leave nothing held', () => {
    for (const why of ['stop', 'retire', 'blur', 'hidden', 'pagehide']) {
        it(`release('${why}') lets go of the keyboard AND a finger still on the controls`, () => {
            const keys = createManualKeys({ isDriving: () => true });
            const { bridge, x } = touchRig(keys);
            keys.key(true, 'KeyC');
            bridge.down(1, x('dpad-downleft'), 0);
            bridge.down(2, x('button-primary'), 0);
            expect(keys.codes()).toHaveLength(4);
            keys.release(why);
            expect(keys.codes()).toEqual([]);
            expect(bridge.held()).toEqual([]);
            expect(bridge.activeCount()).toBe(0);
            expect(keys.lastRelease()).toBe(why);
            // the finger's later lift is no-op: nothing comes back held
            bridge.up(1);
            expect(keys.codes()).toEqual([]);
        });
    }

    it('a detached control is no longer released (unmounted controls are not kept alive)', () => {
        const keys = createManualKeys({ isDriving: () => true });
        let released = 0;
        const detach = keys.attach({ releaseAll: () => { released += 1; } });
        keys.release('stop');
        detach();
        keys.release('stop');
        expect(released).toBe(1);
    });
});

describe('⛓⛓ a touch-built tape EQUALS the keyboard-built tape (foldRoundTrip)', () => {
    const levelSource = atlasLevelSource();
    const staging = () => stagingFromTape(parseTape(readJson('fixtures', 'tapes', 'r8-solve-4.json')));
    /** [touch events, keyboard events, ticks]: the same presses, spelled each way. */
    const script = [
        [[['down', 1, 'dpad-right']], [['down', 'ArrowRight']], 30],
        [[['up', 1]], [['up', 'ArrowRight']], 5],
        [[['down', 1, 'dpad-down']], [['down', 'ArrowDown']], 25],
        [[['down', 2, 'button-primary']], [['down', 'KeyX']], 3],
        [[['up', 2], ['up', 1]], [['up', 'KeyX'], ['up', 'ArrowDown']], 4],
        [[['down', 1, 'dpad-downleft']], [['down', 'ArrowDown'], ['down', 'ArrowLeft']], 6],
        [[['move', 1, 'dpad-left']], [['up', 'ArrowDown']], 12],
        [[['up', 1], ['down', 2, 'button-primary']], [['up', 'ArrowLeft'], ['down', 'KeyX']], 2],
        [[['up', 2], ['down', 1, 'dpad-up']], [['up', 'KeyX'], ['down', 'ArrowUp']], 22],
        [[['up', 1]], [['up', 'ArrowUp']], 6],
    ];

    function driveBy(spelling) {
        const keys = createManualKeys({ isDriving: () => true });
        const { bridge, x } = touchRig(keys);
        const s = createManualSession({ levelSource, staging: staging(), name: 'touch-row' });
        for (const [touch, board, ticks] of script) {
            if (spelling === 'touch') {
                for (const [op, id, zone] of touch) {
                    if (op === 'up') bridge.up(id); else bridge[op](id, x(zone), 0);
                }
            } else {
                for (const [op, code] of board) keys.key(op === 'down', code);
            }
            // the page's own tick: `heldFor(keys.held())`, then `step`
            for (let i = 0; i < ticks; i += 1) s.step(s.heldFor(keys.held(), { autoAdvanceText: true }).held);
        }
        return s;
    }

    it('the same presses fold to byte-identical tapes, and the touch tape round-trips', () => {
        const touch = driveBy('touch');
        const board = driveBy('keyboard');
        expect(touch.tick).toBe(115);
        const tTrip = foldRoundTrip(touch, levelSource);
        const kTrip = foldRoundTrip(board, levelSource);
        expect(tTrip.mismatches).toEqual([]);
        expect(tTrip.ok).toBe(true);
        expect(JSON.stringify(tTrip.tape)).toBe(JSON.stringify(kTrip.tape));
        // and the drive really pressed things (a tape of nothing would match trivially)
        expect(tTrip.tape.inputs.length).toBeGreaterThan(4);
    });
});

describe('⛔ the PAGE wires it that way (pinned on `watchViewer.js`\'s source)', () => {
    const manual = VIEWER.slice(VIEWER.indexOf('async function runManual('),
        VIEWER.indexOf('const manualRow = (k, v) =>'));

    it('the touch `send` is `touchSendFor(keys)` — no second writer of the held set', () => {
        expect(manual).toContain('send: touchSendFor(keys)');
        // the keyboard listener presses through the same writer
        expect(manual).toMatch(/const onKey = \(down\) => \(e\) => \{\s*if \(keys\.key\(down, e\.code\)\)/);
        // ⛔ and nothing in MANUAL keeps a held set of its own
        expect(manual).not.toMatch(/\.add\((e|k)\??\.code\)/);
        expect(manual).not.toMatch(/const codes = new Set/);
        expect((manual.match(/createManualKeys\(/g) ?? []).length).toBe(1);
    });

    it('STOP, blur, a hidden page, pagehide and retire each call the one release', () => {
        const stop = manual.slice(manual.indexOf("$('manualStop').onclick"));
        expect(stop.slice(0, stop.indexOf('foldRoundTrip('))).toContain("keys.release('stop')");
        for (const why of ['blur', 'hidden', 'pagehide', 'retire']) {
            expect(manual, why).toContain(`keys.release('${why}')`);
        }
        // the mount is attached to `keys` and torn down on retire
        expect(manual).toContain('keys.attach(mounted)');
        expect(manual).toContain('lifetime.onRetire(unmount)');
    });
});
