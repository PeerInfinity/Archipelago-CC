# Content packs PL-2: the resolver, the fill-rule table, the gap report, and one provenance validator (as built)

Slice PL-2 of the content-sets arc. Branch `content-packs-pl2`, based on origin/main `b7b8822633`. The design is
§ "Z — the final shared task shape" of the structure-options write-up: Z.5 (the settings and the resolver), Z.6 (the
fill rules and the gap report), Z7 and Z8 (numbers from a simulated playthrough; one `numbersMode` switch per world).
It also follows the planner rulings in the brief and the two rulings given during the slice (§8). AN-2 ran in
parallel. This slice touched only the provenance code of `actionNodes/actionGraph.js` among AN-2's files.

## 1. What was built, by commit

| Commit | Part |
|---|---|
| `408d395e64` | 1: ONE provenance validator. `contentPacks/provenance.js` accepts `session` (on a `model` source) and `approved.ruling` as optional fields. `actionGraph.js` checks its block with `parseProvenance` and re-exports `SOURCE_FIELDS` as `PROVENANCE_SOURCE_FIELDS` instead of keeping a copy |
| `ec997d5a1e` | 2: the fill-rule table, `procgenCore/fillRules.js` |
| `d4814f018c` | 3: the resolver (`packStructure/packResolver.js`) and the ActionNodes assembler (`packStructure/actionNodesAssembly.js`). Also: the Z.2/Z.4 additions, the words stack reading `exists`, and numbers-layer provenance per priced entry |
| `35a8446f7c` | 5: `scripts/procgen/report-content-gaps.mjs` |
| `8f1115bd82` | 4: the ActionNodes proof. The pack `frontend/packs/example-village/`, its registry row, and the pins |
| `1bbd1c5c69` | 6: docs. A new `concepts.md` § The resolver, the fill rules and the gap report, plus edits to three other sections; the generated reference regenerated; doc-link census 429 → 430 |

## 2. The rule table as built (`frontend/modules/procgenCore/fillRules.js`)

`FILL_RULES[id] = { id, version, status, fills, how, apply }`. The report names a rule as `ruleTag(id)` =
`<id>@<version>`. Every rule is version 1, written as Z.6 states it and not tuned.

| Rule | Status | `apply` (stated) |
|---|---|---|
| P1 | built | `{startId}` → `[[startId]]`: a placeless task goes after the start |
| T1 | built | `{cost, sourceStart, receivingStart}` → round(cost ÷ sourceStart × receivingStart). The share is `RULE_HELPERS.t1Share` |
| R1 | built | `{costAt, limit, startClock, maxLevel}` → the smallest level L in 0…maxLevel with costAt(L) × limit ≤ startClock, or null |
| R2 | built | `{owner, givers}` → `{after: [[owner]]}`, else the same-place giver that gives the most, else null. The caller lists the number |
| R3 | built | `{givers}` → `{after: [[first giver]]}`, or null |
| R4 | built | `{sum, stats}` → each stat ⌈sum ÷ k⌉. Alternatives → the first set (`RULE_HELPERS.firstSet`) |
| L1 | built | `{startClock, time, timeAtMax?}` → max(1, ⌊startClock ÷ time⌋). A growing limit uses `timeAtMax` when given. Time 0 → 1 |
| L2 | built | `{held}` → max(1, held) |
| W1 | built | listed, never written: the entry is shown by its id |
| B1 | built | listed |
| AN1 | built | `{ancestors: [{gain, limit}]}` → Σ gain × limit over the node's `after` ancestors |
| AN2 | built | `{weight, rate=1, share}` → max(1, round(weight × rate × share × 10)) |
| AN-flat | built | forms: `growing-limit`, `result-when` (→ `each`, except `opens`), `modifies` (dropped), `alternative-requires` (→ the first set), `multipart` (→ one performance per segment) |
| X1, X2, AN3 | **not-yet** | listed. `fillRule(id)` and `fillRulesOf` refuse them by name |

