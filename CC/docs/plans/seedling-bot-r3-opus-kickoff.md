# Region atlas Phase 8 — subtractive ladder, Rung 3 (Opus kickoff): interactions + real collection

**Date:** 2026-08-01 (Fable design session; three user rulings below).
**Parents:** `CC/docs/plans/seedling-bot-subtractive-plan.md`,
the R0/R1/R2 kickoffs' as-built sections (R2's hold the HOLD contract, the
lock-despawn corrections, the l71 fixture-pair pattern, the span-budget
finding). Doc: `docs/json/developer/procgen/seedling-bot.md`. Memory:
`project_seedling_bot_r2.md`, `project_seedling_bot_r1.md`, the arc topic.

## 0. Mission in one paragraph

Retire both crutches class by class by making the bot OPERATE the game:
real walk-over collection (the ceremony and `Bot.autoAdvance` firing live
for the first time), talk seals (karlore, the Witch → darksword), slash
and spear (breakable rocks, ropes, the bridge), touch-locks (ShieldLock's
position-snap ceremony), pushing, and wand-shot activators — restoring
wand, conch and health for a **target claim of 11 items REAL-collected and
REAL-opened** (`hitsMax == 4` returns as a positive), with named exceptions
only where the opener is enemy-shaped (kill-all-enemies locks stay cleared
until R5). Raw tapes remain the format: the span ceiling gets MEASURED and
`botLoadTape` gets CHUNKED. One rung, ordered slices, the walk re-recorded
once at the end.

## 1. Settled rulings — do NOT re-litigate

1. **(user 2026-08-01) One kickoff, ordered slices** — mechanics land
   cheapest-first, each with its own fixtures; the claim ratchets; the
   full walk re-records once at rung close.
2. **(user 2026-08-01) Raw tapes + chunked load.** Measure the span
   ceiling with a synthetic sweep FIRST (the R2 failure was
   `heap_alloc` at BOOT — a too-big tape is a dead run, not a slow one);
   chunked `botLoadTape` rides the AS3 batch; keep the driver's span
   economy (`allowGrazes`). The directive-tape transition is its own arc
   between R4 and R5 — do not pilot it here.
3. **(user 2026-08-01) Target 11 real, named exceptions.** Grants retire
   per item as its real collection lands; clears retire per class as the
   real opener lands; a clear survives ONLY where its opener belongs to a
   later rung (each named with its rung — the known one: base-`Lock` with
   `tSet == -1` opens on `totalEnemies() == 0`, which is R5). Slice-0
   feasibility can still shrink the target — shrinkage ESCALATES.
4. Carried: `noDamage` + the 4-name `noHazards` set stay ON (R4/R5); pits
   live; sound LAST; frozen fixtures stay byte-identical; `--tier=fast`
   for iteration with the bounded-sweep lesson honoured; the game is the
   only oracle; tapes are whole regenerated artifacts.

## 2. The mechanic taxonomy (recon this session, source-verified)

- **Collection ceremony:** walk-over → `Game.freezeObjects` (~150 frozen
  frames) → NPC text → dismissed by `Input.released` on X during frozen
  frames — which is `Bot.autoAdvance`'s job, compiled since R0 and **never
  yet fired live** (`saw_auto_advance == 0` is asserted everywhere). The
  `Help` popups are already suppressed (`Inventory.help = false`, R1).
  `removed()` does the three-part effect: property + `setPersistence` +
  the suppressed Help. Ceremony frames are DEAD frames — the observation
  stream pauses; determinism holds because the cadence is frame-counted.
- **Talk seals:** karlore (L48, blocks as a Solid NPC until talked
  through; persistence-despawns after) and the Witch (L12,
  `doneTalking()` spawns DarkSword at the player **iff `hasWand`** — a
  REAL ordering constraint now: wand before witch). Talk initiation is an
  X release in `talkRange` (24 px) on a LIVE frame; the pages then run
  under auto-advance in frozen frames.
- **Slash / spear:** X press → the `slashing` setter (`slashTimer` 20
  opens the double-press dash — do NOT double-press unless dashing is
  wanted); hits route through `genericHit`. Plain BreakableRock: Sword OR
  Spear. `breakablerockghost`: verify its weapon at source. The bridge
  (t=29) opens off a spear hit via `bridgeOpeningTimer` — **recon its
  full cycle before modelling: opening may be a WINDOW, not a latch.**
- **Touch-locks:** `ShieldLock.update` — collide while holding the right
  shield → snaps `p.y`, sets `receiveInput = false`, runs the ~100-tick
  activation fade, `turnOff()` restores input + writes persistence. A
  position-writing input-window ceremony: model exactly; the driver emits
  no spans in the window and the runner asserts none (the transport-window
  rule again).
- **Activator locks (`tSet >= 0`):** the button system. Stand-on buttons
  are R2-done (HOLD). **Wand-buttons are pressed by wand PROJECTILES** —
  `WandLock` itself is only a skin over base `Lock`. Shot modelling is
  internal to the JS engine (the differential still compares only player
  observations + transitions; the effect is verified by walking through
  the opened lock, with a shut-before positive control — the l71 pattern).
- **Kill-enemy locks (`tSet == -1`):** NAMED EXCEPTION, stay cleared,
  retire at R5.
- **Pushing:** `PushableBlock` is a Mobile moved by player contact, no
  persistence, positions reset per load — deterministic, modellable.

## 3. Design constraints

