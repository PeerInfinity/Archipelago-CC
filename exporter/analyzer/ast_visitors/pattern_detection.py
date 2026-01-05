"""
Pattern detection mixin for AST visitors.

This module contains helper methods for detecting common AST patterns
like world.options access, multiworld subscripts, etc.
"""

import ast
from typing import Any, Optional, Set, Tuple


class PatternDetectionMixin:
    """
    Mixin containing pattern detection helper methods.

    These methods are used by various visitors to detect common
    AST patterns and handle them specially.
    """

    def _is_world_player_subscript(self, node) -> bool:
        """
        Check if node is the pattern: state.multiworld.worlds[player]
        Also matches:
        - self.multiworld.worlds[player] for class-based helpers (e.g., RaftLogic)
        - world.worlds[player] where 'world' is the multiworld directly (e.g., ALTTP rules)
        Returns True if matched, False otherwise.

        AST structure (with multiworld):
        Subscript
          value=Attribute(attr='worlds')
            value=Attribute(attr='multiworld')
              value=Name(id='state', 'world', or 'self')
          slice=Name(id='player')

        AST structure (world is multiworld):
        Subscript
          value=Attribute(attr='worlds')
            value=Name(id='world')
          slice=Name(id='player')
        """
        if not isinstance(node, ast.Subscript):
            return False
        if not isinstance(node.slice, ast.Name) or node.slice.id != 'player':
            return False

        # Check .worlds
        worlds_attr = node.value
        if not isinstance(worlds_attr, ast.Attribute) or worlds_attr.attr != 'worlds':
            return False

        # Pattern 1: world.worlds[player] - world IS the multiworld
        # Used in games like ALTTP where 'world' parameter is the multiworld
        if isinstance(worlds_attr.value, ast.Name) and worlds_attr.value.id == 'world':
            return True

        # Pattern 2: state.multiworld.worlds[player] or self.multiworld.worlds[player]
        # Check .multiworld
        multiworld_attr = worlds_attr.value
        if not isinstance(multiworld_attr, ast.Attribute) or multiworld_attr.attr != 'multiworld':
            return False

        # Check state (or world, or self for class-based helpers like RaftLogic)
        state_name = multiworld_attr.value
        if not isinstance(state_name, ast.Name) or state_name.id not in ('state', 'world', 'self'):
            return False

        return True

    def _is_world_attribute_chain(self, obj_result) -> bool:
        """
        Check if obj_result is a 'world' name or an attribute chain rooted in 'world'.

        This is used to prevent resolving world attributes to constants during analysis,
        ensuring consistent output regardless of analysis order.

        Examples that return True:
        - {'type': 'name', 'name': 'world'}
        - {'type': 'attribute', 'object': {'type': 'name', 'name': 'world'}, 'attr': 'difficulty_requirements'}
        - {'type': 'attribute', 'object': {...nested world chain...}, 'attr': 'x'}

        Args:
            obj_result: The analyzed object result dictionary

        Returns:
            True if the object is rooted in 'world', False otherwise
        """
        if not isinstance(obj_result, dict):
            return False

        # Direct world name reference
        if obj_result.get('type') == 'name' and obj_result.get('name') == 'world':
            return True

        # Nested attribute chain - recursively check if it's rooted in world
        if obj_result.get('type') == 'attribute':
            return self._is_world_attribute_chain(obj_result.get('object'))

        return False

    def _is_world_options_pattern(self, node) -> Optional[str]:
        """
        Detect patterns accessing world settings/attributes:
        - state.multiworld.worlds[player].options.<setting>
        - state.multiworld.worlds[player].<attr>
        - state.multiworld.worlds[player].<attr1>.<attr2> (nested like difficulty_requirements.progressive_bottle_limit)
        - self.world.options.<setting> (class-based helpers like KH2)
        - world.options.<setting> (world as function parameter, like Paint helpers)
        - self.multiworld.worlds[player].options.<setting> (class-based helpers like RaftLogic)

        Returns the setting path as a dot-separated string if matched, None otherwise.

        IMPORTANT: Does NOT match patterns ending with .value (e.g., self.world.options.X.value)
        Those should be resolved by closure_vars to get the actual integer value.
        """
        if not isinstance(node, ast.Attribute):
            return None

        # Collect attribute chain from bottom up
        attrs = [node.attr]
        current = node.value

        # Walk up the attribute chain until we hit the worlds[player] subscript or self.world
        while isinstance(current, ast.Attribute):
            attrs.append(current.attr)
            current = current.value

        # Reverse to get top-down order
        attrs.reverse()

        # Check if we've reached the world player subscript (state.multiworld.worlds[player])
        if self._is_world_player_subscript(current):
            # Handle .options.<setting> pattern:
            # - ['options', 'setting_name'] -> 'setting_name' (converted to setting_value)
            #
            # Direct world attributes like hat_yarn_costs, hat_craft_order should NOT be
            # converted to setting_value. These are exported in game_info and should be
            # accessed as world.attr_name, which the frontend resolves from game_info.
            if attrs[0] == 'options' and len(attrs) >= 2:
                # Do NOT match if pattern ends with .to_bool - this is a method call
                # that needs to be evaluated at analysis time via call_visitor
                if attrs[-1] == 'to_bool':
                    return None
                # Strip .value suffix if present - the option value will be resolved at runtime
                # This handles patterns like state.multiworld.worlds[player].options.bosses_required.value
                if attrs[-1] == 'value':
                    return '.'.join(attrs[1:-1])
                # Remove 'options' prefix for .options.<setting> pattern
                return '.'.join(attrs[1:])
            else:
                # Direct world attributes - do NOT convert to setting_value
                # Let normal attribute handling create {type: 'attribute', object: world, attr: ...}
                return None

        # Check for self.world.options.<setting> pattern
        # This handles class-based helpers like KH2's level_locking_unlock
        # AST: self.world.options.Promise_Charm
        # attrs would be: ['world', 'options', 'Promise_Charm']
        # current would be: Name(id='self')
        #
        # IMPORTANT: Do NOT match if the pattern ends with '.value'
        # e.g., self.world.options.LuckyEmblemsRequired.value should NOT match
        # because the .value accessor should be resolved via closure_vars to get
        # the actual integer value, not create a setting_value lookup.
        if isinstance(current, ast.Name) and current.id == 'self':
            # Check for self.world.options.<setting> pattern
            if len(attrs) >= 3 and attrs[0] == 'world' and attrs[1] == 'options':
                # Do NOT match if pattern ends with .value - let closure_vars resolve it
                if attrs[-1] == 'value':
                    return None
                # Do NOT match if pattern ends with .to_bool - this is a method call
                # that needs to be evaluated at analysis time via call_visitor
                if attrs[-1] == 'to_bool':
                    return None
                # Return the setting name (everything after 'options')
                return '.'.join(attrs[2:])

        # Check for world.options.<setting> pattern (world as function parameter)
        # This handles helpers like Paint's calculate_paint_percent_available
        # which take 'world' as a parameter and access world.options.<setting>
        # AST: world.options.canvas_size_increment
        # attrs would be: ['options', 'canvas_size_increment']
        # current would be: Name(id='world')
        if isinstance(current, ast.Name) and current.id == 'world':
            if len(attrs) >= 2 and attrs[0] == 'options':
                # Do NOT match if pattern ends with .value - let closure_vars resolve it
                if attrs[-1] == 'value':
                    return None
                # Do NOT match if pattern ends with .to_bool - this is a method call
                # that needs to be evaluated at analysis time via call_visitor
                if attrs[-1] == 'to_bool':
                    return None
                # Return the setting name (everything after 'options')
                return '.'.join(attrs[1:])

        return None

    def _is_world_attribute_subscript_pattern(self, node) -> Tuple[Optional[str], Any]:
        """
        Detect the pattern: state.multiworld.worlds[player].<attr>[index]
        Returns (attr_name, index) tuple if matched, (None, None) otherwise.

        This handles patterns like:
        - state.multiworld.worlds[player].required_medallions[0]
        - state.multiworld.worlds[player].some_array[1]

        AST structure:
        Subscript(slice=Constant(N))
          value=Attribute(attr='<attr_name>')
            value=Subscript
              value=Attribute(attr='worlds')
                value=Attribute(attr='multiworld')
                  value=Name(id='state')
              slice=Name(id='player')
        """
        if not isinstance(node, ast.Subscript):
            return None, None

        # Get the index
        index_val = None
        if isinstance(node.slice, ast.Constant):
            index_val = node.slice.value
        elif isinstance(node.slice, ast.Num):  # Python 3.7 compatibility
            index_val = node.slice.n
        else:
            return None, None

        # Check that the value being subscripted is an attribute
        if not isinstance(node.value, ast.Attribute):
            return None, None

        attr_name = node.value.attr

        # Check [player] subscript on worlds
        subscript = node.value.value
        if not isinstance(subscript, ast.Subscript):
            return None, None
        if not isinstance(subscript.slice, ast.Name) or subscript.slice.id != 'player':
            return None, None

        # Check .worlds
        worlds_attr = subscript.value
        if not isinstance(worlds_attr, ast.Attribute) or worlds_attr.attr != 'worlds':
            return None, None

        # Check .multiworld
        multiworld_attr = worlds_attr.value
        if not isinstance(multiworld_attr, ast.Attribute) or multiworld_attr.attr != 'multiworld':
            return None, None

        # Check state (or world)
        state_name = multiworld_attr.value
        if not isinstance(state_name, ast.Name) or state_name.id not in ('state', 'world'):
            return None, None

        return attr_name, index_val

    def _is_prog_items_pattern(self, node) -> Optional[str]:
        """
        Detect the pattern: state.prog_items[player][key]
        Returns the key (e.g., " coins") if matched, None otherwise.

        This handles DLCQuest and other games that use accumulator items
        stored in state.prog_items.

        AST structure:
        Subscript(slice=Constant(" coins"))  <- outer node
          value=Subscript(slice=Name("player"))
            value=Attribute(attr='prog_items')
              value=Name(id='state')
        """
        if not isinstance(node, ast.Subscript):
            return None

        # Get the key from the outer subscript slice
        key = None
        if isinstance(node.slice, ast.Constant):
            key = node.slice.value
        elif isinstance(node.slice, ast.Str):  # Python 3.7 compatibility
            key = node.slice.s
        else:
            return None

        # Check inner subscript: [player]
        inner_subscript = node.value
        if not isinstance(inner_subscript, ast.Subscript):
            return None
        if not isinstance(inner_subscript.slice, ast.Name) or inner_subscript.slice.id != 'player':
            return None

        # Check attribute: .prog_items
        prog_items_attr = inner_subscript.value
        if not isinstance(prog_items_attr, ast.Attribute) or prog_items_attr.attr != 'prog_items':
            return None

        # Check name: state
        state_name = prog_items_attr.value
        if not isinstance(state_name, ast.Name) or state_name.id != 'state':
            return None

        return key

    def _is_multiworld_get_region_call(self, node) -> Optional[str]:
        """
        Detect the pattern: state.multiworld.get_region('Region Name', player)
        Returns the region name if matched, None otherwise.

        AST structure:
        Call
          func=Attribute(attr='get_region')
            value=Attribute(attr='multiworld')
              value=Name(id='state')
          args=[Constant('Region Name'), Name(id='player')]
        """
        if not isinstance(node, ast.Call):
            return None

        # Check func is an attribute access
        func = node.func
        if not isinstance(func, ast.Attribute) or func.attr != 'get_region':
            return None

        # Check the object is state.multiworld
        multiworld_attr = func.value
        if not isinstance(multiworld_attr, ast.Attribute) or multiworld_attr.attr != 'multiworld':
            return None

        # Check it's accessing 'state' or 'world'
        state_name = multiworld_attr.value
        if not isinstance(state_name, ast.Name) or state_name.id not in ('state', 'world'):
            return None

        # Get the region name from the first argument
        if len(node.args) < 1:
            return None

        first_arg = node.args[0]
        if isinstance(first_arg, ast.Constant):
            return first_arg.value
        elif isinstance(first_arg, ast.Str):  # Python 3.7 compatibility
            return first_arg.s

        return None

    def _is_region_parameter_attribute(self, node, region_param_names: Optional[Set[str]] = None) -> Tuple[Optional[str], Optional[str]]:
        """
        Detect access to region parameter attributes like region.is_light_world.

        This is used when a helper function takes a region as a parameter
        and accesses its attributes within the function body.

        Args:
            node: The AST Attribute node
            region_param_names: Set of parameter names that are known to be regions
                              (e.g., {'region', 'cave'})

        Returns:
            Tuple of (param_name, attr_name) if matched, (None, None) otherwise.
        """
        if not isinstance(node, ast.Attribute):
            return None, None

        attr_name = node.attr

        # Only handle known region attributes
        if attr_name not in ('is_light_world', 'is_dark_world', 'name'):
            return None, None

        # Check if the object is a Name node (variable reference)
        if not isinstance(node.value, ast.Name):
            return None, None

        param_name = node.value.id

        # If we have a list of known region parameters, check against it
        if region_param_names is not None:
            if param_name not in region_param_names:
                return None, None
        else:
            # Default known region parameter names
            if param_name not in ('region', 'cave', 'r', 'reg'):
                return None, None

        return param_name, attr_name
