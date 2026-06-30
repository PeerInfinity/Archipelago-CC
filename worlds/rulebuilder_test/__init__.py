"""
Rule Builder Test — a tiny, hidden Archipelago world that exists purely to
exercise the rule_builder feature surface end-to-end (Python generation →
exporter → frontend evaluation), with emphasis on constructs that lacked
end-to-end coverage:

* a game-specific **custom Rule subclass** (``HasTreasure``) whose logic lives in
  a compiled ``Resolved._evaluate`` (integer division) — the in-repo regression
  test for the custom-rule auto-extraction feature (commit ``4e0f79933``);
* an upstream **FieldResolver** count (``FromOption``) — resolved to a concrete
  value at export — and the runtime ``OptionValue`` form inside a ``Conditional``;
* dynamic ``Has.count`` driven by ``CountItem`` / ``Arithmetic`` / ``MinValue`` /
  ``MaxValue``;
* ``Compare`` over ``CountItem`` / ``CountFromList``; ``AtLeast`` with mixed
  children; ``HasGroup``; and the ``Has`` / ``HasAll`` / ``HasAny`` basics.

The world is deterministic and always solvable: a set of *source* locations
(reachable from the start) hold the items that gate a set of *feature* locations,
each of which holds a Star; collecting every Star unlocks Victory. The seed is
small on purpose — the point is rule coverage, not puzzle depth.

It is hidden (no web presence), so it needs no webhost docs.
"""

from typing import Any, Dict

from BaseClasses import Item, ItemClassification, Location, Region
from worlds.AutoWorld import WebWorld, World
from rule_builder import (
    RuleWorldMixin,
    Has, HasAll, HasAny, HasGroup, AtLeast,
    Compare, Arithmetic, Conditional, MinValue, MaxValue,
    CountItem, CountFromList, OptionValue,
)
from rule_builder.field_resolvers import FromOption

from .Options import RuleBuilderTestOptions, CoinGoal
from .custom_rules import HasTreasure

GAME_NAME = "Rule Builder Test"
_BASE_ID = 313_800_000

# --- Item pool -------------------------------------------------------------
# name -> (count in pool, classification)
SOURCE_ITEMS: Dict[str, int] = {
    "Key": 1,
    "Coin": 3,
    "Red Gem": 1,
    "Blue Gem": 1,
    "Green Gem": 1,
    "Wallet": 2,
    "Sword": 1,
    "Token A": 1,
    "Token B": 1,
}

# Each feature location holds one Star; Victory needs them all.
FEATURE_RULES = "has has_all has_any at_least compare from_option count_from_list has_group conditional min_value arithmetic custom".split()
STAR_COUNT = len(FEATURE_RULES)

# Ordered item name list -> stable ids
_item_names = list(SOURCE_ITEMS.keys()) + [f"Star {i + 1}" for i in range(STAR_COUNT)]
item_name_to_id = {name: _BASE_ID + i for i, name in enumerate(_item_names)}

# Location names -> stable ids
_source_loc_names = [f"Source: {name} #{n + 1}"
                     for name, cnt in SOURCE_ITEMS.items() for n in range(cnt)]
_feature_loc_names = [f"Test: {rule}" for rule in FEATURE_RULES]
_location_names = _source_loc_names + _feature_loc_names
location_name_to_id = {name: _BASE_ID + i for i, name in enumerate(_location_names)}

ITEM_NAME_GROUPS = {"Gems": {"Red Gem", "Blue Gem", "Green Gem"}}


class RuleBuilderTestItem(Item):
    game = GAME_NAME


class RuleBuilderTestLocation(Location):
    game = GAME_NAME


class RuleBuilderTestWeb(WebWorld):
    game_info_languages = []
    tutorials = []