- **Swings and shots must not touch enemies.** `genericHit` hits type
  `"Enemy"`; a kill consumes RNG (coin drops), spawns attracting coins,
  and decrements `totalEnemies()` — which can OPEN a kill-lock early and
  silently change gating. Enemies are unmodelled until R5, so the policy
  is structural: **swing/shoot only in rooms whose census shows zero
  enemy entities**, and slice 0 verifies every needed swing/shot site is
  in one. A needed opener inside an enemy room ESCALATES (defer that
  opener vs an R5 pull-forward is the user's trade).
- **Ceremony probe BEFORE the batch.** Record a minimal real-collection
  fixture against the EXISTING build first — it is auto-advance's first
  live fire, and if the cadence or the gate has a defect, the fix rides
  the one AS3 batch instead of forcing a second build.
- **The batch is ONE build:** chunked `botLoadTape` + whatever the probe
  and slice 0 add, finalized before compiling; `FRESH=1`; the
  byte-inertness gate over every frozen fixture BEFORE anything new is
  recorded.
- **Every "opened" claim is a PAIR** (the l71 pattern): the open recording
  plus a shut-before control, because the open alone is satisfiable by a
  blocker that was never there.
- **The crutch ledger is part of the claim:** at rung close the tape's
  `grants` are EMPTY for every collected item (the readout's
  `grants_applied` proves it) and the `persistence` clears are exactly
  the named-exception set. An acceptance check distinguishes
  real-collected (the game's own persistence array, read back as R2 did)
  from granted.
- **Route order is load-bearing again:** wand before the Witch; spear
  before the bridge; shields before their locks. The planner's task list
  carries the dependency order; the executor's throws keep it honest.

## 4. Slices

0. **Span ceiling + probes + recon** (mostly no code): the synthetic
   span-ceiling sweep; the ceremony probe fixture (existing build); the
   per-opener recon — bridge cycle semantics, `breakablerockghost`'s
   weapon, `MagicalLock`'s own check (Wand OR FireWand — verify the OR at
   source), L38 `cover`'s activator wiring (⚠ if its button needs a wand
   shot and wand is behind it, that is CIRCULAR — escalate), the
   wand-button inventory on route, the enemy-room census for every swing/
   shot site, and the kill-lock (`tSet == -1`) inventory (the named
   exceptions list, priced). Feasibility verdicts and escalations to the
   user NOW.
1. **The AS3 batch** + byte-inertness gate.
2. **Ceremony collection** (JS model + fixtures; sword-for-real first;
   `saw_auto_advance` becomes a POSITIVE assertion with a pinned count;
   grants retire per collected item).
3. **Talk seals** (karlore; witch → darksword chain, wand-first order).
4. **Slash/spear + breakables + the bridge** (enemy-free-room policy
   enforced by the planner; pair fixtures per opener class).
5. **Touch-locks + pushing** (the ShieldLock input-window ceremony; block
   pushes with post-push component updates).
6. **Wand-shot activators** (the projectile model — last, most novel).
7. **The walk**: re-plan with real ordering, segments + headline
   (boundaries at once-visited hubs, minimal re-record blast radius),
   acceptance for the ruled claim (11 real + `hitsMax == 4` positive +
   exceptions named + ledger checks + pinned counts).
8. **Docs + close-out**: doc R3 section, kickoff as-builts, plan-doc
   checkbox with the real claim, queue §5c, memory topics, far-end backup
   verification.

## 5. Discipline + traps (standing ones apply; live ones here)

- Read the branch BODIES, not the predicate — five instances now. Census
  claims are per-INSTANCE with counts, never "all" (the Lock.check
  lesson).
- Recon instruments PROPOSE, the shipped planner CONFIRMS (two data
  points say instruments err toward false seals); reachability recon runs
  at movement granularity with R2's published reachability as the
  known-answer control.
- No spans inside any input-refused window (transports, touch-lock
  ceremonies, collection freezes) — driver emits none, runner asserts
  none, both loud.
- `assertRect` at every rect birth; negatives need positive controls;
  every opened-blocker claim is a pair.
- Recording: `--record --only=` always, `--win` always, fresh page per
  tape, deadlines scale with tape length, batch recordings (full sweep
  ~55+ min and growing — keep `--tier=fast` honest about what it
  bounded).
- Zero AS3 outside the one batch; anything found later is a finding to
  report. Never `git add -A` with a recording running; stage+commit
  atomically; commit each slice to main; push when green.

## 6. Open questions (ask the user only if blocking)

- Slice-0 escalations: circular activator dependencies, a needed opener
  inside an enemy room, bridge-window semantics that resist exact
  modelling, or a span ceiling low enough to force re-segmentation.

## 7. Acceptance gates

- **G1 (CI, vitest):** all suites green; every frozen fixture
  byte-identical; new strata per mechanic (ceremony timing, talk flow,
  slash arc + genericHit, touch-lock window, push motion, projectile
  flight); mutations that must bite, minimum: auto-advance cadence ±1,
  a swing one pixel out of arc, the wand-shot missing its button, a
  touch-lock span emitted inside the window, a push mis-stepped, grants
  non-empty for a collected item, a clear surviving outside the named
  set. Record non-biting mutations as bounded vacuities with witnesses.
- **G2 (local, `--win --tier=full`):** frozen fixtures EXACT against the
  new build; every mechanic's pair fixtures EXACT; the R3 chain a
  PARTITION of its headline; acceptance asserting the ruled claim from
  the game's own reports — items, `hitsMax == 4`, the persistence array,
  the empty-grants ledger, the named-exception clears, pinned counts.
