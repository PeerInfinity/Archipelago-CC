# Cloud report: `rules-deterministic-boss-draws`: fixed patterns for the 9 gameplay draws in L112 (Owl) and L57 (Tentacled Beast)

Branch `claude/rules-deterministic-boss-draws-jb2pf9`. REPORT + PATCH FILE ONLY: evidence and tools. Nothing is changed in
`vendor/seedling`, the wasm submodule or its gitlink, `.github`, or any rule, preset, atlas, table, solver, levelRun,
`CONTACT_FIDELITY`, tape or fidelity file under `frontend/`. The model runs use an UNTRACKED scratch copy of
`frontend/modules/seedlingDemo/` (`seedlingDemoDet/`). Its whole diff is committed as evidence (`ev/model/`).

Base: `git rev-parse origin/main` = `0749fcb4d5114006362c8cc14f155f93019885a1` (it has 3c602f965d as an ancestor). AS3 read:
`vendor/seedling` @ `ccdf189776` (the source of the default build p4g). Evidence:
`CC/docs/cloud-reports/rules-deterministic-boss-draws-evidence/` (below: `ev/`).

⚠ **Every YES below is a MODEL YES.** A game witness is impossible until the patch is built: p4g still draws
`Math.random()` at all 9 sites, so a p4g page plays the old fight. Every game cell therefore reads **UNWITNESSED (needs the
p4h build)**. The models are the repo's own fidelity models: `finalBossFight.js`/`finalBossRng.js` stepped by `levelRun`,
and `tentacleBeast.js` played by the solver's `tentaclebeast` verb. On the committed witnesses the game has matched them
exactly: 817/817 observations for the Owl executor, and the eight TB witnesses at 0 px. The only change to the models is a
drop-in stream with the same site methods and per-site ledger, which returns the pattern instead of an LFSR draw.

## Answer table

