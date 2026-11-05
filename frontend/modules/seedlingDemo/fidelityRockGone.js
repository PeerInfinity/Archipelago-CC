/**
 * seedlingDemo/fidelityRockGone — ⛓⛓⛓ seedling-fidelity-knockback376 D1: WHEN A BROKEN `BreakableRock` STOPS
 * BEING SOLID, MEASURED ON THE GAME (`CONTACT_FIDELITY.rockGoneFencepost`).
 *
 * THE LEG (sweep leg 376, `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144`): the full
 * pass's 1565-tick plan takes ONE planned hit — a `bombpusher@112,128` Bomb's Explosion (`Explosion.as:60`, force 4),
 * NOT the spinner the census row names — at t1247, dashes on t1248 (`knockback(2, …)`, `Player.as:788`) and, still in
 * i-frames, is carried up the east face of `breakablerock@176,128` / `@176,144` by the knockback, its `vx` (−4.5 → −3.1)
 * kept while x is pinned (`Mobile.friction`/`moveX` never zero `v` on a block: `Mobile.as:73-118`,
 * `Player.as:1723-1751`). The dash's first test breaks the three rocks (`breakablerock@160,144`, `@176,128`, `@176,144`).
 * The model let the player through `@176,128`'s cell on t1256 — the game held it there two more ticks and let it go on
 * t1258 (x 194.673 → 192.004, that tick's `vx`). Through t1255 the game and the model agree on every player field
 * (x, y, vx, vy, hits, hits_timer): the knockback itself is exact. The recovery re-plan then refuses on
 * `spinner@192,160`.
 *
 * THE RULE (two fenceposts, both the kind SLOTS D4a found for the burnable tree):
 *   1. THE ANIMATION'S FIRST UPDATE IS THE FRAME AFTER THE HIT. `BreakableRock.hit` → `play("break")` runs inside
 *      `Player.update` (`slash()` → `genericHit`, `Player.as:892-928, 1091-1093`), and `World.update` runs each
 *      entity's update THEN its graphic's (`World.as:47-61`) down a list `addUpdate` PREPENDS to — `loadlevel` adds
 *      the player before the level's entities, so a rock's graphic was updated BEFORE the player's hit on that frame
 *      and its first `Spritemap.update` is the next one. `animCallbackTick` (4 frames at 20, `FP.elapsed` 0.0333) is
 *      7 updates, so `endAnim` → `FP.world.remove(this)` runs on the frame hit + 7.
 *   2. THE REMOVAL LANDS AT THAT FRAME'S END. `World.remove` only queues; `Engine.update` runs `updateLists` after
 *      `World.update` (`Engine.as:69-78`), so the callback frame's own move is still blocked and the cell is free
 *      from the frame after.
 * ⇒ the player first moves into the cell on the frame ENTERING at `ticksCompleted` = hit + 8, i.e. the observation
 * hit + 9. `HIT_TO_GONE_TICKS` (7) is the model's OFF arithmetic under `brokenRockIds(…, ticksCompleted + 1)`, which
 * frees it on observation hit + 7: two early. ON, `hitRock` records `goneAt = hit + HIT_TO_GONE_TICKS_GAME` (9).
 *
 * WITNESSES (p4g, headless, `probe-seedling-rock-gone.mjs --record`, `fixtures/rockgone-witness/`):
 *   - `rockgone-l40-plain`: L40, entity (200,136), `noDamage`: hold `left` (pinned on `@176,128` at x 194.5),
 *     `primary` on input 10. The game's `Bot.slashTests` shows the swing's first test landing on observation 12
 *     (the model's `hitTick` 11), and x first leaves 194.5 on observation 20; OFF the model leaves it on 18.
 *   - `rockgone-l40-dash`: the same stance from 16 px further east; a plain swing on input 0 (facing down, it
 *     reaches nothing), walk left onto the rock, the dash press on input 12 (`slashTimer` > 0: `Player.as:784-791`).
 *   - `rockgone-leg376-play`: the leg's own play, captured by `probe-seedling-contact-divergence.mjs --capture`
 *     (seam 5271, the 1565-tick plan): the request (no `records`: the committed atlas is its level source), the plan
 *     and the game's player rows on all 1259 sampled ticks. ON = the game at 0 px on every tick; OFF first differs at
 *     t1256, player.x.
 *
 * ⛔ Not changed: the persistence write (`rockFlags`, stamped at the hit tick), which is a separate approximation of
 * `endAnim`'s `Game.setPersistence` and moves no position.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROCKGONE_WITNESS_DIR = join(HERE, 'fixtures', 'rockgone-witness');

/** The rock the two short witnesses are pinned on, and the column x the player is pinned at. */
export const ROCKGONE_ROCK = 'breakablerock@176,128';

