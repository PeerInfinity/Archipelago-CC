# Seedling fidelity L74ARRIVAL: a button under a room arrival presses on the world's first live frame

| | |
|---|---|
| Session | `seedling-fidelity-l74arrival` (planner `seedling-fidelity-planning-7`, wave 15, model coverage) |
| Start SHA | `926cc2a86f` (main: wave 14 + its four-switch flip; not rebased) |
| Head | the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/seedling-l74-arrival-button-r6b35a` |
| Commits | D1 `98fe6c8` · D2 `13b4aaa` · D3 + records ``44a1e13`` · this report |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (a door witness exists; same switch) · D3 PASS — the switch ships OFF, byte-identical; a default flip is a STOP for the licence with its movers listed (2 bounded rows, sweep legs 624/625/626's t1–t2 / refusal text, nothing else measured to move)** |

## The one thing to know first

**js-6's fix is right for a boot and wrong for a door.** The game's `Button.update` reads the cell the player was
BUILT in on every world's first live frame, not only the run's tick 0. Gated on `ticksCompleted === 0` (the brief's
scratch fix) the model still freezes a tick late after the L73 door; gated on `firstTickInWorld` (a boot, a door, a
death, an ending reboot) it matches the game at 0 px on both, measured on p4f. The switch is
`CONTACT_FIDELITY.arrivalButtonArm`, OFF. Its whole reachable set is ONE button (L74 `button@288,128`, the L73 door's
landing), so the only rows it can move are the three divergence legs that boot there (624/625/626).

## W0: the bank at base (`926cc2a86f`)

| row | command | result |
|---|---|---|
| base | `git checkout` of the harness branch at `926cc2a86f` | `926cc2a86f`; bootstrap `READY`, node v22.22.0; dev server `serve-nocache.py 9662` (pid 562) |
| identity block | `SEEDLING_PORT=9662 bash scripts/procgen/identity-block.sh .` (venv) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5` (`census/identity-base.txt`) |
| — generated set | the block's row collided with my own probe's box lock (it printed the lock notice); re-run alone at base: `node scripts/procgen/check-seedling-generated-set.mjs` | `OK` |
| — reference | the block read 4 DIFFER: the five non-wasm substrate submodules were uninitialised (`git submodule update --init` each); re-run at base | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`, md5 over sorted `status\tfullName` | **611**, `86af85259c2ab3a51b1f0ebb409743f4`, 0 non-pass |
| surface / constants / entities / profile | each `--check` | GREEN **284** · PASS **5,841** · PASS 558 · PASS 138 (both JSONs) |
| roster | `fixtures/tapes/index.json` `.tapes` | **277** |
| bounded vitest BEFORE | 78 files (`census/bounded-files.txt` minus the new test): the brief's list + every non-slow test naming `armButtonFallRocks`, `pendingButtonFalls`, `firstTickInWorld`, `CONTACT_FIDELITY_KEYS`/`_DEFAULTS`, `contactSchemaProps`, `fallRocksArmedBy`, `fallrock`/`FallRock`, `buttonFall` (`rg -a -l`), `solverBot*.test.js`, surface/constants | **3,184 / 3,184**, md5 `eaf68d6a35570414666cb06f88a03b32` |

## D1 — the arrival arm (PASS)

**The game, quoted** (`vendor/seedling`, read only):

```as3
// Puzzlements/Button.as:27-39
override public function update():void {
    var v:Vector.<Entity> = new Vector.<Entity>();
    collideTypesInto(hitables, x, y, v);          // hitables = ["Player", "Enemy", "Solid"]
    var tempCheck:Boolean = false;
    for each (var c:Entity in v) { if (c && !(c is Cover)) tempCheck = true; }
    activate = tempCheck;                          // -> activateAll(this, t, activate)
}
// Scenery/FallRock.as:103-118
public function fall():void { Game.setPersistence(tag, false); trigger = true;
    Game.freezeObjects = true; waitToFallTimer = waitToFallTimerMax; }
