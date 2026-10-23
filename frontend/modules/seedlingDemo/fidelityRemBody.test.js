/**
 * Seedling fidelity REMBODY (wave 27): a body removed this frame still blocks the bodies that update after it.
 *
 * `World.remove` (`net/flashpunk/World.as:118-124`) only queues the entity in `_remove`; `World.updateLists`
 * (`:895-911`) drains the queue after `World.update` has run every entity. So a chaser whose `Mobile.death` fade ends
 * in its own update (`FP.world.remove(this)`, `Mobile.as:68`) is still an "Enemy" to `collideTypes(solids, …)` for every
 * body that updates after it in that frame (`Bob.solids` and `LavaRunner.solids` carry "Enemy"). The model dropped it
 * at once. `CONTACT_FIDELITY.removedBodyBlocks` (OFF) keeps it a sibling wall for the rest of the frame, in
 * `stepChasersNow` and in its mirror `chaserForecastNow`.
 *
 * The witness is SKINSWING's (p4g, `fixtures/skinswing-witness/skinswing-l71-resite.json`): L71, the player at (80,208)
 * in FIGHT for 300 ticks. On t63 three dying lavarunners are removed; the game's `lavarunner@64,192` stays at y 203.303,
 * the model's (OFF) moves to 204.467. ON reproduces the whole tape at 0 px.
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 `stepChasersNow` never adds the removed body to `removedThisFrame`
 *        -> the ON row reds at t63 (the OFF divergence), the OFF row and the forecast row stay green.
 *   m2 the set is never cleared between frames (a corpse is a wall forever)
 *        -> the ON row reds after t63 (the survivor stays blocked by the removed bodies).
 *   m3 `chaserForecastNow`'s reader skips every removed body (the OFF reading)
 *        -> NOTHING here reds: the forecast removes no plain corpse (it never fades one), so its ON arm only reaches
 *           a BobSoldier corpse's or a bulb's removal, and no AP_1 witness has one beside a later sibling (named).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SKINSWING_WITNESS_DIR, compareSkinSwing, skinSwingModelSamples } from './fidelitySkinSwing.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const load = (name) => JSON.parse(readFileSync(join(SKINSWING_WITNESS_DIR, `${name}.json`), 'utf8'));
const ON = { removedBodyBlocks: true };
const OFF = { removedBodyBlocks: false };
const T63 = 't 63 lavarunner@64,192: game (89.99974125240814, 203.3031481193856) model '
    + '(89.99974125240814, 204.46697188284412)';

describe('fidelity REMBODY — the switch', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.removedBodyBlocks).toBe(false);
    });
});

describe('fidelity REMBODY — D1/D2: the L71 resite witness (p4g) against the model', () => {
    it('skinswing-l71-resite: ON = the game at 0 px for all 300 ticks; OFF leaves it at t63, the removal tick', async () => {
        const rec = load('skinswing-l71-resite');
        expect(rec.samples.length).toBe(300);
        // t62 → t63: three bodies are removed on the game
        expect([rec.samples[62].chasers.length, rec.samples[63].chasers.length]).toEqual([5, 2]);
        const on = await skinSwingModelSamples(rec.tape, ON);
        expect(on.error).toBeNull();
        expect(compareSkinSwing(rec.samples, on.samples)).toEqual([]);
        const off = await skinSwingModelSamples(rec.tape, OFF);
        expect(off.error).toBeNull();
        expect(compareSkinSwing(rec.samples, off.samples)[0]).toBe(T63);
    });

    it.each(['skinswing-l71-lavarunner', 'skinswing-l74-bulb', 'skinswing-l74-resite'])('%s: ON = OFF = the game at 0 px (no removal beside a later-updating body)', async (name) => {
        const rec = load(name);
        for (const arm of [ON, OFF]) {
            const m = await skinSwingModelSamples(rec.tape, arm);
            expect(m.error).toBeNull();
            expect(compareSkinSwing(rec.samples, m.samples)).toEqual([]);
        }
    });
});

describe('fidelity REMBODY — D2: the forecast mirror (`chaserForecastNow`) agrees with the live step on the removal tick', () => {
    // The forecast taken at t58 and stepped with the live player: on t63 its survivor stands where the live one does.
    const at63 = (arm) => withContactFidelity(arm, () => {
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(load('skinswing-l71-resite').tape)),
            { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (r.value.observation.t < 58) r = st.next();
        const fc = run.chaserForecast();
        let proj = null;
        for (let t = 59; t <= 63; t += 1) {
            proj = fc.step({ ...run.state });
            r = st.next();
        }
        const live = run.chasers.find((c) => c.id === 'lavarunner@64,192');
        const f = proj.find((c) => c.id === 'lavarunner@64,192');
        return { dx: Math.abs(f.x - live.x), dy: Math.abs(f.y - live.y) };
    });

    it('ON: the forecast\'s survivor is the live one at t63 (0 px)', () => {
        expect(at63(ON)).toEqual({ dx: 0, dy: 0 });
    });

    /**
     * OFF the two disagree, and it is the LIVE step that is wrong: the forecast never fades a cloned corpse (its destroy
     * branch only steps a BobSoldier's), so every corpse it holds stays a wall for the whole forecast — which on the
     * removal tick happens to be the game's answer. ON, the live step comes to it. (Past t63 the forecast's held
     * corpses are a forecast-side gap of their own: named in the REMBODY report, not this switch's.)
     */
    it('OFF: the live step moves the survivor 1.164 px past the forecast (which holds its corpses)', () => {
        expect(at63(OFF)).toEqual({ dx: 0, dy: 1.1638237634585096 });
    });
});
