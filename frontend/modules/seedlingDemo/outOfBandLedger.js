/**
 * seedlingDemo/outOfBandLedger — the tag = −1 persistence writes, as a
 * FAMILY rather than as two coincidences.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 5 step 0.
 * Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §17, §18.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * Two rungs found the same arithmetic from two different entities and
 * wrote it down twice:
 *
 * - slice 4: `Fire.removed()` calls `Game.setPersistence(-1, false)` from
 *   L32, which lands on **{31,29}**. Recorded as a hard-coded constant
 *   (`r5Acceptance.FIRE_OUT_OF_BAND_FLAG`) because it was one entity.
 * - slice 5: `BreakableRock.endAnim()` does the same from L92, which lands
 *   on **{91,29}**. Recorded as the general form
 *   (`breakableRocks.outOfBandFlagFor`) and asserted against the constant.
 *
 * A constant asserted against a formula catches drift between those TWO.
 * It does not catch a THIRD — and there already is one:
 * `Witch.doneTalking()` does `FP.world.add(new DarkSword(p.x - 8, p.y -
 * 8))` with the tag defaulted, so slice 5 step 5 puts a `tag = -1` pickup
 * in L12. Nothing in the slice-4 shape would have flagged it; the walk
 * would simply have reported a clear (or NOT reported one — see the guard
 * column) that nobody could attribute.
 *
 * So the arithmetic is derived HERE, from the WRITING ENTITY, and every
 * assertion site calls this module. A class that is not in
 * `OUT_OF_BAND_WRITERS` **throws**: the fourth member cannot be modelled
 * without being classified first. That is the "by construction" half —
 * the registry is a list of NAMES, never a predicate
 * (`feedback_coincidental_predicate_rots`).
 *
 * ── THE ARITHMETIC ────────────────────────────────────────────────────
 *
 * ```
 *   Game.as:1823-1826   setPersistence(tag, o, _l = -1) ->
 *                       Main.levelPersistenceSet(_l >= 0 ? _l : Main.level, tag, o)
 *   Main.as:202         levelPersistence[i * Game.tagsPerLevel + j] = _t
 * ```
 *
 * `j = -1` is not bounds-checked, so the index is `level * 30 - 1` =
 * `(level - 1) * 30 + 29` — **the PREVIOUS level's LAST slot**. There is
 * no wrapping, no error and no clamp; it is one flat array.
 *
 * ── THE THREE MEMBERS, AND WHY THE GUARD COLUMN MATTERS ───────────────
 *
 * The three are NOT the same shape, which is exactly why one helper has
 * to carry the classification instead of the caller assuming it:
 *
 * | class         | write site   | guard                          |
 * |---------------|--------------|--------------------------------|
 * | Fire          | removed()    | unconditional (under doActions)|
 * | BreakableRock | endAnim()    | unconditional                  |
 * | DarkSword     | removed()    | an out-of-band READ            |
 *
 * `Fire.removed()` and `BreakableRock.endAnim()` write no matter what.
 * `DarkSword.removed()` is
 *
 * ```
 *   if (doActions) {
 *       Player.hasDarkSword = true;
 *       if (Game.checkPersistence(tag)) {          // <- tag is -1
 *           Game.setPersistence(tag, false);
 *           Main.unlockMedal(...);
 *       }
 *   }
 * ```
 *
 * — so the ITEM lands unconditionally and the LEDGER ENTRY lands only if
 * the out-of-band slot it is about to clear was already TRUE. A model
 * that treated all three alike would predict a clear the game does not
 * make. `writesWhen` is that fact, per member, and `expectsLedgerEntry`
 * is the one place a caller asks it.
 */

import { TAGS_PER_LEVEL, outOfBandFlagFor } from './breakableRocks.js';

export class OutOfBandLedgerError extends Error {
    constructor(message) { super(message); this.name = 'OutOfBandLedgerError'; }
}
const fail = (m) => { throw new OutOfBandLedgerError(m); };

export { TAGS_PER_LEVEL };

/**
 * Every AS3 class known to reach `Game.setPersistence` with a NEGATIVE
 * tag, with the site, the guard, and how it comes to hold a −1.
 *
 * ⚠ A class is in here because its −1 was READ OUT OF THE SOURCE, not
 * because a walk happened to hit it. `witness` names the tape that
 * exercises it, or null for a member that is classified but not yet
 * walked — an unexercised member is a finding, not a pass
 * (the `MODEL_EXEMPT` rule, one module over).
 */
