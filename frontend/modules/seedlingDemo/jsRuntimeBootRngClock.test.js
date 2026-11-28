/**
 * ⛓⛓ seedling-js-boot-rng-clock — a JS room boot DECLARES its random stream (the wasm arrival's shape) and CARRIES the
 * game clock across room boots (⚖ Robert 2026-11-28T02:08:21Z: *"Random stream + clock together"*).
 *
 * The page rows boot the real vanilla map (`setVanilla` + a host `new Game`), as `jsRuntimeSave.test.js` does.
 *
 * Mutant reds (each measured, the file restored afterwards — `CC/docs/cloud-reports/seedling-js-boot-rng-clock-evidence/mutants.txt`):
 *   m0 the BASE `jsRuntimeCore.js` (8199cdb59f)            → 7/7 red
 *   m1 the boot keeps `bootStaging`'s rng                     → 4 red: "declares the live seed", "one step per boot", L57, fresh page
 *   m2 the boot stages `split: false`                         → 3 red: "declares the live seed", L57, fresh page
 *   m3 the stream never steps                                 → 1 red: "one step per boot"
 *   m4 the clock is not carried                               → 3 red: the three clock rows (their carry legs)
 *   m5 the carry beats the restore                            → 1 red: "a restore keeps the saved day clock"
 *   m6 a never-stepped run hands on its gameTime              → 1 red: "a fresh page keeps its default"
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createJsRuntime, JS_BOOT_RNG } from './jsRuntimeCore.js';
import { SHIPPED_RNG } from './wasmArrival.js';
import { BOOT_SEED, step } from './rng.js';
import { PAGE_BOOT_TIME } from './gameClock.js';
import { CONTACT_FIDELITY } from './contactFidelity.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { planLevelSetChunks } from './levelSetValidator.js';

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const MAP = readJson('../flashPanel/atlases/seedling-map.json');
const GAME_CONFIG = readJson('../flashPanel/games/seedling.json');
const FULL_CONFIG = { classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties, path_reads: GAME_CONFIG.path_reads };
const GEN = readJson('../../presets/seedling_generated_room/AP_1/AP_1_rules.json');
const START = [0, 80, 128];   // `Main.as:51`

const teleport = ([level, x, y]) => ({ invocation: 'new_instance', className: 'Game', args: [level, x, y] });
const reloaded = (save) => JSON.parse(JSON.stringify(save));
const idle = (rt, n) => { for (let i = 0; i < n; i += 1) rt.tick(); };
/** A boot's declared clock (`seam.time`) and stream (`rng`), as the solver's request carries them (`session.staging`). */
const bootTime = (rt) => rt.session.staging.seam?.time;
const bootRng = (rt) => rt.session.staging.rng;
const go = (rt, at) => { rt.queueItems([teleport(at)]); rt.tick(); };

function vanillaPage(at = START) {
    const rt = createJsRuntime();
    rt.game.configure(FULL_CONFIG);
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, teleport(at)]);
    rt.tick();
    return rt;
}

describe('⛓⛓ seedling-js-boot-rng-clock — the random stream', () => {
    it('JS_BOOT_RNG is the shipped game\'s split and cosmetic declaration (wasmArrival.SHIPPED_RNG)', () => {
        expect(JS_BOOT_RNG.split).toBe(SHIPPED_RNG.split);
        expect(JS_BOOT_RNG.cosmetic).toBe(SHIPPED_RNG.cosmetic);
    });

    it('a JS room boot declares the live seed and split: true — never seed 0 ("inherit"), no fp', () => {
        const rt = vanillaPage();
        const rng = bootRng(rt);
        expect(rng).toEqual({ seed: expect.any(Number), split: true, cosmetic: 0 });
        expect(Number.isInteger(rng.seed) && rng.seed > 0 && rng.seed <= 0x7FFFFFFF).toBe(true);
        expect('fp' in rng).toBe(false);
        go(rt, [12, 200, 100]);
        expect(bootRng(rt).split).toBe(true);
        expect(bootRng(rt).seed).toBeGreaterThan(0);
    });

    it('the seed is the page\'s own gameplay stream: BOOT_SEED at the first frame, then one SeedlingRng step per boot', () => {
        const rt = createJsRuntime();
        rt.game.configure(FULL_CONFIG);
        rt.setVanilla(MAP);                       // boot 1: the game's own first frame
        expect(bootRng(rt).seed).toBe(BOOT_SEED);
        rt.queueItems([{ class: 'game', property: 'menu', value: false }, teleport(START)]);
        rt.tick();                                // boot 2: the host's start
        expect(bootRng(rt).seed).toBe(step(BOOT_SEED));
        go(rt, [12, 200, 100]);                   // boot 3
        expect(bootRng(rt).seed).toBe(step(step(BOOT_SEED)));
        // two fresh pages with one boot history declare the same seeds (deterministic, not wall-clock)
        const again = vanillaPage();
        go(again, [12, 200, 100]);
        expect(bootRng(again).seed).toBe(bootRng(rt).seed);
    });

    it('L57: a JS boot in the Tentacled Beast\'s room opens the fight\'s draw stream (base: "has no declared seed for this room")', () => {
        expect(CONTACT_FIDELITY.tentacleBeastFight).toBe(true);
        const rt = vanillaPage([57, 96, 160]);
        const fight = rt.run.entities('tentacleBeastFight');
        expect(fight).not.toBe(null);
        expect(fight.streamRefusal).toBe(null);
    });
});

