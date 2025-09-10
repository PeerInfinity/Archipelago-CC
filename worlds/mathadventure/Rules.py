from worlds.generic.Rules import add_rule, set_rule


def set_rules(world_instance) -> None:
    world = world_instance.multiworld
    player = world_instance.player
    
    # Entrance access rules
    # ToOperations entrance (requires df-2 OR df-3)
    set_rule(world.get_entrance("ToOperations", player),
             lambda state: state.has("df-2", player) or state.has("df-3", player))
    
    # ToProofCompletion entrance (requires oveq2i AND addassi)
    set_rule(world.get_entrance("ToProofCompletion", player),
             lambda state: state.has("oveq2i", player) and state.has("addassi", player))
    
    # Location access rules
    # ArithmeticOperations locations
    # Equality Substitution Right requires df-2
    set_rule(world.get_location("Equality Substitution Right", player),
             lambda state: state.has("df-2", player))
    
    # Equality Substitution Left requires df-3
    set_rule(world.get_location("Equality Substitution Left", player),
             lambda state: state.has("df-3", player))
    
    # Addition Associativity requires 2cn AND ax-1cn
    set_rule(world.get_location("Addition Associativity", player),
             lambda state: state.has("2cn", player) and state.has("ax-1cn", player))
    
    # ProofCompletion locations
    # Triple Equality Transitivity requires df-4 AND oveq1i AND addassi
    set_rule(world.get_location("Triple Equality Transitivity", player),
             lambda state: state.has("df-4", player) and 
                          state.has("oveq1i", player) and 
                          state.has("addassi", player))
    
    # Final Equality requires oveq2i AND 3eqtri
    set_rule(world.get_location("Final Equality", player),
             lambda state: state.has("oveq2i", player) and state.has("3eqtri", player))
    
    # Victory location: Theorem: 2+2=4 requires eqtr4i
    set_rule(world.get_location("Theorem: 2+2=4", player),
             lambda state: state.has("eqtr4i", player))