override public function set activate(a:Boolean):void { if (a && !_active) { fall(); _active = a; } }
```

and the order: `Game.loadlevel` adds the Player (`Game.as:2040`) before the buttons (`:2318`) and the fallrocks
(`:2330`), and `World.addUpdate` prepends, so the Button updates before the Player (`levelRun`'s SWIM T3 docblock).
On a world's first live frame (`Game.update`'s `blackCover <= 0` gate, `Game.as:880`) there is no previous tick: the
Button collides the BUILD cell, `fall()` freezes the frame, and the Player does not move on it.

**The model.** `armButtonFallRocks` had two call sites, both a post-move box: the frozen-tick path (`runFrozenTick`,
~l.13095) and the end of a live tick (~l.19573, `if (!next.transition)`). Neither sees the first frame. **Change**
(`levelRun.advance`, between the touch-lock snap and the `pendingButtonFalls` resolve, my region only):

```js
if (CONTACT_FIDELITY.arrivalButtonArm && firstTickInWorld && !noclip) {
    armButtonFallRocks(playerBoxAt(state.x, state.y));
}
```

so the resolve below runs the first live tick as the drop's frame A. `firstTickInWorld` is the existing per-world flag
(`true` at construction and after every `enterWorld`: boot, door, death reboot, ending reboot). `contactFidelity.js`:
`arrivalButtonArm: false` + `SEEDLING_ARRIVAL_BUTTON_ARM=0|1`.

**Re-measured, not copied** (`drivers/cmp.mjs`: replay a tape, compare the player per tick to a recorded game file):

| witness (L74LEG624 evidence) | game samples | OFF mismatched | ON mismatched |
|---|---|---|---|
| `tape-l74-624-on-plan` | 332 | t1 (Δy +0.8), t2 (Δy −1.35) | **0** |
| `tape-l74-624-lapse-plan` | 459 | t1, t2 | **0** |
| `tape-l74-624-lapse7-stance-88-72` | 592 | t1, t2 | **0** |
| `tape-l74-624-policy-walk-lapse` | 131 | t1, t2 | **0** |
| `tape-l74-postfall-reentry` ({74,2} staged, the rock already down) | 71 | 0 | 0 |

**Committed witnesses** (`fidelityL74Arrival.test.js`, 9 rows):

- `fixtures/chaser-witness/l74arrival-624-on-plan.json` — recorded on p4f headless (`SEEDLING_PORT=9662
  SEEDLING_ARRIVAL_BUTTON_ARM=1 node scripts/procgen/probe-seedling-chaser-mobiles.mjs --class=LavaRunner
  --file=<on-plan tape> --player-hits --record --name=l74arrival-624-on-plan`): clock `PASS` at shift exactly [0] over
  332 samples, LavaRunner 445 comparisons worst 1.3e-15. ON every sample 0 px; OFF exactly [1, 2].
- `fixtures/contact-witness/589.json` (the sweep's capture of this arrival, t0–t2; `contactFidelity.test.js`'s residue
  row "the ARRIVAL slice's region"): ON 0 px, OFF t1 (y 136 vs 135.2). Its row now names `arrivalButtonArm`; the
  "shipped defaults" row reads the process's live switch (OFF → still at t1), and a `SHORT` entry lets its 3-tick
  capture through the own-switch row's length guard.

**Mutants** (predicted, then made by copy + restore in a scratch worktree):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | the arm line removed (the switch reads nothing) | 624-ON, door-ON, 589-ON + `contactFidelity` 589 own-switch and all-ON rows | ✔ exactly those 5 red |
| M2 | js-6's gate `ticksCompleted === 0` for `firstTickInWorld` | the door-ON row only | ✔ exactly 1 red |

## D2 — the door arrival (PASS)

**Census** (`arrival-census.json`, `drivers/census.mjs`: every level built with all roles, every teleporter's landing
box against every presser rect, then `fallRocksArmedBy`): 116 levels, 280 doors, 34 pressers, 10 fallrocks.

| door | landing | presser under it | rock it drops |
|---|---|---|---|
| L37 `teleporter@288,0` → L38 | (152,296) | `buttonroom@144,288` (t4) | none |
| **L73 `teleporter@64,0` → L74** | **(296,136)** | **`button@288,128` (t0)** | **`fallrock@288,144` (tag 2)** |
| L108 `teleporter@0,32` → L107 | (296,184) | `buttonroom@288,176` (t0) | none |

Pressers that drop a rock at all: L29 `button@112,128` and L74 `button@288,128`. No pit fall lands in either room
(`fall-arrivals.txt`: the twelve `fallthrough` blocks go to L21, 17, 31, 30, 43, 49, 57, 69, 82, 84, 85, 0). A death
respawns at its world's ctor cell (`arriveAtRespawn`), which is that world's door landing or boot, so the switch's
reachable set is the one cell. Mid-room transition ticks landing on a button: the same three landings (a door's
landing cell is fixed by its `playerx`/`playery`).

**The witness** (`fixtures/chaser-witness/l74arrival-door-l73.json`, p4f headless, recorded ON): `tape-door-l73.json` =
leg 622's L73 staging (`forcedhit-l73-622-plan`'s boot (64,16), seam items), `up` t0–8 through `teleporter@64,0`,
`left` t110–130. The game: L73 to t3 (the lavarunner's forced hit at t2), L74 at **t4** at (296,136), **frozen at t5**,
moving at t6 (133.85: the unobserved release step + t6). ON: 131 samples, clock [0], every one at 0 px; LavaRunner 258
comparisons worst 0. OFF (the control): clock FAIL, parts at exactly t5–t6.

## D3 — movers (PASS; the switch ships OFF; the flip is a STOP with this list)

| row | OFF (head) | ON (`SEEDLING_ARRIVAL_BUTTON_ARM=1`) |
|---|---|---|
| identity block | every row = W0; non-`#` md5 `b4102fbb0b7b845ca5a3658a79bf8fd7`; reference ALL 7 + 5 MATCH | **identical to OFF**, every row; non-`#` md5 `b4102fbb0b7b845ca5a3658a79bf8fd7` (`census/identity-head-on.txt`) |
| tapeRunner | 611, `86af8525…`, 0 non-pass | 611, `86af8525…`, 0 non-pass (no roster tape boots on, or crosses into, a rock button: the six L29/L73/L74 boots are elsewhere) |
| survey steps 48 (L29) and 162 (L74), the two rock-button rooms | SOLVED 379 t / 321 t (= CI 38310171450) | **byte-equal** rows (timings aside), `census/survey-48-162-arm{0,1}.json` |
| bounded vitest (79 files) | **3,196 / 3,196**, md5 `08aba89b…`; W0's 3,184 rows identical by name and status, +12 new | **3,195 pass + 1 skip** (the defaults pin's `skipIf` on the env), 0 red |
| a real default flip (scratch worktree, `arrivalButtonArm: true`) | — | 2 rows move: `contactFidelity.test.js` "the shipped defaults" pin, `fidelityL74Arrival.test.js` "ships OFF" (the 589 defaults row follows the live switch) |