describe('⛓⛓ seedling-js-boot-rng-clock — the game clock', () => {
    it('the clock carries across two room boots: each boot stages the run\'s gameTime as it was replaced', () => {
        const rt = vanillaPage();
        idle(rt, 500);
        const t1 = rt.run.gameTime;
        go(rt, [12, 200, 100]);
        expect(bootTime(rt)).toBe(t1);
        expect(bootTime(rt)).not.toBe(PAGE_BOOT_TIME);
        idle(rt, 300);
        const t2 = rt.run.gameTime;
        expect(t2).toBeGreaterThan(t1 + 300);
        go(rt, START);
        expect(bootTime(rt)).toBe(t2);
    });

    it('a restore keeps the SAVED day clock (not the run it replaces), a v1 save a fresh start\'s; the next boot carries on from there', () => {
        const a = vanillaPage();
        idle(a, 3000);
        const save = a.exportSave();
        expect(save.time).toBe(a.run.gameTime);
        const b = vanillaPage();
        idle(b, 1000);                            // b's own clock now differs from the save's
        expect(b.run.gameTime).not.toBe(save.time);
        expect(b.restoreSave(reloaded(save))).toEqual({ ok: true });
        b.tick();                                 // the restore's reboot in place
        expect(bootTime(b)).toBe(save.time);
        idle(b, 50);
        const t = b.run.gameTime;
        go(b, [12, 200, 100]);
        expect(bootTime(b)).toBe(t);              // and the next room boot carries the restored run's clock
        // a version-1 save (no time): a fresh start's clock, even over a counting run
        const { time, ...rest } = save;
        const c = vanillaPage();
        idle(c, 1000);
        expect(c.restoreSave(reloaded({ ...rest, version: 1 }))).toEqual({ ok: true });
        c.tick();
        expect(bootTime(c)).toBe(PAGE_BOOT_TIME);
        idle(c, 20);
        const tc = c.run.gameTime;
        go(c, [12, 200, 100]);
        expect(bootTime(c)).toBe(tc);
    });

    it('a fresh page keeps its default: the first frame and the host\'s start (a run replaced before its first tick) declare PAGE_BOOT_TIME', () => {
        const rt = createJsRuntime();
        rt.game.configure(FULL_CONFIG);
        rt.setVanilla(MAP);
        expect(bootTime(rt)).toBe(PAGE_BOOT_TIME);
        rt.queueItems([{ class: 'game', property: 'menu', value: false }, teleport(START)]);
        rt.tick();
        expect(bootTime(rt)).toBe(PAGE_BOOT_TIME);   // the first frame ran no tick: it hands on its own clock
        expect(bootRng(rt).split).toBe(true);
        // a new mounted set is a new save: its first boot is a fresh page's clock, whatever the old run's read
        idle(rt, 400);
        const assembled = assembleGeneratedSeedlingSet(GEN, { selfPlayer: 1 });
        for (const ch of planLevelSetChunks(assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(ch));
        const { x, y, level } = assembled.set.start;
        go(rt, [level, x, y]);
        expect(bootTime(rt)).toBe(PAGE_BOOT_TIME);
        expect(bootRng(rt).split).toBe(true);
        idle(rt, 30);
        const t = rt.run.gameTime;
        go(rt, [level, x, y]);
        expect(bootTime(rt)).toBe(t);
    });
});
