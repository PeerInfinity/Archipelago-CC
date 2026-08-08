import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SeedlingRng } from './rng.js';
import {
    ENEMY_COINS_BASE, ENEMY_COINS_SPAN, GRENADE_FREQUENCY, OWL_DRAW_SITES,
    OWL_JIGGLE_SITES, OWL_PHASE_SITES, OwlDrawStream, OwlRngError, ROCK_FREQUENCY,
    OWL_LEVEL_BUILD_DRAWS, OWL_LEVEL_BUILD_SITES,
    ROCK_RADIUS, ROCK_SCALE_BASE, ROCK_SCALE_SPAN, ROCK_STEPS_AHEAD,
    as3Int, assertOwlStreamPremises, owlTickDraws, owlTickSites,
} from './finalBossRng.js';
import { createOwlRoom, stepOwlRoom } from './finalBossFight.js';
import { buildLevelWorld, ROLES } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = join(HERE, 'fixtures', 'owl-rng-oracle.json');

/**
 * ── THE KNOWN ANSWER ──────────────────────────────────────────────────
 *
 * `fixtures/owl-rng-oracle.json` is written by
 * `scripts/procgen/probe-seedling-r6-owl-rng.mjs`, which runs a real tape in
 * the real L112 and reads `botStatus.rng.state` — the generator's live
 * uint32. Stepping the (already-pinned) LFSR from the declared seed to that
 * state recovers exactly how many draws the run made. Everything else in
 * this file is a property check on the transcription; THIS is the check that
 * the transcription is of the right thing.
 *
 * ⚠ IT IS A COUNT, AND A COUNT IS NOT AN ORDER — stated on the probe too,
 * and it is not a weakness of this stratum so much as its boundary. What a
 * count cannot see is two sites swapped; what it catches is an entire
 * producer missing, which is the defect §16.8 exists to describe. The ORDER
 * is pinned by the fight model reproducing rock POSITIONS and SIZES against
 * a live recording — a value check, one stratum up, and one this slice's
 * window owes.
 *
 * ⛓ The counts here are ALSO value-dependent in a way that makes them
 * stronger than they look: whether a grenade fires (and so whether the tick
 * costs 1 draw or 2) is decided by the value of the draw before it. A model
 * with the right count and the wrong values would have to be wrong about the
 * grenade rolls in a way that happened to cancel.
 */
