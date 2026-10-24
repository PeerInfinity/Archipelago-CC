/**
 * Generator FEATURE realise-and-derive gates (plan §4.5, split out of
 * generator.test.js by the test-strategy rebalance §1). Each test invokes
 * generateLevel/generateZoneSet to prove a gate template still realises its
 * geometry AND derives exactly its requirement set — the category-1
 * exact-derivation proofs for the sphere path. Generation-bound, so they run
 * serially in the slow battery, never the default suite. The dump CLI gate
 * (subprocess generation) rides along.
 */

import { execSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import {
    CELESTE_GEOMETRY, deriveGeometry, validateGeometry,
    generateLevel, generateZoneSet, applyCeilingMargin, deriveGeneratedRules,
} from './generator.js';
import { DEFAULTS } from './physics.js';
import { validateLevel } from './level.js';

describe('generateLevel', () => {
    it('empty requirement: a verified plain strip with wake goals', () => {
        const level = generateLevel({ id: 'g0', requirement: [], seed: 1 });
        expect(validateLevel(level, DEFAULTS)).toEqual([]);
        expect(level.pickups).toHaveLength(1);
        expect(level.portals.map((p) => p.id)).toContain('exit_main');
        expect(level.spawn).toEqual({ x: 1, y: 1 });
    });

    it('same seed ⇒ byte-identical level (branches + hazards included)', () => {
        const opts = {
            id: 'gd', requirement: ['doubleJump'], branchCount: 1,
            hazardChance: 0.5, seed: 2,
        };
        expect(JSON.stringify(generateLevel(opts)))
            .toBe(JSON.stringify(generateLevel(opts)));
    });

    it('spring requirement: every goal derives exactly [spring]', () => {
        const level = generateLevel({ id: 'spr', requirement: ['spring'], seed: 3 });
        expect(level.platforms.some((p) => p.type === 'spring')).toBe(true);
        const derived = deriveGeneratedRules(level, DEFAULTS);
        expect(derived.defects).toEqual([]);
        for (const pk of level.pickups) {
            expect(derived.pickups[pk.id].minimalSets).toEqual([['spring']]);
        }
        for (const pt of level.portals) {
            expect(derived.exits[pt.id].minimalSets).toEqual([['spring']]);
        }
    }, 60000);

    it('branch-tip landing floors are hazard-exempt (the fall-off corridor must stay clean)', () => {
        // the tip's portal box spans its wake, so portal-clean
        // crossings land on the LEFT end of the next floor — a spike
        // patch there is a doom window (user-reported). hazardChance 1
        // makes the exemption observable: every eligible floor is
        // spiked, tip landing floors never.
        const level = generateLevel({
            id: 'brh', requirement: [], pickupCount: 1, branchCount: 2,
            hazardChance: 1, seed: 3,
        });
        const tips = level.platforms.filter((p) => level.portals.some(
            (pt) => pt.on === p.id && pt.id.startsWith('exit_br')));
        expect(tips.length).toBe(2);
        for (const tip of tips) {
            const landing = level.platforms
                .filter((p) => p.type === 'ground' && p.y === 0 && p.x >= tip.x + tip.w - 0.01)
                .sort((a, b) => a.x - b.x)[0];
            const spiked = level.hazards.some((hz) => hz.type === 'spikes'
                && hz.x >= landing.x && hz.x < landing.x + landing.w);
            expect(spiked, `spikes on ${landing.id} after ${tip.id}`).toBe(false);
        }
    }, 60000);

    it('glide requirement: ramp + pad + chasm; every goal derives exactly [glide]', () => {
        const level = generateLevel({ id: 'gl', requirement: ['glide'], seed: 7 });
        const pads = level.platforms.filter((p) => p.type === 'glider');
        expect(pads).toHaveLength(1);
        const pad = pads[0];
        // the chasm: no platform surface between the pad's right edge
        // and the landing floor, which starts a GLIDE_GAP-window width
        // away and is widened by GLIDE_LAND_PAD (containment)
        const landing = level.platforms
            .filter((p) => p.type === 'ground' && p.x >= pad.x + pad.w)
            .sort((a, b) => a.x - b.x)[0];
        const gap = Math.round((landing.x - (pad.x + pad.w)) * 100) / 100;
        const G = CELESTE_GEOMETRY;
        expect(gap).toBeGreaterThanOrEqual(G.GLIDE_GAP.min);
        expect(gap).toBeLessThanOrEqual(G.GLIDE_GAP.min + G.GLIDE_GAP.span + 0.01);
        expect(landing.w).toBeGreaterThanOrEqual(G.GLIDE_LAND_PAD);
        // the landing floor is hazard-exempt (the glide must survive)
        for (const hz of level.hazards) {
            expect(hz.x + hz.w <= landing.x || hz.x >= landing.x + landing.w,
                `hazard ${hz.id} on the glide landing floor`).toBe(true);
        }
        const derived = deriveGeneratedRules(level, DEFAULTS);
        expect(derived.defects).toEqual([]);
        for (const pk of level.pickups) {
            expect(derived.pickups[pk.id].minimalSets).toEqual([['glide']]);
        }
        for (const pt of level.portals) {
            expect(derived.exits[pt.id].minimalSets).toEqual([['glide']]);
        }
    }, 60000);

    it('shield requirement: one bed fills the gap airspace; every goal derives exactly [shield]', () => {
        const level = generateLevel({
            id: 'sh', requirement: ['shield'], hazardChance: 0.5, seed: 1,
        });
        const beds = level.hazards.filter((hz) => hz.type === 'bed');
        expect(beds).toHaveLength(1); // one budgeted hazard per strip (§4.10)
        const bed = beds[0];
        const G = CELESTE_GEOMETRY;
        // the volume: below the floor line up past the dj overfly bound,
        // inset from both lips (grounded stands never touch it)
        expect(bed.y).toBeLessThan(1);
        expect(bed.y + bed.h).toBeCloseTo(1 + G.BED_TOP, 5);
        const flankL = level.platforms
            .filter((p) => p.type === 'ground' && p.x + p.w <= bed.x + 0.01)
            .sort((a, b) => (b.x + b.w) - (a.x + a.w))[0];
        const landing = level.platforms
            .filter((p) => p.type === 'ground' && p.x >= bed.x + bed.w - 0.01)
            .sort((a, b) => a.x - b.x)[0];
        expect(bed.x - (flankL.x + flankL.w)).toBeCloseTo(G.BED_INSET, 5);
        expect(landing.x - (bed.x + bed.w)).toBeCloseTo(G.BED_INSET, 5);
        // gap drawn from the BED_GAP window
        const gap = Math.round((landing.x - (flankL.x + flankL.w)) * 100) / 100;
        expect(gap).toBeGreaterThanOrEqual(G.BED_GAP.min);
        expect(gap).toBeLessThanOrEqual(G.BED_GAP.min + G.BED_GAP.span + 0.01);
        // the landing floor is hazard-exempt (crossings land budget-spent)
        for (const hz of level.hazards) {
            if (hz.type === 'bed') continue;
            expect(hz.x + hz.w <= landing.x || hz.x >= landing.x + landing.w
                || hz.y + hz.h <= landing.y + landing.h,
            `hazard ${hz.id} on the bed landing floor`).toBe(true);
        }
        const derived = deriveGeneratedRules(level, DEFAULTS);
        expect(derived.defects).toEqual([]);
        expect(derived.universe).toContain('shield');
        for (const pk of level.pickups) {
            expect(derived.pickups[pk.id].minimalSets).toEqual([['shield']]);
        }
        for (const pt of level.portals) {
            expect(derived.exits[pt.id].minimalSets).toEqual([['shield']]);
        }
    }, 60000);

    it('a profile that refuses glide gates (GLIDE_GAP null) throws on a glide requirement', () => {
        const refusing = { ...CELESTE_GEOMETRY, GLIDE_GAP: null };
        expect(() => generateLevel({
            id: 'glr', requirement: ['glide'],
            physics: { constants: DEFAULTS, geometry: refusing },
        })).toThrow(/refuses glide gates/);
    });

    it('rejects abilities without a gate template', () => {
        expect(() => generateLevel({ requirement: ['highJump'] }))
            .toThrow(/no gate template/);
    });

    it('reward shelf (shelfChance 1): one oneway shelf over the last gate carries loc_0', () => {
        const level = generateLevel({
            id: 'sh', requirement: ['spring'], pickupCount: 2, shelfChance: 1, seed: 1,
        });
        const shelves = level.platforms.filter((p) => p.type === 'oneway');
        expect(shelves).toHaveLength(1);
        const shelfPickups = level.pickups.filter((pk) => pk.on === shelves[0].id);
        expect(shelfPickups.map((pk) => pk.id)).toEqual(['loc_0']);
        // the other pickup stays a trunk floor; total count is unchanged
        expect(level.pickups).toHaveLength(2);
        // the shelf is dj-proof by construction: its top sits above the
        // swept dj rise over the floors' top (y=1)
        const top = shelves[0].y + shelves[0].h;
        expect(top - 1).toBeGreaterThan(CELESTE_GEOMETRY.RISE.dj + 0.8);
    }, 60000);

    // Generating a verified level is this file's dominant cost, so
    // tests that need the SAME geometry share one generation.
    let djShelfLevel = null;
    const genDjShelf = () => {
        djShelfLevel ??= generateLevel({
            id: 'shdj', requirement: ['doubleJump'], pickupCount: 1, shelfChance: 1, seed: 1,
        });
        return djShelfLevel;
    };

    it('reward shelf on a dj gate sits strictly between the swept rises', () => {
        const level = genDjShelf();
        const shelves = level.platforms.filter((p) => p.type === 'oneway');
        expect(shelves).toHaveLength(1);
        const rise = shelves[0].y + shelves[0].h - 1;
        expect(rise).toBeGreaterThan(CELESTE_GEOMETRY.RISE.single);
        expect(rise).toBeLessThan(CELESTE_GEOMETRY.RISE.dj);
        expect(level.pickups.some((pk) => pk.on === shelves[0].id)).toBe(true);
    }, 60000);

    it('dj-shelf saw (§8.7 step 3): under the right half, corridor-clear via the rise guard', () => {
        const level = genDjShelf();
        const shelf = level.platforms.find((p) => p.type === 'oneway');
        const saw = level.hazards.find((hz) => hz.type === 'saw');
        expect(saw, 'seed 1 draws the dj-shelf saw').toBeTruthy();
        // hangs just under the shelf, in its right half
        expect(saw.y).toBeCloseTo(shelf.y - CELESTE_GEOMETRY.SAW_H - 0.05, 2);
        expect(saw.x).toBeGreaterThanOrEqual(shelf.x + 0.55 * shelf.w - 0.01);
        expect(saw.x + saw.w).toBeLessThanOrEqual(shelf.x + shelf.w - 0.19);
        // the rise guard held: the saw's underside clears the landing
        // floor's run corridor with margin
        expect(saw.y - 1).toBeGreaterThanOrEqual(DEFAULTS.PLAYER_H + 0.3 - 0.01);
        const rise = shelf.y + shelf.h - 1;
        expect(rise).toBeGreaterThanOrEqual(CELESTE_GEOMETRY.DJ_SAW_MIN_RISE);
    }, 60000);

    it('vertical jitter: raised plain floors only; anchors stay at base', () => {
        const opts = {
            id: 'jt', requirement: ['doubleJump'], pickupCount: 2, branchCount: 1,
            hazardChance: 0.5, shelfChance: 1, jitter: 1, seed: 1,
        };
        const level = generateLevel(opts);
        const floors = level.platforms.filter((p) => p.type === 'ground' && p.h === 1);
        // some interior floor rose, and no rise exceeds the cap
        expect(floors.some((p) => p.y > 0)).toBe(true);
        for (const p of floors) {
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(CELESTE_GEOMETRY.JITTER_MAX);
        }
        // entrance (first) and exit (last) floors stay base-anchored
        const byX = [...floors].sort((a, b) => a.x - b.x);
        expect(byX[0].y).toBe(0);
        expect(byX[byX.length - 1].y).toBe(0);
        // gate-adjacent anchoring: the shelf's gate floor is at base
        const shelf = level.platforms.find((p) => p.type === 'oneway');
        expect(shelf).toBeTruthy();
        // pickups ride their host floor's rise (wake invariant intact)
        expect(validateLevel(level, DEFAULTS)).toEqual([]);
        // determinism
        expect(JSON.stringify(generateLevel(opts))).toBe(JSON.stringify(level));
    }, 60000);

    it('split segments (splitChance 1): ramp + one-way top lane + base merge floor', () => {
        const level = generateLevel({
            id: 'sp', requirement: ['doubleJump'], pickupCount: 1,
            splitChance: 1, hazardChance: 0.5, seed: 1,
        });
        const lanes = level.platforms.filter((p) => p.id.startsWith('lane'));
        expect(lanes.length).toBeGreaterThan(0);
        for (const lane of lanes) {
            expect(lane.type).toBe('oneway');
            // the lane hovers over a base-height merge floor with head
            // clearance (validateGeometry's structural bound)
            const below = level.platforms.find((p) => p.type === 'ground'
                && p.y === 0 && p.x <= lane.x && p.x + p.w >= lane.x + lane.w);
            expect(below, `merge floor under ${lane.id}`).toBeTruthy();
            expect(lane.y - (below.y + below.h)).toBeGreaterThan(DEFAULTS.PLAYER_H + 1.3);
        }
        // ramps rose above the base line
        expect(level.platforms.some((p) => p.type === 'ground' && p.y > 1)).toBe(true);
        expect(validateLevel(level, DEFAULTS)).toEqual([]);
    }, 60000);

    it('knob 0 (splits / jitter / ceilings) is draw-for-draw identical to the no-knob generator', () => {
        const base = {
            id: 'k0', requirement: ['spring'], pickupCount: 1, branchCount: 1,
            hazardChance: 0.5, shelfChance: 1, seed: 2,
        };
        const want = JSON.stringify(generateLevel(base));
        expect(JSON.stringify(generateLevel({ ...base, splitChance: 0 }))).toBe(want);
        expect(JSON.stringify(generateLevel({ ...base, jitter: 0 }))).toBe(want);
        expect(JSON.stringify(generateLevel({ ...base, ceilingChance: 0 }))).toBe(want);
    }, 120000);

    it('ceiling hazards (ceilingChance 1, margin 0): calibrated slabs over base-anchored flanks', () => {
        const level = generateLevel({
            id: 'ce', requirement: ['doubleJump'], pickupCount: 1,
            ceilingChance: 1, ceilingMargin: 0, hazardChance: 0.5, jitter: 1, seed: 1,
        });
        const G = CELESTE_GEOMETRY;
        const ceils = level.hazards.filter((hz) => hz.type === 'ceiling');
        expect(ceils.length).toBeGreaterThan(0);
        for (const hz of ceils) {
            // slab bottom inside the calibrated band, size from the windows
            expect(hz.y - 1).toBeGreaterThanOrEqual(G.CEIL_RISE.min);
            expect(hz.y - 1).toBeLessThanOrEqual(G.CEIL_RISE.min + G.CEIL_RISE.span + 0.01);
            expect(hz.h).toBe(G.CEIL_H);
            const gapW = hz.w - 2 * G.CEIL_OVER;
            expect(gapW).toBeGreaterThanOrEqual(G.CEIL_GAP.min - 0.01);
            expect(gapW).toBeLessThanOrEqual(G.CEIL_GAP.min + G.CEIL_GAP.span + 0.01);
            // flanking floors stay base-anchored despite jitter 1, and
            // carry no spike patches (the pass skips both flanks)
            const launch = level.platforms.find((p) => p.type === 'ground'
                && Math.abs(p.x + p.w - (hz.x + G.CEIL_OVER)) < 0.01);
            const landing = level.platforms.find((p) => p.type === 'ground'
                && Math.abs(p.x - (hz.x + hz.w - G.CEIL_OVER)) < 0.01);
            expect(launch, 'launch floor at the slab left lip').toBeTruthy();
            expect(landing, 'landing floor at the slab right lip').toBeTruthy();
            expect(launch.y).toBe(0);
            expect(landing.y).toBe(0);
            for (const flank of [launch, landing]) {
                expect(level.hazards.some((h2) => h2.type === 'spikes'
                    && h2.x >= flank.x && h2.x < flank.x + flank.w)).toBe(false);
            }
        }
        expect(validateLevel(level, DEFAULTS)).toEqual([]);
    }, 60000);

    it('default margin (1): generated slabs are grounded-tap crossable — no coyote needed', () => {
        const level = generateLevel({
            id: 'cem', requirement: [], pickupCount: 1, ceilingChance: 1, seed: 2,
        });
        const G = applyCeilingMargin(CELESTE_GEOMETRY, 1);
        const ceils = level.hazards.filter((hz) => hz.type === 'ceiling');
        expect(ceils.length).toBeGreaterThan(0);
        for (const hz of ceils) {
            const gapW = hz.w - 2 * CELESTE_GEOMETRY.CEIL_OVER;
            // gap within grounded-tap range, slab above the tap apex
            expect(gapW).toBeLessThanOrEqual(CELESTE_GEOMETRY.TAP.range - 0.29);
            expect(hz.y - 1).toBeGreaterThanOrEqual(CELESTE_GEOMETRY.TAP.top + 0.44);
            expect(hz.y - 1).toBeLessThanOrEqual(
                G.CEIL_RISE.min + G.CEIL_RISE.span + 0.01);
        }
        expect(validateLevel(level, DEFAULTS)).toEqual([]);
    }, 60000);

    it('a profile that refuses ceilings (CEIL_RISE null) plants none and draws nothing', () => {
        // fake measured clearance so high the punish window collapses
        const refused = deriveGeometry(DEFAULTS, {
            reaches: CELESTE_GEOMETRY.REACH, rises: CELESTE_GEOMETRY.RISE,
            ceils: { min: 2.8 },
        });
        expect(refused.CEIL_RISE).toBe(null);
        expect(validateGeometry(refused, DEFAULTS)).toEqual([]);
        const physics = { constants: DEFAULTS, geometry: refused };
        const on = generateLevel({ id: 'cr', requirement: [], ceilingChance: 1, seed: 3, physics });
        expect(on.hazards.some((hz) => hz.type === 'ceiling')).toBe(false);
        // refusal consumes NO rng: identical to the knob being off
        expect(JSON.stringify(on)).toBe(JSON.stringify(
            generateLevel({ id: 'cr', requirement: [], ceilingChance: 0, seed: 3, physics })));
        // ~50 s in isolation (deriveGeometry drives a ceiling sweep when the
        // punish window collapses); give the slow tier real headroom so it
        // does not flake at the old 60 s bound under battery contention.
    }, 180000);

    it('shelfChance 0 or no eligible gate ⇒ no shelf', () => {
        const none = generateLevel({
            id: 'sh0', requirement: ['spring'], pickupCount: 1, shelfChance: 0, seed: 1,
        });
        expect(none.platforms.some((p) => p.type === 'oneway')).toBe(false);
        // blue's stone gate has no descent corridor — never shelved
        const blue = generateLevel({
            id: 'shb', requirement: ['blue'], pickupCount: 1, shelfChance: 1, seed: 1,
        });
        expect(blue.platforms.some((p) => p.type === 'oneway')).toBe(false);
    }, 60000);

    it('generateZoneSet rejects counts below starter+feature+victory', () => {
        // the threshold tracks the ability vocabulary (featureCount + 1)
        expect(() => generateZoneSet({ count: 4 })).toThrow(/count must be >= \d+/);
    });
});

describe('dump-runner-level.js --rules output (the asserted CLI gate)', () => {
    const dump = (flags) => execSync(
        `node scripts/procgen/dump-runner-level.js ${flags}`,
        { cwd: process.cwd().replace(/frontend.*$/, ''), encoding: 'utf8' });

    it('stepStone fixture derives (blue) for stone pickup and exit', () => {
        const out = dump('--fixture stepStone --rules');
        expect(out).toContain('validateLevel: ok');
        expect(out).toContain('pickup pk_stone: (blue)');
        expect(out).toContain('exit exit_main: (blue)');
        expect(out).toContain('defects: none');
    });

    it('a generated plain strip derives ALWAYS everywhere', () => {
        const out = dump('--generate none --seed 1 --branches 0 --rules');
        expect(out).toContain('validateLevel: ok');
        expect(out).toContain('pickup loc_0: ALWAYS');
        expect(out).toContain('exit exit_main: ALWAYS');
        expect(out).toContain('defects: none');
    });
});
