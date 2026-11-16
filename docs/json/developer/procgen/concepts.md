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

Every reader of a substrate's half takes **either** the registry entry **or** its realisations object (`realisationsOf` normalises both). A substrate's placer lives in a module its own entry imports, so it cannot hand over the entry; it hands over the data module the entry declares, as the maze and the text adventure do.

`assertConceptTable` checks the neutral half and `assertRealisations(entry, concepts)` checks a substrate's half. A malformed declaration throws a `ConceptContractError` naming what is wrong. A substrate that declares no realisations, or does not realise a given concept, is not an error.

### Parameterised concepts

A concept can take parameters in the same schema language templates and skeleton kinds use (`templateContract.assertParamSchema`: `[{key, domain, default, why}]`). Each value combination is an **instance** (`instancesOf`), with its own id from `idFor(values)` and its own row in `presentation`. The `key` and `door` concepts take a `colour`; `itemRowsOf(CONCEPTS.key)` and `obstacleRowsOf(CONCEPTS.door, CONCEPTS)` render their instances in the shared library's row shape, and a test holds those rows equal to the shared library's coloured keys and doors (see [Paths and Obstacles](./paths-and-obstacles.md#the-vocabulary-frontendmodulessharedprocgenlibraryjs)). A door's clear set comes from its `openedBy` relation: the key instance with the door's own colour.

### Item concepts

The unparameterised item concepts (`sword`, `swim`) carry the `feature` `concept_items` (`CONCEPT_ITEMS_FEATURE`), so `itemTagsImpliedBy` names it. `itemIdOfNeed(conceptId)` gives the AP item name a need carries, and `conceptOfItem(apName)` is its reverse: `conceptOfItem('Progressive Sword')` is `sword`. Both answer only for an unparameterised item concept; `key_red` is an instance of `key`, never "the key".

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
- `entry` below is a registry entry or its realisations object (see [The two halves](#the-two-halves)).
- `candidatesFor(rule, entry, {concepts, offered})` returns the entry's `requires` placements whose needs equal the rule's **exact** requirement — the same item names and the same counts. A rule the extractor reports as inexact (an `Or`, a many-item `HasAny`) has no candidates: no single placement is equivalent to a disjunction. Only concepts in `offered`, the world's list of concept ids, are considered.
- `selectRealisation(rule, entry, {concepts, offered, rng})` returns null, the single candidate, or one `rng.choice` among several.
- `decorationsFor(entry, {offered})` returns the `helps` and `none` placements. No rule ever selects them, because they change no reachability the planner fixed.

**The draw budget.** An empty or absent `offered` list returns no candidate and spends no draw; zero or one candidate spends no draw; two or more spend exactly one. A world that lists no concepts therefore generates exactly what it did before the library existed.

## The fallback

A refusal is a value. When `selectRealisation` returns null — the entry declares nothing, the concept is not offered, or no placement's needs equal the rule — the caller does what it does today (for a procedural substrate, the generic `logic_gate` carrying the rule as its `clear_rule`).

## The maze's realisations

The maze (`mazeRoom/mazeConcepts.js`) realises `sword` and `swim` as pickups (tier `mechanic`) and `guardian` and `water` as gates that need the sword and swim (tier `skin`). Its placer asks `selectRealisation` about every gate rule with the world's `params.concepts` as `offered`; a selected rule is placed as `guardian_gate_<n>` or `water_gate_<n>` over the same rule gate, with the same `clear_rule`, and painted in the colour and symbol the maze's content set gives it (the table gives `guardian` and `water` no presentation; until content sets R2 they were the realisation's `art`, and now they are the maze's default pack's: [Maze § Content roles](./maze.md#content-roles)). The maze declares no `libraryItems`: top-down grants every in-mix substrate's library items as free starting items, so a static declaration would change every top-down world. Instead, an item concept the world names joins that world's item library as the table's rows (`presetRun.mergedItemLib`).

Those rows are **marked** with the concept they came from (`markConceptRow` adds `concept: '<id>'`; `isConceptRow` reads it), and a marked row does two things:

- **It reaches play.** The maze's serializer writes a region's `itemLib` as the difference from its base library, and in the pipeline the base *is* the merged library, so a concept row used to be dropped and play drew the pickup in the hashed foreign colour. The serializer now carries a marked row even when the base holds its id, so the played world draws the table's colour. No library declares a marked row, so a world that names no concept writes exactly the payload it did.
- **The pipeline's item picker groups it** under the selected substrates that realise its concept. No substrate has to list `concept_items` in `supportedFeatures` for that.

## The text adventure

A text-adventure gate has no geometry: the bridge refuses the move while the exit's rule fails, so the realisation is the prose the player reads. `sword`, `swim`, `guardian.gate` and `water.gate` are all `tier: 'mechanic'`. When the planner's rule selects a gate, `placeFromRules` writes that gate's `blocked` and `passedWith` messages into the room's payload `prose`. The words come from the world's content set: the text adventure's default content pack (`frontend/packs/text-adventure/`) presents each of the four concepts, and a later pack in the stack that presents one wins. See [Text Adventure Substrate](./text-adventure.md#concept-realisations).

## A rebuilt world keeps its concepts

A sphere-growth or top-down compile records the world's concept list in its slot's `procgen_metadata` block as `concepts`, and only when the list is non-empty. `rebuildEnvelopeFromRulesJson` reads it back into `regionParams.concepts`; a caller that passes its own `regionParams.concepts` wins.

A plain rebuild never needed this, because it deserializes every placed region from its payload and so keeps the skinned gates and the prose. What needed it is every region an **append** realises: the appended sphere, and the kept region that now carries its gate. Those regions were placed with no concept, so they got plain `logic_gate`s and no prose. A world that names no concept records nothing and rebuilds as before.

## The trial world

`concept_trial` (`frontend/presets/concept_trial/`, the state `CONCEPT_TRIAL_STATE`, the drop-down's *Concept trial (maze + text adventure)*) is the first committed world that names concepts. It is a sphere-growth world at seed 8 over the sword, the swim and victory, with the concept list `[sword, guardian, swim, water]`. It has three regions: a text-adventure START holding the sword, a maze holding the swim, and a second maze holding victory.

| concept | substrate | placement | effect | what the player sees |
|---|---|---|---|---|
| `guardian` | text adventure | `gate` on the START's exit into the maze (`Has(Progressive Sword)`) | `requires` sword | the guardian's *blocked* prose on a refused move, its *passed-with* prose on the move once the sword is held |
| `sword` | text adventure | the START's location | item | the sword's check prose when the location is searched |
| `water` | maze | `gate` on the maze's exit into the victory maze (`Has(Progressive Swim)`) | `requires` swim | `water_gate_0`, painted in the realisation's blue with `~`; dimmed once cleared |
| `swim` | maze | a pickup in the maze | item | the pickup in the table's colour (`#40b0c0`; the sword's is `#c0a040`) |

**The compiled logic equals the control's**: the same state with `concepts: []` compiles to the same `rules.json` apart from the sidecars and `procgen_metadata[slot].concepts` (pinned in `procgenPipeline/conceptTrialWorld.test.js`, *the compiled logic is the control's*).

Two measurements shaped the world:

- **The start is a text-adventure room.** When the world was built, a text-adventure room's payload recorded only its forward exits' gates (`exitGates`), while sphere growth gates the back-exit of every region behind a gate with the same rule. So any text-adventure room behind a gate failed the rule-agreement layer of `check-sidecar-fields.mjs`. This held for the concept-less control and for the shipped text-adventure sphere presets too; none of them had been committed. With a maze start, none of the 99 worlds measured (seeds 1–12 over 30 configurations) that realise one gate per substrate passed. With a text-adventure start, seeds 8 and 9 were the first to pass. Concept library T2c has since closed that gap: the payload now carries gated back-exits. A maze-start trial world (seed 1) now passes and could be committed. `concept_trial` stays the text-adventure-start world it is.
- **The start room's prose needs the iframe's replay.** A text-adventure START's `loadRegion` is published before the wrapper's iframe bridge subscribes. The `text_adventure` entry now declares `iframeId`, so `procgenPlayer` re-publishes it when the iframe is ready. Without it, the player read the generic *You can't go that way* at the guardian.

- **Unknown accessibility is shut.** The wrapper builds its world from static data, which can reach the iframe before the state snapshot does (the snapshot is a `pingWorker` round trip). The engine seeds every exit as accessible, and the bridge used to skip the evaluation until the snapshot came. So for 10–50 ms the guarded exit painted open, and could be clicked, with no sword held. That was the gate's Phase A flake: 5 of ~145 CI runs. `roomAccessibility.js` now reports every exit and location inaccessible until there is a snapshot to evaluate against. The gate's Phase A0 forces that ordering by holding the iframe's snapshot back.

- **A rule that throws is passable, and marked.** That is a different question from unknown state. When an exit's or location's rule hits an error, `roomAccessibility.js` still reports it accessible, so the player is never softlocked. That holds for either rule format, top-level or nested: the engine catches the error and reports it through the context hook `onRuleError`, which the wrapper passes in. The message goes into the result's `ruleErrors` and is logged with `console.error` once per evaluation pass, naming the room, the exit or location, and the message. The bridge's `ruleErrorMarker.js` re-applies the class `tae-link-rule-error` after every engine render: a wavy amber underline, with a `title` tooltip naming the error. The link keeps its `tae-link-accessible` colour.

`check-concept-trial-play.mjs` plays the world from a fresh page load: the guardian's prose, the sword, the maze's gate read closed by the renderer's clearance and by `whyBlocked`, the swim, the gate read cleared, victory, and world completion. The in-app row `concept-trial-plays` asserts the maze world's gate definition and colours, and the guardian's two messages.

## What the chart reads

Statement **P6** of the substrate capability chart, *"It can show the library's concepts in its own way"* (⚖ the user, 2026-09-29), reads `conceptRealisations` through `conceptsRealisedBy(entry, concepts)`:

- ✗ where the entry realises no concept;
- otherwise ✓, with each concept as `name (tier)` in the entry's declared order: the count, the first three names, and the whole list in the cell's `list`.

The maze's cell reads *4 concepts: sword (mechanic), swim (mechanic), guardian (skin), …*.

`itemTagsImpliedBy(entry, concepts)` lists the item tags an entry's concepts carry, by the same tag law `substrateCapabilities.itemTagFeatures` applies to an entry's items.

## Content roles

`conceptRealisations` names, by id, the mechanic concepts a substrate realises. It cannot name a character that a content pack brings. So a registry entry may also declare **roles** in `contentRoles`: the kinds of content it can show, and the fields each kind needs. A pack concept (the `concepts` layer of a content pack, read by `frontend/modules/packConcepts/packConcepts.js`) fills any role whose needs it supplies. The code is `frontend/modules/procgenCore/contentRoles.js`, and it too is browser-safe and names no substrate.

```js
contentRoles: {
    gate:      { accepts: { presents: ['guardian', 'water'] }, needs: { look: true, text: ['blocked', 'passedWith'] },
                 why: 'a planned gate, shown as the concept the rule selected' },
    character: { accepts: { kinds: ['character'] }, needs: { text: ['greeting'] }, why: 'someone to meet in a room' },
    info:      { accepts: { kinds: ['info'] }, needs: { text: ['body'] }, why: 'a piece of information held at a location' },
}
```

- `accepts` is exactly one of two forms. `kinds` is a non-empty list of pack-concept kinds (`character`, `place`, `object`, `info`, and since content packs PL-1 `task`, `stat`, `resource` and `boon`; the pack layer owns that list). `presents` is a list of mechanic concept ids. Each must be in the concept table **and** realised by the same entry's `conceptRealisations`, because a role that shows a concept the entry cannot realise is a role nothing selects.
- `needs` is optional. It may ask for `look` (a colour and a symbol, both required by the pack layer), `art` (an art-library key), and `text`, a list of text slots. Every pack concept has a `name`, so a role never lists it, and listing it is refused.
- `why` is required.

A role is presentation only. A pack concept that presents `guardian` fills a gate role's presentation; the gate's logic is still the realisation's `effect` and `needs`.

The readers:

- `assertContentRoles(entry, concepts)` checks an entry's roles. It throws a `ConceptContractError` naming the entry, the role and what is wrong. An entry with no `contentRoles` is not an error.
- `contentRolesOf(entryOrRoles)` takes an entry or its roles object, as `realisationsOf` does.
- `roleRefusal(role, packConcept)` is `null` when the concept fills the role. Otherwise it is a sentence naming the first thing missing, in this order: the wrong kind (or not presenting an accepted concept), no `look`, no `art`, then each text slot in the role's order. A text slot is checked for presence on the concept. Whether its key resolves in a text library is for `resolveRole`, which holds the stack.
- **A concept that `presents` a mechanic never fills a kind role** (content sets S1). It is that mechanic's look, not scenery: a role that `accepts.kinds` refuses it, right after the kind check. So the text adventure's default guardian (kind `character`) is never a bystander in a room, and a theme that wants water as a gate and as a room writes two concepts, of which only the gate one declares `presents`. The pack layer's rule that one pack presents a mechanic from at most one concept is unchanged.
- `candidatesForRole(entryOrRoles, roleId, packConcepts)` lists the keys of the pack concepts that fill one role, in the library's order. An undeclared role is refused by name.
- `resolveRole(entryOrRoles, roleId, contentSet, {presents?, variant?})` is the one shared resolver a consumer asks (content sets S1): the role's candidates in a content set, latest pack in the stack first (the library's order within one pack), each as `{key, concept, text}` with every text slot the role needs resolved through the set's text library. A candidate whose key does not resolve is left out, so it falls through to an earlier pack. `presents` narrows to the concepts presenting one mechanic. The text adventure's gate, item, place, character, object and info roles all read through it, and since S2 the maze's.
- **`variant`** (content sets S2, ⚖ the user, 2026-11-14): with a variant (the consumer's substrate id), each needed slot's key is asked first as `<key>/<variant>` (`textVariantKey`), then as `<key>`. A pack writes one line for every substrate and, beside it, the line one substrate needs where the shared one would be untrue there. The `meta` characters' shared lines name a room's place, which a maze region does not have, so the pack also carries `meta:character/narrator/says/maze` and `…/placeholder/says/maze`. (A text key may not hold `@`: the pack layer's key pattern.)
- `assertPresents(packConcepts, concepts)` checks that every `presents` in a stack names a concept in the table. The pack layer leaves `presents` opaque on purpose; this is the cross-check. A namespaced `presents` (a structure id, see [What exists, the numbers and the bindings](#what-exists-the-numbers-and-the-bindings)) is skipped here: the words never load the structure layer, so `packStructure.assertPresentsStructure` checks it where both are loaded.
- `rolesFilledBy(entryOrRoles, packConcepts)` returns `[{role, concepts}]` in the entry's declared order. It is the input a later chart statement will read. No statement reads it yet.

The text adventure is the first substrate to declare roles: `gate` and `item` (`accepts: {presents}`, the prose slots of a selected gate and of a found item), `place` (`accepts: {kinds: ['place']}`, a room's name and description), and since S1 `character` (text `says`), `object` and `info` (text `body`), the room's things that are not AP checks. See [Text Adventure Substrate](./text-adventure.md#content-roles). The maze declares `gate` and `item`, and since S2 `character` (a `look` and text `says`), `object` (a `look`) and `info` (text `body`), a region's thing on a floor cell; see [Maze Substrate § Things](./maze.md#things-a-character-an-object-or-a-sign-on-a-floor-cell).

## A world's content stack

A world names the content packs it draws its characters, places, objects and text from in `params.content`: a list of pack ids (`frontend/packs/`), empty by default, beside `params.concepts`. The code is `frontend/modules/procgenPipeline/worldContent.js`.

- **The effective stack.** `effectiveContentStack` is the one rule. It starts with the `defaultContentPack` of each substrate in the world's mix, in registry order and without duplicates, and then adds `params.content` in order. A later pack wins per key. The text adventure declares the default pack `text-adventure` and the maze declares `maze`, so every world with a region of either has that pack at the bottom of its stack. See [Substrate Registry](./substrate-registry.md).
- **The load.** Text, names and colours resolve at generation and are written into the world document. So the stack is loaded once, before generation: `loadContentSet(stack, {base, readJson})` returns a frozen **content set**, `{ids, concepts, text}`, where `concepts` and `text` are the pack-concept and text-library readers. `assertPresents` runs on it first. An empty stack returns the empty set and never calls `readJson`. In the browser the panel reads with `fetch`; in node, `contentPacks/nodePackIo.js` reads the committed packs from disk.
- **The channel.** The set reaches every region's `generateRegionCore` and `placeFromRules` as `params.contentSet`, on the same channel as `params.concepts` (`assembleRegionParams`). With it comes the world's own list as `params.content`. Both are added only when the stack is not empty. An entry point that builds a run without loading a non-empty stack is refused by name, and so is a region whose packs are not in the set it was handed.
- **The entry points.** `prepareRunFromState` is the async form of `buildRunFromState`: it loads the set and then builds the run. The pipeline panel loads the set before Generate, before each *Run next step* and before Append. `sphere-step`, `topdown-step` and `spiral-step` load it as well, and `--param content=a,b` names a world's own stack. `spiral-step` reads no other `--param` key.
- **The preload.** A builder that cannot await (`buildRunFromState`, the engine's growers, the APWorld editor's regenerate, a fixed-config check script) gets the default packs from a process-level cache. `preloadDefaultContent({base, readJson})` loads the `concepts` and `text` layers of every default pack the registered entries declare, once; a pack already loaded is not read again, and with no entry declaring one it reads nothing. When the effective stack is made only of default packs and no set was handed in, `assembleRegionParams` and the region seam build the set from the cache (`defaultContentSetOf`). It equals the set `loadContentSet` would load, and a default pack that was not preloaded is refused by name, telling the caller to preload. A stack that names `params.content` still needs the awaited load.
- **Who preloads.** Every process that builds worlds calls it once, after its substrate libraries register:
  - the app's boot (`app/initialization/index.js`, after the modules register and before anything can generate, and again after a module registers later). Both `init.js` and the bundled `init-bundled.js` run this boot;
  - the APWorld editor's regenerate worker, which has its own registry;
  - a `setupFiles` hook in every vitest config (`scripts/test/vitestDefaultContentSetup.js`). It runs in each test file's module graph before the file's imports, so before its substrates have registered. So it preloads every committed pack (`packs.json`, through the `ids` option), which includes any default pack, and a world built while the file is being collected finds them too. A test that calls `vi.resetModules()` gets a fresh module graph, and so an empty cache, and preloads again in it;
  - the pipeline drivers, through `loadPipelineSubstrates()`. Any other script that registers its own libraries calls `preloadScriptContent()` (`scripts/procgen/preloadContent.js`) on the line after.
- **The APWorld editor.** A regenerate runs in a worker, and `postMessage` cannot clone a set, so `composeRegenerateArgs` sends none (`DEFER_CONTENT_SET`). The job attaches it where it runs (`attachJobContent`): the world's own list is `regionParams.content`, or else the document's `procgen_metadata[p].content`. `regenerateRegionEntry` also reads the document's list. So a regenerate op replayed synchronously, with no result inlined, on a document that names content is refused by name. It does not place without the set.
- **The record.** Every compile records `params.content` in the slot's `procgen_metadata` block as `content`, and only when the list is not empty. That covers sphere growth, top-down, the shuffled spiral and grid growth. Sphere growth and top-down write it beside `concepts`. The default packs are not recorded, because they follow from the mix. `rebuildEnvelopeFromRulesJson` reads the list back into `regionParams.content`, and a caller's own value wins.
- **The set is runtime state.** The set holds functions, so `JSON.stringify` leaves it out, and `serializeEnvelope` drops it too, because an in-process caller (`runPipeline`) clones what it returns: a saved envelope keeps the list and drops the set. A rebuilt or resumed envelope gets its set back from `attachEnvelopeContent` before it generates. An append from a rebuilt world that was not re-attached is refused at the region seam.
- **What exists, the numbers, and the numbers switch** (content packs PL-1). Three more settings sit beside `content` in `params`, in `regionParams` and in `procgen_metadata[p]`, each written only when it is not the default, so no existing world moves. `exists` is a list of pack ids whose `structure` entries are added together; its default is the mix's default packs (the ones `effectiveContentStack` puts first), and a list equal to that default is not recorded. `numbers` is a stack of pack ids; under ruling Z7 a numbers set holds only DEFAULTS, which a substrate's playthrough walk may assign over. `numbersMode` is `assign` or `table` (ruling Z8). ⛔ An absent `numbersMode` always means `table`, so a document never changes meaning when a later slice declares a walk. A world generated in `assign` mode records `assign`: its own `params.numbersMode`, or else `assign` when every substrate in its mix declares `numbersWalk: true` on its registry entry. No entry declares it yet. `rebuildRegionParams` reads all three back, validated by name. A numbers pack with no set for the world's substrate over the world's `exists` is refused by name before anything is built (`assertWorldNumbers`, in `prepareRunFromState`, `sphere-step`, `topdown-step` and the pipeline panel). Nothing reads these settings to build a region yet: the resolver is the next slice. `procgenPipeline/worldSettings.test.js` holds the record, the read-back and the refusals on the concept trial world.
- **Art at play.** The world's stack also carries art, which is never baked. The maze loads the `art` layer of the same effective stack when it draws a world and takes its tiles from it by key, falling back to its own colours; see [Maze: Tile art from a content pack](./maze.md#tile-art-from-a-content-pack-mazetileartjs).

A world that names no content compiles to the bytes it did before the param existed: its text-adventure prose comes from the default pack, which holds the strings the substrate wrote from code before. With a stack, it compiles to the same logic; what a later pack presents (a gate's prose, a room's place) is the only other difference. `procgenPipeline/worldContent.test.js` holds the first on the concept trial world, and `textAdventureSubstrateWrapper/textAdventureContent.test.js` the second.

## What exists, the numbers and the bindings

Content packs PL-1 added three pack layers for the shared task shape, which the user ruled on 2026-11-15 (Z1–Z6, then Z7 and Z8). The code is `frontend/modules/packStructure/`. All three carry LOGIC, so the words setting never reads them: a content set loads `concepts` and `text` only (`worldContent.CONTENT_LAYERS`), and `contentPacks.LOGIC_LAYERS` names the three.

| Layer | Holds | Reader |
|---|---|---|
| `structure` | what EXISTS: entries of kind `task`, `stat`, `resource`, `boon` and `place`, as ids and links only (no number, no name, no native id) | `createStructure(stack)` |
| `numbers` | magnitudes, keyed by structure id and value path, one set per game (the `sets` key is a substrate id, its `exists` the pack it prices). Under Z7 these are DEFAULTS | `createNumbers(stack)` |
| `bindings` | per game, keyed by structure id: what only that game needs (JtA's slot numbers, omsi's multipart segments, a native effect) | `createBindings(stack)` |

A structure key is `<pack>:<kind>/<slug>`, and its namespace must be its pack's id, so packs added together cannot collide. A task has a `place` (optional), a `time` (the clock resource), `requires` (a list of SETS: any one set, all of its members, each `{stat}` or `{resource, consume?}`), `results` (each one of `{stat}`, `{resource, sign}`, `{boon}`, `{opens}`, with `when`: `each`, `last` or `every_nth`), a `limit` (`true`, or `{grows_with: <stat>}`), `after` (sets of task ids) and free `tags`. A stat may have an `owner` and `max: true`; a stat, resource or boon may say which task part it `modifies` (`time`, `limit`, `results.<id>`, `requires.<id>`; `entry: "*"` for every task that has the part; `lasts`: `loop` or `always`). Every id an entry names must be an entry of the stack, of the right kind. A malformed entry is refused by name: the pack, the key and the field.

A numbers value path is a part name, optionally followed by an id and a field: `time`, `limit`, `max`, `requires.<id>.<field>`, `results.<id>`, `modifies.<part>`. A value is a number or a small object of numbers in the game's own units. `numbersSelectionRefusal(loadedPack, {substrateIds, exists})` is the sentence that refuses a numbers pack for another game or another "what exists".

**The words present a structure entry.** A pack concept's `presents` takes two forms. A bare id (`guardian`) names a mechanic concept, as before. A namespaced id (`omsi:task/pick-locks`) names a structure entry, and the concept's kind must be the entry's kind. The one-presenter-per-pack rule and latest-pack-wins hold for both, so a theme renames a task by presenting it later in the words stack. `packStructure/packStructure.test.js` reads fixture packs from disk (`fixtures/packs/`) built from the Z write-up's examples, with all six of the task-parts trial's additions (C1–C6) present.

## Provenance

Every layer manifest of every pack names where its entries came from (content packs PL-1, Z.7; the user, 2026-11-15: *"I'll want the concept library, and also the other libraries, to track the source of their contents. For example, which game the data came from, which user contributed an image, or which Claude model generated original data."*). The code is `frontend/modules/contentPacks/provenance.js`.

```jsonc
"provenance": {
  "sources": {
    "seedling": { "type": "game", "name": "Seedling", "repo": "PeerInfinity/Seedling", "commit": "<pinned>",
                  "files": ["assets/graphics"], "extracted_by": "scripts/procgen/extract-seedling-art-packs.mjs --check" },
    "font":     { "type": "model", "model": "claude-opus-5-5", "date": "2026-10-21", "note": "…" }
  },
  "default": "seedling",
  "groups":  { "seedling:font/": "font" }
}
```

- **Five source types**, each with its required fields: `game` (`name`; `repo` and `commit`, or a `path` in this repository), `person` (`name`), `model` (`model`, the exact id or the literal `unrecorded` with a `family`; `date`), `authored` (`by`), and `derived` (`from`, source ids or entry keys; `by`, a rule id with its version such as `R1@1`, or a script path). `approved` (`{by, date}`), `licence` and `note` are optional on any source.
- **Resolution.** An entry's source is its own `src`, else the longest `groups` prefix of its key, else `default`. A text layer's rows are plain strings, so a per-entry source there is a group whose prefix is the whole key.
- **The loader checks it.** `loadPackStack` runs `checkLayerProvenance` on every layer it reads. A layer with no block, or a `default`, `src` or group naming an unlisted source, or a source missing its type's fields, is refused by pack, layer and key, for every consumer at once. A `person` or a `model` is a declaration: its presence and form are checked, and nothing more can be. A `game` source's `extracted_by` names the script whose `--check` compares the pack with the game's files. `contentPacks/provenance.test.js` holds that each such script parses `--check` and has its own CI test beside it.
- **The report.** `node scripts/procgen/report-pack-provenance.mjs` prints, per pack and layer, the entries per source (`--json` for the data).
- **A world document carries no per-entry provenance.** It records its pack ids, and the source of anything in it is looked up through the packs. `provenance.test.js` holds that no committed `rules.json` carries a source note or a model id.

The generated packs (`seedling`, `archipelago`) are written by their extractors (`scripts/procgen/seedlingPackProvenance.js`), so a regenerated manifest carries the block and `--check` holds it. The hand-made packs (`maze`, `text-adventure`, `meta`) record the model their files' commit trailers name, and `approved` only where the plan log records the user's approval. Test fixtures that build packs in memory wrap their `readJson` in `contentPacks/testing/fixtureProvenance.js`.

## Selecting a content set

The Procgen Pipeline panel's Parameters section has a **Content set** row, after the concepts row. It shows one checkbox per theme a world may add: every pack that a stack in `packs.json`'s `content` table names, in the order the table first names it. A substrate's default pack is never offered, because it is always in the stack (`selectableContentPacks` in `worldContent.js`). The row reads *built-in →* and then the themes, which is the stack order: a later pack wins where two present the same thing. Ticking a box writes the ticked ids to `params.content` in that order (`pickedContentList`); a pack the world names but this page does not offer is kept, in front. With nothing ticked the world is built from the default packs only, as before. The list persists with the panel's other params and in a saved preset. Generate loads the stack before it builds, so a ticked theme's names and words are written into the world.

To add a theme: make its pack under `frontend/packs/`, list it in `packs.json`'s `packs`, and name it in a `content` stack. The row offers it with no code change.

## The theme trial world

`meta_trial` (`frontend/presets/meta_trial/`, the state `META_TRIAL_STATE`, the drop-down's *Meta theme trial (maze + text adventure)*) is `concept_trial` with `content: ['meta']`. The pack `frontend/packs/meta/` is a theme in which the world knows it is a generated game. It presents the guardian as **the Gate**, which states its own rule (its lines say `{item}`, filled at generation with the item the rule asks for), gives the sword's and the swim's checks a line that knows they are checks, and offers `place` concepts for the text adventure's rooms. Since content sets S1 it also offers two characters, **the Narrator** and **the Placeholder**, and pieces of information (`info`) for a room's things; `meta_trial`'s text-adventure room holds one of each, a character carrying a note. It does not present water. Since content sets S2 each of `meta_trial`'s maze regions holds a thing too (a character in its own shape art, carrying a note). Since content sets R4 it also draws the maze: its `art` layer is shape recipes for all the maze tile-art keys (no image file; [maze.md § Tile art](maze.md#tile-art-from-a-content-pack-mazetileartjs) has the worked example). Art resolves by key at play, so the committed `meta_trial` bytes did not change; the maze regions of any world that selects `meta` are drawn as a diagram, with paper floors, hatched walls and an orange player marker.

| what | text adventure | maze |
|---|---|---|
| the sword gate (`guardian`) | the Gate's *blocked* and *passed-with* lines | not in this world (the maze's gate here is water) |
| the sword's check | the theme's check line | (no item look in the theme: the default) |
| a room | a theme place's name (the room's title) and description (the arrival line) | (the maze has no `place` role) |
| a room's thing | a theme character carrying a theme note (look-only; examine shows its lines) | the same, on a floor cell of each maze region (S2): the theme's character in its baked look or its shape art, its maze line (`<key>/maze`), carrying a theme note; read by walking onto it |
| the swim gate (`water`) | — | the maze default pack's `Water`, `#2f6fd0`, `~`: the fall-through |
| the maze's tiles and things | — | the theme's shape art (floor, wall, exit, entrance, mana, player, trap, the block kinds, button up/down, pulser, pull); a closed exit and the state signals stay the maze's own |

**The compiled logic equals the control's.** `procgenPipeline/metaTrialWorld.test.js` builds the world beside `concept_trial` and pins that the document minus the text adventure's `prose` and `things`, the maze regions' `things` and `procgen_metadata[p].content` is the control's, that every maze payload (the water gate among them) is the control's byte for byte but its `things`, and that the committed preset is a fresh build. The Gate's maze look (`#a0a8b8`, `#`) is not on screen in this world; the same test pins it on the maze-only concept world (seed 1, `startSubstrate: maze`, 3 spheres, no filler, quota maze 99, concepts `sword, guardian, swim, water`, items Progressive Sword, Progressive Swim and victory). Generate that world in the panel with `meta` ticked to see the Gate drawn in a maze. The in-app row `meta-trial-plays` plays `meta_trial`: a place's title and arrival line, the Gate's two lines, and the water gate equal to the maze default pack's. The in-app row `meta-trial-maze-tile-art` stands in `meta_trial`'s maze and reads the theme's art off the canvas: the floor, wall and player drawn from `meta#<key>` sheets, a floor pixel in the recipe's colour, and the water gate still in the default pack's colour. The in-app row `maze-thing-shows-text` (content sets S2) walks onto a maze region's thing in `meta_trial`: its lines shown, `content:thingExamined` published, the player walks on, nothing checked.

**It is played in CI.** `check-meta-trial-play.mjs` is `check-concept-trial-play.mjs` run on `meta_trial` under its own key, `gate: meta-trial-play`: every expectation is read off that preset, so the guardian's lines it waits for are the Gate's. A roster `@standing-variant` would not do, because a declared arm runs locally only.

## Behaviour

A concept can also say how it **behaves**: what an item hits with, how an enemy answers a hit, what makes an obstacle give way, and what a substrate's realisation of it does. Every behaviour field is optional, and a concept without one is exactly the concept it was before.

### Three domain forms, one draw law

A parameter, wherever it is declared (a template, an element, a skeleton kind, a concept's `params` or `traits`, a behaviour block's fields), declares exactly one of three forms, checked by `templateContract.assertParamSchema`:

| Form | Example | Drawn and swept? |
|---|---|---|
| `domain: [...]` | `{ key: 'len', domain: [2, 3, 4], default: 2, why }` | yes |
| `range: {min, max, step?}` | `{ key: 'speed', range: { min: 0, max: 1 }, default: 0, why }` | only with a `step` that divides `max − min` |
| `open: 'string'` or `open: {id}` | `{ key: 'category', open: { id: 'weaponCategories' }, default: 'sword', why }` | never |

`default` must be in the list, within the range (and on a step when stepped), or a string for `open`. `why` is required.

**A parameter the generator draws must be a list or a stepped range.** `defineTemplate` asks this of every parameter (`assertDrawable`), so a template that declares an `open` or unstepped parameter is refused by name when it is defined. A stepped range spends the same one draw a list of the same values spends. `domainKind(p)`, `enumerableValues(p)` (the list itself, the stepped range expanded, or `null`) and `valueInDomain(p, v)` are what every reader of a domain goes through.

### The four registries

`procgenCore/behaviourBlocks.js` holds four open vocabularies. Each is a registry made by `createRegistry(name)`, and an id is **declared where it is introduced** (`declare(id, {why, ...})`) and **checked by cross-reference** wherever it is used:

- `BLOCKS`: what a thing does. Each block has a `family` (`movement`, `attack`, `defence` or `trigger`, the closed `BLOCK_FAMILIES`) and `fields` in the schema language above; `chase` has a `speed` range and a `range` range, `emitter` an `aim` list, an `interval` range and an open `projectile`.
- `WEAPON_CATEGORIES`: what an item hits with (`sword`, `fire`, …), after Seedling's hit categories.
- `DEFENCE_RESPONSES`: what a defender does when hit (`damage` with a `factor`, `breakIfLevel` with a `level`, `ignore`, …), after Seedling's `Enemy.hit` flags.
- `TILE_TRIGGERS`: what makes a tile-like obstacle give way (`itemCategory`, `level`, `counter`, `channel`).

The module declares a starter set in each. A later slice declares its own ids beside them; nothing branches on a starter id. `declare` refuses a duplicate id, a missing `why` and a non-string id.

### The concept fields

```js
sword:    { kind: 'item', /* … */ weaponCategories: ['sword'] },
guardian: { kind: 'enemy', /* … */
    defence: { sword: 'damage' },   // or { sword: { response: 'damage', factor: 2 } }
    traits: [{ key: 'speed', range: { min: 0, max: 1 }, default: 0, why: '…' }] },
```

- `traits` (any concept): parameters in any of the three forms.
- `weaponCategories` (an item): declared weapon category ids.
- `defence` (an enemy, hazard or obstacle): a weapon category → a response id, or `{response, ...params}`. The category must be declared **and** produced by some item concept in the table; the response must be declared and its params valid.
- `triggers` (an obstacle or hazard): `[{kind, ...params}]`, the kind a declared tile trigger.

A realisation may carry `blocks`: each key a declared block, each field one the block declares, and each value either a literal valid for the field's form or `{trait: '<key>'}`, naming a trait the concept declares in a form the field can take.

```js
guardian: { tier: 'mechanic', placements: { /* … */ },
    blocks: { chase: { speed: { trait: 'speed' }, range: 6 }, contact: { damage: 1 } } },
```

`blocksImplementedBy(entry, concepts)` lists `[{concept, block, family}]` in the entry's declared order, as `conceptsRealisedBy` does for concepts. No chart statement reads it yet. The maze's and the text adventure's realisations implement no block: a skin shows a concept and does not behave as it.

Seedling's entities carry these blocks as labels in `seedlingDemo/entityBlocks.js`, which also says which blocks the Seedling solver models (see [The Seedling Solver's Surface § Which blocks the solver models](./seedling-solver-surface.md#which-blocks-the-solver-models)). `certifiableBlocks(realisation.blocks)` splits a realisation's blocks into the ones the solver models and the ones it does not, so whether a realisation can be certified is a lookup.

## Related documentation

- [Paths and Obstacles](./paths-and-obstacles.md) — the shared item/obstacle vocabulary and the rule → requirement extractor
- [Substrate Registry Reference](./substrate-registry.md) — where a substrate's half will live
- [Procgen Gotchas and Disambiguations](./gotchas.md)
