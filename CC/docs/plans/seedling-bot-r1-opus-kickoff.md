# Region atlas Phase 8 — subtractive ladder, Rung 1 (Opus kickoff): the relaxed full walk, pits LIVE

**Date:** 2026-07-31 (Fable design session; user rulings below).
**Parent:** `CC/docs/plans/seedling-bot-subtractive-plan.md` (the ladder) and
`CC/docs/plans/seedling-bot-r0-opus-kickoff.md`, whose **§8–§13 are the R0
as-built record — every seam this rung builds on is specified there** (§8.7
is the findings table this kickoff exists to answer). Read
`docs/json/developer/procgen/seedling-bot.md` first as always.

## 0. Mission in one paragraph

One driver-planned playthrough of the real recompiled Seedling that reaches
the room of every non-combat item — **all 13, including darkshield (L74) and
darksuit (L79) in the fall-only underworld cluster** — with the R0 crutches
on (noclip, noDamage, hazards coerced) EXCEPT pits, which stay LIVE and
become a modelled TRANSPORT primitive the planner routes with. Terminal
assertion from the game's own readout: 12 item booleans true, `hitsMax == 4`,
`fire` still false, win statics false, zero auto-advance, every grant fired,
pinned observation/transition counts. Exactly differentially verified end to
end — R1 is a verified artifact, not reconnaissance.

## 1. Settled rulings — do NOT re-litigate

1. **Pits are NOT disabled (user, 2026-07-31).** R1 tapes declare
   `"noHazards": ["water","lava","ice","waterfall"]` — pit omitted, live.
   The path logic takes pit transport into account: pit tiles are forbidden
   floor except as a leg's named exit, and falls are planned legs. This is
   exactly why R0 shipped `noHazards` as a SET (R0 §8.8); no AS3 change is
   needed to express it.
2. **Pit transport is MODELLED, exactly** — the fall-out, the swap, the
   fall-from-ceiling arrival. The known-heavier-than-teleporters cost is
   accepted; the modelling is JS-only (zero AS3 expected this rung).
3. All R0/R2-carried rulings stand: grants on first room entry (property
   writes only, R0 §8.9); item walk gates; cheapest-machinery-first for
   later rungs; sound is LAST (nothing swim-related this rung); JS is never
   a load-bearing stratum; tapes are whole regenerated artifacts.
4. **`Bot.noDamage` does not cover the direct position-writers (R0 §8.7a)
   and R1 does not widen it.** The answer is priced avoid-volumes and
   routing. If routing is INFEASIBLE somewhere mandatory (see §3.6), STOP
   and ask the user — a `Bot.noEnemyEffects` flag is a new crutch plus a
   pipeline run, and that trade is the user's, not yours.

## 2. What R0 hands this rung (names, not vibes)

- `noHazards` set semantics: `terrain` (raw, sticky, resolver-asserted) vs
  `effective` (coerced, physics-consumed); `assertModelledTerrain` runs on
  effective. **With pit NOT in the set, effective state 6 is REAL and
  currently lands in the v2 unmodelled-terrain throw — that throw is the
  seam this rung replaces with the fall.**
- Grants: applied at construction (boot level, tick 0) and immediately
  after a world swap; first entry only; an unfired grant is a named failure
  at run end. **A segment tape can inherit prior items by naming them in a
  single `{level: <boot level>, items: [...]}` entry** — fires at tick 0.
- Role census: 82/116 levels build with {trigger, pickup, proximity-hazard};
  volumes priced so far: `chest`, `watcher` only. **The other twelve
  proximity classes throw `'unpriced'` when a consulted level holds one** —
  pricing them per walked level is this rung's census work (§3.6).
- `opts.relax` is ONE object deciding plan, run and emitted tape;
  `avoidVolumes` defaults OFF for the v2 fixture path (do not flip that
  default — level 94's committed recordings depend on it).
- The parameterised boot works and `hazard-boot-pit` proves it (boots L83).
  `atBootPosition()` compares against `Main.playerPositionX/Y` (ctor args).
- Readout: `botStatus.items` = 13 booleans + `hitsMax` (int, base 3);
  `cutscene[]`, `menu`, `saw_auto_advance`, `grants_applied`.

## 3. Design, concretely

### 3.1 The pit fall, as the source runs it (transcription targets)

From `Player.as` (state setter `:697`, `checkFallingInPit` `:718-745`) and
`Game.as:2050-2054`. Slice 0 verifies each against the `bot` branch:

1. **Trigger:** on a state CHANGE to effective 6 while `onGround`
   (edge-triggered in the setter's `_s != _state` block). `onGround` is
   written only by `Enemies/LavaTrap.as` (R0 §8.1), so it is constant true
   outside lavatrap levels — transcribe as a constant with the citation and
   THROW if a lavatrap level is ever built for the run without pricing §3.6.
   `fallInPitPos` snapshots the TILE's centre (`nearestToPoint` at the
   moment of the edge — transcribe its exact probe args).
2. **Fall-out, on LIVE observed ticks:** `receiveInput = false` (input dead,
   but the frames are not dead frames — the differential sees them);
   per tick `x += (floor(fallInPitPos.x/16)*16 + 8 - x) / 10` and the same
   for y (verify the exact +8/centring arithmetic from source, do not trust
   this line), alpha counts down by `fallAlphaSpeed` per tick. The tick
   count to alpha ≤ 0 is a CONSTANT — derive it, pin it in a unit case.
   Spin direction consumes RNG but is invisible to the observation stream —
   do not model it.
3. **The swap:** at alpha ≤ 0,
   `x = floor(max(fallInPitPos.x - fallthroughOffset.x, 0)/16)*16` (and y),
   `Game.setFallFromCeiling = true`, `FP.world = new Game(fallthroughLevel,
   x, y)` — the SAME deferred end-of-tick swap as teleporters, so it flows
   through `levelRun`'s one-swap-two-callers machinery as a new arrival
   KIND, not a second swap implementation. Destination and offset come from
   the level's `control` flags (already in the extract; already read as
   level FLAGS by the R0 census).