export const OUT_OF_BAND_WRITERS = Object.freeze({
    Fire: Object.freeze({
        as3: 'Pickups/Fire.as:42-48',
        writeSite: 'removed()',
        writesWhen: 'always',
        minusOneFrom: '`BobBoss.death` spawns `new Fire(x, y, -1)` at runtime — the tag '
            + 'is the third constructor argument and the boss passes the sentinel, so '
            + 'no map entry is involved and no level list carries it',
        skipsItsOwnGuard: '`check()` is `tag >= 0 && !checkPersistence(tag)`, which a '
            + '-1 never enters — so the entity is never removed by persistence and the '
            + 'write in `removed()` is reached with `doActions` still true',
        witness: 'r5-bobboss-fire',
    }),
    BreakableRock: Object.freeze({
        as3: 'Puzzlements/BreakableRock.as:66-70',
        writeSite: 'endAnim()',
        writesWhen: 'always',
        minusOneFrom: 'the MAP: L92 builds both of its `breakablerock`s with tag -1, so '
            + 'the sentinel is authored data rather than a runtime spawn',
        skipsItsOwnGuard: 'the `tag >= 0` guard belongs to `check()`; `endAnim` has none '
            + 'at all, and it is also why a -1 rock is rebuilt by every `new Game` — '
            + 'a break is PER VISIT',
        witness: 'r5-feather',
    }),
    // ⚠ THE THIRD MEMBER, and the reason this module exists. Registered
    // from the SOURCE at slice 5 step 0, before the walk that meets it.
    DarkSword: Object.freeze({
        as3: 'Pickups/DarkSword.as:40-52',
        writeSite: 'removed()',
        writesWhen: 'ifFlagAlreadySet',
        minusOneFrom: '`Witch.doneTalking()` is `FP.world.add(new DarkSword(p.x - Tile.w/2, '
            + 'p.y - Tile.h/2))` — three arguments, so `_tag` takes its default of -1. '
            + 'The sword is spawned AT THE PLAYER by a dialogue ending, not placed on a map',
        skipsItsOwnGuard: 'same `check()` shape as `Fire`, so `doActions` survives and '
            + '`Player.hasDarkSword = true` lands unconditionally — but the ledger write '
            + 'sits behind `if (Game.checkPersistence(tag))`, an out-of-band READ of the '
            + 'same slot, so the ENTRY appears only when that slot was already true',
        witness: 'r5-witch-darksword',
    }),
    // ⚠ THE FOURTH AND FIFTH, registered at R5 slice 7 — and the fourth is
    // the one this module's own docblock said "cannot be modelled" without
    // a citation. Both come from the SOURCE rather than from a divergence.
    Lock: Object.freeze({
        as3: 'Puzzlements/Lock.as:90-104',
        writeSite: 'turnOff() / returnToNormal()',
        writesWhen: 'always',
        minusOneFrom: 'the CONSTRUCTOR default. `Lock(_x, _y, _t, _tag:int = -1)` — every '
            + '`<lock>`/`<wandlock>` authored without a `tag` attribute takes the '
            + 'sentinel, and 4 of L39\'s 8 activators do',
        skipsItsOwnGuard: '`check()`\'s `tag >= 0 && tSet < 0` guard governs whether the '
            + 'lock is DELETED at build time; `turnOff` and `returnToNormal` have no tag '
            + 'guard at all, so a -1 lock that fades open still writes — into the '
            + 'previous level\'s last slot',
        witness: 'r5-shaft',
    }),
    RopeStart: Object.freeze({
        as3: 'Puzzlements/RopeStart.as:41-49',
        writeSite: 'hit()',
        writesWhen: 'always',
        minusOneFrom: 'the same constructor default — `RopeStart(_x, _y, _xend, _t, '
            + '_tag:int = -1)`. L39\'s rope carries tag 9, so this route\'s pull is '
            + 'IN-BAND; the entry is here because the sentinel is reachable and a '
            + 'class this helper does not know throws',
        skipsItsOwnGuard: '`hit()`\'s only guard is `if (!activate)` — the `tag >= 0` '
            + 'test lives in `check()`, which decides whether the rope boots already '
            + 'pulled',
        witness: 'r5-shaft',
    }),
});

