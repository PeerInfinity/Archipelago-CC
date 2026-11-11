/**
 * ⛓ seedling-lab-touch-fix — THE LAB'S ON-SCREEN CONTROLS: ONE STRIP, UNDER THE GAME BEING PLAYED.
 *
 * ⚖ The user, 2026-11-11 (a phone, the deployed site): *"In Manual mode, when I click Load in JS … on-screen controls
 * appear below the js canvas, and they work. No new controls appear when clicking load in wasm. There is also a set
 * of touchscreen controls above the js and wasm canvas that does nothing."*
 *
 * The browser rows (`check-seedling-lab-load-in-js.mjs`, TOUCH) drive it with real touch input; these pin the rule
 * and the wiring in Node:
 *   - `tapeHoldsFrame` over the ship's REAL stage lists (`watchWasm.stagesOf`): held until the LAST `finished…`;
 *   - MANUAL's strip stands down while a frame ship holds the frame, for BOTH transports;
 *   - the tape note is presentation only (no pointer-events, no swallowed event) and is driven from the readout's
 *     stage state, not a timer.
 * Each source pin has a mutant that must fail it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAME_TAPE_NOTE, tapeHoldsFrame } from './watchTouchOption.js';
import { stagesOf } from './watchWasm.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VIEWER = readFileSync(join(HERE, 'watchViewer.js'), 'utf8');
const between = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));

describe('⛓ tapeHoldsFrame — a tape holds the frame until its LAST finished stage', () => {
    const upTo = (stages, last) => ({ stages, reached: stages.slice(0, stages.indexOf(last) + 1) });

    it('a live JS ship (no tape) never holds', () => {
        const st = stagesOf({ transport: 'js' });
        for (const s of st) expect(tapeHoldsFrame(upTo(st, s))).toBe(false);
    });

    it('a JS REPLAY holds from probe through running, and lets go AT finished', () => {
        const st = stagesOf({ transport: 'js', replay: true });
        expect(st).toContain('finished');
        for (const s of st) {
            expect(tapeHoldsFrame(upTo(st, s))).toBe(st.indexOf(s) < st.indexOf('finished'));
        }
    });

    it('a wasm ship (a tape, even MANUAL\'s zero-input one) holds until finished', () => {
        const st = stagesOf({});
        expect(tapeHoldsFrame(upTo(st, 'running'))).toBe(true);
        expect(tapeHoldsFrame(upTo(st, 'finished'))).toBe(false);
    });

    it('a two-window SEQUENCE holds across the boundary — only the last window\'s finished lets go', () => {
        const st = stagesOf({ windows: 2 });
        expect(tapeHoldsFrame(upTo(st, 'finished 1/2'))).toBe(true);
        expect(tapeHoldsFrame(upTo(st, 'boundary 1/2'))).toBe(true);
        expect(tapeHoldsFrame(upTo(st, 'finished 2/2'))).toBe(false);
    });

    it('⛔ MUTANT: "the first finished" lets a sequence go at its boundary — the table catches it', () => {
        const first = (state) => {
            const f = state.stages.find((s) => /^finished\b/.test(s));
            return Boolean(f) && !state.reached.includes(f);
        };
        const st = stagesOf({ windows: 2 });
        expect(first(upTo(st, 'boundary 1/2'))).not.toBe(tapeHoldsFrame(upTo(st, 'boundary 1/2')));
    });

    it('the note says what the runtime does', () => {
        expect(FRAME_TAPE_NOTE).toBe('Replaying — the controls take over when the tape ends');
    });
});

describe('⛔ the page wires ONE strip at a time (pinned on watchViewer.js\'s source)', () => {
    const manualApply = (src) => between(src, 'async function mountManualTouch(', 'function labStorage(');
    const standsDown = (src) => /if \(!isDriving\(\) \|\| touchStrips\.frameShip\s*\|\|\s*!touchControlsVisible\(box\.value,/
        .test(manualApply(src));

    it('MANUAL\'s strip shows only while the run drives, and stands down while a frame ship holds the frame — '
        + 'mutants fail', () => {
        expect(standsDown(VIEWER)).toBe(true);
        for (const cut of ['touchStrips.frameShip\n            || ', '!isDriving() || ']) {
            const mutant = VIEWER.replace(cut, '');
            expect(mutant).not.toBe(VIEWER);
            expect(standsDown(mutant)).toBe(false);
        }
    });

    // ⚖ the user 2026-11-11: "those controls should only appear after pressing Start" — START, STOP and a refusal
    // each re-decide right after they move `driving`.
    const reDecides = (src) => {
        const run = between(src, 'async function runManual(', 'async function mountManualTouch(');
        return run.includes('await mountManualTouch(lifetime, keys, canvas, () => driving);')
            && /driving = true;\s*touchStrips\.manualApply\?\.\(\);/.test(run)
            && /keys\.release\('stop'\);[^]*?touchShown = [^;]*;\s*touchStrips\.manualApply\?\.\(\);/.test(run)
            && /driving = false;\s*touchStrips\.manualApply\?\.\(\);\s*\/\/ The run REFUSED/.test(run);
    };

    it('START mounts it, STOP and a refusal take it away — a mutant that forgets STOP fails', () => {
        expect(reDecides(VIEWER)).toBe(true);
        const mutant = VIEWER.replace(/(touchShown = [^;]*;)\s*touchStrips\.manualApply\?\.\(\);/, '$1');
        expect(mutant).not.toBe(VIEWER);
        expect(reDecides(mutant)).toBe(false);
    });

    const bothShipsMount = (src) => between(src, 'async function shipToWasmNow(', 'async function shipToJsNow(')
        .includes("mountFrameTouch(lifetime, 'wasm');")
        && between(src, 'async function shipToJsNow(', 'function seedlingGameConfig(')
            .includes("mountFrameTouch(lifetime, 'js');");

    it('BOTH ships mount the frame strip (the wasm one was missing) — mutant fails', () => {
        expect(bothShipsMount(VIEWER)).toBe(true);
        const mutant = VIEWER.replace("    mountFrameTouch(lifetime, 'wasm');\n", '');
        expect(mutant).not.toBe(VIEWER);
        expect(bothShipsMount(mutant)).toBe(false);
    });

    // the CODE of the mount and its tape painter (`setFrameTape`), not the doc comment between them
    const frameBody = (src) => between(src, 'async function mountFrameTouch(', '\n/**\n * ⛓⛓ WHILE A TAPE DRIVES')
        + between(src, 'let frameTapeHolds = false;', 'let frameTouch = null;');
    const presentationOnly = (src) => {
        const b = frameBody(src);
        return b.includes('mounted.setButtons(transport);')
            && !/pointer-events|pointerEvents|stopPropagation|preventDefault|inert\b/.test(b);
    };

    it('the tape note is PRESENTATION ONLY — a mutant that swallows presses fails', () => {
        expect(presentationOnly(VIEWER)).toBe(true);
        const mutant = VIEWER.replace("mounted.element.dataset.labTape = 'replaying';",
            "mounted.element.dataset.labTape = 'replaying'; mounted.element.style.pointerEvents = 'none';");
        expect(mutant).not.toBe(VIEWER);
        expect(presentationOnly(mutant)).toBe(false);
    });

    const fromStages = (src) => between(src, 'function shipReadout(', 'async function shipToWasmNow(')
        .includes('setFrameTape(tapeHoldsFrame(state));');

    it('the note follows the readout\'s STAGE state (the bridge\'s finished), never a timer — mutant fails', () => {
        expect(fromStages(VIEWER)).toBe(true);
        expect(between(VIEWER, 'let frameTapeHolds = false;', 'let frameTouch = null;')).not.toMatch(/setTimeout|setInterval/);
        const mutant = VIEWER.replace('setFrameTape(tapeHoldsFrame(state));',
            "setFrameTape(stage !== 'play');");
        expect(mutant).not.toBe(VIEWER);
        expect(fromStages(mutant)).toBe(false);
    });
});
