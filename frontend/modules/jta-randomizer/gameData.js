/**
 * Journey to Ascension - Game Data
 * Extracted from the game source for simulation purposes
 */

// Skill types
export const SkillType = {
    Charisma: 0,
    Study: 1,
    Combat: 2,
    Search: 3,
    Subterfuge: 4,
    Crafting: 5,
    Survival: 6,
    Travel: 7,
    Magic: 8,
    Fortitude: 9,
    Druid: 10,
    Ascension: 11,
    Count: 12,
};

export const SKILL_NAMES = [
    'Charisma', 'Study', 'Combat', 'Search', 'Subterfuge', 'Crafting',
    'Survival', 'Travel', 'Magic', 'Fortitude', 'Druid', 'Ascension'
];

// Skill XP multipliers (higher = slower to level)
export const SKILL_XP_MULT = {
    [SkillType.Charisma]: 1,
    [SkillType.Study]: 1,
    [SkillType.Combat]: 5,
    [SkillType.Search]: 1,
    [SkillType.Subterfuge]: 1,
    [SkillType.Crafting]: 1,
    [SkillType.Survival]: 1,
    [SkillType.Travel]: 1,
    [SkillType.Magic]: 3,
    [SkillType.Fortitude]: 10,
    [SkillType.Druid]: 20,
    [SkillType.Ascension]: 1000,
};

// Task types
export const TaskType = {
    Normal: 0,
    Travel: 1,
    Mandatory: 2,
    Prestige: 3,
    Boss: 4,
};

// Perk types
export const PerkType = {
    Reading: 0,
    Writing: 1,
    VillagerGratitude: 2,
    Amulet: 3,
    EnergySpell: 4,
    ExperiencedTraveler: 5,
    UndergroundConnection: 6,
    MinorTimeCompression: 7,
    HighAltitudeClimbing: 8,
    DELETED: 9,
    VillageHero: 10,
    Attunement: 11,
    GoblinScourge: 12,
    SunkenTreasure: 13,
    LostTemple: 14,
    WalkWithoutRhythm: 15,
    ReflectionsOnTheJourney: 16,
    PurgedBureaucracy: 17,
    DeepSeaDiving: 18,
    EnergeticMemory: 19,
    TheWorm: 20,
    TowerOfBabel: 21,
    Awakening: 22,
    MajorTimeCompression: 23,
    HideInPlainSight: 24,
    DreamPrism: 25,
    DragonKillingPlan: 26,
    UnifiedTheoryOfMagic: 27,
    Headmaster: 28,
    DragonSlayer: 29,
    Count: 30,
};

export const PERK_NAMES = [
    'Reading', 'Writing', 'VillagerGratitude', 'Amulet', 'EnergySpell',
    'ExperiencedTraveler', 'UndergroundConnection', 'MinorTimeCompression',
    'HighAltitudeClimbing', 'DELETED', 'VillageHero', 'Attunement',
    'GoblinScourge', 'SunkenTreasure', 'LostTemple', 'WalkWithoutRhythm',
    'ReflectionsOnTheJourney', 'PurgedBureaucracy', 'DeepSeaDiving',
    'EnergeticMemory', 'TheWorm', 'TowerOfBabel', 'Awakening',
    'MajorTimeCompression', 'HideInPlainSight', 'DreamPrism',
    'DragonKillingPlan', 'UnifiedTheoryOfMagic', 'Headmaster', 'DragonSlayer'
];

