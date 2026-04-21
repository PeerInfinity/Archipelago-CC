from . import SeedlingTestBase
from ..Options import Difficulty, Ending


class StandardBloodyTest(SeedlingTestBase):
    options = {
        "ending": Ending.option_bloody,
        "difficulty": Difficulty.option_standard
    }

    ending_items = ["Progressive Sword", "Progressive Swim", "Ghost Spear", "Ghost Sword Fusion"]

    def test_ending_missing(self):
        self.collect_all_but(self.ending_items)
        self.assertBeatable(False)
        for item in self.ending_items:
            self.collect_by_name(item)
            self.assertBeatable(False)
            self.remove(self.get_item_by_name(item))

    def test_ending_minimal(self):
        self.collect_by_name(self.ending_items)
        self.assertBeatable(True)

    def test_ghost_spear(self):
        self.collect_by_name(["Progressive Swim", "Wand", "Fire"])
        self.assertFalse(self.can_reach_location("Ghost Spear"))
        self.collect_by_name(["Dark Suit", "Health"])
        self.assertFalse(self.can_reach_location("Ghost Spear"))
        self.collect_by_name(["Fire Wand Fusion"])
        self.assertTrue(self.can_reach_location("Ghost Spear"))

class StandardBloodlessTest(SeedlingTestBase):
    options = {
        "ending": Ending.option_bloodless,
        "difficulty": Difficulty.option_standard
    }

    ending_items = ["Progressive Sword", "Progressive Swim", "Ghost Spear", "Ghost Sword Fusion", "Seal"]

    def test_ending_missing(self):
        self.collect_all_but(self.ending_items)
        self.assertBeatable(False)
        for item in self.ending_items:
            self.collect_by_name(item)
            self.assertBeatable(False)
            self.remove(self.get_item_by_name(item))

    def test_ending_minimal(self):
        self.collect_by_name(self.ending_items)
        self.assertBeatable(True)


class StandardBloodlessBossTest(SeedlingTestBase):
    options = {
        "ending": Ending.option_bloodless,
        "difficulty": Difficulty.option_standard,
        "boss_locations": True
    }

    def test_boss_accessibility(self):
        sufficient_boss_items = ["Progressive Sword", "Progressive Swim", "Ghost Sword Fusion", "Ghost Spear",
                                 "Blue Key", "Green Key", "Dark Suit", "Yellow Key", "Wand", "Totem Shard"]
        bosses = ["Owl", "Shieldspire", "Times", "Totem of Lacste", "Tentacled Beast", "Lights", "King of Fire"]
        self.collect_all_but(sufficient_boss_items)
        for boss in bosses:
            self.assertFalse(self.multiworld.state.can_reach(boss, "Location", 1))
        self.collect_by_name(sufficient_boss_items)
        for boss in bosses:
            self.assertTrue(self.multiworld.state.can_reach(boss, "Location", 1))


class TrickyBloodyTest(SeedlingTestBase):
    options = {
        "ending": Ending.option_bloody,
        "difficulty": Difficulty.option_tricky
    }

    ending_items = ["Progressive Sword", "Ghost Spear", "Ghost Sword Fusion"]

    def test_ending_missing(self):
        self.collect_all_but(self.ending_items)
        self.assertBeatable(False)
        for item in self.ending_items:
            self.collect_by_name(item)
            self.assertBeatable(False)
            self.remove(self.get_item_by_name(item))

    def test_ending_minimal(self):
        self.collect_by_name(self.ending_items)
        self.assertBeatable(True)

    def test_ghost_spear(self):
        self.collect_by_name(["Progressive Swim", "Wand", "Fire"])
        self.assertFalse(self.can_reach_location("Ghost Spear"))
        self.collect_by_name(["Dark Suit", "Health"])
        self.assertTrue(self.can_reach_location("Ghost Spear"))
        self.collect_by_name(["Fire Wand Fusion"])
        self.assertTrue(self.can_reach_location("Ghost Spear"))


class TrickyBloodlessTest(SeedlingTestBase):
    options = {
        "ending": Ending.option_bloodless,
        "difficulty": Difficulty.option_tricky
    }

    ending_items = ["Progressive Sword", "Ghost Spear", "Progressive Swim", "Ghost Sword Fusion", "Seal"]

    def test_ending_missing(self):
        self.collect_all_but(self.ending_items)
        self.assertBeatable(False)
        for item in self.ending_items:
            self.collect_by_name(item)
            self.assertBeatable(False)
            self.remove(self.get_item_by_name(item))

    def test_ending_minimal(self):
        self.collect_by_name(self.ending_items)
        self.assertBeatable(True)


class UnreasonableBloodyTest(SeedlingTestBase):
    options = {
        "ending": Ending.option_bloody,
        "difficulty": Difficulty.option_unreasonable
    }

    def test_ghost_spear(self):
        self.collect_by_name(["Progressive Swim", "Wand", "Fire"])
        self.assertTrue(self.can_reach_location("Ghost Spear"))
        self.collect_by_name(["Dark Suit", "Health"])
        self.assertTrue(self.can_reach_location("Ghost Spear"))
        self.collect_by_name(["Fire Wand Fusion"])
        self.assertTrue(self.can_reach_location("Ghost Spear"))
