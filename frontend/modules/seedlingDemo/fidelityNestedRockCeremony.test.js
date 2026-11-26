/**
 * ⛓⛓ SEEDLING FIDELITY NESTEDFREEZE (wave 57) — a pickup ceremony that starts INSIDE a button-dropped rock's span, on
 * its frame A (`CONTACT_FIDELITY.nestedRockCeremony`, OFF byte-identical).
 *
 *     Puzzlements/Button.as:27-39   the press, from the post-(A−1) box, no freeze gate; `fall()` raises the flag
 *     Scenery/FallRock.as:64-109    the wait (60), the fall, the landing (camera 90) and the release R at A+172 (L29)
 *     Pickups/Pickup.as:57-112      the collide (no freeze gate), `pick_up` re-raising the flag after the rock every
 *                                   frame, the NPC at A+149, the text-less `!myText` arm lowering it on A+150
 *     Game.as:1044-1051             `inventory.open = false`: a dialogue frame's flag is lowered at its end
 *     Game.as:2330-2353             the pickups either side of the button, the rock last; `addUpdate` prepends
 *
 * The union: phase A's 149 dead frames ARE the rock's span frames A+1..A+149 (it lands on span frame 81 inside them);
 * a texted pickup's dialogue frames follow with the rock's camera timer counting down (its R moves the camera only); a
 * text-less one lowers the flag on A+150 and ends the union early. So the union's dead frames are the ceremony's 150,
 * not 172 + 150, and the player takes no rock release step. ON the frame-A tick falls through as the ceremony's
 * contact tick and the rock is stepped alone; every family sees the union as that ceremony — checked per tick against
 * the same walk with the button removed (the same ceremony, no rock).
 *
 * Every row is STAGED (`.oel` rows appended to a cloned L29): no room the game ships has the shape.
 * ⚠ Not game-witnessed: every ON row. Report: `CC/docs/cloud-reports/seedling-fidelity-nestedfreeze.md`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { createLevelRun } from './levelRun.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { ROCKBUTTON_WITNESS_DIR } from './fidelityRockButton.js';

const KEY = 'nestedRockCeremony';
/** The neighbouring keys of waves 50 to 56 (and the Owl's), for the composition rows. */
const ALL = { freezeSpanUpdates: true, freezeReleaseTick: true, freezeEdgeFrames: true, frozenTickUngated: true,
    pickupTickFreeze: true, dialogueFrameFreeze: true, turretSuitRetaliation: true, owlContactInStep: true };
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
/** A feather (texted; `Game.as:2332`, after the button) and L29's own green key (text-less; `:2348`, before it). */
const TEXTED = (y) => ({ type: 'feather', x: 112, y, attrs: { tag: '5' } });
const TEXTLESS = (y) => ({ type: 'bosskey', x: 112, y, attrs: { keyType: '1' } });
/** A second turret, beside L29's own `turret@80,176`. */
const TURRET = { type: 'turret', x: 40, y: 40 };

function stagedSource(inject, remove) {
    if (inject.length === 0 && remove.length === 0) return atlasLevelSource();
    const atlas = structuredClone(loadAtlas());
    const L = atlas.levels.find((l) => l.level === 29);
    L.entities = L.entities.filter((e) => !remove.includes(e.type)).concat(inject);
    return levelSourceFromAtlas(atlas);
}

/**
 * L29 from (112,160) walking up onto `button@112,128` (frame A is the advance at tick 24); from advance `talkFrom` the
 * talk key is tapped. Per tick: the clock, the player, the turrets and the bombs; plus the ledgers, or the throw.
 */
