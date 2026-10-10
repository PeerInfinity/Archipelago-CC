/**
 * ⛓⛓ SEEDLING HAMMER-PHASE C1 — A STATIC BODY KILLED BY THE PLAYER'S SWORD (`STATIC_SWORD_ARM`), AND THE REMOVAL
 * CHOOSER THAT READS THE PROBE'S HIT (`CHOOSER_HIT_SOURCES`). Both switches ship OFF.
 *
 * The game witnesses are `fixtures/static-sword-witness/` (recorded on p4f by
 * `scripts/procgen/probe-seedling-static-sword-mobiles.mjs --record`): three hand-built presses (C1 D1: L36's
 * sandtraps, L62's turret with and without the shield) and two tapes the SOLVER planned with both switches ON
 * (`plan-seedling-c1-static-sword.mjs`). Each holds the game's SandTrap / Turret / TurretSpit rows and the player at
 * every sampled tick. With `STATIC_SWORD_ARM` ON the model reproduces every one (0 px, every hit, i-frame, "die",
 * `destroy`, removal and spit) with zero player hits; with it OFF the model never damages the body, which is the
 * divergence C1 D1 measured — the control that keeps the ON rows from being vacuous.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STATIC_SWORD_ARM, STATIC_SWORD_DEATH, killArmModelled, KILL_ARM_POLICY } from './enemyDamage.js';
import { CHOOSER_HIT_SOURCES } from './solverBot.js';
import { parseTape } from './tapeFormat.js';
import { disagreements, modelColumns } from '../../../scripts/procgen/probe-seedling-static-sword-mobiles.mjs';
import { C1_WITNESSES, c1Plan } from '../../../scripts/procgen/plan-seedling-c1-static-sword.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'fixtures', 'static-sword-witness');
const WITNESSES = readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.endsWith('.tape.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));

describe('C1 — the switches ship OFF, and KILL_ARM_POLICY\'s rows are read, never edited', () => {
    it('both switches are OFF by default', () => {
        expect(STATIC_SWORD_ARM.enabled).toBe(false);
        expect(CHOOSER_HIT_SOURCES.enabled).toBe(false);
        expect(CHOOSER_HIT_SOURCES.mode).toBe('empty');
    });
    it('the SandTrap and Turret rows stay `refused`; `killArmModelled` reads `modelled` only with the switch ON', () => {
        expect(KILL_ARM_POLICY.SandTrap.policy).toBe('refused');
        expect(KILL_ARM_POLICY.Turret.policy).toBe('refused');
        expect(killArmModelled('SandTrap')).toBe(false);
        expect(killArmModelled('Turret')).toBe(false);
        STATIC_SWORD_ARM.enabled = true;
        try {
            expect(killArmModelled('SandTrap')).toBe(true);
            expect(killArmModelled('Turret')).toBe(true);
            expect(killArmModelled('DarkTrap')).toBe(false);
            expect(KILL_ARM_POLICY.Turret.policy).toBe('refused');
        } finally {
            STATIC_SWORD_ARM.enabled = false;
        }
        expect(Object.keys(STATIC_SWORD_DEATH).sort()).toEqual(['SandTrap', 'Turret']);
    });
});

describe('C1 — the game witnesses (`fixtures/static-sword-witness/`)', () => {
    it('the five witnesses are committed', () => {
        expect(WITNESSES.map((w) => w.name)).toEqual(['c1-d1-l36-sandtraps-press', 'c1-d1-l62-turret-noshield',
            'c1-d1-l62-turret-shield', 'c1-l36-sandtraps', 'c1-l62-turret']);
    });
    for (const w of WITNESSES) {
        it(`${w.name}: the model with STATIC_SWORD_ARM ON reproduces every sampled tick, zero hits`, async () => {
            const col = await modelColumns(parseTape(JSON.stringify(w.tape)), true);
            expect(disagreements(w.samples, col)).toEqual([]);
            expect(col.at(-1).hits).toBe(0);
            expect(w.final.hits).toBe(0);
            expect(w.samples.length).toBeGreaterThan(100);
        });
        it(`${w.name}: the CONTROL — with the switch OFF the model leaves the body unhurt and disagrees`, async () => {
            let bad = null;
            try {
                bad = disagreements(w.samples, await modelColumns(parseTape(JSON.stringify(w.tape)), false));
            } catch (e) {
                // OFF the turret walk crosses the body's cell, which the OFF model refuses as a contact by name
                expect(e.message).toMatch(/standing inside turret@232,248/);
                return;
            }
            expect(bad.length).toBeGreaterThan(0);
        });
    }
});

describe('C1 — the two switches on the planned stagings (`plan-seedling-c1-static-sword.mjs`)', () => {
    it('c1-l62-turret: OFF refuses at t0 with the sweep\'s words; ON solves through the static sword arm', async () => {
        const w = C1_WITNESSES['c1-l62-turret'];
        const off = await c1Plan(w, false);
        expect(off.solved).toBe(null);
        expect(off.refusal.message).toMatch(w.offRefusal);
        const on = await c1Plan(w, true);
        expect(on.solved).not.toBe(null);
        const kill = on.solved.out.records.find((r) => r.strategy === 'kill');
        expect(kill).toMatchObject({ arm: 'static-sword', target: 'turret@232,248', presses: 3 });
        expect(on.solved.out.perTick.length).toBe(JSON.parse(readFileSync(join(DIR, 'c1-l62-turret.tape.json'), 'utf8')).tick_count);
    }, 60000);
});
