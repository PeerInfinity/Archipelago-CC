#!/usr/bin/env python
import sys
sys.path.append('worlds/smz3')

from TotalSMZ3.Region import RewardType
from worlds.smz3 import SMZ3World
from BaseClasses import MultiWorld

# Print reward type values
print("RewardType enum values:")
for reward in RewardType:
    print(f"  {reward.name} = {reward.value}")
