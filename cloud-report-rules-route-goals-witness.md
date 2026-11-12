# Cloud report: `rules-route-goals-witness`, the census goals played on the game without their route-order events

## 1. Start, head, branch

| | |
|---|---|
| Session | `rules-route-goals-witness` (planner `seedling-rules-planning-6`), cloud, Opus |
| Start SHA | `git rev-parse origin/main` = `fe98f37f2207594e648cefb90f007a16e453c0eb` |
| Branch | `claude/rules-route-goals-witness-7o9pu5` (the harness's designated branch) |
| Commits | `ffe75960` the evidence (tools, sweep rows of both arms, game rows and tapes, reach outputs). This report is the last commit |
| Evidence | `CC/docs/cloud-reports/rules-route-goals-witness-evidence/` (`tools/`, `legs/`, `sweep/`, `game/`, `reach/`) |
| Environment | `session_bootstrap.sh --seedling` READY; the six non-wasm submodules initialised (no pointer moved); `minimal-spoilers`; dev server :8000 (`serve-nocache.py`, started here and stopped by PID) |
| Game | `seedling_bot_ap_p4g`, headless logic-only, under the box lock for every run |
| Planner messages | none arrived |

## 2. The answer first

**No GAME NO among the ten.** Every goal the brief names is collected on the game without the route-order events the census charged it with, except L112 Owl, which no tool here can fight. In five goals the events are simply not on the line. In three the play earns a flag in the visit, by an item the goal's own rules already charge. In one (L63 Chest) the census's arrival is a door whose rule already charges the event; from the rules' event-free way in, the game collects the chest. **No rule change is suggested.** No rule, preset, atlas or table byte moved.

| # | goal (census row) | route-order events (census) | arrival(s) played | without the events (game) | with the events (control, game) | verdict |
|---|---|---|---|---|---|---|
| 1 | L30 Torchpickup (row 26) | `L30:0`, `L30:2` | L28 (16,128), L31 (176,48), L32 pits (224,80), (240,80) | **4/4 done**, 0 hits. Leg 314 replay: 85 t, clears only `30:4` (the torch) | 4/4 done, the same ticks (63/160/202/213 in the sweep) | **GAME YES** |
| 2 | L12 Chest (row 32) | `L12:4`, `:5`, `:10`, `:3` | L83 (32,864): its door's charged `L12:7` + `:12` staged. Also re-staged at the r0c19 doors L33 (432,368) and L0 (16,80), no flags | L83: done, 366 t, 0 hits, earned only `12:9` (the chest). r0c19: done, 3,124 t / 3,363 t, 0 hits; earned `12:4` (Red Key), `12:2` (Fire tree), `12:10` (see §4.2), `12:9` | L83 arrival: done, 366 t | **GAME YES** |
| 3 | L39 Totem Part 72,40 (row 41) | `L39:8` | L40 (144,16) | done, 112 t, 0 hits, clears only `39:5` | done, 112 t | **GAME YES** |
| 4 | L40 Chest (row 43) | `L40:12` | L39 (480,896); L43 (320,592) | L39: **done**, 1,126 t, 0 hits, clears `40:13` (the chest) and `40:16`. **`40:12` is never set.** L43: solver REFUSED (spinner hammer phase) | L39: solver REFUSED (the same spinner refusal); L43: done, 1,753 t | **GAME YES** (L39). The refusal is the solver's (§4.4) |
| 5 | L40 Totem Part 160,640 (row 44) | `L40:12` | L39 (480,896); L43 (320,592) | both done, 494 t / 118 t, 0 hits, clears only `40:25` | both done, the same ticks | **GAME YES** |
| 6 | L40 Totem Part 64,144 (row 55) | `L40:12`, `:1`, `:7`, `:8` (`:1`/`:7` are the link edge's charged events, staged in both arms) | L42 (848,16); L41 (928,96) | L42: done, 1,239 t, 0 hits; no `40:12` / `40:8`. L41: solver REFUSED (puncher, "the combat ladder is EXHAUSTED") | L42: done, 1,239 t (identical). L41: the same refusal | **GAME YES** (L42). L41 is the solver's, in both arms |
| 7 | L12 Witch (row 69) | seven L12 flags | all 7 arrivals (L0, L33, L35, L36, L88, L95 ×2) | **7/7 done**, 0 hits. Leg 104 replay: 620 t, clears only `12:1` | 7/7 done, identical ticks per arrival | **GAME YES** |
| 8 | L68 Health (row 71) | `L68:0` | L65 (16,64), link r3c1 → r1c1 | done, 184 t, 0 hits; the play **earns `68:0`** (bosslock, Yellow Key) and `68:1` (magicallock, Wand) in the visit | done, 74 t | **GAME YES**: earned in the visit. The rules charge it (§4.6) |
| 9 | L63 Chest (row 78) | `L63:1`, `:6`, `:7` | the census leg: L65 (128,288). Re-staged at the four r0c1 doors L61 (16,96), (16,48) and L62 (16,16), (64,16), no flags | L65: solver REFUSED (pit start after its pole stance). **r0c1: 4/4 done**, 504–621 t, 0 hits; earned `63:1` (pole, Spear), `63:2`, `63:8` (darktraps), `63:5` (the chest). `:6`/`:7` never | L65: done, 309 t | **GAME YES** (r0c1). The L65 door already charges `:7` (§4.7) |
| 10 | L112 Owl (row 86) | `L112:1` | L111 (32,208) | **not playable here**: "a BOSS KILL … the bot has no fight executor" | the same | **UNWITNESSED** (§4.8) |
| — | L40 Boss Key 2 (row 42) | `L40:12` | — | — | — | **GAME NO**, witnessed by the BK2 slice; not re-run |
| + | maze L17 Chest | `L16:0` | L16 pit (112,32); L16 door (48,48) | pit: done, 17 t, 0 hits. The door stages `L16:0` (its rule charges it); done, 42 t | — | **GAME YES** (pit) |
| + | maze L38 Chest | `L39:8` | L37 (144,288); L39 door (144,16) | L37: done, 324 t, 0 hits. The L39 door stages `L39:8` (charged); solver REFUSED (cover stance, `STANCE_REENTRY`), a different stop | — | **GAME YES** (L37) |

"done" is the production wasm engine's own end (`probe-seedling-divergence-sweep.mjs`, the goal collected on the game). The "clears" columns are the game's own `persistence_cleared` from my replays (`tools/legwitness.mjs`, §3.2). **Every replay's game end equals the model's to the last decimal.**

**Two GAME YES rows earn something in the visit**, and in both the goal's rules already charge the item or the event that earns it:
- **L68 Health:** the link edge r3c1 → r1c1 names `L68:0` itself.
- **L63 Chest:** pole 1 is lit by the Spear, and r0c1 → r6c9 charges `Ghost Spear`.

The other in-visit clears are a goal's own tag, a lock's own tag fading behind a staged flag, or a darktrap dying.

## 3. Method

### 3.1 The legs, both arms (the sweep)

- **Legs.** `seedling-divergence-legs.mjs --presets=seedling_playthrough`, run twice:
  - with `--carry-route-flags`: the control, which carries the census's events;
  - without it: the witness arm. Every staging is the same except the carried flags.
- **The census check.** For each of the 22 location legs of the ten goals, the carried set (`carriedFlags`) is the census row's events minus any its arrival or link edge already stages. Two cases: L40 Totem 64,144 stages `:1`/`:7` in both arms, and L12 Chest's L83 door stages `:7`/`:12` in both. Every census row reproduced; none stopped differently. Trimmed legs: `legs/legs-{carry,nocarry}.jsonl`, keys `legs/keys-22.txt`.
- **Sweep.** `probe-seedling-divergence-sweep.mjs --mode=inv --page-legs=1 --leg-budget-ms=480000 --page=seedling_bot_ap_p4g --keys=<22> --capture-requests=…`, once per arm. It grants the AP inventory, jumps to the resolved arrival and serves the goal through the production engine. Rows are in `sweep/{nocarry,carry}.rows.jsonl.gz`; one-line summaries are in `sweep/*.summary.txt`.
- **Maze rows.** The maze preset's two extra rows ran the same way: `legs/keys-maze-rows.txt`, `sweep/extra.*`. The maze rules for those edges equal the playthrough's (L16 r3c7 → L17 = `L16:0`, L39 r25c9 → L38 = `L39:8`, the pit and L37 doors free).

### 3.2 The replays: exact clears (`tools/legwitness.mjs`)

The sweep row counts clears but does not name them. Each replay does three things:
- takes a leg's captured request (the sweep's own staging: boot, inventory, save, seam), with only `persistence` changed (`--persist`), or the boot moved to another real door arrival of the same level (`--boot`, a resolved arrival from the leg list);
- solves it in node at main's defaults;
- plays the plan on the game, printing every flag the game cleared.

**The slot trap, measured.** A fresh game page builds its slot array from the held items (`tapeFormat.inventorySlotsFor`, `[0,1,2,3]`). The sweep page grants items in AP order (`[0,1,3,2]`). The first L63 play equipped slot 2, which is the Spear on the sweep page but the **Wand** on a fresh one. The game then took a darktrap hit and fell, while the model stayed hitless. The tool now stages the fresh page's slot array before solving. All rows in `game/` are from after that fix.

`game/all-game-rows.txt` holds every row; `game/batch-rows.txt` holds solve → model → game per leg; tapes and 10-tick samples are in `game/*.gz`.

## 4. Per goal: evidence

### 4.1 L30 Torchpickup: GAME YES
- **The room.** `level_30__r2c10` holds the torch, the three arrival doors and both bosslocks' locations (`L30:0` / `:2` = Green Key). The bosslocks guard r0c4 and r8c13 (`r0c4 → r2c10 = All(Green Key, L30:0)`, `r8c13 → r2c10 = All(Green Key, L30:2)`), not the torch.
- **The census.** It counted them because "the goal's scope reads its own events" (an upper bound, its §4).
- **The game.** Leg 314: 85 t, end (71.51, 71.64), 0 hits, clears `["30:4"]`. The control is identical apart from the staged `30:0`, `30:2`.

### 4.2 L12 Chest: GAME YES
- **The census leg (183).** It arrives from L83 inside `bosslock@32,864 + magicallock@32,864`. Its door rule `All(L12:12, L12:7)` is staged in **both** arms; that is the rules' own gate, not route order. Without `:4/:5/:10/:3`: 366 t, 0 hits, clears `12:7, 12:12` (staged) + `12:9`.
- **The route's way in.** At sphere 4.8 the route has no Swim (seam `canSwim: false`), so it reaches the chest through r0c37 (Red Key, then Fire). I re-staged the boot at two r0c19 doors, L33 (432,368) and L0 (16,80), with no L12 flag. Both done: 3,124 t / 3,363 t, 0 hits, end (327.9, 824.2).
- **Earned in the visit:**
  - `12:4`, the bosslock@416,240: Red Key, which `r0c19 → r0c37` charges;
  - `12:2`, the burnabletree@480,640: Fire, which `r0c37 → r42c28` charges;
  - `12:10`, the shieldlocknorm@288,704.
- **`12:10` is not on the line.** The play walks to its west face (286,711), the lock opens (`ShieldLock.as`: touched from the left with the shield), and the play turns back north at (249,711). It never crosses the lock. The solver's own docblock names this L12 habit: "the coarse frontier always holds an actionable door (`shieldlocknorm@288,704`, …), so … every round spends a strategy on a door that does not lead to the aim" (`solverBot.js:28205-28213`). Re-solving from a 300-tick prefix, and from that prefix plus 60 ticks north, still detours to it (`tools/l12-prefix-solve.mjs`). So it is the solver's frontier choice. Its necessity is not separately witnessed, but the played line does not pass it.
- **Never cleared:** `12:5` and `12:3`.

### 4.3 L39 Totem Part 72,40: GAME YES
Leg 370 (from L40, (144,16)): 112 t, 0 hits, clears `["39:5"]`. The control adds only the staged `39:8`. The census row is the room reading its own `L39:8`; `wandlock@144,592` is the L38 door at the other end of L39.

### 4.4 L40 Chest: GAME YES
- **The game.** Leg 393 (from L39), without flag 12: 1,126 t, end (888.99, 823.58), 0 hits, clears `["40:13","40:16"]`. **`40:12` is never set**, and `buttonroom@880,768` is not pressed.
- **Reach.** Door-shut tile reach from (480,896) gets to the chest even with the buttonroom's tile walled (`reach/reach.txt`): the chest is entered from the corridor below it, and the south door `wandlock@480,560` is not on that line.
- **The refusals are flag-independent.** The solver refuses the chest twice, both times on the same kind of wall: "contact → kill (spinner@…) by press: every key set … lands the player box on … the 13 px hammer line … There is no step out". Once is L39 WITH flag 12 (sweep and node); once is L43 WITHOUT it (sweep and node, at (739.26,683.90)). From L43 the door-shut reach also gets to the chest, so that arrival without flag 12 is UNWITNESSED; the goal is witnessed from L39.

### 4.5 L40 Totem Part 160,640: GAME YES
Legs 392 / 408: 494 t / 118 t, 0 hits, clears `["40:25"]`. With flag 12 staged, the game also clears `40:11`: `wandlock@480,560`'s own tag fades behind the staged flag. Nothing else differs.

### 4.6 L40 Totem Part 64,144: GAME YES; L68 Health: GAME YES, earned and charged
- **L40 Totem 64,144.** Leg 870 (L42 → r0c53 ~> r4c4) stages the link's own `Any(L40:1, L40:7)` in both arms. Without `:12` / `:8`: 1,239 t, 0 hits, clears the wandlocks' own tags `40:2..6` + `40:20` (the totem). The control's ticks are identical. Reach: from the L41 arrival, opening either flag's wandlocks takes the reach from 187 to 248/250 tiles, with `bosslock@480,352` (`:8`) and the south door (`:12`) shut. Leg 868 (L41) is refused in both arms by the same puncher combat-ladder text; that is the solver's wall, not the flags'.
- **L68 Health.** Leg 921, without `68:0`: 184 t, 0 hits, earned `68:0` (`bosslock@16,32`, Yellow Key), `68:1` (`magicallock@16,32`, Wand) and `68:2` (the health). The control staged `68:0`: 74 t. **The rules already charge the event**: `level_68__r3c1 → level_68__r1c1 = And(Or(All(Fire, Fire Wand Fusion, Wand), Wand), All(L68 flag 0, Yellow Key))`, and flag 0's location in r3c1 = `And(Or(…Wand), Yellow Key)`. The census row comes from the leg list carrying `68:0` as route order: the link leg's staging did not list it, although the link's rule names it (§5).

### 4.7 L63 Chest: GAME YES (from r0c1); the L65 door already charges flag 7
- **The census arrival (leg 919, L65 → (128,288) in r6c9).** It lands on one floor tile ringed by pits, with `darktrap@128,272` (tag 4) as its only way out.
  - `DarkTrap.as:31-37`: it dies only when a non-player `Light` reaches it.
  - `LightPole.as:50,77-83,94-97`: `lightpole@112,272` (tag 7) is lit by a hit and writes `L63:7`.
  - `Player.as:1103-1108`: only a **Spear** hit lights a pole.
  - `Player.as:966-982, 1341-1348`: a 32 × 5 rect from (x+1, y+2) up, or from (x, y+2) left.
- **Lighting pole 7 from that tile, in the model** (`reach/l63-l65-arrival-stances.txt`): it needs x < 125.5 (spear up) or y < 286.5 (spear left).
  - The fall begins at x ≈ 126.66 (`fall: out`).
  - Contact with the darktrap begins below y ≈ 290 (the last contact-free sample is y 290.10; with the Dark Suit, the model then refuses that contact by name).
  - So from this arrival, the in-visit line needs a darktrap hit, which no tool here can author. **That arrival without `:7` is UNWITNESSED.** The solver's refusal ("A* start tile (7,18) … is not walkable: pit") is its pole stance at (123.6,301.2), quantised to a pit tile.
- **The rules already charge `:7` on that door.** `level_65__r0c8 → level_63__r6c9 = And(Or(All(Ghost Spear, Ghost Sword Fusion, Progressive Sword), L63 flag 7), …)`, and the route holds no Ghost Sword Fusion until 12.6 (sphere log line 84). The leg list did not stage it (§5).
- **The rules' event-free way in** is r0c1 (L61/L62 doors) → r6c9 (`Ghost Spear`) → r5c14 (`Dark Suit`). Boot re-staged at all four r0c1 arrivals, no flag: **4/4 done**, 0 hits, end ≈ (231.0, 88.4) = the model's, clears `63:1` (pole 1, speared; `Ghost Spear` charged) + `63:2`, `63:8` (its darktraps dying) + `63:5` (the chest). `:6` and `:7` are never touched. The L62 boots also press `buttonroom@32,64` (`62:0`/`63:0`) on the way.

### 4.8 L112 Owl: UNWITNESSED
- **What I tried.** Both sweep arms end `unresolved`: "a BOSS KILL (a finalboss in level 112, reported at {112,0}) … the bot has no fight executor for it". I did not hand-author the fight. `FinalBoss.as:60-62` (`onlyHitBy = "Lava"`, pods) needs a fight executor, not a stance.
- **What the source and the model say (not a verdict).**
  - `L112:1` is written by the Owl's own death: `FinalBoss.as:218-222`, `Button.activateAll(null, 0, true); … Game.setPersistence(tag, false); Game.setPersistence(tag+1, false);` with tag 0, so tag 1. It also opens `rocklock@112,16 {tset 0, tag 1}` (`RockLock.as:50-66`).
  - The door-shut reach from (32,208) covers the whole arena and the finalboss. The rocklock guards only the L113 teleporter (`reach/reach.txt`).
  - So the census pair (`L112:1` at 12.1, Owl at 12.4) is one event's two writes in sphere order. I did not witness it on the game.

## 5. What the census and the leg list should know (measured, no change made)

1. **The census is an upper bound, and the gap is wide.** Of the eleven route-order rows (ten here + BK2), only BK2's event gates its goal on the game. Seven rows' events are not on the goal's line at all: L30, L39, L40 Chest, L40 Totem ×2, L12 Witch, and L12 Chest via L83 or r0c19. Two are charged by the rules on the edge the leg used (L68 Health, the L63 door). One is a boss's own death write (L112).
2. **Two link legs leave unstaged an event their edge's rule names.**
   - 921: `r3c1 → r1c1` names `L68 flag 0`.
   - 919: the L65 door's `Or` needs `L63 flag 7` when no Ghost Sword Fusion is held at 11.2.
   - In the no-carry list both legs have `stagedEvents: []`, so the census counted both as route order. The leg list's doc says "The link's `game_state` event stages as a door edge's does". I did not find why these two do not. It is the planner's call whether that is the leg list's question. It is not a rules gap.
3. **Witness tools on a fresh game page must stage the fresh page's slot array** (§3.2), or an equip index names a different item on the game than on the model.
4. **Solver walls met, all flag-independent:**
   - the spinner hammer phase (L40 Chest, L39 with the flag and L43 without);
   - the puncher combat ladder (L40 Totem 64,144 from L41, both arms);
   - the L63 pole-stance pit quantisation (from L65, no flag);
   - a cover `STANCE_REENTRY` (L38 Chest from L39, flag staged);
   - L12's frontier door habit (§4.2).

   None is fixed here: the solver is out of scope.

## 6. Gates

| gate | result |
|---|---|
| per-goal census row, staging, runs, verdict | §2 table, §4; rows in `sweep/` and `game/` |
| bounded vitest: `boxLock.test.js`, the no-tracked-pointers guard, `checkProcgenHelp.test.js`, `lintGateLabels.test.js` | **4 files, 50 tests passed**. The guard re-run after the evidence commit: 2 passed |
| new probes in `boxLock.test.js`'s roster | none: the tools live under the evidence directory, not `scripts/procgen/` (the roster reads that directory) |
| `generate-procgen-reference.mjs --check` | "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE" (no script was added under `scripts/procgen/`) |
| rules, preset, atlas or table bytes | none moved; `Generate.py` was not run; `git status` showed only the evidence directory before the commit |
| the banned docs-directory string | absent from every added file (`rg -a`, exit 1) |
| unfiltered vitest, pytest | not run |

## 7. Residue

- The tools (`tools/*.mjs`, `sum.js`) are scratch instruments under the evidence directory, not producers. `reach.mjs` is a 16 px tile BFS: Seedling's 32 px `tree` entities make its L12 picture unreliable, so I do not use it for L12.
- The captured solve requests (about 11.5 MB each, the atlas in every request) are not committed. The sweep commands in §3.1 regenerate them, and the tools read them.
- The scratch `npm`/sweep logs stay in the session scratchpad.
- No solver, levelRun, `CONTACT_FIDELITY`, `frontend/modules/shared/`, `worlds/seedling/`, `vendor/seedling`, `.github/` or submodule-pointer change. Nothing was pushed to `main`, nothing was force-pushed, and no `git stash` was used.
