/**
 * seedlingDemo/rectPalette — **THE RECTANGLE VIEW'S COLOURS**, hoisted verbatim
 * out of `watchViewer.js` (Seedling JS runtime J1) so the JS runtime page
 * (`jsRuntimePage.js`) draws a room in the SAME ink as the watch page without
 * importing the viewer (an 11k-line module with a ~60-file closure).
 * ⛔ Imports nothing: it is a table, and a table's closure is one file.
 */

/**
 * Tile colours by TYPE, not by tileset column — the column is a drawing
 * detail and the type is what the physics reads. Anything unlisted falls
 * back to a plain floor colour, which is honest: it walks at 0.8 like the
 * rest.
 */
export const TILE_COLOURS = {
    1: '#1d4f7a',   // Water
    6: '#000000',   // Pit — the R1 transport primitive
    10: '#7a6a3a',  // Cliff Stairs
    16: '#4a3f3a',  // Igneous Stone
    17: '#8a2b12',  // Lava
    21: '#c8d6e0',  // Snow
    22: '#8fc7d8',  // Ice
    25: '#2f7fa8',  // Waterfall
    28: '#4b3a63',  // Ghost Tile
    29: '#6b4a2a',  // Bridge — solid until something spears it
    30: '#6a5a83',  // Ghost Tile Step
};
export const SOLID_COLOUR = '#3a3a42';
export const FLOOR_COLOUR = '#6b6152';

/**
 * ⛓⛓⛓ GROUP B — THE OBJECT SOLIDS, BY FAMILY, AND THE COMPLAINT THAT FORCED
 * IT: *a pushable block and a breakable rock are the same grey box.*
 *
 * They were. Every entity solid — 1219 of them across the atlas's 116 levels —
 * was drawn `#55506a`, so the two things a room's puzzle is usually MADE of
 * were indistinguishable from each other and from a dresser.
 *
 * ⛔ THE KEY IS THE RUN'S OWN JOIN, NOT THE TAG. `levelWorld` stamps exactly
 * one id field per changeable solid (`pushableId`, `rockId`, `chestId`, …) —
 * the same field `liveRectOf` switches on and the same one the world-state
 * layer marks through. Colouring by `s.tag` instead would be a second
 * classification of the same objects: `breakablerock` and `breakablerockghost`
 * are two tags and one family, `lock`/`cover`/`wandlock`/`bosslock`/
 * `shieldlock`/`rocklock`/`grasslock` are seven tags and one, and the day a
 * class was added the palette would quietly fall back to grey while the
 * mechanics kept working.
 *
 * ⛔⛔ MEASURED FIRST: NO SOLID CARRIES TWO OF THESE FIELDS. Over all 116
 * levels — activatorId 70 · rockId 24 · pushableId 19 · chestId 16 · treeId 6
 * · magicalLockId 6 · bridgeId 5 · pulserId 4 · crusherId 4 · ropeId 3 ·
 * turretId 2 · shieldBossId 1 · bossId 1 · finalDoorId 1, and **zero**
 * multi-keyed. So "first field that matches" is a total function here and not
 * a precedence rule that happens to work; if that ever stops being true the
 * order below becomes a silent choice, which is why the measurement is written
 * down rather than assumed.
 *
 * ⚠ 1057 OF THE 1219 CARRY NO FIELD AT ALL and stay grey — trees, poles,
 * spires, statues, furniture. That is the honest answer: they are scenery with
 * no run-changeable state, the legend says so, and a palette that gave every
 * tag its own hue would spend the reader's whole colour budget on the 87% of
 * boxes nothing can happen to.
 */
export const OBJECT_SOLID_FAMILIES = Object.freeze([
    Object.freeze({ key: 'pushableId', colour: '#6f5fd0', label: 'PUSHABLE block — a press or a lean moves it one tile' }),
    Object.freeze({ key: 'rockId', colour: '#a8703a', label: 'BREAKABLE rock — a press destroys it' }),
    Object.freeze({ key: 'chestId', colour: '#c0a038', label: 'chest' }),
    Object.freeze({ key: 'activatorId', colour: '#3f7f8a', label: 'lock / cover — opens while its group is held' }),
    Object.freeze({ key: 'magicalLockId', colour: '#8a3f8a', label: 'magical lock — the wand opens it' }),
    Object.freeze({ key: 'treeId', colour: '#3f7a3f', label: 'burnable tree' }),
    Object.freeze({ key: 'ropeId', colour: '#9a7a4a', label: 'rope — a pull SHRINKS it to one cell, it does not vanish' }),
    Object.freeze({ key: 'bridgeId', colour: '#6b4a2a', label: 'bridge — solid until something spears it' }),
    Object.freeze({ key: 'pulserId', colour: '#b04070', label: 'pulser — solid always; its flag makes it HIT' }),
    Object.freeze({ key: 'crusherId', colour: '#c04040', label: 'crusher — charges at a player it can SEE' }),
    Object.freeze({ key: 'turretId', colour: '#7fb0c0', label: 'ice turret — an ENEMY while alive, a wall once dead' }),
    Object.freeze({ key: 'bossId', colour: '#8a5f2a', label: 'boss totem — a wall until the wand WAKES it' }),
    Object.freeze({ key: 'shieldBossId', colour: '#9a4040', label: 'shield boss' }),
    Object.freeze({ key: 'finalDoorId', colour: '#5a5a9a', label: 'final door' }),
]);
/** Scenery: an object solid with no run-changeable state at all. */
export const SCENERY_COLOUR = '#55506a';
export const objectSolidColour = (s) => {
    for (const f of OBJECT_SOLID_FAMILIES) if (s[f.key]) return f.colour;
    return SCENERY_COLOUR;
};
