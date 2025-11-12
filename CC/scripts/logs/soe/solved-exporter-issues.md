# Solved Exporter Issues for Secret of Evermore

This file tracks resolved issues with the Secret of Evermore exporter.

## Created Basic SOE Exporter

**Date**: 2025-11-12

**Issue**: SOE had no exporter, resulting in no rules being exported.

**Solution**: Created `exporter/games/soe.py` with:
1. SOEGameExportHandler class that extends BaseGameExportHandler
2. Initialization code that loads pyevermizer locations and progress constants
3. Methods to map pyevermizer locations by name
4. Progress ID to name mapping for better debugging

**Status**: Framework complete, still debugging rule export
