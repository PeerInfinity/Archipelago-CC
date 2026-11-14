# Cloud report: `rules-nohit-derivation`

Branch `claude/wallflyer-no-hit-derivation-2y9dio`, started from `origin/main` = `39e8a29f7fe8f9ebca9a17c3fa2d98d4123f09a4`.
REPORT ONLY: no rule, preset, atlas, table, solver or `CONTACT_FIDELITY` change. Everything is under
`CC/docs/cloud-reports/rules-nohit-derivation-evidence/` (`tools/`, `runs/`, `tapes/`).

## Answer table

The derivation is `tools/derive-nohit.mjs`. "Table" is `seedlingNoHitDirectionalGates.json` on main.

| room | crossing | table | DERIVED (no item) | derived arms | game |
|---|---|---|---|---|---|
| L22 | S→N (L25/L30 → L21/L29) | gated: Sword, Spear, Shield | **NO LINE** (573,582 lane ticks, 2 configs) | Sword, Spear, Dark Shield, Wand (disarm at rest); Shield (deflect: LINE, 70 configs) | no item: GAME NO (control, 2 hits). Table arms: GAME YES (the table's witnesses). **Wand: GAME YES, 0 hits** (`tapes/l22-25-21-wand.json`) |
| L22 | N→S (L21/L29 → L25/L30) | free | **LINE** (60.7 M lane ticks, 16 configs, 3-lane chain) | all | GAME YES (the table's free witnesses `l22-21-25/30-none`, `l22-29-25/30-none`) |
| L25 | W→E (L26 → L22) | gated: Sword, Spear, Shield | **NO LINE** (1,083,958 lane ticks, 2 configs) | Sword, Spear, Dark Shield, Wand; Shield (deflect: LINE) | no item: GAME NO (control, 2 hits). Table arms: GAME YES (the table's witnesses). **Wand: UNWITNESSED** (3 attempts, see below) |
| L25 | E→W (L22 → L26) | free | **LINE** (1 lane) | all | GAME YES (the table's `l25-22-26-none`) |
| L25 | L28 ↔ others | (not a band) | not a wallflyer question: the closed chest separates L28's landing even with no flyer | — | the previous slice's `--chest` cases |
| L27 | L26 ↔ L28 | free | **one side**: both doors' landings share one waiting-spot component, so no crossing exists to gate | — | GAME YES (`l27-26-28-none`, `l27-28-26-none`) |

- **The derivation reproduces the table exactly**: L22 north (S→N) and L25 east (W→E) are gated, their reverses are free, and L27 has nothing to gate.
- **No disagreement with the table, and no new gated room.** Only three levels hold a wallflyer (22, 25, 27), and the derivation ran over all three.
- **The arm sets differ in one way.** The derivation adds the **Wand** (game YES on L22, unwitnessed on L25) and the **Dark Shield**. AP already covers the Dark Shield, since it is `Progressive Shield ×2`. No arm in the table is refused.

## 1. Source read (what decides it)

- `WallFlyer.as:19` sets `moveSpeed` 4. `:21` sets `attackRange = FP.screen.width` (160). `:59-68`: the launch fires when `collideLine("Player")` along `decideMotion(moveSpeed)` touches the player's box. That ray is a LINE. The body is 14×14 (`:38`).
- `:113-170`: `decideMotion` reads the wall mask. A body passing under a solid with the player below re-launches mid-flight.
- `:178-230`: the flight stops at a solid. `:172-176`: `knockback` is `v = -v`.
- `Enemy.as:24`: `hitsTimerMax` is 30. `:147-168`: `hit` sets that timer and knocks back. `:213`: `hitPlayer` needs `hitsTimer <= 0`, so a struck body cannot hurt the player for 30 ticks.
- Player: box 4×5, origin (2,2) (`Player.as:295`). Walk speed 0.8 with friction 0.25 (`:73`, `Mobile.as`), about 1.2 px/tick.
- Arms:
  - Sword `getSlashRect` (`:931-952`) within `distanceRectPoint ≤ 16`, no Solid on the line (`:914-918`).
  - Ghost Spear 32×5 stab (`:966-982`), damage 2.
  - Wand: shot 16 px ahead (`:996-1001`), 3 px/tick for 16 ticks, damage 0.5 (`WandShot.as`). The kill's Explosion has radius 9 (`Enemy.as:205`, `Explosion.as`).
  - Shield `shieldBump` (`:1691-1709`), called before the move (`:530` vs `:575`). Plain shield: `knockback` only. Dark shield: `hit`, damage 0.5.
  - Fire: `hitByFire` is false, so knockback only. Not derived, as before.

## 2. The derivation (proposal)

This is the hint ("a waiting spot off the flyer's ray at the far end of every flight") made exact. The inputs are only the level record, `buildLevelWorld(level).collidesSolid`, the transcribed WallFlyer step (`seedlingDemo/wallFlyer.js`) and the transcribed player tick (`playerPhysicsV1.step`). No level, door or tile is named in the code.

1. **Waiting spots W(C).** C is a configuration with every flyer at rest. A waiting spot is a player position whose box is free of solids, touches no resting flyer's ray, and overlaps no resting body. Nothing launches while the player walks among them, so the player is never hit there. W(C) splits into 4-connected pixel components.
2. **Lanes.** A lane leaves a component on a held key.
   - It may start with a running start (any of 8 directions, from a runway inside the component).
   - It holds k1 for n1 ticks, then optionally k2 for up to 40 ticks. Branching happens every 2nd tick of the 16 ticks after the first launch.
   - It is simulated tick by tick against every flyer: flyers first, then the player.
   - It ends, with no contact on any tick, where every flyer is at rest and the released player coasts to a stop inside one component of the new configuration.
3. **Crossing.** X→Y exists iff a chain of lanes leads from the component holding X's door spawn to one holding Y's. The search is a BFS over (component, configuration). Door groups that are not connected even with no flyer are not a wallflyer question (L28's chest pocket).
4. **Arms.**
   - DISARM-AT-REST (Sword, Ghost Spear, Dark Shield, Wand): from waiting spots reachable on the entry side, the arm's strike box reaches each body AT REST. Then search again with those bodies killed: `ceil(hitsMax/damage)` strikes, each after the 30-tick timer.
   - DEFLECT (plain Shield): the lane search itself, with the shield box reversing a body it touches while the player moves.

Faithfulness checks:
- The lane world matches the JS model tick for tick on the table's witnessed plans. `l22-21-30-none` t166-190 and `l25-22-26-none` t146-205 give identical player and body positions.
- `--verify`: the 1-px solid bitmap matches `collidesSolid` on 59,987 of 60,000 random rects. All 13 misses are in L27 near (172-182, 21-46), where the bitmap is conservative. L27 has no crossing.

What decides the verdicts, as the lanes show (`runs/full.log`, `--lane-dump`):
- **L25 E→W free.** One lane races the east body at its **far end**: down-left under it at y≈92 while it flies 34 px down. The lane stops at a waiting spot between the two columns (x≈58-62), inside the west body's path but off its ray. The west column is then raced at its far end the same way.
- **L25 W→E gated.** Mirrored, the waiting spot between the columns gives no runway (≤4 px) for the second race. No lane family member wins it.
- **L22 N→S free.** A 3-lane chain:
  1. The upper band is stacked at its west end.
  2. Standing at y∈(116,117] the player touches only the EAST body's ray. That ray is one pixel high (y=119) west of x≈73, because `-4·sin π` is truncated by the line endpoints. The east body flies west and stacks on the west one.
  3. The band is crossed where both bodies are far away.
- **L22 S→N gated.** From below, a box reaching y=119 always covers y=120 first, so it cannot single out one body. The rock at (6,6) also blocks the middle exit northward. The game's own N→S witness (`l22-21-30-none`) relies on the same one-tick asymmetry.
- ⚠ **The verdicts are knife-edge (±1 tick, ±1 px).** A coarser rule, such as an analytic race inequality without exact physics, would not reproduce them. The derivation is only as good as the transcriptions it runs.

## 3. Runs

- **Full** (`runs/full.log`, `runs/full.json`; Shield in `runs/full-shield.*`): the table above.
- **Quick** (`--quick`, `runs/quick-none.*`): the same four no-item verdicts. It took 2 min 20 s.
- `runs/full-aborted-oldshield.log` was run with the shield bump one tick late (after the move). It was discarded and re-run.

## 4. Game witnesses

- Page `seedling_bot_ap_p4g`, set `seedling-vanilla-record-5aeefc3c`.
- Tool: `tools/witness.mjs`. Staging is the probe's `caseStaging`: `noDamage` false, nothing removed, holding exactly the arm.
- Tapes are hand-authored with `tools/armtape.mjs`, because the model refuses a WandShot in these rooms.

| case | tape | ticks | result |
|---|---|---|---|
| `l22-25-21-wand` | `tapes/l22-25-21-wand.json` (`primary` at t61) | 340 | **GAME YES**: levels [22, 21], 0 hits, 0 respawns, ended in L21 (`runs/witness-wand-l22.log`) |
| `l22-25-21-none` (same keys, no wand) | `tapes/l22-25-21-none-control.json` | 340 | GAME NO: 2 hits (t87, t118), 2 respawns, stayed in L22 |
| `l25-26-22-wand` attempt 1 | the plan's first version (strike each body at rest, cross on row 3) | 324 | 0 hits, but stayed in L25. It passed both columns (x≈77, t≈143) into the pocket east of the east column, then the walk out pushed the pushable block and stalled at (94, 51.7). Log was overwritten by attempt 2; the row is quoted from the session |
| `l25-26-22-none` (attempt-1 keys, no wand) | `tapes/l25-26-22-none-control.json` | 324 | GAME NO: 2 hits (t96, t116), 2 respawns |
| `l25-26-22-wand` attempt 2 (kill the east body: 6 shots) | `tapes/l25-26-22-wand.json` | 559 | 2 hits from t145 while standing ~30 ticks in the gap, consistent with a Bob (the lane world has none) |
| `l25-26-22-wand` attempt A (attempt 1 + another route) | `tapes/l25-26-22-wand-a.json` | 462 | 2 hits at t273/293, after the player pushed the block down (t150-170) and the route closed (`runs/witness-wand-l25-a.log`) |

L25 Wand is **UNWITNESSED**. The derivation's disarm spots exist (shoot each body at rest from the west at (34,50) facing east). However, the east side's door is reached only through the east body's column below row 3 (`(5,4)` is the pushable block), and the room's two Bobs sit in that column. No hand tape got past both inside the 30-tick windows.

I also tried playing the derivation's own free lanes. `tools/lanetape.mjs` turned the L25 E→W lane into `tapes/l25-22-26-none-derived.json`. It is clean in the lane world, but the JS model (every body) gives 3 hits from `bob@64,80`. I did not play it on the game. The table's own game witness for that direction stands. The L22 chain tape did not build (a walk between lanes touched a ray). So the derived lanes prove a flyer-only line, not a room-clean one.

## 5. If the derivation replaced the table

- Same gated directions, so the same split. AP_1 still has the sub-regions `level_22__r0c6`/`__r8c0` and `level_25__r2c7`/`__r3c2`.
- **AP_1 rows that would change: 2, and only if the Wand is accepted as an arm.** `level_22__r8c0 -> level_22__r0c6` and `level_25__r3c2 -> level_25__r2c7` would go from `Or(Progressive Sword, Ghost Spear, Progressive Shield)` to `Or(…, Wand)`. With the L25 Wand unwitnessed, only L22's row is witness-backed. The Dark Shield adds nothing (`Progressive Shield`).
- **Seed-1 sphere moves: none.** `Progressive Sword` is collected in sphere 1 (`Level 010 - Sword`) and the rooms open at sphere 2.3, so adding an Or arm cannot make anything earlier. I did not regenerate anything.

## 6. Notes for the planner

- **The decision for Robert:** accept the Wand as an arm on L22 (game YES), and either leave L25 at the table's set or call it from the derivation. The derivation says YES there; the game witness is missing.
- A rule fed by the derivation would need it in the producer (runtime about 7 min for L22 N→S at full resolution; 2 min 20 s `--quick` for all three rooms). Alternatively, use it as a CI check that regenerates the table and compares.
- Out of scope by design: the derivation ignores other bodies (Bobs), the camera gate and moving pushable blocks. A Bob-aware rule is a separate question.
- I left a dev server on 8000 (pid 966). Nothing tracked outside the evidence dir and this report was touched. No submodule pointer moved.