/**
 * Witness tape bodies: `{boot, presses, ticks, right}` — every tick holds `left` except the `right` ones; `primary` on
 * `presses`. The boot is the tape's (`Game` ctor args: the entity is at +8, +8).
 */
export const ROCKGONE_TAPES = Object.freeze({
    /** Pinned on the rock, one plain swing (5 tests, `Player.as:892-928`). */
    'rockgone-l40-plain': Object.freeze({ boot: Object.freeze({ level: 40, x: 192, y: 128 }), presses: Object.freeze([10]),
        ticks: 40, right: Object.freeze([]) }),
    /**
     * A plain swing facing RIGHT on input 1 (its rect reaches nothing), then `left` onto the rock and the second press
     * on input 8 inside `slashTimer` — the DASH (`slashnarrow`, `knockback(2, …)`, `Player.as:784-791`), the press the
     * leg's plan made.
     */
    'rockgone-l40-dash': Object.freeze({ boot: Object.freeze({ level: 40, x: 192, y: 128 }), presses: Object.freeze([1, 8]),
        ticks: 40, right: Object.freeze([0, 1]) }),
});

/** The per-tick held sets of a short witness. */
export function rockGonePerTick({ presses, ticks, right }) {
    const out = [];
    for (let t = 0; t < ticks; t += 1) {
        const h = new Set([right.includes(t) ? 'right' : 'left']);
        if (presses.includes(t)) h.add('primary');
        out.push(h);
    }
    return out;
}

/** A short witness's tape: the L40 pocket boot's header (`fidelityTurretCircle.l40PocketBoot`), re-booted, `noDamage`. */
export async function rockGoneTape(name) {
    const spec = ROCKGONE_TAPES[name];
    if (!spec) throw new Error(`rockGoneTape: unknown witness ${name}; known: ${Object.keys(ROCKGONE_TAPES).join(', ')}`);
    const { buildTape } = await import('./botDriverV1.js');
    const { l40PocketBoot } = await import('./fidelityTurretCircle.js');
    const base = await l40PocketBoot({}, name);
    const boot = { ...spec.boot };
    const folded = buildTape(rockGonePerTick(spec), boot, name, { noclip: false, noDamage: true, noHazards: [], grants: [] });
    return {
        ...base, name, boot, noDamage: true, tick_count: spec.ticks, inputs: folded.inputs,
        description: `seedling-fidelity-knockback376 D1: L40 entity (${boot.x + 8},${boot.y + 8}), noDamage — `
            + `${spec.right.length ? `right on input(s) ${spec.right.join(', ')}, then ` : ''}hold left onto ${ROCKGONE_ROCK}, `
            + `primary on input(s) ${spec.presses.join(', ')}; the tick the cell opens (probe-seedling-rock-gone.mjs)`,
    };
}

/** The model's samples of a tape, by observation: the player and the rocks' `hitTick`/`goneAt`. */
export async function rockGoneModelSamples(tapeJson) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let run = null;
    let error = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    try {
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            samples[o.t] = { t: o.t, x: o.x, y: o.y, rocks: run ? run.rocksBroken.map((k) => ({ id: k.id, hitTick: k.hitTick, goneAt: k.goneAt })) : [] };
            r = st.next();
        }
    } catch (e) {
        error = e.code ?? e.message;
    }
    return { samples, error };
}

