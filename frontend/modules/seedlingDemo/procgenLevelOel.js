/**
 * seedlingDemo/procgenLevelOel — a generated level record, rendered as the OEL
 * XML a level set carries.
 *
 * Phase 5 of `CC/docs/plans/seedling-external-level-sets.md`.
 *
 * ── ⛔ WHY THIS HAD TO EXIST AT ALL, AND IT IS A FINDING ABOUT THE GENERATOR ──
 *
 * The plan's Phase 5 line reads "emit a manifest from generated levels
 * (`procgenSeedling` output → bundle)", which presumes the generator's output is
 * already the shape a bundle wants. IT IS NOT, and the gap is not metadata:
 * `procgenSeedling` emits an **Ogmo RECORD** — `{level, class, path, width,
 * height, layers:[{name,set,tiles}], entities:[]}`, with geometry in TILES —
 * because everything downstream of it in the PoC arc was the JS model
 * (`buildLevelWorld`), which reads records. A level set's `rooms[].source.xml`
 * is **OEL XML text with geometry in PIXELS**, because the receiver's one
 * resolver ends in `Game.loadLevelXML` (plan §4.3 shape (c)).
 *
 * ⇒ The generated levels had never been expressible as a mountable room. There
 * is exactly one delivery callback into the artifact (`botLoadLevels`), it takes
 * level-set chunks, and nothing converted a record into one. This module is that
 * conversion, and it is the reason Phase 5 is a producer rather than a mapping.
 *
 * ── THE INVERSE OF `scripts/procgen/seedlingOgmo.js`, AND ONLY THAT ──────────
 *
 * That parser is the one OEL reader in the repo; this is the one writer, and it
 * is written as its inverse so the pair can be tested by round trip rather than
 * by two hand-maintained descriptions of the same format. The conversions it
 * undoes, each named because each is a place a silent off-by-16 could live:
 *
 *   ·  `<width>`/`<height>` are PIXELS; a record's are TILES        (x16)
 *   ·  `<tile x= y=>` are PIXELS; a record's `[x, y, …]` are TILES  (x16)
 *   ·  `<tile tx= ty=>` are RAW TILESET COORDINATES and stay as they are
 *   ·  entity `x`/`y` are RAW PIXELS and are NOT grid-aligned (the `statue2`
 *      in OverWorld.oel sits at x=184), so they pass through untouched
 *   ·  `<node>` children are DATA — `Game.as:2201-2210` sizes a RopeStart from
 *      the last node's x, and a rope without them is a 16x16 stub where the
 *      level meant a horizontal span
 *
 * ── ⚠ THE ROUND TRIP IS BY VALUE, NEVER BY BYTES, AND THE CORPUS SAYS WHY ────
 *
 * `treelarge.oel` carries `text="…Press &lt;W> to hear…"` — a RAW `>` inside an
 * attribute value, which is legal XML and which this writer emits as `&gt;`.
 * Same value, different bytes. A byte-comparison round trip against the shipped
 * corpus would fail on that file and be measuring the encoder's taste rather
 * than whether anything survived. `parse(render(record))` deep-equalling
 * `record` is the property that matters, and it is the one the tests assert.
 *
 * Headless-safe: no `node:` imports and no DOM — the page's GENERATE arm is a
 * legitimate future caller and this module is in the bundled browser graph.
 */

import { TILE_SIZE } from './levelWorld.js';

export class ProcgenOelError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenOelError';
    }
}

const fail = (message) => { throw new ProcgenOelError(message); };

// XML names, per the subset the OEL dialect actually uses: the game's own
// element roster is all lowercase ASCII (`Game.as:2119-2287`). Refusing anything
// else is deliberate — an entity `type` that is not a legal element name would
// produce a document the game's E4X parser rejects at `new XML(str)`, which is
// an abort inside the wasm rather than a message anybody reads.
const XML_NAME_RE = /^[A-Za-z_][\w.-]*$/;

/**
 * Escape a value for an XML attribute.
 *
 * ⛔ `&` FIRST, ALWAYS. Escaping it after `<` would double-escape the ampersand
 * this function just introduced, and the corpus contains real `&lt;` sequences
 * to get that wrong on.
 */
export function escapeXmlAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const attrPair = (name, value) => `${name}="${escapeXmlAttr(value)}"`;

function checkInt(value, label) {
    if (!Number.isInteger(value)) {
        fail(`procgenLevelOel: ${label} must be an integer, got ${JSON.stringify(value)}`);
    }
    return value;
}

/**
 * Render one level record as OEL XML.
 *
 * @param {object} record  `{width, height, layers, entities}` in TILES
 * @param {{indent?: string}} [options]
 * @returns {string} OEL XML text, suitable for a level set's `source.xml`
 */
