# Concept library F1b: the roaming enemy meets the route, a through-room (cloud report)

`concept-library-f1b` is a cloud fan-out build of plan `concept-library-plan.md` §9. It implements the user's ruling of 2026-09-29: the roam blob becomes a THROUGH-ROOM, with the corridor passing through it and both mouths open. This file is the report the coordinator reviews. The as-built record is § *Concept library F1b — the through-room* in `docs/json/developer/procgen/seedling-bot-log.md`.

- **Started from:** `cdbf8fe9` (`origin/main`), the SHA the brief expected.
- **Branch:** `claude/roam-through-room-lnkcar`. The brief named `concept-library-f1b`, but the cloud harness only allows pushes to its designated branch.
- **Head:** the commit that adds this file, directly after `e296b399`.
- **Commits, one per D:**

  | D | commit | what |
  |---|---|---|
  | D1 | `f94ec04c` | `through` on `defineElement`; `roam` declares it |
  | D2 | `7768ec8b` | the composite: both mouths opened and joined, the cut, four refusals; F1's level pins re-pinned |
  | D3 | — | measurement only (the tables below); no code |
  | D4 | `f2eb2daa` | the wasm witness asserts `through`; three new subjects |
  | D5 | — | measurement only (the pipeline room below); its re-pinned row rides D2 |
  | D6 | `e296b399` | bot log, architecture, both generators |
  | — | this commit | the report |

