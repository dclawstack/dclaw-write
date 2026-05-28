import re

_WORD_RE = re.compile(r"\b[\w'\-]+\b", re.UNICODE)

WORDS_PER_MINUTE = 225


def count_words(text: str) -> int:
    if not text:
        return 0
    return len(_WORD_RE.findall(text))


def reading_time_seconds(text: str) -> int:
    words = count_words(text)
    if words == 0:
        return 0
    return max(1, round(words / WORDS_PER_MINUTE * 60))