| # | question | answer | evidence |
|---|---|---|---|
| 1 | Per site: a deterministic replacement, with 1–2 options + H (fight-local hash), and a recommendation | **Recommended: option A at all 9 sites.** A counter the entity already has, or one it gains, read through `Pattern.vdc(n, b)` (the radical inverse, i.e. Halton points). Each site keeps its formula, its range and its mean, and its spread within 1–3 % (§1). Barrage = every 6th barrage tick from the pod start (exactly 40 rocks per barrage, as the 1-in-6 mean). Aim = the Halton (2,3) point of the barrage's rock index. Scale = vdc base 5 of the same index (0.254–0.730, boxes 8×4 … 23×11, as shipped). Grenade = every 40th walk tick of a leg. Death rocks = 5 strata of the same ±4 px. TB = the Halton (2,3) point of each site's own candidate counter. The patterns need no seed, and every build (a death, a re-entry) restarts them | §1, `ev/patches/deterministic-boss-draws.patch` |
| 1-Owl | Under A, a 0-hit line for **Sword** and **Ghost Spear**, the same on every entry? | **MODEL YES, both.** Sword: 2227 t, 0 hits, lava t346/1614/1921, `112:0`+`112:1`, **L113 (80,136)**. Spear: 2200 t, 0 hits, lava t342/709/1908, L113. **Each tape wins with 0 hits on all 17 seeds tried** (1–16, 101), because no site reads the seed any more. The same tapes under the shipped RNG win on **1/17** (Sword) and **0/17** (Spear). **GAME: UNWITNESSED (needs p4h)** | `ev/tapes/det-owl-{sword,spear}-A.json`, `ev/logs/plan-det-*-A.json`, `cross-seed-det-A.json`, `cross-seed-det-A-under-shipped-rng.json` |
| 1-L57 | Under A, the L57 rule's arms (`Or(Sword, Ghost Spear, Wand)`) | **Sword: MODEL YES on all 3 committed L57 arrivals** (the pit (96,160), the L58 door (96,64) and the s2 staging): 0 hits, `57:0`, into L58 through the mouth, in 1491 / 1149 / 1491 t, with **identical keys on two seeds**. The pit and s2 plans are the same tape: same boot, different history, different seed. **Spear: MODEL YES on s2 only** (2506 t, 0 hits). On the pit and the door it is **UNWITNESSED: a TOOL gap, not the pattern's.** The shipped TB policy is sword-tuned and re-presses inside the Spear's 11-tick fire window, which `levelRun` refuses by name. It fails the same way under the SHIPPED RNG (`tb-arms-shipped.json`). **Wand: UNWITNESSED** (the TB policy has no Wand arm). By source a `WandShot` kills a sitting tentacle like any `Enemy.hit` (`hitsMax` 1), from outside the 66×8 swipe rect | `ev/logs/tb-arms-A.{json,log}`, `tb-arms-*-spear-gap11.json` |
| 1-H | Option H (the `Game.shakeJiggle` hash on a fight-local tick, a per-site salt in place of `axis`) | **0-hit line: MODEL YES** for Sword and Spear (orbit `nw`), and the TB Sword on all 3 arrivals. Every tape is seed-independent (9/9). **But it is NOT random-looking: a FINDING.** Every salt is the same golden-ratio Weyl sequence shifted by `salt·1777/4093`, so all of a tick's sites are ONE number. On a rock tick (`h(t,2) < 1/6`) the aim is pinned: **x ∈ lag + [−2.5, +4.0] px, y ∈ lag ± [14.7, 20] px, scale ∈ [0.40, 0.48]**. The shipped draw, by contrast, has x, y uniform in ±20 and scale in 0.25–0.75. The rock gaps take only 3, 5 or 8 ticks. **H2** (the same keys through a real integer mixing hash, int-exact in AS3) is random-looking: aim sd 11.6/9.6, gaps 1…27, 38 rocks per barrage. It is also **MODEL YES** for Sword (`nw`) and Spear (`nw2`), seed-independent, and TB Sword 3/3 | §1.3, `ev/logs/plan-det-*-H*.json`, `cross-seed-det-H*.json`, `tb-arms-H*.json` |
| 1-H-global | H keyed on the GLOBAL `Game.time` | **Not bounded, and not recommended.** The fight would be a function of the arrival frame's phase mod 4093. A fixed 0-hit H tape survives only some phase shifts (Sword 3/6, Spear 2/6: phases 1, 7, 100, 1000, 2046, 3070). Re-planned at the two failing phases (7, 2046), Sword finds a line at each (9/9 seeds). So lines exist where sampled, but a proof needs 4093 plans per weapon (≈ 6–40 core-days at the measured 1.5–15 min a plan), and a player cannot learn it: the arrival frame is not theirs to choose | `ev/logs/phase-H-*.json`, `plan-det-sword-H-ph{7,2046}.json` |
| 1-B | The single-site alternatives (B), one at a time on top of A | **All MODEL YES (Sword, 0 hits, L113, 9/9 seeds):** aim = 0 (aim exactly at the lag point), scale = 0.5, grenade counter over the whole room entry, and barrage = an irregular vdc gate (41 rocks per barrage, gaps 4 or 8). Planner effort is a rough difficulty proxy. Aim = 0 took the most search (12 350 drives, against A's 6 592). Scale = 0.5 and grenade-per-room found A's own line | §1, `ev/logs/plan-det-sword-B-*.json` |
| 2 | ADVANCER draws once the 9 sites are off the stream | **They can stay as they are.** `Enemy.coins` (+ the Spinner/WallFlyer second draw) is dead, because `dropCoins()` has no live caller. `Chest.as:87` decides only WHICH seal part, and logic reads the count. The grass blades only bump a medal counter. With no gameplay site left on the gameplay stream, nothing that decides a hit, a lock or a check reads its position. Cost of leaving them: the LFSR still exists, so seeded tapes stay byte-identical outside L57/L112 | §2 |
| 3 | The AS3 patch | **`ev/patches/deterministic-boss-draws.patch`**: 4 files, +58/−10. A new `src/Pattern.as` (one static `vdc`), `FinalBoss.as`, `RockFall.as` (an optional `_scale` argument, default 0.5) and `TentacleBeast.as` (adds a `break` when a whirlpool try fails: `cont` is never reset inside that loop, so no later try could pass anyway). **`git apply --check` is clean on the pinned `vendor/seedling` (`ccdf189776`)** and on a fresh `git archive` of it. No `Math.random()` is left in the three files | §3 |
| 4 | Price of the rebuild | One new build (**p4h**) beside p4g. Its `builds.json` row, the `.gitignore` whitelist and the four-way pins gate; the `vendor/seedling` pin move and `check-seedling-source-pin.mjs`; the **ASK-FIRST** wasm gitlink bump; the headless CI gate. Then re-records: the 8 TB witnesses (20 of 37 rows in their test file go red on the scratch copy), the 2 r6-owl tapes and their probes and oracles, and 8 rows in two more test files. The Owl/TB stream code can be deleted (premises, refusals, oracles). The Owl executor's per-seed search becomes one plan per weapon. Bounded file list in §4 | §4, `ev/logs/vitest-scratch-copy*.log` |
| 5 | Ruffle/Flash after the patch | **Yes, by construction (source): L112/L57 become the same fight in Flash, Ruffle, wasm and JS.** `Pattern.vdc` is integer `%` and `int()` plus one IEEE division per digit, the same bits in every AVM2 host. What still differs (`Math.random` behind `coins`/grass/seals, `FP.choose` for the sprite flip and spin) decides no hitbox. **GAME: UNWITNESSED** (the repo ships no SWF, and no p4h exists) | §5 |

## 1. The sites, the options, the measurements

### 1.1 The primitive

```as3
public static function vdc(n:int, b:int):Number   // src/Pattern.as (new)
{ var r:Number = 0; var f:Number = 1 / b; while (n > 0) { r += (n % b) * f; n = int(n / b); f /= b; } return r; }
```

`vdc(n, b)` is n's base-b digits mirrored about the point. Successive n fill [0,1) evenly, and two coprime bases fill the
square (the Halton points). It is not a level literal: every site keeps its own formula and constants, and only
`Math.random()` changes. Over the 40 rocks of a barrage (n = 1..40), the measured mean and spread of the unit value are:
base 2 0.480 / 0.285, base 3 0.473 / 0.279, base 5 0.471 / 0.283. A uniform draw gives 0.5 / 0.289. So the aim's mean
offset is −0.8 px (x) and −1.1 px (y), against ±20 px of spread.

### 1.2 Per site (A = recommended, B = the alternative, H/H2 = the hashes the planner asked for)

| site (`ccdf189`) | shipped | **A (recommended)** | B | H / H2 (fight-local hash) | effect on the fight |
|---|---|---|---|---|---|
| `FinalBoss.as:142` barrage roll | 1-in-6 per barrage tick: mean 40 per barrage, clumps (P = 1/6 that the next tick drops too), gaps ≥ 20 ticks 3 % of the time | `rockfallTime % 6 == 0`: every 6th barrage tick, phase from the pod start (ticks 6, 12, …, 240), exactly 40 | `!floor(vdc(tick,2)·6)`: irregular, 41 per barrage, gaps 4 or 8 | H: `h(tick,2) < 1/6`, 40, gaps 3/5/8 · H2: 38, gaps 1…27 (like the shipped) | A: no clumps, never a rest. The rock RATE is the shipped mean |
| `FinalBoss.as:144` aim x, y | each U[−20, 20) around the lag point (15 velocity-steps behind) | `vdc(k,2)`, `vdc(k,3)` × 40 − 20, with k = the rock's index in this barrage (reset at the pod snap) | 0: exactly at the lag point | H: a function of the gate value (§1.3) · H2: independent per site | A: the same square, evenly covered. B = 0 makes a moving player safe and a resting one always hit |
| `RockFall.as:33` scale (the HIT box `32s × 16s`, int) | U[0.25, 0.75): boxes 8×4 … 23×11 | `vdc(k,5)/2 + 0.25` of the same k, passed in: 0.254 … 0.730, boxes 8×4 … 23×11 | 0.5: always 16×8 | H: 0.40–0.48 on rock ticks (boxes 12×6 … 15×7) · H2: uniform | A: the same box set, so the dodge margins are the shipped ones: the worst rock is still 23×11 (11.5 px half-width against the player's 4×5). B removes the 17–23 px rocks, which gives up to 3.5 px more margin in x |
| `FinalBoss.as:158` grenade roll | 1-in-40 per walk tick | `walkTicks % 40 == 0`, counted per leg (reset at the pod snap): the 40th, 80th … walk tick of each leg | the same counter, never reset (over the room entry) | H: walk ticks 33, 88, 109 … · H2: 13, 104, 229 … | A: a leg shorter than 40 walk ticks throws none. A shove's coast ticks are not walk ticks, so a shove delays the grenade |
| `FinalBoss.as:216` 5 death rocks' x | 120 + U[−4, 4) | 120 + (i + ½)/5 · 8 − 4 → 116, 118, 120, 121, 123 (int), scale `vdc(i+1,5)` | all at 120 | H: 117…123 | They fall at y 0…26 (the exit column) after the kill. Every plan's player is on its orbit then, far from x 116–123, so A and B are equivalent for the line |
| `TentacleBeast.as:138,139` whirlpool x, y (the "rejection loop") | U over x∈[32,176) × y∈[112,176). ⚠ `cont` is never reset inside the loop, so a failed FIRST try makes all 101 fail: in effect one candidate per tick, and 202 dead draws | the Halton (2,3) point of the beast's own `whirlIndex`, plus `break` on a failed try: one candidate per tick, as the shipped behaves | `scan`: a real rejection loop (the first valid of ≤ 101 consecutive candidates, spawning the same tick) | H: `h(spawnTick, 2/3)` · H2: mixed | A keeps the shipped timing. B spawns whirlpools sooner, and the TB Sword fight takes 3626 t instead of 1491 |
| `TentacleBeast.as:167,168` tentacle x, y | U over x∈[24,184) × y∈[96,188), one try per tick while < 8 | the Halton (2,3) point of `tentacleIndex` | — | H/H2 on the spawn tick | Halton points spread out, so fewer candidates fall within 32 px of a standing tentacle |

**Measured (model), per option, per arm.** Owl: from the L111 arrival `{112, 32, 208}` to the L113 teleporter. TB: from
each committed L57 arrival to the mouth into L58. Each row is a plan found by the planner and then replayed on other seeds.

| option | Owl Sword | Owl Ghost Spear | L57 Sword (pit / door / s2) | L57 Spear (pit / door / s2) |
|---|---|---|---|---|
| shipped RNG (control) | per seed (the executor branch: 9/9 seeds, one plan each); seed 101 = 1836 t | per seed; seed 101 = 1742 t | 1389 / 977 / 1850, 0 hits, a different plan per seed | tool gap / tool gap / 4025 t 0 hits |
| **A** | **2227 t, 0 hits, 17/17 seeds** | **2200 t, 0 hits, 17/17 seeds** | **1491 / 1149 / 1491, 0 hits, both seeds identical** | tool gap / tool gap / **2506 t, 0 hits** |
| B aim = 0 | 2074 t, 0 hits, 9/9 | — | — | — |
| B scale = 0.5 | A's line, 9/9 | — | — | — |
| B grenade per room | A's line, 9/9 | — | — | — |
| B barrage = vdc | 2185 t (orbit `nw`), 9/9 | — | — | — |
| B TB whirl = scan | — | — | 3626 / 3599 / 3626, 0 hits | tool gap / tool gap / no variant without a death |
| H (jiggle hash) | 2185 t (orbit `nw`; `nw2`/`se` NOPLAN), 9/9 | 1945 t (orbit `nw`), 9/9 | 2190 / 2373 / 2190, 0 hits | tool gap / tool gap / 3743 t |
| H2 (mixing hash) | 1824 t (orbit `nw`; `nw2`/`se` NOPLAN), 9/9 | 2246 t (orbit `nw2`), 9/9 | 1479 / 1084 / 1479, 0 hits | tool gap / tool gap / 4924 t |
| H, global phase 7 / 2046 | 2190 t / 1838 t (re-planned), 9/9 each | — | — | — |

"N/N seeds" means the planned tape, replayed unchanged under each seed, wins with 0 hits on N of N. Under every pattern
the seed is dead, so a 0-hit plan is a property of the room, and every entry replays it. "Tool gap": the shipped TB
policy (`tentacleBeastPolicy.js`) is sword-tuned. Its `swingLands` geometry is the sword's, and its press cadence (8)
falls inside the Spear's fire window (11), which `levelRun` refuses by name. With the cadence set to 11 the pit and door
still find no death-free variant (`tb-arms-*-spear-gap11.json`). The control fails the same way, so this is a missing
Spear policy, not a property of the patterns. A NOPLAN on one orbit is the planner's result, not proof that no line
exists. The executor branch backtracked orbits the same way.

### 1.3 Why H is not random-looking (a finding about the requested design)

`Game.shakeJiggle(t, axis) = ((⌊t⌋·2531 + axis·1777) mod 4093) / 4093`. In t this is a Weyl sequence with step
2531/4093 ≈ 0.6184, the golden ratio. A salt only adds the constant `salt·1777/4093` mod 1. Every site keyed on the same
tick is therefore the SAME number, shifted: `h(t,3) = frac(h(t,2) + 0.434)`. The barrage gate selects
`h(t,2) ∈ [0, 1/6)`, and that forces the aim and the scale on exactly the ticks that drop a rock:

- x offset ∈ [−2.5, +4.0] px (the shipped draw covers ±20);
- y offset ∈ [14.7, 20) ∪ [−20, −18.6) px;
- scale ∈ [0.40, 0.48].

So every rock lands on one of two bands about 17 px north or south of the lag point, always mid-sized. It is
deterministic and learnable (a line exists), but it is a different fight, not the shipped one made fixed. The camera
jiggle does not mind, because nothing selects on one axis before reading the other. **If a hash is wanted, H2 fixes this:**
the same fight-local keys and salts through a 32-bit mixing finalizer (lowbias32). Its `imul32` is written with 16-bit
halves, so every intermediate is an exact double and AS3 computes the same bits: 0 mismatches against `Math.imul` over
100 000 random pairs. H2 measures like the shipped draw: aim sd 11.6/9.6 px, gaps 1…27, 38 rocks per barrage. **A is
still recommended over H2:** A is shorter, has no magic constants, keeps each site's mean and range exactly, and a player
can see the rule ("a rock every 6th tick").

### 1.4 Learnable: the same on every entry

Each counter is an instance field of the boss (`rockIndex`, `walkTicks`, `whirlIndex`, `tentacleIndex`) or is derived
from `rockfallTime`. It is constructed with the room: `Game.loadlevel` builds a new `FinalBoss`/`TentacleBeast` on every
entry, including a death rebuild. So every entry starts the same pattern, and the fight depends only on the player's own
inputs since entry. Measured: the L57 pit and s2 stagings boot at the same point with a different save, history and seed,
and A gives both the same 1491-tick key sequence. Every Owl tape is 0-hit on every seed tried. ⚠ The Owl's aim is still
lagged on the player's own velocity (`stepsAhead` −15), so the line is learnable as a MOVEMENT. Rocks land where the
pattern puts them relative to where you were 15 steps ago. That is the game's own mechanic.

## 2. The ADVANCER draws can stay

The census's ADVANCER and SAVE-ONLY sites are those whose drawn value decides nothing gameplay-visible but whose count moved
the stream. Once the 9 sites read `Pattern`, nothing that decides a hit, a lock or a check reads the stream's position.

- `Enemy.as:30` `coins`, and the Spinner/WallFlyer second draw: the value is dead (`dropCoins()` has no live caller).
- `Chest.as:87` seal identity: logic reads `hasAllSealParts` (the count). The identity is shown in `save.seal_parts`.
- `Tile.as:564` grass blades: a blade's `cut()` bumps `Main.grassCut`, a medal at 10 000. A Grass hitable does not stop a
  swing hitting an enemy: `Player.as:907-926` hits every entity in the rect.
- `FP.as:427` FP's generator seed: its consumers are cosmetic (`FP.choose` sprite flip/spin, emitters).

Leaving them keeps every seeded tape outside L57/L112 byte-identical on p4h, because the LFSR, its hooks and `Bot`'s
`rng {seed, split}` are untouched. Moving `coins` to `Rng.cos()` (as RNG report sketch b1 did) would change nothing a
rule reads, and would shift every later gameplay-stream value on every seeded tape. Not worth a re-record.

## 3. The patch (`ev/patches/deterministic-boss-draws.patch`)

`git apply --check` is clean on `vendor/seedling` @ `ccdf189776` (run read-only in the submodule) and on a fresh
`git archive` of it. Hunks:

- `src/Pattern.as` (new): `vdc`.
- `Enemies/FinalBoss.as`:
  - fields `rockIndex` and `walkTicks`, both reset at the pod snap (`rockfallTime = rockfallTimeMax`);
  - barrage `rockfallTime % rockFrequency == 0`;
  - aim `vdc(rockIndex, 2/3)` and scale `vdc(rockIndex, 5)/2 + 0.25`, passed to `RockFall`;
  - grenade `walkTicks % grenadeFrequency == 0`;
  - death rocks `120 + (i + 0.5)/n·8 − 4` with scale `vdc(i + 1, 5)/2 + 0.25`.
- `Scenery/RockFall.as`: `RockFall(_x, _y, _scale:Number = 0.5)` and `scale = _scale`. FinalBoss is its only constructor.
- `Enemies/TentacleBeast.as`: fields `whirlIndex` and `tentacleIndex`, the Halton candidates, and the `break` on a failed
  whirlpool try (gameplay-neutral, §1.2).

Not built: `mxmlc` is not in this container, and the brief reserves the rebuild for Robert's word.

## 4. Pricing the rebuild

**The build chain** (as p4g): mxmlc + `inject.py` → SWFRecomp → `build_wasm_avm2.sh` (p4g's took 24m25s). Then:

1. **New build `seedling_bot_ap_p4h`** in the wasm submodule: its `builds.json` row (role and `capabilities`), the
   `.gitignore` whitelist line, and the build directory. `scripts/procgen/check-seedling-wasm-pins.mjs` checks the four
   views (referenced / whitelist / tracked / manifest), and `seedling-wasm-readme.mjs --check` checks the generated README
   table.
2. **`vendor/seedling` pin move** to the patched commit (the patch applied in `PeerInfinity/Seedling`).
   `scripts/procgen/check-seedling-source-pin.mjs` holds it equal to the DEFAULT build's `source`, so the pin moves only
   when p4h becomes the default. Until then it stays at `ccdf189` (p4g's), or the check reds.
3. **The wasm gitlink bump: ASK FIRST** (CLAUDE.md's standing exception, `frontend/modules/flashPanel/wasm`).
4. **The headless CI gate** (`check-seedling-wasm-ship.mjs`, `seedling-wasm.yml`) and `check-seedling-full-tier-owed.mjs`.
   The full tier is owed on the new build.
5. **Default flip (separate decision).** 525 tracked files outside `CC/docs` name `p4g`. Recommended: land p4h BESIDE p4g
   as the boss-room build, re-record only the L57/L112 artifacts on it, and flip the default (presets, `WASM_PAGE`, the
   pin) in its own slice.

**Re-record and remove** (bounded; the scratch-copy vitest measures which rows go red):

- `frontend/modules/seedlingDemo/tentacleBeast.js`: `TentacleDrawStream` → the Halton pattern; `tentacleStreamRefusal`
  and the seed premises are deleted; the `break`.
- `fidelityTentacleBeast.test.js`: **20 of 37 rows red on the scratch copy** (`ev/logs/vitest-scratch-copy.log`). That is
  all 8 game-witness rows plus the solver, HITLESS, premise and stream rows.
- `fixtures/tentaclebeast-witness/*.json`, all 8 witnesses (the RNG report's 7 verdict changes, plus `tb-enter-cleared`,
  whose stream samples change though its verdict does not), and `fixtures/sound-cue-goldens/tentaclebeast-witness__tb-policy-s2.txt`.
- `finalBossRng.js`: `OwlDrawStream` → the patterns. `assertOwlStreamPremises` and the `rng`-block premise are deleted.
  `OWL_DRAW_SITES` keeps its sites as a ledger.
- `finalBossFight.js`: the stream is passed the boss's `rockfallTime`.
- `levelRun.js`: `owlStreamFor`'s boot-room / re-entry refusal is gone, because every entry is the same fight.
  `tentacleStreams` carry-over is gone.
- `finalBossRng.test.js`, `finalBossFight.test.js`: their stream rows test `OwlDrawStream` directly, so they stay green
  until it is replaced, then must be rewritten.
- `fixtures/owl-rng-oracle.json`, `owl-prefix-oracle.json`, `scripts/procgen/probe-seedling-r6-owl-rng.mjs`,
  `probe-seedling-r6-owl-prefix.mjs`, `plan-seedling-r6-wowl.mjs` (it plans per seed).
- `fixtures/tapes/r6-owl-control.json`, `r6-owl-kill.json` and `fixtures/tapes/index.json`, plus
  `fixtures/dead-frame-observations.json`'s Owl rows.
- `fidelityOwlSuit.test.js` (**2 rows red**, the pod-snap and rock-spawn ticks) and `fidelityResidue.test.js` (**6 rows
  red**, the seed-15 L57 drown: `ev/logs/vitest-scratch-copy-owl.log`). Green on the copy: `fidelityShakeExact`,
  `seedlingOwlIntro`, `fidelityDarkSuitBosses`, `jsRuntimeBossWiring`.
- `probe-seedling-bosskills.mjs` (it records the TB witnesses), `check-seedling-bot-differential.mjs`, `r6Acceptance.js`
  (`GAMEPLAY_DRAW_CONSUMERS`), `seedlingProfile.js` (`rockFrequency`/`grenadeFrequency` keep their role as periods),
  `scripts/procgen/seedling-constants-{census,fields}.csv`, `docs/json/developer/procgen/seedling-constants.md`,
  `seedling-bot-log.md`.
- `scripts/procgen/surveyGrants.js` (`stagedRng`'s L57 premise comment) and the survey's L112 skip. The survey can take
  L57/L112 like any other room.
- `fixtures/wasm-arrival-p4g.json` / `wasm-arrival-gen-p4g.json` (`rng.gameplay`): unchanged for p4g. A p4h copy reads new
  values after any L57/L112 fight (those sites no longer draw), but not before.
- The Owl witnesses on `claude/l112-owl-executor-witness-iwu8fj` (9 Sword + 9 Spear seeds, the Q3 Shield/Wand tapes):
  replaced by ONE plan per weapon (here: `ev/tapes/det-owl-{sword,spear}-A.json`), to be judged on p4h.
- Unaffected: `rng.js`, `fixtures/rng-oracle.json`, `probe-seedling-rng.mjs` (the generator is unchanged), and every
  seeded tape that never fights in L57/L112.

## 5. Ruffle / Flash

Today L57/L112 there read `Math.random()` from the player's own generator, which no page can reach (the RNG report §2.3).
With the patch, all 9 sites are `Pattern.vdc` over integer counters: `int`, `%`, `/` and one IEEE double accumulation per
digit. That gives the same bits in Flash Player, Ruffle's AVM2, the recompiled wasm and the JS model. What still reads
`Math.random()`/`FP.choose` in those rooms is `Enemy.coins` (dead), `RockFall`'s `angleRate` and `scaleX` (sprite only:
the hitbox is `setHitbox(32·scale, 16·scale)`, unsigned), and the cosmetic sites. **So the two fights are identical in
every runtime by construction. UNWITNESSED on the game:** there is no p4h, and the repo ships no SWF for Ruffle. Frame
pacing is not RNG: Ruffle runs one `update` per frame as the engine does (`FP.elapsed` is read by no game class).

## 6. Choices for Robert

1. **Pattern family:** **A (the vdc/Halton counters, recommended)**, H2 (a fight-local mixing hash: random-looking, the
   same on every entry), or H as asked. H is not recommended (§1.3): its sites are one shifted number, so the rocks land
   in two fixed bands.
2. **Barrage (L112):** A every 6th barrage tick (recommended) | B the irregular vdc gate (gaps 4/8) | H2.
3. **Rock aim:** A Halton (2,3) per rock index (recommended) | B zero offset (easier while moving, always hit at rest).
4. **Rock scale (the HIT box):** A vdc base 5 (recommended; the shipped box set) | B a constant 0.5 (16×8: more margin).
5. **Grenade:** A every 40th walk tick, per leg (recommended) | B the same counter over the room entry.
6. **Death rocks:** A 5 strata of ±4 px (recommended) | B all at x = 120. Equivalent for the line.
7. **TB whirlpool:** A one candidate per tick, as the game behaves (recommended) | B a working rejection loop (whirlpools
   come sooner; the Sword fight is 2.4× longer).
8. **TB tentacle:** A Halton (recommended) | H2.
9. **Global-`Game.time` hashing:** not recommended (§ answer 1-H-global).
10. **Rebuild:** approve p4h beside p4g, the eventual `vendor/seedling` pin move, the ASK-FIRST wasm gitlink bump, and the
    re-records in §4. Separately, decide when p4h becomes the default.

## 7. Rebuild checklist (in order)

1. Apply `ev/patches/deterministic-boss-draws.patch` in `PeerInfinity/Seedling` and push it as a branch (not the pin yet).
2. Build `seedling_bot_ap_p4h` from it (the p4g recipe). Add the `builds.json` row and the `.gitignore` whitelist, then run
   `check-seedling-wasm-pins.mjs` and `seedling-wasm-readme.mjs --check`.
3. **ASK FIRST:** the wasm gitlink bump to the commit carrying p4h.
4. The headless gate (`check-seedling-wasm-ship.mjs`) on p4h, then the full tier.
5. Game witnesses on p4h, one fresh page per tape: `ev/tapes/det-owl-sword-A.json` and `det-owl-spear-A.json` (expect
   0 hits, `112:0`+`112:1`, L113), plus each L57 arrival's Sword plan. Each judged twice, on two seeds, expecting the same
   result.
6. Port the patterns into `finalBossRng.js` / `tentacleBeast.js` / `levelRun.js` (`ev/model/scratch-model.diff` is the
   sketch) and delete the stream premises and refusals.
7. Re-record the §4 list: the TB witnesses and their test rows, the r6-owl tapes, oracles and probes, and the
   `fidelityOwlSuit`/`fidelityResidue` rows.
8. A Spear policy for the TB verb (the tool gap in §1.2) and a Wand arm, so L57's other two arms get a witness.
9. When p4h becomes the default: the `vendor/seedling` pin (`check-seedling-source-pin.mjs`), presets, `WASM_PAGE`, and
   the `p4g` references.

## 8. Files (`ev/`)

- `patches/deterministic-boss-draws.patch`: the AS3 change (option A).
- `model/scratch-model.diff`, `model/README.md`: the scratch copy of the fidelity models and how to rebuild it.
- `tools/owl-executor.mjs`, `tools/cross-seed.mjs`, `tools/judge.mjs`, `tools/sweep.sh`: copied from
  `claude/l112-owl-executor-witness-iwu8fj`. The first two are pointed at the scratch copy; `judge.mjs` is for the p4h
  game witness.
- `tools/tb-arms.mjs`: L57 arms through the solver, two seeds each. `tools/queue-b.sh`: the B runs.
- `tapes/det-owl-*.json`: every plan in §1.2.
- `logs/plan-det-*.{json,log}`: the plans and searches. `logs/cross-seed-*.json`, `logs/phase-H-*.json`: the replays.
  `logs/tb-arms-*.{json,log}`: L57. `logs/vitest-scratch-copy*.log`: the bounded vitest over the scratch copy (4 + 6 files).
