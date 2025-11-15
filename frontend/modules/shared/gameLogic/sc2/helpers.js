/**
 * Starcraft 2 Helper Functions
 *
 * These helpers implement game-specific logic from worlds/sc2/Rules.py
 * All helpers receive (snapshot, staticData, ...args) parameters where:
 * - snapshot: Current game state with inventory, flags, events
 * - staticData: Static game data including items, regions, locations, settings
 * - ...args: Additional arguments from the rule
 */

/**
 * Get the player number from staticData
 */
function getPlayer(staticData) {
    return staticData?.player || 1;
}

/**
 * Check if advanced tactics are enabled
 */
function isAdvancedTactics(staticData) {
    const settings = staticData?.settings;
    const logicLevel = settings?.required_tactics;
    // RequiredTactics.option_standard = 0, anything else means advanced tactics
    return logicLevel !== undefined && logicLevel !== 0;
}

/**
 * Check if the player has an item
 */
function has(snapshot, itemName) {
    return !!(snapshot?.inventory && snapshot.inventory[itemName] > 0);
}

/**
 * Check if the player has any of the items
 */
function has_any(snapshot, itemNames) {
    if (!snapshot?.inventory) return false;
    return itemNames.some(itemName => snapshot.inventory[itemName] > 0);
}

/**
 * Check if the player has all of the items
 */
function has_all(snapshot, itemNames) {
    if (!snapshot?.inventory) return false;
    return itemNames.every(itemName => snapshot.inventory[itemName] > 0);
}

/**
 * Count how many of an item the player has
 */
function count(snapshot, itemName) {
    return snapshot?.inventory?.[itemName] || 0;
}

/**
 * Check if player has any of the basic Terran units
 */
export function terran_common_unit(snapshot, staticData) {
    // basic_terran_units is dynamically computed based on settings
    // For now, check common basic units
    return has_any(snapshot, [
        'Marine', 'Firebat', 'Marauder', 'Reaper', 'Hellion',
        'Goliath', 'Diamondback', 'Viking', 'Banshee'
    ]);
}

/**
 * Basic combat unit that can be deployed quickly from mission start
 */
export function terran_early_tech(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return has_any(snapshot, ['Marine', 'Firebat', 'Marauder', 'Reaper', 'Hellion'])
        || (advancedTactics && has_any(snapshot, ['Goliath', 'Diamondback', 'Viking', 'Banshee']));
}

/**
 * Air units or drops on advanced tactics
 */
export function terran_air(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return has_any(snapshot, ['Viking', 'Wraith', 'Banshee', 'Battlecruiser'])
        || (advancedTactics && has_any(snapshot, ['Hercules', 'Medivac']) && terran_common_unit(snapshot, staticData));
}

/**
 * Air-to-air capable units
 */
export function terran_air_anti_air(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return has(snapshot, 'Viking')
        || has_all(snapshot, ['Wraith', 'Wraith Advanced Laser Technology'])
        || has_all(snapshot, ['Battlecruiser', 'Battlecruiser ATX Laser Battery'])
        || (advancedTactics && has_any(snapshot, ['Wraith', 'Valkyrie', 'Battlecruiser']));
}

/**
 * Ground-to-air capable units
 */
export function terran_competent_ground_to_air(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return has(snapshot, 'Goliath')
        || (has(snapshot, 'Marine') && terran_bio_heal(snapshot, staticData))
        || (advancedTactics && has(snapshot, 'Cyclone'));
}

/**
 * Good anti-air capability
 */
export function terran_competent_anti_air(snapshot, staticData) {
    return terran_competent_ground_to_air(snapshot, staticData) || terran_air_anti_air(snapshot, staticData);
}

/**
 * Ability to heal bio units
 */
export function terran_bio_heal(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return has_any(snapshot, ['Medic', 'Medivac'])
        || (advancedTactics && has_all(snapshot, ['Raven', 'Raven Bio-Mechanical Repair Drone']));
}

/**
 * Basic anti-air to deal with few air units
 */
