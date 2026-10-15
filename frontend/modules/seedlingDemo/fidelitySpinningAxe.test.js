/**
 * ⛓ fidelity SPINNINGAXE D1 — A SPINNING AXE HITS THE PLAYER (`CONTACT_FIDELITY.spinningAxePlayerHit`, OFF by
 * default; `levelRun.stepSpinningAxesNow`).
 *
 *     SpinningAxe.as:48-63   update(): angle += spinRate; collideLine("Player", the blade) || collideRect(the hub)
 *     SpinningAxe.as:65-76   hitPlayer(): p.hit(null, force 5, the foot of p on the blade 2 updates back, damage 1)
 *
 * Before this slice only `dangerMap` priced the axe; the live run never billed it. Survey step 163 (L75, at
 * `e967758748`, the strike lapse ON) solves in 366 t and the game takes a hit at t160 from `spinningaxe@80,144`
 * (rate −6), where the model walks on. Game witnesses (p4f headless, `probe-seedling-chaser-mobiles.mjs
 * --class=LavaRunner --player-hits --record`, recorded ON):
 *   - `spinningaxe-l75-163-plan` — that 366-t plan; the axe at t160.
 *   - `spinningaxe-l75-163-reboot` — SMALLGAPS's 476-t plan (its `s163-tape-on.json`): a chain hit at t124, a death
 *     reboot at t160, and the axe at t357 — update 197 of the REBUILT world, so the counter's restart is witnessed.
 *
 * And the move's contract (agreed with the JS arc): the axe's geometry lives in `spinningAxe.js` (simulation) and
 * `hazards.js` re-exports the same function objects, so no importer's line moved.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import * as hazards from './hazards.js';
import * as solverView from './solverView.js';
import * as spinningAxe from './spinningAxe.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const witness = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${name}.json`), 'utf8'));
const PLAN = witness('spinningaxe-l75-163-plan');
const REBOOT = witness('spinningaxe-l75-163-reboot');
const AXE = Object.freeze({ cx: 88, cy: 152, rate: -6 }); // `spinningaxe@80,144` — the hub at the tile's centre

/** The model's replay of a witness: the sampled ticks it parts at, and the hits it billed. */
const replay = (W, on) => withContactFidelity({ spinningAxePlayerHit: on }, () => {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(W.tape)), { levelSource: SRC,
        onTick: (t, s, h, rn) => { run = rn; } });
    const col = [];
    let r = st.next();
    while (!r.done) {
        col[r.value.observation.t] = r.value.observation;
        r = st.next();
    }
    const parted = W.samples.filter((s) => !col[s.t] || col[s.t].x !== s.player.x || col[s.t].y !== s.player.y
        || col[s.t].level !== s.level).map((s) => s.t);
    return { parted, hits: run.playerHits.map((h) => `t${h.t} ${h.source} ${h.id}`) };
});

describe('SPINNINGAXE D1 — the switch and the move', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.spinningAxePlayerHit).toBe(false);
    });
    it('hazards.js and the door re-export the SAME function objects the simulation module defines', () => {
        for (const name of ['axeCanReach', 'axeHitsPlayer', 'axeLine', 'collideLinePlayer', 'SPINNING_AXE']) {
            expect(spinningAxe[name], name).toBeDefined();
            expect(hazards[name], name).toBe(spinningAxe[name]);
            expect(solverView[name], name).toBe(spinningAxe[name]);
        }
    });
    it('axeHitPoint is the foot of the player\'s point on the blade TWO updates back (`SpinningAxe.as:69-75`)', () => {
        const [px, py] = [81.39, 135.8];
        const p = spinningAxe.axeHitPoint(AXE, 160, px, py);
        const back = spinningAxe.axeLine(AXE, 158); // `a + 2·spinRate`, `a` = −angle
        const [dx, dy] = [back.x1 - back.x0, back.y1 - back.y0];
        // On the line through the hub at that angle, and the player's offset from it is perpendicular to it.
        expect((p.x - AXE.cx) * dy - (p.y - AXE.cy) * dx).toBeCloseTo(0, 9);
        expect((px - p.x) * dx + (py - p.y) * dy).toBeCloseTo(0, 9);
    });
});

describe('SPINNINGAXE D1 — step 163\'s 366-t plan on the game: the axe hits at t160', () => {
    const at = (t) => PLAN.samples.find((s) => s.t === t);
    it('the witness: 367 samples, the game\'s hits rise at t160', () => {
        expect(PLAN.samples.length).toBe(367);
        expect(PLAN.tape.boot).toEqual({ level: 75, x: 64, y: 16 });
        expect([at(159).player.hits, at(160).player.hits]).toEqual([0, 1]);
    });
    it('the blade: update 160 of the visit touches t159\'s (pre-move) box, update 159 does not touch t158\'s', () => {
        const box = (t) => playerBoxAt(at(t).player.x, at(t).player.y);
        expect(spinningAxe.axeHitsPlayer(AXE, 160, box(159))?.arm).toBe('blade');
        expect(spinningAxe.axeHitsPlayer(AXE, 159, box(158))).toBeNull();
    });
    it('ON: every sample at 0 px; the axe bills t160', () => {
        const r = replay(PLAN, true);
        expect(r.parted).toEqual([]);
        expect(r.hits).toContain('t160 spinningaxe spinningaxe@80,144');
    });
    it('OFF (the control): the model walks on at t160 and never bills an axe', () => {
        const r = replay(PLAN, false);
        expect(r.parted[0]).toBe(160);
        expect(r.hits.filter((h) => h.includes('spinningaxe'))).toEqual([]);
    });
});

