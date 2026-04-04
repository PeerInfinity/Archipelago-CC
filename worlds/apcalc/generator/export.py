"""Export APCalc v2 game data to rules.json format."""

import json
from collections import Counter
from .generator import Node, Edge, TRASH_ITEM


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


def make_or_rule(children: list[dict]) -> dict:
    if len(children) == 0:
        return {'rule': 'True_'}
    if len(children) == 1:
        return children[0]
    return {'rule': 'Or', 'children': children}


def path_cost_to_rule(path_cost: Counter) -> dict:
    """Convert a button-press cost Counter to an access rule."""
    rules = []
    for button in sorted(path_cost):
        count = path_cost[button]
        if count > 0:
            rules.append(make_has_rule(f'Button: {button}', count))
    return make_and_rule(rules)


def path_costs_to_rule(path_costs: list[Counter]) -> dict:
    """Convert multiple alternative path costs to an Or-of-And rule."""
    if not path_costs:
        return {'rule': 'True_'}
    if len(path_costs) == 1:
        return path_cost_to_rule(path_costs[0])

    # Deduplicate identical path costs
    unique = []
    seen = set()
    for pc in path_costs:
        key = tuple(sorted(pc.items()))
        if key not in seen:
            seen.add(key)
            unique.append(pc)

    if len(unique) == 1:
        return path_cost_to_rule(unique[0])

    return make_or_rule([path_cost_to_rule(pc) for pc in unique])


def button_item_name(button: str) -> str:
    return f'Button: {button}'


def export_rules_json(game_data: dict) -> dict:
    """Convert generated APCalc v2 data to a complete rules.json dict."""
    nodes: list[Node] = game_data['nodes']
    edges: list[Edge] = game_data['edges']
    starting_buttons: dict[str, int] = game_data['starting_buttons']

    # Collect all unique button items (excluding trash)
    all_button_labels: set[str] = set()
    trash_count = 0
    for node in nodes:
        if node.item and node.item != TRASH_ITEM:
            all_button_labels.add(node.item)
        elif node.item == TRASH_ITEM:
            trash_count += 1
    for label in starting_buttons:
        all_button_labels.add(label)

    # Count item occurrences for the pool
    pool_counts: Counter = Counter()
    for node in nodes:
        if node.item and node.item != TRASH_ITEM:
            pool_counts[button_item_name(node.item)] += 1
    if trash_count > 0:
        pool_counts[TRASH_ITEM] = trash_count

    # --- Build regions ---
    regions = {}

    # Index edges by source
    edges_by_source: dict[int | None, list[Edge]] = {}
    for edge in edges:
        edges_by_source.setdefault(edge.source_index, []).append(edge)

    # Start region "C": exits to all layer 0 nodes
    menu_exits = []
    for edge in edges_by_source.get(None, []):
        target = nodes[edge.target_index]
        menu_exits.append({
            'name': f'C to {target.region_name}',
            'connected_region': target.region_name,
            'access_rule': path_costs_to_rule(edge.path_costs),
        })
    regions['C'] = {
        'name': 'C',
        'exits': menu_exits,
        'locations': [],
    }

    # Node regions
    all_checked_events = []
    for node in nodes:
        # Build exits from this node
        exits = []
        # Group edges by target for one exit per target
        target_edges: dict[int, list[Edge]] = {}
        for edge in edges_by_source.get(node.index, []):
            target_edges.setdefault(edge.target_index, []).append(edge)

        for target_idx, tedges in target_edges.items():
            target = nodes[target_idx]
            # Collect all path costs across all edges to this target
            all_costs = []
            for te in tedges:
                all_costs.extend(te.path_costs)
            exits.append({
                'name': f'{node.region_name} to {target.region_name}',
                'connected_region': target.region_name,
                'access_rule': path_costs_to_rule(all_costs),
            })

        # Location + checked event
        is_trash = node.item == TRASH_ITEM
        item_name = TRASH_ITEM if is_trash else button_item_name(node.item)
        event_name = f'Checked {node.location_name}'
        all_checked_events.append(event_name)

        locations = [
            {
                'name': node.location_name,
                'id': node.index + 1,
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

    # Victory event requiring all locations checked
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

    # --- Build items ---
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

    # --- Itempool, starting items ---
    itempool_counts = dict(pool_counts)
    for evt in all_checked_events:
        itempool_counts[evt] = 1
    itempool_counts['Victory'] = 1

    starting_items_list = []
    for label, count in sorted(starting_buttons.items()):
        for _ in range(count):
            starting_items_list.append(button_item_name(label))

    # --- Slot data ---
    slot_nodes = {}
    for node in nodes:
        slot_nodes[node.region_name] = {
            'value': node.value,
            'layer': node.layer,
            'sphere': node.sphere,
            'item': node.item,
        }

    slot_edges = []
    for edge in edges:
        source_name = nodes[edge.source_index].region_name if edge.source_index is not None else 'C'
        target_name = nodes[edge.target_index].region_name
        slot_edges.append({
            'source': source_name,
            'target': target_name,
            'operation': edge.operation,
            'operand': edge.operand,
            'operand_digits': edge.operand_digits,
        })

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
                    'edges': slot_edges,
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
