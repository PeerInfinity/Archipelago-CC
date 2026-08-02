# Seedling bot — rung 4 Opus kickoff: HAZARDS + THE EQUIP PRIMITIVE

**Status:** design ruled (Fable session 2026-08-02); **slice 0 RUN 2026-08-02
— see §8, which contradicts §§2–3 in three load-bearing places and is waiting
on user rulings before the AS3 batch is finalised.** §§0–7 are the original
brief and are preserved verbatim; where §8 disagrees with them, §8 is what
the instruments and the game said.

**Read first:** `docs/json/developer/procgen/seedling-bot.md` (the standing
contracts, v1+v2+R0–R3 — §R3 especially), then
`CC/docs/plans/seedling-bot-subtractive-plan.md` §5 (the ladder), then
`CC/docs/plans/seedling-bot-r3-opus-kickoff.md` §8–§12 (§12 is R3 as built).
Memory: `project_seedling_bot_r3` → `_r2` → `_r1`.

## 0. Mission in one paragraph

R4 re-arms the remaining hazards — per hazard, cheapest first: **lava → ice
→ water/waterfall LAST, sound riding with water** (user 2026-07-31) — and
pulls the **equip/selection primitive** forward (user 2026-08-02), which
brings the spear into play and with it **health**: the target is **7 items
REAL-collected and `hitsMax == 4` as a POSITIVE**, over a headline walk whose
`noHazards` is **EMPTY** (pits have been live since R1). One AS3 batch, ONE
build (`FRESH=1`, ~40 min cold), on fork `bot` @ `38ff4da`. The game is the
only oracle; frozen fixtures stay byte-identical; every opened-blocker claim
is a PAIR; instruments propose, the shipped planner confirms. The rung's
headline is not "more hazards survived" — it is **the same walk with the
last terrain crutch off and one more item earned by real mechanics**.

## 1. Settled rulings — do NOT re-litigate

1. **R3's baseline stands**: 6 items REAL-collected, `hitsMax == 3`, 12,122
   ticks, `grants` EMPTY, flags off = exactly 10 declared + 1 earned by
   touching + 6 the pickups wrote. The three leg verbs (hold / touch /
   collect) and the earned-clear banking are settled machinery.
2. **Hazard order**: lava → ice → water/swim LAST; the sound-stub recon and
   any sound-coupled modelling wait until water is the rung being armed
   (user 2026-07-31). §2.7 records a wrinkle this creates and §3.4 the
   ruling-respecting way through it.
3. **The equip primitive comes forward into R4** (user 2026-08-02); health
   returns; target = 7 items, `hitsMax == 4` as a positive. This forces the
   one AS3 batch.
4. **The `saw_auto_advance` counting fix rides that batch** (the R3 §12.5
   blind spot). ⚠ §2.9: it must be VERSION-SCOPED or the byte-inertness
   gate fails by design.
5. **A rung-scoped verify tier (`--tier=rung`) lands before R4 iterates.**
6. Carried standing law: pits live since R1; the game is the only oracle;
   frozen fixtures byte-identical forever; every opened-blocker claim is a
   PAIR; instruments propose, the shipped planner confirms; zero AS3 outside
   the one batch — anything discovered later is a finding to report, not a
   second build.

## 2. Recon (this session, source-verified against fork `bot` @ 38ff4da)

### 2.1 The selection machinery, read end to end

- `Player.input()` fires `useItem(Main.primary)` on `Input.pressed(keys[4])`
  (X) and `useItem(Main.secondary)` on C (`Player.as:1539-1546`).
- **`useItem(i)` switches on `Inventory.getItem(i)` — the ITEM ID stored in
  slot `i`** (`Player.as:1553-1591`): 0 (sword) and 4 (ghostsword) →
  `slashing`; 3 (spear) → `spearing`; 1 (fire) → `firing`; 2 (wand) →
  `wanding`; 5 (firewand) → both. An out-of-range slot returns `undefined`
  and the switch is a silent no-op — which is why the Bot-side validation in
  §3.1 is loud.
- **`Main.primary` is a SLOT INDEX, and it is a SharedObject-backed
  getter/setter**: `get` returns 0 when the saved value is falsy, `set`
  writes `SAVE_FILE.data.primary` (`Main.as:159/186`). No other side effect.
  Every item flag the ladder already flips (`hasSword` etc.) rides the same
  `SAVE_FILE.data`, and every recording to date is deterministic across
  fresh pages — so the write adds **no new persistence risk**; slice 0
  confirms the recompiled runtime's SharedObject is page-local anyway
  (cheap: two fresh loads, read back).
- **Slot order comes from `Inventory.addItemsFromSave`**
  (`Inventory.as:277-318`): sword pushed first, then fire, then wand, then
  spear (fusions replace-at-index; none at R4). Under R4's item set the
  array is `[sword, spear]` — **slot 1 is the spear, and ONE equip event
  suffices for the whole walk**: `genericHit` routes the spear thrust
  through the same arms as the slash (`BreakableRock`, rope, enemies), so
  everything a sword press could do post-equip, a spear press also does,
  and the bridge is Spear-only (`Player.as:1098`). ⚠ `Inventory.removeItem`
  re-derives `Main.primary %= items.length` — not reachable at R4 (nothing
  removes items) but transcribe it, don't skip it.
- **The game's own debug warps write `Main.primary`**
  (`Player.as:1793/1812/1832/…` — `Main.primary = Main.secondary = 0` in
  every warp), the same precedent family as R1's `Inventory.help = false`.
- **The real inventory UI**: `V`(86)/`I`(73) are ALREADY legal tape keys
  (`tapeFormat.KEY_CODES`). The toggle needs `firstUse`, which goes true on
  the first `Inventory.update` after `items.length >= 2` even with `help`
  suppressed (`Inventory.as:160-166`) — i.e. from the spear collection on.
  But **`set open` IS `Game.freezeObjects = _open`** (`Inventory.as:139`),
  and `Inventory.update` runs from `Game.update` under `canInventory()`
  (`Game.as:974/1477`). If open frames are DEAD frames, no tape span can
  ever reach the UI — the structural reading (one writer, nothing clears
  the flag per frame while open) predicts exactly that. ⚠ **R3 §8.7 is the
  law here: the ceremony probe inverted that rung's plan. PROBE FIRST,
  against the existing build, before the batch is finalized** — a `V` span
  + arrows + X on a booted level, watching tick vs `dead_frames`. Predicted
  outcome: dead → the UI is unreachable by tape → §3.1's tape directive.
  If the probe surprises (ticks consume, dialogue-style), the zero-AS3
  option becomes live and §3.1's decision flips to it.

### 2.2 The bridge's cycle — LATCH within a visit, RESET across visits

- The only decrement from gameplay is `Player.as:1098`:
  `(e as Tile).bridgeOpeningTimer--` under `t == "Spear"`, inside the swing
  loop. One hit tips the timer 60 → 59.
- Everything else is `Tile.render()` case 29 (`Tile.as:344-378`), **behind
  the `onScreen` early-return**: at `>= 60` the tile sets `type = "Solid"`
  (closed); at `0 < t < 60` it **self-decrements once per rendered frame**
  and stays `"Solid"` (opening); at `<= 0` it sets `type = "Tile"` — open,
  walkable, terrain state 29 (`moveSpeeds[29]` = plain walk). Nothing ever
  re-increments: **within one world instance the open state is a LATCH.**
- `Tile.types[29]` is `"Unused"` and the timer is an instance var with no
  persistence: **a re-entered level rebuilds the bridge CLOSED**, and a
  bridge that has never rendered on-screen is type `"Unused"` — blocking
  nothing and matching no terrain candidate. So the type is a function of
  *render-while-on-screen history*, which the model does not have a camera
  to compute. §3.3 turns that into a policy instead of a camera
  transcription.
- **So: not a timing window on the route** — no re-close countdown to race.
  The route constraints are: (a) one spear press per visit per bridge,
  (b) the ~60 on-screen frames of opening before crossing (still Solid
  while opening), (c) a RETURN through the same level meets it closed
  again — re-spear or route the return elsewhere.
- On-route bridges: **L63 has exactly one, tile (2,9)** — the health seal.
  L61 holds the other two at (10,13)/(11,13); R2/R3 walked L61 without
  them, and slice 0 re-verifies the R4 route still does.

### 2.3 The health chain, per instance with counts

**L63** (`Dungeon6/4.oel`, 20×20; 268 pit + 1 bridge + 4 lava + 10 water +
6 waterfall tiles): 2 `jellyfish` (160,64 / 192,56), 1 `grenade` (128,128),
4 `darktrap` (64,96 t2; 80,64 t8… tags 2/3/4/8), 1 `spinningaxe` (128,80),
`chest` (224,80, tag 5), `buttonroom` (32,64, `{tset 0, tag 0, room 62}`),
3 `lightpole` (`tset −1`, tags 1/6/7), 8 teleporters (to 61 ×3, 62 ×2,
65 ×2 south at (32,304)/(128,304)). ⚠ The buttonroom presses **into L62's
persistence** (`room: "62"`) — the L38 lesson's shape; slice 0 must check
whether any L61→L63 arrival lands on it and what L62 (still on the route)
does with tag 0.

**L65** (`Dungeon6/6.oel`, 15×15; 155 pit): **`rock@192,96` is a PLAIN
SOLID** — `Scenery/Rock.as` is an Entity with `type = "Solid"` and no hit
handler; R2's "rock **or** pushable" collapses: **the only opener is
`pushableblockspear@176,128`**. `PushableBlockSpear extends
PushableBlockFire` with `moveTypes = ["Spear"]`; `hit(p, t)` slides the
block **one tile away from the hit point** (atan2 toward the hitter,
opposite-signed tile target, `bothRange 0.1` lets a diagonal press move
both axes) and ignores hits while already moving (`v.length > 0` guard).
Also present: `bob@208,80` (**a chaser** — `runRange = 80`, steers at the
player every tick, and the room is 240 px wide: he WILL be glued to the
player at the block), `turret@64,112` (an enemy that is Solid),
`darktrap@144,144` (tag 1), `opentree@176,48` (the pixelmask whose 10×12
doorway R2 already models), 2 `lightpole` (`tset −1`, tags 0/2 — one at
(176,120), directly beside the block), the L68 door at (184,64).

**L68** (`Dungeon6/9.oel`, 5×6, **enemy-free**): `health@16,16` (tag 2),
and — stacked on the SAME tile (16,32), the only approach column from the
door at (16,80) — **`bosslock {keyType 4, tag 0}` AND `magicallock
{tag 1}`**. The keyType-4 key is `bosskey@48,64` in **L67**, whose only
entrance is L59's door at (0,128) (unreachable under every clear list, per
R3); the magicallock opens only to a wand shot (R5). **Neither L68 lock is
openable for real at R4 → both join the DECLARED clear list** (§3.5), and
health's real work is the bridge + the block push. `BossLock.check()` and
`MagicalLock` despawn on a cleared tag like any `Lock`, so the declared
clears open the column at boot.

### 2.4 The enemy audit for the press policy (§3.2)

- **All contact damage in the chain ends at `Player.hit()`**:
  `Enemy.hitPlayer` (`Enemy.as:211`) is `collide("Player", x, y)` →
  `p.hit(...)` — exactly what `Bot.noDamage` guards. None of R1's seven
  reach-around classes is present in L63/L65/L68.
