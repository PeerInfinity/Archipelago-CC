# Seedling HAMMER-PHASE — slice C4b: the chooser lists the probe's other hitter (measure-first)

Slice `seedling-hammer-c4b` (Opus, cloud), planner `seedling-hammer-phase-planning`. **Measure only: no code changed,
no switch added. STOP after D1:** no refused leg moves, and the one leg that moves (624, lapse ON) gets slower.

| | |
|---|---|
| Start SHA | **`926cc2a86f`** (`926cc2a86f190435fdf27f167767a1a57db648b5` = `origin/main` at the fetch, the wave-14 flip) |
| Head | the commit carrying this report (D1 evidence `5730632`, D4 records `9f58be4`) |
| Branch | `claude/seedling-hammer-c4b-350els` (the harness names it; the brief's `seedling-hammer-c4b`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9580` (`SEEDLING_PORT=9580`), PID 645, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS (STOP: no mover to a better verdict) · D2 not run · D3 not run · D4 PASS** |

## The one thing to know first

**The tweak buys nothing, and on the one leg where it acts it costs.** At this base with the lapse ON, 624 solves by
DETOUR in **331 t**, the plan fidelity witnessed on the game; this slice's base plan is that tape, byte for byte bar the
name. Either way of listing the other hitter hands the kill rung `lavarunner@208,96` at t0, ahead of DETOUR. Both
answers are hitless and slower: **481 t** with the brief's rule and **752 t** with C4's verbatim `C4_APPEND`. Every
leg the sweeps refuse refuses with the same bytes in every arm.

Second thing: **C4's `C4_APPEND` also appends to an EMPTY list**, which is C1's trap. It admits a chaser from the hit
where the chooser listed nobody: on 624 at t106 (`bulb@48,112`), and on `r9-solve-16` with the lapse OFF, which moves
688 → 687 t. A shipped version would have to require a head, which is what the `probe` arm does.

## W0 — the base and the reproduction (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-c4b-350els origin/main` | `926cc2a86f` (≥ the brief's floor; = `origin/main`) |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five non-wasm submodules were `-` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine); `git submodule update --init` on each |
| identity block | `SEEDLING_PORT=9580 bash scripts/procgen/identity-block.sh .` | non-`#` md5 **`77080c2ed34820619273d5d9d6fcdaa9`**, which is fidelity L74LEG624's base and OFF head row for row: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK, reference ALL 7 + 5 MATCH (`…-evidence/census/identity-base.txt`). The wave-14 flip moved no identity row |
| six `--check`s | the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, all exit 0 |
| tapeRunner pairs | in the bounded run; `status\tfullName` sorted, md5 | **611**, `86af85259c2ab3a51b1f0ebb409743f4` |
| surface / constants / entities / profile | each `--check` | GREEN **284** · PASS **5,841** · PASS 558 · PASS 138 (both JSONs) (`census/censuses-w0.txt`) |
| roster | `fixtures/tapes/index.json` `.tapes` | **277** |
| bounded vitest BEFORE | 18 files: every non-slow test naming `chooseBodyToRemove`, `CHOOSER_HIT_SOURCES`, `hitSourceBodies`, `withChooserHitSources`, `interceptOrder` or `KILL_ARM_POLICY` (`rg -a -l`), `solverBot*.test.js`, plus `tapeRunner` (`census/vitest-files.txt`) | **1,369 / 1,369** |

**Leg 624 in node.** The driver is fidelity's `drivers/leg.mjs` (C4's/LEASH's arrival path, `ANYTIME_PASSES`,
`BUDGET=2560`), with the sweep row's own `items`/`slots` from sweep 38307493688 (`…-evidence/drivers/leg.mjs`):
- **Lapse OFF: REFUSED**, both passes: *"reach-exit (16,144)->L75: the danger map forbids (222.70589296504838,
  120.1793485888045) — chaser:lavarunner@208,96 (inside leash 80 (d=9.5), box grown 1.5 px/tick x 0 + pad 0). Slice 2
  has NO DODGE POLICY …"*. This is the refusal text page sweep 38307493688 gives for 624, not C4's *"combat ladder is
  EXHAUSTED"*: the wave-14 defaults (`forecastSpeedByTerrain`, `fallRockPostFall`) moved it.
