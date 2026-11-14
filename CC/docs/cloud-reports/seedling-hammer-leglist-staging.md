# Cloud report: `seedling-hammer-leglist-staging`, arrival-edge events in the divergence leg list

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-leglist-staging` (planner `seedling-hammer-phase-planning-8`), cloud, Opus |
| Start SHA | `origin/main` = `39e8a29f7fe8f9ebca9a17c3fa2d98d4123f09a4` (TRAIN 104) |
| Branch | `claude/seedling-leglist-staging-xu9xx8` |
| Commits | `dd55ff61` (the switch, its test, the regenerated instruments). This report is the last commit |
| Environment | `session_bootstrap.sh --seedling` READY; the five `-` submodules initialised (no pointer moved); Node 22.23 |
| Planner messages | none arrived |

## 2. The answer first

> ⛓ **Superseded in part by §10** (the planner's follow-up after rules-7's review). The with-events fallback is gone, and a non-crossable arrival now SKIPS by name instead of staging. ON now stages **3** legs and skips **73**; carry radius 83 → **71**. §§2–9 describe `dd55ff61`; §10 describes head.

- **The switch:** `--stage-edge-events`, a producer flag of `scripts/procgen/seedling-divergence-legs.mjs`. It is opt-in, like `--carry-route-flags`.
  - It is not a `SOLVER_ENV_NAMES` switch. It changes a measurement list, not the solver, and nothing on the page or in a worker reads it.
  - The sweep only reads the jsonl it is given.
- **The one thing to know first:** only one of the brief's two legs is a real defect.
  - **L63 Chest** (rules-7 leg 919): real. The L65 door's `Or(L63 flag 7, All(Ghost Sword Fusion, Ghost Spear, Sword))` has an event-free arm. `requiredEvents` reads rules with no inventory, so it treats "some arm needs no event" as "needs nothing". ON, the leg stages `flag:L63:7`.
  - **L68 Health** (rules-7 leg 921): not a defect. The link it walks, `level_68__r3c1 → level_68__r1c1`, is `And(Yellow Key, Or(Wand, …))` and names no event. The rule rules-7 quoted, `… HasAll('L68 flag 0 …', 'Yellow Key')`, belongs to the **reverse** edge `r1c1 → r3c1` (`worlds/seedling_playthrough/Rules.py:2072` vs `:2077`). Nothing is there to stage, ON or OFF.
- **The census answer is "no, not exactly these two".** At base, 22 unskipped legs have an arrival-path edge that names a `game_state` event they do not stage. All 22 are Dungeon 6 (L62/L63/L64/L65) lightpole/darktrap `Or(flag, …Ghost Spear…)` rules:
  - ON stages the event on 19 of them (17 staged, 2 now skipped by name);
  - the other 3 are the controls: their event-free arm (Ghost Spear) is held at the leg's sphere.
- **Numbers:**

  | | OFF | ON |
  |---|---|---|
  | legs with `edgeEvents` | 0 | 19 (17 staged + 2 skipped) |
  | route-carry radius (`carriedFlags`), with `--carry-route-flags` | 83 | 80 |
  | acceptance md5 | `391322d681b7aa0229d94b3f6906d024` | the same; no solver byte moved |

- No solve or hitless number moves: this is a leg-list change and no sweep was run (§6).

## 3. The reproduction (measured at base)

`node scripts/procgen/seedling-divergence-legs.mjs --out=legs.jsonl` gives 923 legs, all `seedling_playthrough` (the other presets' geometry is deduplicated into `alsoIn`), md5 `fc1c0431d22ef2263c2d655bec98abaa`. Leg ids moved since rules-7's base (`fe98f37f`), so the legs are named here by key:

| rules-7 id | base id | key | `stagedEvents` | edges on the arrival path |
|---|---|---|---|---|
| 921 | 908 | `level_68__r1c1 <- in_L65_184_64 ~> level_68__r3c1 -> location:Level 068 - Health` | absent | link `r3c1 → r1c1` = `And(Has Yellow Key, Or(Has Wand, And(Fire Wand Fusion, Wand, Fire)))`: **no event named** |
| 919 | 906 | `level_63__r5c14 <- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest` | absent | door `level_65__r0c8 → level_63__r6c9` = `And(Or(L63 flag 7, And(Ghost Sword Fusion, Ghost Spear, Progressive Sword)), Or(L65 flag 0, Ghost Spear))`; link `r6c9 → r5c14` |

**Where 906 loses it.** The arrival events come from `requiredEvents(edge.access_rule, byItem)`, called at the `into` loop for doors and in `linkArrivals` for links. Its `Or` case returns `[]` as soon as any branch needs no event. That is a fail-open static read: it does not ask whether the route holds that branch's items.

At the Chest's sphere (12.2), the route's inventory holds Ghost Spear but not Ghost Sword Fusion (sphere 12.6). So the first `Or` can only hold through flag 7. The goal-rule staging (`goalEventsHeld`) already reads `Or`s against the sphere's inventory. The arrival edges never did. There is no link-edge vs door-edge asymmetry: both paths use the same static reader.

**The L68 leg.** No `Or` is involved. The forward link has no event at all. The game play rules-7 saw (it earned `68:0` by opening `bosslock@16,32` with the Yellow Key) matches the rule: the rules charge the Yellow Key, not the flag.

**The census (every leg whose arrival-path edge names an unstaged `game_state` event).** I ran a scratch copy of the producer that stamps every event named anywhere on any arrival path (not committed; deleted). The result is 22 unskipped OFF legs, grouped by door:

| door rule (arrival edge) | legs | sphere(s) | ON |
|---|---|---|---|
| `level_62 ↔ level_63__r0c1 #2` = `Or(L63 flag 1, Ghost Spear)` | 8 (`level_62 <- in_L63_64_0 -> …` ×4, `level_63__r0c1 <- in_L62_240_304 -> …` ×4) | 5.6 / 6.4 | stage `flag:L63:1` |
| `level_62 ↔ level_64` = `Or(L62 flag 0, Ghost Spear)` | 5 (`level_62 <- in_L64_32_96 -> …` ×4, `level_64 <- in_L62_112_64 -> location:Level 064 - Ghostspear`) | 5.6–6.5 | stage `flag:L62:0` |
| `level_65__r0c2 → level_63__r10c2` = `Or(L63 flag 6, All(Ghost Spear, Fusion, Sword))` | 3 (`level_63__r10c2 <- in_L65_32_0 -> …`) | 7.5 | stage `flag:L63:6`; the flag-6 location leg skips (`goal-is-a-staged-event`) |
| `level_65__r0c8 → level_63__r6c9` (above) | 3 (`level_63__r6c9 <- in_L65_128_0 -> …` ×2, the Chest link leg) | 7.5 / 12.2 | stage `flag:L63:7`; the flag-7 location leg skips |
| `level_63__r10c2 → level_65__r0c2` = `Or(L63 flag 6, Ghost Spear)` | 1 (`level_65__r0c2 <- in_L63_32_304 -> exit:out_teleporter_0_128`) | 7.5, Ghost Spear held | **nothing (control)** |
| `level_63__r6c9 → level_65__r0c8` = `And(Or(L63 flag 7, Ghost Spear), Or(L65 flag 0, Ghost Spear))` | 2 (`level_65__r0c8 <- in_L63_128_304 -> …`) | 7.5 / 8.4, Ghost Spear held | **nothing (control)** |