function run({ inject = [], remove = [], ticks = 50, talkFrom = 26 }, over = {}) {
    return withContactFidelity(over, () => {
        const r = createLevelRun({ levelSource: stagedSource(inject, remove), boot: { level: 29, x: 112, y: 160 },
            seam: { time: 900 }, roles: ROLES, pins: ['sound', 'dead_frames'] });
        const rows = [];
        let thrown = null;
        try {
            for (let k = 0; k < ticks; k += 1) {
                r.advance(new Set(k >= talkFrom ? (k % 2 === 1 ? ['primary'] : []) : ['up']));
                rows.push({ t: k + 1, time: r.gameTime, p: [r.state.x, r.state.y], shooters: r.shooters,
                    bombs: r.bombs });
            }
        } catch (e) {
            thrown = e.message;
        }
        return {
            thrown, rows,
            starts: r.ceremonyStarts.map((c) => [c.t, c.tag]),
            collected: r.collected.map((c) => [c.t, c.item ?? c.keyType]),
            falls: r.rockFalls.map((f) => ({ ...f, flag: undefined })),
            spans: r.deadFrameSpans.map((s) => [s.t, s.kind ?? s.what, s.frames]),
            dead: r.deadFramesOwed,
            spits: r.spitEvents.length,
        };
    });
}
const atTick = (r, t) => r.rows.find((row) => row.t === t);
const ROCK = 'fallrock@112,112';
const OFF_FALL = { id: ROCK, level: 29, t: 25, deadFrames: 172, flag: undefined };
const nested = (tag) => ({ id: ROCK, level: 29, t: 24, deadFrames: 0, spanFrames: 172, landedAt: 81, nestedIn: tag,
    flag: undefined });
/** The per-tick picture a family row compares (the clock, the player, the turrets, the bombs). */
const picture = (r) => r.rows.map((row) => JSON.stringify(row));

describe('NESTEDFREEZE — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_NESTED_ROCK_CEREMONY)(
        'ships OFF, appended last, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            // ⛓ wave 59 (PLAINSPAN) appended `plainPickupInFreeze` after it.
            expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(-2)).toEqual([KEY, 'plainPickupInFreeze']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_NESTED_ROCK_CEREMONY');
        });
});

