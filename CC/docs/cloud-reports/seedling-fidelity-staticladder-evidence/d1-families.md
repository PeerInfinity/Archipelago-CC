# STATICLADDER D1 — the combat-ladder EXHAUSTED rows, sub-classified

Sources (measured 2026-10-10 at `3e0ff8b80f`):
- the route survey, CI run **38010117701** (`survey-seedling-shards.mjs --fetch=38010117701`): **13** steps refuse
  "the combat ladder is EXHAUSTED" (the brief's 8 static + the 5 spinner/axe/beam it set aside);
- the JS arc's sweep-3, CI run **38010249317** (`gh run download`, `divergence-merged/merged/rows.jsonl`, the
  `failed` text): **43** legs (the brief said 42).

Other lights in these rooms (`torch`, `bonetorch`, `planttorch`, `orb`) were checked from the level records: none is within 48 px of a failing darktrap.

Per-row data: `d1-classes.json` (written by the classifier, `node d1.mjs <out>`; the script is quoted in the report).
The body is the first `enemy:/chaser:/crusher:/hazard:/spinner:` id the refusal names; the pole distance is from the
DarkTrap's entity point (`.oel` + 8) to the `LightPole`'s light at `(poleX + 8, poleY + 2·sin(2π·(Game.time % 45)/45))`
(`LightPole.render`: `y = startY - originY + 2 sin(…)`, `LightPole.png` 16x16 so `originY` 8).

## Families (survey + sweep)

| # | family | class(es) | survey steps | sweep legs | model today | what the GAME does (AS3) | the rung that should answer |
|---|---|---|---|---|---|---|---|
| F1 | **weapon-immune static, light death unmodelled** | DarkTrap | **113, 115, 208** (3) | 537, 542, 547, 555, 556, 558, 559 (L62); 563, 567, 571, 572, 573, 574, 578, 579 (L63) (**15**) | static census body at its placement (`staticEnemyDanger`), `contactPricing` "static", `KILL_ARM_POLICY` `inert` | `DarkTrap.update` (`DarkTrap.as:29-52`): any `Light` that is not a `PlayerLight`, not `darkLight`, within `radiusMin` → `startDying`; from that tick `super.update()` is SKIPPED (no `hitPlayer` — harmless), 30-tick `deathCounter`, then "die1" (14 frames, rate 10) → `endAnim` removes → `SandTrap.removed` writes the tag. `hit()` is EMPTY. Every failing darktrap sits on a 1-tile ghost bridge with a `LightPole` beside it (`LightPole.hit()` only under `t == "Spear"`: the Spear thrust, or a ghost-sword swing) | **KILL: a LIGHT arm** — press the pole; none exists |
| F2 | **unbridged mover / shooter priced at its placement** | Bulb, LavaRunner (Bob subclasses), Drill, Turret | **160** (bulb), **190** (lavarunner) (2) | 626, 627 (bulb L74); 617, 622 (lavarunner L72/L74); 712, 713 (drill L91); 539, 544, 549, 550, 551, 552, 553 (turret L62) (**13**) | `staticEnemyDanger` prices the `.oel` placement; `contactPricing` "mover" (Bulb/LavaRunner/Drill: speed ≠ 0; Turret: `aggro.kind` `static-shooter` ≠ `static`) | Bulb/LavaRunner CHASE (`Bob.update`); LavaRunner is K2's arm (OFF, no game witness); Turret is truly static (`speed 0`), sword-killable (3), its spit is stepped | bridge (CHASERS row) then bait/kill; Turret: a static SWORD arm |
| F3 | **sword-killable static, no sword arm on a static body** | SandTrap | **31** (1) | 76 (L6, stepped); 85 (L8, refused room: the ceiling arm's presser has no reachable stance) (**2**) | static; the ladder's STATIC arm is reached only for a `stepped === false` body (a REFUSED room) and is the ceiling's ARROWS, never the sword | `SandTrap` takes `Enemy.hit` (hitsMax 3, knockback empty) | KILL: a static SWORD arm (`KILL_ARM_POLICY.SandTrap` is `refused`) |
| F4 | bridged chaser — not a static body | Bob (L16), Puncher (L12) | **63** (1) | 201–205, 207, 208 (L16) (**7**) | stepped, live | chases | avoid failed on CONNECTIVITY; chaser arm / detour refused — not this slice's region |
| F5 | other arcs' rows (named, left) | SpinningAxe, BeamTower, Spinner (L40), BobSoldier (L30), Crusher (L107) | 150, 159, 181, 202, 204, **210** (6) | 752; 395, 412; 333, 339; 779 (**6**) | — | — | hammer arc / BOBSOLDIER2 / CRUSHER_BAIT |
| | **total** | | **13** | **43** | | | |

### Step 210 / leg 779 (L107 crusher, the brief asked): a **BAIT/TIMING gap, not a static-ladder gap**

`crusher:crusher@32,0 (trigger lane S with a clear sight line (LIVE centre 48,16))`: the crusher is a LIVE stepped
hazard (its live centre is in the reason), not a static census body, and the climb is the hold-stance walk to
`buttonroom@288,176`. Avoid fails on connectivity with the lane forbidden; no static row is involved. ⇒ CRUSHER_BAIT's
(the crusher's trigger-lane timing on a hold approach), not STATICLADDER's.

### F1 — who can light the pole (the run's items at the row)

| row | level | darktrap | pole (light distance, bob range) | Spear | ghost sword |
|---|---|---|---|---|---|
| step 113, legs 537 542 547 555 556 558 559 | L62 | `darktrap@112,208` → (120,216) | `lightpole@120,200` → light (128, 200±2): 16.1–19.7 px | ✘ | ✘ |
| step 115 | L62 | the same | the same | ✔ | ✘ |
| legs 563 567 571 | L63 | `darktrap@64,96` → (72,104) | `lightpole@64,88` → (72, 88±2): 14–18 px | ✘ | ✘ |
| legs 572 573 574 | L63 | `darktrap@80,64` → (88,72) | `lightpole@64,88` → (72, 88±2): 21.3–24.1 px (⚠ 28.8 at the ctor position, before the first render) | ✘ | ✘ |
| legs 578 579 | L63 | `darktrap@32,272` → (40,280) | `lightpole@48,272` → (56, 272±2): 17.1–18.9 px | ✔ | ✘ |
| step 208 | L101 | `darktrap@160,80` → (168,88) | `lightpole@144,64` → (152, 64±2): **27.2–30.5 px — in range only while the bob is in its lower third** | ✔ | ✔ |

⇒ **14 of the 18 F1 rows hold neither weapon**: no model can light those poles; the honest outcome there is a refusal
that names the Spear as the sub-order the route owes (the route plans L62/L63 before the Ghost Spear). Only steps 115,
208 and legs 578, 579 are model-side solvable by a light arm.
