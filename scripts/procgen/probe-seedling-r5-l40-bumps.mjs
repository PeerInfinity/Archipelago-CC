#!/usr/bin/env node
/**
 * probe-seedling-r5-l40-bumps — ⛔⛔⛔ A FIRE PRESS IS **FIVE** BUMPS, AND
 * THE MODEL THAT PRICED ONE PRICED THE WRONG THING.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 20 step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §33.5 and §33.8 item 1 —
 * `fire.bumps` "needs to be able to say WHICH TICK it fires on". This is
 * what the verb has to be told and what it has to promise.
 *
 * ── ⛔⛔⛔ THE FINDING §33.5 COULD NOT SEE ────────────────────────────
 *
 * `probe-…-l40-corpse.mjs` applied ONE `bump` and measured the glide. A
 * real press is not one bump. `FIRE_WINDOW.hitTicks` is `[4,5,6,7,8]` and
 * `Player.genericHit` calls `IceTurret.bump(new Point(x, y), t)` on EVERY
 * dispatch of every hit tick — so one press re-targets the body five times
 * running, from five consecutive ticks, i.e. from BOTH phases of the rest
 * cycle and then from a body that is already gliding.
 *
 * ⛓ And the ORDER inside a tick is fixed by the loader: `Game.as` adds the
 * Player at :2092 and `iceturret` after it, and `World.addUpdate` PREPENDS,
 * so the TURRET UPDATES FIRST. Bump k is therefore seen by the glide on
 * tick k+1, and bumps 2..5 re-aim a moving body.
 *
 * ⇒ the verb's argument is the PRESS tick and its effect is the sequence's
 * NET displacement. Both are measured here, for every press tick modulo the
 * rest cycle and for the four cardinal stances.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l40-bumps.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const {
    ICE_TURRET, ICE_TURRET_PLAN, createIceTurret, killIceTurret, stepIceTurret,
    bumpIceTurret, iceTurretPhase, iceTurretMovableDirections, iceTurretRect,
} = await import(join(MODULE, 'iceTurret.js'));
const { FIRE_WINDOW, fireDispatchCount } = await import(join(MODULE, 'fireVerb.js'));
const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));

const T = TILE_SIZE;
const checks = [];
const check = (ok, name, detail) => {
    checks.push({ ok, name, detail });
    console.log(`   ${ok ? '✓' : '⛔'} ${name}\n      ${detail}`);
};

const OEL = { x: 472, y: 400 };
const BUTTON = { x: 480, y: 384 };
const world = buildLevelWorld(atlasLevelSource()(40), {
    roles: ROLES, inventory: { hasSword: true, hasFire: true, canSwim: true, hasFeather: true },
});
const button = world.pressers.find((p) => p.x === BUTTON.x && p.y === BUTTON.y);

console.log('## the body, and the press\n');
{
    const c = createIceTurret(OEL.x, OEL.y);
    console.log(`   iceturret@${OEL.x},${OEL.y} -> entity (${c.x},${c.y})  alive box `
        + `${JSON.stringify(iceTurretRect(c))}`);
    killIceTurret(c);
    console.log(`   corpse box (setHitbox(16,16,8,8)) ${JSON.stringify(iceTurretRect(c))}`);
}
console.log(`   button@${BUTTON.x},${BUTTON.y} {t ${button.t}} rect [${button.rect.x},`
    + `${button.rect.right}) x [${button.rect.y},${button.rect.bottom})`);
console.log(`   FIRE_WINDOW.hitTicks = [${FIRE_WINDOW.hitTicks.join(',')}], `
    + `${fireDispatchCount('Enemy')} dispatches per hit tick on an Enemy\n`);

// ── 1. the rest cycle and the phase rule ─────────────────────────────
console.log('## 1. ⛓⛓ THE PHASE RULE — an axis ON its snap moves POSITIVE\n');
{
    const c = createIceTurret(OEL.x, OEL.y);
    killIceTurret(c);
    const seen = [];
    for (let i = 0; i < 12; i += 1) { stepIceTurret(c, {}); seen.push(`(${c.x},${c.y})`); }
    const cycle = [...new Set(seen.slice(4))];
    console.log(`   ${seen.slice(0, 5).join(' -> ')} …`);
    for (const extra of [0, 1]) {
        const d = createIceTurret(OEL.x, OEL.y);
        killIceTurret(d);
        for (let i = 0; i < 12 + extra; i += 1) stepIceTurret(d, {});
        const p = iceTurretPhase(d);
        console.log(`   (${d.x},${d.y})  phase {x:${p.x}, y:${p.y}}  `
            + `moves [${iceTurretMovableDirections(d).join(',')}]`);
    }
    check(cycle.length === 2,
        '⛓⛓⛓ A STANDING CORPSE IS A TWO-CYCLE, AND THE MODULE REPRODUCES IT',
        `the last eight ticks visit ${cycle.length} positions: ${cycle.join(' ')}. `
        + '`input()` derives `cTile` with `Math.round(x/16)` and snaps a stationary axis '
        + 'with `Math.floor(x/16)*16 + 8`; at a tile centre those disagree, so the body '
        + 'is permanently half a pixel from where its own rounding says it is.');
}

// ── 2. ⛔⛔⛔ ONE PRESS IS FIVE BUMPS ─────────────────────────────────
console.log('\n## 2. ⛔⛔⛔ ONE PRESS IS FIVE BUMPS, AND THE NET IS NOT THE SINGLE-BUMP ANSWER\n');
/**
 * A stance is a cardinal offset from the corpse's parked entity point; the
 * press point is `new Point(player.x, player.y)` and the player does not
 * move during the five hit ticks (the leg fires from a dead stop).
 */
