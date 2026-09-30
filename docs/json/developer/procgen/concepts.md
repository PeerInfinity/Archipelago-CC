# Concepts

A concept is a thing a world can be about — a sword, a guardian, water, a coloured door — declared once, in no substrate's words, so that the planner can ask every substrate the same question: *can you show this, and what does it do to reachability?* The concept library is how a substrate declares what it can enforce, how a planned rule selects one of those declarations, and what the substrate's own oracle must measure before the choice counts.

The code is `frontend/modules/procgenCore/concepts.js` (the contract and the table) and `frontend/modules/procgenPipeline/conceptSelection.js` (the selection step). Both are browser-safe and name no substrate; their tests read their source to keep it that way.

## The direction

In sphere growth and top-down, the **planner** fixes each gate's rule and hands it to the substrate through `placeFromRules` (see [Substrate Registry Reference](./substrate-registry.md#build-time--procedural-substrates)). A substrate realises that rule; it never invents one. The concept library keeps that direction:

1. A substrate **declares** which concepts it can realise and how (its *realisations*).
2. The planned rule **selects** a realisation whose needs are exactly the rule.
3. The substrate's oracle **certifies** the result with a differential grade (see [below](#the-three-effects)).

## The two halves

A concept has two halves, and they live in two places.

- **The neutral half** is one entry in `CONCEPTS`: its `kind` (`item`, `obstacle`, `enemy`, `hazard`), its item row if it is an item, its parameters, its presentation, and its **relations** to other concepts — `weakness` (a guardian is beaten by the sword), `crossedWith` (water is crossed with swim), `openedBy` (a door is opened by its key). Nothing here says how any game draws it.
- **A substrate's half** is `conceptRealisations` on that substrate's own registry entry, keyed by concept id. Each realisation has a `tier` — `mechanic` (the substrate enforces what the concept means) or `skin` (it only shows it) — optional `art`, and, for anything that is not an item, one or more **placements**:

```js
conceptRealisations: {
    guardian: { tier: 'mechanic', art: null, placements: {
        gate:    { effect: 'requires', needs: ['sword'], mechanic: { element: 'killgate' } },
        roaming: { effect: 'none',                        mechanic: { element: 'roam' } } } },
    water:    { tier: 'mechanic', art: null, placements: {
        gate:     { effect: 'requires', needs: ['swim'], mechanic: { element: 'watergate' } },
        shortcut: { effect: 'helps',    needs: ['swim'], mechanic: { element: 'watershortcut' } } } },
    sword:    { tier: 'mechanic', flag: 'hasSword' },
}
```

An item realisation carries no placements (an item is held, not placed as a gate); any other field on it, such as a boot flag, is the substrate's own.

`assertConceptTable` checks the neutral half and `assertRealisations(entry, concepts)` checks a substrate's half. A malformed declaration throws a `ConceptContractError` naming what is wrong. A substrate that declares no realisations, or does not realise a given concept, is not an error.

### Parameterised concepts

