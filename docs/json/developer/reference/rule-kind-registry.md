# Rule-Node Kind Registry and Census

A rules.json rule node has a **kind**: an AST node's `type` (`{"type": "item_check"}`) or a Rule
Builder node's `rule` (`{"rule": "Has"}`). Several layers produce kinds and several consume them. A
kind that one layer emits and another cannot handle usually does **not** fail: it silently becomes
"always true", "always false", or `undefined`. The registry and its census turn each such gap into a
named test failure.

## The pieces

| File | What it is | Edited by |
|---|---|---|
| `frontend/schema/rule-kinds.json` | The **registry**: every kind (by format), what it needs from its evaluation context, the kinds that look like rules but are not, the **known gaps**, and their ceiling | hand |
| `frontend/schema/rule-kinds.python-vocab.json` | Each Python layer's vocabulary (exporter, converters, rule_builder, world_generator) | **generated**: `python scripts/rules/rule_kind_vocab.py --write` |
| `scripts/rules/ruleKindCensus.js` | Builds the census: the JS engine's vocabulary live, the Python snapshot, and the kinds used in committed presets | — |
| `scripts/rules/ruleKindCensus.test.js` | The **gate** (vitest, `unittests_frontend.yml`) | — |
| `test/general/test_rule_kind_vocab.py` | Keeps the Python snapshot fresh (pytest, `unittests.yml`) | — |

The Python half is a snapshot because no CI job can see both languages. The vitest runner's
`python3` cannot import the exporter or rule_builder (it lacks the Archipelago requirements), and the
pytest job checks out no submodules (so it has no JS engine). Change a Python layer and pytest fails
until the snapshot is regenerated. The regenerated snapshot is under `frontend/`, so it triggers the
vitest census.

Run the census by hand: `node scripts/rules/ruleKindCensus.js` (add `--json` for everything).

## What the census checks

**Produced kinds** are the kinds that can reach a rules.json:

- every AST `type` the exporter can emit, and every Rule Builder name that `rule_builder` serialises;
- every Rule Builder name the games' handlers, the foreign Rule Builder and the AST→RB converter write;
- `AST_<type>` for each emitted **expression** type the AST→RB converter has no converter for. The
  default export runs AST→RB, and the JS engine rebuilds such a node from `_original_ast_type`.
  Statements (`statement: true` in the registry) stay AST inside helper bodies;
- every kind used in a rule position of a committed preset (`access_rule`, `item_rule`,
  `completion_condition`, `defeat_rule`, `clear_rule`, `gateRule`, helper bodies). A Rule Builder name
  in data counts as a kind when the registry or the engine's switch knows it; every other name is a
  game helper.

**Obligations.** Each one is a layer that must handle every produced kind of its format:

| Obligation | Handles it when | Today's fallback for a kind it lacks |
|---|---|---|
| `js.ast` | the JS engine has an AST handler | warn + `undefined` |
| `js.rb` | the engine's Rule Builder switch handles it (**probed**: a name it does not handle falls to the default branch and becomes a helper call of that name), or it is `AST_<t>` with an AST handler for `t` | worker: helper not found → `false`; main thread: `undefined` |
| `world_generator.rb` | world_generator's codegen accepts it at a rule root (in `rb_to_type` **and** handled by the chain, or checked after the map) | `True_()` |
| `world_generator.rb_map_without_handler` | (must be empty) | `True_()` |
| `helper_codegen.ast` / `.rb` | `HelperCodeGenerator` (helpers JSON → Python) handles it | the literal `'True'` |
| `converter.rb_to_ast` | the RB→AST converter has a converter | a `helper` node of that name + a warning |

**Registration.** Every kind any layer knows must be in the registry, and every registry kind must
still be known to some layer. Every kind declares a `capability` from the registry's list:

- `pure`: needs only its operands;
- `inventory`;
- `regions`: an inventory-only context must refuse it by name;
- `world`;
- `helpers`;
- `tile`: reserved for tile-grid state.

**Known gaps.** `known_gaps` must equal the computed gaps exactly:

- A gap that is not listed fails the census as **NEW**, naming the obligation and the kind.
- A listed gap that has closed fails as **CLOSED**, so you remove it.
- `gap_ceiling` is the total. Lower it with the list. A raised ceiling in a diff is a new gap someone
  accepted on purpose.

## Adding a kind

1. Add the kind to the layer that emits it, and to every layer that must handle it (the table above).
2. If a Python layer changed, run `python scripts/rules/rule_kind_vocab.py --write`.
3. Add a registry entry: `"<kind>": {"capability": "…"}` (plus `"statement": true` for a statement).
4. Run `npx vitest run scripts/rules/ruleKindCensus.test.js`. Every layer you missed is named.

A kind that changes state, or needs a new kind of context (tile-grid state, say), needs a capability
for it, and every evaluation context must supply it or refuse the kind by name (below).