**Divergence legs that boot on the button** (`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`,
843 legs at head; by KEY): `level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144` (624), `… -> exit:out_teleporter_288_144`
(625), `… -> location:Level 074 - Darkshield` (626). Node solves (`drivers/leg.mjs` / `drivers/cap-solve.mjs`, 589's
captured staging: its seam items, slots `[0,1,3,2]`, BUDGET 2560, both anytime passes; `node-legs-624-626.log`):

| leg | OFF (head defaults) | ON |
|---|---|---|
| 624 | REFUSED: the danger map forbids (222.7,120.2), `lavarunner@208,96` | **the same text** (624 solves only with `strikeIframeLapse`, L74LEG624) |
| 625 | REFUSED: *"a sword press at tick 0 would fire its rect on a FROZEN tick (a button-dropped fallrock)"* — a model artifact of the late freeze | REFUSED: *"A* start tile (18,8) … (296,141) is not walkable"* — the exit `teleporter@288,144` lies under the fallen rock, the game's own state (L74LEG624 residue 6) |
| 626 (589's own request) | SOLVED 396 t (dashless; full REFUSED) | SOLVED 396 t, **the same keys** (full 399 t) |

626's plan on p4f (`tape-626-plan.json`, `game-626-{on,off}.json`, `drivers/probe-players.vs-committed.diff`): ON 0 px at
every tick but t396 (the collect tick, the last sample, identical in OFF: not this switch's); OFF also parts at t1–t2.

## The survey/sweep rows this moves (predicted from the census and node; CI to confirm)

| surface | row (by key) | before (CI) | after (switch ON) |
|---|---|---|---|
| survey | every step | 38310171450: 169 SOLVED / 51 REFUSED / 1 NO-EDGE / 1 NO-ARRIVAL | **unchanged** (no step boots on a rock button; 48 and 162 measured byte-equal) |
| sweep | 624 `level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144` | REFUSED (lapse OFF) | REFUSED, same (node); its plays' t1–t2 divergence gone |
| sweep | 625 `… -> exit:out_teleporter_288_144` | REFUSED | REFUSED, a different reason: the frozen-press artifact → the exit under the rock |
| sweep | 626 `… -> location:Level 074 - Darkshield` | per CI | node: SOLVED 396 t both ways, the same keys; the game play loses its t1–t2 divergence |

**Dispatches for the planner** (branch `claude/seedling-l74-arrival-button-r6b35a`):

1. Sweep A/B by key, the switch alone over the defaults:
   `seedling-divergence-sweep.yml` `-f mode=inv -f producer=solver -f keys='level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144|level_74 <- in_L73_64_0 -> exit:out_teleporter_288_144|level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield'`
   with `-f contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,fallRockPostFall,forecastSpeedByTerrain,arrivalButtonArm`
   and the same with `contact_fidelity` empty (the control). Expect 624/625 REFUSED both, 626 unchanged in verdict.
2. With the strike lapse too (624's solving configuration): the same keys, `contact_fidelity=<the list above>,strikeIframeLapse`.
   Expect 624 to solve (L74LEG624's 331 t) and its play to match the game at t1–t2 now.
3. The survey cannot take a switch (`seedling-survey.yml` has no `contact_fidelity` input): an ON survey needs a
   measurement commit flipping the default. Predicted byte-identical; if the planner wants it measured,
   `seedling-survey.yml -f through=end -f route=full -f only=48,162 -f base_run=38310171450` on such a commit.

## The JS arc's pins and what it must wire

- **Nothing to wire.** `seedlingContactSettings.js` derives one setting per `CONTACT_FIDELITY_KEYS` key
  (`contactFidelityHook.test.js` gained its row for `arrivalButtonArm` with no edit), so the setting
  `seedlingContactArrivalButtonArm` exists with default false and the sweep's `contact_fidelity=` reaches it.
- **No signature or contract changed** (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`
  untouched); `jsRuntimeDeclarations` and the JS pins in the bounded set are green OFF and ON.
- **Theirs to take:** js-6's residue is closed under the switch; their scratch fix (`ticksCompleted === 0`) should not
  be carried, because it misses the door (M2).

## Handed to the hammer arc

Nothing. No hammer-owned function is touched; the arm sits above `stepActivators`/`armButtonFallRocks`' existing
sites. Their C4b census on leg 624 sees the arrival freeze one tick earlier ON (t1, not t2); a press planned into t1
was already refused OFF ("a press into the arrival freeze").

## Deltas (base → head)

- Code: `levelRun.js` (one guarded call in `advance`, above the `pendingButtonFalls` resolve); `contactFidelity.js`
  (+1 switch `arrivalButtonArm`, OFF, env hook `SEEDLING_ARRIVAL_BUTTON_ARM`).
- Tests: `fidelityL74Arrival.test.js` (9 rows, new); `contactFidelity.test.js` (the defaults pin +`arrivalButtonArm:
  false`; 589's row names the switch; the defaults row reads the live switch; `SHORT` for 589's 3-tick capture; the
  pin's `skipIf` also on `SEEDLING_ARRIVAL_BUTTON_ARM`).
- Fixtures: `fixtures/chaser-witness/l74arrival-624-on-plan.json`, `fixtures/chaser-witness/l74arrival-door-l73.json`
  (no roster tape; nothing pins the chaser-witness directory).
- Censuses: constants `--write` (5,841 literals, 55 moved lines resealed; 0 new); surface `--write` (no change, 284).
- Docs: `seedling-bot-log.md` § *Seedling fidelity L74ARRIVAL*; `seedling-bot.md` paragraph after L74LEG624's; the
  regenerated reference (docs index, README count line).
- Evidence: `CC/docs/cloud-reports/seedling-fidelity-l74arrival-evidence/` (census, tapes, game rows, node logs,
  `drivers/`, `census/`).

## Byte-inertia (OFF)

| row | result |
|---|---|
| identity block at head, OFF | every row = W0 (the two base rows re-measured alone); non-`#` md5 `b4102fbb…`; six `--check`s unmoved; ON the same md5 |
| tapeRunner | 611, `86af8525…` OFF and ON |
| bounded vitest | W0's 3,184 rows byte-identical by name and status |
| reference | ALL 7 + 5 MATCH after the regeneration |

## What the brief got wrong (measured)

1. *"js-6's scratch fix — `if (ticksCompleted === 0 && !noclip) armButtonFallRocks(…)`"*: right for a boot, wrong for
   a door. `ticksCompleted` is per run; the first live frame is per WORLD (`firstTickInWorld`). M2 measures it.
2. *"js-6 measured four"* L74 leg-624 witness tapes: the evidence dir holds five tape/game pairs; four show t1–t2
   (fixed), and `postfall-reentry` (the rock already down) shows nothing to fix.
3. *"`armButtonFallRocks` … ~l.13095 (inside the `pendingButtonFalls` resolve)"*: l.13095 is inside `runFrozenTick`
   (the arm during someone else's freeze, refused by name); the resolve is at ~l.17837 in `advance`.
4. *"UNMEASURED: a DOOR arrival onto a button"*: it is the same button. The census finds exactly one rock-dropping
   button under any arrival, and its door (L73 `teleporter@64,0`) is the arrival the 624 legs stage.
5. The bootstrap's `READY` again left five non-wasm submodules uninitialised (the reference row reads 4 DIFFER until
   they are initialised).

## Residue

1. **The other two door landings on a presser** (L38 `buttonroom@144,288`, L107 `buttonroom@288,176`) have the same
   first-frame ordering for their activator (lock) publication; the model's `stepActivators` also runs from a post-move
   box at the end of a tick. Not a fallrock, so outside this switch; unwitnessed (no roster tape or leg is known to
   read it). A candidate for the activators' owner.
2. **626's last tick** (t396, the collect): game and model differ by (−0.59, −0.26) in both OFF and ON. Not this switch;
   probably the pickup's frame. Unattributed here.
3. **Leg 625's exit is under the rock**: ON the model refuses for the game's reason, but the sweep's inventory staging
   still names an exit the game closes (L74LEG624 residue 6).

## Rows to BANK

- `contactFidelity.js` `arrivalButtonArm: false` (the defaults pin).
- `fidelityL74Arrival.test.js` 9 rows; `contactFidelity.test.js` 65 rows (+2: 589's own-switch and mutant rows).
- Witnesses `l74arrival-624-on-plan` (332 samples), `l74arrival-door-l73` (131 samples).
- bounded vitest AFTER OFF: 79 files, 3,196, md5 `08aba89bd0b2a52ae91c06e0f5f7920e`; tapeRunner 611 `86af8525…`.
- surface GREEN 284 · constants PASS 5,841 · entities 558 · profile 138 · roster 277.
- CI (`JavaScript Unit Tests`): read at this report's own pushed head (`node scripts/procgen/ci-vitest-summary.mjs <head>`); the result is in the session's final message (this commit adds only the report and one evidence file over `44a1e13`).
