# cloud-report — rules-landing-contact-census

Branch `claude/l73-lavarunner-move-patch-5h4k7x`, from `origin/main` = `c1927ba3077c7be70f0c7ed3ae112b67dddc86ad`.
Wasm page `seedling_bot_ap_p4g`, headless logic-only channel (asserted on every page). Evidence:
`CC/docs/cloud-reports/rules-landing-contact-census-evidence/` (`tools/`, `runs/`, `tapes/`, and every polled tick of every
L73 game run in `runs/game/*.game.json.gz`). No pointer moved. Nothing under `worlds/seedling/`, `vendor/seedling`, `.github/`,
the solver, `levelRun` or `CONTACT_FIDELITY` changed. The only level-data change is the one L73 row in
`seedlingSetPatches.js`, and no rule changed: the producers moved `provenance.set_patches` only.

## Answer

| question | verdict | evidence (run, tape, ticks, hits) |
|---|---|---|
| L73 move: a spot meeting criteria 1–4 | **`lavarunner@72,24` → (32,24)**, 40 px due west, into the lava behind the Dark Stone r1c3 | below |
| 1. the L74 arrival (64,16) is hit-free, item-less, idle + 4 held, 180 ticks | **GAME YES** | `runs/play-delivered-arrivals.log`: idle / down / left **clear** (0 hits, 0 restarts, 180 ticks). Up leaves through the L74 door at t7. Right walks into the lava at r1c7 and dies (the player's own walk; the model bills it `lava@L73` at t36). The runner parks at (41.9,30.6) behind r1c3, 25.4 px away at its closest. The unmoved room (`play-vanilla-arrivals.log`): **hit at t2 on all 5 inputs**, ejected to L74 at t4–6, and held down dies 4 times |
| 2. it still stands on terrain it holds, still a lavarunner | **YES** | its 12×12 box at (32,24) covers only Lava tiles (c2 r1, c2 r2). `LavaRunner.as:38` `dieInLava = false`, and `:96-101` swims there (state 1/17, `swimSpeed` 1). `op: 'move'`, attrs untouched (the extract carries none); unit row |
| 3a. Sword `r3c7 → r0c4` (the witness's `solve-rules-l73-north-sword`) | **GAME YES** | the solver plans it on the moved room exactly as on the old one (166 ticks, a break at t70). Game: 0 hits, out to L74 at **t166**, the same as the unmoved room's run (`play-*-crossings.log`) |
| 3b. Sword `r0c4 → r3c7` (the reverse) | **GAME YES** (hand tape; the solver refuses both rooms) | `tapes/l73s-sword-east@delivered`: kill the runner as it comes round r1c3, drag the bulb east, break, kill the bulb off the c4 column, out. Game: **0 hits**, out to L72 at **t353**. The same script on the unmoved room: hit at t2, back to L74 |
| 3c. nothing new opens that the rules don't price | **YES** | L73's only rules rows are the two rock crossings (`Or(Dark Suit, Progressive Sword, Ghost Spear, Fire)` both ways) and the free doors. The L72 arrival is unchanged on the game (idle hit by the **bulb** at t143 in both rooms, the same tick; up clear; left/right lava). The Fire crossing stays GAME NO (below) |
| 4. the smallest move | **YES**, 40 px | every placement up to 35.8 px (22 of them, on an 8 px grid) is hit on the model under at least one input, from t1 to t64 (`runs/move-search8.log`). The three 40 px spots all pass 1 on the game; (32,24) is the one that keeps both crossings and the L72 side as they were (table in B) |
| a stop | **none hit** | no kill lock in L73 (no `lock` entity). Derived-rule table 108 rows / 6 excluded / certifier **1/16/0**, unchanged. ER certifier **1/16/0**, unchanged. No AS3, solver or `levelRun` change |
| the census | on the unmoved room, **5 model screen hits**: L73 (64,16) plus 4 pit-spawn landings that no edge arrives through (L16 (208,32), L16 (192,80), L40 (208,448), L40 (352,448); GAME: hit at t1 on every input, the model naming the bob). With the move, **0** screen hits remain that a door arrives through | `runs/l73-only.json`, `runs/census-final.log`, table in A |
| beyond the screen | **4 FINDINGs** (chase tier: a homer faster than the player, awake at the boot): L77 (96,288) from L78, L72 (16,256) from L71, L80 (32,16) from L71 and L105 (208,64) from L104 have **no clean straight-line input** (each is hit, dies, or leaves). L77 is the plain case: hit at t15–37 or thrown back to L78 | table in A; Robert decides; no patch |

## Setup

`git checkout -B claude/l73-lavarunner-move-patch-5h4k7x origin/main` (`c1927ba307…`). `session_bootstrap.sh --seedling`
→ READY. The six submodules were initialised and no pointer moved. `update_host_settings.py minimal-spoilers` was run.
The dev server was `scripts/serve-nocache.py 8000`. The witness's L73 rows reproduced first: `runs/l73-only.json` (the
census probe on the unmoved room) gives a hit at t2 on every input and ejection to L74 at t4–6. That is the witness's
`l73s-*` result to the tick.

## A. The census (every landing; an instrument)

**Instrument.** `scripts/procgen/probe-seedling-landing-contact.mjs` (a sibling of the lethal-landings probe) and its pure
half `scripts/procgen/seedlingLandingContact.js`, with unit rows in `seedlingLandingContact.test.js` (16).
- **Landings.** Each sub-region exit's `resolveArrivalSpawn` over the committed `seedling_playthrough` sidecars, with
  the patched map's return-spawn table. This is the lethal-landings enumeration without its terrain filter: 361
  landings. Each landing carries `arrivedFrom`, the regions whose exits name it as `targetRegion`/`targetExitId`.
- **Bodies.** The delivered (patched) map's entities whose tag has an `ENEMY_CLASSES` row with a hitbox. Centre =
  placement + `ctor.dx/dy`, box = `setHitbox(w,h,ox,oy)`, plus `speed`, `aggro.kind` and `runRange`. The player's box
  is `spawnFromBoot` + `HITBOX` (4×5 at 2,2). No per-level literal.
- **Screen.** gap = the larger axis separation (FlashPunk's `collide` is strict, so gap 0 is touching).
  `hit` = overlap (gap < 0), or a mover whose gap is below one tick of its speed. A second tier, **`chase`**: a
  homer faster than the player's walk (`WALK_SPEED` 0.8 = `Player.as` dMS) that is awake at the boot (centre distance
  ≤ `runRange`). It is added because the near band found L77.
- **Game.** Each candidate landing is booted on the DELIVERED set (`vanillaRecordSet`'s own default, mounted by
  `botLoadLevels`) as a door does it, `new Game(level, x, y)`, item-less, idle and each held direction, for 180
  ticks. The probe records the first hit (the `seedlingHitTicks` clock), leaving the level (ejection) and restarts.
  The **model** runs the same five inputs and names the attacker, which `botStatus` does not.
  ⚠ **Measured trap:** the game's `hits` counter survives a re-boot into the same level and resets only on a level
  change. A reused page therefore showed "hit@1" for L5's held down, where the model and a primed page give t70
  (`runs/census-near16-aborted-nopriming.log`). The probe now primes the page with 2 ticks in another level whenever
  the previous input ended in the landing's level. After that the game and the model agree on every input of every
  row below to within a few ticks. The exceptions are lava, and the flyer rooms' deaths (listed under the table).
- **Checks.** A screen hit that an edge arrives through FAILs when the game hits every input. A chase-tier row with no
  clean input is a `FINDING:` (a FAIL would hold the probe red until a ruling). Clean means not hit, not dead, not
  gone; a lava death under a held direction counts as no entry. The final run, `runs/census-final.log` / `.json`, on
  the delivered set `23510f80`: 361 landings, **4 screen hits** (all pit spawns that nothing arrives through; the
  unmoved room had 5, L73 the fifth: `runs/l73-only.json`), **14 chase-tier rows**, and 34 rows witnessed. Its one
  FAIL is "the wasm runs" for L14 (48,64): the page crashed at tick 0 twice, a near-band control row (below). There are
  4 `FINDING:` rows: L72 (16,256), L77 (96,288) ×2 bodies, L80 (32,16) and L105 (208,64). The run before the
  `dies`-counts-as-no-entry rule, `runs/census-pre-noclean.*`, has the same per-input verdicts.
- ⚠ **Model ≠ game, observed, not chased:** in the flyer rooms (L100, L101, L105) the game kills held up/down/right
  (`dies`: restart episodes, no hit counted) where the model says clear. In the lava rooms the model bills a lava
  entry as a hit (`lava@L…`) where the game shows a restart (`dies`). Neither changes a census class except L105's
  FINDING, which rests on two game `dies`. A fidelity question, outside this slice.

**Rows** (`runs/census-final.json`; GAME = idle / up / down / left / right; `model` attackers in brackets):

| landing | arrived from | bodies (screen) | GAME idle / up / down / left / right | model (attacker) | class |
|---|---|---|---|---|---|
| L5 (48,96) | level_6 | `bob@48,80` near gap 10 | hit@47 / hit@9 / hit@70 / hit@56 / hit@161 | hit@47(bob@48,80) / hit@9(bob@48,80) / hit@70(bob@48,80) / hit@56(bob@16,80) / hit@161(bob@48,80) | near band (control) |
| L16 (192,32) | — (none) | `bob@176,16` near gap 10; `bob@208,32` near gap 10 | hit@47 / hit@54 / left->L17@27 / hit@57,left->L17@65 / hit@9 | hit@47(bob@208,32) / hit@54(bob@176,16) / left->L17 / hit@57(arrowtrap@128,32) / hit@9(bob@208,32) | near band (control) |
| L16 (208,32) | — (none) | `bob@208,32` overlap gap -6 | hit@1,left->L17@43 / hit@1,left->L17@43 / hit@1,left->L17@43 / hit@1,left->L17@43 / hit@1,left->L17@43 | hit@1(bob@208,32) / hit@1(bob@208,32) / hit@1(bob@208,32) / hit@1(bob@208,32) / hit@1(bob@208,32) | SCREEN HIT (unarrived) |
| L16 (224,32) | — (none) | `bob@208,32` near gap 10 | hit@42 / hit@86 / left->L17@27 / hit@9 / hit@129 | hit@42(bob@208,32) / hit@86(bob@208,32) / left->L17 / hit@9(bob@208,32) / hit@129(bob@208,32) | near band (control) |
| L16 (176,64) | — (none) | `bob@192,80` near gap 10 | hit@58 / hit@32 / hit@66 / hit@159 / left->L17@28 | hit@58(bob@192,80) / hit@32(bob@176,16) / hit@66(bob@160,112) / hit@159(bob@192,80) / left->L17 | near band (control) |
| L16 (192,80) | — (none) | `bob@192,80` overlap gap -6 | hit@1 / hit@1 / hit@1 / hit@1 / hit@1 | hit@1(bob@192,80) / hit@1(bob@192,80) / hit@1(bob@192,80) / hit@1(bob@192,80) / hit@1(bob@192,80) | SCREEN HIT (unarrived) |
| L17 (112,32) | level_16__r1c9 | `bob@96,32` near gap 10 | hit@42 / hit@86 / hit@31 / hit@9 / clear | hit@42(bob@96,32) / hit@86(bob@96,32) / hit@31(bob@112,80) / hit@9(bob@96,32) / clear | near band (control) |
| L17 (112,48) | level_16__r1c9 | `bob@96,32` near gap 10 | hit@58 / hit@101 / hit@20 / left->L16@61 / clear | hit@58(bob@96,32) / hit@101(bob@96,32) / hit@20(bob@112,80) / left->L16 / clear | near band (control) |
| L17 (128,64) | level_16__r1c9 | `bob@112,80` near gap 10 | hit@58 / hit@145 / hit@53 / hit@31 / clear | hit@58(bob@112,80) / hit@145(bob@96,32) / hit@53(bob@112,80) / hit@31(bob@80,64) / clear | near band (control) |
| L26 (128,208) | level_28__r0c6 | `puncher@80,168` chase gap 40 | clear / clear / clear / clear / left->L28@7 | clear / clear / clear / clear / left->L28 | chase: a clean input exists |
| L27 (168,32) | — (none) | `wallflyer@192,48` near gap 15 | clear / left->L28@7 / hit@18 / dies / clear | clear / left->L28 / hit@18(wallflyer@192,48) / clear / clear | near band (control) |
| L40 (368,416) | — (none) | `bob@352,416` near gap 10 | hit@42 / hit@49 / left->L43@27 / hit@9 / clear | hit@42(bob@352,416) / hit@49(bob@352,416) / left->L43 / hit@9(bob@352,416) / clear | near band (control) |
| L40 (208,448) | — (none) | `bob@208,448` overlap gap -6 | hit@1 / hit@1 / hit@1 / hit@1 / hit@1,left->L43@68 | hit@1(bob@208,448) / hit@1(bob@208,448) / hit@1(bob@208,448) / hit@1(bob@208,448) / hit@1(bob@208,448) | SCREEN HIT (unarrived) |
| L40 (352,448) | — (none) | `bob@352,448` overlap gap -6 | hit@1 / hit@1 / hit@1 / hit@1 / hit@1 | hit@1(bob@352,448) / hit@1(bob@352,448) / hit@1(bob@352,448) / hit@1(bob@352,448) / hit@1(bob@352,448) | SCREEN HIT (unarrived) |
| L40 (208,464) | — (none) | `bob@192,480` near gap 10; `bob@208,448` near gap 10 | hit@47,left->L43@90 / hit@9 / hit@56 / hit@50 / left->L43@28 | hit@47(bob@208,448) / hit@9(bob@208,448) / hit@56(bob@224,496) / hit@50(bob@208,448) / left->L43 | near band (control) |
| L40 (208,480) | — (none) | `bob@192,480` near gap 10; `bob@224,496` near gap 10 | hit@42,left->L43@65 / hit@20 / hit@53 / hit@9,left->L43@55 / left->L43@28 | hit@42(bob@192,480) / hit@20(bob@208,448) / hit@53(bob@224,496) / hit@9(bob@192,480) / left->L43 | near band (control) |
| L53 (192,64) | level_48__r7c0 | `puncher@136,96` chase gap 48 | clear / clear / clear / clear / left->L48@7 | clear / clear / clear / clear / left->L48 | chase: a clean input exists |
| L71 (16,288) | level_85 | `lavarunner@64,224` chase gap 56 | clear / clear / left->L85@6 / clear / clear | clear / clear / left->L85 / clear / clear | chase: a clean input exists |
| L72 (16,256) | level_71__r0c6 | `lavarunner@80,216` chase gap 56 | hit@65,left->L71@69 / dies / dies / left->L71@7 / hit@47 | hit@65(lavarunner@80,216) / hit@23(lava@L72) / hit@8(lava@L72) / left->L71 / hit@22(lava@L72) | **FINDING** (no clean input) |
| L73 (64,16) | level_74 | `lavarunner@32,24` chase gap 24 | clear / left->L74@7 / clear / clear / dies | clear / left->L74 / clear / clear / hit@36(lava@L73) | chase: a clean input exists |
| L74 (16,128) | level_75 | `lavarunner@24,56` chase gap 64 | clear / dies / left->L75@6 / dies / dies | clear / hit@23(lava@L74) / left->L75 / hit@9(lava@L74) / hit@9(lava@L74) | chase: a clean input exists |
| L75 (64,16) | level_74 | `lavarunner@104,64` chase gap 39 | hit@157 / left->L74@7 / hit@55 / dies / clear | hit@159(lavarunner@104,64) / left->L74 / hit@35(lava@L75) / hit@9(lava@L75) / clear | chase: a clean input exists |
| L77 (96,288) | level_78__r0c16 | `lavarunner@80,272` chase gap 8; `lavarunner@112,256` chase gap 24 | hit@37,left->L78@40 / hit@15 / left->L78@6 / hit@34,left->L78@37 / hit@35 | hit@37(lavarunner@112,256) / hit@15(lavarunner@80,272) / left->L78 / hit@34(lavarunner@112,256) / hit@9(lava@L77) | **FINDING** (no clean input) |
| L78 (32,16) | level_79__r8c4 | `lavarunner@96,32` chase gap 56 | clear / left->L79@7 / clear / dies / dies | clear / left->L79 / clear / hit@9(lava@L78) / hit@9(lava@L78) | chase: a clean input exists |
| L80 (32,16) | level_71__r0c6 | `lavarunner@80,32` chase gap 40 | hit@51 / left->L71@7 / hit@50 / dies / hit@42 | hit@51(lavarunner@80,32) / left->L71 / hit@22(lava@L80) / hit@9(lava@L80) / hit@22(lava@L80) | **FINDING** (no clean input) |
| L100 (288,80) | — (none) | `flyer@224,96` chase gap 57 | hit@107 / dies / left->L101@6 / dies / dies | hit@107(flyer@224,96) / clear / left->L101 / clear / clear | chase (unarrived) |
| L101 (288,240) | level_100__r4c10, level_106, level_109 | `flyer@224,192` chase gap 57 | hit@113 / dies / dies / clear / dies | hit@113(flyer@224,192) / clear / clear / clear / clear | chase: a clean input exists |
| L105 (208,64) | level_104 | `flyer@192,16` chase gap 50 | hit@66 / dies / dies / hit@49 / left->L104@7 | hit@66(flyer@192,16) / clear / clear / hit@49(jellyfish@120,72) / left->L104 | **FINDING** (no clean input) |
| L73 (32,128) | level_72 | `(--also)` also | hit@143,left->L72@146 / clear / left->L72@6 / dies / dies | hit@143(bulb@80,80) / clear / left->L72 / hit@9(lava@L73) / hit@9(lava@L73) | L73 control |
| L14 (48,64) | level_15__r1c5 | `bob@64,64` near gap 10 | **UNWITNESSED** in the final run: the page crashed at tick 0 twice (`A valid external Instance reference no longer exists`). An earlier unprimed run read idle hit@47 → L15, up hit@119, down clear, left clear, right hit@7 → L15 | idle hit@47 (bob@64,64), down clear | near band (control); a clean input exists either way |

**Proposed general remedies (NOT applied; Robert decides each):**
- **R1 — pit-spawn landings inside a body (L16 (208,32), L16 (192,80), L40 (208,448), L40 (352,448)).** These are the
  `entrance_spawn` of an `out_pit_*` exit: the tile the binding would land a player on if anything arrived "up"
  through a pit. Nothing does today. AP_1 has no edge into them, and `seedling_er`'s placements (seed 1) pair only
  coupled doors, 0 of 50 with a pit. The remedy belongs in the spawn derivation, and only if a shuffle ever pairs pit
  exits: pick the nearest admissible tile whose player box clears every body's contact screen (this census's
  `contactOf`, derived). No level data changes.