export function terran_basic_anti_air(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return has_any(snapshot, [
        'Missile Turret', 'Thor', 'War Pigs', 'Spartan Company',
        'Hel\'s Angels', 'Battlecruiser', 'Marine', 'Wraith',
        'Valkyrie', 'Cyclone', 'Winged Nightmares', 'Brynhilds'
    ])
        || terran_competent_anti_air(snapshot, staticData)
        || (advancedTactics && has_any(snapshot, ['Ghost', 'Spectre', 'Widow Mine', 'Liberator']));
}

/**
 * Ability to deal with most hard missions
 */
export function terran_competent_comp(snapshot, staticData) {
    return (
        (
            (has_any(snapshot, ['Marine', 'Marauder']) && terran_bio_heal(snapshot, staticData))
            || has_any(snapshot, ['Thor', 'Banshee', 'Siege Tank'])
            || has_all(snapshot, ['Liberator', 'Liberator Raid Artillery'])
        )
        && terran_competent_anti_air(snapshot, staticData)
    ) || (
        has(snapshot, 'Battlecruiser') && terran_common_unit(snapshot, staticData)
    );
}

// Protoss helpers

/**
 * Check if player has any of the basic Protoss units
 */
export function protoss_common_unit(snapshot, staticData) {
    // basic_protoss_units is dynamically computed based on settings
    // For now, check common basic units
    return has_any(snapshot, [
        'Zealot', 'Centurion', 'Sentinel', 'Stalker', 'Slayer', 'Instigator',
        'Adept', 'Sentry', 'Immortal', 'Annihilator', 'Colossus', 'Vanguard'
    ]);
}

/**
 * Competent anti-air for Protoss
 */
export function protoss_competent_anti_air(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return has_any(snapshot, [
        'Stalker', 'Slayer', 'Instigator', 'Dragoon', 'Adept',
        'Void Ray', 'Destroyer', 'Tempest'
    ])
        || (has_any(snapshot, ['Phoenix', 'Mirage', 'Corsair', 'Carrier'])
            && has_any(snapshot, ['Scout', 'Wrathwalker']))
        || (advancedTactics
            && has_any(snapshot, ['Immortal', 'Annihilator'])
            && has(snapshot, 'Immortal Annihilator Advanced Targeting Mechanics'));
}

/**
 * Basic anti-air for Protoss
 */
export function protoss_basic_anti_air(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return protoss_competent_anti_air(snapshot, staticData)
        || has_any(snapshot, [
            'Phoenix', 'Mirage', 'Corsair', 'Carrier', 'Scout',
            'Dark Archon', 'Wrathwalker', 'Mothership'
        ])
        || has_all(snapshot, ['Warp Prism', 'Warp Prism Phase Blaster'])
        || (advancedTactics && has_any(snapshot, [
            'High Templar', 'Signifier', 'Ascendant', 'Dark Templar',
            'Sentry', 'Energizer'
        ]));
}

/**
 * Anti-armor anti-air for Protoss
 */
export function protoss_anti_armor_anti_air(snapshot, staticData) {
    return protoss_competent_anti_air(snapshot, staticData)
        || has_any(snapshot, ['Scout', 'Wrathwalker'])
        || (has_any(snapshot, ['Immortal', 'Annihilator'])
            && has(snapshot, 'Immortal Annihilator Advanced Targeting Mechanics'));
}

/**
 * Anti-light anti-air for Protoss
 */
export function protoss_anti_light_anti_air(snapshot, staticData) {
    return protoss_competent_anti_air(snapshot, staticData)
        || has_any(snapshot, ['Phoenix', 'Mirage', 'Corsair', 'Carrier']);
}

/**
 * Protoss has blink capability
 */
export function protoss_has_blink(snapshot, staticData) {
    return has_any(snapshot, ['Stalker', 'Instigator', 'Slayer'])
        || (has(snapshot, 'Dark Templar Avenger Blood Hunter Blink')
            && has_any(snapshot, ['Dark Templar', 'Blood Hunter', 'Avenger']));
}

/**
 * Can attack behind chasm
 */
