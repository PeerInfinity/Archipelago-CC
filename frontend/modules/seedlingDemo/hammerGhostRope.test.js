/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE GHOSTROPE — the PULL rung (and the `rope` verb) cut a rope with the GHOST SWORD
 * (`ghostRopeCut.GHOST_ROPE_CUT`, ON since its 2026-11-02 flip; `SEEDLING_GHOST_ROPE_CUT=0` opts out).
 *
 * ⚖ The user (2026-10-30): *"ghost sword replaces the sword, so the solver shouldn't attempt to switch to regular sword
 * when it has ghost sword."* The rows:
 *   · THE GAME — the four p4g recordings (`probe-seedling-ghost-rope.mjs --record`): the ghost sword cuts from 15.1
 *     and 23.1 px, the sword not from 23.1, nothing from 27.1; the model agrees at 0 px, and the press table this slice
 *     prices with sits between those distances; and the fifth, the SOLVER's own ON plan for L16's cut, played as planned;
 *   · THE FIXTURES — the lab's ENDGAME `ropegate` rooms (seeds 1-3, the certification solve's own record): OFF the
 *     PULL rung refuses naming `ghostsword`; ON they solve by `pull` with the ghost sword, and the tape replayed in the
 *     model pulls the rope and collects the goal with no hit (⚖ 30(c): the walk certified is the walk driven);
 *   · THE GHOST'S OWN PRICE — a hand-built room with a `LightPole` beside the rope: ON the stance is (20,172), 20 px
 *     from the rope (beyond the sword's 16) and clear of the pole the 24 x 48 rect would toggle from (24,184);
 *   · L16's `rope` verb, the endgame bag: OFF refused naming `ghostsword`; ON the verb's own ghost swing from the boot;
 *   · SHIPS OFF; a SWORD room and a room with NO ROPE are byte-identical ON and OFF.
 * Mutants (the report): the sword's row back in the ghost's place reds the weapon rows; the ghost priced with the
 * sword's rect and reach reds the pole row; the arm dropped reds every ON row.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    GHOST_ROPE_CUT, GHOST_ROPE_CUT_DEFAULT, GHOST_ROPE_STRAY_ARMS, ROPE_SWING_PRESS, ropeSwingFor, withGhostRopeCut,
} from './ghostRopeCut.js';
import {
    GHOST_ROPE_PLAN_WITNESSES, GHOST_ROPE_TARGET, GHOST_ROPE_WITNESSES, GHOST_ROPE_WITNESS_DIR, ghostRopeModel,
    ghostRopePlanTape,
} from './ghostRopeWitness.js';
import { compareWitness, ropeStaging } from './fidelityRope.js';
import { DEFAULT_BUDGET, bootStaging, collectGoal, solve } from './procgenOracle.js';
import { atlasOf, bootAtTile, emptyLevel, oelAtTile, withEntities } from './procgenLevel.js';
import { ENDGAME_ITEMS, POST_SWORD_ITEMS } from './procgenPalette.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, createTapeStepper } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { twoPassSolve } from './twoPassSolve.js';
import { DOWN, SLASH_REACH, auditPress, distanceRectPoint } from './presses.js';
import { GHOST_SWORD_REACH } from './ghostSword.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures', 'ghost-rope');
const fixture = (seed) => JSON.parse(readFileSync(join(FIXTURES, `endgame-ropegate-s${seed}.json`), 'utf8'));
const recording = (name) => JSON.parse(readFileSync(join(GHOST_ROPE_WITNESS_DIR, `${name}.json`), 'utf8'));

const solveFixture = (fx, items = fx.items) => solve(fx.record, bootStaging({ boot: fx.boot, items, pins: fx.pins }),
    fx.goals, DEFAULT_BUDGET, { name: `procgen-l${fx.record.level}` });
/** A solve's result without its wall clock (`ms`), for the byte-identity rows. */
const stable = (out) => JSON.stringify({ ...out, ms: undefined });
const pullOf = (out) => (out.records ?? []).find((r) => r.strategy === 'pull') ?? null;

/** Replay a solve's tape in the model: the walk the certificate names, driven. */
function replay(record, tape) {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(tape)), {
        levelSource: levelSourceFromAtlas(atlasOf(record)), onTick: (t, s, h, rn) => { run = rn; },
    });
    for (let r = st.next(); !r.done; r = st.next()) { /* drive every tick */ }
    return run;
}

