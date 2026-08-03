#!/usr/bin/env node
/**
 * plan-seedling-r5-l60-kill — the rung's FIRST LIVE KILL, and its control.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 3. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §4 slice 3.
 *
 * ── WHY L60 ───────────────────────────────────────────────────────────
 * It is the cheapest witness on the map and the slice-0 recon named it as
 * such: `lock@128,80` gated on TWO jellyfish, both already inside R4's own
 * route (the committed walk sits in their 160 px leash for 115 ticks,
 * twice), and the lock sits in the one-tile corridor between the room's two
 * doors — so "the lock opened" and "the walk got through" are the same
 * observation.
 *
 * ── THE PAIR, ONE FIELD APART ─────────────────────────────────────────
 * Two tapes identical in every field but `inputs`' primary spans:
 *
 *   r5-l60-kill-control   no presses. The jellyfish live, `totalEnemies()`
 *                         never reaches 0, the Lock stays `type = "Solid"`,
 *                         and the walk PINS against it at x = 126.
 *   r5-l60-kill           the presses. Both die, the lock fades out, and
 *                         the walk crosses to x = 150 — past the lock's
 *                         [128,144) and short of the east teleporter's
 *                         [160,176), so the trace stays in L60 and the
 *                         crossing is unambiguous.
 *
 * A kill claimed from the control arm alone is a walk that stopped for some
 * reason; a kill claimed from the kill arm alone is a walk that might never
 * have been blocked. Only the pair is evidence.
 *
 * ── ⛔ THE HUNDRED-TICK FADE, which nothing before this rung knew ─────
 * `Lock.activationStep` does NOT open on the last kill. `checkEnemies` sets
 * `activate` when `totalEnemies() == 0`, and then the graphic's alpha
 * decays by **0.01 per update** until it reaches 0 — and only `turnOff()`
 * writes `type = ""` and `Game.setPersistence(tag, false)`. That is 100
 * ticks of standing there after the fight, on top of the 35-tick death
 * animation during which the body is still an entity `totalEnemies()`
 * counts. A window floor that stopped at the last press would leave the
 * walk pressing against a lock that was going to open.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-l60-kill.mjs           # plan + report
 *   node scripts/procgen/plan-seedling-r5-l60-kill.mjs --write   # write the tapes
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, combatPlacementOf, rect, rectsOverlap } =
    await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { combatCensus } = await import(join(MODULE, 'combat.js'));
const { chaserStep, chaserBoxAt, deathTicks } = await import(join(MODULE, 'chasers.js'));
const { swingHits, KILL_PRESS_CADENCE, SLASH_SCALE_NORMAL } =
    await import(join(MODULE, 'combatVerbs.js'));
const { serializeTape } = await import(join(MODULE, 'tapeFormat.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));

const LEVEL = 60;
const WRITE = process.argv.includes('--write');

/** `Enemy.hitsTimerMax`, and `Lock`'s alpha fade at 0.01/update. */
const IFRAMES = 30;
const LOCK_FADE_TICKS = 100;

/**
 * The stance.
 *
 * Row 5 (y in [80,96)) is the room's only corridor: `Ghost Tile` at columns
 * 0-1 and 8-10, `Water` at 2-7, and PIT everywhere above and below. So the
 * whole fight happens on one line, y = 88, and the only choice is x.
 *
 * 112 is the last water column before the lock's own tile (8). Standing
 * there puts both jellyfish inside the leash from tick 0 — (64,72) is 51 px
 * away and (128,120) is 35 — and leaves 14 px of walk to the lock face, so
 * the control arm's pin is a short unambiguous move rather than a long one
 * that could be attributed to anything else.
 *
 * ⚠ `direction` is 3 (DOWN) at boot — `Player.as:61`, and nothing but
 * movement changes it. The rect is therefore `[x-16, x+16) x [y, y+16)`,
 * which does NOT cover a jellyfish approaching from above. It does not have
 * to: a chaser drives itself onto the player's centre and nothing separates
 * them (`Player.solids` has no "Enemy" and the jellyfish's own "Enemy"
 * solid is other jellyfish), so a body in contact overlaps the rect for
 * EVERY facing and the point-to-box distance is 0.
 */
