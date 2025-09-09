from typing import Dict, List
from BaseClasses import Region, Entrance, MultiWorld
from .Locations import ChocolateChipCookiesLocation, location_table, get_locations_by_region


def create_regions(multiworld: MultiWorld, player: int) -> None:
    """Create all regions and their connections."""
    
    # Create all regions
    regions = {}
    region_names = ["Menu", "Kitchen", "Preparation", "WetIngredients", "DryIngredients", "Combining", "Finishing", "Baking"]
    
    for region_name in region_names:
        region = Region(region_name, player, multiworld)
        regions[region_name] = region
        multiworld.regions.append(region)
        
        # Add locations to regions
        location_names = get_locations_by_region(region_name)
        for location_name in location_names:
            location_data = location_table[location_name]
            # Check if this is an event location (id is None)
            if location_data.id is None:
                # Event locations have special handling
                location = ChocolateChipCookiesLocation(player, location_name, None, region)
                location.event = True
            else:
                location = ChocolateChipCookiesLocation(player, location_name, location_data.id, region)
            region.locations.append(location)
    
    # Create entrances and connections based on JSON structure
    create_entrance(regions["Menu"], regions["Kitchen"], "StartBaking")
    
    # Kitchen connections
    create_entrance(regions["Kitchen"], regions["Preparation"], "ToPreparation")
    create_entrance(regions["Kitchen"], regions["WetIngredients"], "ToWetIngredients")
    create_entrance(regions["Kitchen"], regions["DryIngredients"], "ToDryIngredients")
    
    # Preparation connections
    create_entrance(regions["Preparation"], regions["Kitchen"], "BackToKitchenFromPrep")
    
    # WetIngredients connections
    create_entrance(regions["WetIngredients"], regions["Combining"], "ToCombining")
    
    # DryIngredients connections
    create_entrance(regions["DryIngredients"], regions["Kitchen"], "BackToKitchenFromDry")
    
    # Combining connections
    create_entrance(regions["Combining"], regions["Finishing"], "ToFinishing")
    
    # Finishing connections
    create_entrance(regions["Finishing"], regions["Baking"], "ToBaking")
    
    # No exits from Baking region (final region)


def create_entrance(source_region: Region, target_region: Region, entrance_name: str) -> None:
    """Create an entrance between two regions."""
    entrance = Entrance(source_region.player, entrance_name, source_region)
    entrance.connect(target_region)
    source_region.exits.append(entrance)