"""Demo seed data for the landing page (REMOVE WITH `dev.py` ROUTER).

This module is deliberately self-contained so the entire demo surface can be
ripped out by deleting two files (`services/seed_data.py`,
`api/v1/dev.py`) and one line in `api/main.py`. Nothing else imports from here.

It populates every feature added in Sprints 0-4: two voice-fit brand profiles,
two projects with realistic long-form documents, citations with mixed verified
flags, AI-suggestion telemetry across providers, a completed multi-agent
pipeline artifact, and embeddings on every entity so semantic search and
voice-neighbors return real results.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.text import count_words, reading_time_seconds
from app.core.utils import utc_now
from app.models.ai_suggestion import AISuggestion
from app.models.brand_profile import BrandProfile
from app.models.citation import Citation
from app.models.document import Document
from app.models.draft_pipeline import DraftPipeline
from app.models.embedding import Embedding
from app.models.project import Project
from app.models.revision import Revision
from app.models.voice_sample import VoiceSample
from app.services.embeddings import generate_embedding
from app.services.voice_dna import fit_profile


# ---------------------------------------------------------------------------
# Demo content
# ---------------------------------------------------------------------------

MACRO_SAMPLES = [
    (
        "Macro morning note",
        (
            "Markets churned through the morning, then settled into a familiar "
            "drift. Bond yields nudged up; equities slipped a touch. Traders "
            "watched the tape and waited — the only reasonable response when the "
            "data refuses to commit. The mood was hesitant; the prints, "
            "unhelpful. Few moved."
        ),
    ),
    (
        "Fed dot-plot review",
        (
            "The Fed's silence speaks louder than any dot plot. Two meetings ago "
            "the desk was pricing in cuts; today, the curve flattens and the "
            "consensus dissolves. Inflation prints landed in line — barely — and "
            "the next read will set the tone for the quarter. The bid is thin; "
            "the conviction, thinner."
        ),
    ),
]

INDIE_SAMPLES = [
    (
        "Shipping cadence note",
        (
            "Small teams ship fast because they remove coordination cost. The "
            "work fits in one head. The same person decides and executes. That's "
            "the entire moat. Stop adding meetings and start removing them. The "
            "product gets built when the people building it stop scheduling and "
            "start typing."
        ),
    ),
    (
        "PM job description",
        (
            "You don't need a roadmap. You need a calendar. Pick the next thing "
            "your users will pay for. Ship it Friday. Read the support tickets "
            "Monday. Repeat. The product manager you're trying to hire is your "
            "inbox. Hire your inbox. Stop hiring."
        ),
    ),
]


MACRO_DOC_1 = (
    "Markets churned through the morning, then settled into a familiar drift. "
    "Bond yields nudged up; equities slipped a touch — the only reasonable "
    "response when the data refuses to commit. The print landed in line with "
    "consensus; the reaction was muted; the desk moved on.\n\n"
    "What's striking is the persistence of the pattern. For three months now, "
    "CPI prints have surprised neither up nor down, and the curve has reacted "
    "the same way each time: a brief flutter, a yawn, a return to drift. The "
    "Fed's silence is doing the heavy lifting. According to recent Bloomberg "
    "polling, 78% of strategists expect a single cut by year-end, but the "
    "distribution is wider than it looks.\n\n"
    "The trade we like here is short the front-end, long the belly. It's a "
    "trade about positioning, not direction — the market is over-owned at the "
    "wings. Studies show that crowded trades unwind hardest when the catalyst "
    "is the absence of news, not its presence. This print qualified."
)

MACRO_DOC_2 = (
    "The Fed's communication problem isn't what it says — it's what the market "
    "hears. Every press conference becomes a Rorschach test. Powell says one "
    "thing; the strip prices another; the long bond ignores both.\n\n"
    "Part of this is structural. The dot plot was a transparency tool that "
    "became a market-moving event in its own right. According to research "
    "finds from the Brookings Institution, the variance of FOMC-day swap rate "
    "moves has doubled since 2014, even as the median dot has narrowed.\n\n"
    "The fix isn't more communication. It's less. Fewer signals, longer holds, "
    "more patience. The market can handle silence. What it can't handle is a "
    "signal that contradicts itself by Wednesday."
)

MACRO_DOC_3 = (
    "Equities are sitting at a coin flip. The internals look healthy — breadth "
    "is decent, the equal-weighted index is participating, vol is low — but "
    "the macro reads are inconclusive. Earnings season ends next Friday and "
    "the surprise rate has been the lowest in five quarters.\n\n"
    "This is where positioning matters more than narrative. The smart money "
    "is short calls, long puts; the retail bid is steady. When the desk sees "
    "this pattern, it usually means a churn is coming, not a crash."
)


INDIE_DOC_1 = (
    "Small teams ship faster than enterprise teams because they remove "
    "coordination cost. The work fits in one head. The same person decides and "
    "executes. That's the entire moat — and you can copy it for free.\n\n"
    "Look at the data. According to a 2024 GitHub productivity study, "
    "two-person engineering teams ship 3x more features per quarter than "
    "five-person teams working on the same product. The data refuses to "
    "commit on what happens at scale, but the early-stage delta is real.\n\n"
    "Three patterns worth stealing:\n\n"
    "1. Kill the standup. Replace it with a single async message at noon.\n"
    "2. Default to text. Calls are for blockers, not status.\n"
    "3. Ship Friday. The end of the week forces decisions the middle does not.\n\n"
    "You don't need a process. You need a Friday."
)

INDIE_DOC_2 = (
    "Stop hiring product managers. You don't need a roadmap. You need a "
    "calendar. Pick the next thing your users will pay for. Ship it Friday. "
    "Read the support tickets Monday. Repeat.\n\n"
    "The product manager you're trying to hire is your inbox. Hire your inbox. "
    "The signal-to-noise ratio is higher, the latency is lower, and the cost "
    "is zero. Every other framework — RICE, OKR, North Star — is a way to "
    "avoid reading what your customers already told you."
)


CITATIONS_DATA = [
    # (doc_key, claim, source_url, source_title, snippet, verified)
    (
        "macro_1",
        "78% of strategists expect a single cut by year-end",
        "https://www.bloomberg.com/news/markets/strategists-poll-rates-2026",
        "Bloomberg strategists rate-cut poll",
        "Bloomberg's monthly poll of 56 sell-side strategists shows 78% "
        "expect one cut by year-end.",
        True,
    ),
    (
        "macro_1",
        "Crowded trades unwind hardest when the catalyst is the absence of news",
        "https://www.aqr.com/Insights/Research/Working-Paper/Positioning-Risk",
        "AQR — positioning risk and crowded trades",
        "Working paper shows positioning-driven unwinds peak on no-news days "
        "across 30 years of futures data.",
        False,
    ),
    (
        "macro_2",
        "The variance of FOMC-day swap rate moves has doubled since 2014",
        "https://www.brookings.edu/research/fed-communication-variance-2024/",
        "Brookings — Fed communication and rate volatility",
        "We document a 2.1x increase in implied vol on FOMC days vs. a 2014 "
        "baseline, even as the median dot path has tightened.",
        True,
    ),
    (
        "indie_1",
        "Two-person teams ship 3x more features per quarter than five-person teams",
        "https://github.blog/research/2024-productivity-team-size/",
        "GitHub — 2024 team size and shipping cadence",
        "Among 14,200 repositories, 2-engineer teams shipped 3.1x more "
        "merged PRs per engineer per quarter than 5-engineer teams.",
        True,
    ),
    (
        "indie_1",
        "Friday shipping forces decisions the middle of the week does not",
        "https://stripe.com/blog/shipping-cadence-2026",
        "Stripe — what we learned shipping every Friday",
        "Stripe Issuing's weekly Friday release cycle cut average decision "
        "latency from 3.4 days to 1.1 days in the team's first quarter.",
        False,
    ),
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def status(db: AsyncSession) -> dict[str, int]:
    counts = {}
    for label, model in (
        ("projects", Project),
        ("documents", Document),
        ("revisions", Revision),
        ("brand_profiles", BrandProfile),
        ("voice_samples", VoiceSample),
        ("citations", Citation),
        ("ai_suggestions", AISuggestion),
        ("draft_pipelines", DraftPipeline),
        ("embeddings", Embedding),
    ):
        result = await db.execute(select(func.count()).select_from(model))
        counts[label] = int(result.scalar() or 0)
    return counts


async def clear_all(db: AsyncSession) -> dict[str, int]:
    """Wipe every demo-creatable row. Order respects FK dependencies."""
    deleted: dict[str, int] = {}
    for model in (
        AISuggestion,
        DraftPipeline,
        Embedding,
        Citation,
        Revision,
        Document,
        VoiceSample,
        BrandProfile,
        Project,
    ):
        result = await db.execute(delete(model))
        deleted[model.__tablename__] = int(result.rowcount or 0)
    await db.commit()
    return deleted


async def seed(db: AsyncSession) -> dict[str, Any]:
    """Idempotent — clears first, then loads the demo corpus."""
    await clear_all(db)

    now = utc_now()

    # Brand profiles ---------------------------------------------------------
    macro_profile = await _make_brand_profile(
        db,
        name="Macro Markets Voice",
        description="Tight prose, em-dashes, semicolons, market-desk cadence.",
        samples=MACRO_SAMPLES,
        created_at=now - timedelta(days=14),
    )
    indie_profile = await _make_brand_profile(
        db,
        name="Indie Maker Voice",
        description="Punchy second-person blogs for founders and operators.",
        samples=INDIE_SAMPLES,
        created_at=now - timedelta(days=10),
    )

    # Projects + documents ---------------------------------------------------
    macro_project = Project(
        id=uuid.uuid4(),
        name="Q3 Newsletters",
        description="Weekly macro newsletter — markets desk.",
        created_at=now - timedelta(days=10),
        updated_at=now - timedelta(days=1),
    )
    indie_project = Project(
        id=uuid.uuid4(),
        name="Product Launch Series",
        description="Founder-voice blog supporting the v2 launch.",
        created_at=now - timedelta(days=7),
        updated_at=now,
    )
    db.add_all([macro_project, indie_project])
    await db.commit()

    docs: dict[str, Document] = {}
    docs["macro_1"] = await _make_document(
        db,
        project=macro_project,
        title="Why bond yields shrugged off the CPI print",
        content=MACRO_DOC_1,
        content_type="newsletter",
        status="published",
        created_at=now - timedelta(days=9),
    )
    docs["macro_2"] = await _make_document(
        db,
        project=macro_project,
        title="The Fed's communication problem",
        content=MACRO_DOC_2,
        content_type="newsletter",
        status="draft",
        created_at=now - timedelta(days=4),
    )
    docs["macro_3"] = await _make_document(
        db,
        project=macro_project,
        title="Equities at a coin flip",
        content=MACRO_DOC_3,
        content_type="newsletter",
        status="draft",
        created_at=now - timedelta(days=1),
    )
    docs["indie_1"] = await _make_document(
        db,
        project=indie_project,
        title="How small teams ship faster",
        content=INDIE_DOC_1,
        content_type="article",
        status="published",
        created_at=now - timedelta(days=6),
    )
    docs["indie_2"] = await _make_document(
        db,
        project=indie_project,
        title="Stop hiring product managers",
        content=INDIE_DOC_2,
        content_type="blog",
        status="draft",
        created_at=now - timedelta(days=2),
    )

    # Revisions — one historical edit for the published macro doc.
    db.add(
        Revision(
            id=uuid.uuid4(),
            document_id=docs["macro_1"].id,
            content=MACRO_DOC_1.replace("the only reasonable response", "the obvious response"),
            word_count=count_words(MACRO_DOC_1),
            created_at=now - timedelta(days=9, hours=2),
        )
    )

    # Citations --------------------------------------------------------------
    for doc_key, claim, url, title, snippet, verified in CITATIONS_DATA:
        db.add(
            Citation(
                id=uuid.uuid4(),
                document_id=docs[doc_key].id,
                paragraph_index=0,
                claim=claim,
                source_url=url,
                source_title=title,
                source_snippet=snippet,
                verified=verified,
                created_at=now - timedelta(days=3),
                updated_at=now - timedelta(days=3),
            )
        )

    # AI Suggestions — mixed providers and outcomes for the dashboard.
    suggestion_seed: list[tuple[str, str, str, int, int, int, bool | None]] = [
        # (doc_key, provider, model, latency_ms, voice_match, output_chars, accepted)
        ("macro_1", "ollama", "llama3.1", 1420, 78, 220, True),
        ("macro_1", "ollama", "llama3.1", 1180, 71, 195, True),
        ("macro_2", "openrouter", "meta-llama/llama-3.1-8b-instruct", 980, 64, 240, False),
        ("macro_2", "ollama", "llama3.1", 1530, 73, 210, True),
        ("macro_3", "openrouter", "anthropic/claude-3-5-haiku", 720, 81, 260, True),
        ("indie_1", "ollama", "llama3.1", 1310, 76, 230, True),
        ("indie_1", "openrouter", "meta-llama/llama-3.1-8b-instruct", 860, 58, 200, False),
        ("indie_2", "ollama", "llama3.1", 1240, 82, 250, None),
        ("indie_2", "mock", "echo-bigram", 28, 41, 180, False),
    ]
    for idx, (doc_key, provider, model, latency, voice, out_chars, accepted) in enumerate(
        suggestion_seed
    ):
        created = now - timedelta(days=3, hours=idx)
        resolved = created + timedelta(minutes=2) if accepted is not None else None
        db.add(
            AISuggestion(
                id=uuid.uuid4(),
                document_id=docs[doc_key].id,
                brand_profile_id=(
                    macro_profile.id if doc_key.startswith("macro") else indie_profile.id
                ),
                prompt="Continue this paragraph in the author's voice.",
                output="(seeded) " + "x" * out_chars,
                provider=provider,
                model=model,
                latency_ms=latency,
                cost_cents=0,
                voice_match_score=voice,
                accepted=accepted,
                created_at=created,
                resolved_at=resolved,
            )
        )

    # Draft pipeline run — fully-populated artifact for the indie doc.
    db.add(
        DraftPipeline(
            id=uuid.uuid4(),
            document_id=docs["indie_1"].id,
            brand_profile_id=indie_profile.id,
            topic="How small teams ship faster",
            instruction="Keep it punchy, second-person, founder voice.",
            status="completed",
            current_step="fact_checker",
            artifacts=_indie_pipeline_artifact(),
            final_draft=INDIE_DOC_1,
            error=None,
            created_at=now - timedelta(days=5),
            updated_at=now - timedelta(days=5),
        )
    )

    await db.commit()

    # Embeddings — give the semantic + voice-neighbors search real targets.
    for doc in docs.values():
        await _upsert_embedding(
            db,
            entity_type="document",
            entity_id=doc.id,
            purpose="semantic",
            text=f"{doc.title}\n\n{doc.content}",
        )
    for profile, samples in (
        (macro_profile, MACRO_SAMPLES),
        (indie_profile, INDIE_SAMPLES),
    ):
        joined = "\n\n".join(text for _, text in samples)
        await _upsert_embedding(
            db,
            entity_type="brand_profile",
            entity_id=profile.id,
            purpose="voice",
            text=joined,
        )

    return await status(db)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_brand_profile(
    db: AsyncSession,
    *,
    name: str,
    description: str,
    samples: list[tuple[str, str]],
    created_at: datetime,
) -> BrandProfile:
    features, bigrams, total_words = fit_profile([text for _, text in samples])
    profile = BrandProfile(
        id=uuid.uuid4(),
        name=name,
        description=description,
        sample_count=len(samples),
        total_tokens=total_words,
        style_features=features,
        bigram_signature=bigrams,
        created_at=created_at,
        updated_at=created_at,
    )
    db.add(profile)
    await db.flush()
    for label, text in samples:
        db.add(
            VoiceSample(
                id=uuid.uuid4(),
                brand_profile_id=profile.id,
                label=label,
                source_url=None,
                text=text,
                word_count=count_words(text),
                created_at=created_at,
            )
        )
    await db.commit()
    await db.refresh(profile)
    return profile


async def _make_document(
    db: AsyncSession,
    *,
    project: Project,
    title: str,
    content: str,
    content_type: str,
    status: str,
    created_at: datetime,
) -> Document:
    doc = Document(
        id=uuid.uuid4(),
        project_id=project.id,
        title=title,
        content_type=content_type,
        status=status,
        content=content,
        word_count=count_words(content),
        reading_time_seconds=reading_time_seconds(content),
        created_at=created_at,
        updated_at=created_at,
    )
    db.add(doc)
    await db.flush()
    return doc


async def _upsert_embedding(
    db: AsyncSession,
    *,
    entity_type: str,
    entity_id: uuid.UUID,
    purpose: str,
    text: str,
) -> None:
    result = await generate_embedding(text)
    db.add(
        Embedding(
            id=uuid.uuid4(),
            entity_type=entity_type,
            entity_id=entity_id,
            purpose=purpose,
            model=result.model,
            dim=result.dim,
            vector=result.vector,
        )
    )
    await db.commit()


def _indie_pipeline_artifact() -> dict[str, Any]:
    return {
        "planner": {
            "provider": "ollama",
            "model": "llama3.1",
            "latency_ms": 1820,
            "sections": [
                {"title": "Why coordination cost dominates", "brief": "set up the stakes"},
                {"title": "The Friday shipping rule", "brief": "the concrete pattern"},
                {"title": "Async by default", "brief": "the second pattern"},
                {"title": "Hire your inbox", "brief": "the controversial move"},
                {"title": "Closing thought", "brief": "the parting punch"},
            ],
        },
        "researcher": {
            "sections": [
                {
                    "section": "Why coordination cost dominates",
                    "claims": [
                        {"text": "Two-person teams ship 3x more per engineer per quarter.", "needs_source": False},
                        {"text": "Meeting cost grows quadratically with team size.", "needs_source": True},
                    ],
                    "provider": "ollama",
                    "model": "llama3.1",
                },
                {
                    "section": "The Friday shipping rule",
                    "claims": [
                        {"text": "End-of-week deadlines compress decision latency.", "needs_source": False},
                    ],
                    "provider": "ollama",
                    "model": "llama3.1",
                },
            ]
        },
        "drafter": {
            "draft": INDIE_DOC_1,
            "section_count": 5,
        },
        "editor": {
            "draft": INDIE_DOC_1,
            "applied": True,
            "provider": "ollama",
            "model": "llama3.1",
        },
        "fact_checker": {
            "claims_needing_sources": 1,
            "suspect_sentences": [
                "Meeting cost grows quadratically with team size."
            ],
            "researcher_bullets": 3,
            "note": "Heuristic only — claim verification with web retrieval lands in 2.2.",
        },
        "voice_match_score": 82,
        "duration_ms": 18420,
    }