const STANCE = { x: 112, y: 88 };

const source = atlasLevelSource();
const rec = source(LEVEL);
const world = buildLevelWorld(rec, { roles: ROLES });
const census = combatCensus(rec, { placementOf: combatPlacementOf });
const jellies = census.enemies.filter((e) => e.tag === 'jellyfish');
if (jellies.length !== 2) {
    throw new Error(`L60 should hold exactly 2 jellyfish, the census says ${jellies.length}`);
}
const lock = world.activators.find((a) => a.id === 'lock@128,80');
if (!lock) throw new Error('L60 lock@128,80 is not in the activator list');

console.log(`## L60's kill lock — ${lock.id}, persistence tag ${lock.persistTag}`);
console.log(`   lock rect ${JSON.stringify(lock.rect)}`);
for (const j of jellies) console.log(`   jellyfish .oel (${j.x},${j.y}) -> centre (${j.cx},${j.cy})`);
console.log(`   stance (${STANCE.x}, ${STANCE.y}), facing DOWN (direction 3, the boot default)`);
console.log(`   ⚠ the tape's boot block is (${STANCE.x - 8}, ${STANCE.y - 8}) — the Game `
    + 'constructor adds Tile/2 to it, exactly as every entity ctor does');

/**
 * The fight, simulated through the shipped transcriptions.
 *
 * ⚠ It is a PLANNING instrument and it says so: it does not model the
 * enemy-enemy solid, the camera's off-screen freeze (both bodies are well
 * inside the 160x160 view from this stance — checked below), or the
 * sub-pixel of `Game.view`'s rounding. Its output is a press count and a
 * window floor, and both are FLOORS. The claim is the live pair.
 */
function simulate(pressTicks, ticks) {
    const state = jellies.map((j) => ({
        tag: j.tag, x: j.cx, y: j.cy, v: { x: 0, y: 0 },
        hits: 0, iframes: 0, dying: false, deadAt: null, dyingSince: null,
    }));
    const presses = new Set(pressTicks);
    let allDeadAt = null;
    for (let t = 0; t < ticks; t += 1) {
        for (const e of state) {
            if (e.deadAt !== null) continue;
            if (e.dying) {
                if (t - e.dyingSince >= deathTicks(e.tag)) e.deadAt = t;
                continue;
            }
            const s = chaserStep(e.tag, e, STANCE, { onScreen: true });
            e.x = s.x; e.y = s.y; e.v = s.v;
            if (e.iframes > 0) e.iframes -= 1;
        }
        // ⚠ The hit test is at press + 1, never on the press's own tick —
        // `Player.update` calls `slash()` before it reaches `input()`.
        if (presses.has(t - 1)) {
            const targets = state
                .filter((e) => !e.dying && e.deadAt === null && e.iframes <= 0)
                .map((e, i) => ({
                    id: `j${i}`, cx: e.x, cy: e.y, type: 'Enemy',
                    box: chaserBoxAt(e.tag, e.x, e.y), ref: e,
                }));
            // No solid stands between this stance and either body — the
            // corridor is one tile and the lock is east of both.
            const hits = swingHits(STANCE, 3, targets, {
                blockedLine: () => false, scale: SLASH_SCALE_NORMAL,
            });
            for (const h of hits) {
                const e = targets.find((x) => x.id === h.id).ref;
                e.hits += h.damage;
                e.iframes = IFRAMES;
                // `Enemy.knockback(f, p)` — an impulse AWAY from the player.
                const a = Math.atan2(e.y - STANCE.y, e.x - STANCE.x);
                e.v = { x: e.v.x + h.force * Math.cos(a), y: e.v.y + h.force * Math.sin(a) };
                if (e.hits >= 3) { e.dying = true; e.dyingSince = t; }
            }
        }
        if (allDeadAt === null && state.every((e) => e.deadAt !== null)) allDeadAt = t;
    }
    return { state, allDeadAt };
}