- **`Enemy.hit`'s NON-DEATH path draws no RNG**: hits += d, `hitsTimer`,
  knockback, a sound (`Enemy.as` hit body). RNG and `Coin` spawns are
  **death-only** (`startDeath` → `dropCoins`, `Math.random` at
  `Enemy.as:123`), plus one **constructor-time** draw per enemy
  (`coins: 4 + Math.random()*4`, `Enemy.as:30`) that is already in the
  deterministic stream at every level build.
- **`DarkTrap.hit()` is overridden EMPTY** — unkillable by any press — and
  `SandTrap` (its base) writes no player state: the chomp is animation +
  sound; `knockback()` is overridden empty. ⚠ **A DarkTrap DIES from a
  non-player `Light` within `radiusMin`, and `SandTrap.removed()` writes
  `setPersistence(tag, false)`** — so a lightpole group coming on near a
  darktrap adds tags to the ledger that no tape declared. Slice 0 audits
  light-adjacency for the four L63 + one L65 darktraps and feeds the
  expected `persistence_cleared` set.
- `Grenade`: `knockback` empty, triggers near the player, damage via
  `p.hit` — guarded. Its self-destruction path needs one slice-0 read: does
  it run `dropCoins`?
- **The swing hits EVERYTHING in its rect** — `collideRectInto` then a loop
  (`Player.as:887-908` slash; `:940-970` spear). An interposed enemy does
  not eat the bridge hit. The slash gates on line-of-sight except against
  Solid/Rope/Flyer; **the spear has NO line-of-sight gate** and its rect is
  32×5 from `spearX/spearY`. Post-equip, every stray ceremony press is a
  spear thrust with 32 px of reach — the press audit uses the spear rect.

### 2.5 Hazard geography — the corrected sweep

⚠ **Trap: tileset COLUMN ≠ tile type.** The tiles-layer switch
(`Game.as:1902-2007`, transcribed as
`seedlingSemantics.TILE_COLUMN_TO_TYPE`) maps column 24 → ice(22), columns
27–32 → waterfall(25) variants, column 36 → bridge(29). A hand sweep using
`tx/16` as `t` reports lava as ice and misses bridges entirely. Any R4
instrument goes through the semantics table.

Per-level hazard tiles on the R3 route (+ the health chain):

| where | water | lava | waterfall | notes |
|---|---|---|---|---|
| L0 / L3 / L11 | 70 / 32 / 10 | — | 2 / — / — | overworld + D1 |
| L89 / L87 / L44 | 65 / 115 / 54 | — | 10 / 5 / — | overworld |
| L37 (region2) | **308** | **28** | — | both, on one route level |
| L12 (region1) | 121 | — | — | |
| L30 | 21 | — | — | |
| L95 / L59 / L60 | 2 / 16 / 18 | — | 14 / 28 / 12 | D6 approach (pits already live) |
| L85 + D7 (71,74-79,82) | — | 41 + **99–288 per level** | — | the darkshield/darksuit tail |
| L63 / L65 / L68 | 10 / 5 / 3 | 4 / — / — | 6 / 6 / — | the health chain |

- **Ice does not exist on the route at all**: t=22 appears ONLY in Dungeon 5
  (L45–L56) and L93 (finalboss). The ice step has zero route contact —
  §3.4's ice witness is synthetic by necessity.
- **There are exactly three shieldlock-family placements on the whole map**
  — L12 tag 10, L20 tag 0, L71 tag 2 — and none is in an ice level. The
  prompt's `turnOff`-`if (p)` concern (a 40 px ice coast vs the 5 px
  margin) has **no reachable instance**: the enumeration IS the
  strengthened bounded-vacuity witness (§7 G1).
- **Dungeon 7's floors are saturated with lava** (up to 288/400 tiles), so
  whether the R3 walk ever STANDS on a lava tile is the lava step's first
  question — answered by instrument, not by eye (§4 slice 0: replay the
  committed R3 tapes through the model and log the RAW resolver state per
  tick, per leg; the model is tick-exact against the recordings, so this is
  free and authoritative).

### 2.6 The effect sites, one inventory

- **The sticky flags**: `getState`'s raw-change gate (`Player.as:701-724`)
  sets `onIce = eff==22`, `onWaterfall = eff==25`,
  `inWater = eff==1 || eff==25`, `inLava = eff==17` **only while
  `onGround`, only on a raw `_s != _state` change**; not-onGround clears
  all four. They are sticky between changes, like `state` itself.
- **The speed/friction site** (`Player.as:516-533`): `onIce` →
  `slidingFriction = 0.025`, `slidingSpeed = 1` (replacing BOTH); else
  coerced-speed re-application (the known :523-ish site), then
  `if (inWater || inLava) { f = WATER_FRICTION; moveSpeed =
  moveSpeeds[state] + 0.25 * int(Music.soundPosition("Swim") < 0.1); }` —
  note **`moveSpeeds[state]` is the RAW state** here, and
  `Music.playSound("Swim")` fires at `:533`.
- **The waterfall push** (`Player.as:1537-1540`): `if (onWaterfall &&
  (!hasFeather || v.y >= 0)) v.y += 0.8` — the feather (held since R3)
  exempts upward motion only.
- **Drowning** (`Player.as:1426-1450`): both tests read the **COERCED**
  state — water without `canSwim` → drown spiral; lava without
  `hasDarkSuit` → `hit()` + drown. `drown()` forces `v` onto a cos/sin
  thrash and `die()`s when its 0.5/tick timer wraps — distinctive,
  deterministic, and recordable short of death.
- `moveSpeeds`: 1 → `dMSwater`, 17 → `dMSwater`, 25 → `dMSwater/2`,
  22 → `dMS` (ice speed comes from the `onIce` branch), 29 → `dMS`.
- **The pit landing check stays RAW** (`getStatePos`, uncoerced) — arming
  hazards changes nothing there; it always read raw.
- ⚠ **Removing a name from `noHazards` only stops the coercion.**
  `assertModelledTerrain` currently THROWS when the player stands on an
  armed water/lava/ice/waterfall tile, and `plannerBlockerAt` reports it as
  unmodelled. Each hazard step must either (a) extend the modelled set with
  the real physics above, or (b) keep the throw and make the tile
  **planner-forbidden floor** (the pit precedent) so no run ever stands on
  one. §3.4 chooses per hazard.

### 2.7 ⛔ The sound coupling is `inWater || inLava` — the LAVA rung inherits the sound question

The ruling "sound is last, it rides with water" was made against the swim
speed. But the term at `Player.as:530` fires for **lava too**: any tick with
`inLava` true carries `+0.25 * int(Music.soundPosition("Swim") < 0.1)`.
`soundPosition` reads real channel positions (`Music.as:583`), and the
recompiled runtime's comment says **"channel positions only advance when an
output sink pulls"** (`SWFModernRuntime/src/avm2/avm2_media.c:19`) — so the
term is plausibly a constant `+0.25` in the replay harness, but that is a
hypothesis, not a fact.

**The ruling-respecting resolution tree, in order:**
1. Slice 0's raw-state audit: if no R4 leg ever stands on lava (and the
   planner can keep it that way — §3.4), `inLava` is never true, the term
   never evaluates, and the sound recon stays parked at the water step
   exactly as ruled.
2. If a leg MUST stand on lava (the `71 ⇓ 82` arrival is the candidate —
   L82 is 288/400 lava), the lava pair fixture (§3.4) doubles as the sound
   probe: record the same stand-on-lava tape twice on fresh pages; byte
   equality answers determinism and the observed speed reveals the term's
   value. **If it is not deterministic, standing on lava is impossible to
   exact-model, the leg becomes a re-route-or-escalate, and the user hears
   about it at slice 0** — with this evidence, not as a silent early sound
   project.

### 2.8 Boss keys: what can be EARNED vs what stays DECLARED

Mechanics: `BossLock.update` opens on a **line-collide beneath it while
`Player.hasKey(keyType)`** — proximity, no key press: a 60-tick `keyTimer`
then a ~20-tick fade, then `type = ""` + `setPersistence(tag, false)`. ⚠ It
**re-closes and re-writes the flag TRUE** if the player leaves before the
fade completes (the `else if (type != normType)` branch) — the button lock's
occupancy shape, NOT the shieldlock latch. A real open is therefore
hold-shaped (~80 ticks standing beneath) and the l71 pair pattern applies.
`BossKey` is a `special` pickup (ceremony; text only for keyType 0 — the
others are the known `text: ''` 150-frame case) whose `removed()` writes
`hasKey` — collection is the existing `collect` verb.

The census (extract, per instance): keyType 0 key @ **L19** (a room that
also holds its own keyType-0 lock), locks L12 tags 4+5 (a double door) +
L19 tag 1. keyType 1 key @ **L29**, locks L30 tags 0+2, L31 tag 0, L12
tag 3. keyType 4 key @ **L67**, locks L66 tag 0, L68 tag 0, L12 tags
11+12. (keyTypes 2/3 live in D4/D5, off route.) Doors: L29 ← L21 (160,80)
and L22 (192,64), **both `tag −1`, always active, both on route levels**;
L19 ← L18 + stairs from L20; L67 ← L59 (0,128) only.

R3's slice-0 verdicts were: L29 "reachable only through a bosslock clear"
(circular), L19/L67 unreachable under every clear list, L19 a boss room the
census cannot build. **But those verdicts were computed with R3's
clearances.** R4 changes the question twice: the spear opens breakables and
bridges for REAL, and the press policy (§3.2) may legalize swings in rooms
the R3 policy forbade. Slice 0 re-runs reachability for L29/L19/L67 under
R4's mechanics. Expected outcomes: **L29 either becomes earnable (collect
keyType 1 → hold under L30 tag 0 → the L30 clear and L12 tag 3 RETIRE into
real opens) or stays circular and the four bosskey-shaped clears are
relabelled R5/R6 with the evidence** — either answer is a finding; what is
not acceptable is leaving them labelled "R4" with no earner.

### 2.9 ⛔ The `saw_auto_advance` fix is NOT byte-inert — version-scope it

