# Seedling fidelity BEAMTOWER: the tower's Solid drifts, its beam hits the player, and `flyerLive` needs both

Slice `seedling-fidelity-beamtower` (Opus, cloud), planner `seedling-fidelity-planning-8`, WAVE 17 (model coverage).

| | |
|---|---|
| Start SHA | **`e967758748`** (= main: wave 16 + the lapse flip + hammer DD/RE/SF; not rebased) |
| Head | the commit carrying this report. Code: `e7e16b9` (D1 + D3, one commit: they share the tower's step function); records + this report on top |
| Branch | `claude/seedling-beamtower-drift-gsnu4v` (the harness's). Nothing went to `main` |
| Dev servers | `serve-nocache.py 9680` (this tree), 9681 (base worktree), 9682 (flip worktree); killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS (game-witnessed at 0 px; behind `beamTowerDrift`, OFF) · D3 PASS (G3 is the tower's beam: ours, modelled behind `beamTowerBeamHit`, OFF, game-witnessed) · D2 PASS, STOP for the flip (the candidate is green on the bounded set after 8 re-pins; held for the user)** |

## The one thing to know first

**`flyerLive` cannot flip without the drift.** Measured on the game (p4f), survey step 208 (L105):

- With `flyerLive` alone, the solver's 395-t plan is blocked at **t198** by `beamtower@48,40`, which has risen on its
  drift. The model walks through it, so the run parts from the game (FAIL).
- With `flyerLive` + `beamTowerDrift` + `beamTowerBeamHit`, the solver's 416-t plan is the game at **0 px on all 417
  ticks** (PASS).

The drift is a real game fact: `y += 0.3·sin(worldFrame(100, 2)/100·2π)` per unfrozen update moves the 16x32 Solid
through an 8.6 px band on a 90-tick `Game.time` period. Where it sits depends on the seam time. The three switches
belong together, and the flip candidate carries all three.

## W0: the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B … e967758748` (the harness branch already sat there) | `e9677587486e`. Bootstrap `READY`, node v22.22.0. The five non-wasm submodules were uninitialised again (`git submodule update --init` each) |
| identity block | `SEEDLING_PORT=… bash scripts/procgen/identity-block.sh .`, at a pristine base worktree (`w0/identity-base.txt`) and at head `e7e16b9` (`w0/identity-head.txt`) | **Every value row equal**: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY **`36b59445`**, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK. At head the reference was 2 word-count regions, regenerated to ALL 7 + 5 MATCH. In the base worktree it read 4 DIFFER: environment-only (symlinked submodules), as LAPSECOST saw |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign **`6b1bf15c`**, all exit 0, base and head |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` | **612**, `c4d2699263cab144ca6de49a00be94d5`, before and after (`w0/taperunner-pairs-*.txt`) |
| surface / constants | `census-seedling-solver-surface --check`, `census-seedling-constants --check` | Surface 296 → **302** rows GREEN: the six moved `BeamTower` names are now imports of `beamTower.js`, classified. Constants 5,882 → **5,960** literals PASS: `beamTower.js` is simulation now, classified by 10 selector rows; plus `camera.js`'s 15; and one exact row re-pointed (`playerPhysicsV2.step`'s `directionFace` −1, whose statement gained `beamTowers = null`) |
| roster | `fixtures/tapes/index.json` | **277**, unchanged. The new game witness is a `chaser-witness` fixture, not a roster tape |
| bounded vitest BEFORE | 116 files at the base worktree (`w0/bounded-rel.txt`): the brief's list + `fidelityLapseCost`, `tapeRunner`, `solverBot`, `hazards`, `camera`, `levelWorld`, `entityRecords`(+`.agreement`), `seedlingEntityWitness`, surface + constants, and every test naming what I touch (`rg -al` over `LIVE_GEOMETRY_KEYS`, `normalizeLiveOpts`, `SHAKE_WRITERS`, `LEDGER_KIND_NAMES`, `PROGRESS_FIELD_NAMES`, `beamtower`/`BeamTower`, `createBeamTower`, `stepBeamTower`, `beamRect`, `CONTACT_FIDELITY_KEYS`, `SOLID_GRID`, `flyerLive`, `collidesSolid`, `solidBoxesForMover`, `playerPhysicsV2`, `liveGeometryOpts`) | **3,991 / 3,991** passed (`w0/bounded-before.rows.gz`, md5 `37ed349b`) |
| bounded vitest AFTER | the same 116 + `fidelityBeamTower.test.js`, at head | **4,009 / 4,009** (`w0/bounded-after.rows.gz`, md5 `a7becdfb`): BEFORE + 18 new rows (15 in `fidelityBeamTower`; the two per-switch `contactFidelityHook` rows; the `beamTowerTrace` ledger witness row), 0 gone, one renamed (`levelRun`'s "36 kinds" → "37 kinds") |

## D1: the drift (PASS)

**Read.** `BeamTower.as`:

- `:53-56` `if (Game.freezeObjects) return;`
- `:57-95` the beam (D3)
- `:100-103` `y += 0.3 * Math.sin(Game.worldFrame(100, 2) / 100 * 2 * Math.PI)`
- `:43-44` `setHitbox(16, 32, 8, 24); type = "Solid"` — the box rides on `y`

`World.as:53-58` updates every entity's GRAPHIC whether or not its `update()` ran, so a frozen frame still steps the
tower's Spritemap.

`Game.time` advances once per `Game.update` (below the `blackCover` gate, outside the freeze), which is the model's
`clock.now()`. The tower is added at `Game.as:2297`, after the Player (`:2250`), and `addUpdate` prepends. So it updates
before the player and before every chaser (`flyer :2285`, `jellyfish :2286`); both sweep against where this frame left it.

**The model before:** the Solid stood at its placement, `levelWorld`'s `beamtower` row (`[oel.x, +16) x [oel.y − 8, +32)`).
LADDER2 had transcribed the drift for the BEAM, inside the danger map (`hazards.stepBeamTower`), but never for the Solid.

**Change** (`CONTACT_FIDELITY.beamTowerDrift`, OFF; `SEEDLING_BEAMTOWER_DRIFT=0|1`):

- **`beamTower.js`** (new, simulation): `BeamTower.as`'s transcription moved verbatim from `hazards.js` (the K2PREP
  shape: `hazards.js` imports it through `solverView` and re-exports it, so every consumer is unchanged). It adds:
  - `stepBeamTowerFrame(t, {time, frozen})`: one `World.update` of the tower (the beam test, the drift, the anim);
  - `beamTowerSolidRect(t)`;
  - `beamTowerReachRects(t, span)`.
- **`levelRun`:**
  - a per-visit tower roster (`beamTowerStateFor`, rebuilt in `freshVisitState`);
  - `stepBeamTowersNow` in the tower's slot (after `stepBombPushersNow`, before `stepIceTurretsNow`; frozen when a
    ceremony holds), and in `runFrozenTick` (frozen);
  - `beamTowerRectsNow()` in `liveSolidOpts`;
  - the ledger kind `beamTowerTrace` (`{t, level, id, y, frozen, gameTime, beam?}`, ON only) and its getter.
- **`levelWorld`:**
  - `solid.beamTowerId`;
  - `LIVE_GEOMETRY_KEYS` gains **`beamTowers`** (the 15th family, appended), and `normalizeLiveOpts` carries it;
  - `liveRectOf` gains a `beamTowers` arm (a missing entry is the placement);
  - the SOLVECOST grid treats a tower as `dynamic`, because its live rect can leave its cells.
- **`playerPhysicsV2.step`:** the live bag carries `beamTowers`. Its own `LIVE_GEOMETRY_KEYS` assertion caught the
  omission on the first run.
- **`r8Acceptance.plannerDropsSixFamilies.dropped`** gains `beamTowers`: the planner's obstacle query reads the
  placement, while the run's sweep, and so every preview, reads the drift. Re-pinned 6 → 7.
- **Unknown is a refusal:**
  - no `Game.time` makes the tower's `y` unknown for the rest of the visit;
  - so does a `Game.time` that jumps between two stepped frames (frames this run did not step);
  - a player box inside the drift band (±8.606 px) is then refused by name.

**Game witness** (p4f, headless, port 9680; `probe-seedling-chaser-mobiles --class=Flyer --player-hits --record
--name=beamtower-l105-773-flyer-plan`, the model with `flyerLive` + both switches):
`fixtures/chaser-witness/beamtower-l105-773-flyer-plan.json`. The tape is LAPSECOST's `flyerLive` plan for leg 773
(`d2/tape-773-flyerlive-plan.json`, 381 t), recorded fresh: **PASS**, clock fit at shift [0] on 382 samples, both Flyers
at Δ 0 (507 comparisons; `d1/probe-773-record.log`).

| replay of the witness | parted samples |
|---|---|
| `flyerLive` + `beamTowerDrift` + `beamTowerBeamHit` | **none: 0 px on all 382 ticks** |
| drift OFF | first at **t205** (the model walks through: x 64.89 where the game holds 66.04) |
| beam OFF | **[381]** only (D3) |

The trace: at t205 `beamtower@48,40` has risen **5.080 px** at `Game.time` 5560 (the game's `botStatus.game_time` reads
5561 after that frame's increment). Its Solid's bottom is above the player box's bottom (24.28 + 3) from t204's frame, and
not at t203's.

**The frozen stretch (asked by the brief): a measured vacuity.** No tower room holds a freeze the model steps:

- L103's Watcher has EMPTY text, so `NPC.talk` needs `myText[0].length > 0` and it never talks;
- L107's `buttonroom` is an `Activators` with no freeze;
- L104, L105 and L108 hold no writer at all (`rg "freezeObjects = true"`).

The one reachable freezer is the inventory menu, and the model does not step the inventory key. So "unfrozen frames
only" is pinned by a unit row, `stepBeamTowerFrame` frozen vs live, and by the census row
(`fidelityBeamTower.test.js`). It is not witnessed on the game. The 20 dead frames of the room load (`Game.time` advances,
no `World.update`) are inside the witness, and the 0-px result is consistent with them carrying no drift.

**Census: every BeamTower in the atlas, with its legs and survey steps:**

| level | towers (oel x,y · direction · rate · speed) | sweep legs (`census/tower-and-flyer-room-legs.tsv`) | survey steps |
|---|---|---|---|
| L103 | `208,248` d2 r4 s0.25; `144,200` d0 r2 s0.5 | 765 766 767 768 | 206 |
| L104 | `16,56` d0 r1 s1 | 769 770 771 772 | 207 |
| L105 | `48,40` d0 r1 s1 | 773 774 775 776 | 208 |
| L107 | `208,120` d0 r2 s0.5; `208,136` d2 r2 s0.5 | 780 781 782 783 | 212 |
| L108 | `160,56` d2 r4 s0.25; `96,104` d0 r4 s0.25; `160,152` d2 r4 s0.25; `96,200` d0 r4 s0.25 | 784 785 | 213 |

Ten towers in five rooms, 18 legs and 5 survey steps. The Flyer rooms add L100 (753), L101 (754 755 756) and steps 203,
204, 210 and 215.

**Mutants** (predicted first, copy + restore; `fidelityBeamTower.test.js`):

| mutant | predicted | measured |
|---|---|---|
| M2: the drift also runs on a frozen frame | the frozen-frame unit row only | exactly that |
| M4: no `beamTowers` arm in `liveRectOf` | the `collidesSolid` row + the 0-px witness row | those two + the beam-OFF and trace rows (they replay through the moved Solid too): a superset |
| M5: the tower not `dynamic` in the solid grid | the `collidesSolid` row + the 0-px witness row | **the `collidesSolid` row only**: the witness's blocking query does not depend on grid membership. The unit row is what holds the grid |
| M6: no `beamTowerBeam` shake writer | the run-shake row only | exactly that |
| M7: the drift reads `Game.time − 1` | the witness row + the trace row | **the trace row only**: a one-tick phase shift does not move this stop. The trace's `gameTime` is what holds the clock |

## D3: the L104 arrival hit (PASS)

**Identified on the game.** At t381 the game's player is at (24, 39.21) in L104, on the first tick after the crossing
(`hits` 0 → 1, Δy −4.275). `beamtower@16,56` (entity (24, 72), rate 1) is beaming UP. Its `getRect(1)` is x 22..26,
y 0..53, and the player's box is x 22..26, y 37.2..42.2. `p.hit(null, 5, (24, 72), 1)` pushes straight up. **It is
ours** (BEAMTOWER's region): the run had never billed a beam, and only the danger map priced it (LADDER2's
`phaseHazardHit`), so a beam the solver did not plan through took the game's hit unmodelled.

**Change** (`CONTACT_FIDELITY.beamTowerBeamHit`, OFF; `SEEDLING_BEAMTOWER_BEAM_HIT=0|1`), in the same
`stepBeamTowersNow`:

- on an unfrozen frame, before the drift, a beaming tower's rect tests the player's PRE-move box inclusively
  (`Entity.collideRect`; the tower updates before the player);
- a touch lands `applyPlayerHit({source: 'beamtower', force 5, damage 1, from: (cx, pre-drift y), retaliate: null})`,
  then `Game.shake = 15`, through a new `camera.SHAKE_WRITERS.beamTowerBeam` row (an assignment, written whether or not
  the hit lands);
- an unknown anim or `y` with the player inside the union of the beam's reach is refused by name.

`BOSS_CLASS_SHAKE_WRITERS` derives from the table, so it gains the row. `shakeWritersHere` never names it, because only a
player in the beam opens it, like `playerHit`.

**Game witness:** the same fixture. Its t381 is at 0 px only with the switch ON, and `playerHits` carries
`{t: 381, level: 104, id: 'beamtower@16,56', hits: 1}`. `run.shake` reads 14 after t381 (15, then that frame's `view()`
decay); without the writer it would read 4. LAPSECOST's own `lapsecost-l105-773-on-flyer` witness stops at t381 and is
untouched (0 px with every combination).

## D2: `flyerLive` with the drift (PASS, STOP for the flip)

**Captures.** LAPSECOST's leg-773 capture cannot be replayed with `flyerLive` ON. The page's live digest has no Flyer
bodies, so the shadow replay diverges at tick 0 ("a page bug, not a solver verdict"). So I made a new capture: a local
sweep of the 22 tower/Flyer-room legs (`--mode=inv --keys=…
--contact-fidelity=<the ON defaults>,flyerLive,beamTowerDrift,beamTowerBeamHit --capture-requests`, one page;
`d2/sweep-C-22-legs.jsonl`, `d2/cap-C-requests.jsonl.gz`).

**Sweep (local, one sample each; by key against the CI baseline 38778270309, defaults):**

| key (id) | CI default | local, the three ON |
|---|---|---|
| 754 `level_101__r4c2 <- in_L100_288_96 -> exit:out_stairsup_48_96` | failed | **done** |
| 773 `level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144` | failed | **done** |
| 776 `level_105 <- in_L106_256_0 -> exit:out_teleporter_224_64` | done | done (CI keyed `flyerLive` alone lost it at t160 by the tower) |
| 765, 768, 781, 782 | failed | failed (the same refusals: budget, an exhausted ladder at the L103 beam, the L107 hold stance) |
| 785 `level_108__r11c8 <- in_L109_0_112 -> exit:out_teleporter_224_224` | done | failed: **a page artifact, not this model**. Before any solve (`seamTime` null), the model refused to build L108 from a clear an earlier leg on the same 22-leg page carried ("the tape clears tag(s) 1, which no entity in this level reads"). The keyed CI dispatch (fresh pages) decides it |
| the other 13 | done | done |

**Node, by captured request, ±10 ticks of seam time** (`replay-seedling-solve-request.mjs --seam-time-sweep`,
`d2/seam-census/`):

| leg | C: the three ON | drift OFF | beam OFF | `flyerLive` only |
|---|---|---|---|---|
| 754 (request 1, the 2,560 retry; request 0 refuses at 640 in all four) | 21/21, one answer `d9ddb4fb` | identical | identical | identical. **The gain is `flyerLive`'s; BEAMTOWER is inert in L101** |
| 773 | 20/21 solve (398–423 t). +17 refuses: no corridor | 21/21, one plan (398 t) | 21/21, 19 equal to C | = drift OFF |
| 776 | 21/21 solve, **5 answers that follow the tower's phase** (385–386 t) | 21/21, ONE plan `ac791f` at every seam: the plan CI's keyed run lost at t160 on the game | 21/21 equal to C | = drift OFF |

**Survey (local, `--through=end --route=full --only=` the nine tower/Flyer steps; `d2/survey-tower-flyer-steps.tsv`):**

| step | level | CI 38778265493 | A defaults | B +flyer | **C +flyer+drift+beam** | D +drift | E +beam |
|---|---|---|---|---|---|---|---|
| 203 | 100 | REFUSED | REFUSED | REFUSED | REFUSED | REFUSED | REFUSED |
| 204 | 101 | REFUSED | REFUSED | SOLVED 287 | **SOLVED 287** | REFUSED | REFUSED |
| 206 | 103 | REFUSED | REFUSED | REFUSED | REFUSED | REFUSED | REFUSED |
| 207 | 104 | 261 | 261 | 261 | 261 | 261 | 261 |
| 208 | 105 | 300 | 300 | 395 | **416** | 393 | 300 |
| 210, 212, 213, 215 | 101/107/108/101 | REFUSED | = | = | = | = | = |

- **A equals CI on all nine**, so it is a clean control.
- Every REFUSED text equals A's, except 204 (now solved) and 206, where the Flyer moves the refusal's danger point
  0.3 px (still the L103 beam).
- E (the beam alone) is inert on these steps.

**Step 208, decided on the game** (p4f; `d2/probe-208*.log`, the plans `d2/step-208-walk-[ABC].json`):

| the plan | played on p4f against the model with | verdict |
|---|---|---|
| A's 300 t (defaults) | `flyerLive`, drift ON / OFF | **PASS both**: the real Flyer's drop moves the player before the tower, so D's 300 → 393 is the drift acting where the model's Flyers are inert (a walk the game never makes) |
| B's 395 t (`flyerLive` alone) | `flyerLive`, drift OFF | **FAIL**: the model parts at t198 (blocked by the risen tower; the drift model says so too), then the Flyer's chase at t202 |
| C's 416 t (the three) | the three | **PASS, 0 px on 417 ticks** |

**The flip candidate** (`seedling-fidelity-beamtower-evidence/flip-candidate.patch`, md5
`99b900a175e9adb81471a1a7dbde2f72`; 5 files; `git apply --check` clean at head): `flyerLive`, `beamTowerDrift` and
`beamTowerBeamHit` ON, with every re-pin. Measured in a scratch worktree at head:

| row | result |
|---|---|
| bounded set (the 117 files) with the three ON, no re-pin | **8 reds**, listed below |
| the same, with the patch's re-pins | **4,009 / 4,009** (`d2/bounded-flip.rows.gz`, md5 `d14c5a58`) |
| identity block on the flip tree | equal to head except ENEMY census `36b59445` → **`f0bec576`** (the Flyer bridged) and the reference (word counts; regenerate at landing). Six `--check`s unchanged (r9-campaign `6b1bf15c`). The generated set read env-only in the worktree (no venv); re-run with the primary venv: OK |

The 8 reds, all re-pinned in the patch:

1. `contactFidelity` "the shipped defaults": the three now `true`.
2. `fidelityBeamTower` "ship OFF" and 3. "OFF, the run steps no tower" (its default-is-OFF line): the default rows.
4. `fidelityLapseCost` "ships OFF; bridged only ON": the default row.
5. **`fidelityLapseCost` "leg 773's request … solves in 381 t" → 426 t.** This is substantive: that 381-t plan is the one
   the risen tower blocks at t205 on the game. The 426-t plan is a MODEL row; its game check is the keyed sweep
   (dispatch 1).
6. 7. 8. `r8Acceptance` × 3, the brief's three `pendingSwitchScope.flyer` re-pins: the default roster gains `flyer` in
   "the DECLARED scope and the DERIVED roster" and in the defaults row of "the three `stepped` contact tables", and the
   "switches OFF" controls name `flyerLive: false` (`{ bulbLive: false }` → `{ bulbLive: false, flyerLive: false }`;
   "a transcribed class with no roster row is NOT bridged" and both K2 rows).

**STOP: the flip is for the user.** The three switches belong together, and `flyerLive` alone loses step 208 on the game.

## The survey and sweep rows this moves (before → after)

**Defaults (all three OFF): nothing moves.** That is the identity block, the six `--check`s, tapeRunner and the bounded
set above.

**With the flip (the three ON), local:**

- survey: step **204 REFUSED → 287** (the Flyer), step **208 300 → 416** (the drift: game-witnessed, the shorter plans
  are wrong on the game). Nothing lost among the nine reachable steps. No other step can move: towers stand only in
  L103–L108 and Flyers only in L100/L101/L103/L105, and every survey step boots its own room;
- sweep: **754 and 773 failed → done**; 776 stays done (where `flyerLive` alone loses it); 785 needs the keyed re-run
  (a page artifact here).

## CI dispatches for the planner

All on ref **`claude/seedling-beamtower-drift-gsnu4v`** unless a flip branch is named. `ON` below is the current default
set: `collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove`.

1. **Keyed A/B on the 22 tower/Flyer-room legs** (`seedling-divergence-sweep.yml`, `mode=inv`, `producer=solver`,
   `capture_requests=true`, **×2** each). `keys=` the 22 keys of `census/tower-and-flyer-room-legs.tsv`,
   `|`-joined:
   `level_100__r2c3 <- in_L99_48_96 -> exit:out_stairsdown_48_96|level_101__r4c2 <- in_L100_288_96 -> exit:out_stairsup_48_96|level_101__r4c2 <- in_L102_64_96 -> exit:out_stairsup_48_96|level_101__r4c9 <- in_L102_160_96 -> exit:out_stairsup_144_96|level_103 <- in_L102_0_96 -> exit:out_teleporter_0_64|level_103 <- in_L102_0_96 -> exit:out_teleporter_304_144|level_103 <- in_L104_144_128 -> exit:out_teleporter_0_64|level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144|level_104 <- in_L103_0_64 -> exit:out_teleporter_0_16|level_104 <- in_L103_0_64 -> exit:out_teleporter_144_128|level_104 <- in_L105_224_64 -> exit:out_teleporter_0_16|level_104 <- in_L105_224_64 -> exit:out_teleporter_144_128|level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144|level_105 <- in_L104_0_16 -> exit:out_teleporter_224_64|level_105 <- in_L106_256_0 -> exit:out_teleporter_80_144|level_105 <- in_L106_256_0 -> exit:out_teleporter_224_64|level_107__r0c2 <- in_L102_224_96 -> exit:out_teleporter_0_48|level_107__r0c2 <- in_L102_224_96 -> exit:out_teleporter_304_176|level_107__r0c2 <- in_L108_0_32 -> exit:out_teleporter_0_48|level_107__r0c2 <- in_L108_0_32 -> exit:out_teleporter_304_176|level_108__r2c0 <- in_L107_304_176 -> exit:out_teleporter_0_32|level_108__r11c8 <- in_L109_0_112 -> exit:out_teleporter_224_224`.
   Three arms: `contact_fidelity=ON,flyerLive,beamTowerDrift,beamTowerBeamHit`; `contact_fidelity=ON,flyerLive`;
   `contact_fidelity=ON,beamTowerDrift,beamTowerBeamHit`. Expect, in the first arm: 754/773/776 `done`, 785 `done` (CI's
   page grouping), none lost against 38778270309; in the second, 776 lost (CI's keyed result).
2. **The full sweep, three-ON vs default** (`keys=` empty, the first arm's `contact_fidelity`), then **×2** (`keys=`) on any
   `done → failed` key the default run does not share.
3. **Survey on a flip branch:** a scratch branch from this head, `git apply
   CC/docs/cloud-reports/seedling-fidelity-beamtower-evidence/flip-candidate.patch` (fill `<the licence>`), commit,
   push. Then `seedling-survey.yml` with its defaults (`--through=end --route=full`). Expect 171 SOLVED: 204 → 287,
   208 → 416, and nothing lost against 38778265493. On the same branch: its **push JSUT** (the unfiltered vitest with the
   flip; FLIP14 found 9 rows only CI caught), the **full tier**, and **`seedling-probe.yml battery=standard`**.
4. **The beam alone, survey:** a measurement commit with only `beamTowerBeamHit: true`, then `seedling-survey.yml -f
   only=203,204,206,207,208,210,212,213,215`. Expect no mover (E above).

## The JS arc's pins and what it must wire

- **No signature or contract change** to `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging`.
  No new staging field, no new `SolverRefusal.obstacle.kind`.
- **Two new contact switches**, `beamTowerDrift` and `beamTowerBeamHit`. The page's settings derive from
  `CONTACT_FIDELITY_KEYS`, so `flashPanel.seedlingContactBeamTowerDrift` / `…BeamTowerBeamHit` exist with no wiring
  (`contactFidelityHook` rows green), and the sweep's `contact_fidelity=` accepts them (measured: the local sweep's
  `CONTACT:` line).
- **A 15th live-geometry family, `beamTowers`.** `normalizeLiveOpts` fills it (null), so every branded bag carries it.
  ⚠ **The walker's `botDriverV2.livePerVisitOpts` does not supply it** (it already supplies 9 of 14): the walker's own
  geometry queries read a tower's placement, while the run it drives steps the drift. Not changed here, and no
  `producer:walker` row was run. If the walker drives a tower room under the switch, it wants
  `beamTowers: run.entities(…)` and a family on the run. That is the arc's call, with the JS arc's review.
- **A ledger kind and run getter, `beamTowerTrace`** (empty OFF), and a `playerHits` source `beamtower` (ON only).
- **The divergence sweep's producer and the capture codec are untouched.**

## Handed to the hammer arc

Nothing. None of its functions were edited. `camera.SHAKE_WRITERS` gained a row, so `BOSS_CLASS_SHAKE_WRITERS` (the
`planSwordDash` `would-hit` roster) gains `beamTowerBeam`. No room's `shakeWritersHere` names it, so no press refusal moves
(the bounded set and the r9-campaign `--check` agree).

## Deltas (base → head)

- **Code:**
  - `beamTower.js` (new: the move + `stepBeamTowerFrame`, `beamTowerSolidRect`, `beamTowerReachRects`);
  - `hazards.js`: the transcription replaced by the re-export;
  - `solverView.js`: the door;
  - `levelRun.js`: the roster, `stepBeamTowersNow`, `beamTowerRectsNow`, the slot and frozen-tick hooks, the ledger;
  - `levelWorld.js`: `beamTowerId`, `LIVE_GEOMETRY_KEYS`, `normalizeLiveOpts`, the `liveRectOf` arm, grid `dynamic`;
  - `playerPhysicsV2.js`: the bag;
  - `camera.js`: `SHAKE_WRITERS.beamTowerBeam`;
  - `contactFidelity.js`: the two switches;
  - `r8Acceptance.js`: the planner partition row.
- **Tests:**
  - new: `fidelityBeamTower.test.js` (15 rows);
  - `levelRun.test.js`: the ledger count 36 → 37 and its witness row;
  - re-pinned: `r8Acceptance` (dropped 6 → 7), the `contactFidelity` defaults pin (+ its skip guards).
- **Fixtures:** `chaser-witness/beamtower-l105-773-flyer-plan.json` (not the roster).
- **Records:**
  - surface 296 → 302; constants census + fields (+10 selector rows, one re-pointed exact row);
  - the reference regenerated (ALL MATCH);
  - `seedling-bot-log.md` BEAMTOWER entry with 4 trap candidates; the `seedling-bot.md` as-built paragraph.
- **Evidence:** `seedling-fidelity-beamtower-evidence/` (`w0`, `d1`, `d2`, `census`, `flip-candidate.patch`).

## What the brief got wrong (measured)

1. ***"the clock is the staging's seam time plus the run's unfrozen frames"*.** The phase is `Game.time` itself (the
   staging's seam time plus EVERY frame, frozen and dead ones included: `time += timeRate` sits outside both gates). Only
   the drift's ACCUMULATION skips frozen and dead frames. The model reads `clock.now()` on each frame it drifts.
2. ***"Record the tower's y per frame across a frozen stretch (a ceremony or a button fall)"*.** No tower room holds one.
   L103's Watcher never talks (empty text), L107's `buttonroom` does not freeze, and nothing else in the five rooms writes
   the freeze. Measured and pinned as a vacuity. Also, the game exposes no BeamTower state (`botMobiles` reads `Mobile`s
   only, and the tower is an `Entity`), and a read-only probe mode cannot add one without an AS3/wasm change. The tower
   is witnessed through the player it stops.
3. ***"G3 … Not investigated"* was ours.** It is the same tower family's beam (`beamtower@16,56`, up), not another
   slice's region.
4. ***"`flyerLive` … gains 754 and 773"* — 754's gain is the Flyer's alone.** BEAMTOWER is inert in L101 (one answer
   with every combination).
5. **776's loss under `flyerLive` is G1, confirmed in node:** drift OFF gives one plan at every seam (CI's lost one);
   drift ON gives five phase-following plans, all solving.
6. ***"208 264→240"*** (LAPSECOST's number) is stale at this base: CI and the local defaults read 300; `flyerLive` alone
   395 (game-FAIL); the three 416 (game-PASS).
7. **Bootstrap `READY` left the five non-wasm submodules uninitialised again.**

## Residue

1. **The walker is drift-blind** (`livePerVisitOpts` does not supply `beamTowers`). This is for the JS arc's review
   before any `producer:walker` run in a tower room under the switch.
2. **The freeze gate is unwitnessed on the game** (a vacuity; above). If a generated world puts a freezer in a tower
   room, witness it then.
3. **Forecasts hold the tower where it stands now.** The chaser and spinner forecasts that query
   `solidBoxesForMover(run.liveGeometryOpts())` at future horizons read the CURRENT tower rect. The previews (run
   steps) are exact.
4. **773 at seam +17 refuses** with the three ON ("no corridor"; 1 of 21). This is seam-sensitivity of a real game
   phase, not a regression; the keyed ×2 decides the sweep row.
5. **785's local failure is a page artifact** (a cross-leg clear on one page); the keyed dispatch decides it.
6. **The 426-t answer for LAPSECOST's 773 request (flip row 5) is a model row.** Its game check is dispatch 1.

## Byte-inertia (OFF)

What did not move at head with the defaults:

- every identity row, and the six `--check`s;
- tapeRunner (612, `c4d26992`);
- the roster (277);
- every committed tape, expectation and trace;
- the bounded set: 3,991 rows identical, plus 18 new (and one renamed).

The surface gained the six moved names as imports and the constants census gained `beamTower.js`. Both are re-censused
and pinned.

CI on the code head `e7e16b9` (run 38800819699): **success**, unfiltered **812 files / 20,424 passed / 0 failed**; slow
battery 18 files / 253 passed. The records head's run is quoted in the final message.

## Rows to BANK

- **Code:** `contactFidelity.beamTowerDrift` and `.beamTowerBeamHit` (both OFF), `beamTower.js`, the `beamTowers` live
  family.
- **Game witness:** `beamtower-l105-773-flyer-plan` (p4f): 0 px on 382 ticks with `flyerLive` + both; drift OFF parts at
  t205; beam OFF at t381 only; the Flyers at Δ 0 (507).
- **Game, step 208:** `flyerLive`-alone plan FAIL at t198 (the tower); the three-ON plan PASS at 0 px (417).
- **Survey (local, the nine reachable steps), the three ON:** 204 REFUSED → 287, 208 300 → 416, none lost; the defaults
  equal CI on all nine.
- **Node seam census (±10):** 754 one answer in every combination; 776 one plan with drift OFF vs five phase-following
  plans ON (all solve); 773 20/21 ON.
- **The flip candidate:** `flip-candidate.patch` `99b900a1` (5 files); bounded 117 files 4,009 / 4,009 with it; ENEMY
  `f0bec576`; r9-campaign `6b1bf15c` unchanged.
- **W0 / identity OFF:** unchanged. Surface 302, constants 5,960.
- **Mutants:** M2, M4, M5, M6, M7. M5 and M7 were caught only by their unit/trace rows, not by the witness, as measured.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52), any `producer:walker` row. No
  `git stash`, no rebase, no force-push.
