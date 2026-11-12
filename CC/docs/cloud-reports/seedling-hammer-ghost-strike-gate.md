# Seedling hammer-phase — GHOST-STRIKE-GATE: a Ghost-Sword-only run never presses a swing the game ignores

Slice `seedling-hammer-ghost-strike-gate` (Opus, cloud), planner `seedling-hammer-phase-planning-6`. ⚖ Approved by the
user 2026-11-12 (the hammer replan). Landing it needs the user's own SHA-bound OK (the planner asks).

## 1. SHAs

| | |
|---|---|
| Start SHA (base) | `fe98f37f22` (origin/main, "train: content-r3 5c5714d585") |
| Head | the commit carrying this report (the code head is `930f203d7a`) |
| Branch | `claude/seedling-ghost-sword-strike-wi0uv1` |

No planner follow-up arrived during the slice; nothing outside this brief was done.

## 2. The answer first

- **Switch:** `GHOST_STRIKE_GATE` (`frontend/modules/seedlingDemo/ghostStrikeGate.js`), env `SEEDLING_GHOST_STRIKE_GATE=1`,
  wrapper `withGhostStrikeGate(enabled, fn)`, in `SOLVER_ENV_NAMES`. **Ships OFF.** Read on the solve **worker's** thread
  only (`solverBot.js`); no page main-thread mapper reads it.
- **The one thing to know first:** no AP route can produce this inventory. The flash bridge hands the game the Ghost
  Sword only with the full recipe (the Fusion flag + Spear + a Sword copy). Measured: 0 of 936 seed-1 sweep legs, 0 of
  936 ER legs, and 0 game-held spheres across 7 randomized seeds put the Ghost Sword up without the Sword. Within the
  solver, though, the defect is large wherever that inventory is staged.
- **The defect, measured** (723 exit legs of the seed-1 leg list, each staged at its arrival with the Ghost Sword +
  Spear and no Sword): OFF, **521 legs die with a plain `levelRun` Error** at a ghost press (`ghostSwingRefusal`), not a
  `SolverRefusal`. The walk's **dash** causes most of them: the first throw is at tick 0 in a room with no strike body.
