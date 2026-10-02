/**
 * seedlingDemo/entityBlocks — **WHICH BEHAVIOUR BLOCK EACH SEEDLING ENTITY
 * REALISES, AND WHICH BLOCKS THE SOLVER CAN REASON ABOUT** (behaviour
 * parameters P3; plan `behaviour-parameters-plan.md` §3 P3, §7, ⚖ the user
 * GO 2026-09-30).
 *
 * Three tables and the lookups over them:
 *
 *   `ENTITY_BLOCKS`      one row per `combat.ENEMY_CLASSES` tag and per
 *                        `combat.PUZZLEMENT_HAZARDS` tag: the P2 block ids the
 *                        class realises (`procgenCore/behaviourBlocks.BLOCKS`),
 *                        the blocks it needs that the vocabulary does not
 *                        declare (`bespoke`), or — for a class nothing else
 *                        shares — `unique` and no blocks at all.
 *   `AGGRO_KIND_BLOCKS`  `ENEMY_CLASSES[tag].aggro.kind` → the movement block
 *                        that word denotes (`null` for a unique script).
 *   `FAMILY_BLOCKS`      one row per `run.entities(family)` family
 *                        (`levelRun.ENTITY_FAMILY_NAMES`, spelled here as
 *                        strings) and per `hazards.hazardVolume` arm: the
 *                        blocks the family's state realises, which solver-family
 *                        files read it, and the `solverBot.OBSTACLE_STRATEGIES`
 *                        verbs its tags carry.
 *
 * `blocksTheSolverModels()` is the answer to *which blocks can the solver
 * reason about today* (live state only — a `hazardVolume` arm is an avoid
 * volume, reported apart by `blocksOnlyAvoided()`); `certifiableBlocks(
 * realisation.blocks)` asks it of one realisation.
 *
 * ⛔ READ-ONLY FOR THE MODEL AND THE SOLVER. Nothing in the simulation
 * (`levelRun.js`'s import closure) or the solver family (`solverBot.js` +
 * `director.js`'s) imports this file, and it imports neither `levelRun.js` nor
 * any solver-family file — so the families are spelled here as strings and
 * `entityBlocks.test.js` holds them equal to the live lists. Its only imports
 * are the vocabulary and the two census tables it labels. Asserted by the test,
 * which walks both closures.
 *
 * ⛔ A LABEL IS NOT A GUESS. A class whose honest answer is "no declared block
 * says this" files the need under `bespoke`; a boss files `unique`. No row
 * names a block to make the table complete.
 */

import { BLOCKS } from '../procgenCore/behaviourBlocks.js';
import { ENEMY_CLASSES, PUZZLEMENT_HAZARDS } from './combat.js';

export class EntityBlocksError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EntityBlocksError';
    }
}

const fail = (message) => { throw new EntityBlocksError(message); };
const deepFreeze = (rows) => Object.freeze(rows.map((r) => Object.freeze({
    ...r,
    blocks: Object.freeze([...r.blocks]),
    ...(r.bespoke ? { bespoke: Object.freeze([...r.bespoke]) } : {}),
    ...(r.solverReads ? { solverReads: Object.freeze([...r.solverReads]) } : {}),
    ...(r.strategies ? { strategies: Object.freeze([...r.strategies]) } : {}),
})));

/* ─────────────────────── the aggro words → movement ─────────────────────── */

/**
 * ⛓ `ENEMY_CLASSES[tag].aggro.kind` → the movement block that word denotes.
 * `null` is a unique script (a boss fight, a spawner) — no movement block
 * describes it honestly. TOTAL over the words the census uses (asserted at
 * load: a new word with no row here is refused by name).
 */
export const AGGRO_KIND_BLOCKS = Object.freeze({
    'chase': 'chase',
    'teleport-hop': 'tile-hop',
    'chase-through-walls': 'chase',
    'none': 'rebound',
    'wall-hug-launch': 'wall-launch',
    'static-shooter': 'stationary',
    'armed-by-proximity': 'ballistic',
    'static': 'stationary',
    'static-tongue': 'stationary',
    'static-lobber': 'stationary',
    'boss': null,
    'spawner': null,
});

/* ─────────────────────────── the class labels ─────────────────────────── */

const UNIQUE_BOSS = (fight) => `a scripted boss fight (${fight}); no block the vocabulary declares `
    + 'describes it, and a block that half-fits would claim a reuse the fight does not have';

/**
 * ⛓ ONE ROW PER CENSUS TAG. `source` names the table the tag lives in
 * (`enemy` = `ENEMY_CLASSES`, `hazard` = `PUZZLEMENT_HAZARDS`). `aggroNote` is
 * required exactly when the row's movement blocks are not the one its aggro
 * word denotes. `src` cites the census row (`combat.js:<line>`) and the AS3
 * lines the label was read from.
 */
