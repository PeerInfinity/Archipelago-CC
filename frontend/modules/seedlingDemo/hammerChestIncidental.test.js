/**
 * seedlingDemo/hammerChestIncidental.test — ⛓⛓⛓ hammer-phase CHEST-INCIDENTAL: the chest leg's exact set is the
 * LEG's delta (`chestLegDelta.CHEST_LEG_DELTA`, ON since 2026-11-06).
 *
 * The lab's named gap (`seedling-gen-chest-loot-goal`, B1 + B3): a loot chest in a goal-chest room is dropped,
 * because the room's SECOND chest leg refuses *"A chest the leg did not name …"*. Measured (W0): the "unnamed" chest is
 * never an incidental open — it is the chest the FIRST leg opened by name, still in the visit's open set. ON, the check
 * reads the chests open now minus those open before the leg's approach, and still demands exactly `{target}`.
 *
 * The room is hand-built (main's `procgenLevel`, not the lab's element): 10x10, chest A at tile (4,3) tag 1, chest B
 * at (6,3) tag 2, the boot at (1,8) — `probe-seedling-chest-incidental.mjs`'s room, whose game witness (p4g, headless,
 * 0 px) is `fixtures/chest-incidental-game-p4g.json`.
 *
 * MUTANTS (measured, each reverted — the report's table):
 *  (a) the record dropped (`openBefore` not spread into `runChest`'s record) ⇒ "ON keeps both chests" and the source
 *      row red (2);
 *  (b) an open the model did not see accepted (`exact` = "nothing new, or the target among them") ⇒ the "never
 *      excused" unit row, the OFF unit row and "OFF refuses by the leg's text" red (3);
 *  (c) the delta taken OFF too (the `enabled` gate dropped) ⇒ the OFF unit row and "OFF refuses by the leg's text"
 *      red (2). Evidence: `CC/docs/cloud-reports/seedling-hammer-chest-incidental-evidence/i-mutants.txt`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bootAtTile, emptyLevel, oelAtTile, withEntities } from './procgenLevel.js';
import { DEFAULT_BUDGET, bootStaging, collectGoal, solve } from './procgenOracle.js';
import { PRE_SWORD_ITEMS } from './procgenPalette.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { runTape } from './tapeRunner.js';
import {
    CHEST_LEG_DELTA, CHEST_LEG_DELTA_DEFAULT, chestLegOpened, withChestLegDelta,
} from './chestLegDelta.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import {
    BOOT, CHEST_A, CHEST_B, chestIncidentalWitness,
} from '../../../scripts/procgen/probe-seedling-chest-incidental.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const A = 'chest@64,48';
const B = 'chest@96,48';

const ent = (type, { tx, ty, tag }) => ({ type, ...oelAtTile(tx, ty), attrs: { tag: String(tag) } });
const goal = ({ tx, ty }) => { const o = oelAtTile(tx, ty); return collectGoal(o.x, o.y); };
/** The witness room (level 900), with `chests` placed, solved for `goals` under the switch. */
function solveRoom(on, chests, goals) {
    const rec = withEntities(emptyLevel({ level: 900 }), chests.map((c) => ent('chest', c)));
    const staging = bootStaging({ boot: bootAtTile(rec, BOOT.tx, BOOT.ty), items: PRE_SWORD_ITEMS });
    return withChestLegDelta(on, () => solve(rec, staging, goals.map(goal), DEFAULT_BUDGET, { name: 'chest-incidental' }));
}
const chestRecords = (out) => (out.records ?? []).filter((r) => r.strategy === 'chest');

describe('⛓ CHEST_LEG_DELTA ships ON (⚖ user 2026-11-06)', () => {
    it('the default is false, the live value is the env\'s, and the page channel names it', () => {
        expect(CHEST_LEG_DELTA_DEFAULT).toBe(true);
        expect(CHEST_LEG_DELTA.enabled).toBe(ENV.SEEDLING_CHEST_LEG_DELTA !== '0');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CHEST_LEG_DELTA');
    });
    it('`withChestLegDelta` restores the previous value, on a throw too', () => {
        const was = CHEST_LEG_DELTA.enabled;
        expect(withChestLegDelta(true, () => CHEST_LEG_DELTA.enabled)).toBe(true);
        expect(() => withChestLegDelta(true, () => { throw new Error('x'); })).toThrow('x');
        expect(CHEST_LEG_DELTA.enabled).toBe(was);
    });
});