// Perk definitions with skill modifiers
export const PERKS = {
    [PerkType.Reading]: {
        name: 'How to Read',
        skillModifiers: { [SkillType.Study]: 0.5 },
        special: null,
    },
    [PerkType.Writing]: {
        name: 'How to Write',
        skillModifiers: {},
        special: 'xp_bonus_50',
    },
    [PerkType.VillagerGratitude]: {
        name: 'Villager Gratitude',
        skillModifiers: { [SkillType.Charisma]: 0.5 },
        special: null,
    },
    [PerkType.Amulet]: {
        name: 'Mysterious Amulet',
        skillModifiers: { [SkillType.Magic]: 0.5 },
        special: 'automation',
    },
    [PerkType.EnergySpell]: {
        name: 'Energetic Spell',
        skillModifiers: {},
        special: 'max_energy_50',
    },
    [PerkType.ExperiencedTraveler]: {
        name: 'Experienced Traveler',
        skillModifiers: { [SkillType.Travel]: 0.5 },
        special: null,
    },
    [PerkType.UndergroundConnection]: {
        name: 'Underground Connection',
        skillModifiers: { [SkillType.Subterfuge]: 0.4, [SkillType.Charisma]: 0.2 },
        special: null,
    },
    [PerkType.MinorTimeCompression]: {
        name: 'Minor Time Compression',
        skillModifiers: {},
        special: 'minor_time_compression',
    },
    [PerkType.HighAltitudeClimbing]: {
        name: 'High Altitude Climbing',
        skillModifiers: {},
        special: 'energy_reduction_20',
    },
    [PerkType.VillageHero]: {
        name: 'Village Hero',
        skillModifiers: { [SkillType.Charisma]: 0.4, [SkillType.Combat]: 0.2 },
        special: null,
    },
    [PerkType.Attunement]: {
        name: 'Attunement',
        skillModifiers: {},
        special: 'attunement',
    },
    [PerkType.GoblinScourge]: {
        name: 'Goblin Scourge',
        skillModifiers: { [SkillType.Combat]: 0.3, [SkillType.Fortitude]: 0.3 },
        special: null,
    },
    [PerkType.SunkenTreasure]: {
        name: 'Sunken Treasure',
        skillModifiers: { [SkillType.Survival]: 0.3, [SkillType.Fortitude]: 0.3 },
        special: null,
    },
    [PerkType.LostTemple]: {
        name: 'Found Lost Temple',
        skillModifiers: { [SkillType.Druid]: 0.5 },
        special: null,
    },
    [PerkType.WalkWithoutRhythm]: {
        name: 'Walk Without Rhythm',
        skillModifiers: { [SkillType.Subterfuge]: 0.4, [SkillType.Travel]: 0.2 },
        special: null,
    },
    [PerkType.ReflectionsOnTheJourney]: {
        name: 'Reflections on the Journey',
        skillModifiers: {},
        special: 'reflections',
    },
    [PerkType.PurgedBureaucracy]: {
        name: 'Purged Bureaucracy',
        skillModifiers: { [SkillType.Charisma]: 0.3, [SkillType.Crafting]: 0.3 },
        special: null,
    },
    [PerkType.DeepSeaDiving]: {
        name: 'Deep Sea Diving',
        skillModifiers: { [SkillType.Search]: 0.3, [SkillType.Druid]: 0.3 },
        special: null,
    },
    [PerkType.EnergeticMemory]: {
        name: 'Energetic Memory',
        skillModifiers: {},
        special: 'energetic_memory',
    },
    [PerkType.TheWorm]: {
        name: 'The Worm',
        skillModifiers: { [SkillType.Charisma]: 0.5 },
        special: null,
    },
    [PerkType.TowerOfBabel]: {
        name: 'Tower of Babel',
        skillModifiers: { [SkillType.Charisma]: 0.3, [SkillType.Ascension]: 0.3 },
        special: null,
    },
    [PerkType.Awakening]: {
        name: 'Awakening',
        skillModifiers: {},
        special: 'divine_spark_bonus',
    },
    [PerkType.MajorTimeCompression]: {
        name: 'Major Time Compression',
        skillModifiers: {},
        special: 'major_time_compression',
    },
    [PerkType.HideInPlainSight]: {
        name: 'Hide in Plain Sight',
        skillModifiers: { [SkillType.Subterfuge]: 0.5 },
        special: null,
    },
    [PerkType.DreamPrism]: {
        name: 'Dream Prism',
        skillModifiers: { [SkillType.Magic]: 0.3, [SkillType.Travel]: 0.3 },
        special: null,
    },
    [PerkType.DragonKillingPlan]: {
        name: 'Dragon Killing Plan',
        skillModifiers: { [SkillType.Combat]: 0.5 },
        special: null,
    },
    [PerkType.UnifiedTheoryOfMagic]: {
        name: 'Unified Theory of Magic',
        skillModifiers: {},
        special: 'unified_theory',
    },
    [PerkType.Headmaster]: {
        name: 'Headmaster',
        skillModifiers: { [SkillType.Magic]: 0.3, [SkillType.Study]: 0.3 },
        special: null,
    },
    [PerkType.DragonSlayer]: {
        name: 'Dragon Slayer',
        skillModifiers: { [SkillType.Combat]: 0.3, [SkillType.Charisma]: 0.3 },
        special: null,
    },
};

// Item types (simplified - only tracking energy-giving items)
export const ItemType = {
    Food: 0,        // +5 energy
    Fish: 13,       // +10 energy
    Calamari: 19,   // +50 energy
    CaveInsects: 29, // +5 energy
};

export const ENERGY_ITEMS = {
    [ItemType.Food]: 5,
    [ItemType.Fish]: 10,
    [ItemType.Calamari]: 50,
    [ItemType.CaveInsects]: 5,
};

