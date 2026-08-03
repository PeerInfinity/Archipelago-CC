/**
 * combat.js — the two damage families, and the third one the CALL SITES
 * found.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 2.
 *
 * ⚠⚠ WHAT THIS SUITE IS FOR, AND WHY IT IS NOT A MUTATION TABLE OVER
 * `combat.js`. R4 §14's lesson, and the standing law: a mutation table is
 * NOT an independent stratum when fixture and check share a derivation.
 * `ENEMY_CLASSES` and `PUZZLEMENT_HAZARDS` were written by reading the
 * classes a human already believed were dangerous, so thirty-two mutations
 * over them would agree with anything they BOTH forgot. Every claim below is
 * therefore phrased from one of three sources that are not those tables:
 *
 *   1. `seedlingDamageSites.js`  — the game's own call sites, extracted by a
 *                                  script with no notion of "enemy".
 *   2. the committed EXTRACT     — where things actually stand on the map.
 *   3. hand-derived AS3 numbers  — transcribed here from the source, in the
 *                                  `playerPhysicsV*.test.js` tradition.
 */

import { describe, expect, it } from 'vitest';

import {
    DAMAGE_FAMILY_EXCLUSIONS,
    ENEMY_CLASSES,
    ENEMY_IFRAMES,
    KILL_CADENCE_FLOOR,
    KILL_LOCK_TAGS,
    KILL_LOCK_TSET,
    LOOKS_LIKE_COMBAT,
    PUZZLEMENT_HAZARDS,
    TOTAL_ENEMIES_CLASSES,
    TOTAL_ENEMIES_OMISSIONS,
    aggroDisc,
    assertDamageFamilyCovered,
    assertNoUnclearableKillLock,
    assertTotalEnemiesTable,
    clearabilityOf,
    combatCensus,
    isCounted,
    killLocksIn,
    pressesFor,
    stepBoundFor,
} from './combat.js';
import { DAMAGE_SITES, HARMFUL_CLASSES, DISPLACING_CLASSES } from './seedlingDamageSites.js';
import {
    ENTITY_CLASSES, ROLES, buildLevelWorld, combatCensusOf, combatPlacementOf,
} from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';

const source = atlasLevelSource();
const LEVEL_COUNT = 116;
const census = (level) => combatCensus(source(level), { placementOf: combatPlacementOf });

describe('the damage family, checked against the CALL SITES', () => {
    // ── 1. the independent stratum agrees with the tables ─────────────
    it('covers every class the call-site census finds reaching the player', () => {
        expect(assertDamageFamilyCovered(HARMFUL_CLASSES)).toEqual([]);
    });

    it('goes RED when a damaging class loses its row', () => {
        // The mutation is on the CHECK's input, not on the table: this asks
        // "would the assertion notice a class the table forgot", which is
        // the question a table-mutation cannot ask of itself.
        expect(assertDamageFamilyCovered([...HARMFUL_CLASSES, 'NewHazard']))
            .toEqual([expect.stringContaining('NewHazard reaches the player')]);
    });

    it('goes RED when an exclusion is stale — the checkout moved under it', () => {
        const withoutPod = HARMFUL_CLASSES.filter((c) => c !== 'Pod');
        expect(assertDamageFamilyCovered(withoutPod))
            .toEqual([expect.stringContaining('Pod is declared a damage-family exclusion')]);
    });

    it('names every exclusion with a kind and a reason, never a bare skip', () => {
        for (const [cls, row] of Object.entries(DAMAGE_FAMILY_EXCLUSIONS)) {
            expect(['base', 'projectile', 'unplaced'], cls).toContain(row.kind);
            expect(row.why.length, cls).toBeGreaterThan(40);
            if (row.kind === 'projectile') expect(row.of, cls).toBeTruthy();
        }
    });

    // ── 2. the third family, and why R5 has no gameplay RNG ───────────
    it('⛔ RockFall is the one gameplay-RNG damage volume, and it is UNPLACED', () => {
        // The finding slice 2 paid for. `RockFall` (not `FallRock`) sizes its
        // own hitbox from a draw — `sprRockFall.scale = Math.random()/2 +
        // 0.25` at RockFall.as:33, `setHitbox(32*scale, 16*scale)` at :37 —
        // so its damage rect is 8x4..24x12 by RNG, and `Game.shake += scale
        // + 1` on landing moves the camera by a draw too. §2.1's "no gameplay
        // RNG in R5's scope" survives only because nothing places one.
        expect(HARMFUL_CLASSES).toContain('RockFall');
        expect(DAMAGE_FAMILY_EXCLUSIONS.RockFall.kind).toBe('unplaced');
        // Asserted from the EXTRACT, not from the table: no level constructs
        // a RockFall, because no `.oel` tag maps to one.
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            for (const e of source(level).entities ?? []) {
                expect(e.type, `L${level}`).not.toBe('rockfall');
            }
        }
    });

    it('separates the harmful classes from the ones that only DISPLACE', () => {
        // `FallRock`/`FallRockLarge` write the player's y to push them out
        // from under, and never call `hit` — which is why R4 could price them
        // as volumes and be right.
        expect(DISPLACING_CLASSES).toContain('FallRock');
        expect(DISPLACING_CLASSES).toContain('FallRockLarge');
        expect(HARMFUL_CLASSES).not.toContain('FallRock');
        // And `LavaTrap` is on the other side of that line: it never calls
        // `hit` either — it calls `die()`.
        expect(DAMAGE_SITES.LavaTrap.some((s) => s.kind === 'die')).toBe(true);
        expect(DAMAGE_SITES.Whirlpool.some((s) => s.kind === 'drown')).toBe(true);
    });
});