describe('finalBossRng — the Owl room\'s draw count, from the game', () => {
    const present = existsSync(ORACLE);
    const oracle = present ? JSON.parse(readFileSync(ORACLE, 'utf8')) : null;
    const world = buildLevelWorld(atlasLevelSource()(112), { roles: ROLES });

    it('the oracle fixture exists and came from a build with the hooks', () => {
        // ⚠ NOT A SKIP. A missing oracle is the whole stratum going vacuous,
        // and this ladder has been bitten by a green run that tested nothing.
        expect(present, `${ORACLE} is missing — regenerate it with `
            + 'scripts/procgen/probe-seedling-r6-owl-rng.mjs against a built page')
            .toBe(true);
        expect(oracle.split).toBe(true);
        expect(oracle.rows.length).toBeGreaterThan(0);
    });

    it('reproduces every recorded arm — BOTH the draw count and the boss\'s own '
        + 'position, at one and the same offset', () => {
        // ⛔⛔⛔ THE OFFSET IS THE INSTRUMENT, AND IT IS RECOVERABLE.
        // `botStatus.rng.state` and `botMobiles` are both LIVE reads and
        // `Bot`'s finish does not stop the world (`armed = false; finished =
        // true;` and nothing else), so both readouts run a few frames past
        // the tape. Repeats do not remove it — the latency is deterministic
        // per arm, and the two repeats of the 45-tick arm at seed 101 both
        // came back one frame late.
        //
        // What makes it harmless is that the SAME offset shows in both
        // quantities, and one of them is QUANTISED: the Owl walks a
        // 0.5303300858899106 px lattice, so his displacement counts his
        // moving frames exactly. So the check is a TWO-QUANTITY FIT at one
        // unknown offset — find the k in [0, MAX] at which the model's draw
        // count AND the model's boss position both equal the recording's.
        // A model that was wrong about the schedule would have to be wrong
        // about the geometry in the same k to survive that.
        const MAX_OFFSET = 3;
        const seen = [];
        for (const row of oracle.rows) {
            const room = createOwlRoom({ tiles: world.tiles, seed: row.seed });
            const player = {
                x: oracle.boot.x + 8, y: oracle.boot.y + 8, vx: 0, vy: 0,
            };
            // ⛔ `introEndsAt` is the span's `from`, MEASURED — see the probe.
            for (let t = 0; t < row.ticks; t += 1) {
                stepOwlRoom(room, { player, introRelease: t === oracle.introEndsAt });
            }
            let offset = null;
            for (let k = 0; k <= MAX_OFFSET && offset === null; k += 1) {
                const drawsMatch = room.stream.count === row.draws;
                const bossMatch = !row.boss
                    || (Math.abs(room.boss.x - row.boss.x) < 1e-6
                        && Math.abs(room.boss.y - row.boss.y) < 1e-6);
                if (drawsMatch && bossMatch) offset = k;
                else stepOwlRoom(room, { player, introRelease: false });
            }
            expect(offset,
                `seed ${row.seed}, ${row.ticks} ticks (${row.why}): the model reached `
                + `${room.stream.count} draws at (${room.boss.x}, ${room.boss.y}) and `
                + `the game reported ${row.draws} at `
                + `(${row.boss?.x}, ${row.boss?.y}) — no offset in [0, ${MAX_OFFSET}] `
                + 'fits BOTH').not.toBeNull();
            seen.push(offset);
        }
        // ⚠ AND THE OFFSETS ARE SMALL AND MOSTLY ZERO. If this ever reads
        // like a free parameter — every arm needing a different large k —
        // the fit has stopped being evidence and the failure is the model's.
        expect(Math.max(...seen)).toBeLessThanOrEqual(2);
        expect(seen.filter((k) => k === 0).length).toBeGreaterThan(seen.length / 2);
    });

    it('the repeats agree with each other — the latency is DETERMINISTIC', () => {
        // ⛔ AND THAT IS WHY THE MINIMUM ALONE IS NOT THE CURE. The probe
        // takes the minimum over repeats on the reasoning that the drift is
        // one-signed; it is, but it is also the same every time for a given
        // arm, so the minimum removes nothing. The two-quantity fit above is
        // what actually handles it. This row records the fact rather than
        // leaving the probe's stated rationale standing unchallenged.
        for (const row of oracle.rows) {
            expect(row.pollDriftObserved,
                `seed ${row.seed}, ${row.ticks} ticks: runs ${row.drawsRuns}`)
                .toBeLessThanOrEqual(2);
        }
    });

    it('the intro arm is a NEGATIVE CONTROL and the fixture contains one', () => {
        // ⛓ The shortest arm ends before the X release, so the boss returns
        // above every draw site he owns and the whole count is the level
        // build. Without this row a model that drew nothing at all would
        // agree with a model that drew correctly on every later arm only by
        // accident; with it, the build constant is measured rather than
        // fitted.
        const intro = oracle.rows.find((r) => r.ticks <= oracle.introEndsAt);
        expect(intro, 'the probe must include an arm shorter than the intro release')
            .toBeTruthy();
        expect(intro.draws).toBe(oracle.levelBuildDraws);
    });
});