4. **Arrival:** fresh Player at the ctor half-tile offset, held keys
   persist, ~19 blackCover dead frames — all as teleporters — PLUS
   `fallFromCeiling` true: input stays refused until the descent lands
   (`Player.input():1489` gates on it), and the landing check
   (`Player.as:490`) bounces off a landing spot whose `getStatePos` is
   6/1/17. **`getStatePos` is NOT routed through the coerce** (R0 §8.1's
   four sites do not include it — verify on the `bot` branch): a landing on
   water bounces even with water coerced. Transcribe the descent
   (position over ticks, landing tick, when input resumes); the BOUNCE is a
   loud THROW, not modelled — a fall whose arrival lands on 6/1/17 is a
   fixture to move (§3.3 computes all three arrivals up front so this never
   fires in practice).
5. **Conflicts throw:** a teleporter trigger overlapping the player during
   fall-out ticks, or a second pit edge while a fall is pending — same
   doctrine as the two-teleporter throw. Do not transcribe FlashPunk's
   winner.

### 3.2 Planner and driver

- **Pit tiles are forbidden floor** (they transport — the exact accident
  class that ate v1's `clamp-left`), joining teleporter volumes in the
  driver's policy, EXCEPT the one pit tile a leg names as its exit.
- **New leg exit kind:** `exit: {pit: {tx, ty}}` (tile coords, like targets)
  — walk onto that tile, run the modelled fall, assert arrival in the next
  leg's level. The caller names the pit; the driver never searches the fall
  graph, same as teleporters.
- **The driver must not schedule inputs between the fall edge and the
  descent landing** — input is refused there and a span the game ignores
  while the JS honours it would be the §7-asymmetry bug reborn. Cleanest:
  the driver emits no spans during the transport window it computed; the
  runner asserts inputs are absent there (loud, both sides).
- Cross-level legs stay caller-named; no auto-routing this rung.

### 3.3 The route, and what slice 0 must compute before anything is built

The full item chain. Fixed points from the settled graph: 11 item rooms are
trigger-reachable; the cluster loop is **fall 83→84, fall 84→85, trigger
85→71, ring-walk to 74 (darkshield) and 79 (darksuit), fall 71→82** back
out. Slice 0 deliverables:

1. **The three fall arrivals' landing-tile types** (83→84, 84→85, 71→82),
   from pit tile + `control` offset + destination tiles — each must not be
   6/1/17 or the route needs a different pit tile of the same fall.
2. **The full leg list** L0 → … → every item room → end, with per-level
   corridor census: which unpriced proximity classes each walked level
   holds (§3.6), where the watcher/chest volumes sit, which teleporter
   pairs overlap (the L3 four-teleporter room is already flagged).
3. **Ring feasibility for L79** — see §3.6; this is the checkpoint that can
   stop the rung.
4. **Tick budget + segmentation checkpoints** (§3.5).
5. L57/L69 (fall-in dead ends, off-route): one look for tagged
   persistence-activated teleporters, recorded for the plan doc, NOT
   visited.

Entering an item's level IS collection at this rung — the grant fires on
the arrival tick. **Route legs should touch item rooms and turn around**
rather than approach the pickup: less interior exposure, smaller census,
and the pickup rect stays comfortably un-clipped (the R0 witness already
proved arrival-tick grants clear of the sword's rect).

### 3.4 Fixtures and verification

- **Record pit oracles FIRST** (the v2 slice-0 inversion, again): the
  param boot makes a minimal pit fixture trivial — boot L83 with
  `noHazards: ["water","lava","ice","waterfall"]`, walk onto the pit, drain.
  The recording settles the fall-out tick count, the lerp doubles, the
  descent and the landing before the JS is written; transcribe TOWARD it.
  Keep `hazard-boot-pit` (full 5-set, pit coerced, NO transport) untouched
  beside it — the two are a contrast pair pinning the set semantics from
  both sides.
- A second small oracle for a fall chain (83→84→85 in one tape) before the
  full walk trusts chained falls.
- **The full walk is ONE headline tape** — the gate. Estimate ticks in
  slice 0; if it exceeds ~8–10k ticks, split the ROSTER into segment tapes
  at param-boot checkpoints (boot level + inherited-grants entry) and keep
  the full tape as a rung-close recording rather than an every-iteration
  one. Segments must chain: each asserts it ends where the next boots
  (level AND position AND item set), or the chain claim is vacuous.
- Every fixture: exact stream + element-wise transitions (falls appear
  there like any level change — game side derives from the tick stream
  unchanged; JS side from its OWN swap, never from the level field).
- **Synthesized-fixture doctrine:** the driver re-emits every planned tape
  from the committed task list — geometry errors become reds even on
  routes that avoid them.
- Mutations that must bite, minimum: fall-trigger edge dropped; lerp
  divisor wrong; fall duration ±1 tick; arrival snap without the
  `max(…, 0)` clamp; inputs-during-transport assertion removed; pit tile
  not forbidden floor (planner routes across a pit it didn't name);
  grant-on-cluster-room dropped. Record what does NOT bite as bounded
  vacuities with witnesses, per standing practice.

### 3.5 Acceptance (the rung's terminal assertion, all from `botStatus`)

12 booleans true (sword, darksword, ghostsword, shield, darkshield, wand,
firewand, conch, feather, spear, darksuit, torch), `hitsMax == 4`, `fire`
FALSE, `cutscene` all false, `menu` false, `saw_auto_advance == 0`,
`grants_applied` == the full grant list, and pinned counts (observations,
transitions incl. the three falls, levels entered). The blocked list this
rung publishes should be exactly: `fire` (combat, R5) — nothing else.

### 3.6 The proximity-hazard pricing this route needs (and the STOP condition)

R0 priced `chest` and `watcher`. The route forces more; price ONLY what a
walked level holds (the throw names them). From R0 §8.7's table, expect at
least: `fallrock`/`fallrocklarge` (**L74 is the darkshield room itself**,
L82 is the fall-out arrival, L43 the wand room), `shieldlock*` (**L71 is
the cluster hub**, L12 on the cluster approach, L20 the shield room),
`whirlpool` (46/50/54 — only if routed through), `lavatrap` (77/78/80).
Each price is a transcribed influence volume with its construction-site
citation — a rotating LavaTrap tongue prices as the disc of
`max(tongueLengths)`; never guess a rect (the R0 census rule).

**The checkpoint: both ring approaches to L79 (darksuit) cross lavatrap
levels (71→80→79 and 71→76→77→78→79), and LavaTrap drags the player and
calls `die()` DIRECTLY — `Bot.noDamage` does not apply (R0 §8.7a).** Slice
0 computes, from the extract + the transcribed disc, whether a corridor
through 78 or 80 exists outside every tongue disc. If yes: route it, and
the executor's throws keep it honest. If NO: **STOP — do not widen
`noDamage`, do not add a flag, do not detour the claim quietly.** Report
the geometry and put the choice to the user (`Bot.noEnemyEffects` as a new
crutch + pipeline run, vs darksuit joining `fire` on the blocked list until
R5). Either is coherent; picking one is not yours to do.

### 3.7 Opportunistic, non-gating (take only if the route makes them cheap)

- **The stickiness witness**: the route stands in L83 anyway; a few extra
  ticks mid-hole (the left/right hole columns) makes the sticky fallback
  oracle-visible — the witness v2 §9 named. Its own small fixture, not a
  detour in the headline tape.
- **The latch witness**: the L11 (32,0)→L3 arrival lands ON L3's return
  trigger, and both levels are already on the sword chain. One short tape.
- Both close recorded v2 vacuities; neither gates the rung.

## 4. Slices (commit each separately to main)

0. **Recon + route** (no code): §3.1 transcription targets verified on the
   `bot` branch (call-site order, constants, descent, the
   getStatePos-not-coerced check), §3.3's five deliverables, §3.6 pricing +
   the L79 feasibility verdict. Findings appended to this file. **If the
   L79 checkpoint fails, stop here and ask.**
1. **Pit oracles recorded** (minimal fall + chained falls), `--record --win
   --only=`, fresh page per tape.
2. **The JS transport** transcribed to exact against slice 1's recordings:
   engine + `levelRun` arrival kind + planner policy + driver pit-exits +
   the throws + unit strata + mutations.
3. **The priced volumes** for route levels (census entries + tests; each
   with its citation).
4. **The full walk**: task list, segment tapes if §3.4's budget says so,
   the headline recording, acceptance assertions wired into the verify
   script.
5. **Opportunistic witnesses** (§3.7) if cheap.
6. **Docs + close-out**: the procgen doc gains the pit-transport contract;
   plan-doc R1 checkbox + R4 loses pits; queue §5c; memory topic; this
   file's as-built sections.

## 5. Discipline + traps (standing ones apply; live ones for this rung)

- **Zero AS3 expected.** If anything seems to need an edit, that is a
  finding to report (and batch), not a change to make.
- The fall-out ticks are OBSERVED — do not gate the tick counter on
  `receiveInput`; dead frames remain exactly `blackCover`/`freezeObjects`.
- The descent window refuses input — driver emits no spans there, runner
  asserts none (both sides, loud).
- `hazard-boot-pit` (pit coerced) and the new pit fixtures (pit live) must
  BOTH stay green — they pin the set semantics from opposite sides.
- Two consumers reading one tape differently is the family of bug this
  format exists to kill (R0 §11's presence-vs-value lesson) — any new tape
  field or window rule lands in `tapeFormat.js` with both consumers
  asserted against it.
- An index against the wrong table has now bitten twice (keys[6],
  column-vs-type). Resolve tile columns through `TILE_COLUMN_TO_TYPE`;
  resolve key indices against `Player.as:59`'s array as written.
- `--win` always; deadlines scale with tape length; never `git add -A`
  with background jobs; `JSON.stringify` equality across runtimes compares
  serializers, not values (R0 §12).

## 6. Open questions (ask the user only if blocking)

- §3.6's L79 verdict, ONLY if routing is infeasible.
- Segmentation (§3.4) is an implementation choice — decide from the tick
  budget, don't ask.

## 7. Acceptance gates

- **G1 (CI, vitest):** all suites green; every pre-R1 fixture
  byte-identical; new strata for the fall (trigger edge, lerp, duration,
  snap, descent, throws), the planner policy, the priced volumes; the §3.4
  mutation list run with results recorded either way.
- **G2 (local, `--win`):** every committed fixture re-verified EXACT; the
  pit contrast pair green; the headline walk (or the full segment chain,
  ends-meet asserted) EXACT with §3.5's readout assertions — all from the
  game's own reports.

---

## 8. Slice 0 — RECON, AS BUILT (2026-07-31)

No code. Everything below is source-verified against `~/CC/seedling` branch
`bot` at **`a976a07`** (the commit the deployed wasm was built from) and the
committed extract `flashPanel/atlases/seedling-map.json`. Where §1–§7 was
imprecise it is corrected here; §1–§7 is the brief, this section is the
record.

### 8.1 The fall, transcribed — and §3.1 has its polarity backwards

Every §3.1 target verified. Four corrections, one of them load-bearing.

**The edge (`Player.as:685-716`).** As specified: `eff = Bot.coerceState(_s)`,
the `if (_s != _state)` change gate on the RAW value, `onGround` gating the
whole branch, and `eff == 6` setting `fallInPit`. `fallInPitPos` is
`new Point(tile_test.x, tile_test.y)` where
`tile_test = FP.world.nearestToPoint("Tile", x, y + checkOffsetY)` — **byte-
identical probe args to `getState()`'s own**, so `tile_test` is always the
tile `getState` just resolved, and `fallInPitPos` is that tile ENTITY's
position, i.e. the **cell centre** `(tx*16+8, ty*16+8)`. `onGround` is
written only by `LavaTrap.as:61/66` (R0 §8.1), so it is constant `true`
everywhere the R1 route goes.

⚠ **The edge fires BEFORE the movement, and `receiveInput = false` is set
AFTER it.** `Player.update`'s else-arm runs `getState()` (which assigns
`state`, which runs the setter, which sets `fallInPit`) at the TOP, then
`prev`, then `super.update()` (friction → input → moveX → moveY), then
`checkFallingInPit()`, then the world clamp. `receiveInput = false` lives
inside `checkFallingInPit`. **So the tick the pit edge fires still accepts
input and still accelerates normally**; refusal starts on the tick after.
A transcription that kills input on the edge tick diverges on tick 1 of
every fall.

**The fall-out (`checkFallingInPit`, `:727-748`).** `divisor` is a named
`const:int = 10`. The lerp is
`x += (floor(fallInPitPos.x / Tile.w) * Tile.w + Tile.w/2 - x) / 10` and the
same for y — and since `fallInPitPos` is already a cell centre the target is
`fallInPitPos` itself. It is a **geometric decay, not an arrival**: 20 ticks
of ×0.9 leaves 12.16% of the offset (0.89 px from a 7.3 px start). The
destination does NOT read the player's x — it reads `fallInPitPos` — so the
residual is observable in the stream and irrelevant to the swap. Spin
(`fallSpinSpeed = 8 * FP.choose(-1,1)`) is a `public const` **evaluated once
per Player construction**, so every Player costs one draw from the global
RNG stream; it is invisible to the observation stream and must not be
modelled (but it is why a fall shifts RNG).

**The duration is exactly 20 ticks, and it is a knife-edge.**
`fallAlphaSpeed = 0.05`, `Image.alpha` starts at 1, `alpha <= 0` triggers
the swap. Twenty repeated double subtractions of 0.05 from 1.0 land on
**−3.191891195797325e-16** — just below zero, so tick 20 swaps. Computing
the count as `1 / 0.05` or accumulating differently can land on `+1e-16`
and give 21. **Transcribe it as repeated subtraction of the same constant.**

**The swap.** `x = floor(max(fallInPitPos.x - Game.fallthroughOffset.x, 0)/16)*16`
(and y), then `Game.setFallFromCeiling = true`, `Game.sign =
Game.fallthroughSign`, `FP.world = new Game(fallthroughLevel, x, y)` — the
same deferred end-of-tick swap as a teleporter, so it flows through
`levelRun`'s one-swap-two-callers machinery as a new arrival KIND.
`Game.fallthroughOffset` is `(control.x + control.xOff, control.y +
control.yOff)` (`Game.as:2050-2053`) — **the control ENTITY's own position
plus its offset attrs**, not the offset attrs alone. `fallthroughLevel > -1`
is checked; **otherwise the game calls `die()`** (see §8.3).

⚠ **`Game.end()` resets `fallthroughLevel` to −1 and the `Game` CONSTRUCTOR
calls `end()` on itself** (`Game.as:652`), while `loadlevel` runs from
`begin()`. FlashPunk's `checkWorld` orders `oldWorld.end()` → swap →
`newWorld.begin()`, so the destination's own control block is read after
both resets. The chain works only because of that ordering; a model that
read the control block at construction time would carry the SOURCE level's
fallthrough into the destination.

**The arrival, and ⚠ §3.1.4's polarity is INVERTED.** `Player.check()`
(`:419-424`) — which `Game.update` runs for every entity on the new world's
first frame, ABOVE the `blackCover` gate — does
`if (fallFromCeiling) y = FP.camera.y - (height - originY)`. `normalHitbox`
is `(2,2,4,5)` so `height - originY = 3`; `loadlevel` had just set
`FP.camera.y = player.y - FP.screen.height/2` **unclamped**, and `view()`
(which clamps and rounds) runs AFTER `check()` in the same update. So:

> **the descent always starts exactly 83 px above `yStart`, in every level,
> and therefore always takes exactly 41 ticks** (`v.y += 0.1` capped at 5,
> `y += v.y`; y overshoots by 3.100000 with v = 4.100000).

`FP.screen.width/height` stay 160×160 for the life of the process —
`Screen.resize()` caches them at Engine construction and `Game.as:1854`'s
per-level `FP.width/height` overwrite does not touch them.

Then `Player.as:488-506`:

```as3
if (y >= yStart) {
    if (bouncedFromCeiling || getStatePos(x, yStart) == 6 || == 1 || == 17) { land }
    else { y = yStart; v.y = -2; bouncedFromCeiling = true; }   // BOUNCE
}
```

**The bounce is the NORMAL case and it must be modelled.** Landing on
pit/water/lava is the case that stops dead — you cannot bounce on a hole or
a liquid. §3.1.4 read it the other way round and told the route to *avoid*
6/1/17 arrivals; the truth is the opposite, and the R1 route depends on it
(§8.2). The bounce arc is **exactly 39 ticks** and returns to `y == yStart`
with zero float residue. `bouncedFromCeiling` is per-Player, so it is fresh
on every arrival. Nothing else in the update runs while `fallFromCeiling`:
no `getState`, no movement, no `checkFallingInPit`, no world clamp — the
descent is pure ballistic y, and x is frozen at the arrival value.

✅ **`getStatePos` is NOT routed through the coerce** — verified as written
on the `bot` branch: `Player.as:670-678` has no `Bot.coerceState` and R0's
four sites do not include it. So the landing check reads the RAW tile type
while the physics reads the coerced one. That is not a curiosity: the
`48 ⇓ 49` fall on the R1 route lands on **Ice (22)**, which `noHazards`
coerces to 0 for the physics and which the landing check sees as 22 → not
in {6,1,17} → **bounce**. One fixture exercises both readings of one tile.

Conflicts still throw as §3.1.5 specifies. One is LIVE and off-route:
**L100's exit teleporter to L101 stands ON a pit tile**, so the trigger and
the pit edge fire on the same tick. The teleporter wins (its swap lands at
end of tick, the fall needs 20), but the winner is bookkeeping this module
should not silently assume — throw, and name L100.

### 8.2 The three fall arrivals, and L84 is a PASS-THROUGH

Computed from pit tile → `fallInPitPos` → control offset → ctor args →
`(x+8, y+8)`, then `getStatePos(x, yStart)` resolved through
`nearestToPoint` over the WALKABLE tiles (solids have left the `"Tile"` list
long before the descent ends):

| fall | pit tile | `fallInPitPos` | offset | `new Game(...)` | arrival | landing tile | verdict |
|---|---|---|---|---|---|---|---|
| **48 ⇓ 49** | (11,3) | (184,56) | (144,16) | `(49,32,32)` | (40,40) | (2,2) = **Ice 22** | BOUNCE |
| **83 ⇓ 84** | (2,1) | (40,24) | (0,−16) | `(84,32,32)` | (40,40) | (2,2) = **Pit 6** | **no bounce** |
| **84 ⇓ 85** | (2,2) | (40,40) | (−16,−32) | `(85,48,64)` | (56,72) | (3,4) = Igneous 16 | BOUNCE |
| **71 ⇓ 82** | (12,13) | (200,216) | (32,−64) | `(82,160,272)` | (168,280) | (10,17) = Igneous 16 | BOUNCE |

⚠ **L84 is a 3×3 block of pit tiles (1..3 × 1..3) and the 83 ⇓ 84 arrival
lands in its centre.** The player never touches free floor there: the
descent ends on a pit, no bounce, and the NEXT tick's `getState` fires the
pit edge again. **L84 is a pass-through — a leg with zero targets, zero
input spans and an automatic exit.** That is not an optimisation, it is the
only way through: the level has no walkable component adjacent to the
arrival at all, so a router that demanded one reports darkshield and
darksuit unreachable (this is exactly what the first cut of the slice-0
router did, and the fix is what opened the cluster).

So one fall costs 20 (fall-out) + ~19 dead frames + 41 (descent) + 39
(bounce, if any) live ticks: **61 ticks for 83⇓84, 100 for each of the
others**, and the 83 → 85 chain is 61 + 1 + 20 + 41 + 39 = **162 live ticks
across two world loads**.

### 8.3 Pits are lethal floor almost everywhere — the planner policy is not optional

Only **12 levels carry a `control` block** (12, 16, 30, 32, 40, 48, 56, 70,
71, 83, 84, 110). **27 more hold pit tiles with NO control block**, and
`checkFallingInPit`'s `else` branch calls `die()` — including L106
(ghostsword, 87 pits), L109 (firewand, 38), L80 (5, on the darksuit ring)
and the whole of Dungeon 6. Walking onto an unlisted pit is not a
divergence, it is death. Pit-as-forbidden-floor is what keeps the walk
alive, and it happens to be free today (an uncoerced 6 is unmodelled
terrain, which `plannerBlockerAt` already reports) — **which is exactly why
it must become an explicit driver policy the moment slice 2 makes pit
MODELLED, or the planner silently starts routing across them.**

### 8.4 The volume census, and three classes that price to NOTHING

Every class the route meets was read at its construction site. Three are
**inert on a fresh boot**, and the evidence matters more than the result:

- **`fallrock` / `fallrocklarge`** — the ctor parks the rock at `y = -16`
  with `type = ""` unless `!Game.checkPersistence(tag)`, and `update`'s
  whole falling branch is behind the same test. `Main.as:319-330` fills
  `levelPersistence` with `true` on a fresh boot, so a `tag >= 0` rock never
  falls, never freezes and never writes `p.y`. **All six on the route carry
  a tag** (L37#4, L39#10, L43#1/2/3, L74#2, L82#1). Volume: **none**.
- **`bosstotem`** — `update` activates on `FP.world.classCount(Wand) <= 0`.
  R0's grants are **property writes only**, so L43's Wand pickup is never
  removed from the world, so `classCount(Wand)` is never 0, so the boss
  never activates and its `p.y` write at `:284` (guarded by
  `fullyActivated`) never runs. Volume: **none** — and this is the R0 grants
  ruling paying for itself in a way nobody predicted.
- **`shieldlock` / `shieldlocknorm`** — fires only under
  `(hasDarkShield && type==1) || (hasShield && type==0)`, i.e. the volume is
  **a function of the inventory**. Priced **unconditionally live** anyway: a
  volume that appears halfway through a walk is a policy the driver has no
  vocabulary for, over-avoiding is the safe direction, and the Lock rect is
  one tile.

The rest are small rects or discs, each with its citation:

| class | volume | source |
|---|---|---|
| `lavatrap` | **disc, r < 33** about `(_x+8, _y+8)` | `chompRange = 32` and `var d:int = FP.distance(...)`, so `d <= 32` ⟺ dist < 33 |
| `iceturret` | **disc, r < 129** about `(_x+16, _y+16)` | `attackRange = 128`, same int truncation; outside it `shootTimer` is RESET and no shot is ever created |
| `whirlpool` | rect `[_x, _x+32) × [_y, _y+32)` | `super(_x+16,_y+16)`, `centerOO()`, `setHitbox(32,32,16,16)`; gate is `collide("Player", x, y)` |
| `pull` | rect `[_x, _x+16) × [_y, _y+16)` | `super(_x,_y)` (no half-tile), `setHitbox(16,16)` default origin |
| `button`, `buttonroom` | rect `[_x+4, _x+12) × [_y+5, _y+11)` | `super(_x+8,_y+8)`, `setHitbox(8,6,4,3)`; **`hitables` includes `"Player"` in both** |
| `shieldlock*` | rect `[_x-1, _x+15) × [_y, _y+16)` | `Lock` `setHitbox(16,16,8,8)` at `(_x+8,_y+8)`, probed at `collide("Player", x-1, y)` |

⚠ **`buttonroom` is not decorative.** L38's two carry `room="37"` and
`room="39"` — standing on one writes persistence into a DIFFERENT level, and
the JS models both of those levels from a static extract. Small rect, but a
real avoid volume.

**Eleven classes to price for the route: `pull`, `iceturret`, `bosstotem`,
`shieldlock`, `lavatrap`, `fallrocklarge`, `shieldlocknorm`, `whirlpool`,
`fallrock`, `buttonroom`, `button`** — three of them (`fallrock`,
`fallrocklarge`, `bosstotem`) priced as an evidenced **inert**, which is a
volume entry with a citation, never a silent omission.

### 8.5 ✅ THE L79 CHECKPOINT PASSES — and the reason is not the one §3.6 expected

§3.6 asked whether a corridor through L78 or L80 clears every tongue disc.
It does, comfortably, and the shortest ring is the one that works:
**71 → 80 → 79**, with 79 → 80 → 71 back.

L80 (`Dungeon7_9`, 10×20) is an almost solid sheet of **Lava**, which
`noHazards` makes walkable, with two lavatraps at tiles (2,14) and (5,6).
An r=33 disc excludes only the 13 tiles with `dx²+dy² <= 4.25`, so each trap
blocks a plus-shaped blob two tiles across in a level ten tiles wide. The
arrival from L71 is (40,24) — 208 px from the nearer trap — and the exit
triggers to L79 sit at tiles (2,19) and (3,19), 90 px from it. The five pit
tiles (5,7) and (1..4,15) are avoided by the same policy that keeps the walk
alive everywhere else. **A component-level router with every volume above
priced puts L74 (darkshield) and L79 (darksuit) at depth 6 from the boot.**
No `Bot.noEnemyEffects`, no widened `noDamage`, no quiet detour.

L108's three lavatraps (all at x = 136 in a 240-wide level) and L77's single
one are equally routable; they are only relevant if §8.6 is resolved in
favour of Dungeon 8.

### 8.6 ⛔ BUT A DIFFERENT PRICED VOLUME CLOSES A MANDATORY CORRIDOR: L98's ICE TURRET

§3.6's closing sentence — *"same rule for any other priced volume that
closes a mandatory corridor"* — is the one that fires. It is not lavatrap.

`Enemies/IceTurret.as` is **static** (its `update` contains no movement) and
its gate is one line: `if (d <= attackRange && ...)` with
`attackRange = 128`. Outside that radius `shootTimer` is reset to its max
every frame and no shot is ever constructed, so **a route that never comes
within 129 px of the turret is provably safe** — the volume is exact, not
conservative. Inside it, `IceTurretBlast.as:52` calls `Player.freeze()`,
which `Bot.noDamage` does not touch (R0 §8.7a) and which stops the input
block for 90 frames.

**L98 (`Dungeon8_Entrance`) is 15×13 tiles = 240×208 px and its turret sits
at (120,40).** An r=129 disc covers rows 0–10 entirely and all but the outer
columns of rows 7–10. And:

- the **arrival** from L93 is (120,104) — **64 px from the turret, already
  inside**;
- the **exit**, `stairsup` at tile (7,7) → L99, is **80 px from the turret**;
- the only free region is rows 11–12, which holds nothing but the teleporter
  back to L93.

There is no corridor, and there is no second door: an inbound survey over
every live trigger and every `control` block in the extract gives
`in(L99) = {98, 100}`, `in(L100) = {99}`, and no `control` block anywhere in
levels 99–109 — **L98's stairs are the ONLY entrance to Dungeon 8**, whose
levels 99–110 hold `ghostsword` (L106) and `firewand` (L109). The only fall
edge in the dungeon is L110 ⇓ L0, pointing outward.

So R1 must either buy a new crutch or shorten its claim. Per §1.4 and §3.6
that trade goes to the user; §8.9 records the decision.

### 8.7 The route, as computed — 11 items, 74 legs, 46 levels

Routing had to become a **`(level, component)` search**, not a level search.
Two levels on the route have their exits in different connected components
of the R1-blocked plane and are only crossable if the leg names the right
teleporter: **L65** (Dungeon 6, whose columns 3 and 7 are pit in every row,
so its two entrances from L63 reach different halves) and **L60/L63**.
A level-graph BFS picks a trigger that arrives in the wrong half and the
walk is stranded with nothing wrong in the code. This is the maze bot's
`(region, arrival-exit)` lesson arriving on the real map.

Item order (2-opt over component-graph hop distance, wand forced before the
Witch, cluster forced last): **sword → shield → feather → conch → wand →
darksword → torch → ghostspear → health → darkshield → darksuit**, then the
`71 ⇓ 82` fall as the final leg. 71 hops, **74 legs, 46 distinct levels,
3 falls, 1 pass-through**.

⚠ **The wand-before-darksword ordering IS honoured, and only because L43 is
reachable without L12**: `0 → 89 → 87 → 44 → 37 → 38 → 39 → 40 → 43`, then
`43 → 37 → 12`. Every other route to the wand goes through the Witch's own
level, and the grant fires on FIRST entry, so a tour that touched L12 early
would grant `darksword` before `wand` and quietly contradict the one true
item→item dependency the game has.

⚠ **The `12 ⇓ 21` shortcut to the torch is REFUSED by the router**: L12's
pit (36,43) sits inside the 14-tile `pull` cluster, so the fall is
unreachable and the tour takes `12 → 24 → 23 → 21 → 22 → 30` instead. Three
hops more, and the router found it without being told.

**Tick budget: ~8–11k live ticks** (74 crossings at ~80–150 ticks each, plus
~260 for the falls) and ~1,400 `blackCover` frames, i.e. **~7–8 minutes per
`--win` recording**. That is over §3.4's iteration threshold, so the roster
splits into **six segment tapes** with the full walk kept as a rung-close
recording:

| # | span | ends at |
|---|---|---|
| 1 | boot L0 → sword (L10) → L0 → shield (L20) → L0 | arrival in L0 |
| 2 | L0 → feather (L89) → 87 → 44 → the conch loop (45,46,47,48 ⇓ 49,50,51,53,48) → 44 | arrival in L44 |
| 3 | 44 → 37 → 38 → 39 → 40 → wand (L43) → 37 → **12 (darksword)** | arrival in L12 |
| 4 | 12 → 24 → 23 → 21 → 22 → torch (L30) → back → 12 | arrival in L12 |
| 5 | 12 → 95 → 59 → 60 → 61 → 62 → ghostspear (L64) → 63 → 65 → health (L68) → back → 12 | arrival in L12 |
| 6 | 12 → 83 ⇓ 84 ⇓ 85 → 71 → 75 → **darkshield (L74)** → 71 → 80 → **darksuit (L79)** → 71 ⇓ 82 | arrival in L82 |

⚠ **Every boundary is a level ARRIVAL tick, deliberately.** An arrival's
position is exactly the ctor half-tile `(playerx+8, playery+8)`, its velocity
is zero and its terrain state is fresh — which is precisely the state a
parameterised boot reproduces, so `boot: {level, x: playerx, y: playery}`
matches `atBootPosition()` and the chain claim (level AND position AND item
set) is exact rather than approximate. A boundary mid-level could not be
booted into at all: the ctor takes ints and adds 8.

### 8.8 The two opportunistic witnesses are BOTH on the route, for free

- **The latch witness (§3.7) is already there.** The tour walks
  `10 → 11 → 3`, and L11's (32,0) teleporter arrives at (104,136) — **on
  top of L3's own (96,128) return trigger**, which is one of the four
  ping-pong pairs the v2 vacuity table names. It needs no extra tape; it
  needs the planner to be able to STAND on it, which is the policy note
  below.
- **The stickiness witness (§3.7)** still needs its own short tape: L83's
  hole columns are on the route (the walk crosses L83 to reach the pit) but
  the mid-hole tie the v2 doc records is unresolved by the route alone.

⚠ **New planner requirement both of them expose: the ARRIVAL tile may be a
foreign teleporter's volume, and the driver must be able to start a leg
there.** The game suppresses the re-fire through the pre-armed latch that
`levelRun.arriveIn` already models; the PLANNER refuses the tile outright
today (`plannerObstacleAt` has no exemption for it), so A\* fails on its
start tile. The exemption is "the trigger the arrival latched", and it is
strictly narrower than the leg's own `exit` exemption.

### 8.9 Deliverables against §3.3, answered

1. **Three fall arrivals' landing tiles** — §8.2. Two bounce, one does not,
   and the one that does not is the pass-through that opens the cluster.
2. **The full leg list with per-level census pricing** — §8.7 and §8.4.
3. **L79 ring feasibility** — §8.5, PASSES.
4. **Tick budget and segmentation** — §8.7, six segments.
5. **L57 / L69 (fall-in dead ends, off-route)** — surveyed and recorded, not
   visited. Neither holds a teleporter entity **of any kind**, tagged or
   otherwise: L57 is `{shadow×7, lightalpha, orb×2, tentaclebeast#0,
   watcher#1}` and L69 is `{lightalpha, droplet, watcher#1,
   lightbosscontroller#0}`. Their vanilla exit is the boss-death level swap
   (L57 → L58 `Dungeon5_DeadBoss`, which holds the teleporters back), not a
   persistence-activated teleporter. **L58 and L81 remain unreachable by any
   edge**; L81 holds no entities at all.

### 8.10 ⚠ ZERO AS3 EDITS NEEDED — and one thing to report, not fix

Nothing in §8.1–§8.8 needs a line of ActionScript. The one finding worth
batching if a future rung opens the pipeline anyway: `Player.as:699` builds
`lastPosition` from `nearestToPoint("Tile", prev.x, prev.y + checkOffsetY)`
**without a null guard**, on every state change. `lastPosition` is dead code
(R0 §8.1) and the query only returns null in a level with zero walkable
tiles, so it cannot fire on any real level — recorded so nobody re-derives
it as a hazard.
