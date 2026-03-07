"""
Options for Journey to Ascension.
"""

from dataclasses import dataclass
from Options import DefaultOnToggle, PerGameCommonOptions, Range


class GoalZone(Range):
    """Which zone the player must reach to win.
    Only perks in zones before this zone are randomized."""
    display_name = "Goal Zone"
    range_start = 1
    range_end = 27
    default = 15


class ResetsPerSphere(Range):
    """Target number of energy resets the player must grind before their
    stats are high enough to reach the next perk unlock.
    Higher values = harder (more grinding between spheres).
    Lower values = easier (less grinding needed).
    Affects cost generation."""
    display_name = "Resets Per Sphere"
    range_start = 1
    range_end = 20
    default = 5


# --- Cost Generation Strategy Factors ---

class CostGenItemCollection(DefaultOnToggle):
    """Cost generator assumes the player collects items during runs."""
    display_name = "Cost Gen: Item Collection"


class CostGenPushCollect(DefaultOnToggle):
    """Cost generator assumes the player alternates between collection
    runs (save items) and push runs (consume all items)."""
    display_name = "Cost Gen: Push/Collect"


class CostGenXPGrinding(DefaultOnToggle):
    """Cost generator assumes the player grinds XP when unable to progress."""
    display_name = "Cost Gen: XP Grinding"


class CostGenGrindWithPushCollect(DefaultOnToggle):
    """Cost generator assumes push/collect alternation during XP grinding."""
    display_name = "Cost Gen: Grind with Push/Collect"


class CostGenArtifacts(DefaultOnToggle):
    """Cost generator assumes strategic artifact usage."""
    display_name = "Cost Gen: Artifact Usage"


# --- Automation Unlocks ---

class AutomationAutoQueue(DefaultOnToggle):
    """Allow the queue to auto-generate from strategy."""
    display_name = "Automation: Auto Queue"


class AutomationAutoReset(DefaultOnToggle):
    """Allow automatic energy reset when energy is depleted."""
    display_name = "Automation: Auto Reset"


class AutomationDrainStrategy(DefaultOnToggle):
    """Allow automatic task selection when the queue is exhausted."""
    display_name = "Automation: Drain Strategy"


class AutomationLoadoutSequencing(DefaultOnToggle):
    """Allow loadouts to automatically chain."""
    display_name = "Automation: Loadout Sequencing"


@dataclass
class JTAOptions(PerGameCommonOptions):
    goal_zone: GoalZone
    resets_per_sphere: ResetsPerSphere
    # Cost generation factors
    costgen_item_collection: CostGenItemCollection
    costgen_push_collect: CostGenPushCollect
    costgen_xp_grinding: CostGenXPGrinding
    costgen_grind_with_push_collect: CostGenGrindWithPushCollect
    costgen_artifacts: CostGenArtifacts
    # Automation unlocks
    automation_auto_queue: AutomationAutoQueue
    automation_auto_reset: AutomationAutoReset
    automation_drain_strategy: AutomationDrainStrategy
    automation_loadout_sequencing: AutomationLoadoutSequencing
