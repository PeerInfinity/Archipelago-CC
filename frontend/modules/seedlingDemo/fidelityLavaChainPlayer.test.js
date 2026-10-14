/**
 * ⛓ fidelity SMALLGAPS D3 — A LAVA CHAIN'S ARM HITS THE PLAYER (`CONTACT_FIDELITY.lavaChainPlayerHit`, OFF by default;
 * `levelRun.stepLavaChainsNow`'s `"Player"` arm).
 *
 *     LavaChain.as:21,76-93   hitables = ["Player", "Enemy"]; reach(): … else if (hit is Player)
 *                             (hit as Player).hit(null, force 5, getHitPos → (x, y), damage 1)
 *
 * The divergence sweep's leg 633 (`level_75 <- in_L74_16_144 -> exit:out_teleporter_64_224`, baseline 38343649914)
 * leaves the plan at t162: the game is thrown 4.72 px west at (51.67,85.44) where the model walks on at (56.39,85.26).
 * The attacker is `lavachain@80,80`'s west arm (32–80 × 86–90), out on that update; K2PREP transcribed only the
 * chain's `"Enemy"` arm. Game witness (p4f headless, `probe-seedling-chaser-mobiles.mjs --class=LavaRunner
 * --player-hits --record`, recorded ON): `smallgaps-l75-633-chain` — the leg's own solved plan (449 t at the sweep's
 * `seamTime` 5412), every sample at 0 px ON; OFF parts at t162.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { lavaChainRect, rectTouchesBox } from './lavaChain.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const W = JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', 'smallgaps-l75-633-chain.json'), 'utf8'));

/** The model's replay of the witness: the sampled ticks it parts at, and the hits it billed. */
const replay = (on) => withContactFidelity({ lavaChainPlayerHit: on }, () => {
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

describe('SMALLGAPS D3 — the switch', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.lavaChainPlayerHit).toBe(false);
    });
});

describe('SMALLGAPS D3 — leg 633 on the game: lavachain@80,80 hits the player at t162', () => {
    const at = (t) => W.samples.find((s) => s.t === t);
    it('the witness: 450 samples, the game\'s hits rise at t75 (a lavarunner) and t162, thrown 4.72 px west', () => {
        expect(W.samples.length).toBe(450);
        expect(W.tape.boot).toEqual({ level: 75, x: 64, y: 16 });
        expect([at(74).player.hits, at(75).player.hits, at(161).player.hits, at(162).player.hits]).toEqual([0, 1, 1, 2]);
        expect(at(162).player.x - at(161).player.x).toBeCloseTo(-4.7216, 3);
    });
    it('the arm: `lavachain@80,80` faces west, and its rect touches the pre-move box of t162\'s update', () => {
        const arm = lavaChainRect(88, 88, 2);
        expect(arm).toEqual({ x: 32, y: 86, w: 48, h: 4 });
        expect(rectTouchesBox(arm, playerBoxAt(at(161).player.x, at(161).player.y))).toBe(true);
        expect(rectTouchesBox(arm, playerBoxAt(at(160).player.x, at(160).player.y))).toBe(false);
    });
    it('ON: every sample at 0 px; the chain bills t162 (and `lavachain@96,48` t447)', () => {
        const r = replay(true);
        expect(r.parted).toEqual([]);
        expect(r.hits).toEqual(expect.arrayContaining(['t162 lavachain lavachain@80,80', 't447 lavachain lavachain@96,48']));
    });
    it('OFF (the control): the model walks on at t162 and never bills a chain', () => {
        const r = replay(false);
        expect(r.parted[0]).toBe(162);
        expect(r.hits.filter((h) => h.includes('lavachain'))).toEqual([]);
    });
});
