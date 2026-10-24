// Theme namebanks for the Pass-A dataset generator (jta-synthetic-data-plan
// §2.5 / §4.1, ruling 5: theme v1 = namebank-driven title/setting/flavor).
//
// Each theme is a self-contained vocabulary the generator draws EVERY name
// from — zones, tasks, skills, perks, items, prestige upgrades — so a
// generated world's parts read as belonging together. Banks are sized for
// one full vanilla-shaped dataset (30 zones, ~264 tasks, 10 skills, 46
// perks, 46 items, 28 prestige upgrades); the generator's drawing helpers
// suffix "II"/"III" on exhaustion rather than failing.
//
// Headless-safe: plain data, no imports.

export const DATASET_THEMES = Object.freeze({
  "long-road-north": {
    title: "The Long Road North",
    setting:
      "A slow walk out of the lowland villages, over the passes and through "
      + "the pine barrens, toward a cold light on the northern rim of the world.",
    tone: ["melancholy", "hopeful"],
    zoneAdjectives: [
      "Lowland", "Ashen", "Frostbound", "Pinewood", "Windswept", "Granite",
      "Larkspur", "Old", "Silent", "Amber", "Wolfsgate", "Thawing",
    ],
    zoneNouns: [
      "Village", "Crossing", "Barrens", "Pass", "Hollow", "Reach",
      "Ridge", "Waystation", "Ford", "Highlands", "Terraces", "Rim",
    ],
    zoneFlavors: [
      "The road thins here, and the milestones grow honest.",
      "Travelers trade rumors of the north for a place by the fire.",
      "Snow keeps whatever this place used to be.",
      "The wind writes its own signposts.",
      "Every path out of here climbs.",
      "Somebody kept walking; the cairns prove it.",
    ],
    skillNames: [
      "Parley", "Lorekeeping", "Skirmish", "Wayfinding", "Foraging",
      "Cartwright", "Trailcraft", "Rimecalling", "Endurance", "Northing",
      "Hearthbinding", "Stonereading",
    ],
    skillIcons: ["🗨️", "📜", "🪓", "🧭", "🌿", "🛠️", "🥾", "❄️", "🏔️", "🌌", "🔥", "🪨"],
    taskVerbs: {
      Normal: [
        "Gather", "Mend", "Scout", "Barter for", "Stack", "Chart",
        "Study", "Track", "Salvage", "Kindle", "Haul", "Trade",
        "Read", "Carve", "Bundle", "Ration", "Follow", "Mark",
      ],
      Mandatory: [
        "Secure", "Clear", "Repair", "Cross", "Hold", "Light",
        "Answer", "Settle", "Brave", "Breach",
      ],
      Boss: ["Face", "Outlast", "Drive Off", "Break"],
      Prestige: ["Touch", "Answer", "Embrace", "Become"],
    },
    taskNouns: [
      "the Firewood", "the Ledger", "the Old Bridge", "the Waymarkers",
      "the Supply Cache", "the North Trail", "the Frozen Stream", "the Beacon",
      "the Caravan", "the Palisade", "the Watchpost", "the Snowfield",
      "the Elk Herd", "the Storm Cellar", "the Milestones", "the Tollhouse",
      "the Pine Grove", "the Ice Shelf", "the Ravine", "the Star Charts",
      "the Sledge", "the Rookery", "the Hot Spring", "the Border Stones",
    ],
    bossNames: [
      "the Avalanche", "the Wolf-King", "the White Silence", "the Rimshade",
      "the Frost Warden", "the Northern Gate",
    ],
    prestigeNouns: [
      "the Cold Light", "the Rim of the World", "the Long Dark", "the Aurora",
    ],
    perkAdjectives: [
      "Weathered", "Northbound", "Quiet", "Keen", "Hearth", "Frostproof",
      "Steady", "Longstride", "Wayworn", "Amber", "Iron", "Winterwise",
    ],
    perkNouns: [
      "Instinct", "Resolve", "Bootsoles", "Memory", "Compass", "Patience",
      "Grit", "Songline", "Bearings", "Warmth", "Discipline", "Reckoning",
    ],
    perkIcons: ["🧭", "🥾", "🔥", "🪶", "🌟", "🛡️", "📯", "🗝️", "🕯️", "🎒", "⛺", "🪵"],
    itemAdjectives: [
      "Trail", "Smoked", "Birchbark", "Waxed", "Tin", "Woolen",
      "Carved", "Northern", "Dried", "Lantern", "Pine", "Rimefrost",
    ],
    itemNouns: [
      ["Ration", "Rations"], ["Map", "Maps"], ["Charm", "Charms"],
      ["Flask", "Flasks"], ["Whetstone", "Whetstones"], ["Cloak", "Cloaks"],
      ["Snowshoe", "Snowshoes"], ["Ember", "Embers"], ["Knife", "Knives"],
      ["Token", "Tokens"], ["Pelt", "Pelts"], ["Compass", "Compasses"],
      ["Candle", "Candles"], ["Rope", "Ropes"], ["Journal", "Journals"],
      ["Kettle", "Kettles"], ["Bell", "Bells"], ["Splint", "Splints"],
    ],
    itemIcons: ["🍞", "🗺️", "🧿", "🫙", "🪨", "🧥", "🥾", "🔥", "🔪", "🪙", "🦌", "🧭", "🕯️", "🪢", "📓", "🫖", "🔔", "🩹"],
    travelTemplate: (nextZone) => `Set Out for ${nextZone}`,
    prestigeTemplate: (noun) => `Touch ${noun}`,
  },

  "sunken-meridian": {
    title: "The Sunken Meridian",
    setting:
      "A drowned trade-road of reef towns and tide-locked ruins, descending "
      + "current by current toward the luminous trench where the old line ends.",
    tone: ["strange", "luminous"],
    zoneAdjectives: [
      "Tidal", "Coral", "Drowned", "Pearl", "Kelp", "Abyssal",
      "Brine", "Moonlit", "Barnacled", "Glassy", "Silted", "Phosphor",
    ],
    zoneNouns: [
      "Shallows", "Quay", "Ruins", "Gardens", "Forest", "Shelf",
      "Locks", "Lagoon", "Graveyard", "Vents", "Meridian", "Trench",
    ],
    zoneFlavors: [
      "The tide keeps its own ledgers here.",
      "Light comes down in ropes and lies about the depth.",
      "Whatever sank here learned to grow.",
      "The current has opinions about your route.",
      "Every bell in the old town still rings on the ebb.",
      "Deeper, the water starts to glow back.",
    ],
    skillNames: [
      "Haggling", "Tidelore", "Harpoonry", "Currentreading", "Reefcombing",
      "Shipwrighting", "Drifting", "Deepcalling", "Lungcraft", "Sounding",
      "Pearlbinding", "Saltwarding",
    ],
    skillIcons: ["🐚", "📖", "🔱", "🌊", "🪸", "⚓", "🐟", "🌀", "🫁", "🔔", "🦪", "🧂"],
    taskVerbs: {
      Normal: [
        "Comb", "Salvage", "Sound", "Net", "Trade for", "Chart",
        "Dive", "Dredge", "Read", "Follow", "Harvest", "Patch",
        "Coax", "Listen to", "Polish", "Anchor", "Untangle", "Light",
      ],
      Mandatory: [
        "Open", "Flood", "Seal", "Cross", "Calm", "Raise",
        "Answer", "Clear", "Brave", "Unlock",
      ],
      Boss: ["Face", "Outswim", "Quiet", "Unmake"],
      Prestige: ["Touch", "Answer", "Join", "Become"],
    },
    taskNouns: [
      "the Tide Tables", "the Mooring Lines", "the Wreck", "the Oyster Beds",
      "the Signal Buoy", "the Undertow", "the Kelp Rows", "the Old Locks",
      "the Drift Nets", "the Bell Tower", "the Reef Wall", "the Ballast",
      "the Moon Pool", "the Cargo Hold", "the Sea Charts", "the Brine Pools",
      "the Anemone Field", "the Pressure Door", "the Whale Road", "the Lanterns",
      "the Current Gate", "the Sunken Market", "the Vent Garden", "the Anchor Chain",
    ],
    bossNames: [
      "the Riptide", "the Leviathan's Shadow", "the Drowned Chorus",
      "the Pale Current", "the Trench Warden", "the Last Bell",
    ],
    prestigeNouns: [
      "the Luminous Trench", "the Old Meridian", "the Deep Chorus", "the Still Water",
    ],
    perkAdjectives: [
      "Brinewise", "Deepwater", "Pearled", "Steady", "Tideworn", "Glowing",
      "Barnacle", "Silver", "Moontide", "Coldproof", "Anchored", "Fathomless",
    ],
    perkNouns: [
      "Lungs", "Bearings", "Grip", "Memory", "Sense", "Patience",
      "Calm", "Song", "Sight", "Reckoning", "Blood", "Instinct",
    ],
    perkIcons: ["🫁", "🧭", "🪝", "🌊", "👁️", "🐚", "🌙", "🎶", "🔱", "⚓", "💠", "🐠"],
    itemAdjectives: [
      "Salted", "Pearl", "Kelp", "Brass", "Drift", "Glass",
      "Moonshell", "Brined", "Coral", "Deepsea", "Tide", "Phosphor",
    ],
    itemNouns: [
      ["Catch", "Catches"], ["Chart", "Charts"], ["Amphora", "Amphorae"],
      ["Lantern", "Lanterns"], ["Hook", "Hooks"], ["Shell", "Shells"],
      ["Float", "Floats"], ["Cordage", "Cordages"], ["Spyglass", "Spyglasses"],
      ["Coin", "Coins"], ["Pearl", "Pearls"], ["Compass", "Compasses"],
      ["Vial", "Vials"], ["Net", "Nets"], ["Logbook", "Logbooks"],
      ["Bell", "Bells"], ["Fin", "Fins"], ["Salve", "Salves"],
    ],
    itemIcons: ["🐟", "🗺️", "🏺", "🏮", "🪝", "🐚", "🛟", "🪢", "🔭", "🪙", "🦪", "🧭", "🧪", "🕸️", "📓", "🔔", "🐬", "🧴"],
    travelTemplate: (nextZone) => `Ride the Current to ${nextZone}`,
    prestigeTemplate: (noun) => `Touch ${noun}`,
  },

  "glass-caravan": {
    title: "The Glass Caravan",
    setting:
      "A trade caravan crossing the vitrified wastes, oasis to oasis, "
      + "following the fused-sand road toward the mirage that never moves.",
    tone: ["parched", "gleaming"],
    zoneAdjectives: [
      "Dusty", "Vitrified", "Mirage", "Saltpan", "Dune", "Obsidian",
      "Sunstruck", "Cistern", "Basalt", "Amberglass", "Windscoured", "Furnace",
    ],
    zoneNouns: [
      "Oasis", "Bazaar", "Flats", "Dunes", "Caravanserai", "Canyon",
      "Wells", "Ruin", "Spires", "Mesa", "Causeway", "Mirage",
    ],
    zoneFlavors: [
      "Heat bends the horizon into promises.",
      "The road here is glass; the glass remembers fire.",
      "Water is the only currency nobody jokes about.",
      "The dunes migrate; the waymarks argue.",
      "Traders leave stories the way lizards leave tracks.",
      "At noon, even shadows pay for shade.",
    ],
    skillNames: [
      "Bargaining", "Glasslore", "Duelcraft", "Dunerunning", "Wellfinding",
      "Tinkering", "Caravaneering", "Miragecalling", "Sunbearing", "Starwalking",
      "Ashbinding", "Sandreading",
    ],
    skillIcons: ["🪙", "📜", "⚔️", "🏜️", "💧", "🛠️", "🐪", "🌅", "☀️", "✨", "🔥", "⏳"],
    taskVerbs: {
      Normal: [
        "Haggle for", "Polish", "Scout", "Draw", "Load", "Chart",
        "Study", "Track", "Sift", "Shade", "Repair", "Trade",
        "Read", "Cut", "Bottle", "Ration", "Follow", "Sing to",
      ],
      Mandatory: [
        "Secure", "Clear", "Seal", "Cross", "Guard", "Light",
        "Answer", "Settle", "Brave", "Open",
      ],
      Boss: ["Face", "Outride", "Shatter", "Bind"],
      Prestige: ["Touch", "Answer", "Enter", "Become"],
    },
    taskNouns: [
      "the Waterskins", "the Manifest", "the Glass Road", "the Waymarks",
      "the Salt Blocks", "the Camel Train", "the Dry Well", "the Signal Fire",
      "the Bazaar Stalls", "the Sandstorm", "the Watchtower", "the Dune Crest",
      "the Locust Swarm", "the Cool Cellar", "the Milestones", "the Toll Gate",
      "the Date Palms", "the Glass Field", "the Slot Canyon", "the Star Charts",
      "the Wagon Axle", "the Falconry", "the Hidden Spring", "the Border Cairns",
    ],
    bossNames: [
      "the Sandstorm's Eye", "the Glass Colossus", "the Noon King",
      "the Mirage Court", "the Furnace Wind", "the Last Gate",
    ],
    prestigeNouns: [
      "the Unmoving Mirage", "the Glass Horizon", "the First Fire", "the Still Noon",
    ],
    perkAdjectives: [
      "Sunproof", "Glasswise", "Quiet", "Keen", "Cistern", "Duneworn",
      "Steady", "Longshadow", "Roadwise", "Amber", "Iron", "Starlit",
    ],
    perkNouns: [
      "Instinct", "Resolve", "Soles", "Memory", "Compass", "Patience",
      "Thirst", "Songline", "Bearings", "Shade", "Discipline", "Reckoning",
    ],
    perkIcons: ["🧭", "🐪", "🔥", "🪶", "🌟", "🛡️", "🏺", "🗝️", "🕯️", "🎒", "⛺", "💎"],
    itemAdjectives: [
      "Dried", "Amber", "Etched", "Waxed", "Brass", "Woven",
      "Cut-Glass", "Desert", "Salted", "Lantern", "Palm", "Sunfired",
    ],
    itemNouns: [
      ["Fig Cake", "Fig Cakes"], ["Map", "Maps"], ["Charm", "Charms"],
      ["Waterskin", "Waterskins"], ["Whetstone", "Whetstones"], ["Shawl", "Shawls"],
      ["Sandal", "Sandals"], ["Coal", "Coals"], ["Dagger", "Daggers"],
      ["Token", "Tokens"], ["Hide", "Hides"], ["Astrolabe", "Astrolabes"],
      ["Candle", "Candles"], ["Rope", "Ropes"], ["Ledger", "Ledgers"],
      ["Teapot", "Teapots"], ["Chime", "Chimes"], ["Poultice", "Poultices"],
    ],
    itemIcons: ["🍯", "🗺️", "🧿", "🫙", "🪨", "🧣", "👡", "🔥", "🗡️", "🪙", "🐐", "🔭", "🕯️", "🪢", "📓", "🫖", "🎐", "🌿"],
    travelTemplate: (nextZone) => `Strike Camp for ${nextZone}`,
    prestigeTemplate: (noun) => `Touch ${noun}`,
  },
});

export const DATASET_THEME_KEYS = Object.freeze(Object.keys(DATASET_THEMES));
