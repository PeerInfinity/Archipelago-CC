# Seedling fidelity WANDKILLBLAST (wave 73) — the wand kill's Explosion, both halves witnessed

Session `seedling-fidelity-wandkillblast` (planner `seedling-fidelity-planning-27`, wave 73). ⚖ GO: Robert, 2026-11-27
(*"Both in parallel"*, with wave 72), and the launch GO.

| | |
|---|---|
| start (base) | `048733514ab725f77d6c711d71e184d4f78e789d` — the W71 harvest tip (`fidelity-harvest/wandkill-w71`) |
| head | this report's commit (the last); the last CODE head is named in § Gates |
| harness branch | `claude/wand-kill-explosion-witnesses-ia29vq` (local `seedling-fidelity-wandkillblast`) |
| verdict | **PASS** — (b) NO GAP, with no code change: the game takes the Explosion's player hit exactly as wave 71's derived arm does, and M1 now turns 5 rows red. (c) GAP, closed by one key, `wandKillBlastBodies` (default OFF, byte-identical OFF). It is witnessed for six classes/states and a blast kill (no chain); everything unwitnessed stays refused by name |

## The one thing to know first

**The player half was never infeasible. It needs the kill tick itself.** On the tick the sixth shot lands, the shot
updates first and plays the body's "die", so that body's `hitPlayer` is gated (`Enemy.as:213`). The body's contact on
the tick before read the player's previous position. So a player who crosses into the disc ON the kill tick takes the
Explosion and no contact. On L29 (turret@80,176 from above, and turret@112,240 from below) the game reads hits 0 → 1,
`hits_timer` 20 on t178, and the knockback carries the player away from the blast centre. It matches the model at every
sampled tick. Wave 71's "infeasible in every stance searched" held only for standing stances.

## Counts at the head

| | base (W71 harvest) | head |
|---|---|---|
| `CONTACT_FIDELITY` keys | 163 | **164** |
| ON by default | 126 | **126** |
| last key | `wandShotKill` | **`wandKillBlastBodies`** (OFF) |
| `SOLVER_ENV_NAMES` | 263 | **264** (`SEEDLING_WAND_KILL_BLAST_BODIES`, sorted, unique) |

## D1 — the stances, the witnesses, the map

### The game (AS3, read)

- `Explosion.added()` (`Projectiles/Explosion.as:45-68`): `collideRectInto` the square for "Player" then "Enemy", then
  `FP.distance(x, y, c.x, c.y) <= radius` → `Player.hit(null, 4, p, 1)` / `Enemy.hit(4, p, 1)` (`t` "").
- `Enemy.update` (`Enemy.as:62-118`): `hitUpdate()` (the timer decrement) then `hitPlayer()`. `hitPlayer` is gated by
  `!destroy && currentAnim != "die" && hitsTimer <= 0` (`:211-221`). So after the fifth hit (H) contact is possible
  again from H+29, and the sixth shot lands at H+30 at the earliest. On the kill tick the shot's `startDeath` plays
  "die" before the body's own update, and the body's contact is gated.
- The player's box is 4 × 5 at origin offset (2, 2) (`Player.as:295`). A Turret/SandTrap box is 16 × 16 centred, and
  its radius is 10. Standing still, the player is in the disc without overlapping the box only at exactly 10 px on an
  axis. Crossing in on the kill tick works from any step size.
- `Player.hit` (`Player.as:1374-1400`): `hits += d`, `hitsTimer = 20`, `Game.shake += 5`, `knockback(f, p)`.
- `Enemy.hit` per class: `knockback` is empty for Turret, SandTrap, LavaTrap and Drill, and `v = -v` for WallFlyer.
  IceTrap has `canHit = false`. A kill runs `startDeath("")` → `dieEffects("")`, which adds nothing.
- ⛔ The ctor's `Rng.cos()` is the sprite's angle only. No witnessed hit or body moves with it. Not modelled.

### The census

- The vanilla bodies of the Explosion-making classes (Turret, SandTrap, WallFlyer, Drill), by level: L6, L8, L16, L22,
  L25, L27, L28, L29, L36, L59, L62, L65, L88, L91. (A LavaTrap's kill adds no Explosion. An IceTrap never dies.)
- L16 and L36's sandtraps sit in pits. In the model and the game, a player walking toward L16's sandtrap falls in at
  x ≈ 69, so a sandtrap can't be the (b) witness. L59's turret is walled. L65's approach is blocked at x ≈ 42 and a
  spit lands. L88's drill (r 6, box 10) needs a step ≥ 1 px across a 1 px window, and the closest kill found by
  search left the player 9.55 px off. **L29's three turrets are open on their vertical axes**: a search (5 shots, then
  the walk start × the sixth press) found the kill-tick walk-in from above turret@80,176 and below turret@112,240.
