# Seedling hammer-phase PIT-WEST — the L39 pit arrivals' bob cluster (387/388) and the no-answer detour

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-pit-west` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ queued by the user 2026-11-05 (the L40 census's step 6) |
| Start SHA | `97739720dd4121e306312a111b00873dda9d00a4` (origin/main). Leg ids unchanged from the census's `2342e256` (387/388/871/403 are the same keys) |
| Head | the commit after `59105be2` (this report); code head `383e6294` (the NARROW deferral `eff83928` + its 403 row) (this report is the last commit) |
| Branch | `claude/seedling-pit-west-l39-bob-4o7u96` (the harness's designated branch) |
| Switches | `CHOOSER_CUT` (OFF), `DETOUR_VIA_BOUND` (OFF), both new; nothing else flips |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-pit-west-evidence/` (README below, §10) |
| Scope messages | none arrived mid-run |
| Environment | bootstrap `--seedling` done (its pip line failed, as in earlier slices; nothing here reads it); every submodule initialised (the wasm one too, for the page); node v22.23.4; 4 cores; :8000 served by `serve-nocache.py` |

## 2. The answer first

**The one thing to know first: wall G is not a bob, it is four bodies standing in a one-tile maze.** The route from the
L39 arrival (488,904) to the west pits runs up a one-tile shaft and through a one-tile loop. Four live chasers stand IN
it at spawn: `puncher@128,624` (the only shaft north), `bob@192,480`, one of `bob@208,448`/`bob@224,496` (the loop's two
arms), and one of `bob@352,448`/`bob@352,416` (beside the pit). The smallest removal set that admits a corridor has
**size 4**; the chooser (size 1) and CPAIR (size 3, its 4 nearest partners all west of the pit) answer EMPTY, so BAIT
and KILL get no target.

