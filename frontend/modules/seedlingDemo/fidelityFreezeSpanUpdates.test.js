/**
 * ⛓⛓ SEEDLING FIDELITY RELEASEPICKUP (wave 56) — the updates inside a freeze's dead span the model did not take
 * (`CONTACT_FIDELITY.freezeSpanUpdates`, OFF byte-identical).
 *
 *     Puzzlements/BeamTower.as:54-57  `if (Game.freezeObjects) return;` — the drift and the beam test stop
 *     net/flashpunk/World.as:58       `e._graphic.update()` runs outside it: the Spritemap and `animEnd` play on
 *     Pickups/Pickup.as:57-60,95-98   phase A: `pick_up()` re-raises the flag and counts `specialTimer` 150 → 0
 *     Pickups/Pickup.as:63-84         the collide test — outside `Mobile`'s freeze gate (`Mobile.as:31-41`)
 *     Scenery/FallRock.as:92-97       the rock's release frame R; `fall()` (`:103-109`) raises the flag
 *     Game.as:2297 / 2330-2353        the tower before the pickups before the rock; `addUpdate` prepends
 *
 * (1) The beam tower through a texted pickup's phase A: 149 frozen frames of its graphic, so with a `Game.time` its
 * anim is KNOWN after the ceremony (OFF the clock's jump makes it unknown and a tower room with a texted pickup
 * refuses). Claimed known only with `pickupTickFreeze`, `freezeEdgeFrames` and `freezeReleaseTick` ON, which step every
 * other frame of the ceremony exactly once.
 * (2) A pickup the game collects INSIDE a rock's span: the collide has no freeze gate, so a pickup under the player
 * at R was under it from the span's first frame and is collected there — not on R (the brief's premise, refuted
 * here). Its ceremony would then be nested in the rock's freeze, which the model does not hold: ON it is refused by
 * name (the interim) at the one span position the model never asked, a button's frame A.
 *
 * Every row is STAGED (`.oel` rows appended to a cloned atlas level): no room the game ships has either shape.
 * ⚠ Not game-witnessed: every ON row. Report: `CC/docs/cloud-reports/seedling-fidelity-releasepickup.md`.
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

const KEY = 'freezeSpanUpdates';
/** The three keys that step every other frame of a texted ceremony exactly once for the tower. */
const EXACT = { pickupTickFreeze: true, freezeEdgeFrames: true, freezeReleaseTick: true };
const ALL = { ...EXACT, frozenTickUngated: true, dialogueFrameFreeze: true, turretSuitRetaliation: true,
    owlContactInStep: true };
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const TEXTED = (x, y) => ({ type: 'feather', x, y, attrs: { tag: '5' } });
const TEXTLESS = (x, y) => ({ type: 'bosskey', x, y, attrs: { keyType: '1' } });
const TOWER = { type: 'beamtower', x: 112, y: 40, attrs: { direction: '0', rate: '1', speed: '1' } };

function stagedSource(level, inject, remove = []) {
    if (inject.length === 0 && remove.length === 0) return atlasLevelSource();
    const atlas = structuredClone(loadAtlas());
    const L = atlas.levels.find((l) => l.level === level);
    L.entities = L.entities.filter((e) => !remove.includes(e.type)).concat(inject);
    return levelSourceFromAtlas(atlas);
}

/**
 * Boot with a `Game.time` (`seam: {time: 900}`), hold `keys(k)` on advance k, run `ticks`. Per tick: the player, the
 * towers' stepped state (`machinesNow`); plus the ledgers, or the throw.
 */
function run({ level, x, y, inject = [], remove = [], ticks = 60, keys = () => [], clock = true }, over = {}) {
    return withContactFidelity(over, () => {
        const r = createLevelRun({ levelSource: stagedSource(level, inject, remove), boot: { level, x, y },
            seam: clock ? { time: 900 } : null, roles: ROLES, pins: ['sound', 'dead_frames'] });
        const rows = [];
        let thrown = null;
        try {
            for (let k = 0; k < ticks; k += 1) {
                r.advance(new Set(keys(k)));
                rows.push({ t: k + 1, p: [r.state.x, r.state.y],
                    towers: (r.machinesNow?.beamTowers ?? []).map((b) => [b.id, b.direction, b.anim, b.index, b.frame,
                        b.animKnown, b.yKnown, b.y]) });
            }
        } catch (e) {
            thrown = e.message;
        }
        return {
            thrown, rows,
            starts: r.ceremonyStarts.map((c) => [c.t, c.tag]),
            collected: r.collected.map((c) => [c.t, c.item]),
            falls: r.rockFalls.map((f) => [f.t, f.id, f.deadFrames]),
            beams: r.beamTowerTrace.filter((b) => b.beam).map((b) => b.t),
            hits: r.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
        };
    });
}
/** Tap the talk key (press, release) from advance 10: the feather's two-page text closes at t23. */
const TALK = (k) => (k > 8 && k % 2 === 1 ? ['primary'] : []);
/**
 * L29 + a beam tower (`direction` 0, `rate` 1, `speed` 1). The player walks up two ticks onto a feather in the tower's
 * right-hand beam lane (T at t3, the tower stepped twice before it), then taps the talk key: the close at t25.
 */