## 4. Design + change, OFF identity

**Design.** The rule I implemented: stage an event that an arrival-path edge rule names when that rule cannot be satisfied at the leg's sphere **without** it. If an `Or` arm with no event is held there, nothing is staged. It is generic: it reads the rule tree and the sphere's inventory, and names no level, leg or constant.

**The change** (all in `seedling-divergence-legs.mjs`; new exported functions + one call site in `emitLeg`):
- **`sphereEdgeEvents(rule, byItem, holds, holdsWithEvents)`** = `requiredEvents(rule)` ∪ the cheapest held branch's events (`goalEventsHeld`, the goal staging's own reader).
  - It reads the branch first with the sphere's inventory as it is.
  - If no branch holds, it reads again with every event item also held. That covers an edge the sphere can only cross with the event: **16 of the 19 legs**, e.g. `Or(L62 flag 0, Ghost Spear)` at 5.6, where neither arm is held. Measured by whether each staged event is in the sphere's inventory.
  - Only 3 moved legs stage an event the sphere already holds: `level_62 <- in_L64_32_96 -> exit:out_teleporter_240_304`, `level_64 <- in_L62_112_64 -> location:Level 064 - Ghostspear` and the L63 Chest.
  - The held-only variant (my first build, before the fallback) moved exactly those 3; ON md5 `39c51c793e83f07833a59fbc8551d5c4`, carry radius 83 → 82.
  - A rule that no event makes hold adds nothing beyond `requiredEvents`.
  - Keeping `requiredEvents` in the union means ON only ever ADDS to the default staging.