describe('finalBossRng — the schedule', () => {
    it('every site in the table is a method, and every method is in the table', () => {
        // ⛔ trap 86's cure applied to a draw census: a site added to the
        // class and not to the table (or the reverse) is a SILENCE, and the
        // whole §16.8 finding is that a schedule and a census drift.
        const s = new OwlDrawStream(12345);
        s.barrageRoll();
        s.spawnX(0, 0);
        s.spawnY(0, 0);
        s.rockScale();
        s.grenadeRoll();
        s.enemyCoins();
        s.deathRockX();
        s.orbRandVal();
        s.jiggle(3);
        const emitted = new Set(s.log.map((d) => d.site));
        expect([...emitted].sort()).toEqual(Object.keys(OWL_DRAW_SITES).sort());
    });

    it('every phase\'s site list names only real sites', () => {
        for (const [phase, sites] of Object.entries(OWL_PHASE_SITES)) {
            for (const site of sites) {
                expect(OWL_DRAW_SITES[site], `${phase} -> ${site}`).toBeTruthy();
            }
        }
        for (const site of OWL_JIGGLE_SITES) expect(OWL_DRAW_SITES[site]).toBeTruthy();
    });

    it('prices the four phases that cost nothing, and says why', () => {
        // ⛓ THE COAST ROW IS THE ONE THE FIGHT LEANS ON: a shoved Owl fails
        // `v.length <= moveSpeed` and takes no arm at all, so the 18 ticks
        // after a press cost the stream nothing from him.
        for (const phase of ['intro', 'frozen', 'lavaHit', 'podTick', 'coast']) {
            expect(owlTickDraws(phase, false), phase).toBe(0);
        }
    });

    it('prices the phases that do draw, including the grenade\'s ctor', () => {
        expect(owlTickDraws('barrage', false)).toBe(1);
        expect(owlTickDraws('barrageSpawn', false)).toBe(4);
        expect(owlTickDraws('walk', false)).toBe(1);
        // ⛔ THE SITE §16.8's SCHEDULE DID NOT HAVE. `Enemy.as:30`'s `coins`
        // is an instance field initializer, so `new Grenade(...)` draws.
        expect(owlTickDraws('walkGrenade', false)).toBe(2);
        expect(owlTickDraws('deathAnim', false)).toBe(10);
    });

    it('the jiggle is a property of the FRAME, appended last', () => {
        // ⛔ Not folded into the phase rows: it fires on ticks the boss is
        // frozen, dead or coasting, and folding it in would make "0 draws
        // while coasting" false in exactly the case a plan leans on.
        expect(owlTickSites('coast', true)).toEqual(['jiggleX', 'jiggleY']);
        expect(owlTickSites('barrageSpawn', true))
            .toEqual(['barrageRoll', 'spawnX', 'spawnY', 'rockScale', 'jiggleX', 'jiggleY']);
        expect(owlTickDraws('intro', true)).toBe(2);
    });

    it('the level build is TWO draws, both attributed, and the room consumes them', () => {
        // ⛔ `Game.begin()` — not the constructor — is where `loadlevel` lives,
        // so `Bot.botStart`'s `Rng.setState` lands BEFORE the world is built
        // and the build's own draws are on the seeded stream. The shipped
        // comment at `Bot.as:1160` says the opposite.
        expect(OWL_LEVEL_BUILD_SITES).toEqual(['enemyCoins', 'orbRandVal']);
        expect(OWL_LEVEL_BUILD_DRAWS).toBe(2);
        const s = new OwlDrawStream(777);
        s.levelBuild();
        expect(s.count).toBe(OWL_LEVEL_BUILD_DRAWS);
        expect(s.log.map((d) => d.site)).toEqual([...OWL_LEVEL_BUILD_SITES]);
    });

    it('refuses a phase it does not have, by name', () => {
        expect(() => owlTickSites('rampage', false)).toThrow(OwlRngError);
    });
});

