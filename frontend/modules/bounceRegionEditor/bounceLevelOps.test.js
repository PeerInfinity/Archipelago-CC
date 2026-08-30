/**
 * ⛓⛓⛓ **THE BOUNCE LEVEL'S ATOMIC OPS — `BOUNCE_OP_KINDS`** (EDITOR INTEGRATION slice B-b).
 *
 * ⛔ EVERY CLAIM NAMES ITS MUTANT — the change to `bounceLevelOps.js` (or to
 * the panel that drives it) that would make the row go RED.
 *
 * ⚠ The subject is the OPS, not the panel: purity, copy-on-write, the refusal
 * sentences the level model already owns, and the cascade's shape. What the
 * panel does with them is `bounceEditAdapter.test.js`'s subject.
 */

import { describe, expect, it } from 'vitest';

import { validateLevel } from '../bounceDemo/level.js';
import { easyTower } from '../bounceDemo/fixtures/easyTower.js';
import {
    BOUNCE_OP_KINDS, ENTITY_KINDS, applyBounceOp, deletePlatformOps, hostedOn, nextId,
} from './bounceLevelOps.js';

const base = () => structuredClone(easyTower);

const apply = (level, op) => {
    const res = applyBounceOp(level, op);
    if (!res.ok) throw new Error(`refused: ${res.error}`);
    return res.level;
};

describe('⛔ purity and copy-on-write', () => {
    /**
     * ⛓⛓ MUTANT: any op that writes through to its argument (`level.platforms
     * .push(p)`, `Object.assign(found, patch)` — the panel's own two shapes)
     * — this row goes RED, and `editCore`'s contract law 3 goes RED with it.
     */
    it.each([
        ['resize', { op: 'resize', dim: 'width', value: 999 }],
        ['add-platform', { op: 'add-platform' }],
        ['set-platform', { op: 'set-platform', id: 'p0', patch: { x: 7 } }],
        ['delete-platform', { op: 'delete-platform', id: 'deco' }],
        ['add-entity', { op: 'add-entity', kind: 'springs', on: 'p0' }],
        ['remove-entity', { op: 'remove-entity', kind: 'pickups', id: 'loc_easy' }],
        ['set-pickup-item', { op: 'set-pickup-item', id: 'loc_easy', item: 'Springs' }],
        ['set-portal-direction', { op: 'set-portal-direction', id: 'exit_up', direction: 'left' }],
    ])('`%s` does not touch the level it was handed', (_name, op) => {
        const level = base();
        const before = JSON.stringify(level);
        const res = applyBounceOp(level, op);
        expect(res.ok, res.error).toBe(true);
        expect(JSON.stringify(level)).toBe(before);
        expect(res.level).not.toBe(level);
    });

    /** ⛓ MUTANT: deep-clone the level per op — every untouched array would be
     *  a new object and this row goes RED (and `equal`'s reference fast path
     *  would stop paying for itself). */
    it('shares every array the op did not touch', () => {
        const level = base();
        const next = apply(level, { op: 'resize', dim: 'height', value: 1200 });
        expect(next.platforms).toBe(level.platforms);
        expect(next.pickups).toBe(level.pickups);
        expect(next.size).not.toBe(level.size);
    });

    /** ⛓ Every op leaves a level the MODEL accepts — the invariant the ops
     *  exist to keep. ⛓ MUTANT: drop `delete-platform`'s orphan refusal. */
    it('every applied op leaves a level `validateLevel` accepts', () => {
        let level = base();
        for (const op of [
            { op: 'add-platform' },
            { op: 'add-entity', kind: 'pickups', on: 'p0', item: 'Springs' },
            { op: 'set-platform', id: 'p1', patch: { type: 'brown' } },
            { op: 'resize', dim: 'width', value: 420 },
            { op: 'set-portal-direction', id: 'exit_up', direction: 'right' },
        ]) {
            level = apply(level, op);
            expect(validateLevel(level), JSON.stringify(op)).toEqual([]);
        }
    });
});

