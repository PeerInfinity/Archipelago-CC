# Seedling hammer-phase RK2: refusal kinds, the follow-ups (`precondition`, `lastWhy.name`, the residue)

Slice `seedling-hammer-refusal-kinds-2` (Opus, cloud) for planner `seedling-hammer-phase-planning-2`. It covers the three
follow-ups RK (solve-progress Tier C item 1) left.

| | |
|---|---|
| start | `e37e9188a5` (`origin/main` at checkout, RK on main) |
| head | `de54b21f` (D4's records), then this report's own commit. Commits: `70cc4a9e` W0 + D1 · `0ec0d22f` D2 · `5b9e1d2b` D3 · `709fccce` D4 records · `de54b21f` D4 evidence |
| branch | `claude/seedling-refusal-kinds-2-v09imp`. The brief named `seedling-hammer-refusal-kinds-2`; this session's harness designates the `claude/…` branch. Not merged, not pushed to `main` |
| evidence | `CC/docs/cloud-reports/seedling-hammer-refusal-kinds-2-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `d4/`, `tools/`) |

**Verdicts.** W0 PASS · D1 PASS (no STOP) · D2 PASS · D3 PASS · D4 PASS.

**The one thing to know first.** `precondition` is new, and it took **20 sites away from `does-not-apply`** as well as
the door. Every "the bag lacks it / an opener is not yet discharged" refusal is now a state gate. `does-not-apply` now
means only "the wrong question for this target". On the committed solves no kind moves: the census and the per-solve
totals are RK's. The only pinned kind that moves is the real seal-ON row (`exhausted` → `precondition`), by design.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-refusal-kinds-2-v09imp origin/main` → `e37e9188a5` |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`. Six submodules were `-` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` on each. Node v22.22.0. Server `serve-nocache.py 9596`, PID 756 |
| identity block | `w0/identity-w0.txt`: **byte-equal to RK's D4** (maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `36b59445`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0 (= RK) |
| reference | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass |
| surface / constants / entities / profile / roster | GREEN 312 · 6,002 · 566 · 138 · 280 |
| bounded vitest BEFORE | RK's 30-file set (`w0/vitest-files-w0.txt`): **861 / 861** (RK's D4 was 860; the harvest's seal row is the one more) |
| RK's census | `tools/census.sh` → `w0/census-raw-w0.jsonl`: 53 payloads, the producers' md5s equal to the six `--check`s; kinds (`w0/census-kinds-w0.txt`) `pending` 32 · `exhausted` 12 · `bound` 7 · `does-not-apply` 3 · `danger` 1, no `other`. ⚠ RK's loader injected at **v1's** anchors (`3f5c3ff0fd`); at v2 they were gone, so RK2's copy (`tools/census-loader.mjs`) re-anchors on v2's `reject(node, …, kind)` lines |
| static classifier | RK's (`tools/static-sites.mjs` + `static-classify.mjs`): 365 sites, **74** `other` that are not wrappers (`d1/static-residue-before.txt`). RK reported 75: RK's wrapper exclusion was by reading, and RK2's `tools/static-residue.mjs` makes it a rule. The one difference is `:20797`, `swordWhy ? \`static sword arm: ${swordWhy} · the ceiling: ${weapon.why}\` : weapon.why`, which is a wrapper |

## D1 — measure (PASS, no tracked edit)

### The instrument
RK's static head is the site's next ~200 source characters. Two things hid a sentence's deciding words from it:
- the cut itself;
- a `' + '` concatenation splitting a phrase. For example, `STILL probes ' + \`dangerous` does not match `probes dangerous`,
  and `NOT ' + 'registered` does not match `not registered`.

`tools/static-sites2.mjs` reads each site's **whole argument text** instead. A small lexer takes it to the call's closing
paren, or to the statement's `;` for a `why =`, a row or a bound. Adjacent literals are joined. With RK's rules
unchanged, the residue is **42**, not 74 (`d1/static-residue2-before.txt`). The wrapper rule also gains the forms the
fuller text makes visible:
- a row whose `why:` is a variable;
- a sentence built by a call (`refusal({…})`);
- a sentence that ENDS on an inner why or message (`… — ${why}`, `${e.message}`), or joins its rows' whys.

Both instruments are reported before and after (D3).

### F1 — every state-gate site (line, sentence, kind today)
A state gate means the action is the right one for its target, but the run or the world is not in the state the action
needs. No search changes that. Measured on the fuller instrument:

| line | sentence (fixed words) | kind before |
|---|---|---|
| `:2220` (thrown by `resolveApproachStrategy`) | *"approach ${door} in level ${L} — **the door cannot open in this state:** ${predicates}. The game plays the SealController's ceremony …"* | `does-not-apply` (`cannot open`) |
| `:22875` | clear-tag `unresolved`: *"'approach' could not be resolved from (x,y): ${e.message}"*, which wraps `:2220` on the seal row | `exhausted` (field) |
| `:1315` | *"the Witch adds the dark sword **only for a player holding the WAND** … this run holds none"* | `other` |
| `:1230`, `:1742`, `:1944` | *"the inventory has no Fire / Wand slot"* | `does-not-apply` (`has no … slot`) |
| `:1679`, `:1908`, `:8903`, `:16319` | *"${x} cannot be burned / opened / pushed / broken **by this run** — …"* (the resolver's `held === false`) | `does-not-apply` |
| `:22883` | clear-tag `cannot-act`: *"'${verb}' cannot act on ${id} **with this run's bag**"* | `does-not-apply` (field) |
| `:6015`, `:21184` | *"this room / run **holds no sword**, so `set slashing`'s outer gate refuses every press"* | `does-not-apply` (`holds no`) |
| `:12903` | *"the kill work order **has no weapon**"* | `does-not-apply` |
| `:20523`, `:20948` | *"the run's `primary` slot holds NOTHING / fires … The sword **is a SUB-ORDER** the macro layer owes"* | `does-not-apply` |
| `:15527` (a `fail`), `:15891` | *"needs a key / `Player.${need}` **this run does not hold**"* | `does-not-apply` |
| `:22809`, `:22887` | clear-tag `prerequisite`: *"stance is **reachable only once** ${id} is discharged"* | `does-not-apply` (field) |
| `:19227`, `:19260` | *"stance **needs ${id} discharged** first"* | `does-not-apply` |
| `:773` | *"a crusher in this room is CHARGING; the ordering search **plans from parks**"* | `other` |
| `:22432` | teleporter `inside-solid`: *"… the door cannot be stepped off **until that solid is gone**"* | `other` |
| `:22591` | `arrival-inside-solid`: *"The solver **does not act from inside a solid**"* | `other` |

Gate-adjacent sites that are **not** gates, and why:
- `:19213`, *"reachable only once … and redeeming it would be link N of an opener chain **bounded at**
  `NESTED_OPENER_DEPTH`"*. The deciding fact is the depth bound, so it moves to `bound`.
- `already-true` (`:3260`, *"the latched wait's condition is already true"*). It is the gate's mirror and keeps its own
  kind.
- `wrong-level`, `cross-room-presser`, the absent pit (`:22970`, `:23060`) and the absent placement (`:23092`). The
  ORDER is the wrong one here ("a macro-layer error"), not the run's state, so they stay `does-not-apply`.

**Which `unresolved` throws are state gates.** `unresolved` has five sites (`:22784`, `:22794`, `:22805`, `:22875`,
`:22879`):
- `:22805` (*"found no reachable stance"*) and `:22879` (*"could not bind this obstacle against live state"*) are the
  resolver's generic outcomes. They stay `exhausted`.
- `:22784`, `:22794` and `:22875` wrap an inner refusal (`${firstWhy}`, `${e2.message}`, `${e3.message}`,
  `${e.message}`). They are gates exactly when the inner words are a gate's. On the seal row the inner words are `:2220`'s.

**The decision: a new kind, `precondition`.** Re-homing into `does-not-apply` would have merged two different answers:
- *"this target is the wrong question"* (a KILL question; a static body has no line to bend);
- *"the right action, but the state is not there yet"* (the seals, the WAND, a key, an opener).

The second has a remedy elsewhere (a sub-order, the Watcher's talk, a seal). The first has none.

**The name.** `solverBot.js` never writes "precondition". It writes "prerequisite" 55 times, but always for one gate:
another obstacle to discharge first (`resolved.prerequisite`, the `prerequisite` clear-tag reason). Naming the kind
`prerequisite` would make a WAND or a seal count "discharged". `precondition` is the closest word that covers all of
them, and it is the solver's own: its crusher module writes `precondition: 'run.crushersParked'` (`crusher.js:522`),
which is exactly `:773`'s gate.

**The rule.**
- `CLEAR_TAG_KINDS`: `prerequisite` and `cannot-act` → `precondition`, by field.
- `unresolved` → `exhausted` by field, **unless** its verbatim why matches `PRECONDITION_WORDS`. The door is read only
  by its stable lead-in, *"the door cannot open in this state:"* (⚖ fidelity-9), never by its clauses.
- The sentence rule `precondition` sits after `bound` and before `does-not-apply`. The gate words move out of
  `does-not-apply`'s regex.

### F3 — the residue's families (the fuller instrument's 42)
Every rule is on the solver's own words or fields. No rung or verb name is used.

| family | kind | rule words | sites |
|---|---|---|---|
| executor outcomes the run did not reach | `diverged` (RK's own kind for the seal door's executor: *"never played open"*) | `never comes to rest`, `came` / `comes to rest at`, `the walk rests` / `settled at`, `does not settle`, `still frozen after`, `still open after`, `ticks without the`, `ticks of the … and no`, `is not complete`, `added nothing`, `as route step … requires`, `before the thrust`, `ticks after the thrust`, `left the player facing` / `at`, `did not fire` | `:882`, `:1060`, `:1215`, `:1346`, `:1360`, `:1369`, `:1732`, `:1937`, `:2148`, `:9037`, `:9047`, `:9051`, `:9055`, `:9074`, `:13636`, `:13808`, `:19651`, `:22226` (+ `:8957`, `:8971` at run time) |
| what the model does not compute | `unmodelled` | `no choreography`, `this run does not step`, `nothing computed the consequence`, `UNMODELLED`, `NOT registered` | `:788`, `:13320`, `:13129`, `:14066`, `:13641`, `:23286` (and `:14949`, a `fail`, was `error`) |
| a search with nothing left | `exhausted` | `no` / `NO` + `cell`, `removed every body it could`, `would be the first one again` | `:12791`, `:13094`, `:14054`, `:22412`, `:22438`, `:19596` (`LIGHT_REENTRY`) |
| a bound the solver names | `bound` | `strategies for one goal`, `cleared … obstacle(s) and` (both `MAX_STRATEGIES_PER_GOAL`), `bounded at` | `:21874`, `:23205` (+ `:19213`) |
| a spit at every wait | `danger` | `fires a spit before` | `:13819` |
| not a body to kill | `does-not-apply` | `is not a body` | `:21046` |
| state gates | `precondition` | F1 | `:773`, `:1315`, `:22432`, `:22591` |

The teleporter's cases (the brief's examples) split by their own words:
- `inside-solid` is a gate (*"until that solid is gone"*);
- `closed` and `hazard-floor` are exhausted searches (*"no standable cell next to it can be walked to"*);
- `arrival-inside-solid` is a gate.

**The enum** stays small: one new kind. Every family but the gates fits an existing kind honestly.

**No STOP.** No family needs a field at a throw site in fidelity's files (`levelRun`, `mover`, `strikePolicy`,
`endingChain`, `contactFidelity`). Every family is named by words already in the sentence.

## D2 — implement (PASS)

`frontend/modules/seedlingDemo/solveProgress.js`. No other code file changed. `solverBot.js` was not edited.
1. `REFUSAL_KINDS` gains `precondition` right after `does-not-apply`, and `other` stays last. The export name is kept.
2. `PRECONDITION_WORDS` and the `precondition` sentence rule. `CLEAR_TAG_KINDS.prerequisite` / `cannot-act` →
   `precondition`. `unresolved` is a gate only by those words.
3. The F3 rules added to `danger`, `exhausted`, `bound`, `does-not-apply`, `unmodelled` and `diverged`.
4. `progressErrorName(x)`: `x instanceof Error ? x.name : null`, read off the object. `lastWhy` becomes `{why, kind,
   key, name}`. RK's three keys keep their names and order, and `name` is added last (js-7's condition).
