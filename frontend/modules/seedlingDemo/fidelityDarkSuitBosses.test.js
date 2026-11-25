/**
 * ⛓ SEEDLING FIDELITY DARKSUITBOSSES (wave 48) — the dark suit's retaliation into a BOSS
 * (`CONTACT_FIDELITY.darkSuitBossRetaliation`, OFF).
 *
 *     Player.as:1384-1387   if (e && hasDarkSuit) e.hit(darkSuitForce, new Point(x, y), darkSuitDamage, "Suit");
 *
 * Four boss arms passed `e` (the boss itself) and no `retaliate`, so every one of their contacts under the suit was
 * refused by name (`playerHit`'s `byEnemy`). D1's census (report `CC/docs/cloud-reports/
 * seedling-fidelity-darksuitbosses.md`):
 *   · ShieldBoss stab — `ShieldBoss.hit` arms an unarmed boss, and is otherwise a no-op on the "stab" frames;
 *   · BobBoss (body + swords) — `bobBossHit(…, "Suit")`: hits, i-frames, the latch, a kill; billed inside the step;
 *   · BossTotem body — a no-op (`onlyHitBy = "Wand"`, no `justKnock`);
 *   · FinalBoss (Owl) body — NOT declared: its `justKnock` knockback lands in `v` before the phase arms read it.
 *
 * Each row stages a committed boss tape with a `darksuit` grant (`tools/stage.mjs` in the report's evidence).
 * ⚠ With that grant the tapes' `primary` presses swing nothing, so the stagings drive movement and dialogue only.
 */
import { describe, expect, it } from 'vitest';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { heldKeysAt } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

