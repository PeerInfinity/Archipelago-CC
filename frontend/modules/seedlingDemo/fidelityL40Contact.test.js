/**
 * ⛓⛓ SEEDLING FIDELITY L40CONTACT — the L40 chaser contact, game-witnessed (wave 17).
 *
 * D1 (`CONTACT_FIDELITY.chaserSpinnerWalls`, OFF): a live Spinner is `type = "Enemy"` (`Enemy.as:58`), and a Bob's
 * `solids` hold "Enemy" (`Bob.as:39`), so the game stops a bob against a spinner. The model's chaser walls were the
 * static census bodies and the ice turrets only (`levelRun.chaserStaticEnemyBoxesNow`). MEASURED on hammer CW's
 * staging A sword prefix (`handover-l40-A-sword-prefix`, 3,113 t, the game p4f headless logic-only): at t1801 the game
 * stops `bob@736,752` dead at (743.929, 753.416) while `spinner@880,848` crosses it southward; OFF the model walks it
 * on. ON, the probe (`probe-seedling-u9-shield-mobiles --class=Bob|Spinner`, the switch set in its own model) reads
 * the whole prefix at the model's clock: Bob 37,308 comparisons and Spinner 15,555, worst |Δ| 0 both.
 *
 * ⚠ CW's "second parting at t1989" was the PROBE's join, not the model: it labels each game row with the nearest body
 * of its OWN (OFF) model run, so once the OFF model had parted both game bobs were labelled `bob@736,752`. The rows
 * here were read with the switch ON in the probe's model, so the join is the exact one.
 *
 * The witness rows: `fixtures/l40contact-spinnerwall-witness/` (the tape is CW's hand-over tape, byte-equal; the
 * rows are the two moving L40 bobs from t1700, `[t, x, y, vx, vy, hits]`).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIT = join(HERE, 'fixtures', 'l40contact-spinnerwall-witness');
const TAPE = parseTape(readFileSync(join(WIT, 'l40contact-a-sword-spinnerwall.tape.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(WIT, 'l40contact-a-sword-spinnerwall.game-bobs.json'), 'utf8'));
const WATCH = ['bob@736,752', 'bob@736,800'];

/** Replay the tape; `at(t, run)` after every tick. Returns the run. */
const replay = (at, upto = TAPE.tick_count) => {
    const run = createRunForStaging(stagingFromTape(TAPE), atlasLevelSource());
    for (let t = 0; t < upto; t += 1) {
        const keys = heldKeysAt(TAPE, t);
        run.advance(new Set(keys));
        at?.(run.ticksCompleted, run);
    }
    return run;
};

/** The model's watched bobs per tick, `id -> Map(t -> [x, y, vx, vy, hits])`. */
const modelRows = () => {
    const out = new Map(WATCH.map((id) => [id, new Map()]));
    replay((t, run) => {
        if (t < 1700) return;
        for (const c of run.entities('chasers')) {
            if (out.has(c.id)) out.get(c.id).set(t, [c.x, c.y, c.vx, c.vy, c.hits]);
        }
    });
    return out;
};

const firstParting = (model) => {
    let first = null;
    for (const id of WATCH) {
        for (const [t, x, y, vx, vy, hits] of GAME.rows[id]) {
            const m = model.get(id).get(t);
            const same = m && m[0] === x && m[1] === y && m[2] === vx && m[3] === vy && m[4] === hits;
            if (!same && (first === null || t < first.t)) first = { t, id, game: [x, y], model: m ? [m[0], m[1]] : null };
        }
    }
    return first;
};

