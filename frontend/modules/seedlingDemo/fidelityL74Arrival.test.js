/**
 * fidelity L74ARRIVAL — A BUTTON UNDER A ROOM ARRIVAL PRESSES ON THE WORLD'S FIRST LIVE FRAME
 * (`CONTACT_FIDELITY.arrivalButtonArm`, OFF by default).
 *
 *     Button.as:27-39       update(): collideTypesInto(["Player","Enemy","Solid"], x, y, v) … activate = tempCheck
 *     FallRock.as:103-109   fall(): … trigger = true; Game.freezeObjects = true; waitToFallTimer = 60
 *
 * The game's `Button.update` runs before `Player.update` and collides the cell the player was BUILT in, so on the first
 * live frame after a load the L74 button under the L73 door's landing drops `fallrock@288,144` and the player is frozen
 * on that frame. The model armed a button only from a post-move box, one tick late. Game witnesses (p4f headless,
 * `probe-seedling-chaser-mobiles.mjs --class=LavaRunner --player-hits --record`, recorded with the switch ON):
 *   - `l74arrival-624-on-plan`: leg 624's solved plan BOOTED on the button (L74LEG624's `game-l74-624-on-plan`), 332 t;
 *   - `l74arrival-door-l73`: L73 booted at leg 622's staging, `up` through `teleporter@64,0` — a DOOR arrival at t4,
 *     the game frozen at t5;
 *   - `fixtures/contact-witness/589.json`: the sweep's capture of the same arrival (t0–t2).
 *
 * ⛓ fidelity SMALLGAPS D1 — THE TAPE TICK IS THE `Bot`'S, AND A FREEZE FRAME IS NOT ONE (`buttonFallReleaseStep`).
 * `Bot.update` counts every `Game.freezeObjects` frame DEAD and observes at the top of the first live frame after it,
 * so the freeze's release step (the rock clears the flag above the Player) lands BEFORE the next observation: the
 * `Bot`'s own observations of leg 624's tape read 136, 135.2, 133.85 — no stall (`botDrain`, the same p4f run). Both
 * witnesses above were first recorded from the probe's FIRST poll at each tick, 20 frames into the 175-frame freeze
 * (y 136 at t1 / t5); re-recorded at the `Bot`'s observation point, exactly that one sample each moved to 135.2.
 * Release ON reads 0 px with either arm; `arrivalButtonArm` still decides WHICH tick is the frozen one (a press there
 * is lost: `useItem` is inside the gated `mobileUpdate`). The 589 capture samples like the old probe (t1 at 136).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayCapture } from '../../../scripts/procgen/replay-seedling-contact-capture.mjs';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const levelSource = atlasLevelSource();
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${n}.json`), 'utf8'));
const W624 = witness('l74arrival-624-on-plan');
const WDOOR = witness('l74arrival-door-l73');
const WPOST = witness('l74leg624-postfall-reentry');
const WL29 = witness('smallgaps-l29-button-walk');
const CAP589 = JSON.parse(readFileSync(join(HERE, 'fixtures', 'contact-witness', '589.json'), 'utf8'));

/** The model's observations of a witness's tape, by tick. */
const replay = (w) => {
    const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource });
    const col = [];
    let r = st.next();
    while (!r.done) {
        col[r.value.observation.t] = r.value.observation;
        r = st.next();
    }
    return col;
};
/** The sampled ticks where the model's player is not the game's, to the bit (`release`: `buttonFallReleaseStep`). */
const parted = (w, arm, release = false) => withContactFidelity({ arrivalButtonArm: arm, buttonFallReleaseStep: release }, () => {
    const col = replay(w);
    return w.samples.filter((s) => !col[s.t] || col[s.t].x !== s.player.x || col[s.t].y !== s.player.y
        || col[s.t].level !== s.level).map((s) => s.t);
});

describe('L74ARRIVAL — the switch', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.arrivalButtonArm).toBe(false);
    });
    // ⚖ (user, 2026-10-14) the release step is ON since the wave-16 harvest; the arm stays OFF.
    it('SMALLGAPS D1: the release step ships ON', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.buttonFallReleaseStep).toBe(true);
    });
});