export function protoss_can_attack_behind_chasm(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return has_any(snapshot, [
        'Scout', 'Tempest', 'Carrier', 'Void Ray', 'Destroyer', 'Mothership'
    ])
        || protoss_has_blink(snapshot, staticData)
        || (has(snapshot, 'Warp Prism')
            && (protoss_common_unit(snapshot, staticData) || has(snapshot, 'Warp Prism Phase Blaster')))
        || (advancedTactics && has_any(snapshot, ['Oracle', 'Arbiter']));
}

/**
 * Protoss has fleet units
 */
export function protoss_fleet(snapshot, staticData) {
    return has_any(snapshot, ['Carrier', 'Tempest', 'Void Ray', 'Destroyer']);
}

/**
 * Protoss has basic splash damage
 */
export function protoss_basic_splash(snapshot, staticData) {
    return has_any(snapshot, [
        'Zealot', 'Colossus', 'Vanguard', 'High Templar', 'Signifier',
        'Dark Templar', 'Reaver', 'Ascendant'
    ]);
}

/**
 * Protoss has static defense
 */
export function protoss_static_defense(snapshot, staticData) {
    return has_any(snapshot, ['Photon Cannon', 'Khaydarin Monolith']);
}

/**
 * Protoss can counter hybrids
 */
export function protoss_hybrid_counter(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return has_any(snapshot, [
        'Annihilator', 'Ascendant', 'Tempest', 'Carrier', 'Void Ray',
        'Wrathwalker', 'Vanguard'
    ])
        || ((has(snapshot, 'Immortal') || advancedTactics)
            && has_any(snapshot, ['Stalker', 'Dragoon', 'Adept', 'Instigator', 'Slayer']));
}

/**
 * Protoss competent composition
 */
export function protoss_competent_comp(snapshot, staticData) {
    return protoss_common_unit(snapshot, staticData)
        && protoss_competent_anti_air(snapshot, staticData)
        && protoss_hybrid_counter(snapshot, staticData)
        && protoss_basic_splash(snapshot, staticData);
}

/**
 * Protoss can heal
 */
export function protoss_heal(snapshot, staticData) {
    return has_any(snapshot, ['Carrier', 'Sentry', 'Shield Battery', 'Reconstruction Beam']);
}

/**
 * Protoss has stalker upgrade
 */
export function protoss_stalker_upgrade(snapshot, staticData) {
    // Note: lock_any_item is not implemented, so we just check for the upgrade and units
    return has_any(snapshot, [
        'Stalker Instigator Slayer Disintegrating Particles',
        'Stalker Instigator Slayer Particle Reflection'
    ])
        && has_any(snapshot, ['Stalker', 'Instigator', 'Slayer']);
}

// Zerg helpers

/**
 * Zerg competent anti-air
 */
export function zerg_competent_anti_air(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    return has_any(snapshot, ['Hydralisk', 'Mutalisk', 'Corruptor', 'Brood Queen'])
        || has_all(snapshot, ['Swarm Host', 'Pressurized Glands (Swarm Host)'])
        || has_all(snapshot, ['Scourge', 'Resource Efficiency (Scourge)'])
        || (advancedTactics && has(snapshot, 'Infestor'));
}

/**
 * Zerg basic anti-air
 */
export function zerg_basic_anti_air(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);
    const kerriganUnitAvailable = staticData?.settings?.kerrigan_unit_available || false;

    // Check if zerg_competent_anti_air is satisfied
    if (zerg_competent_anti_air(snapshot, staticData)) {
        return true;
    }

    // Check if Kerrigan is available as a unit
    if (kerriganUnitAvailable) {
        return true;
    }

    // Check for basic anti-air units
    if (has_any(snapshot, ['Swarm Queen', 'Scourge'])) {
        return true;
    }

    // Advanced tactics allows Spore Crawler
    if (advancedTactics && has(snapshot, 'Spore Crawler')) {
        return true;
    }

    return false;
}

/**
 * Morph Brood Lord
 */