const TOWER_ROOM = { level: 29, x: 144, y: 36, inject: [TOWER, TEXTED(144, 28)], ticks: 70,
    keys: (k) => (k < 2 ? ['up'] : (k > 14 && k % 2 === 1 ? ['primary'] : [])) };
/** The same, booted ON the feather: T is the tower's first stepped tick (no step before it to test the clock against). */
const BOOT_ROOM = { level: 29, x: 144, y: 32, inject: [TOWER, TEXTED(144, 32)], keys: TALK, ticks: 60 };
const atTick = (r, t) => r.rows.find((row) => row.t === t);
/** The BOOT_ROOM tower after R's step, all three ON (beaming right, frame 2). */
const EXACT_AT_R = [0, 'right', 1, 2, true];
const JUMPED = /beam can reach at tick (\d+) in level 29, .*\(a `Game.time` that jumped/;

describe('RELEASEPICKUP — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_FREEZE_SPAN_UPDATES)(
        'ships OFF, appended last, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            // ⛓ wave 57 (NESTEDFREEZE) appended `nestedRockCeremony` after it, wave 59 (PLAINSPAN) `plainPickupInFreeze`. Wave 61 (CHESTCOVER) `chestCoverFencepost`.
            expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(-11)).toEqual([KEY, 'nestedRockCeremony', 'plainPickupInFreeze', 'chestCoverFencepost', 'presserRecursionHang', 'publishedButtonRoomSetter', 'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton', 'wandShotTrapBodies', 'wandShotEnemyBodies']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FREEZE_SPAN_UPDATES');
        });
});

describe('RELEASEPICKUP — the beam tower through a texted pickup\'s phase A (staged, with a Game.time)', () => {
    it('OFF the clock jumps at T and the tower refuses at R; ON (with the three) its anim is known and R bills the beam', () => {
        const off = run(TOWER_ROOM, { ...EXACT, [KEY]: false });
        const on = run(TOWER_ROOM, { ...EXACT, [KEY]: true });
        expect(off.thrown).toMatch(JUMPED);
        expect(off.thrown.match(JUMPED)[1]).toBe('25');
        expect(on.thrown).toBe(null);
        expect([off.starts, on.starts]).toEqual([[[2, 'feather']], [[2, 'feather']]]);
        expect(on.collected[0][0]).toBe(25);
        // the tower's state at R (the finishing tick, after R's unfrozen step), the anim known
        const [, dir, anim, index, frame, animKnown, yKnown] = atTick(on, 25).towers[0];
        expect([dir, anim, index, frame, animKnown, yKnown]).toEqual([0, 'sit', 0, 0, true, true]);
        // C's step left it beaming right (frame 2); R's step tests that beam and bills it
        expect(on.hits).toEqual([[25, 'beamtower', 'beamtower@112,40']]);
        // the first beams after R: the turn to "up" (frames 3/4) beams at t37
        expect(on.beams.filter((t) => t > 25).slice(0, 3)).toEqual([37, 38, 39]);
    });
    it('ON alone (or with any of the three OFF): the lump steps the anim but claims nothing — the same refusal', () => {
        const off = run(TOWER_ROOM, { [KEY]: false });
        expect(off.thrown).toMatch(JUMPED);
        expect(run(TOWER_ROOM, { [KEY]: true }).thrown).toBe(off.thrown);
        for (const drop of Object.keys(EXACT)) {
            const under = { ...EXACT, [drop]: false };
            const o = run(TOWER_ROOM, { ...under, [KEY]: false });
            expect(o.thrown, drop).toMatch(JUMPED);
            expect(run(TOWER_ROOM, { ...under, [KEY]: true }).thrown, drop).toBe(o.thrown);
        }
    });
    it('composition: all seven (waves 50 to 55, and the Owl\'s) ON give the same answer, and nothing refuses', () => {
        const solo = run(TOWER_ROOM, { ...EXACT, [KEY]: true });
        const all = run(TOWER_ROOM, { ...ALL, [KEY]: true });
        expect(all.thrown).toBe(null);
        expect(all.hits).toEqual(solo.hits);
        expect(all.beams).toEqual(solo.beams);
        expect(atTick(all, 25).towers).toEqual(atTick(solo, 25).towers);
        expect(run(TOWER_ROOM, { ...ALL, [KEY]: false }).thrown).toMatch(JUMPED);
    });
    it('T on the tower\'s first stepped tick: OFF (T and dialogue keys ON) claims an anim 150 frames stale; ON fixes or refuses', () => {
        const under = { pickupTickFreeze: true, freezeEdgeFrames: true };
        // OFF: no step before T, so the jump test cannot see phase A — no refusal, and no beam on the player
        const off = run(BOOT_ROOM, { ...under, [KEY]: false });
        expect(off.thrown).toBe(null);
        expect(off.hits).toEqual([]);
        expect(atTick(off, 23).towers[0].slice(1, 6)).toEqual([1, 'sit', 0, 0, true]);
        // ON without R's step: the lump marks it unknown, and the tower refuses at R+1 rather than guess
        const on = run(BOOT_ROOM, { ...under, [KEY]: true });
        expect(on.thrown).toMatch(/beam can reach at tick 24 in level 29/);
        // ON with all three: known, and R bills the beam
        const exact = run(BOOT_ROOM, { ...EXACT, [KEY]: true });
        expect(exact.thrown).toBe(null);
        expect(exact.hits).toEqual([[23, 'beamtower', 'beamtower@112,40']]);
        expect(atTick(exact, 23).towers[0].slice(1, 6)).toEqual(EXACT_AT_R);
        expect(EXACT_AT_R).not.toEqual([1, 'sit', 0, 0, true]);
    });
    it('a text-less pickup (L29\'s green key there) is not lumped: ON = OFF, the whole result, with the three ON', () => {
        const s = { ...TOWER_ROOM, inject: [TOWER, TEXTLESS(144, 28)], ticks: 30 };
        const off = run(s, { ...EXACT, [KEY]: false });
        expect(run(s, { ...EXACT, [KEY]: true })).toEqual(off);
    });
});

