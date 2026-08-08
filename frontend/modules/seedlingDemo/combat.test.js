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
    assertDamageFamilyCoveredWith,
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
    combatRowRequirement,
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
        // ⛓ R6 SLICE 6b: the exemplar was `Pod`, whose exclusion this slice
        // DELETED. `Tentacle` is the replacement and it is a real one — it is
        // in `HARMFUL_CLASSES`, its exclusion is `unplaced`, and the R6
        // deferral of `TentacleBeast` is what keeps it that way.
        const withoutTentacle = HARMFUL_CLASSES.filter((c) => c !== 'Tentacle');
        expect(assertDamageFamilyCovered(withoutTentacle))
            .toEqual([expect.stringContaining(
                'Tentacle is declared a damage-family exclusion')]);
    });

    /**
     * ⛔⛔ R6 SLICE 6b — TRAP 94, AND IT IS THE HALF THAT COULD NOT GO RED.
     *
     * `assertDamageFamilyCovered` tested `covered.has(cls)` BEFORE the
     * exclusions, so a class with a real row AND a stale exclusion passed
     * both loops in silence. Adding `PUZZLEMENT_HAZARDS.pod` while
     * `DAMAGE_FAMILY_EXCLUSIONS.Pod` still said `kind: 'unplaced'` (L112
     * places FOUR) would have made that falsehood permanently unprintable.
     *
     * The mutation is done the only way it can be — by asking the checker
     * about a class that IS in the tables — and the live table is asserted
     * clean beside it, so the fix and the state it enforces are one test.
     */
    it('⛔ a class in BOTH tables is a FINDING, not a silent pass (trap 94)', () => {
        // The live tables carry no such overlap...
        const overlap = Object.keys(DAMAGE_FAMILY_EXCLUSIONS).filter((c) => new Set([
            ...Object.values(ENEMY_CLASSES).map((r) => r.as3),
            ...Object.values(PUZZLEMENT_HAZARDS).map((r) => r.as3),
        ]).has(c));
        expect(overlap).toEqual([]);
        // ...and `Pod` is why: it has a row now, and no exclusion.
        expect(PUZZLEMENT_HAZARDS.pod.as3).toBe('Pod');
        expect(DAMAGE_FAMILY_EXCLUSIONS.Pod).toBeUndefined();
        // The check itself, exercised on the arm the shipped tables cannot
        // reach: a rowed class that also claims an exclusion.
        const findings = assertDamageFamilyCoveredWith(
            HARMFUL_CLASSES,
            { ...DAMAGE_FAMILY_EXCLUSIONS, Pod: { kind: 'unplaced', why: 'x'.repeat(50) } },
        );
        expect(findings).toEqual([expect.stringContaining(
            'Pod is BOTH a row (ENEMY_CLASSES/PUZZLEMENT_HAZARDS) and a '
            + 'DAMAGE_FAMILY_EXCLUSIONS entry')]);
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

    it('⛔ REFUSES a row with no ctor offset rather than defaulting to zero', () => {
        // THE DEFECT THE LIVE GAME CAUGHT. Slice 2 first shipped this census
        // taking an INJECTED placement table from `ENTITY_CLASSES` — which
        // only carries dx/dy for entries that answer the BLOCKING role.
        // Seventeen of the thirty-two combat tags are `notSolid`/`cheapOnly`
        // entries with none, so the lookup returned `{dx:0, dy:0}` and the
        // whole census stood eight pixels up and left of where the game puts
        // things. A missing offset must be a THROW.
        const rec = { level: 903, entities: [{ type: 'bob', x: 0, y: 0, attrs: {} }] };
        const stripped = { ...ENEMY_CLASSES.bob, ctor: undefined };
        expect(() => combatCensus({ ...rec, entities: [{ type: 'bob', x: 0, y: 0 }] },
            { placementOf: () => ({ dx: 99, dy: 99 }) }))
            .toThrow(/placement disagreement/);
        expect(stripped.ctor).toBeUndefined();
    });

    it('the ctor offsets follow the CONSTRUCTOR CHAIN, not just the class', () => {
        // The ladder's second transcription lesson: `Bulb`, `LavaRunner` and
        // `Flyer` all call `super(_x, _y)` and inherit Bob's `+ Tile/2`;
        // `DarkTrap` inherits SandTrap's. A table read off each class's own
        // `super(...)` line alone would put four classes at the origin.
        for (const tag of ['bulb', 'lavarunner', 'flyer', 'darktrap']) {
            expect(ENEMY_CLASSES[tag].ctor, tag).toMatchObject({ dx: 8, dy: 8 });
            expect(ENEMY_CLASSES[tag].ctor.src, tag).toMatch(/→|via/);
        }
        // ...and the ones that really are unusual.
        expect(ENEMY_CLASSES.iceturret.ctor).toMatchObject({ dx: 16, dy: 16 });
        expect(ENEMY_CLASSES.shieldboss.ctor).toMatchObject({ dx: 24, dy: 32 });
        expect(ENEMY_CLASSES.bosstotem.ctor).toMatchObject({ dx: 0, dy: 0 });
        expect(PUZZLEMENT_HAZARDS.arrowtrap.ctor).toMatchObject({ dx: 8, dy: 2.5 });
    });

    it('AGREES with levelWorld wherever both answer the same question', () => {
        // The cross-check that keeps the two transcriptions from drifting: a
        // `rect` collider's dx/dy IS the entity's constructed position, so
        // where `ENTITY_CLASSES` declares one it must equal the combat row's.
        // A `pixelmask` entry's dx/dy is the MASK's top-left and answers a
        // different question — `tentaclebeast` is 1/2 there and +24/+24 here
        // — which is why `combatPlacementOf` returns null for those.
        let checked = 0;
        for (const [tag, row] of Object.entries(
            { ...ENEMY_CLASSES, ...PUZZLEMENT_HAZARDS })) {
            const p = combatPlacementOf(tag);
            if (!p) continue;
            checked += 1;
            expect({ tag, ...p }).toEqual({ tag, dx: row.ctor.dx, dy: row.ctor.dy });
        }
        // Positive count before the zero: the agreement must be over a real
        // set, not over an empty one.
        expect(checked).toBeGreaterThanOrEqual(9);
        expect(combatPlacementOf('tentaclebeast')).toBeNull();
        expect(ENEMY_CLASSES.tentaclebeast.ctor.dx).toBe(24);
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
    it('⛓⛓⛓ builds ALL 116 levels — R6 slice 6b paid the last holdout', () => {
        // Was "115 of 116, and names the holdout": L112's `pod` was unpriced
        // BY RULING. The row is paid (`PUZZLEMENT_HAZARDS.pod`, timing
        // `boss-script`) and the Owl's own hazard is classified `entry`, so
        // the combat census refuses NOTHING.
        //
        // ⚠ The empty list is asserted, not the count alone: "0 failed" and
        // "the loop never ran" print the same, so the roster size is checked
        // beside it.
        const failed = [];
        let built = 0;
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            try {
                buildLevelWorld(source(level), { roles: ROLES }); built += 1;
            } catch { failed.push(level); }
        }
        expect(failed).toEqual([]);
        expect(built).toBe(LEVEL_COUNT);
        expect(LEVEL_COUNT).toBe(116);
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

    /**
     * ⛔⛔ R6 SLICE 6b — THE NON-VACUITY MOVED DOWN A STRATUM, BECAUSE PAYING
     * THE POD BILL DELETED ITS ONLY WITNESS.
     *
     * This test used to isolate `roles: ['combat']` on L112 and assert the
     * refusal named `"pod" (Pod)`. With the row paid, **no level and no
     * `ENTITY_CLASSES` tag can reach that throw**: every tag in
     * `LOOKS_LIKE_COMBAT` has a row and every dangerous `as3` in the extract
     * does too. The branch is not dead code — a later rung will place
     * something new — so the check is asserted against the exported
     * predicate `combatRowRequirement`, which the builder itself calls (one
     * implementation, two callers).
     */
    it('⛔ the combat requirement is REACHABLE and NAMED — on the predicate', () => {
        // The two positive arms, with real class names the extract does not
        // place under those tags.
        expect(combatRowRequirement('nosuchtag', 'Squishle'))
            .toMatch(/Squishle reaches the player or is summed by totalEnemies\(\)/);
        expect(combatRowRequirement('nosuchtag', 'Tentacle'))
            .toMatch(/reaches the player or is summed/);
        // ...and the vocabulary arm, which fires on the TAG even when the
        // class means nothing to the census.
        expect(LOOKS_LIKE_COMBAT.has('pod')).toBe(true);
        expect(combatRowRequirement('pod', null)).toBeNull();      // paid
        expect(combatRowRequirement('bulb', 'NotAClass')).toBeNull(); // rowed
        // The negative: an ordinary scenery tag needs nothing.
        expect(combatRowRequirement('torch', 'Torch')).toBeNull();
        // And the state change that removed the integration witness: every
        // placed tag in the whole extract is priced.
        const unpriced = new Set();
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            for (const e of source(level).entities ?? []) {
                const why = combatRowRequirement(e.type, ENTITY_CLASSES[e.type]?.as3 ?? null);
                if (why) unpriced.add(e.type);
            }
        }
        expect([...unpriced]).toEqual([]);
        // 116 of 116 on the combat role ALONE, not just under the full set.
        let built = 0;
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            try { buildLevelWorld(source(level), { roles: ['combat'] }); built += 1; } catch { /* none */ }
        }
        expect(built).toBe(116);
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
        // ⛓⛓ R6 SLICE 6b: was `['pod/Pod']`. EMPTY now — every placed tag the
        // call-site census calls dangerous carries a row. The list stays
        // asserted so the next tag the extract gains lands here as a red.
        expect([...unpriced]).toEqual([]);
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