| question | answer (measured) |
|---|---|
| Is a hitless route real in the game's terms? | **Yes.** With `CHOOSER_CUT` ON both legs are played on the game page (`seedling_bot_ap_p4g`, `--solver-env`): **done, 0 room hits, 0 divergences** (387: 1034 t, 388: 1156 t), at two arrival seams each |
| Why does the chooser name no kill target? | It asks only single removals, C1's hit sources (never a chaser) and CPAIR's sets up to 3. The cut needs 4 (`bob@192,480` + `bob@224,496` + `puncher@128,624` + `bob@352,448`) |
| Why does bait find no removal that admits a corridor? | Bait reads the same chooser list (`removable[0]`), which is empty. Named the body (ON), bait still refuses on its own terms: *no stance within the bob's leash pulls its line through a kill region* (no pit or water in reach); KILL's chaser arm then kills it from (200,488) |
| A timing window? | **None.** All six cluster bodies stand still for 600 idle ticks (they move only inside their 80 px aggro); the corridor opens only by removal |
| The detour's 3480 units/pass? | A provable no-answer: the via set plans a leg to every lattice cell (3479 on L40) and the search loop previews only while fewer than 500 are planned, so it never previews one. `DETOUR_VIA_BOUND` refuses that case up front, same verdict |
| Before → after (page budget 640, node, the page's captured requests) | 387/388: **DEADLINE → SOLVED hitless** at 482 / 525 work units (OFF 642, then 2562 on the retry) |
| ON radius (70 captured L40 requests) | `CHOOSER_CUT`: only 387/388 move (4 requests); the other 66 answer OFF's plan and work byte for byte. `DETOUR_VIA_BOUND`: only 387/388 move (deadline → the named EXHAUSTED refusal at 96 units) |

## 3. W0 — reproduce and map

- **Page** (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g
  --capture-requests`, main's defaults, `w0/page-sweep.tsv`): 387 and 388 fail *"ran out of 640, then 2560 work units …
  at the `walk` site … reach-pit (23,28)/(24,28)->L43"*, as the census measured.
- **Node, uncapped** (`tools/chain.mjs`, the census's instrument, cap 40960, `w0/chain-d0.jsonl`): both REFUSE by name at
  **3527 units a pass** (7054): `u1 brave iceturret@472,400`, `u25 time/bait/kill bob@192,480`, `u47 narrow`, `u3527
  detour`, forced-hit. By site: walk 94, detour 6960. The census's numbers, byte for byte.
- **The map** (`tools/map.mjs`, `w0/map-388.txt`, `w0/map-387.txt`): the planner's walkable lattice at the arrival with
  the 17 danger volumes overlaid, and every removal set of the six nearby chasers asked with the chooser's own question
  (`plansReach` with the set's volumes removed, the walk's `brave` contact for the turret held).

```
 416  #########....#####k...###pp,##.      tiles x 4..34 (one char = 16 px), y on the left
 432  #########.##.......##...#,,,##.      i = bob@192,480   l = bob@208,448   m = bob@224,496
 448  #########l##.#####j#*.###...##.      j = bob@352,448   k = bob@352,416   n = puncher@128,624
 464  #########.##.#####....###...##.      * = the pit (24,28)   @ = the arrival (488,904), lower down
 480  ####....i.##.############.#.#..
 496  ####.####.m..############...#..
 ...
 624  ####n...########.#########.####
 672  ####...........................
```

  size 1, 2, 3: none admits. **Size 4**: `bob@192,480` + (`bob@352,448` | `bob@352,416`) + (`bob@208,448` |
  `bob@224,496`) + `puncher@128,624` — four sets, every one with the puncher and `bob@192,480`.
- ⚠ An instrument trap, for the next reader: with the ice turret's `brave` contact NOT held, nothing admits even with
  every chaser removed — the pit tile is inside `iceturret@472,400`'s 129 px range (`proximity-hazard`). The walk holds
  that contact (its first row is `brave`), so the climb's question is asked with it.

## 4. M — the designs weighed

| design | what it would do | measured / argued | verdict |
|---|---|---|---|
| **A cut of any size** (`chooseCutToRemove`) | every live chaser removed must admit; put each non-hit chaser back, furthest from the hit first, while the corridor survives; offer the irreducible rest if the hit's body is in it, the hit's body first | 388: cut `bob@192,480`+`bob@224,496`+`puncher@128,624`+`bob@352,448` (17 `plansReach` asks); KILL kills the bob; the walk removes 4 more bobs with its own strikes and passes the puncher unhit. SOLVED hitless 1156 t / 387 1034 t | **built** (`CHOOSER_CUT`) |
| CPAIR at size 4 (or wider `near`) | the same family as the shipped pair chooser | needs `near ≥ 5`: the needed pit-side bob is the 5th nearest the hit by 0.8 px (`puncher` 150.7 px, `bob@352,448` 151.5 px). 25 sets against the cut's 17 asks, and fragile to a single pixel | not built |
| A timing window | wait until the cluster leaves the corridor | the six bodies never move in 600 idle ticks (`m/idle-600.txt`): no window exists | rejected |
| A multi-body kill order | kill all four in one arm | not needed: the cut hands KILL the hit's body, and each re-climb asks again of the room the kill left (CPAIR's shape). Here one kill suffices, the walk's own strikes do the rest | not built |
| **The detour's no-answer bound** | refuse DETOUR before the via set when the room has ≥ `maxPlanned` cells | exact: in such a room the loop condition `planned < maxPlanned` is false before the first preview, so OFF always answers `wps: null` with 0 previews | **built** (`DETOUR_VIA_BOUND`, its own switch: it changes the work, so what the deadline cuts) |
| The cut only on the dashing pass (a measurement arm) | `dashMode !== 'none'` | loses 387/388 (the dashless pass deadlines first) and still re-plans 12 pit legs | rejected |
| **The cut defers to NARROW** | where NARROW (below KILL) is asked and its own probe is clean, no cut | without it, 13 already-solving pit legs were re-planned through a kill (e.g. 403: 527 → 727 t); with it, all 13 are OFF's plan and work byte for byte (the probe made once, NARROW reuses it) | **built** (part of `CHOOSER_CUT`) |

## 5. I — the switches, rows, mutants, radius

**`solverBot.CHOOSER_CUT`** (OFF; `SEEDLING_CHOOSER_CUT=1`, `withChooserCut`; instrument `CHOOSER_CUT_COUNTS`). In the
climb, after CPAIR, only where the list is still empty and NARROW would not answer: `chooseCutToRemove(aim, contacts,
allowTeleporter, hit)`. It sits in the chooser, so BAIT and KILL take its head through their existing gates
(`rungGate('bait')`, `rungGate('kill')`); no new kill arm, no new rung. Every set member carries `stepped: true,
viaCut`.

**`solverBot.DETOUR_VIA_BOUND`** (OFF; `SEEDLING_DETOUR_VIA_BOUND=1`, `withDetourViaBound`; instrument
`DETOUR_VIA_BOUND.counts.bounded`). In `deriveChaserDetour`, after its first deadline check: `cells = cols × rows − home`;
if `cells ≥ maxPlanned` return `{wps: null, previews: 0, planned: 0, bound: {name: 'DETOUR_RUNG', hit: ['maxPlanned'],
…, viaSet: cells}, why: '… (DETOUR_VIA_BOUND)'}`. `canCross` classifies it as OFF's row (a named bound).

Both names join `solverEnvChannel.SOLVER_ENV_NAMES`.

**`solverBot.js` lines touched** (at the head): the switch block after `resetChooserPairCounts` (~16485–16531);
`DETOUR_VIA_BOUND` after `DETOUR_RUNG` (~25120–25140); the bound in `deriveChaserDetour` (~25231–25256);
`chooseCutToRemove` after `choosePairToRemove` (~27580–27632); in the climb, `cutNarrowProbe` (~29058) and the cut call
(~29084–29105); and NARROW's probe reuse (~29847–29852, ON only: `cutNarrowProbe` is `null` OFF).

**Rows.**
- `hammerPitWest.test.js` (default tier, ~2 s): both switches OFF by default and their `with…`; `DETOUR_VIA_BOUND` ON at
  the L40 arrival (3479 cells, 0 legs planned, 0 certified, the bound's fields); ON in a room under the bound (swordless
  L14, `seedlingCanCross`'s `can` row) the DETOUR rung still answers the committed tape's keys.
- `hammerPitWest.train.test.js` (train tier, ~4 min): 388 OFF at 640 = the page's deadline; 388 and 387 ON SOLVED hitless
  inside 640 (1156 / 1034 t), the cut's head `bob@192,480`, size 4 with the puncher, and the plan replayed on a fresh run
  row by row (⚖ 30(c): 0 divergences, 0 hits, 0 deaths, the run in L43); 388 DVB ON (deadline lifted): OFF's EXHAUSTED
  refusal by name, bounded once per pass, < 200 units; both ON = the cut alone; 367 (CPAIR's triple): cut never asked, ON
  = OFF; 403: the cut defers, ON = OFF in plan and work; the L16 guard (`r9-solve-16` re-derived with both ON).
- Fixtures `fixtures/hammer-pit-west/leg{387,388,403}-l40-l43-request.json.gz` (~11 KB each, the atlas records cut to
  L40 + L43). The cut answers byte-identically to the uncut capture: 388 OFF `dfcdadd4fbe7` (7054 u), 388 ON
  `6b7d8619ac44`, 387 ON `4a938a65a90e`, 403 OFF `f8b1bc540538` (191 u) on both (`i/chain-arms.tsv`).
- The L40 G1 and SF witnesses (`plan-seedling-hammer-g1-ghostkill`, `…-sf-strikefloor`) pin `CHOOSER_CUT` OFF beside
  their `CHOOSER_PAIR` pin: with the env ON they drifted (the cut answered the climb CPAIR is pinned out of and moved the
  refusal from `bob@736,752` to `bobsoldier@880,832`, census wall A2). A no-op at the defaults.

**Mutants** (`i/mutants.txt`; each a scratch edit, the train and fast files run against it):

| mutant | result |
|---|---|
| M1 the cut asked even where CPAIR answers | **killed** (367 row) |
| M2 the hit's body may be put back too | survives — equivalent here: the hit's body is nearest the hit, so "furthest first" puts it back last anyway |
| M3 no put-back (the cut = every live chaser) | **killed** (388 row: set size) |
| M4 the hit's body last | **killed** (387, 388 rows) |
| M5 no "the hit's body is in the cut" check | survives — equivalent on these states (the hit's body is in every admitting set) |
| M6 DVB never bounds | **killed** (388 DVB row) |
| M7 DVB bounds every room | **killed** (the L14 row, added for it) |
| M8 no deferral to NARROW | **killed** (403 row) |

**The ON radius by mover class** (node, every captured request of the 64-leg L40 page sweep at main's defaults, 70
requests, each solved as the page asks it: its passes, its captured budget; `i/radius-*.tsv`):

| arm | identical to OFF | DEADLINE → SOLVED | SOLVED → SOLVED (re-planned) | REFUSED/DEADLINE → other refusal | SOLVED → refused |
|---|---|---|---|---|---|
| `CHOOSER_CUT` (final) | 66 | **4** (387/0, 387/1, 388/0, 388/1) | 0 | 0 | 0 |
| `DETOUR_VIA_BOUND` | 66 | 0 | 0 | 4 (the same four: deadline → EXHAUSTED by name, 96 u) | 0 |

How the `CHOOSER_CUT` row was measured: the whole 70 under the cut before the NARROW deferral (`i/radius-cut-nodefer.tsv`:
55 identical, the cut never asked on them; 15 moved), then the final code on those 15 (`i/radius-cut-final-movers.tsv`:
the 13 pit legs back to OFF's plan and work, 387/388 SOLVED). The deferral only removes asks, and NARROW reuses the probe,
so the 55 are unchanged by construction; they were not re-run at the head. Not measured here: any level but L40 (the
planner's sweep / survey A/B).

## 6. D — gates

| gate | result |
|---|---|
| bounded vitest by path | `hammerPitWest.test.js` 3/3, `solverEnvChannel.test.js` + `strategySwitch.test.js` 33/33, `scripts/procgen/seedlingSolverSurface.test.js` 36/36 |
| hammer `.slow` (serial, local, at the defaults) | `hammerBk2Combat`, `hammerDashShape`, `hammerEscapeExact`, `hammerEscapeGenerated`: 4 files, 8 tests, green |
| train files run locally | `hammerPitWest.train.test.js` 8/8 (the final code); `hammerChooserPair.train.test.js` 6/6 (the defaults) |
| `ci-producer-checks --jobs=4` | defaults: 97 run, **0 red** (final tree); both switches ON: 97 run, **0 red** (final tree; an earlier ON run had 2 reds, the G1/SF witnesses, fixed by pinning `CHOOSER_CUT` OFF in them) |
| identity block (`identity-block.sh .`) | exit 0; every producer `--check` exit 0; the generated set OK; all 7 generated modules and 5 markdown regions match |
| `census-seedling-solver-surface --check` | green after `--write` (site counts only; no new row to classify) |
| `census-seedling-constants --check` | PASS (0 new, 0 vanished, 0 moved) |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED |
| `generate-docs-index.mjs --check` | OK (current) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` headless | ALL PASS |
| JSUT (CI) | last complete run: `c5952db7`, run **42125446510**, success — suite 25665 passed / 0 failed, **slow battery 414/414**. That run predates the NARROW deferral (`eff83928`) and its row; the head's run (42134874671, at `59105be2`) was still queued when this report was written: read it with `node scripts/procgen/ci-summary.mjs --run=42134874671` |

The first CI run (`0d82700d`, run 42115880653) was red on 3 rows of `seedlingSolverSurface.test.js`: the surface JSON
was written one commit later (`6f1f06f0`). Green locally at every later head.

## 7. What the harvest A/B should expect, and the ON dispatch

- **OFF: no movers.** Every OFF answer is byte-identical: no code path runs with both switches OFF except two `if` reads
  and NARROW's `cutNarrowProbe === null` test.
- **ON sweep** (the divergence sweep's page half; L40 first, then the full set for the radius outside L40):
  `keys`/`ids`: the 64 L40 legs (`level === 40 || target_level === 40`, the census's `w0/l40ids.txt`), then all;
  `solver_env`: `SEEDLING_CHOOSER_CUT=1;SEEDLING_DETOUR_VIA_BOUND=1` (and each alone, to attribute). Expect on L40:
  **387 and 388 failed → done, 0 room hits** (measured here on the page at two seams each); every other L40 leg
  unchanged. Outside L40: unmeasured. The cut asks only where the chooser, C1 and CPAIR are all empty and NARROW would
  not answer; the bound acts only in rooms of ≥ 500 lattice cells.

## 8. What the brief got wrong (measured)

- *"`CHOOSER_HIT_SOURCES` exists (OFF)"*: it is **ON** at main (`mode: 'empty'`, since C1-ON). It never takes a chaser,
  so it does not answer this wall either way.
- *"the detour … also burns 3480 u/pass on 871"*: at the defaults 871 never reaches DETOUR (it refuses at 182 units a
  pass on the button room's stance). Only with the tree banked (`--persist=40:0`, the census's what-if) does the hold
  walk climb to DETOUR: 3618 units a pass, 7236 in all → **278** under `DETOUR_VIA_BOUND` (the same refusal head).
- *"387/388 … fail on the page by the deadline at `walk`"*: true; the deadline trips at DETOUR on the dashless pass and
  at `walk` on the full one (the page's `passes` field).
- The page's L40 sweep at this head: 51 done, 13 failed (the census's 11 plus 371 and 377, both on the r0c53 north-west
  arrivals: 371 a wall-time timeout at one seam, 377 a bomb at another — the census's §5.5 family, not this wall).

## 9. Residue and hand-overs

- **The puncher pass.** On both ON walks the player passes `puncher@128,624` at 0.6 px (centre to centre) unhit in the
  model, and the game agrees (0 room hits on the page). Fidelity owns the puncher's model; nothing to do unless a seam
  moves it.
- **377** (r0c53 ← L42 → flag 1): ON timed out at seam 5314 with one divergence and one hit; OFF it fails at another
  seam on a bomb. Not this wall: the cut is not asked on it in node (identical to OFF). The census's H family; for the
  planner.
- **Equivalent mutants M2 and M5**: they guard climbs where the hit's body has an alternative. No L40 request has one;
  a row would need such a room.
- **Not measured**: the ON radius outside L40; the train tier other than this slice's file (the planner dispatches it).
- **The L40 census report and its evidence** were checked out from the census branch for reading only and are not
  committed here (removed from the tree by name).
- **Tooling**: commits under my own sweep's box lock used `BOX_LOCK_COMMIT_ANYWAY=1` (the lock named this session's
  probe). The scratch worktree for the mutants was removed by name.

## 10. Evidence (`seedling-hammer-pit-west-evidence/`)

- `w0/`: `page-sweep.tsv` (387/388/871 on the page), `page-sweep-l40-64-off.tsv` (all 64 L40 legs, the defaults),
  `chain-d0.jsonl` (the uncapped replays), `map-387.txt`, `map-388.txt`.
- `m/idle-600.txt`: the cluster's positions over 600 idle ticks.
- `i/`: `chain-arms.tsv` (every node arm: work, digest, the 30(c) check), `mutants.txt`, `page-on-witness.tsv` (the game
  page with the switches ON), `walk-fate.txt` (which bodies the ON walks remove, and when), `radius-*.tsv`.
- `tools/`: `chain.mjs` (the census's, copied), `map.mjs`, `radius.mjs`, `idle.mjs`, `walkfate.mjs`, `cut.mjs` (the
  fixture cutter). The captured requests (37 MB) are not committed; re-capture with the census README's command and
  `--ids=$(cat ../seedling-hammer-l40-census-evidence/w0/l40ids.txt)` (that file is on the census branch).
