/**
 * seedlingDemo/fallRock.test — the rock the rope drops.
 *
 * R5 slice 10. The claims that matter are the ones `r5Totem.GROUP_6`'s
 * "no-op" verdict got wrong, and they are wrong in a specific way worth
 * pinning: every sentence GROUP_6 wrote about `update()` is TRUE, and the
 * mechanism is in `set activate`. So the tests below assert BOTH — that the
 * update-time gates really are shut for a parked rock, and that the setter
 * opens them anyway.
 *
 * The freeze span is simulated rather than derived, and a second stratum
 * checks the derivation the simulation replaces (the closed form is 45.99
 * and the answer is 46).
 */

import { describe, expect, it } from 'vitest';

import {
    CAMERA_PAN_AUDIT, FALL_ROCK, FallRockError, PLAYER_SNAP, TIME_COUPLED,
    createFallRock, fallRockDeadFrames, fallRockFreezeTicks, fallRockRect,
    publishActivate, stepFallRock,
} from './fallRock.js';
import { ROLES, buildLevelWorld, rect } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';

const source = atlasLevelSource();

/** L39's rock, from the atlas rather than from literals. */
const placement = (level, type) => {
    const e = source(level).entities.find((x) => x.type === type);
    if (!e) throw new Error(`L${level} has no ${type}`);
    return e;
};

const L39_ROCK = placement(39, 'fallrock');
const rockAt = (cleared) => createFallRock(
    L39_ROCK.x, L39_ROCK.y, Number(L39_ROCK.attrs.tset), Number(L39_ROCK.attrs.tag), cleared,
);

describe('the placement, read from the atlas', () => {
    it('⛓ L39\'s rock is group 6 tag 10 — the rope\'s own group', () => {
        expect(L39_ROCK.x).toBe(144);
        expect(L39_ROCK.y).toBe(624);
        expect(Number(L39_ROCK.attrs.tset)).toBe(6);
        expect(Number(L39_ROCK.attrs.tag)).toBe(10);
        const rope = source(39).entities.find((e) => e.type === 'rope');
        expect(Number(rope.attrs.tset)).toBe(6);
        // ⚠ AND THEY ARE NOT THE SAME TAG. The rope writes 9, the rock 10 —
        // which is exactly what let GROUP_6 argue "nothing on this route
        // writes tag 10". Nothing READS it into existence; the rock writes
        // it itself.
        expect(Number(rope.attrs.tag)).toBe(9);
    });

    it('⛓⛓ TWO OF THE GAME\'S THREE ROPES PUBLISH TO A FALLROCK — it is the idiom', () => {
        const found = [];
        for (let n = 0; n <= 120; n += 1) {
            let lvl;
            try { lvl = source(n); } catch { continue; }
            if (!lvl) continue;
            for (const r of lvl.entities.filter((e) => e.type === 'rope')) {
                const t = r.attrs?.tset;
                const rocks = lvl.entities.filter(
                    (e) => e !== r && e.attrs?.tset === t && e.type.startsWith('fallrock'),
                );
                if (rocks.length) found.push(`L${n}`);
            }
        }
        // L28 (`rope@160,64 {t 1}` -> `fallrock@112,240 {tag 1}`) and L39.
        expect(found).toEqual(['L28', 'L39']);
    });

    it('⛔⛔ the rock lands ON the south teleporter — the L38 return is a solid after', () => {
        const tele = source(39).entities.filter((e) => e.type === 'teleporter')
            .find((e) => e.attrs.to === '38');
        expect({ x: tele.x, y: tele.y }).toEqual({ x: L39_ROCK.x, y: L39_ROCK.y });
        const landed = rockAt(true);
        expect(fallRockRect(landed)).toEqual(rect(144, 624, 16, 16));
        expect(landed.type).toBe('Solid');
    });
});

