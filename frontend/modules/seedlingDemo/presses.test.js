/**
 * presses — the hand-derived stratum for R4's press rects and audit.
 *
 * Every number is read off `Player.as`, `Enemy.as` and the sprite sheets,
 * not off this port. The reason these matter at pixel resolution: L65's
 * `lightpole@176,120` sits directly above `pushableblockspear@176,128`, so
 * whether a horizontal thrust at the block ALSO toggles a lightpole — and
 * writes a persistence flag nobody declared — is decided in a few pixels
 * of a five-pixel-thick rect.
 *
 * ⚠ AND THE FIRST ANSWER TO THAT WAS WRONG. This docblock used to say the
 * pole "overlaps the top half of" the block, which is true of the
 * CONSTRUCTOR's hitbox and false of the one a press can ever meet:
 * `LightPole.render()` re-anchors `y` to `startY - originY + 2*sin(...)`
 * and `centerOO()` on a 16x16 image makes `originY` 8, so the pole's box
 * sits eight pixels higher than the ctor left it — flush against the
 * block's top edge and not inside it. `LIGHTPOLE_PRESS_BOX` records the
 * bob envelope; the test below pins the boundary, because "they overlap by
 * six pixels" and "they touch at exactly one edge" are the two answers to
 * the audit's whole question.
 */

import { describe, expect, it } from 'vitest';

import {
    DOWN,
    EMPTY_SWORD_WINDOW,
    ENEMY_HITS_MAX,
    ENEMY_HITS_TIMER,
    HITABLE_TYPES,
    LEFT,
    PressError,
    RIGHT,
    SLASH_REACH,
    SLASH_TIMER_MAX,
    SPEAR_DAMAGE,
    SPEAR_LENGTH,
    SPEAR_THICK,
    SWORD_DAMAGE,
    UP,
    SLASH_HIT_TICKS,
    distanceRectPoint,
    pressDamage,
    swordWindowReplace,
    swordWindowSchedule,
    swordWindowStep,
    pressWouldKill,
    auditPress,
    pressRespondersIn,
    slashRect,
    spearOrigin,
    spearRect,
    PRESS_ARM_POLICY,
} from './presses.js';
import {
    LIGHTPOLE_PRESS_BOX, PRESS_ARMS, PRESS_UNKILLABLE, RELAXED_ROLES, buildLevelWorld,
    rect as makeRect,
} from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';

describe('the spear rect (Player.as:944-968)', () => {
    it('is 32 long and 5 thick', () => {
        expect(SPEAR_LENGTH).toBe(32);
        expect(SPEAR_THICK).toBe(5);
    });

    it('anchors on spearX/spearY, which are NOT the player position', () => {
        // spearOffset = (-1, 2), folded through the parity expressions at
        // Player.as:1321-1327. Getting these wrong is a one-or-two pixel
        // error, which is the resolution the L65 audit is decided at.
        expect(spearOrigin(100, 200, RIGHT)).toEqual({ x: 100, y: 201 });
        expect(spearOrigin(100, 200, UP)).toEqual({ x: 101, y: 202 });
        expect(spearOrigin(100, 200, LEFT)).toEqual({ x: 100, y: 202 });
        expect(spearOrigin(100, 200, DOWN)).toEqual({ x: 99, y: 202 });
    });

    it('extends 32 px in the facing direction, per arm', () => {
        expect(spearRect(100, 200, RIGHT))
            .toMatchObject({ x: 100, y: 199.5, w: 32, h: 5 });
        expect(spearRect(100, 200, LEFT))
            .toMatchObject({ x: 68, y: 199.5, w: 32, h: 5 });
        expect(spearRect(100, 200, UP))
            .toMatchObject({ x: 99.5, y: 170, w: 5, h: 32 });
        expect(spearRect(100, 200, DOWN))
            .toMatchObject({ x: 96.5, y: 202, w: 5, h: 32 });
    });

    it('keeps the AS3\'s ASYMMETRIC +1, rather than regularising it', () => {
        // Cases 0 and 1 are `- thick/2 + 1`; cases 2 and 3 are `- thick/2`.
        // A tidied version would put the right-facing rect half a pixel
        // lower and the left-facing one half a pixel higher.
        expect(spearRect(100, 200, RIGHT).y).toBe(199.5);    // 201 - 2.5 + 1
        expect(spearRect(100, 200, LEFT).y).toBe(199.5);     // 202 - 2.5
    });

    it('refuses a direction it cannot transcribe', () => {
        expect(() => spearRect(0, 0, 4)).toThrow(PressError);
        expect(() => slashRect(0, 0, -1)).toThrow(PressError);
    });
});

