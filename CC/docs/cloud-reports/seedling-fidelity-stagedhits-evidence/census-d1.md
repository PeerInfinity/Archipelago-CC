# STAGEDHITS D1 — the census: where the player's damage is reset, read or staged

Base `8654f02a4c`. Line numbers at that base. Read-only for the JS arc's files.

## The model's state, and what the game exposes

| state | model (`levelRun`) | game (`Player.as`) | on `botStatus`? |
|---|---|---|---|
| `hits` | `damage.hits` (`levelRun.js:2855`, `createPlayerDamage`) | `Player.hits` | **yes**, `hits` (`Bot.as:2124`) |
| i-frame | `damage.hitsTimer` (20 on a landed hit, `PLAYER_DAMAGE.hitsTimerMax`) | `Player.hitsTimer` | **yes**, `hits_timer` (`Bot.as:2125`) |
| parked facing | `damage.directionFace` (−1 none) | `Player.directionFace` (`Player.as:62`, written at `:1500`) | **no** (`direction` is private, `Bot.as:597`); `botMobiles`' player `anim` shows the facing |
| `hitByDarkStuff` | per ENEMY body (`levelRun.js:321-343`) | `Enemy.hitByDarkStuff` | per body on `botMobiles` (`hit_by_dark_stuff`) |
| `hitsMax` | `inventory.hitsMax` (seam / items) | `Main.hitsMax` (static) | `items.hitsMax` — already staged (`seam.hits_max`) |

**Decision: hits + the i-frame timer, plus an optional parked facing.**
- `hits_timer` is not cosmetic. It gates the ARROWS (`canSteer`, `Player.as:1528`) and swallows the next hit from any source. A staging that drops it plans steering the game ignores.
- `direction_face` moves the facing only (`playerPhysicsV2.nextDirection`), never a position. The game does not report it, so it is optional (absent = −1).
- `hitByDarkStuff` is the dark-stuff latch on an ENEMY, not player state. A staging rebuilds each body with its own latch reset. Out of this slice.

## Every reset / read / stage point

| # | site | what it does to hits today |
|---|---|---|
| 1 | `tapeRunner.createRunForStaging` (`tapeRunner.js:362`) → `createLevelRun` | THE construction; no damage field, so every staged run starts at `createPlayerDamage()` (0/0/−1) (`levelRun.js:2855`) |
| 2 | `levelRun` world swap (`levelRun.js:4903`, door AND death) | `damage = createPlayerDamage()`; the game's new `Player` agrees |
| 3 | `levelRun` BobBoss transition (`levelRun.js:14017`) | `hits: 0` (the game's own write) |
| 4 | `forcedHit.worldHitsOf` (`forcedHit.js:95`) | reads the LEDGER: the last `playerHits` row after the last swap, else 0 |
| 5 | `solverBot` rung 6 (`solverBot.js:19625-19629`) | budget `hitsNow: worldHitsOf(run).hits`, `hitsMax` from the inventory; the death check is `playerHit`'s own `hits >= hitsMax` on the fork |
| 6 | `solverBot` result (`solverBot.js:21412`) | `damage: worldHitsOf(run)` when a forced crossing billed |
| 7 | `wasmArrival.stagingFromWasmArrival` (`wasmArrival.js:258`) | ARRIVAL staging, read at the begin record (`seedlingWasmPlayback.js:1041`: `game_time === save.time`) → a new `Player`, hits 0. Correct by construction |
| 8 | `wasmArrival.continuationSolveRequest` (`wasmArrival.js:492`) | **RE-STAGE (a)**: the arrival + every shipped key replayed (the shadow). The replay RE-BILLS the hit (FORCEDHIT D2: fork622 + up,up → hits 1). Nothing compares the shadow's hits with the game's |
| 9 | `wasmDelivery.stageItems` / `deliveryRefusal` (`wasmDelivery.js:193`, `:279`) | **RE-STAGE (a)**: items staged at the arrival, prefix replayed. Its `witness` (`wasmDelivery.js:229`) compares the hit COUNT of two MODEL runs (with/without the item), never the game's |
| 10 | `wasmPlayback.shadowMismatch` (`wasmPlayback.js:699`) | level/x/y/primary only — **no hits, no hits_timer** |
| 11 | `wasmPlayback.adoptionRefusal` (`wasmPlayback.js:445`) | a cold adoption REFUSES `hits || hits_timer` (`player-state` clause) |
| 12 | `wasmPlayback.forcedHitContinuationRefusal` (`wasmPlayback.js:662`; called `seedlingWasmPlayback.js:1105`) | the interim guard: `damage.hits > 0` → refused, served from a forced RE-ARRIVAL (a door's reset) |
| 13 | `jsRuntimeCore.rebootInPlace` (`jsRuntimeCore.js:672`) → `boot` (`:459`) | **RE-STAGE (b)**: a fresh staging at the player's position (an item flag, a key). Hits 0, and the JS page's `botStatus` (`jsRuntimeCore.js:1000`) exposes no `hits` |

## What this means for the two re-stage points

- **(a) The wasm engine's continuation and delivery re-stage AT THE ARRIVAL and replay the prefix.** The hit is re-billed by the replay, so staging the live hits there would bill it TWICE. What is missing is the CHECK against the game: `shadowMismatch` has no hits row. → `stagedHitsMismatch(shadowRun, botStatus)`.
- **(b) An in-place re-stage has no prefix.** `rebootInPlace` boots a fresh world at the player's position, and so would a cold adoption. Here the game's damage must be STAGED, from `botStatus` at that point. → `player_damage`.
- **The game's own mechanics, measured from the AS3:** `botStart` rebuilds the world only when the boot is not the current ctor args (`Bot.as:1843`, `atBootPosition`). A continuation tape with the arrival's boot takes the SKIP path, so the game keeps its `Player` and its hits. The model's re-stage must reproduce that.
- **Leg 622 itself never re-stages in L73.** Its knockback carries the player through the door at t4 whatever is held (`up up` / `· ·` / `left left` all cross by t4–t10). `down+right ×2` (622's own last two keys, played first) takes the same t2 hit and leaves the player at rest in L73 (68.5005, 20.5005) from t10, i-frame 11 → a second hit at t21. That is the same-world continuation D3 drives.
