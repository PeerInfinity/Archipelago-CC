# Procgen demonstrations — a catalogue

Every demonstrable feature of the two procgen lab pages, one entry each, with
the URL that shows it, the CLI command that reproduces it in node, which
control to press, and what you are looking at.

⚖ It exists because the user asked for it on the 2026-08-17 generation review
(§4 item 6): *"interactive DEMONSTRATIONS of every demonstrable feature — URL +
how to run + what is happening"*.

## How to run any of these

```bash
python -m http.server 8000          # only if one is not already up on :8000
```

Then open `http://localhost:8000` + the entry's **Page** + `?` + its **URL**.

**Or skip the server: every entry also carries a `Live:` link to the same run on
GitHub Pages** (<https://peerinfinity.github.io/Archipelago-CC/>, deployed from
`main` by `.github/workflows/deploy-gh-pages.yml`, which publishes the
`frontend/` directory as the site root — so `/frontend/modules/…` here is
`/Archipelago-CC/modules/…` there). The live links are not typed by hand
either: `check-procgen-demos.mjs` asserts each one is exactly base + Page + `?`
+ URL, and `--pages=<base>` runs the whole catalogue against the deployed site
(⛓ 2026-08-18: 54/0 on Pages, after `watch.html` learned to resolve its repo
paths from its own URL rather than the origin's root). ⚠ Pages serves the tree
as of the last push to `main`, so a demo that reads a claim off a page changed
locally but not yet pushed will show the older behaviour there.
Every URL below is the spelling the page's OWN writer produces
(`watchGenerate.writeGenerateParams` / `mazeLab.writeLabParams`), so pasting one
back into the bar is a fixed point — the page reloads exactly the run the link
names. ⛔ None of them was typed by hand.

Two controls appear in nearly every entry and are worth learning once:

- **the PHASE ladder** (`◀ PHASE` / the slider / `PHASE ▶` / `the FINISHED
  level`) walks the GENERATION, one phase at a time. Phase *k* is the room as of
  ledger row *k*, rebuilt from the row deltas — ⛔ nothing is re-run, and the
  readout under it carries that phase's own sentence, its tile/entity delta and
  its refusal by name.
- **the FACT LINES** under the phase readout are the phase's INTERMEDIATE
  RESULTS — every candidate set, flood, region and pick it computed. ⚖ Ticking a
  line draws it (the user's ruling of 2026-08-18: *"only display the visual
  representation when the corresponding text description is selected"*). The
  `overlay` select beside them is a separate, cumulative picture of the finished
  level (`off → sites → elements → areas → all`).

⛔ Neither is a URL parameter. They are VIEW settings: they re-draw, they never
regenerate. A link names a RUN.

## How to read an entry

Each entry carries the same fields. **Page**, **URL** and **Claim** are read by
`scripts/procgen/check-procgen-demos.mjs`, which LOADS every URL in this file
and asserts each entry's own claim off the page's readout — so an entry whose
seed stops behaving the way the prose says goes RED rather than rotting
quietly. **Phase**, **Facts** and **Layer** are driven by the same row when
present. Everything else is for you.

```bash
node scripts/procgen/check-procgen-demos.mjs            # the whole catalogue
node scripts/procgen/check-procgen-demos.mjs --only=4   # one entry
```

⛔ **A catalogue entry without a claim is not an entry**, and the row fails on
one.

---

## The Seedling page — `frontend/modules/seedlingDemo/watch.html`

### 1. SITES — where pass 1 thinks a thing could stand

**What it demonstrates.** The SITE vocabulary (`procgenCore/sites.js`, arc 3
slice 1): the room's nubs, its corridor cells, its chambers and its branch
stubs, derived from the carved skeleton. ⛔ A site is a fact about the SEARCH,
never about legality — nothing is refused for standing off one.

- **Page:** `/frontend/modules/seedlingDemo/watch.html`
- **URL:** `source=generate&seed=2&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=2&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1>
- **CLI:** `node scripts/procgen/generate-seedling-level.mjs --seed=2 --skeleton=rooms --count=0`
- **Layer:** `sites`
- **Claim:** `overlays.counts.sites >= 10`

**How to run it.** Open the URL, then set the `overlay` select to `sites`. The
legend under the canvas names every group drawn and its cell count.

**What is happening.** `rooms` is the one tree kind that reliably leaves a 10×10
Seedling room with chambers in it, so it is the kind with something to show:
the chamber cells are the wide blobs, the corridor cells are the one-wide lanes
between them, and the branch stubs are the dead ends the carver left. Pass 1
proposes; the loop's own legality rules dispose.

---

### 2. THE CARVE — a typed `chambers=0` is a different room

**What it demonstrates.** ⛓ Arc 3, slice 5a's D2: Seedling's five carved tree
kinds default `chambers` to **1** while the shared codec's default is **0**, so
an OMITTED parameter and one TYPED at the codec's default had normalised to the
same object and the typed 0 was unspellable in a link. The reader now takes the
string AS TYPED. Measured through the page: **14 ground cells at a typed 0
against 19 at the default**.

- **Page:** `/frontend/modules/seedlingDemo/watch.html`
- **URL:** `source=generate&seed=1&biome=pre-sword&skeleton=winding%3Bchambers%3D0&count=0&tries=8&k=3&anchortries=1`
- **Also:** `source=generate&seed=1&biome=pre-sword&skeleton=winding%3Bchambers%3D1&count=0&tries=8&k=3&anchortries=1`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=1&biome=pre-sword&skeleton=winding%3Bchambers%3D0&count=0&tries=8&k=3&anchortries=1>
- **Live (also):** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=1&biome=pre-sword&skeleton=winding%3Bchambers%3D1&count=0&tries=8&k=3&anchortries=1>
- **CLI:** `node scripts/procgen/generate-seedling-level.mjs --seed=1 --skeleton='winding;chambers=0' --count=1 | head -3`
- **Phase:** `carve`
- **Claim:** `phase.row.data.params.chambers == 0`

**How to run it.** Open the URL and press `PHASE ▶` until the label says
`carve`. Then open the **Also** link beside it — the same seed at the DEFAULT
`chambers=1` — and compare the same phase.

**What is happening.** The `carve` row is the CONNECTOR's: it names the kind and
the effective parameters and its tile delta IS the carve. The two links differ
in one parameter and the rooms differ in five ground cells; a link that could
not spell the typed 0 would have shown you the other room.

---

### 3. THE GUARD — a reverse-pull block, its flag and the cut its lock makes

**What it demonstrates.** The pre-carve ELEMENT: a `reverse-pull-block` gadget
constructed in a reserved rectangle BEFORE the carve, joined to the room by the
shortest tunnel, with its flag (`buttonroom`) and the flag's LOCK on a
main-path cut. ⛓ Slice S1 is what made it CERTIFY — the solver can now raise an
order as the PREREQUISITE of reaching another obstacle's stance, and the
certification solve comes back `['weigh','hold','collect']`.

- **Page:** `/frontend/modules/seedlingDemo/watch.html`
- **URL:** `source=generate&seed=12&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&elements=guard%3Blen%3D2`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=12&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&elements=guard%3Blen%3D2>
- **CLI:** `node scripts/procgen/generate-seedling-level.mjs --seed=12 --biome=pre-sword --elements='guard;len=2' --count=0`
- **Phase:** `composite`
- **Facts:** `flag-and-lock,flag-lock-flood-start,flag-lock-flood-goal`
- **Claim:** `elements.certified == true`

**How to run it.** Open the URL, press `PHASE ▶` to `pre-carve` (the SITE
candidates and the site taken), then again to `composite`. Tick *the FLAG and
its LOCK* and both *flag LOCK's cut* lines: the two floods are the room with the
lock cell walled, and the flag is in the START-side one. Step on to
`certification` and tick *the CERTIFICATION solve's ROUTE*.

**What is happening.** The lock is a CUT, not decoration (⚖ ruling 17): with its
one cell walled the room falls into two components and the goal is in the far
one. The flag that opens it has to be in the near one, which is exactly what
the two floods show. The route is the solve's own walk — see the note on the
line for why it has holes in it.

---

### 4. THE KILL GATE — the candidate funnel, the grown wall, the DEMAND

**What it demonstrates.** The `on-connector` element (arc 3, slice 4a): a lock
on a main-path cut whose wall is GROWN to fit the room, with the body whose
death opens it in a start-side pocket, plus 4d's DEMAND — the region the body
moves in and the walls that keep it there, which pass 2 may not make lethal.

- **Page:** `/frontend/modules/seedlingDemo/watch.html`
- **URL:** `source=generate&seed=2&biome=post-sword&count=0&tries=8&k=3&anchortries=1&elements=killgate`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=2&biome=post-sword&count=0&tries=8&k=3&anchortries=1&elements=killgate>
- **CLI:** `node scripts/procgen/generate-seedling-level.mjs --seed=2 --biome=post-sword --elements=killgate --count=0`
- **Phase:** `on-connector`
- **Facts:** `door-candidates-offered,door-candidates-tried,door-candidates-legal`
- **Claim:** `elements.certified == true`

**How to run it.** Open the URL and step to `on-connector`. Tick the three
candidate lines in order and watch the funnel narrow: what the room OFFERED
(every interior main-path cell), what reached the DOOR LAW (the rest were cut
earlier — too near the goal, or no legal pocket), and what PASSED it. The PICK
is outlined in the second colour. Step on to `composite` and tick the two
*door law* floods and the DEMAND.

**What is happening.** The element's ONE draw is a choice among candidates that
have ALL already passed every rule — a pick that landed on one the law would
refuse would be a draw spent to fail. `cost.candidates` on the payload carries
only the last number; the three lines are the only place the whole funnel is
visible, and every one of them is CARRIED out of the construct's own law calls
rather than re-derived.

---

### 5. THE BLOCK POCKET — a block in the door and a straight run to a dead end

**What it demonstrates.** The second `on-connector` element: the block stands IN
the door cell (so its `clearer` is EMPTY — there is no separate thing to reach),
and the run ends at the FIRST cell along the push where the room reconnects.

- **Page:** `/frontend/modules/seedlingDemo/watch.html`
- **URL:** `source=generate&seed=1&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&elements=blockpocket`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=1&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&elements=blockpocket>
- **CLI:** `node scripts/procgen/generate-seedling-level.mjs --seed=1 --biome=pre-sword --elements=blockpocket --count=0`
- **Phase:** `on-connector`
- **Facts:** `door-candidates-legal`
- **Claim:** `elements.ran == true`

**How to run it.** Step to `on-connector` for the funnel, then to `composite`
for the cells the element OWNS and the carve's ONE MOUTH.

**What is happening.** Clause (a) of the carve law admits a DEAD END and nothing
else: exactly one 4-neighbour of the whole carved blob is walkable once the
placement is painted. Two mouths would be a TUNNEL — a change to the room's
connectivity rather than a place to stand — and the `carve-mouth` line is that
clause as a picture.

---

### 6. THE AREA GRAPH — the partition, the level-n floods and the vestibule

**What it demonstrates.** ⛓ Arc 3, slice 4b: the AREA PARTITION (one 2×2 rule,
shared with the maze), an intra-level lock-and-key graph over it, a lock on
EVERY BOUNDARY CELL of every locked area, and the goal's VESTIBULE — a synthetic
area of radius 2 grown so that no lock can land on the goal's doorstep.

- **Page:** `/frontend/modules/seedlingDemo/watch.html`
- **URL:** `source=generate&seed=2&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1&areas=1`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=2&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1&areas=1>
- **CLI:** `node scripts/procgen/generate-seedling-level.mjs --seed=2 --skeleton=rooms --areas=1 --count=2`
- **Phase:** `realisation`
- **Facts:** `area-locks,goal-vestibule,level-0-reach`
- **Claim:** `areas.ran == true`

**How to run it.** Step to `partition` first (one selectable line per area — a
SYNTHETIC one is outlined rather than filled, because it is grown and not a
chamber), then to `graph`, then to `realisation`. Tick *the GOAL's VESTIBULE*
and the `level 0` flood: level 0 is what the entrance reaches with every
level-1 lock treated as wall, and it stops at the boundary the locks sit on.

**What is happening.** A locked edge is a CUT by construction of the tree; the
level-n flood is the check that the GRID agrees, which is the one thing
construction cannot promise. ⛔ When it DISAGREES the graph refuses and the level
ships carved — and the refusal now writes its own `realisation` row with the
offending level's flood on it, which is the picture the refusal is about.

⚠ Acceptance on a 10×10 Seedling room is **0–4 of 12 per kind** and the cause is
the AREA COUNT (4b §14.3) — published, not tuned. Most seeds refuse with
`the-partition-yields-one-area-or-fewer`.

---

### 7. A SWORD-GATED LEVEL — `require:['hasSword']`, graded STRONG

**What it demonstrates.** ⛓ Arc 3, slice 4d: the generator is RULE-DIRECTED. You
name an ITEM and it DERIVES the element head from `ELEMENT_TABLE.needs`, then
grades the finished level with a differential — the same run generated again
with the flag off, solved, and compared.

- **Page:** `/frontend/modules/seedlingDemo/watch.html`
- **URL:** `source=generate&seed=30&biome=post-sword&count=6&tries=8&k=3&anchortries=1&require=hasSword&run=1`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=30&biome=post-sword&count=6&tries=8&k=3&anchortries=1&require=hasSword&run=1>
- **CLI:** `node scripts/procgen/generate-seedling-level.mjs --seed=30 --biome=post-sword --require=hasSword --count=6`
- **Claim:** `require.grade == "STRONG"`

**How to run it.** Open the URL — it carries `run=1`, so the ladder runs to step
6 on load. The identity line and the `require` block say `MET` and name the
grade.

**What is happening.** Seed 30 is the seed the DEMAND rescued: before 4d's D3
its kill lock was cleared by pass-2 *water* and the directive graded WEAK. The
gate now DECLARES a demand on its body's region and the same seed grades STRONG.

⚠ **THE BAR IS PUBLISHED, NOT TUNED.** The search that found it asked for
`certified, cause=sword, grade=STRONG, kept>=5, families>=3, noabort` over seeds
1–40 and N ≥ 3 was stated before the run. It returned **1 hit — seed 30** — and
the binding clause is the predicted one: of the five CERTIFIED cells only one
keeps templates from three families. Relaxing exactly that clause to
`families>=2` gives **four** STRONG hits — seeds **2, 23, 30, 36** — plus seed
**20** at BOUND-DEPENDENT, which still MEETS the directive. All five are listed
here rather than one being promoted quietly.

```bash
node scripts/procgen/find-seedling-seeds.mjs --seeds=1-40 --biome=post-sword \
    --require=hasSword \
    --where='certified,cause=sword,grade=STRONG,kept>=5,families>=3,noabort'
```

---

### 8. A REFUSED DIRECTIVE — and the level is still shown

**What it demonstrates.** ⛔ Where the Seedling page follows the CLI rather than
arc 1's maze rule: a refused `?require=` still SHOWS the level the run produced,
labelled. On the maze the graph IS the level's structure and a refused one
leaves nothing worth showing; on Seedling a refused directive leaves a perfectly
ordinary level that the run really made.

- **Page:** `/frontend/modules/seedlingDemo/watch.html`
- **URL:** `source=generate&seed=30&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&require=hasSword`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=30&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&require=hasSword>
- **CLI:** `node scripts/procgen/generate-seedling-level.mjs --seed=30 --biome=pre-sword --require=hasSword --count=0; echo $?`
- **Claim:** `require.refused.reason matches the-biome`

**How to run it.** Open it and read the identity line: `requires: hasSword — ⛔
REFUSED: the-biome-lacks-the-item`, with the level drawn underneath.

**What is happening.** A pre-sword boot does not grant `hasSword`, so no element
in the table can be forced to need it and the directive is refused BY NAME
before a room exists. The CLI's exit code is 6 and it prints the level too.

---

### 9. A DROPPED ELEMENT — and it draws NOTHING

**What it demonstrates.** ⛔ The arc's own dependency, published rather than
smoothed over: when the certification solve cannot walk the gadget, the level is
regenerated WITHOUT it (the draws are spent either way) and the overlay draws no
element group at all — the REASON is a LEGEND row.

- **Page:** `/frontend/modules/seedlingDemo/watch.html`
- **URL:** `source=generate&seed=1&biome=post-sword&count=0&tries=8&k=3&anchortries=1&elements=killgate`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=1&biome=post-sword&count=0&tries=8&k=3&anchortries=1&elements=killgate>
- **CLI:** `node scripts/procgen/generate-seedling-level.mjs --seed=1 --biome=post-sword --elements=killgate --count=0`
- **Layer:** `elements`
- **Claim:** `elements.refused.reason == "the-skeleton-does-not-solve-with-the-element"`

**How to run it.** Set the overlay to `elements` and look at the legend: no
group, one note naming the refusal.

**What is happening.** A picture of a gadget that is not in the level would be
the overlay disagreeing with the room. ⛓ The GEOMETRY the census measured is
still carried on the certification, so no number is lost — it is simply not on
the canvas.

---

### 10. THE PHASE STEP-THROUGH ITSELF

**What it demonstrates.** ⚖ The user's requirement of 2026-08-17: *"a
step-through of the WHOLE generation — a button per step and a report at each"*.
Phase *k* is the room as of ledger row *k*, rebuilt from the row DELTAS and
handed to the existing renderer. ⛔ Nothing is re-run.

- **Page:** `/frontend/modules/seedlingDemo/watch.html`
- **URL:** `source=generate&seed=12&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1&areas=1`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html?source=generate&seed=12&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1&areas=1>
- **Claim:** `phase.count >= 6`

**How to run it.** Press `PHASE ▶` from the start and read each row's own
sentence, its tile/entity delta and its draw span. `the FINISHED level` returns
to the end. At the last pass-1 row the label says *"pass 2 — use STEP"*, which
is where the generation ladder takes over.

**What is happening.** Every phase of pass 1 leaves a row behind it, written BY
that phase with the facts it had already computed. ⛔ A phase that is never
REACHED writes NO ROW, which is what makes the omission visible — and folding
back to phase *k* is NOT the same as re-running without what phase *k* did (a
`pre-carve` element spends its draws before the carve, so the two reach the
carver at different stream positions).

---

### 11. THE SOLVE REPLAY AND THE SCRUB

**What it demonstrates.** The pass-2 half — the generation ladder, the per-anchor
refusals, and the solve replayed tick by tick over the finished level.

- **Page:** _(none — this one is documented where it lives)_
- **See:** [Seedling Real-Game Bot](./seedling-bot.md) for the STEP control, the
  generation pane and the scrub bar, and
  [Playback and Debugging Tools](./playback-and-debugging.md) for the playback
  contract underneath them.

**What is happening.** ⛔ The ledger deliberately does NOT duplicate pass 2: the
per-anchor refusals are `out.trace` as they stand, and the phase ladder hands
over to the existing STEP control at the last pass-1 row. Two records of one
thing would drift.

---

## The maze lab page — `frontend/modules/mazeRoom/lab.html`

### 12. THE MAZE AREA GRAPH — `?areas=` and `?require=`

**What it demonstrates.** ⛓ Arc 1: the same area partition and the same
lock-and-key graph, bound to the maze — where the room is big enough that the
graph accepts routinely — plus the RULE-DIRECTED `?require=K0`, which on this
page names an area-graph SYMBOL rather than an item flag.

- **Page:** `/frontend/modules/mazeRoom/lab.html`
- **URL:** `source=generate&seed=1&biome=maze-v1&width=15&height=15&count=2&tries=8&k=3&anchortries=1&skeleton=rooms&areas=1&require=K0&expansions=20000&run=1`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/mazeRoom/lab.html?source=generate&seed=1&biome=maze-v1&width=15&height=15&count=2&tries=8&k=3&anchortries=1&skeleton=rooms&areas=1&require=K0&expansions=20000&run=1>
- **CLI:** `node scripts/procgen/generate-maze-level.mjs --seed=1 --width=15 --height=15 --skeleton=rooms --areas=1 --require=K0 --count=2`
- **Claim:** `areaGraph.ran == true`

**How to run it.** Open it; the area layer control beside the canvas paints the
partition, the doors and the keys. `?areas=1&require=K1` is the refusal — and on
THIS page a refused directive offers no level and no payload.

**What is happening.** The graph is over AREAS, not cells: a locked edge cuts
the tree, the doors go on area-side boundary cells, and the level-n flood is the
check that the grid agrees.

---

### 13. THE MAZE ELEMENT, AND THE SOLVE STEP-THROUGH

**What it demonstrates.** ⛓ Arc 2: the SAME element the Seedling page binds —
`reverse-pull-block` — constructed on the maze, plus `__mazeLab.play`, the
step-through of the SOLVE (as opposed to the generation).

- **Page:** `/frontend/modules/mazeRoom/lab.html`
- **URL:** `source=generate&seed=2&biome=maze-v1&width=15&height=15&count=2&tries=8&k=3&anchortries=1&skeleton=rooms&areas=1&elements=guard%3Blen%3D2%3Bturns%3D1&expansions=20000&run=1`
- **Live:** <https://peerinfinity.github.io/Archipelago-CC/modules/mazeRoom/lab.html?source=generate&seed=2&biome=maze-v1&width=15&height=15&count=2&tries=8&k=3&anchortries=1&skeleton=rooms&areas=1&elements=guard%3Blen%3D2%3Bturns%3D1&expansions=20000&run=1>
- **CLI:** `node scripts/procgen/generate-maze-level.mjs --seed=2 --width=15 --height=15 --skeleton=rooms --areas=1 --elements='guard;len=2;turns=1' --count=2`
- **Claim:** `elementInfo.ran == true`

**How to run it.** Open it, then press the solve controls to walk the plan a
step at a time.

**What is happening.** The element CONTRACT is one shape across three bindings
(arc 2 §9.2, unchanged): the maze maps its tiles and symbols onto grid tiles and
area symbols, Seedling maps them onto blocks, buttons and locks, and neither
re-derives the gadget's geometry.
