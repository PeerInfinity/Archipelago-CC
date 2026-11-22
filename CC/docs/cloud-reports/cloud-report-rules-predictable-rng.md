# Cloud report: `rules-predictable-rng`: is Seedling's gameplay RNG predictable in every runtime, and what would make it so?

Branch `claude/seedling-rng-predictability-jgszx8` (REPORT ONLY: evidence and tools; no rule/preset/atlas/table/solver/levelRun/
`CONTACT_FIDELITY`/level-data/AS3/submodule/workflow change).

Base: `git rev-parse origin/main` = `c1b250e6380746f579b509132868c0d7818de560` (past the brief's floor 3c602f965d).
AS3 read: `vendor/seedling` @ `ccdf189776` (the default build p4g's source). Game: wasm `seedling_bot_ap_p4g`, one FRESH page per
arm, headless logic-only (`__swfGpu = {"lost":1,"stalls":0}`), dev server :8000, box lock taken per run. Evidence:
`CC/docs/cloud-reports/rules-predictable-rng-evidence/` (below: `ev/`).

## Answer table

| # | question | answer | evidence |
|---|---|---|---|
| 1 | Census of gameplay entropy in the AS3 | **9 GAMEPLAY sites, all in two rooms: L112 (FinalBoss + RockFall, 5 sites) and L57 (TentacleBeast, 4 sites).** Also 6 ADVANCER sites (gameplay-stream draws whose value is dead or render-only, but whose COUNT moves every later gameplay draw), 1 SAVE-ONLY (grass blades → a medal counter), 40 COSMETIC (already `Rng.cos()` or FP's own generator), 12 ENGINE (`getTimer` frame pacing; nothing reads `FP.elapsed`). No time or frame counter is used as a random number | `ev/census.json` (`tools/census.py`; fails on any unclassified live site, 0 now). §1 |
| 2a | wasm (p4g): seeded? | **Yes, at build time.** One global LFSR; boot state is `MOCK_DATE_TIME` (`BOOT_SEED` 1486967168). Nothing reseeds it in normal play: not a room entry, not a save, not a load. Only `Bot.botStart` reseeds (`Bot.as:1893-1895`), from a tape's `rng {seed, split}` | §2.1 |
| 2b | wasm normal play: deterministic? | **GAME YES (reproducible), NO (not learnable).** Two fresh pages, no tape: the same L0 begin state (743483584) and the same live state (1410304934) after 20 s. The same tape with `seed 0` ("inherit the page") on two fresh pages: **identical** begins, a death rebuild at t731 on both, the same end. But that inherited stream is not seed 101's, so the seed-101 0-hit Owl plan **dies** on it. The stream at a room's entry is the sum of every gameplay draw since boot (rooms built, deaths, fights), not of the room | `ev/logs/determinism-run1.json` (`normal-1/2`, `inherit-1/2`) |
| 2c | what moves the stream, measured | **Only draws, never time.** Boot L111 seed 101 → walk into L112: L112 begins at state **101**, like a direct boot, because L111's build draws nothing. The 1830 in-room ticks then match the direct boot **with no divergence**, 0 hits, `112:0`+`112:1`, L113. The same walk after **120 idle ticks** in L111: the same state 101 and the same win. A **death rebuild** of L112 (t731, inherit arm) re-enters at a new state (1260324488): a re-entry is a different fight | `ev/logs/determinism-run1.json` (`walkin-idle`), `determinism-run2.json` (`direct`, `walkin`) |
| 2d | where the harness's `rng {seed, split}` acts | `Bot.botStart`, `Bot.as:1893-1895` (after the outgoing world's last update, before the deferred build: `Game.begin` → `loadlevel`). **A non-bot page cannot use that path**: it arms a tape, swaps the world and rebuilds the room. The runtime's state is not exported to JS (`swfmodern.Rng` is reachable from AS3 only) | §2.1 |
| 2e | JS runtime (`levelRun`, under `jsRuntimeCore`) | **Predictable ONLY in the boot room of a seeded tape; refuses everywhere else.** Seeded, the same tape gives the same run twice. With no `rng` block (normal play) the Owl fight throws at t0; seed 0 throws ("an ORIGIN this model does not have"); a walk-in from L111 throws at t7 ("would open in level 112 after a boot in level 111"). TentacleBeast: the fight verb's gate reports `has no declared seed for this room`. The JS runtime has no stream of its own for normal play | `ev/logs/js-runtime-rng.json` (`tools/js-runtime-rng.mjs`) |
| 2f | Flash / Ruffle | **UNWITNESSED on the game; NOT predictable by construction.** The repo ships no SWF: Ruffle 0.7.1 (`ruffleCdn.js`) plays one the user supplies. There `swfmodern.Rng` is absent, so `Rng.cos()` falls back to `Math.random()` (`Rng.as:105-111`): one stream, seeded by the player itself, which no page can reach. A seeded tape is refused there (`Bot.as:1260`) | source only |
| 3 | what "predictable" must mean | Two options, priced in §3. **P-seed**: fixed per multiworld seed and per draw history. Every seed has a plan (the Owl witness: 18/18), but a plan holds only for an exact history, so a human cannot reproduce it. **P-room**: fixed per room entry. A player can learn it, a rule can name the line, and a witness proves it once per room. Not chosen | §3 |
| 4a | (a) runtime-only | **wasm: not possible without a rebuild.** No frame-exact room hook reaches the runtime from outside (the state is not exported, and the bridge reports a level change late). The nearest "no AS3" form is a recompiler/runtime patch that hooks `Game.begin`, which is still a rebuild. **JS runtime: easy**: `jsRuntimeCore` passes a per-room `rng` to `levelRun`, and the boot-room premise then holds at every entry. **Ruffle: impossible** | §4.1 |
| 4b | (b) AS3 change | Two sketches, both apply cleanly to `ccdf189` (`git apply --check`). **(b1)** `Rng.enterRoom(level)` from `Game.begin`: reseeds the existing hooked generator per room (5 hunks). wasm only. **(b2)** `PlayRng`: a plain-AS3 Park–Miller generator with ONE stream per gameplay site, keyed by (world seed, level, entry, site) and restarted in `Game.begin`. The same numbers in Flash, Ruffle, wasm and JS (14 hunks: the 9 sites, grass, seal, the dead `coins` draws to `Rng.cos()`, `Game.begin`, `Bot`). Both need the full wasm rebuild chain | `ev/patches/*.patch`, §4.2 |
| 5 | side effects of a per-room seed on committed tapes | **GAME: 7 of 10 change verdict**, all 7 on L57. Every committed boss/spawner tape (the 2 Owl tapes and the 8 TentacleBeast witnesses) was replayed as committed and with `rng.seed := roomSeed(AP_1's seed, boot level)`. That is design (a)/(b1)'s per-room seed, and for a tape that boots in its boss room it is an exact emulation. The 3 hitless TB tapes lose their kill (`57:0`) and take 1–2 hits. Both Owl tapes keep their verdict (`r6-owl-kill`'s line also wins on 125705577). ⇒ under ANY reseed scheme, every committed L57/L112 tape whose seed is not the scheme's must be re-planned and re-recorded | `ev/logs/reseed-replay.json` |

## 1. The census (`ev/census.json`, `tools/census.py`, source `vendor/seedling` @ ccdf189)

Every live call of `Math.random()`, `Rng.cos()`, `FP.random`/`FP.rand`/`FP.choose` and `getTimer()` in `src/` (comments stripped),
each with a curated class. A live site the table does not name fails the tool (0 unclassified).

| kind | site | decides | rooms |
|---|---|---|---|
| GAMEPLAY | `Enemies/FinalBoss.as:142` | barrage roll: a 1-in-6 chance per barrage tick to drop a rock | L112 |
| GAMEPLAY | `Enemies/FinalBoss.as:144` | rock aim x, y: ±20 px around the player's position 15 velocity-steps behind (2 draws) | L112 |
| GAMEPLAY | `Scenery/RockFall.as:33` | rock scale 0.25–0.75 → `setHitbox(32·s, 16·s)`: the HIT box | L112 |
| GAMEPLAY | `Enemies/FinalBoss.as:158` | grenade roll: a 1-in-40 chance per walk tick (a `Grenade` is an `Enemy`: +1 `coins` draw) | L112 |
| GAMEPLAY | `Enemies/FinalBoss.as:216` | 5 death rocks' x after the "dead" anim (both flags already cleared); they can still land | L112 |
| GAMEPLAY | `Enemies/TentacleBeast.as:138,139` | whirlpool spawn x, y (rejection loop, ≤ 101 tries) | L57 |
| GAMEPLAY | `Enemies/TentacleBeast.as:167,168` | tentacle spawn x, y (a `Tentacle` is an `Enemy`: +1 draw) | L57 |
| ADVANCER | `Enemies/Enemy.as:30` | `coins`: 1 draw per Enemy constructed (at a build AND at a spawn). `dropCoins()` has no live caller: the value is dead | every room with an Enemy |
| ADVANCER | `Enemies/Spinner.as:24`, `Enemies/WallFlyer.as:20` | a SECOND dead `coins` draw per Spinner / WallFlyer | their rooms |
| ADVANCER | `Enemies/Enemy.as:123` | `dropCoins()` angle: dead code, listed for completeness | none |
| ADVANCER | `Chest.as:87` | seal identity on a chest open: a REJECTION loop (variable count) over `SealController.getSealPart`, which writes `Main.hasSealPartSet(slot, index)`. Logic reads only the COUNT (`hasAllSealParts` = the last slot ≠ −1); the identity is drawn (`SealController.as:152`) and read back in `save.seal_parts` | the 16 chest levels: 11 12 15 17 25 36 38 40 46 48 63 71 80 86 90 98 |
| ADVANCER | `net/flashpunk/FP.as:427` | FP's own generator, seeded ONCE from one gameplay draw in `Engine`'s ctor (boot only). Its consumers are all cosmetic | boot |
| SAVE-ONLY | `Scenery/Tile.as:564` | grass blades: 12 per grass tile × 2 draws, at the build. A blade has a hitbox; `cut()` bumps `Main.grassCut`, a medal counter at 10,000. No lock, check or rule reads it | 57 of 116 levels draw at build (`reach`) |
| COSMETIC | 40 sites | `Rng.cos()` (the second stream under the split, default ON since 3′b), FP's generator (`FP.choose` spin and mirror, `Spritemap.randFrame`, `Emitter`), `FP.shuffle` (no caller) | — |
| ENGINE | 12 `getTimer()` | `Engine` frame pacing. `Main` builds the Engine `fixed = false`, but no game class reads `FP.elapsed`: one update per frame | — |

**Reach (`census.json` `reach`).** The tool reproduces R4's measured build costs exactly (L0 **1296**, L12 **3145**), and L112's
gameplay build is 1 (the FinalBoss's `coins`). That matches `OwlDrawStream.levelBuild` (`finalBossRng.js:428`), which charges one
`enemyCoins()`. 57 of 116 levels draw at their build, all of it ADVANCER or SAVE-ONLY. **Only L57 and L112 read a gameplay draw.**
Those two rooms are where predictability changes a hit, a kill or a route. Everywhere else the stream only ADVANCES, and that
matters for the next of those two rooms the player reaches.

## 2. Per runtime

### 2.1 wasm (`flashPanel/wasm`, `seedling_bot_ap_*`)
- Generator: `SWFModernRuntime/src/avm2/avm2_number.c`, a 31-bit XOR-shift LFSR, one uint32 of state (`rng.js` transcribes it,
  pinned against `botRngProbe`). Boot state = `(uint32)(MOCK_DATE_TIME·1000)` with the build's `-D` default 981152406000, so
  every page boots the same. The cosmetic stream is a second instance (`swfmodern.Rng.cosmetic`). `Rng.split` is true by default.
- **Who seeds:** the build (once), and `Bot.botStart` (`Bot.as:1893-1895`: `Rng.split = rngSplit`, `setState(rngSeed)` if nonzero,
  `setCosmeticState`) on a tape, before the deferred build. `botRngProbe` (`:2925-2938`) samples and restores. `botReset`
  (`:3009`) puts `split` back. **Nothing else:** no room entry, no save, no load, no death. The state is not in the SharedObject.
- **Measured, two fresh pages, no tape** (`normal-1`, `normal-2`, 20 s each): both latched L0 `begin` at state **743483584**,
  fp 1054442931; both live states **1410304934** after the build (+1296 grass draws plus the boot path), constant for 20 s (an
  idle L0 draws nothing per frame). **Identical.**
- **Measured, the Owl tape with `seed 0` (inherit), two fresh pages** (`inherit-1`, `inherit-2`): L112 begins at **1410304934**
  (the page's L0 stream; L112's build adds 1). Both runs: a death rebuild at t731 (state 1260324488), walked to L111 at t1575 and
  back at t1824, 0 flags, the same end. **Identical, and a LOSS.** The same inputs on seed 101 are a 0-hit win (`direct`).
- **What moves the stream** (`determinism-run2.json`): boot L111 seed 101, then `up` into L112 at t7. The L112 begin is at state
  **101**, because L111's build draws 0 (`reach`: L111 0). The shifted in-room inputs: **1830 ticks, first divergence from the
  direct boot: none**. 0 hits, `112:0 112:1`, L113 (80,136). `walkin-idle` (run1): 120 idle ticks in L111 first gives L112 begin
  at 101 at t127, and the same win. ⇒ **A room's stream is the sum of all gameplay DRAWS since the last reseed. Wall time and
  idle frames count nothing.** A route through draw-free rooms carries the stream unchanged. A route through any of the 57
  build-drawing rooms, any Enemy spawn, any chest, any death, or any part of an L57/L112 fight moves it.
- ⚠ The round-trip arm (out of L112 mid-fight and back) did not happen. L112's exit stays shut during the fight (the room's
  rocklock), so `down` never left (run1 and run2 rows `walkin-roundtrip`: one L112 begin only). The re-entry witness is the death
  rebuild above.
- **A non-bot page cannot reseed.** Only AS3 can reach `swfmodern.Rng`. The JS glue exports no RNG symbol (`strings` on p4g's .js
  and .wasm: only the AS3-side messages). The bridge's `level` report arrives after the frame, so even an export could not hit
  `Game.begin`'s instant.

### 2.2 JS runtime (`seedlingDemo/levelRun.js` under `jsRuntimeCore`)
The JS runtime has no generator for normal play. It models the stream only where a tape declares one, in the boot room on its first
build (`levelRun.js:2402-2436` `owlStreamFor`, `tentacleBeast.js:150-166` `tentacleStreamRefusal`, `finalBossRng.js:464-485`
`assertOwlStreamPremises`). Measured (`tools/js-runtime-rng.mjs`):

| arm | result |
|---|---|
| Owl, seed 101 split, twice | identical: 1836 ticks, 0 hits, `112:0 112:1` |
| Owl, no `rng` (normal play) | **throws at t0**: "needs a tape_version 7 `rng` block" |
| Owl, seed 0 | **throws at t0**: "Seed 0 means "inherit the build's boot state", which is an ORIGIN this model does not have" |
| Owl, walk-in from L111 (the game's 0-divergence win above) | **throws at t7**: "would open in level 112 after a boot in level 111" |
| TentacleBeast, no `rng` | the fight verb's gate: `streamRefusal` = "has no declared seed for this room" |

So an AP player on the JS runtime cannot fight either boss under the model at all. `jsRuntimeCore` stages a tape-less boot with
`rng = null`.

### 2.3 Flash / Ruffle
No SWF is tracked. The Flash panel plays a user-supplied SWF on Ruffle 0.7.1 (`flashPanel/ruffleCdn.js`). Without the
`swfmodern.Rng` hooks, `Rng.available` is false and `cos()` falls back to `Math.random()` (`Rng.as:105-111`). That gives ONE
stream, seeded by the player itself (UNWITNESSED: the repo does not drive Ruffle's generator, and no readout reaches it). A
seeded tape is refused there by name (`Bot.as:1260`). **Not predictable, and no page-side fix exists.**

## 3. What "predictable" must mean for the logic (listed, not chosen)

| | **P-seed**: fixed per multiworld seed and draw history | **P-room**: fixed per room entry |
|---|---|---|
| definition | the stream at a room's entry is a function of the AP seed and the exact history since the reseed | a gameplay site's n-th draw in a room is a function of (world seed, level, [entry k], site, n) only |
| what a witness proves | "on THIS history there is a 0-hit line" (the Owl executor: 18/18 seeds). It does not transfer: a fixed tape wins on 0–7 of 17 seeds (`cloud-report-rules-l112-owl-executor.md` §4) | "in THIS room there is a 0-hit line", proved once per room (and per k if per-entry), for every route into it |
| what a player gets | nothing usable: any deviation (one more Enemy spawned, a death, a chest) moves the barrage, and no human can replay a history frame-exactly | a fixed rock schedule they can learn and retry. Under (b2), rock TIMES are fixed per pod. Rock AIM is fixed offsets around the player's lagged position, so a learned dodge line repeats |
| what the rule can say | only "the room has a 0-hit policy on every seed tested", a closed-loop search the player cannot run | "the room has this line", which the rule can name, and the witness and model replay |
| cost | none today (what the bot harness already does) | an AS3 change + the rebuild chain (§4.2), or JS-runtime-only via (a) |
| sub-choice | — | **every entry identical** (a death or re-entry replays the same draws, so it is learnable) vs **per entry k** (a death draws afresh, still predictable from k, but a retry is a new fight) |

## 4. The change (sketches only)

### 4.1 (a) runtime-only, no AS3 change
- **JS runtime:** `jsRuntimeCore` stages every room entry with `rng: { seed: roomSeed(apSeed, level, k), split: true }`, and
  `levelRun` reseeds `OwlDrawStream`/the tentacle stream at each world build (the `worldEntries > 0` / `n !== boot.level`
  refusals become a reseed). The models already charge exactly one room's build from a reseed, so they need no new schedule.
  **What it breaks:** the JS runtime would no longer equal the wasm game outside a tape's boot room (the game does not reseed),
  so any JS-vs-wasm differential that crosses a room boundary stops comparing. Only the JS player becomes predictable.
- **wasm:** **no runtime-only form.** The state lives in C and is not exported, and nothing outside AS3 sees `Game.begin`
  frame-exactly. The nearest is a **recompiler/runtime patch** that injects a reseed at the generated `Game.begin` entry and reads
  `Game.level` from C. That is still a full rebuild, and more fragile than (b1), which does the same in AS3.
- **Ruffle:** impossible (third-party generator).
- `roomSeed` (sketched in `tools/reseed-replay.mjs`): FNV-1a over `"<mw>|<level>|<entry>"` folded to 1..2³¹−1. Any hash with that
  range works.

### 4.2 (b) AS3 change (patch files only; `vendor/seedling` not edited)
- **(b1) `ev/patches/b1-room-reseed-hooks.patch`** (5 hunks: `Rng.as`, `Game.as`, `Enemy.as`, `Spinner.as`, `WallFlyer.as`):
  `Rng.worldSeed` / `Rng.perEntry`, and `Rng.enterRoom(level)` called from `Game.begin` right after `Bot.latchBeginEntry`, before
  `loadlevel`. It `setState(hash(world, level, entry))`. The dead `coins` draws move to `Rng.cos()`, so a room's gameplay stream
  is drawn only by its own sites, grass and seals. **Limit:** the hooks exist only in the recompiled wasm; Ruffle/Flash keep
  today's unseeded stream. One stream per room: the Owl's rock aim still shifts with how many barrage/grenade rolls preceded it,
  which depends on how long the player takes to shove him.
- **(b2) `ev/patches/b2-playrng-per-site.patch`** (14 hunks; new `PlayRng.as`): a plain-AS3 Park–Miller generator (FlashPunk's
  own step, exact in a double) with ONE stream per gameplay site, keyed by (world, level, entry, site) and restarted by
  `PlayRng.enterRoom(level)` in `Game.begin`. Sites: `owl.barrage` (`FinalBoss:142`), `owl.aim` (`:144`), `owl.rockScale`
  (`RockFall:33`), `owl.grenade` (`:158`), `owl.death` (`:216`), `tentacle.whirlpool` (`TentacleBeast:138-139`),
  `tentacle.tentacle` (`:167-168`), `chest.seal` (`Chest:87`), `tile.grass` (`Tile:564`). The dead `coins` draws go to
  `Rng.cos()`. `Bot.botStart` takes `rng.world` / `rng.per_entry` from a tape (the parse is not written). **Properties:**
  identical numbers in every runtime, `Math.random` is out of gameplay entirely, and the barrage roll's stream advances exactly
  once per barrage tick. So **which ticks of each pod drop a rock is fixed per room entry whatever the player does**, and the aim
  offsets are a fixed sequence too. ⚠ Two sketch-level caveats are marked in the file: FNV's multiply must be split into int
  math, and the host write of `worldSeed` (a bridge property) is not drawn.
- **Rebuild cost (either):** the mxmlc + `inject.py` → SWFRecomp → `build_wasm_avm2.sh` chain (p4g's took 24m25s). A new build
  directory (p4h) needs a `builds.json` entry, the `.gitignore` whitelist and the four-way `check-seedling-wasm-pins.mjs`. The
  `vendor/seedling` pin moves (`check-seedling-source-pin.mjs` holds it equal to the default build's source). The **wasm gitlink
  bump is ASK-FIRST** (CLAUDE.md). The headless CI gate (`seedling-wasm-ship`) and the full tier
  (`check-seedling-full-tier-owed.mjs`) are owed. Presets and `WASM_PAGE` follow if p4h becomes the default.
- **Fidelity ports that must follow:** `rng.js` (unchanged for (b1); for (b2) a Park–Miller + key port, much simpler than the
  LFSR), `finalBossRng.js` (the per-tick schedule and `OwlDrawStream`: under (b2) one counter per site and no cross-site
  ordering; the coast/jiggle subtleties fall away), `tentacleBeast.js` (the stream and `tentacleStreamRefusal`'s boot-room clause),
  `assertOwlStreamPremises` and `owlStreamFor`'s boot-room refusal (gone: every entry is a reseed), the oracles
  (`fixtures/rng-oracle.json`, `owl-rng-oracle.json`, `owl-prefix-oracle.json`), the tape format (`rng.world`, `rng.per_entry`,
  a tape_version bump), the R7 seam signature's `rng.gameplay` rows, `rngRuler.js`, and every Owl/TB witness re-recorded.
- **How the consumers would read it:** the **solver/witness** stops planning per seed. Under P-room a room's 0-hit line is one
  plan, and the Owl executor's closed-loop search runs once per room entry policy. The **fidelity model** opens the Owl/TB
  stream at every entry from (world, level, k) instead of refusing. The **survey** can drop the Owl from its skip-list and take
  L57/L112 like any other room. The rule can name the line it relies on. Under (b1) the same holds for the wasm only, and the
  solver still has to track the barrage/grenade interleave.

## 5. Q5: committed tapes and probes under a per-room seed

Bounded set: every committed tape that boots in a room with a GAMEPLAY site (census: L57, L112). That is
`fixtures/tapes/r6-owl-{control,kill}.json` and the 8 `fixtures/tentaclebeast-witness/*.json` (no other committed tape boots
there: scan of all tracked `tape_version` JSON outside `CC/docs`). Each was run on a fresh p4g page twice: **committed**, then
**per-room** (`rng.seed` := `roomSeed("14089154938208861744", boot.level, 0)`; everything else unchanged). `Bot.botStart`
already reseeds before the deferred build, so for a boss-room boot a per-room reseed at `Game.begin` IS this seed swap: the
emulation is exact for these tapes, with no rebuild (`tools/reseed-replay.mjs`, `logs/reseed-replay.json`).

| tape | seed → room seed | committed (GAME) | per-room (GAME) | |
|---|---|---|---|---|
| r6-owl-control | 101 → 125705577 | L112, 1 hit, no flag | L112, 1 hit, no flag | same |
| r6-owl-kill | 101 → 125705577 | L112, 0 hits, `112:0 112:1` | L112, 0 hits, `112:0 112:1` | same |
| tb-death-s3 | 3 → 290847287 | L57, 2 hits, 1 death rebuild | L57, 2 hits, no rebuild | **CHANGED** |
| tb-enter-cleared | 1 → 152757873 (boots L58) | L57, 0 hits, `57:0` | the same | same (beast already dead: no draws) |
| tb-hitless-door | 418414780 → 290847287 | **L58, 0 hits, `57:0`** | L57, 1 hit, no kill | **CHANGED** |
| tb-hitless-pit | 418414780 → 290847287 | **L58, 0 hits, `57:0`** | L57, 2 hits, a death, no kill | **CHANGED** |
| tb-hitless-s2 | 2 → 290847287 | **L58, 0 hits, `57:0`** | L57, 2 hits, a death, no kill | **CHANGED** |
| tb-idle-s1 | 1 → 290847287 | L57, 1 hit | L57, 2 hits | **CHANGED** |
| tb-policy-s2 | 2 → 290847287 | L57, 1 hit, `57:0` | L57, 2 hits, a death, no kill | **CHANGED** |
| tb-solve-s2 | 2 → 290847287 | L58, 1 hit, `57:0` | L57, 2 hits, a death, no kill | **CHANGED** |

(hits = the most seen by the poll; "death" = a second begin of the boot room; the committed arms reproduce each witness's own
recorded `end` level.) **Reading:** the per-room seed is a different seed, and these tapes are per-seed plans, so they break.
That is §3's P-seed fact again, now on L57 too: the 3 hitless kills are lines for their own seed. Under P-room each room has
ONE seed per entry policy (here all six L57 boots share 290847287), so the witnesses would be re-planned once against it and
then hold for every route in. A transition-crossing tape is not emulable this way. None of the committed boss tapes crosses
one, but the seam/segment checks that compare `rng.gameplay` (`tapeFormat.js`; `fixtures/wasm-arrival{,-gen}-p4g.json` carry it)
would read new values after every room boundary.

**Probes:** `probe-seedling-rng.mjs` / `rng-oracle.json` (the generator vectors) are unaffected by (a)/(b1), which keep the
generator. Under (b2) the gameplay sites no longer read it, and a PlayRng oracle is owed. The Owl/TB probes and oracles
(`owl-rng-oracle.json`, `owl-prefix-oracle.json`, `probe-seedling-r6-owl-*.mjs`, `probe-seedling-tentacle-mouth.mjs`) declare their
seeds, so they move exactly as the tapes above do. **Model side, today's semantics:** the bounded `npx vitest run` over
`rng.test.js finalBossRng.test.js finalBossFight.test.js fidelityTentacleBeast.test.js` is green at this base (4 files, 104
tests, `logs/vitest-baseline.log`). A scratch per-room patch of `levelRun` was NOT run. The model only carries a stream in the
boot room, where the result above already decides, so the patch would change the refusals and nothing measurable.

## 6. Decisions for Robert

1. **P-seed or P-room?** (§3) Is a per-seed closed-loop policy enough for the logic, or must a player be able to learn a room?
2. **If P-room: every entry identical, or per entry k?** (Does a death or re-entry replay the same fight?)
3. **(b1) or (b2)?** (b1) is smaller and wasm-only. (b2) is predictable in Flash/Ruffle and the JS runtime too, and makes rock
   timing independent of the player.
4. **The world seed's source:** the AP seed (by slot? by multiworld?), written by the host through a new bridge property,
   and what a vanilla/no-AP page uses (the sketch: 1).
5. **Do grass blades and seal identity join the per-room streams** (the sketch: yes, both are on the gameplay stream today),
   or go to `Rng.cos()`? Neither changes a hit, a lock or a check.
6. **JS runtime (a) as an interim:** make the JS player predictable now, accepting that JS and wasm then diverge past the boot room?
7. **The rebuild:** approve a p4h build, the `vendor/seedling` pin move and the ASK-FIRST wasm gitlink bump, then re-record the
   Owl/TB oracles and witnesses.

## 7. Files (`ev/` = `CC/docs/cloud-reports/rules-predictable-rng-evidence/`)
- `census.json`, `tools/census.py`: the census and the per-level reach.
- `tools/determinism.mjs`: normal / inherit / direct / walk-in arms. `logs/determinism-run1.{json,log}` (all arms;
  ⚠ run1's `arrivalTick`/`inRoom` were blank, fixed for run2), `logs/determinism-run2.{json,log}` (`direct`, `walkin`, the
  in-room comparison). Tapes: `tapes/owl-sword-s101*.json` (the source tape from the L112 witness branch, and the walk-in
  variants this tool wrote).
- `tools/js-runtime-rng.mjs`, `logs/js-runtime-rng.json`: the JS-runtime arms.
- `tools/reseed-replay.mjs`, `logs/reseed-replay.{json,log}`: Q5.
- `logs/vitest-baseline.log`: `npx vitest run` on `rng.test.js finalBossRng.test.js finalBossFight.test.js
  fidelityTentacleBeast.test.js` at this base: **4 files, 104 tests passed**.
- `patches/b1-room-reseed-hooks.patch`, `patches/b2-playrng-per-site.patch`: `git apply --check` clean on `ccdf189`; not applied.
- `tools/judge.mjs`, `tapes/owl-spear-s4.json`: copied from `claude/l112-owl-executor-witness-iwu8fj` for reference.
