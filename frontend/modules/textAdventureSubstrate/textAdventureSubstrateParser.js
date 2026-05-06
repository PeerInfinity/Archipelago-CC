/**
 * Text Adventure substrate command parser.
 *
 * Port of frontend/modules/textAdventure/textAdventureParser.js with two
 * substrate-specific changes:
 *
 *   1. Compass shorthand. The substrate panel renders exits in a 3×3
 *      grid (N/E/S/W cardinals + center cell C for null-side exits)
 *      in procgen mode. The parser recognises:
 *        - n, e, s, w, c                  → first exit in that cell
 *        - n1, n2, e3, w2, c1, ...        → 1-based index within cell
 *        - m, m1, m2, ...                 → flat exit index across all
 *                                            cells (N→E→S→W→C order).
 *                                            The only exit shorthand
 *                                            usable in standalone mode,
 *                                            where there are no cells.
 *        - l                              → first location
 *        - l1, l2, l3, ...                → 1-based location index
 *        - x                              → explore action (Phase 6h).
 *                                            Queues in loop mode,
 *                                            fires immediately
 *                                            otherwise. No digit
 *                                            suffix — explore picks
 *                                            randomly.
 *      "look" (the full word) stays as the look verb; the single
 *      letter "l" is reassigned to mean "first location".
 *
 *   2. parseCommand now takes a context object with the per-cell
 *      enumeration the panel built for rendering. Caller passes the
 *      same lists it used to label the cells, so shorthand resolution
 *      matches the visible labels exactly.
 *
 * Match qualities (exact / partial), verb vocabulary (move/go/travel/to,
 * check/examine/search, look, inventory/inv/items, help/?), and the
 * ambiguous-bare-name handling are unchanged from the original parser.
 */

const SHORTHAND_RE = /^([neswcml])(\d*)$/;
const EXPLORE_RE = /^x$/;

export class TextAdventureSubstrateParser {
    constructor() {
        this.moveVerbs = ['move', 'go', 'travel', 'to'];
        this.checkVerbs = ['check', 'examine', 'search'];
        this.lookVerbs = ['look']; // 'l' reassigned to location-1 shortcut
        this.inventoryVerbs = ['inventory', 'inv', 'items'];
        this.helpVerbs = ['help', '?'];
    }

    /**
     * Parse user input into a command.
     *
     * @param {string} input - Raw user input
     * @param {object} context - Per-region enumeration matching the
     *   panel's render order:
     *     {
     *       exitsBySide: { N: [exit,...], E, S, W, C },
     *       locations:   [{ locationName, ... }, ...]
     *     }
     *   Each `exit` must carry exitName (or exit_id) for the move
     *   command's `target`. Each location must carry `locationName`.
     * @returns {object} Command object — see _emit* helpers below for
     *   shapes. Always returns; never throws.
     */
    parseCommand(input, context = {}) {
        if (!input || typeof input !== 'string') {
            return { type: 'error', message: 'Please enter a command.' };
        }
        const trimmed = input.trim().toLowerCase();
        if (!trimmed) {
            return { type: 'error', message: 'Please enter a command.' };
        }

        // Shorthand layer runs first. Single-letter or letter+digits
        // patterns short-circuit straight to a move/check command if
        // they resolve against the context.
        const shortHandResult = this._parseShorthand(trimmed, context);
        if (shortHandResult) return shortHandResult;

        if (this.helpVerbs.includes(trimmed)) return { type: 'help' };
        if (this.inventoryVerbs.includes(trimmed)) return { type: 'inventory' };
        if (this.lookVerbs.includes(trimmed)) return { type: 'look' };

        const { verb, target } = this._extractVerbAndTarget(trimmed);
        if (!target) {
            return { type: 'error', message: 'Unrecognized command. Type "help" for available commands.' };
        }

        const availableLocations = (context.locations ?? []).map((l) => l.locationName).filter(Boolean);
        const availableExits = this._allExitNames(context.exitsBySide);

        const matchingLocations = this._findMatches(target, availableLocations);
        const matchingExits = this._findMatches(target, availableExits);

        if (verb) {
            if (this.moveVerbs.includes(verb)) {
                return this._handleMoveCommand(target, matchingExits);
            }
            if (this.checkVerbs.includes(verb)) {
                return this._handleCheckCommand(target, matchingLocations);
            }
            if (this.lookVerbs.includes(verb)) {
                // "look <name>" treated as "check <name>" — same as old parser.
                return this._handleCheckCommand(target, matchingLocations);
            }
            return { type: 'error', message: 'Unrecognized command. Type "help" for available commands.' };
        }

        return this._handleAmbiguousCommand(target, matchingLocations, matchingExits);
    }

