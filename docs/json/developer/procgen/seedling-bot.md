# The Seedling Real-Game Bot (v1)

How we drive the **real recompiled Seedling** with a scripted input tape and
check a JavaScript model of its physics against what the game actually did.

This is the region-atlas Phase 8 "real-game surface". The maze-surface bot
([maze.md](./maze.md)) proves generated worlds beatable on the *projected*
map; this proves things about the **original game**, which is the only
oracle that can say "beatable in the actual game". Plan:
`CC/docs/plans/region-atlas-plan.md` §Phase 8. Brief and full recon trail:
`CC/docs/plans/seedling-bot-v1-opus-kickoff.md`.

**v1 scope:** collision disabled, movement only, one level. The ladder above
it is v2 collision/pathing → v3 item-gated terrain → v4 puzzles → v5
enemies. Each rung lands in JavaScript first and then in the Seedling
source; the JS side is the iteration surface and is *never* a load-bearing
stratum for a beatability claim.

## The shape: two implementations, one tape, compared

```
        tape (JSON: tick-indexed hold spans)
         │                              │
         ▼                              ▼
  seedlingDemo (JS)              Bot.as (compiled into the game)
  playerPhysicsV1                dispatches KeyboardEvents at FP.stage
         │                              │
         ▼                              ▼
   observation stream  ==EXACT==  observation stream   ← the differential
```

Both sides consume the *same* tape and emit the *same* observation-stream
shape, so the comparison is about physics rather than bookkeeping. The
game's streams are recorded and **committed** as fixtures, because the wasm
artifact is machine-local forever (there is no CI build in either repo) —
that way vitest checks JS-against-the-real-game on every CI run, and the
local verify script only has to answer "are the recordings still current?".

As of 2026-07-30 all five fixtures match **exactly** — 220 ticks, bit for
bit, float noise included.

## Where things live

| Piece | Path |
|---|---|
| Tape format, key table, stream differ | `frontend/modules/seedlingDemo/tapeFormat.js` |
| Physics transcription (v1) | `frontend/modules/seedlingDemo/playerPhysicsV1.js` |
| Tape replay → observation stream | `frontend/modules/seedlingDemo/tapeRunner.js` |
| Targets → tape synthesis | `frontend/modules/seedlingDemo/botDriverV1.js` |
| Tapes + oracle recordings | `frontend/modules/seedlingDemo/fixtures/` |
| The differential harness | `scripts/procgen/verify-seedling-bot-differential.mjs` |
| Real-GPU browser driver | `scripts/procgen/seedling-bot-replay-win.py` |
| The in-game bot | `~/CC/seedling` branch `bot`, `src/Bot.as` |
| Build script + pipeline recipe | `~/CC/seedling_bot_build/build_bot.sh` |

The module is engine-only — no panel, no substrate registration, therefore
no `__BUNDLED_MODULES__` entry. `runnerDemo` is the structural precedent.

## The tape

Tick-indexed **hold spans**, `from` inclusive / `to` exclusive:

```json
{ "tape_version": 1, "game": "seedling",
  "boot": { "level": 0, "x": 80, "y": 128 }, "noclip": true,
  "tick_count": 40,
  "inputs": [ { "key": "right", "from": 0, "to": 30 } ] }
```

Spans rather than per-tick key states because Seedling reads input three
ways and the tape must express all of them: movement is `Input.check`
(held), item use is `Input.pressed` (down edge), and **dialogue/NPC/seal is
`Input.released`** — a full down-then-up. A length-1 span yields a press
edge on tick `from` and a release edge on tick `to`, so it covers all three.

Key names map to raw AS3 keycodes through one canonical table asserted by
both consumers (`Player.as:59`). `M`, `R`, `Esc` and `W` are not in the
vocabulary at all and are rejected by name: `Game.update` reads the first
three *before* entities and some branches call `Input.clear()` or rebuild
the world, and `W` opens an external URL.

Validation is loud everywhere — `noclip` has no default, unknown keys
throw, and overlapping spans on one key are rejected (FlashPunk's
`_key[code]` guard makes a second KEY_DOWN a no-op and the first KEY_UP
clears the hold, so overlapping holds do not compose the way an author
would assume).

## How the game is driven

`Bot.as` is a **generic, data-driven tape interpreter**, deliberately dumb.
One AS3 edit costs the entire pipeline (mxmlc → bridge injection →
SWFRecomp's ~165 MB C regeneration → an effectively cold emcc pass →
deploy), so behaviour lives in tapes and in JS, and the interpreter is
compiled in once per ladder rung.

Input synthesis needs no patch. FlashPunk keeps its key state in
`private static` vectors with no setter, but `Input.enable()` registers its
listeners on `FP.stage`, so dispatching a `KeyboardEvent` there drives input
on exactly the hardware path. That holds in the *recompiled* runtime too,
not just Flash Player: its own key delivery ends at the same
`avm2_dispatch_event`.

