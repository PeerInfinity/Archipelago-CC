from BaseClasses import Location
from typing import Dict

base_location_id = 200000000


class MathProofLocation(Location):
    game: str = "MathProof2p2e4"


class LocationData:
    def __init__(self, region: str, name: str, location_id: int = None, event: bool = False):
        self.region: str = region
        self.name: str = name
        self.location_id: int = location_id
        self.event: bool = event


location_table: Dict[str, LocationData] = {
    # Definitions region
    "Definition of 2": LocationData("Definitions", "Definition of 2", 200000001),
    "Definition of 3": LocationData("Definitions", "Definition of 3", 200000002),
    "Definition of 4": LocationData("Definitions", "Definition of 4", 200000003),
    
    # Axioms region
    "1 is Complex": LocationData("Axioms", "1 is Complex", 200000004),
    
    # BasicProperties region
    "2 is Complex": LocationData("BasicProperties", "2 is Complex", 200000005),
    
    # ArithmeticOperations region
    "Equality Substitution Right": LocationData("ArithmeticOperations", "Equality Substitution Right", 200000006),
    "Equality Substitution Left": LocationData("ArithmeticOperations", "Equality Substitution Left", 200000007),
    "Addition Associativity": LocationData("ArithmeticOperations", "Addition Associativity", 200000008),
    
    # ProofCompletion region
    "Triple Equality Transitivity": LocationData("ProofCompletion", "Triple Equality Transitivity", 200000009),
    "Final Equality": LocationData("ProofCompletion", "Final Equality", 200000010),
    
    # Victory event location
    "Theorem: 2+2=4": LocationData("ProofCompletion", "Theorem: 2+2=4", None, event=True),
}

# Create reverse mapping for lookup
location_id_to_name: Dict[int, str] = {data.location_id: name for name, data in location_table.items() if data.location_id is not None}