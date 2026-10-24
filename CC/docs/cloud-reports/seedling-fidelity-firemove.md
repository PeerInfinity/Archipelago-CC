# Seedling fidelity FIREMOVE — the solver moves a `PushableBlockFire` by Fire presses and weighs with it (`fireBlockRoute`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-firemove` (planner `seedling-fidelity-planning-12`, wave 29) |
| Start SHA | `e8d85de8d1` (`fidelity-harvest/firepush` = main `f9342f25b8` + FIREPUSH, all OFF) |
| Code head | `33b59513` (CI green); the evidence and this report are the commits after it |
| Harness branch | `claude/seedling-firemove-02rbyg` (nothing pushed elsewhere) |
| Port | 9727 (and 8000 for the probe battery, whose probes ignore `SEEDLING_PORT`) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS for L41 (p4g, 0 px) and for L40's route (= FIREPUSH's witnessed route); L40's execution STOP (CORPSEBUMP's row) · Movers: STOP for a licence** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-firemove-evidence/` |

## The one thing to know first

**With `fireBlockRoute` ON, L41's Totem Part 240,144 solves, and the game agrees at 0 px.** The route survey's step 94 goes
REFUSED → SOLVED (2,346 t), sweep leg 871 goes failed → solved on its captured requests, and the survey's own plan
replays on p4g at 0 px over 2,343 ticks. The plan is: the crusher baited onto the cover's button, then six solver-derived
Fire presses park `pushableblockfire@112,144` on `button@176,176`, then the part.

On L40 the solver's own route for the t5 holder is **FIREPUSH's game-witnessed `FIREPUSH_ROUTE`, press for press**
(35 orders, 188 expansions). It still cannot run there, for two reasons:
- the t2 holder (the turret corpse) is CORPSEBUMP's;
- `runFire` refuses a glide in a room whose Bobs the block sweep does not see.

So legs 869/870 and survey step 67 do not move with this key alone.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B … e8d85de8d1`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `identity-block.sh` in a worktree at the base, venv active (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `481b7a1c`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 (= FIREPUSH's) |
| reference | in the block | 4 DIFFER: the known box artifact (no `bulletml-dodge` checkout) |
| surface / constants / entities / profile | `evidence/censuses-w0.txt` | GREEN 347 · PASS 6,911 · PASS 566 · PASS 138 |
| roster | `fixtures/tapes/index.json` | 289 |
| tapeRunner pairs | sorted `status\tfullName` | 635, md5 `88fc7df4dd05d11dfd84ebbea675cc8e` (= FIREPUSH's) |
| bounded vitest BEFORE | 122 files + `fidelityL32ArenaPrefix.slow` in the base worktree (`evidence/vitest-files.txt`, `rows-before*.txt`) | 4,351 passed / 1 failed / 14 skipped; slow 5/5. The reds are the worktree's environment: three `flashPanel` files and `generated.test.js` (box artifact) |

⚠ **The acceptance md5 depends on the box.** It is `481b7a1c` here on both sides, and FIREPUSH's box gave `933c14f7`. The
row is compared base against head on one box (below).

**The gap, reproduced** (`survey-seedling-route.mjs --through=end --route=full --only=66,67,92,94`, FIREPUSH's three
keys OFF and then ON; `evidence/w0-{off,on}.txt`):
- **(a) L39, steps 66/92:** *"no REACHABLE stance inside button@112,144 … wandlock@144,64 — its group t=3 publishes only
  while a Solid sits on button@112,144, and NO block in this room can reach it"*. This is the same OFF and ON.
- **(b) L40, step 67:**
  - OFF: *"Obstacle: solid:pushableblockfire (pushableblockfire@576,576) … Strategy 'shove' failed to apply"*.
  - ON: *"no REACHABLE stance inside button@816,400 … wandlock@800,400 — … NO block in this room can reach it"*.
- **(c) L41, step 94:** the collect walk grazes `wandlock@240,96` for 400 ticks (*"waypoint 5 (248,136): not reached …
  after grazing 397 solid(s): wandlock at (240,96)"*). This is the same OFF and ON.

## D1 — the route move (PASS, behind `fireBlockRoute`, OFF)

`contactFidelity.js`: `fireBlockRoute` (OFF; `SEEDLING_FIRE_BLOCK_ROUTE=0|1`).

**`deriveBlockRoute`'s fire arm** (`fireMoves`, selected when the routed block is a `PushableBlockFire` and the key is ON).
It follows the shape of the spear's `pressMoves`:
- **One tile per press.** The destination must be on the map, must not be a sink, and must not be Solid to the block
  (`blockBlockedAt`). A sink is not planned, because `runFire`'s `moves` arm names the cell a block ENDS on.
- **The stance** is the cell centre on the block's far side, and it must be floor (the planner's own per-tile test, with
  the state's bag and contacts).
- **The push** is `hitPushableFromPoint(block, stance, "Fire")`, the absolute arm of `Player.as:1125`. The band must admit
  exactly the push axis: a diagonal band or another axis is refused by name.
- **The flame audit** is `presses.auditFire(world, stance, {pushables: the state's bag, turrets: run.entities('turrets')})`,
  so the live turret rect counts when `fireLiveTurretReach` is ON. The flame must reach the block, and every other
  responder in it must be `FIRE_ARM_POLICY` `inert`. Measured refusals:
  - L40: every stance whose flame would bump the turret corpse off t2 (e.g. *(29,24) N/S, (30,25) E/W*);
  - L39: *"fire N — the flame from (216,104) also reaches spinner@224,112"*.
- **The player stays at the stance** (`press`'s shape, in `verifyRoute` too). The step is
  `{verb: 'fire', dir, dirIndex, k: 1, from, to, destroys: false, stance}`.
- **Its own order bound**, `MAX_FIRE_ROUTE_ORDERS = 40` (named, `blockRouteBound` reports it).
  - **Measured need:** L40's t5 route is 35 orders and 188 expansions. `MAX_ROUTE_ORDERS` (8) would cut it at 8;
    `MAX_ROUTE_EXPANSIONS` (2000) is shared and still binds.
  - L41's route is 6 orders, and L39 block 2's is 5.
  - ⛔ `MAX_ROUTE_ORDERS`, `MAX_ROUTE_EXPANSIONS` and the route census are untouched; the js route census owns them.
  - OFF, the bound's name and value are `MAX_ROUTE_ORDERS`'s, byte for byte.

**Execution.** `execRoute` runs a `fire` step through `execFireMovePress`:
1. it settles the walk's coast;
2. it selects the Fire's slot from the run's own `inventorySlots`, as the burn does;
3. it calls `runFire(run, perTick, {moves: [{from, to}]})`. That arm keeps every refusal it had: the unmodelled-enemy
   room, the awake crusher, a block not on `from`, and the exact-set effect check;
4. it selects the old slot again.

After the press, `execRoute` asserts the block is on `to`.

**`resolveShoveStrategy`** for a `PushableBlockFire`, with the key ON, tries three answers in order:
1. a block already on its shut momentary button dwells (`parkedFireBlockDwell`, R9 L15's shape);
2. otherwise the pulser arm (FIREPUSH, when its key is ON);
3. otherwise `resolveFireMoveStrategy`: clear-path by Fire presses. With no Fire held it returns `held: false`, and the
   executor refuses by name.

Imports go through the door: `solverView` exports `FIRE_ARM_POLICY` and `hitPushableFromPoint`. The surface census was
re-run with `--write` (349 rows, GREEN, both rows classified).

## D2 — the weigh (PASS, the same key)

- `deriveWeigh` sends a `PushableBlockFire` to **`weighFireBlock`**. That asks the route search the `press` goal
  directly: a fire route is one tile per order, so the one-lean arithmetic has nothing to say about it. With no Fire it
  returns a rejection naming the item, never a silent skip.
- **The parked arm:** a fire block already on `onto` is reported `parked`, so `resolveWeighStrategy`'s dwell-only
  resolution applies. Measured on L41: once the block is on (11,11), `deriveWeigh` answers
  `parked: {blockId: pushableblockfire@112,144, from: (11,11)}`.
- The weigh record carries `weapon: 'fire', slot` for the executor.
- **`execWeigh`, the measured fix** (survey step 66, ON): L39's first fire weigh parked a block on t2's button, and
  `cover@112,144` opened on the landing tick, during `runFire`'s own wait. `runDwell`'s shut-before refusal then called
  the finished weigh vacuous (*"the dwell's condition … is ALREADY TRUE"*). Now, after a route whose last order is a Fire
  press, and only once `execRoute` has asserted the block is on its tile, an already-open responder is recorded as
  `dwell: {metInRoute: true, ticks: 0, at, why}`. A lean route keeps the refusal armed.
- `deriveWeigh` is exported (for the rows); `resolveWeighStrategy` stays its only solver caller.

## D3 — witnesses

**L41 (PASS, p4g headless logic-only, 0 px).** `probe-seedling-fire-move.mjs --tape=<step-94 walk view> --record` writes
`fixtures/firemove-witness/firemove-l41-part3.json` (`evidence/probe-l41.txt`):

| check | result |
|---|---|
| the model (keys ON) replays the survey's step-94 tape to its end | PASS |
| the game reproduces the model at 0 px, the player and every pushable block, **every tick** | **PASS, all 2,343 sampled ticks** |
| the game parks the fire block on `button@176,176` (11,11) | PASS, from t1947 |

The crusher is not compared: `botMobiles` does not list it (`Crusher extends Activators`). My first run compared it and
every row disagreed on that body alone. Its park is witnessed through the cover it holds open, which the first press needs.

**L40 (route PASS; execution STOP).** From `firePushPrefixTape(0, {route: false})`, the state after `r5-l40-part5`'s t2
wait, `deriveBlockRoute` for `pushableblockfire@480,480` onto (48,25) returns **FIREPUSH_ROUTE exactly**: 35 `fire`
orders, every stance and cell. FIREPUSH recorded those 35 presses on the game at 0 px (`firepush-l40-bosskey2`).

The route needs the contact the solver's walk carries there, `proximity-hazard:iceturret@472,400`. The dead turret's
census attack rect still covers the far-side stances: without the contact, the start state's four stances are "not floor".

`solveSegment` from that state plans the chain (shove stance → pulser hold → weigh with the 35-order route) and then
refuses at route step 1/35:
> level 40 holds 22 live enemies, of which [IceTurret, Bob, BombPusher, BobSoldier, Puncher] are NOT MODELLED … The model
> cannot certify this press.

That is `runFire`'s `enemiesUnseenByBlockSweep` arm: the block glide does not see a Bob's body. **STOP → CORPSEBUMP**
(below).

**L39.** From `r5-press-delay`'s boot, block 2's route onto (12,9) is `SHAFT_PLAN`'s presses 4-8, stance for stance. Block
1's route onto (9,8) is presses 1-3.

**Test** `fidelityFireMove.test.js` (7 rows):
- ships OFF;
- OFF, the weigh still skips the fire family by name;
- ON, L40's route = FIREPUSH_ROUTE;
- ON, the L41 recording replays at 0 px;
- ON, the L41 presses go one tile each from (7,9) to (11,11), and there the block is `parked`;
- ON, L39 block 2's route = SHAFT_PLAN 4-8;
- ON, the flame audit refuses the N press that reaches `spinner@224,112`.

## Mutants (predicted first; copy + edit + run + restore; `evidence/mutants.txt`)

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | `fireMoves` returns at once (no fire move) | L40 route, L39 route, L39 audit red | exactly those 3 |
| m2 | the audit's strays always empty | L39 audit red only | exactly that |
| m3 | `weighFireBlock` never parks | L41 parked row only | exactly that |
| m4 | `execWeigh`'s `metInRoute` branch off | no row red; only the survey's L39 step exercises it | no row red; step 66 is its measurement |

## The movers (keys ON): before → after, and the dispatches to confirm

Both arms run with FIREPUSH's three keys ON (the user approved their flip; the brief asks to measure with them ON). Arm A
is the 62 defaults + `fireBlockPulseShove,fireLiveTurretReach,pulserPublishLag` (`evidence/sweep-arm-A.txt`); arm B is
A + `fireBlockRoute` (`evidence/sweep-arm-B.txt`).

### Route survey, full (local, `--through=end --route=full`)

239 rows (`evidence/survey-full-{off,on}.rows.txt`). A is SOLVED 186 / REFUSED 53; B is SOLVED 187 / REFUSED 52.
**5 rows move; 234 are equal, byte for byte on the refusal text.**

| step | room | A | B |
|---|---|---|---|
| **94** | L41 v1, Totem Part 240,144 | REFUSED (the walk grazing `wandlock@240,96`) | **SOLVED 2,346 t** (7.6 s) |
| 66 / 92 / 133 / 153 | L39 v1-v4 | REFUSED at `button@112,144` (0.4-0.5 s) | REFUSED three links deeper, at `button@144,112` (4.9-7.5 s) |

At the new L39 refusal the solver has already parked a block on t2, which opens `cover@112,144`. The player stands on
the t3 button, and the room's next buttons each need another parked Solid (the shaft's three-block order). Step 67 (L40)
is unchanged: t5's route crosses `wandlock@512,480` (t2), and t2's holder is the turret corpse.

### Keyed sweep (local, ×2)

`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --capture-requests`. The legs are the 58 keys derived at
my base for L38, L39, L40, L41 and L107, every room holding a fire block (`evidence/firemove-leg-keys.txt`; 55 of them
are in FIREPUSH's set). Results are in `evidence/sweep-{A1,A2,B1,B2}.jsonl` and `sweep-summary.txt`.

| leg (key) | A1 | A2 | B1 | B2 | decided on the captured request |
|---|---|---|---|---|---|
| **871** `level_41__r7c15 <- in_L40_944_96 ~> … -> location:Level 041 - Totem Part 240,144` | failed | failed | timeout | timeout | **a key mover.** A1's request (seam 8407) and B1's (seam 8396) each answer OFF = refusal (`d8207ac8f1c8`) and ON = SOLVED 2,505 t (`7fea55beb436`, 560 of 640 work units). The B "timeout" is the harness's 90 s leg budget cutting the game playback at t2360 of 2505 (`history: stopped, verbs [bait, walk, weigh]`, no divergence) |
| 371 `level_40__r0c53 <- in_L42_240_336 -> … Totem Part 64,144` | failed | failed | done | failed | noise. A1 (seam 5580) is OFF = ON (`fa54ec1559ea`); B1 (seam 5572) is OFF = ON (`c3ff091e261c`); the answer follows the seam |
| 368 (the same goal from `in_L41_0_160`) | done | done | done | failed | noise. B2's request is OFF = ON (`1ce1955d012a`, the bomb-blast hold refusal) |
| 404 `level_40__r23c29 <- in_L43_176_464 -> … Chest` | failed | failed | failed | timeout | noise. B2's request is OFF = ON (`b31529c5965e`, the camera-shake uncertainty) |
| 869 / 870 (Boss Key 2) | failed | failed | failed | failed | unchanged: *"no REACHABLE stance inside button@816,400"* (t2's holder) |
| the other 53 | equal in all four | | | | |

**1 key-driven verdict mover (871, failed → solved), 0 regressions.**

### Probes, the four keys ON

The four literals were flipped in a scratch edit and restored; the server was on 8000.
- **Standard: 11/11 ALL CHECKS PASSED**, `arrival-composites` included.
- **Long** (`logical-links --only=B --budget-s=1200`): ALL CHECKS PASSED.

The B walk still ends at L39's Totem Part 72,40 (+1037 s), now at the deeper refusal (*"no REACHABLE stance inside
button@144,112"*, `evidence/probe-battery-on.txt`). **For js logical-links B: L39 moved one link, and it still blocks the
walk.**

### Bounded vitest, ON (scratch flip; 123 files + the slow file; `evidence/rows-on{1,2}.txt`)

**Run 1, `fireBlockRoute` alone:** 4,460 passed / 6 failed; slow 5/5. Beyond the environmental reds:
1. `contactFidelity.test.js > the shipped defaults`: the defaults table (a flip re-pins it).
2. `fidelityFireMove.test.js > ships OFF`: likewise.
3. **`fidelityCrusherPress.test.js > … then the room refuses at the wandlock (not this key's wall)`**: a CONTROL on the
   old refusal. ON, it solves (2,189 t). A flip owes this row re-pinned to the solve (SEARCHGAPS' L41 row).
4. **`fidelityWandHold.test.js > … the cover is a wall guard (iii) cannot redeem durably`**: a CONTROL pinning
   `button@112,144`. ON, the refusal is `button@144,112`. A flip owes the re-pin (WANDHOLD's L39 row).

**Run 2, all four ON:** the same, plus FIREPUSH's two known rows (`fidelityFirePush > all three ship OFF` and
`iceTurret > … the corpse HOLDS button@480,384`). The environmental reds are the same as at the base: `generated.test.js`
(box artifact) and `seedlingAtlasArm`.

No committed tape, producer `--check`, or identity row moves, ON or OFF.

### Please run, on `claude/seedling-firemove-02rbyg`

1. **Survey full:** `seedling-survey.yml` with `through=end`, `route=full`, arm A `contact_fidelity=` the 65 keys of
   `evidence/sweep-arm-A.txt`, arm B the 66 of `sweep-arm-B.txt`. Compare against 39496129402 by (level, goal, boot).
   Expected:
   - L41 Totem Part 240,144 SOLVED in B;
   - L39's four visits refuse at `button@144,112` in B;
   - everything else equal.
2. **Keyed sweep ×2:** `seedling-divergence-sweep.yml` with:
   - `keys=` the 58 keys of `evidence/firemove-leg-keys.txt` (`|`-separated);
   - `capture_requests=true`;
   - arms A/B as above;
   - **`leg_budget_ms=180000`**, so leg 871's 2,505-tick playback finishes inside its leg.

   Expected: 871 failed → done; nothing else by key.
3. **Probes:** `seedling-probe.yml battery=standard` with the four keys ON; a `seedling-probe.yml` run of
   `probe-seedling-fire-move.mjs` (the L41 witness; 0 px expected); and `battery=long` for logical-links B (expected: the
   new L39 refusal).

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched.
  There is no new `SolverRefusal.obstacle.kind`.
- **New optional record shapes:**
  - a route step `{verb: 'fire', dir, dirIndex, k: 1, from, to, destroys: false, stance}`;
  - `weapon: 'fire'` and `slot` on a fire `shove` or `weigh` resolution;
  - an executed step record `{verb: 'fire', target, from, to, pressTick, weapon, restoredSlot, ticks}`;
  - a `weigh` record's `dwell: {metInRoute: true, ticks: 0, at, why}`;
  - a `SolverRefusal.bound.name` of `'MAX_FIRE_ROUTE_ORDERS'` (limit 40).
- **Run state:** none added, renamed or reshaped. No per-visit map, and `stateDigestParts` is untouched. The arm reads
  `run.entities('turrets')`, as FIREPUSH's `fireReachFrom` already does.
- **New exports:** `solverBot.deriveWeigh` and `MAX_FIRE_ROUTE_ORDERS`; `solverView` gains `FIRE_ARM_POLICY` and
  `hitPushableFromPoint`.
- The walker (`botDriverV2.drive`/`chooseHeld`/`hasArrived`/`driveStepHeld`) and `runFire` are untouched, so no
  `producer:walker` row can move.

## Hand-overs

- **To CORPSEBUMP (or the planner):** L40's t5 route is ready and equals the witnessed one. Its execution needs two
  things:
  - **(i)** the t2 holder (the turret corpse onto `button@480,384`; CORPSEBUMP's `IceTurret.bump` routing). Until then
    `wandlock@512,480` walls the route, which is why step 67 and legs 869/870 do not move;
  - **(ii)** `runFire`'s `moves` arm accepting L40, whose live census lists `IceTurret`, `Bob`, `BombPusher`,
    `BobSoldier` and `Puncher` as unseen by the block sweep (CORPSEBUMP's "the block glide seeing a Bob's body").

  ⚠ The listed `IceTurret` is the CORPSE: a dead turret still counts as an unseen enemy for that refusal.
- **To the planner (js route census):** the fire arm needs 35 orders for L40 against `MAX_ROUTE_ORDERS` 8, and 188
  expansions against 2000. I used a separate named bound, `MAX_FIRE_ROUTE_ORDERS` = 40, as the brief allows. No shared
  cap was raised.
- **Nothing to the hammer arc.** None of its functions are edited, and `planWaypoints`, the escape, `stateDigest*` and the
  fork are untouched.

## Deltas

- `contactFidelity.js`: `fireBlockRoute` (OFF) and its env lines.
- `solverBot.js`:
  - `deriveBlockRoute`'s fire arm (`fireMoves`, `ordersCap`), `MAX_FIRE_ROUTE_ORDERS`, `blockRouteBound`'s limit,
    `routeCost`/`moveSig`/`verifyRoute`/`describeRoute` know `fire`;
  - `execRoute`'s `fire` branch, `execFireMovePress`;
  - `resolveShoveStrategy`'s fire order, `parkedFireBlockDwell`, `resolveFireMoveStrategy`;
  - `deriveWeigh` → `weighFireBlock`, and the weigh record's `weapon`/`slot`;
  - `execWeigh`'s `metInRoute`;
  - `deriveWeigh` exported.
- `solverView.js`: two exports. The surface census JSON was re-run with `--write` (349 rows).
- `fidelityFirePush.js`: `firePushPrefixTape(idle, {route = true})`. The default is the bytes it was.
- New files:
  - `fidelityFireMove.js` (+ test);
  - `probe-seedling-fire-move.mjs` (box-lock roster row in `boxLock.test.js`);
  - the fixture.
- `contactFidelity.test.js`: the defaults table gains the OFF key.
- Docs: the `seedling-bot.md` paragraph, the bot-log entry, and the docs index + instruments regenerated (the four
  box-artifact regions left as committed).

## What the brief got wrong (measured)

- **"FIREPUSH ON refuses one link deeper … NO block in this room can reach it"** (L40, b): that clause is true of the t5
  holder only while t2 is shut. With the fire route ON, step 67 keeps the same text: the block's route crosses
  `wandlock@512,480` {t 2}, whose holder is the corpse. So **FIREMOVE alone moves neither step 67 nor legs 869/870**. They
  need CORPSEBUMP too.
- **"if 35 orders exceed them, MEASURE the per-depth need"**: 35 orders exceeds `MAX_ROUTE_ORDERS` (8) but needs only 188
  expansions of 2000. The order cap was the only binding bound, and a separate named fire bound clears it.
- **L41 "refuses at the wandlock walk"**: it was not a wandlock work order at all. The walk grazed the shut lock for 400
  ticks, because nothing could weigh its button.
- **L39 (a), "the hold behind `cover@112,144` that only a Solid on the button holds open"**: one fire block does open that
  cover. But the part is behind three wandlocks whose buttons each need a parked Solid, and covers that other blocks
  hold: `SHAFT_PLAN`'s three-block order. One block at a time, the room refuses three links deeper.
- The far-side stances in L40 are walled by a **dead** turret's census attack rect unless the walk carries it as a
  contact. The route's floor test is the planner's, so a deriveWeigh call without the walk's contacts finds nothing.

## Residue

- **L39:** multi-block ordering. The one-block route search parks one block per weigh, and guard (iii) sees the next
  covers as walls.
- **L40:** execution, per the hand-over.
- **The fire arm's own limits**, each refused by name:
  - no sink move;
  - no diagonal-band push;
  - the stance only at the far-side cell centre (no lean or off-centre stance, as the burn has);
  - a stance whose flame reaches any non-`inert` responder is refused rather than priced.
- **Cost.** L39's refusals went from 0.4 s to 5-7 s. `stanceHypothesis` → `deriveWeigh` re-runs a route search per
  activator per stance question, with no cache. L40's single 35-order search is 2.9 s.
- **Leg 871's solve uses 560 of its 640 work units**, close to the budget.
- **L107** (pulser + fire block) is unchanged (legs 783-786 equal in all four runs).
- `metInRoute` is exercised by the survey (L39) and not by a vitest row (m4).

## Byte-inertia (OFF)

- **Identity at head equals the base on one box, every md5 row and all six producer `--check`s**
  (`evidence/identity-{w0,after}.txt`, a row diff: IDENTICAL). Generated set OK, reference 4 DIFFER on both sides.
- tapeRunner pairs: 635, `88fc7df4…`, both sides. Roster: 289.
- Censuses at head: surface GREEN 349, constants PASS 6,911, entities PASS 566, profile PASS 138.
- **Bounded vitest AFTER (defaults, 123 files):** 4,462 passed / 4 failed / 10 skipped; slow 5/5. The reds:
  - two `docsRender` rows, on the docs index not yet regenerated after my bot-log entry (green after the regeneration
    in `33b59513`);
  - the environmental `generated.test.js` and `seedlingAtlasArm`, as at the base.
- **CI `JavaScript Unit Tests`:**
  - at `bd3e844d` (run 40115795703): success, 22,606 passed, 0 failed; slow battery 268;
  - at `33b59513` (run 40127423929): success, 22,606 / 0 failed; slow 268.
  - The last head (this report) is read in the final message.

## Rows to BANK

- **W0:** the three refusals reproduced, FIREPUSH's keys OFF and ON.
- **D1:**
  - the fire arm (one tile, far-side stance, absolute push, flame audit) behind `fireBlockRoute`;
  - `MAX_FIRE_ROUTE_ORDERS`, measured at 35 / 188.
- **D2:** the fire weigh and its parked arm; `metInRoute`.
- **D3:**
  - the L41 p4g witness at 0 px over 2,343 ticks;
  - L40's solver route = FIREPUSH_ROUTE;
  - L39's = SHAFT_PLAN 4-8;
  - mutants m1-m4.
- **Movers:** survey step 94 SOLVED and L39 ×4 deeper; sweep leg 871 failed → solved; probes standard 11/11 and long
  green ON.
- **Trap candidates** (in the bot-log entry):
  - a census volume outlives its body (the dead turret walls the stances unless carried as a contact);
  - a verb's own wait can finish the next verb's condition (a fire press's tail versus the dwell's shut-before check);
  - a sweep `timeout` can be a solved plan whose playback outran the leg budget.
- **Commits:**

  | commit | content |
  |---|---|
  | D1+D2 `9eb13e1c` | the route arm, the executor, the weigh (one key; the hunks interleave in `solverBot.js`) |
  | D3 `bd3e844d` | the witnesses, the test, the probe, the pins |
  | `33b59513` | docs, the regenerated index |
  | evidence + this report | the commits after |
