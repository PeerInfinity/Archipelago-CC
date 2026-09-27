/**
 * ropeSword.test.js — ⛓⛓⛓ R9 SLICE L16 (kickoff §59.4 D1 + D3): THE SWORD PULLS
 * THE ROPE, AND THE ROSTER PREDICATE ASKS ONE RECT DEEPER.
 *
 * D1 — `PRESS_ARM_POLICY.RopeStart` goes `modelled`. The BODY is the fire
 * arm's (R5 slice 7; `levelRun`'s `pullRope`, hoisted so both weapons run one
 * transcription): shrink, `Game.setPersistence(tag, false)`, and `set activate`
 * latching the rope's group. What a SWORD adds is `Player.slash`'s filter in
 * front of `genericHit` — the REACH half applies, the LINE half is waived for a
 * rope (`Player.as:916`, `ROPE_LINE_WAIVED`). Every row below drives a real
 * run in a real room; none of them is a table read about itself.
 *
 * D3 — `chaserRoomVerdict` refuses a trap room only when a static,
 * un-bridged body's own box stands in a lane (`lanesOver`). The population is
 * the whole atlas, and exactly one room moves.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { loadTape } from './fixtures/index.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { ESCALATION_LADDER, solveSegment } from './solverBot.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import {
    FIRE_ARM_POLICY, PRESS_ARM_POLICY, ROPE_LINE_WAIVED, SLASH_REACH, UP,
    distanceRectPoint, slashRect,
} from './presses.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const AS3 = join(HERE, '../../../vendor/seedling/src');
const levelSource = atlasLevelSource();

/**
 * A live run standing at the pixel `(x, y)` holding the sword. ⛔ The boot
 * block is in PLACEMENT coordinates and the entity centre is placement + 8,
 * so the offset is undone here (the 12d″ touch rows' convention).
 */
const at = (level, x, y, extra = {}) => createLevelRun({
    levelSource, boot: { level, x: x - 8, y: y - 8 }, noclip: false,
    noHazards: [], noDamage: false, grants: [], persistence: [], despawn: [],
    equips: [], pins: [], save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: null, seam: { items: { hasSword: true } }, roles: ROLES, ...extra,
});

/** Face UP (one tick of the key — the wall above stops the step), then swing. */
const swingUp = (run) => {
    run.advance(new Set(['up']));
    run.advance(new Set(['primary']));
    for (let i = 0; i < 12; i += 1) run.advance(new Set());
};

