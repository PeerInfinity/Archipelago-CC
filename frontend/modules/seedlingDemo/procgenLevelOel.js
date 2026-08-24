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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ **THE READER, MOVED IN BESIDE ITS INVERSE** — EDITOR v3 slice C1.
 *
 * ⛔ **WHY IT MOVED, AND IT IS THE DECISION SLICE B LEFT TO C.** `parseOelLevel`
 * lived in `scripts/procgen/seedlingOgmo.js`, and slice B's adapter takes it as
 * an INJECTED parameter because **no module under `frontend/` imports anything
 * under `scripts/`** — measured, and still true after this move. The `edit`
 * arm's `base: {kind:'oel', xml}` needs a reader IN THE BROWSER, and there were
 * three ways to get one: invert the direction (the tree's first inversion),
 * copy the parser (two readers of one format), or move it beside the writer
 * that this file's own docblock already calls its inverse. The third is the
 * only one that leaves ONE reader and ONE writer.
 *
 * ⛓ **`scripts/procgen/seedlingOgmo.js` RE-EXPORTS these**, so every existing
 * caller is unchanged and the direction stays scripts → frontend. What stays
 * there is `parseLevelTable`, which reads a `Game.as` `[Embed]` table — a fact
 * about a SOURCE TREE, not about the level format, and nothing on a page can
 * use it.
 *
 * ⛓ **AND THE ADAPTER'S `parseOel` IS STILL INJECTED.** Slice B's argument for
 * a construction parameter was never about where the file sat: a substrate
 * adapter that reached for a concrete parser would be choosing one for its
 * callers. What changed is that the PAGE now has one to hand it.
 *
 * ⚠ THE BODY BELOW IS THE SAME BYTES it had in `seedlingOgmo.js`, moved and not
 * rewritten — `procgenLevelOel.test.js` and `seedlingOgmo.test.js` both round
 * trip it and neither was edited for the move.
 * ══════════════════════════════════════════════════════════════════════ */

// --- minimal XML reader ------------------------------------------------------
//
// Hand-rolled because the repo has no XML dependency and .oel is a tiny,
// machine-written dialect: no declaration, no comments, no CDATA, no
// namespaces. It is still a character scanner rather than a regex because at
// least one attribute value contains a raw '>' (treelarge.oel's rekcahdam
// dialogue: `text="…Press &lt;W> to hear…"`), which any `<[^>]*>` split would
// tear in half.

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXmlText(text) {
    return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
        if (body[0] === '#') {
            const code = body[1] === 'x' || body[1] === 'X'
                ? parseInt(body.slice(2), 16)
                : parseInt(body.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
        }
        return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)
            ? NAMED_ENTITIES[body]
            : whole;
    });
}

const isSpace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

/**
 * Parse an XML document into `{ tag, attrs, children, text }` nodes.
 * `text` is the concatenated direct character data of the element.
 */
export function parseXml(source) {
    let i = 0;
    const len = source.length;
    const root = { tag: null, attrs: {}, children: [], text: '' };
    const stack = [root];

    const fail = (msg) => {
        const line = source.slice(0, i).split('\n').length;
        throw new Error(`XML parse error at line ${line}: ${msg}`);
    };

    while (i < len) {
        const lt = source.indexOf('<', i);
        if (lt < 0) {
            stack[stack.length - 1].text += decodeXmlText(source.slice(i));
            break;
        }
        if (lt > i) stack[stack.length - 1].text += decodeXmlText(source.slice(i, lt));
        i = lt + 1;

        if (source[i] === '/') {
            i += 1;
            const gt = source.indexOf('>', i);
            if (gt < 0) fail('unterminated closing tag');
            const name = source.slice(i, gt).trim();
            const open = stack.pop();
            if (!open || open.tag !== name) {
                fail(`closing tag </${name}> does not match <${open?.tag ?? 'document'}>`);
            }
            i = gt + 1;
            continue;
        }

        // Opening (or self-closing) tag: read the name, then attributes, so a
        // '>' inside a quoted value cannot end the tag early.
        let j = i;
        while (j < len && !isSpace(source[j]) && source[j] !== '>' && source[j] !== '/') j += 1;
        const tag = source.slice(i, j);
        if (!tag) fail('empty tag name');
        const node = { tag, attrs: {}, children: [], text: '' };
        i = j;

        for (;;) {
            while (i < len && isSpace(source[i])) i += 1;
            if (i >= len) fail(`unterminated tag <${tag}>`);
            if (source[i] === '/' && source[i + 1] === '>') { i += 2; node.selfClosed = true; break; }
            if (source[i] === '>') { i += 1; break; }

            let k = i;
            while (k < len && !isSpace(source[k]) && source[k] !== '=' && source[k] !== '>' && source[k] !== '/') k += 1;
            const attrName = source.slice(i, k);
            if (!attrName) fail(`malformed attribute in <${tag}>`);
            i = k;
            while (i < len && isSpace(source[i])) i += 1;
            if (source[i] !== '=') fail(`attribute ${attrName} in <${tag}> has no value`);
            i += 1;
            while (i < len && isSpace(source[i])) i += 1;
            const quote = source[i];
            if (quote !== '"' && quote !== "'") fail(`attribute ${attrName} in <${tag}> is not quoted`);
            i += 1;
            const close = source.indexOf(quote, i);
            if (close < 0) fail(`unterminated value for ${attrName} in <${tag}>`);
            node.attrs[attrName] = decodeXmlText(source.slice(i, close));
            i = close + 1;
        }

        stack[stack.length - 1].children.push(node);
        if (!node.selfClosed) stack.push(node);
    }

    if (stack.length !== 1) fail(`unclosed element <${stack[stack.length - 1].tag}>`);
    if (root.children.length !== 1) {
        throw new Error(`expected exactly one root element, got ${root.children.length}`);
    }
    return root.children[0];
}

