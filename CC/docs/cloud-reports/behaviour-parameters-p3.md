# Behaviour parameters — P3: the labels (cloud report)

**Slice:** `behaviour-parameters-p3` (plan `behaviour-parameters-plan.md` §3 P3, §7), an Opus build session in the cloud, a fan-out worker.
**Started from:** `origin/main` at `bc99136d59` (the expected SHA; the harness branch already sat on it). **Branch:** the harness's `claude/behaviour-parameters-p3-labels-w4gk1k`. The brief's `behaviour-parameters-p3` name was not used, because the harness pushes only to its own branch. **Head:** this report's commit, the last on that branch. Nothing was pushed to `main`.

**Verdict:** D1 PASS · D2 PASS · D3 PASS · D4 PASS. **Byte-neutral:** no record, simulation module, solver-family module, `procgenCore/` file, registry entry, preset, tape, wasm or AS3 file was edited. `entitiesMd5()` did not move.

**Commits:** `298897e` D1 · `58c1ce6` D2 · `9de08ba` D3 · `7e7c65e` D4 (docs, generated regions, link pins) · this report.

**The one thing to know first:** `blocksTheSolverModels()` counts only the live `run.entities` families. The `hazardVolume` arms are reported apart, as avoid volumes (`blocksOnlyAvoided()`: `beam`, `tether`). Counting a volume as "modelled" would have made `tether` certifiable because LavaChain has an avoid box. That would contradict the brief's own D3 expectation, and it would be false: a union over every phase lets a route stay out, but it says nothing about the behaviour inside.

## W0 — BEFORE and AFTER

