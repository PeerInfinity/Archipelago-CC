# Seedling fidelity REFUSALS (wave 36) — the unowned survey refusals

Session `seedling-fidelity-refusals`, planner `seedling-fidelity-planning-17`.

- **Start SHA:** `b646d32d95b4ebd636a70f05886957deffbf724a` (main; 105 ON of 116).
- **Harness branch:** `claude/seedling-fidelity-refusals-w0r4m3`.
- **Head:** the commit that carries this report (identity-block file md5 `2d3ccf1c`, run at `3f368cf4`). Code commits: `95c5763a` (D1), `6d428ffd` (D2), `3f368cf4` (D2b, D2's narrowing).
- **New keys** (appended at the END of the defaults, both **OFF**, byte-identical): `chestBodyPlacementProbe`, `inPitFallOut` → **105 ON of 118**.
- `solverEnvChannel.js` does not exist at this base, so the two new env reads (`SEEDLING_CHEST_BODY_PLACEMENT_PROBE`, `SEEDLING_IN_PIT_FALL_OUT`) need no `SOLVER_ENV_NAMES` line yet. When CPWIT lands, they need one.

## Summary

| row (step at this base) | class | D | verdict |
|---|---|---|---|
| L25 chest-in-rock2 (35) | MODEL misread, then a **RULES** row | D1 | **PASS (moves the wording only)**, plus a rules hand-over |
| L84 start tile (174, 202) | **PLANNER** gap | D2 (+D2b) | **PASS: both steps REFUSED → SOLVED, 100 t, 0 hits** |
| lavatrap L77 (182), L78 (183) | **MODEL** gap: LavaTrap is not stepped at all | D3 | **STOP**: scoped below |
| lavatrap L108 (226) | **MODEL** gap: the dark-suit ferry | D3 | **STOP**: the same cause |
| rocklock L112 (233) | **VERB** gap: no Owl fight executor; the Owl itself is modelled | D4 | **STOP**: a BOSSKILLS-sized verb, scoped below |

The one thing to know first: **L25's chest is not reachable from the visit the route stages.** `Chest.update` opens only on
a player touching the line ONE PIXEL BELOW the body. The only cell there, (6,7), is a pocket. A tree, `rock2@112,112` and the
chest seal it, and it is entered only by L28's `teleporter@96,0 → L25 (96,112)`. The rules put "Level 025 - Chest" in the
single region `level_25`, and the survey boots L25 from L22 (128,32). That is a **rules row**, handed to rules (not edited).

## W0 — the refusals reproduced at the base

Command: `SEEDLING_PORT=9768 node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=35,174,182,183,202,226,233 --out=…`.
Step ids at this base (237 steps): W35's 174/205 → **174/202**, 229 → **226**, 236 → **233**. Matched by (level, goal, boot).
All seven reproduce as REFUSED:

| step | L | refusal (quoted, cut) |
|---|---|---|
| 35 | 25 | `chest (96,96): the placement is INSIDE solid:rock2 (rock2@80,96) — a pickup in a solid is an obstacle, not a stance problem. No strategy row exists for this obstacle.` |
| 174, 202 | 84 | `no corridor for goal reach-pit toward (56,24) in level 84. Obstacle: no-corridor. … A* start tile (2,2) in level 84 — for (40,40) — is not walkable: pit Pit (t=6) at tile (2,2).` |
| 182 | 77 | `Obstacle: proximity-hazard:lavatrap (lavatrap@96,192). No strategy row exists … different connected components` |
| 183 | 78 | `Obstacle: proximity-hazard:lavatrap (lavatrap@144,48); also on the frontier: lavatrap@144,96. No strategy row exists` |
| 226 | 108 | `Obstacle: proximity-hazard:lavatrap (lavatrap@128,80). No strategy row exists` |
| 233 | 112 | `Obstacle: solid:rocklock (rocklock@112,16) … ENCOUNTER-GATE (rocklock@112,16): no presser in level 112 publishes its group; its opener is finalboss@64,96's death` |

Inventories (the boots' `saveGrant`): steps 182/183 hold `hasWand`, `hasDarkSword`, `hasFire`, `hasSpear`, and **no `hasDarkSuit`**.
Steps 226/233 hold `hasDarkSuit`.

## D1 — `chestBodyPlacementProbe` (L25): **PASS, wording only**

**Measurement.** `world.chests` rows (`levelWorld.js:5649`) carry `{id, tag, x, y, persistTag}` and **no rect**, so
`placementBlocker` probed `{x: t.x, y: t.y}`, the OEL cell's top-left CORNER. The player box there (4 px wide, `seedlingProfile.js:193`)
spans x 94–98 and overlaps `rock2@80,96` (x 80–96). The game's chest: `Chest.as:27` `super(_x + Tile.w/2, _y + Tile.h/2)`,
`:30` `setHitbox(16, 16, 8, 8)`, so the body is the cell x 96–112, y 96–112. The model's own Solid agrees (`solid chest
{"x":96,"y":96,"w":16,"h":16}`). Rock2 = `Rock(x, y, 1)` → `Rock.as:15` `setHitbox(16,16)`, which covers x 80–96. They
**touch at x = 96 and do not overlap.**

**What the brief got wrong (measured):** *"Chest.as:30 … covers x 88–104, y 88–104. They OVERLAP by an 8×8 corner."* The brief
missed `Chest.as:27`'s `+ Tile.w/2` ctor offset: the chest covers 96–112, with **no overlap**. rules-4's guess (*"an inclusive-edge
point test"*) is also not the cause. The test is a box test at the wrong point.

**Change.** `solverBot.placementBlocker`: ON, a `chest`-strategy target with no rect is probed at `(x + 8, y + 8)`. OFF byte-identical.

**Result ON (step 35):** the misread is gone, and the next refusal is truthful:
`chest (96,96) stance: STANCE_REENTRY — the walk to chest@96,96's chest stance (104,114) is itself blocked by chest@96,96 at
tick 0, … the 8 px lattice plans no corridor to it either.` `Chest.update` (`Chest.as:61-64`) opens only on
`collideLine("Player", x - originX + 2, y - originY + height + 1, x - originX + width - 4, …)`, the row one pixel under the body.
L25's tile map around the chest (16 px; `t` tree, `2` rock2, `C` chest, `@` teleporter, `p` pole):
```
 5 tt......tt
 6 @..rr2C.tt
 7 tttttt.2tt      (6,7) — the only cell under the chest
 8 tttttt@ptt      teleporter@96,128 → L28
```
(6,7) is sealed by `tree@64,112`, `rock2@112,112` and the chest (corner contacts only). Its one way in is L28's
`<teleporter x="96" y="0" to="25" playerx="96" playery="112">` (`Dungeon3/7.oel`). The boot is `L25@128,32` (from L22's
`teleporter@0,128`).

**⇒ RULES HAND-OVER (STOP for the rest of L25):** "Level 025 - Chest" is `LocationData("level_25", …)` (`worlds/seedling_playthrough/Locations.py:53`),
one region for the whole level. In the game it needs L28's north door. Proposed rules row: a `level_25_chest_pocket` region
entered from L28 (`teleporter@96,0`), exiting only back to L28 (`teleporter@96,128`), holding the chest. The route then visits
it from L28. With D1 ON and that rule, the stance (104,114) is the arrival cell itself. Not edited (no rules edits).

**Movers (local survey, all 16 chest steps 11,15,18,25,35,46,48,59,67,73,75,88,176,198,205,214, OFF vs ON):** only step 35's
refusal TEXT moves (REFUSED → REFUSED). Every other row is identical in verdict, ticks and refusal.

**Mutant** (predicted first): probing `(x, y)` with the key ON (= OFF behaviour) brings back step 35's `INSIDE solid:rock2`. That
is the OFF arm itself, measured above.

## D2 — `inPitFallOut` (L84): **PASS**

**Measurement.** L84 = `OverWorld/fallhole1.oel`: 5×5, the 3×3 middle is one pit (`control fallthrough="85"`). A fall lands the
player inside it, and `Player.checkFallingInPit` drops it again with no input. The MODEL steps that fall: idling the step-174 boot
from (40,40), the run is in L85 at **tick 19** (`advance(new Set())` × 20). The solver's reach-pit walk plans an A* whose start
tile (2,2) is a pit other than the goal's (3,1), and only the goal's tile is `allowPit`. `solverBot.js`' own L1516 comment
already named this exact case (*"a fall that lands the player in the pit already (L84 (2,2), sweep leg 671, from the L83 pit) is
the walk's, as before"*). ⇒ a **PLANNER** gap.

**Change** (`execReachPit`, before the L1516 corner arm). ON: if the start's 16 px cell is a pit tile other than the goal's, its
terrain probe overlaps it, and its `fallDestination` is the goal's level, then step `NO_HELD_PREVIEW` until the edge (bounded by
`maxTicksPerTarget`; no edge → a named refusal, obstacle `pit`), then `coastThroughTransport`. The record carries an optional
`standing: {tx, ty, idle}`. OFF byte-identical.

**D2b (narrowing, measured).** The first cut (any probe overlap) idled two JS-arc pin rows with the key ON:
`jsRuntimeVerbs` S4 *"L48 (bare): reach-pit by a walk → L49"* (a live start beside a pit's edge) and `wasmArrivalComposite` W4
(L84 (1,1): a start ON the goal's own pit). Both fell correctly, but their `verbs` lost `walk`. The arm now takes only the
planner's own refusal condition (start cell = a non-goal pit), and both rows are green ON.

**Movers (local survey, every reach-pit / encounter step 24,32,40,54,75,106,111,145,169,173,174,188,201,202,206,229,233, OFF vs ON
at D2b):** **174 REFUSED → SOLVED 100 t; 202 REFUSED → SOLVED 100 t** (0 decisions, 0 hits). The other 15 are identical.

**Game witness.** The fall itself is the model's existing pit transport (R1/U1). The game evidence to read is the divergence
sweep's **L83 → L84 → L85 leg (W1516's leg 671; re-derive its key at this base)** with `inPitFallOut` ON, which plays the solve on
p4g. I could not dispatch it (no CI dispatch from a cloud session), so it is listed below. ⚠ **Not game-witnessed in this slice.**

**Mutant** (predicted: steps 174/202 back to REFUSED with the A*-start refusal): with the key OFF they are. That is the OFF arm, measured above.

## D3 — the lavatrap (L77, L78, L108): **STOP, MODEL gap**

`levelRun.js` has **0** references to `lavatrap`/`LavaTrap`: the trap is only an avoid disc (`levelWorld.js:1264`,
`point: {dx: 8, dy: 8, r: 33}`), with no tongue, no hits and no death. The game (`Enemies/LavaTrap.as`):
- `:81-93`: with the player within `chompRange` 32 (integer `FP.distance`), `!wait`, and no `Solid` on the line (`collideLine`),
  it `launch()`es. Tongue length index 0 = 32 px (`tongueLengths[0]`), so the first `collideLine("Player", …)` (`:145`) hits at once
  and attaches.
- `:56-74`: an attached player is WRITTEN to the tongue's end every tick. At the last length, `die()`, or with
  `Player.hasDarkSuit` released `onGround = true` (the L108 FERRY).
- `wait` starts true and clears only when d > 32 (`:101-104`).
- It is an `Enemy` with `hitsMax 3` (`combat.js:403-412`), `knockback`/`hitPlayer` empty. `WandShot.as:114-116` hits any `Enemy`
  (`damage 0.5`, `1` fire-wand, `:29,57`) through `Enemy.hit`'s `hitsTimer` gate (30 ticks, `Enemy.as:147-156`). Fire does not
  hurt it (`hitByFire` false, `Enemy.as:151`).

Rooms (16 px; `L` trap, `~` lava, `o` pit):
- **L77**: a one-tile lava causeway with `lavatrap@96,192` ON it (row 12 `~~~~..L~~`). Every walk passes inside 32 px with line
  of sight. No suit ⇒ **kill it**: the wand from beyond 32 px. A candidate stance is (≈70,200) firing right (d ≈ 34; LOS clear;
  the column above is solid at row 11).
- **L78**: three traps on open floor (`lavatrap@96,80`, `@144,48`, `@144,96`). The same verb, or a LOS-aware disc (a Solid between
  stops the launch).
- **L108**: three traps 48 px apart down a pit chasm (`lavatrap@128,80/128,128/128,176`), single floor cells between them. Suit
  held ⇒ the **ferry** (each tongue drags the player across the pit and releases it on the trap's side).

**What D3 needs (in order, each its own key):** (a) `levelRun` steps `LavaTrap` (the per-visit run map → **a digest part or a
`DIGEST_EXEMPT` row**, in its own commit; the escape reads player position, so it is IN), with its tongue state machine, attach,
drag, `die()`/suit release, and its hits/death/removal (`endAnim` "die", 6 frames at speed 10); (b) a p4g witness tape of each
(an L77 wand kill; an L108 ferry ride); (c) a `proximity-hazard:lavatrap` verb (`wandkill`: stance outside 32 px with LOS,
6 shots at the `hitsTimer` cadence) and (d) a `ferry` arm for the suit. ⚖ Model the game: no planner-side avoidance was added.

## D4 — L112 rocklock / the Owl: **STOP, VERB gap**

The Owl IS modelled (`finalBossFight.js`, 1199 lines; `levelRun.js` `finalBossStates`, shoves, lava hits, kills, corpse). What
is missing is a SOLVER executor: the survey skips `Level 112 - Owl` (*"no solver executor fights finalboss@64,96"*), and the exit's
`rocklock@112,16` opens only on his death (`FinalBoss.as:218` `Button.activateAll(null, 0, true)`, `:221-222` `setPersistence(tag)`
and `tag+1`). The verb is three shove-into-lava cycles under the barrage (`finalBossFight.js` header: `onlyHitBy = "Lava"`,
`canHit` false for the 240-tick barrage, one lava hit per pod cycle, and **the corpse is a permanent Solid**, so the third
endpoint must not seal the door). That is a BOSSKILLS-sized slice (cf. `lavaBossPolicy`, `bossTotemPolicy`): register
`solid:finalboss` → `owl` behind its own key, plus a `finalBossPolicy`. Not started.

## D-last — flip readiness (both keys ON)

| gate | result |
|---|---|
| bounded vitest BEFORE (defaults), 24 files | **533 / 533 passed** |
| bounded vitest ON (`SEEDLING_CHEST_BODY_PLACEMENT_PROBE=1 SEEDLING_IN_PIT_FALL_OUT=1`), 28 files: contactFidelity, r8Acceptance, levelRunStateDigest, solveProgress, solverReachPit, fidelityL1516, fidelityDescent, fidelityEncounters, fidelityApBosses, solverEncounter, solverDeadline, fidelityCorpseBump, fidelityRopeStance, fidelityTurretCircle, fidelityChestSeal, chest, campaignChain, jsRuntimeVerbs, jsRuntimeLongPlanWalk, jsRuntimeVanillaDelivery, wasmArrivalComposite, decisionTrace, entityBlocks, seedlingCanCross, fidelityArrival, r5Shaft, watchOverlays, jsRuntimeSolverShouldStop (every `grep -a` hit for `placementBlocker`/`execReachPit`/`reach-pit`/the keys, plus the core rows) | **760 / 761**. The one red is `contactFidelity.test.js` *"the shipped defaults"* (the defaults pin: re-pin `true` at a flip) |
| `jsRuntimeTape.test.js` at DEFAULTS | **2 red**: PHASE B `NO_TAPE_CHAIN` (×2). This is the brief's predicted move from any new key (it hashes `globals`). **For js's train 3; not re-pinned.** |
| identity block / six `--check`s at defaults | all six exit 0, md5s equal the base (see *Identity*) |
| L4 dash margin (84 vs 85) | `jsRuntimeSolverShouldStop` green ON (neither key touches L4's dashless path) |

Not run (named for the planner): `ci-producer-checks.mjs --jobs=3` with the keys ON, and the full survey and sweep on CI.

## Dispatches for the planner

1. **Survey A/B per key:** `seedling-survey.yml` on `claude/seedling-fidelity-refusals-w0r4m3`, `--through=end --route=full`, env
   `SEEDLING_IN_PIT_FALL_OUT=1` vs unset. Expected: steps 174/202 → SOLVED, nothing else. Then `SEEDLING_CHEST_BODY_PLACEMENT_PROBE=1`
   vs unset. Expected: step 35's text only.
2. **Sweep ×2 per arm:** `seedling-divergence-sweep.yml`, `contact_fidelity=<the 105 default-ON keys>|inPitFallOut` vs the 105,
   `keys=` the L83→L84→L85 legs (re-derive at this base with `seedling-divergence-legs.mjs --out=legs.jsonl --presets=seedling_playthrough --blocks`;
   W1516's id was 671). Then a full sweep ×2 per arm (match by KEY). The same for `chestBodyPlacementProbe` (keys: the L25 legs).
3. **Probes:** `seedling-probe.yml battery=standard` on the branch, with each key ON. Grade `probe-seedling-wasm-logical-links` B,R
   KNOWN RED and `probe-seedling-encounter-ticks` INFO.

## JS arc / hammer / rules

- **JS arc:** new optional record field `standing: {tx, ty, idle}` on a reach-pit record (present only on the new arm). No
  contract changed. `NO_TAPE_CHAIN` moves (above). No walker change. No `producer:walker` row moves.
- **Hammer:** nothing in its region was touched. No hand-over.
- **Rules:** the L25 chest pocket row (D1).

## Identity

`SEEDLING_PORT=9768 bash scripts/procgen/identity-block.sh .` at head `3f368cf4` (both keys at their OFF default). Producers, all exit 0, all
**equal to the published base values**: battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` ·
campaign `be9c19c8`. ENEMY census default `87e86da9`, maze `57e07d21`, acceptance batch `cf54cdf7`. Reference: *"ALL 7 GENERATED
MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE"*. Roster: no tape added (`fixtures/tapes/index.json` unchanged).

## Residue / byte-inertia / rows to BANK

- Byte-inertia: both keys OFF are the base's code paths (guarded `CONTACT_FIDELITY.*` reads only). The OFF survey rows above equal W0.
- BANK: L25's chest is opened only from (6,7), entered from L28 (`Chest.as:61-64` + `Dungeon3/7.oel`); L84's in-pit start falls
  at t19 idle; LavaTrap is unmodelled in `levelRun` (0 refs); the Owl has a model and no verb.
- Trap candidate: *a probe point taken from an entity row's OEL corner, not its body* (`world.chests` has no rect; pickups do).
