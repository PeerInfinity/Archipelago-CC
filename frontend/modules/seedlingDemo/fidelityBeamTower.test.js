/**
 * ⛓ SEEDLING FIDELITY BEAMTOWER (wave 17) — the `BeamTower`'s drifting Solid (D1, `CONTACT_FIDELITY.beamTowerDrift`)
 * and its beam on the player in the run (D3, `CONTACT_FIDELITY.beamTowerBeamHit`). Both ship OFF.
 *
 *     BeamTower.as:53-56    if (Game.freezeObjects) return;
 *     BeamTower.as:57-95    if (beaming) { p = collideRect("Player", getRect(direction)); if (p) { p.hit(null, 5, (x, y), 1); Game.shake = 15; } }
 *     BeamTower.as:100-103  y += 0.3 * Math.sin(Game.worldFrame(100, 2) / 100 * 2 * Math.PI);
 *     World.as:53-58        e.update(); …; if (e._graphic && e._graphic.active) e._graphic.update();   ← the anim runs through a freeze
 *
 * The GAME witness (p4f, `probe-seedling-chaser-mobiles --class=Flyer --player-hits --record`, the three switches ON):
 * `fixtures/chaser-witness/beamtower-l105-773-flyer-plan.json` — LAPSECOST's `flyerLive` plan for sweep leg 773
 * (`level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144`), 381 ticks. On the game the player holding `left` is
 * stopped at x 66.04 from t205 by `beamtower@48,40`, risen ~5 px on its drift, and on the first L104 tick (t381)
 * `beamtower@16,56`'s UP beam takes it (hits 0 → 1, Δy −4.275).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import {
    BEAM_TOWER, beamTowerReachRects, beamTowerSolidRect, createBeamTower, stepBeamTowerFrame,
} from './beamTower.js';
import * as hazards from './hazards.js';
import { BEAM_BOB_SPAN } from './hazards.js';
import { LIVE_GEOMETRY_KEYS, buildLevelWorld, normalizeLiveOpts } from './levelWorld.js';
import { SHAKE_WRITERS, applyShakeWriter } from './camera.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const W773 = JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', 'beamtower-l105-773-flyer-plan.json'), 'utf8'));
/** `Game.shake = 15` on t381, then that frame's `view()` decays it by one (without the writer it would read 5 − 1). */
const SHAKE_AFTER_381 = 14;
const ON = { flyerLive: true, beamTowerDrift: true, beamTowerBeamHit: true };

/** Replay a witness's tape; the sampled ticks where the model's player is not the game's, to the bit. */
function replay(w, over) {
    return withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), {
            levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; },
        });
        const col = [];
        let r = st.next();
        while (!r.done) {
            col[r.value.observation.t] = r.value.observation;
            r = st.next();
        }
        const parted = w.samples.filter((sm) => !col[sm.t] || col[sm.t].x !== sm.player.x
            || col[sm.t].y !== sm.player.y || col[sm.t].level !== sm.level).map((sm) => sm.t);
        return { parted, run };
    });
}

describe('BEAMTOWER — the switches', () => {
    it('ship ON (⚖ <the licence>), and `hazards.js` re-exports the moved transcription unchanged', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.beamTowerDrift).toBe(true);
        expect(CONTACT_FIDELITY_DEFAULTS.beamTowerBeamHit).toBe(true);
        for (const k of ['BEAM_TOWER', 'beamAnimSpeed', 'beamIsBeaming', 'beamRect', 'createBeamTower', 'stepBeamTower']) {
            expect(typeof hazards[k], k).not.toBe('undefined');
        }
        expect(hazards.createBeamTower).toBe(createBeamTower);
        expect(BEAM_TOWER).toMatchObject({ force: 5, damage: 1, bobRadius: 0.3, bobPhases: 100, bobLoops: 2 });
    });

    it('`beamTowers` is a live-geometry key; OFF (null) every query reads the placement', () => {
        expect(LIVE_GEOMETRY_KEYS).toContain('beamTowers');
        expect(normalizeLiveOpts({}).beamTowers).toBeNull();
        const w = buildLevelWorld(atlasLevelSource()(105));
        const tower = w.solids.find((s) => s.beamTowerId === 'beamtower@48,40');
        expect(tower.rect).toMatchObject({ x: 48, y: 32, right: 64, bottom: 64 });
        const box = { x: 50, y: 27, right: 54, bottom: 31 };
        expect(w.collidesSolid(box, normalizeLiveOpts({}))).toBeNull();
        const risen = { ...tower.rect, y: 26, bottom: 58 };
        const hit = w.collidesSolid(box, normalizeLiveOpts({ beamTowers: new Map([['beamtower@48,40', { rect: risen }]]) }));
        expect(hit?.beamTowerId).toBe('beamtower@48,40');
        expect(hit.rect).toEqual(risen);
    });

    it('the shake writer: `Game.shake = 15`, an assignment', () => {
        expect(SHAKE_WRITERS.beamTowerBeam).toMatchObject({ op: '=', value: 15 });
        expect(applyShakeWriter(22, 'beamTowerBeam')).toBe(15);
    });
});

