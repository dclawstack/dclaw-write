from app.services.readability import analyze


def test_analyze_short_text():
    report = analyze("Hello. World.")
    assert report["sentences"] == 2
    assert report["words"] == 2
    assert report["flesch_reading_ease"] > 0


def test_analyze_flags_long_sentences():
    long_sentence = " ".join(["word"] * 40) + "."
    report = analyze(long_sentence)
    assert report["long_sentence_ratio"] == 1.0


def test_analyze_empty_text():
    report = analyze("")
    assert report["sentences"] == 0
    assert report["words"] == 0
    assert report["flesch_reading_ease"] == 0.0
