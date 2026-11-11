/**
 * textAdventureSubstrateWrapper/textAdventureConceptRealisations — **THE TEXT
 * ADVENTURE'S HALF OF THE CONCEPT LIBRARY** (concept library T2; plan
 * `concept-library-plan.md` §3.1, the trial's concepts; the contract is
 * `procgenCore/concepts.js`). ⛓ CONTENT SETS R1: **the LOGIC half only.**
 *
 * ⛓ A text-adventure gate has NO GEOMETRY: `placeFromRules` records the rule on
 * the exit, the bridge evaluates `access_rule` at play and refuses the move, so
 * the gate is honoured by construction. What a concept adds here is WHAT THE
 * PLAYER READS — the room's `prose` payload field — and prose is this
 * substrate's mechanic, so every realisation is `tier: 'mechanic'`.
 *
 *   sword, swim  (items)   the location that holds the item says `checkMessage`
 *   guardian     `gate`    requires the sword: `blocked` (the exit's
 *                          `inaccessibleMessage`) and `passedWith` (its
 *                          `moveMessage`, naming the weakness)
 *   water        `gate`    requires swim: the same two
 *
 * ⛓ The WORDS are content: they live in the substrate's default content pack
 * (`frontend/packs/text-adventure/`, the entry's `defaultContentPack`), a pack
 * concept per mechanic that `presents` it and names those text slots, and
 * `placeTextAdventureRules` resolves them through the world's content set
 * (`textAdventureRoom.js`). What a slot MEANS — which message of the room it
 * becomes, when it shows — is behaviour (⚖ Q6) and stays in code: the slot
 * tables `GATE_PROSE_SLOTS` / `ITEM_PROSE_SLOTS` below, and the entry's
 * `contentRoles` that ask for them.
 *
 * ⛔ Node-importable DATA: the registry entry declares it, `placeTextAdventureRules`
 * reads it (`textAdventureRoom.js`), and neither imports the other's module.
 */

/** A gate's text slot → the exit message it is written as. */
export const GATE_PROSE_SLOTS = Object.freeze({ blocked: 'inaccessibleMessage', passedWith: 'moveMessage' });
/** A found item's text slot → the location message it is written as. */
export const ITEM_PROSE_SLOTS = Object.freeze({ checkMessage: 'checkMessage' });

export const TEXT_ADVENTURE_CONCEPT_REALISATIONS = Object.freeze({
    sword: Object.freeze({ tier: 'mechanic' }),
    swim: Object.freeze({ tier: 'mechanic' }),
    guardian: Object.freeze({
        tier: 'mechanic',
        placements: Object.freeze({
            gate: Object.freeze({ effect: 'requires', needs: Object.freeze(['sword']) }),
        }),
    }),
    water: Object.freeze({
        tier: 'mechanic',
        placements: Object.freeze({
            gate: Object.freeze({ effect: 'requires', needs: Object.freeze(['swim']) }),
        }),
    }),
});

/** ⛓ CONTENT SETS R1 — the pack whose words a world gets when it names no theme (the entry's `defaultContentPack`). */
export const TEXT_ADVENTURE_DEFAULT_CONTENT_PACK = 'text-adventure';

/**
 * ⛓⛓ CONTENT SETS R1 — **WHAT THE TEXT ADVENTURE CAN SHOW FROM A PACK** (the
 * entry's `contentRoles`; contract `procgenCore/contentRoles.js`). The slots each
 * role needs are the keys of the slot tables above, so a role and the placer that
 * writes it cannot disagree. `character` and `info` are NOT declared: nothing
 * here shows them yet (step 3).
 */
export const TEXT_ADVENTURE_CONTENT_ROLES = Object.freeze({
    gate: Object.freeze({
        accepts: Object.freeze({ presents: Object.freeze(['guardian', 'water']) }),
        needs: Object.freeze({ text: Object.freeze(Object.keys(GATE_PROSE_SLOTS)) }),
        why: 'A gated exit the rule selected a concept for says why it is shut and how it was passed.',
    }),
    item: Object.freeze({
        accepts: Object.freeze({ presents: Object.freeze(['sword', 'swim']) }),
        needs: Object.freeze({ text: Object.freeze(Object.keys(ITEM_PROSE_SLOTS)) }),
        why: 'The location that holds an offered item concept says what the player found.',
    }),
    place: Object.freeze({
        accepts: Object.freeze({ kinds: Object.freeze(['place']) }),
        why: 'A room takes a place\'s name and description in place of its region id.',
    }),
});
