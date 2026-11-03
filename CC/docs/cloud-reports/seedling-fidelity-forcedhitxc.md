# Seedling fidelity FORCEDHITXC — with `secondaryUse` ON, the forced-hit rung crosses by the game's hitless X+C

Planner `seedling-fidelity-planning-17`, wave 36. Session `seedling-fidelity-forcedhitxc`.

- **Start SHA:** `b646d32d95b4ebd636a70f05886957deffbf724a` (main; 105 of 116 contact-fidelity keys ON).
- **Harness branch:** `claude/seedling-fidelity-wave-36-y0bcw0`. The head is the commit that adds this report.
- **Evidence:** `CC/docs/cloud-reports/seedling-fidelity-forcedhitxc-evidence/`.

**The one thing to know first.** With `secondaryUse` ON, leg 612 now SOLVES hitless. The plan is
`[up+primary+secondary, ·, ·, ·]`, which reaches L74 at t4. The game agrees: witness `secuse-l73-622-xc-stand` (p4g, recorded
twice) shows 0 hits at every sample. The default is unchanged (`secondaryUse` OFF), and OFF is byte-identical. The flip
battery found three real defects in the first cut, and all three are fixed (D3). The worst was a "crossing" through the
door the player had just come in by.

| D | verdict | commits |
|---|---|---|
| W0 | PASS (both arms reproduced; the game witness recorded) | `2cb74641` (fixture) |
| D1 | PASS | `4aaff183` |
| D2 | PASS | `8ef21e66` |
| D3 | PASS (the list below; three fixes) | `fd6b496e`, `09caae1e`, `abd75306`, `46ace862` |

(Records: `15eaa939` seedling-bot.md, `aac5f6fd` surface census + docs index.)

## W0 — both arms at the base, and the ON tree walked

Reproducer: `evidence/tools/w0.mjs` is FORCEDHIT's `solve622`, staged from the leg's arrival with the sphere-7.3 items.
Sweep key `level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0` is **id 612** at this base (re-derived:
`seedling-divergence-legs.mjs --blocks`, 919 legs).

| arm | result at `b646d32d95` |
|---|---|
| OFF | DONE. `forced-hit`, 4 ticks: up, up, down+right, down+right. Bills `lavarunner@72,24` at t2. Proof proven at depth 2, 1,341 nodes (witness 9 + tree 1,332) |
| ON | FAILED, EXHAUSTED: *"forced-hit: no forced hit is proven from (72.0,24.0): 180 prefix(es) of 2 tick(s) are still hitless (first [up+primary+secondary ·]), and depth 3 needs 6480 more fork step(s) than the budget's 659"* |

