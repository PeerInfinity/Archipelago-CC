# Cloud report: `seedling-hammer-carry-drop`, which route-order carries the solver needs

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-carry-drop` (planner `seedling-hammer-phase-planning-8`), cloud, Opus |
| Start SHA | `origin/main` = `80650ed1b6` (TRAIN 105), plus `git merge 6ee18e54d9` (`claude/seedling-leglist-staging-xu9xx8`: TRAIN 106 had not landed) = `18f354f2` |
| Branch | `claude/seedling-carry-drop-measurement-3tiq46` |
| Commits | `622226bb` (the switch, its test file, the regenerated instruments); `66233726` (the evidence). This report is the last commit |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-carry-drop-evidence/` (`census.txt`, `sweep/`, `replay/`, `legs/`, `tools/`) |
| Environment | `session_bootstrap.sh --seedling` done (its pip step failed on an interactive prompt; nothing here needs pip). The eight `-` non-wasm submodules initialised, no pointer moved. Node 22.23. Dev server `serve-nocache.py` :8000, started here, stopped by PID |
| Planner messages | none arrived |

## 2. The answer first

- **The switch:** `--carry-line-only`, an opt-in producer flag of `scripts/procgen/seedling-divergence-legs.mjs`. It narrows `--carry-route-flags`, and refuses by name without it.
  - It is **not** a `SOLVER_ENV_NAMES` switch: it changes a measurement list, not the solver. No page thread and no worker reads it. This follows the `--stage-edge-events` precedent.
  - **The rule:** carry a route-cleared flag only when a rule on the leg's own line names it. The line is the goal's rule plus every edge on the arrival's paths (each door; each link walked, then that link's source arrival's paths).
- **The one thing to know first:** of the 83 legs the carry stages at base, the page needed the carry on **2**. Both carried flags are named in an `Or(<flag>, <items the route does not hold>)` on the leg's **own arrival door**. That is what `--stage-edge-events` already stages.
  - So with `--stage-edge-events`, the route carry is needed by **no** leg on this list. The line rule then carries nothing, and the list is byte-identical to the edge-events list.
- **Numbers** (page, the production wasm engine, seedling_bot_ap_p4g; "good" = done/crossed with 0 game hits):

  | arm over the 83 carried legs | good |
  |---|---|
  | full carry (`--carry-route-flags`) | 69 |
  | no carry (default list) | 68 |
  | line carry (`--carry-route-flags --carry-line-only`) | **70** |

  - The full carry is not neutral. On `level_40__r26c13 <- in_L43_176_464 -> location:Level 040 - Chest` it costs one game hit: 1,670 t with 1 hit, against 1,686 t with 0 hits without it.
  - On 3 legs it changes the plan, both arms hitless.
- **Radius** (`carriedFlags` legs, all six presets):

  | list | radius |
  |---|---|
  | `--carry-route-flags` | 83 |
  | `--carry-route-flags --stage-edge-events` | 77 |
  | `--carry-route-flags --carry-line-only` | **2** |
  | all three flags | **0** |

- **Acceptance md5:** `391322d681b7aa0229d94b3f6906d024` at the base and at head. No solver byte moved.

## 3. The reproduction (measured)

**The leg lists at the base**, all six presets, 923 legs. The md5s equal the leglist slice's §11:

| list | md5 | radius |
|---|---|---|
| default | `fc1c0431d22ef2263c2d655bec98abaa` | — |
| `--carry-route-flags` | `95ed7f6abafb8677566b21d055a6724e` | **83** |
| `--stage-edge-events` | `c85b1cea1e3b853eb8aecb5461dc348f` | — |
| `--carry-route-flags --stage-edge-events` | `fbc50ba333f8809c0fb676cceae89831` | **77** |