export const ENTITY_BLOCKS = deepFreeze([
    /* ── enemies ── */
    { tag: 'bob', source: 'enemy', as3: 'Bob', blocks: ['chase', 'contact', 'hp'], bespoke: [], unique: null,
        why: 'Bob.as runs at the player inside `runRange` 80 and hurts on touch; `kill.hits` 3.',
        src: 'combat.js:164 · Enemies/Bob.as:21,49-83' },
    { tag: 'bobsoldier', source: 'enemy', as3: 'BobSoldier', blocks: ['chase', 'contact', 'melee', 'hp'], bespoke: [], unique: null,
        why: 'the Bob chase plus a 16 px sword line off the body (`reach.kind` sword-line) — a close strike.',
        src: 'combat.js:174 · Enemies/BobSoldier.as:37,165' },
    { tag: 'bulb', source: 'enemy', as3: 'Bulb', blocks: ['chase', 'contact', 'hp', 'onDeath'], bespoke: [], unique: null,
        why: 'extends Bob (chase); its death turns the tile under it to lava (`navMeshEdit`) — an effect left behind.',
        src: 'combat.js:186 · Enemies/Bulb.as:27,30,71-79' },
    { tag: 'lavarunner', source: 'enemy', as3: 'LavaRunner', blocks: ['chase', 'contact', 'hp', 'terrain'], bespoke: [], unique: null,
        why: 'extends Bob (chase, not a patrol lane); survives lava and nothing else (`terrain.lava` survives).',
        src: 'combat.js:203 · Enemies/LavaRunner.as:11,36,38,41' },
    { tag: 'jellyfish', source: 'enemy', as3: 'Jellyfish', blocks: ['chase', 'contact', 'hp', 'terrain'], bespoke: [], unique: null,
        why: 'chases at 160 px; survives water and lava and refuses pits — the terrain it is safe inside.',
        src: 'combat.js:217 · Enemies/Jellyfish.as:22,31-37,55-56' },
    { tag: 'puncher', source: 'enemy', as3: 'Puncher', blocks: ['chase', 'contact', 'melee', 'hp'], bespoke: [], unique: null,
        why: 'chases inside `runRange`, then punches at `attackRange` 10 with a box 8 deep (`reach.kind` punch).',
        src: 'combat.js:230 · Enemies/Puncher.as:22-24,62-63,201,216' },
    { tag: 'drill', source: 'enemy', as3: 'Drill', blocks: ['tile-hop', 'contact', 'hp', 'lineOfSight'], bespoke: [], unique: null,
        why: 'sits until the player is within 48 px AND `!collideLine("Solid", …)`, then moves one whole tile toward them — a tile hop gated by a clear line.',
        src: 'combat.js:241 · Enemies/Drill.as:82-92' },
    { tag: 'flyer', source: 'enemy', as3: 'Flyer', blocks: ['chase', 'stomp', 'hp'], bespoke: [], unique: null,
        why: 'extends Bob (chase, through walls); `hitPlayer` is overridden EMPTY, so it hurts only by DROPPING on a player under it — no contact block.',
        src: 'combat.js:252 · Enemies/Flyer.as:58-69,83-85' },
    { tag: 'spinner', source: 'enemy', as3: 'Spinner', blocks: ['rebound', 'contact', 'sweep', 'hp', 'onDeath'], bespoke: [], unique: null,
        why: '`runRange` 0 kills the chase, so the body wall-bounces on Mobile physics; the hammer is a rotating line; its `removed()` writes its own tag (`sideWrite`).',
        src: 'combat.js:264 · Enemies/Spinner.as:23,42,44,58-62,69-76' },
    { tag: 'wallflyer', source: 'enemy', as3: 'WallFlyer', blocks: ['wall-launch', 'contact', 'hp'], bespoke: ['rayTrigger'], unique: null,
        why: 'clings to a wall and launches along a `collideLine("Player", …)` ray the screen wide; that ray tests the PLAYER, not Solid, so it is not `lineOfSight` — no declared trigger says it.',
        src: 'combat.js:283 · Enemies/WallFlyer.as:38,62,71-75' },
    { tag: 'turret', source: 'enemy', as3: 'Turret', blocks: ['stationary', 'emitter', 'contact', 'hp', 'proximity'], bespoke: [], unique: null,
        why: 'never moves; fires `TurretSpit` every 40 ticks at a player inside `attackRange` 64.',
        src: 'combat.js:293 · Enemies/Turret.as:17-22,35' },
    { tag: 'iceturret', source: 'enemy', as3: 'IceTurret', blocks: ['stationary', 'pushable', 'emitter', 'contact', 'hp', 'proximity'], bespoke: [], unique: null,
        aggroNote: 'the LIVE turret is stationary; its CORPSE is pushable by Fire or Pulse (`corpse.pushedBy`, glide 0.5) — the `ICE_TURRET.moveSpeed` P1 pinned apart from `speed` 0.',
        why: 'fires `IceTurretBlast` volleys inside 128 px; `death()` leaves a Solid corpse that only Fire or a Pulser moves.',
        src: 'combat.js:304 · Enemies/IceTurret.as:19,44,51,56,114-151' },
    { tag: 'grenade', source: 'enemy', as3: 'Grenade', blocks: ['ballistic', 'explode', 'proximity', 'matrix'], bespoke: [], unique: null,
        why: 'falls from 48 px above under `g` 0.1 once the player is within `fallTriggerDistance` 32, then bursts (r 20); `hit()` is overridden EMPTY — every category is ignored.',
        src: 'combat.js:333 · Enemies/Grenade.as:18-22,31-37,58-60' },
    { tag: 'icetrap', source: 'enemy', as3: 'IceTrap', blocks: ['stationary', 'melee', 'proximity', 'matrix'], bespoke: [], unique: null,
        why: 'chomps at `chompRange` 8; `canHit = false` — unkillable, every category ignored.',
        src: 'combat.js:347 · Enemies/IceTrap.as:17,32,41-45' },
    { tag: 'sandtrap', source: 'enemy', as3: 'SandTrap', blocks: ['stationary', 'melee', 'proximity', 'hp', 'onDeath'], bespoke: [], unique: null,
        why: 'chomps at `chompRange` 20; killable in 3, and its `removed()` writes its own tag (`sideWrite`).',
        src: 'combat.js:359 · Enemies/SandTrap.as:17,59-63,85' },
    { tag: 'darktrap', source: 'enemy', as3: 'DarkTrap', blocks: ['stationary', 'melee', 'proximity', 'light', 'matrix'], bespoke: [], unique: null,
        why: 'extends SandTrap (chomps at 20); dies when a non-player Light reaches it, and `hit()` is overridden EMPTY.',
        src: 'combat.js:370 · Enemies/DarkTrap.as:12,29-33,56' },
    { tag: 'lavatrap', source: 'enemy', as3: 'LavaTrap', blocks: ['stationary', 'proximity', 'hp'], bespoke: ['latch'], unique: null,
        why: 'at 32 px its tongue LATCHES the player and writes their position absolutely — not `tether` (a hazard swung on a chain) and not `melee`; no declared attack says it.',
        src: 'combat.js:385 · Enemies/LavaTrap.as:21,23,59' },
    { tag: 'bombpusher', source: 'enemy', as3: 'BombPusher', blocks: ['stationary', 'emitter', 'explode', 'proximity', 'matrix'], bespoke: [], unique: null,
        why: 'lobs a `Bomb` at where the player stood, from up to 256 px; the bomb bursts (r 24); `hit()` is overridden EMPTY.',
        src: 'combat.js:399 · Enemies/BombPusher.as:44,60,67' },
    { tag: 'shieldboss', source: 'enemy', as3: 'ShieldBoss', blocks: [], bespoke: [], unique: UNIQUE_BOSS('`shieldBossFight.js`'),
        why: 'the shield swallows the first hit and the body holds the boss key; the fight is its own script.',
        src: 'combat.js:417 · Enemies/ShieldBoss.as:64,103-218' },
    { tag: 'bosstotem', source: 'enemy', as3: 'BossTotem', blocks: [], bespoke: [], unique: UNIQUE_BOSS('`bossTotemFight.js`'),
        why: '`onlyHitBy = "Wand"`, woken by the wand pickup, a Solid until woken.',
        src: 'combat.js:434 · Enemies/BossTotem.as:257,315,478' },
    { tag: 'lavaboss', source: 'enemy', as3: 'LavaBoss', blocks: [], bespoke: [], unique: UNIQUE_BOSS('R6, no stepped model'),
        why: 'uncounted, Solid to the player; its behaviour is not transcribed here.',
        src: 'combat.js:472 · Enemies/LavaBoss.as:137' },
    { tag: 'tentaclebeast', source: 'enemy', as3: 'TentacleBeast', blocks: [], bespoke: [], unique: UNIQUE_BOSS('R6, no stepped model'),
        why: 'spawns `Tentacle`s (the `rise` block\'s source) but is itself a fight, not a block.',
        src: 'combat.js:481 · Enemies/TentacleBeast.as:102,188' },
    { tag: 'finalboss', source: 'enemy', as3: 'FinalBoss', blocks: [], bespoke: [], unique: UNIQUE_BOSS('`finalBossFight.js`'),
        why: '`onlyHitBy = "Lava"` — the player shoves, the lava kills; barrages and pods on the boss\'s own schedule.',
        src: 'combat.js:489 · Enemies/FinalBoss.as:52,56,58,101-165' },
    { tag: 'lightbosscontroller', source: 'enemy', as3: 'LightBossController', blocks: [], bespoke: [], unique: 'an `Entity` that SPAWNS LightBoss; it is not an enemy and realises no block itself',
        why: '`aggro.kind` spawner, `damage` 0, no hitbox.',
        src: 'combat.js:523 · Enemies/LightBossController.as:106' },

    /* ── puzzlement hazards ── */
    { tag: 'spinningaxe', source: 'hazard', as3: 'SpinningAxe', blocks: ['stationary', 'sweep'], bespoke: [], unique: null,
        why: 'a 32 px arm sweeps a circle about a fixed hub at its own `rate`.',
        src: 'combat.js:552 · Puzzlements/SpinningAxe.as:19,24,45,54-59,75' },
    { tag: 'beamtower', source: 'hazard', as3: 'BeamTower', blocks: ['stationary', 'beam', 'schedule'], bespoke: [], unique: null,
        why: 'a 5 px beam band to the screen edge, firing on alternate animation frames — a line on a cycle.',
        src: 'combat.js:558 · Puzzlements/BeamTower.as:22,92,102,156-182' },
    { tag: 'lavachain', source: 'hazard', as3: 'LavaChain', blocks: ['stationary', 'tether', 'schedule'], bespoke: [], unique: null,
        why: 'a 48 px arm extended from a fixed body on `Game.worldFrame(Main.FPS, loops)`.',
        src: 'combat.js:567 · Puzzlements/LavaChain.as:23,53,90,96-119' },
    { tag: 'crusher', source: 'hazard', as3: 'Crusher', blocks: ['lane-charge', 'contact', 'lineOfSight'], bespoke: [], unique: null,
        why: 'charges 1 px/tick down one of four 64 px trigger lanes when the player enters it with a clear `collideLine("Solid", …)`; contact is damage 1000.',
        src: 'combat.js:573 · Puzzlements/Crusher.as:23,33,58,63-74,98' },
    { tag: 'pulser', source: 'hazard', as3: 'Pulser', blocks: ['stationary', 'pulse', 'schedule', 'channel'], bespoke: [], unique: null,
        why: 'a ring (`radiusHit` 22) on its own timer, armed by its Activators group.',
        src: 'combat.js:580 · Puzzlements/Pulser.as:23,32-36,102-114' },
    { tag: 'arrowtrap', source: 'hazard', as3: 'ArrowTrap', blocks: ['stationary', 'emitter', 'channel'], bespoke: [], unique: null,
        why: '3 arrows every 10 frames, straight down (a fixed aim), while its Activators group is pressed or latched.',
        src: 'combat.js:587 · Puzzlements/ArrowTrap.as:18-19,30-38,48-63' },
    { tag: 'whirlpool', source: 'hazard', as3: 'Whirlpool', blocks: ['stationary'], bespoke: ['vortex'], unique: null,
        why: 'inside 16 px it writes the player\'s position 1 px/tick inward and then drowns them — no declared attack moves the player.',
        src: 'combat.js:605 · Puzzlements/Whirlpool.as:56-84' },
    { tag: 'pod', source: 'hazard', as3: 'Pod', blocks: ['stationary', 'contact'], bespoke: ['pin', 'bossScript'], unique: null,
        why: 'damage 1 plus an ungated position PIN; opened and closed by FinalBoss\'s script and by the player\'s own overlap — no declared trigger is another entity\'s script.',
        src: 'combat.js:639 · Scenery/Pod.as:24-45,60-80' },
    { tag: 'pull', source: 'hazard', as3: 'Pull', blocks: ['stationary'], bespoke: ['forceField'], unique: null,
        why: 'adds force every tick to anything overlapping — a push field; no declared block says it.',
        src: 'combat.js:650 · levelWorld ENTITY_CLASSES pull' },
]);