- **R2 — a faster homer awake at a door landing (L77, L72, L80, and L105, whose rests on two game deaths).** The same class of fault as L73, one leash
  further out. **(a)** Generalise the L73 remedy to a rule for the level data: a homer faster than the player whose
  leash covers a door landing is moved behind walls or lava it cannot cross straight-line, measured on the game
  (criteria 1–4 of this slice, per room). **(b)** Or charge the arrival edge the kill arm (`Progressive Sword` etc.,
  as the rock rows do). The census only shows that no straight-line input enters clean. A steered route may still,
  so each row needs a route witness before (b). L77's landing is one tile below `lavarunner@80,272` (gap 8 px); the
  game hits up at t15, and idle at t37 before throwing the player back to L78.

## B. The L73 move

**Why the runner must leave the pocket floor.** The pocket (r1 c4–6, r2 c3–5) lies wholly inside the runner's
80 px leash of the L74 landing (`Bob.as` `runRange`), and nothing on the floor walls it from the landing. Every
pocket-floor placement on an 8 px grid (`runs/move-search8.log`, 300 ticks, item-less, idle + 4 held) is hit on the
model: (64,24) at t1, (72,32) at t8, (48,32)/(40,32) under held down, and so on. So criterion 1 forces a move off the
floor, into the lava ring or the south floor.