The hook is the top of `Main.update()`, **above `super.update()`** — after
the previous frame's `Input.update()` cleared the edge queues and before
`World.update()` reaches `Player.input()`, so an injected event is live for
exactly one frame and self-clears.

Control surface, registered by the bot itself as ExternalInterface
callbacks and auto-wrapped by the page shim as `__swfBridge.game.*`:
`botLoadTape`, `botStart`, `botStatus`, `botDrain`, `botReset`. This needs
**no** change to `BridgeGeneric`, to `games/seedling.json`, or to the
one-configure-per-instance fence.

## The two contracts that are easy to get wrong

**RECORD-THEN-ACT.** The only hook is *before* the movement, so the bot
records the state it can see — the result of the previous tick — and then
dispatches this tick's edges. Observation `t` is the state after exactly
`t` completed movement ticks: index 0 is the boot position under no input,
and an N-tick tape yields **N+1** observations. `tapeRunner.js` mirrors this
exactly. Getting it off by one makes every differential red for a reason
that has nothing to do with physics.

**Dead frames must not consume tape.** `Game.update` skips `super.update()`
entirely while `blackCover > 0` (~18-20 frames after every world load), and
`Mobile.mobileUpdate` skips the whole friction/input/move block while
`Game.freezeObjects`. Nothing moves on those frames, so the tick counter
gates on both. The fade frame count varies slightly run to run; that is
fine and observed, because dead frames are skipped rather than counted into
the tape.

## The physics, and three things the source will mislead you about

`playerPhysicsV1.js` is a transcription, not a model. Per tick:
`getState()` → friction/speed selection → `friction(); input(); moveX();
moveY()` → world clamp.

1. **`input()` OVERSHOOTS; it is not a clamp.** The branch is
   `if (v.x < moveSpeed) v.x += accel` with `accel === moveSpeed` — a
   threshold test followed by a full-magnitude add. Velocity therefore
   exceeds `moveSpeed` on most ticks and settles into a ~3-tick limit cycle
   (0.80 → 1.35 → 1.10 → 0.85 → 1.40 …) peaking near *twice* the "cap". The
   original design brief described this as "one held frame saturates the
   axis, velocity is effectively binary"; a port written to that diverges
   from the game on tick 1. **The real game confirmed the limit cycle**:
   holding RIGHT it reports `x = 88, 92.09999999999998, 99.15` at ticks
   0/4/10 and the JS engine emits the same doubles.
2. **Friction is VECTOR-length, not per-axis.** `v.normalize(max(v.length -
   f, 0))` then snap components under 0.05 to zero. Both axes accelerate
   independently but only one friction quantum leaves the combined length,
   so a diagonal covers ~√2 the ground of an axis-aligned run. A per-axis
   port diverges the moment both axes move.
3. **`Player` OVERRIDES `Mobile.moveX/moveY`.** The base-class movers are
   dead for the player, so the noclip flag has to live in the Player
   overrides — patching `Mobile` is a silent no-op.

Two more the *oracle* caught that reading the source had not:

4. **The clamp reads the LEVEL size, not the screen size.** `Game.as:1854`
   overwrites `FP.width`/`FP.height` from the level file on every load, so
   level 0 (`OverWorld.oel`, 320×320) clamps to x ∈ [2,318] — not the
   [2,158] that `Main.as`'s 160×160 screen implies.
5. **The player does not spawn at the constructor's coordinates.**
   `Player.as:357` re-centres onto the tile (`+Tile.w/2, +Tile.h/2`), so
   `new Game(0, 80, 128)` puts the entity at **(88, 136)**. A tape's `boot`
   block carries the *constructor* args and the offset is transcribed on
   top. (`Game.as:2034-2037` can override the spawn entirely from a
   `<player>` object in the level XML; level 0 has none, a later level may.)

**Noclip does not bypass terrain speed.** `getState()` types the tile under
the player every tick independently of collision, and `moveSpeed` is
selected from it. The JS engine therefore takes a pluggable
`terrainStateAt()` seam stubbed to ground, rather than a hardcoded `0.8`:
with the seam in place a tape that strays onto water or stairs produces a
loud differential mismatch instead of the assumption hiding in a constant.

## Running it

```bash
# 1. dev server at the REPO ROOT (check first — do not double-start)
ss -ltn | grep ":8000" || python3 -m http.server 8000

# 2. the staleness gate: live game vs the committed recordings
node scripts/procgen/verify-seedling-bot-differential.mjs --win

# 3. re-record after a deliberate physics or fixture change
node scripts/procgen/verify-seedling-bot-differential.mjs --record --win
```

SKIPs (exit 0) when the wasm artifact is absent, like every other seedling
verifier — CI has no wasm and stays green.

### Always pass `--win`