// Zone data extracted from zones.ts
export const ZONES = [
    {
        id: 0,
        name: "The Village",
        tasks: [
            { id: 10, name: "Join the Watch", type: TaskType.Travel, costMult: 4, skills: [SkillType.Charisma], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 11, name: "Read Noticeboard", type: TaskType.Mandatory, costMult: 3, skills: [SkillType.Study], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 12, name: "Train with Weapons", type: TaskType.Mandatory, costMult: 1, skills: [SkillType.Combat], xpMult: 3, maxReps: 3, perk: null, item: null },
            { id: 13, name: "Learn How to Read", type: TaskType.Normal, costMult: 8, skills: [SkillType.Study], xpMult: 0.5, maxReps: 1, perk: PerkType.Reading, item: null },
            { id: 14, name: "Beg for Food", type: TaskType.Normal, costMult: 1, skills: [SkillType.Charisma], xpMult: 2, maxReps: 10, perk: null, item: ItemType.Food },
            { id: 15, name: "Hide and Seek", type: TaskType.Normal, costMult: 2, skills: [SkillType.Search, SkillType.Subterfuge], xpMult: 1.5, maxReps: 3, perk: null, item: null },
            { id: 16, name: "Observe Surroundings", type: TaskType.Normal, costMult: 1, skills: [SkillType.Study], xpMult: 3, maxReps: 5, perk: null, item: null },
        ],
    },
    {
        id: 1,
        name: "The Village Watch",
        tasks: [
            { id: 20, name: "Notice Smoke in the Distance", type: TaskType.Travel, costMult: 3, skills: [SkillType.Survival], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 21, name: "Learn Routines", type: TaskType.Mandatory, costMult: 1.3, skills: [SkillType.Study], xpMult: 1, maxReps: 4, perk: null, item: null },
            { id: 22, name: "Deal with Drunkards", type: TaskType.Mandatory, costMult: 1.6, skills: [SkillType.Charisma], xpMult: 1, maxReps: 2, perk: null, item: null },
            { id: 25, name: "Fletch Arrows", type: TaskType.Normal, costMult: 0.4, skills: [SkillType.Crafting], xpMult: 1, maxReps: 5, perk: null, item: 'Arrow' },
            { id: 27, name: "Learn How to Write", type: TaskType.Normal, costMult: 20, skills: [SkillType.Study], xpMult: 0.2, maxReps: 1, perk: PerkType.Writing, item: null },
            { id: 23, name: "Chit-chat", type: TaskType.Normal, costMult: 1, skills: [SkillType.Charisma], xpMult: 3, maxReps: 3, perk: null, item: null },
            { id: 24, name: "Sparring", type: TaskType.Normal, costMult: 1.5, skills: [SkillType.Combat], xpMult: 5, maxReps: 4, perk: null, item: null },
            { id: 26, name: "Daydream About Leaving", type: TaskType.Normal, costMult: 1, skills: [SkillType.Travel, SkillType.Survival], xpMult: 3, maxReps: 6, perk: null, item: null },
        ],
    },
    {
        id: 2,
        name: "The Raid",
        tasks: [
            { id: 30, name: "Enter the Wilderness", type: TaskType.Travel, costMult: 2, skills: [SkillType.Travel], xpMult: 0.5, maxReps: 1, perk: null, item: null },
            { id: 31, name: "Fight a Goblin", type: TaskType.Mandatory, costMult: 3.5, skills: [SkillType.Combat], xpMult: 3, maxReps: 1, perk: null, item: null },
            { id: 32, name: "Warn Villagers", type: TaskType.Mandatory, costMult: 3, skills: [SkillType.Charisma], xpMult: 1, maxReps: 3, perk: null, item: null },
            { id: 33, name: "Loot the Fallen", type: TaskType.Normal, costMult: 0.5, skills: [SkillType.Search], xpMult: 1, maxReps: 4, perk: null, item: 'Coin' },
            { id: 34, name: "Rescue Villager", type: TaskType.Normal, costMult: 1, skills: [SkillType.Subterfuge, SkillType.Search], xpMult: 1.5, maxReps: 3, perk: PerkType.VillagerGratitude, item: null },
            { id: 35, name: "Treat Villager Wounds", type: TaskType.Normal, costMult: 1.5, skills: [SkillType.Survival, SkillType.Crafting], xpMult: 3, maxReps: 3, perk: null, item: null },
            { id: 36, name: "Goblin Warlord", type: TaskType.Boss, costMult: 1300, skills: [SkillType.Combat], xpMult: 1, maxReps: 1, perk: null, item: 'GoblinWaraxe' },
            { id: 37, name: "Save the Village", type: TaskType.Normal, costMult: 1300, skills: [SkillType.Combat, SkillType.Magic], xpMult: 1, maxReps: 1, perk: PerkType.VillageHero, item: null, hidden: true },
        ],
    },
    {
        id: 3,
        name: "The Wilderness",
        tasks: [
            { id: 40, name: "Find Cave Entrance", type: TaskType.Travel, costMult: 2, skills: [SkillType.Travel, SkillType.Search], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 41, name: "Look for Tracks", type: TaskType.Mandatory, costMult: 0.5, skills: [SkillType.Search, SkillType.Subterfuge], xpMult: 1, maxReps: 3, perk: null, item: null },
            { id: 42, name: "Survive the Night", type: TaskType.Mandatory, costMult: 2.5, skills: [SkillType.Survival], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 43, name: "Find an Amulet", type: TaskType.Mandatory, costMult: 2.5, skills: [SkillType.Search, SkillType.Magic], xpMult: 0.1, maxReps: 1, perk: PerkType.Amulet, item: null },
            { id: 45, name: "Forage for Mushrooms", type: TaskType.Normal, costMult: 0.3, skills: [SkillType.Search], xpMult: 2, maxReps: 5, perk: null, item: 'Mushroom' },
            { id: 44, name: "Build a Fire", type: TaskType.Normal, costMult: 2, skills: [SkillType.Survival, SkillType.Crafting], xpMult: 3, maxReps: 1, perk: null, item: null },
            { id: 46, name: "Befriend a Deer", type: TaskType.Normal, costMult: 2, skills: [SkillType.Charisma], xpMult: 3, maxReps: 1, perk: null, item: null },
            { id: 47, name: "Angry Ent", type: TaskType.Boss, costMult: 12000, skills: [SkillType.Combat], xpMult: 1, maxReps: 1, perk: null, item: 'MagicalRoots' },
            { id: 48, name: "Gather Magical Roots", type: TaskType.Normal, costMult: 15, skills: [SkillType.Search], xpMult: 1, maxReps: 3, perk: null, item: 'MagicalRoots', hidden: true },
        ],
    },
    {
        id: 4,
        name: "The Cave System",
        tasks: [
            { id: 50, name: "Leave Via Back Entrance", type: TaskType.Travel, costMult: 2, skills: [SkillType.Travel], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 51, name: "Find a Way Through", type: TaskType.Mandatory, costMult: 2, skills: [SkillType.Search], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 52, name: "Rescue Captives", type: TaskType.Mandatory, costMult: 1.5, skills: [SkillType.Charisma, SkillType.Subterfuge], xpMult: 1, maxReps: 3, perk: null, item: null },
            { id: 53, name: "Steal Supplies", type: TaskType.Normal, costMult: 0.3, skills: [SkillType.Subterfuge], xpMult: 1, maxReps: 5, perk: null, item: 'GoblinSupplies' },
            { id: 54, name: "Try Casting a Spell", type: TaskType.Normal, costMult: 3, skills: [SkillType.Magic, SkillType.Study], xpMult: 1, maxReps: 6, perk: PerkType.EnergySpell, item: null },
            { id: 55, name: "Inspect Wall Paintings", type: TaskType.Normal, costMult: 2, skills: [SkillType.Study], xpMult: 4, maxReps: 1, perk: null, item: null },
            { id: 56, name: "Scout the Cave", type: TaskType.Normal, costMult: 0.5, skills: [SkillType.Search], xpMult: 3, maxReps: 3, perk: null, item: null },
            { id: 57, name: "Goblin Chieftain", type: TaskType.Boss, costMult: 10000, skills: [SkillType.Combat], xpMult: 1, maxReps: 1, perk: null, item: 'GoblinTreasure' },
            { id: 58, name: "Wipe Out Goblins", type: TaskType.Normal, costMult: 10000, skills: [SkillType.Combat], xpMult: 0.3, maxReps: 1, perk: PerkType.GoblinScourge, item: null, hidden: true },
        ],
    },
    {
        id: 5,
        name: "The Road to the City",
        tasks: [
            { id: 60, name: "Get to the City", type: TaskType.Travel, costMult: 3, skills: [SkillType.Travel], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 61, name: "Join a Caravan", type: TaskType.Mandatory, costMult: 4, skills: [SkillType.Charisma], xpMult: 0.5, maxReps: 1, perk: null, item: null },
            { id: 62, name: "Scout the Road Ahead", type: TaskType.Mandatory, costMult: 1.3, skills: [SkillType.Study, SkillType.Search, SkillType.Survival], xpMult: 1, maxReps: 3, perk: null, item: null },
            { id: 63, name: "Make Travel Equipment", type: TaskType.Normal, costMult: 0.5, skills: [SkillType.Crafting], xpMult: 1, maxReps: 4, perk: null, item: 'TravelEquipment' },
            { id: 64, name: "Get Used to Traveling", type: TaskType.Normal, costMult: 1, skills: [SkillType.Travel, SkillType.Fortitude], xpMult: 3, maxReps: 3, perk: PerkType.ExperiencedTraveler, item: null },
            { id: 65, name: "Chat with Travelers", type: TaskType.Normal, costMult: 1, skills: [SkillType.Charisma], xpMult: 3, maxReps: 4, perk: null, item: null },
            { id: 66, name: "Practice Traveling Unnoticed", type: TaskType.Normal, costMult: 2, skills: [SkillType.Subterfuge, SkillType.Survival], xpMult: 4, maxReps: 1, perk: null, item: null },
            { id: 67, name: "Bandits", type: TaskType.Boss, costMult: 10000, skills: [SkillType.Combat], xpMult: 1, maxReps: 1, perk: null, item: 'BanditWeapons' },
            { id: 68, name: "Loot Bandit Camp", type: TaskType.Normal, costMult: 35, skills: [SkillType.Subterfuge, SkillType.Search], xpMult: 3, maxReps: 4, perk: null, item: 'BanditWeapons', hidden: true },
        ],
    },
    {
        id: 6,
        name: "The City Outskirts",
        tasks: [
            { id: 70, name: "Enter the City", type: TaskType.Travel, costMult: 1.5, skills: [SkillType.Travel], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 71, name: "Bribe the City Guards", type: TaskType.Mandatory, costMult: 4, skills: [SkillType.Charisma], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 72, name: "Survive a Mugging", type: TaskType.Mandatory, costMult: 1, skills: [SkillType.Combat, SkillType.Fortitude], xpMult: 0.75, maxReps: 1, perk: null, item: null },
            { id: 73, name: "Buy a Book", type: TaskType.Normal, costMult: 1, skills: [SkillType.Charisma], xpMult: 1, maxReps: 5, perk: null, item: 'Book' },
            { id: 74, name: "Negotiate with a Rogue Guard", type: TaskType.Normal, costMult: 12, skills: [SkillType.Charisma, SkillType.Subterfuge], xpMult: 0.3, maxReps: 1, perk: PerkType.UndergroundConnection, item: null },
            { id: 75, name: "Spar with the Guards", type: TaskType.Normal, costMult: 1, skills: [SkillType.Combat], xpMult: 1.5, maxReps: 3, perk: null, item: null },
            { id: 76, name: "Fend for Yourself", type: TaskType.Normal, costMult: 1, skills: [SkillType.Survival, SkillType.Fortitude], xpMult: 4, maxReps: 1, perk: null, item: null },
            { id: 77, name: "Skulk About", type: TaskType.Normal, costMult: 2, skills: [SkillType.Subterfuge], xpMult: 5, maxReps: 1, perk: null, item: null },
        ],
    },
    {
        id: 7,
        name: "The City",
        tasks: [
            { id: 80, name: "Embark on a Quest", type: TaskType.Travel, costMult: 4, skills: [SkillType.Travel], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 81, name: "Investigate Rumors of a Magician", type: TaskType.Mandatory, costMult: 1.5, skills: [SkillType.Charisma, SkillType.Search], xpMult: 1, maxReps: 4, perk: null, item: null },
            { id: 82, name: "Search the Archives for Magic", type: TaskType.Mandatory, costMult: 1.2, skills: [SkillType.Study, SkillType.Search], xpMult: 1, maxReps: 5, perk: null, item: null },
            { id: 83, name: "Scribe Scroll of Haste", type: TaskType.Normal, costMult: 2, skills: [SkillType.Crafting, SkillType.Magic], xpMult: 1, maxReps: 1, perk: null, item: 'ScrollOfHaste' },
            { id: 84, name: "Cast a Spell", type: TaskType.Normal, costMult: 1, skills: [SkillType.Magic], xpMult: 0.2, maxReps: 6, perk: PerkType.MinorTimeCompression, item: null },
            { id: 85, name: "Study at the Mage's Guild", type: TaskType.Normal, costMult: 2, skills: [SkillType.Study, SkillType.Magic], xpMult: 2, maxReps: 1, perk: null, item: null },
            { id: 86, name: "Train for Your Quest", type: TaskType.Normal, costMult: 1, skills: [SkillType.Search, SkillType.Survival, SkillType.Fortitude], xpMult: 3, maxReps: 3, perk: null, item: null },
            { id: 87, name: "Corrupt Mayor", type: TaskType.Boss, costMult: 10000, skills: [SkillType.Combat], xpMult: 1, maxReps: 1, perk: null, item: 'CityChain' },
            { id: 89, name: "Purge Corrupt Bureaucracy", type: TaskType.Normal, costMult: 100000, skills: [SkillType.Study, SkillType.Subterfuge], xpMult: 0.02, maxReps: 1, perk: PerkType.PurgedBureaucracy, item: null, hidden: true },
        ],
    },
    {
        id: 8,
        name: "The Forest",
        tasks: [
            { id: 90, name: "Scale the Mountain", type: TaskType.Travel, costMult: 2, skills: [SkillType.Travel, SkillType.Fortitude], xpMult: 1, maxReps: 1, perk: PerkType.HighAltitudeClimbing, item: null },
            { id: 91, name: "Locate the Mountain", type: TaskType.Mandatory, costMult: 2, skills: [SkillType.Survival, SkillType.Search], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 92, name: "Make Climbing Gear", type: TaskType.Mandatory, costMult: 0.4, skills: [SkillType.Crafting], xpMult: 1, maxReps: 3, perk: null, item: null },
            { id: 93, name: "Create Firemaking Kit", type: TaskType.Normal, costMult: 0.15, skills: [SkillType.Crafting, SkillType.Survival], xpMult: 1, maxReps: 3, perk: null, item: 'FiremakingKit' },
            { id: 94, name: "Prepare to Scale the Mountain", type: TaskType.Normal, costMult: 1, skills: [SkillType.Survival, SkillType.Study, SkillType.Fortitude], xpMult: 4, maxReps: 3, perk: null, item: null },
            { id: 95, name: "Build a Hut", type: TaskType.Normal, costMult: 2, skills: [SkillType.Crafting, SkillType.Survival], xpMult: 3, maxReps: 1, perk: null, item: null },
            { id: 96, name: "Go Sightseeing", type: TaskType.Normal, costMult: 0.5, skills: [SkillType.Search, SkillType.Travel], xpMult: 3, maxReps: 3, perk: null, item: null },
            { id: 97, name: "Meet a Magical Creature", type: TaskType.Normal, costMult: 0.5, skills: [SkillType.Druid, SkillType.Charisma], xpMult: 3, maxReps: 1, perk: null, item: null },
            { id: 98, name: "Werewolf", type: TaskType.Boss, costMult: 20000, skills: [SkillType.Combat], xpMult: 1, maxReps: 1, perk: null, item: 'WerewolfFur' },
            { id: 99, name: "Gather Shed Fur from Lair", type: TaskType.Normal, costMult: 8, skills: [SkillType.Subterfuge], xpMult: 1, maxReps: 3, perk: null, item: 'WerewolfFur', hidden: true },
        ],
    },
    {
        id: 9,
        name: "The Magician",
        tasks: [
            { id: 100, name: "Hunt for the First Reagent", type: TaskType.Travel, costMult: 5, skills: [SkillType.Travel], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 101, name: "Convince the Magician", type: TaskType.Mandatory, costMult: 6, skills: [SkillType.Charisma], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 102, name: "Do a Favor", type: TaskType.Mandatory, costMult: 1, skills: [SkillType.Crafting, SkillType.Subterfuge], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 103, name: "Steal Some Reagents", type: TaskType.Normal, costMult: 0.15, skills: [SkillType.Subterfuge], xpMult: 1, maxReps: 4, perk: null, item: 'Reagents' },
            { id: 104, name: "Figure Out How to Attune", type: TaskType.Normal, costMult: 60, skills: [SkillType.Study, SkillType.Magic], xpMult: 0.1, maxReps: 1, perk: PerkType.Attunement, item: null },
            { id: 105, name: "Give Yourself a Pep Talk", type: TaskType.Normal, costMult: 1, skills: [SkillType.Charisma], xpMult: 4, maxReps: 1, perk: null, item: null },
            { id: 106, name: "Try to Transform Into an Eagle", type: TaskType.Normal, costMult: 1, skills: [SkillType.Druid, SkillType.Magic], xpMult: 4, maxReps: 1, perk: null, item: null },
            { id: 107, name: "Low-oxygen Exercise", type: TaskType.Normal, costMult: 0.5, skills: [SkillType.Fortitude, SkillType.Survival], xpMult: 4, maxReps: 5, perk: null, item: null },
        ],
    },
    {
        id: 10,
        name: "The Ocean",
        tasks: [
            { id: 110, name: "Land on Island", type: TaskType.Travel, costMult: 3, skills: [SkillType.Travel], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 111, name: "Weather a Storm", type: TaskType.Mandatory, costMult: 2, skills: [SkillType.Survival, SkillType.Fortitude], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 112, name: "Find the Island", type: TaskType.Mandatory, costMult: 0.8, skills: [SkillType.Search], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 113, name: "Catch Fish", type: TaskType.Normal, costMult: 0.4, skills: [SkillType.Survival], xpMult: 4, maxReps: 5, perk: null, item: ItemType.Fish },
            { id: 114, name: "Dive as a Squid", type: TaskType.Normal, costMult: 1.5, skills: [SkillType.Druid, SkillType.Search], xpMult: 0.5, maxReps: 3, perk: PerkType.SunkenTreasure, item: null },
            { id: 115, name: "Look for Land", type: TaskType.Normal, costMult: 0.5, skills: [SkillType.Search], xpMult: 8, maxReps: 3, perk: null, item: null },
            { id: 116, name: "Practice Transforming", type: TaskType.Normal, costMult: 1, skills: [SkillType.Druid], xpMult: 4, maxReps: 1, perk: null, item: null },
            { id: 117, name: "Kraken", type: TaskType.Boss, costMult: 15000, skills: [SkillType.Combat], xpMult: 0.5, maxReps: 1, perk: null, item: ItemType.Calamari },
            { id: 118, name: "Explore Kraken's Lair", type: TaskType.Normal, costMult: 15000, skills: [SkillType.Search, SkillType.Druid], xpMult: 0.6, maxReps: 1, perk: PerkType.DeepSeaDiving, item: null, hidden: true },
        ],
    },
    {
        id: 11,
        name: "The Island",
        tasks: [
            { id: 120, name: "Hunt for the Second Reagent", type: TaskType.Travel, costMult: 8, skills: [SkillType.Travel], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 121, name: "Gather Reagent", type: TaskType.Mandatory, costMult: 4, skills: [SkillType.Search, SkillType.Druid], xpMult: 1, maxReps: 3, perk: null, item: null },
            { id: 122, name: "Repair Ship", type: TaskType.Mandatory, costMult: 1.4, skills: [SkillType.Crafting], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 123, name: "Catch More Fish", type: TaskType.Normal, costMult: 1, skills: [SkillType.Survival], xpMult: 1, maxReps: 4, perk: null, item: ItemType.Fish },
            { id: 124, name: "Explore the Jungle", type: TaskType.Normal, costMult: 6, skills: [SkillType.Survival, SkillType.Search, SkillType.Travel], xpMult: 1, maxReps: 6, perk: PerkType.LostTemple, item: null },
            { id: 125, name: "Build Another Hut", type: TaskType.Normal, costMult: 2, skills: [SkillType.Crafting, SkillType.Survival], xpMult: 4, maxReps: 1, perk: null, item: null },
            { id: 126, name: "Talk to the Local Wildlife", type: TaskType.Normal, costMult: 2, skills: [SkillType.Druid, SkillType.Charisma], xpMult: 2, maxReps: 3, perk: null, item: null },
            { id: 127, name: "Horde of Lizardfolk", type: TaskType.Boss, costMult: 150000, skills: [SkillType.Combat], xpMult: 0.5, maxReps: 1, perk: null, item: 'OracleBones' },
            { id: 128, name: "Steal Their Oracle Bones", type: TaskType.Normal, costMult: 8, skills: [SkillType.Subterfuge, SkillType.Search], xpMult: 1, maxReps: 4, perk: null, item: 'OracleBones', hidden: true },
        ],
    },
    {
        id: 12,
        name: "The Desert",
        tasks: [
            { id: 130, name: "Enter the Oasis", type: TaskType.Travel, costMult: 7, skills: [SkillType.Travel], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 131, name: "Overcome Mirage", type: TaskType.Mandatory, costMult: 6, skills: [SkillType.Fortitude], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 132, name: "Find the Oasis", type: TaskType.Mandatory, costMult: 1, skills: [SkillType.Search], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 133, name: "Harvest Cactus", type: TaskType.Normal, costMult: 0.8, skills: [SkillType.Survival, SkillType.Crafting], xpMult: 1, maxReps: 3, perk: null, item: 'Cactus' },
            { id: 134, name: "Avoid Notice by the Sandworm", type: TaskType.Normal, costMult: 1, skills: [SkillType.Subterfuge], xpMult: 1, maxReps: 5, perk: PerkType.WalkWithoutRhythm, item: null },
            { id: 135, name: "Work on Your Tan", type: TaskType.Normal, costMult: 1, skills: [SkillType.Fortitude], xpMult: 15, maxReps: 3, perk: null, item: null },
            { id: 136, name: "Comb the Desert", type: TaskType.Normal, costMult: 2, skills: [SkillType.Search], xpMult: 10, maxReps: 6, perk: null, item: null },
            { id: 137, name: "Giant Sandworm", type: TaskType.Boss, costMult: 600000, skills: [SkillType.Combat], xpMult: 0.4, maxReps: 1, perk: null, item: 'WormHideCoat' },
            { id: 138, name: "Learn to Dance the Worm", type: TaskType.Normal, costMult: 600000, skills: [SkillType.Study, SkillType.Charisma], xpMult: 0.1, maxReps: 1, perk: PerkType.TheWorm, item: null, hidden: true },
        ],
    },
    {
        id: 13,
        name: "The Oasis",
        tasks: [
            { id: 140, name: "Return to the Magician", type: TaskType.Travel, costMult: 8, skills: [SkillType.Travel], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 141, name: "Banish Evil Spirit", type: TaskType.Mandatory, costMult: 250, skills: [SkillType.Magic], xpMult: 1, maxReps: 3, perk: null, item: null },
            { id: 142, name: "Gather Second Reagent", type: TaskType.Mandatory, costMult: 1.25, skills: [SkillType.Search], xpMult: 1, maxReps: 5, perk: null, item: null },
            { id: 143, name: "Bottle Oasis Water", type: TaskType.Normal, costMult: 1, skills: [SkillType.Survival], xpMult: 1, maxReps: 4, perk: null, item: 'OasisWater' },
            { id: 144, name: "Reflect on the Journey", type: TaskType.Normal, costMult: 30, skills: [SkillType.Study], xpMult: 1, maxReps: 5, perk: PerkType.ReflectionsOnTheJourney, item: null },
            { id: 145, name: "Prepare for the Journey Ahead", type: TaskType.Normal, costMult: 2.5, skills: [SkillType.Travel], xpMult: 5, maxReps: 3, perk: null, item: null },
            { id: 146, name: "Frolic in the Water", type: TaskType.Normal, costMult: 30, skills: [SkillType.Druid], xpMult: 10, maxReps: 1, perk: null, item: null },
            { id: 147, name: "Sleepy Djinn", type: TaskType.Boss, costMult: 2000000, skills: [SkillType.Combat], xpMult: 0.3, maxReps: 1, perk: null, item: 'DjinnLamp' },
            { id: 148, name: "Find More Lamps", type: TaskType.Normal, costMult: 30, skills: [SkillType.Search, SkillType.Subterfuge], xpMult: 1, maxReps: 3, perk: null, item: 'DjinnLamp', hidden: true },
        ],
    },
    {
        id: 14,
        name: "The Ritual",
        tasks: [
            { id: 150, name: "Begin Search for the Next Ritual", type: TaskType.Travel, costMult: 60, skills: [SkillType.Travel], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 151, name: "Apologize for Stealing Reagents", type: TaskType.Mandatory, costMult: 150, skills: [SkillType.Charisma], xpMult: 0.25, maxReps: 3, perk: null, item: null },
            { id: 152, name: "Rest for a While", type: TaskType.Mandatory, costMult: 1000, skills: [SkillType.Fortitude], xpMult: 1, maxReps: 5, perk: null, item: null },
            { id: 153, name: "Touch the Divine", type: TaskType.Prestige, costMult: 0.03, skills: [SkillType.Ascension], xpMult: 1, maxReps: 1, perk: null, item: null, prestige: true },
            { id: 154, name: "Infuse Mystic Incense", type: TaskType.Normal, costMult: 100, skills: [SkillType.Magic], xpMult: 1, maxReps: 9, perk: null, item: 'MysticIncense' },
            { id: 155, name: "Practice Memorization", type: TaskType.Normal, costMult: 4000, skills: [SkillType.Study, SkillType.Magic], xpMult: 0.5, maxReps: 5, perk: PerkType.EnergeticMemory, item: null },
            { id: 156, name: "Guided Spellcasting", type: TaskType.Normal, costMult: 100, skills: [SkillType.Magic], xpMult: 10, maxReps: 3, perk: null, item: null },
            { id: 157, name: "Go for a Walk", type: TaskType.Normal, costMult: 4, skills: [SkillType.Search, SkillType.Travel], xpMult: 8, maxReps: 1, perk: null, item: null },
        ],
    },
    {
        id: 15,
        name: "The Dream",
        tasks: [
            { id: 160, name: "Wake Up", type: TaskType.Travel, costMult: 350000, skills: [SkillType.Magic], xpMult: 0.25, maxReps: 1, perk: PerkType.Awakening, item: null },
            { id: 161, name: "Notice Signs You're in a Dream", type: TaskType.Mandatory, costMult: 2000, skills: [SkillType.Study, SkillType.Search], xpMult: 0.2, maxReps: 3, perk: null, item: null },
            { id: 162, name: "Discover Your True Shape", type: TaskType.Mandatory, costMult: 1500, skills: [SkillType.Druid], xpMult: 1, maxReps: 1, perk: null, item: null },
            { id: 163, name: "Gather Essence", type: TaskType.Normal, costMult: 20000, skills: [SkillType.Magic], xpMult: 1, maxReps: 2, perk: null, item: 'MagicEssence' },
            { id: 164, name: "Build Giant Tower", type: TaskType.Normal, costMult: 60, skills: [SkillType.Crafting], xpMult: 0.25, maxReps: 2, perk: PerkType.TowerOfBabel, item: null },
            { id: 165, name: "Talk to Mysterious Being", type: TaskType.Normal, costMult: 100, skills: [SkillType.Charisma], xpMult: 10, maxReps: 5, perk: null, item: null },
            { id: 166, name: "Travel the Plains", type: TaskType.Normal, costMult: 200, skills: [SkillType.Travel, SkillType.Survival], xpMult: 2, maxReps: 3, perk: null, item: null },
            { id: 167, name: "The Weaver of Dreams", type: TaskType.Boss, costMult: 100000000, skills: [SkillType.Combat], xpMult: 0.15, maxReps: 1, perk: null, item: 'Dreamcatcher' },
            { id: 168, name: "Contain the Dream", type: TaskType.Normal, costMult: 200000000, skills: [SkillType.Magic], xpMult: 0.05, maxReps: 1, perk: PerkType.DreamPrism, item: null, hidden: true },
        ],
    },
];

// Helper to get tasks that grant perks
export function getPerkTasks() {
    const perkTasks = [];
    for (const zone of ZONES) {
        for (const task of zone.tasks) {
            if (task.perk !== null && !task.hidden) {
                perkTasks.push({ ...task, zoneId: zone.id, zoneName: zone.name });
            }
        }
    }
    return perkTasks;
}

// Get mandatory + travel tasks for a zone (minimum required to progress)
export function getMandatoryTasks(zone) {
    return zone.tasks.filter(t =>
        t.type === TaskType.Mandatory || t.type === TaskType.Travel
    );
}
