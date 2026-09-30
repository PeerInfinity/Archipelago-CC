# Concept library T2c: the text adventure's gated back-exits (cloud report)

**Worker:** `concept-library-t2c` (Opus build slice, cloud fan-out, 2026-09-30).
**Branch (harness-designated):** `claude/text-adventure-gated-exits-mdfufe`. The harness only pushes this branch, so the brief's local name `concept-library-t2c` was not used.
**Started from:** `5a086f6` (origin/main, the SHA the brief expected). **Code head:** `2024573`. This report is the commit after it.

| D | Commit | Verdict |
|---|---|---|
| D1 the fix | `39ca271` | PASS. Seam (b), the engine's post-pass. 11 rows; mutants 9/9 and 1/1 |
| D2 census and corpus | `a8d4501` | PASS. Committed md5 identical; exactly 6 rebuild-hash lines moved, all in the two gated-TA worlds |
| D3 the hub re-derive | `7643f7b` | PASS. 4 rows; mutant 4/4. apworld batch 139/139 |
| D4 records | `2024573`, then this report | PASS |

**The one thing to know first:** the fix is 10 lines in `buildRulesJson`'s bidirectional post-pass, and it is substrate-blind: it keys on `regionRoundTrip.rules === 'authored'`. Only the text adventure declares that today. **A future AUTHORED substrate** (a Seedling door `exitGates`, per T4′'s residue) **gets the back-exit gate on its exit record for free.** Its serializer must read `access_rule` off the exit record the way the TA's does, or that substrate stays silent about the gate.

## W0: BEFORE (`5a086f6`)