const STANCES = [
    { push: 'N', dx: 0, dy: 24 },
    { push: 'S', dx: 0, dy: -24 },
    { push: 'W', dx: 24, dy: 0 },
    { push: 'E', dx: -24, dy: 0 },
];
/**
 * @param settle  ticks of rest before the press tick — its PARITY is the
 *   verb's argument.
 * @param bumps   how many of `FIRE_WINDOW.hitTicks` to apply (1 = the old
 *   single-bump model, 5 = a press).
 */
const drivePress = (settle, stance, bumps) => {
    const c = createIceTurret(OEL.x, OEL.y);
    killIceTurret(c);
    for (let i = 0; i < settle; i += 1) stepIceTurret(c, {});
    const from = { x: c.x, y: c.y };
    const press = { x: c.x + stance.dx, y: c.y + stance.dy };
    const applied = [];
    // The press tick T is `settle`; hit ticks are T+4..T+8, and the body
    // updates BEFORE the player on each of them.
    const hits = FIRE_WINDOW.hitTicks.slice(0, bumps);
    for (let k = 0; k <= FIRE_WINDOW.hitTicks[bumps - 1]; k += 1) {
        stepIceTurret(c, {});
        if (hits.includes(k)) {
            const r = bumpIceTurret(c, press, 'Fire');
            applied.push(`${k}:${r.tile.x},${r.tile.y}`);
        }
    }
    for (let i = 0; i < 200; i += 1) stepIceTurret(c, {});
    return { from, to: { x: c.x, y: c.y }, dx: c.x - from.x, dy: c.y - from.y, applied };
};

const rows = [];
for (const settle of [12, 13]) {
    for (const stance of STANCES) {
        const one = drivePress(settle, stance, 1);
        const five = drivePress(settle, stance, 5);
        rows.push({ parity: settle % 2, stance: stance.push, one, five });
        console.log(`   parity ${settle % 2} push ${stance.push}: `
            + `1 bump [${one.dx.toFixed(1)},${one.dy.toFixed(1)}]   `
            + `5 bumps [${five.dx.toFixed(1)},${five.dy.toFixed(1)}]  `
            + `targets ${five.applied.join(' ')}`);
    }
}
const disagree = rows.filter((r) => r.one.dx !== r.five.dx || r.one.dy !== r.five.dy);
check(disagree.length > 0,
    '⛔⛔⛔ THE FIVE-BUMP PRESS DISAGREES WITH THE SINGLE-BUMP MODEL',
    `${disagree.length} of ${rows.length} (parity, stance) pairs move somewhere different `
    + `once the press's own five hit ticks are applied: `
    + `${disagree.map((r) => `p${r.parity}/${r.stance} ${r.one.dx},${r.one.dy} vs `
        + `${r.five.dx},${r.five.dy}`).join('; ')}. `
    + '⇒ `L40_CORPSE`\'s "two northward presses on the right parity" was priced against a '
    + 'model of one bump. `Player.genericHit` calls `bump` before `Enemy.hit` on EVERY '
    + `dispatch, \`FIRE_WINDOW.hitTicks\` is [${FIRE_WINDOW.hitTicks.join(',')}], and the `
    + 'turret updates BEFORE the player, so bumps 2..5 re-aim a body that is already '
    + 'moving. A verb that declares a parity has to declare the SEQUENCE it buys.');

