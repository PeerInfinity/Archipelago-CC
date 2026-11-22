/**
 * ⛓⛓ hammer-phase TB-WEAPONS (`tbWeaponArms.js`, `SEEDLING_TB_WEAPON_ARMS`, OFF) — the Tentacled Beast's verb per weapon.
 *
 * Strata: (1) the weapon row, read from the press model (the Spear's rect, reach and cadence; no level, no body); (2) the
 * arm table (OFF null, a sword null, a Spear a row, a Wand-only bag a refusal by name); (3) the policy's identity (no
 * row = the sword's memory, unchanged); (4) the solver on the committed L57 witness stagings (shipped RNG model): OFF the
 * sword-only refusal word for word, ON the Spear opens the mouth with no hit and leaves into L58. The rows USE the
 * stagings as witnesses; nothing in the module names them.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { INVENTORY_ITEM_IDS, appendInventorySlots, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { withContactFidelity } from './contactFidelity.js';
import { SPEAR_ANIM_TICKS } from './combatVerbs.js';
import { SPEAR_LENGTH } from './presses.js';
import { spearStrikeGeometry } from './spearArm.js';
import { createTentacleBeastPolicy, tentacleBeastPolicyStep } from './tentacleBeastPolicy.js';
import { TENTACLE } from './tentacleBeast.js';
import { solveSegment } from './solverBot.js';
import {
    TB_WEAPON_ARMS, TB_WEAPON_ARMS_DEFAULT, tentacleWeaponArm, tentacleWeaponRow, withTbWeaponArms,
} from './tbWeaponArms.js';

const here = dirname(fileURLToPath(import.meta.url));
const SITTING = (over = {}) => ({ id: 't', x: 100, y: 120, right: true, anim: 'sit', destroy: false, hitsTimer: 0, ...over });
const BAG = (over) => ({ hasSword: false, hasFire: true, hasSpear: false, hasWand: false, ...over });

describe('TB-WEAPONS: the switch', () => {
    it('ships OFF, and with() restores it', () => {
        expect(TB_WEAPON_ARMS_DEFAULT).toBe(false);
        expect(TB_WEAPON_ARMS.enabled).toBe(false);
        withTbWeaponArms(true, () => expect(TB_WEAPON_ARMS.enabled).toBe(true));
        expect(TB_WEAPON_ARMS.enabled).toBe(false);
    });
});

describe('TB-WEAPONS: the Spear row is the press model\'s', () => {
    const row = tentacleWeaponRow(spearStrikeGeometry());
    it('extent is the thrust rect\'s length, period the thrust\'s animation', () => {
        expect(row.weapon).toBe('spear');
        expect(row.extent).toBe(SPEAR_LENGTH);
        expect(row.period).toBe(SPEAR_ANIM_TICKS);
    });
    it('lands from below up to the rect\'s length, not past it; a sideways thrust from below misses', () => {
        const t = SITTING();
        const half = TENTACLE.hitbox.h - TENTACLE.hitbox.originY;
        expect(row.lands(t.x, t.y + 20, 1, t)).toBe(true);
        expect(row.lands(t.x, t.y + SPEAR_LENGTH + half - 2, 1, t)).toBe(true);
        expect(row.lands(t.x, t.y + SPEAR_LENGTH + half + 4, 1, t)).toBe(false);
        expect(row.lands(t.x, t.y + 20, 0, t)).toBe(false);
    });
});

describe('TB-WEAPONS: the arm table', () => {
    const slots = (bag) => appendInventorySlots([], bag).slots;
    it('OFF: null for every bag', () => {
        for (const b of [BAG({ hasSpear: true }), BAG({ hasWand: true }), BAG({})]) {
            expect(tentacleWeaponArm(b, slots(b))).toBe(null);
        }
    });
    it('ON: a sword is today\'s policy (null); a Spear is a row on its own slot; a Wand-only bag refuses by name', () => {
        withTbWeaponArms(true, () => {
            const sword = BAG({ hasSword: true, hasSpear: true });
            expect(tentacleWeaponArm(sword, slots(sword))).toBe(null);
            const spear = BAG({ hasSpear: true, hasWand: true });
            const a = tentacleWeaponArm(spear, slots(spear));
            expect(a.weapon).toBe('spear');
            expect(slots(spear)[a.slot]).toBe(INVENTORY_ITEM_IDS.spear);
            expect(a.slot).not.toBe(0); // the Fire holds slot 0 in this bag: the verb must equip
            const wand = BAG({ hasWand: true });
            expect(tentacleWeaponArm(wand, slots(wand)).refusal).toMatch(/wandShotBlockerAt` has no tentacle arm/);
            expect(tentacleWeaponArm(BAG({}), slots(BAG({}))).refusal).toMatch(/holds neither/);
        });
    });
});

describe('TB-WEAPONS: the policy', () => {
    it('no row: the memory is the sword\'s, field for field', () => {
        expect(Object.keys(createTentacleBeastPolicy()).sort()).toEqual(['lastPress', 'log', 'params', 'target', 'tick']);
    });
    it('a Spear row strikes from past the sword\'s reach, and not again inside its cadence', () => {
        const row = tentacleWeaponRow(spearStrikeGeometry());
        const t = SITTING();
        const view = { beast: { dead: false, activated: true, x: 80, y: 48 }, tentacles: [t], whirlpools: [] };
        const sword = createTentacleBeastPolicy();
        expect(tentacleBeastPolicyStep(sword, { view, p: { x: t.x, y: t.y + 24 }, slashing: false }).has('primary')).toBe(false);
        const mem = createTentacleBeastPolicy(undefined, row);
        const first = tentacleBeastPolicyStep(mem, { view, p: { x: t.x, y: t.y + 24 }, slashing: false });
        expect([...first].sort()).toEqual(['primary', 'up']);
        for (let k = 1; k <= row.period; k += 1) {
            expect(tentacleBeastPolicyStep(mem, { view, p: { x: t.x, y: t.y + 24 }, slashing: false }).has('primary')).toBe(false);
        }
        expect(tentacleBeastPolicyStep(mem, { view, p: { x: t.x, y: t.y + 24 }, slashing: false }).has('primary')).toBe(true);
    });
});

/** The L57 clear-tag + the mouth, on a committed witness staging, with the given arm's bag and its own slot. */
function solveL57(name, arm) {
    const w = JSON.parse(readFileSync(join(here, 'fixtures/tentaclebeast-witness', `${name}.json`), 'utf8'));
    const items = { ...w.tape.seam.items, hasSword: arm === 'sword', hasSpear: arm === 'spear', hasWand: arm === 'wand' };
    // the staged primary stays slot 0 (the Fire in a bladeless bag): the verb selects its weapon itself
    const tape = { ...w.tape, seam: { ...w.tape.seam, items }, equips: arm === 'sword' ? w.tape.equips : [], inputs: [],
        tick_count: 0 };
    const goals = [
        { kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48' },
        { kind: 'reach-exit', exit: { x: 96, y: 64 } },
    ];
    const SRC = atlasLevelSource();
    return withContactFidelity({ tentacleBeastFight: true, tentacleHitlessFirst: true }, () => {
        const staging = stagingFromTape(parseTape(JSON.stringify(tape)));
        const run = createRunForStaging(staging, SRC);
        try {
            const out = solveSegment({ run, goals, name: `${name}-${arm}`, boot: staging.boot,
                forkRun: () => createRunForStaging(staging, SRC) });
            const rec = out.records.find((r) => r.verb === 'tentaclebeast');
            return { ok: true, level: run.level, ticks: out.perTick.length, hits: (run.ledger('playerHits') ?? []).length,
                deaths: run.playerDeaths.length, cleared: run.earnedClears.map((c) => `${c.level}:${c.tag}`), rec,
                weapons: [...new Set((run.ledger('presses') ?? []).map((q) => q.weapon))] };
        } catch (e) {
            return { ok: false, error: String(e?.message ?? e) };
        }
    });
}

describe('TB-WEAPONS: the solver on the L57 witness stagings (shipped-RNG model)', () => {
    it('OFF: a Spear bag refuses with the sword-only text, word for word', () => {
        const r = solveL57('tb-hitless-door', 'spear');
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/a tentacle dies to one sword hit while it sits; this run holds no sword$/);
    });
    it('ON: the Spear opens the mouth with no hit and no death, and the walk leaves into L58 (door: 2073 t)', () => {
        const r = withTbWeaponArms(true, () => solveL57('tb-hitless-door', 'spear'));
        expect(r.ok, r.error).toBe(true);
        expect({ level: r.level, ticks: r.ticks, hits: r.hits, deaths: r.deaths, cleared: r.cleared, weapons: r.weapons })
            .toEqual({ level: 58, ticks: 2073, hits: 0, deaths: 0, cleared: ['57:0'], weapons: ['spear'] });
        expect(r.rec.weapon).toBe('spear');
        expect(r.rec.choice.rule).toBe('hitless');
    });
    it('ON: the pit arrival too (1936 t)', () => {
        const r = withTbWeaponArms(true, () => solveL57('tb-hitless-pit', 'spear'));
        expect(r.ok, r.error).toBe(true);
        expect([r.level, r.ticks, r.hits, r.deaths]).toEqual([58, 1936, 0, 0]);
    });
    it('ON: a Wand-only bag refuses by name (the model\'s shot does not meet a tentacle)', () => {
        const r = withTbWeaponArms(true, () => solveL57('tb-hitless-door', 'wand'));
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/no Wand play can be checked on a fork/);
    });
    it('ON: a sword run is today\'s (door: 977 t, 0 hits)', () => {
        const r = withTbWeaponArms(true, () => solveL57('tb-hitless-door', 'sword'));
        expect([r.ok, r.level, r.ticks, r.hits]).toEqual([true, 58, 977, 0]);
    });
});
