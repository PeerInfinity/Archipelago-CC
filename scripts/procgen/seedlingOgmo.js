// Seedling map extraction — pure parsers for the game's Ogmo level files and
// its level table (CC/docs/plans/region-atlas-plan.md, Phase 2, Deliverable 1).
//
// Two inputs, both from a Seedling source checkout (MIT; the extract is
// redistributable, unlike RWK's — plan decision 7's gitignore constraint is
// RWK-only):
//
//   assets/levels/**/*.oel   Ogmo XML: <level><width><height> in PIXELS, a
//                            <tiles set="..."> layer of <tile tx ty x y/>
//                            placements (tx/ty index the tileset image, x/y are
//                            pixel positions on a 16px grid), an optional
//                            <cliffsides> tile layer, and an <objects> entity
//                            layer.
//   src/Game.as              the [Embed(source = '../assets/levels/…')] table
//                            whose /*N */ comments are the game's level
//                            numbers, followed by `public static const levels`
//                            listing the same classes in index order.
//
// Those level numbers are the SAME `level` values flashPanel/games/seedling.json
// uses in teleport / region_coords / location_coords, and the same `to="N"` a
// teleporter or stairs entity carries. Verified against the shipped config
// before this was written: region_coords["Owl's Nest"] = {level 2, x 48, y 32}
// is exactly OverWorld.oel's `<stairsdown to="2" playerx="48" playery="32"/>`,
// region_coords["Gundernourd"] = {level 19, x 16, y 144} is Dungeon2/5.oel's
// `<teleporter to="19" playerx="16" playery="144"/>`, and location_coords for
// Sword / Shield / Wand land on the `<sword>` / `<shield>` / `<wand>` entities
// in levels[10] / levels[20] / levels[43]. parseLevelTable re-checks the
// comment indices against the array order on every run so a source edit that
// broke the correspondence fails loudly instead of silently renumbering.
//
// Deliberately NOT here: any semantic reading of the tiles (walkable/solid).
// Tile categories are Phase 5's job; the extract keeps raw tileset identity so
// the marking tool renders what the game draws and nothing is invented.

const TILE_SIZE = 16;

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

const EMBED_RE = /\/\*\s*(\d+)\s*\*\/\s*\[Embed\(\s*source\s*=\s*'([^']*)'/g;

/**
 * Read the level table out of `src/Game.as`.
 *
 * Two independent statements have to agree, and this checks that they do:
 *   - the `/*N *​/ [Embed(source='../assets/levels/…')] public static var Cls`
 *     declarations, whose comment carries the intended level number, and
 *   - `public static const levels:Array = new Array(Cls, Cls, …)`, whose
 *     ORDER is what the game actually indexes (`loadlevel(levels[level])`).
 *
 * A mismatch means the source drifted and every `level:` number in
 * flashPanel/games/seedling.json would be pointing at the wrong room — so it
 * throws rather than picking a winner.
 *
 * @returns {Array<{ level:number, class:string, path:string }>} index-ordered
 */
export function parseLevelTable(source) {
    // Embeds, keyed by the AS3 class they declare. Only level assets carry the
    // /*N */ index comment; the (far more numerous) graphics embeds do not.
    const byClass = new Map();
    for (const m of source.matchAll(EMBED_RE)) {
        const [, index, path] = m;
        if (!path.includes('/levels/')) continue;
        const rest = source.slice(m.index + m[0].length);
        const decl = /public\s+static\s+var\s+([A-Za-z0-9_$]+)\s*:/.exec(rest);
        if (!decl) throw new Error(`Game.as: embed /*${index}*/ ${path} has no "public static var <Class>:" declaration`);
        const className = decl[1];
        if (byClass.has(className)) throw new Error(`Game.as: duplicate level embed class ${className}`);
        byClass.set(className, { commentIndex: Number(index), path: path.replace(/^\.\.\//, '') });
    }
    if (byClass.size === 0) throw new Error('Game.as: no level embeds found');

    const arrayMatch = /public\s+static\s+const\s+levels\s*:\s*Array\s*=\s*new\s+Array\s*\(([\s\S]*?)\)\s*;/.exec(source);
    if (!arrayMatch) throw new Error('Game.as: could not find "public static const levels:Array = new Array(...)"');
    const order = arrayMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const table = order.map((className, level) => {
        const embed = byClass.get(className);
        if (!embed) throw new Error(`Game.as: levels[${level}] names ${className}, which has no level embed`);
        if (embed.commentIndex !== level) {
            throw new Error(
                `Game.as: ${className} is levels[${level}] but its embed comment says /*${embed.commentIndex}*/ — `
                + 'the level numbers in flashPanel/games/seedling.json index the ARRAY, so this drift must be fixed at the source',
            );
        }
        return { level, class: className, path: embed.path };
    });

    const unused = [...byClass.keys()].filter((c) => !order.includes(c));
    if (unused.length > 0) {
        throw new Error(`Game.as: level embeds absent from the levels array: ${unused.join(', ')}`);
    }
    return table;
}

export { TILE_SIZE };
