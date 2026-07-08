"""Unit tests for the JSON Tools Installer package.

Plain pytest suite (no TestBase); collected by the root pytest run via the
``worlds`` testpath. No test here touches a real install: everything goes
through ``extract_tools(dest_root=tmp_path)`` and monkeypatched ``Utils``
paths, and expected directory names are imported from the code under test
rather than repeated as literals.
"""
