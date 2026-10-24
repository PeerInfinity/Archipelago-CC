from typing import Any

map_pages = {
    "Normal": 0,
    "Hard": 1,
    "Annihilation": 2
}

def map_page_index(data: Any):
    return map_pages[data] if (data in map_pages) else 0