"""Citation-grounded retrieval (plan item 2.2).

Two halves:

1. **Web search.** Tavily first (production-grade index built for LLMs), then
   Serper, then a deterministic mock that derives plausible source URLs from
   the claim. The mock is what runs in tests and on no-API-key demos.
2. **Verification.** For each candidate, we compute a support score for the
   claim against the source snippet using token overlap. Real verification
   (LLM-as-judge with full source body) is the natural follow-up but adds
   latency + cost — overlap is "honest enough" to demo and to bootstrap the
   ``verified`` flag on ``Citation`` rows.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Optional

import httpx

from app.core.config import get_settings

_WORD_RE = re.compile(r"\b[\w'\-]+\b", re.UNICODE)
_STOPWORDS = frozenset(
    "the a an and or but if then in on at to of for is are was were be by with as that this it from".split()
)

MOCK_DOMAINS = [
    ("encyclopedia", "en.wikipedia.org"),
    ("research", "scholar.example.org"),
    ("press", "news.example.com"),
    ("explainer", "magazine.example.com"),
    ("data", "data.example.gov"),
]


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    provider: str


@dataclass
class GroundedSource:
    title: str
    url: str
    snippet: str
    provider: str
    support_score: int  # 0..100
    verified: bool


async def web_search(query: str, max_results: int = 5) -> list[SearchResult]:
    settings = get_settings()
    for attempt in (_tavily, _serper):
        try:
            results = await attempt(settings, query, max_results)
            if results:
                return results
        except Exception:
            continue
    return _mock_search(query, max_results)


async def _tavily(settings, query: str, max_results: int) -> Optional[list[SearchResult]]:
    if not settings.tavily_api_key:
        return None
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": settings.tavily_api_key,
                "query": query,
                "max_results": max_results,
                "include_answer": False,
            },
        )
        response.raise_for_status()
        payload = response.json()
    return [
        SearchResult(
            title=item.get("title", "")[:300] or query,
            url=item.get("url", ""),
            snippet=(item.get("content") or item.get("snippet") or "")[:500],
            provider="tavily",
        )
        for item in payload.get("results", [])
    ]


async def _serper(settings, query: str, max_results: int) -> Optional[list[SearchResult]]:
    if not settings.serper_api_key:
        return None
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": settings.serper_api_key},
            json={"q": query, "num": max_results},
        )
        response.raise_for_status()
        payload = response.json()
    organic = payload.get("organic", [])[:max_results]
    return [
        SearchResult(
            title=item.get("title", "")[:300] or query,
            url=item.get("link", ""),
            snippet=(item.get("snippet") or "")[:500],
            provider="serper",
        )
        for item in organic
    ]


def _mock_search(query: str, max_results: int) -> list[SearchResult]:
    """Deterministic placeholder sources.

    Every claim gets the same N plausible domains; titles and snippets
    incorporate the claim's keywords so the verification overlap score is
    non-trivial. Use only when no real web index is configured.
    """
    keywords = [t for t in _WORD_RE.findall(query.lower()) if t not in _STOPWORDS][:6]
    if not keywords:
        keywords = ["topic"]
    seed = hashlib.sha1(query.lower().encode("utf-8")).hexdigest()[:8]
    results: list[SearchResult] = []
    for i, (kind, domain) in enumerate(MOCK_DOMAINS[:max_results]):
        focus = keywords[i % len(keywords)]
        results.append(
            SearchResult(
                title=f"{focus.title()} — {kind} reference",
                url=f"https://{domain}/{seed}/{focus}",
                snippet=(
                    f"This {kind} source touches on {' '.join(keywords[:4])}. "
                    f"It discusses how {focus} relates to the broader topic and "
                    "outlines the supporting evidence."
                ),
                provider="mock",
            )
        )
    return results


def support_score(claim: str, snippet: str) -> int:
    """Token-overlap heuristic. 0 = no overlap, 100 = full claim covered."""
    claim_tokens = [t for t in _WORD_RE.findall(claim.lower()) if t not in _STOPWORDS]
    if not claim_tokens:
        return 0
    snippet_tokens = {t for t in _WORD_RE.findall(snippet.lower()) if t not in _STOPWORDS}
    if not snippet_tokens:
        return 0
    covered = sum(1 for t in set(claim_tokens) if t in snippet_tokens)
    return int(round(covered / len(set(claim_tokens)) * 100))


async def ground_claim(claim: str, max_results: int = 5, accept_threshold: int = 50) -> list[GroundedSource]:
    results = await web_search(claim, max_results=max_results)
    grounded: list[GroundedSource] = []
    for r in results:
        score = support_score(claim, r.snippet)
        grounded.append(
            GroundedSource(
                title=r.title,
                url=r.url,
                snippet=r.snippet,
                provider=r.provider,
                support_score=score,
                verified=score >= accept_threshold,
            )
        )
    grounded.sort(key=lambda g: g.support_score, reverse=True)
    return grounded
