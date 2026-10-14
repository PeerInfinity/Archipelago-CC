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
/** The sampled ticks where the model's player is not the game's, to the bit. */
const parted = (w, arm) => withContactFidelity({ arrivalButtonArm: arm }, () => {
    const col = replay(w);
    return w.samples.filter((s) => !col[s.t] || col[s.t].x !== s.player.x || col[s.t].y !== s.player.y
        || col[s.t].level !== s.level).map((s) => s.t);
});

describe('L74ARRIVAL — the switch', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.arrivalButtonArm).toBe(false);
    });
});

describe('L74ARRIVAL D1 — a boot on button@288,128 freezes on its first live frame', () => {
    it('the witness: L74 booted on the button, 332 samples, the game frozen at t1', () => {
        expect(W624.samples.length).toBe(332);
        expect(W624.tape.boot).toEqual({ level: 74, x: 288, y: 128 });
        const y = (t) => W624.samples.find((s) => s.t === t).player.y;
        expect([y(0), y(1)]).toEqual([136, 136]);
        expect(y(2)).toBeLessThan(136);
    });
    it('ON: every sample at 0 px', () => {
        expect(parted(W624, true)).toEqual([]);
    });
    it('OFF: the control parts at t1–t2 only (Δy +0.8 / −1.35) and re-converges', () => {
        expect(parted(W624, false)).toEqual([1, 2]);
    });
    it('the sweep\'s capture of leg 589 (the same arrival): ON 0 px, OFF parts at t1 on y/vy', async () => {
        const on = await withContactFidelity({ arrivalButtonArm: true }, () => replayCapture(CAP589));
        expect(on.error).toBeNull();
        expect(on.compared).toBe(3);
        expect(on.firstDiff).toBeNull();
        const off = await withContactFidelity({ arrivalButtonArm: false }, () => replayCapture(CAP589));
        expect(off.firstDiff?.t).toBe(1);
        expect(off.firstDiff.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'y', game: 136, model: 135.2 })]));
    });
    it('a boot onto the FALLEN rock\'s room ({74,2} staged) has nothing to drop: 0 px either way', () => {
        expect(parted(WPOST, true)).toEqual([]);
        expect(parted(WPOST, false)).toEqual([]);
    });
});

describe('L74ARRIVAL D2 — a DOOR arrival onto the button (L73 → L74) freezes on the destination\'s first live frame', () => {
    it('the witness: the door at t4, the game frozen at t5', () => {
        expect(WDOOR.samples.length).toBe(131);
        const at = (t) => WDOOR.samples.find((s) => s.t === t);
        expect([at(3).level, at(4).level]).toEqual([73, 74]);
        expect([at(4).player.y, at(5).player.y]).toEqual([136, 136]);
        expect(at(6).player.y).toBeLessThan(136);
    });
    it('ON: every sample at 0 px, the L73 forced hit (t2) included', () => {
        expect(parted(WDOOR, true)).toEqual([]);
    });
    it('OFF: the control parts at t5–t6 only', () => {
        expect(parted(WDOOR, false)).toEqual([5, 6]);
    });
});
