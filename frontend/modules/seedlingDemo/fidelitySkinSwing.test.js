/**
 * Seedling fidelity SKINSWING (wave 26, a WITNESS slice): does the game land the two art-stands' swings?
 *
 * `seedlingEnemySkin.test.js`'s `lavarunner-L71` ([96,200]) and `bulb-L74` ([80,100]) stands (FIGHT, 300 ticks) run
 * with `pixelMaskSightLines` OFF since the MASKS flip: ON, the model's chaser arm asks `Player.slash`'s line of sight
 * (`Player.as:917`) and no FIGHT swing lands. Played on p4g (`probe-seedling-skin-swing.mjs --record`,
 * `fixtures/skinswing-witness/`):
 *
 *   · VERDICT (a): THE GAME MATCHES THE KEY ON. Both stands spawn the player INSIDE a "Dark Stone" tile (L71 (104,208),
 *     L74 (88,108); the player never moves, on the game or in the model), so every swing line's FIRST sample is
 *     solid: on the game no body takes a hit and none dies in 300 ticks; ON reproduces it at 0 px (the player, every
 *     chaser's position and `hits`); OFF leaves it at the first swing that reaches a body (L71 t3, L74 t21).
 *   · The re-site offers (js picks): `skinswing-l74-resite` (L74 (64,100)) — the game lands and kills; ON = OFF = the
 *     game at 0 px. `skinswing-l71-resite` (L71 (80,208)) — the game lands and kills, but ON and OFF both leave the
 *     game at t63, a DIFFERENT model gap (pinned below): the tick three dying lavarunners are removed, the game's
 *     `lavarunner@64,192` is blocked moving toward them — `FP.world.remove` defers to `World.updateLists`, so a body
 *     removed this tick is still an "Enemy" solid to the bodies that update after it; the model drops it at once.
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 the chaser arm's line is never asked ON (`levelRun.js`' chaser `lineBlocker` → null)
 *        -> the two stand witnesses red: L71 at t3, L74 at t21 (the model lands the swings the game does not).
 *   m2 the comparator ignores a body's `hits`
 *        -> the "OFF leaves the game at t3 / t21" row reds (the first OFF divergence moves later).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { withContactFidelity } from './contactFidelity.js';
import { FIGHT, SKINSWING_WITNESS_DIR, SKINSWING_WITNESSES, compareSkinSwing, fightKeys, hitEvents,
    skinSwingModelSamples, skinSwingTape } from './fidelitySkinSwing.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const load = (name) => JSON.parse(readFileSync(join(SKINSWING_WITNESS_DIR, `${name}.json`), 'utf8'));
const W = Object.fromEntries(SKINSWING_WITNESSES.map((w) => [w.name, w]));
const ON = { pixelMaskSightLines: true };
const OFF = { pixelMaskSightLines: false };

describe('fidelity SKINSWING — the witnesses are the skin test\'s stands', () => {
    // Read as text: importing a test file would register its suites here.
    const skin = readFileSync(join(HERE, 'seedlingEnemySkin.test.js'), 'utf8');

    it('FIGHT is the skin test\'s FIGHT, and each stand\'s boot and length are its TAPES row', () => {
        const lit = skin.match(/const FIGHT = (\[[\s\S]*?\]);/)[1];
        expect(JSON.parse(lit.replace(/'/g, '"').replace(/,\s*\]/, ']'))).toEqual([...FIGHT]);
        for (const w of SKINSWING_WITNESSES.filter((x) => !x.resite)) {
            const row = skin.split('\n').find((l) => l.includes(`name: '${w.stand}'`));
            expect(row, w.stand).toContain(`level: ${w.boot.level}, at: [${w.boot.x}, ${w.boot.y}], n: ${w.n}, keys: FIGHT`);
        }
    });

    // ⛓ js skin-stands moved `bulb-L74` to [64,100]: its stand witness is `skinswing-l74-resite` now (planning-11).
    it.each(['skinswing-l71-lavarunner', 'skinswing-l74-resite'])('%s: the staged tape run IS the stand\'s createJsRuntime boot, tick for tick (key ON)', async (name) => {
        const w = W[name];
        const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
        const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
        const fmt = (p, cs) => JSON.stringify([p.x, p.y, cs.map((c) => [c.id, c.x, c.y, c.hits])]);
        const rt = withContactFidelity(ON, () => {
            const r = createJsRuntime({ onStateChanged: () => {}, log: () => {} });
            r.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
            r.setVanilla(MAP);
            r.queueItems([{ class: 'game', property: 'menu', value: false }, { class: 'Main', property: 'hasSword', value: true },
                { invocation: 'new_instance', className: 'Game', args: [w.boot.level, w.boot.x, w.boot.y] }]);
            return fightKeys(w.n).map((h) => { r.tick(h); return fmt(r.run.state, r.run.chasers); });
        });
        const model = await skinSwingModelSamples(await skinSwingTape(w), ON);
        expect(model.error).toBeNull();
        // the tape's observation t is the stand's tick t+1 (the tape carries a t0 row)
        const staged = model.samples.slice(1, w.n + 1).map((s) => fmt(s, s.chasers));
        expect(staged).toEqual(rt);
    });
});

describe('fidelity SKINSWING — D1: the game (p4g) against the model, key ON and OFF', () => {
    it.each([['skinswing-l71-lavarunner', 3], ['skinswing-l74-bulb', 21]])('%s: the game lands NO swing (0 hits, 0 "die"); ON = the game at 0 px; OFF leaves it at t%i', async (name, offAt) => {
        const rec = load(name);
        expect(rec.samples.length).toBe(300);
        expect(hitEvents(rec.samples, (c, i) => `${c.tag}#${i}`)).toEqual([]);
        expect(rec.samples.flatMap((s) => s.chasers).filter((c) => c.anim === 'die')).toEqual([]);
        // the player is pinned inside a Dark Stone tile — on the game too
        expect(new Set(rec.samples.map((s) => `${s.x},${s.y}`)).size).toBe(1);
        const on = await skinSwingModelSamples(rec.tape, ON);
        expect(compareSkinSwing(rec.samples, on.samples)).toEqual([]);
        expect(on.pressHits.filter((h) => h.landed)).toEqual([]);
        // every ON refusal that reached the line names the tile at the player's own point
        const p = rec.samples[0];
        const lined = on.pressHits.filter((h) => /collideLine/.test(h.why ?? ''));
        expect(lined.length).toBeGreaterThan(50);
        expect([...new Set(lined.map((h) => h.why))]).toEqual([`collideLine("Solid") meets tile:Dark Stone at (${p.x}, ${p.y})`]);
        const off = await skinSwingModelSamples(rec.tape, OFF);
        const bad = compareSkinSwing(rec.samples, off.samples);
        expect(bad[0]).toMatch(new RegExp(`^t ${offAt} \\S+: hits game 0 model 1$`));
    });

    it('skinswing-l74-resite (L74 (64,100), an offer to js): the game lands and kills; ON = OFF = the game at 0 px', async () => {
        const rec = load('skinswing-l74-resite');
        expect(hitEvents(rec.samples, (c, i, s) => `${c.tag}#${s.chasers.filter((x, j) => j < i && x.tag === c.tag).length}`)
            .map((e) => e.t)).toEqual([2, 47, 77]);
        expect(rec.samples.some((s) => s.chasers.some((c) => c.anim === 'die'))).toBe(true);
        for (const arm of [ON, OFF]) {
            const m = await skinSwingModelSamples(rec.tape, arm);
            expect(compareSkinSwing(rec.samples, m.samples)).toEqual([]);
        }
    });

    // ⛓ was a KNOWN MODEL GAP (the removal-tick body still blocks): fixed by fidelity REMBODY (`removedBodyBlocks`);
    // ⛓ planning-11's flip (⚖ user "Harvest + flip ON", 2026-10-23) re-pins it to 0 px at the default. The gap's fact
    // (both arms leave the game at t63) is kept with `removedBodyBlocks` OFF.
    it('skinswing-l71-resite (L71 (80,208)): the game lands and kills; at the defaults ON = OFF = the game at 0 px; removedBodyBlocks OFF leaves it at t63', async () => {
        const rec = load('skinswing-l71-resite');
        expect(rec.samples.some((s) => s.chasers.some((c) => c.anim === 'die'))).toBe(true);
        for (const arm of [ON, OFF]) {
            const m = await skinSwingModelSamples(rec.tape, arm);
            expect(compareSkinSwing(rec.samples, m.samples)).toEqual([]);
        }
        const gap = await skinSwingModelSamples(rec.tape, { ...ON, removedBodyBlocks: false });
        const bad = compareSkinSwing(rec.samples, gap.samples);
        expect(bad[0]).toBe('t 63 lavarunner@64,192: game (89.99974125240814, 203.3031481193856) model '
            + '(89.99974125240814, 204.46697188284412)');
        // t62 → t63: three bodies are removed on both sides; the game's survivor did not move in y, the model's did
        expect([rec.samples[62].chasers.length, rec.samples[63].chasers.length]).toEqual([5, 2]);
        expect(compareSkinSwing(rec.samples.slice(0, 63), gap.samples)).toEqual([]);
    });
});