| Gate | BEFORE (`bc99136`) | AFTER (`7e7c65e`) |
|---|---|---|
| bounded vitest, W0's 7 paths | **16 files / 1121 tests**, green | the same 7 paths + `entityBlocks.test.js`: **17 files / 1151**, green (+30, all mine; every other file's count unchanged) |
| `census-seedling-constants.mjs --check` | `4397 literals; green drift: 0 new + 0 vanished cosmetic/structural, 0 moved` / `PASS` | identical |
| `generate-procgen-reference.mjs --check` | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` | identical (after D4 regenerated README word count + `docsIndex.js`) |
| `generate-docs-index.mjs --check` | `OK: … is current (154 docs, 8 sections, 11 categories).` | identical |
| `check-procgen-docs.mjs` | — | `ALL CHECKS PASSED` |
| `md5sum frontend/presets/*/*/*_rules.json \| md5sum` (219 files) | `335a3aba7094b1b3be349e565eebff98` | `335a3aba7094b1b3be349e565eebff98` |
| `entitiesMd5()` / records | `b378bf423846d0232a518bfd94e1d0f9` / 23 | `b378bf423846d0232a518bfd94e1d0f9` / 23 |

No `pytest`, no unfiltered vitest (⚖ 52), no `npm test`. The suite number comes from CI at the pushed SHA.

## D1 — the labels (`298897e`): PASS

`frontend/modules/seedlingDemo/entityBlocks.js` provides:

- `ENTITY_BLOCKS`: 33 rows, one per `ENEMY_CLASSES` tag (24) and per `PUZZLEMENT_HAZARDS` tag (9). Each row is `{tag, source, as3, blocks, bespoke, unique, why, src, aggroNote?}`.
- `AGGRO_KIND_BLOCKS`: the 12 aggro words → the movement block each denotes (`null` for `boss` / `spawner`).
- `assertEntityBlocks(rows?, {enemies, hazards, aggro}?)`, run at load.

The module imports only `procgenCore/behaviourBlocks.js` and `./combat.js`. Its `src` cites the census row (`combat.js:<line>`) plus the AS3 lines each label was read from; I read `vendor/seedling/src` for every class whose label was not obvious from the census row.

**The unique rows** are exactly the classes whose aggro word maps to `null`: `shieldboss bosstotem lavaboss tentaclebeast finalboss lightbosscontroller` (6). The test derives that set rather than typing it.

**Tests** (`entityBlocks.test.js`, 13 at D1):

- coverage both ways, one row each;
- every id resolves, and no bespoke name is a declared id;
- the unique set;
- `AGGRO_KIND_BLOCKS` is total over the census words and names only movement blocks;
- movement ≡ aggro, or an `aggroNote` (only `iceturret` needs one: the corpse is `pushable`);
- frozen rows;
- the module is in neither closure (`importClosure([SIM_ENTRY])` and `importClosure(FAMILY_ENTRIES)`, imported from `seedlingSolverSurface.js`);
- its imports are exactly the two;
- **its importers are exactly its own test** (a scan of every tracked and untracked `.js/.mjs/.cjs/.html`);
- it loads in isolation (`node -e "import(…)"`).

| # | Mutant | Predicted | Measured |
|---|---|---|---|
| a | **source**: `bob.blocks` + `'orbit'` | the module refuses to load, naming `bob` and `orbit` | `EntityBlocksError: entityBlocks: row "bob" names the block "orbit", which behaviourBlocks.BLOCKS does not declare. …` |
| b | **source**: delete the `'static-tongue'` row | refused, naming the word and `lavatrap` | `EntityBlocksError: entityBlocks: the aggro word "static-tongue" (used by "lavatrap") has no AGGRO_KIND_BLOCKS row.` |
| a′, b′ | the same two, as test rows over doubles | red by name | green rows (both pinned) |

Each source mutant was a copy, an edit and a restore, checked with `cmp`. The tree was clean after each.

## D2 — the family → block map (`58c1ce6`): PASS

`FAMILY_BLOCKS` has 32 rows: the 23 `run.entities` families (spelled as strings, each citing its `levelRun.js:<line>` `<family>Now`) plus **9** `hazardVolume` arms keyed `volume:<tag>`. Each row is `{family, kind, blocks, solverReads, strategies, why}`.

**`solverReads`, measured two ways, which agree on file sets:**

- For an entity family, the `families` column of `seedling-solver-surface.json`'s `run:entities` row (the authority).
- A grep of `entities('<family>')` over the 11 family files gives the same file set for all 23. The raw counts differ on 5 families because the grep also sees comments and `until` predicates. For example, `openActivators` is `solverBot.js` 12 by grep against 10 in the table, and `chasers` is `solverBot.js` 9 against 5. The test pins the sets.
- Every one of the 23 families has at least one reader.
- For a volume, `solverReads` is the family files that call `hazardVolume(` (`dangerMap`, `encounters`; `hazards` defines it), minus `dangerMap` for the two tags `dangerMap.HAZARDS_PRICED_LIVE` excludes (`crusher`, `arrowtrap`). Those two are priced live through `crushers` / `armedArrowTraps`. The test parses both sources.

**`strategies`** are derived in the test from the live tag tables and `OBSTACLE_STRATEGIES`:

| Family | Tags held | Verbs |
|---|---|---|
| `openActivators` | `levelWorld.ACTIVATOR_RESPONDERS` | `hold keylock touch wand` |
| `pushables` | `levelWorld.PUSHABLE_FAMILIES` | `shove` |
| `openChests` | — | `chest` |
| `brokenRocks` | — | `break` |

`kill` (`magicallock`), `fight` (`shieldboss`) and `collect` (`pickup`) attach to no family.

**Other tests (9 at D2):**

- The entity rows equal `ENTITY_FAMILY_NAMES` and the table's `folded.entities`.
- The volume rows equal `hazardVolume`'s `case` arms, which equal `PUZZLEMENT_HAZARDS`.
- A family realises only blocks that some class it holds realises.
- The three derived lists partition `BLOCKS`.

**Mutant** (source): `chasers.solverReads` minus `dangerMap`. Predicted: exactly the surface-column row and the grep row go red, each naming `chasers`. Measured: `2 failed | 20 passed`, with `AssertionError: chasers: expected [ 'solverBot' ] to deeply equal [ 'dangerMap', 'solverBot' ]` and its mirror. Restored (`cmp`).

## The derived lists

**Modelled** (`blocksTheSolverModels()`, 11), with the live families behind each:

| Block | Families |
|---|---|
| `stationary` | `armedArrowTraps`, `armedPulsers`, `turrets` |
| `chase` | `chasers` (Bob today: `chasers.bridgedChaserTags()`) |
| `rebound` | `spinnerBodies` |
| `pushable` | `pushables`, `turrets`, `pushesSettled`, `turretsSettled` |
| `lane-charge` | `crushers`, `crushersParked` |
| `contact` | `crushers`, `spinnerBodies`, `chasers` |
| `emitter` | `armedArrowTraps`, `arrowsInFlight`, `turretDamage`, `arrowFlights` |
| `sweep` | `spinnerBodies` (`dangerMap.spinnerDanger`'s hammer) |
| `pulse` | `armedPulsers` |
| `hp` | `strikeBodies`, `spinnerBodies`, `turretDamage` |
| `channel` | `openActivators`, `armedArrowTraps`, `armedPulsers`, `latchedGroups` |

**Only avoided** (`blocksOnlyAvoided()`): `beam` (`volume:beamtower`) and `tether` (`volume:lavachain`).

**Not modelled** (`blocksNoFamilyModels()`, 23, which includes the two above): `patrol seek ballistic wall-launch tile-hop rise melee stomp explode beam tether matrix terrain onDeath proximity lineOfSight persistence onHit allEnemiesDead itemHeld schedule light facingAway`.

Of these, **no Seedling class realises** `patrol seek rise persistence onHit allEnemiesDead itemHeld facingAway` at all under my labels. They are starter ids with no transcribed source here.

### The family map (32 rows)

| Family | Blocks | Read by |
|---|---|---|
| `openActivators` | `channel` | `botDriverV2`, `solverBot` |
| `pushables` | `pushable` | `botDriverV2`, `solverBot` |
| `armedArrowTraps` | `stationary`, `emitter`, `channel` | `botDriverV2`, `dangerMap`, `solverBot` |
| `crushers` | `lane-charge`, `contact` | `botDriverV2`, `dangerMap` |
| `openChests` | — | `botDriverV2`, `solverBot` |
| `strikeBodies` | `hp` | `botDriverV2`, `solverBot` |
| `spinnerBodies` | `rebound`, `contact`, `sweep`, `hp` | `dangerMap`, `solverBot` |
| `armedPulsers` | `stationary`, `pulse`, `channel` | `botDriverV2`, `solverBot` |
| `turrets` | `stationary`, `pushable` | `botDriverV2` |
| `chasers` | `chase`, `contact` | `dangerMap`, `solverBot` |
| `brokenRocks` | — | `botDriverV2`, `solverBot` |
| `crushersParked` | `lane-charge` | `botDriverV2` |
| `pushesSettled` | `pushable` | `botDriverV2` |
| `openBridges` | — | `botDriverV2` |
| `arrowsInFlight` | `emitter` | `dangerMap`, `solverBot` |
| `burnedTrees` | — | `botDriverV2` |
| `latchedGroups` | `channel` | `solverBot` |
| `pulledRopes` | — | `botDriverV2` |
| `turretDamage` | `hp`, `emitter` | `botDriverV2` |
| `turretsSettled` | `pushable` | `botDriverV2` |
| `arrowFlights` | `emitter` | `dangerMap` |
| `bosses` | — | `botDriverV2` |
| `talkCircles` | — | `solverBot` |
| `volume:crusher` | `lane-charge`, `contact` | `encounters` |
| `volume:spinningaxe` | `stationary`, `sweep` | `dangerMap`, `encounters` |
| `volume:pulser` | `stationary`, `pulse` | `dangerMap`, `encounters` |
| `volume:arrowtrap` | `emitter` | `encounters` |
| `volume:beamtower` | `stationary`, `beam` | `dangerMap`, `encounters` |
| `volume:lavachain` | `stationary`, `tether` | `dangerMap`, `encounters` |
| `volume:whirlpool` | `stationary` | `dangerMap`, `encounters` |
| `volume:pull` | `stationary` | `dangerMap`, `encounters` |
| `volume:pod` | `stationary`, `contact` | `dangerMap`, `encounters` |

## D3 — certifiability as a lookup (`9de08ba`): PASS

`certifiableBlocks(realisation.blocks)` returns `{modelled, unmodelled, avoidedOnly}`. The lists keep the realisation's key order, and `avoidedOnly` is a subset of `unmodelled`. An undeclared id or a non-object is refused by name. There is no consumer: `conceptSelection.js` is untouched.

Tests (5) on test doubles:

| Realisation | Result |
|---|---|
| `{chase, contact}` | both modelled |
| `{tether}` | `unmodelled: [tether], avoidedOnly: [tether]` |
| `{rebound}` | modelled, through `spinnerBodies` |
| `{stomp, hp, beam}` | `modelled: [hp]`, `unmodelled: [stomp, beam]`, `avoidedOnly: [beam]` |
| `{orbit}`, `[…]`, `null` | refused |

**Mutant** (source): count an avoided-only block as modelled. Predicted: exactly the `tether` row and the mixed row go red. Measured: `2 failed | 25 passed`, those two. Restored.

## D4 — records (`7e7c65e`): PASS

`seedling-solver-surface.md` gains § *Which blocks the solver models*. It has the three tables in words, the family map as a table, and the three lists with families, and it states no counts.

**Pin, not generator:** the section is pinned by 3 rows in `entityBlocks.test.js`, which parse the table row for row against `FAMILY_BLOCKS` and each list against its function. That is cheaper than a generator: no new script, no instrument-count churn in the procgen reference, no new `--check` to enrol. It catches the same drift.

**Doc mutant:** delete `` `rebound` (`spinnerBodies`), `` from the Modelled line. Predicted: only the three-lists row goes red. Measured: `1 failed | 29 passed`, that row. Restored.

Other D4 changes:

- `concepts.md` § *Behaviour* gains two sentences pointing at the labels and `certifiableBlocks`.
- `generate-procgen-reference.mjs` moved the README word count and `procgenDocs/generated/docsIndex.js`.
- **The two new cross-doc links moved the pinned link census 322 → 324** (`doc` 247 → 249). This was not foreseen by the brief. I updated the pins in `docLinks.test.js` and `docsRender.test.js`, each with a history line in the file's own convention. `procgenDocs` 8 files / 487 green.

## The class → block table (33 rows)

| Tag | Aggro word | Blocks | Bespoke | Unique |
|---|---|---|---|---|
| `bob` | `chase` | `chase`, `contact`, `hp` | — | — |
| `bobsoldier` | `chase` | `chase`, `contact`, `melee`, `hp` | — | — |
| `bulb` | `chase` | `chase`, `contact`, `hp`, `onDeath` | — | — |
| `lavarunner` | `chase` | `chase`, `contact`, `hp`, `terrain` | — | — |
| `jellyfish` | `chase` | `chase`, `contact`, `hp`, `terrain` | — | — |
| `puncher` | `chase` | `chase`, `contact`, `melee`, `hp` | — | — |
| `drill` | `teleport-hop` | `tile-hop`, `contact`, `hp`, `lineOfSight` | — | — |
| `flyer` | `chase-through-walls` | `chase`, `stomp`, `hp` | — | — |
| `spinner` | `none` | `rebound`, `contact`, `sweep`, `hp`, `onDeath` | — | — |
| `wallflyer` | `wall-hug-launch` | `wall-launch`, `contact`, `hp` | `rayTrigger` | — |
| `turret` | `static-shooter` | `stationary`, `emitter`, `contact`, `hp`, `proximity` | — | — |
| `iceturret` | `static-shooter` | `stationary`, `pushable`, `emitter`, `contact`, `hp`, `proximity` | — | — |
| `grenade` | `armed-by-proximity` | `ballistic`, `explode`, `proximity`, `matrix` | — | — |
| `icetrap` | `static` | `stationary`, `melee`, `proximity`, `matrix` | — | — |
| `sandtrap` | `static` | `stationary`, `melee`, `proximity`, `hp`, `onDeath` | — | — |
| `darktrap` | `static` | `stationary`, `melee`, `proximity`, `light`, `matrix` | — | — |
| `lavatrap` | `static-tongue` | `stationary`, `proximity`, `hp` | `latch` | — |
| `bombpusher` | `static-lobber` | `stationary`, `emitter`, `explode`, `proximity`, `matrix` | — | — |
| `shieldboss` | `boss` | — | — | yes |
| `bosstotem` | `boss` | — | — | yes |
| `lavaboss` | `boss` | — | — | yes |
| `tentaclebeast` | `boss` | — | — | yes |
| `finalboss` | `boss` | — | — | yes |
| `lightbosscontroller` | `spawner` | — | — | yes |
| `spinningaxe` | — | `stationary`, `sweep` | — | — |
| `beamtower` | — | `stationary`, `beam`, `schedule` | — | — |
| `lavachain` | — | `stationary`, `tether`, `schedule` | — | — |
| `crusher` | — | `lane-charge`, `contact`, `lineOfSight` | — | — |
| `pulser` | — | `stationary`, `pulse`, `schedule`, `channel` | — | — |
| `arrowtrap` | — | `stationary`, `emitter`, `channel` | — | — |
| `whirlpool` | — | `stationary` | `vortex` | — |
| `pod` | — | `stationary`, `contact` | `pin`, `bossScript` | — |
| `pull` | — | `stationary` | `forceField` | — |

`iceturret`'s `aggroNote`: the live turret is `stationary`, and its corpse is `pushable` by Fire or Pulse. That is P1's pinned `ICE_TURRET.moveSpeed` 0.5 against `speed` 0, and the label carries both halves rather than choosing one.

## Where the labels disagree with the planner (measured)

Appendix A is not in this clone. I can compare only against the planner's census **as the brief inlines it** (§1).

1. **The planner's bespoke list** (`wall-launch tile-hop light tether armour lane-charge beam`): all but `armour` are declared P2 ids now, so they are filed under `blocks`.
   - **`armour`** is a `WEAPON_CATEGORIES` id (`DarkSuit.as`), not a block. No non-unique class I read needs an armour defence block. The shield-style "first hit swallowed" is `shieldboss`, which is unique.
   - **I did not use it.** If the planner meant a specific class, that row is a disagreement I cannot locate.
2. **New bespoke names the planner did not list:**
   - `rayTrigger` (WallFlyer's `collideLine("Player", …)` ray, which does not test Solid, so it is not `lineOfSight`);
   - `latch` (LavaTrap's tongue carries the player; it is neither `tether` nor `melee`);
   - `vortex` (Whirlpool);
   - `pin` and `bossScript` (Pod);
   - `forceField` (Pull).
3. **`lavatrap` is not `tether`.** If the planner filed the tongue under `tether`, we disagree: P2's `tether` is LavaChain's swung arm, and I kept it for `lavachain` only.
4. **Movement for `flyer`**: `chase` (it extends Bob), with attack **`stomp`**. `hitPlayer` is overridden empty, so it has no `contact` block.
5. **`drill`** is `tile-hop` + **`lineOfSight`** (`Drill.as:86`, `!collideLine("Solid", …)`), consistent with the planner's `teleport-hop → tile-hop`.
6. **`crusher`** is **`lane-charge`** + `contact` + `lineOfSight` (`Crusher.as:58,63-74`). The planner's `lane-charge` was listed as a bespoke movement without a class in the brief.

## The exported API, as T3 and P4 will call it

```js
import {
    ENTITY_BLOCKS, AGGRO_KIND_BLOCKS, FAMILY_BLOCKS, EntityBlocksError, assertEntityBlocks,
    entityBlocksOf, modellingFamilies, blocksTheSolverModels, blocksNoFamilyModels,
    blocksOnlyAvoided, certifiableBlocks,
} from '../seedlingDemo/entityBlocks.js';

entityBlocksOf('drill')     // {tag, source:'enemy', as3:'Drill', blocks:['tile-hop','contact','hp','lineOfSight'], bespoke:[], unique:null, why, src}
blocksTheSolverModels()     // ['stationary','chase','rebound','pushable','lane-charge','contact','emitter','sweep','pulse','hp','channel']  (BLOCKS order)
blocksOnlyAvoided()         // ['beam','tether']
blocksNoFamilyModels()      // the declared ids not in the first list
modellingFamilies()         // Map block → [family]   ({depth:'avoid'} for the volume arms)
certifiableBlocks(realisation.blocks)
// → { modelled: [...], unmodelled: [...], avoidedOnly: [...] }   throws on an undeclared id
```

⚠ Importing it pulls in `combat.js` (and so `entityRecords.js`), because the load-time check reads the census. A browser-side consumer in `procgenCore/` would have to import `seedlingDemo/` to call it. That direction already exists (19 modules), but it is the one to watch.

## What the brief got wrong (measured)

1. **"The six bosses + `lightbosscontroller`."** There are **five** `aggro.kind: 'boss'` rows (`shieldboss bosstotem lavaboss tentaclebeast finalboss`), so `unique` has 6 rows, not 7.
2. **"`hazards.js` prices 8 volumes."** `hazardVolume` has **9** arms. The ninth is `pod` (R6 slice 6b), and `dangerMap.hazardDanger` prices it.
3. **"`{tether}` (unmodelled)"** holds only once avoid volumes are separated from live state (see the first paragraph). Under the brief's literal rule (a family with non-empty `solverReads`), `volume:lavachain` makes `tether` modelled.
4. **"The 11 family files"** includes `hazards.js`; the brief's ⛔ list omitted it. It is a family file by the surface table and was not touched.
5. **P2's starter citations that the source contradicts.** These are in `procgenCore/behaviourBlocks.js`, which is ⛔ for me, so I only report them:
   - `rebound`'s `why` cites `Flyer.as`. Flyer extends Bob and chases; the wall-bouncer is `Spinner.as` (`runRange 0`).
   - `lane-charge` cites `Drill.as`. Drill hops one tile; the lane charger is `Crusher.as:63-74`.
   - `tile-hop` cites "`Bob.as`'s hop". That is Bob's hop sound and animation during the chase; the tile hop is `Drill.as:82-92`.
   - `patrol` cites `LavaRunner.as`. LavaRunner extends Bob and chases.
   - `lineOfSight` says "no Seedling class measured". `Drill.as:86` and `Crusher.as:58` are its `collideLine("Solid", …)` tests.
6. **The link census.** The brief's D4 did not foresee that two cross-doc links move `docLinks.test.js` / `docsRender.test.js`'s pinned 322. They were updated with history lines.

## Residue

- **`encounters.js`'s `hazardVolume` read is static, not live.** It sits in `priceHazardCrossings` ← `encounterPlan`, and no other family file calls `encounterPlan`. The grep rule counts it, so every volume row lists `encounters`. The live reader is `dangerMap` alone.
- **"Modelled" means read, not exact.** `chase` is modelled for Bob only (the bridged roster), not for Jellyfish, which is transcribed and not bridged. A realisation's `chase` with Jellyfish-like parameters is still "modelled" by this lookup. Per-parameter certification (speed, range inside what the stepped class covers) is P4/T3's question.
- **`onDeath` for `spinner` and `sandtrap`** is my reading of their `sideWrite: 'own tag'` (a persistence write on removal) as an effect left behind. `bulb`'s lava tile is the clean case.
- **`contact` on `turret`/`iceturret`** relies on `Enemy.hitPlayer`'s default (no override found). `flyer` is the one class where the override removes it.
- **The planner's Appendix A was not available.** The disagreement list above is against the brief's §1 summary only.
- No browser run. The module is imported by nothing that ships.
