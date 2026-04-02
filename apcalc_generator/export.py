"""Export APCalc game data to rules.json format."""

import json
from collections import Counter
from .generator import Node, TRASH_ITEM, compute_path_cost


def make_has_rule(item_name: str, count: int = 1) -> dict:
    rule = {'rule': 'Has', 'args': {'item_name': item_name}}
    if count > 1:
        rule['args']['count'] = count
    return rule


def make_and_rule(children: list[dict]) -> dict:
    if len(children) == 0:
        return {'rule': 'True_'}
    if len(children) == 1:
        return children[0]
    return {'rule': 'And', 'children': children}


def path_cost_to_rule(path_cost: Counter) -> dict:
    """Convert a button-press cost Counter to an access rule."""
    rules = []
    for button in sorted(path_cost):
        count = path_cost[button]
        rules.append(make_has_rule(f'Button: {button}', count))
    return make_and_rule(rules)


def button_item_name(button: str) -> str:
    return f'Button: {button}'


def export_rules_json(game_data: dict) -> dict:
    """Convert generated APCalc data to a complete rules.json dict."""
    nodes: list[Node] = game_data['nodes']
    starting_buttons: dict[str, int] = game_data['starting_buttons']

    # Collect all unique button items used in the game (excluding trash)
    all_button_labels: set[str] = set()
    trash_count = 0
    for node in nodes:
        if node.item and node.item != TRASH_ITEM:
            all_button_labels.add(node.item)
        elif node.item == TRASH_ITEM:
            trash_count += 1
    for label in starting_buttons:
        all_button_labels.add(label)

    # Count item occurrences for the pool (excludes starting items)
    pool_counts: Counter = Counter()
    for node in nodes:
        if node.item and node.item != TRASH_ITEM:
            pool_counts[button_item_name(node.item)] += 1
    if trash_count > 0:
        pool_counts[TRASH_ITEM] = trash_count

    # Build regions
    regions = {}

    # Menu region: exits to all sphere 0 nodes
    menu_exits = []
    for node in nodes:
        if node.sphere == 0:
            cost = compute_path_cost(node, nodes)
            menu_exits.append({
                'name': f'Menu to {node.region_name}',
                'connected_region': node.region_name,
                'access_rule': path_cost_to_rule(cost),
            })
    regions['C'] = {
        'name': 'C',
        'exits': menu_exits,
        'locations': [],
    }

    # Build child index: parent_index -> list of child nodes
    children_by_parent: dict[int, list[Node]] = {}
    for node in nodes:
        if node.parent_index is not None:
            children_by_parent.setdefault(node.parent_index, []).append(node)

    # Node regions — each gets a check location + a locked "Checked" event
    all_checked_events = []
    for node in nodes:
        exits = []
        children = children_by_parent.get(node.index, [])
        for child in children:
            cost = compute_path_cost(child, nodes)
            exits.append({
                'name': f'{node.region_name} to {child.region_name}',
                'connected_region': child.region_name,
                'access_rule': path_cost_to_rule(cost),
            })

        # Regular check location
        is_trash = node.item == TRASH_ITEM
        item_name = TRASH_ITEM if is_trash else button_item_name(node.item)
        event_name = f'Checked {node.location_name}'
        all_checked_events.append(event_name)

        locations = [
            {
                'name': node.location_name,
                'id': node.index + 1,  # 1-based IDs
                'access_rule': {'rule': 'True_'},
                'item': {
                    'name': item_name,
                    'player': 1,
                    'advancement': not is_trash,
                    'type': 'None',
                },
                'locked': False,
            },
            {
                'name': event_name,
                'id': None,
                'access_rule': {'rule': 'True_'},
                'item': {
                    'name': event_name,
                    'player': 1,
                    'advancement': True,
                    'type': 'None',
                },
                'locked': True,
                'event': True,
            },
        ]

        regions[node.region_name] = {
            'name': node.region_name,
            'exits': exits,
            'locations': locations,
        }

    # Victory event on the start region, requiring all locations checked
    goal_rule = make_and_rule([
        make_has_rule(evt) for evt in all_checked_events
    ])
    regions['C']['locations'].append({
        'name': 'Victory',
        'id': None,
        'access_rule': goal_rule,
        'item': {
            'name': 'Victory',
            'player': 1,
            'advancement': True,
            'type': 'None',
        },
        'locked': True,
        'event': True,
    })

    # Build items dict
    items = {}
    item_id = 1
    for label in sorted(all_button_labels):
        name = button_item_name(label)
        total_count = pool_counts.get(name, 0) + starting_buttons.get(label, 0)
        items[name] = {
            'name': name,
            'id': item_id,
            'groups': ['Buttons'],
            'classification': 'progression',
            'type': None,
            'max_count': max(total_count, 1),
        }
        item_id += 1

    if trash_count > 0:
        items[TRASH_ITEM] = {
            'name': TRASH_ITEM,
            'id': item_id,
            'groups': ['Filler'],
            'classification': 'filler',
            'type': None,
            'max_count': trash_count,
        }
        item_id += 1

    # Checked event items (one per node)
    for evt in all_checked_events:
        items[evt] = {
            'name': evt,
            'id': None,
            'groups': ['Event'],
            'classification': 'progression',
            'event': True,
            'type': 'Event',
            'max_count': 1,
        }

    items['Victory'] = {
        'name': 'Victory',
        'id': None,
        'groups': ['Event'],
        'classification': 'progression',
        'event': True,
        'type': 'Event',
        'max_count': 1,
    }

    # Build itempool_counts (pool items only, not starting items)
    itempool_counts = dict(pool_counts)
    for evt in all_checked_events:
        itempool_counts[evt] = 1
    itempool_counts['Victory'] = 1

    # Build starting_items list
    starting_items_list = []
    for label, count in sorted(starting_buttons.items()):
        for _ in range(count):
            starting_items_list.append(button_item_name(label))

    # Build slot_data with node info and button sequences
    slot_nodes = {}
    for node in nodes:
        slot_nodes[node.region_name] = {
            'value': node.value,
            'parent': nodes[node.parent_index].region_name if node.parent_index is not None else None,
            'sphere': node.sphere,
            'operation': node.operation,
            'operand': node.operand,
            'button_sequence': node.button_sequence,
            'item': node.item,
        }

    config = game_data['config']

    return {
        'schema_version': 3,
        'game_name': 'APCalc',
        'game_directory': 'apcalc',
        'archipelago_version': '0.6.7',
        'generation_seed': config.seed,
        'seed_name': str(config.seed),
        'player_names': {'1': 'Player1'},
        'regions': {'1': regions},
        'start_regions': {
            '1': {
                'default': ['C'],
                'available': [],
            },
        },
        'items': {'1': items},
        'item_groups': {'1': ['Buttons']},
        'itempool_counts': {'1': itempool_counts},
        'canonical_placements': {'1': {}},
        'progression_mapping': {'1': {}},
        'starting_items': {'1': starting_items_list},
        'world': {
            '1': {
                'game': 'APCalc',
                'world_class_name': 'APCalcWorld',
                'options': {},
                'option_definitions': {},
                'world_description': (
                    'APCalc is a calculator-themed puzzle game. '
                    'Collect number and operation buttons, then budget your presses '
                    'to navigate a graph of target numbers.'
                ),
                'slot_data': {
                    'nodes': slot_nodes,
                    'starting_buttons': starting_buttons,
                    'operations': ['+', '-', '*', '/'],
                    'num_spheres': config.num_spheres,
                    'goal': 'all_locations',
                },
                'web': {
                    'theme': 'dirt',
                    'tutorials': [
                        {
                            'name': 'APCalc Setup Guide',
                            'description': 'A guide to setting up APCalc.',
                            'language': 'English',
                            'file_name': 'setup_en.md',
                            'link': 'setup/en',
                            'authors': ['PeerInfinity'],
                        },
                    ],
                },
                'world_directory': 'apcalc',
            },
        },
        'exporter': {},
        'game_info': {
            '1': {
                'completion_condition': {
                    'type': 'item_check',
                    'item': 'Victory',
                },
            },
        },
        'helpers': {},
    }


def write_rules_json(rules_data: dict, output_path: str) -> None:
    """Write rules.json to file."""
    with open(output_path, 'w') as f:
        json.dump(rules_data, f, indent=2)
    print(f'Wrote {output_path}')
