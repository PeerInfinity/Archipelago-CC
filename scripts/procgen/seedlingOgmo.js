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

// ⛓ Kept for the callers that read the level format's grid size off this
// module (`extract-seedling-map.mjs`, this file's own tests). The moved reader
// takes it from `levelWorld.TILE_SIZE` instead, which is the same 16 and one
// fewer place for it to be spelled.
const TILE_SIZE = 16;

// --- the OEL reader MOVED to frontend/modules/seedlingDemo/procgenLevelOel.js
//
// EDITOR v3 slice C1. The reader now sits beside the WRITER it is the inverse
// of, because the `edit` arm on watch.html needs it IN THE BROWSER and no
// module under frontend/ may import anything under scripts/ (measured: the
// direction is scripts -> frontend, every time). Re-exported here so every
// existing caller — extract-seedling-map.mjs, exportSeedlingView.js, this
// file's own tests — is unchanged, and so the repo still has exactly ONE OEL
// reader.
//
// parseLevelTable below did NOT move: it reads a Game.as [Embed] table, which
// is a fact about a SOURCE TREE rather than about the level format, and nothing
// on a page can use it.

export {
    decodeXmlText, parseXml, parseOelLevel,
} from '../../frontend/modules/seedlingDemo/procgenLevelOel.js';

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
