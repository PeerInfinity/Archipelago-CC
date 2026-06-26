# Rule-Arg Upstream Naming Alignment

**Status:** Phases 0–3 done & committed (`d0413b884`, `6b94bb96a`, `f3b198564`). Phase 4 (full preset regen) pending — to run via the Generate Presets pipeline. Phase 5 (drop fork-key fallback) deferred until presets are regenerated.
**Owner:** —
**Created:** 2026-06-26
**Related:** `docs/json/developer/diffs/rule-builder/fork-vs-upstream-rule-builder.md`, commit `015705b33` (the `_get_args_dict` restoration that surfaced this divergence)

## Goal

Rename the fork's rule-argument keys in the exported `rules.json` format to match
upstream Archipelago's names, so the two serialization conventions stop diverging:

| Rule(s) | Fork key (now) | Upstream key (target) | Shape |
|---|---|---|---|
| `HasAll`, `HasAny`, `HasFromList`, `HasFromListUnique` | `items` | `item_names` | list |
| `HasAllCounts`, `HasAnyCount` | `items` | `item_counts` | dict (`{name: count}`) |
| `HasGroup`, `HasGroupUnique` | `group` | `item_name_group` | string |
| (`count`) | `count` | `count` | **already matches — no change** |

### Why

- **Round-trip symmetry.** `rule_builder/rules.py`'s `from_dict()` *already* reads the
  upstream keys (`item_names` / `item_counts` / `item_name_group`). Today the fork's
  `Resolved.to_dict()` emits `items` / `group`, so the exporter's own output is **not**
  round-trippable through its own `from_dict()`. The rename closes that gap.
- **Reduced divergence** in the upstream-tracked `rules.py`, easing future re-bases.
- **Migration already started on the read side:** the frontend evaluator and `commonUI`
  already dual-read both names (`args.items || args.item_names`, `args.group ||
  args.item_name_group`), and `CountFromList` already *prefers* `item_names`.

## Scoping caveat: two formats, only ONE in scope

The tokens `items` / `group` appear in **two different serialization formats**. Only the
first is in scope:

1. **rule_builder format** — `{"rule":"HasGroup","args":{"group":...}}` ← **rename this.**
2. **AST format** — `{"type":"group_check","group":...}` ← **fork-internal intermediate;
   upstream has no AST format, so there is nothing to "match."** Leave it alone.

Out-of-scope AST-format producers (do **not** touch): `exporter/analyzer/ast_visitors/
call_visitor.py:1678,1715` (`group_check`/`group_count`), `exporter/converter/
python_to_json.py:422-450`, `rule_builder/ast_format.py`, `rule_builder/ast_explain.py`.
The only converter touchpoint is its **rule_builder-emitting** side (AST→RB), which maps
the AST `group` onto the RB arg key — that key is what changes.

Schema impact: **none.** `frontend/schema/rules.schema.json`'s `ruleBuilderRule.args` is
free-form (`additionalProperties: true`); it does not pin `items`/`group`.

## Strategy: dual-read first, then flip producers, then regen

The frontend already dual-reads, so the safe, no-flag-day path is:

1. Make **all consumers** accept both keys (prefer upstream, fall back to fork).
2. Flip **all producers** to emit upstream keys (can be staged — consumers tolerate either).
3. Regenerate **all presets** (already planned).
4. *(Optional, later)* drop the fork-key fallback once no preset emits the old keys.

`from_dict()` needs **no change** — it already reads upstream keys.

---

## Phases

### Phase 0 — Precondition: prune `exporter/games/unofficial/`

Delete every file in `exporter/games/unofficial/` **except** `toem_original.py`,
`toem_rule_builder.py`, and `__init__.py` (32 files removed). This removes 9 hand-written
producers of `items`/`group` from the rename surface: `anodyne`, `lingo2`, `minishoot`,
`rain_world`, `sonic1`, `soulblazer`, `minit`, `ss2`, `pseudoregalia` (plus ~23 other
unofficial handlers with no rule-arg producers).

- **Safe mechanically:** handler discovery is by module name; `get_handler` falls back to
  `GenericGameExportHandler` when no module matches (`exporter/games/__init__.py:192-198`).
  Deleted-handler games export via the generic AST path instead.
- **TOEM kept:** `toem_*` are rule_builder-based and produce **no** hand-written rule args;
  they are referenced in `scripts/data/world-mapping.json` and must stay.
- **Cleanup:** remove the corresponding `exporter_path` entries from
  `scripts/data/world-mapping-unofficial.json` (31 entries point into the deleted files).
  Confirm nothing reads `exporter_path` at runtime (discovery is by module auto-import, not
  by this field) — the chart/doc scripts that mention `world-mapping-unofficial.json` read
  the mapping, not the exporter files.

**Risk:** games whose custom handler existed *because* the generic path was wrong will now
export via the generic path and may produce different/degraded rules. The full preset regen
(Phase 4) surfaces these as diffs; user has accepted dropping these custom exporters.

**Verify:** `python -c "import exporter.games"` discovers handlers without error; export a
couple of affected games (e.g. `Anodyne`, `Minishoot`) and confirm they still generate.

### Phase 1 — Consumer dual-read

Make consumers prefer the upstream key, fall back to the fork key. No behavior change.

**`world_generator/` (~20 sites)** — currently `args.get('items', …)` / `args.get('group', …)`:
- `_helper_statements.py:425,432,439,450` (`items`), `775,784` (`group`)
- `_rule_expressions.py:238,247,256` (`items`; `256` is the dict form), `264,274,515` (`group`), `284,308` (`items`)
- `_rule_converters.py:69,91` (`items`), `131,154` (`group`)
- `_helper_expressions.py:505,1383` (`group`)
- Pattern: `args.get('item_names', args.get('items', default))`; for counts use
  `args.get('item_counts', args.get('items', {}))`; for group `args.get('item_name_group',
  args.get('group', ''))`. Consider a small shared helper in `world_generator` to avoid
  repeating the fallback at every site.

