/**
 * procgenCore/behaviourBlocks — **THE BEHAVIOUR VOCABULARY, DECLARED** (behaviour
 * parameters P2, D2; plan `behaviour-parameters-plan.md` §2, ⚖ the user
 * 2026-09-30).
 *
 * A behaviour is said in four OPEN vocabularies, each a REGISTRY rather than a
 * list — an id is DECLARED where it is introduced and CHECKED BY CROSS-REFERENCE
 * wherever it is used (the pattern `feature` ids and `needs` already follow):
 *
 *   `BLOCKS`             what an enemy/hazard/obstacle DOES — a movement,
 *                        attack, defence or trigger block, each with FIELDS in
 *                        the one schema language (`templateContract`'s three
 *                        forms: a list, a range, an open id).
 *   `WEAPON_CATEGORIES`  what an item HITS WITH (Seedling's `Enemy.hit(_, t)`
 *                        category string, in neutral words).
 *   `DEFENCE_RESPONSES`  what a defender DOES when hit by a category (Seedling's
 *                        `Enemy.hit` flags and `BreakableRock`'s level test).
 *   `TILE_TRIGGERS`      what makes a tile-like obstacle GIVE WAY.
 *
 * ⛔ THE STARTER SET BELOW IS ORDINARY `declare` CALLS, NOT A GATE. A later slice
 * declares its own ids beside these (in its own module) and nothing here
 * changes; nothing branches on a starter id. Only `BLOCK_FAMILIES` is closed —
 * structural, like `concepts.CONCEPT_KINDS`: code branches on the family.
 *
 * ⛔ NO `slow|medium|fast`: a field is a `range` (numbers, in declared units) or
 * an `open` id, unless it is genuinely a finite choice (an aim mode, an axis).
 *
 * ⛔ BROWSER-SAFE AND NAMELESS, like `concepts.js`: no `node:` import, no
 * registry import, and no registered substrate id anywhere in this file
 * (asserted by `concepts.test.js`, which reads this file's source). A `why`
 * cites the Seedling class a block came from (`Turret.as`) — a source citation,
 * not a substrate id.
 */

import { assertParamSchema, domainKind, valueInDomain } from './templateContract.js';

export class BehaviourVocabularyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BehaviourVocabularyError';
    }
}

const fail = (message) => { throw new BehaviourVocabularyError(message); };
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/**
 * ⛓ A block's family — CLOSED and structural (like `CONCEPT_KINDS`): a chart
 * groups by it and a realisation's movement and attack are asked different
 * questions. The block ids inside each family are open.
 */
export const BLOCK_FAMILIES = Object.freeze(['movement', 'attack', 'defence', 'trigger']);

/** A schema's parameters, checked by the ONE schema language, refusals re-owned. */
function checkSchema(params, owner) {
    try {
        return assertParamSchema(params, owner);
    } catch (err) {
        return fail(`behaviourBlocks: ${err.message}`);
    }
}

/**
 * ⛓⛓ **A REGISTRY** — an open vocabulary, declared where introduced.
 *
 * `declare(id, record)` refuses a non-string or empty id, a duplicate id, and a
 * record with no `why`; `check(id, record)` (optional) asks the registry's own
 * record questions. A declared record is frozen and carries its `id`.
 *
 * @param {string} name   how refusals and an `open: {id}` field name it
 * @param {{check?: (id: string, record: object) => void}} [opts]
 */
export function createRegistry(name, { check } = {}) {
    if (!nonEmptyString(name)) fail('behaviourBlocks: a registry needs a non-empty name.');
    const records = new Map();
    const registry = {
        name,
        declare(id, record) {
            if (!nonEmptyString(id)) {
                fail(`behaviourBlocks: registry "${name}" was asked to declare the id `
                    + `${JSON.stringify(id)}; an id is a non-empty string.`);
            }
            if (records.has(id)) {
                fail(`behaviourBlocks: registry "${name}" already declares "${id}". An id is declared `
                    + 'ONCE, where it is introduced — a second declaration is a second answer to what it means.');
            }
            if (!isPlainObject(record) || !nonEmptyString(record.why)) {
                fail(`behaviourBlocks: registry "${name}" id "${id}" carries no \`why\`. Every declared `
                    + 'id says what it is for and where it came from.');
            }
            if (check) check(id, record);
            const frozen = Object.freeze({ ...record, id });
            records.set(id, frozen);
            return frozen;
        },
        has: (id) => records.has(id),
        get: (id) => records.get(id),
        ids: () => [...records.keys()],
    };
    return Object.freeze(registry);
}