A concept can take parameters in the same schema language templates and skeleton kinds use (`templateContract.assertParamSchema`: `[{key, domain, default, why}]`). Each value combination is an **instance** (`instancesOf`), with its own id from `idFor(values)` and its own row in `presentation`. The `key` and `door` concepts take a `colour`; `itemRowsOf(CONCEPTS.key)` and `obstacleRowsOf(CONCEPTS.door, CONCEPTS)` render their instances in the shared library's row shape, and a test holds those rows equal to the shared library's coloured keys and doors (see [Paths and Obstacles](./paths-and-obstacles.md#the-vocabulary-frontendmodulessharedprocgenlibraryjs)). A door's clear set comes from its `openedBy` relation: the key instance with the door's own colour.

## The three effects

Every placement declares one `effect`, and each is tied to the element law that adjudicates it and the grade its with/without differential must earn. Both are imported from their owners (`elements.js`, `differentialGrade.js`) and exposed as `EFFECT_LAW` and `EFFECT_GRADES`; `gradeCertifies(effect, grade)` asks the question.

| Effect | Meaning | Law | Grades that certify it |
|---|---|---|---|
| `requires` | the goal is unreachable without the needs | `cut` | `STRONG`, `BOUND-DEPENDENT` (the `REQUIRING_GRADES`) |
| `helps` | the goal is reachable either way, and strictly cheaper with the needs | `shortcut` | `SHORTENS` |
| `none` | the placement changes nothing about reachability | — | `INERT` |

`SHORTENS` never certifies `requires`: a shortcut is exactly the case where the level solves without the item.

Logic is always `needs` plus `effect`, never a free rule expression; a placement that carries a `rule` is refused. A need is a concept id or `{concept, count}` — the feather is swim ×2 — and must name an unparameterised item concept. When a concept behaves differently depending on where it stands, that is two placements (a guardian as a gate, a guardian roaming), never logic computed from the position.

## Selection

`conceptSelection.js` takes the planner's rule and an entry:

- `ruleFor(placement, concepts)` writes a placement's needs as Rule Builder JSON: one need is a `Has` (with `count` only when it is not 1), several are an `And`. `extractItemRequirementFromRule` reads every such rule back exactly.
- `candidatesFor(rule, entry, {concepts, offered})` returns the entry's `requires` placements whose needs equal the rule's **exact** requirement — the same item names and the same counts. A rule the extractor reports as inexact (an `Or`, a many-item `HasAny`) has no candidates: no single placement is equivalent to a disjunction. Only concepts in `offered`, the world's list of concept ids, are considered.
- `selectRealisation(rule, entry, {concepts, offered, rng})` returns null, the single candidate, or one `rng.choice` among several.
- `decorationsFor(entry, {offered})` returns the `helps` and `none` placements. No rule ever selects them, because they change no reachability the planner fixed.

**The draw budget.** An empty or absent `offered` list returns no candidate and spends no draw; zero or one candidate spends no draw; two or more spend exactly one. A world that lists no concepts therefore generates exactly what it did before the library existed.

## The fallback

A refusal is a value. When `selectRealisation` returns null — the entry declares nothing, the concept is not offered, or no placement's needs equal the rule — the caller does what it does today (for a procedural substrate, the generic `logic_gate` carrying the rule as its `clear_rule`).

## The maze's realisations

The maze (`mazeRoom/mazeConcepts.js`) realises `sword` and `swim` as pickups (tier `mechanic`) and `guardian` and `water` as gates that need the sword and swim (tier `skin`). Its placer asks `selectRealisation` about every gate rule with the world's `params.concepts` as `offered`; a selected rule is placed as `guardian_gate_<n>` or `water_gate_<n>` over the same rule gate, with the same `clear_rule`, and painted in the colour and symbol from the realisation's `art` (the table gives `guardian` and `water` no presentation). The maze declares no `libraryItems`: top-down grants every in-mix substrate's library items as free starting items, so a static declaration would change every top-down world. Instead, an item concept the world names joins that world's item library as the table's rows (`presetRun.mergedItemLib`).

## The text adventure

A text-adventure gate has no geometry: the bridge refuses the move while the exit's rule fails, so the realisation is the prose the player reads. `sword`, `swim`, `guardian.gate` and `water.gate` are all `tier: 'mechanic'`. When the planner's rule selects a gate, `placeFromRules` writes that gate's `blocked` and `passedWith` messages into the room's payload `prose`. See [Text Adventure Substrate](./text-adventure.md#concept-realisations).

## What the chart reads

`conceptsRealisedBy(entry, concepts)` lists an entry's realised concepts with their kind, tier and placements' effects, and `itemTagsImpliedBy(entry, concepts)` lists the item tags those concepts carry — the same tag law `substrateCapabilities.itemTagFeatures` applies to an entry's items. They are inputs for a future row of the substrate capability chart; no chart statement reads `conceptRealisations` yet.

## Related documentation

- [Paths and Obstacles](./paths-and-obstacles.md) — the shared item/obstacle vocabulary and the rule → requirement extractor
- [Substrate Registry Reference](./substrate-registry.md) — where a substrate's half will live
- [Procgen Gotchas and Disambiguations](./gotchas.md)