export function recordToOel(record, options = {}) {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        fail('procgenLevelOel: recordToOel needs a level record object');
    }
    const pad = options.indent ?? '  ';
    const width = checkInt(record.width, 'record.width');
    const height = checkInt(record.height, 'record.height');
    if (width < 1 || height < 1) {
        fail(`procgenLevelOel: record is ${width}x${height} tiles — a level with no cells is not a level`);
    }

    const out = ['<level>'];
    // ⚠ PIXELS. `parseOelLevel` refuses a level whose size is not a multiple of
    // TILE_SIZE, so this multiplication is the only thing that makes the output
    // readable by the parser this module inverts.
    out.push(`${pad}<width>${width * TILE_SIZE}</width>`);
    out.push(`${pad}<height>${height * TILE_SIZE}</height>`);

    const layers = Array.isArray(record.layers) ? record.layers : [];
    layers.forEach((layer, li) => {
        if (layer === null || typeof layer !== 'object') {
            fail(`procgenLevelOel: layers[${li}] must be an object`);
        }
        const name = layer.name;
        if (typeof name !== 'string' || !XML_NAME_RE.test(name)) {
            fail(`procgenLevelOel: layers[${li}].name ${JSON.stringify(name)} is not a legal XML element name`);
        }
        // `set` is optional: `parseOelLevel` records `null` when the layer
        // carried no `set` attribute, and round-tripping that has to give the
        // attribute back only when it was there.
        const open = layer.set == null
            ? `${pad}<${name}>`
            : `${pad}<${name} ${attrPair('set', layer.set)}>`;
        out.push(open);
        const tiles = Array.isArray(layer.tiles) ? layer.tiles : [];
        tiles.forEach((t, ti) => {
            if (!Array.isArray(t) || t.length !== 4) {
                fail(`procgenLevelOel: layers[${li}].tiles[${ti}] must be [x, y, tx, ty] in tiles`);
            }
            const [x, y, tx, ty] = t;
            checkInt(x, `layers[${li}].tiles[${ti}][0]`);
            checkInt(y, `layers[${li}].tiles[${ti}][1]`);
            checkInt(tx, `layers[${li}].tiles[${ti}][2]`);
            checkInt(ty, `layers[${li}].tiles[${ti}][3]`);
            // ⛔ REFUSED, NOT DROPPED. Ogmo lets an author paint past the level
            // rectangle and 51 shipped levels do; the game's own loader guards
            // each placement and silently ignores those, and `parseOelLevel`
            // drops them and COUNTS them. A generated record has no such
            // history — a cell outside its own rectangle is a generator bug,
            // and emitting it would hand the game a tile it discards while this
            // file reported a room that contained it.
            if (x < 0 || y < 0 || x >= width || y >= height) {
                fail(`procgenLevelOel: layers[${li}].tiles[${ti}] is at cell (${x}, ${y}), outside the ${width}x${height} rectangle — the game's loader would drop it silently (Game.as loadlevel's bounds guard), leaving a room that does not contain the tile this record says it does`);
            }
            out.push(`${pad}${pad}<tile ${attrPair('tx', tx)} ${attrPair('ty', ty)} ${
                attrPair('x', x * TILE_SIZE)} ${attrPair('y', y * TILE_SIZE)}/>`);
        });
        out.push(`${pad}</${name}>`);
    });

    // ⛓ ALWAYS EMITTED, EVEN WHEN EMPTY. `Game.as:1963` guards the whole entity
    // pass with `xml.hasOwnProperty("objects")`, so a room with no <objects> is
    // legal — but a set builder that omitted the element for empty rooms and
    // wrote it for the rest would make "this room has no entities" and "this
    // room's entities were lost" the same document.
    const entities = Array.isArray(record.entities) ? record.entities : [];
    out.push(`${pad}<objects>`);
    entities.forEach((e, ei) => {
        if (e === null || typeof e !== 'object') {
            fail(`procgenLevelOel: entities[${ei}] must be an object`);
        }
        const type = e.type;
        if (typeof type !== 'string' || !XML_NAME_RE.test(type)) {
            fail(`procgenLevelOel: entities[${ei}].type ${JSON.stringify(type)} is not a legal XML element name`);
        }
        const parts = [attrPair('x', checkInt(e.x, `entities[${ei}].x`)),
            attrPair('y', checkInt(e.y, `entities[${ei}].y`))];
        const attrs = e.attrs ?? {};
        if (attrs === null || typeof attrs !== 'object' || Array.isArray(attrs)) {
            fail(`procgenLevelOel: entities[${ei}].attrs must be an object`);
        }
        for (const [k, v] of Object.entries(attrs)) {
            if (!XML_NAME_RE.test(k)) {
                fail(`procgenLevelOel: entities[${ei}] attribute name ${JSON.stringify(k)} is not legal`);
            }
            // ⛔ `x`/`y` LIVE IN THEIR OWN FIELDS AND NOWHERE ELSE. The parser
            // hoists them out of `attrs`, so an `attrs.x` here would emit the
            // attribute twice — and a duplicate attribute is the kind of thing
            // one XML parser rejects and another silently resolves to the last
            // one, which would make the record mean different things on the two
            // sides of the same round trip.
            if (k === 'x' || k === 'y') {
                fail(`procgenLevelOel: entities[${ei}].attrs.${k} duplicates the entity's own ${k} — position lives in entities[].${k}, never in attrs`);
            }
            parts.push(attrPair(k, v));
        }
        const nodes = Array.isArray(e.nodes) ? e.nodes : [];
        if (nodes.length === 0) {
            out.push(`${pad}${pad}<${type} ${parts.join(' ')}/>`);
            return;
        }
        out.push(`${pad}${pad}<${type} ${parts.join(' ')}>`);
        nodes.forEach((n, ni) => {
            if (n === null || typeof n !== 'object') {
                fail(`procgenLevelOel: entities[${ei}].nodes[${ni}] must be an object`);
            }
            out.push(`${pad}${pad}${pad}<node ${attrPair('x', checkInt(n.x, `entities[${ei}].nodes[${ni}].x`))} ${
                attrPair('y', checkInt(n.y, `entities[${ei}].nodes[${ni}].y`))}/>`);
        });
        out.push(`${pad}${pad}</${type}>`);
    });
    out.push(`${pad}</objects>`);
    out.push('</level>');
    return `${out.join('\n')}\n`;
}