/** A block record: `{family, fields: [<schema params, any form>], why}`. */
function checkBlock(id, record) {
    if (!BLOCK_FAMILIES.includes(record.family)) {
        fail(`behaviourBlocks: block "${id}" declares family ${JSON.stringify(record.family)}; a family is `
            + `one of [${BLOCK_FAMILIES.join(', ')}].`);
    }
    checkSchema(record.fields ?? [], `block "${id}"`);
}

/** A record whose optional `params` are a schema (a response, a tile trigger). */
const checkParams = (kind) => (id, record) => {
    if (record.params !== undefined) checkSchema(record.params, `${kind} "${id}"`);
};

export const BLOCKS = createRegistry('blocks', { check: checkBlock });
export const WEAPON_CATEGORIES = createRegistry('weaponCategories');
export const DEFENCE_RESPONSES = createRegistry('defenceResponses', { check: checkParams('response') });
export const TILE_TRIGGERS = createRegistry('tileTriggers', { check: checkParams('tile trigger') });

/** ⛓ The four registries by name — what an `open: {id}` field names. */
export const REGISTRIES = Object.freeze(Object.fromEntries(
    [BLOCKS, WEAPON_CATEGORIES, DEFENCE_RESPONSES, TILE_TRIGGERS].map((r) => [r.name, r]),
));

/**
 * ⛓ Is `v` a value this field admits — its form (`templateContract.
 * valueInDomain`) AND, for an `open: {id}` field, an id its registry declares?
 * Returns the refusal sentence, or null.
 */
export function fieldValueRefusal(p, v) {
    if (!valueInDomain(p, v)) return 'is not in its domain';
    if (domainKind(p) === 'open' && isPlainObject(p.open)) {
        const reg = REGISTRIES[p.open.id];
        if (reg && !reg.has(v)) return `is not an id the "${p.open.id}" registry declares`;
    }
    return null;
}

/* ─────────────────────────── the starter set ─────────────────────────── */

const speed = (w) => ({ key: 'speed', range: { min: 0, max: 2 }, default: 1, why: w });
const tiles = (key, max, d, w) => ({ key, range: { min: 0, max }, default: d, why: w });
const seconds = (key, max, d, w) => ({ key, range: { min: 0, max }, default: d, why: w });

/* ── weapon categories — Seedling's `Enemy.hit` strings, in neutral words ── */
[
    ['sword', "Seedling's `Sword` hit category (`Sword.as`, `GhostSword.as`, `DarkSword.as`)."],
    ['spear', "Seedling's `Spear` hit category (`GhostSpear.as`)."],
    ['fire', "Seedling's `Fire` hit category (`Fire.as`, `FireWand.as`), gated by `Enemy.hitByFire`."],
    ['magic', "Seedling's `Wand` hit category (`Wand.as`, `WandShot.as`)."],
    ['pulse', "Seedling's `Pulse` hit category (`Pulser.as`)."],
    ['shield', "Seedling's `Shield` hit category (`Shield.as`, `DarkShield.as`), which sets `hitByDarkStuff`."],
    ['armour', "Seedling's `Suit` hit category (`DarkSuit.as`), which sets `hitByDarkStuff`."],
    ['lava', "Seedling's `Lava` hit category string in `Enemy.hit`."],
    ['projectile', "Seedling's `LavaBall` hit category (`LavaBall.as`) and the thrown shots it stands for."],
    ['explosion', "Blast damage (`Explosion.as`, `Bomb.as`) — the plan's word; Seedling's own hit string for it is not measured here."],
    ['crusher', "Seedling's `Crusher` hit category (`Crusher.as`)."],
    ['chain', "Seedling's `LavaChain` hit category (`LavaChain.as`)."],
].forEach(([id, w]) => WEAPON_CATEGORIES.declare(id, { why: w }));