/* ─────────────────────── the families the solver reads ─────────────────────── */

/**
 * ⛓ ONE ROW PER `run.entities(family)` FAMILY (the 23 of
 * `levelRun.ENTITY_FAMILY_NAMES`, `levelRun.js:258-282`) AND PER
 * `hazards.hazardVolume` ARM (`hazards.js:156-362`, keyed `volume:<tag>`).
 *
 * `solverReads` — the solver-family files that read it, without `.js`. For an
 * entity family, the `families` column of `scripts/procgen/
 * seedling-solver-surface.json`'s `entities` row (the census's authority); for
 * a volume, the family files that call `hazardVolume(`, minus `dangerMap` for a
 * tag `dangerMap.HAZARDS_PRICED_LIVE` excludes. Both asserted by the test.
 * `strategies` — the `solverBot.OBSTACLE_STRATEGIES` verbs keyed by a tag the
 * family holds (asserted against the solver's table by the test).
 */
const RUN_ENTITIES = 'entities';
const VOLUME = 'volume';
export const FAMILY_BLOCKS = deepFreeze([
    { family: 'openActivators', kind: RUN_ENTITIES, blocks: ['channel'],
        solverReads: ['botDriverV2', 'solverBot'], strategies: ['hold', 'keylock', 'touch', 'wand'],
        why: 'the lock/cover ids an Activators group has opened (`levelRun.js:10577`): a channel a button publishes.' },
    { family: 'pushables', kind: RUN_ENTITIES, blocks: ['pushable'],
        solverReads: ['botDriverV2', 'solverBot'], strategies: ['shove'],
        why: 'the pushed blocks\' live rects (`levelRun.js:10579`).' },
    { family: 'armedArrowTraps', kind: RUN_ENTITIES, blocks: ['stationary', 'emitter', 'channel'],
        solverReads: ['botDriverV2', 'dangerMap', 'solverBot'], strategies: [],
        why: 'the traps whose group is pressed or latched (`levelRun.js:10704`); `dangerMap.arrowDanger` prices their lanes.' },
    { family: 'crushers', kind: RUN_ENTITIES, blocks: ['lane-charge', 'contact'],
        solverReads: ['botDriverV2', 'dangerMap'], strategies: [],
        why: 'the crushers\' LIVE bodies (`levelRun.js:10583`); `dangerMap.crusherDanger` re-derives the lanes at the live centre.' },
    { family: 'openChests', kind: RUN_ENTITIES, blocks: [],
        solverReads: ['botDriverV2', 'solverBot'], strategies: ['chest'],
        why: 'opened chest ids (`levelRun.js:10690`) — an obstacle\'s state, not a behaviour block.' },
    { family: 'strikeBodies', kind: RUN_ENTITIES, blocks: ['hp'],
        solverReads: ['botDriverV2', 'solverBot'], strategies: [],
        why: 'the bridged chasers as kill targets, with `hits` and `hitsTimer` (`levelRun.js:10603`).' },
    { family: 'spinnerBodies', kind: RUN_ENTITIES, blocks: ['rebound', 'contact', 'sweep', 'hp'],
        solverReads: ['dangerMap', 'solverBot'], strategies: [],
        why: 'the stepped spinners (`levelRun.js:10563`, `MODELLED_ENEMY_CLASSES.Spinner`): the bounced body, `dangerMap.spinnerDanger`\'s hammer, `hitsTimer`.' },
    { family: 'armedPulsers', kind: RUN_ENTITIES, blocks: ['stationary', 'pulse', 'channel'],
        solverReads: ['botDriverV2', 'solverBot'], strategies: [],
        why: 'the pulsers whose group is pressed or latched (`levelRun.js:10691`).' },
    { family: 'turrets', kind: RUN_ENTITIES, blocks: ['stationary', 'pushable'],
        solverReads: ['botDriverV2'], strategies: [],
        why: 'the ice turrets\' rects and `solid` flag (`levelRun.js:10656`) — the live body and the pushed corpse.' },
    { family: 'chasers', kind: RUN_ENTITIES, blocks: ['chase', 'contact'],
        solverReads: ['dangerMap', 'solverBot'], strategies: [],
        why: 'the bridged chasers\' live positions (`levelRun.js:10634`; `chasers.bridgedChaserTags()`, Bob today); `dangerMap.chaserDanger` grows each by its step bound.' },
    { family: 'brokenRocks', kind: RUN_ENTITIES, blocks: [],
        solverReads: ['botDriverV2', 'solverBot'], strategies: ['break'],
        why: 'broken rock ids (`levelRun.js:10580`) — a `TILE_TRIGGERS` level, not a block.' },
    { family: 'crushersParked', kind: RUN_ENTITIES, blocks: ['lane-charge'],
        solverReads: ['botDriverV2'], strategies: [],
        why: 'whether every crusher has stopped charging (`levelRun.js:10587`).' },
    { family: 'pushesSettled', kind: RUN_ENTITIES, blocks: ['pushable'],
        solverReads: ['botDriverV2'], strategies: [],
        why: 'whether every pushed block has come to rest (`levelRun.js:10729`).' },
    { family: 'openBridges', kind: RUN_ENTITIES, blocks: [],
        solverReads: ['botDriverV2'], strategies: [],
        why: 'opened bridge ids (`levelRun.js:10578`) — terrain state, not a block.' },
    { family: 'arrowsInFlight', kind: RUN_ENTITIES, blocks: ['emitter'],
        solverReads: ['dangerMap', 'solverBot'], strategies: [],
        why: 'live arrow positions (`levelRun.js:10724`) — the emitter\'s shots.' },
    { family: 'burnedTrees', kind: RUN_ENTITIES, blocks: [],
        solverReads: ['botDriverV2', 'solverBot'], strategies: [],
        why: 'burned tree ids (`levelRun.js:10581`) — a `TILE_TRIGGERS` itemCategory, not a block.' },
    { family: 'latchedGroups', kind: RUN_ENTITIES, blocks: ['channel'],
        solverReads: ['solverBot'], strategies: [],
        why: 'the Activators groups a `room = -1` press latched open (`levelRun.js:10718`).' },
    { family: 'pulledRopes', kind: RUN_ENTITIES, blocks: [],
        solverReads: ['botDriverV2'], strategies: [],
        why: 'pulled rope ids (`levelRun.js:10582`) — an obstacle\'s state, not a block.' },
    { family: 'turretDamage', kind: RUN_ENTITIES, blocks: ['hp', 'emitter'],
        solverReads: ['botDriverV2'], strategies: [],
        why: 'each ice turret\'s `hits`/`hitsMax`/`hitsTimer` and its volley clock (`shootTimer`, `angle`, `volleys`) (`levelRun.js:10672`).' },
    { family: 'turretsSettled', kind: RUN_ENTITIES, blocks: ['pushable'],
        solverReads: ['botDriverV2'], strategies: [],
        why: 'whether every ice turret corpse has finished its glide (`levelRun.js:10664`).' },
    { family: 'arrowFlights', kind: RUN_ENTITIES, blocks: ['emitter'],
        solverReads: ['dangerMap'], strategies: [],
        why: 'live arrows with velocity and lifetime (`levelRun.js:10725`), for `dangerMap.predictArrows`.' },
    { family: 'bosses', kind: RUN_ENTITIES, blocks: [],
        solverReads: ['botDriverV2'], strategies: [],
        why: 'the boss totems\' rects (`levelRun.js:10660`) — a unique fight (`ENTITY_BLOCKS` bosstotem), so no block.' },
    { family: 'talkCircles', kind: RUN_ENTITIES, blocks: [],
        solverReads: ['solverBot'], strategies: [],
        why: 'uncleared talker circles (`levelRun.js:10594`) — dialogue, not a behaviour.' },
    { family: 'bobBoss', kind: RUN_ENTITIES, blocks: ['chase', 'contact', 'hp'],
        solverReads: ['solverBot'], strategies: [],
        why: 'L32\'s encounter by role — the rock, the boss (three forms: chase, swords, `hits`), the dialogue, the pending Fire (`levelRun.js`, swim U5\'s `bobBossFight.js`); the encounter executor reads the boss\'s own `hits`.' },
    { family: 'pulls', kind: RUN_ENTITIES, blocks: ['stationary'],
        solverReads: ['solverBot'], strategies: [],
        why: 'the room\'s `Pull` currents in update order (`levelRun.pullsNow`, U12-swim `pull.js`); a pit leg rides the ones that drain into its pit (`solverBot.pitRides`).' },
    { family: 'shooters', kind: RUN_ENTITIES, blocks: ['stationary', 'emitter'],
        solverReads: ['dangerMap'], strategies: [],
        why: 'the room\'s `Turret`s in `.oel` order, each with its aim, its 40-tick clock, its animation and the `TurretSpit`s of its own in flight (`levelRun.shootersNow`, U15-swim `turret.js`).' },

    /* ── the hazard volumes (`hazards.hazardVolume`, avoid volumes, unions over phase) ── */
    { family: 'volume:crusher', kind: VOLUME, blocks: ['lane-charge', 'contact'],
        solverReads: ['encounters'], strategies: [],
        why: 'the body and four trigger lanes at the `.oel` placement (`hazards.js:157`); `dangerMap` prices it LIVE through `crushers` instead (`HAZARDS_PRICED_LIVE`).' },
    { family: 'volume:spinningaxe', kind: VOLUME, blocks: ['stationary', 'sweep'],
        solverReads: ['dangerMap', 'encounters'], strategies: [],
        why: 'the hub rect and the 32 px disc the arm sweeps (`hazards.js:181`).' },
    { family: 'volume:pulser', kind: VOLUME, blocks: ['stationary', 'pulse'],
        solverReads: ['dangerMap', 'encounters'], strategies: [],
        why: 'the 22 px ring disc (`hazards.js:196`), armed or not.' },
    { family: 'volume:arrowtrap', kind: VOLUME, blocks: ['emitter'],
        solverReads: ['encounters'], strategies: [],
        why: 'the arrow column to the floor (`hazards.js:210`); `dangerMap` prices it by ARMED state through `armedArrowTraps` instead (`HAZARDS_PRICED_LIVE`).' },
    { family: 'volume:beamtower', kind: VOLUME, blocks: ['stationary', 'beam'],
        solverReads: ['dangerMap', 'encounters'], strategies: [],
        why: 'the Solid body and the beam band swept over its bob (`hazards.js:229`) — the firing cycle is not in the volume.' },
    { family: 'volume:lavachain', kind: VOLUME, blocks: ['stationary', 'tether'],
        solverReads: ['dangerMap', 'encounters'], strategies: [],
        why: 'the body and the extended arm (`hazards.js:271`), a phase-band union.' },
    { family: 'volume:whirlpool', kind: VOLUME, blocks: ['stationary'],
        solverReads: ['dangerMap', 'encounters'], strategies: [],
        why: 'the 16 px knife-edge disc (`hazards.js:302`); its pull-and-drown is bespoke (`vortex`).' },
    { family: 'volume:pull', kind: VOLUME, blocks: ['stationary'],
        solverReads: ['dangerMap', 'encounters'], strategies: [],
        why: 'no rect or disc — `deferredTo` levelWorld\'s proximity hazard (`hazards.js:318`); stepped by `levelRun.stepPullsNow` and ridden by a pit leg (U12-swim).' },
    { family: 'volume:pod', kind: VOLUME, blocks: ['stationary', 'contact'],
        solverReads: ['dangerMap', 'encounters'], strategies: [],
        why: 'the 16x16 cell (`hazards.js:331`); its pin and the boss\'s schedule are bespoke.' },
]);

