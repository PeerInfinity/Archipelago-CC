/**
 * ⛓ SEEDLING FIDELITY APBOSSES — the R4 boss-report AS3 (`apReportBosses.js`, `CONTACT_FIDELITY.apReportBosses`).
 *
 * The AS3 is PeerInfinity/Seedling `r4-boss-report` @ `0eda15f785`, in NO wasm until the rebuild R7, so there is no
 * game witness yet (the tapes to record are named in `CC/docs/cloud-reports/seedling-fidelity-apbosses.md`, D3).
 * These rows pin both arms: OFF is the vanilla model (`fidelityEncounters.test.js`, unchanged); ON follows the branch
 * line by line, with the state of each room READ off the run's persistence (`run.apReportSlotHeld`), in and out:
 *
 *   L32 fresh                   {32,3} {32,4} held: the fight (Fire held or not — Q2), the kill writes {32,3}, the
 *                               drop is collected and writes {32,4}; no item; no {31,29}
 *   L32 killed, drop held       {32,1} {32,3} cleared: the rock's first frame adds the FIRE (no boss, no playerPosition)
 *   L32 both reported           {32,1} {32,3} {32,4} cleared: nothing spawns; `already`
 *   L12 slot held               the Witch adds the sword (with or without the sword from the server); it writes {12,1}
 *   L12 slot cleared            nothing; `already`, no tick
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { PIN_NAMES, parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { solveSegment } from './solverBot.js';
import { ROLES, arenaRockOf, buildLevelWorld } from './levelWorld.js';
import { createLevelRun } from './levelRun.js';
import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';
import { progressKind } from './solveProgress.js';
import {
    AP_REPORT_ROWS, BOB_KILLED_TAG, DARK_SWORD_WITCH_TAG, FIRE_BOSS_DROP_TAG, bobBossFinalDeath, fallRockLargeSpawn,
    reportPickupRemoved, reportSlotsReadBy, witchGrantsReport,
} from './apReportBosses.js';

const ON = { apReportBosses: true };
const TAPE = JSON.parse(readFileSync(
    new URL('./fixtures/tapes/r5-bobboss-fire.json', import.meta.url), 'utf8'));
const GOAL = Object.freeze({ kind: 'encounter', at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: 'reach-pit' });
const BASE = solveStaging(stagingFromTape(parseTape(TAPE)));
const FIRE_HELD = { seam: { items: { hasSword: true, hasFire: true } }, grants: [] };
const clears = (...pairs) => pairs.map(([level, tag]) => ({ level, tag }));
const flagsOf = (rows) => rows.filter((r) => r.flag).map((r) => `${r.what} ${r.flag.level},${r.flag.tag}`);

function solveL32(over, goal = GOAL) {
    const staging = { ...BASE, ...over };
    const run = createRunForStaging(staging, atlasLevelSource());
    const out = solveSegment({ run, goals: [{ ...goal }], name: 'apb', boot: staging.boot });
    return { run, out, legs: out.records.map((r) => r.leg ?? r.goal) };
}

const WITCH_GOAL = Object.freeze({
    kind: 'encounter', at: { x: 416, y: 384 }, drop: { item: 'Progressive Sword' }, then: null });
const WITCH_BOOT = Object.freeze({ level: 12, x: 16, y: 352 });
const l12Run = (items, persistence = []) => createLevelRun({
    levelSource: atlasLevelSource(), boot: { ...WITCH_BOOT }, noclip: false, noHazards: [], noDamage: false,
    grants: [], persistence, despawn: [], equips: [], pins: [...PIN_NAMES],
    save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null, seam: { items }, roles: ROLES,
});
const solveWitch = (run) => solveSegment({ run, goals: [{ ...WITCH_GOAL }], name: 'witch', boot: { ...WITCH_BOOT } });

describe('apReportBosses.js — the R4 AS3, transcribed', () => {
    it('the switch ships OFF (it flips inside the R7 landing merge)', () => {
        expect(CONTACT_FIDELITY.apReportBosses).toBe(false);
    });
    it('nine report rows, one per (level, tag), with their upstream ids; three writers changed', () => {
        expect(AP_REPORT_ROWS.map((r) => [r.location, r.level, r.tag, r.upstream])).toEqual([
            ['Times', 32, 3, 20000018], ['Fire', 32, 4, 20000016], ['Dark Sword', 12, 1, 20000001],
            ['Owl', 112, 0, 20000008], ['Shieldspire', 19, 0, 20000013], ['Tentacled Beast', 57, 0, 20000023],
            ['Totem of Lacste', 43, 5, 20000033], ['Lights', 69, 0, 20000038], ['King of Fire', 82, 0, 20000043]]);
        expect(AP_REPORT_ROWS.filter((r) => r.changed).map((r) => r.location)).toEqual(['Times', 'Fire', 'Dark Sword']);
    });
    it('`FallRockLarge` (:116-127): the boss while {32,3} holds, else the Fire while {32,4}, else nothing', () => {
        expect(fallRockLargeSpawn({ killedHeld: true, dropHeld: true })).toEqual({ spawn: { form: 0 }, playerPosition: true });
        expect(fallRockLargeSpawn({ killedHeld: true, dropHeld: false })).toEqual({ spawn: { form: 0 }, playerPosition: true });
        expect(fallRockLargeSpawn({ killedHeld: false, dropHeld: true })).toEqual({ spawn: { fire: true }, playerPosition: false });
        expect(fallRockLargeSpawn({ killedHeld: false, dropHeld: false })).toEqual({ spawn: null, playerPosition: false });
    });
    it('`BobBoss.death` (:192-194): {32,3} written first, the Fire only while {32,4} holds', () => {
        expect(bobBossFinalDeath({ dropHeld: true })).toEqual({ writes: [{ level: 32, tag: 3 }], spawn: { fire: true } });
        expect(bobBossFinalDeath({ dropHeld: false })).toEqual({ writes: [{ level: 32, tag: 3 }], spawn: null });
    });
    it('`Witch.doneTalking` (:50): the wand and the slot, never the sword held', () => {
        expect(witchGrantsReport({ hasWand: true }, { slotHeld: true })).toBe(true);
        expect(witchGrantsReport({ hasWand: true, hasDarkSword: true }, { slotHeld: true })).toBe(true);
        expect(witchGrantsReport({ hasWand: true }, { slotHeld: false })).toBe(false);
        expect(witchGrantsReport({}, { slotHeld: true })).toBe(false);
    });
    it('`Fire.removed` clears {32,4} always; `DarkSword.removed` clears {12,1} only while it holds; neither grants', () => {
        expect(reportPickupRemoved('fire', { held: false })).toEqual({ item: null, writes: [{ level: 32, tag: 4 }] });
        expect(reportPickupRemoved('darksword', { held: true })).toEqual({ item: null, writes: [{ level: 12, tag: 1 }] });
        expect(reportPickupRemoved('darksword', { held: false })).toEqual({ item: null, writes: [] });
        expect(() => reportPickupRemoved('sword', { held: true })).toThrow(/not an R4 pickup/);
    });
    it('the slots a room\'s runtime entities read: L32 {3,4}, L12 {1}, a boss room none', () => {
        const src = atlasLevelSource();
        expect(reportSlotsReadBy(src(32).entities, arenaRockOf)).toEqual([BOB_KILLED_TAG, FIRE_BOSS_DROP_TAG]);
        expect(reportSlotsReadBy(src(12).entities, arenaRockOf)).toEqual([DARK_SWORD_WITCH_TAG]);
        expect(reportSlotsReadBy(src(19).entities, arenaRockOf)).toEqual([]);
        expect(reportSlotsReadBy(src(82).entities, arenaRockOf)).toEqual([]);
    });
});

describe('levelWorld — a staged R4 slot is READ under the switch, an orphan without it', () => {
    it('OFF: {32,3} / {32,4} / {12,1} are orphan clears (no placed entity carries them)', () => {
        const src = atlasLevelSource();
        expect(() => buildLevelWorld(src(32), { cleared: [3] })).toThrow(/no entity in this level reads/);
        expect(() => buildLevelWorld(src(32), { cleared: [4] })).toThrow(/no entity in this level reads/);
        expect(() => buildLevelWorld(src(12), { cleared: [1] })).toThrow(/no entity in this level reads/);
    });
    it('ON: the build accepts them (the arena rock and the Witch read them); other slots stay orphans', () => {
        const src = atlasLevelSource();
        withContactFidelity(ON, () => {
            expect(() => buildLevelWorld(src(32), { cleared: [1, 3, 4] })).not.toThrow();
            expect(() => buildLevelWorld(src(12), { cleared: [1] })).not.toThrow();
            expect(() => buildLevelWorld(src(19), { cleared: [3] })).toThrow(/no entity in this level reads/);
        });
    });
});

describe('the run knows which state each R4 room is in (`run.apReportSlotHeld`)', () => {
    it('reads the staging: held by default, cleared by a staged row; any other slot throws by name', () => {
        withContactFidelity(ON, () => {
            const run = createRunForStaging({ ...BASE, persistence: clears([32, 1], [32, 3]) }, atlasLevelSource());
            expect(run.apReportSlotHeld(32, 3)).toBe(false);
            expect(run.apReportSlotHeld(32, 4)).toBe(true);
            expect(() => run.apReportSlotHeld(32, 1)).toThrow(/not an R4 slot/);
        });
    });
    it('revisit, {32,3} cleared and {32,4} held: the fallen rock\'s first frame adds the FIRE, no boss, no playerPosition', () => {
        withContactFidelity(ON, () => {
            const run = createRunForStaging({ ...BASE, persistence: clears([32, 1], [32, 3]) }, atlasLevelSource());
            run.advance(new Set());
            run.advance(new Set());
            const ev = run.ledger('bobBossEvents');
            expect(ev.find((r) => r.what === 'rock-fallen-at-build')).toMatchObject(
                { boss: false, fire: true, killedHeld: false, dropHeld: true, playerPosition: null });
            expect(ev.some((r) => r.what === 'boss-added')).toBe(false);
            expect(run.entities('bobBoss').get('fire')).toEqual({ x: 80, y: 80, tag: FIRE_BOSS_DROP_TAG });
        });
    });
    it('revisit, both reported: the fallen rock adds NOTHING', () => {
        withContactFidelity(ON, () => {
            const run = createRunForStaging({ ...BASE, persistence: clears([32, 1], [32, 3], [32, 4]) },
                atlasLevelSource());
            run.advance(new Set());
            run.advance(new Set());
            const ev = run.ledger('bobBossEvents');
            expect(ev.find((r) => r.what === 'rock-fallen-at-build')).toMatchObject({ boss: false, fire: false });
            expect([...run.entities('bobBoss').keys()]).toEqual(['rock']);
        });
    });
    it('OFF, the same staging is refused at the build (the vanilla model has no reader for {32,3})', () => {
        expect(() => createRunForStaging({ ...BASE, persistence: clears([32, 1], [32, 3]) }, atlasLevelSource())
            .advance(new Set())).toThrow(/no entity in this level reads/);
    });
});

describe('the Bob Boss encounter ON (Q2: always fought; the reports, never the item)', () => {
    it('fresh, Fire from the server: the fight anyway, {32,3} then {32,4}, no grant, no {31,29}; burn, pit', () => {
        withContactFidelity(ON, () => {
            const { run, out, legs } = solveL32({ ...FIRE_HELD });
            const ev = run.ledger('bobBossEvents');
            expect(legs.filter((l) => l === 'strike')).toHaveLength(7);
            expect(legs.slice(-3)).toEqual(['drop', 'burn', 'reach-pit']);
            expect(flagsOf(ev)).toEqual(['rock-armed 32,1', 'boss-killed 32,3', 'fire-removed 32,4']);
            expect(ev.find((r) => r.what === 'fire-removed').outOfBand).toBe(false);
            expect(out.records.find((r) => r.leg === 'drop')).toMatchObject({ report: true, killedAtEntry: false,
                collected: true });
            // {32,1} (the rock's arm) is a `bobBossEvents` row and not an `earnedClears` one — as OFF, unchanged.
            expect(run.earnedClears.filter((c) => c.level === 32).map((c) => c.tag).sort()).toEqual([0, 3, 4]);
            expect(run.earnedClears.some((c) => c.level === 31)).toBe(false);
            expect(run.ledger('collected').find((r) => r.level === 32).item).toBe(null);
            expect(run.level).toBe(30);
        });
    }, 120_000);
    it('fresh, NO Fire: the fight and both reports, then the burn is refused BY NAME (a precondition)', () => {
        withContactFidelity(ON, () => {
            let err = null;
            try { solveL32({}); } catch (e) { err = e; }
            expect(err?.message).toMatch(/burns only with Fire, and under `apReportBosses` .* this run holds none/);
            expect(progressKind(err)).toBe('precondition');
        });
    }, 120_000);
    it('killed at entry, drop held (rock fallen): no fight, the Fire collected, {32,4}; burn, pit', () => {
        withContactFidelity(ON, () => {
            const { run, legs, out } = solveL32({ ...FIRE_HELD, persistence: clears([32, 1], [32, 3]) });
            const ev = run.ledger('bobBossEvents');
            expect(ev.some((r) => r.what === 'boss-added')).toBe(false);
            expect(flagsOf(ev)).toEqual(['fire-removed 32,4']);
            expect(out.records.find((r) => r.leg === 'drop')).toMatchObject({ killedAtEntry: true, collected: true });
            expect(legs).not.toContain('strike');
            expect(run.level).toBe(30);
        });
    }, 120_000);
    it('both reported, tree burned: `already`, then the pit; nothing spawns', () => {
        withContactFidelity(ON, () => {
            const { run, legs, out } = solveL32({ ...FIRE_HELD, persistence: clears([32, 0], [32, 1], [32, 3], [32, 4]) });
            expect(legs).toEqual(['drop', 'reach-pit']);
            expect(out.records.find((r) => r.leg === 'drop')).toMatchObject({ already: true, report: true });
            expect(run.ledger('bobBossEvents').some((r) => r.what === 'boss-added' || r.what === 'fire-added'))
                .toBe(false);
        });
    }, 120_000);
    it('the executor is the ROOM\'s: any AP item at L32 is Bob\'s encounter ON; OFF it is refused by the drop', () => {
        const other = { ...GOAL, drop: { item: 'Bomb' } };
        expect(() => solveL32({ ...FIRE_HELD, persistence: clears([32, 0], [32, 1]) }, other))
            .toThrow(/no encounter executor is registered for a 'Bomb' drop/);
        withContactFidelity(ON, () => {
            const { run } = solveL32({ ...FIRE_HELD, persistence: clears([32, 0], [32, 1], [32, 3], [32, 4]) }, other);
            expect(run.level).toBe(30);
        });
    }, 120_000);
});

describe('the Witch encounter ON (the slot {12,1}, never the sword held)', () => {
    it('slot held, wand: the sword is added and collected, {12,1} written in band, NO hasDarkSword grant', () => {
        withContactFidelity(ON, () => {
            const run = l12Run({ hasSword: true, hasWand: true });
            expect(run.apReportSlotHeld(12, 1)).toBe(true);
            const out = solveWitch(run);
            run.advance(new Set());
            const ev = run.ledger('witchEvents');
            expect(ev.map((r) => r.what)).toEqual(
                ['witch-open', 'witch-close', 'darksword-added', 'darksword-contact', 'darksword-removed']);
            expect(ev.find((r) => r.what === 'witch-close')).toMatchObject({ grants: true, slotHeld: true });
            expect(ev.find((r) => r.what === 'darksword-removed')).toMatchObject(
                { flag: { level: 12, tag: 1, value: false }, outOfBand: false });
            expect(run.progress('inventory').hasDarkSword).not.toBe(true);
            expect(run.apReportSlotHeld(12, 1)).toBe(false);
            expect(run.earnedClears).toContainEqual(expect.objectContaining({ level: 12, tag: 1 }));
            expect(run.earnedClears.some((c) => c.level === 11)).toBe(false);
            expect(out.records.map((r) => r.leg)).toEqual(['talk', 'drop']);
        });
    }, 60_000);
    it('the sword ALREADY from the server and the slot held: she still adds it (the location is unreported)', () => {
        withContactFidelity(ON, () => {
            const run = l12Run({ hasSword: true, hasWand: true, hasDarkSword: true });
            const out = solveWitch(run);
            expect(out.records.map((r) => r.leg)).toEqual(['talk', 'drop']);
            expect(run.ledger('witchEvents').find((r) => r.what === 'witch-close'))
                .toMatchObject({ grants: true, slotHeld: true });
        });
    }, 60_000);
    it('slot cleared (staged): `already`, no tick; the build accepts {12,1}', () => {
        withContactFidelity(ON, () => {
            const run = l12Run({ hasSword: true, hasWand: true }, clears([12, 1]));
            const out = solveWitch(run);
            expect(out.records).toEqual([{ goal: 'encounter', leg: 'drop', already: true, report: true, t: 0 }]);
            expect(run.ticksCompleted).toBe(0);
        });
    });
    it('no wand: refused BY NAME before a tick, citing the R4 guard', () => {
        withContactFidelity(ON, () => {
            const run = l12Run({ hasSword: true });
            expect(() => solveWitch(run)).toThrow(/checkPersistence\(DarkSword\.WITCH_TAG\)/);
            expect(run.ticksCompleted).toBe(0);
        });
    });
});