class RuleBuilderTestWorld(RuleWorldMixin, World):
    """A minimal world that exercises the rule_builder vocabulary end-to-end."""

    game = GAME_NAME
    options_dataclass = RuleBuilderTestOptions
    options: RuleBuilderTestOptions
    web = RuleBuilderTestWeb()
    hidden = True
    rule_caching_enabled = False
    origin_region_name = "Menu"

    item_name_to_id = item_name_to_id
    location_name_to_id = location_name_to_id
    item_name_groups = ITEM_NAME_GROUPS

    # --- world build -------------------------------------------------------
    def create_item(self, name: str) -> RuleBuilderTestItem:
        classification = (ItemClassification.progression
                          if name != "Filler" else ItemClassification.filler)
        return RuleBuilderTestItem(name, classification, item_name_to_id.get(name), self.player)

    def create_items(self) -> None:
        pool = []
        for name, count in SOURCE_ITEMS.items():
            pool += [self.create_item(name) for _ in range(count)]
        for i in range(STAR_COUNT):
            pool.append(self.create_item(f"Star {i + 1}"))

        # Balance the pool to the number of fillable (non-event) locations.
        fillable = len(_location_names)
        pool += [self.create_item("Filler") for _ in range(fillable - len(pool))]
        self.multiworld.itempool += pool

    def create_regions(self) -> None:
        menu = Region("Menu", self.player, self.multiworld)
        gauntlet = Region("Gauntlet", self.player, self.multiworld)

        # Source locations live in Menu (reachable from the start).
        for name in _source_loc_names:
            menu.locations.append(
                RuleBuilderTestLocation(self.player, name, location_name_to_id[name], menu))

        # Feature locations live in Gauntlet, reachable once Menu is.
        for name in _feature_loc_names:
            gauntlet.locations.append(
                RuleBuilderTestLocation(self.player, name, location_name_to_id[name], gauntlet))

        # Victory event in Menu.
        victory = RuleBuilderTestLocation(self.player, "Victory", None, menu)
        victory.place_locked_item(
            RuleBuilderTestItem("Victory", ItemClassification.progression, None, self.player))
        menu.locations.append(victory)

        menu.connect(gauntlet, "Menu -> Gauntlet")
        self.multiworld.regions += [menu, gauntlet]

    def set_rules(self) -> None:
        loc = lambda name: self.multiworld.get_location(name, self.player)

        # One representative rule per feature location. Each is satisfiable with
        # the source items, and monotonic (collecting items never removes access).
        self.set_rule(loc("Test: has"), Has("Key"))
        self.set_rule(loc("Test: has_all"), HasAll("Red Gem", "Blue Gem", "Green Gem"))
        self.set_rule(loc("Test: has_any"), HasAny("Sword", "Wand"))
        # AtLeast with mixed children (item check + comparison).
        self.set_rule(loc("Test: at_least"),
                      AtLeast(2, Has("Key"), Has("Sword"), Compare(CountItem("Coin"), ">=", 99)))
        # Compare over a CountItem (nested rule operand).
        self.set_rule(loc("Test: compare"), Compare(CountItem("Coin"), ">=", 3))
        # FieldResolver: count resolves to CoinGoal's value (default 3) at export.
        self.set_rule(loc("Test: from_option"), Has("Coin", count=FromOption(CoinGoal)))
        # Compare over a CountFromList.
        self.set_rule(loc("Test: count_from_list"),
                      Compare(CountFromList("Red Gem", "Blue Gem", "Green Gem"), ">=", 2))
        self.set_rule(loc("Test: has_group"), HasGroup("Gems", 2))
        # Conditional driven by an option read at runtime (OptionValue).
        self.set_rule(loc("Test: conditional"),
                      Conditional(OptionValue("hard_mode"), Has("Sword", count=2), Has("Sword")))
        # Dynamic count from MinValue/MaxValue of CountItem operands.
        self.set_rule(loc("Test: min_value"),
                      Has("Coin", count=MinValue(CountItem("Wallet"), CountItem("Coin"))))
        # Dynamic count from Arithmetic over a MaxValue of CountItem operands.
        self.set_rule(loc("Test: arithmetic"),
                      Has("Coin", count=Arithmetic(
                          MaxValue(CountItem("Token A"), CountItem("Token B")), "+", 1)))
        # Game-specific custom Rule subclass (compiled _evaluate, integer division).
        self.set_rule(loc("Test: custom"), HasTreasure(count=1))

        # Victory requires every Star.
        self.set_rule(loc("Victory"), HasAll(*[f"Star {i + 1}" for i in range(STAR_COUNT)]))
        self.multiworld.completion_condition[self.player] = \
            lambda state: state.has("Victory", self.player)

    def fill_slot_data(self) -> Dict[str, Any]:
        return {"coin_goal": self.options.coin_goal.value,
                "hard_mode": bool(self.options.hard_mode.value)}
