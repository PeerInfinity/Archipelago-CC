from .base import BaseHelperExpander

class ALttPHelperExpander(BaseHelperExpander):
    def expand_helper(self, helper_name: str):
        helper_map = {
            'has_sword': self._expand_has_sword,
            'has_melee_weapon': self._expand_has_melee_weapon,
            'can_use_bombs': self._expand_can_use_bombs,
            'has_fire_source': self._expand_has_fire_source,
            'can_lift_rocks': self._expand_can_lift_rocks,
            'can_lift_heavy_rocks': self._expand_can_lift_heavy_rocks,
            'can_bomb_or_bonk': self._expand_can_bomb_or_bonk,
            'can_shoot_arrows': self._expand_can_shoot_arrows,
            'has_beam_sword': self._expand_has_beam_sword,
            'can_melt_things': self._expand_can_melt_things,
            'can_extend_magic': self._expand_can_extend_magic,
            'has_hearts': self._expand_has_hearts,
            'can_kill_most_things': self._expand_can_kill_most_things,
            'can_activate_crystal_switch': self._expand_can_activate_crystal_switch,
            'can_retrieve_tablet': self._expand_can_retrieve_tablet,
            'bottle_count': self._expand_bottle_count,
            'can_get_good_bee': self._expand_can_get_good_bee,
            'can_boots_clip_lw': self._expand_can_boots_clip_lw,
            'can_boots_clip_dw': self._expand_can_boots_clip_dw,
            'can_get_glitched_speed_dw': self._expand_can_get_glitched_speed_dw,
            'has_misery_mire_medallion': self._expand_has_misery_mire_medallion,
            'has_turtle_rock_medallion': self._expand_has_turtle_rock_medallion,
            'has_triforce_pieces': self._expand_has_triforce_pieces,
            'has_crystals': self._expand_has_crystals,
        }
        expander = helper_map.get(helper_name)
        return expander() if expander else None

    def _expand_has_sword(self):
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': sword}
                for sword in ['Fighter Sword', 'Master Sword', 'Tempered Sword', 'Golden Sword']
            ]
        }

    def _expand_has_melee_weapon(self):
        return {
            'type': 'or',
            'conditions': [
                self._expand_has_sword(),
                {'type': 'item_check', 'item': 'Hammer'}
            ]
        }

    def _expand_can_use_bombs(self):
        # Note: We're simplifying the capacity upgrade logic here
        return {
            'type': 'or',
            'conditions': [
                {'type': 'count_check', 'item': item, 'count': 1}
                for item in ['Bomb Upgrade (+5)', 'Bomb Upgrade (+10)', 'Bomb Upgrade (50)']
            ]
        }

    def _expand_has_fire_source(self):
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Fire Rod'},
                {'type': 'item_check', 'item': 'Lamp'}
            ]
        }

    def _expand_can_lift_rocks(self):
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Power Glove'},
                {'type': 'item_check', 'item': 'Titans Mitts'}
            ]
        }

    def _expand_can_lift_heavy_rocks(self):
        return {'type': 'item_check', 'item': 'Titans Mitts'}

    def _expand_can_bomb_or_bonk(self):
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Pegasus Boots'},
                self._expand_can_use_bombs()
            ]
        }

    def _expand_can_shoot_arrows(self):
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Bow'},
                {'type': 'item_check', 'item': 'Silver Bow'}
            ]
        }

    def _expand_has_beam_sword(self):
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': sword}
                for sword in ['Master Sword', 'Tempered Sword', 'Golden Sword']
            ]
        }

    def _expand_can_melt_things(self):
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Fire Rod'},
                {
                    'type': 'and',
                    'conditions': [
                        {'type': 'item_check', 'item': 'Bombos'},
                        self._expand_has_sword()
                    ]
                }
            ]
        }

    def _expand_can_extend_magic(self):
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Magic Upgrade (1/4)'},
                {'type': 'item_check', 'item': 'Magic Upgrade (1/2)'},
                {'type': 'group_check', 'group': 'Bottles'}
            ]
        }

    def _expand_has_hearts(self):
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Boss Heart Container'},
                {'type': 'item_check', 'item': 'Sanctuary Heart Container'},
                {'type': 'item_check', 'item': 'Piece of Heart'}
            ]
        }

    def _expand_can_kill_most_things(self):
        return {
            'type': 'or',
            'conditions': [
                self._expand_has_melee_weapon(),
                {'type': 'item_check', 'item': 'Cane of Somaria'},
                {'type': 'item_check', 'item': 'Cane of Byrna'},
                self._expand_can_shoot_arrows(),
                {'type': 'item_check', 'item': 'Fire Rod'},
                self._expand_can_use_bombs()
            ]
        }

    def _expand_can_activate_crystal_switch(self):
        return {
            'type': 'or',
            'conditions': [
                self._expand_has_melee_weapon(),
                self._expand_can_use_bombs(),
                self._expand_can_shoot_arrows(),
                {'type': 'item_check', 'item': 'Hookshot'},
                {'type': 'item_check', 'item': 'Cane of Somaria'},
                {'type': 'item_check', 'item': 'Cane of Byrna'},
                {'type': 'item_check', 'item': 'Fire Rod'},
                {'type': 'item_check', 'item': 'Ice Rod'},
                {'type': 'item_check', 'item': 'Blue Boomerang'},
                {'type': 'item_check', 'item': 'Red Boomerang'}
            ]
        }

    def _expand_can_retrieve_tablet(self):
        return {
            'type': 'and',
            'conditions': [
                {'type': 'item_check', 'item': 'Book of Mudora'},
                {
                    'type': 'or',
                    'conditions': [
                        self._expand_has_beam_sword(),
                        {
                            'type': 'and',
                            'conditions': [
                                {'type': 'helper', 'name': 'is_swordless'},  # This would need to be handled separately
                                {'type': 'item_check', 'item': 'Hammer'}
                            ]
                        }
                    ]
                }
            ]
        }

    def _expand_bottle_count(self):
        return {'type': 'group_check', 'group': 'Bottles'}

    def _expand_can_get_good_bee(self):
        return {
            'type': 'and',
            'conditions': [
                {'type': 'group_check', 'group': 'Bottles'},
                {'type': 'item_check', 'item': 'Bug Catching Net'},
                {
                    'type': 'or',
                    'conditions': [
                        {'type': 'item_check', 'item': 'Pegasus Boots'},
                        {
                            'type': 'and',
                            'conditions': [
                                self._expand_has_sword(),
                                {'type': 'item_check', 'item': 'Quake'}
                            ]
                        }
                    ]
                }
            ]
        }

    def _expand_can_boots_clip_lw(self):
        # Logic depends on game mode (inverted vs normal)
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Pegasus Boots'},
                {
                    'type': 'and',
                    'conditions': [
                        {'type': 'item_check', 'item': 'Pegasus Boots'},
                        {'type': 'item_check', 'item': 'Moon Pearl'}
                    ]
                }
            ]
        }

    def _expand_can_boots_clip_dw(self):
        # Similar to can_boots_clip_lw but for dark world
        return {
            'type': 'and',
            'conditions': [
                {'type': 'item_check', 'item': 'Pegasus Boots'},
                {'type': 'item_check', 'item': 'Moon Pearl'}
            ]
        }

    def _expand_can_get_glitched_speed_dw(self):
        return {
            'type': 'and',
            'conditions': [
                {'type': 'item_check', 'item': 'Pegasus Boots'},
                {'type': 'item_check', 'item': 'Moon Pearl'},
                {
                    'type': 'or',
                    'conditions': [
                        {'type': 'item_check', 'item': 'Hookshot'},
                        self._expand_has_sword()
                    ]
                }
            ]
        }

    def _expand_has_misery_mire_medallion(self):
        # This would need to be configured based on the required medallion
        return {'type': 'item_check', 'item': 'Ether'}  # Default medallion

    def _expand_has_turtle_rock_medallion(self):
        # This would need to be configured based on the required medallion
        return {'type': 'item_check', 'item': 'Quake'}  # Default medallion

    def _expand_has_triforce_pieces(self):
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Triforce Piece'},
                {'type': 'item_check', 'item': 'Power Star'}
            ]
        }

    def _expand_has_crystals(self):
        return {'type': 'group_check', 'group': 'Crystals'}