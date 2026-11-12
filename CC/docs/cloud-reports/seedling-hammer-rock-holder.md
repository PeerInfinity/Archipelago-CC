# Seedling hammer phase: slice ROCK-HOLDER (`seedling-hammer-rock-holder`)

Planner: `seedling-hammer-phase-planning-5`. ⚖ The user's ruling (2026-11-12): *"Witness, then slice (Recommended)"*.

## 1. Start SHA, head, branch

- Base: `origin/main` @ `add369e82fc41b0a88505c74b665284ac7337269`. The brief quoted `737a451f50` as the acceptance-md5
  reference. No solver code changed here, so I did not take the md5.
- Branch: `claude/seedling-rock-holder-switch-iq5jyb`.
- Evidence commit: `b41f8945`. The head is this report's commit, the one after it.

## 2. The answer first

**Status: BLOCKED. The game confirms it; the model does not. This is fidelity's class.** Per the brief I stopped after the
witness, so this slice adds no switch and no build.

- **The game (p4g wasm) confirms it.** I booted L28 at (136,296), re-measure-2 Arm A′'s position, with the rope's
  {28,0} and the rock's {28,1} cleared. The grass lock (`grasslock@176,208`) opens and the player walks through its
  tile, from y 233.4 to 191.7, with 0 hits. The lock fades for 100 frames from the first frame and opens at **t102**,
  writing its own tag {28,2}. In the control (nothing cleared) the player stalls at y 226.04.
- **The model (`levelRun`) disagrees.** It builds the rock already fallen (`postFall: true`, a Solid on its cell), but
  `button@112,240` reads `down: false` and the lock never opens. The player stalls at y 226.04, exactly as in the
  control. An in-run fall (rope cut in play, the rock lands at t155) gives the same result after 300 more ticks.
- **The cause** is in `levelRun.js:1621` `movingSolidsNow()`, the list of things that can press a button
  (`stepActivators` → `pressedGroups` / `presserDown`). It contains pushable blocks, crushers and ice turrets, but not
  a landed `FallRock`. In the game, a landed `FallRock` is `type = "Solid"` (`FallRock.as:44,83`), and `Button.update`
  counts a Solid as a press (`Button.as:17,31`).
- **The switch:** none was added (I stopped). **L28 solved / hitless:** no. The refusal reproduces in node, word for
  word.
- **The one thing to know first:** the solver is not missing anything. It reads the model correctly, and the model
  says the button is not pressed. The fix belongs in `levelRun.movingSolidsNow`, which is fidelity's file and outside
  this slice. A solver-side "holder on the button" switch would contradict the model's own `stepActivators`, and the
  first replay would expose the difference.

## 3. The witness

### The game (p4g, headless logic-only channel, a fresh page per tape)

Two tapes, built by `build-l28-walk-tape.mjs` from one list of inputs.

- **Leg A (ticks 0–85):** steered greedily, closed loop against the model, along the bot's own `planTilePath` tiles
  `8,18 8,17 9,17 9,16 10,16 11,16 11,15 11,14`. It ends at the tile below the lock.
- **Then:** `up` held for 54 ticks (the 30 the crossing needs plus 24 more), then 10 idle ticks. 150 ticks in total.

Played by `play-l28-witness.mjs`; the raw results are in `witness-l28.json`, with every sampled tick.

| tape | persistence | game: min y / end | game hits | game cleared at end | model: min y / end |
|---|---|---|---|---|---|
| `l28-rock-holder-walk` | {28,0}, {28,1} | **191.71** (through the lock) | 0 | [0, 1, **2**] | 226.04 (stalled) |
| `l28-rock-holder-control` | none | 226.04 (stalled) | 0 | [] | 226.04 (stalled) |

- The two runs match tick for tick through t90, for example `84:236.33 … 90:229.02`.
- In the walk: tag 2 is first held at **t102** (y 225.39), and the player first goes above y 224 at t104.
- `Lock.activationStep` (`Lock.as`) lowers the lock's alpha by 0.01 per frame while it is active, then `turnOff()`
  runs `setPersistence(tag, false)`. So the group was published from the first frame: the rock pressed the button at
  boot.
- **"The button reads pressed" is inferred, not read.** `botStatus` exposes no activator state. But the button is L28's
  only presser in group 0, and the lock is that group's only responder.

### The model (node)

| probe | what it shows |
|---|---|
| `probe-model-l28.mjs` (`.out.txt`) | With {28,0} and {28,1} cleared, the rock row is `postFall: true`, yet after 120 idle ticks the button is `down: false` and the lock is `alpha: 1, open: false`. |
| `probe-model-l28-live-fall.mjs` (`.out.txt`) | Rope cut in play from the L25 arrival: `ropePulls` t155; `rockFalls` `{fallrock@112,240, t155, flag {28,1}, deadFrames 181}`; at t470 the button is still `down: false` and nothing is open. |
| `probe-solver-l28.mjs` (`.out.txt`) | `reach-exit (304,16)` from (136,296) with {28,0} and {28,1} cleared reproduces Arm A′'s refusal word for word: `no REACHABLE stance inside button@112,240 … from (136,296) … grasslock@176,208 … NO block in this room can reach it …`. |

## 4. The design and the change; OFF identity

Nothing was built, because the brief says to stop at a model gap. Here is the design I would hand to fidelity, stated
but not built:

