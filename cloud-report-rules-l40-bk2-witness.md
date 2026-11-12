# Cloud report — `rules-l40-bk2-witness`: is L40's Boss Key 2 reachable from the L39 arrival without flag 12?

## 1. Start, head, branch

| | |
|---|---|
| Session | `rules-l40-bk2-witness` (planner `seedling-rules-planning-6`), cloud, Opus |
| Start SHA | `git rev-parse origin/main` = `add369e82fc41b0a88505c74b665284ac7337269` |
| Branch | `claude/l40-bk2-reachability-witness-h589su` (the harness's designated branch) |
| Commits | `8559985a` the evidence (tools, witness tapes and game rows, the uncommitted rule as a patch, the sphere diff); this report is the last commit |
| Evidence | `CC/docs/cloud-reports/rules-l40-bk2-witness-evidence/` (`tools/`, `witness/`, `rule/`) |
| Environment | `session_bootstrap.sh --seedling` READY; the six non-wasm submodules initialised (no pointer moved); `minimal-spoilers`; dev server :8000 (`serve-nocache.py`, started here) |
| Scope messages | none arrived mid-run |

## 2. The answer first

**Verdict: GAME NO.** From the L39 arrival (488,904) with the door shut, the game does not let the player reach Boss Key 2. The door (`wandlock@480,560`, opened by flag 12's press) is required. The rules understate BK2's way in.

| # | question | answer |
|---|---|---|
| 1 | Does Fire move `pushableblockfire@576,576` from the corridor below it? | **No, only north, and north is the plain block.** `PushableBlockFire.hit` sends the block away from the hitter. From column 36 that means north, into `pushableblock@576,560`, a Solid. Witnessed on the game at the corridor's centre and at both edges: the block never moved (A1–A3) |
| 2 | What does move it? | **The Pulser.** `pulser@592,576 {tset 4}` shoves it one tile west into the pocket (35,36). In the control that happens at t≈3400, while the player stands on `button@816,400 {tset 4}` |
| 3 | Can the arrival reach a tset-4 activator with the door shut? | **No.** The tile reach (door shut, every Solid a wall) reaches 177 tiles. It reaches neither `button@816,400` nor the pulser's group. It does reach `buttonroom@880,768` (flag 12's press), which is how the door opens |
| 4 | The control, WITH `{40,12}` | **BK2 collected** (`40:14` cleared), 0 hits, 4,491 ticks. The game's last position equals the model's to the last decimal |
| 5 | The control's inputs with the door shut | **BK2 not collected**, 1 hit, and the blocks never move. The line runs north through the door at t301 |
| 6 | The rule | Derived generally (no level literal) and regenerated through the producers, **but it moves seed 1's spheres**: BK2 goes 6.8 → 7.3 and 45 of 88 rows move. **STOPPED before committing the rule**, per the brief. The producer change is in the evidence as `rule/producer-uncommitted.patch` |
| 7 | R-A5 | Does not fix it. R-A5 hangs BK2 off the south body `r26c13` at Sword + Fire, still without flag 12. The derivation composes with R-A5's door edge (§7) |

## 3. The source (vendor/seedling at `ccdf1897`)

**`Puzzlements/PushableBlockFire.as`: what moves it, which way, and what stops it.**
- `:23` `public var moveTypes:Array = new Array("Fire", "Pulse");`
- `:30-31` `type = "Solid"; solids.push("Enemy", "Player");`, so it is a Solid, and it stops at Solids. `Mobile.as:17` `public var solids:Object = ["Solid", "Tree", "Rock", "Rope", "ShieldBoss"];`
- `:98-121`, the direction of a hit at point `p`:
  ```
  var a:Number = Math.atan2( -(y - originY + height / 2) + p.y, p.x - (x - originX + width / 2));
  const bothRange:Number = 0.1;
  if (Math.abs(Math.sin(a)) - bothRange < Math.abs(Math.cos(a)))
  {   if (Math.cos(a) > 0) tile.x = getPos(x,y).x - Tile.w;  else tile.x = getPos(x,y).x + Tile.w; }
  if (Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)) - bothRange)
  {   if (Math.sin(a) > 0) tile.y = getPos(x,y).y - Tile.h;  else tile.y = getPos(x,y).y + Tile.h; }
  ```
  So the block always moves AWAY from `p`. A hitter directly below (|dx| ≤ 6, dy ≥ 10, given the player box `Player.as:295` `new Rectangle(2, 2, 4, 5)`) makes a ≥ 59° angle, which gives the vertical arm only.
- `:130-137` `if (moveX(v.x)) tile.x = getPos(x,y).x; if (moveY(v.y)) tile.y = getPos(x,y).y;`, so a blocked move is cancelled.
- `:43-46` it is destroyed only on Water, Lava or Pit (`myTile.t == 1 || 17 || 6`). It cannot burn.

**`Player.as` (Fire is a positional hit).**
- `:1032` `genericHit(e, "Fire", fireForce, fireDamage);`
- `:1125-1127` `else if (e is PushableBlockFire) { (e as PushableBlockFire).hit(new Point(x, y), t); }`. Fire passes the player's own position. Spear is the relative case (`:1121-1123`).

**`Puzzlements/PushableBlock.as` (the plain block).** `:27` `type = "Solid";`. `:39-58` it is moved only by the player walking into it (`collide("Player", x - 1, y)` with `c.v.x > 0` …). Nothing else moves it.

**`Puzzlements/Pulser.as`.** `:47-48` `setHitbox(16, 16, 8, 8); type = "Solid";`, so the pulser's own tile is a wall. `:54` `if (activate || radius > radiusMin)`. `:23` `radiusHit:int = 22`. `:100-103` `if (c is PushableBlockFire) { (c as PushableBlockFire).hit(new Point(x, y), "Pulse"); }`. The pulser centre is (600,584) and the block centre (584,584), so a = 0 and the block goes west to (35,36). After the shove the block's rect is 24 px from the centre, out of reach, so it is shoved once.

**`Puzzlements/Button.as`.** `:30-39` `collideTypesInto(hitables, x, y, v); … activate = tempCheck;`. A plain Button is momentary: the pulser pulses only while something stands on `button@816,400`.

**`wandlock@480,560` (the door) and flag 12.** The entity is `wandlock@480,560 {tset 3, tag 11}` and its opener is `buttonroom@880,768 {tset 3, tag 12}`. `WandLock extends Lock` (`WandLock.as:8`). `Lock.as:42` `if (tag >= 0 && tSet < 0 && !Game.checkPersistence(tag)) FP.world.remove(this);`, so a grouped lock's own tag is inert. `Lock.as:64-76`: on `activate` it fades and then `turnOff()` sets `type = ""`. The game keeps the BUTTONROOM's tag 12 (the in-room latch, `seedlingObstacleEvents.inRoomLatchButtonsOf`, `ButtonRoom.as:79-96`), hence "L40 flag 12: wandlock@480,560 cleared". The pulser's other activators are `wandlock@800,400 {tset 5}` (opened while `button@768,400 {tset 5}` is held) and `button@816,400 {tset 4}`. All of them are north of the door.

**The room (L40, from the model's own world, `tools/witness.mjs`).** The BK2 room (36..42, 32..34) has ONE way in: column 36 from the south. That column runs (36,41) → (36,37), then the fire block (36,36), then the plain block (36,35), and BK2 is at (41,33). (35,36) is a one-tile pocket entered only from (36,36), and (37,36) is the pulser.

## 4. The witness (game: `seedling_bot_ap_p4g`, headless logic-only, the delivered AP set)

**Staging.** The committed sweep-leg-873 request (`fixtures/hammer-bk2-approach-order/leg873-l39-l40-bk2-request.json.gz`): L40 boot (480,896), live (488,904), and BK2's sphere inventory: Sword, Shield, Fire, Torch, keys [0,1], seals 0–6. Persistence is `[]` for the door-shut arms and the request's own `[{40,12}]` for the control. Nothing else is staged: no removed body, no game value. The door-shut tapes are hand-planned by a closed-loop author on the model (`tools/witness.mjs --build`). Every arm's game end position equals the model's exactly. Each run took the box lock.

| arm | ticks | end (game) | hits | fire block @576,576 | plain block @576,560 | BK2 (`40:14`) | flag 12 |
|---|---|---|---|---|---|---|---|
| A1: Fire ×6 from directly below, centred (x 586), then 60 t pressing up | 704 | (585.96, 594.05) | 0 | (576,576) unmoved | (576,560) | **no** | no |
| A2: Fire ×6 from below at the west edge (x 578.0) | 651 | (578.03, 594.12) | 0 | (576,576) unmoved | (576,560) | **no** | no |
| A3: Fire ×6 from below at the east edge (x 590.0) | 648 | (589.99, 594.10) | 0 | (576,576) unmoved | (576,560) | **no** | no |
| A4: up column 30 into the door, Fire and Sword at it, press up | 434 | (488, 578.0) | 0 | (576,576) | (576,560) | **no** | no |
| **B: control WITH `{40,12}`**: the solver's plan (1,381 units, 4,491 t) | 4,491 | (663.70, 535.08) | **0** | **(560,576)**, shoved west at t≈3400 with the player on `button@816,400` (823.8,408.1) | **(576,512)**, walked north t4322–4422 | **yes** | (staged) |
| B′: the same inputs with the door shut | 4,491 | (467.44, 674.00) | 1 | (576,576) | (576,560) | **no** | no |

In the control the player crosses the door northward at t301 (488, 559.75). It then pushes `pushableblockfire@480,480` onto `button@768,400` with Fire (it rests at (768,400) from t3261), which opens `wandlock@800,400` (`40:21`). It stands on `button@816,400`, the pulser shoves the BK2 block west (574.5 → 560 over t3402–3432), and it walks the plain block north and takes BK2. Clears: `40:9, 10, 11, 12, 14, 15, 21`.

**Door-shut reach** (`witness/reach-door-shut.txt`, a tile BFS on the model's world with every Solid a wall): 177 tiles. **REACHED:** `buttonroom@880,768` (flag 12's press), `wandlock@480,560`, `pushableblockfire@576,576`, `wandlock@448,432`, the L39 teleporter, the stairs and the L43 fallthrough. **Not reached:** `button@816,400`, `pulser@592,576`, `button@768,400`, `wandlock@800,400`, `button@480,384` and `apitem@656,528`. The other way north, `wandlock@448,432 {tset 2}`, needs `button@480,384` held, and that button is itself north.

**The solver arm (node), for the record:** without `{40,12}`, at main's defaults with the budget lifted (cap 60,000), the solve is REFUSED at 34,697 dashless units: "no approach to iceturret@472,400 from the staging point (488.1,568.7) is hitless — 504 fork(s)". That is walk-walls' sweep-minus-12 number exactly. With `{40,12}` it is SOLVED at 1,381 units, 4,491 ticks.

**Not tried, and why:** an in-visit line (press `buttonroom@880,768`, then go north). That line earns flag 12, so it is the door line, not a doorless one.

## 5. Why the rules missed it

`level_40__r23c29 → level_40__r32c36` is priced Fire (the transcription's `pushableblockfire: G(flag('hasFire'))` claim on (36,36)), and `applyHandRulings` adds the weapon (`OV.L40_EAST_RULE`). The producer's struck-block pass (`playthroughBlockCrossings`) prices a crossing by its push paths, but L40 never got there for two reasons:
- **It skipped L40** ("no stopper": the pass only ran where a DarkTrap stood).
- **Its push model was wrong for a fire block.** `deriveWeaponFootprint('fire','block')` lets any of the 8 ring stances push in any direction. So "Fire from (36,37) pushes west into the pocket" looked possible. A1–A3 refute it on the game.

On main the door itself is a free grouped lock (the puzzle policy), so `r23c29` glues the south, west and north bodies. That is why "Sword + Fire" looked sufficient.

## 6. The rule: derived, regenerated, and STOPPED on a sphere move

**The derivation** (`rule/producer-uncommitted.patch`, about 270 lines in `flashPanel/seedlingBlockPaths.js` and `make-seedling-playthrough-rules.mjs`). It uses no level literal; every input is read from the room's entities, the AS3 citations and existing producer tables.
1. **`hitAwayStances`.** For a block whose `PUSHABLE_KINDS` row says `hitAway` (the fire block, `PushableBlockFire.as:98-121`), a stance pushes `dir` only from the far side of that axis. Diagonals keep both axes.
2. **`bodies`** (opt-in in `blockPushSearch` and `blockCrossingCost`; the default stays byte-identical for tileSpike and the census). The room's other pushables are Solids to a struck block, unless the player's region in that state holds their cell (then the player could walk it away).
3. **`pulserShoveTarget`.** This is `Pulser.hit`'s reach (22 px) and the shove direction. A diagonal shove, or one that stays in reach, is refused by name.
4. **`activatorReachCost`.** It returns the Pareto-minimal sets of latched-lock events under which the walk from the near side reaches the pulser group's activator (`ACTIVATOR_PRESSERS` with the same `tset`).
   - The latched locks are the in-room latching ButtonRooms' `lock-despawn` targets (`inRoomLatchButtonsOf` + `PERSISTENCE_RESPONSE`), each named by its minted event.
   - A re-closing lock (`OV.buildGroupOpeners`, non-latching with holders) opens only once the walk reaches one of its holders (a fixpoint). Without that, the walk leaked round the door through `wandlock@448,432`, whose directional gate the grid computed with the door free.
5. **`playthroughBlockCrossings`** now also runs in rooms with two or more pushables. It accepts a hand-strengthened row (an `And` keeping the push item). Where the player's own push cannot cross, it prices the crossing through a pulser shove. If the near side holds no activator, the walk starts from the block's other sides. A near side entered only through the block's own cell (no location, no door) is skipped by name.

**Result (`rule/block-crossing-notes.txt`).** Three gates, all `Has("L40 flag 12: wandlock@480,560 cleared")`, ANDed onto `r23c29 → r32c36`, `r23c29 → r36c35` and `r32c36 → r23c29`. Each `why` reads: "no push of the player's from … opens it (beside it: the pushable at (36,35)); only pulser@592,576's shove does, and its group's activator is walked to (from (36,37)) only with L40 flag 12". `r32c36 → r36c35` is free beyond the push item, which is right: from inside, Fire pushes the block south and frees the pocket. `r36c35 → *` is "entered only through the block's cell". Every other room prices the same. L41, L63, L65 and L67 have the same notes, and the single L63 gate is unchanged. L39 (three fire blocks) is now examined instead of skipped as "no stopper", but each of its blocks borders only one sub-region, so it gets no crossing and no gate (measured against the reverted tree). AP_1 changes only at those three L40 exits; the atlas does not change.

**Regenerated in order:**
- playthrough atlas and rules: atlas unchanged, AP_1 3 exits;
- partition `--check` OK;
- world package by its recipe (`world_generator … --apply-name-substitutions --canonical-seed 1`), with `check-worldgen-package-freshness.py seedling_playthrough` **PASS** (byte for byte);
- `Generate.py` seed 1 (minimal-spoilers).

The sphere log `548cb7cf…` became `665ea6ed…`. **STOP.** Maze, `seedling_er` and frontier were not regenerated, and no pin was re-recorded. The tree is reverted, so every producer `--check` is OK on the branch.

**Every moved row** (`rule/seed1-sphere-moves.txt`; 45 of 88 sphere locations; the first differing line is index 32):

| location | before | after |
|---|---|---|
| Level 040 - Boss Key 2 | 6.8 | 7.3 |
| Level 040 - Chest | 6.9 | 6.8 |
| Level 040 - Totem Part 160,640 | 6.10 | 6.9 |
| Level 046 - Chest | 6.11 | 6.10 |
| Level 048 - Chest | 6.12 | 6.11 |
| Level 055 - Boss Key 3 | 6.13 | 6.12 |
| Level 089 - Feather | 6.14 | 6.13 |
| Level 090 - Chest | 6.15 | 6.14 |
| L40 flag 1: wandlock@176,80 cleared | 7.1 | 8.1 |
| L40 flag 7: wandlock@208,128 cleared | 7.2 | 8.2 |
| L40 flag 8: bosslock@480,352 cleared | 7.3 | 8.3 |
| L48 flag 1: bosslock@48,144 cleared | 7.4 | 7.1 |
| L58 flag 1: yeti@56,56 cleared | 7.5 | 7.2 |
| Level 040 - Totem Part 64,144 | 7.6 | 8.7 |
| Level 041 - Totem Part 240,144 | 7.7 | 8.8 |
| Level 042 - Totem Part 184,152 | 7.8 | 8.9 |
| Level 057 - Tentacled Beast | 7.9 | 7.4 |
| Level 064 - Ghostspear | 7.10 | 7.5 |
| L63 flag 6: lightpole@48,272 cleared | 8.1 | 8.4 |
| L63 flag 7: lightpole@112,272 cleared | 8.2 | 8.5 |
| L65 flag 0: lightpole@128,168 cleared | 8.3 | 8.6 |
| Level 043 - Wand | 8.4 | 9.3 |
| Level 067 - Boss Key 4 | 8.5 | 8.10 |
| L12 flag 7: magicallock@32,864 cleared | 9.3 | 10.1 |
| L68 flag 0: bosslock@16,32 cleared | 9.4 | 10.2 |
| Level 012 - Witch | 9.5 | 10.3 |
| Level 043 - Totem of Lacste | 9.6 | 10.4 |
| Level 068 - Health | 9.7 | 10.5 |
| Level 069 - Lights | 9.8 | 9.4 |
| Level 071 - Chest | 9.9 | 10.6 |
| Level 074 - Darkshield | 9.10 | 10.7 |
| L71 flag 2: shieldlock@288,256 cleared | 10.1 | 11.1 |
| Level 079 - Darksuit | 10.2 | 11.2 |
| L101 flag 0: lightpole@144,64 cleared | 11.1 | 12.1 |
| Level 063 - Chest | 11.2 | 12.2 |
| Level 080 - Chest | 11.3 | 12.3 |
| Level 082 - King of Fire | 11.4 | 12.4 |
| Level 098 - Chest | 11.5 | 12.5 |
| Level 106 - Ghostsword | 11.6 | 12.6 |
| L112 flag 1: rocklock@112,16 cleared | 12.1 | 13.1 |
| L114 flag 0: watcher@72,72 cleared | 12.2 | 13.2 |
| Level 109 - Firewand | 12.3 | 13.3 |
| Level 112 - Owl | 12.4 | 13.4 |
| L113 flag 0: finaldoor@112,0 cleared | 13.1 | 14.1 |
| Level 115 - The Seed | 13.2 | 14.2 |

**Why it moves.** Flag 12 is an event collected at sphere 6 (6.1), so BK2 becomes reachable one sphere later. BK2 holds the Purple Key, which gates `L40 flag 8` (bosslock@480,352) and L40's north block, so the tail shifts one sphere. The game is still beatable (The Seed at 14.2); no location becomes unreachable.

**A trap worth naming.** A first scratch measurement ANDed flag 12 onto `r23c29 → r32c36` alone, and the sphere log came out byte-identical (`548cb7cf…`). BK2 was still reachable through the pocket (`r23c29 → r36c35 → r32c36`). Only the derivation, which gates the pocket edge too, shows the move.

**For the decision (back to Robert):** land the derivation and accept the 45-row move, or keep the rule as is and let the walk carry the door (DOOR-CARRY's `--carry-route-flags` already stages it in the sweep). No `payloadMd5` moved: the derived-rule table was not regenerated, and the three L40 exits are not table rows.

The patch's own effect on the bounded tests is in `scripts/procgen/seedlingBlockCrossings.test.js`:
- **3 rows red**, all because they pin the block producer's gate list and it gains the three L40 gates. The L63 gate itself is unchanged.
- `frontend/modules/flashPanel/seedlingBlockPaths.test.js` stays 40/40 green.

## 7. R-A5 (`tile-rules-automation-r-a5`, read at `003fcc54`, not merged)

R-A5 splits L40's main body. The south and west part becomes `r26c13`, carrying Totem Part 160,640 and the Chest. `r23c29` becomes the north, and R-A5 adds `r26c13 → r23c29 = flag 12`. But **it still hangs BK2 off `r26c13`** with `r26c13 → r32c36 = And(Fire, Or(Sword, Ghost Spear))` and the same for `r36c35`. The column-36 corridor is in the south body, so under R-A5 BK2 is still reachable from the south without the door. The understatement survives R-A5.

The derivation does not depend on R-A5's reshape. Its activator walk reads the door from the in-room latch rows, not from a region boundary. On R-A5's regions it would gate `r26c13 → r32c36` and `r26c13 → r36c35` with flag 12, consistent with R-A5's own door edge. One check is still owed: the hand-strengthened `And` acceptance has to hold on R-A5's rows too. The two slices touch different functions (`playthroughBlockCrossings` and `seedlingBlockPaths`, against R-A5's region split). Expect a textual merge in `make-seedling-playthrough-rules.mjs` only if R-A5 edits the same pass.

## 8. Gates

| gate | result |
|---|---|
| source quotes | §3 |
| witness runs | §4 (`witness/game-rows.txt`, per-arm `*.game.json.gz` with 10-tick samples of the player and all three blocks, the tapes, `model-rows.json`) |
| bounded vitest, standing set: `boxLock.test.js`, the no-tracked-pointers guard, `checkProcgenHelp.test.js`, `lintGateLabels.test.js` | **4 files, 50 tests passed** |
| tests touched / atlas-, AP_1-, maze-, er-readers | none on the branch: the rules did not move here (STOP). The patch's own run is in §6 |
| `generate-procgen-reference.mjs`, then `--check` | "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE"; no diff |
| `census-seedling-constants.mjs --write` | not needed: no code literal changed on the branch |
| producers `--check` on the branch | playthrough rules (atlas + AP_1) OK; partition OK; maze OK; `seedling_er` OK; sphere-order OK |
| world package freshness (with the patch) | `seedling_playthrough` PASS, byte for byte |
| Generate dirt | reverted (`git checkout -- frontend scripts worlds`, `output/` removed); `git status` shows only the evidence |
| `NewDocs` | absent from every added file |

## 9. Residue

- No solver, levelRun, `CONTACT_FIDELITY`, `frontend/modules/shared/`, tileSpike, derived-table, `worlds/seedling/`, `vendor/seedling`, `.github/` or submodule-pointer change.
- The evidence tools (`tools/*.mjs`) are scratch instruments under the evidence directory, not producers.
- The dev server started here (`serve-nocache.py` :8000) is stopped at the end of the session.
