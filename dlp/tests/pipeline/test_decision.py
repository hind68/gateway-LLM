from app.pipeline.decision import evaluate_decision


def test_low_severity_is_masked_even_when_rule_action_is_block():
    assert evaluate_decision([{"severity": "low", "action": "BLOCK"}]) == "MASK"


def test_medium_severity_is_masked_even_when_rule_action_is_block():
    assert evaluate_decision([{"severity": "medium", "action": "BLOCK"}]) == "MASK"


def test_high_severity_is_blocked():
    assert evaluate_decision([{"severity": "high", "action": "MASK"}]) == "BLOCK"


def test_no_finding_is_allowed_and_analysis_error_blocks():
    assert evaluate_decision([]) == "ALLOW"
    assert evaluate_decision([], analysis_error=True) == "BLOCK"