describe('the slash rect and its two gates', () => {
    it('is the 16x32 sprite frame, ahead of the player', () => {
        expect(slashRect(100, 200, RIGHT))
            .toMatchObject({ x: 100, y: 184, w: 16, h: 32 });
        expect(slashRect(100, 200, LEFT))
            .toMatchObject({ x: 84, y: 184, w: 16, h: 32 });
        // Up and down transpose: 32 wide, 16 tall.
        expect(slashRect(100, 200, UP))
            .toMatchObject({ x: 84, y: 184, w: 32, h: 16 });
        expect(slashRect(100, 200, DOWN))
            .toMatchObject({ x: 84, y: 200, w: 32, h: 16 });
    });

    it('⚠ REACHES only 16 px, which the rect alone does not say', () => {
        // `FP.distanceRectPoint(x, y, ...) <= slashingSprite.width` runs
        // AFTER the rect collect, so an entity in the corner of the 16x32
        // box can be inside the rect and outside the reach.
        expect(SLASH_REACH).toBe(16);
        const corner = { x: 112, y: 184, right: 116, bottom: 188 };
        expect(distanceRectPoint(100, 200, corner)).toBeCloseTo(
            Math.sqrt(12 * 12 + 12 * 12), 10,
        );
        expect(distanceRectPoint(100, 200, corner)).toBeGreaterThan(SLASH_REACH);
        // Zero inside the rect, which is the case the formula is easiest
        // to get wrong on.
        expect(distanceRectPoint(100, 200, { x: 90, y: 190, right: 110, bottom: 210 }))
            .toBe(0);
    });

    it('and the spear has NO such gate — 32 px, through walls', () => {
        // The whole reason §3.2's audit switches rect at the equip tick:
        // the spear reaches twice as far and is not filtered at all.
        expect(SPEAR_LENGTH).toBe(2 * SLASH_REACH);
    });
});

describe('the hitables list', () => {
    it('is the eleven TYPES, not the classes genericHit dispatches on', () => {
        expect(HITABLE_TYPES).toEqual([
            'Enemy', 'Grass', 'Tree', 'Rock', 'Rope', 'ShieldBoss', 'Solid',
            'LightPole', 'LavaBall', 'LavaBoss', 'Watcher',
        ]);
        // "Solid" is why a press can reach a Tile (the bridge), a
        // BreakableRock and a PushableBlock with one entry.
        expect(HITABLE_TYPES).toContain('Solid');
    });
});

describe('the press arithmetic (Enemy.as:141-181)', () => {
    it('one spear press cannot kill a default enemy, and two can', () => {
        expect(SPEAR_DAMAGE).toBe(2);
        expect(ENEMY_HITS_MAX).toBe(3);
        expect(pressWouldKill('spear', 1)).toBe(false);
        expect(pressWouldKill('spear', 2)).toBe(true);
    });

    it('⚠ a SWORD press is 1 or 2 depending on the dark sword', () => {
        // The ladder has held the dark sword since R2, so "a sword press is
        // 1 damage" is only true of a run that does not. Two dark-sword
        // presses kill; three plain ones do.
        expect(SWORD_DAMAGE).toBe(1);
        expect(pressDamage('sword', {})).toBe(1);
        expect(pressDamage('sword', { hasDarkSword: true })).toBe(2);
        expect(pressWouldKill('sword', 2, {})).toBe(false);
        expect(pressWouldKill('sword', 2, { hasDarkSword: true })).toBe(true);
        expect(pressWouldKill('sword', 3, {})).toBe(true);
    });

    it('records the two timers the audit spaces presses against', () => {
        // 30 ticks before the same enemy accepts another hit; 20 ticks is
        // the double-tap window that turns a second press into a DASH that
        // MOVES the player (the R3 fixtures space theirs eight apart and
        // leave exactly one stray).
        expect(ENEMY_HITS_TIMER).toBe(30);
        expect(SLASH_TIMER_MAX).toBe(20);
    });
});

