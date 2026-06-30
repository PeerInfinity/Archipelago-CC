# Fork vs Upstream Rule Builder Comparison

**Last refreshed:** 2026-06-25 — compares the fork's modified Rule Builder against the **current** upstream.

This document compares two on-disk snapshots kept side-by-side in the repo root for reference:

| Directory | Contents |
|-----------|----------|
| `rule_builder_modified/` | The fork's modified Rule Builder, as it stood before the upstream-rebase work began (`rules.py` = 4221 lines). |
| `rule_builder_original/` | Clean upstream `rule_builder/` extracted from `upstream/main` @ `5ccef9802` (2026-06-07; `rules.py` = 2017 lines). |
| `rule_builder/` (live) | The working module — **reset to the clean upstream base** so fork features can be re-added on top of current upstream. |

> **Merge status (2026-06-25):** the Python-side merge (§7 overlay plan) is **complete** — commits `3b523b214`→`be7ce9efe`. The live `rule_builder/` is the official base + fork overlays (`extra_rules.py`, `world_mixin.py`, `ast_format.py`, `ast_explain.py`, `_ast_utils.py`, `pathfinding.py`) with minimal edits to upstream `rules.py` (additive base methods, `_make_hashable`, `Has` count widened to `int | FieldResolver | Rule`). **Verified:** 129 rule_builder unit tests pass; **Baba Is You** (official `FieldResolver`) now generates *and* exports full rules (794 rule-dicts, 0 errors — previously impossible either way); fork worldgen worlds **APCalc** and **ALttP** pass end-to-end (gen + frontend spoiler).

> **Phase 7 — game-specific custom rules — DONE (2026-06-29, commit `4e0f79933`).** A game's custom `Rule` subclass (e.g. Baba Is You's `HasBlossoms`, whose logic lives in a compiled `Resolved._evaluate`) used to serialize to an opaque `{"rule": "HasBlossoms"}` leaf the frontend couldn't evaluate, so Baba's frontend spoiler test failed. The fix is **entirely export-side** (no frontend change) — see §9 for details. Result: the real Baba frontend spoiler test now **passes** (reaches all 27.2 spheres).