describe('L40CONTACT D1 — a live spinner walls a chaser (`chaserSpinnerWalls`)', () => {
    it.skipIf(process.env.SEEDLING_CHASER_SPINNER_WALLS || process.env.SEEDLING_CONTACT_FIDELITY)(
        'ships OFF', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.chaserSpinnerWalls).toBe(false);
            expect(CONTACT_FIDELITY.chaserSpinnerWalls).toBe(false);
        });

    it('the witness is the game\'s: 1,413 rows per bob, read at worst |Δ| 0 by the ON probe', () => {
        expect(GAME.worst).toBe(0);
        for (const id of WATCH) expect(GAME.rows[id]).toHaveLength(1413);
        // the stop: t1800 → t1812 at one point, velocity still written
        const at = (t) => GAME.rows['bob@736,752'].find((r) => r[0] === t);
        expect(at(1801).slice(1, 3)).toEqual([743.9289818420457, 753.4159593838361]);
        expect(at(1812).slice(1, 3)).toEqual(at(1801).slice(1, 3));
    });

    it('OFF: the model walks `bob@736,752` through `spinner@880,848` and parts from the game at t1801', () => {
        const first = withContactFidelity({ chaserSpinnerWalls: false }, () => firstParting(modelRows()));
        expect(first).toMatchObject({ t: 1801, id: 'bob@736,752', game: [743.9289818420457, 753.4159593838361] });
        expect(first.model).toEqual([743.8117343561606, 753.1951585073577]);
    }, 120_000);

    it('ON: every watched row from t1700 to the prefix\'s end is the game\'s, to the bit', () => {
        const first = withContactFidelity({ chaserSpinnerWalls: true }, () => firstParting(modelRows()));
        expect(first).toBeNull();
    }, 120_000);

    it('ON: the chaser FORECAST meets the spinner where the drive does (t1790 + 40, both bobs, 0 px)', () => {
        const cmp = (on) => withContactFidelity({ chaserSpinnerWalls: on }, () => {
            const run = replay(null, 1790);
            const f = run.chaserForecast();
            let worst = 0;
            let stopped = 0;
            for (let k = 0; k < 40; k += 1) {
                const s = run.state;
                const proj = f.step({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, direction: s.direction });
                run.advance(new Set(heldKeysAt(TAPE, 1790 + k)));
                const live = new Map(run.entities('chasers').map((c) => [c.id, c]));
                for (const b of proj) {
                    if (!WATCH.includes(b.id)) continue;
                    const c = live.get(b.id);
                    worst = Math.max(worst, Math.abs(c.x - b.x), Math.abs(c.y - b.y));
                    if (b.id === 'bob@736,752' && b.y === 753.4159593838361) stopped += 1;
                }
            }
            return { worst, stopped };
        });
        expect(cmp(true)).toEqual({ worst: 0, stopped: 16 }); // t1800–t1815 at (743.929, 753.416)
        // OFF the forecast and the drive agree too — both walk through (the drive's own OFF reading)
        expect(cmp(false).worst).toBe(0);
    }, 120_000);
});

/**
 * D3 — hammer SF's "approach-geometry hit" at t658 IS D1. SF's sword plan with `STRIKE_ETA_FLOOR` ON (made by its env,
 * the walls OFF: `l40contact-a-sword-floorplan`, 1,695 t, refused on `bob@736,752`) has the model's `bob@736,752` hit the
 * player at t658 (dy −3); the game walks on unhit to (744.2596783699775, 742.494712313261) (SF
 * `d1-game/sword-plan-dash-window.txt`). The bob is not nearer by any contact rule: OFF it left its home at t606 through
 * `spinner@880,848`, which the game's bob meets and stops against until t631, so at t658 the game's bob is 5.7 px further
 * south. ON, the probe reads the WHOLE tape on the game at the model's clock (Bob 20,292 comparisons, worst |Δ| 0).
 * The tape is replayed, not solved, so the floor's switch does not reach it.
 */
