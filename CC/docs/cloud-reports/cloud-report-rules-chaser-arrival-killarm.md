# cloud-report — rules-chaser-arrival-killarm (STOPPED)

Branch `claude/rules-chaser-arrival-killarm-9yxgyy`, from `origin/claude/rules-fire-arm-chaser-guard-5o1nn3`.
`git rev-parse HEAD` at setup: `c98789a2479ec936401e2c921e7e211aab3d4461`. `session_bootstrap.sh --seedling` reached READY.
The six submodules are initialised and no pointer moved. Host settings: `minimal-spoilers`. Dev server: `serve-nocache.py 8000`.

**This slice STOPS. Two stops fire:**
1. **Rule T makes seed 1 unbeatable in logic.** Vanilla's Dark Suit (`Level 079 - Darksuit`) lies past L77's lavatrap. T charges the Dark Suit to cross that trap, and the game agrees the trap kills a player without the suit.
2. **Rule K moves 15 levels where 3 were expected.** Most of them are unwitnessed.

Rules K and T are built and unit-tested as pure grid inputs, but they are **not wired into the producer**. The wiring is evidence (`producer-wiring.patch`). No preset, atlas, table or level data moved, and nothing was re-recorded.

Evidence and tools are in `CC/docs/cloud-reports/rules-chaser-arrival-killarm-evidence/`.

## Answer

