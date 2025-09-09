from worlds.generic.Rules import add_rule, set_rule


def set_rules(world_instance) -> None:
    world = world_instance.multiworld
    player = world_instance.player
    
    # Access rule for ToOperations entrance (requires df-2 OR df-3)
    set_rule(world.get_entrance("ToOperations", player),
             lambda state: state.has("df-2", player) or state.has("df-3", player))
    
    # Location access rules
    # Triple Equality Transitivity requires df-4 AND oveq1i AND addassi
    set_rule(world.get_location("Triple Equality Transitivity", player),
             lambda state: state.has("df-4", player) and 
                          state.has("oveq1i", player) and 
                          state.has("addassi", player))
    
    # Final Equality requires 3eqtri AND eqtr4i
    set_rule(world.get_location("Final Equality", player),
             lambda state: state.has("3eqtri", player) and 
                          state.has("eqtr4i", player))
    
    # Victory condition: Theorem: 2+2=4 requires specific items
    # Based on the mathematical proof structure, it requires:
    # - Definition of 2 (df-2)
    # - Definition of 4 (df-4)  
    # - Addition associativity (addassi)
    # - 2 is Complex (2cn)
    # - Equality transitive inference (eqtr4i)
    set_rule(world.get_location("Theorem: 2+2=4", player),
             lambda state: state.has("df-2", player) and
                          state.has("df-4", player) and
                          state.has("addassi", player) and
                          state.has("2cn", player) and
                          state.has("eqtr4i", player))