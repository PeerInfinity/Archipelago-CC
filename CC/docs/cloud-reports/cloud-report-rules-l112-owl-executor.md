# Cloud report: `rules-l112-owl-executor` — a witness-side Owl fight executor, and the L112 Owl rule witnessed

Branch `claude/l112-owl-executor-witness-iwu8fj` (REPORT ONLY: evidence and tools, no rule/preset/atlas/table/solver/levelRun/
`CONTACT_FIDELITY`/fixture change).

Base: `git rev-parse origin/main` = `f96d6b66254cd8c2dd08323a489d5d1f07525600` (the brief's floor, rule K + (b) on it).
Game: wasm `seedling_bot_ap_p4g`, one FRESH page per tape, headless logic-only channel (`__swfGpu = {"lost":1,"stalls":0}`),
dev server :8000, box lock taken per judge run. Every game row below is a `judge.mjs` row in `…-evidence/logs/*.json`.

## Answer table

| # | question | answer | evidence |
|---|---|---|---|
| 0 | Control: `r6-owl-kill` on a fresh page | **GAME YES — kill, `112:0` + `112:1`, but 0 hits, NOT "1 at t555"** | `logs/q0-control.json`: 816 ticks, lava t18/t307/t705, `slash {hits 11, tests 15}`, the game stream equals the model's on all 817 observations. The tape's own description still says "one rock at tick 555"; that was slice 6g's plan. The committed plan is slice 6h's, which takes none (`plan-seedling-r6-wowl.mjs`'s own check prints `drive hits []`) |
| 1 | Sword alone, 0 hits, L111 arrival → kill → both rows → L113 | **GAME YES — 9 of 9 seeds** (1–8, 101) | `tapes/owl-sword-s101.json`, `logs/q1-sword-s101.json`: 1836 ticks, 0 hits, cleared `112:0`,`112:1`, ended **in L113 at (80,136)**. Shoves t375/t688/t1562 → lava t378/t696/t1570, tags t1679, exit from t1783 |
| 2 | Ghost Spear alone (no Sword), 0 hits, same route | **GAME YES** — **9 of 9 seeds** (1–8, 101). The thrust shoves him (`justKnock`, `spearForce` 7) | `tapes/owl-spear-s*.json`, `logs/q2-spear-s101.json`, `logs/q4-batch{1..4}.json` |
| 3a | No weapon | **GAME NO** (by source; game control agrees) | `tapes/q3/q3-none-orbit-s101.json`: 1270 ticks (three legs past the lava, all four pods), 0 player hits, Owl census `hits` 0, no flag. With no weapon, nothing calls `Enemy.hit` or `knockback` on him, and his own walk never enters lava (`FinalBoss.as:155-181`) |
| 3b | Shield ×1 (Progressive Shield 1) | **GAME YES for a 0-hit lava self-hit; the KILL is UNWITNESSED.** 2 of 3 lava hits witnessed in one run, before rocks killed the player | `q3-shield-s101-t369-down`, `-t405-right`, `-t417-right`: Owl `hits` 1, player 0 hits. Stage 2 `q3-shield-s101-k2-t838-right` (`logs/q3-shield-k2.json`): Owl `hits` **2** at t849 with the player still on 0 hits; then rocks at t992/t1101 and a death in the next barrage |
| 3c | Shield ×2 (Dark Shield) | **GAME YES for a 0-hit lava self-hit; kill UNWITNESSED** | `q3-shield2-s101-t369-down`, `-t405-right`: Owl `hits` 1, player 0 hits |
| 3d | Wand | **GAME YES for a 0-hit lava self-hit (5 of 6 single shots); kill UNWITNESSED** | `q3-wand-s101-t370/382/398/410/429`: Owl `hits` 1, player 0 hits, one `WandShot` from ~30 px |
| 3e | Dark Suit | **No 0-hit line by construction** (source); kill UNWITNESSED | the Suit's shove fires only inside `Player.hit`'s damage arm (`Player.as:1382-1387`), so every Suit shove IS a player hit; force 1 (`darkSuitForce`, `:256`) |
| 3f | Fire | not an arm (⚖ no damage). It **does shove**: `genericHit(e, "Fire", fireForce 0.325)` (`Player.as:1032`, `:179`) → `Enemy.hit`'s `else if (justKnock) knockback(f, p)` (`Enemy.as:176-178`) | source only, as briefed |
| ⇒ | rule consequence | **the rule `Or(Progressive Sword, Ghost Spear)` is STRICTER than the game for at least the Shield and the Wand.** Each one witnessably shoves him into his own lava self-hit with 0 hits; the 3-hit kill is unwitnessed. Reported, not loosened | §3 |
| 4 | RNG: ≥ 8 seeds, seed-independent strategy? | **Sword 9/9 and Spear 9/9 0-hit YES on the game** (seeds 1–8, 101; per-seed table §4, `owl-seeds.json`). The hit-only arm is shown too: 3 Sword tapes win with 2 hits. **There is no seed-independent TAPE.** The rocks are `Math.random`-aimed (`FinalBoss.as:136-146`). No fixed dodge orbit is hit-free on every seed even with no shoves (`logs/orbit-seed-matrix.txt`: se fails seeds 5, 10, 13, 14; nw2 fails seeds 2, 3, 4, 6, 7, …), and a winning tape replayed under the other 16 seeds wins on 0–7 of 17 (`logs/cross-seed.json`, model with an approximate pod close). The seed-independent thing is the POLICY: a closed-loop search over the seeded draw stream, which found a 0-hit line on every seed it was asked about | §4 |
| 5 | every hit: frame, x/y, cause; every lava tick | listed per tape in §5; on every 0-hit YES tape the list is empty | §5 |

## 0. The rows, quoted (AP_1 = `seedling_playthrough/AP_1`, and `seedling_er/AP_1`; identical)

```
LOC  level_112__r2c2 | Level 112 - Owl                         | Or(Has Progressive Sword, Has Ghost Spear)
LOC  level_112__r2c2 | L112 flag 1: rocklock@112,16 cleared   | Or(Has Progressive Sword, Has Ghost Spear)
EXIT level_112__r2c2 -> level_112__r0c7                         | Or(Has Progressive Sword, Has Ghost Spear)
EXIT level_112__r0c7 -> level_112__r2c2                         | Or(Has Progressive Sword, Has Ghost Spear)
EXIT level_112__r0c7 -> level_113                               | True_
EXIT level_112__r2c2 -> level_111                               | True_
ENTER level_111 -> level_112__r2c2 | True_ ; ENTER level_113 -> level_112__r0c7 | Has "L112 flag 1: rocklock@112,16 cleared"
```

The arrival: L111's `teleporter@128,48 {to 112, playerx 32, playery 208}`, i.e. `new Game(112, 32, 208)`. That is the constructor a
tape boot `{level 112, x 32, y 208}` calls, so every tape here boots at the L111 arrival (entity point (40,216)). The exit:
`teleporter@112,0 {to 113}` above `rocklock@112,16 {tset 0, tag 1}`.

## 1. The executor (`tools/owl-executor.mjs`)

**What it is.** A planner over the fidelity model, imported read-only. `levelRun` steps `finalBossFight.js`/`finalBossRng.js` for
L112, and nothing under `frontend/` was edited. It is **closed-loop in node, open-loop on the game**. A controller reads the run each
tick (player, Owl, pods) and chooses keys. The chosen keys are spanned into ONE tape per (weapon, seed). The game then judges that
tape, unchanged, on a fresh page (`tools/judge.mjs`). Hand-authored tapes: none for Q1/Q2. The Q3 tapes are authored from the
model's no-shove track (§3), because the model steps no Shield/Wand shove.

**The plan shape.** Intro press t2 (it costs nothing: §20.3's finding, re-asserted by the game's `slash.tests`). Then a dodge ORBIT
(a 4-corner diamond, too wide to reach in its 30-tick period, so the player is never at rest; a resting player is aimed at
directly, since `stepsAhead` is −15 × v = 0). Then THREE shoves. Each is a walk to a stance (≤ 60 ticks), 8 ticks holding the ONE
key toward him (the press rect faces the PREVIOUS tick's velocity), the press, and 6 ticks standing. Each shove is followed by his
own lava self-hit. Then the 109-tick death chain to `{112,0}`/`{112,1}`, the rocklock's fade, and the walk north into the L113
teleporter.

**The search per shove k.** Candidate press ticks every 3 ticks over his walk ticks where the (k+1)-th lava hit is still available
(`hitThisSequence` false; it is re-armed only on a pod tick). Stances lie on a polar grid around his model position: radii
10–18 px for the Sword, and 10–26 px on an axis line (±2 px) for the Spear, whose rect is 32×5. FORBIDDEN, never scored: the
lethal `t ∈ {16,17}` cells, the pod boxes, solids, and a push ray that points away from the lava centre. A candidate is a full replay
from tick 0, kept only with the (k+1)-th lava hit and **0 player hits** to its horizon. Candidates are ranked by earliest lava, with
backtracking. Walking uses a BFS distance field over the model's own `collidesSolid` with the player's 4×5 box. The planner
backtracks to the next orbit (`nw2 → se → nw`) when an orbit yields no plan (`tools/sweep.sh`). `--max-hits=n` gives the hit-only
arm, and a 600–900 s budget per (seed, orbit) applies.

**Where the model and the game diverged** (all found by the game, all model gaps, none changed here):

1. **`Pod.update:80-83` is not stepped.** A Player overlapping an `"opened"` pod makes it play `"close"`; 22 ticks later it is
   `"closed"`, and the pin snaps him onto the pod and hits him (`:68-74`). `levelRun` refuses a CLOSED pod cell
   (`levelRun.js:11297-11306`) but never closes one on the player's touch. Measured: `owl-spear-s2-v1`, `-s3-v1` and `-s5-v1` were
   0-hit model plans. On the game each was pinned at pod (120,56) (t1666, t1648 and t1818; census `pods (120,56) closed`), then hit
   until dead or stuck. The executor now refuses any plan whose player touches an opened pod cell. The re-planned s2/s3/s5 are 0-hit
   on the game. (The `cross-seed` tool approximates the close. It is right on 15 of the 16 judged tapes; it wrongly pins
   `owl-sword-s101` at t1575, where the game re-opened the pod, plausibly through his own walk's `if (!pods[cpod].open) open = true`,
   `FinalBoss.as:170-173`.)
2. **The rocklock does not open in the visit.** `levelRun` books the Owl's `{112,0}`/`{112,1}` as next-visit clears
   (`pendingEarnedClears`, `levelRun.js:11483-11490`), so its `rocklock@112,16` stays a wall and no exit can be planned. The game runs
   `Button.activateAll(null, 0, true)` at the tag tick (`FinalBoss.as:218`), and the lock fades for 100 ticks (`RockLock.as:56-66`,
   `alpha -= 0.01`, then `type = ""`). **The planning run therefore stages `{112,1}` cleared** (the lock removes itself at `check()`,
   `RockLock.as:34-37`; nothing else in the room reads tag 1, and the no-shove trace is identical either way). The tape stages
   nothing, and the exit begins at tag tick + 104. Measured: every judged win's stream equals the model's up to the tick the game
   player passes y < 34 (e.g. `owl-sword-s101` first diverges at t1816: game y 33.29, the model's blocked 34.32). This is the expected
   exit-only divergence. The judge's replay uses the tape's own staging, i.e. with the lock.
3. **The Shield bump and the WandShot against the Owl are not stepped.** That is why Q3 is game-in-the-loop (§3).
4. **The tick-23 trap the prefix probe names** (`probe-seedling-r6-owl-prefix.mjs`, slice 6g) **did not recur.** Q0's stream equals
   the game's on all 817 observations, as do the Q1/Q2 streams up to the exit, so the 6g/6h fixes hold.

## 2. Q1/Q2 — the Sword and the Ghost Spear, 0 hits, from the arrival to L113

The Spear: `spear()` collects with `collideRectInto` over a 32×5 rect (`Player.as:954-991`) and calls
`genericHit(v[i], "Spear", spearForce 7, …)` (`:989`; `spearForce`, `:145`). That reaches `Enemy.hit(7, player, 2, "Spear")`, whose
`onlyHitBy = "Lava"` (`FinalBoss.as:61`) sends it to `else if (justKnock) knockback(f, p)` (`Enemy.as:176-178`). That is a shove of
`min(7, maxForce)`: 7 before his first lava hit, 2 after (`FinalBoss.as:119-121`). There is no line test and no reach gate
(`CONTACT_FIDELITY.spearGameTest`, ON at base). The game agrees: 9/9 spear tapes kill him with 0 hits (the Spear's stab does not move
`slash.tests`, which reads 0).

Seed-101 tapes (both judged on the game):

| tape | ticks | shoves (t @ stance) | lava | tags | exit from | game |
|---|---|---|---|---|---|---|
| `owl-sword-s101` | 1836 | 375@(86,65) 688@(35,143) 1562@(136,54) | 378, 696, 1570 | 1679 | 1783 | 0 hits, `112:0`+`112:1`, **L113 (80,136)**, `slash {16 hits, 15 tests}` |
| `owl-spear-s101` | 1742 | 363@(105,46) 689@(41,145) 1447@(159,73) | 367, 697, 1467 | 1576 | 1680 | 0 hits, `112:0`+`112:1`, **L113 (80,136)** |

(The third shove lands two or three pod cycles later than the second, at t1447–t1924 across the seeds. The search takes the first
armed walk block whose candidates survive, and on the next leg the stances that reach his lava side cross a barrage approach.)

## 3. Q3 — the items the rule does not name

**Source.** Every item that reaches `Enemy.hit` or `Enemy.knockback` on him shoves him. `onlyHitBy = "Lava"` only decides that he is
never DAMAGED; the shove is the whole kill mechanism, because all three hits are his own `hit(6, (120,112), 1, "Lava")`
(`FinalBoss.as:116-124`).
- **Shield ×1** (`hasShield`): `shieldBump()` runs every tick in the player's update (`Player.as:530`). If the shield box overlaps him
  and `v.length > 0`, and `hasDarkShield` is false, it calls **`o.knockback(shieldForce 5, player)` directly** (`:1691-1709`). That
  bypasses `Enemy.hit` entirely: no `canHit` gate (it works during a barrage), no `maxForce` clamp (5 on every cycle), no freeze
  test. The shield box is set in `render()` (`:1182-1257`), side 3×7 at x±4, so it reaches 3 px past the player's 4×5 body. He is
  shoved before he touches the player.
- **Shield ×2** (`hasDarkShield`): `o.hit(5, player, darkShieldDamage, "Shield")` when his `hitsTimer <= 0` (the clamp to 2 after
  his first lava hit, the `canHit` gate), else the direct `knockback(5)` (`:1699-1706`).
- **Wand**: `WandShot` has `"Enemy"` in its solids (`WandShot.as:69`). On contact, `checkEntity` calls
  `hit(force 3, shot point, damage, "Wand")` (`:112-117`), i.e. a `justKnock` shove of 3, then 2 after the first lava hit.
- **Dark Suit**: `Player.hit` → `if (e && hasDarkSuit) e.hit(darkSuitForce 1, player, 1, "Suit")` (`Player.as:1384-1387`). That is a
  shove of 1, and only inside the arm that costs the player a heart, so it can never give a 0-hit line.
- **Fire**: a `justKnock` shove of 0.325 per test (above). Not an arm.

**Game.** The model steps none of these shoves. So the Q3 tapes are authored on the model's no-shove track: the Owl's walk does not
read the player, so his position at tick T is the model's, exactly, until the first push. For each walk tick and each axis direction,
the model's own `finalBossCoast` (one knockback of the item's force from the contact point) must carry him across a cell whose FIRST
tile is lava (`finalBossLavaVerdict`). The game then judges (`logs/q3-batch1.json`, 19 tapes, all seed 101):

| tape | push | player hits (tick ≤, cause) | Owl census `hits` |
|---|---|---|---|
| `q3-none-orbit-s101` | none, 1270 ticks | — | **0** |
| `q3-shield-s101-t357-down` | walk down into him | 2 (t340 rock, t360 Owl body) | 1 |
| `q3-shield-s101-t369-down` | walk down | **0** | **1** |
| `q3-shield-s101-t381-down` | walk down | 2 (t458, t478; then death) | 0 |
| `q3-shield-s101-t393-down` | walk down | 1 (t455) | 1 |
| `q3-shield-s101-t405-right` | walk right | **0** | **1** |
| `q3-shield-s101-t417-right` | walk right | **0** | **1** |
| `q3-shield2-s101-t357/369/381/393/405/417` | the same six | 2 / **0** / 2 / 1 / **0** / 2 | 1 / **1** / 0 / 1 / **1** / 1 |
| `q3-wand-s101-t370-down`, `-t382-down`, `-t398-right`, `-t410-right`, `-t429-right` | one shot | **0** | **1** |
| `q3-wand-s101-t441-right` | one shot | 0 | 0 (missed) |

**The kill: UNWITNESSED.** Game-in-the-loop staging (`owl-executor.mjs --stage`, `tapes/q3stage/`): an OBSERVATION tape (the pushes
so far, then the orbit) gives the game's own dense track of his next armed leg, and the next push is placed on that leg. The player's
keys come from a kinematic model run (noDamage, `{112,1}` staged). Results:
- Shield ×1, stage 2: 13 tapes. One (`k2-t838-right`, short wait) took the Owl to **`hits` 2 at t849 with the player on 0 hits**.
  Then rocks hit the player at t992 and t1101, he died in the pod2 barrage, and the room restarted (the Owl back at (72,104),
  `hits` 0, by t1335).
- Wand: one clamped single shot (force 2) cannot reach lava from leg pod1→pod2 (the model coast: 0 of 101 points × 24 rays). It can
  from the other three legs (47–69 points each). Stage 2 on leg pod2→pod3: 3 tapes, 0 more lava; rocks at t1267.

Why they die: after a push the model no longer knows when his phases (and so his draws) fall, so the barrage that follows can no longer
be planned around. Every Shield/Wand stage-2 death is a rock or his body, never the push itself. **This is a planner limit, not a game
NO.** The mechanism is the same one the Sword uses, and the Shield ×1's is stronger (unclamped, ungated).

**SKETCH — the rule consequence (not made).** Under the no-hit ruling, the general reading is: the Owl's two rows and `r2c2 → r0c7`
cost "any item whose game code reaches `Enemy.hit`/`Enemy.knockback` on an `Enemy` with `justKnock`, with a 0-hit line". That is
derived from the game's call graph (`genericHit` callers, `shieldBump`, `WandShot.checkEntity`, `Player.hit`'s suit arm), not
listed per level. On this evidence that set is {Progressive Sword, Ghost Spear} (witnessed), plus {Progressive Shield ×1, Wand} (one
0-hit lava hit witnessed; two of three for the Shield). Dark Suit is excluded (every shove is a hit), and Fire is excluded by ruling.
Widening the rule needs the kill witnessed (§6, item 4). Until then the rule is stricter than the game, which is the safe direction.

## 4. Q4 — the RNG

The barrage: `if (!Math.floor(Math.random() * 6)) add(new RockFall(p.x + p.v.x * -15 + rnd*40 - 20, p.y + p.v.y * -15 + rnd*40 - 20))`
(`FinalBoss.as:136-146`), every barrage tick, 240 ticks per pod. The grenade: `!Math.floor(Math.random() * 40)` per walk tick
(`:157-161`). The draw order and its premises are `finalBossRng.js`'s; every tape declares `rng {seed, split: true}`.

**Per-seed table** (`owl-seeds.json`, built by `tools/owl-seeds.mjs` from the plan reports and the game rows; a NOPLAN is the
executor's answer, not the game's):

| weapon | seed | orbit | max hits planned | verdict (GAME unless NOPLAN) | shoves (press ticks) | lava ticks | tags | ticks | game hits (tick ≤) | game end | tape |
|---|---|---|---|---|---|---|---|---|---|---|---|
| spear | 1 | nw2 | 0 | **0-hit YES** | 336 665 1581 | 342, 700, 1587 | 1696 | 1852 | 0  | L113 | `owl-spear-s1.json` |
| spear | 2 | nw | 0 | **0-hit YES** | 351 712 1909 | 356, 741, 1989 | 2098 | 2268 | 0  | L113 | `owl-spear-s2.json` |
| spear | 3 | nw | 0 | **0-hit YES** | 351 709 1924 | 356, 739, 1958 | 2067 | 2228 | 0  | L113 | `owl-spear-s3.json` |
| spear | 4 | nw2 | 0 | **0-hit YES** | 336 677 1447 | 342, 686, 1452 | 1561 | 1715 | 0  | L113 | `owl-spear-s4.json` |
| spear | 5 | nw2 | 0 | **0-hit YES** | 336 677 1880 | 342, 689, 1924 | 2033 | 2233 | 0  | L113 | `owl-spear-s5.json` |
| spear | 6 | nw2 | 0 | **0-hit YES** | 348 687 1803 | 354, 696, 1840 | 1949 | 2107 | 0  | L113 | `owl-spear-s6.json` |
| spear | 7 | nw2 | 0 | **0-hit YES** | 336 677 1447 | 342, 686, 1452 | 1561 | 1715 | 0  | L113 | `owl-spear-s7.json` |
| spear | 8 | nw2 | 0 | **0-hit YES** | 336 665 1581 | 342, 700, 1587 | 1696 | 1852 | 0  | L113 | `owl-spear-s8.json` |
| spear | 101 | nw2 | 0 | **0-hit YES** | 363 689 1447 | 367, 697, 1467 | 1576 | 1742 | 0  | L113 | `owl-spear-s101.json` |
| sword | 1 | nw | 0 | **0-hit YES** | 345 739 1881 | 351, 747, 1890 | 1999 | 2181 | 0  | L113 | `owl-sword-s1.json` |
| sword | 2 | nw | 0 | **0-hit YES** | 354 742 1887 | 359, 750, 1893 | 2002 | 2185 | 0  | L113 | `owl-sword-s2.json` |
| sword | 3 | nw | 0 | **0-hit YES** | 354 742 1887 | 359, 750, 1893 | 2002 | 2185 | 0  | L113 | `owl-sword-s3.json` |
| sword | 4 | nw | 0 | **0-hit YES** | 354 737 1527 | 360, 742, 1533 | 1642 | 1824 | 0  | L113 | `owl-sword-s4.json` |
| sword | 5 | nw2 | 0 | **0-hit YES** | 432 1575 1917 | 438, 1581, 1922 | 2031 | 2230 | 0  | L113 | `owl-sword-s5.json` |
| sword | 5 | nw | 0 | **NOPLAN** | — | — | — | — | —  | — | `—` |
| sword | 6 | nw | 0 | **0-hit YES** | 345 739 1884 | 351, 747, 1893 | 2002 | 2183 | 0  | L113 | `owl-sword-s6.json` |
| sword | 7 | nw2 | 0 | **0-hit YES** | 354 813 1986 | 362, 820, 2039 | 2148 | 2329 | 0  | L113 | `owl-sword-s7.json` |
| sword | 7 | se | 0 | **NOPLAN** | — | — | — | — | —  | — | `—` |
| sword | 8 | nw | 0 | **0-hit YES** | 345 739 1881 | 351, 747, 1890 | 1999 | 2181 | 0  | L113 | `owl-sword-s8.json` |
| sword | 101 | nw2 | 0 | **0-hit YES** | 375 688 1562 | 378, 696, 1570 | 1679 | 1836 | 0  | L113 | `owl-sword-s101.json` |
| sword | 1 | nw2 | 2 | **hit-only YES (2)** | 339 798 1884 | 349, 805, 1939 | 2048 | 2239 | 2 [336, 591] | L113 | `owl-sword-s1-hits.json` |
| sword | 5 | nw2 | 2 | **hit-only YES (2)** | 336 815 1586 | 356, 822, 1591 | 1700 | 1855 | 2 [337, 1582] | L113 | `owl-sword-s5-hits.json` |
| sword | 7 | nw2 | 2 | **hit-only YES (2)** | 336 809 1934 | 355, 815, 2037 | 2146 | 2325 | 2 [336, 809] | L113 | `owl-sword-s7-hits.json` |

The planner tries the orbits in order (`nw2 → se → nw`, `tools/sweep.sh`). An orbit that yields no plan is a per-orbit `plan-<w>-s<seed>-<orbit>.log` NOPLAN. The table keeps each seed's winning run, plus the extra runs made under their own names (`plannw-*`, `planse-*`: a parallel orbit; `planhits-*`: `--max-hits=2`). Seed 5 (Sword) had no plan within lane D's 600 s budget on any orbit. Re-run on nw2 with 900 s it found its 0-hit line in 643 s (`logs/plan-sword-s5-nw2-rerun.json`), and the game took it. **Every seed the game judged as a 0-hit plan won with 0 hits, both flags and L113: 18 of 18.** The three `-hits` tapes are `--max-hits=2` variants, judged to show the hit-only arm (2 hits each: the Owl's body on an approach and/or one rock).

**Is there a seed-INDEPENDENT 0-hit strategy?**
- *A fixed orbit: no.* With no shoves at all, over 1100 ticks (`logs/orbit-seed-matrix.txt`, model; the model's barrage equals the
  game's on every judged stream), each of the five orbits takes rock hits on some of 17 seeds. `se` is the best (13/17); `nw2` is
  hit-free on 6/17 and dies on 5.
- *A fixed tape: no.* Each winning tape was replayed, inputs unchanged, under seeds 1–16 and 101 (`logs/cross-seed.json`, model plus
  an approximate pod close). The 0-hit wins are 0–7 of 17 per tape (`owl-sword-s101`'s 0 is the approximate pod close's false pin; see §1). For example, `owl-spear-s4`'s inputs win on seeds
  {4, 7, 9, 10, 11, 13, 14}, take 1 hit on seed 5, and lose elsewhere. Game spot checks (`tapes/xseed/`, `logs/q4-xseed.json`) **agree 4 of 4**: `owl-spear-s4` inputs on seed 9 give a 0-hit win; on seed 5 a win with 1 hit (≤ t862; predicted `5(1)`); on seed 1 no win (hits ≤ t1376, ≤ t1452; predicted). `owl-sword-s2` inputs on seed 6 give a 0-hit win (predicted).
- *The 64 px orbit against `stepsAhead` −15:* it works when the draw cooperates. `stepsAhead` aims 15 velocity-steps BEHIND a moving
  player, and the rock lands 17 ticks later (`rockFallUpdatesToLand`), so a steady walker carries ~32 ticks of lead against a ±20 px
  spray. The corners of any orbit (where `v` turns) and every stance (where `v = 0` for the press) are inside the spray. Whether a
  rock is drawn there is the seed's.
- *What IS seed-independent:* the policy. Closed-loop search over the seeded stream (choose an orbit, then stances and press ticks)
  found a 0-hit line for every seed it was asked about, the Spear on 9/9. The Owl's walk is player-independent and seed-independent
  (identical shove triples recur across seeds: `owl-spear-s4 = -s7`, `-s1 = -s8`, `owl-sword-s2 = -s3`). Only the rocks and grenades
  are drawn.

## 5. Every hit, every lava tick

- **0-hit YES tapes: no player hit at all.** The poll recorded no hit increment; lava ticks are in `owl-seeds.json` (`plan.lavaHits`,
  equal to the game's, since the streams are identical to the exit).
- **Q0 `r6-owl-kill`:** 0 hits; lava t18, t307, t705 (the kill); tags t814.
- **`owl-sword-s1-hits` (the `--max-hits=2` variant):** 2 hits, t336 (`owlBody`, the approach) and t591 (`owlRock`). The game poll
  bounds them at ≤ t336 and ≤ t591; the model has t337 and t592. Lava t349, t805, t1939; then `112:0`+`112:1` and L113. **Hit-only YES (2).**
  `owl-sword-s5-hits`: ≤ t337 and ≤ t1582 (model t338 and t1583, both `owlBody` on an approach); lava t356/t822/t1591.
  `owl-sword-s7-hits`: ≤ t336 and ≤ t809 (model t337 and t810, both `owlBody`); lava t355/t815/t2037. Each hit is the Owl walking
  into a player who is stepping into a stance, which is why the 0-hit search rejects those stances.
- **Cross-seed:** `owl-spear-s4-on-s5` 1 hit (≤ t862); `owl-spear-s4-on-s1` hits ≤ t1376 and ≤ t1452, then no kill within the tape.
- **v1 pod failures:** `owl-spear-s2-v1` pinned at (120,56) ≤ t1666, then a grenade ≤ t1686, then death and a room restart.
  `owl-spear-s3-v1` pinned ≤ t1648 and ≤ t1668. `owl-spear-s5-v1` pinned ≤ t1818 and ≤ t1838, after the kill (both flags cleared,
  stuck in L112).
- **Q3:** in the table above, with causes from the census at the poll (rock, `RockFall` rows; body, the `FinalBoss` row overlapping).
- The hit tick is read from the player's own i-frame: `pollTick − (20 − hits_timer)` (`Player.hitsTimerMax` 20). It is an upper
  bound, because the poll is late, never early.

## 6. SKETCH — what the hammer arc would need for a BOT Owl fight executor (the survey's Owl skip-list row). A hand-over, not a change.

1. **The in-visit rocklock.** `levelRun` should apply the Owl death's `Button.activateAll(null, 0, true)` and the tag-1 write IN the
   visit: fade the `tset 0` group for its 100 ticks, then drop the Solid. This is general: it is `Button.activateAll`'s group sweep for
   any `endAnim`/death arm that calls it, not an L112 literal. Without it no solver can route `r2c2 → r0c7` after the kill. This
   slice's workaround (staging the tag in the planning run only) is a witness trick, not a model.
2. **`Pod.update:80-83`** (player-touch close) in `finalBossFight`/`levelRun`, with its 22-tick fence and the Owl's re-open
   (`FinalBoss.as:170-173`). Until then a solver must hard-avoid every opened pod cell, as this executor does.
3. **The search itself**, as a solver leg: (a) the shove search above (stances on the push ray toward the lava, the forbidden cells,
   one-key facing, the five tests culled by the rect); (b) the dodge orbit chosen PER SEED by replaying the stream (no fixed orbit
   survives every seed); (c) the exit after the fade. Cost: 1–4 min of node per (weapon, seed, orbit) on one core here, and a seed
   may need two or three orbits.
4. **If the Shield/Wand are to be credited:** model `shieldBump`'s two arms against the Owl (the direct `knockback(5)` without a
   clamp or gate; the Dark Shield's `hit("Shield")`) and `WandShot.checkEntity` → `hit(3, "Wand")`. The same executor would then plan
   those kills closed-loop, and the game could witness them the way Q1/Q2 are witnessed here.
5. Nothing here needs `CONTACT_FIDELITY.owlContactInStep` (OFF). No Q1/Q2 tape touches the Owl's body.

## 7. Files

- Tools: `tools/owl-executor.mjs` (planner; `--q3`, `--stage`, `--orbit-tape`, `--trace` modes), `tools/judge.mjs` (game judge),
  `tools/sweep.sh` / `sweep2.sh` (seed sweeps with the orbit fallback), `tools/cross-seed.mjs`, `tools/owl-seeds.mjs`.
- Tapes: `tapes/owl-{sword,spear}-s*.json` (the Q1/Q2/Q4 tapes; `-v1-podtouch` are the pinned first plans, kept),
  `tapes/owl-sword-s1-hits.json`, `tapes/q0-r6-owl-kill.json` (a byte copy of the fixture), `tapes/q3/`, `tapes/q3stage/`
  (with each stage's `.spec.json`), `tapes/xseed/`.
- Logs: `logs/q0-control.json`, `q1-*`, `q2-*`, `q3-*`, `q4-*.json` (judge rows), `logs/plan-*.json|log` (planner reports),
  `logs/orbit-seed-matrix.txt`, `logs/cross-seed.json`; the per-seed table is `owl-seeds.json`.

No STOP fired. Nothing needed a solver/levelRun change to WITNESS the answers: the executor stays a witness tool, and §6 lists what a
bot version would need.