describe('⛓ resize', () => {
    it('rounds and floors at 1 — the number RECORDED is the number applied', () => {
        expect(apply(base(), { op: 'resize', dim: 'width', value: 399.6 }).size.width).toBe(400);
        expect(apply(base(), { op: 'resize', dim: 'height', value: -5 }).size.height).toBe(1);
    });

    /** ⛓ MUTANT: accept any `dim` — `size.wdith` would be written silently. */
    it('refuses an unknown dim and a non-finite value BY NAME', () => {
        expect(applyBounceOp(base(), { op: 'resize', dim: 'wdith', value: 1 }).error)
            .toMatch(/resize dim must be 'width' or 'height', got "wdith"/);
        expect(applyBounceOp(base(), { op: 'resize', dim: 'width', value: NaN }).error)
            .toMatch(/must be a finite number/);
    });
});

describe('⛓ add-platform / set-platform', () => {
    /** ⛓ `value` is the node — the field the session forwards (trap 857). */
    it('answers the platform it added, with the panel\'s own defaults', () => {
        const level = base();
        const res = applyBounceOp(level, { op: 'add-platform' });
        expect(res.value).toEqual({ id: 'p7', type: 'green', x: 200, y: 500 });
        expect(res.level.platforms.at(-1)).toBe(res.value);
    });

    /**
     * ⛓⛓ MUTANT: default the id from `platforms.length` instead of `nextId` —
     * `easyTower` has eight platforms of which one is called `deco`, so the
     * next free `pN` is `p7` and a length-based id would be `p8`, leaving a
     * hole a later add would collide with.
     */
    it('the default id is the first FREE `pN`, and it replays', () => {
        expect(nextId('p', easyTower.platforms)).toBe('p7');
        const once = apply(base(), { op: 'add-platform' });
        const twice = apply(once, { op: 'add-platform' });
        expect(twice.platforms.slice(-2).map((p) => p.id)).toEqual(['p7', 'p8']);
    });

    it('refuses a duplicate id, an unknown type and an out-of-bounds position', () => {
        expect(applyBounceOp(base(), { op: 'add-platform', id: 'p0' }).error)
            .toBe("platforms: duplicate id 'p0'");
        expect(applyBounceOp(base(), { op: 'add-platform', type: 'pink' }).error)
            .toBe("platform 'p7': unknown type 'pink'");
        expect(applyBounceOp(base(), { op: 'add-platform', x: 9999 }).error)
            .toBe("platform 'p7': position (9999,500) outside level bounds");
    });

    /**
     * ⛓⛓⛓ MUTANT: allow `id` in a patch. Renaming `p5` would orphan
     * `loc_easy` (`on:'p5'`) — a level the validator refuses, reached by a
     * gesture the panel presents as editing a number.
     */
    it('⛔ a patch may NOT name `id` — the four `on` sites say why', () => {
        const res = applyBounceOp(base(), { op: 'set-platform', id: 'p5', patch: { id: 'zz' } });
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/may not patch `id`/);
        expect(res.error).toMatch(/would orphan them all/);
    });

    it('refuses an unknown id, naming what the level DOES hold', () => {
        const res = applyBounceOp(base(), { op: 'set-platform', id: 'ghost', patch: { x: 1 } });
        expect(res.error).toMatch(/no platform 'ghost' to set — the level holds \[p0, p1, /);
    });

    it('refuses a bad type and a non-numeric coordinate in the model\'s own words', () => {
        expect(applyBounceOp(base(), { op: 'set-platform', id: 'p0', patch: { type: 'pink' } })
            .error).toBe("platform 'p0': unknown type 'pink'");
        expect(applyBounceOp(base(), { op: 'set-platform', id: 'p0', patch: { x: 'left' } })
            .error).toBe("platform 'p0': x/y must be numbers");
    });
});

