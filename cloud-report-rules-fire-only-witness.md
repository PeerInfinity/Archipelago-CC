# cloud-report — rules-fire-only-witness

Branch `claude/rules-fire-only-witness-v5e6p6`, from `origin/main` = `75e45c964d9ce37b3eb6db3c1e887b9b873b484c`
(`git merge-base --is-ancestor 978205e557 origin/main && echo ok` → `ok`). Wasm page `seedling_bot_ap_p4g`,
headless logic-only channel (asserted on every play). Evidence: `CC/docs/cloud-reports/rules-fire-only-witness-evidence/`.
Nothing in the rules, presets, atlas, tables, solver or `vendor/seedling` was changed. No pointer moved.

## Answer

| row (seedling_playthrough AP_1) | Fire only (0 hits?) | Sword control | what decides it |
|---|---|---|---|
| L92 `r1c7 → r3c12` (break `@176,48` from the west) | **GAME YES** | GAME YES | 4 Fire tapes, 0 hits, all of them through the rock cell at t266 |
| L92 `r3c12 → r7c17` (break `@256,112` from the west) | **GAME YES** | GAME YES | the same 4 tapes: through the rock cell at t390–487, then out to L87. Bob is slower than the player and the spinner is a timing question |
| L73 `r3c7 → r0c4` (north) | **GAME NO** | GAME YES (the solver's plan, 0 hits, out to L74) | `lavarunner@72,24` never leaves its pocket and hits the player in the rock's gap. Fire cannot kill it or hold it, and it moves 1.875× as fast as the player |
| L73 `r0c4 → r3c7` (south) | **GAME NO** | **GAME NO, the same hit** | the L74 door's landing sits inside the lavarunner's contact box: a hit at t2 for every arm and every input, and the knockback throws the player back through the L74 door at t6. This one does not depend on Fire |

The solver's refusals: L92 (a fork hit by Bob during the wait) was the solver being cautious. The game crosses with Fire
and no hit. Both L73 refusals are real.

## Setup run

`session_bootstrap.sh --seedling` reached READY, the six submodules were initialised (no pointer moved), and
`update_host_settings.py minimal-spoilers` was run. The dev server ran on 8000 (`serve-nocache.py`). The tooling branches the brief
names all exist. I read `legwitness.mjs`, `l99.mjs` and `model-replay.mjs` and adapted their play loop and hand-script
authoring into `tools/fireonly.mjs`. The staging is `fidelityArrival.arrivalStaging`, the same boot and items as
`FIREBREAK_RULES_REFUSED`. That avoids the §3.2 slot trap: each of these stagings holds one weapon, so slot 0 is the arm.

Reproduced first: `probe-seedling-fire-break.mjs --set=rules-refused --only=rules-l73-north,rules-l73-south,rules-l92-reverse`
→ all three refuse, word for word as in the Fire slice's report.

## The source (vendor/seedling `ccdf1897`)

- Fire does no damage. `Player.as:178` `fireDamage = 0`, `:179` `fireForce = 0.325` (added on each tick of the flame's
  frames 3–6, `Player.as:1014-1035`). `Enemy.as:151` `if (hitByFire || t != "Fire")`: `hitByFire` defaults to false
  (`Enemy.as:38`), so a Fire hit on any of these bodies only calls `knockback`.
- The player walks at `dMS = 0.8` px/tick (`Player.as:73`).
- Bob: `Bob.as:18` `moveSpeed 0.5`, `:21` `runRange 80`, `:59` it chases straight at the player inside 80 px, with no
  pathfinding and no leash. Every tick it adds `±moveSpeed` per axis toward the target and then normalises. A knock of
  0.325 therefore costs Bob about one tick of motion, and it cannot hold a body back.
- LavaRunner (`LavaRunner.as`, a Bob): `:18` `normalSpeed 1.5`, `:17` `swimSpeed 1` (in lava), `:38` `dieInLava = false`,
  `:41` `hitsMax 2`. It cannot be killed by Fire or by the room's terrain (L73 has no water or pit). Its 1.5 px/tick
  correction outweighs the 0.325 knock.
- Bulb (`Bulb.as`, a Bob): `:29` `moveSpeed 0.65`. It keeps `Enemy`'s `dieInLava = true` (`Enemy.as:40`, used at `:85`),
  so it dies when it walks into lava.
- Spinner (`Spinner.as`): it does not chase (`runRange 0`). It bounces at 1 px/tick and sweeps a 13 px hammer
  (`:70-75`, hitForce 4) whose angle is set by `Game.time`. Whether it hits is a matter of phase.
- Prediction (written before playing): L92 YES, because Bob is slower than the player and the spinner is a phase
  question. L73 north NO: the runner shadows the player's x along the pocket's south wall and the crossing's path runs
  through its pocket. L73 south NO: the runner is next to the landing.

## L92 reverse: GAME YES (both rows)

Staging: the L91 door's landing (32,128), `[hasFire, canSwim, hasShield, hasTorch, hasFeather]` (the brief's arrival
cost: Swim). The route: swim east, Fire on `@176,48` from (160,56), across the shelf, wait `w1` at (200,72), Fire on
`@256,112` from (248,104), wait `24 + w2`, walk out south to the L87 door (272,144).