| question | verdict | evidence |
|---|---|---|
| **L77 reverse** (L76 → L77 → L78) through lavatrap@96,192, item-less | **GAME NO** (the trap kills) | `runs/game/arrive-L77-64-160-down@delivered`. Booted at (72,168), outside the disc, and held down. The player enters the 32 px disc at **t26** (72,198), is reeled to (94,200) over **t27–31**, and **dies at t32**: restart at the boot, 0 hits, `dead_frames` 20 → 40. Source: `LavaTrap.as:81-90` (launch when within `chompRange` with a clear `collideLine`), `:138-149` (`launch` attaches at once: the tongue starts at full length 32 along the angle to the player), `:64-72` (`die()` unless `hasDarkSuit`) |
| L77 reverse, Sword / Spear / Wand / Dark Shield | **UNWITNESSED on the game** | A melee arm cannot change the tongue's outcome: it attaches as the player enters the disc, before any swing lands (`:138-149`), and only `hasDarkSuit` releases (`:64`). Only a kill from outside 32 px could (option (a) below). A full reverse walk could not be authored. `bulb@80,72` (speed 0.65) holds the 1-wide gap c5 r3, and killing it there writes lava under it (`Bulb.as:79`), which seals the gap. The model tapes (`tapes/hand/l77rev-*`) do not model the tongue and were not played |
| L77 reverse, Dark Suit (+ an arm) | UNWITNESSED in reverse | Forward, Sword + Dark Suit is GAME YES (chase witness `l77-swordsuit-d`, t641, 0 hits) |
| **L80 chest, Dark Suit alone** | **UNWITNESSED (not retried)** | The slice stopped first. The chase witness's NO-route attempts stand (solver REFUSED; beams of 33,507 and 60,966 nodes). Under rule K as built, the chest gains the kill arm, because the route crosses `lavarunner@0,144`'s leash cut |
| Seed 1 under K + T | **STOP: unbeatable** | `runs/spheres-tip.txt`: 75 of 88 locations reachable in vanilla placement (base 88). The 13 lost start at `Level 079 - Darksuit` |
| Seed 1 under K alone | **0 of 88 spheres move** | `runs/spheres-Konly.txt` |
| Seed 1 under T alone | **STOP**: the same 13 lost | `runs/spheres-Tonly.txt` |
| Seal check (every item, from Menu) | **88 / 88** reachable in every variant | `tools/allItemsReach.py` |
| `engineMd5` | **`bec36987` at base and tip** | `runs/engine-closure-{base,tip}.txt`. The new module is not in the certifier's closure |
| Unit rows | **13 / 13** (+ the Fire guard's 13: 26 / 26) | `npx vitest run scripts/procgen/seedlingArrivalGuards.test.js scripts/procgen/seedlingFireChaserGuard.test.js`. Mutations m1–m5 each red their row |
| Whole-game certifier, derived-table probe, calib probe, re-record, `Generate.py` | **not run** | All are moot after the stop: nothing was re-recorded |

## Why T stops the slice (needs a ruling)

The game, read and witnessed, says the L77 lavatrap kills any player without the Dark Suit in both directions:
- forward (L78 → L76), Sword: tongued at t52–57, dead at t63 (chase witness);
- reverse (L76 → L78), item-less: dead at t32 (above).

Every floor route between L77's two doors passes within 32 px of the trap with a clear line:
- north to south, the walk runs c4 r11 → c4/c5 r12 → c5 r13 → c6 r14;
- crossing from c4 r12 to c5 r13 passes (80,208), which is **25 px** from the trap's centre (104,200).

In vanilla placement the Dark Suit is at L79. L79's only ways in are L78 (from L77) and L80's r16c1, and L80 needs the Dark Suit to reach r16c1 from its L71 door. So **a hit-free (death-free) vanilla game must get the Dark Suit before it can reach the Dark Suit**. With T, logic is circular at sphere 12. Seed 1's sphere log moves, and canonical placement would no longer be beatable.

**Options (not taken; Robert decides):**
- **(a) Rule T with a ranged-kill arm.** The LavaTrap is killable (`ENEMY_CLASSES.lavatrap.kill.hits` 3, `Enemy.hit`). An arm that hurts it from outside 32 px might cross without the suit. The Wand (a projectile) is the obvious candidate, and possibly the Spear's 32 px thrust from the disc's edge. T would then be `Or(Dark Suit, <that arm>)`. This is unwitnessed, and only a witness could make the vanilla order hit-free.
- **(b) A set patch** (like the L73 runner move) that moves the trap off L77's only neck. That changes the delivered set, and the brief puts it out of scope.
- **(c) Accept the trap death as the game's own price** (it is a death with 0 hits, not a hit), and keep T off.
- **(d) T on every room except where it seals vanilla.** A per-level exception: refused by the hard rules.

## Why K stops the slice (movers)

K as built charges the expected three routes in the expected shape. `routeWalk.py` gives per-level arrival → goal minimal item sets, with sub-region splits folded; the arm is `Or(Progressive Sword, Ghost Spear, Wand, Progressive Shield ×2)`.
- L71 → L72 → L73: FREE → arm. L73 → L72 → L71: FREE → arm.
- L76 ↔ L78 through L77 with K and T: FREE → `Dark Suit & arm`.
- L80 chest (from L71 and from L79): `Dark Suit` → `Dark Suit & arm`.
- L80's r6c4 does **not** move. That matches the witness: Dark Suit alone is GAME YES at t75 with 0 hits.
- L105 does **not** move (Flyers: `contactHits: false`).

But K moves **15 levels** in all (`runs/route-diff-Konly.txt`: 236 route rows; L12's 130 and L40's 72 are its hub fan-out):

| level | bodies (cut cells) | what moves |
|---|---|---|
| L12 | `puncher@416,256` (3) | the hub: routes through `bosslock@416,240`/`@432,240` gain the arm (`Red Key` → `Red Key & arm`); `Progressive Shield` → `Progressive Shield ×2` |
| L26 | 2 punchers (8, 12) | L25 ↔ L27 via L26: FREE → arm |
| L28 | 2 drills (9, 15) | L25/L26 → L28 exits: FREE → arm |
| L40 / L43 | 2 punchers (2, 3) | the block-puzzle hub: exits gain the arm. The L43 `#13` "None" rows are exit-number renames, not seals (the seal check is 88/88) |
| L53 | `puncher@136,96` (5) | L48 ↔ L51 via L53: FREE → arm |
| L72 | 3 runners | **expected** |
| L73 | `lavarunner@32,24` (8) | its `Dark Suit` arm becomes `Dark Suit & (Wand \| Shield ×2)`. Sword and Ghost Spear stay |
| L74 | 2 runners (11, 22) | L73 ↔ L75 and `Level 074 - Darkshield`: FREE → arm |
| L75 | 2 runners (16, 15) | L71 ↔ L74 via L75: FREE → arm |
| L77 | 2 runners | **expected** (with T) |
| L78 | 5 runners (13–20 each) | the `Dark Suit` arm becomes `Dark Suit & (Wand \| Shield ×2)` |
| L80 | 4 runners | **expected** (chest). Also new: L79 → L80 → L71: `Dark Suit` → `Dark Suit & arm` (`lavarunner@120,208`'s cut) |
| L88 | `drill@128,160` (15) | L12 ↔ L87 via L88: FREE → arm |
| L91 | `drill@64,80` (9) | L89 ↔ L92 via L91: FREE → arm |

The brief says any other mover needs its own witness. Each of these is an old state (FREE, or a lone Dark Suit) that only the game can call, and none was witnessed here.

Two further notes:
- The drills (`teleport-hop`, Drill.as:18,86: the hop needs a solid-free line) and the punchers (Puncher.as:22,63: they punch at `attackRange`) meet the brief's terms (b) and (c) as written. Whether a dodge clears them hit-free is what those witnesses would decide.
- K alone keeps every vanilla sphere, so K could land on its own once those witnesses (or a narrowed rule) are in.

## How K and T are built (`scripts/procgen/seedlingArrivalGuards.js`)

**Where the charge lands: the kill-lock shape, on the grid.** Each charged cell becomes a `gated` cell whose occupancy condition is the charge: "a gated cell as floor plus that gate", the maze's room-clear-lock rule. The analyzer splits the room there and prices the crossing, the maze lays it as floor plus gate, and the derived table reads the maze (amendment 1).
- ⛔ **An `enter` gate on an open cell does not work.** The first build used one, and L72 and L77 did not move. `regionAtlasAnalyzer.findComponents` floods every `open` cell into one component whatever its `enter` gates say, so such a gate inside a room is never priced. `enter` gates count only where a crossing already exists (L80's lava cells, which is why only L80 moved).

**K: the cut of the leash.**
- **Which bodies guard:** the Fire guard's (b) and (c), reused through `guardClassOf` and `bodyRegion`, plus "hits on contact" (`CHASERS[tag].contactHits !== false`).
  - Without the contact term, L105's flyers (`Flyer.as:83-85`, empty `hitPlayer`) would charge a GAME YES room.
- **The zone:** the cells within `runRange` of the spawn centre (nearest point of the cell) that are in contact of the body's flood.
- **The cut:** the zone cells that border a non-zone cell the body can still follow the player to. Crossing the cut either way costs the arm, and a walk inside the leash is free.
  - **Why a cut, not the whole leash.** Charging the whole leash moved L80's r6c4, a witnessed **GAME YES** for Dark Suit alone (the runner trails the player into the trap's pull). Under the cut it stays free. L72, L77 and the L80 chest all cross a cut.
  - **That is a bound, not a proof.** A long walk entirely inside one leash would pass free. None of the expected rows is one.
- **Never charged:** landings, door tiles and a LavaTrap's own tile.
  - A landing or a door is not a crossing: L77 → L78 is out at t6 and L72 → L71 at t7, both 0 hits, and both stay free.
  - The trap's own tile is where the pulls land, so it must stay a sub-region (see the lift fix below).
- **The arm:** the kill-lock census's (`KILL_LOCK_BODY_CLASSES` + `KILL_ARM_CONDITION`).
  - A class no kill-lock room holds (the drill) takes the same arm when `ENEMY_CLASSES[tag].kill` says `Enemy.hit` kills it.
  - It never includes Fire or the Dark Suit, as the census excludes both.

**T.** Only `LavaTrap` `die()`s a player without the suit: `grep -rn "hasDarkSuit\|\.die()"` over the AS3 `src/` finds only `LavaTrap.as:64,72` outside the Player. `SandTrap`, `DarkTrap` and `IceTrap` chomp, which is an ordinary hit.
- **The disc:** the pulls' own disc (`OV.lavaTrapPulls`), cut to the cells with a clear centre-to-centre line past the walls.
- **The trap's own tile is left open** so that the pulls (the rules' lifts and the maze's `pulls`) still land on a sub-region. T composes with `pulls` on the same cells: the move into the disc already needs the pull's own gate.

**Three side effects the wiring patch handles (all general):**
- The grid passed to the block push model, the rock Fire narrowings and the pit census (`gridFor(…, {guards: false})`) carries no K/T gates.
  - Otherwise L40's struck-block check throws: `seedlingBlockPaths.blockOk` refuses a block on any gated cell.
  - The Fire guard decides from the rooms as they were.
- A LavaTrap lift whose `from` tile is now gated leaves from the sub-regions beside it. Without this, L108's ferry and L80's south half became unreachable, which the first build measured.
- Exempting the trap tile from K too keeps L80's r6c4 a sub-region. Without it, L80 north and south split.

**Amendment 6.** A K gate and a T gate on one cell compose to `And(Dark Suit, kill arm)`. The unit row checks this through the producer's own resolver, and the real L77 row shows it: the route needs both.

## Runs index (`…-evidence/`)

| file | what |
|---|---|
| `producer-wiring.patch` | the producer side (apply on this branch to reproduce every measurement) |
| `runs/composed-{base,tip,Konly,Tonly}-rules.json.gz` | AP_1 composed with the derived table hidden (`tools/composedDump.mjs`) |
| `runs/route-diff-{tip,Konly,Tonly}.txt` | `tools/routeWalk.py --diff` (236 / 236 / 4 moved routes) |
| `runs/spheres-*.txt` | `tools/vanillaSpheres.py` (vanilla-placement spheres) |
| `runs/guards-tip.txt` | every K cut and T disc by level (`tools/guardsReport.mjs`) |
| `runs/play-l77-trap-north{,2}.log`, `runs/game/arrive-L77-*` | the trap from the north on the game. The (72,184) boot sits inside the disc, so the trap never arms (`wait` starts true, `LavaTrap.as:26,82,103`): that run is void |
| `runs/rules-check-base.log` | the producer `--check` at base: only the stale-table error the base already carries |
| `tools/chase/` | the chase witness's tools (repo-root path fixed), plus `l77rev.mjs` |
