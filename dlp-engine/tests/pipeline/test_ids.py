from app.pipeline.ids import assign_ids


def test_ids_increment_per_type():
    matches = [
        {"type": "email", "start": 0, "end": 5},
        {"type": "email", "start": 10, "end": 15},
        {"type": "name", "start": 20, "end": 25},
    ]
    result = assign_ids(matches)
    assert result[0]["id"] == "email_1"
    assert result[1]["id"] == "email_2"
    assert result[2]["id"] == "name_1"

def test_ids_are_unique():
    matches = [
        {"type": "email", "start": 0, "end": 5},
        {"type": "email", "start": 10, "end": 15},
    ]
    result = assign_ids(matches)
    ids = [m["id"] for m in result]
    assert len(ids) == len(set(ids))

def test_ids_follow_text_position_not_list_order():
    # regex results are concatenated before presidio results, which isn't
    # necessarily reading order - a later-in-text match can arrive first
    # in the list. Numbering must follow "start" so email_1 always means
    # "the first email in the text", not "whichever detector reported it
    # first".
    matches = [
        {"type": "email", "start": 50, "end": 55},  # second email in the text
        {"type": "email", "start": 0, "end": 5},     # first email in the text
    ]
    result = assign_ids(matches)
    by_start = {m["start"]: m["id"] for m in result}
    assert by_start[0] == "email_1"
    assert by_start[50] == "email_2"