**The candidates** (model screen `move-search8.mjs`, then game; the 40 px tier and the nearest failures):

| spot | move | terrain | criterion 1 (L74 arrival) | the L72 arrival (criterion 3) | crossings | verdict |
|---|---|---|---|---|---|---|
| (72,24) vanilla | 0 | Igneous Stone | **GAME: hit t2, all 5 inputs** | idle: bulb t143 | south impossible | the fault |
| (64,24), (72,16), (80,24), … (all pocket floor) | 8–25 | Stone | model: hit t1–t22 | — | — | rejected (1) |
| (48,0) | 33.9 | Lava | model: hit under held right at t64 (it jams on the door tile, 7 px from the box) | — | — | rejected (1) |
| (104,16), (96,0), (104,8) | 33–36 | Lava | model: hit t30–t35 (it swims round r1c7) | — | — | rejected (1) |
| **(32,24)** | **40** | **Lava** | **GAME: clear** (idle/down/left; closest 25.4 px, Dark Stone r1c3 between) | **GAME: unchanged** (bulb t143; runner never closer than 82 px on the model) | Sword N plan **166 ticks = vanilla's**; Fire N still refused, game hit t286 (vanilla t287) | **chosen** |
| (40,0) | 40 | Lava | GAME: clear (`play-alt-40-0.log`); model closest **14.6 px** (2–3 px from contact, jammed over the door tile) | unchanged | Sword N plan 117 ticks; **Fire N plans** (252 ticks): the runner no longer reaches the crossing | rejected: fragile, and it changes the crossing's game truth |
| (72,64) | 40 | Igneous Stone (south floor) | GAME: clear (`play-alt-72-64.log`) | model: the runner chases the L72 arrival to **15.3 px**. It stands on the north crossing's rock stance | Sword N plan 184 ticks (break at t147) | rejected: a new south-floor hazard |
| (32,16), (64,64), (80,64), … | ≥ 40.8 | | | (64,64)/(64,72): the runner hits the L72 arrival (t51–t60) | | larger |

