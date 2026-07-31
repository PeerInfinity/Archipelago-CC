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
