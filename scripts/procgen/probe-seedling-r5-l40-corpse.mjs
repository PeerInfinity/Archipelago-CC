#!/usr/bin/env node
/**
 * probe-seedling-r5-l40-corpse — ⛓⛓⛓ THE CORPSE IS A TWO-CYCLE, AND WHICH
 * WAY A PRESS MOVES IT DEPENDS ON THE TICK. ⛔⛔ AND §32.6's FIFTH
 * CORRECTION IS WRONG: THE MOTION *IS* FREEZE-GATED.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 19 step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §32.6 (the source read
 * this asserts) and the STEP 1 itinerary. Source: `Enemies/IceTurret.as`,
 * `Enemies/Enemy.as`, `Mobile.as` in the fork.
 *
 * ⚠ THIS IS A MEASUREMENT, NOT A BUILD. Nothing here is wired into
 * `levelRun`: the corpse's `input()` is TRANSCRIBED AS A LOOP and stepped,
 * which is what a closed form would have got wrong (see below). The
 * itinerary this prices is what a build has to reproduce.
 *
 * ── ⛔⛔ THE CORRECTION §32.6 NEEDS ───────────────────────────────────
 *
 * §32.6 item 5 read `IceTurret.update()`'s `super.update()` sitting ABOVE
 * its `if (Game.freezeObjects) return;` and concluded that a corpse GLIDES
 * THROUGH a ceremony. It does not. `super.update()` is `Enemy.update()`,
 * whose own `super.update()` is `Mobile.mobileUpdate()` — and that method's
 * `friction(); input(); moveX(); moveY();` are all inside
 * `if (!Game.freezeObjects)`. The gate is one level down, not absent.
 *
 * ⛓⛓ WHAT DOES RUN ABOVE EVERY GATE is `Enemy.update()`'s TERRAIN switch
 * and its pit descent: `getState()` sets `destroy` on water and lava, and
 * the `fallInPit` block moves, spins and fades the sprite — none of it
 * freeze-tested. So the fourth shape in §28.7's split is real and it is
 * about DYING, not about moving: an enemy in water dies during a ceremony
 * and an enemy falling into a pit keeps falling through one.
 *
 * ── ⛓⛓⛓ THE REST POSITION IS A TWO-CYCLE ─────────────────────────────
 *
 * `input()` derives `cTile` with `Math.round(x / Tile.w)` and snaps a
 * stationary axis with `Math.floor(x / Tile.w) * Tile.w + Tile.w/2`. At a
 * tile CENTRE those disagree — `round(30.5)` is 31, `floor` is 30 — so a
 * turret standing still is permanently half a pixel from where the rounding
 * says it is, and its position oscillates with period 2:
 *
 *     (488, 424)  ->  (487.5, 423.5)  ->  (488, 424)  ->  …
 *
 * ⛔ WHICH MAKES THE BUMP TARGET PHASE-DEPENDENT, because `bump` reads
 * `Math.round(x / Tile.w)` too. The probe therefore drives BOTH phases and
 * reports both, rather than picking the one a settle happens to land on.
 *
 * ── ⛔⛔⛔ AND WHICH PUSHES MOVE IT DEPENDS ON THE TICK ────────────────
 *
 * A push sets `tile = tTile ± 1` and the glide runs until `cTile` catches
 * up. On the half of the cycle where `round` has already rounded UP, the
 * "minus one" target is a whole tile away and the "plus one" target is
 * satisfied by the very next tick. Half a pixel later it is the other way
 * round. Measured, on BOTH phases:
 *
 *     phase 0  (488, 423.5)   NORTH and EAST move 16 px; south and west 0.5
 *     phase 1  (487.5, 424)   SOUTH and WEST move 16 px; north and east 0.5
 *
 * ⇒ **A FIRE PRESS'S TICK PARITY IS LOAD-BEARING.** No press verb in this
 * driver has ever had to express that, and it is invisible to any model
 * that treats a resting body as a fixed point.
 *
 * ⛓ `button@480,384` is NORTH of `iceturret@472,400`, and two northward
 * presses on the right parity put the corpse's 16x16 box over the button's
 * 8x6 rect. The itinerary survives — on a parity, not on a position.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l40-corpse.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ENEMY_CLASSES } = await import(join(MODULE, 'combat.js'));

const levelSource = atlasLevelSource();
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
const world = buildLevelWorld(levelSource(40), { roles: ROLES, inventory: held });

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

const ROW = ENEMY_CLASSES.iceturret;
/** `iceturret@472,400` — the OEL cell; the ctor is `super(_x + Tile.w, _y + Tile.h)`. */
const OEL = Object.freeze({ x: 472, y: 400 });
const SPAWN = Object.freeze({ x: OEL.x + ROW.ctor.dx, y: OEL.y + ROW.ctor.dy });
const BUTTON = Object.freeze({ x: 480, y: 384 });