The model search (`fireonly.mjs --search=l92`, `runs/l92-search-fire.txt`): 141 hitless (w1, w2) pairs out of 651
(w1 0–300 step 10 × w2 0–120 step 6), including (0,0). Four of them were played:

| tape (`tapes/`) | ticks | rock 1 cell | rock 2 cell | L87 at | game hits | model |
|---|---|---|---|---|---|---|
| `l92-wait-0-0` | 486 | t266 | t390 | t431 | **0** | 0 |
| `l92-wait-20-18` | 520 | t266 | t425 | t466 | **0** | 0 |
| `l92-wait-50-0` | 532 | t266 | t437 | t478 | **0** | 0 |
| `l92-wait-100-0` | 582 | t266 | t487 | t528 | **0** | 0 |

Every tick was sampled (`*.game.json.gz`, 487–583 samples each); `runs/play-l92.log` has the ROWs. "Rock cell" is the
first tick the game puts the player inside the rock's 16 px tile. Region r1c7 is bounded at x ≈ 190 by a cliff
pixel mask, so the only way into r3c12 is through `@176,48`, and the only way into r7c17 is through `@256,112`. Each
tape therefore crosses both rows, and the end in L87 shows it.

- What the solver refused: `bob@224,112` hitting the player during the 23-tick wait from the stance (247.84,103.53) at
  t387. From the stance (248,104) Bob is about 34 px away when Fire is pressed, at 0.5 px/tick, and has not reached the
  player when the rock goes. What hit my first scripts was the spinner on the way out, never Bob. The waits move the
  spinner's phase.
- **Control (Sword):** `l92-control-sword` uses the same route with the stances moved to face each rock (168,56 and
  248,118, facing east, because a blade needs the rock in front of it). Game: 0 hits, L87 at t437. The solver also refuses
  the Sword run (`runs/solve.log`, a spinner hammer forecast at (191.7,52.9)). So the solver's refusal here comes from
  the tooling and is not specific to Fire.

## L73 north `r3c7 → r0c4`: GAME NO

Staging: the L72 door's landing (32,128), `[hasFire]`. The room: the rock `@64,48` (cell c4 r3) is the only gap in the
wall row r3 (Dark Stone c2–3 and c5–6). North of it is the pocket (r2 c3–5, r1 c4–6) with the L74 door at c4 r0. The
lavarunner (centre 80,32) lives there. The bulb (centre 88,88) is on the south floor.

What the game and the model both show:

1. **The bulb can be dealt with without Fire.** `bulb-search.mjs` (2600 candidates) found 11 hitless lava kills. With
   go (72,120), then go (40,136), then wait, the bulb walks into the lava pit at c3 r8. On the game it is gone at **t154**
   in all three tapes that use this step.