- (c) No vanilla pair is inside a disc (wave 71: nearest 16 px). Entity coordinates are free pixels, though (an IceTrap
  sits at x 168), so each neighbour is STAGED: one entity added to L29, or the stripped L38 (its teleporters and
  `lightalpha`, waves 64–69's room), loaded by `botLoadLevels` with its own `set_id`. The game runs unmodified.

### The witnesses (the game, p4g, a fresh page per shape; `scripts/procgen/probe-seedling-wandkillblast.mjs`, recorded in `fixtures/wandkillblast-witness/`, 13 shapes)

Each shape is compared at every sampled tick against the model's replay: the player and its `hits`/`hits_timer`, every
shot, every wand-class body's `hits`/`hitsTimer`/anim/removal, every spit, and the persistence cleared. **All 13: ON
(the model) = the game, sample clock shift [0].**

| shape | stage | what the game does | verdict |
|---|---|---|---|
| (b) `blast-above` | L29, vanilla. Boot (80,156), five shots, the sixth at t169, walk S from t170 | turret@80,176 dies t178. The player at (88, 174.7), 9.3 px from (88,184), **takes the hit on t178: hits 1, `hits_timer` 20**. It is knocked up and its path matches the model's | **NO GAP** (wave 71's derived arm is the game's) |
| (b) `blast-below` | L29, vanilla, below turret@112,240 | the kill on t178, the player at (120, 257.3), **hit on t178**, knocked down | **NO GAP** |
| (b) `blast-above-late` (control) | the walk a tick later | at the kill the player is in the square and 10.75 px off: **no hit** | control |
| (b) `blast-above-noshot` (control) | no sixth shot | the turret's CONTACT lands (hits 1, `hits_timer` 19 at the t178 sample) | control |
| (c) `second-turret` | + turret at OEL (74,182) (8.5 px) | the neighbour takes hits 0 → 1, `hitsTimer` 30 on t173 (29 on t174), and does not move. Its shooting stops while the timer runs | **GAP → closed** |
| (c) `second-sandtrap` | + sandtrap (74,182) tag 30 | hits 1, `hitsTimer` 30, no move | **GAP → closed** |
| (c) `second-lavatrap` | + lavatrap (74,182) | hits 1, `hitsTimer` 30, no move | **GAP → closed** |
| (c) `second-drill` | + drill (74,182), sitting | hits 1, `hitsTimer` 30. "sit" on t173, **"hit" from t174**, no move | **GAP → closed** |
| (c) `second-icetrap` | + icetrap (74,182) | nothing (`canHit = false`) | **NO GAP** (already skipped) |
| (c) `second-wallflyer` | + wallflyer (74,182) | it settles W at (71,190), 17 px off: not in the disc. Nothing | control |
| (c) `wallflyer-rest` | stripped L38: wallflyer (24,40) at rest + sandtrap (23,40), shot from below | the resting flyer 1 px from the blast: **hits 1, `hitsTimer` 30, v stays 0** | **GAP → closed** |
| (c) `chain-sandtrap` | stripped L38: sandtraps A (96,40) tag 25, B (89,47) tag 26, C (103,47) tag 27. Four shots on A from above, then six on B from the left | B dies to the wand on t401. Its blast **KILLS A** (pre-hit to 2): "die", hits 3, `hitsTimer` 30 on t401. A is removed **one tick after B** (t420 vs t419), and tags 25 and 26 are cleared. **C, 9.9 px from A and 14 px from B's blast, takes nothing: no chain** | **GAP → closed** |

Not witnessed, refused by name:
- a chaser in the disc (a Bob staged at (74,182)): the model keeps wave 71's refusal text, and a row pins it. The
  probe's rows don't carry Bobs;
- a spinner;
- a moving WallFlyer;
- a Drill that is not sitting;
- the blast's KILL of a Turret, LavaTrap, WallFlyer or Drill (the SandTrap's is witnessed).

### The map (what the change touches)

- `levelRun.drainWandKillBlastsNow` (`levelRun.js:3439`): the "Enemy" loop's refusal now first asks
  `hitByWandKillBlast` when the key is ON and the run holds the body's point. The player half
  (`applyPlayerHit({ source: 'wandKillBlast', force: 4, damage: 1 })`) is unchanged.
- `wandKillBlastBodiesNow`: each entry carries its `as3` (`'chaser'`, `'Spinner'` for those). OFF reads none of it.
- New: `hitByWandKillBlast` (`:3487`), `stageWandKillBlastDeath` (`:3529`), the ledger `wandKillBlastBodyHits` and its
  run getter (no solver reader: the surface census keeps 375 rows).