/* ── defence responses — what `Enemy.hit` does with a category ── */
DEFENCE_RESPONSES.declare('damage', {
    why: "`Enemy.hit`'s ordinary path: the hit's force (capped by `maxForce`) comes off the defender's health.",
    params: [{ key: 'factor', range: { min: 0, max: 4 }, default: 1,
        why: 'how much of the hit lands — `maxForce` caps it in `Enemy.hit`; 1 is the hit as dealt' }],
});
DEFENCE_RESPONSES.declare('knockOnly', {
    why: '`Enemy.justKnock` in `Enemy.as`: the hit bumps the defender back and does no harm.',
});
DEFENCE_RESPONSES.declare('ignore', {
    why: "`Enemy.hit` refusing a category — `onlyHitBy` naming another, `hitByFire` false, or `canHit` false.",
});
DEFENCE_RESPONSES.declare('breakIfLevel', {
    why: "`BreakableRock.as`'s `rockType <= _t`: the hit breaks the defender only at or above a level.",
    params: [{ key: 'level', range: { min: 0, max: 5, step: 1 }, default: 1,
        why: 'the weapon level at or above which the hit breaks it (`rockType` in `BreakableRock.as`)' }],
});
DEFENCE_RESPONSES.declare('reflect', {
    why: "The hit is turned back toward the one who dealt it — the plan's §2 starter set; no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry).",
});
DEFENCE_RESPONSES.declare('freeze', {
    why: '`IceTurretBlast.as`\'s freeze: the hit leaves the defender frozen in place for a while.',
    params: [seconds('duration', 10, 2, 'seconds the defender stays frozen')],
});
DEFENCE_RESPONSES.declare('stun', {
    why: "`Enemy.as`'s hit timer (`hitsTimer`): the hit stops the defender acting for a while.",
    params: [seconds('duration', 10, 1, 'seconds the defender does nothing')],
});
DEFENCE_RESPONSES.declare('heal', {
    why: "The category restores the defender instead of harming it — the plan's §2 starter set; no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry).",
    params: [{ key: 'amount', range: { min: 0, max: 10 }, default: 1, why: 'health restored per hit' }],
});
DEFENCE_RESPONSES.declare('split', {
    why: "The hit replaces the defender with smaller copies — the plan's §2 starter set; no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry).",
    params: [{ key: 'count', range: { min: 2, max: 4, step: 1 }, default: 2, why: 'how many copies the hit makes' }],
});
DEFENCE_RESPONSES.declare('spawn', {
    why: "`TentacleBeast.as` adding `Tentacle`s: the defender's answer brings another entity into the room.",
    params: [{ key: 'entity', open: 'string', default: 'minion',
        why: 'what comes out — an entity id, open because no entity registry exists yet' }],
});
DEFENCE_RESPONSES.declare('phaseGated', {
    why: "The category only lands in a named phase of the defender — the plan's §2 starter set; no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry).",
    params: [{ key: 'phase', open: 'string', default: 'exposed', why: 'the phase in which the hit lands' }],
});

/* ── tile triggers — what makes a tile-like obstacle give way ── */
TILE_TRIGGERS.declare('itemCategory', {
    why: "The locks that open to one weapon (`WandLock.as`, `ShieldLock.as`): an item of a category clears it.",
    params: [{ key: 'category', open: { id: 'weaponCategories' }, default: 'sword',
        why: 'the weapon category that clears the tile' }],
});
TILE_TRIGGERS.declare('level', {
    why: "`RockLock.as` / `BreakableRock.as`: the tile clears to a category at or above a level.",
    params: [
        { key: 'category', open: { id: 'weaponCategories' }, default: 'sword', why: 'the category whose level is compared' },
        { key: 'level', range: { min: 0, max: 5, step: 1 }, default: 1, why: 'the level at or above which it clears' },
    ],
});
TILE_TRIGGERS.declare('counter', {
    why: '`BossLock.as` / `SealController.as`: the tile clears once a count of things is gathered or done.',
    params: [{ key: 'count', range: { min: 1, max: 12, step: 1 }, default: 1, why: 'how many it takes' }],
});
TILE_TRIGGERS.declare('channel', {
    why: '`Wire.as`\'s on/off wiring: the tile clears when a named channel fires.',
    params: [{ key: 'channel', open: 'string', default: 'a', why: 'the channel name the button and the tile share' }],
});