WSL's own Chromium is **SwiftShader (software)**; SWFRecomp-CC's `CLAUDE.md`
is explicit that it must never be used for performance work. Seedling runs
at **~0.5 frames/sec** on it, so a 140-tick tape takes 6½ minutes and a
fixture sweep takes twenty. `--win` drives real-GPU Windows Chrome from WSL
and gets **~25 fps** — the same sweep in ~50 seconds, a ~44x speedup. The
physics is identical either way; a deterministic tick loop does not care
what draws it.

Recipe and interop rules:
SWFRecomp-CC `tools/divergence/perf/WINDOWS_PLAYWRIGHT_FROM_WSL.md`. Two
notes from using it here:

- That doc says to call `python.exe`. On this box it is not on WSL's PATH
  and the WindowsApps entry is an uninstalled Store alias — **`py.exe
  -3.12`** is the working equivalent.
- Windows Python cannot take Linux paths, so the driver and its JSON files
  are staged under `C:\playwright\` (= `/mnt/c/playwright/`).
  `seedling-bot-replay-win.py` is only a browser driver; all fixture and
  diff logic stays on the Linux side so the tape format has one
  implementation.

Each replay prints its WebGPU adapter, so a run that silently fell back to
software rendering is visible rather than just mysteriously slow.

**Every tape gets a fresh page.** `botReset` forgets the tape but cannot
rewind the *game* — the player stays where the last tape left them, so a
second tape on the same page starts from the wrong position and records
plausible garbage.

## Rebuilding the game after an AS3 change

`~/CC/seedling_bot_build/build_bot.sh` builds the SWF; its header documents
the rest (inject → SWFRecomp → `build_wasm_avm2.sh` → `deploy_wasm_avm2.sh`
→ copy into `frontend/modules/flashPanel/wasm/`, which is gitignored).
Budget roughly ten minutes and **batch AS3 edits** — that cost is the entire
reason `Bot.as` is a generic interpreter.

Traps, all real: the `.o` cache keys on mtime not flags, so `FRESH=1` after
any define change; use `run-SWFRecomp.sh` rather than raw SWFRecomp or risk
a WSL2 VM `bad_alloc`; `deploy_wasm_avm2.sh` stages the *teleport* SWF as
`test.swf` unless you pass `DEMO_SWF`; mxmlc strips `trace()` without
`-omit-trace-statements=false`; and mxmlc's flow analysis does not credit
returns inside `try`/`catch`, so such functions need a terminal return.

## Gates, and what would make them vacuous

- **G1 (CI, vitest):** every tape's JS stream equals its committed oracle
  recording, exactly. Plus the hand-derived physics cases — a *second*
  independent stratum, since their values come from reading the AS3 rather
  than from recording anything.
- **G2 (local, verify script):** live wasm replay matches the recordings,
  and a live bot-driver task lands the real game on its target per the
  **game's own** drained observations, not the driver's internal state.

Both are quantitatively pinned (observation counts per tape), because every
positional assertion is satisfiable by a bot that teleports. Exactness is
deliberate: AS3 `Number`, JS numbers and the recompiled runtime are all
IEEE-754 doubles, so a mismatch is a transcription defect to investigate,
not a tolerance to configure.

The fixture leg is only meaningful while the expectations are **oracle
recordings**. `fixtures/regenerate.mjs` writes `*.provisional.json` from our
own engine, which is a bootstrap for a not-yet-recorded fixture and a change
detector only — a verifier sharing the generator's assumptions verifies
nothing. A test pins that no current fixture is riding that path.

## Dead ends, recorded so nobody re-chases them

- **A black canvas means nothing here.** The untouched teleport page also
  reads 0% non-black under headless WebGPU; it is the readback, not the
  game.
- **`A valid external Instance reference no longer exists`**, repeated every
  frame, is just an unconfigured `BridgeGeneric`. It appears in the teleport
  build too and is unrelated to whether the game is ticking.
- **A fixed replay timeout looks exactly like a dead bot.** At ~0.5 fps the
  `blackCover` fade alone outlasts a 60s deadline, which is how the first
  run presented and where most of the diagnosis time went. Deadlines scale
  with tape length.
- **The world clamp is unreachable in level 0.** The original `clamp-left`
  fixture walked far enough left that the game loaded an adjacent level —
  the recording showed `level=94` at tick 61 — so it was silently testing
  room transitions. It was replaced by `shuffle-stop`; the clamp keeps its
  hand-derived unit case. The `level` field in the observation stream is
  what caught this, which is why v1 carries it.
- **Cutscenes are already skipped**, and not by accident: the intro cutscene
  fires only from the `level < 0` branch (`Game.as:765-773`), and the
  cherry-picked teleport boot passes an explicit level 0. The bot reports
  `receive_input`/`saw_input_refused` in `botStatus` rather than stalling,
  so a cutscene that *did* fire would be named rather than silent.