- **Where the gap is.** `levelRun.js` `movingSolidsNow()` (around line 1621) feeds `stepActivators(…, {movingSolids})`,
  which feeds `pressedGroups` and `presserDown`. Add each `fallRockStateFor(level)` entry with `landed === true` at its
  `fallRockRect`. The same addition belongs in the `FallRockLarge` arena rock's live row, which is likewise a Solid once
  landed. Name the switch in fidelity's own way: `CONTACT_FIDELITY.<name>`, `SEEDLING_<NAME>`, landing OFF.
- **The rule it follows:** the game's own. `Button.update` collides `["Player","Enemy","Solid"]` and excludes only a
  `Cover`. It is general (a landed `FallRock` is a Solid in every room) and names no level.
- **The same list also feeds `occupied`** (`Lock.returnToNormal` / `Cover` occupancy). A rock resting in a lock's or
  cover's cell holds it open in the game too, and that is correct for the same reason.
- **After that flip, the solver may need no change at all.** The button is pressed from the first frame, so the lock is
  already fading and the solver never sees "a presser that needs a stance". What it does need: tolerate a lock that
  opens at t≈102. That means a wait, or a plan that reaches the lock late. On the game, leg A takes 86 ticks, so the
  walk reaches the lock about 16 ticks before it opens. Measure that once fidelity's switch lands.
- **OFF identity:** not applicable. No solver or model file changed.

## 5. Rows and bounded vitest runs

None. With no switch built there are no OFF/ON rows to write, so I ran no vitest. Only the evidence scripts ran. The
measured rows that fidelity's slice should pin are:

- OFF: `probe-solver-l28` refuses as above.
- OFF: the model stalls at y 226.04 on `l28-rock-holder-walk`.
- ON: the model replays `l28-rock-holder-walk` to the game's y 191.71, with tag 2 at t102.
- Both: `l28-rock-holder-control` stalls at y 226.04.

## 6. Page play

Not done; there is no ON plan to play. The game witness tapes above were played on fresh p4g pages, and they are what
fidelity can replay.

## 7. Census (seed 1, `seedling-divergence-legs.mjs`, 934 legs)

`census-rock-on-button.mjs` (`.out.txt`) checks every level a leg touches for a `FallRock` cell that overlaps a
presser's rect.

- **Only one level has the geometry: L28**, with `fallrock@112,240` (group 1, tag 1) on `button@112,240` (group 0).
- L28 has 8 legs. In only one does the AP route hold the rope's flag at its sphere:
  **`level_28__r1c18 <- in_L30_0_128 -> exit:out_teleporter_304_16`** (sphere 3.5).
- The default sweep does **not** stage that flag. `--carry-route-flags` stages `flag:L28:0` alone, and the model then
  **throws** ("rope@160,64 … boots PULLED … Declare both tags or neither"), because the rock's {28,1} is not an AP flag.
- That leg also arrives at (288,16), next to the L30 door, so it never needs the lock.
- **So no seed-1 sweep leg can move on this switch.** The legs it would move are whole-game walks like Arm A′:
  `level_28__r11c4`'s arrival at (128,288) → state (136,296), heading for the L30 door. The sweep has no such leg; the
  r11c4 leg's goal is `out_teleporter_128_304`.

## 8. What the brief got wrong (measured)

1. **"The solver misses that the button is already held."** The model misses it. The solver reads the model's
   `stepActivators` correctly: `button@112,240` is `down: false` both at boot (rock fallen) and after an in-run fall.
2. **"grasslock@176,208 reads open" once the rope is cut.** Not at once. The lock fades for 100 frames, opens at t102,
   and only then writes {28,2}. A plan has to wait for it.
3. **The arrival coordinates.** Arm A′'s "(136,296)" is `run.state`. The staging boot that gives it is (128,288),
   because the run reads boot + 8. A probe booted at (136,296) lands at state (144,304), which leaves the player
   unable to move. It still refuses with the same stance message, so the error is easy to miss.
4. **A rope-flag-only staging is not a valid model state.** {28,0} without {28,1} makes `levelRun` throw. Any harness
   that carries the AP flag alone (`--carry-route-flags`) cannot boot L28 past the cut.

## 9. Residue

- **Fidelity:** the slice from §4 (a landed `FallRock` as a presser and occupant in `movingSolidsNow`), with the game
  tapes here as its witnesses. Fidelity's report should also give a census of every landed-Solid family the list
  leaves out.
- **Once fidelity's switch is ON:** re-run `probe-solver-l28.mjs`. If it still refuses, the solver needs to wait out
  the 100-frame fade (§4). Then do this slice's page play of the full (8,18) → (19,1) walk. North of the lock that walk
  passes `bobsoldier@264,168`, which the solver kills on the way to the door (its own plan, in the `cleared=[]` row of
  `probe-solver-l28.out.txt`).
- **A separate oddity worth one look:** with nothing cleared, the solver does not refuse at the stance. It plans
  `kill (bobsoldier@264,168)` with waypoint 3 at (184,184), straight through the closed lock, and stalls at
  (183.5,226.0) ("not reached within 400 ticks"). Its corridor treats a closed grass lock as passable.
- **The census harness:** `--carry-route-flags` should stage a rope's rock tags along with the rope's flag (§8.4), or
  name the leg as skipped.
- **Tidy-up:** I removed the dev server I started (by PID). The seed-2 preset was never generated, because the leg
  reproduces in node from the staging alone. The leg jsonl files are scratch only.
- **Planner follow-ups:** none arrived during the session.
