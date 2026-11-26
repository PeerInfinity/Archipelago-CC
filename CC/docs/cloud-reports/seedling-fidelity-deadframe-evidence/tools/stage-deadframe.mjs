// wave 66 (DEADFRAME) D1: the owed witnesses, staged as waves 64/65 stage (the vanilla L38 stripped to its teleporters
// and `lightalpha`, the shape's entities added; level data through `botLoadLevels`, its own `set_id`). Re-uses wave 64's
// `shapeTape`, `stagedRecord` and `replay`. L = `lock` tag 20: `persistence_cleared` ∋ (38,20) is its type ("" = open).
// A FallRock writes (38,22) false on `fall()` (`Scenery/FallRock.as:108`), so the page's ledger shows the frame it falls.
//   d-key        the dead frames of a TEXT-LESS pickup lump: the player boots on a ButtonRoom latch (L's group 5, L
//                fades from the boot: open at 102) and walks right onto a `bosskey keyType 1` (no text: phase A only,
//                150 dead frames) while L is fading. The game's L keeps fading through the dead frames.
//   d-health     the same with a TEXTED pickup (`health`: phase A, then the dialogue's frozen ticks).
//   d-span       the dead frames of a BUTTON-DROPPED rock's span (`dropRocksTogether`): the same latch and L, and the
//                player walks onto `button@64,48` (group 7), whose `fallrock@192,48` (group 7, tag 22) falls.
//   w-fly-rest   a WallFlyer launched down the col-9 corridor by the player comes to REST on `button@144,208` (group 6),
//                against the shut stopper `lock@144,224` (group 9); L (`lock@112,48`, group 6) is its group's Lock.
//                `Button.hitables` holds "Enemy": does the resting flyer press it (L opens ~102 frames on)?
//   e-fly-rock   the same flyer resting on `button@144,208` of group 7, whose `fallrock@64,272` (tag 22) is the
//                FallRock: does an enemy on a FallRock's Button drop the rock, and on which frame?
//   e-spin-rock  a Spinner bouncing in the col-9 corridor between `lock@144,128` and the shut `cover@144,224` (group 9)
//                crosses `button@144,176` (group 7) with `fallrock@64,272` (tag 22); the player is pinned below.
const S = await import(new URL('../../seedling-fidelity-readerorder-evidence/tools/stage.mjs', import.meta.url).pathname);
export const { LEVEL, L_TAG, stagedRecord, shapeTape, replay } = S;
export const ROCK_TAG = 22;
const lock = (x, y, t, tag) => ({ type: 'lock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const latch = (x, y, t, tag) => ({ type: 'buttonroom', x, y, attrs: { tset: String(t), tag: String(tag), flip: '0', room: '-1' } });
const button = (x, y, t) => ({ type: 'button', x, y, attrs: { tset: String(t) } });
const cover = (x, y, t) => ({ type: 'cover', x, y, attrs: { tset: String(t) } });
const rock = (x, y, t, tag) => ({ type: 'fallrock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const spinner = (x, y) => ({ type: 'spinner', x, y, attrs: { tag: '-1' } });
export const RESP_ID = (s) => `${s.base.resp.tag}@${s.base.resp.x},${s.base.resp.y}`;
const LATCH = [latch(32, 48, 5, 21), lock(112, 48, 5, L_TAG)];
const KEY = { resp: { tag: 'lock', x: 112, y: 48 }, boot: { x: 32, y: 48 }, entities: [...LATCH, { type: 'bosskey', x: 64, y: 48, attrs: { keyType: '1' } }] };
const HEALTH = { resp: { tag: 'lock', x: 112, y: 48 }, boot: { x: 32, y: 48 }, entities: [...LATCH, { type: 'health', x: 64, y: 48, attrs: { tag: '23' } }] };
const SPAN = { resp: { tag: 'lock', x: 112, y: 48 }, boot: { x: 32, y: 48 }, entities: [...LATCH, button(64, 48, 7), rock(192, 48, 7, ROCK_TAG)] };
const FLY = (t, extra) => ({ resp: { tag: 'lock', x: 112, y: 48 }, boot: { x: 144, y: 256 },
    entities: [lock(144, 128, 9, -1), { type: 'wallflyer', x: 144, y: 144 }, button(144, 208, t), lock(144, 224, 9, -1), ...extra] });
const SPINR = { resp: { tag: 'lock', x: 112, y: 48 }, boot: { x: 144, y: 240 },
    entities: [lock(144, 128, 9, -1), spinner(144, 160), button(144, 176, 7), cover(144, 224, 9), rock(64, 272, 7, ROCK_TAG)] };
export const SHAPES = [
    { name: 'd-key', base: KEY, defaults: { walk: 22, stand: 200 }, steps: (p) => [[['right'], p.walk], [[], p.stand]] },
    { name: 'd-health', base: HEALTH, defaults: { walk: 30, stand: 260 }, steps: (p) => [[['right'], p.walk], [[], p.stand]] },
    { name: 'd-span', base: SPAN, defaults: { walk: 22, stand: 200 }, steps: (p) => [[['right'], p.walk], [[], p.stand]] },
    { name: 'w-fly-rest', base: FLY(6, [lock(112, 48, 6, L_TAG)]), defaults: { stand: 220 }, steps: (p) => [[[], p.stand]] },
    { name: 'e-fly-rock', base: FLY(7, [rock(64, 272, 7, ROCK_TAG)]), defaults: { stand: 260 }, steps: (p) => [[[], p.stand]] },
    { name: 'e-spin-rock', base: SPINR, defaults: { stand: 300 }, steps: (p) => [[['up'], p.stand]] },
    // THE EDGES: the player waits on the latch, so the contact (the rock's frame A) lands at advance #T around L's
    // opening frame (102 from the boot): does the contact frame's own responder update run before the freeze, and is
    // the first dead frame's the next one? (d-key contacts at advance #wait+24, d-health at #wait+26, d-span's frame A
    // at #wait+24.)
    ...[100, 101, 102, 103].flatMap((T) => [
        { name: `d-key-at${T}`, base: KEY, defaults: { wait: T - 24, walk: 22, stand: 60 }, steps: (p) => [[[], p.wait], [['right'], p.walk], [[], p.stand]] },
        { name: `d-health-at${T}`, base: HEALTH, defaults: { wait: T - 26, walk: 30, stand: 120 }, steps: (p) => [[[], p.wait], [['right'], p.walk], [[], p.stand]] },
        { name: `d-span-at${T}`, base: SPAN, defaults: { wait: T - 24, walk: 22, stand: 60 }, steps: (p) => [[[], p.wait], [['right'], p.walk], [[], p.stand]] },
    ]),
];
export const shape = (name) => SHAPES.find((s) => s.name === name) ?? (() => { throw new Error(`no shape ${name}`); })();
