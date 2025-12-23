# Solved Super Metroid General Issues

This document tracks solved general issues with Super Metroid support.

## 2025-12-23: Abandoned WorldGen Support

**Decision:** WorldGen support for Super Metroid was abandoned due to the complexity of the VARIA logic system.

Super Metroid uses a highly complex difficulty-based logic system (SMBool with difficulty ratings) that is deeply integrated with the VARIA randomizer. This system is too complex to properly support in the WorldGen framework.

The standard spoiler test mode remains the primary testing approach for this game.
