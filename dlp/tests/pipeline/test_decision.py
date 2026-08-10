from app.pipeline.decision import evaluate_decision


def test_explicit_block_action_wins_over_lower_severity():
    assert evaluate_decision([{"severity": "low", "action": "BLOCK"}]) == "BLOCK"


def test_explicit_mask_action_allows_medium_detection():
    assert evaluate_decision([{"severity": "medium", "action": "MASK"}]) == "MASK"