**Verdict: PASS on D1, D2, D4, D6. D3 and D5 are measured and published.** Both moved the numbers the brief predicted they would move, but far further than it expected. Read [§ The one thing](#the-one-thing-read-this-first) first.

## The one thing (read this first)

**The through-room makes the bodies matter, and it costs about 90% of the yield.**

- **Placements:** 96 → **10** of 168 per palette.
- **Post-sword:** 7 of the 8 certified levels COST the walk. F1 had 1 of 94.
- **Pre-sword:** all 8 certified levels are still INERT. The walk crosses the blob on the line between its two mouths, and the bodies stand off that line.
- **Why the yield falls:** most rooms join the start and the goal round the outside of any blob. A through-room there is not a cut, so it is refused by name (`the-through-room-is-not-on-the-route`: 123 of 158 geometry refusals per palette).
- **The pipeline room** (an open 10x10) never holds one: 0 of 300 drawn seeds, where F1 had 209 pre-sword and 201 post-sword.

The ruling is built as written, and the number is what it is. Whether it is the right trade is a question for the user. Two levers could buy yield back without faking a cut, and neither is this slice's: letting the binding *choose* the pair whose blob is a cut, and a geometry that walls a bypass. See [§ Residue](#residue).

## W0: F1's rows reproduced

- **The identity block** (`SEEDLING_PORT=8730 bash scripts/procgen/identity-block.sh .`) matches F1's table row for row. ⚠ It ran while D1's edit (a field that nothing read yet) was landing in the tree. Its values equal F1's published BEFORE, so the timing moved nothing.
- **The yield sweep** was run at a pristine worktree at `cdbf8fe9`. The first attempt from the main tree never started its two sweeps, so it was not used. Results:
  - pre-sword md5 `010b6a0b31ea0075765d7177ac314838`, post-sword md5 `263da284a0d9395770cf865857397473`;
  - the roaming block is exactly F1's: 96 placed, 94 certified and 2 × `the-solver-cannot-cross-the-roaming-body` on each palette; INERT 94 pre-sword, and INERT 92 / COSTS 1 / aborted 1 post-sword;
  - the geometry refusals are 42 / 17 / 13, as in F1.
- **Bounded vitest BEFORE** (the brief's five paths, at the base worktree): **18 files / 335 tests**.

## The identity block: BEFORE and AFTER (`e296b399`), row for row

`diff` of the two outputs is **identical on all 21 rows**:

| row | BEFORE = AFTER |
|---|---|
| maze byte-identity | `246dfbceff75c1cc27fdb347469a77d7` |
| acceptance batch | `4330bad70290dd18d94b11ca5b0bc5cb` |
| empty pairs c3 / c6 | `fa0dc4bb…` / `f5c9ece7…` |
| carved pairs c4 | `8c972028c1de2345e13264bd546ac90e` |
| ENEMY census default | `4ce6c5b3f44fbd9c26bb7a25d72bb647` |
| guard census (elements) | `a6d18d49ae256c321d175f45ec76dccc` |
| AREA census default | `06b14d5d57428ae7fcb248060a8d492e` |
| killgate s2 / s5 / s9 | `1b4eab8e…` / `b018ab2b…` / `65e81dd3…` |
| level pre-sword s1 / post-sword s1 | `e28c1e5d…` / `9219ff91…` |
| generated set | OK |
| r8-battery / d2-chain / l18 / tail / r9-l3 / r9-campaign `--check` | `410f27c0…` / `b470c14d…` / `17be7d70…` / `9a6a3192…` / `6cd35fe1…` / `2823a811…`, all exit 0 |
| reference `--check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE |

The through-room belongs to `roam` alone. No `chamber`, `arena`, `killgate` or level row moved, and the census default md5 is unchanged.

## Per D

### D1: the element declares it (`f94ec04c`)

- `defineElement` takes `through` (default `false`) and exposes it on the element and on every instantiation.
- `defineElement` refuses a non-boolean `through`, and a `through` on an `on-connector` element (such an element declares no port).
- `assertPlacementShape` requires a through placement to pair every entry BY INDEX with its own exit, on a different cell. It has to ask this itself, because `chooseEntryPort`'s fallback to `exits[0]` is right for a lane and wrong here.
- `roam.js` declares `through: true`. `chamber` and `arena` keep `false`.
- **The pairing, measured:** over every value combination × 12 seeds × all 4 candidate pairs (3,600 pairs), the exit paired BY INDEX is the entry's OPPOSITE side at its mirror across the site. That follows from `openChamberMouths` listing the entries and their mirrors in one order.

**Gates:**
- `elements.test` gained 3 rows: the default, the refusals, and the pairing check.
- `roam.test` gained 2 rows (the flag, and the measured pairing); it is now 14/14.
- The no-fork row still holds.
- Bounded run: 9 files / 171.

### D2: the binding opens and joins both mouths (`7768ec8b`)

`compositeSeedlingElement({..., through})` reads the element's declared flag (`procgenSeedling` passes `elementPlan.concrete.through`). For a through element:

1. A pair is usable only when **neither** mouth is on the border ring. A sealed element asks about the entry alone, exactly as before.
2. The ring is wall except **both** mouths.
3. The entry mouth joins the START's side, and the exit mouth joins the GOAL's side. Both use the one shortest-tunnel rule (never the reserved rectangle, never the border ring), refactored into `tunnelTo` without changing its order. Both sides are flooded over the room with the blob's cells walled.
4. **The cut:** with the blob's cells walled, the goal must be unreachable from the start. This is asked before the tunnels (the outside already joins them) and again after them (a tunnel crossed the other side). Both cases refuse as `the-through-room-is-not-on-the-route`, with different details.
5. **NO-SHORTCUT:** the dead-end check is kept, and for a through-room it refuses under a **new** name, `the-through-room-shortens-the-way`. The comparison is the same (the whole composite against the skeleton's distance). But the dead-end name's text speaks of one tunnel to one mouth, and a census has to tell the two apart: F1's 17 were dead-end tunnels.

**The record and the rest:**
- The four new names are in `SEEDLING_ELEMENT_REFUSALS`: `the-exit-mouth-is-the-rooms-border-ring`, `the-exit-port-cannot-be-joined`, `the-through-room-is-not-on-the-route` and `the-through-room-shortens-the-way`. `refusalCensus` is green, and the generated refusal table was regenerated.
- The record carries `through`, `exitMouth` and `exitTunnel` **on through-rooms only** (a conditional spread, so no guard/chamber/arena payload moves).
- `elementSummaryOf` carries them the same way.
- Pass 2 may not touch the exit tunnel.
- The composite ledger sentence says "the route runs THROUGH the blob" instead of "the exit mouth was SEALED", and it gains an `exit-tunnel` paintable.

**Gates** (7 hand-built composite rows in `procgenRoam.test.js`):
- both mouths are floor, the entry tunnel is `[(6,1)]` and the exit tunnel `[(6,7)]`, and exactly two ring cells are ground;
- **the cut holds** (an independent flood from the start never reaches the goal);
- the outside already joins them → refused;
- a tunnel joins round the blob → refused;
- the exit mouth is on the border ring → refused, while the same room sealed is not;
- a U-shaped skeleton, 17 steps → through 9 → `the-through-room-shortens-the-way`;
- **a sealed element at the same site still seals:** it refuses F1's `the-reserved-rectangle-seals-the-room`, the exact refusal a through-room turns into a placement. On an open room it places with its exit mouth WALL and no exit keys.

**F1's level pins were re-pinned.** They were dead-end subjects: `empty` s2 now refuses `the-exit-mouth-is-the-rooms-border-ring`, and the default skeleton places a through-room at none of seeds 1–60. The new pins, all measured:
- `rooms` 10x10 s10: places; INERT 117/117 pre-sword; COSTS **127 vs 69** post-sword. It also covers the textless-goal row and the kill-lock-clause row.
- `winding` 14x14 s12: `the-solver-cannot-cross-the-roaming-body` on both boots.
- the pipeline room (below).

The unit rows are 22/22.

**Mutant (a): both cut checks removed.** One build, copy and restore, `cmp` identical after. ⚠ The first attempt restored the file two cells in, but the sweep runs each cell in a child process, so most cells read the restored file. That run was discarded, and the second held the mutant for the whole sweep.

| | predicted | measured |
|---|---|---|
| unit rows | the two refusal rows red; "the cut holds" row green (its room is a real cut either way) | exactly those 2 red, 20 green |
| pre-sword yield | PLACED about 85–95, and INERT at least 80% of certified | PLACED **72**, certified 70, **INERT 70/70**. The INERT-heavy yield returns. PLACED came in below the prediction because the second join and clause (vi) refuse more (56 entry-join, 19 shortens, 14 exit border, 7 exit-join) |

⚠ The brief expected the "cut holds" row to go red. It cannot, because that row's room is a cut by construction. The rows that red are the two refusal rows, which is where the check lives.

### D3: the ablation says so (measured, no code)

The same command as F1 (`sweep-yield-table.mjs … --elements=roam --seeds=1-12 --count=3 --tries=4 --k=3 --anchortries=1`). The AFTER md5s are pre `6298796bbbcb707f021d26eac3f99b42` and post `58d15bef905cf64c262a64de312be360`.

| palette | cells | PLACED | CERTIFIED | named refusal | INERT | COSTS | NOT-EST. | aborted |
|---|---|---|---|---|---|---|---|---|
| F1 pre-sword | 168 | 96 | 94 | 2 × `the-solver-cannot-cross-the-roaming-body` | 94 | 0 | 0 | 0 |
| F1 post-sword | 168 | 96 | 94 | 2 × the same | 92 | 1 | 0 | 1 |
| **F1b pre-sword** | 168 | **10** | **8** | 2 × the same (`branchy`, `winding` 14x14 s12) | **8** | **0** | 0 | 0 |
| **F1b post-sword** | 168 | **10** | **8** | 2 × the same | **1** | **7** | 0 | 0 |

- **Geometry refusals** (158, identical on both palettes): 123 `the-through-room-is-not-on-the-route`, 14 `the-exit-mouth-is-the-rooms-border-ring`, 14 `the-entry-port-cannot-be-joined`, 4 `the-through-room-shortens-the-way`, 3 `the-exit-port-cannot-be-joined`.
- **Where it places:**
  - 10x10: `bushy`, `loopy`, `open` s10 (the same site), and `rooms` s10 and s12;
  - 14x14: `branchy` s12, `bushy` s1, `rooms` s1 and s10, `winding` s12;
  - `empty`: 0 of 24.
- **COSTS Δticks** (post-sword): 58 (`bushy`/`loopy`/`open`/`rooms` 10x10 s10), 73 (`bushy` 14x14 s1), 84 and 44 (`rooms` 14x14 s1 and s10). The one INERT is `rooms` 10x10 s12 (63/63).
- **The cut in the FINAL record** (scratch probe `probe-through.mjs`): every shipped level was re-flooded after pass 2 with its blob walled, and 10/10 per palette are still cuts. Pass 2 opened no bypass.

**Prediction vs measured** (written before the run):
- PLACED: predicted about 20–35, measured 10.
- Main refusal: predicted `the-through-room-is-not-on-the-route` as more than half of refusals; measured 78%.
- CERTIFIED/PLACED: predicted about 50–70%, measured 80%.
- INERT: predicted under 30% of certified. Post-sword it is 12.5%. Pre-sword it is **100%**, and that prediction was wrong.
- The solver refusal is the only certification refusal, as predicted.

### D4: the wasm witnesses (`f2eb2daa`)

The roaming branch of `check-seedling-wasm-element.mjs` now also asserts `through === true` and an `exitMouth` on the record. It needed that assertion, because without it a sealed roam would pass. The runs used `--host=http://localhost:8730 --areas=0`.

| subject | per tick | end state | failures |
|---|---|---|---|
| `roam` `rooms` 10x10 s10 **post-sword** (COSTS, 127 ticks) | **AGREES PER TICK (128 observations)** | Δx 0 Δy 0 | **0 FAILURE(S)** |
| `roam` `bushy` 14x14 s1 **post-sword** (COSTS, 229 ticks) | **AGREES PER TICK (230 observations)** | Δx 0 Δy 0 | **0 FAILURE(S)** |
| `roam` `rooms` 14x14 s10 **pre-sword** (477 ticks) | **AGREES PER TICK (489 observations)** | Δx 0 Δy 0 | **0 FAILURE(S)** |

The subjects cover two kinds and both boots, and the two post-sword ones are levels where the walk crosses the bodies at a cost. Each run also printed `PASS: ⛓ …and the blob is a THROUGH-ROOM — both mouths opened and joined`.

### D5: the pipeline room (measured; the row rides D2)

The probe was `generateGenRoom({params: {seedlingGen: {biome, elements: 'roam'}}})` at 10x10.

| drawn seeds | BEFORE (`cdbf8fe9`) | AFTER |
|---|---|---|
| 1–12 + 16807, pre-sword | 13/13 build; 8 hold bodies; re-rolls: 1 (drawn 6, doors) | 13/13 build; **0** hold bodies; 0 re-rolls |
| 1–12 + 16807, post-sword | the same as pre-sword | the same as pre-sword |
| 1–300, pre-sword | 300 build; 30 re-rolls; 209 hold bodies | 300 build; **0** re-rolls; **0** hold bodies |
| 1–300, post-sword | 291 build, 9 throw; 28 re-rolls; 201 hold bodies | 296 build, 4 throw; **0** re-rolls; **0** hold bodies |

- **Why no pipeline room holds one:** its open 10x10 always joins the start and the goal round the outside, so the element refuses and the room ships without it.
- **The re-rolls vanish** because they were the roam rooms' door re-rolls.
- **The throws are the named swim-T2 residue:** a pass-2 `pit-patch` whose certification dies in a pit (*"…has NO control block"*). They are reached on different levels, because the refused element changes the room. There are fewer of them than before (4 against 9), and none of them is new in kind.
- **D7's row is re-pinned:** drawn 16807 builds at re-roll 0, the element is refused, the torch is kept, and location 0 is on the goal cell.

This is the number, not a reason to widen anything.

### D6: records (`e296b399`)

- `seedling-bot-log.md` gained `### Concept library F1b — the through-room`.
- `architecture.md`'s `roam` entry now says it is a through-room.
- `generate-procgen-reference.mjs` and `generate-docs-index.mjs` were both run. `--check` reads ALL MATCH.
- The `procgenDocs` and `quickLaunch` suites are 15 files / 600. The link census still reads 319 links / 245 doc / 16 same-doc.

**Bounded vitest AFTER:**
- the brief's five paths: **18 files / 347** (BEFORE 18/335, plus 3 `elements.test`, 2 `roam.test` and 7 `procgenRoam` rows);
- the other touched suites (`refusalCensus`, `procgenRequireDirective`, `urlParams`, `procgenDoorElements`, `watchGenOverlay`, `seedlingGenRoom`, `argvHelp`): 10 files / 235.

No unfiltered vitest and no pytest were run. No solver, simulation, AS3, wasm, gitlink, `package.json` or T0b file was touched.

## What the brief got wrong (measured)

1. **"A through-room will be REFUSED more often… toward W0's half."** The refusal is not at certification. It is at geometry, and it is about 90%: most rooms offer a way round any blob. CERTIFIED/PLACED is 80%, above W0's half, because only 10 levels place at all.
2. **"INERT falls well below F1's 186/187."** That is true post-sword (1 of 8). Pre-sword it is 8 of 8, because the bodies sit off the line between the two mouths. A through-room guarantees that the route crosses the blob, but not that it crosses a body.
3. **"Mutant (a): the 'cut holds' row returns."** That row's room is a real cut, so it stays green. The two refusal rows are what go red.
4. **F1's pins were not portable.** The `empty` s2, `rooms` s10 and `branchy` s7 subjects, the pipeline room at 16807, and the witness trio were all dead-end geometry, and all were re-pinned on measured through-room subjects.
5. The brief's first act was `git checkout -B concept-library-f1b`. The harness's branch was used instead, as the brief anticipated.

## Residue

- **The yield question is for a ruling.** Two options would raise it without faking a cut:
  - (i) the binding picks, among the element's four declared pairs, one whose blob IS a cut. Today the pick asks only about the border ring. This spends no draw, but it is a new binding decision;
  - (ii) the binding walls a bypass so the blob becomes a cut. That writes terrain the carve made, which is a redesign.
- **Pre-sword INERT 8/8.** The bodies are drawn uniformly in the blob. A body draw biased to the mouth-to-mouth line would change the element's draws, so it would need a ruling.
- **What F2 now buys:** the 2 named refusals per palette (`branchy`/`winding` 14x14 s12, bodies in the crossing column), which takes 8 → 10 of 10 placed. W0's ceiling applies only once the geometry places more through-rooms.
- **`watchGenOverlay`** paints only the entry tunnel. The exit tunnel is in the ledger (`exit-tunnel` paintable) and in the record, but the overlay does not draw it yet.
- **The maze binding** ignores `through`: `roam` is not a maze head, and `mazeRoom/*` is T0b's.
- **The pipeline room's four post-sword throws** are the pre-existing swim-T2 pit class, reached on different levels. Nothing here widens around them.