/* ─────────────────────────────── the checks ─────────────────────────────── */

const nonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const movementOf = (ids) => ids.filter((id) => BLOCKS.get(id)?.family === 'movement');

/**
 * ⛓ THE LABELS AGAINST THE VOCABULARY AND THE CENSUS — run at load.
 *
 * Refuses, by tag and id: a block id `BLOCKS` does not declare; a `bespoke`
 * name that IS a declared id (it belongs under `blocks`); a unique row with
 * blocks, or a non-unique row with none; a missing `why`/`src`; a tag either
 * census table lacks, a census tag with no row, or a tag with two; an aggro
 * word with no `AGGRO_KIND_BLOCKS` row (naming the tag that uses it); a row
 * whose movement blocks are not its aggro word's block and that gives no
 * `aggroNote`.
 */
export function assertEntityBlocks(rows = ENTITY_BLOCKS, {
    enemies = ENEMY_CLASSES, hazards = PUZZLEMENT_HAZARDS, aggro = AGGRO_KIND_BLOCKS,
} = {}) {
    const seen = new Map();
    for (const r of rows) {
        const table = r.source === 'enemy' ? enemies : r.source === 'hazard' ? hazards : null;
        if (!table) fail(`entityBlocks: row "${r.tag}" has source ${JSON.stringify(r.source)}; a source is "enemy" or "hazard".`);
        if (!Object.hasOwn(table, r.tag)) {
            fail(`entityBlocks: row "${r.tag}" names a tag ${r.source === 'enemy' ? 'ENEMY_CLASSES' : 'PUZZLEMENT_HAZARDS'} does not hold.`);
        }
        if (seen.has(`${r.source}:${r.tag}`)) fail(`entityBlocks: tag "${r.tag}" has two rows.`);
        seen.set(`${r.source}:${r.tag}`, r);
        if (table[r.tag].as3 !== r.as3) {
            fail(`entityBlocks: row "${r.tag}" says as3 "${r.as3}"; the census says "${table[r.tag].as3}".`);
        }
        if (!nonEmptyString(r.why) || !nonEmptyString(r.src)) fail(`entityBlocks: row "${r.tag}" needs a \`why\` and a \`src\`.`);
        for (const id of r.blocks) {
            if (!BLOCKS.has(id)) {
                fail(`entityBlocks: row "${r.tag}" names the block "${id}", which behaviourBlocks.BLOCKS does not `
                    + 'declare. File a need the vocabulary lacks under `bespoke`, or declare the block first.');
            }
        }
        if (new Set(r.blocks).size !== r.blocks.length) fail(`entityBlocks: row "${r.tag}" names a block twice.`);
        for (const b of r.bespoke ?? []) {
            if (BLOCKS.has(b)) fail(`entityBlocks: row "${r.tag}" files "${b}" as bespoke, but BLOCKS declares it — it belongs under \`blocks\`.`);
        }
        if (r.unique !== null && !nonEmptyString(r.unique)) fail(`entityBlocks: row "${r.tag}"'s \`unique\` is a sentence or null.`);
        if (r.unique && r.blocks.length) fail(`entityBlocks: row "${r.tag}" is unique and still names blocks [${r.blocks.join(', ')}].`);
        if (!r.unique && !r.blocks.length) fail(`entityBlocks: row "${r.tag}" names no block and is not unique.`);
    }
    for (const [source, table] of [['enemy', enemies], ['hazard', hazards]]) {
        for (const tag of Object.keys(table)) {
            if (!seen.has(`${source}:${tag}`)) fail(`entityBlocks: the census tag "${tag}" (${source}) has no row.`);
        }
    }
    for (const [tag, row] of Object.entries(enemies)) {
        const word = row.aggro?.kind;
        if (!Object.hasOwn(aggro, word)) {
            fail(`entityBlocks: the aggro word "${word}" (used by "${tag}") has no AGGRO_KIND_BLOCKS row.`);
        }
        const want = aggro[word];
        if (want !== null && !BLOCKS.has(want)) fail(`entityBlocks: AGGRO_KIND_BLOCKS["${word}"] = "${want}" is not a declared block.`);
        const r = seen.get(`enemy:${tag}`);
        const moves = movementOf(r.blocks);
        const agrees = want === null ? moves.length === 0 : moves.length === 1 && moves[0] === want;
        if (!agrees && !nonEmptyString(r.aggroNote)) {
            fail(`entityBlocks: row "${tag}" moves by [${moves.join(', ')}] but its aggro word "${word}" denotes `
                + `${want === null ? 'no block' : `"${want}"`}, and the row gives no \`aggroNote\` saying why.`);
        }
        if (want !== null && !moves.includes(want)) {
            fail(`entityBlocks: row "${tag}" does not name "${want}", the block its aggro word "${word}" denotes.`);
        }
    }
    for (const f of FAMILY_BLOCKS) {
        for (const id of f.blocks) {
            if (!BLOCKS.has(id)) fail(`entityBlocks: family "${f.family}" names the block "${id}", which BLOCKS does not declare.`);
        }
    }
}

