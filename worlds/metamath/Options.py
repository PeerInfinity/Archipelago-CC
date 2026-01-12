from dataclasses import dataclass
from Options import Choice, Range, TextChoice, Toggle, PerGameCommonOptions, OptionGroup
from typing import Dict

class RandomizeItems(Toggle):
    """
    Enable item randomization. When disabled, all items will remain in their original locations
    (proof statements will be at their corresponding theorem locations).
    """
    display_name = "Randomize Items"
    default = True

class TheoremSelection(TextChoice):
    """
    The theorem to prove. Select from common theorems or enter any theorem name
    from the metamath database. You can also use a URL to a proof on the metamath
    website (e.g., https://us.metamath.org/mpeuni/2p2e4.html).
    """
    display_name = "Theorem to Prove"

    # Arithmetic proofs (Easy)
    option_1p1e2 = 0    # 1 + 1 = 2 (~2 steps)
    option_2p2e4 = 1    # 2 + 2 = 4 (~10 steps)
    option_3p3e6 = 2    # 3 + 3 = 6 (~12 steps)
    option_4p4e8 = 3    # 4 + 4 = 8 (~12 steps)
    option_5p5e10 = 4   # 5 + 5 = 10 (~12 steps)
    option_2m1e1 = 5    # 2 - 1 = 1 (~4 steps)

    # Logic proofs (Easy)
    option_pm2_21 = 6   # ¬φ → (φ → ψ) (~2 steps)
    option_pm2_43 = 7   # ((φ → (φ → ψ)) → (φ → ψ)) (~2 steps)
    option_pm5_32 = 8   # Complex biconditional (~9 steps)
    option_con3i = 9    # Contraposition (~3 steps)
    option_syl = 10     # Syllogism (~3 steps)

    # Set theory (Easy to Medium)
    option_uneq12i = 11  # Union equality (~3 steps)
    option_ineq12i = 12  # Intersection equality (~3 steps)
    option_pwfi = 13     # Power set finiteness (~15 steps)
    option_canth = 14    # Cantor's theorem (~20 steps)

    # Algebra (Medium)
    option_grplid = 15   # Group left identity (~6 steps)
    option_grpinveu = 16 # Group inverse uniqueness (~17 steps)

    # Analysis (Easy to Medium)
    option_cos0 = 17     # cos(0) = 1 (~12 steps)
    option_sin0 = 18     # sin(0) = 0 (~10 steps)

    # Number theory (Medium to Hard)
    option_euclemma = 19 # Euclid's lemma for primes (~16 steps)
    option_wilth = 20    # Wilson's theorem (~40 steps)

    # Very Hard
    option_dfac5 = 21    # Axiom of choice equivalence (~65 steps)

    # Note: prmunb and cncmp excluded due to UT compatibility issues

    default = 1  # 2p2e4

class ProofComplexity(Choice):
    """
    Controls how starting statements are selected.
    Simple: Starting statements are the first N statements in order
    Moderate: Starting statements are randomized from throughout the proof
    Complex: Starting statements are randomized from throughout the proof
    """
    display_name = "Proof Complexity"
    option_simple = 0
    option_moderate = 1
    option_complex = 2
    default = 1

class StartingStatements(Range):
    """
    Percentage of proof statements that are pre-unlocked at the start.
    Higher values make the proof easier to complete.
    """
    display_name = "Starting Statements %"
    range_start = 0
    range_end = 50
    default = 0

class AutoDownloadDatabase(Toggle):
    """
    Automatically download the metamath database (set.mm) if it's not found locally.
    The file is about 50MB and will be cached for future use.
    """
    display_name = "Auto-Download Database"
    default = 1

@dataclass
class MetamathOptions(PerGameCommonOptions):
    randomize_items: RandomizeItems
    theorem: TheoremSelection
    complexity: ProofComplexity
    starting_statements: StartingStatements
    auto_download_database: AutoDownloadDatabase

metamath_option_groups = [
    OptionGroup("Proof Settings", [
        RandomizeItems,
        TheoremSelection,
        ProofComplexity,
        StartingStatements,
        AutoDownloadDatabase
    ])
]