describe('RELEASEPICKUP — a pickup inside a rock\'s span (staged on L29\'s button)', () => {
    const UP = () => ['up'];
    const walk = (fy) => ({ level: 29, x: 112, y: 160, inject: [TEXTED(112, fy)], keys: UP, ticks: 40 });
    it('under the player at frame A: OFF its ceremony starts after the 172-frame span; ON refused by name there', () => {
        const off = run(walk(127), { [KEY]: false });
        const on = run(walk(127), { [KEY]: true });
        expect(off.thrown).toBe(null);
        expect(off.falls).toEqual([[25, 'fallrock@112,112', 172]]);
        expect(off.starts).toEqual([[25, 'feather']]);
        expect(on.thrown).toMatch(/^levelRun: a button-dropped fallrock at tick 24 in level 29 freezes the world with the player on feather@112,127\. .*INSIDE the rock's span/);
        expect(on.falls).toEqual([]);
        // the same refusal under all seven
        expect(run(walk(127), { ...ALL, [KEY]: true }).thrown).toBe(on.thrown);
    });
    it('reached only by the release step: collected on R+1 — the game\'s frame too — and ON = OFF, the whole result', () => {
        const off = run(walk(126), { [KEY]: false });
        expect(off.thrown).toBe(null);
        expect(off.falls).toEqual([[25, 'fallrock@112,112', 172]]);
        expect(off.starts).toEqual([[25, 'feather']]);
        expect(run(walk(126), { [KEY]: true })).toEqual(off);
        expect(run(walk(126), { ...ALL, [KEY]: true })).toEqual(run(walk(126), { ...ALL, [KEY]: false }));
    });
});

describe('RELEASEPICKUP — where it changes nothing', () => {
    it('the rope rock (`rockbutton-l28-livefall`): the span holds the pull tick\'s own position — ON = OFF', () => {
        const fixture = JSON.parse(readFileSync(join(ROCKBUTTON_WITNESS_DIR, 'rockbutton-l28-livefall.json'), 'utf8'));
        const replay = (over) => withContactFidelity(over, () => {
            let rn = null;
            const st = createTapeStepper(parseTape(JSON.stringify(fixture.tape)), {
                levelSource: atlasLevelSource(), onTick: (t, s, h, r) => { rn = r; },
            });
            const stream = [];
            let r = st.next();
            while (!r.done) {
                if (rn) stream.push([rn.state.x, rn.state.y]);
                r = st.next();
            }
            return { stream, falls: rn.rockFalls.map((f) => [f.t, f.id, f.deadFrames]) };
        });
        const off = replay({ [KEY]: false });
        expect(off.falls).toEqual([[155, 'fallrock@112,240', 181]]);
        expect(replay({ [KEY]: true })).toEqual(off);
        expect(replay({ ...ALL, [KEY]: true })).toEqual(replay({ ...ALL, [KEY]: false }));
    });
    it('no freeze (L29 + the tower, idle, no pickup): ON = OFF, the whole result', () => {
        const s = { level: 29, x: 144, y: 32, inject: [TOWER], ticks: 80 };
        expect(run(s, { [KEY]: true })).toEqual(run(s, { [KEY]: false }));
        expect(run(s, { ...ALL, [KEY]: true })).toEqual(run(s, { ...ALL, [KEY]: false }));
    });
});