console.log('## the turret');
console.log(`   iceturret@${OEL.x},${OEL.y} -> entity (${SPAWN.x},${SPAWN.y}) tile `
    + `(${Math.floor(SPAWN.x / TILE_SIZE)},${Math.floor(SPAWN.y / TILE_SIZE)})`);
console.log(`   alive body ${ROW.hitbox.w}x${ROW.hitbox.h}: [${SPAWN.x - ROW.hitbox.ox},`
    + `${SPAWN.x - ROW.hitbox.ox + ROW.hitbox.w}) x [${SPAWN.y - ROW.hitbox.oy},`
    + `${SPAWN.y - ROW.hitbox.oy + ROW.hitbox.h})`);
console.log(`   corpse body 16x16 (setHitbox(16,16,8,8) on death): [${SPAWN.x - 8},`
    + `${SPAWN.x + 8}) x [${SPAWN.y - 8},${SPAWN.y + 8})`);
const button = world.pressers.find((p) => p.x === BUTTON.x && p.y === BUTTON.y);
console.log(`   button@${BUTTON.x},${BUTTON.y} t${button?.t} rect [${button?.rect.x},`
    + `${button?.rect.right}) x [${button?.rect.y},${button?.rect.bottom})`);

check(Boolean(button) && button.t === 2,
    '⛓ THE HOLD\'S TARGET IS `button@480,384 {t 2}`, AND IT IS NORTH OF THE TURRET',
    `t${button?.t}, rect [${button?.rect.x},${button?.rect.right}) x [${button?.rect.y},`
    + `${button?.rect.bottom}) — tile (${BUTTON.x / TILE_SIZE},${BUTTON.y / TILE_SIZE}) against `
    + `the turret's (${Math.floor(SPAWN.x / TILE_SIZE)},${Math.floor(SPAWN.y / TILE_SIZE)}). `
    + 'It publishes tset 2, which holds `wandlock@448,432 {tag 9}` and '
    + '`wandlock@512,480 {tag 10}` — link 4 of `L40_CHAIN`, the break `L40_ARRIVAL_BREAK` '
    + 'located.');

/**
 * ⛓⛓⛓ THE LOOP, TRANSCRIBED. Every line below is `IceTurret.input()` and
 * `Mobile.mobileUpdate()` in order — `friction(); input(); moveX(v.x);
 * moveY(v.y)` — and the ordering is the whole finding: `input()` snaps a
 * stationary axis BEFORE the move, so a "settled" body is not at a fixed
 * point.
 *
 * ⚠ Collision is deliberately NOT modelled here. This probe is about the
 * TARGET arithmetic; the chamber's own walls are the next question and a
 * build's, not this one's.
 */