describe('the level query (R4: the census half of §3.2)', () => {
    const source = atlasLevelSource();
    const L65 = buildLevelWorld(source(65));
    const L63 = buildLevelWorld(source(63));

    it('sees the LightPole — the responder that is in no other list', () => {
        // The whole reason this query exists. `type = "LightPole"` is in no
        // solids list, so the pole is not a solid, not an activator, not a
        // presser, not a pickup and not a proximity hazard. Before the
        // census entry a rect query would have reported it absent.
        const poles = L65.pressResponders.filter((r) => r.as3 === 'LightPole');
        expect(poles.length).toBe(2);
        expect(L65.solids.some((s) => s.tag === 'lightpole')).toBe(false);
        for (const p of poles) {
            expect(p.cost).toMatch(/setPersistence/);
        }
    });

    it('⚠ the pole\'s box is the RENDER-TIME one, eight pixels above the ctor\'s', () => {
        // `centerOO()` on a 16x16 image gives originY 8, and render() sets
        // `y = startY - originY + 2*sin(...)` — so the ctor rect
        // [oel.y + 2, +12) is true for at most one frame. The recorded box
        // is the bob envelope about `oel.y`.
        expect(LIGHTPOLE_PRESS_BOX).toMatchObject({ dy: 0, h: 16, originY: 8 });
        const pole = L65.pressResponders.find(
            (r) => r.as3 === 'LightPole' && r.x === 176 && r.y === 120,
        );
        expect(pole.rect).toMatchObject({ x: 179, right: 189, y: 112, bottom: 128 });
        // …and that is what decides the question the module docblock asks:
        // the pole does NOT reach `pushableblockspear@176,128`, whose rect
        // starts at y = 128. The ctor rect would have overlapped it by 6 px.
        const block = L65.pressResponders.find((r) => r.as3 === 'PushableBlockSpear');
        expect(block.rect).toMatchObject({ y: 128, bottom: 144 });
        expect(pole.rect.bottom).toBe(block.rect.y);
    });

    it('a spear thrust at L65\'s block does NOT also toggle the pole above it', () => {
        // The press the R4 route makes: facing LEFT from tile (12,8).
        const rect = spearRect(204, 132, LEFT);
        const hit = pressRespondersIn(L65, rect);
        expect(hit.map((r) => r.as3)).toEqual(['PushableBlockSpear']);
        const audit = auditPress(L65, rect, {
            weapon: 'spear',
            intended: [{ as3: 'PushableBlockSpear', x: 176, y: 128 }],
        });
        expect(audit.illegal).toEqual([]);
        expect(audit.missing).toEqual([]);
    });

    it('an unintended responder in the rect is what the audit reports', () => {
        const rect = spearRect(204, 132, LEFT);
        const audit = auditPress(L65, rect, { weapon: 'spear', intended: [] });
        expect(audit.illegal.map((r) => r.as3)).toEqual(['PushableBlockSpear']);
        expect(audit.illegal[0].cost).toMatch(/FACING direction/);
    });

    it('a SLASH is audited against a smaller set — two arms are Spear-only', () => {
        // `genericHit`'s LightPole and Tile arms both sit under
        // `t == "Spear"`, so a sword stray cannot toggle a pole or nudge a
        // bridge. That is a reason to prefer the sword, not to skip the
        // audit.
        expect(PRESS_ARMS.LightPole.arm).toMatch(/ONLY under t == "Spear"/);
        expect(PRESS_ARMS.Tile.arm).toMatch(/ONLY under t == "Spear"/);
        const pole = L65.pressResponders.find((r) => r.as3 === 'LightPole');
        const rect = {
            x: pole.rect.x, y: pole.rect.y, right: pole.rect.right, bottom: pole.rect.bottom,
        };
        expect(auditPress(L65, rect, { weapon: 'spear' }).live
            .some((r) => r.as3 === 'LightPole')).toBe(true);
        expect(auditPress(L65, rect, { weapon: 'sword' }).live
            .some((r) => r.as3 === 'LightPole')).toBe(false);
    });

    it('the bridge is a press responder, and it is TERRAIN', () => {
        // L63's one bridge, at tile (2,9) — the health seal. It has no
        // `.oel` object, so it comes from `bridgeTiles` rather than from
        // the entity list, and it is the only arm of `genericHit` that
        // dispatches on `Tile`.
        expect(L63.bridgeTiles.length).toBe(1);
        const b = L63.bridgeTiles[0];
        const rect = spearRect(b.rect.x + 24, b.rect.y + 8, LEFT);
        const hit = pressRespondersIn(L63, rect);
        expect(hit.some((r) => r.as3 === 'Tile')).toBe(true);
        expect(hit.find((r) => r.as3 === 'Tile').tile).toEqual({ tx: b.tx, ty: b.ty });
    });

    it('the enemy roster is carried WITHOUT rects, on purpose', () => {
        // A chaser is wherever it is, not where it spawned, so the enemy
        // half of the audit is arithmetic over the walk rather than a rect
        // query.
        expect(L65.pressEnemies.map((e) => e.tag).sort())
            .toEqual(['bob', 'darktrap', 'turret']);
        for (const e of L65.pressEnemies) expect(e.rect).toBeUndefined();
    });

    it('and the enemies no press can damage are named, not budgeted for', () => {
        // `DarkTrap.hit()` is an empty override, so the press that reaches
        // one costs nothing — which matters because a darktrap sits in the
        // middle of both L63's and L65's press geometry. The other two
        // L65 enemies are ordinary and each gets at most one press.
        const byTag = Object.fromEntries(L65.pressEnemies.map((e) => [e.tag, e]));
        expect(byTag.darktrap.unkillable).toMatch(/DarkTrap\.as/);
        expect(byTag.bob.unkillable).toBeNull();
        expect(byTag.turret.unkillable).toBeNull();
        // Every name in the table is an enemy the census can actually
        // produce, so the enumeration cannot rot into a list of typos.
        expect(Object.keys(PRESS_UNKILLABLE).sort())
            .toEqual(['BombPusher', 'DarkTrap', 'Grenade']);
    });

    it('⚠ answers at a pushed block\'s LIVE rect, not its spawn one', () => {
        // The failure this line prevents was measured, not imagined: the
        // three-push L65 chain landed its FIRST push and silently no-opped
        // the other two, because the press census kept answering from the
        // rect `loadlevel` built and the block was a tile away by then.
        const block = L65.pressResponders.find((r) => r.as3 === 'PushableBlockSpear');
        expect(block.pushableId).toBe('pushableblockspear@176,128');
        // A stance whose rect covers the SPAWN cell but not the cell the
        // block has been pushed into.
        const atSpawn = spearRect(204, 132, LEFT);
        expect(pressRespondersIn(L65, atSpawn).some((r) => r.pushableId)).toBe(true);
        const moved = new Map([[block.pushableId, {
            rect: makeRect(160, 128, 16, 16), removed: false,
        }]]);
        expect(pressRespondersIn(L65, atSpawn, { pushables: moved })
            .find((r) => r.pushableId).rect.x).toBe(160);
        const gone = new Map([[block.pushableId, { rect: makeRect(160, 128, 16, 16), removed: true }]]);
        expect(pressRespondersIn(L65, atSpawn, { pushables: gone }).some((r) => r.pushableId))
            .toBe(false);
    });

    it('every arm `genericHit` names has a POLICY, and no policy is orphaned', () => {
        // An enumeration over `PRESS_ARMS`, checked in both directions. The
        // blanket rule this replaced ("model two arms, refuse everything
        // else") failed a COMMITTED recording: `r3-collect-sword` pages its
        // own dialogue with X while holding the sword, and the rect reaches
        // two TREES — whose `hit()` is an empty body.
        expect(Object.keys(PRESS_ARM_POLICY).sort()).toEqual(Object.keys(PRESS_ARMS).sort());
        for (const [as3, entry] of Object.entries(PRESS_ARM_POLICY)) {
            expect(['modelled', 'inert', 'refused']).toContain(entry.policy);
            expect(typeof entry.why).toBe('string');
            expect(entry.why).not.toBe('');
            expect(as3).toBeTruthy();
        }
        expect(PRESS_ARM_POLICY.Tree.policy).toBe('inert');
        expect(PRESS_ARM_POLICY.LightPole.policy).toBe('modelled');
        expect(PRESS_ARM_POLICY.Enemy.policy).toBe('refused');
        expect(PRESS_ARM_POLICY.PushableBlockSpear.policy).toBe('modelled');
    });

    it('REFUSES a world built without the blocking role rather than passing', () => {
        // An empty census because nothing was ASKED reads exactly like an
        // empty census because nothing responds — and one of those is a
        // press audit that passes by construction.
        const relaxed = buildLevelWorld(source(65), { roles: RELAXED_ROLES });
        expect(relaxed.pressResponders).toEqual([]);
        expect(() => pressRespondersIn(relaxed, spearRect(204, 132, LEFT)))
            .toThrow(PressError);
    });
});