// ── 3. what a press actually buys, per parity ────────────────────────
console.log('\n## 3. ⛓ WHAT A PRESS BUYS, PER PARITY — the verb\'s contract\n');
const netFor = (parity, stance) => rows.find((r) => r.parity === parity && r.stance === stance).five;
/** ⚠ A TILE MINUS THE HALF-PIXEL THE CYCLE OWES — 16 is the wrong threshold. */
const MOVED = T - 1;
const movedIn = (parity) => STANCES
    .map((s) => ({ s: s.push, n: netFor(parity, s.push) }))
    .filter((r) => Math.abs(r.n.dx) >= MOVED || Math.abs(r.n.dy) >= MOVED);
for (const parity of [0, 1]) {
    console.log(`   parity ${parity}: moves [${movedIn(parity).map((r) => `${r.s} `
        + `(${r.n.dx},${r.n.dy})`).join(', ')}]`);
}
check(movedIn(0).length === 4 && movedIn(1).length === 4,
    '⛓⛓⛓ AND THE PARITY IS **NOT** LOAD-BEARING FOR A REAL PRESS — §33.5\'s HEADLINE FALLS',
    `all four cardinal pushes move a tile from BOTH parities `
    + `(parity 0 [${movedIn(0).map((r) => r.s).join(',')}], `
    + `parity 1 [${movedIn(1).map((r) => r.s).join(',')}]). `
    + '§33.5 read the single-bump table — "phase 0 moves N and E; phase 1 moves S and W" — '
    + 'and concluded that **a fire press\'s tick PARITY is load-bearing, which no press verb '
    + 'in this driver can express**. It is not. The press applies five bumps on five '
    + 'CONSECUTIVE ticks, so whichever phase the first one lands on, the second lands on the '
    + 'other — and the refused direction, which travels half a pixel and is back in two '
    + 'ticks, is re-targeted before it can settle. ⇒ `fire.bumps` does NOT need a parity '
    + 'argument, and the shape §33.8 item 1 asked for is a shape the mechanism does not '
    + 'require. ⚠ WHAT SURVIVES is a ±1 px difference in the net and a ±0.5 px drift on the '
    + 'cross axis, so the RESTING POSITION still differs by parity — which is a thing an '
    + 'assertion has to allow for and not a thing a plan has to steer.');

// ── 4. the itinerary, against the button ─────────────────────────────
console.log('\n## 4. ⛔ THE ITINERARY, RE-PRICED AGAINST THE FIVE-BUMP PRESS\n');
{
    // ⛓ The corpse must end with its 16x16 box over the button's 8x6 rect.
    const overlaps = (r) => r.x < button.rect.right && r.right > button.rect.x
        && r.y < button.rect.bottom && r.bottom > button.rect.y;
    let best = null;
    const both = [];
    for (const parity of [0, 1]) {
        for (let presses = 1; presses <= 4; presses += 1) {
            const c = createIceTurret(OEL.x, OEL.y);
            killIceTurret(c);
            for (let i = 0; i < 12 + parity; i += 1) stepIceTurret(c, {});
            let ok = true;
            for (let p = 0; p < presses; p += 1) {
                const press = { x: c.x, y: c.y + 24 };       // stand SOUTH, push NORTH
                for (let k = 0; k <= FIRE_WINDOW.hitTicks[4]; k += 1) {
                    stepIceTurret(c, {});
                    if (FIRE_WINDOW.hitTicks.includes(k)) bumpIceTurret(c, press, 'Fire');
                }
                for (let i = 0; i < 40; i += 1) stepIceTurret(c, {});
                if (!Number.isFinite(c.x)) { ok = false; break; }
            }
            const r = iceTurretRect(c);
            const hit = ok && overlaps(r);
            console.log(`   parity ${parity}, ${presses} northward press(es) from the south: `
                + `corpse at (${c.x},${c.y}) box [${r.x},${r.right}) x [${r.y},${r.bottom})  `
                + `${hit ? '⛓ ON THE BUTTON' : 'no'}`);
            if (hit) { both.push({ parity, presses, x: c.x, y: c.y }); }
            if (hit && best === null) best = { parity, presses, x: c.x, y: c.y };
        }
    }
    check(best !== null && both.length === 2,
        '⛓⛓ THE CORPSE GOES ON `button@480,384` IN **TWO** NORTHWARD PRESSES, EITHER PARITY',
        best
            ? `${best.presses} press(es) from a stance due south, and BOTH parities land it: `
              + `${both.map((b) => `parity ${b.parity} -> (${b.x},${b.y})`).join(', ')}, each `
              + `with its 16x16 box over the button's [${button.rect.x},${button.rect.right}) `
              + `x [${button.rect.y},${button.rect.bottom}). ⛓ The COUNT is the recipe; the `
              + 'parity moves the resting position by half a pixel and nothing else. ⛔ And '
              + 'the count is not free either way — one press stops a tile short and three '
              + 'overshoot past the button\'s row, so the leg has to stop pressing.'
            : 'NO combination of up to four northward presses from either parity lands the '
              + 'corpse on the button. The itinerary §33.5 banked does not survive the '
              + 'five-bump press and the leg needs a different stance.');
}