describe('the arithmetic a kill costs', () => {
    it('halves the bill at the darksword, rounding UP', () => {
        // `Player.swordDamage = hasDarkSword ? 2 : 1`, and the test is
        // `hits >= hitsMax` — so 3 hits is 2 presses with the dark sword,
        // never 1.5.
        expect(pressesFor(ENEMY_CLASSES.bob)).toBe(3);
        expect(pressesFor(ENEMY_CLASSES.bob, { hasDarkSword: true })).toBe(2);
        expect(pressesFor(ENEMY_CLASSES.lavarunner)).toBe(2);
        expect(pressesFor(ENEMY_CLASSES.lavarunner, { hasDarkSword: true })).toBe(1);
        expect(pressesFor(ENEMY_CLASSES.bulb)).toBe(1);
    });

    it('returns null for the unkillable set rather than 0 presses', () => {
        // 0 would read as "already dead"; the four are `Grenade`, `DarkTrap`,
        // `BombPusher` (empty `hit()`) and `IceTrap` (`canHit = false`).
        for (const tag of ['grenade', 'darktrap', 'bombpusher', 'icetrap']) {
            expect(pressesFor(ENEMY_CLASSES[tag]), tag).toBeNull();
        }
    });

    it('the cadence floor is the DASH rule, not the i-frame window', () => {
        // Two presses inside `slashTimer` (20) is a `knockback(2, …)` that
        // MOVES the player, so 21 is the floor — and it is deliberately not
        // 30, the enemy's own i-frames.
        expect(KILL_CADENCE_FLOOR).toBe(21);
        expect(ENEMY_IFRAMES).toBe(30);
        expect(KILL_CADENCE_FLOOR).toBeLessThan(ENEMY_IFRAMES);
    });

    it('bounds a chaser by its own moveSpeed, and REFUSES to bound a boss', () => {
        // Hand-derived from the AS3: Bob.as:19 `moveSpeed = 0.5`,
        // LavaRunner.as:18 `normalSpeed = 1.5`, Jellyfish.as:17 `0.8`,
        // Bulb.as:29 `0.65`, WallFlyer.as:19 `4`.
        expect(stepBoundFor('bob')).toBe(0.5);
        expect(stepBoundFor('lavarunner')).toBe(1.5);
        expect(stepBoundFor('jellyfish')).toBe(0.8);
        expect(stepBoundFor('bulb')).toBe(0.65);
        expect(stepBoundFor('wallflyer')).toBe(4);
        expect(stepBoundFor('sandtrap')).toBe(0);
        // ⛔ Both of these would be 0 under a naive reading, and 0 is the
        // worst possible answer: it reads as "static" and would let an
        // envelope declare a boss arena contact-free.
        expect(stepBoundFor('shieldboss')).toBeNull();
        expect(stepBoundFor('bosstotem')).toBeNull();
        expect(stepBoundFor('no-such-tag')).toBeNull();
    });
});