/** The game poll's fold: the player and the swing counters (`Bot.slashTests` / `slashHits`). */
export function rockGoneSampleOf(s) {
    return { t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits, tests: s.slash?.tests ?? null, slashHits: s.slash?.hits ?? null };
}

/** `[t, level, x, y, hits, tests, slashHits]`. */
export const packRockGoneSample = (g) => [g.t, g.level, g.x, g.y, g.hits, g.tests, g.slashHits];
export function unpackRockGoneSample([t, level, x, y, hits, tests, slashHits]) {
    return { t, level, x, y, hits, tests, slashHits };
}

/** The first observation whose x differs from the observation before it after `from` (the cell opening). */
export function firstMoveAfter(samples, from, field = 'x') {
    for (const s of samples) {
        if (!s || s.t <= from) continue;
        const prev = samples.find((p) => p && p.t === s.t - 1);
        if (prev && prev[field] !== s[field]) return s.t;
    }
    return null;
}

/** The first observation on which the game's swing counter shows a test, after `from`. */
export function firstTestAfter(samples, from) {
    let base = null;
    for (const s of samples) {
        if (!s) continue;
        if (s.t <= from) { base = s.tests; continue; }
        if (s.tests !== base) return s.t;
    }
    return null;
}

/** Player mismatches (x, y), game vs model, by observation `t < tickCount` (the poll's last read is past the tape); 0 px. */
export function compareRockGoneWitness(game, model, tickCount = Infinity) {
    const bad = [];
    for (const g of game) {
        if (g.t >= tickCount) continue;
        const m = model[g.t];
        if (!m) { bad.push(`t${g.t}: no model sample`); continue; }
        if (g.x !== m.x || g.y !== m.y) bad.push(`t${g.t}: game (${g.x},${g.y}) model (${m.x},${m.y})`);
    }
    return bad;
}

/**
 * The leg's own captured play, replayed on the model — the rebuild `replay-seedling-contact-capture.mjs` makes
 * (`createRunForStaging` over the staging, then the plan's solution, its equips `{t, slot}` at their ticks), on the
 * committed atlas (`atlasLevelSource`) — compared with the game's player rows on every sampled tick (x, y, vx, vy,
 * hits, hits_timer; 0 px). `restore` is the codec's `restoreRequest` (Maps/Sets tagged in the fixture).
 * Returns `{compared, firstDiff}`; `firstDiff` is `{t, field, game, model}` or null.
 */
export async function replayLegWitness(w, { restore }) {
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const req = restore(w.request);
    const solution = restore(w.plan.solution);
    const run = createRunForStaging(req.staging, atlasLevelSource(), { scratchPersistence: req.scratchPersistence === true });
    const equips = new Map((w.plan.equips ?? []).map((e) => [e.t, e.slot]));
    const byT = new Map(w.samples.map(unpackLegRow).map((g) => [g.t, g]));
    let compared = 0;
    const at = (t) => {
        const g = byT.get(t);
        if (!g) return null;
        compared += 1;
        const s = run.state;
        const d = run.damage;
        for (const [f, a, b] of [['x', g.x, s.x], ['y', g.y, s.y], ['vx', g.vx, s.vx], ['vy', g.vy, s.vy],
            ['hits', g.hits, d.hits], ['hits_timer', g.hitsTimer, d.hitsTimer]]) {
            if (a !== b) return { t, field: `player.${f}`, game: a, model: b };
        }
        return null;
    };
    let diff = at(0);
    const last = Math.max(...byT.keys());
    for (let i = 0; i < solution.length && !diff && i < last; i += 1) {
        if (equips.has(i)) run.equipNow(equips.get(i));
        run.advance(solution[i]);
        diff = at(i + 1);
    }
    return { compared, firstDiff: diff };
}

/** The leg witness's compact game row: `[t, x, y, vx, vy, hits, hits_timer]`. */
export const packLegRow = (g) => [g.t, g.x, g.y, g.player?.vx ?? null, g.player?.vy ?? null, g.hits, g.hits_timer];
export function unpackLegRow([t, x, y, vx, vy, hits, hitsTimer]) {
    return { t, x, y, vx, vy, hits, hitsTimer };
}
