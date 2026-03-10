# Skillify-That Plan

## Summary
- Build in two phases: deep research on `SKILL.md` authoring, then a Next.js MVP that extracts skill drafts from public YouTube and web URLs.
- Base the research on `skill-creator` rules and turn it into a strict rubric + templates.
- MVP stack: Next.js (App Router), Vercel, Neon Postgres, Prisma, Clerk auth, Groq-first provider adapter (Cerebras-ready).

## Phase 1: Skill Research
- Create a **Skill Authoring Spec v1** from canonical local skill guidance.
- Define required `SKILL.md` structure:
- Frontmatter with `name` and `description`.
- Concise body with actionable instructions and progressive disclosure.
- Create quality rubric:
- Trigger clarity.
- "What + when to use" description quality.
- Resource organization (`scripts/`, `references/`, `assets/`).
- Concision and anti-pattern checks.
- Deliver template pack:
- Workflow-based template.
- Task-based template.
- Reference/guidelines template.
- Define validation contract:
- Static checks (frontmatter format, naming rules).
- Semantic checks (trigger language, structure completeness).

## Phase 2: Next.js Webapp MVP
- Build single-owner project workflow with Clerk authentication.
- Support multi-source projects:
- Public YouTube URLs.
- General web URLs.
- Ingestion pipeline:
- YouTube captions first.
- Fallback to STT when captions are unavailable.
- Web content extraction and cleanup.
- Draft generation:
- Synthesize all ingested notes into one `SKILL.md` draft.
- Run rubric scoring and attach quality flags.
- Review workflow:
- Edit and regenerate draft in-app.
- Export as `SKILL.md` download and copy.

## API and Interface Plan
- `POST /api/projects` create project.
- `POST /api/sources` add URL source.
- `POST /api/sources/:id/ingest` run extraction.
- `POST /api/projects/:id/generate-draft` generate synthesized skill draft.
- `POST /api/drafts/:id/review` run rubric scoring.
- `GET /api/drafts/:id/export` download `SKILL.md`.
- Core types: `Project`, `Source`, `ExtractionResult`, `SourceNote`, `SkillDraft`, `ReviewScore`, `ReviewFlag`, `ProviderConfig`.
- Provider adapter contract:
- `summarizeSource(...)`
- `generateSkillDraft(...)`
- `scoreDraftAgainstRubric(...)`
- `transcribeAudio(...)` (optional capability)

## Test Plan
- Unit tests for validation, rubric scoring, and provider adapter behavior.
- Integration tests for:
- YouTube with captions.
- YouTube with STT fallback.
- Web extraction.
- Multi-source synthesis.
- Draft review and export.
- End-to-end flow:
- Login.
- Create project.
- Add mixed sources.
- Ingest.
- Generate draft.
- Review and export.
- Failure tests:
- Invalid URLs.
- Missing transcript.
- Provider timeout/rate-limit handling.

## Assumptions
- English-first scope.
- Public YouTube + web URLs only in MVP.
- Single-owner usage.
- Groq first, Cerebras next via adapter.
- Output is reviewed `SKILL.md` draft (not full ZIP scaffold).