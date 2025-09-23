from typing import List, Dict, Set, Optional
from BaseClasses import MultiWorld, CollectionState
from worlds.generic.Rules import set_rule

class ProofStatement:
    """Represents a single statement in a metamath proof."""

    def __init__(self, index: int, label: Optional[str], expression: str, dependencies: List[int]):
        self.index = index  # Statement number (1-based)
        self.label = label  # Optional theorem/axiom name
        self.expression = expression  # The mathematical expression
        self.dependencies = dependencies  # List of statement indices this depends on

class ProofStructure:
    """
    Manages the dependency structure of a metamath proof.
    Similar to jigsaw's PuzzleBoard but for logical dependencies.
    """

    def __init__(self):
        self.statements: Dict[int, ProofStatement] = {}
        self.dependency_graph: Dict[int, Set[int]] = {}
        self.reverse_dependencies: Dict[int, Set[int]] = {}

    def add_statement(self, statement: ProofStatement):
        """Add a statement to the proof structure."""
        self.statements[statement.index] = statement
        self.dependency_graph[statement.index] = set(statement.dependencies)

        # Build reverse dependency graph
        for dep in statement.dependencies:
            if dep not in self.reverse_dependencies:
                self.reverse_dependencies[dep] = set()
            self.reverse_dependencies[dep].add(statement.index)

    def can_prove_statement(self, statement_index: int, available_statements: Set[int]) -> bool:
        """Check if a statement can be proven given available statements."""
        if statement_index not in self.dependency_graph:
            return False
        required = self.dependency_graph[statement_index]
        return required.issubset(available_statements)

    def get_provable_statements(self, available_statements: Set[int]) -> Set[int]:
        """Get all statements that can be proven with available statements."""
        provable = set()
        for stmt_index in self.statements:
            if stmt_index not in available_statements:
                if self.can_prove_statement(stmt_index, available_statements):
                    provable.add(stmt_index)
        return provable

def set_metamath_rules(world, proof_structure: ProofStructure):
    """Set access rules for metamath locations based on proof dependencies."""

    for location in world.multiworld.get_locations(world.player):
        if location.name.startswith("Prove Statement "):
            # Extract statement number from location name
            stmt_num = int(location.name.split()[-1])

            if stmt_num in proof_structure.dependency_graph:
                dependencies = proof_structure.dependency_graph[stmt_num]

                # Create rule: player must have all dependent statements as items
                def make_rule(deps):
                    def rule(state: CollectionState) -> bool:
                        return all(
                            state.has(f"Statement {dep}", world.player)
                            for dep in deps
                        )
                    return rule

                if dependencies:  # Only set rule if there are dependencies
                    set_rule(location, make_rule(dependencies))

def get_2p2e4_proof() -> ProofStructure:
    """Returns the proof structure for 2 + 2 = 4."""
    structure = ProofStructure()

    # Step 1: Define 2 = (1 + 1) [df-2]
    structure.add_statement(ProofStatement(
        index=1, label="df-2",
        expression="2 = (1 + 1)",
        dependencies=[]
    ))

    # Step 2: (2 + 2) = (2 + (1 + 1)) [oveq2i]
    structure.add_statement(ProofStatement(
        index=2, label="oveq2i",
        expression="(2 + 2) = (2 + (1 + 1))",
        dependencies=[1]
    ))

    # Step 3: Define 4 = (3 + 1) [df-4]
    structure.add_statement(ProofStatement(
        index=3, label="df-4",
        expression="4 = (3 + 1)",
        dependencies=[]
    ))

    # Step 4: Define 3 = (2 + 1) [df-3]
    structure.add_statement(ProofStatement(
        index=4, label="df-3",
        expression="3 = (2 + 1)",
        dependencies=[]
    ))

    # Step 5: (3 + 1) = ((2 + 1) + 1) [oveq1i]
    structure.add_statement(ProofStatement(
        index=5, label="oveq1i",
        expression="(3 + 1) = ((2 + 1) + 1)",
        dependencies=[4]
    ))

    # Step 6: 2 is a complex number [2cn]
    structure.add_statement(ProofStatement(
        index=6, label="2cn",
        expression="2 ∈ ℂ",
        dependencies=[]
    ))

    # Step 7: 1 is a complex number [ax-1cn]
    structure.add_statement(ProofStatement(
        index=7, label="ax-1cn",
        expression="1 ∈ ℂ",
        dependencies=[]
    ))

    # Step 8: ((2 + 1) + 1) = (2 + (1 + 1)) [addassi]
    structure.add_statement(ProofStatement(
        index=8, label="addassi",
        expression="((2 + 1) + 1) = (2 + (1 + 1))",
        dependencies=[6, 7]
    ))

    # Step 9: 4 = (2 + (1 + 1)) [3eqtri]
    structure.add_statement(ProofStatement(
        index=9, label="3eqtri",
        expression="4 = (2 + (1 + 1))",
        dependencies=[3, 5, 8]
    ))

    # Step 10: Final theorem (2 + 2) = 4 [eqtr4i]
    structure.add_statement(ProofStatement(
        index=10, label="2p2e4",
        expression="(2 + 2) = 4",
        dependencies=[2, 9]
    ))

    return structure

def parse_metamath_proof(proof_data: str) -> ProofStructure:
    """
    Parse metamath proof data into a ProofStructure.
    For now, returns the hardcoded 2p2e4 proof.
    """
    # TODO: Implement actual metamath parsing using metamathpy
    # For now, return the 2p2e4 proof
    return get_2p2e4_proof()