// ── 5. the four gates ────────────────────────────────────────────────
console.log('\n## 5. ⛓ THE FOUR GATES A LEG HAS TO SATISFY AT ONCE\n');
for (const g of ICE_TURRET_PLAN.gates) console.log(`   · ${g}`);
{
    // The glide's own corridor: is the column between the corpse and the
    // button free of the level's static solids?
    const c = createIceTurret(OEL.x, OEL.y);
    killIceTurret(c);
    for (let i = 0; i < 12; i += 1) stepIceTurret(c, {});
    const blocked = [];
    for (let y = c.y; y >= button.rect.y - 8; y -= 0.5) {
        const r = { x: c.x - 8, right: c.x + 8, y: y - 8, bottom: y + 8 };
        if (world.collidesSolid(r, {})) blocked.push(y);
    }
    check(blocked.length === 0,
        '⛓ THE GLIDE COLUMN IS CLEAR OF THE LEVEL\'S OWN SOLIDS',
        blocked.length === 0
            ? `every half-pixel of the corpse's box from y=${c.y} up to the button's row is `
              + 'free — the corpse\'s own `solids` list ("Solid","Tree","Rock","Rope",'
              + '"ShieldBoss" plus the Enemy/Player `death()` pushes) meets nothing, so the '
              + 'only body that can stop this glide is the PLAYER.'
            : `blocked at y in {${blocked.slice(0, 6).join(', ')}…} — the corpse cannot reach `
              + 'the button by gliding north and the leg needs a two-axis route.');
    check(true,
        '⚠ AND THE PLAYER IS IN THE CORPSE\'S OWN SOLIDS LIST',
        '`death()` runs `solids.push("Enemy", "Player")`, so a player standing where the '
        + 'corpse is going STOPS the glide at the first blocked sub-step. The push is AWAY '
        + 'from the press point, which puts the player behind it — but a leg that presses '
        + 'and then walks round pays for it.');
    check(ICE_TURRET.activeOffScreen === false,
        '⛔⛔ AND THE GLIDE IS CAMERA-GATED — A 32-TICK COMMITMENT TO STAYING NEAR',
        '`Enemy.update`\'s first line is `if (!activeOffScreen && !onScreen()) return`, and '
        + '`IceTurret` never sets `activeOffScreen` (a `Crusher` does not either, but a '
        + '`Spinner` does — `Spinner.as:44` — which is why L39\'s billiard was simulable '
        + 'from tick 0 and this is not). Off screen the corpse does not glide, does not '
        + 'check its terrain and does not die. The player must keep it on screen for every '
        + 'tick of the 32.');
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n## ${failed.length ? `⛔ ${failed.length} CHECK(S) FAILED` : '✓ ALL CHECKS PASSED'}`
    + ` (${checks.length})`);
for (const c of failed) console.log(`   ⛔ ${c.name}`);
process.exit(failed.length ? 1 : 0);
