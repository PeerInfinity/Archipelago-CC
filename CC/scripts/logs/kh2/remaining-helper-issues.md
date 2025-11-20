# Remaining Helper Issues

## Issue 1: Data Xaldin Region Not Accessible (Sphere 13.5)

**Test Failure:** Spoiler test fails at Sphere 13.5
**Symptom:** Region "Data Xaldin" is not reachable in STATE but IS accessible in LOG
**Affected Locations:**
- (Post BC2: Ballroom) Data Xaldin
- Data Xaldin Event Location

**Access Rule:** The exit to "Data Xaldin" region uses helper function `get_data_xaldin_rules` with no args

**Helper Function:** `get_data_xaldin_rules` is defined in frontend/modules/shared/gameLogic/kh2/kh2Logic.js:1369

**Python Source:** worlds/kh2/Rules.py:805-814

**Requirements (from Python code):**
- Easy: kh2_dict_count(easy_data_xaldin) AND form_list_unlock(FinalForm, 5, fight_logic=True)
- Normal: kh2_dict_count(normal_data_xaldin) AND form_list_unlock(FinalForm, 5, fight_logic=True)
- Hard: kh2_dict_count(hard_data_xaldin) AND form_list_unlock(FinalForm, 3, fight_logic=True) AND kh2_has_any(party_limit)

**Data Dictionaries (from worlds/kh2/Logic.py:204-245):**
```python
easy_data_xaldin = {
    ItemName.FireElement:     3,
    ItemName.AirComboPlus:    2,
    ItemName.FinishingPlus:   1,
    ItemName.Guard:           1,
    ItemName.ReflectElement:  3,
    # ... (see EASY_DATA_XALDIN in kh2Logic.js:36-53)
}
```

**Investigation Needed:**
1. Verify the helper function is being called correctly by the rule engine
2. Check if `form_list_unlock` is working correctly for fight logic
3. Debug what the actual inventory state is at sphere 13.5
4. Verify FightLogic setting value is being passed correctly

