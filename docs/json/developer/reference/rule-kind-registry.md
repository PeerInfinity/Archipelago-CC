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
  (`LOSSY FALLBACK: Unknown helper …`) is a separate sink and has not changed.
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
`rule-type-dispatch-inventory.md` lists the dispatch sites themselves, including display walkers the
census does not cover.