- **`arrivalEdgeEvents(trace, arrival, eventsOf)`** walks an arrival's paths:
  - one path per door, with the door's rule (or `null` for the start);
  - one path per link walked, with its source arrival (recursive) and its link rule.
  - It aggregates exactly as `arrivalEventNeeds` / `linkArrivals` do: when every path needs one, the union.
  - `trace` is a side `Map` from arrival object to paths, so no arrival byte changes. `linkArrivals` takes an optional `trace` and records its paths there. Without one, its output is unchanged (a test row checks this).
- **`withEdgeEvents(leg, events)`**:
  - appends the events that `stagedEvents` does not already hold, and stamps `edgeEvents` (their ids);
  - skips by name, as `eventGate` does: `goal-is-a-staged-event` (the location goal is an added event) or `arrival-needs-unmappable-event`;
  - leaves a skipped leg, or a leg it adds nothing to, as the same object.
- **The call site.** In `emitLeg`, it runs after `eventGate` and **before** the route carry, so a staged edge event is never also carried. It is applied only when `--stage-edge-events` is passed and the goal has a sphere.

**OFF identity** (`--presets` = all six, the default):

| list | base `39e8a29f7f` | head `dd55ff61` |
|---|---|---|
| default | `fc1c0431d22ef2263c2d655bec98abaa` | `fc1c0431d22ef2263c2d655bec98abaa` |
| `--carry-route-flags` | `95ed7f6abafb8677566b21d055a6724e` | `95ed7f6abafb8677566b21d055a6724e` |
| `--stage-edge-events` | — | `a5e77560571c5bb7d03e8543fc38ee5b` |
| `--carry-route-flags --stage-edge-events` | — | `ed6174260645cfc057802d46028e5ecc` |

For the base carry md5, I ran base's file (`git show 39e8a29f:…`) from a temporary copy in `scripts/procgen/`, then deleted it.