The fix (count a `Help` dismissal, which ends its freeze on phase 0 — the
press — where the counter today only increments on phase 1) changes the
REPORTED VALUE for every R3 collection fixture: the sword's `Help(3)` is
auto-advanced on every replay, the frozen expectations say
`saw_auto_advance: 0`, and the verify sweep asserts that field per tape. An
unscoped fix fails the inertness gate on ~8 frozen fixtures *by being
correct*. **The fix must gate on `tape_version >= 4`** (value-scoped, like
the v1 check — the R0 lesson): v≤3 tapes keep the bug-compatible count,
v4 tapes get the honest one. The R4 headline then asserts the counter as a
POSITIVE — exactly 1 (the sword's Help) — for the first time on the ladder.

### 2.10 Tape budget

Ceilings (R3 §8.5): ~2100 spans AND ~95–159 KB, independent.
R3's headline: 53 legs / 12,122 ticks well inside both.
R4 adds the health detour (~6–8 legs), possibly an L29 key detour, one
equip directive (not a span), ~2 press spans, and hazard re-routes of
unknown size (the slice-0 audit bounds them).
`tapeFormat.assertTapeWithinRuntimeBudget` already fails synthesis loudly;
slice 0 projects the number, slice 8 proves it.

## 3. The design

### 3.1 The equip: a tape-declared directive, applied by the Bot, read back from the game

**Recommended (Option A): tape v4 adds `equips: [{t, slot}]`.** `Bot.as`
applies `Main.primary = slot` at the same site grants fire (right after
pushing observation `t`), and **validates loudly at fire time**:
`slot < Inventory.items.length` or the run errors naming the tick — because
`useItem` on a bad slot is a silent no-op (§2.1), the exact failure mode a
tape format exists to prevent. The JS side mirrors it in the inventory
mirror, which gains the `addItemsFromSave` slot model (order: sword, fire,
wand, spear; fusion splices transcribed even though unreachable at R4).

**Two-sided observability, the R3 way (readout scanned, never echoed):**
`botStatus` gains `primary` (read from `Main.primary`) and
`inventory_slots` (scanned from `Inventory.items`). The differential
asserts both against the JS mirror's prediction on every tape — so a
slot-order divergence (the exact two-consumers risk R0 warned about for
every new tape field) is a named failure at the first observation after any
collection, not a mystery `slashing`-vs-`spearing` divergence later.

**Why this is UI suppression, not a crutch to retire:** the write grants
nothing — the slot must already hold the item, the validation enforces it,
and `useItem` still routes through `Inventory.getItem`. The inventory UI's
only game effect IS `Game.freezeObjects`. The game's own debug warps write
`Main.primary` (§2.1). Precedent: `Inventory.help = false` (R1, ruled
not-a-crutch). **User confirms this classification at slice 0.**

**Priced and not chosen:**
- *(B) Drive the real UI by tape spans* — zero AS3 for the mechanism
  (V/I are legal keys, `firstUse` is satisfied post-spear), but predicted
  impossible: `set open` freezes, frozen frames are dead frames, dead
  frames consume no tape. **The slice-0 probe settles it** (R3 §8.7
  precedent — do not skip the probe because the prediction is confident).
  If the probe shows open frames consume ticks, B wins (doctrine: behaviour
  lives in tapes) and the batch shrinks to readouts + the counter fix.
- *(C) An autoAdvance-style AS3 pager driving the real UI during dead
  frames* — a multi-step state machine (open, N steps, select, close) in
  the layer that is deliberately dumb, ~5 new Bot states, deterministic but
  unobserved dead-frame consumption, and R6 would keep it anyway (a tape
  still cannot reach frozen frames). Strictly more AS3 for the same claim
  strength as A with worse legibility. Declined unless the user overrides.

**Placement discipline:** ONE equip (slot 1) scheduled after the spear
collection; segment tapes booting later inherit it as `equips: [{t: 0,
slot: 1}]` exactly as they inherit items via the boot grant, and the chain
assertion checks `primary` carries across every boundary. After the equip,
every stray ceremony press is a SPEAR (32 px, no LOS gate) — the §3.2
audit runs with the spear rect from that tick on. If slice 0's audits find
a room where a spear stray is illegal but a sword stray is fine, the
fallback is a second equip (slot 0) — the directive is cheap; the AUDIT is
the constraint.

### 3.2 The press policy: replace "enemy-free rooms only" with a per-press audit

The §3-era policy (swing/shoot only in rooms whose census shows zero enemy
entities) forbids the health chain outright (L63: 7 enemies; L65: 3). The
evidence assembled in §2.4 supports a narrower rule that keeps every reason
the blanket rule existed:

**A press at tick T in level L is legal iff, cited per instance:**
1. Every entity the press rect could contain is classified, and every
   enemy among them either **cannot be damaged** (DarkTrap: empty `hit()`)
   or **provably survives the walk's worst-case press count**
   (hits × damage < `hitsMax`, from the class's own numbers — slice 0
   tables this for jellyfish, bob, turret, grenade). Death is the RNG/coin/
   `totalEnemies` event; a non-death hit draws nothing (§2.4).
2. No `tSet == −1` group in L changes GEOMETRY the model tracks if
   `totalEnemies()` moves — at R4 nothing may kill, so this is a belt
   check: enumerate the groups (L63 tags 1/6/7, L65 tags 0/2 — all
   lightpoles; slice 0 reads what a lit lightpole DOES; expected: light,
   i.e. cosmetic-plus-DarkTrap-death, which routes into the ledger audit).
3. Non-enemy responders in the rect are intended or inert: `lightpole`
   (spear-hittable Activator — a stray hit TOGGLES its group; the audit
   treats an unintended lightpole hit as illegal), pushables (an unintended
   push is a route change — illegal), bridges (an unintended decrement is
   an early opening — audit), grass (cosmetic + `grassCut`).
4. `noDamage` stays ON (it is — R4 does not touch it), so enemy CONTACT
   during the press is a no-op (`hitPlayer` → `Player.hit`, guarded), and
   a chaser glued to the player (bob) is an audit line, not a blocker.

The executor enforces this the way it enforces everything: the model knows
every press tick and rect, the audit is a pure function over the census +
class table, and an unaudited press is a THROW at synthesis. **If any
required press fails its audit (e.g. bob's HP arithmetic fails against the
worst case), that is a slice-0 escalation with the arithmetic attached —
the fallback of shrinking the target to 6 items is priced THEN, not
mid-implementation** (R3's second shrink cost a re-plan; the discipline is
priced-at-slice-0).

**User ruling wanted at slice 0** (the prompt's ⛔): adopt the audit policy
above, or hold the blanket rule and accept health → R5 (target back to 6,
`hitsMax == 3`, contradicting ruling 3 — so this branch exists to be
declined explicitly, on the record).

### 3.3 The bridge policy: on-screen by construction, per-visit state in the run

- The model does not grow a camera. Instead the leg vocabulary gains the
  fourth verb — **`spear: {target: {x, y}}`** (by OEL/tile coords, resolved
  like `exit`/`presser`) — and the executor asserts, from the run's own
  state, that **the player stays within a conservative on-screen radius of
  the bridge tile from the press tick through the crossing tick**. Slice 0
  derives the radius from the camera code (160×160 screen, follow-with-lag,
  `view()` clamp) with the lag bounded worst-case; expected ≈ 48–64 px,
  and the L63 press-to-crossing geometry sits well inside it. A leg that
  cannot satisfy the policy is a synthesis throw, not a model guess.
- The opening is ~60 rendered frames during which the tile REMAINS SOLID;
  the executor holds the player (a `hold`-shaped wait without a presser)
  and verifies the type flip by EFFECT with the l71 pair discipline: the
  pair fixtures are **`l63-bridge-spear-open`** (press, wait, cross) vs
  **`l63-bridge-shut`** (same tape, `equips` emptied — the press is a
  SLASH, the timer never decrements, the sweep pins the player at the
  bridge edge). One field apart; the shut arm is also the equip primitive's
  negative control.
- **`levelRun` gets a per-visit state family**: `openBridges` lives beside
  `openActivators`/`takenPickups` but — unlike banked clears — **resets on
  every world (re)build**. The return through L63 is planned against a
  CLOSED bridge (re-spear, or exit via the west doors to L61 — slice 0
  picks by geometry).

### 3.4 Per hazard: what re-arming changes, and the witness for each

The uniform floor rule first: **an armed hazard tile is planner-forbidden
floor** (the pit precedent) unless a rung explicitly models standing on it.
`plannerBlockerAt` gains the armed set; `assertModelledTerrain`'s throw
retires per hazard exactly as far as that hazard's physics lands, no
further.

**Step 1 — LAVA** (`noHazards` drops to `["water","ice","waterfall"]`):
- Route contact: L37 (28 tiles) + L85 + all of D7 (§2.5). The slice-0
  raw-state audit says which legs currently stand on lava; those legs
  re-plan with lava forbidden. The one suspect that may not be avoidable is
  the `71 ⇓ 82` pit arrival (L82: 288/400 lava — including, possibly, the
  landing tile, which the landing check already reads raw).
- Physics if any standing survives the re-plan: `inLava` (sticky, §2.6),
  `WATER_FRICTION`, `moveSpeeds[raw]` + the sound term — gated on the
  §2.7 tree, darksuit held (it is, by route order — darksuit precedes the
  return to 71's pit) so `checkDrowning`'s lava arm stays quiet.
- Witnesses: **`l71-lava-stand` / `l71-lava-coerced`** — same tape, one
  `noHazards` entry apart; the armed arm shows the speed/friction change
  (and doubles as the sound probe, §2.7), the coerced arm walks at 0.8.
  Plus a **drown-arm** knife-edge if cheap: the same stand WITHOUT the
  darksuit grant, recording the first thrash ticks of `drown()` — the
  distinctive forced-velocity signature, stopped well short of `die()`.
- Expected verdict to confirm by instrument: **re-arming lava changes the
  ROUTE (D7 legs re-plan onto dry basalt) and not the modelled physics**
  (nothing stands on it), with the L82 arrival the one candidate
  exception.

**Step 2 — ICE** (drops to `["water","waterfall"]`):
- **Zero route contact** (§2.5: D5 + L93 only). The walk does not change.
  The honest rung content is: the physics lands in the engine (`onIce`
  sticky flag; friction 0.025 and speed 1 REPLACING both — a ~40 px coast),
  the planner forbids ice floor, and the witness is **synthetic by
  necessity**: a `hazard-boot-pit`-style pair booting into a D5 room
  (L45/L46 have 59–63 ice tiles), sliding, recording the unmistakable
  0.025-friction decay — armed vs coerced, one field apart.
- The `ShieldLock.turnOff` `if (p)` vacuity: **stays bounded, now with an
  enumeration witness** — three shieldlocks on the map, none in an ice
  level (§2.5), so no route and no authored tape can slide out of a touch
  window. Recorded in the §7 G1 list, replacing the R3 arithmetic-only
  witness.
- ⚠ The bounded statement must be NAMED in the rung close ("ice armed;
  no route contact; witness synthetic") — a bounded sweep names what it
  bounded.

**Step 3 — WATER + WATERFALL + SOUND** (drops to `[]` — the rung's
terminal state):
- The broadest contact: water on ~11 route levels, waterfall tiles on 8.
  `canSwim` is R5-blocked, so **water is forbidden floor everywhere at R4**
  — the raw-state audit sizes the re-route (the R2/R3 planner flattened
  water, so A\* may well have crossed lakes; every such leg re-plans on dry
  land). If some crossing has NO dry route, that item's legs revert and the
  blocked list says so — that is the ladder working, and it is priced at
  slice 0, not discovered at slice 8.
- Waterfall: `inWater` includes eff 25, and the push at `:1537` interacts
  with the feather (held). If no route tile is waterfall (audit), the
  physics still lands (it is three lines) but the witness is synthetic,
  named as such, in a D6 approach room (L59: 28 tiles).
- Sound: per ruling, ANY modelling of the `soundPosition` term waits for
  this step — unless §2.7's tree forced the lava-step probe, in which case
  this step inherits its answer.
- Witnesses: the drown-thrash pair (armed water, no canSwim, first thrash
  ticks) vs coerced; a waterfall-push pair if any authored tape can reach
  one cheaply.

**Rung-terminal claim: the headline tape declares `noHazards: []`** — the
first tape on the ladder with every terrain mechanic live. (Frozen v2/v3
fixtures keep their declared sets and replay bit-identically against the
same build — the R0 set-not-boolean design paying its rent; say so in the
close-out.)

### 3.5 The clear bill, computed not assumed

The R3 lesson is standing law: **compute with the shipped planner, at the
pickup's own tile, with the driver's clearances** — the recon's 8 became
the planner's 10 for three different reasons.

Movements at R4, to be CONFIRMED by the planner:
- **+2 DECLARED**: L68 tag 0 (bosslock, keyType 4 — key unreachable, rung
  R5/R6 per §2.8's verdict) and L68 tag 1 (magicallock — wand, R5). The
  bill GROWS; this is the priced cost of ruling health in, escalated at
  slice 0 for the user's confirmation, not slipped into a table.
- **−1 candidate retirement**: L3 tag 0 `breakablerock@96,112` — openable
  for REAL by a press (sword or spear, `genericHit`) if L3 passes the §3.2
  audit (L3's census: slice 0). A real break is a new small mechanic
  (BreakableRock hits/despawn + persistence write) with its own pair.
- **−2 candidate retirements** if §2.8's L29 verdict is "earnable": L30
  tag 0 and L12 tag 3 become real opens (collect keyType 1, hold under the
  lock, the l71 pair pattern).
- **L11 tag 0 (`chest@32,48`) stays DECLARED**, recommended: it exists
  because the CONTROLLER clips the avoid volume, not because the chest
  blocks; opening it for real adds a SealPiece ceremony + an RNG draw for
  zero route value. Rung-label it (the chest is openable the moment a rung
  wants it) and move on. User may override.
- Everything else in R3's ten: unchanged, rungs re-checked against §2.8.

The ledger claim (§7 G2) then re-derives: declared (10 ± the above) +
earned (L71 tag 2 touch, any bosslock/breakable opens) + the pickups'
**seven** `removed()` writes (six + health tag 2) + **the audited
enemy-death tags** (darktrap-by-light, §2.4 — expected members computed at
slice 0, asserted exactly).

### 3.6 Recording economy and the rung tier

- **`--tier=rung` lands FIRST** (slice 1, before any R4 iteration): the
  frozen SHORT fixtures + only the current rung's tapes; it NAMES what it
  bounded (which frozen walks it skipped) and results carry their tier —
  a `rung`-tier green is not a `full`-tier green and `compare-runs` must
  not diff across tiers.
- The full inertness gate (all 50 fixtures, ~1.5 h) runs ONCE, immediately
  after the batch build, before anything new is recorded. The rung close
  runs `--tier=full` again.
- Pair fixtures record per slice (~minutes each). **The headline + segments
  record ONCE, at slice 8** — intermediate hazard steps are gated by
  synthesis + vitest + their pairs, not by full-walk re-records. Segment
  boundaries at arrivals, split so any late re-route touches the fewest
  recordings (R1's lesson).

## 4. Slices

0. **RECON + INSTRUMENTS + THE PRICED VERDICTS.** The inventory probe
   (§2.1 — BEFORE the batch is finalized). The raw-state audit over the
   committed R3 tapes (§2.5/§3.4 — which legs stand on which raw tile
   types; sizes every hazard re-route). L29/L19/L67 reachability under R4
   mechanics (§2.8). The press audits with the HP arithmetic (§3.2), the
   lightpole/lit-group reads, the darktrap light-adjacency ledger audit,
   the grenade `dropCoins` read. The L63 buttonroom(room 62) arrival check.
   The bridge on-screen radius derivation (§3.3). SharedObject page-locality
   confirm. Span/byte projection (§2.10). **Escalations to the user, with
   evidence: the §3.2 policy ruling; the +2 declared clears; the equip
   not-a-crutch classification; any audit failure that threatens the
   7-item/hitsMax==4 target; §2.7 if lava-standing is unavoidable.**
1. **THE BATCH** — finalized ONLY after slice 0: `equips` (v4, validation,
   applied at the grant site) unless the probe flipped to Option B;
   `botStatus.primary` + `inventory_slots` (scanned); the version-scoped
   `saw_auto_advance` fix (§2.9). ONE build, `FRESH=1`. Then the full
   byte-inertness gate over all 50 frozen fixtures, then `--tier=rung`.
2. **The equip in JS**: the slots mirror (`addItemsFromSave` transcription),
   v4 parse (value-scoped version check — the R0 lesson), `useItem`
   routing, press-rect switching post-equip, segment inheritance + chain
   `primary` assertion. Pair: rides the bridge pair's shut arm (§3.3).
3. **Spear mechanics**: the bridge (model + per-visit state + the `spear`
   verb + the on-screen policy + the `l63-bridge-*` pair) and the pushable
   slide (PushableBlockFire transcription: target-tile mechanics, motion,
   solidity in flight and at rest + its own pair in L65). Optional: the L3
   breakable retirement if slice 0 ruled it in.
4. **The health chain**: route legs 61→63→65→68 and back (return-leg bridge
   answer), the L68 declared clears, the health `collect` (ceremony —
   `HealthPickup.removed()` calls `unlockMedal`, live-fire NOTE: the R3
   torch probe already proved a medal call survives the recompiled
   runtime), the press audits enforced at synthesis, the ledger arithmetic
   including audited enemy-death tags. Optional: the L29 bosskey earn if
   ruled in (collect + the hold-shaped open + its pair).
5. **Lava step** (§3.4): planner floor, re-routes, `l71-lava-*` pair (+
   drown arm), the §2.7 tree if forced.
6. **Ice step**: physics + synthetic D5 pair + the enumeration witness for
   the `if (p)` vacuity.
7. **Water/waterfall step**: floor policy, the audit-sized re-routes, the
   drown pair, waterfall physics + witness, sound per ruling. `noHazards`
   reaches `[]`.
8. **The R4 route + the walk**: shipped planner, pickup-tile narrowing,
   driver clearances, budget assertion at synthesis; segments + headline
   recorded; `r4Acceptance` as pure functions over the game's reports with
   every input mutated red in CI.
9. **Docs + close-out**: `seedling-bot.md` §R4, the subtractive plan's R4
   line rewritten as-built, memory topic, the honest what-still-blocks
   list (fire/ghostsword/firewand/conch/wand/darksword/shield + the ending,
   each with its rung).

Slices are ordered but not atomic-committed as one; each lands with its
tests green and its pairs recorded, R2/R3 style.

## 5. Discipline + traps (standing ones apply; live ones here)

- **Probes BEFORE the batch** — R3's probe inverted the plan; R4's
  inventory probe is the same shape. The batch is finalized at the END of
  slice 0.
- **Shrinkage ESCALATES and is priced at slice 0.** The target is 7 +
  `hitsMax == 4` by ruling; any audit that threatens it produces an
  escalation with arithmetic, not a quiet 6.
- **Read branch BODIES** (the bridge's three render arms; BossLock's
  re-close `else`; `addItemsFromSave`'s fusion splices).
- **Census claims are per-INSTANCE with counts** (§2.3's tables are the
  template; "L63 has darktraps" is not a claim).
- **Every opened-blocker claim is a PAIR**, one field apart where possible
  (`equips` emptied; one `noHazards` entry; `grants` emptied).
- **`assertRect` at every rect birth** — the spear rect, the slash rect,
  the block's target tile, every new avoid volume.
- **Hand sweeps of the extract go through `TILE_COLUMN_TO_TYPE`** (§2.5's
  trap — column 24 is ice, 36 is bridge; `tx/16` is a COLUMN, not a type).
- **A new tape field is a place for two consumers to disagree** (R0):
  `equips` ships with fire-time validation on the game side, a scanned
  readout, and a two-sided assertion on every tape — the full R3 pattern,
  not an echo.
- **Version checks are VALUE-scoped** (`tape_version === 4`), never
  presence-scoped — both consumers already learned this the hard way.
- **Per-visit state is not banked state**: `openBridges` resets on world
  rebuild; earned clears persist. Two families, two lifetimes — do not
  unify them.
- **Zero AS3 outside the one batch.** Anything found later is reported as
  a finding for the NEXT batch (the §12.5 precedent), not slipped in.
- **`--only=` on every recording; fresh page per tape; `--win` always;**
  deadlines scale with tape length; watch the progress sidecar.
- **mxmlc output is not reproducible** — the inertness gate is fixture
  replay, never artifact comparison.
- **Never `git add -A` with a background sweep running**; snapshot
  uncommitted files before mutation runs.

## 6. Open questions (ask the user only if blocking; otherwise slice-0 escalations)

1. §3.2 — the per-press audit policy replacing the blanket enemy-free
   rule (the ⛔ conflict; evidence attached at slice 0).
2. §3.5 — the +2 declared clears for L68 (the bill grows to cover health);
   plus the optional retirements (L3 real break; L29/L30/L12 if earnable;
   L11 stays declared).
3. §3.1 — confirmation that a validated `Main.primary` write is UI
   suppression (debug-warp precedent), not a crutch R6 must retire.
4. §2.7 — only if the lava audit forces it: the sound question arriving
   early, with the pair-fixture evidence.

## 7. Acceptance gates

**G1 (CI, vitest):** all green. Every frozen fixture's model replay still
byte-identical. New strata per mechanic: the slots mirror + equip routing;
bridge timer/on-screen policy/per-visit reset; pushable slide; per-hazard
physics (sticky flags, ice friction-replacement, waterfall push + feather
gate, drown spiral arithmetic); the press audit as a pure function; the
ledger arithmetic. A §7-style mutation list per stratum, with non-biters
recorded as **bounded vacuities with witnesses** — including: the
`ShieldLock.turnOff` `if (p)` arm (witness upgraded to the map-wide
enumeration: three shieldlocks, zero in ice levels), the ice step's
no-route-contact bound (named), and the bridge policy's camera bound
(policy asserted from run state, camera not modelled — named).

**G2 (local, `verify --win`):** frozen fixtures EXACT (full tier at rung
close; rung tier during iteration, tier stamped on results). Every
mechanic's PAIR fixtures EXACT — equip/bridge (`l63-bridge-spear-open` /
`l63-bridge-shut`), the pushable pair, `l71-lava-stand` / `l71-lava-coerced`
(+ drown arm), the synthetic ice pair, the water drown pair, and the
bosskey pair if earned. The R4 chain a **PARTITION** of its headline, tick
for tick, with `primary` asserted across every boundary. Acceptance asserts
the ruled claim **from the game's own reports**: the six item booleans plus
health — **7 items, `hitsMax == 4` checked as a POSITIVE on its own** (it
was R3's negative; health is the only adder, so 4 means exactly one grant
of it and 3 means the collection silently failed); **`grants` EMPTY** on
the headline; **`persistence_cleared` an EXACT SET in both directions**
(declared ± §3.5 movements + earned opens + the pickups' seven + the
audited enemy-death tags); `saw_auto_advance` asserted as its v4 POSITIVE
(exactly 1 — the sword's Help); `primary`/`inventory_slots` matching the
mirror on every tape; and **the headline tape declaring `noHazards: []`**
— the rung's defining line. The blocked list published with rungs:
`fire`, `ghostsword`, `firewand`, `conch`, `wand`, `darksword`, `shield`
(R5), the ending (R6).

## 8. Slice 0 — RECON, AS BUILT (2026-08-02)

Source-verified against `~/CC/seedling` branch `bot` @ `38ff4da`, the
committed extract, and the live build. **The rung's terminal state does not
survive it, and neither does its target**; §8.11 holds the escalations.

### 8.1 The instruments

- **`scripts/procgen/recon-seedling-r4.mjs`** — `--raw-states` (replay the
  committed R3 tapes and read the resolver's own raw sticky state per tick),
  `--hazard-tiles` (the static census, through `TILE_COLUMN_TO_TYPE`),
  `--floor-policy` (the R3 walk's own rooms re-asked under each R4 floor).
  The floor policy needs no new geometry: `plannerBlockerAt` already reports
  UNMODELLED TERRAIN as a blocker, and a hazard is unmodelled exactly when
  the tape's `noHazards` does not coerce it — so **dropping a name from the
  set IS §3.4's forbidden-floor rule**, at the shipped planner's own movement
  granularity, over the R3 clear list, and narrowed to the PICKUP'S OWN TILE
  (`componentsAround`) rather than to its level.
- **`scripts/procgen/probe-seedling-inventory.mjs`** — the §2.1 probe,
  against the EXISTING build, before the batch.

⚠ The raw-state audit is not a prediction about what the R3 walk did — the
model is tick-exact against the recordings, so it is a READING of what it
did. That is what makes a 1,392-tick answer trustworthy without a recording.

### 8.2 ⛔ THE HEADLINE: `noHazards: []` IS NOT AN R4 STATE

§3.4's rung-terminal claim ("the headline tape declares `noHazards: []`")
cannot be met, and the cause is not routing difficulty. Per hazard, armed
ALONE, over the R3 walk's own six item rooms:

| armed | nodes reachable | levels lost | what it costs |
|---|---|---|---|
| none (R3's floor) | 60 | — | the control: all six rooms reachable |
| **ice** | 60 | none | **nothing at all** |
| **lava** | 53 | L78 L79 L82 L96 L97 | **`darksuit`** |
| **waterfall** | 11 | 42 levels | five of six items |
| **water** | 10 | 42 levels | five of six items |

- **Ice is free**, confirming §2.5 and then some: not merely "no route
  contact" but no floor-policy cost either. It stays the cheapest step and
  its witness stays synthetic.
- **Water is R5-SHAPED, not R4-shaped, and the source says why.**
  `canSwim` **IS THE CONCH** (`Bot.as:798`: `case "conch": Player.canSwim =
  true`), and `Karlore.added()` despawns only on `Player.hasFire` — BobBoss,
  R5. So the swim gate is behind the same wall R1/R2/R3 have published for
  three rungs. And water is not optional floor: `checkDrowning`
  (`Player.as:1426-1450`) reads the COERCED sticky state, and
  ⚠ **`drownTimer` IS NEVER RESET OFF-HAZARD** — the only writes are
  `drownTimer = drownTimerMax` (10) on the first contact tick, the
  decrement, and `drown()`'s own spiral. So the whole-run budget for
  standing in water without `canSwim` is **eleven ticks, cumulative**, and
  then `drowning = true` → `drown()` → `die()`, which `noDamage` does not
  guard (it guards `hit()`, and the lava arm's `hit(null, 0, null, 0)`
  passes damage **0** anyway).
- **Waterfall is the opposite mistake.** §3.4 bundles it with water; the
  source separates them: `inWater = eff == 1 || eff == 25` but
  `checkDrowning` tests **`eff == 1` only**. **A waterfall cannot drown
  you.** So waterfall must be MODELLED floor, not forbidden floor —
  option (a) of §2.6, not option (b) — and treating it as forbidden is what
  produces the 42-level collapse above. Its physics is three lines
  (`v.y += 0.8` gated by the feather, `WATER_FRICTION`,
  `moveSpeeds[25] = dMSwater/2 = 0.225`) **plus the `soundPosition("Swim")`
  term**, which §2.7 expected only from lava.

⇒ **R4's terminal state is `noHazards: ["water"]`** (lava, ice and waterfall
armed), or `["water", "lava"]` if the user declines to pay for lava. Water
joins the published blocked list with its opener (`conch` ⇒ `fire` ⇒ R5)
named, which is the ladder working exactly as R1 and R2 worked.

### 8.3 What the R3 walk actually stood on

`--raw-states` over `r3-walk-full` (12,122 ticks). Runs of consecutive
observations whose RAW sticky terrain state was an R4 hazard:

| hazard | runs | ticks | levels |
|---|---|---|---|
| lava | 29 | **1,392** | 71, 74, 75, 76, 77, 78 |
| water | 17 | **1,187** | 0, 3, 12, 44, 60, 87, 89, 95 |
| waterfall | 4 | 71 | 0, 89 |
| ice | 0 | 0 | — |

⛔ **This kills §3.4's expected lava verdict outright** ("re-arming lava
changes the ROUTE and not the modelled physics — nothing stands on it"). The
R3 planner FLATTENED all four hazards, so A\* was free to walk across a lake
and across a lava floor, and it did: 1,392 ticks of lava and 1,187 of water.
It also **retires §3.4's "the waterfall witness is synthetic by necessity"** —
the walk stands on waterfall tiles in L0 and L89, so the witness is a real
route tile.

Collection ticks, for the ordering argument: darkshield t=9692 (L74),
darksuit t=11171 (L79). **Every one of the 29 lava runs is before t=11171**,
i.e. before `hasDarkSuit` — and the longest is 208 ticks against an
eleven-tick budget. Lava is not "slow floor the R4 walk could keep walking
on"; without the darksuit it is death, and the darksuit is on the far side.

### 8.4 The lava seal, named per entity

Under armed lava the loss is three doors, not a routing inconvenience:

| where | what splits | who holds the far side |
|---|---|---|
| **L77** | 1,025 cells → 77:0 (97) + 77:1 (18) | 77:1 holds the door to L78; the only dry corridor between them is covered end to end by `lavatrap@96,192`'s chomp disc and two `lavarunner`s |
| **L78** | 645 cells → four components | the L79 door is in 78:0 (4 cells); the corridors between are `lavatrap`/`lavarunner` discs |
| **L80** | 4 components | 80:0 (the L71 arrival, 16 cells) is walled by rows 6–11 of solid lava; 80:3 (21 cells) holds BOTH doors to L79 |

So the seal is a composite: **one genuine lava wall (L80) plus LavaTrap and
LavaRunner avoid volumes astride the dry corridors of L77 and L78** — the
same R1-priced classes, all R5-shaped. `darkshield` (L74) survives; the L71
pit fall to L82, the R3 headline's terminal leg, does not.

### 8.5 ⛔ HEALTH IS SEALED AT R4 — the push has no legal direction

§2.3's mechanic read is right that `rock@192,96` is a plain `Solid` with no
hit handler (`Scenery/Rock.as` — `extends Entity`, `type = "Solid"`, nothing
else), so `pushableblockspear@176,128` is the only candidate opener. But
§2.3 describes the WRONG `hit` path, and the right one closes the room.

**`Player.genericHit` calls `hit(p, t, _relative = TRUE)`, and the
`_relative` branch RETURNS BEFORE the `moveTypes` check**
(`PushableBlockFire.as:76-87`). Two consequences:

1. `moveTypes = ["Spear"]` is **never consulted on the player's path** — a
   SWORD slash pushes a `PushableBlockSpear` too. (Fire/Pulse projectiles
   take the non-relative path, where `moveTypes` does gate them, so L38's
   `pushableblockfire` stays R5 as published.)
2. The block moves **one tile in the player's FACING direction**, not "away
   from the hit point": for `spearDirection` 0/1/2/3 the argument is
   (−1,0)/(0,1)/(1,0)/(0,−1) and `tile = getPos() − p·16`, i.e. E/N/W/S.

L65's health approach (`comp 3`) is separated from the entry side (`comp 1`,
where both L63 arrivals land) by exactly two things: the block at tile
(11,8) and the rock at tile (12,6). Removing either connects them — which is
R2's "the rock **or** the pushable". **But a push is not a removal.**
Exhaustively, over every lattice cell of comp 1 and all four directions,
the presses whose 32×5 spear rect reaches the block are:

| direction | cells | block moves to | result |
|---|---|---|---|
| RIGHT (E) | **0** | (12,8) — *would* connect | no legal cell: it needs the player WEST of the block, in comp 3 |
| DOWN (S) | **0** | (11,9) — *would* connect | it needs the player NORTH, on tile (11,7), which is solid (t=27) |
| UP (N) | 10 | (11,7) — SOLID, **no move** | the block does not move at all |
| LEFT (W) | 6 | (10,8) | the wall moves one tile west and still seals: (9,8) is solid, so it can never be pushed further |

⇒ **`health` and `hitsMax == 4` are not achievable at R4.** The seal is
geometric and complete: the two directions that open the room are the two
whose press positions lie on the far side of the thing being opened. Nothing
in R4's mechanic set changes it — the sword pushes it the same way, and the
bridge (which the spear does open) only gets the walk as far as L65's entry
component, which it already reaches.

⚠ This is the R3 lesson arriving one rung later in a new costume: R2's
"the rock **or** the pushable" was a REACHABILITY answer (remove either and
the components merge) and R4's question is a WALK answer (can a press
produce that removal). A reachability graph and a walk are different
questions, and only the second one is the claim.

### 8.6 The inventory probe: Option A confirmed, and the prediction held

`probe-seedling-inventory.mjs`, against the existing build: hold RIGHT for
50 ticks with sword+spear granted, toggle V at tick 10.

```
tick=10/50 dead=18 x=99.15   <- the V span (10..11)
tick=12/50 dead=18 x=101.90  <- the last live tick
tick=12/50 dead=140 x=101.90 <- pinned; dead_frames climbing without bound
```

**Open frames are DEAD frames.** The tick pinned two ticks after the toggle
and never advanced again, so no tape span can ever reach the arrows, the X
or the closing V. The structural reading holds: `Inventory.set open` IS
`Game.freezeObjects = _open` (`Inventory.as:139`), it has one writer, and —
unlike the dialogue phase that inverted R3's plan — nothing clears the flag
per frame, so `Bot.update`'s gate sees it true at the top of every
subsequent `Main.update`.

⇒ **Option B is impossible. The batch carries `equips` (Option A).** Two
things confirmed on the way, both from source and both load-bearing for the
directive:

- `Inventory.update` sets `firstUse` on `items.length >= 2` with `help`
  false (both `drawFirstUseHelp` and `drawExtendedHelp` are gated on `help`,
  which `botStart` clears), and `addItemsFromSave` reads the `Player.hasX`
  statics — so a GRANT is enough to populate the slot array, which is how
  the probe got two items. Slot order under sword+spear is `[sword, spear]`:
  **slot 1, one equip, exactly as §2.1 says.**
- **SharedObject is page-local.** After the probe granted sword+spear and
  drove `Main.firstUse` true, two fresh pages both boot `items true = [none],
  hitsMax=3, L0 (88,136)`. A `Main.primary` write carries no cross-recording
  persistence risk.

### 8.7 The bosskeys: none of the four is earnable at R4

§2.8 asked for the verdicts to be re-run under R4's mechanics. Under the R3
clear list at the shipped planner's granularity:

- **`L12 tag 3` (`bosslock@80,656`, keyType 1) is the SINGLE clear that
  opens L21, L22, L29, L30 and L31** — removing it alone costs ten nodes and
  all five levels. The keyType-1 `bosskey` is in **L29**. So the room that
  holds the key is reachable only through the lock the key opens:
  **CIRCULAR, confirmed rather than inherited.**
- **L19 and L67 stay unreachable** under R3's clears and under every offered
  clear on the map (upper bound: 59 nodes, neither appears). Their doors come
  from L18/L20 and L59 respectively, and none of those levels holds a bridge
  tile or a pushable, so no R4 mechanic touches them.
- `L30 tag 0` is not load-bearing for the GRAPH (removing it costs one node)
  — consistent with R3's finding that the NARROWING demanded it.
- `L3 tag 0` (`breakablerock@96,112`) is likewise not a graph blocker —
  consistent with R3's "the driver's own A\* put it back". It remains the
  one genuine **−1 retirement candidate** for R4 (`BreakableRock` is reached
  by `genericHit` for either weapon), subject to the shipped planner.

⇒ The four bosskey-shaped clears stay DECLARED, relabelled with evidence:
keyType 1 is **circular** (needs whatever opens L29 from outside — R5/R6),
keyType 0 and keyType 4 are **unreachable under every clear list**.

### 8.8 The press audit, with its arithmetic — and four source corrections

The numbers §3.2 asked for, all from the classes' own fields:

- `spearDamage = 2`, `swordDamage = 1`, `darkSwordDamage = 2`; default
  `Enemy.hitsMax = 3`, `hitsTimer` 30 ticks between hits on one enemy. So
  **one spear press never kills a default enemy (2 < 3) and two do**, and a
  press cannot repeat inside 30 ticks. The press policy's rule is therefore
  arithmetically simple: *at most one spear press per enemy per walk.*
- ⚠ **`dropCoins()` IS DEAD CODE.** Every call site is commented out
  (`Bob`, `BobSoldier`, `Jellyfish`, `Drill`, `Spinner`). §2.4's "RNG and
  Coin spawns are death-only" is wrong in the direction that matters: **an
  enemy death draws no RNG and spawns no `Coin`.** The only per-enemy draw
  is the CONSTRUCTOR's `coins = 4 + Math.random()*4`, which fires at every
  level build regardless. What a death still costs is `totalEnemies()`
  (which opens `tSet == -1` locks) and a `SlashHit` entity in the world
  (which perturbs FlashPunk's list order, i.e. `nearestToPoint` ties).
- ⚠ **`Grenade.hit()` is OVERRIDDEN EMPTY**, exactly like `DarkTrap.hit()`.
  Its `hitsMax = 1` is unreachable. §2.4's "does its self-destruction run
  `dropCoins`?" dissolves: it is unkillable by any press, and nothing runs
  `dropCoins` anyway. L63's `grenade@128,128` in a spear rect is inert.
- ⚠ **`LightPole` is `Spear`-only and it WRITES PERSISTENCE.**
  `genericHit`'s `e is LightPole` arm fires only for `t == "Spear"`, so a
  sword stray cannot toggle one — but a spear stray can, and
  `LightPole.set activate` calls `Game.setPersistence(tag, !activate)`. So
  an unintended lightpole hit is a **ledger entry**, and §3.2's "treat it as
  illegal" is right for a stronger reason than cosmetics.
- The DarkTrap-by-light chain is real but **DARK on a fresh boot**: a
  lightpole's ctor ends `activate = !Game.checkPersistence(tag)`, every flag
  is true on a fresh boot, so `activate` is false and `myLight.darkLight` is
  true — and `DarkTrap.update` requires `!light.darkLight` within
  `radiusMin` (28). No R3/R4 clear names an L63 or L65 lightpole tag, so no
  darktrap dies at boot and the expected `persistence_cleared` set gains
  nothing here. It would change the moment a tape cleared a lightpole tag or
  a spear stray lit one, and then `SandTrap.removed()`'s
  `Game.setPersistence(tag, false)` is the entry to expect.

### 8.9 The four small answers

- **The bridge on-screen radius (§3.3): 64 px in each axis, derived.**
  `Game.view()` targets `player − 80` (x additionally shifted by
  `Inventory.width/2 + Inventory.offset.x/2` = 33 − 35 = **−2 px**, constant
  because the inventory never opens — which Option A also guarantees),
  lerps at `1/cameraSpeedDivisor` = 1/10, clamps to the level, then rounds.
  `loadlevel` SNAPS the camera to the player on arrival (`Game.as:2041`), so
  the only error is steady-state lag ≤ 10 × the ~1.45 px/tick velocity peak
  ≈ 14.5 px, plus 0.5 for the round. A Tile is `onScreen` while its 16 px
  rect meets the 160 px window, giving 88 − 15 = **73 px** in y and 71 px in
  x; **64 px is that with slack.** ⚠ Precondition to assert, not assume:
  `Game.as:914` sets `cameraSpeedDivisor = 50` in a cutscene branch, which
  would quintuple the lag. R4 enters no cutscene; the policy must say so.
- **The L63 buttonroom is clear.** `buttonroom@32,64 {tset 0, tag 0, room
  62}` sits at rect [32,48]×[64,80]. The five arrivals into L63 put the
  player entity at (24,56), (24,104), (24,216) from L61 and (24,24), (72,24)
  from L62 — none within a 4×5 box of it. It stays an ordinary presser
  volume the planner avoids; the `room: "62"` cross-level write is only a
  risk if a route chooses to stand on it.
- **The tape budget is the BYTE ceiling and R3 is already at 85% of it.**
  `r3-walk-full` is **1,066 spans / 76.2 KB** against `TAPE_BUDGET`'s 1,800
  spans / 90 KB — 59% of the span budget but **85% of the byte budget**. At
  R3's own density (~20 spans and ~1.47 KB per leg), adding the health
  detour (~8 legs) to the full R3 walk projects **~1,226 spans / ~88 KB**,
  which `assertTapeWithinRuntimeBudget` would very nearly refuse. Dropping
  the D7 darksuit tail (~14 legs, which armed lava forces anyway) brings it
  back to ~945 spans / ~69 KB. **The two escalations below are coupled: the
  lava ruling is also the budget answer.**
- **`--hazard-tiles` corrects §2.5's table in two places** (L37 water is 305,
  not 308; L71 carries **148** lava tiles) and confirms the rest, including
  every bridge: L61 ×2, L63 ×1, L66 ×1, L93 ×1, and **none anywhere else**.

### 8.10 What §§2–3 got wrong, in one place

| brief | recon |
|---|---|
| §3.4 "re-arming lava changes the ROUTE and not the modelled physics (nothing stands on it)" | the R3 walk stands on lava for **1,392 ticks** across six levels, all of them before `hasDarkSuit` |
| §3.4 "water is forbidden floor everywhere at R4 — the audit sizes the re-route" | forbidding it collapses the walk from 60 nodes to 10; `canSwim` is the **conch**, so water is R5-shaped |
| §3.4 waterfall bundled with water | `checkDrowning` tests `eff == 1` only — **a waterfall cannot drown you**; it is modelled floor, and the R3 walk already stands on it |
| §3.4 "the waterfall witness is synthetic" | L0 and L89, 71 ticks, on the committed headline |
| §2.3 the spear "slides the block one tile away from the hit point (atan2)" | `_relative` returns before that branch: **one tile in the player's FACING direction**, and `moveTypes` is never consulted on the player's path (a SWORD pushes it too) |
| §2.3 "the only opener is `pushableblockspear@176,128`" | true, and it opens nothing: neither direction that would connect the room has a legal press position |
| §2.4 "RNG and `Coin` spawns are death-only" | `dropCoins()` is dead code at every call site |
| §2.4 the grenade's death path | `Grenade.hit()` is overridden empty; it cannot be killed by a press |
| §2.7 the sound term arrives with lava | it arrives with **waterfall as well** — `inWater` includes eff 25 |
| §2.5 L37 water 308 / L71 lava "41" | 305 / 148 (L85 is the 41) |

### 8.11 ⚖ ESCALATIONS — the priced verdicts, awaiting user rulings

1. **The rung's terminal state.** `noHazards: []` is unreachable. Ship
   `["water"]` (ice + waterfall + lava armed) or `["water","lava"]`. Water
   joins the blocked list with `conch ⇒ fire ⇒ R5` named.
2. **Lava costs `darksuit`.** Armed, it seals L78/L79/L82 behind a lava wall
   in L80 and LavaTrap/LavaRunner discs in L77/L78 — all R5-shaped. Arm it
   and the claim is 5 items; defer it (`["water","lava"]`) and the claim
   keeps 6. Deferring also keeps 1,392 ticks of lava physics — and its share
   of the §2.7 sound question — out of the rung.
3. **Health is not achievable.** §8.5. The ruled target of **7 items and
   `hitsMax == 4` as a positive cannot be met**, and `hitsMax == 3` returns
   as R2/R3's negative. The equip primitive still earns its place (the
   bridge is Spear-only and opens L65's entry side for real), but it buys
   the *mechanic*, not the item.
4. **What R4's claim then is**, for confirmation: the R3 six (or five
   without darksuit), REAL-collected, with `hitsMax == 3`, **the first tape
   on the ladder to declare a non-empty armed hazard set** — ice and
   waterfall live, lava per ruling 2 — plus the spear/equip primitive, the
   bridge opened for real, and `L3 tag 0` retired from declared to earned.
5. **Unchanged and still wanted:** the §3.2 per-press audit policy (§8.8
   makes it cheaper than the brief assumed — no RNG, no coins), and the
   `equips` directive's not-a-crutch classification (§8.6: the write grants
   nothing, the UI is unreachable by tape, SharedObject is page-local, and
   the game's own debug warps write the same line).

## 9. ⚖ THE SLICE-0 RULINGS (user, 2026-08-02)

1. **Arm lava and pay for it.** `noHazards: ["water"]` — ice, waterfall AND
   lava all live, the first tape on the ladder with an armed hazard set.
   `darksuit` leaves the claim, with its seal named per entity (§8.4). The
   D7 tail leaving also resolves the byte-budget projection (§8.9).
2. **Health is dropped; `hitsMax == 3` stays a NEGATIVE.** The rung's
   headline is *the same map with a hazard armed for the first time*, not
   more items. The equip primitive still ships — the bridge is Spear-only —
   but it buys the MECHANIC and a level, not an item. `health` joins the
   blocked list with `L65 rock@192,96` + the pushable's unreachable push
   directions as its seal.
3. **Adopt the §3.2 per-press audit**, which §8.8 made cheaper than the
   brief assumed: no RNG and no coins on a death, `Grenade`/`DarkTrap`
   unkillable, one spear press never kills a 3-HP enemy.
4. **The `equips` write is UI SUPPRESSION, not a crutch** — the R1
   `Inventory.help = false` precedent, now with the probe (§8.6) behind it.

### 9.1 The R4 claim, as ruled

**Five items REAL-collected — sword, feather, torch, spear, darkshield —
with `hitsMax == 3`, `grants` EMPTY, and the headline tape declaring
`noHazards: ["water"]`.** Plus, as mechanics rather than items: the equip
directive, the L63 bridge opened by a real spear press, and `L3 tag 0`
retired from a declared clear to an earned one.

**Blocked, published with rungs:** `water` itself (⇒ `conch` ⇒ `fire` ⇒ R5),
`conch`, `wand`, `darksword`, `shield`, `fire`, `ghostsword`, `firewand`
(R5), **`darksuit`** (R5 — the LavaTrap/LavaRunner discs of L77/L78 and
L80's lava wall), **`health`** (R5/R6 — L65's push geometry), and the
ending (R6).

### 9.2 The batch, FINALISED after slice 0

1. **tape v4 `equips: [{t, slot}]`**, applied at the grant site, with a
   LAZY loud validation. ⚠ The validation cannot be eager: a segment
   inherits its items through a boot-level grant and its equip through
   `equips: [{t: 0, slot: 1}]`, but `Inventory.items` is filled by
   `addItemsFromSave` inside `inventory.update()`, which runs LATER in the
   same frame — so an eager `slot < itemCount` check fails at t=0 by
   construction. The write happens at `t`; the check is deferred to the
   first frame with a non-empty inventory and names the equip's own tick.
2. **`botStatus.primary`** (read from `Main.primary`) and
   **`botStatus.inventory_slots`** (SCANNED from `Inventory`, never echoed
   from the tape), so the JS slot mirror is asserted two-sidedly on every
   tape — the R0 two-consumers protection for a new tape field.
3. **`botStatus.hazard`** — `inWater`, `inLava`, `onIce`, `onWaterfall`,
   `drownTimer`. R4 is the rung that arms three of the four sticky flags,
   and STICKINESS is precisely what the observation stream cannot see (it
   is why the sticky-terrain row of the bounded-vacuity table has been open
   since v2). A pure readout, byte-inert, and the last cheap chance before
   R5 — the standing rule is that AS3 edits are BATCHED.
4. **`Inventory.itemCount`**, a public read-only accessor. `getItem(i)`
   coerces an out-of-range `undefined` to `0`, so it cannot distinguish
   "slot 0 holds the sword" from "there is no slot 0" — the validation and
   the readout both need the length.
5. **The version-scoped `saw_auto_advance` fix** (§2.9): count a `Help`
   dismissal, gated on `tape_version >= 4`, so the ~8 frozen collection
   fixtures keep their bug-compatible `0` and the inertness gate stays a
   gate. R4 asserts it as a POSITIVE for the first time: exactly 1, the
   sword's `Help(3)`.

NOT in the batch, on the record: a bridge-timer readout (§3.3 verifies the
flip by EFFECT with the l71 pair discipline, which needs no AS3), and
anything for the press audit (the model knows every press tick and rect;
the game's own crossing is the oracle).

## 10. External evidence — the intended-play walkthrough (2026-08-02, after §9)

Source: the jayisgames Seedling review's full walkthrough + its comment
threads (`jayisgames.com/review/seedling.php#walkthrough`), read against the
extract and the fork source. The walkthrough is evidence about INTENT — the
game as its designer expected it to be beaten — and it lands on both sides
of §8's verdicts. What it says was cross-checked at source before being
recorded here; nothing below is quoted on trust alone.

### 10.1 What it CONFIRMS (§8/§9 stand reinforced)

- **Lava swimming is the intended deep-D7 traversal** ("the Dark Suit …
  allows you to swim in lava. Since you can now, swim north through the
  lava"), and the darksuit approach itself is enemy-heavy by design ("a
  small monster that will eat you … use the spear through the wall to kill
  it; use the spear on one and the wand to take out the other" — the
  LavaTrap discs of §8.4). §9 ruling 1 (darksuit leaves the claim, seal
  named per entity, all R5-shaped) matches intent exactly.
- **Waterfall climbing is real intended traversal** — the feather "allows
  you to swim up waterfalls", the firewand needs "smash a block with the
  spear, swim across lava, and climb a waterfall", and Ghethis' entrance is
  a waterfall climb. Supports §8.2's correction (waterfall = MODELLED floor,
  real witness, feather-gated up-motion).
- **The intended item order is wand BEFORE spear** (sword → shield → fire →
  conch → wand → ghost spear → dark shield → dark suit → feather …). Two
  consequences: the walkthrough player opens the health cave "with your
  gold key" and never remarks on the magicallock — they wand it in passing —
  so **`MagicalLock` re-read at source still blocks and still needs a shot**
  (`MagicalLock.hit`, `lockType <= _t`; `check()` despawns on a cleared
  tag): at R4 it stays exactly ONE declared clear. And `conch` deep in the
  ice world (D5) matches water staying un-armable.

### 10.2 ⛔ What it CONTRADICTS — the keyType-4 chain is a POLICY seal, not geometry

The walkthrough's health route: *"Go West this time — you can now switch on
the light … and move the block onto the button. You'll need to use the spear
on it from across the gaps to move it correctly. Collect the gold key once
you're past it"*, then *"there's block to move and a cave in a tree to
investigate. Use your gold key on the lock in here to get an extra square of
health."* The gold key IS `bosskey keyType 4` and the tree-cave lock IS
L68's `bosslock` — the chain §8.7 wrote off. Source-checked:

- **§8.7's test looked at the wrong levels.** It checked the door-SOURCE
  levels (L18/L20/L59) for "a bridge tile or a pushable" — but **L67 itself
  IS the west puzzle room**: `pushableblockspear@144,112`, `button@96,112
  {tset 0}`, `arrowtrap {tset 0}`, `lightpole@160,104`, the key at (48,64),
  175 pit tiles, and an ALWAYS-ACTIVE door from L59 (`tag −1`, both ways).
- **L59's west approach is tile-clear.** Row 8 is a straight walkable
  corridor from the entry doors to the L67 door; the only thing astride it
  is `grenade@112,112`. "L67 unreachable under every clear list" was always
  true — and always irrelevant: its gate is the **grenade avoid volume**, a
  planner POLICY object, and §8.8/§9.3's own evidence prices a grenade at
  nothing under `noDamage` (`Grenade.hit` overridden empty = unkillable;
  damage via `Player.hit` = guarded; `knockback` overridden empty; no RNG
  and no coins on its self-destruction per §8.9).
- **L67's interior is likely a plain walk for the bot.** `LightPole` is
  `type = "LightPole"` — NOT in the player's solid list — so the row-6
  corridor does not split; the arrowtrap's arrows end at `Player.hit`
  (guarded); the button's `tset 0` group contains only the arrowtrap
  (human-comfort, not access); the dark is cosmetic. The block/button
  choreography the walkthrough describes appears to be for HUMANS (light to
  see, button to stop arrows). The bosskey ceremony is the known
  `text: ''` 150-frame case, already modelled at R3.
- **The bosslock open is hold-shaped and already in the vocabulary**:
  stand beneath with the key, 60-tick `keyTimer` + ~20-tick fade, and it
  RE-CLOSES (re-writes the flag true) if the player leaves early — the
  button lock's occupancy shape, needing the l71 PAIR discipline, not a
  new mechanic.

⇒ **If the grenade passes the §3.2-style audit, the keyType-4 key is
EARNABLE at R4** — which converts L68's `bosslock tag 0` from a declared
clear into a real open and leaves health's seal resting on exactly two
things: the L68 magicallock (one declared clear, wand, R5) and §10.3.

### 10.3 ⚠ §8.5's exhaustiveness is qualified — but the seal may still hold

Two comment threads describe the intended push technique, and both break
§8.5's search assumptions: *"The spear will push two blocks away from where
you are standing … push it then move yourself then push again a few times,
shuffling around"*, and (for the room with "a waterfall at the top and a
pool of lava to the right" — that is **L63**, its `pushableblockspear@
112,96` beside the spinningaxe) *"quickly duck in and hit it with your
spear from across the pit and then duck back out … circle around, and then
you can move it the rest of the way."* So the intended technique is
**multi-push with repositioning, pressing from across pits** — §8.5 swept
single pushes from comp-1 cells only.

A hand re-run of L65 under the corrected rules (press cells = any standable
cell whose spear rect covers the block, in ANY currently-reachable
component; multi-push; reachability recomputed after every push) still
found no breach: W wedges at (10,8) per §8.5; the W-then-N ladder
dead-ends at (10,5) `t=27`; E and S press cells exist only inside the
sealed pocket. **The intended L65 opener is therefore still UNIDENTIFIED**
— candidates that remain: a wand-shot push (the walkthrough player has the
wand; but `PushableBlockSpear` forces `moveTypes = ["Spear"]`, and the
projectile path is the one place `moveTypes` IS consulted — so this should
NOT work if §8.5's `_relative` reading is right), a ghost-sword-era return
visit, or a mechanic §8.5's source reading got wrong. ⚠ **That last one is
the R3 lesson** (the oracle corrected the update order; the ctor corrected
the tag): §8.5's direction table is a SOURCE READING that no recording has
ever tested. The decisive instrument is a LIVE PROBE, not more reading:
`probe-seedling-l65.mjs` — boot into L65 with spear granted + equipped, try
each candidate press cell, and watch the block from the game's own report.
The same probe pattern settles L67's interior walk and the L59 grenade
pass (`probe-seedling-l59-l67.mjs`).

### 10.4 New census facts (source-verified while checking the walkthrough)

- **Plain `PushableBlock` is WALK-pushed** — its `input()` moves it one
  tile when a Player presses against any edge with matching velocity sign
  (0.5 px/tick glide). No rung has modelled this, and the blocking census
  prices these as plain Solids: TRUE for every committed recording (none
  pressed against one — the oracle matched), but the R4 planner must treat
  plain-pushable EDGES as do-not-press-toward volumes, or a graze that
  §8.8's `allowGrazes` absorbs could silently move a wall. The Fire/Spear
  variants do NOT walk-push (`PushableBlockFire extends Mobile`, own
  `input()`).
- **A pushable that comes to rest on Water/Lava/Pit destroys itself**
  (`myTile.t == 1 || 17 || 6 → destroy = true`) — D1's "push the second
  block into the water" is disposal, not bridge-building. A mis-push into a
  pit is therefore IRREVERSIBLE within the visit (and the walkthrough's
  softlock report confirms wedges are real; recovery is re-entry — the
  per-visit reset family, §3.3).
- **`LightPole` does not block** (`type = "LightPole"`, absent from the
  player's solid list) — relevant to any census entry that assumed poles
  were scenery-solid, and to L67's corridor above.
- **L63's own pushable at (112,96) sits beside the walk's corridor** and
  is spear-movable by a stray press — it joins the §3.2 audit's
  responder list for every L63 press regardless of what else is ruled.

### 10.5 ⚖ The re-open question for §9 ruling 2 (user)

Ruling 2 dropped health on §8.5 + §8.7. §10.2 removes §8.7 as a reason
(the keyType-4 chain is a grenade-policy question with the evidence
pointing to "passes"), and §10.3 qualifies §8.5 without overturning it.
Priced options:

1. **Hold ruling 2** (health stays dropped, claim stays 5 items /
   `hitsMax == 3` as a negative). Record §10.2's chain as a NAMED candidate
   with its two probes queued for the rung that wants it. Zero new scope.
2. **Re-open pending two probes** (~an hour of harness time, no AS3, no
   build): the L59/L67 walk probe and the L65 press probe. If L65 breaches
   (probe finds an opener §8.5's reading missed), health returns at the
   cost of: the key-chain legs (L59 west + L67 + ceremony), the bosslock
   hold-open pair, ONE declared clear (L68 magicallock), and the L63/L65
   press audits — and the target goes back to **6 items + `hitsMax == 4`
   as a positive** (darksuit stays out per ruling 1). If L65 does not
   breach, ruling 2 stands with §8.5 upgraded from source-read to
   oracle-tested — a strictly stronger close-out either way.

Option 2 is recommended: both probes are cheap, both convert source
readings into oracle answers (the arc's standing doctrine), and the L65
probe retires a known unknown that would otherwise resurface at every
later rung that touches D6.

### 10.6 The probes, as run (2026-08-02) — and what the oracle said

⚖ The user delegated §10.5 ("I'll trust your judgement", 2026-08-02);
**option 2 was adopted: the probes decide.** Three ran; two facts confirmed,
two new mechanics discovered, one question left for an instrument.

**Probe A — `probe-seedling-l65.mjs`: the push is REAL and §8.5's direction
table is ORACLE-CONFIRMED at reach 1.** Boot beside L65's block at (12,8),
baseline stop against its east face at x = 194.05, one spear press facing W,
re-advance: the player stops at x = 178.10 — **Δx = 15.95, exactly one tile
west, the facing direction** — with the friction-creep signature at the new
face (178.70 → 178.00, the `collide-up-rock` shape). The `_relative` path
works precisely as §8.5 read it.

**Probe B, first attempt — `probe-seedling-l59-l67.mjs` (SUPERSEDED, kept
for its trace).** Routed on a hand-drawn tile grid that was wrong in three
cells; its scripted verdict misread the trace. What the trace settled
anyway:

- **(10,6) and (10,7) are PITS, and the lightpole merely STANDS on (10,6)**
  — the "does LightPole block" route question is moot (the census claim
  stands on source: no setHitbox, type in no solids list).
- ⛔ **`die()` is an IN-PLACE RESPAWN at the current world's boot tile with
  ~18 dead frames, after which THE TAPE KEEPS RUNNING.** Three deaths
  across two runs, every respawn at exactly the boot cell (184, 120). No
  rung models this: the floor policy must keep death unreachable, and the
  differential should treat an unexplained snap-to-boot plus ~18 dead
  frames as this signature rather than a mystery divergence.
- ⚠ Probe-authoring lesson, now a comment in the probe itself: **span
  sizes must be COAST-corrected.** Releasing a held arrow leaves
  ~1.1–1.4 px/tick of velocity that friction drains over ~5 px; the first
  pair sized its DOWN leg by hold distance alone, the terrain probe point
  coasted across the y = 144 midline into (11,9)'s pit, and both arms died
  identically — a pair that discriminated nothing.

**Probe B, the pair — `probe-seedling-l67-reach2.mjs`: REACH-2
ORACLE-CONFIRMED.** Same tape one span apart, coast-corrected: the press
arm's final stop is (154.75, **115.90**) — the player walked INTO the
block's vacated cell — against the control's (154.75, **130.05**), pinned
at the block's south face with the creep signature. Zero deaths in either
arm. **The spear pushes a `pushableblockspear` from TWO tiles away, across
a pit — and the spear rect has no line-of-sight gate, so through walls.**

**What this settles.** The walkthrough's key-room solve is mechanically
real on the corrected map: push N from (9,8), then W from (11,6) — across
the pit the lightpole stands on, which is exactly the comment's "the first
push was from the other side of the light" — then W again, S from (7,4)
THROUGH the (7,5) wall, W onto the button at (6,7). The keyType-4 chain is
therefore R4-plannable end to end: L59's row-8 corridor (the grenade
audit), L67's always-active door, the block choreography, the bosskey
ceremony (the known `text: ''` case), and L68's bosslock hold-open.

**What it does NOT yet settle: the L65 breach — health's actual gate.**
§8.5's press-cell sweep must be re-run as an INSTRUMENT with the
oracle-pinned rules: press cells are every standable cell in ANY
currently-reachable component whose spear rect covers the block (reach 2,
through walls and across pits); multi-push, with reachability recomputed
after every push; a block coming to rest on water/lava/pit is DESTROYED
(irreversible within the visit). The hand re-run in §10.3 found no breach,
but hand grids were wrong twice tonight — the instrument, not the hand,
closes this. **Health returns iff that sweep (or a follow-up probe on its
candidate cells) finds a breach; otherwise ruling 2 stands with §8.5
upgraded from source-read to oracle-tested.** Either way the close-out is
stronger, which is what §10.5's option 2 promised.

Census landed with the probes: `arrowtrap` upgraded from `cheapOnly` to
`notSolid` (no setHitbox, no type — cited at Game.as:2129 +
ArrowTrap.as:24 + the Activators base), which lifts the FULL census
82 → 85 (the pin moved with its note — L67 was an arrowtrap-only holdout).

## 11. ⛔ THE L65 RE-SWEEP — the breach, and the game confirming it (2026-08-02)

§10.6 left one question: run §8.5's press-cell sweep as an INSTRUMENT with
the oracle-pinned rules, and let it decide health. It found a breach in
three levels, and the game confirmed it.

### 11.1 The instrument

`scripts/procgen/recon-seedling-pushes.mjs`. Every cell comes from the
shipped `buildLevelWorld` and every standability answer from the shipped
`plannerObstacleAt` — no hand grid, no `tx/16`. The search is over
**(block tiles × the region the PLAYER is standing in)**, under §10.6's
five rules: facing-direction push; reach 2 across pits and through walls;
press cells are every standable cell of the currently reachable region,
recomputed after every push; rest-on-water/lava/pit destroys; a visit is
the unit (`PushableBlockFire` holds its position in an instance var with
no persistence).

Three modelling traps it had to be corrected for before it answered
anything, each of which had produced a confident wrong answer first:

1. **Seeding the flood from every arrival at once** puts the player on both
   sides of the seal, so no state can ever gain a target. L65's two doors
   from L63 land in components that do not reach each other; the union
   reported all four doors reachable before a single press. **One search
   per ARRIVAL.**
2. **Re-flooding from the arrivals after a push** scores chains the player
   cannot walk. The player is standing on the stance when the block lands,
   so the region is part of the state. L65's (11,9) is a cut vertex: a push
   S opens the corridor ahead and seals the way back in the same move.
3. **`componentsAround`'s one-CELL dilation is a pitch-8 idiom.** At pitch
   2 it asks about cells two pixels inside a teleporter volume, and the
   sweep duly reported every door of L65 sealed — including the two the
   walk arrives through. The dilation is in PIXELS now.

Bounds named rather than hoped: **enemies are in the BLOCK's solid list and
not in the player's** (`Mobile.as:17` + `PushableBlockFire.as:31`), so a
chaser in a destination tile is a live-probe question and a spawn-cell
collision is flagged; **stances are lattice centres**, so it runs at 8 (the
planner's own, the only pitch whose answer can become a route) and at 4 and
2 as strictly more permissive controls.

### 11.2 ⛔ THE BREACH — and it is three levels, not one

| level | entry | the chain | what opens |
|---|---|---|---|
| **L65** | L63's door @128,304 (arrival 128,16) | W from (12,8); N from (10,10) **across the pit at (10,9)**; W from (12,7) **through the Body Wall at (11,7)**, landing the block on (9,7)'s pit | the L68 door — **health's own room** |
| **L63** | L61 @0,96 or L62 @64,0 | ONE push E from tile (6,6), landing the block on (8,6)'s pit | the L65 door @128,304 — i.e. the entry L65's chain needs |
| **L67** | L59 @224,112 | ONE push W from (180,116), landing the block on (8,7)'s pit | `bosskey@48,64` — the keyType-4 key |

Consistent at pitch 8, 4 and 2 (the finer pitches find *shorter* chains,
never fewer). The L65 chain's three overlaps are 80, 50 and 60 px² — none
of them a knife-edge.

**What §8.5 got wrong was not its direction table** — the oracle confirmed
that at reach 1 and this sweep uses it unchanged. It was the sentence
*"But a push is not a removal."* A push into a pit **is** a removal, and
even when it is not, a block pushed out of a one-tile corridor has left it.
§8.5 swept single pushes from one component and stopped at "the wall moves
one tile west and still seals"; it never asked what the SECOND push does
from the cell the first one opened.

⚠ And note what the chain does NOT rest on: whether the block is DESTROYED
on the pit (`PushableBlockFire.input()`) or merely sits on it is invisible
to reachability, because a pit tile is forbidden floor either way. The
claim is that the block LEAVES the corridor. The destruction rule stays a
source reading with nothing resting on it.

### 11.3 The oracle: `probe-seedling-l65-breach.mjs`

A pair, differing only in whether the three `primary` spans exist; both
arms walk the identical route and end on holds long enough to PIN against a
wall rather than stop at a computed position.

```
press arm    final (166.65, 98.05)   through the vacated corridor, pinned
                                     under (10,5)'s Body Wall
control      final (194.05, 114.15)  pinned at the block's own east face,
                                     then under rock@192,96
```

The two arms track each other to the pixel for 380 ticks — the pushes
change nothing about the walk until the last leg — and then separate by a
tile and a half in x and sixteen pixels in y. That is the pair doing its
job: one field apart, and each outcome a different wall.

**The L65 breach is ORACLE-CONFIRMED.** Two mechanics were tested for the
first time on the way: **UP at reach 2** (the one direction whose
`spearRect` arm carries the asymmetric `+ 1`, and which no recording had
ever exercised) and **reach 2 through a SOLID** — L67's confirmation went
across a PIT, and "through walls" had been inferred from "the spear has no
line-of-sight gate" rather than seen. Both hold.

⇒ **§8.5's verdict is overturned by the game, and §9 ruling 2 is
re-opened.** Per §10.6's own procedure, health returns.

### 11.4 What health costs, as ruled by §10.6

- The claim becomes **6 items REAL-collected — sword, feather, torch,
  spear, darkshield, health — with `hitsMax == 4` asserted as a POSITIVE**
  (health is the only adder, so 4 means exactly one grant of it and 3 means
  the collection silently failed). `darksuit` stays out per ruling 1.
- **The keyType-4 chain lands**: L59's row-8 corridor (the grenade
  press-audit), L67's always-active door and its one-push solve, the
  `bosskey` ceremony (the known `text: ''` 150-frame case), and **L68's
  bosslock as a real hold-open PAIR** — it re-closes and re-writes the flag
  TRUE if the player leaves before the fade completes, which is the button
  lock's occupancy shape and the l71 pair discipline.
- **L68's `magicallock` stays exactly ONE declared clear** (a wand shot,
  R5), so the declared bill grows by one rather than by §8.11's two.
- The L63 and L67 pushes each need their own §3.2 press audit, and both
  rooms carry lightpoles — which is why the press audit's level-query half
  had to stop being a stated gap.

⚠ **The byte budget is the live risk.** `r3-walk-full` is 1,066 spans /
76.2 KB against a 90 KB ceiling (85%). Dropping the D7 darksuit tail —
which armed lava forces anyway — returns ~945 spans / ~69 KB, and the
health detour plus the key chain is ~18 legs at R3's own density (~1.47 KB
per leg) ≈ **~95 KB, over the ceiling**. `assertTapeWithinRuntimeBudget`
refuses loudly at synthesis rather than at record time, so this is measured
at slice 8 and not guessed here — but it is priced NOW, per the rung's own
"shrinkage escalates and is priced early" discipline.
