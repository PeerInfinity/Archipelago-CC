/**
 * A STAND-IN Cloudberry generator for unit tests (no game page): a `ck-level/2`-shaped
 * document made from the request alone. Each piece's items are the platform upgrades
 * at the "new item" level (5) — what the planner asks for — each piece has
 * `coinsPerPiece` witnessed coins, and the level has a start door. Nothing about it
 * is the real generator's output; it only lets the pipeline's own code run headless.
 *
 *   installCloudberryGenerator(cloudberryTestGenerator(), { store: null })
 */

import { cloudberryHeroPhsxText } from './cloudberryZonePlan.js';

const PLATFORM = ['MovingBlock', 'FallingBlock', 'BouncyBlock', 'GhostBlock', 'Cloud', 'Elevator', 'Pendulum', 'Conveyor', 'FlyBlob'];

/** The stand-in document for a request (args may carry reroll: true; it is dropped). */
export function cloudberryTestDocument(args, { coinsPerPiece = 3 } = {}) {
    const { reroll, ...request } = args;
    const pieces = Array.isArray(args.pieces) ? args.pieces : [{ upgrades: {} }];
    let id = 100;
    const coins = [];
    const seedPieces = pieces.map((p, k) => {
        const items = Object.entries(p.upgrades ?? {}).filter(([u, v]) => PLATFORM.includes(u) && v >= 5).map(([u]) => u);
        for (let i = 0; i < coinsPerPiece; i++) coins.push({ id: id++, piece: k, witness: { replayOfPiece: k, tick: 10 * i + 5 } });
        return { kind: 'piece', piece: k, items };
    });
    return {
        format: 'ck-level/2',
        args: { request: { ...request, rerolls: pieces.map(() => 0) } },
        engine: { build: 'test', generator: 'test' },
        level: {
            // As the game writes it: custom hero physics only for a heroCustom request (P5b).
            ...(args.heroCustom ? { heroPhsx: cloudberryHeroPhsxText(args.heroCustom), heroPhsxClamped: [] } : {}),
            heroAbility: {
                JetPack: args.heroCustom?.move === 'Jetpack',
                NumJumps: args.heroCustom?.move === 'Double' ? (args.heroCustom.phsx?.numjumps ?? 2) : 1,
            },
        },
        goal: { startDoor: [0, 0], door: [1000, 0] },
        seedPieces,
        coins: { count: coins.length, list: coins },
    };
}

/**
 * A generator over `cloudberryTestDocument`; `docSha256` = 64 hex digits from the request.
 * `opts.features` = what the stand-in page offers (default: everything, `{ doubleJump: true }`).
 */
export function cloudberryTestGenerator(opts = {}) {
    const features = opts.features ?? { doubleJump: true };
    return {
        build: 'test',
        async features() { return { ...features }; },
        async generate(args) {
            const text = JSON.stringify(cloudberryTestDocument(args, opts));
            let h = 0;
            for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
            return { text, docSha256: (h >>> 0).toString(16).padStart(8, '0').repeat(8) };
        },
    };
}
