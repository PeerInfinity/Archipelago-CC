/**
 * seedling-fidelity-bombblast — A BOMB'S EXPLOSION ON A BODY, WITNESSED ON THE GAME (`CONTACT_FIDELITY.bombBlastBody`).
 *
 * `Explosion.added()` hands every `"Enemy"` whose box meets the prefilter square and whose origin is within 15 px
 * `Enemy.hit(4, new Point(x, y), 1)` (`Explosion.as:62-65`). OFF the run refused that arm by name, and hammer BW's
 * bombstand solve reaches it (leg 381: t1294 #10 on `bob@272,112`; with the strike lapse ON, t1339 #11 on
 * `spinner@192,160`). The two witnesses are the GAME's rows (p4f, `probe-seedling-bomb-blast-body.mjs --record`) over a
 * window of each tape — hammer BW's prefixes extended with idle ticks — and the model replays the whole tape:
 *   - `bombblast-l40-bw-idle` (lapse OFF prefix): t1294 #10 at (268, 118) lands on a Bob (0 → 1, knocked back) AND a
 *     Spinner (1 → 2) in one blast; t1340 #11 at (255, 131) on the same Bob (1 → 2) and the player.
 *   - `bombblast-l40-bw-lapse1-idle` (lapse ON prefix): t1339 #11 at (250, 160) KILLS a Spinner (2 → 3, no
 *     knockback), removed at t1350.
 * ⚠ Both replay with `chaserSpinnerWalls` ON (L40CONTACT D1, OFF by default): without it `bob@304,144` walks through
 * a spinner the game's Bob stops on from t1219 — a divergence before any blast, not this arm's.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'bombblast-witness', `${n}.json`), 'utf8'));
const ON = { bombBlastBody: true, chaserSpinnerWalls: true };
const TAGS = { Bob: 'bob', BobSoldier: 'bobsoldier', Spinner: 'spinner' };

/**
 * Replay the witness's tape through the window's last tick; per window tick, the model's player and every body of the
 * three classes in the lobber's reach. A faded spinner (alpha < 0) is gone in the game on that tick (the probe's note).
 */
function replay(w) {
    const tape = parseTape(JSON.stringify(w.tape));
    const cams = new Map(w.samples.map((s) => [s.t, s.cam]));
    let run = null;
    const st = createTapeStepper(tape, {
        levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; },
        cameraWitness: (t) => cams.get(t) ?? null,
    });
    const cols = new Map();
    for (let r = st.next(); !r.done; r = st.next()) {
        const o = r.value.observation;
        if (o.t >= w.window[0]) {
            const bodies = [];
            for (const c of run.entities('chasers')) {
                if (c.removed || !Object.values(TAGS).includes(c.tag)) continue;
                bodies.push({ cls: Object.keys(TAGS).find((k) => TAGS[k] === c.tag), id: c.id, x: c.x, y: c.y,
                    vx: c.vx, vy: c.vy, hits: c.hits, hitsTimer: c.hitsTimer });
            }
            for (const s of run.entities('spinnerBodies')) {
                if (s.alpha < 0) continue;
                bodies.push({ cls: 'Spinner', id: s.id, x: s.x, y: s.y, vx: null, vy: null, hits: s.hits,
                    hitsTimer: s.hitsTimer });
            }
            cols.set(o.t, { p: [o.x, o.y], bodies: bodies.filter((b) => b.x < 400 && b.y < 260) });
        }
        if (o.t >= w.window[1]) break;
    }
    return { cols, run };
}

/** Every window tick where the model's player or a body of the reach is not the game's (nearest row of the class). */
function disagreements(w, cols) {
    const out = [];
    for (const s of w.samples) {
        const m = cols.get(s.t);
        if (!m) { out.push(`t${s.t}: no model column`); continue; }
        if (m.p[0] !== s.p[0] || m.p[1] !== s.p[1]) out.push(`t${s.t}: player ${s.p} model ${m.p}`);
        for (const cls of Object.keys(TAGS)) {
            const gs = s.bodies.filter((b) => b[0] === cls);
            const ms = m.bodies.filter((b) => b.cls === cls);
            if (gs.length !== ms.length) { out.push(`t${s.t}: ${gs.length} ${cls} game, ${ms.length} model`); continue; }
            for (const [, x, y, vx, vy, hits, hitsTimer] of gs) {
                const mb = ms.reduce((best, b) => (!best || Math.hypot(b.x - x, b.y - y)
                    < Math.hypot(best.x - x, best.y - y) ? b : best), null);
                const d = [mb.x - x, mb.y - y, ...(mb.vx === null ? [] : [mb.vx - vx, mb.vy - vy])].map(Math.abs);
                if (d.some((e) => !(e <= 1e-9))) out.push(`t${s.t}: ${cls} game (${x}, ${y}) model ${mb.id} (${mb.x}, ${mb.y})`);
                if (mb.hits !== hits || mb.hitsTimer !== hitsTimer) {
                    out.push(`t${s.t}: ${mb.id} hits game ${hits}/${hitsTimer} model ${mb.hits}/${mb.hitsTimer}`);
                }
            }
        }
    }
    return out;
}