const sign = (n) => (n > 0 ? 1 : (n < 0 ? -1 : 0));
const makeCorpse = (x, y) => ({
    x,
    y,
    // ctor: `tile = new Point(Math.floor(x / Tile.w), Math.floor(y / Tile.h))`
    tile: { x: Math.floor(x / TILE_SIZE), y: Math.floor(y / TILE_SIZE) },
    cTile: null,
    v: { x: 0, y: 0 },
});
const input = (c) => {
    c.cTile = { x: Math.round(c.x / TILE_SIZE), y: Math.round(c.y / TILE_SIZE) };
    c.v.x = ROW.corpse.glideSpeed * sign(c.tile.x - c.cTile.x);
    if (c.v.x === 0) c.x = Math.floor(c.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    c.v.y = ROW.corpse.glideSpeed * sign(c.tile.y - c.cTile.y);
    if (c.v.y === 0) c.y = Math.floor(c.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
};
const step = (c) => { input(c); c.x += c.v.x; c.y += c.v.y; };
/**
 * `bump(p, t)` with the CORPSE hitbox: `x - originX + width/2` is `x - 8 + 8`,
 * so the angle is simply `atan2(p.y - y, p.x - x)` in screen coordinates —
 * and `sin(a) > 0` means the press point is BELOW, which sets
 * `tile.y = tTile.y - 1`, i.e. the push is AWAY from the presser.
 */
const bump = (c, p) => {
    const tT = { x: Math.round(c.x / TILE_SIZE), y: Math.round(c.y / TILE_SIZE) };
    const a = Math.atan2(-(c.y - 8 + 8) + p.y, p.x - (c.x - 8 + 8));
    const bothRange = 0.1;
    if (Math.abs(Math.sin(a)) - bothRange < Math.abs(Math.cos(a))) {
        c.tile.x = Math.cos(a) > 0 ? tT.x - 1 : tT.x + 1;
    }
    if (Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)) - bothRange) {
        c.tile.y = Math.sin(a) > 0 ? tT.y - 1 : tT.y + 1;
    }
    return { tT, deg: (a * 180) / Math.PI };
};

// ── the two-cycle ─────────────────────────────────────────────────────
console.log('\n## the settle');
{
    const c = makeCorpse(SPAWN.x, SPAWN.y);
    const seen = [];
    for (let i = 0; i < 12; i += 1) { step(c); seen.push(`(${c.x},${c.y})`); }
    console.log(`   ${seen.slice(0, 6).join(' -> ')} …`);
    const cycle = [...new Set(seen.slice(4))];
    check(cycle.length === 2,
        '⛓⛓⛓ A STANDING TURRET IS A TWO-CYCLE, NOT A FIXED POINT',
        `the last eight ticks visit ${cycle.length} distinct position(s): `
        + `${cycle.join(' ')}. \`input()\` derives \`cTile\` with \`Math.round(x/16)\` and `
        + 'snaps a stationary axis with `Math.floor(x/16)*16 + 8` — at a tile centre those '
        + `disagree (\`round(${SPAWN.x / TILE_SIZE})\` is `
        + `${Math.round(SPAWN.x / TILE_SIZE)}, \`floor\` is `
        + `${Math.floor(SPAWN.x / TILE_SIZE)}), so the body is permanently half a pixel `
        + 'from where its own rounding says it is. ⛔ A model that treated the rest '
        + 'position as a fixed point would price the wrong pushes, because `bump` reads '
        + 'the same `round`.');
    // ⛓ …and the ctor's own y is NOT where it stands: `input()` snaps it.
    check(c.y !== SPAWN.y,
        '⛓ …AND THE CONSTRUCTOR CELL IS NOT THE RESTING CELL',
        `spawned at y = ${SPAWN.y} (a tile CORNER — \`super(_x + Tile.h, …)\`), stands at `
        + `y = ${c.y}. The first \`input()\` snaps a stationary axis to a tile CENTRE, `
        + `${TILE_SIZE / 2} px away. ⛓ Which is also why the self-destruct check can only `
        + 'fire MID-GLIDE (§32.6 item 2): it tests `x == cTile.x * Tile.w`, a corner, and '
        + 'a parked body is never on one.');
}

