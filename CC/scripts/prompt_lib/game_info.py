"""
Game information and classification utilities.

Functions for determining game characteristics based on world mapping data.
"""


def is_basic_game(game_name, world_mapping):
    """Check if a game is 'basic' - no custom exporter or JavaScript helpers.

    Returns True if the game has neither a custom exporter nor custom game logic.
    """
    if game_name not in world_mapping:
        # If not in mapping, assume it's basic (uses generic infrastructure)
        return True

    game_info = world_mapping[game_name]
    has_custom_exporter = game_info.get('has_custom_exporter', False)
    has_custom_game_logic = game_info.get('has_custom_game_logic', False)

    return not has_custom_exporter and not has_custom_game_logic


def has_custom_code(game_name, world_mapping):
    """Check if a game has custom exporter or JavaScript helpers.

    Returns True if the game has either a custom exporter or custom game logic.
    """
    if game_name not in world_mapping:
        return False

    game_info = world_mapping[game_name]
    has_custom_exporter = game_info.get('has_custom_exporter', False)
    has_custom_game_logic = game_info.get('has_custom_game_logic', False)

    return has_custom_exporter or has_custom_game_logic


def has_javascript_helpers(game_name, world_mapping):
    """Check if a game has custom JavaScript helpers.

    Returns True if the game has custom game logic (JavaScript helpers).
    """
    if game_name not in world_mapping:
        return False

    game_info = world_mapping[game_name]
    return game_info.get('has_custom_game_logic', False)


def get_custom_code_info(game_name, world_mapping):
    """Get information about custom code for a game.

    Returns a dict with has_exporter, has_helpers, exporter_path, helpers_path.
    """
    if game_name not in world_mapping:
        return {
            'has_exporter': False,
            'has_helpers': False,
            'exporter_path': None,
            'helpers_path': None,
            'world_directory': None
        }

    game_info = world_mapping[game_name]
    return {
        'has_exporter': game_info.get('has_custom_exporter', False),
        'has_helpers': game_info.get('has_custom_game_logic', False),
        'exporter_path': game_info.get('exporter_path'),
        'helpers_path': game_info.get('game_logic_path'),
        'world_directory': game_info.get('world_directory')
    }
