from app.services.voice_dna import (
    compute_features,
    fit_profile,
    top_bigram_signature,
    voice_match_score,
)


SAMPLE_A = (
    "The fog rolled in slowly. Streetlamps blinked on, one after another. "
    "Somewhere a dog barked; somewhere else a kettle whistled. The city kept "
    "its quiet rituals — none of them for anyone in particular."
)
SAMPLE_B = (
    "Markets churned through the morning, then settled into a familiar drift. "
    "Bond yields nudged up; equities slipped a touch. Traders watched the tape "
    "and waited — the only reasonable response when the data refuses to commit."
)


def test_compute_features_basic():
    f = compute_features(SAMPLE_A)
    assert f["word_count"] > 20
    assert f["sentence_count"] >= 3
    assert 0 < f["type_token_ratio"] <= 1
    assert f["mean_sentence_length"] > 0
    assert f["flesch_reading_ease"] != 0


def test_features_empty_text():
    f = compute_features("")
    assert f["word_count"] == 0
    assert f["mean_sentence_length"] == 0


def test_bigram_signature_top_k_normalised():
    sig = top_bigram_signature([SAMPLE_A, SAMPLE_B], top_k=10)
    assert 0 < len(sig) <= 10
    total = sum(sig.values())
    assert abs(total - 1.0) < 1e-3


def test_fit_profile_aggregates():
    features, bigrams, words = fit_profile([SAMPLE_A, SAMPLE_B])
    assert features["word_count"] > 0
    assert words > 0
    assert len(bigrams) > 0


def test_voice_match_high_for_same_author():
    f_a, b_a, _ = fit_profile([SAMPLE_A])
    sample_features = compute_features(SAMPLE_A)
    score_self = voice_match_score(sample_features, b_a, f_a, b_a)
    sample_other = compute_features(SAMPLE_B)
    score_other = voice_match_score(sample_other, {}, f_a, b_a)
    assert score_self >= score_other
    assert score_self >= 50


def test_voice_match_with_empty_profile():
    sample = compute_features(SAMPLE_A)
    score = voice_match_score(sample, {}, {}, {})
    assert score == 0