- **The 83 carried legs** are listed by key in `evidence/legs/keys-83.txt`. `census.txt` gives one row per leg: carried flags, both arms, the verdict, and what each switch does to it.
- **ON vs OFF (edge events):**
  - 7 legs move. One stages its carry instead: `level_62 <- in_L64_32_96 -> exit:out_teleporter_240_304`.
  - L63 Chest (`level_63__r5c14 <- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest`) stages `L63:7`, and its carry drops to `[63:1, 63:6]`.
  - 5 legs are skipped (`arrival-not-crossable-at-sphere`): `level_63__r6c9 <- in_L65_128_0` ×2 and `level_63__r10c2 <- in_L65_32_0` ×3.
- **rules-7's census goals in the radius.** Each row below is a carried leg:
  - **L30 Torchpickup** ×4 (`level_30__r2c10 <- in_L28_304_16 | in_L31_160_384 | in_pit_L32_14_5 | in_pit_L32_15_5`);
  - **L12 Chest** (`level_12__r42c28 <- in_L83_32_64`);
  - **L39 Totem 72,40** (`level_39__r0c9 <- in_L40_480_912`);
  - **L40 Chest** ×2 and **L40 Totem 160,640** ×2 (`level_40__r26c13 <- in_L39_144_0 | in_L43_176_464`);
  - **L40 Totem 64,144** ×2 (`level_40__r4c4 <- in_L41_0_160 | in_L42_240_336 ~> level_40__r0c53`);
  - **L12 Witch** ×7 (`level_12__r0c19 <- …`);
  - **L68 Health** (`level_68__r1c1 <- in_L65_184_64 ~> level_68__r3c1`);
  - **L63 Chest** (above);
  - **L112 Owl** (`level_112__r2c2 <- in_L111_128_48`).
  - The two maze rows are not in the playthrough list's radius.
- **The measurement.** I ran `probe-seedling-divergence-sweep.mjs --mode=inv --page-legs=1 --leg-budget-ms=240000 --page=seedling_bot_ap_p4g --keys=<the 83> --capture-requests=…` with three leg lists:
  - **carry arm:** the carry list;
  - **no-carry arm:** the default list. Same keys and ids; each leg equals its carry self minus exactly `carriedFlags`, checked row by row;
  - **edge/line arm:** the `--stage-edge-events` list, run for the two legs the no-carry arm broke.

  Each arm gets one clean game per leg, the AP inventory of the leg's sphere granted, the flags staged through the game's own setter, and the production engine. That is about 1.5 h per arm.