| Gate | BEFORE |
|---|---|
| `md5sum frontend/presets/*/*/*_rules.json \| md5sum` | `2cbdcc658124225a40c9e3b12d187fdc` (T4′'s AFTER) |
| rebuild hash (scratch `rebuildHash.mjs`, T0b's recipe as a node script: every non-heavy `SHIPPED_PRESETS` build, a rebuild → envelope → compile for each sphere world, and a rebuild of every committed `procgen_metadata` document, with refusals hashed) | `ALL 9cac981d61bffb84081cb5f94b45a1e4`, 96 lines. Two runs gave identical output |
| `check-sidecar-fields.mjs` | `ALL PASS — 1422 entries over 8 substrates · 0 issue(s), 2 warning(s), 16 not-checked notice(s)` |
| `generate-procgen-reference.mjs --check` | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` |
| `generate-docs-index.mjs --check` | `OK: … is current (154 docs, 8 sections, 11 categories).` |
| bounded vitest, the brief's W0 list | `Test Files 53 passed (53)` / `Tests 1967 passed (1967)` |

My rebuild-hash script is not T4′'s (theirs was never committed), so its `ALL` values are its own. BEFORE and AFTER were both measured with the same script.

**The gap, reproduced** (scratch `w0.mjs`: build headless, then `regionRuleAgreement` on every region):

```
CENSUS shipped:maze-ta-sphere-mix: 3 disagreement(s)
  region_3_2: exit "region_3_3": the document says {"rule":"Has","args":{"item_name":"key_green"}}, the payload re-emits {"rule":"True_"}
  region_3_1: exit "region_3_2": the document says {"rule":"Has","args":{"item_name":"key_green"}}, the payload re-emits {"rule":"True_"}
  region_4_1: exit "region_3_1": the document says {"rule":"Has","args":{"item_name":"key_red"}}, the payload re-emits {"rule":"True_"}
CENSUS shipped:text-adventure-sphere-demo: 4 disagreement(s)   (region_3_2, region_3_1, region_4_1, region_4_0 — each its back-exit)
CENSUS maze-start CONCEPT_TRIAL seed 1: 2 disagreement(s)
  region_2_3: exit "region_2_2": the document says Has(Progressive Swim), the payload re-emits True_
  region_3_3: exit "region_2_3": the document says Has(Progressive Sword), the payload re-emits True_
CENSUS shipped:concept-trial-demo: 0 disagreement(s)
```

**The round trip and the hub, on `maze-ta-sphere-mix` `region_4_1`:**

```
region_4_1 payload back-exits: ["region_3_1"]; exitGates {"exit":Has(key_blue)}
ROUND TRIP: document {exit: Has(key_blue), region_3_1: Has(key_red)} → open→save {exit: Has(key_blue), region_3_1: True_}
REDERIVE: agreed [exit "exit", location "region_4_1__loc_0"]  frozen [exit "region_3_1"]  moved []
```

The round trip drops the gate. The hub's *Re-derive rules ▸* does **not** drop it: it freezes it. See *What the brief got wrong*, item 1.

## The seam: (b), the engine's post-pass

- **(a) was measured and rejected.** `serializeTextAdventureRoom(world, extractedRules, …, serializeContext)` has no way to reach the forward exit's rule:
  - the back-exit's `extracted_rules` entry is `paths: [{obstacles: []}]`, with no rule;
  - `serializeContext` carries only `substrateOfRegion` and `ordinalOfRegion`;
  - the hub's `regionRegenerate` calls `serializeRegionEntry` with no grid at all.
  So (a) would need a new context channel built from the compiled document, in two callers.
- **(b) is where the rule already is.** In `buildRulesJson`'s post-pass, `worldExit` is `getRegionExits(region).get(exit.name)`. That is the same record `serializeRegionEntry` hands the serializer. So the post-pass now also writes the copied rule on that record when the region's substrate declares `regionRoundTrip.rules === AUTHORED` (`roundTripRulesOf`, a new import of `procgenCore/roundTripRules.js`):
  - the rule is a clone;
  - a `True_` rule is recorded absent, and an existing record rule is deleted in that case, so a stale gate cannot survive a rebuild;
  - the serializer is unchanged;
  - a DERIVED substrate's record is never touched.
- The `exitGates` field description (`textAdventureRoom.js`) now says the field holds forward AND back gates, and where the back gate comes from.

## D1: the fix (`39ca271`)

**Rows** (`textAdventureSubstrateWrapper/textAdventureBackExitGates.test.js`, 11):
- for `shipped:maze-ta-sphere-mix`, `shipped:text-adventure-sphere-demo` and the maze-start `CONCEPT_TRIAL`-shaped world at seed 1 (3 rows each × 2):
  - `exitGates` equals the document's gated exits in every TA region, with at least one gated back-exit;
  - the census's rule agreement is AGREED on every TA region;
- the W0 pin: `region_4_1.exitGates == {exit: Has(key_blue), region_3_1: Has(key_red)}` (the forward gate is unchanged);
- the round trip answers `Has(key_red)` for the back-exit (it answered `True_` at `5a086f6`);
- maze payloads carry no `exitGates`, and the maze back-exit's rule stays the document's;
- a rebuild (`rebuildEnvelopeFromRulesJson` → `runStep('compile')`) re-emits every TA `exitGates` and every TA region's rules unchanged;
- **an ungated back-exit stays absent.** Sphere growth gates every exit: 18 TA worlds were searched (seeds 1–6 × filler 1–3) and none had an ungated TA back-exit. So this row removes the forward gate from the payload, leaves the back gate stale, and rebuilds. The rebuilt document says `True_`, the stale gate is dropped from `exitGates`, and the census AGREES.

**Mutants** (copy, then restore; `git diff --stat` was checked after each):
- the fix removed (engine at HEAD): predicted 9 red (3 exitGates, 3 census, pin, round trip, ungated), **measured 9**. The maze row and the rebuild row stay green.
- only the `delete` branch removed: predicted 1 red (the ungated row), **measured 1**.

**Also checked:**
- `dump-{maze,sphere,topdown}-byteidentity.mjs`: output identical with and without the fix;
- `check-spiral-byteidentity.mjs`: `ALL PASS`;
- the W0 vitest list + `conceptRebuild` + `sphereSteps` + `roundTripRules`: 57 files / 2046 passed.

## D2: the census and the corpus (`a8d4501`)

- `check-sidecar-fields.mjs`: `RULES text_adventure AUTHORED 16 region(s) · 21 gated · 72/72 endpoint(s) agree` · `ALL PASS — 1422 entries over 8 substrates · 0 issue(s), 2 warning(s), 16 not-checked notice(s)`.
- The three worlds pass the rule agreement. Their rows are D1's census rows: both shipped TA sphere presets, and T4′'s maze-start seed-1 world (the world the T4′ brief first asked for).
- **Committed md5:** `2cbdcc658124225a40c9e3b12d187fdc`, identical (checked at D1, D2 and the end).
- **Committed top-down documents: nothing can move.** Five committed documents carry a TA region: `concept_trial`, `jta_mixed_test` and `procgen_topdown` `AP_10`/`AP_11`/`AP_12`. Together they have 16 TA regions and **0 TA back-exits** (the top-down worlds have explicit reverse routes), so 0 are gated. The STOP condition did not arise.
- `presetDefs.generate.slow.test.js` (slow config): 26 passed.
- **Stale comments rewritten:** `CONCEPT_TRIAL_STATE`'s docblock (`presetDefs.js`) and `conceptTrialWorld.test.js`'s header both said a TA room behind a gate FAILS the census. They now give that as T4′'s measurement and say what is true now. The test header also called the state a "maze START"; it is a text-adventure start. The state itself is unchanged.

### The rebuild-hash diff (BEFORE `9cac981d…` → AFTER `4321a83d…`, 96 lines each)

| line | before → after | why |
|---|---|---|
| `shipped:text-adventure-sphere-demo build` | `0fe13085…` → `b9f271b9…` | 4 TA rooms behind a gate. Each gains its back-exit in `exitGates` (`region_3_2`+`region_3_3`, `region_3_1`+`region_3_2`, `region_4_1`+`region_3_1`, `region_4_0`+`region_4_1`) |
| `shipped:text-adventure-sphere-demo rebuild-env` | `18156ea0…` → `8073bc7e…` | the rebuilt envelope carries those payloads |
| `shipped:text-adventure-sphere-demo rebuild-compile` | `0fe13085…` → `b9f271b9…` | equals the new build |
| `shipped:maze-ta-sphere-mix build` | `1792c748…` → `c104b83e…` | 3 TA rooms behind a gate: `region_3_2`+`region_3_3`, `region_3_1`+`region_3_2`, `region_4_1`+`region_3_1` |
| `shipped:maze-ta-sphere-mix rebuild-env` | `c729b2b3…` → `7234c6d2…` | as above |
| `shipped:maze-ta-sphere-mix rebuild-compile` | `290d0465…` → `6b7c5fea…` | as above. It differs from the build both before and after, because of a pre-existing maze location rename (see *Residue*) |

Inside the two moved builds, scratch `moved.mjs` compared both versions. Only `exitGates` moved: the document minus its sidecars is identical, and every payload minus `exitGates` is identical, maze payloads included. The other 90 lines are byte-identical, including every committed-document rebuild line and `shipped:concept-trial-demo` / `shipped:topdown-maze-ta-demo`.

## D3: the hub re-derive (`7643f7b`)

**Rows** (`apworldEditor/regionRederiveTaBackExit.test.js`, 4, through an edit session like `regionRederive.test.js`'s):
1. the premise;
2. unedited: `agreed` contains `exit "region_3_1"` and `frozen` is `[]` (W0: frozen);
3. a raw `set-region-sidecar` that changes the FORWARD gate: `moved == ['exit "exit"']`, the back gate is kept, and the census AGREES;
4. a raw edit of the BACK gate: `moved == ['exit "region_3_1"']` and the document's back-exit rule becomes the edited one. Before the fix this could only freeze.

**Mutant** (engine at `5a086f6`): predicted 4 red, **measured 4**.

**In-app:** `npm test -- --port=8750 --mode=test-substrates --batch=apworld` → `totals: 139 run · 139 passed · 0 failed · 139 enabled · 0 not run`, with no handler-error block.
- The box lock printed `treeMoved: true` (`tracked 0 -> 4`). Those were my D4 doc edits, made during the run: three markdown files and the generated `procgenDocs` index. No code the rows import moved; the code was `a8d4501` throughout.

## D4: records (`2024573`)

- **`text-adventure.md` § *The room and its payload*:** `exitGates` holds forward AND gated back-exits. It says where the back gate comes from (the post-pass, AUTHORED substrates) and why the round trip needs it.
- **`concepts.md` § *The trial world*:** the TA-start measurement is now written in the past tense. A maze-start trial world (seed 1) now passes and is committable. `concept_trial` was not re-committed.
- **Generators:**
  - `generate-procgen-reference.mjs` was re-run: the `procgenDocs` docs index and the procgen README had word and line counts to update.
  - `generate-docs-index.mjs --check` was already current.
- **Links:** none added, so the pins stay 322 / doc 247 / same-doc 17.
- **Checks:** `procgenDocs` + `quickLaunch` 15 files / 600 passed; `check-procgen-docs.mjs` `ALL CHECKS PASSED`.
- **Final sweep at `2024573`:**
  - committed md5 `2cbdcc65…`;
  - rebuild hash `4321a83d…` (identical to after-D1);
  - census ALL PASS 1422;
  - W0 vitest list 55 files / 1982 passed, the new files' 15 rows included.

## What the brief got wrong (measured)

1. **"A hub re-derive of such a room DROPS the back-exit's gate."** It did not. *Re-derive rules ▸* FROZE the gate (`frozen [exit "region_3_1"]`, *"nothing proves the room wrote them"*), so the document kept it. What dropped the gate was the bare round trip (`regionRoundTrip` `open`→`save`, which `deriveRegionRules` calls): it answered `True_`. The user-visible defects were:
   - a frozen count where the gate should agree;
   - a raw edit of a back gate that could never be re-derived onto the document;
   - the census failure.
   D3's rows pin all three.
2. **"Name the per-line `ALL` from T0b/T4′'s recipe."** That script was never committed, so the numbers here come from my own reconstruction. They are comparable only with each other, BEFORE against AFTER.
3. **"An ungated back-exit stays absent" as a built-world row.** Sphere growth gates every exit: 0 ungated TA back-exits in the 18 worlds searched. The row goes through a rebuild instead (D1).
4. **`generate-docs-index.mjs` lives at `scripts/quicklaunch/`,** not `scripts/procgen/`. Also, the docs-index file that the doc edits moved is `procgenDocs/generated/docsIndex.js`, which is regenerated by `generate-procgen-reference.mjs`.

## Residue

- **A rebuild renames a MAZE region's locations** (`region_4_2__loc_0__5_3` → `region_4_2__key_yellow_pickup__5_3`) in `shipped:maze-ta-sphere-mix`. This happens at `5a086f6` with and without T2c. So that preset's `rebuild-compile` ≠ `build`. It is not this slice's, so D1's rebuild row compares only the TA regions.
- **Future AUTHORED substrates:** see *The one thing to know first*.
- **The hub's `regionRegenerate`** (regenerate one region's sidecar through `serializeRegionEntry`) runs no post-pass, so a regenerated TA room behind a gate would lose its back gate from `exitGates`. It is not measured here, because it is outside the brief's paths. The census would catch it as a FAIL.
- **The maze-start trial world is committable but not committed** (⚖ the brief: `concept_trial` stays).
- **Not run here:**
  - the CI vitest suite number (⚖ ruling 52);
  - pytest;
  - the unfiltered vitest.
- **Constraints kept:**
  - no `git stash`;
  - no edit under a submodule path; `textAdventureEngine` was initialised read-only from `/root/CC/mirrors/`;
  - no edit to `concept_trial`, any committed preset, `package.json`, `concepts.js`, `conceptSelection.js` or `seedlingDemo/*`.
- **Scratch harnesses:** `rebuildHash.mjs`, `w0.mjs`, `moved.mjs`, `enum.mjs`, `search.mjs` and `rbdiff.mjs` live in the session scratchpad and were never committed.