**Frontend (already dual-read — verify, no change expected):**
- `frontend/modules/shared/ruleEngine/ruleBuilderEvaluator.js:246,261,277,289,303,323,343,351,970`
- `frontend/modules/commonUI/commonUI.js:2075,2082,2089,2097,2105,2113,2121,2132,2699,2706`

**Frontend (read/write fork key only — ADD fallback / switch to upstream key):**
- `frontend/modules/apworldEditor/ruleTreeEditor.js:42,265-293` — **writes** `{items:[]}` and
  mutates `args.items`. This is an authoring surface: switch new-rule creation to write
  `item_names` (and read either when editing existing rules).
- `frontend/modules/apworldEditor/rulesUtils.js:93-95,215` — item-rename + validation; read both.
- `frontend/modules/mazeRoom/mazeRoomVisualizer.js:657-658`, `mazeRoom/mazeRoomUI.js:3759-3760`
  — display only; read both.
- `frontend/modules/pathAnalyzer/pathAnalyzerLogic.js:1125-1126,1150` — read both.

### Phase 2 — Flip producers to emit upstream keys

- **`rule_builder/rules.py`** — the 11 `_get_args_dict()` overrides (restored in `015705b33`):
  `items`→`item_names` (HasAll, HasAny, HasFromList, HasFromListUnique),
  `items`(dict)→`item_counts` (HasAllCounts, HasAnyCount),
  `group`→`item_name_group` (HasGroup, HasGroupUnique).
  **Update the regression test** `test_json/rule_builder/test_rules.py::TestResolvedToDictArgs`
  expectations in lockstep.
- **`exporter/converter/ast_to_rule_builder.py`** — RB-emitting sites: `507,515` (`items`),
  `520` (`items` dict → `item_counts`), `525,530` (`items`+`count`), `535,638,645` (`group`),
  `747,832,880` (`items` in AND/OR optimizations). Also the canonical sort at `236-237`
  (keyed on `args.get('items')`).
- **`exporter/analyzer/closure_function_analyzer.py:737,850`** — HasAny `items`.
- **Official game handlers (only two produce rule-arg items):**
  `exporter/games/official/ffmq.py:172,194,286,321`, `exporter/games/official/satisfactory.py:56,63`.
  (alttp/smz3/ladx/lingo/messenger `items` usages are progressive-item / AST-`counts` /
  custom access-requirement data — **out of scope**.)
- **Kept unofficial handlers:** `toem_*` produce no rule args — nothing to change.

### Phase 3 — Tests

Update fixtures/assertions that hard-code `items`/`group` rule args:
- Python: `test_json/rule_builder/test_rules.py`, `test_json/rule_builder/test_ast_format.py`,
  `test_json/exporter/converter/test_round_trip.py`, `test_json/exporter/analyzer/
  test_expression_resolver.py`, `test_json/exporter/analyzer/visitors/test_call_visitor.py`,
  `test_json/test_rule_fixtures.py`, `test_json/fixtures/rules.py`,
  `exporter/converter/test_*.py`. (Distinguish AST-format fixtures, which keep `group`/`items`.)
- Frontend: `procgenPipeline/procgenPipelineEngine.test.js:1873,2530,2553`,
  `shared/procgen/library.test.js:194,197`, `procgenPipeline/ruleRequirements.test.js:36`.

### Phase 4 — Regenerate all presets

Run the full Generate Presets pipeline. 206/254 `rules.json` contain these rules, so expect
broad (but mechanical) diffs: `"items"`→`"item_names"`, `"group"`→`"item_name_group"`,
`"items"`(dict)→`"item_counts"`. Re-baseline canonical/byte-identical preset tests.

### Phase 5 — *(Optional, later)* Drop fork-key fallback

Once no committed preset emits `items`/`group`, remove the `|| args.items` / `|| args.group`
fallbacks from consumers and the regression test's tolerance, leaving upstream keys only.

---

## File inventory (quick reference)

**Producers (→ emit upstream keys):**
- `rule_builder/rules.py` (11 overrides)
- `exporter/converter/ast_to_rule_builder.py` (~11 sites)
- `exporter/analyzer/closure_function_analyzer.py` (2 sites)
- `exporter/games/official/ffmq.py` (4), `…/satisfactory.py` (2)

**Consumers (→ dual-read):**
- `world_generator/`: `_helper_statements.py`, `_rule_expressions.py`, `_rule_converters.py`, `_helper_expressions.py`
- frontend evaluator + commonUI (already done), editor (`ruleTreeEditor.js`, `rulesUtils.js`), visualizers (`mazeRoom*`), `pathAnalyzerLogic.js`

**No change:** `rule_builder/rules.py::from_dict` (already upstream-keyed), schema, AST-format producers.

## Risks

- **Missed producer** emitting an old key → handled by consumer dual-read (Phase 1 before Phase 2).
- **`item_counts` dict form** (HasAllCounts/HasAnyCount): different key *and* dict shape —
  verify producers/consumers treat it as `{name: count}` consistently.
- **Generic-export drift** for deleted unofficial games (Phase 0) — surfaced by the regen diff.
- **Preset diff volume** (206 files) — expected; verify diffs are key-renames only, not logic changes.

## Open questions

- Confirm there is no runtime consumer of `exporter_path` before pruning
  `world-mapping-unofficial.json`.
- Decide whether to keep the dual-read fallback long-term (Phase 5) or commit to upstream-only
  immediately after regen.