5. `SOLVE_PROGRESS_VERSION` stays **2**. The header and the schema doc's §5, "v2 additions (RK2)", say what is added.
   No consumer gates on `v`, and I found no reason to bump.

**Gate rows** (`solveProgress.test.js`, 28 → 33 tests):

| row | what it pins |
|---|---|
| RK's byte-identity, v1 md5s, kind totals, `other` = 0, ≥ 15 in ≥ 4 | **unchanged**: L18 `pending` 10 + `exhausted` 3; L40 `danger` / `bound` / `exhausted` 1 each; L6 `exhausted` / `bound` 1 each; L3 none |
| the real seal-ON row (L113) | **re-pinned `exhausted` → `precondition`**. The why contains the door's lead-in, and `lastWhy.name` is `SolverRefusal` |
| fidelity ON / OFF corpus | equal both ways. The door's predicate sentence (`does-not-apply`) and the `unresolved` that wraps it (`exhausted`) are both now `precondition`. The generic `unresolved` is still `exhausted` |
| `lastWhy` shape | `Object.keys` = `['why', 'kind', 'key', 'name']`; `name` is `null` or a non-empty string |
| `lastWhy.name` on the committed solves | L18 `['Error', 'PendingDeclaration', null]`, L40 `[null]`, L6 `[null]`, L3 no rejection. L18's first pass alone: `name === err.name === 'Error'`, while the message starts `levelRun`. L40 / L6: a rung row → `null` |
| a family row per family (32 rows) | one REAL sentence from each site, read out of `solverBot.js` (literals joined, `${…}` → `7`) → its kind, including one named `other` (the soft-lock) |
| clear-tag reasons | `prerequisite` and `cannot-act` (sentences from source) → `precondition`. `unresolved` + the resolver's *"could not bind"* or *"no stance to approach"* → `exhausted`. `unresolved` + the door's lead-in + any clause, including one not yet written → `precondition`. *"the door cannot open"* without the lead-in → `exhausted` |
| rung independence | each family's sentence has the same kind under every rung the solver names (`rowFor('…')`, `refused = { rung: '…' }`); the lookup's body reads no `.rung` / `.option` |
| `progressErrorName` | the classes; `null` for rows, searches, strings and null; the body reads no message / `why`; `solverBot.js` never calls it |