/* ── blocks: movement ── */
BLOCKS.declare('stationary', {
    family: 'movement', fields: [],
    why: '`Turret.as`: the entity stays where it is placed.',
});
BLOCKS.declare('chase', {
    family: 'movement',
    fields: [
        speed('speed as a fraction of the player\'s — the chase idiom `Bob.as`, `Jellyfish.as`, `Spinner.as`, `Puncher.as`, `Drill.as` copy'),
        tiles('range', 20, 6, 'how near the player must come, in tiles, before the chase starts (their `FP.distance` test)'),
    ],
    why: 'The chase idiom copy-pasted across `Bob.as`, `Jellyfish.as`, `Spinner.as`, `Puncher.as` and `Drill.as`.',
});
BLOCKS.declare('rebound', {
    family: 'movement',
    fields: [
        speed('speed as a fraction of the player\'s'),
        { key: 'axis', domain: ['horizontal', 'vertical', 'diagonal'], default: 'horizontal',
            why: 'which way it travels between the walls it turns at — a genuine finite choice' },
    ],
    why: '`Flyer.as`: the entity travels straight and turns back when it meets a wall.',
});
BLOCKS.declare('patrol', {
    family: 'movement',
    fields: [speed('speed as a fraction of the player\'s'), tiles('length', 20, 4, 'the patrol lane\'s length in tiles')],
    why: '`LavaRunner.as`: the entity walks a fixed lane and turns at its ends.',
});
BLOCKS.declare('seek', {
    family: 'movement',
    fields: [speed('speed as a fraction of the player\'s'), { key: 'target', open: 'string', default: 'player',
        why: 'what it steers toward — the player, or a named entity' }],
    why: "The entity steers toward a named target rather than the player alone — the plan's §2 starter set; no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry).",
});
BLOCKS.declare('ballistic', {
    family: 'movement',
    fields: [{ key: 'gravity', range: { min: 0, max: 2 }, default: 1, why: 'the pull on it, as a fraction of the player\'s' }],
    why: '`Grenade.as` and `FallRock.as`: the entity flies under gravity once released.',
});
BLOCKS.declare('pushable', {
    family: 'movement',
    fields: [{ key: 'by', open: { id: 'weaponCategories' }, default: 'sword',
        why: 'the category that pushes it (`PushableBlockFire.as`, `PushableBlockSpear.as`)' }],
    why: '`PushableBlock.as` and its `PushableBlockFire.as` / `PushableBlockSpear.as` variants: it moves when pushed.',
});
BLOCKS.declare('wall-launch', {
    family: 'movement',
    fields: [speed('launch speed as a fraction of the player\'s')],
    why: '`WallFlyer.as`: the entity clings to a wall and launches off it (bespoke).',
});
BLOCKS.declare('tile-hop', {
    family: 'movement',
    fields: [tiles('reach', 4, 1, 'tiles per hop'), seconds('interval', 5, 1, 'seconds between hops')],
    why: "`Bob.as`'s hop: the entity moves in whole-tile jumps (bespoke).",
});
BLOCKS.declare('lane-charge', {
    family: 'movement',
    fields: [speed('charge speed as a fraction of the player\'s'), tiles('range', 20, 6, 'how far it sees down its lane')],
    why: '`Drill.as`: the entity waits in a lane and charges when the player enters it (bespoke).',
});
BLOCKS.declare('rise', {
    family: 'movement',
    fields: [tiles('range', 20, 3, 'how near the player must come before it rises'), seconds('interval', 5, 1, 'seconds it stays up')],
    why: '`Tentacle.as`: the entity rises out of the ground near the player and sinks back (bespoke).',
});

