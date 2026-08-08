/**
 * watcherL114.test — W-TALK's INTEGRATION STRATUM: a placed NPC's dialogue,
 * driven through `levelRun`.
 *
 * Region-atlas Phase 8, rung R6, slice 6c. `endingChain.test.js` is the
 * stratum below this one — it checks `stepNpcDialogue`'s two arms, the
 * circle and the seed's arithmetic in isolation. This file checks the three
 * things only the integration can say:
 *
 *   1. **the dialogue opens with NO KEY**, because `keyNeeded` is
 *      `!Game.checkPersistence(tag)` and a booted run's persistence is all
 *      `true` — a claim about the BOOT, which a pure function cannot make;
 *   2. **the freeze costs the tape nothing and the player everything** —
 *      the held movement key is inert for every frame of the dialogue but
 *      the first and the last, and `frozenFramesOwed` stays zero;
 *   3. **`{114,0}` reaches `earnedClears`**, which is the list the
 *      differential compares against the game's own `persistence_cleared`.
 *
 * ── ⛔⛔ AND ONE REFUSAL THAT IS EXERCISED HERE ON PURPOSE ────────────
 *
 * The Watcher holds a live `Seed` out for pages 9..19 and collecting it is
 * a SOFT-LOCK, not a lost pickup. `levelRun` refuses a stance that touches
 * it — and a refusal the shipped tape cannot reach is a check with no
 * witness (trap 101). So it is driven from a DELIBERATELY BAD BOOT below,
 * and the shipped stance keeps the positive witness (`watcherSeedLive`:
 * the box really was there, for 110 ticks, cleared by 6.2 px).
 */

import { describe, expect, it } from 'vitest';

import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import { WATCHER, watcherSeedBox } from './endingChain.js';
import { playerBoxAt } from './playerPhysicsV2.js';

const source = atlasLevelSource();

/** The shipped W-talk stance: tile (4,5)'s corner, so the spawn is (80,96). */
const BOOT = { level: 114, x: 72, y: 88 };
/** `watcher@72,72` -> `super(_x + Tile.w/2, _y + Tile.h/2)` -> (80,80). */
const WATCHER_ENTITY = { x: 80, y: 80 };