assertEntityBlocks();

/* ─────────────────────────────── the lookups ─────────────────────────────── */

/** The row for a census tag, or undefined. */
export function entityBlocksOf(tag) {
    return ENTITY_BLOCKS.find((r) => r.tag === tag);
}

/**
 * ⛓ block id → the families that realise it and are read by some solver-family
 * file. A family with an empty `solverReads` contributes nothing.
 *
 * ⚠ `depth: 'live'` (the default) counts the `run.entities` families only —
 * per-tick state the solver steps or reads. `depth: 'avoid'` counts the
 * `hazardVolume` arms only: a static volume unioned over every phase, which
 * lets a route STAY OUT but says nothing about the behaviour inside.
 */
export function modellingFamilies({ depth = 'live' } = {}) {
    const kind = depth === 'live' ? RUN_ENTITIES : depth === 'avoid' ? VOLUME
        : fail(`modellingFamilies: depth is "live" or "avoid", not ${JSON.stringify(depth)}.`);
    const out = new Map();
    for (const f of FAMILY_BLOCKS) {
        if (f.kind !== kind || !f.solverReads.length) continue;
        for (const id of f.blocks) {
            if (!out.has(id)) out.set(id, []);
            out.get(id).push(f.family);
        }
    }
    return out;
}

const inDeclarationOrder = (ids) => BLOCKS.ids().filter((id) => ids.has(id));