/* ── blocks: attack ── */
BLOCKS.declare('contact', {
    family: 'attack',
    fields: [{ key: 'damage', range: { min: 0, max: 10 }, default: 1, why: 'health the player loses on touch' }],
    why: "`Enemy.as`'s touch damage: every enemy that collides with the player hurts it.",
});
BLOCKS.declare('emitter', {
    family: 'attack',
    fields: [
        { key: 'aim', domain: ['fixed', 'atPlayer'], default: 'atPlayer',
            why: 'whether shots go one way or at the player — the turret aim idiom `Turret.as` and `IceTurret.as` share' },
        seconds('interval', 10, 2, 'seconds between shots'),
        { key: 'projectile', open: 'string', default: 'shot', why: 'what it fires (`TurretSpit.as`, `IceTurretBlast.as`)' },
    ],
    why: 'The turret aim idiom of `Turret.as` and `IceTurret.as`: the entity fires projectiles on a timer.',
});
BLOCKS.declare('sweep', {
    family: 'attack',
    fields: [tiles('radius', 6, 2, 'the sweep\'s radius in tiles'), speed('turns per second')],
    why: '`SpinningAxe.as`: a blade sweeps a circle around a fixed point.',
});
BLOCKS.declare('melee', {
    family: 'attack',
    fields: [tiles('reach', 3, 1, 'the strike\'s reach in tiles'), seconds('windup', 3, 0.5, 'seconds of warning before it lands')],
    why: '`Puncher.as`: the entity strikes at close range after a wind-up.',
});
BLOCKS.declare('pulse', {
    family: 'attack',
    fields: [tiles('radius', 6, 2, 'the ring\'s reach in tiles'), seconds('interval', 10, 2, 'seconds between pulses')],
    why: '`Pulser.as`: a ring of force radiates out on a timer.',
});
BLOCKS.declare('stomp', {
    family: 'attack',
    fields: [tiles('radius', 4, 1, 'the landing\'s reach in tiles')],
    why: "`FallRock.as` (and the `Crusher` hit category): the attack lands from above onto what is below.",
});
BLOCKS.declare('explode', {
    family: 'attack',
    fields: [tiles('radius', 6, 2, 'the blast radius in tiles'), seconds('fuse', 10, 2, 'seconds before it goes off')],
    why: '`Grenade.as` and `Bomb.as`: the entity bursts after a fuse (`Explosion.as`).',
});
BLOCKS.declare('beam', {
    family: 'attack',
    fields: [tiles('length', 20, 6, 'the beam\'s length in tiles')],
    why: '`BeamTower.as` and `LightRay.as`: a continuous line that hurts what crosses it (bespoke).',
});
BLOCKS.declare('tether', {
    family: 'attack',
    fields: [tiles('length', 10, 3, 'the chain\'s length in tiles')],
    why: '`LavaChain.as`: a hazard swung on a chain from a fixed anchor (bespoke).',
});

/* ── blocks: defence ── */
BLOCKS.declare('hp', {
    family: 'defence',
    fields: [{ key: 'health', range: { min: 1, max: 50, step: 1 }, default: 3, why: 'hits of force 1 it takes to fall (`Enemy.health`)' }],
    why: "`Enemy.as`'s `health`: the defender falls when it runs out.",
});
BLOCKS.declare('matrix', {
    family: 'defence',
    fields: [{ key: 'responses', open: { id: 'defenceResponses' }, default: 'damage',
        why: 'the response a category not otherwise named meets — the concept\'s `defence` map names the rest' }],
    why: "`Enemy.hit`'s flags (`onlyHitBy`, `hitByFire`, `hitByDarkStuff`, `justKnock`, `canHit`, `maxForce`): a response per weapon category.",
});
BLOCKS.declare('terrain', {
    family: 'defence',
    fields: [{ key: 'terrain', open: 'string', default: 'water', why: 'the terrain it is safe inside' }],
    why: '`Jellyfish.as` in water and `LavaRunner.as` in lava: the defender cannot be reached outside its terrain.',
});
BLOCKS.declare('onDeath', {
    family: 'defence',
    fields: [{ key: 'drops', open: 'string', default: 'nothing', why: 'what it leaves behind (`HealthPickup.as`, `Coin.as`)' }],
    why: "`Enemy.as`'s death: the defender leaves a pickup or an effect behind when it falls.",
});