/**
 * ⛓⛓⛓ R9 SLICE 12c‴ — **THE SWORD WINDOW, ASKED IN ISOLATION.**
 *
 * The window is what `levelRun.advance` used to keep in two locals and
 * `solverBot.previewWalk` kept not at all — and ⚖ ruling 30(c) is an equality
 * between two objects that must be the SAME object. Extracting it makes that
 * literal; these rows are what say the extraction is a TRANSCRIPTION and not a
 * paraphrase, because a pure function can be asked about ticks no fixture
 * happens to contain.
 */
describe('the sword window — one stepper, both sides', () => {
    const sword = (t) => ({ weapon: 'sword', direction: RIGHT, pressTick: t });
    /** Drive N ticks from a press at `pressTick`, collecting what fires when. */
    const drive = (pressTick, ticks, { secondPress = null } = {}) => {
        let win = EMPTY_SWORD_WINDOW;
        const fired = [];
        for (let t = 0; t <= ticks; t += 1) {
            const step = swordWindowStep(win, t);
            win = step.window;
            for (const f of step.fires) fired.push({ t, pressTick: f.pressTick, repeat: f.repeat ?? 0 });
            if (t === secondPress) win = swordWindowReplace(win);
            if (t === pressTick || t === secondPress) {
                win = swordWindowSchedule(win, sword(t));
            }
        }
        return fired;
    };

    it('⛓⛓⛓ a press at T fires on T+1 … T+SLASH_HIT_TICKS — five ticks, one rect each, '
        + 'and NOT on T itself', () => {
        const fired = drive(10, 20);
        expect(fired.map((f) => f.t)).toEqual([11, 12, 13, 14, 15]);
        expect(fired).toHaveLength(SLASH_HIT_TICKS);
        // ⛔ THE FIRST FIRE IS THE PENDING THRUST, the other four are repeats —
        // and the repeat index is what a caller uses to tell a re-aim from the
        // opening swing.
        expect(fired.map((f) => f.repeat)).toEqual([0, 1, 2, 3, 4]);
        expect(fired.every((f) => f.pressTick === 10)).toBe(true);
    });

    it('⛔ NOTHING fires on the press tick — which is exactly what `previewWalk` '
        + 'used to do and the game refutes', () => {
        expect(drive(10, 20).some((f) => f.t === 10)).toBe(false);
    });

    it('⛓⛓ a SECOND press inside the window REPLACES the first one\'s remaining '
        + 'tests, it does not interleave with them', () => {
        // Press at 10 (fires 11..15) and again at 12. Under a REPLACEMENT the
        // first window keeps only what has already fired (11, 12) and the
        // second owns 13..17. Under an APPEND, ticks 13, 14 and 15 would each
        // take TWO — which is `Player.slash()` running its test twice on a
        // tick, and it never does.
        const fired = drive(10, 20, { secondPress: 12 });
        const perTick = new Map();
        for (const f of fired) perTick.set(f.t, (perTick.get(f.t) ?? 0) + 1);
        expect([...perTick.values()].every((n) => n === 1)).toBe(true);
        expect(fired.map((f) => `${f.t}:${f.pressTick}`))
            .toEqual(['11:10', '12:10', '13:12', '14:12', '15:12', '16:12', '17:12']);
    });

    it('⛓ the repeat filter keeps `at > tick`, so a repeat that has fired is dropped '
        + 'and one whose tick has PASSED is dropped with it', () => {
        let win = swordWindowSchedule(EMPTY_SWORD_WINDOW, sword(0));
        win = swordWindowStep(win, 1).window;          // fires the pending, schedules 2..5
        expect(win.repeats.map((r) => r.at)).toEqual([2, 3, 4, 5]);
        // Step straight to 4: 2 and 3 are never asked for and must not survive.
        const jumped = swordWindowStep(win, 4);
        expect(jumped.fires.map((f) => f.repeat)).toEqual([3]);
        expect(jumped.window.repeats.map((r) => r.at)).toEqual([5]);
    });

    it('⛔ ONLY A SWORD BUYS REPEATS — a spear press schedules ONE thrust and nothing '
        + 'after it (`SPEAR_HIT_TICKS_UNMODELLED`)', () => {
        let win = swordWindowSchedule(EMPTY_SWORD_WINDOW,
            { weapon: 'spear', direction: RIGHT, pressTick: 0 });
        const step = swordWindowStep(win, 1);
        expect(step.fires).toHaveLength(1);
        expect(step.window.repeats).toEqual([]);
    });

    it('⛔⛔ `swordWindowSchedule` does NOT clear a live window, and that is why it is '
        + 'separate from `swordWindowReplace` — a spear press must not kill a swing', () => {
        let win = swordWindowSchedule(EMPTY_SWORD_WINDOW, sword(0));
        win = swordWindowStep(win, 1).window;
        expect(win.repeats).toHaveLength(4);
        const spear = swordWindowSchedule(win,
            { weapon: 'spear', direction: RIGHT, pressTick: 1 });
        expect(spear.repeats).toHaveLength(4);
        expect(swordWindowReplace(win).repeats).toHaveLength(0);
    });

    it('⛓ the empty window is a fixed point — stepping it fires nothing and changes '
        + 'nothing', () => {
        const step = swordWindowStep(EMPTY_SWORD_WINDOW, 7);
        expect(step.fires).toEqual([]);
        expect(step.window).toEqual({ pending: null, repeats: [] });
    });
});