All three 40 px spots pass criterion 1 on the game over 180 ticks. The tie is broken by criterion 3 ("keep their game
truth"): only (32,24) leaves both crossings, and both landings' other inputs, exactly as the unmoved room plays them,
while fixing the arrival.

**The patch.** `PATCH_L73_LAVARUNNER_MOVED` (`SET_PATCH_IDS.l73LavarunnerMoved = 'l73-lavarunner-moved'`): level 73,
`op: 'move'`, `match: {type: 'lavarunner', x: 72, y: 24, attrs: {}}`, `to: {x: 32, y: 24}`. Its `why` names the
arrival hit and the ruling, and it is the last row of `SEEDLING_SET_PATCHES` (header edit 11). The unit rows in
`seedlingSetPatches.test.js` are BEFORE/AFTER (one runner, (72,24) → (32,24), every other entity identical), the
boxes DERIVED from `ENEMY_CLASSES.lavarunner` and `HITBOX` (gap 0 → 24 px), the destination's tiles all Lava with
`terrain.lava = 'survives'`, the row alone touching L73 only, idempotent, and refusal by name (the runner moved
elsewhere; an occupied `to`).

**Re-records (recipe order) and what moved** (python key walk, `/provenance` and below):

| producer | result |
|---|---|
| `make-seedling-playthrough-rules.mjs` (atlas + AP_1) | atlas **identical**. AP_1: **1 difference**, `/provenance/1/set_patches` 9 → 10 (`+ l73-lavarunner-moved`). No region, exit, rule, location or sidecar row moved |
| `make-seedling-subregion-partition.mjs` | `--check` OK, identical |
| `make-seedling-playthrough-maze.mjs` | `--check` OK, byte-identical |
| `make-seedling-er-preset.mjs` | **1 difference**, the same `/provenance/1/set_patches` 9 → 10. 50 placements, the same draw |
| `make-seedling-sphere-order.mjs` | `--check` OK. 48 locations over 16 spheres, the equipment order unchanged |
| `world_generator` → `worlds/seedling_playthrough` | **byte-identical** (no diff) |
| `Generate.py` seed 1, minimal-spoilers | `.archipelago`, `_Spoiler.txt`, `_rules.json`, `_sphere_log.jsonl` all **byte-identical**. The `preset_files.json` newline was reverted |
| `generate-procgen-reference.mjs` | `instruments.js` + `architecture.md` regenerated for the new probe. `--check`: ALL 7 MODULES / 5 REGIONS MATCH |
| derived-rule table (`probe-seedling-derived-rules.mjs --shards=2`, local, NOT regenerated) | **rows do not move**: TABLE 108 rows in 51 regions, 6 exact elements excluded, CERT **1/16/0**, all checks PASS (`runs/derived-rules.log`) |
| `probe-seedling-whole-game-certify.mjs --source=er` | **1/16/0**, matches its pin (`runs/er-certify.log`) |

**Pins, before → after (each with its reason in the file):**
- delivered set id `seedling-vanilla-record-5aeefc3c` → **`seedling-vanilla-record-23510f80`** (`seedlingSetPatches.test.js`,
  with a new control row: the table without the L73 row keeps `5aeefc3c`; the older control rows also drop the L73 row).
- the table pins: 9 → 10 ids, `PATCHED_ROOMS` gains 73.
- `fixtures/moonrock-oracle.json` + `fidelityMoonrock.test.js` re-recorded on p4g (`probe-seedling-moonrock.mjs
  --variants=table,unpatched,approved,off-stairs --record`, ALL CHECKS PASSED): **13 values, all set ids**
  (`delivered` 5aeefc3c → 23510f80, `approved` f27ab2e3 → 5e57cde7, `off-stairs` 5bd42ad5 → 21eb9981; `unpatched` and
  the builtin arms unchanged). Every game row is the same. The test's pin line moves to `23510f80`, with its history comment.
- `fixtures/descent-oracle.json` re-recorded (`probe-seedling-descent.mjs --record`, ALL CHECKS PASSED): **6 values, all
  set ids** (delivered 23510f80, approved 5e57cde7, latch-probe 034d16b5 → f5ff0bc1). Its test reads them off the
  live delivery.
- `fixtures/l25apitem-witness/oracle.json` re-recorded (`probe-seedling-l25-apitem.mjs --record`, ALL CHECKS PASSED): 4
  values, all ids: vanilla `5aeefc3c → 23510f80`, AP `seedling-ap-record-01b432a9 → 6d7e278d`.
- `boxLock.test.js`: the new probe joins the box-takers roster.

**Tests run (bounded, explicit lists):** `seedlingSetPatches`, `seedlingLandingContact`, `boxLock`, `checkProcgenHelp`
(75). The 62 test files that read either preset file (1144 passed). 24 files that read the patch table or the oracles.
10 L73/L74 fidelity files (169 passed). `fidelityMoonrock`, `fidelityL25ApItem` and `fidelityDescent` pass on the
re-recorded oracles. `check-procgen-help` ALL PASS; `check-procgen-docs` and `check-procgen-reference` exit 0
(`runs/check-procgen-*.log`). The unfiltered vitest was not run (ruling 52); the suite number is CI's.

## Fire on the moved room (an observation; the Fire rule is unchanged)

| tape (`tapes/`) | arm | game | model |
|---|---|---|---|
| `l73n-fire-bulb@delivered` (the witness's `l73n-bulb` script) | Fire, north | **hit at t286** (the runner, which comes round r2c2 to the gap). The unmoved room: t287 | t286 `lavarunner@32,24` |
| `l73s-fire@delivered` | Fire, south | **hit at t58** (the bulb, below the gap) | t58 `bulb@80,80` |
| solver, north / south | Fire | REFUSED (the runner / the bulb) | — |

The move does not open the Fire crossing: the runner still guards the gap from r2c2, as it did from the pocket floor.
The later slice's re-measure starts from here.

## Tools (`CC/docs/cloud-reports/rules-landing-contact-census-evidence/tools/`)
`move-search.mjs` (16 px grid, 180 ticks) and `move-search8.mjs` (8 px grid, 300 ticks): the model screen for the move.
`solve.mjs`: the solver's L73 crossings on any spot. `author.mjs`: the hand scripts (ported from the witness's
`fireonly.mjs`). `play.mjs`: game runs on any spot's set, one fresh page per tape. `trace.mjs` and `map.mjs`: diagnostics.
`run-queue.sh`: the order the game runs were made in. The south Sword route was a hand script because the solver
refuses both rooms: the unmoved room on the arrival hit, the moved one with "no walkable tile path from tile (4,3) to
(2,9)", the planner's own connectivity view.