describe('L74ARRIVAL D1 — a boot on button@288,128 freezes on its first live frame', () => {
    it('the witness: L74 booted on the button, 332 samples, NO stall at the `Bot`\'s ticks (136, 135.2, 133.85)', () => {
        expect(W624.samples.length).toBe(332);
        expect(W624.tape.boot).toEqual({ level: 74, x: 288, y: 128 });
        const y = (t) => W624.samples.find((s) => s.t === t).player.y;
        expect([y(0), y(1), y(2)]).toEqual([136, 135.2, 133.85]);
    });
    it('SMALLGAPS D1 — the release step ON: every sample at 0 px, with the arm ON or OFF', () => {
        expect(parted(W624, true, true)).toEqual([]);
        expect(parted(W624, false, true)).toEqual([]);
    });
    it('the arm alone stands t1, the defaults stand t2 — each one tick, and each re-converges', () => {
        expect(parted(W624, true)).toEqual([1]);
        expect(parted(W624, false)).toEqual([2]);
    });
    it('the sweep\'s capture of leg 589 (the same arrival): ON 0 px, OFF parts at t1 on y/vy', async () => {
        const on = await withContactFidelity({ arrivalButtonArm: true, buttonFallReleaseStep: false }, () => replayCapture(CAP589));
        expect(on.error).toBeNull();
        expect(on.compared).toBe(3);
        expect(on.firstDiff).toBeNull();
        const off = await withContactFidelity({ arrivalButtonArm: false, buttonFallReleaseStep: false }, () => replayCapture(CAP589));
        expect(off.firstDiff?.t).toBe(1);
        expect(off.firstDiff.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'y', game: 136, model: 135.2 })]));
    });
    it('SMALLGAPS D1: the capture samples INSIDE the freeze — release ON parts it at t1 (136 vs the `Bot`\'s 135.2)', async () => {
        const r = await withContactFidelity({ arrivalButtonArm: true, buttonFallReleaseStep: true }, () => replayCapture(CAP589));
        expect(r.error).toBeNull();
        expect(r.firstDiff?.t).toBe(1);
        expect(r.firstDiff.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'y', game: 136, model: 135.2 })]));
        expect(W624.samples.find((s) => s.t === 1).player.y).toBe(135.2);
    });
    it('a boot onto the FALLEN rock\'s room ({74,2} staged) has nothing to drop: 0 px either way', () => {
        expect(parted(WPOST, true)).toEqual([]);
        expect(parted(WPOST, false)).toEqual([]);
        expect(parted(WPOST, true, true)).toEqual([]);
    });
});

describe('L74ARRIVAL D2 — a DOOR arrival onto the button (L73 → L74) freezes on the destination\'s first live frame', () => {
    it('the witness: the door at t4, NO stall at the `Bot`\'s ticks (136, 135.2, 133.85 at t4–t6)', () => {
        expect(WDOOR.samples.length).toBe(131);
        const at = (t) => WDOOR.samples.find((s) => s.t === t);
        expect([at(3).level, at(4).level]).toEqual([73, 74]);
        expect([at(4).player.y, at(5).player.y, at(6).player.y]).toEqual([136, 135.2, 133.85]);
    });
    it('SMALLGAPS D1 — the release step ON: every sample at 0 px (the L73 forced hit at t2 included), arm ON or OFF', () => {
        expect(parted(WDOOR, true, true)).toEqual([]);
        expect(parted(WDOOR, false, true)).toEqual([]);
    });
    it('the arm alone stands t5, the defaults stand t6', () => {
        expect(parted(WDOOR, true)).toEqual([5]);
        expect(parted(WDOOR, false)).toEqual([6]);
    });
});

describe('SMALLGAPS D1 — a MID-ROOM press (L29 button@112,128, `fallRockButton.test.js`\'s walkNorth(120, 60))', () => {
    it('the witness: the game does not stand after the press (t10 140.85, t11 139.35)', () => {
        expect(WL29.samples.length).toBe(61);
        const y = (t) => WL29.samples.find((s) => s.t === t).player.y;
        [140.85, 139.35, 138.1].forEach((v, i) => expect(y(10 + i)).toBeCloseTo(v, 9));
    });
    it('release ON: every sample at 0 px; OFF the deferred step stands t11 (the stall `fallRockButton` pins)', () => {
        expect(parted(WL29, false, true)).toEqual([]);
        expect(parted(WL29, false)).toEqual([11]);
    });
});
