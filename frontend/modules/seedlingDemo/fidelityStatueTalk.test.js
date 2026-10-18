/**
 * ⛓ fidelity DASHSTEP — A STATUE'S TALK CIRCLE IS 32 PX (`contactFidelity.statueTalkRange`).
 *
 *     NPC.as:27        talkRange = 24        Statue.as:25   talkRange = 32
 *     NPC.as:190-226   an X release (keys[6], the SWORD key) inside the circle opens the dialogue;
 *                      `Game.freezeObjects` holds the player from the next update
 *
 * The game witness, `fixtures/statue-talk/leg7-l0-statue2.json`: hammer's dash flip's sweep leg 7 (run 39005482173,
 * `level_0__r8c0 <- in_L1_64_112 -> location:L0 flag 1: breakablerock@288,176 cleared`), re-recorded headless on p4f
 * (fidelity DASHSTEP D1). The 247-t plan dashes at t99; the release lands at t100 31.79 px from `statue2@184,160`
 * (entity at 208,160), and the game freezes the player at t102: x 180.153, vx 2.90, both unchanged. The model with
 * the switch OFF tests 24 and walks on (x 182.803 at t102, the sweep's own row).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayCapture } from '../../../scripts/procgen/replay-seedling-contact-capture.mjs';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { CLASS_TALK_RANGE, STATUE_TALK_RANGE, TALK_RANGE, talkRangeOf } from './endingChain.js';
import { atlasLevelSource } from './levelSource.js';
import { talkGuard } from './strikePolicy.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAP = JSON.parse(readFileSync(join(HERE, 'fixtures', 'statue-talk', 'leg7-l0-statue2.json'), 'utf8'));
const W79 = JSON.parse(readFileSync(join(HERE, 'fixtures', 'statue-talk', 'survey-step-79-off.json'), 'utf8'));

describe('fidelity DASHSTEP — the statue talk circle', () => {
    // ⛓ shipped OFF (DASHSTEP D2); ON by default since planning-9's flip (⚖ user "Harvest, then flip it ON").
    it('ships ON', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.statueTalkRange).toBe(true);
    });

    it('reads the class field: 32 for both statue types ON, 24 OFF and for every other talker', () => {
        expect(STATUE_TALK_RANGE).toBe(32);
        expect(Object.keys(CLASS_TALK_RANGE).sort()).toEqual(['statue1', 'statue2']);
        withContactFidelity({ statueTalkRange: true }, () => {
            expect(talkRangeOf('statue1')).toBe(32);
            expect(talkRangeOf('statue2')).toBe(32);
            expect(talkRangeOf('sign')).toBe(TALK_RANGE);
        });
        withContactFidelity({ statueTalkRange: false }, () => {
            expect(talkRangeOf('statue2')).toBe(TALK_RANGE);
        });
    });

    it('ON: the model reproduces the game witness at 0 px, the freeze at t102 included', async () => {
        const r = await withContactFidelity({ statueTalkRange: true }, () => replayCapture(CAP));
        expect(r.error).toBeNull();
        expect(r.compared).toBe(106);
        expect(r.firstDiff).toBeNull();
        expect(r.worst).toBe(0);
        const at = (t) => r.model.find((m) => m.t === t);
        expect(at(102).x).toBe(at(101).x);
        expect(at(102).vx).toBe(at(101).vx);
    });

    it('OFF (the control): the model leaves the game at t102, the sweep row', async () => {
        const r = await withContactFidelity({ statueTalkRange: false }, () => replayCapture(CAP));
        expect(r.firstDiff.t).toBe(102);
        const x = r.firstDiff.fields.find((f) => f.field === 'x');
        expect(x.game).toBeCloseTo(180.15326210481476, 9);
        expect(x.model).toBeCloseTo(182.80326210481476, 9);
    });

    /**
     * The second game witness, `fixtures/statue-talk/survey-step-79-off.json`: route survey step 79's 199-t walk as
     * the solver planned it with the switch OFF. It releases X at t141, 29.45 px from the same statue; the game holds
     * the player at x 237.699 from t143.
     */
    it('ON: the model plays survey step 79\'s OFF walk as the game does; OFF parts at t143', () => {
        const replay = (on) => withContactFidelity({ statueTalkRange: on }, () => {
            const st = createTapeStepper(parseTape(JSON.stringify(W79.walk)), { levelSource: atlasLevelSource() });
            const col = [];
            for (let r = st.next(); !r.done; r = st.next()) col[r.value.observation.t] = r.value.observation;
            return col;
        });
        const parted = (col) => W79.game.filter(([t, level, x, y]) => !col[t] || col[t].level !== level
            || col[t].x !== x || col[t].y !== y).map(([t]) => t);
        expect(Math.max(...W79.game.map(([t]) => t))).toBeGreaterThan(143);
        expect(parted(replay(true))).toEqual([]);
        expect(parted(replay(false))[0]).toBe(143);
    });

    it("the release guard prices the circle's own radius (the t99 press of the witness)", () => {
        const state = { x: 174.10326210481475, y: 151.93239718961377, vx: 1.4, vy: 0 };
        const circle = { id: 'statue2@184,160', tag: 'statue2', ex: 208, ey: 160 };
        expect(talkGuard(state, [circle], 1)).toBeNull();
        const g = talkGuard(state, [{ ...circle, talkRange: 32 }], 1);
        expect(g.id).toBe('statue2@184,160');
        expect(g.talkRange).toBe(32);
    });
});