// --- .oel level parsing ------------------------------------------------------

function requireInt(node, tag, where) {
    const child = node.children.find((c) => c.tag === tag);
    if (!child) throw new Error(`${where}: <level> has no <${tag}>`);
    const n = Number(child.text.trim());
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${where}: <${tag}> must be a positive integer, got "${child.text}"`);
    return n;
}

const intAttr = (node, name, where) => {
    const raw = node.attrs[name];
    const n = Number(raw);
    if (raw === undefined || !Number.isInteger(n)) {
        throw new Error(`${where}: <${node.tag}> attribute ${name}="${raw}" must be an integer`);
    }
    return n;
};

/**
 * Parse one `.oel` document into the map-source level record.
 *
 * Geometry is converted from Ogmo's pixels to TILES, the unit the atlas format
 * speaks: `width`/`height` and every tile placement's x/y. The tileset
 * coordinates `tx`/`ty` stay raw — they are the tile's identity, and giving
 * them meaning is Phase 5's job, not this extractor's.
 *
 * Entities keep their raw pixel `x`/`y`: they are not grid-aligned (the
 * `statue2` in OverWorld.oel sits at x=184), so rounding them here would lose
 * the placement the marking tool wants to show. Every other attribute is
 * carried through verbatim, as the string the XML held.
 *
 * @param {string} source .oel file text
 * @param {string} where  label used in error messages (usually the file path)
 */
export function parseOelLevel(source, where = '<oel>') {
    const level = parseXml(source);
    if (level.tag !== 'level') throw new Error(`${where}: root element is <${level.tag}>, expected <level>`);

    const widthPx = requireInt(level, 'width', where);
    const heightPx = requireInt(level, 'height', where);
    if (widthPx % TILE_SIZE !== 0 || heightPx % TILE_SIZE !== 0) {
        throw new Error(`${where}: level size ${widthPx}x${heightPx}px is not a multiple of ${TILE_SIZE}`);
    }

    const width = widthPx / TILE_SIZE;
    const height = heightPx / TILE_SIZE;
    const layers = [];
    let entities = [];
    let outside = 0;

    for (const child of level.children) {
        if (child.tag === 'width' || child.tag === 'height') continue;
        if (child.tag === 'objects') {
            entities = child.children.map((e) => {
                const { x, y, ...rest } = e.attrs;
                const entity = {
                    type: e.tag,
                    x: intAttr(e, 'x', where),
                    y: intAttr(e, 'y', where),
                };
                if (Object.keys(rest).length > 0) entity.attrs = rest;
                // ⚠ NESTED <node> CHILDREN ARE DATA, and dropping them lost a
                // collider. `Game.as:2201-2210` reads `o.node` to size a
                // RopeStart: `setHitbox(_xend - _x + 16, 16, 8, 8)` where
                // `_xend` is the last node's x. Three ropes in the game carry
                // one each; without them a rope is a 16x16 stub instead of a
                // horizontal span, which is a wall the model does not know
                // about. Recorded generically rather than for `rope` alone —
                // an Ogmo node list is a shape, not a special case.
                const nodes = e.children.filter((c) => c.tag === 'node');
                if (nodes.length > 0) {
                    entity.nodes = nodes.map((n) => ({
                        x: intAttr(n, 'x', where), y: intAttr(n, 'y', where),
                    }));
                }
                return entity;
            });
            continue;
        }
        // Any other element with <tile> children is a tile layer. Seedling has
        // two ("tiles" and "cliffsides"); reading them generically means a
        // level with a third does not silently lose it.
        const tiles = child.children.filter((c) => c.tag === 'tile');
        if (tiles.length === 0 && child.children.length > 0) {
            throw new Error(`${where}: unrecognised layer <${child.tag}> (no <tile> children)`);
        }
        const placed = [];
        for (const t of tiles) {
            const px = intAttr(t, 'x', where);
            const py = intAttr(t, 'y', where);
            if (px % TILE_SIZE !== 0 || py % TILE_SIZE !== 0) {
                throw new Error(`${where}: tile at ${px},${py} is off the ${TILE_SIZE}px grid`);
            }
            const x = px / TILE_SIZE;
            const y = py / TILE_SIZE;
            // Ogmo lets the author paint past the level rectangle, and 51 of
            // Seedling's levels do (506 placements, up to 40 tiles beyond the
            // right edge). The game never draws them: loadlevel guards each
            // placement with `if (floor(o.@x / Tile.w) < tiles.length && …)`
            // (Game.as). Dropping them here matches what the player sees;
            // keeping them would give the marking tool a canvas full of
            // phantom terrain outside every region anyone could mark.
            if (x >= width || y >= height) { outside += 1; continue; }
            placed.push([x, y, intAttr(t, 'tx', where), intAttr(t, 'ty', where)]);
        }
        layers.push({
            name: child.tag,
            set: child.attrs.set ?? null,
            // [x, y, tx, ty] — x/y in tiles, tx/ty raw tileset coordinates.
            tiles: placed,
        });
    }

    const level_doc = { width, height, layers, entities };
    // Recorded, never silent: a re-extract that started dropping a different
    // number of tiles is something a reviewer should see in the diff.
    if (outside > 0) level_doc.tiles_outside_level = outside;
    return level_doc;
}

// --- Game.as level table -----------------------------------------------------
