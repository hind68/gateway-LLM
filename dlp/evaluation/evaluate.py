"""Lightweight labeled DLP evaluator. Run from the dlp directory."""

import argparse
from collections import defaultdict
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _expected(sample):
    result = []
    cursor = 0
    for item in sample.get("expected", []):
        start = sample["text"].find(item["value"], cursor)
        if start < 0:
            raise ValueError(f"{sample['id']}: expected value not present")
        end = start + len(item["value"])
        cursor = end
        result.append({"type": item["type"], "start": start, "end": end})
    return result


def _overlaps(left, right):
    return left["start"] < right["end"] and right["start"] < left["end"]


def _score(expected, predicted):
    matched_predictions = set()
    counts = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    for truth in expected:
        match_index = next((i for i, prediction in enumerate(predicted)
                            if i not in matched_predictions and prediction["type"] == truth["type"] and _overlaps(truth, prediction)), None)
        if match_index is None:
            counts[truth["type"]]["fn"] += 1
        else:
            matched_predictions.add(match_index)
            counts[truth["type"]]["tp"] += 1
    for index, prediction in enumerate(predicted):
        if index not in matched_predictions:
            counts[prediction["type"]]["fp"] += 1
    return counts


def _metrics(counts):
    output = {}
    for entity, values in counts.items():
        tp, fp, fn = values["tp"], values["fp"], values["fn"]
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        output[entity] = {**values, "precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}
    return output


def evaluate(corpus_path: Path, mode: str):
    from app.detectors.regex_detector import run_regex_detectors
    from app.pipeline.dedup import deduplicate_matches
    if mode == "full":
        from app.detectors.language import detect_language
        from app.detectors.presidio_detector import detect_with_presidio
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))["samples"]
    totals = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    failures = []
    for sample in corpus:
        predictions = run_regex_detectors(sample["text"])
        if mode == "full":
            predictions += detect_with_presidio(sample["text"], detect_language(sample["text"]))
        predictions = deduplicate_matches(predictions)
        sample_counts = _score(_expected(sample), predictions)
        if any(values["fp"] or values["fn"] for values in sample_counts.values()):
            failures.append({"id": sample["id"], "counts": dict(sample_counts)})
        for entity, values in sample_counts.items():
            for key in ("tp", "fp", "fn"):
                totals[entity][key] += values[key]
    global_counts = {key: sum(item[key] for item in totals.values()) for key in ("tp", "fp", "fn")}
    return {"mode": mode, "samples": len(corpus), "global": _metrics({"all": global_counts})["all"], "entities": _metrics(totals), "failures": failures}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", type=Path, default=Path(__file__).with_name("corpus.json"))
    parser.add_argument("--mode", choices=("regex", "full"), default="regex")
    parser.add_argument("--json-output", type=Path)
    args = parser.parse_args()
    report = evaluate(args.corpus, args.mode)
    print(f"DLP evaluation ({report['mode']}): {report['samples']} samples")
    print("entity                       TP  FP  FN   precision recall   F1")
    for entity, values in [("GLOBAL", report["global"]), *sorted(report["entities"].items())]:
        print(f"{entity:28} {values['tp']:>3} {values['fp']:>3} {values['fn']:>3}   {values['precision']:.3f}    {values['recall']:.3f}  {values['f1']:.3f}")
    if args.json_output:
        args.json_output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