## Unknown-kind policy (⚖ D3, user, 2026-10-21)

Every site that dispatches on a kind follows the rule for its class:

- **Evaluators** (the JS engine and anything that decides access): an unknown kind, or a kind whose
  capability the context cannot supply, yields **undetermined**. Anything that must decide **refuses
  by name**, as sphere-log generation does with `SphereLogNotEvaluableError`. It never answers `true`
  or `false`.
- **Code generators** (world_generator, `HelperCodeGenerator`): **fail loudly**. Never emit `True_()`
  or `'True'` for a kind they cannot translate.
- **Display and editing** (rule-tree renderers, editors): render the node as **unknown** and still
  recurse into its children.
- **Closed-vocabulary oracles** (`bounceDemo` / `runnerDemo` `verifyObstacles.js`, which evaluate a
  substrate's own fixed set): keep **throwing**. That throw is their drift guard.

The known gaps above are where today's code breaks this policy. Fixing them is the follow-up work.

**As built (R2a, 2026-10-21):**

- **Worker.** `stateManager/core/ruleEvaluator.js` `executeHelper` returns `undefined` (warned once
  per name) for a helper that exists nowhere, instead of `false`. An unknown Rule Builder name lands
  there too, because the RB switch's default branch coerces it to a helper call. The reachability
  loop reads `undefined` with `Boolean()`, so undetermined means "not traversable" there: this was
  measured identical on every preset. `generic_helper` answers `undefined` where it answered `true`.
- **Rule Builder names rule_builder really emits:** `EntranceAccessRuleCall` is handled (an alias of
  `EntranceAccessRule`), `ASTRule` evaluates its `rule_data`, and `bool` is Python `bool()`.
  `NestedRule` and `WrapperRule` are abstract bases and are refused by name.
- **Codegen.** The three kind sinks (the RB chain, the rule dispatcher, and the helper-body
  expression generator) raise `UnknownRuleKindError`, naming the kind
  (`world_generator/_unknown_kind.py`). `--lossy` (or `WorldGenerator(lossy=True)` /
  `build_apworld(lossy=True)`) is the opt-in way to keep the always-true placeholder; it lists each
  one by `<site>:<kind>`. Committed presets that still need `--lossy`: kh1 (`if_statement`), kh2
  (`AST_comparison`), and smz3 (`Attribute`, `AST_lambda`). The unknown-helper-NAME fallback
  (`LOSSY FALLBACK: Unknown helper …`) was a separate sink then; F1 (below) routed it here too.
- **rule_builder `ASTRule`** raises `NotImplementedError` naming the AST type, instead of answering
  `True`.

**As built (R2b, 2026-10-21):**

- **Helper-body kinds** (`shared/ruleEngine`, tests in `ruleEngine/pythonExpressionKinds.test.js`):
  `tuple_assign` unpacks like Python (a mismatch leaves the targets undetermined); `formatted_value`
  is Python `str()` and `f_string` formats through it; `set_comprehension` is the generator's values
  deduplicated by value; `starred` spreads inside list/tuple/set literals and `call` arguments, and
  is undetermined anywhere else.
- **Checked against Python, not only against the census.** tunic `has_required_stats` was compared
  with the Python function over 62 inventories × 19 areas. The new handlers alone agreed on 1083 of
  1178; four more defects on the same path were fixed to reach 1178 of 1178: literals now see the
  helper body's locals, attribute access reads the exporter's serialised NamedTuple, `for_range`
  reads the exporter's `stop`/`step` (it read `end`), and `set()`/list mutators on a local work. A
  census gap closing does not mean the helper that uses the kind is now right. Diff the helper
  against Python.
- **Codegen (`world_generator/_helper_statements.py`).** A helper body whose root is a single
  statement (kh1 `has_x_worlds`: a bare `if_statement`) is generated as a one-statement block.
  `_STATEMENT_TYPES` is pinned to the registry's `statement: true` kinds. Any `AST_<t>` node that the
  AST→RB converter wrapped (kh2's `AST_comparison`) is unwrapped and generated as `t`, as the JS
  engine does with `_original_ast_type`. An unwrapped `t` with no codegen still fails by its own
  name. The census reads that rule too (`helper_codegen.rb` handles `AST_<t>` when
  `helper_codegen.ast` handles `t`), which closed 23 gaps. The strict sweep over every committed
  preset now fails on **smz3 only**: its rules are `lambda items: …` over TotalSMZ3's own
  `Progression` object (`Attribute` ×260, `AST_lambda` ×306).

**As built (F1, 2026-10-23): an unknown helper NAME is loud too.** A helper call whose name has no
body in the rules file's `helpers` block used to become `True_()` / `'True'` at four codegen sites
with only a stderr print, so a strict run exited 0 with a silently wrong world. It now goes through
the same switch: strict raises `UnknownHelperNameError` (a subclass of `UnknownRuleKindError`)
naming the helper, the site and the game; `--lossy` keeps the placeholder and lists it as
`<site>:helper <name>` next to the kinds. The sites are `rule helper` and `rule_builder helper`
(`_rule_converters.py`), `helper body` (`_helper_expressions.py`) and `helper lambda`
(`_helper_statements.py`). A boss `defeat_rule` that raised used to fall back to `return True`
silently in `_template_rules.py`; that error now propagates. Every committed package and preset
that did not hit the sink generates byte for byte as before. The committed presets that now need
`--lossy` for a helper name are bomb_rush_cyberfunk, lingo, pokemon_rb, raft, sc2, sm, soe,
yachtdice and yugioh06 (smz3 needed it already). All but raft keep the helper bodies in a JS
`gameLogic` module. raft is an exporter gap: a LogicMixin's `self.has(item, player)` exports as a
helper named `has`. Each one is on `worldgen_test_exclude_list` with that reason.

**As built (F4, 2026-10-23): an `if_statement` with an undetermined test is undetermined.** It used
to run neither branch and carry on, so the function answered with whatever its later statements
said. Now the enclosing function's answer is undetermined (the `if` returns `undefined` as a
return), and a data helper whose body gives that falls through to its JS fallback as before. Two
cases still decide, because both branches would leave the answer the same: identical branches (that
branch runs), and branches with no effect at all (no return, break, continue or assignment at any
depth: skipped, as before; a nested loop's variable binding is tolerated). Determined tests behave
exactly as before (`shared/ruleEngine/ifStatementUndetermined.test.js`). Measured over every
committed preset × player, with an empty inventory and with the whole item pool: only tunic reaches
an undetermined test. Its `has_combat_reqs("Swamp")` with the whole pool answered `true` before,
because `has_required_stats(None)` skipped all four stat checks and answered the money check alone
(Python would raise there). It is now undetermined. Reachability is identical everywhere, because
that call's only use is `Or(has_combat_reqs("Swamp"), Not(0))`, which is true with combat logic off.
The rule-tree display (`commonUI.js`) never evaluates statements. It now reads the condition from
`test`, the field the exporter writes; before, it read `condition` and so never showed one.

**As built (R2c, 2026-10-24): the remaining silent-wrong-answer gaps.**

- **Loops follow F4's rule** (`shared/ruleEngine/loopUndetermined.test.js`). A `while_loop` whose
  condition is undetermined, a `for_iter` over a value that is not an array (undetermined included),
  and a `for_range` with a non-integer bound or a zero step now make the enclosing function
  undetermined. Before, the loop was skipped as if its body never ran: `while_loop` read `undefined`
  as false and ran its `orelse`. A loop with no effect at all is still skipped. Measured over every
  committed preset × player (empty inventory and whole item pool): no loop ever reaches an
  undetermined value, and reachability is identical everywhere. The corpus has 0 `while_loop`, 32
  `for_iter` and 13 `for_range` nodes.
- **`count_true` with a non-integer `count`** (an expression dict, say) used to crash codegen with a
  `TypeError`. It now goes through `unknown_kind`: strict raises naming the rule, and `--lossy` keeps
  `True_()` and records `count_true:count_true with non-integer count …`. An integral float is read
  as its integer. No committed preset has one.
- **A `Has` on an item the rules file never creates** (no item definition, pool entry, placement or
  starting item) becomes `False_()`. That is exact, not a placeholder, because the generated world
  can never hold the item. So it never raises. It used to be a stderr print only; now it is recorded
  by name in both modes as `WorldGenerator.unobtainable_items` (`Has:<item>`), with an
  `UNOBTAINABLE:` warning. Committed hits: `Progressive Swim` in seedling_atlas (8),
  seedling_atlas_maze (8) and seedling_playthrough_maze (14; the Sword left the list when L10 joined;
  measured `--dry-run --lossy` 2026-10-25 after session tile-primitives-sphere-order-1).
- **raft's exporter gap is fixed in the generic analyzer.** Inside a LogicMixin method, `self` is the
  CollectionState (AutoLogicRegister merges the mixin's methods onto it). So `self.<CollectionState
  method>(...)` is now a state method (`self.has("Smelter", player)` → `item_check`), while the
  mixin's own methods stay helper calls and a `self.has` on a class that is not a LogicMixin stays a
  helper. raft's preset re-exported 26 `has` helpers as item checks, and strict world_generator now
  generates it. The JS already answered these correctly, through genericLogic's `has` fallback, so
  reachability did not move. wargroove and tww, the other presets with LogicMixin `self.has`,
  re-export byte for byte.

`rule-type-dispatch-inventory.md` lists the dispatch sites themselves, including display walkers the
census does not cover.
