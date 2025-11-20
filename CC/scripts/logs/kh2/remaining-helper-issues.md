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

**Investigation Completed:**

1. ✅ Helper function `get_data_xaldin_rules` exists in frontend/modules/shared/gameLogic/kh2/kh2Logic.js:1369
2. ✅ Helper is properly registered in gameLogicRegistry.js for 'Kingdom Hearts 2'
3. ✅ Exit from "Xaldin" region to "Data Xaldin" region uses correct helper call
4. ✅ "Xaldin" parent region becomes accessible in sphere 9.5 (before sphere 13.5)
5. ✅ FightLogic setting is correctly set to 1 (normal) in rules.json settings
6. ✅ Player has all required forms: Final Form, Valor Form, Wisdom Form, Limit Form, Master Form, Light & Darkness
7. ✅ Player receives "Aerial Dive" in sphere 13.5, which is the last required item from NORMAL_DATA_XALDIN dictionary

**Findings:**
- The Python backend correctly identifies Data Xaldin as accessible when Aerial Dive is collected
- The JavaScript frontend does not mark the region as accessible
- All prerequisites appear to be met:
  - kh2_dict_count should pass (all NORMAL_DATA_XALDIN items present after Aerial Dive)
  - form_list_unlock should pass (has Final Form + 5 total forms with Light & Darkness)

**Next Steps:**
1. Add debug logging to get_data_xaldin_rules helper to see actual return value
2. Add logging to kh2_dict_count and form_list_unlock to identify which check fails
3. Verify snapshot.inventory actually contains all the expected items at sphere 13.5
4. Check if there's a timing issue with state updates vs rule evaluation

**Hypothesis:**
The helper function logic appears correct, but one of the sub-checks (dict_count or form_list_unlock) is failing. Most likely candidate is form_list_unlock not properly counting forms or checking Final Form ownership.