describe('D1 — the sword arm for RopeStart', () => {
    it('⛓ is MODELLED under both tables, and the waiver is a fact the AS3 states', () => {
        expect(PRESS_ARM_POLICY.RopeStart.policy).toBe('modelled');
        expect(FIRE_ARM_POLICY.RopeStart.policy).toBe('modelled');
        // The two lines the waiver rests on, read from the fork rather than typed.
        const rope = readFileSync(join(AS3, 'Puzzlements/RopeStart.as'), 'utf8');
        expect(rope).toMatch(/type = "Rope";/);
        const player = readFileSync(join(AS3, 'Player.as'), 'utf8');
        expect(player).toMatch(/collideLine\("Solid", x, y, v\[i\]\.x, v\[i\]\.y\)[^\n]*v\[i\]\.type == "Rope"/);
        expect(ROPE_LINE_WAIVED.type).toBe('Rope');
    });

    it('⛓⛓⛓ L16: a swing UP from (5,2) pulls rope@32,16 — group 0 latches and the three lanes fall silent', () => {
        const run = at(16, 88, 40);
        expect([...run.armedArrowTraps].sort())
            .toEqual(['arrowtrap@112,32', 'arrowtrap@128,32', 'arrowtrap@96,32']);
        expect([...run.latchedGroups]).toEqual([]);
        swingUp(run);
        expect(run.ropePulls).toEqual([
            { id: 'rope@32,16', level: 16, t: 2, flag: { level: 16, tag: 0, outOfBand: false } },
        ]);
        expect([...run.pulledRopes]).toEqual(['rope@32,16']);
        // `activate XOR shootDefault` = `true XOR true`: every trap is silent.
        expect([...run.latchedGroups]).toEqual([0]);
        expect([...run.armedArrowTraps]).toEqual([]);
        // ⚠ ONE pull, then four dispatches that are the real no-op `hit()`'s
        // `if (!activate)` makes them.
        const hits = run.presses.flatMap((p) => p.hits);
        expect(hits.filter((h) => h.pulled)).toHaveLength(1);
        expect(hits.filter((h) => !h.pulled).every((h) => h.why === 'already pulled')).toBe(true);
    });

    it('⛓ L39: a Blue Wall on the line to the pulley does NOT refuse the swing (Player.as:916)', () => {
        // `ROPE_PULL`'s own stance (9,25): the swing UP reaches `rope@96,384`,
        // and the point line from the player to the rope ENTITY (the pulley
        // centre, `x + 8, y + 8`) crosses a solid tile. Measured on the
        // model's own boxes, so the precondition is a fact and not a hope.
        const w = buildLevelWorld(levelSource(39), { roles: ROLES, inventory: { hasSword: true } });
        const rope = w.solids.find((s) => s.ropeId === 'rope@96,384');
        const boxes = w.solidBoxesForMover({})
            .filter((b) => !(b.x === rope.rect.x && b.y === rope.rect.y));
        const from = { x: 152, y: 408 };
        const to = { x: rope.rect.x + 8, y: rope.rect.y + 8 };
        const n = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
        const blockers = new Set();
        for (let i = 0; i <= n; i += 1) {
            const x = from.x + Math.round(((to.x - from.x) * i) / n);
            const y = from.y + Math.round(((to.y - from.y) * i) / n);
            for (const b of boxes) {
                if (x >= b.x && x < b.right && y >= b.y && y < b.bottom) blockers.add(`${b.x},${b.y}`);
            }
        }
        expect(blockers.size).toBeGreaterThan(0);
        expect(distanceRectPoint(from.x, from.y, rope.rect)).toBeLessThanOrEqual(SLASH_REACH);
        const run = at(39, from.x, from.y);
        swingUp(run);
        expect(run.ropePulls.map((r) => r.id)).toEqual(['rope@96,384']);
        expect([...run.latchedGroups]).toEqual([6]);
    });

    it('⛔ the REACH half applies: a rect that clips the rope from 20 px refuses by the gate\'s own words', () => {
        // Rope corner (96,32) is 15 px left and 15 px up of (111,47): the UP
        // rect [95,127) x [31,47) overlaps the rope by one pixel and
        // `FP.distanceRectPoint` is > 16. `noDamage` so the trap overhead
        // (it fires while unarmed) does not knock the stance around.
        const r = slashRect(111, 47, UP);
        const rope = { x: 32, y: 16, right: 96, bottom: 32 };
        expect(r.x < rope.right && r.y < rope.bottom).toBe(true);
        const run = at(16, 111, 47, { noDamage: true });
        swingUp(run);
        expect(run.ropePulls).toEqual([]);
        const why = run.presses.flatMap((p) => p.hits).map((h) => h.why);
        expect(why.length).toBeGreaterThan(0);
        for (const w of why) {
            expect(w).toMatch(/^distanceRectPoint \d+\.\d{3} > 16 — the rect reached the rope/);
        }
        expect([...run.armedArrowTraps]).toHaveLength(3);
    });
});

describe('D3 — the roster predicate, one rect deeper', () => {
    /** L8's refusal as it stood at 07760149ed — frozen at L16's W0. */
    const L8_WHY = 'level 8 holds 1 arrow trap(s) [arrowtrap@96,16] AND 2 static "Enemy" '
        + 'bod(ies) [sandtrap@96,80, sandtrap@96,128] whose own arrow-death this rung does '
        + 'not stage. An arrow stops on anything it touches, so those bodies would shadow '
        + 'the lane for ever in this model while the GAME removes them — the same '
        + 'wrong-in-the-tail lifetime (trap 157) on the COVER instead of on the chaser. '
        + 'Their clear is the tape\'s DECLARED v9 `at` row and a second writer of one '
        + 'persistence slot is two cost models. Build the static arm, or route clear';

    const run = createLevelRun({ levelSource, boot: { level: 16, x: 16, y: 16 }, roles: ROLES });

    it('⛓ L16 is STEPPED: its sandtraps span x 32–63, its lanes 90–134', () => {
        expect(run.chaserRoomVerdict(16)).toEqual({ stepped: true, why: null });
    });

    it('⛔ L8 is STILL REFUSED, with the W0 text byte for byte', () => {
        expect(run.chaserRoomVerdict(8)).toEqual({ stepped: false, why: L8_WHY });
    });

    it('⛓ over the whole atlas, L8 is the only trap room left refused', () => {
        // The atlas's own extent: `worldFor` refuses a level the atlas lacks.
        const refused = [];
        let n = 0;
        for (;; n += 1) {
            let v;
            try { v = run.chaserRoomVerdict(n); } catch { break; }
            if (!v.stepped) refused.push(n);
        }
        expect(n).toBeGreaterThan(100);
        expect(refused).toEqual([8]);
    });
});

