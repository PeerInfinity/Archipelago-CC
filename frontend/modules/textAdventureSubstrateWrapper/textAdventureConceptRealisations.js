/**
 * textAdventureSubstrateWrapper/textAdventureConceptRealisations — **THE TEXT
 * ADVENTURE'S HALF OF THE CONCEPT LIBRARY** (concept library T2; plan
 * `concept-library-plan.md` §3.1, the trial's concepts; the contract is
 * `procgenCore/concepts.js`).
 *
 * ⛓ A text-adventure gate has NO GEOMETRY: `placeFromRules` records the rule on
 * the exit, the bridge evaluates `access_rule` at play and refuses the move, so
 * the gate is honoured by construction. What a concept adds here is WHAT THE
 * PLAYER READS — the room's `prose` payload field — and prose is this
 * substrate's mechanic, so every realisation is `tier: 'mechanic'`.
 *
 *   sword, swim  (items)   `prose.checkMessage` — the location that holds the item
 *   guardian     `gate`    requires the sword: `blocked` (the exit's
 *                          `inaccessibleMessage`) and `passedWith` (its
 *                          `moveMessage`, naming the weakness)
 *   water        `gate`    requires swim: the same two
 *
 * The strings are `{var}` templates, resolved at play by `templating.js`
 * (`{destinationRegion}` on an exit, `{item}` on a location).
 *
 * ⛔ Node-importable DATA: the registry entry declares it, `placeTextAdventureRules`
 * reads it (`textAdventureRoom.js`), and neither imports the other's module.
 */

export const TEXT_ADVENTURE_CONCEPT_REALISATIONS = Object.freeze({
    sword: Object.freeze({
        tier: 'mechanic',
        prose: Object.freeze({
            checkMessage: 'Half-buried in the rubble lies {item}, its edge still keen after who knows how long. '
                + 'You take up the sword and test its weight. Whatever guards these halls will have to reckon '
                + 'with it now.',
        }),
    }),
    swim: Object.freeze({
        tier: 'mechanic',
        prose: Object.freeze({
            checkMessage: 'You find {item}, and with it the knack of the water: how to breathe, how to kick, how '
                + 'to let it take your weight. You can swim now. Deep water will no longer turn you back.',
        }),
    }),
    guardian: Object.freeze({
        tier: 'mechanic',
        placements: Object.freeze({
            gate: Object.freeze({
                effect: 'requires',
                needs: Object.freeze(['sword']),
                mechanic: Object.freeze({
                    prose: Object.freeze({
                        blocked: 'A hulking guardian bars the way to {destinationRegion}, its armoured bulk '
                            + 'filling the passage. You carry nothing that could hurt it, and it knows it. '
                            + 'Without a sword, you will not get past.',
                        passedWith: 'You draw your sword and the guardian lunges, but its armour is split at '
                            + 'the joints and the blade finds the gap. Its weakness was the sword all along: it '
                            + 'crumples, and the way to {destinationRegion} lies open.',
                    }),
                }),
            }),
        }),
    }),
    water: Object.freeze({
        tier: 'mechanic',
        placements: Object.freeze({
            gate: Object.freeze({
                effect: 'requires',
                needs: Object.freeze(['swim']),
                mechanic: Object.freeze({
                    prose: Object.freeze({
                        blocked: 'Dark water floods the passage toward {destinationRegion}, too deep to wade and '
                            + 'too wide to leap. The current tugs at anything that touches it. You cannot cross '
                            + 'without knowing how to swim.',
                        passedWith: 'You wade into the water and let it take your weight, kicking out with long, '
                            + 'even strokes. Swimming carries you across the flood where no footing could, and you '
                            + 'haul yourself out on the far side, toward {destinationRegion}.',
                    }),
                }),
            }),
        }),
    }),
});