- **The node cross-check.** `tools/carry-replay.mjs` replays the first captured request of each of the 8 non-identical legs in node, twice: once as captured, and once with `staging.persistence` minus `carriedFlags`. It reproduces every page verdict (`replay/replay8.jsonl`):
  - 537 and 906 refuse without the carry, by the same text as the page;
  - 854 and 908 plan 117 → 218 t and 61 → 163 t;
  - 182 and 186 give the same 5-tick plan;
  - 380 and 396 have their first request refused in both arms (the page's second plan solves them).

**The census** (`census.txt`; `TALLY` is its last line):

| verdict (page) | legs | which (by key) |
|---|---|---|
| **NEEDED** (good with the carry, not without) | **2** | `level_62 <- in_L64_32_96 -> exit:out_teleporter_240_304` carries `62:0`: 423 t / 0 h with it; without it, refused: "reach-exit (240,304)->L63: the combat ladder is EXHAUSTED … enemy:darktrap@112,208". `level_63__r5c14 <- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest` carries `63:1,63:6,63:7`: 309 t / 0 h with it; without it, refused: "no corridor for goal collect-placement toward (132,268) … A* start …" (rules-7's pole-stance pit) |
| not needed: identical (same end, ticks, hits; good) | 64 | 62 rows plus 2 exit legs whose end reads `crossed` in one arm and `done` in the other, on the same 5-tick plan (`level_12__r43c21 <- in_L34_32_144`, `level_12__r42c28 <- in_L83_32_64 -> exit:…`). That is the lab's 200 ms poll race (`seedlingDivergenceLab.js:249`), not the carry |
| not needed: identical stop (the same stop in both arms) | 13 | see §9: every stop is flag-independent |
| not needed: plan changes (both good) | 3 | `level_20__r1c12 <- in_L19_16_96 ~> level_20__r1c4 -> location:L20 flag 4` (117 → 218 t); `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest` (1,262 → 1,228 t); `level_68__r1c1 <- in_L65_184_64 ~> level_68__r3c1 -> location:Level 068 - Health` (61 → 163 t) |
| not needed: better without | 1 | `level_40__r26c13 <- in_L43_176_464 -> location:Level 040 - Chest`: carry 1,670 t / **1 hit**; without, 1,686 t / 0 hits |

**What the two NEEDED legs need: one flag each.**
- The edge/line arm stages only the door's event. L63 Chest with `L63:7` alone is done in 309 t, 0 hits. L62 with `L62:0` is done in 423 t, 0 hits. Both tick counts equal the full carry's (`sweep/edge.rows.jsonl.gz`).
- So L63 Chest's `63:1` and `63:6` are not needed.
- Both flags sit in an `Or` on the leg's own door. Neither arm of that `Or` is held at the leg's sphere except through the event:
  - `level_64 → level_62` is `Or(L62 flag 0, Ghost Spear)`;
  - `level_65__r0c8 → level_63__r6c9` is `And(Or(L63 flag 7, All(Ghost Sword Fusion, …)), …)`.
- These are the leglist slice's stagers.

## 4. Design + change, OFF identity

**The design**, stated before building it. The measurement says one thing: a carried flag mattered only when the leg's own line names it. Every other carried flag belongs to an obstacle the leg's line never crosses. Two examples:
- L30's bosslocks guard `r0c4` / `r8c13 → r2c10`, not the torch.
- L12 r0c19's `12:4/5/10` are rules into r0c19 from its sibling sub-regions, not the arrival doors.

So the rule reads the rules on the leg's line, generically:
- **`lineReads(trace, arrival, goalRule, byItem)`** returns the `game_state` event ids that `namedGameStateEvents` finds on:
  - the goal's rule;
  - every path in `trace` of the arrival: each door's edge rule, and each link's rule followed by its `src` arrival's paths, recursively (cycle-safe).
- It names an event in any arm, and reads no sphere. Deciding the arm is `--stage-edge-events`' job.
- No level, coordinate or Seedling constant is involved.

**The change** (`622226bb`, `seedling-divergence-legs.mjs`). It adds one new exported function, a flag and one call-site change:
- `--carry-line-only` sets `LINE`. Passing it without `--carry-route-flags` gives `FAIL: --carry-line-only narrows the route carry: pass --carry-route-flags with it` (exit 2).
- `TRACE = EDGE || LINE` now gates the existing `trace` / `intoRules` build, which was `EDGE` before. Without either flag nothing is built, as before.
- At the route-carry call in `emitLeg`, `reads` becomes `readsOf(level) ∩ lineReads(…)` when `LINE` is set.
- The header gains a `line carry` paragraph.
- No other hunk; nothing is reformatted or renamed. `solverBot.js` is untouched.

**OFF identity** (all six presets):

| list | base `18f354f2` | head |
|---|---|---|
| default | `fc1c0431d22ef2263c2d655bec98abaa` | the same |
| `--carry-route-flags` | `95ed7f6abafb8677566b21d055a6724e` | the same |
| `--stage-edge-events` | `c85b1cea1e3b853eb8aecb5461dc348f` | the same |
| `--carry-route-flags --stage-edge-events` | `fbc50ba333f8809c0fb676cceae89831` | the same |
| `--carry-route-flags --carry-line-only` | — | `babe6c7206a5a1ba637ac0ee933cb280` (radius 2) |
| all three | — | `c85b1cea1e3b853eb8aecb5461dc348f`, **byte-identical to `--stage-edge-events`** (radius 0) |

**Acceptance md5** (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`): `391322d681b7aa0229d94b3f6906d024` at the base, before any edit, and the same at head.

## 5. Rows + bounded vitest runs

**New file `scripts/procgen/seedlingDivergenceLineCarry.test.js`, 11 tests:**
- **`lineReads`:**
  - a door's `Or` names its event in any arm, and the goal rule's event is read too;
  - a link adds its own rule and its source's paths, and a non-`game_state` event is not a flag;
  - a start or an unknown arrival reads only the goal rule;
  - a cycle terminates;
  - **MUTANT:** a link read without its source loses the door's event.
- **On the committed playthrough list** (the producer run four ways):
  - the flag without `--carry-route-flags` fails by name;
  - ON keeps every key in order, and each leg is its carry self with exactly the dropped carried flags removed (byte for byte);
  - the radius shrinks, and the still-carried legs are exactly the two measured witnesses, by key and flag;
  - a dropped witness: the L30 Torchpickup legs carried 2 flags and carry none ON;
  - with `--stage-edge-events`, nothing is carried and the list text equals the edge-events list;
  - **MUTANT:** the level's reads (the full carry) keep more than 50 more legs.

**Bounded runs** (by path):
- `seedlingDivergenceLineCarry`, `seedlingDivergenceRouteCarry`, `seedlingDivergenceEdgeEvents` and `seedlingDivergenceLegs`: **4 files, 88 tests passed**.
- `frontend/modules/procgenDocs/`, `checkProcgenHelp.test.js` and `lintGateLabels.test.js`: **10 files, 515 passed**. They are owed because the regenerated `architecture.md` line moved: the flag count of the leg producer.

**Regenerated and checked:**
- `census-seedling-solver-surface.mjs --write` ("GREEN: 372 rows match a fresh census");
- `generate-procgen-reference.mjs` (`--check`: "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE");
- `generate-docs-index.mjs` (`--check` OK).

No unfiltered vitest, no pytest, and no `standing-values --write`.

## 6. Page play / game witness

Every number in §§2–3 is a game result: the production wasm engine on `seedling_bot_ap_p4g`, headless logic-only, one clean game per leg, with game hits read from `botStatus` (`roomHits.max`). Rows:
- `evidence/sweep/{carry,off,edge}.rows.jsonl.gz`;
- per-arm summary lines in `*.summary.txt`.

The carry arm's run printed `ROUTE-CARRY: 83 leg(s) carry …`. No whole-game walk was run.

## 7. Census: which seed-1 divergence-sweep legs the change can move, and why

The change moves only lists built with `--carry-route-flags --carry-line-only`. A default sweep, a carry sweep or an edge-events sweep reads the same list as before.

On the line-carry list, **81 legs leave the carry**: every carried leg except the two in §3. Each leaves because none of its carried flags is named on its line. The census rows of rules-7 that leave:
- **L30 Torchpickup ×4:** `30:0`, `30:2`; identical in both arms.
- **L12 Chest via L83:** `12:4/5/10/3`; identical.
- **L39 Totem 72,40:** `39:8`; identical.
- **L40 Chest ×2:** `40:12`. From L39 the plan changes (both hitless). From L43 the leg goes from 1 hit to 0.
- **L40 Totem 160,640 ×2:** identical.
- **L40 Totem 64,144 ×2:** `40:12`, `40:8`. From L42, identical. From L41, both arms stop at the puncher combat ladder.
- **L12 Witch ×7:** identical.
- **L68 Health:** `68:0`; plan 61 → 163 t, both hitless. The game earns `68:0` in the visit, as rules-7 saw.
- **L112 Owl:** `112:1`; both arms `unresolved`, with no fight executor.
- **L63 Chest:** `63:1`, `63:6` leave; `63:7` stays.

**The two that keep their carry:**
- L62 from the L64 door keeps `62:0`.
- L63 Chest keeps `63:7`.

With `--stage-edge-events` both are staged as edge events instead, so on that list nothing carries.

**Measured cover of the line-carry list.** Each of the 83 legs' line-carry staging was played:
- 81 legs: the no-carry arm's staging;
- the two keepers: the edge/line arm, whose staging is the same as the line carry's. L62 stages `63:1` + `62:0` in both. L63 Chest stages `63:7` in both.

70/83 are good, against 69 for the full carry.

## 8. What the brief got wrong (measured)

- **"BK2 is the only one whose event gates its goal."** On this list, BK2 is not carried at all. Both `Level 040 - Boss Key 2` legs (`level_40__r32c36 <- in_L39_144_0 | in_L43_176_464 ~> level_40__r26c13`) stage `40:12` through their link edge's default staging. The carry that is really needed comes from two other legs, L62 via the L64 door and L63 Chest via the L65 door. Both are door-edge events, not BK2-like goal gates.
- **"Narrow the carry list to what is real (BK2-like gates)."** Once `--stage-edge-events` is on, the real set is **empty**: no carried flag on this list is needed beyond what the default staging and the edge staging already give. The line rule is still worth having on its own: it gives 83 → 2 without edge events. But the measurement's stronger result is that the route carry is redundant under `--stage-edge-events` on seed 1.
- **"10 census route-order goals."** In this list's radius, the eleven census goals cover 22 carried legs, plus 61 other carried legs that are not census rows: L0, L12 flag legs, L16, L20, L28, L62, L63 flags, L71, L101. All 83 were measured.

## 9. Residue / hand-overs

- **Stops that do not depend on the carry** (identical in both arms; the solver's, not the list's):
  - L12 r0c19 → `L12 flag 5` from `in_L35_32_64`, `in_L95_624_64` and `in_L95_624_80` is **done with 2 game hits** (541 / 610 / 675 t), the same in both arms. The other three r0c19 doors are hitless. This is a hand-over to fidelity or the solver; I have not looked at the model's hit count;
  - `level_62 <- in_L61_112_0 | in_L63_16_0 -> exit:out_teleporter_240_304`: "no corridor … solid:bonetorch@128,288 … No strategy row exists for this obstacle";
  - `level_63__r6c9 <- in_L65_128_0 -> location:L63 flag 7` and `level_63__r10c2 <- in_L65_32_0 -> location:L63 flag 6`: pole stance;
  - `level_63__r10c2 <- in_L65_32_0 -> exit:out_teleporter_0_208`: bridge spear stance. These three L63 legs are skipped under `--stage-edge-events`;
  - `level_40__r4c4 <- in_L41_0_160 ~> level_40__r0c53 -> … Totem Part 64,144`: puncher combat ladder;
  - `level_71__r14c12 <- in_L72_0_256 ~> level_71__r0c6 -> exit:out_pit_10_17`: anytime deadline at `walk`;
  - `level_101__r0c6 <- in_L100_288_96 | in_L102_64_96 ~> level_101__r4c2 -> exit:out_teleporter_104_24`: "magicallockfire@96,48 cannot be opened by this run";
  - `level_112__r2c2 <- in_L111_128_48 -> location:Level 112 - Owl`: `unresolved`, with no fight executor.
- **The `crossed`/`done` end label** of an exit leg can differ between two runs of the same plan, because of the lab's 200 ms poll (`seedlingDivergenceLab.js:244-249`). `compare-runs`-style diffs of sweep rows should fold the two together for exit goals. I have not changed this.
- **Recommendation for the planner** (not done here; it is a sweep-config question): a seed-1 carry sweep can use `--stage-edge-events` and drop `--carry-route-flags`. Where the carry is kept, add `--carry-line-only`.
- **Not measured:** other seeds or presets beyond what the six-preset list deduplicates into `seedling_playthrough`. The rule is generic; its *sufficiency* is witnessed on seed 1 only.
- **Not committed:** the captured solve requests (~29 MB per arm). The §3 sweep commands regenerate them.