/* ── blocks: trigger ── */
BLOCKS.declare('proximity', {
    family: 'trigger',
    fields: [tiles('range', 20, 4, 'how near the player must come, in tiles')],
    why: 'The `FP.distance` test at the top of `Turret.as`, `Spinner.as` and `DarkTrap.as`: the behaviour starts when the player comes near.',
});
BLOCKS.declare('lineOfSight', {
    family: 'trigger',
    fields: [tiles('range', 20, 8, 'how far it sees, in tiles')],
    why: "The behaviour starts when the player is visible down a clear line — the plan's §2 starter set; no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry).",
});
BLOCKS.declare('channel', {
    family: 'trigger',
    fields: [{ key: 'channel', open: 'string', default: 'a', why: 'the channel name it listens on' }],
    why: '`Wire.as`\'s on/off wiring: the behaviour starts when a named channel fires.',
});
BLOCKS.declare('persistence', {
    family: 'trigger',
    fields: [{ key: 'scope', domain: ['room', 'world'], default: 'room', why: 'whether its state resets on leaving the room' }],
    why: "A triggered state that outlives the room, or not — the plan's §2 starter set; no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry).",
});
BLOCKS.declare('onHit', {
    family: 'trigger',
    fields: [{ key: 'category', open: { id: 'weaponCategories' }, default: 'sword', why: 'the category whose hit sets it off' }],
    why: "The behaviour starts when the entity is hit by a category — the plan's §2 starter set; no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry).",
});
BLOCKS.declare('allEnemiesDead', {
    family: 'trigger', fields: [],
    why: "The behaviour starts when the room holds no enemy — the plan's §2 starter set; no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry).",
});
BLOCKS.declare('itemHeld', {
    family: 'trigger',
    fields: [{ key: 'item', open: 'string', default: 'Progressive Sword', why: 'the item the player must hold (an item id)' }],
    why: "`Inventory.as`'s held items: the behaviour starts only while the player holds an item.",
});
BLOCKS.declare('schedule', {
    family: 'trigger',
    fields: [seconds('period', 20, 2, 'seconds per cycle'), seconds('offset', 20, 0, 'seconds into the cycle it starts')],
    why: '`Pulser.as`\'s timer: the behaviour runs on a fixed cycle.',
});
BLOCKS.declare('light', {
    family: 'trigger',
    fields: [{ key: 'lit', domain: ['lit', 'dark'], default: 'dark', why: 'whether it acts in light or in darkness' }],
    why: '`DarkTrap.as` and `LightBoss.as` (`PlayerLight.as`): the behaviour depends on whether the player is lit (bespoke).',
});
BLOCKS.declare('facingAway', {
    family: 'trigger', fields: [],
    why: "The behaviour runs only while the player faces away (bespoke) — the plan's §2 starter set; no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry).",
});

/**
 * ⛓ EVERY `open: {id}` IN EVERY DECLARED SCHEMA NAMES A REGISTRY THIS FILE HOLDS,
 * and every such default is declared in it — checked at load, like
 * `assertConceptTable(CONCEPTS)`.
 */
export function assertVocabulary() {
    const schemas = [
        ...BLOCKS.ids().map((id) => [`block "${id}"`, BLOCKS.get(id).fields]),
        ...DEFENCE_RESPONSES.ids().map((id) => [`response "${id}"`, DEFENCE_RESPONSES.get(id).params ?? []]),
        ...TILE_TRIGGERS.ids().map((id) => [`tile trigger "${id}"`, TILE_TRIGGERS.get(id).params ?? []]),
    ];
    for (const [owner, params] of schemas) {
        for (const p of params) {
            if (domainKind(p) !== 'open' || !isPlainObject(p.open)) continue;
            const reg = REGISTRIES[p.open.id];
            if (!reg) {
                fail(`behaviourBlocks: ${owner} field "${p.key}" is open over the registry "${p.open.id}", `
                    + `which is not one of [${Object.keys(REGISTRIES).join(', ')}].`);
            }
            if (!reg.has(p.default)) {
                fail(`behaviourBlocks: ${owner} field "${p.key}" defaults to "${p.default}", which the `
                    + `"${p.open.id}" registry does not declare.`);
            }
        }
    }
}

assertVocabulary();