**The ON tree** (`evidence/tools/tree.mjs`, on LEASH's fork at (72,24)):
- Five first ticks stay hitless through t2: `up`, `left`, `up+left`, `up+right` and `down+left`, each with
  `+primary+secondary`. That gives 5 × 36 = 180 open prefixes. Every other first tick is hit by t2, including
  `primary+secondary` with no direction.
- Each open first tick, carried on by holding a single set:
  - `up+P+S`, `up+left+P+S`, `up+right+P+S`: 24 of the 36 holds (every hold without `down`) leave for L74 at **t4**.
  - `left+P+S`: up-holds leave at t7–t8.
  - `down+left+P+S`: up-holds leave at t13–t14.
- **Where the rung discarded it:** budget exhaustion. Depth 3 needs 6,480 forks and 659 are left, so the tree stops on an
  open frontier of hitless prefixes. The crossing is at depth 4 anyway, past `depthMax` 3. So it was both causes the brief
  named: the budget ran out before the crossing, and a hitless prefix that had not crossed was read as "open".
- **Model vs wasm**, sample by sample over `[up+P+S, up, up, up]`: (72,24) → (72,21.2) → (72,18.65) → (72,16.35) →
  L74 (296,136), 0 hits. That equals `secuse-l73-622-xc.json`'s XC arm at every sample, 0 px.

**W0 banks (base, OFF):**
- Bounded set: 91 / 91 files, 2,334 / 2,334 tests (`evidence/bounded-before.txt`).
- Identity block (`evidence/identity-base.txt`), all exit 0:
  - maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`
  - ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`
  - killgate `7c15ed57` / `47116405` / `4d3bbf17`, levels `e28c1e5d` / `fb1a59e5`, generated set OK
  - the six producers `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`
  - reference: ALL MATCH
- `apReportBosses` has no test file. It is in the brief's list, and I added none.

## D1 — a hitless prefix the model carries on to a hitless room exit is a SOLVE

**Change** (`forcedHit.js`, ON only: everything new hangs off `const continuing = CONTACT_FIDELITY.secondaryUse === true`):
- **`continueHitless`.** Each open hitless prefix (the tree's frontier, or the witness's held set) is taken in the tree's
  own order. For each member of the SAME alphabet, in its own order, one fork plays the prefix and then HOLDS that member
  until one of:
  - the room is left;
  - a hit or a death is billed;
  - the model refuses a tick;
  - `FORCED_HITS.continuationTicks` (30) is reached.

  The first sequence that leaves the room with no hit and no death is the proof's `crossing` (`{keys, transition, ticks,
  label}`). The open verdict is kept as `openWhy`, and `continuation: {nodes, why}` is always reported.
- **What feeds it.** It runs on every open exit of the proof: the node-budget refusal, the advance-budget refusal (depth > 1)
  and the end of `depthMax`. The tree's and the witness's own hitless crossings are carried the same way.
- **The rung** (`solverBot.js`, rung 6, a local hunk). A proof `crossing` that leaves by the walk's exit is replayed on the
  live run. The replay must cross on its last key with no hit, or it `fail`s ("the fork is not this run").
  - Row: `forced-hit` with `candidate: 'hitless-continuation'`, `billed: []`, `proof.proven: false`.
  - Census row `outcome: 'hitless'`.
  - Return `{forced: {transition}}`, the shape the billed crossing already uses.
- **No single-game code.** The X+C tick is one alphabet member. The hold is the witness's own shape (one held set,
  carried), and the tie order is the alphabet's, UNCHANGED. A prefix ending on `·` is therefore first continued by
  standing. On leg 612 that crosses at t4 on the slash-dash's velocity. The docblock argues this.
- **Untouched.** js's forced-hit continuation guard, `solveSegment`, and the alphabet's order.

**Measurement (ON):**
- `proveForcedHit(fork622)`: `proven: false`, `nodes` 1,333 (1,342 with the witness first), `crossing.keys =
  [up+P+S, ·, ·, ·]`, t4 → L74.
- `solve622`: SOLVED in 4 ticks, `verbs ['forced-hit']`, `expected.at(-1)` level 74, deaths 0.

**Witness** (`fixtures/secondary-use-witness/secuse-l73-622-xc-stand.json`). Recorded with
`probe-seedling-secondary-use.mjs --record` on p4g, headless, port 9764, run twice. The arms are in `evidence/arms-xc-stand.json`.
- `XC-stand` (the plan): crosses at t4, 0 hits.
- `XC` control: equals C4's recording sample for sample.
- Its first 4 ticks equal `XC`: the slash freezes the walk, so holding `up` adds nothing.
- The model steps the plan's keys onto every `XC-stand` sample (0 px).

**Mutants**, each predicted before it was run (copy + edit + restore, `fidelityForcedHitXc.test.js`):

| mutant | predicted | result |
|---|---|---|
| M1: `carryOn` inert | ON rows red, OFF green | 7 ON rows red, OFF green ✔ |
| M2: the gate removed (`continuing = true`) | the OFF open-verdict row red | exactly that row ✔ |
| M3: the rung's walk disabled | the two ON solve rows red | exactly those ✔ |

## D2 — the leg-622 chain re-pinned per arm

Before this slice, the rows read the ambient `secondaryUse`, so `SEEDLING_SECONDARY_USE=1` turned 11 of them red. Now:
- **OFF** (`withContactFidelity({secondaryUse: false})` or a describe-level `beforeEach`): the existing rows are unchanged.
  - `fidelityForcedHit` (D1 proof ×4; the crossing describe's module-level proof; leg 622 D2 ×2).
  - `fidelityStagedHits` (the proof at hitsMax − 1; the staged 0/1/2 solves).
  - `fidelityUnbilledGate` (the billed control).
- **ON siblings**, the game's (witness `XC-stand`; 0 hits):
  - stagedHits staged 0 solves `[up+P+S, ·, ·, ·]`, billing nothing.
  - At hitsMax − 1 the proof carries the X+C crossing (no leaf of it is hit, so none dies).
  - unbilledGate sees `billed 0, unbilled []` and passes.
  - `fidelityForcedHitXc` pins staged 1/2 solved and the ON solve's census rows.
- `fidelitySecondaryUse`'s D1 row: the follow-up it named is done. It is re-pinned to the crossing (`hitless 'up+primary+
  secondary · · ·'`, `crossing.ticks 4`, `openWhy` the old verdict).