describe('what `totalEnemies()` sums, and what it does NOT', () => {
    it('partitions the Enemies/ directory it was transcribed from', () => {
        // The class list is derived from the two tables' own `as3` fields
        // plus the omissions — the directory listing itself lives in the
        // recon (`--kill-locks`), which is where the fork checkout is.
        const enemyDirClasses = [
            ...new Set(Object.values(ENEMY_CLASSES)
                .filter((r) => r.src.startsWith('Enemies/'))
                .map((r) => r.as3)),
            ...Object.keys(TOTAL_ENEMIES_OMISSIONS),
        ];
        expect(assertTotalEnemiesTable(enemyDirClasses)).toEqual([]);
    });

    it('reports a class that is in neither list', () => {
        // The full directory plus one unclassified newcomer, so the only
        // finding is the newcomer — a two-element directory would also report
        // every omission as missing, which is a different (also correct)
        // finding and would hide this one.
        const dir = [
            ...new Set(Object.values(ENEMY_CLASSES)
                .filter((r) => r.src.startsWith('Enemies/')).map((r) => r.as3)),
            ...Object.keys(TOTAL_ENEMIES_OMISSIONS),
        ];
        expect(assertTotalEnemiesTable([...dir, 'Newcomer']))
            .toEqual([expect.stringContaining('Newcomer is in NEITHER')]);
    });

    it('the four uncounted placed classes are what make two locks satisfiable', () => {
        // L53's lock shares its room with an `icetrap`; L78's with three
        // `lavatrap`s. Neither is summed, which is the only reason either
        // lock can ever open.
        expect(isCounted('icetrap')).toBe(false);
        expect(isCounted('lavatrap')).toBe(false);
        expect(isCounted('bombpusher')).toBe(false);
        expect(isCounted('darktrap')).toBe(true);
        expect(TOTAL_ENEMIES_CLASSES).toContain('DarkTrap');
    });
});

describe('the census over the committed extract', () => {
    it('finds the ten kill locks, at the ten levels §2.5 named', () => {
        const found = [];
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            for (const lock of killLocksIn(source(level), { placementOf: combatPlacementOf })) {
                found.push(`${level}:${lock.tag}@${lock.x},${lock.y}`);
            }
        }
        expect(found).toEqual([
            '5:lock@48,112', '18:lock@144,112', '26:rocklock@112,208',
            '39:wandlock@144,592', '53:lock@144,208', '60:lock@128,80',
            '71:lock@112,192', '78:lock@32,32', '98:lock@112,112', '99:lock@80,96',
        ]);
    });

    it('⚠ a missing `tset` is group 0, never −1 — the R2 lesson, still armed', () => {
        const rec = {
            level: 900,
            entities: [{ type: 'lock', x: 0, y: 0, attrs: { tag: '3' } }],
        };
        expect(killLocksIn(rec, { placementOf: combatPlacementOf })).toEqual([]);
        expect(KILL_LOCK_TSET).toBe(-1);
    });

    it('only the four lock classes that inherit `Lock.update`\'s kill arm count', () => {
        // `ShieldLock` does not call `super.update()`; `BossLock` and
        // `MagicalLock` never had the arm. A `tset="-1"` on one of those is
        // not a kill lock, and `BossLock`'s ctor FORCES −1.
        expect(KILL_LOCK_TAGS).toEqual(['lock', 'wandlock', 'rocklock', 'grasslock']);
        const rec = {
            level: 901,
            entities: [{ type: 'bosslock', x: 0, y: 0, attrs: { tset: '-1' } }],
        };
        expect(killLocksIn(rec, { placementOf: combatPlacementOf })).toEqual([]);
    });

    it('no kill lock shares a level with a counted-but-unclearable instance', () => {
        // The assertion that makes the list mean anything: `DarkTrap` is
        // counted AND has `hit()` overridden empty, so one in a kill-lock
        // room seals it forever. Seven are placed; none is.
        const findings = [];
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            findings.push(...assertNoUnclearableKillLock(source(level),
                { placementOf: combatPlacementOf }));
        }
        expect(findings).toEqual([]);
    });

    it('...and would SAY SO if one did', () => {
        const rec = {
            level: 902,
            entities: [
                { type: 'lock', x: 0, y: 0, attrs: { tset: '-1', tag: '1' } },
                { type: 'darktrap', x: 32, y: 32, attrs: {} },
            ],
        };
        expect(assertNoUnclearableKillLock(rec, { placementOf: combatPlacementOf }))
            .toEqual([expect.stringContaining('COUNTED and has no clearing arm')]);
    });

    it('prices an instance from its CONSTRUCTED position, not the .oel one', () => {
        // `IceTurret`'s ctor is `super(_x + Tile.w, _y + Tile.h)`. L98's
        // `iceturret@104,24` therefore stands at (120,40) = tile (7,2), whose
        // type is water — which is why its corpse destroys itself where it
        // stands and the `push-corpse` verb is not needed for that lock.
        const l98 = census(98).enemies.find((e) => e.tag === 'iceturret');
        expect({ x: l98.x, y: l98.y }).toEqual({ x: 104, y: 24 });
        expect({ cx: l98.cx, cy: l98.cy }).toEqual({ cx: 120, cy: 40 });
    });

    it('refuses to run without a placement table rather than guessing', () => {
        expect(() => combatCensus(source(98), {}))
            .toThrow(/needs a placementOf/);
    });

    it('the aggro disc is centre-to-centre, with both half-boxes in the margin', () => {
        const d = aggroDisc('jellyfish', 100, 100);
        expect(d).toEqual({ x: 100, y: 100, r: 168, kind: 'chase', tag: 'jellyfish' });
        // A class whose reach is not a number is an ENCOUNTER, not a disc.
        expect(aggroDisc('shieldboss', 0, 0)).toBeNull();
        expect(aggroDisc('wallflyer', 0, 0)).toBeNull();
    });

    it('reports the terrain arms that clear an enemy for no sword press', () => {
        const bob = { row: ENEMY_CLASSES.bob };
        expect(clearabilityOf(bob, { rawTileType: 1 }).ways.map((w) => w.how))
            .toEqual(['kill', 'stands-on-water']);
        // ⚠ The jellyfish is the one class with NO free arm: it survives
        // water and lava and refuses to fall in a pit.
        const jelly = { row: ENEMY_CLASSES.jellyfish };
        for (const t of [1, 6, 17]) {
            expect(clearabilityOf(jelly, { rawTileType: t }).ways.map((w) => w.how))
                .toEqual(['kill']);
        }
        // ...and the lavarunner survives lava only.
        const runner = { row: ENEMY_CLASSES.lavarunner };
        expect(clearabilityOf(runner, { rawTileType: 17 }).ways.map((w) => w.how))
            .toEqual(['kill']);
        expect(clearabilityOf(runner, { rawTileType: 1 }).ways.map((w) => w.how))
            .toEqual(['kill', 'stands-on-water']);
    });
});