2. **The lavarunner cannot be lured out.** It homes straight at the player, so it stays at the pocket's south edge
   (y ≈ 41.2–42) and follows the player's x between about 51 and 89. Lava edges and walls stop it on every lure point the
   player can stand on: it parks at (51.3,41.9) when the player is west and at (89.3,41.2) when the player is east
   (traces in the model logs). The player can only cross through the gap (x 64–80). From either parking spot the runner
   is 11–14 ticks (at 1.5 px/tick) from the gap. The player needs about 38 ticks to get from the stance to y ≈ 42.
   While the player stands at any stance within the flame's reach, the runner is within its 80 px range.
3. Fire cannot kill it (damage 0), and the knock is 0.325 against its 1.5 correction. The room has no water or pit, and
   `dieInLava = false`.

Attempts on the game (`runs/play-l73-controls.log`; the hit samples come from `*.game.json.gz`):

| tape | script | first hit (game / model) | where |
|---|---|---|---|
| `l73n-bulb` | bulb into the lava, stance (72,73), Fire, up | **t287** / t286 | player (73.0,49.3) in the gap, LavaRunner (76.3,41.1) |
| `l73n-east` | bulb, wait 120 at (120,56) so the runner parks east, stance, Fire, up | **t523** / t522 | player (70.2,49.6), LavaRunner (76.3,41.6) |
| `l73n-offset` | bulb, east stance (93,70) (the flame still reaches the rock), Fire, up | **t390** / t389 | player (69.3,50.8), LavaRunner (78.2,42.0) |

The model search (`l73-search.mjs`, `runs/l73-search.txt`) tried 1872 candidates: the bulb's kill, then any south-floor
lure point × 6 idles × 4 stances × 3 idles. **Zero were hitless**: 1800 were hit by the lavarunner. 40 ended in L72
without a hit because the lure point was the L72 door's own tile. The other 32 were hit after a death and respawn.
The model and the game agree within 1 tick on all three played tapes.

- **Control (Sword):** the solver plans it (`solve-rules-l73-north-sword`, 166 ticks, a break press at t70). Game:
  **0 hits**, out to L74 at t165, and the bulb is gone at t97. The Fire refusal is specific to Fire: it is the runner
  that Fire cannot kill.

## L73 south `r0c4 → r3c7`: GAME NO, and not specific to Fire

The L74 door's landing (64,16) puts the player's centre at (72,24), 8 px from the lavarunner's centre (80,32) on each
axis. The boxes overlap from the first tick. Game (`l73s-idle`, `l73s-idle-sword`, `l73s-west`): **hit at t2** with
Fire, with Sword, and when stepping west straight away. On t6 the knockback carries the player into the L74 door
(level 74 at (296,136)). In the model, all 9 key choices and a press on t0, with each of Fire and Sword, take the hit at
t1–2. The solver refuses Sword here too (`runs/solve.log`). Region r0c4 is entered only from L74 or through the
rock from r3c7. The first way always hits, and the second needs the north crossing, which is GAME NO with Fire.

⇒ The L74 → L73 arrival takes a hit for every arm. This is a finding about the arrival, outside the Fire question.
`level_74 → level_73__r0c4` is not hit-free, whatever the rock rule says. I did not look at it further.

## Sketch of the general fix (NOT committed; Robert decides)

