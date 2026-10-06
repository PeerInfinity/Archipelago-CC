"""Hero Core game-specific export handler (community apworld by MinishLink, worlds/herocore).

The apworld wraps every rule one level deep:
- exits:     `lambda state, tempdata=exitdata: tempdata.logic(world, state)`        (Regions.py)
- locations: `lambda state, temploc=loc: loc_table[temploc.name].logic(self, state)` (__init__.py set_rules)
where each `logic` is a `lambda world, state: ...` in Data/RegData.py or Data/LocData.py that reads the Names modules
(`ItemNames.Saves["A,8"]`, ...). The generic analyzer exports the inner lambda unexpanded (an `AST_lambda` rule the
frontend cannot evaluate), so this handler hands the analyzer the inner `logic` lambdas directly, with `world` bound
and the Names modules injected as closure variables.
"""

from typing import Any, Dict, Optional

from ..base import GenericGameExportHandler


class HeroCoreExportHandler(GenericGameExportHandler):
    """Export handler for Hero Core."""

    CLOSURE_VAR_IMPORTS = {
        "worlds.herocore.Names": ["ItemNames", "LocNames", "RegNames"],
    }

    @staticmethod
    def _inner_logic(rule_func: Any) -> Optional[Any]:
        """The `logic` lambda behind an exit rule's `tempdata` default argument."""
        for d in getattr(rule_func, "__defaults__", None) or ():
            logic = getattr(d, "logic", None)
            if callable(logic):
                return logic
        return None

    @staticmethod
    def _strip_lambda(rule: Any) -> Any:
        """Analyzing a `lambda world, state: body` directly yields a lambda node; the rule is its body."""
        while isinstance(rule, dict) and rule.get("type") == "lambda" and "body" in rule:
            rule = rule["body"]
        return rule

    @classmethod
    def _resolve_option_values(cls, rule: Any, world: Any) -> Any:
        """`world.options.<name>.value` inside a count table (has_all_counts) stays symbolic; it is fixed per seed."""
        if isinstance(rule, dict):
            obj = rule.get("object")
            if (rule.get("type") == "attribute" and rule.get("attr") == "value" and isinstance(obj, dict)
                    and obj.get("type") == "option_value" and hasattr(world.options, obj.get("option", ""))):
                return getattr(world.options, obj["option"]).value
            return {k: cls._resolve_option_values(v, world) for k, v in rule.items()}
        if isinstance(rule, list):
            return [cls._resolve_option_values(v, world) for v in rule]
        return rule

    def _analyze_logic(self, logic: Any, world: Any) -> Optional[Dict[str, Any]]:
        from exporter.analyzer import analyze_rule

        closure = self.prepare_closure_vars(logic, {"world": world})
        rule = self._strip_lambda(analyze_rule(rule_func=logic, closure_vars=closure, game_handler=self))
        return self._resolve_option_values(rule, world)

    def _world(self, rule_func: Any) -> Any:
        closure = getattr(rule_func, "__closure__", None) or ()
        names = getattr(getattr(rule_func, "__code__", None), "co_freevars", ())
        for name, cell in zip(names, closure):
            if name in ("world", "self"):
                return cell.cell_contents
        return None

    def handle_complex_exit_rule(self, exit_name: Optional[str], rule_func: Any) -> Optional[Dict[str, Any]]:
        logic = self._inner_logic(rule_func)
        world = self._world(rule_func)
        if logic is None or world is None:
            return None
        return self._analyze_logic(logic, world)

    def handle_complex_entrance_rule(self, entrance_name: Optional[str], rule_func: Any) -> Optional[Dict[str, Any]]:
        return self.handle_complex_exit_rule(entrance_name, rule_func)

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        from worlds.herocore.Data import LocData

        difficulty = world.options.difficulty
        table = {
            difficulty.option_normal: LocData.locations_normal,
            difficulty.option_hard: LocData.locations_hard,
            difficulty.option_annihilation: LocData.locations_annihilation,
        }.get(difficulty.value)
        data = table.get(location.name) if table else None
        if data is None:
            return None
        return self._analyze_logic(data.logic, world)