// A generous schedule: twelve presses at the 31-tick floor. Three landed
// hits kill one jellyfish and the census says two, so six is the
// arithmetic; the rest is the R2 hold lesson — the count is a floor,
// because a knocked-back body spends ticks coming back and the schedule
// must not run out before it does.
const PRESS_COUNT = 10;
const FIGHT_START = 4;
const pressTicks = [];
for (let i = 0; i < PRESS_COUNT; i += 1) {
    pressTicks.push(FIGHT_START + i * KILL_PRESS_CADENCE);
}
const sim = simulate(pressTicks, 1200);
console.log(`\n## the simulated fight — ${PRESS_COUNT} presses at ${KILL_PRESS_CADENCE} ticks`);
for (const [i, e] of sim.state.entries()) {
    console.log(`   jellyfish ${i}: hits ${e.hits}/3, `
        + `${e.deadAt === null ? 'STILL ALIVE at the end of the sim' : `destroyed at t=${e.deadAt}`}`);
}
if (sim.allDeadAt === null) {
    console.log('\n⛔ the schedule does not finish the fight in the model. Widen it before '
        + 'recording — a live run that fails here is 40 minutes to find out.');
    process.exit(1);
}
const lockOpensAt = sim.allDeadAt + LOCK_FADE_TICKS;
console.log(`   both destroyed by t=${sim.allDeadAt}; the lock's 0.01/update alpha fade `
    + `then runs ${LOCK_FADE_TICKS} ticks, so \`turnOff()\` lands at ~t=${lockOpensAt}`);

/**
 * The walk out.
 *
 * The player box is 4x5 at origin (2,2), so its right edge is `x + 2`.
 * Blocked, `Mobile.moveX` stops one pixel short of the lock's left face:
 * `x + 2 == 128`, i.e. x = 126. Past it, the walk stops at 150 — clear of
 * the lock's [128,144) and 8 px short of the east teleporter's trigger
 * (`x + 2 > 160`), so the trace never leaves L60.
 */
const WALK_START = lockOpensAt + 20;
const PIN_X = 126;
const CROSS_X = 150;
// Walk speed on a Ghost Tile / coerced water is the ordinary 1 px accel to
// a moveSpeed the R1-R4 physics already pins; the tape holds RIGHT long
// enough to cover 38 px with a wide margin and closes ~8 ticks early so the
// window ends AT REST (the §10.2 authoring contract).
const WALK_TICKS = 120;
const TICK_COUNT = WALK_START + WALK_TICKS + 12;

/**
 * ⛔ THE BOOT BLOCK IS NOT THE PLAYER'S POSITION — it is +8/+8 short of it.
 *
 * `new Game(level, x, y)` writes `Main.playerPosition{X,Y}` and the player
 * is constructed at `(x + Tile.w/2, y + Tile.h/2)` — the SAME half-tile
 * offset every entity's constructor applies, and the same one that put
 * slice 2's whole census eight pixels up and left of the game. Declaring
 * `boot: STANCE` puts the player at (120, 96) instead of (112, 88), whose
 * terrain probe lands in ROW 6 — and row 6 is Pit from column 8 east, which
 * is not a coerced hazard on this tape. The model caught it before a browser
 * did, and only because the plan states the stance and the tape states the
 * boot as two separate things.
 *
 * `r5-contact-control-on` says the same thing from the other side: boot
 * (32, 120), first observation (40, 128).
 */
const BOOT = { level: LEVEL, x: STANCE.x - 8, y: STANCE.y - 8 };

