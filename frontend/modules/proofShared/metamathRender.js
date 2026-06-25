/**
 * Render Metamath ASCII expressions as Unicode for readability.
 *
 * Metamath statements are stored as space-separated ASCII tokens (e.g.
 * `|- ( 2 + 2 ) = 4`, `|- A. x e. CC ph`). The official site renders these with
 * proper math symbols; this does the same in the proof panels using the
 * token -> symbol map extracted from set.mm's own `$t` typesetting block (see
 * scripts/data/extract_metamath_symbols.py).
 *
 * Display-only: callers should keep the raw ASCII for any matching/logic and
 * render at the point of display.
 */

import { METAMATH_SYMBOLS } from './metamathSymbols.js';

/**
 * Convert a Metamath ASCII expression to its Unicode rendering.
 * Tokens with no symbol mapping (numbers, class constants like `Vtx`, parens)
 * pass through unchanged.
 *
 * @param {string} expression - space-separated Metamath tokens
 * @returns {string} the same expression with known tokens replaced by symbols
 */
export function renderMetamathExpression(expression) {
  if (!expression || typeof expression !== 'string') return expression;
  return expression
    .split(/\s+/)
    .map((token) => METAMATH_SYMBOLS[token] ?? token)
    .join(' ');
}