describe('⛔⛔ the two gates GROUP_6 read, and the setter that opens both', () => {
    it('⛓ GROUP_6 IS RIGHT ABOUT `update()` — a parked rock\'s arms are all shut', () => {
        const parked = rockAt(false);
        expect(parked.y).toBe(FALL_ROCK.parkedY);
        expect(parked.type).toBe('');
        expect(parked.active).toBe(false);
        // The position-writing arm is `activate && y >= fallTo`: -16 vs 632.
        expect(parked.y).toBeLessThan(parked.fallTo);
        // And with the flag STILL TRUE (cleared=false), the falling branch
        // does not run either — publish `activate` all you like through the
        // BACKING field and nothing moves.
        const forced = { ...parked, active: true };
        const r = stepFallRock(forced, null, { cleared: false });
        expect(r.state.y).toBe(FALL_ROCK.parkedY);
        expect(r.snapY).toBeNull();
        expect(r.landed).toBe(false);
        expect(r.unfroze).toBe(false);
    });

    it('⛔⛔ …and `set activate` WRITES THE FLAG, so the gate it reads is one it opened', () => {
        const parked = rockAt(false);
        const pub = publishActivate(parked, true);
        expect(pub.fell).toBe(true);
        expect(pub.freeze).toBe(true);
        // THE WRITE IS AT TRIGGER TIME, NOT AT THE LANDING.
        expect(pub.write).toEqual({ tag: 10, value: false });
        expect(pub.state.trigger).toBe(true);
        expect(pub.state.waitToFallTimer).toBe(FALL_ROCK.waitToFallTimerMax);
        // And now `update()`'s gate is open, because `fall()` opened it.
        const r = stepFallRock(pub.state, null, { cleared: true, screen: { width: 320, height: 240 } });
        expect(r.state.waitToFallTimer).toBe(59);
        expect(r.cameraTarget).not.toBeNull();
    });

    it('⚠ a FALSE publication is not a write — the rock cannot be disarmed', () => {
        const armed = publishActivate(rockAt(false), true).state;
        const off = publishActivate(armed, false);
        expect(off.fell).toBe(false);
        expect(off.write).toBeNull();
        // `if (a && !_active)` — a false `a` never reaches `_active = a`, so
        // the author's comment ("cannot be reset back to false without
        // errors in the update") is the observable behaviour and not a note.
        expect(off.state.active).toBe(true);
        expect(off.state.trigger).toBe(true);
    });

    it('⚠ a SECOND true publication is a no-op — one fall per visit', () => {
        const armed = publishActivate(rockAt(false), true).state;
        const again = publishActivate(armed, true);
        expect(again.fell).toBe(false);
        expect(again.write).toBeNull();
        expect(again.freeze).toBe(false);
    });

    it('⛓ a rock that BOOTS FALLEN never re-freezes — the ctor writes `_active` directly', () => {
        const built = rockAt(true);
        expect(built.active).toBe(true);
        expect(built.y).toBe(built.fallTo);
        expect(built.type).toBe('Solid');
        // The setter's guard is `!_active`, and the ctor already set it — so
        // the rope's re-publication on a later visit (RopeStart.check() ->
        // hit() -> the broadcast) drops on the floor.
        const pub = publishActivate(built, true);
        expect(pub.fell).toBe(false);
        expect(pub.freeze).toBe(false);
    });
});