describe('⛓⛓⛓ delete-platform — the cascade is a GROUP, and the atomic op REFUSES an orphan', () => {
    /**
     * ⛓⛓⛓ MUTANT — **the group row.** Let the atomic `delete-platform` sweep
     * the five entity arrays itself (the panel's `_deletePlatform` body) and
     * this row goes GREEN for the wrong reason: the removals stop being in the
     * op list, so nothing reading `payload().edits` can see what the delete
     * took with it. Let it delete WITHOUT sweeping and the level fails
     * `validateLevel`. Only the group is both.
     */
    it('refuses while anything is hosted on it — in `checkEntities`\' own sentence', () => {
        const res = applyBounceOp(base(), { op: 'delete-platform', id: 'p5' });
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/^pickups 'loc_easy': on='p5' references no platform/);
        expect(res.error).toMatch(/would orphan 1 entity/);
        expect(res.error).toMatch(/The cascade is a GROUP/);
    });

    it('an UNhosted platform deletes alone', () => {
        const next = apply(base(), { op: 'delete-platform', id: 'deco' });
        expect(next.platforms.map((p) => p.id)).not.toContain('deco');
        expect(validateLevel(next)).toEqual([]);
    });

    /** ⛓ MUTANT: reverse the order — the delete would refuse on its own
     *  orphans and the whole group would be refused. */
    it('`deletePlatformOps` puts the removals FIRST, and every intermediate level is valid', () => {
        const level = base();
        const ops = deletePlatformOps(level, 'p6'); // hosts exit_up
        expect(ops.map((o) => o.op)).toEqual(['remove-entity', 'delete-platform']);
        expect(ops[0]).toEqual({ op: 'remove-entity', kind: 'portals', id: 'exit_up' });
        let cur = level;
        for (const op of ops) {
            cur = apply(cur, op);
            expect(validateLevel(cur).filter((e) => /references no platform/.test(e)))
                .toEqual([]);
        }
        expect(cur.platforms.map((p) => p.id)).not.toContain('p6');
        expect(cur.portals).toEqual([]);
    });

    it('`hostedOn` enumerates in ENTITY_KINDS order and finds nothing on an unhosted one', () => {
        expect(hostedOn(easyTower, 'p5')).toEqual([{ kind: 'pickups', id: 'loc_easy' }]);
        expect(hostedOn(easyTower, 'deco')).toEqual([]);
        expect(ENTITY_KINDS).toEqual(['springs', 'jetpacks', 'pickups', 'portals', 'teleports']);
    });
});