describe('D2 — the PULL rung: the silencer is derived, the latch is asserted on the live run', () => {
    /**
     * ⛓ The survey's staged boot for route step 18 (`r8-solve-11`'s block — the
     * campaign's post-sword latch — re-pointed at L16's arrival (32,64)), and
     * the room's OTHER exit: `stairsdown@112,64` → L17 stands at (7,4), UNDER
     * `arrowtrap@112,32`'s lane (x 106–118). There is no reaching it without
     * standing in a lane, so the ladder's cheapest move is to silence them.
     */
    const solveToEastOfLanes = () => {
        const base = parseTape(loadTape('r8-solve-11'));
        const staging = solveStaging(stagingFromTape(base));
        staging.boot = { level: 16, x: 32, y: 64 };
        staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
        const run = createRunForStaging(staging, levelSource);
        const out = solveSegment({
            run, goals: [{ kind: 'reach-exit', exit: { x: 112, y: 64 } }],
            name: 'l16-pull', boot: staging.boot,
        });
        return { run, out };
    };

    it('⛓⛓⛓ climbs AVOID → PULL: one swing at rope@32,16 from (5,2), group 0 latched, the lanes gone, no hit', () => {
        const { run, out } = solveToEastOfLanes();
        const pulls = out.records.filter((r) => r.strategy === 'pull');
        expect(pulls).toHaveLength(1);
        expect(pulls[0]).toMatchObject({
            verb: 'pull', target: 'rope@32,16', group: 0, stance: { x: 88, y: 40 },
            silenced: ['arrowtrap@96,32', 'arrowtrap@112,32', 'arrowtrap@128,32'],
        });
        // The run has LEFT L16 by now (`latchedGroups` is per visit), so the latch
        // is read off the run's own ledger: one pull, its persistence write
        // {16,0} — what keeps the lanes silent on a re-entry — on the pull tick.
        expect(run.ropePulls).toHaveLength(1);
        expect(run.ropePulls[0]).toMatchObject({ id: 'rope@32,16', level: 16,
            flag: { level: 16, tag: 0, outOfBand: false } });
        // ⛓ MEASURED: the APPROACH pulled it — a sword-dash press walking up the
        // handle's column swung into the rope's rect at t=88, before the stance.
        // The verb asks its post-condition first, finds the group latched, and
        // spends NO tick on a press `hit()`'s `if (!activate)` would make a no-op.
        expect(pulls[0]).toMatchObject({ ticks: 0, pressedAt: null });
        expect(pulls[0].pulledBy).toMatch(/^the approach — rope@32,16 was pulled at tick 88/);
        expect(run.ropePulls[0].t).toBeLessThanOrEqual(pulls[0].from);
        expect(run.playerHits).toEqual([]);
        // …and the walk reached the stairs: the one transition is into L17.
        expect(run.transitions.map((t) => t.to_level)).toEqual([17]);
        // The climb is the RUNNING ladder's own order — PULL named AVOID.
        const climbRows = out.trace.rows.filter((r) => r.strategy?.rung === 'pull');
        expect(climbRows).toHaveLength(1);
        expect(climbRows[0].rejected.map((j) => j.option)
            .filter((o) => ESCALATION_LADDER.includes(o))).toEqual(['avoid']);
        expect(climbRows[0].obstacle).toEqual({ kind: 'danger', id: 'arrowtrap@96,32' });
    }, 60000);
});