/** The hand-built room: `procgenRopeGate.test.js`'s L16-shaped 20x15 with a `LightPole` (tag 2) at tile `pole`. */
function poleRoom(items, pole = [3, 13]) {
    const at = (type, tx, ty, attrs) => ({ type, ...oelAtTile(tx, ty), ...(attrs ? { attrs } : {}) });
    const record = withEntities(emptyLevel({ level: 900, width: 20, height: 15 }), [
        at('torchpickup', 18, 13, { tag: '0' }), at('arrowtrap', 4, 1, { tset: '0', shoot: '1' }),
        { ...at('rope', 1, 12, { tset: '0', tag: '1' }), nodes: [oelAtTile(2, 12)] },
        at('lightpole', pole[0], pole[1], { t: '5', tag: '2' }),
    ]);
    const out = solve(record, bootStaging({ boot: bootAtTile(record, 1, 1), items }),
        [collectGoal(18 * 16, 13 * 16)], DEFAULT_BUDGET, { name: 'ghostrope-pole-room' });
    return { record, out };
}

const L16_CUT = { kind: 'clear-tag', tag: { level: 16, tag: 0 }, at: { x: 32, y: 16 }, obstacle: 'rope@32,16' };
async function l16Verb(boot) {
    const staging = await ropeStaging({ boot, items: ['hasSword', 'hasGhostSword'] });
    const levelSource = atlasLevelSource();
    try {
        const solved = await twoPassSolve({
            makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
            goals: [L16_CUT], name: 'ghostrope-l16-verb', boot: staging.boot, dashMode: 'all',
            persistence: staging.persistence, log: () => {},
        });
        return { solved, refused: null };
    } catch (e) {
        return { solved: null, refused: e };
    }
}

describe('⛓⛓⛓ GHOSTROPE — the game: the ghost sword cuts a rope, from up to 24 px (p4g, recorded)', () => {
    it('the four recordings: game = model at 0 px, and the cut where (and only where) the witness says', async () => {
        const facts = {};
        for (const w of GHOST_ROPE_WITNESSES) {
            const rec = recording(w.name);
            expect(rec.page).toBe('seedling_bot_ap_p4g');
            const model = await ghostRopeModel(rec.tape);
            expect(compareWitness(rec.samples, model.samples)).toEqual([]);
            expect(rec.samples.every((s) => !s.hits)).toBe(true);
            facts[w.name] = { cutAt: rec.cutAt, pull: model.pulls[0]?.t ?? null, d: rec.testFrom.d };
        }
        expect(facts).toEqual({
            'ghostrope-l16-near': { cutAt: 3, pull: 2, d: 15.1 },
            'ghostrope-l16-reach': { cutAt: 3, pull: 2, d: 23.1 },
            'ghostrope-l16-reach-sword': { cutAt: null, pull: null, d: 23.1 },
            'ghostrope-l16-out': { cutAt: null, pull: null, d: 27.1 },
        });
        expect(GHOST_ROPE_TARGET.id).toBe('rope@32,16');
    }, 60000);

    it('the SOLVER\'s ON plan (L16, `rope` verb, ghost sword) is the tape the game played: game = model, cut at t5',
        async () => {
            const [w] = GHOST_ROPE_PLAN_WITNESSES;
            const rec = recording(w.name);
            const { tape, solved } = await ghostRopePlanTape(w);
            expect(JSON.stringify(tape.inputs)).toBe(JSON.stringify(rec.tape.inputs));
            expect(solved.out.records.find((r) => r.goal === 'clear-tag'))
                .toMatchObject({ arm: 'verb', weapon: 'ghostsword', stance: null });
            const model = await ghostRopeModel(rec.tape);
            expect(compareWitness(rec.samples, model.samples)).toEqual([]);
            expect({ cutAt: rec.cutAt, pull: model.pulls[0]?.t }).toEqual({ cutAt: 5, pull: 4 });
            expect(rec.samples.every((s) => !s.hits)).toBe(true);
        }, 60000);

    it('the press table this slice prices with sits between the witnessed distances', () => {
        expect(ROPE_SWING_PRESS.ghostsword.reach).toBe(GHOST_SWORD_REACH);
        expect(ROPE_SWING_PRESS.sword.reach).toBe(SLASH_REACH);
        expect(ROPE_SWING_PRESS.ghostsword.reach).toBeGreaterThanOrEqual(23.1);
        expect(ROPE_SWING_PRESS.ghostsword.reach).toBeLessThan(27.1);
        expect(ROPE_SWING_PRESS.sword.reach).toBeLessThan(23.1);
        expect(ROPE_SWING_PRESS.ghostsword.rectAt(80, 56, 1)).toMatchObject({ w: 48, h: 24 });
        expect(GHOST_ROPE_STRAY_ARMS).toEqual(['LightPole', 'Tile', 'PushableBlockSpear']);
    });
});