describe('⛓ add-entity / remove-entity — the two halves of the panel\'s toggle', () => {
    it('adds at the host\'s position, with the panel\'s id prefix', () => {
        const res = applyBounceOp(base(), { op: 'add-entity', kind: 'springs', on: 'p0' });
        expect(res.value).toEqual({ id: 'spring0', x: 200, y: 900, on: 'p0' });
    });

    /**
     * ⛓⛓ MUTANT: default a pickup's `item` here (to the first pool entry, the
     * panel's choice) — the op would invent a fact about a WORLD it cannot
     * see, and the same op list would mean different things in two panels.
     */
    it('a pickup\'s item comes IN the op; absent means `null`, never a guess', () => {
        expect(applyBounceOp(base(), { op: 'add-entity', kind: 'pickups', on: 'p0' })
            .value.item).toBe(null);
        expect(applyBounceOp(base(), { op: 'add-entity', kind: 'pickups', on: 'p0', item: 'Victory' })
            .value.item).toBe('Victory');
    });

    it('a portal gets a direction, defaulting to `up`, and refuses a bad one', () => {
        expect(applyBounceOp(base(), { op: 'add-entity', kind: 'portals', on: 'p0' })
            .value.direction).toBe('up');
        expect(applyBounceOp(base(),
            { op: 'add-entity', kind: 'portals', on: 'p0', direction: 'sideways' }).error)
            .toBe("portal 'portal0': bad direction 'sideways'");
    });

    /** ⛓ A kind whose array is ABSENT (easyTower has no `teleports`) works,
     *  and the new key lands at the END — key order is content, so this is a
     *  fact worth pinning rather than an accident. */
    it('a kind with no array yet gains one, appended', () => {
        const next = apply(base(), { op: 'add-entity', kind: 'teleports', on: 'p0' });
        expect(next.teleports).toHaveLength(1);
        expect(Object.keys(next).at(-1)).toBe('teleports');
    });

    it('refuses an unknown kind, an unknown host, and a SECOND of a kind on one host', () => {
        expect(applyBounceOp(base(), { op: 'add-entity', kind: 'ladders', on: 'p0' }).error)
            .toMatch(/"ladders" is not an entity kind — the level's are \[springs, /);
        expect(applyBounceOp(base(), { op: 'add-entity', kind: 'springs', on: 'ghost' }).error)
            .toBe("springs '(new)': on='ghost' references no platform");
        expect(applyBounceOp(base(), { op: 'add-entity', kind: 'pickups', on: 'p5' }).error)
            .toMatch(/already hosts a pickup/);
    });

    it('remove-entity answers the entity it took, and refuses an unknown id', () => {
        const res = applyBounceOp(base(), { op: 'remove-entity', kind: 'pickups', id: 'loc_easy' });
        expect(res.value.id).toBe('loc_easy');
        expect(res.level.pickups.map((e) => e.id)).toEqual(['loc_easy2']);
        expect(applyBounceOp(base(), { op: 'remove-entity', kind: 'pickups', id: 'ghost' }).error)
            .toMatch(/no pickup 'ghost' to remove — the level holds \[loc_easy, loc_easy2\]/);
    });
});

describe('⛓ set-pickup-item / set-portal-direction', () => {
    it('sets an item, accepts null, and refuses a non-string', () => {
        expect(apply(base(), { op: 'set-pickup-item', id: 'loc_easy', item: 'Jetpacks' })
            .pickups[0].item).toBe('Jetpacks');
        expect(apply(base(), { op: 'set-pickup-item', id: 'loc_easy', item: null })
            .pickups[0].item).toBe(null);
        expect(applyBounceOp(base(), { op: 'set-pickup-item', id: 'loc_easy', item: 7 }).error)
            .toMatch(/a pickup's item is a string or null/);
    });

    it('aims a portal, and refuses a bad direction in the validator\'s own sentence', () => {
        expect(apply(base(), { op: 'set-portal-direction', id: 'exit_up', direction: 'down' })
            .portals[0].direction).toBe('down');
        expect(applyBounceOp(base(),
            { op: 'set-portal-direction', id: 'exit_up', direction: 'nor' }).error)
            .toBe("portal 'exit_up': bad direction 'nor'");
    });
});

describe('⛓⛓⛓ replace-level — Regenerate carries the RESULT, never the recipe', () => {
    /**
     * ⛓⛓⛓ MUTANT — **the determinism row.** Make `replace-level` carry a
     * `{seed, specs}` recipe and re-run `generateZoneForSpecs` on the fold.
     * Fold the same list twice and the two levels agree only while every input
     * to the generator is unmoved; the day one moves, a recorded edit list
     * reconstructs a DIFFERENT level from the one the person saw (trap 787's
     * family). Here the op IS the bytes, so a re-fold is an identity.
     */
    it('a re-fold of the same op is byte-identical, because the op IS the level', () => {
        const fresh = structuredClone(easyTower);
        fresh.id = 'regenerated';
        const once = apply(base(), { op: 'replace-level', level: fresh });
        const twice = apply(base(), { op: 'replace-level', level: fresh });
        expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
        expect(JSON.stringify(once)).toBe(JSON.stringify(fresh));
    });

    /** ⛓ MUTANT: skip the validation — the one op that can put an arbitrary
     *  object into the record would put one there. */
    it('refuses a level the MODEL refuses, quoting the validator', () => {
        const res = applyBounceOp(base(), { op: 'replace-level', level: { id: 'x' } });
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/replace-level was handed a level the model refuses/);
        expect(res.error).toMatch(/size\.\{width,height\} must be positive numbers/);
    });
});

describe('⛔ the vocabulary refuses everything outside it BY NAME', () => {
    it('an unknown op names the whole vocabulary, DERIVED from the roster', () => {
        const res = applyBounceOp(base(), { op: 'paint-tile', x: 1, y: 1 });
        expect(res.ok).toBe(false);
        expect(res.error).toBe('bounce: unknown op "paint-tile" — the vocabulary is '
            + `[${BOUNCE_OP_KINDS.join(', ')}].`);
    });

    /** ⛓ The roster is the SET the switch answers — asserted as names rather
     *  than as a count, so adding an op edits one list and not two. */
    it('every roster name is answered, and nothing outside it is', () => {
        for (const kind of BOUNCE_OP_KINDS) {
            expect(applyBounceOp(base(), { op: kind }).error ?? '',
                kind).not.toMatch(/unknown op/);
        }
        expect(applyBounceOp(base(), { op: 'resize' }).error).not.toMatch(/unknown op/);
        expect(new Set(BOUNCE_OP_KINDS).size).toBe(BOUNCE_OP_KINDS.length);
    });

    it('a non-level is refused before any op runs', () => {
        expect(applyBounceOp(null, { op: 'resize', dim: 'width', value: 1 }).error)
            .toMatch(/a level is an object, got null/);
    });
});