- Read, not changed: `applyPlayerHit` and `playerHit`; the bomb/totem `pendingBlasts` → `applyExplosion` and
  `pendingBombBlasts` → `drainBombBlastsNow` (the same `updateLists()` block, after the wand drain); the neighbour
  readers `enemyHit` (`enemyDamage.js`), `hitWallFlyer` (`wallFlyer.js`) and `hitDrill` (`drill.js`);
  `stepStaticBodiesNow`, `stepWandLavaTrapsNow`, `stepShootersNow` (a turret's shot gate reads its row's
  `hitsTimer`), `fireStaticRemovals` and `assertWandKillLedger`.
- Changed outside the model: `probe-seedling-wandkill.mjs`'s `modelWandKillSamples` takes an optional `levelSource`
  (default the atlas, as before).

## D2 — the key and the rows

`wandKillBlastBodies: false`, the LAST key of `CONTACT_FIDELITY_DEFAULTS` (`contactFidelity.js:2859`, doc block from
`:2826`). Its env lines are `SEEDLING_WAND_KILL_BLAST_BODIES=0|1` (`:3342-3344`). Its `SOLVER_ENV_NAMES` entry sits
between `SEEDLING_WALLFLYER_KILL_ARM` and `SEEDLING_WAND_SHOT_CHASER_BODIES`.

