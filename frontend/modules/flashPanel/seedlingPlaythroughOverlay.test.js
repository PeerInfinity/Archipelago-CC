/**
 * The honest-playthrough overlay — R7 slice 4's G1 stratum.
 *
 * Two things are asserted here that no other test in the tree can:
 *
 *   1. THE TWO LAWS (§12.9 item 3) as TESTS. A grouped `Lock`'s persistence
 *      write is inert, so a grouped lock must never produce a rules row that
 *      depends on it; a `ButtonRoom` re-publishes at `check()`, so a
 *      room-latched opening is permanent. A row that broke either would be an
 *      invisible defect in a generated artifact nobody reads by hand.
 *   2. THAT THE OVERLAY ONLY EVER SPEAKS WHERE THE TRANSCRIPTION REFUSED.
 *      `seedlingSemantics` is the transcription and this is opinion; opinion
 *      that overwrote a transcribed rule would be a silent fork of the source.
 *
 * Every count is derived from a table, never typed.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ENTITY_SEMANTICS, conditionKey } from './seedlingSemantics.js';
import {
    A_WEAPON,
    L40_EAST_RULE,
    NEVER_ENTER_CITE,
    NEVER_ENTER_LEVELS,
    OVERRULES_TRANSCRIPTION,
    PIXEL_MASK_TAGS,
    PLAYTHROUGH_ENTITY_OVERLAY,
    REFUTATION_FIELDS,
    REFUTATION_LOG,
    WANDLOCK_IS_A_LOCK,
    CHARGED_DOORS,
    COMPLETION,
    IGNEOUS_IS_FREE,
    LAVATRAP_PULL,
    LOCATION_GUARDS,
    PLAYTHROUGH_TILE_OVERLAY,
    isRefutation,
    lavaTrapPulls,
    locationGuard,
    overlayEntitySemantics,
    overlayTileSemantics,
    resolveOverlayCondition,
} from './seedlingPlaythroughOverlay.js';

const lock = (tag, tset, persistTag = '3') => ({
    type: tag, x: 0, y: 0, attrs: { tset: String(tset), tag: persistTag },
});
const base = (tag) => ENTITY_SEMANTICS[tag] ?? null;

describe('the overlay speaks only where the transcription refused', () => {
    it('every overlay row fills a `manual` refusal — except the ONE on the allowlist', () => {
        for (const tag of Object.keys(PLAYTHROUGH_ENTITY_OVERLAY)) {
            const b = base(tag);
            expect(b, `"${tag}" is not an entity the transcription knows`).toBeTruthy();
            if (OVERRULES_TRANSCRIPTION[tag]) continue;
            expect(b.kind, `"${tag}" already has a transcribed ruling and is not on the `
                + 'allowlist — overruling the transcription must be enumerated, never silent')
                .toBe('manual');
        }
    });

    it('...and the allowlist is exactly the rows that DO overrule, both ways', () => {
        // Derived, never typed. A row added to the allowlist that does not
        // actually overrule anything is as wrong as one that overrules
        // silently, so the two sets are compared in both directions.
        const actual = Object.keys(PLAYTHROUGH_ENTITY_OVERLAY)
            .filter((tag) => base(tag)?.kind !== 'manual').sort();
        expect(actual).toEqual(Object.keys(OVERRULES_TRANSCRIPTION).sort());
        for (const [tag, why] of Object.entries(OVERRULES_TRANSCRIPTION)) {
            expect(typeof why, `"${tag}" overrules the transcription with no reason`).toBe('string');
            expect(why.length).toBeGreaterThan(20);
        }
    });

    it('⛓ Karlore is a DOOR, and the row that says so cites the line', () => {
        // `NPCs/Karlore.as:added()` -> `if (Player.hasFire) FP.world.remove(this)`.
        // One overlay row; twenty-five AP regions.
        const row = PLAYTHROUGH_ENTITY_OVERLAY.karlore;
        expect(row.kind).toBe('gated');
        expect(conditionKey(row.condition)).toBe('flag:hasFire');
        expect(row.cite).toMatch(/Karlore\.as/);
        expect(row.why).toMatch(/bounded sweep/i);
        // The transcription still calls every OTHER NPC an unconditional wall,
        // and that is correct — the bounded sweep found no second one.
        for (const npc of ['witch', 'hermit', 'oracle', 'sensei', 'yeti', 'totem', 'rekcahdam']) {
            expect(base(npc).kind).toBe('wall');
            expect(PLAYTHROUGH_ENTITY_OVERLAY[npc]).toBeUndefined();
        }
    });

    it('every overlay row carries its source citation and its reading', () => {
        for (const [tag, row] of Object.entries(PLAYTHROUGH_ENTITY_OVERLAY)) {
            expect(typeof row.cite, `"${tag}" has no cite`).toBe('string');
            expect(row.cite.length, `"${tag}"'s cite is empty`).toBeGreaterThan(0);
            expect(typeof row.why, `"${tag}" has no reading`).toBe('string');
            expect(['open', 'wall', 'gated']).toContain(row.kind);
            if (row.kind === 'gated') expect(row.condition).toBeTruthy();
        }
    });

    it('the pixel-mask families are DECLARED rather than ruled — they go to the model', () => {
        for (const tag of PIXEL_MASK_TAGS) {
            expect(base(tag), `"${tag}" is not on the map`).toBeTruthy();
            // The transcription either refuses outright (`manual`, the
            // buildings) or approximates with the sprite rect (`wall` —
            // `opentree`, `snowhill`). Both are answers the MASK improves on,
            // and neither is something this module may overrule from a table.
            expect(['manual', 'wall'], `"${tag}"`).toContain(base(tag).kind);
            // ...and the overlay deliberately does NOT rule on them.
            expect(PLAYTHROUGH_ENTITY_OVERLAY[tag]).toBeUndefined();
        }
    });

    it('leaves an entity it has no opinion about exactly as it found it', () => {
        expect(overlayEntitySemantics({ type: 'burnabletree', attrs: {} }, base('burnabletree')))
            .toBeNull();
        expect(overlayEntitySemantics({ type: 'tree', attrs: {} }, base('tree'))).toBeNull();
    });
});

describe('⛔ LAW 1 — a kill-lock is a weapon gate, and it is DURABLE', () => {
    // `Lock.checkEnemies()`: `if (tSet == -1 && totalEnemies() == 0) activate = true`.
    // `Lock.check()`: removed when `tag >= 0 && tSet < 0 && !checkPersistence(tag)`.
    it.each(['lock', 'wandlock', 'grasslock'])('%s with tSet -1 gates on a weapon', (tag) => {
        const ruled = overlayEntitySemantics(lock(tag, -1), base(tag));
        expect(ruled.kind).toBe('gated');
        expect(conditionKey(ruled.condition)).toBe(conditionKey(A_WEAPON));
        expect(ruled.why).toMatch(/DURABLE/);
    });
});

describe('⛔ LAW 2 — a GROUPED lock never becomes a rules row', () => {
    // Its `turnOff()` writes persistence and its `check()` reads persistence
    // only while `tSet < 0`, so the write is INERT: a row that treated a
    // grouped lock as a durable opening would claim a door stays open across a
    // visit when the game rebuilds it shut.
    it.each([0, 1, 2, 5])('a lock in group %i is choreography, not a gate', (tset) => {
        const ruled = overlayEntitySemantics(lock('lock', tset), base('lock'));
        expect(ruled.kind).toBe('open');
        expect(ruled.condition).toBeUndefined();
        expect(ruled.why).toMatch(/INERT/);
    });

    it('...and the ruling is stated in terms of the group, not the tag', () => {
        const a = overlayEntitySemantics(lock('lock', 2, '9'), base('lock'));
        const b = overlayEntitySemantics(lock('lock', 2, '10'), base('lock'));
        expect(a.kind).toBe(b.kind);
    });
});

describe('⛔ THE BRIEF WAS WRONG ABOUT WandLock, and the test says so', () => {
    // The slice-4 brief asked for `wandlock -> wand SHOT`. `WandLock.as` extends
    // `Lock` and overrides only the sprite, and `WandShot.checkEntity` handles
    // `Enemy` and `MagicalLock` and nothing else. A future edit that "restores"
    // the wand requirement has to delete this test first.
    it('a wandlock is ruled exactly as a lock of the same group', () => {
        for (const tset of [-1, 0, 3]) {
            expect(overlayEntitySemantics(lock('wandlock', tset), base('wandlock')).kind)
                .toBe(overlayEntitySemantics(lock('lock', tset), base('lock')).kind);
        }
    });

    it('and no overlay row anywhere gates on the wand for a LOCK', () => {
        const wandish = Object.entries(PLAYTHROUGH_ENTITY_OVERLAY)
            .filter(([, r]) => JSON.stringify(r.condition ?? null).includes('Wand'));
        expect(wandish).toEqual([]);
        expect(WANDLOCK_IS_A_LOCK.cite).toMatch(/WandShot/);
    });

    it('the wand still belongs to the MAGICAL lock, which the transcription owns', () => {
        expect(base('magicallock').kind).toBe('gated');
        expect(conditionKey(base('magicallock').condition)).toMatch(/hasWand/);
        expect(PLAYTHROUGH_ENTITY_OVERLAY.magicallock).toBeUndefined();
    });
});

describe('the trap rooms, and the L40 ruling', () => {
    it('every never-enter level carries the citation that makes it one', () => {
        expect(NEVER_ENTER_LEVELS.length).toBeGreaterThan(0);
        for (const level of NEVER_ENTER_LEVELS) {
            expect(typeof NEVER_ENTER_CITE[level], `L${level} has no citation`).toBe('string');
        }
        // Derived, never typed: the citation table and the level list agree.
        expect(Object.keys(NEVER_ENTER_CITE).map(Number).sort((a, b) => a - b))
            .toEqual([...NEVER_ENTER_LEVELS].sort((a, b) => a - b));
    });

    it('L40\'s hand ruling is STRICTLY STRONGER than the general rule', () => {
        // The general rule for the east half's door (a grouped wandlock) is
        // `open`. The ruling adds fire AND a weapon — so it can only ever
        // remove reachability, never add it, which is the only shape a hand
        // ruling is allowed to take here.
        const general = overlayEntitySemantics(lock('wandlock', 2, '10'), base('wandlock'));
        expect(general.kind).toBe('open');
        expect(L40_EAST_RULE.condition.all).toBeTruthy();
        expect(L40_EAST_RULE.condition.all.length).toBe(2);
        expect(L40_EAST_RULE.cite).toMatch(/probe-seedling-r7-l40-holder/);
        expect(L40_EAST_RULE.tile).toEqual([32, 30]);
    });
});

describe('the refutation log — the mechanism, built before it is needed', () => {
    // ⛓ R7 slice 5 gave it its first entry: §13.5's level_76 Dark Suit row put
    // the Dark Suit behind ITSELF, and AP's fill is what said so.
    it('carries the level_76 igneous refutation, well-formed', () => {
        for (const entry of REFUTATION_LOG) expect(isRefutation(entry)).toBe(true);
        expect(REFUTATION_LOG[0].row).toMatch(/level_76/);
        expect(REFUTATION_LOG[0].observed).toMatch(/prerequisite for itself/);
        // The refuted row must not still be shipping: the tile is ruled OPEN.
        expect(overlayTileSemantics(IGNEOUS_IS_FREE.tileType).kind).toBe('open');
    });

    // ⛓ R7 slice 6's entry, and it is the OTHER sign. Entry 1 was a row too
    // strict — an item behind itself — and AP REFUSED, loudly. This one was a
    // rule too permissive, and nothing refused at all: the generation stayed
    // green and only the sphere order was wrong about the game.
    it('carries the L20 grouped-lock refutation, and the row it refutes is GONE', () => {
        const entry = REFUTATION_LOG.find((r) => /lock@32,80/.test(r.row));
        expect(entry, 'the L20 entry').toBeDefined();
        expect(isRefutation(entry)).toBe(true);
        expect(entry.observed).toMatch(/THROUGH A WALL/);
        // ⛔ THE REFUTED ROW MUST NOT STILL BE SHIPPING, asserted through the
        // ruling function rather than by reading the exception table — a test
        // that read the table would pass even if `lockRuling` never consulted
        // it, which is exactly how the first cut of this fix would have looked.
        const ruled = overlayEntitySemantics(
            { type: 'lock', x: 32, y: 80, attrs: { tset: '0', tag: '1' } },
            {}, { level: 20 });
        expect(ruled.kind).toBe('gated');
        expect(conditionKey(ruled.condition)).toBe(conditionKey({ flag: 'hasShield' }));
        // …and the general rule is UNCHANGED for every other grouped lock.
        const other = overlayEntitySemantics(
            { type: 'lock', x: 32, y: 80, attrs: { tset: '0', tag: '1' } },
            {}, { level: 15 });
        expect(other.kind).toBe('open');
    });

    it('but its SHAPE is asserted, so the mechanism cannot rot while it waits', () => {
        const good = Object.fromEntries(REFUTATION_FIELDS.map((f) => [f, 'x']));
        expect(isRefutation(good)).toBe(true);
        for (const f of REFUTATION_FIELDS) {
            expect(isRefutation({ ...good, [f]: '' }), `an empty "${f}" must not pass`).toBe(false);
            const missing = { ...good };
            delete missing[f];
            expect(isRefutation(missing), `a missing "${f}" must not pass`).toBe(false);
        }
        expect(isRefutation(null)).toBe(false);
    });
});

describe('the overlay-only condition vocabulary', () => {
    it('resolves the seal count and the totem set, and refuses everything else', () => {
        expect(resolveOverlayCondition({ seals: 16 }))
            .toEqual({ rule: 'Has', args: { item_name: 'Seal', count: 16 } });
        expect(resolveOverlayCondition({ flag: 'hasTotemPartsAll' }))
            .toEqual({ rule: 'Has', args: { item_name: 'Totem Shard', count: 5 } });
        // A plain engine flag is the TRANSCRIPTION's to resolve, not ours.
        expect(resolveOverlayCondition({ flag: 'hasFire' })).toBeNull();
        expect(resolveOverlayCondition(null)).toBeNull();
    });
});

// ── R7 slice 5: the three gates a TERRAIN analysis can never see ────────────

describe('the LavaTrap lift', () => {
    const MAP = JSON.parse(readFileSync(
        fileURLToPath(new URL('./atlases/seedling-map.json', import.meta.url)), 'utf8',
    ));
    const level = (id) => MAP.levels.find((l) => l.level === id);

    it('reels the player onto the trap tile from 32 px, gated on the Dark Suit', () => {
        expect(LAVATRAP_PULL.chompRange).toBe(32);
        expect(LAVATRAP_PULL.condition).toEqual({ flag: 'hasDarkSuit' });
        expect(LAVATRAP_PULL.cite).toMatch(/LavaTrap\.as/);
        expect(LAVATRAP_PULL.cite).toMatch(/Player\.as:718/);
    });

    it('reaches exactly two tiles, measured centre to centre', () => {
        const [pull] = lavaTrapPulls({
            width: 9, height: 9, entities: [{ type: 'lavatrap', x: 64, y: 64 }],
        });
        expect(pull.tile).toEqual([4, 4]);
        const has = (x, y) => pull.from.some((t) => t[0] === x && t[1] === y);
        expect(has(4, 2)).toBe(true);   // straight up: exactly 32 px
        expect(has(4, 1)).toBe(false);  // 48 px
        expect(has(6, 6)).toBe(false);  // diagonal 45 px
        expect(has(5, 5)).toBe(true);   // diagonal 22 px
        expect(has(4, 4)).toBe(false);  // the trap's own tile is not a source
    });

    it('is what crosses L108, and each of the three hops is exactly one pull', () => {
        const pulls = lavaTrapPulls(level(108));
        expect(pulls.map((p) => p.tile)).toEqual([[8, 5], [8, 8], [8, 11]]);
        const reaches = (i, tile) => pulls[i].from.some((t) => t[0] === tile[0] && t[1] === tile[1]);
        expect(reaches(0, [8, 3])).toBe(true);
        expect(reaches(1, [8, 6])).toBe(true);
        expect(reaches(2, [8, 9])).toBe(true);
    });

    it('finds every lavatrap in the map and no other trap family', () => {
        const total = MAP.levels.reduce((n, l) => n + lavaTrapPulls(l).length, 0);
        const placed = MAP.levels
            .reduce((n, l) => n + l.entities.filter((e) => e.type === 'lavatrap').length, 0);
        expect(total).toBe(placed);
        expect(placed).toBe(9);
        // A darktrap is a different class and must not be swept in with them.
        expect(lavaTrapPulls({ width: 5, height: 5, entities: [{ type: 'darktrap', x: 0, y: 0 }] }))
            .toEqual([]);
    });
});

describe('location guards — the gate that is not a door', () => {
    it('gates the Wand on the totem, the Dark Sword on the Wand, and Fire on a weapon', () => {
        expect(locationGuard('wand@L43').condition)
            .toEqual({ all: [{ flag: 'hasTotemPartsAll' }, A_WEAPON] });
        expect(locationGuard('darksword@L12').condition).toEqual({ flag: 'hasWand' });
        expect(locationGuard('fire@L32').condition).toEqual(A_WEAPON);
        expect(locationGuard('sword@L10')).toBeNull();
    });

    it('cites source for every row and never ships one without a reason', () => {
        for (const [id, guard] of Object.entries(LOCATION_GUARDS)) {
            expect(typeof guard.cite, id).toBe('string');
            expect(guard.cite.length, id).toBeGreaterThan(20);
            expect(typeof guard.why, id).toBe('string');
            expect(guard.condition, id).toBeTruthy();
        }
    });
});

describe('the charged doors and the completion condition', () => {
    it('charges the D7 entrance and BOTH cells the FinalDoor covers', () => {
        expect(CHARGED_DOORS.map((d) => `${d.level}/${d.exitId}`)).toEqual([
            '12/out_teleporter_32_848',
            '113/out_teleporter_112_0',
            '113/out_teleporter_128_0',
        ]);
        for (const door of CHARGED_DOORS.filter((d) => d.level === 113)) {
            expect(door.condition).toEqual({ seals: 16 });
        }
    });

    it('states the goal as the BLOODLESS seed and names the other ending a non-goal', () => {
        expect(COMPLETION.goal).toMatch(/bloodless/);
        expect(COMPLETION.witness).toMatch(/menu_state 2/);
        expect(COMPLETION.excludedBranch).toMatch(/Watcher\.as/);
        expect(COMPLETION.implied.join(' ')).toMatch(/Watcher/);
    });
});