/** ⛓ The block ids the solver reasons about today — realised by a `run.entities` family it reads — in `BLOCKS` order. */
export function blocksTheSolverModels() {
    return inDeclarationOrder(new Set(modellingFamilies().keys()));
}

/** ⛓ The declared block ids no solver-read family realises — what a new concept would need modelled first. */
export function blocksNoFamilyModels() {
    const modelled = new Set(modellingFamilies().keys());
    return BLOCKS.ids().filter((id) => !modelled.has(id));
}

/** ⛓ The unmodelled blocks a `hazardVolume` arm still prices as an avoid volume. */
export function blocksOnlyAvoided() {
    const modelled = new Set(modellingFamilies().keys());
    return inDeclarationOrder(new Set([...modellingFamilies({ depth: 'avoid' }).keys()]
        .filter((id) => !modelled.has(id))));
}

/**
 * ⛓ CERTIFIABILITY AS A LOOKUP: split a realisation's `blocks` (P2's shape,
 * `{chase: {…}, contact: {…}}`) into the ids the solver models and those it
 * does not. `avoidedOnly` is the part of `unmodelled` an avoid volume prices
 * (the solver can keep a route out of it, not reason inside it). An id
 * `BLOCKS` does not declare is refused by name.
 *
 * @param {Record<string, object>} realisationBlocks
 * @returns {{modelled: string[], unmodelled: string[], avoidedOnly: string[]}} in key order
 */
export function certifiableBlocks(realisationBlocks) {
    if (realisationBlocks === null || typeof realisationBlocks !== 'object' || Array.isArray(realisationBlocks)) {
        fail('certifiableBlocks: a realisation\'s `blocks` is an object keyed by block id.');
    }
    const modelled = new Set(blocksTheSolverModels());
    const avoided = new Set(blocksOnlyAvoided());
    const out = { modelled: [], unmodelled: [], avoidedOnly: [] };
    for (const id of Object.keys(realisationBlocks)) {
        if (!BLOCKS.has(id)) fail(`certifiableBlocks: "${id}" is not a block behaviourBlocks.BLOCKS declares.`);
        if (modelled.has(id)) out.modelled.push(id);
        else {
            out.unmodelled.push(id);
            if (avoided.has(id)) out.avoidedOnly.push(id);
        }
    }
    return out;
}
