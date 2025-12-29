# Starcraft 2 - Solved Helper Issues

**Last Updated:** 2025-12-29

## Summary

This file documents helper issues that have been resolved for SC2.

## Previously Solved Issues

The SC2 helper file was implemented comprehensively from the start based on the Python source in `worlds/sc2/Rules.py`. No specific issues have been tracked as needing resolution.

## Implementation Notes

The helper implementation follows the pattern from the Python SC2Logic class:

1. **Basic Unit Checks**: Verify player has common units for each faction
2. **Anti-Air Checks**: Various levels of anti-air capability
3. **Defense Ratings**: Calculate defense ratings based on items and tactics level
4. **Mission Requirements**: Check specific mission entry requirements
5. **Nova Checks**: Nova covert ops campaign helpers
6. **Kerrigan Checks**: Heart of the Swarm campaign helpers
