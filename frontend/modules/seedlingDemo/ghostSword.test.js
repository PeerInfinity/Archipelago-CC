/**
 * seedlingDemo/ghostSword.test — ⛓⛓⛓ SEEDLING FIDELITY GHOSTSWORD: the ghost sword's press.
 *
 * The transcription (`ghostSword.js`), its window (`presses.swordWindowStep`), its executor
 * (`levelRun.applyThrust`'s ghost arm) and the break verb's ghostsword row (`solverBot.resolveBreakStrategy`) — each
 * asked with `GHOSTSWORD_PRESS` OFF (the pre-slice model: a ghostsword press THROWS by name) and ON (the default).
 * The game witnesses are tapes (`ghostsword-l3-rockghost`, `ghostsword-l3-rock`, `ghostsword-l30-bobsoldier`,
 * recorded on p4f and replayed by `tapeRunner`); these rows are the arithmetic and the contract.
 */
import { describe, expect, it } from 'vitest';

import {
    GHOSTSWORD_PRESS, GHOSTSWORD_PRESS_DEFAULT, GHOST_PRESS_ARMS, GHOST_SLASH_ANIM_TICKS, GHOST_SWORD_DAMAGE,
    GHOST_SWORD_HIT_TYPE, GHOST_SWORD_REACH, ghostSlashHitTicksFor, ghostSlashRect, ghostSwingRefusal,
    withGhostSwordPress,
} from './ghostSword.js';
import { EMPTY_SWORD_WINDOW, LEFT, slashRect, swordWindowSchedule, swordWindowStep } from './presses.js';
import { SLASH_ANIM_TICKS } from './combatVerbs.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import { PIN_NAMES } from './tapeFormat.js';
import { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';
import { DEFAULT_BUDGET, GENERATED_BOOT_TIME, bootStaging, collectGoal, solve } from './procgenOracle.js';
import { POST_SWORD_ITEMS } from './procgenPalette.js';
import { SEEDLING_DEFAULTS } from './procgenSeedling.js';

describe('the switch', () => {
    it('is ON by default (inert on every committed tape and producer), and `withGhostSwordPress` restores it', () => {
        expect(GHOSTSWORD_PRESS_DEFAULT).toBe(true);
        const was = GHOSTSWORD_PRESS.enabled;
        withGhostSwordPress(!was, () => expect(GHOSTSWORD_PRESS.enabled).toBe(!was));
        expect(GHOSTSWORD_PRESS.enabled).toBe(was);
    });
});

describe('the transcription — `Player.as`', () => {
    it('`genericHit(e, "Spear", swordForce, ghostSwordDamage 2)`, reach `width * scaleX` = 24', () => {
        expect(GHOST_SWORD_HIT_TYPE).toBe('Spear');
        expect(GHOST_SWORD_DAMAGE).toBe(2);
        expect(GHOST_SWORD_REACH).toBe(24);
    });

    it('the window: 7 frames at 30 → SEVEN tests, 4 at 20 → SIX (the sword\'s 5 and 4)', () => {
        expect(GHOST_SLASH_ANIM_TICKS).toEqual({ slash: 7, slashnarrow: 6 });
        expect(SLASH_ANIM_TICKS).toEqual({ slash: 5, slashnarrow: 4 });
        expect(ghostSlashHitTicksFor(null)).toBe(7);
        expect(ghostSlashHitTicksFor('slashnarrow')).toBe(6);
        expect(() => ghostSlashHitTicksFor('spear')).toThrow(/unknown slash animation/);
    });

    it('the rect: 24 along the swing, `width * 2` = 48 across, and it CONTAINS the sword\'s', () => {
        for (const dir of [0, 1, 2, 3]) {
            const g = ghostSlashRect(100, 100, dir);
            const s = slashRect(100, 100, dir);
            const along = dir % 2 === 0 ? g.w : g.h;
            const across = dir % 2 === 0 ? g.h : g.w;
            expect([along, across]).toEqual([24, 48]);
            expect(g.x <= s.x && g.y <= s.y && g.right >= s.right && g.bottom >= s.bottom).toBe(true);
        }
        expect(ghostSlashRect(100, 100, LEFT)).toMatchObject({ x: 76, y: 76, w: 24, h: 48 });
    });

    it('a ghost sword WITHOUT the sword never tests — `slash()` is `if (hasSword)` — refused by name', () => {
        expect(ghostSwingRefusal({ hasGhostSword: true, hasSword: false })).toMatch(/only `if \(hasSword\)`/);
        expect(ghostSwingRefusal({ hasGhostSword: true, hasSword: true })).toBe(null);
        expect(ghostSwingRefusal({ hasSword: true })).toBe(null);
    });

    it('the per-class table names every arm a ghost swing can reach, and refuses the two seven-test Spear arms', () => {
        expect(Object.keys(GHOST_PRESS_ARMS).sort()).toEqual([
            'BreakableRock', 'Enemy', 'Grass', 'IceTurret', 'LightPole', 'PushableBlockSpear', 'RopeStart', 'Tile', 'Tree',
        ]);
        expect(Object.entries(GHOST_PRESS_ARMS).filter(([, a]) => a.model === 'refused').map(([k]) => k).sort())
            .toEqual(['PushableBlockSpear', 'Tile']);
    });
});

describe('the window — `presses.swordWindowStep`', () => {
    const thrust = { weapon: 'ghostsword', direction: LEFT, pressTick: 10, anim: 'slash' };
    const fires = (on) => withGhostSwordPress(on, () => {
        let win = swordWindowSchedule(EMPTY_SWORD_WINDOW, thrust);
        const at = [];
        for (let t = 11; t < 30; t += 1) {
            const r = swordWindowStep(win, t);
            win = r.window;
            for (const f of r.fires) at.push(t);
        }
        return at;
    });
    it('ON: a ghost press tests on SEVEN consecutive ticks; OFF: one (the throw\'s), as before', () => {
        expect(fires(true)).toEqual([11, 12, 13, 14, 15, 16, 17]);
        expect(fires(false)).toEqual([11]);
    });
});

describe('the executor — `levelRun.applyThrust`\'s ghost arm', () => {
    const stage = (boot, items) => createLevelRun({
        levelSource: atlasLevelSource(), boot, noclip: false, noHazards: [], noDamage: true, grants: [],
        persistence: [], despawn: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null, seam: { items }, roles: ROLES,
    });
    /** L3, east of the water column, facing west, one press: `ghostsword-l3-rockghost`'s first ticks. */
    const pressAtGhostRock = (items) => {
        const run = stage({ level: 3, x: 28, y: 64 }, items);
        run.advance(new Set(['left']));
        run.advance(new Set(['primary']));
        for (let i = 0; i < 9; i += 1) run.advance(new Set());
        return run;
    };
    const GHOST = { hasSword: true, hasGhostSword: true, canSwim: true };

    it('OFF: the press THROWS by name, exactly as before this slice', () => {
        withGhostSwordPress(false, () => {
            expect(() => pressAtGhostRock(GHOST)).toThrow(/ghostsword press routes the slash rect .* Neither is modelled \(R5\)/);
        });
    });

    it('⛓⛓⛓ ON: seven tests, the 24 x 48 rect, and the FIRST breaks `breakablerockghost@0,64` from 18.65 px', () => {
        withGhostSwordPress(true, () => {
            const run = pressAtGhostRock(GHOST);
            const rows = run.presses.filter((p) => p.weapon === 'ghostsword');
            expect(rows.map((p) => p.fired)).toEqual([2, 3, 4, 5, 6, 7, 8]);
            expect(rows[0].rect).toMatchObject({ w: 24, h: 48 });
            expect(rows[0].hits).toEqual([expect.objectContaining({ id: 'breakablerockghost@0,64', broke: true })]);
            expect(rows[0].outOfReach).toEqual([]);
            expect(run.entities('brokenRocks').has('breakablerockghost@0,64')).toBe(true);
        });
    });

    it('⛔ ON: the ghost sword without the sword refuses BY NAME at the first test', () => {
        withGhostSwordPress(true, () => {
            expect(() => pressAtGhostRock({ hasGhostSword: true, canSwim: true }))
                .toThrow(/calls `slash\(\)` only `if \(hasSword\)`/);
        });
    });
});

describe('the break verb\'s ghostsword row — `solverBot.resolveBreakStrategy`', () => {
    const LEVEL = SEEDLING_DEFAULTS.level;
    /** `breakVerb.test`'s one-corridor room: floor along row 1, the goal at (8,1), a `breakablerockghost` at (4,1). */
    function corridorWithGhostRock() {
        let rec = emptyLevel({ level: LEVEL });
        const floor = new Set();
        for (let tx = 1; tx <= 8; tx += 1) floor.add(`${tx},1`);
        const wall = [];
        for (let ty = 0; ty < 9; ty += 1) {
            for (let tx = 0; tx < 9; tx += 1) if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
        }
        rec = withTerrain(rec, wall);
        return withEntities(rec, [
            { type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(8, 1), attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
            { type: 'breakablerockghost', ...oelAtTile(4, 1), attrs: { tag: '5' } },
        ]);
    }
    const runRoom = (items, name) => {
        const rec = corridorWithGhostRock();
        const boot = { ...bootAtTile(rec, 1, 1), time: GENERATED_BOOT_TIME };
        return solve(rec, bootStaging({ boot, items, pins: ['dead_frames'] }),
            [collectGoal(8 * 16, 16)], DEFAULT_BUDGET, { name });
    };
    const GHOST_ITEMS = { ...POST_SWORD_ITEMS, hasGhostSword: true };

    it('OFF: the ghostsword primary refuses by name — the work order is to model the ghostsword slash rect', () => {
        withGhostSwordPress(false, () => {
            const out = runRoom(GHOST_ITEMS, 'ghost-break-off');
            expect(out.verdict).toBe('REFUSED');
            expect(out.reasonText).toMatch(/fires `ghostsword`, and only the plain SWORD breaks a rock in this model/);
        });
    });

    it('⛓⛓⛓ ON: the ghost sword BREAKS the ghost rock and the room SOLVES', () => {
        withGhostSwordPress(true, () => {
            const out = runRoom(GHOST_ITEMS, 'ghost-break-on');
            expect(out.verdict).toBe('SOLVED');
            const row = (out.trace?.rows ?? []).find((r) => r.strategy?.verb === 'break');
            expect(row?.obstacle?.id).toBe('breakablerockghost@64,16');
        });
    });

    it('⛔ ON: a ghost sword without the sword refuses by the swing\'s own name, not a budget', () => {
        withGhostSwordPress(true, () => {
            const out = runRoom({ ...GHOST_ITEMS, hasSword: false }, 'ghost-break-no-sword');
            expect(out.verdict).toBe('REFUSED');
            expect(out.reasonText).toMatch(/only `if \(hasSword\)`/);
            expect(out.reasonText).not.toMatch(/budget/i);
        });
    });
});