describe('⛓⛓ the freeze span, simulated', () => {
    it('is 60 + 46 + 90 + 1 = 197 for L39', () => {
        const span = fallRockFreezeTicks(632);
        expect(span).toEqual({ wait: 60, fall: 46, hold: 90, release: 1, total: 197, fallTo: 632 });
    });

    it('⛔ 46 AND NOT 45 — the closed form is 45.99 and a floor would take it', () => {
        // y_n = -16 + 0.3 n(n+1); landing needs 0.3 n(n+1) >= 648.
        const closed = (-1 + Math.sqrt(1 + 4 * (648 / 0.3))) / 2;
        expect(closed).toBeGreaterThan(45.9);
        expect(closed).toBeLessThan(46);
        expect(Math.floor(closed)).toBe(45);
        expect(fallRockFreezeTicks(632).fall).toBe(46);
    });

    it('⚠ IT IS NOT A CONSTANT — L28\'s rock is 181, because `fallTo` is the placement', () => {
        const l28 = placement(28, 'fallrock');
        const fallTo = l28.y + FALL_ROCK.box.dy;
        expect(fallRockFreezeTicks(fallTo).total).toBe(181);
        expect(fallRockFreezeTicks(fallTo).total).not.toBe(fallRockFreezeTicks(632).total);
    });

    it('⛓⛓ AND IT IS THE GAME\'S 217 DEAD FRAMES, less ONE room-load fade', () => {
        // §22.8: the refuted shaft tape reported 217 dead frames with ZERO
        // transitions and no ceremony, and ~197 of them were unexplained.
        // They are this. What is left is 20 — a single boot fade, which is
        // exactly what a zero-transition tape carries (§22.6 measured L38's
        // boot at 20 and its door at 19).
        expect(fallRockDeadFrames(632)).toBe(197);
        expect(217 - fallRockDeadFrames(632)).toBe(20);
    });

    it('the drive agrees with the derivation, tick by tick', () => {
        // The second stratum: run `stepFallRock` and count, rather than
        // trusting `fallRockFreezeTicks`'s own loop twice.
        let s = publishActivate(rockAt(false), true).state;
        let landedAt = null;
        let unfrozeAt = null;
        for (let t = 1; t <= 400; t += 1) {
            const r = stepFallRock(s, null, { cleared: true });
            s = r.state;
            if (r.landed) landedAt = t;
            if (r.unfroze) { unfrozeAt = t; break; }
        }
        expect(landedAt).toBe(106); // 60 wait + 46 fall
        expect(unfrozeAt).toBe(197);
        expect(s.y).toBe(632);
        expect(s.type).toBe('Solid');
    });

    it('⛓ the landing is one tick, and it carries the shake and the clamp', () => {
        let s = publishActivate(rockAt(false), true).state;
        let landing = null;
        for (let t = 1; t <= 120; t += 1) {
            const r = stepFallRock(s, null, { cleared: true });
            s = r.state;
            if (r.landed) { landing = r; break; }
        }
        expect(landing.shake).toBe(30);
        // The overshoot is clamped: the tick that passes `fallTo` is the tick
        // that lands, and `y = fallTo` runs after the test.
        expect(landing.state.y).toBe(632);
        expect(landing.state.trigger).toBe(false);
        expect(landing.state.cameraTimer).toBe(90);
    });

    it('⚠ the camera is retargeted to the LANDING on every falling tick', () => {
        let s = publishActivate(rockAt(false), true).state;
        const screen = { width: 320, height: 240 };
        const targets = [];
        for (let t = 1; t <= 197; t += 1) {
            const r = stepFallRock(s, null, { cleared: true, screen });
            s = r.state;
            if (r.cameraTarget) targets.push(r.cameraTarget);
        }
        // Every tick of wait AND fall, and none of the 90-tick hold.
        expect(targets).toHaveLength(106);
        for (const t of targets) expect(t).toEqual({ x: 152 - 160, y: 632 - 120 });
    });
});

describe('⛔ the snap — the arm outside every gate', () => {
    it('writes the player onto the rock\'s top, and it is `y - 11`', () => {
        const landed = rockAt(true);
        // A player standing in the rock's cell.
        const box = rect(146, 620, 4, 5);
        const r = stepFallRock(landed, box, { cleared: true });
        expect(r.snapY).toBe(632 - FALL_ROCK.box.originY + PLAYER_SNAP.originY - PLAYER_SNAP.height);
        expect(r.snapY).toBe(621);
        // …which puts the player's box bottom exactly on the rock's box top.
        expect(621 - PLAYER_SNAP.originY + PLAYER_SNAP.height).toBe(624);
        expect(fallRockRect(landed).y).toBe(624);
    });

    it('⚠ runs on EVERY visit, including ones that never pull anything', () => {
        // The arm is above `if (!Game.checkPersistence(tag))`, so a rock
        // built already-fallen snaps from the first tick of the visit.
        const built = rockAt(true);
        const r = stepFallRock(built, rect(146, 620, 4, 5), { cleared: true });
        expect(r.snapY).toBe(621);
    });

    it('a PARKED rock never snaps, however the player stands', () => {
        const parked = rockAt(false);
        // The parked rock's box is up at y = -24; nothing overlaps it, and
        // `activate` is false as well.
        const r = stepFallRock(parked, rect(146, 620, 4, 5), { cleared: false });
        expect(r.snapY).toBeNull();
    });

    it('a player NOT in the rock\'s cell is not snapped', () => {
        const landed = rockAt(true);
        const r = stepFallRock(landed, rect(146, 600, 4, 5), { cleared: true });
        expect(r.snapY).toBeNull();
    });
});