> **Supersedes** the earlier comparison in this doc, which was written against upstream `0de09cd7` (Feb 2026). Upstream has moved on substantially since then — most importantly it introduced the **`field_resolvers.py` / `FieldResolver`** system (see §2) and a new **`AtLeast`** rule. The companion docs [`rule-builder-modifications.md`](rule-builder-modifications.md) (overview vs the original PR #5048) and [`upstream-rule-builder-changes.md`](upstream-rule-builder-changes.md) (upstream's own evolution) remain useful background.

---

## 1. File inventory

| File | Upstream | Fork | Status |
|------|----------|------|--------|
| `rules.py` | 2017 lines | 4221 lines | **Diverged** — the core of the work (§4, §5) |
| `__init__.py` | empty | 165 lines | **Diverged** — fork adds the public-export surface |
| `options.py` | present | present | **Identical** ✅ — fork imports `OptionFilter` from here |
| `cached_world.py` | present | present | **Identical** ✅ — shipped by both, but the fork does **not** use it as its world mixin (see §3) |
| `field_resolvers.py` | **present (new)** | absent | **Upstream-only** — the major new upstream subsystem (§2) |
| `_ast_utils.py` | absent | present | **Fork-only** — AST parsing utilities |
| `ast_format.py` | absent | present | **Fork-only** — parse AST JSON → Rule Builder objects |
| `ast_explain.py` | absent | present | **Fork-only** — human-readable rule explanations |
| `pathfinding.py` | absent | present | **Fork-only** — region accessibility / hypothetical-state tools |
| `README.md` | absent | present | **Fork-only** — fork documentation |

**Takeaway:** the divergence is concentrated almost entirely in `rules.py` and `__init__.py`. `options.py` and `cached_world.py` are byte-identical, so they need no porting. The four fork-only modules are already standalone files (good for the overlay strategy in §7); the hard part is `rules.py`.

---

## 2. What changed upstream since the last comparison (`0de09cd7` → `5ccef9802`)

### 2a. `field_resolvers.py` + the `FieldResolver` system — the big one

Upstream added a general **dynamic field-resolution** mechanism. A rule field that was previously a plain `int`/`str` can now be a `FieldResolver` that is resolved against the world at rule-resolution time (e.g. read an option, compute a count). Key pieces in `field_resolvers.py`:

- `FieldResolver` (ABC) — `resolve(world) -> Any`, plus `to_dict()`/`from_dict()` for JSON round-trip.
- `FieldResolverRegister` — per-game registry of custom resolvers (`custom_resolvers: dict[game, dict[name, type]]`).
- `resolve_field(value, world, expected_type)` — the call site helper used throughout `rules.py`.
- `DEFAULT_RESOLVERS` — built-in resolver names.

This is **pervasive** in upstream `rules.py` (37 references):

- Base `Rule` now has `_parse_field_resolvers` and resolves resolver fields in `__post_init__` / `from_dict` (lines ~116, ~138).
- Nearly every counting rule declares its count as `int | FieldResolver` and calls `resolve_field(...)` in `_instantiate`: `Has`, `HasAllCounts`, `HasAnyCount`, `HasFromList`, `HasFromListUnique`, `HasGroup`, `HasGroupUnique`, and the new `AtLeast`.
- `to_dict()` serializes these fields as `value.to_dict() if isinstance(value, FieldResolver) else value`.

The fork references `FieldResolver` / `resolve_field` **zero** times — it predates this design and solves the same "dynamic count" need a different way (nested `Rule` objects + the fork-only `CountItem`/`OptionValue` family). **This is the central design collision the port must resolve — see §6.**

### 2b. New `AtLeast` rule (upstream-only)

`class AtLeast(NestedRule)` — "true when at least N child rules evaluate true." `count: int | FieldResolver`; collapses always-true/always-false children and returns `True_`/`False_` accordingly. The fork has no equivalent and will need to absorb it when rebasing.

### 2c. `options.py` / `cached_world.py` converged

Both are now identical between fork and upstream (the earlier comparison flagged minor `OptionFilter` and mixin differences that no longer exist). No porting needed for these.

---

## 3. Structural divergence: where the mixins live

| Concern | Upstream | Fork |
|---------|----------|------|
| World base | `CachedRuleBuilderWorld(World)` in `cached_world.py` | `RuleWorldMixin(World)` defined **inline in `rules.py`** |
| LogicMixin | `CachedRuleBuilderLogicMixin` in `cached_world.py` | `RuleBuilderLogicMixin` + `_LogicMixinMeta` metaclass, **inline in `rules.py`** |
| LogicMixin acquisition | direct import | **lazy** via `_import_logic_mixin()` / `_get_logic_mixin()` — a circular-import workaround so `rule_builder` can be imported *before* `worlds` (e.g. from `world_generator`) |
| Cache attribute | `state.rule_builder_cache` | `state.rule_builder_cache` (aligned) |
| `OptionFilter` | `from .options import OptionFilter` | `from .options import OptionFilter` (aligned) |

So the fork ships `cached_world.py` but doesn't use it as its mixin; its real world/logic mixins are inlined at the top of `rules.py` (lines 57–518), along with the lazy-import shim. These are fork-specific and would move to a separate overlay file cleanly (§7).

---

## 4. Fork-only rule classes (15)

These exist only in the fork's `rules.py` and have no upstream equivalent:

| Class | Purpose |
|-------|---------|
| `EntranceAccessRuleCall` | Evaluate another entrance's access rule |
| `ASTRule` | Wrap an AST-format expression for resolution |
| `Not` | Boolean negation (`WrapperRule` subclass) |
| `CountItem` | Return the count of an item (numeric, not boolean) |
| `CountFromList` | Sum of counts across a list of items |
| `CountGroup` | Count from an item group |
| `Compare` | Compare two numeric rules with an operator |
| `Arithmetic` | Arithmetic between two numeric rules |
| `MinValue` | Minimum of multiple numeric rules |
| `MaxValue` | Maximum of multiple numeric rules |
| `Conditional` | If-then-else for rules |
| `HelperCall` | Call a helper function/rule by name |
| `WeightedSum` | Weighted sum of items |
| `UniqueCount` | Count of unique items from a list |
| `OptionValue` | Read an option value at runtime |

Supporting fork-only modules: `ast_format.py`, `ast_explain.py`, `_ast_utils.py`, `pathfinding.py` (`PathExistsToRegion`, `HypotheticalState`, `RegionProperty`, `EntranceChainCondition`, `find_paths_to_region`, …).

Fork-only mixin/helper surface inside `rules.py`: `RuleWorldMixin` extras (`resolve_rule`, `get_cached_rule`, `simplify_rule`, `register_rule_connections`, `register_dependencies`, `create_entrance`, `set_completion_rule`, `collect_item`), `_make_hashable`, `BOOLEAN_RULE_TYPES`.

---

## 5. Shared base-class modifications (interleaved edits)

These are edits **inside classes that also exist upstream** — they cannot be moved to a separate file without splitting the class, so they are the genuinely intrusive part of the port. Method-level diff (fork-added in **bold**):

### `Rule` (base)
- Upstream methods: `__and__ __bool__ __call__ __init_subclass__ __or__ __post_init__ __rand__ __ror__ __str__ _evaluate _instantiate _parse_field_resolvers entrance_dependencies explain_json explain_str from_dict {item,location,region,entrance}_dependencies resolve to_dict`
- Fork adds: **`get_value`**, **`get_count`**, **`_get_args_dict`**, **`_rule_class_name`**, **`__lshift__`** (Filtered convenience operator).
- Fork lacks: `_parse_field_resolvers` (the FieldResolver hook).
- `to_dict()` body differs: fork **omits** empty `options` / false `filtered_resolution` / empty `args` to shrink JSON.
- `__init_subclass__` module guard: upstream `!= "rule_builder.rules"`; fork `not startswith("rule_builder")` (allows rules defined in `rule_builder.*` submodules like `ast_format`).
- `resolve()` false case: upstream `False_().resolve(world)`; fork `world.false_rule` (pre-initialized).

### `Has`
- Fork adds **`_get_count_value`**, **`_get_args_dict`**, **`to_dict`**; `count` typed `int | Rule` (dynamic count via a nested rule).
- Upstream solves the same dynamic-count need via `count: int | FieldResolver` + `resolve_field`. **Collision — see §6.**

### `NestedRule`, `WrapperRule`
- Method sets are aligned; bodies differ only in minor details (`filtered_resolution` handling). Low-risk to reconcile.

### `Resolved` inner classes
- Fork adds `get_value()` / `get_count()` defaults (overridden by counting rules), `to_dict()`, `_get_args_dict()`, `_rule_class_name`. Counting rules **must** override `get_value()` (see the project memory note on `Compare(CountItem(...), ">=", N)`).
- **Each concrete *base* rule's `Resolved` must override `_get_args_dict()`** to emit its args for the exporter → `rules.json` → `world_generator`/frontend pipeline. For base rules (those in `DEFAULT_RULES`) the default returns `{}`, so a *missing* override silently drops the rule's args (e.g. `CanReachRegion` serializes to `{"rule": "CanReachRegion"}` with no `region_name`), which only surfaces in the worldgen→worldgen2 round-trip as `KeyError: ''` / `FillError`. **As of `4e0f79933` the base default auto-serializes a rule's dataclass fields for *game-specific custom* rules (those NOT in `DEFAULT_RULES`)** — so a community world's custom `Rule` subclass (e.g. Baba's `HasBlossoms`) no longer needs to override `_get_args_dict()` to round-trip its args (see §9). The base-rule contract above is unchanged because base rules are gated out of the auto path by `DEFAULT_RULES` membership. The arg **names now match upstream's** `from_dict()` keys (`item_names`, `item_counts`, `item_name_group`, `region_name`/`location_name`/`entrance_name`, `item_name`/`count`), so `Resolved.to_dict()` output round-trips through `from_dict()`. (Historically these emitted *fork* names — `items`/`group` — aligned to upstream in `rule-arg-upstream-naming-alignment`; `world_generator` and the frontend evaluator dual-read upstream-then-fork so legacy presets still parse until they are regenerated.) Overrides that must be present in `rules.py`: `Has`, `HasAll`, `HasAny`, `HasAllCounts`, `HasAnyCount`, `HasFromList`, `HasFromListUnique`, `HasGroup`, `HasGroupUnique`, `CanReachLocation`, `CanReachRegion`, `CanReachEntrance` (fork-only rules carry theirs in `extra_rules.py`). Regression guard: `test_json/rule_builder/test_rules.py::TestResolvedToDictArgs`. **History:** the `fa82db22e` upstream reset dropped all of these; Phase 1/2 re-added only the base + `Has`; the remaining 11 were restored in a later fix.

### `caching_enabled` default
- Upstream `False`; fork `True` (but `_instantiate` uses `getattr(world, "rule_caching_enabled", False)`, so non-mixin worlds still behave like upstream).

---

## 6. The central design collision: `FieldResolver` vs the fork's numeric rules

Upstream and the fork independently built mechanisms for "a rule field whose value is computed from the world":

| Need | Upstream answer | Fork answer |
|------|-----------------|-------------|
| Dynamic count on `Has`/`HasFromList`/etc. | `count: int | FieldResolver` resolved via `resolve_field` | `count: int | Rule` resolved by evaluating a nested rule (`_get_count_value`) |
| Read an option at runtime | a `FieldResolver` subclass | the `OptionValue` rule class |
| Computed/aggregated values | (resolver returns a value) | `CountItem`, `Compare`, `Arithmetic`, `MinValue/MaxValue`, `WeightedSum`, `UniqueCount` rules |

These overlap but are **not drop-in compatible**: upstream resolves a *field* to a scalar before the rule runs; the fork composes *numeric rules* that produce values during evaluation. Porting must pick one of:

1. **Adopt FieldResolver, map fork features onto it** — re-express `OptionValue` and dynamic counts as `FieldResolver`s; keep the numeric-rule classes (`Compare`, `Arithmetic`, …) for the cases resolvers can't express. Best long-term alignment with upstream; most up-front work; changes the exported JSON shape for those fields.
2. **Keep the fork's numeric rules, add FieldResolver alongside** — accept both `int | FieldResolver | Rule` on count fields. Lower risk to existing exported `rules.json`, but widens the base classes and leaves two parallel systems.
3. **Defer** — port everything except the dynamic-count integration; leave fork counts as `int | Rule` and don't wire FieldResolver into the counting rules yet.

**RESOLVED (2026-06-25) by compatibility data → Option 2 ("keep fork's mechanism, accept FieldResolver alongside").** The deciding constraint is the exported-JSON format:

- **84** preset `rules.json` files already use the fork's dynamic-count format — a nested-rule dict, e.g. `"count": {"rule": "tr_big_key_chest_keys_needed", "_original_ast_type": "helper", "_converted_from_ast": true}`.
- **0** use upstream's `FieldResolver` `{"resolver": ...}` format.

The frontend JS evaluator and `world_generator` both consume the nested-rule form. Replacing it with `FieldResolver` would break all 84 presets and the JS side. Therefore the port **keeps** `count: int | Rule` (and the `CountItem`/`Compare`/… numeric-rule family) as the canonical mechanism, and **must additionally support** `FieldResolver` (see §6a — it is not optional: the Baba Is You world requires it). Upstream's new `AtLeast` is absorbed as-is. The two forms coexist in one `rules.json` and are distinguishable by key: `{"resolver": …}` (official) vs `{"rule": …}` (fork nested rule).

### 6a. Empirical confirmation: the Baba Is You two-format test (2026-06-25)

`custom_worlds/baba_is_you.apworld` is a real rule_builder world. It is authored against the **official** `field_resolvers` API — `levels.py`/`custom_rules.py` do `from rule_builder.field_resolvers import FieldResolver, FromOption, FromWorldAttr, resolve_field`, and its custom `Resolved` uses the official `caching_enabled=` constructor. Generating seed 1 with each rule_builder:

| | Seed generation | Rule export → frontend `rules.json` |
|---|---|---|
| **Official rule_builder** (current live) | ✅ generates | ❌ rules lost — exporter's rule_builder→JSON path needs the fork's *extended* rule_builder; it falls back to AST/lambda analysis which errors on `Resolved` objects (`access_rule: None` everywhere) |
| **Fork rule_builder** (`rule_builder_modified`) | ❌ fails to import — `ModuleNotFoundError: No module named 'rule_builder.field_resolvers'` → "No functional world found to handle game Baba Is You" | n/a |

**Conclusions:**
1. **Supporting both formats is required, not just preferred.** Baba needs official `FieldResolver`; the 84 existing presets need the fork's nested-rule form. Neither rule_builder alone covers both worlds.
2. **The export pipeline is a second front.** The exporter gates on the fork's extended rule_builder via `from rule_builder import BOOLEAN_RULE_TYPES` (`worlds/json_tools_installer/export_hook.py`, `exporter/exporter.py:2651`). Re-adding the fork extensions onto the official base re-enables that path — but the exporter must then *also* serialize official `FieldResolver` fields (and the frontend evaluator + `world_generator` must parse them). This is the "update frontend and worldgen" follow-up.
3. **The merged target:** official base (keeps `field_resolvers.py`, `AtLeast`, `cached_world.py`) **+** the fork's extended rule types and exporter integration on top — a genuine superset that supports both Baba-style official worlds and the fork's AST-converted worlds.

---

## 7. Port strategy: "minimal-change overlay"

Goal (per the user): re-add the fork's features on top of clean upstream **with as few edits to upstream files as possible**, ideally by isolating new code in separate files that upstream files `import`/include at the right points.

### What ports cleanly as separate files (no/low upstream edits)
- **The 4 support modules** (`ast_format.py`, `ast_explain.py`, `_ast_utils.py`, `pathfinding.py`) — already standalone; copy across, fix imports.
- **The 15 fork-only rule classes** — move into a new module (e.g. `rule_builder/extra_rules.py` / `ast_rules.py`). They subclass `Rule`/`WrapperRule`, register via the `game=` metaclass, and the fork's `__init_subclass__` guard already allows rules defined in any `rule_builder.*` submodule — so they don't need to live in `rules.py`. Re-export them from `__init__.py`.
- **The world/logic mixins + lazy-import shim** (`RuleWorldMixin`, `RuleBuilderLogicMixin`, `_LogicMixinMeta`, `_import_logic_mixin`) — move into a separate module (e.g. `rule_builder/world_mixin.py`). The only upstream touch-point is whatever currently imports them.

### What unavoidably edits upstream `rules.py` (interleaved)
- Additive methods on base `Rule`/`Rule.Resolved`: `get_value`, `get_count`, `_get_args_dict`, `_rule_class_name`, `__lshift__`. (Additive — low conflict, but they live inside the class.)
- `to_dict()` empty-field slimming, `__init_subclass__` module guard, `resolve()` false-case — small targeted edits.
- The dynamic-count integration on `Has`/`HasFromList`/etc. — **only if** §6 is resolved in favor of options 1 or 2.

### Other touch-points outside the package
- `BaseClasses.py` and `worlds/AutoWorld.py` integration (the fork's existing edits, see `upstream-rule-builder-changes.md`).
- `__init__.py` export surface (165 lines) — straightforward to recreate.
- **158 importers** of `from rule_builder import ...` across the repo currently break against the clean base until the fork-only names are re-exported. The overlay must restore the full `__init__.py` surface before the wider codebase compiles.

### Rough effort
- **Mechanical / low-risk:** support modules + new rule-classes file + mixin file + `__init__.py` re-export. A few focused sessions.
- **Intrusive / needs design sign-off:** base-class method additions and the §6 FieldResolver reconciliation. This is where most of the real work and risk lives.
- **Plus:** absorb upstream's new `AtLeast` (§2b) and re-verify the export round-trip (`exporter` ↔ `world_generator`) against any JSON-shape changes from §6.

---

## 8. Remaining intentional differences (no upstream-compat impact)

1. `caching_enabled` default `True` vs `False` (guarded by `getattr`).
2. `to_dict()` omitting empty fields (smaller JSON).
3. `resolve()` false case using `world.false_rule` (perf).
4. `<<` operator (fork convenience).
5. `__init_subclass__` broader module guard (allows `rule_builder.*` submodules).
6. Legacy `_simplify_and` / `_simplify_or` kept for external callers (exporter).

---

## 9. Game-specific custom rules: auto-extraction into frontend helpers (Phase 7)

Upstream `rule_builder` lets a world define its own `Rule` subclass whose logic
lives in a compiled `Resolved._evaluate(self, state)` method. The motivating
example was Baba Is You's `HasBlossoms` (its apworld lives in
`custom_worlds_disabled/baba_is_you.apworld`); the **in-repo regression fixture**
is `worlds/rulebuilder_test` — a tiny hidden world whose `HasTreasure`
(`worlds/rulebuilder_test/custom_rules.py`) exercises the same path, plus the rest
of the rule_builder vocabulary, through a frontend spoiler test. The Baba rule:

```python
class HasBlossoms(Rule[TWorld], game="Baba Is You"):
    count: int | FieldResolver = 0
    class Resolved(Rule.Resolved):
        count: int = 0
        def _evaluate(self, state):
            petals = state.count("Blossom Petal", self.player)
            blossoms = state.count("Blossom", self.player) + (petals // 8)
            return blossoms >= self.count
```

**The problem.** Such a rule serialized to an opaque `{"rule": "HasBlossoms"}`
leaf. The frontend rule engine is *generically* capable (it evaluates arbitrary
helper bodies — arithmetic incl. `//`, loops, builtins — via
`frontend/modules/shared/ruleEngine/astHelpers.js`), but it was never *given* a
body for custom rules, so it returned `undefined` (≈ false) and Baba's frontend
spoiler test stalled at sphere 0. The gap is therefore **export-side, not a
missing frontend evaluator**: nothing taught the exporter to turn a custom
`Rule._evaluate` into a helper body, and the resolved `to_dict()` even dropped the
rule's args.

**The fix (two export-side changes, commit `4e0f79933`).**

1. **`rule_builder/rules.py` — args survive serialization.** The resolved
   `to_dict()` uses `_get_args_dict()`, whose base default returned `{}`, so a
   custom rule that doesn't override it serialized *without its fields* (e.g.
   `count` was dropped). The base `Rule.Resolved._get_args_dict()` now
   auto-serializes the rule's own dataclass fields (skipping `player` /
   `caching_enabled`; `FieldResolver` values via `.to_dict()`) **gated on
   `self._rule_class_name not in DEFAULT_RULES`**, so base rules are completely
   unchanged. `HasBlossoms.Resolved(count=3)` now emits
   `{"rule": "HasBlossoms", "args": {"count": 3}}`. (Cross-reference: this is the
   companion to the per-rule `_get_args_dict()` overrides in §5 / `Resolved` inner
   classes — base rules override explicitly; custom rules get the auto default.)

