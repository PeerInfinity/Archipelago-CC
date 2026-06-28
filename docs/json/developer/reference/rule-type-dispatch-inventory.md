# Rule-Type Dispatch Inventory

> **Purpose.** This document inventories **every site in the repo that dispatches
> on rule type** (Python and JavaScript). It was created to add end-to-end support
> for the `AtLeast` rule type, but it is intended as a durable checklist for *any*
> future rule type: when you add a new rule type, walk this list and confirm each
> site handles it.
>
> **The trap this document exists to prevent.** Several dispatch sites **default an
> unknown rule type to a silent value** — most dangerously `false` (unreachable) or
> `True_()` (always-reachable) — with no error. A new rule type that isn't added to
> these sites doesn't crash; it **silently mis-evaluates**, corrupting access logic,
> spoiler comparisons, procgen geometry, and generated worlds. "Looks like it works"
> is therefore *not* sufficient — every site below must be individually confirmed.
>
> Status legend for "AtLeast handled?": ✗ = not handled (needs work), ✓ = handled,
> ⊘ = not applicable (AtLeast can't reach this site in its current format).
> Verification: **[V]** = read & confirmed in source for this audit; **[A]** =
> agent-reported, line may drift.

---

## 0. What `AtLeast` looks like

Defined at `rule_builder/rules.py:502` as a `NestedRule` subclass carrying a
`count: int | FieldResolver` plus `*children`. Semantics: **true when at least
`count` of the child rules are true.**

Native serialized form (what `to_dict()` emits, and what the exporter writes into
`rules.json`):

```json
{ "rule": "AtLeast", "children": [ <rule>, <rule>, ... ], "count": N }
```

Note `count` and `children` live at the **rule root**, exactly like `And`/`Or`'s
`children` — *not* nested under `args`.

**Resolution collapses AtLeast in the common cases** (`rule_builder/rules.py:517`):
`_instantiate`/`from_resolved` rewrite `count == 0 → True_`, `count == 1 → Or`,
`count == len(clauses) → And`, `count > len(clauses) → False_`. A genuine
`AtLeast.Resolved` is only emitted for the **strict middle band `2 ≤ count ≤
len(clauses) − 1`**. Because the exporter serializes *resolved* rules, a real
`{"rule":"AtLeast"}` only appears in `rules.json` when a world actually uses an
N-of-M gate in that band. No shipped world does today — which is exactly why it is
the lone untested/undocumented type. Support must still be exhaustive.

**AtLeast is boolean, not a count-producer.** Its `Resolved._evaluate` returns a
`bool`. Unlike `CountItem`/`CountFromList`/`CountGroup`, it does **not** need a
`get_value()` override — the base `Rule.Resolved.get_value()` (`1 if _evaluate()
else 0`) is correct for a boolean. (The counting-rule `get_value()` caveat applies
to rules that feed a numeric `Compare`; AtLeast never does.) Confirmed [V].

---

## 1. Eval-critical sites (silent mis-eval if AtLeast is missing) — MUST FIX

These see a native `{"rule":"AtLeast"}` and would mis-evaluate it.

| # | File:line | Dispatches on | Style | AtLeast? | Unknown-rule behavior |
|---|-----------|---------------|-------|----------|-----------------------|
| 1 | `frontend/modules/shared/ruleEngine/ruleBuilderEvaluator.js:43` | `rule.rule` (→`ruleName`) | `switch` | ✗ **[V]** | **Not silent-false, but mis-evaluates:** default (≈1364) checks `_original_ast_type` then falls through to treating `ruleName` as a **helper** call → AtLeast becomes a bogus helper lookup → wrong result. This is the **primary runtime evaluator**. |
| 2 | `frontend/modules/shared/procgen/library.js:186` (`evaluateRuleAgainstInventory`) | `rule.rule` | `switch` | ✗ **[V]** | **Silent `false`** at `:222` ("treat as unsatisfied"). AtLeast → always unreachable in obstacle/forward sim. |
| 3 | `frontend/modules/procgenPipeline/ruleRequirements.js:23` (`extractRec`) | `rule.rule` | `switch` | ✗ **[V]** | **Silent `{items:∅, exact:false}`** at `:74`. AtLeast → "no physical item requirement", geometry left wrongly open. |
| 4 | `world_generator/_rule_expressions.py:40` (`_convert_rule_builder_format`) | `rb_rule` (the `rule` field) | `if`-chain | ✗ **[V]** | **Silent `return 'True_()'`** at **`:561`** — the most dangerous fallthrough. A regenerated world would make the AtLeast gate **always reachable**. |
| 4b | `world_generator/rule_codegen.py:563` (`_convert_rule`'s `rb_to_type` map) | `rule['rule']` | dict map gate | ✗ **[V]** | **Hidden gate in front of #4:** `_convert_rule_builder_format` only runs for `rb_rule` names present in this map. A name not in the map skips the whole if-chain and hits the same `True_()` unknown fallback. AtLeast must be added **here too** (`'AtLeast': 'atleast'`), not just in #4. |

`And`/`Or` are handled at all four (recurse over `rule.children`), so AtLeast slots
in beside them. Count read pattern at these sites: `rule.count` at root (JS) /
`args`/root (PY), defaulting sensibly.

---

## 2. Export / conversion sites — FIX (round-trip integrity)

| # | File:line | Dispatches on | Style | AtLeast? | Unknown-rule behavior |
|---|-----------|---------------|-------|----------|-----------------------|
| 5 | `exporter/exporter.py:1431` | — (calls `rule_func.to_dict()`) | duck-typed | ✓ **[V]** | No per-type dispatch; emits native `to_dict()`. AtLeast serializes correctly **as long as its `to_dict()`/Resolved.`to_dict()` are correct** (they are — `rule_builder/rules.py:559,582`). No change. |
| 6 | `exporter/converter/rule_builder_to_ast.py:60` (`RULE_CONVERTERS`) | `rule.get('rule')` | dict registry | ✗ **[V]** | `_convert_unknown` (`:166`/`:693`): **wraps as `helper` + warning**. RB→AST conversion loses AtLeast semantics. Should map AtLeast → AST `count_true` (its semantic twin). |
| 7 | `exporter/converter/ast_to_rule_builder.py:75` (`TYPE_CONVERTERS`) | `rule.get('type')` | dict registry | ⊘ **[A]** | AST→RB direction. AtLeast has no AST `type`; reachable only if we teach `count_true → AtLeast`. Optional: makes AST `count_true` round-trip to native AtLeast instead of expanded And/Or. |
| 8 | `rule_builder/ast_format.py:45` (`parse_ast_rule`) | `data['type']` | `if`-chain | ⊘ **[V]** | Unknown AST type → wrapped in `ASTRule` (`:124`). `count_true` is currently **not** parsed here. Optional: add `count_true → AtLeast`. |

**`count_true` is the AST-format semantic equivalent of AtLeast** ("at least N of
conditions"). `world_generator/_rule_converters.py:214` (`_convert_count_true_logic`)
already expands it (count==1→Or, count==n→And, middle band→`HasFromListUnique` for
item lists or a `C(n,k)` Or-of-Ands expansion, with a `True_()` fallback for
>120 combos). This is the model for how AtLeast can be handled wherever only the
AST path exists.

---

## 3. Display / editor / debug sites — FIX for completeness

AtLeast can reach these (most dispatch on `rule.rule`); they don't corrupt access
logic but will throw, mis-render, or mis-label.

| # | File:line | Dispatches on | Style | AtLeast? | Unknown behavior | Impact |
|---|-----------|---------------|-------|----------|------------------|--------|
| 9 | `frontend/modules/bounceDemo/verifyObstacles.js:46` (`evalRule`) | `rule?.rule` | `switch` | ✗ **[V]** | **THROWS** at `:53` | Bounce obstacle verifier crashes on an AtLeast gate. And/Or present — add beside. |
| 10 | `frontend/modules/bounceDemo/generator.slow.test.js`, `zoneIntegration.test.js` | `rule.rule` | `switch` | ✗ **[A]** | THROWS | Same minimal `evalRule` in test harnesses; mirror the fix. |
| 11 | `frontend/modules/commonUI/commonUI.js:2047` | `ruleName` (`rule.rule`) | `switch` | ✗ **[V]** | "[unhandled Rule Builder type]" text (`:2827`) | Rule tree UI shows AtLeast as unhandled; add a render case. |
| 12 | `frontend/modules/apworldEditor/ruleTreeEditor.js:31,217` | `ruleName` | `switch` | ✗ **[V]** | `defaultShape`/render fall to null/default | AtLeast nodes not creatable/editable in the apworld editor. |
| 13 | `frontend/modules/pathAnalyzer/pathAnalyzerLogic.js:726,842,889` | both `rule.type` & `rule.rule` | `switch`/`if` | ✗ **[V]** | nested-type detection only matches And/Or (`:847,850`) | AtLeast not recognized as a branch/nested node in path analysis. |
| 14 | `frontend/modules/mazeRoom/mazeRoomVisualizer.js:654` & `mazeRoomUI.js:3756` (`describeRule`) | `rule.rule` | `if`-chain | ✗ **[V]** | `rule.rule ?? JSON.stringify` | AtLeast renders as bare name / raw JSON instead of `AtLeast(N: …)`. |
| 15 | `frontend/modules/spoilerTest/testSpoilerRuleEvaluator.js:72` (`analyzeRuleTree`) | `ruleType` (both formats, `:44`) | `switch` | ✗ **[V]** | default `:269` logs name + JSON (display only; eval delegated elsewhere) | Spoiler-test tree log lacks an AtLeast branch; cosmetic. |

---

## 4. Sites where AtLeast cannot currently arrive — NOTE ONLY

Confirmed present but AtLeast can't reach them in its native `rule.rule` form (they
dispatch on AST `rule.type`, or are scoped to one game). Listed so a future AST
path doesn't forget them.

| # | File:line | Dispatches on | Unknown behavior | Note |
|---|-----------|---------------|------------------|------|
| 16 | `frontend/modules/shared/ruleEngine/core.js:140` | `rule.type` | warn + `undefined` (`:148`) | AST registry; native AtLeast never enters. **[V]** |
| 17 | `frontend/modules/stateManager/core/ruleEvaluator.js:376` (`debugRuleEvaluation`) | `rule.type` | **silent `false`** (`:645`) | Debug-only; AST format. Silent-false trap noted. **[V]** |
| 18 | `frontend/modules/shared/gameLogic/smz3/smz3Logic.js:880` (`evaluateSimpleRule`) | `rule.type` | warn + `false` **[A]** | SMZ3-specific; doesn't use AtLeast. |
| 19 | `frontend/modules/shared/ruleEngine/debug.js:23,268` | `rule.type` | log JSON | Debug viz only. **[V]** |
| 20 | `world_generator/_rule_converters.py` (`_convert_count_true*`, unknown→`True_` `:515`) | `type` / `ast_type` | `True_` fallback | AST path; handles `count_true` (AtLeast twin) already. **[V]** |
| 21 | `rule_builder/world_mixin.py:163` (`rule_from_dict`) → `rule_builder/rules.py:96` (`get_rule_cls`) | `data['rule']` | **ValueError** on unknown | AtLeast **already auto-handled** via `DEFAULT_RULES` (class is registered). Deserialization works today. **[V]** |
| 22 | `frontend/modules/apworldEditor/rulesUtils.js:65`, `ruleConverter/ruleConverterUI.js:417`, `helpers/helperUI.js:200`, `mazeRoom/mazeRoomEngine.js:1278` | various single-type checks | n/a | Minimal/irrelevant single-type guards (Compare-only, Constant-only, True_-only). No AtLeast work. **[A]/[V]** |

---

## 5. Docs & tests — ADD

| # | File | Current | Action |
|---|------|---------|--------|
| 23 | `docs/json/developer/reference/rule-types-reference.md` | no AtLeast | Add row (Logical/Nested section) with `count`+`children`. |
| 24 | `docs/json/developer/specs/rule-format-specification.md` | no AtLeast | Add to nested-rule spec if enumerated there. |
| 25 | `test_json/fixtures/rule_type_tests.json` | no `AtLeast` suite | Add cross-language suite incl. **count boundary** (count-1 satisfied = fail, count satisfied = pass) and collapse cases. |
| 26 | `test_json/rule_builder/test_rules.py:618` | only `to_dict` serialization tested | Expand: `Resolved._evaluate`, `_instantiate` collapse (0/1/n/over), middle-band stays AtLeast. |
| 27 | `scripts/docs/sync-rule-docs.py` / `sync-rule-tests.py` | flag AtLeast as undoc/untested | Auto-pass once 23 + 25/26 land (they scan rules.py classes vs docs/fixtures). No code change. |

---

## 6. Implementation order (proposed)

1. **Eval-critical (§1):** `ruleBuilderEvaluator.js`, `library.js`,
   `ruleRequirements.js`, `world_generator/_rule_expressions.py`. Emit native
   `AtLeast(count, *children)` in the worldgen path (AtLeast is importable now —
   no combinatorial expansion needed).
2. **Export/conversion (§2):** `rule_builder_to_ast.py` AtLeast→`count_true`;
   optionally the reverse `count_true→AtLeast` in `ast_to_rule_builder.py` +
   `ast_format.py`.
3. **Display/editor/debug (§3).**
4. **Docs + tests (§5)**, then **round-trip verification**: Python build →
   `to_dict` JSON → JS `ruleBuilderEvaluator` evaluation must agree, including the
   count boundary.

---

## 7. Consolidated silent-/dangerous-fallthrough list

Every site that swallows an unknown rule type rather than erroring (the reason this
audit was necessary):

- `world_generator/_rule_expressions.py:561` → **`True_()`** (always reachable). ⚠️ worst.
- `frontend/modules/shared/procgen/library.js:222` → **`false`** (unreachable).
- `frontend/modules/procgenPipeline/ruleRequirements.js:74` → **empty/inexact**.
- `frontend/modules/stateManager/core/ruleEvaluator.js:645` → **`false`** (debug).
- `frontend/modules/shared/gameLogic/smz3/smz3Logic.js` → **`false`** (game-specific).
- `world_generator/_rule_converters.py:515` → **`True_`** (AST path).
- `frontend/modules/shared/ruleEngine/ruleBuilderEvaluator.js:~1364` → **helper coercion** (not false, but wrong).
- `frontend/modules/shared/ruleEngine/core.js:148` → **`undefined`** + warn.
- `frontend/modules/bounceDemo/verifyObstacles.js:53` → **throws** (loud — the safe kind).
- `exporter/converter/rule_builder_to_ast.py:166` → **helper** + warning.
- `rule_builder/ast_format.py:124` → **ASTRule wrap**.
- `rule_builder/rules.py` `get_rule_cls` → **ValueError** (loud — the safe kind).
