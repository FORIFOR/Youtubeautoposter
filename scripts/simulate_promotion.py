#!/usr/bin/env python3
"""Deterministic sensitivity calculations from recorded Promote UI ranges.

No assumed probability distribution, confidence interval, or unsampled budget
interpolation is applied. Follow-up yield is an explicit unmeasured assumption.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'production/distribution/promotion-forecast-2026-09-14.json'
OUTPUT = ROOT / 'production/analysis/promotion-simulation-2026-09-14.json'


def calculate(source):
    results = []
    seen = set()
    for row in source['rows']:
        key = row['goal'], row['mediaBudgetJpy']
        assert key not in seen, 'Duplicate forecast scenario'
        seen.add(key)
        budget = row['mediaBudgetJpy']
        low, high = row['viewsRange']
        assert budget > 0 and 0 < low <= high
        cash = round(budget * (1 + source['taxAssumption']['rate']), 2)
        results.append({
            'goal': row['goal'], 'mediaBudgetJpy': budget,
            'cashCostAtFullSpendJpy': cash,
            'viewsRangeFromUi': [low, high],
            'mediaCostPerViewArithmeticRangeJpy': [budget / high, budget / low],
            'cashCostPerViewArithmeticRangeJpy': [cash / high, cash / low],
            'sensitivity': [{
                'assumedAdditionalViewsPer100AdViews': k,
                'additionalViewsArithmeticRange': [low * k / 100, high * k / 100],
                'cashCostPerAdditionalViewArithmeticRangeJpy':
                    None if k == 0 else [cash / (high*k/100), cash / (low*k/100)],
            } for k in [0, 1, 5, 10]],
            'arithmeticIsPrediction': False,
        })
    assert len(seen) == 10
    return {
        'source': str(SOURCE.relative_to(ROOT)),
        'method': 'Direct UI ranges plus deterministic cost and yield sensitivity',
        'isMonteCarlo': False,
        'confidenceLevel': None,
        'additionalViewYieldCalibrated': False,
        'rows': results,
        'zeroBudgetCase': {'adViews': 0, 'organicViewsForecast': None},
        'failureCase': {'deliveryCanBeZero': True, 'returnViewsCanBeZero': True},
        'notes': [
            'All cost-per-view calculations assume full budget spend and the stated tax assumption.',
            'The UI bands are not guaranteed bounds or confidence intervals.',
            'Views and additional views are event counts, not independent or unique viewers.',
            'Additional-view yields are unmeasured sensitivity parameters, not conversion-rate estimates.',
            'Native Follow-on Views reporting is available only for audience-growth promotions.',
            'No guaranteed target budget is derived by scaling beyond observed scenarios.',
        ],
    }


if __name__ == '__main__':
    result = calculate(json.loads(SOURCE.read_text()))
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    for row in result['rows']:
        a, b = row['cashCostPerViewArithmeticRangeJpy']
        print(f"{row['goal']:16s} media={row['mediaBudgetJpy']:5d} cash={row['cashCostAtFullSpendJpy']:5.0f} views={row['viewsRangeFromUi']} cost/view={a:.2f}–{b:.2f}")
