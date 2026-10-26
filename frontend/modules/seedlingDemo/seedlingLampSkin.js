/**
 * seedlingDemo/seedlingLampSkin — **THE TORCHES, ORBS AND LIGHT POLES' BODIES**
 * (Seedling JS graphics G8). G5 draws their LIGHTS (`seedlingNightSkin.js`); this
 * draws the pictures the lights shine from. Stateless: each body is a function
 * of the render clock, the room's `.oel` record and one getter.
 *
 *   · `lampSkinView(run, { record })` — THE ONE ADAPTER. It copies; it writes nothing.
 *   · `lampOps(view, art)` — PURE. The draw ops, Y-sorted with the room.
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src/Scenery`) ──────────
 *
 *   · TORCH (`Torch.as`) — a 4 × 10 Spritemap centred on its cell,
 *     `Game.worldFrame(frameCount)` at the render; `layer = -(y − originY +
 *     height + 8)`, set after `centerOO` (originY 5).
 *   · ORB (`Orb.as`) — an 8 × 8 Spritemap tinted its colour, floating about its
 *     `.oel` point (NOT centred: `super(_x, _y)`) by `Game.worldFrame(100, 4)`
 *     and its cosmetic `randVal` — the SAME float its Light rides
 *     (`seedlingNightSkin.orbFloat`, one spelling); frame `worldFrame(5, 4)`;
 *     `layer = -(y + 8 + 8)` from its start, before `centerOO`.
 *   · LIGHT POLE (`LightPole.as`) — a 16 × 16 Image centred on its cell, its
 *     `y` bobbing at the render (`startY − originY + 2·sin`: `seedlingNightSkin.
 *     poleAt`); `layer = -(startY − 8 + 16)`. While `activate` and its hit timer
 *     is out it is drawn again onto nightBmp (`NIGHT_COPIES`; `lightPolesNow`
 *     gives lit = `activate` XOR `invert`, and the record the `invert`).
 *
 * Shadows and light rays have no body: G5 draws them whole.
 */
import { rectOp, spriteOp, worldFrame } from './seedlingEnemySkin.js';
import { as3Colour, orbFloat, poleAt } from './seedlingNightSkin.js';

export const KEYS = Object.freeze({
    torch: 'seedling:scenery/torch',
    orb: 'seedling:scenery/orb',
    lightPole: 'seedling:scenery/lightpole',
});
/** `Torch.png` 12 × 10 → 3 frames; `Orb.png` 40 × 8 → 5. */
const TORCH_FRAMES = 3;
const ORB_FRAMES = 5;
/** `Orb.as:23` `loops`. */
const ORB_LOOPS = 4;
const LAMP_COLOUR = '#f0d060';

/** WHAT G8 DRAWS, by AS3 class. */
export const LAMP_COVERAGE = Object.freeze({ drawn: Object.freeze(['Torch', 'Orb', 'LightPole']) });

/** `Orb.as:33,37` `sprOrb.color = _c` (G5's parse of the `.oel` `c`); white tints nothing. */
const colourOf = (c) => {
    const hex = as3Colour(c);
    return hex === '#ffffff' ? null : hex;
};

/** THE ADAPTER (null when there is no run). `record` is the room's level record (`{entities}`). */
export function lampSkinView(run, { record = null } = {}) {
    if (!run?.state) return null;
    const poles = 'lightPolesNow' in run ? (run.lightPolesNow ?? null) : null;
    const lit = poles ? new Map(poles.map((p) => [p.id, p])) : null;
    const ents = record?.entities ?? [];
    return {
        level: run.level,
        gameTime: run.gameTime ?? null,
        torches: ents.filter((e) => e.type === 'torch').map((e) => ({ x: Number(e.x) + 8, y: Number(e.y) + 8 })),
        orbs: ents.filter((e) => e.type === 'orb').map((e) => ({ sx: Number(e.x), sy: Number(e.y), tint: colourOf(e.attrs?.c) })),
        poles: ents.filter((e) => e.type === 'lightpole').map((e) => {
            const id = `lightpole@${e.x},${e.y}`;
            const p = lit?.get(id) ?? null;
            const invert = Number.parseInt(e.attrs?.invert ?? '0', 10) !== 0;
            // `activate` = lit XOR invert; the night copy wants `activate` and the hit timer out
            return { id, x: Number(e.x) + 8, startY: Number(e.y) + 8, night: !!p && (p.lit !== invert) && (p.hitsTimer ?? 0) <= 0 };
        }),
    };
}

const boxAround = (x, y, w, h) => ({ x: x - w / 2, y: y - h / 2, w, h, right: x + w / 2, bottom: y + h / 2 });

/** The rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const LAMP_RULES = Object.freeze({ worldFrame, orbFloat, poleAt });

/** THE DRAW OPS at the render clock; a body whose key the stack lacks is its rectangle. */
export function lampOps(view, art, { rules = LAMP_RULES } = {}) {
    if (!view || !art) return [];
    const R = rules === LAMP_RULES ? rules : { ...LAMP_RULES, ...rules };
    const ops = [];
    const time = view.gameTime ?? 0;
    const push = (key, frame, at, box, extra) => {
        const fallback = rectOp(box, LAMP_COLOUR, 0.85, extra.layer);
        ops.push(art.has(key) ? spriteOp(art, key, frame, at, { ...extra, fallback }) : fallback);
    };
    for (const t of view.torches) push(KEYS.torch, R.worldFrame(time, TORCH_FRAMES), t, boxAround(t.x, t.y, 4, 10), { layer: -(t.y - 5 + 10 + 8) });
    for (const o of view.orbs) {
        const at = R.orbFloat(o, time, view.level);
        push(KEYS.orb, R.worldFrame(time, ORB_FRAMES, ORB_LOOPS), at, boxAround(at.x, at.y, 8, 8), { tint: o.tint, layer: -(o.sy + 8 + 8) });
    }
    for (const p of view.poles) {
        const at = R.poleAt(p, view.gameTime);
        push(KEYS.lightPole, 0, at, boxAround(at.x, at.y, 16, 16), { layer: -(p.startY - 8 + 16) });
        if (p.night && ops.at(-1)?.sheetRef) ops[ops.length - 1] = { ...ops.at(-1), nightCopy: true };
    }
    return ops.filter(Boolean);
}