- **Lapse ON (`SEEDLING_STRIKE_IFRAME_LAPSE=1`): DONE 331 t, `dashMode all`, verbs `[detour]`**, the dashless pass
  refused and the full pass solved; it ends in L75 at (72,24), 0 deaths. Written as a tape
  (`c4b-624-on-none.json`), it equals fidelity's game-witnessed `tape-l74-624-on-plan.json` in every field but
  `name`. Model replay: `playerHits []`, `playerDeaths []`.

## D1 — the census (PASS; STOP)

### The lab

The lab is a scratch copy of `frontend/modules`, wasm excluded (`drivers/lab-instrumentation.diff`). It adds one block
after the C1 block in the climb, which:
- records every climb (`__C4B` sink): the chooser's list; the head's admitted corridor, planned and probed with the
  walk's own instrument (`probeCorridor`, the head excepted); the list after the arm; and the kill rung's
  `interceptOrder` head;
- `C4B_MODE=append`: C4's `C4_APPEND`, verbatim (every chaser in `hit.sources` not already listed is appended, an
  empty list included);
- `C4B_MODE=probe`: the brief's rule. Only when the chooser lists a head, append the chasers that the head's probed
  corridor names.

**Inert when off:** with no mode, 624 is byte-identical to the tree under both lapse settings (`solutionMd5`
`5b6de60a` ON; the same refusal OFF), and the whole r9 chain is `712f0ead` exit 0.

### 1. Where it fires

