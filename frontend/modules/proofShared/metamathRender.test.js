/**
 * Tests for the Metamath ASCII -> Unicode expression renderer.
 */

import { describe, it, expect } from 'vitest';
import { renderMetamathExpression } from './metamathRender.js';

describe('renderMetamathExpression', () => {
  it('renders core logic/arithmetic tokens', () => {
    expect(renderMetamathExpression('|- ( 2 + 2 ) = 4')).toBe('⊢ ( 2 + 2 ) = 4');
  });

  it('renders quantifiers, membership and set constants', () => {
    expect(renderMetamathExpression('|- A. x e. CC ph')).toBe('⊢ ∀ 𝑥 ∈ ℂ 𝜑');
  });

  it('leaves unmapped (identity) tokens like class constants unchanged', () => {
    // Vtx / ConnGraph have no special symbol; only the mapped tokens change.
    expect(renderMetamathExpression('|- G e. ConnGraph')).toBe('⊢ 𝐺 ∈ ConnGraph');
  });

  it('passes unknown tokens through verbatim', () => {
    expect(renderMetamathExpression('totallyUnknownToken')).toBe('totallyUnknownToken');
  });

  it('is a no-op on empty / non-string input', () => {
    expect(renderMetamathExpression('')).toBe('');
    expect(renderMetamathExpression(null)).toBeNull();
    expect(renderMetamathExpression(undefined)).toBeUndefined();
  });
});
