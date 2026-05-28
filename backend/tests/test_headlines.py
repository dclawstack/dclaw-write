import pytest

from app.services.headlines import _score_variant, parse_variants


def test_parse_variants_strips_numbering():
    raw = """
    1. The first headline
    2) Second one
    - Third option
    * Fourth pick
    Plain fifth line
    """
    variants = parse_variants(raw, n=5)
    assert variants == [
        "The first headline",
        "Second one",
        "Third option",
        "Fourth pick",
        "Plain fifth line",
    ]


def test_score_variant_rewards_specificity():
    short = _score_variant("Why your team ships 3x faster in 60 days", None, None)
    long = _score_variant("Stuff", None, None)
    assert short["total"] > long["total"]
    assert short["specificity"] > 0
    assert short["curiosity"] > 0


@pytest.mark.asyncio
async def test_headlines_endpoint(client):
    response = await client.post(
        "/api/v1/ai/headlines",
        json={"topic": "small teams ship fast", "body": "argument", "n": 4},
    )
    assert response.status_code == 200
    body = response.json()
    assert 1 <= len(body["variants"]) <= 4
    scores = [v["score"] for v in body["variants"]]
    assert scores == sorted(scores, reverse=True)