describe('⛓ GHOSTROPE — ships ON (⚖ the user, 2026-11-02: "Flip GHOST_ROPE_CUT")', () => {
    it('the default is ON, the switch reads only `=0` to opt out, and the page channel knows its name', () => {
        expect(GHOST_ROPE_CUT_DEFAULT).toBe(true);
        expect(GHOST_ROPE_CUT.enabled).toBe(globalThis.process?.env?.SEEDLING_GHOST_ROPE_CUT !== '0');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_GHOST_ROPE_CUT');
    });

    it('OFF a ghost primary is no rope swing; ON it is the GHOST\'s (never the sword\'s), and only when it tests', () => {
        const both = { hasSword: true, hasGhostSword: true };
        withGhostRopeCut(false, () => expect(ropeSwingFor('ghostsword', both)).toBeNull());
        withGhostRopeCut(true, () => {
            expect(ropeSwingFor('ghostsword', both)).toBe(ROPE_SWING_PRESS.ghostsword);
            expect(ropeSwingFor('sword', { hasSword: true })).toBe(ROPE_SWING_PRESS.sword);
            /** `slash()` runs only `if (hasSword)`: a ghost without the sword never tests */
            expect(ropeSwingFor('ghostsword', { hasSword: false, hasGhostSword: true })).toBeNull();
            expect(ropeSwingFor('spear', both)).toBeNull();
        });
    });
});

describe('⛓⛓⛓ GHOSTROPE — the lab\'s ENDGAME ropegate rooms (seeds 1-3)', () => {
    for (const seed of [1, 2, 3]) {
        it(`seed ${seed}: OFF the PULL rung refuses naming the ghost sword; ON it cuts with it and the walk is driven`,
            () => {
                const fx = fixture(seed);
                const off = withGhostRopeCut(false, () => solveFixture(fx));
                expect(off.verdict).toBe('REFUSED');
                expect(off.reasonText).toMatch(/pull: rope@\d+,\d+ silences \[arrowtrap@\d+,16\][^\n]*fires `ghostsword`/);

                const on = withGhostRopeCut(true, () => solveFixture(fx));
                expect(on.verdict).toBe('SOLVED');
                expect(on.records.map((r) => r.strategy)).toEqual(['pull', 'collect']);
                expect(pullOf(on).weapon).toBe('ghostsword');
                expect(on.tape.equips).toEqual([]);
                /** ⚖ 30(c): the certificate's tape, driven in the model, cuts the rope and collects with no hit */
                const rope = fx.record.entities.find((e) => e.type === 'rope');
                const run = replay(fx.record, on.tape);
                expect(run.ledger('ropePulls').map((p) => p.id)).toEqual([`rope@${rope.x},${rope.y}`]);
                expect(run.damage.hits).toBe(0);
                expect(on.certification.certified).toBe(true);
            }, 120000);
    }

    it('a SWORD bag in the same room is byte-identical ON and OFF', () => {
        const fx = fixture(2);
        const off = withGhostRopeCut(false, () => solveFixture(fx, POST_SWORD_ITEMS));
        const on = withGhostRopeCut(true, () => solveFixture(fx, POST_SWORD_ITEMS));
        expect(off.verdict).toBe('SOLVED');
        expect(pullOf(off).weapon).toBeUndefined();
        expect(stable(on)).toBe(stable(off));
    }, 120000);

    it('a room with NO ROPE is byte-identical ON and OFF (the ghost bag)', () => {
        const fx = fixture(1);
        const bare = { ...fx, record: { ...fx.record,
            entities: fx.record.entities.filter((e) => e.type !== 'rope' && e.type !== 'arrowtrap') } };
        const off = withGhostRopeCut(false, () => solveFixture(bare));
        const on = withGhostRopeCut(true, () => solveFixture(bare));
        expect(off.verdict).toBe('SOLVED');
        expect(stable(on)).toBe(stable(off));
    }, 120000);
});