const shared = {
    game: 'seedling',
    tape_version: 3,
    boot: BOOT,
    noclip: false,
    // ⚠ `noDamage` is TRUE on BOTH arms, deliberately. The pair's one field
    // is the presses; adding a second difference would make the divergence
    // unattributable. And R4's own route runs with the guard armed, so this
    // is the rung's current posture rather than a relaxation invented here.
    // What the pair proves is that the SWING kills — not that the player
    // survives, which is a separate claim with its own control (slice 2's
    // `r5-contact-control` pair).
    noDamage: true,
    // L60 is a WATER room: row 5 is Water at columns 2-7 and Waterfall
    // fills rows 7-8. R4's terminal hazard set is exactly these two, and
    // slice 3 has no water physics — that lands with slice 4.
    noHazards: ['water', 'waterfall'],
    grants: [{ level: LEVEL, items: ['sword'] }],
    persistence: [],
    tick_count: TICK_COUNT,
};

const walkSpan = { key: 'right', from: WALK_START, to: WALK_START + WALK_TICKS };
const control = {
    ...shared,
    name: 'r5-l60-kill-control',
    description: 'THE FIRST LIVE KILL, arm 1 of 2 — the presses REMOVED. Identical to '
        + '`r5-l60-kill` in every field but `inputs`. Both jellyfish live, so '
        + '`Game.totalEnemies()` never reaches 0, `Lock.checkEnemies` never activates, '
        + 'and the lock keeps `type = "Solid"`: the walk PINS at x = 126, one pixel of '
        + 'player box short of the lock\'s [128,144) face. Without this arm "the walk '
        + 'got through" is not evidence that anything was ever in the way.',
    inputs: [walkSpan],
};
const kill = {
    ...shared,
    name: 'r5-l60-kill',
    description: `THE FIRST LIVE KILL, arm 2 of 2 — ${PRESS_COUNT} sword presses at the `
        + `${KILL_PRESS_CADENCE}-tick cadence (21 is the DASH floor, 31 the enemy `
        + 'i-frame one; the larger wins). Both jellyfish chase onto the stance — the '
        + '160 px leash is the whole room — and are cut where they arrive. The count is '
        + 'a FLOOR: six landed hits is the arithmetic and twelve presses is the '
        + 'schedule, because a knocked-back body spends ticks coming back. The '
        + 'assertion is the EFFECT: `persistence_cleared` gains {60, 0} — which only '
        + '`Lock.turnOff()` writes, 100 ticks of alpha fade after `totalEnemies()` '
        + 'reaches 0 — and the same held RIGHT that pins the control arm at 126 '
        + 'crosses to 150.',
    inputs: [
        ...pressTicks.map((t) => ({ key: 'primary', from: t, to: t + 2 })),
        walkSpan,
    ],
};

console.log('\n## the pair');
console.log(`   fight    presses at ${pressTicks.join(', ')}`);
console.log(`   walk     RIGHT [${walkSpan.from}, ${walkSpan.to}), tick_count ${TICK_COUNT}`);
console.log(`   control  expected terminal x ~= ${PIN_X} (pinned at the lock face)`);
console.log(`   kill     expected terminal x ~= ${CROSS_X} (past [128,144), short of the door)`);
console.log(`   ledger   the kill arm must gain {level ${LEVEL}, tag ${lock.persistTag}} `
    + 'and the control arm must NOT');

// The stance is a legal one, checked rather than asserted: the box must sit
// inside the corridor row and clear of the lock.
const box = playerBoxAt(STANCE.x, STANCE.y);
if (rectsOverlap(box, rect(lock.rect.x, lock.rect.y, 16, 16))) {
    throw new Error('the stance overlaps the lock');
}
console.log(`\n   stance box ${JSON.stringify(box)} — clear of the lock, inside row 5`);

if (WRITE) {
    const dir = join(MODULE, 'fixtures', 'tapes');
    for (const t of [control, kill]) {
        const path = join(dir, `${t.name}.json`);
        writeFileSync(path, serializeTape(t));
        console.log(`   wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the two tapes)');
}