const bodyHits = (run) => run.ledger('bombEvents').filter((e) => e.what === 'body-hit')
    .map((e) => [e.t, e.id.split('#')[1], e.body, e.arm, e.hitsAfter, e.killed ? 'killed' : (e.shoved ? 'shoved' : '-')]);

describe('BOMBBLAST — the switch', () => {
    it('bombBlastBody ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.bombBlastBody).toBe(false);
    });
});

describe('BOMBBLAST — the game witness bombblast-l40-bw-idle (a Bob and a Spinner in one blast)', () => {
    const w = witness('bombblast-l40-bw-idle');

    it('the GAME: t1294 lands on a Bob (0 → 1) and a Spinner (1 → 2); t1340 on the Bob (1 → 2) and the player', () => {
        const hits = w.events.filter((e) => e.what === 'body-hit').map((e) => [e.t, e.cls, e.from.hits, e.to.hits]);
        expect(hits).toEqual([[1294, 'Spinner', 1, 2], [1294, 'Bob', 0, 1], [1340, 'Bob', 1, 2]]);
        expect(w.events.filter((e) => e.what === 'player-hits').map((e) => [e.t, e.from, e.to])).toEqual([[1340, 0, 1]]);
    });

    it('OFF: the run still refuses #10\'s blast on bob@272,112 by name', () => {
        expect(() => withContactFidelity({ ...ON, bombBlastBody: false }, () => replay(w)))
            .toThrow(/bombpusher@112,128#10 at \(268, 118\) on tick 1294 .* reaches the chaser bob@272,112/);
    });

    it('ON: the model is the game at every window tick (0 px; hits, hits_timer, velocity), and the arm\'s rows', () => {
        const { cols, run } = withContactFidelity(ON, () => replay(w));
        expect(disagreements(w, cols)).toEqual([]);
        expect(bodyHits(run)).toEqual([
            [1294, '10', 'bob@272,112', 'chaser', 1, 'shoved'],
            [1294, '10', 'spinner@192,128', 'spinner', 2, 'shoved'],
            [1340, '11', 'bob@272,112', 'chaser', 2, 'shoved'],
        ]);
        // the player's row is `applyPlayerHit`'s, one tick on (hammer BW reads #7's t1156 blast as "t1157's ledger row")
        expect(run.ledger('playerHits').map((h) => [h.t, h.source, h.id])).toEqual([[1341, 'bomb', 'bombpusher@112,128#11']]);
    });
});

describe('BOMBBLAST — the game witness bombblast-l40-bw-lapse1-idle (a blast KILLS a Spinner)', () => {
    const w = witness('bombblast-l40-bw-lapse1-idle');

    it('the GAME: t1339 takes a Spinner 2 → 3 with no knockback, and it is gone at t1350', () => {
        const hit = w.events.find((e) => e.what === 'body-hit');
        expect([hit.t, hit.cls, hit.from.hits, hit.to.hits]).toEqual([1339, 'Spinner', 2, 3]);
        expect([hit.to.vx, hit.to.vy]).toEqual([hit.from.vx, hit.from.vy]);
        expect(w.events.filter((e) => e.what === 'count').map((e) => [e.t, e.cls, e.from, e.to]))
            .toEqual([[1350, 'Spinner', 4, 3]]);
    });

    it('ON: the model is the game at every window tick, the kill is a spinnerKills row by bomb, removed t1350', () => {
        const { cols, run } = withContactFidelity(ON, () => replay(w));
        expect(disagreements(w, cols)).toEqual([]);
        expect(bodyHits(run)).toEqual([[1339, '11', 'spinner@192,160', 'spinner', 3, 'killed']]);
        const kill = run.spinnerPressKills.find((k) => k.weapon === 'bomb');
        expect([kill.t, kill.id, kill.removedTick]).toEqual([1339, 'spinner@192,160', 1350]);
    });
});
