"""Style-constrained prompt builder for the Writing Copilot.

The wedge: every completion is grounded in the user's measured Voice DNA, not
a generic "write like a blogger" prompt. The features pulled from BrandProfile
become explicit constraints, and the user's own recent text is the only
example the model sees.
"""
from __future__ import annotations

from typing import Optional

from app.core.text import count_words

DEFAULT_CONTEXT_WORDS = 320


def recent_context(text: str, max_words: int = DEFAULT_CONTEXT_WORDS) -> str:
    """Return the trailing window of ``text`` capped at ``max_words``.

    Continuation quality drops if we send the whole document — the model
    drifts away from the user's most recent voice.
    """
    if count_words(text) <= max_words:
        return text.strip()
    words = text.split()
    return " ".join(words[-max_words:]).strip()


def build_style_prompt(
    profile_features: Optional[dict[str, float]],
    profile_bigrams: Optional[dict[str, float]],
    instruction: Optional[str] = None,
) -> str:
    """Construct the system prompt that constrains the model to user voice."""
    lines = [
        "You are the user's writing copilot. Continue their text in their exact voice.",
        "Do not introduce yourself. Do not summarize. Do not repeat prior text.",
        "Add 2-4 sentences that flow naturally from where they left off.",
    ]

    if profile_features:
        f = profile_features
        msl = f.get("mean_sentence_length", 0)
        if msl:
            lines.append(f"Target mean sentence length: ~{msl:.0f} words.")
        ttr = f.get("type_token_ratio", 0)
        if ttr:
            lines.append(f"Target lexical diversity (type-token ratio): ~{ttr:.2f}.")
        flesch = f.get("flesch_reading_ease", 0)
        if flesch:
            lines.append(f"Target reading ease: ~{flesch:.0f} (Flesch).")
        if f.get("semicolon_density", 0) > 0.5:
            lines.append("The author uses semicolons — keep them.")
        if f.get("dash_density", 0) > 0.5:
            lines.append("The author uses em-dashes — keep them.")
        if f.get("question_density", 0) > 0.5:
            lines.append("The author occasionally uses rhetorical questions.")

    if profile_bigrams:
        top = list(profile_bigrams.keys())[:8]
        if top:
            lines.append("Common phrases in the author's voice: " + ", ".join(top) + ".")

    if instruction:
        lines.append(f"Additional instruction from the user: {instruction}")

    return "\n".join(lines)