describe('BEAMTOWER D1 — one frame of a tower', () => {
    const fresh = () => createBeamTower({ cx: 56, cy: 56, attrs: { direction: '0', rate: '1', speed: '1' } },
        { width: 240, height: 160 });

    it('the Solid is `setHitbox(16, 32, 8, 24)` about the entity point, at the CURRENT y', () => {
        const t = fresh();
        expect(beamTowerSolidRect(t)).toEqual({ x: 48, y: 32, w: 16, h: 32, right: 64, bottom: 64 });
        t.y -= 4.75;
        expect(beamTowerSolidRect(t).y).toBeCloseTo(27.25, 12);
    });

    it('a frozen frame: no drift and no beam test, but the anim advances (`World.update` steps the graphic)', () => {
        const a = fresh();
        const b = fresh();
        for (let k = 0; k < 40; k += 1) {
            stepBeamTowerFrame(a, { time: 1000 + k, frozen: false });
            stepBeamTowerFrame(b, { time: 1000 + k, frozen: true });
        }
        expect(b.y).toBe(56);
        expect(a.y).not.toBe(56);
        expect([b.anim, b.index, b.frame, b.direction]).toEqual([a.anim, a.index, a.frame, a.direction]);
        expect(stepBeamTowerFrame(b, { time: 2000, frozen: true })).toBeNull();
    });

    it('the drift is a 90-update `Game.time` period spanning 8.6 px; no `Game.time` makes `y` unknown', () => {
        const t = fresh();
        let lo = 0;
        let hi = 0;
        for (let k = 0; k < 90; k += 1) {
            stepBeamTowerFrame(t, { time: 900 + k, frozen: false });
            lo = Math.min(lo, t.y - 56);
            hi = Math.max(hi, t.y - 56);
        }
        expect(Math.abs(t.y - 56)).toBeLessThan(1e-9);
        expect(hi - lo).toBeCloseTo(BEAM_BOB_SPAN, 3);
        stepBeamTowerFrame(t, { time: null, frozen: false });
        expect(t.yKnown).toBe(false);
    });

    it('the reach union covers every side `rate` visits, widened by the span', () => {
        const t = fresh();
        expect(beamTowerReachRects(t, BEAM_BOB_SPAN)).toHaveLength(4);
        const held = createBeamTower({ cx: 56, cy: 56, attrs: { direction: '2', rate: '4', speed: '1' } },
            { width: 240, height: 160 });
        expect(beamTowerReachRects(held, 0)).toHaveLength(1);
    });
});