describe('SPINNINGAXE D1 — the counter restarts at a death\'s rebuild (SMALLGAPS\'s 476-t plan, the axe at t357)', () => {
    const at = (t) => REBOOT.samples.find((s) => s.t === t);
    it('the witness: a chain hit at t124, the reboot at t160 (hits back to 0 at the spawn), the axe at t357', () => {
        expect(REBOOT.samples.length).toBe(477);
        expect([at(123).player.hits, at(124).player.hits, at(160).player.hits]).toEqual([0, 1, 0]);
        expect([at(356).player.hits, at(357).player.hits]).toEqual([0, 1]);
        expect(at(357).player.x - at(356).player.x).toBeLessThan(-4);
    });
    it('ON: every sample at 0 px; the axe bills t357 — and only the REBUILT world\'s count reaches it', () => {
        const r = replay(REBOOT, true);
        expect(r.parted).toEqual([]);
        expect(r.hits.filter((h) => h.includes('spinningaxe'))).toEqual(['t357 spinningaxe spinningaxe@80,144']);
        const box = playerBoxAt(at(356).player.x, at(356).player.y);
        expect(spinningAxe.axeHitsPlayer(AXE, 357 - 160, box)).not.toBeNull();
        expect(spinningAxe.axeHitsPlayer(AXE, 357, box)).toBeNull(); // the boot's count would miss it
    });
    it('OFF (the control): the model parts at t357', () => {
        expect(replay(REBOOT, false).parted[0]).toBe(357);
    });
});

describe('SPINNINGAXE D1 — sweep leg 633 (`level_75 <- in_L74_16_144 -> exit:out_teleporter_64_224`) meets the axe at t159', () => {
    // The leg's own node plan at the baseline row's `seamTime` 5411 (354 t); the baseline sweep's row (38778270309)
    // failed with a game hit at t159 at (82.49,131.97) — this one.
    const W = witness('spinningaxe-l75-633-plan');
    const at = (t) => W.samples.find((s) => s.t === t);
    it('the witness: 355 samples, the game\'s hits rise at t159 at (82.49,131.97)', () => {
        expect(W.samples.length).toBe(355);
        expect([at(158).player.hits, at(159).player.hits]).toEqual([0, 1]);
        expect(at(159).player.x).toBeCloseTo(82.4929, 3);
    });
    it('ON: every sample at 0 px; the axe bills t159. OFF parts at t159', () => {
        const on = replay(W, true);
        expect(on.parted).toEqual([]);
        expect(on.hits).toContain('t159 spinningaxe spinningaxe@80,144');
        expect(replay(W, false).parted[0]).toBe(159);
    });
});

/**
 * ⛓ fidelity SPINNINGAXE D2 — `CONTACT_FIDELITY.partialDodgeReprobe` (OFF). Step 163's decision at t0 is the PHASE arm's
 * stall for `lavachain@96,48`, kept as `partial: [spinningaxe@80,144]`; the walk executor then walked the rest of the
 * corridor without probing it (one `probeCorridor` call in the whole solve, at t0 — measured), into the blade at t160.
 */
describe('SPINNINGAXE D2 — a phase dodge\'s partial stall is re-probed', () => {
    const staging = stagingFromTape(parseTape(JSON.stringify(PLAN.tape)));
    // The axe's player arm pinned OFF: these rows isolate the probe (with `spinningAxePlayerHit` ON the 366-t drive is
    // hit and refuses on its own — a D1 mover).
    const solve = (on) => withContactFidelity({ partialDodgeReprobe: on, spinningAxePlayerHit: false }, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, SRC),
        goals: [{ kind: 'reach-exit', exit: { x: 64, y: 224 } }], name: 'spinningaxe-d2',
        boot: staging.boot, persistence: staging.persistence, log: () => {},
    }).then((s) => ({ ticks: s.out.perTick.length }), (e) => ({ refusal: e.message })));
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.partialDodgeReprobe).toBe(false);
    });
    it('OFF: step 163 solves in 366 t — the plan the game hits at t160', async () => {
        expect(await solve(false)).toEqual({ ticks: 366 });
    }, 60000);
    it('ON: the re-probe meets the axe at its update 160 and the ladder refuses BY NAME', async () => {
        const r = await solve(true);
        expect(r.refusal).toMatch(/spinningaxe@80,144 \(a SpinningAxe's 32 px blade on its update 160 of this visit/);
    }, 60000);
});