describe('the `combat` ROLE — the builder throws, or the route is blind', () => {
    it('builds 115 of the 116 levels, and names the holdout', () => {
        // The same holdout as the blocking census, and for the same reason:
        // L112's `pod` is unpriced BY RULING (R6 owns it), not by neglect.
        const failed = [];
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            try { buildLevelWorld(source(level), { roles: ROLES }); } catch { failed.push(level); }
        }
        expect(failed).toEqual([112]);
    });

    it('⛔ IS NOT VACUOUS: a placed tag with no combat row STOPS THE BUILD', () => {
        // The whole role is this throw. `squishle` is a real `Enemies/` class
        // that `totalEnemies()` sums and that nothing on the map places — so
        // it is the honest way to ask the question without inventing a tag
        // the extract could never hold.
        const rec = {
            ...source(0),
            entities: [...(source(0).entities ?? []), { type: 'squishle', x: 48, y: 48, attrs: {} }],
        };
        // It has no ENTITY_CLASSES entry either, so the FOUR-role census
        // catches it first — which is itself the point: the two censuses
        // agree about what is unpriced.
        expect(() => buildLevelWorld(rec, { roles: ROLES }))
            .toThrow(/not in the transcribed class table|need a COMBAT row/);
    });

    it('⛔ ...and the throw comes from the COMBAT block, not another role\'s', () => {
        // The load-bearing non-vacuity check, and it needs the role ISOLATED.
        // With all five consulted, L112 dies in the proximity-hazard block
        // first (`pod` snaps the player's position), so a five-role throw
        // proves nothing about combat. Asked alone, the combat block is what
        // refuses — by NAME, with the reason derived from the call sites
        // rather than from its own table: `Pod` reaches the player.
        expect(LOOKS_LIKE_COMBAT.has('pod')).toBe(false);
        expect(() => buildLevelWorld(source(112), { roles: ['combat'] }))
            .toThrow(/need a COMBAT row and have none.*"pod" \(Pod\).*reaches the player/s);
        // And it is the ONLY level that does: 115 of 116 build on the combat
        // role alone, the same holdout the blocking census has.
        let built = 0;
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            try { buildLevelWorld(source(level), { roles: ['combat'] }); built += 1; } catch { /* the holdout */ }
        }
        expect(built).toBe(115);
    });

    it('the requirement is sourced from the CALL SITES, not from combat.js', () => {
        // The §14 discipline made checkable: what makes a tag need a row is
        // `HARMFUL_CLASSES ∪ totalEnemies()`, and every placed tag that
        // matches has a row. Phrased over the extract, so a class that
        // stopped being dangerous — or started — moves this test.
        const need = new Set([...HARMFUL_CLASSES, ...TOTAL_ENEMIES_CLASSES]);
        const priced = new Set([
            ...Object.values(ENEMY_CLASSES).map((r) => r.as3),
            ...Object.values(PUZZLEMENT_HAZARDS).map((r) => r.as3),
        ]);
        const unpriced = new Set();
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            for (const e of source(level).entities ?? []) {
                const row = ENEMY_CLASSES[e.type] ?? PUZZLEMENT_HAZARDS[e.type];
                if (row) continue;
                const as3 = ENTITY_CLASSES[e.type]?.as3 ?? null;
                if (as3 && need.has(as3) && !priced.has(as3)) unpriced.add(`${e.type}/${as3}`);
            }
        }
        expect([...unpriced]).toEqual(['pod/Pod']);
    });

    it('reports NULL, not an empty census, when the role was not consulted', () => {
        // An empty list would read as "nothing here can hurt you", which is
        // the most dangerous thing this module could say untruthfully.
        expect(buildLevelWorld(source(40)).combat).toBeNull();
        expect(buildLevelWorld(source(40), { roles: ROLES }).combat).not.toBeNull();
    });

    it('answers PER INSTANCE with counts — "L40 has enemies" is not a claim', () => {
        const c = buildLevelWorld(source(40), { roles: ROLES }).combat;
        // §2.6.4: "L40 (60x58, 21 counted enemies)". Derived here from the
        // extract, and it agrees with a recon that never ran this code.
        expect(c.bill.length).toBe(21);
        expect(c.counts).toEqual({
            iceturret: 1, bob: 12, bombpusher: 1, spinner: 5, bobsoldier: 1,
            puncher: 2, pulser: 1,
        });
        // The bombpusher is placed and NOT counted — which is the only
        // reason L40 is not permanently sealed.
        expect(c.enemies.filter((e) => e.tag === 'bombpusher')[0].counted).toBe(false);
        for (const e of c.enemies) {
            expect(Number.isFinite(e.cx) && Number.isFinite(e.cy), e.tag).toBe(true);
        }
    });

    it('surfaces the phase-uncertain instances, which are exactly two classes', () => {
        let beam = 0;
        let chain = 0;
        let other = 0;
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            let world;
            try { world = buildLevelWorld(source(level), { roles: ROLES }); } catch { continue; }
            for (const h of world.combat.phaseUncertain) {
                if (h.tag === 'beamtower') beam += 1;
                else if (h.tag === 'lavachain') chain += 1;
                else other += 1;
            }
        }
        // §2.4's counts, and §8.4's correction: `ArrowTrap`'s `worldFrame`
        // call is inside `render()` and picks a sprite frame, so the family
        // is exactly two.
        expect({ beam, chain, other }).toEqual({ beam: 10, chain: 16, other: 0 });
        expect(Object.entries(PUZZLEMENT_HAZARDS)
            .filter(([, r]) => r.timing === 'worldFrame').map(([t]) => t))
            .toEqual(['beamtower', 'lavachain']);
    });

    it('⛔ Crusher is damage 1000 — never a graze, always a die()', () => {
        expect(PUZZLEMENT_HAZARDS.crusher.damage).toBe(1000);
        // ...and the arrow is damage 1, not the 5 that is its SPEED.
        expect(PUZZLEMENT_HAZARDS.arrowtrap.damage).toBe(1);
    });

    it('the standalone census and the world\'s agree, because there is one', () => {
        const viaWorld = buildLevelWorld(source(78), { roles: ROLES }).combat;
        const direct = combatCensusOf(source(78));
        expect(direct.counts).toEqual(viaWorld.counts);
        expect(direct.killLocks.map((l) => `${l.tag}@${l.x},${l.y}`))
            .toEqual(['lock@32,32']);
    });
});