const levelSource = atlasLevelSource();
const KEY = 'darkSuitBossRetaliation';
const REFUSAL = /hasDarkSuit` retaliates INTO the attacker/;

/** Boot `tape` with the suit (and `health` extra hearts), drive its keys for `ticks` (`hold` from `from` on). */
function stage({ tape: name, ticks, hold = null, from = 0, presses = true, suit = true, health = 0, noDamage = null,
    sources, peekBob = false }, on) {
    const tape = loadTape(name);
    const extra = [...(suit ? ['darksuit'] : []), ...Array(health).fill('health')];
    const grants = [...(tape.grants ?? []), ...(extra.length ? [{ level: tape.boot.level, items: extra }] : [])];
    return withContactFidelity({ [KEY]: on }, () => {
        const st = stagingFromTape(tape);
        const run = createRunForStaging({ ...st, grants, noDamage: noDamage ?? st.noDamage }, levelSource);
        let thrown = null;
        try {
            for (let t = 0; t < ticks; t += 1) {
                let keys = heldKeysAt(tape, t);
                if (!presses) keys = new Set([...keys].filter((k) => k !== 'primary'));
                if (hold !== null && t >= from) keys = new Set([hold]);
                run.advance(keys);
            }
        } catch (e) {
            thrown = e.message;
        }
        return {
            thrown,
            hits: run.ledger('playerHits').filter((h) => sources.includes(h.source)),
            bob: run.ledger('bobBossEvents'),
            clears: run.ledger('earnedClears'),
            ...(peekBob ? { boss: run.entities('bobBoss').get('boss') ?? null } : {}),
        };
    });
}

const SHIELD = { tape: 'r6-shield-control', ticks: 460, presses: false, sources: ['shieldBossStab'] };
const BOB = { tape: 'r5-bobboss-fire', ticks: 1600, noDamage: false, health: 6, sources: ['bobBoss'] };
const TOTEM = { tape: 'r6-totem-kill', ticks: 230, hold: 'up', from: 150, sources: ['bossBody'] };
const OWL = { tape: 'r6-owl-kill', ticks: 816, sources: ['owlBody'] };

describe('DARKSUITBOSSES — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_DARK_SUIT_BOSS_RETALIATION)(
        'ships OFF, appended before OWLSUIT, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            // ⛓ wave 49: OWLSUIT `owlContactInStep` was appended after this key.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf(KEY) + 1)).toEqual(['owlContactInStep', 'turretSuitRetaliation', 'pickupTickFreeze', 'dialogueFrameFreeze', 'frozenTickUngated', 'freezeEdgeFrames', 'freezeReleaseTick', 'freezeSpanUpdates', 'nestedRockCeremony', 'plainPickupInFreeze', 'chestCoverFencepost', 'presserRecursionHang']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_DARK_SUIT_BOSS_RETALIATION');
        });
});

describe('DARKSUITBOSSES — ShieldBoss stab (L19 `shieldboss@80,32`, `r6-shield-control` stance)', () => {
    const id = 'shieldboss@80,32';
    it('OFF: the stab is the named `byEnemy` refusal', () => {
        const off = stage(SHIELD, false);
        expect(off.thrown).toMatch(/the `shieldBossStab` hit \(shieldboss@80,32\) at tick 159 in level 19/);
        expect(off.thrown).toMatch(REFUSAL);
        expect(off.hits).toEqual([]);
    });
    it('ON: the first stab ARMS him (the swallowed hit); an armed stab is a no-op ("stab" is not "sit")', () => {
        const on = stage(SHIELD, true);
        expect(on.thrown).toBe(null);
        expect(on.hits.map((h) => [h.t, h.hits, h.retaliation])).toEqual([
            [159, 1, { id, as3: 'ShieldBoss', landed: false, swallowed: true, activated: true,
                why: 'activated — the swallowed first hit' }],
            [343, 2, { id, as3: 'ShieldBoss', landed: false, swallowed: false, activated: true,
                why: 'anim "stab" != "sit"' }],
        ]);
    });
    it('without the suit the rows carry no `retaliation` key, ON or OFF (older rows byte-identical)', () => {
        const a = stage({ ...SHIELD, suit: false }, false);
        const b = stage({ ...SHIELD, suit: false }, true);
        expect(a).toEqual(b);
        expect(a.hits.length).toBeGreaterThan(0);
        for (const h of a.hits) expect(h).not.toHaveProperty('retaliation');
    });
});

describe('DARKSUITBOSSES — BobBoss (L32, `r5-bobboss-fire` with damage on)', () => {
    it('OFF: the first sword contact is the named refusal', () => {
        const off = stage(BOB, false);
        expect(off.thrown).toMatch(/the `bobBoss` hit \(bobboss#0:sword0\) at tick 231 in level 32/);
        expect(off.thrown).toMatch(REFUSAL);
    });
    it('ON: every contact bills, and `Enemy.hit(0, null, 1, "Suit")` lands in the boss — the suit kills each form', () => {
        const on = stage(BOB, true);
        expect(on.thrown).toBe(null);
        const row = (h) => [h.t, h.id, h.retaliation.form, h.retaliation.hits, h.retaliation.swords,
            h.retaliation.killed === true];
        expect(on.hits.map(row)).toEqual([
            [231, 'bobboss#0:sword0', 0, 1, 1, false],
            [286, 'bobboss#0:body', 0, 2, 1, true],
            [886, 'bobboss#1:sword0', 1, 1, 2, false],
            [935, 'bobboss#1:body', 1, 2, 2, false],
            [965, 'bobboss#1:body', 1, 3, 2, true],
            // form 2: `BobBoss.hit`'s own-gate re-seed adds a blade (2 → 3) on the first; the second passes the
            // boss's live i-frame through the `hitByDarkStuff` latch and adds none (its gate reads `hitsTimer`)
            [1426, 'bobboss#2:sword0', 2, 1, 3, false],
            [1446, 'bobboss#2:sword0', 2, 2, 3, true],
        ]);
        for (const h of on.hits) expect(h.retaliation).toMatchObject({ as3: 'BobBoss', landed: true, hitByDarkStuff: true });
        // the ledger's `boss-hit` rows carry `by: 'suit'`, one per retaliation, BEFORE the `player-hit` row they ride
        const suit = on.bob.filter((r) => r.what === 'boss-hit');
        expect(suit.map((r) => [r.by, r.form, r.landed])).toEqual(on.hits.map((h) => ['suit', h.retaliation.form, true]));
        // and the third form's death writes the `Times` report, as a sword kill does
        expect(on.clears.map((c) => `${c.level}:${c.tag}@${c.by}`)).toEqual(['32:1@fallrocklarge', '32:3@bobboss#2']);
    });
    it('form 2: a BODY contact re-seeds the blades BEFORE `spin` — the bill is inside the step, as in the game', () => {
        // `BobBoss.update` → `Enemy.update`'s `hitPlayer` (→ the retaliation's re-seed) → `BobSoldier.update`'s
        // `swordSpinningStep`: blade 0 is re-seeded to 3π/2 and then spun once by form 2's rate (−π/20).
        const on = stage({ ...BOB, ticks: 1413, hold: 'up', from: 1400, peekBob: true }, true);
        expect(on.thrown).toBe(null);
        const last = on.hits.at(-1);
        expect([last.t, last.id, last.retaliation.swords]).toEqual([1413, 'bobboss#2:body', 3]);
        expect(on.boss.swordSpin[0]).toBeCloseTo(3 * Math.PI / 2 - Math.PI / 20, 12);
    });
    it('without the suit, ON and OFF are identical (the in-step bill is suit-only)', () => {
        const a = stage({ ...BOB, suit: false }, false);
        const b = stage({ ...BOB, suit: false }, true);
        expect(a).toEqual(b);
        expect(a.hits.length).toBeGreaterThan(0);
        for (const h of a.hits) expect(h).not.toHaveProperty('retaliation');
    });
});

describe('DARKSUITBOSSES — BossTotem body (L43 `bosstotem@152,168`, `r6-totem-kill` then `up`)', () => {
    it('OFF: the body contact is the named refusal', () => {
        const off = stage(TOTEM, false);
        expect(off.thrown).toMatch(/the `bossBody` hit \(bosstotem@152,168\) at tick 170 in level 43/);
        expect(off.thrown).toMatch(REFUSAL);
    });
    it('ON: it bills exactly as without the suit, plus a no-op retaliation row', () => {
        const on = stage(TOTEM, true);
        const bare = stage({ ...TOTEM, suit: false }, true);
        expect(on.thrown).toBe(null);
        expect(on.hits.map((h) => h.t)).toEqual([170, 194, 220]);
        expect(on.hits.map(({ retaliation, ...h }) => h)).toEqual(bare.hits);
        for (const h of on.hits) {
            expect(h.retaliation).toEqual({ id: 'bosstotem@152,168', as3: 'BossTotem', landed: false, effect: 'none',
                why: '`BossTotem.hit` → `Enemy.hit` (Enemies/BossTotem.as:719-725): `onlyHitBy = "Wand"` (:262) and '
                    + '`justKnock` false (Enemies/Enemy.as:42, :149-180); `knockback` is empty (:727)' });
        }
    });
});

describe('DARKSUITBOSSES — the arm D1 leaves undeclared', () => {
    it('Owl body (L112 `finalboss@64,96`): refused ON as OFF, and ON the refusal names the D1 reason', () => {
        const off = stage(OWL, false);
        const on = stage(OWL, true);
        expect(off.thrown).toMatch(/the `owlBody` hit \(finalboss@64,96\) at tick 27 in level 112/);
        expect(off.thrown).toMatch(REFUSAL);
        expect(off.thrown).not.toMatch(/DARKSUITBOSSES/);
        expect(on.thrown).toMatch(REFUSAL);
        expect(on.thrown).toMatch(/fidelity DARKSUITBOSSES D1: `FinalBoss.hit` is `Enemy.hit` with `onlyHitBy = "Lava"`/);
    });
});