**Mutants** (`tools/mutants2.py`, `d2/mutants.txt`), each run against the RK and RK2 rows:

| mutant | caught by |
|---|---|
| r1: `precondition` on the field alone (`CLEAR_TAG_KINDS.unresolved = 'precondition'`) | 2 red: the clear-tag row (*"could not bind"* → `precondition`, expected `exhausted`) and the fidelity corpus (SEALDOOR's generic `unresolved`) |
| r2: `name` from the message (`/^[\w$]+/` of the why) | 4 red: L18 first pass (`levelRun` ≠ `Error`), the seal row (`solverBot` ≠ `SolverRefusal`), the committed-solves names row, and the L40/L6 row (`no` ≠ `null`) |
| r3: a rule keyed on a rung (`o.rung === 'dodge'` → `diverged`) | 2 red: rung independence, and the fidelity corpus (AXETIMING's `dodge` rows) |

**For js-7 (the view; JS-arc files untouched):**
- **`precondition`** is a chip like the others, in `REFUSAL_KINDS` order: it sits after `does-not-apply`, so the view
  needs no new case if it iterates the export. As a reading aid it means **"waiting on state, not stuck"**. On the
  last-why line it is the place to say the remedy lives elsewhere, and the sentence names it (*"The work order is the
  Watcher's `talk` in L114"*, *"The sword is a SUB-ORDER"*). If the view colours kinds, it should sit with
  `does-not-apply` and `pending` (not a failure of search), not with `exhausted` / `bound`.
- **`lastWhy.name`**: show it only when it is non-null and not `SolverRefusal`. That is the case worth flagging: a
  `PendingDeclaration` (the two-pass loop's by-design pass), a plain `Error` or a `TypeError` whose words took a
  rule's kind. A null `name` means a rung row or a search leaf. Read `lastWhy` by field name; RK's three keys are
  unchanged.

**For fidelity:** nothing is owed. The seal door's kind hangs on the approach resolver's lead-in, *"the door cannot
open in this state:"*. If that lead-in changes, moving the pin is fidelity's (the clear-tag row and the family row both
read it out of the source, so they go red, not silently `other`).

## D3 — measure (PASS)

**L18 / L40 at 100 ms** (`tools/d3-rk2.sh`, `d3/rounds.jsonl`; 3 interleaved rounds; trees `base` = `e37e9188a5`, `rk2`
= this code; load 1.1–1.4):

| solve · tree · hook | wall (3 rounds) | median | digest | `shouldStop` | final bytes / segment | `lastWhy.name` |
|---|---|---|---|---|---|---|
| L18 · base · none | 3.66 / 3.81 / 3.67 | 3.67 s | `230dc0ff` | 165 | — | — |
| L18 · rk2 · none | 3.66 / 3.68 / 3.54 | 3.66 s | `230dc0ff` | 165 | — | — |
| L18 · base · 100 ms | 3.96 / 3.64 / 3.99 | 3.96 s | `230dc0ff` | 165 | 2,878 · 2,937 · 2,432 | (no field) |
| L18 · rk2 · 100 ms | 4.21 / 3.70 / 3.64 | 3.70 s | `230dc0ff` | 165 | 2,893 · 2,965 · 2,444 | `Error` · `PendingDeclaration` · `null` |
| L40 · base · none | 6.01 / 6.33 / 5.52 | 6.01 s | `3addc379` | 167 | — | — |
| L40 · rk2 · none | 5.44 / 6.13 / 6.50 | 6.13 s | `3addc379` | 167 | — | — |
| L40 · base · 100 ms | 6.03 / 6.37 / 5.79 | 6.03 s | `3addc379` | 167 | 3,671 | (no field) |
| L40 · rk2 · 100 ms | 5.56 / 5.95 / 5.99 | 5.95 s | `3addc379` | 167 | 3,683 | `null` |

- The digest and `shouldStop` are identical in all 24 runs. The kinds per node are identical between the trees (L18:
  `pending` on five nodes and `exhausted` on the leaf; L40: `danger` / `bound` / `exhausted` on AVOID / TIME / BAIT).
  `lastWhy.kind` is the same too.
- The snapshot grows by **+12 to +28 bytes per segment**, which is the `name` field. No wall difference is resolvable.
  The round-to-round spread is about ±0.5 s.

**The static residue, before → after:**

| instrument | before | after |
|---|---|---|
| RK's (200-char heads; `--rk` wrapper rule) | **74** (RK's hand count 75) | **44** (`d2/static-residue-after.txt`) |
| RK2's (whole argument text, literals joined) | **42** | **4** (`d2/static-residue2-after.txt`) |

60 static sites changed kind (`d2/static-kind-changes.txt`):
- 38 `other` → named: `diverged` 18, `exhausted` 6, `unmodelled` 6, `precondition` 4, `bound` 2, `danger` 1,
  `does-not-apply` 1;
- 20 `does-not-apply` → `precondition`;
- 1 `does-not-apply` → `bound` (`:19213`);
- 1 `error` → `unmodelled` (`:14949`, a `fail` whose words are the kill-lock ledger's; `lastWhy.name` keeps
  `SolverBotError`).

RK's instrument still reads 44 because its heads cut the deciding words, not because the rules miss them.

**The four left** (RK2's instrument):
1. `:2140`, *"the dialogue opened with the box … on the live Seed … — collecting it is a soft-lock"*. Left **`other`**
   on purpose. A soft-lock is neither damage (`danger`) nor a missing state, and the run arrived where it meant to. No
   kind is honest, and one site does not earn a new kind. A row pins it as `other`.
2. `:6019`, `refuse('deadline')`. This is `planSwordDash`'s own row helper (`plan: null, why: 'deadline'`). Like its
   window rows, it never reaches the tree.
3. `:8957` and `:8971`, *"as route step ${i + 1} requires"*. The rule matches the runtime text (`step 3 requires`), but
   the static head's `${i + 1}` has a space. The family row for `:8971` reads the sentence out of the source, fills it,
   and gets `diverged`.

## D4 — records (PASS)

| row | result |
|---|---|
| bot log | `seedling-bot-log.md`: `### Seedling hammer-phase RK2 — refusal kinds: precondition, the error's name, the residue` |
| schema doc | `seedling-solve-progress.md`: §2's block (`lastWhy: {why, kind, key, name}`), the kinds table (a `precondition` row, `does-not-apply` narrowed, the RK2 words marked), the coverage paragraph (75 → 4), `lastWhy.name`; §5 "v2 additions (RK2)"; §6 the RK2 pins |
| surface / constants | `--check` GREEN 312 rows · 6,002 literals, 0 drift, so there was nothing to `--write` (no `solverBot.js` change; `solveProgress.js` is not in their scope) |
| reference | regenerated (`docs/json/developer/procgen/README.md`, `procgenDocs/generated/docsIndex.js`: the two docs' counts), then `--check`: ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH; `generate-docs-index.mjs`: current (176 docs) |
| identity block AFTER | `d4/identity-d4.txt`, run at `709fccce` (D2's code + D4's records): **byte-equal to W0**, every row; the six `--check`s exit 0 with the same md5s; reference MATCH |
| tapeRunner pairs AFTER | **617 `8f27f975`**, 0 non-pass (= W0) |
| censuses AFTER | GREEN 312 · 6,002 · 566 · 138 · 280 (= W0) |
| bounded vitest AFTER | the W0 set (30 files, `lintGateLabels` included; `d4/vitest-files-d4.txt`): **866 / 866** (= 861 + RK2's five; `solveProgress.test.js` 33 tests) |
| not run (⚖ 52, the brief) | no unfiltered vitest, no `pytest`, no `standing-values --write`. The CI vitest suite at the pushed SHA and the in-app `seedling-js-runtime-solve-progress-view` row are the harvest's |

## What the brief got wrong (measured)

1. **"`CLEAR_TAG_KINDS`' `prerequisite` / `cannot-act` / `cross-room-presser` (today `does-not-apply`)" as gate
   candidates.** `cross-room-presser` is not a gate. Its two sites say the goal's presser *"is not a presser of level
   L's live world"* or *"writes {r,t} … not the clear this goal asks for"*. The order's data is wrong, so it stays
   `does-not-apply`. Only `prerequisite` and `cannot-act` are gates.
2. **The gate list was much longer than the candidates.** There are 24 static sites in all. 20 of them were
   `does-not-apply` in RK's rules, through their words (`has no … slot`, `cannot be … by this run`, `holds no`,
   `does not hold`, `has no weapon`, `holds NOTHING`, `reachable only once`, `needs … discharged`). They were not only
   the clear-tag fields.
3. **"75 `solverBot.js` sites whose fixed words no rule names."** That count is partly the instrument's. Read whole and
   joined, RK's own rules leave 42. RK's heads cut 32 sites' deciding words or split them across `' + '`.
4. **The census tool.** RK's `census-loader.mjs` anchors on v1's code, so it does not load at v2. RK2's copy
   re-anchors.
5. **The branch.** The brief's `seedling-hammer-refusal-kinds-2`; the harness designates
   `claude/seedling-refusal-kinds-2-v09imp`.

## Residue

1. **`:2140`, the soft-lock, stays `other`** (pinned). If more soft-lock refusals appear, a kind could be earned.
2. **Static counts are an indicator, not a proof.** `${…}` is unexpanded, so `:8957` / `:8971` read `other` statically
   and `diverged` at run time. The committed solves meet none of the new families: their census and kind totals are
   RK's.
3. **`precondition` has one real-solve row** (the L113 seal door, through clear-tag `unresolved`). The other gate
   families are pinned on their source sentences. A committed solve that meets the Witch's WAND or a bag gate would be
   the second real row.
4. **At harvest, not run here:** the CI vitest suite at the pushed SHA (⚖ 52), and the in-app
   `seedling-js-runtime-solve-progress-view` row (js-7's).
5. **Scratch worktree.** `/home/user/rk2-wt` (branch `rk2-dev`) was created for development and D3's `rk2` arm. It is
   removed at the end, by name.