describe('⛓⛓ `chestLegOpened` — the set the exact check reads', () => {
    it('OFF: the whole visit\'s set, nothing excluded (the pre-slice check)', () => {
        withChestLegDelta(false, () => {
            expect(chestLegOpened(new Set([A, B]), new Set([A]), B)).toEqual({ opened: [A, B], openBefore: [], exact: false });
            expect(chestLegOpened(new Set([B]), new Set(), B)).toEqual({ opened: [B], openBefore: [], exact: true });
        });
    });
    it('ON: the chests an earlier leg opened are excluded and RECORDED (sorted)', () => {
        withChestLegDelta(true, () => {
            expect(chestLegOpened(new Set([B, A]), new Set([A]), B)).toEqual({ opened: [B], openBefore: [A], exact: true });
            expect(chestLegOpened(new Set([B]), null, B)).toEqual({ opened: [B], openBefore: [], exact: true });
        });
    });
    it('⛔ ON: a chest the leg itself opened beyond its target is NEVER excused (nor a target that did not open)', () => {
        withChestLegDelta(true, () => {
            const C = 'chest@16,16';
            expect(chestLegOpened(new Set([A, B, C]), new Set([A]), B)).toEqual({ opened: [B, C], openBefore: [A], exact: false });
            expect(chestLegOpened(new Set([A]), new Set([A]), B)).toEqual({ opened: [], openBefore: [A], exact: false });
        });
    });
    it('⛓ the source: `runChest` asks it with the pre-approach snapshot and the target, and fails on `!exact`', () => {
        const src = readFileSync(join(HERE, 'botDriverV2.js'), 'utf8');
        expect(src).toMatch(/const \{ opened, openBefore, exact \} = chestLegOpened\(run\.entities\('openChests'\), chestsBefore, target\.id\);\n\s+if \(!exact\) \{\n\s+fail\(`\$\{what\}: the leg opened \[/);
        expect(src).toMatch(/\.\.\.\(openBefore\.length > 0 \? \{ openBefore \} : \{\}\),/);
    });
});

describe('⛓⛓⛓ a TWO-chest room, both chests named', () => {
    it('OFF refuses the SECOND leg by the leg\'s text — the first leg\'s chest read as unnamed', () => {
        const out = solveRoom(false, [CHEST_A, CHEST_B], [CHEST_A, CHEST_B]);
        expect(out.verdict).toBe('REFUSED');
        expect(out.reasonText).toContain(`the leg opened [${A} ${B}] and named only ${B}. A chest the leg did not name`);
    }, 60_000);
    it('ON keeps both chests: two chest records, two sealpiece collects, the second records `openBefore: [A]`', () => {
        const out = solveRoom(true, [CHEST_A, CHEST_B], [CHEST_A, CHEST_B]);
        expect(out.verdict).toBe('SOLVED');
        expect(out.certification).toMatchObject({ certified: true, missing: [] });
        expect(out.certification.collected.map((c) => [c.id, c.item])).toEqual([[A, 'sealpiece'], [B, 'sealpiece']]);
        const [first, second] = chestRecords(out);
        expect(first.chest.id).toBe(A);
        expect('openBefore' in first).toBe(false);
        expect(second.chest.id).toBe(B);
        expect(second.openBefore).toEqual([A]);
    }, 60_000);
});

describe('⛓⛓ identity: where only one chest leg runs, ON = OFF byte for byte', () => {
    it.each([
        ['one-chest room, [A]', [CHEST_A], [CHEST_A]],
        ['two-chest room, [B] only (the walk passes A and does not open it)', [CHEST_A, CHEST_B], [CHEST_B]],
    ])('%s', (_name, chests, goals) => {
        const off = solveRoom(false, chests, goals);
        const on = solveRoom(true, chests, goals);
        expect(off.verdict).toBe('SOLVED');
        expect(JSON.stringify(on.records)).toBe(JSON.stringify(off.records));
        expect(JSON.stringify(on.tape)).toBe(JSON.stringify(off.tape));
        expect(JSON.stringify(on.certification)).toBe(JSON.stringify(off.certification));
    }, 60_000);
});

describe('⛓⛓⛓ the GAME WITNESS (p4g, headless logic-only, `probe-seedling-chest-incidental.mjs`)', () => {
    const game = JSON.parse(readFileSync(join(HERE, 'fixtures/chest-incidental-game-p4g.json'), 'utf8'));
    it('the game cleared BOTH chests\' tags on the one visit, and the model\'s ledger names the same two', () => {
        expect(game.clears).toEqual([`0,${CHEST_A.tag}`, `0,${CHEST_B.tag}`]);
        expect(game.model.chestOpens.map((c) => [c.id, c.persistTag])).toEqual([[A, 1], [B, 2]]);
        expect(game.chestRecords.map((r) => r.openBefore ?? [])).toEqual([[], [A]]);
        expect(game.maxDrift).toBe(0);
    });
    it('the rebuilt ON tape replays on the model at 0 px against the game\'s own stream', async () => {
        const { records, solved } = await chestIncidentalWitness();
        expect(solved.verdict).toBe('SOLVED');
        expect(solved.tape.tick_count).toBe(game.tick_count);
        const r = runTape(solved.tape, { levelSource: levelSourceFromAtlas(records) });
        const model = r.ticks.map((o) => [o.t, o.x, o.y, o.level]);
        expect(model).toHaveLength(game.gameTicks.length);
        expect(model).toEqual(game.gameTicks);
        expect((r.chestOpens ?? []).map((c) => [c.id, c.t])).toEqual(game.model.chestOpens.map((c) => [c.id, c.t]));
    }, 60_000);
});