export function morph_brood_lord(snapshot, staticData) {
    return has_any(snapshot, ['Mutalisk', 'Corruptor'])
        && has(snapshot, 'Brood Lord Aspect (Mutalisk/Corruptor)');
}

/**
 * Morph Viper
 */
export function morph_viper(snapshot, staticData) {
    return has_any(snapshot, ['Mutalisk', 'Corruptor'])
        && has(snapshot, 'Viper Aspect (Mutalisk/Corruptor)');
}

/**
 * Morph Impaler or Lurker
 */
export function morph_impaler_or_lurker(snapshot, staticData) {
    return has(snapshot, 'Hydralisk')
        && has_any(snapshot, ['Impaler Aspect (Hydralisk)', 'Lurker Aspect (Hydralisk)']);
}

/**
 * Zerg competent composition
 */
export function zerg_competent_comp(snapshot, staticData) {
    const advanced = isAdvancedTactics(staticData);

    const coreUnit = has_any(snapshot, ['Roach', 'Aberration', 'Zergling']);
    const supportUnit = has_any(snapshot, ['Swarm Queen', 'Hydralisk'])
        || morph_brood_lord(snapshot, staticData)
        || (advanced && (has_any(snapshot, ['Infestor', 'Defiler']) || morph_viper(snapshot, staticData)));

    if (coreUnit && supportUnit) {
        return true;
    }

    const vespeneUnit = has_any(snapshot, ['Ultralisk', 'Aberration'])
        || (advanced && morph_viper(snapshot, staticData));
    return vespeneUnit && has_any(snapshot, ['Zergling', 'Swarm Queen']);
}

/**
 * Spread creep
 */
export function spread_creep(snapshot, staticData) {
    return isAdvancedTactics(staticData) || has(snapshot, 'Swarm Queen');
}

/**
 * Two Kerrigan actives - check if player has at least 2 tiers of active abilities
 */
export function two_kerrigan_actives(snapshot, staticData) {
    // kerrigan_actives is a list of sets, one for each progression tier
    // The tier numbers in item names don't match array indices
    const kerriganActivesTiers = [
        ['Kinetic Blast (Kerrigan Tier 1)', 'Leaping Strike (Kerrigan Tier 1)'],
        ['Crushing Grip (Kerrigan Tier 2)', 'Psionic Shift (Kerrigan Tier 2)'],
        [],  // Tier 2 has no actives
        ['Wild Mutation (Kerrigan Tier 4)', 'Spawn Banelings (Kerrigan Tier 1)', 'Mend (Kerrigan Tier 4)'],
        [],  // Tier 4 has no actives
        [],  // Tier 5 has no actives
        ['Apocalypse (Kerrigan Tier 7)', 'Spawn Leviathan (Kerrigan Tier 7)', 'Drop-Pods (Kerrigan Tier 7)']
    ];

    let count = 0;
    for (const tier of kerriganActivesTiers) {
        if (tier.length > 0 && has_any(snapshot, tier)) {
            count++;
        }
    }

    return count >= 2;
}

/**
 * Basic Kerrigan - check if player has basic Kerrigan setup
 */