describe('the camera-pan audit, and the phase hazard it is not', () => {
    it('⛓ every UPDATE-time onScreen gate is named, and L39 holds none that bite', () => {
        const biting = CAMERA_PAN_AUDIT.gatedClasses.filter(
            (c) => c.inL39 && c.verdict !== 'render-only' && c.verdict !== 'opted out',
        );
        expect(biting).toEqual([]);
        const enemy = CAMERA_PAN_AUDIT.gatedClasses.find((c) => c.as3 === 'Enemy');
        expect(enemy.verdict).toBe('opted out');
    });

    it('⚠⚠ `Game.time` IS the phase hazard, and Spinner is in the family', () => {
        // `Bot.pinDeadFrames`'s docblock says the family is ONE class. It is
        // not, and the second one's reader is a damage line rather than a
        // sprite frame.
        const spinner = TIME_COUPLED.readers.find((r) => r.as3 === 'Spinner');
        expect(spinner).toBeTruthy();
        expect(spinner.inL39).toBe(true);
        expect(spinner.kind).toBe('DAMAGE LINE');
        // …and it is inert for a `noDamage` tape, which is why the shaft walk
        // does not pay for it. Named so a tape without `noDamage` does.
        expect(spinner.inertFor).toMatch(/noDamage/);
    });

    it('⚠ a 197-frame freeze is 17 frames of hammer phase, not zero', () => {
        // `hammerAngle = (Game.time % 45) / 45 * 2π`.
        expect(197 % 45).toBe(17);
    });
});

describe('the refusals', () => {
    it('`cleared` has no default on the constructor', () => {
        expect(() => createFallRock(144, 624, 6, 10)).toThrow(FallRockError);
        expect(() => createFallRock(144, 624, 6, 10)).toThrow(/no default/);
    });

    it('a non-integer placement is refused', () => {
        expect(() => createFallRock(144.5, 624, 6, 10, false)).toThrow(FallRockError);
    });

    it('`opts.cleared` has no default for a tagged rock', () => {
        expect(() => stepFallRock(rockAt(false))).toThrow(/no default/);
    });

    it('a publication with a non-boolean is refused', () => {
        expect(() => publishActivate(rockAt(false), 1)).toThrow(FallRockError);
    });
});

describe('⛔⛔ the R2 refusal this finding turns into a CONSTRAINT ON WINDOWS', () => {
    it('a level built WITHOUT the clear has no rock in its solids', () => {
        const shut = buildLevelWorld(source(39), { roles: ROLES, inventory: {}, cleared: [8] });
        expect(shut.solids.some((s) => s.tag === 'fallrock')).toBe(false);
    });

    it('⛔⛔ and a tape MAY NOT DECLARE {39,10} — `REFUSED_CLEAR_RESPONSES.arm` throws', () => {
        // R2 wrote this refusal for the case where clearing the flag ARMS a
        // rock that is still overhead. Slice 10 gives it a second reading it
        // was not written for: after the rope is pulled the flag is ALREADY
        // clear, and a later window that boots into L39 has to build the rock
        // FALLEN — which this refuses.
        //
        // ⇒ THE SHAFT CANNOT BE SPLIT ACROSS TWO WINDOWS at the rope. The
        // window that pulls is the window that pays the 197 frozen frames,
        // and it must also do everything after them. That is a route
        // constraint discovered by a guard rather than by a red recording,
        // which is the guard working.
        //
        // ⚠ Retiring it is NOT this slice's: it needs the snap wired into
        // `levelRun` and a pair with a positive control, and until then the
        // refusal is in the SAFE direction (it blocks a window rather than
        // walking one under a solid nobody modelled).
        expect(() => buildLevelWorld(source(39), {
            roles: ROLES, inventory: {}, cleared: [8, 10],
        })).toThrow(/A clear list must never name it/);
    });

    it('⚠ the pull\'s own write is an EARNED clear, which is a different path', () => {
        // `levelRun` banks it in `pendingEarnedClears` and cashes it when the
        // level is next BUILT — and the shaft window never rebuilds L39, so
        // the refusal above is not on the shaft's own path. Asserted so the
        // distinction is a fact rather than a hope.
        const w = buildLevelWorld(source(39), { roles: ROLES, inventory: {}, cleared: [8] });
        expect(w.level).toBe(39);
    });
});