**Rule:** a Fire arm (an Or arm that Fire adds in place of a weapon at a rock break) does not count when the crossing's
corridor (the rock cell, its stances and the path from the rock to the target side's exits and landings) lies within
the reach of a body that is all of the following:

- (a) **not killable by the Fire-only state**: `fireDamage` 0, so only bodies with `hitByFire` true take damage from
  Fire, and there is no lethal terrain on the body's homing approach (`dieInLava` / `dieInWater` / `canFallInPit`
  against the room's lava, water and pit tiles);
- (b) **faster than the player**: its `moveSpeed` on the terrain it holds is greater than `dMS` 0.8;
- (c) **a homer whose leash covers the corridor**: `runRange` reaches the corridor from the region the body can move
  in. That region is a flood over the terrain the body can cross (LavaRunner: stone and lava), starting at its spawn.

**Inputs:** per-class constants from the AS3 source (`moveSpeed`/speed constants, `runRange`, `hitsMax`, `hitByFire`,
`dieIn*`, `canFallInPit`; Player `dMS`, `fireDamage`, `fireForce`). The project's constants census is the natural home
for these, and nothing here is a per-level literal. Also needed: the atlas level's entities and tile terrain, the rock
stances (`rockFireSides` already computes them), and the region partition. The bulb shows why (a) needs the terrain
term: it is slower than the player and dies in lava, so it never blocks.

**Rows it touches** (every rock row that Fire opened, from the Fire slice's scope, with the bodies in each room):

| level | bodies in the room | touched? |
|---|---|---|
| L0, L3, L15 | none | no |
| L16 | 7 × bob (0.5) | no (slower than the player) |
| L30 | bobsoldier (0.8, not faster) | no (also GAME-witnessed by fidelity `firebreak-l30-pit`) |
| L92 | bob 0.5, spinner (no homing), jellyfish 0.8 (stays in the water) | no (consistent with GAME YES above) |
| **L73** | **lavarunner 1.5/1, `dieInLava` false**; bulb 0.65 | **yes, both directions** → back to `HasAny(Dark Suit, Ghost Spear, Progressive Sword)` |
| L100 | flyer (`Flyer.as` normalSpeed 1, `dieInLava`/`dieInWater` false), 4 × jellyfish | **maybe** `r4c10 → r2c3`, if the flyer's reach covers it. That row is logic-neutral (r4c10 has no arrival), so the spheres do not move either way |

**Effect on seed 1** (`seedling_playthrough` AP_1, minimal-spoilers), derived rather than regenerated:

- The playthrough's placement is canonical (`is_canonical {"1": true}`). The Fire train (`3f1cee5e`) changed AP_1's
  `rules.json` and `.archipelago` but **not** the sphere log or the spoiler (`git diff --stat 3f1cee5e^1 3f1cee5e`).
- The fix's rules lie between the pre-Fire rules and the current ones, row by row. Reachability is monotone in the
  rules. With fixed placements and the same sphere log at both ends, every sphere in between is the same. ⇒ **the
  sphere log stays byte-identical.**
- Directly from the log: `Progressive Sword` arrives in sphere **0.1** and `Fire` in **4.8**. Both L73 regions first
  appear in **10.1**, and L92's r1c7/r3c12/r7c17 in 0.1. The Sword arm always settles these rows first.
- `.archipelago` changes, because it embeds the rules, as it did for the Fire train. On other seeds where Fire comes
  before the Sword, the L73 rows go back to their pre-Fire strength.

**Effect on `seedling_er`:** items are vanilla. Fire is `Level 032 - Bob Boss`, whose rule is
`Or(Progressive Sword, Ghost Spear)`, and either one already opens L73. Every state that holds Fire therefore opens
L73 already, so the Fire arm there is dead logic. The fix changes the rule text of the same two L73 rows and nothing
reachable, for any stairs draw. The draw's acceptance (beatable under its own rules) is monotone and held under the
pre-Fire rules, so it is unchanged.

## Stops

- **A rule change looks necessary** (L73, both directions): I stopped at the sketch above.
- No change to the solver, levelRun or `CONTACT_FIDELITY` was needed. Every witness is a hand tape played on the game,
  and the model only chose the keys.

## Evidence index

- `tools/fireonly.mjs`: cases, the model authoring (`to`/`go` tile path/`fire`/`wait`/`keys`), `--search=l92`, `--solve`
  (the solver's plan per arm, `fidelityFireBreak.fireBreakPlan`), `--build`, `--play` (botStatus + botMobiles every
  poll). `tools/l73-search.mjs`, `tools/bulb-search.mjs`, and `tools/map.mjs <level>` (an ASCII dump; note that L92's
  cliff pixel masks do not show in it).
- `tapes/*.tape.json` (tape v8, the game's arrival staging), `tapes/*.game.json.gz` (every polled tick), `runs/*`.
- Re-run: dev server on 8000, then `node CC/docs/cloud-reports/rules-fire-only-witness-evidence/tools/fireonly.mjs
  --play=CC/docs/cloud-reports/rules-fire-only-witness-evidence/tapes --case=<name>` (takes the box lock).
- Gates: none run. No product code changed, and no vitest was run.