Legs: sweep 38307493688 (lapse OFF, at the flip's measurement branch) refuses **624** and **628**; sweep 38289124638
(lapse ON, fidelity's branch) refuses **628**. Those two sweeps carry only the five L74 keys, so the census runs all
five (`node-runs.json`, every climb recorded; two climbs per fire are the two anytime passes):

| leg | lapse | fires | head (admitted) | other hitter (probe of the head's corridor) |
|---|---|---|---|---|
| 622 | OFF / ON | no | — | — |
| 624 | OFF | **yes**, t0 | `bulb@48,112` | `chaser:lavarunner@208,96`, (232.2,119.6), eta 87 |
| 624 | ON | **yes**, t0 | `bulb@48,112` | `chaser:lavarunner@208,96`, (231.9,120.3), eta 87 |
| 626 | OFF / ON | no | — | — |
| 628 | OFF | **yes**, t0 | `bulb@48,112` | `chaser:lavarunner@208,96` |
| 628 | ON | no | — | — |
| 629 | OFF | **yes** | `bulb@48,112` | `chaser:lavarunner@24,56` |
| 629 | ON | no | — | — |

### 2. What the arms change (lab ON vs OFF)

| leg | lapse | none | `append` | `probe` |
|---|---|---|---|---|
| 622 | OFF / ON | forced-hit 4 t | = (md5 `0191cbb1`) | = |
| 624 | OFF | REFUSED (above) | **= byte-identical message** | = |
| 624 | **ON** | **DONE 331 t `detour`** | DONE **752 t** `kill, walk` | DONE **481 t** `detour, kill` |
| 626 | OFF | DONE 344 t `detour` | = | = |
| 626 | ON | DONE 284 t `kill, walk` | = | = |
| 628 | OFF | REFUSED: skirt lane x = 302 (*"no x-input sequence … EXACTLY onto x=302"*) | = byte-identical | = |
| 628 | ON | REFUSED: skirt-stance waypoint 2 (72,72) stall at (24,109.75) | = | = |
| 629 | OFF | DONE 253 t `bait, kill, walk` | = (BAIT reads the head and solves first) | = |
| 629 | ON | DONE 252 t | = | = |

The location legs (626/629) mount the sweep's delivered set (`mountedRecordsOf`, as the bare pass does), because the
atlas has no `apitem` entity. The exit legs boot the atlas, as fidelity and C4 did.

**624, lapse ON, climb by climb** (`node-runs.json` → `m-624-L1-*`):
- At t0, both arms list `[bulb@48,112, lavarunner@208,96]`. BAIT reads the bulb, BAIT refuses, and `interceptOrder`
  hands the kill rung **`lavarunner@208,96`**. The chaser arm finds a stance (the lapse is what admits it, as fidelity
  measured) and kills it.
- At t106 the chooser's list is **empty** (the hit is `chaser:bulb@48,112`). `probe` leaves it empty (no head) and
  DETOUR solves, 481 t in all. `append` admits the bulb from the hit (C1's trap shape), the kill rung goes after it,
  and the run takes 752 t.
- **Does the append reach the kill rung before DETOUR? Yes. Is it faster? No:** 331 → 481 / 752 t.

**Hits.** All three 624 lapse-ON plans, replayed in the model as tapes (`c4b-624-on-{none,append,probe}.json`,
`drivers/replay.mjs`): `playerHits []`, `playerDeaths []`, arriving in L75 at (72,24) at t331 / t752 / t481. Every
other cell of the table has the same plan md5 (or the same refusal bytes) in all three arms. ⚠ The `hits=0` field in
`census/matrix-summary.txt` reads a key the plan does not carry. The replays above are the hit measurement.

### 3. The controls (lab ON, `solve-seedling-r9-campaign --check` in a scratch worktree of the head)

| arm | lapse OFF | lapse ON |
|---|---|---|
| none (the lab, no mode) | `712f0ead` exit 0 (= the tree) | `dce96321` exit 1 (fidelity's lapse-ON value: `r9-solve-14` 98 → 103, `-16` 688 → 655, the lapse's own movers) |
| `probe` | **`712f0ead` exit 0**: `r9-solve-16` 688 t and `r8-solve-6` 294 t byte-identical | **`dce96321`** = lapse-ON base |
| `append` | **`f5d87420` exit 1**: `r9-solve-16` **688 → 687 t** (0 hits, calm; tape and trace drift), `r9-solve-18`'s `seam.time` oracle follows (9940 vs 9939). `r8-solve-6` passes byte-identical | `dce96321` = lapse-ON base (empty diff) |

`r8-solve-6` holds in every arm. C4's `order` caveat is untouched here: neither arm uses `order`. `append`'s
`r9-solve-16` mover is C1's measured trap again, a chaser admitted where the chooser's list is empty.

### The STOP

The brief: *"STOP after D1 if no leg moves to a better verdict (refused → solved, or fewer hits) … A tweak that changes
only which rung solves an already-solved leg is not worth a switch unless it is shorter."*
- No refused leg (624 OFF, 628 OFF/ON) moves, in either arm.
- The only mover is 624 with the lapse ON. It is already solved (331 t, 0 hits, game-witnessed); the arms change the
  rung to KILL, at **481 / 752 t**, longer, with the same 0 hits.

So: no switch, no code, records only.

## D2 / D3 — not run (STOP)

No mover qualifies, so there is no switch to ship OFF, no ON plan to witness on the game, and no ON census. D1.3's
controls stand in for D3's r9 rows. The identity block, ENEMY census and L18 sweep were not re-run ON, because nothing
ships.

**CI for the planner** (dispatch from the cloud returns 403). Optional: it would confirm, on the page, that the head
reproduces the sweeps' verdicts.
- `seedling-divergence-sweep.yml` on `claude/seedling-hammer-c4b-350els`, `mode=inv`, `producer=solver`, `shards=1`.
- `keys=level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144|level_74 <- in_L75_64_0 -> exit:out_teleporter_288_144|level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0|level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield|level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield`.
- Run it once with `contact_fidelity` empty, and once with `contact_fidelity=strikeIframeLapse` added to the defaults.
- Expect 38307493688's and 38289124638's verdicts: no code changed.

## D4 — records (PASS)

- `seedling-bot-log.md` § *Seedling hammer-phase C4b — the chooser's other hitter* (after G1's): the census table,
  the controls, two trap candidates.
- `seedling-bot.md`: **no paragraph** (no switch ships).
- Surface `--check` GREEN 284, constants `--check` PASS 5,841: no code, no literal, no `--write`.
- `generate-procgen-reference.mjs` regenerated (README count line, docs index), then `--check`: ALL 7 + 5 MATCH.
  `scripts/quicklaunch/generate-docs-index.mjs`: `frontend/modules/procgenDocs/generated/docsIndex.js` rewritten (the
  log's word count). `check-procgen-docs.mjs`: ALL CHECKS PASSED.
- **Bounded vitest AFTER**: W0's 18, plus `boxLock`, `seedlingConstantsCensus`, `procgenDocs/{generated,docLinks,
  docsRender}`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface` and `checkProcgenHelp` (27 files):
  **1,643 / 1,643**. tapeRunner 611, `86af8525` (= BEFORE). No row added, so no full-solve timeout was needed.
- Identity AFTER: the range touches only docs and the generated docs index. The reference `--check` MATCHes, and no
  other row can move.

## Deltas (base → head)

- **Code: none.**
- Docs: the log section, the regenerated `docs/json/developer/procgen/README.md` count line and `docsIndex.js`.
- New: `CC/docs/cloud-reports/seedling-hammer-c4b-evidence/`:
  - `node-runs.json`: 30 node runs, every climb;
  - the three 624 lapse-ON tapes;
  - `census/`: the identity base, W0 censuses, the matrix summary, the r9 control md5s and their two diffs, and the
    vitest summaries;
  - `drivers/`: the lab diff, the leg/lab drivers, the matrix and control scripts, all scratch.
- Identity, tapeRunner, surface, constants, entities, profile and roster: all = W0.

## What the brief got wrong (measured)

1. *"Use the sweep's refusal list (sweep 38307493688 and 38289124638)"*: those sweeps carry five keys, the L74 legs
   only. Their refusals are 624 + 628 (OFF) and 628 (ON). A wider census needs a full sweep's list (the planner's).
2. *"Reproduce leg 624 … lapse OFF (the refusal, by name)"*: at this base the name is not C4's *"combat ladder is
   EXHAUSTED"*. It is the page's *"the danger map forbids (222.7,120.2) — chaser:lavarunner@208,96 … NO DODGE POLICY"*,
   moved by the wave-14 defaults.
3. *"Port C4's `C4_APPEND`"*: as written it appends to an empty list too, so it is not the brief's rule (*"after the
   admitted one"*). It re-opens C1's trap (`r9-solve-16` 688 → 687 with the lapse OFF). The brief's rule needs a head;
   the `probe` arm is that rule, and it is inert on the r9 chain.
4. *"Fidelity … BAIT keeps the head, `interceptOrder` puts the hit's chaser first for the kill"*: true, and that is
   the cost. On a leg that DETOUR already solves, the kill rung now runs first and takes longer.
5. *"`git checkout -B seedling-hammer-c4b`"*: the harness's branch is `claude/seedling-hammer-c4b-350els`.
6. The bootstrap's `READY` again left five non-wasm submodules uninitialised (C3's, C4's and fidelity's finding).

## Residue

1. **The chooser's static/moving gap stays named, not fixed** (C4's trap candidate): the bulb is listed on 624/628/629
   while its admitted corridor is still hit. The measurement says the fix is not worth shipping: where it acts, DETOUR
   (or BAIT) already does better.
2. **`C4_APPEND` should not be revived as written:** it is C1's empty-list trap. If the question ever returns (a leg
   that only the kill rung can solve), start from the `probe` arm in `drivers/lab-instrumentation.diff`.
3. **628 refuses on the skirt stance, in every arm and under either lapse setting:** a walk/stance question, not the
   chooser's. Fidelity also noted that its goal lies under the fallen rock on a real playthrough.
4. **Dashless pass on 624 (lapse ON) still refuses** (fidelity residue 4); the anytime answer routes around it.

Scratch, not committed: the lab copy, the scratch worktree (removed), the per-run logs and the vitest JSONs
(`/tmp/claude-0/c4b/`). CI at the head: owed (`node scripts/procgen/ci-vitest-summary.mjs <head>`); the suite number is
CI's (⚖ 52).