/**
 * The one named helper. Resolve the flag a writing ENTITY lands on.
 *
 * @param {{as3: string, level: number, tag?: number}} writer
 *   `as3` the class name as the census spells it, `level` `Main.level` at
 *   the moment of the write, `tag` the entity's own tag (default −1, the
 *   sentinel every member of this family carries).
 * @returns {{level, tag, outOfBand, as3, writesWhen, expectsLedgerEntry, key}}
 */
export function outOfBandFlagForWriter(writer) {
    if (!writer || typeof writer !== 'object') {
        fail('outOfBandFlagForWriter: expects {as3, level, tag}, got '
            + `${writer === null ? 'null' : typeof writer}`);
    }
    const { as3, level } = writer;
    const tag = writer.tag ?? -1;
    const entry = Object.prototype.hasOwnProperty.call(OUT_OF_BAND_WRITERS, as3)
        ? OUT_OF_BAND_WRITERS[as3] : null;
    if (!entry) {
        fail(`outOfBandFlagForWriter: \`${as3}\` is not a classified out-of-band writer. `
            + `Known: ${Object.keys(OUT_OF_BAND_WRITERS).join(', ')}. A FOURTH member is `
            + 'not a modelling detail — read its write site, decide whether the write is '
            + 'unconditional or guarded by an out-of-band READ, and add it to '
            + '`OUT_OF_BAND_WRITERS` with the citation. This refusal is the point of the '
            + 'registry: the arithmetic would happily produce a number for any class, and '
            + 'a number nobody checked against the source is what {31,29} and {91,29} were '
            + 'each on their own.');
    }
    if (tag >= 0) {
        fail(`outOfBandFlagForWriter: \`${as3}\` at L${level} was given tag ${tag}, which `
            + 'is IN band. This helper is for the -1 family; an in-band write is an '
            + 'ordinary {level, tag} entry and does not need it. If a member of the family '
            + 'can also be built with a real tag (BreakableRock can — L92 is the -1 case, '
            + 'other levels are not), the CALLER decides which path it is on.');
    }
    const flag = outOfBandFlagFor(level, tag);
    if (!flag.outOfBand) {
        fail(`outOfBandFlagForWriter: L${level} tag ${tag} resolved IN band, which `
            + 'contradicts the tag check above and means the arithmetic changed');
    }
    return Object.freeze({
        ...flag,
        as3,
        from: { level, tag },
        writesWhen: entry.writesWhen,
        expectsLedgerEntry: entry.writesWhen === 'always',
        key: `${flag.level}:${flag.tag}`,
    });
}

/** The ledger's own spelling of a flag, so no call site formats it by hand. */
export function ledgerKey(flag) {
    if (!flag || !Number.isInteger(flag.level) || !Number.isInteger(flag.tag)) {
        fail(`ledgerKey: expects {level, tag} integers, got ${JSON.stringify(flag)}`);
    }
    return `${flag.level}:${flag.tag}`;
}

/**
 * The DarkSword arm's other half: what slot does the GUARD read?
 *
 * It is the same slot the write would clear — `checkPersistence(tag)` and
 * `setPersistence(tag, false)` resolve through the same `i * 30 + j` — so
 * this is `outOfBandFlagForWriter` under a name that says READ. It exists
 * so the walk can assert the slot's value BEFORE the talk rather than
 * inferring the guard's arm from whether an entry appeared, which is the
 * shape that makes a negative vacuous.
 */
export function outOfBandReadFor(writer) {
    const flag = outOfBandFlagForWriter(writer);
    if (flag.writesWhen !== 'ifFlagAlreadySet') {
        fail(`outOfBandReadFor: \`${flag.as3}\` writes ${flag.writesWhen} — it has no `
            + 'read guard, so asking which slot it reads is a question about the wrong '
            + 'member');
    }
    return flag;
}

/**
 * Every classified member's flag for one walk's levels, as the ledger
 * would spell it. The acceptance side calls this instead of listing
 * constants, so a fourth member that a future walk meets arrives with its
 * entry already expected rather than as an unattributed clear.
 *
 * @param {Array<{as3: string, level: number, tag?: number}>} writers
 */
export function expectedOutOfBandEntries(writers) {
    if (!Array.isArray(writers)) {
        fail(`expectedOutOfBandEntries: expects an array, got ${typeof writers}`);
    }
    const out = new Map();
    for (const w of writers) {
        const flag = outOfBandFlagForWriter(w);
        if (!flag.expectsLedgerEntry) continue;
        out.set(flag.key, flag);
    }
    return out;
}
