/**
 * ⛓⛓⛓ SEEDLING FIDELITY LIGHTSARR (wave 21) — the L69 Lights fight after a real arrival, and the shield's shove on a
 * flier (`lightBoss.lightsShieldBump`, `levelRun.lightsShieldBumpNow`, the verb's forecast).
 *
 * Two game witnesses (`fixtures/lights-witness/`, recorded on p4g by `scripts/procgen/probe-seedling-lights.mjs
 * --compare --record`), reproduced by the model at 0 px:
 *   · `lightsarr-shield` — the sweep's leg 608 plan (`level_69 <- in_pit_L70_3_8 -> location:Level 069 - Lights`,
 *     run 39626706339's captured request, seam 5432) played from its own staging. The game bills the hit at t170 the
 *     plan's forecast called safe: flier 0, inside its `hits_timer`, is SHOVED by the moving player's shield at t154,
 *     t157 and t160 (`Player.shieldBump`), and its contact lands when the timer runs out.
 *   · `lightsarr-arrival` — a REAL fall-in: booted in L70, walked down into its pit, the fall from the ceiling into L69,
 *     the intro paged, a scripted fight (48 shots, a shot hit, sword hits).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { compareLightsWitness, modelLightsTrack } from './lightBossWitness.js';
import { createLightBossFlier, createLightsFight, lightBossKnockback, lightsShieldBump } from './lightBoss.js';
import { atan2, cos, sin } from './runtimeLibm.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'lights-witness', `${name}.json`), 'utf8'));
const levelSource = atlasLevelSource();
const replay = (w, tape = w.tape) => compareLightsWitness(w.samples,
    modelLightsTrack(parseTape(JSON.stringify(tape)), { levelSource }));

describe('fidelity LIGHTSARR — the game\'s witnesses, reproduced at 0 px (lightsBossFight ON)', () => {
    for (const [name, ticks] of [['lightsarr-shield', 617], ['lightsarr-arrival', 541]]) {
        it(`${name}: every sampled tick — the player (and its hits), the intro, the fliers, the shots, the level`, () => {
            const w = witness(name);
            expect(w.samples.length).toBe(ticks);
            const v = withContactFidelity({ lightsBossFight: true }, () => replay(w));
            expect(v.disagreements).toEqual([]);
            expect(v.worst).toBe(0);
            expect(v.compared).toBe(ticks);
        });
    }

    it('the shield: flier 0 (hits_timer 16) is shoved at t154, t157, t160; its contact bills the player at t170', () => {
        const w = witness('lightsarr-shield');
        expect(w.tape.seam.items.hasShield).toBe(true);
        const at = (t) => w.samples.find((s) => s.tick === t);
        expect(at(154).fliers[0].hitsTimer).toBe(16);
        for (const t of [154, 157, 160]) expect(at(t).fliers[0].vx).toBeLessThan(-1.5);
        expect(at(169).hits).toBe(0);
        expect(at(170)).toMatchObject({ hits: 1, hitsTimer: 19 });
        // the sweep's own game rows (run 39626706339, leg 608) at the divergence: the same bits
        expect(at(170).player).toMatchObject({ x: 58.89857113260393, y: 102.70749889921584 });
    });

    it('the arrival: L70 → its pit → L69 at t20 (clock 5493), the intro paged, the fliers spawned and hit', () => {
        const w = witness('lightsarr-arrival');
        expect(w.tape.boot.level).toBe(70);
        const first = w.samples.find((s) => s.level === 69);
        expect(first.tick).toBe(20);
        expect(first.time).toBe(5493);
        expect(w.samples.some((s) => s.level === 69 && s.fliers.length === 6)).toBe(true);
        expect(w.samples.some((s) => s.fliers.some((f) => f.hits > 0))).toBe(true);
        expect(Math.max(...w.samples.map((s) => s.hits))).toBe(1);
    });

    it('CONTROL: the shield witness with the shield taken away is NOT reproduced (the shove is what moves it)', () => {
        const w = witness('lightsarr-shield');
        const tape = { ...w.tape, seam: { ...w.tape.seam, items: { ...w.tape.seam.items, hasShield: false } } };
        const v = withContactFidelity({ lightsBossFight: true }, () => replay(w, tape));
        expect(v.pass).toBe(false);
        expect(v.disagreements[0]).toMatch(/^t 154: flier 0 /);
    });
});

describe('fidelity LIGHTSARR — `lightsShieldBump` (`Player.shieldBump` on a LightBoss)', () => {
    const fightWith = (x, y) => {
        const fight = createLightsFight({ x: 72, y: 72, flierNum: 6, tag: 0 });
        const f = createLightBossFlier(x, y, 0);
        f.angleFace = 0;
        fight.fliers.push(f);
        fight.bodies.push(f);
        return { fight, f };
    };
    // a player moving left: the WEST box `(x - 4, y)` 3x7, origin (2, 3)
    const player = { x: 60, y: 100, vx: -1, vy: 0, direction: 2 };

    it('a moving shield shoves a touched flier by 5 along atan2 (musl), whatever its hits_timer', () => {
        const { fight, f } = fightWith(50, 100);
        f.hitsTimer = 16;
        f.vx = 0.5;
        f.vy = 0.25;
        const rows = lightsShieldBump(fight, { player, slashing: false });
        const a = atan2(100 - 100, 50 - 60);
        expect(rows).toEqual([{ id: f.id, shoved: true, v: { x: 0.5 + 5 * cos(a), y: 0.25 + 5 * sin(a) } }]);
        expect(f.hitsTimer).toBe(16);
        expect(f.hits).toBe(0);
    });

    it('a standing player bumps nothing; a flier off the box is not touched', () => {
        const { fight, f } = fightWith(50, 100);
        expect(lightsShieldBump(fight, { player: { ...player, vx: 0 }, slashing: false })).toEqual([]);
        f.x = 80;
        expect(lightsShieldBump(fight, { player, slashing: false })).toEqual([]);
    });

    it('`Enemy.knockback`\'s gate: a dying flier is touched and not moved', () => {
        const { fight, f } = fightWith(50, 100);
        f.dieAnim = { frame: 0 };
        expect(lightsShieldBump(fight, { player, slashing: false })).toEqual([{ id: f.id, shoved: false, v: { x: 0, y: 0 } }]);
        expect(lightBossKnockback(f, 5, { x: 0, y: 0 })).toBe(false);
    });

    it('the dark shield on a flier out of its i-frame is refused by name (`o.hit(5, p, 0.5, "Shield")`)', () => {
        const { fight } = fightWith(50, 100);
        expect(() => lightsShieldBump(fight, { player, slashing: false, dark: true })).toThrow(/dark shield touches/);
    });
});