describe('NESTEDFREEZE — a pickup collected on a button\'s frame A (staged on L29)', () => {
    it('texted (a feather, after the button): OFF serialises 172 + 150; wave 56 refuses; ON the union is the ceremony\'s 150', () => {
        const s = { inject: [TEXTED(127)] };
        const off = run(s, { [KEY]: false });
        expect(off.thrown).toBe(null);
        expect(off.falls).toEqual([OFF_FALL]);
        expect(off.starts).toEqual([[25, 'feather']]);
        expect(off.spans.slice(1)).toEqual([[25, 'freeze', 172], [25, 'ceremony', 150]]);
        // wave 56's interim, unchanged with this key OFF
        expect(run(s, { freezeSpanUpdates: true, [KEY]: false }).thrown).toMatch(/^levelRun: a button-dropped fallrock at tick 24 .*INSIDE the rock's span/);
        const on = run(s, { [KEY]: true });
        expect(on.thrown).toBe(null);
        // T = A (the frame-A advance), the rock stepped alone inside phase A, no dead frame of its own
        expect(on.starts).toEqual([[24, 'feather']]);
        expect(on.falls).toEqual([nested('feather')]);
        expect(on.spans.slice(1)).toEqual([[24, 'ceremony', 150]]);
        expect(off.dead - on.dead).toBe(172);
        // the clock: 172 frames earlier from the union on, to the end
        expect(atTick(off, 30).time - atTick(on, 30).time).toBe(172);
        expect(atTick(off, 50).time - atTick(on, 50).time).toBe(172);
        // the end: the ceremony's R (the finishing tick, which steps the player), held at the post-(A−1) box until it
        expect(on.collected).toEqual([[41, 'feather']]);
        expect(atTick(on, 24).p).toEqual(atTick(on, 40).p);
        expect(atTick(on, 41).p).not.toEqual(atTick(on, 40).p);
        expect(atTick(off, 25).p[1]).toBeLessThan(atTick(on, 25).p[1]); // OFF's rock release step
        // replacing wave 56's refusal: with its key ON too, the union is modelled the same
        expect(run(s, { freezeSpanUpdates: true, [KEY]: true })).toEqual(on);
    });
    it('text-less (L29\'s green key, before the button): ON the union ends on A+150, the pickup\'s F+150 step', () => {
        const s = { inject: [TEXTLESS(127)], ticks: 40 };
        const off = run(s, { [KEY]: false });
        expect(off.thrown).toBe(null);
        expect(off.falls).toEqual([OFF_FALL]);
        expect(off.starts).toEqual([[25, 'bosskey']]);
        expect(off.collected).toEqual([[26, 1]]);
        const on = run(s, { [KEY]: true });
        expect(on.thrown).toBe(null);
        expect(on.starts).toEqual([[24, 'bosskey']]);
        expect(on.collected).toEqual([[25, 1]]);
        expect(on.falls).toEqual([nested('bosskey')]);
        expect(on.spans.slice(1)).toEqual([[24, 'ceremony', 150]]);
        expect(atTick(off, 40).time - atTick(on, 40).time).toBe(172);
        // the contact tick steps the player (F+150 is live below the pickup): no tick holds it
        expect(atTick(on, 25).p[1]).toBeLessThan(atTick(on, 24).p[1]);
        expect(run(s, { freezeSpanUpdates: true, [KEY]: true })).toEqual(on);
    });
    it('every family sees the union as the ceremony: per tick, ON = the same walk with the button removed', () => {
        for (const pickup of [TEXTED(127), TEXTLESS(127)]) {
            const inject = [pickup, TURRET];
            const on = run({ inject }, { [KEY]: true });
            const noRock = run({ inject, remove: ['button'] }, { [KEY]: true });
            const off = run({ inject }, { [KEY]: false });
            expect(on.thrown, pickup.type).toBe(null);
            expect(noRock.starts, pickup.type).toEqual(on.starts);
            expect(noRock.falls, pickup.type).toEqual([]);
            expect(picture(on), pickup.type).toEqual(picture(noRock));
            expect(on.spits, pickup.type).toBe(noRock.spits);
            // and OFF's turrets take the rock's 172 frames on top
            expect(on.rows.filter((row, i) => JSON.stringify(row.shooters) !== JSON.stringify(off.rows[i].shooters))
                .length, pickup.type).toBeGreaterThan(0);
        }
    });
    it('composition: with waves 50 to 56\'s keys and the Owl\'s ON the union is the same, and = the no-rock ceremony', () => {
        for (const pickup of [TEXTED(127), TEXTLESS(127)]) {
            const inject = [pickup, TURRET];
            const solo = run({ inject }, { [KEY]: true });
            const all = run({ inject }, { ...ALL, [KEY]: true });
            expect(all.thrown, pickup.type).toBe(null);
            expect([all.starts, all.collected, all.falls, all.spans], pickup.type)
                .toEqual([solo.starts, solo.collected, solo.falls, solo.spans]);
            expect(picture(all), pickup.type).toEqual(picture(run({ inject, remove: ['button'] }, { ...ALL, [KEY]: true })));
            // and OFF under the same keys: wave 56's refusal at frame A
            expect(run({ inject }, { ...ALL, [KEY]: false }).thrown, pickup.type).toMatch(/INSIDE the rock's span/);
        }
    });
});

describe('NESTEDFREEZE — where nothing nests', () => {
    it('a pickup reached only by the release step (collected on R+1, the game\'s frame too): ON = OFF, the whole result', () => {
        const s = { inject: [TEXTED(126)] };
        expect(run(s, { [KEY]: true })).toEqual(run(s, { [KEY]: false }));
        expect(run(s, { ...ALL, [KEY]: true })).toEqual(run(s, { ...ALL, [KEY]: false }));
    });
    it('the button with no pickup: ON = OFF, the whole result', () => {
        const s = { inject: [TURRET] };
        expect(run(s, { [KEY]: true })).toEqual(run(s, { [KEY]: false }));
        expect(run(s, { ...ALL, [KEY]: true })).toEqual(run(s, { ...ALL, [KEY]: false }));
    });
    it('the rope rock (`rockbutton-l28-livefall`): a pull is `genericHit`, so no pickup nests in it — ON = OFF', () => {
        const fixture = JSON.parse(readFileSync(join(ROCKBUTTON_WITNESS_DIR, 'rockbutton-l28-livefall.json'), 'utf8'));
        const replay = (over) => withContactFidelity(over, () => {
            let rn = null;
            const st = createTapeStepper(parseTape(JSON.stringify(fixture.tape)), {
                levelSource: atlasLevelSource(), onTick: (t, s, h, r) => { rn = r; },
            });
            const stream = [];
            let r = st.next();
            while (!r.done) {
                if (rn) stream.push([rn.state.x, rn.state.y, rn.gameTime]);
                r = st.next();
            }
            return { stream, falls: rn.rockFalls.map((f) => [f.t, f.id, f.deadFrames]) };
        });
        const off = replay({ [KEY]: false });
        expect(off.falls).toEqual([[155, 'fallrock@112,240', 181]]);
        expect(replay({ [KEY]: true })).toEqual(off);
        expect(replay({ ...ALL, [KEY]: true })).toEqual(replay({ ...ALL, [KEY]: false }));
    });
});
