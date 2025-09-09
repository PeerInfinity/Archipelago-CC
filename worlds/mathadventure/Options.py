from dataclasses import dataclass
from Options import Toggle, Choice, PerGameCommonOptions


class RandomizeItems(Toggle):
    """
    Enable item randomization. When disabled, all items will remain in their original locations.
    """
    display_name = "Randomize Items"
    default = True


class ProofComplexity(Choice):
    """
    Adjusts the complexity of required proofs.
    Simple: Only basic definitions and axioms required
    Normal: Standard proof requirements
    Complex: All proofs including advanced ones required
    """
    display_name = "Proof Complexity"
    option_simple = 0
    option_normal = 1
    option_complex = 2
    default = 1


class HintComplexity(Choice):
    """
    Controls how many hints are available in the game.
    None: No hints provided
    Basic: Simple hints for key theorems
    Full: Comprehensive hints for all proofs
    """
    display_name = "Hint Complexity"
    option_none = 0
    option_basic = 1
    option_full = 2
    default = 1


class RequireAllProofs(Toggle):
    """
    When enabled, all proofs must be collected to complete the game.
    When disabled, only the proofs required to reach the goal are necessary.
    """
    display_name = "Require All Proofs"
    default = False


@dataclass
class MathProof2p2e4Options(PerGameCommonOptions):
    randomize_items: RandomizeItems
    proof_complexity: ProofComplexity
    hint_complexity: HintComplexity
    require_all_proofs: RequireAllProofs