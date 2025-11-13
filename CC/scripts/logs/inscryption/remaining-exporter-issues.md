# Remaining Exporter Issues for Inscryption

This file tracks unresolved issues with the Inscryption exporter.

## Status
No exporter issues identified. All tests passing.

The exporter at `exporter/games/inscryption.py` is working correctly and properly handles:
- Helper function conversions (self.method → helper nodes)
- Attribute references (self.world.required_epitaph_pieces_name → "Epitaph Piece")