2. **`exporter/games/base/helper_discovery.py` — extract `_evaluate` into a
   helper.** `_analyze_custom_rules(world)` enumerates a world's custom rules via
   `CustomRuleRegister.custom_rules[world.game]`; `_build_custom_rule_helper_def`
   reads `Resolved._evaluate`'s source, rewrites `self.player` → `player` and each
   `self.<field>` → the bare parameter name (`_SelfAttrRewriter`), synthesizes a
   `def _custom_rule(state, player, *fields)` and feeds it through the **existing
   `analyze_rule` pipeline** — the same one used for worldgen helper functions
   (`_analyze_worldgen_helpers`). The result is keyed by the rule's qualname into
   the `helpers` section, which matches the `"rule"` value on the rule node, so the
   frontend's generic helper machinery evaluates it with zero frontend changes.
   Rules that can't be analyzed (an unmappable `self.<attr>`, an odd signature, an
   analyzer error) fall back to the opaque leaf — i.e. the pre-existing behaviour,
   so there is **no regression**. Wired into `get_helper_definitions` for both
   worldgen and non-worldgen worlds (seeded so it survives every early return).

**Verification.** Developed/verified against Baba (a real `export_game_rules` of a
solo Baba world emitted the `{"rule": "HasBlossoms", "args": {"count": N}}` nodes +
a `helpers[player]["HasBlossoms"]` definition; the unmodified frontend evaluator
matched Python `_evaluate` on all 40 inventory/threshold combinations incl. the
`petals // 8` division; full Baba spoiler test passed 27.2/27.2 spheres). The
permanent in-repo guard is `worlds/rulebuilder_test` (frontend spoiler test passes
3.1/3.1 spheres; `worlds/rulebuilder_test/test/` adds Python-side regression
checks). 143 rule_builder + 210 exporter tests pass.

**Bonus fix surfaced by the fixture.** Building `rulebuilder_test` exposed that
`OptionValue.Resolved` had no `_get_args_dict()` override (it is in `DEFAULT_RULES`,
so the auto-emit above does not apply) — the resolved rule serialized to a bare
`{"rule": "OptionValue"}` and dropped its option name, so a `Conditional` driven by
`OptionValue` mis-evaluated on the frontend. Fixed by adding the override
(`rule_builder/extra_rules.py`) → `{"rule": "OptionValue", "args": {"option": "<name>"}}`.