const newRun = (over = {}) => createLevelRun({
    levelSource: source,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    noDamage: false,
    grants: [],
    persistence: [],
    equips: [],
    pins: ['sound', 'dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    roles: ROLES,
    ...over,
});

/** The cadence the plan derives; two releases per page. */
const CADENCE = 5;
const FIRST_PRESS = 1;

/**
 * Drive `n` ticks holding `keys`, releasing X on the plan's schedule.
 *
 * ⚠ ADAPTIVE-FREE ON PURPOSE. The schedule is the same arithmetic
 * `plan-seedling-r6-wtalk.mjs` emits as spans, so a divergence between this
 * file and the tape is a divergence in ONE number rather than in two
 * drivers. (§12.9: a hand-rolled `drive()` is inclusive where a tape span is
 * half-open, so nothing here computes a span.)
 */
function drive(run, ticks, { keys = [], releases = Infinity } = {}) {
    const stream = [];
    for (let t = 0; t < ticks; t += 1) {
        const held = new Set(keys);
        const k = (t - FIRST_PRESS) / CADENCE;
        if (Number.isInteger(k) && k >= 0 && k < releases) held.add('primary');
        stream.push({
            t,
            x: run.state.x,
            y: run.state.y,
            page: run.watchers[0]?.page ?? null,
            talking: run.watchers[0]?.talking ?? null,
        });
        run.advance(held);
    }
    return stream;
}

describe('the roster and the geometry the window stands on', () => {
    it('L114 holds exactly one watcher, tagged, with the long text and frames=3', () => {
        const run = newRun();
        const ws = run.watchers;
        expect(ws).toHaveLength(1);
        expect(ws[0].id).toBe('watcher@72,72');
        expect(ws[0].persistTag).toBe(0);
        expect({ x: ws[0].x, y: ws[0].y }).toEqual(WATCHER_ENTITY);
        expect(ws[0].talkRange).toBe(24);
    });

    it('the shipped stance is INSIDE the circle and OUTSIDE the seed box', () => {
        const run = newRun();
        expect(run.state).toMatchObject({ x: 80, y: 96 });
        expect(run.watchers[0].inRange).toBe(true);
        expect(run.watchers[0].distance).toBe(16);
        // The box is the one `endingChain` derives through three offsets.
        expect(run.watchers[0].seedBox).toEqual(watcherSeedBox({ x: 72, y: 72 }));
        const box = playerBoxAt(80, 96);
        const seed = run.watchers[0].seedBox;
        // ⛓ It misses on BOTH axes, and the x miss is the durable one: the
        // seed box ends at x 75 and the player's begins at 78, whatever the
        // walk does to y.
        expect(box.x).toBeGreaterThanOrEqual(seed.right);
        expect(box.y).toBeGreaterThanOrEqual(seed.bottom);
    });
});

describe('the dialogue opens on PROXIMITY, with no key at all', () => {
    it('is already talking on the first tick, before any release edge', () => {
        const run = newRun();
        // Not one key is pressed here, and the tape's first release edge
        // would be at tick 2.
        const stream = drive(run, 4, { releases: 0 });
        expect(stream[0].talking).toBe(false);
        expect(stream[1].talking).toBe(true);
        expect(run.watchers[0].pages).toBe(20);
    });

    it('...because `keyNeeded` is false, which a PRE-CLEARED tag inverts', () => {
        // `Watcher.update` gates `super.update()` — and therefore `talk()` —
        // on `Game.checkPersistence(tag)`. A tape that declares the clear
        // (which is exactly what W-door boots with) gets an inert Watcher
        // that is still STANDING, because `Watcher.check()` is overridden
        // EMPTY and does not despawn it like every other tagged class.
        const run = newRun({
            persistence: [{ level: 114, tag: 0, note: 'the watcher, already talked to' }],
        });
        drive(run, 40);
        expect(run.watchers).toHaveLength(1);
        expect(run.watchers[0].cleared).toBe(true);
        expect(run.watchers[0].talking).toBe(false);
        expect(run.watcherTalks).toEqual([]);
        expect(run.earnedClears).toEqual([]);
    });
});

describe('the freeze: a dialogue frame is a TICK, and the player is pinned', () => {
    it('the held key moves the player on the OPENING frame and no other', () => {
        const run = newRun();
        const stream = drive(run, 60, { keys: ['up'], releases: 0 });
        // The opening frame is live: `NPC.talk` raises `Game.freezeObjects`
        // inside the `if (talking)` block, and on the frame `startTalking()`
        // runs that block was skipped.
        expect(stream[1].y).toBeLessThan(stream[0].y);
        const moved = [];
        for (let i = 2; i < stream.length; i += 1) {
            if (stream[i].y !== stream[i - 1].y) moved.push(i);
        }
        expect(moved).toEqual([]);
    });

    it('and the tape\'s tick counter runs through all of it — zero dead frames', () => {
        const run = newRun();
        drive(run, 120, { keys: ['up'], releases: 0 });
        expect(run.ticksCompleted).toBe(120);
        expect(run.frozenFramesOwed).toBe(0);
    });
});

describe('the twenty pages, and the `{114,0}` CLEAR they earn', () => {
    it('exhausts the text in 40 releases and writes the flag with cause `done`', () => {
        const run = newRun();
        drive(run, 260, { keys: ['up'] });
        expect(run.watcherTalks).toHaveLength(1);
        expect(run.watcherTalks[0]).toMatchObject({
            level: 114, id: 'watcher@72,72', cause: 'done', pages: 20, page: 20,
        });
        expect(run.watcherTalks[0].flag).toEqual({ level: 114, tag: 0, value: false });
    });

    it('...and it reaches `earnedClears`, which is what the differential reads', () => {
        const run = newRun();
        drive(run, 260, { keys: ['up'] });
        expect(run.earnedClears).toEqual([{ level: 114, tag: 0, by: 'watcher@72,72' }]);
    });

    it('one release fewer leaves the tag SET, still talking, on the last page', () => {
        const run = newRun();
        drive(run, 236, { keys: ['up'], releases: 39 });
        expect(run.watcherTalks).toEqual([]);
        expect(run.earnedClears).toEqual([]);
        expect(run.watchers[0]).toMatchObject({ talking: true, page: 19, cleared: false });
        // The control's whole shape: it ends INSIDE the circle.
        expect(run.watchers[0].inRange).toBe(true);
    });

    it('the freed player walks once the flag is written, and the tag stays clear', () => {
        const run = newRun();
        const stream = drive(run, 260, { keys: ['up'] });
        const write = run.watcherTalks[0].t;
        expect(stream[write].y).toBeLessThan(stream[write - 1].y);
        // …out of the circle, well after the write, and nothing more is
        // earned: `Watcher.update`'s gate has closed.
        expect(run.watchers[0].inRange).toBe(false);
        expect(run.watcherTalks).toHaveLength(1);
    });
});

describe('⛔⛔⛔ LEAVING THE RADIUS PAYS — AND IT IS ONE FRAME WIDE (trap 102, amended)', () => {
    /**
     * ⛔⛔⛔ §16.6 SAYS *"walking away mid-dialogue EARNS THE TAG"*, AND THE
     * WALK IT DESCRIBES DOES NOT EXIST.
     *
     * `NPC.talk()`'s `if (talking)` block raises `Game.freezeObjects` on its
     * FIRST line, above the key test and above the radius test, and the NPC
     * updates before the player (`Game.loadlevel` adds the watchers at
     * `:2237` and the Player at `:2092`; `World.addUpdate` PREPENDS). So from
     * the second frame of a dialogue onward `Mobile.mobileUpdate` returns
     * early and **the player cannot move at all** — there is no "mid-
     * dialogue" during which anyone can walk anywhere.
     *
     * ⇒ the out-of-range arm is reachable from exactly ONE frame: the one
     * the dialogue OPENS on, which is live because `startTalking()` runs
     * BELOW the block that raises the freeze. A stance that boots inside the
     * circle and steps outward on that single frame is out of range when the
     * next frame's `talk()` tests it — and the teardown runs `doneTalking()`.
     *
     * ⛓⛓⛓ AND THAT IS THE SHARPEST FORM OF THE TRAP, not a weaker one:
     * `{114,0}` — FinalDoor's second condition, the flag W-blood's hits gate
     * on, the ending's first ledger row — is earned in **two ticks, with
     * zero pages read and no key pressed at all.** A control built on
     * "walk out instead of finishing" would not merely pay the same flag; it
     * would pay it instantly.
     *
     * ⚠ THE BOOT IS AT DISTANCE EXACTLY 24, which is `<= talkRange` and so
     * in range, and the first step from rest is 0.80 px — enough, and only
     * just. Integers on both sides, so the boundary is not a float question.
     */
    it('a boot ON the circle, stepping out, writes {114,0} at tick 2 having read nothing', () => {
        // spawn (80,104): `FP.distance` to (80,80) is exactly 24.
        const run = newRun({ boot: { level: 114, x: 72, y: 96 } });
        expect(run.watchers[0].distance).toBe(24);
        expect(run.watchers[0].inRange).toBe(true);
        // Frame 0 opens the dialogue AND is live, so the held key moves.
        run.advance(new Set(['down']));
        expect(run.watchers[0].talking).toBe(true);
        expect(run.state.y).toBeCloseTo(104.8, 6);
        expect(run.watchers[0].inRange).toBe(false);
        expect(run.watcherTalks).toEqual([]);
        // Frame 1 is the radius teardown.
        run.advance(new Set(['down']));
        expect(run.watcherTalks).toHaveLength(1);
        expect(run.watcherTalks[0]).toMatchObject({ t: 2, cause: 'left', page: 0 });
        expect(run.watcherTalks[0].flag).toEqual({ level: 114, tag: 0, value: false });
        expect(run.earnedClears).toEqual([{ level: 114, tag: 0, by: 'watcher@72,72' }]);
    });

    it('...and from the shipped stance no walk exists at all — the freeze pins it', () => {
        // The same held key, 16 px in instead of 24. The player takes the
        // opening frame's step and never moves again, however long the tape
        // holds `down` and however far the exit is.
        const run = newRun();
        for (let t = 0; t < 200; t += 1) run.advance(new Set(['down']));
        expect(run.watchers[0].talking).toBe(true);
        expect(run.watchers[0].inRange).toBe(true);
        expect(run.state.y).toBeCloseTo(96.8, 6);
        expect(run.watcherTalks).toEqual([]);
    });
});

describe('⛔⛔⛔ the live Seed: the refusal, and its positive witness', () => {
    /**
     * `Watcher.update:68-74` adds `new Seed(x - 18, y - 8, false)` while
     * `myCurrentText` is in `[9,19]`. That Seed is `bloody = false, tree =
     * false`, so `Seed.update`'s `else` arm runs — `Game.cutscene[2] = true`
     * and a reboot into L114, which has no `seed` object to rebuild as the
     * tree — and `Game.as:956` then spawns the player `receiveInput = false;
     * visible = false; active = false` in EVERY later `Game`. The player is
     * inert for the rest of the page and it looks exactly like a dead bot.
     */
    it('a stance INSIDE the box is refused BY NAME, not silently collected', () => {
        // Spawn at (72,80): inside `[65,75) x [73,87)` and 8 px from the
        // Watcher, so the dialogue opens and reaches page 9.
        const run = newRun({ boot: { level: 114, x: 64, y: 72 } });
        expect(() => drive(run, 120, { keys: [] }))
            .toThrow(/LIVE SEED|SOFT-LOCK/);
    });

    it('the shipped stance clears it, and the box really was THERE', () => {
        const run = newRun();
        drive(run, 260, { keys: ['up'] });
        const live = run.watcherSeedLive;
        // The positive half. A refusal that never fires and a mechanism that
        // never happens print the same thing without this.
        expect(live.length).toBeGreaterThan(100);
        expect(live[0].page).toBe(WATCHER.seedIndexMin);
        expect(live[live.length - 1].page).toBe(WATCHER.seedIndexMax);
        const clearance = Math.min(...live.map((s) => Math.max(s.clearanceX, s.clearanceY)));
        expect(clearance).toBeGreaterThan(0);
    });
});