export function basic_kerrigan(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);

    // List of active abilities that can defeat enemies directly
    const directCombatAbilities = [
        'Kinetic Blast (Kerrigan Tier 1)',
        'Leaping Strike (Kerrigan Tier 1)',
        'Crushing Grip (Kerrigan Tier 2)',
        'Psionic Shift (Kerrigan Tier 2)',
        'Spawn Banelings (Kerrigan Tier 1)'
    ];

    // On standard tactics (not advanced), require at least one direct combat ability
    if (!advancedTactics && !has_any(snapshot, directCombatAbilities)) {
        return false;
    }

    // All non-ultimate Kerrigan abilities
    const kerriganAbilities = [
        'Kinetic Blast (Kerrigan Tier 1)',
        'Leaping Strike (Kerrigan Tier 1)',
        'Heroic Fortitude (Kerrigan Tier 1)',
        'Chain Reaction (Kerrigan Tier 2)',
        'Crushing Grip (Kerrigan Tier 2)',
        'Psionic Shift (Kerrigan Tier 2)',
        'Spawn Banelings (Kerrigan Tier 1)',
        'Infest Broodlings (Kerrigan Tier 6)',
        'Fury (Kerrigan Tier 6)'
    ];

    // Count how many non-ultimate abilities the player has
    let count = 0;
    for (const ability of kerriganAbilities) {
        if (has(snapshot, ability)) {
            count++;
            if (count >= 2) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Kerrigan levels - check if player has enough Kerrigan levels
 */
export function kerrigan_levels(snapshot, staticData, target) {
    const settings = staticData?.settings || {};
    const storyLevelsGranted = settings.story_levels_granted || false;
    const kerriganUnitAvailable = settings.kerrigan_unit_available || false;

    // If story levels are granted or Kerrigan is not available as a unit, levels are granted
    if (storyLevelsGranted || !kerriganUnitAvailable) {
        return true;
    }

    // For item placement (not pool filtering), calculate actual levels
    // Check if we're in item placement mode
    const isItemPlacement = snapshot?.inventory && Object.keys(snapshot.inventory).length > 0;

    const levelsPerMissionCompleted = settings.kerrigan_levels_per_mission_completed || 0;
    const levelsPerMissionCap = settings.kerrigan_levels_per_mission_completed_cap || 0;

    if (levelsPerMissionCompleted > 0 && levelsPerMissionCap > 0 && !isItemPlacement) {
        // Pool filtering - assume missions will be completed
        return true;
    }

    // Calculate levels from missions beaten
    let levels = 0;

    // Count Beat missions (missions in the Missions group)
    const inventory = snapshot?.inventory || {};
    let missionCount = 0;
    for (const [itemName, itemCount] of Object.entries(inventory)) {
        if (itemName.startsWith('Beat ')) {
            missionCount += itemCount;
        }
    }

    levels = levelsPerMissionCompleted * missionCount;
    if (levelsPerMissionCap !== -1) {
        levels = Math.min(levels, levelsPerMissionCap);
    }

    // Add levels from Kerrigan level items
    const kerriganLevelItems = {
        'Kerrigan Level 1': 1,
        'Kerrigan Level 2': 2,
        'Kerrigan Level 3': 3,
        'Kerrigan Level 4': 4,
        'Kerrigan Level 5': 5,
        'Kerrigan Level 6': 6,
        'Kerrigan Level 7': 7,
        'Kerrigan Level 8': 8,
        'Kerrigan Level 9': 9,
        'Kerrigan Level 10': 10,
        'Kerrigan Level 11': 11,
        'Kerrigan Level 12': 12,
        'Kerrigan Level 13': 13,
        'Kerrigan Level 14': 14
    };

    for (const [itemName, levelAmount] of Object.entries(kerriganLevelItems)) {
        const itemCount = count(snapshot, itemName);
        levels += itemCount * levelAmount;
    }

    // Apply total level cap
    const totalLevelCap = settings.kerrigan_total_level_cap || -1;
    if (totalLevelCap !== -1) {
        levels = Math.min(levels, totalLevelCap);
    }

    return levels >= target;
}

// Export all helpers
export default {
    terran_common_unit,
    terran_early_tech,
    terran_air,
    terran_air_anti_air,
    terran_competent_ground_to_air,
    terran_competent_anti_air,
    terran_bio_heal,
    terran_basic_anti_air,
    terran_competent_comp,

    // Add stubs for all other helpers that may be needed
    // These will return false for now and can be implemented as needed
    terran_defense_rating: (snapshot, staticData, zergEnemy, airEnemy = true) => {
        // Base defense ratings for units
        const defenseRatings = {
            'Siege Tank': 5,
            'Planetary Fortress': 3,
            'Perdition Turret': 2,
            'Vulture': 1,
            'Banshee': 1,
            'Battlecruiser': 1,
            'Liberator': 4,
            'Widow Mine': 1
        };

        // Zerg-specific defense ratings
        const zergDefenseRatings = {
            'Perdition Turret': 2,
            'Liberator': -2,  // Liberator is worse against zerg
            'Hive Mind Emulator': 3,
            'Psi Disrupter': 3
        };

        // Air-specific defense ratings
        const airDefenseRatings = {
            'Missile Turret': 2
        };

        let defenseScore = 0;

        // Sum base defense ratings
        for (const [item, rating] of Object.entries(defenseRatings)) {
            if (has(snapshot, item)) {
                defenseScore += rating;
            }
        }

        // Manned Bunker
        if (has_any(snapshot, ['Marine', 'Marauder']) && has(snapshot, 'Bunker')) {
            defenseScore += 3;
        } else if (zergEnemy && has(snapshot, 'Firebat') && has(snapshot, 'Bunker')) {
            defenseScore += 2;
        }

        // Siege Tank upgrades
        if (has_all(snapshot, ['Siege Tank', 'Maelstrom Rounds (Siege Tank)'])) {
            defenseScore += 2;
        }
        if (has_all(snapshot, ['Siege Tank', 'Graduating Range (Siege Tank)'])) {
            defenseScore += 1;
        }

        // Widow Mine upgrade
        if (has_all(snapshot, ['Widow Mine', 'Concealment (Widow Mine)'])) {
            defenseScore += 1;
        }

        // Viking with splash
        if (has_all(snapshot, ['Viking', 'Shredder Rounds (Viking)'])) {
            defenseScore += 2;
        }

        // Enemy-specific ratings
        if (zergEnemy) {
            for (const [item, rating] of Object.entries(zergDefenseRatings)) {
                if (has(snapshot, item)) {
                    defenseScore += rating;
                }
            }
        }

        if (airEnemy) {
            for (const [item, rating] of Object.entries(airDefenseRatings)) {
                if (has(snapshot, item)) {
                    defenseScore += rating;
                }
            }
        }

        // Valkyries shred mass Mutas
        if (airEnemy && zergEnemy && has(snapshot, 'Valkyrie')) {
            defenseScore += 2;
        }

        // Advanced Tactics bumps defense rating down by 2
        if (isAdvancedTactics(staticData)) {
            defenseScore += 2;
        }

        return defenseScore;
    },
    terran_mobile_detector: () => false,
    terran_beats_protoss_deathball: () => false,
    terran_base_trasher: () => false,
    terran_can_rescue: () => false,
    terran_cliffjumper: () => false,
    terran_able_to_snipe_defiler: () => false,
    terran_respond_to_colony_infestations: () => false,
    terran_survives_rip_field: () => false,
    terran_sustainable_mech_heal: () => false,

    protoss_common_unit,
    protoss_basic_anti_air,
    protoss_competent_anti_air,
    protoss_basic_splash,
    protoss_anti_armor_anti_air,
    protoss_anti_light_anti_air,
    protoss_can_attack_behind_chasm,
    protoss_has_blink,
    protoss_heal,
    protoss_stalker_upgrade,
    protoss_static_defense,
    protoss_fleet,
    protoss_competent_comp,
    protoss_hybrid_counter,

    zerg_common_unit: (snapshot, staticData) => {
        const advancedTactics = isAdvancedTactics(staticData);

        // Basic zerg units (standard logic)
        const basicUnits = ['Zergling', 'Swarm Queen', 'Roach', 'Hydralisk'];

        if (has_any(snapshot, basicUnits)) {
            return true;
        }

        // Advanced tactics also includes Infestor and Aberration
        if (advancedTactics) {
            return has_any(snapshot, ['Infestor', 'Aberration']);
        }

        return false;
    },
    zerg_competent_anti_air,
    zerg_basic_anti_air,
    zerg_competent_comp,
    zerg_competent_defense: () => false,
    zerg_pass_vents: () => false,

    spread_creep,
    morph_brood_lord,
    morph_impaler_or_lurker,
    morph_viper,

    basic_kerrigan,
    kerrigan_levels,
    two_kerrigan_actives,

    marine_medic_upgrade: () => false,
    can_nuke: () => false,

    nova_any_weapon: () => false,
    nova_ranged_weapon: () => false,
    nova_splash: () => false,
    nova_full_stealth: () => false,
    nova_dash: () => false,
    nova_heal: () => false,
    nova_escape_assist: () => false,

    great_train_robbery_train_stopper: () => false,
    welcome_to_the_jungle_requirement: () => false,
    night_terrors_requirement: () => false,
    engine_of_destruction_requirement: () => false,
    trouble_in_paradise_requirement: () => false,
    sudden_strike_requirement: () => false,
    sudden_strike_can_reach_objectives: () => false,
    enemy_intelligence_first_stage_requirement: () => false,
    enemy_intelligence_second_stage_requirement: () => false,
    enemy_intelligence_third_stage_requirement: () => false,
    enemy_intelligence_cliff_garrison: () => false,
    enemy_intelligence_garrisonable_unit: () => false,
    the_escape_first_stage_requirement: () => false,
    the_escape_requirement: () => false,
    the_escape_stuff_granted: () => false,
    /**
     * Brothers in Arms mission requirement
     */
    brothers_in_arms_requirement: (snapshot, staticData) => {
        const take_over_ai_allies = staticData?.settings?.take_over_ai_allies || staticData?.settings?.['1']?.take_over_ai_allies || false;

        return (
            protoss_common_unit(snapshot, staticData)
            && protoss_anti_armor_anti_air(snapshot, staticData)
            && protoss_hybrid_counter(snapshot, staticData)
        ) || (
            take_over_ai_allies
            && (
                terran_common_unit(snapshot, staticData)
                || protoss_common_unit(snapshot, staticData)
            )
            && (
                terran_competent_anti_air(snapshot, staticData)
                || protoss_anti_armor_anti_air(snapshot, staticData)
            )
            && (
                protoss_hybrid_counter(snapshot, staticData)
                || has_any(snapshot, ['Battlecruiser', 'Liberator', 'Siege Tank'])
                || has_all(snapshot, ['Spectre', 'Spectre Psionic Lash'])
                || (has(snapshot, 'Immortal')
                    && has_any(snapshot, ['Marine', 'Marauder'])
                    && terran_bio_heal(snapshot, staticData))
            )
        );
    },
    dark_skies_requirement: () => false,
    last_stand_requirement: (snapshot, staticData) => {
        const advancedTactics = isAdvancedTactics(staticData);

        return protoss_common_unit(snapshot, staticData)
            && protoss_competent_anti_air(snapshot, staticData)
            && protoss_static_defense(snapshot, staticData)
            && (advancedTactics || protoss_basic_splash(snapshot, staticData));
    },
    end_game_requirement: () => false,
    enemy_shadow_first_stage: () => false,
    enemy_shadow_second_stage: () => false,
    enemy_shadow_victory: () => false,
    enemy_shadow_door_controls: () => false,
    enemy_shadow_door_unlocks_tool: () => false,
    enemy_shadow_tripwires_tool: () => false,
    enemy_shadow_domination: () => false,
    salvation_requirement: () => false,
    steps_of_the_rite_requirement: () => false,
    templars_return_requirement: () => false,
    templars_charge_requirement: () => false,
    the_infinite_cycle_requirement: (snapshot, staticData) => {
        const settings = staticData?.settings || {};
        const storyTechGranted = settings.story_tech_granted || false;
        const kerriganUnitAvailable = settings.kerrigan_unit_available || false;

        return storyTechGranted
            || !kerriganUnitAvailable
            || (two_kerrigan_actives(snapshot, staticData)
                && basic_kerrigan(snapshot, staticData)
                && kerrigan_levels(snapshot, staticData, 70));
    },
    harbinger_of_oblivion_requirement: () => false,
    supreme_requirement: () => false,
    the_host_requirement: () => false,
    into_the_void_requirement: () => false,
    essence_of_eternity_requirement: () => false,
    amons_fall_requirement: () => false,
    the_reckoning_requirement: () => false,
    all_in_requirement: () => false,
    flashpoint_far_requirement: () => false,
    lock_any_item: () => false,
    is_item_placement: () => true
};