- **ON:** **0 of those throws remain.** 468 of the 521 now SOLVE (**0** `primary` presses in any of them; 465 hitless,
  3 take hits), 33 are named `SolverRefusal`s, 18 run past the 240 s per-leg cap, and 2 reach a different, pre-existing
  throw (an arrow kill opening a kill lock, the same as the Sword's). Sword-only and both-held runs are untouched: 0 of 723
  both-held rows differ OFF vs ON, and the acceptance md5 is the same ON and OFF.
- **What the game does honour for this inventory:** read in the AS3, not measured: a dash knockback on every press after
  the first, because `slashTimer` is frozen. It is **not used**: `levelRun` refuses to model that state, and the model is
  the fidelity arc's (§9).

## 3. The reproduction (measured)

### The game (AS3, `vendor/seedling` @ the pinned source)

| site | line | what a Ghost-Sword-only player gets |
|---|---|---|
| `Player.update` | `Player.as:560-563` `if (hasSword) { slash(); }` | **`slash()` never runs**: no hit test, no `slashTimer`/`slashDelay` count-down |
| `useItem` case 0/4 | `:1578-1585` `if (slashDelay <= 0) slashing = true` | `slashDelay` stays 0, so every press reaches the setter |
| `set slashing` | `:782` `if ((hasSword \|\| hasGhostSword) && !wanding …)` | it plays: animation, sound; `:784-790` with `slashTimer > 0` and `!slashDashed`, `knockback(2, …)` (the dash) |
| `slash()` | `:892-928` | the test and `genericHit(…, hasGhostSword ? "Spear" : "Sword", …, ghostSwordDamage)` are unreachable |
| `Inventory.addItemsFromSave` | `Inventory.as:291-330` | item 4 replaces the sword (0) **and** the spear (3) slots, so there is no thrust either |
| `Pickups/GhostSword.as` | `:45` | `Player.hasGhostSword = true` with no Sword test (the vanilla pickup) |

**Game-measured** (`probe-seedling-ghostsword-items.mjs`, the default p4g build, headless logic-only;
`evidence/game-ghostsword-items.txt`, ALL CHECKS PASSED). With `ghostsword` alone and one press:
`slash: {hits: 0, tests: 0}`, slots `[4]`; the L3 ghost rock is not broken, the L63 pole is not lit, and the spear block
does not move. With the Sword added, the same presses ran 7 tests and broke, lit and pushed. Delivery rows: the bridge
writes `ghostsword` for `ghost-spear-sword` only.

### The solver sites that read `hasGhostSword` as a strike enabler (`rg -a` at base)

| site (solverBot.js unless named) | what it gates | Ghost-only, OFF | this slice |
|---|---|---|---|
| `strikePolicyFor` (`:6605`) | the walk's strike / dash policy | builds a policy; presses `primary` | **gated** (`bladeSwings`) |
| `planSwordDash` (`:8039`) | the walk's dash schedule | plans dashes, which press at t0 | **gated**, refuses by name |
| press-kill gate (`:13277`) | the kill work order's sword check | admitted | **gated**, named |
| `execBobBossEncounter` (`:1617`) | the encounter's own strike search | presses at t58 (L32) | **gated** (ON-only, named) |
| chaser arm `swordless` (`:31069`) | skip the stance scan | scans, then `strikePolicyFor` | not edited: ON, `strikePolicyFor` is null and the arm refuses ("holds no sword") |
| axe crossings (`:29634`, `:31487`) | the dash-chain families | dash chains via `strikePolicyFor` | not edited: ON, every family's policy is null (residue §9) |
| re-equip (`:32991`) | wait for a sword slot | — | not a press; untouched |
| `ghostSword.ghostSwingRefusal`, `:11001`, `:11940`, `:13579`, `:22421`, `ghostRopeCut.js:70` | ghost verbs (spinner, rope, rock, pole) | already refused by name | untouched |
| `jsRuntimeSolver.PASS_STRATEGIES['sword-dash']` | skip the dash pass | admits the pass | not edited (residue §9) |
| `strikeSlot.pressIsBlade` (`STRIKE_SLOT`) | the selected slot is a blade | `ghostsword` is a blade | untouched (orthogonal: slot, not hit test) |

### Who reaches it (step 2)

`evidence/premise-inventories.txt`. The legs list (`seedling-divergence-legs.mjs`) is generated from the AP sphere
inventories:

| source | legs / spheres | holds the Fusion | Fusion without Sword |
|---|---|---|---|
| `seedling_playthrough` (the seed-1 sweep list) | 936 legs | 75 | **0** |
| `seedling_er` | 936 legs | 61 | **0** |
| 7 randomized seeds (`Seedling.yaml`, seed 1 + 6 local) | 280 spheres | — | 12 spheres in one seed (Fusion at 1.11, Sword at 2.11) |

In that one seed the bridge's recipe (`requires_progressive: {"!sword": 1}`) withholds `ghostsword`, so the game holds
no Ghost Sword there. **So no route leg, randomized or ER, reaches a strike with Ghost Sword and no Sword.** The
inventory exists only where the flag is written directly: a staging's items (rows, probes, censuses), `Bot.as`
`grantItem`, cheats (which grant both), or a vanilla sequence break.

### The solver, staged (the census)

`evidence/census-exit-legs.txt` (one row per leg; the probe is `evidence/ghostprobe.mjs.txt`). Every exit leg of the
seed-1 list, staged at its arrival with `fidelityArrival.arrivalStaging(boot, {items})` and solved by `solveSegment`
with a `forkRun`, node only:

| bag | OFF | ON |
|---|---|---|
| Ghost Sword + Spear (no Sword) | **521 GHOST-SWING-THROW**, 174 REFUSED, 23 SOLVED, 5 other THROW | **0** GHOST-SWING-THROW, 491 SOLVED, 195 REFUSED, 7 other THROW, 30 over 240 s |
| Sword + Ghost Sword + Spear | 540 SOLVED, 172 REFUSED, 11 THROW | identical, row for row (0 of 723 differ) |

Ghost-only, OFF → ON: 521 throws → 468 SOLVED (0 presses, 3 with hits), 33 REFUSED, 18 over 240 s, 2 to the arrow-kill
throw. The rest: 162 REFUSED stay REFUSED, 12 REFUSED → over 240 s, 23 SOLVED stay SOLVED, 5 throws stay throws.

First reproduction, by key: `level_0__r7c6 <- in_L2_48_16 -> exit:out_teleporter_0_128` threw
`levelRun: the ghostsword press at tick 0 in level 0: the run holds the GHOST SWORD and not the sword…` at `applyThrust`.
The call chain was `walkExit → walkTo → walkToUnder → drive → advance`, with **0** strike bodies: the walk's planned
dash. With both swords held, the same leg solves in 154 t with 19 presses.

## 4. Design + change, OFF identity

- `ghostStrikeGate.js` (a family file; it imports `ghostSwingRefusal` through the `solverView.js` door):
  - `bladeSwings(inv)`: OFF it is `!!hasSword || !!hasGhostSword`, the expression every gated site read before. ON it is
    `hasSword`, because `slash()` runs only `if (hasSword)`, whichever sword's sprite swings.
  - `ghostOnlyWhy(inv)`: ON, `ghostSwingRefusal`'s words for a Ghost-only run. Otherwise (OFF, or another bag) it is
    null, so OFF messages are byte-identical.
  - `GHOST_STRIKE_GATE_COUNTS.gated` is the instrument (ON only).
- `solverBot.js` (local hunks: one import plus four sites, no reformatting): `strikePolicyFor`, `planSwordDash`
  (refuses `no dash: <ghostSwingRefusal>`), the press-kill gate (`no press kill: …`) and `execBobBossEncounter` (before
  `searchEncounterStrike`: `<what>: no strike on form N: …`, obstacle `{kind: 'encounter', id}`).
- `solverEnvChannel.js`: `SEEDLING_GHOST_STRIKE_GATE`, sorted in.
- **OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`:
  - base `fe98f37f22` (the brief's value): `391322d681b7aa0229d94b3f6906d024`
  - head `7b1d4db99c`, OFF: `391322d681b7aa0229d94b3f6906d024`; ON: the same
  - head `930f203d7a` (after the BobBoss hunk), OFF: `391322d681b7aa0229d94b3f6906d024`; ON: the same
- Regenerated and `--check` green: `census-seedling-solver-surface.mjs` (372 rows; against base the diff is the new family
  file and one more env-read site; the `run.progress` counts end where they began), `generate-procgen-reference.mjs` (no change), `generate-docs-index.mjs` (no change).

## 5. Rows + bounded vitest

`frontend/modules/seedlingDemo/hammerGhostStrikeGate.test.js` has 11 rows, default tier, about 6 s:

- the switch ships OFF, and its env name is listed;
- the `bladeSwings` truth table, OFF and ON;
- `ghostOnlyWhy` and the instrument;
- the L0 witness (`level_0__r7c6 <- in_L2_48_16 -> exit:out_teleporter_0_128`):
  - OFF, Ghost-only throws at t0;
  - ON, Ghost-only SOLVED in 223 t with 0 presses and 0 hits;
  - ON, `strikePolicyFor` is null and `planSwordDash` refuses by name;
  - Sword-only and both-held: ON keys equal OFF keys, and OFF has presses;
- the L32 encounter (`level_32 <- in_L30_224_160 -> exit:out_pit_14_5`):
  - OFF, Ghost-only throws at t58;
  - ON, refused by name before the strike;
  - both-held: ON equals OFF.

Mutants run red (at `bce73302a9`, before the encounter rows existed): m1 (`bladeSwings` ignores the switch) turned 4
rows red, and m4 (`planSwordDash` ungated) turned 2 rows red. m6 is the encounter row's own OFF/ON pair.

The bounded set (8 files: `hammerGhostStrikeGate`, `hammerStrikeSlot`, `fidelityFireBreak`, `hammerGhostSpinner`,
`ghostMotion`, `solverEnvChannel`, `hammerGhostRope`, `combatVerbs`) at `930f203d7a`:
- OFF: **148 passed**
- `SEEDLING_GHOST_STRIKE_GATE=1`: **147 passed, 1 skipped** (the ships-OFF row, by design)

The output is in `evidence/vitest-{off,on}.txt`. The unfiltered suite is CI's (ruling 52).

## 6. Page play / game witness

- **Game measurement** (§3): a Ghost-only press runs 0 tests and 0 hits on the default p4g build. That is the premise
  this gate rests on.
- **Not built:** a p4g replay of a changed plan. The changed plans contain no swing press (0 of 468), so on the game they
  are plain walks with an inert item. The walk itself is the swordless walk the arc already witnesses. A replay would
  re-witness that walk, not the gate, so the effort went to the census instead.

## 7. Census: the seed-1 divergence-sweep legs the change can move

**None.**
- `bladeSwings` differs from the old read only when `hasGhostSword && !hasSword`. `ghostOnlyWhy` (the encounter hunk) is
  non-null only then.
- The seed-1 list holds that inventory on 0 of its 936 legs (75 hold the Fusion, all with the Sword).
- Measured: 0 of 723 both-held exit legs differ OFF vs ON, and the acceptance md5 is identical ON.
- The only rows that move are staged Ghost-only requests (rows, probes, censuses) and any future seed or staging that
  writes the flag alone.

## 8. What the brief got wrong (measured)

- *"the question is ONLY the Ghost-Sword-without-Sword inventory (randomized / ER seeds)"*: no randomized or ER seed
  produces it. The AP delivery is a fusion with `requires_progressive: {"!sword": 1}`; the inventory is unreachable
  through AP (§3, 0 legs, 0 game-held spheres in 7 seeds). It arises from direct flag writes only: stagings, `grantItem`,
  or a vanilla sequence break.
- *"`strikePolicyFor` (and the walk's strike) … press `primary`"*: the throw that dominates is the walk's **dash**
  (`planSwordDash` / the policy's `dashPlan`), at t0 with no strike body. The body-driven strike is a minority case, and
  the encounter executor presses on its own (L32).
- *"refuses BY NAME"*: the gates refuse by name where a swing is the plan's own verb (dash, press kill, encounter). Where
  a swing was one option among others, the run now walks without one. 31 of the 33 new refusals are the ladder's own
  named obstacles (combat ladder exhausted, danger map, no corridor), not the ghost's words.

## 9. Residue / hand-overs

- **Fidelity arc (hand-over):** the Ghost-only dash. In the game each press after a room's first is `knockback(2, …)`
  (frozen `slashTimer`); `levelRun` throws instead (`ghostSwingRefusal`: *"a state this model does not carry"*).
  - To use it, `levelRun` and `combatVerbs` must carry a frozen `slashTimer`/`slashDelay`; this slice must not edit them.
  - Rows to hand over: the 521 Ghost-only legs in `evidence/census-exit-legs.txt`.
  - Also for the fidelity arc: give `levelRun`'s ghost throw a `code`, so `REFUSAL_BY_NAME` turns any press site this
    gate missed into a named refusal rather than a crash (60 `'primary'` press sites in `solverBot.js`; this census
    exercised exit legs only).
- **Location legs not censused:** encounters, bosses and pickups. `execWitchEncounter`, `execLavaBoss` and
  `execTotemBoss` were not audited for a Ghost-only press. The two Ghost-only throws the exit census found (L32) are
  closed.
- **Cost, ON:** a Ghost-only run in a combat room now searches the ladder without strikes, sometimes for minutes.
  - L6 `level_6 <- in_L7_16_32 -> exit:out_teleporter_32_0`: 109 s, then a named refusal.
  - 30 legs passed 240 s, among them 24 L40 pit legs and 4 L22 legs.
  - Economies left untouched:
    - `jsRuntimeSolver.PASS_STRATEGIES['sword-dash']` still admits the dash pass for this run, which then repeats the
      dashless pass;
    - the axe crossings (`:29634`, `:31487`) still build dash-chain families whose policy is now null.
  - Each is a one-line `bladeSwings` read if the planner wants it.
- **Wording:** ON, the chaser arm still says "this run holds no sword" for a Ghost-only run. It is accurate about the
  hit test but does not name the Ghost Sword.
- **Not done:** no flip proposed (the switch is a refusal-quality fix for an inventory AP never delivers); no docs page
  edited (`docs/json/developer/procgen/` untouched, so no link-census pins owed); no preset committed (the 6 local seeds
  and `preset_files.json` were reverted).