// ── the four pushes ───────────────────────────────────────────────────
console.log('\n## the four pushes, from both phases of the cycle');
const PUSHES = [
    { name: 'N', press: { dx: 0, dy: 44 } },
    { name: 'S', press: { dx: 0, dy: -44 } },
    { name: 'W', press: { dx: 44, dy: 0 } },
    { name: 'E', press: { dx: -44, dy: 0 } },
];
const results = [];
for (const settleTicks of [12, 13]) {
    for (const push of PUSHES) {
        const c = makeCorpse(SPAWN.x, SPAWN.y);
        for (let i = 0; i < settleTicks; i += 1) step(c);
        const before = { x: c.x, y: c.y };
        bump(c, { x: c.x + push.press.dx, y: c.y + push.press.dy });
        /**
         * ⛓ THE GLIDE IS COUNTED PER AXIS, and it ends when THIS push's
         * axis ARRIVES — `cTile` catching the target `tile`. Two other
         * counters were tried and both lie: a joint "both axes arrived"
         * test never fires (the other axis runs the two-cycle forever), and
         * "ticks with v != 0 on this axis" counts the post-glide
         * oscillation too and reports 116 for a 16 px push.
         */
        const axis = push.name === 'N' || push.name === 'S' ? 'y' : 'x';
        let glide = null;
        for (let i = 0; i < 200; i += 1) {
            step(c);
            if (glide === null && c.cTile[axis] === c.tile[axis]) glide = i + 1;
        }
        results.push({
            phase: settleTicks % 2,
            dir: push.name,
            from: before,
            to: { x: c.x, y: c.y },
            dx: c.x - before.x,
            dy: c.y - before.y,
            glideTicks: glide,
        });
    }
}
for (const r of results) {
    console.log(`   phase ${r.phase} push ${r.dir}: (${r.from.x},${r.from.y}) -> `
        + `(${r.to.x},${r.to.y})  [${r.dx.toFixed(1)},${r.dy.toFixed(1)}] `
        + `glide ${r.glideTicks} tick(s)`);
}
{
    const movedIn = (phase) => results
        .filter((r) => r.phase === phase
            && (Math.abs(r.dx) >= TILE_SIZE || Math.abs(r.dy) >= TILE_SIZE))
        .map((r) => r.dir).sort().join('');
    /**
     * ⛔⛔⛔ THE PUSH'S DIRECTION SET IS PHASE-DEPENDENT, and that is the
     * finding. `bump` reads `Math.round(x / Tile.w)` and the standing body's
     * x alternates by half a pixel across the rest cycle, so the SAME press
     * lands one tile away on one tick and nowhere on the next. Both halves
     * of the cycle move exactly two of the four directions — and they are
     * DIFFERENT twos.
     */
    check(movedIn(0) === 'EN' && movedIn(1) === 'SW',
        '⛔⛔⛔ WHICH PUSHES MOVE IT DEPENDS ON THE TICK — the two phases move OPPOSITE pairs',
        `phase 0 (${results[0].from.x},${results[0].from.y}) moves [${movedIn(0).split('').join(' ')}]; `
        + `phase 1 (${results[4].from.x},${results[4].from.y}) moves [${movedIn(1).split('').join(' ')}]. `
        + '⛔ `Math.round` breaks ties UPWARD, so on the half of the cycle where the body '
        + 'sits at a tile centre `cTile` is already one tile north-west of `floor`: a '
        + '`tTile - 1` target is a real tile away and a `tTile + 1` target is satisfied by '
        + 'the very next tick. Half a pixel later the arithmetic is the other way round. '
        + '⇒ A FIRE PRESS\'S TICK PARITY IS LOAD-BEARING, which is not a thing any press '
        + 'verb in this driver has ever had to express — and it is invisible to a model '
        + 'that treats a resting body as a fixed point.');
    check(results.every((r) => ((Math.abs(r.dx) >= TILE_SIZE || Math.abs(r.dy) >= TILE_SIZE)
        ? r.glideTicks === TILE_SIZE / ROW.corpse.glideSpeed + 1
        : r.glideTicks <= 2)),
    '⛓⛓ …AND EVERY REAL PUSH IS 32 TICKS OF MOTION, OBSERVED ON THE 33rd',
    `[${results.map((r) => `${r.dir}${r.phase}:${r.glideTicks}`).join(' ')}]. `
    + `${TILE_SIZE} px at ${ROW.corpse.glideSpeed} px/tick is `
    + `${TILE_SIZE / ROW.corpse.glideSpeed} ticks of motion, and the loop OBSERVES the `
    + 'arrival on the tick after the last of them — `input()` derives `cTile` from a '
    + 'position the previous tick moved to. ⚠ An update index is not a tick, one more '
    + 'time. ⚠ And a window that puts a ceremony inside one of those glides has to say '
    + 'what happens across the freeze; see the header, where §32.6 item 5 is corrected.');
}