- Green under `=0` and `=1`: 81 / 81 over 5 files.
- **The flip owes** `contactFidelity.test.js`'s defaults row (`secondaryUse: true`). I did NOT flip the default.

## D3 — flip readiness with `SEEDLING_SECONDARY_USE=1`

The first battery found three defects. Each is a real behaviour, fixed under the switch, and each has its own mutant.

| # | found by | the defect | fix | mutant |
|---|---|---|---|---|
| 1 | `fidelityForcedHitWitness` (3 rows, fake quiet room) | the continuation spent the proof's whole leftover budget (668 forks at leg 622's shape, up to 2,000 in a quiet room). That is the cost the SEARCHGAPS witness exists to save | `FORCED_HITS.continuationForks` 36 (one alphabet's width); leg 612 needs 1 | M4: cap removed → horizon row red ✔. ⚠ **My prediction was wrong** for the quiet-room row: it stayed green, because a witness prefix has only 36 holds and the cap does not bind there |
| 2 | `fidelityLapseCost` › MUTANT (L40 leg 403, budget 160) | ON it SOLVED. The continuation held `up` from the arrival and left by the ARRIVAL door `in_L43_176_464`. That is level 43, as is the goal `out_pit_13_20`, so the rung's level check passed it | `crossingMatches(crossing, crossTo)` = `botDriverV2.drive`'s own `crossTo` test (the level, then the pit tile under the pre-move terrain probe, or the arrival point exactly). `proveForcedHit` takes `crossTo`: the continuation searches on past another exit, and a tree/witness crossing is carried only when it is the walk's. Leg 403 ON now refuses word for word as OFF (proof nodes 1 → 37) | M5: level-only match → 3 rows red ✔ |
| 3 | identity block: the acceptance batch md5 moved ON (`cf54cdf7` → `a9be05a2`) | post-shield seed 2, a `collect` goal's refusal text read "(37 fork step(s))" for "(1 …)". The continuation ran where no crossing could ever be walked | `proveForcedHit({continuation: false})`, passed by the rung when the walk has no `crossTo` | M6: flag ignored → its row red ✔ |

The control for #2 and #3: with the continuation inert, ON is the base (LapseCost green; acceptance `cf54cdf7`). Both were
mine, not C4's.

**The final battery ON, at head `46ace862`:**

| gate | command | ON result |
|---|---|---|
| bounded vitest (92 files: the brief's list + every `grep -a` hit for `forcedHit`, `FORCED_HIT_ALPHABET`, `hitlessWitness`, `secondaryUse`, `SECONDARY`, `proveForcedHit`, `FORCED_HITS`, surface/constants, `dashShape`, `dashOnlyWindow`, `jsRuntimeSolverShouldStop`; `evidence/bounded-files.txt`) | `SEEDLING_SECONDARY_USE=1 npx vitest run <files>` | **89 / 92 files, 2,350 passed, 4 failed** (`evidence/bounded-on.txt`) |
| the six @ci-box `--check`s + identity rows | `SEEDLING_SECONDARY_USE=1 bash scripts/procgen/identity-block.sh .` | **every row = the base** (`evidence/identity-head-on.txt` vs `identity-base.txt`) |
| `ci-producer-checks.mjs --jobs=3` | `SEEDLING_SECONDARY_USE=1 …` | **97 run, 0 red**, 1 skipped (`evidence/producers-on.txt`) |
| slow files (`fidelityL32ArenaPrefix.slow`, `fidelityL40Bk2.slow`) | `--config vitest.slow.config.js` | 2 / 2 files, 6 / 6 |

**Every ON red, attributed.** All 4 are the env, not behaviour. The env makes the live switch object off-default, and a
real flip moves the default with it.
1. `contactFidelity.test.js` › *the shipped defaults*: `secondaryUse: true` against the table. This is the re-pin the flip
   owes.
2. `dashOnlyWindow.test.js` ×2 and 3. `dashShape.test.js` ×1 (*"the default adds no field"*, `stampHooks`): the request
   stamps `contactFidelity` because the live object is off-default. After a real flip they are green with no edit.

The L4 dash margin: `dashShape`, `dashOnlyWindow` and `jsRuntimeSolverShouldStop` were in the set. Their only reds are the
stamping rows above, and the work-unit rows are green ON. The continuation is never asked on L4's dashless path.

`jsRuntimeTape` `NO_TAPE_CHAIN`: I added no `contactFidelity.js` key, so it does not move.

## Movers (key ON) and the dispatches to confirm them

| instrument | OFF | ON | moved |
|---|---|---|---|
| leg 612 (node, `solve622`) | DONE, forced-hit, 1 hit | DONE, hitless, 0 hits | **failed → DONE** (the C4-base ON arm was FAILED) |
| L40 leg 403 (LAPSECOST request, budget 160) | REFUSED, detour budget | REFUSED, the same text | 0 (proof nodes 1 → 37) |
| local full survey (`--through=end --route=full --timeout=1500`) | 201 / 36 (237 rows) | 201 / 36 | **0 verdicts, 0 ticks.** Steps **118** (L88), **177** (L75) and **219** (L103) are REFUSED → REFUSED, and only the fork count in the refusal text changes (`(1 fork step(s))` → `(37 …)`: the 36 holds, none of them by the walk's exit). `evidence/survey-full-off-vs-on.txt` |
| acceptance batch, ENEMY, producers | base | base | 0 |

⚠ The local survey has 237 rows / 201–36 against CI's 240 / 203–37 at W35. The brief's baseline was on the CI fleet, and
this box's derivation differs by 3 rows in both arms alike. Compare the CI A/B, not this count.

**Dispatches for the planner.** I cannot dispatch. Branch `claude/seedling-fidelity-wave-36-y0bcw0`.
1. **Survey ×2 per arm:** `seedling-survey.yml`, `through=end route=full`.
   - OFF arm: the head.
   - ON arm: a throwaway commit flipping `secondaryUse: true` in `contactFidelity.js`.
   - Expect 0 verdict moves. Steps 118/177/219 should change refusal text only.
2. **Full divergence sweep ×2 per arm:** `seedling-divergence-sweep.yml`, `contact_fidelity=<evidence/sweep-arm-on.txt>`
   (the 105 default-ON keys + `secondaryUse`, comma-joined) vs `<evidence/sweep-arm-off.txt>` (the 105).
   - Expected: leg 612 failed → **done**, 0 hits.
   - Any other leg that moves must be matched by KEY and confirmed on a ×2 repeat, with `capture_requests=true`.
   - The 37-fork refusal text also appears on any leg whose witness verdict reaches the rung with a `crossTo`.
3. **Probes:** `seedling-probe.yml battery=standard` on the ON throwaway branch (the browser reads the defaults). Grade
   logical-links B,R as KNOWN RED. Also run `probe-seedling-secondary-use.mjs` with `evidence/arms-xc-stand.json` to
   re-witness.

## For the other arcs

- **JS arc:**
  - No signature changed. `proveForcedHit` gained two OPTIONAL options (`crossTo`, `continuation`). `crossingMatches` is a
    new export.
  - New trace and census values: `FORCED_HIT_TRACE` outcome `'hitless'`, and `candidate: 'hitless-continuation'` with
    `billed: []` on a `forced-hit` row. The divergence producer's `forcedHits[].billed` is unaffected (no `forcedHits` row
    is pushed for a hitless crossing).
  - The JS arc may want a distinct verb for a 0-hit rung crossing. Today it is `forced-hit` with `proof.proven: false`.
  - No `run.*` field was touched.
- **Hammer:** nothing handed over, and no hammer region was edited.

## What the brief got wrong (measured)

- *"180 prefix(es) … (1332 nodes, depth 3)"*: at the defaults (`forcedHitWitnessFirst` ON) the node count is **1,341**.
  1,332 is the tree alone, as the D1 row measures it with the witness OFF.
- *"C4's bounded set … forcedHit 4, stagedHits 4, unbilledGate 1"*: at this base `SEEDLING_SECONDARY_USE=1` reds **6**
  forcedHit rows. The crossing describe's two budget rows consume the module-level proof, so they red too. The other
  counts are 4 stagedHits and 1 unbilledGate.
- *"expected ON movers = L73 leg 612 only"*: true after D3. The naive continuation also moved L40 leg 403 to a false SOLVE
  through the arrival door, and the acceptance batch's digest. Neither is in the survey or the sweep's keyed sets, so the
  bounded battery is what caught them.
- The leg id is **612** at this base (622 earlier), as the brief said ids shift.

## Residue

- The continuation's tie order (`·` first) makes the plan stand still after the X+C tick. That is game-true here
  (witnessed), but a hold of `·` on another leg is a different walk. Every crossing is the model's, stepped and replayed,
  so a wrong guess there is a model gap, not a planner one.
- A refusal now carries `(37 fork step(s))` wherever the witness's quiet-room verdict meets a walk with an exit (3 survey
  steps). That is text only. If the planner wants the text frozen, the continuation's own `why` could stay off the
  refusal; I left the count honest.
- The `XC-stand` witness covers leg 612 only. No other leg's hitless continuation is game-witnessed; none moves.

## Byte-inertia

- OFF, `continuing` is false: `carryOn` returns its verdict unchanged, and the crossing objects are never attached. The rung's
  new branch needs `proof.crossing`, which is never set OFF. The witness/tree loops' new `before` reads are inert.
- **Bounded set AFTER (OFF, head `46ace862`): 92 / 92 files, 2,354 / 2,354** (`evidence/bounded-after.txt`). It is 91 files
  before plus the new `fidelityForcedHitXc`.
- Identity block at the head (OFF) is equal to the base. No tape, roster, fixture-tape or producer `--check` digest moved.
  The roster is unchanged; the new fixture is a secondary-use witness, not a tape.

## Records

- `seedling-bot.md`: the hitless-continuation paragraph.
- `seedling-bot-log.md`: the entry, with two trap candidates.
- `seedling-solver-surface.json` (`--write`, `--check` GREEN 365 rows). `forcedHit.js` imports through the `solverView`
  door.
- The docs index and README region were regenerated. Constants census: green in the bounded set.

## Rows to BANK

- `fidelityForcedHitXc.test.js` (18 rows: witness ×3, D1 ×7, D2 ×3, D3 ×5).
- The leg-622 OFF/ON pairs in `fidelityForcedHit` / `fidelityStagedHits` / `fidelityUnbilledGate` / `fidelitySecondaryUse`.
- Fixture `secuse-l73-622-xc-stand.json`.