describe('finalBossRng — the arithmetic at each site', () => {
    it('barrageRoll is the game\'s own `!Math.floor(random * 6)` idiom', () => {
        const a = new OwlDrawStream(4242);
        const b = new SeedlingRng(4242);
        for (let i = 0; i < 200; i += 1) {
            expect(a.barrageRoll()).toBe(!Math.floor(b.next() * ROCK_FREQUENCY));
        }
    });

    it('grenadeRoll is the same idiom against 40', () => {
        const a = new OwlDrawStream(99);
        const b = new SeedlingRng(99);
        for (let i = 0; i < 200; i += 1) {
            expect(a.grenadeRoll()).toBe(!Math.floor(b.next() * GRENADE_FREQUENCY));
        }
    });

    it('the spawn draws x THEN y, and both lead BEHIND the player', () => {
        // ⛓ `stepsAhead` is -15, so the aim is fifteen steps of the player's
        // own velocity BEHIND them. A stationary player is aimed at directly;
        // a moving one is aimed at where they came from. That sign is the
        // whole reason a stance can dodge a barrage by walking.
        const a = new OwlDrawStream(7);
        const b = new SeedlingRng(7);
        const x = a.spawnX(100, 1.5);
        const y = a.spawnY(200, -0.5);
        expect(x).toBe(100 + 1.5 * ROCK_STEPS_AHEAD + b.next() * ROCK_RADIUS * 2 - ROCK_RADIUS);
        expect(y).toBe(200 + -0.5 * ROCK_STEPS_AHEAD + b.next() * ROCK_RADIUS * 2 - ROCK_RADIUS);
        expect(a.log.map((d) => d.site)).toEqual(['spawnX', 'spawnY']);
    });

    it('rockScale lands in [0.25, 0.75) — which is also the hitbox and the shake', () => {
        const s = new OwlDrawStream(31337);
        for (let i = 0; i < 500; i += 1) {
            const v = s.rockScale();
            expect(v).toBeGreaterThanOrEqual(ROCK_SCALE_BASE);
            expect(v).toBeLessThan(ROCK_SCALE_BASE + ROCK_SCALE_SPAN);
        }
    });

    it('enemyCoins is an `int` slot, so the value truncates', () => {
        const s = new OwlDrawStream(555);
        for (let i = 0; i < 200; i += 1) {
            const v = s.enemyCoins();
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(ENEMY_COINS_BASE);
            expect(v).toBeLessThan(ENEMY_COINS_BASE + ENEMY_COINS_SPAN);
        }
    });

    it('the jiggle draws x then y and is centred on zero', () => {
        const s = new OwlDrawStream(2024);
        const { dx, dy } = s.jiggle(4);
        expect(s.log.map((d) => d.site)).toEqual(['jiggleX', 'jiggleY']);
        for (const d of [dx, dy]) {
            expect(d).toBeGreaterThanOrEqual(-2);
            expect(d).toBeLessThan(2);
        }
    });

    it('as3Int truncates toward zero, which is what an `int` parameter does', () => {
        // → trap 108, and it is live at three sites in this room.
        expect(as3Int(7.9)).toBe(7);
        expect(as3Int(-7.9)).toBe(-7);
        expect(as3Int(-0.4)).toBe(-0);
    });

    it('the stream\'s state is the number `botStatus.rng.state` reports', () => {
        const s = new OwlDrawStream(1234567);
        const plain = new SeedlingRng(1234567);
        for (let i = 0; i < 50; i += 1) { s.barrageRoll(); plain.next(); }
        expect(s.state).toBe(plain.state);
        expect(s.count).toBe(50);
    });
});

describe('finalBossRng — the premise the table is only complete under', () => {
    it('refuses `split: false`, naming the site that would be missed', () => {
        expect(() => assertOwlStreamPremises({ seed: 5, split: false }))
            .toThrow(/Music\.as:673/);
    });

    it('refuses seed 0, because "the build\'s boot state" is not an ORIGIN', () => {
        // → trap 90: reproducible is not predictable. A tape that inherits
        // the page's own state is reproducible and this model still cannot
        // say where the stream is.
        expect(() => assertOwlStreamPremises({ seed: 0, split: true })).toThrow(OwlRngError);
        expect(() => assertOwlStreamPremises({ seed: 1.5, split: true })).toThrow(OwlRngError);
    });

    it('accepts a declared seed with the split on', () => {
        expect(assertOwlStreamPremises({ seed: 1234567, split: true })).toBe(true);
    });
});
