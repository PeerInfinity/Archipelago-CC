/**
 * Seedling fidelity STANCE: the stances the solver never landed.
 *
 * The route survey's two loop families at the wave-7 base (`--through=end`):
 *
 *   · `chest-stance-loop` — steps 91 (L46, `chest@424,40`) and 93 (L48,
 *     `chest@152,184`): *"chest stance -> chest stance -> … applied 4
 *     strategies … chest(chest@…) ×4"*. Both chests sit on a HALF tile, so the
 *     stance (the chest's centre column, the band under its probe line) is in a
 *     16 px A* tile whose centre the chest covers. The frontier named the chest
 *     again, and the walk to its stance re-entered its own order with nothing
 *     spent between. Now: `STANCE_REENTRY` asks the 8 px lattice, axis-aligned.
 *   · `keylock-stance-loop` — steps 102 (L48), 135, 155, 176, 186 (L12): the
 *     arrival is NORTH of a bosslock whose key line is the row under it
 *     (`BossLock.update`'s `collideLine`, y = bottom + 1). `stanceHypothesis`
 *     listed the lock itself, so a far-side stance was "reachable once the lock
 *     is discharged". Now the lock is excluded from its own hypothesis (and a
 *     sibling bosslock is only hypothesised where its own key line is in reach),
 *     and the refusal says SEALED BEHIND ITSELF with the saved flag: the SHUT
 *     state. With the flag cleared (the OPEN state) the game does not build the
 *     lock and the same arrival solves.
 *
 * The game witnesses (`plan-seedling-stance-witness.mjs`, recorded on p4f) are
 * the five `stance-*` tapes; each is reproduced by the model at 0 px.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape } from './tapeRunner.js';
import { SolverRefusal, solveSegment } from './solverBot.js';
import { canCross } from './seedlingCanCross.js';
import { chestStanceBand } from './chest.js';
import { HITBOX } from './playerPhysicsV1.js';
import {
    L48_LOCK, STANCE_WITNESSES, stanceStaging,
} from '../../../scripts/procgen/plan-seedling-stance-witness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const expectation = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'expectations', `${name}.json`), 'utf8'));
const witness = (name) => STANCE_WITNESSES.find((w) => w.name === name);
const refusalOf = (fn) => {
    try { fn(); } catch (e) { return e; }
    return null;
};
const runFor = async (name, extra = {}) => {
    const staging = await stanceStaging({ ...witness(name), ...extra });
    return { staging, run: createRunForStaging(staging, SRC) };
};

describe('fidelity STANCE — D1: what the game punishes', () => {
    it('every bosslock in the atlas carries a tag, and its key line is the row UNDER it', () => {
        const rows = [];
        for (const [level, lv] of MAP.levels.entries()) {
            if (!lv.entities.some((e) => e.type === 'bosslock')) continue;
            for (const a of buildLevelWorld(SRC(level)).activators.filter((x) => x.tag === 'bosslock')) {
                rows.push([level, a.id, a.persistTag, a.keyLine.y - a.rect.bottom]);
            }
        }
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(([, , tag]) => Number.isInteger(tag) && tag >= 0)).toBe(true);
        expect(new Set(rows.map((r) => r[3]))).toEqual(new Set([1]));
    });
    it('the two looping chests sit on a HALF tile; their stance row is the band under the probe line', () => {
        const half = [];
        for (const [level, lv] of MAP.levels.entries()) {
            for (const e of lv.entities.filter((x) => x.type === 'chest')) {
                if (e.x % 16 !== 0 || e.y % 16 !== 0) half.push(`L${level} chest@${e.x},${e.y}`);
            }
        }
        expect(half).toEqual(['L46 chest@424,40', 'L48 chest@152,184']);
        expect(chestStanceBand(152, 184, HITBOX)).toEqual([202, 203]);
    });
});

describe('fidelity STANCE — D2: the chest stance on a half tile', () => {
    it.each([['stance-l46-chest', 'chest@424,40'], ['stance-l48-chest', 'chest@152,184']])(
        '%s: the route step solves with ONE chest record, on the 8 px lattice (STANCE_REENTRY)',
        async (name, id) => {
            const { run, staging } = await runFor(name);
            const out = solveSegment({ run, goals: witness(name).goals, name, boot: staging.boot });
            expect(out.records.filter((r) => r.strategy === 'chest').map((r) => r.chest.id)).toEqual([id]);
            expect(run.ledger('chestOpens').map((c) => c.id)).toEqual([id]);
            expect(out.fineLatticeWalks.some((f) => /^STANCE_REENTRY chest\(/.test(f.refused))).toBe(true);
            expect(out.perTick.length).toBe(tape(name).tick_count);
        });
});

describe('fidelity STANCE — D2: the keylock stance, both states', () => {
    it('SHUT (flag {48,1} held): from the L53 door the refusal is SEALED BEHIND ITSELF, by the save', async () => {
        const { run, staging } = await runFor('stance-l48-keylock-north');
        const e = refusalOf(() => solveSegment({ run, goals: witness('stance-l48-keylock-open').goals,
            name: 'stance-l48-shut', boot: staging.boot }));
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toMatch(/no REACHABLE stance on bosslock@48,144's key line in level 48/);
        expect(e.message).toMatch(/SEALED BEHIND ITSELF: the key line is the row y=161 under bosslock@48,144/);
        expect(e.message).toMatch(/The save still holds its flag \{48,1\}/);
        expect(e.message).not.toMatch(/applied 4 strategies/);
        expect(e.sealed).toEqual({
            wall: 'bosslock@48,144', presser: null, self: true, with: [], flag: { level: 48, tag: 1 },
            keyLine: { x0: 50, x1: 59, y: 161 }, from: { x: 24, y: 120 }, stance: { x: 56, y: 168 },
        });
    });
    it('OPEN (flag {48,1} cleared): the build has no lock and the same arrival solves into L47', async () => {
        const { run, staging } = await runFor('stance-l48-keylock-open');
        expect(run.world.activators.map((a) => a.id)).not.toContain(L48_LOCK.id);
        const out = solveSegment({ run, goals: witness('stance-l48-keylock-open').goals,
            name: 'stance-l48-open', boot: staging.boot });
        expect(run.level).toBe(47);
        expect(out.perTick.length).toBe(tape('stance-l48-keylock-open').tick_count);
    });
    it('CONTROL: from its own (south) side the keylock stance lands and the lock opens', async () => {
        const { run, staging } = await runFor('stance-l48-keylock-south');
        const out = solveSegment({ run, goals: witness('stance-l48-keylock-south').goals,
            name: 'stance-l48-south', boot: staging.boot });
        expect(out.records.some((r) => r.strategy === 'keylock' && r.target === L48_LOCK.id)).toBe(true);
        expect(run.level).toBe(53);
    });
    it('L12 twin locks (route step 135\'s arrival): sealed by bosslock@416,240 alone, flag {12,4}', async () => {
        // ⛓ L12KEYLINE: with Fire held the frontier now passes the sealed lock to
        // `burnabletree@480,640` and the step goes ROUND (fidelityL12Keyline). This
        // row is the no-other-door case, so the staging drops Fire.
        const staging = await stanceStaging({ ...witness('stance-l48-keylock-north'),
            items: witness('stance-l48-keylock-north').items.filter((p) => p !== 'hasFire'),
            boot: { level: 12, x: 592, y: 16 } });
        const run = createRunForStaging(staging, SRC);
        const e = refusalOf(() => solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 0, y: 352 } }],
            name: 'stance-l12-shut', boot: staging.boot }));
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.sealed).toMatchObject({ wall: 'bosslock@416,240', self: true, with: [],
            flag: { level: 12, tag: 4 }, stance: { x: 424, y: 264 } });
    });
});

describe('fidelity STANCE — a presser with no stance is the KILL rung\'s refusal, not the solve\'s', () => {
    it('L8 → L7 from the L9 door (the JS arc\'s sweep leg 85, no items): LADDER, the ceiling presser named', () => {
        const r = canCross({ level: 8, exit: 7, arrival: { from: 9 }, inventory: [], witness: false });
        expect(r.verdict).toBe('cannot');
        expect(r.why).toMatch(/the combat ladder is EXHAUSTED/);
        expect(r.why).toMatch(/kill: the ceiling's presser button@64,48 \(group t=0, arming \[arrowtrap@96,16\]\) has no stance/);
        expect(r.why).not.toMatch(/^solverBot: no REACHABLE stance inside button@64,48/);
    });
});

describe('fidelity STANCE — the game witnesses', () => {
    it.each(STANCE_WITNESSES.map((w) => [w.name]))('%s: the model reproduces the game\'s recording', (name) => {
        const out = runTape(tape(name), { levelSource: SRC });
        const game = expectation(name);
        expect(out.ticks).toHaveLength(game.ticks.length);
        expect(out.transitions).toEqual(game.transitions);
        for (let i = 0; i < game.ticks.length; i += 1) {
            expect([out.ticks[i].level, out.ticks[i].x, out.ticks[i].y])
                .toEqual([game.ticks[i].level, game.ticks[i].x, game.ticks[i].y]);
        }
    });
    it('the north lean holds DOWN for longer than the key timer plus the fade, and the game never lets it through', () => {
        const game = expectation('stance-l48-keylock-north');
        const t = tape('stance-l48-keylock-north');
        const down = t.inputs.find((s) => s.key === 'down');
        expect(down.to - down.from).toBeGreaterThan(60 + 20);
        expect(Math.max(...game.ticks.map((o) => o.y))).toBeLessThan(L48_LOCK.top);
    });
});