**Acceptance md5** (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`): `391322d681b7aa0229d94b3f6906d024` at head, equal to base's.

## 5. Rows + bounded vitest runs

New file `scripts/procgen/seedlingDivergenceEdgeEvents.test.js`, 18 tests:
- **`sphereEdgeEvents`:**
  - the event-free arm not held stages the event arm;
  - every item arm held stages nothing (the control);
  - a not-held rule uses the with-events branch;
  - a static requirement is always kept;
  - two MUTANT rows: `requiredEvents` alone stages nothing; the inventory alone loses an edge the sphere cannot cross.
- **`arrivalEdgeEvents`:** a free door frees the arrival; a link adds its source's events; `linkArrivals`' `trace` leaves its output byte-identical.
- **`withEdgeEvents`:** appends and stamps; returns the same object when nothing changes; skips by name.
- **On the committed playthrough list** (the producer run four ways):
  - OFF holds no `edgeEvents`; ON keeps every key in order;
  - an unmoved leg is byte-identical, and a moved leg = OFF + `edgeEvents` appended (or skipped by name);
  - **L63 Chest ON stages `flag:L63:7` and NOT `flag:L65:0`** (its `Or`'s Ghost Spear arm is held; the row asserts the sphere's inventory);
  - **L68 Health stages nothing either way**;
  - **control:** two `Or(flag, Ghost Spear)` legs with Ghost Spear held stage nothing;
  - **route carry ON:** the Chest no longer carries `flag:L63:7`, no carried flag repeats an edge event, and the radius shrinks.

Bounded runs (by path; no unfiltered vitest):
- `npx vitest run scripts/procgen/seedlingDivergenceEdgeEvents.test.js scripts/procgen/seedlingDivergenceRouteCarry.test.js scripts/procgen/seedlingDivergenceSweep.test.js`: **3 files, 76 tests passed**.
  - The route-carry pins (radius derived 83, the L40 rows) hold OFF unchanged. That file never passes the new flag.
- `npx vitest run frontend/modules/procgenDocs/ scripts/procgen/checkProcgenHelp.test.js scripts/procgen/lintGateLabels.test.js`: **10 files, 515 tests passed**. The procgenDocs link-census pins are owed because the regenerator rewrote `architecture.md`'s generated flag line.

Regenerated, then each `--check` run:
- `census-seedling-solver-surface.mjs`: GREEN, 372 rows, unchanged.
- `generate-procgen-reference.mjs`: "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH". It added `--stage-edge-events` to `instruments.js` and to `architecture.md`'s imported-flag line.
- `generate-docs-index.mjs`: current.

## 6. Page play / game witness

None run. The brief asks for no sweep, and this slice changes only which flags a leg would stage. Measuring whether the 19 moved legs solve or play differently with their staging is the planned "carry-drop" sweep's job. The ON list is `--stage-edge-events` on the same producer: `probe-seedling-divergence-sweep.mjs --legs=<that list>` reads it unchanged.

rules-7 already played the L63 Chest leg with flag 7 staged (§4.7 of its report, the control arm: done, 309 t). Without it, the solver refuses (a pit start); rules-7 marks that arrival UNWITNESSED. That is the case this switch now stages.

## 7. Census: the seed-1 legs the switch moves (ON vs OFF, by key)

**`stagedEvents` gains (17 legs):**
- `flag:L63:1`: `level_62 <- in_L63_64_0 -> exit:out_teleporter_{48_304, 96_304, 112_64, 192_304}` and `level_63__r0c1 <- in_L62_240_304 -> {exit:out_teleporter_0_48, exit:out_teleporter_0_96, exit:out_teleporter_16_0, location:L62 flag 0: lightpole@120,200 cleared}`.
  - Why: the `#2` door's `Or(L63 flag 1, Ghost Spear)`, with neither arm held at 5.6 / 6.4.
- `flag:L62:0`: `level_62 <- in_L64_32_96 -> exit:out_teleporter_{48_304, 96_304, 192_304, 240_304}`, `level_64 <- in_L62_112_64 -> location:Level 064 - Ghostspear`.
  - Why: `Or(L62 flag 0, Ghost Spear)` before the Ghost Spear. The Ghostspear leg's goal IS the spear.
- `flag:L63:6`: `level_63__r10c2 <- in_L65_32_0 -> exit:out_teleporter_{0_208, 32_304}`.
- `flag:L63:7`: `level_63__r6c9 <- in_L65_128_0 -> exit:out_teleporter_128_304`, and `level_63__r5c14 <- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest`.
  - Why (both flags): no Ghost Sword Fusion until 12.6.

**Now skipped by name, `goal-is-a-staged-event` (2 legs):**
- `level_63__r6c9 <- in_L65_128_0 -> location:L63 flag 7: lightpole@112,272 cleared`
- `level_63__r10c2 <- in_L65_32_0 -> location:L63 flag 6: lightpole@48,272 cleared`

Each arrives through the door that its own goal's flag opens, at a sphere where the route cannot cross that door any other way. Today's sweep runs them unstaged.

**`carriedFlags` (with `--carry-route-flags`): radius 83 → 80. These are the route-order census rows that move:**
- `level_62 <- in_L64_32_96 -> exit:out_teleporter_240_304`: `[L62:0]` → none. It now stages `L62:0`.
- `…-> location:L63 flag 7 …`: `[L63:1, L63:6]` → none (skipped).
- `…-> location:L63 flag 6 …`: `[L63:1]` → none (skipped).
- **L63 Chest: `[L63:1, L63:6, L63:7]` → `[L63:1, L63:6]`.** Flag 7 is now the door's, not route order.

No other leg moves: it is byte-identical ON and OFF.

## 8. What the brief got wrong (measured)

1. **"leg ~921: L68 `r3c1 → r1c1`, the edge names `L68 flag 0`": it does not.** The forward link is `And(Yellow Key, Or(Wand, …))`. `L68 flag 0` is named by `r1c1 → r3c1` (Rules.py `:2072`, preset AP_1 identical). This holds at both rules-7's base `fe98f37f` and this base. So the L68 Health census row is **not** a staging defect. Its flag is earned in the visit (the bosslock, Yellow Key), which is the census's upper-bound case (rules-7 §5.1), not this one.
2. **"is it exactly these two?": no.** It is 22 legs, all one rule family (Dungeon 6's spear-or-flag lightpoles); see §3's census.
3. The reason it was not found is not a link-vs-door difference. Both paths use `requiredEvents`, which has no inventory.

## 9. Residue / hand-overs

- **For rules-7's review (the planner relays): `sphereEdgeEvents` in `scripts/procgen/seedling-divergence-legs.mjs`.** It is how an `Or`'s arms are read. Two things to review:
  - the fallback `holdsAt(i, true)` in `main`: every event item's count is raised to at least 1, and the region reach is kept as the sphere's;
  - its use of `goalEventsHeld` (fewest events, rule order on a tie).
  - Diff: `git diff 39e8a29f7f dd55ff61 -- scripts/procgen/seedling-divergence-legs.mjs`.
- **Not wired into the sweep workflow.** `.github/workflows/seedling-divergence-sweep.yml` has a `carry_route_flags` input but no `stage_edge_events` input. Adding one is the planner's call when the carry-drop sweep runs.
- **The fallback's reach is most of the change, and it is the planner's call.** With no arm held, the leg stages the event-bearing arm, even when the route at that sphere reaches the region through another door.
  - 16 of the 19 moved legs are of that kind (spheres 5.6 / 6.4 / 7.5), including both new skips.
  - The staging makes the arrival physically consistent, since the door is open. It does not claim the route used that door.
  - It follows the brief's test literally: the rule cannot be satisfied at the sphere without the event.
  - If the planner wants only the "held arm" reading, drop the `holdsWithEvents` fallback (one argument at the call site). That moves 3 legs (§4).
- No solver, `solverEnvChannel`, fidelity, `botDriverV*`, `flashPanel/*`, rules, AS3, wasm or gitlink change.
- No `standing-values --write`, pytest or unfiltered vitest.
- Scratch copies of the producer (base copy, census instrument) were created and deleted under `scripts/procgen/`; `git status` was clean of them before the commit.

## 10. Follow-up (planner `seedling-hammer-phase-planning-8`, after rules-7's review of `dd55ff61`)

**What the follow-up asked, and what I did:**

| | asked | done |
|---|---|---|
| 1 | drop the `holdsWithEvents` fallback | done |
| 2 | in `arrivalEdgeEvents`, drop arrival paths whose edge does not hold at the sphere, and stage per the held paths that remain | done |
| 3 | if NO path holds, don't stage; skip the leg by name | done: `arrival-not-crossable-at-sphere` |
| 4 | re-run the census; name any leg the AP route reaches ONLY through a non-holding edge | done: there are none |
| — | keep the "every path needs one ⇒ union" aggregation | kept (residue below) |

rules-7 accepted the `Or` reading (`requiredEvents` ∪ the cheapest HELD branch); it is unchanged.

**The change** (commit `727fbf4a26`):
- `sphereEdgeEvents(rule, byItem, holds)` returns `null` when no branch holds at the sphere. It has no fallback.
- A door path now carries `{rule, name, from}`. The call site treats a path as not crossable when its source region `from` is not in the sphere's reached set. It reports that as `(source region <r> unreached)`.
- `arrivalEdgeEvents` returns one of two shapes:
  - `{events}` over the held paths (a dropped path takes no part in the "every path needs one" test);
  - `{blocked: [why]}` when none holds. A link path is blocked when its source arrival is.
- `withEdgeEvents(leg, edge, sphereLabel)` skips a blocked leg with this reason, and stamps it `edgeEvents: []`:
  `arrival-not-crossable-at-sphere: <edge> needs <rule> | <edge> (source region <r> unreached); … — no arrival path crossable at <sphere>`
- The new helper `ruleText` renders a rule on one line for that reason.

**md5s and counts** (all six presets, the default):

| list | base `39e8a29f7f` | `dd55ff61` | head (`727fbf4a26`) |
|---|---|---|---|
| default (OFF) | `fc1c0431d22ef2263c2d655bec98abaa` | the same | **the same** |
| `--carry-route-flags` (OFF) | `95ed7f6abafb8677566b21d055a6724e` | the same | **the same** |
| `--stage-edge-events` | — | `a5e77560…` | `173cb968dc77424e1934dd8a2a08220f` |
| both flags | — | `ed617426…` | `11171bf9ba6a66e85448b7123e3fc5b3` |
| legs that stage an edge event | — | 17 | **3** |
| legs skipped by the switch | — | 2 (`goal-is-a-staged-event`) | **73** (`arrival-not-crossable-at-sphere`), 0 other |
| route-carry radius ON | — | 80 | **71** (OFF 83) |
| acceptance md5 | `391322d681b7aa0229d94b3f6906d024` | the same | **the same** |

**The 3 movers that stage.** Each staged event is in its sphere's inventory; a test row asserts it.
- `level_62 <- in_L64_32_96 -> exit:out_teleporter_240_304` stages `flag:L62:0` (6.5).
- `level_64 <- in_L62_112_64 -> location:Level 064 - Ghostspear` stages `flag:L62:0` (6.4).
- `level_63__r5c14 <- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest` stages `flag:L63:7` (12.2).

**The 16 formerly-fallback legs** are now skipped as not crossable, each by its own edge:
- `level_63__r0c1 -> level_62 #2` needs `Any(L63 flag 1, Ghost Spear)`:
  - `level_62 <- in_L63_64_0 -> exit:out_teleporter_48_304` (5.6)
  - `level_62 <- in_L63_64_0 -> exit:out_teleporter_96_304` (5.6)
  - `level_62 <- in_L63_64_0 -> exit:out_teleporter_112_64` (6.4)
  - `level_62 <- in_L63_64_0 -> exit:out_teleporter_192_304` (5.6)
- `level_64 -> level_62` (source region `level_64` unreached at 5.6):
  - `level_62 <- in_L64_32_96 -> exit:out_teleporter_48_304`
  - `level_62 <- in_L64_32_96 -> exit:out_teleporter_96_304`
  - `level_62 <- in_L64_32_96 -> exit:out_teleporter_192_304`
- `level_62 -> level_63__r0c1 #2` needs `Any(L63 flag 1, Ghost Spear)` (5.6):
  - `level_63__r0c1 <- in_L62_240_304 -> exit:out_teleporter_0_48`
  - `level_63__r0c1 <- in_L62_240_304 -> exit:out_teleporter_0_96`
  - `level_63__r0c1 <- in_L62_240_304 -> exit:out_teleporter_16_0`
  - `level_63__r0c1 <- in_L62_240_304 -> location:L62 flag 0: lightpole@120,200 cleared`
- `level_65__r0c8 -> level_63__r6c9` needs `All(Any(L63 flag 7, All(Ghost Sword Fusion, …)), Any(L65 flag 0, Ghost Spear))` (7.5):
  - `level_63__r6c9 <- in_L65_128_0 -> exit:out_teleporter_128_304`
  - `level_63__r6c9 <- in_L65_128_0 -> location:L63 flag 7: lightpole@112,272 cleared`
- `level_65__r0c2 -> level_63__r10c2` needs `Any(L63 flag 6, All(Ghost Spear, Ghost Sword Fusion, Progressive Sword))` (7.5):
  - `level_63__r10c2 <- in_L65_32_0 -> exit:out_teleporter_0_208`
  - `level_63__r10c2 <- in_L65_32_0 -> exit:out_teleporter_32_304`
  - `level_63__r10c2 <- in_L65_32_0 -> location:L63 flag 6: lightpole@48,272 cleared`

**The other 57 skipped legs: the switch is generic, and the planner should see these.** "No path holds" is not limited to event-naming edges. 57 more legs arrive only through a door or link that the AP route cannot cross at the leg's sphere:
- an item it does not hold yet: Fire, Wand, Progressive Swim;
- a static event the route has not collected yet: these legs already stage it OFF. Their edges name L12:7+12, L24:0, L39:8, L71:2, L112:1 and L113:0;
- or a source region the route has not reached.

That includes legs that the existing sweep and rules-7's witness ran:

| leg (key) | sphere | why skipped |
|---|---|---|
| `level_12__r42c28 <- in_L83_32_64 -> location:Level 012 - Chest` | 4.8 | `level_83 → level_12__r42c28` needs `All(L12 flag 7, L12 flag 12)`, not held at 4.8 |
| the L30 Torchpickup / bosslock legs from both L32 pits (8 exits/locations) | 3.5 / 3.8 | `level_32` unreached, or Fire not held |
| `level_38 <- in_L39_144_624 -> location:Level 038 - Chest` | 4.8 | `level_39__r25c9` unreached |
| L71 r0c6's four legs from L76 | 10.1 | `level_76` unreached |
| L113's twelve legs from L115 | 13.6–14.2 | `level_115__r9c4` unreached, or L113 flag 0 not held |

Full list by edge: `seedling-hammer-leglist-staging-evidence/not-crossable-by-edge.txt` (37 edge groups, 73 keys). Per-leg rows with the region's holding entrances: `not-crossable-legs.txt`, produced by `census-not-crossable.mjs`.

An ON sweep therefore runs 73 fewer legs than OFF. If the planner wants the staging without the generic skip, the narrow form is to skip only when a dropped path's rule names an event. That would skip the 16 and keep the 57 running as today. I did not build it; it is a one-condition change in `withEdgeEvents`.

**(4) Sphere-assignment question: none.** For every one of the 73, the leg's region IS reached at its sphere, through at least one rules entrance that holds there with its source reached. `census-not-crossable.mjs` checks every rules exit into the region, not only the sidecar doors. Examples:
- L62 at 5.6: via `level_61__r0c7`, `level_61__r0c10`, and the free `level_63__r0c1 → level_62`;
- L63 r6c9 at 7.5: via `level_63__r0c1 → level_63__r6c9`.

So in each case the route enters the room another way, and the leg's own door is simply not that way. **0 legs are reached ONLY through a non-holding edge.**

**Route carry (with `--carry-route-flags`), the rows that move ON:**
- `level_62 <- in_L64_32_96 -> exit:out_teleporter_240_304`: `[L62:0]` → none, because it now stages `L62:0`.
- L63 Chest: `[L63:1, L63:6, L63:7]` → `[L63:1, L63:6]`.
- 10 more lose their carry because they are now skipped:
  - L12 r42c28 ×2: `[L12:4, :5, :10, :3(, :11)]`;
  - L30 r2c10 ×4: `[L30:0(, :2)]`;
  - the L65-door legs into L63 r6c9 ×2 and r10c2 ×3.

  (The census row "L12 Chest via L83" and two of "L30 Torchpickup" leave the ON carry this way.)

**Rows** (`seedlingDivergenceEdgeEvents.test.js`, now 22 tests):
- `sphereEdgeEvents` returns `null` when no branch holds;
- a MUTANT row shows the retired fallback would have staged flag 7 on an edge nobody can cross;
- `arrivalEdgeEvents`:
  - drops a non-crossable path;
  - returns `{blocked}` by edge name and reason;
  - a blocked source blocks the link path;
- `withEdgeEvents` builds the exact skip text;
- on the committed list:
  - **the stagers are exactly those 3** (by key), each with its event held at its sphere;
  - every other mover is a not-crossable skip;
  - rules-7's L65 → r6c9 leg at 7.5 is skipped (it is not staged);
  - the controls and L68 Health are unchanged.

**Gates:**
- Bounded vitest:
  - the 3 leg-list files: **80 passed**;
  - `frontend/modules/procgenDocs/`, `checkProcgenHelp`, `lintGateLabels`: **10 files, 515 passed**.
- `generate-procgen-reference.mjs --check`, `census-seedling-solver-surface.mjs --check` and `generate-docs-index.mjs --check` are all current; the follow-up changed no flags.

**Residue (follow-up):**
- **The "every path needs one ⇒ union" aggregation is kept as you asked.** Over the held paths, an arrival whose held doors each need a different event stages the union of them. The real route needed only one door. It does not occur on this list: the 3 stagers each have one held path needing one event. But it is the same fail-closed over-staging the default `arrivalEventNeeds` has.
- The narrow-skip alternative above is open for the planner.
- No sweep was run on the ON list.