describe('⛓⛓ GHOSTROPE — priced with the ghost\'s OWN press (the LightPole room)', () => {
    it('the geometry: from (24,184) facing down the GHOST rect reaches a pole at tile (2,13) — the sword\'s does not', () => {
        const { record } = withGhostRopeCut(false, () => poleRoom(ENDGAME_ITEMS, [2, 13]));
        const run = createRunForStaging(bootStaging({ boot: bootAtTile(record, 1, 1), items: ENDGAME_ITEMS }),
            levelSourceFromAtlas(atlasOf(record)));
        const live = (rect) => auditPress(run.world, rect, { weapon: 'spear' }).live.map((r) => `${r.as3}@${r.x},${r.y}`);
        expect(live(ROPE_SWING_PRESS.ghostsword.rectAt(24, 184, DOWN)))
            .toEqual(['RopeStart@16,192', 'LightPole@32,208']);
        expect(live(ROPE_SWING_PRESS.sword.rectAt(24, 184, DOWN))).toEqual(['RopeStart@16,192']);
        /** and within the ghost's reach of the point, so the game's `slash()` would toggle it */
        const pole = auditPress(run.world, ROPE_SWING_PRESS.ghostsword.rectAt(24, 184, DOWN), { weapon: 'spear' })
            .live.find((r) => r.as3 === 'LightPole');
        expect(distanceRectPoint(24, 184, pole.rect)).toBeLessThanOrEqual(GHOST_SWORD_REACH);
    });

    it('ON (pole at (3,13)): the cut stands 20 px off the rope — beyond the sword\'s reach — with the swing\'s swept '
        + 'rect off the pole, and the walk toggles no pole; OFF refuses', () => {
        const off = withGhostRopeCut(false, () => poleRoom(ENDGAME_ITEMS).out);
        expect(off.verdict).toBe('REFUSED');
        const { record, out } = withGhostRopeCut(true, () => poleRoom(ENDGAME_ITEMS));
        expect(out.verdict).toBe('SOLVED');
        const pull = pullOf(out);
        expect(pull).toMatchObject({ weapon: 'ghostsword', stance: { x: 20, y: 172 }, target: 'rope@16,192' });
        expect(pull.pressedAt).not.toBeNull();
        const rope = { x: 16, y: 192, w: 32, h: 16, right: 48, bottom: 208 };
        const d = distanceRectPoint(pull.stance.x, pull.stance.y, rope);
        expect(d).toBeGreaterThan(SLASH_REACH);
        expect(d).toBeLessThanOrEqual(GHOST_SWORD_REACH);
        const run = replay(record, out.tape);
        expect(run.ledger('ropePulls').map((p) => p.id)).toEqual(['rope@16,192']);
        expect(run.damage.hits).toBe(0);
        expect((run.ledger('presses') ?? []).flatMap((p) => p.hits ?? []).filter((h) => h.as3 === 'LightPole'))
            .toEqual([]);
    }, 120000);
});

describe('⛓⛓ GHOSTROPE — L16\'s `rope` verb, the endgame bag', () => {
    it('OFF refused naming `ghostsword`; ON the verb\'s own ghost swing from the boot, no equip', async () => {
        const off = await withGhostRopeCut(false, () => l16Verb({ level: 16, x: 72, y: 40 }));
        expect(off.solved).toBeNull();
        expect(off.refused.message).toMatch(/'rope' cannot act on rope@32,16[^\n]*fires `ghostsword`/);
        const on = await withGhostRopeCut(true, () => l16Verb({ level: 16, x: 72, y: 40 }));
        expect(on.refused).toBeNull();
        const cut = on.solved.out.records.find((r) => r.goal === 'clear-tag');
        expect(cut).toMatchObject({ strategy: 'rope', arm: 'verb', weapon: 'ghostsword', stance: null });
        expect(on.solved.out.equips ?? []).toEqual([]);
    }, 120000);
});
