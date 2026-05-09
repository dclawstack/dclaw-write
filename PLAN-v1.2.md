# DClaw Write — v1.2 Feature Roadmap

> Based on: Y Combinator vertical SaaS principles, trending GitHub repos (typewriter, novelwriter), AI product research (Grammarly, Jasper, Copy.ai, Writesonic)

## Pre-Flight Checklist

- [ ] `frontend/package-lock.json` committed after any `npm install` / dependency change
- [ ] `frontend/next-env.d.ts` exists and is committed
- [ ] `docker-compose.yml` healthchecks correct
- [ ] `frontend/Dockerfile` declares `ARG NEXT_PUBLIC_API_URL` before `RUN npm run build`

## v1.0 Feature Inventory (Current)

- [ ] Document/project CRUD
- [ ] Distraction-free editor
- [ ] Basic formatting
- [ ] Export to multiple formats
- [ ] Real backend CRUD (no mocks)
- [ ] Docker + Helm deployment
- [ ] Alembic migrations
- [ ] Backend tests

---

## v1.2 Roadmap

### P0 — Must Have (Ship in v1.0, demo-ready)

#### 1. AI Writing Copilot (Creative Partner)
**Description:** AI assistant that helps overcome writer's block, suggests plot points, and rewrites passages. "Write a tense dialogue scene between a detective and a suspect."
- **AI Angle:** Creative writing LLM with style matching. Plot suggestion engine.
- **Backend:** `/api/v1/ai/write-chat` endpoint. Style analysis.
- **Frontend:** Inline AI suggestions. Chat panel for brainstorming.
- **Files:** `backend/app/services/write_ai.py`, `frontend/src/components/write-copilot.tsx`

#### 2. Grammar, Style & Readability
**Description:** Real-time grammar checking, style suggestions, and readability scoring.
- **AI Angle:** Context-aware grammar correction. Style consistency analysis.
- **Backend:** `/api/v1/ai/check` endpoint.
- **Frontend:** Inline suggestions with accept/reject.
- **Files:** `backend/app/services/grammar.py`

#### 3. Project Organization & Outlining
**Description:** Organize writing into projects, chapters, scenes, and notes. Corkboard/outline view.
- **Backend:** Hierarchical project model.
- **Frontend:** Sidebar tree. Corkboard with movable cards.
- **Files:** `frontend/src/app/projects/outline.tsx`

#### 4. Focus Mode & Writing Sprints
**Description:** Distraction-free writing with timed sprints, progress tracking, and daily goals.
- **Backend:** Session tracking. Goal management.
- **Frontend:** Full-screen editor. Sprint timer. Progress bar.
- **Files:** `frontend/src/components/focus-mode.tsx`

### P1 — Should Have (v1.1–1.2)

#### 5. AI Research & Fact-Checking
**Description:** AI researches topics, suggests sources, and flags potential factual errors.
- **AI Angle:** Web search + claim verification.
- **Backend:** Research pipeline with citation extraction.
- **Frontend:** Research sidebar with source cards.

#### 6. Character & World Building Tools
**Description:** Character sheets, location descriptions, timeline builder, and relationship maps.
- **Backend:** Entity management with relationships.
- **Frontend:** Character cards. Relationship graph.

#### 7. Collaborative Editing & Comments
**Description:** Real-time collaboration with comments, suggestions, and version history.
- **Backend:** OT sync server.
- **Frontend:** Comment threads. Suggestion mode.

#### 8. Multi-Format Export
**Description:** Export to DOCX, PDF, EPUB, Markdown, HTML with custom styling.
- **Backend:** Export pipeline with template engine.
- **Frontend:** Export dialog with preview.

### P2 — Could Have (v1.3+)

#### 9. AI Plot Structure Analysis
**Description:** AI analyzes story structure and suggests pacing improvements.

#### 10. Sentiment & Tone Analysis
**Description:** Track emotional arc of narrative. Ensure consistent character voice.

#### 11. Publishing Integration
**Description:** Direct publish to Medium, Substack, Kindle, and print-on-demand.

#### 12. AI Audiobook Generation
**Description:** Generate audiobook from manuscript with multiple voice actors.

---

## Implementation Priority

1. **Week 1–2:** AI Writing Copilot (P0.1) + Grammar/Style (P0.2)
2. **Week 3–4:** Project Organization (P0.3) + Focus Mode (P0.4)
3. **Week 5–6:** AI Research (P1.5) + Character Tools (P1.6)
4. **Week 7–8:** Collaboration (P1.7) + Export (P1.8)
