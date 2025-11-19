# Remaining Helper Issues

## Missing Helper: get_data_xaldin_rules

**Location in test**: Sphere 13.5
**Error**: Helper function "get_data_xaldin_rules" NOT FOUND in snapshotInterface

**Python definition** (worlds/kh2/Rules.py:805-814):
```python
def get_data_xaldin_rules(self, state: CollectionState) -> bool:
    data_xaldin_rules = {
        "easy":   self.kh2_dict_count(easy_data_xaldin, state) and self.form_list_unlock(state, ItemName.FinalForm, 5, True),
        "normal": self.kh2_dict_count(normal_data_xaldin, state) and self.form_list_unlock(state, ItemName.FinalForm, 5, True),
        "hard":   self.kh2_dict_count(hard_data_xaldin, state) and self.form_list_unlock(state, ItemName.FinalForm, 3, True) and self.kh2_has_any(party_limit, state),
    }
    return data_xaldin_rules[self.fight_logic]
```

**Dependencies**:
- `easy_data_xaldin`, `normal_data_xaldin`, `hard_data_xaldin` (dictionaries in worlds/kh2/Logic.py)
- `kh2_dict_count` helper
- `form_list_unlock` helper
- `kh2_has_any` helper
- `party_limit` list
- `FightLogic` setting

**Impact**: Region "Data Xaldin" and its locations are not reachable