describe('L40CONTACT D3 — the t658 contact on the floor plan is the spinner wall', () => {
    const FLOOR = parseTape(readFileSync(join(WIT, 'l40contact-a-sword-floorplan.tape.json'), 'utf8'));
    const at658 = (on) => withContactFidelity({ chaserSpinnerWalls: on }, () => {
        const run = createRunForStaging(stagingFromTape(FLOOR), atlasLevelSource());
        for (let t = 0; t < 658; t += 1) run.advance(new Set(heldKeysAt(FLOOR, t)));
        return { player: [run.state.x, run.state.y],
            hits: run.ledger('playerHits').map((h) => [h.t, h.id, h.knockback?.dy ?? null]) };
    });

    it('OFF: `bob@736,752` hits the player at t658 (dy −3), which the game does not', () => {
        const off = at658(false);
        expect(off.hits).toHaveLength(1);
        expect(off.hits[0].slice(0, 2)).toEqual([658, 'bob@736,752']);
        expect(off.hits[0][2]).toBeCloseTo(-3, 2);
        expect(off.player).not.toEqual([744.2596783699775, 742.494712313261]);
    }, 120_000);

    it('ON: no hit, and the player is at the game\'s point to the bit', () => {
        expect(at658(true)).toEqual({ player: [744.2596783699775, 742.494712313261], hits: [] });
    }, 120_000);
});

/**
 * D2 — hammer DD's "killed at t104, still in `strikeBodies` at t133" (legs 378/381, `puncher@816,128`) is the "die"
 * animation, and the game agrees with the model's membership. A ghost-sword press (pressed t97, fired t101 on this
 * atlas boot of leg 378) kills the puncher; the game plays "die" t102–t132 at hits 4 = `hitsMax` (`Puncher.as:44`,
 * 10 frames at 10), `endAnim` sets `destroy` at t133 (anim ""), `Mobile.death` fades it to t143 and it is gone at t144.
 * The model: `dying` t102, a `strikeBodies` member (`spent`, under the lapse) through t132, `destroy` and out at t133,
 * removed at t144. No respawn, and the killed flag does not disagree with membership: a dying body is in the world
 * and refuses a hit (`Enemy.hit`'s `hits < hitsMax`), which is what `spent` says. Witness: the first 160 executed
 * ticks (`l40contact-378-ghost-puncher`), on the game at the model's clock (Puncher 305 comparisons, worst |Δ| 0).
 */
describe('L40CONTACT D2 — a killed puncher stays in `strikeBodies` exactly while the game plays "die"', () => {
    const P = parseTape(readFileSync(join(WIT, 'l40contact-378-ghost-puncher.tape.json'), 'utf8'));
    const G = JSON.parse(readFileSync(join(WIT, 'l40contact-378-ghost-puncher.game.json'), 'utf8')).rows;
    const ID = 'puncher@816,128';

    it('the model\'s death fenceposts are the game\'s: die t102–t132, destroy t133, gone t144', () => {
        const run = createRunForStaging(stagingFromTape(P), atlasLevelSource());
        const model = new Map();
        for (let t = 0; t < P.tick_count; t += 1) {
            run.advance(new Set(heldKeysAt(P, t)));
            const c = run.entities('chasers').find((x) => x.id === ID);
            const sb = run.entities('strikeBodies').find((x) => x.id === ID);
            model.set(run.ticksCompleted, c ? { dying: c.dying, destroy: c.destroy, hits: c.hits, ht: c.hitsTimer,
                member: !!sb, spent: sb?.spent === true } : null);
        }
        const kill = (run.presses ?? []).filter((q) => q.hits.some((h) => h.id === ID && h.killed));
        expect(kill.map((q) => [q.t, q.fired, q.weapon])).toEqual([[97, 101, 'ghostsword']]);
        for (const [t, anim, hits, ht] of G) {
            const m = model.get(t);
            expect(m, `t${t}`).not.toBeNull();
            expect([m.hits, m.ht], `t${t}`).toEqual([hits, ht]);
            // the game's "die" window IS the model's membership window of a dying body
            expect(anim === 'die', `t${t}`).toBe(m.dying && !m.destroy);
            expect(m.member, `t${t}`).toBe(!m.destroy);
            if (m.member && m.dying) expect(m.spent, `t${t}`).toBe(CONTACT_FIDELITY.strikeIframeLapse === true);
        }
        expect(G.find((r) => r[0] === 102)[1]).toBe('die');
        expect(G.find((r) => r[0] === 133)[1]).toBe('');
        expect(G.at(-1)[0]).toBe(143);
        expect(model.get(144)).toBeNull();
    }, 120_000);
});
