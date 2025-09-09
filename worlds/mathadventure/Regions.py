from BaseClasses import MultiWorld, Region, Entrance
from Options import PerGameCommonOptions
from .Locations import location_table, MathProofLocation


def create_regions(options: PerGameCommonOptions, multiworld: MultiWorld, player: int) -> None:
    # Create all regions
    menu = Region("Menu", player, multiworld)
    menu.exits.append(Entrance(player, "StartProof", menu))
    multiworld.regions.append(menu)
    
    definitions = Region("Definitions", player, multiworld)
    definitions.exits.append(Entrance(player, "ToAxioms", definitions))
    definitions.exits.append(Entrance(player, "ToBasicProperties", definitions))
    definitions.exits.append(Entrance(player, "ToOperations", definitions))
    multiworld.regions.append(definitions)
    
    axioms = Region("Axioms", player, multiworld)
    axioms.exits.append(Entrance(player, "BackToDefinitions", axioms))
    multiworld.regions.append(axioms)
    
    basic_properties = Region("BasicProperties", player, multiworld)
    basic_properties.exits.append(Entrance(player, "BackToDefinitionsFromProperties", basic_properties))
    multiworld.regions.append(basic_properties)
    
    arithmetic_operations = Region("ArithmeticOperations", player, multiworld)
    arithmetic_operations.exits.append(Entrance(player, "ToProofCompletion", arithmetic_operations))
    multiworld.regions.append(arithmetic_operations)
    
    proof_completion = Region("ProofCompletion", player, multiworld)
    multiworld.regions.append(proof_completion)
    
    # Add locations to regions
    for name, location_data in location_table.items():
        r = multiworld.get_region(location_data.region, player)
        math_proof_loc = MathProofLocation(player, location_data.name, location_data.location_id, r)
        r.locations.append(math_proof_loc)
    
    # Connect regions
    multiworld.get_entrance("StartProof", player).connect(multiworld.get_region("Definitions", player))
    multiworld.get_entrance("ToAxioms", player).connect(multiworld.get_region("Axioms", player))
    multiworld.get_entrance("ToBasicProperties", player).connect(multiworld.get_region("BasicProperties", player))
    multiworld.get_entrance("ToOperations", player).connect(multiworld.get_region("ArithmeticOperations", player))
    multiworld.get_entrance("BackToDefinitions", player).connect(multiworld.get_region("Definitions", player))
    multiworld.get_entrance("BackToDefinitionsFromProperties", player).connect(multiworld.get_region("Definitions", player))
    multiworld.get_entrance("ToProofCompletion", player).connect(multiworld.get_region("ProofCompletion", player))