describe('BEAMTOWER — the GAME witness (leg 773\'s `flyerLive` plan, p4f)', () => {
    const at = (t) => W773.samples.find((sm) => sm.t === t);

    it('one sample per tick; the game stops the player at x 66.04 from t205 and bills the L104 beam at t381', () => {
        expect(W773.samples.map((sm) => sm.t)).toEqual([...Array(W773.tape.tick_count + 1).keys()]);
        expect(at(204).player.x).toBe(66.04362206330738);
        expect(at(205).player.x).toBe(66.04362206330738);
        expect(at(205).player.y).toBe(24.279479451334247);
        expect(at(380)).toMatchObject({ level: 104, player: { x: 24, hits: 0 } });
        expect(at(381)).toMatchObject({ level: 104, player: { x: 24, y: 35.01637444483601, hits: 1 } });
    });

    it('all three ON: the model reproduces every sample at 0 px', () => {
        expect(replay(W773, ON).parted).toEqual([]);
    });

    it('`beamTowerDrift` OFF parts first at t205 (the model walks through the risen tower)', () => {
        expect(replay(W773, { ...ON, beamTowerDrift: false }).parted[0]).toBe(205);
    });

    it('`beamTowerBeamHit` OFF parts only at t381 (the L104 beam)', () => {
        expect(replay(W773, { ...ON, beamTowerBeamHit: false }).parted).toEqual([381]);
    });

    it('the run\'s tower: risen 4.78 px at t205, Game.time from the staging\'s seam; the beam row bills hits 1, shake 15', () => {
        const { run } = replay(W773, ON);
        const tr = run.ledger('beamTowerTrace').filter((r) => r.id === 'beamtower@48,40');
        const r205 = tr.find((r) => r.t === 205);
        expect(r205.frozen).toBe(false);
        expect(r205.gameTime).toBe(5560);
        expect(56 - r205.y).toBeCloseTo(5.0804, 3);
        // the Solid's bottom is above the player's box bottom (24.28 + 3) only from t204's frame
        expect(beamTowerSolidRect({ cx: 56, y: tr.find((r) => r.t === 204).y }).y).toBeLessThan(24.279479451334247 + 3);
        expect(beamTowerSolidRect({ cx: 56, y: tr.find((r) => r.t === 203).y }).y).toBeGreaterThan(24.279479451334247 + 3);
        const hit = run.ledger('playerHits').find((h) => h.source === 'beamtower');
        // the row carries the shake `Player.hit` left (`+= 5`); the tower's `Game.shake = 15` lands after it
        expect(hit).toMatchObject({ t: 381, level: 104, id: 'beamtower@16,56', hits: 1, shake: 5 });
        expect(run.shake).toBe(SHAKE_AFTER_381);
    });
});

describe('BEAMTOWER — the census (the vacuities this slice measured)', () => {
    const LS = atlasLevelSource();
    const towersIn = (n) => (LS(n)?.entities ?? []).filter((e) => e.type === 'beamtower');

    it('ten towers in five rooms: L103 (2), L104, L105, L107 (2), L108 (4)', () => {
        const rooms = {};
        for (let n = 0; n < 130; n += 1) {
            let k = 0;
            try { k = towersIn(n).length; } catch { continue; }
            if (k) rooms[n] = k;
        }
        expect(rooms).toEqual({ 103: 2, 104: 1, 105: 1, 107: 2, 108: 4 });
    });

    it('⛔ no tower room holds a freeze the model steps — so the freeze gate is unwitnessed (a named vacuity)', () => {
        // `Game.freezeObjects` writers (`rg "freezeObjects = true"`): a pickup, a Seed, an NPC that talks, a FallRock,
        // the moonrock, the seal, the bosses, Help, the inventory menu. In the five rooms: L103's Watcher has EMPTY text
        // (`NPC.talk` needs `myText[0].length > 0`, so it never talks), L107's `buttonroom` is an `Activators` with no
        // freeze, and nothing else is a writer. The inventory menu is the one reachable freeze, and the model does not
        // step the inventory key.
        const FREEZERS = new Set(['fallrock', 'fallrocklarge', 'moonrock', 'seed', 'help', 'bobbossnpc', 'finalboss',
            'sealcontroller', 'sign', 'statue', 'hermit', 'oracle', 'sensei', 'witch', 'yeti', 'karlore', 'rekcahdam',
            'adnancharacter', 'forestcharacter', 'introcharacter', 'totem']);
        for (const n of [103, 104, 105, 107, 108]) {
            const ents = LS(n).entities ?? [];
            expect(ents.filter((e) => FREEZERS.has(e.type) || /pickup|chest/.test(e.type)).map((e) => e.type), `L${n}`)
                .toEqual([]);
            for (const w of ents.filter((e) => e.type === 'watcher')) expect(w.attrs?.text ?? '').toBe('');
        }
    });

    it('OFF, the run steps no tower (no trace, no beam row)', () => {
        const { run } = replay(W773, { flyerLive: true, beamTowerDrift: false, beamTowerBeamHit: false });
        expect(run.ledger('beamTowerTrace')).toEqual([]);
        expect(run.ledger('playerHits').filter((h) => h.source === 'beamtower')).toEqual([]);
    });
});