**Which rules a substrate applies.** `fillRulesOf(entry)` reads the entry's `fillRules`. When the entry declares
none, it reads `SUBSTRATE_FILL_RULES[entry.id]`. Either way, an unknown rule or a not-yet rule is refused by name,
naming the substrate. ActionNodes:
`['P1', 'T1', 'L1', 'L2', 'W1', 'B1', 'R4', 'AN1', 'AN2', 'AN-flat']` (planner ruling 1, §8). No other substrate
lists any rule: maze and text adventure read only words, and no omsi or JtA world reads a pack yet.

## 3. The resolver's signature (`frontend/modules/packStructure/packResolver.js`)

```js
resolveContent(substrateId, { exists, content, numbers, numbersMode }, { base, readJson, registry })
  // → Promise<{ document, report, stacks: { exists, words, numbers } }>
resolveLoaded(substrateId, { exists, numbers, numbersMode }, { existsLoaded, wordsLoaded, numbersStack, registry, words })
  // the synchronous core over loaded stacks
```

- **exists:** `effectiveExists` (its own, or the substrate's default pack).
- **words:** `effectiveContentStack({substrateIds, exists, content})`. The order is the substrates' default packs,
  then the `exists` packs, then the themes; a later pack wins.
- **numbers:** each `exists` pack's own set for this substrate (when it has one), then the named packs, later winning
  per value path. A named pack is checked by `numbersSelectionRefusal`.
- **`table`** (an absent mode is always `table`): the stack as written. A missing number is filled by one of the
  substrate's rules and listed. A missing number that no rule fills is refused by name. Measured, the boon in the
  error is the test's:
  `resolve action_nodes: boon "p:boon/charm" has no count in any numbers set (no rule fills an item-pool count)`.
- **`assign`** is refused by name. Measured:
  `resolve: numbersMode "assign": substrate "action_nodes" declares no numbersWalk, so nothing can assign its numbers (no substrate declares one yet; the first walk would be action_nodes's). Use "table"`.
  A substrate that does declare a walk is refused too, because no walk is built. `FIRST_WALK_CANDIDATE` =
  `action_nodes`: it is the one substrate whose numbers the resolver assembles from a pack, and its exact one-loop
  search can already check a set of numbers. Z8 left the walk itself undecided.
- **document:** built by the substrate's assembler (`DOCUMENT_ASSEMBLERS`; today `action_nodes` only). A substrate
  without an assembler resolves its stacks, its document is `null`, and W1 runs over its structure.
- **report:** Z.6's shape, `{ substrate, exists, numbers, numbersMode, filled, flattened, unused, unnamed }`.

### The ActionNodes assembly (`actionNodesAssembly.js`)

- A node is a `task` entry, and its id is the entry's slug.
- **Kind.** A node's kind comes from its tag: `start`, `check`, `use` or `goal`. A task with none of these is an
  `action`, and a task with two is refused. Exactly one task is tagged `start`.
- **Clock and economy.** The clock is the one resource the tasks' `time` names (more than one is refused). It is
  the mana: a clock result is `results.mana`, and the clock is left out of `resources`. The numbers set's `economy`
  holds `loop_mana` (required), `settings`, `filler` and `stat_rate`.
- **`after`.** A task with no `after` goes:
  - after the tasks that `opens` it or its place;
  - else after the start, when it shares the start's place;
  - else, with no place, after the start by P1 (listed);
  - else it is refused.
- **Requirements and results.**
  - A `consume` member adds minus its minimum to the results.
  - A stat minimum with no number is filled by AN1. AN1 reads the RESOLVED gains, so a gain AN2 filled counts.
  - A stat result with no number is filled by AN2, with weight 1 ÷ (the stats the task trains).
  - A boon result in a task is listed under `unused` by B1.
  - `when` other than `each`, alternative sets, growing limits and `modifies` are flattened by AN-flat (listed).
- **Graph-level fields.** `graph_id` is the `exists` ids joined by `+`. The graph's name is the word of the start
  task's place. A boon's `gives.mana` is its clock result; with no value, ActionNodes' own per-item default applies.
- **Validation and provenance.** The result goes through `assertActionGraph`. Its provenance is ONE `derived` source
  whose `from` lists every structure entry key and whose `by` is the resolver's path. So the graph's sources are
  looked up through the packs, and it carries no per-entry `src` (Z.7).

## 4. The ActionNodes pack and its deep-equality proof

The pack is `frontend/packs/example-village/`. Its id is the graph's `graph_id`, so the resolved `graph_id` equals
the committed one. It has three layers:
- **`structure`:**
  - 18 entries: the place `village`; the clock `mana`; the stats `strength` and `knowledge`; the resources `gold`
    and `bread`; the boons `strength-boost` and `pocket-money` (each with `results`); and the 10 tasks.
  - The tasks are `start` (tag `start`), `do-chores`, `train`, `read-the-notice`, `eat-bread` (tag `use`, no place,
    no `after`), `buy-bread`, `bribe-the-guard`, `guards-locker` and `move-the-boulder` (tag `check`), and
    `leave-the-village` (tag `goal`).
- **`concepts`:** one word per entry, each presenting its entry.
- **`numbers`:** one set, `action_nodes`. Its economy is `{loop_mana: 100, settings: {xpGainScale: 1, xpEffect: "cost"}}`,
  with every time, limit, minimum, amount and count from the graph.

**Provenance, moved from the graph onto the pack.** Each of the graph's three sources is in the layer it describes:
- `actionnodes-design`, with `session` and `approved.ruling` "A14: …", is the default of all three layers.
- `do-chores-change` is on the `numbers` layer, as the group `action_nodes/example-village:task/do-chores`.
- `an1-boost-mana` is on the `numbers` layer, as the group `action_nodes/example-village:boon/`.

One more source, `pl2-pack` (model claude-opus-5-5, session content-packs-pl2, not approved), covers the entries the
graph held only implicitly: the place and the clock resource in `structure`, and the clock's name "Mana" in
`concepts`. The report script's counts:

```
example-village structure  actionnodes-design model     16
example-village structure  pl2-pack           model     2
example-village concepts   actionnodes-design model     17
example-village concepts   pl2-pack           model     1
example-village numbers    actionnodes-design model     10
example-village numbers    do-chores-change   model     1
example-village numbers    an1-boost-mana     model     2
```

**The proof** (`packStructure/packResolver.test.js`):
- `resolveContent('action_nodes', {exists: ['example-village']})` in table mode **deep-equals**
  `actionNodes/graphs/example-village.json` once the provenance block and every node's and boon's `src` are set
  aside. **Key order is equal too**: the two `JSON.stringify` strings are identical.
- The resolved graph passes `validateActionGraph`.
- `compileActionGraph(resolved, {seed: 1, graphPath})` gives a document byte-identical to the committed
  `action_nodes_example/AP_1/AP_1_rules.json` once the top-level `provenance` is set aside.
- Every source in the graph's block appears, unchanged, as a source of one of the pack's layers.
- The committed preset and `example-village.json` are unchanged, and `action-nodes-compile.mjs --check` is
  byte-identical at the tip.

## 5. The gap report for it

```
$ node scripts/procgen/report-content-gaps.mjs --substrate action_nodes --exists example-village
substrate action_nodes  numbersMode table
  exists  [example-village]
  words   [example-village]
  numbers [example-village]
filled: 1
  P1@1      example-village:task/eat-bread  after  value [["start"]]
flattened: none
unused: none
unnamed: none
```

One row. Eat Bread is a `use` task with no place (Y's C5), which is how the design says a use node hangs, and the
pack writes no `after` for it, so P1 puts it after the start. That gives exactly the graph's `after: [["start"]]`.
Every number is stated, so nothing else is filled. Nothing is flattened: the graph uses only v1 forms. Every entry
is named. The test reads this report through the script's own `contentGapReport` and `gapReportLines`.

## 6. The words-stack pin results

`procgenPipeline/wordsStack.test.js`:
- **Every committed preset with a maze, text-adventure or JtA region (45 files: C0's surface plus JtA).** For each
  player (`preset_sidecars[p]` gives its substrates; ⚠ a per-player map), the new stack built from the recorded
  `content` and `exists` equals the C3 rule's stack (the mix's default packs, then `content`). It also equals the
  stack with `exists` set explicitly to the defaults. No preset records `exists`. Every library that declares
  `defaultContentPack:` is imported, so the pin sees every default.
- **A real generation (the concept trial world).** `exists: ['meta']` compiles byte-equal to `content: ['meta']`
  apart from the recorded keys: a words pack named in `exists` gives exactly its words.
- **The order.** A non-default `exists` pack sits over the substrates' own packs and under the themes, and the
  region seam refuses a set without it, by name.

## 7. The validator's merged field list

| Type | Fields (besides `type`) |
|---|---|
| game | name, repo, commit, path, files, extracted_by, credit, licence, approved, note |
| person | name, permission, licence, approved, note |
| model | model, family, date, **session**, licence, approved, note |
| authored | by, licence, approved, note |
| derived | from, by, licence, approved, note |

`approved` is `{by, date, ruling?}`. `session` and `ruling` are optional and, when present, non-empty strings. The
AN-1 graph's block parses unchanged. `actionGraph.js` maps the shared validator's refusal onto its own names:
`no-provenance`, `unlisted-source` for an unlisted default, `bad-provenance` otherwise, keeping the shared
sentence. A field the old copy accepted silently, such as `email` on a model source, is now refused there too
(pinned).

## 8. Anything the code overturned

1. **A Z.2 addition: a boon takes `results`** (⚖ planner, 2026-11-16, ruling 2).
   - Z.2's boon had only kind/src/modifies, so a pack could not say which stat or resource a boon gives. The
     ActionNodes design puts that in "what exists".
   - A boon's `results` take the task-result form `{stat}` | `{resource, sign}`, with no `when`. Their amounts are
     numbers `results.<id>`.
   - Numbers gain the value-path head **`count`**, a boon's copies in the item pool.
   - `gives.mana` is a boon result on the clock resource.
   - The parser refuses other forms by name, and the jta fixture now uses the field: the "no field goes unread" pin.
2. **Smaller mappings, ruled fine by the planner:**
   - tags give the node kind;
   - `economy` holds `loop_mana` and `settings`;
   - `graph_id` is the exists pack id;
   - the name is the start place's word;
   - mana is the clock.
3. **`fillRules` is not on the ActionNodes registry entry** (⚖ planner, ruling 1: AN-2 owns `actionNodesLibrary.js`).
   The list is `SUBSTRATE_FILL_RULES.action_nodes`, and `fillRulesOf` reads an entry's own `fillRules` first.
   Moving it onto the entry is the next slice's line.
4. **The numbers layer's provenance is per priced entry.**
   - `layerEntries('numbers')` now lists each set and each `<set>/<structure id>` row, the bindings' form, so a
     group can name the source of one entry's values.
   - Values cannot carry `src`, because they are numbers.
   - No committed pack had a numbers layer before this slice.
5. **The words stack now reads `exists`.** PL-1's `worldSettings.test.js` generated the concept trial with
   `exists: ['meta']` and pinned that nothing but the record moved. Under Z.5 that is now false: meta's words sit
   under the themes. The test now names the structure pack `example-village`, whose words present only its own
   entries, so the record pin keeps its meaning. The new behaviour has its own pin (§6).
6. **The "no pack provenance in a world" pin sets aside the ActionNodes block, by name.** The AN example world still
   records its graph's block (`provenance[p].graph_provenance`), whose notes are now ALSO the pack's. Replacing it
   with pack ids is the next slice's job (below). Until then `provenance.test.js` removes that one key before
   searching. The `approved` pin accepts the A14 ruling for `example-village`.
7. **A defect my tests found:** AN1 first read only the numbers, so a gain AN2 had filled counted as 0. Stat results
   now resolve before any minimum (`statResultOf`, memoised, filled once).
8. **The resolved graph needs a provenance block** (`validateActionGraph` refuses a graph without one), and a world
   carries none per entry (Z.7). It therefore carries one `derived` source naming the structure keys it came from.

## 9. Byte equality

| Instrument | Result |
|---|---|
| A scratch probe in this tree and in an export of `b7b8822633` (submodules copied): every `SHIPPED_PRESETS` entry generated headless through `prepareRunFromState` → `runPresetHeadless`, md5 of the `rules.json` | 25 presets, **0 differ**; 1 heavy preset skipped on both sides |
| The same probe: every committed `sphere-growth` / `top-down-sphere` world, through `rebuildEnvelopeFromRulesJson` → `serializeEnvelope`, md5 per player | 25 worlds, **0 differ** (8 refuse the rebuild, identically on both sides) |
| `seedlingDerivedRuleTable.js --print-engine-closure` | `engineMd5 bec369878feb67081187edca62baa951 (42 files)`, and no file of the diff is in it, so the closure is identical at base and tip |
| `action-nodes-compile.mjs --check` | byte-identical |
| `extract-seedling-art-packs`, `-sfx-pack`, `-music-pack`, `-map --source vendor/seedling`, `-masks`, `-damage-sites` `--check` | all OK |
| `ci-producer-checks.mjs` | `PRODUCER-DONE \| 99 run \| 0 red \| 1 skipped \| 0 known-red`; `git status --porcelain` empty afterwards |
| `generate-procgen-reference.mjs --check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| `check-procgen-help.mjs --in-place --only=report-content-gaps.mjs` | ALL PASS |
| No preset file in the diff; no world gains provenance | `git diff --stat b7b8822633 -- frontend/presets` is empty |

`check-procgen-docs.mjs`, `check-meta-trial-play` and `check-concept-trial-play` are browser checks, and the box
was held by another session, so they were not run locally. Their CI-GATE lines in the TT dispatch at the tip are
the evidence, quoted in the report back. Gitlinks in the diff: 0.

## 10. Tests

- New:
  - `procgenCore/fillRules.test.js`: the table, each rule, not-yet refusals, per-substrate lists.
  - `packStructure/packResolver.test.js`: the proof (§4), the gap report through the script, every rule on an
    in-memory pack, the stacks, the refusals.
  - `procgenPipeline/wordsStack.test.js`: §6.
- Moved:
  - `contentPacks/provenance.test.js`: one validator, the two optional fields, A14, the set-aside block.
  - `packStructure/packStructure.test.js` and the jta fixture: boon `results`, the `count` path.
  - `procgenPipeline/worldSettings.test.js`: `exists` names a structure pack.
  - `procgenDocs/docLinks.test.js` and `docsRender.test.js`: census 429 → 430, one `doc` link from concepts.md to
    action-nodes.md.
- Bounded local run (at `1bbd1c5c69`):
  - Scope: the brief's gate list (`contentPacks`, `packConcepts`, `textLibrary`, `artLibrary`, `procgenCore`,
    `packStructure`, `worldContent`, `metaTrialWorld`, `conceptTrialWorld`, `mazeRoom`, `actionNodes`,
    `procgenDocs`, `quickLaunch`), plus every non-slow suite naming the packs, the loader, the stack rule, the new
    modules or `actionGraph` (76 files, by `rg -a`).
  - Result: **246 files, 6704 tests, all passed.**
  - The one slow suite that walks the packs (`presetDefs.generate.slow`) generates `SHIPPED_PRESETS`, which the
    probe in §9 covers. The unfiltered suite number comes from CI (ruling 52).

## Next slice's line

After AN-2 lands:
- Switch the committed `action_nodes_example` world from its world-level `graph_provenance` block to pack ids
  (`exists: ['example-village']`), so its sources are looked up through the pack. Drop the set-aside in
  `provenance.test.js`.
- Move `SUBSTRATE_FILL_RULES.action_nodes` onto the ActionNodes registry entry as `fillRules`.
- Optionally compile the preset from the pack (`resolveContent` → `compileActionGraph`) instead of from
  `graphs/example-village.json`. The graph file then becomes a test fixture, or is deleted.

Still open, not this slice's: an assigning walk for ActionNodes (Z8), the tuning of AN1, AN2 and L1, and X1/X2/AN3.