// ── the itinerary the geometry asks for ───────────────────────────────
console.log('\n## the hold');
{
    const c = makeCorpse(SPAWN.x, SPAWN.y);
    for (let i = 0; i < 12; i += 1) step(c);
    const presses = [];
    for (let n = 0; n < 4; n += 1) {
        // ⛔ THE PRESS IS PINNED TO THE PHASE THAT MOVES NORTH. Firing it on
        // the other half of the cycle costs nothing and moves nothing — so
        // the itinerary's presses carry a tick PARITY, which no press verb
        // in this driver has ever had to express.
        let guard = 0;
        while (c.y !== Math.floor(c.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2 - 0.5) {
            step(c);
            guard += 1;
            if (guard > 8) throw new Error('the north-moving phase never came round');
        }
        bump(c, { x: c.x, y: c.y + 44 });
        let glide = null;
        for (let i = 0; i < 200; i += 1) {
            step(c);
            if (glide === null && c.cTile.y === c.tile.y) glide = i + 1;
        }
        const box = { x: c.x - 8, right: c.x + 8, y: c.y - 8, bottom: c.y + 8 };
        const on = box.x < button.rect.right && box.right > button.rect.x
            && box.y < button.rect.bottom && box.bottom > button.rect.y;
        presses.push({ n: n + 1, y: c.y, glide, on });
        console.log(`   press ${n + 1}: corpse (${c.x},${c.y}) box y [${box.y},${box.bottom}) `
            + `— on the button: ${on}`);
        if (on) break;
    }
    const first = presses.find((p) => p.on);
    check(Boolean(first) && first.n === 2,
        '⛓⛓⛓ TWO NORTHWARD PRESSES PUT THE CORPSE ON THE BUTTON',
        `press ${first?.n} of ${presses.length} — the body reaches y = ${first?.y} and its `
        + `16x16 box [${(first?.y ?? 0) - 8},${(first?.y ?? 0) + 8}) covers the button's `
        + `[${button.rect.y},${button.rect.bottom}). ⛓ Each glide is `
        + `${presses[0]?.glide} tick(s) — ${TILE_SIZE} px at `
        + `${ROW.corpse.glideSpeed} px/tick — and the press that starts it must come from `
        + 'SOUTH of the body AND on the right half of the rest cycle.');
    check(presses.every((p) => p.glide === TILE_SIZE / ROW.corpse.glideSpeed + 1),
        '⛓ …AND EVERY GLIDE IS THE SAME LENGTH',
        `[${presses.map((p) => p.glide).join(' ')}] ticks against `
        + `${TILE_SIZE / ROW.corpse.glideSpeed + 1}. ⚠ A ceremony may not share a window `
        + 'with a glide until a build says '
        + 'what happens across the freeze — and §32.6 item 5 has that backwards (see the '
        + 'header): `Mobile.mobileUpdate` gates `input()` and both moves, so the glide '
        + 'PAUSES. What is NOT gated is `Enemy.update()`\'s terrain switch and pit '
        + 'descent, which is a claim about dying rather than moving.');
}

let bad = 0;
console.log('');
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);
console.log('\n⚠ NOTHING HERE IS WIRED. The corpse is not in `levelRun`, `fire.bumps` does '
    + 'not exist, and no route consults any of it — this is the measurement a build has to '
    + 'reproduce, not the build.');
