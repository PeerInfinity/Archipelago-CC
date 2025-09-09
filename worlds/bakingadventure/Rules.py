from BaseClasses import MultiWorld
from worlds.generic.Rules import set_rule


def set_rules(multiworld: MultiWorld, player: int) -> None:
    """Set access rules for entrances and locations based on JSON."""
    
    # Entrance rules
    
    # StartBaking: always accessible (constant true)
    # No rule needed - default is accessible
    
    # ToPreparation: always accessible (constant true)
    # No rule needed - default is accessible
    
    # ToWetIngredients: requires Preheated Oven
    set_rule(multiworld.get_entrance("ToWetIngredients", player),
             lambda state: state.has("Preheated Oven", player))
    
    # ToDryIngredients: always accessible (constant true)
    # No rule needed - default is accessible
    
    # BackToKitchen (from Preparation): always accessible (constant true)
    # No rule needed - default is accessible
    
    # ToCombining: requires both Creamed Mixture AND Flour Mixture
    set_rule(multiworld.get_entrance("ToCombining", player),
             lambda state: state.has("Creamed Mixture", player) and state.has("Flour Mixture", player))
    
    # BackToKitchen (from DryIngredients): always accessible (constant true)
    # No rule needed - default is accessible
    
    # ToFinishing: requires Cookie Dough
    set_rule(multiworld.get_entrance("ToFinishing", player),
             lambda state: state.has("Cookie Dough", player))
    
    # ToBaking: requires Shaped Cookies
    set_rule(multiworld.get_entrance("ToBaking", player),
             lambda state: state.has("Shaped Cookies", player))
    
    
    # Location rules
    
    # Kitchen locations - all always accessible (constant true)
    # No rules needed for:
    # - Gather Mixing Bowls
    # - Get Electric Mixer  
    # - Find Measuring Tools
    
    # Preparation locations - all always accessible (constant true)
    # No rules needed for:
    # - Preheat Oven to 375F
    # - Line Baking Sheets
    # - Soften Butter
    
    # WetIngredients locations
    
    # Cream Butter and Sugars: requires Softened Butter AND Electric Mixer AND Mixing Bowls
    set_rule(multiworld.get_location("Cream Butter and Sugars", player),
             lambda state: (state.has("Softened Butter", player) and 
                           state.has("Electric Mixer", player) and 
                           state.has("Mixing Bowls", player)))
    
    # Add Eggs: requires Butter Sugar Base
    set_rule(multiworld.get_location("Add Eggs", player),
             lambda state: state.has("Butter Sugar Base", player))
    
    # Add Vanilla: requires Egg Mixture
    set_rule(multiworld.get_location("Add Vanilla", player),
             lambda state: state.has("Egg Mixture", player))
    
    # DryIngredients locations
    
    # Measure Flour: requires Measuring Tools
    set_rule(multiworld.get_location("Measure Flour", player),
             lambda state: state.has("Measuring Tools", player))
    
    # Add Baking Soda and Salt: requires Measured Flour
    set_rule(multiworld.get_location("Add Baking Soda and Salt", player),
             lambda state: state.has("Measured Flour", player))
    
    # Combining locations
    
    # Gradually Mix Dry into Wet: always accessible (constant true)
    # No rule needed
    
    # Fold in Chocolate Chips: requires Basic Dough
    set_rule(multiworld.get_location("Fold in Chocolate Chips", player),
             lambda state: state.has("Basic Dough", player))
    
    # Finishing locations
    
    # Scoop Dough onto Sheets: requires Prepared Sheets
    set_rule(multiworld.get_location("Scoop Dough onto Sheets", player),
             lambda state: state.has("Prepared Sheets", player))
    
    # Baking locations
    
    # Bake for 9-11 Minutes: always accessible (constant true)
    # No rule needed
    
    # Cool on Wire Rack (Victory): requires Baked Cookies
    set_rule(multiworld.get_location("Cool on Wire Rack", player),
             lambda state: state.has("Baked Cookies", player))
    
    # Set victory condition
    multiworld.completion_condition[player] = lambda state: state.has("Victory", player)