**The doc block** cites `Explosion.as` and `Enemy.as`, names the witnesses and their numbers, and states ON, the
refusals, and OFF (byte-identical). It also says: **REQUIRES `wandShotKill`** (alone it reaches nothing; a row pins
that the sixth shot refuses with wave 68's text), ⛔ OFF by default.

**ON** (unreachable OFF), per class, all with `d` 1 and `t` "":
- Turret, SandTrap: `enemyHit` on F4's row.
- LavaTrap: `enemyHit` on its wand row.
- WallFlyer at rest: `hitWallFlyer`.
- A sitting Drill: `hitDrill`.
- A SandTrap the hit kills: `stageWandKillBlastDeath` puts "die" on F4's row. Its first anim update is the next tick's
  (the drain runs in `updateLists()`, after `stepStaticBodiesNow`), so it is removed a tick after the shot-killed body,
  as on the game. It runs the kill-lock ledger and writes its tag through `fireStaticRemovals`. No Explosion.

**How it composes:**
- It sits under `wandShotKill`. No Explosion is queued without it.
- `wandShotKill` sits under `wandShotEnemyBodies`; `wandShotTrapBodies` composes beside them.
- With every queued key ON (W63 → W71's twelve) all 13 witnesses still match (13 composition rows).

**The rows** (`fidelityWandKillBlast.test.js`, fast tier, 56 rows):
- the key (OFF, last, after `wandShotKill`, env sorted and unique);
- REQUIRES;
- the recordings are the probe's (tape, stage, `set_id`);
- per witness, ON = the game at every sample plus the persistence;
- per witness, OFF = wave 71's refusal word for word (the six second-body shapes), else ON = OFF;
- (b)'s numbers: the kill tick, the player in the disc, hit 1 / 20 on t178, the knockback away from the centre, both
  controls, and the model's blast `hitPlayer`;
- (c)'s numbers per class: hits 1 / 30 → 29, no move, the drill's "hit" from the next tick, the IceTrap's nothing, the
  resting flyer, the chain kill, its removal a tick later, the tags, and NO CHAIN;
- the model ledger;
- the refusals that stay (a Bob; a Turret the blast would kill);
- 13 composition rows.

`fidelityWandKillBlast.slow.test.js` plays every committed tape in three arms (alone; beside `wandShotKill` and both
wand-body keys; beside all twelve queued keys): **3/3 green, n > 300, 0 movers**.

**Key-order pins**: 34 lists `'wandShotKill']` → `'wandShotKill', 'wandKillBlastBodies']`; NestedRockCeremony
`slice(-16)` → `-17`; FreezeSpanUpdates `slice(-17)` → `-18`; `contactFidelity.test.js`'s defaults object; wave 71's
"last key" row → `slice(indexOf(KEY)+1) == ['wandKillBlastBodies']`.

### Mutants (predicted, broken on a copy of `levelRun.js`, restored — `cmp` verified each time)

| mutant | predicted | red |
|---|---|---|
| M1 no player half (`if (!hitPlayer \|\| noclip) continue` → `continue`) | `blast-above`/`-below` ON + their two composition rows + the "model's blast hits the player" row | **exactly those 5** (51 green). On wave 71's `fidelityWandKill.test.js` M1 still turns **0** red: the residue was there, and this file closes it |
| M2 no Enemy half (ON, the second body skipped instead of hit) | the six second-body ON rows, their six composition rows, the ledger row, both refusal rows | **exactly those 15** (not the IceTrap, the settled flyer, or (b)) |

## D3 — the ON measurement

- **Byte-inertia OFF**: `git diff --name-only --diff-filter=MD 04873351.. | grep -aE 'fixtures/|golden|tapes/'` is
  **EMPTY**. Added: the 13 `fixtures/wandkillblast-witness/*.json`. No AS3, wasm, gitlink or rules edit.
- **Acceptance md5** (`batch-seedling-acceptance.mjs 2>/dev/null | md5sum`):

  | | base | head |
  |---|---|---|
  | OFF | `391322d681b7aa0229d94b3f6906d024` | `391322d681b7aa0229d94b3f6906d024` |
  | `wandKillBlastBodies` = 1 alone | — | `391322d681b7aa0229d94b3f6906d024` |
  | + `wandShotKill`, `wandShotEnemyBodies`, `wandShotTrapBodies` | — | `391322d681b7aa0229d94b3f6906d024` |
  | every queued key ON | `d871cee754a7490a7003a7395028e531` | `d871cee754a7490a7003a7395028e531` |
  | every queued key + `wandKillBlastBodies` ON | — | `d871cee754a7490a7003a7395028e531` |

  **No seed and no field moved.**
- **Every committed tape OFF vs ON**: 0 movers in all three arms (the slow file). No moved field to name.
- **The fast ON sweep** — SWEEP_FAST_PLACEHOLDER
- **The slow/train ON sweep** — SWEEP_SLOW_PLACEHOLDER
- **The hit gate (hitless → hit)**: no committed tape moves in any arm, and no acceptance seed moves, so **no tape or
  route takes a hit ON that it doesn't take OFF**. The only player hits this wave adds are the two (b) witnesses'
  (`blast-above`/`-below`, staged stances). They are `wandShotKill`'s arm, unchanged here, and now witnessed. ⚠ For the
  `wandShotKill` flip: a route that walks into a wand kill's disc on the kill tick is exactly a hitless → hit leg. None
  of the committed corpus does.
- **The named keyed ON-arm sweep** (`SEEDLING_WAND_KILL_BLAST_BODIES=1` with `SEEDLING_WAND_SHOT_KILL=1`,
  `SEEDLING_WAND_SHOT_ENEMY_BODIES=1`, `SEEDLING_WAND_SHOT_TRAP_BODIES=1`; shards = min(10, legs)): the legs can't be
  counted here, because there is no survey cache in the container (`.cache/seedling-survey` is absent and
  `SEEDLING_SURVEY_DIR` is unset). The levels it covers are those with an Explosion-making killable body: **L6, L8,
  L16, L22, L25, L27, L28, L29, L36, L59, L62, L65, L88, L91**. Of these, the ones where a second Enemy can MOVE into a
  disc (a Bob, a BobSoldier, a flyer, a drill) are L6, L16, L22, L25, L28, L65 and L91; a chaser there stays refused.

### Gates

GATES_PLACEHOLDER

## What the brief got wrong (measured)

- "A closer stance takes the body's contact": only for a STANDING stance. The kill tick gates the dying body's contact,
  so a walk-in on that tick is hit by the blast alone (L29, from above and below).
- "Try a body whose death frames come before the Explosion's `added()`": the death and `added()` are the same tick (the
  shot's update, then `updateLists()`). The window is the kill tick, not the death's later frames. A walk-in during the
  later frames is outside any Explosion (it was drained on the kill tick).
- "Try the largest body": the largest radius (10) belongs to the 16-px pit-bound sandtraps and the turrets. The pits
  (L16, L36) and walls (L59, L65) rule most of them out. L29's turrets are the open ones.
- (c) "a census pair": none exists. Every (c) witness is staged (entity coordinates are free pixels).
- The brief's base counts were all correct: 163 / 126 / `wandShotKill` / 263, and both md5s.

## Hand-overs

- **Hammer / solver** (read-only here): no solver view changes. The new getter has no reader; `previewWandShot` is
  still Enemy-blind (W68's). If `wandShotKill` flips, a route can take the blast by walking in on the kill tick, and
  the solver's wand plan does not price the Explosion's player half. Hand-over: price it, or avoid the disc on the
  kill tick.
- **Planner**:
  - dispatch `unittests_frontend.yml -f train_only=true` at the last code head (this session can't dispatch, 403);
  - run the named keyed sweep over the 14 levels above;
  - harvest: W72 also appends keys last from the same base, so resolve the key order there.

## Residue

- Refused by name (WANDKILLBLAST): the blast's kill of a Turret, LavaTrap, WallFlyer or Drill; a moving WallFlyer; a
  Drill not sitting. Refused by name (WANDKILL, wave 71's text): a chaser, a spinner, any other Enemy, and a body
  the run holds no point for.
- No default changes; the flip is the planner's call. `wandShotKill`'s ON branch is unedited.
- The probe's game rows carry the six wand classes only (wave 68's `gameRowsOf`). A chaser neighbour needs a row
  reader before it can be witnessed.