    /**
     * Resolve compass / location shorthand against the panel's
     * current per-cell enumeration. Returns a command object on a
     * match; returns null if the input isn't a shorthand pattern at
     * all (let the verb parser try). Returns an error command if it
     * IS a shorthand pattern but the index is out of range.
     */
    _parseShorthand(trimmed, context) {
        // Phase 6h: `x` (no digit) is the explore command. Match this
        // before the SHORTHAND_RE pass so it doesn't get reinterpreted
        // as a missing-letter shorthand.
        if (EXPLORE_RE.test(trimmed)) {
            return { type: 'explore' };
        }

        const m = SHORTHAND_RE.exec(trimmed);
        if (!m) return null;

        const letter = m[1];
        const digits = m[2];
        const index = digits === '' ? 1 : Number.parseInt(digits, 10);

        if (letter === 'l') {
            const locations = context.locations ?? [];
            const entry = locations[index - 1];
            if (!entry) {
                return { type: 'error', message: `No location ${trimmed} in this region.` };
            }
            return {
                type: 'check',
                target: entry.locationName,
                matchQuality: 'shorthand',
            };
        }

        if (letter === 'm') {
            // Phase 6h: flat-exit-index shorthand (renamed from `x`,
            // which is now the explore command). In standalone mode
            // the panel files every exit into one bucket (any cell
            // works since the renderer doesn't care); in procgen mode
            // the user can still use m1/m2/... if they don't want to
            // think about compass cells.
            const flat = this._allExits(context.exitsBySide);
            const exit = flat[index - 1];
            if (!exit) {
                return { type: 'error', message: `No exit ${trimmed} in this region.` };
            }
            return {
                type: 'move',
                target: exit.exitName ?? exit.exit_id,
                matchQuality: 'shorthand',
            };
        }

        const cellId = letter.toUpperCase();
        const exits = context.exitsBySide?.[cellId] ?? [];
        const exit = exits[index - 1];
        if (!exit) {
            return { type: 'error', message: `No exit ${trimmed} in this region.` };
        }
        return {
            type: 'move',
            target: exit.exitName ?? exit.exit_id,
            matchQuality: 'shorthand',
        };
    }

    _allExits(exitsBySide) {
        if (!exitsBySide) return [];
        const out = [];
        for (const cellId of ['N', 'E', 'S', 'W', 'C']) {
            const list = exitsBySide[cellId];
            if (list) for (const e of list) out.push(e);
        }
        return out;
    }

    _allExitNames(exitsBySide) {
        if (!exitsBySide) return [];
        const out = [];
        for (const cellId of ['N', 'E', 'S', 'W', 'C']) {
            const list = exitsBySide[cellId];
            if (!list) continue;
            for (const exit of list) {
                const name = exit.exitName ?? exit.exit_id;
                if (name) out.push(name);
            }
        }
        return out;
    }

    _extractVerbAndTarget(input) {
        const words = input.split(/\s+/);
        if (words.length === 1) return { verb: null, target: words[0] };

        const firstWord = words[0];
        const allVerbs = [...this.moveVerbs, ...this.checkVerbs, ...this.lookVerbs];
        if (allVerbs.includes(firstWord)) {
            return { verb: firstWord, target: words.slice(1).join(' ') };
        }
        return { verb: null, target: input };
    }

    _findMatches(target, items) {
        if (!Array.isArray(items)) return [];
        const matches = [];
        const targetLower = target.toLowerCase();
        for (const item of items) {
            const itemLower = item.toLowerCase();
            if (itemLower === targetLower) {
                matches.push({ name: item, quality: 'exact' });
            } else if (itemLower.includes(targetLower)) {
                matches.push({ name: item, quality: 'partial' });
            }
        }
        matches.sort((a, b) => {
            if (a.quality === 'exact' && b.quality !== 'exact') return -1;
            if (b.quality === 'exact' && a.quality !== 'exact') return 1;
            return 0;
        });
        return matches;
    }

    _handleMoveCommand(target, matchingExits) {
        if (matchingExits.length === 0) {
            return { type: 'error', message: `Unrecognized exit: ${target}` };
        }
        const best = matchingExits[0];
        return { type: 'move', target: best.name, matchQuality: best.quality };
    }

    _handleCheckCommand(target, matchingLocations) {
        if (matchingLocations.length === 0) {
            return { type: 'error', message: `Unrecognized location: ${target}` };
        }
        const best = matchingLocations[0];
        return { type: 'check', target: best.name, matchQuality: best.quality };
    }

    _handleAmbiguousCommand(target, matchingLocations, matchingExits) {
        const hasLoc = matchingLocations.length > 0;
        const hasExit = matchingExits.length > 0;

        if (!hasLoc && !hasExit) {
            return { type: 'error', message: `Unrecognized location or exit: ${target}` };
        }

        if (hasLoc && hasExit) {
            const exactLoc = matchingLocations.find((l) => l.quality === 'exact');
            const exactExit = matchingExits.find((e) => e.quality === 'exact');
            if (exactLoc && exactExit) {
                return {
                    type: 'error',
                    message: `Ambiguous name '${target}'. Did you mean to move to ${target} or check location ${target}?`,
                };
            }
        }

        if (hasLoc) {
            const best = matchingLocations[0];
            return { type: 'check', target: best.name, matchQuality: best.quality, wasAmbiguous: hasExit };
        }
        const best = matchingExits[0];
        return { type: 'move', target: best.name, matchQuality: best.quality, wasAmbiguous: false };
    }

    getHelpText() {
        return [
            'Available commands:',
            '• move <exit>, go <exit> — move through an exit',
            '• check <location>, examine <location>, search <location> — check a location',
            '• look — re-render the current region',
            '• inventory, inv — show your inventory',
            '• help, ? — show this help text',
            '',
            'Shorthand:',
            '• n, e, s, w — first exit in that compass direction (procgen)',
            '• n1, n2, e3, ... — Nth exit in that direction',
            '• c, c1, c2, ... — exit in the center cell (teleporters / unsided)',
            '• m, m1, m2, ... — Nth exit (flat index; works in both modes)',
            '• l, l1, l2, ... — Nth unchecked location',
            '• x — explore (queue in loop mode, reveal one ??? otherwise)',
            '',
            'You can also type the bare name of a location or exit.',
        ].join('\n');
    }
}
